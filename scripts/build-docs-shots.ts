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
 *   --rebuild      full refresh: rebuild the shell, re-shoot EVERY recipe, write
 *                  every baseline (even unchanged ones) and prune retired files.
 *                  Implies --accept. Use after a renderer/engine change.
 *   --only=a,b     limit to these filenames
 *   --url=...      capture against a running server (skips profile pin + build + serve)
 *   --no-build     reuse shells/web/dist (still pins the profile for the view check)
 *   --list         print every recipe found in the docs, then exit
 *
 * Exit codes: 0 clean · 1 failures · 2 changes pending review (gtg warns, proceeds).
 */

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
  DEFAULT_THRESHOLDS, MAX_SHOT_PX, clampDpr, classifyShot, classifyVectorShot,
  ineffectiveTolerance, parseShotRecipes,
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
  /** Force a full refresh: rebuild the shell, re-capture EVERY recipe, and write
   *  every baseline even when the bytes are unchanged, then prune baselines no
   *  recipe claims any more. Implies --accept. This is the "the renderer changed,
   *  redo the lot" button — after an engine fix, `unchanged` verdicts are not
   *  something to preserve, they are something to overwrite. */
  rebuild: boolean;
  list: boolean;
  noBuild: boolean;
  url: string | null;
  only: string[];
  /** Locales to ALSO capture for every `localize=1` recipe (`--lang=es,de`). Each
   *  is rendered with `?lang=<loc>` injected → `<slug>.<loc>.<format>`; English is
   *  always captured. Empty = English only (the default, so a plain run stays fast). */
  locales: string[];
}

function parseOpts(argv: string[]): Opts {
  const o: Opts = { accept: false, rebuild: false, list: false, noBuild: false, url: null, only: [], locales: [] };
  for (const a of argv) {
    if (a === '--accept') o.accept = true;
    else if (a === '--rebuild') { o.rebuild = true; o.accept = true; }
    else if (a === '--list') o.list = true;
    else if (a === '--no-build') o.noBuild = true;
    else if (a.startsWith('--url=')) o.url = a.slice(6);
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--lang=')) o.locales = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else console.warn(`⚠  ignoring unknown option ${a}`);
  }
  return o;
}

/** Inject `?lang=<loc>` into an app route's hash query so the shell renders in that
 *  locale (peekUrlLang reads the hash query). Appends with `&` when a query exists. */
function localizeRoute(route: string, lang: string): string {
  return `${route}${route.includes('?') ? '&' : '?'}lang=${lang}`;
}

/** Committed baseline filename: `<slug>.<format>`, or `<slug>.<lang>.<format>` for a
 *  per-locale variant. The single source of truth for the on-disk shot path. */
function shotFileName(shot: ShotDef): string {
  return `${shot.slug}${shot.lang ? `.${shot.lang}` : ''}.${shot.format}`;
}

interface ShotResult {
  slug: string;
  format: string;
  lang?: string;
  verdict?: ShotVerdict;
  error?: string;
  wrote: boolean;
  bytes: number;
  /** Device-pixel width of the capture — reported when a weight flag fires. */
  width?: number;
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

  const moot = ineffectiveTolerance(shots);
  if (moot.length) {
    console.warn(`\u26a0  tolerance= has no effect on a vector shot (they compare exactly, not by pixels): ${moot.join(', ')}`);
    console.warn('   Freeze or hide the moving part with css= instead, or capture it as png.');
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

    await preflightNeutralState(baseUrl, shots);

    mkdirSync(SHOTS_DIR, { recursive: true });
    const sharp = (await import('sharp')).default;

    for (const shot of shots) {
      const r = await captureOne(sharp, baseUrl, shot);
      results.push(r);
      reportLine(r);
      // Per-locale variants: same recipe, `?lang=<loc>` injected into the route,
      // written to `<slug>.<loc>.<format>`. Only for recipes that opted in.
      if (shot.localize && opts.locales.length) {
        for (const lang of opts.locales) {
          const variant: ShotDef = { ...shot, route: localizeRoute(shot.route, lang), lang };
          const rv = await captureOne(sharp, baseUrl, variant);
          results.push(rv);
          reportLine(rv);
        }
      }
    }
  } finally {
    // getBrowser()'s Chromium is shared across captures and would otherwise hold
    // the event loop open past the summary (the CLI leans on process exit for this).
    await closeBrowser();
    if (server) await server.close();
    restoreProfile?.();
  }

