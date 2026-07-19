#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Vector-render conformance audit — public pages as fixtures for the engine's
 * print-PDF → SVG interpreter (engine/src/pdf-map.ts + pdf-svg.ts, the path a
 * .ai/.pdf upload and the docs-screenshot vector pipeline both take).
 *
 * The insight from the suse.com pilot: a raw "screenshot vs our SVG" diff blames
 * the engine for things Chromium's PRINT pass did (dropped lazy content, print
 * stylesheets). So this is a THREE-WAY diff per fixture:
 *
 *   ref     — a screen screenshot of the live page (what a human sees)
 *   native  — the SAME print-PDF rendered by an INDEPENDENT engine (poppler
 *             `pdftoppm`, else macOS `sips`) — the ground truth of what the PDF
 *             actually contains, with zero involvement from our interpreter
 *   ours    — our engine's SVG of that PDF, rendered back to pixels
 *
 * Two scores fall out, cleanly attributed:
 *   print-loss  = ref  ↔ native   — Chromium's print pass (we mitigate, not fix)
 *   ENGINE-loss = native ↔ ours    — our interpreter's fidelity (this is the backlog)
 *
 * Mitigations applied so the engine sees a real page, not a print-stylesheet
 * skeleton: `emulateMedia('screen')` before printing (bypasses the site's print
 * CSS) and a pre-scroll pass (hydrates IntersectionObserver lazy content).
 *
 * External origins have no in-page conversion hook, so the PDF is handed to the
 * app's loopback `__lollyVectorShot` (main.ts) running on the served dist in a
 * second page. Foreign fonts/rasters can't be re-sourced there (they live on the
 * captured page), so external fixtures show fallback faces — a known limitation,
 * NOT an engine bug; the `local:` control fixture calibrates that out.
 *
 * Build-machine only (Chromium + a built dist). Outputs per-fixture artifacts to
 * --out (default a temp dir) and a tracked findings table to plans/.
 *
 *   node scripts/audit-vector-render.ts                 # all fixtures
 *   node scripts/audit-vector-render.ts --only=suse     # one
 *   node scripts/audit-vector-render.ts --no-build      # reuse shells/web/dist
 *   node scripts/audit-vector-render.ts --out=/tmp/foo  # artifact dir
 */

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { getBrowser, closeBrowser, resolveBrowsersDir } from '../packages/node-shell/src/browsers.ts';
import { windowPdfSvg } from '../engine/src/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'shells', 'web', 'dist');
const W = 1440, H = 900;
const PT_PER_PX = 0.75;          // Chromium prints CSS px at 72/96 pt
const NATIVE_DPI = 96;           // pdftoppm -r 96 → 1440px-wide native = matches ref/ours

/** Fixtures: real public pages that stress different render features, plus one
 *  local control (our own clean page) where ENGINE-loss should be near-zero — if
 *  it isn't, the harness itself is miscalibrated. */
interface Fixture { slug: string; url: string; note: string; local?: boolean }
const FIXTURES: Fixture[] = [
  { slug: 'local-qr',  url: '/#/tool/qr-code?url=https://lolly.tools', local: true, note: 'control — our own clean page' },
  { slug: 'suse',      url: 'https://www.suse.com',        note: 'marketing — hero, cards, cookie modal' },
  { slug: 'rancher',   url: 'https://apps.rancher.io',     note: 'app catalog — dense grid, icons' },
  { slug: 'opensuse',  url: 'https://www.opensuse.org',    note: 'community — mixed media, gradients' },
  { slug: 'penpot',    url: 'https://penpot.app',          note: 'partner — design tool landing, illustrations' },
];

interface Opts { only: string[]; noBuild: boolean; out: string }
function parseOpts(argv: string[]): Opts {
  const o: Opts = { only: [], noBuild: false, out: join(tmpdir(), 'lolly-vector-audit') };
  for (const a of argv) {
    if (a === '--no-build') o.noBuild = true;
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    else if (a.startsWith('--out=')) o.out = a.slice(6);
    else console.warn(`⚠  ignoring ${a}`);
  }
  return o;
}
const opts = parseOpts(process.argv.slice(2));

