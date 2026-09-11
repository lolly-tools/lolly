// SPDX-License-Identifier: MPL-2.0
/**
 * motion-path - the keyframe path overlay, and above all its EXPORT CONTRACT.
 *
 * The feature is a polyline and one very hard constraint, exactly as onion skin is:
 * a path must never reach a rendered file. This file pins the same three independent
 * guarantees that module's test pins, deliberately in the same shape - independent on
 * purpose, so no single refactor can quietly remove all three:
 *
 *   (a) the layer is NOT a descendant of the canvas - it is outside the node
 *       `runtime.export` is handed;
 *   (b) it carries [data-export-hide], so bridge/export.ts's detachExportHidden
 *       REMOVES it from the DOM even if an export node were ever widened to the stage;
 *   (c) the module never writes a class or an inline style to a `.lolly-box`. Here
 *       that is STRUCTURAL - it is handed no canvas element at all - and a source scan
 *       plus a byte-identity probe both say so.
 *
 * Plus the two claims that make the overlay honest rather than decorative:
 *   • the points are the ENGINE's, mapped through the same `nativeToStage` the
 *     selection outline uses (`tests/timeline-math.test.ts` owns the projection
 *     parity against a moving camera; this file owns the DOM mapping);
 *   • the one ANIMATED affordance is gated on `prefersReducedMotion()` by NOT BEING
 *     MINTED - a DOM fact, not a CSS property jsdom cannot see.
 *
 * NOT covered here (browser-only): that the path LOOKS right - jsdom has no layout,
 * no `oklch()` and no SVG rendering, so the stroke weights, the dash flow and the
 * contrast branch are assertions about the stylesheet's text, made below.
 *
 * Run directly:  node --test shells/web/src/views/motion-path.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';
import type { TimeCfg } from './timeline-math.ts';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'SVGElement']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
// `prefersReducedMotion()` ORs the OS media query with the app pref. jsdom has no
// media engine, so the query is stubbed OFF and every reduced-motion test below drives
// the APP pref (the `html[data-a11y-motion]` attribute), which is the branch the shell
// actually owns.
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });

const { mountMotionPath, motionRuns } = await import('./motion-path.ts');

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'motion-path.ts'), 'utf8');
/** Comments STATE the contract (and quote the selectors it bans), so the scans below
 *  read the code alone - otherwise the module doc would fail its own test. */
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const CODE = stripComments(SOURCE);

/** free-canvas's own resolved field names, narrowed to what a path reads. */
const geom = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
};
const time: TimeCfg = {
  idField: 'id',
  startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
  enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
  muteField: 'mute', laneField: 'lane',
  kfField: 'kf', zField: 'z',
};

/** A stage/canvas offset and a zoom that are all distinct, so no term can hide. */
const METRICS = { cr: { left: 100, top: 50 }, sr: { left: 20, top: 10 }, scale: 0.5 };
const CANVAS = { w: 1000, h: 1000 };

/** native → stage, written out longhand so the test does not share the module's map. */
const sx = (nx: number): number => METRICS.cr.left - METRICS.sr.left + nx * METRICS.scale;
const sy = (ny: number): number => METRICS.cr.top - METRICS.sr.top + ny * METRICS.scale;

interface Fixture {
  overlay: HTMLElement;
  canvasEl: HTMLElement;
  layer(): HTMLElement;
  groups(): SVGElement[];
  lines(): SVGElement[];
  flows(): SVGElement[];
  keys(): SVGElement[];
  handle: ReturnType<typeof mountMotionPath>;
  boxSnapshot(): string[];
  teardown(): void;
}

/** A 200×100 box at (100, 100) - centre (200, 150) - on screen 0…1s. */
const moving = (extra: Record<string, unknown> = {}): Box => ({
  id: 'a', x: 100, y: 100, w: 200, h: 100, rot: 0,
  start: 0, dur: 1, clipIn: 0, speed: 1, lane: '',
  kf: 't0_x0*t1000_el_x100',
  ...extra,
} as Box);

