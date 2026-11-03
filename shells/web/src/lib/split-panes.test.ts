// SPDX-License-Identifier: MPL-2.0
/**
 * Where the two panes meet (lib/split-panes.ts): the geometry as a pure function,
 * the snap points, the fold lock, the hand and the direction, and the live view's
 * custom properties and divider.
 *
 * Run directly:  node --test shells/web/src/lib/split-panes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
const win = dom.window as unknown as Window & typeof globalThis;
globalThis.window = win;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.requestAnimationFrame = ((fn: FrameRequestCallback) => setTimeout(() => fn(0), 0)) as unknown as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
let coarse = true;
const mm = ((q: string) => ({
  get matches() { return q.includes('pointer: coarse') ? coarse : false; },
  media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as unknown as typeof globalThis.matchMedia;
win.matchMedia = mm;
globalThis.matchMedia = mm;
function size(width: number, height: number): void {
  Object.defineProperty(win, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(win, 'innerHeight', { value: height, configurable: true });
}

const { splitGeometry, validSnaps, nearestSnap, mountSplitView, rememberedRatio, SPLIT_STORE_KEY, GUTTER_PX, MIN_CONTROL_PX, MIN_CANVAS_PX } = await import('./split-panes.ts');
const { computeLayout, startLayoutPosture, NATIVE_FOLD_EVENT } = await import('./layout-posture.ts');
const { applyHand } = await import('./hand-pref.ts');

const free = (width: number, height: number) => computeLayout({ width, height, coarse: true });
const book = (width: number, height: number, x = Math.round(width / 2), w = 0) =>
  computeLayout({ width, height, coarse: true, native: { state: 'half-opened', orientation: 'vertical', bounds: { x, y: 0, width: w, height }, isSeparating: true, occlusion: 'none' } });
const table = (width: number, height: number) =>
  computeLayout({ width, height, coarse: true, native: { state: 'half-opened', orientation: 'horizontal', bounds: { x: 0, y: Math.round(height / 2), width, height: 0 }, isSeparating: true, occlusion: 'none' } });

test('a continuous screen starts at the centre, with the gutter between', () => {
  const g = splitGeometry({ width: 890, height: 626, state: free(890, 626), hand: 'right', rtl: false });
  assert.equal(g.mode, 'columns');
  assert.equal(g.locked, false);
  assert.equal(g.gutter, GUTTER_PX);
  assert.equal(g.control, 437);
  assert.equal(g.control + g.gutter + g.canvas, 890);
  assert.equal(g.controlLeft, true, 'right-handed: controls on the left');
});

test('the snap points that leave both panes room, per width', () => {
  assert.deepEqual(validSnaps(890), [1 / 3, 1 / 2, 2 / 3], 'Duo sideways: all three');
  assert.deepEqual(validSnaps(790), [1 / 3, 1 / 2, 2 / 3], 'Fold inner: all three, just');
  assert.deepEqual(validSnaps(626), [1 / 2], 'Duo upright: only the centre leaves both panes working');
  for (const w of [626, 790, 890, 1024]) {
    for (const r of validSnaps(w)) {
      assert.ok(r * (w - GUTTER_PX) >= MIN_CONTROL_PX && (1 - r) * (w - GUTTER_PX) >= MIN_CANVAS_PX, `${w} @ ${r}`);
    }
  }
});

test('a remembered ratio lands on the nearest valid snap', () => {
  assert.equal(nearestSnap(0.3, 890), 1 / 3);
  assert.equal(nearestSnap(0.62, 890), 2 / 3);
  assert.equal(nearestSnap(0.3, 626), 1 / 2, 'a third is not valid at 626, so the centre');
  const g = splitGeometry({ width: 890, height: 626, state: free(890, 626), hand: 'right', rtl: false, ratio: 0.7 });
  assert.equal(g.ratio, 2 / 3);
  assert.equal(g.control, Math.round((2 / 3) * (890 - GUTTER_PX)));
});

test('the hand and the direction decide the control side', () => {
  const side = (hand: 'left' | 'right', rtl: boolean) => splitGeometry({ width: 890, height: 626, state: free(890, 626), hand, rtl }).controlLeft;
  assert.equal(side('right', false), true);
  assert.equal(side('left', false), false);
  assert.equal(side('right', true), false, 'RTL mirrors the right hand');
  assert.equal(side('left', true), true, 'and mirrors the left hand back');
});

test('a book fold locks the panes to the hinge: a gapless fold gets the least gutter, centred on the crease', () => {
  const g = splitGeometry({ width: 790, height: 820, state: book(790, 820), hand: 'right', rtl: false, ratio: 1 / 3 });
  assert.equal(g.locked, true);
  assert.equal(g.gutter, GUTTER_PX);
  assert.equal(g.control, 395 - GUTTER_PX / 2, 'the remembered ratio is ignored on a fold');
  assert.equal(g.canvas, 790 - 395 - GUTTER_PX / 2);
  const left = splitGeometry({ width: 790, height: 820, state: book(790, 820), hand: 'left', rtl: false });
  assert.equal(left.controlLeft, false);
  assert.equal(left.control, g.canvas, 'the left hand takes the right half');
});

test('a physical hinge wider than the gutter is the gutter, and nothing straddles it', () => {
  const g = splitGeometry({ width: 1114, height: 705, state: book(1114, 705, 540, 34), hand: 'right', rtl: false });
  assert.equal(g.gutter, 34);
  assert.equal(g.control, 540);
  assert.equal(g.canvas, 540);
});

test('a tabletop stacks the canvas on top and the controls below, whatever the hand', () => {
  for (const hand of ['left', 'right'] as const) {
    const g = splitGeometry({ width: 820, height: 790, state: table(820, 790), hand, rtl: false });
    assert.equal(g.mode, 'stack');
    assert.equal(g.locked, true);
    assert.equal(g.canvas, 395 - GUTTER_PX / 2, 'canvas height above the fold');
    assert.equal(g.control, 790 - 395 - GUTTER_PX / 2, 'deck height below it');
  }
});

// ── The live view ────────────────────────────────────────────────────────────

const root = (): HTMLElement => document.documentElement;
const prop = (p: string): string => root().style.getPropertyValue(p);
const divider = (): HTMLElement | null => document.querySelector('.split-divider');

test('outside split a mounted view writes nothing and draws no divider', () => {
  size(1280, 800);
  coarse = false;
  const stop = startLayoutPosture(win);
  const view = mountSplitView({ id: 't-none' });
  try {
    assert.equal(divider(), null);
    assert.equal(prop('--split-control'), '');
    assert.equal(view.geometry(), null);
    const swap = view.swapButton();
    assert.equal(swap.hidden, true, 'Swap sides is not offered without two sides');
  } finally { view.destroy(); stop(); }
});

test('in split the view writes the pane custom properties and a focusable divider; destroy clears them', () => {
  localStorage.removeItem(SPLIT_STORE_KEY);
  size(890, 626);
  coarse = true;
  const stop = startLayoutPosture(win);
  const view = mountSplitView({ id: 't-live' });
  try {
    assert.equal(prop('--split-control'), '437px');
    assert.equal(prop('--split-gutter'), `${GUTTER_PX}px`);
    const d = divider()!;
    assert.ok(d, 'the divider is in the page');
    assert.equal(d.getAttribute('role'), 'separator');
    assert.equal(d.getAttribute('aria-orientation'), 'vertical');
    assert.equal(d.getAttribute('aria-valuenow'), '50');
    assert.equal(d.tabIndex, 0);
    assert.equal(view.swapButton().hidden, false);
  } finally { view.destroy(); stop(); }
  assert.equal(divider(), null);
  assert.equal(prop('--split-control'), '');
});

test('the keyboard steps between snap points and the choice is remembered per view', () => {
  localStorage.removeItem(SPLIT_STORE_KEY);
  size(890, 626);
  coarse = true;
  const stop = startLayoutPosture(win);
  const view = mountSplitView({ id: 't-keys' });
  try {
    const d = divider()!;
    // Right-handed, controls on the left: ArrowLeft moves the divider towards them.
    d.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    assert.equal(view.geometry()!.ratio, 1 / 3);
    assert.equal(rememberedRatio('t-keys'), Math.round((1 / 3) * 10000) / 10000);
    d.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    assert.equal(view.geometry()!.ratio, 2 / 3);
    d.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(view.geometry()!.ratio, 1 / 2);
    assert.equal(rememberedRatio('another-view'), null, 'one view never moves another');
  } finally { view.destroy(); stop(); }
});

test('a fold arriving mid-session locks the divider to the hinge; the left hand moves the controls', () => {
  size(800, 760);
  coarse = true;
  const stop = startLayoutPosture(win);
  const view = mountSplitView({ id: 't-fold' });
  try {
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: { state: 'half-opened', orientation: 'vertical', bounds: { x: 400, y: 0, width: 0, height: 760 }, isSeparating: true, occlusion: 'none' } }));
    const g = view.geometry()!;
    assert.equal(g.locked, true);
    assert.equal(prop('--split-control'), `${400 - GUTTER_PX / 2}px`);
    assert.ok(divider()!.hasAttribute('data-locked'));
    assert.equal(divider()!.getAttribute('aria-hidden'), 'true', 'the hinge is not a control');
    applyHand('left');
    assert.equal(view.geometry()!.controlLeft, false);
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: { state: 'half-opened', orientation: 'horizontal', bounds: { x: 0, y: 380, width: 800, height: 0 }, isSeparating: true, occlusion: 'none' } }));
    assert.equal(view.geometry()!.mode, 'stack');
    assert.equal(prop('--split-top'), `${380 - GUTTER_PX / 2}px`);
    assert.equal(view.swapButton().hidden, true, 'no sides to swap on a tabletop');
  } finally { applyHand('right'); view.destroy(); stop(); }
});
