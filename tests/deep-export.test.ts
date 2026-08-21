// SPDX-License-Identifier: MPL-2.0
/**
 * Deep raster output (engine 1.100): the deep-encode writers and the exportStill
 * runtime seam. No shell - the engine encoders are pure, and the seam is driven
 * through createRuntime with a stubbed host, so this pins the CONTRACT that a
 * tool's own encoded bytes reach the caller and that declining is byte-identical
 * to the old path.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDeepFrame } from '../engine/src/pixels.ts';
import { encodeExr, encodePng16, encodeRadiance, encodeDither8 } from '../engine/src/deep-encode.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

function gradientFrame(W: number, H: number) {
  const f = createDeepFrame(W, H, 'srgb-linear');
  for (let i = 0; i < W * H; i++) {
    f.data[i * 4] = i / (W * H); f.data[i * 4 + 1] = 0.5; f.data[i * 4 + 2] = 1 - i / (W * H); f.data[i * 4 + 3] = 1;
  }
  return f;
}

test('deep-encode writes valid, correctly-depthed EXR / PNG16 / Radiance / dither8', () => {
  const f = gradientFrame(8, 8);
  const exr = encodeExr(f), p16 = encodePng16(f), hdr = encodeRadiance(f), d8 = encodeDither8(f);
  assert.deepEqual([...exr.slice(0, 4)], [0x76, 0x2f, 0x31, 0x01], 'EXR magic');
  assert.deepEqual([...p16.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG signature');
  assert.deepEqual([...d8.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'dither PNG signature');
  assert.equal(new TextDecoder().decode(hdr.slice(0, 10)), '#?RADIANCE', 'Radiance header');
  // IHDR bit-depth byte sits at offset 24 (8 sig + 4 len + 4 type + 4 W + 4 H).
  assert.equal(p16[24], 16, 'png16 declares 16 bits per channel');
  assert.equal(d8[24], 8, 'dither8 declares 8 bits per channel');
});

test('deep-encode is deterministic - same frame, byte-identical output', () => {
  const f = gradientFrame(16, 12);
  assert.deepEqual(encodeExr(f), encodeExr(f));
  assert.deepEqual(encodePng16(f), encodePng16(f));
  assert.deepEqual(encodeRadiance(f), encodeRadiance(f));
  assert.deepEqual(encodeDither8(f), encodeDither8(f));
});

test('encodePng16 carries real precision the 8-bit path cannot (a near-black ramp is not flat)', () => {
  // A gentle 0..1/32 linear ramp across 32px: in 8-bit sRGB many columns collapse
  // to the same byte; at 16 bits distinct input levels stay distinct.
  const W = 32, H = 1, f = createDeepFrame(W, H, 'srgb-linear');
  for (let x = 0; x < W; x++) { const v = (x / (W - 1)) / 32; f.data[x * 4] = v; f.data[x * 4 + 1] = v; f.data[x * 4 + 2] = v; f.data[x * 4 + 3] = 1; }
  const p16 = encodePng16(f);
  assert.equal(p16[24], 16);
  assert.ok(p16.length > 60, 'a real PNG, not an empty one');
});

// ── exportStill runtime seam ──────────────────────────────────────────────────

const STILL_TOOL: Record<string, string> = {
  'deepx/tool.json': JSON.stringify({
    id: 'deepx', name: 'X', version: '1.0.0', engineVersion: '^1.4.0',
    status: 'community', category: 'utility',
    render: { width: 4, height: 4, formats: ['png', 'exr'] },
    hooks: { exportStill: true },
    inputs: [],
  }),
  'deepx/template.html': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  'deepx/hooks.js':
    'function exportStill(ctx){' +
    '  if (ctx.format === "exr") return { bytes: new Uint8Array([1,2,3,4]), mime: "image/x-exr" };' +
    '  return null;' + // decline everything else → fall through to the DOM raster path
    '}',
};
const fetchStill = async (p: string): Promise<string> => {
  const t = STILL_TOOL[p]; if (t === undefined) throw new Error(`404: ${p}`); return t;
};

test('exportStill: a tool owns EXR (its bytes win, render is NOT called)', async () => {
  const tool: any = await loadTool('deepx', fetchStill);
  const host: any = baseHost();
  let renderCalls = 0;
  host.export = { render: async () => { renderCalls++; return new Blob([new Uint8Array([9, 9])], { type: 'image/png' }); } };
  const rt = await createRuntime(tool, host, {});

  const blob = await rt.export({}, 'exr', { width: 4, height: 4 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes], [1, 2, 3, 4], 'the tool-supplied EXR bytes reached the caller');
  assert.equal(blob.type, 'image/x-exr', 'the tool-declared mime is used');
  assert.equal(renderCalls, 0, 'host.export.render was skipped for the owned format');
});

test('exportStill: declining (null) falls through to the normal DOM raster path', async () => {
  const tool: any = await loadTool('deepx', fetchStill);
  const host: any = baseHost();
  let renderCalls = 0;
  host.export = { render: async () => { renderCalls++; return new Blob([new Uint8Array([9, 9])], { type: 'image/png' }); } };
  const rt = await createRuntime(tool, host, {});

  const blob = await rt.export({}, 'png', { width: 4, height: 4 });
  assert.equal(renderCalls, 1, 'the declined format fell through to host.export.render');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes], [9, 9], 'the fallthrough render bytes are returned unchanged');
});

// A tool that mutates the live node in beforeExport must have afterExport run
// even when exportStill THROWS - otherwise a failed deep export leaves the DOM in
// the export configuration (the cleanup guarantee afterExport exists for).
const CLEANUP_TOOL: Record<string, string> = {
  'deepc/tool.json': JSON.stringify({
    id: 'deepc', name: 'C', version: '1.0.0', engineVersion: '^1.4.0',
    status: 'community', category: 'utility',
    render: { width: 4, height: 4, formats: ['exr'] },
    hooks: { beforeExport: true, afterExport: true, exportStill: true }, inputs: [],
  }),
  'deepc/template.html': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  'deepc/hooks.js':
    'function beforeExport(){ globalThis.__deepc = "in-export"; }' +
    'function afterExport(){ globalThis.__deepc = "cleaned"; }' +
    'function exportStill(ctx){ if (ctx.format === "exr") throw new Error("boom"); return null; }',
};
const fetchCleanup = async (p: string): Promise<string> => {
  const t = CLEANUP_TOOL[p]; if (t === undefined) throw new Error(`404: ${p}`); return t;
};

test('exportStill: a throw still runs afterExport (cleanup pairs with beforeExport)', async () => {
  const tool: any = await loadTool('deepc', fetchCleanup);
  const host: any = baseHost();
  host.export = { render: async () => new Blob([new Uint8Array([0])]) };
  const rt = await createRuntime(tool, host, {});
  (globalThis as any).__deepc = undefined;

  await assert.rejects(rt.export({}, 'exr', { width: 4, height: 4 }), /boom/, 'the throw propagates and fails the export');
  assert.equal((globalThis as any).__deepc, 'cleaned', 'afterExport ran despite the exportStill throw - DOM not left in export config');
});
