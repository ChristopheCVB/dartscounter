import type { H3Event } from 'h3'
import { getPool } from '../db/db'
import { requireUser } from './session'
import { readRoom } from './rooms'
import { roomEvents } from './live'
import { finishRequestLog, openSseLog } from './request-logging'

export function roomStream(event: H3Event, roomId: string, userId: string) {
  const encoder = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let refreshing = false
      let changed = false
      const send = (type: string, data: string) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${type}\ndata: ${data}\n\n`))
      }
      const update = async () => {
        if (closed) return
        if (refreshing) { changed = true; return }
        refreshing = true
        try {
          await requireUser(event)
          const room = await readRoom(getPool(), roomId, userId)
          send('update', String(room.revision))
        } catch {
          send('revoked', '')
          cleanup()
        } finally {
          refreshing = false
          if (changed && !closed) { changed = false; void update() }
        }
      }
      const timer = setInterval(() => void update(), 5_000)
      cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(timer)
        roomEvents.off(roomId, update)
        event.node.res.off('close', cleanup)
        finishRequestLog(event, true)
        try { controller.close() } catch { /* The reader may already have cancelled. */ }
      }
      // Node exposes a socket; Bun cancels the returned web stream directly.
      if (event.node.res.socket) event.node.res.once('close', cleanup)
      roomEvents.on(roomId, update)
      openSseLog(event)
      void update()
    },
    cancel() { cleanup() }
  })
  return new Response(stream, { headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'private, no-store',
    'X-Accel-Buffering': 'no'
  } })
}
