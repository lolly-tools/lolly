// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { makeGeomApi } from '../../../engine/src/geom-api.ts';
import { CLIP_COUNTS } from '../../../engine/src/geom/intersect.ts';
import { geometryHostCurve } from '../../../tests/helpers/geometry-host-hooks.ts';
import { createGeometryHost, geometryBackendForTarget, geometryBackendModules, geometryBackendOf } from '../src/geometry-host.ts';
import { loadNodeGeometryHost } from '../src/geometry-host-node.ts';
import { loadGeometryClipping } from '../src/geometry-clipping-node.ts';
import { loadGeometryFitting } from '../src/geometry-fitting-node.ts';
import { GeometryKernelError } from '../src/geometry-kernel-contract.ts';

test('qualified target policy is explicit and unknown environments stay TypeScript', () => {
  for (const target of ['node-v8', 'chromium']) assert.equal(geometryBackendForTarget(target), 'wasm-host-curves');
  for (const target of ['firefox', 'webkit', 'tauri-macos']) assert.equal(geometryBackendForTarget(target), 'wasm-host-norm-curves');
  for (const target of [undefined, null, 'tauri-ios', 'tauri-linux', 'tauri-windows', 'safari', '', {}, { userAgent: 'Chrome' }]) assert.equal(geometryBackendForTarget(target), 'typescript');
  assert.equal(geometryBackendOf(makeGeomApi()), 'typescript');
  assert.throws(() => geometryBackendModules('auto' as never), /Unknown/);
  assert.throws(() => createGeometryHost({}, 'curves'), /requires matching/);
  assert.throws(() => createGeometryHost({}, 'unknown' as never), /Unknown/);
});

for (const backend of ['wasm-host-curves', 'wasm-host-norm-curves'] as const) test(`${backend}: boolean dispatch stays on TypeScript while curves own matching WASM`, async () => {
  const host = await loadNodeGeometryHost(backend), reference = makeGeomApi(), zero = Object.fromEntries(Object.keys(CLIP_COUNTS).map(key => [key, 0]));
  const paths = ['M0 0H100V100H0Z', 'M50 -10H80V150H50Z'];
  const before = host.stats();
  for (const operation of ['union', 'intersect', 'difference', 'xor', 'selfUnion'] as const) {
    Object.assign(CLIP_COUNTS, zero); const expected = operation === 'selfUnion' ? reference.selfUnion(paths[0]!) : reference[operation](paths), counts = { ...CLIP_COUNTS };
    Object.assign(CLIP_COUNTS, zero); const actual = operation === 'selfUnion' ? host.api.selfUnion(paths[0]!) : host.api[operation](paths);
    assert.deepEqual(actual, expected); assert.deepEqual(CLIP_COUNTS, counts);
  }
  const booleans = host.stats(); assert.equal(booleans.typeScriptCalls, 5); assert.equal(booleans.clipCalls, 0); assert.equal(booleans.fitCalls, 0);
  assert.deepEqual(booleans.clipping, before.clipping); assert.deepEqual(booleans.fitting, before.fitting);
  assert.deepEqual(host.api.stroke(geometryHostCurve, 12, { join: 'round', cap: 'round', tolerance: 0.001 }), reference.stroke(geometryHostCurve, 12, { join: 'round', cap: 'round', tolerance: 0.001 }));
  const after = host.stats(); assert.ok(after.clipCalls > 0); assert.ok(after.fitCalls > 0); assert.equal(after.typeScriptCalls, 5);
  for (const module of [after.clipping!, after.fitting!]) { assert.equal(module.results, 0); assert.equal(module.bufferBytes, 0); }
  assert.equal(host.backend, backend); assert.equal(geometryBackendOf(host.api), backend); assert.equal(after.operations, 'curves');
  assert.deepEqual(Object.keys(host.api).sort(), Object.keys(reference).sort());
  host.dispose(); assert.equal(host.api.union(paths).ok, false); assert.equal(host.api.stroke(geometryHostCurve, 12).ok, false);
});

test('curve policy exposes numerical refusal without changing the boolean choice or retrying', async () => {
  const clipping = await loadGeometryClipping(), fitting = await loadGeometryFitting('host'); let calls = 0;
  const host = createGeometryHost({ fitting, clipping: { ...clipping, createClipWorkspace: () => { const workspace = clipping.createClipWorkspace(); return { ...workspace, intersect: () => { calls++; throw new GeometryKernelError('limit', 'Policy refusal.'); } }; } } }, 'curves');
  const paths = ['M0 0H100V100H0Z', 'M50 -10H80V150H50Z'];
  assert.deepEqual(host.api.union(paths), makeGeomApi().union(paths)); assert.equal(calls, 0);
  assert.deepEqual(host.api.stroke(geometryHostCurve, 12), { ok: false, code: 'limit', message: 'geom: Policy refusal.' }); assert.equal(calls, 1);
  assert.equal(clipping.stats().bufferBytes, 0); assert.equal(fitting.stats().bufferBytes, 0); host.dispose();
});
