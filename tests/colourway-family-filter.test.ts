// SPDX-License-Identifier: MPL-2.0
/**
 * Filter's brand caches follow the design system's colours (plans/319, milestone
 * A5). The colour treatment (`duotone`) reads three seeds from the brand once,
 * and dither's `brand` palette reads the brand's colours once; both used to keep
 * them for the life of the mount, so a colourway or look switch never reached
 * them. Each cache now stores the colours it was read under and reads again when
 * `color.semantic.primary`, `secondary` or `surface` resolve differently, with no
 * onInit and no reset of the inputs.
 *
 * Its own file because it installs a 2D-canvas double on globalThis (the same
 * double tests/filter-live-input-persistence.test.ts uses): mid-grey stills, so a
 * dither render paints palette colours the assertions can read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../community/filter/hooks.js', import.meta.url), 'utf8');

type FakeCanvas = { width: number; height: number; getContext: () => unknown; toDataURL: () => string };
function makeCanvas(): FakeCanvas {
  const canvas: FakeCanvas = { width: 0, height: 0, getContext: () => ctx, toDataURL: () => 'data:image/jpeg;base64,AA==' };
  const ctx = {
    canvas, imageSmoothingEnabled: false, imageSmoothingQuality: '',
    clearRect: () => {}, drawImage: () => {}, putImageData: () => {}, fillRect: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < data.length; i += 4) { data[i] = 128; data[i + 1] = 128; data[i + 2] = 128; data[i + 3] = 255; }
      return { data };
    },
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  };
  return canvas;
}
(globalThis as Record<string, unknown>).document = { createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : {}) };
(globalThis as Record<string, unknown>).ImageData = class {
  data: Uint8ClampedArray; width: number; height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) { this.data = data; this.width = width; this.height = height; }
};

/** Two looks of one design system: what a colourway switch does to the semantic slots. */
const BRANDS = {
  main: { primary: '#033633', secondary: '#008657', surface: '#ffffff', extra: ['#0b1f1d', '#e9f5f1'] },
  persimmon: { primary: '#c2410c', secondary: '#7c2d12', surface: '#ffffff', extra: ['#2a0f04', '#fff1e8'] },
} as const;

function brandHost() {
  const state = { brand: 'main' as keyof typeof BRANDS, colorReads: 0 };
  const swatches = () => {
    const b = BRANDS[state.brand];
    return [
      { path: 'color.semantic.primary', name: 'Primary', group: 'Semantic', value: b.primary, ref: '{color.semantic.primary}' },
      { path: 'color.semantic.secondary', name: 'Secondary', group: 'Semantic', value: b.secondary, ref: '{color.semantic.secondary}' },
      { path: 'color.semantic.surface', name: 'Surface', group: 'Semantic', value: b.surface, ref: '{color.semantic.surface}' },
      ...b.extra.map((value, i) => ({ path: `color.brand.c${i}`, name: `C${i}`, group: 'Brand', value, ref: `{color.brand.c${i}}` })),
    ];
  };
  const host = {
    raster: { canRaster: () => true, decode: async () => ({ naturalWidth: 8, naturalHeight: 8 }) },
    assets: { get: async (id: string) => ({ id, url: 'blob:demo-default' }) },
    log: () => {},
    tokens: {
      colors: async () => { state.colorReads += 1; return swatches(); },
      resolve: async (ref: string) => {
        const slot = /^\{color\.semantic\.([a-z-]+)\}$/.exec(ref)?.[1] as 'primary' | 'secondary' | 'surface' | undefined;
        return slot ? BRANDS[state.brand][slot] : null;
      },
    },
  };
  return { host, state };
}

function loadHooks(host: unknown) {
  return new Function('host', `${source}
;return { onInit: typeof onInit !== 'undefined' ? onInit : null, onInput: typeof onInput !== 'undefined' ? onInput : null };`)(host) as {
    onInit: (ctx: unknown) => Promise<{ svgContent?: string } | null>;
    onInput: (ctx: unknown) => Promise<{ svgContent?: string } | null>;
  };
}

const model = (over: Record<string, unknown>) =>
  Object.entries({ image: null, width: 64, height: 64, ...over }).map(([id, value]) => ({ id, value }));

test('dither\'s brand palette re-reads after a colourway switch, and only then', async () => {
  const { host, state } = brandHost();
  const hooks = loadHooks(host);
  const m = model({ effect: 'dither', di_palette: 'brand', di_colorCount: 4, di_scale: 16 });
  const first = await hooks.onInit({ model: m, host });
  assert.ok(first?.svgContent?.includes('<'), 'dither rendered');
  const reads = state.colorReads;
  assert.ok(reads >= 1, 'the palette was read');
  assert.match(first!.svgContent!, /#(033633|008657|0b1f1d|e9f5f1|ffffff)/i, 'painted in the main colours');

  // An ordinary edit with nothing switched keeps the cached palette.
  await hooks.onInput({ model: m, id: 'di_scale', value: 16, host });
  assert.equal(state.colorReads, reads, 'no second read without a switch');

  state.brand = 'persimmon';
  const after = await hooks.onInput({ model: m, id: 'di_scale', value: 16, host });
  assert.ok(state.colorReads > reads, 'the switch re-read the palette');
  assert.notEqual(after!.svgContent, first!.svgContent, 'the memo did not answer for the old colours');
  assert.match(after!.svgContent!, /#(c2410c|7c2d12|2a0f04|fff1e8)/i, 'painted in the switched colours');
  assert.doesNotMatch(after!.svgContent!, /#(033633|0b1f1d)/i);
});

test('the colour treatment\'s seeds re-read after a colourway switch, and only then', async () => {
  const { host, state } = brandHost();
  const hooks = loadHooks(host);
  const m = model({ effect: 'duotone' });
  await hooks.onInit({ model: m, host });
  const reads = state.colorReads;
  assert.equal(reads, 1, 'the seeds were read once at mount');
  await hooks.onInput({ model: m, id: 'width', value: 64, host });
  assert.equal(state.colorReads, reads, 'an edit with nothing switched keeps the seeds');
  state.brand = 'persimmon';
  await hooks.onInput({ model: m, id: 'width', value: 64, host });
  assert.equal(state.colorReads, reads + 1, 'the switch read the seeds once more');
  await hooks.onInput({ model: m, id: 'width', value: 64, host });
  assert.equal(state.colorReads, reads + 1, 'and keeps them until the colours change again');
});
