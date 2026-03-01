import type { DartInput } from '~~/shared/types/darts'
import { useSound } from '@vueuse/sound'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '~/stores/settings'

const SOUND_FILES = {
  single: '/sounds/single.mp3',
  double: '/sounds/double.mp3',
  triple: '/sounds/triple.mp3',
  bullSingle: '/sounds/bull-single.mp3',
  bullDouble: '/sounds/bull-double.mp3',
  miss: '/sounds/miss.mp3',
  confetti: '/sounds/confetti.mp3'
} as const

export function useThrowSounds() {
  const settingsStore = useSettingsStore()
  const { soundEnabled } = storeToRefs(settingsStore)
  const soundOptions = { interrupt: true }

  const { play: basePlaySingle } = useSound(SOUND_FILES.single, { ...soundOptions, volume: 1 })
  const { play: basePlayDouble } = useSound(SOUND_FILES.double, { ...soundOptions, volume: 1 })
  const { play: basePlayTriple } = useSound(SOUND_FILES.triple, { ...soundOptions, volume: 1 })
  const { play: basePlayBullSingle } = useSound(SOUND_FILES.bullSingle, { ...soundOptions, volume: 1 })
  const { play: basePlayBullDouble } = useSound(SOUND_FILES.bullDouble, { ...soundOptions, volume: 1 })
  const { play: basePlayMiss } = useSound(SOUND_FILES.miss, { ...soundOptions, volume: 1 })
  const { play: basePlayCelebration } = useSound(SOUND_FILES.confetti, { ...soundOptions, volume: 1 })

  const playSingle = () => soundEnabled.value && basePlaySingle()
  const playDouble = () => soundEnabled.value && basePlayDouble()
  const playTriple = () => soundEnabled.value && basePlayTriple()
  const playBullSingle = () => soundEnabled.value && basePlayBullSingle()
  const playBullDouble = () => soundEnabled.value && basePlayBullDouble()
  const playMiss = () => soundEnabled.value && basePlayMiss()
  const playCelebration = () => soundEnabled.value && basePlayCelebration()

  const playForThrow = (input: DartInput) => {

    if (input.segment === 0) {
      playMiss()
      return
    }

    if (input.segment === 25) {
      if (input.multiplier === 2) {
        playBullDouble()
        return
      }

      playBullSingle()
      return
    }

    if (input.multiplier === 3) {
      playTriple()
      return
    }

    if (input.multiplier === 2) {
      playDouble()
      return
    }

    playSingle()
  }

  const playConfetti = () => {
    playCelebration()
  }

  return {
    playForThrow,
    playConfetti
  }
}
