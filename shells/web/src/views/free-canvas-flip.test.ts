// SPDX-License-Identifier: MPL-2.0
/**
 * Flip (mirror) on the canvas editor - the ELEMENT context menu's "Flip horizontal" /
 * "Flip vertical" items and the Shift+H / Shift+V shortcuts.
 *
 * The flip is a per-box boolean (`flipH`/`flipV`) the tool's hooks.js folds into the box
 * transform as a negative scale about the box centre, so the mirror lands in the rendered
 * AND exported output. This suite is the OVERLAY half: choosing the menu item / pressing the
 * key toggles that flag on every selected box in ONE commit, the shortcut respects the
 * typing guard and does not hijack the Pointer tool's bare V, and a tool that never declared
 * the flip fields is offered nothing (additive).
 *
 * Driven through real DOM events against the real `initFreeCanvas`, on the jsdom harness
 * free-canvas-tools.test.ts established: an in-memory runtime that echoes `setInput` back
 * through `getModel`, so "the flag flipped in one commit" is a round trip, not a stub.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-flip.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';
import { initFreeCanvas } from './free-canvas.ts';

// ── jsdom bootstrap (same shape as free-canvas-tools.test.ts) ─────────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
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

function pointerEvent(type: string, o: { x: number; y: number; id?: number }): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: o.x, clientY: o.y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: o.id ?? 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

// ── fixture ───────────────────────────────────────────────────────────────────

const NATIVE = 1000;

/** Design's flip sub-fields, exactly as tool.json appends them: two booleans the OVERLAY
 *  keys the whole flip feature off (presence in `fields`, not a canvas.*Field key). */
const FLIP_FIELDS = [
  { id: 'flipH', type: 'boolean', label: 'Flip horizontal', default: false, showFor: [] },
  { id: 'flipV', type: 'boolean', label: 'Flip vertical', default: false, showFor: [] },
];

function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', groupField: 'group', clipField: 'clip',
    addKinds: [{ id: 'box', label: 'Box', seed: {} }],
  };
}

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  commits: () => number;
  destroy(): void;
}

/** `withFlip` controls whether the boxes input DECLARES the flip sub-fields, so one harness
 *  drives both the opted-in tool and a tool that never asked for flip. */
function mount(initial: Box[], withFlip = true): Fixture {
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
  let commits = 0;
  const subs: Array<() => void> = [];
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { model.set(id, value); commits++; for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: canvasCfg() as never, fields: (withFlip ? FLIP_FIELDS : []) as never },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  frames();
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    commits: () => commits,
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

const plainBox = (id: string, x: number, y: number): Box =>
  ({ kind: 'box', shape: 'rect', id, x, y, w: 120, h: 120, bg: '#ccc' } as Box);

const key = (
  k: string,
  mods: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {},
): void => {
  dom.window.dispatchEvent(new W.KeyboardEvent('keydown', {
    key: k, bubbles: true, cancelable: true,
    metaKey: !!mods.meta, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift, altKey: !!mods.alt,
  }));
};

/** Select a box the way a click does: a pointerdown+up inside its model rect. */
function selectAt(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x, y }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x, y }));
  frames();
}
const selectionCount = (f: Fixture): number => f.stageEl.querySelectorAll('.fc-chrome .fc-outline').length;

/** Open the object context menu at a point (the desktop right-click path). */
function openMenu(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
  frames();
}
const menuItems = (f: Fixture): HTMLButtonElement[] =>
  [...f.stageEl.querySelectorAll<HTMLButtonElement>('.fc-context-menu .fc-pop-item')];
const menuItem = (f: Fixture, label: string): HTMLButtonElement | undefined =>
  menuItems(f).find((b) => (b.textContent || '').trim() === label);
const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

// ══ the context menu ═════════════════════════════════════════════════════════

test('the element context menu offers Flip horizontal and Flip vertical for a selection', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  assert.ok(selectionCount(f) > 0, 'the box is selected');
  openMenu(f, 760, 760);
  const h = menuItem(f, 'Flip horizontal');
  const v = menuItem(f, 'Flip vertical');
  assert.ok(h, 'the menu has a Flip horizontal item');
  assert.ok(v, 'the menu has a Flip vertical item');
  // Reuses the shared PopItem builder - icon in .fc-pop-ic, label in its own <span>: no new
  // raw-HTML sink, the label is standard textContent.
  assert.ok(h!.querySelector('.fc-pop-ic'), 'the item carries the standard icon span');
  assert.equal(h!.querySelector('span:not(.fc-pop-ic)')!.textContent, 'Flip horizontal',
    'the label is plain text in the builder\'s own span');
  f.destroy();
});

