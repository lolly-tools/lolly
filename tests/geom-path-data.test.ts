// SPDX-License-Identifier: MPL-2.0
/**
 * `toSvgPathData` at 0 decimal places keeps whole numbers whole. The trailing-zero
 * trim once ran on every number, so 1524000 EMU was written as 1524 and every
 * custom-geometry path a pptx lowering wrote at 0 places came back shrunk.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathFromSubPaths, toSvgPathData } from '../engine/src/geom/path.ts';
import { parseSvgPath } from '../engine/src/svg-path.ts';

test('whole numbers keep their zeros at 0 decimal places', () => {
  const path = pathFromSubPaths(parseSvgPath('M0 0L1524000 0L1524000 100Z'));
  const d = toSvgPathData(path, 0);
  assert.ok(d.includes('1524000'), d);
  assert.ok(d.includes('100'), d);
});

test('decimals are still trimmed', () => {
  const path = pathFromSubPaths(parseSvgPath('M1.5 2L10 0.25'));
  assert.equal(toSvgPathData(path, 2).startsWith('M1.5 2'), true, toSvgPathData(path, 2));
});
