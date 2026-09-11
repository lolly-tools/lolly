// SPDX-License-Identifier: MPL-2.0
/**
 * Artboard (frame-kind box) gestures - the plans/141 WP-A pins.
 *
 * A frame renders as `.lolly-frame-page[data-frame-id]`, never as a `.lolly-box`, so
 * the live-gesture writers need their frame fallback and the commit paths must cascade
 * members. Three behaviours pinned here:
 *
 *   1. moving a frame commits the frame AND translates its members (regression pin);
 *   2. an origin-moving resize handle (nw) cascades members with the origin - Figma
 *      semantics: children keep their frame-local position;
 *   3. DURING the gesture the frame's own page element tracks the pointer (this was
 *      the "artboards go invisible while dragging" bug: the old `.lolly-box`-only
 *      selector made a frame drag a visual no-op until the commit repaint), and the
 *      lifted page clip is restored verbatim at gesture end.
 *
 * Same jsdom harness as free-canvas-kf-commit.test.ts: real initFreeCanvas, in-memory
 * runtime, model-round-trip assertions.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-frame-gestures.test.ts
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
// The shared colour field escapes selectors with CSS.escape; jsdom exposes it on the
// window but node's global realm has none, so the rail's swatch would throw on edit.
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
  // plans/179: `labelField` is the artboard's own NAME (its tab, and the rename), and the
  // Artboard add-kind is what the create gesture arms to DRAW one.
  labelField: 'name', groupField: 'group', clipField: 'clip', gradField: 'grad',
  addKinds: [
    { id: 'box', label: 'Box', seed: { kind: 'box' } },
    { id: 'frame', label: 'Artboard', seed: { kind: 'frame', bg: '#fafbfe' } },
  ],
};
const FRAME_CFG = { frameField: 'frame', frameKind: 'frame', orderField: 'order', clipChildrenField: 'clipChildren' };

/** One 400×300 artboard at (100,100) with one member box at (150,150). A click at
 *  (400,300) hits empty artboard area - the only way to grab the artboard. */
const SEED = (): Box[] => ([
  { id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300, order: 0, clipChildren: true },
  { id: 'b1', kind: 'box', x: 150, y: 150, w: 100, h: 50, frame: 'f1' },
] as Box[]);

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  byId(id: string): Record<string, unknown>;
  writes(): number;
  /** The document `background` input, or undefined while nothing has written it. */
  background(): unknown;
  /** Set the selection the way a deep link does - no pointer arithmetic needed. */
  select(ids: string[]): void;
  destroy(): void;
}

function mount(seed: Box[]): Fixture {
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
    input: { id: 'boxes', canvas: CFG as never, fields: [] },
    frame: FRAME_CFG,
    nativeW: NATIVE, nativeH: NATIVE,
  });
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    byId: (id: string) => (model.get('boxes') as Box[]).find((b) => b.id === id)! as Record<string, unknown>,
    writes: () => writes,
    background: () => model.get('background'),
    select: (ids: string[]) => handle.applyUi({ select: ids } as never),
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 25)); for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };

/** The page element the tool's TEMPLATE would paint for frame f1 (free-canvas only
 *  drives the model and the chrome, so the live node is built by hand, exactly like
 *  the kf-commit suite builds its `.lolly-box`). */
function addPageEl(f: Fixture): HTMLElement {
  const el = dom.window.document.createElement('div');
  el.className = 'lolly-frame-page';
  el.setAttribute('data-pdf-page', '');
  el.setAttribute('data-frame-id', 'f1');
  el.style.cssText = 'position:absolute;left:100px;top:100px;width:400px;height:300px;overflow:hidden';
  f.canvasEl.appendChild(el);
  return el;
}

test('moving an artboard commits it AND translates its members in one write', async () => {
  const f = mount(SEED());
  try {
    const before = f.writes();
    f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 400, 300));
    f.canvasEl.dispatchEvent(pointerEvent('pointermove', 450, 330));
    await settle();
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 450, 330));
    await settle();

    assert.equal(f.writes() - before, 1, 'one commit, one undo step');
    const fr = f.byId('f1');
    assert.equal(fr.x, 150); assert.equal(fr.y, 130);
    const m = f.byId('b1');
    assert.equal(m.x, 200, 'member travelled with the frame…');
    assert.equal(m.y, 180);
    assert.equal(m.frame, 'f1', '…and kept its membership');
  } finally { f.destroy(); }
});

