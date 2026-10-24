// SPDX-License-Identifier: MPL-2.0
/**
 * A drag on the canvas editor's continuous controls is ONE commit, made on release.
 *
 * The Text panel's line height, letter spacing and padding sliders, and the colour fields
 * on the contextual bar, used to commit on every tick. Each commit runs the whole edit
 * pipeline (two template hydrations, the Design hook, undo, the address bar, the side
 * panels), which on a large document is a quarter of a second per tick. So the claims:
 *
 * 1. a two-second slider drag (120 `input` ticks) writes the model once, on `change`, and
 *    the selected box shows the value meanwhile;
 * 2. a colour drag on a plain box writes once, when the pointer comes up, and shows the
 *    colour on the box meanwhile;
 * 3. the preview comes off byte for byte before the commit, so the paint that follows
 *    compares the canvas with the template it came from;
 * 4. where an element cannot show the colour on its own (a vector path), the drag writes
 *    live, but never more than once a frame;
 * 5. a click (a swatch, a typed value) still writes at once.
 *
 * The canvas config is the SHIPPED `community/design/tool.json` block. The jsdom
 * bootstrap is the same shape as free-canvas-paint.test.ts.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-drag-commit.test.ts
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
import { createStylePreview } from './free-canvas-style-preview.ts';

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
(globalThis as Record<string, unknown>).CSS = {
  escape: (s: string) => String(s).replace(/([^\w-])/g, '\\$1'),
};

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

function pointerEvent(type: string, o: { x?: number; y?: number } = {}): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: o.x ?? 0, clientY: o.y ?? 0, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}
const fire = (el: EventTarget, type: string): void => { el.dispatchEvent(new W.Event(type, { bubbles: true })); };
const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

// ── the SHIPPED canvas config ─────────────────────────────────────────────────
const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = join(HERE, '..', '..', '..', '..', 'community', 'design', 'tool.json');
function canvasCfg(): Record<string, unknown> {
  const manifest = JSON.parse(readFileSync(TOOL, 'utf8')) as { inputs: Array<{ id: string; canvas?: Record<string, unknown> }> };
  const boxes = manifest.inputs.find((i) => i.id === 'boxes');
  assert.ok(boxes?.canvas, 'the shipped boxes input has a canvas block');
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

/** The painted element for one box, as the Design template draws it: the shell paints the
 *  canvas, and this harness has no paint, so the test supplies the live node itself. */
function livePaint(f: Fixture, id: string, boxStyle: string, textStyle: string): { box: HTMLElement; text: HTMLElement } {
  const box = dom.window.document.createElement('div');
  box.className = 'lolly-box';
  box.dataset.boxId = id;
  box.setAttribute('style', boxStyle);
  const text = dom.window.document.createElement('div');
  text.className = 'lolly-box-text';
  text.setAttribute('style', textStyle);
  box.appendChild(text);
  f.canvasEl.appendChild(box);
  return { box, text };
}

function selectAt(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x, y }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x, y }));
  frames();
}
const byId = (f: Fixture, id: string): Box => f.boxes().find((x) => x.id === id)!;

const textBox: Box = {
  kind: 'text', id: 't1', text: 'Hello', x: 300, y: 300, w: 300, h: 120, rot: 0, fontSize: 48, lineHeight: 1.12, pad: 8,
} as Box;
const plainBox: Box = { kind: 'box', shape: 'rect', id: 'b1', bg: '#30ba78', x: 300, y: 300, w: 200, h: 200, rot: 0 } as Box;
const pathBox: Box = {
  kind: 'path', shape: 'rect', id: 'p1', bg: '', stroke: '#0e1217', strokeW: 4, fillRule: 'nonzero',
  x: 300, y: 300, w: 200, h: 200, rot: 0,
  path: encodeAuthoredPath({
    kind: 'cubic', closed: false,
    nodes: [
      { x: 0, y: 1, hOutX: 0.2, hOutY: -0.4, continuity: 'corner' },
      { x: 0.5, y: 0, hInX: -0.2, hInY: 0, hOutX: 0.2, hOutY: 0, continuity: 'smooth' },
      { x: 1, y: 1, hInX: -0.2, hInY: -0.4, continuity: 'corner' },
    ],
  }),
} as Box;

