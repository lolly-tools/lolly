#!/usr/bin/env node
/**
 * Tool preview generator.
 *
 * Run as: npm run previews   (or: node scripts/build-previews.js [options])
 *
 * Renders every tool with its defaults in a REAL browser and writes a BUILD preview
 * image per tool into the git-ignored catalog/previews/ dir:
 *   • catalog/previews/<id>.svg   for tools that export vector (svg in render.formats)
 *   • catalog/previews/<id>.png   for raster / HTML-layout tools
 * so the gallery shows a full, pretty masonry — no saved sessions required. These are
 * generated artifacts, NOT committed; the gallery falls back to a plain "open to start"
 * tile when one is absent (dev, or before this has run). A tool can ship a committed
 * AUTHORED override instead — tools/<id>/card.svg or card.png — which wins over the
 * generated preview (and is skipped here). Run before serving/deploying.
 *
 * Why a browser (not the node CLI): the lean CLI has no layout engine, so it
 * can't render the HTML-layout tools or rasterise. Full coverage of every tool
 * needs a real engine — so we build the web shell and drive Playwright/chromium
 * through the SAME path the Save button uses: captureThumbnail() in tool.js,
 * which already picks "svg if the format is vector, png otherwise" (exactly this
 * script's spec) and inlines/outlines so the SVG is self-contained. We then read
 * the captured thumbnail straight back out of IndexedDB. Reusing the app's own
 * capture keeps a preview byte-identical to a real saved session's thumbnail —
 * no second rendering path to drift.
 *
 * The catalog index does NOT need regenerating afterward: entryFromManifest derives
 * each tool's preview path deterministically (card override → else /catalog/previews/
 * <id>.<ext>), so the path is stable whether or not the image has been generated yet.
 * Generated previews are also copied into shells/web/dist/catalog/previews/ so a build
 * served straight from dist already carries them.
 *
 * Options:
 *   --url=http://host:port   render against an already-running server (skips the
 *                            build + static server; e.g. point at `npm run dev:web`)
 *   --only=id1,id2           limit to these tool ids (comma-separated)
 *   --no-build               reuse the existing shells/web/dist (skip vite build)
 *   --skip-existing          only generate previews that are missing (a tool with an
 *                            existing catalog/previews/<id>.* or a committed card is
 *                            skipped). Makes repeat runs cheap — used by `npm run dev:web`.
 *   --headed                 show the browser (default: headless)
 */

import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, unlink, mkdir, stat } from 'node:fs/promises';
import { existsSync, cpSync } from 'node:fs';
import { join, dirname, resolve, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BrowserContext, Page } from 'playwright';
import type { CatalogIndexEntry } from './build-catalog-index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'shells', 'web', 'dist');
// Generated previews land here (git-ignored). Served by the shell's /catalog static
// handler in dev + prod, exactly like the committed catalog assets/index.
const PREVIEWS_DIR = join(ROOT, 'catalog', 'previews');
// Sidebar tools render into #tool-canvas; full-bleed/display tools into #tool-content.
const CANVAS_SEL = '#tool-canvas, #tool-content';

interface PreviewOpts {
  url: string | null;
  only: string[];
  noBuild: boolean;
  headed: boolean;
  skipExisting: boolean;
}

const opts = parseOpts(process.argv.slice(2));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`\n✗ ${message}`);
  if (process.env.DEBUG && e instanceof Error) console.error(e.stack);
  process.exit(1);
});

