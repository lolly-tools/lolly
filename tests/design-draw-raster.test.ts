// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileDesignDraw, layoutDesignDrawText, outlineDesignDrawText, type DesignDrawPage, type DrawShapeOp } from '../engine/src/design-draw.ts';
import type { TextShaperV1 } from '../engine/src/design-text-measure.ts';
import { encodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';
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
  assert.equal(DESIGN_RASTER_RECIPE, 'design-static-primitives-edge-aa-area-fills-gradients-rgba8-v3');
  assert.equal(current.recipe, DESIGN_RASTER_RECIPE);
  for (const recipe of ['design-static-primitives-rgba8-v0', 'design-static-primitives-edge-aa-rgba8-v1', 'design-static-primitives-edge-aa-area-fills-rgba8-v2']) {
    const stale = { ...structuredClone(current), recipe };
    assert.equal(readDesignRasterEvaluation(stale), null, `${recipe} is stale`);
    assert.notEqual(designRasterIdentity(current), designRasterIdentity(stale as DesignRasterEvaluation));
  }
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

const triangle = encodeAuthoredPaths([{ kind: 'cubic', closed: true, nodes: [{ x: 0, y: 1 }, { x: 0.5, y: 0 }, { x: 1, y: 1 }] }] as never) ?? '';
/** Fixed advances; each run outlines to a square a third of the size high, on its baseline. */
const shaper: TextShaperV1 = async (run) => {
  const advances = [...run.text].map((ch) => (ch === ' ' ? run.size / 4 : run.size / 2));
  return { advances, total: advances.reduce((a, b) => a + b, 0), font: { file: `/fonts/${run.family}.ttf`, metrics: { upem: 1000, ascent: 980, descent: 280 } } };
};
async function fillPage(extra: Record<string, unknown>[] = []): Promise<DesignDrawPage> {
  const page = compileDesignDraw([{ id: 'frame', kind: 'frame', w: 200, h: 120, bg: '#ffffff' },
    { id: 'tri', kind: 'path', x: 10, y: 10, w: 40, h: 30, path: triangle, bg: '#ff0000', rot: 90 },
    { id: 'words', kind: 'box', x: 60, y: 10, w: 120, h: 60, text: 'Hi there', fontSize: 16, bg: '#00ff00', fg: '#0000ff' },
    ...extra] as never, { width: 200, height: 120 }, { effects: true, colors: 'resolved' });
  await layoutDesignDrawText(page, shaper);
  await outlineDesignDrawText(page, async ({ text, fontSize }) => ({ d: text.trim() ? `M0 ${-fontSize / 3}L${text.length * fontSize / 2} ${-fontSize / 3}L${text.length * fontSize / 2} 0L0 0Z` : '' }));
  return page;
}

test('pen shapes and outlined words are admitted as closed, posed fills in paint order', async () => {
  const a = prepareDesignRaster(await fillPage());
  assert.ok(a.ok, JSON.stringify(!a.ok && a.findings));
  const e = a.evaluation;
  assert.deepEqual(e.paint, [['primitive', 0], ['fill', 0], ['primitive', 1], ['fill', 1]], 'frame, path, box, then its one run');
  const [tri, hi] = e.fills;
  assert.equal(tri!.id, 'tri'); assert.equal(tri!.evenOdd, false); assert.deepEqual(tri!.color, [1, 0, 0, 1]);
  const close = (n: number, m: number) => Math.abs(n - m) < 1e-9;
  // Turned 90 degrees about its centre (30, 25), the 40 x 30 box spans 30 x 40.
  assert.ok(close(tri!.bounds[0], 15) && close(tri!.bounds[1], 5) && close(tri!.bounds[2], 45) && close(tri!.bounds[3], 45), JSON.stringify(tri!.bounds));
  const edges = tri!.edges, last = edges.length - 4;
  assert.deepEqual([edges[last + 2], edges[last + 3]], [edges[0], edges[1]], 'the contour closes on its start');
  assert.equal(hi!.id, 'words:0.0'); assert.deepEqual(hi!.color, [0, 0, 1, 1], 'the run is drawn in the row ink');
  assert.equal(designRasterIdentity(readDesignRasterEvaluation(structuredClone(e))!), designRasterIdentity(e), 'a fill survives the worker handoff');
  for (const tamper of [
    (v: Record<string, any>) => { v.fills[0].bounds[0] -= 1; },
    (v: Record<string, any>) => { v.paint.reverse(); },
    (v: Record<string, any>) => { v.fills[0].edges.pop(); },
    (v: Record<string, any>) => { v.fills[0].color[3] = 2; },
    (v: Record<string, any>) => { v.paint.pop(); },
  ]) { const v = structuredClone(e) as Record<string, any>; tamper(v); assert.equal(readDesignRasterEvaluation(v), null); }
});

test('fills refuse dashes, centred box strokes, words the box would clip, group fades and live text', async () => {
  const findings = async (page: DesignDrawPage) => { const a = prepareDesignRaster(page); return a.ok ? [] : a.findings.map(f => `${f.feature}:${f.id}`); };
  assert.deepEqual(await findings(await fillPage([{ id: 'line', kind: 'path', x: 0, y: 80, w: 50, h: 20, path: triangle, stroke: '#000000', strokeW: 2 }])), []);
  assert.deepEqual(await findings(await fillPage([{ id: 'dash', kind: 'path', x: 0, y: 80, w: 50, h: 20, path: triangle, stroke: '#000000', strokeW: 2, strokeDash: 'dashed' }])), ['raster-dash:dash']);
  assert.deepEqual(await findings(await fillPage([{ id: 'both', kind: 'path', x: 0, y: 80, w: 50, h: 20, path: triangle, bg: '#ff0000', stroke: '#000000', strokeW: 2, opacity: 50 }])), ['raster-group:both']);
  const centred = await fillPage([{ id: 'edge', kind: 'box', x: 0, y: 80, w: 50, h: 20, bg: '#ff0000', stroke: '#000000', strokeW: 2 }]);
  delete (centred.ops.at(-1) as DrawShapeOp).stroke!.align;
  assert.deepEqual(await findings(centred), ['raster-stroke:edge'], 'a centred box stroke is the preview reading');
  const capped = await fillPage([{ id: 'cap', kind: 'path', x: 0, y: 80, w: 50, h: 20, path: triangle, stroke: '#000000', strokeW: 2 }]);
  (capped.ops.at(-1) as DrawShapeOp).stroke!.cap = 'arrow';
  assert.deepEqual(await findings(capped), ['raster-stroke:cap']);
  assert.deepEqual(await findings(await fillPage([{ id: 'tight', kind: 'text', x: 0, y: 80, w: 30, h: 12, text: 'Overflowing words', fontSize: 16, align: 'left' }])), ['raster-clip:tight']);
  assert.deepEqual(await findings(await fillPage([{ id: 'fade', kind: 'box', x: 0, y: 80, w: 120, h: 30, text: 'Faded', fontSize: 12, bg: '#cccccc', opacity: 50 }])), ['raster-group:fade']);
  const live = await fillPage(); delete live.ops[1]!.words!.outlines;
  assert.deepEqual(await findings(live), ['raster-live-text:words']);
});

test('strokes become the fill of the region they paint, over the fills and under the words', async () => {
  const line = encodeAuthoredPaths([{ kind: 'cubic', closed: false, nodes: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }] }] as never) ?? '';
  const a = prepareDesignRaster(await fillPage([
    { id: 'border', kind: 'box', x: 10, y: 50, w: 40, h: 30, bg: '#ffff00', stroke: '#000000', strokeW: 4, text: 'Hi', fontSize: 8 },
    { id: 'round', kind: 'box', x: 60, y: 80, w: 40, h: 30, shape: 'rounded', radius: 10, stroke: '#00000080', strokeW: 4 },
    { id: 'oval', kind: 'box', x: 110, y: 80, w: 40, h: 30, shape: 'ellipse', stroke: '#000000', strokeW: 5, rot: 30 },
    { id: 'butt', kind: 'path', x: 10, y: 90, w: 40, h: 10, path: line, stroke: '#000000', strokeW: 6, strokeCap: 'butt' },
    { id: 'cap', kind: 'path', x: 10, y: 100, w: 40, h: 10, path: line, stroke: '#000000', strokeW: 6 },
  // Curves flatten to 1/32 output px, so at 16x each chord sits within 1/512 px of its curve.
  ]), { width: 3200, height: 1920, dpi: 1536 });
  assert.ok(a.ok, JSON.stringify(!a.ok && a.findings));
  const e = a.evaluation;
  assert.deepEqual(e.paint.map(([kind, i]) => kind === 'primitive' ? e.ops[i]!.id : e.fills[i]!.id),
    ['frame', 'tri', 'words', 'words:0.0', 'border', 'border:stroke', 'border:0.0', 'round', 'round:stroke', 'oval', 'oval:stroke', 'butt:stroke', 'cap:stroke']);
  const area = (id: string) => {
    const edges = e.fills.find(f => f.id === id)!.edges;
    let twice = 0;
    for (let i = 0; i < edges.length; i += 4) twice += edges[i]! * edges[i + 3]! - edges[i + 2]! * edges[i + 1]!;
    return Math.abs(twice / 2);
  };
  // A chord within t of its curve loses at most two thirds of t times its length, here t = 1/512 px.
  const near = (id: string, exact: number, curved: number) => assert.ok(Math.abs(area(id) - exact) <= (2 / 3) * curved / 512 + 1e-3, `${id}: ${area(id)} against ${exact}`);
  const ellipse = (a: number, b: number) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  // A CSS border is the ring between the box and the box inside the border, whose corner radius shrinks by the width.
  near('border:stroke', 40 * 30 - 32 * 22, 0);
  near('round:stroke', 40 * 30 - (4 - Math.PI) * 100 - (32 * 22 - (4 - Math.PI) * 36), 2 * Math.PI * 10);
  near('oval:stroke', Math.PI * (20 * 15 - 15 * 10), ellipse(20, 15));
  // A pen stroke is centred on its path: a butt end stops at the end, a round one adds half a disc at each.
  near('butt:stroke', 40 * 6, 0);
  near('cap:stroke', 40 * 6 + Math.PI * 9, 2 * Math.PI * 3);
  assert.deepEqual(e.fills.find(f => f.id === 'round:stroke')!.color, [0, 0, 0, 0x80 / 255], 'the stroke keeps its own alpha');
  assert.equal(designRasterIdentity(readDesignRasterEvaluation(structuredClone(e))!), designRasterIdentity(e), 'strokes survive the worker handoff');
});

