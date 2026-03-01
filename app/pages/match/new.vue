<template>
  <section class="grid gap-4">
    <UCard v-if="activeMatchId">
      <template #header>
        <h2 class="m-0">Active Match Found</h2>
      </template>
      <div class="grid gap-4">
        <p class="m-0 text-muted">Starting a new match will replace your current in-progress game.</p>
        <div class="flex flex-wrap gap-2.5">
          <UButton :to="`/match/${activeMatchId}`" color="neutral" variant="soft">Resume Current Match</UButton>
          <UButton color="error" @click="discardCurrentMatch">Discard and Start Fresh</UButton>
        </div>
      </div>
    </UCard>

    <MatchConfigForm @submit="onSubmit" />
  </section>
</template>

<script setup lang="ts">
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
  startScore: 301 | 501
  doubleIn: boolean
  doubleOut: boolean
  legsTarget: number
  players: string[]
}) {
  const { players, ...settings } = payload

  if (activeMatchId.value) {
    matchStore.clearMatch()
  }

  settingsStore.update(settings)
  playersStore.rememberMany(players)

  const nameToId = new Map(
    playersStore.recentPlayers.map(player => [player.name.trim().toLowerCase(), player.id])
  )

  const recentPlayerIds = players.map(name => nameToId.get(name.trim().toLowerCase()))
  matchStore.startMatch(settings, players, recentPlayerIds)

  if (matchStore.activeMatch) {
    router.push(`/match/${matchStore.activeMatch.id}`)
  }
}
</script>