interface HookResult { svg: string; width: number; height: number; elementCount: number; warnings: string[] }
interface Row {
  slug: string; url: string; note: string; local: boolean;
  ok: boolean; error?: string;
  elements?: number; svgKB?: number;
  printLoss?: number;   // ref ↔ native  %
  engineLoss?: number;  // native ↔ ours %
  nativeRenderer?: string;
  warnings?: Record<string, number>;
}

main().catch((e: Error) => { console.error(`\n✗ ${e.message}`); if (process.env.DEBUG) console.error(e.stack); process.exit(1); });

async function main(): Promise<void> {
  let fixtures = FIXTURES;
  if (opts.only.length) {
    const miss = opts.only.filter(s => !FIXTURES.some(f => f.slug === s));
    if (miss.length) throw new Error(`--only names unknown fixtures: ${miss.join(', ')}`);
    fixtures = FIXTURES.filter(f => opts.only.includes(f.slug));
  }
  mkdirSync(opts.out, { recursive: true });
  const nativeRenderer = detectNativeRenderer();
  if (!nativeRenderer) console.warn('⚠  no independent PDF renderer (pdftoppm/sips) — print-loss vs ENGINE-loss cannot be separated; reporting total only.');

  await ensureBrowser();
  if (!opts.noBuild) await buildWebShell();
  if (!existsSync(join(DIST, 'index.html'))) throw new Error(`No build at ${rel(DIST)} — run without --no-build.`);

  const server = await serveDist();
  const base = `http://127.0.0.1:${server.port}`;
  const browser = await getBrowser();
  const sharp = (await import('sharp')).default;

  const rows: Row[] = [];
  try {
    for (const f of fixtures) {
      process.stdout.write(`\n▸ ${f.slug} (${f.local ? base + f.url : f.url})\n`);
      const row = await auditOne(browser, sharp, base, nativeRenderer, f);
      rows.push(row);
      process.stdout.write(rowLine(row));
    }
  } finally {
    await closeBrowser();
    await server.close();
  }

  const mdPath = writeFindings(rows, nativeRenderer);
  console.log(`\n${summaryTable(rows)}`);
  console.log(`\nArtifacts: ${rel(opts.out)}   Findings: ${rel(mdPath)}`);
}

// ── one fixture ────────────────────────────────────────────────────────────────

type Sharp = typeof import('sharp').default;

async function auditOne(browser: Browser, sharp: Sharp, base: string, nativeRenderer: NativeRenderer | null, f: Fixture): Promise<Row> {
  const row: Row = { slug: f.slug, url: f.url, note: f.note, local: !!f.local, ok: false };
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const p = (name: string) => join(opts.out, `${f.slug}-${name}`);
  try {
    // 1. Live page → screen reference + full-page print PDF (screen media).
    const target = await ctx.newPage();
    const url = f.local ? base + f.url : f.url;
    await target.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await target.emulateMedia({ media: 'screen' });                    // bypass site print CSS
    await settle(target);
    await autoScroll(target);                                          // hydrate lazy content
    await target.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}' }).catch(() => {});
    await target.screenshot({ path: p('ref.png') });
    const pageH = await target.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, window.innerHeight));
    const pdf = await target.pdf({ width: `${W}px`, height: `${Math.max(pageH, H)}px`, printBackground: true, pageRanges: '1', margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    writeFileSync(p('print.pdf'), pdf);
    await target.close();

    // 2. Our engine: PDF → SVG via the app's loopback conversion hook on the dist.
    const app = await ctx.newPage();
    await app.goto(`${base}/#/`, { waitUntil: 'load', timeout: 45_000 });
    await app.waitForFunction(() => Boolean((window as unknown as { __lollyVectorShot?: unknown }).__lollyVectorShot), { timeout: 20_000 });
    const res = await app.evaluate(
      (b64: string) => (window as unknown as { __lollyVectorShot: (b: string) => Promise<HookResult> }).__lollyVectorShot(b64),
      Buffer.from(pdf).toString('base64'),
    ) as HookResult;
    await app.close();
    row.elements = res.elementCount;
    row.warnings = tally(res.warnings);

    const ratio = res.width / W;
    const svg = windowPdfSvg(res.svg, { x: 0, y: 0, width: W * ratio, height: H * ratio, outWidth: W, outHeight: H });
    writeFileSync(p('ours.svg'), svg);
    row.svgKB = Math.round(svg.length / 1024);
    await renderSvg(ctx, svg, p('ours.png'));

    // 3. Independent native render of the SAME PDF (ground truth of its contents).
    let nativePng: string | null = null;
    if (nativeRenderer) {
      nativePng = renderNative(nativeRenderer, p('print.pdf'), p('native-full.png'), sharp, p('native.png'));
      row.nativeRenderer = nativeRenderer.name;
    }

    // 4. Diffs. print-loss = ref↔native (Chromium's print), ENGINE-loss = native↔ours.
    if (nativePng) {
      row.printLoss = await diffPct(sharp, p('ref.png'), nativePng);
      row.engineLoss = await diffPct(sharp, nativePng, p('ours.png'), p('engine-diff.png'));
    } else {
      row.engineLoss = await diffPct(sharp, p('ref.png'), p('ours.png'), p('engine-diff.png'));
    }
    row.ok = true;
  } catch (e) {
    row.error = (e as Error).message;
  } finally {
    await ctx.close();
  }
  return row;
}

