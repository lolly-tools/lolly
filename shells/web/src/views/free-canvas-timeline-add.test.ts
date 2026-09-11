// SPDX-License-Identifier: MPL-2.0
/**
 * The FREE-CANVAS half of the `tl-add` seam.
 *
 * `timeline-panel.test.ts` covers the dispatch side (the `+` menu reads the manifest's
 * addKinds, `atMs` is the playhead read at click time). This file covers the receiving
 * side, which had no coverage at all: the listener's validation of an untrusted
 * CustomEvent, and - the part that actually broke - that "this box is being added FROM
 * the timeline, so time it" is a ONE-SHOT flag which cannot leak into the next box the
 * user draws by hand.
 *
 * Everything runs against the real `initFreeCanvas` and the real, lazily imported
 * `timeline-panel.ts`, on the jsdom harness free-canvas-pen.test.ts established: an
 * in-memory runtime that echoes `setInput` back through `getModel`, so every assertion
 * below is a round trip through the model rather than a spy on a call.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-timeline-add.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';

// timeline-panel.ts imports its own stylesheet (the self-registering lazy-view pattern),
// and free-canvas reaches it through a dynamic import. Node has no idea what a .css
// module is, so stub it in-thread - Vite is what resolves it for real.
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

function pointerEvent(type: string, x: number, y: number): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

/** Sequence Studio's canvas block, trimmed to what this file exercises: all ten time
 *  fields (so `timeCfg` resolves) and three add-kinds that differ in what they seed. */
function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', groupField: 'group', clipField: 'clip', imageField: 'image', fitField: 'fit',
    startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
    enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
    muteField: 'mute', laneField: 'lane',
    addKinds: [
      { id: 'audio', label: 'Audio', seed: { kind: 'audio' } },
      { id: 'image', label: 'Image', seed: { kind: 'image', fit: 'contain' } },
      // The magnetic-row kinds: `card` authors its OWN length, `clip` deliberately does not.
      { id: 'card', label: 'Card', seed: { kind: 'box', lane: 'seq', dur: 2.5, bg: '#14181d', text: '' } },
      { id: 'clip', label: 'Clip', seed: { kind: 'image', lane: 'seq', fit: 'cover' } },
    ],
  };
}

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  armed(): boolean;
  destroy(): void;
}

