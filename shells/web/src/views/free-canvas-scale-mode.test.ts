// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 311 M2 - Scale mode, pinned through the real initFreeCanvas in jsdom (the
 * free-canvas-transform-foundation.test.ts harness):
 *
 *   1. K toggles Scale mode, both toggles follow with aria-pressed and the change is
 *      announced; K is ignored while typing, in a text edit, in the timeline panel and
 *      with a modifier; V and Escape leave Scale, Escape ahead of any deselect, and the
 *      pen and the Node tool end Scale mode;
 *   2. a Scale drag on one box grows its content by the geometry's own k in one undo
 *      step, a Resize drag commits geometry only, and k is clamped at minSize and 100;
 *   3. a multi-selection and an artboard scale every member's content and position
 *      about the anchor;
 *   4. composed text scales its story once in the same commit, a thread only partly in
 *      the selection or a story someone else is typing in keeps its size and says why;
 *   5. on a keyframe diamond the size is posed with 'set' and the content goes to the base;
 *   6. Escape mid-drag restores the DOM and commits nothing, the size label lives only as
 *      long as the drag, and the Scale popover applies 200% about a chosen anchor;
 *   7. the review fixes: every Scale gives its undo step a name, a peer's content edit during
 *      the drag is scaled rather than lost, an auto-sized text frame keeps its mode, a
 *      host without history or a story the engine refuses falls back to geometry with a
 *      translated reason, a layout container keeps its modes and still turns, an
 *      artboard keeps its readout, and a locked layer inside the set stops Scale with a
 *      spoken reason.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-scale-mode.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { CanvasClaim } from '@lolly-tools/core/canvas-interaction-v1';
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
let coarse = false;
Reflect.set(globalThis, 'matchMedia', (q: string) =>
  ({ matches: q.includes('coarse') ? coarse : false, media: q, addEventListener() {}, removeEventListener() {} }));
Reflect.set(globalThis, 'ResizeObserver', class { observe() {} disconnect() {} });
Reflect.set(globalThis, 'CSS', Reflect.get(W, 'CSS') ?? { escape: (v: string) => String(v).replace(/[^\w-]/g, (c) => `\\${c}`) });

const { initFreeCanvas } = await import('./free-canvas.ts');
const { registerCanvasInteractions } = await import('../lib/canvas-interaction.ts');
const { createTextStory, serializeTextDocument, parseTextDocument } = await import('../../../../engine/src/text-story-document.ts');
const { defaultTextFrameSettings, readDesignText } = await import('../../../../engine/src/text-design.ts');
const { parseKf } = await import('../../../../engine/src/keyframes.ts');

const NATIVE = 1000;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

function pointer(type: string, x: number, y: number): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}
/** A key pressed with focus on `target` (the body unless given), bubbling to the window. */
function press(key: string, mods: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {}, target?: Element): KeyboardEvent {
  const e = new W.KeyboardEvent('keydown', {
    key, bubbles: true, cancelable: true,
    metaKey: !!mods.meta, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift, altKey: !!mods.alt,
  });
  (target ?? dom.window.document.body).dispatchEvent(e);
  return e;
}

const BASE_CANVAS = {
  idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  rotationField: 'rot', groupField: 'group', textField: 'text',
  fontSizeField: 'fontSize', radiusField: 'radius', strokeWField: 'strokeW',
  shadowXField: 'shadowX', shadowYField: 'shadowY', shadowBlurField: 'shadowBlur',
  addKinds: [{ id: 'box', label: 'Box', seed: { kind: 'box' } }],
};
/** The time-capable canvas of free-canvas-kf-commit.test.ts, plus the content fields. */
const TIME_CANVAS = {
  ...BASE_CANVAS,
  startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
  enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
  muteField: 'mute', laneField: 'lane', kfField: 'kf', zField: 'z', imageField: 'image', fitField: 'fit',
  addKinds: [{ id: 'clip', label: 'Clip', seed: { kind: 'image', lane: 'seq', fit: 'cover' } }],
};
const FRAME_CFG = { frameField: 'frame', frameKind: 'frame', orderField: 'order', lockedField: 'locked' };

interface MountOpts {
  canvas?: Record<string, unknown>;
  frame?: boolean;
  /** Design's composed text: a text document input, the pages ports and the frame fields. */
  text?: string;
  /** Record history commits (a composed-text Scale commits through history). */
  history?: boolean;
  /** Composed text on a host with no history and no applyPatch. */
  noHistory?: boolean;
  /** Layout receipts that mirror the source rows, so layout placement is ready. */
  layout?: boolean;
  /** The canvas input's declared box fields. */
  fields?: Array<{ id: string; type?: string; min?: number; max?: number }>;
}
interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  runtime: object;
  byId(id: string): Record<string, unknown>;
  model(id: string): unknown;
  el(id: string): HTMLElement;
  writes(): number;
  /** Another participant's write to an input, as the collaboration layer applies one. */
  write(id: string, value: unknown): void;
  commits: Array<{ values: Record<string, unknown>; label: string }>;
  /** The names given to plain row writes through history.named. */
  names: string[];
  select(ids: string[]): void;
  handle(name: string): HTMLElement | null;
  rail(): HTMLElement;
  destroy(): void;
}