test('an origin-moving resize handle (nw) cascades members with the origin', async () => {
  const f = mount(SEED());
  try {
    // Select the artboard by its empty area, then grab the nw handle.
    f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 400, 300));
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 400, 300));
    await settle();
    const nw = f.stageEl.querySelector<HTMLElement>('.fc-handle.fc-h-nw');
    assert.ok(nw, 'a selected artboard carries resize handles');

    nw!.dispatchEvent(pointerEvent('pointerdown', 100, 100));
    f.canvasEl.dispatchEvent(pointerEvent('pointermove', 60, 60));
    await settle();
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 60, 60));
    await settle();

    const fr = f.byId('f1');
    assert.equal(fr.x, 60); assert.equal(fr.y, 60);
    assert.equal(fr.w, 440); assert.equal(fr.h, 340, 'opposite corner stayed fixed');
    const m = f.byId('b1');
    assert.equal(m.x, 110, 'member kept its frame-local position (150−40)…');
    assert.equal(m.y, 110);
    assert.equal(m.frame, 'f1', '…and its membership');
  } finally { f.destroy(); }
});

test('the canvas stamps + emits the ACTIVE artboard for the export bar (plans/141 WP-B)', async () => {
  const f = mount(SEED());
  try {
    await settle();
    assert.equal(f.canvasEl.dataset.fcActiveFrame, 'f1',
      'with no selection the primary (lowest-order) artboard is active');
    const events: Array<{ sel: { id: string; w: number; h: number } | null; timed: unknown }> = [];
    f.canvasEl.addEventListener('fc-artboard', (e) => events.push((e as CustomEvent).detail));

    // A committed resize changes the active artboard's size → the emitter re-fires
    // with the new numbers (the export bar mirrors them).
    f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 400, 300));
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 400, 300));
    await settle();
    const nw = f.stageEl.querySelector<HTMLElement>('.fc-handle.fc-h-nw')!;
    nw.dispatchEvent(pointerEvent('pointerdown', 100, 100));
    f.canvasEl.dispatchEvent(pointerEvent('pointermove', 60, 60));
    await settle();
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 60, 60));
    await settle();

    const last = events.at(-1);
    assert.ok(last?.sel, 'the event carries the selected artboard');
    assert.equal(last!.sel!.id, 'f1');
    assert.equal(last!.sel!.w, 440, 'the mirrored size is the committed one');
    assert.equal(last!.sel!.h, 340);
    assert.equal(last!.timed, null, 'no timed pages in this doc');
  } finally { f.destroy(); }
});

test('DURING a drag the frame page element tracks the pointer, and its clip round-trips', async () => {
  const f = mount(SEED());
  try {
    const page = addPageEl(f);
    f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 400, 300));
    f.canvasEl.dispatchEvent(pointerEvent('pointermove', 450, 330));
    await settle();

    // Mid-gesture: the page element itself is the live target (the old `.lolly-box`
    // selector found nothing here - the invisibility bug), its clip is lifted so
    // members can spill while crossing pages, and it is hoisted above later pages.
    assert.equal(page.style.left, '150px', 'the artboard follows the pointer live');
    assert.equal(page.style.top, '130px');
    assert.equal(page.style.overflow, 'visible', 'page clip lifted for the drag');
    assert.equal(page.dataset.fcOverflow, 'hidden', 'original clip stashed verbatim');
    assert.equal(page.style.zIndex, '9999', 'dragged artboard paints above later pages');

    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 450, 330));
    await settle();
    assert.equal(page.style.overflow, 'hidden', 'clip restored verbatim at gesture end');
    assert.equal(page.dataset.fcOverflow, undefined, 'stash cleared');
    assert.equal(page.style.zIndex, '', 'z-hoist dropped');
  } finally { f.destroy(); }
});

// ── plans/179 section 5.2: truthful artboard controls (A1, A7-A11, A13) ────────
//
// The M0 bug wave, driven through the real overlay: the rail's paint swatch, delete,
// duplicate, the explicit page order, the label tabs and the marquee. The pure geometry
// each of these leans on is pinned in tests/free-canvas-math.test.ts; what is pinned HERE
// is the wiring - that the gesture reaches the helper and commits ONE model write.

