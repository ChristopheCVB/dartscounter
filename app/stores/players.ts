import type { StoredRecentPlayer } from '~/composables/usePersistence'
import type { PlayerIdentity } from '~~/shared/types/darts'
import { normalizePlayerColor } from '~/constants/playerColors'
import { usePersistence } from '~/composables/usePersistence'

export type RecentPlayer = PlayerIdentity

type RecentPlayerSeed = string | {
  name: string
  color?: string
}

type NormalizedRecentSeed = {
  name: string
  color?: string
}

function normalizeName(name: string): string {
  return name.trim()
}

function nameKey(name: string): string {
  return normalizeName(name).toLowerCase()
}

function mergeRecent(existing: RecentPlayer[], incoming: RecentPlayerSeed[]): RecentPlayer[] {
  const result: RecentPlayer[] = []
  const seen = new Set<string>()
  const existingByKey = new Map<string, RecentPlayer>()
  let nextColorIndex = 0

  for (const player of existing) {
    const normalized = normalizeName(player.name)
    if (!normalized) {
      continue
    }

    const key = nameKey(normalized)
    if (existingByKey.has(key)) {
      continue
    }

    existingByKey.set(key, {
      ...player,
      name: normalized
    })
  }

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
      name: normalized,
      color: normalizePlayerColor(player.color, nextColorIndex)
    })
    nextColorIndex += 1
  }

  const pushUniqueName = (seed: RecentPlayerSeed) => {
    const normalized = normalizeName(typeof seed === 'string' ? seed : seed.name)
    if (!normalized) {
      return
    }

    const key = nameKey(normalized)
    if (seen.has(key)) {
      return
    }

    const existingPlayer = existingByKey.get(key)

    seen.add(key)
    result.push({
      id: existingPlayer?.id || crypto.randomUUID(),
      name: normalized,
      color: normalizePlayerColor(
        typeof seed === 'string' ? existingPlayer?.color : (seed.color || existingPlayer?.color),
        nextColorIndex
      )
    })
    nextColorIndex += 1
  }

  for (const seed of incoming) {
    pushUniqueName(seed)
  }

  for (const player of existing) {
    pushUnique(player)
  }

  return result
}

function normalizeStoredPlayers(payload: StoredRecentPlayer[] | string[]): RecentPlayer[] {
  const mapped = payload.map((entry) => {
    if (typeof entry === 'string') {
      return {
        id: crypto.randomUUID(),
        name: entry,
        color: undefined
      }
    }

    return {
      id: entry.id || crypto.randomUUID(),
      name: entry.name,
      color: entry.color
    }
  })

  return mergeRecent([], mapped).map((player, idx) => {
    const fromPayload = mapped.find(source => nameKey(source.name) === nameKey(player.name))
    return {
      id: fromPayload?.id || player.id || `${idx}-${player.name}`,
      name: player.name,
      color: normalizePlayerColor(fromPayload?.color, idx)
    }
  })
}

function normalizeSeeds(players: RecentPlayerSeed[]): NormalizedRecentSeed[] {
  return players
    .map((seed) => {
      if (typeof seed === 'string') {
        const name = normalizeName(seed)
        return name ? { name } : null
      }

      const name = normalizeName(seed.name)
      if (!name) {
        return null
      }

      return {
        name,
        color: seed.color
      }
    })
    .filter((seed): seed is NormalizedRecentSeed => Boolean(seed))
}

export const usePlayersStore = defineStore('players', () => {
  const recentPlayers = ref<RecentPlayer[]>([])
  const { loadRecentPlayers, saveRecentPlayers } = usePersistence()

  function persist() {
    saveRecentPlayers(recentPlayers.value.map(player => ({ id: player.id, name: player.name, color: player.color })))
  }

  function load() {
    recentPlayers.value = normalizeStoredPlayers(loadRecentPlayers())
    persist()
  }

  function rememberMany(players: RecentPlayerSeed[]) {
    const normalized = normalizeSeeds(players)

    if (!normalized.length) {
      return
    }

    recentPlayers.value = mergeRecent(recentPlayers.value, normalized)
    persist()
  }

  function ensureMany(players: RecentPlayerSeed[]): RecentPlayer[] {
    const normalized = normalizeSeeds(players)

    if (!normalized.length) {
      return []
    }

    recentPlayers.value = mergeRecent(recentPlayers.value, normalized)
    persist()

    const byName = new Map(recentPlayers.value.map(player => [nameKey(player.name), player]))

    return normalized
      .map(player => byName.get(nameKey(player.name)))
      .filter((player): player is RecentPlayer => Boolean(player))
  }

  function addRecentPlayer(name: string, color?: string) {
    const normalized = normalizeName(name)
    if (!normalized) {
      return
    }

    recentPlayers.value = mergeRecent(recentPlayers.value, [{ name: normalized, color }])
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

    recentPlayers.value = deduped
    persist()
  }

  function updateRecentPlayerColor(playerId: string, color: string) {
    if (!playerId) {
      return
    }

    const currentIndex = recentPlayers.value.findIndex(player => player.id === playerId)
    if (currentIndex < 0) {
      return
    }

    recentPlayers.value = recentPlayers.value.map((player, idx) => {
      if (player.id !== playerId) {
        return player
      }

      return {
        ...player,
        color: normalizePlayerColor(color, idx)
      }
    })

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
    ensureMany,
    addRecentPlayer,
    renameRecentPlayer,
    updateRecentPlayerColor,
    removeRecentPlayer,
    clearRecentPlayers
  }
})
