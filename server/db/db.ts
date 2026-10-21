import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

let pool: Pool | undefined
export function getPool() {
  if (!pool) {
    const connectionString = process.env.NUXT_DATABASE_URL
    if (!connectionString) throw new Error('NUXT_DATABASE_URL is required')
    pool = new Pool({ connectionString, max: 10 })
  }
  return pool
}
export function getDb() {
  return drizzle(getPool())
}
