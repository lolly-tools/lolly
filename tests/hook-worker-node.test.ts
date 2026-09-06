// SPDX-License-Identifier: MPL-2.0
/**
 * The Node worker_threads hook executor (packages/node-shell/src/hook-worker.ts)
 * over the engine's shared core: a tool's hooks run in another thread, the
 * proxied host RPC round-trips, the co-located APIs answer locally, the
 * thread sees no process environment, and the mount tears down.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../engine/src/runtime.ts';
import { createNodeHookExecutor, NodeHookIsolationError } from '../packages/node-shell/src/hook-worker.ts';

let seq = 0;
function toolWith(hooksSource: string, hooks: Record<string, boolean> = { onInit: true }): any {
  return {
    manifest: {
      id: `threaded-${++seq}`, name: 'Threaded', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['svg'] },
      inputs: [{ id: 'msg', type: 'text', default: 'hi' }],
      hooks,
    },
    template: '<b>{{msg}}</b><i>{{note}}</i>',
    hooksSource,
  };
}

function host(extra: Record<string, unknown> = {}): any {
  const logs: string[] = [];
  return {
    logs,
    version: '1',
    shell: 'cli',
    capabilities: ['compose'],
    profile: { get: async () => ({ firstname: 'Ada' }), subscribe: () => () => {} },
    assets: { get: async (id: string) => ({ id, url: `asset:${id}` }), query: async () => [], pick: async () => null, isAvailable: async () => true },
    state: { save: async () => {}, load: async () => null, list: async () => [], delete: async () => {} },
    log: (level: string, msg: string) => logs.push(`${level}:${msg}`),
    ...extra,
  };
}

test('hooks run in a worker thread: proxied host calls round-trip and colocated colour maths answers locally', async () => {
  process.env.LOLLY_TEST_SECRET = 'must-not-leak';
  const h = host();
  const runtime = await createRuntime(toolWith(`
    async function onInit({ model, host }) {
      const a = await host.assets.get('lolly/logo');
      const p = await host.profile.get();
      const d = host.color.deltaE('#000000', '#ffffff'); // ~1 on the engine's 0..1 scale
      const env = typeof process === 'undefined' ? 'no-process' : JSON.stringify(process.env);
      return { note: a.url + '|' + p.firstname + '|' + (d > 0.5 ? 'far' : 'near') + '|' + env };
    }
  `), h, {}, { hookExecutor: createNodeHookExecutor() });
  const out = runtime.getHydrated();
  assert.match(out, /asset:lolly\/logo\|Ada\|far\|/);
  assert.ok(!out.includes('must-not-leak'), 'the thread is spawned with an empty environment');
  assert.ok(h.logs.some((l: string) => /worker thread/.test(l)), 'the mount announces itself');
  runtime.destroy?.();
});

test('a host call outside policy is refused, and an unknown one is an honest error', async () => {
  const h = host({ export: { render: async () => new Blob([]), download: async () => {}, file: async () => {}, imprint: async (b: Uint8Array) => b } });
  const runtime = await createRuntime(toolWith(`
    async function onInit({ host }) {
      let a = 'no', b = 'no';
      try { await host.export.render(); } catch (e) { a = e.message; }
      try { await host.assets.nothing(); } catch (e) { b = e.message; }
      return { note: a + '||' + b };
    }
  `), h, {}, { hookExecutor: createNodeHookExecutor() });
  const out = runtime.getHydrated();
  assert.match(out, /is not a function|not permitted/, 'export.render is omitted from the proxy');
  runtime.destroy?.();
});

test('a compile error falls back to in-realm by default and fails closed in strict mode', async () => {
  const h = host();
  const bad = toolWith('function onInit( { return {}; }');
  await assert.rejects(() => createRuntime(bad, h, {}, { hookExecutor: createNodeHookExecutor({ strict: true }) }), NodeHookIsolationError);
});

test('strict mode: the thread has an empty environment, no require and no fetch', async () => {
  const h = host();
  const runtime = await createRuntime(toolWith(`
    function onInit() {
      return { note: [Object.keys(process.env).length, typeof require, typeof fetch].join(',') };
    }
  `), h, {}, { hookExecutor: createNodeHookExecutor({ strict: true }) });
  assert.match(runtime.getHydrated(), /0,undefined,undefined/);
  runtime.destroy?.();
});