test('gradients paint over their primitive as CSS backgrounds: on the box inside the border, after the colour, before the border', () => {
  const a = prepareDesignRaster(compileDesignDraw([{ id: 'frame', kind: 'frame', w: 200, h: 120, bg: '#ffffff' },
    { id: 'lin', kind: 'box', x: 10, y: 10, w: 80, h: 40, bg: '#000000', grad: 'lin.srgb_90_ff0000-0_0000ff80-100', opacity: 100 },
    { id: 'rad', kind: 'box', x: 100, y: 10, w: 60, h: 40, shape: 'ellipse', grad: 'rad.srgb_0_ffffff-0_00000000-100', stroke: '#00ff00', strokeW: 5, rot: 30 },
    { id: 'fade', kind: 'box', x: 10, y: 60, w: 60, h: 40, grad: 'lin.srgb_0_ffffff-0_000000-100', opacity: 50 },
  ] as never, { width: 200, height: 120 }, { effects: true, colors: 'resolved' }));
  assert.ok(a.ok, JSON.stringify(!a.ok && a.findings));
  const e = a.evaluation;
  assert.deepEqual(e.paint.map(([kind, i]) => kind === 'primitive' ? e.ops[i]!.id : kind === 'fill' ? e.fills[i]!.id : e.gradients[i]!.id),
    ['frame', 'lin', 'lin:gradient', 'rad', 'rad:gradient', 'rad:stroke', 'fade', 'fade:gradient'], 'the colour, its gradient, then the border');
  const [lin, rad, fade] = e.gradients;
  assert.deepEqual([lin!.primitive, lin!.kind, lin!.geometry.map(n => Math.round(n * 1e9) / 1e9), lin!.tile], [1, 'linear', [10, 30, 90, 30], [10, 10, 80, 40]], 'a 90 degree line across the box');
  assert.deepEqual(lin!.stops, [0, 1, 0, 0, 1, 1, 0, 0, 1, 0x80 / 255]);
  assert.deepEqual(e.ops[1]!.color, [0, 0, 0, 1], 'the colour under the gradient stays a primitive');
  assert.deepEqual([rad!.primitive, rad!.kind, rad!.tile], [2, 'radial', [105, 15, 50, 30]], 'the box inside the five-pixel border');
  assert.ok(Math.abs(rad!.geometry[2] - 50 * Math.SQRT1_2) < 1e-12 && Math.abs(rad!.geometry[3] - 30 * Math.SQRT1_2) < 1e-12 && rad!.geometry[0] === 130 && rad!.geometry[1] === 30,
    'an ellipse at the centre reaching the farthest corner');
  assert.deepEqual([rad!.stops[4], rad!.stops[9]], [1, 0]);
  assert.deepEqual([fade!.stops[4], fade!.stops[9]], [0.5, 0.5], 'stop alpha carries the operation opacity');
  assert.deepEqual(e.ops[3]!.color[3], 0, 'a box with only a gradient keeps a transparent primitive for its outline');
  assert.equal(designRasterIdentity(readDesignRasterEvaluation(structuredClone(e))!), designRasterIdentity(e), 'gradients survive the worker handoff');
  for (const tamper of [
    (v: Record<string, any>) => { v.gradients[0].primitive = 2; },
    (v: Record<string, any>) => { v.gradients[0].primitive = 9; },
    (v: Record<string, any>) => { v.gradients[0].stops[5] = -0.5; },
    (v: Record<string, any>) => { v.gradients[0].stops.length = 7; },
    (v: Record<string, any>) => { v.gradients[0].tile[2] = 0; },
    (v: Record<string, any>) => { v.gradients[0].kind = 'conic'; },
    (v: Record<string, any>) => { v.paint.splice(2, 1); v.paint.push(['gradient', 0]); },
    (v: Record<string, any>) => { delete v.gradients; },
  ]) { const v = structuredClone(e) as Record<string, any>; tamper(v); assert.equal(readDesignRasterEvaluation(v), null, tamper.toString()); }
  // A colour under a gradient fades as one group, which painting them one after the other would not.
  const faded = prepareDesignRaster(compileDesignDraw([{ id: 'frame', kind: 'frame', w: 200, h: 120, bg: '#ffffff' },
    { id: 'both', kind: 'box', x: 10, y: 10, w: 80, h: 40, bg: '#000000', grad: 'lin.srgb_90_ff0000-0_0000ff-100', opacity: 50 }] as never, { width: 200, height: 120 }, { effects: true, colors: 'resolved' }));
  assert.deepEqual(!faded.ok && faded.findings.map(f => `${f.feature}:${f.id}`), ['raster-group:both']);
});