  warnOrphans(allShots, opts.rebuild && !opts.only.length); // FULL set — an --only run must not cry (or prune) orphan
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

/** The locales a page can be published in (docs/i18n/<loc>/). A `localize=1` recipe
 *  may have a committed `<slug>.<loc>.<format>` for any of these, so those are not
 *  orphans even on a plain (English-only) run. */
function knownLocales(): string[] {
  const dir = join(DOCS_DIR, 'i18n');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
}

/** Baselines on disk that no recipe declares any more — stale, safe to delete. */
/** Baselines on disk that no recipe claims. Warned about on a normal run; DELETED
 *  under --rebuild, because a full refresh that leaves the retired files behind
 *  would ship them forever (a recipe that changes format, e.g. png -> svg, orphans
 *  its old file and every localised sibling). */
function warnOrphans(shots: ShotDef[], prune = false): void {
  if (!existsSync(SHOTS_DIR)) return;
  const locales = knownLocales();
  const expected = new Set<string>();
  for (const s of shots) {
    expected.add(`${s.slug}.${s.format}`);
    if (s.localize) for (const loc of locales) expected.add(`${s.slug}.${loc}.${s.format}`);
  }
  const orphans = readdirSync(SHOTS_DIR).filter((f) => /\.(svg|png|jpg)$/.test(f) && !expected.has(f));
  if (!orphans.length) return;
  if (prune) {
    for (const f of orphans) rmSync(join(SHOTS_DIR, f), { force: true });
    console.log(`  ✂ pruned ${orphans.length} orphan baseline(s): ${orphans.join(', ')}`);
  } else {
    console.warn(`⚠  orphan baselines (no recipe declares them — delete from ${rel(SHOTS_DIR)}): ${orphans.join(', ')}`);
  }
}

// ── Capture, imprint, classify, credential ────────────────────────────────────

type Sharp = typeof import('sharp').default;

function paramsFor(shot: ShotDef): { params: Omit<CaptureParams, 'url'>; dims: { width: number; height: number; dpi: number } } {
  return {
    params: {
      scrollDepth: shot.scrollDepth ?? 0,
      waitMs: shot.waitMs ?? 1_000,
      waitSelector: shot.waitSelector,
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
    dims: clampDims({
      width: shot.width ?? VIEWPORT_DEFAULTS.width,
      height: shot.height ?? VIEWPORT_DEFAULTS.height,
      dpi: shot.dpi ?? VIEWPORT_DEFAULTS.dpi,
    }, shot),
  };
}

/**
 * Cap the effective density so no baseline is wider than a reader can ever see
 * (MAX_SHOT_PX — the /info column is 848 CSS px, so 1700-odd device px at DPR 2).
 *
 * Applied HERE because `paramsFor` is the one source of `dims` for the capture, for
 * `expectedDims`, and for the C2PA provenance stamp, so a single clamp keeps all
 * three consistent. It reads the POST-crop width: `captureOne` resolves a
 * `cropSelector` into explicit insets before any capture path runs, so a recipe
 * that crops to the area of focus keeps its full 2x, and only a wide frame gives
 * density back. Vector shots are unaffected (dpi is raster-only), and
 * `resolveSelectorCrop` forces DPR 1 itself, so the clamp is inert there.
 */
function clampDims(
  dims: { width: number; height: number; dpi: number },
  shot: ShotDef,
): { width: number; height: number; dpi: number } {
  // Local inset clamp (same rule as clampInset below, inlined so this doesn't
  // depend on a const declared later in a module whose main() starts eagerly).
  const inset = (n: number | undefined): number => Math.min(0.9, Math.max(0, n ?? 0));
  const clipW = dims.width * (1 - inset(shot.cropLeft) - inset(shot.cropRight));
  const dpr = clampDpr(dims.dpi, clipW);
  // FLOOR, not round: the capture recomputes dpr from this dpi, so rounding up
  // hands back the fraction the clamp just took away (a 901.5px clip clamped to
  // 1.9967 rounded to 192dpi = dpr 2 again = 1803px, three pixels over the cap and
  // flagged 'over-scale' by the very budget this is meant to satisfy).
  return { ...dims, dpi: Math.floor(96 * dpr) };
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
// gallery-route deep-link like `?tool=` or `?history`) and the privacy notice
// (it floats above the gallery footer, over the very tiles a gallery shot is
// framing). Keys mirror shells/web/src/components/welcome-dialog.ts
// (WELCOME_/TIPS_DISMISSED_KEY) and views/privacy-notice.ts (ACK_KEY) — stable
// localStorage contracts, same tier as the theme flag.
//
// Then the NEUTRAL-STATE pin (lib/capture-neutral.ts): a published screenshot
// must show the app's plain chrome. A fresh browser context covers most of that
// for free, but a default is not the same as absent — `jelly-effects` defaults
// ON for an unlocked brand, which is precisely the `lolly-start` profile these
// captures pin, so the soft-body controls were in every baseline by default. The
// app cannot honour a seeded flag mirror (hydrateFeatureFlags rewrites it from
// the profile at boot), so it reads this one key after hydration instead and
// forces the effect flags off + the a11y attributes clear. Set for EVERY shot
// centrally: "shots are taken with effects off" is a rule about the pipeline, not
// something 134 recipes should each have to remember.
const CAPTURE_NEUTRAL_KEY = 'lolly-capture-neutral';
const CAPTURE_INIT =
  "try{localStorage.setItem('lolly-welcome-dismissed','1');" +
  "localStorage.setItem('lolly-tips-dismissed','1');" +
  "localStorage.setItem('lolly-privacy-ack','1');" +
  `localStorage.setItem('${CAPTURE_NEUTRAL_KEY}','1')}catch(_){}`;

// The other half of neutral state isn't storage and can't be seeded: the OS-level
// preference media queries. `prefers-color-scheme` picks the theme before any app
// code runs, and `prefers-reduced-motion` / `forced-colors` are read by the same
// CSS blocks the a11y prefs extend (styles/parts/base.css, styles/tokens.css), so
// a build machine set to dark mode or high contrast would silently publish a
// different-looking baseline. Pinned on the context, so both capture paths (raster
// and vector) inherit one answer.
const CAPTURE_CONTEXT = {
  colorScheme: 'light',
  reducedMotion: 'no-preference',
  forcedColors: 'none',
} as const;

/**
 * In-page assertion that the pinned neutral state actually TOOK. Evaluated once
 * per run against the gallery and the first tool route among the shots; returns a
 * list of violations, and any violation fails the run.
 *
 * The pin verifies its own mechanism (a unit test covers the flag mirror and the
 * a11y attributes), but not the OUTCOME: if the jelly gate ever stops reading the
 * mirror, or a new first-run overlay ships, the pin becomes a silent no-op and the
 * next `--rebuild` quietly publishes non-neutral chrome across every baseline.
 * This asks the rendered page instead — are there jelly elements, is an overlay
 * up, is an a11y attribute stamped — which is the thing the rule is actually about.
 */
const NEUTRAL_PROBE = `(() => {
  const bad = [];
  const d = document.documentElement.dataset;
  if (d.a11yMotion || d.a11yContrast || d.a11yText) bad.push('a11y preference active: ' + [d.a11yMotion, d.a11yContrast, d.a11yText].filter(Boolean).join(' '));
  const jelly = document.querySelector('jelly-button,jelly-switch,jelly-input,jelly-checkbox,jelly-segmented');
  if (jelly) bad.push('jelly elements in the DOM (<' + jelly.tagName.toLowerCase() + '>)');
  if (document.documentElement.hasAttribute('data-jelly-nav')) bad.push('data-jelly-nav stamped on <html>');
  if (document.querySelector('.privacy-notice')) bad.push('privacy notice showing');
  if (document.querySelector('.welcome-dialog')) bad.push('welcome dialog open');
  if (document.querySelector('.brand-tips')) bad.push('tips strip showing');
  if (document.querySelector('.tool-guide-steps')) bad.push('tool guide auto-opened');
  // Asked of the RENDERED page, not of a flag: flagEnabledSync consults an
  // in-memory override before the pinned mirror (lib/neuro-demo.ts uses it so a
  // demo link can enable the mode for one page load), so no flag-layer pin can
  // promise the dock is absent. Its presence in the DOM is what would actually
  // land in a baseline.
  if (document.getElementById('neuro-dock')) bad.push('Neurospicy dock mounted');
  return bad;
})()`;

/**
 * Load a couple of representative routes and fail the run if the chrome isn't
 * neutral. Two page loads per RUN, not per shot. The tool route is checked
 * separately because the guide modal and the sidebar's jelly controls only exist
 * there — a gallery-only check would miss both.
 */
async function preflightNeutralState(baseUrl: string, shots: ShotDef[]): Promise<void> {
  const routes = ['/#/'];
  const toolRoute = shots.find((s) => s.route.includes('/tool/'))?.route;
  if (toolRoute) routes.push(toolRoute);
  // The profile view decides jelly from the CANONICAL profile (not the pinned
  // mirror), so it needs its own probe — this is the route where the pin once
  // silently failed to reach the rendered page.
  routes.push('/#/profile');

  const browser = await getBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', ...CAPTURE_CONTEXT });
  try {
    await ctx.addInitScript({ content: CAPTURE_INIT });
    const page = await ctx.newPage();
    for (const route of routes) {
      await page.goto(baseUrl + route, { waitUntil: 'load', timeout: 45_000 });
      await page.evaluate(() => (document.fonts?.ready ?? Promise.resolve()).then(() => undefined)).catch(() => {});
      await page.waitForTimeout(1_500);
      const bad = (await page.evaluate(NEUTRAL_PROBE)) as string[];
      if (bad.length) {
        throw new Error(`capture state is not neutral on ${route}: ${bad.join('; ')}`
          + ' — the shell may predate lib/capture-neutral.ts (rebuild the dist), or the pin no longer reaches it.');
      }
    }
    console.log(`Capture state verified neutral (${routes.join(', ')})`);
  } finally {
    await ctx.close();
  }
}

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
  const ctx = await browser.newContext({
    viewport: { width: dims.width, height: dims.height }, deviceScaleFactor: 1,
    serviceWorkers: 'block', ...CAPTURE_CONTEXT,
  });
  try {
    await ctx.addInitScript({ content: CAPTURE_INIT });
    const page = await ctx.newPage();
    await page.goto(baseUrl + shot.route, { waitUntil: 'load', timeout: 45_000 });
    await page.evaluate(() => (document.fonts?.ready ?? Promise.resolve()).then(() => undefined)).catch(() => {});
    if (params.css) await page.addStyleTag({ content: params.css }).catch(() => {});
    // waitMs FIRST, scroll after: an SPA route lays out well after `load`, so a
    // scroll issued immediately clamps against a 0-height document and the frame
    // silently stays at the top (found via the inclusive-design mobile shots).
    // The short settle lets scroll-triggered lazy rendering (content-visibility,
    // reveal observers) paint before measurement/capture.
    if (params.waitMs > 0) await page.waitForTimeout(Math.min(15_000, params.waitMs));
    // waitSelector: the deterministic settle — block until the page says it is
    // ready (e.g. the ?neuro demo's data-demo-settled) instead of guessing wall
    // clock. Applied here too so the measured crop box sees the same final state.
    if (shot.waitSelector) await page.waitForSelector(shot.waitSelector, { state: 'attached', timeout: 60_000 });
    if (params.scrollDepth > 0) {
      // Retry until the scroll actually TOOK: late layout (locale re-render,
      // reveal observers, content-visibility) can grow the document after the
      // scroll and snap it back, so assert scrollY against the recomputed target.
      for (let attempt = 0; attempt < 10; attempt++) {
        const settled = await page.evaluate((d: number) => {
          const max = Math.max(0, document.body.scrollHeight - window.innerHeight);
          const target = Math.min(max, d > 1 ? d : d * max);
          window.scrollTo(0, target);
          return Math.abs(window.scrollY - target) < 4 && (d <= 1 || max >= d || max === 0);
        }, params.scrollDepth).catch(() => true);
        await page.waitForTimeout(300);
        if (settled && attempt >= 2) break;
      }
    }

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
    ({ bytes } = await captureUrl(
      { ...params, url: baseUrl + shot.route, initScript: CAPTURE_INIT, contextPrefs: CAPTURE_CONTEXT },
      shot.format, dims,
    ));
    // The Lolly Imprint goes in BEFORE the compare: embedWatermark is a fixed,
    // deterministic pattern, so identical captures stay pixel-identical run to run
    // and the baseline's pixels already carry the mark.
    bytes = await imprintRaster(sharp, bytes, shot.format);
  } catch (e) {
    return { slug: shot.slug, format: shot.format, error: (e as Error).message, wrote: false, bytes: 0 };
  }

  const newImg = await decodeShot(sharp, bytes);
  const baselinePath = join(SHOTS_DIR, shotFileName(shot));
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

  const promote = opts.rebuild || verdict.kind === 'new' || (verdict.kind === 'changed' && opts.accept);
  // Content Credentials only on a real (re)write: the C2PA signature carries a
  // timestamp, so stamping every run would churn bytes for unchanged pixels.
  if (promote) writeFileSync(baselinePath, await stampC2pa(bytes, shot, dims));
  return {
    slug: shot.slug, format: shot.format, lang: shot.lang, verdict,
    wrote: promote, bytes: bytes.byteLength, width: newImg.width,
  };
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

interface VectorHookResult {
  svg: string; width: number; height: number; elementCount: number; warnings: string[];
  culled?: { total: number; dropped: number; unbounded: number };
}

/** A crop inset fraction, clamped exactly as captureUrl / expectedDims clamp it. */
const clampInset = (n: number | undefined): number => Math.min(0.9, Math.max(0, n ?? 0));

/**
 * The region a vector shot actually keeps, in CSS pixels of the FULL printed page
 * (scroll offset folded into y). ONE rect, used for two things: the cull hint the
 * app-side interpreter gets (so it never decodes the rasters and tiles outside it),
 * and — scaled by the measured pt/px ratio — the windowPdfSvg viewBox. Deriving
 * both from one helper is what stops the optimisation and the authoritative crop
 * from ever describing different rectangles.
 */
function vectorCropCssPx(
  shot: ShotDef,
  dims: { width: number; height: number },
  pageH: number,
  scrollDepth: number,
): { x: number; y: number; width: number; height: number } {
  const cl = clampInset(shot.cropLeft), cr = clampInset(shot.cropRight);
  const ct = clampInset(shot.cropTop), cb = clampInset(shot.cropBottom);
  return {
    x: cl * dims.width,
    y: resolveScroll(scrollDepth, pageH, dims.height) + ct * dims.height,
    width: Math.max(1, Math.round(dims.width * (1 - cl - cr))),
    height: Math.max(1, Math.round(dims.height * (1 - ct - cb))),
  };
}

/**
 * True-vector capture, mirroring the desktop bridge's capture.vector(): print the
 * WHOLE page to a vector PDF, hand it to the app's own loopback tooling hook
 * (window.__lollyVectorShot → lib/pdf-vector-shot.ts: the engine's PDF interpreter
 * + in-page font inlining), then window scroll/crop into viewBox geometry with the
 * engine's windowPdfSvg — a lossless re-framing of the same vectors. No Imprint:
 * a vector has no pixels to watermark; C2PA is the provenance (Andy's call —
 * docs stay content-clean, raster only for performance reasons).
 */
type VectorCapture = { bytes: Uint8Array; framed: { width: number; height: number } | null };

async function captureVector(baseUrl: string, shot: ShotDef): Promise<VectorCapture> {
  const { params, dims } = paramsFor(shot);
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: { width: dims.width, height: dims.height },
    serviceWorkers: 'block',
    ...CAPTURE_CONTEXT,
  });
  try {
    await ctx.addInitScript({ content: CAPTURE_INIT });
    const page = await ctx.newPage();
    await page.goto(baseUrl + shot.route, { waitUntil: 'load', timeout: 45_000 });
    await page.evaluate(() => (document.fonts?.ready ?? Promise.resolve()).then(() => undefined)).catch(() => {});
    const zoomCss = Math.abs((shot.zoom ?? 1) - 1) > 1e-3 ? `html{zoom:${shot.zoom}!important}` : '';
    const styles = [zoomCss, params.css].filter(Boolean).join('\n');
    if (styles) await page.addStyleTag({ content: styles }).catch(() => {});
    // waitMs FIRST, scroll after: an SPA route lays out well after `load`, so a
    // scroll issued immediately clamps against a 0-height document and the frame
    // silently stays at the top (found via the inclusive-design mobile shots).
    // The short settle lets scroll-triggered lazy rendering (content-visibility,
    // reveal observers) paint before measurement/capture.
    if (params.waitMs > 0) await page.waitForTimeout(Math.min(15_000, params.waitMs));
    // waitSelector: the deterministic settle — block until the page says it is
    // ready (e.g. the ?neuro demo stamps data-demo-settled once its fixed frame
    // sequence has rendered) instead of guessing how fast this machine's GL is.
    if (shot.waitSelector) await page.waitForSelector(shot.waitSelector, { state: 'attached', timeout: 60_000 });
    if (params.scrollDepth > 0) {
      // Retry until the scroll actually TOOK: late layout (locale re-render,
      // reveal observers, content-visibility) can grow the document after the
      // scroll and snap it back, so assert scrollY against the recomputed target.
      for (let attempt = 0; attempt < 10; attempt++) {
        const settled = await page.evaluate((d: number) => {
          const max = Math.max(0, document.body.scrollHeight - window.innerHeight);
          const target = Math.min(max, d > 1 ? d : d * max);
          window.scrollTo(0, target);
          return Math.abs(window.scrollY - target) < 4 && (d <= 1 || max >= d || max === 0);
        }, params.scrollDepth).catch(() => true);
        await page.waitForTimeout(300);
        if (settled && attempt >= 2) break;
      }
    }

    // M5: the walker path. Ask the shell to serialise the live DOM itself rather
    // than round-tripping through Chromium's PDF printer. The crop is applied by
    // scoping the walk to cropSelector's element (the walker takes a selector), so
    // there is no PDF window step and no cull — what is walked IS the frame.
    if (shot.walker) {
      const sel = shot.cropSelector || 'body';
      // A6: with no cropSelector the walked node is `body` — an unstyled
      // content-height block, so the frame would be 1440 x full document height
      // with the fixed chrome floating mid-image. Window the walk to the
      // recipe's width x height in CSS px instead (the walker works in CSS px,
      // so no dpi arithmetic applies), culling every drawable that lies fully
      // outside. NOTE: assumes scrollDepth=0 for windowed body walks — fixed
      // chrome is emitted at viewport coordinates, which only coincide with the
      // window at scroll 0; no current recipe combines walker+nocrop+scroll.
      //
      // A cropSelector walk is windowed too, but only where the element OVERFLOWS the
      // recipe frame — the clamp below no-ops when it already fits, which is every
      // selector recipe committed today. Without it the walker read `cropSelector` as
      // "walk this subtree entire" while the print path had always meant "frame this",
      // so a tall element silently published at its own full height: the swatches group
      // went out at 1400x2256 where print gave 1440x852, blowing the weight budget with
      // 51 chips nobody can read in an 848px column. width/height drive layout via the
      // viewport either way (the context above) — what changes here is only whether
      // they also bound the OUTPUT frame.
      const win = { w: dims.width, h: dims.height };
      // Walk, then AUDIT the result in-page. The print path has elementCount,
      // warnings and a cull report; the walker had `svg.length < 64` and nothing
      // else, which is how a large file of invalid XML could be written, sized and
      // committed as a baseline (plans/svg-snapshot-without-print.md §2.1c). The
      // audit is pure string/DOM inspection of what the walker already returned —
      // it needs no change to renderSvgFromHtml or to the shipping loopback hook.
      const out = await page.evaluate(
        async ({ s, win }: { s: string; win: { w: number; h: number } | null }) => {
          const hook = (window as unknown as {
            __lollyWalkerShot?: (sel?: string, o?: Record<string, unknown>) => Promise<{ svg: string; ms: number }>;
          }).__lollyWalkerShot;
          if (!hook) return null;
          // Paint the page's own backdrop onto the crop root before walking, when
          // the root does not already have one. The print path gets this free via
          // printBackground:true; the walker paints only per-element
          // background-color, so cropping to a panel that inherits its backdrop
          // (#tool-inputs, .be-* and 33 others measured) yields a TRANSPARENT shot
          // — invisible against /info's dark theme. Using body's resolved colour
          // reproduces what the reader actually sees behind that element, rather
          // than inventing white.
          const target = document.querySelector(s) as HTMLElement | null;
          let painted = '';
          if (target) {
            const own = getComputedStyle(target).backgroundColor;
            const isClear = !own || own === 'transparent'
              || (/^rgba\(/.test(own) && parseFloat(own.split(',')[3] as string) < 0.99);
            if (isClear) {
              const pageBg = getComputedStyle(document.body).backgroundColor
                || getComputedStyle(document.documentElement).backgroundColor;
              if (pageBg && pageBg !== 'transparent') {
                painted = target.style.backgroundColor;
                target.style.backgroundColor = pageBg;
              }
            }
          }
          const r = await hook(s);
          if (target && painted !== '') target.style.backgroundColor = painted;
          else if (target) target.style.removeProperty('background-color');
          if (!r?.svg) return null;

          // Origin of the walker's ROOT coordinate space, in viewport coords.
          // renderSvgFromHtml emits every node relative to the walked node's
          // border-box top-left, so root (0,0) IS that corner. A negative
          // component means part of the node sits above/left of the fold — which
          // is exactly the band the reader cannot see, and exactly what a
          // top-anchored window would otherwise publish instead of the visible one.
          // Read from the node itself rather than window.scrollY: body{margin:0}
          // makes them equal today, but a collapsed margin on a first child would
          // put them wildly apart and frame the wrong region.
          //
          // Latent across the whole corpus as of 2026-07-31 — a --rebuild of all 140
          // shots moved zero viewBoxes, so the plan's claim that three shipped shots
          // are already mis-anchored is refuted. The reason is that the stages centre
          // with `place-items: center`, and an oversized GRID item pins to the
          // container's top-left under the scroll-container safe-overflow rule
          // (documented at shells/web/src/styles/parts/catalog.css:669-672), giving
          // rect.top = 0. Measured in Chromium: grid -> top 0, flex
          // align-items:center -> top -554.5 for a 944x2009 child in a 900 viewport.
          // So this guards flex/absolutely-centred overflow, and the day a stage
          // switches away from grid it keeps framing the band the reader sees.
          const originRect = (target ?? document.body).getBoundingClientRect();
          const off = { x: Math.max(0, -originRect.left), y: Math.max(0, -originRect.top) };

          // Parse failure is the catastrophic-and-silent case: a well-sized file
          // that no renderer can open.
          let doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
          const parseErr = doc.querySelector('parsererror')?.textContent?.trim().slice(0, 200) ?? '';

          const DRAWABLE = 'path,rect,circle,ellipse,line,polyline,polygon,text,image,use';
          const hrefs = [...doc.querySelectorAll('image')]
            .map((n) => n.getAttribute('href') || n.getAttribute('xlink:href') || '');

          // Is the framed area actually painted? The print path uses
          // printBackground:true so every baseline is opaque; the walker paints only
          // per-element background-color, and a crop root with no background rule
          // yields a transparent shot — which reads as an empty rounded box against
          // /info's dark theme. Read the walked element's own computed backdrop.
          // Ask the OUTPUT, not the element: a crop root can be transparent while
          // its first child paints the whole frame (the qr tool's own #fafbfe rect
          // is exactly that), so reading only the computed style cries wolf. A
          // covering rect in the emitted SVG is the thing that actually matters.
          const root = doc.documentElement;
          const vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
          const fw = vb.length === 4 ? (vb[2] as number) : 0;
          const fh = vb.length === 4 ? (vb[3] as number) : 0;
          const covers = [...doc.querySelectorAll('rect')].some((r) => {
            // Fill can arrive as an attribute OR inside style="" — the svg-rooted
            // passthrough clones a tool's own markup verbatim, and tools commonly
            // write `style="fill:#fafbfe"`. Reading only the attribute missed it.
            const f = (r.getAttribute('fill')
              || /(?:^|;)\s*fill\s*:\s*([^;]+)/.exec(r.getAttribute('style') || '')?.[1]
              || '').trim();
            if (!f || f === 'none' || /^(transparent|rgba\([^)]*,\s*0(\.0+)?\))$/.test(f)) return false;
            const x = parseFloat(r.getAttribute('x') || '0'), y = parseFloat(r.getAttribute('y') || '0');
            const w = parseFloat(r.getAttribute('width') || '0'), h = parseFloat(r.getAttribute('height') || '0');
            return x <= 0.5 && y <= 0.5 && fw > 0 && w >= fw - 1 && h >= fh - 1;
          });
          const el = document.querySelector(s);
          const bg = el ? getComputedStyle(el).backgroundColor : '';
          const elOpaque = /^rgba?\(/.test(bg)
            ? (bg.split(',').length < 4 || parseFloat(bg.split(',')[3] as string) > 0.99)
            : Boolean(bg && bg !== 'transparent');
          const opaque = covers || elOpaque;

          // A6 windowing: crop the body walk to the recipe frame. Mount the
          // parsed SVG (hidden, natural size) so getBoundingClientRect gives
          // every drawable's user-space box, drop the ones fully outside the
          // window, then rewrite the root frame. Definition subtrees
          // (defs/clipPath/pattern/mask/symbol) are never culled — a <use> or
          // clip inside the window may reference ink whose source rect is not.
          let winDropped = 0;
          let framed: { width: number; height: number } | null = null;
          let anchored: { x: number; y: number } | null = null;
          if (win && !parseErr) {
            const rootEl = doc.documentElement;
            const natW = vb.length === 4 ? (vb[2] as number) : parseFloat(rootEl.getAttribute('width') || '0');
            const natH = vb.length === 4 ? (vb[3] as number) : parseFloat(rootEl.getAttribute('height') || '0');
            // Window to the SMALLER of the two on each axis: the recipe frame bounds an
            // overflowing element, while an element smaller than the frame keeps its own
            // box rather than being padded out to the viewport. Only the CULL is
            // conditional — the frame rewrite below always runs, because it also
            // normalises the root to bare numbers, which is the form svgRootSize (the
            // dims-mismatch guard) can parse. Skipping it for a shot that exactly fits
            // left the walker's native `width="1440px"` in place and failed that guard.
            const winW = Math.min(win.w, natW), winH = Math.min(win.h, natH);
            // Slide the window down/right to the visible band, then clamp inside the
            // walked box so it is always a sub-rect of real content (hence no
            // transparent ring). Mirrors walkerWindow() in lib/shot-compare.ts, which
            // is the unit-tested statement of this arithmetic.
            const wx = Math.min(Math.max(0, off.x), Math.max(0, natW - winW));
            const wy = Math.min(Math.max(0, off.y), Math.max(0, natH - winH));
            // Reframe when the window is smaller than the box on either axis OR is
            // offset into it. Testing size alone missed the offset case — the defect.
            const overflows = winW < natW - 0.5 || winH < natH - 0.5 || wx > 0.5 || wy > 0.5;
            const mountBox = document.createElement('div');
            mountBox.style.cssText = `position:absolute;left:-100000px;top:0;visibility:hidden;width:${natW}px;height:${natH}px;overflow:hidden`;
            const live = document.importNode(rootEl, true) as unknown as SVGSVGElement;
            live.setAttribute('width', String(natW));
            live.setAttribute('height', String(natH));
            mountBox.appendChild(live);
            if (overflows) document.body.appendChild(mountBox);
            try {
              if (overflows) {
                const origin = live.getBoundingClientRect();
                const doomed: Element[] = [];
                for (const el of live.querySelectorAll(DRAWABLE)) {
                  if (el.closest('defs,clipPath,pattern,mask,symbol')) continue;
                  const b = el.getBoundingClientRect();
                  const x0 = b.left - origin.left, y0 = b.top - origin.top;
                  if (x0 >= wx + winW || y0 >= wy + winH
                      || x0 + b.width <= wx || y0 + b.height <= wy) doomed.push(el);
                }
                for (const el of doomed) el.remove();
                winDropped = doomed.length;
              }
              framed = { width: Math.round(winW), height: Math.round(winH) };
              anchored = wx > 0.5 || wy > 0.5 ? { x: Math.round(wx), y: Math.round(wy) } : null;
              live.setAttribute('viewBox', `${Math.round(wx * 100) / 100} ${Math.round(wy * 100) / 100} ${winW} ${winH}`);
              // Bare numbers: svgRootSize (the dims-mismatch guard) parses width="1440",
              // and the print path emits the same form.
              live.setAttribute('width', String(winW));
              live.setAttribute('height', String(winH));
              const xml = new XMLSerializer().serializeToString(live);
              const redoc = new DOMParser().parseFromString(xml, 'image/svg+xml');
              if (!redoc.querySelector('parsererror')) {
                r.svg = xml.startsWith('<?xml') ? xml : `<?xml version="1.0" standalone="no"?>\n${xml}`;
                doc = redoc;
              }
            } finally { mountBox.remove(); }
          }

          return {
            svg: r.svg,
            parseErr,
            drawables: doc.querySelectorAll(DRAWABLE).length,
            texts: doc.querySelectorAll('text').length,
            externalHrefs: hrefs.filter((h) => !h.startsWith('data:') && !h.startsWith('#')),
            opaque,
            winDropped,
            // The frame we INTENDED to publish. Deliberately not re-read off the
            // root: the serialise/re-parse above silently keeps the unwindowed svg
            // when the rewrite produces bad XML, and reporting the root back would
            // make that failure agree with itself. Stating the intent instead turns
            // it into a dims-mismatch, which is fatal.
            framed,
            anchored,
          };
        },
        { s: sel, win },
      );
      if (!out) throw new Error('the served shell has no __lollyWalkerShot hook — rebuild the dist (main.ts exposes it on loopback)');
      if (out.parseErr) throw new Error(`walker produced invalid XML for ${sel}: ${out.parseErr}`);
      if (!out.drawables) throw new Error(`walker capture produced no drawable content for ${sel}`);
      if (out.externalHrefs.length) {
        // A fetchable href renders BLANK inside `<img src="shot.svg">` (secure
        // static mode, no network). Every src should now inline — see the <img>
        // branch in export.ts — so reaching here means a scheme slipped through.
        throw new Error(`walker left ${out.externalHrefs.length} non-inlined image href(s), `
          + `first: ${out.externalHrefs[0]} — the shot would not be self-contained`);
      }
      // Warn, never fail: <text> is a DESIGNED fallback for a font the outliner
      // cannot resolve, and five committed print baselines already carry 145 such
      // nodes. A new one is worth a look, not a broken build.
      // Loud on purpose: the anchor slide is latent across the whole corpus today
      // (every walker viewBox is 0,0), so the first recipe that trips it should say
      // so rather than quietly publishing a different band than the previous run.
      if (out.anchored) console.log(`    ⌖ ${shot.slug}: window anchored to the visible band at ${out.anchored.x},${out.anchored.y} (element overflows the frame)`);
      if (out.winDropped) console.log(`    ✂ ${shot.slug}: windowed ${shot.cropSelector ? `${shot.cropSelector} walk` : 'body walk'} culled ${out.winDropped} off-frame node(s)`);
      if (out.texts) console.warn(`  ⚠ ${shot.slug}: ${out.texts} <text> node(s) — a font did not outline`);
      if (!out.opaque) console.warn(`  ⚠ ${shot.slug}: "${sel}" has no opaque background — the shot may read as an empty box on /info's dark theme (add &css= to paint one)`);
      return { bytes: new TextEncoder().encode(out.svg), framed: out.framed };
    }

    // Print the FULL page height as one tall page — scroll/crop trim below, in
    // vector space, exactly like the desktop's capture_page_pdf + windowPdfSvg.
    const pageH = await page.evaluate(() =>
      Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, window.innerHeight));
    const pdf = await page.pdf({
      width: `${dims.width}px`, height: `${Math.max(pageH, dims.height)}px`,
      printBackground: true, pageRanges: '1', margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    // The crop, in CSS px of the printed page — the cull hint AND (scaled) the
    // window, from one helper so they can't drift.
    const crop = vectorCropCssPx(shot, dims, pageH, params.scrollDepth);
    const cropped = crop.width < dims.width || crop.height < dims.height || crop.x > 0 || crop.y > 0;

    // The hook is registered inside main.ts's async boot(), AFTER `await
    // createBridge()` — it closes over the host's text shaper, which is the whole
    // reason outlining works. So it appears some way past `load`, and a shot whose
    // page settles quickly can reach here first. Wait for it rather than reading
    // its absence as a stale dist: that diagnosis sent the last build chasing a
    // rebuild for what is a race. A real timeout still says the dist is the
    // suspect, because then it genuinely never arrived.
    const convert = async (): Promise<VectorHookResult | undefined> => {
      await page.waitForFunction(
        () => Boolean((window as unknown as { __lollyVectorShot?: unknown }).__lollyVectorShot),
        { timeout: 20_000 },
      ).catch(() => {
        throw new Error('the served shell never exposed __lollyVectorShot (waited 20s) — rebuild the dist (main.ts exposes it on loopback, and only on loopback)');
      });
      return page.evaluate(
        ([b64, cropCssPx]: [string, typeof crop | null]) =>
          (window as unknown as { __lollyVectorShot?: (b: string, o?: unknown) => Promise<VectorHookResult> })
            .__lollyVectorShot?.(b64, cropCssPx ? { cropCssPx } : undefined),
        [Buffer.from(pdf).toString('base64'), cropped ? crop : null] as [string, typeof crop | null],
      );
    };
    // The optional call yields undefined only when the hook is gone at that instant
    // — the page navigated (a hash route settling late) between the wait above and
    // the call, which resets `window`. Seen once in a 134-shot run and never when
    // that shot is captured alone, i.e. under contention, not deterministically.
    // Re-wait and convert again: the print is already in hand and the conversion is
    // a pure function of it, so a second attempt costs one page round-trip and
    // cannot change the pixels.
    const res = (await convert()) ?? (await convert());
    if (!res) throw new Error('__lollyVectorShot resolved to nothing twice — the conversion returned no result');
    // elementCount is what the INTERPRETER found, pre-cull — the "was the print
    // blank?" signal. Culling is reported separately so a bad crop can't be
    // misdiagnosed as a blank print.
    if (!res.elementCount) throw new Error('vector capture produced no drawable content');
    for (const w of res.warnings) console.warn(`  ⚠ ${shot.slug}: ${w}`);
    if (res.culled) {
      if (res.culled.dropped === res.culled.total) {
        throw new Error(`crop window selected no content (culled ${res.culled.total}/${res.culled.total} nodes) — check crop*/cropSelector`);
      }
      console.log(`    ✂ ${shot.slug}: culled ${res.culled.dropped}/${res.culled.total} nodes`
        + `${res.culled.unbounded ? ` (${res.culled.unbounded} unbounded, kept)` : ''}`);
    }

    // Window to the requested region — svg-point space (ratio = svg pts ÷ CSS px).
    const ratio = res.width / dims.width;
    const svg = windowPdfSvg(res.svg, {
      x: crop.x * ratio,
      y: crop.y * ratio,
      width: crop.width * ratio,
      height: crop.height * ratio,
      outWidth: crop.width,
      outHeight: crop.height,
    });
    // Print derives its expected dims from the recipe crop, not from here.
    return { bytes: new TextEncoder().encode(svg), framed: null };
  } finally {
    await ctx.close();
  }
}

async function captureOneVector(baseUrl: string, shot: ShotDef): Promise<ShotResult> {
  let bytes: Uint8Array;
  let framed: { width: number; height: number } | null = null;
  try {
    ({ bytes, framed } = await captureVector(baseUrl, shot));
  } catch (e) {
    return { slug: shot.slug, format: shot.format, error: (e as Error).message, wrote: false, bytes: 0 };
  }

  const { dims } = paramsFor(shot);
  // Expected output dims. The print path renders the whole page and WINDOWS it, so
  // the frame is derivable from the viewport minus the crop insets — and a mismatch
  // there means the window went wrong, which is worth failing on.
  //
  // The walker path has no window step: it walks `cropSelector`'s element directly,
  // so the frame IS that element's own box at its NATIVE size, not the viewport
  // scaled down to fit the stage. For auth-url-render that is the qr tool's native
  // 600x600 rather than the 486x486 the print crop produced. Applying the print
  // arithmetic to it reports dims-mismatch on every walker shot forever, which
  // would make the whole class permanently "failed" and drown the real failures the
  // exit-code fix is meant to surface. So the check is skipped here; what still
  // guards a blank walker capture is the length check in captureVector.
  // For the walker the frame is whatever `walkerWindow`'s arithmetic resolved,
  // reported back by the capture itself — same context, same numbers, so the check
  // is exact rather than reconstructed. Do NOT re-derive it from the recipe: the
  // print path pads a cropSelector by 24px per side, which puts `expected` +48 over
  // a walker frame and reports a mismatch on all 38 cropSelector walker recipes.
  // `framed` is null only when the root was never rewritten (no frame / bad XML),
  // where there is nothing to compare against.
  const expected = shot.walker
    ? framed
    : {
    width: Math.max(1, Math.round(dims.width * (1 - clampInset(shot.cropLeft) - clampInset(shot.cropRight)))),
    height: Math.max(1, Math.round(dims.height * (1 - clampInset(shot.cropTop) - clampInset(shot.cropBottom)))),
  };
  const newText = new TextDecoder().decode(bytes);
  const baselinePath = join(SHOTS_DIR, shotFileName(shot));
  let oldText: string | undefined;
  let oldBytes: number | undefined;
  if (existsSync(baselinePath)) {
    const old = readFileSync(baselinePath);
    oldBytes = old.byteLength;
    oldText = old.toString('utf-8');
  }

  const verdict = classifyVectorShot({ newText, newBytes: bytes.byteLength, expected, oldText, oldBytes });
  const promote = opts.rebuild || verdict.kind === 'new' || (verdict.kind === 'changed' && opts.accept);
  if (promote) writeFileSync(baselinePath, await stampC2pa(bytes, shot, dims));
  return { slug: shot.slug, format: shot.format, lang: shot.lang, verdict, wrote: promote, bytes: bytes.byteLength };
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
    ...(shot.waitSelector ? [row('waitSelector', 'text', shot.waitSelector)] : []),
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
  const name = `${r.slug}${r.lang ? `.${r.lang}` : ''}.${r.format}`.padEnd(22);
  if (r.error) {
    console.log(`  ✗ ${name} FAILED — ${r.error}`);
    return;
  }
  const v = r.verdict!;
  const kb = `${Math.round(r.bytes / 1024)} KB`;
  const flags = v.flags.length ? `  ⚠ ${v.flags.join(', ')}` : '';
  const px = v.pixelDiff === null ? '' : `${(v.pixelDiff * 100).toFixed(2)}% px`;
  // A weight flag has to say what it measured to be actionable.
  if (v.flags.includes('over-scale') || v.flags.includes('heavy')) {
    console.log(`    ⚖ ${r.slug}: ${r.width ? `${r.width}px wide, ` : ''}${kb} — budget is ${MAX_SHOT_PX}px / `
      + `${Math.round((r.format === 'svg' ? DEFAULT_THRESHOLDS.vectorMaxBytes : DEFAULT_THRESHOLDS.maxBytes) / 1024)} KB`);
  }
  const sz = v.sizeDelta === null ? '' : `${v.sizeDelta >= 0 ? '+' : ''}${Math.round(v.sizeDelta * 100)}% bytes`;
  if (v.kind === 'new') console.log(`  ✚ ${name} new — ${kb}${flags}`);
  else if (v.kind === 'unchanged') console.log(`  ✓ ${name} unchanged (${px})${flags}`);
  else console.log(`  ▲ ${name} CHANGED — ${[px, sz].filter(Boolean).join(', ')}${r.wrote ? ' → accepted' : ''}${flags}`);
}

function summarize(results: ShotResult[]): void {
  const failed = results.filter((r) => r.error || r.verdict?.flags.includes('dims-mismatch'));
  const pending = results.filter((r) => !r.error && r.verdict?.kind === 'changed' && !r.wrote);
  const suspicious = results.filter((r) => r.verdict?.flags.some((f) => f === 'tiny' || f === 'blank' || f === 'size-jump'));
  // The weight budget, enforced at the only actionable moment: a baseline actually
  // being (re)written. An `unchanged` verdict means the bytes on disk are a legacy
  // baseline's — worth reporting, not worth failing on, or the whole reframing
  // backlog would block every run before it could be worked through. But nothing
  // over budget may be COMMITTED from here on, and --accept must not be the loophole.
  const overBudget = results.filter((r) => r.wrote && r.verdict?.flags.some((f) => f === 'over-scale' || f === 'heavy'));
  const legacyHeavy = results.filter((r) => !r.wrote && r.verdict?.flags.some((f) => f === 'over-scale' || f === 'heavy'));

  console.log('');
  console.log(`${results.length} shot(s): ${results.filter((r) => r.verdict?.kind === 'unchanged').length} unchanged, ` +
    `${results.filter((r) => r.wrote).length} written, ${pending.length} pending review, ${failed.length} failed.`);
  if (suspicious.length) {
    console.log(`⚠  possible failed renders (tiny/blank/size-jump): ${suspicious.map((r) => r.slug).join(', ')}`);
  }
  if (legacyHeavy.length) {
    console.log(`⚠  over the weight budget, not rewritten this run (reframe: crop to the area of focus): ${legacyHeavy.map((r) => r.slug).join(', ')}`);
  }
  if (overBudget.length && opts.rebuild) {
    // A full refresh is the CORRECTIVE run — it is how a renderer/engine/capture-state
    // change reaches every baseline. Failing it for weight would block the very run
    // that fixes things, and refusing the write would keep the older, heavier, staler
    // pixels instead. So --rebuild takes the new bytes and says loudly what is still
    // over; the budget bites on the ordinary path below, where a shot is being added
    // or updated one at a time.
    console.log(`⚠  ${overBudget.length} baseline(s) written while still over budget: ${overBudget.map((r) => r.slug).join(', ')}`);
  } else if (overBudget.length) {
    console.log(`✗  refusing to publish ${overBudget.length} over-budget baseline(s): ${overBudget.map((r) => r.slug).join(', ')}`);
    console.log(`   Budget: ${MAX_SHOT_PX}px wide, ${Math.round(DEFAULT_THRESHOLDS.maxBytes / 1024)} KB raster / `
      + `${Math.round(DEFAULT_THRESHOLDS.vectorMaxBytes / 1024)} KB vector. A docs shot is displayed in an 848px column —`);
    console.log('   crop to the area of focus (cropSelector= or crop*=) rather than shooting the whole window.');
    process.exit(1);
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
