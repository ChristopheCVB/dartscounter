import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import type { ComposableOptions } from '@vueuse/sound'
import { useThrowSounds } from '~/composables/useThrowSounds'
import { useSettingsStore } from '~/stores/settings'
import { useMatchState } from '~~/shared/utils/matchState'
import type { DartInput, X01Settings } from '~~/shared/types/darts'

type Clip = { play: ReturnType<typeof vi.fn>, stop: ReturnType<typeof vi.fn>, sound: { value: object | null }, options: ComposableOptions }
const mocks = vi.hoisted(() => ({ speak: vi.fn(), stopSpeech: vi.fn(), clips: new Map<string, Clip>() }))
mockNuxtImport('useScoreSpeech', () => () => ({ speak: mocks.speak, stop: mocks.stopSpeech }))
vi.mock('@vueuse/sound', async () => {
  const { shallowRef } = await import('vue')
  return { useSound: (path: string, options: ComposableOptions = {}) => {
    const clip = { play: vi.fn(), stop: vi.fn(), sound: shallowRef({}), options }
    mocks.clips.set(path, clip)
    return clip
  } }
})
const baseSettings: X01Settings = { mode: 'x01', startScore: 501, doubleIn: false, doubleOut: true, legsTarget: 1 }
function turn(inputs: DartInput[], score = 501, doubleIn = false) {
  const engine = useMatchState()
  const match = engine.createMatch({ ...baseSettings, doubleIn }, [{ id: 'a', name: 'Alice', color: '#f05a28' }])
  match.players[0]!.score = score
  match.currentTurnStartScore = score
  for (const input of inputs) engine.recordDart(match, input)
  return match.throws
}
const twenty = { segment: 20, multiplier: 1 } as const
const miss = { segment: 0, multiplier: 1 } as const

describe('score playback', () => {
  let wrapper: VueWrapper
  let audio: ReturnType<typeof useThrowSounds>
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.clips.clear()
    wrapper = await mountSuspended({ setup() { audio = useThrowSounds(); return () => h('div') } })
  })
  afterEach(() => wrapper.unmount())

  it('keeps individual darts silent and speaks valid totals, including zero', () => {
    audio.playTurn(turn([twenty]))
    audio.playTurn(turn([twenty, twenty]))
    expect(mocks.speak).not.toHaveBeenCalled()
    audio.playTurn(turn([twenty, twenty, twenty]))
    expect(mocks.speak).toHaveBeenLastCalledWith(60)
    audio.playTurn(turn([miss, miss, miss]))
    expect(mocks.speak).toHaveBeenLastCalledWith(0)
    expect(mocks.clips.get('/sounds/miss.mp3')!.play).not.toHaveBeenCalled()
  })

  it('excludes points before double-in', () => {
    audio.playTurn(turn([twenty, { segment: 20, multiplier: 2 }, twenty], 501, true))
    expect(mocks.speak).toHaveBeenCalledWith(60)
  })

  it.each([100, 140, 180])('plays the special %i recording and falls back when it fails', score => {
    const inputs: DartInput[] = score === 100 ? [{ segment: 20, multiplier: 3 }, twenty, twenty]
      : score === 140 ? [{ segment: 20, multiplier: 3 }, { segment: 20, multiplier: 3 }, twenty]
        : Array.from({ length: 3 }, () => ({ segment: 20, multiplier: 3 }))
    const clip = mocks.clips.get(`/sounds/scores/${score}.mp3`)!
    audio.playTurn(turn(inputs))
    expect(clip.play).toHaveBeenCalledOnce()
    expect(mocks.speak).not.toHaveBeenCalled()
    clip.options.onplayerror?.(0, 'blocked')
    expect(mocks.speak).toHaveBeenCalledWith(score)
    audio.playTurn(turn(inputs))
    expect(clip.play).toHaveBeenCalledOnce()
    expect(mocks.speak).toHaveBeenCalledTimes(2)
  })

  it.each([19, 21, 20])('plays only the miss sound for a bust starting at %i', score => {
    audio.playTurn(turn([twenty], score))
    expect(mocks.clips.get('/sounds/miss.mp3')!.play).toHaveBeenCalledOnce()
    expect(mocks.speak).not.toHaveBeenCalled()
  })

  it.each([1, 2, 3])('skips totals on a checkout with dart %i', dartIndex => {
    const inputs: DartInput[] = [...Array.from({ length: dartIndex - 1 }, () => miss), { segment: 10, multiplier: 2 }]
    audio.playTurn(turn(inputs, 20))
    expect(mocks.speak).not.toHaveBeenCalled()
    expect(mocks.clips.get('/sounds/miss.mp3')!.play).not.toHaveBeenCalled()
  })

  it('interrupts old audio, ignores stale failures, and honors mute for all playback', () => {
    audio.playTurn(turn([{ segment: 20, multiplier: 3 }, { segment: 20, multiplier: 3 }, { segment: 20, multiplier: 3 }]))
    const clip = mocks.clips.get('/sounds/scores/180.mp3')!
    audio.playTurn(turn([twenty, twenty, twenty]))
    expect(clip.stop).toHaveBeenCalled()
    clip.options.onloaderror?.(0, 'failed')
    expect(mocks.speak).toHaveBeenCalledTimes(1)
    const store = useSettingsStore()
    store.soundEnabled = false
    expect(mocks.stopSpeech).toHaveBeenCalled()
    audio.playTurn(turn([twenty, twenty, twenty]))
    audio.playTurn(turn([twenty], 10))
    audio.playConfetti()
    expect(mocks.speak).toHaveBeenCalledTimes(1)
    expect(mocks.clips.get('/sounds/miss.mp3')!.play).not.toHaveBeenCalled()
    expect(mocks.clips.get('/sounds/confetti.mp3')!.play).not.toHaveBeenCalled()
  })
})
