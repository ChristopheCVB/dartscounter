<template>
  <section class="page-stack">
    <header class="page-heading"><h1>New match</h1><p>Choose your players and rules, then start scoring.</p></header>

    <div v-if="activeMatchId" class="grid gap-4 rounded-xl border border-default p-5">
      <div class="section-heading"><h2>You have a match in progress</h2><p>Finish or abandon your match in room {{ account.activeRoom?.code }} before starting another.</p></div>
      <div class="flex flex-wrap gap-3">
        <UButton :to="`/match/${activeMatchId}`">Resume Current Match</UButton>
        <UDropdownMenu v-if="account.activeRoom?.ownerId === account.userId" :items="[{ label: 'Abandon match', color: 'error', onSelect: () => { confirmAbandon = true } }]"><UButton icon="i-lucide-ellipsis" aria-label="Match options" color="neutral" variant="ghost" /></UDropdownMenu>
      </div>
    </div>
    <UModal v-model:open="confirmAbandon" class="app-shell" :dismissible="!matchStore.pending" :close="!matchStore.pending" title="Abandon this match?" description="This match will end without a winner or completed statistics.">
      <template #footer><UButton color="neutral" variant="soft" :disabled="matchStore.pending" @click="confirmAbandon = false">Cancel</UButton><UButton color="error" :loading="matchStore.pending" @click="discardCurrentMatch">Abandon match</UButton></template>
    </UModal>

    <UAlert v-if="matchStore.error" color="error" :title="matchStore.error" />
    <UButton v-if="matchStore.uncertain" @click="matchStore.retryUncertain">Resolve pending action</UButton>
    <fieldset :disabled="busy || !!activeMatchId || !account.loaded"><MatchConfigForm @submit="onSubmit" /></fieldset>
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
const confirmAbandon = ref(false)
onMounted(async () => {
  await account.load()
  if (account.activeRoom) await matchStore.connect(account.activeRoom.id)
})
onBeforeUnmount(() => matchStore.disconnect())

const activeMatchId = computed(() => account.activeRoom?.match?.id ?? '')

async function discardCurrentMatch() {
  if (await matchStore.clearMatch()) confirmAbandon.value = false
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
