// SPDX-License-Identifier: MPL-2.0
/**
 * oklch-slice-paint.test.ts - the chart paint's three-way agreement.
 * Run: node --test shells/web/src/lib/oklch-slice-paint.test.ts
 *
 * The failure this file exists to catch: the canvas context's `colorSpace`, the
 * ImageData's, and the engine's `encode` naming DIFFERENT spaces. Nothing on screen
 * says so - every pixel just shifts. So the bytes actually handed to
 * `putImageData` are compared against `oklchSlice` computed for each candidate
 * space, and the test asserts they match the space the SURFACE reported and not the
 * other one. A wrong-space paint therefore fails rather than merely looking odd.
 *
 * jsdom gives the DOM; the canvas is hand-written, because jsdom has no 2D context
 * and because the interesting cases (an engine that ignores `colorSpace`, one that
 * throws on the options bag) cannot be produced by a real browser on demand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
dom.window.devicePixelRatio = 1;

/** The display claim, swapped per case (jsdom has no matchMedia). */
let claim = 'p3';
const COVERS: Record<string, readonly string[]> = {
  srgb: ['srgb'], p3: ['srgb', 'p3'], rec2020: ['srgb', 'p3', 'rec2020'],
};
const mqHandlers = new Set<() => void>();
globalThis.matchMedia = ((q: string) => ({
  get matches(): boolean {
    const m = /\(color-gamut:\s*(\w+)\)/.exec(q);
    return m ? (COVERS[claim] as string[]).includes(m[1] as string) : false;
  },
  media: q,
  addEventListener(_t: string, fn: () => void) { mqHandlers.add(fn); },
  removeEventListener(_t: string, fn: () => void) { mqHandlers.delete(fn); },
  onchange: null, dispatchEvent: () => false,
})) as unknown as typeof globalThis.matchMedia;

const { oklchSlice } = await import('@lolly/engine');
const { renderSliceChart, paintSliceChart } = await import('./oklch-slice.ts');
const { resetDisplayGamut, displayAnchor } = await import('./display-gamut.ts');
import type { SliceChartState } from './oklch-slice.ts';
import type { EncodeSpace } from '@lolly/engine';

const W = 12, H = 8;   // small on purpose: the paint is real, so keep it cheap

/** What one paint asked for and what it wrote. */
interface Recorder {
  ctxAsked: (string | undefined)[];
  imgAsked: (string | undefined)[];
  written: Uint8ClampedArray[];
}

/**
 * The context factory for the mount under test.
 *
 * On the PROTOTYPE rather than on one element, because a display change makes the
 * paint replace the canvas node (a 2D context keeps the colour space it was created
 * with, so a new space needs a new surface) and a stub bolted onto the original node
 * would vanish with it - the test would then be measuring jsdom's missing canvas
 * support instead of the code. One current factory at a time; the cases are
 * sequential.
 */
let makeCtx: ((o?: { colorSpace?: string }) => unknown) | null = null;
dom.window.HTMLCanvasElement.prototype.getContext = ((_id: string, o?: { colorSpace?: string }) =>
  makeCtx ? makeCtx(o) : null) as HTMLCanvasElement['getContext'];

/**
 * A canvas whose context reports `granted` and behaves per `mode`:
 *   'honour' - createImageData returns an ImageData in the space it was asked for
 *   'ignore' - it silently returns an sRGB one (the accept-and-ignore engine)
 *   'throw' - the options bag is rejected outright
 */
function mountChart(
  granted: EncodeSpace,
  mode: 'honour' | 'ignore' | 'throw' = 'honour',
  attrs = true,
): { root: HTMLElement; canvas: HTMLCanvasElement; rec: Recorder; setGranted(s: EncodeSpace): void } {
  let live = granted;
  const host = document.getElementById('host')!;
  host.innerHTML = renderSliceChart({ plane: 'ch', fixed: 0.7, limit: 'rec2020' });
  const root = host.firstElementChild as HTMLElement;
  const plot = root.querySelector<HTMLElement>('[data-okls-plot]')!;
  // jsdom lays nothing out; the paint bails on a zero-size box.
  plot.getBoundingClientRect = () => ({
    width: W, height: H, top: 0, left: 0, right: W, bottom: H, x: 0, y: 0,
    toJSON: () => ({}),
  }) as DOMRect;

  const rec: Recorder = { ctxAsked: [], imgAsked: [], written: [] };
  const ctx = {
    getContextAttributes: attrs ? () => ({ colorSpace: live }) : undefined,
    clearRect() {},
    createImageData(w: number, h: number, o?: { colorSpace?: string }) {
      rec.imgAsked.push(o?.colorSpace);
      if (mode === 'throw' && o) throw new TypeError('colorSpace not supported');
      return {
        data: new Uint8ClampedArray(w * h * 4), width: w, height: h,
        colorSpace: mode === 'ignore' ? 'srgb' : (o?.colorSpace ?? 'srgb'),
      };
    },
    putImageData(img: { data: Uint8ClampedArray }) {
      rec.written.push(new Uint8ClampedArray(img.data));
    },
  };
  const canvas = root.querySelector<HTMLCanvasElement>('[data-okls-canvas]')!;
  makeCtx = (o) => { rec.ctxAsked.push(o?.colorSpace); return ctx; };
  return { root, canvas, rec, setGranted(s: EncodeSpace) { live = s; } };
}

