#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Tool-export A/B for `ExportOpts.stackingOrder` - evidence, not a gate.
 *
 * `renderSvgFromHtml` (shells/web/src/bridge/export.ts) is the shipping
 * SVG/PDF/EMF/EPS path for every tool in every profile, so paint-order work sits
 * behind a flag that main.ts turns on only for page snapshots. Two questions
 * that a paragraph of reasoning cannot answer, and this script can:
 *
 *   1. With the flag OFF, is a tool's exported SVG byte-identical to what the
 *      pre-flag walker produced?  (`--baseline=<module.ts>`)
 *   2. With the flag ON, which tools would actually change?  That reviewed list
 * - not an assertion - is the only thing that could ever justify flipping
 *      the default.
 *
 * Build-machine only: needs Chromium and a built `shells/web/dist`.
 *
 *   npm --workspace shells/web run build
 *   node scripts/probe-tool-paint-order.ts
 *   node scripts/probe-tool-paint-order.ts --baseline=shells/web/src/bridge/old-export.ts
 *   node scripts/probe-tool-paint-order.ts --limit=8 --only=qr-code,wordmark
 *
 * The baseline module must live NEXT TO export.ts - it is bundled with esbuild
 * and its relative imports have to resolve.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import type { Browser, Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'shells', 'web', 'dist');
const BRIDGE = join(ROOT, 'shells', 'web', 'src', 'bridge');
const EXPORT_MODULE = join(BRIDGE, 'export.ts');

interface Opts { baseline: string | null; only: string[]; limit: number; out: string }
const opts: Opts = { baseline: null, only: [], limit: 0, out: join(tmpdir(), 'lolly-tool-paint-order') };
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--baseline=')) opts.baseline = resolve(ROOT, a.slice(11));
  else if (a.startsWith('--only=')) opts.only = a.slice(7).split(',').map(s => s.trim()).filter(Boolean);
  else if (a.startsWith('--limit=')) opts.limit = Number(a.slice(8)) || 0;
  else if (a.startsWith('--out=')) opts.out = a.slice(6);
  else console.warn(`⚠  ignoring ${a}`);
}
mkdirSync(opts.out, { recursive: true });

if (!existsSync(join(DIST, 'index.html'))) {
  throw new Error(`No build at shells/web/dist — run: npm --workspace shells/web run build`);
}
if (opts.baseline && dirname(opts.baseline) !== BRIDGE) {
  throw new Error(`--baseline must live in ${BRIDGE} so its relative imports resolve`);
}

/** esbuild-bundle a walker module and hang renderSvgFromHtml off `window` under `name`. */
async function bundleWalker(modulePath: string, name: string): Promise<string> {
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      contents: `import { renderSvgFromHtml } from ${JSON.stringify(modulePath)};
                 window[${JSON.stringify(name)}] = renderSvgFromHtml;`,
      resolveDir: BRIDGE,
      loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
  });
  return out.outputFiles[0]!.text;
}

/** Tool ids from the active profile's generated catalog index. */
function toolIds(): string[] {
  const idx = join(ROOT, 'catalog', 'tools', 'index.json');
  if (!existsSync(idx)) throw new Error('catalog/tools/index.json missing — run `npm run profile` first');
  const json = JSON.parse(readFileSync(idx, 'utf8')) as { tools?: { id: string }[] } | { id: string }[];
  const list = Array.isArray(json) ? json : (json.tools ?? []);
  let ids = list.map(t => t.id);
  if (opts.only.length) ids = ids.filter(id => opts.only.includes(id));
  if (opts.limit) ids = ids.slice(0, opts.limit);
  return ids;
}

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain' };
async function serveDist(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    let p = normalize(join(DIST, url));
    if (!p.startsWith(DIST)) { res.writeHead(403).end(); return; }
    if (!existsSync(p) || !extname(p)) p = join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }).end(readFileSync(p));
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  return { port: (server.address() as AddressInfo).port, close: () => new Promise<void>(r => server.close(() => r())) };
}

interface Result { id: string; canvas: boolean; offVsBaseline?: 'same' | 'DIFFERS' | 'n/a'; onVsOff?: 'same' | 'differs'; note?: string }

