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
      // The last key answers the studio's one-time "What is this design system
      // called?" (plan 320 S5) for the default system. The first edit makes that
      // system the person's own, and the ask then appears above the palette a moment
      // later, which would move the handles between measuring and dragging them.
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack', 'lolly:ds-name-asked:default']) localStorage.setItem(key, '1');
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
    // At rest a swatch is colour, name and hex on every width (plan 346 change 8);
    // Select brings the checkboxes and the handles, still full touch targets.
    assert.equal(await handles.first().isVisible(), false, 'no handle at rest on a tablet either');
    assert.equal(await group.locator('.be-pal-check').first().isVisible(), false, 'nor a checkbox');
    await group.locator('[data-be-pal-all]').click();
    await handles.first().waitFor({ state: 'visible' });
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
    // Each move saves the whole document, one save at a time, and under load the saves
    // trail the moves. The keyboard swap's save already holds the swapped order, so an
    // order check can pass while the mouse and touch saves are still queued, and a reload
    // then comes between them. The studio says when the newest edit is stored: its save
    // state reads Saved only once the latest save has finished. Then the stored order is
    // read once, and must be this drag's.
    await page.locator('.be-palette [data-be-save-state]').filter({ hasText: /^Saved$/ }).waitFor();
    const stored = await page.evaluate(async (want: Array<string | undefined>) => {
      const path = '/src/bridge/index.ts';
      const doc = await (await (await import(path)).createBridge()).tokens.raw();
      const order = Object.values(doc.$extensions ?? {}).map(value => (value as { paletteOrder?: unknown[] }).paletteOrder).find(Array.isArray);
      return (order ?? []).filter(key => want.includes(key as string));
    }, swapped);
    assert.deepEqual(stored, swapped, 'the stored order is the touch drag\'s');
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await group.waitFor();
    assert.deepEqual(await keys(), swapped);
    // At rest, keyboard focus on a tile shows its handle as an overlay inside the
    // tile, so the grid never changes height, and Space, an arrow and Space reorder.
    const restHeight = (await group.boundingBox())!.height;
    await group.locator('[data-be-tile]').first().focus();
    await handles.first().waitFor({ state: 'visible' });
    const tileBox = (await group.locator('[data-be-tile]').first().boundingBox())!;
    const overlayBox = (await handles.first().boundingBox())!;
    assert.equal((await group.boundingBox())!.height, restHeight, 'showing the focus handle moves no row');
    assert.ok(overlayBox.x >= tileBox.x && overlayBox.y >= tileBox.y
      && overlayBox.x + overlayBox.width <= tileBox.x + tileBox.width && overlayBox.y + overlayBox.height <= tileBox.y + tileBox.height,
      'the handle sits inside the tile\'s own box');
    assert.ok(overlayBox.width >= 44 && overlayBox.height >= 44, 'still a full target');
    await page.keyboard.press('Tab');
    assert.equal(await handles.first().evaluate(el => el === document.activeElement), true, 'Tab reaches the handle');
    await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space');
    assert.deepEqual(await keys(), before, 'the overlay handle reorders by keyboard');
    await page.locator('.be-palette [data-be-save-state]').filter({ hasText: /^Saved$/ }).waitFor();
    await page.keyboard.press('Space'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Space');
    assert.deepEqual(await keys(), swapped, 'and back again');
    await page.locator('.be-palette [data-be-save-state]').filter({ hasText: /^Saved$/ }).waitFor();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await handles.first().waitFor({ state: 'hidden' });
    await page.screenshot({ path: '/tmp/lolly-brand-palette-tablet.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.dataset.a11yText = 'large'; });
    await group.locator('[data-reorder-row]').first().scrollIntoViewIfNeeded();
    assert.equal(await group.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
    // A phone shows four colours a row and no handle row under each at rest; Select
    // mode brings the checkboxes and handles back, still full touch targets (plan 336).
    assert.equal(await handles.first().isVisible(), false, 'no permanent handle row on a phone');
    await group.locator('[data-be-pal-all]').click();
    await handles.first().waitFor({ state: 'visible' });
    assert.ok((await group.locator('.be-pal-check').first().boundingBox())!.width >= 44);
    const phoneHandle = (await handles.first().boundingBox())!;
    assert.ok(phoneHandle.width >= 44 && phoneHandle.height >= 44, 'the Select-mode handle keeps its 44px target');
    await page.screenshot({ path: '/tmp/lolly-brand-palette-phone.png', fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});

// ── An edit made while the studio says Saving… (lib/design-system/edit-journal.ts) ──

/** Every hidden journal slot this device holds, read through the app's own state bridge. */
const journalSlots = (page: import('playwright').Page): Promise<string[]> => page.evaluate(async () => {
  const path = '/src/bridge/index.ts';
  const bridge = await (await import(path)).createBridge();
  return (await bridge.state.list()).map((r: { slot: string }) => r.slot).filter((s: string) => s.startsWith('__dsjournal__:'));
});

async function openPalette(page: import('playwright').Page) {
  await page.goto(`${origin}/#/start?area=color&focus=generate&seed=%23e0452b`, { waitUntil: 'networkidle' }); await shellSettled(page);
  await page.locator('[data-be-add-ramp="primary"]').click();
  const group = page.locator('[data-be-group="Primary shades"]');
  await group.waitFor();
  const status = page.locator('.be-palette [data-be-save-state]');
  await status.filter({ hasText: /^Saved$/ }).waitFor();
  const keys = () => group.locator('[data-reorder-row]').evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.reorderRow));
  return { group, status, keys, handles: group.locator('[data-reorder-handle]') };
}

async function studioContext() {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack', 'lolly:ds-name-asked:default']) localStorage.setItem(key, '1');
  });
  const page = await context.newPage();
  // A slow device, as before: the saves trail the edits.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return { browser, context, page };
}

