import { describe, expect, it } from 'vitest'
import { applyCricketDart, createCricketMarks } from '../../../../shared/utils/cricketEngine'
import { settingsSchema } from '../../../../shared/utils/validation'

describe('classic Cricket', () => {
  it('closes and scores overflow on the same dart without mutating input', () => {
    const marks = { ...createCricketMarks(), 20: 2 as const }
    const result = applyCricketDart(marks, [createCricketMarks()], { segment: 20, multiplier: 3 })
    expect(result).toEqual({ nextMarks: { ...marks, 20: 3 }, scoredPoints: 40, scoredMarks: 3 })
    expect(marks[20]).toBe(2)
  })

  it('scores once while any opponent still has a target open', () => {
    const marks = { ...createCricketMarks(), 19: 3 as const }
    const closed = { ...createCricketMarks(), 19: 3 as const }
    const dart = { segment: 19, multiplier: 3 } as const
    expect(applyCricketDart(marks, [closed, createCricketMarks(), createCricketMarks()], dart)).toMatchObject({ scoredPoints: 57, scoredMarks: 3 })
    expect(applyCricketDart(marks, [closed, closed], dart)).toMatchObject({ scoredPoints: 0, scoredMarks: 0 })
  })

  it('counts only needed closing marks when every opponent is closed', () => {
    const marks = { ...createCricketMarks(), 20: 2 as const }
    const opponent = { ...createCricketMarks(), 20: 3 as const }
    expect(applyCricketDart(marks, [opponent], { segment: 20, multiplier: 3 })).toMatchObject({ scoredPoints: 0, scoredMarks: 1, nextMarks: { 20: 3 } })
  })

  it('uses split Bull marks and points', () => {
    let marks = createCricketMarks()
    marks = applyCricketDart(marks, [createCricketMarks()], { segment: 25, multiplier: 1 }).nextMarks
    expect(marks[25]).toBe(1)
    const closing = applyCricketDart(marks, [createCricketMarks()], { segment: 25, multiplier: 2 })
    expect(closing).toMatchObject({ nextMarks: { 25: 3 }, scoredMarks: 2, scoredPoints: 0 })
    expect(applyCricketDart(closing.nextMarks, [createCricketMarks()], { segment: 25, multiplier: 2 })).toMatchObject({ scoredMarks: 2, scoredPoints: 50 })
    expect(applyCricketDart({ ...marks, 25: 2 }, [createCricketMarks()], { segment: 25, multiplier: 2 })).toMatchObject({ scoredMarks: 2, scoredPoints: 25 })
  })

  it.each([{ segment: 0, multiplier: 1 }, { segment: 14, multiplier: 3 }, { segment: 25, multiplier: 3 }] as const)('ignores non-target or invalid dart $segment/$multiplier', dart => {
    const marks = createCricketMarks()
    expect(applyCricketDart(marks, [createCricketMarks()], dart)).toEqual({ nextMarks: marks, scoredMarks: 0, scoredPoints: 0 })
  })

  it.each([0, 12, 1.5])('rejects invalid leg target %s', legsTarget => {
    expect(settingsSchema.safeParse({ mode: 'cricket', legsTarget }).success).toBe(false)
  })
})
