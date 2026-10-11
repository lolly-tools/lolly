// SPDX-License-Identifier: MPL-2.0
/** Independent finite-geometry support and full-interior controls for GPU pages. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright';
import type { DesignDrawPage, DrawOp } from '../engine/src/design-draw.ts';
import type {} from './design-draw-webgpu.browser.test.ts';
import { createDesignGpuFixture } from './helpers/design-webgpu-fixture.ts';

type Point = readonly [number, number];
interface Control { id: string; box: { x: number; y: number; w: number; h: number }; rot: number; flipH?: boolean; flipV?: boolean }
const controls: Control[] = [
  ...[0, 5, 17, 37, 90, -37, -163, 1e6].map(rot => ({ id: 'rectangle-' + rot, box: { x: 12.125, y: 9.375, w: 23.5, h: 13.25 }, rot })),
  { id: 'mirrored', box: { x: 12.125, y: 9.375, w: 23.5, h: 13.25 }, rot: 37, flipH: true, flipV: true },
  { id: 'thin-vertical', box: { x: 29.125, y: 8.375, w: 1, h: 31.25 }, rot: 17 },
  { id: 'thin-horizontal', box: { x: 13.375, y: 23.125, w: 31.25, h: 1 }, rot: -37 },
  { id: 'clipped-negative', box: { x: -17.25, y: 20.5, w: 39.75, h: 11.5 }, rot: 17, flipV: true },
  { id: 'largest-admitted', box: { x: -499968, y: -499976, w: 1e6, h: 1e6 }, rot: 37 },
  { id: 'outside-page-at-admitted-bound', box: { x: 1e6, y: 1e6, w: 12, h: 8 }, rot: -37 },
];

function drawing(c: Control): DesignDrawPage {
  const shape: DrawOp = { id: c.id, op: 'shape', box: c.box, shape: { kind: 'rect', radius: 0 }, opacity: 100,
    fills: [{ kind: 'color', color: '#4e7aa1' }], pose: { rot: c.rot, flipH: c.flipH ?? false, flipV: c.flipV ?? false } };
  return { version: 0, width: 64, height: 48, background: '#ffffff', ops: [shape], findings: [],
    frame: { id: 'page', op: 'shape', box: { x: 0, y: 0, w: 64, h: 48 }, shape: { kind: 'rect', radius: 0 },
      opacity: 100, fills: [{ kind: 'color', color: '#ffffff', opacity: 0 }] } };
}

/** Separating axes classify whole pixels without clipping or row integration. */
function classify(c: Control, x: number, y: number, scaleX: number, scaleY: number): 'empty' | 'full' | 'partial' {
  const angle = c.rot * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
  const cx = c.box.x + c.box.w / 2, cy = c.box.y + c.box.h / 2;
  const corners: Point[] = [[x / scaleX, y / scaleY], [(x + 1) / scaleX, y / scaleY],
    [(x + 1) / scaleX, (y + 1) / scaleY], [x / scaleX, (y + 1) / scaleY]];
  const local = corners.map(([px, py]) => [cosine * (px - cx) + sine * (py - cy), -sine * (px - cx) + cosine * (py - cy)]);
  const lo = [Math.min(...local.map(p => p[0]!)), Math.min(...local.map(p => p[1]!))];
  const hi = [Math.max(...local.map(p => p[0]!)), Math.max(...local.map(p => p[1]!))];
  const half = [c.box.w / 2, c.box.h / 2];
  // Exclude points near the authored boundaries with a scale-based clearance.
  // The assertions themselves require exact bytes, not an error tolerance.
  const margin = 16 * 2 ** -23 * Math.max(1, Math.abs(c.box.x), Math.abs(c.box.y), c.box.w, c.box.h);
  if (lo.every((v, i) => v > -half[i]! + margin) && hi.every((v, i) => v < half[i]! - margin)) return 'full';
  if (lo.some((v, i) => v > half[i]! + margin) || hi.some((v, i) => v < -half[i]! - margin)) return 'empty';
  const vertices = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
    [cx + cosine * sx! * half[0]! - sine * sy! * half[1]!, cy + sine * sx! * half[0]! + cosine * sy! * half[1]!]);
  const minX = Math.min(...vertices.map(p => p[0]!)), maxX = Math.max(...vertices.map(p => p[0]!));
  const minY = Math.min(...vertices.map(p => p[1]!)), maxY = Math.max(...vertices.map(p => p[1]!));
  if ((x + 1) / scaleX < minX - margin || x / scaleX > maxX + margin
    || (y + 1) / scaleY < minY - margin || y / scaleY > maxY + margin) return 'empty';
  return 'partial';
}

