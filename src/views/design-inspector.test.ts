// SPDX-License-Identifier: MPL-2.0
/**
 * The Design INSPECTOR column (views/design-inspector.ts, plan 179 M3 slice (c)).
 *
 * Driven on a jsdom stage against an in-memory runtime that echoes writes back
 * through `getModel` (the deck-editor.test.ts pattern) - a real round-trip, so the
 * repaint memo and the one-commit-per-gesture claim are both actually exercised
 * rather than stubbed into agreement.
 *
 * The four claims worth locking down, each of which is a bug the one-slot panels had:
 *   • the section set is decided by what the selection IS, not by which button was
 *     last pressed (C3/C6: the old bar offered "Edit text" on an artboard);
 *   • one gesture is one commit, so one undo step - the More panel's sliders wrote
 *     on `input` and flooded the history;
 *   • `setInputNoHistory` is never reached (tool.ts:947 is the coalescing wrapper's
 *     escape hatch and nothing in a property column may use it) - the fake runtime
 *     fails the test if it is called at all;
 *   • the repaint is memoised on the fields the VISIBLE sections read, so an edit
 *     elsewhere in the document does not tear the column down under the user.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/design-inspector.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initDesignInspector, ARRANGE_OPS, SECTIONS_KEY } from './design-inspector.ts';
import type { DesignInspectorHandle, InspectorSection } from './design-inspector.ts';
import type { ArtboardPort, DesignGuide, DesignGuidePort, ModelPort, NarrationStatus, SelectionPort } from './design-ports.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';

// ── jsdom bootstrap ───────────────────────────────────────────────────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { Event: typeof Event; MouseEvent: typeof MouseEvent };
// `window` + getComputedStyle are needed because the column mounts the app's real
// colour picker (components/color-field.ts), which reads computed styles on mount.
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
// jsdom ships no `CSS` object, and the colour picker escapes selectors with it
// (components/color-field.test.ts installs the same shim for the same reason).
(dom.window as unknown as { CSS: { escape(s: string): string } }).CSS = {
  escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
};
globalThis.CSS = (dom.window as unknown as { CSS: typeof globalThis.CSS }).CSS;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  dom.window.setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
const fire = (el: EventTarget, type: string): void => { el.dispatchEvent(new W.Event(type, { bubbles: true })); };
const click = (el: EventTarget): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
// The collapse state is remembered device-locally, and jsdom's own localStorage is a
// SecurityError on this document's opaque origin - so the suite brings its own, which
// it can also read back and reset between mounts.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

/** One pointer event on a number cell's label handle, at `x`. */
function pointerAt(handle: HTMLElement, type: string, x: number): void {
  const e = new W.Event(type, { bubbles: true }) as unknown as Record<string, unknown>;
  Object.assign(e, { clientX: x, clientY: 0, button: 0, pointerId: 1, pointerType: 'mouse' });
  (e as unknown as { preventDefault(): void }).preventDefault = () => {};
  handle.dispatchEvent(e as unknown as Event);
}

/** Drag a number cell's label handle by `dx` pixels: press, move, and release unless told not to. */
function scrub(handle: HTMLElement, dx: number, release = true): void {
  const steps: Array<readonly [string, number]> = [['pointerdown', 0], ['pointermove', dx / 2], ['pointermove', dx]];
  if (release) steps.push(['pointerup', dx]);
  for (const [type, x] of steps) pointerAt(handle, type, x);
}

// ── the tool's own field vocabulary (community/design/tool.json `canvas`) ─────
const CFG = {
  idField: 'id', kindField: 'kind',
  xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
  fillField: 'bg', gradField: 'grad', strokeField: 'stroke', strokeWField: 'strokeW',
  opacityField: 'opacity', blendField: 'blend', radiusField: 'radius', shapeField: 'shape',
  shadowField: 'shadow', shadowColorField: 'shadowColor', shadowXField: 'shadowX', shadowYField: 'shadowY', shadowBlurField: 'shadowBlur',
  imageField: 'image', fitField: 'fit', imgPosField: 'imgpos',
  textField: 'text', textColorField: 'fg', fontField: 'font', fontSizeField: 'fontSize', weightField: 'weight',
  lineHeightField: 'lineHeight', trackingField: 'tracking', ligaturesField: 'ligatures', alternatesField: 'alternates',
  alignField: 'align', valignField: 'valign', padField: 'pad', fitTextField: 'fitText',
  startField: 'start', durField: 'dur', enterField: 'enter', exitField: 'exit',
  enterMsField: 'enterMs', exitMsField: 'exitMs', holdField: 'hold', splitField: 'split', kfField: 'kf',
  rxField: 'rx', ryField: 'ry', labelField: 'name', orderField: 'order', zField: 'z',
} as unknown as BoxFieldConfig;

const FRAME = { frameField: 'frame', frameKind: 'frame', orderField: 'order', clipChildrenField: 'clipChildren', labelField: 'name' };

