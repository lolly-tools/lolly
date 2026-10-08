// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadGeometryKernel } from '../src/geometry-kernel-node.ts';
import type { GeometryExports } from '../src/geometry-kernel-contract.ts';
import { castRay } from '../../../engine/src/geom/ray-cast.ts';
import { rayCases, rayIndex } from '../../../tests/helpers/geometry-ray-cases.ts';
import { geometryCurves } from '../../../tests/helpers/geometry-kernel-cases.ts';

const kernel = await loadGeometryKernel();
for (const row of rayCases())
  test(`WASM complete ray preserves counts and exact budget: ${row.name}`, () => {
    const index = kernel.prepareRayIndex(row.index),
      referenceBudget = { work: row.work },
      budget = { work: row.work };
    try {
      const expected = castRay(
        row.index,
        ...row.point,
        ...row.direction,
        row.ref,
        row.near,
        referenceBudget,
        row.complete,
        row.bundle
      );
      const actual = index.cast(
        ...row.point,
        ...row.direction,
        row.ref,
        row.near,
        budget,
        row.complete,
        row.bundle
      );
      assert.deepEqual(actual, expected);
      assert.equal(budget.work, referenceBudget.work);
      if (row.expected) assert.deepEqual({ ...actual, work: budget.work }, row.expected);
    } finally {
      index.dispose();
    }
    assert.equal(kernel.stats().paths, 0);
    assert.equal(kernel.stats().bufferBytes, 0);
  });

test('ray indexes own controls/boxes and results; bundle contents are read afresh', () => {
  const row = rayCases().find((row) => row.name === 'front twin range')!;
  const path = kernel.prepareRayIndex(row.index),
    budget = { work: 100 };
  try {
    const first = path.cast(
      ...row.point,
      ...row.direction,
      row.ref,
      row.near,
      budget,
      false,
      row.bundle
    );
    assert.deepEqual(first, { far: 0, net: 1, ok: true });
    assert.equal(kernel.stats().bufferBytes, 152);
    row.index.curves[0]!.c.fill(999);
    row.index.curves[0]!.box.x0 = 999;
    row.index.box!.x1 = 999;
    budget.work = 100;
    assert.deepEqual(
      path.cast(...row.point, ...row.direction, row.ref, row.near, budget, false, row.bundle),
      first
    );
    row.bundle!.set(0, [[0.1, 0.2]]);
    budget.work = 100;
    assert.deepEqual(
      path.cast(...row.point, ...row.direction, row.ref, row.near, budget, false, row.bundle),
      { far: 1, net: 0, ok: true }
    );
    assert.equal(kernel.stats().bufferBytes, 152);
    row.bundle!.set(0, [
      [0.1, 0.2],
      [0.4, 0.6],
    ]);
    budget.work = 100;
    assert.equal(
      path.cast(...row.point, ...row.direction, row.ref, row.near, budget, false, row.bundle).net,
      1
    );
    assert.equal(kernel.stats().bufferBytes, 176);
    budget.work = 100;
    path.cast(...row.point, ...row.direction, row.ref, row.near, budget);
    assert.equal(kernel.stats().bufferBytes, 128);
    assert.deepEqual(first, { far: 0, net: 1, ok: true });
  } finally {
    path.dispose();
    path.dispose();
  }
  assert.throws(() => path.cast(0, 0, 1, 0, null, 1e-9, budget), { code: 'invalid-argument' });
  assert.equal(kernel.stats().bufferBytes, 0);
});

