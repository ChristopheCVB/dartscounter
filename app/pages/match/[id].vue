<template>
  <section v-if="match" :aria-busy="matchStore.pending" class="grid items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
    <div class="min-w-0 arcade-reveal lg:row-span-2">
      <MatchThrowPad
        v-model:input-mode="inputMode"
        :show-numeric="match.settings.mode === 'x01'"
        :multiplier="matchStore.selectedMultiplier"
        :numeric-buffer="match.settings.mode === 'atc' ? '' : matchStore.numericBuffer"
        :player-color="currentPlayerColor"
        :disabled="!matchStore.canScore"
        :undo-disabled="!matchStore.canUndo"
        @multiplier="matchStore.setMultiplier"
        @segment="matchStore.addSegment"
        @bull="matchStore.addBull"
        @miss="matchStore.addMiss"
        @undo="matchStore.undoLastDart"
        @backspace="matchStore.popNumericDigit"
        @submit-numeric="matchStore.submitNumericThrow"
        @dart="matchStore.addDart"
      >
        <template #turn>
          <MatchTurnTimeline :darts="match.currentTurnDarts" :settings="match.settings" />
        </template>
      </MatchThrowPad>
    </div>

    <MatchScoreboard
      :players="match.players"
      :active-index="match.currentPlayerIndex"
      :settings="match.settings"
      :darts-used="match.currentTurnDarts.length"
      :status="match.status"
      class="arcade-reveal lg:col-start-2 lg:row-start-2"
      :style="{ '--reveal-delay': '90ms' }"
    />

    <UCard as="section" aria-label="Match Status" class="min-w-0 text-sm arcade-glow arcade-reveal lg:col-start-2 lg:row-start-1" :ui="{ header: 'px-3 py-2 sm:px-3', body: 'grid gap-3 p-3 sm:p-3' }" :style="{ '--reveal-delay': '90ms' }">
      <template #header>
        <h3 class="m-0 arcade-title text-sm">Match Status</h3>
      </template>

      <div class="grid gap-1 wrap-anywhere">
        <p class="m-0 truncate" :title="currentPlayerName">Player: <strong :style="{ color: currentPlayerColor }">{{ currentPlayerName }}</strong></p>
        <p class="m-0 text-muted">Turn {{ match.currentTurnIndex + 1 }} · Darts {{ match.currentTurnDarts.length }}/3</p>
        <p role="status" class="m-0 text-muted leading-5">{{ scoringStatus }}</p>
      </div>

      <MatchRulesSummary :settings="match.settings" embedded />

      <div class="flex flex-wrap gap-2">
        <UButton v-if="matchStore.room && match.status !== 'in_progress'" :to="`/room/${matchStore.room.id}`">Play again</UButton>
        <UButton v-if="lastSummary" color="primary" variant="soft" @click="showRecap = true">Show Match Recap</UButton>
        <UButton color="neutral" variant="soft" @click="showShortcuts = true">Keyboard shortcuts (?)</UButton>
        <UButton v-if="matchStore.room" :to="`/room/${matchStore.room.id}`" color="neutral" variant="soft">Room lobby</UButton>
        <RoomShare v-if="matchStore.room" :code="matchStore.room.code" />
        <RoomLeaveButton v-if="matchStore.room" :room="matchStore.room" />
        <UButton v-if="match.status === 'in_progress' && matchStore.room?.ownerId === account.userId" color="error" variant="soft" :disabled="!matchStore.connected || matchStore.pending || !!matchStore.uncertain" @click="exitMatch">End Match</UButton>
      </div>
      <p class="text-xs text-muted">Away from the lobby or match for five minutes? You leave the room, ending any unfinished match you’re playing.</p>
    </UCard>

    <div v-if="lastSummary" class="lg:col-span-2 arcade-reveal" :style="{ '--reveal-delay': '150ms' }">
      <MatchStats :summary="lastSummary" />
    </div>

    <Teleport to="body">
      <UAlert
        v-if="matchStore.error || (matchStore.uncertain && !matchStore.pending)"
        role="alert"
        color="error"
        :title="matchStore.error || 'Dart needs confirmation'"
        class="fixed right-4 bottom-4 z-50 w-sm max-w-[calc(100vw-2rem)] shadow-lg"
      >
        <template #actions>
          <UButton v-if="matchStore.uncertain" :loading="matchStore.pending" color="error" @click="matchStore.retryUncertain">Resolve pending dart</UButton>
        </template>
      </UAlert>
    </Teleport>

    <UModal v-model:open="showShortcuts" title="Keyboard shortcuts">
      <template #body>
        <div class="grid gap-2 text-sm">
          <p class="flex items-center justify-between gap-4"><span>Set multiplier (Quick Input)</span> <span class="flex items-center gap-1"><UKbd value="s" /><UKbd value="d" /><UKbd value="t" /></span></p>
          <p class="flex items-center justify-between gap-4"><span>Bull 25 / 50</span> <span class="flex items-center gap-1"><UKbd value="b" /><UKbd>Shift+B</UKbd></span></p>
          <p class="flex items-center justify-between gap-4"><span>Miss</span> <UKbd value="m" /></p>
          <p class="flex items-center justify-between gap-4"><span>Undo</span> <UKbd value="u" /></p>
          <p class="flex items-center justify-between gap-4"><span>Numeric buffer (Quick Input · X01, 0-60)</span> <UKbd>0-9</UKbd></p>
          <p class="flex items-center justify-between gap-4"><span>Remove digit (Quick Input · X01)</span> <UKbd value="backspace" /></p>
          <p class="flex items-center justify-between gap-4"><span>Submit numeric throw (Quick Input · X01)</span> <UKbd value="enter" /></p>
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
                  <template v-if="lastSummary?.gameMode === 'atc'">
                    {{ row.dartsThrown }} darts · {{ row.hitRate !== undefined ? (row.hitRate * 100).toFixed(0) : '0' }}% hit
                  </template>
                  <template v-else>
                    {{ row.legsWon }} legs · {{ row.average.toFixed(2) }} avg
                  </template>
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
          <UButton v-if="matchStore.room" :to="`/room/${matchStore.room.id}`">Play again</UButton>
        </div>
      </template>
    </UModal>
  </section>

  <section v-else class="grid gap-4">
    <UCard class="grid gap-4 arcade-glow">
      <template #header>
        <h2 class="m-0 arcade-title text-base">{{ matchStore.error ? 'Match unavailable' : 'Loading match…' }}</h2>
      </template>

      <p v-if="matchStore.error">{{ matchStore.error }}</p>
      <div class="flex gap-3"><UButton to="/" class="w-fit">Return to Play</UButton><UButton to="/history" color="neutral" variant="soft">History</UButton></div>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import { useAccountStore } from '~/stores/account'

