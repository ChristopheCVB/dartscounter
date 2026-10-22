import { createPage, getBrowser, setup, url } from '@nuxt/test-utils/e2e'
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
  let clientIp = 0

  afterEach(async () => {
    await page?.context().close()
  })
  afterAll(cleanupDatabase)

  it('renders signed-in home on the server and keeps that state through hydration', async () => {
    const user = await testUser('Home player')
    const context = await (await getBrowser()).newContext()
    await context.addCookies([user.cookie])
    const target = await context.newPage()
    try {
      const response = await target.request.get(url('/'))
      const html = await response.text()
      expect(response.status()).toBe(200)
      expect(html).toContain('Let’s play')
      expect(html).not.toContain('Your next game starts here.')
      await target.addInitScript(() => {
        const flashes: string[] = []
        Object.assign(window, { signedOutFlashes: flashes })
        new MutationObserver(() => {
          if (document.querySelector('h1')?.textContent === 'Your next game starts here.') flashes.push('signed-out')
        }).observe(document, { childList: true, subtree: true })
      })
      await target.goto(url('/'), { waitUntil: 'networkidle' })
      await target.getByRole('heading', { name: 'Let’s play', exact: true }).waitFor()
      expect(await target.evaluate(() => Reflect.get(window, 'signedOutFlashes'))).toEqual([])
      await target.getByRole('link', { name: 'History', exact: true }).click()
      await target.getByRole('link', { name: 'Play', exact: true }).click()
      await target.getByRole('heading', { name: 'Let’s play', exact: true }).waitFor()
      expect(await target.evaluate(() => Reflect.get(window, 'signedOutFlashes'))).toEqual([])
      const otherTab = await context.newPage()
      await otherTab.goto(url('/'), { waitUntil: 'networkidle' })
      await otherTab.getByRole('heading', { name: 'Let’s play', exact: true }).waitFor()
      await target.getByRole('button', { name: 'Sign out', exact: true }).click()
      await target.waitForURL('**/signin')
      await otherTab.getByRole('heading', { name: 'Your next game starts here.', exact: true }).waitFor()
      await target.goto(url('/'), { waitUntil: 'networkidle' })
      await target.getByRole('heading', { name: 'Your next game starts here.', exact: true }).waitFor()
      expect(await target.getByRole('heading', { name: 'Let’s play', exact: true }).count()).toBe(0)
    } finally { await context.close() }
  })

  it('manages players with dialogs and protects the account player from removal', async () => {
    page = (await authenticatedPage('Player manager')).page
    const hydrationWarnings: string[] = []
    page.on('console', message => { if (/hydration/i.test(message.text())) hydrationWarnings.push(message.text()) })
    await page.goto(url('/players'), { waitUntil: 'hydration' })
    expect(hydrationWarnings).toEqual([])
    await page.getByRole('button', { name: 'Add player', exact: true }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: /^Name/ }).fill('New guest')
    await dialog.getByLabel('Player color', { exact: true }).fill('#123456')
    await dialog.getByRole('button', { name: 'Add player', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Options for New guest', exact: true }).filter({ visible: true }).click()
    await page.getByRole('menuitem', { name: 'Edit player', exact: true }).click()
    dialog = page.getByRole('dialog')
    expect(await dialog.getByLabel('Player color', { exact: true }).inputValue()).toBe('#123456')
    await dialog.getByRole('textbox', { name: /^Name/ }).fill('Renamed guest')
    await dialog.getByLabel('Player color', { exact: true }).fill('#abcdef')
    await dialog.getByRole('button', { name: 'Save player', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Options for Renamed guest', exact: true }).filter({ visible: true }).click()
    await page.getByRole('menuitem', { name: 'Remove player', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: 'Options for Renamed guest', exact: true }).filter({ visible: true }).click()
    await page.getByRole('menuitem', { name: 'Remove player', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Remove player', exact: true }).click()
    await expect.poll(() => page.getByRole('button', { name: 'Options for Renamed guest', exact: true }).count()).toBe(0)
    await page.getByRole('button', { name: 'Options for Player manager', exact: true }).filter({ visible: true }).click()
    expect(await page.getByRole('menuitem', { name: 'Remove player', exact: true }).count()).toBe(0)
  })

  it.each(['remove', 'clear'] as const)('updates live rosters after guest %s and starts with a recreated name', async removal => {
    page = (await authenticatedPage('Guest owner')).page
    async function post<T>(path: string, data: object) {
      const response = await page.request.post(url(path), { data, headers: { Origin: new URL(url('/')).origin } })
      expect(response.status(), await response.text()).toBe(200)
      return await response.json() as T
    }
    let room = await post<RoomView>('/api/rooms', {})
    const self = room.members[0]!.roster[0]!
    const guests = await post<{ selected: Array<{ id: string }> }>('/api/players', { type: 'ensure', players: [{ name: 'Room guest', color: '#30c981' }] })
    for (const action of [{ type: 'roster', playerIds: [self.id, guests.selected[0]!.id] }, { type: 'ready', ready: true }] as RoomAction[]) {
      room = await post<RoomView>(`/api/rooms/${room.id}/actions`, { requestId: crypto.randomUUID(), expectedRevision: room.revision, action })
    }
    const observerContext = await (await getBrowser()).newContext({ storageState: await page.context().storageState() })
    const observer = await observerContext.newPage()
    try {
      await observer.goto(url(`/room/${room.id}`), { waitUntil: 'networkidle' })
      const attendance = observer.locator('section').filter({ has: observer.getByRole('heading', { name: 'Who’s here', exact: true }) }).last()
      await expect.poll(() => attendance.textContent()).toContain('Room guest')
      await page.goto(url('/players'), { waitUntil: 'hydration' })
      if (removal === 'remove') {
        await page.getByRole('button', { name: 'Options for Room guest', exact: true }).filter({ visible: true }).click()
        await page.getByRole('menuitem', { name: 'Remove player', exact: true }).click()
      } else {
        await page.getByRole('button', { name: 'Player options', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Clear guest players', exact: true }).click()
      }
      await page.getByRole('dialog').getByRole('button', { name: removal === 'remove' ? 'Remove player' : 'Clear guest players', exact: true }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      const saved = (await testPool.query<{ roster: Array<{ id: string }>, ready: boolean }>('SELECT roster,ready FROM members WHERE room_id=$1', [room.id])).rows[0]!
      expect(saved.roster.map(player => player.id)).toEqual([self.id])
      expect(saved.ready).toBe(false)
      await expect.poll(() => attendance.textContent()).not.toContain('Room guest')
      await expect.poll(() => attendance.textContent()).toContain('Not ready')
      await page.getByRole('button', { name: 'Add player', exact: true }).click()
      await page.getByRole('dialog').getByRole('textbox', { name: /^Name/ }).fill('Room guest')
      await page.getByRole('dialog').getByRole('button', { name: 'Add player', exact: true }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      await page.goto(url(`/room/${room.id}`), { waitUntil: 'hydration' })
      const guest = page.getByRole('checkbox', { name: 'Room guest', exact: true })
      await guest.waitFor()
      expect(await guest.isChecked()).toBe(false)
      await guest.check()
      await page.getByRole('button', { name: 'Save roster', exact: true }).click()
      await expect.poll(() => page.getByRole('button', { name: 'Ready', exact: true }).isEnabled()).toBe(true)
      await page.getByRole('button', { name: 'Ready', exact: true }).click()
      await expect.poll(() => page.getByRole('button', { name: 'Start match', exact: true }).isEnabled()).toBe(true)
      await page.getByRole('button', { name: 'Start match', exact: true }).click()
      await page.getByRole('link', { name: 'Open match', exact: true }).waitFor()
      const started = await (await page.request.get(url(`/api/rooms/${room.id}`))).json() as RoomView
      const fresh = started.match!.players.find(player => player.name === 'Room guest')!
      expect(fresh.id).not.toBe(guests.selected[0]!.id)
    } finally { await observerContext.close() }
  })

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
    // Isolate simulated clients so fast browser runs do not share an auth rate-limit bucket.
    await target.context().setExtraHTTPHeaders({ 'X-Forwarded-For': `192.0.2.${++clientIp}` })
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

  const activePlayer = (target = page) => target.getByRole('article').and(target.locator('[aria-current="true"]'))
  const activeScore = (target = page) => activePlayer(target).locator('p.font-extrabold')
  const scores = (target = page) => target.getByRole('article').locator('p.font-extrabold')

  async function throwDart(segment: number) {
    await page.getByRole('tab', { name: 'Quick Input', exact: true }).click()
    await page.getByText('Auto-advancing turn...', { exact: true }).waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: String(segment), exact: true }).click()
    await expect.poll(() => page.locator('section[aria-busy="true"]').count()).toBe(0)
  }

  it('announces completed turns once, shows averages, and saves this browser’s voice', async () => {
    page = (await authenticatedPage('Score announcements')).page
    await page.addInitScript(() => {
      const calls: Array<{ text: string, lang: string, voice: string | null }> = []
      Object.assign(window, { scoreSpeechCalls: calls })
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class extends EventTarget {
        lang = ''
        voice: { voiceURI: string } | null = null
        constructor(public text: string) { super() }
      } })
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: Object.assign(new EventTarget(), {
        getVoices: () => [
          { voiceURI: 'en-test', lang: 'en-US', name: 'English test', default: true, localService: true },
          { voiceURI: 'fr-test', lang: 'fr-FR', name: 'French test', default: false, localService: true }
        ],
        cancel() {}, resume() {}, pause() {},
        speak(utterance: SpeechSynthesisUtterance) { calls.push({ text: utterance.text, lang: utterance.lang, voice: utterance.voice?.voiceURI ?? null }) }
      }) })
    })
    const calls = () => page.evaluate(() => Reflect.get(window, 'scoreSpeechCalls') as Array<{ text: string, lang: string, voice: string | null }>)
    await page.goto(url('/match/new'), { waitUntil: 'hydration' })
    await page.getByPlaceholder('Player 1', { exact: true }).fill('AlexandertheGreatPlayer')
    await page.getByPlaceholder('Player 2', { exact: true }).fill('Bob')
    await page.getByRole('button', { name: 'Start Match', exact: true }).click()
    await page.waitForURL(/\/match\/(?!new)[^/]+$/)
    await page.getByRole('heading', { name: 'Throw Pad', exact: true }).waitFor()
    for (let dart = 0; dart < 2; dart++) await throwDart(20)
    expect(await calls()).toEqual([])
    await throwDart(20)
    await expect.poll(async () => (await calls()).map(call => call.text)).toEqual(['60'])
    expect(await page.locator('[aria-label="Three-dart average: 60.00"]').count()).toBe(1)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(() => page.getByText('Turn 1 · Darts 2/3', { exact: true }).count()).toBe(1)
    await throwDart(1)
    await expect.poll(async () => (await calls()).map(call => call.text)).toEqual(['60', '41'])
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const average = page.locator('[aria-label="Three-dart average: 41.00"]')
      const averageBox = (await average.boundingBox())!
      const pointsBox = (await average.locator('..').locator('p').boundingBox())!
      expect(averageBox.x + averageBox.width).toBeLessThanOrEqual(pointsBox.x)
      expect(averageBox.height).toBeLessThan(pointsBox.height)
    }
    await page.goto(page.url(), { waitUntil: 'hydration' })
    await page.getByRole('button', { name: 'Miss', exact: true }).waitFor()
    await expect.poll(() => page.getByRole('button', { name: 'Miss', exact: true }).isEnabled()).toBe(true)
    expect(await calls()).toEqual([])

    await page.goto(url('/settings'), { waitUntil: 'hydration' })
    await page.getByRole('combobox', { name: 'Announcement language', exact: true }).click()
    await page.getByRole('option', { name: 'fr-FR', exact: true }).click()
    await page.getByRole('combobox', { name: 'Announcement voice', exact: true }).click()
    await page.getByRole('option', { name: 'French test', exact: true }).click()
    await page.getByRole('button', { name: 'Test voice', exact: true }).click()
    await expect.poll(async () => (await calls()).at(-1)).toEqual({ text: '60', lang: 'fr-FR', voice: 'fr-test' })
    await page.getByRole('button', { name: 'Save defaults', exact: true }).click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('dartcounter:v1:announcement-voice'))).toBe('fr-test')
    await page.goto(page.url(), { waitUntil: 'hydration' })
    await expect.poll(() => page.getByRole('combobox', { name: 'Announcement voice', exact: true }).textContent()).toBe('French test')
    expect(await calls()).toEqual([])
    await page.getByRole('combobox', { name: 'Announcement language', exact: true }).click()
    await page.getByRole('option', { name: 'Device language', exact: true }).click()
    await page.getByRole('combobox', { name: 'Announcement voice', exact: true }).click()
    await page.getByRole('option', { name: 'Default voice', exact: true }).click()
    await page.getByRole('button', { name: 'Test voice', exact: true }).click()
    await expect.poll(async () => (await calls()).at(-1)).toEqual({ text: '60', lang: 'en-US', voice: 'en-test' })
  })

  it('defaults to the target, scores board rings and Miss, and keeps turn feedback beside Undo', async () => {
    await startMatch()
    const targetTab = page.getByRole('tab', { name: 'Interactive Target', exact: true })
    expect(await targetTab.getAttribute('aria-selected')).toBe('true')
    const status = page.getByRole('region', { name: 'Match Status', exact: true })
    const players = page.getByRole('region', { name: 'Players', exact: true })
    expect(await players.getByRole('article').count()).toBe(2)
    expect(await status.getByRole('region', { name: 'Match rules' }).textContent()).toContain('X01 · 501')
    expect(await status.textContent()).not.toContain('All Players')
    const turn = page.getByRole('region', { name: 'Current turn', exact: true })
    const pad = page.getByRole('region', { name: 'Throw Pad', exact: true })
    expect(await pad.getByRole('button', { name: 'Undo', exact: true }).count()).toBe(1)
    expect(await page.getByRole('button', { name: 'Single', exact: true }).count()).toBe(0)
    const board = page.getByRole('img', { name: 'Interactive darts target' })
    await expect.poll(() => page.getByRole('button', { name: 'Miss', exact: true }).isEnabled()).toBe(true)
    for (const [path, score] of [[0, '481'], [1, '441'], [3, '381']] as const) {
      await board.locator('path').nth(path).click()
      await expect.poll(() => scores().first().textContent()).toBe(score)
    }
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(() => activeScore().textContent()).toBe('441')
    await expect.poll(() => turn.textContent()).toContain('2/3')
    await page.getByText('Auto-advancing turn...', { exact: true }).waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Miss', exact: true }).click()
    await expect.poll(() => page.getByText('Turn 2 · Darts 0/3', { exact: true }).count()).toBe(1)
    expect(await targetTab.getAttribute('aria-selected')).toBe('true')

    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      const tabBox = (await page.getByRole('tablist').boundingBox())!
      const statusBox = (await status.boundingBox())!
      const padBox = (await pad.boundingBox())!
      const playersBox = (await players.boundingBox())!
      const playerBoxes = await players.getByRole('article').evaluateAll(cards => cards.map(card => {
        const { x, y, width, height } = card.getBoundingClientRect()
        return { x, y, width, height }
      }))
      expect(tabBox.width).toBeLessThan(width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      expect(playerBoxes[1]!.y).toBeGreaterThanOrEqual(playerBoxes[0]!.y + playerBoxes[0]!.height)
      if (width < 1024) {
        expect(playersBox.y).toBeGreaterThanOrEqual(padBox.y + padBox.height)
        expect(statusBox.y).toBeGreaterThanOrEqual(playersBox.y + playersBox.height)
      } else {
        expect(statusBox.x).toBeGreaterThanOrEqual(padBox.x + padBox.width)
        expect(playersBox.x).toBe(statusBox.x)
        expect(playersBox.y).toBeGreaterThanOrEqual(statusBox.y + statusBox.height)
      }
    }
    await page.getByRole('tab', { name: 'Quick Input', exact: true }).click()
    await page.goto(page.url(), { waitUntil: 'hydration' })
    expect(await page.getByRole('tab', { name: 'Interactive Target', exact: true }).getAttribute('aria-selected')).toBe('true')
    await expect.poll(() => scores().allTextContents()).toEqual(['441', '501'])
  })

  it('restricts numeric and multiplier shortcuts to Quick Input without scoring during tab navigation', async () => {
    await startMatch()
    await expect.poll(() => page.getByRole('button', { name: 'Miss', exact: true }).isEnabled()).toBe(true)
    await page.keyboard.press('t')
    await page.keyboard.press('2')
    await page.keyboard.press('0')
    await page.keyboard.press('Enter')
    await page.getByRole('tab', { name: 'Quick Input', exact: true }).click()
    expect(await page.getByRole('button', { name: 'Single', exact: true }).getAttribute('aria-pressed')).toBe('true')
    const buffer = page.getByLabel('Numeric throw (0-60)', { exact: true })
    expect(await buffer.inputValue()).toBe('')
    await page.keyboard.press('d')
    expect(await page.getByRole('button', { name: 'Double', exact: true }).getAttribute('aria-pressed')).toBe('true')
    await page.keyboard.press('2')
    await page.keyboard.press('0')
    expect(await buffer.inputValue()).toBe('20')
    await page.keyboard.press('Enter')
    expect(await scores().allTextContents()).toEqual(['501', '501'])
    await page.keyboard.press('ArrowLeft')
    expect(await page.getByRole('tab', { name: 'Interactive Target', exact: true }).getAttribute('aria-selected')).toBe('true')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('ArrowRight')
    expect(await buffer.inputValue()).toBe('20')
    expect(await page.getByRole('button', { name: 'Double', exact: true }).getAttribute('aria-pressed')).toBe('true')
    await page.getByRole('heading', { name: 'Throw Pad', exact: true }).click()
    await page.keyboard.press('Enter')
    await expect.poll(() => activeScore().textContent()).toBe('481')
    await expect.poll(() => buffer.inputValue()).toBe('')
    await page.getByRole('tab', { name: 'Interactive Target', exact: true }).click()
    await page.keyboard.press('m')
    await expect.poll(() => page.getByText('Turn 1 · Darts 2/3', { exact: true }).count()).toBe(1)
    await expect.poll(() => page.getByRole('button', { name: 'Undo', exact: true }).isEnabled()).toBe(true)
    await page.keyboard.press('u')
    await expect.poll(() => page.getByText('Turn 1 · Darts 1/3', { exact: true }).count()).toBe(1)
    await expect.poll(() => page.getByRole('button', { name: 'Miss', exact: true }).isEnabled()).toBe(true)
    await page.keyboard.press('b')
    await expect.poll(() => activeScore().textContent()).toBe('456')
    await expect.poll(() => page.getByRole('button', { name: 'Miss', exact: true }).isEnabled()).toBe(true)
    await page.getByRole('button', { name: 'Miss', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => page.getByText('Turn 2 · Darts 0/3', { exact: true }).count()).toBe(1)
  })

  it.each([390, 1280])('keeps match status stable while saving and recovering a dart at %ipx', async width => {
    await startMatch()
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const status = page.getByRole('region', { name: 'Match Status', exact: true })
    const players = page.getByRole('region', { name: 'Players', exact: true })
    await expect.poll(() => status.getByRole('status').textContent()).toBe('Your player’s turn')
    const statusBox = (await status.boundingBox())!
    const playersBox = (await players.boundingBox())!
    const requestIds: string[] = []
    let releaseResponse!: () => void
    const responseGate = new Promise<void>(resolve => { releaseResponse = resolve })
    await page.route('**/api/rooms/*/actions', async route => {
      requestIds.push(route.request().postDataJSON().requestId)
      if (requestIds.length === 1) {
        // Commit the dart, then lose its response to exercise safe recovery.
        const response = await route.fetch()
        expect(response.status()).toBe(200)
        await responseGate
      }
      if (requestIds.length <= 2) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusMessage: 'Dart response lost' }) })
      } else await route.continue()
    })

    try {
      await page.getByRole('img', { name: 'Interactive darts target' }).locator('path').first().click()
      await expect.poll(() => status.getByRole('status').textContent()).toBe('Saving dart...')
      expect(await page.getByRole('button', { name: 'Resolve pending dart', exact: true }).count()).toBe(0)
      expect((await status.boundingBox())!.height).toBe(statusBox.height)
      expect((await players.boundingBox())!.y).toBe(playersBox.y)
      releaseResponse()

      const recovery = page.getByRole('alert').filter({ hasText: 'Dart response lost' })
      await recovery.getByRole('button', { name: 'Resolve pending dart', exact: true }).waitFor()
      expect(await status.getByRole('button', { name: 'Resolve pending dart', exact: true }).count()).toBe(0)
      expect((await status.boundingBox())!.height).toBe(statusBox.height)
      expect((await players.boundingBox())!.y).toBe(playersBox.y)
      await recovery.getByRole('button', { name: 'Resolve pending dart', exact: true }).click()
      await recovery.waitFor({ state: 'hidden' })
      await expect.poll(() => status.getByRole('status').textContent()).toBe('Your player’s turn')
      expect(await activeScore().textContent()).toBe('481')
      expect(requestIds).toHaveLength(3)
      expect(new Set(requestIds).size).toBe(1)
      expect((await status.boundingBox())!.height).toBe(statusBox.height)
      expect((await players.boundingBox())!.y).toBe(playersBox.y)

      const target = page.getByRole('img', { name: 'Interactive darts target' }).locator('path').first()
      await target.click()
      await expect.poll(() => activeScore().textContent()).toBe('461')
      await target.click()
      await expect.poll(() => status.getByRole('status').textContent()).toBe('Auto-advancing turn...')
      expect((await status.boundingBox())!.height).toBe(statusBox.height)
      expect((await players.boundingBox())!.y).toBe(playersBox.y)
    } finally { releaseResponse() }
  })

  it('scores, advances turns, undoes, and restores an active match after reload', async () => {
    await startMatch()
    expect(await page.getByRole('region', { name: 'Match rules' }).textContent()).toContain('X01 · 501')
    const firstPlayer = await activePlayer().getAttribute('aria-label')
    await throwDart(20)
    await throwDart(20)
    await throwDart(20)
    await expect.poll(() => activePlayer().getAttribute('aria-label')).not.toContain(firstPlayer!)
    expect(await scores().allTextContents()).toEqual(['441', '501'])

    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect.poll(() => activeScore().textContent()).toBe('461')
    expect(await activePlayer().getAttribute('aria-label')).toContain(firstPlayer!)

    await page.goto(page.url(), { waitUntil: 'hydration' })
    await expect.poll(() => scores().allTextContents()).toEqual(['461', '501'])
    expect(await activePlayer().getAttribute('aria-label')).toContain(firstPlayer!)
    expect(await page.getByText('Turn 1 · Darts 2/3', { exact: true }).count()).toBe(1)
  })

  it('advances Around the Clock targets only on the required segment', async () => {
    await startMatch('atc')
    await throwDart(20)
    expect(await activeScore().textContent()).toBe('Target: 1')
    await throwDart(1)
    await expect.poll(() => activeScore().textContent()).toBe('Target: 2')
    await throwDart(2)
    await expect.poll(() => scores().allTextContents()).toEqual(['Target: 3', 'Target: 1'])
  })

  it('shows a checkout recap and persists completed match history', async () => {
    await startMatch()
    const winner = (await activePlayer().getAttribute('aria-label'))!
    await page.getByRole('tab', { name: 'Quick Input', exact: true }).click()
    await page.getByRole('button', { name: 'Treble', exact: true }).click()
    // Both players score 180 in each of the first two rounds.
    for (let dart = 0; dart < 12; dart++) {
      await throwDart(20)
    }
    await throwDart(20)
    await throwDart(19)
    await page.getByRole('button', { name: 'Double', exact: true }).click()
    await throwDart(12)

    const recap = page.getByRole('dialog')
    await recap.waitFor()
    expect(await recap.textContent()).toContain(`${winner} wins`)
    await recap.getByRole('link', { name: 'View History', exact: true }).click()
    await page.waitForURL('**/history')
    await page.goto(url('/history'), { waitUntil: 'hydration' })
    await expect.poll(() => page.getByText(`${winner} won`, { exact: true }).count()).toBe(1)
    await page.locator('summary').click()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: `Options for ${winner}’s match`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Hide from my history', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Hide from my history', exact: true }).click()
    await page.getByRole('heading', { name: 'Your first result is waiting', exact: true }).waitFor()
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
      await bob.page.goto(url(`/room/${room.id}`), { waitUntil: 'hydration' })
      const rules = bob.page.getByRole('region', { name: 'Match rules' })
      await expect.poll(() => rules.textContent()).toContain('Fast Forward off')
      expect(await bob.page.getByRole('button', { name: 'Save rules', exact: true }).count()).toBe(0)
      room = await action(page, room, { type: 'settings', settings: { mode: 'atc', fastForward: true } })
      await expect.poll(() => rules.textContent()).toContain('Fast Forward on')
      room = await action(page, room, { type: 'settings', settings: { mode: 'atc', fastForward: false } })
      await expect.poll(() => rules.textContent()).toContain('Fast Forward off')
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
      await controller.getByRole('tab', { name: 'Quick Input', exact: true }).click()
      await watcher.getByRole('tab', { name: 'Quick Input', exact: true }).click()
      await expect.poll(() => controller.getByRole('button', { name: '1', exact: true }).isEnabled()).toBe(true)
      expect(await watcher.getByRole('button', { name: '1', exact: true }).isDisabled()).toBe(true)
      await controller.getByRole('button', { name: '1', exact: true }).click()
      await expect.poll(() => activeScore(watcher).textContent()).toBe('Target: 2')
      expect(await watcher.getByRole('region', { name: 'Match rules' }).textContent()).toContain('Fast Forward off')
      const throwingPlayer = room.match!.players[0]!
      const waitingPlayer = room.match!.players[1]!
      await expect.poll(() => watcher.getByRole('article', { name: throwingPlayer.name, exact: true }).textContent()).toContain('Aim: 2')
      const waitingCard = watcher.getByRole('article', { name: waitingPlayer.name, exact: true })
      expect(await waitingCard.textContent()).toContain('Next turn')
      expect(await waitingCard.textContent()).toContain('Aim: 1')
      await expect.poll(() => watcher.getByRole('button', { name: 'Undo', exact: true }).isEnabled()).toBe(true)
      await watcher.getByRole('button', { name: 'Undo', exact: true }).click()
      await expect.poll(() => activeScore(controller).textContent()).toBe('Target: 1')
      await controller.context().setOffline(true)
      await controller.context().setOffline(false)
      await controller.goto(controller.url(), { waitUntil: 'hydration' })
      await controller.getByRole('tab', { name: 'Quick Input', exact: true }).click()
      await expect.poll(() => controller.getByRole('button', { name: '1', exact: true }).isEnabled()).toBe(true)
      await post<RoomView>(spectator.page, '/api/rooms/join', { code: room.code })
      await spectator.page.goto(url(`/match/${room.match!.id}`), { waitUntil: 'hydration' })
      expect(await spectator.page.getByRole('button', { name: 'Undo', exact: true }).isDisabled()).toBe(true)
      await spectator.page.getByRole('tab', { name: 'Quick Input', exact: true }).click()
      expect(await spectator.page.getByRole('button', { name: '1', exact: true }).isDisabled()).toBe(true)
      expect(await spectator.page.getByRole('article').count()).toBe(3)
      expect(await spectator.page.getByRole('region', { name: 'Match rules' }).textContent()).toContain('Around the Clock')
      const forbidden = await spectator.page.request.post(url(`/api/rooms/${room.id}/actions`), { headers: { Origin: origin }, data: { requestId: crypto.randomUUID(), expectedRevision: (await (await spectator.page.request.get(url(`/api/rooms/${room.id}`))).json()).revision, action: { type: 'dart', dart: { segment: 1, multiplier: 1 } } } })
      expect(forbidden.status()).toBe(403)
      expect((await testPool.query('SELECT count(*) FROM participants WHERE match_id=$1', [room.match!.id])).rows[0].count).toBe('2')
    } finally { await bob.page.context().close(); await spectator.page.context().close() }
  })

  it('finds and resolves the active room after deleting and recreating a guest', async () => {
    await startMatch()
    const matchId = new URL(page.url()).pathname.split('/').at(-1)!
    const original = await (await page.request.get(url(`/api/matches/${matchId}`))).json() as RoomView
    const oldGuest = original.match!.players.find(player => player.name === 'Bob')!
    async function post<T>(path: string, data: object) {
      const response = await page.request.post(url(path), { data, headers: { Origin: new URL(url('/')).origin } })
      expect(response.status(), await response.text()).toBe(200)
      return await response.json() as T
    }
    await post('/api/players', { type: 'remove', id: oldGuest.id })
    const recreated = await post<{ selected: Array<{ id: string }> }>('/api/players', { type: 'ensure', players: [{ name: 'Bob', color: '#38bdf8' }] })
    expect(recreated.selected[0]!.id).not.toBe(oldGuest.id)
    const next = await post<RoomView>('/api/rooms', {})
    await page.goto(url(`/room/${next.id}`), { waitUntil: 'hydration' })
    await page.getByText(`You’re playing in room ${original.code}`, { exact: true }).waitFor()
    expect(await page.getByRole('link', { name: 'Resume current match', exact: true }).getAttribute('href')).toBe(`/match/${matchId}`)
    expect(await page.getByRole('button', { name: 'Start match', exact: true }).isDisabled()).toBe(true)
    await page.getByRole('link', { name: 'Back to Play', exact: true }).click()
    expect(await page.getByRole('link', { name: 'Resume match', exact: true }).getAttribute('href')).toBe(`/match/${matchId}`)
    const activeRoomLink = page.getByRole('link', { name: `${original.code} Playing`, exact: true })
    await activeRoomLink.waitFor()
    const activeRoomCard = activeRoomLink.locator('..')
    expect(await activeRoomCard.getByRole('link', { name: 'Open match', exact: true }).getAttribute('href')).toBe(`/match/${matchId}`)
    await page.getByRole('link', { name: 'New match', exact: true }).click()
    expect(await page.getByRole('link', { name: 'Resume Current Match', exact: true }).getAttribute('href')).toBe(`/match/${matchId}`)
    expect(await page.getByRole('button', { name: 'Start Match', exact: true }).isDisabled()).toBe(true)
    await page.goto(url(`/room/${next.id}`), { waitUntil: 'hydration' })
    await page.getByRole('link', { name: 'Open active room', exact: true }).click()
    await expect.poll(() => page.getByRole('button', { name: 'Room options', exact: true }).isEnabled()).toBe(true)
    await page.getByRole('button', { name: 'Room options', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Abandon match', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Abandon match', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.goto(url(`/room/${next.id}`), { waitUntil: 'hydration' })
    expect(await page.getByText(`You’re playing in room ${original.code}`, { exact: true }).count()).toBe(0)
    await page.getByRole('checkbox', { name: 'Bob', exact: true }).check()
    await page.getByRole('button', { name: 'Save roster', exact: true }).click()
    await expect.poll(() => page.getByRole('button', { name: 'Ready', exact: true }).isEnabled()).toBe(true)
    await page.getByRole('button', { name: 'Ready', exact: true }).click()
    await expect.poll(() => page.getByRole('button', { name: 'Start match', exact: true }).isEnabled()).toBe(true)
    await page.getByRole('button', { name: 'Start match', exact: true }).click()
    await page.getByRole('link', { name: 'Open match', exact: true }).waitFor()
  })

  it('creates a reusable lobby, selects guests, clears readiness on rule changes, and starts through the UI', async () => {
    page = (await authenticatedPage('Room owner')).page
    await page.goto(url('/rooms'), { waitUntil: 'hydration' })
    await page.getByRole('button', { name: 'Create room', exact: true }).click()
    await page.waitForURL(/\/room\/[^/]+$/)
    const rules = page.getByRole('region', { name: 'Match rules' })
    await expect.poll(() => page.getByRole('button', { name: 'Room options', exact: true }).isEnabled()).toBe(true)
    const beforeError = await rules.boundingBox()
    await page.route('**/api/rooms/*/actions', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ statusMessage: 'Could not rotate invite code' }) }))
    await page.getByRole('button', { name: 'Room options', exact: true }).click()
    await page.getByRole('menuitem', { name: 'New invite code', exact: true }).click()
    await page.getByRole('button', { name: 'New invite code', exact: true }).click()
    await page.getByText('Could not rotate invite code', { exact: true }).waitFor()
    expect(await page.locator('section.page-stack').first().getByText('Could not rotate invite code', { exact: true }).count()).toBe(0)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect((await rules.boundingBox())?.y).toBe(beforeError?.y)
    await page.unroute('**/api/rooms/*/actions')
    await page.getByPlaceholder('Guest name', { exact: true }).fill('Room guest')
    await page.getByRole('button', { name: 'Add guest', exact: true }).click()
    await expect.poll(() => page.getByRole('checkbox', { name: 'Room guest', exact: true }).isChecked()).toBe(true)
    await expect.poll(() => page.getByRole('button', { name: 'Ready', exact: true }).isEnabled()).toBe(true)
    await page.getByRole('button', { name: 'Ready', exact: true }).click()
    await expect.poll(() => page.getByRole('button', { name: 'Start match', exact: true }).isEnabled()).toBe(true)
    await page.getByRole('combobox', { name: 'Game mode', exact: true }).click()
    await page.getByRole('option', { name: 'Around the Clock', exact: true }).click()
    expect(await rules.textContent()).toContain('X01 · 501')
    await page.getByRole('button', { name: 'Save rules', exact: true }).click()
    await expect.poll(() => rules.textContent()).toContain('Around the Clock')
    await expect.poll(() => page.getByRole('button', { name: 'Start match', exact: true }).isDisabled()).toBe(true)
    await page.getByRole('button', { name: 'Ready', exact: true }).click()
    await page.getByRole('button', { name: 'Start match', exact: true }).click()
    await page.getByRole('link', { name: 'Open match', exact: true }).click()
    await page.waitForURL(/\/match\/(?!new)[^/]+$/)
    await expect.poll(() => scores().allTextContents()).toEqual(['Target: 1', 'Target: 1'])
  })
})
