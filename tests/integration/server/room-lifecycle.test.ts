import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupDatabase, prepareDatabase, testPool, testUser } from '../../helpers/database'
import { getPool } from '../../../server/db/db'
import { readAccount } from '../../../server/utils/account'
import { createRoom, expireRooms, joinRoom, leaveRoom, loadRoom, mutateRoom, readRoom } from '../../../server/utils/rooms'
import type { RoomView } from '../../../shared/types/rooms'
import type { RoomAction } from '../../../shared/utils/validation'
import { ROOM_GRACE_MS } from '../../../shared/types/rooms'
import { getAtcTargetSegment } from '../../../shared/utils/atcEngine'
import { aggregatePlayerStats } from '../../../shared/utils/playerStats'

beforeAll(prepareDatabase)
afterAll(async () => { await cleanupDatabase(); await getPool().end() })
const act = (room: RoomView, userId: string, action: RoomAction) => mutateRoom(room.id, userId, crypto.randomUUID(), room.revision, action)

async function started() {
  const alice = await testUser('Alice')
  const bob = await testUser('Bob')
  let room = await createRoom(alice, { mode: 'atc', fastForward: true })
  room = await joinRoom(room.code, bob)
  room = await act(room, alice.id, { type: 'ready', ready: true })
  room = await act(room, bob.id, { type: 'ready', ready: true })
  room = await act(room, alice.id, { type: 'start' })
  return { alice, bob, room }
}

