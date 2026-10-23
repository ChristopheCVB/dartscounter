<template>
  <section class="page-stack">
    <header class="page-heading"><h1>History</h1><p>Every finished match, ready for another look.</p></header>
    <UEmpty v-if="!historyStore.entries.length" title="Your first result is waiting" description="Finish a match to see its results and player statistics here." icon="i-lucide-history" :actions="[{ label: 'Go to Play', to: '/' }]" />
    <div class="divide-y divide-default">
      <article v-for="entry in historyStore.entries" :key="entry.id" class="grid gap-4 py-6 first:pt-0">
        <div class="flex items-start justify-between gap-4">
          <div class="grid min-w-0 gap-2">
            <h2 class="break-words text-lg font-semibold">{{ entry.winnerName }} won</h2>
            <p class="break-words text-sm text-muted">{{ entry.players.filter(player => player.playerId !== entry.winnerId).map(player => player.name).join(' · ') }}</p>
            <p class="text-sm text-muted">{{ entry.mode }} · {{ formatDuration(entry.durationMs) }}</p>
            <time :datetime="new Date(entry.finishedAt).toISOString()" class="text-xs text-muted">{{ formatDate(entry.finishedAt) }}</time>
          </div>
          <UDropdownMenu :items="[{ label: 'Hide from my history', icon: 'i-lucide-eye-off', color: 'error', onSelect: () => { selected = entry } }]"><UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" :aria-label="`Options for ${entry.winnerName}’s match`" :disabled="removing" /></UDropdownMenu>
        </div>
        <details>
          <summary class="cursor-pointer py-2 text-sm font-medium text-primary">Player statistics</summary>
          <div class="mt-3 hidden overflow-x-auto md:block">
            <table class="w-full text-left text-sm">
              <thead class="text-xs text-muted"><tr><th class="p-3">Player</th><template v-if="entry.gameMode === 'atc'"><th class="p-3">Hit rate</th><th class="p-3">Darts</th></template><template v-else><th class="p-3">Legs</th><th class="p-3">Avg</th><th class="p-3">First 9</th><th class="p-3">Checkout</th><th class="p-3">Darts</th><th class="p-3">Busts</th></template></tr></thead>
              <tbody><tr v-for="row in sortedPlayers(entry)" :key="row.playerId" class="border-t border-default" :class="{ 'bg-primary/5': row.playerId === entry.winnerId }">
                <th scope="row" class="p-3 font-medium"><span class="inline-flex items-center gap-2"><span class="size-2.5 shrink-0 rounded-full" :style="{ background: row.color }" />{{ row.name }}</span></th>
                <template v-if="entry.gameMode === 'atc'"><td class="p-3">{{ row.hitRate !== undefined ? (row.hitRate * 100).toFixed(0) + '%' : '—' }}</td><td class="p-3">{{ row.dartsThrown }}</td></template>
                <template v-else><td class="p-3">{{ row.legsWon }}</td><td class="p-3">{{ row.average.toFixed(2) }}</td><td class="p-3">{{ row.firstNineAverage.toFixed(2) }}</td><td class="p-3">{{ row.checkoutsMade }}/{{ row.checkoutAttempts }} ({{ row.checkoutPercentage.toFixed(2) }}%)</td><td class="p-3">{{ row.dartsThrown }}</td><td class="p-3">{{ row.busts }}</td></template>
              </tr></tbody>
            </table>
          </div>
          <div class="mt-3 divide-y divide-default md:hidden">
            <section v-for="row in sortedPlayers(entry)" :key="row.playerId" class="grid gap-3 py-4">
              <h3 class="flex flex-wrap items-center gap-2 font-medium"><span class="size-2.5 shrink-0 rounded-full" :style="{ background: row.color }" />{{ row.name }}<UBadge v-if="row.playerId === entry.winnerId" color="primary" variant="soft">Winner</UBadge></h3>
              <dl class="grid grid-cols-2 gap-3 text-sm">
                <template v-if="entry.gameMode === 'atc'"><div><dt class="text-muted">Hit rate</dt><dd>{{ row.hitRate !== undefined ? (row.hitRate * 100).toFixed(0) + '%' : '—' }}</dd></div></template>
                <template v-else><div><dt class="text-muted">Legs</dt><dd>{{ row.legsWon }}</dd></div><div><dt class="text-muted">3-dart avg</dt><dd>{{ row.average.toFixed(2) }}</dd></div><div><dt class="text-muted">First 9 avg</dt><dd>{{ row.firstNineAverage.toFixed(2) }}</dd></div><div><dt class="text-muted">Checkout</dt><dd>{{ row.checkoutsMade }}/{{ row.checkoutAttempts }} ({{ row.checkoutPercentage.toFixed(2) }}%)</dd></div><div><dt class="text-muted">Busts</dt><dd>{{ row.busts }}</dd></div></template>
                <div><dt class="text-muted">Darts</dt><dd>{{ row.dartsThrown }}</dd></div>
              </dl>
            </section>
          </div>
        </details>
      </article>
    </div>
    <UModal v-model:open="confirmOpen" class="app-shell" title="Hide this match?" description="This removes the match from your history and lifetime statistics. Other players keep their results." :dismissible="!removing" :close="!removing">
      <template #footer><UButton color="neutral" variant="soft" :disabled="removing" @click="selected = null">Cancel</UButton><UButton color="error" :loading="removing" @click="hideMatch">Hide from my history</UButton></template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { useHistoryStore } from '~/stores/history'

definePageMeta({
  title: 'History',
  description: 'Review your completed darts matches, results, and detailed player statistics.'
})

const historyStore = useHistoryStore()
const selected = ref<(typeof historyStore.entries)[number] | null>(null)
const removing = ref(false)
const confirmOpen = computed({ get: () => selected.value !== null, set: open => { if (!open) selected.value = null } })
async function hideMatch() {
  if (!selected.value || removing.value) return
  removing.value = true
  try { if (await historyStore.removeSummary(selected.value.id)) selected.value = null }
  finally { removing.value = false }
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

function sortedPlayers(entry: (typeof historyStore.entries)[number]) {
  return [...entry.players].sort((a, b) => {
    const aWinner = a.playerId === entry.winnerId
    const bWinner = b.playerId === entry.winnerId
    if (aWinner !== bWinner) {
      return aWinner ? -1 : 1
    }
    if (b.legsWon !== a.legsWon) {
      return b.legsWon - a.legsWon
    }
    if (b.average !== a.average) {
      return b.average - a.average
    }
    return a.name.localeCompare(b.name)
  })
}
</script>
