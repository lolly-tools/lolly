// SPDX-License-Identifier: MPL-2.0
/**
 * The canvas editor's PAINT controls for a vector path box - stroke colour, stroke width,
 * stroke style, line ends, corners, fill rule.
 *
 * This exists because of one bug report: "there is also no way to change stroke width type
 * or color". A pen shape carried `stroke` / `strokeW` / `fillRule` in the model with no
 * control anywhere on the canvas - and in `render.layout: "editor"` there is NO SIDEBAR, so
 * a field with no canvas control is a field the user cannot reach at all. The second half of
 * the same report is the regression: the pen's node-editing bar REPLACED `ctxbar.innerHTML`
 * with its kind switcher, so the one paint control that did exist (Fill) vanished at exactly
 * the moment the user was shaping the thing they wanted to paint.
 *
 * So the claims here are about REACHABILITY and about the write, not about pixels:
 *
 * 1. every control is present for a path selection, absent where it means nothing (a mixed
 *    or non-path selection), and writes the field it names;
 * 2. one user action is one `setInput` - with two path boxes selected as well, because a
 *    per-box commit would be two undo steps for one click;
 * 3. the pen bar carries the kind switcher AND the paint controls at the same time;
 * 4. a token-linked colour ({ ref, value }) writes the plain colour into the model - the
 *    known repo gotcha `unwrapColor` exists for, where the wrapper object reaches the box
 *    and every renderer downstream reads `[object Object]` as a colour;
 * 5. the bar still rebuilds only when the SELECTION changes, so adding controls to it did
 *    not turn it into per-frame innerHTML churn.
 *
 * The canvas config is the SHIPPED `community/design/tool.json` block,
 * so "the control appears" is a claim about the real tool. The jsdom bootstrap is the same
 * shape as free-canvas-pen.test.ts / free-canvas-vector.test.ts.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-paint.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { encodeAuthoredPath } from '@lolly/engine';
import type { Box } from './free-canvas-math.ts';
import { initFreeCanvas } from './free-canvas.ts';
import { setSwatches } from '../components/color-field.ts';

// ── jsdom bootstrap ───────────────────────────────────────────────────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & {
  MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent; Event: typeof Event;
};
for (const k of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'KeyboardEvent', 'Event', 'MouseEvent',
  'Node', 'getComputedStyle', 'MutationObserver',
]) {
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
// jsdom ships no `CSS` object, and the shared colour field uses CSS.escape to build the
// selector for a field's hidden value input. Environment gap, not product behaviour - so it
// is filled with the spec's own rule (escape anything outside [A-Za-z0-9_-]) rather than
// worked around in the module under test.
(globalThis as Record<string, unknown>).CSS = {
  escape: (s: string) => String(s).replace(/([^\w-])/g, '\\$1'),
};

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

function pointerEvent(type: string, o: { x: number; y: number; shift?: boolean }): MouseEvent {
  const e = new W.MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: o.x, clientY: o.y, button: 0, shiftKey: !!o.shift,
  });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

// ── the SHIPPED canvas config ─────────────────────────────────────────────────
const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, '..', '..', '..', '..', 'community', 'design', 'tool.json');

/** Design's real `canvas` block. Note it declares `pathField` and NOT the stroke
 *  sub-fields: those come from the overlay's own defaults, which is precisely why a test
 *  that hand-wrote the config could pass while the shipped tool showed no controls. */
function canvasCfg(): Record<string, unknown> {
  const manifest = JSON.parse(readFileSync(TOOL, 'utf8')) as {
    inputs: Array<{ id: string; canvas?: Record<string, unknown> }>;
  };
  const boxes = manifest.inputs.find((i) => i.id === 'boxes');
  assert.ok(boxes?.canvas, 'the shipped boxes input has a canvas block');
  assert.equal(boxes!.canvas!.pathField, 'path', 'and it declares pathField');
  for (const k of ['strokeField', 'strokeWField', 'fillRuleField', 'strokeDashField', 'strokeCapField', 'strokeJoinField']) {
    assert.equal(boxes!.canvas![k], undefined, `${k} is the overlay's default, not a manifest key`);
  }
  return boxes!.canvas!;
}
const CFG = canvasCfg();

const NATIVE = 1000;

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  commits(): number;
  destroy(): void;
}

