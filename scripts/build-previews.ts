#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Tool preview generator.
 *
 * Run as: npm run previews   (or: node scripts/build-previews.ts [options])
 *
 * Renders every tool with its defaults in a REAL browser and writes a BUILD preview
 * image per tool into the git-ignored catalog/previews/ dir:
 *   • catalog/previews/<id>.svg   a VECTOR SCREENSHOT of the rendered canvas - attempted
 *                                 for EVERY tool, not just SVG exporters, since a tile is
 *                                 just a screenshot and vector stays crisp at any size
 *                                 (the __lollyForceVectorThumb flag decouples this from
 *                                 render.formats - see captureThumbnail in tool.ts)
 *   • catalog/previews/<id>.webp  fallback: a dense/expensive vector (rasterised below to
 *                                 keep the tile cheap to paint) or a tool whose canvas the
 *                                 walker can't vectorise (→ pixel-faithful raster screenshot).
 *                                 Every raster is capped at 1024 px and WebP-encoded HERE,
 *                                 at the point of capture, so a fallback is tile-sized even
 *                                 if no optimise pass ever runs behind it (finalizePreview).
 * SVG previews are then shrunk in place (format-preserving - the catalog index derives
 * the .svg extension deterministically, so the file must stay SVG): never-painted
 * comments are dropped (a tool's template.html comments ride into the serialised SVG - 
 * e.g. filter-duotone's ~674 KB commented-out fallback image) and any full-resolution
 * embedded rasters are downscaled to thumbnail size (diagram-builder's six headshots
 * were the bulk of its 900 KB). See scripts/optimize-preview-svg.ts. A tool whose SVG
 * is dense SYNTHETIC vector with no rasters (a halftone's ~10 k circles, a scanline's
 * one giant integer-coordinate path) can't shrink this way - it wants a committed
 * tools/<id>/card.png override, which the index honours and this script skips.
 * so the gallery shows a full, pretty masonry - no saved sessions required. (Despite the
 * "git-ignored" note above, these ARE committed on purpose - see .gitignore. Don't "clean
 * up" the diff.) The gallery falls back to a plain "open to start" tile when one is absent
 * (dev, or before this has run). Run before serving/deploying.
 *
 * Every card capture is MEASURED before it is written (check-blank-previews.ts's probe, the
 * same one that writes blank-report.json). A tool's card is captured from its DEFAULT state,
 * and plenty of tools open on an empty canvas because their template presets aren't baked
 * yet - so a flat capture is re-taken from the example look that reads best at tile size
 * (recaptureFromBestLook), which is a state the tool genuinely renders. A tool with no
 * usable look keeps its blank tile and is listed at the end of the run as a CONTENT gap:
 * a preview is a truthful sample of what the tool makes, so an honest blank beats invented
 * art. See plans/155 Task 4.4.
 *
 * A tool can ship a committed card - tools/<id>/card.svg or card.html - which wins over
 * the generated preview and is skipped here. As of 2026-07-31 a card is NOT an "authored
 * override" slot: it exists only to preserve MOTION that this script's still capture would
 * lose (the vector screenshot flattens the canvas and drops the outer <style>, so CSS
 * keyframes don't survive). It must still be the tool's own render, emitted by
 * build-svg-card.ts (lifts the tool's animated inline <svg> at its real defaults) or
 * build-html-card.ts (ships the tool's real `html` export). Nine hand-drawn illustration
 * cards were deleted on that date; if a tool's tile looks wrong, fix the tool's defaults
 * or this capture - do not draw a nicer picture of the tool and commit it as a card.
 *
 * Why a browser (not the node CLI): the lean CLI has no layout engine, so it
 * can't render the HTML-layout tools or rasterise. Full coverage of every tool
 * needs a real engine - so we build the web shell and drive Playwright/chromium
 * through the SAME path the Save button uses: captureThumbnail() in tool.js,
 * which already picks "svg if the format is vector, png otherwise" (exactly this
 * script's spec) and inlines/outlines so the SVG is self-contained. We then read
 * the captured thumbnail straight back out of IndexedDB. Reusing the app's own
 * capture keeps a preview byte-identical to a real saved session's thumbnail - 
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
 *                            skipped). Makes repeat runs cheap - used by `npm run dev:web`.
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
// The blank verdict comes from the probe that WROTE the report (Task 4.4.1), not a second
// definition of "empty" living here - a generator that fell back on slightly different
// numbers than the gate measures would either re-blank a tile the gate then rejects, or
// "fix" tiles nobody asked about.
import { measureImage, verdictReason, type Measured } from './check-blank-previews.ts';
// Engine-owned URL encoding - the SAME buildInputModel → serializeUrlState the app's
// seed-url.ts uses, so a look's pre-render URL seeds the identical inputs the live
// carousel would render from (shells/web/src/lib/seed-url.ts).
import { buildInputModel, serializeUrlState } from '../engine/src/index.ts';
import { stampVector, stampBitmap } from './lib/stamp-media.ts';
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
  // Example LOOKS (manifest.examples, or the featured.variants alias) - each pre-rendered
  // to catalog/previews/<id>.look<i>.svg so the gallery shows them from the bundle instead
  // of live-rendering + fetching each look's assets on first load.
  looks: Look[];
}

/** Outcome of trying to capture one tool. */
type CaptureResult =
  | { ok: true; file: string }
  | { ok: false; reason: string };

/**
 * A captured thumbnail, prepared exactly as it will be written - an SVG already optimised,
 * an expensive vector already rasterised - plus its blankness measurement once taken.
 */
interface Prepared { ext: string; bytes: Buffer; measure: Measured | null }

/**
 * Tools whose card measured blank and that had no usable look to re-capture from. That is a
 * CONTENT gap, not a generator bug (plans/155 Task 4.4.3): the tool opens on an empty canvas
 * and declares no example to seed one, so there is no honest tile to make. Collected here and
 * printed at the end of the run - do NOT invent art to fill it; bake the tool a preset.
 */
const contentGaps: { id: string; why: string }[] = [];

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
    // (every dev:web start hits this once the previews exist) - not an error.
    if (opts.skipExisting) {
      console.log('All tools already have a preview or card - nothing to generate.');
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
    // may still be starting - wait for it to answer before driving the browser.
    await waitForServer(baseUrl);
  }

  // Rendering-intent pins matching packages/node-shell/src/browsers.ts (see the
  // comment there): committed output must not depend on the build host's display
  // profile or font hinting.
  const browser = await chromium.launch({ headless: !opts.headed, args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  // serviceWorkers:'block' so the PWA's SW can't serve a stale catalog mid-run.
  const context = await browser.newContext({ serviceWorkers: 'block', deviceScaleFactor: 2 });

  const results: CaptureResult[] = [];
  try {
    for (const tool of tools) {
      // A committed authored override (tools/<id>/card.svg|png) wins over a generated
      // DEFAULT preview (see entryFromManifest), so there's nothing to render there - but
      // the tool's example LOOKS still need pre-rendering (an authored-card tool like
      // pose-geeko still has a live example carousel), so we fall through to captureLooks.
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

  // Task 4.4.3's backlog, printed where the person who just ran the generator will see it.
  // Not a failure: the honest tile for a tool that renders nothing and declares no example
  // IS blank, and validate:catalog carries it as a warning until a preset is baked.
  if (contentGaps.length) {
    console.log(`\n! ${contentGaps.length} tool${contentGaps.length === 1 ? '' : 's'} left with a blank tile - CONTENT gap, not a generator bug:`);
    for (const g of contentGaps) console.log(`    ${g.id.padEnd(20)} ${g.why}`);
    console.log('  Bake these tools an example look (or a template preset) so there is a real');
    console.log('  state to capture. Do not draw a picture of the tool and commit it as a card.');
  }
  console.log('\nDone.');
}

// ── Capture one tool ────────────────────────────────────────────────────────

async function captureTool(context: BrowserContext, baseUrl: string, tool: Tool): Promise<CaptureResult> {
  const page = await context.newPage();
  let cap: Prepared | null = null;
  try {
    await page.goto(`${baseUrl}/#/tool/${tool.id}`, { waitUntil: 'load', timeout: 30000 });

    // Wait for the tool canvas to mount and actually render something. Hooks
    // (onInit) and fonts resolve async, so wait for content then let it settle.
    // Sidebar tools render into #tool-canvas; full-bleed/display tools (hideSidebar)
    // render into #tool-content - match either.
    await page.waitForSelector(CANVAS_SEL, { timeout: 20000 });
    await page.waitForFunction(
      () => {
        const c = document.querySelector('#tool-canvas') || document.querySelector('#tool-content');
        return !!c && (c.children.length > 0 || c.textContent!.trim().length > 0);
      },
      { timeout: 20000 },
    );
    await page.waitForTimeout(900);

    // Preferred path - exportable tools reuse the app's own Save → captureThumbnail
    // logic (svg if the format is vector, png otherwise) and we read the captured
    // thumbnail straight back out of IndexedDB, byte-identical to a real session's.
    const hasSave = await page.evaluate(() => !!document.querySelector('[data-action="save"]'));
    if (hasSave) {
      // A gallery tile is just a screenshot - and a VECTOR screenshot stays crisp at any
      // tile size - so capture one for EVERY tool, not only those that export SVG. This
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
      // can live inside a closed export popover - present in the DOM but not
      // "visible", which fails Playwright's actionability check. el.click() runs
      // the handler regardless.
      await page.evaluate(() => document.querySelector<HTMLElement>('[data-action="save"]')!.click());

      // performSave() captures the thumbnail, awaits host.state.save(), then sets
      // the button label to "Saved" - so once we see "Saved", the thumb is in the DB.
      await page.waitForFunction(
        () => {
          const b = document.querySelector('[data-action="save"]');
          if (!b) return false;
          const t = (b.querySelector('[data-save-label]')?.textContent || b.textContent || '').trim();
          return t === 'Saved';
        },
        { timeout: 25000 },
      );

      // Fall through to the vector/screenshot fallbacks below if the thumbnail was
      // missing or in a format we don't persist (e.g. jpeg/webp default).
      cap = await prepareThumb(page, await readThumb(page, tool.id));
    }

    // Before any raster screenshot, try a VECTOR SCREENSHOT via the app's own capture
    // hook (mountTool exposes __lollyCaptureThumb). This is what gives a tool with NO Save
    // button - an export:false utility like the colour browser or countdown timer - a crisp
    // vector tile too. Same optimise + expensive-rasterise path as the Save capture; a
    // null/failed result falls through to the pixel-faithful raster screenshot below.
    if (!cap) cap = await prepareThumb(page, await captureVectorThumb(page));

    if (!cap) {
      // Fallback - display/utility tools with no Save action (or a failed capture):
      // a raster screenshot of the rendered canvas. Gives every visual tool a
      // preview; file-transform utilities just show their drop-zone UI.
      // Hide app chrome first: an element screenshot includes anything painted over
      // the element's box (the fixed "Tools" back link, the render FAB, the
      // on-device badge), so the preview shows the tool - not the app shell.
      await page.addStyleTag({
        content:
          '.tools-home,.render-fab,.fullscreen-toggle,.fullscreen-toggle-float,.on-device-badge,.export-overlay{display:none !important}',
      });
      const canvas = await page.$(CANVAS_SEL);
      if (!canvas) return done(page, { ok: false, reason: 'no canvas to screenshot' });
      cap = { ext: 'png', bytes: await canvas.screenshot({ type: 'png' }), measure: null };
    }

    // Everything above captured the tool's DEFAULT state, and plenty of tools legitimately
    // open on an empty canvas (the template presets that would seed them aren't baked yet).
    // Measure before writing: a flat capture is not a truthful sample of what the tool
    // makes, it just LOOKS like a preview on disk (plans/155 Task 4.4).
    cap.measure = await measureCapture(page, cap);
    if (cap.measure?.blank) {
      const alt = await recaptureFromBestLook(context, baseUrl, tool);
      if (alt) cap = alt;
    }
    return done(page, { ok: true, file: await writePreview(tool.id, cap.ext, cap.bytes) });
  } catch (e) {
    return done(page, { ok: false, reason: (e as Error).message.split('\n')[0]! });
  }
}

/**
 * Turn a captured thumbnail data-URL into the bytes we would write.
 *
 * Optimise the vector thumbnail in place (format-preserving - the catalog index derives the
 * .svg extension deterministically from the tool's formats, so a preview must stay SVG):
 * strip never-painted template comments, then downscale any full-resolution embedded rasters
 * to thumbnail size. A tool whose SVG is dense synthetic vector (no rasters - e.g. a
 * halftone's 10k circles) is unaffected here and wants a committed card.png instead.
 *
 * Expensive-to-rasterise SVGs (thousands of elements / huge single paths / synthesised
 * per-pixel noise - isExpensiveThumbSvg measures which, and a blur is NOT one of them) stall
 * the gallery on every paint; svgo shrinks bytes but not render cost. Ship a pre-rasterised
 * tile instead - it decodes in ~1ms, and writePreview encodes it to a stamped WebP, never a
 * .png. The catalog index honours whichever file exists (build-catalog-index.ts). Falls back
 * to the SVG on any rasterise hiccup, so this can only help, never break.
 *
 * Returns null when there is no thumbnail, or it is in a format we don't persist.
 */
async function prepareThumb(page: Page, dataUrl: string | null): Promise<Prepared | null> {
  if (!dataUrl) return null;
  const { ext, bytes } = decodeThumb(dataUrl);
  if (ext === 'svg' && bytes) {
    const svg = await optimizeSvgThumb(page, bytes.toString('utf8'));
    if (isExpensiveThumbSvg(svg)) {
      const png = await rasterizeSvg(page, svg).catch(() => null);
      if (png) return { ext: 'png', bytes: png, measure: null };
    }
    return { ext: 'svg', bytes: Buffer.from(svg, 'utf8'), measure: null };
  }
  // bytes truthy ⇒ decodeThumb returned an svg/png branch, so ext is non-null.
  if (bytes) return { ext: ext!, bytes, measure: null };
  return null;
}

/** The app's own vector screenshot of the mounted canvas (mountTool exposes the hook). */
function captureVectorThumb(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const cap = (globalThis as { __lollyCaptureThumb?: (f: string) => Promise<string | null> }).__lollyCaptureThumb;
    return cap ? cap('svg') : null;
  }).catch(() => null);
}

// Write catalog/previews/<id>.<ext> and remove a stale preview in the other format
// so a tool never has both (e.g. after a tool gains an svg format). Returns the path.
async function writePreview(toolId: string, ext: string, bytes: Buffer): Promise<string> {
  const final = await finalizePreview(toolId, ext, bytes, { id: toolId, name: toolId });
  const file = join(PREVIEWS_DIR, `${toolId}.${final.ext}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, final.bytes);
  await clearSiblings(`${toolId}`, final.ext);
  return file;
}

// Retina-safe cap for a captured raster, MIRRORING MAX_DIM in optimize-preview-webp.ts:
// the featured hero shows a preview at ~400 CSS px and grid tiles smaller, so 1024 covers
// 2× on the largest surface. Keep the two in step - they are the same decision made at two
// points in the same pipeline (this one at capture, that one when sweeping up a stray .png).
const RASTER_MAX_DIM = 1024;

// The on-disk form of one captured preview. An SVG stays an SVG (the catalog index derives
// that extension deterministically) and gains its C2PA credential; a RASTER is encoded here
// exactly the way optimize-preview-webp.ts would - resize to the cap, then one stamped
// WebP q80 pass - instead of being written at full capture resolution and left for a later
// step that might never run.
//
// It might never run: the raster screenshot in captureTool above is a 2× deviceScaleFactor
// capture of the whole canvas, and dev:web's auto-backfill used to invoke this script
// WITHOUT the optimize step behind it. That is how a 7.5 MB mesh-gradient.png and ~60 MB of
// siblings came to be committed (plans/155 finding 3). Encoding at the point of capture
// means a fallback is tile-sized even when nothing sweeps up after it: that same 7.5 MB
// capture comes out of this function at 7 KB.
async function finalizePreview(
  base: string, ext: string, bytes: Buffer, meta: { id: string; name: string },
): Promise<{ ext: string; bytes: Buffer }> {
  if (ext === 'svg') return { ext, bytes: Buffer.from(await stampVector(bytes, meta)) };
  try {
    const sharp = (await import('sharp')).default;
    // Resize to a lossless intermediate, then hand it to the shared stamper: it imprints
    // the pixels (robust strength, since the WebP is lossy) and embeds the "made with
    // Lolly" credential, re-encoding to WebP q80 in one pass (no double compression).
    const resized = await sharp(bytes)
      .resize({ width: RASTER_MAX_DIM, height: RASTER_MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return { ext: 'webp', bytes: Buffer.from(await stampBitmap(new Uint8Array(resized), 'webp', meta, { webpQuality: 80 })) };
  } catch (e) {
    // Best-effort like every other step here - a preview is better than none. Loud, though:
    // the raw capture is exactly what the byte budgets in validate-catalog.ts reject, so
    // the warning below explains the validate:catalog failure that follows.
    console.warn(`    ! ${base}: WebP encode failed (${(e as Error).message}) - writing the raw ${ext}, which validate:catalog will reject`);
    return { ext, bytes };
  }
}

// A tool (or look) carries exactly ONE preview form. When we write one, drop any stale
// file in the other formats - including .webp, which optimize-preview-webp produces from a
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
// a stamped .webp when isExpensiveThumbSvg says the vector form is dense/expensive to
// paint - never a .png), which build-preview-bundle.ts rolls into
// bundle.json. The gallery then shows the look instantly from the bundle instead of
// live-rendering it + fetching its assets on first load. All best-effort: any look that
// fails to render simply isn't bundled and the gallery live-renders it exactly as before.

async function captureLooks(context: BrowserContext, baseUrl: string, tool: Tool): Promise<void> {
  if (!tool.looks.length) return;
  const manifest = await loadManifest(tool.id);
  if (!manifest) return; // no manifest to seed from
  let ok = 0;
  for (let i = 0; i < tool.looks.length; i++) {
    // A committed authored look override (tools/<id>/look<i>.{png,webp,svg}) - e.g. an
    // animated APNG - wins in the preview bundle and must never be clobbered. Skip it (and
    // skip the wasted render). Mirrors the card-override skip in the main capture loop.
    if (['png', 'webp', 'svg'].some((ext) => existsSync(join(ROOT, 'tools', tool.id, `look${i}.${ext}`)))) continue;
    const query = lookQuery(manifest, tool.looks[i]);
    if (query === null) continue;
    if (await captureLookAt(context, baseUrl, tool, i, query).catch(() => false)) ok++;
  }
  if (ok) console.log(`    ↳ ${ok}/${tool.looks.length} look${ok === 1 ? '' : 's'} pre-rendered`);
}

/** The tool's manifest as buildInputModel wants it, or null when it can't be read. */
async function loadManifest(toolId: string): Promise<Parameters<typeof buildInputModel>[0] | null> {
  try {
    return JSON.parse(await readFile(join(ROOT, 'tools', toolId, 'tool.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The seeded query string for one look, or null when it can't be encoded.
 *
 * Only the look's OWN (dirty) inputs ride the URL - engine-owned encoding, identical to what
 * a hand-made share of that look would produce (seed-url.ts), so the render matches the live
 * carousel byte-for-byte. That fidelity is also what makes this URL a legitimate source for a
 * blank tool's CARD (Task 4.4.2): the tile shows a state the tool really renders.
 */
function lookQuery(manifest: Parameters<typeof buildInputModel>[0], look: Look | undefined): string | null {
  const values = look?.values;
  if (!values || typeof values !== 'object') return null;
  let query: string;
  try {
    query = serializeUrlState(
      buildInputModel(manifest, { initial: values as Record<string, InputValue> }).filter((m) => m.isDirty),
    );
  } catch {
    return null;
  }
  // width/height/unit/dpi are RESERVED params, not inputs - serializeUrlState drops them,
  // so a reflow look (color-block's wide/tall/banner variants set these in `values`) would
  // otherwise render at the tool's default square and come out squished. Append them so the
  // canvas reflows to the look's real aspect, exactly as the live renderVariantAt path does.
  const params = new URLSearchParams(query);
  for (const key of ['width', 'height', 'unit', 'dpi'] as const) {
    const v = (values as Record<string, unknown>)[key];
    if (v !== undefined && v !== null && v !== '') params.set(key, String(v));
  }
  return params.toString();
}

async function captureLookAt(context: BrowserContext, baseUrl: string, tool: Tool, i: number, query: string): Promise<boolean> {
  const cap = await captureSeeded(context, baseUrl, tool, query, { measure: false });
  if (!cap) return false;
  await writeLookPreview(tool.id, i, cap.ext, cap.bytes);
  return true;
}

/**
 * Render one seeded URL and return the thumbnail as it would be written. Shared by
 * "pre-render a look" and "re-capture a blank card from a look" so both take the same
 * picture; `measure` is opt-in because only the fallback needs the (rasterise + probe) cost.
 */
async function captureSeeded(
  context: BrowserContext, baseUrl: string, tool: Tool, query: string, o: { measure: boolean },
): Promise<Prepared | null> {
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
    // Same vector-screenshot capture the default fallback uses (mountTool's __lollyCaptureThumb) -
    // no Save, so it doesn't pollute IndexedDB with a session per look. The force flag makes it
    // vectorise HTML-layout tools too.
    await page.evaluate(() => { (globalThis as { __lollyForceVectorThumb?: boolean }).__lollyForceVectorThumb = true; });
    const cap = await prepareThumb(page, await captureVectorThumb(page));
    if (cap && o.measure) cap.measure = await measureCapture(page, cap);
    return cap;
  } finally {
    page.close().catch(() => {});
  }
}

// Write catalog/previews/<id>.look<i>.<ext>, clearing a stale sibling in the other format
// (so a look never has both an .svg and a raster). Mirrors writePreview for looks.
async function writeLookPreview(toolId: string, i: number, ext: string, bytes: Buffer): Promise<string> {
  const base = `${toolId}.look${i}`;
  // Same as writePreview: an SVG look gets a C2PA credential, a raster look is encoded to
  // a stamped tile-sized WebP right here rather than left as a full-resolution capture.
  const final = await finalizePreview(base, ext, bytes, { id: base, name: toolId });
  const file = join(PREVIEWS_DIR, `${base}.${final.ext}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, final.bytes);
  await clearSiblings(base, final.ext);
  return file;
}

// Read the most-recent captured thumbnail for a tool straight out of IndexedDB
// (db 'lolly', store 'state' - see shells/web/src/bridge/db.js + state.js).
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
// drop never-painted comments (template.html comments ride into the serialised SVG - 
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
  } catch { /* downscaling is best-effort - keep the comment-stripped SVG */ }
  // Final pass: svgo path-precision + structure cleanup (the big vector win - the
  // comment/raster passes above never touch geometry). Fail-safe, only shrinks.
  return svgoThumb(out);
}

// Rasterise an SVG string to a PNG buffer using the real browser (Chromium handles
// blur/filters/thousands-of-nodes fine, and 2× the intrinsic size stays crisp on a
// hiDPI tile). Used only for expensive-to-paint previews - see isExpensiveThumbSvg.
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

// ── Blank capture → fall back to a look ─────────────────────────────────────

/**
 * Measure a just-taken capture for blankness, with the SAME probe that writes
 * blank-report.json (check-blank-previews.ts) so the generator and the gate can never
 * disagree about one file.
 *
 * An SVG is rasterised through rasterizeSvg first - i.e. by the same Chromium that produced
 * the capture - rather than handed to sharp as SVG. The probe's own sweep reads committed
 * files through libvips/librsvg, which renders a self-contained thumbnail fine but is a
 * DIFFERENT engine from the one whose output we are judging; measuring the browser's own
 * pixels means a "blank" verdict here is about what the capture actually paints.
 */
async function measureCapture(page: Page, cap: Prepared): Promise<Measured | null> {
  try {
    const png = cap.ext === 'svg' ? await rasterizeSvg(page, cap.bytes.toString('utf8')) : cap.bytes;
    return await measureImage(png);
  } catch {
    // Best-effort like every other step here: an unmeasurable capture is written as captured
    // rather than dropped, and the committed-file sweep will still catch it if it is blank.
    return null;
  }
}

/**
 * How well a capture reads as a 164 px gallery tile: ink coverage × how strongly that ink
 * separates from the ground. The ink term is square-rooted so a large flat wash can't out-score
 * real content and a single high-contrast speck can't win on contrast alone.
 *
 * THIS IS WHY THE FALLBACK DOES NOT JUST TAKE look0. Measured on the committed `design`
 * previews, 2026-08-26: look0 "Three steps" (dark text on white) scores stddev 25.3 / ink
 * 0.0287 → 4.29, while look1 "Quote cutaway" (white type on a full-bleed dark green field)
 * scores 34.0 / 0.0464 → 7.33. Both are non-blank, so "first look that isn't blank" would
 * pick look0 - and design is the featured hero (index featured.order 1), where a tile of
 * small dark text on white reads as near-empty at tile size. Pick the look that READS, not
 * the first one that passes.
 */
function tileScore(m: Measured): number {
  return m.stddev * Math.sqrt(m.inkRatio);
}

/**
 * A card capture came out flat. Re-capture it from the example look that reads best at tile
 * size, so the tile is a state the tool genuinely renders (plans/155 Task 4.4.2).
 *
 * Returns null when there is nothing honest to fall back on - no looks, no look that encodes,
 * or every look equally blank. That is a CONTENT gap (Task 4.4.3): the fix is to bake the
 * tool a preset, never to draw it a nicer picture. The tool is recorded in `contentGaps` and
 * the blank tile is written as captured, so the gate keeps reporting it.
 */
async function recaptureFromBestLook(context: BrowserContext, baseUrl: string, tool: Tool): Promise<Prepared | null> {
  const note = (why: string): null => {
    console.log(`    ! ${tool.id}: default state is blank and ${why} - CONTENT gap, tile left blank`);
    contentGaps.push({ id: tool.id, why });
    return null;
  };
  if (!tool.looks.length) return note('the tool declares no example looks');
  const manifest = await loadManifest(tool.id);
  if (!manifest) return note('its manifest could not be read');

  let best: { cap: Prepared; i: number; score: number } | null = null;
  for (let i = 0; i < tool.looks.length; i++) {
    const query = lookQuery(manifest, tool.looks[i]);
    if (query === null) continue;
    const cap = await captureSeeded(context, baseUrl, tool, query, { measure: true }).catch(() => null);
    // An unmeasurable candidate is skipped rather than trusted: falling back to a look we
    // cannot prove is non-blank would just move the blank tile, silently.
    if (!cap?.measure || cap.measure.blank) continue;
    const score = tileScore(cap.measure);
    console.log(`      · look${i}: stddev=${cap.measure.stddev} ink=${cap.measure.inkRatio} score=${score.toFixed(2)}`);
    if (!best || score > best.score) best = { cap, i, score };
  }
  if (!best) return note('no declared look renders anything either');
  const reason = verdictReason(best.cap.measure!);
  console.log(`    ↻ ${tool.id}: blank default → captured from look${best.i} (score ${best.score.toFixed(2)}${reason ? `, ${reason}` : ''})`);
  return best.cap;
}

// Runs IN THE PAGE (serialised by Playwright). Decode each embedded data-URI into an
// Image, redraw it into a canvas capped at `maxDim` on its longest edge, and re-encode
// - JPEG for fully-opaque images (much smaller), PNG when any transparency is present
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
    // A previously generated preview (catalog/previews/<id>.svg|webp|png). .webp is the
    // form a raster preview actually ships in, and it was missing from this list - so
    // --skip-existing considered every WebP tool uncovered and re-rendered it on EVERY
    // `npm run dev:web`, each time writing a fresh full-size capture. That is the other
    // half of the 60 MB leak (plans/155 finding 3): a backfill that never stopped
    // backfilling. .png stays for the pre-WebP files still on disk.
    hasPreview: ['svg', 'webp', 'png'].some((ext) => existsSync(join(PREVIEWS_DIR, `${t.id}.${ext}`))),
    // resolveLooks(): examples is canonical, featured.variants is the pre-examples alias - 
    // MUST mirror resolveExamples() in featured-row.ts + resolveLooks() in build-preview-bundle.ts.
    looks: t.examples ?? t.featured?.variants ?? [],
  }));
  if (opts.only.length) {
    const want = new Set(opts.only);
    tools = tools.filter((t) => want.has(t.id));
  }
  // Capture-gated tools (e.g. url-shot) rasterise a live URL via the `capture`
  // bridge, which isn't available in this headless render path - they can never
  // produce a static preview, so skip them up front instead of eating a guaranteed
  // ~20s waitForSelector timeout per run.
  const gated = tools.filter((t) => t.capabilities.includes('capture'));
  if (gated.length) console.log(`Skipping ${gated.map((t) => t.id).join(', ')} (capture-gated - no static preview).`);
  tools = tools.filter((t) => !t.capabilities.includes('capture'));
  // --skip-existing: only fill in the gaps. A tool that already has a generated
  // preview (or a committed card) needs no work - drop it so repeat runs, e.g. on
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
  // Build only the web workspace - skips the /info docs build, which the tool
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
  // --preserve (and the LOLLY_PRESERVE env, which loldev sets so the flag survives the
  // npm `&&` chain) are aliases for --skip-existing: keep the committed previews, only
  // fill in missing ones. Default (no flag) re-renders + overwrites every preview.
  const o: Opts = { url: null, only: [], noBuild: false, headed: false, skipExisting: process.env.LOLLY_PRESERVE === '1' };
  for (const a of argv) {
    if (a === '--no-build') o.noBuild = true;
    else if (a === '--headed') o.headed = true;
    else if (a === '--skip-existing' || a === '--preserve') o.skipExisting = true;
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
