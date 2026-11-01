// SPDX-License-Identifier: MPL-2.0
/**
 * motion-path editing (plans/330): a keyframe's point dragged on the canvas path, its
 * handles, the chip, and the keys - driven through the overlay's own DOM with a fake
 * canvas port, so every claim is about what one gesture writes.
 *
 *   - a drag writes that keyframe's x/y, through the camera's inverse, in ONE commit;
 *   - a click selects (handles and the chip appear) and writes nothing;
 *   - neither the LINE nor a keyframe that keys no position is a target;
 *   - Shift steps the travel 15 degrees from the previous point, Alt skips snapping;
 *   - Curve the path, Straighten and Backspace each make one commit;
 *   - without an edit port, or for a box the port refuses, nothing is a target;
 *   - the artboard is never written to, whatever the gesture.
 *
 * Run directly:  node --test shells/web/src/views/motion-path-edit.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';
import type { TimeCfg } from './timeline-math.ts';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'SVGElement', 'MouseEvent', 'KeyboardEvent']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
// announce() queues its message on the next frame; jsdom's window has the timer, Node does not.
(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });

const { mountMotionPath } = await import('./motion-path.ts');
const { parseKf } = await import('../../../../engine/src/keyframes.ts');

const geom = { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot' };
const time: TimeCfg = {
  idField: 'id',
  startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
  enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
  muteField: 'mute', laneField: 'lane', kfField: 'kf', zField: 'z',
};
const METRICS = { cr: { left: 100, top: 50 }, sr: { left: 20, top: 10 }, scale: 0.5 };
const CANVAS = { w: 1000, h: 1000 };
/** native → client px, the inverse of the module's own pointer map. */
const cx = (nx: number): number => METRICS.cr.left + nx * METRICS.scale;
const cy = (ny: number): number => METRICS.cr.top + ny * METRICS.scale;

/** A 200×100 box at (100, 100) - centre (200, 150) - posed at three times. */
const mover = (kf = 't0_x0_y0*t1000_x100_y0*t2000_o0.5*t3000_x100_y100', extra: Record<string, unknown> = {}): Box =>
  ({ id: 'a', x: 100, y: 100, w: 200, h: 100, rot: 0, start: 0, dur: 4, clipIn: 0, speed: 1, lane: '', kf, ...extra } as Box);

interface Rig {
  overlay: HTMLElement;
  canvasEl: HTMLElement;
  boxes: Box[];
  commits: Box[][];
  snaps: { alt: boolean; nodes: number }[];
  handle: ReturnType<typeof mountMotionPath>;
  hits(part?: string): HTMLElement[];
  hitAt(t: number, part?: string): HTMLElement;
  paint(): void;
  track(): ReturnType<typeof parseKf>;
  artboard(): string[];
  teardown(): void;
}

function rig(boxes: Box[], opts: { editable?: boolean; noPort?: boolean; snapBy?: { x: number; y: number } } = {}): Rig {
  const doc = dom.window.document;
  const stage = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  const overlay = doc.createElement('div');
  overlay.className = 'fc-overlay';
  stage.append(canvasEl, overlay);
  doc.body.appendChild(stage);
  for (const b of boxes) {
    const el = doc.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', String((b as Record<string, unknown>).id));
    el.style.left = '0px';
    canvasEl.appendChild(el);
  }
  const state = { boxes };
  const commits: Box[][] = [];
  const snaps: { alt: boolean; nodes: number }[] = [];
  const handle = mountMotionPath({
    overlayEl: overlay, geom, time,
    getBoxes: () => state.boxes,
    metricsOf: () => METRICS,
    canvasSize: () => CANVAS,
    ...(opts.noPort ? {} : {
      edit: {
        commit: (next: Box[]) => { commits.push(next); state.boxes = next; },
        editable: () => opts.editable !== false,
        snap: (at: { x: number; y: number }, alt: boolean, nodes: readonly unknown[]) => {
          snaps.push({ alt, nodes: nodes.length });
          return alt || !opts.snapBy ? at : { x: at.x + opts.snapBy.x, y: at.y + opts.snapBy.y };
        },
        clearGuides: () => {},
      },
    }),
  });
  const r: Rig = {
    overlay, canvasEl, commits, snaps, handle,
    get boxes() { return state.boxes; },
    hits: (part) => [...overlay.querySelectorAll<HTMLElement>(part ? `.mp-hit[data-part="${part}"]` : '.mp-hit')],
    hitAt: (t, part = 'key') => overlay.querySelector<HTMLElement>(`.mp-hit[data-t="${t}"][data-part="${part}"]`)!,
    paint: () => handle.paint(['a']),
    track: () => parseKf(String(state.boxes[0]!.kf)),
    artboard: () => [...canvasEl.querySelectorAll('.lolly-box')]
      .map((el) => `${el.className}|${(el as HTMLElement).style.cssText}`),
    teardown() { handle.destroy(); stage.remove(); },
  };
  r.paint();
  return r;
}

