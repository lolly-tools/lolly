// SPDX-License-Identifier: MPL-2.0
/**
 * The Cover Flow motion model on its own (lib/coverflow-motion.ts): releases end
 * exactly on a cover even when covers sit a fractional pitch apart, the glide never
 * jumps at either end, reduced motion jumps, a trackpad is followed until it goes
 * quiet (allowing for slow frames), and a finger that rested before lifting throws
 * nothing. featured-row.test.ts drives the same model through the real component.
 *
 * Run directly:
 *   node --test "shells/web/src/lib/coverflow-motion.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CoverflowGesture, CoverflowMotion, type CoverflowGrid } from './coverflow-motion.ts';

// Twenty covers 66vw wide on a 390 px phone: 257.4 px apart, rounded where layout rounds.
const at = (i: number): number => Math.round(100 + i * 257.4);
const grid: CoverflowGrid = { origin: at(0), pitch: (at(19) - at(0)) / 19, count: 20, at };

function run(m: CoverflowMotion, from: number, until = 3000, step = 1000 / 60): number[] {
  const xs: number[] = [];
  for (let t = from; t <= from + until; t += step) {
    m.advance(t, () => grid, false);
    xs.push(m.position);
  }
  return xs;
}

test('a release ends exactly on a cover, with no jump at the start or the end', () => {
  for (const [start, v] of [
    [at(9) + 40, 1.2],
    [at(9) - 30, -2.5],
    [at(9) + 10, 0],
    [at(9) + 120, 6],
  ] as const) {
    const m = new CoverflowMotion();
    m.reset(start);
    m.release(v, 1000, grid, false);
    const target = m.target!;
    assert.ok(Array.from({ length: 20 }, (_, i) => at(i)).includes(target), `${target} is a cover`);
    m.advance(1000, () => grid, false);
    assert.ok(Math.abs(m.position - start) < 1e-6, 'starts where the strip is');
    const xs = run(m, 1000);
    assert.equal(xs.at(-1), target, 'rests exactly on the cover');
    assert.equal(m.active, false);
    for (let i = 1; i < xs.length; i++)
      assert.ok(Math.abs(xs[i]! - xs[i - 1]!) < 160, `no jump at frame ${i}`);
  }
});

test('a throw lands on the cover nearest its projected end and never swings back past it', () => {
  const m = new CoverflowMotion();
  m.reset(at(5));
  m.release(2, 0, grid, false);
  const xs = run(m, 0);
  assert.ok(m.position > at(6), 'a 2 px/ms throw travels more than one cover');
  for (let i = 1; i < xs.length; i++)
    assert.ok(xs[i]! >= xs[i - 1]! - 1e-9, `reversed at frame ${i}`);
});

test('reduced motion jumps to the nearest cover', () => {
  const m = new CoverflowMotion();
  m.reset(at(3) + 140);
  m.release(5, 0, grid, true);
  assert.equal(m.position, at(4));
  assert.equal(m.active, false);
  m.select(at(7), 0, true);
  assert.equal(m.position, at(7));
});

test('a trackpad is followed 1:1 and settles once quiet, allowing for slow frames', () => {
  const m = new CoverflowMotion();
  m.reset(at(2));
  let t = 0;
  // Fingers, then the operating system's momentum tail dying away.
  for (const d of [1, 3, 10, 30, 40, 30, 20, 12, 6, 3, 1, 1]) {
    m.follow(d, t);
    t += 16;
  }
  assert.equal(m.position, at(2) + 157);
  assert.ok(m.following);
  // Frames 150 ms apart (a busy main thread): 80 ms of quiet is not yet the end.
  assert.equal(
    m.advance(t + 50, () => grid, false),
    true
  );
  assert.equal(
    m.advance(t + 200, () => grid, false),
    true,
    'within 1.5 frames of the last event'
  );
  assert.ok(m.following);
  m.advance(t + 400, () => grid, false);
  assert.equal(m.following, false, 'quiet for longer than a frame and WHEEL_IDLE');
  run(m, t + 400);
  assert.equal(m.position, at(3), 'settles on the cover nearest where the fingers stopped');
});

test('a finger that rested 80 ms before lifting throws nothing', () => {
  const g = new CoverflowGesture();
  g.start(300, 0);
  for (let i = 1; i <= 5; i++) g.move(300 - i * 20, i * 16);
  assert.ok(g.release(80 + 60) > 0, 'a 60 ms pause still throws');
  assert.equal(g.release(80 + 90), 0);
  assert.equal(g.release(80, true), 0, 'a cancelled gesture never throws');
});
