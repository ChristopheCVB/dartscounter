<template>
  <section class="grid gap-4">
    <h1 class="m-0">Match History</h1>

    <UCard v-if="!historyStore.entries.length">
      <div class="grid gap-4">
        <p class="m-0 text-muted">No matches saved yet.</p>
        <UButton to="/match/new" class="w-fit">Start first match</UButton>
      </div>
    </UCard>

    <UCard v-for="entry in historyStore.entries" :key="entry.id">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="m-0 font-bold">{{ entry.winnerName }} won</p>
          <p class="m-0 text-muted">{{ entry.mode }} · {{ formatDate(entry.finishedAt) }}</p>
        </div>
        <UButton color="error" variant="soft" @click="historyStore.removeSummary(entry.id)">Delete</UButton>
      </div>
      <div class="text-muted">Duration: {{ formatDuration(entry.durationMs) }}</div>
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
