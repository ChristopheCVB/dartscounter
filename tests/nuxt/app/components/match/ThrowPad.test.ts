import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ThrowPad from '~/components/match/ThrowPad.vue'
import InteractiveTarget from '~/components/match/InteractiveTarget.vue'

describe('throw pad input methods', () => {
  let wrapper: VueWrapper
  afterEach(() => wrapper?.unmount())
  const props = { multiplier: 2 as const, numericBuffer: '20', playerColor: '#f05a28', showNumeric: true }

  it('starts on the target without quick controls and records exact board hits', async () => {
    wrapper = await mountSuspended(ThrowPad, { props, slots: { turn: '<p>Turn feedback</p>' } })
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Interactive Target')
    expect(wrapper.text()).toContain('Turn feedback')
    expect(wrapper.text()).not.toContain('Single')
    expect(wrapper.find('input').exists()).toBe(false)
    wrapper.getComponent(InteractiveTarget).vm.$emit('hit', { segment: 20, multiplier: 3 })
    expect(wrapper.emitted('dart')).toEqual([[{ segment: 20, multiplier: 3 }]])
    await wrapper.get('fieldset button').trigger('click')
    expect(wrapper.emitted('miss')).toHaveLength(1)
  })

  it('shows quick controls, selected multiplier, and the X01 numeric buffer', async () => {
    wrapper = await mountSuspended(ThrowPad, { props: { ...props, inputMode: 'quick' } })
    expect(wrapper.findComponent(InteractiveTarget).exists()).toBe(false)
    expect(wrapper.get('[aria-pressed="true"]').text()).toBe('Double')
    expect(wrapper.get('input').element.value).toBe('20')
    await wrapper.get('[aria-pressed="true"]').trigger('click')
    expect(wrapper.emitted('multiplier')).toEqual([[2]])
    await wrapper.setProps({ showNumeric: false })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Backspace')
  })

  it('blocks target hits while scoring is disabled but leaves Undo and tabs available', async () => {
    wrapper = await mountSuspended(ThrowPad, { props: { ...props, disabled: true, undoDisabled: false } })
    wrapper.getComponent(InteractiveTarget).vm.$emit('hit', { segment: 20, multiplier: 3 })
    expect(wrapper.emitted('dart')).toBeUndefined()
    expect(wrapper.get('fieldset').attributes()).toHaveProperty('disabled')
    const undo = wrapper.findAll('button').find(button => button.text() === 'Undo')!
    expect(undo.attributes('disabled')).toBeUndefined()
    await undo.trigger('click')
    expect(wrapper.emitted('undo')).toHaveLength(1)
    expect(wrapper.findAll('[role="tab"]').every(tab => tab.attributes('disabled') === undefined)).toBe(true)
    await wrapper.setProps({ undoDisabled: true })
    expect(undo.attributes()).toHaveProperty('disabled')
  })
})
