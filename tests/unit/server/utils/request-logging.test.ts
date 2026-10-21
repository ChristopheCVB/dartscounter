import { createApp, eventHandler, toWebHandler } from 'h3'
import { describe, expect, it, vi } from 'vitest'
import { finishRequestLog, openSseLog, startRequestLog } from '../../../../server/utils/request-logging'

const info = vi.hoisted(() => vi.fn())
vi.mock('consola', () => ({ consola: { withTag: () => ({ info }) } }))

describe('request logging', () => {
  it('logs status and duration once, and excludes query strings and reset tokens', async () => {
    info.mockClear()
    const app = createApp()
    app.use(eventHandler(event => {
      startRequestLog(event)
      event.node.res.statusCode = 403
      finishRequestLog(event)
      finishRequestLog(event)
      return 'done'
    }))
    await toWebHandler(app)(new Request('http://localhost/api/auth/reset-password/secret-token?token=secret-query'))
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0]![0]).toMatch(/^GET 403 \/api\/auth\/reset-password\/\[redacted\] -> \d+ms$/)
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret')
  })

  it('logs SSE closure only when the stream closes, once, with its full duration', async () => {
    info.mockClear()
    const app = createApp()
    app.use(eventHandler(async event => {
      startRequestLog(event)
      openSseLog(event)
      finishRequestLog(event)
      expect(info).toHaveBeenCalledTimes(1)
      await new Promise(resolve => setTimeout(resolve, 25))
      finishRequestLog(event, true)
      finishRequestLog(event, true)
      return 'done'
    }))
    await toWebHandler(app)(new Request('http://localhost/api/rooms/example/events'))
    expect(info).toHaveBeenCalledTimes(2)
    expect(info.mock.calls[0]![0]).toBe('SSE GET /api/rooms/example/events -> opening')
    const closing = String(info.mock.calls[1]![0])
    expect(closing).toMatch(/SSE GET .* -> closed after \d+ms/)
    expect(Number(closing.match(/(\d+)ms/)![1])).toBeGreaterThanOrEqual(20)
  })

  it('skips static assets even when a cache query is present', async () => {
    info.mockClear()
    const app = createApp()
    app.use(eventHandler(event => { startRequestLog(event); finishRequestLog(event); return '' }))
    await toWebHandler(app)(new Request('http://localhost/_nuxt/app.js?v=1'))
    expect(info).not.toHaveBeenCalled()
  })
})
