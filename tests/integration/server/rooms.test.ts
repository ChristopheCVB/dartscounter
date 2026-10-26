import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupDatabase, prepareDatabase, testPool, testUser } from '../../helpers/database'
import { createRoom, ensureSelf, joinRoom, leaveRoom, loadRoom, mutateRoom, readRoom, transaction } from '../../../server/utils/rooms'
import { getPool } from '../../../server/db/db'
import { ensurePlayers, readAccount } from '../../../server/utils/account'
import type { RoomView } from '../../../shared/types/rooms'
import { defaultPreferences } from '../../../shared/types/rooms'
import type { RoomAction } from '../../../shared/utils/validation'
import { roomActionSchema } from '../../../shared/utils/validation'
import { getAtcTargetSegment } from '../../../shared/utils/atcEngine'
import { CRICKET_TARGETS } from '../../../shared/utils/cricketEngine'
import { aggregatePlayerStats } from '../../../shared/utils/playerStats'

beforeAll(prepareDatabase)
afterAll(async () => { await cleanupDatabase(); await getPool().end() })
function withoutDeadlines(room: RoomView) {
  return { ...room, members: room.members.map(member => ({ ...member, expiresAt: 0 })) }
}
function act(room: RoomView, userId: string, action: RoomAction, requestId = crypto.randomUUID()) {
  return mutateRoom(room.id, userId, requestId, room.revision, action)
}

async function started(mode: 'x01' | 'atc' | 'cricket' = 'x01') {
  const alice = await testUser('Alice')
  const bob = await testUser('Bob')
  let room = await createRoom(alice, mode === 'x01' ? { mode, startScore: 301, doubleIn: false, doubleOut: true, legsTarget: 1 } : mode === 'cricket' ? { mode, legsTarget: 1 } : { mode, fastForward: true })
  room = await joinRoom(room.code, bob)
  room = await act(room, alice.id, { type: 'ready', ready: true })
  room = await act(room, bob.id, { type: 'ready', ready: true })
  room = await act(room, alice.id, { type: 'start' })
  return { alice, bob, room }
}

