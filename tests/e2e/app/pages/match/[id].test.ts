import { createPage, setup, url } from '@nuxt/test-utils/e2e'
import type { NuxtPage } from '@nuxt/test-utils/e2e'
import { afterEach, describe, expect, it } from 'vitest'

describe('local matches', { timeout: 60_000 }, async () => {
  await setup({
    browser: true,
    browserOptions: { type: 'chromium' },
    setupTimeout: 180_000,
    serverStartTimeout: 90_000,
    // The test utilities launch the built server with Node; production uses the Bun preset.
    nuxtConfig: { nitro: { preset: 'node-server' } },
  })

  let page: NuxtPage

  afterEach(async () => {
    await page?.context().close()
  })

  async function startMatch(mode: 'x01' | 'atc' = 'x01') {
    page = await createPage('/match/new')
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
})