/** Two 400×300 artboards side by side, each with one child, plus a loose box. */
const DECK = (): Box[] => ([
  { id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300, order: 0, bg: '#ffffff' },
  { id: 'a1', kind: 'box', x: 150, y: 150, w: 100, h: 50, frame: 'f1' },
  { id: 'f2', kind: 'frame', x: 600, y: 100, w: 400, h: 300, order: 1, bg: '#eeeeee' },
  { id: 'b2', kind: 'box', x: 650, y: 150, w: 100, h: 50, frame: 'f2' },
] as Box[]);

const key = (k: string, mods: Partial<KeyboardEventInit> = {}): void => {
  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown',
    { key: k, bubbles: true, cancelable: true, ...mods }));
};

/** The rail's paint swatch (there is exactly one `.fc-color-btn` in the toolbar). */
const swatch = (): HTMLElement => dom.window.document.querySelector('.fc-toolbar .fc-color-btn')!;

/** Type a colour into the swatch's value field, as a user would. */
function typeColour(hex: string): void {
  const input = swatch().querySelector<HTMLInputElement>('.color-input[data-color-hex]')!;
  input.value = hex;
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

test('A1: the rail swatch paints the ACTIVE artboard, not the inert `background` input', async () => {
  const f = mount(DECK());
  try {
    await settle();
    assert.equal(swatch().getAttribute('data-tip'), 'Artboard fill',
      'with artboards in the document the swatch is an artboard fill');

    // Selecting a CHILD of slide 2 makes slide 2 the active artboard.
    f.select(['b2']);
    await settle();
    typeColour('#123456');
    await settle();
    assert.equal(String(f.byId('f2').bg).toLowerCase(), '#123456', 'the artboard holding the selection took the paint');
    assert.equal(f.byId('f1').bg, '#ffffff', 'the other artboard is untouched');
    assert.equal(f.background(), undefined, 'and the inert `background` input was never written');
  } finally { f.destroy(); }
});

test('A3: dragging a gradient stop previews on the ARTBOARD, not only after the commit', async () => {
  const f = mount(SEED());
  try {
    await settle();
    const page = addPageEl(f);
    f.select(['f1']);
    await settle();
    const grad = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx="grad"]');
    assert.ok(grad, 'an artboard is offered a gradient');
    grad!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await settle();
    const stops = f.stageEl.querySelectorAll<HTMLElement>('.fc-grad-stop');
    assert.ok(stops.length >= 2, 'the seeded gradient put handles on the board');
    const before = page.style.backgroundImage;

    // A frame-kind box has NO `.lolly-box` - its element IS the page - so a bare
    // `.lolly-box[data-box-id]` lookup answered null and the whole live write was
    // skipped: the handles tracked the pointer while the board's fill sat still.
    stops[1]!.dispatchEvent(pointerEvent('pointerdown', 300, 250));
    dom.window.dispatchEvent(pointerEvent('pointermove', 250, 220));
    await settle();
    assert.notEqual(page.style.backgroundImage, before, 'the board repaints mid-drag');
    assert.match(page.style.backgroundImage, /gradient/i);
    dom.window.dispatchEvent(pointerEvent('pointerup', 250, 220));
    await settle();
  } finally { f.destroy(); }
});

test('A1: with no artboards the swatch still writes the document background', async () => {
  const f = mount([{ id: 'b1', kind: 'box', x: 10, y: 10, w: 100, h: 50 }] as Box[]);
  try {
    await settle();
    assert.equal(swatch().getAttribute('data-tip'), 'Canvas background');
    typeColour('#654321');
    await settle();
    assert.equal(String(f.background()).toLowerCase(), '#654321');
  } finally { f.destroy(); }
});

test('A7: deleting an artboard re-homes its children onto the previous one, in ONE commit', async () => {
  const f = mount(DECK());
  try {
    await settle();
    f.select(['f2']);
    await settle();
    const before = f.writes();
    key('Delete');
    await settle();

    assert.equal(f.writes() - before, 1, 'one commit, one undo step');
    assert.equal(f.boxes().find((b) => b.id === 'f2'), undefined, 'the artboard is gone');
    const child = f.byId('b2');
    assert.equal(child.frame, 'f1', 'its child moved to the previous artboard…');
    assert.equal(child.x, 150, '…keeping its frame-local position (650−600 → 100+50)');
    assert.equal(child.y, 150);
    assert.match(String(f.stageEl.querySelector('.fc-flash')?.textContent),
      /moved to the previous artboard/, 'and the move is announced');
  } finally { f.destroy(); }
});

