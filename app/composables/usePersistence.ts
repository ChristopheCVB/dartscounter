import type { Match, MatchSummary, X01Settings } from '~~/shared/types/darts'

export type StoredRecentPlayer = {
  id: string
  name: string
  color?: string
}

export type StoredSettings = X01Settings & {
  soundEnabled?: boolean
}

const VERSION = 'v1'
const ACTIVE_MATCH_KEY = `dartcounter:${VERSION}:active-match`
const HISTORY_KEY = `dartcounter:${VERSION}:history`
const SETTINGS_KEY = `dartcounter:${VERSION}:settings`
const RECENT_PLAYERS_KEY = `dartcounter:${VERSION}:recent-players`

function safeRead<T>(key: string, fallback: T): T {
  if (!import.meta.client) {
    return fallback
  }

  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeWrite<T>(key: string, payload: T) {
  if (!import.meta.client) {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(payload))
}

export function usePersistence() {
  const saveActiveMatch = (match: Match | null) => {
    if (!match) {
      if (import.meta.client) {
        window.localStorage.removeItem(ACTIVE_MATCH_KEY)
      }
      return
    }

    safeWrite(ACTIVE_MATCH_KEY, match)
  }

  const loadActiveMatch = () => safeRead<Match | null>(ACTIVE_MATCH_KEY, null)

  const saveHistory = (history: MatchSummary[]) => safeWrite(HISTORY_KEY, history)
  const loadHistory = () => safeRead<MatchSummary[]>(HISTORY_KEY, [])

  const saveSettings = (settings: StoredSettings) => safeWrite(SETTINGS_KEY, settings)
  const loadSettings = (fallback: StoredSettings) => safeRead<StoredSettings>(SETTINGS_KEY, fallback)

  const saveRecentPlayers = (players: StoredRecentPlayer[]) => safeWrite(RECENT_PLAYERS_KEY, players)
  const loadRecentPlayers = () => safeRead<StoredRecentPlayer[] | string[]>(RECENT_PLAYERS_KEY, [])

  return {
    saveActiveMatch,
    loadActiveMatch,
    saveHistory,
    loadHistory,
    saveSettings,
    loadSettings,
    saveRecentPlayers,
    loadRecentPlayers
  }
}
