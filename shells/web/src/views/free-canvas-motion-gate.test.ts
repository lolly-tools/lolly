// SPDX-License-Identifier: MPL-2.0
/**
 * The motion path's OPEN GATE (plans/104 section 8) - free-canvas's half of the overlay.
 *
 * `motion-path.test.ts` owns the module: its export contract, its geometry, its
 * reduced-motion branch. What it cannot see is the sentence free-canvas writes above
 * `motionIds`: "shown for SELECTED animated boxes only, and only while the timeline is
 * OPEN", because a path drawn with no playhead, no diamonds and no transport in sight
 * is a picture of a move the user cannot currently reach.
 *
 * Four claims, and the second one is why this file exists:
 *
 *   1. closed panel → the chunk is never even fetched (the gate is cheap, and it is
 *      first, so an ordinary selection of ordinary boxes costs nothing);
 *   2. CLOSING an already-mounted panel takes the path down. The panel is not destroyed
 *      on that path - only its open state flips - so nothing tears the overlay down;
 *      something has to re-ASK the gate. `ensureTimeline` now does, on the toggle
 *      itself. It is not the only route (measured: `setOpen` → `reserve()` → the
 *      stage's inline `--stage-reserve-bottom` changes → the stage MutationObserver →
 *      scheduleSync → paintChrome), but that one is made of three other decisions and
 *      is nobody's stated contract; this test pins the OUTCOME, so either route
 *      satisfies it and losing both does not;
 *   3. re-opening brings it back - the gate is a state, not a one-way door;
 *   4. and a drag in flight does not move the path, because it cannot: the samples are
 *      the model's, no gesture writes the model while the pointer is down, and the memo
 *      is on the model array's identity. paintChrome's live-path skip is a saving, not
 *      a compromise - the commit at pointerup is what lets the line follow.
 *
 * The harness is free-canvas-kf-commit.test.ts's, unchanged: the real `initFreeCanvas`,
 * the real lazily-imported `timeline-panel.ts` and the real `motion-path.ts`, over an
 * in-memory runtime that echoes `setInput` back through `getModel`.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-motion-gate.test.ts
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
const W = dom.window as unknown as typeof globalThis & {
  MouseEvent: typeof MouseEvent; CustomEvent: typeof CustomEvent;
};
for (const k of [
  'window', 'document', 'HTMLElement', 'Element', 'KeyboardEvent', 'Event', 'CustomEvent',
  'MouseEvent', 'Node', 'SVGElement', 'getComputedStyle', 'MutationObserver',
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

/** A keyframable time-capable canvas block - kf-commit's cfg, verbatim. */
function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', groupField: 'group', clipField: 'clip', imageField: 'image', fitField: 'fit',
    startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
    enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
    muteField: 'mute', laneField: 'lane',
    kfField: 'kf', zField: 'z',
    addKinds: [{ id: 'clip', label: 'Clip', seed: { kind: 'image', lane: 'seq', fit: 'cover' } }],
  };
}

/** On screen 0…4s, animated, 200×100 at (100, 100) - so it travels, and has diamonds. */
const ANIMATED = (): Box => ({
  id: 'a', x: 100, y: 100, w: 200, h: 100, rot: 0,
  start: 0, dur: 4, clipIn: 0, speed: 1, lane: '',
  kf: 't0_x0_y0*t2000_eo_x40_y10',
} as Box);

/** A box with no track at all: selectable, animated by nothing. */
const PLAIN = (): Box => ({
  id: 'b', x: 500, y: 100, w: 200, h: 100, rot: 0,
  start: 0, dur: 4, clipIn: 0, speed: 1, lane: '', kf: '',
} as Box);

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  /** The overlay layer, if the lazy chunk has mounted one at all. */
  layer(): HTMLElement | null;
  lines(): Element[];
  /** Model writes so far - a commit is the only thing that moves a path. */
  writes(): number;
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
    input: { id: 'boxes', canvas: canvasCfg() as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  return {
    stageEl, canvasEl,
    layer: () => stageEl.querySelector<HTMLElement>('.mp-layer'),
    lines: () => [...stageEl.querySelectorAll('.mp-line')],
    writes: () => writes,
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

/** rAF and macrotasks both: the lazy chunks land on promises, the repaints on frames. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => dom.window.requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 0));
  }
};

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

/** Select by pressing inside the box, exactly as a pointer does. */
async function select(f: Fixture, x: number, y: number): Promise<void> {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', x, y));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', x, y));
  await settle();
}

/** The rail's timeline button - the same toggle the user presses. */
function timelineBtn(f: Fixture): HTMLButtonElement {
  const b = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-timeline');
  assert.ok(b, 'a time-capable tool gets a timeline button on the rail');
  return b!;
}

/**
 * Drive the panel to a known state through the rail button, which is the user's own
 * door. A tool that mounts with timed boxes OPENS the timeline for itself (see the tail
 * of initFreeCanvas), so no test here may assume the closed state it wants.
 */
