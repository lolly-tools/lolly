// SPDX-License-Identifier: MPL-2.0
/**
 * Touch swiping in present mode (shells/web/src/views/present-swipe.ts), with real touch
 * input in a 390 px phone viewport and the running shell's own stylesheets: next, back, a
 * short swipe that cancels, a vertical scroll the deck leaves alone, a swipe that starts
 * on an interactive web page box, the transitions that follow the finger and the ones
 * that play on release, a second finger, a mouse drag, and reduced motion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from 'playwright';

const origin = process.env.LOLLY_PRESENT_SWIPE_URL ?? process.env.LOLLY_PRESENT_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const skip = !origin && 'No browser origin; set LOLLY_PRESENT_SWIPE_URL, LOLLY_PRESENT_TEST_URL or LOLLY_EXPORT_TEST_URL.';
const PHONE = { width: 390, height: 844 };

type SwipeWindow = Window & {
  presentation: import('../shells/web/src/views/present-mode.ts').PresentController;
  LollyPresent: typeof import('../shells/web/src/views/present-mode.ts');
};

let bundle: Promise<string> | undefined;
function presenterBundle(): Promise<string> {
  bundle ??= build({
    stdin: { resolveDir: new URL('../', import.meta.url).pathname, loader: 'ts', contents: `export { openPresentMode } from './shells/web/src/views/present-mode.ts';` },
    bundle: true, write: false, format: 'iife', globalName: 'LollyPresent', platform: 'browser',
    loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  }).then(result => result.outputFiles[0]!.text);
  return bundle;
}

/** Four 1280 x 720 slides. a pushes to b (the default slide), b fades to c, c cuts to d.
 *  a holds a box that scrolls; d holds an interactive web page box. */
const DECK = `<div class="lolly-frames">
  <div class="lolly-frame-page" data-frame-id="a" data-frame-transition="slide" style="left:0;top:0;width:1280px;height:720px;background:#0c322c;color:#fff">
    <h1 style="margin:48px;font:600 64px system-ui">Slide A</h1>
    <div class="lolly-box" id="scroller" style="position:absolute;left:700px;top:100px;width:420px;height:520px;overflow-y:auto;background:#145a48"><div style="height:2400px;font:32px system-ui;padding:24px">A box that scrolls</div></div>
  </div>
  <div class="lolly-frame-page" data-frame-id="b" data-frame-transition="fade" style="left:1400px;top:0;width:1280px;height:720px;background:#30ba78;color:#0c322c"><h1 style="margin:48px;font:600 64px system-ui">Slide B</h1></div>
  <div class="lolly-frame-page" data-frame-id="c" data-frame-transition="none" style="left:2800px;top:0;width:1280px;height:720px;background:#2453ff;color:#fff"><h1 style="margin:48px;font:600 64px system-ui">Slide C</h1></div>
  <div class="lolly-frame-page" data-frame-id="d" style="left:4200px;top:0;width:1280px;height:720px;background:#fe7c3f;color:#000">
    <h1 style="margin:48px;font:600 64px system-ui">Slide D</h1>
    <div class="lolly-box" data-box-id="demo" style="position:absolute;left:320px;top:200px;width:640px;height:400px"><div class="lolly-box-web" data-lolly-web="ORIGIN/swipe-demo.html" data-web-load="click" data-web-title="Demo" data-interact="1" style="width:100%;height:100%"><div class="lolly-box-web-card" style="height:100%;display:grid;place-items:center;background:#123e33;color:#fff;font:40px system-ui">Demo</div></div></div>
  </div>
</div>`;

