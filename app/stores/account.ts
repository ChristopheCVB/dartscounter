import { useMatchStore } from '~/stores/match'
import { useSettingsStore } from '~/stores/settings'
import { useHistoryStore } from '~/stores/history'
import { usePlayersStore } from '~/stores/players'
import type { AccountData } from '~~/shared/types/rooms'
import type { PlayerIdentity } from '~~/shared/types/darts'
import { apiError } from '~/utils/apiError'

export const useAccountStore = defineStore('account', () => {
  const userId = ref('')
  const self = ref<PlayerIdentity | null>(null)
  const rooms = ref<AccountData['rooms']>([])
  const loaded = ref(false)
  const error = ref('')
  let generation = 0
  async function load() {
    const mine = ++generation
    try {
      const [data, session] = await Promise.all([
        $fetch<AccountData>('/api/account'),
        $fetch<{ user: { id: string } }>('/api/auth/get-session')
      ])
      if (mine !== generation) return null
      userId.value = session.user.id
      self.value = data.self
      rooms.value = data.rooms
      useSettingsStore().hydrate(data)
      usePlayersStore().recentPlayers = data.players
      useHistoryStore().entries = data.history
      if (data.activeRoom && !useMatchStore().room) useMatchStore().acceptRoom(data.activeRoom)
      loaded.value = true
      error.value = ''
      return data
    } catch (cause) {
      if (mine !== generation) return null
      error.value = apiError(cause)
      return null
    }
  }
  function clear() {
    generation++
    userId.value = ''
    self.value = null
    rooms.value = []
    loaded.value = false
    useMatchStore().reset()
    usePlayersStore().recentPlayers = []
    useHistoryStore().entries = []
    useSettingsStore().reset()
  }
  return { userId, self, rooms, loaded, error, load, clear }
})
