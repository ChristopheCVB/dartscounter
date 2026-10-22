import type { MaybeRefOrGetter } from 'vue'

export function useScoreSpeech(language: MaybeRefOrGetter<string>, voiceURI: MaybeRefOrGetter<string>) {
  const voices = shallowRef<SpeechSynthesisVoice[]>([])
  const text = ref('')
  const lang = computed(() => toValue(language) || (import.meta.client ? navigator.language : 'en-US'))
  const matchingVoices = computed(() => voices.value.filter(voice => voice.lang === lang.value))
  const selectedVoice = computed(() => matchingVoices.value.find(voice => voice.voiceURI === toValue(voiceURI)))
  const voice = computed(() => selectedVoice.value || matchingVoices.value.find(voice => voice.default) || matchingVoices.value[0])
  const unavailableVoice = computed(() => !!toValue(voiceURI) && !selectedVoice.value)
  const speech = useSpeechSynthesis(text, { lang })

  if (import.meta.client && window.speechSynthesis) {
    const loadVoices = () => { voices.value = window.speechSynthesis.getVoices() }
    loadVoices()
    useEventListener(window.speechSynthesis, 'voiceschanged', loadVoices)
  }

  function stop() {
    if (speech.isSupported.value) speech.stop()
  }
  function speak(score: number) {
    if (!speech.isSupported.value) return
    speech.error.value = undefined
    text.value = String(score)
    speech.utterance.value.voice = voice.value ?? null
    speech.speak()
  }
  onScopeDispose(stop)

  return { voices, matchingVoices, unavailableVoice, isSupported: speech.isSupported, error: speech.error, speak, stop }
}
