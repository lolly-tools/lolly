// SPDX-License-Identifier: MPL-2.0
/**
 * Filter dispatcher — live-frame persistence across parameter edits.
 *
 * Run with: node --test tests/filter-live-input-persistence.test.ts
 *
 * The bug this pins (Andy, 2026-08-10): with the live camera (or an animated
 * asset) driving the filter, changing a parameter like dot size FLASHED the
 * placeholder/demo still — onInput re-ran the STILL pipeline against the image
 * input (empty → the demo asset), and the live frame only came back on the next
 * tick. The fix lives in the unified dispatcher (community/filter/hooks.js
 * _run): while a live frame is cached, onInput/onInit REPLAY that frame through
 * the effect's own onFrame with the new parameters, and the cache is dropped the
 * moment the image source itself changes — so picking a new image still lands on
 * the still path.
 *
 * Drives the SHIPPED hooks.js exactly the way the engine's in-realm executor
 * does (new Function('host', source)), with a minimal 2D-canvas double so the
 * real pixel pipeline runs headless: decoded stills sample mid-grey, live frames
 * sample black — making the two render paths distinguishable in the emitted SVG.
 * The routing marker is structural and exact: every still-path patch carries an
 * `imgKey` property (the auto-fit channel), onFrame-shaped patches never do.
 *
 * Also pinned here (same harness, 2026-08-10):
 *   - live cell budgets equal the still budgets for halftone + scanline, so the
 *     user's grid/line choice is never silently rescaled while live (the old
 *     smaller live caps put an unexplained ~14px floor under "Grid size");
 *   - posterize's `pz_bgColor` paper override ('' = the legacy lightest-swatch
 *     paper, so existing sessions render unchanged);
 *   - a VIDEO pick renders a "Press ▶ Play" instruction (not a broken-image
 *     error) until live frames arrive, then edits replay the frame as usual.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HOOKS_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'community', 'filter', 'hooks.js');
const source = await readFile(HOOKS_PATH, 'utf8');

// ── DOM double: exactly the surface sampleGrid/onFrame touch ─────────────────
// drawImage records its source; getImageData answers from what was drawn last —
// black for a live-frame canvas (marked by putImageData), mid-grey for a decoded
// still. That difference is what lets the assertions tell the two paths apart.
type FakeCanvas = { width: number; height: number; __frame?: boolean; getContext: (kind: string, opts?: unknown) => FakeCtx | null };
type FakeCtx = {
  canvas: FakeCanvas;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: string;
  clearRect: (...rest: number[]) => void;
  drawImage: (img: unknown, ...rest: number[]) => void;
  getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray };
  putImageData: (img: { data: Uint8ClampedArray }, x: number, y: number) => void;
};

function makeCanvas(): FakeCanvas {
  let lastDrawn: unknown = null;
  const canvas: FakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
  };
  const ctx: FakeCtx = {
    canvas,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: '',
    clearRect: () => { /* posterize clears its sample canvas between passes */ },
    drawImage: (img) => { lastDrawn = img; },
    getImageData: (_x, _y, w, h) => {
      const fromFrame = Boolean((lastDrawn as { __frame?: boolean } | null)?.__frame);
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < data.length; i += 4) {
        const v = fromFrame ? 0 : 128; // live frame samples black, stills mid-grey
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
      return { data };
    },
    putImageData: () => { canvas.__frame = true; },
  };
  return canvas;
}

(globalThis as Record<string, unknown>).document = { createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : { }) };
(globalThis as Record<string, unknown>).ImageData = class {
  data: Uint8ClampedArray; width: number; height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) { this.data = data; this.width = width; this.height = height; }
};

// ── Host double ──────────────────────────────────────────────────────────────
const decoded: string[] = [];
const host = {
  raster: {
    canRaster: () => true,
    decode: async (url: string) => { decoded.push(url); return { naturalWidth: 8, naturalHeight: 8, __still: url }; },
  },
  assets: { get: async (id: string) => ({ id, url: 'blob:demo-default' }) },
  log: () => {},
};

