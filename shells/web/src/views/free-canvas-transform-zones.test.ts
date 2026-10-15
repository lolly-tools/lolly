// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 311 M4 - the grab zones round a selection, pinned through the real
 * initFreeCanvas in jsdom (the harness of free-canvas-transform-modifiers.test.ts):
 *
 *   1. Each edge is an 8 px strip along its full length (centred on the edge, in screen
 *      px): a drag there resizes that one axis, on a turned box too, and on a
 *      multi-selection it drives the set's edge rule.
 *   2. Corners beat edges, and a mouse press just outside a corner turns the box; a
 *      finger there does not, since touch keeps the rotate handle.
 *   3. A zone press is provisional: a click, or travel under the threshold, replays
 *      through the ordinary click path (select another box, Shift toggles, narrow,
 *      deselect), Shift ignores the outer strip, and Escape drops the press.
 *   4. The small-object rule on the handles: 25 screen px hides the midpoints along that
 *      axis and stands the rest off the outline; 10 px drops the corners, and the box
 *      still moves.
 *   5. Cursors follow the turn on hover, are held for the drag and go on Escape.
 *   6. Artboards and locked rows have no rotate zone, and a locked row no zone at all.
 *   7. Zoomed: the canvas 2000 px wide on a 1000 px stage, so the zones keep their size
 *      in screen px and the visible stage clips them.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-transform-zones.test.ts
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
Reflect.set(globalThis, 'matchMedia', (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
Reflect.set(globalThis, 'ResizeObserver', class { observe() {} disconnect() {} });
Reflect.set(globalThis, 'CSS', Reflect.get(W, 'CSS') ?? { escape: (v: string) => String(v).replace(/[^\w-]/g, (c) => `\\${c}`) });

const { initFreeCanvas } = await import('./free-canvas.ts');

const NATIVE = 1000;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

interface Ptr { shift?: boolean; alt?: boolean; meta?: boolean; kind?: 'mouse' | 'pen' | 'touch'; buttons?: number }
function pointer(type: string, x: number, y: number, p: Ptr = {}): MouseEvent {
  const e = new W.MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0,
    shiftKey: !!p.shift, altKey: !!p.alt, metaKey: !!p.meta,
  });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: p.kind ?? 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: p.buttons ?? (type === 'pointermove' ? 1 : 0) });
  return e;
}
function press(name: string): void {
  dom.window.document.body.dispatchEvent(new W.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

const BASE_CFG = {
  idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  rotationField: 'rot', groupField: 'group', fontSizeField: 'fontSize',
  addKinds: [{ id: 'box', label: 'Box', seed: { kind: 'box' } }],
};
const FRAME_CFG = { frameField: 'frame', frameKind: 'frame', orderField: 'order', lockedField: 'locked' };

interface MountOpts {
  canvas?: Record<string, unknown>;
  frames?: boolean;
  /** Canvas px per native px: 2 draws the 1000 px canvas 2000 px wide on the 1000 px stage. */
  zoom?: number;
}
interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  runtime: object;
  byId(id: string): Record<string, unknown>;
  el(id: string): HTMLElement;
  writes(): number;
  select(ids: string[]): void;
  selection(): string[];
  handle(name: string): HTMLElement | null;
  destroy(): void;
}

function paint(canvasEl: HTMLElement, b: Box): void {
  const el = dom.window.document.createElement('div');
  el.className = 'lolly-box';
  el.setAttribute('data-box-id', String(b.id));
  el.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
  if (Number(b.rot)) el.style.transform = `rotate(${b.rot}deg)`;
  canvasEl.appendChild(el);
}

function mount(seed: Box[], o: MountOpts = {}): Fixture {
  const doc = dom.window.document;
  const viewEl = doc.createElement('div');
  const stageEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  doc.body.appendChild(viewEl);
  const zoom = o.zoom ?? 1;
  viewEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE * zoom, NATIVE * zoom);
  for (const b of seed) if (String(b.kind) === 'box') paint(canvasEl, b);

  const model = new Map<string, unknown>([['boxes', seed]]);
  const subs: Array<() => void> = [];
  let writes = 0;
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { writes++; model.set(id, value); for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: { ...BASE_CFG, ...o.canvas } as never, fields: [] },
    ...(o.frames && { frame: FRAME_CFG }),
    nativeW: NATIVE, nativeH: NATIVE,
  });
  const boxes = (): Box[] => model.get('boxes') as Box[];
  return {
    stageEl, canvasEl, runtime,
    byId: (id) => boxes().find((b) => b.id === id)! as Record<string, unknown>,
    el: (id) => canvasEl.querySelector<HTMLElement>(`[data-box-id="${id}"]`)!,
    writes: () => writes,
    select: (ids) => handle.applyUi({ select: ids } as never),
    selection: () => [...handle.design.selection.get()].sort(),
    handle: (name) => stageEl.querySelector<HTMLElement>(`.fc-chrome .fc-h-${name}`),
    destroy() {
      handle.destroy(); viewEl.remove();
      for (const n of [...doc.body.children]) if (!n.hasAttribute('data-a11y-live')) n.remove();
    },
  };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 25)); for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };
