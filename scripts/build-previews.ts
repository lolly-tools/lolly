#!/usr/bin/env node
/**
 * Tool preview generator.
 *
 * Run as: npm run previews   (or: node scripts/build-previews.ts [options])
 *
 * Renders every tool with its defaults in a REAL browser and writes a BUILD preview
 * image per tool into the git-ignored catalog/previews/ dir:
 *   • catalog/previews/<id>.svg   a VECTOR SCREENSHOT of the rendered canvas — attempted
 *                                 for EVERY tool, not just SVG exporters, since a tile is
 *                                 just a screenshot and vector stays crisp at any size
 *                                 (the __lollyForceVectorThumb flag decouples this from
 *                                 render.formats — see captureThumbnail in tool.ts)
 *   • catalog/previews/<id>.png   fallback: a dense/expensive vector (rasterised below to
 *                                 keep the tile cheap to paint) or a tool whose canvas the
 *                                 walker can't vectorise (→ pixel-faithful raster screenshot)
 * SVG previews are then shrunk in place (format-preserving — the catalog index derives
 * the .svg extension deterministically, so the file must stay SVG): never-painted
 * comments are dropped (a tool's template.html comments ride into the serialised SVG —
 * e.g. filter-duotone's ~674 KB commented-out fallback image) and any full-resolution
 * embedded rasters are downscaled to thumbnail size (diagram-builder's six headshots
 * were the bulk of its 900 KB). See scripts/optimize-preview-svg.ts. A tool whose SVG
 * is dense SYNTHETIC vector with no rasters (a halftone's ~10 k circles, a scanline's
 * one giant integer-coordinate path) can't shrink this way — it wants a committed
 * tools/<id>/card.png override, which the index honours and this script skips.
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

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, unlink, mkdir, stat } from 'node:fs/promises';
import { existsSync, cpSync } from 'node:fs';
import { join, dirname, resolve, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserContext, Page } from 'playwright';
import type { AddressInfo } from 'node:net';
import type { SpawnOptions } from 'node:child_process';
import {
  stripSvgComments, listEmbeddedRasters, substituteDataUris, svgoThumb, isExpensiveThumbSvg,
  MAX_RASTER_DIM, RASTER_JPEG_QUALITY,
} from './optimize-preview-svg.ts';
// Engine-owned URL encoding — the SAME buildInputModel → serializeUrlState the app's
// seed-url.ts uses, so a look's pre-render URL seeds the identical inputs the live
// carousel would render from (shells/web/src/lib/seed-url.ts).
import { buildInputModel, serializeUrlState } from '../engine/src/index.ts';
import type { InputValue } from '../engine/src/inputs.ts';

/** Parsed CLI options. */
interface Opts {
  url: string | null;
  only: string[];
  noBuild: boolean;
  headed: boolean;
  skipExisting: boolean;
}

/** One example look, as authored in a manifest (carried verbatim into the index). */
interface Look { values?: Record<string, unknown> }

/** Raw tool row from catalog/tools/index.json (only the fields this script reads). */
interface RawToolEntry {
  id: string;
  formats?: unknown;
  capabilities?: unknown;
  examples?: Look[];
  featured?: { variants?: Look[] };
}

/** A tool as this script tracks it. */
interface Tool {
  id: string;
  formats: string[];
  capabilities: string[];
  hasCard: boolean;
  hasPreview: boolean;
  // Example LOOKS (manifest.examples, or the featured.variants alias) — each pre-rendered
  // to catalog/previews/<id>.look<i>.svg so the gallery shows them from the bundle instead
  // of live-rendering + fetching each look's assets on first load.
  looks: Look[];
}

/** Outcome of trying to capture one tool. */
type CaptureResult =
  | { ok: true; file: string }
  | { ok: false; reason: string };

/** Handle for the temporary static server that serves dist. */
interface ServeHandle {
  port: number;
  close: () => Promise<void>;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'shells', 'web', 'dist');
