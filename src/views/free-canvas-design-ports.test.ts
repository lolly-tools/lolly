// SPDX-License-Identifier: MPL-2.0
/**
 * `handle.design` - the ports the Design chrome (top bar, navigator, inspector) drives
 * this overlay through (plans/179 M1-C / M2 / M3; the contract is `design-ports.ts`).
 *
 * Every claim here is one the three column modules BUILD ON, and each of them is a place
 * the overlay could have quietly answered from a snapshot instead of its live state:
 *   • the selection port is the SAME object the timeline gets, and it fires once per real
 *     change - a per-repaint fire would make a navigator rebuild its whole list on pan;
 *   • `artboard.active` follows the selection, because a column that highlighted the
 *     primary board while you edited slide 3 is worse than no highlight;
 *   • `model.setField` writes the GIVEN ids in one commit and leaves the selection alone -
 *     renaming a row in a list must not select it;
 *   • `setColumnWidths` is the ONE writer of the two side reserves, and it adds the docked
 *     rail's own band itself, which is the whole reason it exists (two writers over
 *     `--stage-reserve-left` is how one of them silently loses);
 *   • a mounted inspector turns the object bar's Text button into navigation;
 *   • and the mark menu sheds exactly the rows the top bar now carries - with NO bar
 *     (Org Chart, Carousel Maker, every other editor tool) it is untouched.
 *
 * Runs against the real `initFreeCanvas` on the jsdom harness free-canvas-rail.test.ts
 * established, with the real (lazily imported) timeline panel for the one test that needs
 * the rail actually docked.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-design-ports.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';
import { ARRANGE_OPS } from './design-inspector.ts';

// The timeline panel imports its own stylesheet and free-canvas reaches it through a
// dynamic import; Node has no idea what a .css module is (Vite resolves it for real).
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window as unknown as typeof globalThis & {
  MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent; CustomEvent: typeof CustomEvent;
};
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

const { initFreeCanvas } = await import('./free-canvas.ts');

const NATIVE = 1000;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

/** Design's canvas block, trimmed to what these tests exercise. */
function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', gradField: 'grad', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', textColorField: 'fg', fontField: 'font', fontSizeField: 'size', weightField: 'weight',
    groupField: 'group', clipField: 'clip', imageField: 'image', fitField: 'fit', imgPosField: 'imgpos',
    labelField: 'name', rxField: 'rx', ryField: 'ry',
    // The frame primitive - artboards, page order, clipping.
    frameField: 'frame', frameKind: 'frame', orderField: 'order', clipChildrenField: 'clipChildren',
    // The full ten a `timeCfg` needs - the timeline rail button and the auto-dock are
    // gated on all of them being declared.
    startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
    enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
    muteField: 'mute', laneField: 'lane',
    addKinds: [
      { id: 'box', label: 'Box', seed: { kind: 'box' } },
      { id: 'frame', label: 'Artboard', seed: { kind: 'frame', bg: '#ffffff' } },
    ],
  };
}

const frameBox = (id: string, x: number, order: number): Box =>
  ({ kind: 'frame', id, name: `Board ${order + 1}`, x, y: 0, w: 400, h: 300, order, bg: '#fff' } as Box);
const childBox = (id: string, frame: string, x: number): Box =>
  ({ kind: 'box', id, frame, x, y: 20, w: 100, h: 60, bg: '#ccc', text: 'hi' } as Box);

interface MountOpts {
  chrome?: Record<string, unknown>;
  withActions?: boolean;
  withHistory?: boolean;
  withTime?: boolean;
}

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  viewEl: HTMLElement;
  design: ReturnType<typeof initFreeCanvas>['design'];
  boxes(): Box[];
  input(id: string): unknown;
  commits(): number;
  destroy(): void;
}

function mount(initial: Box[] = [], o: MountOpts = {}): Fixture {
  const doc = dom.window.document;
  const viewEl = doc.createElement('div');
  const stageEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  doc.body.appendChild(viewEl);
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  const model = new Map<string, unknown>([
    ['boxes', initial],
    ['transition', 'slide'],
    ['customCss', ''],
  ]);
  const subs: Array<() => void> = [];
  let commits = 0;
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) {
      if (id === 'boxes') commits++;
      model.set(id, value);
      for (const s of subs) s();
    },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const cfg = canvasCfg();
  if (!o.withTime) {
    for (const k of ['startField', 'durField', 'clipInField', 'speedField', 'enterField',
      'exitField', 'enterMsField', 'exitMsField', 'muteField', 'laneField']) delete cfg[k];
  }
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: cfg as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
    frame: { frameField: 'frame', frameKind: 'frame', orderField: 'order', clipChildrenField: 'clipChildren' },
    setCanvasSize: () => {},
    info: { getFilename: () => 'Doc', setFilename: () => {} },
    ...(o.withActions === false ? {} : {
      actions: {
        export: () => {}, save: () => {}, copy: () => {}, share: () => {},
        present: () => {}, newFromTemplate: () => {}, bulk: () => {},
      },
    }),
    ...(o.withHistory === false ? {} : {
      history: { undo: () => {}, redo: () => {}, register: () => {} },
    }),
    ...(o.chrome ? { chrome: o.chrome } : {}),
  } as never);
  return {
    stageEl, canvasEl, viewEl,
    design: handle.design,
    boxes: () => model.get('boxes') as Box[],
    input: (id: string) => model.get(id),
    commits: () => commits,
    destroy() { handle.destroy(); viewEl.remove(); doc.body.innerHTML = ''; },
  };
}

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
/** Let queued frames and any lazily imported chunk resolve. */
const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };

