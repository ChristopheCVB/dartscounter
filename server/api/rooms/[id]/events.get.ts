import { z } from 'zod'
import { requireUser } from '../../../utils/session'
import { loadRoom } from '../../../utils/rooms'
import { roomStream } from '../../../utils/room-stream'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.uuid() }).parse)
  await loadRoom(id, user.id)
  return roomStream(event, id, user.id)
})
