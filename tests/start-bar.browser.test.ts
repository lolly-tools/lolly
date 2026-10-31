// SPDX-License-Identifier: MPL-2.0
/**
 * The studio's pinned bar (plan 336 P1, P2) against the rooms under the bar.
 *
 *  - A room's popover paints over the bar: the swatch picker in Colours, the help
 *    tip in Logos and anything the Type room raises to popover height, on a desk
 *    and on a phone. The bar used to win, so a tall picker card lost its name row
 *    under the bar.
 *  - The room strip shows when it scrolls: a fade on each end that has rooms past
 *    the edge, on a desk as well as on a phone.
 *  - The studio has one level-one heading, and the heading carries the design
 *    system's name.
 *  - On a phone, a tray that closes by emptying hands focus to a control that is
 *    drawn, not to "Add from…", which the phone bar keeps in the More menu.
 *
 *   LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5193 LOLLY_WEBGPU_TEST_ADAPTER=swiftshader node --import ./tests/browser-gpu.ts --test tests/start-bar.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell';
const DESK = { width: 1280, height: 860 };
const PHONE = { width: 390, height: 844 };
const FOUR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><rect width="100" height="100" fill="#C8553D"/>'
  + '<rect x="100" width="100" height="100" fill="#2F6690"/><rect x="200" width="100" height="100" fill="#F6AE2D"/>'
  + '<rect x="300" width="100" height="100" fill="#3A7D44"/></svg>';
const TOKENS = JSON.stringify({ color: { brand: { $type: 'color', $value: '#7A3E9D' }, ink: { $type: 'color', $value: '#1B1B1E' }, paper: { $type: 'color', $value: '#FBF7F0' } } });

async function withPage(viewport: { width: number; height: number }, run: (page: Page) => Promise<void>): Promise<void> {
  const browser: Browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const phone = viewport.width <= 640;
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  try {
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    });
    await run(await context.newPage());
  } finally {
    await browser.close();
  }
}

async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`${origin}/${hash}`, { waitUntil: 'networkidle' });
  await shellSettled(page);
  await page.locator('.ds-top').waitFor();
}

/** What is drawn near the top of `selector`, and whether that point lies in the bar's band. */
function topOf(page: Page, selector: string): Promise<{ inBar: boolean; hit: string; at: string }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const bar = document.querySelector('.ds-top')?.getBoundingClientRect();
    if (!el || !bar) return { inBar: false, hit: `missing ${sel}`, at: '' };
    const box = el.getBoundingClientRect();
    const y = Math.max(box.top, 0) + 6;
    const hit = document.elementFromPoint(box.left + Math.min(24, box.width / 2), y);
    return { inBar: y < bar.bottom, hit: el.contains(hit) ? 'self' : `${hit?.tagName}.${hit?.className}`, at: `y ${Math.round(y)}, bar ends ${Math.round(bar.bottom)}` };
  }, selector);
}

/** Open the Logos room's help tip, then scroll until its bubble starts under the bar. */
async function logosTipUnderBar(page: Page): Promise<string> {
  await open(page, '#/start?area=logos');
  const tip = page.locator('.ds-shell .help-tip-btn').first();
  await tip.waitFor();
  await tip.evaluate(btn => (btn as HTMLElement).click());
  const pop = '.ds-shell .help-tip-pop:not([hidden])';
  await page.locator(pop).waitFor();
  // The room has to be laid out tall enough to scroll the bubble up that far.
  await page.waitForFunction(() => document.documentElement.scrollHeight > innerHeight + 200);
  await page.evaluate((sel) => {
    const bar = document.querySelector('.ds-top')!.getBoundingClientRect();
    const top = document.querySelector(sel)!.getBoundingClientRect().top;
    window.scrollBy(0, top - (bar.bottom - 24));
  }, pop);
  return pop;
}

/** A layer at the rooms' popover height (the swatch picker's 30), placed over the bar from inside the Type room. */
async function typeLayerOverBar(page: Page): Promise<string> {
  await open(page, '#/start?area=type');
  await page.locator('[data-be-tab-panel="type"]').waitFor();
  await page.evaluate(() => {
    const layer = document.createElement('div');
    layer.dataset.testLayer = '';
    layer.style.cssText = 'position:fixed;top:4px;left:30%;width:120px;height:40px;z-index:30;background:Canvas';
    document.querySelector('[data-be-tab-panel="type"]')!.append(layer);
  });
  return '[data-test-layer]';
}

test('a room popover paints over the pinned bar on a desk', { skip, timeout: 180_000 }, async () => {
  await withPage(DESK, async (page) => {
    await open(page, '#/start?area=color');
    await page.locator('[data-be-pal] .be-swatch').first().waitFor({ state: 'attached' });
    // The starter group opens closed; a design system's own colours would show.
    await page.evaluate(() => document.querySelectorAll('details.be-pal-group').forEach(d => { (d as HTMLDetailsElement).open = true; }));
    await page.locator('[data-be-pal] .be-swatch').last().click();
    await page.locator('.be-editor:not([hidden])').waitFor();
    const card = await topOf(page, '.be-editor:not([hidden])');
    assert.ok(card.inBar, 'the picker card reaches into the bar, or this proves nothing');
    assert.equal(card.hit, 'self', `the picker's name row is drawn, not covered (${card.hit})`);

    const tip = await topOf(page, await logosTipUnderBar(page));
    assert.ok(tip.inBar, `the help tip sits in the bar band (${tip.at})`);
    assert.equal(tip.hit, 'self', `the Logos help tip is drawn over the bar (${tip.hit})`);

    const layer = await topOf(page, await typeLayerOverBar(page));
    assert.equal(layer.hit, 'self', `a Type room layer at popover height is drawn over the bar (${layer.hit})`);
  });
});

