// SPDX-License-Identifier: MPL-2.0
/**
 * The layout class and posture (lib/layout-posture.ts): the decision as a pure
 * function over every signal, the attributes it puts on <html>, and the live module
 * following resize, posture and native fold events.
 *
 * Run directly:  node --test shells/web/src/lib/layout-posture.test.ts
 *
 * The sizes are the plan's test matrix: an iPhone Duo inner screen (626 x 890 and
 * 890 x 626), its outer screen (466 x 678), a book-style Android inner screen
 * (about 790 x 820), plus the cases that must NOT change: a phone, a tablet, and a
 * mouse-driven desktop window. As with the accessibility preferences, the invariant
 * that matters most is ADDITIVITY: outside split there is no attribute and no
 * custom property at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
const win = dom.window as unknown as Window & typeof globalThis;
globalThis.window = win;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

let coarse = true;
let folded = false;
function installMatchMedia(): void {
  const mm = ((q: string) => ({
    get matches() {
      if (q.includes('pointer: coarse')) return coarse;
      if (q.includes('device-posture: folded')) return folded;
      const max = /max-width:\s*(\d+)px/.exec(q);
      if (max) return win.innerWidth <= Number(max[1]);
      return false;
    },
    media: q, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia;
  win.matchMedia = mm;
  globalThis.matchMedia = mm;
}
installMatchMedia();

function size(width: number, height: number): void {
  Object.defineProperty(win, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(win, 'innerHeight', { value: height, configurable: true });
}

const {
  computeLayout, applyLayoutState, startLayoutPosture, currentLayout, isSplitLayout, isPhoneLayout,
  onLayoutChange, phoneLayoutQuery, readNativeFold, sizeCallsForSplit,
  NATIVE_FOLD_EVENT, NATIVE_FOLD_GLOBAL, SPLIT_MIN_SHORT, SPLIT_MAX_LONG,
} = await import('./layout-posture.ts');
type Signals = Parameters<typeof computeLayout>[0];

const at = (width: number, height: number, extra: Partial<Signals> = {}): Signals => ({ width, height, coarse: true, ...extra });
const root = (): HTMLElement => document.documentElement;
const foldProps = (): string[] => ['--fold-x', '--fold-y', '--fold-w', '--fold-h'].map((p) => root().style.getPropertyValue(p));

function reset(): void {
  delete root().dataset.layout;
  delete root().dataset.posture;
  root().removeAttribute('style');
  delete (win as unknown as Record<string, unknown>)[NATIVE_FOLD_GLOBAL];
  coarse = true;
  folded = false;
}

// ── The size rule: the plan's matrix ──────────────────────────────────────────

test('iPhone Duo inner screen, upright and sideways, is split', () => {
  for (const [w, h] of [[626, 890], [890, 626]] as const) {
    const s = computeLayout(at(w, h));
    assert.equal(s.layout, 'split', `${w}x${h}`);
    assert.equal(s.source, 'size');
    assert.equal(s.posture, null, 'the size alone says nothing about a posture');
    assert.equal(s.fold, null);
  }
});

test('the outer screens stay phone, and a book-style inner screen is split', () => {
  assert.equal(computeLayout(at(466, 678)).layout, 'phone', 'iPhone Duo outer');
  assert.equal(computeLayout(at(412, 915)).layout, 'phone', 'an Android outer screen or flip');
  assert.equal(computeLayout(at(790, 820)).layout, 'split', 'a Fold inner screen');
  assert.equal(computeLayout(at(841, 701)).layout, 'split', 'a Pixel Fold inner screen');
});

test('a tablet and a landscape phone keep their layouts', () => {
  assert.equal(computeLayout(at(744, 1133)).layout, 'desktop', 'iPad mini upright: long side past the limit');
  assert.equal(computeLayout(at(1180, 820)).layout, 'desktop', 'iPad Air sideways');
  assert.equal(computeLayout(at(915, 412)).layout, 'desktop', 'a phone sideways: short side under the limit');
  assert.equal(computeLayout(at(640, 400)).layout, 'phone');
});

test('the size rule is touch only: a mouse-driven window of the same size keeps its layout', () => {
  assert.equal(computeLayout({ width: 1024, height: 768, coarse: false }).layout, 'desktop');
  assert.equal(computeLayout({ width: 626, height: 890, coarse: false }).layout, 'phone');
  assert.equal(computeLayout({ width: 1024, height: 768, coarse: true }).layout, 'split');
});

test('the thresholds are inclusive at both ends and the shape gate holds', () => {
  assert.equal(sizeCallsForSplit(SPLIT_MIN_SHORT, SPLIT_MIN_SHORT), true);
  assert.equal(sizeCallsForSplit(SPLIT_MIN_SHORT - 1, 800), false);
  assert.equal(sizeCallsForSplit(SPLIT_MAX_LONG, 800), true);
  assert.equal(sizeCallsForSplit(SPLIT_MAX_LONG + 1, 800), false);
  assert.equal(sizeCallsForSplit(560, 1000), false, 'aspect 0.56, too tall and narrow');
  assert.equal(sizeCallsForSplit(1000, 600), false, 'aspect 1.67, too wide');
  assert.equal(sizeCallsForSplit(0, 0), false);
});

// ── Viewport segments ─────────────────────────────────────────────────────────

test('two side-by-side segments are a book, with the gap between them as the fold', () => {
  const s = computeLayout(at(790, 820, { segments: [{ x: 0, y: 0, width: 395, height: 820 }, { x: 395, y: 0, width: 395, height: 820 }] }));
  assert.equal(s.layout, 'split');
  assert.equal(s.posture, 'book');
  assert.equal(s.orientation, 'vertical');
  assert.equal(s.source, 'segments');
  assert.deepEqual(s.fold, { x: 395, y: 0, width: 0, height: 820 });
});

test('a hinge between segments keeps its width, and stacked segments are a tabletop', () => {
  const hinge = computeLayout(at(1114, 705, { segments: [{ x: 0, y: 0, width: 540, height: 705 }, { x: 574, y: 0, width: 540, height: 705 }] }));
  assert.equal(hinge.layout, 'split', 'segments win over the size rule (1114 is past the long-side limit)');
  assert.deepEqual(hinge.fold, { x: 540, y: 0, width: 34, height: 705 });
  const table = computeLayout(at(820, 790, { segments: [{ x: 0, y: 395, width: 820, height: 395 }, { x: 0, y: 0, width: 820, height: 395 }] }));
  assert.equal(table.posture, 'tabletop', 'segment order does not matter');
  assert.equal(table.orientation, 'horizontal');
  assert.deepEqual(table.fold, { x: 0, y: 395, width: 820, height: 0 });
});

test('one segment is no fold at all', () => {
  const s = computeLayout(at(1280, 800, { coarse: false, segments: [{ x: 0, y: 0, width: 1280, height: 800 }] }));
  assert.equal(s.layout, 'desktop');
});

// ── Native fold reports ───────────────────────────────────────────────────────

const half = (orientation: 'vertical' | 'horizontal', bounds: { x: number; y: number; width: number; height: number }) =>
  ({ state: 'half-opened', orientation, bounds, isSeparating: true, occlusion: 'none' }) as const;

test('a native half-open vertical fold is a book locked to its bounds', () => {
  const s = computeLayout(at(800, 700, { native: half('vertical', { x: 400, y: 0, width: 0, height: 700 }) }));
  assert.equal(s.layout, 'split');
  assert.equal(s.posture, 'book');
  assert.equal(s.source, 'native');
  assert.deepEqual(s.fold, { x: 400, y: 0, width: 0, height: 700 });
});

test('a native horizontal fold is a tabletop, even on a phone-sized flip', () => {
  const s = computeLayout(at(412, 915, { coarse: true, native: half('horizontal', { x: 0, y: 457, width: 412, height: 0 }) }));
  assert.equal(s.layout, 'split');
  assert.equal(s.posture, 'tabletop');
});

test('a native flat fold that separates nothing is the size rule, posture flat', () => {
  const flat = { state: 'flat', orientation: 'vertical', bounds: { x: 395, y: 0, width: 0, height: 820 }, isSeparating: false, occlusion: 'none' } as const;
  const s = computeLayout(at(790, 820, { coarse: false, native: flat }));
  assert.equal(s.layout, 'split', 'a native report comes from a touch device, so no pointer gate');
  assert.equal(s.posture, 'flat');
  assert.equal(s.fold, null, 'a continuous screen has nothing to lock the divider to');
});

test('native null (folded shut, or a cover screen) falls back to the size rule', () => {
  assert.equal(computeLayout(at(466, 678, { native: null })).layout, 'phone');
  assert.equal(computeLayout(at(626, 890, { native: null })).layout, 'split');
});

test('a fold outside this window (an OS split view on the other half) does not count', () => {
  const s = computeLayout(at(400, 820, { native: half('vertical', { x: 410, y: 0, width: 0, height: 820 }) }));
  assert.equal(s.layout, 'phone');
});

test('readNativeFold keeps null, refuses a malformed report', () => {
  assert.equal(readNativeFold(null), null);
  assert.equal(readNativeFold(undefined), undefined);
  assert.equal(readNativeFold({ orientation: 'diagonal', bounds: { x: 0, y: 0, width: 0, height: 0 } }), undefined);
  assert.equal(readNativeFold({ orientation: 'vertical', bounds: { x: Number.NaN, y: 0, width: 0, height: 0 } }), undefined);
  assert.ok(readNativeFold(half('vertical', { x: 1, y: 0, width: 0, height: 1 })));
});

// ── Device posture without geometry ──────────────────────────────────────────

test('a folded posture with no segments puts the fold across the middle of the long side', () => {
  const book = computeLayout(at(823, 707, { devicePosture: 'folded' }));
  assert.equal(book.posture, 'book');
  assert.deepEqual(book.fold, { x: 412, y: 0, width: 0, height: 707 });
  const table = computeLayout(at(707, 823, { devicePosture: 'folded' }));
  assert.equal(table.posture, 'tabletop');
  assert.deepEqual(table.fold, { x: 0, y: 412, width: 707, height: 0 });
  assert.equal(computeLayout(at(1280, 800, { coarse: false, devicePosture: 'continuous' })).layout, 'desktop');
});

// ── Additivity on <html> ─────────────────────────────────────────────────────

test('phone and desktop write nothing: no attribute, no custom property, no style attribute', () => {
  reset();
  const before = root().outerHTML;
  applyLayoutState(computeLayout(at(466, 678)));
  applyLayoutState(computeLayout({ width: 1280, height: 800, coarse: false }));
  assert.equal(root().outerHTML, before);
  assert.equal(root().hasAttribute('data-layout'), false);
  assert.equal(root().hasAttribute('data-posture'), false);
  assert.equal(root().hasAttribute('style'), false);
});

test('split sets data-layout; a fold adds the posture and the --fold-* properties; leaving clears all of it', () => {
  reset();
  applyLayoutState(computeLayout(at(626, 890)));
  assert.equal(root().dataset.layout, 'split');
  assert.equal(root().hasAttribute('data-posture'), false, 'no posture without a signal');
  assert.deepEqual(foldProps(), ['', '', '', '']);
  applyLayoutState(computeLayout(at(790, 820, { segments: [{ x: 0, y: 0, width: 395, height: 820 }, { x: 395, y: 0, width: 395, height: 820 }] })));
  assert.equal(root().dataset.posture, 'book');
  assert.deepEqual(foldProps(), ['395px', '0px', '0px', '820px']);
  applyLayoutState(computeLayout({ width: 1280, height: 800, coarse: false }));
  assert.equal(root().hasAttribute('data-layout'), false);
  assert.equal(root().hasAttribute('data-posture'), false);
  assert.equal(root().hasAttribute('style'), false, 'the emptied style attribute goes too');
});

test('other inline properties on <html> survive leaving split', () => {
  reset();
  root().style.setProperty('--vv-top', '0px');
  applyLayoutState(computeLayout(at(790, 820, { devicePosture: 'folded' })));
  applyLayoutState(computeLayout({ width: 1280, height: 800, coarse: false }));
  assert.equal(root().style.getPropertyValue('--vv-top'), '0px');
});

// ── The live module ──────────────────────────────────────────────────────────

test('a synthetic lolly:fold event moves the layout at once, and null moves it back', () => {
  reset();
  size(800, 700);
  coarse = false; // a mouse-sized window, so only the fold can make it split
  const stop = startLayoutPosture(win);
  try {
    assert.equal(currentLayout().layout, 'desktop');
    const seen: string[] = [];
    const off = onLayoutChange((s) => seen.push(`${s.layout}:${s.posture ?? '-'}`));
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: half('vertical', { x: 400, y: 0, width: 0, height: 700 }) }));
    assert.equal(isSplitLayout(), true, 'decided on the same turn as the event, not after a settle');
    assert.equal(root().dataset.layout, 'split');
    assert.equal(root().dataset.posture, 'book');
    assert.deepEqual(foldProps(), ['400px', '0px', '0px', '700px']);
    assert.ok((win as unknown as Record<string, unknown>)[NATIVE_FOLD_GLOBAL], 'the global follows the event');
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: null }));
    assert.equal(isSplitLayout(), false);
    assert.equal(root().hasAttribute('data-layout'), false);
    assert.deepEqual(seen, ['split:book', 'desktop:-']);
    off();
  } finally { stop(); }
});

test('window.__lollyFold at boot is read on start', () => {
  reset();
  size(800, 700);
  coarse = false;
  (win as unknown as Record<string, unknown>)[NATIVE_FOLD_GLOBAL] = half('horizontal', { x: 0, y: 350, width: 800, height: 0 });
  const stop = startLayoutPosture(win);
  try {
    assert.equal(currentLayout().posture, 'tabletop');
    assert.equal(root().dataset.posture, 'tabletop');
  } finally { stop(); }
});

test('a resize is gathered, then decided once; a folded posture media query is read without the JS API', async () => {
  reset();
  size(1280, 800);
  coarse = true;
  const stop = startLayoutPosture(win);
  try {
    assert.equal(currentLayout().layout, 'desktop');
    size(890, 626);
    win.dispatchEvent(new win.Event('resize'));
    win.dispatchEvent(new win.Event('resize'));
    assert.equal(currentLayout().layout, 'desktop', 'not yet: the burst is still settling');
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(currentLayout().layout, 'split');
    assert.equal(currentLayout().source, 'size');
    folded = true;
    size(823, 707);
    win.dispatchEvent(new win.Event('resize'));
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(currentLayout().posture, 'book');
  } finally { stop(); }
});

test('a window that can no longer hold two panes leaves them at once, with no settle', () => {
  reset();
  size(768, 1024);
  coarse = true;
  const stop = startLayoutPosture(win);
  try {
    assert.equal(currentLayout().layout, 'split');
    size(390, 844);
    win.dispatchEvent(new win.Event('resize'));
    assert.equal(currentLayout().layout, 'phone', 'a phone-width page is never drawn in two panes');
    assert.equal(root().hasAttribute('data-layout'), false);
    size(1440, 1000);
    win.dispatchEvent(new win.Event('resize'));
    size(768, 1024);
    win.dispatchEvent(new win.Event('resize'));
    assert.equal(currentLayout().layout, 'phone', 'entering two panes still waits for the burst to settle');
  } finally { stop(); }
});

test('stop() takes every attribute back off <html>', () => {
  reset();
  size(626, 890);
  const stop = startLayoutPosture(win);
  assert.equal(root().dataset.layout, 'split');
  stop();
  assert.equal(root().hasAttribute('data-layout'), false);
});

test('phoneLayoutQuery: the 640px query, minus split', () => {
  reset();
  size(626, 890);
  coarse = false;
  let stop = startLayoutPosture(win);
  try {
    assert.equal(isPhoneLayout(), true);
    assert.equal(phoneLayoutQuery(win).matches, true);
  } finally { stop(); }
  coarse = true;
  stop = startLayoutPosture(win);
  try {
    assert.equal(isSplitLayout(), true);
    assert.equal(isPhoneLayout(), false, '626px wide, but two panes, so not the phone layout');
    assert.equal(phoneLayoutQuery(win).matches, false);
  } finally { stop(); }
});

test('phoneLayoutQuery fires change when split arrives, and only on a real change', () => {
  reset();
  size(626, 890);
  coarse = false;
  const stop = startLayoutPosture(win);
  try {
    const q = phoneLayoutQuery(win);
    let changes = 0;
    const fn = (): void => { changes++; };
    q.addEventListener('change', fn);
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: half('vertical', { x: 313, y: 0, width: 0, height: 890 }) }));
    assert.equal(changes, 1);
    assert.equal(q.matches, false);
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: half('vertical', { x: 300, y: 0, width: 0, height: 890 }) }));
    assert.equal(changes, 1, 'the fold moved but the answer did not');
    q.removeEventListener('change', fn);
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: null }));
    assert.equal(changes, 1, 'removed listeners hear nothing');
  } finally { stop(); }
});
