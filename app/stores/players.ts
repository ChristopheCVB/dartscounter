import type { PlayerIdentity } from '~~/shared/types/darts'
import { normalizePlayerColor } from '~~/shared/utils/playerColors'
import { apiError } from '~/utils/apiError'

export type RecentPlayer = PlayerIdentity
export const usePlayersStore = defineStore('players', () => {
  const recentPlayers = ref<PlayerIdentity[]>([])
  const recentNames = computed(() => recentPlayers.value.map(player => player.name))
  async function mutate(body: object) {
    try {
      const result = await $fetch<{ players: PlayerIdentity[], selected: PlayerIdentity[] }>('/api/players', { method: 'POST', body })
      recentPlayers.value = result.players
      return result
    } catch (error) {
      useToast().add({ title: 'Players were not saved', description: apiError(error), color: 'error' })
      return null
    }
  }
  async function ensureMany(seeds: Array<{ name: string, color?: string }>) {
    const result = await mutate({ type: 'ensure', players: seeds.map((p, i) => ({ name: p.name.trim(), color: normalizePlayerColor(p.color, i) })) })
    return result?.selected ?? []
  }
  const addRecentPlayer = (name: string, color?: string) => mutate({ type: 'ensure', players: [{ name, color: normalizePlayerColor(color) }] })
  const renameRecentPlayer = (id: string, name: string) => mutate({ type: 'update', id, name })
  const updateRecentPlayerColor = (id: string, color: string) => mutate({ type: 'update', id, color })
  const removeRecentPlayer = (id: string) => mutate({ type: 'remove', id })
  const clearRecentPlayers = () => mutate({ type: 'clear' })
  return { recentPlayers, recentNames, ensureMany, addRecentPlayer, renameRecentPlayer, updateRecentPlayerColor, removeRecentPlayer, clearRecentPlayers }
})
