// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { cpus, release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Browser } from 'playwright';
import { applyLutFrame, type GradeLut } from '../engine/src/grade.ts';
import { applyPhotoLook } from '../engine/src/photo-look.ts';
import type { PhotoTreatment } from '../engine/src/photo-treatment.ts';
import type { gradeLutWebGpu, gradeLutChainWebGpu } from '../shells/web/src/lib/webgpu/lut.ts';
import type { lutWorkspaces } from '../shells/web/src/lib/webgpu/workspace.ts';
import type { bakePhotoLookBlob } from '../shells/web/src/bridge/photo-look-bake.ts';
import type { treatedPhotoSvg } from '../shells/web/src/lib/photo-look-download.ts';
import type { createAssetsAPI } from '../shells/web/src/bridge/assets.ts';
import type { createPhotoLookWorkerClient } from '../shells/web/src/bridge/photo-look-worker-client.ts';
import { gradeLutWasm } from '../packages/node-shell/src/pixel-kernel.ts';
import { lutCases, lutPixels, lutTable } from './helpers/lut-cases.ts';

interface LutProbe {
  gradeLutWebGpu: typeof gradeLutWebGpu;
  gradeLutChainWebGpu: typeof gradeLutChainWebGpu;
  lutWorkspaces: typeof lutWorkspaces;
  applyLutFrame: typeof applyLutFrame;
  bakePhotoLookBlob: typeof bakePhotoLookBlob;
  treatedPhotoSvg: typeof treatedPhotoSvg;
  createAssetsAPI: typeof createAssetsAPI;
  createPhotoLookWorkerClient: typeof createPhotoLookWorkerClient;
  requireWebGpu(): Promise<GPUDevice>;
  resetWebGpuDevice(): void;
}
declare global { interface Window { lutProbe: LutProbe } }

function comparePixels(actual: number[], expected: Uint8ClampedArray, name: string): void {
  assert.equal(actual.length, expected.length, name);
  let maxRgbError = 0;
  for (let i = 0; i < actual.length; i++) {
    const error = Math.abs(actual[i]! - expected[i]!);
    if (i % 4 === 3) assert.equal(error, 0, `${name}: alpha ${i / 4}`);
    else maxRgbError = Math.max(maxRgbError, error);
  }
  assert.ok(maxRgbError <= 1, `${name}: maximum RGB error ${maxRgbError}`);
}

function latencySummary(samples: number[]) {
  const sorted = samples.slice().sort((a, b) => a - b);
  return { samples: sorted.length, p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1], p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
}

