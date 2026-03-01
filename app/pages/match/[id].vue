<template>
  <section v-if="match" class="grid items-start gap-5 lg:grid-cols-[2fr_1fr]">
    <div class="grid gap-4 arcade-reveal">
      <MatchScoreboard :players="match.players" :active-index="match.currentPlayerIndex" />
      <MatchThrowPad
        :multiplier="matchStore.selectedMultiplier"
        :numeric-buffer="matchStore.numericBuffer"
        :player-color="currentPlayerColor"
        @multiplier="matchStore.setMultiplier"
        @segment="matchStore.addSegment"
        @bull="matchStore.addBull"
        @miss="matchStore.addMiss"
        @undo="matchStore.undoLastDart"
        @backspace="matchStore.popNumericDigit"
        @submit-numeric="matchStore.submitNumericThrow"
        @dart="matchStore.addDart"
      />
    </div>

    <div class="grid gap-4 arcade-reveal" :style="{ '--reveal-delay': '90ms' }">
      <UCard class="arcade-glow">
        <template #header>
          <h3 class="m-0 arcade-title text-sm">Match Status</h3>
        </template>

        <UCard>
          <p class="m-0 mb-2 text-muted">All Players</p>
          <div class="grid gap-[0.45rem]">
            <div
              v-for="(player, idx) in match.players"
              :key="player.id"
              class="score-row"
              :class="{ active: idx === match.currentPlayerIndex }"
              :style="{
                borderColor: idx === match.currentPlayerIndex
                  ? player.color
                  : `color-mix(in srgb, ${player.color} 42%, var(--ui-border))`,
                background: idx === match.currentPlayerIndex
                  ? `color-mix(in srgb, ${player.color} 12%, var(--ui-bg))`
                  : 'color-mix(in srgb, var(--ui-bg) 90%, transparent)'
              }"
            >
              <span class="flex items-center gap-1.5"><span class="score-row-dot" :style="{ background: player.color }" />{{ player.name }}</span>
              <strong>{{ player.score }}</strong>
            </div>
          </div>
        </UCard>
        <p class="m-0">Player: <strong :style="{ color: currentPlayerColor }">{{ currentPlayerName }}</strong></p>
        <p class="m-0 text-muted">Turn {{ match.currentTurnIndex + 1 }} · Darts {{ match.currentTurnDarts.length }}/3</p>
        <p v-if="matchStore.transitionLocked" class="m-0 text-muted">Auto-advancing turn...</p>

        <div class="grid gap-2">
          <UButton v-if="lastSummary" color="primary" variant="soft" @click="showRecap = true">Show Match Recap</UButton>
          <UButton color="neutral" variant="soft" @click="showShortcuts = true">Keyboard shortcuts (?)</UButton>
          <UButton color="error" variant="soft" @click="exitMatch">End Match</UButton>
        </div>
      </UCard>

      <MatchTurnTimeline
        :darts="match.currentTurnDarts"
        :score="match.players[match.currentPlayerIndex]?.score || 0"
        :has-opened="match.players[match.currentPlayerIndex]?.hasOpened ?? true"
        :settings="match.settings"
      />
    </div>

    <div v-if="lastSummary" class="lg:col-span-2 arcade-reveal" :style="{ '--reveal-delay': '150ms' }">
      <MatchStats :summary="lastSummary" />
    </div>

    <UModal v-model:open="showShortcuts" title="Keyboard shortcuts">
      <template #body>
        <div class="grid gap-2 text-sm">
          <p class="flex items-center justify-between gap-4"><span>Set multiplier</span> <span class="flex items-center gap-1"><UKbd value="s" /><UKbd value="d" /><UKbd value="t" /></span></p>
          <p class="flex items-center justify-between gap-4"><span>Bull 25 / 50</span> <span class="flex items-center gap-1"><UKbd value="b" /><UKbd>Shift+B</UKbd></span></p>
          <p class="flex items-center justify-between gap-4"><span>Miss</span> <UKbd value="m" /></p>
          <p class="flex items-center justify-between gap-4"><span>Undo</span> <UKbd value="u" /></p>
          <p class="flex items-center justify-between gap-4"><span>Numeric buffer (0-60)</span> <UKbd>0-9</UKbd></p>
          <p class="flex items-center justify-between gap-4"><span>Remove digit</span> <UKbd value="backspace" /></p>
          <p class="flex items-center justify-between gap-4"><span>Submit numeric throw</span> <UKbd value="enter" /></p>
          <p class="flex items-center justify-between gap-4"><span>Toggle shortcuts modal</span> <UKbd>?</UKbd></p>
          <p class="flex items-center justify-between gap-4"><span>Close modal / clear buffer</span> <UKbd value="esc" /></p>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showRecap"
      :title="`Winner: ${lastSummary?.winnerName || '-'}`"
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #body>
        <div v-if="lastSummary" class="grid gap-4">
          <UCard :style="{ borderColor: winnerColor }">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="grid gap-1">
                <p class="m-0 text-sm text-muted">Match complete</p>
                <p class="m-0 text-xl font-bold">{{ lastSummary.winnerName }} wins</p>
              </div>
              <UBadge color="success" variant="soft" size="lg">{{ lastSummary.mode }}</UBadge>
            </div>
            <p class="m-0 mt-2 text-sm text-muted">{{ recapDuration }} · {{ recapFinishedAt }}</p>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="m-0">Positions</h3>
            </template>

            <div class="grid gap-2">
              <div
                v-for="(row, idx) in recapRows"
                :key="row.playerId"
                class="flex items-center justify-between rounded-lg border border-default px-3 py-2"
              >
                <div class="flex items-center gap-3">
                  <UBadge :color="idx === 0 ? 'warning' : 'neutral'" variant="soft">#{{ idx + 1 }}</UBadge>
                  <span class="font-medium">{{ row.name }}</span>
                </div>
                <div class="text-sm text-muted">
                  {{ row.legsWon }} legs · {{ row.average.toFixed(2) }} avg
                </div>
              </div>
            </div>
          </UCard>

          <MatchStats :summary="lastSummary" />
        </div>
      </template>
      <template #footer>
        <div class="flex w-full flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="showRecap = false">Close</UButton>
          <UButton color="neutral" variant="soft" to="/history">View History</UButton>
          <UButton to="/match/new">Start New Match</UButton>
        </div>
      </template>
    </UModal>
  </section>

  <section v-else class="grid gap-4">
    <UCard class="grid gap-4 arcade-glow">
      <template #header>
        <h2 class="m-0 arcade-title text-base">No active match</h2>
      </template>

      <UButton to="/match/new" class="w-fit">Start a match</UButton>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import MatchScoreboard from '~/components/match/Scoreboard.vue'
