// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/psd-outline.ts: Photoshop outlines as SVG path data (plans/289 D2).
 * The winding and union helpers are tested through the Design import in
 * shells/web/src/views/psd-import.test.ts.
 *
 * Run with: node --test tests/psd-outline.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { psdPathData } from '../engine/src/psd-outline.ts';

const k = (x: number, y: number, h?: { inX: number; inY: number; outX: number; outY: number }) => ({ x, y, inX: h?.inX ?? x, inY: h?.inY ?? y, outX: h?.outX ?? x, outY: h?.outY ?? y });

test('a closed outline: one move, a cubic per segment back to the start, then close', () => {
  const d = psdPathData([{ closed: true, op: 1, knots: [k(0, 0), k(10, 0), k(10, 10)] }]);
  assert.equal(d, 'M0 0C0 0 10 0 10 0C10 0 10 10 10 10C10 10 0 0 0 0Z');
});

test('an open outline has no closing segment, handles are kept, and several outlines follow each other', () => {
  const curve = { closed: false, op: 1, knots: [k(0, 0, { inX: 0, inY: 0, outX: 5, outY: -5 }), k(10, 0, { inX: 5, inY: 5, outX: 10, outY: 0 })] };
  assert.equal(psdPathData([curve]), 'M0 0C5 -5 5 5 10 0');
  assert.equal(psdPathData([curve, { closed: true, op: 1, knots: [k(1.234, 2), k(3, 4)] }]), 'M0 0C5 -5 5 5 10 0M1.23 2C1.23 2 3 4 3 4C3 4 1.23 2 1.23 2Z');
  assert.equal(psdPathData([{ closed: true, op: 1, knots: [k(0, 0)] }]), '', 'a single knot draws nothing');
});
