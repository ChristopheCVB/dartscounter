<template>
  <section class="grid gap-6">
    <UPageHero
      headline="Bold Arcade"
      title="Track every leg with confidence"
      description="Fast local X01 scoring with keyboard-first flow and match history. Built for pub nights, practice sessions, and competitive home games."
      class="hero-wrap arcade-reveal"
    >
      <UCard class="arcade-glow arcade-reveal" :style="{ '--reveal-delay': '90ms' }">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="metric-panel">
            <span class="metric-label">History</span>
            <strong class="metric-value">{{ historyCount }}</strong>
          </div>
          <div class="metric-panel">
            <span class="metric-label">Active Match</span>
            <strong class="metric-value">{{ resumeMatchId ? 'Ready' : 'None' }}</strong>
          </div>
          <div class="metric-panel">
            <span class="metric-label">Mode</span>
            <strong class="metric-value">X01</strong>
          </div>
        </div>
      </UCard>
    </UPageHero>

    <UPageGrid>
      <UPageCard
        title="Start New Match"
        description="Set up players and rules, then jump straight into scoring."
        icon="i-lucide-play-circle"
        to="/match/new"
        class="arcade-reveal arcade-hover-lift"
        :style="{ '--reveal-delay': '140ms' }"
        spotlight
        highlight
      />

      <UPageCard
        title="Browse History"
        :description="`${historyCount} match${historyCount === 1 ? '' : 'es'} saved locally.`"
        icon="i-lucide-history"
        to="/history"
        class="arcade-reveal arcade-hover-lift"
        :style="{ '--reveal-delay': '200ms' }"
        highlight
        highlight-color="warning"
      />

      <UPageCard
        v-if="resumeMatchId"
        title="Resume Match"
        description="Continue your current game where you left off."
        icon="i-lucide-rotate-ccw"
        :to="`/match/${resumeMatchId}`"
        class="arcade-reveal arcade-hover-lift"
        :style="{ '--reveal-delay': '260ms' }"
        variant="soft"
        spotlight
      />
    </UPageGrid>
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

<style scoped>
.hero-wrap {
  background: linear-gradient(150deg, rgba(247, 115, 22, 0.14), rgba(30, 41, 59, 0.08));
  border: 1px solid color-mix(in srgb, var(--ui-primary) 24%, var(--ui-border));
  border-radius: 1.5rem;
}

.metric-panel {
  display: grid;
  gap: 0.2rem;
  border: 1px solid color-mix(in srgb, var(--ui-primary) 24%, var(--ui-border));
  border-radius: 0.85rem;
  padding: 0.8rem 0.9rem;
  background: color-mix(in srgb, var(--ui-bg) 82%, transparent);
}

.metric-label {
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ui-text-muted);
}

.metric-value {
  font-size: 1.2rem;
}
</style>
