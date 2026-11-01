// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 326 parity suite: a Design page exported through the web shell's real export
 * bridge by the GPU route (the internal `ops` switch) against the browser renderer it
 * replaces (`legacy`), page by page.
 *
 * Raster, at the release bands Andy adopted on 2026-10-30 (the measured P3f bands):
 * shape and border regions differ by more than 24 in a channel on at most 0.5% of the
 * region with no coordinate slack; each outlined word's ink is within 25% of the
 * browser's and its centroid within 1.5 px x scale; gradient interiors within 2 levels.
 * Metadata: the same PNG chunk list in the same order, byte-equal outside the image data
 * and the credential. Content Credentials: both verify, with equal actions, ingredients,
 * author and environment, except the `route` and `renderer` keys this plan added.
 * Same-adapter determinism, the comparator's negative controls, a lost device and a
 * cancelled export are exercised on the real device, and latency and memory are measured.
 *
 * SVG and PDF: the drawing operations against the DOM walker (`legacy`), credentials only;
 * their pixels are judged by tests/design-draw-fidelity.browser.test.ts.
 *
 * Needs Playwright Chromium with a WebGPU adapter: Chrome on macOS (Metal), or
 * LOLLY_WEBGPU_TEST_ADAPTER=swiftshader with --import ./tests/browser-gpu.ts elsewhere.
 * LOLLY_EXPORT_PARITY_REPORT=<path> writes the measurements as JSON.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import type { DrawOp } from '../engine/src/design-draw.ts';
import { designFrames, designPageDrawing, type DesignPageSvgHost } from '../engine/src/design-page-svg.ts';
import { DESIGN_RASTER_RECIPE } from '../engine/src/design-draw-raster.ts';
import { TEXT_MEASURE_DEFAULTS } from '../engine/src/design-text-measure.ts';
import { verifyC2pa } from '../engine/src/index.ts';
import { createNodeTextAPI, nodeStrikeMetrics } from '../packages/node-shell/src/text.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { createNodeTextShaper } from '../packages/node-shell/src/text-measure.ts';
import { baseHost } from './helpers/host.ts';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { makeConnectorsApi } from '../engine/src/connectors.ts';
import { compareInBrowser, fidelityPages, type FidelityStats } from './helpers/design-fidelity.ts';
import { primitiveRows } from './helpers/design-webgpu-fixture.ts';

/**
 * The P3f bands (design-draw-webgpu*.browser.test.ts), adopted as the release bands: a
 * primitive's edge at 24 levels, a filled outline's edge (pen paths, strokes, dashes) at
 * 72 because Chromium quantises edge coverage where the fill computes exact area, both
 * on at most 0.5% of the region with no slack; words by ink and centroid; gradients by level.
 */
const THRESHOLD = 24, FILL_THRESHOLD = 72, REGION_SHARE = 0.005, INK_SHARE = 0.25, INK_SHIFT = 1.5, GRADIENT_LEVELS = 2;
/**
 * Measured divergences the release bands do not hold, each with its cause. Nothing else
 * may fail; an entry that stops failing is reported, so it can be removed.
 */
const KNOWN_DIVERGENCES: Record<string, { region: string; reason: string }> = {};
type Row = Record<string, unknown> & { id: string };
type Logs = Array<[string, string]>;
interface Exported { b64: string; logs: Logs; ms: number }
const META = { tool: 'Design', toolId: 'design', toolVersion: '1.0.0', software: 'Lolly', author: 'Parity Test', description: 'Plan 326 parity page' };

