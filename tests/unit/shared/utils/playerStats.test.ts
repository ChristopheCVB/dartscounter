import { expect, it } from 'vitest'
import { useMatchState } from '../../../../shared/utils/matchState'
import { aggregatePlayerStats } from '../../../../shared/utils/playerStats'

it('aggregates Cricket raw marks and darts before calculating MPR and isolates modes', () => {
  const engine = useMatchState()
  const players = [{ id: 'alice', name: 'Alice', color: '#f05a28' }, { id: 'bob', name: 'Bob', color: '#24a8ff' }]
  const match = engine.createMatch({ mode: 'cricket', legsTarget: 1 }, players)
  match.winnerId = 'alice'
  match.players[0]!.stats.scoredMarks = 5
  match.players[0]!.stats.dartsThrown = 3
  match.players[0]!.stats.scoredPoints = 20
  const first = engine.computeSummary(match)
  match.players[0]!.stats.scoredMarks = 1
  match.players[0]!.stats.dartsThrown = 1
  const second = engine.computeSummary(match)
  const x01 = engine.computeSummary(engine.createMatch({ mode: 'x01', startScore: 501, doubleIn: false, doubleOut: true, legsTarget: 1 }, players))
  const stats = aggregatePlayerStats([first, second, x01], players, 'cricket')
  expect(stats[0]).toMatchObject({ matches: 2, wins: 2, dartsThrown: 4, scoredMarks: 6, scoredPoints: 40, marksPerRound: 4.5, average: 0 })
  expect(stats[1]).toMatchObject({ dartsThrown: 0, marksPerRound: 0 })
  expect(aggregatePlayerStats([first, second, x01], players)[0]!.matches).toBe(1)
})
