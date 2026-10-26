import type { PoolClient } from 'pg'
import type { AccountData, Preferences } from '../../shared/types/rooms'
import { defaultPreferences } from '../../shared/types/rooms'
import type { MatchSummary, PlayerIdentity } from '../../shared/types/darts'
import { getPool } from '../db/db'
import { ensureSelf, expireRooms, readRoom, transaction } from './rooms'

export async function readAccount(user: { id: string, name: string }): Promise<AccountData> {
  await expireRooms()
  const db = getPool()
  const self = await ensureSelf(db, user)
  const [prefs, players, history, currentRoom] = await Promise.all([
    db.query<{ data: Preferences }>('SELECT data FROM preferences WHERE user_id=$1', [user.id]),
    db.query<PlayerIdentity>('SELECT id,name,color FROM players WHERE owner_id=$1 AND NOT archived ORDER BY is_self DESC,name,id', [user.id]),
    db.query<{ summary: MatchSummary }>(`SELECT m.summary FROM matches m JOIN participants p ON p.match_id=m.id LEFT JOIN hidden_history h ON h.match_id=m.id AND h.user_id=p.user_id WHERE p.user_id=$1 AND m.summary IS NOT NULL AND h.match_id IS NULL ORDER BY (m.summary->>'finishedAt')::bigint DESC`, [user.id]),
    transaction(async client => {
      const membership = await client.query<{ id: string }>('SELECT r.id FROM rooms r JOIN members m ON m.room_id=r.id WHERE m.user_id=$1 FOR UPDATE OF r', [user.id])
      return membership.rows[0] ? await readRoom(client, membership.rows[0].id, user.id) : null
    })
  ])
  return {
    ...structuredClone(defaultPreferences), ...prefs.rows[0]?.data, self, players: players.rows,
    history: history.rows.map(row => row.summary),
    currentRoom
  }
}

export async function ensurePlayers(db: PoolClient, userId: string, seeds: Omit<PlayerIdentity, 'id'>[]) {
  await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [userId])
  const result: PlayerIdentity[] = []
  for (const seed of seeds) {
    let player = (await db.query<PlayerIdentity>('SELECT id,name,color FROM players WHERE owner_id=$1 AND NOT archived AND lower(name)=lower($2) ORDER BY is_self DESC LIMIT 1', [userId, seed.name])).rows[0]
    if (!player) player = (await db.query<PlayerIdentity>('INSERT INTO players (owner_id,name,color) VALUES ($1,$2,$3) RETURNING id,name,color', [userId, seed.name, seed.color])).rows[0]!
    else player = (await db.query<PlayerIdentity>('UPDATE players SET name=$2,color=$3 WHERE id=$1 RETURNING id,name,color', [player.id, seed.name, seed.color])).rows[0]!
    result.push(player)
  }
  return result
}