// Load the shipped hooks the way the engine's in-realm executor does.
const load = new Function('host', `${source}
;return {
  onInit:  typeof onInit  !== 'undefined' ? onInit  : null,
  onInput: typeof onInput !== 'undefined' ? onInput : null,
  onFrame: typeof onFrame !== 'undefined' ? onFrame : null,
};`) as (h: unknown) => {
  onInit: (ctx: unknown) => unknown;
  onInput: (ctx: unknown) => unknown;
  onFrame: (ctx: unknown) => unknown;
};

type Patch = { svgContent?: string; imgKey?: string } | null | undefined;
const row = (id: string, value: unknown) => ({ id, value });
function model(over: Record<string, unknown> = {}): Array<{ id: string; value: unknown }> {
  const base: Record<string, unknown> = {
    effect: 'halftone', image: null, width: 1000, height: 1000,
    ht_gridSize: 10, ht_dotScale: 1, ht_shape: 'circle', ht_colorSource: 'solid',
    ht_fgColor: '#111111', ht_bgColor: '#ffffff', ht_fit: 'contain',
    ...over,
  };
  return Object.entries(base).map(([id, value]) => row(id, value));
}
const FRAME = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4, t: 1000 };

const hooks = load(host);

test('still → live → param edit: the edit re-renders the LIVE frame, not the still', async () => {
  const still = await hooks.onInit({ model: model(), host }) as Patch;
  assert.ok(still?.svgContent, 'still path rendered');
  assert.equal(still!.imgKey, '', 'demo default renders through the still path (imgKey present, empty)');
  assert.ok(decoded.includes('blob:demo-default'), 'the demo asset was decoded');

  const live = await hooks.onFrame({ model: model(), frame: FRAME, host }) as Patch;
  assert.ok(live?.svgContent, 'live frame rendered');
  assert.notEqual(live!.svgContent, still!.svgContent, 'black frame renders differently from the grey still');
  assert.equal('imgKey' in live!, false, 'onFrame patches never carry the auto-fit key');

  // The regression: this used to return the STILL (demo) render → placeholder flash.
  const edited = await hooks.onInput({ model: model({ ht_gridSize: 20 }), id: 'ht_gridSize', value: 20, host }) as Patch;
  assert.ok(edited?.svgContent);
  assert.equal('imgKey' in edited!, false, 'the edit was routed through onFrame (no still-path marker)');
  assert.notEqual(edited!.svgContent, still!.svgContent, 'not the still render');

  // And it renders EXACTLY what replaying the cached frame at the new params gives.
  const replay = await hooks.onFrame({ model: model({ ht_gridSize: 20 }), frame: FRAME, host }) as Patch;
  assert.equal(edited!.svgContent, replay!.svgContent, 'byte-identical to an onFrame replay of the frozen frame');
});

test('switching effect mid-live keeps the frozen frame (dispatcher-level cache)', async () => {
  await hooks.onFrame({ model: model(), frame: FRAME, host });
  const sc = await hooks.onInput({ model: model({ effect: 'scanline' }), id: 'effect', value: 'scanline', host }) as Patch;
  assert.ok(sc?.svgContent, 'scanline rendered the cached frame');
  assert.equal('imgKey' in sc!, false, 'routed through scanline’s onFrame, not its still path');
});

test('picking a NEW image drops the live frame and returns to the still path', async () => {
  await hooks.onFrame({ model: model(), frame: FRAME, host });

  const pickRef = { url: 'blob:user-pick', type: 'raster', format: 'png' };
  const picked = model({ image: pickRef });
  const p = await hooks.onInput({ model: picked, id: 'image', value: pickRef, host }) as Patch;
  assert.equal(p!.imgKey, 'blob:user-pick', 'a source swap lands on the still path (auto-fit key = the pick)');
  assert.ok(decoded.includes('blob:user-pick'), 'the picked image was decoded');

  // A later param edit stays on the still path — the cached frame is gone.
  const p2 = await hooks.onInput({ model: model({ image: { url: 'blob:user-pick' }, ht_gridSize: 24 }), id: 'ht_gridSize', value: 24, host }) as Patch;
  assert.equal(p2!.imgKey, 'blob:user-pick', 'no stale live frame resurfaces after the swap');
});

