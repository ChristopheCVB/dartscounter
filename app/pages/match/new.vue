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
        <p class="m-0 text-muted">Finish or abandon your active match before starting another.</p>
        <div class="flex flex-wrap gap-2.5">
          <UButton :to="`/match/${activeMatchId}`" color="neutral" variant="soft">Resume Current Match</UButton>
          <UButton v-if="matchStore.room?.ownerId === account.userId" color="error" @click="discardCurrentMatch">Discard and Start Fresh</UButton>
        </div>
      </div>
    </UCard>

    <UAlert v-if="matchStore.error" color="error" :title="matchStore.error" />
    <UButton v-if="matchStore.uncertain" @click="matchStore.retryUncertain">Resolve pending action</UButton>
    <fieldset :disabled="busy || !!activeMatchId || !account.loaded"><MatchConfigForm class="arcade-reveal" style="--reveal-delay: 140ms;" @submit="onSubmit" /></fieldset>
  </section>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'

import type { GameSettings } from '~~/shared/types/darts'
import MatchConfigForm from '~/components/setup/MatchConfigForm.vue'
import { useMatchStore } from '~/stores/match'
import { usePlayersStore } from '~/stores/players'
import { useSettingsStore } from '~/stores/settings'

const router = useRouter()
const matchStore = useMatchStore()
const playersStore = usePlayersStore()
const settingsStore = useSettingsStore()
const account = useAccountStore()
const busy = ref(false)
onMounted(async () => {
  await account.load()
  if (matchStore.room && activeMatchId.value) await matchStore.connect(matchStore.room.id)
})
onBeforeUnmount(() => matchStore.disconnect())

const activeMatchId = computed(() => matchStore.activeMatch?.status === 'in_progress' ? matchStore.activeMatch.id : '')

async function discardCurrentMatch() {
  if (window.confirm('Discard the active match without a winner?')) await matchStore.clearMatch()
}

async function onSubmit(payload: {
  settings: GameSettings
  players: Array<{ name: string, color: string }>
}) {
  const { players, settings } = payload

  if (busy.value || activeMatchId.value) return
  busy.value = true
  try {
    const saved = settings.mode === 'x01' ? await settingsStore.update(settings) : await settingsStore.updateAtcSettings(settings)
    if (!saved) return
    const ensuredPlayers = await playersStore.ensureMany(players)
    if (ensuredPlayers.length !== players.length) return
    if (await matchStore.startMatch(settings, ensuredPlayers)) await router.push(`/match/${matchStore.activeMatch!.id}`)
    else if (matchStore.room) await router.push(`/room/${matchStore.room.id}`)
  } finally { busy.value = false }
}
</script>
