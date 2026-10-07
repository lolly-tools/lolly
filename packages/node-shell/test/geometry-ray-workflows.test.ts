// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGeometryKernel } from '../src/geometry-kernel-node.ts';
import { loadRayComparison } from '../../../scripts/lib/geometry-ray-comparison.ts';
import { createRayBackend } from '../../../tests/helpers/geometry-ray-backend.ts';
import { rayWorkflows } from '../../../tests/helpers/geometry-ray-workflows.ts';
import { rayIndex } from '../../../tests/helpers/geometry-ray-cases.ts';
import { geometryCurves } from '../../../tests/helpers/geometry-kernel-cases.ts';

const kernel = await loadGeometryKernel(),
  module = await loadRayComparison(),
  api = module.makeGeomApi();
for (const row of rayWorkflows())
  test(`complete bridge output agrees with retained WASM casts: ${row.name}`, () => {
    module.setRayProbe(undefined);
    const expected = row.run(api),
      backend = createRayBackend(kernel);
    assert.equal(expected.ok, true);
    try {
      module.setRayProbe(backend.cast);
      assert.deepEqual(row.run(api), expected);
      assert.ok(backend.stats().calls > 0, 'the recipe reaches the substituted stage');
    } finally {
      module.setRayProbe(undefined);
      backend.dispose();
    }
    assert.equal(kernel.stats().paths, 0);
    assert.equal(kernel.stats().bufferBytes, 0);
  });

test('comparison ownership evicts by resident curves as well as path count', () => {
  const backend = createRayBackend(kernel),
    curves = geometryCurves(12000);
  try {
    for (let i = 0; i < 3; i++) {
      const index = rayIndex(curves),
        budget = { work: 200_000_000 };
      assert.deepEqual(backend.cast(index, -100, -100, -1, 0, null, 1e-9, budget), {
        far: 0,
        net: 0,
        ok: true,
      });
      assert.ok(kernel.stats().curves <= 32000);
    }
    assert.equal(backend.stats().evictions, 1);
    assert.equal(kernel.stats().curves, 24000);
  } finally {
    backend.dispose();
  }
  assert.equal(kernel.stats().paths, 0);
  assert.equal(kernel.stats().curves, 0);
});
