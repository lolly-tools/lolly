// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nearestOnCubic, type Cubic } from '../../../engine/src/geom/bezier.ts';
import { registerNearestConformance } from '../../../tests/helpers/nearest-conformance.ts';
import { loadGeometryKernel } from '../src/geometry-kernel-node.ts';

const kernel = await loadGeometryKernel();
registerNearestConformance((curve, x, y) => {
  const path = kernel.prepare([curve]);
  try {
    return path.nearest(x, y);
  } finally {
    path.dispose();
  }
});

test('prepared paths preserve control snapshots, tie order and original curve parameters', () => {
  const curves: Cubic[] = [
    [0, 0, 0, 0, 0, 0, 100, 0],
    [0, 0, 0, 0, 0, 0, 100, 0],
  ];
  const path = kernel.prepare(curves);
  curves[0]![6] = 500;
  curves.push([1, 1, 1, 1, 1, 1, 1, 1]);
  try {
    const result = path.nearest(50, 10);
    assert.equal(result.curve, 0);
    assert.deepEqual(
      { t: result.t, point: result.point, distance: result.distance },
      nearestOnCubic([0, 0, 0, 0, 0, 0, 100, 0], 50, 10)
    );
    assert.deepEqual(
      path.nearestBatch([
        [50, 10],
        [25, -2],
      ]),
      [path.nearest(50, 10), path.nearest(25, -2)]
    );
  } finally {
    path.dispose();
    path.dispose();
  }
  assert.throws(() => path.nearest(0, 0), { code: 'invalid-argument' });
  assert.equal(kernel.stats().paths, 0);
  assert.equal(kernel.stats().bufferBytes, 0);
});

test('invalid geometry, resident path limits and query budgets fail explicitly', () => {
  const line: Cubic = [0, 0, 0, 0, 0, 0, 100, 0];
  assert.throws(() => kernel.prepare([[0, 0, 0, 0, 0, 0, Number.NaN, 0]]), {
    code: 'invalid-argument',
  });
  assert.throws(() => kernel.prepare(Array(16001).fill(line)), { code: 'limit' });
  const paths = Array.from({ length: 8 }, () => kernel.prepare([line]));
  try {
    assert.throws(() => kernel.prepare([line]), { code: 'limit' });
  } finally {
    for (const path of paths) path.dispose();
  }
  const path = kernel.prepare(Array(16000).fill(line));
  try {
    assert.throws(() => path.nearest(1e10, 0), { code: 'invalid-argument' });
    assert.throws(() => path.nearestBatch(Array(17).fill([0, 0])), { code: 'limit' });
    assert.throws(
      () =>
        path.nearestBatch([
          [0, 0],
          [Number.NaN, 0],
        ]),
      { code: 'invalid-argument' }
    );
  } finally {
    path.dispose();
  }
  assert.equal(kernel.stats().paths, 0);
  assert.equal(kernel.stats().curves, 0);
  assert.equal(kernel.stats().bufferBytes, 0);
});

test('raw WASM ABI refuses unknown/stale handles and leaves output untouched on invalid batches', async () => {
  const bytes = await readFile(
    new URL('../wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url)
  );
  const { instance } = await WebAssembly.instantiate(new Uint8Array(bytes), {});
  const api = instance.exports as WebAssembly.Exports & {
    memory: WebAssembly.Memory;
    geom_alloc(length: number): number;
    geom_free(pointer: number): void;
    geom_path_create(pointer: number): number;
    geom_path_free(handle: number): void;
    geom_nearest_batch(handle: number, queries: number, output: number): number;
    geom_buffer_bytes(): number;
    geom_path_count(): number;
  };
  assert.equal(api.geom_path_create(0), -1);
  assert.equal(api.geom_alloc(2 * 1024 * 1024 + 1), 0);
  const source = api.geom_alloc(64),
    queries = api.geom_alloc(32),
    output = api.geom_alloc(80);
  let handle = 0;
  try {
    handle = api.geom_path_create(source);
    assert.ok(handle > 0);
    new Uint8Array(api.memory.buffer, output, 80).fill(123);
    new DataView(api.memory.buffer).setFloat64(queries + 16, Number.NaN, true);
    assert.equal(api.geom_nearest_batch(handle, queries, output), 2);
    assert.ok(new Uint8Array(api.memory.buffer, output, 80).every((value) => value === 123));
    api.geom_path_free(handle);
    const replacement = api.geom_path_create(source);
    assert.ok(replacement > handle);
    assert.equal(api.geom_nearest_batch(handle, queries, output), 1);
    api.geom_path_free(replacement);
  } finally {
    api.geom_path_free(handle);
    api.geom_free(source);
    api.geom_free(queries);
    api.geom_free(output);
  }
  assert.equal(api.geom_path_count(), 0);
  assert.equal(api.geom_buffer_bytes(), 0);
});
