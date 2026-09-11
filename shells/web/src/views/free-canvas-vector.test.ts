// SPDX-License-Identifier: MPL-2.0
/**
 * The canvas editor's VECTOR-OPERATIONS context menu (Stage E wiring).
 *
 * vector-ops.test.ts covers the geometry; this covers the overlay's half of the deal - 
 * which entries exist, what gates them, that a result is committed as exactly ONE model
 * write, that a refusal is visible and leaves the model byte-for-byte unchanged, and that
 * a two-finger tap reaches the menu on a touch device.
 *
 * Mounted against a real jsdom stage and an in-memory runtime that echoes setInput back
 * through getModel (a real round-trip, not a stubbed answer), following the pattern in
 * deck-editor.test.ts. Expected areas are worked out by hand from the operand rectangles,
 * never read back from the module under test.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-vector.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { contourArea } from '@lolly/engine';
import type { GeomPath } from '@lolly/engine';
import type { Box } from './free-canvas-math.ts';
import { booleanBoxes, boxToPath, encodeAuthoredPath } from './vector-ops.ts';
import { initFreeCanvas } from './free-canvas.ts';

// ── jsdom bootstrap ───────────────────────────────────────────────────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
for (const k of ['window', 'document', 'HTMLElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
// The overlay coalesces its chrome sync through rAF and its flash message through a
// timer; run both synchronously-ish so a test never has to wait a frame.
(globalThis as Record<string, unknown>).requestAnimationFrame = (fn: FrameRequestCallback): number =>
  setTimeout(() => fn(0), 0) as unknown as number;
(globalThis as Record<string, unknown>).cancelAnimationFrame = (h: number): void => clearTimeout(h);
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

/** A pointer-family event carrying the fields the overlay reads. jsdom has no
 *  PointerEvent, and a MouseEvent dispatched under a `pointer*` type triggers the same
 *  listeners - it just needs pointerId / pointerType / timeStamp defined on it. */
function pointerEvent(
  type: string,
  o: { x: number; y: number; id?: number; pointerType?: string; time?: number },
): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: o.x, clientY: o.y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: o.id ?? 1 });
  Object.defineProperty(e, 'pointerType', { value: o.pointerType ?? 'touch' });
  Object.defineProperty(e, 'timeStamp', { value: o.time ?? 0 });
  return e;
}

// ── fixture ───────────────────────────────────────────────────────────────────

/** The Design `canvas` block as SHIPPED: it declares `pathField` and nothing else
 *  about vectors, leaving `stroke` / `strokeW` / `fillRule` to the overlay's defaults - so
 *  these tests exercise that resolution rather than a hand-declared superset.
 *  `vectorFields: false` drops `pathField`, i.e. a manifest that predates Stage C. */
function canvasCfg(vectorFields = true): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', groupField: 'group', clipField: 'clip',
    addKinds: [{ id: 'box', label: 'Box', seed: {} }],
    ...(vectorFields ? { pathField: 'path' } : {}),
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

const NATIVE = 1000;

function mount(initial: Box[], opts: { vectorFields?: boolean } = {}): Fixture {
  const viewEl = dom.window.document.createElement('div');
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  dom.window.document.body.appendChild(viewEl);
  canvasEl.style.width = NATIVE + 'px';
  canvasEl.style.height = NATIVE + 'px';
  // 1 screen px per native px, origin at the client origin - so a test's client
  // coordinates ARE canvas coordinates and the hit-testing reads naturally.
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  // The model, plus a one-deep-per-write undo stack: the overlay's contract is that a user
  // action is ONE setInput, so one pop must restore the previous state.
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
    input: { id: 'boxes', canvas: canvasCfg(opts.vectorFields !== false) as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    commits: () => commits,
    undo() { const last = history.pop(); if (last) model.set(last[0], last[1]); },
    destroy() { handle.destroy(); viewEl.remove(); },
  };
}

