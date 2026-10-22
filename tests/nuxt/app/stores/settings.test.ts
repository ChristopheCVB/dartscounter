import { mountSuspended } from '@nuxt/test-utils/runtime'
import { getActivePinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { useSettingsStore } from '~/stores/settings'
import { defaultPreferences } from '~~/shared/types/rooms'

let wrapper: VueWrapper
let store: ReturnType<typeof useSettingsStore>
async function mountSettings() {
  wrapper = await mountSuspended({ setup() { store = useSettingsStore(); return () => h('div') } })
}
beforeEach(() => { localStorage.clear(); useSettingsStore().$dispose(); getActivePinia()!.state.value = {} })
afterEach(() => { wrapper?.unmount(); store.$dispose() })

describe('browser-local announcement preferences', () => {
  it('loads saved choices and preserves them through account hydration and logout', async () => {
    localStorage.setItem('dartcounter:v1:announcement-language', 'fr-FR')
    localStorage.setItem('dartcounter:v1:announcement-voice', 'french')
    await mountSettings()
    expect(store.announcementLanguage).toBe('fr-FR')
    expect(store.announcementVoice).toBe('french')
    store.hydrate({ ...defaultPreferences, soundEnabled: false })
    store.reset()
    expect(store.announcementLanguage).toBe('fr-FR')
    expect(store.announcementVoice).toBe('french')
    store.announcementVoice = 'another-voice'
    await nextTick()
    expect(localStorage.getItem('dartcounter:v1:announcement-voice')).toBe('another-voice')
  })

  it('uses device defaults on a new browser', async () => {
    await mountSettings()
    expect(store.announcementLanguage).toBe('')
    expect(store.announcementVoice).toBe('')
  })
})