/** The real web export bridge, its HarfBuzz text API and the WebGPU device service, in one bundle. */
async function bridgeBundle(): Promise<string> {
  const { build } = await import('esbuild');
  const bridge = new URL('../shells/web/src/bridge/', import.meta.url).pathname;
  const out = await build({
    stdin: {
      contents: `import { createExportAPI } from ${JSON.stringify(`${bridge}export.ts`)};
                 import { createTextAPI } from ${JSON.stringify(`${bridge}text.ts`)};
                 import { requireWebGpu, resetWebGpuDevice } from ${JSON.stringify(`${bridge}../lib/webgpu/device.ts`)};
                 window.__parity = { requireWebGpu, resetWebGpuDevice,
                   api: (logs) => createExportAPI({ text: createTextAPI(), log: (level, message) => logs.push([level, message]), assets: { get: async () => null } }) };`,
      resolveDir: bridge, loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'esnext', logLevel: 'silent', loader: { '.css': 'empty' },
    plugins: [{ name: 'stub-node-module', setup(b) {
      b.onResolve({ filter: /^module$/ }, () => ({ path: 'module', namespace: 'stub-node-module' }));
      b.onLoad({ filter: /.*/, namespace: 'stub-node-module' }, () => ({ contents: 'export function createRequire(){ return () => ({}); }\nexport default { createRequire };', loader: 'js' }));
    } }],
  });
  return out.outputFiles![0]!.text;
}

/** One ink region per run with visible text, as the drawing fidelity suite measures words. */
function runRegions(op: DrawOp, scale: number): Array<{ id: string; x: number; y: number; w: number; h: number; ink: true }> {
  const words = op.words, size = op.words?.spec.size ?? TEXT_MEASURE_DEFAULTS.size;
  if (!words?.layout) return [];
  return words.layout.lines.flatMap((line, l) => line.runs.flatMap((run, r) => {
    if (!run.text.trim()) return [];
    const x0 = Math.max(op.box.x, op.box.x + line.x + run.x - 1), x1 = Math.min(op.box.x + op.box.w, op.box.x + line.x + run.x + run.width + 1);
    const y0 = Math.max(op.box.y, op.box.y + line.baseline - size), y1 = Math.min(op.box.y + op.box.h, op.box.y + line.baseline + 0.3 * size);
    return x1 - x0 >= 1 && y1 - y0 >= 1 ? [{ id: `${op.id}:${l}.${r}`, x: x0 * scale, y: y0 * scale, w: (x1 - x0) * scale, h: (y1 - y0) * scale, ink: true as const }] : [];
  }));
}

/** Whether the GPU draws this operation as a filled outline (the 72-level band) rather than a primitive. */
const filledOutline = (op: DrawOp): boolean => op.op === 'shape' && (op.shape.kind === 'path' || Boolean(op.stroke));

/** A shape's region: its turned bounds and eight pixels round, as the P3f primitive suite judges them. */
function shapeRegion(op: DrawOp, scale: number) {
  const angle = (op.pose?.rot ?? 0) * Math.PI / 180;
  const w = Math.abs(Math.cos(angle)) * op.box.w + Math.abs(Math.sin(angle)) * op.box.h;
  const h = Math.abs(Math.sin(angle)) * op.box.w + Math.abs(Math.cos(angle)) * op.box.h;
  return { id: op.id, x: (op.box.x + (op.box.w - w) / 2 - 8) * scale, y: (op.box.y + (op.box.h - h) / 2 - 8) * scale, w: (w + 16) * scale, h: (h + 16) * scale };
}

/** PNG chunks in order, as [type, bytes]. */
function chunks(png: Uint8Array): Array<[string, Uint8Array]> {
  const out: Array<[string, Uint8Array]> = [];
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let at = 8; at + 8 <= png.length;) {
    const length = view.getUint32(at), type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    out.push([type, png.subarray(at + 8, at + 8 + length)]);
    at += 12 + length;
  }
  return out;
}

/** The chunk list with the image data and the credential set aside, which the routes may differ in. */
const metadataOf = (png: Uint8Array) => chunks(png).filter(([type]) => type !== 'IDAT' && type !== 'caBX').map(([type, data]) => `${type}:${Buffer.from(data).toString('base64')}`);
const chunkOrder = (png: Uint8Array) => chunks(png).map(([type]) => type).filter((type, i, all) => type !== 'IDAT' || all[i - 1] !== 'IDAT');

/** What a credential says, with the date and this plan's route keys set aside for comparison. */
async function credentialOf(bytes: Uint8Array) {
  const report = await verifyC2pa(bytes);
  const env = { ...(report.environment ?? {}) } as Record<string, unknown>;
  const route = { route: env.route, renderer: env.renderer };
  delete env.date; delete env.route; delete env.renderer;
  return {
    route,
    same: {
      found: report.found, state: report.state, format: report.format,
      actions: (report.claim?.actions ?? []).map((a) => [a.action, a.description ?? '', a.digitalSourceType ?? '']),
      ingredients: (report.ingredients ?? []).map((i) => `${i.relationship}:${i.title}`).sort(),
      author: report.author ?? null, rights: report.rights ?? null, environment: env,
    },
  };
}

async function exportIn(page: Page, frameId: string, format: string, route: string, opts: Record<string, unknown>): Promise<Exported> {
  return page.evaluate(async ({ frameId, format, route, opts }) => {
    localStorage.setItem('lolly.exportRoute', route);
    const logs: Array<[string, string]> = [];
    const w = window as unknown as { __parity: { api(logs: unknown[]): { render(n: Element, f: string, o: object): Promise<Blob> } } };
    const node = document.querySelector(`[data-frame-id="${frameId}"]`)!;
    const started = performance.now();
    const blob = await w.__parity.api(logs).render(node, format, opts);
    const ms = performance.now() - started;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { b64: btoa(binary), logs, ms };
  }, { frameId, format, route, opts });
}
const bytesOf = (e: Exported) => new Uint8Array(Buffer.from(e.b64, 'base64'));
const dataUrl = (e: Exported) => `data:image/png;base64,${e.b64}`;

