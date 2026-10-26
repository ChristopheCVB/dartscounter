<template>
  <section aria-label="Current turn" class="grid gap-2" aria-live="polite">
    <div class="flex items-center justify-between gap-2">
      <h3 class="m-0 arcade-title text-sm">Current Turn</h3>
      <UBadge color="neutral" variant="soft">{{ darts.length }}/3</UBadge>
    </div>

    <div class="flex flex-wrap gap-2">
      <template v-if="isAtc">
        <UBadge
          v-for="dart in darts"
          :key="dart.id"
          :color="dart.scoredPoints > 0 ? 'success' : 'neutral'"
          variant="soft"
          size="lg"
        >
          {{ dart.scoredPoints > 0 ? '✓' : '✗' }} {{ dart.segment === 0 ? 'Miss' : `${dart.multiplier === 1 ? '' : dart.multiplier === 2 ? 'D' : 'T'}${dart.segment === 25 ? 'Bull' : dart.segment}` }}
        </UBadge>
      </template>
      <template v-else-if="settings.mode === 'cricket'">
        <UBadge v-for="dart in darts" :key="dart.id" :color="dart.scoredMarks ? 'success' : 'neutral'" variant="soft" size="lg">
          {{ dart.segment === 0 ? 'Miss' : `${dart.multiplier === 1 ? '' : dart.multiplier === 2 ? 'D' : 'T'}${dart.segment === 25 ? 'Bull' : dart.segment}` }} · {{ dart.scoredMarks ?? 0 }} {{ dart.scoredMarks === 1 ? 'mark' : 'marks' }} · +{{ dart.scoredPoints }} pts
        </UBadge>
      </template>
      <template v-else>
        <UBadge v-for="dart in darts" :key="dart.id" color="neutral" variant="soft" size="lg">
          {{ dart.multiplier }}x{{ dart.segment }} -> {{ dart.scoredPoints }}
        </UBadge>
      </template>
      <UBadge v-if="!darts.length" color="neutral" variant="soft" size="lg">No darts yet.</UBadge>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { GameSettings, ThrowEvent } from '~~/shared/types/darts'

const props = defineProps<{
  darts: ThrowEvent[]
  settings: GameSettings
}>()

const isAtc = computed(() => props.settings.mode === 'atc')
</script>
