// SPDX-License-Identifier: MPL-2.0
/**
 * The canvas editor's PEN TOOL (Stage D) - drawing, node editing, and the spline-kind
 * switcher.
 *
 * Two halves, in one file because they are two views of the same claim. The pure half
 * drives free-canvas-pen.ts directly and checks the geometric promises (an insert lands on
 * the curve, `enforceContinuity` really is applied, a kind switch is lossless in one
 * direction and lossy in the other). The wired half mounts the real `initFreeCanvas` against
 * a jsdom stage and an in-memory runtime that echoes `setInput` back through `getModel` - a
 * real round trip, not a stubbed answer - and checks the overlay's contract: one commit per
 * user action, one undo step per drawn path, no commit at all when a draw is abandoned, and
 * chrome that is repositioned rather than rebuilt.
 *
 * Expected geometry is re-derived from the ENGINE (`solveHyperbezier` /
 * `hyperbezierCubics` / `pathBounds` / `evalCubic`), never read back out of the module under
 * test.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-pen.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  type AuthoredPath, type Cubic, type SplineNode,
  decodeAuthoredPath, decodeAuthoredPaths, encodeAuthoredPath, encodeAuthoredPaths, evalCubic,
  hyperbezierCubics, pathBounds, solveHyperbezier, toCubics,
} from '@lolly/engine';
import type { Box } from './free-canvas-math.ts';
import { initFreeCanvas } from './free-canvas.ts';
import {
  PEN_DEFAULT_KIND, PEN_KINDS, alignNodes, alignPoints, convertKind, deleteNodes, denormNodes,
  distributeNodes, distributePoints, dragHandle, insertNodeOnCurve, kindSwitchIsLossy, lowerAuthored,
  normNodes, penCommitFromNative, refitFrame,
} from './free-canvas-pen.ts';

// ── jsdom bootstrap (same shape as free-canvas-vector.test.ts) ─────────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
for (const k of ['window', 'document', 'HTMLElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
const rafQueue: Array<() => void> = [];
(globalThis as Record<string, unknown>).requestAnimationFrame = (fn: FrameRequestCallback): number => {
  rafQueue.push(() => fn(0));
  return rafQueue.length;
};
(globalThis as Record<string, unknown>).cancelAnimationFrame = (): void => {};
/** Run every frame the overlay has scheduled (chrome syncs are rAF-coalesced). */
function frames(n = 3): void {
  for (let i = 0; i < n; i++) {
    const pending = rafQueue.splice(0, rafQueue.length);
    for (const fn of pending) fn();
  }
}
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

function pointerEvent(
  type: string,
  o: { x: number; y: number; id?: number; pointerType?: string; time?: number; alt?: boolean; shift?: boolean },
): MouseEvent {
  const e = new W.MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: o.x, clientY: o.y, button: 0,
    altKey: !!o.alt, shiftKey: !!o.shift,
  });
  Object.defineProperty(e, 'pointerId', { value: o.id ?? 1 });
  Object.defineProperty(e, 'pointerType', { value: o.pointerType ?? 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: o.time ?? 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

// ── fixture ───────────────────────────────────────────────────────────────────

const NATIVE = 1000;

/** Design's `canvas` block as shipped, plus the `path` add-kind's seed so the pen's
 *  committed box inherits the same paint the Add menu would give it. */
function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', groupField: 'group', clipField: 'clip',
    pathField: 'path',
    addKinds: [
      { id: 'box', label: 'Box', seed: {} },
      { id: 'path', label: 'Path', seed: { kind: 'path', shape: 'rect', bg: '', stroke: '#0e1217', strokeW: 4, fillRule: 'nonzero' } },
    ],
  };
}

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  commits: () => number;
  undo(): void;
  destroy(): void;
}

function mount(initial: Box[]): Fixture {
  const viewEl = dom.window.document.createElement('div');
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  dom.window.document.body.appendChild(viewEl);
  canvasEl.style.width = NATIVE + 'px';
  canvasEl.style.height = NATIVE + 'px';
  // 1 screen px per native px, origin at the client origin - client coordinates ARE canvas
  // coordinates, so a test's numbers read as the geometry they mean.
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  const model = new Map<string, unknown>([['boxes', initial]]);
  const history: Array<[string, unknown]> = [];
  let commits = 0;
  const subs: Array<() => void> = [];
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) {
      history.push([id, model.get(id)]);
      model.set(id, value);
      commits++;
      for (const s of subs) s();
    },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: canvasCfg() as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  frames();
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    commits: () => commits,
    undo() { const last = history.pop(); if (last) model.set(last[0], last[1]); },
    destroy() { handle.destroy(); viewEl.remove(); },
  };
}

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
const key = (k: string, mods: { meta?: boolean } = {}): void => {
  dom.window.dispatchEvent(new W.KeyboardEvent('keydown', { key: k, bubbles: true, metaKey: !!mods.meta }));
};

/** Arm the pen from its rail button. */
function armPen(f: Fixture): void {
  const btn = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-pen');
  assert.ok(btn, 'the pen rail button exists when the manifest declares pathField');
  click(btn!);
  frames();
}

/** Place one node: down, optional drag (the handle pull), up. */
function place(
  f: Fixture,
  x: number, y: number,
  o: { drag?: [number, number]; alt?: boolean; pointerType?: string; id?: number } = {},
): void {
  const id = o.id ?? 1;
  const pt = o.pointerType ?? 'mouse';
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x, y, id, pointerType: pt, alt: o.alt }));
  if (o.drag) f.canvasEl.dispatchEvent(pointerEvent('pointermove', { x: o.drag[0], y: o.drag[1], id, pointerType: pt }));
  const end = o.drag ?? [x, y];
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: end[0], y: end[1], id, pointerType: pt }));
}

/** A whole drag on the canvas: down at a, move to b, up at b. */
function drag(f: Fixture, a: [number, number], b: [number, number], o: { shift?: boolean; alt?: boolean } = {}): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x: a[0], y: a[1], shift: o.shift, alt: o.alt }));
  f.canvasEl.dispatchEvent(pointerEvent('pointermove', { x: b[0], y: b[1], alt: o.alt }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: b[0], y: b[1], alt: o.alt }));
  frames();
}

const selectBox = (f: Fixture, x: number, y: number): void => { place(f, x, y); frames(); };
const dblClick = (f: Fixture, x: number, y: number): void => {
  f.canvasEl.dispatchEvent(new W.MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  frames();
};
const pathBoxes = (f: Fixture): Box[] => f.boxes().filter((b) => b.kind === 'path');
const decoded = (b: Box): AuthoredPath => {
  const p = decodeAuthoredPath(String(b.path));
  assert.ok(p, 'the committed path field decodes with the ENGINE codec, i.e. the one hooks.js reads');
  return p!;
};
/** Every contour in the field. A boolean result is several, and node editing has to keep the
 *  ones it is not editing (see `decodePathContours`). */
const decodedAll = (b: Box): AuthoredPath[] => {
  const ps = decodeAuthoredPaths(String(b.path));
  assert.ok(Array.isArray(ps) && ps.length, 'the committed path field decodes to at least one contour');
  return ps;
};

/** A box's frame AS THE RENDERER READS IT - `boxCss`/`penFrame`'s rounding, re-stated here
 *  rather than imported, so a refit test is not checking the module against itself. */
interface TFrame { x: number; y: number; w: number; h: number; rot: number }
const frameOf = (b: Box): TFrame => ({
  x: Math.round(Number(b.x ?? 0)),
  y: Math.round(Number(b.y ?? 0)),
  w: Math.max(1, Math.round(Number(b.w ?? 1))),
  h: Math.max(1, Math.round(Number(b.h ?? 1))),
  rot: Math.round(Number(b.rot ?? 0) * 10) / 10,
});

/** Box-local px → native px: rotate about the frame's own centre, then offset. Independently
 *  written (this is `transform: rotate()` with the default 50%/50% origin), because it is the
 *  oracle every "the shape did not move" assertion is measured against. */
function toNative(fr: TFrame, x: number, y: number): { x: number; y: number } {
  const r = (fr.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const cx = fr.w / 2, cy = fr.h / 2, dx = x - cx, dy = y - cy;
  return { x: fr.x + cx + dx * c - dy * s, y: fr.y + cy + dx * s + dy * c };
}

/** The lowered curve of every contour, in BOX-LOCAL px. */
function localCubics(b: Box): Cubic[] {
  const fr = frameOf(b);
  return decodedAll(b).flatMap((p) => lowerAuthored(denormNodes(p, fr.w, fr.h)).cubics);
}

/** The whole shape sampled in NATIVE canvas px - decode → denormalise → lower → place. This
 *  is the only space in which "the shape did not move" is a meaningful claim, since a refit
 *  changes every one of x/y/w/h and every stored fraction at once. */
function nativeSamples(b: Box, per = 24): Array<{ x: number; y: number }> {
  const fr = frameOf(b);
  return localCubics(b).flatMap((c) => samples([c], per).map((p) => toNative(fr, p.x, p.y)));
}

/** The tight bbox of the lowered curve, in box-local px. */
function localBounds(b: Box): { x0: number; y0: number; x1: number; y1: number } {
  const bb = pathBounds([{ curves: localCubics(b), closed: false }]);
  assert.ok(bb, 'the box has a lowerable curve');
  return bb!;
}

/**
 * THE INVARIANT: the frame equals the curve's tight bounding box.
 *
 * To within 1.05px, and that bound is arithmetic rather than taste: `boxCss` rounds `x`/`y`
 * (≤0.5px) and rounds `w`/`h` (≤0.5px more on the far edge), and the wire format's six
 * decimals of a fraction add ~1e-3px on a 1000px frame. Anything larger is a real clip (the
 * curve outside the frame) or real slack (chrome addressing empty space).
 */
function assertTightFrame(b: Box, why = ''): void {
  const fr = frameOf(b);
  const bb = localBounds(b);
  const T = 1.05;
  assert.ok(Math.abs(bb.x0) <= T, `${why}: frame's left edge is not the curve's (local x0 ${bb.x0})`);
  assert.ok(Math.abs(bb.y0) <= T, `${why}: frame's top edge is not the curve's (local y0 ${bb.y0})`);
  assert.ok(Math.abs(bb.x1 - fr.w) <= T, `${why}: frame's right edge is not the curve's (local x1 ${bb.x1} vs w ${fr.w})`);
  assert.ok(Math.abs(bb.y1 - fr.h) <= T, `${why}: frame's bottom edge is not the curve's (local y1 ${bb.y1} vs h ${fr.h})`);
}

/** Every node's position in NATIVE px, in node order. */
function nativeNodes(b: Box): Array<{ x: number; y: number }> {
  const fr = frameOf(b);
  return denormNodes(decodedAll(b)[0]!, fr.w, fr.h).nodes.map((n) => toNative(fr, n.x, n.y));
}

/** One contour's node positions in NATIVE px. */
function contourNodes(b: Box, ci: number): Array<{ x: number; y: number }> {
  const fr = frameOf(b);
  return denormNodes(decodedAll(b)[ci]!, fr.w, fr.h).nodes.map((n) => toNative(fr, n.x, n.y));
}

/** Every HANDLE tip in NATIVE px, for the contour being edited - `undefined` where a node has
 *  none on that side (the codec drops a zero component). */
function nativeHandle(b: Box, i: number, which: 'in' | 'out'): { x: number; y: number } | null {
  const fr = frameOf(b);
  const n = denormNodes(decodedAll(b)[0]!, fr.w, fr.h).nodes[i]!;
  const dx = which === 'in' ? n.hInX : n.hOutX;
  const dy = which === 'in' ? n.hInY : n.hOutY;
  if (dx === undefined && dy === undefined) return null;
  return toNative(fr, n.x + (dx ?? 0), n.y + (dy ?? 0));
}

function assertClose(a: { x: number; y: number }, b: { x: number; y: number }, tol: number, why: string): void {
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= tol,
    `${why}: (${a.x}, ${a.y}) vs (${b.x}, ${b.y}), off by ${Math.hypot(a.x - b.x, a.y - b.y)} > ${tol}`);
}

/** Nothing anywhere in the payload or the frame is a non-number. The specific failure a
 *  refit against a ZERO-extent axis would produce. */
function assertNoNaN(b: Box, why = ''): void {
  const fr = frameOf(b);
  for (const [k, v] of Object.entries(fr)) assert.ok(Number.isFinite(v), `${why}: frame.${k} is ${v}`);
  assert.ok(!/NaN|Infinity|undefined/.test(String(b.path)), `${why}: the path field carries ${String(b.path)}`);
  for (const p of decodedAll(b)) {
    for (const n of p.nodes) {
      for (const [k, v] of Object.entries(n)) {
        if (typeof v === 'number') assert.ok(Number.isFinite(v), `${why}: node ${k} is ${v}`);
      }
    }
  }
}

const flashText = (f: Fixture): string => {
  const el = f.stageEl.querySelector<HTMLElement>('.fc-flash');
  return el && !el.hidden ? (el.textContent || '') : '';
};
const penNodeEls = (f: Fixture): HTMLElement[] =>
  [...f.stageEl.querySelectorAll<HTMLElement>('.fc-pen-chrome .fc-pen-node')];
const penNodEls = (f: Fixture): number => penNodeEls(f).length;

// The three points every drawing test places. Chosen clear of 0 / 500 / 1000 on both axes,
// because a pen click snaps to the artboard edges and centre exactly as an armed create
// does - within SNAP_PX (6 native px here) the placed node would not be where we clicked.
const P: Array<[number, number]> = [[200, 200], [400, 300], [300, 450]];

/** The frame + normalised nodes those three points MUST produce, worked out from the engine
 *  rather than from free-canvas-pen. */
function expectedTriangle(closed: boolean): { x: number; y: number; w: number; h: number; nodes: Array<{ x: number; y: number }> } {
  const nodes: SplineNode[] = P.map(([x, y]) => ({ x, y, continuity: 'smooth' }));
  const sol = solveHyperbezier(nodes, closed);
  const cubics = hyperbezierCubics(nodes, closed, sol);
  const bb = pathBounds([{ curves: cubics, closed }])!;
  const x = Math.round(bb.x0), y = Math.round(bb.y0);
  const w = Math.max(1, Math.round(bb.x1 - bb.x0));
  const h = Math.max(1, Math.round(bb.y1 - bb.y0));
  return { x, y, w, h, nodes: P.map(([px, py]) => ({ x: (px - x) / w, y: (py - y) / h })) };
}

/** Sample a lowered path at a fixed parameterisation - an order-independent shape probe
 *  that does not go anywhere near a `d` string. */
function samples(cubics: Cubic[], per = 12): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (const c of cubics) for (let i = 0; i <= per; i++) out.push(evalCubic(c, i / per));
  return out;
}