function mount(initial: Box[]): Fixture {
  const viewEl = dom.window.document.createElement('div');
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  dom.window.document.body.appendChild(viewEl);
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  const model = new Map<string, unknown>([['boxes', initial]]);
  let commits = 0;
  const subs: Array<() => void> = [];
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) {
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
    input: { id: 'boxes', canvas: CFG as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  frames();
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    commits: () => commits,
    destroy() { handle.destroy(); viewEl.remove(); },
  };
}

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

/** Click a box to select it (a press with no travel). */
function selectAt(f: Fixture, x: number, y: number, o: { shift?: boolean } = {}): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x, y, shift: o.shift }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x, y, shift: o.shift }));
  frames();
}
function dblClickAt(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(new W.MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  frames();
}

// ── fixtures ──────────────────────────────────────────────────────────────────

/** A path box: a 3-node open cubic, filling its own frame. */
function pathBox(o: { id?: string; x?: number; y?: number; s?: number } = {}): Box {
  const s = o.s ?? 200;
  return {
    kind: 'path', shape: 'rect', id: o.id ?? 'p1', bg: '', stroke: '#0e1217', strokeW: 4, fillRule: 'nonzero',
    x: o.x ?? 300, y: o.y ?? 300, w: s, h: s, rot: 0,
    path: encodeAuthoredPath({
      kind: 'cubic', closed: false,
      nodes: [
        { x: 0, y: 1, hOutX: 0.2, hOutY: -0.4, continuity: 'corner' },
        { x: 0.5, y: 0, hInX: -0.2, hInY: 0, hOutX: 0.2, hOutY: 0, continuity: 'smooth' },
        { x: 1, y: 1, hInX: -0.2, hInY: -0.4, continuity: 'corner' },
      ],
    }),
  } as Box;
}
/** An ordinary box, for the "does not apply" half of every presence claim. */
const plainBox = (o: { id?: string; x?: number; y?: number } = {}): Box => ({
  kind: 'box', shape: 'rect', id: o.id ?? 'b1', bg: '#30ba78',
  x: o.x ?? 300, y: o.y ?? 300, w: 200, h: 200, rot: 0,
} as Box);

/** The centre of a box, in canvas coordinates (= client coordinates in this fixture). */
const centre = (b: Box): [number, number] => [Number(b.x) + Number(b.w) / 2, Number(b.y) + Number(b.h) / 2];

const ctxbar = (f: Fixture): HTMLElement => {
  const el = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar');
  assert.ok(el, 'the contextual bar exists');
  return el!;
};
const colourField = (scope: HTMLElement, id: string): HTMLElement | null =>
  scope.querySelector<HTMLElement>(`[data-color-field="${id}"]`);

/** Open the stroke panel from the bar's stroke button. */
function openStrokePanel(f: Fixture): HTMLElement {
  const btn = ctxbar(f).querySelector<HTMLElement>('[data-cx="stroke"]');
  assert.ok(btn, 'the bar offers a stroke button for a path selection');
  click(btn!);
  frames();
  const p = f.stageEl.querySelector<HTMLElement>('.fc-stroke-panel');
  assert.ok(p, 'the stroke panel opened');
  return p!;
}
/** Click one option of a segmented control by its value. */
function chooseSeg(panel: HTMLElement, field: string, value: string): void {
  const seg = panel.querySelector<HTMLElement>(`.fc-seg[data-seg="${field}"]`);
  assert.ok(seg, `the panel carries a segmented control for ${field}`);
  const btn = [...seg!.querySelectorAll<HTMLButtonElement>('.fc-seg-btn')].find((b) => b.dataset.v === value);
  assert.ok(btn, `${field} offers ${value || '(empty)'}`);
  click(btn!);
  frames();
}
const byId = (f: Fixture, id: string): Box => {
  const b = f.boxes().find((x) => x.id === id);
  assert.ok(b, `box ${id} still exists`);
  return b!;
};

// ══ presence: every control is reachable, and only where it applies ════════════

test('stroke colour and the stroke panel reach a path AND a plain box', () => {
  // This test used to assert that a box offered NEITHER. That gating was wrong (plan 179
  // A5): the manifest declares `stroke`/`strokeW`/`strokeDash` with
  // `showFor: ["path","box","image","frame"]` and hooks.js renders them on a non-path box
  // as a real CSS border - so every artboard drawn by the Artboard tool carried a baked
  // 2px edge that nothing on the canvas could remove. What differs between the two kinds
  // is the MECHANISM, and the stroke panel is where that shows (see below).
  const f = mount([plainBox({ id: 'b1', x: 100, y: 100 }), pathBox({ id: 'p1', x: 500, y: 500 })]);

  selectAt(f, ...centre(byId(f, 'p1')));
  const onPath = ctxbar(f);
  assert.ok(colourField(onPath, 'fc-stroke'), 'stroke colour is on the bar for a path box');
  assert.ok(colourField(onPath, 'fc-fill'), 'and so is fill');
  assert.ok(onPath.querySelector('[data-cx="stroke"]'), 'and the button onto width/style/ends/corners/rule');
  // Text colour is meaningless on a shape whose paint IS its fill and stroke, and the bar
  // is narrow: it is dropped rather than shown writing a field nothing reads.
  assert.equal(colourField(onPath, 'fc-fg'), null, 'text colour is not offered for a path');

  selectAt(f, ...centre(byId(f, 'b1')));
  const onBox = ctxbar(f);
  assert.ok(colourField(onBox, 'fc-stroke'), 'a box paints its stroke as a border - it is still a stroke');
  assert.ok(onBox.querySelector('[data-cx="stroke"]'), 'and the panel onto its width and style');
  assert.ok(colourField(onBox, 'fc-fill'), 'fill is still there');
  assert.ok(colourField(onBox, 'fc-fg'), 'and text colour is back');
  f.destroy();
});

test('the stroke panel hides the path-only options for a kind whose stroke is a border', () => {
  const f = mount([plainBox({ id: 'b1', x: 100, y: 100 })]);
  selectAt(f, ...centre(byId(f, 'b1')));
  const p = openStrokePanel(f);
  assert.ok(p.querySelector('input[data-sp="width"]'), 'a border has a width');
  assert.ok(p.querySelector('.fc-seg[data-seg="strokeDash"]'), 'and solid / dashed / dotted');
  for (const field of ['strokeCap', 'strokeJoin', 'fillRule']) {
    assert.equal(p.querySelector(`.fc-seg[data-seg="${field}"]`), null,
      `${field} is an SVG path's, not a border's - the manifest declares it showFor:["path"]`);
  }
  f.destroy();
});

test('a selection containing a kind with NO border offers no stroke controls', () => {
  // The "all of it, or none of it" rule stands - it is only the SET of kinds that widened.
  // A text box paints no border, so a path + text selection gets no stroke pair rather
  // than one that half the selection would ignore.
  const textish = { ...plainBox({ id: 'b1', x: 100, y: 100 }), kind: 'text' } as Box;
  const f = mount([textish, pathBox({ id: 'p1', x: 500, y: 500 })]);
  selectAt(f, ...centre(byId(f, 'p1')));
  selectAt(f, ...centre(byId(f, 'b1')), { shift: true });
  const bar = ctxbar(f);
  assert.equal(colourField(bar, 'fc-stroke'), null);
  assert.equal(bar.querySelector('[data-cx="stroke"]'), null);
  f.destroy();
});

test('the stroke panel carries width, style, ends, corners and fill rule - and no alignment', () => {
  const f = mount([pathBox()]);
  selectAt(f, ...centre(byId(f, 'p1')));
  const p = openStrokePanel(f);
  assert.ok(p.querySelector('input[data-sp="width"]'), 'stroke width');
  for (const field of ['strokeDash', 'strokeCap', 'strokeJoin', 'fillRule']) {
    assert.ok(p.querySelector(`.fc-seg[data-seg="${field}"]`), `${field} control`);
  }
  // SVG strokes on the centreline only: inside/outside is an outline CONVERSION, offered
  // by the context menu as "Outline stroke", not a paint setting. A control here would be
  // a promise the renderer cannot keep.
  assert.doesNotMatch(p.textContent || '', /inside|outside|align/i, 'no stroke-alignment control');
  // The panel shows the box's CURRENT width, not a fixed default.
  assert.equal(p.querySelector<HTMLInputElement>('input[data-sp="width"]')!.value, '4');
  f.destroy();
});

// ══ the write: one action, one commit, the right field ════════════════════════

test('each control writes the field it names, in exactly one commit', () => {
  const f = mount([pathBox()]);
  selectAt(f, ...centre(byId(f, 'p1')));
  const cases: Array<[string, string]> = [
    ['strokeDash', 'dashed'], ['strokeDash', 'dotted'], ['strokeDash', ''],
    ['strokeCap', 'butt'], ['strokeCap', 'square'], ['strokeCap', 'round'],
    ['strokeJoin', 'miter'], ['strokeJoin', 'bevel'], ['strokeJoin', 'round'],
    ['fillRule', 'evenodd'], ['fillRule', 'nonzero'],
  ];
  for (const [field, value] of cases) {
    const p = f.stageEl.querySelector<HTMLElement>('.fc-stroke-panel') ?? openStrokePanel(f);
    const before = f.commits();
    chooseSeg(p, field, value);
    assert.equal(f.commits() - before, 1, `${field}=${value}: one commit`);
    assert.equal(byId(f, 'p1')[field], value, `${field}=${value}: written`);
  }
  f.destroy();
});

test('the width slider writes strokeW as a NUMBER, and only touches strokeW', () => {
  const f = mount([pathBox()]);
  selectAt(f, ...centre(byId(f, 'p1')));
  const p = openStrokePanel(f);
  const rng = p.querySelector<HTMLInputElement>('input[data-sp="width"]')!;
  const before = { ...byId(f, 'p1') };
  const commits = f.commits();
  rng.value = '18';
  rng.dispatchEvent(new W.Event('input', { bubbles: true }));
  frames();
  assert.equal(f.commits() - commits, 1, 'one commit per slider event');
  const after = byId(f, 'p1');
  assert.equal(after.strokeW, 18);
  assert.equal(typeof after.strokeW, 'number', 'a string would reach the hook and be reparsed');
  // The readout next to the slider is the control of record's own echo.
  assert.equal(p.querySelector('[data-sp-val="width"]')!.textContent, '18');
  for (const k of Object.keys(before)) {
    if (k !== 'strokeW') assert.deepEqual(after[k], before[k], `${k} changed`);
  }
  f.destroy();
});

test('with TWO path boxes selected, one click writes both in ONE commit', () => {
  const f = mount([pathBox({ id: 'p1', x: 100, y: 100 }), pathBox({ id: 'p2', x: 600, y: 600 })]);
  selectAt(f, ...centre(byId(f, 'p1')));
  selectAt(f, ...centre(byId(f, 'p2')), { shift: true });
  const bar = ctxbar(f);
  assert.ok(colourField(bar, 'fc-stroke'), 'an all-path selection keeps the stroke controls');

  const p = openStrokePanel(f);
  let commits = f.commits();
  chooseSeg(p, 'strokeDash', 'dashed');
  assert.equal(f.commits() - commits, 1, 'two boxes, still ONE undo step');
  assert.equal(byId(f, 'p1').strokeDash, 'dashed');
  assert.equal(byId(f, 'p2').strokeDash, 'dashed');

  commits = f.commits();
  chooseSeg(p, 'fillRule', 'evenodd');
  assert.equal(f.commits() - commits, 1);
  assert.equal(byId(f, 'p1').fillRule, 'evenodd');
  assert.equal(byId(f, 'p2').fillRule, 'evenodd');

  const rng = p.querySelector<HTMLInputElement>('input[data-sp="width"]')!;
  commits = f.commits();
  rng.value = '9';
  rng.dispatchEvent(new W.Event('input', { bubbles: true }));
  frames();
  assert.equal(f.commits() - commits, 1);
  assert.equal(byId(f, 'p1').strokeW, 9);
  assert.equal(byId(f, 'p2').strokeW, 9);
  f.destroy();
});

// ══ the colour gotcha: a token value must not reach the model ══════════════════

test('a token swatch writes the plain colour, never the { ref, value } wrapper', () => {
  // The known repo gotcha (see the brand-editor colour-tab notes): the shared colour field
  // emits `{ ref, value }` for a swatch linked to a design token, and a caller that stores
  // it unchanged puts an OBJECT in the box - which every renderer downstream stringifies to
  // '[object Object]' and paints as nothing. `unwrapColor` is why this passes.
  setSwatches([
    { value: '#30ba78', label: 'Jungle', group: 'Brand', ref: '{color.brand.jungle}' },
    { value: '#0c322c', label: 'Pine', group: 'Brand', ref: null },
  ]);
  const f = mount([pathBox()]);
  selectAt(f, ...centre(byId(f, 'p1')));
  const field = colourField(ctxbar(f), 'fc-stroke')!;
  // Open the popover, which is what builds the (lazy) swatch grid.
  click(field.querySelector('.color-trigger')!);
  frames();
  const swatch = field.querySelector<HTMLElement>('[data-swatch-value="#30ba78"][data-swatch-ref]');
  assert.ok(swatch, 'the token swatch rendered with its ref');
  const commits = f.commits();
  click(swatch!);
  frames();
  assert.equal(f.commits() - commits, 1);
  const v = byId(f, 'p1').stroke;
  assert.equal(typeof v, 'string', `stroke must be a string, got ${JSON.stringify(v)}`);
  assert.equal(v, '#30ba78');
  f.destroy();
  setSwatches([{ value: '#30ba78', label: 'Jungle', group: 'Brand', ref: null }]);
});

// ══ the regression the report was really about ═════════════════════════════════

test('the pen node-editing bar shows the kind switcher AND the paint controls at once', () => {
  const f = mount([pathBox()]);
  const at = centre(byId(f, 'p1'));
  selectAt(f, ...at);
  dblClickAt(f, ...at);
  assert.ok(f.stageEl.classList.contains('fc-node-editing'), 'node editing is on');
  const bar = ctxbar(f);
  // Both, simultaneously - this is the whole bug: the pen bar replaces innerHTML, so
  // before it shared `paintCtxHtml` the fill and stroke fields disappeared here.
  assert.ok(bar.querySelector('[data-pen="kind"]'), 'the spline-kind switcher');
  assert.ok(bar.querySelector('.fc-seg[data-seg="pen-cont"]'), 'and the continuity control');
  assert.ok(colourField(bar, 'fc-fill'), 'and fill');
  assert.ok(colourField(bar, 'fc-stroke'), 'and stroke colour');
  assert.ok(bar.querySelector('[data-cx="stroke"]'), 'and the stroke panel button');

  // And they WORK from here, on the box being node-edited.
  const p = openStrokePanel(f);
  const commits = f.commits();
  chooseSeg(p, 'strokeCap', 'butt');
  assert.equal(f.commits() - commits, 1);
  assert.equal(byId(f, 'p1').strokeCap, 'butt');
  assert.ok(f.stageEl.classList.contains('fc-node-editing'), 'and painting did not drop out of node editing');
  f.destroy();
});

test('the paint controls are on the pen bar for an EDIT, not for a fresh draw', () => {
  // A draft lives in JS state until it commits, so there is no box to paint yet and its
  // paint comes from the add-kind seed. Showing dead colour fields mid-draw would be worse
  // than not showing them.
  const f = mount([pathBox()]);
  const pen = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-pen');
  assert.ok(pen, 'the pen rail button exists');
  click(pen!);
  frames();
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x: 100, y: 100 }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: 100, y: 100 }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x: 200, y: 160 }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x: 200, y: 160 }));
  frames();
  const bar = ctxbar(f);
  assert.ok(bar.querySelector('[data-pen="kind"]'), 'the kind switcher is there while drawing');
  assert.equal(colourField(bar, 'fc-stroke'), null, 'but there is no box to paint yet');
  f.destroy();
});

// ══ the bar is still rebuilt only on a selection change ════════════════════════

test('adding paint controls did not make the bar rebuild every sync', () => {
  const f = mount([pathBox({ id: 'p1', x: 100, y: 100 }), pathBox({ id: 'p2', x: 600, y: 600 })]);
  selectAt(f, ...centre(byId(f, 'p1')));
  const stroke = colourField(ctxbar(f), 'fc-stroke');
  assert.ok(stroke, 'premise: the field is there');
  // Many syncs, same selection: the SAME element must still be in the DOM. A rebuilt bar
  // replaces innerHTML, which would also blow away an open colour popover mid-interaction.
  for (let i = 0; i < 8; i++) frames();
  assert.equal(colourField(ctxbar(f), 'fc-stroke'), stroke, 'the bar was rebuilt with the selection unchanged');

  // A selection change DOES rebuild it, so the fields show the newly selected box.
  selectAt(f, ...centre(byId(f, 'p2')));
  assert.notEqual(colourField(ctxbar(f), 'fc-stroke'), stroke, 'a new selection rebuilds the bar');
  f.destroy();
});
