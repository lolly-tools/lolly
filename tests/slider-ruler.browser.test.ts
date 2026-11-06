// SPDX-License-Identifier: MPL-2.0
/**
 * The ruler dial (shells/web/src/components/slider-ruler.ts): the phone presentation
 * of the shell's slider, driven in a real browser with touch and with the keyboard.
 *
 * What is pinned: a drag moves the value by the distance dragged and a throw glides on
 * and comes to rest exactly on a step; the hooks fire as the track's do (a value per
 * step under the finger, one commit, drag start and end around the whole gesture, glide
 * included), with the glide's steps sent as previews; a touch that passes no step is
 * not an edit, and one that passes any step commits; the keys still step the value and
 * move the ruler; reduced motion drops the glide; the readout opens a number field; the
 * element stays one slider in the accessibility tree with the unit in its value text,
 * the ruler stays out of the tree, and the targets are at least 44px; a wide window
 * gets the track.
 *
 * Needs the Vite dev server for the source modules: set LOLLY_EXPORT_TEST_URL (CI does).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const SKIP = origin ? false : 'set LOLLY_EXPORT_TEST_URL';

type Page = import('playwright-core').Page;
type Log = Array<[string, number?]>;

async function fixture(opts: { width?: number; reduce?: boolean } = {}): Promise<Page> {
  const browser = await getBrowser();
  const page = await browser.newPage({ hasTouch: true, viewport: { width: opts.width ?? 390, height: 700 }, deviceScaleFactor: 2,
    reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(new URL(origin!).href, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(origin!);
  await page.setContent('<main id="fixture" style="width:358px;margin:16px;font:14px/1.4 sans-serif"></main>');
  await page.addScriptTag({ type: 'module', content: `
    import '/src/styles/tokens.css';
    import '/src/styles/parts/fields.css';
    import '/src/styles/parts/tool.css';
    import { customSliderHtml, mountCustomSlider } from '/src/components/custom-slider.ts';
    import { startLayoutPosture } from '/src/lib/layout-posture.ts';
    startLayoutPosture();
    const scope = document.querySelector('#fixture');
    scope.innerHTML = '<label class="input-row"><span class="input-label"><span class="input-label-text">Exposure'
      + ' <span class="input-value">0</span></span></span>'
      + customSliderHtml({ min: -100, max: 100, step: 1, value: 0, unit: '%', label: 'Exposure', attrs: 'data-input-id="exposure"' })
      + '</label>';
    const el = scope.querySelector('.custom-slider');
    const readout = scope.querySelector('.input-value');
    window.__log = [];
    window.__slider = mountCustomSlider(el, {
      onInput: (v) => { readout.textContent = String(v); window.__log.push(['input', v]); },
      onCommit: (v) => { readout.textContent = String(v); window.__log.push(['commit', v]); },
      onPreview: (v) => { readout.textContent = String(v); window.__log.push(['preview', v]); },
      onDragStart: () => window.__log.push(['dragStart']),
      onDragEnd: () => window.__log.push(['dragEnd']),
    }, { ruler: true, readout });
    scope.dataset.ready = 'true';
  ` });
  await page.waitForSelector('#fixture[data-ready="true"]').catch(e => { throw new Error(errors.join('\n') || String(e)); });
  await page.waitForTimeout(100); // the ResizeObserver's first measure
  assert.deepEqual(errors, []);
  return page;
}

const slider = (page: Page) => page.locator('.custom-slider');
const now = async (page: Page): Promise<string | null> => slider(page).getAttribute('aria-valuenow');
const log = (page: Page): Promise<Log> => page.evaluate(() => (window as unknown as { __log: Log }).__log.splice(0));

/** A one-finger swipe with real spacing in time. Each event carries its own timestamp,
 *  so the release speed does not depend on how quickly the page answers CDP. */
async function swipe(page: Page, dx: number, ms: number, steps: number, holdMs = 8): Promise<void> {
  await trace(page, Array.from({ length: steps }, (_, i) => (dx * (i + 1)) / steps), ms / steps, holdMs);
}

