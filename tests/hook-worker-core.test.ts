// SPDX-License-Identifier: MPL-2.0
/**
 * Pins the transport-agnostic half of the hook-isolation protocol: the pure
 * helpers a real owning thread calls before spawning a worker
 * (introspectHost's underscore/non-function filtering, gatherHostSeeds's
 * by-kind recorder shape, workerRpcMethods excluding co-located/omitted/seeded
 * methods so a hook can't forge its way around bucket policy, and
 * lockDownAmbientCapabilities's fail-loud verification), plus
 * createHookWorkerCore's message-driven lifecycle against a stub port: init
 * compiles hooks.js and reports which hooks were declared, invoke runs a hook
 * and round-trips its patch, a hook's `host.*` call becomes a host-call
 * message that resolves only once a host-reply arrives, and dispose rejects
 * anything still pending. This is what keeps the web Worker and Node
 * worker_threads executors identical (see hook-worker-core.ts's own doc
 * comment) without needing either a browser or a worker thread in this test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  introspectHost, gatherHostSeeds, workerRpcMethods, lockDownAmbientCapabilities,
  createHookWorkerCore, type HookWorkerPort, type HookWorkerOut, type HostShape,
  type HookInitMsg,
} from '../engine/src/hook-worker-core.ts';

// ── Pure helpers ─────────────────────────────────────────────────────────────

test('introspectHost lists only function-valued, non-underscore methods per namespace', () => {
  const host = {
    log: () => {},
    assets: { get: async () => {}, _internal: () => {}, cachedValue: 'not a fn' },
    empty: {},
  };
  assert.deepEqual(introspectHost(host), { assets: ['get'] });
});

test('gatherHostSeeds reports recorder.isAvailable as a by-kind map and swallows a throwing probe', () => {
  const host = {
    recorder: { isAvailable: (kind: string) => kind === 'audio' },
    media: { isAvailable: () => { throw new Error('no camera'); } },
  };
  const seeds = gatherHostSeeds(host);
  assert.deepEqual(seeds['recorder.isAvailable'], { audio: true, video: false, screen: false });
  assert.equal(seeds['media.isAvailable'], undefined);
});

test('gatherHostSeeds returns undefined for a namespace the host does not have at all', () => {
  const seeds = gatherHostSeeds({});
  assert.equal(seeds['audio.isAvailable'], undefined);
});

test('workerRpcMethods excludes co-located namespaces, seeded feature-detects and owner-resident methods', () => {
  const shape: HostShape = {
    color: ['distinct'],
    assets: ['get', 'upload'],
    media: ['isAvailable', 'start'],
    tokens: ['raw'],
  };
  const rpc = workerRpcMethods(shape);
  assert.deepEqual([...rpc].sort(), ['assets.get', 'assets.upload']);
  assert.equal(rpc.has('color.distinct'), false, 'co-located namespace stays off the RPC allowlist');
  assert.equal(rpc.has('media.isAvailable'), false, 'a seeded feature-detect is not an RPC method');
  assert.equal(rpc.has('media.start'), false, 'an owner-resident method the runtime pushes into the worker is omitted');
  assert.equal(rpc.has('tokens.raw'), false, 'the raw token accessor is an owner-side seam, never hook-facing');
});

test('lockDownAmbientCapabilities zeroes ambient globals and makes them non-configurable', () => {
  const scope: Record<string, unknown> = { fetch: () => {}, WebSocket: class {} };
  lockDownAmbientCapabilities(scope);
  assert.equal(scope.fetch, undefined);
  assert.throws(() => Object.defineProperty(scope, 'fetch', { value: 1, configurable: true }));
});

test('lockDownAmbientCapabilities throws when a global could not actually be disabled', () => {
  const scope: Record<string, unknown> = {};
  // Pre-lock 'fetch' as a live, non-configurable value: lockDown's own
  // Object.defineProperty attempt on it must fail and be swallowed, so the
  // verification pass is the only thing standing between this and a false
  // sense of isolation.
  Object.defineProperty(scope, 'fetch', { value: () => {}, configurable: false, writable: false });
  assert.throws(() => lockDownAmbientCapabilities(scope), /fetch/);
});

// ── The message-driven core ──────────────────────────────────────────────────

function stubPort() {
  const sent: HookWorkerOut[] = [];
  const port: HookWorkerPort = { post: (msg) => sent.push(msg) };
  return { port, sent };
}

function initMsg(overrides: Partial<HookInitMsg> = {}): HookInitMsg {
  return {
    t: 'init', runId: 1, hooksSource: 'function onInit(ctx) { return { greeting: "hi" }; }',
    tokenDoc: null, tokenExcluded: [], hostShape: {}, seeds: {}, shell: 'test', capabilities: [],
    ...overrides,
  };
}

test('init compiles hooks.js and reports which worker-eligible hooks were declared', () => {
  const { port, sent } = stubPort();
  const core = createHookWorkerCore(port);
  core.handle(initMsg());
  assert.equal(sent.length, 1);
  const done = sent[0]!;
  assert.equal(done.t, 'init-done');
  assert.deepEqual((done as { declared: string[] }).declared, ['onInit']);
  assert.deepEqual((done as { inRealmOnlyDeclared: string[] }).inRealmOnlyDeclared, []);
  assert.equal((done as { compileError?: string }).compileError, undefined);
});

test('a hooks.js that throws at compile time reports compileError and never mounts the run', () => {
  const { port, sent } = stubPort();
  const core = createHookWorkerCore(port);
  core.handle(initMsg({ hooksSource: 'this is not valid javascript(' }));
  const done = sent[0]! as { t: string; compileError?: string };
  assert.equal(done.t, 'init-done');
  assert.ok(done.compileError);
  assert.equal(core._runs.size, 0);
});

test('invoke runs the compiled hook and posts its resolved patch back through the port', async () => {
  const { port, sent } = stubPort();
  const core = createHookWorkerCore(port);
  core.handle(initMsg());
  core.handle({ t: 'invoke', runId: 1, callId: 7, name: 'onInit', ctx: {} });
  await new Promise((r) => setTimeout(r, 0));
  const done = sent.find((m) => m.t === 'invoke-done') as { ok: boolean; callId: number; patch: unknown };
  assert.equal(done.ok, true);
  assert.equal(done.callId, 7);
  assert.deepEqual(done.patch, { greeting: 'hi' });
});

test('invoking an undeclared hook name fails without ever calling into the compiled module', () => {
  const { port, sent } = stubPort();
  const core = createHookWorkerCore(port);
  core.handle(initMsg());
  core.handle({ t: 'invoke', runId: 1, callId: 2, name: 'exportFile', ctx: {} });
  const done = sent.find((m) => m.t === 'invoke-done') as { ok: boolean; error?: string };
  assert.equal(done.ok, false);
  assert.match(done.error ?? '', /no hook/);
});

test('a hook\'s host.* call becomes a host-call message and its promise resolves only on a matching host-reply', async () => {
  const { port, sent } = stubPort();
  const core = createHookWorkerCore(port);
  core.handle(initMsg({
    hooksSource: 'async function onInit(ctx) { const v = await ctx.host.assets.get("logo"); return { got: v }; }',
    hostShape: { assets: ['get'] },
  }));
  core.handle({ t: 'invoke', runId: 1, callId: 1, name: 'onInit', ctx: {} });
  await new Promise((r) => setTimeout(r, 0));
  const call = sent.find((m) => m.t === 'host-call') as { hostCallId: number; method: string; args: unknown[] };
  assert.equal(call.method, 'assets.get');
  assert.deepEqual(call.args, ['logo']);
  assert.equal(sent.some((m) => m.t === 'invoke-done'), false, 'the hook must not resolve before the host replies');

  core.handle({ t: 'host-reply', runId: 1, hostCallId: call.hostCallId, ok: true, value: 'asset-bytes' });
  await new Promise((r) => setTimeout(r, 0));
  const done = sent.find((m) => m.t === 'invoke-done') as { ok: boolean; patch: unknown };
  assert.equal(done.ok, true);
  assert.deepEqual(done.patch, { got: 'asset-bytes' });
});

test('dispose rejects any host-calls still pending for that run', async () => {
  const { port, sent } = stubPort();
  const core = createHookWorkerCore(port);
  core.handle(initMsg({
    hooksSource: 'async function onInit(ctx) { try { await ctx.host.assets.get("x"); return { ok: true }; } catch (e) { return { ok: false, message: String(e) }; } }',
    hostShape: { assets: ['get'] },
  }));
  core.handle({ t: 'invoke', runId: 1, callId: 1, name: 'onInit', ctx: {} });
  await new Promise((r) => setTimeout(r, 0));
  core.handle({ t: 'dispose', runId: 1 });
  await new Promise((r) => setTimeout(r, 0));
  const done = sent.find((m) => m.t === 'invoke-done') as { patch: { ok: boolean; message: string } };
  assert.equal(done.patch.ok, false);
  assert.match(done.patch.message, /mount disposed/);
});

test('a seeded feature-detect and an omitted owner-resident method never become an RPC call from inside a hook', async () => {
  const { port, sent } = stubPort();
  const core = createHookWorkerCore(port);
  core.handle(initMsg({
    hooksSource: 'function onInit(ctx) { return { available: ctx.host.media.isAvailable(), hasStart: typeof ctx.host.media.start }; }',
    hostShape: { media: ['isAvailable', 'start'] },
    seeds: { 'media.isAvailable': true },
  }));
  core.handle({ t: 'invoke', runId: 1, callId: 1, name: 'onInit', ctx: {} });
  await new Promise((r) => setTimeout(r, 0));
  const done = sent.find((m) => m.t === 'invoke-done') as { patch: { available: boolean; hasStart: string } };
  assert.equal(done.patch.available, true, 'the seed value is read synchronously, with no host-call round trip');
  assert.equal(done.patch.hasStart, 'undefined', 'an owner-resident OMIT_METHODS entry is never built onto the proxy');
  assert.equal(sent.some((m) => m.t === 'host-call'), false);
});
