<template>
  <UCard class="arcade-glow">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="m-0 arcade-title text-sm">Throw Pad</h3>
        <UBadge color="warning" variant="soft">{{ multiplierLabel }}</UBadge>
      </div>
    </template>

    <div class="grid gap-4">
      <div class="flex flex-wrap gap-2">
        <UButton color="neutral" :variant="inputMode === 'quick' ? 'solid' : 'soft'" @click="inputMode = 'quick'">Quick Input</UButton>
        <UButton color="neutral" :variant="inputMode === 'target' ? 'solid' : 'soft'" @click="inputMode = 'target'">Interactive Target</UButton>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton color="neutral" :variant="multiplier === 1 ? 'solid' : 'soft'" @click="emit('multiplier', 1)">S</UButton>
        <UButton color="neutral" :variant="multiplier === 2 ? 'solid' : 'soft'" @click="emit('multiplier', 2)">D</UButton>
        <UButton color="neutral" :variant="multiplier === 3 ? 'solid' : 'soft'" @click="emit('multiplier', 3)">T</UButton>
        <UButton color="neutral" variant="soft" @click="emit('bull', false)">Bull 25</UButton>
        <UButton color="neutral" variant="soft" @click="emit('bull', true)">Bull 50</UButton>
        <UButton color="neutral" variant="soft" @click="emit('miss')">Miss</UButton>
        <UButton color="error" variant="soft" @click="emit('undo')">Undo</UButton>
      </div>

      <div v-if="inputMode === 'quick'" class="grid grid-cols-4 gap-2 sm:grid-cols-5">
        <UButton v-for="segment in segments" :key="segment" color="neutral" variant="soft" @click="emit('segment', segment)">{{ segment }}</UButton>
      </div>

      <div v-else>
        <MatchInteractiveTarget :player-color="playerColor" @hit="handleTargetHit" />
      </div>

      <div class="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div class="sm:col-span-1">
          <label class="mb-1.5 block text-sm text-muted">Numeric throw (0-60)</label>
          <UInput :model-value="numericBuffer" readonly />
        </div>
        <UButton color="neutral" variant="soft" @click="emit('backspace')">Backspace</UButton>
        <UButton @click="emit('submitNumeric')">Enter</UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { Multiplier, Segment } from '~~/shared/types/darts'
import MatchInteractiveTarget from '~/components/match/InteractiveTarget.vue'

const props = defineProps<{
  multiplier: Multiplier
  numericBuffer: string
  playerColor: string
}>()

const emit = defineEmits<{
  multiplier: [value: Multiplier]
  segment: [value: Segment]
  bull: [isDouble: boolean]
  miss: []
  undo: []
  backspace: []
  submitNumeric: []
  dart: [payload: { segment: Segment, multiplier: Multiplier }]
}>()

const segments: Segment[] = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
const inputMode = ref<'quick' | 'target'>('quick')
const multiplierLabel = computed(() => {
  if (props.multiplier === 2) {
    return 'Double selected'
  }
  if (props.multiplier === 3) {
    return 'Treble selected'
  }
  return 'Single selected'
})

function handleTargetHit(payload: { segment: Segment, multiplier: Multiplier }) {
  emit('dart', payload)
}
</script>
