// SPDX-License-Identifier: MPL-2.0
/**
 * Trace image: the image-trace WASM module (through the Node loader) and the pure engine
 * module that turns its output into Design paths.
 *
 * Run with: node --test tests/image-trace.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  IMAGE_TRACE_MAX_PIXELS, ImageTraceError, imageTraceToPaths, imageTraceView, imageTraceWorkSize, readImageTraceWire, traceImage,
} from '../engine/src/image-trace.ts';
import { loadImageTraceKernel } from '../packages/node-shell/src/image-trace-node.ts';
import { createImageTraceKernel } from '../packages/node-shell/src/image-trace.ts';
import { SMALL_FIXTURES, illustrationFixture, logoFixture } from './helpers/image-trace-fixtures.ts';

const kernel = await loadImageTraceKernel();
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

test('every preset traces its fixture to paths with colours', () => {
  for (const f of SMALL_FIXTURES()) {
    const r = kernel.trace(f.rgba, f.width, f.height, f.preset);
    assert.ok(r.shapes.length > 0, f.name);
    assert.equal(r.width, f.width);
    if (f.preset === 'centreline') assert.ok(r.shapes.some(s => s.stroke !== undefined), 'centre lines are strokes');
    else assert.ok(r.shapes.every(s => s.stroke === undefined), 'other presets are fills');
  }
});

test('the logo preset finds the flat colours and nothing else of note', () => {
  const f = logoFixture();
  const colours = new Set(kernel.trace(f.rgba, f.width, f.height, 'logo').shapes.map(s => s.color.join(',')));
  assert.ok(colours.has('30,90,200') && colours.has('220,40,60') && colours.has('240,200,40'), [...colours].join(' | '));
});

test('the same pixels and preset give identical bytes, twice in one module and in a fresh one', async () => {
  const fresh = await createImageTraceKernel(new Uint8Array(readFileSync(new URL('../packages/node-shell/wasm/image-trace/image-trace.wasm', import.meta.url))));
  for (const f of [...SMALL_FIXTURES(), illustrationFixture(120, 80)]) {
    const a = kernel.traceBytes(f.rgba, f.width, f.height, f.preset);
    const b = kernel.traceBytes(f.rgba, f.width, f.height, f.preset);
    const c = fresh.traceBytes(f.rgba, f.width, f.height, f.preset);
    assert.equal(sha(a), sha(b), `${f.name}: second run`);
    assert.equal(sha(a), sha(c), `${f.name}: fresh module`);
  }
});

test('a colour image with many tones (k-means seeding) traces to the same bytes every time', () => {
  const w = 96, h = 96, px = new Uint8Array(w * h * 4);
  let s = 7;
  for (let i = 0; i < w * h; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    px[i * 4] = (i % w) * 2 + (s >>> 28); px[i * 4 + 1] = Math.floor(i / w) * 2; px[i * 4 + 2] = (s >>> 20) & 255; px[i * 4 + 3] = 255;
  }
  const runs = new Set(Array.from({ length: 3 }, () => sha(kernel.traceBytes(px, w, h, 'illustration'))));
  assert.equal(runs.size, 1);
});

test('the pixel cap refuses an oversize image with a clear message', () => {
  assert.throws(() => kernel.trace(new Uint8Array(4), 2048, 2049, 'logo'), (e: unknown) => e instanceof ImageTraceError && /too large/.test(e.message));
  assert.throws(() => kernel.traceBytes(new Uint8Array(4), 1, 1, 'logo' as never) && kernel.traceBytes(new Uint8Array(4), 1, 1, 'bogus' as never), ImageTraceError);
});

test('the module itself refuses an oversize header, a wrong length and an empty image', async () => {
  // Bypass the wrapper's checks by driving the raw ABI.
  const wasm = new Uint8Array(readFileSync(new URL('../packages/node-shell/wasm/image-trace/image-trace.wasm', import.meta.url)));
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  const x = instance.exports as unknown as {
    memory: WebAssembly.Memory; image_trace_alloc(n: number): number; image_trace_free(p: number): void;
    image_trace_run(p: number, n: number, op: number): number; image_trace_result_ptr(): number; image_trace_result_len(): number;
  };
  const call = (w: number, h: number, pixels: number, op = 1): { status: number; text: string } => {
    const len = 8 + pixels;
    const p = x.image_trace_alloc(len);
    assert.ok(p);
    const dv = new DataView(x.memory.buffer, p, len); dv.setUint32(0, w, true); dv.setUint32(4, h, true);
    const status = x.image_trace_run(p, len, op);
    const text = new TextDecoder().decode(new Uint8Array(x.memory.buffer, x.image_trace_result_ptr(), x.image_trace_result_len()));
    x.image_trace_free(p);
    return { status, text };
  };
  const big = call(4096, 4096, 16);
  assert.equal(big.status, 1); assert.match(big.text, /more than the 4 million pixels/);
  const wrong = call(10, 10, 12);
  assert.equal(wrong.status, 1); assert.match(wrong.text, /does not match/);
  assert.equal(call(0, 10, 12).status, 1);
  assert.equal(call(2, 2, 16, 99).status, 1);
  assert.equal(x.image_trace_alloc(0), 0);
  assert.equal(x.image_trace_alloc(1 << 30), 0);
  assert.equal(x.image_trace_run(123456, 8, 1), 1);
  assert.equal(new TextDecoder().decode(new Uint8Array(x.memory.buffer, x.image_trace_result_ptr(), x.image_trace_result_len())), 'Invalid request buffer');
});

test('malformed input is refused by the wrapper without reaching the module', () => {
  assert.throws(() => kernel.trace(new Uint8Array(15), 2, 2, 'logo'), /does not match/);
  assert.throws(() => kernel.trace(new Uint8Array(0), 0, 0, 'logo'), /no size/);
  assert.throws(() => kernel.trace(new Uint8Array(16), 1.5, 2, 'logo'), /no size/);
});

test('a logo trace of a photograph says so in plain words', () => {
  const w = 64, h = 64, px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { px[i * 4] = (i % w) * 4; px[i * 4 + 1] = Math.floor(i / w) * 4; px[i * 4 + 2] = ((i * 37) % 251); px[i * 4 + 3] = 255; }
  try { kernel.trace(px, w, h, 'logo'); } catch (e) { assert.ok(e instanceof ImageTraceError); assert.doesNotMatch(e.message, /Flat Logo|Color mode/); }
});

test('a blank and a fully transparent image trace to nothing or a plain refusal, never a crash', () => {
  for (const alpha of [0, 255]) {
    const px = new Uint8Array(32 * 32 * 4).fill(alpha === 255 ? 255 : 0);
    try { assert.ok(kernel.trace(px, 32, 32, 'illustration').shapes.length <= 1); } catch (e) { assert.ok(e instanceof ImageTraceError); }
  }
});

test('traceImage checks size and length before it calls the shell function', async () => {
  let called = 0;
  const fn = () => { called++; return { width: 1, height: 1, shapes: [] }; };
  await assert.rejects(traceImage(fn, new Uint8Array(4), 2049, 2049, 'logo'), /too large/);
  await assert.rejects(traceImage(fn, new Uint8Array(3), 1, 1, 'logo'), /does not match/);
  assert.equal(called, 0);
  assert.deepEqual(await traceImage(fn, new Uint8Array(4), 1, 1, 'logo'), { width: 1, height: 1, shapes: [] });
});

test('readImageTraceWire refuses malformed module output', () => {
  const bad: unknown[] = [null, {}, { w: 1, h: 1, paths: 3 }, { w: 1, h: 1, paths: [{ c: [1, 2], d: [] }] },
    { w: 1, h: 1, paths: [{ c: [1, 2, 3], d: [[1, 0, 0, 0, 0]] }] }, { w: 1, h: 1, paths: [{ c: [1, 2, 300], d: [] }] },
    { w: 1, h: 1, paths: [{ c: [1, 2, 3], d: [[1, 0, 0, 0, 0, 0, NaN]] }] }];
  for (const b of bad) assert.throws(() => readImageTraceWire(b), ImageTraceError);
  const ok = readImageTraceWire({ w: 4, h: 4, paths: [{ c: [1, 2, 3], d: [[1, 0, 0, 0, 0, 0, 0, 4, 0, 4, 0, 4, 0]] }] });
  assert.equal(ok.shapes[0]!.subpaths[0]!.anchors.length, 12);
});

test('traced shapes become canvas-space contours with a paint', () => {
  const f = logoFixture(80);
  const paths = imageTraceToPaths(kernel.trace(f.rgba, f.width, f.height, 'logo'), { x: 100, y: 50, w: 160, h: 160 });
  assert.ok(paths.length >= 3);
  for (const p of paths) {
    assert.match(p.paint.fill ?? '', /^#[0-9a-f]{6}$/);
    for (const c of p.path) for (const cu of c.curves) {
      for (let i = 0; i < 8; i += 2) { assert.ok(cu[i]! >= 99 && cu[i]! <= 261, `x ${cu[i]}`); assert.ok(cu[i + 1]! >= 49 && cu[i + 1]! <= 211, `y ${cu[i + 1]}`); }
    }
  }
});

test('image placement follows fit and position', () => {
  const box = { x: 10, y: 20, w: 200, h: 100 };
  assert.deepEqual(imageTraceView(box, 100, 100, 'fill').placed, box);
  const contain = imageTraceView(box, 100, 100, 'contain');
  assert.deepEqual(contain.placed, { x: 60, y: 20, w: 100, h: 100 });
  assert.deepEqual(imageTraceView(box, 100, 100, 'contain', 'left top').placed, { x: 10, y: 20, w: 100, h: 100 });
  const cover = imageTraceView(box, 100, 100, 'cover');
  assert.deepEqual(cover.crop, { x: 0, y: 25, w: 100, h: 50 });
  assert.deepEqual(cover.placed, box);
  assert.throws(() => imageTraceView({ x: 0, y: 0, w: 0, h: 5 }, 10, 10, 'fill'), ImageTraceError);
  const size = imageTraceWorkSize(6000, 4000);
  assert.ok(size.width <= 1500 && size.width * size.height <= IMAGE_TRACE_MAX_PIXELS);
  assert.deepEqual(imageTraceWorkSize(300, 200), { width: 300, height: 200 });
});