/** Open one colour field's popover on the bar and return one of its channel sliders. */
function colourSlider(f: Fixture, id: string): HTMLInputElement {
  const field = f.stageEl.querySelector<HTMLElement>(`.fc-ctxbar [data-color-field="${id}"]`);
  assert.ok(field, `the bar offers ${id}`);
  click(field!.querySelector('.color-trigger')!);
  frames();
  const slider = field!.querySelector<HTMLInputElement>('.color-popover input[data-mode-ch]');
  assert.ok(slider, 'the popover carries a channel slider');
  return slider!;
}
/** One tick of a slider drag: the value moves and `input` fires, as a browser does. */
function tick(slider: HTMLInputElement, value: number): void {
  slider.value = String(value);
  fire(slider, 'input');
}

// ══ the preview itself ══════════════════════════════════════════════════════════

test('a style preview puts every element back byte for byte, including one that had no style', () => {
  const a = dom.window.document.createElement('div');
  a.setAttribute('style', 'line-height:1.12;padding:8px;');
  const b = dom.window.document.createElement('div');
  const preview = createStylePreview();
  preview.set(a, 'line-height', '2');
  preview.set(a, 'line-height', '2.5');
  preview.set(b, 'color', 'red');
  assert.equal(preview.active(), true);
  assert.equal(a.style.lineHeight, '2.5');
  assert.equal(b.style.color, 'red');
  preview.restore();
  assert.equal(a.getAttribute('style'), 'line-height:1.12;padding:8px;', 'the original text, not a re-serialisation');
  assert.equal(b.hasAttribute('style'), false, 'an element with no style attribute is left with none');
  assert.equal(preview.active(), false);
  preview.restore();   // idempotent
  assert.equal(a.getAttribute('style'), 'line-height:1.12;padding:8px;');
});

// ══ 1. a two-second typography drag is one commit ═══════════════════════════════

test('a two-second line-height drag shows on the box and commits once, on release', () => {
  const f = mount([textBox]);
  try {
    const textStyle = 'text-align:center;line-height:1.12;padding:8px;';
    const { text } = livePaint(f, 't1', 'left:300px;top:300px;', textStyle);
    selectAt(f, 450, 360);
    click(f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx="text"]')!);
    const panel = f.stageEl.querySelector<HTMLElement>('.fc-text-panel');
    assert.ok(panel, 'the Text panel opened');
    const range = panel!.querySelector<HTMLInputElement>('input[type="range"][data-tp="lh"]')!;
    const before = f.commits();

    range.dispatchEvent(pointerEvent('pointerdown'));
    // Two seconds at sixty ticks a second.
    for (let i = 1; i <= 120; i++) tick(range, 1.12 + i * 0.01);
    assert.equal(f.commits(), before, 'no tick reached the model');
    assert.equal(text.style.lineHeight, range.value, 'but the box shows the dragged value');
    assert.equal(panel!.querySelector('[data-tp-val="lh"]')!.textContent, Number(range.value).toFixed(2), 'and so does the readout');

    fire(range, 'change');
    range.dispatchEvent(pointerEvent('pointerup'));
    frames();
    assert.equal(f.commits() - before, 1, 'one commit for the whole drag');
    assert.equal(byId(f, 't1').lineHeight, Number(range.value));
    assert.equal(text.getAttribute('style'), textStyle, 'the preview came off before the commit');
  } finally { f.destroy(); }
});

test('padding and letter spacing follow the same rule, and a drag back to the start commits nothing', () => {
  const f = mount([textBox]);
  try {
    const textStyle = 'line-height:1.12;padding:8px;';
    const { text } = livePaint(f, 't1', '', textStyle);
    selectAt(f, 450, 360);
    click(f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx="text"]')!);
    const panel = f.stageEl.querySelector<HTMLElement>('.fc-text-panel')!;
    const pad = panel.querySelector<HTMLInputElement>('input[type="range"][data-tp="pad"]')!;
    const tr = panel.querySelector<HTMLInputElement>('input[type="range"][data-tp="tr"]')!;
    const before = f.commits();

    for (const v of [10, 20, 30]) tick(pad, v);
    assert.equal(text.style.padding, '30px');
    fire(pad, 'change');
    assert.equal(f.commits() - before, 1);
    assert.equal(byId(f, 't1').pad, 30);

    for (const v of [2, 4, 6]) tick(tr, v);
    assert.equal(text.style.letterSpacing, '6px');
    fire(tr, 'change');
    assert.equal(f.commits() - before, 2);
    assert.equal(byId(f, 't1').tracking, 6);

    // A drag that ends where it began fires no `change`: nothing is written, and the
    // preview still comes off once the pointer is up.
    const painted = text.getAttribute('style');
    pad.dispatchEvent(pointerEvent('pointerdown'));
    for (const v of [40, 50, 30]) tick(pad, v);
    pad.dispatchEvent(pointerEvent('pointerup'));
    frames();
    assert.equal(f.commits() - before, 2, 'no commit');
    assert.equal(text.getAttribute('style'), painted, 'and no preview left behind');
  } finally { f.destroy(); }
});

