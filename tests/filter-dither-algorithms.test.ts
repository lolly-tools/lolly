// SPDX-License-Identifier: MPL-2.0
/**
 * Filter - the dither algorithms added from plans/289 item 3 (Atkinson, Bayer
 * 2x2 and 8x8, one-bit fill patterns, error spread, serpentine scan, pattern
 * strength, dot pixels, the RGB cube palettes) and the halftone effect's
 * Atkinson texture and line screen.
 *
 * Run with: node --test tests/filter-dither-algorithms.test.ts
 *
 * Drives the SHIPPED community/filter/hooks.js the way the engine's in-realm
 * executor does (`new Function('host', source)`), with a 2D-canvas double whose
 * getImageData answers a picture chosen per test: a flat colour or a gradient.
 * The sibling suite (filter-dither-ascii-glitch.test.ts) covers determinism and
 * the manifest contract for the original algorithms; this one checks what each
 * new control actually does to the output.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(join(ROOT, 'community', 'filter', 'hooks.js'), 'utf8');
const manifest = JSON.parse(await readFile(join(ROOT, 'community', 'filter', 'tool.json'), 'utf8'));

// The picture every sampled canvas answers with: (x, y, w, h) -> [r, g, b].
type Picture = (x: number, y: number, w: number, h: number) => [number, number, number];
let picture: Picture = () => [128, 128, 128];
const flat = (v: number): Picture => () => [v, v, v];
const gradient: Picture = (x, y, w, h) => [
  Math.round(255 * x / Math.max(1, w - 1)),
  Math.round(255 * y / Math.max(1, h - 1)),
  Math.round(255 * (1 - x / Math.max(1, w - 1)) * 0.6),
];

function makeCanvas() {
  const canvas: Record<string, unknown> = { width: 0, height: 0, toDataURL: () => 'data:image/png;fake' };
  const ctx = {
    canvas, imageSmoothingEnabled: false, imageSmoothingQuality: '',
    drawImage: () => {}, fillRect: () => {}, putImageData: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const [r, g, b] = picture(x, y, w, h);
        const i = (y * w + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
      return { data };
    },
  };
  canvas.getContext = () => ctx;
  return canvas;
}
(globalThis as Record<string, unknown>).document = { createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : {}) };
(globalThis as Record<string, unknown>).ImageData = class {
  data: Uint8ClampedArray; width: number; height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) { this.data = data; this.width = width; this.height = height; }
};

const host = {
  raster: { canRaster: () => true, decode: async (url: string) => ({ naturalWidth: 400, naturalHeight: 300, __still: url }) },
  assets: { get: async (id: string) => ({ id, url: 'blob:demo-default' }) },
  tokens: { colors: async () => [], get: async () => ({ query: () => [] }) },
  log: () => {},
};

async function render(values: Record<string, unknown>, pic: Picture = gradient): Promise<string> {
  picture = pic;
  const tool = new Function('host', `${source}\n;return { onInput: typeof onInput !== 'undefined' ? onInput : null };`)(host);
  const model = Object.entries({ image: null, width: 400, height: 300, ...values }).map(([id, value]) => ({ id, value }));
  const patch = await tool.onInput({ model });
  return String(patch?.svgContent ?? '');
}
const dither = (over: Record<string, unknown>, pic?: Picture) =>
  render({ effect: 'dither', di_palette: 'mono', di_algorithm: 'floyd', di_scale: 10, di_fit: 'cover', ...over }, pic);
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// One fill per cell, in row-major order, for the square-pixel output.
function cellFills(svg: string): string[] {
  return [...svg.matchAll(/<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" fill="(#[0-9a-f]{6})"\/>/g)].map(m => m[1]!);
}
const whiteShare = (fills: string[]) => fills.filter(f => f === '#ffffff').length / fills.length;

test('default controls reproduce the effect exactly as it rendered before they existed', async () => {
  // Recorded from the Floyd-Steinberg and 4x4 Bayer loops before they were
  // generalised into ditherDiffusePalette / ditherOrderedPalette. Error spread
  // 100, serpentine off and pattern strength 22 must keep these bytes.
  assert.equal(sha(await dither({ di_algorithm: 'floyd' })), '52f415caa2f5136b');
  assert.equal(sha(await dither({ di_algorithm: 'ordered' })), '7e0536f44f78e2d4');
  assert.equal(sha(await dither({ di_algorithm: 'floyd', di_diffusion: 100, di_serpentine: false })), '52f415caa2f5136b');
  assert.equal(sha(await dither({ di_algorithm: 'ordered', di_strength: 22 })), '7e0536f44f78e2d4');
});

test('Atkinson is its own look, deterministic, and keeps highlights and shadows cleaner than Floyd-Steinberg', async () => {
  const atk = await dither({ di_algorithm: 'atkinson' });
  assert.equal(atk, await dither({ di_algorithm: 'atkinson' }));
  assert.notEqual(atk, await dither({ di_algorithm: 'floyd' }));
  // Near-white: Atkinson drops the last 2/8 of the error, so a light flat tone
  // stays solid white where Floyd-Steinberg keeps sprinkling black dots into the tone.
  const light = flat(235);
  const atkLight = whiteShare(cellFills(await dither({ di_algorithm: 'atkinson' }, light)));
  const fsLight = whiteShare(cellFills(await dither({ di_algorithm: 'floyd' }, light)));
  assert.ok(atkLight > fsLight, `Atkinson ${atkLight} should be whiter than Floyd-Steinberg ${fsLight}`);
});

test('error spread 0 is a plain nearest-colour snap, the same as pattern strength 0', async () => {
  const noDiffusion = await dither({ di_algorithm: 'floyd', di_diffusion: 0 });
  const noPattern = await dither({ di_algorithm: 'ordered', di_strength: 0 });
  assert.equal(noDiffusion, noPattern);
  assert.equal(await dither({ di_algorithm: 'atkinson', di_diffusion: 0 }), noPattern);
  // A partial spread sits between the two extremes.
  assert.notEqual(await dither({ di_algorithm: 'floyd', di_diffusion: 50 }), noDiffusion);
});

test('serpentine scan changes the diffusion and stays deterministic', async () => {
  const serp = await dither({ di_algorithm: 'floyd', di_serpentine: true });
  assert.equal(serp, await dither({ di_algorithm: 'floyd', di_serpentine: true }));
  assert.notEqual(serp, await dither({ di_algorithm: 'floyd', di_serpentine: false }));
  // On a flat tone the diffused share of white cells stays close either way.
  const tone = flat(170);
  const a = whiteShare(cellFills(await dither({ di_algorithm: 'floyd', di_serpentine: true }, tone)));
  const b = whiteShare(cellFills(await dither({ di_algorithm: 'floyd', di_serpentine: false }, tone)));
  assert.ok(Math.abs(a - b) < 0.05, `${a} vs ${b}`);
});

test('Bayer sizes tile with their own period on a flat tone', async () => {
  // 400x300 at scale 10 is a 40x30 grid.
  const cols = 40;
  for (const [alg, size] of [['bayer2', 2], ['ordered', 4], ['bayer8', 8]] as const) {
    const fills = cellFills(await dither({ di_algorithm: alg, di_strength: 100 }, flat(100)));
    assert.equal(fills.length, cols * 30);
    let mixed = false;
    for (let r = 0; r < 30; r++) for (let c = 0; c < cols; c++) {
      const v = fills[r * cols + c];
      if (c + size < cols) assert.equal(v, fills[r * cols + c + size], `${alg} repeats every ${size} columns`);
      if (r + size < 30) assert.equal(v, fills[(r + size) * cols + c], `${alg} repeats every ${size} rows`);
      if (v !== fills[0]) mixed = true;
    }
    assert.ok(mixed, `${alg} at full strength draws a pattern, not a flat fill`);
  }
});

test('fill patterns: black and white stay solid, a mid tone draws an 8x8 one-bit pattern', async () => {
  const black = cellFills(await dither({ di_algorithm: 'patterns' }, flat(0)));
  assert.ok(black.every(f => f === '#000000'));
  const white = cellFills(await dither({ di_algorithm: 'patterns' }, flat(255)));
  assert.ok(white.every(f => f === '#ffffff'));
  const mid = cellFills(await dither({ di_algorithm: 'patterns' }, flat(140)));
  const share = whiteShare(mid);
  assert.ok(share > 0.2 && share < 0.9, `mid tone share ${share}`);
  for (let r = 0; r + 8 < 30; r++) for (let c = 0; c + 8 < 40; c++) {
    assert.equal(mid[r * 40 + c], mid[r * 40 + c + 8]);
    assert.equal(mid[r * 40 + c], mid[(r + 8) * 40 + c]);
  }
});

test('fill patterns mix the two palette colours that explain the tone', async () => {
  // On a 4-step grey palette a tone between two steps mixes those two steps.
  const fills = new Set(cellFills(await dither({ di_algorithm: 'patterns', di_palette: 'gray4' }, flat(100))));
  assert.deepEqual([...fills].sort(), ['#555555', '#aaaaaa']);
});

test('dot pixels draw circles on the palette\'s darkest colour and skip cells of that colour', async () => {
  const svg = await dither({ di_algorithm: 'floyd', di_palette: 'handheld4', di_pixelShape: 'dot' });
  assert.match(svg, /<rect width="400" height="300" fill="#0f380f"\/>/);
  const circles = [...svg.matchAll(/<circle cx="[^"]*" cy="[^"]*" r="4\.2" fill="(#[0-9a-f]{6})"\/>/g)].map(m => m[1]);
  assert.ok(circles.length > 0 && circles.length < 40 * 30);
  assert.ok(!circles.includes('#0f380f'), 'no dot is drawn in the gap colour');
  assert.doesNotMatch(svg, /<rect x=/, 'no square pixels in dot mode');
});

test('the RGB cube palettes have 8 and 27 distinct colours', async () => {
  for (const [id, count] of [['rgb8', 8], ['rgb27', 27]] as const) {
    const fills = new Set(cellFills(await dither({ di_palette: id, di_scale: 2 })));
    assert.ok(fills.size <= count && fills.size >= Math.min(count, 6), `${id}: ${fills.size}`);
    for (const f of fills) assert.match(f, /^#(00|80|ff){3}$/);
  }
});

test('halftone: the Atkinson texture is its own look, and the line shape draws full-width bars', async () => {
  const base = { effect: 'halftone', ht_gridSize: 30, ht_shape: 'circle' };
  const atk = await render({ ...base, ht_dither: 'atkinson' });
  assert.equal(atk, await render({ ...base, ht_dither: 'atkinson' }));
  assert.notEqual(atk, await render({ ...base, ht_dither: 'floyd' }));
  const lines = await render({ ...base, ht_shape: 'line' });
  assert.doesNotMatch(lines, /<circle/);
  const widths = new Set([...lines.matchAll(/<rect x="[^"]*" y="[^"]*" width="([^"]*)" height="[^"]*"\/>/g)].map(m => m[1]));
  assert.equal(widths.size, 1, 'every bar is one cell wide, so neighbours join into lines');
});

test('manifest: the new dither controls are gated to the algorithms they affect', () => {
  const byId = Object.fromEntries(manifest.inputs.map((i: { id: string }) => [i.id, i]));
  const algorithms = byId.di_algorithm.options.map((o: { value: string }) => o.value);
  for (const v of ['floyd', 'atkinson', 'ordered', 'bayer2', 'bayer8', 'patterns', 'noise']) assert.ok(algorithms.includes(v), v);
  assert.deepEqual(byId.di_diffusion.showIf, { effect: 'dither', di_algorithm: ['floyd', 'atkinson'] });
  assert.deepEqual(byId.di_serpentine.showIf, { effect: 'dither', di_algorithm: ['floyd', 'atkinson'] });
  assert.deepEqual(byId.di_strength.showIf, { effect: 'dither', di_algorithm: ['ordered', 'bayer2', 'bayer8'] });
  assert.equal(byId.di_diffusion.default, 100);
  assert.equal(byId.di_serpentine.default, false);
  assert.equal(byId.di_strength.default, 22);
  assert.equal(byId.di_pixelShape.default, 'square');
  const palettes = byId.di_palette.options.map((o: { value: string }) => o.value);
  assert.ok(palettes.includes('rgb8') && palettes.includes('rgb27'));
  assert.equal(palettes[palettes.length - 1], 'brand', 'the design system palette stays last');
  assert.ok(byId.ht_dither.options.some((o: { value: string }) => o.value === 'atkinson'));
  assert.ok(byId.ht_shape.options.some((o: { value: string }) => o.value === 'line'));
});
