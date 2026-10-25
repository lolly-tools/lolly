// SPDX-License-Identifier: MPL-2.0
/**
 * The chrome sync while the view moves (Design canvas performance review, A2, A3, C7).
 *
 * A pan or zoom writes the stage transform, and every write used to run the whole chrome
 * sync: an accessibility walk over every card, two whole-canvas selector scans per
 * artboard title, the active-artboard search and the selection notice. Now a view that
 * moved only moves what is drawn in stage pixels, the canvas is read once per paint
 * through an id index, and the card stamps are written once per paint. What is pinned:
 *
 *   1. a pan burst runs no selector over the canvas (or over the document holding it) and
 *      never walks the cards, while the outlines and titles still follow the view, and
 *      the full sync runs once when the view rests. The one exception is the first frame
 *      with a selection, which measures the chrome round the context bar's row once and
 *      holds it for the burst;
 *   2. the cards carry the same stamps the per-sync walk wrote: a selection change moves
 *      `aria-pressed` alone, and a paint that patched a card relabels it from its text;
 *   3. past OUTLINE_CAP selected rows, the rows' outlines are one path.
 *
 * Real initFreeCanvas in jsdom, as in free-canvas-frame-gestures.test.ts; the cards are
 * built by hand because free-canvas never renders them itself.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-view-sync.test.ts
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
const win = dom.window;
for (const k of [
  'window', 'document', 'HTMLElement', 'Element', 'KeyboardEvent', 'Event', 'CustomEvent',
  'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver',
]) {
  (globalThis as Record<string, unknown>)[k] = (win as unknown as Record<string, unknown>)[k];
}
// Frames run when the test says so, so each step of a burst is one frame.
const rafQueue: Array<() => void> = [];
globalThis.requestAnimationFrame = ((fn: FrameRequestCallback) => {
  rafQueue.push(() => fn(0));
  return rafQueue.length;
}) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
function frames(n = 3): void {
  for (let i = 0; i < n; i++) for (const fn of rafQueue.splice(0, rafQueue.length)) fn();
}
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };
(globalThis as Record<string, unknown>).CSS = (win as unknown as { CSS?: unknown }).CSS
  ?? { escape: (v: string) => String(v).replace(/[^\w-]/g, (c) => `\\${c}`) };

const { initFreeCanvas } = await import('./free-canvas.ts');
const { OUTLINE_CAP, VIEW_SETTLE_MS } = await import('./free-canvas/chrome-sync.ts');

const NATIVE = 1000;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

const CFG = {
  idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  rotationField: 'rot', fillField: 'bg', labelField: 'name',
  addKinds: [
    { id: 'box', label: 'Box', seed: { kind: 'box' } },
    { id: 'frame', label: 'Artboard', seed: { kind: 'frame', bg: '#fafbfe' } },
  ],
};
const FRAME_CFG = { frameField: 'frame', frameKind: 'frame', orderField: 'order' };

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  /** The screen point of native (0, 0): what a pan changes. */
  view: { x: number; y: number };
  card(id: string): HTMLElement;
  select(ids: string[]): void;
  setBoxes(rows: Box[]): void;
  destroy(): void;
}

/** Two artboards and their cards, painted by hand the way Design's template paints them:
 *  an artboard is a `.lolly-frame-page`, a card inside it a `.lolly-box`. */
function mount(rows: Box[]): Fixture {
  const doc = win.document;
  const viewEl = doc.createElement('div');
  const stageEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  doc.body.appendChild(viewEl);
  const view = { x: 0, y: 0 };
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(view.x, view.y, NATIVE, NATIVE);
  const pages = new Map<string, HTMLElement>();
  for (const b of rows) {
    const r = b as unknown as { id: string; kind: string; x: number; y: number; w: number; h: number; frame?: string; text?: string };
    const el = doc.createElement('div');
    if (r.kind === 'frame') {
      el.className = 'lolly-frame-page';
      el.setAttribute('data-pdf-page', '');
      el.setAttribute('data-frame-id', r.id);
      pages.set(r.id, el);
    } else {
      el.className = 'lolly-box';
      el.setAttribute('data-box-id', r.id);
      el.textContent = r.text ?? '';
    }
    el.getBoundingClientRect = () => rect(view.x + r.x, view.y + r.y, r.w, r.h);
    (r.frame ? pages.get(r.frame)! : canvasEl).appendChild(el);
  }
  const model = new Map<string, unknown>([['boxes', rows]]);
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
    frame: FRAME_CFG,
    nativeW: NATIVE, nativeH: NATIVE,
  });
  frames();
  return {
    stageEl, canvasEl, view,
    card: (id) => canvasEl.querySelector<HTMLElement>(`.lolly-box[data-box-id="${id}"]`)!,
    select: (ids) => { handle.applyUi({ select: ids } as never); frames(); },
    setBoxes: (next) => runtime.setInput('boxes', next),
    destroy() { handle.destroy(); viewEl.remove(); },
  };
}

