import type { H3Event } from 'h3'
import { createLogger } from './logger'

interface RequestLoggerContext {
  startTime: bigint
  path: string
  sse: boolean
  finished: boolean
}

function requestPath(event: H3Event) {
  return event.path.split('?')[0]!.replace(/(\/api\/auth\/reset-password\/)[^/]+/, '$1[redacted]')
}

export function startRequestLog(event: H3Event) {
  const path = requestPath(event)
  if (path.startsWith('/_nuxt/') || path.startsWith('/assets/') || path.startsWith('/api/_nuxt_icon/') || path.startsWith('/favicon') || path.startsWith('/logo')) return
  if (/\.(?:css|js|mjs|cjs|map|png|jpe?g|gif|webp|svg|ico|txt|json|woff2?|ttf|eot)$/.test(path)) return
  event.context.requestLogger = { startTime: process.hrtime.bigint(), path, sse: false, finished: false } satisfies RequestLoggerContext
}

export function openSseLog(event: H3Event) {
  const context = event.context.requestLogger as RequestLoggerContext | undefined
  if (!context || context.sse) return
  context.sse = true
  createLogger('plugins:request-logger').info(`SSE ${event.method} ${context.path} -> opening`)
}

export function finishRequestLog(event: H3Event, streamClosed = false) {
  const context = event.context.requestLogger as RequestLoggerContext | undefined
  if (!context || context.finished || (context.sse && !streamClosed)) return
  context.finished = true
  const duration = Math.round(Number(process.hrtime.bigint() - context.startTime) / 1_000_000)
  const logger = createLogger('plugins:request-logger')
  if (context.sse) logger.info(`SSE ${event.method} ${context.path} -> closed after ${duration}ms`)
  else logger.info(`${event.method} ${event.node.res.statusCode} ${context.path} -> ${duration}ms`)
}
