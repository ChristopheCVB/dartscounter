import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { resolve } from 'node:path'
import { getPool } from '../db/db'
import { expireRooms } from '../utils/rooms'
import { consola } from 'consola'

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
  await expireRooms()
  let sweeping: Promise<void> | undefined
  const timer = setInterval(() => {
    sweeping ??= expireRooms().catch(error => { consola.error('Room cleanup failed', error) }).finally(() => { sweeping = undefined })
  }, 5_000)
  nitro.hooks.hook('close', async () => {
    clearInterval(timer)
    await sweeping
    await pool.end()
  })
})
