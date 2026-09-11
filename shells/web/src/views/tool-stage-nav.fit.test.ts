// SPDX-License-Identifier: MPL-2.0
/**
 * Fit fits the WORK, not the canvas (plan 179 C5).
 *
 * The reproduction this pins: opening the Slide deck template framed the 1920x1080
 * export box, so slide 1 filled the viewport and slides 2 and 3 sat off the right edge
 * with nothing saying they existed. Fit now frames the union of the document's artboard
 * pages, and Shift+2 frames the selection.
 *
 * Three properties matter more than the arithmetic:
 *
 *   · A document with NO artboards is byte-for-byte what it was. The rect providers are
 *     optional and may answer null, and in that state Fit is reset() + the caller's
 *     fitCanvas, leaving the transform cleared - which is what every non-canvas tool in
 *     the app gets, so a regression here would be invisible until it shipped.
 *   · A single artboard that IS the export frame is left alone too (the FIT_SNAP dead
 *     zone): the union then differs from the canvas only by fitCanvas's own gutter, and
 *     a transform for a sub-5% move would make isZoomed() true for nothing.
 *   · The zoom-out floor still clamps a HAND zoom-out at MIN_ABS. A computed fit is the
 *     one thing allowed past it - without that carve-out a 3-slide deck's Fit-all clamps
 *     at 20% of native and cuts the last slide in half, i.e. the floor forbids the view
 *     it just calculated.
 *
 * Driven through the real controller in jsdom, which reports zero rects, so the stage,
 * the canvas and the artboard pages are given stubbed rects. The canvas stub is
 * scale-AWARE (its live width tracks the outer wrapper's transform) because that is the
 * invariant minScale/maxScale are built on: `width / scale` must recover the untransformed
 * fitted width, or the floor moves as you zoom and every clamp assertion below is fiction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync } from 'node:fs';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
if (typeof dom.window.matchMedia !== 'function') {
  (dom.window as unknown as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });
}

const { setupStageNav } = await import('./tool-stage-nav.ts');
type Rect = { x: number; y: number; w: number; h: number };

// The module's own constants, restated so that changing one is a visible test change.
const FIT_MARGIN = 0.94, SEL_MARGIN = 0.85, MIN_ABS = 0.2;
const NATIVE_W = 1920;          // the export width the zoom floor/ceiling are absolute against
const FITTED_W = 960;           // what the canvas measures at Fit → fitAbs 0.5, so the floor is 0.4
const STAGE_W = 1000, STAGE_H = 700;

function fakeRect(r: Rect): DOMRect {
  return {
    x: r.x, y: r.y, width: r.w, height: r.h,
    left: r.x, top: r.y, right: r.x + r.w, bottom: r.y + r.h,
    toJSON() { return r; },
  } as DOMRect;
}
/** Give an element a rect that can move - the fn is re-read on every measurement. */
function stubRect(el: Element, fn: () => Rect): void {
  (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => fakeRect(fn());
}

/** The transform the controller currently shows, parsed back out. */
function transformOf(outer: HTMLElement): { scale: number; tx: number; ty: number } {
  const t = outer.style.transform;
  if (!t) return { scale: 1, tx: 0, ty: 0 };
  const s = t.match(/scale\(([\d.e+-]+)\)/);
  const p = t.match(/translate\(([\d.e+-]+)px,\s*([\d.e+-]+)px\)/);
  return { scale: s ? Number(s[1]) : 1, tx: p ? Number(p[1]) : 0, ty: p ? Number(p[2]) : 0 };
}

/**
 * A stage with a fitted canvas and N artboard "pages" laid out on the pasteboard.
 * `pages` are given in the coordinates they occupy at Fit (scale 1); the fake rects
 * track the live transform so a second measurement after a zoom reads what the browser
 * would report. onFit stands in for tool.ts's fitCanvas.
 */
function mount(pages: Rect[], sel: Rect | null = null) {
  const stage = document.createElement('div');
  const outer = document.createElement('div');
  const canvas = document.createElement('div');
  outer.appendChild(canvas);
  stage.appendChild(outer);
  document.body.appendChild(stage);

  let fits = 0;
  const live = () => transformOf(outer);
  stubRect(stage, () => ({ x: 0, y: 0, w: STAGE_W, h: STAGE_H }));
  stubRect(canvas, () => { const { scale } = live(); return { x: 0, y: 0, w: FITTED_W * scale, h: (FITTED_W * 9 / 16) * scale }; });
  // outer keeps jsdom's zero rect on purpose: captureOrigin then puts the wrapper's
  // natural top-left at client (0,0), so a point at Fit-coordinate X is drawn at
  // tx + X * scale - the mapping the "does it actually fit" assertions below use.

  const unionOf = (rs: Rect[]): Rect | null => {
    if (!rs.length) return null;
    const { scale, tx, ty } = live();
    const at = (r: Rect): Rect => ({ x: tx + r.x * scale, y: ty + r.y * scale, w: r.w * scale, h: r.h * scale });
    const m = rs.map(at);
    const minX = Math.min(...m.map(r => r.x)), minY = Math.min(...m.map(r => r.y));
    const maxX = Math.max(...m.map(r => r.x + r.w)), maxY = Math.max(...m.map(r => r.y + r.h));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  const nav = setupStageNav(stage, outer, canvas, NATIVE_W, () => { fits++; }, undefined, undefined, undefined, {
    contentRect: () => unionOf(pages),
    selectionRect: () => (sel ? unionOf([sel]) : null),
  });
  return {
    stage, outer, nav,
    fitCalls: () => fits,
    /** Where the artboard union is drawn once the current transform is applied. */
    unionOnScreen: () => unionOf(pages)!,
    teardown() { nav.destroy(); stage.remove(); },
  };
}

/** Dispatch a keydown on window - the channel setupStageNav listens on. */
function press(key: string, mods: Record<string, unknown> = {}): KeyboardEvent {
  const e = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods });
  dom.window.dispatchEvent(e);
  return e;
}

