import { z } from 'zod'
import { readAccount } from '../utils/account'
import { requireUser } from '../utils/session'
import { aggregatePlayerStats } from '../../shared/utils/playerStats'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const { mode } = await getValidatedQuery(event, z.object({ mode: z.enum(['x01', 'atc']).default('x01') }).parse)
  const data = await readAccount(user)
  const ids = new Set(data.players.map(player => player.id))
  return aggregatePlayerStats(data.history, data.players, mode).filter(player => ids.has(player.id))
})
