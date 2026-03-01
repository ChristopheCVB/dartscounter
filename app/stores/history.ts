import type { MatchSummary } from '~~/shared/types/darts'
import { usePersistence } from '~/composables/usePersistence'

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
    entries.value = loadHistory()
  }

  function linkRecentPlayerByName(playerId: string, name: string) {
    const target = name.trim().toLowerCase()
    if (!playerId || !target) {
      return
    }

    let changed = false

    entries.value = entries.value.map((entry) => {
      let entryChanged = false

      const players = entry.players.map((player) => {
        if ((player.recentPlayerId || '') || player.name.trim().toLowerCase() !== target) {
          return player
        }

        entryChanged = true
        changed = true

        return {
          ...player,
          recentPlayerId: playerId
        }
      })

      if (!entryChanged) {
        return entry
      }

      return {
        ...entry,
        players
      }
    })

    if (changed) {
      saveHistory(entries.value)
    }
  }

  return {
    entries,
    addSummary,
    removeSummary,
    load,
    linkRecentPlayerByName
  }
})
