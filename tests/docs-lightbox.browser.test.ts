// SPDX-License-Identifier: MPL-2.0
/**
 * The docs picture viewer (shells/web/src/lib/docs-lightbox.ts) in a real Chromium, with
 * the stylesheet both readers ship: what jsdom cannot show.
 *
 *  1. A PHONE (390 x 844, touch). A tap on a screenshot opens it; a two-finger pinch
 *     zooms it, sent as real touch input through the DevTools protocol, so the browser
 *     makes the pointer events itself; a double-tap zooms in and back out; a swipe
 *     down closes the viewer. The page keeps its own pinch-zoom: only the viewer sets
 *     touch-action: none.
 *  2. A DESKTOP (1440 x 900). The wheel zooms around the pointer (the picture point
 *     under it stays there), a drag moves the zoomed picture, Tab stays inside the
 *     viewer, and Escape closes it and gives the focus back.
 *  3. SHARPNESS. Once a zoom settles, the vector <img> is laid out at its zoomed size,
 *     not scaled by a transform, so the SVG is drawn again at that size.
 *  4. BACK closes the viewer through one same-address history entry, as /info wires the viewer.
 *  5. MOTION. The picture grows from its place on the page, and with reduced motion
 *     asked for (the OS setting or the app's switch) nothing moves.
 *
 * The page is served from an intercepted origin, so the viewer's history entry and the
 * images' `.svg` addresses are real. A green run without Chromium means "not
 * exercised": the file skips by name where Playwright's Chromium is not installed
 * (`pnpm exec playwright install chromium`).
 *
 * Run directly: node --import ./tests/css-stub.mjs --test tests/docs-lightbox.browser.test.ts
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import type { Browser, BrowserContext, BrowserType, Page } from 'playwright';
import { icon } from '../shells/web/src/lib/icons.ts';
import { lightboxIcons } from '../shells/web/src/lib/docs-lightbox.ts';

const REPO = fileURLToPath(new URL('..', import.meta.url));

async function chromiumOrSkip(): Promise<{ chromium: BrowserType } | string> {
  let chromium: BrowserType;
  try { ({ chromium } = await import('playwright')); } catch { return 'no Playwright (pnpm install)'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}
const browserOrReason = await chromiumOrSkip();
const skip = typeof browserOrReason === 'string' ? browserOrReason : false;

let browser: Browser | undefined;
before(async () => { if (typeof browserOrReason !== 'string') browser = await browserOrReason.chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

const LIGHTBOX_JS = buildSync({
  entryPoints: [join(REPO, 'shells/web/src/lib/docs-lightbox.ts')],
  bundle: true, write: false, format: 'iife', globalName: 'LollyDocsLightbox',
  platform: 'browser', target: 'es2019', logLevel: 'silent',
}).outputFiles[0]!.text;
const ICONS = JSON.stringify(lightboxIcons((name) => icon(name))).replace(/</g, '\\u003c');
const CSS = ['styles/tokens.css', 'styles/parts/docs-components.css']
  .map((rel) => readFileSync(join(REPO, 'shells/web/src', rel), 'utf8')).join('\n');

// A screenshot: a grid of thin lines and small text, so a soft render would be visible.
const SHOT = (dark: boolean): string => `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">`
  + `<rect width="1440" height="900" fill="${dark ? '#10231f' : '#ffffff'}"/>`
  + Array.from({ length: 30 }, (_, i) => `<line x1="${i * 48}" y1="0" x2="${i * 48}" y2="900" stroke="${dark ? '#7fd' : '#0c322c'}" stroke-width="1"/>`).join('')
  + `<text x="40" y="80" font-size="14" fill="${dark ? '#fff' : '#000'}">${dark ? 'dark' : 'light'} twin</text></svg>`;
const DIAGRAM = `<svg xmlns="http://www.w3.org/2000/svg" width="586" height="455" viewBox="0 0 586 455"><rect width="586" height="455" fill="#e8f3df"/><circle cx="293" cy="227" r="150" fill="#0c322c"/></svg>`;

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${CSS}
body{margin:0;font-family:sans-serif;background:var(--ui-color-surface-canvas);color:var(--ui-color-text-default)}
.docs-content{max-width:720px;margin:0 auto;padding:24px 16px}
.docs-content img{display:block;max-width:100%;height:auto;margin:0 auto}
.shot{display:block;position:relative;width:fit-content;max-width:100%;margin:0 auto}
.shot--dual>img.shot-alt{display:none}
[data-theme="dark"] .shot--dual>img:not(.shot-alt){display:none}
[data-theme="dark"] .shot--dual>img.shot-alt{display:block}
.docs-diagram{display:block;max-width:40em;margin:1.5em auto}
.docs-figure{position:relative;margin:2rem auto}
.docs-figure-art{position:relative;border-radius:1.2em;overflow:hidden}
.fig{padding:24px;background:hsl(var(--secondary));border-radius:1.2em}
.spacer{height:1200px}
</style></head><body>
<main class="docs-content">
  <h1 id="top">Design</h1>
  <p><span class="shot shot--dual"><img src="/info/shots/design.svg" width="1440" height="900" alt="The free canvas"><img class="shot-alt" src="/info/shots/design.dark.svg" width="1440" height="900" alt="The free canvas"></span></p>
  <p><span class="docs-diagram"><img src="/info/diagrams/paths.svg" width="586" height="455" alt="Three export paths"></span></p>
  <figure class="docs-figure"><div class="docs-figure-art"><div class="fig" role="group" aria-label="One table feeds every output"><p>Programme table</p><p>Foyer screen, room screens, attendee page</p></div></div><figcaption><p>The table and its outputs.</p></figcaption></figure>
  <div class="spacer"></div>
</main>
<script>${LIGHTBOX_JS}</script>
<script>
window.__dispose = LollyDocsLightbox.enhanceDocsLightbox(document.querySelector('main.docs-content'), {
  back: LollyDocsLightbox.sameEntryBack(window),
  icons: ${ICONS},
  labels: { enlarge: function (a) { return a ? 'Enlarge: ' + a : 'Enlarge picture'; }, viewer: 'Picture viewer', close: 'Close',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit to screen', previous: 'Previous picture', next: 'Next picture',
    position: function (n, t) { return n + ' of ' + t; } },
});
</script></body></html>`;

async function open(opts: { phone?: boolean; reduce?: boolean; dark?: boolean; appReduce?: boolean } = {}): Promise<{ page: Page; ctx: BrowserContext }> {
  const ctx = await browser!.newContext(opts.phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' }
    : { viewport: { width: 1440, height: 900 }, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.route('https://docs.test/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/info/shots/design.svg') return route.fulfill({ contentType: 'image/svg+xml', body: SHOT(false) });
    if (url.pathname === '/info/shots/design.dark.svg') return route.fulfill({ contentType: 'image/svg+xml', body: SHOT(true) });
    if (url.pathname === '/info/diagrams/paths.svg') return route.fulfill({ contentType: 'image/svg+xml', body: DIAGRAM });
    let html = PAGE;
    if (opts.dark) html = html.replace('<html lang="en">', '<html lang="en" data-theme="dark">');
    if (opts.appReduce) html = html.replace('<html lang="en">', '<html lang="en" data-a11y-motion="reduce">');
    return route.fulfill({ contentType: 'text/html', body: html });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.goto('https://docs.test/info/create/design.html#top');
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
  return { page, ctx };
}

/** The viewer's picture box, and how it is drawn. */
const picState = (page: Page) => page.evaluate(() => {
  const pic = document.querySelector<HTMLElement>('dialog.doc-lightbox .doc-lightbox-pic')!;
  const r = pic.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, layoutW: pic.offsetWidth, transform: pic.style.transform, transition: pic.style.transition };
});
const isOpen = (page: Page) => page.evaluate(() => !!document.querySelector('dialog.doc-lightbox')?.hasAttribute('open'));
const settle = (page: Page, ms = 400) => page.waitForTimeout(ms);