test('A7: deleting the FIRST artboard leaves its children on the pasteboard, and says so', async () => {
  const f = mount(DECK());
  try {
    await settle();
    f.select(['f1']);
    await settle();
    key('Delete');
    await settle();

    assert.equal(f.byId('a1').frame, '', 'no previous artboard - the child is cut loose');
    assert.equal(f.byId('a1').x, 150, 'and keeps its own coordinates');
    assert.equal(f.byId('f2').order, 0, 'A9: the surviving artboard renumbers to slide 1');
    assert.match(String(f.stageEl.querySelector('.fc-flash')?.textContent), /on the pasteboard/);
  } finally { f.destroy(); }
});

test('A7: the toast counts only the children that SURVIVE the delete', async () => {
  const f = mount(DECK());
  try {
    await settle();
    // The artboard AND its own child. The child is dropped by the same commit, so
    // announcing it as re-homed described a box that no longer exists.
    f.select(['f1', 'a1']);
    await settle();
    key('Delete');
    await settle();
    assert.equal(f.boxes().find((b) => b.id === 'a1'), undefined, 'the child went with it');
    assert.equal(String(f.stageEl.querySelector('.fc-flash')?.textContent ?? ''), '',
      'nothing was re-homed, so nothing is claimed');
  } finally { f.destroy(); }
});

test('A7: deleting the WHOLE document says nothing about where its items went', async () => {
  const f = mount(DECK());
  try {
    await settle();
    f.select(['f1', 'a1', 'f2', 'b2']);
    await settle();
    key('Delete');
    await settle();
    assert.deepEqual(f.boxes(), [], 'the document is empty');
    assert.equal(String(f.stageEl.querySelector('.fc-flash')?.textContent ?? ''), '',
      'and the toast does not claim 2 items are on a pasteboard that has none');
  } finally { f.destroy(); }
});

test('A8: duplicating an artboard copies its contents, clear of the original, next in order', async () => {
  const f = mount(DECK());
  try {
    await settle();
    f.select(['f1']);
    await settle();
    const before = f.writes();
    key('d', { metaKey: true });
    await settle();

    assert.equal(f.writes() - before, 1, 'one commit');
    const boxes = f.boxes();
    assert.equal(boxes.length, 6, 'the frame AND its child were copied');
    const copyF = boxes.find((b) => b.kind === 'frame' && b.id !== 'f1' && b.id !== 'f2')!;
    const copyC = boxes.find((b) => b.frame === copyF.id)!;
    assert.equal(copyF.x, 1056, 'clear of the WHOLE deck: f2 ends at 1000, + 56');
    assert.equal(copyF.y, 100);
    assert.equal(copyC.x, 1106, 'the child keeps its frame-local (50,50)');
    assert.equal(copyC.y, 150);
    assert.notEqual(copyC.id, 'a1', 'with a fresh id');
    assert.equal(copyF.order, 1, 'the copy is the next slide…');
    assert.equal(f.byId('f2').order, 2, '…and the one that was slide 2 becomes slide 3');
    assert.equal(f.byId('a1').frame, 'f1', 'the ORIGINAL child still belongs to the original');
    // The copy must not land on the NEXT board either: nudge f2's child and it stays on f2.
    f.select(['b2']);
    await settle();
    key('ArrowRight');
    await settle();
    assert.equal(f.byId('b2').frame, 'f2', 'slide 2 keeps its own content after the duplicate');
  } finally { f.destroy(); }
});

