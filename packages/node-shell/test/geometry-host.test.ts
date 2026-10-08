// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeGeomApi } from '../../../engine/src/geom-api.ts';
import { CLIP_COUNTS } from '../../../engine/src/geom/intersect.ts';
import { geometryStageWorkflows } from '../../../tests/helpers/geometry-stage-workflows.ts';
import { GEOMETRY_REVISION, createGeometryHost, geometryBackendOf, geometrySelectionIsStrict, isGeometryBackend } from '../src/geometry-host.ts';
import { loadDefaultNodeGeometryHost, loadNodeGeometryHost } from '../src/geometry-host-node.ts';
import { loadGeometryClipping } from '../src/geometry-clipping-node.ts';
import { loadGeometryFitting } from '../src/geometry-fitting-node.ts';
import { GeometryKernelError } from '../src/geometry-kernel-contract.ts';

const paths = ['M0 0H100V100H0Z', 'M50 -10H80V150H50Z'];

test('the portable WASM host returns the TypeScript reference bits and counters without retaining buffers', async () => {
  const clipping = await loadGeometryClipping(), fitting = await loadGeometryFitting();
  const reference = makeGeomApi(), zero = Object.fromEntries(Object.keys(CLIP_COUNTS).map(key => [key, 0]));
  for (const modules of [{}, { clipping, fitting }]) {
    const host = createGeometryHost(modules);
    for (let repeat = 0; repeat < 2; repeat++) for (const row of geometryStageWorkflows()) {
      if (!row.runWithApi) continue;
      Object.assign(CLIP_COUNTS, zero); const expected = row.runWithApi(reference), counts = { ...CLIP_COUNTS };
      Object.assign(CLIP_COUNTS, zero); assert.deepEqual(row.runWithApi(host.api), expected, row.id); assert.deepEqual(CLIP_COUNTS, counts, row.id);
      for (const kernel of [clipping, fitting]) { assert.equal(kernel.stats().bufferBytes, 0); assert.equal(kernel.stats().results, 0); }
    }
    assert.equal(host.stats().calls, 16);
    if (modules.clipping) { assert.ok(host.stats().clipCalls > 0); assert.ok(host.stats().fitCalls > 0); }
    host.dispose();
  }
});

test('every boolean method uses the portable clipping kernel and matches the reference', async () => {
  const host = await loadNodeGeometryHost('wasm-portable'), reference = makeGeomApi(), zero = Object.fromEntries(Object.keys(CLIP_COUNTS).map(key => [key, 0]));
  for (const operation of ['union', 'intersect', 'difference', 'xor', 'selfUnion'] as const) {
    const before = host.stats().clipCalls;
    Object.assign(CLIP_COUNTS, zero); const expected = operation === 'selfUnion' ? reference.selfUnion(paths[0]!) : reference[operation](paths), counts = { ...CLIP_COUNTS };
    Object.assign(CLIP_COUNTS, zero); const actual = operation === 'selfUnion' ? host.api.selfUnion(paths[0]!) : host.api[operation](paths);
    assert.deepEqual(actual, expected, operation); assert.deepEqual(CLIP_COUNTS, counts, operation);
    if (operation !== 'selfUnion') assert.ok(host.stats().clipCalls > before, operation);
  }
  host.dispose();
});

test('host ownership is independent and backend identity remains outside the API', async () => {
  const first = await loadNodeGeometryHost('wasm-portable'), second = await loadNodeGeometryHost('wasm-portable');
  assert.equal(first.backend, 'wasm-portable'); assert.equal(geometryBackendOf(first.api), 'wasm-portable'); assert.equal(geometryBackendOf(makeGeomApi()), 'typescript');
  assert.equal((await loadNodeGeometryHost()).backend, 'typescript'); assert.equal(GEOMETRY_REVISION, 'geom-portable-v1');
  for (const value of ['wasm-host-curves', 'wasm-clipping', 'auto', undefined]) assert.equal(isGeometryBackend(value), false);
  assert.deepEqual(Object.keys(first.api).sort(), Object.keys(makeGeomApi()).sort());
  const expected = second.api.union(paths); assert.ok(expected.ok); assert.equal('then' in expected, false);
  first.dispose(); first.dispose(); assert.equal(first.api.union(paths).ok, false); assert.equal(first.api.stroke(paths[0]!, 4).ok, false);
  assert.deepEqual(second.api.union(paths), expected); second.dispose();
});

