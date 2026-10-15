// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 311 M6 - two fingers on the selection, pinned through the real initFreeCanvas in
 * jsdom with the real stage navigation mounted on the same stage, so both halves of the
 * arbitration are visible:
 *
 *   1. a pinch on a selected box scales it about the fingers' midpoint, the midpoint
 *      carries it, and the whole pinch commits once; in Scale mode the content scales too;
 *   2. a twist under 10 degrees turns nothing, and past that the turn counts from where it
 *      engaged and takes the soft magnet; a set turns about the centre of its bounds;
 *   3. a finger that began a move hands it to the pinch without committing the move;
 *   4. two fingers on an unselected box or on the empty stage zoom the view (the stage
 *      gets both fingers, which it did not when the first one pressed a box), as do a
 *      selection over 60% of the stage or past the visible stage, a second finger after
 *      300 ms, an artboard in the selection, a row parked on a keyframe, a live text
 *      edit and a panel floating over the selection;
 *   5. a two-finger tap still opens the context menu, a resting pair commits nothing,
 *      and Escape or a pointercancel mid pinch puts the selection back and commits
 *      nothing;
 *   6. after a pinch, the finger left down (and a third one the pinch held back) zoom
 *      the view with the next finger, whichever finger lifted first, and so do the
 *      fingers left after a pointercancel on one pinch finger;
 *   7. Safari's own pinch events do not zoom the view while the selection is pinched.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-two-finger.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window;
for (const k of [
  'window', 'document', 'HTMLElement', 'Element', 'KeyboardEvent', 'Event', 'CustomEvent',
  'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver',
]) {
  Reflect.set(globalThis, k, Reflect.get(W, k));
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => W.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => W.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
const media = (q: string): MediaQueryList => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
Reflect.set(globalThis, 'matchMedia', media);
Reflect.set(W, 'matchMedia', media);
Reflect.set(globalThis, 'ResizeObserver', class { observe() {} disconnect() {} });
Reflect.set(globalThis, 'CSS', Reflect.get(W, 'CSS') ?? { escape: (v: string) => String(v).replace(/[^\w-]/g, (c) => `\\${c}`) });

const { initFreeCanvas } = await import('./free-canvas.ts');
const { setupStageNav } = await import('./tool-stage-nav.ts');
const { registerCanvasInteractions } = await import('../lib/canvas-interaction.ts');

const NATIVE = 1000;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

type Pt = [number, number];
/** A finger event. jsdom has no PointerEvent; a MouseEvent under a pointer type reaches the same listeners. */
function finger(type: string, [x, y]: Pt, id: number, time: number): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: id });
  Object.defineProperty(e, 'pointerType', { value: 'touch' });
  Object.defineProperty(e, 'timeStamp', { value: time });
  Object.defineProperty(e, 'buttons', { value: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 });
  return e;
}
function press(key: string): KeyboardEvent {
  const e = new W.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  dom.window.document.body.dispatchEvent(e);
  return e;
}

const CANVAS = {
  idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  rotationField: 'rot', groupField: 'group', textField: 'text',
  fontSizeField: 'fontSize', radiusField: 'radius', strokeWField: 'strokeW',
  addKinds: [{ id: 'box', label: 'Box', seed: { kind: 'box' } }],
};
const FRAME_CFG = { frameField: 'frame', frameKind: 'frame', orderField: 'order', lockedField: 'locked' };

interface Fixture {
  viewEl: HTMLElement;
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  runtime: object;
  /** Another participant's write to the rows, as the collaboration layer applies one. */
  write(rows: Box[]): void;
  rows(): Box[];
  byId(id: string): Record<string, unknown>;
  el(id: string): HTMLElement;
  writes(): number;
  select(ids: string[]): void;
  /** The view's zoom, 1 at Fit. */
  zoom(): number;
  /** The stage navigation's view, and a way to set one. */
  view(state?: { scale: number; x: number; y: number }): { scale: number; x: number; y: number };
  destroy(): void;
}

function paint(canvasEl: HTMLElement, b: Box): void {
  const el = dom.window.document.createElement('div');
  const page = String(b.kind) === 'frame';
  el.className = page ? 'lolly-frame-page' : 'lolly-box';
  el.setAttribute(page ? 'data-frame-id' : 'data-box-id', String(b.id));
  if (page) el.setAttribute('data-pdf-page', '');
  el.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
  if (b.text) {
    const text = dom.window.document.createElement('div');
    text.className = 'lolly-box-text';
    text.textContent = String(b.text);
    el.appendChild(text);
  }
  canvasEl.appendChild(el);
}

