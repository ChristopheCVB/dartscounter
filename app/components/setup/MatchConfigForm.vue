<template>
  <form class="grid gap-8" @submit.prevent="submitForm">
    <div class="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <section class="form-section">
        <div class="section-heading"><h2>Players</h2><p>Add at least two players sharing this device.</p></div>
        <div v-if="availableRememberedPlayers.length" class="grid gap-2">
          <p class="text-sm text-muted">Choose a saved player</p>
          <div class="flex flex-wrap gap-2">
            <UButton v-for="savedPlayer in availableRememberedPlayers" :key="savedPlayer.id" type="button" color="neutral" variant="soft" @click="addRememberedPlayer(savedPlayer)"><span class="size-2.5 shrink-0 rounded-full" :style="{ background: savedPlayer.color }" />{{ savedPlayer.name }}</UButton>
          </div>
        </div>
        <div class="grid gap-4">
          <div v-for="(player, idx) in playersForm.players" :key="idx" class="flex items-end gap-3">
            <UFormField :label="`Player ${idx + 1}`" class="min-w-0 flex-1"><UInput v-model="player.name" :placeholder="`Player ${idx + 1}`" maxlength="24" class="w-full" @update:model-value="markDirty" /></UFormField>
            <input v-model="player.color" type="color" class="color-input" :aria-label="`Pick color for ${player.name || `Player ${idx + 1}`}`" @input="markDirty">
            <UButton v-if="playersForm.players.length > 2" type="button" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="`Remove player ${idx + 1}`" @click="removePlayerAt(idx)" />
          </div>
        </div>
        <div><UButton color="neutral" variant="soft" type="button" icon="i-lucide-plus" @click="addPlayer">Add Player</UButton></div>
      </section>
      <section class="form-section border-t border-default pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
        <div class="section-heading"><h2>Rules</h2><p>Choose your game and how you want to play.</p></div>
        <div class="grid gap-2">
          <p class="text-sm font-medium">Game mode</p>
          <div class="flex flex-wrap gap-2">
            <UButton type="button" :color="selectedMode === 'x01' ? 'primary' : 'neutral'" :variant="selectedMode === 'x01' ? 'soft' : 'ghost'" :aria-pressed="selectedMode === 'x01'" @click="selectedMode = 'x01'; markDirty()">X01</UButton>
            <UButton type="button" :color="selectedMode === 'atc' ? 'primary' : 'neutral'" :variant="selectedMode === 'atc' ? 'soft' : 'ghost'" :aria-pressed="selectedMode === 'atc'" @click="selectedMode = 'atc'; markDirty()">Around the Clock</UButton>
          </div>
        </div>
        <template v-if="selectedMode === 'x01'">
          <div class="grid gap-5 sm:grid-cols-2">
            <UFormField label="Start score"><USelect v-model="x01Form.startScore" :items="startScoreItems" class="w-full" @update:model-value="markDirty" /></UFormField>
            <UFormField label="Legs to win"><UInputNumber v-model="x01Form.legsTarget" :min="1" :max="11" class="w-full" @update:model-value="markDirty" /></UFormField>
          </div>
          <div class="grid gap-4"><UCheckbox v-model="x01Form.doubleIn" label="Double in" @update:model-value="markDirty" /><UCheckbox v-model="x01Form.doubleOut" label="Double out" @update:model-value="markDirty" /></div>
        </template>
        <UCheckbox v-else v-model="atcForm.fastForward" label="Fast Forward" description="Doubles skip 2 targets, trebles skip 3" @update:model-value="markDirty" />
      </section>
    </div>
    <UAlert v-if="error" color="error" :description="error" />
    <div class="flex flex-wrap items-center justify-between gap-4 border-t border-default pt-6">
      <p class="text-sm text-muted">{{ playersForm.players.length }} players · {{ selectedMode === 'x01' ? 'X01' : 'Around the Clock' }}</p>
      <UButton type="submit" icon="i-lucide-play" class="w-full sm:w-auto">Start Match</UButton>
    </div>
  </form>
</template>

<script setup lang="ts">
// shortcut: use the module namespace until Bun fixes oven-sh/bun#21614.
import * as z from 'zod'
import type { GameMode, GameSettings } from '~~/shared/types/darts'
import type { RecentPlayer } from '~/stores/players'
import { fallbackPlayerColor, normalizePlayerColor } from '~~/shared/utils/playerColors'
import { useAccountStore } from '~/stores/account'
import { usePlayersStore } from '~/stores/players'
import { useSettingsStore } from '~/stores/settings'