/** The keys of the mark menu's rows, in order. */
function markMenuKeys(f: Fixture): string[] {
  const trigger = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-lolly');
  assert.ok(trigger, 'the rail has a Lolly menu trigger');
  click(trigger!);
  const keys = [...f.stageEl.querySelectorAll<HTMLElement>('.fc-popover [data-pop]')]
    .map((el) => el.dataset.pop || '');
  click(trigger!);   // close it again - the popover is a single slot
  return keys;
}

// ══ 1. the surface itself ═════════════════════════════════════════════════════

test('handle.design carries every member of DesignCanvasPorts', () => {
  const f = mount([frameBox('f1', 0, 0)]);
  try {
    const d = f.design;
    for (const k of ['selection', 'artboard', 'thumb', 'model', 'navigatorActions', 'inspectorActions',
      'fonts', 'fields', 'activeFrameId', 'activeFrameRect', 'contentRect', 'selectionRect',
      'openLollyMenu', 'toggleTimeline', 'isTimelineOpen', 'toggleFramesPanel', 'isFramesPanelOpen',
      'setColumnWidths', 'setInspector']) {
      assert.ok((d as unknown as Record<string, unknown>)[k] != null, `handle.design.${k} exists`);
    }
    for (const k of ['get', 'set', 'onChange']) assert.equal(typeof (d.selection as unknown as Record<string, unknown>)[k], 'function', `selection.${k}`);
    for (const k of ['active', 'focus', 'onChange']) assert.equal(typeof (d.artboard as unknown as Record<string, unknown>)[k], 'function', `artboard.${k}`);
    for (const k of ['getBoxes', 'commit', 'setField', 'subscribe', 'getInput', 'setInput']) {
      assert.equal(typeof (d.model as unknown as Record<string, unknown>)[k], 'function', `model.${k}`);
    }
    for (const k of ['duplicateFrame', 'deleteFrame', 'addArtboardAfter', 'present', 'reorderChildren']) {
      assert.equal(typeof (d.navigatorActions as unknown as Record<string, unknown>)[k], 'function', `navigatorActions.${k}`);
    }
    for (const k of ['pickImage', 'openGradient', 'arrange', 'openTimeline']) {
      assert.equal(typeof (d.inspectorActions as unknown as Record<string, unknown>)[k], 'function', `inspectorActions.${k}`);
    }
    // The manifest's frame-primitive field map, and the tool's own font vocabulary.
    assert.equal(d.model.blockId, 'boxes');
    assert.deepEqual(d.model.frame, {
      frameField: 'frame', frameKind: 'frame', orderField: 'order',
      clipChildrenField: 'clipChildren', labelField: 'name',
      // The per-frame slide transition (plans/179 M4). Carried on the port so the
      // navigator and the inspector read the NAME rather than guessing Design's literal,
      // and undefined here because this fixture's canvas declares no such sub-field.
      transitionField: undefined,
    });
    assert.ok(d.fonts.options().length > 0, 'the font select has choices');
    assert.ok(d.fonts.weights(d.fonts.options()[0]![0]).length > 0, 'and so does the weight select');
    assert.deepEqual(d.fields, [], 'fields mirrors the manifest declarations (none in this fixture)');
  } finally { f.destroy(); }
});

test('inspectorActions.arrange accepts every name the inspector column offers', () => {
  const f = mount([frameBox('f1', 0, 0), childBox('a', 'f1', 10), childBox('b', 'f1', 200), childBox('c', 'f1', 300)]);
  try {
    f.design.selection.set(['a', 'b', 'c']);
    // Not "does the right thing" - align/distribute/z have their own tests - but "is a
    // branch, not a fall-through": every op the column can send must reach a runner.
    for (const op of ARRANGE_OPS) {
      assert.doesNotThrow(() => f.design.inspectorActions.arrange(op), `arrange('${op}')`);
    }
    assert.doesNotThrow(() => f.design.inspectorActions.arrange('not-an-op'), 'an unknown op is ignored, not thrown');
  } finally { f.destroy(); }
});

// ══ 2. the selection port ═════════════════════════════════════════════════════

