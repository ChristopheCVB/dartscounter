import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { getActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import MatchConfigForm from '~/components/setup/MatchConfigForm.vue'
import { usePlayersStore } from '~/stores/players'
import { useSettingsStore } from '~/stores/settings'

describe('match configuration', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    localStorage.clear()
    useSettingsStore().$dispose()
    usePlayersStore().$dispose()
    getActivePinia()!.state.value = {}
    wrapper = await mountSuspended(MatchConfigForm)
  })

  afterEach(() => wrapper?.unmount())

  it('submits X01 settings with trimmed player names', async () => {
    await wrapper.get('input[placeholder="Player 1"]').setValue(' Alice ')
    await wrapper.get('input[placeholder="Player 2"]').setValue('Bob')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[{
      settings: { mode: 'x01', startScore: 501, doubleIn: false, doubleOut: true, legsTarget: 1 },
      players: [
        { name: 'Alice', color: expect.stringMatching(/^#[\da-f]{6}$/i) },
        { name: 'Bob', color: expect.stringMatching(/^#[\da-f]{6}$/i) },
      ],
    }]])
  })

  it('switches to Around the Clock and submits Fast Forward', async () => {
    const modeButton = wrapper.findAll('button').find(button => button.text() === 'Around the Clock')!
    await modeButton.trigger('click')
    expect(wrapper.text()).not.toContain('Start score')
    expect(wrapper.text()).not.toContain('Double out')
    await wrapper.get('[role="checkbox"]').trigger('click')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      settings: { mode: 'atc', fastForward: true },
    })
  })

  it.each([
    ['blank', '   ', 'Bob', 'Too small'],
    ['duplicate', ' Alice ', 'alice', 'Player names must be unique.'],
  ])('rejects %s player names', async (_kind, first, second, error) => {
    await wrapper.get('input[placeholder="Player 1"]').setValue(first)
    await wrapper.get('input[placeholder="Player 2"]').setValue(second)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain(error)
  })
})
