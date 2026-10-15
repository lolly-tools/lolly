// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 311 M5 - GIMP's crop-tool grab zones, pinned through the real initFreeCanvas in
 * jsdom (the harness of free-canvas-transform-zones.test.ts):
 *
 *   1. A finger always gets the large zones: each corner a quarter of the visible rect
 *      (24-44 screen px) inside the box, each side the edge between two corners. A press
 *      there resizes once it travels 10 px; the middle still moves.
 *   2. Narrow mode: a box too small for the zones gets them outside, so a press on the
 *      box moves it and the rotate handle hangs past the zones.
 *   3. A pen follows the mouse: the M4 strips, or the large zones once "Large grab
 *      areas" is on. A mouse with the preference on gets them too.
 *   4. The preference is a device-local view preference: a checkbox row in the Lolly
 *      menu, kept in localStorage, read again at the next mount, and harmless when the
 *      storage throws.
 *   5. The wash over the zone under the pointer (or the finger's press) is the hit
 *      geometry itself, and goes when the pointer leaves or the press ends.
 *   6. While the large zones are on for the pointer, the resize handles let the press
 *      through (pointer-events: none), and a zone mode gate gives them back. The chrome
 *      says when the zones are live (data-zones), which an armed Add kind and a gradient
 *      edit take away.
 *   7. Zoomed: the zones are sized from the VISIBLE part of the rect.
 *   8. The zones stand in for the handles they let through: they reach as far out as a
 *      drawn handle took a press, a handle over another object or the bare stage still
 *      resizes (before the stage pan sees the press), a tap on a handle changes nothing,
 *      and a long-press context menu ends the press. On a touch laptop a finger meets a
 *      drawn corner on its square alone, as the media draw the corner.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-transform-grab-zones.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import { rotateVec } from './free-canvas-math.ts';
import type { Box } from './free-canvas-math.ts';
import { zoneRects, type ScreenRect, type ZoneKind, type ZoneOpts } from './free-canvas-transform.ts';

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
// A desktop by default: the primary pointer is fine and none is coarse, which sizes the
// drawn handles the large zones stand in for (12 px squares, no fat target round a
// corner). A test may set another device's media and put these back after.
const MEDIA = { coarse: false, fine: true };
Reflect.set(globalThis, 'matchMedia', (q: string) => ({
  matches: (q === '(pointer: fine)' && MEDIA.fine) || (q === '(any-pointer: coarse)' && MEDIA.coarse),
  media: q, addEventListener() {}, removeEventListener() {},
}));
Reflect.set(globalThis, 'ResizeObserver', class { observe() {} disconnect() {} });
Reflect.set(globalThis, 'CSS', Reflect.get(W, 'CSS') ?? { escape: (v: string) => String(v).replace(/[^\w-]/g, (c) => `\\${c}`) });

const { initFreeCanvas } = await import('./free-canvas.ts');

// The real rule that turns the handles off, lifted from the stylesheet, so the computed
// pointer-events below is the shipped CSS rather than a copy of the selector.
const GRAB_RULE = readFileSync(new URL('../styles/parts/editor.css', import.meta.url), 'utf8')
  .match(/^\.fc-chrome\[data-grab\][^{]*\{[^}]*\}/m)?.[0];
assert.ok(GRAB_RULE?.includes('pointer-events: none'), 'editor.css lets the handles through under data-grab');
const sheet = dom.window.document.createElement('style');
sheet.textContent = `.fc-handle { pointer-events: auto; }\n${GRAB_RULE}`;
dom.window.document.head.appendChild(sheet);

const KEY = 'lolly-design-large-grab-areas';
/** A working localStorage, kept in memory. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  };
}
/** A localStorage that refuses every call, as a blocked or private-mode one can. */
function throwingStorage(): Storage {
  const no = (): never => { throw new Error('SecurityError: storage is blocked'); };
  return { get length(): number { return no(); }, clear: no, getItem: no, key: no, removeItem: no, setItem: no };
}
function useStorage(store: Storage): void {
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
}

const NATIVE = 1000;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

type Kind = 'mouse' | 'pen' | 'touch';
interface Ptr { shift?: boolean; kind?: Kind; buttons?: number }
function pointer(type: string, x: number, y: number, p: Ptr = {}): MouseEvent {
  const e = new W.MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, shiftKey: !!p.shift,
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

interface MountOpts {
  canvas?: Record<string, unknown>;
  /** Canvas px per native px: 2 draws the 1000 px canvas 2000 px wide on the 1000 px stage. */
  zoom?: number;
  /** The stage and its view in client px; by default 1000 px square at the origin. */
  stage?: { x: number; y: number; w: number; h: number };
  /** The canvas's corner in client px; by default the stage's own corner. */
  canvasAt?: { x: number; y: number };
  /** A listener on the stage bound before the editor's own, as the stage's pan is. */
  stageFirst?: (e: Event) => void;
}
interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  byId(id: string): Record<string, unknown>;
  writes(): number;
  select(ids: string[]): void;
  selection(): string[];
  handle(name: string): HTMLElement | null;
  chrome(): HTMLElement;
  wash(): Element | null;
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
  const s = o.stage ?? { x: 0, y: 0, w: NATIVE, h: NATIVE };
  const c = o.canvasAt ?? { x: s.x, y: s.y };
  viewEl.getBoundingClientRect = () => rect(s.x, s.y, s.w, s.h);
  stageEl.getBoundingClientRect = () => rect(s.x, s.y, s.w, s.h);
  canvasEl.getBoundingClientRect = () => rect(c.x, c.y, NATIVE * zoom, NATIVE * zoom);
  if (o.stageFirst) stageEl.addEventListener('pointerdown', o.stageFirst);
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
    nativeW: NATIVE, nativeH: NATIVE,
    // A document action, so the rail carries the Lolly menu that holds the preference.
    setCanvasSize: () => {},
  });
  const boxes = (): Box[] => model.get('boxes') as Box[];
  return {
    stageEl, canvasEl,
    byId: (id) => boxes().find((b) => b.id === id)! as Record<string, unknown>,
    writes: () => writes,
    select: (ids) => handle.applyUi({ select: ids } as never),
    selection: () => [...handle.design.selection.get()].sort(),
    handle: (name) => stageEl.querySelector<HTMLElement>(`.fc-chrome .fc-h-${name}`),
    chrome: () => stageEl.querySelector<HTMLElement>('.fc-chrome')!,
    wash: () => stageEl.querySelector('.fc-overlay .fc-zone'),
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
const events = (el: Element): string => dom.window.getComputedStyle(el).pointerEvents;

/** Press at (x, y), travel to (tx, ty) and release there. */
async function drag(f: Fixture, x: number, y: number, tx: number, ty: number, p: Ptr = {}): Promise<void> {
  f.canvasEl.dispatchEvent(pointer('pointerdown', x, y, p));
  f.canvasEl.dispatchEvent(pointer('pointermove', tx, ty, p));
  await settle();
  f.canvasEl.dispatchEvent(pointer('pointerup', tx, ty, p));
  await settle();
}
/** Hover the pointer, no button down, and wait for the cursor frame. */
async function hover(f: Fixture, x: number, y: number, p: Ptr = {}): Promise<string | null> {
  f.canvasEl.dispatchEvent(pointer('pointermove', x, y, { ...p, buttons: 0 }));
  await settle();
  return cursor(f);
}
/** Open the Lolly menu and return its "Large grab areas" row. */
function grabRow(f: Fixture): HTMLElement {
  f.stageEl.querySelector<HTMLElement>('.fc-btn-lolly')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  const row = f.stageEl.querySelector<HTMLElement>('.fc-popover [data-pop="grab-areas"]');
  assert.ok(row, 'the Lolly menu carries the Large grab areas row');
  return row!;
}
async function toggleLargeGrab(f: Fixture): Promise<void> {
  grabRow(f).dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  await settle();
}
/** The wash's polygons as numbers, one quad per part. */
function washQuads(f: Fixture): number[][][] {
  return [...(f.wash()?.querySelectorAll('polygon') ?? [])].map((p) =>
    (p.getAttribute('points') ?? '').split(' ').map((xy) => xy.split(',').map(Number)));
}
/** The zone's own quads from the pure geometry, in the same form. */
function expectedQuads(r: ScreenRect, opts: ZoneOpts, kind: ZoneKind, handle: string): number[][][] {
  const z = zoneRects(r, opts).find((q) => q.kind === kind && q.handle === handle);
  assert.ok(z, `zoneRects has ${kind} ${handle}`);
  return z!.quads.map((q) => q.map((p) => [p.x, p.y]));
}
function sameQuads(actual: number[][][], expected: number[][][], msg: string): void {
  assert.equal(actual.length, expected.length, `${msg}: one polygon per part`);
  for (const [i, quad] of actual.entries()) {
    for (const [j, pt] of quad.entries()) {
      const want = expected[i]![j]!;
      assert.ok(Math.abs(pt[0]! - want[0]!) < 0.01 && Math.abs(pt[1]! - want[1]!) < 0.01,
        `${msg}: part ${i} point ${j} is ${pt}, not ${want}`);
    }
  }
}

/** A 200 px square at (100, 100): its large corner zones are 44 px, and it is not narrow. */
const BIG = (extra: Record<string, unknown> = {}): Box => ({ id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 200, rot: 0, ...extra } as Box);
const VIEW = { x: 0, y: 0, w: NATIVE, h: NATIVE };

// ── 1. A finger gets the large zones ────────────────────────────────────────────

test('a touch press inside a corner zone resizes from that corner after 10 px; short of that it taps', async () => {
  useStorage(memoryStorage());
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    // (120, 130) is 20 and 30 px inside the nw corner: inside its 44 px zone.
    f.canvasEl.dispatchEvent(pointer('pointerdown', 120, 130, { kind: 'touch' }));
    assert.equal(f.wash()?.getAttribute('data-zone'), 'corner-nw', 'the pressed zone is washed');
    f.canvasEl.dispatchEvent(pointer('pointermove', 126, 136, { kind: 'touch' }));
    f.canvasEl.dispatchEvent(pointer('pointerup', 126, 136, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200], '8.5 px of travel is a tap');
    assert.deepEqual(f.selection(), ['a']);
    assert.equal(f.writes(), 0);
    assert.equal(f.wash(), null, 'the wash goes with the press');
    await drag(f, 120, 130, 100, 100, { kind: 'touch' });
    assert.deepEqual(rectOf(f.byId('a')), [80, 70, 220, 230], 'both axes, from the se corner');
    assert.equal(f.writes(), 1, 'one undo step');
  } finally { f.destroy(); }
});

