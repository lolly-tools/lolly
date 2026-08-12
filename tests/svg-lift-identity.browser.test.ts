// SPDX-License-Identifier: MPL-2.0
/**
 * §7's exit criterion, enacted: **N lifted layers at z = 0 render as the
 * un-lifted original** (plans/104 §7 P3) — and the measurement that says what
 * "as" can honestly mean in a real browser.
 *
 * `tests/svg-layers.test.ts` proves the STRUCTURAL half: the derived documents
 * are a byte-exact partition of the source's children, nothing dropped,
 * duplicated or reordered. That is the property, and it fails with a readable
 * diff. This file proves the half a structural argument cannot reach — that a
 * real renderer, handed those documents as N stacked `<img>` layers, paints the
 * same picture it paints for the whole file.
 *
 * ## §7 says "byte-identical". Measured, it is not, and the reason is not ours
 *
 * Source-over is associative, so the composite is mathematically the original.
 * The browser, however, rasterises each layer into its own **8-bit premultiplied**
 * buffer before compositing, which rounds twice where the single-pass render
 * rounds once. Measured on the fixtures below (Chromium, deviceScaleFactor 1,
 * 320×240 = 307 200 channels; the `<use>` row varies run to run, both ends
 * shown):
 *
 * | fixture                          | channels differing | max | mean abs |
 * |----------------------------------|--------------------|-----|----------|
 * | overlapping opaque groups        | 1                  | 1   | 0.000003 |
 * | shared gradient in carried defs  | 28 937             | 1   | 0.094    |
 * | cross-group `<use>` (repaired)   | 3–15               | 56  | 0.0013   |
 * | translucent overlap              | 0                  | 0   | 0        |
 * | curves and strokes               | 0                  | 0   | 0        |
 * | ungrouped strays                 | 0                  | 0   | 0        |
 * | one wrapping group, rotated      | 130 (77 beyond ±1) | 17  | 0.0018   |
 *
 * Two shapes of difference, both understood. The ±1s are ordinary quantisation —
 * a gradient's smooth ramp lands on a rounding boundary in 9 % of its pixels and
 * moves by one code value. The larger ones are the premultiplied-alpha precision
 * floor: where coverage is near zero (a star's spike, every pixel along a
 * rotated edge) the layer stores a saturated colour at an alpha of a few /255,
 * and recovering that colour cannot be exact. Neither is a lift defect, and no
 * amount of care in this module removes them — they are properties of layer
 * compositing.
 *
 * So the assertion here is the one that still catches every defect a lift could
 * actually have: **essentially every channel within ±1, and no more than a
 * handful beyond it.** A dropped layer, a duplicated node, a reordered stack or
 * a broken reference moves tens of thousands of channels by tens of values —
 * three orders of magnitude outside these bounds — which is exactly what the
 * vacuity guard at the bottom demonstrates.
 *
 * GATING follows the rest of the browser tier (`sequence-render.browser.test.ts`,
 * `canvas-filter-probe.browser.test.ts`): with no browser installed the whole
 * suite skips naming the install command, so `npm test` stays green on a bare
 * machine and bites on a real one.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { browserGate } from './helpers/sequence-browser.ts';
import { enumerateSvgLayers } from '../engine/src/svg-layers.ts';

const gate = browserGate();

const NS = 'http://www.w3.org/2000/svg';
const W = 320;
const H = 240;
const CHANNELS = W * H * 4;

/**
 * Channels allowed to differ by more than one code value, as a fraction of the
 * frame. Measured worst: 77 of 307 200 = 0.025 %, the rotated-wrapper fixture,
 * whose every shape edge is anti-aliased along its whole length. A real lift
 * defect — a dropped layer, a lost wrapper transform, a reordered stack — moves
 * TENS OF THOUSANDS of channels, three orders of magnitude past this.
 */
const MAX_BEYOND_ONE_FRACTION = 0.0005;
const MAX_BEYOND_ONE = Math.round(CHANNELS * MAX_BEYOND_ONE_FRACTION);
/** How far one of those may go — the premultiplied-alpha floor (measured: 56). */
const MAX_CHANNEL_DELTA = 96;
/** Mean absolute error over every channel (measured worst: 0.094, a gradient). */
const MAX_MEAN_ABS = 0.5;