// ── Live cell budgets: the user's grid choice wins (Andy, 2026-08-10) ─────────
// The old smaller live budgets (halftone 6000, scanline 8000) silently RESCALED
// the grid, so "Grid size"/"Line height" bottomed out (~14 on a typical canvas)
// while live. Both live caps now equal the still caps, so live geometry matches
// the still at the same params and a fine grid just plays at a lower fps.

const countOf = (svg: string, re: RegExp): number => (svg.match(re) ?? []).length;

test('halftone: a fine live grid is not rescaled — live emits the same dot grid as the still', async () => {
  const h = load(host);
  // gridSize 8 on a 1000×1000 canvas = 125×125 = 15 625 cells: inside the still
  // budget (26 000), far above the OLD live budget (6 000).
  const still = await h.onInit({ model: model({ ht_gridSize: 8 }), host }) as Patch;
  const live = await h.onFrame({ model: model({ ht_gridSize: 8 }), frame: FRAME, host }) as Patch;
  const stillDots = countOf(still!.svgContent!, /<circle /g);
  const liveDots = countOf(live!.svgContent!, /<circle /g);
  assert.ok(stillDots > 10_000, `still grid is fine (${stillDots} dots)`);
  assert.equal(liveDots, stillDots, 'live grid geometry matches the still exactly (no hidden floor)');
});

test('scanline: a fine live grid is not rescaled either', async () => {
  const h = load(host);
  // lineSize 6 on 1000×1000 ≈ 27 556 cells: inside the still budget (100 000),
  // far above the OLD live budget (8 000).
  const m = (over: Record<string, unknown> = {}) => model({ effect: 'scanline', sc_lineSize: 6, sc_gapSize: 2, ...over });
  const still = await h.onInit({ model: m(), host }) as Patch;
  const live = await h.onFrame({ model: m(), frame: FRAME, host }) as Patch;
  // Scanline emits one `M…h…v…z` subpath per cell inside merged <path> runs.
  const stillCells = countOf(still!.svgContent!, /M[-\d.]+ [-\d.]+h/g);
  const liveCells = countOf(live!.svgContent!, /M[-\d.]+ [-\d.]+h/g);
  assert.ok(stillCells > 10_000, `still grid is fine (${stillCells} cells)`);
  assert.equal(liveCells, stillCells, 'live scanline geometry matches the still exactly');
});

// ── Background override for posterize (pz_bgColor → view `bgColor`) ───────────

test('posterize: pz_bgColor overrides the paper rect; empty keeps the palette paper', async () => {
  const h = load(host);
  const withBg = await h.onInput({
    model: model({ effect: 'posterize', pz_bgColor: '#123456' }), id: 'pz_bgColor', value: '#123456', host,
  }) as Patch;
  assert.ok(withBg?.svgContent, 'posterize rendered');
  assert.match(withBg!.svgContent!, /<rect[^>]+fill="#123456"/, 'the paper rect takes the override');

  const without = await h.onInput({
    model: model({ effect: 'posterize', pz_bgColor: '' }), id: 'pz_bgColor', value: '', host,
  }) as Patch;
  assert.ok(without?.svgContent);
  assert.doesNotMatch(without!.svgContent!, /#123456/, 'empty = the legacy palette-derived paper');
});

// ── Video picks: an instruction, never a broken-image error ───────────────────

test('a video pick renders the Play instruction until frames arrive, then routes live', async () => {
  const h = load(host);
  const vm = (over: Record<string, unknown> = {}) =>
    model({ image: { url: 'blob:clip', type: 'video', format: 'mp4' }, ...over });
  const still = await h.onInit({ model: vm(), host }) as Patch;
  assert.match(still!.svgContent!, /Press ▶ Play/, 'a frame-less video pick explains itself');
  assert.doesNotMatch(still!.svgContent!, /Could not read this image/);

  await h.onFrame({ model: vm(), frame: FRAME, host });
  const edited = await h.onInput({ model: vm({ ht_gridSize: 18 }), id: 'ht_gridSize', value: 18, host }) as Patch;
  assert.doesNotMatch(edited!.svgContent!, /Press ▶ Play/, 'once frames flowed, edits replay the frame');
  assert.equal('imgKey' in edited!, false, 'routed through onFrame, not the still path');
});
