// SPDX-License-Identifier: MPL-2.0
/*
 * slider-ruler.ts - the ruler dial's layout arithmetic and its trial list.
 *
 * Run directly:  node --test shells/web/src/components/slider-ruler.test.ts
 *
 * The gestures, the glide, the keys and the accessibility tree are driven in a real
 * browser by tests/slider-ruler.browser.test.ts. This pins the pure part: how far
 * apart the steps sit, where the labelled ticks fall and where the highlight starts,
 * for the ranges Darkroom uses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const g = globalThis as Record<string, unknown>;
g.document = dom.window.document;
g.window = dom.window;
g.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const { indexAt, rulerDialFor, rulerGeometry } = await import('./slider-ruler.ts');

test('the dial is tried on Darkroom only', () => {
  assert.equal(rulerDialFor('darkroom'), true);
  assert.equal(rulerDialFor('filter'), false);
  assert.equal(rulerDialFor(undefined), false);
});

test('a -100 to 100 range: 12px steps, labels on the tens, highlight from zero', () => {
  const r = rulerGeometry(-100, 100, 1);
  assert.deepEqual(r, { stops: 200, px: 12, major: 10, firstMajor: 0, origin: 100, decimals: 0 });
});

test('fine and offset ranges keep labels on round values', () => {
  // Exposure, -3 to 3 by 0.05: 120 steps, a label every 0.5, zero at step 60.
  assert.deepEqual(rulerGeometry(-3, 3, 0.05), { stops: 120, px: 12, major: 10, firstMajor: 0, origin: 60, decimals: 2 });
  // Input white, 2 to 255: the first label is 10, eight steps in; no zero to start from.
  const w = rulerGeometry(2, 255, 1);
  assert.equal(w.firstMajor, 8);
  assert.equal(w.origin, 0);
  // Midtones, 0.1 to 5 by 0.01: 490 steps squeeze to the 6px floor.
  assert.equal(rulerGeometry(0.1, 5, 0.01).px, 6);
});

test('a position rests on the nearest step, never past either end', () => {
  const r = rulerGeometry(-100, 100, 1);
  assert.equal(indexAt(0, r), 0);
  assert.equal(indexAt(17, r), 1);
  assert.equal(indexAt(18, r), 2);
  assert.equal(indexAt(-40, r), 0);
  assert.equal(indexAt(5000, r), 200);
});
