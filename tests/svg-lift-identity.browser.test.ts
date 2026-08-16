// SPDX-License-Identifier: MPL-2.0
/**
 * section 7's exit criterion, enacted: **N lifted layers at z = 0 render as the
 * un-lifted original** (plans/104 section 7 P3) - and the measurement that says what
 * "as" can honestly mean in a real browser.
 *
 * `tests/svg-layers.test.ts` proves the STRUCTURAL half: the derived documents
 * are a byte-exact partition of the source's children, nothing dropped,
 * duplicated or reordered. That is the property, and it fails with a readable
 * diff. This file proves the half a structural argument cannot reach - that a
 * real renderer, handed those documents as N stacked `<img>` layers, paints the
 * same picture it paints for the whole file.
 *
 * ## section 7 says "byte-identical". Measured, it is not, and the reason is not ours
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
 * Two shapes of difference, both understood. The ±1s are ordinary quantisation - 
 * a gradient's smooth ramp lands on a rounding boundary in 9 % of its pixels and
 * moves by one code value. The larger ones are the premultiplied-alpha precision
 * floor: where coverage is near zero (a star's spike, every pixel along a
 * rotated edge) the layer stores a saturated colour at an alpha of a few /255,
 * and recovering that colour cannot be exact. Neither is a lift defect, and no
 * amount of care in this module removes them - they are properties of layer
 * compositing.
 *
 * So the assertion here is the one that still catches every defect a lift could
 * actually have: **essentially every channel within ±1, and no more than a
 * handful beyond it.** A dropped layer, a duplicated node, a reordered stack or
 * a broken reference moves tens of thousands of channels by tens of values - 
 * three orders of magnitude outside these bounds - which is exactly what the
 * vacuity guard at the bottom demonstrates.
 *
 * ## ⚑ Every fixture above is k = 1, and that is why 1.121 over-claimed
 *
 * 320×240 into a 320×240 box is the one configuration in which snapping a crop to
 * whole USER units also lands it on whole ROW pixels - so the crop-to-ink of
 * 1.121 measured neutral here and cost 88 675 channels beyond ±1 on real content
 * at k = 0.694. The `k = 1.5625` block below is the missing configuration: the
 * same fixtures in a 500×375 box, with `liftCropScale` feeding the engine the
 * scale the rows will actually be placed at, plus a test that the SAME box
 * cropped in user units blows the budget by 14× - so the claim cannot be made
 * again from the easy case alone.
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
import { enumerateSvgLayers, svgRootViewBox } from '../engine/src/svg-layers.ts';
import type { SvgLayer, SvgLayerBox } from '../engine/src/svg-layers.ts';
import { liftRows, liftCropScale } from '../shells/web/src/views/free-canvas-math.ts';
import type { Box } from '../shells/web/src/views/free-canvas-math.ts';

const gate = browserGate();

const NS = 'http://www.w3.org/2000/svg';
const W = 320;
const H = 240;
const CHANNELS = W * H * 4;

/**
 * Channels allowed to differ by more than one code value, as a fraction of the
 * frame. Measured worst: 77 of 307 200 = 0.025 %, the rotated-wrapper fixture,
 * whose every shape edge is anti-aliased along its whole length. A real lift
 * defect - a dropped layer, a lost wrapper transform, a reordered stack - moves
 * TENS OF THOUSANDS of channels, three orders of magnitude past this.
 */
const MAX_BEYOND_ONE_FRACTION = 0.0005;
const MAX_BEYOND_ONE = Math.round(CHANNELS * MAX_BEYOND_ONE_FRACTION);
/** How far one of those may go - the premultiplied-alpha floor (measured: 56). */
const MAX_CHANNEL_DELTA = 96;
/** Mean absolute error over every channel (measured worst: 0.094, a gradient). */
const MAX_MEAN_ABS = 0.5;