test('selection.onChange fires once per change, and never for a repaint', () => {
  const f = mount([frameBox('f1', 0, 0), childBox('a', 'f1', 10), childBox('b', 'f1', 200)]);
  try {
    const seen: string[][] = [];
    const off = f.design.selection.onChange((ids) => seen.push([...ids]));

    f.design.selection.set(['a']);
    assert.deepEqual(seen, [['a']], 'one fire, carrying the new ids');

    f.design.selection.set(['a']);
    assert.equal(seen.length, 1, 'the same selection again is not a change');

    f.design.selection.set(['a', 'b']);
    assert.equal(seen.length, 2);
    assert.deepEqual(seen[1]!.slice().sort(), ['a', 'b']);
    assert.deepEqual(f.design.selection.get().slice().sort(), ['a', 'b'], 'get() reads the live Set');

    off();
    f.design.selection.set([]);
    assert.equal(seen.length, 2, 'the unsubscribe is honoured');
  } finally { f.destroy(); }
});

// ══ 3. the artboard port ══════════════════════════════════════════════════════

test('artboard.active follows the selection, and onChange fires on the change', () => {
  const f = mount([
    frameBox('f1', 0, 0), frameBox('f2', 600, 1),
    childBox('a', 'f1', 10), childBox('b', 'f2', 610),
  ]);
  try {
    const seen: string[] = [];
    f.design.artboard.onChange((id) => seen.push(id));

    // Nothing selected: the PRIMARY board (lowest order) is the one the editor is on.
    // No fire here - mount already settled on f1 before anyone could subscribe, and the
    // port dedupes, which is the whole point (a column must not repaint on every paint).
    f.design.selection.set([]);
    assert.equal(f.design.artboard.active(), 'f1');
    assert.deepEqual(seen, [], 'the board did not change, so nothing was announced');
    assert.equal(f.design.activeFrameId(), 'f1', 'activeFrameId() is the same answer');

    // A child of slide 2 puts the editor on slide 2 (plans/179 A11).
    f.design.selection.set(['b']);
    assert.equal(f.design.artboard.active(), 'f2');

    // A selected BOARD is itself the active one.
    f.design.selection.set(['f1']);
    assert.equal(f.design.artboard.active(), 'f1');

    assert.deepEqual(seen, ['f2', 'f1'], 'one fire per actual change of board');
  } finally { f.destroy(); }
});

test('a canvas with no artboards answers "" rather than guessing', () => {
  const f = mount([childBox('a', '', 10)]);
  try {
    f.design.selection.set(['a']);
    assert.equal(f.design.artboard.active(), '');
    assert.equal(f.design.activeFrameRect(), null);
    assert.equal(f.design.contentRect(), null, 'no pages, nothing to fit');
  } finally { f.destroy(); }
});

// ══ 4. the model port ═════════════════════════════════════════════════════════

test('model.setField writes N ids in ONE commit and leaves the selection untouched', () => {
  const f = mount([frameBox('f1', 0, 0), childBox('a', 'f1', 10), childBox('b', 'f1', 200), childBox('c', 'f1', 300)]);
  try {
    f.design.selection.set(['a']);
    const before = f.commits();

    f.design.model.setField(['b', 'c'], 'bg', '#ff0000');

    assert.equal(f.commits() - before, 1, 'one commit for two ids - one undo step');
    const byId = new Map(f.boxes().map((b) => [String(b.id), b]));
    assert.equal(byId.get('b')!.bg, '#ff0000');
    assert.equal(byId.get('c')!.bg, '#ff0000');
    assert.equal(byId.get('a')!.bg, '#ccc', 'a box that was not named is untouched');
    assert.deepEqual(f.design.selection.get(), ['a'], 'the selection did not move to the written rows');

    // Nothing to write is not a commit.
    const mid = f.commits();
    f.design.model.setField([], 'bg', '#00ff00');
    f.design.model.setField(['nope'], 'bg', '#00ff00');
    assert.equal(f.commits(), mid, 'unknown / empty id lists write nothing');
  } finally { f.destroy(); }
});

test('model.getInput/setInput reach the doc-level inputs, and setInput marks the doc dirty', () => {
  const f = mount([frameBox('f1', 0, 0)]);
  try {
    assert.equal(f.design.model.getInput('transition'), 'slide');
    f.design.model.setInput('transition', 'fade');
    assert.equal(f.input('transition'), 'fade');
  } finally { f.destroy(); }
});

test('navigatorActions.addArtboardAfter slots the new board in at order + 1', () => {
  const f = mount([frameBox('f1', 0, 0), frameBox('f2', 600, 1), frameBox('f3', 1200, 2)]);
  try {
    f.design.navigatorActions.addArtboardAfter('f1');
    const frames = f.boxes().filter((b) => b.kind === 'frame');
    assert.equal(frames.length, 4, 'a board was added');
    const seq = frames.slice().sort((a, b) => Number(a.order) - Number(b.order)).map((b) => String(b.id));
    assert.deepEqual(seq.slice(0, 2), ['f1', seq[1]!], 'the new board sits directly after f1');
    assert.deepEqual(seq.slice(2), ['f2', 'f3'], 'and the later boards renumbered around it');
    assert.deepEqual(frames.slice().sort((a, b) => Number(a.order) - Number(b.order)).map((b) => Number(b.order)),
      [0, 1, 2, 3], 'the order stays dense');
    const made = f.boxes().find((b) => b.kind === 'frame' && !['f1', 'f2', 'f3'].includes(String(b.id)))!;
    assert.equal(Number(made.x), 400 + Math.round(400 * 0.08), 'placed to the right of the board it follows');
    assert.equal(Number(made.w), 400, 'at that board’s size');
  } finally { f.destroy(); }
});