function paint(canvasEl: HTMLElement, b: Box): void {
  const el = dom.window.document.createElement('div');
  const page = String(b.kind) === 'frame';
  el.className = page ? 'lolly-frame-page' : 'lolly-box';
  el.setAttribute(page ? 'data-frame-id' : 'data-box-id', String(b.id));
  if (page) el.setAttribute('data-pdf-page', '');
  el.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
  const text = dom.window.document.createElement('div');
  text.className = 'lolly-box-text';
  text.textContent = String(b.text ?? '');
  el.appendChild(text);
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

  const model = new Map<string, unknown>([['boxes', seed], ['textDocument', o.text ?? ''], ['pages', [{ id: 'page-1', name: 'Page 1' }]]]);
  const subs: Array<() => void> = [];
  let writes = 0;
  const commits: Fixture['commits'] = [];
  const names: string[] = [];
  // layout.ts's own escaping, so the receipt's provenance matches the source key.
  const safeJson = (v: unknown): string => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { writes++; model.set(id, value); for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
    ...(o.layout && {
      getHydratedText: (text: string): string => /layout(Boxes|Source)Json/.test(text) ? safeJson(model.get('boxes')) : text.includes('layoutGridsJson') ? '[]' : '',
    }),
  };
  const history = {
    undo() {}, redo() {}, register() {},
    async commit(values: Record<string, unknown>, label: string) {
      commits.push({ values, label });
      for (const [id, value] of Object.entries(values)) model.set(id, value);
      for (const s of subs) s();
    },
    named(label: string, write: () => void) { names.push(label); write(); },
  };
  const text = o.text !== undefined;
  const canvas = {
    ...BASE_CANVAS,
    ...(text && { textDocumentInput: 'textDocument', textStoryField: 'textStory', textFrameField: 'textFrame' }),
    ...o.canvas,
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: canvas as never, fields: (o.fields ?? []) as never },
    ...(o.frame && { frame: FRAME_CFG }),
    ...(text && { getDesignPages: () => model.get('pages') as never, getActivePage: () => 'page-1' }),
    ...((o.history || (text && !o.noHistory)) && { history: history as never }),
    nativeW: NATIVE, nativeH: NATIVE,
  });
  const boxes = (): Box[] => model.get('boxes') as Box[];
  return {
    stageEl, canvasEl, runtime, commits, names,
    byId: (id) => boxes().find((b) => b.id === id)! as Record<string, unknown>,
    model: (id) => model.get(id),
    el: (id) => canvasEl.querySelector<HTMLElement>(`[data-box-id="${id}"], [data-frame-id="${id}"]`)!,
    writes: () => writes,
    write: (id, value) => runtime.setInput(id, value),
    select: (ids) => handle.applyUi({ select: ids } as never),
    handle: (name) => stageEl.querySelector<HTMLElement>(`.fc-chrome .fc-h-${name}`),
    rail: () => stageEl.querySelector<HTMLElement>('.fc-toolbar .fc-btn-scale')!,
    // The body keeps its live regions: announce() holds on to the one it made first.
    destroy() { handle.destroy(); viewEl.remove(); for (const p of doc.querySelectorAll('.fc-panel')) p.remove(); },
  };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 25)); for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };
const at = (el: HTMLElement): [number, number] => [parseFloat(el.style.left), parseFloat(el.style.top)];
const geom = (el: HTMLElement): string => [el.style.left, el.style.top, el.style.width, el.style.height].join(' ');
const rectOf = (b: Record<string, unknown>): number[] => [b.x, b.y, b.w, b.h].map(Number);
const announced = (): string => dom.window.document.querySelector('[data-a11y-live][aria-live="polite"]')?.textContent ?? '';
const label = (f: Fixture): HTMLElement | null => f.stageEl.querySelector<HTMLElement>('.fc-overlay .fc-xform-label');
const scaleOn = (f: Fixture): boolean => f.rail().getAttribute('aria-pressed') === 'true';

/** Press `handle`, move by (dx, dy) and, unless `hold`, release. */
async function drag(f: Fixture, handle: string, dx: number, dy: number, hold = false): Promise<void> {
  const h = f.handle(handle);
  assert.ok(h, `a ${handle} handle`);
  const [x, y] = at(h!);
  h!.dispatchEvent(pointer('pointerdown', x, y));
  f.canvasEl.dispatchEvent(pointer('pointermove', x + dx, y + dy));
  await settle();
  if (hold) return;
  f.canvasEl.dispatchEvent(pointer('pointerup', x + dx, y + dy));
  await settle();
}

/** A box with every content field Scale reads, 200 x 100 at (100, 100). */
const CONTENT = (): Box => ({
  id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 100, rot: 0,
  fontSize: 20, strokeW: 2, radius: 8, shadowX: 4, shadowY: 6, shadowBlur: 10, fill: '#ffffff',
} as Box);

// ── 1. the mode ──────────────────────────────────────────────────────────────

test('K toggles Scale mode: both toggles follow with aria-pressed, the chrome restyles, and it is announced', async () => {
  coarse = true;
  const f = mount([CONTENT()]);
  try {
    f.select(['a']);
    await settle();
    const ctx = (): HTMLElement => f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx="scale"]')!;
    assert.ok(ctx(), 'a coarse pointer gets the object bar toggle');
    assert.equal(f.rail().getAttribute('aria-pressed'), 'false', 'every mount starts in Resize');
    assert.ok(f.rail().getAttribute('aria-label'), 'the rail toggle is labelled');
    assert.equal(ctx().getAttribute('aria-label'), 'Scale mode');
    assert.equal(f.stageEl.querySelector('.fc-chrome')!.hasAttribute('data-scale'), false);

    assert.equal(press('k').defaultPrevented, true, 'the canvas took K');
    await settle();
    assert.equal(f.rail().getAttribute('aria-pressed'), 'true');
    assert.ok(f.rail().classList.contains('is-armed'));
    assert.equal(ctx().getAttribute('aria-pressed'), 'true');
    assert.ok(f.stageEl.querySelector('.fc-chrome')!.hasAttribute('data-scale'), 'the handles take the Scale look');
    assert.equal(announced(), 'Scale mode on');

    press('K'); // Caps Lock
    await settle();
    assert.equal(scaleOn(f), false);
    assert.equal(ctx().getAttribute('aria-pressed'), 'false');
    assert.equal(announced(), 'Scale mode off');

    ctx().click();
    await settle();
    assert.equal(scaleOn(f), true, 'the object bar toggle turns it on');
    assert.equal(ctx().getAttribute('aria-pressed'), 'true');
    assert.equal(announced(), 'Scale mode on');
    f.rail().click();
    await settle();
    assert.equal(scaleOn(f), false, 'and the rail toggle off');
    assert.equal(ctx().getAttribute('aria-pressed'), 'false');
    assert.equal(announced(), 'Scale mode off');
  } finally { f.destroy(); coarse = false; }
});