function mount(): Fixture {
  const viewEl = dom.window.document.createElement('div');
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  dom.window.document.body.appendChild(viewEl);
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  const model = new Map<string, unknown>([['boxes', [] as Box[]]]);
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
    input: { id: 'boxes', canvas: canvasCfg() as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    armed: () => stageEl.classList.contains('fc-arming'),
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

/** Let the lazy timeline chunk resolve and any queued frame run. */
const settle = async (): Promise<void> => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

/** What the panel dispatches, dispatched from where the panel dispatches it. */
function tlAdd(f: Fixture, detail: unknown): void {
  f.stageEl.dispatchEvent(new W.CustomEvent('tl-add', { bubbles: true, detail }));
}

/** Drag out one box on the canvas. */
function draw(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', x, y));
  f.canvasEl.dispatchEvent(pointerEvent('pointermove', x + 160, y + 120));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', x + 160, y + 120));
}

/** Open the timeline the way the rail does, and wait for the chunk. */
async function openPanel(f: Fixture): Promise<void> {
  const b = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-timeline');
  assert.ok(b, 'a time-capable tool gets a timeline button on the rail');
  click(b!);
  await settle();
  assert.ok(f.stageEl.querySelector('.tl-panel'), 'the timeline panel mounted');
}

// ── the listener rejects a hostile / malformed detail ─────────────────────────

test('tl-add with a kind the manifest does not declare arms nothing', async () => {
  const f = mount();
  try {
    tlAdd(f, { kind: 'widget', atMs: 0 });
    assert.equal(f.armed(), false, 'an unknown add-kind must not arm create mode');
    tlAdd(f, { kind: '__proto__', atMs: 0 });
    assert.equal(f.armed(), false, 'nor may a prototype key masquerade as one');
    tlAdd(f, null);
    assert.equal(f.armed(), false, 'nor a detail-less event');
  } finally { f.destroy(); }
});

test('tl-add with a non-finite, negative or absurd atMs arms nothing', async () => {
  const f = mount();
  try {
    for (const atMs of [Number.NaN, Infinity, -1, 25 * 60 * 60 * 1000, '2000', null, undefined]) {
      tlAdd(f, { kind: 'audio', atMs });
      assert.equal(f.armed(), false, `atMs ${String(atMs)} must not arm create mode`);
    }
    // …and the good one still does, so the guard is not simply refusing everything.
    tlAdd(f, { kind: 'audio', atMs: 2000 });
    assert.equal(f.armed(), true);
  } finally { f.destroy(); }
});

// ── a box added FROM the timeline lands timed, and open-ended ─────────────────

test('audio added from the timeline lands TIMED at the playhead with NO authored length', async () => {
  const f = mount();
  try {
    await openPanel(f);
    tlAdd(f, { kind: 'audio', atMs: 2000 });
    assert.equal(f.armed(), true, 'the timeline arm reaches create mode');
    draw(f, 100, 100);
    await settle();

    const boxes = f.boxes();
    assert.equal(boxes.length, 1, 'one box was created');
    const b = boxes[0]! as Record<string, unknown>;
    assert.equal(b.kind, 'audio', 'the seeded kind survived');
    assert.equal(b.start, 2, 'it starts at the playhead time the panel named, in SECONDS');
    assert.equal(b.lane ?? '', '', 'and on an overlay lane, never the magnetic spine');
    // The whole point: promote() runs before the asset picker, so nothing can know the
    // track's length yet. Authoring one here is what pinned a 45s track to 3s.
    assert.ok(b.dur === undefined || b.dur === '' || b.dur === null,
      `no length may be authored before the media is known (got ${JSON.stringify(b.dur)})`);
  } finally { f.destroy(); }
});

test('a seq-row kind keeps its OWN seeded length - the timeline add never overwrites it', async () => {
  const f = mount();
  try {
    await openPanel(f);
    const addBtn = f.stageEl.querySelector<HTMLButtonElement>('.tl-add');
    assert.ok(addBtn, 'the panel offers a + button');
    tlAdd(f, { kind: 'card', atMs: 5000 });
    draw(f, 200, 200);
    await settle();

    const b = f.boxes()[0]! as Record<string, unknown>;
    assert.equal(b.dur, 2.5, 'the card add-kind seeds 2.5s and promote must respect it');
    assert.equal(b.lane, 'seq', 'a seq clip stays on the spine');
  } finally { f.destroy(); }
});

test('a seq clip added from the timeline keeps its length UNAUTHORED, so the pack can derive it', async () => {
  const f = mount();
  try {
    await openPanel(f);
    tlAdd(f, { kind: 'clip', atMs: 4000 });
    draw(f, 300, 300);
    await settle();

    const b = f.boxes()[0]! as Record<string, unknown>;
    assert.ok(b.dur === undefined || b.dur === '' || b.dur === null,
      `the clip seed authors no dur on purpose - packSeq fills it from the media (got ${JSON.stringify(b.dur)})`);
  } finally { f.destroy(); }
});

// ── the one-shot flag cannot leak ─────────────────────────────────────────────

test('a recorded take (tl-add WITH an asset) joins the sequence row full-frame, cover-fit, after the end', async () => {
  const f = mount();
  try {
    await openPanel(f);
    // Something already on the row, so "after the end" has a meaning.
    tlAdd(f, { kind: 'card', atMs: 0 });
    draw(f, 100, 100);
    await settle();
    assert.equal(f.boxes().length, 1, 'precondition: the card is on the row');

    const asset = { source: 'user', id: 'user/recording/1.mp4', type: 'video', url: 'blob:x' };
    tlAdd(f, { kind: 'clip', atMs: 0, asset, durSec: 4.2 });
    await settle();
    assert.equal(f.armed(), false, 'no create gesture: the clip is committed at once, no picker');
    const boxes = f.boxes();
    assert.equal(boxes.length, 2, 'one box was added');
    const b = boxes[1]! as Record<string, unknown>;
    assert.equal(b.kind, 'image', 'born from the clip seed');
    assert.equal(b.lane, 'seq', 'on the magnetic row, like an imported scene');
    assert.equal(b.fit, 'cover', 'fills the frame edge to edge');
    assert.deepEqual(b.image, asset, 'carries the recording');
    assert.deepEqual([b.x, b.y, b.w, b.h], [0, 0, NATIVE, NATIVE], 'sized to the whole canvas when no artboard is active');
    assert.equal(b.dur, 4.2, 'the MEASURED length is authored - the media cannot be read before it renders');
    assert.ok(typeof b.start === 'number' && b.start >= 0, 'a finite start: the row repacks from array order');
  } finally { f.destroy(); }
});

test('a tl-add whose asset has no string id is an ordinary arm, never a box', async () => {
  const f = mount();
  try {
    await openPanel(f);
    tlAdd(f, { kind: 'clip', atMs: 0, asset: { url: 'blob:x' }, durSec: 1 });
    await settle();
    assert.equal(f.boxes().length, 0, 'nothing was committed');
    assert.equal(f.armed(), true, 'the hostile detail degraded to the plain arm');
  } finally { f.destroy(); }
});

test('re-arming from the RAIL after a timeline arm draws SCENERY, not a timed box', async () => {
  const f = mount();
  try {
    await openPanel(f);
    // Arm from the timeline…
    tlAdd(f, { kind: 'audio', atMs: 9000 });
    assert.equal(f.armed(), true);
    // …then, without drawing, arm a different kind from the rail. This is a
    // create→create transition, which setMode short-circuits: exitCreate never runs, so
    // the pending playhead time used to survive and time the box drawn below.
    const add = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-add');
    assert.ok(add, 'the rail has an add button');
    click(add!);
    const item = [...f.stageEl.querySelectorAll<HTMLButtonElement>('.fc-pop-item, .fc-pop-gitem')]
      .find((el) => /image/i.test(el.textContent || ''));
    assert.ok(item, 'the rail add menu offers the Image kind');
    click(item!);
    draw(f, 400, 400);
    await settle();

    const b = f.boxes()[0]! as Record<string, unknown>;
    assert.equal(b.kind, 'image', 'the rail arm won, as the user asked');
    assert.ok(b.start === undefined || b.start === '',
      `a box drawn after a RAIL arm is scenery (got start ${JSON.stringify(b.start)})`);
  } finally { f.destroy(); }
});

test('abandoning a timeline arm with Escape leaves the next hand-drawn box as scenery', async () => {
  const f = mount();
  try {
    await openPanel(f);
    tlAdd(f, { kind: 'image', atMs: 7000 });
    assert.equal(f.armed(), true);
    // The Escape LADDER has rungs above the mode (an open timeline is one of them), so
    // press until it reaches create rather than assuming a single press gets there.
    // Move focus off the panel first: while it is inside `.tl-panel` the timeline owns
    // every key (free-canvas's onKey bails on purpose), so Escape would never reach the
    // mode ladder. A user reaching for Escape has clicked the canvas by then.
    (dom.window.document.activeElement as HTMLElement | null)?.blur?.();
    for (let i = 0; i < 4 && f.armed(); i++) {
      dom.window.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    }
    assert.equal(f.armed(), false, 'Escape eventually leaves create mode');

    // Now arm the same kind again from the rail and draw.
    const add = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-add');
    click(add!);
    const item = [...f.stageEl.querySelectorAll<HTMLButtonElement>('.fc-pop-item, .fc-pop-gitem')]
      .find((el) => /image/i.test(el.textContent || ''));
    click(item!);
    draw(f, 500, 500);
    await settle();

    const b = f.boxes()[0]! as Record<string, unknown>;
    assert.ok(b.start === undefined || b.start === '',
      `an abandoned arm must not time a later box (got start ${JSON.stringify(b.start)})`);
  } finally { f.destroy(); }
});

// ── plans/179 T2: closing the timeline gives the rail back ────────────────────

/**
 * The auto-dock is desktop-only, so the harness's global `matchMedia` (which answers
 * `false` to everything) has to say the viewport is wide for the length of the test.
 */
async function withDesktopViewport(fn: () => Promise<void>): Promise<void> {
  const real = (globalThis as Record<string, unknown>).matchMedia;
  (globalThis as Record<string, unknown>).matchMedia = (q: string) =>
    ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
  try { await fn(); } finally { (globalThis as Record<string, unknown>).matchMedia = real; }
}

test('opening the timeline docks the rail as a column; closing it hands the rail back', async () => {
  await withDesktopViewport(async () => {
    const f = mount();
    const dock = f.stageEl.querySelector<HTMLElement>('.fc-toolbar-dock')!;
    try {
      assert.ok(dock, 'the rail has a dock');
      assert.equal(f.stageEl.classList.contains('has-tl-reserve'), false, 'precondition: floating');

      await openPanel(f);
      assert.ok(f.stageEl.classList.contains('has-tl-reserve'), 'the open panel took the rail as a column');
      assert.ok(f.stageEl.style.getPropertyValue('--stage-reserve-left'), 'and reserved a band for it');

      // Close the way the panel's own Escape does - straight through setOpen, never
      // back through free-canvas's ensureTimeline. That is the path T2 was reported on.
      const panelRoot = f.stageEl.querySelector<HTMLElement>('.tl-panel')!;
      panelRoot.focus?.();
      panelRoot.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

      assert.equal(f.stageEl.classList.contains('has-tl-reserve'), false, 'the column came off');
      assert.equal(f.stageEl.style.getPropertyValue('--stage-reserve-left'), '', 'and its reserve with it');
      assert.equal(dom.window.document.documentElement.style.getPropertyValue('--ldock-w'), '',
        'and the back pill stopped being inset past a column that is gone');
      // Nothing left holding the rail anywhere but its CSS park: no half-detached dock
      // carrying a stale left/top (the "stranded at x=-33" state).
      assert.equal(dock.classList.contains('is-detached'), false, 'an undragged rail goes back to the edge');
      assert.equal(dock.style.left, '', 'with no position of its own');
      assert.equal(dock.style.top, '');
      // …and free-canvas noticed, so the rail button is not still lit.
      const btn = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-timeline')!;
      assert.equal(btn.getAttribute('aria-pressed'), 'false', 'the rail button tracks a self-close');
      assert.equal(btn.classList.contains('is-armed'), false);
    } finally { f.destroy(); }
  });
});

test('a rail dragged before the timeline opened comes back to exactly where it was', async () => {
  await withDesktopViewport(async () => {
    const f = mount();
    const dock = f.stageEl.querySelector<HTMLElement>('.fc-toolbar-dock')!;
    const toolbar = f.stageEl.querySelector<HTMLElement>('.fc-toolbar')!;
    // jsdom measures nothing, so give the rail a size to be clamped against.
    toolbar.getBoundingClientRect = () => rect(0, 0, 46, 300);
    try {
      // Drag it out to a spot the user chose.
      toolbar.dispatchEvent(pointerEvent('pointerdown', 20, 60));
      toolbar.dispatchEvent(pointerEvent('pointermove', 320, 260));
      toolbar.dispatchEvent(pointerEvent('pointerup', 320, 260));
      await settle();
      assert.ok(dock.classList.contains('is-detached'), 'precondition: the rail floats where it was put');
      const was = { left: dock.style.left, top: dock.style.top };
      assert.ok(was.left && was.left !== '0px', `precondition: a real position (${was.left})`);

      await openPanel(f);
      assert.equal(dock.classList.contains('is-detached'), false, 'the dock gives up its position to be a column');

      const panelRoot = f.stageEl.querySelector<HTMLElement>('.tl-panel')!;
      panelRoot.focus?.();
      panelRoot.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

      assert.ok(dock.classList.contains('is-detached'), 'and takes it back on close');
      assert.deepEqual({ left: dock.style.left, top: dock.style.top }, was,
        'the rail returns to the spot the user dragged it to, not to wherever the column left it');
    } finally { f.destroy(); }
  });
});
