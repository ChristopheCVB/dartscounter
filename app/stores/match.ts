import { useAccountStore } from '~/stores/account'
import type { DartInput, GameSettings, Multiplier, Segment } from '~~/shared/types/darts'
import type { RoomView } from '~~/shared/types/rooms'
import type { RoomAction } from '~~/shared/utils/validation'
import { parsePointsToDart } from '~~/shared/utils/scoringEngine'
import { useMatchState } from '~~/shared/utils/matchState'
import { apiError } from '~/utils/apiError'

export const useMatchStore = defineStore('match', () => {
  const room = ref<RoomView | null>(null)
  const activeMatch = computed(() => room.value?.match ?? null)
  const currentPlayer = computed(() => activeMatch.value?.players[activeMatch.value.currentPlayerIndex] ?? null)
  const selectedMultiplier = ref<Multiplier>(1)
  const numericBuffer = ref('')
  const transitionLocked = ref(false)
  const connected = ref(false)
  const pending = ref(false)
  const error = ref('')
  let source: EventSource | undefined
  let generation = 0
  let refreshSequence = 0
  const uncertain = ref<{ roomId: string, requestId: string, expectedRevision: number, action: RoomAction | { type: 'leave' } } | null>(null)
  const sounds = useThrowSounds()
  const canScore = computed(() => connected.value && !pending.value && !uncertain.value && !transitionLocked.value && activeMatch.value?.status === 'in_progress' && !!currentPlayer.value && room.value?.controllers[currentPlayer.value.id] === useAccountStore().userId)
  const canUndo = computed(() => connected.value && !pending.value && !uncertain.value && !!room.value?.canUndo)

  function acceptRoom(next: RoomView, live = false) {
    if (room.value?.id === next.id && room.value.revision > next.revision) return
    const previous = room.value
    room.value = next
    const account = useAccountStore()
    account.currentRoom = next
    if (previous?.id === next.id && previous.revision === next.revision) return
    if (previous?.match?.id !== next.match?.id) {
      sounds.stop()
      numericBuffer.value = ''
      selectedMultiplier.value = 1
      transitionLocked.value = false
    }
    if (previous?.match && next.match && previous.match.id === next.match.id) {
      const before = previous.match.throws
      const after = next.match.throws
      const firstNewDart = after.findIndex((dart, index) => dart.id !== before[index]?.id)
      if (before.some((dart, index) => dart.id !== after[index]?.id) || next.match.status === 'abandoned') sounds.stop()
      if (live && firstNewDart !== -1 && next.match.status !== 'abandoned') {
        if (next.match.status === 'finished') sounds.playConfetti()
        else if (next.match.settings.mode === 'x01') {
          const lastNewResult = after.findLastIndex((dart, index) => index >= firstNewDart && (dart.isBust || dart.isCheckout || dart.dartIndex === 3))
          const last = after[lastNewResult]
          if (last) sounds.playTurn(after.slice(lastNewResult - last.dartIndex + 1, lastNewResult + 1))
        }
      }
    }
    if (live && previous?.match?.id === next.match?.id) {
      if (previous?.match?.currentPlayerIndex !== next.match?.currentPlayerIndex) {
        transitionLocked.value = true
        setTimeout(() => { transitionLocked.value = false }, 420)
      }
    }
    if (live && previous?.summary?.id !== next.summary?.id) void useAccountStore().load()
  }
  async function refresh(id = room.value?.id, live = false) {
    if (!id) return
    const mine = generation
    const next = await $fetch<RoomView>(`/api/rooms/${id}`)
    if (mine === generation) acceptRoom(next, live)
  }
  function disconnect() {
    sounds.stop()
    generation++
    source?.close()
    source = undefined
    connected.value = false
    pending.value = false
  }
  function reset() {
    disconnect()
    room.value = null
    uncertain.value = null
    numericBuffer.value = ''
    selectedMultiplier.value = 1
    transitionLocked.value = false
    error.value = ''
  }
  async function connect(id: string) {
    disconnect()
    const mine = generation
    source = new EventSource(`/api/rooms/${id}/events`)
    source.addEventListener('update', async () => {
      const sequence = ++refreshSequence
      try {
        await refresh(id, connected.value)
        if (mine === generation && sequence === refreshSequence) {
          connected.value = true
          if (!uncertain.value) error.value = ''
        }
      } catch (cause) { if (mine === generation) error.value = apiError(cause) }
    })
    source.addEventListener('revoked', () => {
      if (mine !== generation) return
      if (uncertain.value?.roomId === id && uncertain.value.action.type === 'leave') {
        source?.close()
        connected.value = false
        sounds.stop()
        return
      }
      disconnect()
      room.value = null
      uncertain.value = null
      if (useAccountStore().currentRoom?.id === id) useAccountStore().currentRoom = null
      error.value = 'This room is no longer available. Return to Play or check History for finished results.'
      void useAccountStore().load()
    })
    source.onerror = () => {
      if (mine !== generation) return
      connected.value = false
      sounds.stop()
      error.value = 'Connection lost. Scoring is paused while reconnecting.'
    }
  }
  async function send(request: NonNullable<typeof uncertain.value>) {
    const mine = generation
    uncertain.value = request
    pending.value = true
    try {
      if (request.action.type === 'leave') {
        await $fetch(`/api/rooms/${request.roomId}/membership`, { method: 'DELETE', body: { expectedRevision: request.expectedRevision }, retry: 1, retryStatusCodes: [408, 502, 503, 504], timeout: 15_000 })
        if (mine !== generation) return false
        reset()
        useAccountStore().currentRoom = null
        await useAccountStore().load()
        return true
      }
      const next = await $fetch<RoomView>(`/api/rooms/${request.roomId}/actions`, { method: 'POST', body: request, retry: 1, retryStatusCodes: [408, 502, 503, 504], timeout: 15_000 })
      if (mine !== generation) return false
      if (room.value?.id === request.roomId) acceptRoom(next, true)
      uncertain.value = null
      error.value = ''
      if (room.value?.id === request.roomId) await refresh(request.roomId)
      return true
    } catch (cause) {
      if (mine !== generation) return false
      const status = (cause as { statusCode?: number }).statusCode
      if (!status || status >= 500 || status === 408) uncertain.value = request
      else {
        uncertain.value = null
        if (request.action.type !== 'leave' && room.value?.id === request.roomId) await refresh(request.roomId).catch(() => {})
        if ((request.action.type === 'start' || request.action.type === 'leave') && status === 409) {
          const data = await useAccountStore().load()
          if (request.action.type === 'leave' && room.value?.id === request.roomId && data?.currentRoom) acceptRoom(data.currentRoom)
        }
      }
      error.value = apiError(cause)
      return false
    } finally { if (mine === generation) pending.value = false }
  }
  async function act(action: RoomAction) {
    if (!room.value || pending.value || uncertain.value || !connected.value) return false
    return send({ roomId: room.value.id, requestId: crypto.randomUUID(), expectedRevision: room.value.revision, action })
  }
  async function retryUncertain() { if (uncertain.value && !pending.value) return send(uncertain.value) }
  async function leaveRoom(target: RoomView) {
    if (pending.value || uncertain.value) return false
    return send({ roomId: target.id, requestId: crypto.randomUUID(), expectedRevision: target.revision, action: { type: 'leave' } })
  }
  async function startMatch(settings: GameSettings, players: Array<{ id: string, name: string, color: string }>) {
    try {
      const created = await $fetch<RoomView>('/api/rooms', { method: 'POST', body: { settings } })
      acceptRoom(created)
      for (const action of [{ type: 'roster', playerIds: players.map(p => p.id) }, { type: 'ready', ready: true }, { type: 'start' }] as RoomAction[]) {
        const request = { roomId: created.id, requestId: crypto.randomUUID(), expectedRevision: room.value!.revision, action }
        if (!await send(request)) return false
      }
      return true
    } catch (cause) { error.value = apiError(cause); return false }
  }
  function setMultiplier(value: Multiplier) { selectedMultiplier.value = value }
  function appendNumericDigit(digit: string) {
    if (/^\d$/.test(digit)) numericBuffer.value = useMatchState().setNumericInput(numericBuffer.value, digit)
  }
  function popNumericDigit() { numericBuffer.value = numericBuffer.value.slice(0, -1) }
  function clearNumericBuffer() { numericBuffer.value = '' }
  async function addDart(dart: DartInput) { if (canScore.value) return act({ type: 'dart', dart }) }
  function addSegment(segment: Segment) { return addDart({ segment, multiplier: selectedMultiplier.value }) }
  function addMiss() { return addDart({ segment: 0, multiplier: 1 }) }
  function addBull(double = false) { return addDart({ segment: 25, multiplier: double ? 2 : 1 }) }
  async function submitNumericThrow() {
    if (!canScore.value || !numericBuffer.value || activeMatch.value?.settings.mode !== 'x01') return
    const total = Number(numericBuffer.value)
    const parsed = parsePointsToDart(total, activeMatch.value.settings.doubleOut && currentPlayer.value!.score - total === 0)
    if (parsed && await addDart(parsed)) numericBuffer.value = ''
  }
  async function undoLastDart() { if (canUndo.value) return act({ type: 'undo' }) }
  async function clearMatch() { return act({ type: 'abandon' }) }
  return { room, activeMatch, currentPlayer, selectedMultiplier, numericBuffer, transitionLocked, connected, pending, error, uncertain, canScore, canUndo, acceptRoom, connect, disconnect, reset, refresh, act, retryUncertain, leaveRoom, startMatch, setMultiplier, appendNumericDigit, popNumericDigit, clearNumericBuffer, addDart, addSegment, addMiss, addBull, submitNumericThrow, undoLastDart, clearMatch }
})