const ROWS = (): Box[] => ([
  { id: 'f1', kind: 'frame', x: 100, y: 100, w: 400, h: 300, order: 0 },
  { id: 'f2', kind: 'frame', x: 600, y: 100, w: 300, h: 300, order: 1 },
  { id: 'b1', kind: 'box', x: 120, y: 120, w: 100, h: 50, frame: 'f1', text: 'Hello   world' },
  { id: 'b2', kind: 'box', x: 240, y: 200, w: 100, h: 50, frame: 'f1', text: 'Second card' },
  { id: 'b3', kind: 'box', x: 620, y: 120, w: 100, h: 50, frame: 'f2', text: '' },
  { id: 'b4', kind: 'box', x: 20, y: 600, w: 80, h: 40, text: 'Loose' },
] as unknown as Box[]);

interface Counts { canvasQueries: string[]; otherQueries: string[]; cardWalks: number }
/**
 * Count every selector call and every card the stamps walk look at, while `run` runs. A
 * query rooted at the canvas, inside it or at anything holding it (the document, the
 * stage) matches against every card; one rooted in the overlay or the toolbar does not.
 */
function counting(f: Fixture, run: () => void | Promise<void>): Promise<Counts> {
  const counts: Counts = { canvasQueries: [], otherQueries: [], cardWalks: 0 };
  const protos = [win.Element.prototype, win.Document.prototype, win.DocumentFragment.prototype] as unknown as Array<Record<string, (s: string) => unknown>>;
  const saved: Array<() => void> = [];
  for (const proto of protos) {
    for (const name of ['querySelector', 'querySelectorAll']) {
      const original = proto[name]!;
      proto[name] = function (this: Node, selector: string) {
        const touches = this === win.document || this === f.canvasEl || f.canvasEl.contains(this) || this.contains(f.canvasEl);
        (touches ? counts.canvasQueries : counts.otherQueries).push(selector);
        return original.call(this, selector);
      };
      saved.push(() => { proto[name] = original; });
    }
  }
  const hasAttribute = win.Element.prototype.hasAttribute;
  win.Element.prototype.hasAttribute = function (this: Element, name: string) {
    if (name === 'tabindex' && this.classList.contains('lolly-box')) counts.cardWalks++;
    return hasAttribute.call(this, name);
  };
  saved.push(() => { win.Element.prototype.hasAttribute = hasAttribute; });
  return Promise.resolve()
    .then(run)
    .then(() => counts)
    .finally(() => { for (const undo of saved) undo(); });
}

/** One pan step, as the stage navigation makes it: the transform write the wrapper's
 *  observer sees, then the frame the sync was coalesced into. */
async function panBy(f: Fixture, dx: number, dy: number): Promise<void> {
  f.view.x += dx;
  f.view.y += dy;
  f.stageEl.style.transform = `translate(${f.view.x}px, ${f.view.y}px)`;
  await new Promise((r) => setTimeout(r, 0)); // the MutationObserver's delivery
  frames(1);
}

const outlines = (f: Fixture): HTMLElement[] =>
  [...f.stageEl.querySelectorAll<HTMLElement>('.fc-chrome .fc-outline:not(.fc-group-outline)')];
const titles = (f: Fixture): HTMLElement[] => [...f.stageEl.querySelectorAll<HTMLElement>('.fc-frame-label')];

