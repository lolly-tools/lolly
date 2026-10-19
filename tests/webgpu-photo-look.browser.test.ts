// SPDX-License-Identifier: MPL-2.0
/**
 * The GPU photo look recipes (plan 295 phase 1) against the TypeScript reference,
 * engine/src/photo-look.ts. Gradient-map, greyscale and duotone looks run over every
 * 8-bit grey, a colour spread and a transparent pixel: alpha is exact, RGB differs by
 * at most one code value, and a zero amount is exact. Chunk seams and offset views
 * give the same bytes as one pass. The worker bake, the Assets download and the
 * assets bridge use the GPU recipe and carry each kind's recipe id. Cancellation
 * releases the workspace, and the next look runs after a device loss and reset.
 *
 * Runs in the browser shard (software WebGPU in CI). Without a browser or adapter it
 * skips, unless LOLLY_WEBGPU_REQUIRED=1 asks for a failure instead.
 *
 * Run: node --test tests/webgpu-photo-look.browser.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { applyPhotoLook } from '../engine/src/photo-look.ts';
import type { PhotoTreatment } from '../engine/src/photo-treatment.ts';
import type * as Probe from './helpers/webgpu-photo-look-probe-entry.ts';
import { launchWebGpuBrowser, webGpuBrowserEngine } from './helpers/webgpu-browser.ts';
import type { QualificationBrowser } from './helpers/webgpu-local-receiver.ts';

declare global { interface Window { lookProbe: typeof Probe } }

const GRADIENT: PhotoTreatment = {
  id: 'grade', kind: 'gradient-map', stops: ['#1b2a33', '#7a9a8c', '#f4f1ea'], amount: 90, contrast: 12, lightness: 6,
  themes: { dark: { stops: ['#050608', '#1b2a33', '#b8d4c8'], amount: 95, contrast: 20, lightness: -15 } },
};
const MONO: PhotoTreatment = { id: 'mono', kind: 'greyscale', amount: 70, contrast: 18 };
const DUO: PhotoTreatment = { id: 'duo', kind: 'duotone', shadow: '#000033', mid: '#ff6600', highlight: '#ffffcc', amount: 85 };

const CASES: Array<{ name: string; look: PhotoTreatment; theme?: string; exact?: boolean }> = [
  { name: 'gradient map', look: GRADIENT },
  { name: 'gradient map, dark variant', look: GRADIENT, theme: 'dark' },
  { name: 'gradient map, close stops', look: { id: 'close', kind: 'gradient-map', amount: 37.5, lightness: -30,
    stops: [{ color: '#ff0000', pos: 0 }, { color: '#00ff00', pos: 50 }, { color: '#0000ff', pos: 50.2 }, { color: '#ffff00', pos: 100 }] } },
  { name: 'gradient map, two stops', look: { id: 'two', kind: 'gradient-map', stops: ['#0c322c', '#ffffff'], contrast: -40, lightness: 20 } },
  { name: 'gradient map, zero amount', look: { id: 'zero', kind: 'gradient-map', stops: ['#000000', '#ffffff'], amount: 0 }, exact: true },
  { name: 'greyscale', look: { id: 'grey', kind: 'greyscale' } },
  { name: 'greyscale, graded blend', look: { id: 'grey-graded', kind: 'greyscale', amount: 50, contrast: 30, lightness: 10 } },
  { name: 'greyscale, zero amount', look: { id: 'grey-zero', kind: 'greyscale', amount: 0 }, exact: true },
  { name: 'duotone', look: { id: 'duotone', kind: 'duotone', shadow: '#47190d', highlight: '#ffd3bd' } },
  { name: 'duotone, three colours', look: { id: 'trio', kind: 'duotone', shadow: '#000033', mid: '#ff6600', highlight: '#ffffcc', amount: 62.5, contrast: -20 } },
  { name: 'duotone, full lightness', look: { id: 'bright', kind: 'duotone', shadow: '#123', highlight: '#fed', lightness: 100 } },
];

/** Every grey, one transparent pixel that keeps its colour, then a deterministic colour spread. */
function corpus(): Uint8ClampedArray {
  const data = new Uint8ClampedArray((257 + 4096) * 4);
  let state = 295;
  for (let i = 0; i < data.length; i++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; data[i] = state >>> 24; }
  for (let v = 0; v < 256; v++) data.set([v, v, v, 255], v * 4);
  data.set([200, 40, 90, 0], 256 * 4);
  return data;
}

