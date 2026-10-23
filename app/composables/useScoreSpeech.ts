import type { MaybeRefOrGetter } from 'vue'

export function useScoreSpeech(language: MaybeRefOrGetter<string>, voiceURI: MaybeRefOrGetter<string>) {
  const voices = shallowRef<SpeechSynthesisVoice[]>([])
  const synth = import.meta.client ? window.speechSynthesis : undefined
  const isSupported = useSupported(() => !!synth)
  const error = shallowRef<SpeechSynthesisErrorEvent>()
  let utterance: SpeechSynthesisUtterance | undefined
  const lang = computed(() => toValue(language) || (import.meta.client ? navigator.language : 'en-US'))
  const matchingVoices = computed(() => voices.value.filter(voice => voice.lang === lang.value))
  const selectedVoice = computed(() => matchingVoices.value.find(voice => voice.voiceURI === toValue(voiceURI)))
  const voice = computed(() => selectedVoice.value || matchingVoices.value.find(voice => voice.default) || matchingVoices.value[0])
  const unavailableVoice = computed(() => !!toValue(voiceURI) && !selectedVoice.value)

  if (synth) {
    const loadVoices = () => { voices.value = synth.getVoices() }
    loadVoices()
    useEventListener(synth, 'voiceschanged', loadVoices)
  }

  function stop() {
    if (!synth || !utterance) return
    utterance = undefined
    synth.cancel()
  }
  function speak(score: number) {
    if (!synth) return
    stop()
    error.value = undefined
    // Fresh utterances avoid cached playback and pause state between repeated scores.
    const next = new SpeechSynthesisUtterance(String(score))
    next.lang = lang.value
    next.voice = voice.value ?? null
    next.onend = () => { if (utterance === next) utterance = undefined }
    next.onerror = event => {
      if (utterance !== next) return
      utterance = undefined
      error.value = event
    }
    utterance = next
    if (synth.paused) synth.resume()
    synth.speak(next)
  }
  onScopeDispose(stop)

  return { voices, matchingVoices, unavailableVoice, isSupported, error, speak, stop }
}
