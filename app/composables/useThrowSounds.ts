import type { DartInput } from '~~/shared/types/darts'
import { useSupported } from '@vueuse/core'

const SOUND_FILES = {
  double: '/sounds/double.mp3',
  triple: '/sounds/triple.mp3',
  bull: '/sounds/bull.mp3',
  miss: '/sounds/miss.mp3'
} as const

export function useThrowSounds() {
  const isAudioSupported = useSupported(() => import.meta.client && typeof window.Audio !== 'undefined')
  const players: Partial<Record<keyof typeof SOUND_FILES, HTMLAudioElement>> = {}

  const ensurePlayer = (kind: keyof typeof SOUND_FILES) => {
    if (!isAudioSupported.value) {
      return null
    }

    if (!players[kind]) {
      const audio = new Audio(SOUND_FILES[kind])
      audio.preload = 'auto'
      audio.volume = 0.35
      players[kind] = audio
    }

    return players[kind] || null
  }

  const play = (kind: keyof typeof SOUND_FILES) => {
    const player = ensurePlayer(kind)
    if (!player) {
      return
    }

    player.currentTime = 0
    void player.play().catch(() => {})
  }

  const playForThrow = (input: DartInput) => {

    if (input.segment === 0) {
      play('miss')
      return
    }

    if (input.segment === 25) {
      play('bull')
      return
    }

    if (input.multiplier === 3) {
      play('triple')
      return
    }

    if (input.multiplier === 2) {
      play('double')
    }
  }

  return {
    playForThrow
  }
}
