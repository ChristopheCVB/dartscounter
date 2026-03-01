<template>
  <UCard class="grid gap-4">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="m-0">Winner: {{ summary.winnerName }}</h2>
        <UBadge color="warning" variant="soft" size="lg">{{ summary.mode }}</UBadge>
      </div>
    </template>

    <p class="m-0 text-muted">Duration {{ durationText }}</p>

    <div class="overflow-auto">
      <table class="stats-table w-full border-collapse">
        <thead>
          <tr class="text-left text-muted">
            <th>Player</th>
            <th>Legs</th>
            <th>Avg</th>
            <th>First 9</th>
            <th>Checkout</th>
            <th>Darts</th>
            <th>Busts</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in summary.players" :key="row.playerId">
            <td>{{ row.name }}</td>
            <td>{{ row.legsWon }}</td>
            <td>{{ row.average }}</td>
            <td>{{ row.firstNineAverage }}</td>
            <td>{{ row.checkoutsMade }}/{{ row.checkoutAttempts }} ({{ row.checkoutPercentage }}%)</td>
            <td>{{ row.dartsThrown }}</td>
            <td>{{ row.busts }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { MatchSummary } from '~~/shared/types/darts'

const props = defineProps<{
  summary: MatchSummary
}>()

const durationText = computed(() => {
  const totalSeconds = Math.floor(props.summary.durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
})
</script>

<style scoped>
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
</style>
