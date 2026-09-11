// SPDX-License-Identifier: MPL-2.0
/**
 * Proof for the hook-Worker executor core (hook-worker.worker.ts) - M2,
 * plans/86-worker-isolation-hooks.md section 13.1.
 *
 * Drives `createHookWorkerCore` with a stub port + a mock main-thread host
 * dispatcher, exactly as sequence-render-worker.test.ts drives its worker core,
 * so the whole message protocol + host-proxy construction is verified in plain
 * Node - no real Worker, no DOM. Proves the three buckets:
 *   - CO-LOCATE: host.color.* runs locally in the core (real makeColorApi).
 *   - TOKEN SNAPSHOT: host.tokens.colors()/resolve() answer from a local
 *     createTokenSet built off a shipped doc - no round-trip.
 *   - RPC: host.assets.get(...) round-trips through the stub port to a mock host.
 * Plus: an ABSENT optional namespace stays absent (feature-detect survives).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createHookWorkerCore,
  lockDownAmbientCapabilities,
  STRICT_AMBIENT_GLOBALS,
  STRICT_NAVIGATOR_PROPERTIES,
  type HookWorkerOut, type HookInvokeDoneMsg, type HookInitDoneMsg, type HookHostCallMsg,
  workerRpcMethods,
} from './hook-worker.worker.ts';
import {
  getWorkerHookExecutor,
  HookIsolationUnavailableError,
  strictHostShape,
  WORKER_HOOK_BUDGET_MS,
} from './hook-worker.ts';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** A minimal DTCG doc so createTokenSet yields a couple of resolvable colours. */
const TOKEN_DOC = {
  color: {
    brand: { $type: 'color', $value: '#30ba78' },
    ink: { $type: 'color', $value: '#101418' },
  },
};

/** Run the core against a stub port; return a driver that collects posted messages
 *  and can service host-call RPCs against a mock host. */
function harness(mockHost: Record<string, Record<string, (...a: unknown[]) => unknown>> = {}) {
  const posted: HookWorkerOut[] = [];
  const core = createHookWorkerCore({ post: (m) => { posted.push(m); } });
  // Auto-service host-call messages against the mock host, replying next tick.
  let serviced = 0;
  async function pump(): Promise<void> {
    await tick();
    for (; serviced < posted.length; serviced++) {
      const m = posted[serviced];
      if (!m || m.t !== 'host-call') continue;
      const call = m as HookHostCallMsg;
      const dot = call.method.indexOf('.');
      const ns = call.method.slice(0, dot);
      const method = call.method.slice(dot + 1);
      const fn = mockHost[ns]?.[method];
      try {
        const value = typeof fn === 'function' ? await fn(...call.args) : undefined;
        core.handle({ t: 'host-reply', runId: call.runId, hostCallId: call.hostCallId, ok: typeof fn === 'function', value, error: typeof fn === 'function' ? undefined : `no host.${call.method}` });
      } catch (e) {
        core.handle({ t: 'host-reply', runId: call.runId, hostCallId: call.hostCallId, ok: false, error: (e as Error).message });
      }
    }
    await tick();
  }
  return { core, posted, pump };
}

