import { createError, readBody } from 'h3'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Join from '~/pages/join.vue'
import { useAccountStore } from '~/stores/account'
import { useMatchStore } from '~/stores/match'
import { useMatchState } from '~~/shared/utils/matchState'
import { defaultPreferences } from '~~/shared/types/rooms'
import type { AccountData, RoomView } from '~~/shared/types/rooms'

const navigate = vi.hoisted(() => vi.fn())
const route = { query: { code: 'abcdefgh' as unknown } }
mockNuxtImport('useRoute', () => () => route)
mockNuxtImport('navigateTo', () => navigate)
let wrapper: VueWrapper
let remove: (() => void) | undefined
const room: RoomView = { id: 'invited', code: 'ABCDEFGH', revision: 0, ownerId: 'owner', settings: defaultPreferences.settings, members: [], match: null, summary: null, controllers: {}, participantIds: [], canUndo: false, locked: false }
const accountData: AccountData = { ...defaultPreferences, self: { id: 'self', name: 'Self', color: '#ffffff' }, players: [], history: [], currentRoom: { ...room, id: 'current', code: 'BCDEFGHJ' } }
async function mountJoin() {
  wrapper = await mountSuspended(Join, { global: { stubs: { RoomLeaveButton: { template: '<button @click="$emit(\'left\')">Confirm departure</button>' } } } })
}
beforeEach(() => {
  vi.clearAllMocks()
  route.query.code = 'abcdefgh'
  useMatchStore().reset()
  useAccountStore().clear()
})
afterEach(() => { wrapper?.unmount(); remove?.(); remove = undefined; vi.restoreAllMocks() })

describe('invitation entry', () => {
  it.each([false, true])('joins once and opens the appropriate destination (running: %s)', async running => {
    const response = structuredClone(room)
    if (running) {
      response.match = useMatchState().createMatch(defaultPreferences.settings, [{ id: 'one', name: 'One', color: '#ffffff' }, { id: 'two', name: 'Two', color: '#000000' }])
    }
    const calls: unknown[] = []
    remove = registerEndpoint('/api/rooms/join', { method: 'POST', handler: async event => { calls.push(await readBody(event)); return response } })
    await mountJoin()
    await expect.poll(() => navigate.mock.calls.length).toBe(1)
    expect(calls).toEqual([{ code: 'ABCDEFGH' }])
    expect(navigate).toHaveBeenCalledWith(running ? `/match/${response.match!.id}` : '/room/invited', { replace: true })
    expect(useAccountStore().currentRoom?.id).toBe('invited')
  })

  it.each([undefined, ['ABCDEFGH', 'BCDEFGHJ'], 'bad'])('rejects malformed codes without making a join request: %j', async code => {
    route.query.code = code
    const joined = vi.fn(() => room)
    remove = registerEndpoint('/api/rooms/join', { method: 'POST', handler: joined })
    await mountJoin()
    expect(wrapper.text()).toContain('This invitation is invalid')
    expect(joined).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('offers a switch only after the server reports a conflict and joins after departure', async () => {
    const reload = vi.spyOn(useAccountStore(), 'load').mockResolvedValue(accountData)
    let left = false
    const joined = vi.fn(() => { if (!left) throw createError({ statusCode: 409 }); return room })
    remove = registerEndpoint('/api/rooms/join', { method: 'POST', handler: joined })
    await mountJoin()
    await expect.poll(() => wrapper.text()).toContain('Leave it to join this invitation')
    expect(reload).toHaveBeenCalledOnce()
    expect(joined).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()
    left = true
    await wrapper.findAll('button').find(button => button.text() === 'Confirm departure')!.trigger('click')
    await expect.poll(() => navigate.mock.calls.length).toBe(1)
    expect(joined).toHaveBeenCalledTimes(2)
  })

  it('explains a closed invitation without offering a switch or leaving the current room', async () => {
    const leave = vi.spyOn(useMatchStore(), 'leaveRoom')
    remove = registerEndpoint('/api/rooms/join', { method: 'POST', handler: () => { throw createError({ statusCode: 404 }) } })
    await mountJoin()
    await expect.poll(() => wrapper.text()).toContain('Ask your friend for a fresh link')
    expect(wrapper.text()).not.toContain('Confirm departure')
    expect(leave).not.toHaveBeenCalled()
  })

  it('waits for explicit resolution of an uncertain departure before attempting to join', async () => {
    const store = useMatchStore()
    store.acceptRoom(accountData.currentRoom!)
    store.uncertain = { roomId: 'current', requestId: 'original', expectedRevision: 0, action: { type: 'leave' } }
    const joined = vi.fn(() => room)
    remove = registerEndpoint('/api/rooms/join', { method: 'POST', handler: joined })
    await mountJoin()
    expect(wrapper.text()).toContain('Resolve your pending room action')
    expect(joined).not.toHaveBeenCalled()
    store.uncertain = null
    await wrapper.findAll('button').find(button => button.text() === 'Confirm departure')!.trigger('click')
    await expect.poll(() => navigate.mock.calls.length).toBe(1)
    expect(joined).toHaveBeenCalledOnce()
  })

  it('retains the invitation for explicit retry after a network failure', async () => {
    let succeed = false
    remove = registerEndpoint('/api/rooms/join', { method: 'POST', handler: () => { if (!succeed) throw createError({ statusCode: 503 }); return room } })
    await mountJoin()
    await expect.poll(() => wrapper.text()).toContain('Retry joining')
    succeed = true
    await wrapper.findAll('button').find(button => button.text() === 'Retry joining')!.trigger('click')
    await expect.poll(() => navigate.mock.calls.length).toBe(1)
  })

  it('can resolve a departure when an account refresh has already cleared the previous room', async () => {
    const store = useMatchStore()
    store.uncertain = { roomId: 'current', requestId: 'original', expectedRevision: 0, action: { type: 'leave' } }
    const retry = vi.spyOn(store, 'retryUncertain').mockImplementation(async () => { store.uncertain = null; return true })
    const joined = vi.fn(() => room)
    remove = registerEndpoint('/api/rooms/join', { method: 'POST', handler: joined })
    await mountJoin()
    expect(joined).not.toHaveBeenCalled()
    await wrapper.findAll('button').find(button => button.text() === 'Resolve pending action')!.trigger('click')
    await expect.poll(() => navigate.mock.calls.length).toBe(1)
    expect(retry).toHaveBeenCalledOnce()
    expect(joined).toHaveBeenCalledOnce()
  })
})
