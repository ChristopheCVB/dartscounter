import { createError, readBody } from 'h3'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccountStore } from '~/stores/account'
import { useMatchStore } from '~/stores/match'
import { useMatchState } from '~~/shared/utils/matchState'
import type { DartInput, Match, X01Settings } from '~~/shared/types/darts'
import type { RoomView } from '~~/shared/types/rooms'

const sounds = vi.hoisted(() => ({ playTurn: vi.fn(), playConfetti: vi.fn(), stop: vi.fn() }))
mockNuxtImport('useThrowSounds', () => () => sounds)
const engine = useMatchState()
const settings: X01Settings = { mode: 'x01', startScore: 501, doubleIn: false, doubleOut: true, legsTarget: 2 }
const seeds = [{ id: 'alice', name: 'Alice', color: '#f05a28' }, { id: 'bob', name: 'Bob', color: '#24a8ff' }]
function room(match: Match, revision: number): RoomView {
  return { id: 'room', code: 'ABCDEFGH', ownerId: 'owner', revision, settings: match.settings, members: [], match: structuredClone(match), summary: null, controllers: {}, participantIds: [], canUndo: true, locked: false }
}
function darts(match: Match, inputs: DartInput[]) {
  for (const input of inputs) engine.recordDart(match, input)
}
const twenty = { segment: 20, multiplier: 1 } as const

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('current room membership', () => {
  it('keeps the current room between matches and updates presence without a scoring revision', () => {
    const account = useAccountStore()
    account.userId = 'owner'
    const store = useMatchStore()
    const active = { ...room(engine.createMatch(settings, seeds), 1), participantIds: ['owner'] }
    store.acceptRoom(active)
    expect(account.currentRoom?.id).toBe('room')
    store.acceptRoom({ ...active, members: [{ userId: 'owner', name: 'Owner', roster: [], ready: false, connected: false, expiresAt: Date.now() + 100_000 }] })
    expect(account.currentRoom?.members[0]?.connected).toBe(false)
    store.acceptRoom({ ...active, revision: 2, match: { ...active.match!, status: 'abandoned' } })
    expect(account.currentRoom?.match?.status).toBe('abandoned')
    account.clear()
    expect(account.currentRoom).toBeNull()
  })

  it('refreshes account status when another device has started a conflicting match', async () => {
    const account = useAccountStore()
    const reload = vi.spyOn(account, 'load').mockResolvedValue(null)
    const lobby = { ...room(engine.createMatch(settings, seeds), 0), match: null }
    const store = useMatchStore()
    store.acceptRoom(lobby)
    store.connected = true
    const removeAction = registerEndpoint('/api/rooms/room/actions', { method: 'POST', handler: () => { throw createError({ statusCode: 409, statusMessage: 'Already playing elsewhere' }) } })
    const removeRoom = registerEndpoint('/api/rooms/room', () => lobby)
    try {
      expect(await store.act({ type: 'start' })).toBe(false)
      expect(reload).toHaveBeenCalledOnce()
      expect(store.uncertain).toBeNull()
    } finally { removeAction(); removeRoom(); reload.mockRestore() }
  })

  it('tracks the current room for spectators too', () => {
    useAccountStore().userId = 'spectator'
    useMatchStore().acceptRoom({ ...room(engine.createMatch(settings, seeds), 1), participantIds: ['owner'] })
    expect(useAccountStore().currentRoom?.id).toBe('room')
  })

  it('retains an ambiguous leave for retry with the same revision, then clears room state', async () => {
    const account = useAccountStore()
    const reload = vi.spyOn(account, 'load').mockResolvedValue(null)
    const current = room(engine.createMatch(settings, seeds), 7)
    const store = useMatchStore()
    store.acceptRoom(current)
    let succeed = false
    const revisions: number[] = []
    const remove = registerEndpoint('/api/rooms/room/membership', { method: 'DELETE', handler: async event => {
      revisions.push((await readBody(event)).expectedRevision)
      if (!succeed) throw createError({ statusCode: 503, statusMessage: 'Response lost' })
      return { ok: true }
    } })
    try {
      expect(await store.leaveRoom(current)).toBe(false)
      expect(store.uncertain).toMatchObject({ roomId: 'room', expectedRevision: 7, action: { type: 'leave' } })
      expect(account.currentRoom?.id).toBe('room')
      succeed = true
      expect(await store.retryUncertain()).toBe(true)
      expect(revisions.length).toBeGreaterThanOrEqual(2)
      expect(revisions.every(revision => revision === 7)).toBe(true)
      expect(store.room).toBeNull()
      expect(store.uncertain).toBeNull()
      expect(account.currentRoom).toBeNull()
      expect(reload).toHaveBeenCalledOnce()
    } finally { remove(); reload.mockRestore() }
  })

  it('accepts a successful leave when SSE revocation arrives before its HTTP response', async () => {
    class RoomSource extends EventTarget {
      static current: RoomSource
      constructor() { super(); RoomSource.current = this }
      close() {}
    }
    vi.stubGlobal('EventSource', RoomSource)
    const account = useAccountStore()
    const reload = vi.spyOn(account, 'load').mockResolvedValue(null)
    const store = useMatchStore()
    const current = room(engine.createMatch(settings, seeds), 8)
    store.acceptRoom(current)
    const remove = registerEndpoint('/api/rooms/room/membership', { method: 'DELETE', handler: () => {
      RoomSource.current.dispatchEvent(new Event('revoked'))
      return { ok: true }
    } })
    try {
      await store.connect('room')
      expect(await store.leaveRoom(current)).toBe(true)
      expect(store.uncertain).toBeNull()
      expect(account.currentRoom).toBeNull()
    } finally { store.disconnect(); remove(); reload.mockRestore(); vi.unstubAllGlobals() }
  })
})