/** The editor and the stage navigation on one stage, 1 screen px per native px from the client origin. */
function mount(seed: Box[], o: { frame?: boolean; canvas?: Record<string, unknown> } = {}): Fixture {
  const doc = dom.window.document;
  const viewEl = doc.createElement('div');
  const stageEl = doc.createElement('div');
  const outerEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  outerEl.appendChild(canvasEl);
  stageEl.appendChild(outerEl);
  viewEl.appendChild(stageEl);
  doc.body.appendChild(viewEl);
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  for (const b of seed) paint(canvasEl, b);

  const model = new Map<string, unknown>([['boxes', seed]]);
  const subs: Array<() => void> = [];
  let writes = 0;
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { writes++; model.set(id, value); for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const nav = setupStageNav(stageEl, outerEl, canvasEl, NATIVE, null);
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: (o.canvas ?? CANVAS) as never, fields: [] },
    ...(o.frame && { frame: FRAME_CFG }),
    nativeW: NATIVE, nativeH: NATIVE,
  });
  const boxes = (): Box[] => model.get('boxes') as Box[];
  return {
    viewEl, stageEl, canvasEl, runtime,
    write: (rows) => runtime.setInput('boxes', rows),
    rows: boxes,
    byId: (id) => boxes().find((b) => b.id === id)! as Record<string, unknown>,
    el: (id) => canvasEl.querySelector<HTMLElement>(`[data-box-id="${id}"], [data-frame-id="${id}"]`)!,
    writes: () => writes,
    select: (ids) => handle.applyUi({ select: ids } as never),
    zoom: () => nav.viewState().scale,
    view: (state) => { if (state) nav.applyView(state); return nav.viewState(); },
    destroy() { handle.destroy(); nav.destroy(); viewEl.remove(); for (const m of doc.querySelectorAll('.fc-context-menu')) m.remove(); },
  };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 25)); for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };
