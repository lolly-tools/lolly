// SPDX-License-Identifier: MPL-2.0
/**
 * The walker's mixed-width border geometry: the band CSS paints, the padding box a
 * `background-clip: padding-box` fill keeps to, and the per-side lines a dashed border
 * becomes. Pure path maths, so no browser is needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CornerRadii } from '../../../../engine/src/css-box.ts';
import { borderBandPath, borderSideLines, oneDashedBorder, oneSolidBorderColour, paddingBoxPath } from './export-border-band.ts';

const corners = (r: number): CornerRadii => ({ topLeft: [r, r], topRight: [r, r], bottomRight: [r, r], bottomLeft: [r, r] });
const square = corners(0);
const round = corners(12);
const same = (a: string, b: string): boolean => a === b;

test('a mixed border is the border box and, inside it, the padding box with its own corners', () => {
  assert.equal(borderBandPath(0, 0, 100, 50, square, [0, 0, 4, 0]), 'M0,0 H100 V50 H0 V0 Z M0,0 H100 V46 H0 V0 Z');
  // Each inner corner is the outer radius less the widths beside it: 12-10 down at the top, 12-2 across.
  const band = borderBandPath(0, 0, 100, 60, round, [10, 2, 2, 2]);
  assert.match(band, / M12,10 H88 A10,2 0 0 1 98,12 /);
  // A border wider than the box leaves no padding box: the whole box is painted.
  assert.equal(borderBandPath(0, 0, 10, 10, square, [6, 6, 6, 6]), 'M0,0 H10 V10 H0 V0 Z');
  assert.equal(borderBandPath(0, 0, 10, 10, square, [0, 0, 0, 0]), '');
  assert.equal(paddingBoxPath(0, 0, 10, 10, square, [6, 6, 6, 6]), null);
});

test('the band draws only one solid colour; a dashed border goes side by side in one style', () => {
  const side = (width: number, style: string, colour: string | null) => ({ width, style, colour });
  assert.equal(oneSolidBorderColour([side(2, 'solid', 'red'), side(0, 'none', null), side(4, 'solid', 'red'), side(0, 'none', null)], same), 'red');
  assert.equal(oneSolidBorderColour([side(2, 'solid', 'red'), side(4, 'solid', 'blue')], same), null);
  assert.equal(oneSolidBorderColour([side(2, 'dashed', 'red')], same), null);
  assert.deepEqual(oneDashedBorder([side(2, 'dashed', 'red'), side(6, 'dashed', 'red')], same), { colour: 'red', style: 'dashed' });
  assert.equal(oneDashedBorder([side(2, 'dashed', 'red'), side(6, 'dotted', 'red')], same), null);
  assert.deepEqual(borderSideLines(0, 0, 100, 50, [0, 0, 4, 2]), [
    { x1: 100, y1: 48, x2: 0, y2: 48, width: 4 },
    { x1: 1, y1: 50, x2: 1, y2: 0, width: 2 },
  ]);
});
