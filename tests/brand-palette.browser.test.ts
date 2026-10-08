// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
test('palette handles support keyboard, mouse and tablet dragging with persistent order', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    });
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/#/start?area=color&focus=generate&seed=%23e0452b`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-be-add-ramp="primary"]').click();
    const group = page.locator('[data-be-group="Primary shades"]');
    await group.waitFor();
    const keys = () => group.locator('[data-reorder-row]').evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.reorderRow));
    const before = await keys(); assert.ok(before.length > 2);
    const handles = group.locator('[data-reorder-handle]');
    await handles.first().press('Space'); await handles.first().press('ArrowRight'); await handles.first().press('Escape');
    assert.deepEqual(await keys(), before, 'Escape leaves order intact');
    await handles.first().press('Space'); await handles.first().press('ArrowRight'); await handles.first().press('Space');
    const swapped = [before[1], before[0], ...before.slice(2)];
    assert.deepEqual(await keys(), swapped);
    assert.equal(await handles.nth(1).evaluate(el => el === document.activeElement), true);
    await handles.first().scrollIntoViewIfNeeded();
    const from = (await handles.first().boundingBox())!, to = (await group.locator('[data-reorder-row]').nth(1).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down(); await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 }); await page.mouse.up();
    assert.deepEqual(await keys(), before);
    const touchFrom = (await handles.first().boundingBox())!, touchTo = (await group.locator('[data-reorder-row]').nth(1).boundingBox())!;
    assert.ok(touchFrom.width >= 44 && touchFrom.height >= 44);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchFrom.x + touchFrom.width / 2, y: touchFrom.y + touchFrom.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchTo.x + touchTo.width / 2, y: touchTo.y + touchTo.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.deepEqual(await keys(), swapped);
    await page.waitForFunction(async () => {
      const path = '/src/bridge/index.ts';
      const doc = await (await (await import(path)).createBridge()).tokens.raw();
      return Object.values(doc.$extensions ?? {}).some(value => Array.isArray((value as { paletteOrder?: unknown[] }).paletteOrder));
    });
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await group.waitFor();
    assert.deepEqual(await keys(), swapped);
    await page.screenshot({ path: '/tmp/lolly-brand-palette-tablet.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.dataset.a11yText = 'large'; });
    await handles.first().scrollIntoViewIfNeeded();
    assert.equal(await group.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
    assert.ok((await group.locator('.be-pal-check').first().boundingBox())!.width >= 44);
    await page.screenshot({ path: '/tmp/lolly-brand-palette-phone.png', fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});
