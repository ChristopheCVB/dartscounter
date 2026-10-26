import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Share from '~/components/room/Share.vue'

const toast = vi.hoisted(() => ({ add: vi.fn() }))
mockNuxtImport('useToast', () => () => toast)
const writeText = vi.fn()
const share = vi.fn()
let wrapper: VueWrapper
const button = (name: string) => wrapper.findAll('button').find(button => button.text() === name)!

beforeEach(() => {
  vi.clearAllMocks()
  writeText.mockResolvedValue(undefined)
  share.mockResolvedValue(undefined)
  vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard)
  Object.defineProperty(navigator, 'share', { configurable: true, value: share })
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); Reflect.deleteProperty(navigator, 'share') })

describe('room invitation sharing', () => {
  it('copies an absolute invitation and uses the current code after rotation', async () => {
    wrapper = await mountSuspended(Share, { props: { code: 'ABCDEFGH' } })
    await button('Copy link').trigger('click')
    await expect.poll(() => writeText.mock.calls.length).toBe(1)
    const invitation = new URL(writeText.mock.calls[0]![0])
    expect(invitation.pathname).toBe('/join')
    expect(invitation.searchParams.get('code')).toBe('ABCDEFGH')
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Invite link copied' }))
    await wrapper.setProps({ code: 'BCDEFGHJ' })
    await button('Copy link').trigger('click')
    expect(new URL(writeText.mock.calls[1]![0]).searchParams.get('code')).toBe('BCDEFGHJ')
  })

  it('offers native sharing, ignores cancellation, and explains failures', async () => {
    wrapper = await mountSuspended(Share, { props: { code: 'ABCDEFGH' } })
    await expect.poll(() => !!button('Share')).toBe(true)
    await button('Share').trigger('click')
    expect(share).toHaveBeenCalledWith({ title: 'Join my DartsCounter room', url: expect.stringContaining('/join?code=ABCDEFGH') })
    share.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
    await button('Share').trigger('click')
    expect(toast.add).not.toHaveBeenCalled()
    share.mockRejectedValueOnce(new Error('Unavailable'))
    await button('Share').trigger('click')
    await expect.poll(() => toast.add.mock.calls.length).toBe(1)
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not share the invitation' }))
  })

  it('keeps copying available without native sharing and exposes a manual fallback', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    writeText.mockRejectedValueOnce(new Error('Permission denied'))
    wrapper = await mountSuspended(Share, { props: { code: 'ABCDEFGH' } })
    expect(button('Share')).toBeUndefined()
    await button('Copy link').trigger('click')
    await expect.poll(() => wrapper.find('input[aria-label="Room invite link"]').exists()).toBe(true)
    const input = wrapper.get('input').element as HTMLInputElement
    expect(input.readOnly).toBe(true)
    expect(input.value).toContain('/join?code=ABCDEFGH')
    await wrapper.setProps({ code: 'BCDEFGHJ' })
    expect(input.value).toContain('code=BCDEFGHJ')
  })
})