/**
 * The fixtures, chosen to exercise the ways a split could go wrong rather than
 * to look like anything: overlapping fills (compositing order), a shared
 * gradient (the carried `<defs>`), a cross-group `<use>` (the repair), a
 * descended wrapper and a carried `<clipPath>` that each point INTO a layer (the
 * other two halves of the repair), curves and strokes (anti-aliased edges
 * everywhere), translucency (alpha, not just coverage), ungrouped strays (the
 * spatial clustering), and a lone wrapper group (the descent).
 *
 * ⚑ What the original set had in common, and what it cost: not one fixture put
 * anything on the ROOT `<svg>`, so a root `opacity`/`filter` - applied N times
 * over by a split, 45 203 channels beyond ±1 against a 154-channel budget - was
 * invisible to a suite whose entire job is to see that. The refusal cases at the
 * bottom of this file exist so the gap cannot reopen: they measure what the
 * refused split WOULD have cost, rather than asserting that a rule is a rule.
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

  // The two reference shapes the repair used to MISS, because it only ever read
  // the layer body: a descended wrapper pointing at an id inside one of the
  // layers, and a carried paint server pointing the same way. Both rendered a
  // visibly different picture with an empty `warnings` - Chromium paints an
  // unresolvable `clip-path` as no clip at all, so the first one measured 76 800
  // channels different before the fix and 0 after it.
  ['a descended wrapper whose clip lives inside a layer', `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}">
    <g clip-path="url(#c)">
      <g><rect x="0" y="0" width="200" height="200" fill="#c8352b"/></g>
      <g><clipPath id="c"><rect x="20" y="20" width="120" height="120"/></clipPath><circle cx="250" cy="180" r="50" fill="#2f6fb4"/></g>
    </g>
  </svg>`],

  ['a carried <clipPath> whose <use> points into a layer', `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}">
    <clipPath id="c2"><use href="#shape"/></clipPath>
    <g clip-path="url(#c2)"><rect x="0" y="0" width="200" height="200" fill="#c8352b"/></g>
    <g><rect id="shape" x="20" y="20" width="120" height="120" fill="#2f6fb4"/></g>
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

/** One layer as the editor would place it: its document, and the row it lands in. */
interface Placed { markup: string; x: number; y: number; w: number; h: number }

/** The canvas block a lift writes, narrowed to what placement reads. */
const LIFT_CFG = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
  imageField: 'image', fitField: 'fit', zField: 'z', shadowField: 'shadow',
};

/**
 * Where the shell would put each layer - through `liftRows` itself, not through
 * a copy of its arithmetic.
 *
 * Since 1.121 a derived document may be CROPPED to its own ink, and a cropped
 * document is only the same picture in the row that crop maps to. That makes
 * placement part of the identity property rather than a detail beside it, so
 * the harness asks the real function and paints the answer: if `liftRows` and
 * `enumerateSvgLayers` ever disagree about which rectangle a layer is, this
 * suite sees it as a moved picture, which is what it is.
 */
function placed(layers: SvgLayer[], viewBox: SvgLayerBox | null, bw = W, bh = H): Placed[] {
  const rows = liftRows(
    liftBox(bw, bh),
    layers.map((l, i) => ({ src: '', id: i, crop: l.viewBox ?? null, bbox: l.bbox })),
    LIFT_CFG,
    { viewBox, fit: 'fill' },
  ) as Array<Record<string, number>>;
  return layers.map((l, i) => ({
    markup: l.markup,
    x: Number(rows[i]!.x), y: Number(rows[i]!.y), w: Number(rows[i]!.w), h: Number(rows[i]!.h),
  }));
}

/** The source box a lift replaces - the one both `liftCropScale` and `liftRows` read. */
const liftBox = (bw: number, bh: number): Box => ({ id: 'a', x: 0, y: 0, w: bw, h: bh, rot: 0 } as Box);

/** Full-stage placement, for the hand-split fixtures that never went near a crop. */
const wholeStage = (markup: string[]): Placed[] => markup.map((m) => ({ markup: m, x: 0, y: 0, w: W, h: H }));

/**
 * The page: one `<img>` for the original, N absolutely-positioned `<img>` for
 * the layers, both in a `W×H` box on the same white ground - which is exactly
 * what the editor does with lifted boxes at z = 0.
 */
