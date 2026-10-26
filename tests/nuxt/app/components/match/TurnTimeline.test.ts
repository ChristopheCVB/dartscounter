import { mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, it } from 'vitest'
import TurnTimeline from '~/components/match/TurnTimeline.vue'
import { useMatchState } from '~~/shared/utils/matchState'

it('shows Cricket marks and points independently in the current turn', async () => {
  const engine = useMatchState()
  const match = engine.createMatch({ mode: 'cricket', legsTarget: 1 }, [{ id: 'a', name: 'Alice', color: '#f05a28' }, { id: 'b', name: 'Bob', color: '#24a8ff' }])
  engine.recordDart(match, { segment: 20, multiplier: 3 })
  engine.recordDart(match, { segment: 20, multiplier: 1 })
  const wrapper = await mountSuspended(TurnTimeline, { props: { darts: match.currentTurnDarts, settings: match.settings } })
  try {
    expect(wrapper.text()).toContain('T20 · 3 marks · +0 pts')
    expect(wrapper.text()).toContain('20 · 1 mark · +20 pts')
  } finally { wrapper.unmount() }
})