test('phone: a tap opens the screenshot; pinch, double-tap and a swipe down work; the page keeps its own zoom', { skip }, async () => {
  const { page, ctx } = await open({ phone: true, reduce: true });
  // Outside the viewer, nothing takes the browser's gestures.
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.shot img')!).touchAction), 'auto');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).touchAction), 'auto');
  // The trigger rests visible on a touch screen.
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.doc-lightbox-open')!).opacity), '1');

  const img = await page.locator('.shot > img').first().boundingBox();
  await page.touchscreen.tap(img!.x + img!.width / 2, img!.y + img!.height / 2);
  await settle(page);
  assert.ok(await isOpen(page), 'a tap on the picture opens the viewer');
  const fitted = await picState(page);
  assert.ok(fitted.w > 300 && fitted.w <= 390, `fitted to the phone's width: ${fitted.w}`);

  // Pinch: two fingers from 60 px apart to 240 px apart around the middle.
  const cdp = await ctx.newCDPSession(page);
  const cx = 195;
  const cy = fitted.y + fitted.h / 2;
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', d: number) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }],
  });
  await touch('touchStart', 60);
  for (let d = 80; d <= 240; d += 20) await touch('touchMove', d);
  await touch('touchEnd', 240);
  await settle(page);
  const pinched = await picState(page);
  assert.ok(pinched.w > fitted.w * 3, `pinched open about 4x: ${fitted.w} -> ${pinched.w}`);
  // Settled sharp: laid out at the zoomed size, no transform scale left over.
  assert.ok(Math.abs(pinched.layoutW - pinched.w) < 1, `laid out at ${pinched.layoutW}, drawn at ${pinched.w}`);
  assert.match(pinched.transform, /scale\(1\)$/);

  // Double-tap: back to the fit, then in again.
  const tapTwice = async (x: number, y: number) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(80); await page.touchscreen.tap(x, y); };
  await tapTwice(cx, cy);
  await settle(page);
  assert.ok(Math.abs((await picState(page)).w - fitted.w) < 1, 'a double-tap on a zoomed picture fits it again');
  await tapTwice(cx, cy);
  await settle(page);
  assert.ok((await picState(page)).w > fitted.w * 1.9, 'a double-tap on a fitted picture zooms in');
  await tapTwice(cx, cy);
  await settle(page);

  // Swipe down closes.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 3 }] });
  for (let dy = 20; dy <= 260; dy += 40) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy + dy, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(page);
  assert.equal(await isOpen(page), false, 'a swipe down closes the viewer');
  await ctx.close();
});

