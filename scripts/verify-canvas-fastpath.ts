// SPDX-License-Identifier: MPL-2.0
/**
 * Served-app acceptance gate for the geometry paint fast-skip (plans/98 section 9). This is the
 * verification the two REVERTED attempts lacked - it drives REAL pointer drags in a real
 * headless Chrome against the built web dist and asserts, per gesture:
 *   - a pure-translation drag of a SAFE box (plain, fitText) ENGAGES the skip
 *     (window.__lollyGeomFastPath.skips++) and leaves the box DOM COMPUTED-STYLE identical
 *     to a from-scratch full paint of the same post-drag doc - the export/CLI determinism
 *     invariant (section 11), since the export walker reads getComputedStyle (raw-attr whitespace
 *     is irrelevant). fitText proves the runtime `--fit` custom property survives.
 *   - dragging a cross-box-coupled box (a clip mask) REFUSES (fulls++, skips unchanged) and
 *     is likewise parity-identical.
 *
 * Design enables guarded translation by default; canvasfastpath=0 forces the control.
 * Other editors remain opt-in via canvasfastpath=1. Usage:
 *   pnpm run build:web && node scripts/verify-canvas-fastpath.ts
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { AddressInfo } from 'node:net';
import { chromium, type Page } from 'playwright-core';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { build } from 'esbuild';
import type {} from '../shells/web/src/views/canvas-content.ts';

const DIST = process.env.LOLLY_WEB_DIST ?? join(process.cwd(), 'shells/web/dist');
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.png': 'image/png' };

function serveDist(): Promise<{ base: string; close: () => Promise<void> }> {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('shells/web/dist not built - run `pnpm run build:web` first');
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      let fp = join(DIST, decodeURIComponent(url.pathname));
      if (!existsSync(fp) || url.pathname === '/') fp = join(DIST, 'index.html');
      res.writeHead(200, { 'content-type': MIME[extname(fp)] ?? 'application/octet-stream' });
      res.end(await readFile(fp));
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => {
    ok({ base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => new Promise<void>((d) => server.close(() => d())) });
  }));
}

const FIXTURE = [
  { id: 'plain', kind: 'box', x: 120, y: 120, w: 220, h: 90, text: 'Plain box' },
  { id: 'fit', kind: 'text', x: 520, y: 120, w: 200, h: 80, text: 'A long fitted string that must shrink to fit its box', fitText: 1 },
  { id: 'mask', kind: 'box', x: 140, y: 360, w: 160, h: 160 },
  { id: 'clipped', kind: 'image', x: 160, y: 380, w: 240, h: 120, clip: 'mask' },
];
const FRAME_FIXTURE = [
  { id: 'board', kind: 'frame', x: 80, y: 60, w: 900, h: 540, order: 0, bg: '#fff', stroke: '#456', strokeW: 2.5 },
  ...FIXTURE.map(box => ({ ...box, frame: 'board' })),
];
const GROUP_FIXTURE = Array.from({ length: 100 }, (_, i) => ({ id: i === 0 ? 'plain' : `group${i}`,
  kind: i === 1 ? 'text' : 'box', x: 100 + i % 10 * 85, y: 100 + Math.floor(i / 10) * 55,
  w: 60, h: 40, text: i === 1 ? 'Fitted group text' : '', fitText: i === 1 ? 1 : 0 }));
const targetSelector = (id: string): string => `#tool-canvas .lolly-box[data-box-id="${id}"],#tool-canvas .lolly-frame-page[data-frame-id="${id}"]`;

let fails = 0;

async function main(): Promise<void> {
  const bundle = await build({
    stdin: { contents: `export { renderSvgFromHtml } from './shells/web/src/bridge/export-svg-walker.ts';`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'iife', globalName: 'geometryExporter', platform: 'browser',
    loader: { '.css': 'empty' }, external: ['module'], logLevel: 'silent',
  });
  const { base, close } = await serveDist();
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: webGpuLaunchArgs('auto') });

  const url = (boxes: unknown, fast: boolean) => `${base}/${fast ? '' : '?canvasfastpath=0'}#/tool/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}`;
  const styles = (pg: Page) => pg.evaluate(() => {
    const o: Record<string, string> = {};
    for (const el of document.querySelector('#tool-canvas')!.querySelectorAll('.lolly-box[data-box-id],.lolly-frame-page[data-frame-id]')) {
      const c = getComputedStyle(el);
      o[el.getAttribute('data-box-id') ?? el.getAttribute('data-frame-id')!] = [c.left, c.top, c.width, c.height, c.transform, c.fontSize, c.overflow, c.borderLeftWidth].join('|');
    }
    return o;
  });
  const counters = (pg: Page) => pg.evaluate(() => ({ ...((window as unknown as { __lollyGeomFastPath?: { skips: number; fulls: number } }).__lollyGeomFastPath ?? { skips: 0, fulls: 0 }) }));
  async function exported(pg: Page): Promise<string> {
    await pg.addScriptTag({ content: bundle.outputFiles[0]!.text });
    return pg.evaluate(async () => {
      const exporter = (window as unknown as { geometryExporter: { renderSvgFromHtml(node: Element, opts: { rasterFallback: boolean }): Promise<Blob> } }).geometryExporter;
      return (await exporter.renderSvgFromHtml(document.querySelector('#tool-canvas, #tool-content')!, { rasterFallback: false })).text();
    });
  }
  const metadata = (pg: Page) => pg.locator('#tool-canvas script[data-penpot-doc],#tool-canvas script[data-pptx-deck]').allTextContents();
  async function boot(boxes: unknown, fast = true): Promise<Page> {
    const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await p.goto(url(boxes, fast), { waitUntil: 'load' });
    await p.waitForSelector(targetSelector('plain'), { timeout: 20000 });
    await p.waitForTimeout(700); // let the first full paint + fit <script> settle
    return p;
  }
  async function dragBody(p: Page, id: string, dx: number, dy: number): Promise<void> {
    const r = await p.evaluate((selector) => { const b = document.querySelector(selector)!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, targetSelector(id));
    await p.mouse.move(r.x, r.y); await p.mouse.down();
    await p.mouse.move(r.x + dx, r.y + dy, { steps: 10 }); await p.mouse.up();
    await p.waitForTimeout(350);
  }

  async function selectAll(p: Page, id: string): Promise<void> {
    await p.locator(targetSelector(id)).click();
    await p.keyboard.press('Control+a');
  }

  async function contentEdit(label: string, field: 'text' | 'bg' | 'w', wantPatch: boolean, boxes = FIXTURE, id = 'plain') {
    const snapshots = [];
    for (const fast of [true, false]) {
      const p = await boot(boxes, fast), nodes = await p.locator('#tool-canvas .lolly-box[data-box-id]').elementHandles();
      await p.evaluate(({ boxes, field, id }) => {
        const set = (globalThis as { __lollySetInput?: (name: string, value: unknown) => void }).__lollySetInput;
        if (!set) throw new Error('Runtime input setter unavailable');
        set('boxes', boxes.map(box => box.id === id ? { ...box, [field]: field === 'text' ? 'Changed text' : field === 'bg' ? '#ff8833' : 260 } : box));
      }, { boxes, field, id });
      await p.waitForTimeout(500);
      const patches = await p.evaluate(() => window.__lollyCanvasContentPath?.patches ?? 0);
      if (fast && (wantPatch ? patches < 1 : patches !== 0)) throw new Error(`${label}: unexpected content patch count ${patches}`);
      if (fast && wantPatch && !(await Promise.all(nodes.map(node => node.evaluate(element => element.isConnected)))).every(Boolean)) throw new Error(`${label}: an authored node was remounted`);
      snapshots.push({ styles: await styles(p), svg: await exported(p), metadata: await metadata(p) });
      await p.close();
    }
    if (JSON.stringify(snapshots[0]) !== JSON.stringify(snapshots[1])) throw new Error(`${label}: incremental/full output differs`);
    console.log(`[${label}] ${wantPatch ? 'PATCH' : 'REFUSE'}: ok; retained nodes, computed styles, SVG and export metadata parity: ok`);
  }

  async function gesture(label: string, id: string, wantSkip: boolean, boxes: unknown = FIXTURE, group = false): Promise<void> {
    const p = await boot(boxes);
    if (group) await selectAll(p, id);
    const originalStyles = await styles(p);
    const originals = await p.locator('#tool-canvas .lolly-box[data-box-id],#tool-canvas .lolly-frame-page[data-frame-id]').elementHandles();
    const originalNode = await p.locator(targetSelector(id)).elementHandle();
    const c0 = await counters(p);
    await dragBody(p, id, 60, 40);
    const c1 = await counters(p);
    const gateOk = wantSkip ? c1.skips > c0.skips : (c1.fulls > c0.fulls && c1.skips === c0.skips);
    const live = await styles(p);
    if (wantSkip && !await originalNode!.evaluate(node => node.isConnected)) throw new Error(`${label}: box was remounted; counters ${JSON.stringify({ c0, c1 })}; styles ${originalStyles[id]} -> ${live[id]}`);
    if (group) {
      const moved = Object.keys(live).filter(key => live[key]!.split('|').slice(0, 2).join('|') !== originalStyles[key]!.split('|').slice(0, 2).join('|'));
      if (moved.length !== GROUP_FIXTURE.length) throw new Error(`${label}: moved ${moved.length} of ${GROUP_FIXTURE.length} selected objects`);
      if (wantSkip && !(await Promise.all(originals.map(node => node.evaluate(element => element.isConnected)))).every(Boolean)) throw new Error(`${label}: a group member was remounted`);
    }
    const liveSvg = await exported(p);
    const liveMetadata = await metadata(p);
    await p.close();

    // Repeat the same gesture with patching disabled. Round-tripping the URL
    // normalizes sparse block defaults, so it is not an equivalent input model.
    const p2 = await boot(boxes, false);
    if (group) await selectAll(p2, id);
    await dragBody(p2, id, 60, 40);
    const full = await styles(p2);
    const fullSvg = await exported(p2);
    const fullMetadata = await metadata(p2);
    await p2.close();

    let parity = true;
    for (const k of new Set([...Object.keys(live), ...Object.keys(full)])) {
      if (live[k] !== full[k]) { parity = false; console.log(`   DIFF ${k}\n     live: ${live[k]}\n     full: ${full[k]}`); }
    }
    const svgParity = liveSvg === fullSvg;
    const metadataParity = JSON.stringify(liveMetadata) === JSON.stringify(fullMetadata);
    for (const [kind, a, b] of [['svg', liveSvg, fullSvg], ['metadata', JSON.stringify(liveMetadata), JSON.stringify(fullMetadata)]]) {
      if (a !== b) {
        let offset = 0;
        while (offset < a!.length && a![offset] === b![offset]) offset++;
        console.log(`  ${kind} difference at ${offset}: ${a!.slice(Math.max(0, offset - 80), offset + 240)}\n  control: ${b!.slice(Math.max(0, offset - 80), offset + 240)}`);
      }
    }
    const ok = gateOk && parity && svgParity && metadataParity;
    if (!ok) fails++;
    console.log(`[${label}] ${wantSkip ? 'SKIP' : 'REFUSE'}: ${gateOk ? 'ok' : 'FAIL'} (skips ${c0.skips}->${c1.skips}, fulls ${c0.fulls}->${c1.fulls}) | computed-style parity: ${parity ? 'ok' : 'FAIL'}`);
    console.log(`  SVG byte parity: ${svgParity ? 'ok' : 'FAIL'}; export metadata parity: ${metadataParity ? 'ok' : 'FAIL'}`);
  }

  if (!process.argv.includes('--group-only')) {
    await gesture('drag plain', 'plain', true);
    await gesture('drag fitText (--fit must survive)', 'fit', true);
    await gesture('drag clip mask (cross-box → refuse)', 'mask', false);
    await gesture('drag member inside a bordered board', 'plain', true, FRAME_FIXTURE);
    await gesture('drag fitted text inside a bordered board', 'fit', true, FRAME_FIXTURE);
    await gesture('drag clip mask inside a board', 'mask', false, FRAME_FIXTURE);
    const plainBoard = FRAME_FIXTURE.filter(box => !['mask', 'clipped'].includes(box.id));
    await gesture('drag bordered board with its members', 'board', true, plainBoard);
  }
  await gesture('drag 100 selected objects with fitted text', 'group55', true, GROUP_FIXTURE, true);
  if (!process.argv.includes('--group-only')) {
    await contentEdit('edit independent text', 'text', true);
    await contentEdit('change independent fill', 'bg', true);
    await contentEdit('resize independent box', 'w', true);
    await contentEdit('edit fitted text', 'text', false, FIXTURE, 'fit');
    await contentEdit('resize clip mask', 'w', false, FIXTURE, 'mask');
  }

  await browser.close();
  await close();
  if (fails) { console.log(`\n${fails} FAILURE(S) - the geometry fast-skip is NOT safe to enable`); process.exit(1); }
  console.log('\nALL PASS - guarded translations preserve DOM identity, computed styles, SVG bytes and export metadata.');
}

main().catch((e) => { console.error(e); process.exit(1); });
