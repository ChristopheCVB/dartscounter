<template>
  <section class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
    <MatchPlayerCard
      v-for="(player, idx) in players"
      :key="player.id"
      :player="player"
      :active="idx === activeIndex"
    />
  </section>
</template>

<script setup lang="ts">
import type { MatchPlayer } from '~~/shared/types/darts'

defineProps<{
  players: MatchPlayer[]
  activeIndex: number
}>()
</script>