const rectOf = (b: Record<string, unknown>): number[] => [b.x, b.y, b.w, b.h].map(Number);
const at = (el: HTMLElement): [number, number] => [parseFloat(el.style.left), parseFloat(el.style.top)];
const cursor = (f: Fixture): string | null => f.stageEl.getAttribute('data-fc-cursor');
const held = (f: Fixture): boolean => f.stageEl.hasAttribute('data-fc-cursor-held');

/** Press at (x, y), travel to (tx, ty) and release there. */
async function drag(f: Fixture, x: number, y: number, tx: number, ty: number, p: Ptr = {}): Promise<void> {
  f.canvasEl.dispatchEvent(pointer('pointerdown', x, y, p));
  f.canvasEl.dispatchEvent(pointer('pointermove', tx, ty, p));
  await settle();
  f.canvasEl.dispatchEvent(pointer('pointerup', tx, ty, p));
  await settle();
}
/** Press and release at (x, y): a click. */
async function click(f: Fixture, x: number, y: number, p: Ptr = {}): Promise<void> {
  f.canvasEl.dispatchEvent(pointer('pointerdown', x, y, p));
  f.canvasEl.dispatchEvent(pointer('pointerup', x, y, p));
  await settle();
}
/** Hover the pointer, no button down, and wait for the cursor frame. */
async function hover(f: Fixture, x: number, y: number, p: Ptr = {}): Promise<string | null> {
  f.canvasEl.dispatchEvent(pointer('pointermove', x, y, { ...p, buttons: 0 }));
  await settle();
  return cursor(f);
}

/** A 200 x 100 box at (100, 100): its e edge runs down x 300 from y 100 to 200. */
const ONE = (extra: Record<string, unknown> = {}): Box => ({ id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 100, rot: 0, ...extra } as Box);
/** Two 100 px squares side by side: the set's bounds run (100,100) to (400,200). */
const PAIR = (): Box[] => ([
  { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0 },
  { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0 },
] as Box[]);

// ── 1. Edge strips ──────────────────────────────────────────────────────────────

test('a press 3 px outside the e edge, clear of every handle, resizes the width only', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 303, 120), 'ew-resize', 'the strip shows the resize cursor');
    await drag(f, 303, 120, 343, 160);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 240, 100], 'w only: the height and the origin stay');
    assert.equal(f.writes(), 1, 'one undo step');
    assert.deepEqual(f.selection(), ['a']);
    // Inside the edge too: the strip is centred on the outline.
    await drag(f, 337, 180, 317, 180);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 220, 100]);
  } finally { f.destroy(); }
});

test('on a box turned 90 degrees the strip and its cursor turn with the box', async () => {
  // Turned about its centre (200, 150), the box's own e edge is the bottom of the screen
  // at y 250, from x 150 to 250.
  const f = mount([ONE({ rot: 90 })]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 180, 253), 'ns-resize', 'the e strip is at the bottom and reads up and down');
    assert.equal(f.handle('e')!.dataset.fcDir, 'ns-resize', 'and so does the e handle');
    assert.equal(f.handle('n')!.dataset.fcDir, 'ew-resize');
    assert.equal(f.handle('ne')!.dataset.fcDir, 'nwse-resize');
    await drag(f, 180, 253, 185, 293);
    const a = f.byId('a');
    assert.deepEqual([Number(a.w), Number(a.h), Number(a.rot)], [240, 100, 90], 'down the screen is the box\'s width');
    // The w edge (at the top of the screen) held still: the centre moved 20 px down.
    assert.deepEqual([Number(a.x) + Number(a.w) / 2, Number(a.y) + Number(a.h) / 2], [200, 170]);
  } finally { f.destroy(); }
});

test('corners beat edges where a corner zone and both strips overlap', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    // (303, 97) is in the n strip, the e strip and the ne corner zone.
    assert.equal(await hover(f, 303, 97), 'nesw-resize');
    await drag(f, 303, 97, 343, 77);
    assert.deepEqual(rectOf(f.byId('a')), [100, 80, 240, 120], 'both axes, from the sw corner');
  } finally { f.destroy(); }
});

test('a multi-selection\'s strips drive the set\'s edge rule', async () => {
  const f = mount(PAIR());
  try {
    f.select(['a', 'b']);
    await settle();
    // 3 px past the set's e edge at x 400, clear of its e and ne handles.
    assert.equal(await hover(f, 403, 125), 'ew-resize');
    await drag(f, 403, 125, 553, 140);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 150, 100], 'one axis, from the w edge');
    assert.deepEqual(rectOf(f.byId('b')), [400, 100, 150, 100]);
    assert.equal(f.writes(), 1);
  } finally { f.destroy(); }
  // A set holding a turned member keeps its proportions, as its e handle does.
  const turned = PAIR().map((b) => (b.id === 'b' ? { ...b, rot: 30 } : b));
  const g = mount(turned);
  try {
    g.select(['a', 'b']);
    await settle();
    const e = at(g.handle('e')!);
    const w = e[0] - at(g.handle('w')!)[0];
    assert.equal(await hover(g, e[0] + 3, 125), 'ew-resize');
    assert.equal(g.stageEl.hasAttribute('data-fc-cursor-scale'), true, 'with the scale cursor');
    await drag(g, e[0] + 3, 125, e[0] + 3 + w / 2, 125);
    assert.deepEqual(rectOf(g.byId('a')), [100, 75, 150, 150], 'one factor for both axes');
  } finally { g.destroy(); }
});

