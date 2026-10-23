<template>
  <section class="page-stack">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="page-heading"><h1>Game room</h1><p>Get everyone together, choose your rules, and play.</p></div>
      <UButton to="/" icon="i-lucide-arrow-left" color="neutral" variant="ghost">Back to Play</UButton>
    </header>
    <div class="flex flex-wrap items-center justify-between gap-4 border-y border-default py-4">
      <div class="flex flex-wrap items-center gap-3">
        <UBadge :color="store.connected ? 'success' : 'warning'" variant="soft">{{ store.connected ? 'Live' : 'Reconnecting' }}</UBadge>
        <template v-if="room"><span class="font-mono text-lg font-semibold tracking-widest">{{ room.code }}</span><UButton icon="i-lucide-copy" aria-label="Copy invite code" color="neutral" variant="ghost" @click="copyCode" /></template>
      </div>
      <div class="flex items-center gap-2">
        <UButton v-if="room?.match" :to="`/match/${room.match.id}`">{{ running ? 'Open match' : 'View last match' }}</UButton>
        <RoomLeaveButton v-if="room" :room="room" />
        <UDropdownMenu v-if="owner" :items="roomOptions"><UButton icon="i-lucide-ellipsis" aria-label="Room options" color="neutral" variant="ghost" :disabled="disabled" /></UDropdownMenu>
      </div>
    </div>
    <div v-if="store.uncertain" class="flex flex-wrap items-center gap-3" role="status"><p class="text-sm text-muted">An action needs confirmation before you continue.</p><UButton :loading="store.pending" @click="store.retryUncertain">Resolve pending action</UButton></div>
    <UAlert v-if="account.error" color="error" :title="account.error" />
    <template v-if="room">
      <section v-if="!running" aria-label="Match readiness" class="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-elevated p-5">
        <div class="min-w-0 flex-1" role="status"><h2 class="font-semibold">{{ everyoneReady && !startReason ? 'Ready to play' : 'Getting ready' }}</h2><p class="mt-1 text-sm text-muted">{{ owner ? startReason || 'Everyone is ready. Start when you are.' : 'The room owner starts the match once every participating account is ready.' }}</p></div>
        <div class="flex flex-wrap gap-3">
          <UButton :disabled="disabled || !!readyReason" :color="me?.ready ? 'neutral' : 'primary'" :variant="me?.ready ? 'soft' : 'solid'" @click="store.act({ type: 'ready', ready: !me?.ready })">{{ me?.ready ? 'Not ready' : 'Ready' }}</UButton>
          <UButton v-if="owner" :disabled="disabled || !!startReason" @click="store.act({ type: 'start' })">Start match</UButton>
        </div>
      </section>
      <p v-else class="text-sm text-muted">The roster is locked while this match is running. New arrivals watch and join the next match. If a participating account leaves or times out, this unfinished match ends without a winner.</p>
      <p class="text-sm text-muted">Leaving this lobby or the match page starts a five-minute reconnect window. After everyone leaves, the room is deleted and finished results stay in History.</p>
      <div class="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
        <div class="grid min-w-0 gap-8">
          <section class="form-section">
            <div class="section-heading"><h2>Who’s here</h2><p>Each account controls its own players on its device.</p></div>
            <div class="divide-y divide-default">
              <div v-for="member in room.members" :key="member.userId" class="flex min-w-0 items-center gap-3 py-4 first:pt-0">
                <div class="min-w-0 flex-1"><p class="break-words font-medium">{{ member.name }}<span v-if="member.userId === room.ownerId" class="text-sm text-muted"> · owner</span></p><p class="mt-1 break-words text-sm text-muted">{{ member.roster.map(player => player.name).join(', ') || 'Watching' }}</p><RoomPresence :member="member" class="text-xs" /></div>
                <UBadge :color="member.ready ? 'success' : 'neutral'" variant="soft">{{ !member.roster.length ? 'Watching' : member.ready ? 'Ready' : 'Not ready' }}</UBadge>
                <UDropdownMenu v-if="owner && !running && member.userId !== account.userId" :items="[{ label: 'Remove member', color: 'error', onSelect: () => { confirmation = { type: 'kick', userId: member.userId } } }]"><UButton icon="i-lucide-ellipsis" :aria-label="`Options for ${member.name}`" color="neutral" variant="ghost" :disabled="disabled" /></UDropdownMenu>
              </div>
            </div>
          </section>
          <section v-if="!running" class="form-section border-t border-default pt-8">
            <div class="section-heading"><h2>Your players</h2><p>Select anyone sharing this device. Leave everyone unchecked to watch.</p></div>
            <div class="grid gap-4"><UCheckbox v-for="player in players.recentPlayers" :key="player.id" :label="player.name" :model-value="selection.includes(player.id)" :disabled="disabled" @update:model-value="toggle(player.id)" /></div>
            <form class="flex items-end gap-3" @submit.prevent="addGuest"><UFormField label="Add a guest" class="min-w-0 flex-1"><UInput v-model="guestName" placeholder="Guest name" aria-label="Guest name" maxlength="24" class="w-full" :disabled="disabled" required /></UFormField><UButton type="submit" color="neutral" variant="soft" :disabled="disabled" :loading="addingGuest">Add guest</UButton></form>
            <div class="flex flex-wrap items-center gap-3"><UButton :disabled="disabled || !rosterDirty" color="neutral" variant="soft" @click="saveRoster">Save roster</UButton><span v-if="rosterDirty" class="text-sm text-warning" role="status">Unsaved player selection</span></div>
            <p v-if="readyReason" class="text-sm text-muted">{{ readyReason }}</p>
          </section>
        </div>
        <div class="grid min-w-0 gap-8 border-t border-default pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
          <MatchRulesSummary :settings="room.settings" embedded />
          <section v-if="owner && !running" class="form-section border-t border-default pt-8">
            <div class="section-heading"><h2>Edit rules</h2><p>Saving changes clears everyone’s readiness.</p></div>
            <fieldset :disabled="disabled" class="form-fields">
              <UFormField label="Game mode"><USelect v-model="mode" :items="[{ label: 'X01', value: 'x01' }, { label: 'Around the Clock', value: 'atc' }]" aria-label="Game mode" class="w-full" /></UFormField>
              <template v-if="mode === 'x01'">
                <div class="grid gap-5 sm:grid-cols-2"><UFormField label="Start score"><USelect v-model="x01.startScore" :items="[301, 501]" class="w-full" /></UFormField><UFormField label="Legs to win"><UInputNumber v-model="x01.legsTarget" :min="1" :max="11" class="w-full" /></UFormField></div>
                <UCheckbox v-model="x01.doubleIn" label="Double in" /><UCheckbox v-model="x01.doubleOut" label="Double out" />
              </template>
              <UCheckbox v-else v-model="fastForward" label="Fast Forward" description="Doubles skip 2 targets, trebles skip 3" />
              <div class="flex flex-wrap items-center gap-3"><UButton :disabled="!rulesDirty || !validatedRules.success" color="neutral" variant="soft" @click="saveRules">Save rules</UButton><span v-if="rulesDirty" class="text-sm text-warning" role="status">Unsaved rule changes</span></div>
            </fieldset>
          </section>
        </div>
      </div>
    </template>
    <div v-else class="grid gap-3 py-8 text-muted" role="status"><p>{{ store.error || 'Connecting to your room…' }}</p><div class="flex gap-3"><UButton to="/" color="neutral" variant="soft">Return to Play</UButton><UButton to="/history" color="neutral" variant="ghost">History</UButton></div></div>
    <UModal v-model:open="confirmOpen" class="app-shell" :title="confirmationTitle" :description="confirmationDescription" :dismissible="!store.pending" :close="!store.pending">
      <template #footer><UButton color="neutral" variant="soft" :disabled="store.pending" @click="confirmation = null">Cancel</UButton><UButton :color="confirmation?.type === 'rotate' ? 'primary' : 'error'" :disabled="disabled" :loading="store.pending" @click="confirmAction">{{ confirmation?.type === 'rotate' ? 'New invite code' : confirmation?.type === 'kick' ? 'Remove member' : 'Abandon match' }}</UButton></template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'
