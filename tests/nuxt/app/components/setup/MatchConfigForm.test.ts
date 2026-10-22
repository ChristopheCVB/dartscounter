import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useAccountStore } from '~/stores/account'
import { getActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import MatchConfigForm from '~/components/setup/MatchConfigForm.vue'
import { usePlayersStore } from '~/stores/players'
import { useSettingsStore } from '~/stores/settings'

describe('match configuration', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    localStorage.clear()
    useAccountStore().$dispose()
    useSettingsStore().$dispose()
    usePlayersStore().$dispose()
    getActivePinia()!.state.value = {}
    wrapper = await mountSuspended(MatchConfigForm)
  })

  afterEach(() => wrapper?.unmount())

  it('hydrates the account player and requires a named guest', async () => {
    useAccountStore().self = { id: 'self', name: 'Alex', color: '#f97316' }
    await nextTick()
    expect((wrapper.get('input[placeholder="Player 1"]').element as HTMLInputElement).value).toBe('Alex')
    expect((wrapper.get('input[placeholder="Player 2"]').element as HTMLInputElement).value).toBe('')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('keeps user edits when account data arrives later', async () => {
    await wrapper.get('input[placeholder="Player 1"]').setValue('Custom')
    useAccountStore().self = { id: 'self', name: 'Alex', color: '#f97316' }
    await nextTick()
    expect((wrapper.get('input[placeholder="Player 1"]').element as HTMLInputElement).value).toBe('Custom')
  })

  it('replaces a blank row with a saved player without adding duplicates', async () => {
    usePlayersStore().recentPlayers = [{ id: 'sam', name: 'Sam', color: '#38bdf8' }]
    await nextTick()
    await wrapper.findAll('button').find(button => button.text() === 'Sam')!.trigger('click')
    expect((wrapper.get('input[placeholder="Player 1"]').element as HTMLInputElement).value).toBe('Sam')
    expect(wrapper.findAll('input[placeholder^="Player "]')).toHaveLength(2)
    expect(wrapper.findAll('button').some(button => button.text() === 'Sam')).toBe(false)
  })

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
    await wrapper.get('input[placeholder="Player 1"]').setValue('Alice')
    await wrapper.get('input[placeholder="Player 2"]').setValue('Bob')
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