interface Corpus { name: string; frameId: string; rows: Row[]; scales: number[]; gradients?: boolean }
async function corpus(): Promise<Corpus[]> {
  const list: Corpus[] = [];
  for (const page of fidelityPages().filter((p) => ['shapes', 'paths', 'dashes'].includes(p.name))) list.push({ name: `fidelity/${page.name}`, frameId: page.name, rows: page.rows as Row[], scales: [1, 2] });
  list.push({ name: 'fixture/primitives', frameId: 'page', rows: primitiveRows(false) as unknown as Row[], scales: [1, 2] });
  list.push({ name: 'fixture/gradients', frameId: 'grad', scales: [1, 2], gradients: true, rows: [
    { id: 'grad', kind: 'frame', x: 0, y: 0, w: 480, h: 300, bg: '#f4f1ea' },
    { id: 'linear', frame: 'grad', kind: 'box', x: 20, y: 20, w: 200, h: 120, grad: 'lin.srgb_90_d9480f-0_1c7ed6-100' },
    { id: 'radial', frame: 'grad', kind: 'box', x: 250, y: 20, w: 200, h: 120, shape: 'rounded', radius: 16, bg: '#212529', grad: 'rad.srgb_0_ffe066-0_862e9c-100' },
    { id: 'title', frame: 'grad', kind: 'text', x: 20, y: 170, w: 440, h: 100, text: 'Gradient page', fontSize: 48, weight: 700, align: 'left', valign: 'top', fg: '#212529' },
  ] });
  const dir = new URL('../community/design/templates/', import.meta.url);
  for (const file of ['title.json', 'poster.json', 'pull-quote.json', 'slide-deck.json', 'social-profile-kit.json', 'meeting-background.json']) {
    const t = JSON.parse(await readFile(new URL(file, dir), 'utf8')) as { values: { boxes: Row[] } };
    for (const f of designFrames(t.values)) list.push({ name: `template/${file.replace('.json', '')}#${f.id}`, frameId: f.id, rows: t.values.boxes, scales: [1] });
  }
  return list;
}

