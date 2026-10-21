import { z } from 'zod'
import { isValidSegmentMultiplier } from './scoringEngine'

export const playerSchema = z.object({
  name: z.string().trim().min(1).max(24),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
})
export const settingsSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('x01'), startScore: z.union([z.literal(301), z.literal(501)]), doubleIn: z.boolean(), doubleOut: z.boolean(), legsTarget: z.number().int().min(1).max(11) }),
  z.object({ mode: z.literal('atc'), fastForward: z.boolean() })
])
export const dartSchema = z.object({
  segment: z.union([z.literal(0), z.number().int().min(1).max(20), z.literal(25)]),
  multiplier: z.union([z.literal(1), z.literal(2), z.literal(3)])
}).refine(dart => isValidSegmentMultiplier(dart.segment as import('../types/darts').Segment, dart.multiplier), 'Invalid segment and multiplier')

export const roomActionSchema = z.object({
  requestId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('settings'), settings: settingsSchema }),
    z.object({ type: z.literal('roster'), playerIds: z.array(z.uuid()).refine(ids => new Set(ids).size === ids.length) }),
    z.object({ type: z.literal('ready'), ready: z.boolean() }),
    z.object({ type: z.literal('start') }),
    z.object({ type: z.literal('dart'), dart: dartSchema }),
    z.object({ type: z.literal('undo') }),
    z.object({ type: z.literal('abandon') }),
    z.object({ type: z.literal('rotate') }),
    z.object({ type: z.literal('kick'), userId: z.string().min(1) })
  ])
})
export type RoomAction = z.infer<typeof roomActionSchema>['action']