test('navigatorActions.reorderChildren restacks one board’s children and nothing else', () => {
  const f = mount([
    frameBox('f1', 0, 0), childBox('a', 'f1', 10), childBox('b', 'f1', 40),
    frameBox('f2', 600, 1), childBox('x', 'f2', 610),
  ]);
  try {
    const before = f.commits();
    f.design.navigatorActions.reorderChildren!('f1', ['b', 'a']);
    assert.equal(f.commits() - before, 1, 'one commit');
    assert.deepEqual(f.boxes().map((b) => String(b.id)), ['f1', 'b', 'a', 'f2', 'x'],
      'the two children swapped slots; every other row kept its position');

    const mid = f.commits();
    f.design.navigatorActions.reorderChildren!('f1', ['b', 'a']);
    assert.equal(f.commits(), mid, 'an order that is already the order is not a write');
  } finally { f.destroy(); }
});

// ══ 5. the reserve arbiter ════════════════════════════════════════════════════

test('setColumnWidths is the one writer of the left reserve, and only fires on a change', () => {
  const f = mount([frameBox('f1', 0, 0)]);
  try {
    let resizes = 0;
    f.canvasEl.addEventListener('canvas-resize', () => { resizes++; });

    f.design.setColumnWidths(232, 280);
    assert.equal(f.stageEl.style.getPropertyValue('--stage-reserve-left'), '232px');
    // The RIGHT band is always zero now (plans/179 M4): one right sidebar, and it is the
    // app-wide edge dock, which insets `#view` through `--dock-w` instead of taking a
    // slice of stage. A reported right width is accepted and reserves nothing.
    assert.equal(f.stageEl.style.getPropertyValue('--stage-reserve-right'), '');
    assert.equal(f.stageEl.style.getPropertyValue('--ldock-rail-w'), '',
      'no docked rail, so no rail band');
    assert.equal(resizes, 1, 'one re-fit');

    f.design.setColumnWidths(232, 280);
    assert.equal(resizes, 1, 'the same widths again write nothing and re-fit nothing');

    f.design.setColumnWidths(0, 0);
    assert.equal(f.stageEl.style.getPropertyValue('--stage-reserve-left'), '');
    assert.equal(f.stageEl.style.getPropertyValue('--stage-reserve-right'), '');
    assert.equal(resizes, 2);
  } finally { f.destroy(); }
});

/** The auto-dock is desktop-only, so matchMedia has to say the viewport is wide. */
async function withDesktopViewport(fn: () => Promise<void>): Promise<void> {
  const real = (globalThis as Record<string, unknown>).matchMedia;
  (globalThis as Record<string, unknown>).matchMedia = (q: string) =>
    ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
  try { await fn(); } finally { (globalThis as Record<string, unknown>).matchMedia = real; }
}

test('with the timeline rail docked, the left reserve carries the column AND the rail band', async () => {
  await withDesktopViewport(async () => {
    const f = mount([frameBox('f1', 0, 0)], { withTime: true });
    try {
      f.design.toggleTimeline();
      await settle();
      assert.equal(f.design.isTimelineOpen(), true, 'the panel opened');
      assert.ok(f.stageEl.classList.contains('has-tl-reserve'), 'and took the rail as a column');

      // jsdom reports a zero-width rail, so the dock falls back to its design width (46)
      // and the band is 46 + 12 gutters.
      const railBand = 58;
      assert.equal(f.stageEl.style.getPropertyValue('--ldock-rail-w'), `${railBand}px`,
        'the rail column keeps its OWN width');
      assert.equal(f.stageEl.style.getPropertyValue('--stage-reserve-left'), `${railBand}px`);

      // A width reported by a column that is NOT the navigator (no rail slot in the DOM,
      // e.g. the collapsed dot rail) adds to the same band: the rail is still its own
      // column, so both are in the way of the canvas.
      f.design.setColumnWidths(232, 280);
      assert.equal(f.stageEl.style.getPropertyValue('--stage-reserve-left'), `${232 + railBand}px`,
        'the column’s width and the rail band share one reserve');
      assert.equal(f.stageEl.style.getPropertyValue('--ldock-rail-w'), `${railBand}px`,
        'and the rail did not grow to cover the column');
      assert.equal(f.stageEl.style.getPropertyValue('--stage-reserve-right'), '');
    } finally { f.destroy(); }
  });
});

