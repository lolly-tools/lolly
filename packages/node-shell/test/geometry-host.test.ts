// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { makeGeomApi } from '../../../engine/src/geom-api.ts';
import { CLIP_COUNTS } from '../../../engine/src/geom/intersect.ts';
import { geometryStageWorkflows } from '../../../tests/helpers/geometry-stage-workflows.ts';
import { createGeometryHost, geometryBackendOf } from '../src/geometry-host.ts';
import { loadGeometryClipping as loadClipping } from '../src/geometry-clipping-node.ts';
import { loadGeometryFitting as loadFitting } from '../src/geometry-fitting-node.ts';
import { GeometryKernelError } from '../src/geometry-kernel-contract.ts';

for (const mathBackend of ['retained', 'host-norm'] as const) {
const test = (name: string, fn: () => void | Promise<void>) => nodeTest(`${mathBackend}: ${name}`, fn);
const loadGeometryClipping = () => loadClipping(mathBackend);
const loadGeometryFitting = (math: 'host' | 'portable' = 'host') => loadFitting(math === 'host' && mathBackend === 'host-norm' ? 'host-norm' : math);
test('long-lived host calls retain complete local results and counters without retaining buffers', async () => {
  const clipping = await loadGeometryClipping(), fitting = await loadGeometryFitting();
  const reference = makeGeomApi(), zero = Object.fromEntries(Object.keys(CLIP_COUNTS).map(key => [key, 0]));
  for (const modules of [{}, { clipping }, { clipping, fitting }]) {
    const host = createGeometryHost(modules);
    for (let repeat = 0; repeat < 2; repeat++) for (const row of geometryStageWorkflows()) {
      if (!row.runWithApi) continue;
      Object.assign(CLIP_COUNTS, zero); const expected = row.runWithApi(reference), counts = { ...CLIP_COUNTS };
      Object.assign(CLIP_COUNTS, zero); assert.deepEqual(row.runWithApi(host.api), expected, row.id); assert.deepEqual(CLIP_COUNTS, counts, row.id);
      for (const kernel of [clipping, fitting]) { assert.equal(kernel.stats().bufferBytes, 0); assert.equal(kernel.stats().results, 0); }
    }
    assert.equal(host.stats().calls, 16);
    if (modules.clipping) assert.ok(host.stats().clipCalls > 0);
    if (modules.fitting) assert.ok(host.stats().fitCalls > 0);
    host.dispose();
  }
});

test('host ownership is independent and backend identity remains outside the API', async () => {
  const clipping = await loadGeometryClipping(), first = createGeometryHost({ clipping }), second = createGeometryHost({ clipping });
  const paths = ['M0 0H100V100H0Z', 'M50 -10H80V150H50Z'];
  assert.equal(geometryBackendOf(first.api), mathBackend === 'host-norm' ? 'wasm-host-norm-clipping' : 'wasm-clipping'); assert.equal(geometryBackendOf(makeGeomApi()), 'typescript');
  assert.deepEqual(Object.keys(first.api).sort(), Object.keys(makeGeomApi()).sort());
  const expected = second.api.union(paths); assert.ok(expected.ok); assert.equal('then' in expected, false);
  first.dispose(); first.dispose(); assert.equal(first.api.union(paths).ok, false);
  assert.deepEqual(second.api.union(paths), expected); assert.equal(clipping.stats().bufferBytes, 0); second.dispose();
});

test('selected refusal releases ownership, returns a failure and recovers on the next call', async () => {
  const clipping = await loadGeometryClipping(); let refuse = true;
  const host = createGeometryHost({ clipping: { ...clipping, createClipWorkspace: () => {
    const workspace = clipping.createClipWorkspace(); return { ...workspace, intersect: (...args) => {
      if (refuse) throw new GeometryKernelError('limit', 'Deliberate host refusal.'); return workspace.intersect(...args);
    } };
  } } });
  const paths = ['M0 0H100V100H0Z', 'M50 -10H80V150H50Z'];
  assert.deepEqual(host.api.union(paths), { ok: false, code: 'limit', message: 'geom: Deliberate host refusal.' });
  assert.equal(clipping.stats().bufferBytes, 0); assert.equal(clipping.stats().results, 0);
  refuse = false; assert.deepEqual(host.api.union(paths), makeGeomApi().union(paths)); assert.equal(clipping.stats().bufferBytes, 0);
  host.dispose();
});

test('host admission remains ahead of numerical work and fitting cannot be selected without clipping', async () => {
  const clipping = await loadGeometryClipping(), fitting = await loadGeometryFitting(), host = createGeometryHost({ clipping, fitting });
  assert.equal(host.api.union(['garbage']).ok, false); assert.equal(host.api.offset('M0 0H10V10Z', NaN).ok, false);
  assert.equal(host.stats().clipCalls, 0); assert.equal(host.stats().fitCalls, 0);
  assert.equal(clipping.stats().bufferBytes, 0); assert.equal(fitting.stats().bufferBytes, 0);
  assert.throws(() => createGeometryHost({ fitting }), /requires the clipping/); host.dispose();
  const portable = await loadGeometryFitting('portable');
  assert.throws(() => createGeometryHost({ clipping, fitting: portable }), /requires host maths/);
});

}