async function fixture(page: Page, initial = 'a'): Promise<void> {
  const shell = await page.request.get(origin!);
  assert.ok(shell.ok(), 'the configured shell responds');
  const shellDoc = new JSDOM(await shell.text(), { url: origin }).window.document;
  const stylesheets = [...shellDoc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(link => {
    const url = new URL(link.href);
    const href = `${url.pathname}${url.search}${link.href.includes('/src/styles/') ? '?direct' : ''}`;
    return `<link rel="stylesheet" href="${href.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">`;
  }).join('');
  assert.ok(stylesheets, 'the shell supplies its stylesheet');
  const server = createServer(async (request, response) => {
    if (request.url === '/swipe-fixture') {
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><html data-theme="dark"><head><meta name="viewport" content="width=device-width, initial-scale=1">${stylesheets}<style>#tool-canvas .lolly-box{position:absolute}.fixture-source{position:absolute;left:-10000px}</style></head><body><main id="tool-canvas" class="fixture-source"></main></body></html>`);
    } else if (request.url === '/swipe-demo.html') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html><body style="margin:0;font:24px system-ui;background:#0b2922;color:#fff"><section style="height:1600px;padding:32px">A live page</section></body></html>');
    } else {
      try {
        const upstream = await fetch(new URL(request.url ?? '/', origin!));
        response.statusCode = upstream.status;
        for (const [key, value] of upstream.headers) if (!['content-length', 'content-encoding', 'transfer-encoding'].includes(key)) response.setHeader(key, value);
        response.end(Buffer.from(await upstream.arrayBuffer()));
      } catch { response.statusCode = 502; response.end('Fixture asset unavailable'); }
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  page.once('close', () => { server.closeAllConnections(); server.close(); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  await page.goto(`http://127.0.0.1:${address.port}/swipe-fixture`);
  await page.addScriptTag({ content: await presenterBundle() });
  await page.evaluate(({ deck, initial }) => {
    const source = document.querySelector<HTMLElement>('#tool-canvas')!;
    source.innerHTML = deck.replaceAll('ORIGIN', location.origin);
    const win = window as unknown as SwipeWindow;
    win.presentation = win.LollyPresent.openPresentMode({ source, initial })!;
  }, { deck: DECK, initial });
  await page.locator('.pr-stage .pr-page.pr-active').waitFor();
  // The deck opens with its pages easing down to their fitted scale; touch once at rest.
  await page.waitForFunction(() => {
    const active = document.querySelector<HTMLElement>('.pr-stage .pr-page.pr-active');
    const scale = Number(active?.style.getPropertyValue('--pr-scale'));
    return !!active && scale > 0 && Math.abs(active.getBoundingClientRect().width - active.offsetWidth * scale) < 0.5;
  });
}

const frameId = (page: Page): Promise<string | null> => page.evaluate(() => (window as unknown as SwipeWindow).presentation.frameId);
const settled = (page: Page, id: string): Promise<unknown> => page.waitForFunction(want => (window as unknown as SwipeWindow).presentation.frameId === want, id);
type Pose = { tx: string; op: string; transition: string };
/** Inline pose on a page, by frame id: what the finger is holding. */
const poseOf = (page: Page, id: string): Promise<Pose> => page.evaluate(want => {
  const el = [...document.querySelectorAll<HTMLElement>('.pr-stage .pr-page')].find(p => p.dataset.frameId === want)!;
  return { tx: el.style.getPropertyValue('--pr-tx'), op: el.style.getPropertyValue('--pr-op'), transition: el.style.transition };
}, id);

interface Touch { client: CDPSession; page: Page }
async function touch(context: BrowserContext, page: Page): Promise<Touch> {
  return { client: await context.newCDPSession(page), page };
}
/** One finger from (x, y) along (dx, dy) in `steps` moves `stepMs` apart. `hold` keeps the
 *  finger down at the end for that long; `midway` runs at the halfway move. */
async function swipe(t: Touch, x: number, y: number, dx: number, dy = 0, opts: { steps?: number; stepMs?: number; hold?: number; midway?: () => Promise<void> } = {}): Promise<void> {
  const { steps = 10, stepMs = 16, hold = 0, midway } = opts;
  await t.client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await t.page.waitForTimeout(stepMs);
    await t.client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }] });
    if (midway && i === Math.round(steps / 2)) await midway();
  }
  if (hold) await t.page.waitForTimeout(hold);
  await t.client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
/** A point on the active slide, as fractions of its width and height. The low band of
 *  every slide here is plain slide, clear of the scroller, the web page box and the
 *  edge tap zones. */
async function point(page: Page, fx: number, fy = 0.92): Promise<{ x: number; y: number }> {
  const box = (await page.locator('.pr-stage .pr-page.pr-active').boundingBox())!;
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

/** Is the element a finger would land on at (x, y) inside `selector`? */
const lands = (page: Page, x: number, y: number, selector: string): Promise<boolean> =>
  page.evaluate(({ x, y, selector }) => !!document.elementFromPoint(x, y)?.closest(selector), { x, y, selector });

async function phone(browser: Browser, reducedMotion: 'reduce' | 'no-preference' = 'no-preference'): Promise<{ context: BrowserContext; page: Page; t: Touch }> {
  const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  return { context, page, t: await touch(context, page) };
}

test('a sideways swipe moves to the next and the previous slide, following the authored push', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, t } = await phone(browser);
    await fixture(page);
    const start = await point(page, 0.85);
    const mid: { held?: Pose; arriving?: Pose } = {};
    await swipe(t, start.x, start.y, -220, 0, { midway: async () => { mid.held = await poseOf(page, 'a'); mid.arriving = await poseOf(page, 'b'); } });
    const { held, arriving } = mid;
    assert.ok(held && arriving, 'the poses were read mid-swipe');
    assert.equal(held.transition, 'none', 'the leaving slide follows the finger, not a timer');
    assert.ok(Number.parseFloat(held.tx) < 0 && Number(held.op) < 1, `slide A is pushed left and fading under the finger: ${JSON.stringify(held)}`);
    assert.ok(Number.parseFloat(arriving.tx) > 0 && Number(arriving.op) > 0, `slide B comes in from the right: ${JSON.stringify(arriving)}`);
    await settled(page, 'b');
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>('.pr-stage .pr-page')].every(p => !p.style.getPropertyValue('--pr-tx')));
    const back = await point(page, 0.3);
    await swipe(t, back.x, back.y, 220);
    await settled(page, 'a');
    assert.equal(await page.locator('.pr-counter').innerText(), '1 / 4');
  } finally { await browser.close(); }
});

