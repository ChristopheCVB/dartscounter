<template>
  <UCard>
    <template #header>
      <h2 style="margin: 0;">New X01 Match</h2>
    </template>

    <form class="grid gap-4" @submit.prevent="submitForm">
      <div class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        <div>
          <label class="mb-1.5 block text-sm text-muted">Start score</label>
          <USelect v-model="form.startScore" :items="startScoreItems" @update:model-value="markDirty" />
        </div>

        <div>
          <label class="mb-1.5 block text-sm text-muted">Legs to win</label>
          <UInput v-model.number="form.legsTarget" type="number" min="1" max="11" @update:model-value="markDirty" />
        </div>
      </div>

      <div class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        <UCheckbox v-model="form.doubleIn" label="Double in" @update:model-value="markDirty" />
        <UCheckbox v-model="form.doubleOut" label="Double out" @update:model-value="markDirty" />
      </div>

      <div class="grid gap-4">
        <h3 class="m-0">Players</h3>
        <div v-if="availableRememberedPlayers.length" class="grid gap-2">
          <label class="mb-1.5 block text-sm text-muted">Recent players</label>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="savedPlayer in availableRememberedPlayers"
              :key="savedPlayer.id"
              type="button"
              size="xs"
              color="neutral"
              variant="soft"
              @click="addRememberedPlayer(savedPlayer.name)"
            >
              {{ savedPlayer.name }}
            </UButton>
          </div>
        </div>
        <div v-for="(name, idx) in form.players" :key="idx">
          <label class="mb-1.5 block text-sm text-muted">Player {{ idx + 1 }}</label>
          <UInput v-model="form.players[idx]" type="text" maxlength="24" :placeholder="`Player ${idx + 1}`" @update:model-value="markDirty" />
        </div>
      </div>

      <div class="flex flex-wrap gap-2.5">
        <UButton color="neutral" variant="soft" type="button" :disabled="form.players.length <= 2" @click="removePlayer">Remove</UButton>
        <UButton color="neutral" variant="soft" type="button" @click="addPlayer">Add Player</UButton>
        <UButton type="submit">Start Match</UButton>
      </div>

      <UAlert v-if="error" color="error" :description="error" />
    </form>
  </UCard>
</template>

<script setup lang="ts">
import { z } from 'zod'
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
  players: z.array(z.string().trim().min(1).max(24)).min(2)
})

const form = reactive({
  startScore: settingsStore.settings.startScore,
  doubleIn: settingsStore.settings.doubleIn,
  doubleOut: settingsStore.settings.doubleOut,
  legsTarget: settingsStore.settings.legsTarget,
  players: ['Player 1', 'Player 2']
})

const isDirty = ref(false)

const selectedPlayerNames = computed(() => {
  return new Set(
    form.players
      .map(name => name.trim().toLowerCase())
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
    players: string[]
  }]
}>()

function addPlayer() {
  markDirty()
  form.players.push(`Player ${form.players.length + 1}`)
}

function addRememberedPlayer(name: string) {
  if (selectedPlayerNames.value.has(name.toLowerCase())) {
    return
  }

  markDirty()

  const placeholderIndex = form.players.findIndex((playerName, idx) => {
    const trimmed = playerName.trim()
    return !trimmed || trimmed === `Player ${idx + 1}`
  })

  if (placeholderIndex >= 0) {
    form.players[placeholderIndex] = name
    return
  }

  form.players.push(name)
}

function removePlayer() {
  markDirty()
  if (form.players.length > 2) {
    form.players.pop()
  }
}

function markDirty() {
  isDirty.value = true
}

function submitForm() {
  error.value = ''
  const parsed = schema.safeParse({
    ...form,
    players: form.players.map(name => name.trim())
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
