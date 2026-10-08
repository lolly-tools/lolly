// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castRay } from '../engine/src/geom/ray-cast.ts';
import { rayCases } from './helpers/geometry-ray-cases.ts';

for (const row of rayCases().filter((row) => row.expected))
  test(`TypeScript complete ray semantics: ${row.name}`, () => {
    const budget = { work: row.work };
    const result = castRay(
      row.index,
      ...row.point,
      ...row.direction,
      row.ref,
      row.near,
      budget,
      row.complete,
      row.bundle
    );
    assert.deepEqual({ ...result, work: budget.work }, row.expected);
  });
