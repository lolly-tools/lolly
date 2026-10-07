// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test as nodeTest } from 'node:test';
import { loadClipComparison } from '../../../scripts/lib/geometry-clip-comparison.ts';
import {
  canonicalClipCases,
  clipCases,
  clipWire,
  seededClipCases,
} from '../../../tests/helpers/geometry-clip-cases.ts';
import {
  createClipWorkspace,
  createGeometryClipping,
  GEOMETRY_CLIP_LIMITS,
  type GeometryClippingExports,
} from '../src/geometry-clipping.ts';
import { loadGeometryClipping as loadClipping } from '../src/geometry-clipping-node.ts';
import { loadGeometryFitting as loadFitting } from '../src/geometry-fitting-node.ts';
for (const mathBackend of ['retained', 'host-norm'] as const) {
const test = (name: string, fn: () => void | Promise<void>) => nodeTest(`${mathBackend}: ${name}`, fn);
const loadGeometryClipping = () => loadClipping(mathBackend);
const loadGeometryFitting = (math: 'host' | 'portable' = 'host') => loadFitting(math === 'host' && mathBackend === 'host-norm' ? 'host-norm' : math);
const bytes = await readFile(
  new URL(`../wasm/geometry-kernel/geometry-clip${mathBackend === 'host-norm' ? '-host-norm' : ''}.wasm`, import.meta.url)
);
test('clipping rejects unexpected imports and incomplete modules', async () => {
  const host = await readFile(
    new URL('../wasm/geometry-kernel/geometry-fit.wasm', import.meta.url)
  );
  const base = await readFile(
    new URL('../wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url)
  );
  await assert.rejects(() => createGeometryClipping(host, mathBackend), { code: 'internal' });
  await assert.rejects(() => createGeometryClipping(base, mathBackend), { code: 'internal' });
  assert.deepEqual(WebAssembly.Module.imports(await WebAssembly.compile(bytes)), mathBackend === 'host-norm' ? [{ module: 'lolly_math', name: 'hypot', kind: 'function' }] : []);
});
test('complete clipping preserves contact bits and every work counter on immutable requests and workflows', async () => {
  const kernel = await loadGeometryClipping(),
    { module } = await loadClipComparison();
  const fitting = await loadGeometryFitting('portable');
  const inputs = [...clipCases(), ...seededClipCases(), ...canonicalClipCases(fitting)].map(
      clipWire
    ),
    original = structuredClone(inputs);
  const result = module.qualifyClipping(kernel, inputs);
  for (const row of [...result.cases, ...result.workflows]) {
    assert.deepEqual(row.actual, row.reference, row.name);
    assert.deepEqual(row.actualCounts, row.referenceCounts, row.name);
  }
  assert.deepEqual(inputs, original);
  assert.ok(result.cases.some((r) => r.actualCounts.ceilings > 2));
  assert.ok(
    result.cases.some((r) => r.actualCounts.overruns > 3 && r.actualCounts.lastOverrunNodes === 19)
  );
  assert.deepEqual(kernel.stats(), result.afterDispose);
  assert.equal(result.afterDispose.results, 0);
  assert.equal(result.afterDispose.hits, 0);
  assert.equal(result.afterDispose.bufferBytes, 0);
  assert.ok(result.afterDispose.linearBytes <= 16 * 1024 * 1024);
  assert.equal(fitting.stats().results, 0);
  assert.equal(fitting.stats().pieces, 0);
  assert.equal(fitting.stats().bufferBytes, 0);
});
test('clipping result and buffer exhaustion refuse atomically and recover with fresh owned records', async () => {
  const api = (await WebAssembly.instantiate(await WebAssembly.compile(bytes), mathBackend === 'host-norm' ? { lolly_math: { hypot: Math.hypot } } : {}))
    .exports as GeometryClippingExports;
  const row = clipCases().find((r) => r.name === 'nonuniform-line-curve/0')!;
  const query = api.geom_alloc(160),
    bad = api.geom_alloc(7);
  const write = (values: number[]) =>
    values.forEach((v, i) => {
      new DataView(api.memory.buffer).setFloat64(query + i * 8, v, true);
    });
  const values = [
    ...row.a,
    ...row.b,
    row.tol,
    GEOMETRY_CLIP_LIMITS.initial,
    GEOMETRY_CLIP_LIMITS.overrun,
    GEOMETRY_CLIP_LIMITS.stalled,
  ];
  write(values);
  const ids = Array.from({ length: 8 }, () => api.geom_clip_create(query));
  assert.ok(ids.every((id) => id > 0));
  assert.equal(api.geom_clip_create(query), -2);
  const sentinel = new Uint8Array(7).fill(0xa5);
  new Uint8Array(api.memory.buffer, bad, 7).set(sentinel);
  assert.equal(api.geom_clip_read(ids[0]!, bad), 2);
  assert.equal(api.geom_clip_read(ids[0]!, bad + 1), 1);
  assert.deepEqual(new Uint8Array(api.memory.buffer, bad, 7), sentinel);
  const workspace = createClipWorkspace(api);
  assert.throws(() => workspace.intersect(row.a, row.b, row.tol), { code: 'limit' });
  assert.equal(api.geom_buffer_bytes(), 167);
  for (const id of ids) {
    api.geom_clip_free(id);
    api.geom_clip_free(id);
  }
  assert.equal(api.geom_clip_len(ids[0]!), -1);
  assert.equal(api.geom_clip_read(ids[0]!, bad), 1);
  assert.equal(api.geom_clip_count(), 0);
  assert.equal(api.geom_clip_hits(), 0);
  for (const [i, v] of [
    [0, NaN],
    [16, 0],
    [17, -1],
    [17, 0.5],
    [17, 10_000_001],
    [18, 262_145],
    [19, 65_537],
  ]) {
    const invalid = [...values];
    invalid[i!] = v!;
    write(invalid);
    assert.equal(api.geom_clip_create(query), -1);
  }
  assert.equal(api.geom_clip_create(bad), -1);
  const answer = workspace.intersect(row.a, row.b, row.tol);
  assert.ok(answer.hits.length > 0);
  const frozen = structuredClone(answer);
  workspace.intersect(row.b, row.a, row.tol);
  assert.deepEqual(answer, frozen);
  workspace.dispose();
  workspace.dispose();
  assert.throws(() => workspace.intersect(row.a, row.b, row.tol), { code: 'invalid-argument' });
  const buffers = Array.from({ length: 30 }, () => api.geom_alloc(1));
  assert.ok(buffers.every(Boolean));
  const recovery = createClipWorkspace(api);
  assert.throws(() => recovery.intersect(row.a, row.b, row.tol), { code: 'limit' });
  assert.equal(api.geom_buffer_bytes(), 197);
  for (const p of buffers) api.geom_free(p);
  const outputBlockers = Array.from({ length: 29 }, () => api.geom_alloc(1));
  assert.ok(outputBlockers.every(Boolean));
  assert.throws(() => recovery.intersect(row.a, row.b, row.tol), { code: 'limit' });
  assert.equal(api.geom_buffer_bytes(), 196);
  assert.equal(api.geom_clip_count(), 0);
  assert.equal(api.geom_clip_hits(), 0);
  for (const p of outputBlockers) api.geom_free(p);
  assert.deepEqual(recovery.intersect(row.a, row.b, row.tol), frozen);
  recovery.dispose();
  write(values);
  const next = api.geom_clip_create(query);
  assert.ok(next > ids[7]!);
  api.geom_clip_free(next);
  api.geom_free(query);
  api.geom_free(bad);
  assert.equal(api.geom_buffer_bytes(), 0);
  assert.equal(api.geom_clip_count(), 0);
  assert.equal(api.geom_clip_hits(), 0);
});

}