/** Wait for fonts + network idle-ish before capturing. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => (document.fonts?.ready ?? Promise.resolve()).then(() => undefined)).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
}

/** Scroll the page top→bottom in viewport steps (hydrates lazy content), then back. */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.9;
    const max = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    for (let y = 0; y < max; y += step) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 300));
  }).catch(() => {});
  await page.waitForTimeout(600);
}

/** Render an SVG to PNG in the same secure-static <img> mode the docs pages use. */
async function renderSvg(ctx: BrowserContext, svg: string, out: string): Promise<void> {
  const page = await ctx.newPage();
  await page.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${W}" height="${H}"></body>`, { waitUntil: 'load' });
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
  await page.close();
}

// ── native (independent) PDF render ─────────────────────────────────────────────

interface NativeRenderer { name: string; run: (pdf: string, outPrefix: string) => string | null }

function detectNativeRenderer(): NativeRenderer | null {
  if (which('pdftoppm')) {
    return {
      name: 'poppler/pdftoppm',
      run: (pdf, outPrefix) => {
        // -r 96 → the 1080pt-wide print renders at exactly 1440px (== ref/ours).
        const r = spawnSync('pdftoppm', ['-png', '-r', String(NATIVE_DPI), '-f', '1', '-l', '1', '-singlefile', pdf, outPrefix], { stdio: 'pipe' });
        return r.status === 0 ? `${outPrefix}.png` : null;
      },
    };
  }
  if (which('sips')) {
    return {
      name: 'macOS/sips',
      run: (pdf, outPrefix) => {
        const out = `${outPrefix}.png`;
        const r = spawnSync('sips', ['-s', 'format', 'png', pdf, '--out', out], { stdio: 'pipe' });
        return r.status === 0 ? out : null;
      },
    };
  }
  return null;
}

/** Render the PDF natively, then crop+scale its TOP viewport to W×H to match ref/ours. */
function renderNative(renderer: NativeRenderer, pdf: string, fullOut: string, sharp: Sharp, out: string): string | null {
  const prefix = fullOut.replace(/\.png$/, '');
  const full = renderer.run(pdf, prefix);
  if (!full || !existsSync(full)) return null;
  // Return a promise-less path by doing the crop synchronously via a marker file:
  // sharp is async, so hand back `out` and let the caller await through cropNative.
  cropQueue.push(cropNative(sharp, full, out));
  return out;
}