/**
 * The fixtures, chosen to exercise the ways a split could go wrong rather than
 * to look like anything: overlapping fills (compositing order), a shared
 * gradient (the carried `<defs>`), a cross-group `<use>` (the repair), curves
 * and strokes (anti-aliased edges everywhere), translucency (alpha, not just
 * coverage), ungrouped strays (the spatial clustering), and a lone wrapper group
 * (the descent).
 */
const FIXTURES: Array<[name: string, markup: string]> = [
  ['overlapping opaque groups', `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}">
    <g><rect x="20" y="20" width="160" height="120" fill="#c8352b"/></g>
    <g><circle cx="150" cy="120" r="70" fill="#2f6fb4"/></g>
    <g><path d="M200 40 L300 40 L250 160 Z" fill="#e8b31f"/></g>
  </svg>`],

  ['translucent overlap — alpha, not just coverage', `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}">
    <g><rect x="10" y="10" width="200" height="160" fill="#c8352b" fill-opacity="0.55"/></g>
    <g><circle cx="160" cy="130" r="80" fill="#2f6fb4" opacity="0.6"/></g>
  </svg>`],

  ['a shared gradient in the carried <defs>', `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7a2ff0"/><stop offset="1" stop-color="#1fd6c1"/>
    </linearGradient></defs>
    <g><rect x="0" y="0" width="${W}" height="${H}" fill="url(#grad)"/></g>
    <g><circle cx="90" cy="90" r="60" fill="url(#grad)" opacity="0.7"/></g>
  </svg>`],

  ['a cross-group <use> — the repaired reference', `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}">
    <g id="a"><path id="star" d="M60 20 L74 58 L114 58 L82 82 L94 120 L60 96 L26 120 L38 82 L6 58 L46 58 Z" fill="#e8b31f"/></g>
    <g id="b"><use href="#star" x="120" y="60"/></g>
    <g id="c"><rect x="220" y="20" width="80" height="80" fill="#2f6fb4" opacity="0.8"/></g>
  </svg>`],

  ['curves and strokes — anti-aliased edges everywhere', `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}">
    <g><path d="M10 200 C 60 40, 120 40, 170 200" fill="none" stroke="#c8352b" stroke-width="9"/></g>
    <g><path d="M60 210 C 110 60, 180 60, 250 210" fill="none" stroke="#2f6fb4" stroke-width="7"/></g>
    <g><ellipse cx="240" cy="90" rx="60" ry="34" fill="#1fd6c1" stroke="#0a3b35" stroke-width="3"/></g>
  </svg>`],

  ['ungrouped strays — the spatial clustering path', `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}">
    <rect x="10" y="10" width="60" height="60" fill="#c8352b"/>
    <rect x="66" y="30" width="60" height="60" fill="#e8b31f"/>
    <circle cx="250" cy="170" r="45" fill="#2f6fb4"/>
    <path d="M240 40 L300 40 L270 100 Z" fill="#1fd6c1"/>
  </svg>`],

  ['one wrapping group with a transform — the descent', `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}">
    <g id="Layer_1" transform="translate(20 15) rotate(6)">
      <g><rect x="0" y="0" width="150" height="110" fill="#7a2ff0"/></g>
      <g><circle cx="200" cy="120" r="60" fill="#e8b31f" opacity="0.85"/></g>
      <g><path d="M40 150 L140 150 L90 220 Z" fill="#1fd6c1"/></g>
    </g>
  </svg>`],
];

const dataUrl = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/**
 * The page: one `<img>` for the original, N absolutely-positioned `<img>` for
 * the layers, both in a `W×H` box on the same white ground — which is exactly
 * what the editor does with lifted boxes at identical geometry and z = 0.
 */
