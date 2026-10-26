import { z } from 'zod'
import { settingsSchema } from '../../shared/utils/validation'
import { getPool } from '../db/db'
import { requireUser } from '../utils/session'
import type { Preferences } from '../../shared/types/rooms'
import { defaultPreferences } from '../../shared/types/rooms'

const schema = z.object({ settings: settingsSchema.options[0], atcSettings: settingsSchema.options[1], cricketSettings: settingsSchema.options[2].optional(), soundEnabled: z.boolean() })
export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const data = await readValidatedBody(event, schema.parse)
  const result = await getPool().query<{ data: Preferences }>(`INSERT INTO preferences (user_id,data) VALUES ($1,$2::jsonb || $3::jsonb)
    ON CONFLICT (user_id) DO UPDATE SET data=$2::jsonb || preferences.data || $3::jsonb RETURNING data`, [user.id, JSON.stringify(defaultPreferences), JSON.stringify(data)])
  return result.rows[0]!.data
})