test('a touch press in the middle of the box moves the box', async () => {
  useStorage(memoryStorage());
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    await drag(f, 200, 200, 240, 230, { kind: 'touch' });
    assert.deepEqual(rectOf(f.byId('a')), [140, 130, 200, 200]);
    // Just inside the corner zone's inner edge is still the middle.
    await drag(f, 185, 175, 195, 195, { kind: 'touch' });
    assert.deepEqual(rectOf(f.byId('a')), [150, 150, 200, 200]);
  } finally { f.destroy(); }
});

test('a large zone never takes a press from another object', async () => {
  useStorage(memoryStorage());
  // b sits on top of a's nw corner zone.
  const f = mount([BIG(), { id: 'b', kind: 'box', x: 110, y: 110, w: 40, h: 40, rot: 0 } as Box]);
  try {
    f.select(['a']);
    await settle();
    await drag(f, 125, 125, 165, 135, { kind: 'touch' });
    assert.deepEqual(f.selection(), ['b'], 'the press picks the box under the finger');
    assert.deepEqual(rectOf(f.byId('b')), [150, 120, 40, 40], 'and moves box b');
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200]);
  } finally { f.destroy(); }
});

test('a drawn handle over another object resizes the selection on every press, and a tap on the handle changes nothing', async () => {
  useStorage(memoryStorage());
  // b, unselected and on top, covers a's nw corner and the handle drawn there.
  const f = mount([BIG(), { id: 'b', kind: 'box', x: 80, y: 80, w: 60, h: 60, rot: 0 } as Box]);
  try {
    f.select(['a']);
    await settle();
    // The chrome is laid out for a mouse, so the first touch reaches the handle element.
    f.handle('nw')!.dispatchEvent(pointer('pointerdown', 101, 101, { kind: 'touch' }));
    f.canvasEl.dispatchEvent(pointer('pointermove', 81, 81, { kind: 'touch' }));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 81, 81, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [80, 80, 220, 220], 'the first press resizes');
    assert.equal(events(f.handle('nw')!), 'none', 'and the handle lets the next presses through');
    // A tap on the handle, which sits over b, is the handle's: nothing is selected or written.
    await drag(f, 85, 85, 85, 85, { kind: 'touch' });
    assert.deepEqual(f.selection(), ['a']);
    assert.equal(f.writes(), 1);
    // Every later press reaches the canvas under the handle, and the handle still wins.
    await drag(f, 82, 82, 62, 62, { kind: 'touch' });
    assert.deepEqual(rectOf(f.byId('a')), [60, 60, 240, 240], 'the second press resizes too');
    assert.deepEqual(rectOf(f.byId('b')), [80, 80, 60, 60], 'and leaves box b where it was');
    assert.deepEqual(f.selection(), ['a']);
    // Off the handle the corner zone still yields to the object on top.
    await drag(f, 100, 100, 120, 110, { kind: 'touch' });
    assert.deepEqual(f.selection(), ['b']);
    assert.deepEqual(rectOf(f.byId('b')), [100, 90, 60, 60]);
  } finally { f.destroy(); }
});