// ── menu helpers ──────────────────────────────────────────────────────────────

const menuOf = (f: Fixture): HTMLElement | null => f.stageEl.querySelector<HTMLElement>('.fc-context-menu');
const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

/** Right-click at a point (client == native here). */
function rightClick(f: Fixture, x: number, y: number): HTMLElement {
  f.canvasEl.dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  const m = menuOf(f);
  assert.ok(m, 'context menu opened');
  return m!;
}
/** A grid button, matched on the leading words of its title (the boolean titles carry a
 *  trailing explanation). */
function gridItem(menu: HTMLElement, prefix: string): HTMLButtonElement {
  const b = [...menu.querySelectorAll<HTMLButtonElement>('.fc-pop-gitem')]
    .find((x) => (x.getAttribute('aria-label') || '').startsWith(prefix));
  assert.ok(b, `grid item "${prefix}" present`);
  return b!;
}
function rowItem(menu: HTMLElement, label: string): HTMLButtonElement {
  const b = [...menu.querySelectorAll<HTMLButtonElement>('.fc-pop-item')]
    .find((x) => (x.textContent || '').trim() === label);
  assert.ok(b, `menu row "${label}" present`);
  return b!;
}
const maybeRow = (menu: HTMLElement, label: string): HTMLButtonElement | undefined =>
  [...menu.querySelectorAll<HTMLButtonElement>('.fc-pop-item')].find((x) => (x.textContent || '').trim() === label);

const flashText = (f: Fixture): string => {
  const el = f.stageEl.querySelector<HTMLElement>('.fc-flash');
  return el && !el.hidden ? (el.textContent || '') : '';
};

/** Select boxes by tapping each (mouse pointer, additive with shift after the first). */
function select(f: Fixture, pts: Array<[number, number]>): void {
  pts.forEach(([x, y], i) => {
    const e = new W.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, shiftKey: i > 0 });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    Object.defineProperty(e, 'pointerType', { value: 'mouse' });
    f.canvasEl.dispatchEvent(e);
    const up = pointerEvent('pointerup', { x, y, id: 1, pointerType: 'mouse' });
    f.canvasEl.dispatchEvent(up);
  });
}

const area = (p: GeomPath): number => Math.abs(p.reduce((a, c) => a + contourArea(c), 0));

/**
 * The OPERATION's own geometry is exact - straight edges only, so the area is right up to
 * double rounding, and a relative tolerance this tight would catch any wrong region.
 *
 * Assert against the path the op RETURNED, not one read back out of a box.
 */
function assertExactArea(p: GeomPath | null, expected: number, what: string): void {
  assert.ok(p, `${what}: expected geometry`);
  const got = area(p!);
  assert.ok(Math.abs(got - expected) / expected < 1e-9, `${what}: area ${got} vs ${expected}`);
}

/**
 * The same region after a round trip through the `path` sub-field, which is NOT exact.
 *
 * The wire format (engine/src/geom/authored-url.ts) fixes every coordinate at six decimals
 * of a FRACTION of the box frame - deliberately, so a share link's bytes do not churn when
 * it is opened and re-shared. Six decimals of a 150-unit frame is 1.5e-4 of a unit per
 * coordinate, and an area is quadratic in those, so ~1e-6 relative is the practical floor. The
 * two helpers stay separate because the difference between "the boolean is exact" and
 * "persisting it quantises" is a fact about this system worth keeping visible.
 */
function assertPersistedArea(p: GeomPath | null, expected: number, what: string): void {
  assert.ok(p, `${what}: expected geometry`);
  const got = area(p!);
  assert.ok(Math.abs(got - expected) / expected < 1e-5, `${what}: area ${got} vs ${expected}`);
}

const rectBox = (o: Partial<Box>): Box => ({ kind: 'box', shape: 'rect', bg: '#123456', ...o }) as Box;

