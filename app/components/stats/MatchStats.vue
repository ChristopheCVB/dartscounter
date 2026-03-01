<template>
  <UCard class="grid gap-4">
    <h2 class="m-0">Winner: {{ summary.winnerName }}</h2>
    <p class="m-0 text-muted">{{ summary.mode }} · {{ durationText }}</p>

    <div class="overflow-auto">
      <table class="w-full border-collapse">
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