test('K is ignored in a field, in a text edit and with Cmd, Ctrl, Alt or Shift', async () => {
  const f = mount([{ ...CONTENT(), text: 'Hello' } as Box]);
  try {
    for (const mods of [{ meta: true }, { ctrl: true }, { alt: true }, { shift: true }]) {
      press('k', mods);
      await settle();
      assert.equal(scaleOn(f), false, `K with ${Object.keys(mods)[0]} is not K`);
    }
    const input = dom.window.document.createElement('input');
    dom.window.document.body.appendChild(input);
    input.focus();
    press('k', {}, input);
    await settle();
    assert.equal(scaleOn(f), false, 'a focused field types the letter');
    input.remove();

    f.select(['a']);
    await settle();
    press('Enter');
    await settle();
    assert.ok(f.el('a').querySelector('.lolly-box-text[contenteditable="true"]'), 'a text edit is open');
    press('k', {}, f.el('a').querySelector('.lolly-box-text')!);
    press('k');
    await settle();
    assert.equal(scaleOn(f), false, 'a text edit keeps K for the text');
  } finally { f.destroy(); }
});

test('V and Escape leave Scale mode; Escape goes before the deselect, and the pen ends Scale mode', async () => {
  const f = mount([CONTENT()], { canvas: { pathField: 'path' } });
  try {
    f.select(['a']);
    await settle();
    press('k');
    await settle();
    assert.equal(scaleOn(f), true);
    assert.equal(press('Escape').defaultPrevented, true);
    await settle();
    assert.equal(scaleOn(f), false, 'the first Escape leaves Scale mode');
    assert.equal(announced(), 'Scale mode off');
    assert.ok(f.handle('se'), 'and the selection is still there');
    press('Escape');
    await settle();
    assert.equal(f.handle('se'), null, 'the next Escape deselects');

    press('k');
    await settle();
    assert.equal(scaleOn(f), true);
    press('v');
    await settle();
    assert.equal(scaleOn(f), false, 'V, the pointer, is Resize');
    assert.equal(announced(), 'Pointer on, Scale mode off - click to select, drag to move.',
      'one sentence for both changes, as a second announcement would replace the first');
    press('v');
    await settle();
    assert.equal(announced(), 'Pointer on - click to select, drag to move.', 'with Scale already off, the pointer alone');

    press('k');
    await settle();
    press('p');
    await settle();
    assert.equal(scaleOn(f), false, 'switching to the pen ends Scale mode');
    const pen = f.stageEl.querySelector<HTMLElement>('.fc-toolbar .fc-btn-pen')!;
    assert.equal(pen.getAttribute('aria-pressed'), 'true');
    press('k');
    await settle();
    assert.equal(scaleOn(f), true, 'K from the pen returns to the pointer with Scale on');
    assert.equal(pen.getAttribute('aria-pressed'), 'false');
    assert.equal(f.stageEl.querySelector('.fc-toolbar .fc-btn-pointer')!.getAttribute('aria-pressed'), 'true');
  } finally { f.destroy(); }
});

// ── 2. one box ───────────────────────────────────────────────────────────────

test('a Scale drag grows the content by the geometry k, previews it exactly, and commits once', async () => {
  const f = mount([CONTENT()]);
  try {
    f.select(['a']);
    await settle();
    press('k');
    await settle();
    await drag(f, 'se', 100, 50, true);
    const el = f.el('a');
    assert.equal(geom(el), '150px 125px 200px 100px', 'the element keeps its start size, centred on the live centre');
    assert.match(el.style.transform, /scale\(1\.5\)/, 'and grows by k, text and strokes included');
    assert.equal(label(f)?.textContent, 'Scale 150%', 'the label beside the selection');
    assert.equal(f.stageEl.querySelector('.fc-ctxbar [data-cx-readout]')!.textContent, 'Scale 150%', 'and the readout');
    const [x, y] = at(f.handle('se')!);
    f.canvasEl.dispatchEvent(pointer('pointerup', x, y));
    await settle();
    assert.equal(f.writes(), 1, 'one commit, one undo step');
    assert.equal(label(f), null, 'the label goes with the drag');
    const a = f.byId('a');
    assert.deepEqual(rectOf(a), [100, 100, 300, 150]);
    assert.deepEqual([a.fontSize, a.strokeW, a.radius, a.shadowX, a.shadowY, a.shadowBlur], [30, 3, 12, 6, 9, 15],
      'every content length by the same k as the box');
    assert.equal(a.fill, '#ffffff', 'and nothing else');
  } finally { f.destroy(); }
});

test('a Resize drag commits geometry only, with a W x H label while it is live', async () => {
  const f = mount([CONTENT()]);
  try {
    f.select(['a']);
    await settle();
    await drag(f, 'se', 100, 50, true);
    assert.equal(geom(f.el('a')), '100px 100px 300px 150px');
    assert.equal(label(f)?.textContent, '300×150');
    const [x, y] = at(f.handle('se')!);
    f.canvasEl.dispatchEvent(pointer('pointerup', x, y));
    await settle();
    assert.equal(label(f), null);
    const a = f.byId('a');
    assert.deepEqual(rectOf(a), [100, 100, 300, 150]);
    assert.deepEqual([a.fontSize, a.strokeW, a.radius, a.shadowX, a.shadowY, a.shadowBlur], [20, 2, 8, 4, 6, 10]);
  } finally { f.destroy(); }
});

test('a Scale press that never moves writes nothing', async () => {
  const f = mount([CONTENT()]);
  try {
    f.select(['a']);
    await settle();
    press('k');
    await settle();
    await drag(f, 'se', 0.2, 0.1);
    assert.equal(f.writes(), 0);
    assert.equal(geom(f.el('a')), '100px 100px 200px 100px');
    assert.equal(f.el('a').style.transform, '');
  } finally { f.destroy(); }
});

test('k is clamped at minSize and at 100 times', async () => {
  const f = mount([CONTENT(), { id: 'tiny', kind: 'box', x: 600, y: 600, w: 10, h: 10, rot: 0, fontSize: 2 } as Box]);
  try {
    f.select(['a']);
    await settle();
    press('k');
    await settle();
    await drag(f, 'se', -400, -400);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 16, 8], 'the short side stops at the 8 px minimum, aspect kept');
    assert.equal(f.byId('a').fontSize, 1.6, 'and the content by the same k');

    f.select(['tiny']);
    await settle();
    await drag(f, 'se', 5000, 5000, true);
    assert.equal(label(f)?.textContent, 'Scale 10000%');
    const [x, y] = at(f.handle('se')!);
    f.canvasEl.dispatchEvent(pointer('pointerup', x, y));
    await settle();
    assert.deepEqual(rectOf(f.byId('tiny')), [600, 600, 1000, 1000], 'no more than 100 times');
    assert.equal(f.byId('tiny').fontSize, 200);
  } finally { f.destroy(); }
});