import { useMatchStore } from '~/stores/match'
import { usePlayersStore } from '~/stores/players'

import type { RoomAction } from '~~/shared/utils/validation'
import type { GameMode, GameSettings } from '~~/shared/types/darts'
import { settingsSchema } from '~~/shared/utils/validation'

definePageMeta({
  title: 'Game room',
  description: 'Gather your darts players, choose match rules, and get ready to play together.'
})

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
watch(running, started => { if (started) void navigateTo(`/match/${room.value!.match!.id}`) })
const addingGuest = ref(false)
const disabled = computed(() => !store.connected || store.pending || !!store.uncertain || addingGuest.value)
const me = computed(() => room.value?.members.find(m => m.userId === account.userId))
const selection = ref<string[]>([])
const guestName = ref('')
const mode = ref<GameMode>('x01')
const x01 = reactive({ startScore: 501 as 301 | 501, legsTarget: 1, doubleIn: false, doubleOut: true })
const fastForward = ref(false)
const draftRules = computed<GameSettings>(() => mode.value === 'x01' ? { mode: 'x01', ...x01 } : { mode: 'atc', fastForward: fastForward.value })
const validatedRules = computed(() => settingsSchema.safeParse(draftRules.value))
const rulesDirty = computed(() => !room.value || !validatedRules.value.success || JSON.stringify(validatedRules.value.data) !== JSON.stringify(settingsSchema.parse(room.value.settings)))
const rosterDirty = computed(() => [...selection.value].sort().join() !== (me.value?.roster.map(p => p.id).sort().join() ?? ''))
const everyoneReady = computed(() => {
  const selected = room.value?.members.filter(m => m.roster.length) ?? []
  return selected.flatMap(m => m.roster).length >= 2 && selected.every(m => m.ready)
})
const startReason = computed(() => {
  if (!store.connected) return 'Waiting for the connection to return.'
  if (store.uncertain) return 'Resolve the pending action before continuing.'
  if (store.pending || addingGuest.value) return 'Saving changes…'
  if (!validatedRules.value.success) return 'Choose valid match rules before starting.'
  if (rulesDirty.value) return 'Save your rule changes before starting.'
  if (rosterDirty.value) return 'Save your player selection before starting.'
  const participants = room.value?.members.filter(member => member.roster.length) ?? []
  if (participants.some(member => !member.connected)) return 'Wait for selected players to reconnect or leave before starting.'
  if (participants.flatMap(member => member.roster).length < 2) return 'Select at least two players to start a match.'
  const waiting = participants.filter(member => !member.ready).map(member => member.name)
  return waiting.length ? `Waiting for ${waiting.join(', ')} to mark Ready.` : ''
})
const readyReason = computed(() => rosterDirty.value ? 'Save your player selection before marking Ready.' : !me.value?.roster.length ? 'Select players to join in, or leave the selection empty to watch.' : owner.value && rulesDirty.value ? 'Save your rule changes before marking Ready.' : '')
const confirmation = ref<RoomAction | null>(null)
const confirmOpen = computed({ get: () => confirmation.value !== null, set: open => { if (!open) confirmation.value = null } })
const confirmationTitle = computed(() => confirmation.value?.type === 'kick' ? 'Remove this member?' : confirmation.value?.type === 'abandon' ? 'Abandon this match?' : 'Replace the invite code?')
const confirmationDescription = computed(() => confirmation.value?.type === 'kick' ? 'They will lose access to this room. They can join again with the invite code.' : confirmation.value?.type === 'abandon' ? 'The match will end without a winner or completed statistics.' : 'The current invite code will stop working. Existing members will stay in the room.')
const roomOptions = computed(() => owner.value ? running.value
  ? [{ label: 'Abandon match', color: 'error' as const, onSelect: () => { confirmation.value = { type: 'abandon' } } }]
  : [{ label: 'New invite code', onSelect: () => { confirmation.value = { type: 'rotate' } } }] : [])
async function confirmAction() {
  if (!confirmation.value || disabled.value) return
  if (await store.act(confirmation.value)) confirmation.value = null
}
async function copyCode() {
  if (!room.value) return
  try { await navigator.clipboard.writeText(room.value.code); toast.add({ title: 'Invite code copied', color: 'success' }) }
  catch { toast.add({ title: 'Could not copy the code', description: 'Select the invite code and copy it manually.', color: 'error' }) }
}
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
function saveRules() { if (validatedRules.value.success) return store.act({ type: 'settings', settings: validatedRules.value.data }) }
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
onMounted(async () => {
  await account.load()
  await store.connect(id)
  try { await store.refresh(id) }
  catch {
    store.reset()
    store.error = 'This room is no longer available. Finished results are kept in History.'
  }
})
onBeforeUnmount(() => store.disconnect())
</script>
