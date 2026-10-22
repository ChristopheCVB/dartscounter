import { z } from 'zod'
import { requireUser } from '../../../utils/session'
import { leaveRoom } from '../../../utils/rooms'
import { rateLimit } from '../../../utils/limits'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  rateLimit(`leave:${user.id}`, 30)
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.uuid() }).parse)
  const { expectedRevision } = await readValidatedBody(event, z.object({ expectedRevision: z.number().int().nonnegative() }).parse)
  return leaveRoom(id, user.id, expectedRevision)
})