// ── 3. sets ──────────────────────────────────────────────────────────────────

test('a multi-selection Scale scales each member about the anchor, content included', async () => {
  const f = mount([
    { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0, fontSize: 10, radius: 4 },
    { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0, strokeW: 3, shadowBlur: 6 },
  ] as Box[]);
  try {
    f.select(['a', 'b']);
    await settle();
    press('k');
    await settle();
    // Twice the press's reach from the nw anchor at (100, 100) is k = 2.
    await drag(f, 'se', 300, 100, true);
    assert.equal(label(f)?.textContent, 'Scale 200%');
    assert.match(f.el('b').style.transform, /scale\(2\)/);
    const [x, y] = at(f.handle('se')!);
    f.canvasEl.dispatchEvent(pointer('pointerup', x, y));
    await settle();
    assert.equal(f.writes(), 1);
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 200, 200]);
    assert.deepEqual(rectOf(f.byId('b')), [500, 100, 200, 200], 'positions scale about the anchor');
    assert.deepEqual([f.byId('a').fontSize, f.byId('a').radius, f.byId('b').strokeW, f.byId('b').shadowBlur], [20, 8, 6, 12]);
  } finally { f.destroy(); }
});

test('the same multi-selection in Resize keeps its content', async () => {
  const f = mount([
    { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0, fontSize: 10, radius: 4 },
    { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0, strokeW: 3 },
  ] as Box[]);
  try {
    f.select(['a', 'b']);
    await settle();
    await drag(f, 'se', 300, 100, true);
    assert.equal(label(f)?.textContent, '600×200', 'the label is the selection bounds');
    const [x, y] = at(f.handle('se')!);
    f.canvasEl.dispatchEvent(pointer('pointerup', x, y));
    await settle();
    assert.deepEqual(rectOf(f.byId('b')), [500, 100, 200, 200]);
    assert.deepEqual([f.byId('a').fontSize, f.byId('a').radius, f.byId('b').strokeW], [10, 4, 3], 'geometry only');
  } finally { f.destroy(); }
});

test('in Scale mode an artboard brings its members, which scale with the artboard', async () => {
  const f = mount([
    { id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300, order: 0, strokeW: 2 },
    { id: 'b1', kind: 'box', x: 150, y: 150, w: 100, h: 50, frame: 'f1', fontSize: 10 },
    { id: 'out', kind: 'box', x: 700, y: 700, w: 50, h: 50, fontSize: 10 },
  ] as Box[], { frame: true });
  try {
    f.select(['f1']);
    await settle();
    assert.ok(f.handle('e'), 'Resize: the artboard has its own eight handles');
    assert.equal(f.stageEl.querySelector('.fc-chrome .fc-group-outline'), null);
    press('k');
    await settle();
    assert.ok(f.stageEl.querySelector('.fc-chrome .fc-group-outline'), 'Scale: the artboard and its members are one set');
    assert.equal(f.handle('rotate'), null, 'and an artboard still never turns');
    // The set's bounds are the artboard's: (100,100) to (500,400), anchored at the nw corner.
    await drag(f, 'se', 400, 300);
    assert.equal(f.writes(), 1);
    assert.deepEqual(rectOf(f.byId('f1')), [100, 100, 800, 600]);
    assert.equal(f.byId('f1').strokeW, 4, "the artboard's own content scales");
    assert.deepEqual(rectOf(f.byId('b1')), [200, 200, 200, 100], 'its member moves and grows about the same anchor');
    assert.equal(f.byId('b1').fontSize, 20);
    assert.equal(f.byId('b1').frame, 'f1');
    assert.deepEqual(rectOf(f.byId('out')), [700, 700, 50, 50], 'a box outside it is untouched');
    assert.equal(f.byId('out').fontSize, 10);
  } finally { f.destroy(); }
});

// ── 4. composed text ─────────────────────────────────────────────────────────

const FONT = { id: 'font', family: 'Example', sha256: 'a'.repeat(64), faceIndex: 0, source: { kind: 'bundled' as const, path: '/fonts/example.ttf' } };
const FRAME_SETTINGS = JSON.stringify({ mode: 'fixed', inset: { top: 4, right: 4, bottom: 4, left: 4 }, columns: { count: 1, gutter: 0, balance: false }, verticalAlign: 'top' });
/** One story over `frames`, at 20 px. */
function storyDoc(frames: string[]): string {
  const story = createTextStory('story-1', 'Hello world', (i) => `p${i}`);
  story.frameIds = frames;
  story.paragraphs[0]!.paragraph = { character: { font: 'font', size: 20 } };
  return serializeTextDocument({ version: 1, stories: [story], styles: [], fonts: [FONT] });
}
const textBox = (id: string, x: number): Box => ({
  id, kind: 'text', x, y: 100, w: 200, h: 100, rot: 0, group: '', pageId: 'page-1',
  text: '', textStory: 'story-1', textFrame: FRAME_SETTINGS,
} as Box);

test('composed text: the story scales once with the frame, in the same commit as the boxes', async () => {
  const f = mount([textBox('t1', 100)], { text: storyDoc(['t1']) });
  try {
    f.select(['t1']);
    await settle();
    press('k');
    await settle();
    await drag(f, 'se', 100, 50);
    assert.equal(f.commits.length, 1, 'one history step');
    assert.equal(f.writes(), 0, 'and no separate write');
    const { values, label: name } = f.commits[0]!;
    assert.equal(name, 'Scale');
    const doc = parseTextDocument(values.textDocument);
    const story = doc.stories[0]!;
    assert.equal(story.paragraphs[0]!.paragraph!.character!.size, 30, 'the type scaled by k');
    assert.equal(story.revision, 1, 'and the story moved on a revision');
    const t1 = (values.boxes as Box[]).find((b) => b.id === 't1')!;
    assert.deepEqual(rectOf(t1), [100, 100, 300, 150]);
    assert.deepEqual(JSON.parse(String(t1.textFrame)).inset, { top: 6, right: 6, bottom: 6, left: 6 }, 'the frame scaled too');
  } finally { f.destroy(); }
});

