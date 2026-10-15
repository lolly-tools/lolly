// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 311 M0 - the foundation the selection transform modes stand on, pinned through
 * the real initFreeCanvas in jsdom (the free-canvas-frame-gestures.test.ts harness):
 *
 *   1. a group scale measures k from the PRESS, so a click on a handle is k = 1, and a
 *      press and release that moved nothing writes nothing (scale and turn alike);
 *   2. the gesture's own live rects drive the chrome, so a selected kind:group's
 *      outline follows its descendants mid-drag;
 *   3. the live transform is rebuilt from the box's own fields, so a flipped or tilted
 *      box keeps its flip and tilt mid-drag;
 *   4. a locked row (its own flag, or a locked group above it) gets no handles;
 *   5. an artboard gets no rotate handle, and a group turn leaves it where it is;
 *   6. a second finger CANCELS the first finger's drag: the DOM returns to the model
 *      and nothing commits;
 *   7. Shift pressed or released mid-drag re-applies the last frame at once.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-transform-foundation.test.ts
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

interface PointerOpts { id?: number; kind?: 'mouse' | 'touch' | 'pen'; shift?: boolean; alt?: boolean }
function pointer(type: string, x: number, y: number, o: PointerOpts = {}): MouseEvent {
  const e = new W.MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, shiftKey: !!o.shift, altKey: !!o.alt,
  });
  Object.defineProperty(e, 'pointerId', { value: o.id ?? 1 });
  Object.defineProperty(e, 'pointerType', { value: o.kind ?? 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}
/** A bare modifier key, dispatched on the body so it bubbles up to the window as a real one does. */
function key(type: 'keydown' | 'keyup', name: 'Shift' | 'Alt'): KeyboardEvent {
  const e = new W.KeyboardEvent(type, {
    key: name, bubbles: true, cancelable: true,
    shiftKey: name === 'Shift' && type === 'keydown', altKey: name === 'Alt' && type === 'keydown',
  });
  dom.window.document.body.dispatchEvent(e);
  return e;
}

const BASE_CFG = {
  idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  rotationField: 'rot', groupField: 'group',
  addKinds: [{ id: 'box', label: 'Box', seed: { kind: 'box' } }],
};
const FRAME_CFG = { frameField: 'frame', frameKind: 'frame', orderField: 'order', lockedField: 'locked' };

interface MountOpts {
  canvas?: Record<string, unknown>;
  frame?: boolean;
  fields?: Array<{ id: string }>;
  /** Design's nested groups: needs a text document input and the pages ports. */
  hierarchy?: boolean;
}
interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  byId(id: string): Record<string, unknown>;
  el(id: string): HTMLElement;
  writes(): number;
  select(ids: string[]): void;
  write(boxes: Box[]): void;
  handles(): number;
  handle(name: string): HTMLElement | null;
  destroy(): void;
}

/** A box element as the tool's template would paint it: inline geometry and the box's
 *  own transform (free-canvas only drives the model and the chrome). */
function paint(canvasEl: HTMLElement, b: Box, transform = ''): void {
  const el = dom.window.document.createElement('div');
  const page = String(b.kind) === 'frame';
  el.className = page ? 'lolly-frame-page' : 'lolly-box';
  el.setAttribute(page ? 'data-frame-id' : 'data-box-id', String(b.id));
  if (page) el.setAttribute('data-pdf-page', '');
  el.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
  if (transform) el.style.transform = transform;
  canvasEl.appendChild(el);
}

