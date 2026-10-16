// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 311 M3 - the modifier table, the multi-selection edge handles, the non-uniform
 * multi-selection resize with its uniform fallback, and snapping for selection
 * transforms, pinned through the real initFreeCanvas in jsdom (the harness of
 * free-canvas-transform-foundation.test.ts):
 *
 *   1. Resize: Shift keeps the aspect from the axis that moved further; Alt works from
 *      the centre, mirrored, with snapping still on; ⌘ or Ctrl held mid-drag suspends
 *      snapping and the grid, and letting go brings them back.
 *   2. Scale: Alt scales from the centre and Shift adds nothing.
 *   3. Rotate and group rotate: Shift gives hard 15 degree steps, rounded to the
 *      nearest; Alt, ⌘ and Ctrl turn freely; otherwise the soft magnet.
 *   4. Move: ⌘ held mid-drag suspends snapping.
 *   5. A multi-selection has 8 resize handles: an edge resizes one axis of an
 *      axis-aligned set, and a set holding a turned member, a group or a circle keeps
 *      its proportions and says so.
 *   6. A selection resize snaps its dragged edge to the targets a single box snaps to,
 *      the grid included, and not with ⌘ held.
 *   7. A side thinner than the minimum size (a 1 px divider) keeps its size when a set
 *      or a single box shrinks, and is never committed as 0.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-transform-modifiers.test.ts
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

interface Mods { shift?: boolean; alt?: boolean; meta?: boolean; ctrl?: boolean }
function pointer(type: string, x: number, y: number, m: Mods = {}): MouseEvent {
  const e = new W.MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0,
    shiftKey: !!m.shift, altKey: !!m.alt, metaKey: !!m.meta, ctrlKey: !!m.ctrl,
  });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}
/** A bare modifier key going down or up, with the modifiers `held` after the change,
 *  dispatched on the body so it bubbles up to the window as a real one does. */
function key(type: 'keydown' | 'keyup', name: 'Shift' | 'Alt' | 'Meta' | 'Control', held: Mods = {}): KeyboardEvent {
  const e = new W.KeyboardEvent(type, {
    key: name, bubbles: true, cancelable: true,
    shiftKey: !!held.shift, altKey: !!held.alt, metaKey: !!held.meta, ctrlKey: !!held.ctrl,
  });
  dom.window.document.body.dispatchEvent(e);
  return e;
}
/** A plain key press on the body, for the canvas shortcuts (K). */
function press(name: string): void {
  dom.window.document.body.dispatchEvent(new W.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

const BASE_CFG = {
  idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  rotationField: 'rot', groupField: 'group',
  fontSizeField: 'fontSize', strokeWField: 'strokeW',
  addKinds: [{ id: 'box', label: 'Box', seed: { kind: 'box' } }],
};

interface MountOpts {
  canvas?: Record<string, unknown>;
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
  handle(name: string): HTMLElement | null;
  destroy(): void;
}

/** A box element, painted as the tool's template paints a box. */
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
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  for (const b of seed) if (String(b.kind) !== 'group') paint(canvasEl, b);

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
    input: { id: 'boxes', canvas: canvas as never, fields: [] },
    ...(o.hierarchy && { getDesignPages: () => model.get('pages') as never, getActivePage: () => 'page-1' }),
    nativeW: NATIVE, nativeH: NATIVE,
  });
  const boxes = (): Box[] => model.get('boxes') as Box[];
  return {
    stageEl, canvasEl,
    byId: (id) => boxes().find((b) => b.id === id)! as Record<string, unknown>,
    el: (id) => canvasEl.querySelector<HTMLElement>(`[data-box-id="${id}"]`)!,
    writes: () => writes,
    select: (ids) => handle.applyUi({ select: ids } as never),
    handle: (name) => stageEl.querySelector<HTMLElement>(`.fc-chrome .fc-h-${name}`),
    // The body keeps its live regions: announce() holds on to the one it made first.
    destroy() {
      handle.destroy(); viewEl.remove();
      for (const n of [...doc.body.children]) if (!n.hasAttribute('data-a11y-live')) n.remove();
    },
  };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 25)); for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };
