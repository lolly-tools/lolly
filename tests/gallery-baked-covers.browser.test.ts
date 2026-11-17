// SPDX-License-Identifier: MPL-2.0
/**
 * A first visit is shown baked covers, at once.
 *
 * Covers are baked at build time so a first visit paints the gallery without rendering
 * anything. Two things made that promise empty. The bake went out of date when the
 * design system's tokens changed, so no visitor's context matched (tests/
 * gallery-covers-bake.test.ts holds that now). And a baked file still waited its turn
 * in the render queue, which is held behind the welcome and runs one job at a time on
 * idle. This test holds the second: on a clean profile, baked files are on the cards a
 * few seconds after the grid appears, with no extra look drawn for a card nobody asked about.
 *
 * It also catches the case the catalog test cannot see: a change to how the context is
 * hashed (lib/preview-context.ts), which retires every bake the same way a token edit does.
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/browser-gpu.ts --test tests/gallery-baked-covers.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const origin = process.env.LOLLY_EXPORT_TEST_URL ?? process.env.LOLLY_GALLERY_TEST_URL ?? process.env.LOLLY_IMPORT_TEST_URL;
const skip = origin ? false : 'Set LOLLY_EXPORT_TEST_URL, LOLLY_GALLERY_TEST_URL or LOLLY_IMPORT_TEST_URL to a running web shell.';

test('a clean profile gets baked covers without a render, and no look it did not ask for', { skip, timeout: 240_000 }, async (t) => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const manifest = await (await page.request.get(`${origin}/catalog/previews/covers.json`)).json().catch(() => null) as { covers?: Record<string, unknown> } | null;
    if (!manifest?.covers || !Object.keys(manifest.covers).length) { t.skip('this profile ships no baked covers'); return; }

    await page.goto(`${origin}/`);
    await page.waitForSelector('.gtile .gcar', { timeout: 120_000 });
    // The pointer rests off the grid, so no card is of interest.
    await page.mouse.move(2, 2);
    const baked = '.gtile .gcar-slide--ex:first-of-type img.gcar-img[src*="/catalog/previews/covers/"]';
    await page.waitForFunction(
      (sel) => [...document.querySelectorAll<HTMLImageElement>(sel)].filter((img) => img.complete && img.naturalWidth > 0).length >= 3,
      baked, { timeout: 30_000 },
    ).catch(() => { /* the count below reports what was there */ });
    const seen = await page.evaluate((sel) => ({
      baked: [...document.querySelectorAll<HTMLImageElement>(sel)].filter((img) => img.complete && img.naturalWidth > 0).length,
      ready: document.querySelectorAll('.gtile .gcar-slide--ex:first-of-type.is-loaded').length,
      extra: document.querySelectorAll('.gtile .gcar-slide--ex.is-loaded:not(:first-of-type)').length,
      wanted: document.querySelectorAll('.gcar[data-looks-wanted]').length,
      performanceUi: document.documentElement.hasAttribute('data-perf-ui'),
    }), baked);
    assert.ok(seen.baked >= 3, `baked covers reached the cards of a clean profile (${JSON.stringify(seen)}). If none did, the bake no longer matches a visitor's context: run pnpm run build:gallery-covers --profile=<the profile this shell serves>`);
    assert.ok(seen.ready >= seen.baked, 'a card with a baked cover is marked ready');
    assert.equal(seen.wanted, 0, 'no card is of interest until the person points at one');
    assert.equal(seen.extra, 0, 'no extra look is drawn for a card nobody asked about');

    // Interest: the pointer on a card asks for its other looks (not in Performance UI, which draws none).
    if (!seen.performanceUi) {
      const card = page.locator('.gtile:has(.gcar-dot)').first();
      await card.scrollIntoViewIfNeeded();
      await card.hover();
      await page.waitForFunction(() => document.querySelectorAll('.gcar[data-looks-wanted]').length === 1, undefined, { timeout: 10_000 });
    }
  } finally { await browser.close(); }
});