const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

test('Fit frames every artboard - a two-page document is not fitted to page one', () => {
  const pages: Rect[] = [{ x: 0, y: 0, w: 960, h: 540 }, { x: 1075, y: 0, w: 960, h: 540 }];
  const h = mount(pages);
  try {
    assert.equal(h.outer.style.transform, '', 'precondition: mounted at Fit, no transform');
    h.nav.fit();
    assert.equal(h.fitCalls(), 1, 'the caller\'s fitCanvas still runs first');
    const union = { w: 2035, h: 540 };
    const want = FIT_MARGIN * Math.min(STAGE_W / union.w, STAGE_H / union.h);
    const { scale } = transformOf(h.outer);
    assert.ok(near(scale, want), `Fit zooms to the union (${want}), got ${scale}`);
    const on = h.unionOnScreen();
    assert.ok(on.x >= 0 && on.x + on.w <= STAGE_W, `both pages are inside the stage (${on.x}..${on.x + on.w})`);
    assert.ok(on.y >= 0 && on.y + on.h <= STAGE_H, 'and vertically too');
  } finally { h.teardown(); }
});

test('a three-page deck is framed past the MIN_ABS floor - a computed fit is never forbidden', () => {
  // The repro's shape. Without the contentFloor carve-out in minScale this clamps at
  // 0.4 (MIN_ABS 0.2 over a fitAbs of 0.5) and slide 3 is cut in half.
  const pages: Rect[] = [
    { x: 0, y: 0, w: 960, h: 540 }, { x: 1075, y: 0, w: 960, h: 540 }, { x: 2150, y: 0, w: 960, h: 540 },
  ];
  const h = mount(pages);
  try {
    h.nav.fit();
    const want = FIT_MARGIN * Math.min(STAGE_W / 3110, STAGE_H / 540);
    const floorWithoutCarveOut = MIN_ABS / (FITTED_W / NATIVE_W);
    assert.ok(want < floorWithoutCarveOut, 'precondition: this deck needs to zoom out past the plain floor');
    const { scale } = transformOf(h.outer);
    assert.ok(near(scale, want), `framed at the computed fit (${want}), got ${scale}`);
    const on = h.unionOnScreen();
    assert.ok(on.x >= 0 && on.x + on.w <= STAGE_W, 'all three pages are on screen');
  } finally { h.teardown(); }
});

test('a document with NO artboards keeps today\'s Fit exactly - transform stays cleared', () => {
  const h = mount([]);
  try {
    press('=');   // zoom in so a Fit has something to undo
    assert.ok(transformOf(h.outer).scale > 1, 'precondition: zoomed in');
    h.nav.fit();
    assert.equal(h.outer.style.transform, '', 'Fit is reset() + fitCanvas and nothing else');
    assert.equal(h.nav.isZoomed(), false);
    assert.equal(h.fitCalls(), 1);
  } finally { h.teardown(); }
});

test('one artboard that IS the export frame is left alone (the dead zone)', () => {
  // The union differs from the fitted canvas only by fitCanvas's ~32px gutter, so the
  // computed fit is within FIT_SNAP of 1 and must not be applied.
  const h = mount([{ x: 16, y: 78, w: 968, h: 544 }]);
  try {
    h.nav.fit();
    assert.equal(h.outer.style.transform, '', 'no transform for a sub-5% move');
    assert.equal(h.nav.isZoomed(), false, 'and so the view still reads as "at Fit"');
  } finally { h.teardown(); }
});