function mount(boxes: Box[]): Fixture {
  const doc = dom.window.document;
  const stage = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  canvasEl.id = 'tool-canvas';
  const overlay = doc.createElement('div');
  overlay.className = 'fc-overlay';
  overlay.setAttribute('data-export-hide', '');
  // The real shape: the overlay is a SIBLING of the canvas, both children of the stage.
  stage.append(canvasEl, overlay);
  doc.body.appendChild(stage);

  for (const b of boxes) {
    const el = doc.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', String((b as Record<string, unknown>).id));
    el.style.left = '0px';                       // an authored inline style to protect
    canvasEl.appendChild(el);
  }

  const handle = mountMotionPath({
    overlayEl: overlay, geom, time,
    getBoxes: () => boxes,
    metricsOf: () => METRICS,
    canvasSize: () => CANVAS,
  });
  const q = (sel: string): SVGElement[] => [...overlay.querySelectorAll(sel)] as unknown as SVGElement[];
  return {
    overlay, canvasEl, handle,
    layer: () => overlay.querySelector('.mp-layer') as HTMLElement,
    groups: () => q('.mp-path'),
    lines: () => q('.mp-line'),
    flows: () => q('.mp-flow'),
    keys: () => q('.mp-key'),
    boxSnapshot: () => [...canvasEl.querySelectorAll('.lolly-box')]
      .map((el) => `${el.getAttribute('data-box-id')}|${el.className}|${(el as HTMLElement).style.cssText}`),
    teardown() {
      try { handle.destroy(); } catch { /* already gone */ }
      stage.remove();
      dom.window.document.documentElement.removeAttribute('data-a11y-motion');
    },
  };
}

const nums = (el: SVGElement): number[] =>
  (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);

// ── (a) + (b): where the layer lives ──────────────────────────────────────────

test('(a) the path layer is NOT inside the canvas - outside the node runtime.export sees', () => {
  const f = mount([moving()]);
  try {
    const layer = f.layer();
    assert.ok(layer, 'the layer mounted');
    assert.equal(f.canvasEl.contains(layer), false,
      'a descendant of #tool-canvas would be walked by every export path');
    assert.equal(layer.parentElement, f.overlay);
    assert.equal(f.overlay.firstElementChild, layer,
      'FIRST child: a path paints under the frame scrim and under all selection chrome');
  } finally { f.teardown(); }
});

test('(b) the layer carries [data-export-hide], so detachExportHidden removes it outright', () => {
  const f = mount([moving()]);
  try {
    const layer = f.layer();
    assert.ok(layer.hasAttribute('data-export-hide'));
    assert.equal(layer.getAttribute('aria-hidden'), 'true', 'decorative: never announced');
    // The exact query detachExportHidden runs, from the stage down.
    const stage = f.overlay.parentElement!;
    assert.ok([...stage.querySelectorAll('[data-export-hide]')].includes(layer));
  } finally { f.teardown(); }
});

// ── (c): the module never writes to a .lolly-box ──────────────────────────────

test('(c) source scan: the module is never handed the canvas, and writes only to nodes it minted', () => {
  for (const sink of ['classList.add(', 'classList.remove(', 'classList.toggle(']) {
    assert.equal(CODE.includes(sink), false, `motion-path.ts must never call ${sink}`);
  }
  // STRUCTURAL guarantee 3: there is no artboard in reach at all. The module takes an
  // overlay, a model getter and two measurement callbacks - no canvas element, no
  // artboard selector, no `document.querySelector` of any kind.
  assert.equal(/lolly-box/.test(CODE), false, 'the module must not know the artboard selector');
  assert.equal(/querySelector/.test(CODE), false, 'and must not reach into the document at all');
  // Every inline-style and attribute write must target a node this module MINTED.
  const MINTED = new Set(['layer', 'svg', 'g', 'line', 'flow', 'dot']);
  const writes = (re: RegExp): string[] => {
    const out: string[] = [];
    const r = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = r.exec(CODE))) out.push(m[1]!);
    return out;
  };
  for (const name of writes(/(\w+)\.style\./)) {
    assert.ok(MINTED.has(name), `${name}.style.* writes to a node this module did not create`);
  }
  for (const name of writes(/(\w+)\.setAttribute\(/)) {
    assert.ok(MINTED.has(name), `${name}.setAttribute() writes to a node this module did not create`);
  }
  // Non-vacuity: the scan must still be looking at the real module.
  assert.ok(CODE.includes('kfMotionPath('), 'the source still asks timeline-math for its numbers');
  assert.ok(CODE.includes('.setAttribute('), 'and the write scan still has writes to find');
});

