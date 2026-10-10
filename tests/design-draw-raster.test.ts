// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileDesignDraw, type DesignDrawPage } from '../engine/src/design-draw.ts';
import { DESIGN_RASTER_RECIPE, designRasterIdentity, prepareDesignRaster, readDesignRasterEvaluation, type DesignRasterEvaluation } from '../engine/src/design-draw-raster.ts';
import { createDesignRasterRenderer } from '../shells/web/src/lib/webgpu/design-page.ts';
import { createDesignPageWorker } from '../shells/web/src/lib/webgpu/design-page-worker.ts';

function page(): DesignDrawPage {
  return compileDesignDraw([{ id: 'frame', kind: 'frame', w: 64, h: 48, bg: '#ffffff' },
    { id: 'rect', kind: 'shape', shape: 'rounded', radius: 8, x: 5, y: 4, w: 30, h: 20, bg: '#12abef', opacity: 50, rot: 12, flipH: true }], { width: 64, height: 48 }, { effects: true, colors: 'resolved' });
}
function evaluation(): DesignRasterEvaluation { const a = prepareDesignRaster(page()); assert.ok(a.ok); return a.evaluation; }

test('raster admission freezes detached ordered semantics and output geometry', () => {
  const p = page(), a = prepareDesignRaster(p, { width: 128, height: 96, dpi: 192 }); assert.ok(a.ok);
  const identity = designRasterIdentity(a.evaluation);
  p.ops[0]!.box.x = 900; p.frame!.fills.length = 0; p.ops.reverse();
  assert.equal(designRasterIdentity(a.evaluation), identity);
  assert.equal(a.evaluation.ops[1]!.color[3], .5);
  assert.equal(a.evaluation.ops[1]!.pose[1], true);
  assert.deepEqual([a.evaluation.pixelWidth, a.evaluation.pixelHeight, a.evaluation.dpi], [128, 96, 192]);
  assert.equal(Reflect.set(a.evaluation.ops[1]!.box, '0', 4), false);
  assert.equal(designRasterIdentity(readDesignRasterEvaluation(structuredClone(a.evaluation))!), identity);
  assert.notEqual(identity, designRasterIdentity(evaluation()));
});

test('coverage recipe revision rejects stale handoffs and changes detached raster identity', () => {
  const current = evaluation();
  assert.equal(DESIGN_RASTER_RECIPE, 'design-static-primitives-edge-aa-rgba8-v1');
  assert.equal(current.recipe, DESIGN_RASTER_RECIPE);
  const stale = { ...structuredClone(current), recipe: 'design-static-primitives-rgba8-v0' };
  assert.equal(readDesignRasterEvaluation(stale), null);
  assert.notEqual(designRasterIdentity(current), designRasterIdentity(stale as DesignRasterEvaluation));
});

test('unsupported features refuse the whole page rather than dropping operations', () => {
  const mutations: Array<(p: DesignDrawPage) => void> = [
    p => { p.ops[0]!.words = {} as never; }, p => { p.ops[0]!.picture = {} as never; }, p => { p.ops[0]!.shadow = {} as never; },
    p => { p.ops[0]!.blend = 'multiply'; }, p => { p.ops[0]!.blur = 1; }, p => { p.ops[0]!.clip = { points: [] }; },
    p => { p.ops[0]!.op = 'text'; }, p => { p.frame!.shape = { kind: 'rect', radius: 2 }; },
    p => { p.ops[0] = { ...p.ops[0]!, compatibility: 'penpot-native-v1' } as never; },
    p => { p.ops[0] = { ...p.ops[0]!, stroke: { color: '#fff', width: 1 } } as never; },
    p => { p.ops[0] = { ...p.ops[0]!, fills: [{ kind: 'radial', stops: [] }] } as never; },
    p => { p.findings.push({ id: 'lost-path', feature: 'bound-path' }); },
  ];
  for (const mutate of mutations) { const p = page(); mutate(p); const a = prepareDesignRaster(p); assert.equal(a.ok, false); if (!a.ok) assert.ok(a.findings.length); }
});