// ══ 2 and 3. a colour drag on a plain box ═══════════════════════════════════════

test('a colour drag on a box shows on the box and commits once, when the pointer comes up', () => {
  const f = mount([plainBox]);
  try {
    const boxStyle = 'left:300px;top:300px;width:200px;height:200px;background:#30ba78;';
    const { box } = livePaint(f, 'b1', boxStyle, '');
    selectAt(f, 400, 400);
    const slider = colourSlider(f, 'fc-fill');
    const before = f.commits();

    slider.dispatchEvent(pointerEvent('pointerdown'));
    const min = Number(slider.min || 0), max = Number(slider.max || 1);
    for (let i = 1; i <= 60; i++) tick(slider, min + ((max - min) * i) / 61);
    frames();
    assert.equal(f.commits(), before, 'no tick reached the model');
    const shown = box.style.backgroundColor;
    assert.ok(shown && shown !== 'rgb(48, 186, 120)', `the box shows the dragged colour (${shown})`);

    dom.window.document.dispatchEvent(pointerEvent('pointerup'));
    frames();
    assert.equal(f.commits() - before, 1, 'one commit for the whole drag');
    assert.notEqual(byId(f, 'b1').bg, '#30ba78', 'and it carries the dragged colour');
    assert.equal(box.getAttribute('style'), boxStyle, 'the preview came off before the commit');
  } finally { f.destroy(); }
});

// ══ 4. a path cannot show a colour on its own: live, once a frame ═══════════════

test('a stroke-colour drag on a path writes live, at most once a frame, and writes the last value on release', () => {
  const f = mount([pathBox]);
  try {
    selectAt(f, 400, 400);
    const slider = colourSlider(f, 'fc-stroke');
    const before = f.commits();
    slider.dispatchEvent(pointerEvent('pointerdown'));
    const min = Number(slider.min || 0), max = Number(slider.max || 1);
    let ticks = 0;
    for (let frame = 0; frame < 5; frame++) {
      for (let i = 0; i < 6; i++) tick(slider, min + ((max - min) * ++ticks) / 40);
      frames(1);
    }
    assert.equal(f.commits() - before, 5, 'thirty ticks over five frames: five writes, not thirty');
    for (let i = 0; i < 3; i++) tick(slider, min + ((max - min) * ++ticks) / 40);
    dom.window.document.dispatchEvent(pointerEvent('pointerup'));
    assert.equal(f.commits() - before, 6, 'the release writes the last value at once');
    const stroke = byId(f, 'p1').stroke;
    frames();
    assert.equal(f.commits() - before, 6, 'and no stale frame writes after it');
    assert.equal(byId(f, 'p1').stroke, stroke);
  } finally { f.destroy(); }
});

// ══ 5. a click is still one write, at once ═════════════════════════════════════

test('a swatch click writes at once, with no drag in progress', () => {
  const f = mount([plainBox]);
  try {
    selectAt(f, 400, 400);
    const field = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-color-field="fc-fill"]')!;
    click(field.querySelector('.color-trigger')!);
    frames();
    const swatch = field.querySelector<HTMLElement>('[data-swatch-value]');
    assert.ok(swatch, 'the popover offers a swatch');
    const before = f.commits();
    // A real click: down, up, then click. The drag that the press opens has ended by the
    // time the click arrives, so the click's change is written straight away.
    swatch!.dispatchEvent(pointerEvent('pointerdown'));
    dom.window.document.dispatchEvent(pointerEvent('pointerup'));
    click(swatch!);
    assert.equal(f.commits() - before, 1);
    assert.equal(byId(f, 'b1').bg, swatch!.dataset.swatchValue);
  } finally { f.destroy(); }
});