const fire = (target: EventTarget, type: string, x: number, y: number, mods: Partial<MouseEventInit> = {}): void => {
  target.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...mods }));
};
/** Press on `el` at native (fromX, fromY) and release at native (toX, toY). */
function drag(el: HTMLElement, from: [number, number], to: [number, number], mods: Partial<MouseEventInit> = {}): void {
  fire(el, 'pointerdown', cx(from[0]), cy(from[1]), mods);
  fire(dom.window, 'pointermove', cx(to[0]), cy(to[1]), mods);
  fire(dom.window, 'pointerup', cx(to[0]), cy(to[1]), mods);
}

// ── targets ───────────────────────────────────────────────────────────────────

test('only a point that keys a position is a target; the line and other keyframes are not', () => {
  const r = rig([mover()]);
  try {
    assert.deepEqual(r.hits('key').map((h) => h.getAttribute('data-t')), ['0', '1000', '3000'],
      'the 2 s keyframe holds only an opacity, so it is a moment on the path, not a handle on it');
    assert.equal(r.overlay.querySelectorAll('.mp-key.is-other').length, 1, 'drawn smaller and hollow');
    assert.equal(r.overlay.querySelector('.mp-line')!.getAttribute('data-part'), null, 'the line is no target');
  } finally { r.teardown(); }
});

test('no edit port, or a box the port refuses: nothing is a target and nothing commits', () => {
  for (const o of [{ noPort: true }, { editable: false }]) {
    const r = rig([mover()], o);
    try {
      assert.equal(r.hits().length, 0, JSON.stringify(o));
      assert.ok(r.overlay.querySelectorAll('.mp-key').length > 0, 'the path itself still draws');
    } finally { r.teardown(); }
  }
});

// ── dragging a point ──────────────────────────────────────────────────────────

test('dragging a point writes that keyframe\'s x/y in one commit, and nothing else', () => {
  const r = rig([mover()]);
  const before = r.artboard();
  try {
    // Key 1000 sits at centre (200 + 100, 150) = (300, 150). Drag it 40 right, 60 down.
    drag(r.hitAt(1000), [300, 150], [340, 210]);
    assert.equal(r.commits.length, 1, 'one gesture, one commit, one undo step');
    const k = r.track().find((key) => key.t === 1000)!;
    assert.deepEqual(k.v, { x: 140, y: 60 });
    assert.equal(r.track().length, 4, 'no keyframe created');
    assert.deepEqual(r.artboard(), before, 'the artboard is never written to');
  } finally { r.teardown(); }
});

test('a click selects the point: the chip shows its time and Curve the path, and nothing commits', () => {
  const r = rig([mover()]);
  try {
    const el = r.hitAt(1000);
    fire(el, 'pointerdown', cx(300), cy(150));
    fire(dom.window, 'pointerup', cx(300), cy(150));
    assert.equal(r.commits.length, 0);
    const chip = r.overlay.querySelector('.mp-chip')!;
    assert.ok(chip, 'the chip appears beside the selected point');
    assert.equal(chip.querySelector('.mp-chip-time')!.textContent, '0:01.0');
    assert.equal(chip.querySelector('.mp-chip-act')!.getAttribute('data-act'), 'curve');
    assert.equal(r.overlay.querySelectorAll('.mp-key.is-on').length, 1);
  } finally { r.teardown(); }
});