test('a page with gradients compiles the gradient pipeline once and releases its buffers', async t => {
  const prior = new Map<string, unknown>();
  for (const [key, value] of Object.entries({ GPUBufferUsage: { STORAGE: 1, COPY_DST: 2, UNIFORM: 4, COPY_SRC: 8, MAP_READ: 16 }, GPUTextureUsage: { RENDER_ATTACHMENT: 1, TEXTURE_BINDING: 2 }, GPUMapMode: { READ: 1 } })) {
    prior.set(key, Reflect.get(globalThis, key)); Reflect.set(globalThis, key, value);
  }
  t.after(() => { for (const [key, value] of prior) { if (value === undefined) Reflect.deleteProperty(globalThis, key); else Reflect.set(globalThis, key, value); } });
  const a = prepareDesignRaster(compileDesignDraw([{ id: 'frame', kind: 'frame', w: 64, h: 48, bg: '#ffffff' },
    { id: 'lin', kind: 'box', x: 4, y: 4, w: 40, h: 20, grad: 'lin.srgb_90_ff0000-0_0000ff-100' }] as never, { width: 64, height: 48 }, { effects: true, colors: 'resolved' }));
  assert.ok(a.ok);
  const f = gpu(); await f.render(a.evaluation); const second = await f.render(a.evaluation);
  assert.deepEqual([second.allocation.created, second.allocation.destroyed, second.allocation.liveBytes], [8, 8, 0], 'the six primitive resources plus gradient descriptors and stops');
  assert.equal(f.counts().pipelines, 3, 'render, readback and gradient, each compiled once');
  for (let at = 1; at <= 8; at++) {
    const g = gpu('allocation', at); await assert.rejects(g.render(a.evaluation), /actual allocation fault/);
    assert.equal(g.counts().created, g.counts().destroyed); assert.equal(g.counts().scopes, 0);
  }
});

