import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanupDatabase, prepareDatabase, testEnvironment, testPool, trackTestUser } from '../../helpers/database'
import { getAuth } from '../../../server/lib/auth'
import { getPool } from '../../../server/db/db'
import type { EmailProps } from '../../../shared/types/email'

const emails = vi.hoisted(() => [] as { to: string, template: keyof EmailProps, props: { name: string, url: string } }[])
vi.mock('../../../server/utils/email', () => ({ sendAuthEmail: async (to: string, template: keyof EmailProps, props: { name: string, url: string }) => { emails.push({ to, template, props }) } }))
beforeAll(prepareDatabase)
afterAll(async () => { await cleanupDatabase(); await getPool().end() })

describe('separate verified Dartscounter accounts', () => {
  it('verifies email, signs in, resets a password, and rejects the old password', async () => {
    const email = `${crypto.randomUUID()}@example.test`
    const auth = getAuth()
    const signup = await auth.api.signUpEmail({ body: { name: 'New player', email, password: 'original-password-123', callbackURL: '/rooms' } })
    trackTestUser(signup.user.id)
    expect(signup.user.emailVerified).toBe(false)
    await expect(auth.api.signInEmail({ body: { email, password: 'original-password-123' } })).rejects.toMatchObject({ statusCode: 403 })
    expect(emails.at(-1)).toMatchObject({ to: email, template: 'email-verification', props: { name: 'New player' } })
    const token = new URL(emails.at(-1)!.props.url).searchParams.get('token')!
    await auth.api.verifyEmail({ query: { token } })
    const login = await auth.api.signInEmail({ body: { email, password: 'original-password-123' } })
    expect(login.user.emailVerified).toBe(true)
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } })
    expect(emails.at(-1)).toMatchObject({ to: email, template: 'password-reset', props: { name: 'New player' } })
    const resetUrl = new URL(emails.at(-1)!.props.url)
    const resetToken = resetUrl.pathname.split('/').at(-1)!
    await auth.api.resetPassword({ body: { token: resetToken, newPassword: 'replacement-password-456' } })
    await expect(auth.api.signInEmail({ body: { email, password: 'original-password-123' } })).rejects.toMatchObject({ statusCode: 401 })
    expect((await auth.api.signInEmail({ body: { email, password: 'replacement-password-456' } })).user.id).toBe(signup.user.id)
    await expect(auth.api.resetPassword({ body: { token: resetToken, newPassword: 'another-password-789' } })).rejects.toBeDefined()
    expect((await testPool.query('SELECT count(*) FROM "user" WHERE email=$1', [email])).rows[0].count).toBe('1')
  })

  it('protects HTTP sign-in with Turnstile', async () => {
    const response = await getAuth().handler(new Request(`${testEnvironment.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: testEnvironment.BETTER_AUTH_URL },
      body: JSON.stringify({ email: 'someone@example.test', password: 'test-password-123' })
    }))
    expect(response.status).toBe(400)
    expect((await response.text()).toLowerCase()).toContain('captcha')
  })
})