test('composed text: a thread only partly in the selection keeps its size and says why', async () => {
  const f = mount([textBox('t1', 100), textBox('t2', 500)], { text: storyDoc(['t1', 't2']) });
  try {
    f.select(['t1']);
    await settle();
    press('k');
    await settle();
    await drag(f, 'se', 100, 50);
    assert.equal(f.commits.length, 0, 'no text document change');
    assert.equal(f.writes(), 1, 'the geometry commits on its own');
    assert.equal(f.model('textDocument'), storyDoc(['t1', 't2']));
    assert.deepEqual(rectOf(f.byId('t1')), [100, 100, 300, 150]);
    assert.equal(f.byId('t1').textFrame, FRAME_SETTINGS);
    assert.equal(announced(), 'Linked text kept its size because the selection does not hold every frame of its story.');
  } finally { f.destroy(); }
});

test('composed text: a story another participant is typing in keeps its size and says why', async () => {
  const f = mount([textBox('t1', 100)], { text: storyDoc(['t1']) });
  const claim: CanvasClaim = { id: 'peer-text', owner: 'peer', name: 'Peer', expiresAt: Date.now() + 60_000,
    target: { kind: 'text', collection: 'boxes', ids: ['t1'], param: 'textDocument' } };
  const off = registerCanvasInteractions(f.runtime, {
    acquire: async () => ({ id: 'mine', preview() {}, finish() {} }),
    foreignClaims: () => [claim],
  });
  try {
    f.select(['t1']);
    await settle();
    press('k');
    await settle();
    await drag(f, 'se', 100, 50);
    assert.equal(f.commits.length, 0);
    assert.equal(f.writes(), 1);
    assert.deepEqual(rectOf(f.byId('t1')), [100, 100, 300, 150]);
    assert.equal(f.byId('t1').textFrame, FRAME_SETTINGS);
    assert.equal(announced(), 'Text kept its size because someone else is editing text in this design.');
  } finally { off(); f.destroy(); }
});

// ── 5. keyframes ─────────────────────────────────────────────────────────────

test('on a keyframe diamond a Scale poses w/h with set and writes the content to the base row', async () => {
  const f = mount([{
    id: 'a', x: 100, y: 100, w: 200, h: 100, rot: 0, start: 0, dur: 4, clipIn: 0, speed: 1, lane: '',
    kf: 't0_x0_y0*t2000_eo_x40_y10', fontSize: 20, strokeW: 2,
  } as Box], { canvas: TIME_CANVAS });
  try {
    f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-timeline')!.click();
    await settle();
    assert.ok(f.stageEl.querySelector('.tl-panel'), 'the timeline panel mounted');
    f.stageEl.dispatchEvent(new W.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 2000 } }));
    await settle();
    f.select(['a']);
    await settle();
    // The panel took focus when it opened, and K there is the panel's own key.
    (dom.window.document.activeElement as HTMLElement | null)?.blur();
    press('k');
    await settle();
    assert.equal(scaleOn(f), true);
    const before = f.writes();
    await drag(f, 'se', 100, 50);
    assert.equal(f.writes() - before, 1, 'one undo step');
    const a = f.byId('a');
    assert.deepEqual(rectOf(a), [100, 100, 200, 100], 'the base size is not the pose');
    assert.deepEqual([a.fontSize, a.strokeW], [30, 3], 'the content goes to the base row');
    const key = parseKf(String(a.kf)).find((k) => k.t === 2000)!;
    assert.equal(key.v.w, 300, "the keyframe's width is set to the new size");
    assert.equal(key.v.h, 150);
    assert.deepEqual([key.v.x, key.v.y], [40, 10], 'the se handle moves no origin');
  } finally { f.destroy(); }
});

test('K inside the timeline panel is the panel\'s key', async () => {
  const f = mount([{ id: 'a', x: 100, y: 100, w: 200, h: 100, rot: 0, start: 0, dur: 4, lane: '' } as Box], { canvas: TIME_CANVAS });
  try {
    f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-timeline')!.click();
    await settle();
    const panel = f.stageEl.querySelector<HTMLElement>('.tl-panel');
    assert.ok(panel);
    const inner = dom.window.document.createElement('button');
    panel!.appendChild(inner);
    inner.focus();
    assert.equal(dom.window.document.activeElement, inner);
    press('k', {}, inner);
    await settle();
    assert.equal(scaleOn(f), false, 'K in the panel never reaches the canvas');
  } finally { f.destroy(); }
});

// ── 6. cancel, popover ───────────────────────────────────────────────────────

test('Escape mid-Scale puts the DOM back on the model and commits nothing', async () => {
  const f = mount([CONTENT()]);
  try {
    f.select(['a']);
    await settle();
    press('k');
    await settle();
    await drag(f, 'se', 100, 50, true);
    assert.match(f.el('a').style.transform, /scale/);
    press('Escape');
    await settle();
    assert.equal(geom(f.el('a')), '100px 100px 200px 100px', 'the size and place are back');
    assert.equal(f.el('a').style.transform, '', 'and the scale is gone');
    assert.equal(label(f), null);
    assert.equal(scaleOn(f), true, 'the cancel is the first rung; Scale mode stays on');
    f.canvasEl.dispatchEvent(pointer('pointerup', 400, 250));
    await settle();
    assert.equal(f.writes(), 0);
  } finally { f.destroy(); }
});

