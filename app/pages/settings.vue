<template>
  <section class="grid gap-4">
    <UPageHeader
      title="Settings"
      description="Tune account defaults and manage your players and their lifetime statistics."
      headline="Control Room"
      class="arcade-reveal"
    />

    <UCard class="grid gap-5 arcade-glow arcade-reveal" :style="{ '--reveal-delay': '90ms' }">
      <template #header>
        <h2 class="m-0 arcade-title text-sm">Match defaults</h2>
      </template>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(12rem,14rem)_minmax(12rem,14rem)_auto] xl:items-end">
        <UFormField label="Default start score">
          <USelect v-model="local.startScore" :items="startScoreItems" />
        </UFormField>

        <UFormField label="Default legs to win">
          <UInputNumber v-model="local.legsTarget" :min="1" :max="11" />
        </UFormField>

        <div class="flex flex-col gap-3 rounded-xl border border-default p-3 md:col-span-2 md:flex-row md:gap-6 xl:col-span-1">
          <UCheckbox v-model="local.doubleIn" label="Default double in" />
          <UCheckbox v-model="local.doubleOut" label="Default double out" />
          <UCheckbox v-model="local.soundEnabled" label="Sound effects" />
        </div>
      </div>

      <ClientOnly>
        <div class="grid gap-3 md:grid-cols-2">
          <UFormField label="Announcement language">
            <USelect
              :model-value="local.announcementLanguage || null"
              :items="languageItems"
              :disabled="!voicePreview.isSupported.value"
              class="w-full"
              @update:model-value="local.announcementLanguage = $event ?? ''; local.announcementVoice = ''; voicePreview.stop()"
            />
          </UFormField>
          <UFormField label="Announcement voice">
            <USelect :model-value="local.announcementVoice || null" :items="voiceItems" :disabled="!voicePreview.isSupported.value" class="w-full" @update:model-value="local.announcementVoice = $event ?? ''; voicePreview.stop()" />
          </UFormField>
          <div class="md:col-span-2">
            <UButton color="neutral" variant="soft" :disabled="!local.soundEnabled || !settingsStore.soundEnabled || !voicePreview.isSupported.value" @click="voicePreview.speak(60)">Test voice</UButton>
            <p class="mt-2 text-xs text-muted">Language and voice are saved on this browser. Special calls for 100, 140, and 180 use recordings in their original voice.</p>
            <p v-if="!voicePreview.isSupported.value" class="text-sm text-muted" role="status">Speech announcements are unavailable in this browser. Recorded sounds still work.</p>
            <p v-else-if="voicePreview.error.value" class="text-sm text-muted" role="status">Speech could not play. Check your device’s voices and audio permissions, then try Test voice.</p>
            <p v-else-if="voicePreview.unavailableVoice.value" class="text-sm text-muted" role="status">The saved voice is unavailable on this device. The language’s default voice will be used.</p>
          </div>
        </div>
      </ClientOnly>

      <UButton class="w-full sm:w-auto" @click="save">Save defaults</UButton>
    </UCard>

    <UCard class="grid gap-4 arcade-reveal" :style="{ '--reveal-delay': '150ms' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="m-0 arcade-title text-sm">Recent players</h2>
          <UButton
            v-if="playersStore.recentPlayers.length"
            color="error"
            variant="soft"
            size="sm"
            @click="clearRecentPlayers"
          >
            Clear all
          </UButton>
        </div>
      </template>

      <p v-if="!playersStore.recentPlayers.length" class="m-0 text-sm text-muted">
        No recent players yet. Names are saved after starting matches.
      </p>

      <div class="flex gap-2">
        <UInput
          v-model="newRecentName"
          class="flex-1"
          placeholder="Add player name"
          maxlength="24"
          @keydown.enter.prevent="addRecentPlayer"
        />
        <input
          v-model="newRecentColor"
          type="color"
          class="h-9 w-12 cursor-pointer rounded-md border border-default bg-transparent p-1"
          aria-label="Pick player color"
        >
        <UButton color="neutral" variant="soft" @click="addRecentPlayer">
          Add
        </UButton>
      </div>
      <p class="m-0 text-xs text-muted">Renaming is a strict replacement and will not merge stats from other players with similar names.</p>

      <div class="flex gap-2">
        <UButton
          type="button"
          size="sm"
          :color="leaderboardMode === 'x01' ? 'primary' : 'neutral'"
          :variant="leaderboardMode === 'x01' ? 'solid' : 'soft'"
          @click="leaderboardMode = 'x01'"
        >X01</UButton>
        <UButton
          type="button"
          size="sm"
          :color="leaderboardMode === 'atc' ? 'primary' : 'neutral'"
          :variant="leaderboardMode === 'atc' ? 'solid' : 'soft'"
          @click="leaderboardMode = 'atc'"
        >Around the Clock</UButton>
      </div>

      <UTable
        v-if="playersStore.recentPlayers.length"
        :data="recentPlayerRows"
        :columns="recentPlayerColumns"
        class="rounded-lg border border-default"
      >
        <template #name-cell="{ row }">
          <UInput
            v-if="editingPlayerId === row.original.id"
            v-model="editingName"
            class="min-w-[180px]"
            maxlength="24"
            @keydown.enter.prevent="saveEdit"
            @keydown.esc.prevent="cancelEdit"
          />
          <span v-else>{{ row.original.name }}</span>
        </template>

        <template #color-cell="{ row }">
          <div class="flex items-center">
            <input
              type="color"
              class="color-picker"
              :value="row.original.color"
              :aria-label="`Pick custom color for ${row.original.name}`"
              @input="updatePlayerColor(row.original.id, row.original.name, ($event.target as HTMLInputElement).value)"
            >
          </div>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UButton
              v-if="editingPlayerId === row.original.id"
              color="primary"
              variant="soft"
              size="xs"
              @click="saveEdit"
            >
              Save
            </UButton>
            <UButton
              v-if="editingPlayerId === row.original.id"
              color="neutral"
              variant="soft"
              size="xs"
              @click="cancelEdit"
            >
              Cancel
            </UButton>
            <UButton
              v-else
              color="neutral"
              variant="soft"
              size="xs"
              @click="startEdit(row.original.id, row.original.name)"
            >
              Edit
            </UButton>
            <UButton
              v-if="row.original.id !== account.self?.id"
              color="error"
              variant="soft"
              size="xs"
              @click="removeRecentPlayer(row.original.id, row.original.name)"
            >
              Delete
            </UButton>
          </div>
        </template>
      </UTable>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import type { GameMode } from '~~/shared/types/darts'
