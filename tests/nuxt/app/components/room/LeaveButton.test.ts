import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LeaveButton from '~/components/room/LeaveButton.vue'
import { useAccountStore } from '~/stores/account'
import { useMatchStore } from '~/stores/match'
import { defaultPreferences } from '~~/shared/types/rooms'
import type { RoomView } from '~~/shared/types/rooms'

const navigate = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigate)
const room: RoomView = { id: 'current', code: 'ABCDEFGH', revision: 7, ownerId: 'self', settings: defaultPreferences.settings, members: [], match: null, summary: null, controllers: {}, participantIds: [], canUndo: false, locked: false }
let wrapper: VueWrapper
const buttons = () => wrapper.findAll('button')
async function mountLeave(navigateOnLeave = true) {
  wrapper = await mountSuspended(LeaveButton, { props: { room, navigateOnLeave }, global: { stubs: {
    UModal: { props: ['open', 'description'], template: '<div v-if="open"><p>{{ description }}</p><slot name="body" /><slot name="footer" /></div>' }
  } } })
}
beforeEach(() => { vi.clearAllMocks(); useAccountStore().clear() })
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks() })

describe('confirmed room departures', () => {
  it('emits only after a successful departure and can leave navigation to the invitation page', async () => {
    const leave = vi.spyOn(useMatchStore(), 'leaveRoom').mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    await mountLeave(false)
    await buttons()[0]!.trigger('click')
    await buttons().at(-1)!.trigger('click')
    expect(wrapper.emitted('left')).toBeUndefined()
    await buttons().at(-1)!.trigger('click')
    expect(leave).toHaveBeenCalledWith(room)
    expect(wrapper.emitted('left')).toHaveLength(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('reopens an uncertain leave for explicit retry and preserves default navigation', async () => {
    const store = useMatchStore()
    store.uncertain = { roomId: room.id, requestId: 'original', expectedRevision: 7, action: { type: 'leave' } }
    const retry = vi.spyOn(store, 'retryUncertain').mockResolvedValue(true)
    await mountLeave()
    expect(buttons()[0]!.attributes('disabled')).toBeUndefined()
    await buttons()[0]!.trigger('click')
    expect(buttons().at(-1)!.text()).toBe('Retry leaving')
    await buttons().at(-1)!.trigger('click')
    expect(retry).toHaveBeenCalledOnce()
    expect(wrapper.emitted('left')).toHaveLength(1)
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('does not leave a different room if account state changes while confirming', async () => {
    const leave = vi.spyOn(useMatchStore(), 'leaveRoom').mockResolvedValue(false)
    useAccountStore().currentRoom = { ...room, id: 'another-room', revision: 10 }
    await mountLeave(false)
    await buttons()[0]!.trigger('click')
    await buttons().at(-1)!.trigger('click')
    expect(leave).toHaveBeenCalledWith(room)
    expect(wrapper.emitted('left')).toBeUndefined()
  })
})