/** A finger that visits each offset (px from the dial's centre) in turn, `stepMs` apart. */
async function trace(page: Page, offsets: number[], stepMs: number, holdMs = 8): Promise<void> {
  const box = (await page.locator('.cs-dial').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  let clock = Date.now();
  const send = (type: string, px?: number) => cdp.send('Input.dispatchTouchEvent',
    { type: type as 'touchStart', timestamp: clock / 1000, touchPoints: px === undefined ? [] : [{ x: px, y }] });
  await send('touchStart', x);
  for (const dx of offsets) { clock += stepMs; await send('touchMove', x + dx); }
  clock += holdMs;
  await send('touchEnd');
  await cdp.detach();
}

/** Wait until the dial stops moving (the strip's transform holds still). */
async function settled(page: Page): Promise<string> {
  let last = '';
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(80);
    const t = await page.evaluate(() => {
      const strip = document.querySelector<HTMLElement>('.cs-dial-strip')!;
      return `${strip.style.transform}|${strip.getAnimations().length}|${document.querySelector('.custom-slider')!.classList.contains('dragging')}`;
    });
    if (t === last && t.endsWith('|0|false')) return t.split('|')[0]!;
    last = t;
  }
  throw new Error(`the dial never came to rest: ${last}`);
}

/** Where the strip rests for a value: the step sits under the centre mark exactly. */
const restingTransform = (page: Page, value: number): Promise<string> => page.evaluate((v) => {
  const dial = document.querySelector<HTMLElement>('.cs-dial')!;
  const px = 12; // 200 stops: rulerGeometry gives 12px a step
  const x = dial.clientWidth / 2 - (v + 100) * px - 0.5;
  return `translate3d(${Math.round(x * devicePixelRatio) / devicePixelRatio}px, 0px, 0px)`;
}, value);

test('on a phone the slider is a ruler dial and one slider to assistive technology', { skip: SKIP, timeout: 60000 }, async () => {
  const page = await fixture();
  try {
    assert.equal(await slider(page).evaluate(el => el.classList.contains('cs-ruler')), true);
    assert.equal(await page.locator('.cs-track').isVisible(), false, 'the track gives way to the ruler');
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree') as { nodes: Array<{ ignored?: boolean; role?: { value: string }; name?: { value: string }; properties?: Array<{ name: string; value: { value: unknown } }> }> };
    const live = nodes.filter(n => !n.ignored);
    const sliders = live.filter(n => n.role?.value === 'slider');
    assert.equal(sliders.length, 1, 'exactly one slider');
    assert.equal(sliders[0]!.name?.value, 'Exposure');
    const prop = (n: (typeof nodes)[number], k: string) => n.properties?.find(p => p.name === k)?.value.value;
    assert.equal(prop(sliders[0]!, 'valuemin'), -100);
    assert.equal(prop(sliders[0]!, 'valuemax'), 100);
    assert.equal(await slider(page).getAttribute('aria-valuetext'), '0 %', 'the value text carries the unit');
    const buttons = live.filter(n => n.role?.value === 'button').map(n => n.name?.value);
    assert.deepEqual(buttons, ['Type a value for Exposure'], 'the readout is the way to type a number');
    // The ruler's numbers are decoration: none of them reach the tree.
    const texts = live.filter(n => n.role?.value === 'StaticText').map(n => n.name?.value);
    assert.ok(!texts.includes('-10') && !texts.includes('10'), `ruler labels leaked: ${texts.join(', ')}`);
    await cdp.detach();
    // Targets: the dial is at least 44px tall, and the readout answers 8px above its box.
    const dial = (await page.locator('.cs-dial').boundingBox())!;
    assert.ok(dial.height >= 44, `dial is ${dial.height}px tall`);
    const entry = (await page.locator('.cs-entry').boundingBox())!;
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.cs-entry') != null,
      { x: entry.x + entry.width / 2, y: entry.y - 7 });
    assert.equal(hit, true, 'the readout button reaches past its box to a 44px target');
  } finally { await page.close(); }
});