test('WebGPU LUT grading and photo baking conform to the portable reference', { timeout: 90_000 }, async t => {
  let browser: Browser;
  try {
    browser = await chromium.launch({ channel: process.env.LOLLY_BROWSER_CHANNEL ?? 'chrome', headless: true });
  } catch (error) {
    if (process.env.LOLLY_WEBGPU_REQUIRED === '1') throw error;
    t.skip('WebGPU browser qualification requires an installed Chromium browser.'); return;
  }
  t.after(() => browser.close());
  const repo = fileURLToPath(new URL('../', import.meta.url));
  const [entry, worker] = await Promise.all([
    build({ stdin: { contents: `
      export { gradeLutWebGpu, gradeLutChainWebGpu } from './shells/web/src/lib/webgpu/lut.ts';
      export { lutWorkspaces } from './shells/web/src/lib/webgpu/workspace.ts';
      export { applyLutFrame } from './engine/src/grade.ts';
      export { bakePhotoLookBlob } from './shells/web/src/bridge/photo-look-bake.ts';
      export { treatedPhotoSvg } from './shells/web/src/lib/photo-look-download.ts';
      export { createAssetsAPI } from './shells/web/src/bridge/assets.ts';
      export { createPhotoLookWorkerClient } from './shells/web/src/bridge/photo-look-worker-client.ts';
      export { requireWebGpu, resetWebGpuDevice } from './shells/web/src/lib/webgpu/device.ts';
    `, resolveDir: repo }, bundle: true, write: false, format: 'esm', platform: 'browser' }),
    build({ entryPoints: [fileURLToPath(new URL('../shells/web/src/bridge/photo-look.worker.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser' }),
  ]);
  const server = createServer((req, res) => {
    if (req.url === '/entry.js' || req.url === '/photo-look.worker.ts') {
      res.setHeader('content-type', 'text/javascript'); res.end(req.url === '/entry.js' ? entry.outputFiles[0]!.text : worker.outputFiles[0]!.text);
    } else {
      res.setHeader('content-type', 'text/html');
      res.end('<!doctype html><script type="module">import * as probe from "/entry.js"; window.lutProbe=probe;</script>');
    }
  });
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('The GPU test server did not start.');
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => Boolean(window.lutProbe));
  const support = await page.evaluate(async () => {
    if (!navigator.gpu) return null;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    return { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device,
      description: adapter.info.description, fallback: adapter.info.isFallbackAdapter };
  });
  if (!support) {
    if (process.env.LOLLY_WEBGPU_REQUIRED === '1') throw new Error('The required WebGPU adapter is unavailable.');
    t.skip('WebGPU browser qualification requires a usable compute adapter.'); return;
  }
  t.diagnostic(`GPU adapter: ${JSON.stringify(support)}`);
  for (const row of lutCases()) {
    const expected = row.pixels.slice(); applyLutFrame(expected, row.lut, row.intensity);
    assert.deepEqual(await gradeLutWasm(row.pixels, row.lut, row.intensity), expected, `${row.name}: Rust reference`);
    const actual = await page.evaluate(async wire => {
      const pixelStorage = new Uint8ClampedArray(wire.pixels.length + 12); pixelStorage.set(wire.pixels, 8);
      const source = wire.offset ? pixelStorage.subarray(8, pixelStorage.length - 4) : new Uint8ClampedArray(wire.pixels);
      const tableStorage = new Float32Array(wire.lut.data.length + 8); tableStorage.set(wire.lut.data, 4);
      const lut = { ...wire.lut, data: wire.offset ? tableStorage.subarray(4, tableStorage.length - 4) : new Float32Array(wire.lut.data) };
      const output = await window.lutProbe.gradeLutWebGpu(source, lut, wire.intensity);
      return { output: Array.from(output), source: Array.from(source) };
    }, { pixels: Array.from(row.pixels), lut: { ...row.lut, data: Array.from(row.lut.data) }, intensity: row.intensity, offset: row.pixels.byteOffset > 0 });
    comparePixels(actual.output, expected, row.name);
    assert.deepEqual(actual.source, Array.from(row.pixels), `${row.name}: original pixels`);
    if (['identity', 'constant ties', 'zero intensity', 'negative intensity'].includes(row.name)) assert.deepEqual(actual.output, Array.from(expected), row.name);
  }

  const source = lutPixels(64); for (let i = 3; i < source.length; i += 4) source[i] = 255;
  const lut = lutTable();
  const look: PhotoTreatment = { id: 'conformance', kind: 'lut', lut: 'test/conformance', amount: 62.5, contrast: 12, lightness: -6,
    themes: { dark: { amount: 23, contrast: 10 } } };
  const photo = await page.evaluate(async wire => {
    const OriginalWorker = window.Worker;
    let createdWorkers = 0;
    window.Worker = class extends OriginalWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) { super(...args); createdWorkers++; }
    };
    const pixels = new Uint8ClampedArray(wire.pixels);
    const table = { ...wire.lut, data: new Float32Array(wire.lut.data) };
    const canvas = new OffscreenCanvas(8, 8), ctx = canvas.getContext('2d')!;
    ctx.putImageData(new ImageData(pixels, 8, 8), 0, 0);
    const original = await canvas.convertToBlob({ type: 'image/png' });
    const read = async (blob: Blob) => {
      const bitmap = await createImageBitmap(blob); ctx.clearRect(0, 0, 8, 8); ctx.drawImage(bitmap, 0, 0); bitmap.close();
      return Array.from(ctx.getImageData(0, 0, 8, 8).data);
    };
    const started = performance.now();
    const baked = await window.lutProbe.bakePhotoLookBlob({ blob: original, look: wire.look, lut: table, theme: 'dark' });
    const bakeMs = performance.now() - started;
    const actual = await read(baked);
    const download = await window.lutProbe.treatedPhotoSvg(original, wire.look, {
      theme: 'dark', loadLut: async () => table, measure: async () => ({ w: 8, h: 8 }),
      toDataUrl: blob => new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
      }),
    });
    const href = /href="([^"]+)"/.exec(download.svg)?.[1];
    if (!href) throw new Error('The treated download did not embed its baked image.');
    const palette = { id: 'test/palette/photo-treatments', type: 'palette', tags: ['palette', 'photo-treatments'], version: '1', tier: 'core', formats: [{ format: 'json', url: '/p.json' }] };
    const upload = { id: 'user/1/photo', type: 'raster', format: 'png', version: '1', blob: original, width: 8, height: 8 };
    const db = {
      get: async (store: string, key: string) => {
        if (store === 'user-assets' && key === upload.id) return upload;
        if (store === 'asset-meta' && key === palette.id) return palette;
        if (store === 'asset-blob' && key === `${palette.id}:json:1`) return new Blob([JSON.stringify({ treatments: [wire.look] })]);
        return undefined;
      },
      getAll: async (store: string) => store === 'asset-meta' ? [palette] : [],
    };
    const assets = window.lutProbe.createAssetsAPI(db as never);
    const getBlob = assets._getBlob.bind(assets);
    const cube = `LUT_3D_SIZE ${table.size}\n` + Array.from({ length: table.data.length / 3 }, (_, i) => Array.from(table.data.subarray(i * 3, i * 3 + 3)).join(' ')).join('\n');
    assets._getBlob = (id, opts) => id === wire.look.lut ? Promise.resolve(new Blob([cube])) : getBlob(id, opts);
    const options = { tokenSelection: { '': 'dark' } };
    const ref = await assets.get(`${upload.id}?treatment=${wire.look.id}`, options);
    const cached = await assets.get(ref.id, options);
    window.Worker = OriginalWorker;
    return { actual, download: await read(await (await fetch(href)).blob()), baked: download.baked, bakeMs,
      asset: await read(await (await fetch(ref.url)).blob()), recipe: ref.meta?.lookRecipe, cacheHit: cached.url === ref.url, createdWorkers };
  }, { pixels: Array.from(source), lut: { ...lut, data: Array.from(lut.data) }, look });
  const expectedPhoto = source.slice(); applyPhotoLook(expectedPhoto, 8, 8, look, { theme: 'dark', lut });
  comparePixels(photo.actual, expectedPhoto, 'worker photo bake');
  comparePixels(photo.download, expectedPhoto, 'treated download');
  comparePixels(photo.asset, expectedPhoto, 'assets bridge bake');
  assert.equal(photo.recipe, 'lut-webgpu-v1'); assert.equal(photo.cacheHit, true);
  assert.equal(photo.baked, true);
  assert.equal(photo.createdWorkers, 1, 'bake, download and asset reuse one LUT worker');
  assert.equal(await page.evaluate(async () => {
    const handler = window.onmessage;
    const entry = '/photo-look.worker.ts';
    await import(entry);
    return window.onmessage === handler;
  }), true, 'a shared worker chunk leaves the main message handler intact');

  const chain = await page.evaluate(async wire => {
    const api = window.lutProbe;
    const pixels = new Uint8ClampedArray(wire.pixels);
    const first = { ...wire.lut, data: new Float32Array(wire.lut.data) };
    const second: GradeLut = { kind: '1d', size: 2, title: 'Invert', data: new Float32Array([1, 1, 1, 0, 0, 0]), domainMin: [0, 0, 0], domainMax: [1, 1, 1] };
    const steps = [{ lut: first, intensity: 0.75 }, { lut: second, intensity: 0 }, { lut: second, intensity: 0.4 }];
    let sequential = pixels;
    for (const step of steps) sequential = await api.gradeLutWebGpu(sequential, step.lut, step.intensity);
    const device = await api.requireWebGpu();
    const create = device.createBuffer.bind(device), write = device.queue.writeBuffer.bind(device.queue);
    let created = 0, frameUploads = 0, maps = 0;
    device.createBuffer = descriptor => { created++; return create(descriptor); };
    device.queue.writeBuffer = (...args) => { if (args[0].label === 'LUT source') frameUploads++; write(...args); };
    const workspace = api.lutWorkspaces.acquire(device, pixels.byteLength, first.data.byteLength + second.data.byteLength);
    const map = workspace.readback.mapAsync.bind(workspace.readback);
    workspace.readback.mapAsync = (...args) => { maps++; return map(...args); };
    const combined = await api.gradeLutChainWebGpu(pixels, steps);
    const shorter = await api.gradeLutWebGpu(pixels.subarray(0, 4), first, 0.75);
    device.createBuffer = create; device.queue.writeBuffer = write; workspace.readback.mapAsync = map;
    let maximum = pixels;
    const maximumSteps = Array.from({ length: 8 }, (_, i) => ({ lut: i % 2 ? second : first, intensity: 0.4 }));
    for (const step of maximumSteps) maximum = await api.gradeLutWebGpu(maximum, step.lut, step.intensity);
    const maximumCombined = await api.gradeLutChainWebGpu(pixels, maximumSteps);
    const oddCombined = await api.gradeLutChainWebGpu(pixels, maximumSteps.slice(0, 1));
    const oddSequential = await api.gradeLutWebGpu(pixels, first, 0.4);
    let limit = '';
    try { await api.gradeLutChainWebGpu(pixels, Array(9).fill(steps[0])); } catch (error) { limit = error instanceof Error && 'code' in error ? String(error.code) : ''; }
    return { combined: Array.from(combined), sequential: Array.from(sequential), source: Array.from(pixels), created, frameUploads, maps,
      shorterLength: shorter.length, retained: api.lutWorkspaces.stats(device), limit,
      maximumEqual: maximum.every((value, i) => value === maximumCombined[i]), oddEqual: oddSequential.every((value, i) => value === oddCombined[i]) };
  }, { pixels: Array.from(lutPixels()), lut: { ...lut, data: Array.from(lut.data) } });
  assert.deepEqual(chain.combined, chain.sequential, 'resident chain equals sequential GPU RGBA8 passes');
  assert.deepEqual(chain.source, Array.from(lutPixels()));
  assert.equal(chain.created, 3, 'warm jobs allocate only the three ephemeral LUT tables');
  assert.equal(chain.frameUploads, 2); assert.equal(chain.maps, 2, 'one upload/readback per operation');
  assert.equal(chain.shorterLength, 4, 'smaller jobs return only their owned bytes');
  assert.equal(chain.limit, 'WEBGPU_LIMIT');
  assert.equal(chain.maximumEqual, true, 'all eight aligned parameter slots and ping-pong passes agree');
  assert.equal(chain.oddEqual, true);
  assert.equal(chain.retained.capacity, lutPixels().byteLength);

  const cleanup = await page.evaluate(async () => {
    const api = window.lutProbe;
    const device = await api.requireWebGpu();
    const createBuffer = device.createBuffer.bind(device);
    const abort = new AbortController();
    let liveBytes = 0, peakBytes = 0, created = 0, destroyed = 0;
    device.createBuffer = descriptor => {
      const buffer = createBuffer(descriptor);
      liveBytes += descriptor.size; peakBytes = Math.max(peakBytes, liveBytes); created++;
      const destroy = buffer.destroy.bind(buffer);
      let released = false;
      buffer.destroy = () => {
        if (!released) { released = true; liveBytes -= descriptor.size; destroyed++; }
        destroy();
      };
      if (descriptor.label === 'LUT readback') {
        const map = buffer.mapAsync.bind(buffer);
        buffer.mapAsync = (...args) => {
          const pending = map(...args);
          queueMicrotask(() => abort.abort(new DOMException('Cancelled during readback', 'AbortError')));
          return pending;
        };
      }
      return buffer;
    };
    const pixels = new Uint8ClampedArray(128 * 128 * 4).fill(64);
    const lut: GradeLut = { kind: '1d', size: 2, data: new Float32Array([0, 0, 0, 1, 1, 1]), domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: 'Identity' };
    let failure = '';
    try { await api.gradeLutWebGpu(pixels, lut, 1, abort.signal); }
    catch (error) { failure = error instanceof Error ? error.name : ''; }
    finally { device.createBuffer = createBuffer; }
    const recovered = await api.gradeLutWebGpu(pixels, lut);
    let malformed = '';
    try { await api.gradeLutWebGpu(new Uint8ClampedArray(3), lut); }
    catch (error) { malformed = error instanceof Error ? error.message : ''; }
    return { failure, liveBytes, peakBytes, created, destroyed, original: pixels.every(value => value === 64),
      recovered: recovered.every(value => value === 64), malformed };
  });
  assert.equal(cleanup.failure, 'AbortError');
  assert.equal(cleanup.created, 5); assert.equal(cleanup.destroyed, cleanup.created); assert.equal(cleanup.liveBytes, 0);
  assert.equal(cleanup.original, true); assert.equal(cleanup.recovered, true); assert.match(cleanup.malformed, /RGBA8/);

  const recovery = await page.evaluate(async () => {
    const api = window.lutProbe;
    const pixels = new Uint8ClampedArray([10, 20, 30, 40]);
    const lut: GradeLut = { kind: '1d', size: 2, data: new Float32Array([0, 0, 0, 1, 1, 1]), domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: 'Identity' };
    const abort = new AbortController();
    const pending = api.gradeLutWebGpu(pixels, lut, 1, abort.signal);
    abort.abort(new DOMException('Cancelled', 'AbortError'));
    let cancellation = '';
    try { await pending; } catch (error) { cancellation = error instanceof Error ? error.name : ''; }
    const device = await api.requireWebGpu(); device.destroy(); await device.lost;
    let loss = '';
    try { await api.gradeLutWebGpu(pixels, lut); } catch (error) { loss = error instanceof Error && 'code' in error ? String(error.code) : ''; }
    api.resetWebGpuDevice();
    return { cancellation, loss, recovered: Array.from(await api.gradeLutWebGpu(pixels, lut)) };
  });
  assert.equal(recovery.cancellation, 'AbortError'); assert.equal(recovery.loss, 'WEBGPU_DEVICE_LOST');
  assert.deepEqual(recovery.recovered, [10, 20, 30, 40]);

  if (process.env.LOLLY_WEBGPU_REPORT) {
    const timingPage = await browser.newPage();
    await timingPage.goto(`http://127.0.0.1:${address.port}/`);
    await timingPage.waitForFunction(() => Boolean(window.lutProbe));
    const timings = await timingPage.evaluate(async wire => {
      const table = { ...wire, data: new Float32Array(wire.data) };
      const pixels = new Uint8ClampedArray(1920 * 1080 * 4);
      for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 17 + 31) & 255;
      const cpu: number[] = [], gpu: number[] = [];
      for (let run = 0; run < 5; run++) {
        const input = pixels.slice(); let start = performance.now(); window.lutProbe.applyLutFrame(input, table, 0.75); const cpuMs = performance.now() - start;
        start = performance.now(); await window.lutProbe.gradeLutWebGpu(pixels, table, 0.75); const gpuMs = performance.now() - start;
        if (run > 0) { cpu.push(cpuMs); gpu.push(gpuMs); }
      }
      for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
      const canvas = new OffscreenCanvas(1920, 1080);
      canvas.getContext('2d')!.putImageData(new ImageData(pixels, 1920, 1080), 0, 0);
      const original = await canvas.convertToBlob({ type: 'image/png' });
      const bakeMs: number[] = [], freshWorkerMs: number[] = [];
      const request = { blob: original, lut: table, output: 'image/png' as const,
        look: { id: 'timing', kind: 'lut' as const, amount: 75, contrast: 12, lightness: -6 } };
      const fresh = async () => {
        const client = window.lutProbe.createPhotoLookWorkerClient({ createWorker: () => new Worker('/photo-look.worker.ts', { type: 'module' }), onError() {} });
        const start = performance.now();
        try { await client.run(request); freshWorkerMs.push(performance.now() - start); }
        finally { client.dispose(); }
      };
      for (let run = 0; run < 10; run++) {
        if (run > 0 && run % 2) await fresh();
        const start = performance.now();
        await window.lutProbe.bakePhotoLookBlob(request);
        bakeMs.push(performance.now() - start);
        if (run > 0 && !(run % 2)) await fresh();
      }
      const pixelsAfter = new Uint8ClampedArray(pixels);
      const cancellation = new AbortController();
      const cancelled = window.lutProbe.bakePhotoLookBlob({ blob: original, lut: table, look: { id: 'timing', kind: 'lut' } }, { signal: cancellation.signal });
      const cancelStarted = performance.now();
      setTimeout(() => cancellation.abort(), 5);
      let cancelledName = '';
      try { await cancelled; } catch (error) { cancelledName = error instanceof Error ? error.name : ''; }
      const cancelMs = performance.now() - cancelStarted;
      const afterCancel = await window.lutProbe.bakePhotoLookBlob({ blob: original, lut: table, look: { id: 'timing', kind: 'lut' } });
      const bitmap = await createImageBitmap(afterCancel);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close();
      const expected = pixelsAfter.slice(); window.lutProbe.applyLutFrame(expected, table);
      const actual = canvas.getContext('2d')!.getImageData(0, 0, 1920, 1080).data;
      let maxRgbError = 0;
      for (let i = 0; i < actual.length; i++) maxRgbError = Math.max(maxRgbError, Math.abs(actual[i]! - expected[i]!));
      return { width: 1920, height: 1080, cpuMs: cpu, gpuUploadDispatchReadbackMs: gpu,
        completePngBakeMs: bakeMs, coldPngBakeMs: bakeMs[0], warmPngBakeMs: bakeMs.slice(1),
        comparisonFreshWorkerPngBakeMs: freshWorkerMs,
        retained: window.lutProbe.lutWorkspaces.stats(await window.lutProbe.requireWebGpu()), cancellation: { name: cancelledName, callerMs: cancelMs, recoveredRgbError: maxRgbError } };
    }, { ...lut, data: Array.from(lut.data) });
    await timingPage.close();
    assert.equal(timings.cancellation.name, 'AbortError');
    assert.ok(timings.cancellation.recoveredRgbError <= 1, 'the next complete bake recovers after worker cancellation');
    const report = { date: new Date().toISOString(), browser: browser.version(), node: process.version, adapter: support,
      machine: { platform: process.platform, architecture: process.arch, processor: cpus()[0]?.model, release: release() },
      testAdapter: process.env.LOLLY_WEBGPU_TEST_ADAPTER ?? 'default', cases: lutCases().map(row => row.name),
      workerPhotoBakeMs: photo.bakeMs, timings, cleanup, chain: { created: chain.created, frameUploads: chain.frameUploads, readbacks: chain.maps, retained: chain.retained },
      completeBakeSummary: { warm: latencySummary(timings.warmPngBakeMs), freshWorker: latencySummary(timings.comparisonFreshWorkerPngBakeMs) },
      note: 'GPU operation: one warmup and four samples, including admission/upload/dispatch/readback. Complete PNG bake: one cold-worker/device sample and nine warm samples, including decode, contrast/lightness, LUT and encode. Each warm bake is paired with a fresh-worker bake of the same implementation; order alternates. Source PNG preparation is excluded. Cancellation reports caller latency; worker acknowledgement is separately enforced before reuse. Small samples and uncontrolled machine contention limit conclusions.' };
    mkdirSync(dirname(process.env.LOLLY_WEBGPU_REPORT), { recursive: true });
    writeFileSync(process.env.LOLLY_WEBGPU_REPORT, JSON.stringify(report, null, 2) + '\n');
  }
});
