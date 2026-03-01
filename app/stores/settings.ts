import type { X01Settings } from '~~/shared/types/darts'
import { usePersistence } from '~/composables/usePersistence'

const DEFAULT_SETTINGS: X01Settings = {
  startScore: 501,
  doubleIn: false,
  doubleOut: true,
  legsTarget: 1
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<X01Settings>({ ...DEFAULT_SETTINGS })
  const { saveSettings, loadSettings } = usePersistence()

  function update(patch: Partial<X01Settings>) {
    settings.value = {
      ...settings.value,
      ...patch
    }
    saveSettings(settings.value)
  }

  function load() {
    settings.value = loadSettings(DEFAULT_SETTINGS)
  }

  return {
    settings,
    update,
    load,
    DEFAULT_SETTINGS
  }
})