test('the Scale popover applies 200% about a chosen anchor in one undo step and returns focus', async () => {
  const f = mount([CONTENT()]);
  try {
    f.select(['a']);
    await settle();
    const readout = (): HTMLElement => f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx-readout]')!;
    assert.equal(readout().getAttribute('aria-haspopup'), null, 'one box in Resize: the readout is position and size');
    press('k');
    await settle();
    assert.equal(readout().getAttribute('aria-haspopup'), 'dialog', 'Scale on: the readout opens the popover');
    readout().click();
    const panel = f.stageEl.querySelector<HTMLElement>('.fc-scale-panel');
    assert.ok(panel, 'the popover opened');
    assert.equal(panel!.getAttribute('role'), 'dialog');
    const field = panel!.querySelector<HTMLInputElement>('input[type="number"]')!;
    assert.equal(dom.window.document.activeElement, field, 'focus starts in the percentage');

    // Escape closes it and gives focus back.
    press('Escape', {}, field);
    assert.equal(f.stageEl.querySelector('.fc-scale-panel'), null);
    assert.equal(dom.window.document.activeElement, readout());
    assert.equal(scaleOn(f), true, "the popover's Escape is its own");

    readout().click();
    const p2 = f.stageEl.querySelector<HTMLElement>('.fc-scale-panel')!;
    const cells = [...p2.querySelectorAll<HTMLButtonElement>('.fc-pos-btn')];
    assert.equal(cells.length, 9);
    const se = cells.find((c) => c.getAttribute('aria-label') === 'Bottom right')!;
    se.click();
    assert.equal(se.getAttribute('aria-pressed'), 'true');
    assert.equal(cells.filter((c) => c.getAttribute('aria-pressed') === 'true').length, 1);
    const input = p2.querySelector<HTMLInputElement>('input[type="number"]')!;
    input.value = '200';
    press('Enter', {}, input);
    await settle();
    assert.equal(f.writes(), 1, 'one undo step');
    const a = f.byId('a');
    assert.deepEqual(rectOf(a), [-100, 0, 400, 200], 'the bottom right corner held still');
    assert.deepEqual([a.fontSize, a.strokeW, a.radius], [40, 4, 16], 'content too, in Scale mode');
    assert.equal(f.stageEl.querySelector('.fc-scale-panel'), null);
    assert.equal(dom.window.document.activeElement, readout(), 'focus is back on the readout');
  } finally { f.destroy(); }
});

test('with Scale off the popover opens for several objects and resizes their geometry only', async () => {
  const f = mount([
    { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0, fontSize: 10 },
    { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0, fontSize: 10 },
  ] as Box[]);
  try {
    f.select(['a', 'b']);
    await settle();
    f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx-readout]')!.click();
    const panel = f.stageEl.querySelector<HTMLElement>('.fc-scale-panel')!;
    assert.ok(panel);
    panel.querySelector<HTMLInputElement>('input[type="number"]')!.value = '50';
    [...panel.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Apply')!.click();
    await settle();
    assert.equal(f.writes(), 1);
    // The default anchor is the top left of the set's bounds, (100, 100).
    assert.deepEqual(rectOf(f.byId('a')), [100, 100, 50, 50]);
    assert.deepEqual(rectOf(f.byId('b')), [200, 100, 50, 50]);
    assert.deepEqual([f.byId('a').fontSize, f.byId('b').fontSize], [10, 10], 'Resize: geometry only');
  } finally { f.destroy(); }
});

// ── 7. review fixes ──────────────────────────────────────────────────────────

test('every Scale calls its undo step Scale, the drag, the set and the popover alike; a Resize does not', async () => {
  const f = mount([CONTENT(), { id: 'b', kind: 'box', x: 400, y: 100, w: 100, h: 100, rot: 0, fontSize: 10 } as Box], { history: true });
  try {
    f.select(['a']);
    await settle();
    await drag(f, 'se', 50, 25);
    assert.deepEqual(f.names, [], 'a Resize leaves the name to the history, which calls it a resize');
    press('k');
    await settle();
    await drag(f, 'se', 100, 50);
    assert.deepEqual(f.names, ['Scale'], 'one named step for a single box');
    f.select(['a', 'b']);
    await settle();
    await drag(f, 'se', 100, 0);
    assert.deepEqual(f.names, ['Scale', 'Scale'], 'and for a set');
    f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx-readout]')!.click();
    const panel = f.stageEl.querySelector<HTMLElement>('.fc-scale-panel')!;
    panel.querySelector<HTMLInputElement>('input[type="number"]')!.value = '50';
    [...panel.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Apply')!.click();
    await settle();
    assert.deepEqual(f.names, ['Scale', 'Scale', 'Scale'], 'and for the popover');
    assert.equal(f.commits.length, 0, 'each through the plain row write, whose undo merges by field');
  } finally { f.destroy(); }
});

test('a peer edit to a content field during a Scale is scaled, for one box and for a set alike', async () => {
  // Between two moves, and after the last move: the second window is the one a rebase on
  // the next frame never sees, so the commit must read the content it scales.
  for (const ids of [['a'], ['a', 'b']]) for (const when of ['between', 'after'] as const) {
    const f = mount([
      { id: 'a', kind: 'box', x: 100, y: 100, w: 200, h: 100, rot: 0, fontSize: 20, fill: '#ffffff' },
      { id: 'b', kind: 'box', x: 400, y: 100, w: 100, h: 100, rot: 0, fontSize: 10 },
    ] as Box[]);
    const off = registerCanvasInteractions(f.runtime, { acquire: async () => ({ id: 'mine', preview() {}, finish() {} }) });
    try {
      f.select(ids);
      await settle();
      press('k');
      await settle();
      // k = 2: one box doubles from its se corner; the set doubles its reach from (100, 100).
      const [dx, dy] = ids.length === 1 ? [200, 100] : [400, 100];
      const h = f.handle('se')!;
      const [x, y] = at(h);
      h.dispatchEvent(pointer('pointerdown', x, y));
      f.canvasEl.dispatchEvent(pointer('pointermove', x + dx / 2, y + dy / 2));
      await settle();
      const peer = (): void => f.write('boxes', (f.model('boxes') as Box[]).map((b) => (b.id === 'a' ? { ...b, fontSize: 30, fill: '#ff0000' } : b)));
      if (when === 'between') peer();
      f.canvasEl.dispatchEvent(pointer('pointermove', x + dx, y + dy));
      await settle();
      if (when === 'after') peer();
      const before = f.writes();
      f.canvasEl.dispatchEvent(pointer('pointerup', x + dx, y + dy));
      await settle();
      const tag = `${ids.join('+')} ${when}`;
      assert.equal(f.writes() - before, 1, `${tag}: one commit`);
      assert.equal(f.byId('a').w, 400, `${tag}: k is 2`);
      assert.equal(f.byId('a').fontSize, 60, `${tag}: the peer's 30, scaled`);
      assert.equal(f.byId('a').fill, '#ff0000', `${tag}: and the peer's fill kept`);
    } finally { off(); f.destroy(); }
  }
});