import MatchScoreboard from '~/components/match/Scoreboard.vue'
import MatchStats from '~/components/stats/MatchStats.vue'
import MatchThrowPad from '~/components/match/ThrowPad.vue'
import MatchTurnTimeline from '~/components/match/TurnTimeline.vue'
import { complementaryColor } from '~~/shared/utils/playerColors'
import { useMatchStore } from '~/stores/match'

definePageMeta({
  title: 'Match',
  description: 'Score your darts match, follow each turn, and view match results and player statistics.'
})

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const account = useAccountStore()

const inputMode = ref<'target' | 'quick'>('target')
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
const scoringStatus = computed(() => {
  if (!matchStore.connected) return 'Connecting · scoring paused'
  if (matchStore.pending) return 'Saving dart...'
  if (matchStore.uncertain) return 'Scoring paused · dart needs confirmation'
  if (matchStore.transitionLocked) return 'Auto-advancing turn...'
  if (match.value?.status === 'finished') return 'Match complete'
  if (match.value?.status === 'abandoned') return 'Match ended'
  return matchStore.room?.controllers[matchStore.currentPlayer?.id ?? ''] === account.userId
    ? 'Your player’s turn'
    : 'Watching · waiting for the controlling player'
})
const lastSummary = computed(() => matchStore.room?.summary ?? null)
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
  async ([id, status, winnerId], previous) => {
    if (!id || status !== 'finished' || !winnerId) {
      return
    }

    if (!previous || previous[0] !== id || previous[1] !== 'in_progress' || celebratedMatchId.value === id || !import.meta.client) {
      return
    }

    celebratedMatchId.value = id

    const { default: confetti } = await import('canvas-confetti')
    const complement = complementaryColor(winnerColor.value)

    confetti({
      particleCount: 101,
      spread: 80,
      startVelocity: 50,
      origin: { y: 0.65 },
      colors: [winnerColor.value],
      shapes: ['circle']
    })
    confetti({
      particleCount: 50,
      spread: 80,
      startVelocity: 50,
      origin: { y: 0.65 },
      colors: ['#FFFFFF', complement],
      shapes: ['square']
    })

    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 100,
        startVelocity: 45,
        origin: { y: 0.58 },
        colors: [winnerColor.value],
        shapes: ['circle']
      })
      confetti({
        particleCount: 40,
        spread: 100,
        startVelocity: 45,
        origin: { y: 0.58 },
        colors: ['#FFFFFF', complement],
        shapes: ['square']
      })
    }, 380)
  },
  { immediate: true }
)