test('export byte-identity: the artboard is not touched at all, so exports do not move', () => {
  const f = mount([moving(), moving({ id: 'b', x: 400 })]);
  try {
    const before = f.boxSnapshot();
    f.handle.paint(['a', 'b']);
    assert.ok(f.lines().length > 0, 'precondition: paths really were drawn');
    assert.deepEqual(f.boxSnapshot(), before,
      'not one class and not one inline style changed on any .lolly-box');
    f.handle.destroy();
    assert.deepEqual(f.boxSnapshot(), before, 'and teardown leaves the artboard alone too');
  } finally { f.teardown(); }
});

// ── geometry ──────────────────────────────────────────────────────────────────

test('the polyline is the model path through the injected metrics - the outline’s own map', () => {
  const f = mount([moving()]);
  try {
    f.handle.paint(['a']);
    const pts = nums(f.lines()[0]!);
    // With no camera the default projection is eff = 1 at z = 0, so the centre is
    // simply (200 + kf x, 150) in native px.
    assert.equal(pts[0], sx(200), 'first sample: the pose at t = 0');
    assert.equal(pts[1], sy(150));
    assert.equal(pts[pts.length - 2], sx(300), 'last sample lands exactly on the out-point');
    assert.equal(pts[pts.length - 1], sy(150));
    // Monotonic and dense: the whole move is traced, not just its ends.
    assert.ok(pts.length / 2 > 20, `a one-second move samples finely (got ${pts.length / 2})`);
    for (let i = 2; i < pts.length; i += 2) {
      assert.ok(pts[i]! >= pts[i - 2]!, 'x never goes backwards on a one-way move');
    }
  } finally { f.teardown(); }
});

test('a diamond is drawn at every keyframe inside the window, at the projected pose', () => {
  const f = mount([moving()]);
  try {
    f.handle.paint(['a']);
    const keys = f.keys();
    assert.equal(keys.length, 2, 'one mark per keyframe');
    // The diamond is a path around the point; its FIRST vertex is (cx, cy − r).
    const d0 = keys[0]!.getAttribute('d') || '';
    assert.ok(d0.startsWith(`M${sx(200)} ${sy(150) - 4.5}`), `unexpected first diamond: ${d0}`);
    const d1 = keys[1]!.getAttribute('d') || '';
    assert.ok(d1.startsWith(`M${sx(300)} ${sy(150) - 4.5}`), `unexpected last diamond: ${d1}`);
  } finally { f.teardown(); }
});

test('a keyframe authored PAST the out-point gets no mark - the path draws what plays', () => {
  const f = mount([moving({ kf: 't0_x0*t1000_el_x100*t4000_x300', dur: 1 })]);
  try {
    f.handle.paint(['a']);
    assert.equal(f.keys().length, 2, 'the 4 s diamond is outside a 1 s clip');
  } finally { f.teardown(); }
});

// ── what does NOT draw ────────────────────────────────────────────────────────

test('a box with no track, or one key, draws nothing at all', () => {
  for (const kf of ['', 't0_x40']) {
    const f = mount([moving({ kf })]);
    try {
      f.handle.paint(['a']);
      assert.equal(f.lines().length, 0, `no path for kf=${JSON.stringify(kf)}`);
      assert.equal(f.layer().hidden, true);
    } finally { f.teardown(); }
  }
});