/** One story's frame settings exactly as the engine writes them back, so a Scale that
 *  scales nothing in them leaves the string unchanged (zero insets, no gutter). */
function normalFrame(mode: 'auto-width' | 'auto-height', frames: string[]): string {
  const box = { ...textBox(frames[0]!, 100), textFrame: JSON.stringify(defaultTextFrameSettings(mode)) };
  const rows = frames.map((id, i) => ({ ...box, id, x: 100 + 400 * i }));
  const { id: _id, storyId: _s, width: _w, height: _h, hidden: _hd, locked: _l, ...settings } = readDesignText(storyDoc(frames), rows).frames[0]!;
  return JSON.stringify(settings);
}

test('composed text: a Scale keeps an auto width or auto height frame, even when its settings scale to the same string', async () => {
  for (const mode of ['auto-width', 'auto-height'] as const) {
    const frame = normalFrame(mode, ['t1']);
    const f = mount([{ ...textBox('t1', 100), textFrame: frame } as Box], { text: storyDoc(['t1']) });
    try {
      f.select(['t1']);
      await settle();
      press('k');
      await settle();
      await drag(f, 'se', 100, 50);
      assert.equal(f.commits.length, 1, mode);
      const t1 = (f.commits[0]!.values.boxes as Box[]).find((b) => b.id === 't1')!;
      assert.deepEqual(rectOf(t1), [100, 100, 300, 150], mode);
      assert.equal(t1.textFrame, frame, `${mode}: zero insets scale to the same settings`);
      assert.equal(JSON.parse(String(t1.textFrame)).mode, mode, `${mode}: the frame still sizes itself`);
    } finally { f.destroy(); }
  }
});

test('composed text: the geometry-only fallback keeps the Resize rule, which fixes an auto width frame', async () => {
  const frame = normalFrame('auto-width', ['t1', 't2']);
  const f = mount([{ ...textBox('t1', 100), textFrame: frame }, { ...textBox('t2', 500), textFrame: frame }] as Box[], { text: storyDoc(['t1', 't2']) });
  try {
    f.select(['t1']);
    await settle();
    press('k');
    await settle();
    await drag(f, 'se', 100, 50);
    assert.equal(f.commits.length, 0);
    assert.equal(JSON.parse(String(f.byId('t1').textFrame)).mode, 'fixed', 'a resized frame that kept its text size is an authored size');
  } finally { f.destroy(); }
});

test('composed text: two frames of one story scale it once, with one revision', async () => {
  const f = mount([textBox('t1', 100), textBox('t2', 500)], { text: storyDoc(['t1', 't2']) });
  try {
    f.select(['t1', 't2']);
    await settle();
    press('k');
    await settle();
    // The set's bounds run (100, 100) to (700, 200): twice the reach from the nw anchor is k = 2.
    await drag(f, 'se', 600, 100);
    assert.equal(f.commits.length, 1);
    const story = parseTextDocument(f.commits[0]!.values.textDocument).stories[0]!;
    assert.equal(story.paragraphs[0]!.paragraph!.character!.size, 40, 'twice, not four times');
    assert.equal(story.revision, 1, 'one revision for the one story');
    for (const id of ['t1', 't2']) {
      const row = (f.commits[0]!.values.boxes as Box[]).find((b) => b.id === id)!;
      assert.deepEqual(JSON.parse(String(row.textFrame)).inset, { top: 8, right: 8, bottom: 8, left: 8 }, id);
    }
  } finally { f.destroy(); }
});

test('composed text: a host that cannot write the story with the rows scales the geometry and says why', async () => {
  const f = mount([textBox('t1', 100)], { text: storyDoc(['t1']), noHistory: true });
  try {
    f.select(['t1']);
    await settle();
    press('k');
    await settle();
    await drag(f, 'se', 100, 50);
    assert.equal(f.writes(), 1, 'the geometry still commits');
    assert.deepEqual(rectOf(f.byId('t1')), [100, 100, 300, 150]);
    assert.equal(f.model('textDocument'), storyDoc(['t1']));
    assert.equal(announced(), 'Text kept its size because this host cannot edit composed text.');
  } finally { f.destroy(); }
});

test('composed text: a story the engine cannot scale keeps its size with a translated reason', async () => {
  // A story at the last revision the format allows: the Scale's revision bump is refused.
  const last = parseTextDocument(storyDoc(['t1']));
  last.stories[0]!.revision = Number.MAX_SAFE_INTEGER - 1;
  const doc = serializeTextDocument(last);
  const f = mount([textBox('t1', 100)], { text: doc });
  const warn = console.warn;
  const warned: unknown[] = [];
  console.warn = (...args: unknown[]) => { warned.push(args); };
  try {
    f.select(['t1']);
    await settle();
    press('k');
    await settle();
    await drag(f, 'se', 100, 50);
    assert.equal(f.commits.length, 0);
    assert.deepEqual(rectOf(f.byId('t1')), [100, 100, 300, 150], 'the geometry commits');
    assert.equal(f.model('textDocument'), doc, 'and the story is untouched');
    assert.equal(announced(), 'Text kept its size because the story could not be scaled.', 'never the engine message itself');
    assert.ok(warned.some((w) => String((w as unknown[])[0]).startsWith('Scale text')), 'the engine message goes to the console');
  } finally { console.warn = warn; f.destroy(); }
});

const LAYOUT_FIELDS = [{ id: 'layoutGapX', type: 'number' }, { id: 'layoutPadTop', type: 'number' }];
const container = (): Box[] => [
  { id: 'c', kind: 'box', x: 100, y: 100, w: 300, h: 200, rot: 0, layout: 'flex', layoutDirection: 'row', layoutW: 'hug', layoutH: 'fixed', layoutGapX: 10, layoutPadTop: 8 },
  { id: 'f1', kind: 'box', x: 110, y: 110, w: 60, h: 40, rot: 0, layoutOwner: 'c', frame: '', layoutOrder: 0, layoutW: 'fill', layoutH: 'fixed', fontSize: 12 },
  { id: 'a1', kind: 'box', x: 200, y: 150, w: 40, h: 20, rot: 0, layoutOwner: 'c', frame: '', layoutOrder: 1, layoutAbsolute: true, layoutX: 100, layoutY: 50, layoutAngle: 0 },
] as Box[];