/** A chrome node's stage position (the stage sits at the client origin here). */
const at = (el: HTMLElement): [number, number] => [parseFloat(el.style.left), parseFloat(el.style.top)];
const geom = (el: HTMLElement): string => [el.style.left, el.style.top, el.style.width, el.style.height].join(' ');
const rectOf = (b: Record<string, unknown>): number[] => [b.x, b.y, b.w, b.h].map(Number);
const guides = (f: Fixture): number => f.stageEl.querySelectorAll('.fc-guides .fc-guide').length;
const readout = (f: Fixture): string => f.stageEl.querySelector('.fc-ctxbar [data-cx-readout]')?.textContent ?? '';
const label = (f: Fixture): string => f.stageEl.querySelector('.fc-overlay .fc-xform-label')?.textContent ?? '';
const chrome = (f: Fixture): HTMLElement => f.stageEl.querySelector<HTMLElement>('.fc-chrome')!;
const announced = (): string => dom.window.document.querySelector('[data-a11y-live][aria-live="polite"]')?.textContent ?? '';

/** Press `handle` where it is drawn and move by (dx, dy), holding `m`; the pointer stays down. */
async function hold(f: Fixture, handle: string, dx: number, dy: number, m: Mods = {}): Promise<[number, number]> {
  const h = f.handle(handle);
  assert.ok(h, `a ${handle} handle`);
  const [x, y] = at(h!);
  h!.dispatchEvent(pointer('pointerdown', x, y, m));
  f.canvasEl.dispatchEvent(pointer('pointermove', x + dx, y + dy, m));
  await settle();
  return [x + dx, y + dy];
}
async function release(f: Fixture, [x, y]: [number, number], m: Mods = {}): Promise<void> {
  f.canvasEl.dispatchEvent(pointer('pointerup', x, y, m));
  await settle();
}

/** A 200 x 100 box at (100, 100): its e handle is at (300, 150), its se at (300, 200). */
const ONE = (): Box => ({ id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 100, rot: 0, fontSize: 20, strokeW: 2 } as Box);
/** Two 100 px squares side by side: the selection bounds run (100,100) to (400,200). */
const PAIR = (): Box[] => ([
  { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0 },
  { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0 },
] as Box[]);

// ── 1. Resize ───────────────────────────────────────────────────────────────────

test('Shift keeps the aspect from the axis that moved further, so a corner drag led by the height grows both', async () => {
  const f = mount([ONE()]);
  try {
    f.select(['a']);
    await settle();
    // 10 px right is 5% of the width; 60 px down is 60% of the height, which leads.
    const end = await hold(f, 'se', 10, 60, { shift: true });
    assert.equal(geom(f.el('a')), '100px 100px 320px 160px', 'the height drives: 1.6 on both sides, not 210 x 105');
    await release(f, end, { shift: true });
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 320, 160]);
    assert.equal(f.byId('a').fontSize, 20, 'and a Resize keeps the content');
  } finally { f.destroy(); }
});

test('Alt resizes from the centre with the dragged edge on the pointer, and snapping stays on', async () => {
  const f = mount([ONE(), { id: 'n', kind: 'box', x: 345, y: 400, w: 50, h: 50, rot: 0 } as Box]);
  try {
    f.select(['a']);
    await settle();
    // The e edge is dragged 42 px, 3 px short of the neighbour's left edge at x 345.
    const end = await hold(f, 'e', 42, 0, { alt: true });
    assert.equal(geom(f.el('a')), '55px 100px 290px 100px', 'snapped to 345, and the w edge mirrors the e edge');
    assert.ok(guides(f) > 0, 'with the guide drawn');
    key('keydown', 'Meta', { alt: true, meta: true });
    assert.equal(geom(f.el('a')), '58px 100px 284px 100px', 'Cmd mid-drag leaves the edge on the pointer');
    assert.equal(guides(f), 0);
    key('keyup', 'Meta', { alt: true });
    assert.equal(geom(f.el('a')), '55px 100px 290px 100px', 'and letting go snaps again');
    await release(f, end, { alt: true });
    assert.deepEqual(rectOf(f.byId('a')), [55, 100, 290, 100]);
  } finally { f.destroy(); }
});