// ── 2. Corners and rotate zones ─────────────────────────────────────────────────

/** The point at `deg` degrees round the centre (200, 150) of ONE from the press (px, py). */
function turnTo(px: number, py: number, deg: number): [number, number] {
  const c = { x: 200, y: 150 };
  const a = Math.atan2(py - c.y, px - c.x) + (deg * Math.PI) / 180, r = Math.hypot(px - c.x, py - c.y);
  return [c.x + r * Math.cos(a), c.y + r * Math.sin(a)];
}

test('a mouse press 10 px outside a corner turns the box; a finger there does not', async () => {
  // (310, 90) is 10 px out from the ne corner (300, 100) on both axes: past the corner
  // zone, in the rotate band. The box turns about its centre (200, 150).
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 310, 90), 'rotate-ne', 'the rotate cursor wraps the ne corner');
    f.canvasEl.dispatchEvent(pointer('pointerdown', 310, 90));
    const [x, y] = turnTo(310, 90, 40);
    f.canvasEl.dispatchEvent(pointer('pointermove', x, y));
    await settle();
    assert.equal(cursor(f), 'rotate-ne', 'held through the drag');
    assert.equal(held(f), true);
    f.canvasEl.dispatchEvent(pointer('pointerup', x, y));
    await settle();
    assert.ok(Math.abs(Number(f.byId('a').rot) - 40) < 0.05, `turned 40 degrees, not ${f.byId('a').rot}`);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 100], 'about its centre');
    assert.equal(held(f), false, 'the cursor goes with the drag');
  } finally { f.destroy(); }
  // A finger keeps the rotate handle: 18 px out is past a touch corner, and no zone.
  const g = mount([ONE()]);
  try {
    g.select(['a']);
    await settle();
    const [x, y] = turnTo(318, 82, 40);
    await drag(g, 318, 82, x, y, { kind: 'touch' });
    assert.equal(Number(g.byId('a').rot), 0, 'touch keeps the rotate handle instead');
    assert.deepEqual(rectOf(g.byId('a')), [100, 100, 200, 100]);
    assert.equal(g.writes(), 0);
  } finally { g.destroy(); }
});

test('over another object a mouse press just outside a corner resizes, as far out as the corner handle always reached', async () => {
  // A full-bleed background under the selected box: the usual poster layout.
  const f = mount([
    { id: 'bg', kind: 'box', x: 0, y: 0, w: 1000, h: 1000, rot: 0 },
    { id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 200, rot: 0 },
  ] as Box[]);
  try {
    f.select(['a']);
    await settle();
    // 9 px out on the se diagonal: past the corner handle's square, inside its old fat target.
    assert.equal(await hover(f, 309, 309), 'nwse-resize', 'the corner cursor, not the background\'s');
    await drag(f, 309, 309, 349, 349);
    assert.deepEqual(f.selection(), ['a']);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 240, 240], 'the corner resized the box');
    assert.deepEqual(rectOf(f.byId('bg')), [0, 0, 1000, 1000], 'and the background stayed');
    // A click there is the handle's: nothing changes.
    await click(f, 349, 349);
    assert.deepEqual(f.selection(), ['a']);
    assert.equal(f.writes(), 1);
    // 30 px out the background takes the press, as it always did.
    await drag(f, 370, 370, 410, 410);
    assert.deepEqual(f.selection(), ['bg']);
    assert.deepEqual(rectOf(f.byId('bg')), [40, 40, 1000, 1000]);
  } finally { f.destroy(); }
});

test('an artboard and a locked row have no rotate zone, and a locked row no zone at all', async () => {
  const f = mount([
    { id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300, order: 0 },
  ] as Box[], { frames: true });
  try {
    f.select(['f1']);
    await settle();
    assert.equal(await hover(f, 503, 200), 'ew-resize', 'an artboard still resizes from its strips');
    assert.equal(await hover(f, 518, 82), null, 'but never turns');
    await drag(f, 518, 82, 560, 160);
    assert.ok(!Number(f.byId('f1').rot), 'no turn');
    assert.deepEqual(rectOf(f.byId('f1')), [100, 100, 400, 300]);
  } finally { f.destroy(); }
  const g = mount([ONE({ locked: true })], { frames: true });
  try {
    g.select(['a']);
    await settle();
    assert.equal(await hover(g, 303, 120), null, 'no strip');
    assert.equal(await hover(g, 318, 82), null, 'no rotate zone');
    await drag(g, 303, 120, 343, 120);
    await drag(g, 318, 82, 330, 120);
    assert.deepEqual(rectOf(g.byId('a')), [100, 100, 200, 100]);
    assert.ok(!Number(g.byId('a').rot));
  } finally { g.destroy(); }
});

// ── 3. A zone press is provisional ──────────────────────────────────────────────

