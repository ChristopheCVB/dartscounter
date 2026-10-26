<template>
  <UCard as="section" aria-label="Cricket scoreboard" class="min-w-0" :ui="{ body: 'p-0 sm:p-0' }">
    <div class="overflow-x-auto rounded-t-lg" tabindex="0" role="region" aria-label="Cricket marks; scroll to see more players">
      <table class="w-full border-collapse text-center text-sm tabular-nums">
        <caption class="sr-only">Cricket marks, current leg points, and legs won</caption>
        <thead>
          <tr>
            <th scope="col" class="sticky left-0 z-10 bg-default p-3 text-left">Target</th>
            <th v-for="(player, index) in players" :key="player.id" scope="col" class="min-w-24 max-w-40 p-3 wrap-anywhere" :class="{ 'bg-primary/10': index === activeIndex }" :aria-current="index === activeIndex ? 'true' : undefined">
              <span :style="{ color: player.color }">{{ player.name }}</span>
              <span v-if="index === activeIndex" class="block text-xs font-normal text-primary">Current player</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="target in CRICKET_TARGETS" :key="target" :class="{ 'text-muted': players.every(player => player.cricketMarks?.[target] === 3) }">
            <th scope="row" class="sticky left-0 z-10 border-t border-default bg-default p-2 text-left">{{ target === 25 ? 'Bull' : target }}</th>
            <td v-for="(player, index) in players" :key="player.id" class="border-t border-default p-2 text-xl" :class="{ 'bg-primary/10': index === activeIndex }" :aria-label="`${player.name}, ${target === 25 ? 'Bull' : target}: ${player.cricketMarks?.[target] ?? 0} of 3 marks${player.cricketMarks?.[target] === 3 ? ', closed' : ''}`">
              <span aria-hidden="true">{{ symbols[player.cricketMarks?.[target] ?? 0] }}</span>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr v-for="metric in metrics" :key="metric.key">
            <th scope="row" class="sticky left-0 z-10 border-t border-default bg-default p-2 text-left">{{ metric.label }}</th>
            <td v-for="(player, index) in players" :key="player.id" class="border-t border-default p-2 font-semibold" :class="{ 'bg-primary/10': index === activeIndex }">{{ player[metric.key] }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="m-0 border-t border-default p-3 text-xs text-muted">— No marks · / One · × Two · ⊗ Closed</p>
  </UCard>
</template>

<script setup lang="ts">
import type { MatchPlayer } from '~~/shared/types/darts'
import { CRICKET_TARGETS } from '~~/shared/utils/cricketEngine'

defineProps<{ players: MatchPlayer[], activeIndex: number }>()
const symbols = ['—', '/', '×', '⊗']
const metrics = [{ key: 'score', label: 'Points' }, { key: 'legsWon', label: 'Legs' }] as const
</script>
