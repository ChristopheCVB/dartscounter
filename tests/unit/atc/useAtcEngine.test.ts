import { describe, expect, it } from 'vitest'
import { applyAtcDart, formatAtcTarget, getAtcTargetSegment } from '../../../app/composables/useAtcEngine'
import type { AtcSettings } from '../../../shared/types/darts'

const standard: AtcSettings = { mode: 'atc', fastForward: false }
const fast: AtcSettings = { mode: 'atc', fastForward: true }

describe('getAtcTargetSegment', () => {
  it('maps targets 1–20 to their segment', () => {
    expect(getAtcTargetSegment(1)).toBe(1)
    expect(getAtcTargetSegment(10)).toBe(10)
    expect(getAtcTargetSegment(20)).toBe(20)
  })

  it('maps target 21 to segment 25 (Bull)', () => {
    expect(getAtcTargetSegment(21)).toBe(25)
    expect(getAtcTargetSegment(22)).toBe(25)
  })
})

describe('formatAtcTarget', () => {
  it('returns number string for targets 1–20', () => {
    expect(formatAtcTarget(1)).toBe('1')
    expect(formatAtcTarget(20)).toBe('20')
  })

  it('returns Bull for target 21+', () => {
    expect(formatAtcTarget(21)).toBe('Bull')
    expect(formatAtcTarget(22)).toBe('Bull')
  })
})

describe('applyAtcDart — standard (no fast forward)', () => {
  it('registers a hit and advances by 1', () => {
    const result = applyAtcDart(5, { segment: 5, multiplier: 1 }, standard)
    expect(result.hit).toBe(true)
    expect(result.advance).toBe(1)
    expect(result.nextTarget).toBe(6)
    expect(result.isWin).toBe(false)
  })

  it('registers a hit with double but still advances by 1', () => {
    const result = applyAtcDart(5, { segment: 5, multiplier: 2 }, standard)
    expect(result.hit).toBe(true)
    expect(result.advance).toBe(1)
    expect(result.nextTarget).toBe(6)
  })

  it('registers a hit with treble but still advances by 1', () => {
    const result = applyAtcDart(5, { segment: 5, multiplier: 3 }, standard)
    expect(result.hit).toBe(true)
    expect(result.advance).toBe(1)
    expect(result.nextTarget).toBe(6)
  })

  it('registers a miss when hitting wrong segment', () => {
    const result = applyAtcDart(5, { segment: 6, multiplier: 1 }, standard)
    expect(result.hit).toBe(false)
    expect(result.advance).toBe(0)
    expect(result.nextTarget).toBe(5)
    expect(result.isWin).toBe(false)
  })

  it('registers a miss on segment 0', () => {
    const result = applyAtcDart(5, { segment: 0, multiplier: 1 }, standard)
    expect(result.hit).toBe(false)
    expect(result.nextTarget).toBe(5)
  })

  it('detects win when hitting bull on target 21', () => {
    const result = applyAtcDart(21, { segment: 25, multiplier: 1 }, standard)
    expect(result.hit).toBe(true)
    expect(result.isWin).toBe(true)
    expect(result.nextTarget).toBe(22)
  })

  it('detects win with double bull on target 21', () => {
    const result = applyAtcDart(21, { segment: 25, multiplier: 2 }, standard)
    expect(result.hit).toBe(true)
    expect(result.isWin).toBe(true)
  })

  it('does not win when missing bull on target 21', () => {
    const result = applyAtcDart(21, { segment: 20, multiplier: 1 }, standard)
    expect(result.hit).toBe(false)
    expect(result.isWin).toBe(false)
  })
})

describe('applyAtcDart — fast forward', () => {
  it('advances by 2 on double', () => {
    const result = applyAtcDart(5, { segment: 5, multiplier: 2 }, fast)
    expect(result.hit).toBe(true)
    expect(result.advance).toBe(2)
    expect(result.nextTarget).toBe(7)
    expect(result.isWin).toBe(false)
  })

  it('advances by 3 on treble', () => {
    const result = applyAtcDart(5, { segment: 5, multiplier: 3 }, fast)
    expect(result.hit).toBe(true)
    expect(result.advance).toBe(3)
    expect(result.nextTarget).toBe(8)
  })

  it('advances by 1 on single', () => {
    const result = applyAtcDart(5, { segment: 5, multiplier: 1 }, fast)
    expect(result.hit).toBe(true)
    expect(result.advance).toBe(1)
    expect(result.nextTarget).toBe(6)
  })

  it('triggers win when advance overshoot target 21 with treble', () => {
    // target 20, T20 → advances by 3 → nextTarget 23 > 21 → win
    const result = applyAtcDart(20, { segment: 20, multiplier: 3 }, fast)
    expect(result.hit).toBe(true)
    expect(result.isWin).toBe(true)
    expect(result.nextTarget).toBe(22)
  })

  it('triggers win when advance lands exactly on 22 from target 20 with double', () => {
    // target 20, D20 → advances by 2 → nextTarget 22 > 21 → win
    const result = applyAtcDart(20, { segment: 20, multiplier: 2 }, fast)
    expect(result.hit).toBe(true)
    expect(result.isWin).toBe(true)
  })

  it('does not skip past bull without hitting it on last numeric target', () => {
    // target 19, T19 with fastForward → advances by 3 → nextTarget 22 → win (skips target 20, 21)
    const result = applyAtcDart(19, { segment: 19, multiplier: 3 }, fast)
    expect(result.hit).toBe(true)
    expect(result.isWin).toBe(true)
  })
})