const geom = (el: HTMLElement): string => [el.style.left, el.style.top, el.style.width, el.style.height].join(' ');
const rectOf = (b: Record<string, unknown>): number[] => [b.x, b.y, b.w, b.h].map(Number);
const near = (a: number, b: number, eps: number, msg: string): void => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} is not ${b}`);

/** Both fingers on the canvas. `gap` is the time between them. */
function down(f: Fixture, a: Pt, b: Pt, gap = 20, t0 = 1000): void {
  f.canvasEl.dispatchEvent(finger('pointerdown', a, 1, t0));
  f.canvasEl.dispatchEvent(finger('pointerdown', b, 2, t0 + gap));
}
/** Move both fingers to (a, b) and let the frame paint. */
async function to(f: Fixture, a: Pt, b: Pt, t = 1200): Promise<void> {
  f.canvasEl.dispatchEvent(finger('pointermove', a, 1, t));
  f.canvasEl.dispatchEvent(finger('pointermove', b, 2, t));
  await settle();
}
/** Lift both fingers; by default well past the two-finger tap's 500 ms. */
async function up(f: Fixture, a: Pt, b: Pt, t = 1700): Promise<void> {
  f.canvasEl.dispatchEvent(finger('pointerup', a, 1, t));
  f.canvasEl.dispatchEvent(finger('pointerup', b, 2, t + 10));
  await settle();
}
/** Two fingers `half` px either side of `c`, turned `deg` degrees (clockwise, y down). */
function turned(c: Pt, half: number, deg: number): [Pt, Pt] {
  const r = (deg * Math.PI) / 180, dx = Math.cos(r) * half, dy = Math.sin(r) * half;
  return [[c[0] - dx, c[1] - dy], [c[0] + dx, c[1] + dy]];
}

/** One 200 px box at (100, 100): fingers inside 144..256 press the box itself, not a grab zone. */
const ONE = (extra: Record<string, unknown> = {}): Box[] => [{ id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 200, rot: 0, ...extra } as Box];

// ── 1. pinch, travel, Scale ──────────────────────────────────────────────────

test('two fingers on a selected box scale it about their midpoint, and the pinch commits once', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    // What the stage's own pinch listens to: the moves that bubble up to the stage.
    let staged = 0;
    f.stageEl.addEventListener('pointermove', () => { staged++; });
    // The midpoint (170, 180) is off the box's centre (200, 200), so a pinch about it moves the box.
    down(f, [150, 180], [190, 180]);
    await to(f, [130, 180], [210, 180]); // the spread doubles
    assert.equal(geom(f.el('a')), '30px 20px 400px 400px', 'the preview grows about the midpoint');
    assert.equal(f.writes(), 0, 'nothing is written mid-pinch');
    assert.equal(staged, 0, 'the stage sees none of the pinch\'s moves');
    await up(f, [130, 180], [210, 180]);
    assert.deepEqual(rectOf(f.byId('a')), [30, 20, 400, 400]);
    assert.equal(f.writes(), 1, 'one commit for the whole pinch');
    assert.equal(f.zoom(), 1, 'and the view did not zoom under the fingers');
  } finally { f.destroy(); }
});

test('a pinch that only travels carries the selection with the midpoint', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    down(f, [160, 200], [240, 200]);
    await to(f, [190, 230], [270, 230]);
    await up(f, [190, 230], [270, 230]);
    assert.deepEqual(rectOf(f.byId('a')), [130, 130, 200, 200]);
    assert.equal(f.writes(), 1);
    assert.equal(f.zoom(), 1, 'the view did not pan or zoom');
  } finally { f.destroy(); }
});

test('a second finger on the bare stage beside the selection still takes the pinch, and nothing past the stage\'s capture sees that press', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    f.canvasEl.dispatchEvent(finger('pointerdown', [160, 200], 1, 1000));
    // Every other listener on the stage, the view's own pinch among them, sits behind the capture.
    let staged = 0;
    f.stageEl.addEventListener('pointerdown', () => { staged++; });
    f.stageEl.dispatchEvent(finger('pointerdown', [240, 200], 2, 1020));
    assert.equal(staged, 0, 'the press is stopped at the stage itself');
    await to(f, [120, 200], [280, 200]);
    await up(f, [120, 200], [280, 200]);
    assert.deepEqual(rectOf(f.byId('a')), [0, 0, 400, 400]);
    assert.equal(f.writes(), 1);
    assert.equal(f.zoom(), 1);
  } finally { f.destroy(); }
});

test('in Scale mode the pinch scales the content with the box', async () => {
  const f = mount(ONE({ fontSize: 20, strokeW: 2, radius: 8 }));
  try {
    f.select(['a']);
    await settle();
    press('k');
    await settle();
    down(f, [160, 200], [240, 200]);
    await to(f, [120, 200], [280, 200]);
    assert.match(f.el('a').style.transform, /scale\(2\)/, 'the preview grows the content at k');
    await up(f, [120, 200], [280, 200]);
    const a = f.byId('a');
    assert.deepEqual(rectOf(a), [0, 0, 400, 400]);
    assert.deepEqual([a.fontSize, a.strokeW, a.radius], [40, 4, 16]);
    assert.equal(f.writes(), 1);
  } finally { f.destroy(); }
});

test('outside Scale mode the pinch is a uniform resize: the content keeps its size', async () => {
  const f = mount(ONE({ fontSize: 20, strokeW: 2 }));
  try {
    f.select(['a']);
    await settle();
    down(f, [160, 200], [240, 200]);
    await to(f, [180, 200], [220, 200]);
    await up(f, [180, 200], [220, 200]);
    const a = f.byId('a');
    assert.deepEqual(rectOf(a), [150, 150, 100, 100]);
    assert.deepEqual([a.fontSize, a.strokeW], [20, 2]);
  } finally { f.destroy(); }
});

test('a peer row inserted between the last pinch frame and the lift: the pinch commits every row it previewed', async () => {
  for (const scale of [false, true]) {
    const f = mount([
      { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0, fontSize: 20 },
      { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0, fontSize: 20 },
      { id: 'c', kind: 'box', x: 700, y: 700, w: 50, h: 50, rot: 0, fontSize: 20 },
    ] as Box[]);
    const off = registerCanvasInteractions(f.runtime, { acquire: async () => ({ id: 'mine', preview() {}, finish() {} }) });
    try {
      f.select(['a', 'b']);
      await settle();
      if (scale) {
        press('k');
        await settle();
      }
      // The first finger on a, the second between the boxes; the spread doubles about (200, 150).
      down(f, [150, 150], [250, 150]);
      await to(f, [100, 150], [300, 150]);
      // After the last frame, a peer puts a row at the front: every row moves one place.
      f.write([{ id: 'z', kind: 'box', x: 800, y: 50, w: 40, h: 40, rot: 0 } as Box, ...f.rows()]);
      await settle();
      const before = f.writes();
      await up(f, [100, 150], [300, 150]);
      const tag = scale ? 'Scale mode' : 'Resize';
      assert.equal(f.writes() - before, 1, `${tag}: one commit`);
      assert.deepEqual(rectOf(f.byId('a')), [0, 50, 200, 200], `${tag}: a scaled`);
      assert.deepEqual(rectOf(f.byId('b')), [400, 50, 200, 200], `${tag}: b scaled`);
      assert.equal(f.byId('a').fontSize, scale ? 40 : 20, `${tag}: a's content follows the mode`);
      assert.deepEqual(rectOf(f.byId('c')), [700, 700, 50, 50], `${tag}: the row outside the pinch is untouched`);
    } finally { off(); f.destroy(); }
  }
});

// ── 2. twist ─────────────────────────────────────────────────────────────────

test('a twist under 10 degrees turns nothing and commits nothing', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    const [a0, b0] = turned([200, 200], 40, 0);
    down(f, a0, b0);
    const [a1, b1] = turned([200, 200], 40, 8);
    await to(f, a1, b1);
    assert.doesNotMatch(f.el('a').style.transform, /rotate/, 'no turn before the twist engages');
    await up(f, a1, b1);
    assert.equal(Number(f.byId('a').rot), 0);
    assert.equal(f.writes(), 0, 'a pinch that changed nothing is not an undo step');
  } finally { f.destroy(); }
});