test('a track that animates only OPACITY draws nothing - there is no travel to show', () => {
  const f = mount([moving({ kf: 't0_o1*t1000_el_o0' })]);
  try {
    f.handle.paint(['a']);
    assert.equal(f.lines().length, 0, 'a permanent dot on the canvas would say nothing');
    assert.equal(f.layer().hidden, true);
  } finally { f.teardown(); }
});

test('an UNSELECTED animated box is not drawn, and a selected CAMERA is skipped', () => {
  const camera = {
    id: 'cam', kind: 'camera', x: 0, y: 0, w: 0, h: 0, rot: 0,
    start: '', dur: '', clipIn: 0, speed: 1, lane: '',
    kf: 't0_x0*t4000_el_x-140',
  } as unknown as Box;
  const f = mount([moving(), camera]);
  try {
    f.handle.paint([]);
    assert.equal(f.lines().length, 0, 'nothing selected, nothing drawn');
    f.handle.paint(['cam']);
    assert.equal(f.lines().length, 0, 'a camera has no canvas footprint to trace (section 5.4)');
    f.handle.paint(['a']);
    assert.equal(f.groups().length, 1, 'and the ordinary box still draws');
    assert.equal(f.groups()[0]!.getAttribute('data-box-id'), 'a',
      'the id travels as data, never as an `id` that could capture references');
  } finally { f.teardown(); }
});

test('a tool with no `kf` field never draws - progressive capability, not a special case', () => {
  const doc = dom.window.document;
  const stage = doc.createElement('div');
  const overlay = doc.createElement('div');
  overlay.className = 'fc-overlay';
  stage.appendChild(overlay);
  doc.body.appendChild(stage);
  const boxes = [moving()];
  const h = mountMotionPath({
    overlayEl: overlay, geom, time: { ...time, kfField: '' },
    getBoxes: () => boxes, metricsOf: () => METRICS, canvasSize: () => CANVAS,
  });
  try {
    h.paint(['a']);
    assert.equal(overlay.querySelectorAll('.mp-line').length, 0);
  } finally { h.destroy(); stage.remove(); }
});

// ── the camera moves the path ─────────────────────────────────────────────────

test('a moving CAMERA bends the path - a flat one would lie about what the export does', () => {
  // The camera's window covers the whole clip (windows are half-open, so a `dur` of 1
  // would leave the box's LAST sample - at exactly t = 1000 - outside it and back on
  // the default camera, which is a real rule and a poor probe of this one).
  const camera = {
    id: 'cam', kind: 'camera', x: 0, y: 0, w: 0, h: 0, rot: 0,
    start: 0, dur: 4, clipIn: 0, speed: 1, lane: '',
    kf: 't0_x0*t1000_el_x200',
  } as unknown as Box;
  const flat = mount([moving()]);
  let flatPts: number[];
  try { flat.handle.paint(['a']); flatPts = nums(flat.lines()[0]!); } finally { flat.teardown(); }

  const panned = mount([moving(), camera]);
  try {
    panned.handle.paint(['a']);
    const pts = nums(panned.lines()[0]!);
    assert.equal(pts[0], flatPts[0], 'both start where the camera is still at 0');
    assert.notEqual(pts[pts.length - 2], flatPts[flatPts.length - 2],
      'and diverge as the camera pans - section 6.5: a path must be projected or it lies');
    // camX = +200 subtracts from the projected centre at eff = 1: 300 − 200 = 100.
    assert.equal(pts[pts.length - 2], sx(100));
  } finally { panned.teardown(); }
});

// ── the behind-camera break ───────────────────────────────────────────────────

test('motionRuns breaks the polyline where the layer is behind the camera', () => {
  const on = { x: 0, y: 0, a: 1 };
  assert.deepEqual(motionRuns([on, on, { x: 1, y: 1, a: 0 }, on, on]).map((r) => r.length), [2, 2],
    'two strokes, never one straight line across travel that never happens');
  assert.deepEqual(motionRuns([on, { x: 1, y: 1, a: 0 }, on]).map((r) => r.length), [],
    'a run of one sample has nowhere to go');
  assert.deepEqual(motionRuns([on, on, on]).map((r) => r.length), [3], 'no guard, one stroke');
  assert.deepEqual(motionRuns([{ x: 0, y: 0 }, { x: 1, y: 1 }]).map((r) => r.length), [2],
    'an absent ramp reads as on screen (no camera involved)');
  assert.deepEqual(motionRuns(null), []);
});

