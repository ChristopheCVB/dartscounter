import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import App from '~/app.vue'

const route = reactive({ path: '/', meta: {} as { title?: string, description?: string } })
mockNuxtImport('useRoute', () => () => route)

describe('page metadata', () => {
  let wrapper: VueWrapper
  afterEach(() => wrapper?.unmount())

  it('updates titles, descriptions, and indexing rules when navigating between pages', async () => {
    route.meta = { title: 'Play', description: 'Play darts with friends.' }
    wrapper = await mountSuspended(App, {
      global: {
        stubs: {
          NuxtRouteAnnouncer: true,
          UApp: { template: '<slot />' },
          NuxtLayout: { template: '<slot />' },
          NuxtPage: true
        }
      }
    })
    const content = (key: string) => document.head.querySelector(`meta[name="${key}"], meta[property="${key}"]`)?.getAttribute('content')
    await expect.poll(() => document.title).toBe('Play - DartsCounter')
    expect(document.documentElement.lang).toBe('en')
    expect(content('og:site_name')).toBe('DartsCounter')
    expect(content('og:type')).toBe('website')
    expect(content('twitter:card')).toBe('summary')
    expect(content('robots')).toBe('index, follow')
    for (const key of ['og:title', 'twitter:title']) expect(content(key)).toBe(document.title)
    for (const key of ['description', 'og:description', 'twitter:description']) expect(content(key)).toBe(route.meta.description)

    route.path = '/room/private-room-id'
    route.meta = { title: 'Game room', description: 'Choose your darts players and rules.' }
    await expect.poll(() => document.title).toBe('Game room - DartsCounter')
    expect(content('robots')).toBe('noindex, nofollow')
    for (const key of ['og:title', 'twitter:title']) expect(content(key)).toBe(document.title)
    for (const key of ['description', 'og:description', 'twitter:description']) {
      expect(content(key)).toBe(route.meta.description)
      expect(document.head.querySelectorAll(`meta[name="${key}"], meta[property="${key}"]`)).toHaveLength(1)
    }

    route.path = '/'
    route.meta = { title: 'Play', description: 'Play darts with friends.' }
    await expect.poll(() => content('robots')).toBe('index, follow')

    route.path = '/unknown'
    route.meta = {}
    await expect.poll(() => document.title).toBe('DartsCounter')
    expect(content('robots')).toBe('noindex, nofollow')
    for (const key of ['description', 'og:description', 'twitter:description']) {
      expect(content(key)).toBe('Play 301, 501, and Around the Clock with friends. Track scores, share a game room, and follow your darts statistics.')
    }
  })
})
