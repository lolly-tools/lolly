// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadOffsetFitComparison } from '../../../scripts/lib/geometry-offset-fit-comparison.ts';
import {
  offsetFitCases,
  seededOffsetFitCases,
} from '../../../tests/helpers/geometry-offset-fit-cases.ts';
import {
  bitsFloat,
  floatBits,
  probePortableMath,
  type FittingMathCase,
} from '../../../tests/helpers/geometry-portable-math-cases.ts';
import {
  createGeometryFitting,
  createOffsetFitWorkspace,
  type GeometryFittingExports,
} from '../src/geometry-fitting.ts';
import { loadGeometryFitting } from '../src/geometry-fitting-node.ts';
import { pieceBits } from '../../../tests/helpers/geometry-portable-fit-compatibility.ts';

const bytes = await readFile(
  new URL('../wasm/geometry-kernel/geometry-fit-portable.wasm', import.meta.url)
);
const kernel = await loadGeometryFitting();
const { module } = await loadOffsetFitComparison();
test('portable fitting rejects host imports, other modules and retired maths modes', async () => {
  // A minimal module importing lolly_math.sin: the fitting loader admits no host import.
  const host = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 1, 124, 1, 124, 2, 18, 1, 10, ...new TextEncoder().encode('lolly_math'), 3, ...new TextEncoder().encode('sin'), 0, 0]);
  await assert.rejects(() => createGeometryFitting(host), { code: 'internal' });
  await assert.rejects(() => createGeometryFitting(bytes, 'host' as never), { code: 'invalid-argument' });
  const base = await readFile(
    new URL('../wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url)
  );
  await assert.rejects(() => createGeometryFitting(base), { code: 'internal' });
  assert.deepEqual(WebAssembly.Module.imports(await WebAssembly.compile(bytes)), []);
  assert.equal((await createGeometryFitting(bytes)).stats().mathBackend, 'portable');
});
test('portable scalar signed zeros, quadrants and nonfinite classifications match their definitions', async () => {
  const rows: [FittingMathCase['name'], number[], number][] = [
    ['sin', [0], 0],
    ['sin', [-0], -0],
    ['cos', [-0], 1],
    ['acos', [1], 0],
    ['acos', [-1], Math.PI],
    ['acos', [0], Math.PI / 2],
    ['cbrt', [0], 0],
    ['cbrt', [-0], -0],
    ['cbrt', [8], 2],
    ['cbrt', [-8], -2],
    ['atan2', [0, 0], 0],
    ['atan2', [-0, 0], -0],
    ['atan2', [0, -0], Math.PI],
    ['atan2', [-0, -0], -Math.PI],
    ['atan2', [1, 0], Math.PI / 2],
    ['atan2', [-1, 0], -Math.PI / 2],
    ['sin', [Infinity], NaN],
    ['cos', [-Infinity], NaN],
    ['acos', [1.01], NaN],
    ['cbrt', [Infinity], Infinity],
    ['cbrt', [-Infinity], -Infinity],
    ['atan2', [NaN, 1], NaN],
  ];
  assert.deepEqual(
    await probePortableMath(
      bytes,
      rows.map(([name, args]) => ({ name, args: args.map(floatBits) }))
    ),
    rows.map(([, , expected]) => floatBits(expected))
  );
});
test('portable scalars stay within two ulps of independent high-precision fixtures', async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL('../../../tests/fixtures/geometry-math/portable-vectors.json', import.meta.url),
      'utf8'
    )
  ) as {
    rows: (FittingMathCase & { expected: string })[];
  };
  const actual = await probePortableMath(bytes, fixture.rows);
  fixture.rows.forEach((row, i) => {
    assert.ok(Number.isFinite(bitsFloat(actual[i]!)));
    const delta = BigInt('0x' + actual[i]!) - BigInt('0x' + row.expected);
    assert.ok(
      delta >= -2n && delta <= 2n,
      `${row.name}(${row.args.join(',')}): ${actual[i]} vs ${row.expected}`
    );
  });
});
test('portable fitting returns the TypeScript reference bits on every fixed and seeded request', () => {
  // Both implementations call one compiled scalar maths (engine/src/geom/portable-math.ts),
  // so the earlier legacy-rounding census is now empty by construction.
  const workspace = kernel.createOffsetFitWorkspace();
  try {
    for (const row of [...offsetFitCases(), ...seededOffsetFitCases()]) {
      const input = structuredClone(row);
      const actual = workspace.fit(row.src, row.distance, row.tol);
      assert.deepEqual(pieceBits(actual), pieceBits(module.offsetPieces(row.src, row.distance, row.tol)), row.name);
      assert.deepEqual(row, input);
      assert.equal(kernel.stats().results, 0);
      assert.equal(kernel.stats().pieces, 0);
    }
  } finally {
    workspace.dispose();
  }
  assert.equal(kernel.stats().bufferBytes, 0);
});
test('portable result admission, atomic delivery and exhaustion preserve ownership and recovery', async () => {
  const instance = await WebAssembly.instantiate(await WebAssembly.compile(bytes));
  const api = instance.exports as GeometryFittingExports;
  const query = api.geom_alloc(80),
    output = api.geom_alloc(112);
  const row = offsetFitCases()[0]!;
  const write = (values: number[]) =>
    values.forEach((v, i) => {
      new DataView(api.memory.buffer).setFloat64(query + i * 8, v, true);
    });
  write([...row.src, 6, 0.01]);
  const handles = Array.from({ length: 8 }, () => api.geom_offset_fit_create(query));
  assert.ok(handles.every((h) => h > 0));
  assert.equal(api.geom_offset_fit_create(query), -2);
  new Uint8Array(api.memory.buffer, output, 112).fill(0xa5);
  assert.equal(api.geom_offset_fit_read(handles[0]!, query), 2);
  assert.equal(api.geom_offset_fit_read(handles[0]!, output + 1), 1);
  assert.deepEqual(new Uint8Array(api.memory.buffer, output, 112), new Uint8Array(112).fill(0xa5));
  const workspace = createOffsetFitWorkspace(api);
  assert.throws(() => workspace.fit(row.src, 6, 0.01), { code: 'limit' });
  assert.equal(api.geom_buffer_bytes(), 192);
  for (const h of handles) api.geom_offset_fit_free(h);
  write([...row.src, 6, 0]);
  assert.equal(api.geom_offset_fit_create(query), -1);
  assert.equal(workspace.fit(row.src, 6, 0.01).length, 1);
  workspace.dispose();
  const large = offsetFitCases().find((c) => c.name === 'large-position')!;
  write([...large.src, large.distance, large.tol]);
  const largeHandles = Array.from({ length: 4 }, () => api.geom_offset_fit_create(query));
  assert.ok(largeHandles.every((h) => h > 0 && api.geom_offset_fit_len(h) === 8192));
  assert.equal(api.geom_offset_fit_pieces(), 32768);
  assert.equal(api.geom_offset_fit_create(query), -2);
  assert.equal(api.geom_offset_fit_count(), 4);
  for (const h of largeHandles) api.geom_offset_fit_free(h);
  const next = api.geom_offset_fit_create(query);
  assert.ok(next > largeHandles[3]!);
  api.geom_offset_fit_free(next);
  api.geom_free(query);
  api.geom_free(output);
  assert.equal(api.geom_offset_fit_count(), 0);
  assert.equal(api.geom_offset_fit_pieces(), 0);
  assert.equal(api.geom_buffer_bytes(), 0);
  assert.ok(api.memory.buffer.byteLength <= 16 * 1024 * 1024);
});
