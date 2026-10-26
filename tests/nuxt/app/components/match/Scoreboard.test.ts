import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import Scoreboard from '~/components/match/Scoreboard.vue'
import { useMatchState } from '~~/shared/utils/matchState'
import type { X01Settings } from '~~/shared/types/darts'

const settings: X01Settings = { mode: 'x01', startScore: 501, doubleIn: true, doubleOut: true, legsTarget: 1 }
const seeds = [{ id: 'alice', name: 'Alice', color: '#f05a28' }, { id: 'bob', name: 'Bob', color: '#24a8ff' }]

describe('player recommendations', () => {
  let wrapper: VueWrapper
  afterEach(() => wrapper?.unmount())

  it('shows shared Cricket marks, points, legs, and the current player with accessible labels', async () => {
    const settings = { mode: 'cricket', legsTarget: 3 } as const
    const engine = useMatchState()
    const match = engine.createMatch(settings, seeds)
    engine.recordDart(match, { segment: 20, multiplier: 3 })
    engine.recordDart(match, { segment: 20, multiplier: 2 })
    match.players[0]!.legsWon = 1
    wrapper = await mountSuspended(Scoreboard, { props: { players: match.players, activeIndex: 0, settings, dartsUsed: 2, status: 'in_progress' } })
    expect(wrapper.get('[aria-label="Cricket scoreboard"]').text()).toContain('40')
    expect(wrapper.get('[aria-label="Alice, 20: 3 of 3 marks, closed"]').text()).toBe('⊗')
    expect(wrapper.get('[aria-label="Bob, 20: 0 of 3 marks"]').text()).toBe('—')
    expect(wrapper.get('th[aria-current="true"]').text()).toContain('Alice')
    expect(wrapper.find('article').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Avg')
    await wrapper.setProps({ activeIndex: 1 })
    expect(wrapper.get('th[aria-current="true"]').text()).toContain('Bob')
  })

  it('gives waiting players a full turn and updates advice after scoring, undo, and turn changes', async () => {
    const match = useMatchState().createMatch(settings, seeds)
    match.players[0]!.score = 100
    match.players[0]!.hasOpened = true
    match.players[0]!.legsWon = 1
    match.players[1]!.score = 100
    wrapper = await mountSuspended(Scoreboard, { props: { players: match.players, activeIndex: 0, settings, dartsUsed: 2, status: 'in_progress' } })
    const alice = () => wrapper.get('article[aria-label="Alice"]')
    const bob = () => wrapper.get('article[aria-label="Bob"]')

    expect(wrapper.text()).not.toMatch(/Throwing|Waiting/)
    expect(alice().attributes('aria-current')).toBe('true')
    expect(bob().attributes('aria-current')).toBeUndefined()
    expect(alice().get('p').text()).toBe('Alice · 1 leg')
    expect(bob().get('p').text()).toBe('Bob · 0 legs')
    expect(alice().text()).toContain('This turn')
    expect(alice().text()).toContain('Setup: leave a double')
    expect(bob().text()).toContain('Next turn')
    expect(bob().text()).toContain('Open: any double')

    await wrapper.setProps({ players: match.players.map(player => ({ ...player, hasOpened: true })) })
    expect(bob().text()).toContain('Finish: T20 • D20')

    await wrapper.setProps({ dartsUsed: 1 })
    expect(alice().text()).toContain('Finish: T20 • D20')
    await wrapper.setProps({ dartsUsed: 2 })
    expect(alice().text()).toContain('Setup: leave a double')

    await wrapper.setProps({ activeIndex: 1 })
    expect(alice().attributes('aria-current')).toBeUndefined()
    expect(bob().attributes('aria-current')).toBe('true')
    expect(alice().text()).toContain('Next turn')
    expect(alice().text()).toContain('Finish: T20 • D20')
    expect(bob().text()).toContain('This turn')
    expect(bob().text()).toContain('Setup: leave a double')

    for (const status of ['finished', 'abandoned'] as const) {
      await wrapper.setProps({ status })
      expect(wrapper.text()).not.toContain('This turn')
      expect(wrapper.text()).not.toContain('Next turn')
      expect(wrapper.text()).not.toContain('Finish:')
    }
  })

  it('shows each Around the Clock player’s own target', async () => {
    const settings = { mode: 'atc', fastForward: true } as const
    const match = useMatchState().createMatch(settings, seeds)
    match.players[0]!.atcTarget = 7
    match.players[1]!.atcTarget = 21
    wrapper = await mountSuspended(Scoreboard, { props: { players: match.players, activeIndex: 0, settings, dartsUsed: 1, status: 'in_progress' } })
    expect(wrapper.get('article[aria-label="Alice"] p').text()).toBe('Alice · 6/21')
    expect(wrapper.get('article[aria-label="Alice"]').text()).toContain('Aim: 7 · double +2 / treble +3')
    expect(wrapper.get('article[aria-label="Bob"]').text()).toContain('Finish: Bull')
    expect(wrapper.text()).not.toContain('Avg')
  })

  it('shows a smaller, muted three-dart average left of points and updates with stats', async () => {
    const match = useMatchState().createMatch(settings, seeds)
    wrapper = await mountSuspended(Scoreboard, { props: { players: match.players, activeIndex: 0, settings, dartsUsed: 0, status: 'in_progress' } })
    const card = () => wrapper.get('article[aria-label="Alice"]')
    expect(card().get('[aria-label="Three-dart average: 0.00"]').text()).toBe('Avg 0.00')
    const players = match.players.map(player => ({ ...player, stats: { ...player.stats, dartsThrown: 4, scoredPoints: 81 } }))
    await wrapper.setProps({ players })
    const average = card().get('[aria-label="Three-dart average: 60.75"]')
    expect(average.classes()).toEqual(expect.arrayContaining(['text-xs', 'text-muted']))
    expect(average.element.nextElementSibling?.textContent).toBe('501')
    await wrapper.setProps({ players: match.players })
    expect(card().text()).toContain('Avg 0.00')
  })
})
