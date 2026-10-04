// SPDX-License-Identifier: MPL-2.0
/**
 * The Assets view's treated download and crop source (plan 291 W7). A gradient-map or
 * lut look used to go through the SVG filter preview, which skips the look's contrast
 * and lightness grade, reads Rec.709 luma where the bake reads OKLab lightness, and
 * shows a LUT as the plain photo, while the file's credential said the look was
 * applied. A raster look is now baked into the pixels by the engine's applyPhotoLook.
 *
 * Node has no image decoder, so createImageBitmap and OffscreenCanvas are stood in for
 * by a raw-RGBA "image" (an 8-byte size header and the pixels), as in
 * shells/web/src/bridge/photo-look-bridge.test.ts.
 *
 * Run: node --test shells/web/src/lib/photo-look-download.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { treatedPhotoSvg, type TreatedPhotoDeps } from './photo-look-download.ts';
import { applyPhotoLook } from '../../../../engine/src/photo-look.ts';
import type { PhotoTreatment } from '../../../../engine/src/photo-treatment.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 8, H = 4;
const LOOK: PhotoTreatment = {
  id: 'grade', label: 'Grade', kind: 'gradient-map', stops: ['#0c322c', '#30ba78', '#ffffff'], amount: 90, contrast: 12, lightness: 20,
  themes: { dark: { stops: ['#000000', '#0c322c', '#90ebcd'], lightness: -10 } },
};

function rawImage(type: string, data: Uint8ClampedArray, w: number, h: number): Blob {
  const head = new Uint32Array([w, h]);
  return new Blob([new Uint8Array(head.buffer), new Uint8Array(data)], { type });
}
async function readRaw(blob: Blob): Promise<{ w: number; h: number; data: Uint8ClampedArray }> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const [w, h] = new Uint32Array(buf.slice(0, 8).buffer);
  return { w: w!, h: h!, data: new Uint8ClampedArray(buf.slice(8)) };
}
const SOURCE = (() => {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < d.length; i += 4) { d[i] = (i * 7) & 255; d[i + 1] = (i * 3) & 255; d[i + 2] = 255 - ((i * 5) & 255); d[i + 3] = 255; }
  return d;
})();

const saved: Record<string, unknown> = {};
before(() => {
  const g = globalThis as Record<string, unknown>;
  for (const k of ['createImageBitmap', 'OffscreenCanvas']) saved[k] = g[k];
  g.createImageBitmap = async (blob: Blob) => { const r = await readRaw(blob); return { width: r.w, height: r.h, data: r.data, close() {} }; };
  g.OffscreenCanvas = class {
    width: number; height: number; px: Uint8ClampedArray;
    constructor(w: number, h: number) { this.width = w; this.height = h; this.px = new Uint8ClampedArray(w * h * 4); }
    getContext() {
      return {
        drawImage: (bmp: { data: Uint8ClampedArray }) => { this.px.set(bmp.data); },
        getImageData: () => ({ data: this.px.slice() }),
        putImageData: (img: { data: Uint8ClampedArray }) => { this.px.set(img.data); },
      };
    }
    async convertToBlob(opts: { type: string }) { return rawImage(opts.type, this.px, this.width, this.height); }
  };
});
after(() => { const g = globalThis as Record<string, unknown>; for (const [k, v] of Object.entries(saved)) g[k] = v; });

const blobs = new Map<string, Blob>();
const deps = (extra: Partial<TreatedPhotoDeps> = {}): TreatedPhotoDeps => ({
  toDataUrl: async (blob) => { const url = `data:${blob.type};raw,${blobs.size}`; blobs.set(url, blob); return url; },
  measure: async (href) => { const r = await readRaw(blobs.get(href)!); return { w: r.w, h: r.h }; },
  ...extra,
});
const embedded = async (svg: string): Promise<{ type: string; data: Uint8ClampedArray }> => {
  const href = /href="([^"]+)"/.exec(svg)![1]!;
  const blob = blobs.get(href)!;
  return { type: blob.type, data: (await readRaw(blob)).data };
};

test('a gradient-map look is baked into the pixels, with no filter preview in the source', async () => {
  const out = await treatedPhotoSvg(rawImage('image/jpeg', SOURCE, W, H), LOOK, deps());
  assert.equal(out.baked, true);
  assert.deepEqual([out.w, out.h], [W, H]);
  assert.doesNotMatch(out.svg, /<filter/, 'the preview filter is gone');
  const { type, data } = await embedded(out.svg);
  assert.equal(type, 'image/png', 'lossless, because the download encodes again');
  const expected = SOURCE.slice();
  applyPhotoLook(expected, W, H, LOOK);
  assert.deepEqual(data, expected, 'the pixels are the bake, exactly');
});

test('a theme variant bakes when asked, and a lut look bakes with its LUT or refuses', async () => {
  const dark = await treatedPhotoSvg(rawImage('image/png', SOURCE, W, H), LOOK, deps({ theme: 'dark' }));
  const expected = SOURCE.slice();
  applyPhotoLook(expected, W, H, LOOK, { theme: 'dark' });
  assert.deepEqual((await embedded(dark.svg)).data, expected);

  const lutLook: PhotoTreatment = { id: 'film', label: 'Film', kind: 'lut', lut: 'test/luts/film' };
  await assert.rejects(treatedPhotoSvg(rawImage('image/png', SOURCE, W, H), lutLook, deps({ loadLut: async () => null })), /LUT of the 'Film' look is unavailable/);
  const { parseLutText } = await import('../../../../engine/src/grade.ts');
  // A 2-point cube that inverts every channel.
  const cube = ['LUT_3D_SIZE 2', ...[0, 1].flatMap(b => [0, 1].flatMap(g => [0, 1].map(r => `${1 - r} ${1 - g} ${1 - b}`)))].join('\n');
  const asked: string[] = [];
  const lut = parseLutText(cube, 'film');
  const film = await treatedPhotoSvg(rawImage('image/png', SOURCE, W, H), lutLook, deps({ loadLut: async (id) => { asked.push(id); return lut; } }));
  assert.deepEqual(asked, ['test/luts/film']);
  const expectedFilm = SOURCE.slice();
  applyPhotoLook(expectedFilm, W, H, lutLook, { lut });
  assert.deepEqual((await embedded(film.svg)).data, expectedFilm);
  assert.notDeepEqual(expectedFilm, SOURCE, 'the LUT changed the photo');
});

test('the legacy kinds keep their exact SVG filter', async () => {
  const out = await treatedPhotoSvg(rawImage('image/jpeg', SOURCE, W, H), { id: 'mono', kind: 'greyscale' }, deps());
  assert.equal(out.baked, false);
  assert.match(out.svg, /<filter id="t"[^>]*><feColorMatrix type="saturate" values="0"\/>/);
});

test('every Assets download and crop path builds its treated source through the bake', () => {
  const src = readFileSync(join(HERE, '../views/assets/downloads.ts'), 'utf8');
  const fn = src.slice(src.indexOf('export async function treatedWrapperSvg'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /treatedPhotoSvg\(/, 'treatedWrapperSvg delegates to treatedPhotoSvg');
  assert.doesNotMatch(body, /wrapRasterWithTreatment\(/, 'and never wraps a raster look in the preview filter itself');
});