test('choosing Flip horizontal mirrors the box in ONE commit; choosing again un-flips it', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  const c0 = f.commits();
  openMenu(f, 760, 760);
  click(menuItem(f, 'Flip horizontal')!);
  frames();
  assert.equal(f.commits() - c0, 1, 'one flip, one commit - one undo step');
  assert.equal(f.boxes()[0]!.flipH, true, 'flipH is set');
  assert.notEqual(f.boxes()[0]!.flipV, true, 'flipV is left alone');

  // Its own inverse: a second Flip horizontal clears it.
  const c1 = f.commits();
  openMenu(f, 760, 760);
  click(menuItem(f, 'Flip horizontal')!);
  frames();
  assert.equal(f.commits() - c1, 1, 'the un-flip is also one commit');
  assert.equal(f.boxes()[0]!.flipH, false, 'flipH toggled back off');
  f.destroy();
});

test('Flip vertical sets flipV only, and the two axes are independent', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  openMenu(f, 760, 760);
  click(menuItem(f, 'Flip vertical')!);
  frames();
  assert.equal(f.boxes()[0]!.flipV, true, 'flipV set');
  assert.notEqual(f.boxes()[0]!.flipH, true, 'flipH untouched');
  f.destroy();
});

test('a multi-selection flips every box in a SINGLE commit', () => {
  const f = mount([plainBox('a', 100, 100), plainBox('b', 700, 700)]);
  key('a', { meta: true });                 // select all (both boxes)
  frames();
  assert.ok(selectionCount(f) > 0, 'the selection chrome is up');
  const c0 = f.commits();
  key('H', { shift: true });
  frames();
  assert.equal(f.commits() - c0, 1, 'two boxes, still one commit');
  assert.equal(f.boxes()[0]!.flipH, true, 'first box flipped');
  assert.equal(f.boxes()[1]!.flipH, true, 'second box flipped');
  f.destroy();
});

// ══ the keyboard ═════════════════════════════════════════════════════════════

test('Shift+H and Shift+V flip the selection', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  key('H', { shift: true });
  frames();
  assert.equal(f.boxes()[0]!.flipH, true, 'Shift+H mirrored horizontally');
  key('V', { shift: true });
  frames();
  assert.equal(f.boxes()[0]!.flipV, true, 'Shift+V mirrored vertically');
  f.destroy();
});

test('Shift+H does NOT fire while a text field is focused', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  const input = dom.window.document.createElement('input');
  dom.window.document.body.appendChild(input);
  input.focus();
  const c0 = f.commits();
  key('H', { shift: true });
  frames();
  assert.equal(f.commits(), c0, 'typing Shift+H into a field commits nothing');
  assert.notEqual(f.boxes()[0]!.flipH, true, 'and the box is not flipped');
  input.blur();
  input.remove();

  // A live inline text edit (a focused contenteditable inside the canvas) is the same guard.
  const ed = dom.window.document.createElement('div');
  ed.contentEditable = 'true';
  ed.tabIndex = 0;
  Object.defineProperty(ed, 'isContentEditable', { value: true });
  f.canvasEl.appendChild(ed);
  ed.focus();
  key('V', { shift: true });
  frames();
  assert.notEqual(f.boxes()[0]!.flipV, true, 'nor does Shift+V flip while editing text');
  f.destroy();
});

test('bare V does not flip - it stays the Pointer tool (no hijack)', () => {
  const f = mount([plainBox('a', 700, 700)]);
  selectAt(f, 760, 760);
  const c0 = f.commits();
  key('v');                                 // the pointer-tool letter, unmodified
  frames();
  assert.equal(f.commits(), c0, 'bare V commits nothing');
  assert.notEqual(f.boxes()[0]!.flipV, true, 'bare V is not a flip');
  f.destroy();
});

// ══ additive: a tool that never declared the flip fields ══════════════════════

test('a boxes input without the flip fields is offered no flip - menu and keys are inert', () => {
  const f = mount([plainBox('a', 700, 700)], /* withFlip */ false);
  selectAt(f, 760, 760);
  openMenu(f, 760, 760);
  assert.equal(menuItem(f, 'Flip horizontal'), undefined, 'no Flip horizontal item');
  assert.equal(menuItem(f, 'Flip vertical'), undefined, 'no Flip vertical item');
  const c0 = f.commits();
  key('H', { shift: true });
  key('V', { shift: true });
  frames();
  assert.equal(f.commits(), c0, 'the shortcuts commit nothing on an un-opted tool');
  assert.notEqual(f.boxes()[0]!.flipH, true, 'and nothing is flipped');
  f.destroy();
});