// ── 2. Narrow mode ──────────────────────────────────────────────────────────────

test('a 30 px box is in narrow mode: a touch just outside its edge resizes, a touch on it moves', async () => {
  useStorage(memoryStorage());
  const f = mount([{ id: 's', kind: 'box', x: 100, y: 100, w: 30, h: 30, rot: 0 } as Box]);
  try {
    f.select(['s']);
    await settle();
    // 10 px right of the e edge, in the 24 px zone outside the box.
    f.canvasEl.dispatchEvent(pointer('pointerdown', 140, 115, { kind: 'touch' }));
    assert.equal(f.wash()?.getAttribute('data-zone'), 'edge-e');
    f.canvasEl.dispatchEvent(pointer('pointermove', 160, 115, { kind: 'touch' }));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 160, 115, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('s')), [100, 100, 50, 30], 'the width only');
    // The box is 50 x 30 now, still under 3 corners wide: the whole inside moves.
    await drag(f, 103, 103, 123, 123, { kind: 'touch' });
    assert.deepEqual(rectOf(f.byId('s')), [120, 120, 50, 30]);
    // The rotate handle hangs past the 24 px zones below the box: 44 px, not 30.
    assert.deepEqual(at(f.handle('rotate')!), [145, 150 + 44]);
    // A mouse lays the chrome out for its own zones again, and the handle comes back up.
    await hover(f, 500, 500);
    await settle();
    assert.deepEqual(at(f.handle('rotate')!), [145, 150 + 30]);
  } finally { f.destroy(); }
});

test('a short box hangs its rotate handle past its stood-off s handle, for every pointer', async () => {
  useStorage(memoryStorage());
  const f = mount([{ id: 'r', kind: 'box', x: 100, y: 100, w: 100, h: 20, rot: 0 } as Box]);
  try {
    f.select(['r']);
    await settle();
    assert.deepEqual(at(f.handle('s')!), [150, 120 + 12], 'the s handle stands 12 px off');
    assert.deepEqual(at(f.handle('rotate')!), [150, 120 + 40], 'and the rotate handle hangs 40 px, clear of the s handle');
  } finally { f.destroy(); }
});

