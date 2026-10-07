// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';
import { loadNodeGeometryHost } from '../packages/node-shell/src/geometry-host-node.ts';
import { geometryBackendOf } from '../packages/node-shell/src/geometry-host.ts';
import { createNodeHookExecutor, NodeHookIsolationError } from '../packages/node-shell/src/hook-worker.ts';
import { baseHost } from './helpers/host.ts';
import { geometryHostCurve as d, geometryHostTool as tool } from './helpers/geometry-host-hooks.ts';

test('CLI constructors publish a synchronous selected API without a GPU and keep selection per host', async () => {
  const dom = { window: {} as Window & typeof globalThis };
  const reference = makeGeomApi().stroke(d, 12, { join: 'round', cap: 'round', tolerance: 0.001 });
  for (const geometryBackend of ['typescript', 'wasm-clipping', 'wasm-host-fitting', 'wasm-host-norm-clipping', 'wasm-host-norm-fitting', 'wasm-host-curves', 'wasm-host-norm-curves'] as const) {
    const host = await createCliBridge({ dom, geometryBackend, aiEnabled: false });
    assert.equal(geometryBackendOf(host.geom), geometryBackend); assert.deepEqual(host.geom!.stroke(d, 12, { join: 'round', cap: 'round', tolerance: 0.001 }), reference);
  }
  const host = await createCliBridge({ dom, aiEnabled: false }); assert.equal(geometryBackendOf(host.geom), 'typescript');
});

test('actual Node hook threads retain selected geometry results before strict lockdown', async () => {
  const expected = makeGeomApi().stroke(d, 12, { join: 'round', cap: 'round', tolerance: 0.001 });
  const source = `function onInit({host}) { const result = host.geom.stroke(${JSON.stringify(d)}, 12, {join:'round',cap:'round',tolerance:0.001}); return {note:JSON.stringify({result,fetchType:typeof fetch,env:Object.keys(process.env).length})}; }`;
  for (const backend of ['wasm-clipping', 'wasm-host-fitting', 'wasm-host-norm-clipping', 'wasm-host-norm-fitting', 'wasm-host-curves', 'wasm-host-norm-curves'] as const) for (const strict of [false, true]) {
    const owner = await loadNodeGeometryHost(backend), host: HostV1 = baseHost({ geom: owner.api, shell: 'cli', capabilities: [] });
    const runtime = await createRuntime(tool(source), host, {}, { hookExecutor: createNodeHookExecutor({ strict, allowInRealmFallback: false }) });
    try { const got = JSON.parse(runtime.getHydrated()); assert.deepEqual(got.result, expected); assert.equal(got.fetchType, strict ? 'undefined' : 'function'); assert.equal(got.env, 0); }
    finally { runtime.destroy(); owner.dispose(); }
  }
});

test('selected Node geometry fails closed if its worker cannot start even with compatibility fallback enabled', async () => {
  const owner = await loadNodeGeometryHost('wasm-clipping'), logs: string[] = [];
  const host: HostV1 = baseHost({ geom: owner.api, shell: 'cli', capabilities: [], log: (_level: string, message: string) => logs.push(message) });
  const executor = createNodeHookExecutor({ threadUrl: new URL('data:text/javascript,throw%20Error(%22Deliberate%20worker%20failure%22)') });
  try { await assert.rejects(() => executor(tool('function onInit(){return {note:"in realm"};}'), host), NodeHookIsolationError); assert.ok(!logs.some(log => log.includes('running in-realm'))); }
  finally { owner.dispose(); }
});
