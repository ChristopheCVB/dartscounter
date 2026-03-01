<template>
  <UCard>
    <h3 class="mt-0">Current Turn</h3>
    <div class="flex flex-wrap gap-2">
      <UBadge v-for="dart in darts" :key="dart.id" color="neutral" variant="soft">
        {{ dart.multiplier }}x{{ dart.segment }} -> {{ dart.scoredPoints }}
      </UBadge>
      <span v-if="!darts.length" class="text-muted">No darts yet.</span>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { ThrowEvent } from '~~/shared/types/darts'

defineProps<{
  darts: ThrowEvent[]
}>()
</script>
