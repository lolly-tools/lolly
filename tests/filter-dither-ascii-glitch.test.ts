// SPDX-License-Identifier: MPL-2.0
/**
 * Filter - dither / ascii / glitch effects (plans/107 follow-on).
 *
 * Run with: node --test tests/filter-dither-ascii-glitch.test.ts
 *
 * Three new top-level `effect` values added to the unified filter tool
 * (community/filter). Covers what the review brief calls out specifically:
 *
 *   - determinism: the SAME model rendered twice (even across two independent
 *     `hooks.js` loads) produces a BYTE-IDENTICAL svgContent string, for all
 *     three effects and both of dither's async paths (fixed palette + the
 *     'brand' palette, which is the only one that awaits host.tokens).
 *   - no Math.random anywhere in the new code (grep-gate over the whole file -
 *     the dither/ascii/glitch modules must never call it; block corruption in
 *     particular MUST look random but come from the index+seed-fed noise
 *     formula the halftone effect's ditherNoise already uses).
 *   - manifest contracts: the three effect values exist with showIf-gated
 *     inputs wired to the right `effect`, and no urlKey alias collides with
 *     another input's id/urlKey in this tool.
 *
 * Drives the SHIPPED hooks.js exactly the way the engine's in-realm executor
 * does (`new Function('host', source)`), with a minimal 2D-canvas double so
 * the real pixel pipeline runs headless (same technique as
 * filter-live-input-persistence.test.ts).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS_PATH = join(ROOT, 'community', 'filter', 'hooks.js');
const TOOL_JSON_PATH = join(ROOT, 'community', 'filter', 'tool.json');
const source = await readFile(HOOKS_PATH, 'utf8');

// ── DOM double: a real 2D-canvas-shaped surface ─────────────────────────────
// getImageData answers a fixed, non-uniform-enough-to-matter mid-grey frame
// (every pixel identical) - the point of these tests is BYTE-IDENTICAL repeat
// renders and absence of Math.random, not a particular visual result.
type FakeCtx = {
  canvas: FakeCanvas;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: string;
  drawImage: (...rest: unknown[]) => void;
  getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray };
  putImageData: (img: { data: Uint8ClampedArray }, x: number, y: number) => void;
};
type FakeCanvas = {
  width: number;
  height: number;
  getContext: (kind: string, opts?: unknown) => FakeCtx | null;
  toDataURL: (type?: string) => string;
};

function makeCanvas(): FakeCanvas {
  let calls = 0;
  const canvas: FakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toDataURL: (type) => {
      // A stable string derived from the canvas's own committed pixels (not a
      // counter/timestamp) - proves determinism rather than just formatting.
      const data = lastPut ? Array.from(lastPut.data.slice(0, 64)).join(',') : 'none';
      calls++;
      return `data:${type ?? 'image/png'};fake,${canvas.width}x${canvas.height}:${data}`;
    },
  };
  let lastPut: { data: Uint8ClampedArray } | null = null;
  const ctx: FakeCtx = {
    canvas,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: '',
    drawImage: () => { /* the fake source carries no real pixels; getImageData below is what matters */ },
    getImageData: (_x, _y, w, h) => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128; data[i + 1] = 96; data[i + 2] = 160; data[i + 3] = 255;
      }
      return { data };
    },
    putImageData: (img) => { lastPut = img; },
  };
  return canvas;
}

(globalThis as Record<string, unknown>).document = { createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : {}) };
(globalThis as Record<string, unknown>).ImageData = class {
  data: Uint8ClampedArray; width: number; height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) { this.data = data; this.width = width; this.height = height; }
};

// ── Host double ──────────────────────────────────────────────────────────────
// A small, fixed brand palette + one "...Mono" font token - exercises dither's
// 'brand' palette path and ascii's brand-monospace lookup without a real DTCG doc.
const BRAND_SWATCHES = [
  { ref: '{color.brand.ink}', path: 'color.brand.ink', name: 'Ink', group: null, value: '#101010', description: null, cmyk: null, spot: null },
  { ref: '{color.brand.paper}', path: 'color.brand.paper', name: 'Paper', group: null, value: '#f5f5f0', description: null, cmyk: null, spot: null },
  { ref: '{color.brand.accent}', path: 'color.brand.accent', name: 'Accent', group: null, value: '#c8452e', description: null, cmyk: null, spot: null },
];
const FONT_ENTRIES = [
  { path: 'font.family.body', type: 'fontFamily', value: 'SUSE', description: null, extensions: null },
  { path: 'font.family.mono', type: 'fontFamily', value: 'SUSE Mono', description: null, extensions: null },
];
function makeHost() {
  const decoded: string[] = [];
  return {
    decoded,
    host: {
      raster: {
        canRaster: () => true,
        decode: async (url: string) => { decoded.push(url); return { naturalWidth: 40, naturalHeight: 30, __still: url }; },
      },
      assets: { get: async (id: string) => ({ id, url: 'blob:demo-default' }) },
      tokens: {
        colors: async () => BRAND_SWATCHES,
        get: async () => ({ query: (f: { type?: string }) => (f && f.type === 'fontFamily' ? FONT_ENTRIES : []) }),
      },
      log: () => {},
    },
  };
}