test('past 10 degrees the turn counts from where it engaged and takes the magnet', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    const [a0, b0] = turned([200, 200], 40, 0);
    down(f, a0, b0);
    // Past the two-finger tap's 500 ms, so the pair is no longer a tap and a twist can engage.
    const [a1, b1] = turned([200, 200], 40, 12);
    await to(f, a1, b1, 1600);
    assert.doesNotMatch(f.el('a').style.transform, /rotate/, 'the frame that engages adds no jump');
    // 26 degrees of twist is 14 past the engage point: the magnet takes it to 15.
    const [a2, b2] = turned([200, 200], 40, 26);
    await to(f, a2, b2, 1700);
    assert.match(f.el('a').style.transform, /rotate\(15deg\)/);
    await up(f, a2, b2, 1800);
    const a = f.byId('a');
    assert.equal(Number(a.rot), 15);
    assert.deepEqual(rectOf(a), [100, 100, 200, 200], 'a single box turns about its own centre');
    assert.equal(f.writes(), 1);
  } finally { f.destroy(); }
});

test('a set turns about the centre of its bounds', async () => {
  const f = mount([
    { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0 },
    { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0 },
  ] as Box[]);
  try {
    f.select(['a', 'b']);
    await settle();
    const [a0, b0] = turned([200, 150], 50, 0); // the first finger on a, at (150, 150)
    down(f, a0, b0);
    const [a1, b1] = turned([200, 150], 50, 12);
    await to(f, a1, b1, 1600);
    const [a2, b2] = turned([200, 150], 50, 102);
    await to(f, a2, b2, 1700);
    await up(f, a2, b2, 1800);
    // The bounds' centre is (250, 150): a quarter turn swings a up to (200, 0) and b down to (200, 200).
    assert.deepEqual([...rectOf(f.byId('a')), Number(f.byId('a').rot)], [200, 0, 100, 100, 90]);
    assert.deepEqual([...rectOf(f.byId('b')), Number(f.byId('b').rot)], [200, 200, 100, 100, 90]);
    assert.equal(f.writes(), 1, 'the set commits in one step');
  } finally { f.destroy(); }
});

// ── 3. the hand-over ─────────────────────────────────────────────────────────

test('a finger that began a move hands it to the pinch without committing the move', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    f.canvasEl.dispatchEvent(finger('pointerdown', [160, 200], 1, 1000));
    f.canvasEl.dispatchEvent(finger('pointermove', [190, 200], 1, 1050));
    await settle();
    assert.equal(geom(f.el('a')), '130px 100px 200px 200px', 'the first finger is moving the box');
    f.canvasEl.dispatchEvent(finger('pointerdown', [270, 200], 2, 1100));
    assert.equal(geom(f.el('a')), '100px 100px 200px 200px', 'the move preview is put back');
    // The pinch starts from the fingers where they are now: (190, 200) and (270, 200).
    await to(f, [150, 200], [310, 200]);
    await up(f, [150, 200], [310, 200]);
    assert.deepEqual(rectOf(f.byId('a')), [-30, 0, 400, 400], 'scaled about (230, 200) from the start rows');
    assert.equal(f.writes(), 1, 'the move never committed');
  } finally { f.destroy(); }
});

// ── 4. the view keeps every other pair ───────────────────────────────────────

/** Spread two fingers to twice their distance, then lift them. */
async function spread(f: Fixture, a: Pt, b: Pt, gap = 20): Promise<void> {
  down(f, a, b, gap);
  const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const far = (p: Pt): Pt => [c[0] + (p[0] - c[0]) * 2, c[1] + (p[1] - c[1]) * 2];
  await to(f, far(a), far(b), 1000 + gap + 200);
  await up(f, far(a), far(b), 1000 + gap + 400);
}

