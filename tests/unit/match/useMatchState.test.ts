import { describe, expect, it } from 'vitest'
import { useMatchState } from '../../../app/composables/useMatchState'
import type { PlayerIdentity, X01Settings } from '../../../shared/types/darts'

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

    player.score = 40
    match.currentTurnStartScore = 40

    const result = recordDart(match, { segment: 20, multiplier: 2 })

    expect(result.summary).not.toBeNull()
    expect(match.status).toBe('finished')
    expect(match.winnerId).toBe(player.id)
  })
})
