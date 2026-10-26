<template>
  <component :is="embedded ? 'section' : UCard" :as="embedded ? undefined : 'section'" aria-label="Match rules">
    <h2 class="m-0 mb-3 arcade-title text-sm">Match rules</h2>
    <div class="flex flex-wrap gap-2">
      <template v-if="settings.mode === 'x01'">
        <UBadge color="neutral" variant="soft">X01 · {{ settings.startScore }}</UBadge>
        <UBadge color="neutral" variant="soft">{{ settings.doubleIn ? 'Double in' : 'Straight in' }}</UBadge>
        <UBadge color="neutral" variant="soft">{{ settings.doubleOut ? 'Double out' : 'Straight out' }}</UBadge>
        <UBadge color="neutral" variant="soft">First to {{ settings.legsTarget }} {{ settings.legsTarget === 1 ? 'leg' : 'legs' }}</UBadge>
      </template>
      <template v-else-if="settings.mode === 'cricket'">
        <UBadge color="neutral" variant="soft">Cricket</UBadge>
        <UBadge color="neutral" variant="soft">15–20 and Bull · 3 marks to close</UBadge>
        <UBadge color="neutral" variant="soft">Bull 25/50</UBadge>
        <UBadge color="neutral" variant="soft">Close all targets; finish level or ahead on points</UBadge>
        <UBadge color="neutral" variant="soft">First to {{ settings.legsTarget }} {{ settings.legsTarget === 1 ? 'leg' : 'legs' }} · Rotating starter</UBadge>
      </template>
      <template v-else>
        <UBadge color="neutral" variant="soft">Around the Clock</UBadge>
        <UBadge color="neutral" variant="soft">1–20, then Bull</UBadge>
        <UBadge color="neutral" variant="soft">Fast Forward {{ settings.fastForward ? 'on' : 'off' }}</UBadge>
      </template>
    </div>
  </component>
</template>

<script setup lang="ts">
import type { GameSettings } from '~~/shared/types/darts'
import { UCard } from '#components'

defineProps<{ settings: GameSettings, embedded?: boolean }>()
</script>
