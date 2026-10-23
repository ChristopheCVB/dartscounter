<template>
  <section class="page-stack max-w-4xl">
    <header class="page-heading"><h1>Settings</h1><p>Your match defaults and sound preferences.</p></header>
    <UAlert v-if="account.error" color="error" :title="account.error" />
    <form class="grid gap-8" @submit.prevent="save">
      <section class="form-section">
        <div class="section-heading"><h2>Match defaults</h2><p>Starting rules for your next X01 match.</p></div>
        <div class="grid gap-5 sm:grid-cols-2">
          <UFormField label="Default start score"><USelect v-model="local.startScore" :items="[301, 501]" class="w-full" /></UFormField>
          <UFormField label="Default legs to win"><UInputNumber v-model="local.legsTarget" :min="1" :max="11" class="w-full" /></UFormField>
        </div>
        <div class="flex flex-wrap gap-x-8 gap-y-4"><UCheckbox v-model="local.doubleIn" label="Default double in" /><UCheckbox v-model="local.doubleOut" label="Default double out" /></div>
      </section>
      <section class="form-section border-t border-default pt-8">
        <div class="section-heading"><h2>Audio</h2><p>Hear turn totals and match celebrations.</p></div>
        <UCheckbox v-model="local.soundEnabled" label="Sound effects and announcements" />
        <ClientOnly>
          <div class="form-fields">
            <div class="grid gap-5 sm:grid-cols-2">
              <UFormField label="Announcement language"><USelect :model-value="local.announcementLanguage || null" :items="languageItems" :disabled="!voicePreview.isSupported.value" class="w-full" @update:model-value="local.announcementLanguage = $event ?? ''; local.announcementVoice = ''; voicePreview.stop()" /></UFormField>
              <UFormField label="Announcement voice"><USelect :model-value="local.announcementVoice || null" :items="voiceItems" :disabled="!voicePreview.isSupported.value" class="w-full" @update:model-value="local.announcementVoice = $event ?? ''; voicePreview.stop()" /></UFormField>
            </div>
            <div><UButton type="button" color="neutral" variant="soft" :disabled="!local.soundEnabled || !settingsStore.soundEnabled || !voicePreview.isSupported.value" @click="voicePreview.speak(60)">Test voice</UButton></div>
            <p class="text-sm text-muted">Language and voice are saved on this browser. Calls for 100, 140, and 180 use recordings in their original voice.</p>
            <p v-if="!voicePreview.isSupported.value" class="text-sm text-muted" role="status">Speech announcements are unavailable in this browser. Recorded sounds still work.</p>
            <p v-else-if="voicePreview.error.value" class="text-sm text-muted" role="status">Speech could not play. Check your device’s voices and audio permissions, then try Test voice.</p>
            <p v-else-if="voicePreview.unavailableVoice.value" class="text-sm text-muted" role="status">The saved voice is unavailable on this device. The language’s default voice will be used.</p>
          </div>
        </ClientOnly>
      </section>
      <div class="border-t border-default pt-6"><UButton type="submit" :loading="saving" class="w-full sm:w-auto">Save defaults</UButton></div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'
import { useSettingsStore } from '~/stores/settings'

definePageMeta({
  title: 'Settings',
  description: 'Set your default darts rules, sound effects, and score announcement preferences.'
})

const account = useAccountStore()
const settingsStore = useSettingsStore()
const toast = useToast()
const local = reactive({
  startScore: settingsStore.settings.startScore,
  doubleIn: settingsStore.settings.doubleIn,
  doubleOut: settingsStore.settings.doubleOut,
  legsTarget: settingsStore.settings.legsTarget,
  soundEnabled: settingsStore.soundEnabled,
  announcementLanguage: settingsStore.announcementLanguage,
  announcementVoice: settingsStore.announcementVoice
})

const voicePreview = useScoreSpeech(() => local.announcementLanguage, () => local.announcementVoice)
const languageItems = computed(() => [
  { label: 'Device language', value: null },
  ...[...new Set([...voicePreview.voices.value.map(voice => voice.lang), local.announcementLanguage].filter(Boolean))]
    .sort().map(lang => ({ label: lang, value: lang }))
])
const voiceItems = computed(() => [
  { label: 'Default voice', value: null },
  ...voicePreview.matchingVoices.value.map(voice => ({ label: voice.name, value: voice.voiceURI })),
  ...(voicePreview.unavailableVoice.value ? [{ label: 'Saved voice (unavailable)', value: local.announcementVoice }] : [])
])
watch(() => [settingsStore.announcementLanguage, settingsStore.announcementVoice], ([language, voice]) => {
  local.announcementLanguage = language ?? ''
  local.announcementVoice = voice ?? ''
})
watch(() => [local.soundEnabled, settingsStore.soundEnabled], ([localEnabled, savedEnabled]) => {
  if (!localEnabled || !savedEnabled) voicePreview.stop()
})

const saving = ref(false)
async function save() {
  if (saving.value) return
  saving.value = true
  try {
    if (!await settingsStore.save({
      settings: { mode: 'x01', startScore: local.startScore, doubleIn: local.doubleIn, doubleOut: local.doubleOut, legsTarget: local.legsTarget },
      atcSettings: settingsStore.atcSettings, soundEnabled: local.soundEnabled
    })) return
    settingsStore.announcementLanguage = local.announcementLanguage
    settingsStore.announcementVoice = local.announcementVoice
    toast.add({
      title: 'Settings saved',
      description: 'Match defaults, sound preference, and this browser’s announcement voice updated.',
      color: 'success'
    })
  } finally { saving.value = false }
}

watch(() => settingsStore.settings, settings => Object.assign(local, settings, { soundEnabled: settingsStore.soundEnabled }), { deep: true })
onMounted(() => account.load())
</script>
