import type { GameMode, MatchSummary } from '~~/shared/types/darts'
import type { RecentPlayer } from '~/stores/players'
import { normalizePlayerColor } from '~/constants/playerColors'

export type AggregatedPlayerStats = {
  id: string
  name: string
  color: string
  matches: number
  wins: number
  dartsThrown: number
  busts: number
  checkoutAttempts: number
  checkoutsMade: number
  scoredPoints: number
  firstNinePoints: number
  firstNineDarts: number
  average: number
  firstNineAverage: number
  checkoutPercentage: number
  hitRate?: number
  lastPlayed: number
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

type MutableAggregate = Omit<AggregatedPlayerStats, 'average' | 'firstNineAverage' | 'checkoutPercentage' | 'hitRate'>

function emptyAggregate(seed: { id: string, name: string, color: string }): MutableAggregate {
  return {
    id: seed.id,
    name: seed.name,
    color: seed.color,
    matches: 0,
    wins: 0,
    dartsThrown: 0,
    busts: 0,
    checkoutAttempts: 0,
    checkoutsMade: 0,
    scoredPoints: 0,
    firstNinePoints: 0,
    firstNineDarts: 0,
    lastPlayed: 0
  }
}

export function aggregatePlayerStats(
  entries: MatchSummary[],
  recentPlayers: RecentPlayer[],
  mode: GameMode = 'x01'
): AggregatedPlayerStats[] {
  const byId = new Map<string, MutableAggregate>()

  for (const player of recentPlayers) {
    byId.set(player.id, emptyAggregate(player))
  }

  const filtered = entries.filter(entry => (entry.gameMode || 'x01') === mode)

  for (const entry of filtered) {
    for (const player of entry.players) {
      const existing = byId.get(player.playerId)
      const aggregate = existing || emptyAggregate({
        id: player.playerId,
        name: player.name,
        color: normalizePlayerColor(player.color)
      })

      aggregate.name = aggregate.name || player.name
      aggregate.color = normalizePlayerColor(player.color || aggregate.color)
      aggregate.matches += 1
      aggregate.dartsThrown += player.dartsThrown
      aggregate.scoredPoints += player.scoredPoints
      aggregate.lastPlayed = Math.max(aggregate.lastPlayed, entry.finishedAt)

      if (mode === 'x01') {
        aggregate.busts += player.busts
        aggregate.checkoutAttempts += player.checkoutAttempts
        aggregate.checkoutsMade += player.checkoutsMade
        aggregate.firstNinePoints += player.firstNinePoints
        aggregate.firstNineDarts += player.firstNineDarts
      }

      const isWinner = player.playerId === entry.winnerId
      if (isWinner) {
        aggregate.wins += 1
      }

      byId.set(player.playerId, aggregate)
    }
  }

  return [...byId.values()]
    .map((player) => {
      if (mode === 'atc') {
        const hitRate = player.dartsThrown > 0 ? round(player.scoredPoints / player.dartsThrown) : 0
        return {
          ...player,
          average: 0,
          firstNineAverage: 0,
          checkoutPercentage: 0,
          hitRate
        }
      }

      const average = player.dartsThrown > 0 ? (player.scoredPoints / player.dartsThrown) * 3 : 0
      const firstNineAverage = player.firstNineDarts > 0 ? (player.firstNinePoints / player.firstNineDarts) * 3 : 0
      const checkoutPercentage = player.checkoutAttempts > 0 ? (player.checkoutsMade / player.checkoutAttempts) * 100 : 0

      return {
        ...player,
        average: round(average),
        firstNineAverage: round(firstNineAverage),
        checkoutPercentage: round(checkoutPercentage)
      }
    })
    .sort((a, b) => {
      if (b.matches !== a.matches) {
        return b.matches - a.matches
      }
      return a.name.localeCompare(b.name)
    })
}
