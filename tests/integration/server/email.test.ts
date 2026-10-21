import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderEmail, sendAuthEmail } from '../../../server/utils/email'

const { send, render } = vi.hoisted(() => ({ send: vi.fn(), render: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send } } }))
const props = { name: 'Alex', url: 'https://darts.example/verify?token=one&callbackURL=%2Frooms' }
const content = { subject: 'Verify your DartsCounter email', html: '<p>Verify</p>', text: 'Verify' }

beforeEach(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({ resend: { apiKey: 're_test', from: 'DartsCounter <hello@example.test>' } }))
  vi.stubGlobal('renderEmailComponent', render)
  render.mockReset().mockResolvedValueOnce({ subject: content.subject, html: content.html }).mockResolvedValueOnce({ subject: content.subject, html: content.text })
  send.mockReset().mockResolvedValue({ data: { id: 'email-1' }, error: null })
})

describe('local email rendering and delivery', () => {
  it('renders HTML and plain text with the template subject', async () => {
    expect(await renderEmail('email-verification', props)).toEqual(content)
    expect(render.mock.calls).toEqual([['email-verification', props], ['email-verification', props, { plainText: true }]])
  })

  it('supports a plain-text string from the renderer', async () => {
    render.mockReset().mockResolvedValueOnce({ subject: content.subject, html: content.html }).mockResolvedValueOnce(content.text)
    expect(await renderEmail('email-verification', props)).toEqual(content)
  })

  it.each(['<p>No subject</p>', { subject: '', html: '<p>No subject</p>' }])('does not deliver an email without a subject: %s', async result => {
    render.mockReset().mockResolvedValue(result)
    await expect(sendAuthEmail('alex@example.test', 'email-verification', props)).rejects.toThrow('missing its subject')
    expect(send).not.toHaveBeenCalled()
  })

  it('sends the rendered subject, HTML, and plain text through Resend', async () => {
    expect(await sendAuthEmail('alex@example.test', 'email-verification', props)).toEqual({ data: { id: 'email-1' }, error: null })
    expect(send).toHaveBeenCalledWith({ from: 'DartsCounter <hello@example.test>', to: 'alex@example.test', ...content })
  })

  it.each(['apiKey', 'from'])('fails before rendering when %s is missing', async missing => {
    vi.stubGlobal('useRuntimeConfig', () => ({ resend: { apiKey: 're_test', from: 'hello@example.test', [missing]: '' } }))
    await expect(sendAuthEmail('alex@example.test', 'email-verification', props)).rejects.toThrow('NUXT_RESEND')
    expect(render).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('does not send if rendering fails', async () => {
    render.mockReset().mockRejectedValue(new Error('render failed'))
    await expect(sendAuthEmail('alex@example.test', 'password-reset', props)).rejects.toThrow('render failed')
    expect(send).not.toHaveBeenCalled()
  })

  it('preserves delivery failure handling', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'delivery refused' } })
    await expect(sendAuthEmail('alex@example.test', 'email-verification', props)).rejects.toThrow('Unable to deliver authentication email')
  })

  it('propagates delivery network errors', async () => {
    send.mockRejectedValue(new Error('network failed'))
    await expect(sendAuthEmail('alex@example.test', 'email-verification', props)).rejects.toThrow('network failed')
  })
})