test('two fingers on an unselected box zoom the view: the stage gets both fingers', async () => {
  const f = mount([...ONE(), { id: 'b', kind: 'box', x: 500, y: 500, w: 200, h: 200, rot: 0 } as Box]);
  try {
    f.select(['b']);
    await settle();
    await spread(f, [160, 200], [240, 200]);
    near(f.zoom(), 2, 0.05, 'the view zoomed by the spread');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200], 'the box under the fingers is untouched');
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('two fingers on the empty stage zoom the view, with a selection elsewhere', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    await spread(f, [560, 600], [640, 600]);
    near(f.zoom(), 2, 0.05, 'the view zoomed');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200]);
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('a second finger on the object bar ends the first finger\'s drag, and both fingers zoom the view', async () => {
  const f = mount([...ONE(), { id: 'b', kind: 'box', x: 500, y: 500, w: 200, h: 200, rot: 0 } as Box]);
  try {
    f.select(['b']);
    await settle();
    const bar = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar');
    assert.ok(bar, 'the object bar is on the stage');
    f.canvasEl.dispatchEvent(finger('pointerdown', [160, 200], 1, 1000));
    // The bar keeps its presses from the canvas and the stage, but its background is no
    // control, so the finger counts: the pair is the stage's all the same.
    bar!.dispatchEvent(finger('pointerdown', [240, 200], 2, 1020));
    await to(f, [120, 200], [280, 200]);
    await up(f, [120, 200], [280, 200]);
    near(f.zoom(), 2, 0.05, 'the view zoomed');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200], 'the box the first finger pressed did not move');
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('a second finger on the bare stage zooms the view and keeps the selection', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    const handles = (): number => f.stageEl.querySelectorAll('.fc-chrome .fc-handle').length;
    assert.ok(handles() > 0);
    // The first finger on the empty artboard, the second off it, on the stage itself.
    f.canvasEl.dispatchEvent(finger('pointerdown', [600, 600], 1, 1000));
    f.stageEl.dispatchEvent(finger('pointerdown', [680, 600], 2, 1020));
    await to(f, [560, 600], [720, 600]);
    await up(f, [560, 600], [720, 600]);
    near(f.zoom(), 2, 0.05, 'the view zoomed');
    assert.ok(handles() > 0, 'neither finger deselected');
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('a second finger far from a small selection leaves the pair to the view: the view zooms and the object keeps its size', async () => {
  const f = mount([{ id: 'a', kind: 'box', x: 300, y: 300, w: 40, h: 40, rot: 0 } as Box]);
  try {
    f.select(['a']);
    await settle();
    // The first finger on the selected box, the second 300 px away on the empty artboard.
    down(f, [320, 320], [620, 620]);
    await to(f, [300, 300], [700, 700]);
    await up(f, [300, 300], [700, 700]);
    assert.ok(f.zoom() > 1.2, `the view zoomed (${f.zoom()})`);
    assert.deepEqual(rectOf(f.byId('a')), [300, 300, 40, 40], 'the small box was not scaled');
    assert.equal(f.writes(), 0);
    // Within a finger's reach past the outline, the pair is the selection's.
    down(f, [320, 320], [354, 354], 20, 3000);
    await to(f, [300, 300], [374, 374], 3600);
    await up(f, [300, 300], [374, 374], 3700);
    assert.equal(f.writes(), 1, 'a second finger just past the corner still pinches the box');
  } finally { f.destroy(); }
});

test('a selection covering 60% of the stage or more leaves the fingers to the view', async () => {
  const f = mount([{ id: 'a', kind: 'box', x: 100, y: 100, w: 800, h: 800, rot: 0 } as Box]);
  try {
    f.select(['a']);
    await settle();
    await spread(f, [460, 500], [540, 500]);
    near(f.zoom(), 2, 0.05, 'the view zoomed');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 800, 800]);
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('a second finger more than 300 ms after the first leaves the pair to the view', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    await spread(f, [160, 200], [240, 200], 400);
    near(f.zoom(), 2, 0.05, 'the view zoomed');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200], 'and the first finger\'s move was cancelled');
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('an artboard in the selection leaves the pair to the view', async () => {
  const f = mount([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 300, h: 300, order: 0 },
    { id: 'a', kind: 'box', x: 400, y: 400, w: 200, h: 200, rot: 0 },
  ] as Box[], { frame: true });
  try {
    f.select(['f1', 'a']);
    await settle();
    await spread(f, [460, 500], [540, 500]);
    near(f.zoom(), 2, 0.05, 'the view zoomed');
    assert.deepEqual(rectOf(f.byId('a')), [400, 400, 200, 200]);
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('a selection running past the visible stage leaves the pair to the view', async () => {
  const f = mount([{ id: 'a', kind: 'box', x: 650, y: 100, w: 200, h: 200, rot: 0 } as Box]);
  try {
    // The view shows only the stage's first 800 px, so the box's right side is out of sight.
    f.viewEl.getBoundingClientRect = () => rect(0, 0, 800, NATIVE);
    f.select(['a']);
    await settle();
    await spread(f, [710, 200], [790, 200]);
    near(f.zoom(), 2, 0.05, 'the view zoomed');
    assert.deepEqual(rectOf(f.byId('a')), [650, 100, 200, 200]);
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('two fingers on a panel floating over the selection leave the selection alone', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    const panel = dom.window.document.createElement('div');
    panel.className = 'fc-popover';
    f.stageEl.appendChild(panel);
    panel.dispatchEvent(finger('pointerdown', [160, 200], 1, 1000));
    panel.dispatchEvent(finger('pointerdown', [240, 200], 2, 1020));
    await to(f, [120, 200], [280, 200]);
    await up(f, [120, 200], [280, 200]);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200], 'the box under the panel is untouched');
    assert.equal(f.writes(), 0);
    near(f.zoom(), 2, 0.05, 'the fingers zoomed the view');
  } finally { f.destroy(); }
});

test('a live text edit leaves the pair to the view, even when the first finger\'s press ends the edit', async () => {
  for (const onText of [true, false]) {
    const f = mount(ONE({ text: 'Hello' }));
    try {
      f.select(['a']);
      await settle();
      f.el('a').querySelector('.lolly-box-text')!.dispatchEvent(new W.MouseEvent('dblclick', { bubbles: true, clientX: 200, clientY: 200 }));
      await settle();
      const editor = f.canvasEl.querySelector<HTMLElement>('[contenteditable="true"]');
      assert.ok(editor, 'the text edit is live');
      // On the text the press keeps the edit; beside the text, on the box, the press ends the edit.
      (onText ? editor! : f.canvasEl).dispatchEvent(finger('pointerdown', [160, 200], 1, 1000));
      f.canvasEl.dispatchEvent(finger('pointerdown', [240, 200], 2, 1020));
      await to(f, [120, 200], [280, 200]);
      await up(f, [120, 200], [280, 200]);
      assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200], `${onText ? 'on' : 'beside'} the text: the box is untouched`);
      near(f.zoom(), 2, 0.05, 'the view zoomed');
    } finally { f.destroy(); }
  }
});

/** A canvas with a timeline: the box below is animated, its second key at 2000 ms. */
const TIMED = {
  ...CANVAS, startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed', enterField: 'enter', exitField: 'exit',
  enterMsField: 'enterMs', exitMsField: 'exitMs', muteField: 'mute', laneField: 'lane', kfField: 'kf',
};
const ANIMATED = (): Box[] => [{
  id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 100, rot: 0, start: 0, dur: 4, clipIn: 0, speed: 1, lane: '',
  kf: 't0_x0_y0*t2000_eo_x40_y10',
} as Box];

test('a row parked on a keyframe leaves the pair to the view, where one finger would pose the key', async () => {
  for (const atMs of [2000, 2500]) {
    const f = mount(ANIMATED(), { canvas: TIMED });
    try {
      const rail = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-timeline');
      assert.ok(rail, 'the canvas has a timeline');
      rail!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
      await settle();
      f.stageEl.dispatchEvent(new W.CustomEvent('fc-seek', { bubbles: true, detail: { atMs } }));
      f.select(['a']);
      await settle();
      const before = f.writes();
      // Inside the box at its base and at its pose, (140, 110) from 2000 ms on.
      await spread(f, [200, 160], [260, 160]);
      const a = f.byId('a');
      if (atMs === 2000) {
        near(f.zoom(), 2, 0.05, 'on the diamond the view zoomed');
        assert.equal(f.writes(), before, 'and nothing was written');
        assert.deepEqual([a.x, a.y, a.kf], [100, 100, 't0_x0_y0*t2000_eo_x40_y10']);
      } else {
        assert.equal(f.zoom(), 1, 'off the diamond the pair is a pinch');
        assert.equal(f.writes(), before + 1);
        assert.equal(a.w, 400, 'the base row scaled');
      }
    } finally { f.destroy(); }
  }
});

// ── 5. the tap, Escape and a cancel ──────────────────────────────────────────

test('a two-finger tap on the selection still opens the context menu and commits nothing', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    down(f, [180, 200], [220, 200]);
    await up(f, [180, 200], [220, 200], 1100);
    assert.ok(f.stageEl.querySelector('.fc-context-menu'), 'the menu opened');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200]);
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('a resting pair that drifts a few px moves nothing and commits nothing', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    down(f, [160, 200], [240, 200]);
    // Past the tap's 500 ms, the midpoint drifts 3 px: under a finger's drag threshold.
    await to(f, [163, 201], [243, 201], 1600);
    assert.equal(geom(f.el('a')), '100px 100px 200px 200px', 'the preview has not moved');
    await up(f, [163, 201], [243, 201]);
    assert.equal(f.writes(), 0, 'no undo step');
    assert.equal(f.stageEl.querySelector('.fc-context-menu'), null);
    // 12 px of travel is a move.
    down(f, [160, 200], [240, 200], 20, 3000);
    await to(f, [172, 200], [252, 200], 3600);
    await up(f, [172, 200], [252, 200], 3700);
    assert.deepEqual(rectOf(f.byId('a')), [112, 100, 200, 200]);
    assert.equal(f.writes(), 1);
  } finally { f.destroy(); }
});