test('Design PNG: the GPU route against the browser renderer, with metadata and credentials', { timeout: 1_800_000 }, async (t) => {
  const receipt: Record<string, unknown> = { date: new Date().toISOString(), recipe: DESIGN_RASTER_RECIPE, testAdapter: process.env.LOLLY_WEBGPU_TEST_ADAPTER ?? 'default',
    bands: { channel: THRESHOLD, regionShare: REGION_SHARE, inkShare: INK_SHARE, inkShiftPxPerScale: INK_SHIFT, gradientLevels: GRADIENT_LEVELS, coordinateSlack: 0 } };
  const record = async () => { if (process.env.LOLLY_EXPORT_PARITY_REPORT) { await mkdir(dirname(process.env.LOLLY_EXPORT_PARITY_REPORT), { recursive: true }); await writeFile(process.env.LOLLY_EXPORT_PARITY_REPORT, JSON.stringify(receipt, null, 2) + '\n'); } };
  let browser: Browser;
  try { browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--enable-precise-memory-info'], ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}) }); }
  catch (error) { if (process.env.LOLLY_FIDELITY_REQUIRED === '1') throw error; t.skip('Parity needs Playwright Chromium.'); return; }
  t.after(async () => { await record(); await browser.close(); });
  receipt.browser = browser.version();
  const root = repoRoot();
  const tool = await loadTool('design', (p: string) => readFile(new URL(`../community/${p}`, import.meta.url), 'utf8'));
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const fontsDir = new URL('../shells/web/public/fonts/', import.meta.url);
  const harfbuzz = new URL('../node_modules/harfbuzzjs/dist/harfbuzz.wasm', import.meta.url);
  await context.route('http://localhost/**', async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (path === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body></body>' });
    if (path.startsWith('/fonts/')) {
      try { return await route.fulfill({ status: 200, contentType: 'font/ttf', body: await readFile(new URL(path.slice('/fonts/'.length), fontsDir)) }); }
      catch { return route.fulfill({ status: 404, body: '' }); }
    }
    if (path.endsWith('.wasm')) return route.fulfill({ status: 200, contentType: 'application/wasm', body: await readFile(harfbuzz) });
    return route.fulfill({ status: 404, body: '' });
  });
  const bundle = await bridgeBundle();
  const face = async (file: string) => (await readFile(new URL(`../shells/web/public/fonts/${file}`, import.meta.url))).toString('base64');
  const fonts = `@font-face{font-family:'SUSE';src:url(data:font/ttf;base64,${await face('SUSE[wght].ttf')}) format('truetype');font-weight:100 900;font-style:normal}`
    + `@font-face{font-family:'SUSE';src:url(data:font/ttf;base64,${await face('SUSE-Italic[wght].ttf')}) format('truetype');font-weight:100 900;font-style:italic}`
    + `@font-face{font-family:'SUSE Mono';src:url(data:font/ttf;base64,${await face('SUSEMono[wght].ttf')}) format('truetype');font-weight:100 800}`
    + `#tool-canvas{--font-brand:'SUSE';--font-display:'SUSE';--font-mono:'SUSE Mono';--font-italic:'SUSE'}`;
  const textApi = createNodeTextAPI({ repoRoot: root });
  const nodeHost: DesignPageSvgHost = { shaper: createNodeTextShaper(), toPath: (o) => textApi.toPath(o), strikeMetrics: (url, v) => nodeStrikeMetrics(url, v, root), picture: async () => null,
    resolveColor: (css) => /#[0-9a-f]{3,8}\b/i.exec(css)?.[0] ?? null };
  const page = await context.newPage();
  await page.goto('http://localhost/');
  const mount = async (rows: Row[]) => {
    const host = Object.assign(baseHost(), { color: makeColorApi(), geom: makeGeomApi(), connectors: makeConnectorsApi() });
    const runtime = await createRuntime(tool, host, { boxes: rows as never });
    assert.deepEqual(runtime.hookErrors ?? [], [], 'the Design hooks render');
    await page.setContent(`<!doctype html><style>html,body{margin:0;background:#ffffff}${fonts}</style><style>${tool.styles ?? ''}</style>`
      + `<div id="tool-canvas" style="position:relative;width:20000px;height:4000px">${runtime.getHydrated()}</div>`);
    await page.addScriptTag({ content: bundle, type: 'module' });
    await page.waitForFunction(() => !!(window as unknown as { __parity?: unknown }).__parity);
    await page.evaluate(async () => { await document.fonts.ready; });
    runtime.destroy();
  };
  const routeOf = (logs: Logs) => logs.find(([, m]) => /^Design PNG export: drawn by/.test(m));

  const pages: Array<Record<string, unknown>> = [], failures: Array<Record<string, unknown>> = [];
  const timings: Array<{ page: string; scale: number; legacyMs: number[]; gpuMs: number[]; gpuDevicePeakBytes: number; rgbaBytes: number }> = [];
  let firstAdmitted: { c: Corpus; scale: number } | undefined;
  // LOLLY_EXPORT_PARITY_ONLY=<text> narrows the corpus to pages whose name holds it, for a calibration run.
  const only = process.env.LOLLY_EXPORT_PARITY_ONLY;
  for (const c of (await corpus()).filter((x) => !only || x.name.includes(only))) {
    await mount(c.rows);
    const drawing = await designPageDrawing({ boxes: c.rows }, c.frameId, nodeHost, { dpi: 96 });
    for (const scale of c.scales) {
      const opts = { sourceDocument: { toolId: 'design', values: { boxes: c.rows } }, scale, meta: META, c2pa: true, imprint: false };
      const legacy = await exportIn(page, c.frameId, 'png', 'legacy', opts);
      const gpu = await exportIn(page, c.frameId, 'png', 'ops', opts);
      const chosen = routeOf(gpu.logs);
      if (!/GPU page renderer/.test(chosen?.[1] ?? '')) {
        pages.push({ page: c.name, scale, admitted: false, reason: chosen?.[1] ?? 'no route line' });
        t.diagnostic(`${c.name} x${scale}: not admitted (${chosen?.[1]})`);
        continue;
      }
      firstAdmitted ??= { c, scale };
      const width = Math.round(drawing.frame.width * scale), height = Math.round(drawing.frame.height * scale);
      const shapes = drawing.page.ops.filter((op) => !op.words).map((op) => shapeRegion(op, scale));
      const words = drawing.page.ops.flatMap((op) => runRegions(op, scale));
      // The page without its words, from the browser renderer, is what each word's ink is measured against.
      let background: string | undefined;
      if (words.length) {
        const hide = await page.addStyleTag({ content: '#tool-canvas * { color: transparent !important; -webkit-text-fill-color: transparent !important; }' });
        background = dataUrl(await exportIn(page, c.frameId, 'png', 'legacy', { ...opts, c2pa: false }));
        await hide.evaluate((n) => (n as Element).remove());
      }
      const fills = new Set(drawing.page.ops.filter(filledOutline).map((op) => op.id));
      // Words inside a shape are judged by their own bands, so their pixels leave the shape's count;
      // a shape a word only partly overlaps is left to the words.
      const overlaps = (r: { x: number; y: number; w: number; h: number }, w: typeof words[number]) => w.x < r.x + r.w && w.x + w.w > r.x && w.y < r.y + r.h && w.y + w.h > r.y;
      const inside = (r: { x: number; y: number; w: number; h: number }, w: typeof words[number]) => w.x >= r.x && w.y >= r.y && w.x + w.w <= r.x + r.w && w.y + w.h <= r.y + r.h;
      const holdsWords = new Set(shapes.filter((r) => words.some((w) => overlaps(r, w) && (!inside(r, w) || fills.has(r.id)))).map((r) => r.id));
      const wordsIn = new Map(shapes.map((r) => [r.id, words.filter((w) => inside(r, w)).map((w) => w.id)]));
      const primitiveRegions = [...(words.length || fills.size ? [] : [{ id: 'page', x: 0, y: 0, w: width, h: height }]), ...shapes.filter((r) => !fills.has(r.id)), ...words];
      const compare = (regions: object[], threshold: number) => page.evaluate<FidelityStats>(`(${compareInBrowser.toString()})(${JSON.stringify(dataUrl(legacy))},${JSON.stringify(dataUrl(gpu))},${width},${height},${JSON.stringify(regions)},${threshold},${JSON.stringify(background)})`);
      const stats = await compare(primitiveRegions, THRESHOLD);
      const fillStats = fills.size ? await compare(shapes.filter((r) => fills.has(r.id)), FILL_THRESHOLD) : { regions: [] as FidelityStats['regions'] };
      if (process.env.LOLLY_EXPORT_PARITY_DUMP) {
        const base = `${process.env.LOLLY_EXPORT_PARITY_DUMP}/${c.name.replace(/[^a-z0-9]+/gi, '-')}-x${scale}`;
        await mkdir(dirname(base), { recursive: true });
        await writeFile(`${base}-browser.png`, bytesOf(legacy)); await writeFile(`${base}-gpu.png`, bytesOf(gpu));
      }
      const byId = new Map(stats.regions.map((r) => [r.id, r]));
      for (const r of stats.regions) {
        const held = wordsIn.get(r.id) ?? [];
        if (!held.length || r.ink) continue;
        for (const id of held) { const w = byId.get(id); if (w) { r.pixels -= w.pixels; r.differing -= w.differing; } }
      }
      const regionFaults = [...stats.regions, ...fillStats.regions].flatMap((r): Array<{ id: string; ink?: string; share?: string }> => {
        if (r.ink) {
          const share = r.ink.a ? Math.abs(r.ink.a - r.ink.b) / r.ink.a : 0, shift = Math.hypot(r.ink.ax - r.ink.bx, r.ink.ay - r.ink.by);
          return share > INK_SHARE || shift > INK_SHIFT * scale ? [{ id: r.id, ink: `${(100 * share).toFixed(1)}% at ${shift.toFixed(2)} px` }] : [];
        }
        // A shape region holding words is judged by the words' own bands, not by pixels.
        return !holdsWords.has(r.id) && r.pixels && r.differing / r.pixels > REGION_SHARE ? [{ id: r.id, share: `${(100 * r.differing / r.pixels).toFixed(2)}%` }] : [];
      });
      let gradient: Array<{ id: string; max: number }> = [];
      if (c.gradients) {
        const interiors = drawing.page.ops.filter((op) => op.op === 'shape' && op.fills.some((f) => f.kind !== 'color')).map((op) => ({ id: op.id, x: (op.box.x + 8) * scale, y: (op.box.y + 8) * scale, w: (op.box.w - 16) * scale, h: (op.box.h - 16) * scale }));
        gradient = await page.evaluate(async ({ a, b, width, height, regions }) => {
          const read = async (src: string) => { const img = new Image(); img.src = src; await img.decode(); const cv = document.createElement('canvas'); cv.width = width; cv.height = height; const x = cv.getContext('2d')!; x.drawImage(img, 0, 0); return x.getImageData(0, 0, width, height).data; };
          const [p, q] = await Promise.all([read(a), read(b)]);
          return regions.map((r) => { let max = 0; for (let y = Math.ceil(r.y); y < Math.floor(r.y + r.h); y++) for (let x = Math.ceil(r.x); x < Math.floor(r.x + r.w); x++) { const i = (y * width + x) * 4; for (let k = 0; k < 3; k++) max = Math.max(max, Math.abs(p[i + k]! - q[i + k]!)); } return { id: r.id, max }; });
        }, { a: dataUrl(legacy), b: dataUrl(gpu), width, height, regions: interiors });
        for (const g of gradient) if (g.max > GRADIENT_LEVELS) regionFaults.push({ id: g.id, share: `gradient interior differs by ${g.max} levels` });
      }
      const [lb, gb] = [bytesOf(legacy), bytesOf(gpu)];
      const metadata = { order: JSON.stringify(chunkOrder(lb)) === JSON.stringify(chunkOrder(gb)), chunks: JSON.stringify(metadataOf(lb)) === JSON.stringify(metadataOf(gb)), legacyOrder: chunkOrder(lb), gpuOrder: chunkOrder(gb) };
      const [lc, gc] = [await credentialOf(lb), await credentialOf(gb)];
      const credential = { same: JSON.stringify(lc.same) === JSON.stringify(gc.same), legacy: lc.route, gpu: gc.route };
      const peak = Number(/(\d+) bytes on the device at peak/.exec(chosen![1])?.[1] ?? NaN);
      pages.push({ page: c.name, scale, admitted: true, width, height, wholePage: { differing: stats.differing, maxChannel: stats.maxChannel }, regionFaults, gradient, metadata, credential, legacyMs: legacy.ms, gpuMs: gpu.ms, gpuDevicePeakBytes: peak });
      const known = KNOWN_DIVERGENCES[`${c.name} x${scale}`];
      const unexplained = regionFaults.filter((f) => f.id !== known?.region);
      if (known && unexplained.length === regionFaults.length) t.diagnostic(`${c.name} x${scale}: the known divergence (${known.reason}) no longer fails; remove its entry`);
      if (unexplained.length || !metadata.order || !metadata.chunks || !credential.same) failures.push({ page: c.name, scale, regionFaults: unexplained, metadata: metadata.chunks && metadata.order, credential: credential.same ? true : { legacy: lc.same, gpu: gc.same } });
      assert.deepEqual(lc.route, { route: 'compatibility', renderer: 'dom-to-image' });
      assert.deepEqual(gc.route, { route: 'gpu', renderer: DESIGN_RASTER_RECIPE });
      assert.equal(gc.same.state, 'valid');
      receipt.pages = pages; await record();
      t.diagnostic(`${c.name} x${scale}: ${regionFaults.length} region faults; metadata ${metadata.order && metadata.chunks ? 'equal' : 'DIFFERENT'}; credential ${credential.same ? 'equal' : 'DIFFERENT'}; ${legacy.ms.toFixed(0)} ms browser, ${gpu.ms.toFixed(0)} ms GPU`);
      // Latency and memory, warm, on every admitted page at its last scale: five of each route.
      if (scale === c.scales.at(-1)) {
        const sample = { page: c.name, scale, legacyMs: [] as number[], gpuMs: [] as number[], gpuDevicePeakBytes: peak, rgbaBytes: width * height * 4 };
        for (let i = 0; i < 5; i++) {
          const l = await exportIn(page, c.frameId, 'png', 'legacy', opts), g = await exportIn(page, c.frameId, 'png', 'ops', opts);
          sample.legacyMs.push(l.ms); sample.gpuMs.push(g.ms);
        }
        timings.push(sample);
      }
    }
  }
  const quantile = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? NaN; };
  const all = (key: 'legacyMs' | 'gpuMs') => timings.flatMap((x) => x[key]);
  receipt.latency = { legacy: { p50: quantile(all('legacyMs'), 0.5), p95: quantile(all('legacyMs'), 0.95) }, gpu: { p50: quantile(all('gpuMs'), 0.5), p95: quantile(all('gpuMs'), 0.95) }, perPage: timings,
    scope: 'Whole export call through the web bridge with Content Credentials on and the Imprint off: compile, admission, draw, readback, PNG encode, metadata, stamp. Warm, five runs each.' };
  receipt.memory = { gpuDevicePeakBytesMax: Math.max(...timings.map((x) => x.gpuDevicePeakBytes)), rgbaReadbackBytesMax: Math.max(...timings.map((x) => x.rgbaBytes)),
    scope: 'Device bytes are the renderer\'s own buffers and target texture at peak (pipelines and driver memory are not counted); the readback is the RGBA copy the page holds once.' };
  receipt.failures = failures; await record();
  assert.ok(firstAdmitted, 'at least one corpus page is admitted for the GPU route');
  assert.deepEqual(failures, [], 'every admitted page stays within the release bands, with equal metadata and credentials');

  // Same adapter, two runs: the same bytes (credential off, since a credential's signature differs every time).
  const { c, scale } = firstAdmitted!;
  await mount(c.rows);
  const base = { sourceDocument: { toolId: 'design', values: { boxes: c.rows } }, scale, meta: META, c2pa: false, imprint: false };
  const [once, twice] = [await exportIn(page, c.frameId, 'png', 'ops', base), await exportIn(page, c.frameId, 'png', 'ops', base)];
  assert.ok(/GPU page renderer/.test(routeOf(once.logs)?.[1] ?? ''));
  assert.equal(once.b64, twice.b64, 'same adapter, same bytes');
  receipt.determinism = { page: c.name, scale, identical: once.b64 === twice.b64 };

  // The Imprint and its claim ride both routes alike.
  const imprinted = { ...base, c2pa: true, imprint: true };
  const [li, gi] = [await credentialOf(bytesOf(await exportIn(page, c.frameId, 'png', 'legacy', imprinted))), await credentialOf(bytesOf(await exportIn(page, c.frameId, 'png', 'ops', imprinted)))];
  assert.deepEqual(gi.same.actions, li.same.actions);
  assert.ok(gi.same.actions.some(([, d]) => /pixel watermark/.test(String(d))), 'the imprint is claimed on the GPU route');

  // The comparator must fail a broken GPU page: a shape moved 2 px, a word missing, a word moved 3 px.
  const controls: string[] = [];
  type Region = { id: string; x: number; y: number; w: number; h: number; ink?: boolean };
  const control = async (name: string, frameId: string, rows: Row[], against: Exported, regions: Region[], bg?: string) => {
    const broken = await exportIn(page, frameId, 'png', 'ops', { ...base, scale: 1, sourceDocument: { toolId: 'design', values: { boxes: rows } } });
    assert.ok(/GPU page renderer/.test(routeOf(broken.logs)?.[1] ?? ''), `${name}: drawn by the GPU route`);
    const f = designFrames({ boxes: rows }).find((x) => x.id === frameId)!;
    const s = await page.evaluate<FidelityStats>(`(${compareInBrowser.toString()})(${JSON.stringify(dataUrl(against))},${JSON.stringify(dataUrl(broken))},${f.width},${f.height},${JSON.stringify(regions)},${THRESHOLD},${JSON.stringify(bg)})`);
    const caught = s.regions.some((r) => r.ink ? (r.ink.a ? Math.abs(r.ink.a - r.ink.b) / r.ink.a : 0) > INK_SHARE || Math.hypot(r.ink.ax - r.ink.bx, r.ink.ay - r.ink.by) > INK_SHIFT : r.pixels > 0 && r.differing / r.pixels > REGION_SHARE);
    assert.ok(caught, `${name}: the release bands catch the broken page`);
    controls.push(name);
  };
  const pages326 = await corpus();
  const shapesPage = pages326.find((p) => p.name === 'fidelity/shapes')!;
  await mount(shapesPage.rows);
  const shapesDrawing = await designPageDrawing({ boxes: shapesPage.rows }, shapesPage.frameId, nodeHost, { dpi: 96 });
  const shapesLegacy = await exportIn(page, shapesPage.frameId, 'png', 'legacy', { ...base, scale: 1, sourceDocument: { toolId: 'design', values: { boxes: shapesPage.rows } } });
  await control('shape moved 2 px', shapesPage.frameId, shapesPage.rows.map((r) => r.id === 'rect' ? { ...r, x: Number(r.x) + 2 } : r), shapesLegacy,
    shapesDrawing.page.ops.filter((op) => op.id === 'rect').map((op) => shapeRegion(op, 1)));
  const textPage = pages326.find((p) => p.name === 'fixture/gradients')!;
  await mount(textPage.rows);
  const textDrawing = await designPageDrawing({ boxes: textPage.rows }, textPage.frameId, nodeHost, { dpi: 96 });
  const textOpts = { ...base, scale: 1, sourceDocument: { toolId: 'design', values: { boxes: textPage.rows } } };
  const textLegacy = await exportIn(page, textPage.frameId, 'png', 'legacy', textOpts);
  const hide = await page.addStyleTag({ content: '#tool-canvas * { color: transparent !important; -webkit-text-fill-color: transparent !important; }' });
  const textBackground = dataUrl(await exportIn(page, textPage.frameId, 'png', 'legacy', textOpts));
  await hide.evaluate((n) => (n as Element).remove());
  const wordRegions = textDrawing.page.ops.flatMap((op) => runRegions(op, 1));
  await control('word missing', textPage.frameId, textPage.rows.map((r) => r.id === 'title' ? { ...r, text: '' } : r), textLegacy, wordRegions, textBackground);
  await control('word moved 3 px', textPage.frameId, textPage.rows.map((r) => r.id === 'title' ? { ...r, y: Number(r.y) + 3 } : r), textLegacy, wordRegions, textBackground);
  receipt.negativeControls = controls; await record();

  // A device lost mid-draw: the export still arrives, from the browser renderer, with a warning in the log only.
  const lossOpts = { ...textOpts };
  const lost = await page.evaluate(async ({ frameId, opts }) => {
    const w = window as unknown as { __parity: { requireWebGpu(): Promise<GPUDevice>; resetWebGpuDevice(): void; api(logs: unknown[]): { render(n: Element, f: string, o: object): Promise<Blob> } } };
    localStorage.setItem('lolly.exportRoute', 'ops');
    const device = await w.__parity.requireWebGpu();
    const create = device.createBuffer.bind(device);
    device.createBuffer = (descriptor) => {
      const buffer = create(descriptor);
      if (descriptor.label === 'Design raster readback') { const map = buffer.mapAsync.bind(buffer); buffer.mapAsync = (...args) => { const work = map(...args); queueMicrotask(() => device.destroy()); return work; }; }
      return buffer;
    };
    const logs: Array<[string, string]> = [];
    const node = document.querySelector(`[data-frame-id="${frameId}"]`)!;
    const blob = await w.__parity.api(logs).render(node, 'png', opts);
    // After the loss the device service stays refused until the shell resets it, so the next export falls back too.
    const after: Array<[string, string]> = [];
    await w.__parity.api(after).render(node, 'png', opts);
    w.__parity.resetWebGpuDevice();
    const recovered: Array<[string, string]> = [];
    await w.__parity.api(recovered).render(node, 'png', opts);
    return { size: blob.size, type: blob.type, logs, after, recovered };
  }, { frameId: textPage.frameId, opts: lossOpts });
  assert.ok(lost.size > 0 && lost.type === 'image/png', 'the export still arrives');
  assert.ok(lost.logs.some(([level, m]) => level === 'warn' && /GPU route failed .*(DEVICE_LOST|lost|destroyed)/i.test(m)), JSON.stringify(lost.logs));
  assert.ok(lost.after.some(([, m]) => /compatibility renderer/.test(m)));
  assert.ok(lost.recovered.some(([, m]) => /GPU page renderer/.test(m)), 'a reset device draws again');
  receipt.deviceLoss = lost;

  // The person's cancel stops the export; nothing is drawn in its place.
  const cancelled = await page.evaluate(async ({ frameId, opts }) => {
    const w = window as unknown as { __parity: { requireWebGpu(): Promise<GPUDevice>; api(logs: unknown[]): { render(n: Element, f: string, o: object): Promise<Blob> } } };
    localStorage.setItem('lolly.exportRoute', 'ops');
    const device = await w.__parity.requireWebGpu();
    const controller = new AbortController();
    const create = device.createBuffer.bind(device);
    device.createBuffer = (descriptor) => {
      const buffer = create(descriptor);
      if (descriptor.label === 'Design raster readback') { const map = buffer.mapAsync.bind(buffer); buffer.mapAsync = (...args) => { const work = map(...args); queueMicrotask(() => controller.abort(new DOMException('Cancelled by the person', 'AbortError'))); return work; }; }
      return buffer;
    };
    const logs: Array<[string, string]> = [];
    try { await w.__parity.api(logs).render(document.querySelector(`[data-frame-id="${frameId}"]`)!, 'png', { ...opts, signal: controller.signal }); return { rejected: false, logs }; }
    catch (error) { return { rejected: true, name: (error as Error).name, logs }; }
    finally { device.createBuffer = create; }
  }, { frameId: textPage.frameId, opts: lossOpts });
  assert.equal(cancelled.rejected, true, 'a cancelled export rejects');
  assert.ok(!cancelled.logs.some(([, m]) => /compatibility renderer/.test(m)), 'and is not drawn again by the browser renderer');
  receipt.cancel = cancelled;

  // SVG and PDF: the drawing operations against the DOM walker, Content Credentials only.
  const vector: Array<Record<string, unknown>> = [];
  await mount(shapesPage.rows);
  for (const format of ['svg', 'svgz', 'pdf']) {
    const opts = { sourceDocument: { toolId: 'design', values: { boxes: shapesPage.rows } }, meta: META, c2pa: true };
    const frameNode = format === 'pdf' ? '#tool-canvas' : `[data-frame-id="${shapesPage.frameId}"]`;
    const run = (route: string) => page.evaluate(async ({ selector, format, route, opts }) => {
      localStorage.setItem('lolly.exportRoute', route);
      const w = window as unknown as { __parity: { api(logs: unknown[]): { render(n: Element, f: string, o: object): Promise<Blob> } } };
      const blob = await w.__parity.api([]).render(document.querySelector(selector)!, format, opts);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    }, { selector: frameNode, format, route, opts });
    const [ops, walker] = [await credentialOf(new Uint8Array(Buffer.from(await run('auto'), 'base64'))), await credentialOf(new Uint8Array(Buffer.from(await run('legacy'), 'base64')))];
    assert.equal(ops.same.state, 'valid', `${format}: the operations' credential verifies`);
    assert.deepEqual(ops.route, { route: 'operations', renderer: 'design-draw-v0' }, `${format}: operations route recorded`);
    assert.deepEqual(walker.route, { route: 'compatibility', renderer: 'dom-walker' }, `${format}: walker route recorded`);
    const sameButDims = (x: typeof ops.same) => ({ ...x, environment: { ...x.environment, dimensions: undefined } });
    assert.deepEqual(sameButDims(ops.same), sameButDims(walker.same), `${format}: equal credentials apart from the route`);
    vector.push({ format, ops: ops.route, walker: walker.route, equal: true, format_: ops.same.format });
  }
  receipt.vector = vector;
  receipt.status = 'passed';
});
