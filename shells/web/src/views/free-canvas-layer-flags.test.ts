// SPDX-License-Identifier: MPL-2.0
/**
 * The two layer flags on the canvas overlay - `hidden` and `locked` (plans/179 M4).
 *
 * The overlay picks from the MODEL, not from the DOM: `pickTopmost`/`pickMarquee` walk the
 * box array and test geometry. That is what makes both flags a real gap rather than a
 * cosmetic one - a hidden row is not in the render at all, yet its rectangle is still in
 * the array, so without a gate a marquee catches a box nobody can see and drags it around.
 * A locked row IS on screen; what it refuses is being acquired.
 *
 * Everything here goes through the ONE acquisition gate (`seqHiddenSkip` in
 * free-canvas.ts), so a click, a marquee and a hover are all covered by testing the two
 * that can be driven from jsdom.
 *
 * Same harness as free-canvas-frame-gestures.test.ts: real initFreeCanvas, in-memory
 * runtime, selection read back off the handle's own uiState().
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-layer-flags.test.ts
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
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent };
for (const k of [
  'window', 'document', 'HTMLElement', 'Element', 'KeyboardEvent', 'Event', 'CustomEvent',
  'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver',
]) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };
(globalThis as Record<string, unknown>).CSS = (dom.window as unknown as { CSS?: unknown }).CSS
  ?? { escape: (v: string) => String(v).replace(/[^\w-]/g, (c) => `\\${c}`) };

const { initFreeCanvas } = await import('./free-canvas.ts');

const NATIVE = 1000;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

function pointerEvent(type: string, x: number, y: number): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

const CFG = {
  idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  rotationField: 'rot', fillField: 'bg',
  addKinds: [{ id: 'box', label: 'Box', seed: { kind: 'box' } }],
};
/** Design's own declarations: the frame primitive PLUS the two layer-flag field names. */
const FRAME_CFG = {
  frameField: 'frame', frameKind: 'frame', orderField: 'order',
  hiddenField: 'hidden', lockedField: 'locked',
};
/** The same canvas WITHOUT the flag declarations - the "every other frame tool" case. */
const FRAME_CFG_BARE = { frameField: 'frame', frameKind: 'frame', orderField: 'order' };

/** Two boxes stacked on the SAME rectangle: `over` is last, so it is topmost. */
const STACK = (overFlags: Record<string, unknown>): Box[] => ([
  { id: 'under', kind: 'box', x: 100, y: 100, w: 200, h: 200 },
  { id: 'over', kind: 'box', x: 100, y: 100, w: 200, h: 200, ...overFlags },
] as Box[]);

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  sel(): string[];
  destroy(): void;
}

function mount(seed: Box[], frame: Record<string, unknown> = FRAME_CFG): Fixture {
  const viewEl = dom.window.document.createElement('div');
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  dom.window.document.body.appendChild(viewEl);
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  const model = new Map<string, unknown>([['boxes', seed]]);
  const subs: Array<() => void> = [];
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { model.set(id, value); for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: CFG as never, fields: [] },
    frame: frame as never,
    nativeW: NATIVE, nativeH: NATIVE,
  });
  return {
    stageEl, canvasEl,
    sel: () => handle.uiState().sel,
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 25)); for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };

/** A plain click at a canvas point. */
async function click(f: Fixture, x: number, y: number): Promise<void> {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', x, y));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', x, y));
  await settle();
}

/** A marquee from (x1,y1) to (x2,y2) over empty canvas. */
async function marquee(f: Fixture, x1: number, y1: number, x2: number, y2: number): Promise<void> {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', x1, y1));
  f.canvasEl.dispatchEvent(pointerEvent('pointermove', x2, y2));
  await settle();
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', x2, y2));
  await settle();
}

test('a click FALLS THROUGH a locked box to what is underneath it', async () => {
  const f = mount(STACK({ locked: true }));
  try {
    await click(f, 200, 200);
    assert.deepEqual(f.sel(), ['under'], 'the topmost box is locked, so the click reaches the one below');
  } finally { f.destroy(); }
});

test('a click falls through a HIDDEN box too - it is not even on screen', async () => {
  const f = mount(STACK({ hidden: true }));
  try {
    await click(f, 200, 200);
    assert.deepEqual(f.sel(), ['under']);
  } finally { f.destroy(); }
});

test('with nothing underneath, a click on a locked box selects NOTHING', async () => {
  const f = mount([{ id: 'only', kind: 'box', x: 100, y: 100, w: 200, h: 200, locked: true }] as Box[]);
  try {
    await click(f, 200, 200);
    assert.deepEqual(f.sel(), []);
  } finally { f.destroy(); }
});

test('a marquee catches neither the locked box nor the hidden one', async () => {
  const f = mount([
    { id: 'free', kind: 'box', x: 100, y: 100, w: 100, h: 100 },
    { id: 'locked', kind: 'box', x: 300, y: 100, w: 100, h: 100, locked: true },
    { id: 'hidden', kind: 'box', x: 500, y: 100, w: 100, h: 100, hidden: true },
  ] as Box[]);
  try {
    await marquee(f, 20, 20, 900, 400);
    assert.deepEqual(f.sel(), ['free'], 'a marquee must not drag away what cannot be seen or moved');
  } finally { f.destroy(); }
});

test('the flags read through the boolean coercion - "false" from a URL is false', async () => {
  const f = mount(STACK({ locked: 'false', hidden: '0' }));
  try {
    await click(f, 200, 200);
    assert.deepEqual(f.sel(), ['over'], 'neither string means true, so the top box is ordinary');
  } finally { f.destroy(); }
});

test('with no hiddenField/lockedField declared the flags are INERT', async () => {
  // The declaration IS the feature: a canvas that does not name the fields must behave
  // exactly as it did, even on a document whose rows happen to carry them.
  const f = mount(STACK({ locked: true, hidden: true }), FRAME_CFG_BARE);
  try {
    await click(f, 200, 200);
    assert.deepEqual(f.sel(), ['over']);
  } finally { f.destroy(); }
});
