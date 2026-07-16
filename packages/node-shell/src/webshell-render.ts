// SPDX-License-Identifier: MPL-2.0
/**
 * The Node shells' full-fidelity render tier (CLI + TUI): for formats the DOM-free
 * engine can't make (HTML-layout raster, jpg/webp, pdf, video), drive a REAL Lolly web
 * shell in the scoped Chromium and capture the exact bytes its own export path
 * downloads — so terminal output is byte-identical to the web/desktop app, with no
 * second render path to drift.
 *
 * It serves the built web dist (`shells/web/dist`) from an ephemeral localhost server
 * and points Chromium at `#/tool/<id>?…&format=<fmt>&export=1`. Needs a build:
 * `npm run build:web` (or set LOLLY_WEB_DIST / LOLLY_WEB_BASE). If absent, a clear
 * error explains the one build step; svg and data formats render without it.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, extname, normalize } from 'node:path';
import { getBrowser, BrowserError } from './browsers.ts';
import { repoRoot } from './repo-root.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json; charset=utf-8',
};

interface Served { base: string; close: () => Promise<void> }
let served: Promise<Served> | null = null;

/** Base origin of a Lolly web shell to drive (a running LOLLY_WEB_BASE, else served dist). */
async function webShellBase(): Promise<string> {
  const remote = process.env.LOLLY_WEB_BASE;
  if (remote) return remote.replace(/\/$/, '');
  if (!served) served = serveDist().catch(err => { served = null; throw err; });
  return (await served).base;
}

export async function closeWebShell(): Promise<void> {
  const s = served;
  served = null;
  if (s) { try { await (await s).close(); } catch { /* ignore */ } }
}

/** Serve the built web dist over localhost, SPA-style (unknown paths → index.html). */
function serveDist(): Promise<Served> {
  const dist = process.env.LOLLY_WEB_DIST || join(repoRoot(), 'shells', 'web', 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    throw new BrowserError(
      `No built web shell at ${dist}. Run \`npm run build:web\` (or set LOLLY_WEB_DIST to a ` +
      `prebuilt shell / LOLLY_WEB_BASE to a running one). Raster/PDF/video export needs it; ` +
      `svg and data formats render without it.`,
    );
  }
  const root = resolve(dist);
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]!);
      let filePath = resolve(root, '.' + normalize(urlPath));
      if (!filePath.startsWith(root)) { res.writeHead(403).end(); return; }
      if (urlPath === '/' || !existsSync(filePath) || !(await stat(filePath)).isFile()) {
        filePath = join(root, 'index.html');
      }
      const data = await readFile(filePath);
      res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise<Served>((ok) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      ok({ base: `http://127.0.0.1:${port}`, close: () => new Promise<void>(done => server.close(() => done())) });
    });
  });
}

// Reserved params we set ourselves on the export URL — cleared from the inbound query
// first so the export dims/format/password win over anything the saved session encoded.
const EXPORT_URL_RESERVED = ['format', 'export', 'copy', 'width', 'w', 'height', 'h', 'unit', 'dpi', 'password', 'bleed', 'marks', 'imprint', 'profile', 'c2pa', 'preview', 'options'];