test('a two-finger tap whose fingers roll or drift inside the tap\'s slop still opens the menu and changes nothing', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    // One finger rolls 1.5 px with the fingers 40 px apart: a 3.75% spread, past the 2% engage.
    down(f, [180, 200], [220, 200]);
    f.canvasEl.dispatchEvent(finger('pointermove', [221.5, 200], 2, 1060));
    await settle();
    assert.equal(geom(f.el('a')), '100px 100px 200px 200px', 'nothing previews while the pair can be a tap');
    await up(f, [180, 200], [221.5, 200], 1150);
    assert.ok(f.stageEl.querySelector('.fc-context-menu'), 'the menu opened');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200]);
    assert.equal(f.writes(), 0, 'the roll is no scale');
    for (const m of f.stageEl.querySelectorAll('.fc-context-menu')) m.remove();
    // Both fingers drift 11 px together: past the pinch's 10 px travel, inside the tap's 14 px.
    down(f, [180, 200], [220, 200], 20, 3000);
    await to(f, [191, 200], [231, 200], 3100);
    await up(f, [191, 200], [231, 200], 3150);
    assert.ok(f.stageEl.querySelector('.fc-context-menu'), 'the drifting tap opened the menu too');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200]);
    assert.equal(f.writes(), 0, 'the drift is no move');
  } finally { f.destroy(); }
});

