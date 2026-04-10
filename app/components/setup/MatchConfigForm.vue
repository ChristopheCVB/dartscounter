<template>
  <UCard class="arcade-glow">
    <template #header>
      <h2 class="m-0 arcade-title text-base">New Match</h2>
    </template>

    <form class="grid gap-5" @submit.prevent="submitForm">
      <div class="grid gap-2">
        <p class="m-0 text-sm text-muted">Game mode</p>
        <div class="flex gap-2">
          <UButton
            type="button"
            :color="selectedMode === 'x01' ? 'primary' : 'neutral'"
            :variant="selectedMode === 'x01' ? 'solid' : 'soft'"
            @click="selectedMode = 'x01'"
          >X01</UButton>
          <UButton
            type="button"
            :color="selectedMode === 'atc' ? 'primary' : 'neutral'"
            :variant="selectedMode === 'atc' ? 'solid' : 'soft'"
            @click="selectedMode = 'atc'"
          >Around the Clock</UButton>
        </div>
      </div>

      <template v-if="selectedMode === 'x01'">
        <div class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
          <UFormField label="Start score">
            <USelect v-model="x01Form.startScore" :items="startScoreItems" @update:model-value="markDirty" />
          </UFormField>

          <UFormField label="Legs to win">
            <UInputNumber v-model="x01Form.legsTarget" :min="1" :max="11" @update:model-value="markDirty" />
          </UFormField>
        </div>

        <div class="grid gap-4 rounded-xl border border-default p-4 sm:grid-cols-2">
          <UCheckbox v-model="x01Form.doubleIn" label="Double in" @update:model-value="markDirty" />
          <UCheckbox v-model="x01Form.doubleOut" label="Double out" @update:model-value="markDirty" />
        </div>
      </template>

      <template v-else>
        <div class="rounded-xl border border-default p-4">
          <UCheckbox
            v-model="atcForm.fastForward"
            label="Fast Forward"
            description="Doubles skip 2 targets, trebles skip 3"
            @update:model-value="markDirty"
          />
        </div>
      </template>

      <div class="grid gap-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="m-0 arcade-title text-sm">Players</h3>
          <UBadge color="warning" variant="soft">{{ playersForm.players.length }} active</UBadge>
        </div>

        <div v-if="availableRememberedPlayers.length" class="grid gap-2 rounded-xl border border-default p-3">
          <p class="m-0 text-sm text-muted">Recent players</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="savedPlayer in availableRememberedPlayers"
              :key="savedPlayer.id"
              type="button"
              size="xs"
              color="neutral"
              variant="soft"
              @click="addRememberedPlayer(savedPlayer)"
            >
              <span class="inline-flex items-center gap-1.5">
                <span class="recent-player-dot" :style="{ background: savedPlayer.color }" />
                {{ savedPlayer.name }}
              </span>
            </UButton>
          </div>
        </div>

        <div class="player-grid">
          <div v-for="(player, idx) in playersForm.players" :key="idx" class="player-tile">
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="m-0 text-xs uppercase tracking-[0.08em] text-muted">Player {{ idx + 1 }}</p>
              <UButton
                v-if="playersForm.players.length > 2"
                type="button"
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                @click="removePlayerAt(idx)"
              />
            </div>

            <UInput
              v-model="playersForm.players[idx]!.name"
              type="text"
              maxlength="24"
              :placeholder="`Player ${idx + 1}`"
              @update:model-value="markDirty"
            />

            <div class="mt-3 flex items-center gap-2">
              <span class="text-xs text-muted">Color</span>
              <input
                v-model="playersForm.players[idx]!.color"
                type="color"
                class="color-picker"
                :aria-label="`Pick color for ${player.name || `Player ${idx + 1}`}`"
                @input="markDirty"
              >
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2.5">
        <UButton color="neutral" variant="soft" type="button" @click="addPlayer">Add Player</UButton>
        <UButton type="submit">Start Match</UButton>
      </div>

      <UAlert v-if="error" color="error" :description="error" />
    </form>
  </UCard>
</template>

<script setup lang="ts">
import { z } from 'zod'
import type { GameMode, GameSettings } from '~~/shared/types/darts'
import type { RecentPlayer } from '~/stores/players'
import { fallbackPlayerColor, normalizePlayerColor } from '~/constants/playerColors'
import { usePlayersStore } from '~/stores/players'
import { useSettingsStore } from '~/stores/settings'

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
    { name: 'Player 1', color: fallbackPlayerColor(0) },
    { name: 'Player 2', color: fallbackPlayerColor(1) }
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
    name: `Player ${playersForm.players.length + 1}`,
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

<style scoped>
.player-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .player-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .player-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .player-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.player-tile {
  border: 1px solid color-mix(in srgb, var(--ui-primary) 20%, var(--ui-border));
  border-radius: 0.9rem;
  padding: 0.65rem;
  background: color-mix(in srgb, var(--ui-bg) 90%, transparent);
}

.recent-player-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--ui-bg) 65%, transparent);
}

.color-picker {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ui-border) 65%, transparent);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}
</style>