test('finite support and fully covered pixels survive representative transforms and scales', { timeout: 180_000 }, async () => {
  const receipt: Record<string, unknown> = { kind: 'Independent support/interior controls; not native fidelity qualification',
    cases: [], expectedOpaque: [78, 122, 161, 255], sampleSelection: 'Double precision separating axes with boundary clearance; exact RGBA assertions.' };
  const record = async () => { if (process.env.LOLLY_DESIGN_SUPPORT_REPORT) {
    await mkdir(dirname(process.env.LOLLY_DESIGN_SUPPORT_REPORT), { recursive: true });
    await writeFile(process.env.LOLLY_DESIGN_SUPPORT_REPORT, JSON.stringify(receipt, null, 2) + '\n');
  } };
  await record();
  const fixture = await createDesignGpuFixture();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true, ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}) });
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    const probe = await context.newPage(); await probe.goto(fixture.origin);
    await probe.waitForFunction(() => !!window.designRasterProbe);
    try {
      receipt.browser = browser.version(); receipt.fixtureSources = fixture.sourceHashes;
      receipt.adapterBeforeAssertions = await probe.evaluate(async () => {
        const d = await window.designRasterProbe.requireWebGpu(), i = d.adapterInfo;
        return { vendor: i.vendor, architecture: i.architecture, device: i.device, description: i.description, fallback: i.isFallbackAdapter };
      });
      await record();
      const cases: unknown[] = [];
      let failedPixels = 0;
      for (const c of controls) for (const [scaleX, scaleY] of [[1, 1], [1.5, 1.5], [1.5, 2], [2, .75]]) {
        const width = 64 * scaleX!, height = 48 * scaleY!;
        const value = await probe.evaluate(async ({ page, output }) => {
          const api = window.designRasterProbe, admission = api.prepareDesignRaster(page, output);
          if (!admission.ok) return { ok: false as const, findings: admission.findings };
          const result = await api.renderDesignRaster(admission.evaluation);
          return { ok: true as const, data: Array.from(result.data), allocation: result.allocation, identity: result.identity };
        }, { page: drawing(c), output: { width, height } });
        assert.ok(value.ok, 'independent control is admitted: ' + JSON.stringify(value));
        let empty = 0, full = 0, partial = 0;
        const failures: unknown[] = [];
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const kind = classify(c, x, y, scaleX!, scaleY!), actual = value.data.slice((y * width + x) * 4, (y * width + x) * 4 + 4);
          if (kind === 'empty') { empty++; if (actual.some(v => v !== 0)) failures.push({ x, y, kind, actual }); }
          else if (kind === 'full') { full++; if (actual.some((v, i) => v !== [78, 122, 161, 255][i])) failures.push({ x, y, kind, actual }); }
          else partial++;
        }
        failedPixels += failures.length;
        cases.push({ control: c, scaleX, scaleY, width, height, empty, full, partial, failures, rawRgba: value.data, allocation: value.allocation, identity: value.identity });
        receipt.cases = cases; await record();
        assert.equal(value.allocation.liveBytes, 0); assert.equal(value.allocation.created, value.allocation.destroyed);
        assert.ok(empty + full > 0, 'control exercises independent classified pixels');
      }
      receipt.completed = true; receipt.failedPixels = failedPixels; await record();
      assert.equal(failedPixels, 0, 'independently classified finite support and full interior pixels');
    } finally {
      if (!probe.isClosed()) await probe.evaluate(() => { window.designRasterProbe.close(); window.designRasterProbe.resetWebGpuDevice(); });
      await context.close();
    }
  } finally { await browser?.close(); await fixture.close(); }
});
