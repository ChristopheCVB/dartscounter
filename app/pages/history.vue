<template>
  <section class="grid gap-4">
    <UPageHeader
      title="Match History"
      description="Review completed matches and keep your local archive clean."
      headline="Archive"
      class="arcade-reveal"
    />

    <UEmpty
      v-if="!historyStore.entries.length"
      title="No matches saved yet"
      description="Finish a match to generate stats and build your history timeline."
      icon="i-lucide-timer-off"
      :actions="[{ label: 'Start first match', to: '/match/new' }]"
      class="surface-card rounded-2xl border border-default arcade-reveal"
      :style="{ '--reveal-delay': '90ms' }"
    />

    <UCard
      v-for="(entry, idx) in historyStore.entries"
      :key="entry.id"
      class="history-row arcade-reveal arcade-hover-lift"
      :style="{ '--reveal-delay': `${90 + (idx * 45)}ms` }"
    >
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="m-0 font-bold">{{ entry.winnerName }} won</p>
            <p class="m-0 text-muted">{{ entry.mode }} · {{ formatDate(entry.finishedAt) }}</p>
          </div>
          <UButton color="error" variant="soft" @click="historyStore.removeSummary(entry.id)">Delete</UButton>
        </div>
      </template>

      <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted">
        <UBadge color="neutral" variant="soft">Duration: {{ formatDuration(entry.durationMs) }}</UBadge>
        <UBadge color="warning" variant="soft">Winner: {{ entry.winnerName }}</UBadge>
      </div>

      <details class="mt-3 match-details">
        <summary class="match-details-summary">Player stats</summary>
        <div class="mt-2 overflow-auto">
          <table class="stats-table w-full border-collapse">
            <thead>
              <tr class="text-left text-muted">
                <th>Player</th>
                <template v-if="entry.gameMode === 'atc'">
                  <th>Hit Rate</th>
                  <th>Darts</th>
                </template>
                <template v-else>
                  <th>Legs</th>
                  <th>Avg</th>
                  <th>First 9</th>
                  <th>Checkout</th>
                  <th>Darts</th>
                  <th>Busts</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in sortedPlayers(entry)"
                :key="row.playerId"
                :class="{ winner: row.playerId === entry.winnerId }"
              >
                <td>
                  <span class="inline-flex items-center gap-1.5">
                    <span class="player-dot" :style="{ background: row.color }" />
                    {{ row.name }}
                  </span>
                </td>
                <template v-if="entry.gameMode === 'atc'">
                  <td>{{ row.hitRate !== undefined ? (row.hitRate * 100).toFixed(0) + '%' : '—' }}</td>
                  <td>{{ row.dartsThrown }}</td>
                </template>
                <template v-else>
                  <td>{{ row.legsWon }}</td>
                  <td>{{ row.average.toFixed(2) }}</td>
                  <td>{{ row.firstNineAverage.toFixed(2) }}</td>
                  <td>{{ row.checkoutsMade }}/{{ row.checkoutAttempts }} ({{ row.checkoutPercentage.toFixed(2) }}%)</td>
                  <td>{{ row.dartsThrown }}</td>
                  <td>{{ row.busts }}</td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import { useHistoryStore } from '~/stores/history'

const historyStore = useHistoryStore()

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

<style scoped>
.history-row {
  border: 1px solid color-mix(in srgb, var(--ui-primary) 18%, var(--ui-border));
}

.match-details {
  border-top: 1px solid color-mix(in srgb, var(--ui-border) 60%, transparent);
  padding-top: 0.65rem;
}

.match-details-summary {
  cursor: pointer;
  font-size: 0.82rem;
  color: color-mix(in srgb, var(--ui-text) 75%, transparent);
  user-select: none;
}

.stats-table th,
.stats-table td {
  padding: 0.45rem 0.55rem;
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 65%, transparent);
  white-space: nowrap;
}

.stats-table th {
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.stats-table tr.winner {
  background: color-mix(in srgb, var(--ui-success) 12%, transparent);
}

.player-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  display: inline-block;
}
</style>
