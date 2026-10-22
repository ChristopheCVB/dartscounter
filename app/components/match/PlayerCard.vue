<template>
  <UCard as="article" :aria-label="player.name" :aria-current="active ? 'true' : undefined" :style="cardStyle" class="min-w-0 overflow-hidden transition duration-200" :ui="{ body: 'p-3 sm:p-3' }">
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-1.5">
        <span class="size-2 shrink-0 rounded-full" :style="{ background: player.color }" />
        <p class="m-0 min-w-0 text-sm wrap-anywhere" :style="{ color: playerNameColor }">
          <span>{{ player.name }}</span><span class="text-xs text-muted"> · {{ isAtc ? atcProgress : `${player.legsWon} ${player.legsWon === 1 ? 'leg' : 'legs'}` }}</span>
        </p>
      </div>

      <div class="flex shrink-0 items-baseline gap-2 tabular-nums">
        <span v-if="!isAtc" class="text-xs text-muted" :aria-label="`Three-dart average: ${average}`">Avg {{ average }}</span>
        <p class="m-0 text-2xl font-extrabold leading-none">{{ isAtc ? atcTargetLabel : player.score }}</p>
      </div>
    </div>
    <UAlert
      v-if="showRecommendation"
      :title="active ? 'This turn' : 'Next turn'"
      :description="recommendation"
      :color="active ? 'warning' : 'neutral'"
      variant="soft"
      icon="i-lucide-target"
      class="mt-2"
      :ui="{ root: 'p-2 gap-2', icon: 'size-4', wrapper: 'block wrap-anywhere', title: 'inline text-xs', description: 'inline text-xs mt-0 ms-1' }"
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
const average = computed(() => (props.player.stats.dartsThrown ? props.player.stats.scoredPoints / props.player.stats.dartsThrown * 3 : 0).toFixed(2))
const recommendation = computed(() => getDartRecommendation(props.player, props.settings, props.dartsLeft))

const atcTargetLabel = computed(() => {
  const target = props.player.atcTarget ?? 1
  return `Target: ${formatAtcTarget(target)}`
})

const atcProgress = computed(() => {
  const target = props.player.atcTarget ?? 1
  const done = Math.min(target - 1, 21)
  return `${done}/21`
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
