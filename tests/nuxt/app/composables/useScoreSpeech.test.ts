import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { useScoreSpeech } from '~/composables/useScoreSpeech'

const french: SpeechSynthesisVoice = { voiceURI: 'fr-voice', name: 'French voice', lang: 'fr-FR', default: false, localService: true }
const english: SpeechSynthesisVoice = { voiceURI: 'en-voice', name: 'English voice', lang: 'en-US', default: true, localService: true }
const language = ref('fr-FR')
const voiceURI = ref('fr-voice')
let voices: SpeechSynthesisVoice[]
let wrapper: VueWrapper
let speech: ReturnType<typeof useScoreSpeech>
const spoken: Array<{ text: string, lang: string, voice: SpeechSynthesisVoice | null }> = []
const utterances: SpeechSynthesisUtterance[] = []
const synth = Object.assign(new EventTarget(), {
  getVoices: () => voices,
  paused: false,
  cancel: vi.fn(),
  resume: vi.fn(() => { synth.paused = false }),
  pause: vi.fn(() => { synth.paused = true }),
  speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
    utterances.push(utterance)
    spoken.push({ text: utterance.text, lang: utterance.lang, voice: utterance.voice })
  })
})

async function mountSpeech() {
  wrapper = await mountSuspended({ setup() { speech = useScoreSpeech(language, voiceURI); return () => h('div') } })
}
beforeEach(() => {
  language.value = 'fr-FR'
  voiceURI.value = 'fr-voice'
  voices = [french, english]
  spoken.length = 0
  utterances.length = 0
  synth.paused = false
  vi.clearAllMocks()
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
})
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })

describe('native score speech', () => {
  it('uses the selected language and voice for repeated number-only announcements', async () => {
    await mountSpeech()
    speech.speak(60)
    speech.speak(60)
    expect(spoken).toEqual([{ text: '60', lang: 'fr-FR', voice: french }, { text: '60', lang: 'fr-FR', voice: french }])
    expect(synth.cancel).toHaveBeenCalledOnce()
    expect(speech.matchingVoices.value).toEqual([french])
  })

  it('plays the same preview again after completion without pausing or reusing its utterance', async () => {
    await mountSpeech()
    speech.speak(60)
    utterances[0]!.onstart?.(new Event('start') as SpeechSynthesisEvent)
    await nextTick()
    utterances[0]!.onend?.(new Event('end') as SpeechSynthesisEvent)
    await nextTick()
    speech.speak(60)
    expect(utterances).toHaveLength(2)
    expect(utterances[1]).not.toBe(utterances[0])
    expect(synth.pause).not.toHaveBeenCalled()
    expect(synth.cancel).not.toHaveBeenCalled()
  })

  it('resumes a paused engine and ignores stale cancellation errors', async () => {
    await mountSpeech()
    synth.paused = true
    speech.speak(60)
    expect(synth.resume).toHaveBeenCalledOnce()
    expect(synth.paused).toBe(false)
    speech.speak(45)
    utterances[0]!.onerror?.({ error: 'canceled' } as SpeechSynthesisErrorEvent)
    expect(speech.error.value).toBeUndefined()
    const failure = { error: 'not-allowed' } as SpeechSynthesisErrorEvent
    utterances[1]!.onerror?.(failure)
    expect(speech.error.value).toBe(failure)
    speech.speak(45)
    expect(speech.error.value).toBeUndefined()
    speech.stop()
    expect(synth.cancel).toHaveBeenCalledTimes(2)
  })

  it('refreshes delayed voices and falls back when the saved voice is unavailable', async () => {
    voices = []
    await mountSpeech()
    expect(speech.unavailableVoice.value).toBe(true)
    speech.speak(25)
    expect(spoken.at(-1)).toEqual({ text: '25', lang: 'fr-FR', voice: null })
    voices = [french, english]
    synth.dispatchEvent(new Event('voiceschanged'))
    await nextTick()
    expect(speech.unavailableVoice.value).toBe(false)
    voiceURI.value = 'missing'
    speech.speak(26)
    expect(spoken.at(-1)?.voice).toEqual(french)
    expect(speech.unavailableVoice.value).toBe(true)
  })

  it('defaults to the browser language and cancels when disposed', async () => {
    language.value = ''
    voiceURI.value = ''
    await mountSpeech()
    speech.speak(60)
    expect(spoken.at(-1)?.lang).toBe(navigator.language)
    synth.cancel.mockClear()
    wrapper.unmount()
    expect(synth.cancel).toHaveBeenCalledOnce()
  })

  it('does not throw when native speech is unavailable', async () => {
    vi.stubGlobal('speechSynthesis', undefined)
    await mountSpeech()
    expect(speech.isSupported.value).toBeFalsy()
    expect(() => { speech.speak(60); speech.stop() }).not.toThrow()
    expect(spoken).toEqual([])
  })
})
