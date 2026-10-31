// SPDX-License-Identifier: MPL-2.0
/**
 * The canvas size (engine 1.293): what every hook reads as `ctx.canvasSize` and a
 * template as `@canvasSize`, and the `onInput('__canvasSize')` run a tool that
 * declares `render.followsCanvasSize` gets when the size changes.
 *
 *  - the size at mount is the one `createRuntime` was given, else the manifest's;
 *  - `setCanvasSize` re-runs only a tool that follows the size, whose patch can
 *    update computed values and never an input; any other tool only records it,
 *    so its render, its hook calls and its subscribers are untouched;
 *  - the same size again is a no-op, `null` goes back to the manifest size, and a
 *    slow run cannot land over a newer size;
 *  - `canvasSizeOf` converts the forms every shell holds to the same CSS pixels.
 *
 * Run with: node --test tests/runtime-canvas-size.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRuntime } from '../engine/src/runtime.ts';
import { canvasSizeOf } from '../engine/src/units.ts';
import type { HostV1 } from '../engine/src/bridge/host-v1.ts';
import type { LoadedTool } from '../engine/src/loader.ts';
import { modelToValues } from '../engine/src/inputs.ts';

let serial = 0;
function tool(source: string | null, opts: { follows?: boolean; template?: string; exportHooks?: boolean } = {}): LoadedTool {
  return {
    trustClass: 'development-unsigned', styles: null, hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
    manifest: {
      id: `canvas-test-${++serial}`, name: 'Canvas', version: '1.0.0', engineVersion: '^1.293.0', status: 'official',
      inputs: [{ id: 'title', type: 'text', default: 'Doc' }],
      render: { width: 1280, height: 720, formats: ['svg'], ...(opts.follows ? { followsCanvasSize: true } : {}) },
      ...(source ? { hooks: { onInit: true, onInput: true, ...(opts.exportHooks ? { beforeExport: true } : {}) } } : {}),
    },
    template: opts.template ?? '{{title}}:{{shape}}', hooksSource: source,
  };
}
const host = { version: '1', profile: { get: async () => ({}) }, log() {} } as unknown as HostV1;
// Records every run it gets, and tries to write an input on the size run.
const HOOKS = `
var runs = [];
function shape(ctx) { var s = ctx.canvasSize; return s ? s.width + 'x' + s.height : 'none'; }
function onInit(ctx) { runs.push('init:' + shape(ctx)); return { shape: shape(ctx), runs: runs.join(',') }; }
function onInput(ctx) {
  runs.push(ctx.id + ':' + shape(ctx));
  return Object.assign({ shape: shape(ctx), runs: runs.join(',') }, ctx.id === '__canvasSize' ? { title: 'Unexpected write' } : {});
}`;

test('hooks read the manifest size at mount, or the size the shell gave', async () => {
  const plain = await createRuntime(tool(HOOKS), host);
  try {
    assert.equal(plain.getHydrated(), 'Doc:1280x720');
    assert.deepEqual(plain.canvasSize, { width: 1280, height: 720 });
    assert.ok(Object.isFrozen(plain.canvasSize));
  } finally { plain.destroy(); }
  const tall = await createRuntime(tool(HOOKS), host, {}, { canvasSize: { width: 1080, height: 1920 } });
  try { assert.equal(tall.getHydrated(), 'Doc:1080x1920'); } finally { tall.destroy(); }
  // A size that is not two positive lengths is the manifest's.
  for (const bad of [{ width: 0, height: 10 }, { width: Number.NaN, height: 10 }, null]) {
    const rt = await createRuntime(tool(HOOKS), host, {}, { canvasSize: bad });
    try { assert.equal(rt.getHydrated(), 'Doc:1280x720', JSON.stringify(bad)); } finally { rt.destroy(); }
  }
});

test('a tool that follows the size re-lays out, and never writes an input', async () => {
  const rt = await createRuntime(tool(HOOKS, { follows: true }), host);
  try {
    // subscribe calls back once on attach; count only what follows.
    let emits = -1;
    rt.subscribe(() => { emits++; });
    const before = modelToValues(rt.getModel());
    await rt.setCanvasSize({ width: 1080, height: 1920 });
    assert.equal(rt.getHydrated(), 'Doc:1080x1920');
    assert.deepEqual(modelToValues(rt.getModel()), before, 'the size run cannot write an input');
    assert.equal(emits, 1);
    // The same size again does nothing at all.
    await rt.setCanvasSize({ width: 1080, height: 1920 });
    assert.equal(emits, 1);
    // An edit afterwards sees the size too.
    await rt.setInput('title', 'Edited');
    assert.equal(rt.getHydrated(), 'Edited:1080x1920');
    // null goes back to the manifest size.
    await rt.setCanvasSize(null);
    assert.equal(rt.getHydrated(), 'Edited:1280x720');
    const runs = rt.getHydratedString('{{runs}}');
    assert.equal(runs, 'init:1280x720,__canvasSize:1080x1920,title:1080x1920,__canvasSize:1280x720');
  } finally { rt.destroy(); }
});

test('a tool that does not follow the size only records it', async () => {
  const rt = await createRuntime(tool(HOOKS), host);
  try {
    let emits = -1;
    rt.subscribe(() => { emits++; });
    const before = rt.getHydrated();
    await rt.setCanvasSize({ width: 1080, height: 1920 });
    assert.equal(emits, 0, 'no repaint');
    assert.equal(rt.getHydrated(), before, 'the render is what it was');
    assert.equal(rt.getHydratedString('{{runs}}'), 'init:1280x720', 'no hook ran');
    assert.deepEqual(rt.canvasSize, { width: 1080, height: 1920 });
    // The next run the tool gets for its own reasons reads the recorded size.
    await rt.setInput('title', 'Edited');
    assert.equal(rt.getHydrated(), 'Edited:1080x1920');
  } finally { rt.destroy(); }
});

test('templates read the size as @canvasSize, which no input can shadow', async () => {
  const template = '<svg viewBox="0 0 {{@canvasSize.width}} {{@canvasSize.height}}">{{canvasSize}}{{#each items}}<i>{{@canvasSize.width}}</i>{{/each}}</svg>';
  const t = tool(null, { follows: true, template });
  t.manifest.inputs.push({ id: 'canvasSize', type: 'text', default: 'mine' }, { id: 'items', type: 'blocks', fields: [{ id: 'a', type: 'text' }], default: [{ a: '1' }] } as never);
  const rt = await createRuntime(t, host, {}, { canvasSize: { width: 793.7, height: 1122.5 } });
  try {
    assert.equal(rt.getHydrated(), '<svg viewBox="0 0 793.7 1122.5">mine<i>793.7</i></svg>');
    let emits = -1;
    rt.subscribe(() => { emits++; });
    // A template-only tool that follows the size repaints with no hook to run.
    await rt.setCanvasSize({ width: 1080, height: 1920 });
    assert.equal(emits, 1);
    assert.equal(rt.getHydrated(), '<svg viewBox="0 0 1080 1920">mine<i>1080</i></svg>');
  } finally { rt.destroy(); }
});

test('export hooks see the canvas size beside the export\'s own size', async () => {
  const seen: unknown[] = [];
  const exportHost = {
    ...host,
    export: { render: async () => new Blob(['x']) },
    log() {},
  } as unknown as HostV1;
  const source = HOOKS + '\nfunction beforeExport(ctx) { host.log("info", "size", { canvas: ctx.canvasSize, width: ctx.opts.width }); }';
  const rt = await createRuntime(tool(source, { follows: true, exportHooks: true }), {
    ...exportHost, log: (_l: string, msg: string, ctx: unknown) => { if (msg === 'size') seen.push(ctx); },
  } as unknown as HostV1, {}, { canvasSize: { width: 1080, height: 1920 } });
  try {
    await rt.export({} as Element, 'svg', { width: 2160, height: 3840, embedMeta: false });
    assert.deepEqual(seen, [{ canvas: { width: 1080, height: 1920 }, width: 2160 }]);
  } finally { rt.destroy(); }
});

test('a slow size run cannot land over a newer size', async () => {
  let release!: (patch: unknown) => void;
  const gate = new Promise(resolve => { release = resolve; });
  const slowHost = { ...host, net: { fetch: () => gate } } as unknown as HostV1;
  const source = 'function onInit(ctx){return {shape:ctx.canvasSize.width};} function onInput(ctx){ if (ctx.canvasSize.width === 999) return host.net.fetch(); return {shape:ctx.canvasSize.width}; }';
  const rt = await createRuntime(tool(source, { follows: true }), slowHost);
  try {
    const pending = rt.setCanvasSize({ width: 999, height: 10 });
    await rt.setCanvasSize({ width: 500, height: 10 });
    release({ shape: 'stale' });
    await pending;
    await rt.whenSettled();
    assert.equal(rt.getHydrated(), 'Doc:500');
    assert.deepEqual(rt.canvasSize, { width: 500, height: 10 });
  } finally { rt.destroy(); }
});

test('canvasSizeOf gives every shell the same CSS pixels', () => {
  assert.deepEqual(canvasSizeOf(1080, 1920), { width: 1080, height: 1920 });
  assert.deepEqual(canvasSizeOf('1080', '1920'), { width: 1080, height: 1920 });
  // A4 from a unit, and from the qualified strings export options carry.
  const a4 = canvasSizeOf(210, 297, 'mm')!;
  assert.deepEqual(canvasSizeOf('210mm', '297mm'), a4);
  assert.ok(Math.abs(a4.width - 793.7007874015749) < 1e-9 && Math.abs(a4.height - 1122.5196850393702) < 1e-9);
  assert.deepEqual(canvasSizeOf(8.5, 11, 'in'), { width: 816, height: 1056 });
  // A string that carries a unit keeps that unit, whatever the default.
  assert.deepEqual(canvasSizeOf('1in', 96, 'px'), { width: 96, height: 96 });
  // One side, nothing, zero, junk: no size, and the manifest's canvas stays.
  for (const [w, h] of [[1080, undefined], [undefined, undefined], [0, 10], ['wide', 10], [-5, 10], [10, null]] as const) {
    assert.equal(canvasSizeOf(w as never, h as never), null, `${w} x ${h}`);
  }
});