describe('server-authoritative rooms', () => {
  it('loads the Cricket default for accounts with older stored preferences', async () => {
    const owner = await testUser('Old preferences')
    const { cricketSettings: _, ...legacy } = defaultPreferences
    await testPool.query('INSERT INTO preferences (user_id,data) VALUES ($1,$2)', [owner.id, JSON.stringify(legacy)])
    expect((await readAccount(owner)).cricketSettings).toEqual({ mode: 'cricket', legsTarget: 1 })
  })

  it('persists Cricket points, retries safely, restores leg wins, and undoes completed history', async () => {
    const { alice, bob, room: initial } = await started('cricket')
    let room = initial
    const winner = room.match!.players[0]!
    const controller = room.controllers[winner.id]!
    const other = controller === alice.id ? bob.id : alice.id
    const dart = { type: 'dart', dart: { segment: 20, multiplier: 3 } } as const
    await expect(act(room, other, dart)).rejects.toMatchObject({ statusCode: 403 })
    const requestId = crypto.randomUUID()
    room = await act(initial, controller, dart, requestId)
    expect((await act(initial, controller, dart, requestId)).match!.throws).toHaveLength(1)
    await expect(act(initial, controller, dart)).rejects.toMatchObject({ statusCode: 409 })
    room = await act(room, controller, { type: 'dart', dart: { segment: 20, multiplier: 1 } })
    expect(room.match!.players[0]!.score).toBe(20)
    expect((await loadRoom(room.id, other)).match).toEqual(room.match)
    room = await act(room, other, { type: 'undo' })
    expect(room.match!.players[0]!.score).toBe(0)

    // The first player closes targets; the other player misses until the leg ends.
    for (let count = 0; count < 30 && room.match!.status === 'in_progress'; count++) {
      const player = room.match!.players[room.match!.currentPlayerIndex]!
      const target = CRICKET_TARGETS.find(target => player.cricketMarks![target] < 3)!
      room = await act(room, room.controllers[player.id]!, { type: 'dart', dart: player.id === winner.id ? { segment: target, multiplier: target === 25 ? 2 : 3 } : { segment: 0, multiplier: 1 } })
    }
    expect(room.match!.status).toBe('finished')
    expect(room.summary!.gameMode).toBe('cricket')
    expect(room.summary!.players[0]).toMatchObject({ legsWon: 1, scoredMarks: 22, scoredPoints: 25, dartsThrown: 8 })
    const history = (await readAccount(alice)).history
    expect(aggregatePlayerStats(history, [], 'cricket')[0]!.matches).toBe(1)
    await testPool.query('INSERT INTO hidden_history (match_id,user_id) VALUES ($1,$2)', [room.match!.id, alice.id])
    expect((await readAccount(alice)).history).toEqual([])
    expect((await readAccount(bob)).history).toHaveLength(1)
    const won = structuredClone(room)
    room = await act(room, other, { type: 'undo' })
    expect(room.summary).toBeNull()
    expect(room.match!.status).toBe('in_progress')
    expect(room.match!.players[0]!.cricketMarks![25]).toBe(2)
    expect(room.match!.players[0]!.legsWon).toBe(0)
    expect((await readAccount(bob)).history).toEqual([])
    room = await act(room, controller, { type: 'dart', dart: { segment: 25, multiplier: 2 } })
    expect(room.summary!.players).toEqual(won.summary!.players)
  })

  it('uses every saved X01 default when creating a room without explicit rules', async () => {
    const owner = await testUser('Saved defaults')
    const preferences = { ...defaultPreferences, settings: { mode: 'x01' as const, startScore: 301 as const, doubleIn: true, doubleOut: false, legsTarget: 3 } }
    await testPool.query('INSERT INTO preferences (user_id,data) VALUES ($1,$2)', [owner.id, JSON.stringify(preferences)])
    const room = await createRoom(owner)
    expect(room.settings).toEqual(preferences.settings)
    expect((await readAccount(owner)).settings).toEqual(preferences.settings)
  })

  it.each(['x01', 'atc', 'cricket'] as const)('keeps saved defaults when creating a room with explicit %s rules', async mode => {
    const owner = await testUser('Explicit rules')
    await testPool.query('INSERT INTO preferences (user_id,data) VALUES ($1,$2)', [owner.id, JSON.stringify(defaultPreferences)])
    const settings = mode === 'x01'
      ? { mode, startScore: 301 as const, doubleIn: true, doubleOut: false, legsTarget: 3 }
      : mode === 'cricket' ? { mode, legsTarget: 3 } : { mode, fastForward: true }
    expect((await createRoom(owner, settings)).settings).toEqual(settings)
    const account = await readAccount(owner)
    expect(account.settings).toEqual(defaultPreferences.settings)
    expect(account.atcSettings).toEqual(defaultPreferences.atcSettings)
  })

  it('repairs stale lobby rosters, clears all readiness, and allows a fresh guest with the same name', async () => {
    const owner = await testUser('Owner')
    const other = await testUser('Other')
    let room = await createRoom(owner)
    room = await joinRoom(room.code, other)
    const self = room.members.find(member => member.userId === owner.id)!.roster[0]!
    const [deleted] = await transaction(db => ensurePlayers(db, owner.id, [{ name: 'Guest', color: '#30c981' }]))
    room = await act(room, owner.id, { type: 'roster', playerIds: [self.id, deleted!.id] })
    room = await act(room, owner.id, { type: 'ready', ready: true })
    room = await act(room, other.id, { type: 'ready', ready: true })
    await testPool.query('UPDATE players SET archived=true WHERE id=$1', [deleted!.id])
    const [fresh] = await transaction(db => ensurePlayers(db, owner.id, [{ name: 'Guest', color: '#38bdf8' }]))
    expect(fresh!.id).not.toBe(deleted!.id)
    const outsider = await testUser('Outsider')
    await expect(loadRoom(room.id, outsider.id)).rejects.toMatchObject({ statusCode: 404 })
    const repaired = await loadRoom(room.id, owner.id)
    expect(repaired.revision).toBe(room.revision + 1)
    expect(repaired.members.find(member => member.userId === owner.id)!.roster).toEqual([self])
    expect(repaired.members.every(member => !member.ready)).toBe(true)
    expect(withoutDeadlines(await readRoom(getPool(), room.id, owner.id))).toEqual(withoutDeadlines(repaired))
    expect(withoutDeadlines(await loadRoom(room.id, owner.id))).toEqual(withoutDeadlines(repaired))
    room = await act(repaired, owner.id, { type: 'roster', playerIds: [self.id, fresh!.id] })
    room = await act(room, owner.id, { type: 'ready', ready: true })
    room = await act(room, other.id, { type: 'ready', ready: true })
    room = await act(room, owner.id, { type: 'start' })
    expect(room.match!.players.map(player => player.id)).toContain(fresh!.id)
    expect(room.match!.players.map(player => player.id)).not.toContain(deleted!.id)
  })

  it('keeps deleted guests playing, prunes them after a win, and restores them for winning-dart undo', async () => {
    const owner = await testUser('Owner')
    let room = await createRoom(owner, { mode: 'atc', fastForward: true })
    const self = room.members[0]!.roster[0]!
    const [guest] = await transaction(db => ensurePlayers(db, owner.id, [{ name: 'Guest', color: '#30c981' }]))
    room = await act(room, owner.id, { type: 'roster', playerIds: [self.id, guest!.id] })
    room = await act(room, owner.id, { type: 'ready', ready: true })
    room = await act(room, owner.id, { type: 'start' })
    await testPool.query('UPDATE players SET archived=true WHERE id=$1', [guest!.id])
    expect(withoutDeadlines(await loadRoom(room.id, owner.id))).toEqual(withoutDeadlines(room))
    for (let dart = 0; dart < 20 && room.match!.status === 'in_progress'; dart++) {
      const target = room.match!.players[room.match!.currentPlayerIndex]!.atcTarget!
      room = await act(room, owner.id, { type: 'dart', dart: { segment: getAtcTargetSegment(target), multiplier: target > 20 ? 2 : 3 } })
    }
    expect(room.match!.status).toBe('finished')
    expect(room.members[0]!.roster).toEqual([self])
    expect(room.summary!.players.map(player => player.playerId)).toContain(guest!.id)
    room = await act(room, owner.id, { type: 'undo' })
    expect(room.match!.status).toBe('in_progress')
    expect(room.members[0]!.roster.map(player => player.id).sort()).toEqual([self.id, guest!.id].sort())
    room = await act(room, owner.id, { type: 'abandon' })
    expect(room.members[0]!.roster).toEqual([self])
    expect(room.match!.players.map(player => player.id)).toContain(guest!.id)
  })

  it.each(['x01', 'atc', 'cricket'] as const)('starts %s with one account controlling itself and a guest', async mode => {
    const owner = await testUser('Owner')
    let room = await createRoom(owner, mode === 'x01' ? { mode, startScore: 301, doubleIn: false, doubleOut: true, legsTarget: 1 } : mode === 'cricket' ? { mode, legsTarget: 1 } : { mode, fastForward: false })
    const self = room.members[0]!.roster[0]!
    const [guest] = await transaction(db => ensurePlayers(db, owner.id, [{ name: 'Guest', color: '#30c981' }]))
    room = await act(room, owner.id, { type: 'roster', playerIds: [self.id, guest!.id] })
    room = await act(room, owner.id, { type: 'ready', ready: true })
    room = await act(room, owner.id, { type: 'start' })

    expect(room.members).toHaveLength(1)
    expect(room.participantIds).toEqual([owner.id])
    expect(room.match!.players).toHaveLength(2)
    expect(room.controllers).toEqual({ [self.id]: owner.id, [guest!.id]: owner.id })
    for (let dart = 0; dart < 6; dart++) room = await act(room, owner.id, { type: 'dart', dart: { segment: 0, multiplier: 1 } })
    expect(new Set(room.match!.throws.map(dart => dart.playerId))).toEqual(new Set([self.id, guest!.id]))
  })

  it('keeps an unfinished match discoverable after deleting and recreating a guest', async () => {
    const owner = await testUser('Room owner')
    let original = await createRoom(owner)
    const self = original.members[0]!.roster[0]!
    const [oldGuest] = await transaction(db => ensurePlayers(db, owner.id, [{ name: 'Guest', color: '#30c981' }]))
    original = await act(original, owner.id, { type: 'roster', playerIds: [self.id, oldGuest!.id] })
    original = await act(original, owner.id, { type: 'ready', ready: true })
    original = await act(original, owner.id, { type: 'start' })
    await testPool.query('UPDATE players SET archived=true WHERE id=$1', [oldGuest!.id])
    const [newGuest] = await transaction(db => ensurePlayers(db, owner.id, [{ name: 'Guest', color: '#38bdf8' }]))
    expect(newGuest!.id).not.toBe(oldGuest!.id)
    const account = await readAccount(owner)
    expect(account.currentRoom?.id).toBe(original.id)
    expect(account.currentRoom?.match?.status).toBe('in_progress')
    await expect(createRoom(owner)).rejects.toMatchObject({ statusCode: 409 })

    await leaveRoom(original.id, owner.id, original.revision)
    expect((await readAccount(owner)).currentRoom).toBeNull()
    let next = await createRoom(owner)
    next = await act(next, owner.id, { type: 'roster', playerIds: [self.id, newGuest!.id] })
    next = await act(next, owner.id, { type: 'ready', ready: true })
    next = await act(next, owner.id, { type: 'start' })
    expect((await readAccount(owner)).currentRoom?.id).toBe(next.id)
    expect(next.match!.players.some(player => player.id === newGuest!.id)).toBe(true)
  })

  it('requires readiness, own profiles, ownership, and distinct player names', async () => {
    const alice = await testUser('Alice')
    const bob = await testUser('Bob')
    let room = await createRoom(alice)
    room = await joinRoom(room.code, bob)
    await expect(act(room, alice.id, { type: 'start' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(act(room, bob.id, { type: 'start' })).rejects.toMatchObject({ statusCode: 403 })
    await expect(act(room, alice.id, { type: 'roster', playerIds: room.members.find(m => m.userId === bob.id)!.roster.map(p => p.id) })).rejects.toMatchObject({ statusCode: 400 })
    room = await act(room, alice.id, { type: 'ready', ready: true })
    room = await act(room, alice.id, { type: 'settings', settings: { ...room.settings, mode: 'x01', startScore: 301, doubleIn: true, doubleOut: true, legsTarget: 2 } })
    expect(room.members.every(m => !m.ready)).toBe(true)
  })

  it('scores only for the controller, retries once, rejects stale writes, and allows participant undo', async () => {
    const { alice, bob, room: initial } = await started()
    const controller = initial.controllers[initial.match!.players[0]!.id]!
    const other = controller === alice.id ? bob.id : alice.id
    const action = { type: 'dart', dart: { segment: 20, multiplier: 3 } } as const
    await expect(act(initial, other, action)).rejects.toMatchObject({ statusCode: 403 })
    const request = crypto.randomUUID()
    let room = await act(initial, controller, action, request)
    expect(room.match!.players[0]!.score).toBe(241)
    expect((await act(initial, controller, action, request)).revision).toBe(room.revision)
    await expect(act(initial, controller, action)).rejects.toMatchObject({ statusCode: 409 })
    await expect(act(initial, controller, { type: 'undo' }, request)).rejects.toMatchObject({ statusCode: 409 })
    room = await act(room, other, { type: 'undo' })
    expect(room.match!.players[0]!.score).toBe(301)
    expect(room.match!.throws).toHaveLength(0)
    expect((await readRoom(getPool(), room.id, other)).match).toEqual(room.match)
  })

  it('serializes simultaneous darts against the same revision', async () => {
    const { room } = await started()
    const controller = room.controllers[room.match!.players[0]!.id]!
    const results = await Promise.allSettled([act(room, controller, { type: 'dart', dart: { segment: 20, multiplier: 1 } }), act(room, controller, { type: 'dart', dart: { segment: 20, multiplier: 1 } })])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await readRoom(getPool(), room.id, controller)).match!.throws).toHaveLength(1)
  })

  it('keeps late joiners watching, does not transfer control, and only lets the host abandon', async () => {
    const { alice, bob, room: initial } = await started('atc')
    const spectator = await testUser('Spectator')
    let room = await joinRoom(initial.code, spectator)
    expect(room.participantIds).not.toContain(spectator.id)
    await expect(act(room, spectator.id, { type: 'undo' })).rejects.toMatchObject({ statusCode: 403 })
    await expect(act(room, bob.id, { type: 'abandon' })).rejects.toMatchObject({ statusCode: 403 })
    room = await act(room, alice.id, { type: 'abandon' })
    expect(room.match!.status).toBe('abandoned')
    expect(room.summary).toBeNull()
    expect(room.canUndo).toBe(false)
    expect((await readAccount(alice)).history).toHaveLength(0)
  })

  it('atomically records a win, hides history per account, and reopens on winning-dart undo', async () => {
    const { alice, bob, room: initial } = await started()
    let room = initial
    // Play a complete 301 game for both players: 180, then 101, then double 10.
    for (const darts of [Array(3).fill({ segment: 20, multiplier: 3 }), [{ segment: 17, multiplier: 3 }, { segment: 25, multiplier: 2 }, { segment: 0, multiplier: 1 }], [{ segment: 10, multiplier: 2 }]]) {
      for (let turn = 0; turn < 2 && room.match!.status === 'in_progress'; turn++) {
        for (const dart of darts) {
          if (room.match!.status !== 'in_progress') break
          const player = room.match!.players[room.match!.currentPlayerIndex]!
          room = await act(room, room.controllers[player.id]!, { type: 'dart', dart })
        }
      }
    }
    expect(room.match!.status).toBe('finished')
    expect((await readAccount(alice)).history).toHaveLength(1)
    expect((await readAccount(bob)).history).toHaveLength(1)
    await testPool.query('INSERT INTO hidden_history (match_id,user_id) VALUES ($1,$2)', [room.match!.id, alice.id])
    expect((await readAccount(alice)).history).toHaveLength(0)
    expect((await readAccount(bob)).history).toHaveLength(1)
    room = await act(room, bob.id, { type: 'undo' })
    expect(room.match!.status).toBe('in_progress')
    expect(room.summary).toBeNull()
    expect((await readAccount(bob)).history).toHaveLength(0)
    const player = room.match!.players[room.match!.currentPlayerIndex]!
    room = await act(room, room.controllers[player.id]!, { type: 'dart', dart: { segment: 10, multiplier: 2 } })
    expect((await readAccount(alice)).history).toHaveLength(0)
    room = await act(room, alice.id, { type: 'ready', ready: true })
    room = await act(room, bob.id, { type: 'ready', ready: true })
    const oldId = room.match!.id
    room = await act(room, alice.id, { type: 'start' })
    expect(room.match!.id).not.toBe(oldId)
    expect((await testPool.query('SELECT locked FROM matches WHERE id=$1', [oldId])).rows[0].locked).toBe(true)
  })

  it('prevents concurrent room creation for the same account', async () => {
    const alice = await testUser('Alice')
    const results = await Promise.allSettled([createRoom(alice), createRoom(alice)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { statusCode: 409 } })
  })

  it('rotates codes and revokes removed members while retaining historical identities', async () => {
    const alice = await testUser('Alice')
    const bob = await testUser('Bob')
    let room = await createRoom(alice)
    const old = room.code
    room = await joinRoom(room.code, bob)
    room = await act(room, alice.id, { type: 'rotate' })
    expect(room.code).not.toBe(old)
    await expect(joinRoom(old, bob)).rejects.toMatchObject({ statusCode: 404 })
    room = await act(room, alice.id, { type: 'kick', userId: bob.id })
    await expect(readRoom(getPool(), room.id, bob.id)).rejects.toMatchObject({ statusCode: 404 })
    expect((await ensureSelf(getPool(), bob)).name).toBe('Bob')
  })

  it.each([{ segment: 21, multiplier: 1 }, { segment: 25, multiplier: 3 }, { segment: 0, multiplier: 2 }, { segment: -1, multiplier: 1 }])('rejects invalid dart $segment/$multiplier at the API boundary', dart => {
    expect(roomActionSchema.safeParse({ requestId: crypto.randomUUID(), expectedRevision: 0, action: { type: 'dart', dart } }).success).toBe(false)
  })
})
