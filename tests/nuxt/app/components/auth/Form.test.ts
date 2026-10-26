import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Form from '~/components/auth/Form.vue'

const auth = vi.hoisted(() => ({
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  sendVerificationEmail: vi.fn()
}))
const route = { query: { next: '/join?code=ABCDEFGH', token: 'reset-token' } }
mockNuxtImport('useAuth', () => () => auth)
mockNuxtImport('useRoute', () => () => route)
let wrapper: VueWrapper
beforeEach(() => {
  vi.clearAllMocks()
  for (const method of [auth.signIn.email, auth.signUp.email, auth.requestPasswordReset, auth.resetPassword, auth.sendVerificationEmail]) method.mockResolvedValue({ error: null })
})
afterEach(() => wrapper?.unmount())

describe('invitation authentication', () => {
  it.each(['signin', 'signup', 'verify'] as const)('retains the invitation in %s callbacks and account links', async mode => {
    wrapper = await mountSuspended(Form, { props: { mode } })
    for (const link of wrapper.findAll('a')) expect(new URL(link.attributes('href')!, 'https://example.test').searchParams.get('next')).toBe(route.query.next)
    await wrapper.get('form').trigger('submit')
    const method = mode === 'signin' ? auth.signIn.email : mode === 'signup' ? auth.signUp.email : auth.sendVerificationEmail
    await expect.poll(() => method.mock.calls.length).toBe(1)
    expect(method).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: route.query.next }))
  })

  it('retains the invitation through password reset and the return to sign-in', async () => {
    wrapper = await mountSuspended(Form, { props: { mode: 'forgot' } })
    await wrapper.get('form').trigger('submit')
    expect(auth.requestPasswordReset).toHaveBeenCalledWith(expect.objectContaining({ redirectTo: '/reset-password?next=%2Fjoin%3Fcode%3DABCDEFGH' }))
    await wrapper.setProps({ mode: 'reset' })
    await wrapper.get('form').trigger('submit')
    expect(auth.resetPassword).toHaveBeenCalledWith(expect.objectContaining({ token: 'reset-token' }))
    const back = wrapper.findAll('a').find(link => link.text() === 'Back to sign in')!
    expect(back.attributes('href')).toBe('/signin?next=%2Fjoin%3Fcode%3DABCDEFGH')
  })
})
