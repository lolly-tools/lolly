// SPDX-License-Identifier: MPL-2.0
/**
 * P3f fills (pen shapes and outlined words) against the real Design renderer.
 *
 * Primitives keep their zero-slack comparison in design-draw-webgpu.browser.test.ts.
 * Fills are judged within a declared band (plan 295, decision of 2026-10-14): Chromium
 * draws a path with its own edge coverage and draws text with its font rasteriser, not
 * as outlines, so neither matches a filled outline pixel for pixel. Shapes compare with
 * no positional slack and a coverage allowance per pixel; words compare run by run by
 * their ink and its centroid. Each word is also judged against its own outline, which is
 * exact on any platform and is the GPU's own contract. Each limit is proven by a negative
 * control that must fail.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import { compileDesignDraw, layoutDesignDrawText, outlineDesignDrawText, type DesignDrawPage, type DrawOp } from '../engine/src/design-draw.ts';
import { prepareDesignRaster } from '../engine/src/design-draw-raster.ts';
import { TEXT_MEASURE_DEFAULTS } from '../engine/src/design-text-measure.ts';
import { encodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';
import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { createNodeTextShaper } from '../packages/node-shell/src/text-measure.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import type { DesignRasterResult } from '../shells/web/src/lib/webgpu/design-page.ts';
import { compareInBrowser, type FidelityStats, type RegionStats } from './helpers/design-fidelity.ts';
import { createDesignGpuFixture, type DesignGpuCase } from './helpers/design-webgpu-fixture.ts';

interface WorkerResult extends DesignRasterResult { ok: true; png: Uint8Array }
interface FillProbe {
  render(page: DesignDrawPage, output?: { width: number; height: number; dpi?: number }): Promise<WorkerResult | { ok: false; error?: string; findings?: unknown }>;
  close(): void;
}
type ProbeWindow = Window & { designRasterProbe: FillProbe };

/**
 * Shapes: no positional slack, and an edge pixel's coverage may differ by up to 72 of
 * 255 levels, because Chromium quantises edge coverage and the fill computes exact area.
 * Measured on Mac Chrome (Metal): the worst shape region had 0.09% of its pixels above
 * 72 (a curved blob at 1x; 0.38% at 48, 0.84% at 24); the triangle moved 2 px differs in
 * 4.24%, far over the 0.5% share. A 1 px neighbourhood at 40 also caught the move (3.87%)
 * but left the blob at 0.38%, nearer the limit.
 */
const REPORT_ONLY = process.env.LOLLY_DESIGN_GPU_FILL_CALIBRATE === '1';
const FILL_SLACK = REPORT_ONLY && process.env.LOLLY_FILL_SLACK ? Number(process.env.LOLLY_FILL_SLACK) : 0;
const FILL_THRESHOLD = REPORT_ONLY && process.env.LOLLY_FILL_THRESHOLD ? Number(process.env.LOLLY_FILL_THRESHOLD) : 72;
const REGION_SHARE = 0.005;
/**
 * Words against Design: a run's ink must match the browser's text within this share, and
 * its centroid within this many px times the output scale. Measured: outlines carry up to
 * 17.1% less ink than the browser's text on Mac Chrome (its font rasteriser draws heavier)
 * and up to 6.9% on Linux CI. Centroids sat within 0.59 px on the Mac; on Linux CI the
 * italic run of the rich fixture sat 1.20 px away at 1x and 2.53 px at 2x, and Chromium's
 * SVG of the same operations sat 1.08 px and 2.62 px from Chromium's text, so that distance
 * is Chromium's own text layout on Linux, not the GPU. The GPU's position is judged against
 * its outlines below. A missing word and a word moved by 3 px each fail this band.
 */
const INK_SHARE = 0.25, INK_SHIFT = 1.5;
/**
 * Words against their own outlines: a run's ink in the GPU image must equal its exact area
 * (times its paint's contrast) within this share, and its ink centroid must sit on the
 * outline's area centroid within this many output px. This is the GPU's own contract and
 * holds on any platform; the Design band above also carries the drawing compiler's layout.
 * Measured on Mac Chrome (Metal): ink within 0.04% and centroids within 0.013 px; the same
 * word moved by 0.25 px sits 0.257 px away. Chromium's SVG of the same outlines is not this
 * reference: on Metal it rasterises them with quarter-step coverage and sat up to 0.36 px off.
 */
