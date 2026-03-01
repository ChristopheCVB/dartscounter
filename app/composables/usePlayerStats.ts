import type { MatchSummary } from '~~/shared/types/darts'
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
  lastPlayed: number
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

type MutableAggregate = Omit<AggregatedPlayerStats, 'average' | 'firstNineAverage' | 'checkoutPercentage'>

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

export function aggregatePlayerStats(entries: MatchSummary[], recentPlayers: RecentPlayer[]): AggregatedPlayerStats[] {
  const byId = new Map<string, MutableAggregate>()

  for (const player of recentPlayers) {
    byId.set(player.id, emptyAggregate(player))
  }

  for (const entry of entries) {
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
      aggregate.busts += player.busts
      aggregate.checkoutAttempts += player.checkoutAttempts
      aggregate.checkoutsMade += player.checkoutsMade
      aggregate.scoredPoints += player.scoredPoints
      aggregate.firstNinePoints += player.firstNinePoints
      aggregate.firstNineDarts += player.firstNineDarts
      aggregate.lastPlayed = Math.max(aggregate.lastPlayed, entry.finishedAt)

      const isWinner = player.playerId === entry.winnerId
      if (isWinner) {
        aggregate.wins += 1
      }

      byId.set(player.playerId, aggregate)
    }
  }

  return [...byId.values()]
    .map((player) => {
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