/** A handle component AS DECODED. The wire format writes a zero component as "absent" (so a
 *  node with no handle round-trips as one), which means `hOutY` is `undefined` rather than 0
 *  for a horizontal handle - reading it raw gives NaN out of `Math.hypot`. */
const hv = (n: SplineNode, k: 'hInX' | 'hInY' | 'hOutX' | 'hOutY'): number => n[k] ?? 0;
const hLen = (n: SplineNode, which: 'in' | 'out'): number =>
  (which === 'in' ? Math.hypot(hv(n, 'hInX'), hv(n, 'hInY')) : Math.hypot(hv(n, 'hOutX'), hv(n, 'hOutY')));
/** sin of the angle between a node's two handles - the scale-free collinearity measure. The
 *  raw cross product is not usable against a stored path: the codec rounds each coordinate
 *  to six decimals of a FRACTION of the frame, so an exactly-collinear pair comes back a
 *  little bent, by an amount that depends on how long the handles are. */
function handleSin(n: SplineNode): number {
  const cross = hv(n, 'hOutX') * hv(n, 'hInY') - hv(n, 'hOutY') * hv(n, 'hInX');
  const denom = hLen(n, 'in') * hLen(n, 'out');
  return denom > 0 ? Math.abs(cross) / denom : 0;
}
const handleDot = (n: SplineNode): number => hv(n, 'hOutX') * hv(n, 'hInX') + hv(n, 'hOutY') * hv(n, 'hInY');

/** The greatest distance from each point of `a` to the nearest sample of `b`. */
function maxDeviation(a: Array<{ x: number; y: number }>, b: Array<{ x: number; y: number }>): number {
  let worst = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    worst = Math.max(worst, best);
  }
  return worst;
}

// ══ pure: free-canvas-pen.ts ══════════════════════════════════════════════════

// ── choosing the spline type BEFORE drawing ───────────────────────────────────
//
// The pen bar's switcher only exists once there is a draft, so the type used to be
// something you discovered after drawing in the wrong one - and only `hyperbezier → cubic`
// converts losslessly. Press-and-hold (or right-click) the rail button instead.

const penBtn = (f: Fixture): HTMLButtonElement =>
  f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-pen')!;
const popItems = (f: Fixture): HTMLButtonElement[] =>
  [...f.stageEl.querySelectorAll<HTMLButtonElement>('.fc-popover .fc-pop-item')];

test('right-clicking the pen button offers every spline type, marking the current one', () => {
  const f = mount([]);
  penBtn(f).dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  frames();
  const items = popItems(f);
  assert.equal(items.length, PEN_KINDS.length, 'one row per kind the engine can lower');
  const checked = items.filter((b) => b.getAttribute('aria-checked') === 'true');
  assert.equal(checked.length, 1, 'exactly one is current');
  assert.match(checked[0]!.textContent || '', /smooth/i, 'and it is the hyperbezier default');
  assert.equal(items.every((b) => b.getAttribute('role') === 'menuitemradio'), true,
    'they are radios, not commands');
  f.destroy();
});

test('choosing a spline type arms the pen and the next path is drawn in it', () => {
  const f = mount([]);
  assert.equal(f.stageEl.classList.contains('fc-penning'), false, 'the pen is not armed yet');
  penBtn(f).dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  frames();
  const straight = popItems(f).find((b) => /straight/i.test(b.textContent || ''));
  assert.ok(straight, 'Straight lines is on the menu');
  click(straight!);
  frames();
  assert.equal(f.stageEl.classList.contains('fc-penning'), true, 'the menu left the pen armed');
  place(f, 200, 200);
  frames();
  place(f, 400, 300);
  frames();
  place(f, 600, 200);
  frames();
  key('Enter');
  frames();
  assert.equal(decoded(pathBoxes(f)[0]!).kind, 'line', 'drawn in the type chosen up front');
  f.destroy();
});

test('a press-and-HOLD opens the same menu, and the click that ends it does not toggle the pen', async () => {
  const f = mount([]);
  const b = penBtn(f);
  b.dispatchEvent(pointerEvent('pointerdown', { x: 20, y: 200 }));
  await new Promise((r) => setTimeout(r, 500));          // past HOLD_MS
  frames();
  assert.equal(popItems(f).length, PEN_KINDS.length, 'the hold opened the type menu');
  // The real pointerup delivers a click; it must be eaten, or the pen toggles behind the menu.
  b.dispatchEvent(pointerEvent('pointerup', { x: 20, y: 200 }));
  click(b);
  frames();
  assert.equal(f.stageEl.classList.contains('fc-penning'), false, 'the hold did not also arm the pen');
  f.destroy();
});

test('a press that TRAVELS is a drag, not a hold, so no menu opens', async () => {
  const f = mount([]);
  const b = penBtn(f);
  b.dispatchEvent(pointerEvent('pointerdown', { x: 20, y: 200 }));
  b.dispatchEvent(pointerEvent('pointermove', { x: 20, y: 240 }));   // past HOLD_SLOP
  await new Promise((r) => setTimeout(r, 500));
  frames();
  assert.equal(popItems(f).length, 0, 'no menu');
  f.destroy();
});

test('the default kind is hyperbezier, and spiro is now offered (a real Euler-spiral solver)', () => {
  assert.equal(PEN_DEFAULT_KIND, 'hyperbezier');
  assert.equal(PEN_KINDS[0], 'hyperbezier', 'and it leads the switcher');
  // Spiro is implemented (engine/src/geom/spiro.ts) and now in the switcher, second.
  assert.ok(PEN_KINDS.includes('spiro' as never), 'spiro lowers to real cubics, so it is offered');
});

test('penCommitFromNative frames the LOWERED curve, not the node polygon', () => {
  const drawn: AuthoredPath = { kind: 'hyperbezier', closed: true, nodes: P.map(([x, y]) => ({ x, y, continuity: 'smooth' })) };
  const made = penCommitFromNative(drawn);
  assert.ok(made);
  const want = expectedTriangle(true);
  assert.equal(made!.x, want.x);
  assert.equal(made!.y, want.y);
  assert.equal(made!.w, want.w);
  assert.equal(made!.h, want.h);
  // A hyperbezier's control arms overshoot the polygon, so the frame is genuinely bigger
  // than the points' own bounding box - the property a naive implementation gets wrong and
  // then clips the curve in `hooks.js`.
  const polyW = Math.max(...P.map((p) => p[0])) - Math.min(...P.map((p) => p[0]));
  assert.ok(made!.w > polyW, `frame width ${made!.w} exceeds the polygon's ${polyW}`);
  // Re-denormalising must land back on the points we drew.
  const back = denormNodes(made!.path, made!.w, made!.h);
  back.nodes.forEach((n, i) => {
    assert.ok(Math.abs(n.x + made!.x - P[i]![0]) < 1e-6);
    assert.ok(Math.abs(n.y + made!.y - P[i]![1]) < 1e-6);
  });
});

test('penCommitFromNative refuses a one-node draft (it is not a path)', () => {
  assert.equal(penCommitFromNative({ kind: 'hyperbezier', closed: false, nodes: [{ x: 10, y: 10 }] }), null);
});

test('a handle drag on a smooth node keeps the handles collinear, lengths independent', () => {
  const p: AuthoredPath = {
    kind: 'cubic', closed: false,
    nodes: [
      { x: 0, y: 100 },
      { x: 100, y: 0, hInX: -40, hInY: 0, hOutX: 20, hOutY: 0, continuity: 'smooth' },
      { x: 200, y: 100 },
    ],
  };
  const next = dragHandle(p, 1, 'out', 100 + 30, 0 + 40).nodes[1]!;
  assert.equal(next.hOutX, 30);
  assert.equal(next.hOutY, 40);
  // Collinear and opposed: the cross product vanishes and the dot product is negative.
  assert.ok(Math.abs(next.hOutX! * next.hInY! - next.hOutY! * next.hInX!) < 1e-9, 'collinear');
  assert.ok(next.hOutX! * next.hInX! + next.hOutY! * next.hInY! < 0, 'opposed');
  // Length preserved at 40 - 'smooth' constrains direction only.
  assert.ok(Math.abs(Math.hypot(next.hInX!, next.hInY!) - 40) < 1e-9, 'the incoming length is untouched');
});

test('a handle drag on a symmetric node mirrors the length too', () => {
  const p: AuthoredPath = {
    kind: 'cubic', closed: false,
    nodes: [
      { x: 0, y: 100 },
      { x: 100, y: 0, hInX: -40, hInY: 0, hOutX: 20, hOutY: 0, continuity: 'symmetric' },
      { x: 200, y: 100 },
    ],
  };
  const next = dragHandle(p, 1, 'out', 130, 40).nodes[1]!;
  assert.ok(Math.abs(next.hOutX! * next.hInY! - next.hOutY! * next.hInX!) < 1e-9, 'collinear');
  assert.ok(Math.abs(Math.hypot(next.hInX!, next.hInY!) - Math.hypot(next.hOutX!, next.hOutY!)) < 1e-9, 'equal length');
  assert.ok(Math.abs(next.hInX! + 30) < 1e-9 && Math.abs(next.hInY! + 40) < 1e-9, 'and it is the exact mirror');
});