test('wrong versions, malformed geometry, unresolved colors and size/operation budgets reject', () => {
  for (const mutate of [(p: DesignDrawPage) => { p.version = 9 as never; },
    (p: DesignDrawPage) => { p.ops[0]!.box.x = Number.NaN; },
    (p: DesignDrawPage) => { p.ops[0] = { ...p.ops[0]!, fills: [{ kind: 'color', color: 'var(--ink)' }] } as never; },
    (p: DesignDrawPage) => { p.ops = Array(1025).fill(p.ops[0]); }]) { const p = page(); mutate(p); assert.equal(prepareDesignRaster(p).ok, false); }
  assert.equal(prepareDesignRaster(page(), { width: 8192, height: 8192 }).ok, false);
  for (const patch of [{ version: 2 }, { resources: ['asset'] }, { pixelWidth: 0 }, { extra: 1 }]) assert.equal(readDesignRasterEvaluation({ ...evaluation(), ...patch }), null);
});

function gpu(fault: 'allocation' | 'map' | 'scope' | 'cancel' | 'loss' | 'cancel-reject' | null = null, failAt = 1) {
  const controller = new AbortController(), cancellation = new AbortController();
  let created = 0, destroyed = 0, allocations = 0, scopes = 0, pipelines = 0;
  const resource = (size = 0) => {
    if (++allocations === failAt && fault === 'allocation') throw new Error('actual allocation fault');
    created++; let dead = false;
    return { createView: () => ({}), destroy() { assert.equal(dead, false); dead = true; destroyed++; },
      async mapAsync() { if (fault === 'map') throw new Error('actual mapping fault'); if (fault === 'cancel' || fault === 'cancel-reject') cancellation.abort(new DOMException('cancelled', 'AbortError')); if (fault === 'loss') controller.abort(new Error('actual device loss')); if (fault === 'cancel-reject') throw new Error('late rejected map'); },
      getMappedRange: () => new ArrayBuffer(size), unmap() {} };
  };
  const pass = { setPipeline() {}, setBindGroup() {}, draw() {}, dispatchWorkgroups() {}, end() {} };
  const device = {
    limits: { maxBufferSize: 1e8, maxStorageBufferBindingSize: 1e8, maxComputeWorkgroupsPerDimension: 65535, maxTextureDimension2D: 8192 },
    createBuffer: (d: { size: number }) => resource(d.size), createTexture: () => resource(),
    createShaderModule: () => ({}), async createRenderPipelineAsync() { pipelines++; return { getBindGroupLayout() {} }; },
    async createComputePipelineAsync() { pipelines++; return { getBindGroupLayout() {} }; }, createBindGroup: () => ({}),
    queue: { writeBuffer() {}, submit() {} },
    createCommandEncoder: () => ({ beginRenderPass: () => pass, beginComputePass: () => pass, copyBufferToBuffer() {}, finish() {} }),
    pushErrorScope() { scopes++; }, async popErrorScope() { scopes--; if (fault === 'cancel-reject') throw new Error('late rejected scope'); return fault === 'scope' ? new Error('actual validation fault') : null; },
  } as unknown as GPUDevice;
  const render = createDesignRasterRenderer({ run: work => work(device), loss: () => controller.signal });
  return { render, device, cancellation, counts: () => ({ created, destroyed, allocations, scopes, pipelines }) };
}