/**
 * A stand-in for the navigator column. What free-canvas actually reads is the SLOT - the
 * `[data-nav-rail-slot]` node design-navigator.ts hides when the column collapses -
 * because neither module imports the other (see `navRailSlot`). Nothing else about the
 * real column matters to the arbiter, so nothing else is faked.
 */
function fakeNav(f: Fixture, open = true): { el: HTMLElement; slot: HTMLElement } {
  const doc = f.stageEl.ownerDocument;
  const el = doc.createElement('div');
  el.className = 'fc-nav fc-nav--column';
  const slot = doc.createElement('div');
  slot.setAttribute('data-nav-rail-slot', '');
  slot.hidden = !open;
  el.append(slot);
  f.stageEl.append(el);
  return { el, slot };
}

test('the left reserve, pinned in all four states (navigator on/off × timeline on/off)', async () => {
  await withDesktopViewport(async () => {
    const f = mount([frameBox('f1', 0, 0)], { withTime: true });
    const rail = f.stageEl.querySelector<HTMLElement>('.fc-toolbar')!;
    const dock = f.stageEl.querySelector<HTMLElement>('.fc-toolbar-dock')!;
    const RAIL_BAND = 58;             // jsdom measures 0, so the dock's fallback 46 + 12
    const left = (): string => f.stageEl.style.getPropertyValue('--stage-reserve-left');
    const ldock = (): string => f.stageEl.style.getPropertyValue('--ldock-rail-w');
    try {
      // (1) nothing open: no band at all, and the rail floats.
      assert.equal(left(), '');
      assert.equal(ldock(), '');
      assert.equal(rail.parentElement, dock);

      // (2) navigator open, no timeline: the band IS the column, and the rail moved into
      // it - so there is no rail allowance on top (that would double-count the same px).
      const nav = fakeNav(f);
      f.design.setColumnWidths(232, 0);
      assert.equal(left(), '232px');
      assert.equal(ldock(), '', 'the rail has no column of its own to keep');
      assert.equal(rail.parentElement, nav.slot, 'the buttons are inside the navigator');
      assert.ok(rail.classList.contains('fc-toolbar--grid'), 'and laid out as its icon grid');
      assert.equal(f.stageEl.classList.contains('has-tl-reserve'), false);

      // (3) …and the timeline as well: the navigator still wins, so the band is unchanged
      // and the timeline's own left dock stays out of it.
      f.design.toggleTimeline();
      await settle();
      assert.equal(f.design.isTimelineOpen(), true);
      assert.equal(left(), '232px', 'the timeline did not add a second left column');
      assert.equal(ldock(), '');
      assert.equal(rail.parentElement, nav.slot);
      assert.equal(f.stageEl.classList.contains('has-tl-reserve'), false,
        'the rail is not a column, so the panel styles that make it one stay off');

      // (4) the navigator collapses to its dot rail with the timeline still open: the
      // rail goes back to being the timeline's left column, and both bands count.
      nav.slot.hidden = true;
      f.design.setColumnWidths(36, 0);
      assert.equal(rail.parentElement, dock, 'the rail came home');
      assert.equal(rail.classList.contains('fc-toolbar--grid'), false);
      assert.ok(f.stageEl.classList.contains('has-tl-reserve'));
      assert.equal(ldock(), `${RAIL_BAND}px`);
      assert.equal(left(), `${36 + RAIL_BAND}px`, 'the dot rail plus the rail column');

      // …and closing the timeline leaves just the dot rail's own 36.
      f.design.toggleTimeline();
      await settle();
      assert.equal(ldock(), '');
      assert.equal(left(), '36px');
      nav.el.remove();
    } finally { f.destroy(); }
  });
});

test('the rail never drags while a panel is holding it, and comes back where it was', async () => {
  await withDesktopViewport(async () => {
    const f = mount([frameBox('f1', 0, 0)], { withTime: true });
    const rail = f.stageEl.querySelector<HTMLElement>('.fc-toolbar')!;
    const dock = f.stageEl.querySelector<HTMLElement>('.fc-toolbar-dock')!;
    try {
      const nav = fakeNav(f);
      f.design.setColumnWidths(232, 0);
      assert.equal(rail.parentElement, nav.slot);
      // A grab inside the column must not detach the dock (the drag is refused wholesale
      // while the rail is docked - a set-width grid has nowhere to drag to).
      rail.dispatchEvent(new W.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: 40, clientY: 200 }));
      rail.dispatchEvent(new W.MouseEvent('pointermove', { bubbles: true, button: 0, buttons: 1, clientX: 500, clientY: 400 }));
      assert.equal(dock.classList.contains('is-detached'), false, 'no drag started');
      assert.equal(dock.classList.contains('is-dragging'), false);
      assert.equal(rail.parentElement, nav.slot, 'and it is still in the column');

      // Closing the column returns the rail to its own dock, clean.
      nav.slot.hidden = true;
      f.design.setColumnWidths(36, 0);
      assert.equal(rail.parentElement, dock);
      assert.equal(dock.style.left, '', 'parked on the CSS edge, not a stale inline offset');
      nav.el.remove();
    } finally { f.destroy(); }
  });
});