test('Cmd or Ctrl held mid-resize suspends snapping and the grid, and letting go restores both', async () => {
  for (const name of ['Meta', 'Control'] as const) {
    const held = name === 'Meta' ? { meta: true } : { ctrl: true };
    const f = mount([ONE(), { id: 'n', kind: 'box', x: 345, y: 400, w: 50, h: 50, rot: 0 } as Box]);
    try {
      f.select(['a']);
      await settle();
      const end = await hold(f, 'e', 42, 0);
      assert.equal(geom(f.el('a')), '100px 100px 245px 100px', `${name}: snapped to the neighbour at 345`);
      assert.equal(key('keydown', name, held).defaultPrevented, true, `${name}: the gesture takes the key`);
      assert.equal(geom(f.el('a')), '100px 100px 242px 100px', `${name}: on the pointer at once`);
      assert.equal(guides(f), 0, `${name}: no guide`);
      key('keyup', name);
      assert.equal(geom(f.el('a')), '100px 100px 245px 100px', `${name}: snapped again on release of the key`);
      assert.ok(guides(f) > 0);
      await release(f, end);
      assert.equal(f.writes(), 1);
    } finally { f.destroy(); }
  }
  // The grid: 50 px cells pull the e edge from 342 to 350 unless Ctrl is held.
  const f = mount([ONE()], { canvas: { grid: { size: 50 } } });
  try {
    f.select(['a']);
    await settle();
    const end = await hold(f, 'e', 42, 0);
    assert.equal(geom(f.el('a')), '100px 100px 250px 100px', 'on the grid');
    key('keydown', 'Control', { ctrl: true });
    assert.equal(geom(f.el('a')), '100px 100px 242px 100px', 'Ctrl lifts the grid as well');
    key('keyup', 'Control');
    await release(f, end);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 250, 100]);
  } finally { f.destroy(); }
});

// ── 2. Scale ────────────────────────────────────────────────────────────────────

test('in Scale mode Alt scales from the centre, mirrored, and Shift adds nothing', async () => {
  for (const shift of [false, true]) {
    const f = mount([ONE()]);
    try {
      f.select(['a']);
      await settle();
      press('k');
      await settle();
      // 50 px right from the centre is 100 px more width: k = 1.5 about (200, 150).
      const end = await hold(f, 'se', 50, 25, { alt: true, shift });
      assert.equal(label(f), 'Scale 150%');
      await release(f, end, { alt: true, shift });
      assert.deepEqual(rectOf(f.byId('a')), [50, 75, 300, 150], `shift=${shift}: centred`);
      assert.deepEqual([f.byId('a').fontSize, f.byId('a').strokeW], [30, 3], 'with the content');
    } finally { f.destroy(); }
  }
});

// ── 3. Rotate ───────────────────────────────────────────────────────────────────

/** The client point at `deg` past the press of a rotate handle 80 px below `c`. */
const turned = (c: [number, number], deg: number): [number, number] => {
  const a = ((90 + deg) * Math.PI) / 180;
  return [c[0] + 80 * Math.cos(a), c[1] + 80 * Math.sin(a)];
};
/** Press the rotate handle and turn by `deg` with `m` held; the pointer stays down. */
async function turn(f: Fixture, centre: [number, number], deg: number, m: Mods = {}): Promise<[number, number]> {
  const h = f.handle('rotate')!;
  const [x, y] = at(h);
  assert.deepEqual([x, y], [centre[0], centre[1] + 80], 'the handle sits 80 px below the pivot');
  h.dispatchEvent(pointer('pointerdown', x, y, m));
  const to = turned(centre, deg);
  f.canvasEl.dispatchEvent(pointer('pointermove', to[0], to[1], m));
  await settle();
  return to;
}
const rotOf = (el: HTMLElement): number => Number(/rotate\((-?[\d.]+)deg\)/.exec(el.style.transform)?.[1] ?? 0);

