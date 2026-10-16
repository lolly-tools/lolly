// SPDX-License-Identifier: MPL-2.0
/**
 * Every design-system room fits a 390px phone without panning sideways (plan 320 S6).
 *
 * The Type room's face picker used to make the page 520px wide: its pinned-faces row
 * scrolls sideways on a phone, but the row's full width still sized the three auto
 * grid columns that hold the row. A room that pans sideways moves the field someone
 * is typing in, so each room is checked, and the Type room again with the face
 * picker open.
 *
 *   LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5193 node --test tests/start-rooms-phone.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const ROOMS = ['overview', 'color', 'type', 'logos', 'tokens', 'catalogue', 'usage'];

test('each design-system room fits a 390px phone, the open face picker included', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    });
    const page = await context.newPage();
    await page.goto(`${origin}/#/start`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const width = (): Promise<{ scroll: number; client: number }> => page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
    }));
    const visited: string[] = [];
    for (const room of ROOMS) {
      // Files and Usage can wait until the system has something to show.
      const door = page.locator(`[data-ds-room="${room}"]`).first();
      if (!await door.count()) continue;
      await door.click();
      visited.push(room);
      const { scroll, client } = await width();
      assert.ok(scroll <= client, `the ${room} room is ${scroll}px wide on a ${client}px phone`);
    }
    assert.ok(visited.length >= 5, `the studio rooms were found (${visited.join(', ') || 'none'})`);
    await page.goto(`${origin}/#/start`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-ds-room="type"]').first().click();
    await page.getByRole('button', { name: /^Choose a face for/ }).first().click();
    await page.locator('.be-typestage-pinrow').waitFor();
    const open = await width();
    assert.ok(open.scroll <= open.client, `the open face picker is ${open.scroll}px wide on a ${open.client}px phone`);
  } finally {
    await browser.close();
  }
});