describe('temporary rooms', () => {
  it('keeps membership through a short absence, renews on either tab, and does not renew from account reads', async () => {
    const user = await testUser('Reconnect')
    const initial = await createRoom(user)
    await testPool.query("UPDATE members SET last_seen_at=now()-interval '1 minute',expires_at=now()+interval '1 minute' WHERE room_id=$1", [initial.id])
    const away = (await readAccount(user)).currentRoom!
    expect(away.members[0]!.connected).toBe(false)
    expect((await readAccount(user)).currentRoom!.members[0]!.expiresAt).toBe(away.members[0]!.expiresAt)
    const firstTab = await loadRoom(initial.id, user.id)
    const secondTab = await loadRoom(initial.id, user.id)
    expect(firstTab.members[0]!.connected).toBe(true)
    expect(secondTab.members[0]!.expiresAt).toBeGreaterThanOrEqual(firstTab.members[0]!.expiresAt)
    expect(secondTab.members[0]!.expiresAt).toBeGreaterThan(Date.now() + ROOM_GRACE_MS - 5_000)
    expect(secondTab.revision).toBe(initial.revision)
  })

  it('rejects a second membership, including concurrent joins, and permits rejoining the same room', async () => {
    const alice = await testUser('Alice')
    const bob = await testUser('Bob')
    const visitor = await testUser('Visitor')
    const a = await createRoom(alice)
    const b = await createRoom(bob)
    const results = await Promise.allSettled([joinRoom(a.code, visitor), joinRoom(b.code, visitor)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { statusCode: 409 } })
    const current = (await readAccount(visitor)).currentRoom!
    expect((await joinRoom(current.code, visitor)).id).toBe(current.id)
    await expect(createRoom(visitor)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('prefers a connected successor over an earlier reconnecting member and clears readiness', async () => {
    const owner = await testUser('Owner')
    const away = await testUser('Away')
    const present = await testUser('Present')
    let room = await createRoom(owner)
    room = await joinRoom(room.code, away)
    room = await joinRoom(room.code, present)
    room = await act(room, present.id, { type: 'ready', ready: true })
    await testPool.query("UPDATE members SET last_seen_at=now()-interval '1 minute' WHERE user_id=$1", [away.id])
    await leaveRoom(room.id, owner.id, room.revision)
    room = await readRoom(getPool(), room.id, present.id)
    expect(room.ownerId).toBe(present.id)
    expect(room.members.every(member => !member.ready)).toBe(true)
    expect((await readAccount(owner)).currentRoom).toBeNull()
  })

  it('keeps a match running when a late spectator leaves but abandons it when a controller leaves', async () => {
    const { alice, bob, room: initial } = await started()
    const spectator = await testUser('Spectator')
    let room = await joinRoom(initial.code, spectator)
    await leaveRoom(room.id, spectator.id, room.revision)
    room = await readRoom(getPool(), room.id, alice.id)
    expect(room.match!.status).toBe('in_progress')
    await leaveRoom(room.id, alice.id, room.revision)
    room = await readRoom(getPool(), room.id, bob.id)
    expect(room.ownerId).toBe(bob.id)
    expect(room.match!.status).toBe('abandoned')
    expect(room.summary).toBeNull()
    expect(room.canUndo).toBe(false)
    expect((await testPool.query('SELECT * FROM participants WHERE match_id=$1 AND active', [room.match!.id])).rowCount).toBe(0)
    expect((await readAccount(bob)).history).toEqual([])
  })

  it('rejects stale leave requests, retries a successful departure, and protects a new membership from an old retry', async () => {
    const alice = await testUser('Alice')
    const bob = await testUser('Bob')
    const initial = await createRoom(alice)
    let room = await joinRoom(initial.code, bob)
    await expect(leaveRoom(room.id, alice.id, initial.revision)).rejects.toMatchObject({ statusCode: 409 })
    expect((await readRoom(getPool(), room.id, alice.id)).members).toHaveLength(2)
    await leaveRoom(room.id, alice.id, room.revision)
    await expect(leaveRoom(room.id, alice.id, room.revision)).resolves.toEqual({ ok: true })
    room = await joinRoom(room.code, alice)
    await expect(leaveRoom(room.id, alice.id, initial.revision)).rejects.toMatchObject({ statusCode: 409 })
    expect((await readAccount(alice)).currentRoom?.id).toBe(room.id)
  })

  it('destroys an empty room, its code, unfinished matches and action receipts; repeated leave succeeds', async () => {
    const { alice, bob, room: initial } = await started()
    await leaveRoom(initial.id, bob.id, initial.revision)
    const room = await readRoom(getPool(), initial.id, alice.id)
    await leaveRoom(room.id, alice.id, room.revision)
    await expect(leaveRoom(room.id, alice.id, room.revision)).resolves.toEqual({ ok: true })
    await expect(joinRoom(room.code, bob)).rejects.toMatchObject({ statusCode: 404 })
    await expect(loadRoom(room.id, alice.id)).rejects.toMatchObject({ statusCode: 404 })
    for (const table of ['rooms', 'members', 'matches', 'actions']) {
      const column = table === 'rooms' ? 'id' : 'room_id'
      expect((await testPool.query(`SELECT * FROM ${table} WHERE ${column}=$1`, [room.id])).rowCount).toBe(0)
    }
    expect((await testPool.query('SELECT * FROM participants WHERE match_id=$1', [room.match!.id])).rowCount).toBe(0)
  })

  it('keeps finished history, hidden results and lifetime statistics when the last person leaves', async () => {
    const { alice, bob, room: initial } = await started()
    let room = initial
    for (let dart = 0; dart < 30 && room.match!.status === 'in_progress'; dart++) {
      const player = room.match!.players[room.match!.currentPlayerIndex]!
      room = await act(room, room.controllers[player.id]!, { type: 'dart', dart: { segment: getAtcTargetSegment(player.atcTarget!), multiplier: player.atcTarget! > 20 ? 2 : 3 } })
    }
    expect(room.match!.status).toBe('finished')
    await testPool.query('INSERT INTO hidden_history (match_id,user_id) VALUES ($1,$2)', [room.match!.id, alice.id])
    const history = (await readAccount(bob)).history
    const stats = aggregatePlayerStats(history, [], 'atc')
    await leaveRoom(room.id, alice.id, room.revision)
    room = await readRoom(getPool(), room.id, bob.id)
    expect(room.canUndo).toBe(false)
    await expect(act(room, bob.id, { type: 'undo' })).rejects.toMatchObject({ statusCode: 409 })
    await leaveRoom(room.id, bob.id, room.revision)
    expect((await readAccount(alice)).history).toEqual([])
    expect((await readAccount(bob)).history).toEqual(history)
    expect(aggregatePlayerStats((await readAccount(bob)).history, [], 'atc')).toEqual(stats)
    const saved = (await testPool.query('SELECT room_id,locked,undo,summary FROM matches WHERE id=$1', [room.match!.id])).rows[0]
    expect(saved).toMatchObject({ room_id: null, locked: true, undo: [], summary: room.summary })
  })

  it('prevents starting with a disconnected selected account', async () => {
    const { alice, bob, room: initial } = await started()
    let room = await act(initial, alice.id, { type: 'abandon' })
    room = await act(room, alice.id, { type: 'ready', ready: true })
    room = await act(room, bob.id, { type: 'ready', ready: true })
    await testPool.query("UPDATE members SET last_seen_at=now()-interval '1 minute' WHERE user_id=$1", [bob.id])
    await expect(act(room, alice.id, { type: 'start' })).rejects.toMatchObject({ statusCode: 409 })
    room = await loadRoom(room.id, bob.id)
    expect((await act(room, alice.id, { type: 'start' })).match!.status).toBe('in_progress')
  })

  it('commits expired departures even when the triggering action is stale, and never revives them on reconnect', async () => {
    const { alice, bob, room } = await started()
    await testPool.query("UPDATE members SET expires_at=now()-interval '1 second' WHERE user_id=$1", [bob.id])
    await expect(act(room, alice.id, { type: 'dart', dart: { segment: 1, multiplier: 1 } })).rejects.toMatchObject({ statusCode: 409 })
    await expect(loadRoom(room.id, bob.id)).rejects.toMatchObject({ statusCode: 404 })
    const remaining = await readRoom(getPool(), room.id, alice.id)
    expect(remaining.members.map(member => member.userId)).toEqual([alice.id])
    expect(remaining.match!.status).toBe('abandoned')
    expect(remaining.match!.throws).toEqual([])
  })

  it('handles concurrent expiry, scoring and reconnect under the same room lock', async () => {
    const { alice, bob, room } = await started()
    await testPool.query("UPDATE members SET expires_at=now()-interval '1 second' WHERE user_id=$1", [bob.id])
    const results = await Promise.allSettled([
      expireRooms(), loadRoom(room.id, bob.id),
      act(room, alice.id, { type: 'dart', dart: { segment: 1, multiplier: 1 } })
    ])
    expect(results[0]!.status).toBe('fulfilled')
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { statusCode: 404 } })
    expect(results[2]).toMatchObject({ status: 'rejected', reason: { statusCode: 409 } })
    expect((await readRoom(getPool(), room.id, alice.id)).match!.status).toBe('abandoned')
  })

  it('cleans up persisted deadlines without relying on any in-memory connections', async () => {
    const user = await testUser('Expired')
    const room = await createRoom(user)
    await testPool.query("UPDATE members SET expires_at=now()-interval '1 second' WHERE room_id=$1", [room.id])
    await expireRooms()
    expect((await readAccount(user)).currentRoom).toBeNull()
    await expect(loadRoom(room.id, user.id)).rejects.toMatchObject({ statusCode: 404 })
    expect((await createRoom(user)).id).not.toBe(room.id)
  })
})

it('migrates permanent rooms without losing completed results or hidden-history preferences', async () => {
  const client = await testPool.connect()
  const schema = `migration_${crypto.randomUUID().replaceAll('-', '')}`
  try {
    await client.query('BEGIN')
    await client.query(`CREATE SCHEMA "${schema}"`)
    await client.query(`SET LOCAL search_path TO "${schema}"`)
    const original = await readFile('server/db/migrations/0000_white_dreaming_celestial.sql', 'utf8')
    await client.query(original.replaceAll('"public".', `"${schema}".`))
    await client.query(`INSERT INTO "user" (id,name,email) VALUES ('alice','Alice','alice@example.test')`)
    const rooms = (await client.query(`INSERT INTO rooms (code,owner_id,settings) VALUES ('AAAAAAAA','alice','{}'),('BBBBBBBB','alice','{}') RETURNING id`)).rows
    for (const room of rooms) await client.query(`INSERT INTO members (room_id,user_id) VALUES ($1,'alice')`, [room.id])
    const finished = crypto.randomUUID()
    const unfinished = crypto.randomUUID()
    await client.query(`INSERT INTO matches (id,room_id,state,controllers,summary,undo) VALUES ($1,$3,'{"status":"finished"}','{}','{"winnerName":"Alice"}','[{}]'),($2,$3,'{"status":"in_progress"}','{}',NULL,'[{}]')`, [finished, unfinished, rooms[0]!.id])
    await client.query(`INSERT INTO participants (match_id,user_id,active) VALUES ($1,'alice',false),($2,'alice',true)`, [finished, unfinished])
    await client.query(`INSERT INTO hidden_history (match_id,user_id) VALUES ($1,'alice')`, [finished])
    await client.query(`INSERT INTO actions (room_id,user_id,request_id,input,result) VALUES ($1,'alice',$2,'{}','{}')`, [rooms[0]!.id, crypto.randomUUID()])
    const migration = await readFile('server/db/migrations/0001_temporary_rooms.sql', 'utf8')
    await client.query(migration.replaceAll('"public".', `"${schema}".`))
    for (const table of ['rooms', 'members', 'actions']) expect((await client.query(`SELECT * FROM ${table}`)).rowCount).toBe(0)
    expect((await client.query('SELECT id,room_id,locked,undo,summary FROM matches')).rows).toEqual([{ id: finished, room_id: null, locked: true, undo: [], summary: { winnerName: 'Alice' } }])
    expect((await client.query('SELECT * FROM hidden_history')).rowCount).toBe(1)
    expect((await client.query('SELECT active FROM participants')).rows).toEqual([{ active: false }])
  } finally { await client.query('ROLLBACK'); client.release() }
})