test('a handle drag on a corner node leaves the other handle alone', () => {
  const p: AuthoredPath = {
    kind: 'cubic', closed: false,
    nodes: [
      { x: 0, y: 100 },
      { x: 100, y: 0, hInX: -40, hInY: 7, hOutX: 20, hOutY: 0, continuity: 'corner' },
      { x: 200, y: 100 },
    ],
  };
  const next = dragHandle(p, 1, 'out', 130, 40).nodes[1]!;
  assert.equal(next.hInX, -40);
  assert.equal(next.hInY, 7);
  assert.equal(next.hOutX, 30);
});

test('inserting a node on a cubic is EXACT - on the curve, and the shape does not move', () => {
  const p: AuthoredPath = {
    kind: 'cubic', closed: false,
    nodes: [
      { x: 0, y: 0, hOutX: 60, hOutY: -120, continuity: 'corner' },
      { x: 200, y: 0, hInX: -60, hInY: -120, continuity: 'corner' },
    ],
  };
  const before = lowerAuthored(p).cubics;
  // A point well off the curve: the insert has to project onto it, not sit where we clicked.
  const res = insertNodeOnCurve(p, 100, -40);
  assert.ok(res);
  assert.equal(res!.index, 1);
  assert.equal(res!.path.nodes.length, 3);

  const mid = res!.path.nodes[1]!;
  // The inserted node IS on the original curve.
  const dev = maxDeviation([{ x: mid.x, y: mid.y }], samples(before, 400));
  assert.ok(dev < 1e-6, `inserted node is on the path (deviation ${dev})`);

  // And the shape is the same curve, split - de Casteljau, so this is exact.
  const after = lowerAuthored(res!.path).cubics;
  assert.equal(after.length, 2);
  const both = maxDeviation(samples(after, 40), samples(before, 800));
  assert.ok(both < 1e-9, `shape unchanged (deviation ${both})`);
  const backwards = maxDeviation(samples(before, 40), samples(after, 800));
  assert.ok(backwards < 1e-9, `and nothing was lost from it (deviation ${backwards})`);
});

test('inserting a node on a hyperbezier lands on the curve; the shape only shifts slightly', () => {
  const p: AuthoredPath = {
    kind: 'hyperbezier', closed: true,
    nodes: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
  };
  const before = lowerAuthored(p).cubics;
  const target = evalCubic(before[0]!, 0.5);
  const res = insertNodeOnCurve(p, target.x, target.y - 30);
  assert.ok(res);
  assert.equal(res!.path.nodes.length, 5);
  const mid = res!.path.nodes[1]!;
  assert.ok(maxDeviation([{ x: mid.x, y: mid.y }], samples(before, 600)) < 1e-6, 'the node is on the old curve');
  // The solve re-runs with one more knot, so the curve moves - but by a fraction of the
  // shape, not by a redraw. 200 units across, so 4 units is 2%.
  const dev = maxDeviation(samples(res!.path && lowerAuthored(res!.path).cubics, 30), samples(before, 600));
  assert.ok(dev < 4, `the shape is essentially unchanged (deviation ${dev})`);
});

test('hyperbezier → cubic is lossless; cubic → hyperbezier is the lossy direction', () => {
  const hb: AuthoredPath = {
    kind: 'hyperbezier', closed: true,
    nodes: [{ x: 0, y: 0 }, { x: 200, y: 20 }, { x: 180, y: 190 }, { x: 20, y: 170 }],
  };
  assert.equal(kindSwitchIsLossy(hb, 'cubic'), false);
  const toCubic = convertKind(hb, 'cubic');
  assert.equal(toCubic.path.kind, 'cubic');
  // Baked, so the shape survives the switch exactly.
  const dev = maxDeviation(samples(toCubics(toCubic.path), 24), samples(lowerAuthored(hb).cubics, 600));
  assert.ok(dev < 1e-9, `the baked cubic is the same curve (deviation ${dev})`);
  assert.ok(toCubic.path.nodes.every((n) => n.hOutX !== undefined && n.hInX !== undefined), 'every node got real handles');

  // ...and back. Going the other way DROPS them, which is the warning the UI has to show.
  assert.equal(kindSwitchIsLossy(toCubic.path, 'hyperbezier'), true);
  const back = convertKind(toCubic.path, 'hyperbezier');
  assert.equal(back.lossy, true);
  assert.ok(back.path.nodes.every((n) => n.hOutX === undefined && n.hInX === undefined), 'the handles are gone');
  // Round trip: the nodes never moved, so this is the path we started with.
  assert.deepEqual(back.path.nodes.map((n) => [n.x, n.y]), hb.nodes.map((n) => [n.x, n.y]));
  const round = maxDeviation(samples(lowerAuthored(back.path).cubics, 24), samples(lowerAuthored(hb).cubics, 600));
  assert.ok(round < 1e-9, `hyperbezier → cubic → hyperbezier is the identity (deviation ${round})`);
});

test('switching to a kind that ignores handles is only lossy when there ARE handles', () => {
  const bare: AuthoredPath = { kind: 'cubic', closed: false, nodes: [{ x: 0, y: 0 }, { x: 10, y: 10 }] };
  assert.equal(kindSwitchIsLossy(bare, 'hyperbezier'), false, 'nothing to lose');
  const withH: AuthoredPath = { kind: 'cubic', closed: false, nodes: [{ x: 0, y: 0, hOutX: 5, hOutY: 0 }, { x: 10, y: 10 }] };
  assert.equal(kindSwitchIsLossy(withH, 'line'), true);
});

// ══ wired: drawing ════════════════════════════════════════════════════════════

test('drawing three nodes and closing commits exactly ONE setInput, as one path box', () => {
  const f = mount([]);
  armPen(f);
  const before = f.commits();
  for (const [x, y] of P) { place(f, x, y); frames(); }
  assert.equal(f.commits(), before, 'placing nodes commits nothing - the draft is not in the model');
  place(f, P[0]![0], P[0]![1]);                 // clicking the first node closes the path
  frames();
  assert.equal(f.commits() - before, 1, 'exactly one setInput for the whole drawing');

  const boxes = pathBoxes(f);
  assert.equal(boxes.length, 1);
  const box = boxes[0]!;
  const want = expectedTriangle(true);
  assert.equal(box.x, want.x);
  assert.equal(box.y, want.y);
  assert.equal(box.w, want.w);
  assert.equal(box.h, want.h);
  assert.equal(box.rot, 0);
  assert.equal(box.shape, 'rect', 'pinned, so a stale radius cannot clip the path');
  assert.equal(box.stroke, '#0e1217', "the path add-kind's paint is inherited");

  const p = decoded(box);
  assert.equal(p.kind, 'hyperbezier', 'a new path defaults to hyperbezier');
  assert.equal(p.closed, true);
  assert.equal(p.nodes.length, 3);
  p.nodes.forEach((n, i) => {
    assert.ok(Math.abs(n.x - want.nodes[i]!.x) < 2e-6, `node ${i} x ${n.x} vs ${want.nodes[i]!.x}`);
    assert.ok(Math.abs(n.y - want.nodes[i]!.y) < 2e-6, `node ${i} y ${n.y} vs ${want.nodes[i]!.y}`);
    assert.equal(n.continuity, 'smooth', 'the hyperbezier node default, so click-click-click curves');
  });
  f.destroy();
});

test('one undo removes the whole drawn path in a single step', () => {
  const f = mount([{ kind: 'box', shape: 'rect', id: 'a', x: 700, y: 700, w: 100, h: 100 } as Box]);
  const before = structuredClone(f.boxes());
  armPen(f);
  for (const [x, y] of P) { place(f, x, y); frames(); }
  key('Enter');
  frames();
  assert.equal(pathBoxes(f).length, 1);
  f.undo();
  assert.deepEqual(f.boxes(), before, 'one undo, and the path is gone entirely');
  f.destroy();
});

test('Enter finishes an OPEN path; Escape mid-draw commits nothing and leaves the model deep-equal', () => {
  const f = mount([{ kind: 'box', shape: 'rect', id: 'a', x: 700, y: 700, w: 100, h: 100 } as Box]);
  const before = structuredClone(f.boxes());
  armPen(f);
  for (const [x, y] of P) { place(f, x, y); frames(); }
  const commits = f.commits();
  key('Escape');
  frames();
  assert.equal(f.commits(), commits, 'nothing committed');
  assert.deepEqual(f.boxes(), before, 'the model is byte-for-byte what it was');
  assert.equal(penNodEls(f), 0, 'and the draft chrome is gone');

  // Enter, by contrast, commits - and the path stays open.
  for (const [x, y] of P) { place(f, x, y); frames(); }
  key('Enter');
  frames();
  assert.equal(f.commits() - commits, 1);
  assert.equal(decoded(pathBoxes(f)[0]!).closed, false, 'Enter ends the path where it is, it does not close it');
  f.destroy();
});

test('a click-DRAG pulls the handles out symmetrically, the way the drag went', () => {
  const f = mount([]);
  armPen(f);
  place(f, 200, 200, { drag: [240, 220] });     // +40, +20
  frames();
  place(f, 400, 300);
  frames();
  key('Enter');
  frames();
  const box = pathBoxes(f)[0]!;
  const p = decoded(box);
  const w = Number(box.w), h = Number(box.h);
  const n0 = p.nodes[0]!;
  assert.ok(n0.hOutX !== undefined && n0.hOutY !== undefined, 'the drag authored an outgoing handle');
  // Stored normalised, so scale back to the pixels the pointer moved.
  assert.ok(Math.abs(n0.hOutX! * w - 40) < 1e-3, `hOut x ${n0.hOutX! * w} ≈ 40`);
  assert.ok(Math.abs(n0.hOutY! * h - 20) < 1e-3, `hOut y ${n0.hOutY! * h} ≈ 20`);
  // Symmetric: the incoming handle is the exact mirror.
  assert.ok(Math.abs(n0.hInX! * w + 40) < 1e-3, 'hIn mirrors hOut in x');
  assert.ok(Math.abs(n0.hInY! * h + 20) < 1e-3, 'hIn mirrors hOut in y');
  f.destroy();
});

test('Alt-click with no drag places a CORNER, so no handles are pulled', () => {
  const f = mount([]);
  armPen(f);
  place(f, 200, 200, { alt: true });
  frames();
  place(f, 400, 300);
  frames();
  key('Enter');
  frames();
  const p = decoded(pathBoxes(f)[0]!);
  assert.equal(p.nodes[0]!.continuity, 'corner');
  assert.equal(p.nodes[0]!.hOutX, undefined, 'a corner with no pull authors no handle');
  f.destroy();
});