test('a pinch past the tap\'s slop inside its window is no tap: it previews, commits and opens no menu', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    // 15 px a finger is past the tap's 14 px, 80 ms after the second finger came down.
    down(f, [150, 200], [250, 200]);
    await to(f, [135, 200], [265, 200], 1080);
    assert.equal(geom(f.el('a')), '70px 70px 260px 260px', 'the spread previews at once');
    await up(f, [135, 200], [265, 200], 1120);
    assert.equal(f.stageEl.querySelector('.fc-context-menu'), null, 'no menu');
    assert.deepEqual(rectOf(f.byId('a')), [70, 70, 260, 260]);
    assert.equal(f.writes(), 1, 'the pinch committed');
  } finally { f.destroy(); }
});

test('a double tap just outside a selection fits the view, though each tap lands in a grab zone first', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    f.view({ scale: 1.5, x: 40, y: 0 });
    // 10 px outside the e side, clear of its drawn handle: inside a finger's large zone.
    const tap = async (t: number): Promise<void> => {
      f.canvasEl.dispatchEvent(finger('pointerdown', [310, 150], 1, t));
      f.canvasEl.dispatchEvent(finger('pointerup', [310, 150], 1, t + 40));
      await settle();
    };
    await tap(5000);
    assert.deepEqual(f.view(), { scale: 1.5, x: 40, y: 0 }, 'one tap only deselects');
    await tap(5150);
    assert.deepEqual(f.view(), { scale: 1, x: 0, y: 0 }, 'the second tap fits the view');
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('a third finger neither ends the pinch nor starts anything', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    down(f, [160, 200], [240, 200]);
    f.canvasEl.dispatchEvent(finger('pointerdown', [600, 600], 3, 1060));
    await to(f, [120, 200], [280, 200]);
    f.canvasEl.dispatchEvent(finger('pointerup', [600, 600], 3, 1500));
    await up(f, [120, 200], [280, 200]);
    assert.deepEqual(rectOf(f.byId('a')), [0, 0, 400, 400], 'the pinch went on with its two fingers');
    assert.equal(f.writes(), 1);
    assert.equal(f.stageEl.querySelector('.fc-context-menu'), null);
  } finally { f.destroy(); }
});

test('Escape mid-pinch puts the selection back and commits nothing', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    down(f, [160, 200], [240, 200]);
    await to(f, [120, 200], [280, 200]);
    assert.equal(geom(f.el('a')), '0px 0px 400px 400px');
    assert.equal(press('Escape').defaultPrevented, true);
    assert.equal(geom(f.el('a')), '100px 100px 200px 200px', 'the preview is back on the model');
    await to(f, [100, 200], [300, 200], 1300);
    assert.equal(geom(f.el('a')), '100px 100px 200px 200px', 'and the fingers no longer drive the box');
    await up(f, [100, 200], [300, 200]);
    assert.equal(f.writes(), 0);
    assert.equal(f.zoom(), 1, 'the view stays as it was');
  } finally { f.destroy(); }
});

