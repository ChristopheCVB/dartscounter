import type { DartApplyResult, DartInput, Multiplier, Segment, X01Settings } from '~~/shared/types/darts'

export function getThrowPoints(segment: Segment, multiplier: Multiplier): number {
  if (segment === 25) {
    return multiplier === 2 ? 50 : 25
  }

  if (segment === 0) {
    return 0
  }

  return segment * multiplier
}

export function isDouble(input: DartInput): boolean {
  return input.multiplier === 2
}

export function isValidSegmentMultiplier(segment: Segment, multiplier: Multiplier): boolean {
  if (segment === 25) {
    return multiplier === 1 || multiplier === 2
  }

  if (segment === 0) {
    return multiplier === 1
  }

  return multiplier >= 1 && multiplier <= 3
}

export function isBust(nextScore: number, settings: X01Settings, lastThrow: DartInput): boolean {
  if (nextScore < 0) {
    return true
  }

  if (settings.doubleOut && nextScore === 1) {
    return true
  }

  if (nextScore === 0 && settings.doubleOut && !isDouble(lastThrow)) {
    return true
  }

  return false
}

export function isCheckout(nextScore: number, settings: X01Settings, lastThrow: DartInput): boolean {
  if (nextScore !== 0) {
    return false
  }

  if (!settings.doubleOut) {
    return true
  }

  return isDouble(lastThrow)
}

export function applyDart(
  score: number,
  opened: boolean,
  input: DartInput,
  settings: X01Settings,
  turnStartScore: number,
  openedAtTurnStart: boolean
): DartApplyResult {
  const points = getThrowPoints(input.segment, input.multiplier)

  if (!opened && settings.doubleIn) {
    if (!isDouble(input)) {
      return {
        points,
        scoredPoints: 0,
        nextScore: score,
        nextOpened: false,
        isBust: false,
        isCheckout: false
      }
    }
  }

  const nextOpened = opened || !settings.doubleIn || isDouble(input)
  const nextScore = score - points

  if (isBust(nextScore, settings, input)) {
    return {
      points,
      scoredPoints: 0,
      nextScore: turnStartScore,
      nextOpened: openedAtTurnStart,
      isBust: true,
      isCheckout: false
    }
  }

  return {
    points,
    scoredPoints: points,
    nextScore,
    nextOpened,
    isBust: false,
    isCheckout: isCheckout(nextScore, settings, input)
  }
}

export function parsePointsToDart(points: number, preferDouble = false): DartInput | null {
  if (points < 0 || points > 60) {
    return null
  }

  if (points === 0) {
    return { segment: 0, multiplier: 1 }
  }

  if (points === 25) {
    return { segment: 25, multiplier: 1 }
  }

  if (points === 50) {
    return { segment: 25, multiplier: 2 }
  }

  if (preferDouble && points % 2 === 0 && points <= 40) {
    return { segment: (points / 2) as Segment, multiplier: 2 }
  }

  if (points <= 20) {
    return { segment: points as Segment, multiplier: 1 }
  }

  if (points % 3 === 0 && points / 3 <= 20) {
    return { segment: (points / 3) as Segment, multiplier: 3 }
  }

  if (points % 2 === 0 && points / 2 <= 20) {
    return { segment: (points / 2) as Segment, multiplier: 2 }
  }

  return null
}