function pageFor(original: string, layers: Placed[], bw = W, bh = H): string {
  const stack = layers
    .map((l) => `<img src="${dataUrl(l.markup)}" style="position:absolute;left:${l.x}px;top:${l.y}px;`
      + `width:${l.w}px;height:${l.h}px">`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#fff">
    <div id="one" style="position:relative;width:${bw}px;height:${bh}px;background:#fff">
      <img src="${dataUrl(original)}" style="position:absolute;left:0;top:0;width:${bw}px;height:${bh}px">
    </div>
    <div id="many" style="position:relative;width:${bw}px;height:${bh}px;background:#fff">${stack}</div>
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
  async function compare(original: string, layers: Placed[], bw = W, bh = H): Promise<Diff> {
    if (bw !== W || bh !== H) await page.setViewportSize({ width: bw + 40, height: bh * 2 + 60 });
    await page.setContent(pageFor(original, layers, bw, bh));
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
    }, { w: bw, h: bh, a: Buffer.from(one).toString('base64'), b: Buffer.from(many).toString('base64') });
  }

  for (const [name, markup] of FIXTURES) {
    test(name, async () => {
      const { layers, warnings, viewBox } = enumerateSvgLayers(markup);
      assert.ok(layers.length >= 2, `needs at least two layers to be a lift (${warnings.join('; ')})`);

      const d = await compare(markup, placed(layers, viewBox));
      table.push(`${name}: ${layers.length} layers, ${d.differing}/${CHANNELS} channels differ, ` +
        `${d.beyondOne} beyond ±1, max ${d.max}, mean ${d.meanAbs.toFixed(6)}`);

      assert.ok(d.beyondOne <= MAX_BEYOND_ONE,
        `${name}: ${d.beyondOne} channels differ by more than 1 (allowed ${MAX_BEYOND_ONE}) — ` +
        'that is a lift defect, not compositing rounding');
      assert.ok(d.max <= MAX_CHANNEL_DELTA, `${name}: max channel delta ${d.max} exceeds ${MAX_CHANNEL_DELTA}`);
      assert.ok(d.meanAbs <= MAX_MEAN_ABS, `${name}: mean absolute error ${d.meanAbs} exceeds ${MAX_MEAN_ABS}`);
    });
  }

  // ── k ≠ 1: the configuration this suite did not have, and what it cost ────
  //
  // ⚑ Every fixture above is 320×240 into a 320×240 box. That is k = 1 with an
  // integer viewBox - the SINGLE configuration in which snapping a crop to whole
  // USER units also lands it on whole ROW pixels - and 1.121 published
  // "fidelity-neutral, measured" off exactly this suite. A lifted box on a canvas
  // is any size, so k is arbitrary and a user-unit crop lands between device
  // pixels: the browser then bilinear-filters the WHOLE layer back onto the grid
  // and every anti-aliased edge in it moves. Measured on real content at k = 0.694
  // (`docs/shots/brand-colours.svg` in a 1000×625 box): 88 675 channels beyond ±1
  // with the crop on against 1 758 with it off, max 189 vs 63.
  //
  // So the box here is 500×375 - k = 1.5625 on both axes, exactly proportional to
  // the fixtures' viewBox so nothing letterboxes, and an INTEGER container so the
  // reference itself is on the pixel grid. `liftCropScale` answers the scale from
  // the same `liftContentRect` that places the rows, which is the point: one k,
  // read once, or the dialog and the write disagree about which rectangle a layer
  // is. The bounds are the same fractions as above, against this frame's channels.
  const SCALED_W = 500;
  const SCALED_H = 375;
  const SCALED_CHANNELS = SCALED_W * SCALED_H * 4;
  const scaledBudget = Math.round(SCALED_CHANNELS * MAX_BEYOND_ONE_FRACTION);

  for (const [name, markup] of FIXTURES) {
    test(`${name} — at k = 1.5625, cropped to whole ROW px`, async () => {
      const box = liftBox(SCALED_W, SCALED_H);
      const cropScale = liftCropScale(box, LIFT_CFG, { viewBox: svgRootViewBox(markup), fit: 'fill' });
      assert.ok(cropScale && cropScale.x !== 1 && cropScale.y !== 1,
        'precondition: this case only means anything at a scale of not-1');
      const { layers, viewBox } = enumerateSvgLayers(markup, { cropScale });
      assert.ok(layers.length >= 2, 'needs at least two layers to be a lift');

      const d = await compare(markup, placed(layers, viewBox, SCALED_W, SCALED_H), SCALED_W, SCALED_H);
      table.push(`${name} @${SCALED_W}×${SCALED_H} (k=1.5625): ${layers.length} layers, ` +
        `${d.differing}/${SCALED_CHANNELS} channels differ, ${d.beyondOne} beyond ±1, ` +
        `max ${d.max}, mean ${d.meanAbs.toFixed(6)}`);

      assert.ok(d.beyondOne <= scaledBudget,
        `${name} at k≠1: ${d.beyondOne} channels differ by more than 1 (allowed ${scaledBudget})`);
      assert.ok(d.max <= MAX_CHANNEL_DELTA, `${name} at k≠1: max channel delta ${d.max}`);
      assert.ok(d.meanAbs <= MAX_MEAN_ABS, `${name} at k≠1: mean absolute error ${d.meanAbs}`);
    });
  }

  test('and the snap is load-bearing: crop the SAME box in user units and the bounds blow', async () => {
    // The half that makes the case above an assertion rather than a coincidence.
    // Omitting `cropScale` is 1.121's arithmetic exactly (it defaults to 1:1), so
    // this measures the shipped defect in the shipped harness. Run on the fixture
    // whose every edge is anti-aliased along its whole length, which is where a
    // resample shows up.
    const markup = FIXTURES.find(([n]) => n.includes('the descent'))![1];
    const naive = enumerateSvgLayers(markup);                        // whole USER units
    const snapped = enumerateSvgLayers(markup, {                     // whole ROW px
      cropScale: liftCropScale(liftBox(SCALED_W, SCALED_H), LIFT_CFG,
        { viewBox: svgRootViewBox(markup), fit: 'fill' })!,
    });
    assert.notDeepEqual(naive.layers.map((l) => l.viewBox), snapped.layers.map((l) => l.viewBox),
      'precondition: the two snaps must actually differ, or this test proves nothing');

    const bad = await compare(markup, placed(naive.layers, naive.viewBox, SCALED_W, SCALED_H), SCALED_W, SCALED_H);
    table.push(`user-unit snap at k=1.5625 (the 1.121 defect): ${bad.beyondOne} beyond ±1, ` +
      `max ${bad.max}, mean ${bad.meanAbs.toFixed(6)}`);
    assert.ok(bad.beyondOne > scaledBudget * 4,
      `a user-unit crop at k≠1 must be unmistakably worse, got ${bad.beyondOne} beyond ±1 ` +
      `against a ${scaledBudget} budget — if this ever passes, the snap stopped mattering ` +
      'and the k≠1 cases above are no longer proving anything');
  });

  // ── the refusals, measured in the same harness ────────────────────────────
  //
  // A refusal is only defensible if the thing it refuses would really have been
  // wrong, so these two fixtures prove the cost rather than assert the rule.
  // Each is split BY HAND the way the enumerator used to (root attributes
  // reproduced verbatim on every layer - the exact bytes `rootAttributes()`
  // emits) and measured against the same bounds every fixture above passes.
  // No fixture in FIXTURES puts anything on the root, which is precisely why
  // this suite did not catch either of them at 1.119.0.
  const ROOT_UNIT: Array<[name: string, rootAttrs: string, defs: string]> = [
    ['root opacity', ' opacity="0.55"', ''],
    ['root filter', ' filter="url(#f)"',
      '<defs><filter id="f" x="-20%" y="-20%" width="150%" height="150%"><feGaussianBlur stdDeviation="4"/></filter></defs>'],
  ];
  for (const [name, rootAttrs, defs] of ROOT_UNIT) {
    test(`${name}: refused BECAUSE splitting it moves tens of thousands of channels`, async () => {
      const kids = [
        '<g><rect x="20" y="20" width="180" height="150" fill="#c8352b"/></g>',
        '<g><circle cx="150" cy="120" r="80" fill="#2f6fb4"/></g>',
      ];
      const open = `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}"${rootAttrs}>`;
      const original = `${open}${defs}${kids.join('')}</svg>`;

      const { layers, warnings } = enumerateSvgLayers(original);
      assert.deepEqual(layers, [], 'a root that composites as a unit must not lift');
      assert.ok(warnings.some((w) => w.includes('whole')), warnings.join(' | '));

      // …and here is what it would have cost.
      const naive = kids.map((k) => `${open}${defs}${k}</svg>`);
      const d = await compare(original, wholeStage(naive));
      table.push(`${name} (REFUSED; naive split would have been): ${d.differing}/${CHANNELS} channels differ, ` +
        `${d.beyondOne} beyond ±1, max ${d.max}, mean ${d.meanAbs.toFixed(6)}`);
      assert.ok(d.beyondOne > MAX_BEYOND_ONE * 20,
        `the refusal has to be earning its keep, got ${d.beyondOne} channels beyond ±1`);
    });
  }

  test('the bounds are not vacuous — dropping one layer blows through every one of them', async () => {
    // Without this, a stack that rendered the same whatever it contained (a
    // blank page, a failed decode) would pass every assertion above while
    // proving nothing.
    const [, markup] = FIXTURES[0]!;
    const { layers, viewBox } = enumerateSvgLayers(markup);
    const d = await compare(markup, placed(layers.slice(0, -1), viewBox));
    assert.ok(d.beyondOne > MAX_BEYOND_ONE * 20,
      `a missing layer must be unmistakable, got ${d.beyondOne} channels beyond ±1`);
    assert.ok(d.max > MAX_CHANNEL_DELTA, `and unmistakably large, got max ${d.max}`);
  });
});