test('Shift turns in hard 15 degree steps rounded to the nearest; Alt, Cmd and Ctrl turn freely', async () => {
  const rows: Array<[number, Mods, number]> = [
    [7, {}, 7], [3, {}, 0], [13, {}, 15], // the soft magnet: within 4 degrees
    [7, { shift: true }, 0], [8, { shift: true }, 15], [22, { shift: true }, 15], [23, { shift: true }, 30],
    [13, { alt: true }, 13], [13, { meta: true }, 13], [13, { ctrl: true }, 13],
  ];
  for (const [deg, m, want] of rows) {
    const f = mount([ONE()]);
    try {
      f.select(['a']);
      await settle();
      const end = await turn(f, [200, 150], deg, m);
      assert.ok(Math.abs(rotOf(f.el('a')) - want) < 0.05, `${deg} with ${JSON.stringify(m)}: ${rotOf(f.el('a'))} != ${want}`);
      await release(f, end, m);
      assert.ok(Math.abs(Number(f.byId('a').rot) - want) < 0.05, 'and the commit is that angle');
    } finally { f.destroy(); }
  }
});

test('a group turn follows the same table, and a modifier key re-applies mid-turn', async () => {
  const f = mount(PAIR());
  try {
    f.select(['a', 'b']);
    await settle();
    // The pair turns about (250, 150); its rotate handle hangs 80 px below that.
    const end = await turn(f, [250, 150], 13);
    assert.ok(Math.abs(rotOf(f.el('b')) - 15) < 0.05, 'the magnet');
    key('keydown', 'Alt', { alt: true });
    assert.ok(Math.abs(rotOf(f.el('b')) - 13) < 0.05, 'Alt frees the turn at once');
    key('keyup', 'Alt');
    key('keydown', 'Control', { ctrl: true });
    assert.ok(Math.abs(rotOf(f.el('b')) - 13) < 0.05, 'and so does Ctrl');
    key('keyup', 'Control');
    key('keydown', 'Shift', { shift: true });
    assert.ok(Math.abs(rotOf(f.el('b')) - 15) < 0.05, 'Shift rounds 13 to the nearest step');
    await release(f, end, { shift: true });
    assert.ok(Math.abs(Number(f.byId('a').rot) - 15) < 0.05);
    assert.ok(Math.abs(Number(f.byId('b').rot) - 15) < 0.05);
  } finally { f.destroy(); }
});

// ── 4. Move ─────────────────────────────────────────────────────────────────────

test('Cmd held mid-move suspends snapping, and Alt still does as well', async () => {
  const seed = [
    { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0 },
    { id: 'n', kind: 'box', x: 300, y: 400, w: 50, h: 50, rot: 0 },
  ] as Box[];
  for (const m of [{ meta: true }, { ctrl: true }, { alt: true }] as Mods[]) {
    const f = mount(seed);
    try {
      // 198 px right puts the left edge 2 px short of the neighbour's at x 300.
      f.canvasEl.dispatchEvent(pointer('pointerdown', 150, 150));
      f.canvasEl.dispatchEvent(pointer('pointermove', 348, 152));
      await settle();
      assert.equal(geom(f.el('a')), '300px 102px 100px 100px', 'snapped to the neighbour');
      const name = m.meta ? 'Meta' : m.ctrl ? 'Control' : 'Alt';
      key('keydown', name, m);
      assert.equal(geom(f.el('a')), '298px 102px 100px 100px', `${name}: on the pointer`);
      key('keyup', name);
      assert.equal(geom(f.el('a')), '300px 102px 100px 100px', `${name}: snapped again`);
      key('keydown', name, m);
      f.canvasEl.dispatchEvent(pointer('pointerup', 348, 152, m));
      await settle();
      assert.deepEqual(rectOf(f.byId('a')), [298, 102, 100, 100], `${name} held at the drop: unsnapped`);
    } finally { f.destroy(); }
  }
});

