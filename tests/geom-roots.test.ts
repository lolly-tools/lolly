// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticRootCases, referenceRoots } from './helpers/geometry-root-cases.ts';

for (const row of analyticRootCases())
  test(`TypeScript root positions and crossing directions: ${row.name}`, () => {
    const found = referenceRoots(row.coefficients);
    assert.deepEqual(found.directions, row.directions);
    assert.equal(found.roots.length, row.roots.length);
    row.roots.forEach((root, i) => {
      assert.ok(Math.abs(found.roots[i]! - root) < 1e-12);
    });
  });
