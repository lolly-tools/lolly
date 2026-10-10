// SPDX-License-Identifier: MPL-2.0
/** P3f primitives against actual Design and SVG, with the established region limits. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';
import type { DesignDrawPage } from '../engine/src/design-draw.ts';
import type { DesignRasterResult } from '../shells/web/src/lib/webgpu/design-page.ts';
import type { renderDesignRaster } from '../shells/web/src/lib/webgpu/design-page.ts';
import type { prepareDesignRaster } from '../engine/src/design-draw-raster.ts';
import { DESIGN_RASTER_RECIPE } from '../engine/src/design-draw-raster.ts';
import { compareInBrowser, type FidelityStats } from './helpers/design-fidelity.ts';
import { createDesignGpuFixture, designGpuCases, primitiveDrawing } from './helpers/design-webgpu-fixture.ts';

interface WorkerResult extends DesignRasterResult { ok: true; png: Uint8Array }
interface RasterProbe {
  prepareDesignRaster: typeof prepareDesignRaster;
  renderDesignRaster: typeof renderDesignRaster;
  requireWebGpu(): Promise<GPUDevice>;
  resetWebGpuDevice(): void;
  render(page: DesignDrawPage, output?: { width: number; height: number; dpi?: number }): Promise<WorkerResult | { ok: false; error?: string; findings?: unknown }>;
  close(): void;
}
declare global { interface Window { designRasterProbe: RasterProbe } }
const THRESHOLD = 24, REGION_SHARE = .005;
const png = (bytes: Uint8Array) => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
const failRegions = (stats: FidelityStats) => stats.regions.filter(r => r.pixels && r.differing / r.pixels > REGION_SHARE);

/** Observe all four byte sources without modifying the established comparator. */
async function pixelDiagnostics(input: { design: string; svg: string; gpu: string; raw: number[]; width: number; height: number; regions: Array<{ id: string; x: number; y: number; w: number; h: number }> }) {
  const { width, height, regions } = input;
  const read = async (src: string) => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = new OffscreenCanvas(width, height), c = canvas.getContext('2d')!;
    c.drawImage(image, 0, 0); return c.getImageData(0, 0, width, height).data;
  };
  const [design, svg, gpu] = await Promise.all([read(input.design), read(input.svg), read(input.gpu)]);
  const raw = new Uint8Array(input.raw), rgb = (a: ArrayLike<number>, b: ArrayLike<number>, i: number) => Math.max(...[0, 1, 2].map(c => Math.abs(a[i + c]! - b[i + c]!)));
  let rawPngDifferingBytes = 0, rawPngMaxChannel = 0;
  for (let i = 0; i < raw.length; i++) { const d = Math.abs(raw[i]! - gpu[i]!); if (d) rawPngDifferingBytes++; rawPngMaxChannel = Math.max(rawPngMaxChannel, d); }
  return { threshold: 24, coordinateSlack: 0, rawPngDifferingBytes, rawPngMaxChannel, regions: regions.map(r => {
    const samples: Array<{ x: number; y: number; raw: number[]; png: number[]; design: number[]; svg: number[] }> = [];
    let pixels = 0, designRgbDifferent = 0, svgRgbDifferent = 0, designAlphaDifferent = 0, svgAlphaDifferent = 0;
    for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(height, Math.ceil(r.y + r.h)); y++) for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(width, Math.ceil(r.x + r.w)); x++) {
      pixels++; const i = (y * width + x) * 4;
      const dr = rgb(design, gpu, i) > 24, sr = rgb(svg, gpu, i) > 24, da = Math.abs(design[i + 3]! - gpu[i + 3]!) > 24, sa = Math.abs(svg[i + 3]! - gpu[i + 3]!) > 24;
      designRgbDifferent += +dr; svgRgbDifferent += +sr; designAlphaDifferent += +da; svgAlphaDifferent += +sa;
      if ((dr || sr || da || sa) && samples.length < 12) samples.push({ x, y, raw: Array.from(raw.slice(i, i + 4)), png: Array.from(gpu.slice(i, i + 4)), design: Array.from(design.slice(i, i + 4)), svg: Array.from(svg.slice(i, i + 4)) });
    }
    return { id: r.id, pixels, designRgbDifferent, svgRgbDifferent, designAlphaDifferent, svgAlphaDifferent, samples };
  }) };
}