/** The context bar's row: the chrome it dodges, measured once per burst (keys.ts). */
const CTX_ROW = ['.stage-nav', '.fc-nav', '.chrome-topleft, .tools-home'];

test('a pan burst with nothing selected reads nothing from the canvas on any frame', async () => {
  const f = mount(ROWS());
  try {
    const counts = await counting(f, async () => {
      for (let i = 0; i < 8; i++) await panBy(f, -7, 3);
    });
    assert.deepEqual(counts.canvasQueries, [], 'no selector ran over the canvas or the document');
    assert.equal(counts.cardWalks, 0, 'and no card was walked');
  } finally { f.destroy(); }
});

test('a pan burst reads nothing from the canvas and walks no cards, and the chrome still follows the view', async () => {
  const f = mount(ROWS());
  try {
    f.select(['b1', 'b3']);
    assert.equal(outlines(f).length, 2, 'precondition: both rows are outlined');
    assert.equal(titles(f).length, 2, 'precondition: each artboard holding the selection shows its title');
    const outlineAt = outlines(f).map((o) => o.style.left);
    const titleAt = titles(f).map((t) => t.style.left);
    const STEPS = 12;
    const first = await counting(f, () => panBy(f, 10, 5));
    const counts = await counting(f, async () => {
      for (let i = 1; i < STEPS; i++) await panBy(f, 10, 5);
    });
    assert.deepEqual(first.canvasQueries, CTX_ROW, 'the first frame measures the context bar row, once');
    assert.deepEqual(counts.canvasQueries, [], 'no later frame ran a selector over the canvas');
    assert.equal(first.cardWalks + counts.cardWalks, 0, 'the accessibility stamps never walked the cards during the pan');
    assert.deepEqual(
      outlines(f).map((o) => o.style.left),
      outlineAt.map((left) => `${parseFloat(left) + STEPS * 10}px`),
      'the outlines followed the view'
    );
    assert.deepEqual(
      titles(f).map((t) => t.style.left),
      titleAt.map((left) => `${parseFloat(left) + STEPS * 10}px`),
      'the artboard titles followed the view'
    );
    // The view rests: one full sync catches up on what the pan frames left alone. Its
    // active-artboard lookup (the page under the playhead) is a canvas query that no
    // view-only frame makes.
    const settled = await counting(f, async () => {
      await new Promise((r) => setTimeout(r, VIEW_SETTLE_MS + 30));
      frames(2);
    });
    const activeLookups = (q: string[]): number => q.filter((s) => s.startsWith('[data-pdf-page][data-t-start]')).length;
    assert.equal(activeLookups(settled.canvasQueries), 1, 'one full sync once the view rested');
    assert.equal(settled.cardWalks, 0, 'with no paint in between, the cards are not walked again');
  } finally { f.destroy(); }
});

/**
 * The walk every chrome sync used to run, verbatim, applied to a copy of the canvas. The
 * stamps reach exports (Penpot layer names in its DOM fallback, `aria-pressed` in the HTML
 * player), so after any sync the live cards must hold exactly what this would leave.
 */
function walkedBefore(canvasEl: HTMLElement, selection: Set<string>): HTMLElement {
  const copy = canvasEl.cloneNode(true) as HTMLElement;
  copy.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]').forEach((el) => {
    const id = el.getAttribute('data-box-id') || '';
    if (!el.hasAttribute('tabindex')) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      el.setAttribute('aria-label', txt ? `Card: ${txt}` : 'Card');
    }
    const on = selection.has(id);
    if ((el.getAttribute('aria-pressed') === 'true') !== on) el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  return copy;
}
const STAMPS = ['tabindex', 'role', 'aria-label', 'aria-pressed'];
function sameStampsAsBefore(f: Fixture, selection: string[], step: string): void {
  const before = walkedBefore(f.canvasEl, new Set(selection));
  const live = [...f.canvasEl.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]')];
  const copied = [...before.querySelectorAll<HTMLElement>('.lolly-box[data-box-id]')];
  assert.equal(live.length, copied.length);
  live.forEach((el, n) => {
    for (const attr of STAMPS)
      assert.equal(el.getAttribute(attr), copied[n]!.getAttribute(attr), `${step}: ${el.getAttribute('data-box-id')} ${attr}`);
  });
}