test('a page with fills compiles the fill pipeline once and releases every fill buffer', async t => {
  const prior = new Map<string, unknown>();
  for (const [key, value] of Object.entries({ GPUBufferUsage: { STORAGE: 1, COPY_DST: 2, UNIFORM: 4, COPY_SRC: 8, MAP_READ: 16 }, GPUTextureUsage: { RENDER_ATTACHMENT: 1, TEXTURE_BINDING: 2 }, GPUMapMode: { READ: 1 } })) {
    prior.set(key, Reflect.get(globalThis, key)); Reflect.set(globalThis, key, value);
  }
  t.after(() => { for (const [key, value] of prior) { if (value === undefined) Reflect.deleteProperty(globalThis, key); else Reflect.set(globalThis, key, value); } });
  const a = prepareDesignRaster(await fillPage()); assert.ok(a.ok);
  const f = gpu(); await f.render(a.evaluation); const second = await f.render(a.evaluation);
  assert.deepEqual([second.allocation.created, second.allocation.destroyed, second.allocation.liveBytes], [8, 8, 0], 'the six primitive resources plus fill descriptors and edges');
  assert.equal(f.counts().pipelines, 3, 'render, readback and fill, each compiled once');
  for (let at = 1; at <= 8; at++) {
    const g = gpu('allocation', at); await assert.rejects(g.render(a.evaluation), /actual allocation fault/);
    assert.equal(g.counts().created, g.counts().destroyed); assert.equal(g.counts().scopes, 0);
  }
});