const EXACT_INK_SHARE = REPORT_ONLY && process.env.LOLLY_EXACT_INK_SHARE ? Number(process.env.LOLLY_EXACT_INK_SHARE) : 0.01;
const EXACT_SHIFT = REPORT_ONLY && process.env.LOLLY_EXACT_SHIFT ? Number(process.env.LOLLY_EXACT_SHIFT) : 0.05;

const path = (closed: boolean, nodes: Array<Record<string, number>>) => encodeAuthoredPaths([{ kind: 'cubic', closed, nodes }] as never) ?? '';
const triangle = path(true, [{ x: 0, y: 1 }, { x: 0.5, y: 0 }, { x: 1, y: 1 }]);
const blob = path(true, [
  { x: 0.5, y: 0, hInX: -0.3, hInY: 0, hOutX: 0.3, hOutY: 0 },
  { x: 1, y: 0.55, hInX: 0, hInY: -0.3, hOutX: 0, hOutY: 0.3 },
  { x: 0.45, y: 1, hInX: 0.35, hInY: 0, hOutX: -0.35, hOutY: 0 },
  { x: 0, y: 0.45, hInX: 0, hInY: 0.3, hOutX: 0, hOutY: -0.3 },
]);
const ring = encodeAuthoredPaths([
  { kind: 'cubic', closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
  { kind: 'cubic', closed: true, nodes: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }] },
] as never) ?? '';

const on = (row: DesignBoxRowV1): DesignBoxRowV1 => ({ frame: 'page', ...row });
const pathRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#ffffff' },
  on({ id: 'triangle', kind: 'path', x: 20, y: 20, w: 90, h: 80, path: triangle, bg: '#f03e3e' }),
  on({ id: 'ring', kind: 'path', x: 130, y: 20, w: 80, h: 80, path: ring, bg: '#7048e8', fillRule: 'evenodd' }),
  on({ id: 'blob', kind: 'path', x: 230, y: 20, w: 70, h: 80, path: blob, bg: '#12b886' }),
  on({ id: 'turned', kind: 'path', x: 30, y: 130, w: 90, h: 80, path: triangle, bg: '#1c7ed6', rot: 23, flipH: true }),
  on({ id: 'under', kind: 'box', x: 170, y: 140, w: 120, h: 70, bg: '#212529' }),
  on({ id: 'faded', kind: 'path', x: 150, y: 120, w: 100, h: 90, path: blob, bg: '#fab005', opacity: 60 }),
];
const textRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#ffffff' },
  on({ id: 'title', kind: 'text', x: 10, y: 10, w: 300, h: 60, text: 'Design', fontSize: 40 }),
  on({ id: 'para', kind: 'text', x: 10, y: 80, w: 150, h: 70, text: 'Left and top, wrapping onto lines', fontSize: 16, weight: 400, align: 'left', valign: 'top' }),
  on({ id: 'rich', kind: 'text', x: 170, y: 80, w: 140, h: 70, text: 'Plain **bold** *italic* {#d6336c|pink}', fontSize: 16, weight: 400, align: 'left' }),
  on({ id: 'boxed', kind: 'box', x: 10, y: 165, w: 140, h: 60, text: 'On a box', fontSize: 18, bg: '#2b8a3e', fg: '#ffffff' }),
  on({ id: 'right', kind: 'text', x: 170, y: 165, w: 140, h: 60, text: 'Right, bottom', fontSize: 18, align: 'right', valign: 'bottom', fg: '#1864ab' }),
];

