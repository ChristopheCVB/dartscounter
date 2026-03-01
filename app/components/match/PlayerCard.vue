<template>
  <UCard :style="cardStyle">
    <p class="m-0 text-muted">{{ player.name }}</p>
    <p class="mx-0 my-[0.1rem] text-[2rem] font-extrabold">{{ player.score }}</p>
    <p class="m-0 text-muted">Legs {{ player.legsWon }}</p>
  </UCard>
</template>

<script setup lang="ts">
import type { MatchPlayer } from '~~/shared/types/darts'

const props = defineProps<{
  player: MatchPlayer
  active: boolean
}>()

const cardStyle = computed(() => ({
  borderColor: props.active ? props.player.color : 'rgba(255,255,255,0.08)',
  boxShadow: props.active ? `0 0 0 2px ${props.player.color}55 inset` : 'none'
}))
</script>