test('a room popover paints over the pinned bar on a phone', { skip, timeout: 180_000 }, async () => {
  await withPage(PHONE, async (page) => {
    const tip = await topOf(page, await logosTipUnderBar(page));
    assert.ok(tip.inBar, `the help tip sits in the bar band (${tip.at})`);
    assert.equal(tip.hit, 'self', `the Logos help tip is drawn over the bar (${tip.hit})`);
    const layer = await topOf(page, await typeLayerOverBar(page));
    assert.equal(layer.hit, 'self', `a Type room layer at popover height is drawn over the bar (${layer.hit})`);
  });
});

test('the desk room strip fades on each end that has rooms past it', { skip, timeout: 120_000 }, async () => {
  await withPage({ width: 700, height: 800 }, async (page) => {
    await open(page, '#/start');
    const strip = page.locator('.ds-rooms');
    const state = (): Promise<{ scrolls: boolean; more: string; mask: string }> => strip.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { scrolls: el.scrollWidth > el.clientWidth + 1, more: (el as HTMLElement).dataset.more ?? '', mask: cs.maskImage || cs.webkitMaskImage };
    });
    const start = await state();
    assert.ok(start.scrolls, 'eight rooms do not fit a 700px window, or this proves nothing');
    assert.equal(start.more, 'right', 'rooms wait past the right end only');
    assert.notEqual(start.mask, 'none', 'the strip fades where it continues');
    await strip.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await page.waitForFunction(() => (document.querySelector('.ds-rooms') as HTMLElement).dataset.more === 'left');
    await page.setViewportSize(DESK);
    await page.waitForFunction(() => !(document.querySelector('.ds-rooms') as HTMLElement).dataset.more);
    assert.equal((await state()).mask, 'none', 'a strip that fits has no fade');
  });
});

test('the studio has one level-one heading that carries the design system name', { skip, timeout: 120_000 }, async () => {
  for (const viewport of [DESK, PHONE]) {
    await withPage(viewport, async (page) => {
      await open(page, '#/start');
      await page.locator('[data-start-ds]:not([hidden])').waitFor();
      const name = await page.locator('[data-start-ds]').evaluate(el => (el.querySelector('input') as HTMLInputElement | null)?.value ?? el.textContent?.trim() ?? '');
      assert.ok(name, 'the bar shows a design system name');
      const h1 = page.getByRole('heading', { level: 1 });
      assert.equal(await h1.count(), 1, `one level-one heading at ${viewport.width}px`);
      const text = await h1.evaluate(el => el.textContent?.replace(/\s+/g, ' ').trim() ?? '');
      assert.match(text, /Design system/i);
      assert.ok(text.includes(name), `the heading "${text}" carries "${name}" at ${viewport.width}px`);
    });
  }
});

test('on a phone, an emptied tray hands focus to a control that is drawn', { skip, timeout: 180_000 }, async () => {
  await withPage(PHONE, async (page) => {
    // A furnished system first, so "Add from…" is offered (and kept in the More menu).
    await open(page, '#/start?source=file');
    const file = page.locator('.start-import-modal .start-import-file');
    await file.waitFor({ state: 'attached' });
    await file.setInputFiles({ name: 'tokens.json', mimeType: 'application/json', buffer: Buffer.from(TOKENS) });
    await page.locator('[data-install-plain]').click();
    await page.locator('[data-install-plain]').waitFor({ state: 'hidden' });
    await open(page, '#/start?area=overview&source=file');
    await file.waitFor({ state: 'attached' });
    // The studio reads whether the system is furnished after it mounts.
    await page.waitForFunction(() => (document.querySelector('[data-start-import]') as HTMLElement | null)?.hidden === false);
    await file.setInputFiles({ name: 'four.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(FOUR) });
    await page.locator('[data-colors-tray]').click();
    const all = page.locator('[data-ds-tray-all]').first();
    await all.waitFor();
    await all.focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-start-tray]').waitFor({ state: 'hidden' });
    const focus = await page.waitForFunction(() => {
      const el = document.activeElement as HTMLElement | null;
      return el && el !== document.body ? `${el.tagName}.${el.className}|${el.getClientRects().length}` : null;
    }, undefined, { timeout: 5000 }).then(h => h.jsonValue()).catch(() => 'BODY');
    assert.notEqual(focus, 'BODY', 'focus is not dropped on the page');
    assert.ok(!String(focus).endsWith('|0'), `focus is on a control that is drawn (${focus})`);
  });
});
