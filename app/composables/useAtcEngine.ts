import type { AtcDartResult, AtcSettings, DartInput, Segment } from '~~/shared/types/darts'

export function getAtcTargetSegment(target: number): Segment {
  if (target <= 20) {
    return target as Segment
  }
  return 25
}

export function applyAtcDart(
  currentTarget: number,
  input: DartInput,
  settings: AtcSettings
): AtcDartResult {
  const targetSegment = getAtcTargetSegment(currentTarget)
  const hit = input.segment === targetSegment

  if (!hit) {
    return { hit: false, advance: 0, nextTarget: currentTarget, isWin: false }
  }

  const advance = settings.fastForward ? input.multiplier : 1
  const nextTarget = currentTarget + advance
  const isWin = nextTarget > 21

  return {
    hit: true,
    advance,
    nextTarget: Math.min(nextTarget, 22),
    isWin
  }
}

export function formatAtcTarget(target: number): string {
  if (target > 20) {
    return 'Bull'
  }
  return String(target)
}