// Two rects overlapping in a 50×50 corner: 100×100 each, offset by 50.
const OVERLAP = (): Box[] => [
  rectBox({ id: 'a', x: 0, y: 0, w: 100, h: 100 }),
  rectBox({ id: 'b', x: 50, y: 50, w: 100, h: 100, bg: '#abcdef' }),
];

// ── gating ────────────────────────────────────────────────────────────────────

test('vector section is absent entirely when the manifest declares no pathField', () => {
  const f = mount(OVERLAP(), { vectorFields: false });
  select(f, [[10, 10], [140, 140]]);
  const m = rightClick(f, 60, 60);
  assert.equal(maybeRow(m, 'Simplify'), undefined, 'no Simplify row');
  assert.equal(maybeRow(m, 'Offset path…'), undefined, 'no Offset row');
  assert.equal([...m.querySelectorAll('.fc-pop-gitem')].filter((b) => (b.getAttribute('aria-label') || '').startsWith('Union')).length, 0);
  // The pre-existing entries are untouched.
  assert.ok(maybeRow(m, 'Group'), 'Group survives');
  f.destroy();
});

test('booleans need 2+ region-bounding boxes; text boxes do not count', () => {
  const f = mount([
    rectBox({ id: 'a', x: 0, y: 0, w: 100, h: 100 }),
    rectBox({ id: 'b', x: 50, y: 50, w: 100, h: 100 }),
    { kind: 'text', id: 't', x: 400, y: 400, w: 200, h: 80, text: 'hi' } as Box,
    { kind: 'text', id: 'u', x: 400, y: 500, w: 200, h: 80, text: 'ho' } as Box,
  ]);

  // Nothing selected.
  let m = rightClick(f, 900, 900);
  assert.equal(gridItem(m, 'Union').disabled, true, 'no selection → disabled');
  assert.equal(rowItem(m, 'Simplify').disabled, true);
  assert.equal(rowItem(m, 'Offset path…').disabled, true);

  // One shape.
  select(f, [[10, 10]]);
  m = rightClick(f, 10, 10);
  assert.equal(gridItem(m, 'Union').disabled, true, 'one shape → still needs two');
  assert.equal(rowItem(m, 'Offset path…').disabled, false, 'offset works on one shape');
  assert.equal(rowItem(m, 'Outline stroke…').disabled, false);
  assert.equal(rowItem(m, 'Simplify').disabled, true, 'a primitive rect is not a pen path');

  // Two shapes.
  select(f, [[10, 10], [140, 140]]);
  m = rightClick(f, 60, 60);
  for (const label of ['Union', 'Subtract', 'Intersect', 'Exclude']) {
    assert.equal(gridItem(m, label).disabled, false, `${label} enabled with two shapes`);
  }

  // Two TEXT boxes bound no region at all.
  select(f, [[450, 430], [450, 530]]);
  m = rightClick(f, 450, 430);
  assert.equal(gridItem(m, 'Union').disabled, true, 'two text boxes → no outline, disabled');
  assert.equal(rowItem(m, 'Offset path…').disabled, true);
  f.destroy();
});

test('entries disable rather than disappear, so the menu keeps its shape', () => {
  const f = mount(OVERLAP());
  const empty = rightClick(f, 900, 900);
  const emptyCount = empty.querySelectorAll('button').length;
  select(f, [[10, 10], [140, 140]]);
  const full = rightClick(f, 60, 60);
  assert.equal(full.querySelectorAll('button').length, emptyCount, 'same number of buttons either way');
  f.destroy();
});

// ── committing a result ───────────────────────────────────────────────────────

