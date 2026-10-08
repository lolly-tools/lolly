// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadGeometryKernel } from '../src/geometry-kernel-node.ts';
import { referenceNearPairs, spatialCases } from '../../../tests/helpers/geometry-spatial-cases.ts';
import { geometryCurves } from '../../../tests/helpers/geometry-kernel-cases.ts';

const kernel = await loadGeometryKernel();
for (const row of spatialCases())
  test(`WASM proximity traversal preserves exact ordered pairs: ${row.name}`, () => {
    const path = kernel.prepare(row.curves);
    try {
      assert.deepEqual(path.nearPairs(row.weld), referenceNearPairs(row.curves, row.weld));
    } finally {
      path.dispose();
    }
    assert.equal(kernel.stats().bufferBytes, 0);
    assert.equal(kernel.stats().paths, 0);
  });

test('the largest admitted sparse path remains within the linear-memory ceiling', () => {
  const curves = geometryCurves(8000),
    path = kernel.prepare(curves);
  try {
    assert.deepEqual(path.nearPairs(1e-7), referenceNearPairs(curves, 1e-7));
    assert.ok(kernel.stats().linearBytes <= 16 * 1024 * 1024);
  } finally {
    path.dispose();
  }
  assert.equal(kernel.stats().paths, 0);
  assert.equal(kernel.stats().curves, 0);
  assert.equal(kernel.stats().bufferBytes, 0);
});

test('proximity admission, resizing and disposed handles are explicit', () => {
  const curve = spatialCases()[0]!.curves[0]!;
  const path = kernel.prepare(Array(4).fill(curve));
  try {
    assert.throws(() => path.nearPairs(0), { code: 'invalid-argument' });
    assert.throws(() => path.nearPairs(Number.NaN), { code: 'invalid-argument' });
    assert.throws(() => path.nearPairs(1, 5), { code: 'limit' });
    assert.equal(path.nearPairs(1, 6).length, 6);
    assert.equal(kernel.stats().bufferBytes, 48);
    assert.throws(() => path.nearPairs(1, 65537), { code: 'limit' });
  } finally {
    path.dispose();
  }
  assert.throws(() => path.nearPairs(1), { code: 'invalid-argument' });
  const large = kernel.prepare(Array(8001).fill(curve));
  try {
    assert.throws(() => large.nearPairs(1), { code: 'limit' });
  } finally {
    large.dispose();
  }
  assert.equal(kernel.stats().bufferBytes, 0);
});

test('raw spatial refusal preserves the entire output buffer', async () => {
  const bytes = await readFile(
    new URL('../wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url)
  );
  assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(new Uint8Array(bytes))), []);
  const { instance } = await WebAssembly.instantiate(new Uint8Array(bytes), {});
  const api = instance.exports as WebAssembly.Exports & {
    memory: WebAssembly.Memory;
    geom_alloc(bytes: number): number;
    geom_free(pointer: number): void;
    geom_path_create(pointer: number): number;
    geom_path_free(handle: number): void;
    geom_near_pairs(handle: number, weld: number, output: number): number;
  };
  const source = api.geom_alloc(256),
    output = api.geom_alloc(40),
    handle = api.geom_path_create(source);
  try {
    new Uint8Array(api.memory.buffer, output, 40).fill(123);
    assert.equal(api.geom_near_pairs(handle, 1, output), -3);
    assert.equal(api.geom_near_pairs(handle, Number.NaN, output), -2);
    assert.ok(new Uint8Array(api.memory.buffer, output, 40).every((value) => value === 123));
    api.geom_path_free(handle);
    assert.equal(api.geom_near_pairs(handle, 1, output), -1);
  } finally {
    api.geom_path_free(handle);
    api.geom_free(source);
    api.geom_free(output);
  }
});