test('actual renderer releases every partial allocation, failed map and cancelled/lost job', async t => {
  const prior = new Map<string, unknown>();
  for (const [key, value] of Object.entries({ GPUBufferUsage: { STORAGE: 1, COPY_DST: 2, UNIFORM: 4, COPY_SRC: 8, MAP_READ: 16 }, GPUTextureUsage: { RENDER_ATTACHMENT: 1, TEXTURE_BINDING: 2 }, GPUMapMode: { READ: 1 } })) {
    prior.set(key, Reflect.get(globalThis, key)); Reflect.set(globalThis, key, value);
  }
  t.after(() => { for (const [key, value] of prior) { if (value === undefined) Reflect.deleteProperty(globalThis, key); else Reflect.set(globalThis, key, value); } });
  for (let at = 1; at <= 6; at++) {
    const f = gpu('allocation', at); await assert.rejects(f.render(evaluation()), /actual allocation fault/);
    assert.equal(f.counts().created, at - 1); assert.equal(f.counts().destroyed, at - 1); assert.equal(f.counts().scopes, 0);
  }
  for (const fault of ['map', 'scope', 'cancel', 'loss', 'cancel-reject'] as const) {
    const f = gpu(fault); await assert.rejects(f.render(evaluation(), f.cancellation.signal));
    assert.equal(f.counts().destroyed, 6); assert.equal(f.counts().scopes, 0);
  }
  const f = gpu(); const first = await f.render(evaluation()), second = await f.render(evaluation());
  assert.equal(first.data.length, 64 * 48 * 4); assert.equal(second.identity, first.identity);
  assert.deepEqual(second.allocation, { peakBytes: 64 * 48 * 12 + 160, created: 6, destroyed: 6, liveBytes: 0 });
  assert.equal(f.counts().pipelines, 2); assert.equal(f.counts().created, f.counts().destroyed);
  const limited = gpu(); Reflect.set(limited.device.limits, 'maxTextureDimension2D', 1);
  await assert.rejects(limited.render(evaluation()), /limits/); assert.equal(limited.counts().allocations, 0); assert.equal(limited.counts().pipelines, 0);
  await assert.rejects(limited.render({ ...evaluation(), version: 4 as never }), /invalid/); assert.equal(limited.counts().allocations, 0);
});

test('malformed falsy pose/paint and incomplete handoffs never reach graphics services', async () => {
  let calls = 0;
  const render = createDesignRasterRenderer({ run: async () => { calls++; throw new Error('must not acquire graphics'); }, loss: () => new AbortController().signal });
  for (const pose of [[0, 0, 0], [0, null, null], [NaN, false, false], [null, false, false], [0, '', false]]) {
    const e = structuredClone(evaluation()); Reflect.set(e.ops[1]!, 'pose', pose);
    assert.equal(readDesignRasterEvaluation(e), null); await assert.rejects(render(e), /invalid/);
  }
  const incomplete = { ...evaluation() }; Reflect.deleteProperty(incomplete, 'dpi'); await assert.rejects(render(incomplete), /invalid/);
  for (const field of ['pixelWidth', 'pixelHeight', 'dpi']) for (const invalid of [null, undefined]) {
    const e = structuredClone(evaluation()); Reflect.set(e, field, invalid);
    assert.equal(readDesignRasterEvaluation(e), null); await assert.rejects(render(e), /invalid/);
  }
  const sparse = structuredClone(evaluation()); Reflect.deleteProperty(sparse.ops[1]!.color, '3');
  assert.equal(readDesignRasterEvaluation(sparse), null); await assert.rejects(render(sparse), /invalid/);
  const missingOp = page(); Reflect.deleteProperty(missingOp.ops, '0'); assert.equal(prepareDesignRaster(missingOp).ok, false);
  const missingFinding = page(); missingFinding.findings.length = 1; assert.equal(prepareDesignRaster(missingFinding).ok, false);
  for (const invalid of [null, false, 0, '']) {
    const p = page(); Reflect.set(p.ops[0]!, 'pose', invalid); assert.equal(prepareDesignRaster(p).ok, false);
    const q = page(); Reflect.set(q.ops[0]!, 'fills', [invalid]); assert.equal(prepareDesignRaster(q).ok, false);
  }
  assert.equal(calls, 0);
});

test('already-aborted waits observe rejecting map/scope promises and retain cancellation cause', async t => {
  const unhandled: unknown[] = [], onUnhandled = (error: unknown) => { unhandled.push(error); };
  process.on('unhandledRejection', onUnhandled); t.after(() => process.off('unhandledRejection', onUnhandled));
  const old = new Map<string, unknown>();
  for (const [key, value] of Object.entries({ GPUBufferUsage: { STORAGE: 1, COPY_DST: 2, UNIFORM: 4, COPY_SRC: 8, MAP_READ: 16 }, GPUTextureUsage: { RENDER_ATTACHMENT: 1, TEXTURE_BINDING: 2 }, GPUMapMode: { READ: 1 } })) { old.set(key, Reflect.get(globalThis, key)); Reflect.set(globalThis, key, value); }
  t.after(() => { for (const [key, value] of old) { if (value === undefined) Reflect.deleteProperty(globalThis, key); else Reflect.set(globalThis, key, value); } });
  const f = gpu('cancel-reject'); await assert.rejects(f.render(evaluation(), f.cancellation.signal), error => error === f.cancellation.signal.reason);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(unhandled, []); assert.equal(f.counts().created, f.counts().destroyed); assert.equal(f.counts().scopes, 0);
});

