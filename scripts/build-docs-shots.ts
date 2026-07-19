#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Docs screenshots — declared IN the markdown, captured, compared, credentialed.
 *
 * A screenshot in the /info docs is an ordinary markdown image whose URL is a real
 * url-shot tool link (domain-relative):
 *
 *   ![The gallery](/t/url-shot?url=%2F%23%2F&width=1440&height=900&waitMs=1600&format=svg&filename=gallery)
 *
 * Content and recipe travel together in the .md — no side manifest. The query is
 * url-shot's own input vocabulary (url, waitMs, css, scrollDepth, zoom, crop*) plus
 * the reserved params width/height/dpi/format/filename and the pipeline-only
 * `tolerance`. This script scans docs/*.md, renders each recipe through the exact
 * primitive url-shot's CLI export uses (packages/node-shell/src/url-capture.ts →
 * the scoped Chromium), and commits baselines at docs/shots/<filename>.<format>;
 * docs/build.ts rewrites each recipe src to /info/shots/<filename>.<format>. The
 * day a GET renderer ships, the same links can resolve live — the capture step is
 * today's polyfill.
 *
 * Formats: `svg` (default) is a TRUE VECTOR — the page is printed to a vector PDF
 * and interpreted back to standalone SVG by the app itself (see captureVector),
 * with text kept real and fonts inlined. `png`/`jpg` are screenshots for the
 * pages where the print path can't be faithful (wall-clock media, backdrop
 * effects) — a per-recipe, performance-reasons-only choice.
 *
 * Authenticity: every baseline carries Content Credentials (embedC2pa, surface
 * 'docs', with the recipe's parameters in the credential). Raster baselines also
 * carry the Lolly Imprint (engine pixel-watermark, gentle LOSSLESS_STRENGTH);
 * a vector has no pixels to watermark, and that's accepted — C2PA is the
 * provenance for vector shots. The imprint is embedded BEFORE the compare so
 * runs stay deterministic; C2PA (whose signature carries a timestamp) is stamped
 * only when a baseline is actually (re)written, so an unchanged shot keeps its
 * committed bytes verbatim and git never churns.
 *
 * Captures are PINNED to the neutral brand (lolly-start profile) regardless of the
 * sticky profile: deterministic pixels, and public-safe — the SUSE brand pack is
 * private, so its pixels must never be committed into the public docs repo. The
 * pre-run profile is restored afterwards (same fallback rules as loldev's do_build).
 *
 * Every run is a snapshot comparison (scripts/lib/shot-compare.ts):
 *   ✚ new        — no baseline; the capture is written (suspicious flags still warn)
 *   ✓ unchanged  — baseline kept byte-for-byte
 *   ▲ changed    — reported, NOT promoted; re-run with --accept to take the new pixels
 *   ✗ failed     — capture error or wrong output dimensions; exits 1
 * Suspicious flags (tiny file / near-blank image / >40% size jump) mark probable
 * failed renders even when Chromium reported success.
 *
 * Chromium never runs on Vercel — this is a build-machine step (loldev gtg/ship);
 * the committed bytes ship, exactly like catalog/og and catalog/previews.
 *
 * Options:
 *   --accept       promote changed captures to the new baseline
 *   --only=a,b     limit to these filenames
 *   --url=...      capture against a running server (skips profile pin + build + serve)
 *   --no-build     reuse shells/web/dist (still pins the profile for the view check)
 *   --list         print every recipe found in the docs, then exit
 *
 * Exit codes: 0 clean · 1 failures · 2 changes pending review (gtg warns, proceeds).
 */

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { captureUrl, type CaptureParams } from '../packages/node-shell/src/url-capture.ts';
import { resolveBrowsersDir, getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { buildExportC2paOpts } from '../packages/node-shell/src/c2pa-opts.ts';
import { embedC2pa, windowPdfSvg, type summarizeInputs } from '../engine/src/index.ts';
import { embedWatermark, LOSSLESS_STRENGTH, DEFAULT_STRENGTH } from '../engine/src/pixel-watermark.ts';
import {
  DEFAULT_THRESHOLDS, classifyShot, classifyVectorShot, parseShotRecipes,
  type RawImage, type ShotDef, type ShotVerdict,
} from './lib/shot-compare.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'shells', 'web', 'dist');
const DOCS_DIR = join(ROOT, 'docs');
const SHOTS_DIR = join(ROOT, 'docs', 'shots');
const PROFILE_STICKY = join(ROOT, '.lolly-profile');
const CAPTURE_PROFILE = 'lolly-start';
const SITE_URL = 'https://lolly.tools';

// Freeze the page for a deterministic shot: jump animations/transitions to their
// final state (duration 0 — NOT `animation:none`, which would strand enter-animation
// elements at their invisible starting styles), hide the caret and scrollbars.
const FREEZE_CSS =
  '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;' +
  'transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}' +
  'html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}';

const VIEWPORT_DEFAULTS = { width: 1440, height: 900, dpi: 192 };

interface Opts {
  accept: boolean;
  list: boolean;
  noBuild: boolean;
  url: string | null;
  only: string[];
}

function parseOpts(argv: string[]): Opts {
  const o: Opts = { accept: false, list: false, noBuild: false, url: null, only: [] };
  for (const a of argv) {
    if (a === '--accept') o.accept = true;
    else if (a === '--list') o.list = true;
    else if (a === '--no-build') o.noBuild = true;
    else if (a.startsWith('--url=')) o.url = a.slice(6);
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else console.warn(`⚠  ignoring unknown option ${a}`);
  }
  return o;
}

interface ShotResult {
  slug: string;
  format: string;
  verdict?: ShotVerdict;
  error?: string;
  wrote: boolean;
  bytes: number;
}

const opts = parseOpts(process.argv.slice(2));

main().catch((e: Error) => {
  console.error(`\n✗ ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});

async function main(): Promise<void> {
  const allShots = scanDocs();
  let shots = allShots;

  if (opts.only.length) {
    const missing = opts.only.filter((s) => !shots.some((x) => x.slug === s));
    if (missing.length) throw new Error(`--only names unknown recipes: ${missing.join(', ')}`);
    shots = shots.filter((s) => opts.only.includes(s.slug));
  }

  if (opts.list) {
    for (const s of shots) console.log(`${s.slug.padEnd(18)} ${SITE_URL}${s.raw}`);
    return;
  }

  await ensureBrowserResolvable();

  let baseUrl = opts.url;
  let server: ServeHandle | null = null;
  let restoreProfile: (() => void) | null = null;
  const results: ShotResult[] = [];
  try {
    if (!baseUrl) {
      restoreProfile = pinProfile();
      if (!opts.noBuild) await buildWebShell();
      if (!existsSync(join(DIST, 'index.html'))) {
        throw new Error(`No build at ${rel(DIST)} — run without --no-build, or pass --url=<server>.`);
      }
      checkDistBrand();
      server = await serveDist();
      baseUrl = `http://127.0.0.1:${server.port}`;
      console.log(`Serving ${rel(DIST)} at ${baseUrl}`);
    } else {
      console.log(`Capturing against ${baseUrl} (profile pin skipped — the server owns its brand)`);
    }

    mkdirSync(SHOTS_DIR, { recursive: true });
    const sharp = (await import('sharp')).default;

    for (const shot of shots) {
      const r = await captureOne(sharp, baseUrl, shot);
      results.push(r);
      reportLine(r);
    }
  } finally {
    // getBrowser()'s Chromium is shared across captures and would otherwise hold
    // the event loop open past the summary (the CLI leans on process exit for this).
    await closeBrowser();
    if (server) await server.close();
    restoreProfile?.();
  }

  warnOrphans(allShots); // the FULL recipe set — an --only run must not cry orphan
  summarize(results);
}

// ── Recipe discovery ──────────────────────────────────────────────────────────

/**
 * Every url-shot recipe image across docs/*.md, deduped by filename. The same
 * recipe may appear on several pages (they share one baseline); the same filename
 * with a DIFFERENT query is a conflict.
 */
function scanDocs(): ShotDef[] {
  const byName = new Map<string, ShotDef & { file: string }>();
  const problems: string[] = [];
  for (const f of readdirSync(DOCS_DIR).sort()) {
    if (!f.endsWith('.md')) continue;
    const { recipes, problems: p } = parseShotRecipes(readFileSync(join(DOCS_DIR, f), 'utf-8'));
    problems.push(...p.map((x) => `${f}: ${x}`));
    for (const r of recipes) {
      const prior = byName.get(r.slug);
      if (prior && prior.raw !== r.raw) {
        problems.push(`${f}: recipe "${r.slug}" conflicts with the one in ${prior.file} — same filename, different query`);
      } else if (!prior) {
        byName.set(r.slug, { ...r, file: f });
      }
    }
  }
  if (problems.length) throw new Error(`Bad screenshot recipes:\n  - ${problems.join('\n  - ')}`);
  if (!byName.size) throw new Error('No url-shot recipe images found in docs/*.md.');
  return [...byName.values()];
}

/** Baselines on disk that no recipe declares any more — stale, safe to delete. */
function warnOrphans(shots: ShotDef[]): void {
  if (!existsSync(SHOTS_DIR)) return;
  const expected = new Set(shots.map((s) => `${s.slug}.${s.format}`));
  const orphans = readdirSync(SHOTS_DIR).filter((f) => /\.(svg|png|jpg)$/.test(f) && !expected.has(f));
  if (orphans.length) console.warn(`⚠  orphan baselines (no recipe declares them — delete from ${rel(SHOTS_DIR)}): ${orphans.join(', ')}`);
}

// ── Capture, imprint, classify, credential ────────────────────────────────────

type Sharp = typeof import('sharp').default;

function paramsFor(shot: ShotDef): { params: Omit<CaptureParams, 'url'>; dims: { width: number; height: number; dpi: number } } {
  return {
    params: {
      scrollDepth: shot.scrollDepth ?? 0,
      waitMs: shot.waitMs ?? 1_000,
      css: [shot.css ?? '', FREEZE_CSS].filter(Boolean).join('\n'),
      cropLeft: shot.cropLeft ?? 0,
      cropRight: shot.cropRight ?? 0,
      cropTop: shot.cropTop ?? 0,
      cropBottom: shot.cropBottom ?? 0,
      recolor: 'none',
      tintColor: '',
      hue: 0,
      zoom: shot.zoom ?? 1,
    },
    dims: {
      width: shot.width ?? VIEWPORT_DEFAULTS.width,
      height: shot.height ?? VIEWPORT_DEFAULTS.height,
      dpi: shot.dpi ?? VIEWPORT_DEFAULTS.dpi,
    },
  };
}

/** The post-crop, post-DPR pixel size captureUrl will emit (its exact math). */
function expectedDims(shot: ShotDef, dims: { width: number; height: number; dpi: number }): { width: number; height: number } {
  const clamp = (n: number | undefined): number => Math.min(0.9, Math.max(0, n ?? 0));
  const dpr = dims.dpi > 96 ? dims.dpi / 96 : 1;
  const clipW = Math.max(1, Math.round(dims.width * (1 - clamp(shot.cropLeft) - clamp(shot.cropRight))));
  const clipH = Math.max(1, Math.round(dims.height * (1 - clamp(shot.cropTop) - clamp(shot.cropBottom))));
  return { width: Math.round(clipW * dpr), height: Math.round(clipH * dpr) };
}

// Seed localStorage before the app boots so docs captures are deterministic
// regardless of the active profile: pre-dismiss the first-run welcome + tips
// strip (unbranded/start builds show them on `#/`, which would occlude a
// gallery-route deep-link like `?tool=` or `?history`). Keys mirror
// shells/web/src/components/welcome-dialog.ts (WELCOME_/TIPS_DISMISSED_KEY) —
// stable localStorage contracts, same tier as the theme flag.
const CAPTURE_INIT =
  "try{localStorage.setItem('lolly-welcome-dismissed','1');" +
  "localStorage.setItem('lolly-tips-dismissed','1')}catch(_){}";

async function captureOne(sharp: Sharp, baseUrl: string, shot: ShotDef): Promise<ShotResult> {
  // cropSelector → measure the element and stamp exact crop insets onto the shot,
  // so both capture paths frame it without hand-authored fractions.
  if (shot.cropSelector) {
    try {
      shot = { ...shot, ...(await resolveSelectorCrop(baseUrl, shot)) };
    } catch (e) {
      return { slug: shot.slug, format: shot.format, error: (e as Error).message, wrote: false, bytes: 0 };
    }
  }
  return shot.format === 'svg'
    ? captureOneVector(baseUrl, shot)
    : captureOneRaster(sharp, baseUrl, shot);
}

/**
 * Navigate the shot's page (same css / scroll / wait as the capture) and measure
 * the cropSelector element's box, returning crop insets (fractions of the
 * viewport) that frame it with a small padding. Runs in its own context so it
 * never disturbs the capture; the crop math it produces is identical to a
 * hand-authored crop*, so the compare/expected-dims logic is unchanged.
 */
async function resolveSelectorCrop(baseUrl: string, shot: ShotDef): Promise<Partial<ShotDef>> {
  const { params, dims } = paramsFor(shot);
  const browser = await getBrowser();
  const ctx = await browser.newContext({ viewport: { width: dims.width, height: dims.height }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  try {
    await ctx.addInitScript({ content: CAPTURE_INIT });
    const page = await ctx.newPage();
    await page.goto(baseUrl + shot.route, { waitUntil: 'load', timeout: 45_000 });
    await page.evaluate(() => (document.fonts?.ready ?? Promise.resolve()).then(() => undefined)).catch(() => {});
    if (params.css) await page.addStyleTag({ content: params.css }).catch(() => {});
    if (params.scrollDepth > 0) {
      await page.evaluate((d: number) => {
        const max = Math.max(0, document.body.scrollHeight - window.innerHeight);
        window.scrollTo(0, d > 1 ? d : d * max);
      }, params.scrollDepth).catch(() => {});
    }
    if (params.waitMs > 0) await page.waitForTimeout(Math.min(15_000, params.waitMs));

    const PAD = 24;
    const box = await page.evaluate(({ sel, pad }: { sel: string; pad: number }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const left = Math.max(0, r.left - pad), top = Math.max(0, r.top - pad);
      const right = Math.min(vw, r.right + pad), bottom = Math.min(vh, r.bottom + pad);
      return { cropLeft: left / vw, cropRight: (vw - right) / vw, cropTop: top / vh, cropBottom: (vh - bottom) / vh, w: r.width, h: r.height };
    }, { sel: shot.cropSelector!, pad: PAD });
    if (!box || box.w < 1 || box.h < 1) throw new Error(`cropSelector "${shot.cropSelector}" matched nothing visible`);
    return { cropLeft: box.cropLeft, cropRight: box.cropRight, cropTop: box.cropTop, cropBottom: box.cropBottom };
  } finally {
    await ctx.close();
  }
}

// ── Raster (png/jpg): screenshot + Lolly Imprint, pixel-compared ─────────────

async function captureOneRaster(sharp: Sharp, baseUrl: string, shot: ShotDef): Promise<ShotResult> {
  const { params, dims } = paramsFor(shot);
  let bytes: Uint8Array;
  try {
    ({ bytes } = await captureUrl({ ...params, url: baseUrl + shot.route, initScript: CAPTURE_INIT }, shot.format, dims));
    // The Lolly Imprint goes in BEFORE the compare: embedWatermark is a fixed,
    // deterministic pattern, so identical captures stay pixel-identical run to run
    // and the baseline's pixels already carry the mark.
    bytes = await imprintRaster(sharp, bytes, shot.format);
  } catch (e) {
    return { slug: shot.slug, format: shot.format, error: (e as Error).message, wrote: false, bytes: 0 };
  }

  const newImg = await decodeShot(sharp, bytes);
  const baselinePath = join(SHOTS_DIR, `${shot.slug}.${shot.format}`);
  let oldBytes: number | undefined;
  let oldImg: RawImage | undefined;
  if (existsSync(baselinePath)) {
    const old = readFileSync(baselinePath);
    oldBytes = old.byteLength;
    oldImg = await decodeShot(sharp, new Uint8Array(old));
  }

  const verdict = classifyShot(
    { newBytes: bytes.byteLength, newImg, expected: expectedDims(shot, dims), oldBytes, oldImg },
    // Per-shot tolerance for pages hosting wall-clock media (animated previews)
    // whose phase differs run to run — see ShotDef.pixelDiffFrac.
    { ...DEFAULT_THRESHOLDS, pixelDiffFrac: shot.pixelDiffFrac ?? DEFAULT_THRESHOLDS.pixelDiffFrac },
  );

  const promote = verdict.kind === 'new' || (verdict.kind === 'changed' && opts.accept);
  // Content Credentials only on a real (re)write: the C2PA signature carries a
  // timestamp, so stamping every run would churn bytes for unchanged pixels.
  if (promote) writeFileSync(baselinePath, await stampC2pa(bytes, shot, dims));
  return { slug: shot.slug, format: shot.format, verdict, wrote: promote, bytes: bytes.byteLength };
}

/** RGBA pixels of a raster shot. */
async function decodeShot(sharp: Sharp, bytes: Uint8Array): Promise<RawImage> {
  const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

// ── Vector (svg): print-PDF → engine interpreter, document-compared ──────────

/** Scroll position: 0..1 ⇒ fraction of scrollable height, > 1 ⇒ px (desktop parity). */
function resolveScroll(depth: number, pageH: number, viewportH: number): number {
  const max = Math.max(0, pageH - viewportH);
  const px = depth <= 1 ? Math.max(0, depth) * max : depth;
  return Math.min(Math.max(0, px), max);
}

interface VectorHookResult { svg: string; width: number; height: number; elementCount: number; warnings: string[] }

/**
 * True-vector capture, mirroring the desktop bridge's capture.vector(): print the
 * WHOLE page to a vector PDF, hand it to the app's own loopback tooling hook
 * (window.__lollyVectorShot → lib/pdf-vector-shot.ts: the engine's PDF interpreter
 * + in-page font inlining), then window scroll/crop into viewBox geometry with the
 * engine's windowPdfSvg — a lossless re-framing of the same vectors. No Imprint:
 * a vector has no pixels to watermark; C2PA is the provenance (Andy's call —
 * docs stay content-clean, raster only for performance reasons).
 */
async function captureVector(baseUrl: string, shot: ShotDef): Promise<Uint8Array> {
  const { params, dims } = paramsFor(shot);
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: { width: dims.width, height: dims.height },
    serviceWorkers: 'block',
  });
  try {
    await ctx.addInitScript({ content: CAPTURE_INIT });
    const page = await ctx.newPage();
    await page.goto(baseUrl + shot.route, { waitUntil: 'load', timeout: 45_000 });
    await page.evaluate(() => (document.fonts?.ready ?? Promise.resolve()).then(() => undefined)).catch(() => {});
    const zoomCss = Math.abs((shot.zoom ?? 1) - 1) > 1e-3 ? `html{zoom:${shot.zoom}!important}` : '';
    const styles = [zoomCss, params.css].filter(Boolean).join('\n');
    if (styles) await page.addStyleTag({ content: styles }).catch(() => {});
    if (params.scrollDepth > 0) {
      await page.evaluate((d: number) => {
        const max = Math.max(0, document.body.scrollHeight - window.innerHeight);
        window.scrollTo(0, d > 1 ? d : d * max);
      }, params.scrollDepth).catch(() => {});
    }
    if (params.waitMs > 0) await page.waitForTimeout(Math.min(15_000, params.waitMs));

    // Print the FULL page height as one tall page — scroll/crop trim below, in
    // vector space, exactly like the desktop's capture_page_pdf + windowPdfSvg.
    const pageH = await page.evaluate(() =>
      Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, window.innerHeight));
    const pdf = await page.pdf({
      width: `${dims.width}px`, height: `${Math.max(pageH, dims.height)}px`,
      printBackground: true, pageRanges: '1', margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const res = await page.evaluate(
      (b64: string) => (window as unknown as { __lollyVectorShot?: (b: string) => Promise<VectorHookResult> }).__lollyVectorShot?.(b64),
      Buffer.from(pdf).toString('base64'),
    );
    if (!res) throw new Error('the served shell has no __lollyVectorShot hook — rebuild the dist (main.ts exposes it on loopback)');
    if (!res.elementCount) throw new Error('vector capture produced no drawable content');
    for (const w of res.warnings) console.warn(`  ⚠ ${shot.slug}: ${w}`);

    // Window to the requested region — svg-point space (ratio = svg pts ÷ CSS px).
    const clamp = (n: number | undefined): number => Math.min(0.9, Math.max(0, n ?? 0));
    const cl = clamp(shot.cropLeft), cr = clamp(shot.cropRight);
    const ct = clamp(shot.cropTop), cb = clamp(shot.cropBottom);
    const ratio = res.width / dims.width;
    const scrollY = resolveScroll(params.scrollDepth, pageH, dims.height);
    const clipW = Math.max(1, Math.round(dims.width * (1 - cl - cr)));
    const clipH = Math.max(1, Math.round(dims.height * (1 - ct - cb)));
    const svg = windowPdfSvg(res.svg, {
      x: (cl * dims.width) * ratio,
      y: (scrollY + ct * dims.height) * ratio,
      width: clipW * ratio,
      height: clipH * ratio,
      outWidth: clipW,
      outHeight: clipH,
    });
    return new TextEncoder().encode(svg);
  } finally {
    await ctx.close();
  }
}

async function captureOneVector(baseUrl: string, shot: ShotDef): Promise<ShotResult> {
  let bytes: Uint8Array;
  try {
    bytes = await captureVector(baseUrl, shot);
  } catch (e) {
    return { slug: shot.slug, format: shot.format, error: (e as Error).message, wrote: false, bytes: 0 };
  }

  const { dims } = paramsFor(shot);
  const clamp = (n: number | undefined): number => Math.min(0.9, Math.max(0, n ?? 0));
  const expected = {
    width: Math.max(1, Math.round(dims.width * (1 - clamp(shot.cropLeft) - clamp(shot.cropRight)))),
    height: Math.max(1, Math.round(dims.height * (1 - clamp(shot.cropTop) - clamp(shot.cropBottom)))),
  };
  const newText = new TextDecoder().decode(bytes);
  const baselinePath = join(SHOTS_DIR, `${shot.slug}.${shot.format}`);
  let oldText: string | undefined;
  let oldBytes: number | undefined;
  if (existsSync(baselinePath)) {
    const old = readFileSync(baselinePath);
    oldBytes = old.byteLength;
    oldText = old.toString('utf-8');
  }

  const verdict = classifyVectorShot({ newText, newBytes: bytes.byteLength, expected, oldText, oldBytes });
  const promote = verdict.kind === 'new' || (verdict.kind === 'changed' && opts.accept);
  if (promote) writeFileSync(baselinePath, await stampC2pa(bytes, shot, dims));
  return { slug: shot.slug, format: shot.format, verdict, wrote: promote, bytes: bytes.byteLength };
}

async function imprintRaster(sharp: Sharp, raster: Uint8Array, format: string): Promise<Uint8Array> {
  const { data, info } = await sharp(Buffer.from(raster)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const marked = embedWatermark(new Uint8Array(data), {
    width: info.width,
    height: info.height,
    // png (also the raster inside svg) is lossless → the gentler strength, same
    // as the web shell's export bridge; jpg keeps the robust default.
    strength: format === 'jpg' ? DEFAULT_STRENGTH : LOSSLESS_STRENGTH,
  });
  const img = sharp(Buffer.from(marked), { raw: { width: info.width, height: info.height, channels: 4 } });
  const out = format === 'jpg' ? img.jpeg({ quality: 97 }) : img.png();
  return new Uint8Array(await out.toBuffer());
}

/**
 * Content Credentials for a docs screenshot — the url-shot recipe's parameters
 * ride in the credential (same enrichment path as a CLI url-shot export), so a
 * /verify of the published image shows exactly how to reproduce it.
 */
async function stampC2pa(bytes: Uint8Array, shot: ShotDef, dims: { width: number; height: number; dpi: number }): Promise<Uint8Array> {
  type Model = Parameters<typeof summarizeInputs>[0];
  const row = (id: string, type: string, value: unknown): Record<string, unknown> => ({ id, type, value, isDirty: true, label: id });
  const model = [
    row('url', 'url', shot.route),
    ...(shot.waitMs !== undefined ? [row('waitMs', 'number', shot.waitMs)] : []),
    ...(shot.scrollDepth !== undefined ? [row('scrollDepth', 'number', shot.scrollDepth)] : []),
    ...(shot.zoom !== undefined ? [row('zoom', 'number', shot.zoom)] : []),
    ...(shot.css ? [row('css', 'text', shot.css)] : []),
    ...(['cropTop', 'cropRight', 'cropBottom', 'cropLeft'] as const)
      .filter((k) => shot[k] !== undefined)
      .map((k) => row(k, 'number', shot[k])),
  ] as unknown as Model;
  try {
    return await embedC2pa(bytes, shot.format, buildExportC2paOpts({
      surface: 'docs',
      manifest: { id: 'url-shot', name: 'URL Screenshot' },
      model,
      format: shot.format,
      dims: { width: dims.width, height: dims.height, unit: 'px', dpi: dims.dpi },
      days: 365,
    }));
  } catch (e) {
    console.warn(`⚠  ${shot.slug}: Content Credentials not attached — ${(e as Error).message}`);
    return bytes;
  }
}

// ── Reporting ─────────────────────────────────────────────────────────────────

function reportLine(r: ShotResult): void {
  const name = `${r.slug}.${r.format}`.padEnd(22);
  if (r.error) {
    console.log(`  ✗ ${name} FAILED — ${r.error}`);
    return;
  }
  const v = r.verdict!;
  const kb = `${Math.round(r.bytes / 1024)} KB`;
  const flags = v.flags.length ? `  ⚠ ${v.flags.join(', ')}` : '';
  const px = v.pixelDiff === null ? '' : `${(v.pixelDiff * 100).toFixed(2)}% px`;
  const sz = v.sizeDelta === null ? '' : `${v.sizeDelta >= 0 ? '+' : ''}${Math.round(v.sizeDelta * 100)}% bytes`;
  if (v.kind === 'new') console.log(`  ✚ ${name} new — ${kb}${flags}`);
  else if (v.kind === 'unchanged') console.log(`  ✓ ${name} unchanged (${px})${flags}`);
  else console.log(`  ▲ ${name} CHANGED — ${[px, sz].filter(Boolean).join(', ')}${r.wrote ? ' → accepted' : ''}${flags}`);
}

function summarize(results: ShotResult[]): void {
  const failed = results.filter((r) => r.error || r.verdict?.flags.includes('dims-mismatch'));
  const pending = results.filter((r) => !r.error && r.verdict?.kind === 'changed' && !r.wrote);
  const suspicious = results.filter((r) => r.verdict?.flags.some((f) => f === 'tiny' || f === 'blank' || f === 'size-jump'));

  console.log('');
  console.log(`${results.length} shot(s): ${results.filter((r) => r.verdict?.kind === 'unchanged').length} unchanged, ` +
    `${results.filter((r) => r.wrote).length} written, ${pending.length} pending review, ${failed.length} failed.`);
  if (suspicious.length) {
    console.log(`⚠  possible failed renders (tiny/blank/size-jump): ${suspicious.map((r) => r.slug).join(', ')}`);
  }
  if (pending.length) {
    console.log(`▲  changed vs the committed baselines — review, then promote with:  npm run docs:shots -- --accept`);
    process.exit(2);
  }
  if (failed.length) process.exit(1);
}

// ── Profile pin ───────────────────────────────────────────────────────────────

/**
 * Switch the tools/ + catalog/ views to the neutral capture profile; returns the
 * restore function. Restore rules mirror loldev's do_build: sticky file, else
 * $LOLLY_PROFILE, else profiles.json's default — never silently leave the blank
 * brand pinned on a machine that had chosen another one.
 */
function pinProfile(): () => void {
  const sticky = existsSync(PROFILE_STICKY) ? readFileSync(PROFILE_STICKY, 'utf-8').trim() : '';
  if (sticky !== CAPTURE_PROFILE) {
    console.log(`Pinning the '${CAPTURE_PROFILE}' profile for capture (was: ${sticky || 'unset'})`);
    useProfile(CAPTURE_PROFILE);
  }
  return () => {
    let restore = sticky;
    if (!restore) {
      restore = process.env.LOLLY_PROFILE ?? '';
      if (!restore) {
        try { restore = (JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf-8')) as { default?: string }).default ?? ''; } catch {}
      }
    }
    if (restore && restore !== CAPTURE_PROFILE) {
      console.log(`Restoring the '${restore}' profile`);
      try { useProfile(restore); } catch (e) {
        console.warn(`⚠  couldn't restore profile '${restore}': ${(e as Error).message}`);
      }
    }
  };
}

function useProfile(name: string): void {
  const r = spawnSync(process.execPath, ['scripts/use-profile.ts', name], { cwd: ROOT, stdio: 'pipe' }).status ?? 1;
  if (r !== 0) throw new Error(`use-profile ${name} failed (is the '${name}' pack mounted?)`);
}

/** With --no-build the dist may have been built under another brand — say so. */
function checkDistBrand(): void {
  try {
    const ids = (p: string): string =>
      ((JSON.parse(readFileSync(p, 'utf-8')) as { tools?: Array<{ id?: string }> }).tools ?? [])
        .map((t) => t.id).sort().join(',');
    const dist = ids(join(DIST, 'catalog', 'tools', 'index.json'));
    const view = ids(join(ROOT, 'catalog', 'tools', 'index.json'));
    if (dist !== view) {
      console.warn(`⚠  ${rel(DIST)} was built from a DIFFERENT tool set than the '${CAPTURE_PROFILE}' view — captures will show the wrong brand. Re-run without --no-build.`);
    }
  } catch { /* no catalog in dist — the build will produce one, or captures will fail visibly */ }
}

// ── Browser, build, serve ─────────────────────────────────────────────────────

/**
 * captureUrl resolves the shells' scoped Chromium (.browsers / services/mcp/.browsers /
 * env overrides). When none exists, fall back to the repo's own playwright devDep —
 * the same browser the previews + OG pipelines already use on this machine.
 */
async function ensureBrowserResolvable(): Promise<void> {
  if (process.env.LOLLY_BROWSER_PATH || process.env.LOLLY_BROWSER_CHANNEL || process.env.PLAYWRIGHT_BROWSERS_PATH) return;
  if (existsSync(resolveBrowsersDir())) return;
  try {
    const { chromium } = await import('playwright');
    process.env.LOLLY_BROWSER_PATH = chromium.executablePath();
  } catch {
    // No fallback available — captureUrl's BrowserError says how to install one.
  }
}

async function buildWebShell(): Promise<void> {
  console.log('Building the web shell (vite build)…');
  await new Promise<void>((ok, fail) => {
    const p = spawn('npm', ['--workspace', 'shells/web', 'run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(`vite build exited ${code}`))));
    p.on('error', fail);
  });
}

interface ServeHandle { port: number; close: () => Promise<void> }

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
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.map': 'application/json; charset=utf-8',
};

/** Static dist server with SPA fallback — same shape as build-previews' serveDist. */
async function serveDist(): Promise<ServeHandle> {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]!);
      let filePath = resolve(DIST, '.' + normalize(urlPath));
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
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok as () => void));
  const port = (server.address() as AddressInfo).port;
  return { port, close: () => new Promise<void>((ok) => server.close(() => ok())) };
}

function rel(p: string): string {
  return p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p;
}
