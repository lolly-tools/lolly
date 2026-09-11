// SPDX-License-Identifier: MPL-2.0
/**
 * The CANVAS half of playhead-contextual keyframe writes (plans/104 section 8).
 *
 * `timeline-panel.test.ts` covers the panel's half - the latch, the diamonds, the
 * inspector, and the `kfPoseIds` / `kfPoseWrite` seam as a pure pair. This file covers
 * the only place the two meet: free-canvas's SINGLE pointerup commit, which is where a
 * drag decides whether it moved a box or posed a keyframe.
 *
 * The rule being pinned, in one sentence: **the gesture is untouched**. The preview
 * path never learns about keyframes, nothing is written while the pointer is down, and
 * the redirection happens at the one commit - so a keyframed drag is exactly one undo
 * step, exactly like an ordinary one, and there is no mode to enter or leave.
 *
 * Everything runs against the real `initFreeCanvas` and the real, lazily imported
 * `timeline-panel.ts`, on the jsdom harness free-canvas-timeline-add.test.ts
 * established: an in-memory runtime that echoes `setInput` back through `getModel`, so
 * every assertion is a round trip through the model rather than a spy on a call.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-kf-commit.test.ts
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
const { parseKf } = await import('../../../../engine/src/keyframes.ts');

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

/** A keyframable time-capable canvas block: the ten time fields, plus `kf` and `z`. */
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

/** The box every test drags: on screen 0..4s, animated, 200×100 at (100, 100). */
const ANIMATED = (): Box => ({
  id: 'a', x: 100, y: 100, w: 200, h: 100, rot: 0,
  start: 0, dur: 4, clipIn: 0, speed: 1, lane: '',
  kf: 't0_x0_y0*t2000_eo_x40_y10',
} as Box);

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  box(): Record<string, unknown>;
  writes(): number;
  destroy(): void;
}

/** The same fixture with ONE canvas sub-field taken away - the progressive-capability
 *  gate every optional field in this cfg lives under. */
function mountWithout(drop: string, seed: Box[]): Fixture {
  const cfg = canvasCfg();
  delete cfg[drop];
  return mount(seed, cfg);
}