async function main(): Promise<void> {
  const tools = await toolList();
  if (!tools.length) {
    // With --skip-existing an empty list just means everything is already covered
    // (every dev:web start hits this once the previews exist) — not an error.
    if (opts.skipExisting) {
      console.log('All tools already have a preview or card — nothing to generate.');
      return;
    }
    throw new Error('No exportable tools found in catalog/tools/index.json.');
  }
  console.log(`Generating previews for ${tools.length} tool${tools.length === 1 ? '' : 's'}…`);

  const { chromium } = await loadPlaywright();

  // Either render against a supplied server, or build the shell + serve dist.
  let baseUrl = opts.url;
  let server: PreviewServer | null = null;
  if (!baseUrl) {
    if (!opts.noBuild) await buildWebShell();
    if (!existsSync(join(DIST, 'index.html'))) {
      throw new Error(`No build at ${DIST}. Run without --no-build, or pass --url=<running server>.`);
    }
    server = await serveDist();
    baseUrl = `http://127.0.0.1:${server.port}`;
    console.log(`Serving ${rel(DIST)} at ${baseUrl}`);
  } else {
    console.log(`Rendering against ${baseUrl}`);
    // A supplied server (e.g. the dev server launched alongside us by dev:web)
    // may still be starting — wait for it to answer before driving the browser.
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({ headless: !opts.headed });
  // serviceWorkers:'block' so the PWA's SW can't serve a stale catalog mid-run.
  const context = await browser.newContext({ serviceWorkers: 'block', deviceScaleFactor: 2 });

  const results: CaptureResult[] = [];
  try {
    for (const tool of tools) {
      // A committed authored override (tools/<id>/card.svg|png) wins over a generated
      // preview (see entryFromManifest), so there's nothing to render here — skip it.
      if (tool.hasCard) {
        results.push({ ok: false, reason: 'card override' });
        console.log(`  · ${tool.id.padEnd(20)} skipped (card override)`);
        continue;
      }
      const r = await captureTool(context, baseUrl, tool);
      results.push(r);
      const mark = r.ok ? '✓' : '·';
      console.log(`  ${mark} ${tool.id.padEnd(20)} ${r.ok ? `→ ${rel(r.file)}` : `skipped (${r.reason})`}`);
    }
  } finally {
    await context.close();
    await browser.close();
    if (server) await server.close();
  }

  const wrote = results.filter((r): r is { ok: true; file: string } => r.ok);
  console.log(`\nWrote ${wrote.length} preview${wrote.length === 1 ? '' : 's'} to ${rel(PREVIEWS_DIR)}.`);

  // Mirror the generated previews into the built dist: the vite build copied catalog/
  // into dist BEFORE these existed, so a deploy served straight from shells/web/dist
  // would otherwise miss them. The catalog index path is deterministic, so no index
  // regeneration is needed (unlike the old committed-preview flow).
  if (wrote.length && existsSync(join(DIST, 'index.html'))) {
    const distPreviews = join(DIST, 'catalog', 'previews');
    await mkdir(distPreviews, { recursive: true });
    cpSync(PREVIEWS_DIR, distPreviews, { recursive: true });
    console.log(`Copied previews into ${rel(distPreviews)}.`);
  }
  console.log('\nDone.');
}

// ── Capture one tool ────────────────────────────────────────────────────────

type CaptureResult = { ok: true; file: string } | { ok: false; reason: string };

async function captureTool(context: BrowserContext, baseUrl: string, tool: PreviewToolEntry): Promise<CaptureResult> {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/#/tool/${tool.id}`, { waitUntil: 'load', timeout: 30000 });

    // Wait for the tool canvas to mount and actually render something. Hooks
    // (onInit) and fonts resolve async, so wait for content then let it settle.
    // Sidebar tools render into #tool-canvas; full-bleed/display tools (hideSidebar)
    // render into #tool-content — match either.
    await page.waitForSelector(CANVAS_SEL, { timeout: 20000 });
    await page.waitForFunction(
      () => {
        const c = document.querySelector('#tool-canvas') || document.querySelector('#tool-content');
        return !!c && (c.children.length > 0 || (c.textContent ?? '').trim().length > 0);
      },
      { timeout: 20000 },
    );
    await page.waitForTimeout(900);

    // Preferred path — exportable tools reuse the app's own Save → captureThumbnail
    // logic (svg if the format is vector, png otherwise) and we read the captured
    // thumbnail straight back out of IndexedDB, byte-identical to a real session's.
    const hasSave = await page.evaluate(() => !!document.querySelector('[data-action="save"]'));
    if (hasSave) {
      // Prefer a vector preview: if the format selector offers svg, choose it so
      // captureThumbnail takes its SVG branch ("svg if possible").
      if (tool.formats.includes('svg')) {
        await page.evaluate(() => {
          const sel = document.querySelector('[data-action="format"]');
          if (sel instanceof HTMLSelectElement && [...sel.options].some((o) => o.value === 'svg')) {
            sel.value = 'svg';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        await page.waitForTimeout(250);
      }

      // Fire the handler in-page rather than a Playwright click: the Save control
      // can live inside a closed export popover — present in the DOM but not
      // "visible", which fails Playwright's actionability check. el.click() runs
      // the handler regardless.
      await page.evaluate(() => (document.querySelector('[data-action="save"]') as HTMLElement | null)?.click());

      // performSave() captures the thumbnail, awaits host.state.save(), then sets
      // the button label to "Saved" — so once we see "Saved", the thumb is in the DB.
      await page.waitForFunction(
        () => {
          const b = document.querySelector('[data-action="save"]');
          if (!b) return false;
          const t = (b.querySelector('[data-save-label]')?.textContent || b.textContent || '').trim();
          return t === 'Saved';
        },
        { timeout: 25000 },
      );

      const thumb = await readThumb(page, tool.id);
      const decoded = thumb ? decodeThumb(thumb) : { ext: null, bytes: null };
      if (decoded.bytes) return done(page, { ok: true, file: await writePreview(tool.id, decoded.ext, decoded.bytes) });
      // Fall through to the screenshot fallback if the thumbnail was missing or
      // in a format we don't persist (e.g. jpeg/webp default).
    }

    // Fallback — display/utility tools with no Save action (or a failed capture):
    // a raster screenshot of the rendered canvas. Gives every visual tool a
    // preview; file-transform utilities just show their drop-zone UI.
    // Hide app chrome first: an element screenshot includes anything painted over
    // the element's box (the fixed "Tools" back link, the render FAB, the
    // on-device badge), so the preview shows the tool — not the app shell.
    await page.addStyleTag({
      content:
        '.tools-home,.render-fab,.fullscreen-toggle,.fullscreen-toggle-float,.on-device-badge,.export-overlay{display:none !important}',
    });
    const canvas = await page.$(CANVAS_SEL);
    if (!canvas) return done(page, { ok: false, reason: 'no canvas to screenshot' });
    const png = await canvas.screenshot({ type: 'png' });
    return done(page, { ok: true, file: await writePreview(tool.id, 'png', png) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return done(page, { ok: false, reason: message.split('\n')[0] ?? message });
  }
}

// Write catalog/previews/<id>.<ext> and remove a stale preview in the other format
// so a tool never has both (e.g. after a tool gains an svg format). Returns the path.
async function writePreview(toolId: string, ext: string, bytes: Buffer | Uint8Array): Promise<string> {
  const file = join(PREVIEWS_DIR, `${toolId}.${ext}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  const otherFile = join(PREVIEWS_DIR, `${toolId}.${ext === 'svg' ? 'png' : 'svg'}`);
  if (existsSync(otherFile)) await unlink(otherFile);
  return file;
}

function done(page: Page, result: CaptureResult): CaptureResult {
  // Fire-and-forget close; we already have what we need.
  page.close().catch(() => {});
  return result;
}

// Read the most-recent captured thumbnail for a tool straight out of IndexedDB
// (db 'lolly', store 'state' — see shells/web/src/bridge/db.js + state.js).
function readThumb(page: Page, toolId: string): Promise<string | null> {
  return page.evaluate(
    (id: string) =>
      new Promise<string | null>((resolve) => {
        let req: IDBOpenDBRequest;
        try {
          req = indexedDB.open('lolly');
        } catch {
          resolve(null);
          return;
        }
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          let tx;
          try {
            tx = db.transaction('state', 'readonly');
          } catch {
            resolve(null);
            return;
          }
          const all = tx.objectStore('state').getAll();
          all.onerror = () => resolve(null);
          all.onsuccess = () => {
            const recs = (all.result as { toolId?: string; thumb?: string; updatedAt: string }[])
              .filter((r) => r && r.toolId === id && r.thumb)
              .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
            resolve(recs[0]?.thumb ?? null);
          };
        };
      }),
    toolId,
  );
}

interface DecodedThumb {
  ext: string;
  bytes: Buffer;
}

// captureThumbnail emits an SVG as `data:image/svg+xml,<uri-encoded>` and a
// raster as `data:image/png;base64,<...>` (FileReader). Handle both, plus a
// base64-encoded SVG variant for safety.
function decodeThumb(dataUrl: string): DecodedThumb | { ext: null; bytes: null } {
  let m = /^data:image\/svg\+xml;base64,(.*)$/s.exec(dataUrl);
  if (m?.[1] !== undefined) return { ext: 'svg', bytes: Buffer.from(m[1], 'base64') };
  m = /^data:image\/svg\+xml,(.*)$/s.exec(dataUrl);
  if (m?.[1] !== undefined) return { ext: 'svg', bytes: Buffer.from(decodeURIComponent(m[1]), 'utf8') };
  m = /^data:image\/png;base64,(.*)$/s.exec(dataUrl);
  if (m?.[1] !== undefined) return { ext: 'png', bytes: Buffer.from(m[1], 'base64') };
  // Any other raster (jpeg/webp) → store as .png-named bytes would be wrong; bail.
  return { ext: null, bytes: null };
}

// ── Tool list ───────────────────────────────────────────────────────────────

interface PreviewToolEntry {
  id: string;
  formats: string[];
  capabilities: string[];
  hasCard: boolean;
  hasPreview: boolean;
}

async function toolList(): Promise<PreviewToolEntry[]> {
  const parsed: unknown = JSON.parse(await readFile(join(ROOT, 'catalog', 'tools', 'index.json'), 'utf8'));
  // JSON trust boundary: catalog/tools/index.json is generated by
  // build-catalog-index.ts and validated by validate-catalog.ts.
  const index = parsed as { tools: CatalogIndexEntry[] };
  let tools: PreviewToolEntry[] = index.tools.map((t) => ({
    id: t.id,
    formats: Array.isArray(t.formats) ? t.formats : [],
    capabilities: Array.isArray(t.capabilities) ? t.capabilities : [],
    // A committed override (tools/<id>/card.svg|png) short-circuits generation.
    hasCard: existsSync(join(ROOT, 'tools', t.id, 'card.svg')) || existsSync(join(ROOT, 'tools', t.id, 'card.png')),
    // A previously generated preview (catalog/previews/<id>.svg|png).
    hasPreview: existsSync(join(PREVIEWS_DIR, `${t.id}.svg`)) || existsSync(join(PREVIEWS_DIR, `${t.id}.png`)),
  }));
  if (opts.only.length) {
    const want = new Set(opts.only);
    tools = tools.filter((t) => want.has(t.id));
  }
  // Capture-gated tools (e.g. url-shot) rasterise a live URL via the `capture`
  // bridge, which isn't available in this headless render path — they can never
  // produce a static preview, so skip them up front instead of eating a guaranteed
  // ~20s waitForSelector timeout per run.
  const gated = tools.filter((t) => t.capabilities.includes('capture'));
  if (gated.length) console.log(`Skipping ${gated.map((t) => t.id).join(', ')} (capture-gated — no static preview).`);
  tools = tools.filter((t) => !t.capabilities.includes('capture'));
  // --skip-existing: only fill in the gaps. A tool that already has a generated
  // preview (or a committed card) needs no work — drop it so repeat runs, e.g. on
  // every `npm run dev:web`, are near-instant instead of re-rendering everything.
  if (opts.skipExisting) tools = tools.filter((t) => !t.hasPreview && !t.hasCard);
  return tools;
}

// Poll an already-running server (the --url target) until it answers. dev:web
// launches this alongside the dev server, so the server may not be up yet.
async function waitForServer(baseUrl: string, { tries = 60, delayMs = 1000 }: { tries?: number; delayMs?: number } = {}): Promise<void> {
  const { get } = await import('node:http');
  for (let i = 0; i < tries; i++) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = get(baseUrl, (res) => {
        res.resume();
        resolve((res.statusCode ?? 500) < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Server at ${baseUrl} did not become reachable.`);
}

// ── Build + serve ─────────────────────────────────────────────────────────────

async function buildWebShell(): Promise<void> {
  console.log('Building the web shell (vite build)…');
  // Build only the web workspace — skips the /info docs build, which the tool
  // render path doesn't need. vite's closeBundle copies catalog/ + tools/ into
  // dist, so the served build is self-contained.
  await run('npm', ['--workspace', 'shells/web', 'run', 'build'], { cwd: ROOT });
}

interface PreviewServer {
  port: number;
  close(): Promise<void>;
}

async function serveDist(): Promise<PreviewServer> {
  const server = createServer((req, res) => {
    (async () => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0] ?? '/');
        let filePath = resolve(DIST, '.' + normalize(urlPath));
        // Contain within dist (no traversal); hash routing means '/' → index.html.
        if (!filePath.startsWith(DIST)) {
          res.writeHead(403).end();
          return;
        }
        if (urlPath === '/' || !existsSync(filePath) || !(await stat(filePath)).isFile()) {
          filePath = join(DIST, 'index.html');
        }
        const data = await readFile(filePath);
        res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.end(data);
      } catch {
        res.writeHead(404).end();
      }
    })();
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('internal: preview server has no TCP address');
  return {
    port: address.port,
    close: () => new Promise<void>((ok) => server.close(() => ok())),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function loadPlaywright(): Promise<typeof import('playwright')> {
  try {
    return await import('playwright');
  } catch {
    throw new Error(
      'playwright is not installed. Run `npm install` (it is a devDependency), then ' +
        '`npx playwright install chromium` to fetch the browser.',
    );
  }
}

function parseOpts(argv: string[]): PreviewOpts {
  const o: PreviewOpts = { url: null, only: [], noBuild: false, headed: false, skipExisting: false };
  for (const a of argv) {
    if (a === '--no-build') o.noBuild = true;
    else if (a === '--headed') o.headed = true;
    else if (a === '--skip-existing') o.skipExisting = true;
    else if (a.startsWith('--url=')) o.url = a.slice(6).replace(/\/$/, '');
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return o;
}

function run(cmd: string, args: string[], cliOpts: Partial<SpawnOptionsWithoutStdio>): Promise<void> {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...cliOpts });
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} ${args.join(' ')} exited ${code}`))));
  });
}

const rel = (p: string): string => p.replace(ROOT + '/', '');
