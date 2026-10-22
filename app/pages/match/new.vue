<template>
  <section class="page-stack">
    <header class="page-heading"><h1>New match</h1><p>Choose your players and rules, then start scoring.</p></header>

    <div v-if="account.currentRoom" class="grid gap-4 rounded-xl border border-default p-5">
      <div class="section-heading"><h2>You’re already in a room</h2><p>Play another match there, or leave before starting a new room.</p></div>
      <div class="flex flex-wrap gap-3">
        <UButton :to="`/room/${account.currentRoom.id}`">Return to room</UButton>
        <UButton v-if="account.currentRoom.match?.status === 'in_progress'" :to="`/match/${account.currentRoom.match.id}`">Open match</UButton>
        <RoomLeaveButton :room="account.currentRoom" />
      </div>
    </div>

    <UAlert v-if="matchStore.error" color="error" :title="matchStore.error" />
    <UButton v-if="matchStore.uncertain" @click="matchStore.retryUncertain">Resolve pending action</UButton>
    <fieldset :disabled="busy || !!account.currentRoom || !account.loaded"><MatchConfigForm @submit="onSubmit" /></fieldset>
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
onMounted(() => account.load())
onBeforeUnmount(() => matchStore.disconnect())

async function onSubmit(payload: {
  settings: GameSettings
  players: Array<{ name: string, color: string }>
}) {
  const { players, settings } = payload

  if (busy.value || account.currentRoom) return
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