function mount(seed: Box[], cfg: Record<string, unknown> = canvasCfg()): Fixture {
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
    input: { id: 'boxes', canvas: cfg as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    box: () => (model.get('boxes') as Box[])[0]! as Record<string, unknown>,
    writes: () => writes,
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

/** Open the timeline the way the rail does, and wait for the lazy chunk. */
async function openPanel(f: Fixture): Promise<void> {
  const b = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-timeline');
  assert.ok(b, 'a time-capable tool gets a timeline button on the rail');
  click(b!);
  await settle();
  assert.ok(f.stageEl.querySelector('.tl-panel'), 'the timeline panel mounted');
}

/** Park the playhead, through the panel's own `fc-seek` listener. */
async function seek(f: Fixture, atMs: number): Promise<void> {
  f.stageEl.dispatchEvent(new W.CustomEvent('fc-seek', { bubbles: true, detail: { atMs } }));
  await settle();
}

/** Press inside the box and drag it by (dx, dy) native px. Canvas is 1:1 with client. */
async function drag(f: Fixture, from: [number, number], dx: number, dy: number): Promise<void> {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', from[0], from[1]));
  f.canvasEl.dispatchEvent(pointerEvent('pointermove', from[0] + dx, from[1] + dy));
  await settle();
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', from[0] + dx, from[1] + dy));
  await settle();
}

test('parked ON a diamond, a canvas drag poses THAT keyframe and never moves the box', async () => {
  const f = mount([ANIMATED()]);
  try {
    await openPanel(f);
    await seek(f, 2000);                       // exactly the second keyframe
    const before = f.writes();
    await drag(f, [200, 150], 24, -8);

    const b = f.box();
    assert.equal(f.writes() - before, 1, 'ONE model write for the whole gesture - one undo step');
    assert.equal(b.x, 100, 'the box itself did not move…');
    assert.equal(b.y, 100);
    const track = parseKf(String(b.kf));
    assert.deepEqual(track.map((k) => k.t), [0, 2000], '…and no keyframe was added');
    // 'add' semantics: the delta composes onto what the box was ALREADY doing there,
    // because the channels are relative offsets and the drag started from that pose.
    assert.deepEqual({ ...track[1]!.v }, { x: 64, y: 2 });
    assert.deepEqual({ ...track[0]!.v }, { x: 0, y: 0 }, 'the other keyframe is untouched');
    assert.equal(track[1]!.ease, 'eo', 'and so is its curve');
  } finally { f.destroy(); }
});

test('parked OFF any diamond, the same drag moves the box and leaves the track alone', async () => {
  const f = mount([ANIMATED()]);
  try {
    await openPanel(f);
    await seek(f, 2500);                       // between the two keyframes
    const before = f.writes();
    await drag(f, [200, 150], 24, -8);

    const b = f.box();
    assert.equal(f.writes() - before, 1, 'still exactly one write');
    assert.equal(b.x, 124, 'the base geometry moved, exactly as it always did');
    assert.equal(b.y, 92);
    assert.equal(b.kf, 't0_x0_y0*t2000_eo_x40_y10', 'and the track is byte-identical');
  } finally { f.destroy(); }
});

test('one millisecond off the diamond is OFF it - the latch is what puts you on one', async () => {
  const f = mount([ANIMATED()]);
  try {
    await openPanel(f);
    await seek(f, 2001);
    await drag(f, [200, 150], 10, 0);
    assert.equal(f.box().x, 110, 'exact ms equality, never a tolerance');
    assert.equal(f.box().kf, 't0_x0_y0*t2000_eo_x40_y10');
  } finally { f.destroy(); }
});

test('a box with no track is never redirected, however the playhead is parked', async () => {
  const plain = { ...ANIMATED(), kf: '' } as Box;
  const f = mount([plain]);
  try {
    await openPanel(f);
    await seek(f, 0);                          // t = 0 would be a diamond if there were one
    await drag(f, [200, 150], 30, 30);
    assert.equal(f.box().x, 130, 'nobody keyframes by accident: the door is a decision, not a drag');
    assert.equal(f.box().kf, '');
  } finally { f.destroy(); }
});

test('a MIXED selection splits: the posed boxes are posed, the rest move, in ONE commit', async () => {
  const other = {
    id: 'b', x: 400, y: 100, w: 200, h: 100, rot: 0,
    start: 0, dur: 4, clipIn: 0, speed: 1, lane: '', kf: '',
  } as Box;
  const f = mount([ANIMATED(), other]);
  try {
    await openPanel(f);
    await seek(f, 2000);
    // Marquee both, then drag from inside one of them.
    f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 50, 50));
    f.canvasEl.dispatchEvent(pointerEvent('pointermove', 700, 300));
    await settle();
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 700, 300));
    await settle();
    const before = f.writes();
    await drag(f, [200, 150], 20, 0);

    assert.equal(f.writes() - before, 1,
      'ONE commit, so one ⌘Z takes back the pose AND the move - refusing the whole '
      + 'gesture because one box in two is not animated would make this feel like a mode');
    const boxes = f.boxes() as Array<Record<string, unknown>>;
    const a = boxes.find((x) => x.id === 'a')!;
    const b = boxes.find((x) => x.id === 'b')!;
    assert.equal(a.x, 100, 'the animated one was posed…');
    assert.deepEqual({ ...parseKf(String(a.kf))[1]!.v }, { x: 60, y: 10 });
    assert.equal(b.x, 420, '…and the plain one moved');
    assert.equal(b.kf, '');
  } finally { f.destroy(); }
});

// ── "+Keyframe" in its SECOND home: the canvas contextual bar ─────────────────
//
// plans/104 section 8's M2.5 revision, directive 1: "a diamond-glyph button in the timeline
// transport's LEFT additive cluster AND a diamond in the canvas selected-object
// contextual bar - both always reactive to the canvas selection". `timeline-panel.test.ts`
// owns the transport half; this file owns the canvas half and, crucially, the seam
// between them - that the ctxbar button routes to the panel's ONE action rather than
// growing a second copy of the rules.