function pageFor(original: string, layers: string[]): string {
  const stack = layers
    .map((l) => `<img src="${dataUrl(l)}" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px">`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#fff">
    <div id="one" style="position:relative;width:${W}px;height:${H}px;background:#fff">
      <img src="${dataUrl(original)}" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px">
    </div>
    <div id="many" style="position:relative;width:${W}px;height:${H}px;background:#fff">${stack}</div>
  </body></html>`;
}

interface Diff { differing: number; beyondOne: number; max: number; meanAbs: number }

describe('lift identity: N layers at z = 0 == the un-lifted original', { skip: gate ?? false }, () => {
  let browser: Browser;
  let ctx: BrowserContext;
  let page: Page;
  const table: string[] = [];

  before(async () => {
    browser = await getBrowser();
    ctx = await browser.newContext({ viewport: { width: W + 40, height: H * 2 + 60 }, deviceScaleFactor: 1 });
    page = await ctx.newPage();
  });
  after(async () => {
    if (table.length) console.log(['', 'lift identity, measured:', ...table, ''].join('\n  '));
    await ctx?.close();
    await closeBrowser();
  });

  /** Screenshot both boxes, decode both, and diff them channel by channel. */
  async function compare(original: string, layers: string[]): Promise<Diff> {
    await page.setContent(pageFor(original, layers));
    // Every <img> must have decoded before either shot, or a race decides the
    // answer instead of the compositor.
    await page.evaluate(async () => {
      await Promise.all([...document.images].map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => {}))));
    });
    const one = await page.locator('#one').screenshot({ type: 'png' });
    const many = await page.locator('#many').screenshot({ type: 'png' });
    return await page.evaluate(async (arg: { w: number; h: number; a: string; b: string }) => {
      const pixels = (u: string): Promise<Uint8ClampedArray> => new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => {
          const c = document.createElement('canvas');
          c.width = arg.w; c.height = arg.h;
          const g = c.getContext('2d', { willReadFrequently: true })!;
          g.drawImage(im, 0, 0);
          res(g.getImageData(0, 0, arg.w, arg.h).data);
        };
        im.onerror = () => rej(new Error('shot did not decode'));
        im.src = u;
      });
      const A = await pixels(`data:image/png;base64,${arg.a}`);
      const B = await pixels(`data:image/png;base64,${arg.b}`);
      let differing = 0, beyondOne = 0, max = 0, sum = 0;
      for (let i = 0; i < A.length; i++) {
        const d = Math.abs(A[i]! - B[i]!);
        if (!d) continue;
        differing++;
        if (d > 1) beyondOne++;
        if (d > max) max = d;
        sum += d;
      }
      return { differing, beyondOne, max, meanAbs: sum / A.length };
    }, { w: W, h: H, a: Buffer.from(one).toString('base64'), b: Buffer.from(many).toString('base64') });
  }

  for (const [name, markup] of FIXTURES) {
    test(name, async () => {
      const { layers, warnings } = enumerateSvgLayers(markup);
      assert.ok(layers.length >= 2, `needs at least two layers to be a lift (${warnings.join('; ')})`);

      const d = await compare(markup, layers.map((l) => l.markup));
      table.push(`${name}: ${layers.length} layers, ${d.differing}/${CHANNELS} channels differ, ` +
        `${d.beyondOne} beyond ±1, max ${d.max}, mean ${d.meanAbs.toFixed(6)}`);

      assert.ok(d.beyondOne <= MAX_BEYOND_ONE,
        `${name}: ${d.beyondOne} channels differ by more than 1 (allowed ${MAX_BEYOND_ONE}) — ` +
        'that is a lift defect, not compositing rounding');
      assert.ok(d.max <= MAX_CHANNEL_DELTA, `${name}: max channel delta ${d.max} exceeds ${MAX_CHANNEL_DELTA}`);
      assert.ok(d.meanAbs <= MAX_MEAN_ABS, `${name}: mean absolute error ${d.meanAbs} exceeds ${MAX_MEAN_ABS}`);
    });
  }

  test('the bounds are not vacuous — dropping one layer blows through every one of them', async () => {
    // Without this, a stack that rendered the same whatever it contained (a
    // blank page, a failed decode) would pass every assertion above while
    // proving nothing.
    const [, markup] = FIXTURES[0]!;
    const { layers } = enumerateSvgLayers(markup);
    const d = await compare(markup, layers.slice(0, -1).map((l) => l.markup));
    assert.ok(d.beyondOne > MAX_BEYOND_ONE * 20,
      `a missing layer must be unmistakable, got ${d.beyondOne} channels beyond ±1`);
    assert.ok(d.max > MAX_CHANNEL_DELTA, `and unmistakably large, got max ${d.max}`);
  });
});