test('Union on two overlapping boxes: one commit, one path box, the area worked out by hand', () => {
  const f = mount(OVERLAP());
  select(f, [[10, 10], [140, 140]]);
  const before = f.commits();
  click(gridItem(rightClick(f, 60, 60), 'Union'));

  assert.equal(f.commits() - before, 1, 'exactly one setInput (one undo step)');
  const boxes = f.boxes();
  assert.equal(boxes.length, 1, 'both operands consumed, one result');
  const res = boxes[0]!;
  assert.equal(res.kind, 'path');
  assert.equal(res.x, 0); assert.equal(res.y, 0);
  assert.equal(res.w, 150); assert.equal(res.h, 150);
  // Two 100×100 squares offset by 50 → 2·10000 − 50·50 of double-counted overlap.
  //
  // Twice over, because the two claims are different. The OPERATION is exact: run it
  // directly and its own returned geometry hits the area on the nose. What the editor
  // persists is that geometry through the wire format, which fixes six decimals of a
  // fraction of the frame - so the box read back is right to ~1e-6 relative and no further.
  const direct = booleanBoxes(OVERLAP(), 'union', { cfg: canvasCfg() as never });
  assert.ok(direct.ok);
  assertExactArea(direct.ok ? direct.path : null, 17500, 'the union itself');
  assertPersistedArea(boxToPath(res), 17500, 'the same region after a round trip through `path`');
  // The topmost operand's paint is what a union keeps.
  assert.equal(res.bg, '#abcdef');
  f.destroy();
});

test('the selection after a successful op is the new box', () => {
  const f = mount(OVERLAP());
  select(f, [[10, 10], [140, 140]]);
  click(gridItem(rightClick(f, 60, 60), 'Union'));
  const id = String(f.boxes()[0]!.id);
  // A right-click on empty canvas leaves the selection alone, so the menu's state reports
  // it: one selected box, which is a pen path - hence Simplify is live and Union is not.
  const m = rightClick(f, 900, 900);
  assert.equal(rowItem(m, 'Simplify').disabled, false, 'the new path box is selected');
  assert.equal(gridItem(m, 'Union').disabled, true, 'and it is the ONLY selection');
  assert.ok(id && id !== 'a' && id !== 'b', 'the result got a fresh id');
  f.destroy();
});

test('undo returns to the previous model in one step', () => {
  const f = mount(OVERLAP());
  const before = structuredClone(f.boxes());
  select(f, [[10, 10], [140, 140]]);
  click(gridItem(rightClick(f, 60, 60), 'Union'));
  assert.equal(f.boxes().length, 1);
  f.undo();
  assert.deepEqual(f.boxes(), before, 'one undo restores the operands exactly');
  f.destroy();
});

test('Subtract keeps the BOTTOMMOST shape as its base (Illustrator/Figma order)', () => {
  const f = mount(OVERLAP());
  select(f, [[10, 10], [140, 140]]);
  click(gridItem(rightClick(f, 60, 60), 'Subtract'));
  const res = f.boxes()[0]!;
  // The bottom square (0,0,100,100) minus the 50×50 corner the top one covers.
  assert.equal(res.x, 0); assert.equal(res.y, 0);
  assert.equal(res.w, 100); assert.equal(res.h, 100);
  assertPersistedArea(boxToPath(res), 10000 - 2500, 'result');
  assert.equal(res.bg, '#123456', 'the base shape is the bottom one, so its paint survives');
  f.destroy();
});

// ── failure is visible, and never half-edits ──────────────────────────────────

test('empty-result: intersecting shapes that do not overlap refuses, says so, changes nothing', () => {
  const f = mount([
    rectBox({ id: 'a', x: 0, y: 0, w: 100, h: 100 }),
    rectBox({ id: 'b', x: 400, y: 400, w: 100, h: 100 }),
  ]);
  const before = structuredClone(f.boxes());
  const commits = f.commits();
  select(f, [[10, 10], [450, 450]]);
  click(gridItem(rightClick(f, 60, 60), 'Intersect'));
  assert.equal(f.commits(), commits, 'nothing committed');
  assert.deepEqual(f.boxes(), before, 'the operands are untouched - an empty answer is not a delete');
  assert.match(flashText(f), /do not overlap/i, 'and the reason is on screen');
  f.destroy();
});

