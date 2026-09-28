// SPDX-License-Identifier: MPL-2.0
/**
 * lib/arrow-nav.ts nearestInDirection - the geometric move the tile grids share.
 * Pure (rects in, item out), so no layout engine is needed.
 *
 * Run directly:  node --test shells/web/src/lib/arrow-nav.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestInDirection } from './arrow-nav.ts';

const rect = (x: number, y: number, w = 100, h = 100): DOMRect =>
  ({ left: x, top: y, right: x + w, bottom: y + h, x, y, width: w, height: h, toJSON: () => ({}) }) as DOMRect;

// A 3 x 2 grid of 100px tiles with 20px gaps:  a b c / d e f
const grid = {
  a: rect(0, 0), b: rect(120, 0), c: rect(240, 0),
  d: rect(0, 120), e: rect(120, 120), f: rect(240, 120),
};
const others = (skip: string) => Object.entries(grid).filter(([k]) => k !== skip).map(([item, r]) => ({ item, r }));

test('arrows move to the neighbour in that direction', () => {
  assert.equal(nearestInDirection(grid.e, 'ArrowLeft', others('e')), 'd');
  assert.equal(nearestInDirection(grid.e, 'ArrowRight', others('e')), 'f');
  assert.equal(nearestInDirection(grid.e, 'ArrowUp', others('e')), 'b');
  assert.equal(nearestInDirection(grid.b, 'ArrowDown', others('b')), 'e');
});

test('Down prefers the tile straight below over a nearer diagonal one', () => {
  const diag = { item: 'diagonal', r: rect(120, 130) };
  // Sideways drift costs three times vertical distance: 300 down beats 130 down + 120 across.
  assert.equal(nearestInDirection(rect(0, 0), 'ArrowDown', [{ item: 'below', r: rect(0, 300) }, diag]), 'below');
  // Only a much further tile straight below loses to the diagonal one.
  assert.equal(nearestInDirection(rect(0, 0), 'ArrowDown', [{ item: 'below', r: rect(0, 600) }, diag]), 'diagonal');
});

test('nothing in that direction is null, so the edge of the grid stays put', () => {
  assert.equal(nearestInDirection(grid.a, 'ArrowLeft', others('a')), null);
  assert.equal(nearestInDirection(grid.a, 'ArrowUp', others('a')), null);
  assert.equal(nearestInDirection(grid.f, 'ArrowRight', others('f')), null);
});
