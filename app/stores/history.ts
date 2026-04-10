import type { MatchSummary } from '~~/shared/types/darts'
import { normalizePlayerColor } from '~/constants/playerColors'
import { usePersistence } from '~/composables/usePersistence'

type LegacyPlayerSummary = Partial<MatchSummary['players'][number]> & {
  playerId?: string
  name?: string
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizePlayerSummary(player: LegacyPlayerSummary, index: number) {
  const dartsThrown = Number(player.dartsThrown) || 0
  const scoredPoints = Number(player.scoredPoints)
  const resolvedScoredPoints = Number.isFinite(scoredPoints)
    ? scoredPoints
    : round(((Number(player.average) || 0) / 3) * dartsThrown)

  const firstNineDarts = Number(player.firstNineDarts)
  const resolvedFirstNineDarts = Number.isFinite(firstNineDarts)
    ? firstNineDarts
    : Math.min(9, dartsThrown)

  const firstNinePoints = Number(player.firstNinePoints)
  const resolvedFirstNinePoints = Number.isFinite(firstNinePoints)
    ? firstNinePoints
    : round(((Number(player.firstNineAverage) || 0) / 3) * resolvedFirstNineDarts)

  return {
    playerId: player.playerId || crypto.randomUUID(),
    name: (player.name || `Player ${index + 1}`).trim(),
    color: normalizePlayerColor(player.color, index),
    legsWon: Number(player.legsWon) || 0,
    average: round(Number(player.average) || 0),
    scoredPoints: resolvedScoredPoints,
    firstNineAverage: round(Number(player.firstNineAverage) || 0),
    firstNinePoints: resolvedFirstNinePoints,
    firstNineDarts: resolvedFirstNineDarts,
    checkoutAttempts: Number(player.checkoutAttempts) || 0,
    checkoutsMade: Number(player.checkoutsMade) || 0,
    checkoutPercentage: round(Number(player.checkoutPercentage) || 0),
    dartsThrown,
    busts: Number(player.busts) || 0
  }
}

function normalizeSummary(entry: MatchSummary): MatchSummary {
  const players = (entry.players || []).map((player, idx) => normalizePlayerSummary(player, idx))
  const winner = players.find(player => player.playerId === entry.winnerId)

  return {
    ...entry,
    players,
    winnerName: entry.winnerName || winner?.name || players[0]?.name || 'Winner',
    winnerId: entry.winnerId || winner?.playerId || players[0]?.playerId || crypto.randomUUID(),
    finishedAt: Number(entry.finishedAt) || Date.now(),
    durationMs: Number(entry.durationMs) || 0,
    mode: entry.mode || 'X01 501',
    gameMode: entry.gameMode || 'x01'
  }
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<MatchSummary[]>([])
  const { saveHistory, loadHistory } = usePersistence()

  function addSummary(summary: MatchSummary) {
    entries.value = [summary, ...entries.value]
    saveHistory(entries.value)
  }

  function removeSummary(summaryId: string) {
    entries.value = entries.value.filter(entry => entry.id !== summaryId)
    saveHistory(entries.value)
  }

  function load() {
    const loaded = loadHistory()
    const normalized = loaded.map(normalizeSummary)
    entries.value = normalized

    if (JSON.stringify(loaded) !== JSON.stringify(normalized)) {
      saveHistory(normalized)
    }
  }

  return {
    entries,
    addSummary,
    removeSummary,
    load
  }
})
