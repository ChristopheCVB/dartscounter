import { getPool } from '../db/db'

export default defineEventHandler(async () => {
  await getPool().query('SELECT 1')
  return { ok: true }
})
