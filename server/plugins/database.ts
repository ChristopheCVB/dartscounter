import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { resolve } from 'node:path'
import { getPool } from '../db/db'

export default defineNitroPlugin(async nitro => {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock(73468129)')
    await migrate(drizzle(client), { migrationsFolder: process.env.DARTSCOUNTER_MIGRATIONS_DIR || resolve('server/db/migrations') })
  } finally {
    await client.query('SELECT pg_advisory_unlock(73468129)')
    client.release()
  }
  nitro.hooks.hook('close', () => pool.end())
})