test('worker core: co-located color + token snapshot + RPC all reach a hook', async () => {
  const source = `
    async function onInit({ model, host }) {
      const dist = host.color.distinct(3);              // co-located (real makeColorApi)
      const swatches = await host.tokens.colors();      // token snapshot (local TokenSet)
      const brand = await host.tokens.resolve('{color.brand}');
      const asset = await host.assets.get('logo/primary'); // RPC → main
      const missing = host.pdf ? 'has-pdf' : 'no-pdf';  // absent namespace stays absent
      return {
        distinctCount: String(dist.length),
        tokenCount: String(swatches.length),
        brand: String(brand),
        assetUrl: asset ? asset.url : 'none',
        pdf: missing,
      };
    }`;

  const { core, posted, pump } = harness({
    assets: { get: async (id: unknown) => ({ id, url: `blob:mock/${id}` }) },
  });

  core.handle({
    t: 'init', runId: 1, hooksSource: source, tokenDoc: TOKEN_DOC, tokenExcluded: [],
    // hostShape deliberately OMITS pdf → host.pdf must be undefined in the worker.
    hostShape: { assets: ['get'], color: ['distinct'], tokens: ['get', 'colors', 'resolve'] },
    seeds: {}, shell: 'web', capabilities: [],
  });
  const init = posted.find((m): m is HookInitDoneMsg => m.t === 'init-done');
  assert.ok(init, 'init-done posted');
  assert.deepEqual(init.declared, ['onInit'], 'onInit is the only declared worker hook');

  core.handle({ t: 'invoke', runId: 1, callId: 1, name: 'onInit', ctx: { model: [] } });
  await pump(); // service the assets.get RPC, let the hook resolve

  const done = posted.find((m): m is HookInvokeDoneMsg => m.t === 'invoke-done' && (m as HookInvokeDoneMsg).callId === 1);
  assert.ok(done, 'invoke-done posted');
  assert.ok(done.ok, `hook succeeded (${(done as HookInvokeDoneMsg).error ?? ''})`);
  const patch = done.patch as Record<string, string>;
  assert.equal(patch.distinctCount, '3', 'host.color.distinct ran locally in the worker');
  assert.ok(Number(patch.tokenCount) >= 2, 'host.tokens.colors resolved from the local snapshot');
  assert.match(patch.brand ?? '', /#?30ba78/i, 'host.tokens.resolve returned the brand colour from the snapshot');
  assert.equal(patch.assetUrl, 'blob:mock/logo/primary', 'host.assets.get round-tripped through the RPC bridge');
  assert.equal(patch.pdf, 'no-pdf', 'an absent optional namespace stays absent (feature-detect survives)');
});

test('worker core: a hook error surfaces as a failed invoke, not a crash', async () => {
  const source = `function onInput({ value }) { throw new Error('boom: ' + value); }`;
  const { core, posted } = harness();
  core.handle({ t: 'init', runId: 2, hooksSource: source, tokenDoc: null, tokenExcluded: [], hostShape: {}, seeds: {}, shell: 'web', capabilities: [] });
  core.handle({ t: 'invoke', runId: 2, callId: 1, name: 'onInput', ctx: { id: 'x', value: 'v', model: [] } });
  await tick();
  const done = posted.find((m): m is HookInvokeDoneMsg => m.t === 'invoke-done');
  assert.ok(done && !done.ok, 'a throwing hook reports ok:false');
  assert.match(done.error ?? '', /boom: v/, 'the error message crosses back');
});

test('worker core: seeded feature-detects answer synchronously, never a Promise', async () => {
  // The sync isAvailable family must come from the seed, not the RPC stub - a
  // Promise would stringify to [object Promise] and break a hook that branches on it.
  const source = `
    function onInit({ host }) {
      return {
        media: String(host.media.isAvailable()),
        recVideo: String(host.recorder.isAvailable('video')),
        recAudio: String(host.recorder.isAvailable('audio')),
      };
    }`;
  const { core, posted } = harness();
  core.handle({
    t: 'init', runId: 4, hooksSource: source, tokenDoc: null, tokenExcluded: [],
    hostShape: { media: ['isAvailable', 'start'], recorder: ['isAvailable', 'record'] },
    seeds: { 'media.isAvailable': true, 'recorder.isAvailable': { audio: true, video: false, screen: false } },
    shell: 'web', capabilities: [],
  });
  core.handle({ t: 'invoke', runId: 4, callId: 1, name: 'onInit', ctx: {} });
  await tick();
  const done = posted.find((m): m is HookInvokeDoneMsg => m.t === 'invoke-done' && (m as HookInvokeDoneMsg).callId === 1);
  assert.ok(done?.ok, `seeded hook ran (${done?.error ?? ''})`);
  const patch = done!.patch as Record<string, string>;
  assert.equal(patch.media, 'true', 'media.isAvailable returned the seed synchronously');
  assert.equal(patch.recVideo, 'false', 'recorder.isAvailable(video) is per-kind seeded');
  assert.equal(patch.recAudio, 'true', 'recorder.isAvailable(audio) is per-kind seeded');
});

test('worker core: dispose drops the run so a singleton worker does not leak per mount', async () => {
  const { core } = harness();
  core.handle({ t: 'init', runId: 6, hooksSource: 'function onInit(){ return {}; }', tokenDoc: null, tokenExcluded: [], hostShape: {}, seeds: {}, shell: 'web', capabilities: [] });
  assert.equal(core._runs.size, 1, 'a mount registers one run');
  core.handle({ t: 'dispose', runId: 6 });
  assert.equal(core._runs.size, 0, 'dispose removes the run - no per-mount accumulation');
  // A late host-reply / invoke for the disposed run must not resurrect or throw.
  core.handle({ t: 'invoke', runId: 6, callId: 9, name: 'onInit', ctx: {} });
  assert.equal(core._runs.size, 0, 'a post-dispose invoke does not recreate the run');
});

test('worker core: a compile error is reported so the client can fall back', async () => {
  const { core, posted } = harness();
  core.handle({ t: 'init', runId: 5, hooksSource: 'function onInit( { syntax error', tokenDoc: null, tokenExcluded: [], hostShape: {}, seeds: {}, shell: 'web', capabilities: [] });
  const init = posted.find((m): m is HookInitDoneMsg => m.t === 'init-done');
  assert.ok(init, 'init-done still posts on a compile error');
  assert.ok(init.compileError, 'the compile error is signalled (so mountInWorker rejects → in-realm fallback)');
  assert.deepEqual(init.declared, [], 'no hooks are declared from a broken source');
});

test('worker core reports DOM export hooks that strict isolation must refuse', () => {
  const { core, posted } = harness();
  core.handle({
    t: 'init', runId: 7,
    hooksSource: 'function onInit(){return {}}; function beforeExport(){}; function exportStill(){}',
    tokenDoc: null, tokenExcluded: [], hostShape: {}, seeds: {}, shell: 'web', capabilities: [],
  });
  const init = posted.find((m): m is HookInitDoneMsg => m.t === 'init-done');
  assert.deepEqual(init?.declared, ['onInit']);
  assert.deepEqual(init?.inRealmOnlyDeclared, ['beforeExport', 'exportStill']);
});

test('worker RPC authorization excludes methods omitted, seeded, or co-located', () => {
  const allowed = workerRpcMethods({
    assets: ['get'],
    export: ['render', 'download'],
    media: ['isAvailable', 'start'],
    color: ['distinct'],
  });
  assert.deepEqual([...allowed].sort(), ['assets.get', 'export.download']);
});

test('strict host shape requires declared capabilities and hides privileged namespaces', () => {
  const shape = strictHostShape({
    assets: ['get', '_cacheBlob'],
    ['net']: ['fetch'],
    clipboard: ['write'],
    recorder: ['record'],
    export: ['download'],
    profile: ['get'],
  }, ['network']);
  assert.deepEqual(shape, { assets: ['get'], ['net']: ['fetch'] });
});

test('strict worker lockdown removes ambient network, storage, and worker bypasses', () => {
  const fake = Object.fromEntries(STRICT_AMBIENT_GLOBALS.map(name => [name, () => name])) as Record<string, unknown>;
  fake.navigator = Object.fromEntries(STRICT_NAVIGATOR_PROPERTIES.map(name => [name, { name }]));
  lockDownAmbientCapabilities(fake);
  for (const name of STRICT_AMBIENT_GLOBALS) {
    assert.equal(fake[name], undefined, `${name} is unavailable`);
    const descriptor = Object.getOwnPropertyDescriptor(fake, name);
    assert.equal(descriptor?.configurable, false, `${name} cannot be restored`);
    assert.equal(descriptor?.writable, false, `${name} cannot be reassigned`);
  }
  for (const name of STRICT_NAVIGATOR_PROPERTIES) {
    assert.equal((fake.navigator as Record<string, unknown>)[name], undefined, `navigator.${name} is unavailable`);
  }
});

test('isolated execution budgets cover every worker hook', () => {
  assert.deepEqual(Object.keys(WORKER_HOOK_BUDGET_MS).sort(), [
    'exportFile', 'onFrame', 'onInit', 'onInput', 'onLevel',
  ]);
  assert.ok(Object.values(WORKER_HOOK_BUDGET_MS).every(ms => ms > 0 && ms <= 10_000));
});

test('strict worker executor fails closed when Worker is unavailable', async () => {
  const executor = getWorkerHookExecutor({ allowInRealmFallback: false });
  const tool = {
    trustClass: 'sideloaded-consented',
    hooksSource: 'function onInit(){ return {}; }',
    manifest: { id: 'custom' },
  } as Parameters<typeof executor>[0];
  const host = { log() {} } as unknown as Parameters<typeof executor>[1];
  await assert.rejects(executor(tool, host), (error: unknown) =>
    error instanceof HookIsolationUnavailableError && error.code === 'isolation-unavailable');
});
