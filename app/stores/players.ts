import type { StoredRecentPlayer } from '~/composables/usePersistence'
import { usePersistence } from '~/composables/usePersistence'

const MAX_PLAYERS = 20

export type RecentPlayer = {
  id: string
  name: string
}

function normalizeName(name: string): string {
  return name.trim()
}

function nameKey(name: string): string {
  return normalizeName(name).toLowerCase()
}

function mergeRecent(existing: RecentPlayer[], incoming: string[]): RecentPlayer[] {
  const result: RecentPlayer[] = []
  const seen = new Set<string>()

  const pushUnique = (player: RecentPlayer) => {
    const normalized = normalizeName(player.name)
    if (!normalized) {
      return
    }

    const key = nameKey(normalized)
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    result.push({
      id: player.id,
      name: normalized
    })
  }

  const pushUniqueName = (name: string) => {
    const normalized = normalizeName(name)
    if (!normalized) {
      return
    }

    const key = nameKey(normalized)
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    result.push({
      id: crypto.randomUUID(),
      name: normalized
    })
  }

  for (const name of incoming) {
    pushUniqueName(name)
  }

  for (const player of existing) {
    pushUnique(player)
  }

  return result.slice(0, MAX_PLAYERS)
}

function normalizeStoredPlayers(payload: StoredRecentPlayer[] | string[]): RecentPlayer[] {
  const mapped = payload.map((entry) => {
    if (typeof entry === 'string') {
      return {
        id: crypto.randomUUID(),
        name: entry
      }
    }

    return {
      id: entry.id || crypto.randomUUID(),
      name: entry.name
    }
  })

  return mergeRecent([], mapped.map(player => player.name)).map((player, idx) => {
    const fromPayload = mapped.find(source => nameKey(source.name) === nameKey(player.name))
    return {
      id: fromPayload?.id || player.id || `${idx}-${player.name}`,
      name: player.name
    }
  })
}

export const usePlayersStore = defineStore('players', () => {
  const recentPlayers = ref<RecentPlayer[]>([])
  const { loadRecentPlayers, saveRecentPlayers } = usePersistence()

  function persist() {
    saveRecentPlayers(recentPlayers.value.map(player => ({ id: player.id, name: player.name })))
  }

  function load() {
    recentPlayers.value = normalizeStoredPlayers(loadRecentPlayers()).slice(0, MAX_PLAYERS)
    persist()
  }

  function rememberMany(names: string[]) {
    const normalized = names.map(normalizeName).filter(Boolean)

    if (!normalized.length) {
      return
    }

    recentPlayers.value = mergeRecent(recentPlayers.value, normalized)
    persist()
  }

  function addRecentPlayer(name: string) {
    const normalized = normalizeName(name)
    if (!normalized) {
      return
    }

    recentPlayers.value = mergeRecent(recentPlayers.value, [normalized])
    persist()
  }

  function renameRecentPlayer(playerId: string, newName: string) {
    const normalizedNew = normalizeName(newName)

    if (!playerId || !normalizedNew) {
      return
    }

    recentPlayers.value = recentPlayers.value.map((player) => {
      if (player.id !== playerId) {
        return player
      }

      return {
        ...player,
        name: normalizedNew
      }
    })

    const deduped: RecentPlayer[] = []
    const seen = new Set<string>()

    for (const player of recentPlayers.value) {
      const key = nameKey(player.name)
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      deduped.push(player)
    }

    recentPlayers.value = deduped.slice(0, MAX_PLAYERS)
    persist()
  }

  function removeRecentPlayer(playerId: string) {
    if (!playerId) {
      return
    }

    recentPlayers.value = recentPlayers.value.filter(player => player.id !== playerId)
    persist()
  }

  function clearRecentPlayers() {
    recentPlayers.value = []
    persist()
  }

  const recentNames = computed(() => recentPlayers.value.map(player => player.name))

  return {
    recentPlayers,
    recentNames,
    load,
    rememberMany,
    addRecentPlayer,
    renameRecentPlayer,
    removeRecentPlayer,
    clearRecentPlayers
  }
})
