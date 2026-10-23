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
  const addRecentPlayer = (name: string, color?: string) => mutate({ type: 'ensure', players: [{ name, color: normalizePlayerColor(color) }] })
  const updateRecentPlayer = (id: string, player: Pick<PlayerIdentity, 'name' | 'color'>) => mutate({ type: 'update', id, ...player })
  const removeRecentPlayer = (id: string) => mutate({ type: 'remove', id })
  const clearRecentPlayers = () => mutate({ type: 'clear' })
  return { recentPlayers, recentNames, addRecentPlayer, updateRecentPlayer, removeRecentPlayer, clearRecentPlayers }
})