// ══ 6. the inspector takes over the object bar ════════════════════════════════

test('setInspector routes the object bar’s Text button to reveal(text); null restores the panel', () => {
  const f = mount([frameBox('f1', 0, 0), childBox('a', 'f1', 10)]);
  try {
    const revealed: string[] = [];
    f.design.setInspector({ reveal: (s) => { revealed.push(s); } });
    f.design.selection.set(['a']);

    const textBtn = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx="text"]');
    assert.ok(textBtn, 'a text box gets the Aa button');
    click(textBtn!);
    assert.deepEqual(revealed, ['text'], 'the button revealed the column’s Text section');
    assert.equal(f.stageEl.querySelector('.fc-text-panel'), null, 'and opened no one-slot panel');

    // With an inspector the bar is VERBS (plans/184 R16): no More opener, no paint cluster -
    // those live in the column - and the readout jumps to the Object section.
    const bar = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar')!;
    assert.equal(bar.querySelector('[data-cx="more"]'), null, 'More is not on the bar');
    assert.equal(bar.querySelector('.fc-cfield'), null, 'nor any colour field');
    assert.equal(bar.querySelector('[data-cx="stroke"]'), null, 'nor the stroke opener');
    assert.ok(bar.querySelector('[data-cx="dup"]') && bar.querySelector('[data-cx="del"]'), 'the verbs stay');
    const readout = bar.querySelector<HTMLElement>('[data-cx="dims"]')!;
    assert.equal(readout.getAttribute('aria-label'), 'Edit in the inspector');
    click(readout);
    assert.deepEqual(revealed, ['text', 'object']);
    assert.equal(f.stageEl.querySelector('.fc-more-panel, .fc-dims-panel'), null);

    // Unregistering brings today's bar and its panels straight back.
    f.design.setInspector(null);
    const full = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar')!;
    assert.ok(full.querySelector('[data-cx="more"]'), 'More is back');
    assert.ok(full.querySelector('.fc-cfield'), 'and the colour fields');
    click(full.querySelector<HTMLElement>('[data-cx="text"]')!);
    assert.equal(revealed.length, 2, 'no further reveals');
    assert.ok(f.stageEl.querySelector('.fc-text-panel'), 'the Text panel opened as it always did');
  } finally { f.destroy(); }
});

// ══ 7. the mark menu trim ═════════════════════════════════════════════════════

/** The rows the Design top bar takes over (plans/179 M1). */
const BAR_OWNED = ['export', 'save', 'copy', 'share', 'undo', 'redo', 'transition', 'present'];
/** …of which the bar carries a visible control for all but ONE. `transition` is
 *  doc-level and the bar has no transition control (nor has the inspector's Document
 *  section, nor the navigator, which only reads it as a chip), so dropping it left the
 *  input with no door anywhere in the editor: a deck set to Morph could not be changed
 *  back to Fade except by hand-editing the URL. It stays until plan 179 M4 ships the
 *  per-frame select that takes it over. */
const BAR_SHED = BAR_OWNED.filter((k) => k !== 'transition');
/** The rows the menu keeps whichever way round. */
const MENU_OWNED = ['size', 'info', 'templates', 'bulk', 'css'];

test('with no top bar the mark menu is untouched', () => {
  const f = mount([frameBox('f1', 0, 0)]);
  try {
    const keys = markMenuKeys(f);
    for (const k of BAR_OWNED) assert.ok(keys.includes(k), `the menu still carries "${k}"`);
    for (const k of MENU_OWNED) assert.ok(keys.includes(k), `and "${k}"`);
    assert.ok(!keys.includes('theme'), 'the app preferences stay on the zoom HUD');
    assert.ok(!keys.includes('sound'));
  } finally { f.destroy(); }
});

test('with a top bar the menu sheds duplicated rows and keeps its long-tail controls', () => {
  const doc = dom.window.document;
  const themeToggle = doc.createElement('button');
  const soundToggle = doc.createElement('button');
  let themeClicks = 0, soundClicks = 0, saves = 0;
  themeToggle.addEventListener('click', () => { themeClicks++; });
  soundToggle.addEventListener('click', () => { soundClicks++; });

  const f = mount([frameBox('f1', 0, 0)], {
    chrome: { themeToggle, soundToggle, saveToLibrary: () => { saves++; } },
  });
  try {
    const keys = markMenuKeys(f);
    for (const k of BAR_SHED.filter((x) => x !== 'save')) {
      assert.ok(!keys.includes(k), `"${k}" moved to the top bar`);
    }
    assert.ok(keys.includes('transition'), 'Slide transition has no other door - see BAR_SHED');
    for (const k of MENU_OWNED) assert.ok(keys.includes(k), `the menu kept "${k}"`);
    assert.ok(keys.includes('shortcuts'), 'the menu is the pointer/touch door onto keyboard help');
    assert.ok(keys.includes('save'), 'Save to your library came back as the chrome-supplied row');
    assert.ok(keys.includes('theme'), 'Theme moved in');
    assert.ok(keys.includes('sound'), 'and Interface sounds');

    // The two preference rows are PROXIES: they click the tool view's own controls.
    const trigger = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-lolly')!;
    click(trigger);
    click(f.stageEl.querySelector<HTMLElement>('.fc-popover [data-pop="theme"]')!);
    click(trigger);
    click(f.stageEl.querySelector<HTMLElement>('.fc-popover [data-pop="sound"]')!);
    click(trigger);
    click(f.stageEl.querySelector<HTMLElement>('.fc-popover [data-pop="save"]')!);
    assert.equal(themeClicks, 1, 'Theme clicked the toggle the view built');
    assert.equal(soundClicks, 1, 'and so did Interface sounds');
    assert.equal(saves, 1, 'Save called the chrome’s own saver');
  } finally { f.destroy(); }
});