async function probeTool(page: Page, base: string, id: string, bundles: string[]): Promise<Result> {
  const r: Result = { id, canvas: false };
  try {
    await page.goto(`${base}/#/tool/${encodeURIComponent(id)}`, { waitUntil: 'load', timeout: 45_000 });
    // The tool canvas is what host.export.render is handed for a real export.
    await page.waitForSelector('#tool-canvas', { timeout: 25_000 });
    await page.evaluate(() => (document.fonts?.ready ?? Promise.resolve()).then(() => undefined)).catch(() => {});
    await page.waitForTimeout(2_500);
    for (const b of bundles) await page.addScriptTag({ content: b });
    r.canvas = true;

    // An SVG-ROOTED canvas never enters this walker at all (renderFormat takes
    // the renderSvg fast path), so it cannot be affected either way. Say so
    // rather than silently reporting "same".
    const svgRooted = await page.evaluate(() => {
      const n = document.getElementById('tool-canvas');
      return !!n && (n.tagName.toLowerCase() === 'svg' || (n.children.length === 1 && n.children[0]!.tagName.toLowerCase() === 'svg'));
    });
    if (svgRooted) { r.note = 'svg-rooted canvas — never enters the HTML walker'; }

    const render = async (which: 'cur' | 'base', stackingOrder: boolean) => await page.evaluate(
      async ([w, so]: [string, boolean]) => {
        const fn = (window as unknown as Record<string, ((n: Element, o: unknown) => Promise<Blob>) | undefined>)[w === 'cur' ? '__renderCur' : '__renderBase'];
        if (!fn) throw new Error(`walker bundle ${w} not loaded`);
        const blob = await fn(document.getElementById('tool-canvas')!, { convertPaths: true, stackingOrder: so || undefined });
        return await blob.text();
      }, [which, stackingOrder] as [string, boolean]);

    const off = await render('cur', false);
    if (opts.baseline) {
      const bl = await render('base', false);
      r.offVsBaseline = off === bl ? 'same' : 'DIFFERS';
      if (r.offVsBaseline === 'DIFFERS') {
        writeFileSync(join(opts.out, `${id}-off.svg`), off);
        writeFileSync(join(opts.out, `${id}-baseline.svg`), bl);
      }
    } else r.offVsBaseline = 'n/a';

    const on = await render('cur', true);
    r.onVsOff = on === off ? 'same' : 'differs';
    if (r.onVsOff === 'differs') writeFileSync(join(opts.out, `${id}-on.svg`), on);
  } catch (e) {
    r.note = (e as Error).message.slice(0, 120);
  }
  return r;
}

const ids = toolIds();
console.log(`▸ ${ids.length} tools from the active profile\n`);
const bundles = [await bundleWalker(EXPORT_MODULE, '__renderCur')];
if (opts.baseline) bundles.push(await bundleWalker(opts.baseline, '__renderBase'));

const server = await serveDist();
const base = `http://127.0.0.1:${server.port}`;
const browser: Browser = await getBrowser();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
const page = await ctx.newPage();
const results: Result[] = [];
try {
  for (const id of ids) {
    const r = await probeTool(page, base, id, bundles);
    results.push(r);
    const flag = !r.canvas ? '·' : r.offVsBaseline === 'DIFFERS' ? '✗' : r.onVsOff === 'differs' ? '≠' : '=';
    console.log(`  ${flag} ${id.padEnd(26)} off-vs-baseline=${r.offVsBaseline ?? '—'}  on-vs-off=${r.onVsOff ?? '—'}${r.note ? `   (${r.note})` : ''}`);
  }
} finally {
  await ctx.close();
  await closeBrowser();
  await server.close();
}

const rendered = results.filter(r => r.canvas);
const broke = rendered.filter(r => r.offVsBaseline === 'DIFFERS');
const moved = rendered.filter(r => r.onVsOff === 'differs');
console.log(`\n  rendered            ${rendered.length}/${results.length}`);
if (opts.baseline) console.log(`  flag OFF ≠ baseline ${broke.length}${broke.length ? '  ← REGRESSION: ' + broke.map(r => r.id).join(', ') : '  (byte-identical everywhere)'}`);
console.log(`  flag ON  ≠ flag OFF ${moved.length}${moved.length ? '  → ' + moved.map(r => r.id).join(', ') : ''}`);
console.log(`\n  artifacts: ${opts.out}`);
if (broke.length) process.exitCode = 1;