function load(host: unknown) {
  const fn = new Function('host', `${source}
;return {
  onInit:  typeof onInit  !== 'undefined' ? onInit  : null,
  onInput: typeof onInput !== 'undefined' ? onInput : null,
};`) as (h: unknown) => { onInit: (ctx: unknown) => unknown; onInput: (ctx: unknown) => unknown };
  return fn(host);
}

type Patch = { svgContent?: string } | null | undefined;
const row = (id: string, value: unknown) => ({ id, value });
function model(over: Record<string, unknown> = {}): Array<{ id: string; value: unknown }> {
  const base: Record<string, unknown> = {
    effect: 'dither', image: null, width: 200, height: 150,
    // dither
    di_palette: 'mono', di_colorCount: 8, di_algorithm: 'floyd', di_scale: 20, di_fit: 'cover',
    // ascii
    as_ramp: 'classic', as_cellSize: 20, as_colorMode: 'per-cell', as_fgColor: '#e6e6e6', as_bgColor: '', as_invert: false, as_fit: 'cover',
    // glitch
    gl_sortThreshold: 40, gl_sortDirection: 'horizontal', gl_sortBandLength: 0,
    gl_offsetR: { dx: 4, dy: 0 }, gl_offsetG: { dx: 0, dy: 0 }, gl_offsetB: { dx: -4, dy: 0 },
    gl_blockAmount: 35, gl_blockSize: 8, gl_seed: 7, gl_fit: 'cover',
    ...over,
  };
  return Object.entries(base).map(([id, value]) => row(id, value));
}

// ── determinism ──────────────────────────────────────────────────────────────

test('dither (fixed palette): identical model renders byte-identical SVG twice', async () => {
  const { host } = makeHost();
  const hooks = load(host);
  const a = (await hooks.onInit({ model: model({ effect: 'dither' }), host })) as Patch;
  const b = (await hooks.onInit({ model: model({ effect: 'dither' }), host })) as Patch;
  assert.ok(a?.svgContent && a.svgContent.length > 0, 'dither rendered something');
  assert.equal(a!.svgContent, b!.svgContent, 'same inputs -> identical SVG string');
  assert.match(a!.svgContent!, /<rect /, 'dither renders a vector grid of rects');
});

test('dither: each algorithm renders deterministically, including across a fresh module load', async () => {
  for (const algorithm of ['floyd', 'ordered', 'noise']) {
    const host1 = makeHost().host;
    const host2 = makeHost().host;
    const h1 = load(host1);
    const h2 = load(host2);
    const m = model({ effect: 'dither', di_algorithm: algorithm });
    const r1 = (await h1.onInit({ model: m, host: host1 })) as Patch;
    const r2 = (await h2.onInit({ model: m, host: host2 })) as Patch;
    assert.equal(r1!.svgContent, r2!.svgContent, `${algorithm}: identical across independent loads`);
  }
});