import { useAccountStore } from '~/stores/account'
import { fallbackPlayerColor, normalizePlayerColor } from '~~/shared/utils/playerColors'
import type { AggregatedPlayerStats } from '~~/shared/utils/playerStats'
import { usePlayersStore } from '~/stores/players'
import { useSettingsStore } from '~/stores/settings'

type RecentPlayerRow = {
  id: string
  name: string
  color: string
  matches: number
  wins: number
  dartsThrown: number
  average: string
  lastPlayed: string
  actions: string
}

const playersStore = usePlayersStore()
const account = useAccountStore()
const settingsStore = useSettingsStore()
const toast = useToast()
const startScoreItems = [301, 501]
const newRecentName = ref('')
const newRecentColor = ref(fallbackPlayerColor(0))
const editingPlayerId = ref('')
const editingName = ref('')
const colorUpdateTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
const leaderboardMode = ref<GameMode>('x01')
const { data: serverStats, refresh: refreshStats } = await useFetch<AggregatedPlayerStats[]>('/api/stats', { query: { mode: leaderboardMode } })

const recentPlayerColumns = computed(() => {
  if (leaderboardMode.value === 'atc') {
    return [
      { accessorKey: 'name', header: 'Player' },
      { accessorKey: 'color', header: 'Color' },
      { accessorKey: 'matches', header: 'Matches' },
      { accessorKey: 'wins', header: 'Wins' },
      { accessorKey: 'dartsThrown', header: 'Total Darts' },
      { accessorKey: 'average', header: 'Hit Rate' },
      { accessorKey: 'lastPlayed', header: 'Last Played' },
      { accessorKey: 'actions', header: 'Actions' }
    ]
  }
  return [
    { accessorKey: 'name', header: 'Player' },
    { accessorKey: 'color', header: 'Color' },
    { accessorKey: 'matches', header: 'Matches' },
    { accessorKey: 'wins', header: 'Wins' },
    { accessorKey: 'dartsThrown', header: 'Total Darts' },
    { accessorKey: 'average', header: '3-Dart Avg' },
    { accessorKey: 'lastPlayed', header: 'Last Played' },
    { accessorKey: 'actions', header: 'Actions' }
  ]
})