// The tracing gesture: a corner whose two sides are independent, authored in ONE pass
// instead of drawing everything smooth and breaking the pairs afterwards in node-edit mode.
test('Alt-DRAG breaks the pair - it steers the outgoing arm and leaves the incoming one', () => {
  const f = mount([]);
  armPen(f);
  place(f, 200, 200, { drag: [240, 220] });       // node 0: an ordinary symmetric pull
  frames();
  place(f, 400, 300, { drag: [440, 280], alt: true });   // node 1: broken, +40 / −20
  frames();
  place(f, 600, 400);
  frames();
  key('Enter');
  frames();
  const box = pathBoxes(f)[0]!;
  const p = decoded(box);
  const w = Number(box.w), h = Number(box.h);
  const n1 = p.nodes[1]!;
  assert.equal(n1.continuity, 'corner', 'the break is recorded, not just drawn');
  assert.ok(Math.abs(n1.hOutX! * w - 40) < 1e-3, `hOut x ${n1.hOutX! * w} ≈ 40`);
  assert.ok(Math.abs(n1.hOutY! * h + 20) < 1e-3, `hOut y ${n1.hOutY! * h} ≈ -20`);
  // NOT the mirror: the incoming arm still holds the segment drawn before the break.
  const mirrored = n1.hInX !== undefined && Math.abs(n1.hInX! * w + 40) < 1e-3
    && Math.abs(n1.hInY! * h - 20) < 1e-3;
  assert.ok(!mirrored, 'the incoming arm was left alone, not mirrored onto the outgoing one');
  f.destroy();
});

// `hyperbezier` reads a handle as a tangent PIN and discards its length, and `hbArm`'s
// signed shape function reverses the control arm once that pin is more than a right angle
// from its chord - so a pull "backwards" rendered the curve leaving the OPPOSITE way. The
// pen promotes to `cubic` on the first real pull instead, which honours the handle exactly.
test('a handle pull promotes a hyperbezier draft to cubic, losslessly', () => {
  const f = mount([]);
  armPen(f);
  place(f, 200, 200);                              // click only - still the smooth-auto kind
  frames();
  place(f, 400, 300, { drag: [360, 340] });        // pull BACK past a right angle of the chord
  frames();
  place(f, 600, 200);
  frames();
  key('Enter');
  frames();
  const box = pathBoxes(f)[0]!;
  const p = decoded(box);
  const w = Number(box.w), h = Number(box.h);
  assert.equal(p.kind, 'cubic', 'the pull switched the draft to the kind that honours it');
  const n1 = p.nodes[1]!;
  assert.ok(Math.abs(n1.hOutX! * w + 40) < 1e-3, `hOut x ${n1.hOutX! * w} ≈ -40 (the way the drag went)`);
  assert.ok(Math.abs(n1.hOutY! * h - 40) < 1e-3, `hOut y ${n1.hOutY! * h} ≈ 40 (the way the drag went)`);
  f.destroy();
});

// A click-only draft never pulls a handle, so it must stay on the auto-smoothing kind.
test('click-click-click leaves the draft on the smooth-auto kind', () => {
  const f = mount([]);
  armPen(f);
  place(f, 200, 200);
  frames();
  place(f, 400, 300);
  frames();
  place(f, 600, 200);
  frames();
  key('Enter');
  frames();
  assert.equal(decoded(pathBoxes(f)[0]!).kind, 'hyperbezier');
  f.destroy();
});

test('Backspace while drawing drops the last node, not the box', () => {
  const f = mount([{ kind: 'box', shape: 'rect', id: 'a', x: 700, y: 700, w: 100, h: 100 } as Box]);
  armPen(f);
  for (const [x, y] of P) { place(f, x, y); frames(); }
  assert.equal(penNodEls(f), 3);
  const commits = f.commits();
  key('Backspace');
  frames();
  assert.equal(penNodEls(f), 2, 'one node fewer');
  assert.equal(f.commits(), commits, 'and nothing was committed, least of all the box');
  assert.equal(f.boxes().length, 1, 'the existing box survives');
  f.destroy();
});

test('a double-click ends an open path', () => {
  const f = mount([]);
  armPen(f);
  for (const [x, y] of P) { place(f, x, y); frames(); }
  const commits = f.commits();
  dblClick(f, 300, 450);
  assert.equal(f.commits() - commits, 1);
  assert.equal(pathBoxes(f).length, 1);
  f.destroy();
});

test('a pan or zoom mid-draw keeps the draft - it never touched the model', () => {
  const f = mount([]);
  armPen(f);
  for (const [x, y] of P) { place(f, x, y); frames(); }
  const commits = f.commits();
  // What a pan/zoom does: the artboard's screen rect changes and the overlay re-syncs.
  f.canvasEl.getBoundingClientRect = () => rect(-120, 40, NATIVE * 2, NATIVE * 2);
  f.stageEl.dispatchEvent(new W.MouseEvent('wheel', { bubbles: true }));
  frames();
  assert.equal(penNodEls(f), 3, 'all three nodes are still in the draft');
  assert.equal(f.commits(), commits, 'and the model was not written to');
  // Restore the 1:1 mapping before finishing, so the commit is comparable.
  f.canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  key('Enter');
  frames();
  assert.equal(decoded(pathBoxes(f)[0]!).nodes.length, 3);
  f.destroy();
});

// ══ wired: node editing ═══════════════════════════════════════════════════════

/** A square-framed path box. The frame is square on purpose wherever a test asserts
 *  collinearity: normalising by w and h separately is a non-uniform scale, which does not
 *  preserve angles, so `w === h` is what makes "collinear in the stored form" meaningful. */
function cubicBox(o: { id?: string; x?: number; y?: number; s?: number; nodes?: SplineNode[]; closed?: boolean } = {}): Box {
  const s = o.s ?? 200;
  const nodes = o.nodes ?? [
    { x: 0, y: 1, hOutX: 0.2, hOutY: -0.4, continuity: 'corner' },
    { x: 0.5, y: 0, hInX: -0.2, hInY: 0, hOutX: 0.2, hOutY: 0, continuity: 'smooth' },
    { x: 1, y: 1, hInX: -0.2, hInY: -0.4, continuity: 'corner' },
  ];
  return {
    kind: 'path', shape: 'rect', id: o.id ?? 'p1', bg: '', stroke: '#000', strokeW: 2, fillRule: 'nonzero',
    x: o.x ?? 300, y: o.y ?? 300, w: s, h: s, rot: 0,
    path: encodeAuthoredPath({ kind: 'cubic', closed: o.closed ?? false, nodes }),
  } as Box;
}

/** Enter node editing on a path box by double-clicking it. */
function enterNodeEdit(f: Fixture, at: [number, number]): void {
  selectBox(f, at[0], at[1]);
  dblClick(f, at[0], at[1]);
  assert.ok(f.stageEl.classList.contains('fc-node-editing'), 'node-edit mode is on');
}

test('double-click on a path box enters node editing; Escape leaves it and restores selection', () => {
  const f = mount([cubicBox()]);
  enterNodeEdit(f, [400, 480]);
  assert.equal(penNodEls(f), 3, 'a node per authored node');
  assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-handle').length, 0, 'no resize handles while editing points');
  key('Escape');
  frames();
  assert.equal(f.stageEl.classList.contains('fc-node-editing'), false);
  assert.equal(penNodEls(f), 0);
  assert.ok(f.stageEl.querySelectorAll('.fc-chrome .fc-handle').length > 0, 'ordinary selection chrome is back');
  f.destroy();
});

test('dragging a node commits once and moves only that node', () => {
  const f = mount([cubicBox()]);
  enterNodeEdit(f, [400, 480]);
  const before = f.boxes()[0]!;
  const nodesBefore = nativeNodes(before);
  const commits = f.commits();
  // Node 1 is at normalised (0.5, 0) in a 200 frame at (300,300) → native (400, 300).
  // Alt suppresses snapping, exactly as it does for a box drag.
  drag(f, [400, 300], [430, 340], { alt: true });
  assert.equal(f.commits() - commits, 1, 'one commit for one drag');
  // The claim is made in NATIVE px, because the frame refits: every stored fraction changes
  // even for the two nodes that did not move, so comparing fractions would compare nothing.
  const after = f.boxes()[0]!;
  const nodesAfter = nativeNodes(after);
  assertClose(nodesAfter[1]!, { x: 430, y: 340 }, 1e-3, 'the dragged node went where the pointer did');
  assertClose(nodesAfter[0]!, nodesBefore[0]!, 1e-3, 'node 0 stayed put');
  assertClose(nodesAfter[2]!, nodesBefore[2]!, 1e-3, 'node 2 stayed put');
  // The frame followed the curve rather than clipping it: this drag pulled the shape's top
  // edge DOWN, so the frame shrinks and its top edge moves with it.
  assertTightFrame(after, 'after a node drag');
  assert.ok(frameOf(after).h < 200, `the frame shrank to the curve (h ${frameOf(after).h})`);
  assert.ok(frameOf(after).y > 300, `and its top edge moved down with it (y ${frameOf(after).y})`);
  f.destroy();
});

test('dragging a handle applies enforceContinuity, and commits once', () => {
  const f = mount([cubicBox()]);
  enterNodeEdit(f, [400, 480]);
  // Node 1's OUT handle: normalised offset (0.2, 0) from (0.5, 0) → native (400 + 40, 300).
  const commits = f.commits();
  drag(f, [440, 300], [430, 360]);
  assert.equal(f.commits() - commits, 1);
  const after = f.boxes()[0]!;
  // The handle tip went where the pointer did, asserted in NATIVE px: this drag pushes the
  // curve above the old frame's top edge, so the frame refits and the stored fractions are
  // no longer 200ths of anything fixed.
  assertClose(nativeHandle(after, 1, 'out')!, { x: 430, y: 360 }, 1e-3, 'the out handle followed the pointer');
  // A square frame is what makes "collinear in the STORED form" meaningful (normalising by
  // w and h separately is a non-uniform scale) - and a refit can make the frame non-square,
  // so the constraint is checked on the DENORMALISED nodes, in px, where it is a real angle.
  const fr = frameOf(after);
  const n = denormNodes(decodedAll(after)[0]!, fr.w, fr.h).nodes[1]!;
  // 'smooth' → collinear and opposed, with the incoming length (0.2 of the ORIGINAL 200
  // frame = 40px) intact: enforceContinuity turns the handle, it does not rescale it.
  assert.ok(handleSin(n) < 1e-5, `collinear (sin ${handleSin(n)})`);
  assert.ok(handleDot(n) < 0, 'opposed');
  assert.ok(Math.abs(hLen(n, 'in') - 40) < 1e-2, `and the incoming length is unchanged (${hLen(n, 'in')}px)`);
  // A handle drag that pushes the CURVE out of the frame grows it - and this one does, since
  // node 1's in-handle now points up out of the old top edge.
  assertTightFrame(after, 'after a handle drag');
  assert.ok(frameOf(after).y < 300, `the frame grew upward to contain the curve (y ${frameOf(after).y})`);
  f.destroy();
});

test('clicking the curve inserts a node there; the payload grows by one node and nothing else', () => {
  const f = mount([cubicBox()]);
  enterNodeEdit(f, [400, 480]);
  const before = decoded(f.boxes()[0]!);
  const beforeCubics = lowerAuthored(denormNodes(before, 200, 200)).cubics;
  // Aim at a point ON the first segment, found from the engine, in native coordinates.
  const on = evalCubic(beforeCubics[0]!, 0.4);
  const commits = f.commits();
  place(f, 300 + on.x, 300 + on.y);
  frames();
  assert.equal(f.commits() - commits, 1, 'one commit');
  const after = decoded(f.boxes()[0]!);
  assert.equal(after.nodes.length, before.nodes.length + 1);
  const afterCubics = lowerAuthored(denormNodes(after, 200, 200)).cubics;
  // On the curve, and the curve is unchanged - an exact cubic split.
  const dev = maxDeviation(samples(afterCubics, 40), samples(beforeCubics, 600));
  assert.ok(dev < 1e-6, `shape unchanged (deviation ${dev})`);
  assert.equal(penNodEls(f), 4, 'and the chrome grew to match');
  f.destroy();
});

