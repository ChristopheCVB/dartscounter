import { z } from 'zod'
import { playerSchema } from '../../shared/utils/validation'
import { requireUser } from '../utils/session'
import { transaction } from '../utils/rooms'
import { ensurePlayers } from '../utils/account'
import type { PlayerIdentity } from '../../shared/types/darts'

const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ensure'), players: z.array(playerSchema).min(1) }),
  z.object({ type: z.literal('update'), id: z.uuid(), name: playerSchema.shape.name.optional(), color: playerSchema.shape.color.optional() }),
  z.object({ type: z.literal('remove'), id: z.uuid() }),
  z.object({ type: z.literal('clear') })
])
export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, schema.parse)
  return transaction(async db => {
    await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [user.id])
    let selected: PlayerIdentity[] = []
    if (body.type === 'ensure') selected = await ensurePlayers(db, user.id, body.players)
    if (body.type === 'update') {
      const duplicate = body.name ? await db.query('SELECT id FROM players WHERE owner_id=$1 AND id<>$2 AND NOT archived AND lower(name)=lower($3)', [user.id, body.id, body.name]) : null
      if (duplicate?.rowCount) throw createError({ statusCode: 400, statusMessage: 'Player name already exists' })
      const result = await db.query('UPDATE players SET name=COALESCE($3,name),color=COALESCE($4,color) WHERE owner_id=$1 AND id=$2 AND NOT archived', [user.id, body.id, body.name ?? null, body.color ?? null])
      if (!result.rowCount) throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    }
    if (body.type === 'remove') await db.query('UPDATE players SET archived=true WHERE owner_id=$1 AND id=$2 AND NOT is_self', [user.id, body.id])
    if (body.type === 'clear') await db.query('UPDATE players SET archived=true WHERE owner_id=$1 AND NOT is_self', [user.id])
    const players = (await db.query<PlayerIdentity>('SELECT id,name,color FROM players WHERE owner_id=$1 AND NOT archived ORDER BY is_self DESC,name,id', [user.id])).rows
    return { players, selected }
  })
})
