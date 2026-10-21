import { z } from 'zod'
import { settingsSchema } from '../../shared/utils/validation'
import { getPool } from '../db/db'
import { requireUser } from '../utils/session'

const schema = z.object({ settings: settingsSchema.options[0], atcSettings: settingsSchema.options[1], soundEnabled: z.boolean() })
export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const data = await readValidatedBody(event, schema.parse)
  await getPool().query('INSERT INTO preferences (user_id,data) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET data=EXCLUDED.data', [user.id, JSON.stringify(data)])
  return data
})
