import type { AtcSettings, DartInput, GameSettings, Match, MatchPlayer, MatchSummary, Player, PlayerIdentity, PlayerSummary, ThrowEvent, X01Settings } from '~~/shared/types/darts'
import { fallbackPlayerColor } from '../constants/playerColors'
import { applyAtcDart } from './useAtcEngine'
import { applyDart, isValidSegmentMultiplier } from './useScoringEngine'

type PlayerSeed = PlayerIdentity

function createStats() {
  return {
    dartsThrown: 0,
    busts: 0,
    checkoutAttempts: 0,
    checkoutsMade: 0,
    scoredPoints: 0,
    firstNinePoints: 0,
    firstNineDarts: 0
  }
}

function buildPlayers(players: Player[], settings: X01Settings): MatchPlayer[] {
  return players.map((player, idx) => ({
    ...player,
    color: player.color || fallbackPlayerColor(idx),
    score: settings.startScore,
    legsWon: 0,
    hasOpened: !settings.doubleIn,
    stats: createStats()
  }))
}

function buildAtcPlayers(players: Player[]): MatchPlayer[] {
  return players.map((player, idx) => ({
    ...player,
    color: player.color || fallbackPlayerColor(idx),
    score: 0,
    hasOpened: true,
    legsWon: 0,
    atcTarget: 1,
    stats: createStats()
  }))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function getPlayerAt(match: Match, index: number): MatchPlayer {
  const player = match.players[index]
  if (!player) {
    throw new Error('Match has no players configured.')
  }
  return player
}

function computeSummary(match: Match): MatchSummary {
  const isAtc = match.settings.mode === 'atc'

  const players: PlayerSummary[] = match.players.map((player) => {
    if (isAtc) {
      const hitRate = player.stats.dartsThrown > 0
        ? round(player.stats.scoredPoints / player.stats.dartsThrown)
        : 0

      return {
        playerId: player.id,
        name: player.name,
        color: player.color,
        legsWon: 0,
        average: 0,
        scoredPoints: player.stats.scoredPoints,
        firstNineAverage: 0,
        firstNinePoints: 0,
        firstNineDarts: 0,
        checkoutAttempts: 0,
        checkoutsMade: 0,
        checkoutPercentage: 0,
        dartsThrown: player.stats.dartsThrown,
        busts: 0,
        hitRate
      }
    }

    const average = player.stats.dartsThrown > 0
      ? (player.stats.scoredPoints / player.stats.dartsThrown) * 3
      : 0

    const firstNineAverage = player.stats.firstNineDarts > 0
      ? (player.stats.firstNinePoints / player.stats.firstNineDarts) * 3
      : 0

    const checkoutPercentage = player.stats.checkoutAttempts > 0
      ? (player.stats.checkoutsMade / player.stats.checkoutAttempts) * 100
      : 0

    return {
      playerId: player.id,
      name: player.name,
      color: player.color,
      legsWon: player.legsWon,
      average: round(average),
      scoredPoints: player.stats.scoredPoints,
      firstNineAverage: round(firstNineAverage),
      firstNinePoints: player.stats.firstNinePoints,
      firstNineDarts: player.stats.firstNineDarts,
      checkoutAttempts: player.stats.checkoutAttempts,
      checkoutsMade: player.stats.checkoutsMade,
      checkoutPercentage: round(checkoutPercentage),
      dartsThrown: player.stats.dartsThrown,
      busts: player.stats.busts
    }
  })

  const winner = match.players.find(player => player.id === match.winnerId) || getPlayerAt(match, 0)

  const atcSettings = isAtc ? (match.settings as AtcSettings) : null
  const modeLabel = isAtc
    ? (atcSettings!.fastForward ? 'Around the Clock (Fast)' : 'Around the Clock')
    : `X01 ${(match.settings as X01Settings).startScore}`

  return {
    id: crypto.randomUUID(),
    matchId: match.id,
    finishedAt: match.finishedAt || Date.now(),
    durationMs: (match.finishedAt || Date.now()) - match.startedAt,
    mode: modeLabel,
    gameMode: match.settings.mode,
    players,
    winnerId: winner.id,
    winnerName: winner.name
  }
}

function resetForNextLeg(match: Match) {
  const settings = match.settings as X01Settings
  for (const player of match.players) {
    player.score = settings.startScore
    player.hasOpened = !settings.doubleIn
  }
  match.currentTurnDarts = []
  match.currentTurnIndex = 0
  const player = getPlayerAt(match, match.currentPlayerIndex)
  match.currentTurnStartScore = player.score
  match.currentTurnOpenedAtStart = player.hasOpened
}

export function useMatchState() {
  const createMatch = (settings: GameSettings, seeds: PlayerSeed[]): Match => {
    const players: Player[] = seeds.map((seed, idx) => ({
      id: seed.id,
      name: seed.name,
      color: seed.color || fallbackPlayerColor(idx)
    }))

    if (!players.length) {
      throw new Error('Cannot create match without players.')
    }

    const builtPlayers = settings.mode === 'atc'
      ? buildAtcPlayers(players)
      : buildPlayers(players, settings)

    const firstPlayer = builtPlayers[0]

    if (!firstPlayer) {
      throw new Error('Cannot create match without players.')
    }

    return {
      id: crypto.randomUUID(),
      settings,
      players: builtPlayers,
      status: 'in_progress',
      startedAt: Date.now(),
      finishedAt: null,
      currentPlayerIndex: 0,
      currentTurnIndex: 0,
      currentTurnStartScore: settings.mode === 'atc' ? 0 : firstPlayer.score,
      currentTurnOpenedAtStart: firstPlayer.hasOpened,
      currentTurnDarts: [],
      throws: [],
      winnerId: null
    }
  }

  const recordDartAtc = (match: Match, input: DartInput): { updated: Match, summary: MatchSummary | null } => {
    const settings = match.settings as AtcSettings
    const player = getPlayerAt(match, match.currentPlayerIndex)
    const currentTarget = player.atcTarget ?? 1

    const result = applyAtcDart(currentTarget, input, settings)

    const event: ThrowEvent = {
      id: crypto.randomUUID(),
      playerId: player.id,
      turnIndex: match.currentTurnIndex,
      dartIndex: match.currentTurnDarts.length + 1,
      segment: input.segment,
      multiplier: input.multiplier,
      points: result.advance,
      scoredPoints: result.advance,
      scoreBefore: currentTarget,
      scoreAfter: result.nextTarget,
      openedBefore: true,
      openedAfter: true,
      isBust: false,
      isCheckout: result.isWin,
      timestamp: Date.now()
    }

    if (result.hit) {
      player.atcTarget = result.nextTarget
      player.stats.scoredPoints += result.advance
    }

    player.stats.dartsThrown += 1
    match.currentTurnDarts.push(event)
    match.throws.push(event)

    if (result.isWin) {
      match.status = 'finished'
      match.finishedAt = Date.now()
      match.winnerId = player.id
      return { updated: match, summary: computeSummary(match) }
    }

    if (match.currentTurnDarts.length >= 3) {
      advanceTurn(match)
    }

    return { updated: match, summary: null }
  }

  const recordDart = (match: Match, input: DartInput): { updated: Match, summary: MatchSummary | null } => {
    if (!isValidSegmentMultiplier(input.segment, input.multiplier) || match.status !== 'in_progress') {
      return { updated: match, summary: null }
    }

    if (match.settings.mode === 'atc') {
      return recordDartAtc(match, input)
    }

    const player = getPlayerAt(match, match.currentPlayerIndex)
    const isFirstDartOfTurn = match.currentTurnDarts.length === 0
    const turnStartScore = match.currentTurnStartScore
    const turnStartOpened = match.currentTurnOpenedAtStart

    if (isFirstDartOfTurn && player.hasOpened && player.score <= 170) {
      player.stats.checkoutAttempts += 1
    }

    const applied = applyDart(player.score, player.hasOpened, input, match.settings as X01Settings, turnStartScore, turnStartOpened)

    const event: ThrowEvent = {
      id: crypto.randomUUID(),
      playerId: player.id,
      turnIndex: match.currentTurnIndex,
      dartIndex: match.currentTurnDarts.length + 1,
      segment: input.segment,
      multiplier: input.multiplier,
      points: applied.points,
      scoredPoints: applied.scoredPoints,
      scoreBefore: player.score,
      scoreAfter: applied.nextScore,
      openedBefore: player.hasOpened,
      openedAfter: applied.nextOpened,
      isBust: applied.isBust,
      isCheckout: applied.isCheckout,
      timestamp: Date.now()
    }

    player.score = applied.nextScore
    player.hasOpened = applied.nextOpened
    player.stats.dartsThrown += 1
    player.stats.scoredPoints += applied.scoredPoints

    if (player.stats.firstNineDarts < 9) {
      player.stats.firstNineDarts += 1
      player.stats.firstNinePoints += applied.scoredPoints
    }

    match.currentTurnDarts.push(event)
    match.throws.push(event)

    let summary: MatchSummary | null = null

    if (applied.isBust) {
      player.stats.busts += 1
      advanceTurn(match)
      return { updated: match, summary: null }
    }

    if (applied.isCheckout) {
      player.stats.checkoutsMade += 1
      player.legsWon += 1

      const x01Settings = match.settings as X01Settings
      if (player.legsWon >= x01Settings.legsTarget) {
        match.status = 'finished'
        match.finishedAt = Date.now()
        match.winnerId = player.id
        summary = computeSummary(match)
      } else {
        resetForNextLeg(match)
      }

      return { updated: match, summary }
    }

    if (match.currentTurnDarts.length >= 3) {
      advanceTurn(match)
    }

    return { updated: match, summary: null }
  }

  const advanceTurn = (match: Match) => {
    match.currentPlayerIndex = (match.currentPlayerIndex + 1) % match.players.length
    match.currentTurnIndex += 1
    match.currentTurnDarts = []

    const player = getPlayerAt(match, match.currentPlayerIndex)
    match.currentTurnStartScore = match.settings.mode === 'atc' ? (player.atcTarget ?? 1) : player.score
    match.currentTurnOpenedAtStart = player.hasOpened
  }

  const setNumericInput = (buffer: string, digit: string) => {
    const next = `${buffer}${digit}`.slice(0, 3)
    if (Number(next) > 60) {
      return buffer
    }
    return next
  }

  return {
    createMatch,
    recordDart,
    computeSummary,
    setNumericInput
  }
}
