import type { AtcSettings, GameSettings, Match, MatchStatus, MatchSummary, PlayerIdentity, X01Settings } from './darts'

export interface Preferences {
  settings: X01Settings
  atcSettings: AtcSettings
  soundEnabled: boolean
}

export interface RoomMember {
  userId: string
  name: string
  roster: PlayerIdentity[]
  ready: boolean
}

export interface RoomView {
  id: string
  code: string
  ownerId: string
  revision: number
  settings: GameSettings
  members: RoomMember[]
  match: Match | null
  summary: MatchSummary | null
  controllers: Record<string, string>
  participantIds: string[]
  canUndo: boolean
  locked: boolean
}

export interface RoomListItem {
  id: string
  code: string
  matchId: string | null
  matchStatus: MatchStatus | null
}

export interface AccountData extends Preferences {
  self: PlayerIdentity
  players: PlayerIdentity[]
  history: MatchSummary[]
  rooms: RoomListItem[]
  activeRoom: RoomView | null
}

export const defaultPreferences: Preferences = {
  settings: { mode: 'x01', startScore: 501, doubleIn: false, doubleOut: true, legsTarget: 1 },
  atcSettings: { mode: 'atc', fastForward: false },
  soundEnabled: true
}