test('a pointercancel mid-pinch puts the selection back and commits nothing', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    down(f, [160, 200], [240, 200]);
    await to(f, [120, 200], [280, 200]);
    f.canvasEl.dispatchEvent(finger('pointercancel', [120, 200], 1, 1300));
    await settle();
    assert.equal(geom(f.el('a')), '100px 100px 200px 200px');
    f.canvasEl.dispatchEvent(finger('pointerup', [280, 200], 2, 1310));
    await settle();
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

// ── 6. after a pinch ─────────────────────────────────────────────────────────

test('after a pinch, the finger left down and a new finger zoom the view, whichever finger lifted first', async () => {
  for (const lifted of [1, 2]) {
    const f = mount(ONE());
    try {
      f.select(['a']);
      await settle();
      down(f, [160, 200], [240, 200]);
      await to(f, [120, 200], [280, 200]);
      const at: Record<number, Pt> = { 1: [120, 200], 2: [280, 200] };
      f.canvasEl.dispatchEvent(finger('pointerup', at[lifted]!, lifted, 1700));
      await settle();
      assert.deepEqual(rectOf(f.byId('a')), [0, 0, 400, 400], `finger ${lifted} up: the pinch committed`);
      assert.equal(f.writes(), 1);
      // The finger left down and a third on the empty stage spread to twice their distance.
      const kept = 3 - lifted, a = at[kept]!, b: Pt = [700, 700];
      const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const far = (p: Pt): Pt => [c[0] + (p[0] - c[0]) * 2, c[1] + (p[1] - c[1]) * 2];
      f.canvasEl.dispatchEvent(finger('pointerdown', b, 3, 2000));
      f.canvasEl.dispatchEvent(finger('pointermove', far(a), kept, 2200));
      f.canvasEl.dispatchEvent(finger('pointermove', far(b), 3, 2200));
      await settle();
      f.canvasEl.dispatchEvent(finger('pointerup', far(a), kept, 2400));
      f.canvasEl.dispatchEvent(finger('pointerup', far(b), 3, 2410));
      await settle();
      near(f.zoom(), 2, 0.05, `finger ${lifted} up first: the next pair zoomed the view`);
      assert.deepEqual(rectOf(f.byId('a')), [0, 0, 400, 400], 'and left the box as the pinch did');
      assert.equal(f.writes(), 1);
    } finally { f.destroy(); }
  }
});

test('a third finger the pinch held back zooms the view with the finger left once the pinch ends', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    down(f, [160, 200], [240, 200]);
    f.canvasEl.dispatchEvent(finger('pointerdown', [600, 600], 3, 1060));
    await to(f, [120, 200], [280, 200]);
    f.canvasEl.dispatchEvent(finger('pointerup', [120, 200], 1, 1700));
    await settle();
    assert.equal(f.writes(), 1, 'the first finger\'s lift committed the pinch');
    // Fingers 2 (280, 200) and 3 (600, 600) spread to twice their distance about (440, 400).
    f.canvasEl.dispatchEvent(finger('pointermove', [120, 0], 2, 1900));
    f.canvasEl.dispatchEvent(finger('pointermove', [760, 800], 3, 1900));
    await settle();
    f.canvasEl.dispatchEvent(finger('pointerup', [120, 0], 2, 2100));
    f.canvasEl.dispatchEvent(finger('pointerup', [760, 800], 3, 2110));
    await settle();
    near(f.zoom(), 2, 0.05, 'the two fingers left zoomed the view');
    assert.equal(f.writes(), 1);
  } finally { f.destroy(); }
});

test('a pointercancel on one pinch finger hands the fingers still down to the view', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    down(f, [160, 200], [240, 200]);
    f.canvasEl.dispatchEvent(finger('pointerdown', [600, 600], 3, 1060));
    await to(f, [120, 200], [280, 200]);
    f.canvasEl.dispatchEvent(finger('pointercancel', [120, 200], 1, 1300));
    await settle();
    assert.equal(geom(f.el('a')), '100px 100px 200px 200px', 'the cancel put the selection back');
    // Fingers 2 (280, 200) and 3 (600, 600) spread to twice their distance about (440, 400).
    f.canvasEl.dispatchEvent(finger('pointermove', [120, 0], 2, 1500));
    f.canvasEl.dispatchEvent(finger('pointermove', [760, 800], 3, 1500));
    await settle();
    f.canvasEl.dispatchEvent(finger('pointerup', [120, 0], 2, 1700));
    f.canvasEl.dispatchEvent(finger('pointerup', [760, 800], 3, 1710));
    await settle();
    assert.ok(f.zoom() > 1, `the two fingers left zoomed the view (zoom ${f.zoom()})`);
    near(f.zoom(), 2, 0.05, 'by their spread');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200], 'and left the box alone');
    assert.equal(f.writes(), 0, 'the cancelled pinch wrote nothing');
  } finally { f.destroy(); }
});

// ── 7. Safari ────────────────────────────────────────────────────────────────

test('Safari\'s own pinch events do not zoom the view while the selection is pinched', async () => {
  const f = mount(ONE());
  try {
    f.select(['a']);
    await settle();
    const gesture = (type: string, scale: number): Event => {
      const e = new W.Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { scale, clientX: 200, clientY: 200 });
      f.el('a').dispatchEvent(e);
      return e;
    };
    down(f, [160, 200], [240, 200]);
    assert.equal(gesture('gesturestart', 1).defaultPrevented, true, 'the page zoom is suppressed');
    assert.equal(gesture('gesturechange', 2).defaultPrevented, true);
    gesture('gestureend', 2);
    assert.equal(f.zoom(), 1, 'the stage did not zoom with them');
    await to(f, [120, 200], [280, 200]);
    await up(f, [120, 200], [280, 200]);
    assert.deepEqual(rectOf(f.byId('a')), [0, 0, 400, 400], 'the pinch itself went through');
    // With no pinch on the selection the same events zoom the view again.
    gesture('gesturestart', 1);
    gesture('gesturechange', 2);
    gesture('gestureend', 2);
    assert.ok(f.zoom() > 1, 'the view zooms once the pinch is over');
  } finally { f.destroy(); }
});
