<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="m-0 arcade-title text-sm">Current Turn</h3>
        <UBadge color="neutral" variant="soft">{{ darts.length }}/3</UBadge>
      </div>
    </template>

    <div class="flex flex-wrap gap-2">
      <UBadge v-for="dart in darts" :key="dart.id" color="neutral" variant="soft" size="lg">
        {{ dart.multiplier }}x{{ dart.segment }} -> {{ dart.scoredPoints }}
      </UBadge>
      <span v-if="!darts.length" class="text-sm text-muted">No darts yet.</span>
    </div>

    <UAlert
      :description="hintText"
      color="warning"
      variant="soft"
      icon="i-lucide-target"
      class="mt-3"
    />
  </UCard>
</template>

<script setup lang="ts">
import type { ThrowEvent, X01Settings } from '~~/shared/types/darts'

type RecommendedDart = {
  label: string
  points: number
  isDouble: boolean
}

const allDarts: RecommendedDart[] = [
  ...Array.from({ length: 20 }, (_, idx) => {
    const segment = 20 - idx
    return { label: `T${segment}`, points: segment * 3, isDouble: false }
  }),
  ...Array.from({ length: 20 }, (_, idx) => {
    const segment = 20 - idx
    return { label: `D${segment}`, points: segment * 2, isDouble: true }
  }),
  { label: 'DB', points: 50, isDouble: true },
  { label: 'SB', points: 25, isDouble: false },
  ...Array.from({ length: 20 }, (_, idx) => {
    const segment = 20 - idx
    return { label: `S${segment}`, points: segment, isDouble: false }
  })
]

const finalDoubleDarts: RecommendedDart[] = [
  { label: 'DB', points: 50, isDouble: true },
  ...Array.from({ length: 20 }, (_, idx) => {
    const segment = 20 - idx
    return { label: `D${segment}`, points: segment * 2, isDouble: true }
  })
]

const props = defineProps<{
  darts: ThrowEvent[]
  score: number
  hasOpened: boolean
  settings: Pick<X01Settings, 'doubleIn' | 'doubleOut'>
}>()

const dartsLeft = computed(() => Math.max(0, 3 - props.darts.length))

const hintText = computed(() => {
  if (dartsLeft.value === 0) {
    return 'Turn complete. Undo to adjust or wait for auto-advance.'
  }

  if (props.settings.doubleIn && !props.hasOpened) {
    return 'Open required: hit any double to start scoring (D20 is a strong opener).'
  }

  const route = findBestRoute(props.score, dartsLeft.value, props.settings.doubleOut)
  if (route) {
    return `Ideal darts: ${route.join(' • ')}`
  }

  if (props.settings.doubleOut) {
    const bogeyScores = new Set([169, 168, 166, 165, 163, 162, 159])
    if (bogeyScores.has(props.score)) {
      return 'No direct checkout from this score. Set up a finish like D20 (40) or D16 (32).'
    }
    if (props.score > 170) {
      return 'No checkout this turn. Prioritize setup to leave a comfortable double (40, 32, or 24).'
    }
    return 'No finish in remaining darts. Set up a preferred out for your next turn.'
  }

  if (props.score > dartsLeft.value * 60) {
    return 'No finish this turn. Push scoring pace with high trebles.'
  }

  return 'Build your route: prioritize targets that keep your next dart simple.'
})

function findBestRoute(score: number, dartsLeft: number, requireDoubleOut: boolean): string[] | null {
  if (score <= 0 || dartsLeft <= 0) {
    return null
  }

  for (let routeLength = 1; routeLength <= dartsLeft; routeLength += 1) {
    const route = searchRoute(score, routeLength, requireDoubleOut)
    if (route) {
      return route
    }
  }

  return null
}

function searchRoute(score: number, routeLength: number, requireDoubleOut: boolean): string[] | null {
  const path: string[] = []

  const walk = (remaining: number, step: number): boolean => {
    if (remaining < 0) {
      return false
    }

    if (step === routeLength) {
      return remaining === 0
    }

    const isLastDart = step === routeLength - 1
    const candidates = requireDoubleOut && isLastDart ? finalDoubleDarts : allDarts

    for (const dart of candidates) {
      if (dart.points > remaining) {
        continue
      }

      const nextRemaining = remaining - dart.points
      if (isLastDart && nextRemaining !== 0) {
        continue
      }

      path.push(dart.label)
      if (walk(nextRemaining, step + 1)) {
        return true
      }
      path.pop()
    }

    return false
  }

  return walk(score, 0) ? [...path] : null
}
</script>