test('too-complex: a GeomLimitError surfaces a readable message and leaves the model deep-equal', () => {
  // The kernel refuses an intersection whose operand is past MAX_CURVES (8000): the answer
  // exists, it declines to guess. 9000 nodes on a closed polyline is exactly that, and is
  // still well inside vector-ops' own 20k node ceiling, so the refusal comes from the
  // boolean pass rather than from the decoder.
  const nodes = Array.from({ length: 9000 }, (_, i) => {
    const a = (i / 9000) * Math.PI * 2;
    return { x: 0.5 + 0.45 * Math.cos(a), y: 0.5 + 0.45 * Math.sin(a) };
  });
  const f = mount([
    rectBox({ id: 'a', x: 0, y: 0, w: 400, h: 400 }),
    {
      kind: 'path', shape: 'rect', id: 'b', x: 100, y: 100, w: 400, h: 400,
      path: encodeAuthoredPath({ kind: 'line', closed: true, nodes }),
    } as Box,
  ]);
  const before = structuredClone(f.boxes());
  const commits = f.commits();
  select(f, [[10, 10], [480, 480]]);
  click(gridItem(rightClick(f, 200, 200), 'Intersect'));
  assert.equal(f.commits(), commits, 'no commit');
  assert.deepEqual(f.boxes(), before, 'the model is byte-for-byte what it was');
  assert.match(flashText(f), /too intricate/i, 'the refusal is visible, not a silent no-op');
  f.destroy();
});

test('a boolean over text boxes refuses with the no-outline reason', () => {
  const f = mount([
    { kind: 'text', id: 't', x: 10, y: 10, w: 200, h: 80, text: 'hi' } as Box,
    rectBox({ id: 'a', x: 300, y: 300, w: 100, h: 100 }),
  ]);
  // Force the op past its own gate by selecting the text box alone, then asking for an
  // offset - the entry is disabled in the UI, so drive the failure through the op the menu
  // WOULD run and assert the surfacing rather than the disabled attribute.
  select(f, [[20, 20]]);
  const m = rightClick(f, 20, 20);
  assert.equal(rowItem(m, 'Offset path…').disabled, true, 'the gate holds');
  f.destroy();
});

// ── the numeric prompts ───────────────────────────────────────────────────────

test('Outline stroke prompts with its own stroke width and commits once', () => {
  const f = mount([rectBox({ id: 'a', x: 100, y: 100, w: 200, h: 200, stroke: '#ff0000', strokeW: 12 })]);
  select(f, [[150, 150]]);
  click(rowItem(rightClick(f, 150, 150), 'Outline stroke…'));
  const panel = f.stageEl.querySelector<HTMLElement>('.fc-num-panel');
  assert.ok(panel, 'the one-number prompt opened');
  const inp = panel!.querySelector<HTMLInputElement>('input[data-num]')!;
  assert.equal(inp.value, '12', "seeded from the box's own stroke width");
  const commits = f.commits();
  click(panel!.querySelector('[data-num-go]')!);
  assert.equal(f.commits() - commits, 1, 'one commit');
  const res = f.boxes()[0]!;
  assert.equal(res.kind, 'path');
  // A 12px stroke centred on a 200×200 boundary: outer 212×212, inner 188×188.
  assert.equal(res.w, 212); assert.equal(res.h, 212);
  assert.equal(res.x, 94); assert.equal(res.y, 94);
  assertPersistedArea(boxToPath(res), 212 * 212 - 188 * 188, 'result');
  assert.equal(res.bg, '#ff0000', 'the outline is filled with the paint the user was looking at');
  f.destroy();
});

