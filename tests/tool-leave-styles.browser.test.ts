// SPDX-License-Identifier: MPL-2.0
/**
 * A tool keeps its own styles for as long as its markup is on the screen.
 *
 * Leaving a tool tears the view down first and removes the markup afterwards: the old
 * markup fades out in the cross-view layer (view-fade.ts), and a tool opened from
 * another tool keeps the old markup until its own layout is ready. The tool's sheet
 * used to be removed in the teardown, so the markup stood bare for up to half a second.
 * Claim is the clearest case: its icon has no size of its own, and it filled the canvas.
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/browser-gpu.ts --test tests/tool-leave-styles.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type Page } from 'playwright';

const origin = process.env.LOLLY_EXPORT_TEST_URL ?? process.env.LOLLY_GALLERY_TEST_URL ?? process.env.LOLLY_IMPORT_TEST_URL;
const skip = origin ? false : 'Set LOLLY_EXPORT_TEST_URL, LOLLY_GALLERY_TEST_URL or LOLLY_IMPORT_TEST_URL to a running web shell.';
const ICON = '.eit-empty-icon svg';

interface Seen { frames: number; widest: number; inFade: number; bare: number }

/** Open Claim and wait until its sheet is mounted and its icon is drawn at its own size. */
async function openClaim(page: Page): Promise<number> {
  await page.goto(`${origin}/#/tool/claim`);
  await page.waitForFunction((icon) => !!document.head.querySelector('style[data-lolly-scope]') && !!document.querySelector(icon), ICON, { timeout: 60_000 });
  if (await page.locator('.tmpl-chooser-panel').first().isVisible().catch(() => false)) await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const width = await page.locator(ICON).evaluate((el) => el.getBoundingClientRect().width);
  assert.ok(width > 0 && width < 120, `the icon starts at its own size, ${width}px`);
  return width;
}

/** Read the icon on every frame from now until it has left the document. */
async function watchIcon(page: Page): Promise<void> {
  await page.evaluate((icon) => {
    const seen = { frames: 0, widest: 0, inFade: 0, bare: 0 };
    Reflect.set(window, '__leaveSeen', seen);
    const tick = (): void => {
      const el = document.querySelector(icon);
      if (el) {
        seen.frames++;
        seen.widest = Math.max(seen.widest, el.getBoundingClientRect().width);
        if (el.closest('.view-fade')) seen.inFade++;
        if (!document.head.querySelector('style[data-lolly-scope], style[data-lolly-leaving]')) seen.bare++;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ICON);
}

async function leaveTo(page: Page, hash: string): Promise<Seen> {
  await watchIcon(page);
  await page.evaluate((next) => { location.hash = next; }, hash);
  await page.waitForFunction((icon) => !document.querySelector(icon), ICON, { timeout: 30_000 });
  await page.waitForTimeout(300);
  return page.evaluate(() => Reflect.get(window, '__leaveSeen') as Seen);
}

test('a tool that fades out to another view keeps its styles until it is gone', { skip, timeout: 180_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, reducedMotion: 'no-preference' });
    const width = await openClaim(page);
    const seen = await leaveTo(page, '#/utilities');
    assert.ok(seen.inFade > 0, 'the old view faded out, so the fade layer held the tool for some frames');
    assert.equal(seen.bare, 0, 'no frame showed the tool without its sheet');
    assert.ok(seen.widest <= width + 1, `the icon kept its size while it faded: ${seen.widest}px against ${width}px`);
    assert.equal(await page.locator('style[data-lolly-leaving]').count(), 0, 'the held sheet left with the markup');
  } finally { await browser.close(); }
});

test('a tool replaced by another tool keeps its styles until the next one is drawn', { skip, timeout: 180_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const width = await openClaim(page);
    const seen = await leaveTo(page, '#/tool/qr-code');
    assert.equal(seen.bare, 0, 'no frame showed the old tool without its sheet');
    assert.ok(seen.widest <= width + 1, `the icon kept its size until it was replaced: ${seen.widest}px against ${width}px`);
    await page.waitForFunction(() => document.head.querySelectorAll('style[data-lolly-scope]').length === 1, null, { timeout: 60_000 });
    assert.equal(await page.locator('style[data-lolly-leaving]').count(), 0, 'one tool sheet is mounted, and the old one is gone');
  } finally { await browser.close(); }
});
