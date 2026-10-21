import { z } from 'zod'
import { roomActionSchema } from '../../../../shared/utils/validation'
import { mutateRoom } from '../../../utils/rooms'
import { requireUser } from '../../../utils/session'
import { publishRoom } from '../../../utils/live'
import { rateLimit } from '../../../utils/limits'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  rateLimit(`action:${user.id}`, 240)
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.uuid() }).parse)
  const body = await readValidatedBody(event, roomActionSchema.parse)
  const result = await mutateRoom(id, user.id, body.requestId, body.expectedRevision, body.action)
  publishRoom(id)
  return result
})
