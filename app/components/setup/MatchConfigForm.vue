<template>
  <UCard class="arcade-glow">
    <template #header>
      <h2 class="m-0 arcade-title text-base">New X01 Match</h2>
    </template>

    <form class="grid gap-5" @submit.prevent="submitForm">
      <div class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        <UFormField label="Start score">
          <USelect v-model="form.startScore" :items="startScoreItems" @update:model-value="markDirty" />
        </UFormField>

        <UFormField label="Legs to win">
          <UInputNumber v-model="form.legsTarget" :min="1" :max="11" @update:model-value="markDirty" />
        </UFormField>
      </div>

      <div class="grid gap-4 rounded-xl border border-default p-4 sm:grid-cols-2">
        <UCheckbox v-model="form.doubleIn" label="Double in" @update:model-value="markDirty" />
        <UCheckbox v-model="form.doubleOut" label="Double out" @update:model-value="markDirty" />
      </div>

      <div class="grid gap-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="m-0 arcade-title text-sm">Players</h3>
          <UBadge color="warning" variant="soft">{{ form.players.length }} active</UBadge>
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
          <div v-for="(player, idx) in form.players" :key="idx" class="player-tile">
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="m-0 text-xs uppercase tracking-[0.08em] text-muted">Player {{ idx + 1 }}</p>
              <UButton
                v-if="form.players.length > 2"
                type="button"
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                @click="removePlayerAt(idx)"
              />
            </div>

            <UInput
              v-model="form.players[idx]!.name"
              type="text"
              maxlength="24"
              :placeholder="`Player ${idx + 1}`"
              @update:model-value="markDirty"
            />

            <div class="mt-3 flex items-center gap-2">
              <span class="text-xs text-muted">Color</span>
              <input
                v-model="form.players[idx]!.color"
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
import type { RecentPlayer } from '~/stores/players'
import { fallbackPlayerColor, normalizePlayerColor } from '~/constants/playerColors'
import { usePlayersStore } from '~/stores/players'
import { useSettingsStore } from '~/stores/settings'

const settingsStore = useSettingsStore()
const playersStore = usePlayersStore()
const startScoreItems = [301, 501]

const schema = z.object({
  startScore: z.union([z.literal(301), z.literal(501)]),
  doubleIn: z.boolean(),
  doubleOut: z.boolean(),
  legsTarget: z.number().int().min(1).max(11),
  players: z.array(
    z.object({
      name: z.string().trim().min(1).max(24),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
    })
  ).min(2)
})

const form = reactive({
  startScore: settingsStore.settings.startScore,
  doubleIn: settingsStore.settings.doubleIn,
  doubleOut: settingsStore.settings.doubleOut,
  legsTarget: settingsStore.settings.legsTarget,
  players: [
    { name: 'Player 1', color: fallbackPlayerColor(0) },
    { name: 'Player 2', color: fallbackPlayerColor(1) }
  ]
})

const isDirty = ref(false)

const selectedPlayerNames = computed(() => {
  return new Set(
    form.players
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
    startScore: 301 | 501
    doubleIn: boolean
    doubleOut: boolean
    legsTarget: number
    players: Array<{ name: string, color: string }>
  }]
}>()

function addPlayer() {
  markDirty()
  form.players.push({
    name: `Player ${form.players.length + 1}`,
    color: fallbackPlayerColor(form.players.length)
  })
}

function addRememberedPlayer(player: RecentPlayer) {
  const name = player.name
  if (selectedPlayerNames.value.has(name.toLowerCase())) {
    return
  }

  markDirty()

  const placeholderIndex = form.players.findIndex((playerName, idx) => {
    const trimmed = playerName.name.trim()
    return !trimmed || trimmed === `Player ${idx + 1}`
  })

  if (placeholderIndex >= 0) {
    form.players[placeholderIndex]!.name = name
    form.players[placeholderIndex]!.color = normalizePlayerColor(player.color, placeholderIndex)
    return
  }

  form.players.push({
    name,
    color: normalizePlayerColor(player.color, form.players.length)
  })
}

function removePlayerAt(index: number) {
  if (form.players.length <= 2) {
    return
  }

  markDirty()
  form.players.splice(index, 1)
}

function markDirty() {
  isDirty.value = true
}

function submitForm() {
  error.value = ''
  const parsed = schema.safeParse({
    ...form,
    players: form.players.map(player => ({
      name: player.name.trim(),
      color: player.color
    }))
  })

  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message || 'Invalid setup'
    return
  }

  emit('submit', parsed.data)
}

watch(() => settingsStore.settings, (settings) => {
  if (isDirty.value) {
    return
  }

  form.startScore = settings.startScore
  form.doubleIn = settings.doubleIn
  form.doubleOut = settings.doubleOut
  form.legsTarget = settings.legsTarget
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
