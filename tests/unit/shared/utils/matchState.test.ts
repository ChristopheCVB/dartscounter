import { assert, describe, expect, it } from 'vitest'
import { useMatchState } from '../../../../shared/utils/matchState'
import type { PlayerIdentity, X01Settings } from '../../../../shared/types/darts'
import { CRICKET_TARGETS, createCricketMarks } from '../../../../shared/utils/cricketEngine'

const settings: X01Settings = {
  mode: 'x01',
  startScore: 501,
  doubleIn: false,
  doubleOut: true,
  legsTarget: 1
}

const players: PlayerIdentity[] = [
  { id: 'alice', name: 'Alice', color: '#f05a28' },
  { id: 'bob', name: 'Bob', color: '#24a8ff' }
]

describe('useMatchState integration flow', () => {
  it('auto-advances turn after three darts', () => {
    const { createMatch, recordDart } = useMatchState()
    const match = createMatch(settings, players)

    recordDart(match, { segment: 20, multiplier: 1 })
    recordDart(match, { segment: 20, multiplier: 1 })
    recordDart(match, { segment: 20, multiplier: 1 })

    expect(match.currentPlayerIndex).toBe(1)
    expect(match.currentTurnDarts.length).toBe(0)
    expect(match.currentTurnIndex).toBe(1)
  })

  it('counts checkout attempts once at start of a finishable turn', () => {
    const { createMatch, recordDart } = useMatchState()
    const match = createMatch(settings, players)
    const player = match.players[0]
    assert(player)

    player.score = 100
    match.currentTurnStartScore = 100

    recordDart(match, { segment: 20, multiplier: 1 })
    recordDart(match, { segment: 20, multiplier: 1 })
    recordDart(match, { segment: 20, multiplier: 1 })

    expect(player.stats.checkoutAttempts).toBe(1)
  })

  it('reverts score and advances on bust', () => {
    const { createMatch, recordDart } = useMatchState()
    const match = createMatch(settings, players)
    const player = match.players[0]
    assert(player)

    player.score = 40
    match.currentTurnStartScore = 40

    recordDart(match, { segment: 20, multiplier: 3 })

    expect(player.score).toBe(40)
    expect(player.stats.busts).toBe(1)
    expect(match.currentPlayerIndex).toBe(1)
  })

  it('finishes match and returns summary on valid checkout', () => {
    const { createMatch, recordDart } = useMatchState()
    const match = createMatch(settings, players)
    const player = match.players[0]
    assert(player)

    player.score = 40
    match.currentTurnStartScore = 40

    const result = recordDart(match, { segment: 20, multiplier: 2 })

    expect(result.summary).not.toBeNull()
    expect(match.status).toBe('finished')
    expect(match.winnerId).toBe(player.id)
  })
})

describe('Cricket match progression', () => {
  const engine = useMatchState()
  const seeds = [...players, { id: 'charlie', name: 'Charlie', color: '#30c981' }]
  function closeExceptBull(match: ReturnType<typeof engine.createMatch>) {
    const player = match.players[match.currentPlayerIndex]!
    player.cricketMarks = createCricketMarks()
    for (const target of CRICKET_TARGETS) player.cricketMarks[target] = target === 25 ? 2 : 3
    return player
  }

  it('creates independent marks and counts misses and non-target darts through turn changes', () => {
    const match = engine.createMatch({ mode: 'cricket', legsTarget: 1 }, seeds)
    engine.recordDart(match, { segment: 20, multiplier: 3 })
    engine.recordDart(match, { segment: 14, multiplier: 3 })
    engine.recordDart(match, { segment: 0, multiplier: 1 })
    expect(match.players[0]!.cricketMarks![20]).toBe(3)
    expect(match.players[1]!.cricketMarks![20]).toBe(0)
    expect(match.players[0]!.stats).toMatchObject({ dartsThrown: 3, scoredMarks: 3, scoredPoints: 0, checkoutAttempts: 0 })
    expect(match.currentPlayerIndex).toBe(1)
    expect(match.currentTurnDarts).toEqual([])
    expect(match.throws.map(dart => dart.scoredMarks)).toEqual([3, 0, 0])
    expect(engine.computeSummary(match).players[2]!.marksPerRound).toBe(0)
  })

  it('keeps playing when closed but behind any opponent, then wins on a tied score', () => {
    const match = engine.createMatch({ mode: 'cricket', legsTarget: 1 }, seeds)
    closeExceptBull(match)
    match.players[2]!.score = 20
    expect(engine.recordDart(match, { segment: 25, multiplier: 1 }).summary).toBeNull()
    expect(match.status).toBe('in_progress')
    const result = engine.recordDart(match, { segment: 20, multiplier: 1 })
    expect(match.status).toBe('finished')
    expect(match.winnerId).toBe('alice')
    expect(result.summary).toMatchObject({ gameMode: 'cricket', mode: 'Cricket', winnerId: 'alice' })
    expect(result.summary!.players[0]).toMatchObject({ scoredMarks: 2, scoredPoints: 20, marksPerRound: 3, legsWon: 1, dartsThrown: 2, checkoutsMade: 0, average: 0 })
    const finished = structuredClone(match)
    engine.recordDart(match, { segment: 20, multiplier: 3 })
    expect(match).toEqual(finished)
  })

  it('resets every player and rotates starters through the original order across legs', () => {
    const match = engine.createMatch({ mode: 'cricket', legsTarget: 3 }, seeds)
    for (const nextStarter of [1, 2, 0]) {
      const player = closeExceptBull(match)
      player.score = 50
      player.stats.scoredPoints += 50
      const winnerId = player.id
      expect(engine.recordDart(match, { segment: 25, multiplier: 1 }).summary).toBeNull()
      expect(match.currentPlayerIndex).toBe(nextStarter)
      expect(match.currentTurnIndex).toBe(0)
      expect(match.currentTurnStartScore).toBe(0)
      expect(match.currentTurnDarts).toEqual([])
      expect(match.players.find(player => player.id === winnerId)!.legsWon).toBe(1)
      for (const player of match.players) {
        expect(player.score).toBe(0)
        expect(player.cricketMarks).toEqual(createCricketMarks())
      }
    }
    expect(match.throws).toHaveLength(3)
    expect(match.players.every(player => player.stats.scoredPoints === 50 && player.stats.dartsThrown === 1)).toBe(true)
  })

  it('ends a multi-leg match early on the winning dart and retains cumulative stats', () => {
    const match = engine.createMatch({ mode: 'cricket', legsTarget: 2 }, players)
    closeExceptBull(match)
    engine.recordDart(match, { segment: 25, multiplier: 1 })
    match.currentPlayerIndex = 0
    closeExceptBull(match)
    const result = engine.recordDart(match, { segment: 25, multiplier: 2 })
    expect(result.summary!.players[0]).toMatchObject({ legsWon: 2, dartsThrown: 2, scoredMarks: 3, scoredPoints: 25, marksPerRound: 4.5 })
    expect(match.throws).toHaveLength(2)
    expect(match.currentTurnDarts).toHaveLength(1)
    expect(match.players[0]!.score).toBe(25)
  })
})