test('Delete removes the selected node; the last two are kept with a reason', () => {
  const f = mount([cubicBox()]);
  enterNodeEdit(f, [400, 480]);
  place(f, 400, 300);                            // select node 1
  frames();
  const commits = f.commits();
  key('Delete');
  frames();
  assert.equal(f.commits() - commits, 1);
  assert.equal(decoded(f.boxes()[0]!).nodes.length, 2);

  // Now try to delete both remaining nodes: a path needs two, so this refuses out loud.
  key('a', { meta: true });
  frames();
  const commits2 = f.commits();
  key('Delete');
  frames();
  assert.equal(f.commits(), commits2, 'nothing committed');
  assert.match(flashText(f), /at least two points/i);
  assert.equal(decoded(f.boxes()[0]!).nodes.length, 2);
  f.destroy();
});

// ── closed paths keep being closed ────────────────────────────────────────────
//
// Insert and delete both wrap: `insertNodeOnCurve` indexes segment `at` as node `at` →
// node `(at+1) % n`, so the CLOSING segment is an ordinary segment and a click on it
// splices at the end; `deleteNodes` rebuilds the node list and spreads the rest of the
// path, so `closed` rides through untouched. Both are easy to regress into "the path
// silently opened", which on a traced outline destroys the fill.

const squareBox = (): Box => cubicBox({ nodes: [
  { x: 0, y: 0, continuity: 'corner' }, { x: 1, y: 0, continuity: 'corner' },
  { x: 1, y: 1, continuity: 'corner' }, { x: 0, y: 1, continuity: 'corner' },
], closed: true });

test('inserting on a CLOSED path\'s closing segment splices between the last node and the first', () => {
  const f = mount([squareBox()]);
  enterNodeEdit(f, [400, 400]);
  const before = decoded(f.boxes()[0]!);
  assert.equal(before.nodes.length, 4);
  // The closing segment is the LEFT edge, native (300,500) → (300,300). Click its midpoint.
  const commits = f.commits();
  place(f, 300, 400);
  frames();
  assert.equal(f.commits() - commits, 1, 'one commit');
  const after = decoded(f.boxes()[0]!);
  assert.equal(after.nodes.length, 5, 'the node went in');
  assert.equal(after.closed, true, 'and the path is still closed');
  // Spliced at the END, which for the closing segment is between node 3 and node 0.
  const pts = nativeNodes(f.boxes()[0]!);
  assertClose(pts[4]!, { x: 300, y: 400 }, 1e-3, 'the new node sits where the curve was clicked');
  f.destroy();
});

test('deleting a node from a CLOSED path leaves it closed', () => {
  const f = mount([squareBox()]);
  enterNodeEdit(f, [400, 400]);
  place(f, 500, 300);                            // select node 1 (top-right corner)
  frames();
  key('Delete');
  frames();
  const after = decoded(f.boxes()[0]!);
  assert.equal(after.nodes.length, 3, 'the node went');
  assert.equal(after.closed, true, 'and the path did NOT spring open');
  f.destroy();
});

// The pure operation, so the wrap is pinned independently of the pointer plumbing above.
test('deleteNodes preserves `closed` and `kind`, and refuses to leave fewer than two', () => {
  const p = { kind: 'cubic' as const, closed: true, nodes: [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  ] };
  const one = deleteNodes(p, [2]);
  assert.equal(one?.closed, true);
  assert.equal(one?.kind, 'cubic');
  assert.equal(one?.nodes.length, 3);
  assert.equal(deleteNodes(p, [0, 1, 2]), null, 'two is the floor, so this refuses');
});

// ── align + distribute over selected nodes ────────────────────────────────────

test('alignNodes snaps the selection to an edge of ITS OWN box, and leaves the rest alone', () => {
  const p = { kind: 'cubic' as const, closed: false, nodes: [
    { x: 0, y: 10, hOutX: 5, hOutY: 5 }, { x: 3, y: 20 }, { x: 9, y: 30 }, { x: 100, y: 100 },
  ] };
  const top = alignNodes(p, [0, 1, 2], 'top');
  assert.deepEqual(top.nodes.map((n) => n.y), [10, 10, 10, 100], 'the three went to the minimum y');
  assert.deepEqual(top.nodes.map((n) => n.x), [0, 3, 9, 100], 'and nothing moved sideways');
  assert.equal(top.nodes[3]!.y, 100, 'the unselected node is not part of the reference box');
  // Handles are OFFSETS, so an align carries them rather than flattening the curve.
  assert.equal(top.nodes[0]!.hOutX, 5);
  assert.equal(top.nodes[0]!.hOutY, 5);

  const mid = alignNodes(p, [0, 2], 'vcentre');
  assert.equal(mid.nodes[0]!.y, 20, 'centre of 10..30');
  assert.equal(mid.nodes[2]!.y, 20);
  assert.equal(mid.nodes[1]!.y, 20, 'coincidentally, but it was NOT written');
  assert.equal(alignNodes(p, [1], 'left').nodes[1]!.x, 3, 'one node has nothing to align to');
});

test('distributeNodes equalises spacing by COORDINATE, holding the extremes still', () => {
  const p = { kind: 'cubic' as const, closed: false, nodes: [
    { x: 0, y: 0 }, { x: 90, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 },
  ] };
  // Selected out of path order and out of coordinate order - the sort is by x, so the
  // extremes are node 0 (x=0) and node 1 (x=90).
  const out = distributeNodes(p, [0, 1, 2, 3], 'h');
  assert.deepEqual(out.nodes.map((n) => n.x), [0, 90, 30, 60], 'evenly spaced in x, in place');
  assert.deepEqual(distributeNodes(p, [0, 1], 'h').nodes.map((n) => n.x), [0, 90, 10, 20],
    'two points are already evenly spaced, so this is a no-op');
});

test('alignPoints aligns nodes AND control points (a selected handle moves by its offset)', () => {
  const p = { kind: 'cubic' as const, closed: false, nodes: [
    { x: 0, y: 0, hOutX: 10, hOutY: 0 }, { x: 100, y: 0 },
  ] };
  // node 0's OUT control point (abs x=10) + node 1 (x=100); align right → both to x=100.
  const out = alignPoints(p, [{ node: 0, handle: 'out' }, { node: 1 }], 'right');
  assert.equal(out.nodes[1]!.x, 100, 'node 1 unchanged (already rightmost)');
  assert.equal(out.nodes[0]!.x, 0, 'node 0 itself was not selected, so it stays put');
  assert.equal(out.nodes[0]!.hOutX, 100, 'its out-handle moved to abs x=100 → offset 100');
  assert.equal(out.nodes[0]!.hOutY, 0, 'the off-axis coordinate is untouched');
});

test('alignPoints with a node and its own handle collapses them to one coordinate', () => {
  const p = { kind: 'cubic' as const, closed: false, nodes: [
    { x: 0, y: 0, hOutX: 40, hOutY: 0 }, { x: 100, y: 0 },
  ] };
  const out = alignPoints(p, [{ node: 0 }, { node: 0, handle: 'out' }], 'left');
  assert.equal(out.nodes[0]!.x, 0);
  assert.equal(out.nodes[0]!.hOutX, 0, 'the handle collapses onto the node x (offset 0)');
});