test('phone: a short swipe down springs back, and a sideways swipe moves to the next picture', { skip }, async () => {
  const { page, ctx } = await open({ phone: true, reduce: true });
  await page.locator('.shot .doc-lightbox-open').click();
  await settle(page);
  const cdp = await ctx.newCDPSession(page);
  const fitted = await picState(page);
  const cy = fitted.y + fitted.h / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: cy, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: cy + 30, id: 1 }] });
  await page.waitForTimeout(250);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: cy + 40, id: 1 }] });
  await page.waitForTimeout(250);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(page);
  assert.ok(await isOpen(page), 'a short, slow pull does not close it');
  assert.ok(Math.abs((await picState(page)).y - fitted.y) < 1, 'and the picture goes back to its place');

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y: cy, id: 2 }] });
  for (let dx = 20; dx <= 220; dx += 40) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 320 - dx, y: cy, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(page);
  assert.equal(await page.locator('.doc-lightbox-count').textContent(), '2 of 3');
  assert.equal(await page.locator('.doc-lightbox-pic img').getAttribute('src'), '/info/diagrams/paths.svg');
  await ctx.close();
});

test('desktop: the wheel zooms around the pointer, a drag moves the picture, Tab stays inside and Escape returns focus', { skip }, async () => {
  const { page, ctx } = await open({ reduce: true });
  // With a mouse the trigger shows on approach.
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.doc-lightbox-open')!).opacity), '0');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Enlarge: The free canvas');
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement!).opacity), '1', 'a keyboard focus shows the trigger');
  await page.keyboard.press('Enter');
  await settle(page);
  assert.ok(await isOpen(page));
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close');

  const fitted = await picState(page);
  // A point a quarter of the way into the picture, under the pointer.
  const px = fitted.x + fitted.w * 0.25;
  const py = fitted.y + fitted.h * 0.25;
  await page.mouse.move(px, py);
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100);
  await settle(page);
  const zoomed = await picState(page);
  assert.ok(zoomed.w > fitted.w * 1.5, `the wheel zoomed in: ${fitted.w} -> ${zoomed.w}`);
  const u = (px - zoomed.x) / zoomed.w;
  const v = (py - zoomed.y) / zoomed.h;
  assert.ok(Math.abs(u - 0.25) < 0.01 && Math.abs(v - 0.25) < 0.01, `the point under the pointer stayed put: ${u}, ${v}`);
  assert.ok(Math.abs(zoomed.layoutW - zoomed.w) < 1, 'settled at its laid-out size, so the vector is redrawn');

  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(600, 400, { steps: 5 });
  await page.mouse.up();
  const dragged = await picState(page);
  assert.ok(Math.abs(dragged.x - (zoomed.x - 100)) < 1 && Math.abs(dragged.y - (zoomed.y - 50)) < 1, 'a drag moves the zoomed picture');

  // + and - and 0.
  await page.keyboard.press('0');
  assert.ok(Math.abs((await picState(page)).w - fitted.w) < 1);
  await page.keyboard.press('+');
  assert.ok((await picState(page)).w > fitted.w * 1.5);
  await page.keyboard.press('-');
  assert.ok(Math.abs((await picState(page)).w - fitted.w) < 1);

  // Tab and Shift+Tab come round inside the viewer and never leave the dialog.
  const seen: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => document.activeElement?.closest('dialog.doc-lightbox') ? document.activeElement.getAttribute('aria-label') : null);
    assert.ok(at, `Tab ${i + 1} left the viewer`);
    seen.push(at!);
  }
  assert.deepEqual(seen.slice(0, 6), ['Previous picture', 'Next picture', 'Zoom out', 'Zoom in', 'Fit to screen', 'Close']);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Shift+Tab');
    assert.ok(await page.evaluate(() => !!document.activeElement?.closest('dialog.doc-lightbox')), `Shift+Tab ${i + 1} left the viewer`);
  }
  await page.keyboard.press('Escape');
  // The viewer gives its history entry back; the focus must survive that traversal.
  await page.waitForTimeout(150);
  assert.equal(await isOpen(page), false);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Enlarge: The free canvas', 'focus is back on the trigger');
  await ctx.close();
});