// Generated previews land here (git-ignored). Served by the shell's /catalog static
// handler in dev + prod, exactly like the committed catalog assets/index.
const PREVIEWS_DIR = join(ROOT, 'catalog', 'previews');
// Sidebar tools render into #tool-canvas; full-bleed/display tools into #tool-content.
const CANVAS_SEL = '#tool-canvas, #tool-content';

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

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
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
  let server: ServeHandle | null = null;
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
      // DEFAULT preview (see entryFromManifest), so there's nothing to render there — but
      // the tool's example LOOKS still need pre-rendering (an animated card tool like
      // bag-video still has a live example carousel), so we fall through to captureLooks.
      if (tool.hasCard) {
        results.push({ ok: false, reason: 'card override' });
        console.log(`  · ${tool.id.padEnd(20)} skipped (card override)`);
      } else {
        const r = await captureTool(context, baseUrl, tool);
        results.push(r);
        const mark = r.ok ? '✓' : '·';
        console.log(`  ${mark} ${tool.id.padEnd(20)} ${r.ok ? `→ ${rel(r.file)}` : `skipped (${r.reason})`}`);
      }
      // Pre-render each example look → catalog/previews/<id>.look<i>.svg|png. Best-effort:
      // a look that fails just isn't bundled, and the gallery live-renders it as before.
      await captureLooks(context, baseUrl, tool);
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