test('ray admission refuses invalid metadata or queries without spending caller work', () => {
  const row = rayCases()[0]!,
    path = kernel.prepareRayIndex(row.index),
    budget = { work: 100 };
  const cast = (bundle: Map<number, [number, number][]> | null = null) =>
    path.cast(0, 0, 1, 0, null, 1e-9, budget, false, bundle);
  try {
    assert.throws(() => cast(new Map([[1, [[0, 1]]]])), { code: 'invalid-argument' });
    assert.throws(() => cast(new Map([[0, [[NaN, 1]]]])), { code: 'invalid-argument' });
    assert.throws(() => cast(new Map([[0, [[0.7, 0.3]]]])), { code: 'invalid-argument' });
    assert.throws(() => cast(new Map([[0, Array<[number, number]>(4097).fill([0, 1])]])), {
      code: 'limit',
    });
    assert.throws(() => path.cast(0, 0, 2, 0, null, 1e-9, budget), { code: 'invalid-argument' });
    assert.throws(() => path.cast(NaN, 0, 1, 0, null, 1e-9, budget), { code: 'invalid-argument' });
    assert.throws(() => path.cast(0, 0, 1, 0, null, 0, budget), { code: 'invalid-argument' });
    assert.equal(budget.work, 100);
    assert.equal(kernel.stats().bufferBytes, 0);
    row.index.box!.x0 = 10;
    assert.throws(() => kernel.prepareRayIndex(row.index), { code: 'invalid-argument' });
    assert.equal(kernel.stats().paths, 1);
  } finally {
    path.dispose();
  }
});

test('the largest admitted ray index preserves scan-prefix budgets within 16 MiB', () => {
  const index = rayIndex(geometryCurves(16000)),
    path = kernel.prepareRayIndex(index);
  try {
    for (const work of [16000, 15999, 1, 0]) {
      const budget = { work },
        reference = { work };
      const expected = castRay(index, -100, -100, -1, 0, null, 1e-9, reference);
      assert.deepEqual(path.cast(-100, -100, -1, 0, null, 1e-9, budget), expected);
      assert.deepEqual(budget, reference);
    }
    assert.ok(kernel.stats().linearBytes <= 16 * 1024 * 1024);
  } finally {
    path.dispose();
  }
  assert.equal(kernel.stats().curves, 0);
  assert.equal(kernel.stats().bufferBytes, 0);
});

test('ray indexes share resident-path admission with nearest paths', () => {
  const row = rayCases()[0]!,
    paths = Array.from({ length: 8 }, () => kernel.prepareRayIndex(row.index));
  try {
    assert.throws(() => kernel.prepareRayIndex(row.index), { code: 'limit' });
    assert.equal(kernel.stats().paths, 8);
    assert.equal(kernel.stats().bufferBytes, 0);
    paths[0]!.dispose();
    const ordinary = kernel.prepare([row.index.curves[0]!.c]);
    ordinary.dispose();
  } finally {
    for (const path of paths) path.dispose();
  }
  assert.equal(kernel.stats().paths, 0);
});

test('ray allocation refusal cleans a partial query and preserves caller budget', () => {
  const row = rayCases()[0]!,
    path = kernel.prepareRayIndex(row.index),
    ordinary = kernel.prepare([row.index.curves[0]!.c]);
  const roots = Array.from({ length: 15 }, () => kernel.createRootWorkspace()),
    budget = { work: 100 };
  try {
    for (const workspace of roots) workspace.solve([[0, 0, 0, 0]]);
    ordinary.nearPairs(1, 1);
    const retained = kernel.stats().bufferBytes;
    assert.throws(() => path.cast(0, 0, 1, 0, null, 1e-9, budget), { code: 'limit' });
    assert.equal(kernel.stats().bufferBytes, retained);
    assert.equal(budget.work, 100);
    ordinary.dispose();
    assert.equal(path.cast(0, 0, 1, 0, null, 1e-9, budget).far, 1);
    budget.work = 100;
    assert.throws(
      () => path.cast(0, 0, 1, 0, null, 1e-9, budget, false, new Map([[0, [[0, 1]]]])),
      { code: 'limit' }
    );
    assert.equal(budget.work, 100);
    roots[0]!.dispose();
    assert.equal(path.cast(0, 0, 1, 0, null, 1e-9, budget, false, new Map([[0, [[0, 1]]]])).far, 1);
  } finally {
    path.dispose();
    ordinary.dispose();
    for (const workspace of roots) workspace.dispose();
  }
  assert.equal(kernel.stats().bufferBytes, 0);
  assert.equal(kernel.stats().paths, 0);
});