test('the cards carry the stamps the per-sync walk wrote, written once per paint', async () => {
  const f = mount(ROWS());
  try {
    sameStampsAsBefore(f, [], 'mount');
    assert.equal(f.card('b1').getAttribute('tabindex'), '0');
    assert.equal(f.card('b1').getAttribute('role'), 'button');
    assert.equal(f.card('b1').getAttribute('aria-label'), 'Card: Hello world', 'the text, whitespace folded');
    assert.equal(f.card('b3').getAttribute('aria-label'), 'Card', 'an empty card is a Card');
    assert.equal(f.card('b1').hasAttribute('aria-pressed'), false, 'a card never selected carries no aria-pressed, as before');

    // A selection change moves aria-pressed from the old rows to the new ones, and walks nothing.
    f.select(['b1', 'b4']);
    sameStampsAsBefore(f, ['b1', 'b4'], 'select b1 and b4');
    const counts = await counting(f, () => f.select(['b2']));
    assert.equal(counts.cardWalks, 0, 'a selection change walks no cards');
    assert.deepEqual(counts.canvasQueries.filter((q) => q.includes('lolly-box')), [], 'and looks up none');
    sameStampsAsBefore(f, ['b2'], 'select b2');
    assert.equal(f.card('b1').getAttribute('aria-pressed'), 'false');
    assert.equal(f.card('b2').getAttribute('aria-pressed'), 'true');

    // A pan between them changes no stamp.
    await panBy(f, 30, 0);
    sameStampsAsBefore(f, ['b2'], 'pan');

    // A text edit arrives as a content patch: the card keeps its element, takes the
    // template's attributes (which carry no stamps) and its new text. The paint signal is
    // what tells the stamps to look again.
    const b2 = f.card('b2');
    for (const attr of STAMPS) b2.removeAttribute(attr);
    b2.textContent = 'Edited  heading';
    f.canvasEl.dispatchEvent(new win.CustomEvent('lolly-canvas-painted'));
    const repaint = await counting(f, () => {
      f.setBoxes([...ROWS()]);
      frames();
    });
    assert.equal(repaint.cardWalks, 4, 'the first sync after the paint walks each card once');
    assert.equal(b2.getAttribute('aria-label'), 'Card: Edited heading', 'the screen reader label follows the edit');
    sameStampsAsBefore(f, ['b2'], 'text edit');
    const again = await counting(f, () => {
      f.setBoxes([...ROWS()]);
      frames();
    });
    assert.equal(again.cardWalks, 0, 'a sync with no paint before it walks nothing');
  } finally { f.destroy(); }
});

test(`past ${OUTLINE_CAP} selected rows the outlines are one path, below it a div per row`, () => {
  const many = Array.from({ length: OUTLINE_CAP + 6 }, (_, i) => (
    { id: `r${i}`, kind: 'box', x: (i % 10) * 60, y: Math.floor(i / 10) * 60, w: 40, h: 40, text: `Row ${i}` }
  )) as unknown as Box[];
  const f = mount(many);
  try {
    f.select(many.slice(0, 3).map((b) => String((b as unknown as { id: string }).id)));
    assert.equal(outlines(f).length, 3, 'a small selection keeps its div per row');
    assert.equal(f.stageEl.querySelector('.fc-chrome .fc-outlines'), null);

    f.select(many.map((b) => String((b as unknown as { id: string }).id)));
    assert.equal(outlines(f).length, 0, 'no div per row past the cap');
    const path = f.stageEl.querySelector('.fc-chrome .fc-outlines path');
    assert.ok(path, 'one path holds the outlines');
    assert.equal((path!.getAttribute('d') ?? '').match(/M/g)?.length, many.length, 'one closed outline per row');
    assert.ok(path!.getAttribute('d')!.startsWith('M0 0L40 0L40 40L0 40Z'), 'drawn on the row in stage px');
    assert.ok(f.stageEl.querySelector('.fc-chrome .fc-group-outline'), 'the group outline stays');
    assert.equal(f.stageEl.querySelectorAll('.fc-chrome .fc-handle:not(.fc-h-rotate)').length, 8, 'and its handles');
  } finally { f.destroy(); }
});