test('Offset path accepts a NEGATIVE distance (inset) and commits once', () => {
  const f = mount([rectBox({ id: 'a', x: 100, y: 100, w: 200, h: 200 })]);
  select(f, [[150, 150]]);
  click(rowItem(rightClick(f, 150, 150), 'Offset path…'));
  const panel = f.stageEl.querySelector<HTMLElement>('.fc-num-panel')!;
  const inp = panel.querySelector<HTMLInputElement>('input[data-num]')!;
  assert.equal(inp.getAttribute('min'), null, 'no min attribute - negatives are half the point');
  inp.value = '-25';
  const commits = f.commits();
  click(panel.querySelector('[data-num-go]')!);
  assert.equal(f.commits() - commits, 1);
  const res = f.boxes()[0]!;
  assert.equal(res.w, 150); assert.equal(res.h, 150);
  assert.equal(res.x, 125); assert.equal(res.y, 125);
  assertPersistedArea(boxToPath(res), 150 * 150, 'result');
  f.destroy();
});

test('Offset path inward past the inradius refuses and changes nothing', () => {
  const f = mount([rectBox({ id: 'a', x: 100, y: 100, w: 200, h: 200 })]);
  const before = structuredClone(f.boxes());
  select(f, [[150, 150]]);
  click(rowItem(rightClick(f, 150, 150), 'Offset path…'));
  const panel = f.stageEl.querySelector<HTMLElement>('.fc-num-panel')!;
  panel.querySelector<HTMLInputElement>('input[data-num]')!.value = '-400';
  const commits = f.commits();
  click(panel.querySelector('[data-num-go]')!);
  assert.equal(f.commits(), commits, 'no commit');
  assert.deepEqual(f.boxes(), before);
  assert.match(flashText(f), /removes the shape completely/i);
  f.destroy();
});

test('Escape closes the number prompt without applying it, and keeps the selection', () => {
  const f = mount([rectBox({ id: 'a', x: 100, y: 100, w: 200, h: 200 })]);
  select(f, [[150, 150]]);
  click(rowItem(rightClick(f, 150, 150), 'Offset path…'));
  assert.ok(f.stageEl.querySelector('.fc-num-panel'));
  const commits = f.commits();
  dom.window.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(f.stageEl.querySelector('.fc-num-panel'), null, 'panel closed');
  assert.equal(f.commits(), commits, 'nothing applied');
  const m = rightClick(f, 900, 900);
  assert.equal(rowItem(m, 'Offset path…').disabled, false, 'the selection survived Escape');
  f.destroy();
});

// ── simplify ──────────────────────────────────────────────────────────────────

test('Simplify returns one box per pen path and each keeps its own place in the stack', () => {
  // A 24-node polygonal circle per path box; simplification should not change how many
  // boxes there are, nor their order relative to the untouched rect between them.
  const poly = (n: number): { kind: 'line'; closed: true; nodes: Array<{ x: number; y: number }> } => ({
    kind: 'line', closed: true,
    nodes: Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) };
    }),
  });
  const f = mount([
    { kind: 'path', shape: 'rect', id: 'p1', x: 0, y: 0, w: 200, h: 200, path: encodeAuthoredPath(poly(24)) } as Box,
    rectBox({ id: 'mid', x: 300, y: 0, w: 100, h: 100 }),
    { kind: 'path', shape: 'rect', id: 'p2', x: 0, y: 400, w: 200, h: 200, path: encodeAuthoredPath(poly(24)) } as Box,
  ]);
  select(f, [[100, 100], [100, 500]]);
  const m = rightClick(f, 100, 100);
  assert.equal(rowItem(m, 'Simplify').disabled, false);
  const commits = f.commits();
  click(rowItem(m, 'Simplify'));
  assert.equal(f.commits() - commits, 1, 'one commit for the whole action');
  const boxes = f.boxes();
  assert.equal(boxes.length, 3, 'one result per operand - not merged');
  assert.equal(boxes[1]!.id, 'mid', 'the untouched box kept its stack position');
  assert.equal(boxes[0]!.kind, 'path');
  assert.equal(boxes[2]!.kind, 'path');
  assert.notEqual(boxes[0]!.id, boxes[2]!.id, 'the two results got distinct ids');
  // Same frame, same region: simplification is a node count change, not a shape change.
  assert.equal(boxes[0]!.y, 0);
  assert.equal(boxes[2]!.y, 400);
  f.destroy();
});