test('a click in a strip selects as it always did', async () => {
  // Another box under the strip takes the click: a sits under b, whose left part covers
  // the inside half of a's e strip.
  const f = mount([ONE(), { id: 'b', kind: 'box', x: 290, y: 100, w: 50, h: 50, rot: 0 } as Box]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 297, 120), null, 'no zone over another object');
    await click(f, 297, 120);
    assert.deepEqual(f.selection(), ['b'], 'the box under the pointer is picked');
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
  // Shift on the selected box toggles the box off, as a Shift-click always has.
  const g = mount([ONE()]);
  try {
    g.select(['a']);
    await settle();
    await click(g, 297, 120, { shift: true });
    assert.deepEqual(g.selection(), [], 'Shift toggles');
    // A click on empty canvas in the outer strip deselects.
    g.select(['a']);
    await settle();
    await click(g, 303, 120);
    assert.deepEqual(g.selection(), []);
    assert.equal(g.writes(), 0);
  } finally { g.destroy(); }
  // A plain click on a member in the set's strip narrows the set to that member.
  const h = mount(PAIR());
  try {
    h.select(['a', 'b']);
    await settle();
    await click(h, 397, 125);
    assert.deepEqual(h.selection(), ['b']);
    assert.equal(h.writes(), 0);
  } finally { h.destroy(); }
});

test('travel under the threshold is a click: 3 px for a mouse, 8 px for a finger', async () => {
  for (const [kind, travel] of [['mouse', 3], ['touch', 8], ['pen', 8]] as const) {
    const f = mount(PAIR());
    try {
      f.select(['a', 'b']);
      await settle();
      await drag(f, 397, 125, 397 + travel, 125, { kind });
      assert.deepEqual(rectOf(f.byId('b')), [300, 100, 100, 100], `${kind}: nothing resized`);
      assert.deepEqual(f.selection(), ['b'], `${kind}: the click narrowed the set`);
      assert.equal(f.writes(), 0);
    } finally { f.destroy(); }
  }
  // Just past the threshold the same press resizes.
  const f = mount(PAIR());
  try {
    f.select(['a', 'b']);
    await settle();
    await drag(f, 397, 125, 401, 125);
    const b = rectOf(f.byId('b'));
    assert.equal(b[0]! + b[2]!, 404, '4 px of travel is a drag: the set\'s e edge follows');
    assert.deepEqual(f.selection(), ['a', 'b']);
  } finally { f.destroy(); }
});

test('Shift or Cmd held at the press ignores the outer strip', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 303, 120, { shift: true }), null);
    assert.equal(await hover(f, 297, 120, { shift: true }), 'ew-resize', 'the inner half stays a strip');
    await drag(f, 303, 120, 343, 160, { shift: true });
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 100], 'an additive marquee, not a resize');
    assert.deepEqual(f.selection(), ['a'], 'which keeps the selection');
    await drag(f, 303, 120, 343, 160, { meta: true });
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 100]);
    // Shift on the inner half drags with Shift: the aspect is kept.
    await drag(f, 297, 120, 337, 120, { shift: true });
    assert.deepEqual(rectOf(f.byId('a')), [100, 90, 240, 120], 'from the w edge midpoint');
  } finally { f.destroy(); }
});

test('Escape drops a held zone press, so the release does nothing', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerdown', 303, 120));
    press('Escape');
    f.canvasEl.dispatchEvent(pointer('pointermove', 343, 120));
    f.canvasEl.dispatchEvent(pointer('pointerup', 343, 120));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 100], 'no resize');
    assert.deepEqual(f.selection(), ['a'], 'and no click: the selection stays, not cleared by Escape or a replay');
  } finally { f.destroy(); }
});

test('a held press whose release never came is dropped by the next press', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    // Let go outside the window: no pointerup reaches the page.
    f.canvasEl.dispatchEvent(pointer('pointerdown', 303, 120));
    await drag(f, 200, 150, 230, 150);
    assert.deepEqual(rectOf(f.byId('a')), [130, 100, 200, 100], 'the next press moves the box; the old strip press does not resume');
  } finally { f.destroy(); }
});

test('a press on the backdrop past the artboard resizes: a mouse in its strip, a finger in its large zone', async () => {
  // The canvas drawn at half size, (0, 0) to (500, 500) on the 1000 px stage: the e edge
  // of a box against its right side is the canvas edge at x 500, and the outer half of
  // its strip is on the backdrop.
  const f = mount([{ id: 'r', kind: 'box', x: 800, y: 100, w: 200, h: 100, rot: 0 } as Box], { zoom: 0.5 });
  try {
    f.select(['r']);
    await settle();
    assert.equal(await hover(f, 503, 70), 'ew-resize');
    f.stageEl.dispatchEvent(pointer('pointerdown', 503, 70));
    // The press captures the pointer on the canvas, so the rest of the drag arrives there.
    f.canvasEl.dispatchEvent(pointer('pointermove', 543, 70));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 543, 70));
    await settle();
    assert.deepEqual(rectOf(f.byId('r')), [800, 100, 280, 100], '40 screen px at half size is 80 native px');
    // A click in the same strip (its e edge is now at x 540) deselects, as a backdrop click does.
    f.stageEl.dispatchEvent(pointer('pointerdown', 543, 70));
    f.canvasEl.dispatchEvent(pointer('pointerup', 543, 70));
    await settle();
    assert.deepEqual(f.selection(), []);
    // A finger gets the large zones, whose handles let the press through (plan 311 M5):
    // the box is 140 x 50 on screen, too short for them inside, so they lie outside it,
    // and the press is the zone's before the stage can pan.
    f.select(['r']);
    await settle();
    f.stageEl.dispatchEvent(pointer('pointerdown', 543, 70, { kind: 'touch' }));
    f.canvasEl.dispatchEvent(pointer('pointermove', 583, 70, { kind: 'touch' }));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 583, 70, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('r')), [800, 100, 360, 100]);
    // Past every zone the stage pans under a finger, and a tap deselects.
    f.stageEl.dispatchEvent(pointer('pointerdown', 700, 70, { kind: 'touch' }));
    f.stageEl.dispatchEvent(pointer('pointerup', 700, 70, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('r')), [800, 100, 360, 100]);
    assert.deepEqual(f.selection(), []);
  } finally { f.destroy(); }
});