// ── 5. Multi-selection edges and the fallback ──────────────────────────────────

test('a multi-selection has 8 resize handles and a rotate handle, each locator once, on its bounds', async () => {
  const f = mount(PAIR());
  try {
    f.select(['a', 'b']);
    await settle();
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-handle').length, 9);
    const want: Record<string, [number, number]> = {
      nw: [100, 100], n: [250, 100], ne: [400, 100], e: [400, 150],
      se: [400, 200], s: [250, 200], sw: [100, 200], w: [100, 150],
    };
    for (const [h, p] of Object.entries(want)) {
      assert.equal(f.stageEl.querySelectorAll(`.fc-chrome .fc-h-${h}`).length, 1, `one .fc-h-${h}`);
      assert.deepEqual(at(f.handle(h)!), p, `${h} on the bounds`);
    }
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-h-rotate').length, 1);
    assert.equal(chrome(f).hasAttribute('data-proportional'), false, 'an axis-aligned set resizes freely');
    // A later sibling paints over an earlier one, so on a set too small for the hit areas
    // to stay apart a corner, built after the edges, still takes the press.
    const order = [...chrome(f).querySelectorAll('.fc-handle:not(.fc-h-rotate)')].map((el) => /fc-h-(\w+)/.exec(el.className)?.[1]);
    assert.deepEqual(order, ['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw']);
  } finally { f.destroy(); }
});

test('an e edge drag on two axis-aligned boxes resizes x and w only, and reads W x H', async () => {
  const f = mount(PAIR());
  try {
    f.select(['a', 'b']);
    await settle();
    // 150 px on a 300 px wide set is 1.5 along x, from the w edge at x 100.
    const end = await hold(f, 'e', 150, 30);
    assert.equal(geom(f.el('a')), '100px 100px 150px 100px');
    assert.equal(geom(f.el('b')), '400px 100px 150px 100px');
    assert.equal(label(f), '450×100');
    assert.equal(readout(f), '450×100', 'the readout reads the bounds too');
    await release(f, end);
    assert.equal(f.writes(), 1);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 150, 100]);
    assert.deepEqual(rectOf(f.byId('b')), [400, 100, 150, 100]);

    // A corner is free on both axes; Shift makes the same drag uniform.
    await release(f, await hold(f, 'se', 0, 100));
    assert.deepEqual(rectOf(f.byId('b')), [400, 100, 150, 200], 'the height alone doubles');
    // Shift on the s edge of the 450 x 200 set: 200 px down is 2 for both axes, about
    // the n edge's midpoint (325, 100).
    await release(f, await hold(f, 's', 0, 200, { shift: true }), { shift: true });
    assert.deepEqual(rectOf(f.byId('b')), [475, 100, 300, 400], 'Shift on an edge scales both axes from the opposite edge');
    assert.deepEqual(rectOf(f.byId('a')), [-125, 100, 300, 400]);
  } finally { f.destroy(); }
});

test('in Scale mode an edge drag scales the set uniformly about the opposite edge midpoint', async () => {
  const f = mount(PAIR());
  try {
    f.select(['a', 'b']);
    await settle();
    press('k');
    await settle();
    const end = await hold(f, 'e', 150, 0);
    assert.equal(label(f), 'Scale 150%');
    await release(f, end);
    assert.deepEqual(rectOf(f.byId('a')), [100, 75, 150, 150], 'about (100, 150)');
    assert.deepEqual(rectOf(f.byId('b')), [400, 75, 150, 150]);
  } finally { f.destroy(); }
});

