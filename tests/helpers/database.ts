import { createHmac } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/dartscounter_test'
if (!new URL(connectionString).pathname.endsWith('_test')) throw new Error('Tests require a dedicated database whose name ends in _test')

export const testEnvironment = {
  NUXT_DATABASE_URL: connectionString,
  BETTER_AUTH_SECRET: 'dartscounter-test-secret-at-least-32-characters',
  BETTER_AUTH_URL: 'http://127.0.0.1:4317',
  NUXT_TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  NUXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA'
}
export const testPool = new Pool({ connectionString })
const users: string[] = []

export async function prepareDatabase() {
  Object.assign(process.env, testEnvironment)
  const client = await testPool.connect()
  try {
    await client.query('SELECT pg_advisory_lock(73468129)')
    await migrate(drizzle(client), { migrationsFolder: 'server/db/migrations' })
  } finally {
    await client.query('SELECT pg_advisory_unlock(73468129)')
    client.release()
  }
}

export function trackTestUser(id: string) { users.push(id) }

export async function testUser(name: string) {
  const user = { id: crypto.randomUUID(), name, email: `${crypto.randomUUID()}@example.test` }
  await testPool.query('INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$2,$3,true)', [user.id, user.name, user.email])
  users.push(user.id)
  const token = crypto.randomUUID()
  await testPool.query('INSERT INTO session (id,user_id,token,expires_at) VALUES ($1,$2,$3,$4)', [crypto.randomUUID(), user.id, token, new Date(Date.now() + 86_400_000)])
  const signature = createHmac('sha256', testEnvironment.BETTER_AUTH_SECRET).update(token).digest('base64')
  return { ...user, cookie: { name: 'better-auth.session_token', value: encodeURIComponent(`${token}.${signature}`), url: testEnvironment.BETTER_AUTH_URL, httpOnly: true, sameSite: 'Lax' as const } }
}

export async function cleanupDatabase() {
  await testPool.query('DELETE FROM hidden_history WHERE user_id=ANY($1::text[])', [users])
  await testPool.query('DELETE FROM participants WHERE user_id=ANY($1::text[])', [users])
  await testPool.query('DELETE FROM matches WHERE room_id IN (SELECT id FROM rooms WHERE owner_id=ANY($1::text[]))', [users])
  await testPool.query('DELETE FROM actions WHERE user_id=ANY($1::text[])', [users])
  await testPool.query('DELETE FROM rooms WHERE owner_id=ANY($1::text[])', [users])
  await testPool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users])
  await testPool.end()
}
