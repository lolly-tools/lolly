// SPDX-License-Identifier: MPL-2.0
/**
 * Wobbly windows - the runtime half of lib/wobble.ts: the lag spring, the
 * transform render, and the two invariants the feature lives or dies by.
 *
 * Run directly:  node --test shells/web/src/lib/wobble.test.ts
 *
 * jsdom with a real origin (the flag read goes through the localStorage mirror,
 * which throws SecurityError on the default opaque about:blank origin). jsdom has
 * no requestAnimationFrame, so every test drives the loop through an INJECTED raf
 * pump - which is also the only way to make the physics deterministic.
 *
 * The invariant most of these exist for is ADDITIVITY: with the flag off, or with
 * reduced-motion on, not one style is written and no frame is ever scheduled, so
 * the panel's own left/top drag is byte-identical to today. Every positive test
 * also asserts the teardown: transform, transform-origin and will-change are all
 * cleared once the wobble settles, so at rest the DOM is exactly what it was.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { attachWobble } = await import('./wobble.ts');
const { setFlagMirror, WOBBLY_FLAG } = await import('../feature-flags.ts');

/** Turn the flag on/off via the same localStorage mirror the app reads. */
function setFlag(on: boolean): void {
  localStorage.clear();
  if (on) setFlagMirror(WOBBLY_FLAG.id, true);
}

/**
 * A hand-pumped rAF. The loop only ever has ONE frame in flight (wake() guards on
 * rafId), so a single pending slot models it. tick() advances a fake clock and
 * fires the pending frame; runToSettle() pumps until the loop stops scheduling.
 */
function harness() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  let pending: FrameRequestCallback | null = null;
  let clock = 0;
  const raf = (cb: FrameRequestCallback): number => { pending = cb; return 1; };
  const caf = (): void => { pending = null; };
  const scheduled = (): boolean => pending !== null;
  const tick = (dtMs = 16): void => {
    if (!pending) return;
    const cb = pending; pending = null; clock += dtMs; cb(clock);
  };
  const runToSettle = (max = 4000): number => {
    let n = 0;
    while (pending && n < max) { tick(); n++; }
    return n;
  };
  return { el, raf, caf, scheduled, tick, runToSettle };
}

const NEVER_REDUCED = (): boolean => false;

test('flag OFF: grab/drag/release write nothing and schedule no frame', () => {
  setFlag(false);
  const h = harness();
  const w = attachWobble(h.el, { raf: h.raf, caf: h.caf, reduced: NEVER_REDUCED });
  w.grab(10, 5);
  w.drag(20, 0);
  w.release();
  assert.equal(h.el.style.transform, '');
  assert.equal(h.el.style.transformOrigin, '');
  assert.equal(h.el.style.willChange, '');
  assert.equal(h.scheduled(), false);
});

test('reduced motion ON (flag on): still writes nothing', () => {
  setFlag(true);
  const h = harness();
  const w = attachWobble(h.el, { raf: h.raf, caf: h.caf, reduced: () => true });
  w.grab(10, 5);
  w.drag(20, 0);
  w.release();
  assert.equal(h.el.style.transform, '');
  assert.equal(h.el.style.willChange, '');
  assert.equal(h.scheduled(), false);
});

test('grab anchors transform-origin at the grab point and arms a frame', () => {
  setFlag(true);
  const h = harness();
  const w = attachWobble(h.el, { raf: h.raf, caf: h.caf, reduced: NEVER_REDUCED });
  // jsdom getBoundingClientRect is all-zeros, so origin === the client coords.
  w.grab(12, 7);
  assert.equal(h.el.style.transformOrigin, '12.0px 7.0px');
  assert.equal(h.el.style.willChange, 'transform');
  assert.equal(h.scheduled(), true);
});

test('drag paints a skew, then release rings down and clears every style', () => {
  setFlag(true);
  const h = harness();
  const w = attachWobble(h.el, { raf: h.raf, caf: h.caf, reduced: NEVER_REDUCED });
  w.grab(0, 0);
  w.drag(30, 0);        // horizontal lag
  h.tick(); h.tick();   // a couple of frames of the spring
  assert.match(h.el.style.transform, /skewX/);
  w.release();
  const frames = h.runToSettle();
  assert.ok(frames > 0 && frames < 4000, `settled in a bounded number of frames (${frames})`);
  assert.equal(h.el.style.transform, '');
  assert.equal(h.el.style.transformOrigin, '');
  assert.equal(h.el.style.willChange, '');
  assert.equal(h.scheduled(), false);
});

test('impulse while idle (no grab) starts and finishes a wobble', () => {
  setFlag(true);
  const h = harness();
  const w = attachWobble(h.el, { raf: h.raf, caf: h.caf, reduced: NEVER_REDUCED });
  w.impulse(0, 22);
  assert.equal(h.scheduled(), true);
  assert.equal(h.el.style.willChange, 'transform');
  h.tick();
  assert.notEqual(h.el.style.transform, '');
  const frames = h.runToSettle();
  assert.ok(frames < 4000, 'impulse settles');
  assert.equal(h.el.style.transform, '');
  assert.equal(h.el.style.willChange, '');
});

test('lag is clamped: a violent drag cannot exceed the skew cap', () => {
  setFlag(true);
  const h = harness();
  const w = attachWobble(h.el, { raf: h.raf, caf: h.caf, reduced: NEVER_REDUCED });
  w.grab(0, 0);
  w.drag(100000, 0);   // absurd throw
  h.tick();
  const raw = h.el.style.transform.match(/skewX\(([-\d.]+)deg\)/)?.[1];
  assert.ok(raw !== undefined, 'a skewX was written');
  assert.ok(Math.abs(parseFloat(raw)) <= 6.001, `skew stays under the cap (${raw})`);
});

test('dispose mid-wobble cancels the frame and clears styles', () => {
  setFlag(true);
  const h = harness();
  const w = attachWobble(h.el, { raf: h.raf, caf: h.caf, reduced: NEVER_REDUCED });
  w.grab(0, 0);
  w.drag(25, 10);
  h.tick();
  assert.equal(h.scheduled(), true);
  w.dispose();
  assert.equal(h.scheduled(), false);
  assert.equal(h.el.style.transform, '');
  assert.equal(h.el.style.transformOrigin, '');
  assert.equal(h.el.style.willChange, '');
});

test('release without a live grab is a no-op (flag off path)', () => {
  setFlag(false);
  const h = harness();
  const w = attachWobble(h.el, { raf: h.raf, caf: h.caf, reduced: NEVER_REDUCED });
  w.release();   // grab was a no-op, so dragging was never set
  assert.equal(h.scheduled(), false);
  assert.equal(h.el.style.transform, '');
});