import MatchStats from '~/components/stats/MatchStats.vue'
import MatchThrowPad from '~/components/match/ThrowPad.vue'
import MatchTurnTimeline from '~/components/match/TurnTimeline.vue'
import { useThrowSounds } from '~/composables/useThrowSounds'
import { useHistoryStore } from '~/stores/history'
import { useMatchStore } from '~/stores/match'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const historyStore = useHistoryStore()
const { playConfetti } = useThrowSounds()

const showShortcuts = ref(false)
const showRecap = ref(false)
const celebratedMatchId = ref('')
const openedRecapMatchId = ref('')

const match = computed(() => {
  if (!matchStore.activeMatch) {
    return null
  }
  if (String(route.params.id) !== matchStore.activeMatch.id) {
    return null
  }
  return matchStore.activeMatch
})

const currentPlayerName = computed(() => matchStore.currentPlayer?.name || '-')
const currentPlayerColor = computed(() => matchStore.currentPlayer?.color || 'var(--ui-text)')
const lastSummary = computed(() => historyStore.entries.find(entry => entry.matchId === matchStore.activeMatch?.id) || null)
const winnerColor = computed(() => {
  if (!match.value?.winnerId) {
    return '#f05a28'
  }
  return match.value.players.find(player => player.id === match.value?.winnerId)?.color || '#f05a28'
})

const recapRows = computed(() => {
  if (!lastSummary.value) {
    return []
  }

  return [...lastSummary.value.players].sort((a, b) => {
    if (b.legsWon !== a.legsWon) {
      return b.legsWon - a.legsWon
    }
    if (b.average !== a.average) {
      return b.average - a.average
    }
    if (b.checkoutPercentage !== a.checkoutPercentage) {
      return b.checkoutPercentage - a.checkoutPercentage
    }
    if (a.dartsThrown !== b.dartsThrown) {
      return a.dartsThrown - b.dartsThrown
    }
    return a.name.localeCompare(b.name)
  })
})