test('a short swipe springs back, a vertical drag scrolls the slide, and neither changes slide', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, t } = await phone(browser);
    await fixture(page);
    const start = await point(page, 0.85);
    const mid: { held?: Pose } = {};
    await swipe(t, start.x, start.y, -40, 0, { stepMs: 40, hold: 120, midway: async () => { mid.held = await poseOf(page, 'a'); } });
    assert.ok(mid.held && Number(mid.held.op) < 1, `the slide followed the finger before it let go: ${JSON.stringify(mid.held)}`);
    await page.waitForTimeout(400);
    assert.equal(await frameId(page), 'a', 'a short slow swipe cancels');
    assert.deepEqual(await poseOf(page, 'a'), { tx: '', op: '', transition: '' }, 'and the slide is handed back at rest');

    const scroller = (await page.locator('.pr-stage .pr-active #scroller').boundingBox())!;
    const sx = scroller.x + scroller.width / 2;
    await swipe(t, sx, scroller.y + scroller.height * 0.8, 4, -scroller.height * 0.6, { steps: 12 });
    await page.waitForTimeout(300);
    assert.ok(await page.locator('.pr-stage .pr-active #scroller').evaluate(el => el.scrollTop) > 0, 'the box scrolled under a vertical drag');
    assert.equal(await frameId(page), 'a', 'the deck did not take the vertical drag');

    assert.ok(await lands(page, sx, scroller.y + scroller.height / 2, '#scroller'), 'the next swipe starts on the scroller');
    await swipe(t, sx, scroller.y + scroller.height / 2, -200);
    await page.waitForTimeout(400);
    assert.equal(await frameId(page), 'a', 'a sideways swipe that starts on a box that scrolls belongs to that box');

    await swipe(t, start.x, start.y, -30, -220);
    await page.waitForTimeout(300);
    assert.equal(await frameId(page), 'a', 'a vertical drag on the slide itself is not a swipe');
  } finally { await browser.close(); }
});

