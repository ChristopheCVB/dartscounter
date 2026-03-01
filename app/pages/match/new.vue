<template>
  <section class="grid gap-4">
    <UPageHeader
      title="New Match"
      description="Set your X01 rules, pick players, and start scoring."
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
  players: Array<{ name: string, color: string }>
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

  const recentPlayerIds = players.map(player => nameToId.get(player.name.trim().toLowerCase()))
  matchStore.startMatch(settings, players, recentPlayerIds)

  if (matchStore.activeMatch) {
    router.push(`/match/${matchStore.activeMatch.id}`)
  }
}
</script>
