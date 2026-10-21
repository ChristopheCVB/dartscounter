import { createError } from 'h3'

const windows = new Map<string, { count: number, until: number }>()
export function rateLimit(key: string, limit: number, durationMs = 60_000) {
  const now = Date.now()
  for (const [id, window] of windows) if (window.until <= now) windows.delete(id)
  const window = windows.get(key) ?? { count: 0, until: now + durationMs }
  if (++window.count > limit) throw createError({ statusCode: 429, statusMessage: 'Too many requests. Try again shortly.' })
  windows.set(key, window)
}