function mount(seed: Box[], o: MountOpts = {}, transforms: Record<string, string> = {}): Fixture {
  const doc = dom.window.document;
  const viewEl = doc.createElement('div');
  const stageEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  doc.body.appendChild(viewEl);
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  for (const b of seed) if (String(b.kind) !== 'group') paint(canvasEl, b, transforms[String(b.id)]);

  const model = new Map<string, unknown>([['boxes', seed], ['textDocument', ''], ['pages', [{ id: 'page-1', name: 'Page 1' }]]]);
  const subs: Array<() => void> = [];
  let writes = 0;
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { writes++; model.set(id, value); for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const canvas = { ...BASE_CFG, ...(o.hierarchy && { textDocumentInput: 'textDocument' }), ...o.canvas };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: canvas as never, fields: o.fields ?? [] },
    ...(o.frame && { frame: FRAME_CFG }),
    ...(o.hierarchy && { getDesignPages: () => model.get('pages') as never, getActivePage: () => 'page-1' }),
    nativeW: NATIVE, nativeH: NATIVE,
  });
  const boxes = (): Box[] => model.get('boxes') as Box[];
  return {
    stageEl, canvasEl,
    byId: (id) => boxes().find((b) => b.id === id)! as Record<string, unknown>,
    el: (id) => canvasEl.querySelector<HTMLElement>(`[data-box-id="${id}"], [data-frame-id="${id}"]`)!,
    writes: () => writes,
    select: (ids) => handle.applyUi({ select: ids } as never),
    write: (next) => runtime.setInput('boxes', next),
    handles: () => stageEl.querySelectorAll('.fc-chrome .fc-handle').length,
    handle: (name) => stageEl.querySelector<HTMLElement>(`.fc-chrome .fc-h-${name}`),
    destroy() { handle.destroy(); viewEl.remove(); doc.body.innerHTML = ''; },
  };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 25)); for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };
/** A chrome node's stage position (the stage sits at the client origin here). */
const at = (el: HTMLElement): [number, number] => [parseFloat(el.style.left), parseFloat(el.style.top)];
const geom = (el: HTMLElement): string => [el.style.left, el.style.top, el.style.width, el.style.height].join(' ');

/** Two 100 px squares side by side: the selection bounds run (100,100) to (400,200). */
const PAIR = (): Box[] => ([
  { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0 },
  { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0 },
] as Box[]);

// ── 1. the group scale reads from the press ────────────────────────────────────

test('a group-scale press and release that never moves writes nothing, even with a move at the press', async () => {
  const f = mount(PAIR());
  try {
    f.select(['a', 'b']);
    await settle();
    const se = f.handle('se');
    assert.ok(se, 'a multi-selection carries group corners');
    se!.dispatchEvent(pointer('pointerdown', 400, 200));
    f.canvasEl.dispatchEvent(pointer('pointerup', 400, 200));
    await settle();
    assert.equal(f.writes(), 0, 'a click on a group handle is not an undo step');

    f.handle('se')!.dispatchEvent(pointer('pointerdown', 400, 200));
    f.canvasEl.dispatchEvent(pointer('pointermove', 400.3, 200.2));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 400.3, 200.2));
    await settle();
    assert.equal(f.writes(), 0, 'under half a pixel of change is still a click');
    assert.equal(geom(f.el('a')), '100px 100px 100px 100px', 'and the preview is back on the model');
  } finally { f.destroy(); }
});

test('a group-scale press 5 px inside the corner reads k = 1, and the scale is measured from the press', async () => {
  const f = mount(PAIR());
  try {
    f.select(['a', 'b']);
    await settle();
    f.handle('se')!.dispatchEvent(pointer('pointerdown', 395, 195));
    f.canvasEl.dispatchEvent(pointer('pointermove', 395, 195));
    await settle();
    assert.equal(geom(f.el('a')), '100px 100px 100px 100px', 'no jump at the press: k is 1 there');
    assert.equal(geom(f.el('b')), '300px 100px 100px 100px');
    f.canvasEl.dispatchEvent(pointer('pointerup', 395, 195));
    await settle();
    assert.equal(f.writes(), 0, 'and nothing commits');

    // The travel from the press, not from the corner: 300 px right and 100 px down
    // doubles the 300 x 100 pair from its nw corner at (100, 100).
    f.handle('se')!.dispatchEvent(pointer('pointerdown', 395, 195));
    f.canvasEl.dispatchEvent(pointer('pointermove', 695, 295));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 695, 295));
    await settle();
    assert.equal(f.writes(), 1, 'one commit, one undo step');
    assert.deepEqual([f.byId('a').x, f.byId('a').y, f.byId('a').w, f.byId('a').h], [100, 100, 200, 200]);
    assert.deepEqual([f.byId('b').x, f.byId('b').y, f.byId('b').w, f.byId('b').h], [500, 100, 200, 200]);
  } finally { f.destroy(); }
});

