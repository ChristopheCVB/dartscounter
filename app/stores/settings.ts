import type { AtcSettings, X01Settings } from '~~/shared/types/darts'
import type { Preferences } from '~~/shared/types/rooms'
import { defaultPreferences } from '~~/shared/types/rooms'
import { apiError } from '~/utils/apiError'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({ ...defaultPreferences.settings })
  const atcSettings = ref({ ...defaultPreferences.atcSettings })
  const cricketSettings = ref({ ...defaultPreferences.cricketSettings })
  const soundEnabled = ref(true)
  const announcementLanguage = useLocalStorage('dartcounter:v1:announcement-language', '', { initOnMounted: true })
  const announcementVoice = useLocalStorage('dartcounter:v1:announcement-voice', '', { initOnMounted: true })
  function hydrate(data: Preferences) {
    settings.value = data.settings
    atcSettings.value = data.atcSettings
    cricketSettings.value = data.cricketSettings ?? { ...defaultPreferences.cricketSettings }
    soundEnabled.value = data.soundEnabled
  }
  function reset() { hydrate(structuredClone(defaultPreferences)) }
  async function save(data: Preferences) {
    try {
      hydrate(await $fetch<Preferences>('/api/preferences', { method: 'PUT', body: data }))
      return true
    } catch (error) {
      useToast().add({ title: 'Settings were not saved', description: apiError(error), color: 'error' })
      return false
    }
  }
  function update(patch: Partial<Omit<X01Settings, 'mode'>>) {
    return save({ settings: { ...settings.value, ...patch }, atcSettings: atcSettings.value, cricketSettings: cricketSettings.value, soundEnabled: soundEnabled.value })
  }
  function updateAtcSettings(patch: Partial<Omit<AtcSettings, 'mode'>>) {
    return save({ settings: settings.value, atcSettings: { ...atcSettings.value, ...patch }, cricketSettings: cricketSettings.value, soundEnabled: soundEnabled.value })
  }
  function updateSoundEnabled(value: boolean) {
    return save({ settings: settings.value, atcSettings: atcSettings.value, cricketSettings: cricketSettings.value, soundEnabled: value })
  }
  return { settings, atcSettings, cricketSettings, soundEnabled, announcementLanguage, announcementVoice, hydrate, reset, save, update, updateAtcSettings, updateSoundEnabled }
})
