import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { captcha } from 'better-auth/plugins'
import { getDb } from '../db/db'
import * as schema from '../db/schema/auth'
import { sendAuthEmail } from '../utils/email'

function createAuth() {
    if (!process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL || !process.env.NUXT_TURNSTILE_SECRET_KEY) {
      throw new Error('Better Auth URL, secret, and Turnstile secret are required')
    }
    return betterAuth({
      database: drizzleAdapter(getDb(), { provider: 'pg', schema }),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        resetPasswordTokenExpiresIn: 3600,
        async sendResetPassword({ user, url }) {
          await sendAuthEmail(user.email, 'password-reset', { name: user.name, url })
        }
      },
      emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        async sendVerificationEmail({ user, url }) {
          await sendAuthEmail(user.email, 'email-verification', { name: user.name, url })
        }
      },
      plugins: [captcha({ provider: 'cloudflare-turnstile', secretKey: process.env.NUXT_TURNSTILE_SECRET_KEY })],
      advanced: { database: { generateId: () => crypto.randomUUID() } }
    })
}

let instance: ReturnType<typeof createAuth> | undefined
export function getAuth() { return instance ??= createAuth() }
