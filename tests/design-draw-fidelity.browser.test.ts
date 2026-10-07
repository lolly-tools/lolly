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
import { compileDesignDraw, describeDesignDrawPictures, layoutDesignDrawText, type DrawOp } from '../engine/src/design-draw.ts';
import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { createNodeTextShaper } from '../packages/node-shell/src/text-measure.ts';
import { designDrawSvg } from '../engine/src/design-draw-svg.ts';
import { TEXT_MEASURE_DEFAULTS } from '../engine/src/design-text-measure.ts';
import { baseHost } from './helpers/host.ts';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { makeConnectorsApi } from '../engine/src/connectors.ts';
import { compareInBrowser, fidelityPages, fidelityPictures, walkerBundle, type FidelityStats, type RegionStats } from './helpers/design-fidelity.ts';
import { designPageSvg, type DesignPageSvgHost } from '../engine/src/design-page-svg.ts';
import { toCssLength } from '../engine/src/units.ts';

/** A pixel differs when a channel moves by more than this; CSS and SVG edge anti-aliasing measured at most 21. */
const THRESHOLD = 24;
/** The share of a region's pixels that may differ. Every region without text measured 0 at this threshold. */
const REGION_SHARE = 0.005;
/**
 * The share for a region with text. Runs are placed from the measure's HarfBuzz advances,
 * which agree with the canvas within its declared 0.5 px; at a run boundary that moves
 * glyph edges by a fraction of a pixel (measured: 0.49% of the rich-text box, 0.21% of a
 * bordered box, 0 elsewhere).
 */
const TEXT_REGION_SHARE = 0.015;
/**
 * Outlined text is drawn as path fills, not by the font rasteriser, so its edges differ
 * pixel by pixel and the two never match exactly. It is judged run by run, as the
 * conformance chapter judges a region: the ink a run adds to the page must match the
 * browser's text within this share, and its ink centroid within this distance.
 * Measured on macOS Chromium: outlines carry 2.5% to 17.4% less ink than the browser's
 * text (its rasteriser thickens glyph stems; light text on a dark box is the largest
 * gap) and their centroids sit at most 0.60 px away, with no common direction. The
 * test proves the limits still catch faults: a missing word and a word moved by 2 px.
 */
const OUTLINE_INK_SHARE = 0.25;
const OUTLINE_INK_SHIFT = 1;

/** One ink region per run with visible text: its advance, a size above and below the baseline, inside the box. */
function runRegions(op: DrawOp): Array<{ id: string; x: number; y: number; w: number; h: number; ink: true }> {
  const words = op.words, size = op.words?.spec.size ?? TEXT_MEASURE_DEFAULTS.size;
  if (!words?.layout) return [];
  return words.layout.lines.flatMap((line, l) => line.runs.flatMap((run, r) => {
    if (!run.text.trim()) return [];
    const x0 = Math.max(op.box.x, op.box.x + line.x + run.x - 1), x1 = Math.min(op.box.x + op.box.w, op.box.x + line.x + run.x + run.width + 1);
    const y0 = Math.max(op.box.y, op.box.y + line.baseline - size), y1 = Math.min(op.box.y + op.box.h, op.box.y + line.baseline + 0.3 * size);
    return x1 - x0 >= 1 && y1 - y0 >= 1 ? [{ id: `${op.id}:${l}.${r}`, x: x0, y: y0, w: x1 - x0, h: y1 - y0, ink: true as const }] : [];
  }));
}

/** Why a region fails, or undefined when it passes. */
function regionFault(r: RegionStats, withText: boolean): string | undefined {
  if (r.ink) {
    // Outlined words against the browser's own text: the same ink, in the same place.
    const share = r.ink.a ? Math.abs(r.ink.a - r.ink.b) / r.ink.a : 0, shift = Math.hypot(r.ink.ax - r.ink.bx, r.ink.ay - r.ink.by);
    return share > OUTLINE_INK_SHARE || shift > OUTLINE_INK_SHIFT ? `ink differs by ${(100 * share).toFixed(1)}% and sits ${shift.toFixed(2)} px away` : undefined;
  }
  return r.pixels > 0 && r.differing / r.pixels > (withText ? TEXT_REGION_SHARE : REGION_SHARE)
    ? `${(100 * r.differing / r.pixels).toFixed(1)}% of ${r.pixels} px` : undefined;
}

