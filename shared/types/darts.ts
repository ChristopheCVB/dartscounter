export type Multiplier = 1 | 2 | 3
export type Segment = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 25

export interface DartInput {
  segment: Segment
  multiplier: Multiplier
}

export interface ThrowEvent extends DartInput {
  id: string
  playerId: string
  turnIndex: number
  dartIndex: number
  points: number
  scoredPoints: number
  scoreBefore: number
  scoreAfter: number
  openedBefore: boolean
  openedAfter: boolean
  isBust: boolean
  isCheckout: boolean
  timestamp: number
}

export interface X01Settings {
  startScore: 301 | 501
  doubleIn: boolean
  doubleOut: boolean
  legsTarget: number
}

export interface PlayerIdentity {
  id: string
  name: string
  color: string
}

export interface Player extends PlayerIdentity {}

export interface PlayerStats {
  dartsThrown: number
  busts: number
  checkoutAttempts: number
  checkoutsMade: number
  scoredPoints: number
  firstNinePoints: number
  firstNineDarts: number
}

export interface MatchPlayer extends Player {
  score: number
  hasOpened: boolean
  legsWon: number
  stats: PlayerStats
}

export type MatchStatus = 'setup' | 'in_progress' | 'finished'

export interface Match {
  id: string
  settings: X01Settings
  players: MatchPlayer[]
  status: MatchStatus
  startedAt: number
  finishedAt: number | null
  currentPlayerIndex: number
  currentTurnIndex: number
  currentTurnStartScore: number
  currentTurnOpenedAtStart: boolean
  currentTurnDarts: ThrowEvent[]
  throws: ThrowEvent[]
  winnerId: string | null
}

export interface PlayerSummary {
  playerId: string
  name: string
  color: string
  legsWon: number
  average: number
  scoredPoints: number
  firstNineAverage: number
  firstNinePoints: number
  firstNineDarts: number
  checkoutAttempts: number
  checkoutsMade: number
  checkoutPercentage: number
  dartsThrown: number
  busts: number
}

export interface MatchSummary {
  id: string
  matchId: string
  finishedAt: number
  durationMs: number
  mode: string
  players: PlayerSummary[]
  winnerId: string
  winnerName: string
}

export interface DartApplyResult {
  points: number
  scoredPoints: number
  nextScore: number
  nextOpened: boolean
  isBust: boolean
  isCheckout: boolean
}