/** One ink region per outlined run, in output pixels: its advance, a size above and below the baseline. */
function runRegions(drawing: DesignDrawPage, sx: number, sy: number) {
  return drawing.ops.flatMap((op: DrawOp) => {
    const layout = op.words?.layout, size = op.words?.spec.size ?? TEXT_MEASURE_DEFAULTS.size;
    if (!layout) return [];
    return layout.lines.flatMap((line, l) => line.runs.flatMap((run, r) => {
      if (!run.text.trim()) return [];
      const x0 = op.box.x + line.x + run.x - 1, y0 = op.box.y + line.baseline - size;
      return [{ id: `${op.id}:${l}.${r}`, x: x0 * sx, y: y0 * sy, w: (run.width + 2) * sx, h: 1.3 * size * sy, ink: true as const }];
    }));
  });
}

/** Shape regions: each operation without words, over its turned bounds, padded four pixels. */
function shapeRegions(drawing: DesignDrawPage, sx: number, sy: number) {
  return drawing.ops.filter(op => !op.words).map(op => {
    const a = (op.pose?.rot ?? 0) * Math.PI / 180;
    const w = Math.abs(Math.cos(a)) * op.box.w + Math.abs(Math.sin(a)) * op.box.h, h = Math.abs(Math.sin(a)) * op.box.w + Math.abs(Math.cos(a)) * op.box.h;
    return { id: op.id, x: (op.box.x + (op.box.w - w) / 2 - 4) * sx, y: (op.box.y + (op.box.h - h) / 2 - 4) * sy, w: (w + 8) * sx, h: (h + 8) * sy };
  });
}

/** Each word fill's exact area and area centroid in output px (pixel indices), from the admitted edges. */
function outlineTruth(drawing: DesignDrawPage, sx: number, sy: number) {
  // Admitted at the rendered size, so the edges are flattened exactly as the GPU received them.
  const admitted = prepareDesignRaster(drawing, { width: 320 * sx, height: 240 * sy, dpi: 96 * sx });
  assert.ok(admitted.ok, 'the fixture page is admitted');
  return admitted.evaluation.fills.filter(f => f.id.includes(':')).map(f => {
    let area = 0, cx = 0, cy = 0;
    for (let i = 0; i < f.edges.length; i += 4) {
      const x0 = f.edges[i]! * sx, y0 = f.edges[i + 1]! * sy, x1 = f.edges[i + 2]! * sx, y1 = f.edges[i + 3]! * sy, k = x0 * y1 - x1 * y0;
      area += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
    }
    area /= 2;
    return { id: f.id, area: Math.abs(area), x: cx / (6 * area) - 0.5, y: cy / (6 * area) - 0.5, color: [...f.color],
      box: [Math.floor(f.bounds[0] * sx) - 1, Math.floor(f.bounds[1] * sy) - 1, Math.ceil(f.bounds[2] * sx) + 1, Math.ceil(f.bounds[3] * sy) + 1] };
  });
}

/** Runs in the browser: per box, the ink a shot adds over the ground and its centroid, and the ink its paint would add per unit of area. */
async function inkInBrowser(shot: string, ground: string, width: number, height: number, boxes: Array<{ box: number[]; color: number[] }>) {
  const pixels = async (src: string) => {
    const img = new Image(); img.src = src; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  };
  const [ps, pg] = await Promise.all([pixels(shot), pixels(ground)]);
  const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return boxes.map(({ box: [x0, y0, x1, y1], color }) => {
    let ink = 0, x = 0, y = 0;
    for (let yy = Math.max(0, y0!); yy < Math.min(height, y1!); yy++) for (let xx = Math.max(0, x0!); xx < Math.min(width, x1!); xx++) {
      const i = (yy * width + xx) * 4, w = Math.abs(lum(ps[i]!, ps[i + 1]!, ps[i + 2]!) - lum(pg[i]!, pg[i + 1]!, pg[i + 2]!));
      ink += w; x += w * xx; y += w * yy;
    }
    const mid = (Math.floor((y0! + y1!) / 2) * width + Math.floor((x0! + x1!) / 2)) * 4;
    const perArea = color[3]! * Math.abs(lum(color[0]! * 255, color[1]! * 255, color[2]! * 255) - lum(pg[mid]!, pg[mid + 1]!, pg[mid + 2]!));
    return { ink, x: ink ? x / ink : 0, y: ink ? y / ink : 0, perArea };
  });
}

