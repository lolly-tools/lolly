// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test as nodeTest } from 'node:test';
import type { Cubic } from '../../../engine/src/geom/bezier.ts';
import { loadOffsetFitComparison } from '../../../scripts/lib/geometry-offset-fit-comparison.ts';
import { createOffsetFitBackend } from '../../../tests/helpers/geometry-offset-fit-backend.ts';
import {
  offsetFitCases,
  seededOffsetFitCases,
} from '../../../tests/helpers/geometry-offset-fit-cases.ts';
import {
  createGeometryFitting,
  createOffsetFitWorkspace,
  type GeometryFittingExports,
} from '../src/geometry-fitting.ts';
import { loadGeometryFitting as loadFitting } from '../src/geometry-fitting-node.ts';
import { GeometryKernelError } from '../src/geometry-kernel-contract.ts';

const { module } = await loadOffsetFitComparison();
for (const mathBackend of ['host', 'host-norm'] as const) {
const test = (name: string, fn: () => void | Promise<void>) => nodeTest(`${mathBackend}: ${name}`, fn);
const kernel = await loadFitting(mathBackend);
const cases = offsetFitCases();
function released() {
  assert.equal(kernel.stats().bufferBytes, 0);
  assert.equal(kernel.stats().results, 0);
  assert.equal(kernel.stats().pieces, 0);
}
for (const row of cases)
  test(`complete adaptive fitting: ${row.name}`, () => {
    const before = structuredClone(row),
      workspace = kernel.createOffsetFitWorkspace();
    try {
      assert.deepEqual(
        workspace.fit(row.src, row.distance, row.tol),
        module.offsetPieces(row.src, row.distance, row.tol)
      );
      assert.deepEqual(row, before);
    } finally {
      workspace.dispose();
    }
    released();
  });
test('seeded source controls preserve complete fitting and direction decisions', () => {
  const workspace = kernel.createOffsetFitWorkspace();
  try {
    for (const row of seededOffsetFitCases())
      assert.deepEqual(
        workspace.fit(row.src, row.distance, row.tol),
        module.offsetPieces(row.src, row.distance, row.tol),
        row.name
      );
  } finally {
    workspace.dispose();
  }
  released();
});
test('owned workspace refreshes equal-sized input, resizes, returns independent values and disposes', () => {
  const workspace = kernel.createOffsetFitWorkspace();
  const src = [...cases[0]!.src] as Cubic;
  const first = workspace.fit(src, 6, 0.01);
  assert.equal(kernel.stats().bufferBytes, 192);
  src[7] = 1;
  const expected = module.offsetPieces(src, -6, 0.01);
  assert.deepEqual(workspace.fit(src, -6, 0.01), expected);
  assert.deepEqual(first, module.offsetPieces(cases[0]!.src, 6, 0.01));
  first[0]!.curve[0] = 123;
  first[0]!.dirStart!.x = 123;
  assert.deepEqual(workspace.fit(src, -6, 0.01), expected);
  const smooth = cases.find((c) => c.name === 'smooth/20/0.001')!;
  const fitted = workspace.fit(smooth.src, smooth.distance, smooth.tol);
  assert.equal(kernel.stats().bufferBytes, 80 + fitted.length * 112);
  assert.deepEqual(workspace.fit([1, 1, 1, 1, 1, 1, 1, 1], 6, 0.01), []);
  assert.equal(kernel.stats().results, 0);
  workspace.dispose();
  workspace.dispose();
  released();
  assert.throws(() => workspace.fit(src, 6, 0.01), { code: 'invalid-argument' });
});
test('complete admission rejects invalid input before changing workspace ownership', () => {
  const workspace = kernel.createOffsetFitWorkspace(),
    src = cases[0]!.src;
  try {
    workspace.fit(src, 6, 0.01);
    const bytes = kernel.stats().bufferBytes;
    for (const tol of [0, -1, NaN, Infinity, 1e10])
      assert.throws(() => workspace.fit(src, 6, tol), { code: 'invalid-argument' });
    for (const d of [NaN, Infinity, 1e10])
      assert.throws(() => workspace.fit(src, d, 0.01), { code: 'invalid-argument' });
    const bad = [...src] as Cubic;
    bad[7] = NaN;
    assert.throws(() => workspace.fit(bad, 6, 0.01), { code: 'invalid-argument' });
    bad.pop();
    assert.throws(() => workspace.fit(bad, 6, 0.01), { code: 'invalid-argument' });
    assert.equal(kernel.stats().bufferBytes, bytes);
    assert.equal(kernel.stats().results, 0);
  } finally {
    workspace.dispose();
  }
  released();
});

const wasm = new Uint8Array(
  await readFile(new URL(`../wasm/geometry-kernel/geometry-fit${mathBackend === 'host-norm' ? '-host-norm' : ''}.wasm`, import.meta.url))
);
async function raw() {
  const imports = WebAssembly.Module.imports(new WebAssembly.Module(wasm));
  assert.deepEqual(
    imports.map((r) => `${r.module}.${r.name}`).sort(),
    ['acos', 'atan2', 'cbrt', 'cos', 'sin', ...(mathBackend === 'host-norm' ? ['hypot'] : [])].map((n) => `lolly_math.${n}`).sort()
  );
  const { instance } = await WebAssembly.instantiate(wasm, {
    lolly_math: {
      sin: Math.sin,
      cos: Math.cos,
      acos: Math.acos,
      atan2: Math.atan2,
      cbrt: Math.cbrt,
      hypot: Math.hypot,
    },
  });
  return instance.exports as GeometryFittingExports;
}
test('loader rejects the geometry module without the fitting maths and ABI', async () => {
  const bytes = await readFile(
    new URL('../wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url)
  );
  await assert.rejects(() => createGeometryFitting(bytes), { code: 'internal' });
});
test('raw operation validates late fields, owns monotonic handles and refuses malformed delivery atomically', async () => {
  const api = await raw(),
    query = api.geom_alloc(80),
    output = api.geom_alloc(112),
    short = api.geom_alloc(79);
  const write = (q: number[]) =>
    q.forEach((v, i) => {
      new DataView(api.memory.buffer).setFloat64(query + i * 8, v, true);
    });
  const q = [...cases[0]!.src, 6, 0.01];
  write(q);
  assert.equal(api.geom_offset_fit_create(0), -1);
  assert.equal(api.geom_offset_fit_create(query + 1), -1);
  assert.equal(api.geom_offset_fit_create(short), -1);
  for (const [index, value] of [
    [7, NaN],
    [8, Infinity],
    [9, 0],
    [9, -1],
    [9, 1e10],
  ]) {
    write(q.map((v, i) => (i === index ? value! : v)));
    assert.equal(api.geom_offset_fit_create(query), -1);
    assert.equal(api.geom_offset_fit_count(), 0);
  }
  write(q);
  const handles = Array.from({ length: 8 }, () => api.geom_offset_fit_create(query));
  assert.ok(handles.every((h) => h > 0));
  assert.equal(api.geom_offset_fit_create(query), -2);
  assert.equal(api.geom_offset_fit_pieces(), 8);
  const id = handles[0]!;
  assert.equal(api.geom_offset_fit_len(id), 1);
  new Uint8Array(api.memory.buffer, output, 112).fill(0xa5);
  assert.equal(api.geom_offset_fit_read(id, output + 1), 1);
  assert.equal(api.geom_offset_fit_read(id, query), 2);
  assert.equal(api.geom_offset_fit_read(-1, output), 1);
  assert.deepEqual(new Uint8Array(api.memory.buffer, output, 112), new Uint8Array(112).fill(0xa5));
  assert.equal(api.geom_offset_fit_read(id, output), 0);
  const result = new Float64Array(api.memory.buffer, output, 14).slice();
  assert.deepEqual(
    Array.from(result.slice(0, 8)),
    module.offsetPieces(cases[0]!.src, 6, 0.01)[0]!.curve
  );
  assert.deepEqual(Array.from(result.slice(8)), [1, 1, 0, 1, 1, 0]);
  for (const h of handles) api.geom_offset_fit_free(h);
  assert.equal(api.geom_offset_fit_len(id), -1);
  assert.equal(api.geom_offset_fit_read(id, output), 1);
  const next = api.geom_offset_fit_create(query);
  assert.ok(next > handles[7]!);
  api.geom_offset_fit_free(next);
  api.geom_offset_fit_free(next);
  assert.equal(api.geom_offset_fit_count(), 0);
  assert.equal(api.geom_offset_fit_pieces(), 0);
  for (const p of [query, output, short]) api.geom_free(p);
  assert.equal(api.geom_buffer_bytes(), 0);
  assert.throws(() => api.memory.grow(257), RangeError);
});
test('allocation failures release new buffers and result handles, then the workspace recovers', async () => {
  for (const exhaustion of ['count', 'bytes', 'handles']) {
    const api = await raw();
    const held =
      exhaustion === 'count'
        ? Array.from({ length: 31 }, () => api.geom_alloc(8))
        : exhaustion === 'bytes'
          ? [api.geom_alloc(2 * 1024 * 1024), api.geom_alloc(2 * 1024 * 1024 - 128)]
          : [];
    const query = exhaustion === 'handles' ? api.geom_alloc(80) : 0;
    if (query)
      [...cases[0]!.src, 6, 0.01].forEach((v, i) => {
        new DataView(api.memory.buffer).setFloat64(query + i * 8, v, true);
      });
    const handles = query ? Array.from({ length: 8 }, () => api.geom_offset_fit_create(query)) : [];
    const bytes = api.geom_buffer_bytes();
    const workspace = createOffsetFitWorkspace(api);
    assert.throws(() => workspace.fit(cases[0]!.src, 6, 0.01), GeometryKernelError);
    assert.equal(api.geom_buffer_bytes(), bytes);
    assert.equal(api.geom_offset_fit_count(), handles.length);
    for (const p of held) api.geom_free(p);
    for (const h of handles) api.geom_offset_fit_free(h);
    api.geom_free(query);
    assert.deepEqual(
      workspace.fit(cases[0]!.src, 6, 0.01),
      module.offsetPieces(cases[0]!.src, 6, 0.01)
    );
    workspace.dispose();
    assert.equal(api.geom_buffer_bytes(), 0);
    assert.equal(api.geom_offset_fit_count(), 0);
  }
});
test('resident-piece ceiling refuses a whole result and recovers without stale ownership', async () => {
  const api = await raw(),
    query = api.geom_alloc(80);
  const row = cases.find((c) => c.name === 'large-position')!;
  [...row.src, row.distance, row.tol].forEach((v, i) => {
    new DataView(api.memory.buffer).setFloat64(query + i * 8, v, true);
  });
  const handles = Array.from({ length: 4 }, () => api.geom_offset_fit_create(query));
  assert.ok(handles.every((h) => h > 0));
  assert.ok(handles.every((h) => api.geom_offset_fit_len(h) === 8192));
  assert.equal(api.geom_offset_fit_pieces(), 32768);
  assert.equal(api.geom_offset_fit_create(query), -2);
  assert.equal(api.geom_offset_fit_count(), 4);
  assert.equal(api.geom_offset_fit_pieces(), 32768);
  for (const h of handles) api.geom_offset_fit_free(h);
  const next = api.geom_offset_fit_create(query);
  assert.ok(next > handles[3]!);
  api.geom_offset_fit_free(next);
  api.geom_free(query);
  assert.equal(api.geom_offset_fit_count(), 0);
  assert.equal(api.geom_offset_fit_pieces(), 0);
  assert.equal(api.geom_buffer_bytes(), 0);
  assert.ok(api.memory.buffer.byteLength <= 16 * 1024 * 1024);
});

test('complete SVG operations preserve output and all clipping counters', () => {
  let calls = 0;
  const counters = () => ({ ...module.CLIP_COUNTS });
  const delta = (before: ReturnType<typeof counters>) =>
    Object.fromEntries(
      ['pairs', 'nodes', 'overruns', 'overrunNodes', 'ceilings'].map((key) => [
        key,
        module.CLIP_COUNTS[key as keyof typeof before] - before[key as keyof typeof before],
      ])
    );
  for (const row of module.geometryStageWorkflows()) {
    module.setOffsetFitProbe(undefined);
    const before = counters(),
      expected = row.run(),
      counts = delta(before);
    const absolute = {
      lastNodes: module.CLIP_COUNTS.lastNodes,
      maxOverrunNodes: module.CLIP_COUNTS.maxOverrunNodes,
    };
    const backend = createOffsetFitBackend(kernel),
      start = counters();
    try {
      module.setOffsetFitProbe(backend.fit);
      assert.deepEqual(row.run(), expected, row.id);
      assert.deepEqual(delta(start), counts, row.id);
      assert.deepEqual(
        {
          lastNodes: module.CLIP_COUNTS.lastNodes,
          maxOverrunNodes: module.CLIP_COUNTS.maxOverrunNodes,
        },
        absolute,
        row.id
      );
      calls += backend.stats().calls;
    } finally {
      module.setOffsetFitProbe(undefined);
      backend.dispose();
    }
    released();
  }
  assert.ok(calls > 100);
});

}
