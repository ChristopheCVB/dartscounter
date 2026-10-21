import { createApp, eventHandler, toWebHandler } from 'h3'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { cleanupDatabase, prepareDatabase, testPool, testUser } from '../../helpers/database'
import { createRoom } from '../../../server/utils/rooms'
import { roomStream } from '../../../server/utils/room-stream'
import { roomEvents } from '../../../server/utils/live'
import { finishRequestLog, startRequestLog } from '../../../server/utils/request-logging'
import { requireUser } from '../../../server/utils/session'
import { getPool } from '../../../server/db/db'

const info = vi.hoisted(() => vi.fn())
vi.mock('consola', () => ({ consola: { withTag: () => ({ info }) } }))
beforeAll(prepareDatabase)
afterAll(async () => { await cleanupDatabase(); await getPool().end() })

it('logs and cleans up SSE on web-reader cancellation without reporting an early closure', async () => {
  const user = await testUser('Stream player')
  const room = await createRoom(user)
  const app = createApp({ onRequest: startRequestLog, onAfterResponse: event => finishRequestLog(event) })
  app.use(eventHandler(async event => {
    const sessionUser = await requireUser(event)
    return roomStream(event, room.id, sessionUser.id)
  }))
  const handler = toWebHandler(app)
  const response = await handler(new Request(`http://127.0.0.1:4317/api/rooms/${room.id}/events?token=hidden`, { headers: { Cookie: `${user.cookie.name}=${user.cookie.value}` } }))
  expect(response.headers.get('content-type')).toBe('text/event-stream')
  const reader = response.body!.getReader()
  try {
    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toContain('event: update')
    expect(roomEvents.listenerCount(room.id)).toBe(1)
    expect(info).toHaveBeenCalledTimes(1)
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(info.mock.calls[0]![0]).toContain('-> opening')
    await reader.cancel()
    expect(roomEvents.listenerCount(room.id)).toBe(0)
    expect(info).toHaveBeenCalledTimes(2)
    expect(info.mock.calls[1]![0]).toMatch(/closed after \d+ms/)
    expect(JSON.stringify(info.mock.calls)).not.toContain('hidden')
  } finally { await reader.cancel() }
  await testPool.query('DELETE FROM session WHERE user_id=$1', [user.id])
  const rejected = await handler(new Request(`http://127.0.0.1:4317/api/rooms/${room.id}/events`, { headers: { Cookie: `${user.cookie.name}=${user.cookie.value}` } }))
  expect(rejected.status).toBe(401)
  expect(info.mock.calls.filter(call => String(call[0]).includes('opening'))).toHaveLength(1)
})