test('selected refusal releases ownership, returns a failure and recovers on the next call', async () => {
  const clipping = await loadGeometryClipping(), fitting = await loadGeometryFitting(); let refuse = true;
  const host = createGeometryHost({ fitting, clipping: { ...clipping, createClipWorkspace: () => {
    const workspace = clipping.createClipWorkspace(); return { ...workspace, intersect: (...args) => {
      if (refuse) throw new GeometryKernelError('limit', 'Deliberate host refusal.'); return workspace.intersect(...args);
    } };
  } } });
  assert.deepEqual(host.api.union(paths), { ok: false, code: 'limit', message: 'geom: Deliberate host refusal.' });
  assert.equal(clipping.stats().bufferBytes, 0); assert.equal(clipping.stats().results, 0);
  refuse = false; assert.deepEqual(host.api.union(paths), makeGeomApi().union(paths)); assert.equal(clipping.stats().bufferBytes, 0);
  host.dispose();
});

test('host admission remains ahead of numerical work and both portable modules are required', async () => {
  const clipping = await loadGeometryClipping(), fitting = await loadGeometryFitting(), host = createGeometryHost({ clipping, fitting });
  assert.equal(host.api.union(['garbage']).ok, false); assert.equal(host.api.offset('M0 0H10V10Z', NaN).ok, false);
  assert.equal(host.stats().clipCalls, 0); assert.equal(host.stats().fitCalls, 0);
  assert.equal(clipping.stats().bufferBytes, 0); assert.equal(fitting.stats().bufferBytes, 0);
  assert.throws(() => createGeometryHost({ fitting }), /requires both/); assert.throws(() => createGeometryHost({ clipping }), /requires both/);
  host.dispose();
});

test('the default host completes a kernel buffer refusal on the reference with the same bits and counters', async () => {
  const clipping = await loadGeometryClipping(), fitting = await loadGeometryFitting(); let refuse = true;
  const host = createGeometryHost({ fitting, clipping: { ...clipping, createClipWorkspace: () => {
    const workspace = clipping.createClipWorkspace(); return { ...workspace, intersect: (...args) => {
      if (refuse) throw new GeometryKernelError('limit', 'Deliberate buffer refusal.'); return workspace.intersect(...args);
    } };
  } } }, { strict: false });
  const zero = Object.fromEntries(Object.keys(CLIP_COUNTS).map(key => [key, 0]));
  Object.assign(CLIP_COUNTS, zero); const expected = makeGeomApi().union(paths), counts = { ...CLIP_COUNTS };
  Object.assign(CLIP_COUNTS, zero); assert.deepEqual(host.api.union(paths), expected); assert.deepEqual(CLIP_COUNTS, counts);
  assert.equal(host.stats().referenceCompletions, 1); assert.equal(clipping.stats().bufferBytes, 0);
  refuse = false; assert.deepEqual(host.api.union(paths), expected); assert.equal(host.stats().referenceCompletions, 1);
  assert.equal(geometrySelectionIsStrict(host.api), false); host.dispose();
});

test('the default Node loader selects the shared portable kernels and is not strict', async () => {
  const first = await loadDefaultNodeGeometryHost(), second = await loadDefaultNodeGeometryHost();
  assert.equal(first.loadError, undefined); assert.equal(first.backend, 'wasm-portable'); assert.equal(geometrySelectionIsStrict(first.api), false);
  const explicit = await loadNodeGeometryHost('wasm-portable'); assert.equal(geometrySelectionIsStrict(explicit.api), true);
  assert.equal(geometrySelectionIsStrict((await loadNodeGeometryHost()).api), false);
  assert.deepEqual(first.api.stroke(paths[0]!, 6, { join: 'round' }), makeGeomApi().stroke(paths[0]!, 6, { join: 'round' }));
  for (const owner of [first, second, explicit]) owner.dispose();
});