const STATE: SliceChartState = { plane: 'ch', fixed: 0.7, limit: 'rec2020' };

/** The bytes the engine produces for a given encode space, at this exact size. */
const expected = (encode: EncodeSpace): Uint8ClampedArray =>
  oklchSlice({ plane: 'ch', fixed: 0.7, width: W, height: H, cMax: 0.5, limit: 'rec2020', encode }).data;

function fresh(claimTo: 'srgb' | 'p3' | 'rec2020'): void {
  claim = claimTo;
  resetDisplayGamut();
}

test('the two encode spaces really produce different bytes (guards the tests below)', () => {
  assert.notDeepEqual(
    Array.from(expected('srgb')), Array.from(expected('display-p3')),
    'if these matched, every lockstep assertion below would be vacuous',
  );
});

test('on a P3 display all three settings name display-p3, and the pixels prove it', () => {
  fresh('p3');
  const { root, rec } = mountChart('display-p3');
  paintSliceChart(root, STATE);

  assert.deepEqual(rec.ctxAsked, ['display-p3'], 'the context was asked for the display space');
  assert.deepEqual(rec.imgAsked, ['display-p3'], 'the ImageData was created in the SAME space');
  assert.equal(rec.written.length, 1);
  // The decisive assertion: the bytes are the engine's display-p3 encoding, not its
  // sRGB one. A context/ImageData/encode disagreement lands on the other branch.
  assert.deepEqual(Array.from(rec.written[0] as Uint8ClampedArray), Array.from(expected('display-p3')));
});

test('a rec2020 display is still painted display-p3 - the widest a canvas takes', () => {
  fresh('rec2020');
  const { root, rec } = mountChart('display-p3');
  paintSliceChart(root, STATE);
  assert.deepEqual(rec.ctxAsked, ['display-p3']);
  assert.deepEqual(Array.from(rec.written[0] as Uint8ClampedArray), Array.from(expected('display-p3')));
});

test('an sRGB display is byte-identical to the pre-detection rendering', () => {
  fresh('srgb');
  const { root, rec } = mountChart('srgb');
  paintSliceChart(root, STATE);
  assert.deepEqual(rec.ctxAsked, ['srgb']);
  assert.deepEqual(Array.from(rec.written[0] as Uint8ClampedArray), Array.from(expected('srgb')));
});

test('a context that IGNORES colorSpace collapses to srgb before the slice runs', () => {
  fresh('p3');
  // The attributes say srgb even though display-p3 was requested.
  const { root, rec } = mountChart('srgb');
  paintSliceChart(root, STATE);
  assert.deepEqual(rec.ctxAsked, ['display-p3'], 'we asked');
  assert.deepEqual(rec.imgAsked, ['srgb'], 'but the ImageData follows what was GRANTED');
  assert.deepEqual(Array.from(rec.written[0] as Uint8ClampedArray), Array.from(expected('srgb')));
  assert.equal(displayAnchor(), 'srgb', 'and the whole shell now agrees, so the contour matches');
});

test('an ImageData that quietly comes back srgb still cannot desync the slice', () => {
  fresh('p3');
  const { root, rec } = mountChart('display-p3', 'ignore');
  paintSliceChart(root, STATE);
  assert.deepEqual(rec.ctxAsked, ['display-p3']);
  assert.deepEqual(rec.imgAsked, ['display-p3']);
  // The readback is the second, independent check - the bytes follow the buffer.
  assert.deepEqual(Array.from(rec.written[0] as Uint8ClampedArray), Array.from(expected('srgb')));
  assert.equal(displayAnchor(), 'srgb');
});

test('createImageData THROWING on the options bag falls back, it does not fail', () => {
  fresh('p3');
  const { root, rec } = mountChart('display-p3', 'throw');
  paintSliceChart(root, STATE);
  assert.deepEqual(rec.imgAsked, ['display-p3', undefined], 'retried without the bag');
  assert.deepEqual(Array.from(rec.written[0] as Uint8ClampedArray), Array.from(expected('srgb')));
});

test('a context with no getContextAttributes is assumed srgb', () => {
  fresh('p3');
  const { root, rec } = mountChart('display-p3', 'honour', false);
  paintSliceChart(root, STATE);
  assert.deepEqual(rec.imgAsked, ['srgb']);
  assert.deepEqual(Array.from(rec.written[0] as Uint8ClampedArray), Array.from(expected('srgb')));
});

test('the encode space is part of the repaint key', () => {
  fresh('p3');
  const { root, rec, setGranted } = mountChart('display-p3');
  paintSliceChart(root, STATE);
  paintSliceChart(root, STATE);
  assert.equal(rec.written.length, 1, 'an identical repaint is still skipped');

  // The window moves to an sRGB monitor and the surface follows it. Same plane, same
  // size, same limit - only the encode differs, and without it in the key the stale
  // P3 pixels would silently stay on screen.
  claim = 'srgb';
  setGranted('srgb');
  for (const fn of [...mqHandlers]) fn();
  paintSliceChart(root, STATE);
  assert.equal(rec.written.length, 2, 'the space change repaints');
  assert.deepEqual(Array.from(rec.written[1] as Uint8ClampedArray), Array.from(expected('srgb')));
});

