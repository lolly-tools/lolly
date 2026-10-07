// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadGeometryKernel } from '../src/geometry-kernel-node.ts';
import { GEOMETRY_MAX_POLYNOMIALS, type GeometryPolynomial } from '../src/geometry-kernel.ts';
import {
  analyticRootCases,
  referenceRoots,
  rootPolynomialCorpus,
  lineDistanceBatches,
} from '../../../tests/helpers/geometry-root-cases.ts';

const kernel = await loadGeometryKernel();
for (const row of analyticRootCases())
  test(`WASM root positions and crossing directions: ${row.name}`, () => {
    const workspace = kernel.createRootWorkspace();
    try {
      const found = workspace.solve([row.coefficients])[0]!;
      assert.deepEqual(found, referenceRoots(row.coefficients));
      assert.deepEqual(found.directions, row.directions);
      assert.equal(found.roots.length, row.roots.length);
      row.roots.forEach((root, i) => {
        assert.ok(Math.abs(found.roots[i]! - root) < 1e-12);
      });
    } finally {
      workspace.dispose();
    }
    assert.equal(kernel.stats().bufferBytes, 0);
  });

for (const row of [
  { name: '4096 scaled and degenerate cubics', coefficients: rootPolynomialCorpus() },
  ...lineDistanceBatches(),
])
  test(`WASM batched roots retain exact f64 positions and directions: ${row.name}`, () => {
    const workspace = kernel.createRootWorkspace();
    try {
      assert.deepEqual(workspace.solve(row.coefficients), row.coefficients.map(referenceRoots));
      assert.ok(kernel.stats().linearBytes <= 16 * 1024 * 1024);
    } finally {
      workspace.dispose();
    }
    assert.equal(kernel.stats().bufferBytes, 0);
  });

test('root workspace owns results, reuses buffers and admits a complete valid batch', () => {
  const workspace = kernel.createRootWorkspace(),
    coefficients: [number, number, number, number] = [0, 0, 2, -1];
  const first = workspace.solve([coefficients]);
  const retained = kernel.stats().bufferBytes;
  coefficients[3] = -0.25;
  assert.deepEqual(workspace.solve([coefficients]), [{ roots: [0.125], directions: [1] }]);
  assert.deepEqual(first, [{ roots: [0.5], directions: [1] }]);
  assert.equal(kernel.stats().bufferBytes, retained);
  assert.deepEqual(workspace.solve([]), []);
  assert.throws(
    () =>
      workspace.solve([
        [0, 0, 2, -1],
        [0, 0, NaN, 0],
      ]),
    { code: 'invalid-argument' }
  );
  assert.throws(() => workspace.solve([[0, 0, Infinity, 0]]), { code: 'invalid-argument' });
  assert.throws(() => workspace.solve([[0, 0, 1e101, 0]]), { code: 'invalid-argument' });
  assert.throws(() => workspace.solve([[1, 2, 3] as unknown as GeometryPolynomial]), {
    code: 'invalid-argument',
  });
  assert.throws(() => workspace.solve(Array(GEOMETRY_MAX_POLYNOMIALS + 1).fill(coefficients)), {
    code: 'limit',
  });
  assert.equal(kernel.stats().bufferBytes, retained);
  assert.equal(workspace.solve([coefficients, coefficients]).length, 2);
  assert.equal(kernel.stats().bufferBytes, 208);
  workspace.dispose();
  workspace.dispose();
  assert.throws(() => workspace.solve([]), { code: 'invalid-argument' });
  assert.equal(kernel.stats().bufferBytes, 0);
});

test('root buffer admission releases partial allocations and recovers after disposal', () => {
  const path = kernel.prepare([[0, 0, 0, 0, 0, 0, 0, 0]]),
    workspaces = Array.from({ length: 16 }, () => kernel.createRootWorkspace());
  try {
    path.nearPairs(1, 1);
    for (let i = 0; i < 15; i++) workspaces[i]!.solve([[0, 0, 1, -0.5]]);
    const retained = kernel.stats().bufferBytes;
    assert.throws(() => workspaces[15]!.solve([[0, 0, 1, -0.5]]), { code: 'limit' });
    assert.equal(kernel.stats().bufferBytes, retained);
    path.dispose();
    assert.equal(workspaces[15]!.solve([[0, 0, 1, -0.5]])[0]!.roots[0], 0.5);
  } finally {
    path.dispose();
    for (const workspace of workspaces) workspace.dispose();
  }
  assert.equal(kernel.stats().bufferBytes, 0);
});

test('root workspaces share the aggregate buffer ceiling with other geometry queries', () => {
  const coefficients = Array<GeometryPolynomial>(4096).fill([0, 0, 0, 0]),
    workspaces = Array.from({ length: 10 }, () => kernel.createRootWorkspace());
  try {
    for (let i = 0; i < 9; i++) workspaces[i]!.solve(coefficients);
    const retained = kernel.stats().bufferBytes;
    assert.equal(retained, 9 * 4096 * 104);
    assert.throws(() => workspaces[9]!.solve(coefficients), { code: 'limit' });
    assert.equal(kernel.stats().bufferBytes, retained);
    assert.ok(kernel.stats().linearBytes <= 16 * 1024 * 1024);
  } finally {
    for (const workspace of workspaces) workspace.dispose();
  }
  assert.equal(kernel.stats().bufferBytes, 0);
});

test('raw root batches refuse malformed, oversized and aliased buffers atomically', async () => {
  const bytes = new Uint8Array(
    await readFile(new URL('../wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url))
  );
  assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(bytes)), []);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const api = instance.exports as WebAssembly.Exports & {
    memory: WebAssembly.Memory;
    geom_alloc(bytes: number): number;
    geom_free(pointer: number): void;
    geom_cubic_roots_batch(input: number, output: number): number;
    geom_buffer_bytes(): number;
  };
  const input = api.geom_alloc(64),
    output = api.geom_alloc(144),
    malformed = api.geom_alloc(31),
    short = api.geom_alloc(143),
    oversized = api.geom_alloc(4097 * 32);
  try {
    const original = new Uint8Array(144).fill(123);
    new Uint8Array(api.memory.buffer, output, 144).set(original);
    new DataView(api.memory.buffer).setFloat64(input + 56, NaN, true);
    assert.equal(api.geom_cubic_roots_batch(input, output), 2, 'last coefficient invalid');
    assert.equal(api.geom_cubic_roots_batch(malformed, output), 2);
    assert.equal(api.geom_cubic_roots_batch(oversized, output), 3);
    assert.equal(api.geom_cubic_roots_batch(input, input), 1);
    assert.equal(api.geom_cubic_roots_batch(input + 8, output), 1);
    assert.equal(api.geom_cubic_roots_batch(input, short), 2);
    assert.deepEqual(new Uint8Array(api.memory.buffer, output, 144), original);
    new DataView(api.memory.buffer).setFloat64(input + 56, 0, true);
    assert.equal(api.geom_cubic_roots_batch(input, output), 0);
    assert.ok(
      new Uint8Array(api.memory.buffer, output, 144).every((value) => value === 0),
      'empty results overwrite every slot'
    );
    api.geom_free(input);
    assert.equal(api.geom_cubic_roots_batch(input, output), 1);
  } finally {
    for (const pointer of [input, output, malformed, short, oversized]) api.geom_free(pointer);
  }
  assert.equal(api.geom_buffer_bytes(), 0);
});
