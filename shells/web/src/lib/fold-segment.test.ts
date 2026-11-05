// SPDX-License-Identifier: MPL-2.0
/**
 * The page that dialogs and the browse search keep to on a fold
 * (lib/fold-segment.ts): the control pane's segment for each hand and direction,
 * the deck on a tabletop, nothing on a flat screen, and the live properties
 * following a synthetic `lolly:fold`, a swap of hand and an unfold. Design's tool
 * rail follows the same states: upright on the edge in a book, along the foot on a
 * tabletop (lib/design-panel-layout.ts).
 *
 * Run directly:  node --test shells/web/src/lib/fold-segment.test.ts
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
let coarse = false;
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

const { controlSegment, startFoldSegments } = await import('./fold-segment.ts');
const { computeLayout, startLayoutPosture, NATIVE_FOLD_EVENT } = await import('./layout-posture.ts');
const { applyHand } = await import('./hand-pref.ts');
const { toolPaletteAtFoot, toolRailOnEdge } = await import('./design-panel-layout.ts');

const half = (orientation: 'vertical' | 'horizontal', bounds: { x: number; y: number; width: number; height: number }) =>
  ({ state: 'half-opened', orientation, bounds, isSeparating: true, occlusion: 'none' }) as const;
const book = computeLayout({ width: 800, height: 700, coarse: true, native: half('vertical', { x: 400, y: 0, width: 0, height: 700 }) });
const hinge = computeLayout({ width: 1114, height: 705, coarse: true, native: half('vertical', { x: 540, y: 0, width: 34, height: 705 }) });
const table = computeLayout({ width: 800, height: 760, coarse: true, native: half('horizontal', { x: 0, y: 380, width: 800, height: 0 }) });

test('a book fold: the left page for a right hand, the right page for a left hand', () => {
  assert.deepEqual(controlSegment(book, 'right', false, 800, 700), { top: 0, right: 400, bottom: 0, left: 0, width: 400, height: 700 });
  assert.deepEqual(controlSegment(book, 'left', false, 800, 700), { top: 0, right: 0, bottom: 0, left: 400, width: 400, height: 700 });
});

test('a right-to-left language mirrors the page', () => {
  assert.equal(controlSegment(book, 'right', true, 800, 700)!.left, 400, 'right hand, RTL: the controls are on the right page');
  assert.equal(controlSegment(book, 'left', true, 800, 700)!.left, 0, 'left hand, RTL: the left page');
});

test('a physical hinge belongs to neither page', () => {
  const left = controlSegment(hinge, 'right', false, 1114, 705)!;
  assert.equal(left.width, 540);
  assert.equal(left.right, 1114 - 540);
  const right = controlSegment(hinge, 'left', false, 1114, 705)!;
  assert.equal(right.left, 574, 'starts past the 34px hinge');
  assert.equal(right.width, 1114 - 574);
});

test('a tabletop: the deck below the fold, whatever the hand', () => {
  for (const hand of ['left', 'right'] as const) {
    assert.deepEqual(controlSegment(table, hand, false, 800, 760), { top: 380, right: 0, bottom: 0, left: 0, width: 800, height: 380 });
  }
});

test('no reported fold, no segment: a flat screen and the size-only split keep their centring', () => {
  assert.equal(controlSegment(computeLayout({ width: 890, height: 626, coarse: true }), 'right', false, 890, 626), null);
  assert.equal(controlSegment(computeLayout({ width: 1280, height: 800, coarse: false }), 'right', false, 1280, 800), null);
  const flat = computeLayout({ width: 790, height: 820, coarse: true, native: { state: 'flat', orientation: 'vertical', bounds: { x: 395, y: 0, width: 0, height: 820 }, isSeparating: false, occlusion: 'none' } });
  assert.equal(controlSegment(flat, 'right', false, 790, 820), null);
});

const root = (): HTMLElement => document.documentElement;
const props = (): string[] => ['--fold-seg-top', '--fold-seg-right', '--fold-seg-bottom', '--fold-seg-left', '--fold-seg-w', '--fold-seg-h'].map((p) => root().style.getPropertyValue(p));

test('live: a synthetic lolly:fold publishes the segment, a hand swap moves it, and an unfold clears it', () => {
  size(800, 700);
  coarse = false;
  const stopLayout = startLayoutPosture(win);
  const stop = startFoldSegments(win);
  try {
    assert.deepEqual(props(), ['', '', '', '', '', ''], 'nothing before a fold');
    assert.equal(root().hasAttribute('style'), false, 'not even an empty style attribute');
    assert.equal(toolRailOnEdge(), false, 'no panes: Design\'s rail is its usual self');
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: half('vertical', { x: 400, y: 0, width: 0, height: 700 }) }));
    assert.deepEqual(props(), ['0px', '400px', '0px', '0px', '400px', '700px']);
    assert.equal(toolRailOnEdge(), true, 'a book: the rail stands on the canvas pane\'s outer edge');
    assert.equal(toolPaletteAtFoot(), false, 'and is not the foot palette');
    applyHand('left');
    assert.deepEqual(props(), ['0px', '0px', '0px', '400px', '400px', '700px'], 'the left hand takes the right page');
    applyHand('right');
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: half('horizontal', { x: 0, y: 350, width: 800, height: 0 }) }));
    assert.deepEqual(props(), ['350px', '0px', '0px', '0px', '800px', '350px'], 'on the table, the deck');
    assert.equal(toolPaletteAtFoot(), true, 'on the table the rail is the palette along the foot');
    assert.equal(toolRailOnEdge(), false);
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: null }));
    assert.deepEqual(props(), ['', '', '', '', '', ''], 'unfolded: every property is gone');
  } finally { stop(); stopLayout(); applyHand('right'); }
});
