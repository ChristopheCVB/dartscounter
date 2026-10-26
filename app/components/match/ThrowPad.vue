<template>
  <UCard as="section" aria-label="Throw Pad" class="arcade-glow">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="m-0 arcade-title text-sm">Throw Pad</h3>
        <UButton color="neutral" variant="soft" icon="i-lucide-undo-2" :disabled="undoDisabled" @click="emit('undo')">Undo</UButton>
      </div>
    </template>

    <div class="grid gap-4">
      <slot name="turn" />
      <UTabs v-model="inputMode" :items="inputMethods" size="lg">
        <template #target>
          <fieldset :disabled="disabled" class="grid gap-3" aria-label="Target input">
            <div :aria-disabled="disabled" :class="{ 'pointer-events-none opacity-50': disabled }">
              <MatchInteractiveTarget :player-color="playerColor" @hit="handleTargetHit" />
            </div>
            <UButton color="neutral" variant="soft" block @click="emit('miss')">Miss</UButton>
          </fieldset>
        </template>
        <template #quick>
          <fieldset :disabled="disabled" class="grid gap-4" aria-label="Quick input">
            <div class="grid grid-cols-3 gap-2" role="group" aria-label="Multiplier">
              <UButton v-for="(label, index) in ['Single', 'Double', 'Treble']" :key="label" color="neutral" :variant="multiplier === index + 1 ? 'solid' : 'soft'" :aria-pressed="multiplier === index + 1" class="justify-center" @click="emit('multiplier', (index + 1) as Multiplier)">{{ label }}</UButton>
            </div>
            <div class="grid grid-cols-4 gap-2 sm:grid-cols-5">
              <UButton v-for="segment in segments" :key="segment" color="neutral" variant="soft" class="justify-center" @click="emit('segment', segment)">{{ segment }}</UButton>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <UButton color="neutral" variant="soft" class="justify-center" @click="emit('bull', false)">Bull 25</UButton>
              <UButton color="neutral" variant="soft" class="justify-center" @click="emit('bull', true)">Bull 50</UButton>
              <UButton color="neutral" variant="soft" class="justify-center" @click="emit('miss')">Miss</UButton>
            </div>
            <div v-if="showNumeric" class="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
              <UFormField label="Numeric throw (0-60)">
                <UInput :model-value="numericBuffer" readonly class="w-full" />
              </UFormField>
              <UButton color="neutral" variant="soft" @click="emit('backspace')">Backspace</UButton>
              <UButton @click="emit('submitNumeric')">Enter</UButton>
            </div>
          </fieldset>
        </template>
      </UTabs>
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
  disabled?: boolean
  undoDisabled?: boolean
  showNumeric?: boolean
  cricket?: boolean
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

const allSegments: Segment[] = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
const segments = computed(() => props.cricket ? allSegments.filter(segment => segment >= 15) : allSegments)
const inputMode = defineModel<'quick' | 'target'>('inputMode', { default: 'target' })
const inputMethods = [
  { label: 'Interactive Target', value: 'target', slot: 'target' },
  { label: 'Quick Input', value: 'quick', slot: 'quick' }
]

function handleTargetHit(payload: { segment: Segment, multiplier: Multiplier }) {
  if (props.disabled) return
  emit('dart', payload)
}
</script>