test('alignPoints ignores a ref to a handle a node does not have', () => {
  const p = { kind: 'cubic' as const, closed: false, nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
  // node 0 has no out-handle, so that ref is dropped; the two NODES still align.
  const out = alignPoints(p, [{ node: 0, handle: 'out' }, { node: 0 }, { node: 1 }], 'right');
  assert.equal(out.nodes[0]!.x, 100);
  assert.equal(out.nodes[1]!.x, 100);
});

test('distributePoints spaces nodes AND control points evenly by coordinate', () => {
  const p = { kind: 'cubic' as const, closed: false, nodes: [
    { x: 0, y: 0 }, { x: 100, y: 0, hInX: -10, hInY: 0 }, { x: 50, y: 0 },
  ] };
  // points by x: node0(0), node2(50), node1.in(abs 90) → even spacing 0, 45, 90.
  const out = distributePoints(p, [{ node: 0 }, { node: 1, handle: 'in' }, { node: 2 }], 'h');
  assert.equal(out.nodes[0]!.x, 0);
  assert.equal(out.nodes[2]!.x, 45, 'the middle point (node 2) spaced to 45');
  assert.equal(out.nodes[1]!.x + out.nodes[1]!.hInX!, 90, 'the control point held at the max (90)');
});

test('the Arrange button turns on with two selected points and off with one', () => {
  const f = mount([squareBox()]);
  enterNodeEdit(f, [400, 400]);
  const btn = (): HTMLButtonElement | null => f.stageEl.querySelector('[data-pen="arrange"]');
  place(f, 300, 300);                            // one node selected
  frames();
  assert.equal(btn()?.disabled, true, 'one point is not an arrangement');
  drag(f, [250, 250], [550, 320]);               // marquee the top two
  frames();
  assert.equal(btn()?.disabled, false, 'two are');
  f.destroy();
});

test('a marquee selects several nodes and moves them together, in one commit', () => {
  const f = mount([cubicBox({ nodes: [
    { x: 0, y: 0, continuity: 'corner' }, { x: 1, y: 0, continuity: 'corner' },
    { x: 1, y: 1, continuity: 'corner' }, { x: 0, y: 1, continuity: 'corner' },
  ], closed: true })]);
  enterNodeEdit(f, [400, 400]);
  const nodesBefore = nativeNodes(f.boxes()[0]!);
  // Marquee the TOP two nodes only - native (300,300) and (500,300) - starting well off the
  // curve so the drag is a marquee rather than an insert.
  drag(f, [250, 250], [550, 320]);
  const commits = f.commits();
  drag(f, [300, 300], [340, 290], { alt: true });
  assert.equal(f.commits() - commits, 1, 'one commit for the group move');
  const after = f.boxes()[0]!;
  const nodesAfter = nativeNodes(after);
  assertClose(nodesAfter[0]!, { x: 340, y: 290 }, 1e-3, 'node 0 moved');
  assertClose(nodesAfter[1]!, { x: 540, y: 290 }, 1e-3, 'node 1 moved with it');
  assertClose(nodesAfter[2]!, nodesBefore[2]!, 1e-3, 'node 2 did not');
  // The two nodes went outside the old frame on BOTH axes (right past 500, up past 300), so
  // this is the reported bug's exact shape: without a refit the shape would now be clipped.
  assertTightFrame(after, 'after a marquee move outside the frame');
  assert.equal(frameOf(after).w, 240, 'the frame grew to the new right edge');
  assert.equal(frameOf(after).h, 210, 'and up to the new top edge');
  assert.equal(frameOf(after).y, 290, 'which is where the top edge now is');
  f.destroy();
});

test('the continuity control writes the constraint it names', () => {
  const f = mount([cubicBox()]);
  enterNodeEdit(f, [400, 480]);
  place(f, 400, 300);                            // node 1, currently 'smooth'
  frames();
  const seg = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar .fc-seg[data-seg="pen-cont"]');
  assert.ok(seg, 'the continuity segment is on the pen bar');
  const sym = [...seg!.querySelectorAll<HTMLButtonElement>('.fc-seg-btn')].find((b) => b.dataset.v === 'symmetric')!;
  const commits = f.commits();
  click(sym);
  frames();
  assert.equal(f.commits() - commits, 1);
  const n = decoded(f.boxes()[0]!).nodes[1]!;
  assert.equal(n.continuity, 'symmetric');
  assert.ok(handleSin(n) < 1e-5, 'collinear');
  assert.ok(Math.abs(hLen(n, 'in') - hLen(n, 'out')) < 1e-5,
    'and the geometry was made to satisfy it, not merely labelled');
  f.destroy();
});

// ══ wired: the spline-kind switcher ═══════════════════════════════════════════

const kindSelect = (f: Fixture): HTMLSelectElement => {
  const s = f.stageEl.querySelector<HTMLSelectElement>('.fc-ctxbar [data-pen="kind"]');
  assert.ok(s, 'the kind switcher is on the pen bar');
  return s!;
};
const changeKind = (f: Fixture, to: string): void => {
  const s = kindSelect(f);
  s.value = to;
  s.dispatchEvent(new W.Event('change', { bubbles: true }));
  frames();
};

test('the switcher offers exactly what the engine can lower, now including spiro', () => {
  const f = mount([cubicBox()]);
  enterNodeEdit(f, [400, 480]);
  const values = [...kindSelect(f).options].map((o) => o.value);
  assert.deepEqual(values, [...PEN_KINDS]);
  assert.ok(values.includes('spiro'), 'spiro is a real solver now, so the switcher offers it');
  assert.equal(kindSelect(f).value, 'cubic', 'and it shows the path its own kind');
  f.destroy();
});

test('cubic → hyperbezier WARNS before discarding the handles, and does nothing if declined', () => {
  const f = mount([cubicBox()]);
  enterNodeEdit(f, [400, 480]);
  const commits = f.commits();
  changeKind(f, 'hyperbezier');
  const panel = f.stageEl.querySelector<HTMLElement>('.fc-confirm-panel');
  assert.ok(panel, 'the lossy direction asks first');
  assert.match(panel!.textContent || '', /handle/i, 'and says what will be lost');
  assert.equal(f.commits(), commits, 'nothing committed while the question is open');

  click(panel!.querySelector('[data-confirm-no]')!);
  frames();
  assert.equal(f.commits(), commits, 'declining changes nothing');
  assert.equal(decoded(f.boxes()[0]!).kind, 'cubic');
  assert.equal(kindSelect(f).value, 'cubic', 'and the control is put back on the kind that is still true');
  f.destroy();
});

test('accepting the warning switches to hyperbezier and drops the handles, in one commit', () => {
  const f = mount([cubicBox()]);
  enterNodeEdit(f, [400, 480]);
  const before = decoded(f.boxes()[0]!);
  const commits = f.commits();
  changeKind(f, 'hyperbezier');
  click(f.stageEl.querySelector('.fc-confirm-panel [data-confirm-yes]')!);
  frames();
  assert.equal(f.commits() - commits, 1);
  const after = decoded(f.boxes()[0]!);
  assert.equal(after.kind, 'hyperbezier');
  assert.ok(after.nodes.every((n) => n.hOutX === undefined && n.hInX === undefined), 'the handles are gone');
  assert.deepEqual(after.nodes.map((n) => [n.x, n.y]), before.nodes.map((n) => [n.x, n.y]), 'the nodes did not move');
  f.destroy();
});

test('hyperbezier → cubic needs no warning, and preserves the shape', () => {
  const f = mount([{
    kind: 'path', shape: 'rect', id: 'p1', bg: '', x: 300, y: 300, w: 200, h: 200, rot: 0,
    path: encodeAuthoredPath({
      kind: 'hyperbezier', closed: true,
      nodes: [{ x: 0, y: 0 }, { x: 1, y: 0.1 }, { x: 0.9, y: 1 }, { x: 0.1, y: 0.9 }],
    }),
  } as Box]);
  enterNodeEdit(f, [400, 400]);
  const before = nativeSamples(f.boxes()[0]!, 600);
  const commits = f.commits();
  changeKind(f, 'cubic');
  assert.equal(f.stageEl.querySelector('.fc-confirm-panel'), null, 'no warning: nothing is lost this way');
  assert.equal(f.commits() - commits, 1);
  const after = f.boxes()[0]!;
  assert.equal(decoded(after).kind, 'cubic');
  // Compared in NATIVE px, since baking to cubic changes the lowering slightly and the frame
  // refits with it - the promise is about where the shape is on the canvas, not about which
  // fractions are stored.
  const dev = maxDeviation(nativeSamples(after, 24), before);
  // 1e-2 native px: the wire format stores six decimals of a FRACTION, the refit re-rounds
  // the frame to whole px, and the bake itself is exact only to the solver's tolerance.
  assert.ok(dev < 1e-2, `the shape survived (deviation ${dev})`);
  assertTightFrame(after, 'after a kind switch');
  f.destroy();
});

// ══ the refit: the frame IS the curve's tight bbox ════════════════════════════
//
// The reported bug: "the shape is clipped to a viewbox that doesn't grow when points are
// moved or created outside of that area." Nodes are stored as fractions of the box frame and
// `hooks.js` lowers them into a viewBox of exactly that size, so a frame that does not follow
// the curve clips it - and a frame that does not SHRINK leaves selection chrome, marquee
// hit-testing and align/distribute addressing empty space. Both directions are asserted here.

test('a node dragged far OUTSIDE the frame: the frame grows, the shape does not move', () => {
  const f = mount([cubicBox()]);
  enterNodeEdit(f, [400, 480]);
  const before = f.boxes()[0]!;
  const nodesBefore = nativeNodes(before);
  // Node 1 is at native (400, 300) - the frame is 200×200 at (300,300). Drag it 260px right
  // and 240px up, i.e. well outside on both axes: the old frame ends at x=500, y=300.
  drag(f, [400, 300], [660, 60], { alt: true });
  const after = f.boxes()[0]!;
  assertNoNaN(after, 'after a big outward drag');
  assertTightFrame(after, 'a node dragged outside the frame');
  // Grew on both axes, in the directions the node went.
  assert.ok(frameOf(after).x + frameOf(after).w >= 660, 'the frame reaches the new node');
  assert.equal(frameOf(after).y, 60, "and its top edge is the node's, which is now the curve's highest point");
  // Nothing moved that was not dragged: the two untouched nodes are where they were, in
  // native px, computed from the BEFORE box independently of the after one.
  assertClose(nativeNodes(after)[0]!, nodesBefore[0]!, 1e-3, 'node 0');
  assertClose(nativeNodes(after)[2]!, nodesBefore[2]!, 1e-3, 'node 2');
  assertClose(nativeNodes(after)[1]!, { x: 660, y: 60 }, 1e-3, 'the dragged node');
  f.destroy();
});

test('a node INSERTED outside the frame is contained too, and the curve is unmoved', () => {
  // A `line` path, so the insert is on a straight segment and the whole shape is a polyline
  // whose bbox is its nodes' - the case where "outside" is unambiguous.
  const f = mount([cubicBox({ nodes: [
    { x: 0, y: 0, continuity: 'corner' }, { x: 1, y: 1, continuity: 'corner' },
  ] })]);
  enterNodeEdit(f, [350, 350]);
  const frameBefore = frameOf(f.boxes()[0]!);
  // Insert at the segment's midpoint (native 400,400). The split is exact - that the SHAPE
  // does not move is the dedicated cubic-split test's claim - so the refit is a no-op and the
  // frame must come out identical rather than nudged by the renormalisation.
  place(f, 400, 400);
  frames();
  assert.equal(decoded(f.boxes()[0]!).nodes.length, 3, 'a node was inserted on the curve');
  assert.deepEqual(frameOf(f.boxes()[0]!), frameBefore, 'an exact insert refits to the same frame');
  assertTightFrame(f.boxes()[0]!, 'after an exact insert');

  // Now drag the new node well below the frame - the reported bug's other half.
  drag(f, [400, 400], [400, 700], { alt: true });
  const after = f.boxes()[0]!;
  assertNoNaN(after, 'after an insert-then-drag past the frame');
  assertTightFrame(after, 'a node inserted then dragged below the frame');
  // At least to the node - the split gave it handles, so the curve bulges a little past it.
  assert.ok(frameOf(after).y + frameOf(after).h >= 700,
    `the frame reaches the new node (bottom edge ${frameOf(after).y + frameOf(after).h})`);
  // The two ORIGINAL endpoints are still exactly where they were.
  assertClose(nativeNodes(after)[0]!, { x: 300, y: 300 }, 1e-3, 'the first endpoint');
  assertClose(nativeNodes(after)[2]!, { x: 500, y: 500 }, 1e-3, 'the last endpoint');
  f.destroy();
});

test('a handle pulled far outside does NOT inflate the frame - the curve does not follow the hull', () => {
  // The reason the refit uses `pathBounds` (the tight bbox, from the derivative's roots) and
  // not the control hull. A cubic reaches only ~3/4 of the way to a control point, so a
  // handle can sit a long way outside the frame with the CURVE barely leaving it - and
  // fitting the hull would make every smooth shape's box visibly too big.
  const f = mount([cubicBox({ nodes: [
    { x: 0, y: 0.5, hOutX: 0.25, hOutY: 0, continuity: 'corner' },
    { x: 1, y: 0.5, hInX: -0.25, hInY: 0, continuity: 'corner' },
  ] })]);
  enterNodeEdit(f, [400, 400]);
  // Node 0's out handle is at native (350, 400). Pull it 600px straight up - 3× the frame.
  drag(f, [350, 400], [350, -200]);
  const after = f.boxes()[0]!;
  assertNoNaN(after, 'after a huge handle pull');
  assertTightFrame(after, 'a handle far outside the frame');
  const handle = nativeHandle(after, 0, 'out')!;
  assertClose(handle, { x: 350, y: -200 }, 1e-3, 'the handle really is where it was dragged');
  const fr = frameOf(after);
  // The handle is at native y = -200; the frame's top edge must be far below that, because
  // the curve only reaches about 3/8 of the way up a single arm.
  assert.ok(fr.y > -60, `the frame did not chase the handle (top edge at ${fr.y}, handle at -200)`);
  // And the handle is legally outside the stored [0,1] box, which is the whole point.
  const stored = decoded(after).nodes[0]!;
  assert.ok((stored.hOutY ?? 0) < -1, `the stored handle is outside [0,1] (hOutY ${stored.hOutY})`);
  f.destroy();
});

test('a node dragged INWARD shrinks the frame, and so does a delete', () => {
  // A diamond, so exactly ONE node touches each frame edge - which is what makes "pull it in
  // and the frame follows" an unambiguous claim.
  const f = mount([cubicBox({ nodes: [
    { x: 0.5, y: 0, continuity: 'corner' }, { x: 1, y: 0.5, continuity: 'corner' },
    { x: 0.5, y: 1, continuity: 'corner' }, { x: 0, y: 0.5, continuity: 'corner' },
  ], closed: true })]);
  enterNodeEdit(f, [400, 400]);
  assert.equal(frameOf(f.boxes()[0]!).w, 200);
  // Pull the top node (native 400,300) down to (400, 360): the frame's top edge is now slack.
  drag(f, [400, 300], [400, 360], { alt: true });
  let after = f.boxes()[0]!;
  assertTightFrame(after, 'after a node dragged inward');
  assert.equal(frameOf(after).h, 140, 'the frame shrank on the axis that no longer reaches');
  assert.equal(frameOf(after).y, 360, 'and its top edge came down to the curve');
  assert.equal(frameOf(after).w, 200, 'the other axis still reaches, so it did not shrink');

  // Deleting a node has the mirror problem and the same answer.
  place(f, 300, 400);                            // select the left node
  frames();
  key('Delete');
  frames();
  after = f.boxes()[0]!;
  assertNoNaN(after, 'after a delete');
  assertTightFrame(after, 'after a delete');
  assert.equal(decoded(after).nodes.length, 3);
  assert.equal(frameOf(after).w, 100, 'the frame shrank to the nodes that are left');
  assert.equal(frameOf(after).x, 400, 'from the side the node left');
  f.destroy();
});

test('the refit compensates ROTATION, so a rotated shape does not move at all', () => {
  // `w`/`h` describe the UNROTATED frame and `rot` spins it about its own centre, so changing
  // w/h moves the centre of rotation. This is the trap: a refit that ignores it makes a
  // rotated shape jump, which is worse than the clipping it set out to fix. Driven against
  // `refitFrame` directly, with the expected native geometry computed here (`toNative`) from
  // the CSS rotation model rather than borrowed from the module.
  for (const rot of [0, 30, 45, 90, 180, -30, 137.5]) {
    const fr: TFrame = { x: 300, y: 200, w: 200, h: 100, rot };
    // A curve that overflows the frame on every side, so the refit really has work to do.
    const p: AuthoredPath = {
      kind: 'cubic', closed: false,
      nodes: [
        { x: -40, y: 20, hOutX: 60, hOutY: -90, continuity: 'corner' },
        { x: 250, y: 130, hInX: -60, hInY: 40, continuity: 'corner' },
      ],
    };
    const before = samples(lowerAuthored(p).cubics, 200).map((q) => toNative(fr, q.x, q.y));
    const fit = refitFrame([p], fr);
    assert.ok(fit, `rot ${rot}: refitFrame answered`);
    const after = samples(lowerAuthored(fit!.paths[0]!).cubics, 200).map((q) => toNative(fit!.frame, q.x, q.y));
    // Point-for-point at the same parameter, not a nearest-sample deviation: the claim is
    // that the shape is IDENTICAL, so the strongest available comparison is the right one.
    assert.equal(after.length, before.length);
    for (let i = 0; i < before.length; i++) {
      assertClose(after[i]!, before[i]!, 1e-9, `rot ${rot}: sample ${i} moved`);
    }
    assert.equal(fit!.frame.rot, rot, 'the refit never touches the rotation itself');
    // And the new frame really is the tight bbox in its own local space.
    const bb = pathBounds([{ curves: lowerAuthored(fit!.paths[0]!).cubics, closed: false }])!;
    assert.ok(Math.abs(bb.x0) <= 0.55 && Math.abs(bb.x1 - fit!.frame.w) <= 1.05, `rot ${rot}: x extent ${bb.x0}..${bb.x1} vs w ${fit!.frame.w}`);
    assert.ok(Math.abs(bb.y0) <= 0.55 && Math.abs(bb.y1 - fit!.frame.h) <= 1.05, `rot ${rot}: y extent ${bb.y0}..${bb.y1} vs h ${fit!.frame.h}`);
  }
});

test('a rotated path box survives a node drag through the real overlay', () => {
  const f = mount([cubicBox({ nodes: [
    { x: 0, y: 0, continuity: 'corner' }, { x: 1, y: 0.5, continuity: 'corner' },
    { x: 0, y: 1, continuity: 'corner' },
  ] })]);
  // Rotate the box 45° after mounting, so the box is the same shape spun about (400,400).
  const boxes = f.boxes();
  boxes[0]!.rot = 45;
  enterNodeEdit(f, [400, 400]);
  const before = nativeNodes(f.boxes()[0]!);
  // Grab node 1 where it actually IS on screen - through the frame's rotation - and pull it
  // outward along the rotated x axis.
  const grab = before[1]!;
  const to = { x: grab.x + 90, y: grab.y + 90 };
  drag(f, [grab.x, grab.y], [to.x, to.y], { alt: true });
  const after = f.boxes()[0]!;
  assertNoNaN(after, 'after a rotated node drag');
  assertTightFrame(after, 'a rotated box after a node drag');
  assert.equal(frameOf(after).rot, 45, 'the rotation is untouched');
  const nodesAfter = nativeNodes(after);
  assertClose(nodesAfter[1]!, to, 1e-2, 'the dragged node landed under the pointer');
  // The nodes that were NOT dragged did not move on screen, which is the whole rotation
  // trap: the frame's centre moved, so an uncompensated refit would have swung them.
  assertClose(nodesAfter[0]!, before[0]!, 1e-2, 'node 0 did not swing');
  assertClose(nodesAfter[2]!, before[2]!, 1e-2, 'node 2 did not swing');
  f.destroy();
});

test('a DEGENERATE extent gets a 1px axis, no NaN, and still does not move', () => {
  // A zero-extent axis is real: a horizontal line, a vertical one, two coincident nodes, an
  // all-collinear path. `w`/`h` clamp up to 1 (the renderer divides by them) and the curve
  // keeps its native position - see refitFrame's degenerate note.
  const cases: Array<{ why: string; nodes: SplineNode[]; flat: 'w' | 'h' | 'both' }> = [
    { why: 'horizontal line', nodes: [{ x: 100, y: 300 }, { x: 400, y: 300 }], flat: 'h' },
    { why: 'vertical line', nodes: [{ x: 250, y: 100 }, { x: 250, y: 500 }], flat: 'w' },
    { why: 'coincident nodes', nodes: [{ x: 250, y: 250 }, { x: 250, y: 250 }], flat: 'both' },
    { why: 'three collinear nodes', nodes: [{ x: 100, y: 200 }, { x: 250, y: 200 }, { x: 400, y: 200 }], flat: 'h' },
  ];
  for (const c of cases) {
    const drawn: AuthoredPath = { kind: 'line', closed: false, nodes: c.nodes };
    const made = penCommitFromNative(drawn);
    assert.ok(made, `${c.why}: commits`);
    const { x, y, w, h } = made!;
    for (const [k, v] of Object.entries({ x, y, w, h })) {
      assert.ok(Number.isFinite(v), `${c.why}: frame.${k} is ${v}`);
    }
    if (c.flat === 'h' || c.flat === 'both') assert.equal(h, 1, `${c.why}: the flat axis is 1px, never 0`);
    if (c.flat === 'w' || c.flat === 'both') assert.equal(w, 1, `${c.why}: the flat axis is 1px, never 0`);
    // Nothing divided by a zero extent: every stored fraction is finite.
    for (const n of made!.path.nodes) {
      assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), `${c.why}: node (${n.x}, ${n.y})`);
    }
    // And the shape is still where it was drawn, to the frame's own rounding.
    const fr: TFrame = { x, y, w, h, rot: 0 };
    denormNodes(made!.path, w, h).nodes.forEach((n, i) => {
      assertClose(toNative(fr, n.x, n.y), c.nodes[i]!, 0.51, `${c.why}: node ${i} moved`);
    });
    // The wire form is representable, so nothing NaN can reach hooks.js.
    const wire = encodeAuthoredPath(made!.path);
    assert.ok(wire && !/NaN|Infinity/.test(wire), `${c.why}: wire form ${wire}`);
  }
  // A ONE-node draft is not a path at all, so there is nothing to frame - the refusal, not a
  // 1×1 box the user would have to find and delete.
  assert.equal(penCommitFromNative({ kind: 'line', closed: false, nodes: [{ x: 5, y: 5 }] }), null);
});