/** The contextual bar's diamond. */
function ctxKf(f: Fixture): HTMLButtonElement {
  const b = f.stageEl.querySelector<HTMLButtonElement>('.fc-ctxbar [data-cx="kf"]');
  assert.ok(b, 'the selected-object bar carries a +Keyframe diamond');
  return b!;
}

/** Click a box on the canvas - the ordinary way a selection is made. */
async function selectBox(f: Fixture, at: [number, number]): Promise<void> {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', at[0], at[1]));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', at[0], at[1]));
  await settle();
}

test('the ctxbar diamond sits beside duplicate/delete and routes to the panel\'s ONE action', async () => {
  const f = mount([ANIMATED()]);
  try {
    await selectBox(f, [200, 150]);
    const bar = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar')!;
    const order = Array.from(bar.querySelectorAll<HTMLElement>('[data-cx]')).map((b) => b.dataset.cx);
    const kf = order.indexOf('kf');
    assert.ok(kf >= 0, 'the diamond is on the bar');
    assert.deepEqual(order.slice(kf, kf + 3), ['kf', 'dup', 'del'],
      'immediately before Duplicate and Delete - the actions on the selected object itself');
    assert.equal(ctxKf(f).getAttribute('aria-label'), '+Keyframe',
      'Andy\'s copy, exactly - never "ADD KF"');
    assert.equal(ctxKf(f).getAttribute('aria-disabled'), 'false');

    // The press opens the timeline (the playhead's position IS the arm, so the surface
    // that shows it has to be up) and then writes through the panel - never through a
    // second copy of the rules living in free-canvas.
    const before = f.writes();
    ctxKf(f).click();
    await settle();
    assert.ok(f.stageEl.querySelector('.tl-panel'), 'the timeline is up - the arm has to be visible');
    // The playhead has not moved from 0, and the clip starts at 0, so this lands ON the
    // track's existing first diamond, holding the pose it already holds - which
    // `writeKfPose` reports by identity, so it is not an edit and not an undo step.
    assert.equal(f.writes() - before, 0, 're-posing a diamond to the pose it already has writes nothing');
    assert.deepEqual(parseKf(String(f.box().kf)).map((k) => k.t), [0, 2000]);

    // Move off it and the same press adds one, in one write.
    await seek(f, 3000);
    ctxKf(f).click();
    await settle();
    assert.equal(f.writes() - before, 1, 'ONE model write');
    assert.deepEqual(parseKf(String(f.box().kf)).map((k) => k.t), [0, 2000, 3000]);
  } finally { f.destroy(); }
});

test('the ctxbar diamond auto-promotes an UNTIMED box, in ONE commit', async () => {
  // The same single-commit promotion the transport button does, reached from the canvas
  // - which is the case the revision was written for: a box the user has just drawn,
  // never on the timeline, one press from being animated.
  const scenery = {
    id: 'a', x: 100, y: 100, w: 200, h: 100, rot: 0,
    start: '', dur: '', clipIn: 0, speed: 1, lane: '', kf: '',
  } as unknown as Box;
  const f = mount([scenery]);
  try {
    await selectBox(f, [200, 150]);
    const before = f.writes();
    ctxKf(f).click();
    await settle();

    assert.equal(f.writes() - before, 1, 'the promotion and the keyframe are ONE undo step');
    const b = f.box();
    assert.equal(Number(b.start), 0, 'placed at the playhead');
    assert.ok(Number(b.dur) > 0, 'and given a length');
    assert.deepEqual(parseKf(String(b.kf)).map((k) => k.t), [0]);
    assert.deepEqual({ ...parseKf(String(b.kf))[0]!.v }, { x: 0, y: 0, s: 1, r: 0, o: 1 },
      'a full pose at its neutral values - being keyed moves nothing on the canvas');
  } finally { f.destroy(); }
});

