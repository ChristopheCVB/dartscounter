import { defineEventHandler } from 'h3'
import { sendAuthEmail } from '../../../server/utils/email'

export default defineEventHandler(async () => {
  const props = { name: 'Alex <script>alert(1)</script> & friends', url: 'https://example.test/verify?token=one&callbackURL=%2Frooms' }
  return Promise.all((['email-verification', 'password-reset'] as const).map(async name => ({
    name, response: await sendAuthEmail('recipient@example.test', name, props)
  })))
})
