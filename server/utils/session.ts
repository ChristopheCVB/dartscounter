import { createError, setHeader } from 'h3'
import type { H3Event } from 'h3'
import { getAuth } from '../lib/auth'

export async function requireUser(event: H3Event) {
  if (!event.node.res.headersSent) setHeader(event, 'Cache-Control', 'private, no-store')
  if (!['GET', 'HEAD'].includes(event.method)) {
    const origin = event.headers.get('origin')
    if (!origin || origin !== new URL(process.env.BETTER_AUTH_URL!).origin) {
      throw createError({ statusCode: 403, statusMessage: 'Invalid request origin' })
    }
  }
  const session = await getAuth().api.getSession({ headers: event.headers })
  if (!session?.user.emailVerified) throw createError({ statusCode: 401, statusMessage: 'Sign in with a verified account' })
  return session.user
}