test('a set with a member turned 30 degrees keeps its proportions from the dragged axis, and says Proportional', async () => {
  const seed = PAIR().map((b) => (b.id === 'b' ? { ...b, rot: 30 } : b));
  const f = mount(seed);
  try {
    f.select(['a', 'b']);
    await settle();
    assert.equal(chrome(f).hasAttribute('data-proportional'), true, 'the scale cursor shows before the drag');
    // Half the set's width again along x is 1.5 for both axes, about the w edge midpoint.
    const width = at(f.handle('e')!)[0] - at(f.handle('w')!)[0];
    const end = await hold(f, 'e', width / 2, 0);
    assert.match(label(f), /×\d+\s+·\s+Proportional$/, 'the label carries the suffix');
    assert.match(readout(f), /×\d+\s+·\s+Proportional$/, 'and so does the readout');
    await release(f, end);
    assert.deepEqual(rectOf(f.byId('a')), [100, 75, 150, 150], 'one factor for both axes');
    assert.deepEqual(rectOf(f.byId('b')), [400, 75, 150, 150]);
    assert.equal(Number(f.byId('b').rot), 30, 'and the turn is kept');
    assert.equal(label(f), '', 'the label goes with the drag');
  } finally { f.destroy(); }
});

test('a selected group keeps its proportions too, and Alt scales it from the centre', async () => {
  const seed = [
    { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0, group: 'g', pageId: 'page-1' },
    { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0, group: 'g', pageId: 'page-1' },
    { id: 'g', kind: 'group', name: 'G', x: 100, y: 100, w: 300, h: 100, rot: 0, group: '', pageId: 'page-1' },
  ] as Box[];
  const f = mount(seed, { hierarchy: true });
  try {
    f.select(['g']);
    await settle();
    assert.equal(chrome(f).hasAttribute('data-proportional'), true);
    let end = await hold(f, 'e', 150, 0);
    assert.match(readout(f), /^450×150\s+·\s+Proportional$/);
    await release(f, end);
    assert.deepEqual(rectOf(f.byId('g')), [100, 75, 450, 150]);
    assert.deepEqual(rectOf(f.byId('b')), [400, 75, 150, 150]);
    // From the centre, mirrored: 45 px right on the e edge grows the 450 px group by 90 each way of its centre.
    end = await hold(f, 'e', 45, 0, { alt: true });
    await release(f, end, { alt: true });
    assert.deepEqual(rectOf(f.byId('g')), [55, 60, 540, 180], 'k = 1.2 about the centre (325, 150)');
  } finally { f.destroy(); }
});

test('a set holding a circle keeps its proportions, so the circle stays a circle, and the press says so', async () => {
  const seed = [
    { id: 'a', kind: 'box', shape: 'circle', x: 100, y: 100, w: 100, h: 100, rot: 0 },
    { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0 },
  ] as Box[];
  const f = mount(seed, { canvas: { shapeField: 'shape' } });
  try {
    f.select(['a', 'b']);
    await settle();
    assert.equal(chrome(f).hasAttribute('data-proportional'), true, 'the scale cursor shows before the drag');
    // 150 px on the 300 px wide set is 1.5 for both axes, about the w edge midpoint (100, 150).
    const end = await hold(f, 'e', 150, 0);
    assert.equal(announced(), 'This selection keeps its proportions.', 'said once, at the press');
    assert.match(readout(f), /^450×150\s+·\s+Proportional$/);
    assert.match(label(f), /Proportional$/);
    await release(f, end);
    assert.deepEqual(rectOf(f.byId('a')), [100, 75, 150, 150], 'w === h: the label Circle still tells the truth');
    assert.equal(f.byId('a').shape, 'circle');
    assert.deepEqual(rectOf(f.byId('b')), [400, 75, 150, 150]);
  } finally { f.destroy(); }
});

// ── 6. Snapping a selection ─────────────────────────────────────────────────────