function fault(r: RegionStats, scale: number): string | undefined {
  if (r.ink) {
    const share = r.ink.a ? Math.abs(r.ink.a - r.ink.b) / r.ink.a : 0, shift = Math.hypot(r.ink.ax - r.ink.bx, r.ink.ay - r.ink.by);
    return share > INK_SHARE || shift > INK_SHIFT * scale ? `ink differs by ${(100 * share).toFixed(1)}% and sits ${shift.toFixed(2)} px away` : undefined;
  }
  return r.pixels && r.differing / r.pixels > REGION_SHARE ? `${(100 * r.differing / r.pixels).toFixed(2)}% of ${r.pixels} px` : undefined;
}

test('opt-in Design GPU fills draw pen shapes and outlined words within the declared band', { timeout: 300_000 }, async t => {
  const root = repoRoot();
  const shaper = createNodeTextShaper({ repoRoot: root }), text = createNodeTextAPI({ repoRoot: root });
  const drawn = async (rows: DesignBoxRowV1[]) => {
    const d = compileDesignDraw(rows, { width: 320, height: 240 }, { effects: true, colors: 'resolved' });
    await layoutDesignDrawText(d, shaper);
    await outlineDesignDrawText(d, o => text.toPath(o));
    assert.deepEqual(d.findings, [], 'the fixture compiles without findings');
    return d;
  };
  const cases: DesignGpuCase[] = [];
  for (const [name, rows] of [['paths', pathRows], ['text', textRows]] as const) {
    const drawing = await drawn(rows);
    for (const scale of [1, 2]) cases.push({ key: `${name}-${scale}`, rows, drawing, scaleX: scale, scaleY: scale, original: true });
  }
  const face = async (file: string) => (await readFile(new URL(`../shells/web/public/fonts/${file}`, import.meta.url))).toString('base64');
  const head = `<style>@font-face{font-family:'SUSE';src:url(data:font/ttf;base64,${await face('SUSE[wght].ttf')}) format('truetype');font-weight:100 900;font-style:normal}`
    + `@font-face{font-family:'SUSE';src:url(data:font/ttf;base64,${await face('SUSE-Italic[wght].ttf')}) format('truetype');font-weight:100 900;font-style:italic}`
    + `#tool-canvas{--font-brand:'SUSE';--font-display:'SUSE';--font-italic:'SUSE'}</style>`;
  const fixture = await createDesignGpuFixture({ cases, head });
  t.after(() => fixture.close());
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const probe = await context.newPage(); await probe.goto(fixture.origin); await probe.waitForFunction(() => !!(window as ProbeWindow).designRasterProbe);
  t.after(async () => { if (!probe.isClosed()) await probe.evaluate(() => (window as ProbeWindow).designRasterProbe.close()); });
  const render = async (page: DesignDrawPage, width: number, height: number) => {
    const value = await probe.evaluate(async ({ page, output }) => {
      const v = await (window as ProbeWindow).designRasterProbe.render(page, output);
      return v.ok ? { ok: true as const, png: Array.from(v.png), allocation: v.allocation } : v;
    }, { page, output: { width, height, dpi: 96 * width / 320 } });
    assert.ok(value.ok, `the GPU renders the page: ${JSON.stringify(value)}`);
    assert.equal(value.allocation.liveBytes, 0);
    return `data:image/png;base64,${Buffer.from(value.png).toString('base64')}`;
  };
  const report: Array<{ page: string; failing: string[]; regions: RegionStats[]; outline: Array<{ id: string; share: number; shift: number }>; svg: RegionStats[]; layout: RegionStats[]; faces: string[] }> = [];
  const failures: string[] = [];
  // Under load, headless Chrome can return a torn frame (upper rows repeated below), so a
  // reference is the first screenshot that matches the one taken just before.
  const faces = new Map<string, string[]>();
  const reference = async (url: string, width: number, height: number) => {
    const page = await context.newPage(); await page.setViewportSize({ width, height });
    await page.goto(url); await page.evaluate(() => document.fonts.ready);
    faces.set(url, await page.evaluate(() => [...document.fonts].map(f => `${f.family} ${f.style} ${f.weight} ${f.status}`)));
    let shot = await page.screenshot({ clip: { x: 0, y: 0, width, height } }), previous: Buffer | undefined;
    for (let tries = 0; !previous?.equals(shot); tries++) {
      assert.ok(tries < 8, `${url} settles into a stable screenshot`);
      previous = shot; shot = await page.screenshot({ clip: { x: 0, y: 0, width, height } });
    }
    await page.close();
    return `data:image/png;base64,${shot.toString('base64')}`;
  };
  const detail = (r: RegionStats) => r.ink ? `ink ${(100 * Math.abs(r.ink.a - r.ink.b) / (r.ink.a || 1)).toFixed(1)}% shift ${Math.hypot(r.ink.ax - r.ink.bx, r.ink.ay - r.ink.by).toFixed(2)}` : `${(100 * r.differing / (r.pixels || 1)).toFixed(2)}%`;
  for (const c of cases) {
    const width = 320 * c.scaleX, height = 240 * c.scaleY;
    const design = await reference(`${fixture.origin}/design/${c.key}`, width, height);
    const svg = await reference(`${fixture.origin}/svg/${c.key}`, width, height);
    const gpu = await render(c.drawing, width, height);
    const words = c.drawing.ops.some(op => op.words);
    const ground = words ? await render({ ...c.drawing, ops: c.drawing.ops.map(({ words: _w, ...op }) => op as DrawOp) }, width, height) : undefined;
    const regions = [...shapeRegions(c.drawing, c.scaleX, c.scaleY), ...runRegions(c.drawing, c.scaleX, c.scaleY)];
    const compareWith = (before: string, shot: string, within: typeof regions) => probe.evaluate<FidelityStats>(
      `(${compareInBrowser.toString()})(${JSON.stringify(before)},${JSON.stringify(shot)},${width},${height},${JSON.stringify(within)},${FILL_THRESHOLD},${ground ? JSON.stringify(ground) : 'undefined'},${FILL_SLACK})`);
    const compare = (shot: string, within: typeof regions) => compareWith(design, shot, within);
    // Against Design: shapes by pixels, words by ink and centroid.
    const stats = await compare(gpu, regions);
    // Against the exact outlines: each word's ink and centroid in the GPU image.
    const truth = words ? outlineTruth(c.drawing, c.scaleX, c.scaleY) : [];
    const outlineFault = async (shot: string, run: (typeof truth)[number]) => {
      const [m] = await probe.evaluate(`(${inkInBrowser.toString()})(${JSON.stringify(shot)},${JSON.stringify(ground)},${width},${height},${JSON.stringify([run])})`) as Array<{ ink: number; x: number; y: number; perArea: number }>;
      const share = Math.abs(m!.ink / (m!.perArea * run.area) - 1), shift = Math.hypot(m!.x - run.x, m!.y - run.y);
      return { share, shift, fault: share > EXACT_INK_SHARE || shift > EXACT_SHIFT ? `ink differs from the outline's area by ${(100 * share).toFixed(2)}% and sits ${shift.toFixed(3)} px from its centroid` : undefined };
    };
    const outline = await Promise.all(truth.map(async run => ({ id: run.id, ...(await outlineFault(gpu, run)) })));
    const failing = [
      ...stats.regions.flatMap(r => { const f = fault(r, c.scaleX); return f ? [`${r.id}: ${f}`] : []; }),
      ...outline.flatMap(r => r.fault ? [`${r.id} against its outline: ${r.fault}`] : []),
    ];
    // Diagnostics only: Chromium's own SVG of the same operations, and how far Chromium's text
    // sits from the operations' layout (the drawing compiler's harness owns that limit).
    const svgStats = await compareWith(svg, gpu, regions);
    const layout = words ? (await compareWith(design, svg, regions.filter(r => 'ink' in r))).regions : [];
    report.push({ page: c.key, failing, regions: stats.regions, outline: outline.map(({ id, share, shift }) => ({ id, share, shift })), svg: svgStats.regions, layout, faces: faces.get(`${fixture.origin}/design/${c.key}`) ?? [] });
    failures.push(...failing.map(f => `${c.key}/${f}`));
    for (const r of stats.regions) t.diagnostic(`${c.key} ${r.id}: ${detail(r)}`);
    for (const r of outline) t.diagnostic(`${c.key} ${r.id} against its outline: ink ${(100 * r.share).toFixed(2)}% shift ${r.shift.toFixed(3)}`);
    for (const r of svgStats.regions) t.diagnostic(`${c.key} ${r.id} against the SVG: ${detail(r)}`);
    for (const r of layout) t.diagnostic(`${c.key} ${r.id} Design text against the SVG: ${detail(r)}`);
    if (c.key === 'paths-1') {
      // Negative control: the same page with the triangle moved 2 px must fail its region.
      // A path's geometry is its contours (page coordinates), so the move shifts them with the box.
      const moved = structuredClone(c.drawing), target = moved.ops.find(op => op.id === 'triangle')!;
      target.box.x += 2;
      if (target.op === 'shape' && target.shape.kind === 'path') for (const contour of target.shape.contours) for (const q of contour.curves) for (const i of [0, 2, 4, 6]) q[i] = q[i]! + 2;
      const [region] = (await compare(await render(moved, width, height), regions.filter(r => r.id === 'triangle'))).regions;
      if (REPORT_ONLY) t.diagnostic(`control moved triangle: ${region ? `${(100 * region.differing / (region.pixels || 1)).toFixed(2)}%` : 'no region'}`);
      else assert.ok(region && fault(region, 1), 'the band catches a shape moved by 2 px');
    }
    if (c.key === 'text-1') {
      // Negative control: the narrowest word left out must fail its ink check.
      const target = regions.filter(r => 'ink' in r).sort((a, b) => a.w - b.w)[0]!;
      const [opId, at] = target.id.split(':') as [string, string];
      const [l, r] = at.split('.').map(Number) as [number, number];
      const missing = structuredClone(c.drawing); missing.ops.find(op => op.id === opId)!.words!.outlines![l]![r] = '';
      const [region] = (await compare(await render(missing, width, height), [target])).regions;
      if (REPORT_ONLY) t.diagnostic(`control missing word ${target.id}: ${region?.ink ? `ink ${(100 * Math.abs(region.ink.a - region.ink.b) / (region.ink.a || 1)).toFixed(1)}%` : 'no ink'}`);
      else assert.ok(region && fault(region, 1), `the ink check catches a missing word (${target.id})`);
      // Negative control: the same word moved by 3 px must fail the Design band.
      const shifted = structuredClone(c.drawing); shifted.ops.find(op => op.id === opId)!.words!.layout!.lines[l]!.runs[r]!.x += 3;
      const [away] = (await compare(await render(shifted, width, height), [target])).regions;
      if (REPORT_ONLY) t.diagnostic(`control word moved 3 px ${target.id}: ${away ? detail(away) : 'no region'}`);
      else assert.ok(away && fault(away, 1), `the Design band catches a word moved by 3 px (${target.id})`);
      // Negative control: the same word moved a quarter pixel must fail the outline check.
      const nudged = structuredClone(c.drawing); nudged.ops.find(op => op.id === opId)!.words!.layout!.lines[l]!.runs[r]!.x += 0.25;
      const nudge = await outlineFault(await render(nudged, width, height), truth.find(run => run.id === target.id)!);
      if (REPORT_ONLY) t.diagnostic(`control word moved 0.25 px ${target.id}: shift ${nudge.shift.toFixed(3)}`);
      else assert.ok(nudge.fault, `the outline check catches a word moved by 0.25 px (${target.id})`);
    }
  }
  if (process.env.LOLLY_DESIGN_GPU_FILL_REPORT) {
    await mkdir(dirname(process.env.LOLLY_DESIGN_GPU_FILL_REPORT), { recursive: true });
    await writeFile(process.env.LOLLY_DESIGN_GPU_FILL_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (!REPORT_ONLY) assert.deepEqual(failures, [], 'every shape region and word stays within the declared band');
});
