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
 *   --headed                 show the browser (default: headless)
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, unlink, mkdir, stat } from 'node:fs/promises';
import { existsSync, cpSync } from 'node:fs';
import { join, dirname, resolve, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'shells', 'web', 'dist');
// Generated previews land here (git-ignored). Served by the shell's /catalog static
// handler in dev + prod, exactly like the committed catalog assets/index.
const PREVIEWS_DIR = join(ROOT, 'catalog', 'previews');
// Sidebar tools render into #tool-canvas; full-bleed/display tools into #tool-content.
const CANVAS_SEL = '#tool-canvas, #tool-content';

const opts = parseOpts(process.argv.slice(2));

const MIME = {
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

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});

async function main() {
  const tools = await toolList();
  if (!tools.length) throw new Error('No exportable tools found in catalog/tools/index.json.');
  console.log(`Generating previews for ${tools.length} tool${tools.length === 1 ? '' : 's'}…`);

  const { chromium } = await loadPlaywright();

  // Either render against a supplied server, or build the shell + serve dist.
  let baseUrl = opts.url;
  let server = null;
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
  }

  const browser = await chromium.launch({ headless: !opts.headed });
  // serviceWorkers:'block' so the PWA's SW can't serve a stale catalog mid-run.
  const context = await browser.newContext({ serviceWorkers: 'block', deviceScaleFactor: 2 });

  const results = [];
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

  const wrote = results.filter((r) => r.ok);
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

async function captureTool(context, baseUrl, tool) {
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
        return !!c && (c.children.length > 0 || c.textContent.trim().length > 0);
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
          if (sel && [...sel.options].some((o) => o.value === 'svg')) {
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
      await page.evaluate(() => document.querySelector('[data-action="save"]').click());

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
      const { ext, bytes } = thumb ? decodeThumb(thumb) : {};
      if (bytes) return done(page, { ok: true, file: await writePreview(tool.id, ext, bytes) });
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
    return done(page, { ok: false, reason: e.message.split('\n')[0] });
  }
}

// Write catalog/previews/<id>.<ext> and remove a stale preview in the other format
// so a tool never has both (e.g. after a tool gains an svg format). Returns the path.
async function writePreview(toolId, ext, bytes) {
  const file = join(PREVIEWS_DIR, `${toolId}.${ext}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  const otherFile = join(PREVIEWS_DIR, `${toolId}.${ext === 'svg' ? 'png' : 'svg'}`);
  if (existsSync(otherFile)) await unlink(otherFile);
  return file;
}

function done(page, result) {
  // Fire-and-forget close; we already have what we need.
  page.close().catch(() => {});
  return result;
}

// Read the most-recent captured thumbnail for a tool straight out of IndexedDB
// (db 'lolly', store 'state' — see shells/web/src/bridge/db.js + state.js).
function readThumb(page, toolId) {
  return page.evaluate(
    (id) =>
      new Promise((resolve) => {
        let req;
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
            const recs = all.result
              .filter((r) => r && r.toolId === id && r.thumb)
              .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
            resolve(recs[0]?.thumb ?? null);
          };
        };
      }),
    toolId,
  );
}

// captureThumbnail emits an SVG as `data:image/svg+xml,<uri-encoded>` and a
// raster as `data:image/png;base64,<...>` (FileReader). Handle both, plus a
// base64-encoded SVG variant for safety.
function decodeThumb(dataUrl) {
  let m = /^data:image\/svg\+xml;base64,(.*)$/s.exec(dataUrl);
  if (m) return { ext: 'svg', bytes: Buffer.from(m[1], 'base64') };
  m = /^data:image\/svg\+xml,(.*)$/s.exec(dataUrl);
  if (m) return { ext: 'svg', bytes: Buffer.from(decodeURIComponent(m[1]), 'utf8') };
  m = /^data:image\/png;base64,(.*)$/s.exec(dataUrl);
  if (m) return { ext: 'png', bytes: Buffer.from(m[1], 'base64') };
  // Any other raster (jpeg/webp) → store as .png-named bytes would be wrong; bail.
  return { ext: null, bytes: null };
}

// ── Tool list ───────────────────────────────────────────────────────────────

async function toolList() {
  const index = JSON.parse(await readFile(join(ROOT, 'catalog', 'tools', 'index.json'), 'utf8'));
  let tools = index.tools.map((t) => ({
    id: t.id,
    formats: Array.isArray(t.formats) ? t.formats : [],
    // A committed override (tools/<id>/card.svg|png) short-circuits generation.
    hasCard: existsSync(join(ROOT, 'tools', t.id, 'card.svg')) || existsSync(join(ROOT, 'tools', t.id, 'card.png')),
  }));
  if (opts.only.length) {
    const want = new Set(opts.only);
    tools = tools.filter((t) => want.has(t.id));
  }
  return tools;
}

// ── Build + serve ─────────────────────────────────────────────────────────────

async function buildWebShell() {
  console.log('Building the web shell (vite build)…');
  // Build only the web workspace — skips the /info docs build, which the tool
  // render path doesn't need. vite's closeBundle copies catalog/ + tools/ into
  // dist, so the served build is self-contained.
  await run('npm', ['--workspace', 'shells/web', 'run', 'build'], { cwd: ROOT });
}

async function serveDist() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
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
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  return {
    port,
    close: () => new Promise((ok) => server.close(ok)),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    throw new Error(
      'playwright is not installed. Run `npm install` (it is a devDependency), then ' +
        '`npx playwright install chromium` to fetch the browser.',
    );
  }
}

function parseOpts(argv) {
  const o = { url: null, only: [], noBuild: false, headed: false };
  for (const a of argv) {
    if (a === '--no-build') o.noBuild = true;
    else if (a === '--headed') o.headed = true;
    else if (a.startsWith('--url=')) o.url = a.slice(6).replace(/\/$/, '');
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return o;
}

function run(cmd, args, cliOpts) {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...cliOpts });
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} ${args.join(' ')} exited ${code}`))));
  });
}

const rel = (p) => p.replace(ROOT + '/', '');