test('opt-in static Design GPU pages preserve real renderer regions and reject comparator faults', { timeout: 180_000 }, async t => {
  const receipt: Record<string, unknown> = { status: 'not run', stage: 'fixture startup', date: new Date().toISOString(), recipe: DESIGN_RASTER_RECIPE,
    limits: { channel: THRESHOLD, regionShare: REGION_SHARE, coordinateSlack: 0 }, adapterPolicy: 'unchanged product device service', testAdapter: process.env.LOLLY_WEBGPU_TEST_ADAPTER ?? 'default' };
  const record = async () => { if (process.env.LOLLY_DESIGN_GPU_REPORT) { await mkdir(dirname(process.env.LOLLY_DESIGN_GPU_REPORT), { recursive: true }); await writeFile(process.env.LOLLY_DESIGN_GPU_REPORT, JSON.stringify(receipt, null, 2) + '\n'); } };
  const cleanup: Array<{ name: string; close(): Promise<void> }> = [];
  t.after(async () => {
    const teardown: Array<{ name: string; ok: boolean; error?: string }> = [];
    for (const resource of cleanup.reverse()) {
      try { await resource.close(); teardown.push({ name: resource.name, ok: true }); }
      catch (error) { teardown.push({ name: resource.name, ok: false, error: String(error) }); }
    }
    receipt.teardown = teardown; await record(); assert.ok(teardown.every(r => r.ok), 'all owned test resources closed');
  });
  const fixture = await createDesignGpuFixture(); cleanup.push({ name: 'loopback listener', close: fixture.close });
  Object.assign(receipt, { sources: fixture.sourceHashes, origin: fixture.origin });
  await record();
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}) });
  cleanup.push({ name: 'isolated Playwright browser', close: () => browser.close() }); receipt.browser = browser.version();
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  cleanup.push({ name: 'fresh isolated context', close: () => context.close() });
  const probe = await context.newPage(); await probe.goto(fixture.origin); await probe.waitForFunction(() => !!window.designRasterProbe);
  cleanup.push({ name: 'owned module worker', close: async () => { if (!probe.isClosed()) await probe.evaluate(() => window.designRasterProbe.close()); } });
  receipt.stage = 'worker GPU acquisition';
  const report: Array<Record<string, unknown>> = [];
  const fidelityFailures: Array<{ page: string; reference: string; regions: unknown }> = [];
  for (const { transparent, scaleX, scaleY, key, drawing: p, original } of designGpuCases()) {
    Object.assign(receipt, { currentPage: key, completedPages: report.length, stage: 'page references' }); await record();
    const width = 320 * scaleX, height = 240 * scaleY, output = { width, height, dpi: 96 * scaleX };
    const design = await context.newPage(); await design.setViewportSize({ width, height }); await design.goto(fixture.origin + '/design/' + key);
    const ground = await design.screenshot({ clip: { x: 0, y: 0, width, height }, omitBackground: true }); await design.close();
    const svg = await context.newPage(); await svg.setViewportSize({ width, height }); await svg.goto(fixture.origin + '/svg/' + key);
    const vector = await svg.screenshot({ clip: { x: 0, y: 0, width, height }, omitBackground: true }); await svg.close();
    receipt.stage = 'worker raster and PNG encode'; await record();
    const result = await probe.evaluate(async ({ page, output }) => {
      const started = performance.now(), value = await window.designRasterProbe.render(page, output);
      if (!value.ok) return value;
      return { ...value, data: Array.from(value.data), png: Array.from(value.png), completeMs: performance.now() - started };
    }, { page: p, output });
    assert.ok(result.ok, 'actual worker GPU rendering: ' + JSON.stringify(result));
    assert.equal(result.allocation.liveBytes, 0); assert.equal(result.allocation.created, result.allocation.destroyed);
    receipt.currentRaster = { identity: result.identity, allocation: result.allocation, completeMs: result.completeMs };
    receipt.stage = 'RGB region comparisons'; await record();
    const shot = png(new Uint8Array(result.png));
    const regions = [{ id: 'page', x: 0, y: 0, w: width, h: height }, ...p.ops.map(op => {
      // Keep the established four-page regions exact. Extra rotated cases use
      // their whole axis-aligned rotated bounds, with the same eight-pixel pad.
      const angle = (op.pose?.rot ?? 0) * Math.PI / 180;
      const w = original ? op.box.w : Math.abs(Math.cos(angle)) * op.box.w + Math.abs(Math.sin(angle)) * op.box.h;
      const h = original ? op.box.h : Math.abs(Math.sin(angle)) * op.box.w + Math.abs(Math.cos(angle)) * op.box.h;
      return { id: op.id, x: (op.box.x + (op.box.w - w) / 2 - 8) * scaleX, y: (op.box.y + (op.box.h - h) / 2 - 8) * scaleY, w: (w + 16) * scaleX, h: (h + 16) * scaleY };
    })];
    const compare = (a: string, b: string) => probe.evaluate<FidelityStats>(`(${compareInBrowser.toString()})(${JSON.stringify(a)},${JSON.stringify(b)},${width},${height},${JSON.stringify(regions)},24)`);
    const designStats = await compare(png(ground), shot), svgStats = await compare(png(vector), shot);
    report.push({ page: key, groundPngSha256: createHash('sha256').update(ground).digest('hex'), svgPngSha256: createHash('sha256').update(vector).digest('hex'), identity: result.identity, completeMs: result.completeMs, allocation: result.allocation, design: designStats, svg: svgStats, rgbaSha256: createHash('sha256').update(new Uint8Array(result.data)).digest('hex'), pngSha256: createHash('sha256').update(new Uint8Array(result.png)).digest('hex') });
    receipt.pages = report; receipt.stage = 'raw/PNG/reference diagnostics'; await record();
    report[report.length - 1]!.pixels = await probe.evaluate(pixelDiagnostics, { design: png(ground), svg: png(vector), gpu: shot, raw: result.data, width, height, regions });
    receipt.stage = 'PNG codec equivalence'; await record();
    for (const [reference, stats] of [['Design', designStats], ['SVG', svgStats]] as const) {
      const regions = failRegions(stats); if (regions.length) fidelityFailures.push({ page: key, reference, regions });
    }
    const codec = await probe.evaluate(async ({ bytes, raw, width, height }) => {
      const decode = async (blob: Blob) => { const bitmap = await createImageBitmap(blob), canvas = new OffscreenCanvas(width, height), c = canvas.getContext('2d')!; c.drawImage(bitmap, 0, 0); bitmap.close(); return c.getImageData(0, 0, width, height).data; };
      const preview = new OffscreenCanvas(width, height); preview.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(raw), width, height), 0, 0);
      const [a, b] = await Promise.all([decode(new Blob([new Uint8Array(bytes)], { type: 'image/png' })), decode(await preview.convertToBlob({ type: 'image/png' }))]);
      return { same: a.every((v, i) => v === b[i]), width, height };
    }, { bytes: result.png, raw: result.data, width, height });
    assert.equal(codec.same, true, 'preview and PNG consume the same GPU RGBA without a second renderer');
    if (transparent) {
      receipt.stage = 'alpha region comparisons'; await record();
      const alpha = await probe.evaluate(async ({ a, b, width, height, regions }) => {
        const read = async (src: string) => { const image = new Image(); image.src = src; await image.decode(); const canvas = new OffscreenCanvas(width, height); const c = canvas.getContext('2d')!; c.drawImage(image, 0, 0); return c.getImageData(0, 0, width, height).data; };
        const [x, y] = await Promise.all([read(a), read(b)]);
        return regions.map(r => {
          let different = 0, pixels = 0;
          for (let yy = Math.max(0, Math.floor(r.y)); yy < Math.min(height, Math.ceil(r.y + r.h)); yy++) for (let xx = Math.max(0, Math.floor(r.x)); xx < Math.min(width, Math.ceil(r.x + r.w)); xx++) {
            pixels++; const i = (yy * width + xx) * 4 + 3; if (Math.abs(x[i]! - y[i]!) > 24) different++;
          }
          return { id: r.id, pixels, different };
        });
      }, { a: png(ground), b: shot, width, height, regions });
      const failed = alpha.filter(r => r.pixels && r.different / r.pixels > REGION_SHARE);
      if (failed.length) fidelityFailures.push({ page: key, reference: 'Design alpha', regions: failed });
      report[report.length - 1]!.alpha = alpha;
    }
    if (key === 'opaque-1') {
      receipt.stage = 'negative controls'; await record();
      const controls: string[] = [];
      for (const fault of ['missing', 'shifted', 'order', 'alpha'] as const) {
        const broken = structuredClone(p);
        if (fault === 'missing') broken.ops = broken.ops.filter(op => op.id !== 'rect');
        if (fault === 'shifted') broken.ops.find(op => op.id === 'rect')!.box.x += 2;
        if (fault === 'order') broken.ops.reverse();
        if (fault === 'alpha') broken.ops.find(op => op.id === 'rect')!.opacity = 20;
        const value = await probe.evaluate(async page => { const v = await window.designRasterProbe.render(page); return v.ok ? Array.from(v.png) : null; }, broken);
        assert.ok(value); const stats = await compare(png(ground), png(new Uint8Array(value)));
        assert.ok(failRegions(stats).length, `${fault}: established comparator detects the actual GPU fault`); controls.push(fault);
      }
      receipt.negativeControls = controls;
    }
    receipt.completedPages = report.length; receipt.stage = 'page complete'; await record();
    t.diagnostic(`${key}: compared Design/SVG RGB and required alpha at ${THRESHOLD}/${REGION_SHARE}; ${fidelityFailures.filter(f => f.page === key).length} failing region groups`);
  }
  receipt.fidelityFailures = fidelityFailures; receipt.stage = 'complete-page fidelity assertion'; await record();
  assert.deepEqual(fidelityFailures, [], `every Design/SVG region and alpha stays within ${THRESHOLD}/${REGION_SHARE} with zero coordinate slack`);
  receipt.stage = 'actual device lifecycle'; await record();
  const lifecycle = await probe.evaluate(async page => {
    const api = window.designRasterProbe, admission = api.prepareDesignRaster(page); if (!admission.ok) throw new Error('Fixture admission failed');
    const device = await api.requireWebGpu(), info = device.adapterInfo;
    const adapter = { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description, fallback: info.isFallbackAdapter };
    const originalBuffer = device.createBuffer.bind(device), originalTexture = device.createTexture.bind(device);
    let created = 0, destroyed = 0, liveBytes = 0, peakBytes = 0, mode = 'success', count = 0;
    const controller = new AbortController();
    const track = <T extends GPUBuffer | GPUTexture>(resource: T, bytes: number): T => {
      created++; liveBytes += bytes; peakBytes = Math.max(peakBytes, liveBytes);
      const destroy = resource.destroy.bind(resource); let closed = false;
      resource.destroy = () => { if (!closed) { closed = true; destroyed++; liveBytes -= bytes; } destroy(); };
      return resource;
    };
    device.createTexture = descriptor => track(originalTexture(descriptor), 320 * 240 * 4);
    device.createBuffer = descriptor => {
      if (mode === 'allocation' && ++count === 2) throw new Error('Injected primitive allocation fault');
      const buffer = track(originalBuffer(descriptor), descriptor.size);
      if (descriptor.label === 'Design raster readback') {
        const map = buffer.mapAsync.bind(buffer);
        buffer.mapAsync = (...args) => { const work = map(...args); if (mode === 'cancel') queueMicrotask(() => controller.abort(new DOMException('Cancelled', 'AbortError'))); if (mode === 'loss') queueMicrotask(() => device.destroy()); return work; };
      }
      return buffer;
    };
    const outcomes: Record<string, string> = {}, elapsedMs: Record<string, number> = {};
    try {
      await api.renderDesignRaster(admission.evaluation);
      for (const fault of ['allocation', 'cancel', 'loss']) {
        mode = fault; count = 0; const start = performance.now();
        try { await api.renderDesignRaster(admission.evaluation, fault === 'cancel' ? controller.signal : undefined); outcomes[fault] = 'unexpected success'; }
        catch (error) { outcomes[fault] = fault === 'allocation' && error instanceof Error ? error.message : error instanceof Error && 'code' in error && typeof error.code === 'string' && error.code.startsWith('WEBGPU_') ? error.code : error instanceof Error ? error.name : 'unknown'; }
        elapsedMs[fault] = performance.now() - start;
        if (liveBytes) throw new Error('Actual GPU resources remained live after ' + fault);
      }
    } finally { device.createBuffer = originalBuffer; device.createTexture = originalTexture; }
    api.resetWebGpuDevice(); const recovered = await api.renderDesignRaster(admission.evaluation);
    return { adapter, created, destroyed, liveBytes, peakBytes, outcomes, elapsedMs, recovered: recovered.allocation, allocationScope: 'Owned buffers and RGBA8 target texture only; opaque pipeline/driver memory is not measured.' };
  }, primitiveDrawing());
  receipt.lifecycle = lifecycle;
  assert.equal(lifecycle.created, lifecycle.destroyed); assert.equal(lifecycle.liveBytes, 0);
  assert.equal(lifecycle.outcomes.allocation, 'Injected primitive allocation fault'); assert.equal(lifecycle.outcomes.cancel, 'AbortError'); assert.equal(lifecycle.outcomes.loss, 'WEBGPU_DEVICE_LOST');
  assert.equal(lifecycle.recovered.liveBytes, 0);
  receipt.stage = 'repeated-operation timings'; await record();
  const timings = await probe.evaluate(async page => {
    const samples: number[] = []; let previous = performance.now(), maxTimerGapMs = 0;
    const timer = setInterval(() => { const now = performance.now(); maxTimerGapMs = Math.max(maxTimerGapMs, now - previous); previous = now; }, 5);
    try { for (let i = 0; i < 9; i++) { const start = performance.now(), value = await window.designRasterProbe.render(page); if (!value.ok) throw new Error('Repeated primitive rendering failed'); samples.push(performance.now() - start); if (value.allocation.liveBytes) throw new Error('Repeated job retained resources'); } }
    finally { clearInterval(timer); }
    const ordered = samples.slice().sort((a, b) => a - b);
    return { samples, p50Ms: ordered[4], p95Ms: ordered[8], maxTimerGapMs, scope: 'Warm whole worker operation: admission, GPU upload/render/readback, PNG encode and message delivery. Five-ms main-thread timer gap is coarse, not exclusive CPU time. Small samples; no speed claim.' };
  }, primitiveDrawing());
  receipt.timings = timings;
  receipt.status = 'primitive fidelity passed'; receipt.stage = 'complete';
  receipt.scope = 'Opt-in internal worker and isolated browser fixture only. No production preview/PNG route, full Design coverage or physical target matrix claim.';
});