watch(
  () => [match.value?.id, match.value?.status, lastSummary.value?.id] as const,
  ([id, status, summaryId]) => {
    if (status !== 'finished') {
      showRecap.value = false
      openedRecapMatchId.value = ''
      celebratedMatchId.value = ''
    }
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

const quickInput = (fn: () => void, numeric = false) => {
  if (inputMode.value !== 'quick' || (numeric && match.value?.settings.mode !== 'x01')) return
  guarded(fn)
}

const activeElement = useActiveElement()

defineShortcuts(computed(() => ({
  s: () => quickInput(() => matchStore.setMultiplier(1)),
  d: () => quickInput(() => matchStore.setMultiplier(2)),
  t: () => quickInput(() => matchStore.setMultiplier(3)),
  b: () => guarded(() => matchStore.addBull(false)),
  shift_b: () => guarded(() => matchStore.addBull(true)),
  m: () => guarded(() => matchStore.addMiss()),
  u: () => { if (!isTypingInInput() && !showShortcuts.value && !showRecap.value) void matchStore.undoLastDart() },
  enter: activeElement.value?.closest('button, [role="tab"]') ? undefined : () => quickInput(() => matchStore.submitNumericThrow(), true),
  backspace: () => quickInput(() => matchStore.popNumericDigit(), true),
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
  0: () => quickInput(() => matchStore.appendNumericDigit('0'), true),
  1: () => quickInput(() => matchStore.appendNumericDigit('1'), true),
  2: () => quickInput(() => matchStore.appendNumericDigit('2'), true),
  3: () => quickInput(() => matchStore.appendNumericDigit('3'), true),
  4: () => quickInput(() => matchStore.appendNumericDigit('4'), true),
  5: () => quickInput(() => matchStore.appendNumericDigit('5'), true),
  6: () => quickInput(() => matchStore.appendNumericDigit('6'), true),
  7: () => quickInput(() => matchStore.appendNumericDigit('7'), true),
  8: () => quickInput(() => matchStore.appendNumericDigit('8'), true),
  9: () => quickInput(() => matchStore.appendNumericDigit('9'), true)
})))

async function exitMatch() {
  if (!window.confirm('End this match without a winner?')) return
  if (await matchStore.clearMatch()) await router.push(`/room/${matchStore.room!.id}`)
}

onMounted(async () => {
  await account.load()
  try {
    const room = await $fetch<import('~~/shared/types/rooms').RoomView>(`/api/matches/${String(route.params.id)}`)
    matchStore.acceptRoom(room)
    await matchStore.connect(room.id)
  } catch {
    matchStore.reset()
    matchStore.error = 'This room or match is no longer available. Finished results are kept in History.'
  }
})
onBeforeUnmount(() => matchStore.disconnect())
</script>
