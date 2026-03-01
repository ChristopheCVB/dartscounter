import type { DartInput, Match, Multiplier, Segment, X01Settings } from '~~/shared/types/darts'
import { parsePointsToDart } from '~/composables/useScoringEngine'
import { useHistoryStore } from '~/stores/history'
import { useMatchState } from '~/composables/useMatchState'
import { usePersistence } from '~/composables/usePersistence'
import { useThrowSounds } from '~/composables/useThrowSounds'

function cloneMatch(match: Match): Match {
  return JSON.parse(JSON.stringify(match)) as Match
}

function shufflePlayers<T>(players: T[]): T[] {
  const shuffled = [...players]

  for (let idx = shuffled.length - 1; idx > 0; idx -= 1) {
    const swapIndex = Math.floor(Math.random() * (idx + 1))
    const current = shuffled[idx]
    shuffled[idx] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

export const useMatchStore = defineStore('match', () => {
  const activeMatch = ref<Match | null>(null)
  const undoStack = ref<Match[]>([])
  const selectedMultiplier = ref<Multiplier>(1)
  const numericBuffer = ref('')
  const transitionLocked = ref(false)

  const { createMatch, recordDart, setNumericInput } = useMatchState()
  const { playForThrow } = useThrowSounds()
  const { saveActiveMatch, loadActiveMatch: readActiveMatch } = usePersistence()
  const historyStore = useHistoryStore()

  const currentPlayer = computed(() => {
    if (!activeMatch.value) {
      return null
    }
    return activeMatch.value.players[activeMatch.value.currentPlayerIndex]
  })

  function startMatch(settings: X01Settings, playerNames: string[], recentPlayerIds: Array<string | undefined> = []) {
    const randomizedPlayers = shufflePlayers(playerNames.map((name, idx) => ({
      name,
      recentPlayerId: recentPlayerIds[idx]
    })))

    activeMatch.value = createMatch(
      settings,
      randomizedPlayers.map((player) => player.name)
    )

    if (activeMatch.value) {
      activeMatch.value.players = activeMatch.value.players.map((player, idx) => ({
        ...player,
        recentPlayerId: randomizedPlayers[idx]?.recentPlayerId
      }))
    }

    undoStack.value = []
    selectedMultiplier.value = 1
    numericBuffer.value = ''
    transitionLocked.value = false
    saveActiveMatch(activeMatch.value)
  }

  function pushUndoSnapshot() {
    if (!activeMatch.value || activeMatch.value.status !== 'in_progress') {
      return
    }
    undoStack.value.push(cloneMatch(activeMatch.value))
    if (undoStack.value.length > 200) {
      undoStack.value.shift()
    }
  }

  function setMultiplier(multiplier: Multiplier) {
    selectedMultiplier.value = multiplier
  }

  function appendNumericDigit(digit: string) {
    if (!/^\d$/.test(digit)) {
      return
    }
    numericBuffer.value = setNumericInput(numericBuffer.value, digit)
  }

  function popNumericDigit() {
    numericBuffer.value = numericBuffer.value.slice(0, -1)
  }

  function clearNumericBuffer() {
    numericBuffer.value = ''
  }

  function lockTransition(ms = 420) {
    transitionLocked.value = true
    if (import.meta.client) {
      window.setTimeout(() => {
        transitionLocked.value = false
      }, ms)
    } else {
      transitionLocked.value = false
    }
  }

  function addDart(input: DartInput) {
    if (!activeMatch.value || transitionLocked.value || activeMatch.value.status !== 'in_progress') {
      return
    }

    pushUndoSnapshot()
    const result = recordDart(activeMatch.value, input)
    activeMatch.value = result.updated
    void playForThrow(input)

    const justEndedTurn = activeMatch.value.currentTurnDarts.length === 0 && activeMatch.value.status === 'in_progress'

    if (justEndedTurn) {
      lockTransition()
    }

    if (result.summary) {
      historyStore.addSummary(result.summary)
      saveActiveMatch(null)
      return
    }

    saveActiveMatch(activeMatch.value)
  }

  function addSegment(segment: Segment) {
    addDart({ segment, multiplier: selectedMultiplier.value })
  }

  function addMiss() {
    addDart({ segment: 0, multiplier: 1 })
  }

  function addBull(double = false) {
    addDart({ segment: 25, multiplier: double ? 2 : 1 })
  }

  function submitNumericThrow() {
    if (!activeMatch.value || !numericBuffer.value) {
      return
    }

    const total = Number(numericBuffer.value)
    if (Number.isNaN(total) || total < 0 || total > 60) {
      numericBuffer.value = ''
      return
    }

    const player = activeMatch.value.players[activeMatch.value.currentPlayerIndex]!
    const targetScore = player.score - total
    const preferDouble = activeMatch.value.settings.doubleOut && targetScore === 0
    const parsed = parsePointsToDart(total, preferDouble)

    if (!parsed) {
      numericBuffer.value = ''
      return
    }

    addDart(parsed)
    numericBuffer.value = ''
  }

  function undoLastDart() {
    const previous = undoStack.value.pop()
    if (!previous) {
      return
    }
    activeMatch.value = previous
    saveActiveMatch(activeMatch.value)
  }

  function clearMatch() {
    activeMatch.value = null
    undoStack.value = []
    selectedMultiplier.value = 1
    numericBuffer.value = ''
    transitionLocked.value = false
    saveActiveMatch(null)
  }

  function loadActiveMatch() {
    activeMatch.value = readActiveMatch()
  }

  return {
    activeMatch,
    currentPlayer,
    selectedMultiplier,
    numericBuffer,
    transitionLocked,
    startMatch,
    setMultiplier,
    addDart,
    addSegment,
    addMiss,
    addBull,
    appendNumericDigit,
    popNumericDigit,
    clearNumericBuffer,
    submitNumericThrow,
    undoLastDart,
    clearMatch,
    loadActiveMatch
  }
})
