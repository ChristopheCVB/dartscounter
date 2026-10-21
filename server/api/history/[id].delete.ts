import { z } from 'zod'
import { getPool } from '../../db/db'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.uuid() }).parse)
  await getPool().query('INSERT INTO hidden_history (match_id,user_id) SELECT match_id,user_id FROM participants WHERE match_id=$1 AND user_id=$2 ON CONFLICT DO NOTHING', [id, user.id])
  return { ok: true }
})