test('a menu row opened from the TOP BAR docks its panel to the bar, not to the rail', () => {
  // Four rows open a panel that positions itself under an anchor, and all four passed
  // `lollyBtn` - the RAIL's mark. Open the menu from the bar and pick "Artboard size"
  // or "Custom CSS", and the panel appeared on the far left of the stage, docked to a
  // button nowhere near the control that was clicked.
  const f = mount([frameBox('f1', 0, 0)], { chrome: {} });
  try {
    const barMark = dom.window.document.createElement('button');
    barMark.setAttribute('aria-label', 'More actions');
    barMark.setAttribute('aria-haspopup', 'menu');
    barMark.setAttribute('aria-expanded', 'false');
    barMark.getBoundingClientRect = () => rect(760, 8, 32, 32);
    f.stageEl.appendChild(barMark);

    f.design.openLollyMenu(barMark);
    assert.equal(barMark.getAttribute('aria-expanded'), 'true',
      'the menu\'s owner writes the trigger\'s state - the bar cannot, it does not own the popover');
    const pop = f.stageEl.querySelector<HTMLElement>('.fc-popover')!;
    assert.equal(pop.getAttribute('role'), 'menu');
    assert.ok([...pop.querySelectorAll('.fc-pop-item')].every((b) => b.getAttribute('role') === 'menuitem'),
      'every plain row is a menuitem - only the radio rows used to carry a role at all');
    assert.equal(dom.window.document.activeElement, pop.querySelector('.fc-pop-item'),
      'opening moves focus INTO the menu: it is appended to the stage, so it is after the whole bar in DOM order');

    click(pop.querySelector<HTMLElement>('[data-pop="size"]')!);
    const panel = f.stageEl.querySelector<HTMLElement>('.fc-size-panel');
    assert.ok(panel, 'the row opened the size panel');
    // The size panel opens to its anchor's RIGHT (`ar.right + 8`), so a bar mark at
    // x=760 with a 32px box puts it at 800. Anchored to the rail button - whose rect is
    // 0 here, as it is on the far left of a real stage - it opened at 8.
    assert.equal(panel!.style.left, '800px', 'under the control that was actually clicked');
    assert.equal(barMark.getAttribute('aria-expanded'), 'false', 'and the trigger is reported closed again');
  } finally { f.destroy(); }
});

test('Escape in the mark menu closes it and hands focus back to the trigger', () => {
  const f = mount([frameBox('f1', 0, 0)], { chrome: {} });
  try {
    const barMark = dom.window.document.createElement('button');
    barMark.setAttribute('aria-haspopup', 'menu');
    barMark.setAttribute('aria-expanded', 'false');
    f.stageEl.appendChild(barMark);
    f.design.openLollyMenu(barMark);
    const pop = f.stageEl.querySelector<HTMLElement>('.fc-popover')!;
    const rows = [...pop.querySelectorAll<HTMLButtonElement>('.fc-pop-item')];
    rows[0]!.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert.equal(dom.window.document.activeElement, rows[1], 'arrows roam the rows');
    dom.window.document.activeElement!.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(f.stageEl.querySelector('.fc-popover'), null, 'Escape closes it');
    assert.equal(dom.window.document.activeElement, barMark,
      'with focus on the trigger - a menu removed with focus inside it drops the keyboard on <body>');
  } finally { f.destroy(); }
});