// The crop is async but renderNative is called inside an async fn that awaits the
// diffs right after — collect the crop promises and settle them before diffing.
const cropQueue: Promise<void>[] = [];
async function cropNative(sharp: Sharp, full: string, out: string): Promise<void> {
  const img = sharp(full);
  const meta = await img.metadata();
  const nw = meta.width ?? W;
  const pxPerPt = nw / (W * PT_PER_PX);              // native px per PDF point
  const cropH = Math.round(H * PT_PER_PX * pxPerPt); // top viewport height in native px
  await sharp(full)
    .extract({ left: 0, top: 0, width: nw, height: Math.min(cropH, meta.height ?? cropH) })
    .resize(W, H, { fit: 'fill' })
    .png()
    .toFile(out);
}

// ── pixel diff + heatmap ────────────────────────────────────────────────────────

async function raw(sharp: Sharp, path: string): Promise<{ data: Buffer; info: { width: number; height: number } }> {
  const { data, info } = await sharp(path).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

/** Fraction of pixels differing beyond tolerance; optional red-overlay heatmap. */
async function diffPct(sharp: Sharp, aPath: string, bPath: string, heatmap?: string): Promise<number> {
  await Promise.all(cropQueue.splice(0));   // ensure any pending native crop is done
  const TOL = 16;
  const a = await raw(sharp, aPath);
  const b = await raw(sharp, bPath);
  const n = W * H;
  const heat = heatmap ? Buffer.alloc(n * 4) : null;
  let diff = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = Math.abs(a.data[o]! - b.data[o]!) > TOL || Math.abs(a.data[o + 1]! - b.data[o + 1]!) > TOL || Math.abs(a.data[o + 2]! - b.data[o + 2]!) > TOL;
    if (d) diff++;
    if (heat) {
      if (d) { heat[o] = 255; heat[o + 1] = 40; heat[o + 2] = 40; heat[o + 3] = 255; }
      else { const g = Math.round((b.data[o]! + b.data[o + 1]! + b.data[o + 2]!) / 3 * 0.35 + 160); heat[o] = heat[o + 1] = heat[o + 2] = g; heat[o + 3] = 255; }
    }
  }
  if (heat && heatmap) await sharp(heat, { raw: { width: W, height: H, channels: 4 } }).png().toFile(heatmap);
  return +(100 * diff / n).toFixed(1);
}

// ── reporting ────────────────────────────────────────────────────────────────

function tally(warnings: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of warnings) {
    // Collapse to a category by stripping specifics (numbers, quoted names).
    const key = w.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, 'N').replace(/\([^)]*\)/g, '(…)').trim();
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function rowLine(r: Row): string {
  if (!r.ok) return `  ✗ ${r.error}\n`;
  const pl = r.printLoss === undefined ? '—' : `${r.printLoss}%`;
  const el = r.engineLoss === undefined ? '—' : `${r.engineLoss}%`;
  const wn = r.warnings ? Object.values(r.warnings).reduce((a, b) => a + b, 0) : 0;
  return `  ✓ ${r.elements} elems · ${r.svgKB}KB · print-loss ${pl} · ENGINE-loss ${el} · ${wn} warns\n`;
}

function summaryTable(rows: Row[]): string {
  const head = '  fixture      elems   svgKB   print-loss   ENGINE-loss   warns';
  const lines = rows.map(r => {
    if (!r.ok) return `  ${r.slug.padEnd(12)} FAILED — ${r.error}`;
    const wn = r.warnings ? Object.values(r.warnings).reduce((a, b) => a + b, 0) : 0;
    return `  ${r.slug.padEnd(12)} ${String(r.elements).padStart(5)}   ${String(r.svgKB).padStart(5)}   ${(r.printLoss ?? '—').toString().padStart(7)}%    ${(r.engineLoss ?? '—').toString().padStart(8)}%   ${String(wn).padStart(5)}`;
  });
  return [head, ...lines].join('\n');
}