test('a narrow set hangs its rotate handle past the zones too', async () => {
  useStorage(memoryStorage());
  const f = mount([
    { id: 'a', kind: 'box', x: 100, y: 100, w: 20, h: 20, rot: 0 },
    { id: 'b', kind: 'box', x: 130, y: 100, w: 20, h: 20, rot: 0 },
  ] as Box[]);
  try {
    f.select(['a', 'b']);
    await settle();
    await toggleLargeGrab(f);
    assert.deepEqual(at(f.handle('rotate')!), [125, 120 + 44], 'the set is 50 x 20, narrow');
  } finally { f.destroy(); }
});

// ── 3. A pen follows the mouse ──────────────────────────────────────────────────

test('a pen uses the M4 strips without the preference and the large zones with the preference on', async () => {
  useStorage(memoryStorage());
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    // 30 px inside the nw corner: past the pen's 20 px corner square, so the middle.
    assert.equal(await hover(f, 130, 130, { kind: 'pen' }), null, 'no zone cursor');
    await drag(f, 130, 130, 150, 160, { kind: 'pen' });
    assert.deepEqual(rectOf(f.byId('a')), [120, 130, 200, 200], 'moved');
    await toggleLargeGrab(f);
    // The same spot on the moved box is inside its 44 px corner zone now.
    assert.equal(await hover(f, 150, 160, { kind: 'pen' }), 'nwse-resize');
    await drag(f, 150, 160, 130, 140, { kind: 'pen' });
    assert.deepEqual(rectOf(f.byId('a')), [100, 110, 220, 220], 'resized from the nw corner');
  } finally { f.destroy(); }
});

test('a mouse with the preference on uses the large zones; without it the same press moves', async () => {
  const store = memoryStorage();
  store.setItem(KEY, 'true');
  useStorage(store);
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(await hover(f, 130, 130), 'nwse-resize');
    await drag(f, 130, 130, 110, 110);
    assert.deepEqual(rectOf(f.byId('a')), [80, 80, 220, 220]);
  } finally { f.destroy(); }
  useStorage(memoryStorage());
  const g = mount([BIG()]);
  try {
    g.select(['a']);
    await settle();
    assert.equal(await hover(g, 130, 130), null);
    await drag(g, 130, 130, 110, 110);
    assert.deepEqual(rectOf(g.byId('a')), [80, 80, 200, 200], 'a move');
  } finally { g.destroy(); }
});

// ── 4. The preference ───────────────────────────────────────────────────────────

test('Large grab areas is a checkbox row that persists through a remount', async () => {
  const store = memoryStorage();
  useStorage(store);
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    const row = grabRow(f);
    assert.equal(row.getAttribute('role'), 'menuitemcheckbox');
    assert.equal(row.getAttribute('aria-checked'), 'false', 'off by default');
    assert.equal(row.textContent, 'Large grab areas');
    row.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
    await settle();
    assert.equal(f.stageEl.querySelector('.fc-popover'), null, 'the menu closes');
    assert.equal(store.getItem(KEY), 'true', 'kept on this device');
    const live = dom.window.document.querySelector('[aria-live="polite"][data-a11y-live]');
    assert.equal(live?.textContent, 'Large grab areas on', 'the change is announced');
  } finally { f.destroy(); }
  const g = mount([BIG()]);
  try {
    g.select(['a']);
    await settle();
    assert.equal(grabRow(g).getAttribute('aria-checked'), 'true', 'read back at the next mount');
    g.stageEl.querySelector<HTMLElement>('.fc-btn-lolly')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
    await drag(g, 130, 130, 110, 110);
    assert.deepEqual(rectOf(g.byId('a')), [80, 80, 220, 220], 'and the mouse has the large zones');
    await toggleLargeGrab(g);
    assert.equal(store.getItem(KEY), 'false');
    const live = dom.window.document.querySelector('[aria-live="polite"][data-a11y-live]');
    assert.equal(live?.textContent, 'Large grab areas off');
  } finally { g.destroy(); }
});

test('a localStorage that throws leaves the preference off, and the toggle still works for the visit', async () => {
  useStorage(throwingStorage());
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(grabRow(f).getAttribute('aria-checked'), 'false');
    f.stageEl.querySelector<HTMLElement>('.fc-btn-lolly')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
    await toggleLargeGrab(f);
    assert.equal(grabRow(f).getAttribute('aria-checked'), 'true', 'on for this editor');
    f.stageEl.querySelector<HTMLElement>('.fc-btn-lolly')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
    await drag(f, 130, 130, 110, 110);
    assert.deepEqual(rectOf(f.byId('a')), [80, 80, 220, 220]);
  } finally { f.destroy(); }
  const g = mount([BIG()]);
  try {
    assert.equal(grabRow(g).getAttribute('aria-checked'), 'false', 'nothing could be kept');
  } finally { g.destroy(); }
});

// ── 5. The wash ─────────────────────────────────────────────────────────────────