test('a display change re-acquires the surface, so the fill follows the marking', () => {
  fresh('p3');
  const { root, canvas, rec, setGranted } = mountChart('display-p3');
  paintSliceChart(root, STATE);
  assert.deepEqual(rec.ctxAsked, ['display-p3']);

  // The window moves to an sRGB monitor. A 2D context cannot change space, and a
  // second getContext ignores the options bag, so honouring the move means a NEW
  // canvas - otherwise the fill stays P3-mapped for the rest of the session while the
  // contour marked "your display" narrows, which is the disagreement the module's
  // docstring forbids.
  claim = 'srgb';
  setGranted('srgb');
  for (const fn of [...mqHandlers]) fn();
  paintSliceChart(root, STATE);

  const now = root.querySelector<HTMLCanvasElement>('[data-okls-canvas]')!;
  assert.notEqual(now, canvas, 'the canvas is replaced, not reused');
  assert.equal(canvas.parentNode, null, 'and the old node leaves the document');
  assert.deepEqual(rec.ctxAsked, ['display-p3', 'srgb']);
  assert.deepEqual(rec.imgAsked, ['display-p3', 'srgb']);
  assert.deepEqual(Array.from(rec.written[1] as Uint8ClampedArray), Array.from(expected('srgb')),
    'the pixels are sRGB-encoded, matching the contour now marked as the display',
  );
});

test('the widening direction is not mistaken for a refusal', () => {
  fresh('srgb');
  const { root, rec, setGranted } = mountChart('srgb');
  paintSliceChart(root, STATE);
  assert.equal(displayAnchor(), 'srgb');

  // sRGB monitor → P3 monitor. The retained context reports 'srgb' because that is
  // what it was built for; reading that as "the platform refuses display-p3" would
  // latch the downgrade and leave a P3 screen charted in sRGB forever.
  claim = 'p3';
  setGranted('display-p3');
  for (const fn of [...mqHandlers]) fn();
  paintSliceChart(root, STATE);
  assert.equal(displayAnchor(), 'display-p3', 'no false downgrade latch');
  assert.deepEqual(rec.ctxAsked, ['srgb', 'display-p3']);
  assert.deepEqual(Array.from(rec.written[1] as Uint8ClampedArray), Array.from(expected('display-p3')));
});

test("the display's own boundary is the emphasised contour, on the chart and in the key", () => {
  fresh('p3');
  const { root, setGranted } = mountChart('display-p3');
  paintSliceChart(root, STATE);
  const p3Edge = root.querySelector('[data-okls-edge="p3"]') as HTMLElement;
  const srgbEdge = root.querySelector('[data-okls-edge="srgb"]') as HTMLElement;
  assert.equal(p3Edge.dataset.display, '1', 'a rec2020 chart on a P3 display marks the P3 contour');
  assert.equal(srgbEdge.dataset.display, undefined);
  assert.equal(root.querySelector<HTMLElement>('.okls-key--p3')?.dataset.display, '1',
    'the legend key carries the same weight as the line');
  // The container marker is what scopes the weight SWAP - without it the two
  // contours would both be heavy and stop being tellable apart.
  assert.equal(root.querySelector<HTMLElement>('[data-okls-edges]')?.dataset.display, 'p3');
  assert.equal(root.querySelector<HTMLElement>('.okls-legend')?.dataset.display, 'p3');

  // On an sRGB display it moves to the sRGB contour, with no new prose either way.
  claim = 'srgb';
  setGranted('srgb');
  for (const fn of [...mqHandlers]) fn();
  paintSliceChart(root, STATE);
  assert.equal(p3Edge.dataset.display, undefined);
  assert.equal(srgbEdge.dataset.display, '1');
  assert.equal(root.querySelector<HTMLElement>('.okls-key--srgb')?.dataset.display, '1');
  assert.equal(root.querySelector<HTMLElement>('[data-okls-edges]')?.dataset.display, 'srgb');
});

test('no contour is marked when the chart already stops at the display', () => {
  fresh('p3');
  const { root } = mountChart('display-p3');
  // A P3-limited chart on a P3 display: the edge of the FILL is the display's edge,
  // so emphasising a line would be restating the boundary the fill already states.
  paintSliceChart(root, { plane: 'ch', fixed: 0.7, limit: 'p3' });
  assert.equal(root.querySelector<HTMLElement>('[data-okls-edge="p3"]')?.dataset.display, undefined);
  assert.equal(root.querySelector<HTMLElement>('[data-okls-edge="srgb"]')?.dataset.display, undefined);
  // No marker on the container either, so the weight ladder stays as it was.
  assert.equal(root.querySelector<HTMLElement>('[data-okls-edges]')?.dataset.display, undefined);
});