async function captureTool(context: BrowserContext, baseUrl: string, tool: Tool): Promise<CaptureResult> {
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
        return !!c && (c.children.length > 0 || c.textContent!.trim().length > 0);
      },
      { timeout: 20000 },
    );
    await page.waitForTimeout(900);

    // Preferred path — exportable tools reuse the app's own Save → captureThumbnail
    // logic (svg if the format is vector, png otherwise) and we read the captured
    // thumbnail straight back out of IndexedDB, byte-identical to a real session's.
    const hasSave = await page.evaluate(() => !!document.querySelector('[data-action="save"]'));
    if (hasSave) {
      // A gallery tile is just a screenshot — and a VECTOR screenshot stays crisp at any
      // tile size — so capture one for EVERY tool, not only those that export SVG. This
      // flag makes captureThumbnail (tool.ts) vectorise the rendered canvas regardless of
      // the tool's declared export formats; a dense/expensive result is rasterised below
      // and any walker hiccup falls back to a pixel-faithful raster screenshot. Decoupling
      // the preview from render.formats lets an HTML-layout tool (e.g. the colour browser
      // or the countdown timer) get a crisp vector tile without gaining an SVG download.
      await page.evaluate(() => {
        (globalThis as { __lollyForceVectorThumb?: boolean }).__lollyForceVectorThumb = true;
      });
      // A tool that DOES export svg: also select it so the format the save records matches
      // the vector thumbnail (the flag already forces vector either way).
      if (tool.formats.includes('svg')) {
        await page.evaluate(() => {
          const sel = document.querySelector<HTMLSelectElement>('[data-action="format"]');
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
      await page.evaluate(() => document.querySelector<HTMLElement>('[data-action="save"]')!.click());

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
      // Optimise the vector thumbnail in place (format-preserving — the catalog
      // index derives the .svg extension deterministically from the tool's formats,
      // so a preview must stay SVG). Strip never-painted template comments, then
      // downscale any full-resolution embedded rasters to thumbnail size. A tool
      // whose SVG is dense synthetic vector (no rasters — e.g. a halftone's 10k
      // circles) is unaffected here and wants a committed card.png instead.
      if (ext === 'svg' && bytes) {
        const svg = await optimizeSvgThumb(page, bytes.toString('utf8'));
        // Expensive-to-rasterise SVGs (blur filters / thousands of dots / huge paths)
        // stall the gallery on every paint — svgo shrinks bytes but not render cost.
        // Ship a pre-rasterised PNG for the tile instead; it decodes in ~1ms. The
        // catalog index honours whichever file exists (build-catalog-index.ts). Falls
        // back to the SVG on any rasterise hiccup, so this can only help, never break.
        if (isExpensiveThumbSvg(svg)) {
          const png = await rasterizeSvg(page, svg).catch(() => null);
          if (png) return done(page, { ok: true, file: await writePreview(tool.id, 'png', png) });
        }
        return done(page, { ok: true, file: await writePreview(tool.id, 'svg', Buffer.from(svg, 'utf8')) });
      }
      // bytes truthy ⇒ decodeThumb returned an svg/png branch, so ext is non-null.
      if (bytes) return done(page, { ok: true, file: await writePreview(tool.id, ext!, bytes) });
      // Fall through to the screenshot fallback if the thumbnail was missing or
      // in a format we don't persist (e.g. jpeg/webp default).
    }

    // Before any raster screenshot, try a VECTOR SCREENSHOT via the app's own capture
    // hook (mountTool exposes __lollyCaptureThumb). This is what gives a tool with NO Save
    // button — an export:false utility like the colour browser or countdown timer — a crisp
    // vector tile too. Same optimise + expensive-rasterise path as the Save capture; a
    // null/failed result falls through to the pixel-faithful raster screenshot below.
    const vecThumb = await page.evaluate(() => {
      const cap = (globalThis as { __lollyCaptureThumb?: (f: string) => Promise<string | null> }).__lollyCaptureThumb;
      return cap ? cap('svg') : null;
    }).catch(() => null);
    if (vecThumb) {
      const { ext, bytes } = decodeThumb(vecThumb);
      if (ext === 'svg' && bytes) {
        const svg = await optimizeSvgThumb(page, bytes.toString('utf8'));
        if (isExpensiveThumbSvg(svg)) {
          const png = await rasterizeSvg(page, svg).catch(() => null);
          if (png) return done(page, { ok: true, file: await writePreview(tool.id, 'png', png) });
        }
        return done(page, { ok: true, file: await writePreview(tool.id, 'svg', Buffer.from(svg, 'utf8')) });
      }
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
    return done(page, { ok: false, reason: (e as Error).message.split('\n')[0]! });
  }
}

// Write catalog/previews/<id>.<ext> and remove a stale preview in the other format
// so a tool never has both (e.g. after a tool gains an svg format). Returns the path.
async function writePreview(toolId: string, ext: string, bytes: Buffer): Promise<string> {
  const file = join(PREVIEWS_DIR, `${toolId}.${ext}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  await clearSiblings(`${toolId}`, ext);
  return file;
}

// A tool (or look) carries exactly ONE preview form. When we write one, drop any stale
// file in the other formats — including .webp, which optimize-preview-webp produces from a
// .png, so a tool that flips raster→vector on a re-render can't leave a webp behind.
async function clearSiblings(base: string, keepExt: string): Promise<void> {
  for (const e of ['svg', 'png', 'webp']) {
    if (e === keepExt) continue;
    const f = join(PREVIEWS_DIR, `${base}.${e}`);
    if (existsSync(f)) await unlink(f);
  }
}

function done(page: Page, result: CaptureResult): CaptureResult {
  // Fire-and-forget close; we already have what we need.
  page.close().catch(() => {});
  return result;
}

// ── Pre-render example looks ────────────────────────────────────────────────
// Each manifest example/variant look is rendered to catalog/previews/<id>.look<i>.svg (or
// .png when the look is dense/expensive), which build-preview-bundle.ts rolls into
// bundle.json. The gallery then shows the look instantly from the bundle instead of
// live-rendering it + fetching its assets on first load. All best-effort: any look that
// fails to render simply isn't bundled and the gallery live-renders it exactly as before.

async function captureLooks(context: BrowserContext, baseUrl: string, tool: Tool): Promise<void> {
  if (!tool.looks.length) return;
  let manifest: Parameters<typeof buildInputModel>[0];
  try {
    manifest = JSON.parse(await readFile(join(ROOT, 'tools', tool.id, 'tool.json'), 'utf8'));
  } catch {
    return; // no manifest to seed from
  }
  let ok = 0;
  for (let i = 0; i < tool.looks.length; i++) {
    const values = tool.looks[i]?.values;
    if (!values || typeof values !== 'object') continue;
    // A committed authored look override (tools/<id>/look<i>.{png,webp,svg}) — e.g. an
    // animated APNG — wins in the preview bundle and must never be clobbered. Skip it (and
    // skip the wasted render). Mirrors the card-override skip in the main capture loop.
    if (['png', 'webp', 'svg'].some((ext) => existsSync(join(ROOT, 'tools', tool.id, `look${i}.${ext}`)))) continue;
    // Only the look's OWN (dirty) inputs ride the URL — engine-owned encoding, identical
    // to what a hand-made share of that look would produce (seed-url.ts), so the render
    // matches the live carousel byte-for-byte.
    let query: string;
    try {
      query = serializeUrlState(
        buildInputModel(manifest, { initial: values as Record<string, InputValue> }).filter((m) => m.isDirty),
      );
    } catch {
      continue;
    }
    // width/height/unit/dpi are RESERVED params, not inputs — serializeUrlState drops them,
    // so a reflow look (color-block's wide/tall/banner variants set these in `values`) would
    // otherwise render at the tool's default square and come out squished. Append them so the
    // canvas reflows to the look's real aspect, exactly as the live renderVariantAt path does.
    const params = new URLSearchParams(query);
    for (const key of ['width', 'height', 'unit', 'dpi'] as const) {
      const v = (values as Record<string, unknown>)[key];
      if (v !== undefined && v !== null && v !== '') params.set(key, String(v));
    }
    const fullQuery = params.toString();
    if (await captureLookAt(context, baseUrl, tool, i, fullQuery).catch(() => false)) ok++;
  }
  if (ok) console.log(`    ↳ ${ok}/${tool.looks.length} look${ok === 1 ? '' : 's'} pre-rendered`);
}

async function captureLookAt(context: BrowserContext, baseUrl: string, tool: Tool, i: number, query: string): Promise<boolean> {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/#/tool/${tool.id}${query ? `?${query}` : ''}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector(CANVAS_SEL, { timeout: 20000 });
    await page.waitForFunction(
      () => {
        const c = document.querySelector('#tool-canvas') || document.querySelector('#tool-content');
        return !!c && (c.children.length > 0 || c.textContent!.trim().length > 0);
      },
      { timeout: 20000 },
    );
    await page.waitForTimeout(700);
    // Same vector-screenshot capture the default fallback uses (mountTool's __lollyCaptureThumb) —
    // no Save, so it doesn't pollute IndexedDB with a session per look. The force flag makes it
    // vectorise HTML-layout tools too.
    await page.evaluate(() => { (globalThis as { __lollyForceVectorThumb?: boolean }).__lollyForceVectorThumb = true; });
    const vec = await page.evaluate(() => {
      const cap = (globalThis as { __lollyCaptureThumb?: (f: string) => Promise<string | null> }).__lollyCaptureThumb;
      return cap ? cap('svg') : null;
    }).catch(() => null);
    if (!vec) return false;
    const { ext, bytes } = decodeThumb(vec);
    if (ext === 'svg' && bytes) {
      const svg = await optimizeSvgThumb(page, bytes.toString('utf8'));
      if (isExpensiveThumbSvg(svg)) {
        const png = await rasterizeSvg(page, svg).catch(() => null);
        if (png) { await writeLookPreview(tool.id, i, 'png', png); return true; }
      }
      await writeLookPreview(tool.id, i, 'svg', Buffer.from(svg, 'utf8'));
      return true;
    }
    if (bytes) { await writeLookPreview(tool.id, i, ext!, bytes); return true; }
    return false;
  } finally {
    page.close().catch(() => {});
  }
}

// Write catalog/previews/<id>.look<i>.<ext>, clearing a stale sibling in the other format
// (so a look never has both an .svg and a .png). Mirrors writePreview for looks.
async function writeLookPreview(toolId: string, i: number, ext: string, bytes: Buffer): Promise<string> {
  const file = join(PREVIEWS_DIR, `${toolId}.look${i}.${ext}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  await clearSiblings(`${toolId}.look${i}`, ext);
  return file;
}

// Read the most-recent captured thumbnail for a tool straight out of IndexedDB
// (db 'lolly', store 'state' — see shells/web/src/bridge/db.js + state.js).
function readThumb(page: Page, toolId: string): Promise<string | null> {
  return page.evaluate<string | null, string>(
    (id) =>
      new Promise<string | null>((resolve) => {
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
function decodeThumb(dataUrl: string): { ext: 'svg' | 'png' | null; bytes: Buffer | null } {
  let m = /^data:image\/svg\+xml;base64,(.*)$/s.exec(dataUrl);
  if (m) return { ext: 'svg', bytes: Buffer.from(m[1]!, 'base64') };
  m = /^data:image\/svg\+xml,(.*)$/s.exec(dataUrl);
  if (m) return { ext: 'svg', bytes: Buffer.from(decodeURIComponent(m[1]!), 'utf8') };
  m = /^data:image\/png;base64,(.*)$/s.exec(dataUrl);
  if (m) return { ext: 'png', bytes: Buffer.from(m[1]!, 'base64') };
  // Any other raster (jpeg/webp) → store as .png-named bytes would be wrong; bail.
  return { ext: null, bytes: null };
}

// Shrink a captured SVG thumbnail WITHOUT changing its format (the catalog index
// derives the .svg path deterministically, so a preview must stay SVG). Two passes:
// drop never-painted comments (template.html comments ride into the serialised SVG —
// e.g. filter-duotone's ~674 KB commented-out fallback <image>), then downscale any
// full-resolution embedded rasters in a real canvas (the big win for tools that embed
// source photos, e.g. diagram-builder's six). Fail-safe: any hiccup in the pixel pass
// keeps the comment-stripped SVG, so this can only ever shrink or no-op, never corrupt.
async function optimizeSvgThumb(page: Page, svg: string): Promise<string> {
  let out = stripSvgComments(svg);
  try {
    const uris = listEmbeddedRasters(out);
    if (uris.length) {
      const map = await page.evaluate(shrinkRasters, {
        uris, maxDim: MAX_RASTER_DIM, quality: RASTER_JPEG_QUALITY,
      });
      out = substituteDataUris(out, map);
    }
  } catch { /* downscaling is best-effort — keep the comment-stripped SVG */ }
  // Final pass: svgo path-precision + structure cleanup (the big vector win — the
  // comment/raster passes above never touch geometry). Fail-safe, only shrinks.
  return svgoThumb(out);
}

// Rasterise an SVG string to a PNG buffer using the real browser (Chromium handles
// blur/filters/thousands-of-nodes fine, and 2× the intrinsic size stays crisp on a
// hiDPI tile). Used only for expensive-to-paint previews — see isExpensiveThumbSvg.
async function rasterizeSvg(page: Page, svg: string): Promise<Buffer> {
  const dataUrl = await page.evaluate(async (svgStr: string): Promise<string> => {
    const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('decode')); img.src = url; });
      const w = img.naturalWidth || 800, h = img.naturalHeight || 600, scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } finally { URL.revokeObjectURL(url); }
  }, svg);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

// Runs IN THE PAGE (serialised by Playwright). Decode each embedded data-URI into an
// Image, redraw it into a canvas capped at `maxDim` on its longest edge, and re-encode
// — JPEG for fully-opaque images (much smaller), PNG when any transparency is present
// so alpha survives (e.g. a logo). Returns old→new only where the re-encode is smaller;
// data-URIs are same-origin so getImageData never taints. A per-image failure is
// skipped, leaving that original in place.
async function shrinkRasters(
  { uris, maxDim, quality }: { uris: string[]; maxDim: number; quality: number },
): Promise<Record<string, string>> {
  const load = (src: string): Promise<HTMLImageElement> =>
    new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('decode'));
      im.src = src;
    });
  const out: Record<string, string> = {};
  for (const uri of uris) {
    try {
      const img = await load(uri);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) continue;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const dw = Math.max(1, Math.round(w * scale)), dh = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = dw; canvas.height = dh;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(img, 0, 0, dw, dh);
      let hasAlpha = false;
      try {
        const data = ctx.getImageData(0, 0, dw, dh).data;
        for (let i = 3; i < data.length; i += 4) { if (data[i]! < 255) { hasAlpha = true; break; } }
      } catch { hasAlpha = true; } // unreadable → assume alpha, stay lossless
      const encoded = hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
      if (encoded && encoded.length < uri.length) out[uri] = encoded;
    } catch { /* skip this image; the original data-URI stays in the SVG */ }
  }
  return out;
}