test('the wash is the hit geometry of the zone under the pointer, and goes on leave', async () => {
  const store = memoryStorage();
  store.setItem(KEY, 'true');
  useStorage(store);
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    const r: ScreenRect = { x: 100, y: 100, w: 200, h: 200, rot: 0 };
    const mouse: ZoneOpts = { pointerKind: 'mouse', large: true, viewport: VIEW, allowRotate: true };
    await hover(f, 130, 130);
    const wash = f.wash()!;
    assert.ok(wash, 'a wash over the corner zone');
    assert.equal(wash.getAttribute('aria-hidden'), 'true');
    assert.equal(wash.getAttribute('data-zone'), 'corner-nw');
    sameQuads(washQuads(f), expectedQuads(r, mouse, 'corner', 'nw'), 'the nw corner');
    assert.ok(wash.compareDocumentPosition(f.chrome()) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'under the chrome');
    // The rotate zone outside the corner is an L of two parts.
    await hover(f, 90, 90);
    assert.equal(f.wash()?.getAttribute('data-zone'), 'rotate-nw');
    sameQuads(washQuads(f), expectedQuads(r, mouse, 'rotate', 'nw'), 'the nw rotate zone');
    await hover(f, 200, 120);
    sameQuads(washQuads(f), expectedQuads(r, mouse, 'edge', 'n'), 'the n side');
    await hover(f, 200, 200);
    assert.equal(f.wash(), null, 'none in the middle');
    await hover(f, 280, 280);
    assert.equal(f.wash()?.getAttribute('data-zone'), 'corner-se');
    f.stageEl.dispatchEvent(pointer('pointerleave', 280, 280, { buttons: 0 }));
    await settle();
    assert.equal(f.wash(), null, 'gone when the pointer leaves the stage');
  } finally { f.destroy(); }
});

test('the wash sits in stage px: the hit quads less the stage origin, lined up with the handles', async () => {
  const store = memoryStorage();
  store.setItem(KEY, 'true');
  useStorage(store);
  const view = { x: 50, y: 30, w: NATIVE, h: NATIVE };
  const f = mount([BIG()], { stage: view });
  try {
    f.select(['a']);
    await settle();
    // The box is (150, 130) to (350, 330) on screen, (100, 100) to (300, 300) in stage px.
    await hover(f, 180, 160);
    assert.equal(f.wash()?.getAttribute('data-zone'), 'corner-nw');
    const quads = expectedQuads({ x: 150, y: 130, w: 200, h: 200, rot: 0 },
      { pointerKind: 'mouse', large: true, viewport: view, allowRotate: true }, 'corner', 'nw')
      .map((quad) => quad.map(([x, y]) => [x! - 50, y! - 30]));
    sameQuads(washQuads(f), quads, 'the nw corner in stage px');
    // The zone reaches the corner handle's 6 px square past the corner the handle sits on.
    const [hx, hy] = at(f.handle('nw')!);
    assert.deepEqual([hx, hy], [100, 100]);
    assert.deepEqual(washQuads(f)[0]![0], [hx - 6, hy - 6]);
    await hover(f, 250, 135);
    const [nx, ny] = at(f.handle('n')!);
    assert.deepEqual(washQuads(f)[0]![0]![1], ny - 15, 'the n side reaches the n handle\'s fat target');
    assert.equal(nx, 200);
  } finally { f.destroy(); }
});

test('the wash turns with the box, and the M4 strips have none', async () => {
  const store = memoryStorage();
  store.setItem(KEY, 'true');
  useStorage(store);
  const f = mount([BIG({ rot: 30 })]);
  try {
    f.select(['a']);
    await settle();
    const v = rotateVec(-80, -80, 30);
    await hover(f, 200 + v.x, 200 + v.y);
    assert.equal(f.wash()?.getAttribute('data-zone'), 'corner-nw');
    sameQuads(washQuads(f), expectedQuads({ x: 100, y: 100, w: 200, h: 200, rot: 30 },
      { pointerKind: 'mouse', large: true, viewport: VIEW, allowRotate: true }, 'corner', 'nw'), 'turned 30 degrees');
  } finally { f.destroy(); }
  useStorage(memoryStorage());
  const g = mount([BIG()]);
  try {
    g.select(['a']);
    await settle();
    assert.equal(await hover(g, 303, 200), 'ew-resize', 'an M4 strip');
    assert.equal(g.wash(), null, 'shows its cursor only');
  } finally { g.destroy(); }
});

test('a finger\'s wash shows the pressed zone and goes when the drag starts or the press ends', async () => {
  useStorage(memoryStorage());
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerdown', 200, 110, { kind: 'touch' }));
    assert.equal(f.wash()?.getAttribute('data-zone'), 'edge-n');
    sameQuads(washQuads(f), expectedQuads({ x: 100, y: 100, w: 200, h: 200, rot: 0 },
      { pointerKind: 'touch', large: true, viewport: VIEW, allowRotate: true }, 'edge', 'n'), 'the n side for a finger');
    f.canvasEl.dispatchEvent(pointer('pointermove', 200, 80, { kind: 'touch' }));
    await settle();
    assert.equal(f.wash(), null, 'the drag shows itself');
    f.canvasEl.dispatchEvent(pointer('pointerup', 200, 80, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [100, 70, 200, 230]);
    assert.equal(f.wash(), null);
    // Escape drops a held press, and the wash goes too.
    f.canvasEl.dispatchEvent(pointer('pointerdown', 200, 80, { kind: 'touch' }));
    assert.ok(f.wash());
    press('Escape');
    assert.equal(f.wash(), null);
    f.canvasEl.dispatchEvent(pointer('pointerup', 200, 80, { kind: 'touch' }));
    await settle();
  } finally { f.destroy(); }
});

