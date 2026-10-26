import type { CricketMarks, CricketTarget, DartInput } from '../types/darts'
import { isValidSegmentMultiplier } from './scoringEngine'

export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const

export function createCricketMarks(): CricketMarks {
  return { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, 25: 0 }
}

export function applyCricketDart(marks: CricketMarks, opponents: CricketMarks[], input: DartInput) {
  const nextMarks = { ...marks }
  if (!CRICKET_TARGETS.includes(input.segment as CricketTarget) || !isValidSegmentMultiplier(input.segment, input.multiplier)) {
    return { nextMarks, scoredPoints: 0, scoredMarks: 0 }
  }

  const target = input.segment as CricketTarget
  const closingMarks = Math.min(3 - marks[target], input.multiplier)
  const scoringMarks = opponents.some(opponent => opponent[target] < 3) ? input.multiplier - closingMarks : 0
  nextMarks[target] = (marks[target] + closingMarks) as CricketMarks[CricketTarget]
  return { nextMarks, scoredPoints: scoringMarks * target, scoredMarks: closingMarks + scoringMarks }
}