test('A8/A9: copy+paste of an artboard is a real slide copy, not an empty page over slide 1', async () => {
  const f = mount(DECK());
  try {
    await settle();
    f.select(['f1']);
    await settle();
    // Drive the real document-level copy/paste handlers with a stub DataTransfer.
    const store: Record<string, string> = {};
    const clipboardData = {
      setData: (type: string, v: string) => { store[type] = v; },
      getData: (type: string) => store[type] ?? '',
    };
    const fire = (type: string): void => {
      const e = new dom.window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'clipboardData', { value: clipboardData });
      dom.window.document.dispatchEvent(e);
    };
    fire('copy');
    await settle();
    fire('paste');
    await settle();

    const boxes = f.boxes();
    const copyF = boxes.find((b) => b.kind === 'frame' && b.id !== 'f1' && b.id !== 'f2')!;
    assert.ok(copyF, 'the paste made an artboard');
    // Not `src.x + 24`: that put an EMPTY board on top of the one it came from, and
    // because the paste is appended last, resolveFrame handed slide 1's children to it.
    assert.equal(copyF.x, 1056, 'clear of every board: f2 ends at 1000, + 56');
    assert.equal(copyF.order, 2, 'and it takes the next page slot, not a duplicate of slide 1’s');
    const kid = boxes.find((b) => b.frame === copyF.id);
    assert.ok(kid, 'the slide arrived with its content, not as a blank page');
    assert.notEqual(kid!.id, 'a1', 'with a fresh id');
    assert.equal(f.byId('a1').frame, 'f1', 'and the original still owns its own child');
  } finally { f.destroy(); }
});

test('A9: an artboard DRAWN to the left of the deck is the last slide, not the first', async () => {
  const f = mount(DECK());
  try {
    await settle();
    // Arm the Artboard tool through the rail's own add menu, then drag out a board at
    // x 10..90 - to the LEFT of both existing artboards.
    (dom.window.document.querySelector('.fc-btn-add') as HTMLElement).click();
    const item = [...dom.window.document.querySelectorAll<HTMLElement>('.fc-popover button')]
      .find((b) => /Artboard/.test(b.textContent || ''))!;
    assert.ok(item, 'the add menu offers the Artboard kind');
    item.click();
    await settle();

    f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 10, 600));
    f.canvasEl.dispatchEvent(pointerEvent('pointermove', 90, 680));
    await settle();
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 90, 680));
    await settle();

    const drawn = f.boxes().find((b) => b.kind === 'frame' && b.id !== 'f1' && b.id !== 'f2')!;
    assert.ok(drawn, 'an artboard was drawn');
    assert.equal(drawn.order, 2, 'it takes the next page slot despite sitting furthest left');
  } finally { f.destroy(); }
});

test('A9: a LEGACY document (frames, no order anywhere) is seeded from x on the first such commit', async () => {
  const f = mount([
    { id: 'right', kind: 'frame', x: 900, y: 0, w: 300, h: 200 },
    { id: 'left', kind: 'frame', x: 100, y: 0, w: 300, h: 200 },
    { id: 'kid', kind: 'box', x: 120, y: 20, w: 50, h: 50, frame: 'left' },
  ] as Box[]);
  try {
    await settle();
    f.select(['right']);
    await settle();
    key('d', { metaKey: true });          // duplicate: a frame-creating commit
    await settle();
    assert.equal(f.byId('left').order, 0, 'the left-hand board was slide 1 all along');
    assert.equal(f.byId('right').order, 1);
    const copy = f.boxes().find((b) => b.kind === 'frame' && b.id !== 'left' && b.id !== 'right')!;
    assert.equal(copy.order, 2, 'and the copy follows the board it came from');
  } finally { f.destroy(); }
});

test('A10: a frame label shows its NAME, and a double-click renames it', async () => {
  const f = mount(DECK());
  try {
    await settle();
    const tabs = () => [...f.stageEl.querySelectorAll<HTMLElement>('.fc-frame-label')];
    assert.deepEqual(tabs().map((el) => el.textContent), ['Artboard 1', 'Artboard 2'],
      'unnamed artboards fall back to their 1-based place in the page order');

    tabs()[1]!.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    const input = f.stageEl.querySelector<HTMLInputElement>('.fc-frame-rename');
    assert.ok(input, 'the tab became an editor');
    input!.value = 'Closing';
    input!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle();

    assert.equal(f.byId('f2').name, 'Closing', 'Enter saves the name onto the frame');
    assert.equal(f.stageEl.querySelector('.fc-frame-rename'), null, 'the editor is gone');
    assert.deepEqual(tabs().map((el) => el.textContent), ['Artboard 1', 'Closing']);
  } finally { f.destroy(); }
});