// ── 4. The small-object rule ────────────────────────────────────────────────────

test('a 20 px box hides its midpoint handles and stands its corners off the outline', async () => {
  const f = mount([{ id: 's', kind: 'box', x: 100, y: 100, w: 20, h: 20, rot: 0 } as Box]);
  try {
    f.select(['s']);
    await settle();
    for (const h of ['n', 'e', 's', 'w']) assert.equal(f.handle(h)!.hidden, true, `${h} hidden`);
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-handle').length, 9, 'the elements stay');
    assert.deepEqual(at(f.handle('nw')!), [88, 88]);
    assert.deepEqual(at(f.handle('ne')!), [132, 88]);
    assert.deepEqual(at(f.handle('se')!), [132, 132]);
    assert.deepEqual(at(f.handle('sw')!), [88, 132]);
    assert.equal(f.handle('nw')!.hidden, false);
    assert.equal(f.handle('nw')!.hasAttribute('data-outward'), true, 'hit on its own square, off the box');
    assert.equal(f.handle('rotate')!.hidden, false);
  } finally { f.destroy(); }
  // Only the narrow axis: a 20 x 100 box keeps e and w, stood off to the sides.
  const g = mount([{ id: 't', kind: 'box', x: 100, y: 100, w: 20, h: 100, rot: 0 } as Box]);
  try {
    g.select(['t']);
    await settle();
    assert.deepEqual([g.handle('n')!.hidden, g.handle('s')!.hidden, g.handle('e')!.hidden], [true, true, false]);
    assert.deepEqual(at(g.handle('e')!), [132, 150]);
    assert.deepEqual(at(g.handle('w')!), [88, 150]);
  } finally { g.destroy(); }
  // A box that grows past the rule puts its handles back on the outline.
  const h = mount([ONE()]);
  try {
    h.select(['a']);
    await settle();
    assert.deepEqual(at(h.handle('ne')!), [300, 100]);
    assert.equal(h.handle('ne')!.hasAttribute('data-outward'), false);
  } finally { h.destroy(); }
});

test('an 8 px box drops its corners too, and a drag on the box moves the box', async () => {
  const f = mount([{ id: 't', kind: 'box', x: 100, y: 100, w: 8, h: 8, rot: 0 } as Box]);
  try {
    f.select(['t']);
    await settle();
    for (const h of ['ne', 'se', 'sw', 'nw']) assert.equal(f.handle(h)!.hidden, true, `${h} hidden`);
    // With no corner to crowd, each side keeps its midpoint, stood off the box.
    for (const h of ['n', 'e', 's', 'w']) {
      assert.equal(f.handle(h)!.hidden, false, `${h} shown`);
      assert.equal(f.handle(h)!.hasAttribute('data-outward'), true, `${h} stands off`);
    }
    assert.deepEqual(at(f.handle('e')!), [120, 104]);
    await drag(f, 104, 104, 154, 124);
    assert.deepEqual(rectOf(f.byId('t')), [150, 120, 8, 8], 'moved, not resized');
    // Its strips sit outside the box, and still resize the box.
    await drag(f, 162, 124, 192, 124);
    assert.deepEqual(rectOf(f.byId('t')), [150, 120, 38, 8]);
  } finally { f.destroy(); }
});

// ── 5. Cursors ──────────────────────────────────────────────────────────────────

test('the cursor is held for the whole drag and goes on Escape', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 303, 120), 'ew-resize');
    assert.equal(held(f), false, 'hover only');
    assert.equal(await hover(f, 200, 150), null, 'the inside is no zone');
    f.canvasEl.dispatchEvent(pointer('pointerdown', 303, 120));
    f.canvasEl.dispatchEvent(pointer('pointermove', 343, 120));
    await settle();
    assert.equal(cursor(f), 'ew-resize');
    assert.equal(held(f), true, 'held for the drag');
    // Moving over the inside does not swap the cursor mid-drag.
    f.canvasEl.dispatchEvent(pointer('pointermove', 200, 150));
    await settle();
    assert.equal(cursor(f), 'ew-resize');
    press('Escape');
    await settle();
    assert.equal(cursor(f), null, 'gone with the cancel');
    assert.equal(held(f), false);
    f.canvasEl.dispatchEvent(pointer('pointerup', 200, 150));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 100], 'and nothing committed');
    assert.equal(f.writes(), 0);
    // A handle drag holds its own cursor the same way.
    const e = f.handle('e')!;
    const [x, y] = at(e);
    e.dispatchEvent(pointer('pointerdown', x, y));
    assert.deepEqual([cursor(f), held(f)], ['ew-resize', true]);
    f.canvasEl.dispatchEvent(pointer('pointerup', x, y));
    await settle();
    assert.equal(held(f), false);
  } finally { f.destroy(); }
});

