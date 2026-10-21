import { describe, expect, it } from 'vitest'
import type { X01Settings } from '../../../../shared/types/darts'
import { getDartRecommendation } from '../../../../shared/utils/dartRecommendation'

const settings: X01Settings = { mode: 'x01', startScore: 501, doubleIn: false, doubleOut: true, legsTarget: 1 }
const player = { score: 100, hasOpened: true }

describe('dart recommendations', () => {
  it('uses the available darts and each player’s own score', () => {
    expect(getDartRecommendation(player, settings, 1)).toContain('Setup: leave a double')
    expect(getDartRecommendation(player, settings, 3)).toBe('Finish: T20 • D20')
    expect(getDartRecommendation({ ...player, score: 32 }, settings, 3)).toBe('Finish: D16')
    expect(getDartRecommendation({ ...player, score: 170 }, settings, 3)).toBe('Finish: T20 • T20 • DB')
  })

  it('requires an opener only for players who have not opened', () => {
    const doubleIn = { ...settings, doubleIn: true }
    expect(getDartRecommendation({ ...player, hasOpened: false }, doubleIn, 3)).toContain('Open: any double')
    expect(getDartRecommendation(player, doubleIn, 3)).toBe('Finish: T20 • D20')
  })

  it('respects straight out and double out', () => {
    expect(getDartRecommendation({ ...player, score: 60 }, settings, 1)).toContain('Setup: leave a double')
    expect(getDartRecommendation({ ...player, score: 60 }, { ...settings, doubleOut: false }, 1)).toBe('Finish: T20')
    expect(getDartRecommendation({ ...player, score: 501 }, { ...settings, doubleOut: false }, 3)).toContain('high trebles')
  })

  it.each([169, 168, 166, 165, 163, 162, 159])('gives setup advice for bogey score %i', score => {
    expect(getDartRecommendation({ ...player, score }, settings, 3)).toContain('Setup: leave D20 / D16')
  })

  it('handles high scores and completed turns', () => {
    expect(getDartRecommendation({ ...player, score: 501 }, settings, 3)).toContain('Setup: leave D20 / D16 / D12')
    expect(getDartRecommendation(player, settings, 0)).toContain('Turn: complete')
  })

  it('uses Around the Clock targets and Fast Forward rules', () => {
    expect(getDartRecommendation(player, { mode: 'atc', fastForward: false }, 3)).toBe('Aim: 1')
    expect(getDartRecommendation({ ...player, atcTarget: 7 }, { mode: 'atc', fastForward: true }, 3)).toBe('Aim: 7 · double +2 / treble +3')
    expect(getDartRecommendation({ ...player, atcTarget: 21 }, { mode: 'atc', fastForward: false }, 1)).toBe('Finish: Bull')
    expect(getDartRecommendation({ ...player, atcTarget: 22 }, { mode: 'atc', fastForward: false }, 1)).toBe('Targets: cleared')
  })
})