function exportUrl(base: string, toolId: string, query: string, fmt: string, dims: RenderDims): string {
  const p = new URLSearchParams(query);
  for (const k of EXPORT_URL_RESERVED) p.delete(k);
  p.set('format', fmt);
  const unit = dims.unit || 'px';
  if (dims.width && dims.width > 0) p.set('width', String(dims.width));
  if (dims.height && dims.height > 0) p.set('height', String(dims.height));
  if (unit !== 'px') { p.set('unit', unit); p.set('dpi', String(dims.dpi || 300)); }
  if (dims.password) p.set('password', dims.password);   // standard PDF open-password
  // Print prep + provenance controls the web auto-export already honours (tool.ts reads
  // ?bleed/?marks/?imprint/?profile/?c2pa via parseUrlState). Threading them here is the
  // whole of the P3 fix: the geometry/watermark/press-intent lives in the web shell; the
  // Node shells were simply never carrying the values into the URL that drives it.
  if (dims.bleed) p.set('bleed', dims.bleed);                    // e.g. "3mm"
  if (dims.marks) p.set('marks', dims.marks);                    // CSV: crop,reg,bleed,bars,prov
  if (dims.imprint) p.set('imprint', '1');                       // durable pixel watermark
  if (dims.pressProfile) p.set('profile', dims.pressProfile);    // URL 'profile' = CMYK press condition
  // Content Credentials: forward the setting so the web shell is the single c2pa authority
  // for the browser tier (the Node post-stamp is skipped when this path ran — see run.ts /
  // engine-render.ts — which avoids the pre-existing double-stamp).
  if (dims.c2pa === false) p.set('c2pa', 'off');
  else if (dims.c2pa) p.set('c2pa', [7, 30, 90, 365].includes(Number(dims.c2paDays)) ? String(dims.c2paDays) : '1');
  p.set('export', '1'); // presence flag → the web shell auto-exports on load
  return `${base}/#/tool/${encodeURIComponent(toolId)}?${p.toString()}`;
}

/** How long to wait for the download — video records in real time. */
function timeoutFor(fmt: string): number {
  const f = fmt.toLowerCase();
  if (['webm', 'mp4', 'gif', 'apng'].includes(f)) return 180_000;
  if (['pdf', 'pdf-cmyk', 'cmyk-tiff', 'tiff'].includes(f)) return 90_000;
  return 60_000;
}

export interface RenderDims {
  width?: number; height?: number; unit?: string; dpi?: number;
  /** Standard PDF open-password (basic RC4 lock). */
  password?: string;
  /** Bleed amount as a dimension string (e.g. "3mm") for the print formats. */
  bleed?: string;
  /** Print marks CSV (crop,reg,bleed,bars,prov) for the print formats. */
  marks?: string;
  /** Embed the durable Lolly pixel watermark on raster exports. */
  imprint?: boolean;
  /** CMYK press condition (e.g. "fogra39") for pdf-cmyk / cmyk-tiff. Named distinctly
   *  from the CLI's --profile (the user-profile FILE) to avoid the url-mode collision. */
  pressProfile?: string;
  /** Content Credentials: true/off/undefined. undefined ⇒ the web shell's tool default. */
  c2pa?: boolean | null;
  /** Ephemeral-certificate lifetime in days (7/30/90/365) when c2pa is on. */
  c2paDays?: number | null;
}

/**
 * Render a tool to bytes by driving the web shell in Chromium and capturing its
 * download. `query` is the tool's current URL-state (serializeUrlState).
 */
export async function renderViaWebShell(
  toolId: string, query: string, format: string, dims: RenderDims = {},
): Promise<{ bytes: Uint8Array; mime: string }> {
  const base = await webShellBase();
  const url = exportUrl(base, toolId, query, format, dims);
  const browser = await getBrowser();
  const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
  try {
    const page = await ctx.newPage();
    const downloadP = page.waitForEvent('download', { timeout: timeoutFor(format) });
    await page.goto(url, { waitUntil: 'commit', timeout: 30_000 });
    let download: Awaited<typeof downloadP>;
    try {
      download = await downloadP;
    } catch {
      throw new BrowserError(
        `The web shell produced no "${format}" file for "${toolId}" in time — the tool may have ` +
        `failed to render or doesn't support that format. Try a different format or check the inputs.`,
      );
    }
    const path = await download.path();
    if (!path) throw new BrowserError(`Download for "${toolId}" yielded no file.`);
    const bytes = new Uint8Array(await readFile(path));
    await download.delete().catch(() => {});
    return { bytes, mime: MIME['.' + format.toLowerCase()] ?? 'application/octet-stream' };
  } finally {
    await ctx.close();
  }
}
