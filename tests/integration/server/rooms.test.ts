import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupDatabase, prepareDatabase, testPool, testUser } from '../../helpers/database'
import { createRoom, ensureSelf, joinRoom, mutateRoom, readRoom } from '../../../server/utils/rooms'
import { getPool } from '../../../server/db/db'
import { readAccount } from '../../../server/utils/account'
import type { RoomView } from '../../../shared/types/rooms'
import type { RoomAction } from '../../../shared/utils/validation'
import { roomActionSchema } from '../../../shared/utils/validation'

beforeAll(prepareDatabase)
afterAll(async () => { await cleanupDatabase(); await getPool().end() })
function act(room: RoomView, userId: string, action: RoomAction, requestId = crypto.randomUUID()) {
  return mutateRoom(room.id, userId, requestId, room.revision, action)
}

async function started(mode: 'x01' | 'atc' = 'x01') {
  const alice = await testUser('Alice')
  const bob = await testUser('Bob')
  let room = await createRoom(alice, mode === 'x01' ? { mode, startScore: 301, doubleIn: false, doubleOut: true, legsTarget: 1 } : { mode, fastForward: true })
  room = await joinRoom(room.code, bob)
  room = await act(room, alice.id, { type: 'ready', ready: true })
  room = await act(room, bob.id, { type: 'ready', ready: true })
  room = await act(room, alice.id, { type: 'start' })
  return { alice, bob, room }
}

describe('server-authoritative rooms', () => {
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

  it('prevents the same account starting two matches concurrently', async () => {
    const alice = await testUser('Alice')
    const bob = await testUser('Bob')
    const charlie = await testUser('Charlie')
    let a = await createRoom(alice)
    let b = await createRoom(alice)
    a = await joinRoom(a.code, bob)
    b = await joinRoom(b.code, charlie)
    a = await act(a, alice.id, { type: 'ready', ready: true })
    a = await act(a, bob.id, { type: 'ready', ready: true })
    b = await act(b, alice.id, { type: 'ready', ready: true })
    b = await act(b, charlie.id, { type: 'ready', ready: true })
    const results = await Promise.allSettled([act(a, alice.id, { type: 'start' }), act(b, alice.id, { type: 'start' })])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
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