const FIELDS = [
  { id: 'shape', options: [{ value: 'rect', label: 'Rectangle' }, { value: 'rounded', label: 'Rounded' }, { value: 'circle', label: 'Circle' }] },
  { id: 'shadow', options: [{ value: 'none', label: 'None' }, { value: 'box', label: 'Box' }, { value: 'depth', label: 'Depth' }] },
  { id: 'fit', options: [{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' }] },
  { id: 'blend', options: [{ value: 'normal', label: 'Normal' }, { value: 'multiply', label: 'Multiply' }] },
  { id: 'enter', options: [{ value: 'fade', label: 'Fade' }, { value: 'rise', label: 'Rise' }] },
  { id: 'exit', options: [{ value: 'fade', label: 'Fade' }, { value: 'drop', label: 'Drop' }] },
  // The three M4 appends (community/design/tool.json slots 96-98). The column draws a
  // control for each only because the manifest declares it - see `declaredField`.
  {
    id: 'slideTransition',
    options: [
      { value: '', label: 'Same as the deck' }, { value: 'slide', label: 'Slide' }, { value: 'fade', label: 'Fade' },
      { value: 'morph', label: 'Morph' }, { value: 'flight', label: 'Fly between artboards' },
      { value: 'none', label: 'Cut' }, { value: 'custom', label: 'Custom (set in the timeline)' },
    ],
  },
  { id: 'hidden' },
  { id: 'locked' },
];

const BOXES: Box[] = [
  { id: 'f1', kind: 'frame', name: 'Title', x: 0, y: 0, w: 1600, h: 900, order: 0, bg: '#ffffff', notes: 'say hello' },
  { id: 'b1', kind: 'box', frame: 'f1', x: 40, y: 60, w: 300, h: 200, bg: '#123456', opacity: 100, shape: 'rounded' },
  { id: 't1', kind: 'text', frame: 'f1', x: 10, y: 20, w: 400, h: 90, text: 'Hello', fontSize: 48, font: 'sans', weight: '700' },
  { id: 'i1', kind: 'image', frame: 'f1', x: 0, y: 0, w: 200, h: 200, image: { id: 'lolly/logo/primary' }, fit: 'contain', imgpos: 'center' },
];

interface Harness {
  handle: DesignInspectorHandle;
  el: HTMLElement;
  boxes(): Box[];
  select(ids: string[]): void;
  /** Mutate the rows the way the canvas / navigator / timeline would, then notify. */
  poke(fn: (rows: Box[]) => Box[]): void;
  commits: Array<{ ids: string[]; field: string; value: unknown }>;
  /** Whole-array commits - the one undo step a multi-field patch (Appears) writes. */
  arrays: Box[][];
  setInputs: Array<[string, unknown]>;
  calls: Record<string, unknown[][]>;
  noHistory: number;
}

function mount(initial: Box[] = BOXES, extra: Partial<Parameters<typeof initDesignInspector>[0]> = {}, keepPrefs = false): Harness {
  // Every mount starts from "the user has said nothing yet" unless a test seeds the
  // store itself: the collapse state outlives an instance on purpose.
  if (!keepPrefs) store.delete(SECTIONS_KEY);
  document.body.innerHTML = '<div id="stage"><div id="tool-canvas"></div></div>';
  const stageEl = document.getElementById('stage')!;
  const canvasEl = document.getElementById('tool-canvas')!;
  canvasEl.style.width = '1600px';
  canvasEl.style.height = '900px';

  let rows: Box[] = initial.map((b) => ({ ...b }));
  let background: unknown = '#0b1220';
  const subs: Array<() => void> = [];
  const emit = (): void => { subs.slice().forEach((f) => f()); };

  const commits: Harness['commits'] = [];
  const arrays: Harness['arrays'] = [];
  const setInputs: Harness['setInputs'] = [];
  let noHistory = 0;

  const model: ModelPort & { setInputNoHistory(): void } = {
    blockId: 'boxes',
    cfg: CFG,
    frame: FRAME,
    getBoxes: () => rows,
    commit: (next) => { arrays.push(next); rows = next; emit(); },
    setField: (ids, field, value) => {
      commits.push({ ids: [...ids], field, value });
      const want = new Set(ids);
      rows = rows.map((b, i) => (want.has(String(b.id ?? i)) ? { ...b, [field]: value as never } : b));
      emit();
    },
    subscribe: (cb) => { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; },
    getInput: (id) => (id === 'background' ? background : undefined),
    setInput: (id, value) => { setInputs.push([id, value]); if (id === 'background') background = value; emit(); },
    // Not on ModelPort - present only so the suite can prove nothing reaches it.
    setInputNoHistory: () => { noHistory += 1; },
  };

  let selIds: string[] = [];
  const selSubs: Array<(ids: string[]) => void> = [];
  const selection: SelectionPort = {
    get: () => [...selIds],
    set: (ids) => { selIds = [...ids]; selSubs.slice().forEach((f) => f([...selIds])); },
    onChange: (cb) => { selSubs.push(cb); return () => { const i = selSubs.indexOf(cb); if (i >= 0) selSubs.splice(i, 1); }; },
  };

  const artSubs: Array<(id: string) => void> = [];
  const artboard: ArtboardPort = {
    active: () => 'f1',
    focus: () => {},
    onChange: (cb) => { artSubs.push(cb); return () => { const i = artSubs.indexOf(cb); if (i >= 0) artSubs.splice(i, 1); }; },
  };

  const calls: Record<string, unknown[][]> = { pickImage: [], openGradient: [], arrange: [], openTimeline: [] };
  const handle = initDesignInspector({
    stageEl, canvasEl, model, selection, artboard,
    actions: {
      pickImage: (ids) => calls.pickImage!.push([ids]),
      openGradient: (ids) => calls.openGradient!.push([ids]),
      arrange: (op) => calls.arrange!.push([op]),
      openTimeline: (group, id) => calls.openTimeline!.push([group, id]),
    },
    fields: FIELDS,
    fonts: { options: () => [['sans', 'Sans'], ['mono', 'Mono']], weights: (f) => (f === 'mono' ? [['400', 'Regular']] : [['400', 'Regular'], ['700', 'Bold']]) },
    ...extra,
  });

  // The panel is built DETACHED now (the host docks it into the one right sidebar), so
  // the harness plays the host and gives it a slot - focus and scroll only work for an
  // element that is actually in the document.
  const slot = document.createElement('div');
  slot.className = 'edge-dock-slot';
  stageEl.appendChild(slot);
  slot.appendChild(handle.el);

  const h = {
    handle, el: handle.el,
    boxes: () => rows,
    select: (ids: string[]) => selection.set(ids),
    poke: (fn: (r: Box[]) => Box[]) => { rows = fn(rows.map((b) => ({ ...b }))); emit(); },
    commits, arrays, setInputs, calls,
    get noHistory() { return noHistory; },
  } as unknown as Harness;
  return h;
}

const secs = (h: Harness): string[] => [...h.el.querySelectorAll<HTMLElement>('.fc-insp-sec')].map((s) => s.dataset.sec!);
const row = (h: Harness, sel: string): HTMLElement => h.el.querySelector<HTMLElement>(sel)!;
/** The number cell that writes `field` - components/num-field.ts keys them by it. */
const num = (h: Harness, field: string): HTMLInputElement => h.el.querySelector<HTMLInputElement>(`input[data-nf="f:${field}"]`)!;
/** Type into a number cell and commit it the way Enter does. */
function typeNum(h: Harness, field: string, text: string): void {
  const inp = num(h, field);
  inp.value = text;
  fire(inp, 'input');
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}
/** Every section head, by section id, expanded or not. */
const openSecs = (h: Harness): string[] => [...h.el.querySelectorAll<HTMLElement>('.fc-insp-head')]
  .filter((b) => b.getAttribute('aria-expanded') === 'true').map((b) => b.dataset.head!);

// ── section visibility per kind ───────────────────────────────────────────────

test('empty selection shows only Document: canvas size, background, and why nothing else is here', () => {
  const h = mount();
  assert.deepEqual(secs(h), ['document']);
  const check = h.el.querySelector<HTMLElement>('[data-design-check]');
  assert.equal(check?.dataset.designCheck, 'clean');
  assert.match(check?.textContent ?? '', /1 Artboard · 3 Layers/);
  assert.match(h.el.textContent!, /1600 x 900 px/);
  assert.ok(h.el.querySelector('[data-color-field]'), 'the background swatch is a real colour field');
  assert.match(h.el.textContent!, /Select something to edit its properties\./);
  h.handle.destroy();
});

test('Document health refreshes from the shared structural inspection model', () => {
  const h = mount();
  h.poke((boxes) => [...boxes, { id: 't1', kind: 'text', frame: 'missing', x: 0, y: 0, w: 0, h: 20, text: '' }]);
  const check = h.el.querySelector<HTMLElement>('[data-design-check]');
  assert.equal(check?.dataset.designCheck, 'error');
  assert.match(check?.textContent ?? '', /Layer id "t1" is duplicated/);
  assert.match(check?.textContent ?? '', /missing artboard "missing"/);
  h.handle.destroy();
});

test('Document health merges settled mounted overflow, contrast and vector-font findings', async () => {
  const h = mount(BOXES, { resolveFont: async () => false });
  const canvas = document.getElementById('tool-canvas')!;
  canvas.style.backgroundColor = 'rgb(255, 255, 255)';
  canvas.innerHTML = `<div class="lolly-box" data-box-id="t1">
    <div class="lolly-box-text" style="color:rgb(180, 180, 180);font:400 16px 'Missing Face'">Hello</div>
  </div>`;
  const box = canvas.querySelector<HTMLElement>('.lolly-box')!;
  const text = canvas.querySelector<HTMLElement>('.lolly-box-text')!;
  Object.defineProperties(box, {
    clientWidth: { configurable: true, value: 200 },
    clientHeight: { configurable: true, value: 60 },
  });
  Object.defineProperties(text, {
    scrollWidth: { configurable: true, value: 260 },
    scrollHeight: { configurable: true, value: 40 },
  });
  fire(canvas, 'lolly-canvas-painted');
  await new Promise((resolve) => setTimeout(resolve, 10));

  const check = h.el.querySelector<HTMLElement>('[data-design-check]');
  assert.equal(check?.dataset.designCheck, 'warn');
  assert.match(check?.textContent ?? '', /Text in “Hello” is clipped/);
  assert.match(check?.textContent ?? '', /contrast/);
  assert.match(check?.textContent ?? '', /cannot be embedded in vector exports/);
  h.handle.destroy();
});

test('a frame shows Artboard / Present / Motion - never Object or Text', () => {
  const h = mount();
  h.select(['f1']);
  assert.deepEqual(secs(h), ['artboard', 'present', 'motion']);
  // The artboard's own fields, not a box's: name, size, fill, notes, order.
  assert.equal(row(h, '[data-fld="name"]').getAttribute('value'), 'Title');
  assert.equal(num(h, 'w').value, '1600');
  assert.match(h.el.querySelector('[data-fld="notes"]')!.textContent!, /say hello/);
  h.handle.destroy();
});

test('a plain box shows Object and its paint groups, then Motion + Present; no Text and no Image', () => {
  const h = mount();
  h.select(['b1']);
  // The five groups that used to be sub-headings inside one flat Object list are
  // sections of their own now, each one collapsible on its own (Andy, 2026-09-03).
  // Present is LAST and carries only the three fields a BOX owns - `build`, `matchOf`
  // and `presentAudio`, which the hook reads off child boxes and nowhere else.
  assert.deepEqual(secs(h), ['object', 'fill', 'appearance', 'shadow', 'tilt', 'arrange', 'motion', 'present']);
  assert.ok(num(h, 'build'), 'the build step is editable where it works');
  assert.ok(h.el.querySelector('[data-fld="matchOf"]'), 'and so is the morph match');
  assert.equal(h.el.querySelector('[data-fld="state"]'), null, 'Slide style is a FRAME field - not here');
  h.handle.destroy();
});

test('a text box adds Text; an image box adds Image, with the 3x3 position grid', () => {
  const h = mount();
  h.select(['t1']);
  assert.deepEqual(secs(h), ['object', 'fill', 'appearance', 'shadow', 'tilt', 'arrange', 'text', 'motion', 'present']);
  assert.ok(h.el.querySelector('select[data-fld="font"]'), 'font select');
  h.select(['i1']);
  assert.deepEqual(secs(h), ['object', 'fill', 'appearance', 'shadow', 'tilt', 'arrange', 'image', 'motion', 'present']);
  assert.equal(h.el.querySelectorAll('.fc-posgrid .fc-pos-btn').length, 9);
  h.handle.destroy();
});

test('a multi-selection shows the paint groups only, and the column head carries the count', () => {
  const h = mount();
  h.select(['b1', 't1']);
  // No Object (position and size are per-box answers) and no Tilt (same reason). The
  // count moved to the column head when Object stopped being one section that could
  // carry it.
  assert.deepEqual(secs(h), ['fill', 'appearance', 'shadow', 'arrange']);
  assert.match(h.el.querySelector('.fc-insp-coltitle')!.textContent!, /2 selected/);
  // X/Y/W/H read the FIRST box and write them ALL, so they are not offered here.
  assert.equal(h.el.querySelector('input[data-nf="f:x"]'), null);
  assert.ok(h.el.querySelector('[data-fld="bg"], #fc-insp-fill, [data-color-field]'), 'fill still offered');
  h.select(['b1']);
  assert.match(h.el.querySelector('.fc-insp-coltitle')!.textContent!, /Inspector/, 'and it goes back');
  h.handle.destroy();
});

// ── writes ────────────────────────────────────────────────────────────────────

test('a fill edit calls setField exactly once, across the whole selection', () => {
  const h = mount();
  h.select(['b1', 't1']);
  const hex = h.el.querySelector<HTMLInputElement>('[data-color-field="fc-insp-fill"] .color-input[data-color-hex]')!;
  hex.value = '#ff0000';
  fire(hex, 'input');
  const fills = h.commits.filter((c) => c.field === 'bg');
  assert.equal(fills.length, 1, 'one commit, one undo step');
  assert.deepEqual(fills[0]!.ids, ['b1', 't1']);
  assert.equal(h.boxes().find((b) => b.id === 't1')!.bg, fills[0]!.value);
  h.handle.destroy();
});

test('the colour popover survives its own commits - the picker is not single-click', async () => {
  // The picker emits on EVERY change (each swatch, each slider `input`), so the
  // commit's model echo came straight back and `scroll.innerHTML = …` deleted the
  // popover the user was standing in - with its mode tabs, alpha row, eyedropper and
  // sliders - one gesture in. A rebuild is now held off while a popover is open.
  const h = mount();
  h.select(['b1']);
  const field = h.el.querySelector<HTMLElement>('[data-color-field="fc-insp-fill"]')!;
  click(field.querySelector<HTMLElement>('[data-color-trigger]')!);
  const pop = field.querySelector<HTMLElement>('.color-popover')!;
  assert.equal(pop.hidden, false, 'the popover opened');
  await new Promise((r) => setTimeout(r, 1));           // the picker arms its outside-click on a tick

  const hex = pop.querySelector<HTMLInputElement>('.color-input[data-color-hex]')!;
  hex.value = '#ff0000'; fire(hex, 'input');
  assert.equal(h.commits.length, 1);
  assert.ok(h.el.contains(pop), 'the popover the user is working in is still mounted');
  assert.equal(pop.hidden, false);
  hex.value = '#00ff00'; fire(hex, 'input');            // a second edit in the same gesture
  assert.equal(h.commits.length, 2, 'and it can still be edited');
  assert.equal(h.boxes().find((b) => b.id === 'b1')!.bg, h.commits[1]!.value);

  // Closing it releases the deferral: the picker's own outside-click handler closes on
  // a document pointerdown, and the column re-checks once the gesture has settled.
  fire(document, 'pointerdown');
  fire(document, 'pointerup');
  await new Promise((r) => setTimeout(r, 2));
  assert.equal(h.el.contains(pop), false, 'the deferred rebuild ran once the popover was gone');
  h.handle.destroy();
});

test('a text edit (the CSS class field) commits once, on change, not per keystroke', () => {
  const h = mount();
  h.select(['b1']);
  const inp = row(h, 'input[data-fld="cls"]') as HTMLInputElement;
  inp.value = 'call';
  fire(inp, 'input');
  inp.value = 'callout';
  fire(inp, 'input');
  assert.equal(h.commits.length, 0, 'typing writes nothing');
  fire(inp, 'change');
  assert.deepEqual(h.commits.map((c) => [c.field, c.value]), [['cls', 'callout']]);
  h.handle.destroy();
});

test('a text commit lands on the row it was TYPED INTO, not on whatever is selected at blur', async () => {
  // The bug: `write()` resolved its target from the live selection when the event
  // fired. A textarea commits on `change` (at blur) and the rebuild is deferred while
  // the caret is in the column, so the row outlived its selection - clicking a box on
  // the canvas mid-sentence deleted the slide's speaker notes and stamped them onto
  // the box, in one undo step labelled as a box edit.
  const h = mount();
  h.select(['f1']);
  const notes = row(h, 'textarea[data-fld="notes"]') as HTMLTextAreaElement;
  notes.focus();
  notes.value = 'slide one script';
  h.select(['b1']);                       // a canvas pointerdown: the handler runs first, the caret stays
  assert.equal(document.activeElement, notes, 'the deferred rebuild left the row mounted');
  fire(notes, 'change');
  assert.deepEqual(h.commits.map((c) => [c.ids, c.field, c.value]), [[['f1'], 'notes', 'slide one script']]);
  assert.equal(h.boxes().find((b) => b.id === 'f1')!.notes, 'slide one script');
  assert.equal(h.boxes().find((b) => b.id === 'b1')!.notes, undefined, 'the box the user clicked is untouched');
  // And once the caret leaves, the column catches up with the selection it missed.
  notes.blur();
  await new Promise((r) => setTimeout(r, 1));
  assert.deepEqual(secs(h), ['object', 'fill', 'appearance', 'shadow', 'tilt', 'arrange', 'motion', 'present']);
  h.handle.destroy();
});

test('a door opens on the rows it is mounted for, not on a selection that moved under it', async () => {
  const h = mount();
  h.select(['i1']);
  const cls = row(h, 'input[data-fld="cls"]') as HTMLInputElement;
  cls.focus();                            // holds the rebuild off, exactly as typing does
  h.select(['b1']);
  click(h.el.querySelector('[data-act="pickimage"]')!);
  assert.deepEqual(h.calls.pickImage, [[['i1']]], 'the Image section belongs to i1');
  cls.blur();
  await new Promise((r) => setTimeout(r, 1));
  h.handle.destroy();
});

test('a slider and its number are one control: the drag mirrors, the release commits once', () => {
  const h = mount();
  h.select(['b1']);
  const rng = row(h, 'input[type="range"][data-fld="opacity"]') as HTMLInputElement;
  rng.value = '55';
  fire(rng, 'input');
  assert.equal(num(h, 'opacity').value, '55', 'the number follows the thumb');
  assert.equal(h.commits.length, 0, 'a drag is not sixty undo steps');
  fire(rng, 'change');
  assert.deepEqual(h.commits.map((c) => [c.field, c.value]), [['opacity', 55]]);
  h.handle.destroy();
});

test('a number cell floors W at 1 and takes an expression', () => {
  const h = mount();
  h.select(['b1']);
  typeNum(h, 'w', '0');
  assert.deepEqual(h.commits.map((c) => [c.field, c.value]), [['w', 1]], 'clamped to the field it was built with');
  h.commits.length = 0;
  typeNum(h, 'w', '1920/2');
  assert.deepEqual(h.commits.map((c) => [c.field, c.value]), [['w', 960]]);
  h.commits.length = 0;
  typeNum(h, 'w', '+40');
  assert.deepEqual(h.commits.map((c) => [c.field, c.value]), [['w', 1000]], 'relative to what is already there');
  h.handle.destroy();
});

test('a segmented control writes the field it carries (a manifest-declared `depth` shadow included)', () => {
  const h = mount();
  h.select(['b1']);
  const depth = h.el.querySelector<HTMLButtonElement>('.fc-seg[data-seg="shadow"] .fc-seg-btn[data-v="depth"]')!;
  click(depth);
  assert.deepEqual(h.commits.map((c) => [c.field, c.value]), [['shadow', 'depth']]);
  assert.ok(depth.classList.contains('is-on'));
  h.handle.destroy();
});

test('the A- / A+ steppers step the size of the whole selection in one commit', () => {
  const h = mount();
  h.select(['t1']);
  click(h.el.querySelector('[data-act="bigger"]')!);
  assert.deepEqual(h.commits.map((c) => [c.field, c.value]), [['fontSize', 54]]);
  h.handle.destroy();
});

test('the doors delegate rather than reaching into the overlay', () => {
  const h = mount();
  h.select(['i1']);
  click(h.el.querySelector('[data-act="pickimage"]')!);
  click(h.el.querySelector('[data-act="gradient"]')!);
  click(h.el.querySelector('[data-act="timeline"]')!);
  assert.deepEqual(h.calls.pickImage, [[['i1']]]);
  assert.deepEqual(h.calls.openGradient, [[['i1']]]);
  assert.deepEqual(h.calls.openTimeline, [['animate', 'i1']]);
  assert.equal(h.commits.length, 0, 'a door writes nothing itself');
  h.handle.destroy();
});

test('Arrange buttons report the overlay op names, and the ones that need more boxes are disabled not hidden', () => {
  const h = mount();
  h.select(['b1']);
  const ops = [...h.el.querySelectorAll<HTMLButtonElement>('[data-arr]')].map((b) => b.dataset.arr!);
  assert.deepEqual(ops, [...ARRANGE_OPS]);
  assert.equal(h.el.querySelector<HTMLButtonElement>('[data-arr="h"]')!.disabled, true, 'distribute needs three');
  assert.equal(h.el.querySelector<HTMLButtonElement>('[data-arr="group"]')!.disabled, true, 'group needs two');
  click(h.el.querySelector('[data-arr="hcentre"]')!);
  assert.deepEqual(h.calls.arrange, [['hcentre']]);
  // Every icon-only control announces itself.
  for (const b of h.el.querySelectorAll<HTMLButtonElement>('[data-arr]')) assert.ok(b.getAttribute('aria-label'), `${b.dataset.arr} has a name`);
  h.handle.destroy();
});

test('the Present section writes the non-cfg frame fields by their literal names', () => {
  const h = mount();
  h.select(['f1']);
  const state = row(h, 'input[data-fld="state"]') as HTMLInputElement;
  state.value = 'dark';
  fire(state, 'change');
  assert.deepEqual(h.commits.map((c) => c.field), ['state']);
  h.handle.destroy();
});

test("a frame's Present section offers only the fields a frame OWNS", () => {
  // The split that matters: `state`, `notes` and `stackOf` are frame fields, while
  // `build`, `matchOf` and `presentAudio` are read off CHILD BOXES (hooks.js emits
  // `data-build` / `data-match` per child and `presentAudio` in the video branch).
  // Offering all six on a slide meant "Build step 2" was written to the frame row,
  // where nothing reads it: the control looked live and did nothing at all.
  const h = mount();
  h.select(['f1']);
  assert.ok(h.el.querySelector('[data-fld="state"]'), 'Slide style is the frame\'s own');
  assert.match(h.el.querySelector('[data-rows="present"] .fc-insp-read')!.textContent!, /Stack/);
  for (const f of ['build', 'matchOf', 'presentAudio']) {
    assert.equal(h.el.querySelector(`[data-fld="${f}"]`), null, `"${f}" is a per-box field, not a frame one`);
  }
  h.handle.destroy();
});

// ── narration (plans/180 section 8) ───────────────────────────────────────────

/** A narration port whose status is scripted per frame, recording every verb it is asked for. */
function narrationFake(status: Record<string, NarrationStatus> = {}) {
  const calls: string[] = [];
  return {
    calls,
    port: {
      narrateAll: () => { calls.push('all'); },
      narrateFrame: (id: string) => { calls.push(`one:${id}`); },
      status: (id: string): NarrationStatus => status[id] ?? 'none',
      set: (id: string, st: NarrationStatus) => { status[id] = st; },
    },
  };
}

test('speaker notes live in the Present section, with the button that speaks them under it', () => {
  // Plan 180 section 8: notes and Narrate are one control apart, and `notes` still has
  // exactly ONE door - Artboard must not keep a second copy of the textarea.
  const n = narrationFake({ f1: 'pending' });
  const h = mount(BOXES, { narration: n.port });
  h.select(['f1']);
  const rows = h.el.querySelector<HTMLElement>('[data-rows="present"]')!;
  assert.ok(rows.querySelector('textarea[data-fld="notes"]'), 'the notes are in Present');
  assert.equal(h.el.querySelector('[data-rows="artboard"] [data-fld="notes"]'), null, 'and nowhere else');
  assert.equal(h.el.querySelectorAll('[data-fld="notes"]').length, 1, 'one door onto the field');
  assert.equal(rows.querySelector('[data-narration]')!.textContent, 'Not narrated yet.');
  const btn = rows.querySelector<HTMLButtonElement>('[data-act="narrate"]')!;
  assert.match(btn.textContent!, /Narrate this slide/);
  click(btn);
  assert.deepEqual(n.calls, ['one:f1'], 'the slide the row was built for, once');
  h.handle.destroy();
});

test('the Narrate row says which of the four states this slide is in', () => {
  const n = narrationFake({ f1: 'current' });
  const h = mount(BOXES, { narration: n.port });
  h.select(['f1']);
  const rows = (): HTMLElement => h.el.querySelector<HTMLElement>('[data-rows="present"]')!;
  assert.equal(rows().querySelector('[data-narration]')!.getAttribute('data-narration'), 'current');
  assert.equal(rows().querySelector('[data-narration]')!.textContent, 'Narrated from these notes.');
  assert.match(rows().querySelector('[data-act="narrate"]')!.textContent!, /again/, 're-narrating is a different verb');

  // Stale is the state the whole feature turns on: it has to be readable, not a colour.
  n.port.set('f1', 'stale');
  h.poke((r) => r.map((b) => (b.id === 'f1' ? { ...b, notes: 'a new script' } : b)));
  assert.equal(rows().querySelector('[data-narration]')!.textContent,
    'The notes changed after this slide was narrated.');

  // Nothing to say, nothing to press.
  n.port.set('f1', 'none');
  h.poke((r) => r.map((b) => (b.id === 'f1' ? { ...b, notes: '' } : b)));
  assert.equal(rows().querySelector('[data-act="narrate"]'), null);
  h.handle.destroy();
});

test('a narrate that moves no watched field still repaints the Present section', () => {
  // The failure this exists for: a slide whose authored dwell already exceeded the
  // narration floor comes back from a successful narrate with `dur` and `start` exactly
  // as they were. Narration status lives on the CLIP's asset meta, which is no field of
  // the selected row, so the repaint memo saw nothing move and the column kept saying
  // "Not narrated yet." beside a navigator dot that already said narrated.
  const n = narrationFake({ f1: 'pending' });
  const h = mount(BOXES, { narration: n.port });
  h.select(['f1']);
  const said = (): string => h.el.querySelector('[data-rows="present"] [data-narration]')!.textContent!;
  assert.equal(said(), 'Not narrated yet.');
  n.port.set('f1', 'current');
  h.poke((r) => r);   // the model echo of a commit that changed no value at all
  assert.equal(said(), 'Narrated from these notes.');
  assert.match(h.el.querySelector('[data-act="narrate"]')!.textContent!, /again/);
  h.handle.destroy();
});

test('with no narration port the Present section keeps the notes and grows no button', () => {
  const h = mount();
  h.select(['f1']);
  assert.ok(h.el.querySelector('[data-rows="present"] textarea[data-fld="notes"]'));
  assert.equal(h.el.querySelector('[data-act="narrate"]'), null, 'a button that cannot work is not offered');
  assert.equal(h.el.querySelector('[data-doc-voice], [data-doc="narrationVoice"]'), null, 'and the document settings stay away too');
  h.handle.destroy();
});

test('a live outcome gate hides carousel narration while keeping speaker notes', () => {
  const n = narrationFake({ f1: 'pending' });
  let enabled = true;
  const h = mount(BOXES, { narration: n.port, narrationEnabled: () => enabled });
  h.select(['f1']);
  assert.ok(h.el.querySelector('[data-act="narrate"]'));
  enabled = false;
  h.handle.sync();
  assert.equal(h.el.querySelector('[data-act="narrate"]'), null);
  assert.ok(h.el.querySelector('[data-rows="present"] textarea[data-fld="notes"]'), 'notes remain ordinary document content');
  h.select([]);
  assert.equal(h.el.querySelector('[data-doc-voice], [data-doc="narrationVoice"]'), null, 'document narration settings are gone too');
  h.handle.destroy();
});

test('the document narration settings write TOP-LEVEL inputs, never the selected rows', () => {
  const n = narrationFake();
  const h = mount(BOXES, { narration: n.port });
  h.select([]);   // the Document section is what an empty selection shows
  // The voice is a PICKER (Andy, 2026-09-03), holding the engine default until the
  // bridge's list arrives; a second picker composes a blend into the one input.
  const voice = row(h, 'select[data-doc-voice="main"]') as HTMLSelectElement;
  assert.equal(voice.value, 'bf_lily', 'the engine default');
  const blend = row(h, 'select[data-doc-voice="blend"]') as HTMLSelectElement;
  assert.equal(blend.value, '', 'no blend to begin with');
  blend.appendChild(new (h.el.ownerDocument.defaultView as typeof globalThis).Option('Heart', 'af_heart'));
  blend.value = 'af_heart';
  fire(blend, 'change');
  assert.deepEqual(h.setInputs, [['narrationVoice', 'bf_lily+af_heart:0.30']], 'a blend, composed the way the engine reads it');
  assert.deepEqual(h.commits, [], 'no box field was written');

  // The fields show seconds (plans/184 R7) and store ms: a typed '250ms' converts, a
  // bare 0.9 is the field's own unit.
  typeNum(h, 'narrationLeadInMs', '250ms');
  typeNum(h, 'narrationTailMs', '0.9');
  const cap = row(h, 'input[data-doc="showCaptionsWhenPresenting"]') as HTMLInputElement;
  cap.checked = true;
  fire(cap, 'change');
  assert.deepEqual(h.setInputs.slice(1), [
    ['narrationLeadInMs', 250], ['narrationTailMs', 900], ['showCaptionsWhenPresenting', true],
  ]);
  assert.deepEqual(h.commits, [], 'still nothing on the boxes');
  h.handle.destroy();
});

test('a multi-selection gets no Present section - a build step is a per-object answer', () => {
  const h = mount();
  h.select(['b1', 't1']);
  assert.ok(!secs(h).includes('present'), 'stamping one box\'s build step across a selection is not an edit anyone asked for');
  h.handle.destroy();
});

// ── the M4 controls: the per-slide transition, Appears, the two layer flags ───

/** A number cell that writes no single field - keyed by its label (see `numCell`). */
const cell = (h: Harness, key: string): HTMLInputElement => h.el.querySelector<HTMLInputElement>(`input[data-nf="${key}"]`)!;
/** The Appears segments, and which one is pressed. */
const appear = (h: Harness, v: string): HTMLButtonElement =>
  h.el.querySelector<HTMLButtonElement>(`.fc-seg[data-seg="lolly-appear"] .fc-seg-btn[data-v="${v}"]`)!;
const appearMode = (h: Harness): string | undefined =>
  [...h.el.querySelectorAll<HTMLElement>('.fc-seg[data-seg="lolly-appear"] .fc-seg-btn')]
    .find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.v;

test('the Artboard section carries this slide\'s own transition, with the manifest\'s options', () => {
  const h = mount();
  h.select(['f1']);
  const sel = row(h, 'select[data-fld="slideTransition"]') as HTMLSelectElement;
  assert.deepEqual([...sel.options].map((o) => o.value), ['', 'slide', 'fade', 'morph', 'flight', 'none', 'custom'],
    'the wire values are the manifest\'s, so the picker and the players cannot drift');
  assert.equal(sel.value, '', 'nothing set means the deck still answers for this slide');
  sel.value = 'morph';
  fire(sel, 'change');
  assert.deepEqual(h.commits, [{ ids: ['f1'], field: 'slideTransition', value: 'morph' }]);
  assert.equal(h.boxes().find((b) => b.id === 'f1')!.slideTransition, 'morph');
  h.handle.destroy();
});

test('the way out of `custom` shows only once the timeline has set it', () => {
  const h = mount();
  h.select(['f1']);
  assert.equal(h.el.querySelector('[data-act="resettrans"]'), null, 'nothing to reset while the deck is in charge');
  // `custom` is the one value no picker here can produce: the timeline writes it when a
  // frame's enter/exit are edited by hand. Without this row the only way back to the
  // deck's own transition would be another timeline edit.
  h.poke((rows) => rows.map((b) => (b.id === 'f1' ? { ...b, slideTransition: 'custom' } : b)));
  const reset = h.el.querySelector<HTMLButtonElement>('[data-act="resettrans"]')!;
  assert.ok(reset, 'the reset row appears with the value it clears');
  click(reset);
  assert.deepEqual(h.commits, [{ ids: ['f1'], field: 'slideTransition', value: '' }]);
  assert.equal(h.el.querySelector('[data-act="resettrans"]'), null, 'and goes again with it');
  h.handle.destroy();
});

test('Appears: one press writes the EXCLUSIVE patch, as one undo step', () => {
  const h = mount(BOXES.map((b) => (b.id === 'b1' ? { ...b, start: 2, dur: 3, lane: 'seq' } : b)));
  h.select(['b1']);
  assert.equal(appearMode(h), 'time', 'a start (and a lane) is a timed box');
  click(appear(h, 'click'));
  assert.equal(h.arrays.length, 1, 'four fields at once is ONE commit');
  assert.equal(h.commits.length, 0, 'and never four setField calls, which would be four undo steps');
  const b1 = h.boxes().find((b) => b.id === 'b1')!;
  assert.deepEqual([b1.build, b1.start, b1.dur, b1.lane], [1, '', '', ''],
    'the other two ways of appearing are cleared with \'\', which is what the URL codec writes');
  assert.equal(appearMode(h), 'click');
  assert.match(h.el.querySelector('[data-rows="motion"] .fc-insp-chip')!.textContent!, /On click, step 1/);
  // …and the step the mode owns is editable in place, through the same one patch.
  const step = cell(h, 'k:Step');
  assert.equal(step.value, '1');
  step.value = '3';
  fire(step, 'input');
  step.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(h.boxes().find((b) => b.id === 'b1')!.build, 3);
  assert.equal(h.arrays.length, 2, 'one gesture, one more commit');
  h.handle.destroy();
});

test('Appears: a time keeps the lane the timeline gave the box', () => {
  const h = mount(BOXES.map((b) => (b.id === 'b1' ? { ...b, build: 2, lane: 'seq' } : b)));
  h.select(['b1']);
  // Build WINS on a box carrying both, because all three players already read it first.
  assert.equal(appearMode(h), 'click');
  assert.equal(cell(h, 'k:Step').value, '2');
  click(appear(h, 'time'));
  const b1 = h.boxes().find((b) => b.id === 'b1')!;
  assert.deepEqual([b1.build, b1.start, b1.lane], ['', 0, 'seq'],
    'a sequence clip stays a clip: only the WAYS of appearing are exclusive');
  // The two cells that mode owns, and neither of them the other mode's.
  assert.ok(cell(h, 'k:At'), 'a start');
  assert.ok(cell(h, 'k:For'), 'and a length');
  assert.equal(h.el.querySelector('input[data-nf="k:Step"]'), null, 'the step is not offered for a timed box');
  h.handle.destroy();
});

test('a FRAME\'s Enter/Exit stamps slideTransition custom, in the same commit', () => {
  // The timeline's copy of these two selects already stamps it; the inspector's did not,
  // so `slideTransition` stayed '' and the next "Place in order" counted the frame as
  // unauthored and derived the deck's pair straight over a hand-set Cut. It also meant
  // the navigator chip and its "Reset to the deck transition" row never appeared for an
  // edit made here - two doors onto one field showing two different states.
  const h = mount(BOXES);
  h.select(['f1']);
  const sel = h.el.querySelector<HTMLSelectElement>('select[data-fld="enter"]')!;
  sel.value = 'rise';
  fire(sel, 'change');
  const f1 = h.boxes().find((b) => b.id === 'f1')!;
  assert.equal(f1.enter, 'rise');
  assert.equal(f1.slideTransition, 'custom', 'the deck stops deriving over a pair set by hand');
  assert.equal(h.arrays.length, 1, 'ONE commit: the pair and the override are one edit');
  assert.equal(h.commits.length, 0, 'and it is a whole-array commit, not a single setField');

  const ex = h.el.querySelector<HTMLSelectElement>('select[data-fld="exit"]')!;
  ex.value = 'drop';
  fire(ex, 'change');
  assert.equal(h.boxes().find((b) => b.id === 'f1')!.slideTransition, 'custom', 'the exit says it too');
  h.handle.destroy();
});

test('the custom stamp never reaches an ordinary box, or a field that is not the pair', () => {
  const h = mount(BOXES);
  h.select(['b1']);
  const sel = h.el.querySelector<HTMLSelectElement>('select[data-fld="enter"]')!;
  sel.value = 'rise';
  fire(sel, 'change');
  assert.equal('slideTransition' in h.boxes().find((b) => b.id === 'b1')!, false,
    'a box has no transition to the next slide at all');
  assert.equal(h.commits.at(-1)!.field, 'enter', 'so it stays an ordinary one-field write');
  h.handle.destroy();
});

test('Appears: back to the slide clears everything, and a FRAME is never offered it', () => {
  const h = mount(BOXES.map((b) => (b.id === 'b1' ? { ...b, build: 2, start: 1, dur: 2 } : b)));
  h.select(['b1']);
  click(appear(h, 'slide'));
  const b1 = h.boxes().find((b) => b.id === 'b1')!;
  assert.deepEqual([b1.build, b1.start, b1.dur, b1.lane], ['', '', '', '']);
  assert.match(h.el.querySelector('[data-rows="motion"] .fc-insp-chip')!.textContent!, /With the slide/);
  // A slide arrives when the deck reaches it, and clearing a frame's own start and dur
  // would retime the deck - so the control is a per-BOX one.
  h.select(['f1']);
  assert.equal(h.el.querySelector('.fc-seg[data-seg="lolly-appear"]'), null);
  h.handle.destroy();
});

test('Motion opens itself for a box that does not just show up with the slide', () => {
  const h = mount(BOXES.map((b) => (b.id === 'b1' ? { ...b, build: 2 } : b)));
  h.select(['b1']);
  assert.ok(openSecs(h).includes('motion'), 'a build step is the only explanation for a box that is not there yet');
  h.select(['t1']);
  assert.ok(!openSecs(h).includes('motion'), 'and it closes again for one that appears with the slide');
  h.handle.destroy();
});

test('the Object section carries the two layer flags, one commit each', () => {
  const h = mount();
  h.select(['b1']);
  const hide = row(h, '[data-rows="object"] input[data-fld="hidden"]') as HTMLInputElement;
  hide.checked = true;
  fire(hide, 'change');
  assert.deepEqual(h.commits, [{ ids: ['b1'], field: 'hidden', value: true }]);
  const lock = row(h, '[data-rows="object"] input[data-fld="locked"]') as HTMLInputElement;
  lock.checked = true;
  fire(lock, 'change');
  assert.deepEqual(h.commits.at(-1), { ids: ['b1'], field: 'locked', value: true });
  assert.equal(h.boxes().find((b) => b.id === 'b1')!.locked, true);
  // A locked box refuses every pointer and a hidden one is not drawn at all, so these
  // two rows (and the navigator's) are the only way back once either is set.
  assert.equal((row(h, '[data-rows="object"] input[data-fld="hidden"]') as HTMLInputElement).checked, true);
  h.handle.destroy();
});

test('a manifest that declares none of the three M4 fields gets none of their controls', () => {
  const bare = FIELDS.filter((f) => !['slideTransition', 'hidden', 'locked'].includes(f.id));
  const h = mount(BOXES, { fields: bare });
  h.select(['b1']);
  assert.equal(h.el.querySelector('[data-fld="hidden"]'), null, 'no control writes a field nothing reads back');
  assert.equal(h.el.querySelector('[data-fld="locked"]'), null);
  h.select(['f1']);
  assert.equal(h.el.querySelector('[data-fld="slideTransition"]'), null);
  h.handle.destroy();
});

// ── collapsible sections ──────────────────────────────────────────────────────

test('EVERY group is a section with a real header button, and the header toggles it', () => {
  // Andy, 2026-09-03: "every inspector group is a collapsible section". Before this
  // the five paint groups inside Object were `<div class="fc-insp-sub">` headings -
  // unreachable by keyboard, and no way to put any of them away on a phone.
  const h = mount();
  h.select(['b1']);
  const heads = [...h.el.querySelectorAll<HTMLButtonElement>('.fc-insp-head')];
  assert.equal(heads.length, secs(h).length, 'one header per section, no orphans');
  assert.equal(h.el.querySelector('.fc-insp-sub'), null, 'and no headings left that are not buttons');
  for (const b of heads) {
    assert.equal(b.tagName, 'BUTTON', 'a button, so Enter and Space work with no key handling');
    assert.equal(b.type, 'button');
    assert.ok(b.hasAttribute('aria-expanded'));
    assert.ok(h.el.querySelector(`[data-rows="${b.dataset.head}"]`), `${b.dataset.head} has a body`);
  }
  const fill = h.el.querySelector<HTMLButtonElement>('[data-head="fill"]')!;
  const rows = h.el.querySelector<HTMLElement>('[data-rows="fill"]')!;
  assert.equal(fill.getAttribute('aria-expanded'), 'true');
  click(fill);
  assert.equal(fill.getAttribute('aria-expanded'), 'false');
  assert.equal(rows.hidden, true);
  click(fill);
  assert.equal(fill.getAttribute('aria-expanded'), 'true');
  assert.equal(rows.hidden, false);
  h.handle.destroy();
});

test('the groups that start open are the ones every selection has something in', () => {
  const h = mount();
  h.select(['b1']);
  assert.deepEqual(openSecs(h), ['object', 'fill', 'appearance'],
    'Shadow, Perspective tilt, Arrange, Motion and Present start shut - most boxes have nothing in them');
  h.select(['t1']);
  assert.ok(openSecs(h).includes('text'), 'Text is one you always want');
  h.select(['f1']);
  assert.ok(openSecs(h).includes('artboard'));
  h.select([]);
  assert.deepEqual(openSecs(h), ['document']);
  h.handle.destroy();
});

test('a group that starts shut opens itself for a selection that HAS something in it', () => {
  // A closed "Shadow" header over a box with a shadow hides the only controls that
  // explain what the canvas is showing. Checked per selection, so it closes again on
  // the next box that has none.
  const h = mount([
    ...BOXES,
    { id: 'sh1', kind: 'box', frame: 'f1', x: 0, y: 0, w: 10, h: 10, shadow: 'box', shadowX: 4, shadowY: 8 },
    { id: 'tl1', kind: 'box', frame: 'f1', x: 0, y: 0, w: 10, h: 10, rx: -20, ry: 0 },
  ]);
  h.select(['sh1']);
  assert.ok(openSecs(h).includes('shadow'), 'a shadow is set, so the group is open');
  assert.ok(!openSecs(h).includes('tilt'));
  h.select(['tl1']);
  assert.ok(openSecs(h).includes('tilt'), 'a tilt off zero, likewise');
  assert.ok(!openSecs(h).includes('shadow'));
  h.select(['b1']);
  assert.ok(!openSecs(h).includes('shadow'), 'and a plain box gets neither back');
  h.handle.destroy();
});

test('what the user leaves open is remembered per device, and beats both the default and the auto-open', () => {
  const h = mount();
  h.select(['b1']);
  click(h.el.querySelector('[data-head="fill"]')!);        // shut one that starts open
  click(h.el.querySelector('[data-head="arrange"]')!);     // open one that starts shut
  assert.deepEqual(JSON.parse(store.get(SECTIONS_KEY)!), { fill: false, arrange: true });
  h.handle.destroy();

  const again = mount(BOXES, {}, true);
  again.select(['b1']);
  assert.equal(again.el.querySelector('[data-head="fill"]')!.getAttribute('aria-expanded'), 'false',
    'the column came back the way it was left');
  assert.ok(openSecs(again).includes('arrange'));
  again.handle.destroy();

  // A section the user shut ON PURPOSE stays shut even for a selection that would
  // otherwise open it: the auto-open fills in a default, it does not overrule a choice.
  store.set(SECTIONS_KEY, JSON.stringify({ shadow: false }));
  const third = mount([...BOXES, { id: 'sh1', kind: 'box', frame: 'f1', x: 0, y: 0, w: 10, h: 10, shadow: 'box' }], {}, true);
  third.select(['sh1']);
  assert.ok(!openSecs(third).includes('shadow'));
  third.handle.destroy();
});

test('a rotten or hostile remembered state is ignored, not obeyed', () => {
  store.set(SECTIONS_KEY, '{"fill": "yes", "__proto__": true, "nonsense": false, "arrange": true}');
  const h = mount(BOXES, {}, true);
  h.select(['b1']);
  assert.ok(openSecs(h).includes('fill'), 'a non-boolean is not an answer, so the default stands');
  assert.ok(openSecs(h).includes('arrange'), 'and the one real entry is kept');
  h.handle.destroy();

  store.set(SECTIONS_KEY, 'not json at all');
  const broken = mount(BOXES, {}, true);
  broken.select(['b1']);
  assert.deepEqual(openSecs(broken), ['object', 'fill', 'appearance'], 'straight back to the defaults');
  broken.handle.destroy();
});

test("reveal() expands its target, and falls through when the section it names is not there", () => {
  const h = mount();
  h.select(['b1']);
  click(h.el.querySelector('[data-head="fill"]')!);        // collapse it
  assert.equal(h.el.querySelector('[data-head="fill"]')!.getAttribute('aria-expanded'), 'false');
  h.handle.reveal('fill');
  assert.equal(h.el.querySelector('[data-head="fill"]')!.getAttribute('aria-expanded'), 'true');
  assert.equal(document.activeElement, h.el.querySelector('[data-head="fill"]'));

  // The object bar asks for 'object' when its Stroke and More buttons are pressed, and
  // a multi-selection has no Object section - so it opens the first group that is there
  // rather than opening the column onto nothing.
  h.select(['b1', 't1']);
  h.handle.reveal('object');
  assert.equal(h.el.querySelector('[data-head="fill"]')!.getAttribute('aria-expanded'), 'true');
  assert.equal(document.activeElement, h.el.querySelector('[data-head="fill"]'));
  h.handle.destroy();
});

// ── number cells ──────────────────────────────────────────────────────────────

test('every numeric value in the column is a number cell, scrubbable and typeable', () => {
  const h = mount();
  h.select(['t1']);
  const fields = [...h.el.querySelectorAll<HTMLInputElement>('input[data-nf]')].map((i) => i.dataset.nf!);
  for (const f of ['f:x', 'f:y', 'f:w', 'f:h', 'f:rot', 'f:opacity', 'f:radius', 'f:strokeW',
    'f:shadowX', 'f:shadowY', 'f:shadowBlur', 'f:rx', 'f:ry', 'f:fontSize', 'f:lineHeight',
    'f:tracking', 'f:pad', 'f:enterMs', 'f:exitMs']) {
    assert.ok(fields.includes(f), `${f} is a number cell (has: ${fields.join(' ')})`);
  }
  h.handle.destroy();
});

test('scrubbing a number cell is ONE setField across the whole selection', () => {
  const h = mount();
  h.select(['b1']);
  const cell = h.el.querySelector<HTMLElement>('[data-num-field="f:x"]')!;
  scrub(cell.querySelector<HTMLElement>('.num-field-lbl')!, 25);
  assert.deepEqual(h.commits.map((c) => [c.ids, c.field, c.value]), [[['b1'], 'x', 65]],
    'sixty pointermoves, one undo step');
  assert.equal(h.boxes().find((b) => b.id === 'b1')!.x, 65);
  h.handle.destroy();
});

test('a number cell and its slider stay on the same value, and neither double-commits', () => {
  const h = mount();
  h.select(['b1']);
  const cell = h.el.querySelector<HTMLElement>('[data-num-field="f:opacity"]')!;
  const rng = row(h, 'input[type="range"][data-fld="opacity"]') as HTMLInputElement;
  scrub(cell.querySelector<HTMLElement>('.num-field-lbl')!, -30, false);   // mid-drag
  assert.equal(rng.value, '70', 'the slider follows the number while it is being dragged');
  assert.equal(h.commits.length, 0, 'and neither of them has written anything yet');
  scrub(cell.querySelector<HTMLElement>('.num-field-lbl')!, -30);          // and release
  assert.deepEqual(h.commits.map((c) => [c.field, c.value]), [['opacity', 70]], 'one write between the two of them');
  h.handle.destroy();
});

// ── mixed selections ──────────────────────────────────────────────────────────

/** Two boxes that disagree about everything a paint group can show. */
const DISAGREE: Box[] = [
  { id: 'f1', kind: 'frame', name: 'Title', x: 0, y: 0, w: 1600, h: 900, order: 0 },
  { id: 'm1', kind: 'box', frame: 'f1', x: 0, y: 0, w: 100, h: 100, opacity: 100, radius: 0, shadowX: 0, strokeW: 0, bg: '#123456', blend: 'normal' },
  { id: 'm2', kind: 'box', frame: 'f1', x: 0, y: 0, w: 100, h: 100, opacity: 20, radius: 40, shadowX: 12, strokeW: 4, bg: '#abcdef', blend: 'multiply' },
];

test('a value the selected boxes disagree about shows as Mixed, not as the first one', () => {
  // The whole column writes one field across the WHOLE selection, so a cell showing
  // box[0]'s number turns one arrow key into "set them all to that". Opacity 100 and 20
  // read 100, and one ArrowDown wrote 99 to both.
  const h = mount(DISAGREE);
  h.select(['m1', 'm2']);
  for (const f of ['opacity', 'radius', 'shadowX', 'strokeW']) {
    const cell = num(h, f);
    assert.equal(cell.value, '', `${f} has no shared number to show`);
    assert.equal(cell.placeholder, 'Mixed', `${f} says so`);
    assert.equal(cell.getAttribute('aria-valuenow'), null, 'and claims no value to a screen reader');
  }
  // Values they DO share are still numbers: shadowY is unset on both, so both draw 0.
  assert.equal(num(h, 'shadowY').value, '0');
  // The colour swatch is the same claim in a different control, and so is the select:
  // one entry the user cannot pick, rather than the first row's mode named as theirs.
  assert.equal(h.el.querySelector('[data-color-field="fc-insp-fill"] .color-trigger-name')!.textContent, 'Mixed');
  const blend = row(h, 'select[data-fld="blend"]') as HTMLSelectElement;
  assert.equal(blend.options[blend.selectedIndex]!.textContent, 'Mixed');
  assert.equal(blend.options[blend.selectedIndex]!.disabled, true);
  h.handle.destroy();
});

test('one box, or two that agree, still shows the number', () => {
  const h = mount(DISAGREE);
  h.select(['m1']);
  assert.equal(num(h, 'opacity').value, '100', 'one box never disagrees with itself');
  assert.notEqual(h.el.querySelector('[data-color-field="fc-insp-fill"] .color-trigger-name')!.textContent, 'Mixed');
  h.select(['m1', 'm2']);
  assert.equal(num(h, 'opacity').value, '');
  h.poke((rows) => rows.map((b) => (b.id === 'm2' ? { ...b, opacity: 100, bg: '#123456' } : b)));
  assert.equal(num(h, 'opacity').value, '100', 'agreeing again brings the number back');
  assert.notEqual(h.el.querySelector('[data-color-field="fc-insp-fill"] .color-trigger-name')!.textContent, 'Mixed');
  h.handle.destroy();
});

test('the memo watches every selected row, not just the first', () => {
  // The signature used to hash box[0] alone, so a change to the SECOND box left the
  // cell saying the two of them agreed.
  const h = mount(DISAGREE);
  h.select(['m1', 'm2']);
  h.poke((rows) => rows.map((b) => (b.id === 'm2' ? { ...b, opacity: 100 } : b)));
  assert.equal(num(h, 'opacity').value, '100');
  h.poke((rows) => rows.map((b) => (b.id === 'm2' ? { ...b, opacity: 55 } : b)));
  assert.equal(num(h, 'opacity').value, '', 'the second box moving is a repaint');
  h.handle.destroy();
});

test('a mixed cell still writes one value to the whole selection when it is given one', () => {
  const h = mount(DISAGREE);
  h.select(['m1', 'm2']);
  typeNum(h, 'opacity', '50');
  assert.deepEqual(h.commits.map((c) => [c.ids, c.field, c.value]), [[['m1', 'm2'], 'opacity', 50]]);
  assert.deepEqual(h.boxes().filter((b) => b.kind === 'box').map((b) => b.opacity), [50, 50]);
  assert.equal(num(h, 'opacity').value, '50', 'and they agree from here on');
  h.handle.destroy();
});

// ── a gesture the column must not interrupt ───────────────────────────────────

test('a rebuild waits for a live scrub instead of tearing the field out from under it', () => {
  // The press is preventDefaulted so a click on the number can type, which means nothing
  // in the column is focused for the whole drag: `typingHere()` is false, and the column
  // used to rebuild on the first model change that touched a watched field. The field the
  // pointer was captured on was destroyed mid-gesture, the value snapped back, and the
  // release committed nothing.
  const h = mount();
  h.select(['b1']);
  const lbl = h.el.querySelector<HTMLElement>('[data-num-field="f:w"] .num-field-lbl')!;
  pointerAt(lbl, 'pointerdown', 0);
  pointerAt(lbl, 'pointermove', 50);
  assert.equal(num(h, 'w').value, '350', 'the field is following the drag');

  // The timeline, a collab peer or a canvas resize writes a WATCHED field.
  h.poke((rows) => rows.map((b) => (b.id === 'b1' ? { ...b, y: 999 } : b)));
  assert.equal(lbl.isConnected, true, 'the field the pointer is captured on is still mounted');
  assert.equal(num(h, 'w').value, '350', 'and still showing the drag');
  assert.equal(document.body.classList.contains('is-scrubbing'), true);

  pointerAt(lbl, 'pointermove', 60);
  pointerAt(lbl, 'pointerup', 60);
  assert.deepEqual(h.commits.map((c) => [c.field, c.value]), [['w', 360]], 'the gesture commits what it drew');
  assert.equal(h.boxes().find((b) => b.id === 'b1')!.w, 360);
  h.handle.destroy();
});

test('a slider drag is held the same way - a range is not a control the caret check sees', () => {
  const h = mount();
  h.select(['b1']);
  const rng = row(h, 'input[type="range"][data-fld="opacity"]') as HTMLInputElement;
  pointerAt(rng, 'pointerdown', 0);
  rng.value = '40';
  fire(rng, 'input');
  assert.equal(num(h, 'opacity').value, '40', 'the number cell mirrors the drag');

  h.poke((rows) => rows.map((b) => (b.id === 'b1' ? { ...b, y: 42 } : b)));
  assert.equal(rng.isConnected, true, 'the slider under the pointer is still the same node');
  assert.equal(rng.value, '40');

  pointerAt(rng, 'pointerup', 0);
  fire(rng, 'change');
  assert.deepEqual(h.commits.map((c) => [c.field, c.value]), [['opacity', 40]]);
  h.handle.destroy();
});

// ── keyboard focus across a rebuild ───────────────────────────────────────────

test('every non-text control keeps focus across the commit it makes', () => {
  // Each of these commits DURING the interaction, so the model echoes and the column
  // rebuilds under the user's hand. Focus used to fall to <body>: Tab to Opacity,
  // press ArrowRight once and the second press scrolls the page instead of nudging
  // the slider, and a second checkbox needs a Tab walk from the top of the document.
  const h = mount();
  h.select(['t1']);

  const check = row(h, 'input[data-fld="ligatures"]') as HTMLInputElement;
  check.focus();
  check.checked = false;
  fire(check, 'change');
  const check2 = row(h, 'input[data-fld="ligatures"]') as HTMLInputElement;
  assert.notEqual(check2, check, 'the column really did rebuild');
  assert.equal(document.activeElement, check2, 'checkbox');

  const sel = row(h, 'select[data-fld="weight"]') as HTMLSelectElement;
  sel.focus();
  sel.value = '400';
  fire(sel, 'change');
  assert.equal(document.activeElement, row(h, 'select[data-fld="weight"]'), 'select');

  const rng = row(h, 'input[type="range"][data-fld="opacity"]') as HTMLInputElement;
  rng.focus();
  rng.value = '24';
  fire(rng, 'input'); fire(rng, 'change');
  const rng2 = row(h, 'input[type="range"][data-fld="opacity"]') as HTMLInputElement;
  assert.equal(document.activeElement, rng2, 'slider');
  assert.equal(rng2.value, '24', 'and it is the committed value under the caret');

  const seg = h.el.querySelector<HTMLButtonElement>('.fc-seg[data-seg="align"] .fc-seg-btn[data-v="right"]')!;
  seg.focus();
  click(seg);
  const seg2 = h.el.querySelector<HTMLButtonElement>('.fc-seg[data-seg="align"] .fc-seg-btn[data-v="right"]')!;
  assert.notEqual(seg2, seg);
  assert.equal(document.activeElement, seg2, 'segment');
  assert.equal(seg2.getAttribute('aria-pressed'), 'true', 'and the rebuilt segment reports its state');
  h.handle.destroy();
});

test('a rebuild the user did not cause does not steal focus into the column', () => {
  const h = mount();
  h.select(['b1']);
  document.body.focus();
  h.poke((rows) => rows.map((b) => (b.id === 'b1' ? { ...b, x: 999 } : b)));
  assert.equal(document.activeElement, document.body, 'nothing was focused, so nothing is restored');
  h.handle.destroy();
});

// ── the escape hatch that must stay shut ──────────────────────────────────────

test('setInputNoHistory is never called - the column has no path to it', () => {
  const h = mount();
  h.select(['b1']);
  const rng = row(h, 'input[type="range"][data-fld="opacity"]') as HTMLInputElement;
  rng.value = '10'; fire(rng, 'input'); fire(rng, 'change');
  const cls = row(h, 'input[data-fld="cls"]') as HTMLInputElement;
  cls.value = 'x'; fire(cls, 'change');
  click(h.el.querySelector('.fc-seg[data-seg="shape"] .fc-seg-btn[data-v="circle"]')!);
  assert.ok(h.commits.length >= 3);
  assert.equal(h.noHistory, 0);
  h.handle.destroy();
});

// ── repaint memo ──────────────────────────────────────────────────────────────

test('the memo does not rebuild on a field no visible section reads', () => {
  const h = mount();
  h.select(['b1']);
  const before = num(h, 'x');
  // `notes` and `build` belong to Artboard / Present, and a box selection shows
  // neither - so the navigator renaming a slide, or the timeline writing keyframes
  // on a DIFFERENT box, must not tear this column down under the user's cursor.
  h.poke((rows) => rows.map((b) => (b.id === 'f1' ? { ...b, notes: 'changed elsewhere', build: 3 } : b)));
  assert.equal(num(h, 'x'), before, 'same node: nothing was torn down');
  // Neither does a repeat of the selection it already has.
  h.select(['b1']);
  assert.equal(num(h, 'x'), before);
  h.handle.destroy();
});

test('the memo DOES rebuild when a watched field changes underneath (the canvas drags the box)', () => {
  const h = mount();
  h.select(['b1']);
  const before = num(h, 'x');
  assert.equal(before.value, '40');
  h.poke((rows) => rows.map((b) => (b.id === 'b1' ? { ...b, x: 999 } : b)));
  const after = num(h, 'x');
  assert.notEqual(after, before, 'the section body was rebuilt');
  assert.equal(after.value, '999');
  h.handle.destroy();
});

test('a rebuild is deferred while a text field in the column has focus', async () => {
  const h = mount();
  h.select(['b1']);
  const cls = row(h, 'input[data-fld="cls"]') as HTMLInputElement;
  cls.focus();
  assert.equal(document.activeElement, cls);
  cls.value = 'callout';
  fire(cls, 'change');                   // commits, model echoes back, memo wants a repaint
  assert.equal(document.activeElement, cls, 'the caret is still where the user left it');
  assert.equal((row(h, 'input[data-fld="cls"]') as HTMLInputElement), cls, 'the field itself survived');
  cls.blur();
  await new Promise((r) => setTimeout(r, 1));
  assert.equal((row(h, 'input[data-fld="cls"]') as HTMLInputElement).getAttribute('value'), 'callout', 'the deferred rebuild ran');
  h.handle.destroy();
});

test('a CLOSED column pays nothing: no rebuild behind `hidden`, one paint on open', () => {
  const h = mount(BOXES, { initiallyOpen: false });
  h.select(['b1']);
  for (let i = 0; i < 20; i++) h.poke((rows) => rows.map((b) => (b.id === 'b1' ? { ...b, x: 100 + i } : b)));
  assert.equal(h.el.querySelector('.fc-insp-sec'), null, 'nothing was built');
  assert.equal(h.el.querySelectorAll('[data-color-field]').length, 0, 'and the real colour picker was never mounted');
  h.handle.setOpen(true);
  assert.deepEqual(secs(h), ['object', 'fill', 'appearance', 'shadow', 'tilt', 'arrange', 'motion', 'present']);
  assert.equal(num(h, 'x').value, '119', 'it opens on the CURRENT model');
  h.handle.destroy();
});

test('the Document readout re-reads the canvas on a resize, and stops when the column is gone', () => {
  // "Canvas size" is measured, not read from the model, so no model write announces
  // it: the readout sat on the old dimensions until an unrelated edit happened to
  // move the memo. `canvas-resize` is the app's own event for exactly this.
  const h = mount();
  const canvasEl = document.getElementById('tool-canvas')!;
  assert.match(h.el.textContent!, /1600 x 900 px/);
  canvasEl.style.width = '1080px';
  canvasEl.style.height = '1080px';
  fire(canvasEl, 'canvas-resize');
  assert.match(h.el.textContent!, /1080 x 1080 px/);
  h.handle.destroy();
  const frozen = h.el.innerHTML;
  canvasEl.style.width = '640px';
  fire(canvasEl, 'canvas-resize');
  assert.equal(h.el.innerHTML, frozen, 'the listener went with the column');
});

// ── reveal, open/close, teardown ──────────────────────────────────────────────

test("reveal('text') expands the section and moves focus to its header", () => {
  const h = mount();
  h.select(['t1']);
  const head = h.el.querySelector<HTMLButtonElement>('[data-head="text"]')!;
  click(head);                            // collapse it first
  assert.equal(head.getAttribute('aria-expanded'), 'false');
  assert.equal(h.el.querySelector<HTMLElement>('[data-rows="text"]')!.hidden, true);
  h.handle.reveal('text');
  const after = h.el.querySelector<HTMLButtonElement>('[data-head="text"]')!;
  assert.equal(after.getAttribute('aria-expanded'), 'true');
  assert.equal(h.el.querySelector<HTMLElement>('[data-rows="text"]')!.hidden, false);
  assert.equal(document.activeElement, after);
  h.handle.destroy();
});

test('reveal opens a closed column first, and every section header is keyboard reachable', () => {
  const h = mount(BOXES, { initiallyOpen: false });
  assert.equal(h.handle.isOpen(), false);
  assert.equal(h.handle.width(), 0);
  h.select(['t1']);
  h.handle.reveal('image');               // not a visible section for a text box
  assert.equal(h.handle.isOpen(), true, 'revealing opens the column even when the section is absent');
  assert.equal(h.handle.width(), 0, 'the dock reserves the width; the panel never does');
  for (const b of h.el.querySelectorAll<HTMLButtonElement>('.fc-insp-head')) {
    assert.equal(b.tagName, 'BUTTON', 'a header is a button, not a div with a click handler');
    assert.ok(b.hasAttribute('aria-expanded'));
  }
  h.handle.destroy();
});

test('the column carries its own way out - the close button in the head hands over to the host', () => {
  // Before it existed the column could only ever be OPENED: the object bar's Text /
  // More / Stroke / dims buttons `reveal()` it and nothing dismissed it. A wide screen
  // lost the sidebar's width for good, a narrow one got a sheet over most of the screen
  // with no dismiss, and the device-local 'open' preference could only ever be true.
  // Closing now means UNDOCKING, which only the host can do - so it hears `onClose`.
  const opens: boolean[] = [];
  let closed = 0;
  const h = mount(BOXES, { onOpenChange: (b) => opens.push(b), onClose: () => { closed += 1; } });
  const close = h.el.querySelector<HTMLButtonElement>('.fc-insp-close')!;
  assert.ok(close, 'the head carries a close control');
  assert.ok((close.getAttribute('aria-label') || '').length > 0, 'and it names itself');
  click(close);
  assert.equal(h.handle.isOpen(), false);
  assert.equal(closed, 1, 'the host is told to take the panel out of the sidebar');
  assert.equal(h.handle.width(), 0);
  assert.deepEqual(opens, [false], 'the host hears about it, so the preference and the bar follow');
  h.handle.destroy();
});

test('the panel is built detached and positions nothing - the dock owns where it sits', () => {
  // Andy, 2026-09-02: "lets only have a single left sidebar and a single right sidebar".
  // This panel used to pin itself to the right of the stage AND reserve 280px, so the
  // editor showed it INSIDE the stage next to the export dock - two right-hand columns.
  const el = initDesignInspector({
    stageEl: document.getElementById('stage') ?? document.body,
    canvasEl: document.getElementById('tool-canvas') ?? document.body,
    model: { blockId: 'boxes', cfg: CFG, frame: FRAME, getBoxes: () => [], commit: () => {}, setField: () => {}, subscribe: () => () => {}, getInput: () => undefined, setInput: () => {} },
    selection: { get: () => [], set: () => {}, onChange: () => () => {} },
    artboard: { active: () => '', focus: () => {}, onChange: () => () => {} },
    actions: { pickImage: () => {}, openGradient: () => {}, arrange: () => {}, openTimeline: () => {} },
  });
  assert.equal(el.el.parentElement, null, 'nothing was appended to the stage');
  assert.equal(el.width(), 0, 'and it reserves no stage width in any state');
  assert.equal(el.el.style.position, '', 'no inline positioning of its own either');
  el.destroy();
});

test('no key pressed in the column reaches the canvas, and Escape backs out instead of clearing the selection', () => {
  // free-canvas binds its shortcuts on `window` and bails only for a typing target or
  // focus inside `.tl-panel`. Every control here that is not an <input> was therefore a
  // live canvas keyboard surface: Backspace on a focused "Align left" DELETED the box,
  // ArrowDown on a section header nudged it and pushed an undo step, `v`/`p`/`n`
  // switched tools and `\` hid all the chrome.
  const h = mount();
  h.select(['b1']);
  const seen: string[] = [];
  const spy = (e: Event): void => {
    const k = e as KeyboardEvent;
    seen.push(`${k.metaKey ? 'Meta+' : ''}${k.key}`);
  };
  window.addEventListener('keydown', spy);
  try {
    const arr = h.el.querySelector<HTMLButtonElement>('[data-arr="left"]')!;
    const head = h.el.querySelector<HTMLButtonElement>('[data-head="object"]')!;
    for (const [el, k] of [[arr, 'Backspace'], [arr, 'Delete'], [head, 'ArrowDown'], [head, 'v'], [head, ' ']] as const) {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    }
    assert.deepEqual(seen, [], 'not one of them reached a window handler');

    // Escape from a reveal goes back where it came from. It must NOT reach the editor's
    // ladder: with this column mounted the object bar opens no floating panel, so the
    // ladder fell through to "clear the selection" - which threw the selection away,
    // re-gated the column to Document, rewrote the body under the focused header and
    // left focus on <body>.
    const from = document.createElement('button');
    document.body.appendChild(from);
    from.focus();
    h.handle.reveal('object');
    assert.equal(document.activeElement, h.el.querySelector('[data-head="object"]'), 'the reveal took focus');
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.deepEqual(seen, [], 'the editor never saw the Escape');
    assert.equal(document.activeElement, from, 'focus went back to the control that asked');
    assert.deepEqual(h.commits, [], 'and nothing was committed on the way');

    // Chords stay app-wide: ⌘Z undo, ⌘S save, ⌘Return present, all on `window`.
    h.el.querySelector<HTMLButtonElement>('[data-arr="left"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }));
    assert.deepEqual(seen, ['Meta+z']);
  } finally {
    window.removeEventListener('keydown', spy);
    h.handle.destroy();
  }
});

test('every colour trigger says WHICH property it paints, not just the hex', () => {
  // The rows are `<div><span>` pairs, so the visible "Fill" / "Stroke" / "Text colour"
  // was never associated with the control: a black-stroked black text box announced
  // three identical "Colour: #000000" buttons with no way to tell them apart.
  const h = mount();
  h.select(['t1']);
  const names = [...h.el.querySelectorAll<HTMLElement>('.color-trigger')]
    .map((b) => b.getAttribute('aria-label') || '');
  assert.ok(names.length >= 2, 'a text box shows Fill and Text colour at least');
  assert.equal(new Set(names).size, names.length, 'no two triggers share an accessible name');
  assert.ok(names.some((n) => n.startsWith('Fill:')), `one of them leads with its row label: ${names.join(' | ')}`);
  h.handle.destroy();
});

test('the panel reserves nothing in any state, and setOpen still hides and shows it', () => {
  const widths: number[] = [];
  const opens: boolean[] = [];
  const h = mount(BOXES, { onWidthChange: (px) => widths.push(px), onOpenChange: (b) => opens.push(b) });
  assert.deepEqual(widths, [0], 'reported once at mount, and it is zero');
  h.handle.setOpen(true);
  assert.deepEqual(widths, [0], 'no-op toggles report nothing');
  h.handle.setOpen(false);
  assert.deepEqual(widths, [0], 'and closing changes no reserve either - there never was one');
  assert.deepEqual(opens, [false]);
  assert.equal(h.el.hidden, true);
  h.handle.setOpen(true);
  h.handle.destroy();
  assert.equal(h.el.isConnected, false, 'the column is out of the sidebar');
  assert.equal(widths[widths.length - 1], 0);
});

test('destroy unsubscribes: later model and selection traffic repaints nothing', () => {
  const h = mount();
  h.select(['b1']);
  h.handle.destroy();
  const frozen = h.el.innerHTML;
  // The detached node keeps whatever it last painted; what must not happen is a
  // NEW paint - a live subscription would swap Object for Text here.
  assert.doesNotThrow(() => h.select(['t1']));
  assert.doesNotThrow(() => h.poke((rows) => rows.map((b) => ({ ...b, x: 1 }))));
  assert.equal(h.el.innerHTML, frozen, 'no repaint after teardown');
  assert.equal(h.el.isConnected, false);
});

test('the column is chrome: marked out of every export and every live capture', () => {
  const h = mount();
  assert.equal(h.el.tagName, 'ASIDE');
  assert.ok(h.el.hasAttribute('data-export-hide'));
  assert.ok(h.el.hasAttribute('data-live-hide'));
  assert.equal(h.el.getAttribute('aria-label'), 'Inspector');
  h.handle.destroy();
});

test('the dock slot IS the open state - the sidebar and the panel cannot disagree', async () => {
  // The host docks and undocks this panel (its close button asks it to, through
  // `onClose`). Without following the dock, a toggle that only re-docked the element
  // would put a panel whose own state still said "closed" into the sidebar: an empty
  // column with a live, hidden panel inside it.
  const ED = await import('../lib/edge-dock.ts');
  (globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
  });
  const h = mount();
  h.el.remove();                       // out of the harness's slot: where the host starts
  h.handle.setOpen(false);
  assert.equal(ED.requestDock('inspector', h.el), true);
  assert.equal(h.handle.isOpen(), true, 'a slot means open - no second call needed');
  assert.equal(h.el.hidden, false);
  ED.releaseDock('inspector');
  assert.equal(h.handle.isOpen(), false, 'and out of the sidebar it closes itself');
  assert.equal(h.el.parentElement, null, 'detached again, for the host to place');
  h.handle.destroy();
});


function inspectorGuides() {
  const rows: DesignGuide[] = [
    { id: 'a', x: 120, y: 80, rotation: 90, color: '#ff00cc', snap: true },
    { id: 'b', x: 20, y: 40, rotation: 0, color: '#00aaff', snap: true },
  ];
  let selectedId: string | null = 'a';
  const listeners = new Set<() => void>();
  const writes: Array<{ id: string; patch: Partial<DesignGuide> }> = [];
  const emit = (): void => { for (const cb of [...listeners]) cb(); };
  const port: DesignGuidePort = {
    selected: () => rows.find(g => g.id === selectedId) ?? null,
    select: id => { selectedId = id; emit(); },
    update: (id, patch) => {
      writes.push({ id, patch });
      const row = rows.find(g => g.id === id);
      if (row) Object.assign(row, patch);
      emit();
    },
    remove: id => { const i = rows.findIndex(g => g.id === id); if (i >= 0) rows.splice(i, 1); emit(); },
    onChange: cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
  };
  return { port, rows, writes, listeners };
}

test('a selected guide offers position, rotation, colour, snapping and deletion without editing artwork', () => {
  const guides = inspectorGuides();
  const h = mount(BOXES, { guides: guides.port });
  assert.deepEqual(secs(h), ['guide']);
  assert.equal(num(h, 'guide-x').value, '120');
  typeNum(h, 'guide-x', '240');
  typeNum(h, 'guide-y', '360');
  typeNum(h, 'guide-rotation', '45');
  const snap = row(h, 'input[data-fld="guide-snap"]') as HTMLInputElement;
  snap.checked = false; fire(snap, 'change');
  const colour = row(h, '[data-color-field="fc-insp-guide"] input[aria-label="Colour value"]') as HTMLInputElement;
  colour.value = '#123456'; fire(colour, 'input');
  assert.deepEqual(guides.rows[0], { id: 'a', x: 240, y: 360, rotation: 45, color: '#123456', snap: false });
  assert.equal(h.commits.length, 0, 'no box field writes');
  assert.equal(h.arrays.length, 0, 'no artwork replacement');
  click(row(h, '[data-act="delete-guide"]'));
  assert.deepEqual(guides.rows.map(g => g.id), ['b']);
  h.handle.destroy();
  assert.equal(guides.listeners.size, 0);
});

test('an in-progress inspector edit remains bound to the guide it started on', async () => {
  const guides = inspectorGuides();
  const h = mount(BOXES, { guides: guides.port });
  const x = num(h, 'guide-x');
  x.focus(); x.value = '350'; fire(x, 'input');
  guides.port.select('b');
  x.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(guides.rows[0]!.x, 350);
  assert.equal(guides.rows[1]!.x, 20, 'the newly selected guide is untouched');
  x.blur();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(num(h, 'guide-x').value, '20', 'the inspector catches up after editing');
  h.handle.destroy();
});