function writeFindings(rows: Row[], native: NativeRenderer | null): string {
  const date = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, 'plans', `vector-render-audit-${date}.md`);
  const warnUnion = new Map<string, number>();
  for (const r of rows) for (const [k, v] of Object.entries(r.warnings ?? {})) warnUnion.set(k, (warnUnion.get(k) ?? 0) + v);

  const md = `# Vector-render conformance audit — ${date}

Engine path under test: print-PDF → \`interpretPdfPage\` (engine/src/pdf-map.ts) → \`pdfNodesToSvg\` (engine/src/pdf-svg.ts). Method: three-way diff per fixture (screen ref ↔ independent native render ↔ our SVG). Native renderer: ${native?.name ?? 'NONE (print-loss/engine-loss not separable)'}. Mitigations: \`emulateMedia('screen')\` + pre-scroll.

- **print-loss** (ref ↔ native): Chromium's print pass vs the live page — NOT an engine bug; mitigate upstream.
- **ENGINE-loss** (native ↔ ours): our interpreter's fidelity against ground truth — **this is the backlog.**

| fixture | note | elems | svg KB | print-loss | ENGINE-loss |
|---|---|--:|--:|--:|--:|
${rows.map(r => r.ok
    ? `| \`${r.slug}\` | ${r.note} | ${r.elements} | ${r.svgKB} | ${r.printLoss ?? '—'}% | **${r.engineLoss ?? '—'}%** |`
    : `| \`${r.slug}\` | ${r.note} | — | — | — | FAILED: ${r.error} |`).join('\n')}

Artifacts per fixture in the audit output dir: \`<slug>-ref.png\`, \`<slug>-native.png\`, \`<slug>-ours.png\`, \`<slug>-ours.svg\`, \`<slug>-engine-diff.png\` (red = differs from native).

## Calibration

The \`local-qr\` control is our own clean page: its ENGINE-loss is the harness noise floor (font/AA differences between the native renderer and the SVG rasteriser). Read every external fixture's ENGINE-loss **relative to that floor** — external pages also carry an unavoidable font-fallback penalty (foreign \`@font-face\` can't be re-sourced on the dist), so their absolute number overstates true engine error.

## Interpreter warnings (union across fixtures)

${warnUnion.size ? [...warnUnion.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `- **${v}×** ${k}`).join('\n') : '_none_'}

## Engine backlog — to triage from the \`-engine-diff.png\` heatmaps

_Fill in per divergence class after eyeballing the heatmaps. Each fix should cite the fixture(s) whose ENGINE-loss it reduces so re-running this audit checks it off._

- [ ] …
`;
  writeFileSync(path, md);
  return path;
}

// ── infra ────────────────────────────────────────────────────────────────────

function which(cmd: string): boolean { return spawnSync('which', [cmd], { stdio: 'pipe' }).status === 0; }

async function ensureBrowser(): Promise<void> {
  if (process.env.LOLLY_BROWSER_PATH || process.env.LOLLY_BROWSER_CHANNEL || process.env.PLAYWRIGHT_BROWSERS_PATH) return;
  if (existsSync(resolveBrowsersDir())) return;
  try { const { chromium } = await import('playwright'); process.env.LOLLY_BROWSER_PATH = chromium.executablePath(); } catch { /* url-capture surfaces the install hint */ }
}

async function buildWebShell(): Promise<void> {
  console.log('Building the web shell (vite build)…');
  await new Promise<void>((ok, fail) => {
    const p = spawn('npm', ['--workspace', 'shells/web', 'run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    p.on('close', c => (c === 0 ? ok() : fail(new Error(`vite build exited ${c}`))));
    p.on('error', fail);
  });
}

interface ServeHandle { port: number; close: () => Promise<void> }
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.map': 'application/json; charset=utf-8',
};
async function serveDist(): Promise<ServeHandle> {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]!);
      let filePath = resolve(DIST, '.' + normalize(urlPath));
      if (!filePath.startsWith(DIST)) { res.writeHead(403).end(); return; }
      if (urlPath === '/' || !existsSync(filePath) || !(await stat(filePath)).isFile()) filePath = join(DIST, 'index.html');
      res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(await readFile(filePath));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok as () => void));
  return { port: (server.address() as AddressInfo).port, close: () => new Promise<void>(ok => server.close(() => ok())) };
}

function rel(p: string): string { return p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p; }