describe('live turn audio', () => {
  it('waits for dart three and deduplicates HTTP/SSE responses for every viewer', () => {
    const store = useMatchStore()
    const match = engine.createMatch(settings, seeds)
    store.acceptRoom(room(match, 0))
    for (let revision = 1; revision <= 3; revision++) {
      darts(match, [twenty])
      store.acceptRoom(room(match, revision), true)
      store.acceptRoom(room(match, revision), true)
      expect(sounds.playTurn).toHaveBeenCalledTimes(revision === 3 ? 1 : 0)
    }
    expect(sounds.playTurn.mock.calls[0]![0].map((dart: { scoredPoints: number }) => dart.scoredPoints)).toEqual([20, 20, 20])
  })

  it('keeps initial load and catch-up silent and plays only the newest coalesced result', () => {
    const store = useMatchStore()
    const match = engine.createMatch(settings, seeds)
    darts(match, [twenty, twenty, twenty])
    store.acceptRoom(room(match, 1), true)
    darts(match, [twenty, twenty, twenty])
    store.acceptRoom(room(match, 2))
    expect(sounds.playTurn).not.toHaveBeenCalled()
    darts(match, [twenty, twenty, twenty, twenty, twenty, twenty])
    store.acceptRoom(room(match, 3), true)
    expect(sounds.playTurn).toHaveBeenCalledTimes(1)
    expect(sounds.playTurn.mock.calls[0]![0][0].turnIndex).toBe(3)
  })

  it('cancels undo and announces the corrected turn on rethrow', () => {
    const store = useMatchStore()
    const match = engine.createMatch(settings, seeds)
    darts(match, [twenty, twenty])
    const beforeThird = structuredClone(match)
    store.acceptRoom(room(match, 1))
    darts(match, [twenty])
    store.acceptRoom(room(match, 2), true)
    sounds.stop.mockClear()
    store.acceptRoom(room(beforeThird, 3), true)
    expect(sounds.stop).toHaveBeenCalledOnce()
    expect(sounds.playTurn).toHaveBeenCalledOnce()
    darts(beforeThird, [{ segment: 1, multiplier: 1 }])
    store.acceptRoom(room(beforeThird, 4), true)
    expect(sounds.playTurn).toHaveBeenCalledTimes(2)
    expect(sounds.playTurn.mock.calls[1]![0].at(-1).scoredPoints).toBe(1)
  })

  it('takes only the current leg’s darts when turn indexes reset', () => {
    const store = useMatchStore()
    const match = engine.createMatch(settings, seeds)
    darts(match, [twenty, twenty, twenty, twenty, twenty, twenty])
    const player = match.players[match.currentPlayerIndex]!
    player.score = 20
    match.currentTurnStartScore = 20
    store.acceptRoom(room(match, 1))
    darts(match, [{ segment: 10, multiplier: 2 }])
    store.acceptRoom(room(match, 2), true)
    expect(sounds.playTurn.mock.calls[0]![0]).toHaveLength(1)
    darts(match, [twenty, twenty, twenty])
    store.acceptRoom(room(match, 3), true)
    expect(sounds.playTurn.mock.calls[1]![0]).toHaveLength(3)
    expect(sounds.playTurn.mock.calls[1]![0].every((dart: { isCheckout: boolean }) => !dart.isCheckout)).toBe(true)
    expect(sounds.playConfetti).not.toHaveBeenCalled()
  })

  it('announces a corrected result when undo and rethrow arrive in one update', () => {
    const store = useMatchStore()
    const match = engine.createMatch(settings, seeds)
    darts(match, [twenty, twenty])
    const corrected = structuredClone(match)
    darts(match, [twenty])
    store.acceptRoom(room(match, 1))
    darts(corrected, [{ segment: 1, multiplier: 1 }])
    store.acceptRoom(room(corrected, 3), true)
    expect(sounds.playTurn).toHaveBeenCalledOnce()
    expect(sounds.playTurn.mock.calls[0]![0].at(-1).scoredPoints).toBe(1)
  })

  it.each(['x01', 'atc'] as const)('celebrates a %s match win once and cancels on disconnect', mode => {
    const store = useMatchStore()
    const match = engine.createMatch(mode === 'atc' ? { mode, fastForward: false } : { ...settings, legsTarget: 1 }, seeds)
    if (mode === 'x01') { match.players[0]!.score = 20; match.currentTurnStartScore = 20 }
    else match.players[0]!.atcTarget = 21
    store.acceptRoom(room(match, 1))
    darts(match, [mode === 'x01' ? { segment: 10, multiplier: 2 } : { segment: 25, multiplier: 1 }])
    store.acceptRoom(room(match, 2), true)
    store.acceptRoom(room(match, 2), true)
    expect(sounds.playConfetti).toHaveBeenCalledOnce()
    expect(sounds.playTurn).not.toHaveBeenCalled()
    sounds.stop.mockClear()
    store.disconnect()
    expect(sounds.stop).toHaveBeenCalledOnce()
  })

  it('passes an early bust to playback and keeps Around the Clock darts silent', () => {
    const store = useMatchStore()
    const match = engine.createMatch(settings, seeds)
    match.players[0]!.score = 10
    match.currentTurnStartScore = 10
    store.acceptRoom(room(match, 1))
    darts(match, [twenty])
    store.acceptRoom(room(match, 2), true)
    expect(sounds.playTurn.mock.calls[0]![0][0].isBust).toBe(true)
    const atc = engine.createMatch({ mode: 'atc', fastForward: false }, seeds)
    store.acceptRoom(room(atc, 3))
    darts(atc, [twenty, twenty, twenty])
    store.acceptRoom(room(atc, 4), true)
    expect(sounds.playTurn).toHaveBeenCalledOnce()
  })
})