const recapDuration = computed(() => {
  if (!lastSummary.value) {
    return '-'
  }

  const totalSeconds = Math.floor(lastSummary.value.durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
})

const recapFinishedAt = computed(() => {
  if (!lastSummary.value) {
    return '-'
  }
  return new Date(lastSummary.value.finishedAt).toLocaleString()
})

watch(
  () => [match.value?.id, match.value?.status, match.value?.winnerId] as const,
  async ([id, status, winnerId]) => {
    if (!id || status !== 'finished' || !winnerId) {
      return
    }

    if (celebratedMatchId.value === id || !import.meta.client) {
      return
    }

    celebratedMatchId.value = id
    playConfetti()

    const { default: confetti } = await import('canvas-confetti')
    const palette = [winnerColor.value, '#ffffff', '#ffd166']

    confetti({
      particleCount: 130,
      spread: 80,
      startVelocity: 50,
      origin: { y: 0.65 },
      colors: palette
    })

    setTimeout(() => {
      confetti({
        particleCount: 110,
        spread: 100,
        startVelocity: 45,
        origin: { y: 0.58 },
        colors: palette
      })
    }, 380)
  },
  { immediate: true }
)

watch(
  () => [match.value?.id, match.value?.status, lastSummary.value?.id] as const,
  ([id, status, summaryId]) => {
    if (!id || status !== 'finished' || !summaryId) {
      return
    }

    if (openedRecapMatchId.value === id) {
      return
    }

    openedRecapMatchId.value = id
    showRecap.value = true
  },
  { immediate: true }
)

const isTypingInInput = () => {
  const el = document.activeElement as HTMLElement | null
  if (!el) {
    return false
  }
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || el.isContentEditable
}

const guarded = (fn: () => void) => {
  if (!match.value || match.value.status !== 'in_progress') {
    return
  }
  if (isTypingInInput()) {
    return
  }
  if (showShortcuts.value) {
    return
  }
  if (showRecap.value) {
    return
  }
  if (matchStore.transitionLocked) {
    return
  }
  fn()
}

defineShortcuts({
  s: () => guarded(() => matchStore.setMultiplier(1)),
  d: () => guarded(() => matchStore.setMultiplier(2)),
  t: () => guarded(() => matchStore.setMultiplier(3)),
  b: () => guarded(() => matchStore.addBull(false)),
  shift_b: () => guarded(() => matchStore.addBull(true)),
  m: () => guarded(() => matchStore.addMiss()),
  u: () => guarded(() => matchStore.undoLastDart()),
  enter: () => guarded(() => matchStore.submitNumericThrow()),
  backspace: () => guarded(() => matchStore.popNumericDigit()),
  escape: () => {
    if (showShortcuts.value) {
      showShortcuts.value = false
      return
    }
    if (showRecap.value) {
      showRecap.value = false
      return
    }
    matchStore.clearNumericBuffer()
  },
  '?': () => {
    showShortcuts.value = !showShortcuts.value
  },
  0: () => guarded(() => matchStore.appendNumericDigit('0')),
  1: () => guarded(() => matchStore.appendNumericDigit('1')),
  2: () => guarded(() => matchStore.appendNumericDigit('2')),
  3: () => guarded(() => matchStore.appendNumericDigit('3')),
  4: () => guarded(() => matchStore.appendNumericDigit('4')),
  5: () => guarded(() => matchStore.appendNumericDigit('5')),
  6: () => guarded(() => matchStore.appendNumericDigit('6')),
  7: () => guarded(() => matchStore.appendNumericDigit('7')),
  8: () => guarded(() => matchStore.appendNumericDigit('8')),
  9: () => guarded(() => matchStore.appendNumericDigit('9'))
})

function exitMatch() {
  matchStore.clearMatch()
  router.push('/')
}
</script>

<style scoped>
.score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.55rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 70%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--ui-bg) 90%, transparent);
}

.score-row-dot {
  width: 0.54rem;
  height: 0.54rem;
  border-radius: 999px;
  display: inline-block;
}

</style>
