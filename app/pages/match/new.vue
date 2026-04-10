<template>
  <section class="grid gap-4">
    <UPageHeader
      title="New Match"
      description="Pick your game mode, configure the rules, and start scoring."
      headline="Match Setup"
      class="arcade-reveal"
    />

    <UCard v-if="activeMatchId" class="arcade-glow arcade-reveal" :style="{ '--reveal-delay': '80ms' }">
      <template #header>
        <h2 class="m-0 arcade-title text-base">Active Match Found</h2>
      </template>
      <div class="grid gap-4">
        <p class="m-0 text-muted">Starting a new match will replace your current in-progress game.</p>
        <div class="flex flex-wrap gap-2.5">
          <UButton :to="`/match/${activeMatchId}`" color="neutral" variant="soft">Resume Current Match</UButton>
          <UButton color="error" @click="discardCurrentMatch">Discard and Start Fresh</UButton>
        </div>
      </div>
    </UCard>

    <MatchConfigForm class="arcade-reveal" style="--reveal-delay: 140ms;" @submit="onSubmit" />
  </section>
</template>

<script setup lang="ts">
import type { GameSettings } from '~~/shared/types/darts'
import MatchConfigForm from '~/components/setup/MatchConfigForm.vue'
import { useMatchStore } from '~/stores/match'
import { usePlayersStore } from '~/stores/players'
import { useSettingsStore } from '~/stores/settings'

const router = useRouter()
const matchStore = useMatchStore()
const playersStore = usePlayersStore()
const settingsStore = useSettingsStore()

const activeMatchId = computed(() => matchStore.activeMatch?.status === 'in_progress' ? matchStore.activeMatch.id : '')

function discardCurrentMatch() {
  matchStore.clearMatch()
}

function onSubmit(payload: {
  settings: GameSettings
  players: Array<{ name: string, color: string }>
}) {
  const { players, settings } = payload

  if (activeMatchId.value) {
    matchStore.clearMatch()
  }

  if (settings.mode === 'x01') {
    settingsStore.update(settings)
  } else {
    settingsStore.updateAtcSettings(settings)
  }

  const ensuredPlayers = playersStore.ensureMany(players)
  matchStore.startMatch(settings, ensuredPlayers)

  if (matchStore.activeMatch) {
    router.push(`/match/${matchStore.activeMatch.id}`)
  }
}
</script>
