import { randomInt } from 'node:crypto'
import { createError } from 'h3'
import type { PoolClient } from 'pg'
import { getPool } from '../db/db'
import type { Match, MatchSummary, GameSettings, PlayerIdentity } from '../../shared/types/darts'
import type { RoomView } from '../../shared/types/rooms'
import { defaultPreferences } from '../../shared/types/rooms'
import { useMatchState } from '../../shared/utils/matchState'
import type { RoomAction } from '../../shared/utils/validation'
import { publishRoom } from './live'

type Connection = Pick<PoolClient, 'query'>
interface RoomRow { id: string, code: string, owner_id: string, revision: number, settings: GameSettings, match_id: string | null }
interface MatchRow { id: string, room_id: string, state: Match, controllers: Record<string, string>, undo: Match[], summary: MatchSummary | null, locked: boolean }
const engine = useMatchState()
const fail = (statusCode: number, statusMessage: string): never => { throw createError({ statusCode, statusMessage }) }

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function ensureSelf(db: Connection, user: { id: string, name: string }) {
  await db.query(`INSERT INTO players (owner_id, name, color, is_self) VALUES ($1, $2, '#f05a28', true) ON CONFLICT DO NOTHING`, [user.id, user.name.slice(0, 24)])
  const { rows } = await db.query<PlayerIdentity>('SELECT id, name, color FROM players WHERE owner_id = $1 AND is_self', [user.id])
  return rows[0]!
}

export async function readRoom(db: Connection, roomId: string, userId: string): Promise<RoomView> {
  const { rows } = await db.query<RoomRow>('SELECT r.* FROM rooms r JOIN members m ON m.room_id = r.id WHERE r.id = $1 AND m.user_id = $2', [roomId, userId])
  const room = rows[0]
  if (!room) return fail(404, 'Room not found')
  const members = await db.query<{ userId: string, name: string, roster: PlayerIdentity[], ready: boolean }>(`SELECT m.user_id AS "userId", u.name, m.roster, m.ready FROM members m JOIN "user" u ON u.id = m.user_id WHERE room_id = $1 ORDER BY m.user_id`, [room.id])
  const match = room.match_id ? (await db.query<MatchRow>('SELECT * FROM matches WHERE id = $1', [room.match_id])).rows[0] : undefined
  const participantIds = match ? (await db.query<{ user_id: string }>('SELECT user_id FROM participants WHERE match_id = $1', [match.id])).rows.map(row => row.user_id) : []
  return {
    id: room.id, code: room.code, ownerId: room.owner_id, revision: room.revision, settings: room.settings,
    members: members.rows, match: match?.state ?? null, summary: match?.summary ?? null,
    controllers: match?.controllers ?? {}, participantIds,
    canUndo: !!match && !match.locked && match.undo.length > 0 && participantIds.includes(userId),
    locked: match?.locked ?? false
  }
}

// Callers hold the room lock and advance its revision if the roster changes.
export async function pruneRoomRosters(db: Connection, room: RoomView) {
  if (room.match?.status === 'in_progress') return false
  const profiles = await db.query<{ id: string }>('SELECT id FROM players WHERE NOT archived AND owner_id=ANY($1::text[])', [room.members.map(member => member.userId)])
  const active = new Set(profiles.rows.map(player => player.id))
  let changed = false
  for (const member of room.members) {
    const roster = member.roster.filter(player => active.has(player.id))
    if (roster.length === member.roster.length) continue
    await db.query('UPDATE members SET roster=$3 WHERE room_id=$1 AND user_id=$2', [room.id, member.userId, JSON.stringify(roster)])
    changed = true
  }
  if (changed) await db.query('UPDATE members SET ready=false WHERE room_id=$1', [room.id])
  return changed
}

export async function loadRoom(roomId: string, userId: string) {
  const result = await transaction(async db => {
    await db.query('SELECT id FROM rooms WHERE id=$1 FOR UPDATE', [roomId])
    const room = await readRoom(db, roomId, userId)
    const changed = await pruneRoomRosters(db, room)
    if (!changed) return { room, changed }
    await db.query('UPDATE rooms SET revision=revision+1 WHERE id=$1', [roomId])
    return { room: await readRoom(db, roomId, userId), changed }
  })
  if (result.changed) publishRoom(roomId)
  return result.room
}

export function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('')
}

export async function createRoom(user: { id: string, name: string }, settings: GameSettings = defaultPreferences.settings) {
  return transaction(async db => {
    const self = await ensureSelf(db, user)
    let id: string | undefined
    for (let attempt = 0; attempt < 10 && !id; attempt++) {
      id = (await db.query<{ id: string }>('INSERT INTO rooms (code, owner_id, settings) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING RETURNING id', [newCode(), user.id, JSON.stringify(settings)])).rows[0]?.id
    }
    if (!id) return fail(503, 'Unable to allocate room code')
    await db.query('INSERT INTO members (room_id,user_id,roster) VALUES ($1,$2,$3)', [id, user.id, JSON.stringify([self])])
    return readRoom(db, id, user.id)
  })
}

