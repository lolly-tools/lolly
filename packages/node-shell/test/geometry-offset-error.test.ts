// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type { Cubic } from '../../../engine/src/geom/bezier.ts';
import { offsetError } from '../../../engine/src/geom/offset-error.ts';
import { loadOffsetErrorComparison } from '../../../scripts/lib/geometry-offset-error-comparison.ts';
import { offsetErrorCases } from '../../../tests/helpers/geometry-offset-error-cases.ts';
import { type GeometryExports, GeometryKernelError } from '../src/geometry-kernel-contract.ts';
import { loadGeometryKernel } from '../src/geometry-kernel-node.ts';
import { createOffsetErrorWorkspace } from '../src/geometry-offset-error.ts';

const cases = offsetErrorCases();
const kernel = await loadGeometryKernel();
for (const row of cases)
  test(`complete verification: ${row.name}`, () => {
    const workspace = kernel.createOffsetErrorWorkspace();
    const before = structuredClone(row);
    try {
      assert.deepEqual(
        workspace.verify(row.src, row.approx, row.distance, row.tol),
        offsetError(row.src, row.approx, row.distance, row.tol)
      );
      assert.deepEqual(row, before);
    } finally {
      workspace.dispose();
    }
    assert.equal(kernel.stats().bufferBytes, 0);
  });

test('analytic verifier keeps line error, source tie order and missing-normal behavior', () => {
  const workspace = kernel.createOffsetErrorWorkspace();
  try {
    assert.deepEqual(
      workspace.verify(cases[0]!.src, cases[0]!.approx, 6, 0.01),
      offsetError(cases[0]!.src, cases[0]!.approx, 6, 0.01)
    );
    assert.deepEqual(workspace.verify(cases[1]!.src, cases[1]!.approx, 6, 0.01), {
      error: 0.12500000000000178,
      t: 1 / 24,
    });
    assert.deepEqual(workspace.verify(cases[2]!.src, cases[2]!.approx, 6, 0.001), {
      error: 0,
      t: 0.5,
    });
  } finally {
    workspace.dispose();
  }
});

test('workspace reuses equal-sized buffers, refreshes controls, resizes and owns results', () => {
  const workspace = kernel.createOffsetErrorWorkspace();
  const src = structuredClone(cases[0]!.src),
    fitted = structuredClone(cases[0]!.approx);
  const first = workspace.verify(src, fitted, 6, 0.01);
  const bytes = kernel.stats().bufferBytes;
  assert.equal(bytes, 80 + 96 + 16);
  fitted[0] = [...cases[1]!.approx[0]!];
  assert.deepEqual(workspace.verify(src, fitted, 6, 0.01), offsetError(src, fitted, 6, 0.01));
  assert.equal(kernel.stats().bufferBytes, bytes);
  assert.deepEqual(first, offsetError(cases[0]!.src, cases[0]!.approx, 6, 0.01));
  first.error = 123;
  assert.notEqual(workspace.verify(src, fitted, 6, 0.01).error, 123);
  fitted.push([...fitted[0]!]);
  workspace.verify(src, fitted, 6, 0.01);
  assert.equal(kernel.stats().bufferBytes, 80 + 2 * 96 + 16);
  workspace.dispose();
  workspace.dispose();
  assert.equal(kernel.stats().bufferBytes, 0);
  assert.throws(() => workspace.verify(src, fitted, 6, 0.01), { code: 'invalid-argument' });
  assert.throws(() => workspace.verify(src, [], 6, 0.01), { code: 'invalid-argument' });
});

test('workspace validates the complete input before changing owned buffers', () => {
  const workspace = kernel.createOffsetErrorWorkspace();
  const row = cases[0]!;
  try {
    workspace.verify(row.src, row.approx, row.distance, row.tol);
    const bytes = kernel.stats().bufferBytes;
    for (const tol of [0, -1, NaN, Infinity, 1e10])
      assert.throws(() => workspace.verify(row.src, row.approx, 6, tol), {
        code: 'invalid-argument',
      });
    for (const d of [NaN, Infinity, 1e10])
      assert.throws(() => workspace.verify(row.src, row.approx, d, 0.01), {
        code: 'invalid-argument',
      });
    const short = [...row.src] as Cubic;
    short.pop();
    assert.throws(() => workspace.verify(short, row.approx, 6, 0.01), { code: 'invalid-argument' });
    assert.throws(() => workspace.verify(row.src, [], 6, 0.01), { code: 'limit' });
    assert.throws(
      () =>
        workspace.verify(
          row.src,
          Array.from({ length: 33 }, () => row.approx[0]!),
          6,
          0.01
        ),
      { code: 'limit' }
    );
    const bad = [...row.approx[0]!] as Cubic;
    bad[7] = NaN;
    assert.throws(() => workspace.verify(row.src, [row.approx[0]!, bad], 6, 0.01), {
      code: 'invalid-argument',
    });
    assert.equal(kernel.stats().bufferBytes, bytes);
    assert.deepEqual(
      workspace.verify(row.src, row.approx, 6, 0.01),
      offsetError(cases[0]!.src, cases[0]!.approx, 6, 0.01)
    );
  } finally {
    workspace.dispose();
  }
});

