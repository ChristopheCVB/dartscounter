import { z } from 'zod'
import { settingsSchema } from '../../../shared/utils/validation'
import { createRoom } from '../../utils/rooms'
import { requireUser } from '../../utils/session'
import { rateLimit } from '../../utils/limits'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  rateLimit(`create:${user.id}`, 10)
  const body = await readValidatedBody(event, z.object({ settings: settingsSchema.optional() }).parse)
  return createRoom(user, body.settings)
})