test('in Scale mode a strip shows the scale cursor and scales the content', async () => {
  const f = mount([ONE({ fontSize: 20 })]);
  try {
    f.select(['a']);
    await settle();
    press('k');
    await settle();
    assert.equal(await hover(f, 303, 120), 'ew-resize');
    assert.equal(f.stageEl.hasAttribute('data-fc-cursor-scale'), true);
    assert.equal(f.handle('e')!.dataset.fcDir, 'ew-resize', 'the e handle names its direction');
    assert.equal(f.stageEl.querySelector('.fc-chrome')!.hasAttribute('data-scale'), true, 'which Scale mode draws as the scale cursor');
    await drag(f, 303, 120, 403, 120);
    assert.deepEqual(rectOf(f.byId('a')), [100, 75, 300, 150], 'uniform from the axis, about the w edge');
    assert.equal(f.byId('a').fontSize, 30);
  } finally { f.destroy(); }
});

// ── 6. Zoomed ───────────────────────────────────────────────────────────────────

test('zoomed in: the strips keep their screen size and the visible stage clips them', async () => {
  // The 1000 px canvas drawn 2000 px wide: the box is (200, 200) to (600, 400) on screen.
  const f = mount([ONE()], { zoom: 2 });
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 603, 240), 'ew-resize', '3 screen px out is in the strip');
    assert.equal(await hover(f, 606, 240), null, '6 screen px out is not, though it is 3 native px');
    await drag(f, 606, 240, 646, 250);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 100], 'outside the strip: a marquee');
    f.select(['a']);
    await settle();
    await drag(f, 603, 240, 643, 250);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 220, 100], '40 screen px is 20 native px');
  } finally { f.destroy(); }
  // A box running off the stage's right side has no zone past the stage.
  const g = mount([ONE({ x: 300, w: 400 })], { zoom: 2 });
  try {
    g.select(['a']);
    await settle();
    assert.equal(await hover(g, 597, 240), 'ew-resize', 'the w strip is on screen');
    assert.equal(await hover(g, 1403, 240), null, 'the e strip is off the stage');
  } finally { g.destroy(); }
});

// ── 7. On an artboard ───────────────────────────────────────────────────────────

/** Artboard f1 covers the canvas, and the boxes sit on the artboard, as a Design document's do. */
const BOARD = { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1000, h: 1000, order: 0 } as Box;
const onBoard = (b: Box): Box => ({ ...b, frame: 'f1' } as Box);

test('on an artboard the outer strip, the outer corner and the rotate zone transform the box', async () => {
  const strip = mount([BOARD, onBoard(ONE())], { frames: true });
  try {
    strip.select(['a']);
    await settle();
    assert.equal(await hover(strip, 303, 120), 'ew-resize', 'the artboard under the outer strip counts as nothing');
    await drag(strip, 303, 120, 343, 160);
    assert.deepEqual(rectOf(strip.byId('a')), [100, 100, 240, 100]);
    assert.deepEqual(rectOf(strip.byId('f1')), [0, 0, 1000, 1000], 'the artboard stays put');
    assert.deepEqual(strip.selection(), ['a']);
  } finally { strip.destroy(); }
  const corner = mount([BOARD, onBoard(ONE())], { frames: true });
  try {
    corner.select(['a']);
    await settle();
    assert.equal(await hover(corner, 303, 97), 'nesw-resize');
    await drag(corner, 303, 97, 343, 77);
    assert.deepEqual(rectOf(corner.byId('a')), [100, 80, 240, 120]);
    assert.deepEqual(rectOf(corner.byId('f1')), [0, 0, 1000, 1000]);
  } finally { corner.destroy(); }
  const turn = mount([BOARD, onBoard(ONE())], { frames: true });
  try {
    turn.select(['a']);
    await settle();
    assert.equal(await hover(turn, 310, 90), 'rotate-ne');
    const [x, y] = turnTo(310, 90, 40);
    await drag(turn, 310, 90, x, y);
    assert.ok(Math.abs(Number(turn.byId('a').rot) - 40) < 0.05, `turned 40 degrees, not ${turn.byId('a').rot}`);
    assert.deepEqual(rectOf(turn.byId('f1')), [0, 0, 1000, 1000]);
    assert.deepEqual(turn.selection(), ['a']);
  } finally { turn.destroy(); }
});

