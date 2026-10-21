import { z } from 'zod'
import { getPool } from '../../db/db'
import { readRoom } from '../../utils/rooms'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.uuid() }).parse)
  return readRoom(getPool(), id, user.id)
})