// ── reduced motion ────────────────────────────────────────────────────────────

test('reduced motion: the flow stroke is NOT MINTED, and the layer says so', () => {
  const f = mount([moving()]);
  const html = dom.window.document.documentElement;
  try {
    f.handle.paint(['a']);
    assert.equal(f.flows().length, 1, 'premise: the direction cue exists by default');
    assert.equal(f.layer().getAttribute('data-motion'), 'flow');

    html.setAttribute('data-a11y-motion', 'reduce');
    f.handle.paint(['a']);
    assert.equal(f.flows().length, 0,
      'the one ANIMATED affordance is gone - omitted, not merely styled away');
    assert.equal(f.lines().length, 1, 'the PATH itself stays: geometry is information');
    assert.equal(f.layer().getAttribute('data-motion'), 'still');

    html.removeAttribute('data-a11y-motion');
    f.handle.paint(['a']);
    assert.equal(f.flows().length, 1, 'and it comes back - a gate, not a latch');
  } finally { html.removeAttribute('data-a11y-motion'); f.teardown(); }
});

// ── lifecycle ─────────────────────────────────────────────────────────────────

test('painting nothing hides the layer without tearing it down, and destroy() removes it', () => {
  const f = mount([moving()]);
  try {
    f.handle.paint(['a']);
    assert.equal(f.layer().hidden, false);
    f.handle.paint([]);
    assert.equal(f.layer().hidden, true, 'a suppression, not a latch');
    assert.equal(f.lines().length, 0);
    f.handle.paint(['a']);
    assert.equal(f.layer().hidden, false);
    f.handle.destroy();
    assert.equal(f.overlay.querySelector('.mp-layer'), null);
    f.handle.paint(['a']);                 // inert
    f.handle.destroy();                    // idempotent
    assert.equal(f.overlay.querySelector('.mp-layer'), null);
  } finally { f.teardown(); }
});

// ── the stylesheet's own contract ─────────────────────────────────────────────

test('motion-path.css: layered, pointer-transparent, and the flow has both a11y gates', () => {
  // Comments again state what the sheet must NOT do (and name `[hidden]` to explain
  // why it is absent), so the scans read the rules alone.
  const css = readFileSync(join(HERE, '..', 'styles', 'parts', 'motion-path.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(css, /@layer views \{/, 'a lazy sheet must declare its layer, not rely on load order');
  assert.match(css, /\.mp-layer \{[^}]*pointer-events:\s*none/,
    'belt and braces over .fc-overlay - a path must never be hit-testable');
  // The PATH is solid: in this design language a dashed line is a drop area, and the
  // resting state of the overlay must not borrow that meaning.
  assert.equal(/\.mp-line \{[^}]*stroke-dasharray/.test(css), false,
    'the path itself must stay solid - only the additive flow stroke may dash');
  assert.equal(/border[^:]*:\s*[^;]*dashed/.test(css), false,
    'dashed borders are reserved for drop areas throughout this shell');
  // Both belt-and-braces gates on the one animated thing, beside the OS block each
  // extends - the module's own `prefersReducedMotion()` is the third.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.mp-flow/);
  assert.match(css, /html\[data-a11y-motion="reduce"\] \.mp-flow/);
  assert.match(css, /html\[data-a11y-contrast="high"\] \.mp-layer/);
  // No per-component `[hidden]` restatement: parts/a11y.css owns that app-wide, which
  // is what styles/hidden-attribute-guard.test.ts exists to keep true.
  assert.equal(/\[hidden\]/.test(css), false, 'do not re-patch [hidden] per component');
  // Chrome type rides the a11y multiplier; the stroke is GEOMETRY and must not.
  assert.equal(/stroke-width:\s*calc\([^)]*--a11y-fs/.test(css), false);
});
