// SPDX-License-Identifier: MPL-2.0
/**
 * Stable BOX ids - plan 100 section 3's "Hard prerequisite", from the canvas editor's side.
 *
 * Two claims, and the second is the one that used to be false:
 *
 *  1. A box minted here carries a ULID, not a per-mount counter. Two devices opening the
 *     SAME saved session and adding a box each could previously mint the same id
 *     ('b' + a 4-char clock slice + a counter that restarts at 0 on every mount) - which
 *     is precisely what a collab makes routine, and what makes a late field op land on
 *     somebody else's box.
 *  2. `idOf` no longer falls back to the ARRAY INDEX for an id-bearing manifest. The
 *     fixture below is the honest demonstration: a document holding a box whose id is
 *     literally "1" plus a legacy row at index 1. Under the index fallback both keyed to
 *     '1', so selecting one selected - and dragged - the other.
 *
 * Driven through the real `initFreeCanvas` on the jsdom harness free-canvas-tools.test.ts
 * established: an in-memory runtime that echoes `setInput` back through `getModel`, so
 * "the model was written once" is a round trip and not a stub.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-ids.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';
import { isUlid } from '../lib/row-id.ts';
import { initFreeCanvas } from './free-canvas.ts';

// ── jsdom bootstrap (same shape as free-canvas-tools.test.ts) ─────────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent };
for (const k of ['window', 'document', 'HTMLElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
const rafQueue: Array<() => void> = [];
(globalThis as Record<string, unknown>).requestAnimationFrame = (fn: FrameRequestCallback): number => {
  rafQueue.push(() => fn(0));
  return rafQueue.length;
};
(globalThis as Record<string, unknown>).cancelAnimationFrame = (): void => {};
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

function pointerEvent(type: string, o: { x: number; y: number }): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: o.x, clientY: o.y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

// ── fixture ───────────────────────────────────────────────────────────────────

const NATIVE = 1000;

/** Design's canvas block, trimmed to what identity needs. `fields` declares the
 *  id sub-field exactly as every shipped canvas manifest does - that declaration is what
 *  tells the editor rows are id-bearing. */
const CANVAS_CFG = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
  fillField: 'bg', shapeField: 'shape', textField: 'text', groupField: 'group',
  addKinds: [{ id: 'box', label: 'Box', seed: {} }],
};
const FIELDS = ['id', 'kind', 'shape', 'x', 'y', 'w', 'h', 'rot', 'bg', 'text', 'group'].map(id => ({ id, type: 'text' as const }));

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  /** Write the array straight into the model, bypassing the editor's own commit path - 
   *  what a hook patch or another surface does. Nothing normalises such a write. */
  setBoxes(next: Box[]): void;
  writes: () => number;
  destroy(): void;
}

function mount(initial: Box[], cfg: Record<string, unknown> = CANVAS_CFG, fields = FIELDS): Fixture {
  const viewEl = dom.window.document.createElement('div');
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  dom.window.document.body.appendChild(viewEl);
  canvasEl.style.width = NATIVE + 'px';
  canvasEl.style.height = NATIVE + 'px';
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  const model = new Map<string, unknown>([['boxes', initial]]);
  let writes = 0;
  const subs: Array<() => void> = [];
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { model.set(id, value); writes++; for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: cfg as never, fields: fields as never },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  frames();
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    setBoxes(next: Box[]) { runtime.setInput('boxes', next); frames(); },
    writes: () => writes,
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

/** Press, optionally drag, release - the pointer gesture the editor commits on. */
function drag(f: Fixture, from: [number, number], to: [number, number]): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x: from[0], y: from[1] }));
  f.canvasEl.dispatchEvent(pointerEvent('pointermove', { x: to[0], y: to[1] }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: to[0], y: to[1] }));
  frames();
}

/** Arm the Add tool and place one box, the way the rail does it. */
function addBox(f: Fixture, x: number, y: number): void {
  const add = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-add');
  assert.ok(add, 'the rail has an Add button');
  click(add!);
  frames();
  const item = f.stageEl.querySelector<HTMLButtonElement>('.fc-pop-item, .fc-pop-gitem');
  assert.ok(item, 'the Add menu offers a kind');
  click(item!);
  frames();
  drag(f, [x, y], [x, y]);
}

const box = (o: Partial<Box>): Box =>
  ({ kind: 'box', shape: 'rect', x: 0, y: 0, w: 120, h: 120, bg: '#ccc', ...o } as Box);

// ══ fresh ids ═════════════════════════════════════════════════════════════════