/**
 * One `penEditWrite`, reproduced exactly: mutate the first contour, refit, renormalise,
 * encode, then decode and denormalise as the next edit would. The encode/decode is the point
 * - the wire format quantises to six decimals of a FRACTION of the frame, and a refit
 * renormalises, so each edit re-quantises against a different divisor.
 */
interface Stored { frame: TFrame; value: string }
function applyEdit(st: Stored, mutate: (p: AuthoredPath) => AuthoredPath): Stored {
  const decodedPaths = decodeAuthoredPaths(st.value);
  assert.ok(Array.isArray(decodedPaths) && decodedPaths.length, 'the stored value decodes');
  const local = decodedPaths.map((p) => denormNodes(p, st.frame.w, st.frame.h));
  const fit = refitFrame([mutate(local[0]!), ...local.slice(1)], st.frame);
  assert.ok(fit, 'the refit answered');
  return {
    frame: fit!.frame,
    value: encodeAuthoredPaths(fit!.paths.map((p) => normNodes(p, fit!.frame.w, fit!.frame.h))),
  };
}
function storedSamples(st: Stored, per = 60): Array<{ x: number; y: number }> {
  const decodedPaths = decodeAuthoredPaths(st.value) as AuthoredPath[];
  return decodedPaths.flatMap((p) =>
    samples(lowerAuthored(denormNodes(p, st.frame.w, st.frame.h)).cubics, per)
      .map((q) => toNative(st.frame, q.x, q.y)));
}

test('an edit and its inverse, 20 times, does not creep the shape', () => {
  // The refit runs on EVERY edit, so any per-edit bias accumulates. Two sources exist and
  // both are bounded here: the frame's own rounding (which the refit back-solves the local
  // offset from, so it contributes nothing at all) and the wire format's six decimals of a
  // fraction, which is ~2.5e-4px on a 250px frame per encode.
  // Rotated, non-square and with handles, so every term of the compensation is exercised.
  const seed: AuthoredPath = {
    kind: 'cubic', closed: true,
    nodes: [
      { x: 0, y: 0, hOutX: 0.16, hOutY: -0.15, continuity: 'corner' },
      { x: 1, y: 0.3, hInX: -0.16, hInY: -0.1, hOutX: 0.12, hOutY: 0.2, continuity: 'smooth' },
      { x: 0.48, y: 1, continuity: 'corner' },
    ],
  };
  let st: Stored = { frame: { x: 300, y: 400, w: 250, h: 200, rot: 30 }, value: encodeAuthoredPath(seed) };
  st = applyEdit(st, (p) => p);                   // settle onto the tight frame first
  const start = structuredClone(st);
  const before = storedSamples(start);
  const D = 137;
  for (let i = 0; i < 20; i++) {
    st = applyEdit(st, (p) => ({ ...p, nodes: p.nodes.map((n, k) => (k === 1 ? { ...n, x: n.x + D, y: n.y - D } : n)) }));
    st = applyEdit(st, (p) => ({ ...p, nodes: p.nodes.map((n, k) => (k === 1 ? { ...n, x: n.x - D, y: n.y + D } : n)) }));
    // The frame comes back to exactly where it started every single cycle - a refit of an
    // unchanged shape is a fixed point, which is what stops the drift being unbounded.
    assert.deepEqual(st.frame, start.frame, `cycle ${i}: the frame returned`);
  }
  const after = storedSamples(st);
  let worst = 0;
  for (let i = 0; i < before.length; i++) worst = Math.max(worst, Math.hypot(after[i]!.x - before[i]!.x, after[i]!.y - before[i]!.y));
  // 0.01 native px over 40 encode/decode round trips. The bound is the quantisation budget
  // and nothing else: the frame is a fixed point (asserted above) and the local offset is
  // back-solved from it, so the frame's rounding contributes ZERO - all that is left is
  // 1e-6 of a fraction × a ~250px frame = 2.5e-4px per coordinate per encode, and 40 of
  // those cannot exceed 1e-2 even if every one rounded the same way. Measured: 3.1e-4px,
  // i.e. a third of a thousandth of a pixel, so it is one encode's worth and not 40.
  assert.ok(worst < 0.01, `the shape crept ${worst}px over 20 edit/undo cycles`);
  // And the payload is stable, not merely close: the same shape re-encodes identically once
  // the frame is a fixed point, so a share link's bytes do not churn on a no-op edit.
  assert.equal(applyEdit(st, (p) => p).value, st.value, 'a no-op edit is byte-stable');
});