// ── 6. The handles let the press through ────────────────────────────────────────

test('while the large zones are on for the pointer the resize handles are pointer-events none', async () => {
  useStorage(memoryStorage());
  const f = mount([BIG()], { canvas: { pathField: 'path' } });
  try {
    f.select(['a']);
    await settle();
    assert.equal(f.chrome().hasAttribute('data-grab'), false, 'a mouse, no preference');
    assert.equal(events(f.handle('ne')!), 'auto');
    // A finger touches down: the chrome is laid out for its zones.
    await drag(f, 200, 200, 200, 200, { kind: 'touch' });
    assert.equal(f.chrome().hasAttribute('data-grab'), true);
    for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) assert.equal(events(f.handle(h)!), 'none', `${h} lets the press through`);
    assert.equal(f.handle('ne')!.hidden, false, 'still drawn');
    assert.equal(events(f.handle('rotate')!), 'auto', 'the rotate handle keeps its own press');
    // A mouse moving over the stage takes them back.
    await hover(f, 500, 500);
    assert.equal(f.chrome().hasAttribute('data-grab'), false);
    assert.equal(events(f.handle('ne')!), 'auto');
    // With the preference on, a mouse has the zones too.
    await toggleLargeGrab(f);
    assert.equal(f.chrome().hasAttribute('data-grab'), true);
    assert.equal(events(f.handle('se')!), 'none');
    assert.equal(await hover(f, 130, 130), 'nwse-resize');
    assert.equal(f.wash()?.getAttribute('data-zone'), 'corner-nw');
    // The Node tool has no zones, so its handles are live again, and a press in the
    // corner zone selects and moves as the tool does.
    press('n');
    await settle();
    assert.equal(f.chrome().hasAttribute('data-grab'), false, 'the Node tool gives the handles back');
    assert.equal(f.wash(), null, 'and takes the wash away under the still pointer');
    assert.equal(cursor(f), null);
    await drag(f, 130, 130, 140, 150);
    assert.deepEqual(rectOf(f.byId('a')), [110, 120, 200, 200], 'no zone in the Node tool');
    press('v');
    await settle();
    assert.equal(f.chrome().hasAttribute('data-grab'), true, 'back on the pointer');
  } finally { f.destroy(); }
});

test('the chrome carries data-zones only while the zones are live: not with an armed Add kind, nor in gradient edit', async () => {
  useStorage(memoryStorage());
  const f = mount([BIG()], { canvas: { gradField: 'grad' } });
  const zones = (): boolean => f.chrome().hasAttribute('data-zones');
  try {
    f.select(['a']);
    await settle();
    assert.equal(zones(), true, 'the pointer with a selection: a fine pointer meets a corner on its square');
    // An armed Add kind has no zones, so no rule takes the corners' fat target.
    f.stageEl.querySelector<HTMLElement>('.fc-btn-add')!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
    await settle();
    const box = [...f.stageEl.querySelectorAll<HTMLElement>('.fc-pop-item, .fc-pop-gitem')].find((b) => (b.textContent ?? '').trim() === 'Box');
    assert.ok(box, 'the Add menu offers Box');
    box!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
    await settle();
    assert.ok(f.stageEl.classList.contains('fc-arming'), 'Box is armed');
    assert.equal(zones(), false, 'an armed Add kind');
    press('v');
    await settle();
    assert.equal(zones(), true, 'back on the pointer');
    // Gradient edit has no zones either.
    const grad = (): HTMLElement => f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx="grad"]')!;
    assert.ok(grad(), 'the object bar offers a gradient');
    grad().dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
    await settle();
    assert.ok(f.stageEl.querySelector('.fc-grad-stop'), 'the gradient edit is live');
    assert.equal(zones(), false, 'in gradient edit');
    grad().dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
    await settle();
    assert.equal(f.stageEl.querySelector('.fc-grad-stop'), null, 'the gradient edit is over');
    assert.equal(zones(), true, 'and the zones are back');
  } finally { f.destroy(); }
});

test('a finger on a handle the chrome had not yet let through is still a zone press', async () => {
  useStorage(memoryStorage());
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    assert.equal(f.chrome().hasAttribute('data-grab'), false, 'laid out for a mouse');
    const ne = f.handle('ne')!;
    // A short touch on the handle (inside its hit area, on the box) is a tap, not the
    // handle's immediate resize.
    ne.dispatchEvent(pointer('pointerdown', 296, 104, { kind: 'touch' }));
    f.canvasEl.dispatchEvent(pointer('pointermove', 300, 100, { kind: 'touch' }));
    f.canvasEl.dispatchEvent(pointer('pointerup', 300, 100, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200], 'a tap');
    assert.equal(f.writes(), 0);
    assert.deepEqual(f.selection(), ['a']);
    // Past 10 px the zone resizes from that corner.
    ne.dispatchEvent(pointer('pointerdown', 296, 104, { kind: 'touch' }));
    f.canvasEl.dispatchEvent(pointer('pointermove', 326, 84, { kind: 'touch' }));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 326, 84, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [100, 80, 230, 220]);
    // A mouse on the same handle drags the handle at once, as it always has.
    await hover(f, 500, 500);
    const se = f.handle('se')!;
    se.dispatchEvent(pointer('pointerdown', 330, 300));
    f.canvasEl.dispatchEvent(pointer('pointermove', 332, 301));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 332, 301));
    await settle();
    assert.deepEqual(rectOf(f.byId('a')), [100, 80, 232, 221], '2 px is a drag for the handle');
  } finally { f.destroy(); }
});