test('a layout container in Scale mode keeps its layout modes, its flow child its place, and grows an absolute offset by k', async () => {
  const f = mount(container(), { layout: true, fields: LAYOUT_FIELDS });
  try {
    f.select(['c']);
    await settle();
    press('k');
    await settle();
    assert.ok(f.stageEl.querySelector('.fc-chrome .fc-group-outline'), 'the container and its children are one set');
    // The set's bounds are the container's, anchored at its nw corner: twice the reach is k = 2.
    await drag(f, 'se', 300, 200);
    assert.equal(f.writes(), 1);
    const c = f.byId('c'), f1 = f.byId('f1'), a1 = f.byId('a1');
    assert.deepEqual([c.x, c.y, c.w, c.h], [100, 100, 300, 400], 'the hug width is left to the layout; the fixed height doubles');
    assert.deepEqual([c.layoutW, c.layoutH], ['hug', 'fixed']);
    assert.deepEqual([c.layoutGapX, c.layoutPadTop], [20, 16], 'its spacing scales');
    assert.deepEqual([f1.x, f1.y, f1.w, f1.h], [110, 110, 60, 80], 'the flow child keeps its place and its fill width');
    assert.equal(f1.fontSize, 24);
    assert.deepEqual([a1.layoutX, a1.layoutY, a1.w, a1.h], [200, 100, 80, 40], "the absolute child's offset doubles in the container's axes");
    assert.equal(a1.layoutAbsolute, true);
  } finally { f.destroy(); }
});

test('in Scale mode a lone layout container still turns from its rotate handle', async () => {
  const f = mount(container(), { layout: true });
  try {
    f.select(['c']);
    await settle();
    press('k');
    await settle();
    assert.ok(f.stageEl.querySelector('.fc-chrome .fc-group-outline'), 'set chrome');
    assert.ok(f.handle('rotate'), 'with a rotate handle');
    await drag(f, 'rotate', 80, 80);
    assert.equal(f.writes(), 1, 'the turn commits');
    assert.notEqual(Number(f.byId('c').rot), 0, 'and the container turned');
  } finally { f.destroy(); }
});

test('one artboard in Scale mode keeps its own readout', async () => {
  const f = mount([
    { id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300, order: 0 },
    { id: 'b1', kind: 'box', x: 150, y: 150, w: 100, h: 50, frame: 'f1' },
    { id: 'b2', kind: 'box', x: 300, y: 150, w: 100, h: 50, frame: 'f1' },
  ] as Box[], { frame: true });
  try {
    f.select(['f1']);
    await settle();
    const readout = (): string => f.stageEl.querySelector('.fc-ctxbar [data-cx-readout]')!.textContent ?? '';
    const resize = readout();
    assert.match(resize, /^100, 100 .*400×300$/);
    press('k');
    await settle();
    assert.ok(f.stageEl.querySelector('.fc-chrome .fc-group-outline'), 'the set chrome');
    assert.equal(readout(), resize, 'the readout is the artboard, not a count of what it holds');
  } finally { f.destroy(); }
});

test('a locked layer inside an artboard stops Scale, and says so; the readout keeps its own fields', async () => {
  const f = mount([
    { id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300, order: 0 },
    { id: 'b1', kind: 'box', x: 150, y: 150, w: 100, h: 50, frame: 'f1', locked: true },
  ] as Box[], { frame: true });
  try {
    f.select(['f1']);
    await settle();
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-handle').length, 8, 'Resize: the artboard has its handles');
    press('k');
    await settle();
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-handle').length, 0, 'Scale would move the locked layer');
    assert.equal(announced(), 'Scale mode on. A locked layer in the selection keeps it from scaling.');
    const readout = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx-readout]')!;
    assert.equal(readout.getAttribute('aria-haspopup'), null, 'no Scale popover to offer');
  } finally { f.destroy(); }
});

test('the popover announces why it wrote nothing when a layer was locked after it opened', async () => {
  const f = mount([
    { id: 'a', kind: 'box', x: 100, y: 100, w: 100, h: 100, rot: 0 },
    { id: 'b', kind: 'box', x: 300, y: 100, w: 100, h: 100, rot: 0 },
  ] as Box[], { frame: true });
  try {
    f.select(['a', 'b']);
    await settle();
    f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx-readout]')!.click();
    const panel = f.stageEl.querySelector<HTMLElement>('.fc-scale-panel')!;
    assert.ok(panel);
    f.write('boxes', (f.model('boxes') as Box[]).map((b) => (b.id === 'b' ? { ...b, locked: true } : b)));
    await settle();
    const before = f.writes();
    panel.querySelector<HTMLInputElement>('input[type="number"]')!.value = '200';
    [...panel.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Apply')!.click();
    await settle();
    assert.equal(f.writes(), before, 'nothing written');
    assert.equal(announced(), 'A locked layer in the selection keeps it from scaling.');
  } finally { f.destroy(); }
});

test('Escape closes a popover open over Scale mode first, then leaves Scale, then deselects', async () => {
  const f = mount([CONTENT()]);
  try {
    f.select(['a']);
    await settle();
    press('k');
    await settle();
    f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx-readout]')!.click();
    assert.ok(f.stageEl.querySelector('.fc-scale-panel'));
    (dom.window.document.activeElement as HTMLElement | null)?.blur();
    press('Escape');
    await settle();
    assert.equal(f.stageEl.querySelector('.fc-scale-panel'), null, 'the innermost surface closes first');
    assert.equal(scaleOn(f), true, 'and Scale mode stays on');
    press('Escape');
    await settle();
    assert.equal(scaleOn(f), false, 'the next Escape leaves Scale');
    assert.ok(f.handle('se'), 'with the selection kept');
    press('Escape');
    await settle();
    assert.equal(f.handle('se'), null, 'and the one after that deselects');
  } finally { f.destroy(); }
});