async function setPanel(f: Fixture, want: boolean): Promise<void> {
  // Settle FIRST: a tool that auto-opens does it through the lazy panel chunk, so the
  // button still reads "off" for a tick or two after mount and a state read taken
  // before that would toggle the wrong way.
  await settle();
  const b = timelineBtn(f);
  if ((b.getAttribute('aria-pressed') === 'true') !== want) { click(b); await settle(); }
  assert.equal(b.getAttribute('aria-pressed'), String(want), `the panel is ${want ? 'open' : 'closed'}`);
}

test('a closed timeline draws no path - and never even fetches the chunk', async () => {
  const f = mount([ANIMATED()]);
  try {
    // Closed BEFORE anything is selected, so the gate has never once been open on a
    // selection: nothing has asked for a path, so nothing has loaded a path module.
    await setPanel(f, false);
    await select(f, 200, 150);
    assert.equal(f.layer(), null,
      'not merely hidden: the gate is the FIRST thing motionIds asks, so the lazy '
      + 'module is never imported and the overlay layer does not exist at all');
  } finally { f.destroy(); }
});

test('opening the timeline draws the selected box’s path; closing it takes it down again', async () => {
  const f = mount([ANIMATED()]);
  try {
    await setPanel(f, false);
    await select(f, 200, 150);
    await setPanel(f, true);
    assert.ok(f.stageEl.querySelector('.tl-panel'), 'the panel mounted');

    const layer = f.layer();
    assert.ok(layer, 'the path layer is in the overlay');
    assert.equal(layer!.hidden, false, 'and it is showing');
    assert.ok(f.lines().length >= 1, 'with a polyline of the box’s travel');
    assert.equal(layer!.getAttribute('data-export-hide'), '',
      'still stamped for detachExportHidden - the gate must not be the only thing '
      + 'keeping a path out of a file');
    const path = layer!.querySelector('.mp-path');
    assert.equal(path?.getAttribute('data-box-id'), 'a', 'and it is THIS box’s path');

    // The whole point of this file: the panel stays MOUNTED (destroyTimeline, which
    // calls motionOff() outright, is a different path and would prove nothing here) - 
    // only its open state flips, and the overlay has to answer for it.
    await setPanel(f, false);
    assert.ok(f.stageEl.querySelector('.tl-panel'), 'the panel is still mounted, just closed');
    assert.equal(f.layer()?.hidden, true,
      'a path with no playhead, no diamonds and no transport under it is a picture of '
      + 'a move the user cannot reach - so the overlay goes with the panel');
    assert.equal(f.lines().length, 0, 'and the polyline is gone, not merely covered');

    await setPanel(f, true);
    assert.equal(f.layer()?.hidden, false, 'reopening brings it back - a state, not a one-way door');
    assert.ok(f.lines().length >= 1);
  } finally { f.destroy(); }
});

test('a drag in flight leaves the path where it was authored; the COMMIT is what moves it', async () => {
  // paintChrome skips the motion path on the live path (`liveRects` non-null), and the
  // comment there says this is not a compromise: no gesture writes the model while the
  // pointer is down, `getBoxes()` hands back the input's own array and `samplePaths`
  // memoises on that array's IDENTITY - so a paint per pointermove would redraw the
  // same polyline anyway. This is that claim, from the outside: mid-drag the line has
  // not moved a unit, and one pointerup later it has.
  const f = mount([ANIMATED()]);
  try {
    await setPanel(f, true);
    await select(f, 200, 150);
    // Park the playhead BETWEEN the diamonds, so the drag moves the box rather than
    // posing the keyframe under it (free-canvas-kf-commit.test.ts owns that fork).
    f.stageEl.dispatchEvent(new W.CustomEvent('fc-seek', { bubbles: true, detail: { atMs: 2500 } }));
    await settle();
    const before = f.lines()[0]?.getAttribute('points');
    assert.ok(before, 'precondition: a path is drawn');

    const writes0 = f.writes();
    f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 200, 150));
    f.canvasEl.dispatchEvent(pointerEvent('pointermove', 260, 190));
    await settle();
    assert.equal(f.writes(), writes0,
      'precondition: the gesture is IN FLIGHT - nothing is written while the pointer '
      + 'is down, which is the discipline every gesture in this file follows');
    assert.equal(f.lines()[0]?.getAttribute('points'), before,
      'the box has moved in the DOM, and the path has not - it describes the authored '
      + 'pose, and no keyframe has been written yet');

    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 260, 190));
    await settle();
    assert.equal(f.writes(), writes0 + 1, 'one commit for the whole gesture');
    assert.notEqual(f.lines()[0]?.getAttribute('points'), before,
      'and the commit - one array, one new identity - is what lets it follow');
  } finally { f.destroy(); }
});

test('an open timeline is not enough: the box has to be selected AND animated', async () => {
  const f = mount([ANIMATED(), PLAIN()]);
  try {
    await setPanel(f, true);
    assert.equal(f.layer(), null, 'nothing selected, so nothing to draw and nothing to load');

    await select(f, 600, 150);                 // the box with no track
    assert.equal(f.layer(), null,
      'a box with no `kf` value cannot have a path - the cheap half of the gate, which '
      + 'is why an ordinary selection never pays for the chunk');

    await select(f, 200, 150);                 // the animated one
    assert.ok(f.layer(), 'and the animated box, selected under an open panel, does');
    assert.ok(f.lines().length >= 1);
  } finally { f.destroy(); }
});