test('the maximum bundle retains range membership and finite memory', () => {
  const row = rayCases().find((row) => row.name === 'front twin range')!,
    path = kernel.prepareRayIndex(row.index);
  const ranges: [number, number][] = Array.from({ length: 4096 }, () => [0, 0.001]);
  ranges[4095] = [0.4, 0.6];
  const bundle = new Map([[0, ranges]]),
    budget = { work: 100 },
    referenceBudget = { work: 100 };
  try {
    assert.deepEqual(
      path.cast(...row.point, ...row.direction, row.ref, row.near, budget, false, bundle),
      castRay(
        row.index,
        ...row.point,
        ...row.direction,
        row.ref,
        row.near,
        referenceBudget,
        false,
        bundle
      )
    );
    assert.deepEqual(budget, referenceBudget);
    assert.ok(kernel.stats().linearBytes <= 16 * 1024 * 1024);
  } finally {
    path.dispose();
  }
  assert.equal(kernel.stats().bufferBytes, 0);
});

test('raw complete ray refusals are atomic, and an ordinary path is not an indexed path', async () => {
  const bytes = new Uint8Array(
    await readFile(new URL('../wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url))
  );
  assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(bytes)), []);
  const { instance } = await WebAssembly.instantiate(bytes, {}),
    api = instance.exports as GeometryExports;
  const source = api.geom_alloc(96),
    query = api.geom_alloc(96),
    output = api.geom_alloc(32),
    ranges = api.geom_alloc(24),
    oversized = api.geom_alloc(4097 * 24),
    short = api.geom_alloc(31),
    plainSource = api.geom_alloc(64);
  const { c, box } = rayCases()[0]!.index.curves[0]!;
  let view = new DataView(api.memory.buffer);
  [...c, box.x0, box.y0, box.x1, box.y1].forEach((value, i) => {
    view.setFloat64(source + i * 8, value, true);
  });
  const handle = api.geom_ray_path_create(source),
    ordinary = api.geom_path_create(plainSource);
  try {
    view = new DataView(api.memory.buffer);
    [0, 0, 1, 0, 1e-9, 7, 14, 0, 0, 0, 0, 100].forEach((value, i) => {
      view.setFloat64(query + i * 8, value, true);
    });
    const sentinel = new Uint8Array(32).fill(123);
    new Uint8Array(api.memory.buffer, output, 32).set(sentinel);
    view.setFloat64(query + 88, NaN, true);
    assert.equal(api.geom_ray_cast(handle, query, 0, output), 2);
    view.setFloat64(query + 88, 100, true);
    assert.equal(api.geom_ray_cast(handle, query, oversized, output), 3);
    view.setFloat64(ranges, 1, true);
    assert.equal(api.geom_ray_cast(handle, query, ranges, output), 2);
    assert.equal(api.geom_ray_cast(handle, query + 8, 0, output), 1);
    assert.equal(api.geom_ray_cast(ordinary, query, 0, output), 1);
    assert.equal(api.geom_ray_cast(handle, query, 0, short), 2);
    assert.equal(api.geom_ray_cast(handle, query, output, output), 1);
    assert.deepEqual(new Uint8Array(api.memory.buffer, output, 32), sentinel);
    assert.equal(api.geom_ray_cast(handle, query, 0, output), 0);
    assert.deepEqual(
      Array.from({ length: 4 }, (_, i) =>
        new DataView(api.memory.buffer).getFloat64(output + i * 8, true)
      ),
      [1, 0, 1, 91]
    );
    api.geom_path_free(handle);
    assert.equal(api.geom_ray_cast(handle, query, 0, output), 1);
  } finally {
    api.geom_path_free(handle);
    api.geom_path_free(ordinary);
    for (const pointer of [source, query, output, ranges, oversized, short, plainSource])
      api.geom_free(pointer);
  }
  assert.equal(api.geom_path_count(), 0);
  assert.equal(api.geom_buffer_bytes(), 0);
});
