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
  const soundEnabled = ref(true)

  function persist() {
    saveSettings({
      ...settings.value,
      soundEnabled: soundEnabled.value
    })
  }

  function update(patch: Partial<X01Settings>) {
    settings.value = {
      ...settings.value,
      ...patch
    }
    persist()
  }

  function updateSoundEnabled(value: boolean) {
    soundEnabled.value = value
    persist()
  }

  function load() {
    const stored = loadSettings({
      ...DEFAULT_SETTINGS,
      soundEnabled: true
    })

    settings.value = {
      startScore: stored.startScore,
      doubleIn: stored.doubleIn,
      doubleOut: stored.doubleOut,
      legsTarget: stored.legsTarget
    }
    soundEnabled.value = stored.soundEnabled ?? true
  }

  return {
    settings,
    soundEnabled,
    update,
    updateSoundEnabled,
    load,
    DEFAULT_SETTINGS
  }
})