/** An opaque 16x16 photo, so PNG encoding keeps every RGB byte. */
function photoPixels(): Uint8ClampedArray {
  const data = corpus().slice(0, 16 * 16 * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return data;
}

function comparePixels(actual: number[], expected: Uint8ClampedArray, name: string): { maxRgbError: number; differing: number } {
  assert.equal(actual.length, expected.length, name);
  let maxRgbError = 0, differing = 0;
  for (let i = 0; i < actual.length; i++) {
    const error = Math.abs(actual[i]! - expected[i]!);
    if (i % 4 === 3) assert.equal(error, 0, `${name}: alpha ${i / 4}`);
    else { maxRgbError = Math.max(maxRgbError, error); if (error) differing++; }
  }
  assert.ok(maxRgbError <= 1, `${name}: maximum RGB error ${maxRgbError}`);
  return { maxRgbError, differing };
}

function reference(pixels: Uint8ClampedArray, look: PhotoTreatment, theme?: string): Uint8ClampedArray {
  const out = pixels.slice();
  applyPhotoLook(out, out.length / 4, 1, look, theme ? { theme } : {});
  return out;
}

test('GPU gradient-map, greyscale and duotone looks conform to the TypeScript reference', { timeout: 120_000 }, async t => {
  const engine = webGpuBrowserEngine();
  if (engine === 'tauri-product-macos' || engine === 'tauri-product-ios') {
    t.skip('Product qualification runs the LUT suite; photo looks are compared in browsers.'); return;
  }
  let browser: QualificationBrowser;
  try {
    browser = await launchWebGpuBrowser();
  } catch (error) {
    if (process.env.LOLLY_WEBGPU_REQUIRED === '1') throw error;
    t.skip(`WebGPU photo look conformance needs a browser that launches: ${String(error)}`); return;
  }
  t.after(() => browser.close());
  const [entry, worker] = await Promise.all([
    build({ entryPoints: [fileURLToPath(new URL('./helpers/webgpu-photo-look-probe-entry.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser' }),
    build({ entryPoints: [fileURLToPath(new URL('../shells/web/src/bridge/photo-look.worker.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser' }),
  ]);
  const server = createServer((req, res) => {
    if (browser.handleRequest?.(req, res)) return;
    if (req.url === '/entry.js' || req.url === '/photo-look.worker.ts') {
      res.setHeader('content-type', 'text/javascript'); res.end(req.url === '/entry.js' ? entry.outputFiles[0]!.text : worker.outputFiles[0]!.text);
    } else {
      res.setHeader('content-type', 'text/html');
      res.end(`<!doctype html><title>Lolly WebGPU Photo Looks</title><p>Isolated local WebGPU conformance. No workspace or personal data is loaded.</p><script type="module">import * as probe from "/entry.js"; window.lookProbe={...probe}; ${browser.receiverScript ?? ''}</script>`);
    }
  });
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('The GPU test server did not start.');
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => Boolean(window.lookProbe));
  const adapter = await page.evaluate(async () => {
    if (!navigator.gpu) return { status: 'no API' };
    const found = await navigator.gpu.requestAdapter().catch(() => null);
    return found ? { status: 'available', vendor: found.info.vendor, architecture: found.info.architecture, fallback: found.info.isFallbackAdapter } : { status: 'no adapter' };
  });
  if (adapter.status !== 'available') {
    if (process.env.LOLLY_WEBGPU_REQUIRED === '1') throw new Error(`The required WebGPU adapter is unavailable: ${adapter.status}`);
    t.skip('WebGPU photo look conformance needs a usable compute adapter.'); return;
  }
  t.diagnostic(`GPU adapter: ${JSON.stringify(adapter)}`);

  const source = corpus();
  for (const row of CASES) {
    const expected = reference(source, row.look, row.theme);
    const actual = await page.evaluate(async wire => {
      const pixels = new Uint8ClampedArray(wire.pixels);
      const plan = window.lookProbe.photoLookPixelPlan(wire.look, wire.theme ? { theme: wire.theme } : {});
      const output = await window.lookProbe.applyPhotoLookWebGpu(pixels, plan);
      return { output: Array.from(output), source: Array.from(pixels) };
    }, { pixels: Array.from(source), look: row.look, theme: row.theme });
    const stats = comparePixels(actual.output, expected, row.name);
    t.diagnostic(`${row.name}: maximum RGB error ${stats.maxRgbError}, ${stats.differing} of ${source.length * 3 / 4} channels differ`);
    assert.deepEqual(actual.source, Array.from(source), `${row.name}: the source is untouched`);
    if (row.exact) {
      assert.deepEqual(actual.output, Array.from(expected), `${row.name}: exact`);
      assert.deepEqual(actual.output, Array.from(source), `${row.name}: a zero amount with no grade leaves the photo as it was`);
    }
  }

  const seams = await page.evaluate(async wire => {
    const api = window.lookProbe;
    const plan = api.photoLookPixelPlan(wire.look);
    const pixels = new Uint8ClampedArray(wire.pixels);
    const whole = await api.applyPhotoLookWebGpu(pixels, plan);
    const chunked = await api.applyPhotoLookWebGpu(pixels, plan, { chunkPixels: 1000 });
    const storage = new Uint8ClampedArray(pixels.length + 12); storage.set(pixels, 8);
    const offset = await api.applyPhotoLookWebGpu(storage.subarray(8, storage.length - 4), plan, { chunkPixels: 777 });
    // From an empty cache, a chunked run sizes the frame workspace by its chunk. A warm
    // run then reuses that workspace: one table buffer, one readback per chunk.
    const device = await api.requireWebGpu();
    api.lutWorkspaces.release(device, false);
    await api.applyPhotoLookWebGpu(pixels, plan, { chunkPixels: 1000 });
    const workspace = api.lutWorkspaces.acquire(device, 4000, 0);
    const create = device.createBuffer.bind(device), map = workspace.readback.mapAsync.bind(workspace.readback);
    let created = 0, maps = 0;
    device.createBuffer = descriptor => { created++; return create(descriptor); };
    workspace.readback.mapAsync = (...args) => { maps++; return map(...args); };
    const warm = await api.applyPhotoLookWebGpu(pixels, plan, { chunkPixels: 1000 });
    device.createBuffer = create; workspace.readback.mapAsync = map;
    const same = (a: Uint8ClampedArray) => a.length === whole.length && a.every((value, i) => value === whole[i]);
    return { chunked: same(chunked), offset: same(offset), warm: same(warm), created, maps,
      storageEdges: [storage[7], storage[storage.length - 4]], retained: api.lutWorkspaces.stats(device).capacity, count: pixels.length / 4 };
  }, { pixels: Array.from(source), look: GRADIENT });
  assert.equal(seams.chunked, true, 'chunk seams give the bytes of one pass');
  assert.equal(seams.offset, true, 'an offset view gives the bytes of the whole array');
  assert.equal(seams.warm, true);
  assert.equal(seams.created, 1, 'a warm look allocates only its table buffer');
  assert.equal(seams.maps, Math.ceil(seams.count / 1000), 'one readback per chunk');
  assert.deepEqual(seams.storageEdges, [0, 0], 'bytes around an offset view are untouched');
  assert.equal(seams.retained, 4000, 'the frame workspace is sized by the chunk, not the photo');

  const looks = [GRADIENT, MONO, DUO];
  const photo = photoPixels();
  const paths = await page.evaluate(async wire => {
    const api = window.lookProbe;
    const size = 16;
    const canvas = new OffscreenCanvas(size, size), ctx = canvas.getContext('2d')!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(wire.pixels), size, size), 0, 0);
    const original = await canvas.convertToBlob({ type: 'image/png' });
    const read = async (blob: Blob) => {
      const bitmap = await createImageBitmap(blob); ctx.clearRect(0, 0, size, size); ctx.drawImage(bitmap, 0, 0); bitmap.close();
      return Array.from(ctx.getImageData(0, 0, size, size).data);
    };
    const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
    });
    const worker: Record<string, number[]> = {};
    for (const look of wire.looks) worker[look.id] = await read(await api.bakePhotoLookBlob({ blob: original, look, theme: 'dark' }));
    const download = await api.treatedPhotoSvg(original, wire.looks[0]!, { theme: 'dark', toDataUrl, measure: async () => ({ w: size, h: size }) });
    const href = /href="([^"]+)"/.exec(download.svg)?.[1];
    if (!href) throw new Error('The treated download did not embed its baked image.');
    const palette = { id: 'test/palette/photo-treatments', type: 'palette', tags: ['palette', 'photo-treatments'], version: '1', tier: 'core', formats: [{ format: 'json', url: '/p.json' }] };
    const upload = { id: 'user/1/photo', type: 'raster', format: 'png', version: '1', blob: original, width: size, height: size };
    const db = {
      get: async (store: string, key: string) => {
        if (store === 'user-assets' && key === upload.id) return upload;
        if (store === 'asset-meta' && key === palette.id) return palette;
        if (store === 'asset-blob' && key === `${palette.id}:json:1`) return new Blob([JSON.stringify({ treatments: wire.looks })]);
        return undefined;
      },
      getAll: async (store: string) => store === 'asset-meta' ? [palette] : [],
    };
    const assets = api.createAssetsAPI(db as never);
    const bridge: Record<string, { pixels: number[]; recipe: unknown; cacheHit: boolean }> = {};
    for (const look of wire.looks) {
      const options = { tokenSelection: { '': 'dark' } };
      const ref = await assets.get(`${upload.id}?treatment=${look.id}`, options);
      const again = await assets.get(ref.id, options);
      bridge[look.id] = { pixels: await read(await (await fetch(ref.url)).blob()), recipe: ref.meta?.lookRecipe, cacheHit: again.url === ref.url };
    }
    return { worker, download: await read(await (await fetch(href)).blob()), baked: download.baked, bridge };
  }, { pixels: Array.from(photo), looks });
  const recipes: Record<string, string> = { grade: 'gradient-map-webgpu-v1', mono: 'greyscale-webgpu-v1', duo: 'duotone-webgpu-v1' };
  for (const look of looks) {
    const expected = photo.slice(); applyPhotoLook(expected, 16, 16, look, { theme: 'dark' });
    comparePixels(paths.worker[look.id]!, expected, `${look.id}: worker bake`);
    comparePixels(paths.bridge[look.id]!.pixels, expected, `${look.id}: assets bridge bake`);
    assert.equal(paths.bridge[look.id]!.recipe, recipes[look.id], `${look.id}: recipe`);
    assert.equal(paths.bridge[look.id]!.cacheHit, true, `${look.id}: a second resolve reuses the bake`);
  }
  const expectedDownload = photo.slice(); applyPhotoLook(expectedDownload, 16, 16, GRADIENT, { theme: 'dark' });
  comparePixels(paths.download, expectedDownload, 'treated download');
  assert.equal(paths.baked, true);

  const lifecycle = await page.evaluate(async wire => {
    const api = window.lookProbe;
    const plan = api.photoLookPixelPlan(wire.look);
    const pixels = new Uint8ClampedArray(wire.pixels);
    const device = await api.requireWebGpu();
    const expected = Array.from(await api.applyPhotoLookWebGpu(pixels, plan));
    const workspace = api.lutWorkspaces.acquire(device, pixels.byteLength, 0);
    const abort = new AbortController();
    const map = workspace.readback.mapAsync.bind(workspace.readback);
    workspace.readback.mapAsync = (...args) => {
      const pending = map(...args);
      queueMicrotask(() => abort.abort(new DOMException('Cancelled during readback', 'AbortError')));
      return pending;
    };
    let cancelled = '';
    try { await api.applyPhotoLookWebGpu(pixels, plan, { signal: abort.signal }); } catch (error) { cancelled = error instanceof Error ? error.name : ''; }
    const released = api.lutWorkspaces.stats(device).capacity;
    const recovered = Array.from(await api.applyPhotoLookWebGpu(pixels, plan));
    device.destroy(); await device.lost;
    let loss = '';
    try { await api.applyPhotoLookWebGpu(pixels, plan); } catch (error) { loss = error instanceof Error && 'code' in error ? String(error.code) : ''; }
    api.resetWebGpuDevice();
    const afterLoss = Array.from(await api.applyPhotoLookWebGpu(pixels, plan));
    let malformed = '';
    try { await api.applyPhotoLookWebGpu(new Uint8ClampedArray(3), plan); } catch (error) { malformed = error instanceof Error ? error.message : ''; }
    const same = (a: number[]) => a.length === expected.length && a.every((value, i) => value === expected[i]);
    return { cancelled, released, recovered: same(recovered), loss, afterLoss: same(afterLoss), malformed, untouched: Array.from(pixels).every((value, i) => value === wire.pixels[i]) };
  }, { pixels: Array.from(source.subarray(0, 1024)), look: DUO });
  assert.equal(lifecycle.cancelled, 'AbortError');
  assert.equal(lifecycle.released, 0, 'a cancelled look releases its workspace');
  assert.equal(lifecycle.recovered, true, 'the next look runs after a cancellation');
  assert.equal(lifecycle.loss, 'WEBGPU_DEVICE_LOST');
  assert.equal(lifecycle.afterLoss, true, 'the next look runs after a device reset');
  assert.match(lifecycle.malformed, /RGBA8/);
  assert.equal(lifecycle.untouched, true);
});
