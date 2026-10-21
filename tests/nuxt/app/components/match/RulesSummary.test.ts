import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import RulesSummary from '~/components/match/RulesSummary.vue'
import type { GameSettings } from '~~/shared/types/darts'

describe('match rules summary', () => {
  let wrapper: VueWrapper
  afterEach(() => wrapper?.unmount())

  it.each<{ settings: GameSettings, labels: string[] }>([
    { settings: { mode: 'x01', startScore: 501, doubleIn: false, doubleOut: true, legsTarget: 1 }, labels: ['X01 · 501', 'Straight in', 'Double out', 'First to 1 leg'] },
    { settings: { mode: 'x01', startScore: 301, doubleIn: true, doubleOut: false, legsTarget: 3 }, labels: ['X01 · 301', 'Double in', 'Straight out', 'First to 3 legs'] },
    { settings: { mode: 'atc', fastForward: false }, labels: ['Around the Clock', '1–20, then Bull', 'Fast Forward off'] },
    { settings: { mode: 'atc', fastForward: true }, labels: ['Around the Clock', '1–20, then Bull', 'Fast Forward on'] },
  ])('displays all saved options for $settings', async ({ settings, labels }) => {
    wrapper = await mountSuspended(RulesSummary, { props: { settings } })
    for (const label of labels) expect(wrapper.text()).toContain(label)
  })
})
