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
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="m-0 font-bold">{{ entry.winnerName }} won</p>
          <p class="m-0 text-muted">{{ entry.mode }} · {{ formatDate(entry.finishedAt) }}</p>
        </div>
        <UButton color="error" variant="soft" @click="historyStore.removeSummary(entry.id)">Delete</UButton>
      </div>
      <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted">
        <UBadge color="neutral" variant="soft">Duration: {{ formatDuration(entry.durationMs) }}</UBadge>
        <UBadge color="warning" variant="soft">Winner: {{ entry.winnerName }}</UBadge>
      </div>
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
</script>

<style scoped>
.history-row {
  border: 1px solid color-mix(in srgb, var(--ui-primary) 18%, var(--ui-border));
}
</style>
