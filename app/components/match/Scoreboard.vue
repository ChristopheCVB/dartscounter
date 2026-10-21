<template>
  <section aria-label="Players" class="grid min-w-0 gap-2">
    <MatchPlayerCard
      v-for="(player, idx) in players"
      :key="player.id"
      :player="player"
      :active="idx === activeIndex"
      :settings="settings"
      :darts-left="idx === activeIndex ? Math.max(0, 3 - dartsUsed) : 3"
      :show-recommendation="status === 'in_progress'"
    />
  </section>
</template>

<script setup lang="ts">
import type { GameSettings, MatchPlayer, MatchStatus } from '~~/shared/types/darts'

defineProps<{
  players: MatchPlayer[]
  activeIndex: number
  settings: GameSettings
  dartsUsed: number
  status: MatchStatus
}>()
</script>