export async function joinRoom(code: string, user: { id: string, name: string }) {
  return transaction(async db => {
    const room = (await db.query<RoomRow>('SELECT * FROM rooms WHERE code = $1 FOR UPDATE', [code])).rows[0]
    if (!room) return fail(404, 'Room code not found')
    const self = await ensureSelf(db, user)
    const result = await db.query('INSERT INTO members (room_id,user_id,roster) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id', [room.id, user.id, JSON.stringify([self])])
    if (result.rowCount) {
      await db.query('UPDATE members SET ready = false WHERE room_id = $1', [room.id])
      await db.query('UPDATE rooms SET revision = revision + 1 WHERE id = $1', [room.id])
    }
    return readRoom(db, room.id, user.id)
  })
}

function shuffled<T>(values: T[]) {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

export async function mutateRoom(roomId: string, userId: string, requestId: string, expectedRevision: number, action: RoomAction) {
  return transaction(async db => {
    await db.query('SELECT id FROM rooms WHERE id = $1 FOR UPDATE', [roomId])
    const view = await readRoom(db, roomId, userId)
    const input = JSON.stringify({ expectedRevision, action })
    const receipt = (await db.query<{ input: string, result: RoomView }>('SELECT input,result FROM actions WHERE room_id=$1 AND user_id=$2 AND request_id=$3', [roomId, userId, requestId])).rows[0]
    if (receipt) {
      if (receipt.input !== input) return fail(409, 'Request ID already used for another action')
      return receipt.result
    }
    if (view.revision !== expectedRevision) return fail(409, 'Room changed. Refresh before trying again.')
    const owner = view.ownerId === userId
    const running = view.match?.status === 'in_progress'
    const member = view.members.find(m => m.userId === userId)!
    const ownerOnly = () => { if (!owner) fail(403, 'Only the room owner can do this') }
    const lobbyOnly = () => { if (running) fail(409, 'Wait until the current match ends') }
    const row = view.match ? (await db.query<MatchRow>('SELECT * FROM matches WHERE id=$1', [view.match.id])).rows[0]! : null

    if (action.type === 'settings') {
      ownerOnly(); lobbyOnly()
      await db.query('UPDATE rooms SET settings=$2 WHERE id=$1', [roomId, JSON.stringify(action.settings)])
      await db.query('UPDATE members SET ready=false WHERE room_id=$1', [roomId])
    } else if (action.type === 'roster') {
      lobbyOnly()
      await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [userId])
      const roster = await db.query<PlayerIdentity>('SELECT id,name,color FROM players WHERE owner_id=$1 AND NOT archived AND id=ANY($2::uuid[])', [userId, action.playerIds])
      if (roster.rows.length !== action.playerIds.length) return fail(400, 'Select only your own active players')
      await db.query('UPDATE members SET roster=$3 WHERE room_id=$1 AND user_id=$2', [roomId, userId, JSON.stringify(roster.rows)])
      await db.query('UPDATE members SET ready=false WHERE room_id=$1', [roomId])
    } else if (action.type === 'ready') {
      lobbyOnly()
      if (!member.roster.length) return fail(400, 'Select a player before marking ready')
      await db.query('UPDATE members SET ready=$3 WHERE room_id=$1 AND user_id=$2', [roomId, userId, action.ready])
    } else if (action.type === 'kick') {
      ownerOnly(); lobbyOnly()
      if (action.userId === userId) return fail(400, 'The owner cannot be removed')
      await db.query('DELETE FROM members WHERE room_id=$1 AND user_id=$2', [roomId, action.userId])
      await db.query('UPDATE members SET ready=false WHERE room_id=$1', [roomId])
    } else if (action.type === 'rotate') {
      ownerOnly(); lobbyOnly()
      for (let attempt = 0; attempt < 10; attempt++) {
        await db.query('SAVEPOINT rotate_code')
        try {
          await db.query('UPDATE rooms SET code=$2 WHERE id=$1', [roomId, newCode()])
          await db.query('RELEASE SAVEPOINT rotate_code')
          break
        } catch (error) {
          await db.query('ROLLBACK TO SAVEPOINT rotate_code')
          if ((error as { code?: string }).code !== '23505') throw error
          if (attempt === 9) return fail(503, 'Unable to allocate room code')
        }
      }
    } else if (action.type === 'start') {
      ownerOnly(); lobbyOnly()
      const selected = view.members.filter(m => m.roster.length)
      const seeds = selected.flatMap(m => m.roster)
      if (seeds.length < 2 || selected.some(m => !m.ready)) return fail(400, 'Select at least two players and have everyone mark Ready')
      if (new Set(seeds.map(p => p.id)).size !== seeds.length || new Set(seeds.map(p => p.name.toLowerCase())).size !== seeds.length) return fail(400, 'Player names must be unique')
      const users = selected.map(m => m.userId).sort()
      await db.query('SELECT id FROM "user" WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE', [users])
      const profiles = (await db.query<PlayerIdentity & { owner_id: string }>('SELECT id,name,color,owner_id FROM players WHERE id=ANY($1::uuid[]) AND NOT archived', [seeds.map(p => p.id)])).rows
      if (selected.some(m => m.roster.some(seed => !profiles.some(p => p.id === seed.id && p.owner_id === m.userId && p.name === seed.name && p.color === seed.color)))) {
        return fail(409, 'A player profile changed. Reload and save the affected roster again.')
      }
      const busy = await db.query('SELECT user_id FROM participants WHERE active AND user_id=ANY($1::text[])', [users])
      if (busy.rowCount) {
        const busyUsers = new Set(busy.rows.map(row => row.user_id))
        const names = selected.filter(member => busyUsers.has(member.userId)).map(member => member.name)
        return fail(409, `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} already playing in another room. Finish or abandon that match first.`)
      }
      const controllers = Object.fromEntries(selected.flatMap(m => m.roster.map(p => [p.id, m.userId])))
      const match = engine.createMatch(view.settings, shuffled(seeds))
      if (row) await db.query('UPDATE matches SET locked=true, undo=\'[]\'::jsonb WHERE id=$1', [row.id])
      await db.query('INSERT INTO matches (id,room_id,state,controllers) VALUES ($1,$2,$3,$4)', [match.id, roomId, JSON.stringify(match), JSON.stringify(controllers)])
      for (const id of users) await db.query('INSERT INTO participants (match_id,user_id) VALUES ($1,$2)', [match.id, id])
      await db.query('UPDATE rooms SET match_id=$2 WHERE id=$1', [roomId, match.id])
      await db.query('UPDATE members SET ready=false WHERE room_id=$1', [roomId])
    } else {
      if (!row || row.locked) return fail(409, 'Match is locked')
      if (action.type === 'abandon') {
        ownerOnly()
        if (!running) return fail(409, 'No match in progress')
        row.state.status = 'abandoned'
        row.state.finishedAt = Date.now()
        row.summary = null
        row.locked = true
        row.undo = []
      } else {
        if (!view.participantIds.includes(userId)) return fail(403, 'Only match participants can score or undo')
        if (action.type === 'undo') {
          const previous = row.undo.pop()
          if (!previous) return fail(409, 'Nothing to undo')
          if (!running) {
            // Reopening also reserves each controller against concurrent matches elsewhere.
            await db.query('SELECT id FROM "user" WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE', [view.participantIds.sort()])
            const busy = await db.query('SELECT user_id FROM participants WHERE active AND user_id=ANY($1::text[])', [view.participantIds])
            if (busy.rowCount) return fail(409, 'A participant is already playing elsewhere')
          }
          row.state = previous
          row.summary = null
          if (!running) {
            for (const id of view.participantIds) {
              const roster = row.state.players.filter(player => row.controllers[player.id] === id).map(({ id, name, color }) => ({ id, name, color }))
              await db.query('UPDATE members SET roster=$3 WHERE room_id=$1 AND user_id=$2', [roomId, id, JSON.stringify(roster)])
            }
          }
        } else if (action.type === 'dart') {
          if (!running) return fail(409, 'Match is not in progress')
          const player = row.state.players[row.state.currentPlayerIndex]!
          if (row.controllers[player.id] !== userId) return fail(403, 'Wait for your player’s turn')
          row.undo.push(structuredClone(row.state))
          row.undo = row.undo.slice(-200)
          const result = engine.recordDart(row.state, action.dart as import('../../shared/types/darts').DartInput)
          row.state = result.updated
          row.summary = result.summary ? { ...result.summary, id: row.id } : null
        }
      }
      await db.query('UPDATE matches SET state=$2,undo=$3,summary=$4,locked=$5 WHERE id=$1', [row.id, JSON.stringify(row.state), JSON.stringify(row.undo), row.summary ? JSON.stringify(row.summary) : null, row.locked])
      await db.query('UPDATE participants SET active=$2 WHERE match_id=$1', [row.id, row.state.status === 'in_progress'])
      if (!running || row.state.status !== 'in_progress') await db.query('UPDATE members SET ready=false WHERE room_id=$1', [roomId])
    }
    if (running && row?.state.status !== 'in_progress') await pruneRoomRosters(db, await readRoom(db, roomId, userId))
    await db.query('UPDATE rooms SET revision=revision+1 WHERE id=$1', [roomId])
    const result = await readRoom(db, roomId, userId)
    await db.query('INSERT INTO actions (room_id,user_id,request_id,input,result) VALUES ($1,$2,$3,$4,$5)', [roomId, userId, requestId, input, JSON.stringify(result)])
    return result
  })
}