test('artboards SMALLER than the canvas zoom IN - Fit fits the work, both ways', () => {
  const h = mount([{ x: 400, y: 300, w: 200, h: 120 }]);
  try {
    h.nav.fit();
    const want = FIT_MARGIN * Math.min(STAGE_W / 200, STAGE_H / 120);
    assert.ok(near(transformOf(h.outer).scale, want), 'zoomed onto the work, not the empty pasteboard');
  } finally { h.teardown(); }
});

test('a Fit-all is not a view the user chose - isUserZoomed stays false, a gesture flips it', () => {
  const pages: Rect[] = [{ x: 0, y: 0, w: 960, h: 540 }, { x: 1075, y: 0, w: 960, h: 540 }];
  const h = mount(pages);
  try {
    h.nav.fit();
    assert.equal(h.nav.isZoomed(), true, 'the transform is real');
    assert.equal(h.nav.isUserZoomed(), false, 'but it is still a FIT, so a resize may recompute it');
    press('=');
    assert.equal(h.nav.isUserZoomed(), true, 'a zoom key hands the view to the user');
  } finally { h.teardown(); }
});

test('Shift+2 zooms to the selection; with nothing selected it consumes the key and holds still', () => {
  const h = mount([{ x: 0, y: 0, w: 960, h: 540 }], { x: 400, y: 300, w: 100, h: 60 });
  try {
    const e = press('@', { code: 'Digit2', shiftKey: true });
    assert.equal(e.defaultPrevented, true, 'Shift+2 is the canvas\'s key');
    const want = SEL_MARGIN * Math.min(STAGE_W / 100, STAGE_H / 60);
    assert.ok(near(transformOf(h.outer).scale, want), `framed the selection at ${want}`);
    assert.equal(h.nav.isUserZoomed(), true, 'zooming to a selection IS a chosen view');
  } finally { h.teardown(); }

  const empty = mount([{ x: 0, y: 0, w: 960, h: 540 }], null);
  try {
    const e = press('@', { code: 'Digit2', shiftKey: true });
    assert.equal(e.defaultPrevented, true, 'still the canvas\'s key');
    assert.equal(empty.outer.style.transform, '', 'nothing selected - the view is left where it was');
  } finally { empty.teardown(); }
});

test('Shift+1 is Fit all', () => {
  const pages: Rect[] = [{ x: 0, y: 0, w: 960, h: 540 }, { x: 1075, y: 0, w: 960, h: 540 }];
  const h = mount(pages);
  try {
    const e = press('!', { code: 'Digit1', shiftKey: true });
    assert.equal(e.defaultPrevented, true);
    const want = FIT_MARGIN * Math.min(STAGE_W / 2035, STAGE_H / 540);
    assert.ok(near(transformOf(h.outer).scale, want), 'Shift+1 frames the whole document');
  } finally { h.teardown(); }
});

test('the zoom-out floor still clamps a HAND zoom-out at MIN_ABS', () => {
  const h = mount([]);   // no artboards, so nothing widens the floor
  try {
    const floor = MIN_ABS / (FITTED_W / NATIVE_W);   // 0.4 at fitAbs 0.5
    for (let i = 0; i < 12; i++) press('-');
    const { scale } = transformOf(h.outer);
    assert.ok(near(scale, floor, 1e-9), `zoom-out stops at the floor (${floor}), got ${scale}`);
    press('-');
    assert.ok(near(transformOf(h.outer).scale, floor, 1e-9), 'and stays there');
  } finally { h.teardown(); }
});

// ── the tool.ts wiring (plans/179 C5, the half a controller test cannot see) ───
//
// The controller can be perfect and the app still open a deck on slide 1: what matters
// is that every "return to a fitted view" site in views/tool.ts calls the CONTENT fit.
// `resetView` was missed when `refitStage` and the canvas-resize listener were changed,
// and it is the one on the newest path - `setCanvasSize` calls it, and
// `importAsArtboards` calls `setCanvasSize` the moment its rows commit, so a 20-slide
// .pptx import threw the whole-document fit away one line after making it. Nothing
// re-fits afterwards (the ResizeObserver watches the stage, whose size did not change),
// so this is invisible to every behavioural test in the suite.

// tool.ts is an orchestrator plus feature modules under tool/ (2026-09-09 split)
const toolDir = new URL('./tool/', import.meta.url);
const toolSrc = [readFileSync(new URL('./tool.ts', import.meta.url), 'utf8'), ...readdirSync(toolDir).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(new URL(n, toolDir), 'utf8'))].join('\n');

