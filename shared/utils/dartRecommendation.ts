import type { GameSettings, MatchPlayer } from '../types/darts'
import { formatAtcTarget } from './atcEngine'

type RecommendedDart = {
  label: string
  points: number
  isDouble: boolean
}

const allDarts: RecommendedDart[] = [
  ...Array.from({ length: 20 }, (_, idx) => {
    const segment = 20 - idx
    return { label: `T${segment}`, points: segment * 3, isDouble: false }
  }),
  ...Array.from({ length: 20 }, (_, idx) => {
    const segment = 20 - idx
    return { label: `D${segment}`, points: segment * 2, isDouble: true }
  }),
  { label: 'DB', points: 50, isDouble: true },
  { label: 'SB', points: 25, isDouble: false },
  ...Array.from({ length: 20 }, (_, idx) => {
    const segment = 20 - idx
    return { label: `S${segment}`, points: segment, isDouble: false }
  })
]

const finalDoubleDarts: RecommendedDart[] = [
  { label: 'DB', points: 50, isDouble: true },
  ...Array.from({ length: 20 }, (_, idx) => {
    const segment = 20 - idx
    return { label: `D${segment}`, points: segment * 2, isDouble: true }
  })
]

export function getDartRecommendation(
  player: Pick<MatchPlayer, 'score' | 'hasOpened' | 'atcTarget'>,
  settings: GameSettings,
  dartsLeft: number
): string {
  if (dartsLeft === 0) {
    return 'Turn: complete'
  }

  if (settings.mode === 'cricket') return 'Close 15–20 and Bull; finish level or ahead on points'

  if (settings.mode === 'atc') {
    const target = player.atcTarget ?? 1
    if (target > 21) {
      return 'Targets: cleared'
    }
    const targetLabel = formatAtcTarget(target)
    if (target > 20) {
      return 'Finish: Bull'
    }
    if (settings.fastForward) {
      return `Aim: ${targetLabel} · double +2 / treble +3`
    }
    return `Aim: ${targetLabel}`
  }

  if (settings.doubleIn && !player.hasOpened) {
    return 'Open: any double'
  }

  const route = findBestRoute(player.score, dartsLeft, settings.doubleOut)
  if (route) {
    return `Finish: ${route.join(' • ')}`
  }

  if (settings.doubleOut) {
    const bogeyScores = new Set([169, 168, 166, 165, 163, 162, 159])
    if (bogeyScores.has(player.score)) {
      return 'Setup: leave D20 / D16'
    }
    if (player.score > 170) {
      return 'Setup: leave D20 / D16 / D12'
    }
    return 'Setup: leave a double'
  }

  if (player.score > dartsLeft * 60) {
    return 'Score: aim for high trebles'
  }

  return 'Score: keep the next dart simple'
}

function findBestRoute(score: number, dartsLeft: number, requireDoubleOut: boolean): string[] | null {
  if (score <= 0 || dartsLeft <= 0 || score > dartsLeft * 60) {
    return null
  }

  for (let routeLength = 1; routeLength <= dartsLeft; routeLength += 1) {
    const route = searchRoute(score, routeLength, requireDoubleOut)
    if (route) {
      return route
    }
  }

  return null
}

function searchRoute(score: number, routeLength: number, requireDoubleOut: boolean): string[] | null {
  const path: string[] = []

  const walk = (remaining: number, step: number): boolean => {
    if (remaining < 0) {
      return false
    }

    if (step === routeLength) {
      return remaining === 0
    }

    const isLastDart = step === routeLength - 1
    const candidates = requireDoubleOut && isLastDart ? finalDoubleDarts : allDarts

    for (const dart of candidates) {
      if (dart.points > remaining) {
        continue
      }

      const nextRemaining = remaining - dart.points
      if (isLastDart && nextRemaining !== 0) {
        continue
      }

      path.push(dart.label)
      if (walk(nextRemaining, step + 1)) {
        return true
      }
      path.pop()
    }

    return false
  }

  return walk(score, 0) ? [...path] : null
}