test('an edit made while the studio says Saving… survives a reload, then saves the normal way', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 180_000,
}, async () => {
  const { browser, context, page } = await studioContext();
  try {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const { group, status, keys, handles } = await openPalette(page);
    const before = await keys();
    // Hold the studio's save queue (the same module instance the app uses), so the next
    // save can only say Saving…: the reload is certain to come before it finishes.
    await page.evaluate(async () => {
      const path = '/src/lib/design-system/logo-ownership.ts';
      const queue = await import(path);
      void queue.withLogoHeadLock(() => new Promise(() => {}));
    });
    await handles.first().press('Space'); await handles.first().press('ArrowRight'); await handles.first().press('Space');
    const moved = [before[1], before[0], ...before.slice(2)];
    assert.deepEqual(await keys(), moved);
    assert.equal(await status.textContent(), 'Saving…');
    // The journal has the edit without waiting for the save.
    await page.waitForFunction(async () => {
      const path = '/src/bridge/index.ts';
      const bridge = await (await import(path)).createBridge();
      return (await bridge.state.list()).some((r: { slot: string }) => r.slot.startsWith('__dsjournal__:'));
    });
    assert.equal(await status.textContent(), 'Saving…', 'the save is still waiting when the page goes');
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await group.waitFor();
    assert.deepEqual(await keys(), moved, 'the studio opens on the edit that had not finished saving');
    await status.filter({ hasText: /^Saved$/ }).waitFor();
    await page.waitForFunction(async () => {
      const path = '/src/bridge/index.ts';
      const bridge = await (await import(path)).createBridge();
      return !(await bridge.state.list()).some((r: { slot: string }) => r.slot.startsWith('__dsjournal__:'));
    });
    assert.equal(await page.locator('[data-be-journal]').count(), 0, 'nothing to ask: the base still matched');
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await group.waitFor();
    assert.deepEqual(await keys(), moved, 'stored for good, not only replayed');
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});

test('an unsaved edit the stored document has moved on from waits for the person to choose', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 180_000,
}, async () => {
  const { browser, context, page } = await studioContext();
  try {
    const { group, status, keys, handles } = await openPalette(page);
    await handles.first().press('Space'); await handles.first().press('ArrowRight'); await handles.first().press('Space');
    await status.filter({ hasText: /^Saved$/ }).waitFor();
    const saved = await keys();
    const restoredOrder = [saved[1], saved[0], ...saved.slice(2)];
    // A tab that closed with an unsaved edit made before the version stored now.
    const plant = (tab: string) => page.evaluate(async ({ tab, want }) => {
      const path = '/src/bridge/index.ts';
      const bridge = await (await import(path)).createBridge();
      const doc = structuredClone(await bridge.tokens.raw()) as { $extensions: Record<string, { paletteOrder?: string[] }> };
      const ext = Object.values(doc.$extensions).find(v => Array.isArray(v.paletteOrder))!;
      ext.paletteOrder = [...want, ...ext.paletteOrder!.filter(k => !want.includes(k))];
      const system = (await bridge.tokens.active()).id;
      const slot = `__dsjournal__:${system}:${tab}`;
      await bridge.state.save(slot, { v: 1, system, tab, base: 'sha256:an-older-version', at: Date.now() - 60_000, doc });
      return slot;
    }, { tab, want: restoredOrder as string[] });

    // Keep the saved version.
    const first = await plant('closed-tab-1');
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await group.waitFor();
    const card = page.locator('[data-be-journal]');
    await card.waitFor();
    assert.deepEqual(await keys(), saved, 'never written over the stored document before a choice');
    assert.match((await card.locator('.be-journal-title').textContent()) ?? '', /^Changes that didn't finish saving$/);
    assert.match((await card.locator('.be-journal-body').textContent()) ?? '', /saved again since then, in another tab or by a sync\.$/);
    const restoreBtn = card.getByRole('button', { name: 'Restore your unsaved changes' });
    const keepBtn = card.getByRole('button', { name: 'Keep the saved version' });
    for (const b of [restoreBtn, keepBtn]) assert.ok(((await b.boundingBox())?.height ?? 0) >= 44, 'a full touch target');
    const ring = await card.evaluate(el => { const cs = getComputedStyle(el); return [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth]; });
    assert.equal(new Set(ring).size, 1, 'a hairline all round, never one edge');
    await keepBtn.click();
    await card.waitFor({ state: 'detached' });
    await page.waitForFunction(async (slot) => {
      const path = '/src/bridge/index.ts';
      const bridge = await (await import(path)).createBridge();
      return !(await bridge.state.list()).some((r: { slot: string }) => r.slot === slot);
    }, first);
    assert.deepEqual(await keys(), saved);

    // Restore the unsaved changes.
    await plant('closed-tab-2');
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await group.waitFor();
    await card.waitFor();
    await card.getByRole('button', { name: 'Restore your unsaved changes' }).click();
    await card.waitFor({ state: 'detached' });
    assert.deepEqual(await keys(), restoredOrder);
    await status.filter({ hasText: /^Saved$/ }).waitFor();
    await page.waitForFunction(async () => {
      const path = '/src/bridge/index.ts';
      const bridge = await (await import(path)).createBridge();
      return !(await bridge.state.list()).some((r: { slot: string }) => r.slot.startsWith('__dsjournal__:'));
    });
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await group.waitFor();
    assert.deepEqual(await keys(), restoredOrder, 'the restored version is the stored one now');
    assert.deepEqual(await journalSlots(page), []);
  } finally { await context.close(); await browser.close(); }
});
