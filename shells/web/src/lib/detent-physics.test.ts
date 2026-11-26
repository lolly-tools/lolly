// SPDX-License-Identifier: MPL-2.0
/**
 * The vendored Detent physics (lib/detent-physics.ts, MIT): the properties the Cover
 * Flow, the ruler dial and present mode rely on, plus the wheel reader that tells a
 * notched mouse wheel from a trackpad. Wheel samples follow the shapes of Detent's
 * own macOS recordings: a mouse notch starts at 12 to 13 px with wheelDelta = -3 x
 * delta, an accelerated spin jumps to hundreds of px, and a trackpad starts at 1 to
 * 3 px. Windows notches are 100 px with wheelDelta 120; Firefox uses line mode.
 *
 * Run directly:
 *   node --test "shells/web/src/lib/detent-physics.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  burstVelocity,
  crossings,
  ios,
  nearest,
  presets,
  project,
  release,
  rubberClamp,
  spring,
  tau,
  velocityTracker,
  WHEEL_IDLE,
  wheelReader,
  type WheelSample,
} from './detent-physics.ts';

const SIZE = 300;
const loop = { min: 0, max: 0, loop: true, count: 16 };
const bounded = { min: 0, max: 9, loop: false, count: 10 };

test('a spring rests exactly on its target at its duration, from any start velocity', () => {
  for (const v0 of [-3, 0, 2.5]) {
    const m = spring(0, 300, v0, ios.spring, ios.snapDuration);
    assert.ok(m.duration > 0 && m.duration <= ios.snapDuration, `duration ${m.duration}`);
    assert.deepEqual(m.at(m.duration), { x: 300, v: 0, phase: 'spring' });
    assert.ok(Math.abs(m.at(0).x) < 1e-9, 'starts where it was');
  }
});

test('a release lands on the row nearest the projected end of the throw', () => {
  const v = 2; // px/ms
  const projected = project(1000, v, ios.decay);
  assert.equal(projected, 1000 + v * tau(ios.decay));
  const r = release(1000, v, SIZE, loop, ios);
  assert.equal(r.index, Math.round(projected / SIZE));
  const end = r.at(r.duration);
  assert.equal(end.x, r.index * SIZE);
  assert.equal(end.v, 0);
  // Continuous at the release: no jump in position on the first frame.
  assert.ok(Math.abs(r.at(0).x - 1000) < 1e-6);
});

test('a still release settles on the nearest row with one spring', () => {
  const r = release(470, 0, SIZE, loop, ios);
  assert.equal(r.index, 2);
  assert.equal(r.at(r.duration).x, 600);
});

test('a release never moves faster than maxVelocity', () => {
  const r = release(0, 1000, SIZE, loop, ios);
  assert.ok(r.index * SIZE <= ios.maxVelocity * tau(ios.decay) + SIZE);
});

test('a bounded release snaps inside the bounds', () => {
  assert.equal(release(0, -6, SIZE, bounded, ios).index, 0);
  assert.equal(release(2700, 6, SIZE, bounded, ios).index, 9);
  assert.equal(nearest(14, bounded), 9);
});

test('the snappy preset settles a fling faster than the iOS default', () => {
  const a = release(0, 3, SIZE, loop, ios);
  const b = release(0, 3, SIZE, loop, presets.snappy);
  assert.ok(b.duration < a.duration, `${b.duration} < ${a.duration}`);
});

test('the velocity tracker reads a steady drag and reads zero once the finger rested', () => {
  const t = velocityTracker();
  for (let i = 0; i <= 10; i++) t.push(i * 8, i * 8 * 1.5);
  assert.ok(Math.abs(t.get(80) - 1.5) < 1e-6);
  assert.equal(t.get(80 + 41), 0);
  t.reset();
  assert.equal(t.get(0), 0);
});

test('rubberClamp passes positions inside the bounds and resists past them', () => {
  assert.equal(rubberClamp(50, 0, 100, 300, 0.55), 50);
  const past = rubberClamp(200, 0, 100, 300, 0.55);
  assert.ok(past > 100 && past < 200);
  assert.ok(rubberClamp(-200, 0, 100, 300, 0.55) > -200);
});

test('crossings reports each row centre crossed, in order', () => {
  const seen: number[] = [];
  crossings(0, 1000, SIZE, (i) => seen.push(i));
  assert.deepEqual(seen, [1, 2, 3]);
  seen.length = 0;
  crossings(1000, 0, SIZE, (i) => seen.push(i));
  assert.deepEqual(seen, [2, 1, 0]);
  crossings(0, 1000, 0, () => assert.fail('a zero size must not loop'));
});

// ── The wheel reader ──────────────────────────────────────────────────────────

const ev = (
  t: number,
  deltaX: number,
  deltaY: number,
  extra: Partial<WheelSample> = {}
): WheelSample => ({
  deltaX,
  deltaY,
  deltaMode: 0,
  timeStamp: t,
  wheelDeltaX: -3 * deltaX,
  wheelDeltaY: -3 * deltaY,
  ...extra,
});

test('a macOS mouse notch on the control axis is one step', () => {
  const w = wheelReader({ orientation: 'horizontal' });
  assert.deepEqual(w.read(ev(0, 13, 0)), { kind: 'step', direction: 1, page: false });
  assert.deepEqual(w.read(ev(200, -12, 0)), { kind: 'step', direction: -1, page: false });
});

test('a Windows notch (wheelDelta 120) and Firefox line mode are notches whatever their size', () => {
  const w = wheelReader({ orientation: 'horizontal' });
  assert.equal(w.read(ev(0, 100, 0, { wheelDeltaX: -120 })).kind, 'step');
  assert.equal(w.read(ev(500, 3, 0, { deltaMode: 1, wheelDeltaX: undefined })).kind, 'step');
  assert.deepEqual(w.read(ev(1000, 1, 0, { deltaMode: 2 })), {
    kind: 'step',
    direction: 1,
    page: true,
  });
});

test('an accelerated mouse spin becomes a burst with a smoothed rate', () => {
  const w = wheelReader({ orientation: 'horizontal' });
  assert.equal(w.read(ev(0, 12, 0)).kind, 'step');
  const burst = w.read(ev(15, 218, 0));
  assert.equal(burst.kind, 'burst');
  if (burst.kind !== 'burst') return;
  assert.ok(Math.abs(burst.rate - 218 / 15) < 1e-9);
  const next = w.read(ev(30, 240, 0));
  assert.ok(next.kind === 'burst' && next.rate > burst.rate);
  const v = burstVelocity(burst.rate, burst.direction, 0, SIZE, ios.maxVelocity);
  assert.ok(v > 0 && v <= ios.maxVelocity);
});

test('a trackpad swipe is followed 1:1, momentum tail included, on the control axis only', () => {
  const w = wheelReader({ orientation: 'horizontal' });
  const deltas = [1, 3, 21, 162, 140, 90, 40, 12, 4, 1];
  let moved = 0;
  deltas.forEach((dx, i) => {
    const r = w.read(ev(i * 16, dx, i % 2));
    assert.equal(r.kind, 'follow');
    if (r.kind === 'follow') moved += r.delta;
  });
  assert.equal(
    moved,
    deltas.reduce((a, b) => a + b, 0)
  );
});

test('a vertical trackpad gesture over a horizontal control is left to the page', () => {
  const w = wheelReader({ orientation: 'horizontal' });
  assert.equal(w.read(ev(0, 0, 2)).kind, 'ignore');
  assert.equal(w.read(ev(16, 1, 30)).kind, 'ignore');
  // Its axis was decided by the first event: a sideways wobble mid-gesture is still the page's.
  assert.equal(w.read(ev(32, 40, 2)).kind, 'ignore');
});

test('crossAxisNotches: false leaves a plain vertical mouse wheel to the page', () => {
  const upstream = wheelReader({ orientation: 'horizontal' });
  assert.equal(upstream.read(ev(0, 0, 13)).kind, 'step');
  const page = wheelReader({ orientation: 'horizontal', crossAxisNotches: false });
  assert.equal(page.read(ev(0, 0, 13)).kind, 'ignore');
  assert.equal(page.read(ev(1000, 13, 0)).kind, 'step');
});

test('a quiet gap longer than WHEEL_IDLE starts a new gesture', () => {
  const w = wheelReader({ orientation: 'horizontal' });
  assert.equal(w.read(ev(0, 2, 0)).kind, 'follow');
  assert.equal(w.read(ev(WHEEL_IDLE - 1, 30, 0)).kind, 'follow');
  assert.equal(w.read(ev(2 * WHEEL_IDLE + 1, 30, 0)).kind, 'step');
});

test('right-to-left mirrors horizontal deltas', () => {
  const w = wheelReader({ orientation: 'horizontal', rtl: true });
  const r = w.read(ev(0, 2, 0));
  assert.deepEqual(r, { kind: 'follow', delta: -2 });
});

test('wheelMode smooth follows a mouse notch and step never throws', () => {
  assert.equal(
    wheelReader({ orientation: 'horizontal', wheelMode: 'smooth' }).read(ev(0, 13, 0)).kind,
    'follow'
  );
  const step = wheelReader({ orientation: 'horizontal', wheelMode: 'step' });
  assert.equal(step.read(ev(0, 2, 0)).kind, 'step');
  assert.equal(step.read(ev(15, 400, 0)).kind, 'step');
});
