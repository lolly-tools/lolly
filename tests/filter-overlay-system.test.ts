// SPDX-License-Identifier: MPL-2.0
/**
 * Filter - the name card and the scanline tones follow the design system.
 *
 * Run with: node --test tests/filter-overlay-system.test.ts
 *
 * Drives the shipped hooks.js as the engine's in-realm executor does, with a
 * small canvas double and a host that answers tokens. Pinned here:
 *   - the card's colours come from the tokens and each ink clears its contrast
 *     on the card; no brand's own green or logo shape is left in the source;
 *   - the card enters on the system's emphasised curve, holds, and leaves before
 *     a clip ends; a still and a live camera never run the exit;
 *   - "No filter" with "Clear background" draws the card alone, as a clip;
 *   - scanline's Light, Mid and Shade are a ramp of the lead colour where left
 *     empty, and a tone that was set draws as set.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HOOKS_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'community', 'filter', 'hooks.js');
const source = await readFile(HOOKS_PATH, 'utf8');

function makeCanvas() {
  const canvas = {
    width: 0, height: 0, __frame: false,
    getContext: () => ctx,
    toDataURL: () => 'data:image/jpeg;base64,AA',
  };
  const ctx = {
    canvas, imageSmoothingEnabled: false, imageSmoothingQuality: '',
    clearRect: () => {}, drawImage: () => {}, putImageData: () => { canvas.__frame = true; },
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      // A left-to-right grey ramp, so every one of scanline's five tones is drawn.
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) { const v = Math.round((i % w) / Math.max(1, w - 1) * 255); data.set([v, v, v, 255], i * 4); }
      return { data };
    },
  };
  return canvas;
}
(globalThis as Record<string, unknown>).document = { createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : {}) };
(globalThis as Record<string, unknown>).ImageData = class {
  data: Uint8ClampedArray; width: number; height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) { this.data = data; this.width = width; this.height = height; }
};

// The demo design system's light colourway, and its motion tokens.
const TOKENS: Record<string, unknown> = {
  '{color.semantic.primary}': '#033633', '{color.semantic.on-primary}': '#ffffff', '{color.semantic.secondary}': '#008657',
  '{color.semantic.surface}': '#ffffff', '{color.semantic.text}': '#09141a',
  '{motion.duration.medium}': { value: 400, unit: 'ms' }, '{motion.duration.long}': { value: 700, unit: 'ms' },
  '{motion.curve.emphasised}': [0.05, 0.7, 0.1, 1], '{motion.curve.exit}': [0.3, 0, 0.8, 0.15],
};
const host = {
  raster: { canRaster: () => true, decode: async (url: string) => ({ naturalWidth: 8, naturalHeight: 8, __still: url }) },
  assets: { get: async (id: string) => ({ id, url: 'blob:demo-default' }) },
  tokens: { resolve: async (ref: string) => TOKENS[ref] ?? null },
  log: () => {},
};

type Theme = Record<string, unknown> & { card: string; ink: string; accent: string; title: string };
const load = new Function('host', `${source}
;return { onInit, onInput, onFrame, overlayTheme, ovtContrast, buildOverlaySvg, overlayInputs };`) as (h: unknown) => {
  onInit: (ctx: unknown) => Promise<{ svgContent?: string }>;
  onInput: (ctx: unknown) => Promise<{ svgContent?: string }>;
  onFrame: (ctx: unknown) => { svgContent?: string };
  overlayTheme: (tok: Record<string, unknown>, mix: null) => Theme;
  ovtContrast: (a: string, b: string) => number;
  buildOverlaySvg: (w: number, h: number, o: Record<string, unknown>) => string;
  overlayInputs: (inp: Record<string, unknown>) => Record<string, unknown>;
};
const hooks = load(host);

function model(over: Record<string, unknown> = {}): Array<{ id: string; value: unknown }> {
  const base: Record<string, unknown> = {
    effect: 'halftone', image: null, width: 1000, height: 1000,
    ht_gridSize: 40, ht_dotScale: 1, ht_shape: 'circle', ht_colorSource: 'solid',
    ht_fgColor: '#111111', ht_bgColor: '#ffffff', ht_fit: 'contain',
    sc_lineSize: 14, sc_gapSize: 12, sc_colorSource: 'tones', sc_highlight: '#ffffff', sc_shadow: '#000000',
    sc_light: '', sc_mid: '', sc_shade: '', sc_fit: 'cover',
    firstname: 'Ada', lastname: 'Lovelace', title: 'Engineer',
    ...over,
  };
  return Object.entries(base).map(([id, value]) => ({ id, value }));
}
const theme = (): Theme => hooks.overlayTheme({
  primary: TOKENS['{color.semantic.primary}'], onPrimary: TOKENS['{color.semantic.on-primary}'], secondary: TOKENS['{color.semantic.secondary}'],
  surface: TOKENS['{color.semantic.surface}'], text: TOKENS['{color.semantic.text}'],
  medium: TOKENS['{motion.duration.medium}'], long: TOKENS['{motion.duration.long}'],
  emphasised: TOKENS['{motion.curve.emphasised}'], exit: TOKENS['{motion.curve.exit}'],
}, null);

test('the card takes the darker of surface and text, and every ink clears its contrast on the card', () => {
  const t = theme();
  assert.equal(t.card, '#09141a');
  assert.equal(t.ink, '#ffffff');
  assert.ok(hooks.ovtContrast(t.ink, t.card) >= 4.5);
  assert.ok(hooks.ovtContrast(t.title, t.card) >= 4.5);
  assert.ok(hooks.ovtContrast(t.accent, t.card) >= 3);
  assert.equal(t.accent, '#008657', 'a lead colour too dark to show on the card gives way to the second colour');
  assert.equal(t.inMs, 700);
  assert.equal(t.outMs, 400);
  assert.deepEqual(t.inCurve, [0.05, 0.7, 0.1, 1]);
  assert.deepEqual(t.outCurve, [0.3, 0, 0.8, 0.15]);
});

test('a dark appearance keeps the card a dark plate', () => {
  const t = hooks.overlayTheme({ primary: '#50c369', onPrimary: '#09141a', surface: '#09141a', text: '#ffffff' }, null);
  assert.equal(t.card, '#09141a');
  assert.equal(t.ink, '#ffffff');
  assert.equal(t.accent, '#50c369');
});

test('no brand\'s own green or logo shape is left in the shipped hooks', () => {
  for (const fixed of ['#30ba78', '#a9e3c8', '#e6f0ec', '#0b1512', '210.179', '#bff1ea', '#008878', '#01564a']) {
    assert.equal(source.includes(fixed), false, `${fixed} is gone`);
  }
});

test('the card draws in the system\'s colours, and in neutral ones when given none', () => {
  const base = { lowerThird: true, firstname: 'Ada', title: 'Engineer', mode: 'still' };
  const branded = hooks.buildOverlaySvg(1000, 1000, { ...base, theme: theme() });
  assert.ok(branded.includes('fill="#09141a"') && branded.includes('fill="#008657"'));
  const plain = hooks.buildOverlaySvg(1000, 1000, base);
  assert.ok(plain.includes('fill="#111111"') && plain.includes('fill="#ffffff"'));
});

const opacityOf = (svg: string): number => {
  const m = /<g transform="translate\([^"]*"( opacity="([\d.]+)")?/.exec(svg);
  assert.ok(m, 'the card group is drawn');
  return m![2] === undefined ? 1 : Number(m![2]);
};

test('in a clip the card enters, holds, and has left by the last frame', () => {
  const at = (elapsed: number, total?: number) => opacityOf(hooks.buildOverlaySvg(1000, 1000, { lowerThird: true, firstname: 'Ada', theme: theme(), mode: 'live', elapsed, total }));
  assert.equal(at(0, 5000), 0);
  assert.ok(at(100, 5000) > 0.3, 'the emphasised curve moves early');
  assert.equal(at(700, 5000), 1);
  assert.equal(at(2500, 5000), 1);
  assert.equal(at(4500, 5000), 1, 'the exit takes the last half second only');
  assert.ok(at(4700, 5000) < 1 && at(4700, 5000) > 0.5, 'the exit curve starts slowly');
  assert.equal(at(4900, 5000), 0);
  assert.equal(at(4966, 5000), 0, 'a 30 fps clip ends on a clear frame');
  assert.equal(at(60_000), 1, 'a live camera has no end, so the card stays');
});

test('a still shows the card at rest', () => {
  assert.equal(opacityOf(hooks.buildOverlaySvg(1000, 1000, { lowerThird: true, firstname: 'Ada', mode: 'still', total: 5000, elapsed: 0 })), 1);
});

test('No filter with Clear background draws the card alone, as a clip', async () => {
  const patch = await hooks.onInit({ model: model({ lowerThird: true, noFilter: true, ovClear: true }), host });
  const svg = patch.svgContent ?? '';
  assert.ok(svg.startsWith('<svg'));
  assert.equal(svg.includes('<image'), false, 'no picture');
  assert.equal(svg.includes('<rect width="1000" height="1000"'), false, 'no ground');
  assert.ok(svg.includes('Ada Lovelace') && svg.includes('fill="#09141a"'));
  assert.ok(/^<svg[^>]* data-clip-ms="5000"/.test(svg));
});

test('Clear background needs No filter, and a picture with a card is a clip too', async () => {
  const patch = await hooks.onInput({ model: model({ lowerThird: true, ovClear: true }), host });
  const svg = patch.svgContent ?? '';
  assert.ok(svg.includes('<circle') || svg.includes('<g fill='), 'the effect still draws');
  assert.ok(/^<svg[^>]* data-clip-ms="5000"/.test(svg));
  const plain = await hooks.onInput({ model: model(), host });
  assert.equal((plain.svgContent ?? '').includes('data-clip-ms'), false, 'no card, no clip');
});

test('scanline tones left empty are a ramp of the lead colour, which keeps its own place', async () => {
  const svg = (await hooks.onInput({ model: model({ effect: 'scanline' }), host })).svgContent ?? '';
  assert.ok(svg.includes('#033633'), 'a dark lead colour is the Shade');
  const fills = [...new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]))];
  assert.equal(fills.length, 5, `five tones drawn: ${fills.join(' ')}`);
});

test('a scanline tone the person set draws as set, and Light and Shade follow a set Mid', async () => {
  const all = (await hooks.onInput({ model: model({ effect: 'scanline', sc_light: '#bff1ea', sc_mid: '#008878', sc_shade: '#01564a' }), host })).svgContent ?? '';
  for (const tone of ['#bff1ea', '#008878', '#01564a']) assert.ok(all.includes(tone), `${tone} is drawn`);
  const mid = (await hooks.onInput({ model: model({ effect: 'scanline', sc_mid: '#cc3300' }), host })).svgContent ?? '';
  assert.ok(mid.includes('#cc3300'));
  assert.equal(mid.includes('#033633'), false, 'the ramp follows the Mid that was set');
});
