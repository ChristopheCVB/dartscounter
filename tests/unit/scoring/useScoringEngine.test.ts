import { describe, expect, it } from 'vitest'
import { applyDart, getThrowPoints, parsePointsToDart } from '../../../app/composables/useScoringEngine'
import type { X01Settings } from '../../../shared/types/darts'

const settings: X01Settings = {
  startScore: 501,
  doubleIn: false,
  doubleOut: true,
  legsTarget: 1
}

describe('useScoringEngine', () => {
  it('calculates throw points for board segments', () => {
    expect(getThrowPoints(20, 3)).toBe(60)
    expect(getThrowPoints(25, 1)).toBe(25)
    expect(getThrowPoints(25, 2)).toBe(50)
  })

  it('applies a normal throw', () => {
    const result = applyDart(101, true, { segment: 20, multiplier: 1 }, settings, 101, true)
    expect(result.nextScore).toBe(81)
    expect(result.isBust).toBe(false)
    expect(result.isCheckout).toBe(false)
  })

  it('marks bust on overshoot', () => {
    const result = applyDart(40, true, { segment: 20, multiplier: 3 }, settings, 40, true)
    expect(result.isBust).toBe(true)
    expect(result.nextScore).toBe(40)
    expect(result.scoredPoints).toBe(0)
  })

  it('marks bust on score 1 with double out', () => {
    const result = applyDart(21, true, { segment: 20, multiplier: 1 }, settings, 21, true)
    expect(result.isBust).toBe(true)
    expect(result.nextScore).toBe(21)
  })

  it('rejects invalid checkout when not finishing on a double', () => {
    const result = applyDart(20, true, { segment: 20, multiplier: 1 }, settings, 20, true)
    expect(result.isBust).toBe(true)
    expect(result.isCheckout).toBe(false)
  })

  it('accepts checkout on a double', () => {
    const result = applyDart(40, true, { segment: 20, multiplier: 2 }, settings, 40, true)
    expect(result.isBust).toBe(false)
    expect(result.isCheckout).toBe(true)
    expect(result.nextScore).toBe(0)
  })

  it('ignores non-double throws before opening when double-in is enabled', () => {
    const doubleInSettings: X01Settings = {
      ...settings,
      doubleIn: true
    }

    const result = applyDart(501, false, { segment: 20, multiplier: 1 }, doubleInSettings, 501, false)
    expect(result.nextScore).toBe(501)
    expect(result.nextOpened).toBe(false)
    expect(result.scoredPoints).toBe(0)
  })

  it('parses numeric points into valid dart inputs', () => {
    expect(parsePointsToDart(60)).toEqual({ segment: 20, multiplier: 3 })
    expect(parsePointsToDart(40, true)).toEqual({ segment: 20, multiplier: 2 })
    expect(parsePointsToDart(22)).toEqual({ segment: 11, multiplier: 2 })
    expect(parsePointsToDart(25)).toEqual({ segment: 25, multiplier: 1 })
    expect(parsePointsToDart(50)).toEqual({ segment: 25, multiplier: 2 })
    expect(parsePointsToDart(59)).toBeNull()
  })
})