test('a group-rotate press and release without a turn writes nothing', async () => {
  const f = mount(PAIR());
  try {
    f.select(['a', 'b']);
    await settle();
    const rot = f.handle('rotate')!;
    const [x, y] = at(rot);
    rot.dispatchEvent(pointer('pointerdown', x, y));
    f.canvasEl.dispatchEvent(pointer('pointermove', x, y));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', x, y));
    await settle();
    assert.equal(f.writes(), 0);
    assert.equal(f.el('a').style.transform, '', 'the preview is back on the unrotated model');
  } finally { f.destroy(); }
});

// ── 2. live rects drive the chrome ──────────────────────────────────────────────

test("a selected group's outline follows a scale of its descendants mid-drag", async () => {
  const seed = [
    { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0, group: 'g', pageId: 'page-1' },
    { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0, group: 'g', pageId: 'page-1' },
    { id: 'g', kind: 'group', name: 'G', x: 100, y: 100, w: 300, h: 100, rot: 0, group: '', pageId: 'page-1' },
  ] as Box[];
  const f = mount(seed, { hierarchy: true });
  try {
    f.select(['g']);
    await settle();
    const outline = (): string => geom(f.stageEl.querySelector<HTMLElement>('.fc-chrome .fc-group-outline')!);
    assert.equal(outline(), '100px 100px 300px 100px', 'at rest the outline wraps the group');
    f.handle('se')!.dispatchEvent(pointer('pointerdown', 400, 200));
    f.canvasEl.dispatchEvent(pointer('pointermove', 700, 300));
    await settle();
    assert.equal(geom(f.el('a')), '100px 100px 200px 200px', 'the descendants scale live (k = 2)');
    assert.equal(outline(), '100px 100px 600px 200px', 'and the group chrome scales with them, mid-drag');
    f.canvasEl.dispatchEvent(pointer('pointerup', 700, 300));
    await settle();
    assert.equal(f.writes(), 1);
    assert.equal(f.byId('g').w, 600);
  } finally { f.destroy(); }
});

// ── 3. the live transform comes from the box's own fields ──────────────────────

const FLIP_FIELDS = [{ id: 'flipH' }, { id: 'flipV' }];

test('a flipped box keeps its flip while it is dragged, and after a cancel', async () => {
  const f = mount([{ id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 100, rot: 0, flipH: true }] as Box[],
    { fields: FLIP_FIELDS }, { a: 'scale(-1,1)' });
  try {
    f.canvasEl.dispatchEvent(pointer('pointerdown', 150, 150));
    f.canvasEl.dispatchEvent(pointer('pointermove', 180, 170));
    await settle();
    assert.equal(f.el('a').style.left, '130px', 'the box is moving');
    assert.match(f.el('a').style.transform, /^scale\(-1,\s*1\)$/, 'a move no longer wipes the flip');

    f.canvasEl.dispatchEvent(pointer('pointerup', 180, 170));
    await settle();
    f.handle('se')!.dispatchEvent(pointer('pointerdown', 330, 230));
    f.canvasEl.dispatchEvent(pointer('pointermove', 360, 250));
    await settle();
    assert.match(f.el('a').style.transform, /^scale\(-1,\s*1\)$/, 'nor does a resize');
    key('keydown', 'Alt'); // a modifier mid-drag replays the frame, flip included
    assert.match(f.el('a').style.transform, /^scale\(-1,\s*1\)$/);
    dom.window.document.body.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await settle();
    assert.equal(f.el('a').style.left, '130px', 'Escape put the preview back on the model');
    assert.match(f.el('a').style.transform, /^scale\(-1,\s*1\)$/, 'flip and all');
  } finally { f.destroy(); }
});