test('A10: F2 and Enter reach the rename from the keyboard, and hand the focus back', async () => {
  // The only affordance was a `title` that says "Double-click to rename": pressing Enter
  // on a focused tab fired `click`, which merely solos the frame. And the finish had no
  // focus hand-back at all - the input was removed and the tab rebuilt, so focus fell to
  // <body>, where the next Tab restarts at the top of the page and every bare canvas
  // shortcut is live again.
  const f = mount(DECK());
  try {
    await settle();
    const tab = () => f.stageEl.querySelector<HTMLElement>('.fc-frame-label')!;
    assert.equal(tab().getAttribute('aria-keyshortcuts'), 'F2 Enter', 'and it says so');

    tab().focus();
    tab().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true }));
    let input = f.stageEl.querySelector<HTMLInputElement>('.fc-frame-rename');
    assert.ok(input, 'F2 opens the editor');
    input!.value = 'Opening';
    input!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle();
    assert.equal(f.byId('f1').name, 'Opening');
    assert.equal(dom.window.document.activeElement, tab(), 'focus came back to the tab that was renamed');

    // Enter is the key a person tries first, and preventDefault is what stops the button
    // synthesising the click that would only solo the frame.
    const ev = new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    tab().dispatchEvent(ev);
    assert.equal(ev.defaultPrevented, true);
    input = f.stageEl.querySelector<HTMLInputElement>('.fc-frame-rename');
    assert.ok(input, 'Enter opens it too');
    input!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await settle();
    assert.equal(dom.window.document.activeElement, tab(), 'a cancelled rename hands the focus back as well');
  } finally { f.destroy(); }
});

test('A10: Escape cancels a rename and writes nothing', async () => {
  const f = mount(DECK());
  try {
    await settle();
    const before = f.writes();
    const tab = f.stageEl.querySelector<HTMLElement>('.fc-frame-label')!;
    tab.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    const input = f.stageEl.querySelector<HTMLInputElement>('.fc-frame-rename')!;
    input.value = 'Nope';
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await settle();
    assert.equal(f.byId('f1').name, undefined);
    assert.equal(f.writes(), before, 'nothing committed');
  } finally { f.destroy(); }
});

test('A11: the still-export artboard follows the artboard CONTAINING the selection', async () => {
  const f = mount(DECK());
  try {
    await settle();
    assert.equal(f.canvasEl.dataset.fcActiveFrame, 'f1', 'no selection → the primary artboard');
    const seen: string[] = [];
    f.canvasEl.addEventListener('fc-artboard', (e) => {
      const d = (e as CustomEvent).detail as { sel: { id: string } | null };
      if (d.sel) seen.push(d.sel.id);
    });
    f.select(['b2']);            // a CHILD of slide 2, not the slide itself
    await settle();
    assert.equal(f.canvasEl.dataset.fcActiveFrame, 'f2');
    assert.equal(seen.at(-1), 'f2', 'the export bar is told about slide 2');
  } finally { f.destroy(); }
});

test('A13: a marquee takes an artboard only when it encloses it whole', async () => {
  const f = mount(DECK());
  try {
    await settle();
    // A band across the middle of artboard 1: it crosses the page and covers its child.
    f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 20, 140));
    f.canvasEl.dispatchEvent(pointerEvent('pointermove', 300, 260));
    await settle();
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 300, 260));
    await settle();
    // What the marquee GRABBED is read back by deleting it: the active-artboard stamp
    // would say f1 either way (a child of f1 resolves to f1), so the model is the honest
    // witness here.
    const before = f.boxes().length;
    key('Delete');
    await settle();
    assert.equal(f.boxes().length, before - 1, 'exactly one box went - the child, not the page');
    assert.ok(f.boxes().some((b) => b.id === 'f1'), 'the partially-crossed artboard survived');
    assert.equal(f.boxes().find((b) => b.id === 'a1'), undefined, 'the enclosed child did not');
  } finally { f.destroy(); }
});

test('A13: a marquee that encloses an artboard whole DOES take it', async () => {
  const f = mount(DECK());
  try {
    await settle();
    f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 20, 20));
    f.canvasEl.dispatchEvent(pointerEvent('pointermove', 540, 460));
    await settle();
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 540, 460));
    await settle();
    key('Delete');
    await settle();
    assert.equal(f.boxes().find((b) => b.id === 'f1'), undefined, 'the enclosed artboard went');
    assert.ok(f.boxes().some((b) => b.id === 'f2'), 'and only that one');
  } finally { f.destroy(); }
});