// ── 7. Zoomed ───────────────────────────────────────────────────────────────────

test('zoomed in, the large zones keep their screen size and come from the visible rect', async () => {
  useStorage(memoryStorage());
  // The 1000 px canvas drawn 2000 px wide: the box is (200, 200) to (600, 400) on screen.
  const f = mount([BIG({ h: 100 })], { zoom: 2 });
  try {
    f.select(['a']);
    await settle();
    // 30 screen px inside the nw corner (15 native px).
    await drag(f, 230, 230, 210, 200, { kind: 'touch' });
    assert.deepEqual(rectOf(f.byId('a')), [90, 85, 210, 115], '20 and 30 screen px are 10 and 15 native px');
  } finally { f.destroy(); }
  // 40 screen px of a 400 px wide box on the stage: narrow, so the visible part moves.
  const g = mount([{ id: 'r', kind: 'box', x: 480, y: 100, w: 200, h: 100, rot: 0 } as Box], { zoom: 2 });
  try {
    g.select(['r']);
    await settle();
    await drag(g, 970, 300, 960, 300, { kind: 'touch' });
    assert.deepEqual(rectOf(g.byId('r')), [475, 100, 200, 100], 'a move, where the whole rect would put a side zone');
    // 50 px on screen, still narrow: just left of its w edge (at 950) is the zone outside.
    await drag(g, 940, 300, 920, 300, { kind: 'touch' });
    assert.deepEqual(rectOf(g.byId('r')), [465, 100, 210, 100]);
  } finally { g.destroy(); }
});

// ── 8. The zones stand in for the handles they let through ─────────────────────

test('the large zones reach as far out as the drawn handles, for a finger and for a mouse', async () => {
  useStorage(memoryStorage());
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    // 9 px out on the nw diagonal: on a coarse corner handle's fat target.
    await drag(f, 91, 91, 61, 61, { kind: 'touch' });
    assert.deepEqual(rectOf(f.byId('a')), [70, 70, 230, 230], 'from the nw corner');
    // 8 px out from the w side, on the w handle's fat target.
    await drag(f, 62, 185, 32, 185, { kind: 'touch' });
    assert.deepEqual(rectOf(f.byId('a')), [40, 70, 260, 230], 'from the w side');
    // A tap 7 px above the n side, on the n handle, keeps the selection.
    await drag(f, 170, 63, 170, 63, { kind: 'touch' });
    assert.deepEqual(f.selection(), ['a'], 'a tap on a handle is not a tap on the bare canvas');
    // A mouse with the preference: the corner handle's 6 px square resizes, and the turn
    // starts past the square.
    await toggleLargeGrab(f);
    assert.equal(await hover(f, 35, 65), 'nwse-resize');
    assert.equal(await hover(f, 30, 60), 'rotate-nw');
    await drag(f, 35, 65, 25, 55);
    assert.deepEqual(rectOf(f.byId('a')), [30, 60, 270, 240]);
    assert.equal(Number(f.byId('a').rot), 0, 'no turn');
    // A click 5 px above the n midpoint is on the n handle: the selection stays.
    await drag(f, 165, 55, 165, 55);
    assert.deepEqual(f.selection(), ['a']);
    await drag(f, 165, 55, 165, 35);
    assert.deepEqual(rectOf(f.byId('a')), [30, 40, 270, 260], 'and a drag from there resizes');
  } finally { f.destroy(); }
});

test('over another object a finger meets a corner as far out as the corner\'s fat target reaches, on a touch laptop and a tablet alike', async () => {
  useStorage(memoryStorage());
  const devices = [['touch laptop', { coarse: true, fine: true }], ['tablet', { coarse: true, fine: false }]] as const;
  for (const [device, media] of devices) {
    Object.assign(MEDIA, media);
    // b, unselected and on top, lies over a's nw corner zone, 12 px out on the diagonal.
    const f = mount([BIG(), { id: 'b', kind: 'box', x: 70, y: 70, w: 25, h: 25, rot: 0 } as Box]);
    try {
      f.select(['a']);
      await settle();
      // 40 px up and left, clear of every snap b offers.
      await drag(f, 88, 88, 48, 48, { kind: 'touch' });
      // A touch laptop draws the corner without its fat target (a fine primary pointer),
      // but over another object the corner keeps the reach it had before the zones.
      assert.deepEqual(rectOf(f.byId('a')), [60, 60, 240, 240], `${device}: the corner resizes the selection`);
      assert.deepEqual(f.selection(), ['a']);
      assert.deepEqual(rectOf(f.byId('b')), [70, 70, 25, 25], `${device}: and the object on top stays`);
      assert.equal(f.writes(), 1, `${device}: one undo step`);
    } finally {
      f.destroy();
      Object.assign(MEDIA, { coarse: false, fine: true });
    }
  }
});

