<template>
  <section class="page-stack">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="page-heading"><h1>Players</h1><p>Your people, their colors, and every game together.</p></div>
      <div class="flex gap-2">
        <UButton icon="i-lucide-plus" :disabled="!account.loaded || pending" @click="openEditor()">Add player</UButton>
        <UDropdownMenu v-if="hasGuests" :items="[{ label: 'Clear guest players', color: 'error', onSelect: () => { removal = 'all' } }]"><UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" aria-label="Player options" :disabled="pending" /></UDropdownMenu>
      </div>
    </header>
    <UAlert v-if="account.error || statsError" color="error" :title="account.error || 'Statistics could not load. Try again.'" />
    <div class="flex flex-wrap gap-2" aria-label="Statistics game mode">
      <UButton v-for="item in modes" :key="item.value" :aria-pressed="mode === item.value" :color="mode === item.value ? 'primary' : 'neutral'" :variant="mode === item.value ? 'soft' : 'ghost'" @click="mode = item.value">{{ item.label }}</UButton>
    </div>
    <UTable :data="rows" :columns="columns" :loading="statsStatus === 'pending'" class="hidden md:block">
      <template #name-cell="{ row }">
        <span class="inline-flex items-center gap-3"><span class="size-3 shrink-0 rounded-full" :style="{ background: row.original.color }" /><span class="font-medium text-highlighted">{{ row.original.name }}</span><UBadge v-if="row.original.id === account.self?.id" color="neutral" variant="soft">You</UBadge></span>
      </template>
      <template #actions-cell="{ row }"><UDropdownMenu :items="playerActions(row.original)"><UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" :aria-label="`Options for ${row.original.name}`" :disabled="pending" /></UDropdownMenu></template>
    </UTable>
    <div class="divide-y divide-default md:hidden">
      <div v-for="player in rows" :key="player.id" class="grid gap-3 py-5 first:pt-0">
        <div class="flex min-w-0 items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3"><span class="size-3 shrink-0 rounded-full" :style="{ background: player.color }" /><span class="break-words font-semibold">{{ player.name }}</span><UBadge v-if="player.id === account.self?.id" color="neutral" variant="soft">You</UBadge></div>
          <UDropdownMenu :items="playerActions(player)"><UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" :aria-label="`Options for ${player.name}`" :disabled="pending" /></UDropdownMenu>
        </div>
        <dl class="grid grid-cols-3 gap-3 text-sm"><div><dt class="text-muted">Matches</dt><dd class="mt-1 font-medium">{{ player.matches }}</dd></div><div><dt class="text-muted">Wins</dt><dd class="mt-1 font-medium">{{ player.wins }}</dd></div><div><dt class="text-muted">{{ mode === 'x01' ? '3-dart avg' : 'Hit rate' }}</dt><dd class="mt-1 font-medium">{{ player.average }}</dd></div></dl>
        <details><summary class="cursor-pointer py-2 text-sm text-muted">More statistics</summary><dl class="mt-2 grid grid-cols-2 gap-3 text-sm"><div><dt class="text-muted">Total darts</dt><dd>{{ player.dartsThrown }}</dd></div><div><dt class="text-muted">Last played</dt><dd>{{ player.lastPlayed }}</dd></div></dl></details>
      </div>
    </div>
    <p v-if="account.loaded && !rows.length" class="text-muted">Add a player to get started.</p>
    <UModal v-model:open="editorOpen" class="app-shell" :title="editing ? 'Edit player' : 'Add player'" description="Names and colors identify players. Past match results keep their original names and colors." :dismissible="!pending" :close="!pending">
      <template #body>
        <UForm :schema="playerSchema" :state="draft" class="form-fields" @submit="savePlayer">
          <UFormField label="Name" name="name" required><UInput v-model="draft.name" placeholder="Player name" maxlength="24" class="w-full" autofocus :disabled="pending" /></UFormField>
          <UFormField label="Color" name="color" required><input v-model="draft.color" type="color" class="color-input" aria-label="Player color" :disabled="pending"></UFormField>
          <div class="flex justify-end gap-3"><UButton type="button" color="neutral" variant="soft" :disabled="pending" @click="editorOpen = false">Cancel</UButton><UButton type="submit" :loading="pending">{{ editing ? 'Save player' : 'Add player' }}</UButton></div>
        </UForm>
      </template>
    </UModal>
    <UModal v-model:open="confirmOpen" class="app-shell" :title="removal === 'all' ? 'Clear guest players?' : 'Remove this player?'" description="Players will be removed from your saved list and waiting-room rosters. Running matches can finish, and past results are kept. Your own player cannot be removed." :dismissible="!pending" :close="!pending">
      <template #footer><UButton color="neutral" variant="soft" :disabled="pending" @click="removal = null">Cancel</UButton><UButton color="error" :loading="pending" @click="removePlayers">{{ removal === 'all' ? 'Clear guest players' : 'Remove player' }}</UButton></template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import type { GameMode, PlayerIdentity } from '~~/shared/types/darts'