test('editing ONE contour keeps every other contour, and the frame contains them all', () => {
  // A boolean with a hole is several `AuthoredPath`s in one field. Node editing operates on
  // the first, but the write must re-encode all of them (or the holes are deleted) and the
  // refit must fit all of them (or editing the outer loop clips the inner one).
  const ring: AuthoredPath[] = [
    { kind: 'line', closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
    { kind: 'line', closed: true, nodes: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }] },
  ];
  const f = mount([{
    kind: 'path', shape: 'rect', id: 'p1', bg: '#000', fillRule: 'evenodd',
    x: 300, y: 300, w: 200, h: 200, rot: 0, path: encodeAuthoredPaths(ring),
  } as Box]);
  enterNodeEdit(f, [400, 310]);
  assert.equal(decodedAll(f.boxes()[0]!).length, 2, 'both contours are in the field to begin with');
  const holeBefore = contourNodes(f.boxes()[0]!, 1);

  // Drag the outer loop's top-left corner (native 300,300) out to (150, 150).
  drag(f, [300, 300], [150, 150], { alt: true });
  const after = f.boxes()[0]!;
  assertNoNaN(after, 'after editing one contour of two');
  assert.equal(decodedAll(after).length, 2, 'the hole was not dropped by the write');
  assertTightFrame(after, 'a multi-contour box after editing contour 0');
  // The frame contains BOTH: the hole is still inside [0,1] of the (now larger) frame.
  const fr = frameOf(after);
  for (const n of decodedAll(after)[1]!.nodes) {
    assert.ok(n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1, `the hole stayed inside the frame (${n.x}, ${n.y})`);
  }
  assert.equal(fr.x, 150, 'the frame grew to the dragged corner');
  assert.equal(fr.w, 350, 'and is the tight bbox of the outer loop');
  // And the hole did not MOVE on the canvas: it was renormalised into the new frame.
  contourNodes(after, 1).forEach((p, i) => assertClose(p, holeBefore[i]!, 1e-3, `hole node ${i}`));
  f.destroy();
});

// ══ a path box is just a box ══════════════════════════════════════════════════

test('resizing a path box rewrites w/h and NOT a single node', () => {
  const f = mount([cubicBox()]);
  const original = structuredClone(f.boxes()[0]!);
  selectBox(f, 400, 480);
  const se = f.stageEl.querySelector<HTMLElement>('.fc-chrome .fc-h-se');
  assert.ok(se, 'a path box gets the ordinary resize chrome');
  const commits = f.commits();
  se!.dispatchEvent(pointerEvent('pointerdown', { x: 500, y: 500 }));
  f.canvasEl.dispatchEvent(pointerEvent('pointermove', { x: 566, y: 588 }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: 566, y: 588 }));
  frames();
  assert.equal(f.commits() - commits, 1);
  const after = f.boxes()[0]!;
  // The whole point of the normalised convention: the payload is BYTE-identical.
  assert.equal(after.path, original.path, 'the authored path was not rewritten');
  assert.notEqual(after.w, original.w);
  // Everything except w/h is untouched.
  assert.deepEqual({ ...after, w: 0, h: 0 }, { ...original, w: 0, h: 0 });
  f.destroy();
});

test('a path box still moves, and moving it does not touch the payload either', () => {
  const f = mount([cubicBox()]);
  const original = structuredClone(f.boxes()[0]!);
  drag(f, [400, 480], [450, 520], { alt: true });
  const after = f.boxes()[0]!;
  assert.equal(after.path, original.path);
  assert.equal(after.x, Number(original.x) + 50);
  assert.equal(after.y, Number(original.y) + 40);
  f.destroy();
});

test('the vector-operations menu still sees a path box as a path', () => {
  const f = mount([cubicBox({ id: 'p1' }), cubicBox({ id: 'p2', x: 380, y: 380 })]);
  selectBox(f, 400, 480);
  f.canvasEl.dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 400, clientY: 480 }));
  const menu = f.stageEl.querySelector<HTMLElement>('.fc-context-menu');
  assert.ok(menu, 'the Stage E menu opens on a path box');
  const simplify = [...menu!.querySelectorAll<HTMLButtonElement>('.fc-pop-item')]
    .find((b) => (b.textContent || '').trim() === 'Simplify');
  assert.ok(simplify, 'Simplify is present');
  assert.equal(simplify!.disabled, false, 'and live, because the selected box IS a pen path');
  f.destroy();
});

// ══ performance: build-once / reposition-many ═════════════════════════════════

/** A 40-node closed path, normalised into a square frame. */
function bigPathBox(kind: 'hyperbezier' | 'cubic' = 'hyperbezier'): Box {
  const n = 40;
  const nodes: SplineNode[] = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: 0.5 + 0.45 * Math.cos(a), y: 0.5 + 0.45 * Math.sin(a) };
  });
  return {
    kind: 'path', shape: 'rect', id: 'big', bg: '', x: 200, y: 200, w: 600, h: 600, rot: 0,
    path: encodeAuthoredPath({ kind, closed: true, nodes }),
  } as Box;
}

test('a 40-node path: node chrome is built once and only repositioned across a drag', () => {
  const f = mount([bigPathBox()]);
  enterNodeEdit(f, [500, 500]);
  const first = penNodeEls(f);
  assert.equal(first.length, 40, 'one element per node');

  // A whole drag on node 0 - at normalised (0.95, 0.5) of a 600 frame at (200,200).
  const start: [number, number] = [200 + 0.95 * 600, 200 + 0.5 * 600];
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x: start[0], y: start[1] }));
  for (let i = 1; i <= 12; i++) {
    f.canvasEl.dispatchEvent(pointerEvent('pointermove', { x: start[0] + i, y: start[1] + i, alt: true }));
    frames(1);
    assert.equal(penNodeEls(f)[0], first[0], `frame ${i}: the same element object, repositioned`);
  }
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: start[0] + 12, y: start[1] + 12, alt: true }));
  frames();
  const after = penNodeEls(f);
  assert.equal(after.length, 40);
  after.forEach((el, i) => { assert.equal(el, first[i], `node  is the SAME element after the whole drag`); });

  // A pan/zoom is likewise a reposition, not a rebuild.
  f.canvasEl.getBoundingClientRect = () => rect(-50, -50, NATIVE * 1.5, NATIVE * 1.5);
  f.stageEl.dispatchEvent(new W.MouseEvent('wheel', { bubbles: true }));
  frames();
  penNodeEls(f).forEach((el, i) => { assert.equal(el, first[i], `node  survived the zoom`); });
  f.canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  // Inserting a node is the one thing that MUST rebuild, since the count changed. The frame
  // is read back rather than assumed: the drag above refitted it.
  const box = f.boxes()[0]!;
  const fr = frameOf(box);
  const on = evalCubic(lowerAuthored(denormNodes(decoded(box), fr.w, fr.h)).cubics[0]!, 0.5);
  const nat = toNative(fr, on.x, on.y);
  place(f, nat.x, nat.y);
  frames();
  assert.equal(penNodeEls(f).length, 41, 'the chrome rebuilt for the new count');
  f.destroy();
});

test('the warm start is what makes a 40-node hyperbezier drag cheap', () => {
  // Not a wall-clock assertion (a shared CI box will not honour one) but the thing that
  // wall-clock time is a proxy for: the number of Newton iterations a frame costs. Cold, the
  // solve re-converges from the chord-bend guess; warm, it starts from last frame's answer.
  const n = 40;
  const nodes: SplineNode[] = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: 300 + 270 * Math.cos(a), y: 300 + 270 * Math.sin(a) };
  });
  const path: AuthoredPath = { kind: 'hyperbezier', closed: true, nodes };
  let warm = lowerAuthored(path).solution!;
  const coldIters: number[] = [];
  const warmIters: number[] = [];
  const FRAMES = 40;
  for (let step = 1; step <= FRAMES; step++) {
    // One node travelling under the pointer, ~3px per frame - what a drag actually looks
    // like, and the case the warm start was added for.
    const moved: AuthoredPath = {
      ...path,
      nodes: nodes.map((p, i) => (i === 0 ? { ...p, x: p.x + step * 3, y: p.y + step * 3 } : p)),
    };
    coldIters.push(lowerAuthored(moved).solution!.iterations);
    const hot = lowerAuthored(moved, warm);
    warmIters.push(hot.solution!.iterations);
    warm = hot.solution!;
  }
  const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
  const cold = sum(coldIters), hot = sum(warmIters);
  // Measured: 5.75 Newton iterations per frame cold against 3.30 warm - 0.16 ms/frame down
  // to 0.12 for solve + lower of 40 nodes. The assertion is a ratio, not a time, because a
  // shared CI box will not honour a wall clock and the iteration count is what the time is a
  // proxy for.
  assert.ok(hot < cold * 0.75, `warm ${hot} Newton iterations vs cold ${cold} over ${FRAMES} frames`);
  // The property that actually matters is that the warm cost is FLAT while the cold cost
  // grows: the further the drag pulls the shape from the chord-bend initial guess, the more
  // the cold solve pays, and the warm one keeps paying the same one or two corrective steps.
  const half = FRAMES / 2;
  const avg = (a: number[]): number => sum(a) / a.length;
  assert.ok(avg(coldIters.slice(half)) > avg(coldIters.slice(0, half)) + 0.5,
    `the cold solve gets dearer as the shape distorts (${avg(coldIters.slice(0, half))} → ${avg(coldIters.slice(half))})`);
  assert.ok(Math.abs(avg(warmIters.slice(half)) - avg(warmIters.slice(0, half))) < 1,
    `the warm one does not (${avg(warmIters.slice(0, half))} → ${avg(warmIters.slice(half))})`);
});

// ══ touch ═════════════════════════════════════════════════════════════════════

test('drawing works with touch pointers', () => {
  const f = mount([]);
  armPen(f);
  for (const [x, y] of P) { place(f, x, y, { pointerType: 'touch' }); frames(); }
  assert.equal(penNodEls(f), 3);
  const commits = f.commits();
  place(f, P[0]![0], P[0]![1], { pointerType: 'touch' });
  frames();
  assert.equal(f.commits() - commits, 1, 'and closing on the first point commits once');
  assert.equal(decoded(pathBoxes(f)[0]!).closed, true);
  f.destroy();
});

/** Two fingers down, optionally moved, then both up - Stage E's recogniser, verbatim. */
function twoFinger(f: Fixture, o: { a: [number, number]; b: [number, number]; moveA?: [number, number]; moveB?: [number, number] }): void {
  const t0 = 1000;
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x: o.a[0], y: o.a[1], id: 1, pointerType: 'touch', time: t0 }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x: o.b[0], y: o.b[1], id: 2, pointerType: 'touch', time: t0 + 20 }));
  if (o.moveA) f.canvasEl.dispatchEvent(pointerEvent('pointermove', { x: o.moveA[0], y: o.moveA[1], id: 1, pointerType: 'touch', time: t0 + 60 }));
  if (o.moveB) f.canvasEl.dispatchEvent(pointerEvent('pointermove', { x: o.moveB[0], y: o.moveB[1], id: 2, pointerType: 'touch', time: t0 + 60 }));
  const end = t0 + 110;
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: (o.moveA ?? o.a)[0], y: (o.moveA ?? o.a)[1], id: 1, pointerType: 'touch', time: end }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: (o.moveB ?? o.b)[0], y: (o.moveB ?? o.b)[1], id: 2, pointerType: 'touch', time: end + 10 }));
  frames();
}

test('a two-finger pan while the pen is armed leaves NO stray node behind', () => {
  const f = mount([]);
  armPen(f);
  const commits = f.commits();
  twoFinger(f, { a: [300, 300], b: [340, 300], moveA: [420, 420], moveB: [460, 420] });
  assert.equal(penNodEls(f), 0, 'the node the first finger placed was retracted when the second arrived');
  assert.equal(f.commits(), commits, 'and nothing was committed');
  // The pen is still armed and still usable.
  for (const [x, y] of P) { place(f, x, y, { pointerType: 'touch' }); frames(); }
  key('Enter');
  frames();
  assert.equal(decoded(pathBoxes(f)[0]!).nodes.length, 3);
  f.destroy();
});

test('the two-finger-tap context menu still works with the pen armed', () => {
  const f = mount([cubicBox()]);
  armPen(f);
  twoFinger(f, { a: [400, 470], b: [400, 490] });
  assert.ok(f.stageEl.querySelector('.fc-context-menu'), 'the Stage E recogniser is not shadowed by the pen');
  assert.equal(penNodEls(f), 0, 'and the tap placed no node');
  f.destroy();
});