test('a selection resize snaps its dragged edge to a nearby box edge, and not with Cmd held', async () => {
  for (const meta of [false, true]) {
    const f = mount([...PAIR(), { id: 'n', kind: 'box', x: 553, y: 400, w: 50, h: 50, rot: 0 } as Box]);
    try {
      f.select(['a', 'b']);
      await settle();
      const end = await hold(f, 'e', 150, 0, { meta });
      assert.equal(guides(f) > 0, !meta, `meta=${meta}: a guide only when snapping`);
      await release(f, end, { meta });
      const b = rectOf(f.byId('b'));
      assert.equal(b[0]! + b[2]!, meta ? 550 : 553, `meta=${meta}: the e edge snaps to the neighbour at 553, or stays on the pointer`);
      assert.deepEqual(rectOf(f.byId('n')), [553, 400, 50, 50], 'the target never moves');
    } finally { f.destroy(); }
  }
});

test('a selection resize puts its edge on the grid, and Ctrl held mid-drag lifts the grid', async () => {
  const f = mount(PAIR(), { canvas: { grid: { size: 50 } } });
  try {
    f.select(['a', 'b']);
    await settle();
    const end = await hold(f, 'e', 37, 0);
    assert.equal(geom(f.el('b')), '333px 100px 117px 100px', 'the e edge at 450, the nearest 50 px line');
    key('keydown', 'Control', { ctrl: true });
    assert.equal(geom(f.el('b')), '325px 100px 112px 100px', 'Ctrl: the e edge on the pointer at 437');
    key('keyup', 'Control');
    await release(f, end);
    const b = rectOf(f.byId('b'));
    assert.equal(b[0]! + b[2]!, 450);
  } finally { f.destroy(); }
});

// ── 7. The per-member floor ─────────────────────────────────────────────────────

test('a 1 px divider in a card keeps its 1 px when the set shrinks, in Resize and in Scale', async () => {
  // A 300 x 200 card with a 260 x 1 rule across its middle; the set's bounds are the card's.
  const seed = (): Box[] => ([
    { id: 'card', kind: 'box', x: 100, y: 100, w: 300, h: 200, rot: 0 },
    { id: 'rule', kind: 'box', x: 120, y: 200, w: 260, h: 1, rot: 0 },
  ] as Box[]);
  const cases: Array<[string, boolean, string, number, number, number[], number[]]> = [
    // The s edge up 130: 0.35 on y, which would leave the rule 0.35 px, rounded to 0.
    ['Resize s edge', false, 's', 0, -130, [100, 100, 300, 70], [120, 135, 260, 1]],
    // A free corner: 0.4 on x and 0.35 on y.
    ['Resize se corner', false, 'se', -180, -130, [100, 100, 120, 70], [108, 135, 104, 1]],
    // Scale: one factor, 0.35 (the height moved further).
    ['Scale se corner', true, 'se', -180, -130, [100, 100, 105, 70], [107, 135, 91, 1]],
  ];
  for (const [name, scale, handle, dx, dy, card, rule] of cases) {
    const f = mount(seed());
    try {
      f.select(['card', 'rule']);
      await settle();
      if (scale) { press('k'); await settle(); }
      await release(f, await hold(f, handle, dx, dy));
      assert.deepEqual(rectOf(f.byId('card')), card, `${name}: the card`);
      assert.deepEqual(rectOf(f.byId('rule')), rule, `${name}: the rule keeps its 1 px height`);
      assert.ok(Number(f.byId('rule').h) >= 1, `${name}: never 0`);
    } finally { f.destroy(); }
  }
});

test('a single 300 x 1 rule Scale-dragged on its e edge keeps its 1 px height', async () => {
  const f = mount([{ id: 'r', kind: 'box', x: 100, y: 200, w: 300, h: 1, rot: 0 } as Box]);
  try {
    f.select(['r']);
    await settle();
    press('k');
    await settle();
    await release(f, await hold(f, 'e', -220, 0));
    assert.deepEqual(rectOf(f.byId('r')), [100, 200, 80, 1], 'about the w edge, and 1 px tall, not 0');
  } finally { f.destroy(); }
});
