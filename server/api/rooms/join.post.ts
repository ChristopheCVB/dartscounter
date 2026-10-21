import { z } from 'zod'
import { joinRoom } from '../../utils/rooms'
import { requireUser } from '../../utils/session'
import { rateLimit } from '../../utils/limits'
import { publishRoom } from '../../utils/live'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  rateLimit(`join:${user.id}`, 10)
  const { code } = await readValidatedBody(event, z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{8}$/) }).parse)
  const room = await joinRoom(code, user)
  publishRoom(room.id)
  return room
})