const recentPlayerRows = computed<RecentPlayerRow[]>(() => {
  const aggregated = serverStats.value ?? []
  const byId = new Map(aggregated.map(player => [player.id, player]))

  return playersStore.recentPlayers.map((player) => {
    const stats = byId.get(player.id)
    const matches = stats?.matches || 0

    let averageDisplay = '-'
    if (matches > 0 && stats) {
      if (leaderboardMode.value === 'atc') {
        const rate = stats.hitRate ?? 0
        averageDisplay = `${(rate * 100).toFixed(0)}%`
      } else {
        averageDisplay = stats.average.toFixed(2)
      }
    }

    return {
      id: player.id,
      name: player.name,
      color: player.color,
      matches,
      wins: stats?.wins || 0,
      dartsThrown: stats?.dartsThrown || 0,
      average: averageDisplay,
      lastPlayed: stats?.lastPlayed ? new Date(stats.lastPlayed).toLocaleDateString() : '-',
      actions: ''
    }
  })
})

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

async function save() {
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
}

async function addRecentPlayer() {
  const next = newRecentName.value.trim()
  if (!next) {
    return
  }

  const color = normalizePlayerColor(newRecentColor.value, playersStore.recentPlayers.length)
  if (!await playersStore.addRecentPlayer(next, color)) return
  newRecentName.value = ''
  newRecentColor.value = fallbackPlayerColor(playersStore.recentPlayers.length)
  toast.add({
    title: 'Player added',
    description: `${next} is now available in recent players with ${color}.`,
    color: 'success'
  })
}

function startEdit(playerId: string, name: string) {
  editingPlayerId.value = playerId
  editingName.value = name
}

function cancelEdit() {
  editingPlayerId.value = ''
  editingName.value = ''
}

async function saveEdit() {
  const playerId = editingPlayerId.value
  const original = playersStore.recentPlayers.find(player => player.id === playerId)
  const next = editingName.value.trim()

  if (!playerId || !next || !original) {
    return
  }

  if (!await playersStore.renameRecentPlayer(playerId, next)) return
  await refreshStats()
  toast.add({
    title: 'Player renamed',
    description: `${original.name} is now ${next}.`,
    color: 'success'
  })
  cancelEdit()
}

async function removeRecentPlayer(playerId: string, playerName: string) {
  if (!playerId) {
    return
  }

  if (!await playersStore.removeRecentPlayer(playerId)) return
  toast.add({
    title: 'Player removed',
    description: `${playerName} was removed from recent players.`,
    color: 'error'
  })
}

function updatePlayerColor(playerId: string, playerName: string, color: string) {
  if (!playerId) {
    return
  }

  const normalized = normalizePlayerColor(color)

  const existingTimer = colorUpdateTimeouts.get(playerId)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const timeoutId = setTimeout(async () => {
    const existingPlayer = playersStore.recentPlayers.find(player => player.id === playerId)
    if (!existingPlayer || existingPlayer.color === normalized) {
      colorUpdateTimeouts.delete(playerId)
      return
    }

    if (!await playersStore.updateRecentPlayerColor(playerId, normalized)) return
    toast.add({
      title: 'Color updated',
      description: `${playerName} now uses ${normalized}.`,
      color: 'success'
    })
    colorUpdateTimeouts.delete(playerId)
  }, 320)

  colorUpdateTimeouts.set(playerId, timeoutId)
}

async function clearRecentPlayers() {
  if (!playersStore.recentPlayers.length) {
    return
  }

  if (!await playersStore.clearRecentPlayers()) return
  toast.add({
    title: 'Recent players cleared',
    description: 'Guest players have been removed. Your own profile is kept.',
    color: 'error'
  })
}

watch(() => settingsStore.settings, settings => Object.assign(local, settings, { soundEnabled: settingsStore.soundEnabled }), { deep: true })
onMounted(async () => { await account.load(); await refreshStats() })
onBeforeUnmount(() => {
  for (const timeoutId of colorUpdateTimeouts.values()) {
    clearTimeout(timeoutId)
  }
  colorUpdateTimeouts.clear()
})
</script>

<style scoped>
.color-picker {
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ui-border) 65%, transparent);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}
</style>