test('a rotated, tilted, flipped box keeps the transform the hook composes mid-resize', async () => {
  const f = mount([{ id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 100, rot: 30, flipH: true, rx: 20 }] as Box[],
    { fields: FLIP_FIELDS, canvas: { rxField: 'rx', ryField: 'ry' } },
    { a: 'perspective(1200px) rotateX(20deg) rotate(30deg) scale(-1,1)' });
  try {
    f.select(['a']);
    await settle();
    const se = f.handle('se')!;
    const [x, y] = at(se);
    se.dispatchEvent(pointer('pointerdown', x, y));
    f.canvasEl.dispatchEvent(pointer('pointermove', x + 30, y + 10));
    await settle();
    const tf = f.el('a').style.transform;
    assert.notEqual(f.el('a').style.width, '200px', 'the box is resizing');
    assert.match(tf, /^perspective\(1200px\) rotateX\(20deg\) rotate\(30deg\) scale\(-1,\s*1\)$/,
      'the tilt, the rotation and the flip, in the order the hook writes them');
    f.canvasEl.dispatchEvent(pointer('pointerup', x + 30, y + 10));
    await settle();
    assert.equal(f.writes(), 1);
  } finally { f.destroy(); }
});

test('an editor torn down mid-drag leaves no modifier listener taking keys', async () => {
  const f = mount([{ id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 100, rot: 0 }] as Box[]);
  f.select(['a']);
  await settle();
  f.handle('se')!.dispatchEvent(pointer('pointerdown', 300, 200));
  f.canvasEl.dispatchEvent(pointer('pointermove', 400, 200));
  await settle();
  assert.equal(key('keydown', 'Shift').defaultPrevented, true, 'live: the gesture takes the key');
  key('keyup', 'Shift');
  f.destroy();
  assert.equal(key('keydown', 'Shift').defaultPrevented, false, 'destroyed: the next key finds nothing');
  assert.equal(key('keyup', 'Shift').defaultPrevented, false);
});

// ── 4. locks ────────────────────────────────────────────────────────────────────

test('a locked row gets no handles, nor does a selection holding one, until it is unlocked', async () => {
  const seed = [
    { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0, locked: true },
    { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0 },
  ] as Box[];
  const f = mount(seed, { frame: true });
  try {
    f.select(['a']);
    await settle();
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-outline').length, 1, 'the locked row is shown selected');
    assert.equal(f.handles(), 0, 'with no resize or rotate handle');
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-rot-stem').length, 0);

    f.select(['a', 'b']);
    await settle();
    assert.ok(f.stageEl.querySelector('.fc-chrome .fc-group-outline'), 'the pair has its bounds');
    assert.equal(f.handles(), 0, 'and no group handle while one member is locked');

    f.write(seed.map((b) => (b.id === 'a' ? { ...b, locked: false } : b)));
    await settle();
    f.select(['a']);
    await settle();
    assert.equal(f.handles(), 9, 'unlocking brings the 8 resize handles and the rotate handle back');
  } finally { f.destroy(); }
});

test('a row inside a locked group gets no handles', async () => {
  const seed = [
    { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0, group: 'g', pageId: 'page-1' },
    { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0, group: 'g', pageId: 'page-1' },
    { id: 'g', kind: 'group', name: 'G', x: 100, y: 100, w: 300, h: 100, rot: 0, group: '', locked: true, pageId: 'page-1' },
  ] as Box[];
  const f = mount(seed, { hierarchy: true });
  try {
    f.select(['a']);
    await settle();
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-outline').length, 1);
    assert.equal(f.handles(), 0, 'the lock of the group above it holds the child');
  } finally { f.destroy(); }
});