test('a box added on the canvas is born with a ULID, and no two collide', () => {
  const f = mount([]);
  addBox(f, 200, 200);
  addBox(f, 600, 600);
  const ids = f.boxes().map(b => String(b.id));
  assert.equal(ids.length, 2);
  for (const id of ids) assert.ok(isUlid(id), `"${id}" is a ULID`);
  assert.equal(new Set(ids).size, 2, 'the two ids differ');
  f.destroy();
});

test('ids survive a save/load round trip unchanged', () => {
  const f = mount([]);
  addBox(f, 200, 200);
  addBox(f, 600, 600);
  const saved = JSON.parse(JSON.stringify(f.boxes())) as Box[];   // what lands in the slot
  f.destroy();

  const g = mount(saved);
  assert.deepEqual(g.boxes().map(b => b.id), saved.map(b => b.id), 'reloading re-ids nothing');
  assert.equal(g.writes(), 0, 'and an already-id-bearing document is not rewritten on load');
  g.destroy();
});

// ══ legacy documents ══════════════════════════════════════════════════════════

test('a legacy row without an id gets one on load - exactly once', () => {
  const legacy = [box({ id: 'keep-me', x: 100, y: 100 }), box({ x: 400, y: 400 }), box({ id: '', x: 700, y: 700 })];
  const f = mount(legacy);
  const after = f.boxes();
  assert.equal(f.writes(), 1, 'one normalisation write, not one per row');
  assert.equal(after[0]!.id, 'keep-me', 'an existing id is never rewritten');
  assert.ok(isUlid(String(after[1]!.id)), 'the id-less row got a ULID');
  assert.ok(isUlid(String(after[2]!.id)), 'an empty-string id counts as missing');
  assert.notEqual(after[1]!.id, after[2]!.id);
  const ids = after.map(b => b.id);
  f.destroy();

  // Reopening the same document (a saved session) must not mint new ids.
  const g = mount(JSON.parse(JSON.stringify(after)) as Box[]);
  assert.equal(g.writes(), 0, 'the second load writes nothing');
  assert.deepEqual(g.boxes().map(b => b.id), ids, 'and every id is the one from the first load');
  g.destroy();
});

test('a manifest with no id field keeps the historical index behaviour', () => {
  // No `idField` in the canvas block AND no `id` sub-field: nothing to normalise, so the
  // editor must not write an undeclared field into the tool's rows.
  const noId: Record<string, unknown> = { ...CANVAS_CFG };
  delete noId.idField;
  const f = mount([box({ x: 100, y: 100 })], noId, FIELDS.filter(f2 => f2.id !== 'id'));
  assert.equal(f.writes(), 0, 'no normalisation write');
  assert.equal(f.boxes()[0]!.id, undefined, 'and no id was invented');
  f.destroy();
});

// ══ no index fallback ═════════════════════════════════════════════════════════

test('selection never keys on the array index - a box whose id is "1" is not row 1', () => {
  // Under the old `idOf`, the legacy row at index 1 keyed to '1' - the SAME key as the
  // box whose declared id happens to be the string "1" - so dragging one dragged both.
  const f = mount([box({ id: '1', x: 100, y: 100 }), box({ x: 600, y: 600 })]);
  const ids = f.boxes().map(b => String(b.id));
  assert.equal(ids[0], '1');
  assert.ok(isUlid(ids[1]!), 'the legacy row was given its own identity on load');
  assert.notEqual(ids[1], '1');

  // Grab box "1" by its middle and move it 200px right; the other box must not follow.
  drag(f, [160, 160], [360, 160]);
  const after = f.boxes();
  assert.equal(Number(after[0]!.x), 300, 'the box under the pointer moved');
  assert.equal(Number(after[1]!.x), 600, 'the box that merely shares an INDEX did not');
  assert.equal(Number(after[1]!.y), 600);
  f.destroy();
});

test('the index fallback is dead, not merely unreachable', () => {
  // The same collision, but reached the ONE way normalisation cannot cover: a write that
  // bypasses the editor's commit path (a hook patch, another surface). The id-less row
  // must not answer to the key '1' just because it sits at index 1 - this is the
  // assertion that fails if `idOf`'s `String(i)` ever comes back for an id-bearing tool.
  const f = mount([box({ id: '1', x: 100, y: 100 })]);
  f.setBoxes([box({ id: '1', x: 100, y: 100 }), box({ x: 600, y: 600 })]);
  assert.equal(f.boxes()[1]!.id, undefined, 'the bypassing write really did land un-normalised');

  drag(f, [160, 160], [360, 160]);
  const after = f.boxes();
  assert.equal(Number(after[0]!.x), 300, 'the box under the pointer moved');
  assert.equal(Number(after[1]!.x), 600, 'the id-less row at index 1 did not answer to "1"');
  f.destroy();
});
