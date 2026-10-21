<template>
  <UCard as="article" :aria-label="player.name" :style="cardStyle" class="overflow-hidden transition duration-200">
    <div class="grid gap-1">
      <div class="flex items-center justify-between gap-2">
        <p class="m-0 flex items-center gap-1.5 text-sm" :style="{ color: playerNameColor }">
          <span class="player-dot" :style="{ background: player.color }" />
          {{ player.name }}
        </p>
        <UBadge :color="active ? 'warning' : 'neutral'" variant="soft" size="sm">{{ active ? 'Throwing' : 'Waiting' }}</UBadge>
      </div>

      <template v-if="isAtc">
        <p class="mx-0 my-[0.1rem] text-[2rem] font-extrabold leading-none">{{ atcTargetLabel }}</p>
        <p class="m-0 text-sm text-muted">{{ atcProgress }}</p>
      </template>
      <template v-else>
        <p class="mx-0 my-[0.1rem] text-[2rem] font-extrabold leading-none">{{ player.score }}</p>
        <p class="m-0 text-sm text-muted">Legs {{ player.legsWon }}</p>
      </template>
    </div>
    <UAlert
      v-if="showRecommendation"
      :title="active ? 'This turn' : 'Next turn'"
      :description="recommendation"
      :color="active ? 'warning' : 'neutral'"
      variant="soft"
      icon="i-lucide-target"
      class="mt-3"
    />
  </UCard>
</template>

<script setup lang="ts">
import type { GameSettings, MatchPlayer } from '~~/shared/types/darts'
import { formatAtcTarget } from '~~/shared/utils/atcEngine'
import { getDartRecommendation } from '~~/shared/utils/dartRecommendation'

const props = defineProps<{
  player: MatchPlayer
  active: boolean
  settings: GameSettings
  dartsLeft: number
  showRecommendation: boolean
}>()

const isAtc = computed(() => props.settings.mode === 'atc')
const recommendation = computed(() => getDartRecommendation(props.player, props.settings, props.dartsLeft))

const atcTargetLabel = computed(() => {
  const target = props.player.atcTarget ?? 1
  return `Target: ${formatAtcTarget(target)}`
})

const atcProgress = computed(() => {
  const target = props.player.atcTarget ?? 1
  const done = Math.min(target - 1, 21)
  return `${done} / 21`
})

const cardStyle = computed(() => ({
  borderColor: props.active ? props.player.color : 'color-mix(in srgb, var(--ui-border) 70%, transparent)',
  boxShadow: props.active
    ? `0 0 0 2px color-mix(in srgb, ${props.player.color} 36%, transparent) inset, 0 14px 40px -30px ${props.player.color}`
    : 'none',
  background: props.active
    ? `linear-gradient(150deg, color-mix(in srgb, ${props.player.color} 20%, transparent), color-mix(in srgb, var(--ui-bg) 88%, transparent))`
    : 'color-mix(in srgb, var(--ui-bg) 92%, transparent)'
}))

const playerNameColor = computed(() => `color-mix(in srgb, ${props.player.color} 72%, white)`)
</script>

<style scoped>
.player-dot {
  display: inline-block;
  width: 0.56rem;
  height: 0.56rem;
  border-radius: 999px;
}
</style>