// ── 5. artboards never turn ─────────────────────────────────────────────────────

test('an artboard gets no rotate handle, and a group turn leaves an artboard where it is', async () => {
  const seed = [
    { id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300, order: 0 },
    { id: 'b1', kind: 'box', x: 150, y: 150, w: 100, h: 50, frame: 'f1' },
    { id: 'b2', kind: 'box', x: 600, y: 100, w: 100, h: 100, rot: 0 },
    { id: 'f2', kind: 'frame', x: 100, y: 500, w: 200, h: 200, order: 1 },
  ] as Box[];
  const f = mount(seed, { frame: true });
  try {
    f.select(['f1']);
    await settle();
    assert.ok(f.handle('nw'), 'an artboard still resizes');
    assert.equal(f.handle('rotate'), null, 'but has no rotate handle');
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-rot-stem').length, 0, 'nor its stem');

    f.select(['f1', 'f2']);
    await settle();
    assert.ok(f.handle('se'), 'two artboards still scale together');
    assert.equal(f.handle('rotate'), null, 'but a set of nothing but artboards cannot turn');

    f.select(['f1', 'b2']);
    await settle();
    const rot = f.handle('rotate');
    assert.ok(rot, 'a set with a box in it can turn');
    const [x, y] = at(rot!);
    rot!.dispatchEvent(pointer('pointerdown', x, y));
    f.canvasEl.dispatchEvent(pointer('pointermove', x + 200, y - 150));
    await settle();
    assert.equal(geom(f.el('f1')), '100px 100px 400px 300px', 'the artboard does not move mid-turn');
    assert.equal(f.el('f1').style.transform, '', 'nor rotate');
    f.canvasEl.dispatchEvent(pointer('pointerup', x + 200, y - 150));
    await settle();
    assert.equal(f.writes(), 1);
    const f1 = f.byId('f1');
    assert.deepEqual([f1.x, f1.y, f1.w, f1.h, Number(f1.rot ?? 0)], [100, 100, 400, 300, 0], 'the artboard is untouched');
    assert.notEqual(Number(f.byId('b2').rot ?? 0), 0, 'while the box turned');
    const b2 = f.byId('b2');
    const cx = Number(b2.x) + Number(b2.w) / 2, cy = Number(b2.y) + Number(b2.h) / 2;
    assert.ok(Math.abs(cx - 650) <= 1 && Math.abs(cy - 150) <= 1, `the pivot is the turning box, not the artboard: centre ${cx},${cy}`);
    assert.deepEqual([f.byId('b1').x, f.byId('b1').y], [150, 150], 'and the artboard member stayed put');
  } finally { f.destroy(); }
});

// ── 6. a second finger cancels ──────────────────────────────────────────────────

/** Record pointer capture, which jsdom does not implement. */
function captures(f: Fixture): number[] {
  const released: number[] = [];
  f.canvasEl.setPointerCapture = () => {};
  f.canvasEl.releasePointerCapture = (id: number) => { released.push(id); };
  return released;
}

