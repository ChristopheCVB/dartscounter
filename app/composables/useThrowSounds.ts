import type { ThrowEvent } from '~~/shared/types/darts'
import { useSound } from '@vueuse/sound'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '~/stores/settings'

export function useThrowSounds() {
  const { soundEnabled, announcementLanguage, announcementVoice } = storeToRefs(useSettingsStore())
  const speech = useScoreSpeech(announcementLanguage, announcementVoice)
  let activeScore: number | null = null
  const failedScores = new Set<number>()
  function fallback(score: number) {
    failedScores.add(score)
    if (activeScore !== score) return
    activeScore = null
    scoreSounds.get(score)?.stop()
    if (soundEnabled.value) speech.speak(score)
  }
  const scoreSounds = new Map([100, 140, 180].map(score => [score, useSound(`/sounds/scores/${score}.mp3`, {
    onloaderror: () => fallback(score),
    onplayerror: () => fallback(score),
    onend: () => { if (activeScore === score) activeScore = null }
  })]))
  const miss = useSound('/sounds/miss.mp3')
  const celebration = useSound('/sounds/confetti.mp3')

  function stop() {
    activeScore = null
    speech.stop()
    for (const clip of scoreSounds.values()) clip.stop()
    miss.stop()
    celebration.stop()
  }
  function playTurn(darts: ThrowEvent[]) {
    const last = darts.at(-1)
    if (!last || (!last.isBust && !last.isCheckout && last.dartIndex !== 3)) return
    stop()
    if (!soundEnabled.value || last.isCheckout) return
    if (last.isBust) {
      miss.play()
      return
    }
    const score = darts.reduce((total, dart) => total + dart.scoredPoints, 0)
    const clip = scoreSounds.get(score)
    if (clip?.sound.value && !failedScores.has(score)) {
      activeScore = score
      clip.play()
    } else speech.speak(score)
  }
  function playConfetti() {
    stop()
    if (soundEnabled.value) celebration.play()
  }
  watch(soundEnabled, enabled => { if (!enabled) stop() }, { flush: 'sync' })
  onScopeDispose(stop)
  return { playTurn, playConfetti, stop }
}