test('a fade follows the finger in place, a cut holds still and plays on release', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, t } = await phone(browser);
    await fixture(page, 'b');
    const mid: { leaving?: Pose; cut?: Pose } = {};
    const start = await point(page, 0.85);
    await swipe(t, start.x, start.y, -220, 0, { midway: async () => { mid.leaving = await poseOf(page, 'b'); } });
    assert.ok(mid.leaving, 'read mid-swipe');
    assert.equal(Number.parseFloat(mid.leaving.tx), 0, 'a fade does not travel');
    assert.ok(Number(mid.leaving.op) < 1, 'it fades under the finger');
    await settled(page, 'c');

    await swipe(t, start.x, start.y, -220, 0, { midway: async () => { mid.cut = await poseOf(page, 'c'); } });
    assert.deepEqual(mid.cut, { tx: '', op: '', transition: '' }, 'a cut has no in-between to hold');
    await settled(page, 'd');
    assert.equal(await page.locator('.pr-stage').getAttribute('data-pr-transition'), 'none', 'the authored cut played');
  } finally { await browser.close(); }
});

test('a swipe that starts on an interactive web page box is the page\'s, a second finger is a pinch, a mouse drag is not a swipe, and an edge tap still taps', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, t } = await phone(browser);
    await fixture(page, 'd');
    const box = (await page.locator('.pr-stage .pr-active .lolly-box-web').boundingBox())!;
    const onBox = { x: box.x + box.width * 0.2, y: box.y + box.height / 2 };
    assert.ok(await lands(page, onBox.x, onBox.y, '.lolly-box-web'), 'the swipe starts on the web page box');
    await swipe(t, onBox.x, onBox.y, 200);
    await page.waitForTimeout(400);
    assert.equal(await frameId(page), 'd', 'the web page box keeps the swipe');

    const start = await point(page, 0.3);
    await t.client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x - 30, y: start.y, id: 0 }, { x: start.x + 30, y: start.y, id: 1 }] });
    for (let i = 1; i <= 8; i++) {
      await page.waitForTimeout(16);
      await t.client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - 30 + i * 25, y: start.y, id: 0 }, { x: start.x + 30 + i * 25, y: start.y, id: 1 }] });
    }
    await t.client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    assert.equal(await frameId(page), 'd', 'two fingers are never a swipe');

    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + 220, start.y, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(400);
    assert.equal(await frameId(page), 'd', 'a mouse drag does not change slides');

    // Focused (plan 303): the box is the slide's next step, and it keeps its gestures.
    await page.keyboard.press('ArrowRight');
    await page.locator('.pr-stage .pr-active .lolly-box-web.pr-interact-focus').waitFor();
    await swipe(t, onBox.x, onBox.y, 200);
    await page.waitForTimeout(400);
    assert.equal(await frameId(page), 'd', 'a focused interactive box keeps the swipe');
    assert.equal(await page.locator('.pr-stage .pr-active .lolly-box-web.pr-interact-focus').count(), 1, 'and keeps its focus');

    // Edge taps work exactly as before: Back first steps out of the focus, then leaves.
    await page.locator('.pr-tap-prev').tap();
    await page.waitForFunction(() => !document.querySelector('.pr-stage .pr-interact-focus'));
    await page.locator('.pr-tap-prev').tap();
    await settled(page, 'c');
  } finally { await browser.close(); }
});

test('with reduced motion a swipe still changes the slide, with nothing following the finger', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, t } = await phone(browser, 'reduce');
    await fixture(page);
    assert.ok(await page.locator('.pr-stage.pr-reduced').count(), 'the deck reads the preference');
    const mid: { held?: Pose } = {};
    const start = await point(page, 0.85);
    await swipe(t, start.x, start.y, -220, 0, { midway: async () => { mid.held = await poseOf(page, 'a'); } });
    assert.deepEqual(mid.held, { tx: '', op: '', transition: '' }, 'nothing moves under the finger');
    await settled(page, 'b');
  } finally { await browser.close(); }
});