test('a second finger mid-drag cancels: the DOM returns to the model and nothing commits', async () => {
  const f = mount(PAIR());
  try {
    const released = captures(f);
    f.canvasEl.dispatchEvent(pointer('pointerdown', 150, 150, { kind: 'touch', id: 1 }));
    f.canvasEl.dispatchEvent(pointer('pointermove', 200, 220, { kind: 'touch', id: 1 }));
    await settle();
    assert.equal(geom(f.el('a')), '150px 170px 100px 100px', 'the first finger is dragging the box');
    assert.ok(dom.window.document.body.classList.contains('fc-manipulating'));

    f.canvasEl.dispatchEvent(pointer('pointerdown', 600, 600, { kind: 'touch', id: 2 }));
    assert.equal(geom(f.el('a')), '100px 100px 100px 100px', 'the second finger put the box back on the model');
    assert.equal(dom.window.document.body.classList.contains('fc-manipulating'), false, 'the gesture is over');
    assert.deepEqual(released, [1], 'cancelled, not merely ended: the first finger\'s capture is released');

    f.canvasEl.dispatchEvent(pointer('pointermove', 260, 260, { kind: 'touch', id: 1 }));
    await settle();
    assert.equal(geom(f.el('a')), '100px 100px 100px 100px', 'the first finger no longer drags');
    f.canvasEl.dispatchEvent(pointer('pointerup', 260, 260, { kind: 'touch', id: 1 }));
    f.canvasEl.dispatchEvent(pointer('pointerup', 600, 600, { kind: 'touch', id: 2 }));
    await settle();
    assert.equal(f.writes(), 0, 'and neither finger commits');
  } finally { f.destroy(); }
});

test('a second finger landing on a handle cancels the drag and starts nothing of its own', async () => {
  const f = mount(PAIR());
  try {
    f.select(['a']);
    await settle();
    const released = captures(f);
    f.canvasEl.dispatchEvent(pointer('pointerdown', 150, 150, { kind: 'touch', id: 1 }));
    f.canvasEl.dispatchEvent(pointer('pointermove', 170, 160, { kind: 'touch', id: 1 }));
    await settle();
    assert.equal(geom(f.el('a')), '120px 110px 100px 100px');
    const se = f.handle('se')!;
    const [x, y] = at(se);
    se.dispatchEvent(pointer('pointerdown', x, y, { kind: 'touch', id: 2 }));
    assert.equal(geom(f.el('a')), '100px 100px 100px 100px', 'the move was cancelled');
    assert.deepEqual(released, [1]);
    f.canvasEl.dispatchEvent(pointer('pointermove', x + 40, y + 40, { kind: 'touch', id: 2 }));
    await settle();
    assert.equal(geom(f.el('a')), '100px 100px 100px 100px', 'and the handle finger did not start a resize');
    f.canvasEl.dispatchEvent(pointer('pointerup', x + 40, y + 40, { kind: 'touch', id: 2 }));
    f.canvasEl.dispatchEvent(pointer('pointerup', 170, 160, { kind: 'touch', id: 1 }));
    await settle();
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

// ── 7. modifiers re-apply without a pointer move ───────────────────────────────

test('Shift pressed mid-resize locks the aspect at once, and releasing it frees the aspect again', async () => {
  const f = mount([{ id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 100, rot: 0 }] as Box[]);
  try {
    f.select(['a']);
    await settle();
    f.handle('se')!.dispatchEvent(pointer('pointerdown', 300, 200));
    f.canvasEl.dispatchEvent(pointer('pointermove', 400, 200));
    await settle();
    assert.equal(geom(f.el('a')), '100px 100px 300px 100px', 'a free resize along x');

    const down = key('keydown', 'Shift');
    assert.equal(geom(f.el('a')), '100px 100px 300px 150px', 'Shift alone re-applies the frame with the aspect kept');
    assert.equal(down.defaultPrevented, true, 'the gesture took the key');
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-outline').length, 1, 'and it reached no other shortcut');
    key('keyup', 'Shift');
    assert.equal(geom(f.el('a')), '100px 100px 300px 100px', 'releasing Shift frees the aspect again');

    f.canvasEl.dispatchEvent(pointer('pointerup', 400, 200));
    await settle();
    assert.equal(f.writes(), 1);
    assert.deepEqual([f.byId('a').w, f.byId('a').h], [300, 100], 'the commit is the frame on screen at release');
    assert.equal(key('keydown', 'Shift').defaultPrevented, false, 'the listener left with the gesture');
  } finally { f.destroy(); }
});