test('compiled drawings match the Design renderer region by region', { timeout: 180_000 }, async (t) => {
  let browser: Browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { if (process.env.LOLLY_FIDELITY_REQUIRED === '1') throw error; t.skip('Fidelity needs Playwright Chromium.'); return; }
  t.after(() => browser.close());
  const tool = await loadTool('design', (p: string) => readFile(new URL(`../community/${p}`, import.meta.url), 'utf8'));
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  // A page on a real origin, so the walker can fetch the shell-served faces and HarfBuzz.
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
  const walker = await walkerBundle();
  const walkerReport: Array<{ page: string; stats: FidelityStats; failing: string[] }> = [];
  // Both sides draw text in the repo's SUSE faces: Chromium through @font-face, the
  // compiled side through the Node HarfBuzz shaper that reads the same files.
  const face = async (file: string) => (await readFile(new URL(`../shells/web/public/fonts/${file}`, import.meta.url))).toString('base64');
  const fonts = `@font-face{font-family:'SUSE';src:url(data:font/ttf;base64,${await face('SUSE[wght].ttf')}) format('truetype');font-weight:100 900;font-style:normal}`
    + `@font-face{font-family:'SUSE';src:url(data:font/ttf;base64,${await face('SUSE-Italic[wght].ttf')}) format('truetype');font-weight:100 900;font-style:italic}`
    + `@font-face{font-family:'SUSE Mono';src:url(data:font/ttf;base64,${await face('SUSEMono[wght].ttf')}) format('truetype');font-weight:100 800}`
    + `#tool-canvas{--font-brand:'SUSE';--font-display:'SUSE';--font-mono:'SUSE Mono';--font-italic:'SUSE'}`;
  const shaper = createNodeTextShaper();
  const textApi = createNodeTextAPI({ repoRoot: repoRoot() });
  const report: Array<{ page: string; stats: FidelityStats; ops: number }> = [];
  const withText = new Set<string>();
  const png = (bytes: Buffer) => JSON.stringify(`data:image/png;base64,${bytes.toString('base64')}`);
  // The same pictures on both sides: the Design host resolves the fixture ids to them, and
  // the compiled side links them and reads their own size.
  const pictures = fidelityPictures();
  const assets = { get: async (id: string) => (pictures[id] ? { id, ...pictures[id] } : { id, url: `asset:${id}` }) };
  const emit = { assetHref: (ref: string) => pictures[ref]?.url, family: () => 'system-ui', mono: 'monospace' };
  // The export pipeline's host: the same shaper, outliner and pictures.
  const pageHost: DesignPageSvgHost = {
    shaper,
    toPath: (opts) => textApi.toPath(opts),
    picture: async (ref) => (pictures[ref] ? { bytes: new Uint8Array(Buffer.from(pictures[ref].url.slice(pictures[ref].url.indexOf(',') + 1), 'base64')) } : null),
  };
  let controlled = false;
  for (const page of fidelityPages()) {
    // The pure tool APIs every shell installs before a mount (`installToolApis`).
    const host = Object.assign(baseHost(), { assets, color: makeColorApi(), geom: makeGeomApi(), connectors: makeConnectorsApi() });
    const runtime = await createRuntime(tool, host, { boxes: page.rows as never });
    assert.deepEqual(runtime.hookErrors ?? [], [], `${page.name}: the Design hooks render`);
    const design = await context.newPage();
    await design.setViewportSize({ width: page.width, height: page.height });
    await design.goto('http://localhost/');
    await design.setContent(`<!doctype html><style>html,body{margin:0;background:#ffffff}${fonts}</style><style>${tool.styles ?? ''}</style>`
      + `<div id="tool-canvas" style="position:relative;width:${page.width}px;height:${page.height}px;overflow:hidden">${runtime.getHydrated()}</div>`);
    await design.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))); });
    const designPng = await design.screenshot({ clip: { x: 0, y: 0, width: page.width, height: page.height } });
    // The walker's export of the same live page, judged below with the same regions.
    await design.addScriptTag({ content: walker, type: 'module' });
    await design.waitForFunction(() => !!(window as unknown as { __render?: unknown }).__render);
    const walkerSvg = await design.evaluate(async () => {
      const w = window as unknown as { __setup: () => void; __render: (node: Element, opts: object) => Promise<Blob> };
      w.__setup();
      return (await w.__render(document.querySelector('.lolly-frame-page')!, { rasterFallback: false })).text();
    });
    // The web bridge's own SVG export of the frame, with the authored document attached as
    // the runtime attaches it: it must choose the drawing operations and write the same
    // bytes the engine pipeline writes in Node, which is what the CLI delivers.
    const bridge = await design.evaluate(async (args) => {
      const logs: string[] = [];
      const w = window as unknown as { __exportApi: (p: unknown, l: string[]) => { render: (n: Element, f: string, o: object) => Promise<Blob> } };
      const blob = await w.__exportApi(args.pictures, logs).render(document.querySelector('.lolly-frame-page')!, 'svg', { sourceDocument: { toolId: 'design', values: { boxes: args.rows } } });
      return { svg: await blob.text(), logs };
    }, { pictures, rows: page.rows });
    const px = { value: page.width, unit: 'px' as const }, py = { value: page.height, unit: 'px' as const };
    const nodeSvg = (await designPageSvg({ boxes: page.rows }, page.name, pageHost, { dpi: 96, size: { width: toCssLength(px), height: toCssLength(py), px: { w: page.width, h: page.height } } })).svg;
    assert.ok(bridge.logs.some((line) => line.includes('drawn from the drawing operations')), `${page.name}: the web export chose the drawing operations (${bridge.logs.join(' ')})`);
    assert.equal(bridge.svg, nodeSvg, `${page.name}: the web export writes the bytes the engine pipeline writes in Node`);

    for (const outlined of [false, true]) {
      const name = outlined ? `${page.name}-outlined` : page.name;
      // Live text from the compile itself; outlined text from the export pipeline, the bytes a page export delivers.
      let draw = compileDesignDraw(page.rows as never, { width: page.width, height: page.height }, { effects: true, colors: 'resolved' });
      let exported: string | undefined;
      if (outlined) {
        const result = await designPageSvg({ boxes: page.rows }, page.name, pageHost, { title: name });
        draw = result.page;
        exported = result.svg;
        if (!draw.ops.some((op) => op.words)) continue;
      } else {
        await layoutDesignDrawText(draw, shaper);
        await describeDesignDrawPictures(draw, async (ref) => pictures[ref] ?? null);
      }
      assert.deepEqual(draw.findings.map((f) => `${f.id}:${f.feature}`), [], `${page.name}: the compile carries every authored feature`);
      const judging = outlined || !draw.ops.some((op) => op.words);
      const compiled = await context.newPage();
      await compiled.setViewportSize({ width: page.width, height: page.height });
      const shoot = async (drawing: typeof draw | string) => {
        await compiled.setContent(`<!doctype html><style>html,body{margin:0;background:#ffffff}svg{display:block}${fonts}</style>${typeof drawing === 'string' ? drawing : designDrawSvg(drawing, { ...emit, title: name })}`);
        await compiled.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))); });
        return compiled.screenshot({ clip: { x: 0, y: 0, width: page.width, height: page.height } });
      };
      const compiledPng = await shoot(exported ?? draw);
      // Outlined words are judged by their ink against the same page with the words removed.
      const groundPng = outlined ? await shoot({ ...draw, ops: draw.ops.map(({ words: _words, ...op }) => op as DrawOp) }) : undefined;

      // Live text is judged with its operation's region. Outlined words are judged run by
      // run instead, so a missing or moved word fills a region of its own.
      const regions: Array<{ id: string; x: number; y: number; w: number; h: number; ink?: true }> = draw.ops
        .filter((op) => op.op !== 'text' && !(outlined && op.words))
        .map((op) => ({ id: op.id, x: op.box.x - 4, y: op.box.y - 4, w: op.box.w + 8, h: op.box.h + 8 }));
      if (outlined) regions.push(...draw.ops.flatMap((op) => runRegions(op)));
      // A frame that paints more than a flat fill is judged over the whole page.
      if (draw.frame && (draw.frame.fills.length > 1 || draw.frame.picture || draw.frame.stroke || (draw.frame.shape.kind === 'rect' && draw.frame.shape.radius > 0))) {
        regions.push({ id: draw.frame.id, x: 0, y: 0, w: page.width, h: page.height });
      }
      for (const op of draw.ops) if (op.words) withText.add(`${name}/${op.id}`);
      const compare = (shot: Buffer, within: typeof regions) => compiled.evaluate(
        `(${compareInBrowser.toString()})(${png(designPng)}, ${png(shot)}, ${page.width}, ${page.height}, ${JSON.stringify(within)}, ${THRESHOLD}${groundPng ? `, ${png(groundPng)}` : ''})`,
      ) as Promise<FidelityStats>;
      report.push({ page: name, stats: await compare(compiledPng, regions), ops: draw.ops.length });
      if (judging) {
        const stats = await compare(await shoot(walkerSvg), regions);
        const failing = stats.regions.flatMap((r) => { const fault = regionFault(r, withText.has(`${name}/${r.id}`)); return fault ? [`${r.id}: ${fault}`] : []; });
        walkerReport.push({ page: page.name, stats, failing });
      }

      if (outlined && !controlled) {
        // Negative controls on the narrowest run: the limits above must still catch a
        // missing word and a moved one.
        controlled = true;
        const target = regions.filter((r) => r.ink).sort((a, b) => a.w - b.w)[0]!;
        t.diagnostic(`negative controls on ${name}/${target.id}`);
        const [opId, at] = target.id.split(':') as [string, string];
        const [l, r] = at.split('.').map(Number) as [number, number];
        for (const fault of ['missing', 'moved'] as const) {
          const broken = structuredClone(draw), words = broken.ops.find((op) => op.id === opId)!.words!;
          if (fault === 'missing') words.outlines![l]![r] = '';
          else words.layout!.lines[l]!.runs[r]!.x += 2;
          const [region] = (await compare(await shoot(broken), [target])).regions;
          assert.ok(region && regionFault(region, true), `${name}/${target.id}: the ink check catches a ${fault} word`);
        }
      }
      if (process.env.LOLLY_FIDELITY_SHOTS) {
        const base = `${process.env.LOLLY_FIDELITY_SHOTS}/${name}`;
        await mkdir(dirname(base), { recursive: true });
        await writeFile(`${base}.design.png`, designPng); await writeFile(`${base}.compiled.png`, compiledPng);
        await writeFile(`${base}.svg`, exported ?? designDrawSvg(draw, { ...emit, title: name }));
        if (judging) await writeFile(`${base}.walker.svg`, walkerSvg);
      }
      await compiled.close();
    }
    await design.close();
  }
  assert.ok(controlled, 'the fixture pages include outlined text for the negative controls');
  if (process.env.LOLLY_FIDELITY_REPORT) {
    await mkdir(dirname(process.env.LOLLY_FIDELITY_REPORT), { recursive: true });
    await writeFile(process.env.LOLLY_FIDELITY_REPORT, `${JSON.stringify({ operations: report, walker: walkerReport }, null, 2)}\n`);
  }
  const failing = report.flatMap(({ page, stats }) => stats.regions.flatMap((r) => {
    const fault = regionFault(r, withText.has(`${page}/${r.id}`));
    return fault ? [`${page}/${r.id}: ${fault}`] : [];
  }));
  for (const { page, stats } of report) t.diagnostic(`${page}: ${stats.differing} differing px of ${stats.width * stats.height}; largest channel step ${stats.maxChannel}`);
  // The walker is the comparison, reported and not judged: the regions it misses are the evidence for P3d.
  for (const { page, stats, failing } of walkerReport) t.diagnostic(`walker ${page}: ${stats.differing} differing px; ${failing.length} region(s) over the limit${failing.length ? `: ${failing.join('; ')}` : ''}`);
  assert.deepEqual(failing, [], 'every operation region matches the Design renderer within the edge allowance');
});