test('worker refusal, cancellation and encode failure publish no partial raster result', async () => {
  const messages: Array<Record<string, unknown>> = [];
  let called = 0, finish!: (value: never) => void;
  const result = { width: 64, height: 48, data: new Uint8ClampedArray(64 * 48 * 4), identity: 'digest', allocation: { peakBytes: 1, created: 1, destroyed: 1, liveBytes: 0 } };
  const receive = createDesignPageWorker({ render: async () => { called++; return result; }, encode: async () => { throw new Error('actual encode fault'); }, post: message => messages.push(message as Record<string, unknown>) });
  const bad = page(); bad.findings.push({ id: 'x', feature: 'tilt' });
  await receive({ kind: 'render', id: 1, page: bad }); assert.equal(called, 0); assert.ok(messages[0]!.findings); assert.equal(messages[0]!.data, undefined);
  await receive({ kind: 'render', id: 2, page: page() }); assert.equal(messages[1]!.error, 'actual encode fault'); assert.equal(messages[1]!.data, undefined);
  const slow = createDesignPageWorker({ render: () => new Promise(resolve => { finish = resolve as never; }), encode: async () => { throw new Error('must not encode'); }, post: message => messages.push(message as Record<string, unknown>) });
  const pending = slow({ kind: 'render', id: 3, page: page() }); await slow({ kind: 'cancel', id: 3 });
  await slow({ kind: 'render', id: 4, page: page() }); assert.equal(messages[2]!.code, 'WEBGPU_BUSY');
  finish(result as never); await pending; assert.equal(messages[3]!.name, 'AbortError'); assert.equal(messages[3]!.data, undefined);
});

test('worker detaches before awaiting and transfers only a complete matching RGBA/PNG result', async () => {
  const p = page(), rgba = new Uint8ClampedArray(64 * 48 * 4), png = new Uint8Array([137, 80, 78, 71]);
  let captured: DesignRasterEvaluation | undefined, finish!: () => void, encoded: unknown;
  const result = { width: 64, height: 48, data: rgba, identity: 'digest', allocation: { peakBytes: 1, created: 1, destroyed: 1, liveBytes: 0 } };
  const outputs: Array<{ message: Record<string, unknown>; transfer: Transferable[] | undefined }> = [];
  const receive = createDesignPageWorker({ render: async e => { captured = e; await new Promise<void>(resolve => { finish = resolve; }); return result; },
    encode: async source => { encoded = source; return { bytes: png, mime: 'image/png', width: 64, height: 48 }; },
    post: (message, transfer) => outputs.push({ message: message as Record<string, unknown>, transfer }) });
  const pending = receive({ kind: 'render', id: 1, page: p }); p.ops[0]!.box.x = 900;
  assert.ok(captured); assert.equal(captured.ops[1]!.box[0], 5); assert.equal(outputs.length, 0); finish(); await pending;
  assert.equal(encoded, result); assert.equal(outputs.length, 1); assert.equal(outputs[0]!.message.ok, true);
  assert.equal(outputs[0]!.message.data, rgba); assert.equal(outputs[0]!.message.png, png);
  assert.deepEqual(outputs[0]!.transfer, [rgba.buffer, png.buffer]);
  const invalid: Record<string, unknown>[] = [];
  const wrong = createDesignPageWorker({ render: async () => result, encode: async () => ({ bytes: png, mime: 'image/png', width: 1, height: 48 }), post: message => invalid.push(message as Record<string, unknown>) });
  await wrong({ kind: 'render', id: 2, page: page() }); assert.equal(invalid[0]!.ok, false); assert.equal(invalid[0]!.data, undefined); assert.equal(invalid[0]!.png, undefined);
});