test('the dark theme opens the dark twin', { skip }, async () => {
  const { page, ctx } = await open({ dark: true, reduce: true });
  await page.locator('.shot .doc-lightbox-open').click({ force: true });
  assert.equal(await page.locator('.doc-lightbox-pic img').getAttribute('src'), '/info/shots/design.dark.svg');
  await ctx.close();
});

test('Back closes the viewer, keeps the address, the scroll and the focus, and leaves the next Back to the page', { skip }, async () => {
  const { page, ctx } = await open({ reduce: true });
  const href = page.url();
  // Read from part-way down the page, past the #top anchor the address holds.
  await page.evaluate(() => document.querySelector('.docs-diagram')!.scrollIntoView({ block: 'center' }));
  const readY = (): Promise<number> => page.evaluate(() => window.scrollY);
  const startY = await readY();
  assert.ok(startY > 100, 'the page is scrolled away from its anchor');
  const length = await page.evaluate(() => history.length);
  await page.locator('.docs-diagram .doc-lightbox-open').focus();
  await page.keyboard.press('Enter');
  assert.ok(await isOpen(page));
  assert.equal(await page.evaluate(() => history.length), length + 1);
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => !document.querySelector('dialog.doc-lightbox')?.hasAttribute('open'));
  await page.waitForTimeout(150);
  assert.equal(page.url(), href);
  assert.equal(await readY(), startY, 'Back does not jump to the anchor');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Enlarge: Three export paths');
  // Closed with the button, the entry is given back: the same address, the same
  // scroll, the focus on the trigger and the viewer shut.
  await page.keyboard.press('Enter');
  assert.ok(await isOpen(page));
  await page.locator('dialog.doc-lightbox [data-lb="close"]').click();
  await page.waitForTimeout(150);
  assert.equal(page.url(), href);
  assert.equal(await isOpen(page), false);
  assert.equal(await readY(), startY);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Enlarge: Three export paths');
  await ctx.close();
});

test('motion: the picture grows from its place; with reduced motion asked for, nothing moves', { skip }, async () => {
  const moving = await open({});
  await moving.page.locator('.shot > img:not(.shot-alt)').click();
  await moving.page.waitForTimeout(40);
  assert.match((await picState(moving.page)).transition, /transform/, 'opening eases the picture into place');
  await moving.page.waitForTimeout(400);
  await moving.page.keyboard.press('Escape');
  await moving.page.waitForFunction(() => !document.querySelector('dialog.doc-lightbox')?.hasAttribute('open'));
  await moving.ctx.close();

  for (const asked of [{ reduce: true }, { appReduce: true }]) {
    const { page, ctx } = await open(asked);
    await page.locator('.shot > img:not(.shot-alt)').click();
    const s = await picState(page);
    assert.equal(s.transition, '', `no transition when ${JSON.stringify(asked)}`);
    await page.keyboard.press('+');
    assert.equal((await picState(page)).transition, '');
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(page), false, 'closes at once');
    await ctx.close();
  }
});

test('a figure opens as a copy laid out like the page, and scales without reflowing', { skip }, async () => {
  const { page, ctx } = await open({ reduce: true });
  const pageW = await page.evaluate(() => document.querySelector('.docs-figure-art')!.getBoundingClientRect().width);
  await page.locator('.docs-figure .doc-lightbox-open').click({ force: true });
  const art = await page.evaluate(() => {
    const a = document.querySelector<HTMLElement>('dialog.doc-lightbox .doc-lightbox-art')!;
    return { layoutW: a.offsetWidth, inert: a.hasAttribute('inert'), text: a.textContent };
  });
  assert.equal(Math.round(art.layoutW), Math.round(pageW), 'the copy keeps the page\'s layout width');
  assert.ok(art.inert);
  assert.match(art.text ?? '', /Programme table/);
  assert.equal(await page.locator('.doc-lightbox-caption').textContent(), 'The table and its outputs. One table feeds every output');
  await page.keyboard.press('+');
  assert.equal(await page.evaluate(() => document.querySelector<HTMLElement>('dialog.doc-lightbox .doc-lightbox-art')!.offsetWidth), art.layoutW, 'zoom scales the copy, it does not reflow it');
  await ctx.close();
});