test('snapping comes from the port with the path\'s other points; Alt asks for none', () => {
  const r = rig([mover()], { snapBy: { x: 3, y: -2 } });
  try {
    drag(r.hitAt(1000), [300, 150], [340, 210]);
    assert.deepEqual(r.snaps.at(-1), { alt: false, nodes: 2 }, 'the two other position points are lines to snap to');
    assert.deepEqual(r.track().find((k) => k.t === 1000)!.v, { x: 143, y: 58 });
    drag(r.hitAt(1000), [343, 208], [400, 260], { altKey: true });
    assert.equal(r.snaps.at(-1)!.alt, true);
    assert.deepEqual(r.track().find((k) => k.t === 1000)!.v, { x: 200, y: 110 }, 'Alt: the raw pointer');
  } finally { r.teardown(); }
});

test('Shift steps the travel in 15 degree steps from the previous point', () => {
  const r = rig([mover()]);
  try {
    // From the 0 s point at (200, 150), a pointer at 20 degrees steps to 15.
    drag(r.hitAt(1000), [300, 150], [200 + 100 * Math.cos(20 * Math.PI / 180), 150 + 100 * Math.sin(20 * Math.PI / 180)], { shiftKey: true });
    const k = r.track().find((key) => key.t === 1000)!;
    const angle = Math.atan2(k.v.y!, k.v.x!) * 180 / Math.PI;
    assert.ok(Math.abs(angle - 15) < 0.01, `stepped to ${angle} degrees`);
  } finally { r.teardown(); }
});

test('under a camera the drag lands where the export will put the box', () => {
  const camera = { id: 'cam', kind: 'camera', x: 0, y: 0, w: 0, h: 0, rot: 0, start: 0, dur: 4, clipIn: 0, speed: 1, lane: '',
    kf: 't0_x50_z-400*t3000_x50_z-400' } as unknown as Box;
  const r = rig([mover(), camera]);
  try {
    const el = r.hitAt(1000);
    const at = { x: Number.parseFloat(el.style.left), y: Number.parseFloat(el.style.top) };
    // The hit sits in stage px; back to native through the same metrics.
    const nat = { x: (at.x - (METRICS.cr.left - METRICS.sr.left)) / METRICS.scale, y: (at.y - (METRICS.cr.top - METRICS.sr.top)) / METRICS.scale };
    drag(el, [nat.x, nat.y], [nat.x + 60, nat.y]);
    const k = r.track().find((key) => key.t === 1000)!;
    // P = 1200 and the camera dollied in to -400: eff = 1200 / (1200 - 400) = 1.5, so 60 px
    // on screen is 40 px of the box's own travel, and the pan (x 50) does not scale the drag.
    assert.ok(Math.abs(k.v.x! - 140) < 1e-6 && Math.abs(k.v.y!) < 1e-6, `got ${JSON.stringify(k.v)}`);
  } finally { r.teardown(); }
});

// ── handles ───────────────────────────────────────────────────────────────────

test('Curve the path from the chip: one commit, and the selected point shows its handles', () => {
  const r = rig([mover()]);
  try {
    fire(r.hitAt(1000), 'pointerdown', cx(300), cy(150));
    fire(dom.window, 'pointerup', cx(300), cy(150));
    fire(r.overlay.querySelector('.mp-chip-act')!, 'pointerdown', 0, 0);
    assert.equal(r.commits.length, 1);
    const k = r.track().find((key) => key.t === 1000)!;
    assert.ok(k.hi && k.ho, 'smooth handles from the neighbours');
    r.paint();
    assert.equal(r.overlay.querySelectorAll('.fc-pen-handle').length, 2, 'the pen tool\'s own handle marks');
    assert.equal(r.overlay.querySelectorAll('.fc-pen-arm').length, 2);
    assert.equal(r.hits('hi').length + r.hits('ho').length, 2);
    assert.equal(r.overlay.querySelector('.mp-chip-act')!.getAttribute('data-act'), 'straighten');
  } finally { r.teardown(); }
});