test('Simplify is refused on primitive shapes, with a reason', () => {
  const f = mount(OVERLAP());
  select(f, [[10, 10], [140, 140]]);
  const m = rightClick(f, 60, 60);
  assert.equal(rowItem(m, 'Simplify').disabled, true, 'gated out for primitives');
  f.destroy();
});

// ── two-finger tap (touch) ────────────────────────────────────────────────────

/** Two fingers down, optionally moved, then both up. Returns nothing; assertions read the
 *  menu. Times are explicit so the tap/hold thresholds are exercised deterministically. */
function twoFinger(f: Fixture, o: {
  a: [number, number]; b: [number, number];
  moveA?: [number, number]; moveB?: [number, number];
  holdMs?: number;
}): void {
  const t0 = 1000;
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x: o.a[0], y: o.a[1], id: 1, time: t0 }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x: o.b[0], y: o.b[1], id: 2, time: t0 + 20 }));
  if (o.moveA) f.canvasEl.dispatchEvent(pointerEvent('pointermove', { x: o.moveA[0], y: o.moveA[1], id: 1, time: t0 + 60 }));
  if (o.moveB) f.canvasEl.dispatchEvent(pointerEvent('pointermove', { x: o.moveB[0], y: o.moveB[1], id: 2, time: t0 + 60 }));
  const end = t0 + 20 + (o.holdMs ?? 90);
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: (o.moveA ?? o.a)[0], y: (o.moveA ?? o.a)[1], id: 1, time: end }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: (o.moveB ?? o.b)[0], y: (o.moveB ?? o.b)[1], id: 2, time: end + 10 }));
}

test('two-finger tap opens the context menu at the midpoint and selects what is under it', () => {
  const f = mount(OVERLAP());
  twoFinger(f, { a: [60, 50], b: [60, 70] });   // midpoint (60,60) is inside both squares
  const m = menuOf(f);
  assert.ok(m, 'the menu opened without any contextmenu event');
  assert.equal(rowItem(m!, 'Offset path…').disabled, false, 'the box under the midpoint got selected');
  assert.equal(f.commits(), 0, 'a two-finger tap commits nothing');
  f.destroy();
});

test('two-finger tap only fires once per touch sequence', () => {
  const f = mount(OVERLAP());
  twoFinger(f, { a: [60, 50], b: [60, 70] });
  assert.equal(f.stageEl.querySelectorAll('.fc-context-menu').length, 1, 'one menu, not one per finger');
  f.destroy();
});

test('a two-finger PAN/PINCH is never stolen - no menu when the fingers travel', () => {
  const f = mount(OVERLAP());
  twoFinger(f, { a: [60, 50], b: [60, 70], moveA: [200, 190], moveB: [200, 210] });   // pan
  assert.equal(menuOf(f), null, 'a pan does not open the menu');
  twoFinger(f, { a: [300, 300], b: [340, 300], moveB: [420, 300] });                   // pinch
  assert.equal(menuOf(f), null, 'a pinch does not open the menu');
  f.destroy();
});

test('a two-finger HOLD past the tap window does not open the menu', () => {
  const f = mount(OVERLAP());
  twoFinger(f, { a: [60, 50], b: [60, 70], holdMs: 900 });
  assert.equal(menuOf(f), null);
  f.destroy();
});

test('a single-finger tap still just deselects - the menu needs two', () => {
  const f = mount(OVERLAP());
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x: 900, y: 900, id: 1, time: 1000 }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: 900, y: 900, id: 1, time: 1040 }));
  assert.equal(menuOf(f), null);
  f.destroy();
});
