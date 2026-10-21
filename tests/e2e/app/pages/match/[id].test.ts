import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import type { NuxtPage } from '@nuxt/test-utils/e2e'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { cleanupDatabase, testEnvironment, testPool, testUser } from '../../../../helpers/database'
import type { RoomView } from '../../../../../shared/types/rooms'
import type { RoomAction } from '../../../../../shared/utils/validation'

describe('local matches', { timeout: 60_000 }, async () => {
  await setup({
    browser: true,
    browserOptions: { type: 'chromium' },
    port: 4317,
    env: { ...testEnvironment, NUXT_RESEND_API_KEY: 're_test', NUXT_RESEND_FROM: 'DartsCounter <noreply@example.test>' },
    setupTimeout: 180_000,
    serverStartTimeout: 90_000,
    // The test utilities launch the built server with Node; production uses the Bun preset.
    nuxtConfig: {
      alias: { resend: fileURLToPath(new URL('../../../fixtures/resend.ts', import.meta.url)) },
      nitro: {
        preset: 'node-server',
        handlers: [{ route: '/__test__/emails', handler: fileURLToPath(new URL('../../../fixtures/email-smoke.ts', import.meta.url)) }]
      }
    },
  })

  let page: NuxtPage

  afterEach(async () => {
    await page?.context().close()
  })
  afterAll(cleanupDatabase)

  it('renders both real Vue templates and sends HTML/text with subjects through the test Resend transport', async () => {
    const response = await fetch(url('/__test__/emails'))
    expect(response.status).toBe(200)
    const emails = await response.json() as Array<{ name: string, response: { data: { content: { subject: string, from: string, to: string, html: string, text: string } } } }>
    expect(emails).toHaveLength(2)
    for (const email of emails) {
      const { content } = email.response.data
      expect(content.subject).toBe(email.name === 'email-verification' ? 'Verify your DartsCounter email' : 'Reset your DartsCounter password')
      expect(content.from).toBe('DartsCounter <noreply@example.test>')
      expect(content.to).toBe('recipient@example.test')
      expect(content.html).toContain('DartsCounter')
      expect(content.html).toContain('&lt;script&gt;')
      expect(content.html).not.toContain('<script>')
      expect(content.html).toContain('href="https://example.test/verify?token=one&amp;callbackURL=%2Frooms"')
      expect(content.text).toContain('Alex <script>alert(1)</script> & friends')
      expect(content.text).toContain('https://example.test/verify?token=one&callbackURL=%2Frooms')
      expect(content.text).not.toContain('<html')
      expect(content.text).toContain(email.name === 'email-verification' ? 'ignore this email' : 'expires in one hour')
    }
  })

  async function authenticatedPage(name: string) {
    const user = await testUser(name)
    const target = await createPage('/signin')
    await target.context().addCookies([{ ...user.cookie, url: url('/') }])
    return { page: target, user }
  }

  async function startMatch(mode: 'x01' | 'atc' = 'x01') {
    page = (await authenticatedPage('Local scorer')).page
    await page.goto(url('/match/new'), { waitUntil: 'hydration' })
    await page.getByPlaceholder('Player 1', { exact: true }).fill('Alice')
    await page.getByPlaceholder('Player 2', { exact: true }).fill('Bob')
    if (mode === 'atc') {
      await page.getByRole('button', { name: 'Around the Clock', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Start Match', exact: true }).click()
    await page.waitForURL(/\/match\/(?!new)[^/]+$/)
    await page.getByRole('heading', { name: 'Throw Pad', exact: true }).waitFor()
  }

  async function throwDart(segment: number) {
    await page.getByText('Auto-advancing turn...', { exact: true }).waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: String(segment), exact: true }).click()
    await expect.poll(() => page.locator('section[aria-busy="true"]').count()).toBe(0)
  }

  it('scores, advances turns, undoes, and restores an active match after reload', async () => {
    await startMatch()
    const firstPlayer = await page.locator('.score-row.active').locator('span').first().textContent()
    await throwDart(20)
    await throwDart(20)
    await throwDart(20)
    await expect.poll(() => page.locator('.score-row.active').textContent()).not.toContain(firstPlayer!)
    expect(await page.locator('.score-row strong').allTextContents()).toEqual(['441', '501'])

    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(() => page.locator('.score-row.active strong').textContent()).toBe('461')
    expect(await page.locator('.score-row.active').textContent()).toContain(firstPlayer!)

    await page.goto(page.url(), { waitUntil: 'hydration' })
    await expect.poll(() => page.locator('.score-row strong').allTextContents()).toEqual(['461', '501'])
    expect(await page.locator('.score-row.active').textContent()).toContain(firstPlayer!)
    expect(await page.getByText('Turn 1 · Darts 2/3', { exact: true }).count()).toBe(1)
  })

  it('advances Around the Clock targets only on the required segment', async () => {
    await startMatch('atc')
    await throwDart(20)
    expect(await page.locator('.score-row.active strong').textContent()).toBe('T1')
    await throwDart(1)
    await expect.poll(() => page.locator('.score-row.active strong').textContent()).toBe('T2')
    await throwDart(2)
    await expect.poll(() => page.locator('.score-row strong').allTextContents()).toEqual(['T3', 'T1'])
  })

  it('shows a checkout recap and persists completed match history', async () => {
    await startMatch()
    const winner = (await page.locator('.score-row.active span').first().textContent())!.trim()
    await page.getByRole('button', { name: 'T', exact: true }).click()
    // Both players score 180 in each of the first two rounds.
    for (let dart = 0; dart < 12; dart++) {
      await throwDart(20)
    }
    await throwDart(20)
    await throwDart(19)
    await page.getByRole('button', { name: 'D', exact: true }).click()
    await throwDart(12)

    const recap = page.getByRole('dialog')
    await recap.waitFor()
    expect(await recap.textContent()).toContain(`${winner} wins`)
    await recap.getByRole('link', { name: 'View History', exact: true }).click()
    await page.waitForURL('**/history')
    await page.goto(url('/history'), { waitUntil: 'hydration' })
    await expect.poll(() => page.getByText(`${winner} won`, { exact: true }).count()).toBe(1)
    expect(await page.getByText('No matches saved yet', { exact: true }).count()).toBe(0)
  })

  it('synchronizes accounts and guests live, enforces controllers, reconnects, and admits late spectators', async () => {
    const alice = await authenticatedPage('Alice')
    page = alice.page
    const bob = await authenticatedPage('Bob')
    const spectator = await authenticatedPage('Charlie')
    const origin = new URL(url('/')).origin
    async function post<T>(target: NuxtPage, path: string, data: object) {
      const response = await target.request.post(url(path), { data, headers: { Origin: origin } })
      expect(response.status(), await response.text()).toBe(200)
      return await response.json() as T
    }
    async function action(target: NuxtPage, room: RoomView, action: RoomAction) {
      return post<RoomView>(target, `/api/rooms/${room.id}/actions`, { requestId: crypto.randomUUID(), expectedRevision: room.revision, action })
    }
    try {
      let room = await post<RoomView>(page, '/api/rooms', { settings: { mode: 'atc', fastForward: false } })
      room = await post<RoomView>(bob.page, '/api/rooms/join', { code: room.code })
      const guests = await post<{ selected: { id: string }[] }>(bob.page, '/api/players', { type: 'ensure', players: [{ name: 'Bob’s guest', color: '#30c981' }] })
      const bobSelf = room.members.find(m => m.userId === bob.user.id)!.roster[0]!.id
      room = await action(bob.page, room, { type: 'roster', playerIds: [bobSelf, guests.selected[0]!.id] })
      room = await action(page, room, { type: 'ready', ready: true })
      room = await action(bob.page, room, { type: 'ready', ready: true })
      room = await action(page, room, { type: 'start' })
      await Promise.all([page.goto(url(`/match/${room.match!.id}`), { waitUntil: 'hydration' }), bob.page.goto(url(`/match/${room.match!.id}`), { waitUntil: 'hydration' })])
      const controllerId = room.controllers[room.match!.players[0]!.id]
      const controller = controllerId === alice.user.id ? page : bob.page
      const watcher = controller === page ? bob.page : page
      await expect.poll(() => controller.getByRole('button', { name: '1', exact: true }).isEnabled()).toBe(true)
      expect(await watcher.getByRole('button', { name: '1', exact: true }).isDisabled()).toBe(true)
      await controller.getByRole('button', { name: '1', exact: true }).click()
      await expect.poll(() => watcher.locator('.score-row.active strong').textContent()).toBe('T2')
      await expect.poll(() => watcher.getByRole('button', { name: 'Undo', exact: true }).isEnabled()).toBe(true)
      await watcher.getByRole('button', { name: 'Undo', exact: true }).click()
      await expect.poll(() => controller.locator('.score-row.active strong').textContent()).toBe('T1')
      await controller.context().setOffline(true)
      await controller.context().setOffline(false)
      await controller.goto(controller.url(), { waitUntil: 'hydration' })
      await expect.poll(() => controller.getByRole('button', { name: '1', exact: true }).isEnabled()).toBe(true)
      await post<RoomView>(spectator.page, '/api/rooms/join', { code: room.code })
      await spectator.page.goto(url(`/match/${room.match!.id}`), { waitUntil: 'hydration' })
      expect(await spectator.page.getByRole('button', { name: 'Undo', exact: true }).isDisabled()).toBe(true)
      expect(await spectator.page.getByRole('button', { name: '1', exact: true }).isDisabled()).toBe(true)
      expect(await spectator.page.locator('.score-row').count()).toBe(3)
      const forbidden = await spectator.page.request.post(url(`/api/rooms/${room.id}/actions`), { headers: { Origin: origin }, data: { requestId: crypto.randomUUID(), expectedRevision: (await (await spectator.page.request.get(url(`/api/rooms/${room.id}`))).json()).revision, action: { type: 'dart', dart: { segment: 1, multiplier: 1 } } } })
      expect(forbidden.status()).toBe(403)
      expect((await testPool.query('SELECT count(*) FROM participants WHERE match_id=$1', [room.match!.id])).rows[0].count).toBe('2')
    } finally { await bob.page.context().close(); await spectator.page.context().close() }
  })

  it('creates a reusable lobby, selects guests, clears readiness on rule changes, and starts through the UI', async () => {
    page = (await authenticatedPage('Room owner')).page
    await page.goto(url('/rooms'), { waitUntil: 'hydration' })
    await page.getByRole('button', { name: 'Create room', exact: true }).click()
    await page.waitForURL(/\/room\/[^/]+$/)
    await page.getByPlaceholder('Guest name', { exact: true }).fill('Room guest')
    await page.getByRole('button', { name: 'Add guest', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Room guest', exact: true }).click()
    await page.getByRole('button', { name: 'Save roster', exact: true }).click()
    await page.getByRole('button', { name: 'Ready', exact: true }).click()
    await expect.poll(() => page.getByRole('button', { name: 'Start match', exact: true }).isEnabled()).toBe(true)
    await page.getByRole('combobox', { name: 'Game mode', exact: true }).click()
    await page.getByRole('option', { name: 'Around the Clock', exact: true }).click()
    await page.getByRole('button', { name: 'Save rules', exact: true }).click()
    await expect.poll(() => page.getByRole('button', { name: 'Start match', exact: true }).isDisabled()).toBe(true)
    await page.getByRole('button', { name: 'Ready', exact: true }).click()
    await page.getByRole('button', { name: 'Start match', exact: true }).click()
    await page.getByRole('link', { name: 'Open match', exact: true }).click()
    await page.waitForURL(/\/match\/(?!new)[^/]+$/)
    await expect.poll(() => page.locator('.score-row strong').allTextContents()).toEqual(['T1', 'T1'])
  })
})