test('when the bar folds its centre away, the menu carries what it dropped', () => {
  // design-topbar.css hides `.dtb-centre` and Share under 640px, and its comment has
  // always said they "fold into the mark menu". They did not: the rows were gated OUT
  // whenever a bar was mounted, so a phone had no reachable Undo, Redo or Share at all -
  // the bar hid them, the menu no longer listed them, and a phone has no ⌘Z.
  //
  // `barFolded()` measures the live `.dtb-centre` instead of restating the breakpoint,
  // so a stand-in bar is all this needs (jsdom reports no layout, which reads as folded
  // - the safe direction: a duplicated row costs nothing, a missing undo costs the edit).
  const f = mount([frameBox('f1', 0, 0)], { chrome: { saveToLibrary: () => {} } });
  try {
    assert.ok(!markMenuKeys(f).includes('undo'), 'precondition: with the bar\'s centre showing, the bar owns undo');
    const bar = dom.window.document.createElement('div');
    bar.className = 'design-topbar';
    bar.innerHTML = '<div class="dtb-centre"></div>';
    f.stageEl.appendChild(bar);
    const keys = markMenuKeys(f);
    for (const k of ['undo', 'redo', 'share']) assert.ok(keys.includes(k), `"${k}" folded into the menu`);
    assert.ok(!keys.includes('export'), 'Export and Present stay on the bar at every width');
    assert.ok(!keys.includes('present'));
  } finally { f.destroy(); }
});

test('a top bar with no toggles to lend adds no preference rows', () => {
  const f = mount([frameBox('f1', 0, 0)], { chrome: {} });
  try {
    const keys = markMenuKeys(f);
    assert.ok(!keys.includes('theme'), 'nothing to proxy, no row');
    assert.ok(!keys.includes('sound'));
    assert.ok(!keys.includes('save'), 'and no Save row without a saver');
    assert.ok(keys.includes('info'), 'the document rows are still there');
  } finally { f.destroy(); }
});

// ══ 8. the filmstrip toggle ═══════════════════════════════════════════════════

test('toggleFramesPanel opens and closes the Artboards filmstrip', () => {
  const f = mount([frameBox('f1', 0, 0), frameBox('f2', 600, 1)]);
  try {
    assert.equal(f.design.isFramesPanelOpen(), false);
    f.design.toggleFramesPanel();
    assert.equal(f.design.isFramesPanelOpen(), true);
    assert.ok(f.stageEl.querySelector('.fc-frames-panel'), 'the strip is on the stage');
    f.design.toggleFramesPanel();
    assert.equal(f.design.isFramesPanelOpen(), false);
    assert.equal(f.stageEl.querySelector('.fc-frames-panel'), null);
  } finally { f.destroy(); }
});

test('the Artboards filmstrip opens on the artboard whose content is selected', () => {
  const f = mount([frameBox('f1', 0, 0), frameBox('f2', 600, 1), childBox('text', 'f2', 620)]);
  try {
    f.design.selection.set(['text']);
    f.design.toggleFramesPanel();
    const cells = [...f.stageEl.querySelectorAll('.fc-frame-cell')];
    assert.deepEqual(cells.map(cell => cell.classList.contains('is-active')), [false, true]);
  } finally { f.destroy(); }
});

test('a mark OUTSIDE the stage (the docked HUD) opens its menu in the viewport, above the dock', () => {
  // The right column is a fixed sibling of the stage stacked above it, so a popover
  // appended to the stage opened behind the column and the button looked dead.
  const f = mount([frameBox('f1', 0, 0)], { chrome: {} });
  try {
    const dockMark = dom.window.document.createElement('button');
    dockMark.setAttribute('aria-haspopup', 'menu');
    dockMark.setAttribute('aria-expanded', 'false');
    dockMark.getBoundingClientRect = () => rect(700, 100, 32, 32);
    dom.window.document.body.appendChild(dockMark);   // not a stage descendant
    f.design.openLollyMenu(dockMark);
    assert.equal(f.stageEl.querySelector('.fc-popover'), null, 'not in the stage');
    const pop = dom.window.document.body.querySelector<HTMLElement>(':scope > .fc-popover')!;
    assert.ok(pop, 'on the body');
    assert.ok(pop.classList.contains('fc-popover--viewport'), 'flagged for the fixed, above-dock placement');
    // placePopover in VIEWPORT coordinates: the trigger's right edge plus the 8px gap, its
    // own top (jsdom lays the menu out at zero size, so nothing clamps).
    assert.equal(pop.style.left, '740px', 'beside the trigger, in viewport coordinates');
    assert.equal(pop.style.top, '100px');
    assert.equal(dockMark.getAttribute('aria-expanded'), 'true');
    pop.querySelector<HTMLElement>('.fc-pop-item')!.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(dom.window.document.body.querySelector(':scope > .fc-popover'), null, 'Escape closes it wherever it lives');
    assert.equal(dockMark.getAttribute('aria-expanded'), 'false');
    dockMark.remove();
  } finally { f.destroy(); }
});

test('mounting the inspector pins the object bar; unmounting it lets the bar auto-hide again', () => {
  const f = mount([frameBox('f1', 0, 0)], { chrome: {} });
  try {
    const bar = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar')!;
    assert.equal(bar.classList.contains('fc-ctxbar--pinned'), false, 'bare canvas tools keep the auto-hide');
    f.design.setInspector({ reveal() {} });
    assert.equal(bar.classList.contains('fc-ctxbar--pinned'), true, 'the Design chrome makes it the selection toolbar');
    f.design.setInspector(null);
    assert.equal(bar.classList.contains('fc-ctxbar--pinned'), false);
  } finally { f.destroy(); }
});