test('on an artboard a click in an outer zone still selects the artboard', async () => {
  const f = mount([BOARD, onBoard(ONE())], { frames: true });
  try {
    f.select(['a']);
    await settle();
    await click(f, 303, 120);
    assert.deepEqual(f.selection(), ['f1'], 'the click replays and picks the artboard, as it always did');
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('on an artboard a set\'s strip works across the gap between its members', async () => {
  const f = mount([BOARD, ...PAIR().map(onBoard)], { frames: true });
  try {
    f.select(['a', 'b']);
    await settle();
    // (250, 97) is on the set's n edge, over the artboard between a and b.
    assert.equal(await hover(f, 250, 97), 'ns-resize');
    assert.equal(await hover(f, 410, 90), 'rotate-ne', 'and the set turns from just outside a corner');
    await drag(f, 250, 97, 260, 77);
    assert.deepEqual(rectOf(f.byId('a')), [100, 80, 100, 120], 'one axis, from the s edge');
    assert.deepEqual(rectOf(f.byId('b')), [300, 80, 100, 120]);
    assert.deepEqual(rectOf(f.byId('f1')), [0, 0, 1000, 1000]);
    assert.deepEqual(f.selection(), ['a', 'b']);
  } finally { f.destroy(); }
});

test('an 8 px box on an artboard resizes from its outside strip, and the artboard stays', async () => {
  const f = mount([BOARD, onBoard({ id: 't', kind: 'box', x: 100, y: 100, w: 8, h: 8, rot: 0 } as Box)], { frames: true });
  try {
    f.select(['t']);
    await settle();
    assert.equal(await hover(f, 112, 104), 'ew-resize');
    await drag(f, 112, 104, 142, 104);
    assert.deepEqual(rectOf(f.byId('t')), [100, 100, 38, 8]);
    assert.deepEqual(rectOf(f.byId('f1')), [0, 0, 1000, 1000]);
    assert.deepEqual(f.selection(), ['t']);
  } finally { f.destroy(); }
});

test('a press in the band round a selected hairline or tiny box moves the box, for a mouse, a pen and a finger', async () => {
  const kinds = ['mouse', 'pen', 'touch'] as const;
  for (const kind of kinds) {
    // A 200 x 2 rule: 3 px below its top edge is 1 px off the rule, inside the 10 px band.
    const f = mount([{ id: 'r', kind: 'box', x: 100, y: 300, w: 200, h: 2, rot: 0 } as Box]);
    try {
      f.select(['r']);
      await settle();
      await drag(f, 200, 304, 240, 334, { kind });
      assert.deepEqual(f.selection(), ['r'], `${kind}: the rule stays selected`);
      assert.deepEqual(rectOf(f.byId('r')), [140, 330, 200, 2], `${kind}: and moves`);
      assert.equal(f.writes(), 1, `${kind}: one undo step`);
    } finally { f.destroy(); }
    // A 6 px box: 1 px past its e side.
    const g = mount([{ id: 't', kind: 'box', x: 300, y: 300, w: 6, h: 6, rot: 0 } as Box]);
    try {
      g.select(['t']);
      await settle();
      await drag(g, 307, 303, 347, 343, { kind });
      assert.deepEqual(g.selection(), ['t'], `${kind}: the tiny box stays selected`);
      assert.deepEqual(rectOf(g.byId('t')), [340, 340, 6, 6], `${kind}: and moves`);
    } finally { g.destroy(); }
  }
  // Past the band a mouse press is a marquee on the empty canvas, as before.
  const h = mount([{ id: 'r', kind: 'box', x: 100, y: 300, w: 200, h: 2, rot: 0 } as Box]);
  try {
    h.select(['r']);
    await settle();
    await click(h, 200, 330);
    assert.deepEqual(h.selection(), [], 'a click well clear of the rule deselects');
  } finally { h.destroy(); }
});

// ── 8. Thin boxes keep a handle for their length ────────────────────────────────

test('a 400 x 2 rule keeps its end handles, and the e handle lengthens the rule', async () => {
  const f = mount([{ id: 'r', kind: 'box', x: 100, y: 100, w: 400, h: 2, rot: 0 } as Box]);
  try {
    f.select(['r']);
    await settle();
    for (const h of ['ne', 'se', 'sw', 'nw']) assert.equal(f.handle(h)!.hidden, true, `${h} hidden`);
    for (const h of ['e', 'w', 'n', 's']) assert.equal(f.handle(h)!.hidden, false, `${h} shown`);
    const e = f.handle('e')!;
    const [x, y] = at(e);
    assert.deepEqual([x, y], [512, 101], 'stood off the end of the rule');
    e.dispatchEvent(pointer('pointerdown', x, y));
    f.canvasEl.dispatchEvent(pointer('pointermove', x + 40, y));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', x + 40, y));
    await settle();
    assert.deepEqual(rectOf(f.byId('r')), [100, 100, 440, 2]);
  } finally { f.destroy(); }
});

// ── 9. Replayed clicks, modifiers and lost presses ──────────────────────────────

test('in a collaboration session a zone click still narrows the set', async () => {
  const { registerCanvasInteractions } = await import('../lib/canvas-interaction.ts');
  const f = mount(PAIR());
  // The lease arrives a task later, as a real claim does.
  const off = registerCanvasInteractions(f.runtime, { acquire: async () => ({ id: 'mine', preview() {}, finish() {} }) });
  try {
    f.select(['a', 'b']);
    await settle();
    await click(f, 397, 125);
    assert.deepEqual(f.selection(), ['b']);
    assert.equal(f.writes(), 0);
    // And a drag from the same strip still waits on its lease and resizes.
    f.select(['a', 'b']);
    await settle();
    await drag(f, 397, 125, 447, 125);
    const b = rectOf(f.byId('b'));
    assert.equal(b[0]! + b[2]!, 450, 'the set\'s e edge follows the pointer');
  } finally { off(); f.destroy(); }
});

test('an Alt-click in a set\'s strip picks the one member, as an Alt-click always has', async () => {
  const grouped = (): Box[] => PAIR().map((b) => ({ ...b, group: 'g' } as Box));
  const f = mount(grouped());
  try {
    f.select(['a', 'b']);
    await settle();
    await click(f, 397, 125);
    assert.deepEqual(f.selection(), ['a', 'b'], 'a plain click keeps the whole group');
    await click(f, 397, 125, { alt: true });
    assert.deepEqual(f.selection(), ['b'], 'Alt drills in to the box under the pointer');
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('Shift at the press keeps the rotate zone, and the turn takes hard 15 degree steps', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 310, 90, { shift: true }), 'rotate-ne');
    assert.equal(await hover(f, 303, 97, { shift: true }), 'nesw-resize', 'so does the outer corner');
    const [x, y] = turnTo(310, 90, 40);
    await drag(f, 310, 90, x, y, { shift: true });
    assert.equal(Number(f.byId('a').rot), 45, '40 degrees rounds to the nearest step');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 100]);
  } finally { f.destroy(); }
});

