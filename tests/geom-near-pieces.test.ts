// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visitNearPieces } from '../engine/src/geom/near-pieces.ts';
import { referenceNearPairs, spatialCases } from './helpers/geometry-spatial-cases.ts';

for (const row of spatialCases())
  test(`numeric proximity traversal preserves candidate order: ${row.name}`, () => {
    const expected = referenceNearPairs(row.curves, row.weld),
      pairs: [number, number][] = [];
    visitNearPieces(row.curves, row.weld, (i, j) => {
      pairs.push([i, j]);
      return true;
    });
    assert.deepEqual(pairs, expected);
    assert.equal(new Set(pairs.map((pair) => pair.join(','))).size, pairs.length);
    assert.ok(pairs.every(([i, j]) => i < j));
    const early: [number, number][] = [];
    visitNearPieces(row.curves, row.weld, (i, j) => {
      early.push([i, j]);
      return early.length < 3;
    });
    assert.deepEqual(early, expected.slice(0, 3));
  });

test('an empty spatial pass never invokes its visitor', () => {
  visitNearPieces([], 1, () => {
    assert.fail('empty path had a pair');
  });
});
