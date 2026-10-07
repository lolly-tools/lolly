// SPDX-License-Identifier: MPL-2.0
/**
 * The drawing compiler against the real Design renderer (plan 295, phase 3). Each
 * fixture page is mounted through the Design tool's own hooks and drawn by Chromium,
 * then compiled to drawing operations and drawn as SVG by the same Chromium; the two
 * screenshots are compared for the whole page and inside every operation's region.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { chromium, type Browser } from 'playwright';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { compileDesignDraw } from '../engine/src/design-draw.ts';
import { designDrawSvg } from '../engine/src/design-draw-svg.ts';
import { baseHost } from './helpers/host.ts';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { makeConnectorsApi } from '../engine/src/connectors.ts';
import { compareInBrowser, fidelityPages, type FidelityStats } from './helpers/design-fidelity.ts';

/** A pixel differs when a channel moves by more than this; CSS and SVG edge anti-aliasing measured at most 21. */
const THRESHOLD = 24;
/** The share of a region's pixels that may differ. Every region measured 0 at this threshold. */
const REGION_SHARE = 0.005;

test('compiled drawings match the Design renderer region by region', { timeout: 180_000 }, async (t) => {
  let browser: Browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { if (process.env.LOLLY_FIDELITY_REQUIRED === '1') throw error; t.skip('Fidelity needs Playwright Chromium.'); return; }
  t.after(() => browser.close());
  const tool = await loadTool('design', (p: string) => readFile(new URL(`../community/${p}`, import.meta.url), 'utf8'));
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const report: Array<{ page: string; stats: FidelityStats; ops: number }> = [];
  for (const page of fidelityPages()) {
    // The pure tool APIs every shell installs before a mount (`installToolApis`).
    const host = Object.assign(baseHost(), { color: makeColorApi(), geom: makeGeomApi(), connectors: makeConnectorsApi() });
    const runtime = await createRuntime(tool, host, { boxes: page.rows as never });
    assert.deepEqual(runtime.hookErrors ?? [], [], `${page.name}: the Design hooks render`);
    const design = await context.newPage();
    await design.setViewportSize({ width: page.width, height: page.height });
    await design.setContent(`<!doctype html><style>html,body{margin:0;background:#ffffff}</style><style>${tool.styles ?? ''}</style>`
      + `<div id="tool-canvas" style="position:relative;width:${page.width}px;height:${page.height}px;overflow:hidden">${runtime.getHydrated()}</div>`);
    const designPng = await design.screenshot({ clip: { x: 0, y: 0, width: page.width, height: page.height } });

    const draw = compileDesignDraw(page.rows as never, { width: page.width, height: page.height }, { effects: true, colors: 'resolved' });
    const svg = designDrawSvg(draw, { assetHref: () => undefined, family: () => 'system-ui', mono: 'monospace', title: page.name });
    const compiled = await context.newPage();
    await compiled.setViewportSize({ width: page.width, height: page.height });
    await compiled.setContent(`<!doctype html><style>html,body{margin:0;background:#ffffff}svg{display:block}</style>${svg}`);
    const compiledPng = await compiled.screenshot({ clip: { x: 0, y: 0, width: page.width, height: page.height } });

    const regions = draw.ops.filter((op) => op.op !== 'text').map((op) => ({ id: op.id, x: op.box.x - 4, y: op.box.y - 4, w: op.box.w + 8, h: op.box.h + 8 }));
    const stats = await compiled.evaluate(
      `(${compareInBrowser.toString()})(${JSON.stringify(`data:image/png;base64,${designPng.toString('base64')}`)}, ${JSON.stringify(`data:image/png;base64,${compiledPng.toString('base64')}`)}, ${page.width}, ${page.height}, ${JSON.stringify(regions)}, ${THRESHOLD})`,
    ) as FidelityStats;
    report.push({ page: page.name, stats, ops: draw.ops.length });
    if (process.env.LOLLY_FIDELITY_SHOTS) {
      const base = `${process.env.LOLLY_FIDELITY_SHOTS}/${page.name}`;
      await mkdir(dirname(base), { recursive: true });
      await writeFile(`${base}.design.png`, designPng); await writeFile(`${base}.compiled.png`, compiledPng); await writeFile(`${base}.svg`, svg);
    }
    await design.close(); await compiled.close();
  }
  if (process.env.LOLLY_FIDELITY_REPORT) {
    await mkdir(dirname(process.env.LOLLY_FIDELITY_REPORT), { recursive: true });
    await writeFile(process.env.LOLLY_FIDELITY_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  }
  const failing = report.flatMap(({ page, stats }) => stats.regions
    .filter((r) => r.pixels > 0 && r.differing / r.pixels > REGION_SHARE)
    .map((r) => `${page}/${r.id}: ${(100 * r.differing / r.pixels).toFixed(1)}% of ${r.pixels} px`));
  for (const { page, stats } of report) t.diagnostic(`${page}: ${stats.differing} differing px of ${stats.width * stats.height}; largest channel step ${stats.maxChannel}`);
  assert.deepEqual(failing, [], 'every operation region matches the Design renderer within the edge allowance');
});
