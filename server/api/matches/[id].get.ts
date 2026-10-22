import { z } from 'zod'
import { getPool } from '../../db/db'
import { requireUser } from '../../utils/session'
import { loadRoom } from '../../utils/rooms'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.uuid() }).parse)
  const row = (await getPool().query<{ room_id: string }>('SELECT m.room_id FROM matches m JOIN members r ON r.room_id=m.room_id WHERE m.id=$1 AND r.user_id=$2', [id, user.id])).rows[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Match not found' })
  return loadRoom(row.room_id, user.id)
})