test('a drag moves the value by the distance dragged, and a throw lands exactly on a step', { skip: SKIP, timeout: 60000 }, async () => {
  const page = await fixture();
  try {
    // Slow and then held still: no throw. 120px at 12px a step is 10 steps; the ruler
    // moves under a fixed mark, so dragging it left brings higher values in.
    await swipe(page, -120, 600, 20, 200);
    const rest = await settled(page);
    assert.equal(await now(page), '10');
    assert.equal(await slider(page).getAttribute('aria-valuetext'), '10 %');
    assert.equal(await page.locator('.input-value').textContent(), '10');
    assert.equal(rest, await restingTransform(page, 10));
    const first = await log(page);
    assert.deepEqual(first[0], ['dragStart']);
    assert.deepEqual(first.slice(-2), [['dragEnd'], ['commit', 10]], 'the drag ends, then the value commits, as on the track');
    assert.deepEqual(first.filter(e => e[0] === 'input').map(e => e[1]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'a value per step passed');

    // A throw: 160px in 80ms. The ruler keeps going after the finger lifts.
    await swipe(page, -160, 80, 8);
    const after = await settled(page);
    const v = Number(await now(page));
    assert.ok(v > 10 + 160 / 12 + 3, `a throw glides past where the finger let go (rested at ${v})`);
    assert.ok(Number.isInteger(v) && v <= 100);
    assert.equal(after, await restingTransform(page, v), 'the glide comes to rest exactly on a step');
    const second = await log(page);
    const passed = second.filter(e => e[0] === 'input' || e[0] === 'preview').map(e => e[1]!);
    assert.ok(passed.every((x, i) => i === 0 || x > passed[i - 1]!), 'values only move one way through a throw');
    // The finger's steps are inputs; the glide's are previews, so a tool that redraws
    // for each input redraws once more, at rest, rather than on every step of the glide.
    const kinds = second.filter(e => e[0] === 'input' || e[0] === 'preview').map(e => e[0]);
    assert.ok(kinds.includes('preview'), 'the glide previews the steps it passes');
    assert.ok(kinds.indexOf('preview') > kinds.lastIndexOf('input'), 'no input after the finger lifts');
    assert.deepEqual(second.slice(-2), [['dragEnd'], ['commit', v]], 'drag end waits for the glide');
    assert.equal(second.filter(e => e[0] === 'commit').length, 1);

    // Thrown hard past the end: it stops at the maximum, not beyond.
    await swipe(page, -300, 60, 6);
    await settled(page);
    assert.equal(await now(page), '100');
    await log(page);

    // A tap is not an edit: nothing commits.
    await swipe(page, 0, 40, 1, 40);
    await settled(page);
    assert.equal(await now(page), '100');
    assert.deepEqual((await log(page)).filter(e => e[0] === 'commit'), []);
  } finally { await page.close(); }
});

test('a drag out and back to where it started is still an edit', { skip: SKIP, timeout: 60000 }, async () => {
  const page = await fixture();
  try {
    // Out five steps and back, held still: the tool was sent 1..5..0 on the way, so the
    // rest at 0 commits even though 0 is where the finger came down.
    const out = Array.from({ length: 10 }, (_, i) => -6 * (i + 1));
    await trace(page, [...out, ...out.slice(0, -1).reverse(), 0], 40, 200);
    await settled(page);
    assert.equal(await now(page), '0');
    const events = await log(page);
    assert.deepEqual(events.filter(e => e[0] === 'input').map(e => e[1]), [1, 2, 3, 4, 5, 4, 3, 2, 1, 0]);
    assert.deepEqual(events.filter(e => e[0] === 'commit'), [['commit', 0]]);
  } finally { await page.close(); }
});

test('the keys step the value and the ruler follows', { skip: SKIP, timeout: 60000 }, async () => {
  const page = await fixture();
  try {
    await slider(page).focus();
    const press = async (key: string, want: string): Promise<void> => {
      await page.keyboard.press(key);
      assert.equal(await now(page), want, `${key}`);
    };
    await press('ArrowRight', '1');   // from 0, not from the minimum
    await press('PageUp', '11');
    await press('ArrowLeft', '10');
    await press('ArrowDown', '9');
    await press('PageDown', '-1');
    await press('Home', '-100');
    await press('End', '100');
    await press('ArrowUp', '100');
    await press('ArrowLeft', '99');
    assert.equal(await settled(page), await restingTransform(page, 99));
    assert.equal(await page.locator('.input-value').textContent(), '99');
    assert.deepEqual((await log(page)).map(e => e[0]).filter(k => k !== 'commit'), [], 'keys commit, and only commit');
  } finally { await page.close(); }
});

test('reduced motion: no glide, whole steps under the finger', { skip: SKIP, timeout: 60000 }, async () => {
  const page = await fixture({ reduce: true });
  try {
    await swipe(page, -160, 80, 8);
    const rest = await settled(page);
    // 160px is 13.3 steps; the ruler stops where the finger let go, on step 13.
    assert.equal(await now(page), '13');
    assert.equal(rest, await restingTransform(page, 13));
    assert.equal(await page.evaluate(() => document.querySelector('.cs-dial-strip')!.getAnimations().length), 0);
  } finally { await page.close(); }
});

test('the readout opens a number field: Enter sets, Escape cancels', { skip: SKIP, timeout: 60000 }, async () => {
  const page = await fixture();
  try {
    await page.locator('.cs-entry').click();
    const field = page.getByRole('spinbutton', { name: 'Exposure' });
    assert.equal(await field.evaluate(el => el === document.activeElement), true);
    assert.equal(await field.getAttribute('inputmode'), null, 'a range below zero keeps the keyboard with a minus sign');
    await field.fill('-42');
    await page.keyboard.press('Enter');
    assert.equal(await now(page), '-42');
    assert.equal(await page.locator('.input-value').textContent(), '-42');
    assert.equal(await page.locator('.cs-entry').evaluate(el => el === document.activeElement), true, 'focus returns to the readout');
    assert.equal(await settled(page), await restingTransform(page, -42));
    await page.locator('.cs-entry').click();
    await page.getByRole('spinbutton', { name: 'Exposure' }).fill('7');
    await page.keyboard.press('Escape');
    assert.equal(await now(page), '-42', 'Escape leaves the value');
    assert.equal(await page.getByRole('spinbutton').count(), 0);
    await page.locator('.cs-entry').click();
    await page.getByRole('spinbutton', { name: 'Exposure' }).fill('250');
    await page.keyboard.press('Enter');
    assert.equal(await now(page), '100', 'a typed value is clamped to the range');
  } finally { await page.close(); }
});

test('a wide window keeps the track; narrowing it brings the ruler', { skip: SKIP, timeout: 60000 }, async () => {
  const page = await fixture({ width: 1360 });
  try {
    assert.equal(await slider(page).evaluate(el => el.classList.contains('cs-ruler')), false);
    assert.equal(await page.locator('.cs-track').isVisible(), true);
    assert.equal(await page.locator('.cs-entry').count(), 0, 'the desktop row is unchanged');
    await page.setViewportSize({ width: 390, height: 700 });
    await page.waitForFunction(() => document.querySelector('.custom-slider')!.classList.contains('cs-ruler'));
    assert.equal(await page.locator('.cs-entry').count(), 1);
    await page.setViewportSize({ width: 1360, height: 700 });
    await page.waitForFunction(() => !document.querySelector('.custom-slider')!.classList.contains('cs-ruler'));
    assert.equal(await page.locator('.cs-entry').count(), 0);
    assert.equal(await page.locator('.input-value').count(), 1, 'the readout is back in its place');
  } finally { await page.close(); }
});

test.after(closeBrowser);
