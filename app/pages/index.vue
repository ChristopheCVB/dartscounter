<template>
  <section class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
    <UCard>
      <template #header>
        <h1 class="m-0">DartCounter</h1>
      </template>
      <div class="grid gap-4">
        <p class="m-0 text-muted">Fast local X01 scoring for pub nights and home matches.</p>
        <UButton to="/match/new" class="w-fit">Start New Match</UButton>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="m-0">Recent Matches</h2>
      </template>
      <div class="grid gap-4">
        <p class="m-0 text-muted">{{ historyCount }} saved</p>
        <UButton to="/history" color="neutral" variant="soft" class="w-fit">Open History</UButton>
      </div>
    </UCard>

    <UCard v-if="resumeMatchId">
      <template #header>
        <h2 class="m-0">Resume Match</h2>
      </template>
      <div class="grid gap-4">
        <p class="m-0 text-muted">Continue your active game where you left off.</p>
        <UButton :to="`/match/${resumeMatchId}`" class="w-fit">Resume</UButton>
      </div>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import { useHistoryStore } from '~/stores/history'
import { useMatchStore } from '~/stores/match'

const historyStore = useHistoryStore()
const matchStore = useMatchStore()
const historyCount = computed(() => historyStore.entries.length)
const resumeMatchId = computed(() => matchStore.activeMatch?.id || '')
</script>
