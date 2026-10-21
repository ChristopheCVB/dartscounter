import { Resend } from 'resend'
import type { EmailProps } from '../../shared/types/email'

export async function renderEmail<Name extends keyof EmailProps>(name: Name, props: EmailProps[NoInfer<Name>]) {
  const htmlResult = await renderEmailComponent(name, props)
  const textResult = await renderEmailComponent(name, props, { plainText: true })
  const subject = typeof htmlResult === 'string' ? undefined : htmlResult.subject
  if (!subject) throw new Error(`Email template "${name}" is missing its subject`)
  return {
    subject,
    html: typeof htmlResult === 'string' ? htmlResult : htmlResult.html,
    text: typeof textResult === 'string' ? textResult : textResult.html
  }
}

export async function sendAuthEmail<Name extends keyof EmailProps>(to: string, name: Name, props: EmailProps[NoInfer<Name>]) {
  const { apiKey, from } = useRuntimeConfig().resend
  if (!from || !apiKey) throw new Error('NUXT_RESEND_API_KEY and NUXT_RESEND_FROM are required')
  const content = await renderEmail(name, props)
  const response = await new Resend(apiKey).emails.send({ from, to, ...content })
  if (response.error) throw new Error('Unable to deliver authentication email')
  return response
}