test('dither: the brand palette (async host.tokens path) is deterministic too', async () => {
  const { host } = makeHost();
  const hooks = load(host);
  const m = model({ effect: 'dither', di_palette: 'brand', di_colorCount: 3 });
  const a = (await hooks.onInit({ model: m, host })) as Patch;
  const b = (await hooks.onInit({ model: m, host })) as Patch;
  assert.ok(a?.svgContent, 'brand-palette dither rendered');
  assert.equal(a!.svgContent, b!.svgContent, 'brand palette resolves the same way twice');
  // The brand fixture's three swatches should all be reachable as fills.
  assert.match(a!.svgContent!, /#101010|#f5f5f0|#c8452e/i, 'uses a brand swatch, not the grayscale fallback');
});

test('ascii: identical model renders byte-identical SVG twice, and draws real <text> glyphs', async () => {
  const { host } = makeHost();
  const hooks = load(host);
  const a = (await hooks.onInit({ model: model({ effect: 'ascii' }), host })) as Patch;
  const b = (await hooks.onInit({ model: model({ effect: 'ascii' }), host })) as Patch;
  assert.ok(a?.svgContent, 'ascii rendered');
  assert.equal(a!.svgContent, b!.svgContent, 'same inputs -> identical SVG string');
  assert.match(a!.svgContent!, /<text[^>]*>[^<]+<\/text>/, 'characters are real <text> nodes (vector, outlinable)');
});

test('ascii: colour modes are distinguishable and each is deterministic', async () => {
  const { host } = makeHost();
  const hooks = load(host);
  for (const colorMode of ['mono', 'fg-bg', 'per-cell']) {
    const m = model({ effect: 'ascii', as_colorMode: colorMode });
    const a = (await hooks.onInit({ model: m, host })) as Patch;
    const b = (await hooks.onInit({ model: m, host })) as Patch;
    assert.equal(a!.svgContent, b!.svgContent, `${colorMode}: deterministic`);
  }
  const mono = (await hooks.onInit({ model: model({ effect: 'ascii', as_colorMode: 'mono' }), host })) as Patch;
  const perCell = (await hooks.onInit({ model: model({ effect: 'ascii', as_colorMode: 'per-cell' }), host })) as Patch;
  assert.notEqual(mono!.svgContent, perCell!.svgContent, 'mono ink vs. per-cell colour actually differ');
});

test('glitch: identical model renders byte-identical SVG twice (pixel sort + offset + block corruption combined)', async () => {
  const { host } = makeHost();
  const hooks = load(host);
  const a = (await hooks.onInit({ model: model({ effect: 'glitch' }), host })) as Patch;
  const b = (await hooks.onInit({ model: model({ effect: 'glitch' }), host })) as Patch;
  assert.ok(a?.svgContent, 'glitch rendered');
  assert.equal(a!.svgContent, b!.svgContent, 'same inputs -> identical baked image');
  assert.match(a!.svgContent!, /<image /, 'glitch bakes a bitmap wrapped in one <svg><image>');
});

test('glitch: the same seed always corrupts the same way; a different seed changes the bake', async () => {
  const { host } = makeHost();
  const hooks = load(host);
  const seed7a = (await hooks.onInit({ model: model({ effect: 'glitch', gl_seed: 7 }), host })) as Patch;
  const seed7b = (await hooks.onInit({ model: model({ effect: 'glitch', gl_seed: 7 }), host })) as Patch;
  const seed9 = (await hooks.onInit({ model: model({ effect: 'glitch', gl_seed: 9 }), host })) as Patch;
  assert.equal(seed7a!.svgContent, seed7b!.svgContent, 'seed 7 is stable');
  assert.notEqual(seed7a!.svgContent, seed9!.svgContent, 'seed 9 corrupts differently');
});

test('glitch: block corruption alone (no sort, no offset) is still deterministic', async () => {
  const { host } = makeHost();
  const hooks = load(host);
  const m = model({
    effect: 'glitch', gl_sortThreshold: 0, gl_offsetR: { dx: 0, dy: 0 }, gl_offsetG: { dx: 0, dy: 0 }, gl_offsetB: { dx: 0, dy: 0 },
    gl_blockAmount: 80, gl_blockSize: 6, gl_seed: 42,
  });
  const a = (await hooks.onInit({ model: m, host })) as Patch;
  const b = (await hooks.onInit({ model: m, host })) as Patch;
  assert.equal(a!.svgContent, b!.svgContent);
});

// ── no Math.random anywhere in the shipped hooks (grep-gate) ────────────────

test('grep-gate: no Math.random() call anywhere in hooks.js (dither/ascii/glitch use seeded noise only)', () => {
  assert.doesNotMatch(source, /Math\.random\s*\(/, 'Math.random would make block corruption / dithering non-deterministic and non-reproducible on export');
});

test('grep-gate: the three new effect modules exist and each defines the seeded-noise helper, not a PRNG library', () => {
  const diStart = source.indexOf('var FX_dither = ');
  const asStart = source.indexOf('var FX_ascii = ');
  const glStart = source.indexOf('var FX_glitch = ');
  const mapStart = source.indexOf('// ── effect module map');
  assert.ok(diStart > 0 && asStart > diStart && glStart > asStart && mapStart > glStart, 'modules appear in order before the effect map');
  const glitchBody = source.slice(glStart, mapStart);
  assert.match(glitchBody, /function seededNoise01\(/, 'glitch defines its own seeded noise generator');
  assert.doesNotMatch(glitchBody, /Math\.random\s*\(/, 'glitch module body never CALLS Math.random (comments mentioning it by name are fine)');
});

// ── manifest contracts ───────────────────────────────────────────────────────

type ToolInput = {
  id: string;
  urlKey?: string;
  showIf?: Record<string, unknown>;
  options?: { value: string; label: string }[];
};
type ToolManifest = { inputs: ToolInput[] };

test('manifest: dither, ascii and glitch are present as effect options with the expected formats/badges', async () => {
  const manifest = JSON.parse(await readFile(TOOL_JSON_PATH, 'utf8')) as ToolManifest;
  const effectInput = manifest.inputs.find((i) => i.id === 'effect');
  assert.ok(effectInput?.options, 'effect input has options');
  const values = effectInput!.options!.map((o) => o.value);
  for (const v of ['dither', 'ascii', 'glitch']) {
    assert.ok(values.includes(v), `effect options include "${v}"`);
  }
});

test('manifest: every di_/as_/gl_ input is showIf-gated to its own effect', async () => {
  const manifest = JSON.parse(await readFile(TOOL_JSON_PATH, 'utf8')) as ToolManifest;
  const byPrefix: Record<string, string> = { di_: 'dither', as_: 'ascii', gl_: 'glitch' };
  for (const input of manifest.inputs) {
    for (const prefix of Object.keys(byPrefix)) {
      if (!input.id.startsWith(prefix)) continue;
      const expected = byPrefix[prefix];
      assert.ok(input.showIf, `${input.id} has a showIf`);
      assert.equal(input.showIf!.effect, expected, `${input.id} is gated to effect="${expected}"`);
    }
  }
});

test('manifest: sub-controls are gated behind their parent (di_colorCount, gl_sortDirection/BandLength, gl_blockSize/Seed)', async () => {
  const manifest = JSON.parse(await readFile(TOOL_JSON_PATH, 'utf8')) as ToolManifest;
  const byId = new Map(manifest.inputs.map((i) => [i.id, i]));
  assert.equal(byId.get('di_colorCount')?.showIf?.di_palette, 'brand');
  // The glitch sub-controls gate on the effect ONLY. Their would-be parents
  // (gl_sortThreshold, gl_blockAmount) are NUMBER inputs, and a strict-equality
  // showIf of `true` against a number is never satisfied, so it hid them for good.
  for (const id of ['gl_sortDirection', 'gl_sortBandLength', 'gl_blockSize', 'gl_seed']) {
    const showIf = byId.get(id)?.showIf as Record<string, unknown> | undefined;
    assert.equal(showIf?.effect, 'glitch', `${id} is gated to effect="glitch"`);
    assert.equal(showIf?.gl_sortThreshold, undefined, `${id} is not gated on a number-by-boolean`);
    assert.equal(showIf?.gl_blockAmount, undefined, `${id} is not gated on a number-by-boolean`);
  }
  const fgShowIf = byId.get('as_fgColor')?.showIf as { as_colorMode?: string[] } | undefined;
  assert.deepEqual(fgShowIf?.as_colorMode, ['mono', 'fg-bg']);
});

test('manifest: no urlKey (or bare id used as a param key) collides across the whole input list', async () => {
  const manifest = JSON.parse(await readFile(TOOL_JSON_PATH, 'utf8')) as ToolManifest;
  const seen = new Map<string, string>();
  for (const input of manifest.inputs) {
    const key = input.urlKey || input.id;
    const prior = seen.get(key);
    assert.ok(!prior, `param key "${key}" used by both "${prior}" and "${input.id}"`);
    seen.set(key, input.id);
  }
});

test('manifest: the three new effects\' urlKey aliases are short and unique among themselves', async () => {
  const manifest = JSON.parse(await readFile(TOOL_JSON_PATH, 'utf8')) as ToolManifest;
  const newInputs = manifest.inputs.filter((i) => /^(di_|as_|gl_)/.test(i.id));
  assert.ok(newInputs.length >= 20, `expected the full set of new inputs, found ${newInputs.length}`);
  for (const input of newInputs) {
    assert.ok(input.urlKey, `${input.id} has a urlKey alias`);
    assert.ok(input.urlKey!.length <= 5, `${input.id}'s urlKey "${input.urlKey}" is short`);
  }
});

// ── live camera (onFrame) + text export are wired ────────────────────────────
// A loader that also exposes onFrame + exportStill (the still-only `load` above
// leaves them out). Drives the shipped dispatcher exactly like the engine does.
function loadFull(host: unknown) {
  const fn = new Function('host', `${source}
;return {
  onInit:      typeof onInit      !== 'undefined' ? onInit      : null,
  onInput:     typeof onInput     !== 'undefined' ? onInput     : null,
  onFrame:     typeof onFrame     !== 'undefined' ? onFrame     : null,
  exportStill: typeof exportStill !== 'undefined' ? exportStill : null,
};`) as (h: unknown) => {
    onInit: (ctx: unknown) => unknown;
    onFrame: (ctx: unknown) => unknown;
    exportStill: (ctx: unknown) => unknown;
  };
  return fn(host);
}
const FRAME = { data: new Uint8ClampedArray(8 * 8 * 4), width: 8, height: 8, t: 500 };

test('onFrame is wired (not null) for all three effects, so the live camera runs the effect core', async () => {
  for (const effect of ['dither', 'ascii', 'glitch']) {
    const { host } = makeHost();
    const hooks = loadFull(host);
    // Warm the async caches (mono font stack, brand palette, logo) the way a real
    // session does. Live capture only starts after the still has mounted.
    await hooks.onInit({ model: model({ effect }), host });
    const live = (await hooks.onFrame({ model: model({ effect }), frame: FRAME, host })) as Patch;
    assert.ok(live?.svgContent, `${effect}: onFrame returned a render patch (module onFrame is not null)`);
    // Live patches never carry the still-path auto-fit key (mirrors the dispatcher contract).
    assert.equal('imgKey' in (live as Record<string, unknown>), false, `${effect}: onFrame patch is not the still path`);
    const again = (await hooks.onFrame({ model: model({ effect }), frame: FRAME, host })) as Patch;
    assert.equal(live!.svgContent, again!.svgContent, `${effect}: onFrame is deterministic once caches are warm`);
  }
});

// ── manifest: the new ASCII controls (font weight + threshold) ────────────────

test('manifest: as_fontWeight and as_threshold exist, are gated to ascii, and carry short urlKeys', async () => {
  const manifest = JSON.parse(await readFile(TOOL_JSON_PATH, 'utf8')) as ToolManifest;
  const byId = new Map(manifest.inputs.map((i) => [i.id, i]));
  const fw = byId.get('as_fontWeight');
  const th = byId.get('as_threshold');
  assert.ok(fw, 'as_fontWeight exists');
  assert.ok(th, 'as_threshold exists');
  assert.equal(fw!.showIf?.effect, 'ascii', 'as_fontWeight gated to ascii');
  assert.equal(th!.showIf?.effect, 'ascii', 'as_threshold gated to ascii');
  assert.ok(fw!.urlKey && fw!.urlKey.length <= 5, 'as_fontWeight urlKey is short');
  assert.ok(th!.urlKey && th!.urlKey.length <= 5, 'as_threshold urlKey is short');
  const weights = (fw!.options ?? []).map((o) => o.value);
  for (const w of ['300', '400', '500', '700']) assert.ok(weights.includes(w), `font weight ${w} offered`);
});

test('ascii: font weight lands on the <g> and threshold biases the character mapping', async () => {
  const { host } = makeHost();
  const hooks = loadFull(host);
  const bold = (await hooks.onInit({ model: model({ effect: 'ascii', as_fontWeight: '700' }), host })) as Patch;
  assert.match(bold!.svgContent!, /font-weight="700"/, 'as_fontWeight is applied to the glyph group');
  // Threshold 50 is the neutral midpoint; 10 pushes the same grey toward a denser glyph.
  const mid = (await hooks.onInit({ model: model({ effect: 'ascii', as_threshold: 50 }), host })) as Patch;
  const low = (await hooks.onInit({ model: model({ effect: 'ascii', as_threshold: 10 }), host })) as Patch;
  assert.notEqual(mid!.svgContent, low!.svgContent, 'threshold shifts which ramp character each cell picks');
});

// ── ASCII text export (.txt / .md) via exportStill ───────────────────────────

const textEnc = new TextDecoder();
test('ascii: exportStill emits the character grid as .txt (spaces preserved) matching the SVG', async () => {
  const { host } = makeHost();
  const hooks = loadFull(host);
  const svgPatch = (await hooks.onInit({ model: model({ effect: 'ascii' }), host })) as Patch;
  const res = (await hooks.exportStill({ format: 'txt', node: {}, host })) as { bytes: Uint8Array; mime: string } | null;
  assert.ok(res && res.bytes, 'exportStill produced bytes for txt');
  assert.equal(res!.mime, 'text/plain');
  const text = textEnc.decode(res!.bytes);
  const lines = text.replace(/\n$/, '').split('\n');
  assert.ok(lines.length > 1, 'more than one row of text');
  // Every row has the same width (a rectangular grid), and the total non-space glyph
  // count equals the number of <text> nodes the SVG drew (the SVG skips spaces).
  const width = lines[0]!.length;
  for (const ln of lines) assert.equal(ln.length, width, 'every text row is the same width (grid preserved)');
  const drawn = (svgPatch!.svgContent!.match(/<text /g) ?? []).length;
  const nonSpace = text.replace(/\n/g, '').replace(/ /g, '').length;
  assert.equal(nonSpace, drawn, 'text non-space glyph count matches the SVG <text> node count');
  // Deterministic: exporting the same render twice is byte-identical.
  const res2 = (await hooks.exportStill({ format: 'txt', node: {}, host })) as { bytes: Uint8Array };
  assert.equal(textEnc.decode(res2.bytes), text, 'txt export is deterministic');
});

test('ascii: exportStill wraps .md in a fenced code block, and declines every other format', async () => {
  const { host } = makeHost();
  const hooks = loadFull(host);
  await hooks.onInit({ model: model({ effect: 'ascii' }), host });
  const md = (await hooks.exportStill({ format: 'md', node: {}, host })) as { bytes: Uint8Array; mime: string };
  const mdText = textEnc.decode(md.bytes);
  assert.equal(md.mime, 'text/markdown');
  assert.match(mdText, /^```\n/, 'md opens a fenced code block');
  assert.match(mdText, /```\n$/, 'md closes the fence');
  // A render format returns null so the normal SVG/PDF/PNG path runs.
  assert.equal(await hooks.exportStill({ format: 'svg', node: {}, host }), null, 'svg declines → normal render path');
  assert.equal(await hooks.exportStill({ format: 'png', node: {}, host }), null, 'png declines → normal render path');
});

test('exportStill declines for dither and glitch (only ascii owns text output)', async () => {
  for (const effect of ['dither', 'glitch']) {
    const { host } = makeHost();
    const hooks = loadFull(host);
    await hooks.onInit({ model: model({ effect }), host });
    assert.equal(await hooks.exportStill({ format: 'txt', node: {}, host }), null, `${effect}: no text producer → null`);
  }
});

// ── grade + overlay wired for the three new effects (determinism holds) ───────

const GRADE_OVERLAY = {
  hue: 40, saturation: 60, lightness: 15, contrast: 25,
  treatmentColor: '#30ba78', blendMode: 'multiply', treatmentIntensity: 45,
  showLogo: true, logoPosition: 'top-right', logoStyle: 'white',
  lowerThird: true, ltTheme: 'bar', ltPosition: 'left', firstname: 'Ada', lastname: 'Byron', title: 'Engineer', nameWeight: 600, subtitleWeight: 400,
};

test('grade + overlay: applied for dither/ascii/glitch and byte-identical across two renders', async () => {
  for (const effect of ['dither', 'ascii', 'glitch']) {
    const { host } = makeHost();
    const hooks = loadFull(host);
    const base = (await hooks.onInit({ model: model({ effect }), host })) as Patch;
    const graded = (await hooks.onInit({ model: model({ effect, ...GRADE_OVERLAY }), host })) as Patch;
    assert.ok(graded?.svgContent, `${effect}: rendered with grade+overlay`);
    assert.notEqual(graded!.svgContent, base!.svgContent, `${effect}: grade/overlay actually changes the output (inputs are no longer inert)`);
    // The overlay slot is emitted so it survives every export path.
    assert.match(graded!.svgContent!, /id="lolly-ov-slot"/, `${effect}: overlay slot present`);
    const graded2 = (await hooks.onInit({ model: model({ effect, ...GRADE_OVERLAY }), host })) as Patch;
    assert.equal(graded!.svgContent, graded2!.svgContent, `${effect}: grade+overlay render is deterministic`);
  }
});

// ── dither budget raised + scale min lowered (task 8) ─────────────────────────

test('dither: the cell budget is raised and the scale min is lowered so small scales get finer', async () => {
  const diStart = source.indexOf('var FX_dither = ');
  const asStart = source.indexOf('var FX_ascii = ');
  const ditherBody = source.slice(diStart, asStart);
  const m = ditherBody.match(/var MAX_CELLS = (\d+);/);
  assert.ok(m, 'dither declares MAX_CELLS');
  const maxCells = Number(m![1]);
  assert.ok(maxCells >= 100000, `dither MAX_CELLS raised well above the old 26000 (is ${maxCells})`);

  const manifest = JSON.parse(await readFile(TOOL_JSON_PATH, 'utf8')) as ToolManifest & { inputs: Array<{ id: string; min?: number }> };
  const scale = manifest.inputs.find((i) => i.id === 'di_scale') as { min?: number } | undefined;
  assert.ok(scale, 'di_scale exists');
  assert.ok((scale!.min ?? 1) < 1, `di_scale min lowered below 1 (is ${scale!.min})`);

  // A finer scale now yields strictly more <rect>s at 1000px (it used to plateau at MAX_CELLS).
  const { host } = makeHost();
  const hooks = loadFull(host);
  const coarse = (await hooks.onInit({ model: model({ effect: 'dither', di_scale: 20, width: 1000, height: 1000 }), host })) as Patch;
  const fine = (await hooks.onInit({ model: model({ effect: 'dither', di_scale: 4, width: 1000, height: 1000 }), host })) as Patch;
  const coarseRects = (coarse!.svgContent!.match(/<rect /g) ?? []).length;
  const fineRects = (fine!.svgContent!.match(/<rect /g) ?? []).length;
  assert.ok(fineRects > coarseRects * 3, `a finer scale produces many more cells (${fineRects} vs ${coarseRects})`);
});

// ── glitch visible-by-default values (task 4) ─────────────────────────────────

test('manifest: glitch defaults are the clearly-glitched values (visible on first pick)', async () => {
  const manifest = JSON.parse(await readFile(TOOL_JSON_PATH, 'utf8')) as ToolManifest;
  type GlInput = { id: string; default?: unknown; fields?: Array<{ id: string; default?: number }> };
  const byId = new Map((manifest.inputs as unknown as GlInput[]).map((i) => [i.id, i]));
  assert.equal(byId.get('gl_sortThreshold')?.default, 39);
  assert.equal((byId.get('gl_sortDirection') as { default?: string })?.default, 'horizontal');
  assert.equal(byId.get('gl_sortBandLength')?.default, 260);
  assert.equal(byId.get('gl_blockAmount')?.default, 16);
  assert.equal(byId.get('gl_blockSize')?.default, 44);
  assert.equal(byId.get('gl_seed')?.default, 269);
  const fieldDefault = (id: string, f: string): number | undefined =>
    (byId.get(id)?.fields ?? []).find((x) => x.id === f)?.default;
  assert.deepEqual([fieldDefault('gl_offsetR', 'dx'), fieldDefault('gl_offsetR', 'dy')], [5, -10]);
  assert.deepEqual([fieldDefault('gl_offsetG', 'dx'), fieldDefault('gl_offsetG', 'dy')], [7, 5]);
  assert.deepEqual([fieldDefault('gl_offsetB', 'dx'), fieldDefault('gl_offsetB', 'dy')], [10, 18]);
});

test('manifest: the ascii effect advertises txt + md, and the tool declares exportStill', async () => {
  const manifest = JSON.parse(await readFile(TOOL_JSON_PATH, 'utf8')) as ToolManifest & {
    hooks?: Record<string, boolean>;
    render: { formats: string[] };
  };
  const effectInput = manifest.inputs.find((i) => i.id === 'effect') as { options?: Array<{ value: string; formats?: string[] }> };
  const ascii = effectInput.options!.find((o) => o.value === 'ascii')!;
  assert.ok(ascii.formats?.includes('txt'), 'ascii option offers txt');
  assert.ok(ascii.formats?.includes('md'), 'ascii option offers md');
  assert.ok(manifest.render.formats.includes('txt') && manifest.render.formats.includes('md'), 'render.formats union carries txt + md');
  assert.equal(manifest.hooks?.exportStill, true, 'exportStill hook declared');
});

// ── glitch motion export: direct-canvas fast path (node.__lollyFrameCanvas) ───
// A gif/apng/webm/mp4 of a STILL glitch shimmers by re-corrupting the stashed base
// per frame. The old path baked each frame to a ~1.7MB PNG and let dom-to-image
// decode it (slow + an intermittent hang). With NO overlay the finished frame is one
// full-canvas <image>, so the effect now hands the shell the frame <canvas> directly
// via node.__lollyFrameCanvas - registered in beforeExport, removed in afterExport,
// and deterministic in t. When an overlay IS active the mutating overlay group still
// needs the dom-to-image ov-clock path, so the fast path must NOT be registered.

// A loader that also exposes the dispatcher's export lifecycle hooks.
function loadExport(host: unknown) {
  const fn = new Function('host', `${source}
;return {
  onInit:       typeof onInit       !== 'undefined' ? onInit       : null,
  beforeExport: typeof beforeExport  !== 'undefined' ? beforeExport  : null,
  afterExport:  typeof afterExport   !== 'undefined' ? afterExport   : null,
};`) as (h: unknown) => {
    onInit: (ctx: unknown) => unknown;
    beforeExport: (ctx: unknown) => unknown;
    afterExport: (ctx: unknown) => unknown;
  };
  return fn(host);
}

// A minimal export node the glitch beforeExport can drive: the fast path only needs
// a settable object; the ov-clock (overlay) path needs ownerDocument/appendChild/
// querySelector so mountOvClockAnchor can attach the clock anchor.
type FakeExportNode = {
  __lollyFrameCanvas?: (t: number, durationMs?: number) => { toDataURL: (t?: string) => string; width: number; height: number };
  children: Array<Record<string, unknown>>;
  appendChild: (c: Record<string, unknown>) => unknown;
  removeChild: (c: unknown) => unknown;
  querySelector: (sel: string) => null;
  ownerDocument: { createElement: (tag: string) => Record<string, unknown> };
};
function makeAnchor(tag: string): Record<string, unknown> {
  const attrs: Record<string, string> = {};
  return {
    tagName: (tag || '').toUpperCase(), width: 0, height: 0, parentNode: null,
    setAttribute(k: string, v: string) { attrs[k] = v; },
    getAttribute(k: string) { return attrs[k] ?? null; },
    hasAttribute(k: string) { return k in attrs; },
  };
}
function fakeExportNode(): FakeExportNode {
  const node: FakeExportNode = {
    children: [],
    appendChild(c: Record<string, unknown>) { node.children.push(c); c.parentNode = node; return c; },
    removeChild(c: unknown) { node.children = node.children.filter((x) => x !== c); return c; },
    querySelector() { return null; },
    ownerDocument: { createElement: (tag: string) => makeAnchor(tag) },
  };
  return node;
}

test('glitch: a motion export with NO overlay registers node.__lollyFrameCanvas (deterministic), and afterExport removes it', async () => {
  const { host } = makeHost();
  const hooks = loadExport(host);
  // The still render stashes the graded base a motion export re-corrupts per frame.
  await hooks.onInit({ model: model({ effect: 'glitch' }), host });

  const node = fakeExportNode();
  await hooks.beforeExport({ format: 'gif', node, opts: { duration: 5 }, host });
  const fc = node.__lollyFrameCanvas;
  assert.equal(typeof fc, 'function', 'overlay-off motion export registers the direct-canvas hook');

  // Deterministic: the same t twice yields byte-identical committed pixels.
  const a = fc!(0.3).toDataURL();
  const b = fc!(0.3).toDataURL();
  assert.equal(a, b, 'same t → identical frame canvas (no Math.random; phaseGlitch is pure in t)');
  assert.match(a, /200x150/, 'the frame canvas is the work-dims bitmap the shell stretches to the export size');
  // It is a real canvas the shell can consume (has toDataURL + dims).
  const cv = fc!(0.0);
  assert.equal(typeof cv.toDataURL, 'function', 'hands back a canvas, not a data URL');
  assert.ok(cv.width > 0 && cv.height > 0, 'the frame canvas has a backing store');

  hooks.afterExport({ format: 'gif', node, host });
  assert.equal(node.__lollyFrameCanvas, undefined, 'afterExport removes the direct-canvas hook');
});

test('glitch: a motion export WITH an active overlay does NOT register node.__lollyFrameCanvas (keeps the ov-clock path)', async () => {
  const { host } = makeHost();
  const hooks = loadExport(host);
  // showLogo makes overlayActive() true, so the mutating overlay group needs dom-to-image.
  await hooks.onInit({ model: model({ effect: 'glitch', showLogo: true, logoStyle: 'white', logoPosition: 'top-right' }), host });

  const node = fakeExportNode();
  await hooks.beforeExport({ format: 'gif', node, opts: { duration: 5 }, host });
  assert.equal(node.__lollyFrameCanvas, undefined, 'overlay-active export must NOT take the direct-canvas fast path');
  // Instead the ov-clock anchor is mounted and carries the per-frame render hook.
  const anchor = node.children.find((c) => typeof c.__lollyFrameRender === 'function');
  assert.ok(anchor, 'the ov-clock anchor was mounted with a __lollyFrameRender (existing overlay path)');

  hooks.afterExport({ format: 'gif', node, host });
});

test('glitch: a still (png) export registers no per-frame hooks at all', async () => {
  const { host } = makeHost();
  const hooks = loadExport(host);
  await hooks.onInit({ model: model({ effect: 'glitch' }), host });
  const node = fakeExportNode();
  await hooks.beforeExport({ format: 'png', node, opts: {}, host });
  assert.equal(node.__lollyFrameCanvas, undefined, 'png is not a motion format → no direct-canvas hook');
  assert.equal(node.children.length, 0, 'png is not a motion format → no ov-clock anchor mounted');
});