test('a large zone past the artboard takes a finger or a pen before the stage pan, and keeps the selection', async () => {
  useStorage(memoryStorage());
  let panSaw = 0;
  // The canvas at (100, 100) on a 1200 px stage. s is flush with the canvas top, so its
  // n handle and the zones above it lie over the bare stage. The stage pan's listener is
  // bound before the editor's, as the tool view binds the pan.
  const stage = { x: 0, y: 0, w: 1200, h: 1200 };
  const f = mount([{ id: 's', kind: 'box', x: 300, y: 0, w: 40, h: 40, rot: 0 } as Box],
    { stage, canvasAt: { x: 100, y: 100 }, stageFirst: (e) => { if ((e as PointerEvent).pointerType !== 'mouse') panSaw++; } });
  try {
    f.select(['s']);
    await settle();
    // A tap on the box lays the chrome out for a finger.
    await drag(f, 420, 120, 420, 120, { kind: 'touch' });
    assert.equal(events(f.handle('n')!), 'none');
    // 8 px above the n side, on the drawn n handle, over the stage.
    f.stageEl.dispatchEvent(pointer('pointerdown', 420, 92, { kind: 'touch' }));
    assert.equal(panSaw, 0, 'the stage pan never sees the press');
    assert.deepEqual(f.selection(), ['s'], 'nor does the backdrop deselect');
    f.canvasEl.dispatchEvent(pointer('pointermove', 420, 60, { kind: 'touch' }));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 420, 60, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('s')), [300, -32, 40, 72]);
    // A tap on the same handle, now at y 68, changes nothing.
    f.stageEl.dispatchEvent(pointer('pointerdown', 420, 62, { kind: 'touch' }));
    f.canvasEl.dispatchEvent(pointer('pointerup', 420, 62, { kind: 'touch' }));
    await settle();
    assert.deepEqual(f.selection(), ['s']);
    assert.equal(panSaw, 0);
    // Past every zone a finger is the stage's, and the tap deselects.
    f.stageEl.dispatchEvent(pointer('pointerdown', 420, 30, { kind: 'touch' }));
    f.stageEl.dispatchEvent(pointer('pointerup', 420, 30, { kind: 'touch' }));
    await settle();
    assert.equal(panSaw, 1);
    assert.deepEqual(f.selection(), []);
    // A pen with the preference finds the zone over the stage too, hover and press.
    f.select(['s']);
    await settle();
    await toggleLargeGrab(f);
    f.stageEl.dispatchEvent(pointer('pointermove', 420, 62, { kind: 'pen', buttons: 0 }));
    await settle();
    assert.equal(cursor(f), 'ns-resize');
    assert.equal(f.wash()?.getAttribute('data-zone'), 'edge-n');
    f.stageEl.dispatchEvent(pointer('pointerdown', 420, 62, { kind: 'pen' }));
    f.canvasEl.dispatchEvent(pointer('pointermove', 420, 42, { kind: 'pen' }));
    await settle();
    f.canvasEl.dispatchEvent(pointer('pointerup', 420, 42, { kind: 'pen' }));
    await settle();
    assert.deepEqual(rectOf(f.byId('s')), [300, -52, 40, 92]);
    assert.equal(panSaw, 1);
  } finally { f.destroy(); }
  // A 30 px box flush with the canvas's left side: its narrow w zone lies over the stage.
  const g = mount([{ id: 'q', kind: 'box', x: 0, y: 300, w: 30, h: 30, rot: 0 } as Box], { stage, canvasAt: { x: 100, y: 100 } });
  try {
    g.select(['q']);
    await settle();
    // q is (100, 400) to (130, 430) on screen: 20 px left of its w side, clear of the w and
    // nw handles, is the w zone.
    g.stageEl.dispatchEvent(pointer('pointerdown', 80, 402, { kind: 'touch' }));
    assert.deepEqual(g.selection(), ['q'], 'the press does not deselect');
    g.canvasEl.dispatchEvent(pointer('pointermove', 60, 402, { kind: 'touch' }));
    await settle();
    g.canvasEl.dispatchEvent(pointer('pointerup', 60, 402, { kind: 'touch' }));
    await settle();
    assert.deepEqual(rectOf(g.byId('q')), [-20, 300, 50, 30]);
    assert.deepEqual(g.selection(), ['q']);
  } finally { g.destroy(); }
});

test('a context menu opened during a finger\'s press in a zone stays open when the finger lifts', async () => {
  useStorage(memoryStorage());
  const f = mount([BIG()]);
  try {
    f.select(['a']);
    await settle();
    // Inside the nw corner zone, clear of the handle: a lift there would replay a click.
    f.canvasEl.dispatchEvent(pointer('pointerdown', 120, 130, { kind: 'touch' }));
    assert.equal(f.wash()?.getAttribute('data-zone'), 'corner-nw');
    f.canvasEl.dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 130 }));
    assert.ok(f.stageEl.querySelector('.fc-popover'), 'the long press opens the menu');
    assert.equal(f.wash(), null, 'and ends the press');
    f.canvasEl.dispatchEvent(pointer('pointerup', 120, 130, { kind: 'touch' }));
    await settle();
    assert.ok(f.stageEl.querySelector('.fc-popover'), 'the lift leaves the menu open');
    assert.deepEqual(f.selection(), ['a']);
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});
