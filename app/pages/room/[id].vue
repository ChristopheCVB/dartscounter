<template>
  <section class="grid gap-4">
    <UPageHeader title="Game room" :description="room ? `Invite code: ${room.code}` : 'Connecting…'" />
    <UButton v-if="store.uncertain" :loading="store.pending" @click="store.retryUncertain">Resolve pending action</UButton>
    <template v-if="room">
      <MatchRulesSummary :settings="room.settings" />
      <UCard>
        <div class="flex flex-wrap items-center gap-3">
          <UBadge :color="store.connected ? 'success' : 'warning'">{{ store.connected ? 'Live' : 'Reconnecting' }}</UBadge>
          <UButton v-if="room.match" :to="`/match/${room.match.id}`">{{ running ? 'Open match' : 'View last match' }}</UButton>
          <UButton v-if="owner && !running" :disabled="disabled" color="neutral" variant="soft" @click="store.act({ type: 'rotate' })">New invite code</UButton>
        </div>
        <p v-if="running" class="mt-3 text-muted">The roster is locked. New arrivals can watch and join the next match. An absent player’s turn waits for their return.</p>
        <div class="mt-4 grid gap-3">
          <div v-for="member in room.members" :key="member.userId" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default p-3">
            <span>{{ member.name }}{{ member.userId === room.ownerId ? ' · owner' : '' }} — {{ member.roster.map(p => p.name).join(', ') || 'Watching' }}</span>
            <UBadge :color="member.ready ? 'success' : 'neutral'">{{ member.ready ? 'Ready' : 'Not ready' }}</UBadge>
            <UButton v-if="owner && !running && member.userId !== account.userId" :disabled="disabled" color="error" variant="soft" @click="store.act({ type: 'kick', userId: member.userId })">Remove</UButton>
          </div>
        </div>
      </UCard>
      <UCard v-if="!running">
        <h2 class="mb-3 font-semibold">Your players</h2>
        <p class="mb-3 text-muted">Select yourself and any friends sharing your device. An empty selection means you are watching.</p>
        <div class="grid gap-2">
          <UCheckbox v-for="player in players.recentPlayers" :key="player.id" :label="player.name" :model-value="selection.includes(player.id)" :disabled="disabled" @update:model-value="toggle(player.id)" />
        </div>
        <form class="mt-4 flex flex-wrap gap-2" @submit.prevent="addGuest">
          <UInput v-model="guestName" placeholder="Guest name" aria-label="Guest name" maxlength="24" :disabled="disabled" required />
          <UButton type="submit" color="neutral" variant="soft" :disabled="disabled" :loading="addingGuest">Add guest</UButton>
        </form>
        <div class="mt-4 flex gap-3">
          <UButton :disabled="disabled" @click="saveRoster">Save roster</UButton>
          <UButton :disabled="disabled || !me?.roster.length || rosterDirty" :color="me?.ready ? 'neutral' : 'success'" @click="store.act({ type: 'ready', ready: !me?.ready })">{{ me?.ready ? 'Not ready' : 'Ready' }}</UButton>
        </div>
      </UCard>
      <UCard v-if="owner && !running">
        <h2 class="mb-3 font-semibold">Match rules</h2>
        <fieldset :disabled="disabled" class="grid gap-4">
          <USelect v-model="mode" :items="[{ label: 'X01', value: 'x01' }, { label: 'Around the Clock', value: 'atc' }]" aria-label="Game mode" />
          <template v-if="mode === 'x01'">
            <UFormField label="Start score"><USelect v-model="x01.startScore" :items="[301, 501]" /></UFormField>
            <UFormField label="Legs to win"><UInputNumber v-model="x01.legsTarget" :min="1" :max="11" /></UFormField>
            <UCheckbox v-model="x01.doubleIn" label="Double in" /><UCheckbox v-model="x01.doubleOut" label="Double out" />
          </template>
          <UCheckbox v-else v-model="fastForward" label="Fast Forward" />
          <UButton @click="saveRules">Save rules</UButton>
          <UButton :disabled="!everyoneReady || rulesDirty" @click="store.act({ type: 'start' })">Start match</UButton>
        </fieldset>
      </UCard>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'
import { useMatchStore } from '~/stores/match'
import { usePlayersStore } from '~/stores/players'

import type { GameMode, GameSettings } from '~~/shared/types/darts'
import { settingsSchema } from '~~/shared/utils/validation'
const route = useRoute()
const store = useMatchStore()
const account = useAccountStore()
const players = usePlayersStore()
const toast = useToast()
watch(() => store.error, error => {
  if (error) toast.add({ id: 'room-error', title: 'Room notification', description: error, color: 'error' })
}, { immediate: true })
const id = String(route.params.id)
const room = computed(() => store.room?.id === id ? store.room : null)
const owner = computed(() => room.value?.ownerId === account.userId)
const running = computed(() => room.value?.match?.status === 'in_progress')
const addingGuest = ref(false)
const disabled = computed(() => !store.connected || store.pending || !!store.uncertain || addingGuest.value)
const me = computed(() => room.value?.members.find(m => m.userId === account.userId))
const selection = ref<string[]>([])
const guestName = ref('')
const mode = ref<GameMode>('x01')
const x01 = reactive({ startScore: 501 as 301 | 501, legsTarget: 1, doubleIn: false, doubleOut: true })
const fastForward = ref(false)
const draftRules = computed<GameSettings>(() => mode.value === 'x01' ? { mode: 'x01', ...x01 } : { mode: 'atc', fastForward: fastForward.value })
const rulesDirty = computed(() => !room.value || JSON.stringify(settingsSchema.parse(draftRules.value)) !== JSON.stringify(settingsSchema.parse(room.value.settings)))
const rosterDirty = computed(() => [...selection.value].sort().join() !== (me.value?.roster.map(p => p.id).sort().join() ?? ''))
const everyoneReady = computed(() => {
  const selected = room.value?.members.filter(m => m.roster.length) ?? []
  return selected.flatMap(m => m.roster).length >= 2 && selected.every(m => m.ready)
})
watch(() => me.value?.roster.map(p => p.id).join(), () => { selection.value = me.value?.roster.map(p => p.id) ?? [] }, { immediate: true })
watch(() => JSON.stringify(room.value?.settings), () => {
  const settings = room.value?.settings
  if (!settings) return
  mode.value = settings.mode
  if (settings.mode === 'x01') Object.assign(x01, settings)
  else fastForward.value = settings.fastForward
}, { immediate: true })
function toggle(id: string) { selection.value = selection.value.includes(id) ? selection.value.filter(p => p !== id) : [...selection.value, id] }
function saveRoster() { return store.act({ type: 'roster', playerIds: selection.value }) }
function saveRules() { return store.act({ type: 'settings', settings: draftRules.value }) }
async function addGuest() {
  if (disabled.value) return
  addingGuest.value = true
  try {
    const result = await players.addRecentPlayer(guestName.value)
    if (!result) return
    selection.value = [...new Set([...selection.value, ...result.selected.map(player => player.id)])]
    if (await saveRoster()) guestName.value = ''
  } finally { addingGuest.value = false }
}
onMounted(async () => { await account.load(); await store.connect(id) })
onBeforeUnmount(() => store.disconnect())
</script>