// ── Tool list ───────────────────────────────────────────────────────────────

async function toolList(): Promise<Tool[]> {
  const index = JSON.parse(await readFile(join(ROOT, 'catalog', 'tools', 'index.json'), 'utf8')) as {
    tools: RawToolEntry[];
  };
  let tools: Tool[] = index.tools.map((t) => ({
    id: t.id,
    formats: Array.isArray(t.formats) ? t.formats : [],
    capabilities: Array.isArray(t.capabilities) ? t.capabilities : [],
    // A committed override (tools/<id>/card.svg|png) short-circuits generation.
    hasCard: existsSync(join(ROOT, 'tools', t.id, 'card.svg')) || existsSync(join(ROOT, 'tools', t.id, 'card.png')),
    // A previously generated preview (catalog/previews/<id>.svg|png).
    hasPreview: existsSync(join(PREVIEWS_DIR, `${t.id}.svg`)) || existsSync(join(PREVIEWS_DIR, `${t.id}.png`)),
    // resolveLooks(): examples is canonical, featured.variants is the pre-examples alias —
    // MUST mirror resolveExamples() in featured-row.ts + resolveLooks() in build-preview-bundle.ts.
    looks: t.examples ?? t.featured?.variants ?? [],
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
async function waitForServer(
  baseUrl: string,
  { tries = 60, delayMs = 1000 }: { tries?: number; delayMs?: number } = {},
): Promise<void> {
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
    // `r` is passed as the timer callback (invoked with no args); cast is erased.
    await new Promise((r) => setTimeout(r as () => void, delayMs));
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

async function serveDist(): Promise<ServeHandle> {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]!);
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
  // The listen callback takes no args; the `as` cast is compile-time only (erased).
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok as () => void));
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    close: () => new Promise<void>((ok) => server.close(ok as () => void)),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function parseOpts(argv: string[]): Opts {
  const o: Opts = { url: null, only: [], noBuild: false, headed: false, skipExisting: false };
  for (const a of argv) {
    if (a === '--no-build') o.noBuild = true;
    else if (a === '--headed') o.headed = true;
    else if (a === '--skip-existing') o.skipExisting = true;
    else if (a.startsWith('--url=')) o.url = a.slice(6).replace(/\/$/, '');
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return o;
}

function run(cmd: string, args: string[], cliOpts?: SpawnOptions): Promise<void> {
  return new Promise<void>((ok, fail) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...cliOpts });
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} ${args.join(' ')} exited ${code}`))));
  });
}

const rel = (p: string): string => p.replace(ROOT + '/', '');
