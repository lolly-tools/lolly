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
 * The fast-skip is opt-in via `?canvasfastpath=1`; this harness always sets it. ANY new tool
 * (or a default-enable) MUST pass this gate first. Usage:
 *   npm run build:web && node scripts/verify-canvas-fastpath.ts
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { AddressInfo } from 'node:net';
import { chromium, type Page } from 'playwright-core';

const DIST = join(process.cwd(), 'shells/web/dist');
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.png': 'image/png' };

function serveDist(): Promise<{ base: string; close: () => Promise<void> }> {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('shells/web/dist not built — run `npm run build:web` first');
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

let fails = 0;

async function main(): Promise<void> {
  const { base, close } = await serveDist();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  const url = (boxes: unknown) => `${base}/?canvasfastpath=1#/tool/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}`;
  const styles = (pg: Page) => pg.evaluate(() => {
    const o: Record<string, string> = {};
    for (const el of document.querySelectorAll('.lolly-box[data-box-id]')) {
      const c = getComputedStyle(el);
      o[el.getAttribute('data-box-id')!] = [c.left, c.top, c.width, c.height, c.transform, c.fontSize].join('|');
    }
    return o;
  });
  const counters = (pg: Page) => pg.evaluate(() => ({ ...((window as unknown as { __lollyGeomFastPath?: { skips: number; fulls: number } }).__lollyGeomFastPath ?? { skips: 0, fulls: 0 }) }));
  async function boot(boxes: unknown): Promise<Page> {
    const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await p.goto(url(boxes), { waitUntil: 'load' });
    await p.waitForSelector('.lolly-box[data-box-id="plain"]', { timeout: 20000 });
    await p.waitForTimeout(700); // let the first full paint + fit <script> settle
    return p;
  }
  async function dragBody(p: Page, id: string, dx: number, dy: number): Promise<void> {
    const r = await p.evaluate((bid) => { const b = document.querySelector(`.lolly-box[data-box-id="${bid}"]`)!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);
    await p.mouse.move(r.x, r.y); await p.mouse.down();
    await p.mouse.move(r.x + dx, r.y + dy, { steps: 10 }); await p.mouse.up();
    await p.waitForTimeout(350);
  }

  async function gesture(label: string, id: string, wantSkip: boolean): Promise<void> {
    const p = await boot(FIXTURE);
    const c0 = await counters(p);
    await dragBody(p, id, 60, 40);
    const c1 = await counters(p);
    const gateOk = wantSkip ? c1.skips > c0.skips : (c1.fulls > c0.fulls && c1.skips === c0.skips);
    const live = await styles(p);
    const href = await p.evaluate(() => location.href);
    await p.close();

    // full-paint control: a fresh load of the resulting doc always full-paints first
    const p2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await p2.goto(href, { waitUntil: 'load' });
    await p2.waitForSelector('.lolly-box[data-box-id="plain"]', { timeout: 20000 });
    await p2.waitForTimeout(700);
    const full = await styles(p2);
    await p2.close();

    let parity = true;
    for (const k of new Set([...Object.keys(live), ...Object.keys(full)])) {
      if (live[k] !== full[k]) { parity = false; console.log(`   DIFF ${k}\n     live: ${live[k]}\n     full: ${full[k]}`); }
    }
    const ok = gateOk && parity;
    if (!ok) fails++;
    console.log(`[${label}] ${wantSkip ? 'SKIP' : 'REFUSE'}: ${gateOk ? 'ok' : 'FAIL'} (skips ${c0.skips}->${c1.skips}, fulls ${c0.fulls}->${c1.fulls}) | computed-style parity: ${parity ? 'ok' : 'FAIL'}`);
  }

  await gesture('drag plain', 'plain', true);
  await gesture('drag fitText (--fit must survive)', 'fit', true);
  await gesture('drag clip mask (cross-box → refuse)', 'mask', false);

  await browser.close();
  await close();
  if (fails) { console.log(`\n${fails} FAILURE(S) — the geometry fast-skip is NOT safe to enable`); process.exit(1); }
  console.log('\nALL PASS — geometry fast-skip engages/refuses correctly and is byte-identical (computed style) to a full paint.');
}

main().catch((e) => { console.error(e); process.exit(1); });