const wasm = new Uint8Array(
  await readFile(new URL('../wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url))
);
async function raw() {
  assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(wasm)), []);
  const { instance } = await WebAssembly.instantiate(wasm, {});
  return instance.exports as GeometryExports;
}
test('raw verifier refuses invalid shapes, aliases and late invalid records atomically', async () => {
  const api = await raw();
  const query = api.geom_alloc(80),
    fitted = api.geom_alloc(32 * 96),
    output = api.geom_alloc(16);
  const malformed = api.geom_alloc(95),
    excessive = api.geom_alloc(33 * 96),
    shortQuery = api.geom_alloc(72);
  const view = new DataView(api.memory.buffer);
  [...cases[0]!.src, 6, 0.01].forEach((x, i) => {
    view.setFloat64(query + i * 8, x, true);
  });
  for (let i = 0; i < 32; i++)
    [...cases[0]!.approx[0]!, 0, 6, 30, 6].forEach((x, j) => {
      view.setFloat64(fitted + i * 96 + j * 8, x, true);
    });
  const before = new Uint8Array(api.memory.buffer, query, 80).slice();
  function refused(q: number, f: number, o: number, code: number) {
    new Uint8Array(api.memory.buffer, output, 16).fill(0xa5);
    assert.equal(api.geom_offset_error(q, f, o), code);
    assert.deepEqual(new Uint8Array(api.memory.buffer, output, 16), new Uint8Array(16).fill(0xa5));
  }
  for (const [q, f, o, code] of [
    [0, fitted, output, 1],
    [query + 1, fitted, output, 1],
    [query, fitted, output + 1, 1],
    [query, query, output, 1],
    [query, fitted, query, 1],
    [query, fitted, fitted, 1],
    [shortQuery, fitted, output, 2],
    [query, malformed, output, 2],
    [query, excessive, output, 3],
  ])
    refused(q!, f!, o!, code!);
  for (const bad of [NaN, Infinity, 1e10]) {
    view.setFloat64(query, bad, true);
    refused(query, fitted, output, 2);
  }
  view.setFloat64(query, cases[0]!.src[0], true);
  for (const bad of [0, -1, NaN, Infinity, 1e10]) {
    view.setFloat64(query + 72, bad, true);
    refused(query, fitted, output, 2);
  }
  view.setFloat64(query + 72, 0.01, true);
  view.setFloat64(fitted + 31 * 96 + 56, NaN, true);
  refused(query, fitted, output, 2);
  view.setFloat64(fitted + 31 * 96 + 56, 6, true);
  view.setFloat64(fitted + 31 * 96 + 64, 31, true);
  refused(query, fitted, output, 2);
  view.setFloat64(fitted + 31 * 96 + 64, 0, true);
  assert.equal(api.geom_offset_error(query, fitted, output), 0);
  assert.deepEqual(
    [view.getFloat64(output, true), view.getFloat64(output + 8, true)],
    Object.values(offsetError(cases[0]!.src, cases[0]!.approx, 6, 0.01))
  );
  assert.deepEqual(new Uint8Array(api.memory.buffer, query, 80), before);
  api.geom_free(fitted);
  refused(query, fitted, output, 1);
  for (const p of [query, output, malformed, excessive, shortQuery]) api.geom_free(p);
  assert.equal(api.geom_buffer_bytes(), 0);
  assert.ok(api.memory.buffer.byteLength <= 16 * 1024 * 1024);
});

test('partial workspace allocations clean up and recover under count and aggregate-byte exhaustion', async () => {
  for (const exhaustion of ['count', 'bytes']) {
    const api = await raw();
    const held =
      exhaustion === 'count'
        ? Array.from({ length: 30 }, () => api.geom_alloc(8))
        : [api.geom_alloc(2 * 1024 * 1024), api.geom_alloc(2 * 1024 * 1024 - 128)];
    assert.ok(held.every(Boolean));
    const bytes = api.geom_buffer_bytes();
    const workspace = createOffsetErrorWorkspace(api),
      row = cases[0]!;
    assert.throws(() => workspace.verify(row.src, row.approx, 6, 0.01), GeometryKernelError);
    assert.equal(api.geom_buffer_bytes(), bytes);
    for (const p of held) api.geom_free(p);
    assert.deepEqual(
      workspace.verify(row.src, row.approx, 6, 0.01),
      offsetError(row.src, row.approx, 6, 0.01)
    );
    workspace.dispose();
    assert.equal(api.geom_buffer_bytes(), 0);
  }
});

test('complete SVG workflows retain exact results and clipping counters with the verifier substituted', async () => {
  const { module } = await loadOffsetErrorComparison();
  let calls = 0;
  for (const row of module.geometryStageWorkflows()) {
    module.setOffsetErrorProbe(undefined);
    const before = { ...module.CLIP_COUNTS },
      expected = row.run();
    const counts = Object.fromEntries(
      ['pairs', 'nodes', 'overruns', 'overrunNodes', 'ceilings'].map((key) => [
        key,
        module.CLIP_COUNTS[key as keyof typeof before] - before[key as keyof typeof before],
      ])
    );
    const workspace = kernel.createOffsetErrorWorkspace();
    const start = { ...module.CLIP_COUNTS };
    try {
      module.setOffsetErrorProbe((...args) => {
        calls++;
        return workspace.verify(...args);
      });
      assert.deepEqual(row.run(), expected, row.id);
      assert.deepEqual(
        Object.fromEntries(
          ['pairs', 'nodes', 'overruns', 'overrunNodes', 'ceilings'].map((key) => [
            key,
            module.CLIP_COUNTS[key as keyof typeof start] - start[key as keyof typeof start],
          ])
        ),
        counts,
        row.id
      );
    } finally {
      module.setOffsetErrorProbe(undefined);
      workspace.dispose();
    }
    assert.equal(kernel.stats().bufferBytes, 0);
  }
  assert.ok(calls > 100);
});