/** The body of a top-level `function <name>()` in tool.ts, braces balanced. */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `tool.ts declares ${name}`);
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unbalanced ${name}`);
}

test('every re-fit site in tool.ts asks for the CONTENT fit, not the export box', () => {
  for (const name of ['resetView', 'refitStage']) {
    const body = fnBody(toolSrc, name);
    assert.match(body, /stageZoom(\?)?\.fit\(\)/, `${name} fits the content`);
    assert.doesNotMatch(body, /stageZoom\?\.reset\(\)/,
      `${name} must not reset-and-fit-the-canvas: that is the framing C5 removed`);
  }
});

// ══ the reserved bands (plans/179 M1-M3) ═════════════════════════════════════
//
// The Design chrome docks three bands onto the stage - the top bar's height, and the
// navigator's and inspector's widths - and `fitCanvas` honours them as MARGINS on the
// canvas wrapper, so the artboard is laid out inside them. Every fit and every framing
// here therefore has to measure and centre against that band, not the whole stage box.
//
// Measuring the stage instead was not a small error. With both columns open on a 1400px
// stage the artboard is fitted into 856px and the fit then computed `want` from 1400,
// i.e. ~1.54: the artwork was scaled up by the width of the two columns and re-centred
// on the stage centre, putting ~190px of it under the navigator and ~238px under the
// inspector. It also defeated the FIT_SNAP dead zone in the one case the dead zone
// exists for, because the reserves guarantee `want` is nowhere near 1.

test('Fit frames the VISIBLE band, not the stage the two columns have claimed', () => {
  const h = mount([{ x: 0, y: 0, w: 960, h: 540 }]);
  try {
    h.stage.style.setProperty('--stage-reserve-top', '48px');
    h.stage.style.setProperty('--stage-reserve-left', '232px');
    h.stage.style.setProperty('--stage-reserve-right', '280px');
    const visW = STAGE_W - 232 - 280, visH = STAGE_H - 48;
    h.nav.fit();
    const want = FIT_MARGIN * Math.min(visW / 960, visH / 540);
    assert.ok(Math.abs(want - 1) > 0.05, 'precondition: this is outside the FIT_SNAP dead zone');
    const { scale } = transformOf(h.outer);
    assert.ok(near(scale, want), `framed against the band (${want}), got ${scale}`);
    const on = h.unionOnScreen();
    assert.ok(on.x >= 232 - 0.5 && on.x + on.w <= STAGE_W - 280 + 0.5,
      `the artboard clears both columns (${on.x}..${on.x + on.w})`);
    assert.ok(on.y >= 48 - 0.5, `and sits below the top bar (${on.y})`);
    assert.ok(near(on.x + on.w / 2, 232 + visW / 2, 0.5), 'centred on the band, not on the stage');
    assert.ok(near(on.y + on.h / 2, 48 + visH / 2, 0.5), 'vertically too');
  } finally { h.teardown(); }
});

test('framing one artboard (the navigator\'s own door) centres it in the band as well', () => {
  const h = mount([{ x: 0, y: 0, w: 960, h: 540 }]);
  try {
    h.stage.style.setProperty('--stage-reserve-left', '232px');
    h.stage.style.setProperty('--stage-reserve-bottom', '200px');
    const visW = STAGE_W - 232, visH = STAGE_H - 200;
    h.nav.focusRect(0, 0, 960, 540);   // the page's own on-screen rect, at Fit
    const on = h.unionOnScreen();
    assert.ok(near(on.x + on.w / 2, 232 + visW / 2, 0.5), 'clear of the navigator column');
    assert.ok(near(on.y + on.h / 2, visH / 2, 0.5), 'and above the docked timeline band');
  } finally { h.teardown(); }
});

test('a band bigger than the stage falls back to the whole stage rather than inverting', () => {
  // A phone with every panel open. An inverted box would make `want` negative or
  // infinite and every clamp below it fiction, so the reserves are simply ignored.
  const h = mount([{ x: 0, y: 0, w: 960, h: 540 }]);
  try {
    h.stage.style.setProperty('--stage-reserve-left', '900px');
    h.stage.style.setProperty('--stage-reserve-right', '900px');
    h.nav.fit();
    const want = FIT_MARGIN * Math.min(STAGE_W / 960, STAGE_H / 540);
    const { scale } = transformOf(h.outer);
    // Inside the dead zone, so nothing is applied - which is what the whole-stage
    // measurement has always done for a single artboard that IS the export frame.
    assert.ok(Math.abs(want - 1) <= 0.05 ? h.outer.style.transform === '' : near(scale, want));
    assert.ok(Number.isFinite(scale) && scale > 0, 'and never a nonsense scale');
  } finally { h.teardown(); }
});
