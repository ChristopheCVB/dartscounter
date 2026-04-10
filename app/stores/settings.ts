import type { AtcSettings, X01Settings } from '~~/shared/types/darts'
import { usePersistence } from '~/composables/usePersistence'

const DEFAULT_SETTINGS: X01Settings = {
  mode: 'x01',
  startScore: 501,
  doubleIn: false,
  doubleOut: true,
  legsTarget: 1
}

const DEFAULT_ATC_SETTINGS: AtcSettings = {
  mode: 'atc',
  fastForward: false
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<X01Settings>({ ...DEFAULT_SETTINGS })
  const atcSettings = ref<AtcSettings>({ ...DEFAULT_ATC_SETTINGS })
  const { saveSettings, loadSettings, saveAtcSettings, loadAtcSettings } = usePersistence()
  const soundEnabled = ref(true)

  function persist() {
    saveSettings({
      ...settings.value,
      soundEnabled: soundEnabled.value
    })
  }

  function update(patch: Partial<Omit<X01Settings, 'mode'>>) {
    settings.value = {
      ...settings.value,
      ...patch
    }
    persist()
  }

  function updateAtcSettings(patch: Partial<Omit<AtcSettings, 'mode'>>) {
    atcSettings.value = {
      ...atcSettings.value,
      ...patch
    }
    saveAtcSettings(atcSettings.value)
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
      mode: 'x01',
      startScore: stored.startScore,
      doubleIn: stored.doubleIn,
      doubleOut: stored.doubleOut,
      legsTarget: stored.legsTarget
    }
    soundEnabled.value = stored.soundEnabled ?? true

    const storedAtc = loadAtcSettings(DEFAULT_ATC_SETTINGS)
    atcSettings.value = {
      mode: 'atc',
      fastForward: storedAtc.fastForward ?? false
    }
  }

  return {
    settings,
    atcSettings,
    soundEnabled,
    update,
    updateAtcSettings,
    updateSoundEnabled,
    load,
    DEFAULT_SETTINGS
  }
})