test('a pen turns the box from a rotate zone', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 310, 90, { kind: 'pen' }), 'rotate-ne');
    const [x, y] = turnTo(310, 90, 30);
    await drag(f, 310, 90, x, y, { kind: 'pen' });
    assert.ok(Math.abs(Number(f.byId('a').rot) - 30) < 0.05, `turned 30 degrees, not ${f.byId('a').rot}`);
  } finally { f.destroy(); }
});

test('a held press whose release was lost ends when the mouse moves with its button up', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerdown', 303, 120));
    f.canvasEl.dispatchEvent(pointer('pointermove', 353, 120, { buttons: 0 }));
    f.canvasEl.dispatchEvent(pointer('pointermove', 403, 120, { buttons: 0 }));
    await settle();
    assert.equal(held(f), false, 'no drag cursor');
    assert.equal(f.el('a').style.width, '200px', 'no live resize');
    f.canvasEl.dispatchEvent(pointer('pointerup', 403, 120));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 100]);
    assert.equal(f.writes(), 0);
    // The capture going away ends a held press too.
    f.canvasEl.dispatchEvent(pointer('pointerdown', 303, 120));
    f.canvasEl.dispatchEvent(pointer('lostpointercapture', 303, 120));
    f.canvasEl.dispatchEvent(pointer('pointermove', 353, 120));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 353, 120));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 100]);
    assert.deepEqual(f.selection(), ['a'], 'and no click replays');
    // A box losing a finger's implicit capture to the canvas is not the press ending.
    f.el('a').dispatchEvent(pointer('pointerdown', 297, 120, { kind: 'touch' }));
    f.el('a').dispatchEvent(pointer('lostpointercapture', 297, 120, { kind: 'touch' }));
    f.canvasEl.dispatchEvent(pointer('pointermove', 337, 120, { kind: 'touch' }));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 337, 120, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 240, 100], 'the touch zone press still resizes');
  } finally { f.destroy(); }
});

test('a strip drag puts the edge exactly on a neighbour\'s edge', async () => {
  // a's e edge is at x 300, and o's left edge at x 350. Each drag aims the edge at 347.
  const seed = (): Box[] => [ONE(), { id: 'o', kind: 'box', x: 350, y: 300, w: 100, h: 100, rot: 0 } as Box];
  for (const from of [303, 297, 300]) {
    const f = mount(seed());
    try {
      f.select(['a']);
      await settle();
      await drag(f, from, 120, from + 47, 120);
      assert.deepEqual(rectOf(f.byId('a')), [100, 100, 250, 100], `pressed at ${from}: the edge snaps to 350`);
    } finally { f.destroy(); }
  }
});

// ── 10. The hover cursor ────────────────────────────────────────────────────────

test('the hover cursor is only offered where a press would take the zone', async () => {
  // Over the object bar: the bar takes the press, so the stage shows no zone cursor.
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 303, 120), 'ew-resize');
    const bar = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar')!;
    bar.dispatchEvent(pointer('pointermove', 303, 120, { buttons: 0 }));
    await settle();
    assert.equal(cursor(f), null, 'the bar keeps its own cursor');
    // Over a handle: the handle's own cursor shows.
    f.handle('e')!.dispatchEvent(pointer('pointermove', 300, 150, { buttons: 0 }));
    await settle();
    assert.equal(cursor(f), null);
  } finally { f.destroy(); }
  // Off the canvas a mouse finds the zone, and a pen, which the stage pans, does not.
  const g = mount([{ id: 'r', kind: 'box', x: 800, y: 100, w: 200, h: 100, rot: 0 } as Box], { zoom: 0.5 });
  try {
    g.select(['r']);
    await settle();
    g.stageEl.dispatchEvent(pointer('pointermove', 503, 70, { buttons: 0 }));
    await settle();
    assert.equal(cursor(g), 'ew-resize');
    g.stageEl.dispatchEvent(pointer('pointermove', 503, 70, { buttons: 0, kind: 'pen' }));
    await settle();
    assert.equal(cursor(g), null);
  } finally { g.destroy(); }
});

test('the zone cursor follows the chrome when the selection changes under a still pointer', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 303, 120), 'ew-resize');
    press('Escape');
    await settle();
    assert.deepEqual(f.selection(), []);
    assert.equal(cursor(f), null, 'gone with the selection');
    f.select(['a']);
    await settle();
    assert.equal(cursor(f), 'ew-resize', 'and back with the selection');
  } finally { f.destroy(); }
});