import type { AggregatedPlayerStats } from '~~/shared/utils/playerStats'
import { playerSchema } from '~~/shared/utils/validation'
import { fallbackPlayerColor } from '~~/shared/utils/playerColors'
import { useAccountStore } from '~/stores/account'
import { usePlayersStore } from '~/stores/players'
const account = useAccountStore()
const players = usePlayersStore()
const toast = useToast()
const mode = ref<GameMode>('x01')
const modes = [{ label: 'X01', value: 'x01' as const }, { label: 'Around the Clock', value: 'atc' as const }]
const { data: stats, error: statsError, status: statsStatus, refresh } = await useFetch<AggregatedPlayerStats[]>('/api/stats', { query: { mode } })
const rows = computed(() => {
  const byId = new Map((stats.value ?? []).map(row => [row.id, row]))
  return players.recentPlayers.map(player => {
    const stat = byId.get(player.id)
    return { ...player, matches: stat?.matches ?? 0, wins: stat?.wins ?? 0, dartsThrown: stat?.dartsThrown ?? 0,
      average: !stat?.matches ? '—' : mode.value === 'atc' ? `${((stat.hitRate ?? 0) * 100).toFixed(0)}%` : stat.average.toFixed(2),
      lastPlayed: stat?.lastPlayed ? new Date(stat.lastPlayed).toLocaleDateString() : '—' }
  })
})
const columns = computed(() => [
  { accessorKey: 'name', header: 'Player' }, { accessorKey: 'matches', header: 'Matches' }, { accessorKey: 'wins', header: 'Wins' },
  { accessorKey: 'average', header: mode.value === 'x01' ? '3-dart avg' : 'Hit rate' }, { accessorKey: 'dartsThrown', header: 'Total darts' },
  { accessorKey: 'lastPlayed', header: 'Last played' }, { id: 'actions', header: 'Actions' }
])
const hasGuests = computed(() => players.recentPlayers.some(player => player.id !== account.self?.id))
const editorOpen = ref(false)
const editing = ref<PlayerIdentity | null>(null)
const draft = reactive({ name: '', color: fallbackPlayerColor(0) })
const pending = ref(false)
const removal = ref<PlayerIdentity | 'all' | null>(null)
const confirmOpen = computed({ get: () => removal.value !== null, set: open => { if (!open) removal.value = null } })
function openEditor(player?: PlayerIdentity) {
  editing.value = player ?? null
  Object.assign(draft, player ? { name: player.name, color: player.color } : { name: '', color: fallbackPlayerColor(players.recentPlayers.length) })
  editorOpen.value = true
}
function playerActions(player: PlayerIdentity) {
  return [
    { label: 'Edit player', icon: 'i-lucide-pencil', onSelect: () => openEditor(player) },
    ...(player.id === account.self?.id ? [] : [{ label: 'Remove player', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { removal.value = player } }])
  ]
}
async function savePlayer() {
  if (pending.value) return
  pending.value = true
  try {
    const data = playerSchema.parse(draft)
    const result = editing.value ? await players.updateRecentPlayer(editing.value.id, data) : await players.addRecentPlayer(data.name, data.color)
    if (!result) return
    if (editing.value?.id === account.self?.id) account.self = result.players.find(player => player.id === account.self?.id) ?? account.self
    editorOpen.value = false
    toast.add({ title: editing.value ? 'Player updated' : 'Player added', color: 'success' })
    await refresh()
  } finally { pending.value = false }
}
async function removePlayers() {
  if (!removal.value || pending.value) return
  pending.value = true
  try {
    const result = removal.value === 'all' ? await players.clearRecentPlayers() : await players.removeRecentPlayer(removal.value.id)
    if (result) { removal.value = null; toast.add({ title: 'Saved players updated', color: 'success' }); await refresh() }
  } finally { pending.value = false }
}
onMounted(() => account.load())
</script>