test('dragging a handle moves it; the other follows in line unless Alt breaks them', () => {
  const r = rig([mover('t0_x0_y0*t1000_x100_y0_hi(-30)(0)_ho(30)(0)*t3000_x100_y100')]);
  try {
    fire(r.hitAt(1000), 'pointerdown', cx(300), cy(150));
    fire(dom.window, 'pointerup', cx(300), cy(150));
    // The out-handle tip is at (330, 150); pull it to (300, 190): straight down, 40 long.
    drag(r.hitAt(1000, 'ho'), [330, 150], [300, 190]);
    let k = r.track().find((key) => key.t === 1000)!;
    assert.deepEqual(k.ho, [0, 40]);
    assert.deepEqual(k.hi, [0, -30], 'mirrored, keeping its own length');
    drag(r.hitAt(1000, 'ho'), [300, 190], [340, 190], { altKey: true });
    k = r.track().find((key) => key.t === 1000)!;
    assert.deepEqual(k.ho, [40, 40]);
    assert.deepEqual(k.hi, [0, -30], 'Alt: the other handle stays put');
    assert.equal(r.commits.length, 2);
  } finally { r.teardown(); }
});

// ── keys ──────────────────────────────────────────────────────────────────────

const key = (k: string): KeyboardEvent => new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

test('Backspace retracts the selected handle, then the point\'s; Escape drops the selection', () => {
  const r = rig([mover('t0_x0_y0*t1000_x100_y0_hi(-30)(0)_ho(30)(0)*t3000_x100_y100')]);
  try {
    assert.equal(r.handle.onKey(key('Backspace')), false, 'nothing selected: the canvas keeps its key');
    fire(r.hitAt(1000), 'pointerdown', cx(300), cy(150));
    fire(dom.window, 'pointerup', cx(300), cy(150));
    fire(r.hitAt(1000, 'ho'), 'pointerdown', cx(330), cy(150));
    fire(dom.window, 'pointerup', cx(330), cy(150));
    assert.equal(r.handle.onKey(key('Backspace')), true);
    let k = r.track().find((kk) => kk.t === 1000)!;
    assert.equal(k.ho, undefined, 'the selected handle went back onto its point');
    assert.deepEqual(k.hi, [-30, 0]);
    r.paint();
    assert.equal(r.handle.onKey(key('Delete')), true);
    k = r.track().find((kk) => kk.t === 1000)!;
    assert.equal(k.hi, undefined, 'then the point\'s own');
    assert.equal(r.track().length, 3, 'never the keyframe');
    assert.equal(r.handle.onKey(key('Backspace')), true, 'a point with no handles keeps the key away from the box');
    assert.equal(r.commits.length, 2);
    assert.equal(r.handle.onKey(key('Escape')), true);
    assert.equal(r.overlay.querySelector('.mp-chip'), null);
    assert.equal(r.handle.onKey(key('Escape')), false, 'and then Escape is the canvas\'s again');
  } finally { r.teardown(); }
});

test('a press on the path takes the keyboard back from a focused control elsewhere', () => {
  const r = rig([mover()]);
  const doc = dom.window.document;
  const input = doc.createElement('input');
  doc.body.appendChild(input);
  try {
    input.focus();
    assert.equal(doc.activeElement, input, 'premise: focus sits in another control (the timeline, say)');
    fire(r.hitAt(1000), 'pointerdown', cx(300), cy(150));
    fire(dom.window, 'pointerup', cx(300), cy(150));
    assert.notEqual(doc.activeElement, input, 'so Backspace reaches the canvas, not the clip');
  } finally { input.remove(); r.teardown(); }
});

test('Escape mid-drag cancels: nothing commits', () => {
  const r = rig([mover()]);
  try {
    fire(r.hitAt(1000), 'pointerdown', cx(300), cy(150));
    fire(dom.window, 'pointermove', cx(360), cy(200));
    assert.equal(r.handle.onKey(key('Escape')), true);
    fire(dom.window, 'pointerup', cx(360), cy(200));
    assert.equal(r.commits.length, 0);
    assert.deepEqual(r.track().find((k) => k.t === 1000)!.v, { x: 100, y: 0 });
  } finally { r.teardown(); }
});
