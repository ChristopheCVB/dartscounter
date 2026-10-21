import type { MatchSummary } from '~~/shared/types/darts'
import { apiError } from '~/utils/apiError'

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<MatchSummary[]>([])
  async function removeSummary(id: string) {
    try {
      await $fetch(`/api/history/${id}`, { method: 'DELETE' })
      entries.value = entries.value.filter(entry => entry.id !== id)
    } catch (error) {
      useToast().add({ title: 'History was not updated', description: apiError(error), color: 'error' })
    }
  }
  return { entries, removeSummary }
})