const account = useAccountStore()
const settingsStore = useSettingsStore()
const playersStore = usePlayersStore()
const startScoreItems = [301, 501]

const selectedMode = ref<GameMode>('x01')

const x01Form = reactive({
  startScore: settingsStore.settings.startScore,
  doubleIn: settingsStore.settings.doubleIn,
  doubleOut: settingsStore.settings.doubleOut,
  legsTarget: settingsStore.settings.legsTarget
})

const atcForm = reactive({
  fastForward: settingsStore.atcSettings.fastForward
})

const playersForm = reactive({
  players: [
    { name: account.self?.name ?? '', color: account.self?.color ?? fallbackPlayerColor(0) },
    { name: '', color: fallbackPlayerColor(1) }
  ] as Array<{ name: string, color: string }>
})

const x01Schema = z.object({
  mode: z.literal('x01'),
  startScore: z.union([z.literal(301), z.literal(501)]),
  doubleIn: z.boolean(),
  doubleOut: z.boolean(),
  legsTarget: z.number().int().min(1).max(11)
})

const atcSchema = z.object({
  mode: z.literal('atc'),
  fastForward: z.boolean()
})

const playersSchema = z.array(
  z.object({
    name: z.string().trim().min(1).max(24),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
  })
).min(2).refine((players) => {
  const seen = new Set<string>()
  for (const player of players) {
    const key = player.name.trim().toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
  }
  return true
}, {
  message: 'Player names must be unique.'
})

const isDirty = ref(false)
watch(() => account.self, self => {
  if (!self || isDirty.value) return
  playersForm.players[0] = { name: self.name, color: self.color }
}, { immediate: true })

const selectedPlayerNames = computed(() => {
  return new Set(
    playersForm.players
      .map(player => player.name.trim().toLowerCase())
      .filter(Boolean)
  )
})

const availableRememberedPlayers = computed(() => {
  return playersStore.recentPlayers.filter(player => !selectedPlayerNames.value.has(player.name.toLowerCase()))
})

const error = ref('')
const emit = defineEmits<{
  submit: [payload: {
    settings: GameSettings
    players: Array<{ name: string, color: string }>
  }]
}>()

function addPlayer() {
  markDirty()
  playersForm.players.push({
    name: '',
    color: fallbackPlayerColor(playersForm.players.length)
  })
}

function addRememberedPlayer(player: RecentPlayer) {
  const name = player.name
  if (selectedPlayerNames.value.has(name.toLowerCase())) {
    return
  }

  markDirty()

  const placeholderIndex = playersForm.players.findIndex((playerName, idx) => {
    const trimmed = playerName.name.trim()
    return !trimmed || trimmed === `Player ${idx + 1}`
  })

  if (placeholderIndex >= 0) {
    playersForm.players[placeholderIndex]!.name = name
    playersForm.players[placeholderIndex]!.color = normalizePlayerColor(player.color, placeholderIndex)
    return
  }

  playersForm.players.push({
    name,
    color: normalizePlayerColor(player.color, playersForm.players.length)
  })
}

function removePlayerAt(index: number) {
  if (playersForm.players.length <= 2) {
    return
  }

  markDirty()
  playersForm.players.splice(index, 1)
}

function markDirty() {
  isDirty.value = true
}

function submitForm() {
  error.value = ''

  const settingsResult = selectedMode.value === 'x01'
    ? x01Schema.safeParse({ mode: 'x01', ...x01Form })
    : atcSchema.safeParse({ mode: 'atc', ...atcForm })

  if (!settingsResult.success) {
    error.value = settingsResult.error.issues[0]?.message || 'Invalid settings'
    return
  }

  const playersResult = playersSchema.safeParse(
    playersForm.players.map(player => ({
      name: player.name.trim(),
      color: player.color
    }))
  )

  if (!playersResult.success) {
    error.value = playersResult.error.issues[0]?.message || 'Invalid players'
    return
  }

  emit('submit', {
    settings: settingsResult.data as GameSettings,
    players: playersResult.data
  })
}

watch(() => settingsStore.settings, (settings) => {
  if (isDirty.value) {
    return
  }

  x01Form.startScore = settings.startScore
  x01Form.doubleIn = settings.doubleIn
  x01Form.doubleOut = settings.doubleOut
  x01Form.legsTarget = settings.legsTarget
}, { deep: true, immediate: true })

watch(() => settingsStore.atcSettings, (atc) => {
  if (isDirty.value) {
    return
  }

  atcForm.fastForward = atc.fastForward
}, { deep: true, immediate: true })
</script>
