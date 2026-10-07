// SPDX-License-Identifier: MPL-2.0
/**
 * The web assets bridge bakes a photo look into an upload (plan 291 W7). Before W7 a
 * `user/...?treatment=<lookId>` id went straight to the user store, missed, and the
 * picture was dropped. Now the look is parsed first, the base upload is read, the
 * engine look is applied to its pixels (the document's theme picks the variant), and
 * one bake serves every later resolve.
 *
 * Node has no image decoder, so createImageBitmap and OffscreenCanvas are stood in
 * for by a raw-RGBA "image" format (an 8-byte size header and the pixels). Node has
 * no global Worker, so this runs the main-thread path the Worker path shares.
 *
 * Run: node --test shells/web/src/bridge/photo-look-bridge.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createAssetsAPI } from './assets.ts';
import { applyPhotoLook } from '../../../../engine/src/photo-look.ts';
import type { PhotoTreatment } from '../../../../engine/src/photo-treatment.ts';
import { bakePhotoLookInRealm } from './photo-look-raster.ts';

const LOOKS: PhotoTreatment[] = [{
  id: 'grade', kind: 'gradient-map', stops: ['#1b2a33', '#7a9a8c', '#f4f1ea'], amount: 90, contrast: 12,
  themes: { dark: { stops: ['#050608', '#1b2a33', '#b8d4c8'], amount: 95 } },
}, { id: 'film', kind: 'lut', lut: 'test/lut/film', amount: 80 }];
const W = 8, H = 4;

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

function fakeDb() {
  const palette = { id: 'test/palette/photo-treatments', type: 'palette', tags: ['palette', 'photo-treatments'], version: '1', tier: 'core', formats: [{ format: 'json', url: '/p.json' }] };
  const upload = { id: 'user/1/photo', type: 'raster', format: 'jpg', version: '1', blob: rawImage('image/jpeg', SOURCE, W, H), width: W, height: H, meta: { name: 'photo' } };
  const reads: string[] = [];
  const db = {
    reads,
    get: async (store: string, key: string) => {
      reads.push(`${store}:${key}`);
      if (store === 'user-assets') return key === upload.id ? upload : undefined;
      if (store === 'asset-meta') return key === palette.id ? palette : undefined;
      if (store === 'asset-blob') return key === `${palette.id}:json:1` ? new Blob([JSON.stringify({ treatments: LOOKS })]) : undefined;
      return undefined;
    },
    getAll: async (store: string) => (store === 'asset-meta' ? [palette] : []),
  };
  return db;
}

async function bakedPixels(url: string): Promise<Uint8ClampedArray> {
  return (await readRaw(await (await fetch(url)).blob())).data;
}

test('an upload with a look resolves to baked pixels, and the theme picks the variant', async () => {
  const db = fakeDb();
  const api = createAssetsAPI(db as never);
  const light = await api.get('user/1/photo?treatment=grade');
  assert.equal(light.id, 'user/1/photo?treatment=grade', 'the treated id is kept');
  assert.equal(light.source, 'user');
  assert.equal(light.format, 'jpg');
  assert.equal(light.meta?.treatment, 'grade');
  const expected = SOURCE.slice();
  applyPhotoLook(expected, W, H, LOOKS[0]!);
  assert.deepEqual(await bakedPixels(light.url), expected);

  const dark = await api.get('user/1/photo?treatment=grade', { tokenSelection: { '': 'dark' } });
  assert.equal(dark.meta?.lookTheme, 'dark');
  const expectedDark = SOURCE.slice();
  applyPhotoLook(expectedDark, W, H, LOOKS[0]!, { theme: 'dark' });
  assert.deepEqual(await bakedPixels(dark.url), expectedDark);
  assert.notEqual(dark.url, light.url);

  const again = await api.get('user/1/photo?treatment=grade', { tokenSelection: { '': 'light' } });
  assert.equal(again.url, light.url, 'a theme with no variant reuses the base bake');
  assert.ok(!db.reads.includes('user-assets:user/1/photo?treatment=grade'), 'the treated id is never looked up as an upload');
});

test('an upload with a look the pack does not declare is the plain picture, not a dropped one', async () => {
  const api = createAssetsAPI(fakeDb() as never);
  const ref = await api.get('user/1/photo?treatment=neon');
  assert.equal(ref.id, 'user/1/photo?treatment=neon');
  assert.deepEqual(await bakedPixels(ref.url), SOURCE);
  const plain = await api.get('user/1/photo');
  assert.equal(ref.url, plain.url, 'the plain picture shares the upload\'s own object URL');
});

test('an upload with a LUT look fails visibly when WebGPU is absent', async () => {
  const api = createAssetsAPI(fakeDb() as never);
  const getBlob = api._getBlob.bind(api);
  api._getBlob = async (id, opts) => id === 'test/lut/film'
    ? new Blob(['LUT_1D_SIZE 2\n0 0 0\n1 1 1\n'])
    : getBlob(id, opts);
  await assert.rejects(api.get('user/1/photo?treatment=film'), { code: 'WEBGPU_REQUIRED' });
  const plain = await api.get('user/1/photo');
  assert.deepEqual(await bakedPixels(plain.url), SOURCE, 'the original upload remains available');
});

test('LUT photo dimensions are bounded before canvas and frame allocation', async () => {
  await assert.rejects(bakePhotoLookInRealm({
    blob: rawImage('image/png', new Uint8ClampedArray([1, 2, 3, 255]), 8193, 1024),
    look: LOOKS[1]!,
    lut: { kind: '1d', size: 2, data: new Float32Array([0, 0, 0, 1, 1, 1]), domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: 'Identity' },
  }), /outside the bake limit/);
});

test('a catalog look bake is revoked when the catalog prunes its blob, so the object URL does not leak', async () => {
  const palette = { id: 'test/palette/photo-treatments', type: 'palette', tags: ['palette', 'photo-treatments'], version: '1', tier: 'core', formats: [{ format: 'json', url: '/p.json' }] };
  const photo = { id: 'test/photo/cover', type: 'raster', version: '3', tier: 'on-demand', formats: [{ format: 'jpg', url: '/cover.jpg', width: W, height: H }] };
  const blobKey = `${photo.id}:jpg:${photo.version}`;
  const deleted: string[] = [];
  const db = {
    get: async (store: string, key: string) => {
      if (store === 'asset-meta') return key === palette.id ? palette : key === photo.id ? photo : undefined;
      if (store === 'asset-blob') {
        if (key === `${palette.id}:json:1`) return new Blob([JSON.stringify({ treatments: LOOKS })]);
        if (key === blobKey) return rawImage('image/jpeg', SOURCE, W, H);
      }
      return undefined;
    },
    getAll: async (store: string) => (store === 'asset-meta' ? [palette, photo] : []),
    getAllKeys: async (store: string) => (store === 'asset-blob' ? [blobKey] : []),
    transaction: () => ({ store: { delete: async (k: string) => { deleted.push(k); } }, done: Promise.resolve() }),
  };
  const revoked: string[] = [];
  const realRevoke = URL.revokeObjectURL;
  URL.revokeObjectURL = (url: string) => { revoked.push(url); realRevoke.call(URL, url); };
  try {
    const api = createAssetsAPI(db as never);
    const light = await api.get(`${photo.id}?treatment=grade`);
    const dark = await api.get(`${photo.id}?treatment=grade`, { tokenSelection: { '': 'dark' } });
    assert.equal(dark.meta?.lookTheme, 'dark');
    assert.notEqual(light.url, dark.url);
    // The photo left the catalog: its blob is pruned, and every bake made from it goes too.
    await api._pruneStale([], new Set(), new Set());
    assert.deepEqual(deleted, [blobKey]);
    assert.ok(revoked.includes(light.url), 'the base bake is revoked');
    assert.ok(revoked.includes(dark.url), 'the dark bake is revoked');
  } finally {
    URL.revokeObjectURL = realRevoke;
  }
});