test('overlapping contours are merged before they become a fill, and a fill past the merge budget is refused', async () => {
  const square = (x0: number, y0: number, x1: number, y1: number) => ({ kind: 'cubic', closed: true, nodes: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
  const overlap = encodeAuthoredPaths([square(0, 0, 0.6, 0.6), square(0.4, 0.4, 1, 1)] as never) ?? '';
  const a = prepareDesignRaster(compileDesignDraw([{ id: 'frame', kind: 'frame', w: 200, h: 120, bg: '#ffffff' },
    { id: 'pair', kind: 'path', x: 0, y: 0, w: 100, h: 100, path: overlap, bg: '#000000' }] as never, { width: 200, height: 120 }, { effects: true, colors: 'resolved' }));
  assert.ok(a.ok, JSON.stringify(!a.ok && a.findings));
  const e = a.evaluation.fills[0]!.edges;
  let area = 0, w = 0;
  for (let i = 0; i < e.length; i += 4) {
    const [x0, y0, x1, y1] = [e[i]!, e[i + 1]!, e[i + 2]!, e[i + 3]!];
    area += (x0 * y1 - x1 * y0) / 2;
    if ((y0 <= 50.5) !== (y1 <= 50.5) && x0 + (50.5 - y0) / (y1 - y0) * (x1 - x0) > 50.5) w += y1 > y0 ? 1 : -1;
  }
  assert.equal(Math.abs(w), 1, 'the overlap is covered once, so the area sum stays exact');
  assert.ok(Math.abs(Math.abs(area) - 6800) < 1e-6, `the union's area, not the sum of both squares: ${area}`);
  const comb = encodeAuthoredPaths(Array.from({ length: 2100 }, (_, i) => square(i / 2100, 0, (i + 0.5) / 2100, 1)) as never) ?? '';
  const b = prepareDesignRaster(compileDesignDraw([{ id: 'frame', kind: 'frame', w: 200, h: 120, bg: '#ffffff' },
    { id: 'comb', kind: 'path', x: 0, y: 0, w: 100, h: 100, path: comb, bg: '#000000' }] as never, { width: 200, height: 120 }, { effects: true, colors: 'resolved' }));
  assert.deepEqual(!b.ok && b.findings.map(f => `${f.feature}:${f.id}`), ['raster-budget:comb']);
});