test('a press-and-release on the rotate handle writes no pose - zero delta is not a gesture', async () => {
  // `liveRect` is only ever assigned in pointermove, so a click on the handle ends with
  // `live === startRect` and a delta of exactly 0. Redirecting that into the track is not
  // a no-op: a full pose over the ACTIVE channel set adds `r` to a track that does not
  // animate rotation, so the wire is rewritten and an undo step spent on a gesture that
  // moved nothing. The move branch has always been guarded (0.5px); this is its twin.
  const f = mount([ANIMATED()]);
  try {
    await openPanel(f);
    await seek(f, 2000);                       // parked ON a diamond: the redirect is armed
    await selectBox(f, [200, 150]);
    const rot = f.stageEl.querySelector<HTMLElement>('.fc-handle.fc-h-rotate');
    assert.ok(rot, 'a single selection carries a rotate handle');
    const kfBefore = String(f.box().kf);
    assert.equal(kfBefore.includes('_r'), false, 'precondition: this track does not animate rotation');

    rot!.dispatchEvent(pointerEvent('pointerdown', 200, 90));
    f.canvasEl.dispatchEvent(pointerEvent('pointerup', 200, 90));
    await settle();

    assert.equal(String(f.box().kf), kfBefore,
      'byte-identical: no `r` channel appeared on keys whose neighbours have none');
    assert.equal(f.box().rot, 0, 'and the box itself is where it was');
  } finally { f.destroy(); }
});

test('the ctxbar diamond takes its DISABLED state from the panel\'s rule, live canvas and all', async () => {
  // "TWO homes, one action" has to mean one ENABLEMENT rule too. The panel decides scope
  // from the model row AND the live canvas - a box carrying an audio asset is a sound
  // whatever its `kind` says - so a model-only copy here rendered exactly that box
  // ENABLED, and pressing it wrote nothing, announced nothing and explained nothing.
  const f = mount([ANIMATED()]);
  try {
    await openPanel(f);                        // the real rule only exists once the panel does
    await selectBox(f, [200, 150]);
    assert.equal(ctxKf(f).getAttribute('aria-disabled'), 'false', 'precondition: an ordinary box');

    // The tool's TEMPLATE paints the box (free-canvas only drives the model and the
    // chrome), so the live node is built here the way the panel's own media tests build
    // it: the marker a sound hook stamps, on a box the model still calls a card.
    const el = dom.window.document.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', 'a');
    el.innerHTML = '<div class="lolly-box-audio" data-audio-src="vo.mp3" data-audio-dur="4000"></div>';
    f.canvasEl.appendChild(el);

    await selectBox(f, [900, 900]);            // deselect…
    await selectBox(f, [200, 150]);            // …and back, which rebuilds the bar
    assert.ok(f.canvasEl.querySelector('.lolly-box[data-box-id="a"] .lolly-box-audio'),
      'the marker survived the re-selection - otherwise this test proves nothing');
    assert.equal(ctxKf(f).getAttribute('aria-disabled'), 'true',
      'the canvas half of the rule reaches the bar');
    assert.equal(ctxKf(f).getAttribute('aria-label'), 'Sound has no pose to keyframe',
      'and says why, rather than offering "+Keyframe" and then doing nothing');

    const before = f.writes();
    ctxKf(f).click();
    await settle();
    assert.equal(f.writes() - before, 0, 'a disabled door writes nothing either way');
  } finally { f.destroy(); }
});

test('a tool with no kf sub-field gets no diamond on its contextual bar at all', async () => {
  const f = mountWithout('kfField', [ANIMATED()]);
  try {
    await selectBox(f, [200, 150]);
    assert.ok(f.stageEl.querySelector('.fc-ctxbar [data-cx="dup"]'), 'the bar itself is there');
    assert.equal(f.stageEl.querySelector('.fc-ctxbar [data-cx="kf"]'), null,
      'progressive capability: the manifest is the gate, exactly like the timeline rail button');
  } finally { f.destroy(); }
});
