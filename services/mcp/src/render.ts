// SPDX-License-Identifier: MPL-2.0
/**
 * The render core - the boundary that makes deployment topology a deploy-time
 * choice (plans/77-mcp-server.md section 5). Two tiers, mirroring the engine/shell split:
 *
 *   Tier A (in-process): svg / emf / eps / data+text formats. jsdom + the engine,
 *     via the headless host. No browser.
 *   Tier A+resvg: svg-native tool → PNG, rasterised by @resvg/resvg-js. No browser.
 *   Tier B (headless Chromium): everything else (HTML-layout raster, pdf, video).
 *     Lazy playwright-core; env-gated so the service runs fully without a browser.
 *
 * `transform()` is the file-in → file-out path for on-device utilities
 * (strip-data, compress-pdf): the tool's exportFile hook produces the bytes.
 */

import {
  createRuntime, parseUrlState, expandQuery, serializeHdr,
  C2PA_FORMATS, embedC2pa, buildInputModel, serializeUrlState,
  parseDimension, toPixels, PENPOT_MIME,
  attributionCredits, checkAttributionReadback, verifyC2pa,
} from '@lolly/engine';
import type { C2paSourceIngredient } from '@lolly/engine';
import type { RightsEvaluationV1 } from '@lolly-tools/core/rights-v1';
import type { EmojiSetInfoV1 } from '@lolly-tools/core/emoji-v1';
import type { ExportFormat, ExportOpts, Profile, InputFile, HostV1 } from '@lolly-tools/core/host-v1';
import type { ToolManifest } from '../../../engine/src/loader.ts';
// Relative imports (not `@lolly-tools/node-shell/...`): this file is inlined into the
// Vercel MCP bundle, where a bare workspace specifier would dangle (see bridge.ts).
import { assertRenderOk, RenderIntegrityError } from '@lolly-tools/node-shell/render-integrity';
import { isDeepFormat, DeepSourceError, needsFloatScene } from '@lolly-tools/node-shell/raster';
import { buildExportC2paOpts } from '@lolly-tools/node-shell/c2pa-opts';
import { needsBrowserTier } from '@lolly-tools/node-shell/browser-tier';
import { readFile, stat } from 'node:fs/promises';
import { loadToolCached } from './catalog.ts';
import { withHost } from './host.ts';
import type { Jsdom } from './host.ts';
import { fontsDir, BROWSERS_DIR } from './paths.ts';
import { webShellBase, closeWebShell } from './webshell.ts';
import {
  BrowserJobQueue, BrowserQueueFullError, BrowserQueueTimeoutError, browserQueueOptions,
} from './browser-jobs.ts';
import { installBrowserEgressPolicy } from './egress.ts';

export { closeWebShell };

/** Formats the pure engine can produce without a browser engine (NODE_FORMATS).
 *  Includes the PRO FLOAT formats exr / .hdr (plans/61-deeprichpixels.md section 6 B3): those
 *  are the engine's own OpenEXR / Radiance writers over a resvg raster of the tool's
 *  SVG, so they are browser-free in exactly the sense this set means. They refuse
 *  loudly (400) without an `hdr=` request - see DEEP_FORMATS in node-shell/raster.ts
 *  and section 10's depth-follows-provenance rule.
 *  `penpot` belongs here for the same reason emf/eps do (plans/178): the .penpot
 *  writer is pure engine over the tool's own `<svg>` - no rasteriser and no browser
 *  anywhere in the path - so an SVG-native tool's archive builds in-process. An
 *  HTML-layout tool has no root `<svg>` and escalates to Tier B, exactly as emf does. */
export const TIER_A = new Set(['svg', 'emf', 'eps', 'eps-cmyk', 'dxf', 'exr', 'hdr', 'penpot', 'html', 'md', 'txt', 'json', 'csv', 'ics', 'vcf']);

/** Longest raster edge the resvg fast path will produce. A content-sized SVG
 *  (unbounded text → a viewBox that scales with input length) must never dictate
 *  the raster allocation: `fitTo: original` would honour a multi-billion-pixel
 *  intrinsic size verbatim and OOM the process. Mirrors render-get.ts
 *  MAX_EDGE_PX, which only validates the width/height QUERY params - this cap
 *  is what actually bounds the pixels. */
const MAX_RASTER_EDGE_PX = 10_000;

export interface RenderOpts {
  format?: string;
  width?: number;
  height?: number;
  unit?: string;
  dpi?: number;
  background?: string;
  colorProfile?: string;
  transparentBg?: boolean;
  convertPaths?: boolean;
  password?: string;
  c2pa?: { on: boolean; days: number | null } | null;
  /** The `hdr=` request (url-mode's HdrSettings dials). Parsed from the query when
   *  not given explicitly; required by the pro float formats. */
  hdr?: { peakNits: number; reach: number; lift: number; richness: number } | null;
  profile?: Profile;
  /** Requested export bit depth (the `depth` reserved param). Threaded so an MCP
   *  render of the same URL produces the same file the CLI does. */
  depth?: 8 | 16 | 'float' | 'auto';
  /** Refuse the Tier-B (Chromium) fallback: browser-free-path failures surface
   *  as a RenderError (400) instead of silently escalating to a full browser
   *  render. Always set by the public unauthenticated GET endpoint, whose
   *  stated policy is browser-free formats only (render-get.ts). */
  noBrowser?: boolean;
  /** Pixel-AREA budget for the resvg PNG fast path, on top of the fixed edge cap.
   *  Set by the public GET endpoint (render-get.ts MAX_RASTER_PIXELS): the edge
   *  cap alone still admits a 10000 x 10000 raster, a 400 MB allocation an
   *  unauthenticated request must not be able to ask for. Unset = edge cap only. */
  maxRasterPixels?: number;
}

/**
 * What the creative sources in a render ask of whoever delivers it (plan 253),
 * as a machine result: stable issue codes, the readable credit and the
 * evaluation's fingerprint. Present for a browser-free render, which this
 * process composed, and for a browser-tier render that asked for emoji, whose
 * census is re-established here (see `emojiCensus`). Absent otherwise: a Tier B
 * render was produced by a web shell that recorded its own, and inventing an
 * answer for bytes this process never composed would be a claim, not a reading.
 */
export interface RenderRightsResult {
  status: string;
  issues: { code: string; work?: string; summary: string }[];
  /** One line per required credit, ready to paste beside the file. */
  credits: string;
  fingerprint: string;
  /** True only when the delivered bytes were read back and every required source
   *  was found in them. False also means "not checked". */
  creditsInFile: boolean;
}

export interface RenderResult {
  bytes: Uint8Array;
  mime: string;
  format: string;
  /** Which render tier produced the bytes: 'A', 'A(resvg)', or 'B'. */
  tier: string;
  warnings: string[];
  rights?: RenderRightsResult;
}

/** Raised for a caller-facing render problem (bad format, browser not configured). */
export class RenderError extends Error {}

export function normFormat(f: string | null | undefined): string {
  const x = String(f ?? '').toLowerCase();
  return x === 'jpeg' ? 'jpg' : x;
}

export function mimeForFormat(fmt: string): string {
  switch (normFormat(fmt)) {
    case 'svg': return 'image/svg+xml';
    case 'png': return 'image/png';
    case 'apng': return 'image/apng';
    case 'jpg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'avif': return 'image/avif';
    case 'gif': return 'image/gif';
    case 'pdf': case 'pdf-cmyk': return 'application/pdf';
    // Legacy Windows-metafile type rather than RFC 7903 image/emf: it's the
    // only MIME Google Drive routes into Google Drawings/Slides, and this
    // Content-Type is what Drive stores when a render URL is pulled in.
    case 'emf': return 'application/x-msmetafile';
    case 'eps': case 'eps-cmyk': return 'application/postscript';
    case 'dxf': return 'image/vnd.dxf';
    // Pro float formats. `image/x-exr` is the de-facto OpenEXR type (never IANA-
    // registered); `image/vnd.radiance` IS registered for RGBE.
    case 'exr': return 'image/x-exr';
    case 'hdr': return 'image/vnd.radiance';
    case 'tiff': case 'cmyk-tiff': return 'image/tiff';
    case 'ico': return 'image/x-icon';
    // A Penpot binfile archive. It IS a zip, but the type must not report it: a
    // `zip` MIME is what renames the download to `.zip` downstream, and Penpot's
    // Import wants the `.penpot` name. PENPOT_MIME is the engine's own constant.
    case 'penpot': return PENPOT_MIME;
    case 'zip': return 'application/zip';
    case 'webm': return 'video/webm';
    case 'mp4': return 'video/mp4';
    case 'html': return 'text/html';
    case 'md': return 'text/markdown';
    case 'txt': return 'text/plain';
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    case 'ics': return 'text/calendar';
    case 'vcf': return 'text/vcard';
    default: return 'application/octet-stream';
  }
}

export function isTextFormat(fmt: string): boolean {
  return ['svg', 'html', 'md', 'txt', 'json', 'csv', 'ics', 'vcf', 'eps', 'eps-cmyk', 'dxf'].includes(normFormat(fmt));
}

/** Target pixel width for the resvg raster path, honouring physical units. */
function targetPx(width: number | undefined, unit: string | undefined, dpi: number | undefined): number | undefined {
  if (!width || width <= 0) return undefined;
  if (!unit || unit === 'px') return Math.round(width);
  const dim = parseDimension(`${width}${unit}`);
  return dim ? Math.round(toPixels(dim, dpi ?? 300)) : Math.round(width);
}

/** ExportOpts plus the CLI-local extensions the shared bridge reads (see
 *  shells/cli/src/bridge.ts's CliExportRenderOpts - MCP drives the same host). */
type McpExportOpts = ExportOpts & {
  password?: string;
  hdr?: { targets?: readonly string[]; peakNits?: number; reach?: number; lift?: number; richness?: number };
};

/** ExportOpts for runtime.export, mirroring the CLI's unit-qualifier handling. */
function exportOpts(o: RenderOpts): ExportOpts & { password?: string } {
  const unit = o.unit || 'px';
  const qual = (v: number | undefined): string | number | undefined =>
    (typeof v === 'number' && v > 0 ? (unit !== 'px' ? `${v}${unit}` : v) : undefined);
  const opts: McpExportOpts = { width: qual(o.width), height: qual(o.height) };
  if (unit !== 'px') opts.dpi = o.dpi || 300;
  if (o.background) opts.background = o.background;
  if (o.colorProfile) opts.colorProfile = o.colorProfile;
  if (o.password) opts.password = o.password;
  // depth is a REQUEST, honoured only where provenance supports it (the writers
  // enforce that). Dropping it here made the same URL render differently on MCP
  // than on the CLI - depth=float silently came back as 16-bit HALF.
  if (o.depth && o.depth !== 'auto') opts.depth = o.depth;
  // MCP has no brand-palette surface of its own, so the HDR view transform runs with
  // hdr.ts's includeWhite default only: near-whites get real above-1.0 headroom, brand
  // colours do not glow the way a CLI/web export with a resolved palette does.
  if (o.hdr) opts.hdr = { targets: [], peakNits: o.hdr.peakNits, reach: o.hdr.reach, lift: o.hdr.lift, richness: o.hdr.richness };
  return opts;
}

/** The two reserved emoji params, verbatim, as a query delivers them. What they
 *  mean is the engine's decision on every shell, so nothing here reads them. */
export interface EmojiRequest {
  emoji?: string | null;
  emojifx?: string | null;
  emojistyle?: string | null;
}

/**
 * Choose the set this render draws its emoji from, exactly as the CLI does
 * (`applyEmojiParams` in shells/cli/src/run.ts): one parser, one grammar, so a
 * link that draws Twemoji in the app draws Twemoji here. The URL names a set and
 * a treatment; the pin comes from this deployment's own catalog listing and the
 * palette from the brand in force, so a link can say what to draw and can never
 * describe the bytes it is drawn from.
 *
 * Parse issues come back as warnings rather than a throw: a link always draws
 * something, and the caller is told what could not be honoured.
 */
async function applyEmojiRequest(
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  host: HostV1,
  request: EmojiRequest,
): Promise<string[]> {
  const named = request.emoji?.trim();
  const fx = request.emojifx?.trim();
  if (!named && !fx && !request.emojistyle) {
    const style = await (await import('../../../engine/src/emoji-default.ts')).brandEmojiStyle(host);
    if (style) await runtime.setEmojiStyle(style);
    return [];
  }
  if (named === 'none') { await runtime.setEmojiStyle(null); return []; }
  if (!host.emoji) return ['This server cannot load emoji sets, so the emoji argument had no effect.'];
  const { parseEmojiParams } = await import('../../../engine/src/emoji-style.ts');
  const swatches = host.tokens ? await host.tokens.colors() : [];
  const parsed = parseEmojiParams(
    { emoji: named, emojifx: fx, emojistyle: request.emojistyle },
    await host.emoji.sets(),
    swatches.map((swatch) => ({ id: swatch.ref, hex: swatch.value })),
  );
  const warnings = parsed.issues.map((issue) => issue.message);
  if (!parsed.pin) {
    if (named || request.emojistyle) await runtime.setEmojiStyle(null);
    if (fx && !named) {
      warnings.push(`emojifx=${fx} names a treatment but no set, so there is no artwork to treat. Add emoji=<id>@<version>.`);
    }
    return warnings;
  }
  await runtime.setEmojiStyle(parsed.style ?? {
    schemaVersion: 1,
    primary: parsed.pin,
    fallbacks: [],
    metricsPolicy: 'inline-em-v1',
    treatment: parsed.treatment ?? { mode: 'original', strengthBps: 0 },
  });
  return warnings;
}

/**
 * Hydrate a tool into the render canvas, choose its emoji set and draw every
 * glyph from it.
 *
 * Shared by the browser-free render and by the browser tier's census below, so
 * the two place the same artwork from the same decisions rather than from two
 * copies of the same four lines.
 */
async function mountAndDraw(
  dom: Jsdom,
  host: HostV1,
  toolId: string,
  values: Record<string, unknown>,
  emoji: EmojiRequest,
): Promise<{
  runtime: Awaited<ReturnType<typeof createRuntime>>;
  canvas: Element;
  warnings: string[];
}> {
  const tool = await loadToolCached(toolId);
  const runtime = await createRuntime(tool, host, values as never);
  const canvas = dom.window.document.getElementById('canvas');
  if (!canvas) throw new RenderError('render canvas missing');
  // The set is chosen BEFORE the first pass: setEmojiStyle redraws a tree it has
  // already drawn, and there is nothing drawn yet, so this costs one pass.
  const warnings = await applyEmojiRequest(runtime, host, emoji);
  canvas.innerHTML = runtime.getHydrated();
  // Draw every emoji from the chosen set. An export walks this same node and
  // would run the pass anyway; saying it here keeps the hydrate-then-draw order
  // the same on every shell.
  await runtime.applyEmojiToDom(canvas);
  return { runtime, canvas: canvas as unknown as Element, warnings };
}

/**
 * The source census for bytes this process did not compose.
 *
 * The browser tier draws its emoji inside the web shell and hands back only the
 * file, so the same tool is hydrated here, with the same values and the same
 * set, and what THAT pass placed is what the credential records. No export: the
 * picture is already made, and this is only being asked what went into it. The
 * census describes the text, not the layout, so a browser render and this one
 * place the same distinct glyphs even where they lay the line out differently.
 *
 * Exported for the test that pins this seam; `render` is its only caller.
 */
export async function emojiCensus(
  toolId: string,
  values: Record<string, unknown>,
  fmt: string,
  profile: Profile,
  emoji: EmojiRequest,
): Promise<{ ingredients: C2paSourceIngredient[]; rights: RightsEvaluationV1 }> {
  return withHost(profile, async (dom, host) => {
    const { runtime } = await mountAndDraw(dom, host, toolId, values, emoji);
    return {
      ingredients: runtime.emojiIngredients(),
      rights: runtime.rights({ delivery: { format: fmt, canCarryCredential: C2PA_FORMATS.includes(fmt) } }),
    };
  });
}

/**
 * The emoji sets this deployment's catalog registers, as the host lists them.
 *
 * Held for the life of the process: the packs are pinned files on disk that a
 * running server cannot change, and the alternative is a jsdom boot every time
 * an agent asks what it may choose from. A failed read is not held, so a catalog
 * that arrives late is picked up on the next call.
 */
let emojiSetsHeld: Promise<EmojiSetInfoV1[]> | null = null;
export function emojiSets(): Promise<EmojiSetInfoV1[]> {
  emojiSetsHeld ??= withHost({}, async (_dom, host) => (host.emoji ? host.emoji.sets() : []))
    .catch((e: unknown) => { emojiSetsHeld = null; throw e; });
  return emojiSetsHeld;
}

/** `id@version`, the one spelling a set is named by on the wire. */
export const emojiSetName = (set: EmojiSetInfoV1): string => `${set.pin.id}@${set.pin.pin.version}`;

/**
 * Resolve the `emoji` argument to the exact `id@version` the set is registered
 * under. A person names a set the way they read it, so the short form and a bare
 * id both resolve while exactly one registered set answers to them. Anything
 * else is a usage error naming what IS registered: a render that quietly came
 * back without the artwork it was asked for would be the worse answer.
 */
export function resolveEmojiSetName(
  named: string,
  sets: readonly EmojiSetInfoV1[],
): { set: string } | { error: string } {
  const raw = named.trim();
  const at = raw.lastIndexOf('@');
  const id = at > 0 ? raw.slice(0, at) : raw;
  const version = at > 0 ? raw.slice(at + 1) : '';
  const short = (full: string): string => full.split('/').slice(-2).join('/');
  const matches = sets.filter((set) => (set.pin.id === id || short(set.pin.id) === id)
    && (!version || set.pin.pin.version === version));
  if (matches.length === 1) return { set: emojiSetName(matches[0]!) };
  const registered = sets.length
    ? sets.map((set) => `${emojiSetName(set)} (${set.label})`).join(', ')
    : 'none - this deployment registers no emoji set';
  if (matches.length > 1) {
    return { error: `More than one emoji set answers to "${raw}". Name one exactly: ${registered}.` };
  }
  return { error: `Unknown emoji set "${raw}". Registered sets: ${registered}.` };
}

/**
 * Tier A: hydrate the tool and export via the engine's own path (no browser).
 *
 * The emoji artwork the render placed comes back with the bytes. It has to: this
 * host is the CLI's Node bridge, whose `host.export.render` ignores
 * `opts.ingredients`, so the stamp at the end of `render` is the only place the
 * pack's licence and creator can be written into the credential.
 */
async function renderTierA(
  toolId: string,
  values: Record<string, unknown>,
  fmt: string,
  opts: ExportOpts,
  profile: Profile,
  emoji: EmojiRequest,
): Promise<{ bytes: Uint8Array; mime: string; ingredients: C2paSourceIngredient[]; rights: RightsEvaluationV1; warnings: string[] }> {
  return withHost(profile, async (dom, host) => {
    const { runtime, canvas, warnings } = await mountAndDraw(dom, host, toolId, values, emoji);
    let blob: Blob;
    try {
      blob = await runtime.export(canvas as unknown as Element, fmt as ExportFormat, opts);
    } catch (e) {
      // A deep-format refusal ("this render has no float pixels behind it") is a
      // CLIENT-side answer about the request, not a server fault. Without this it
      // reached the GET route as a 500 "Render failed" and the caller could not
      // tell a policy refusal from a crash.
      if (e instanceof DeepSourceError) throw new RenderError(e.message);
      throw e;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Honest failure: a lifecycle hook that threw means the canvas (and these bytes)
    // are blank. Surface the hook's message instead of handing the agent a
    // valid-but-empty file. Tier A only: Tier B re-renders in a real web shell whose
    // host has the full capability set, so these hookErrors don't describe its bytes.
    try {
      assertRenderOk({ hookErrors: runtime.hookErrors, format: fmt, bytes });
    } catch (e) {
      if (e instanceof RenderIntegrityError) throw new RenderError(e.message);
      throw e;
    }
    return {
      bytes,
      mime: blob.type || mimeForFormat(fmt),
      ingredients: runtime.emojiIngredients(),
      // The same evaluation the CLI and the app make, from the same rules, over
      // the sources this render placed. The audience stays unknown: an agent
      // asking for a file has said nothing about where it goes.
      rights: runtime.rights({ delivery: { format: fmt, canCarryCredential: C2PA_FORMATS.includes(fmt) } }),
      warnings,
    };
  });
}

/** Rasterise an SVG string to PNG via resvg. Text renders from catalog fonts.
 *  Output is ALWAYS bounded by MAX_RASTER_EDGE_PX, independent of the caller's
 *  `width` and of the SVG's intrinsic size (see the constant's comment), and by
 *  `maxPixels` (total area) when the caller sets one. */
async function svgToPng(svg: string, width: number | undefined, background: string | undefined, maxPixels?: number): Promise<Uint8Array> {
  const { Resvg } = await import('@resvg/resvg-js');
  // Cheap parse-only probe for the intrinsic size (viewBox/width/height) - no raster.
  const probe = new Resvg(svg, { font: { loadSystemFonts: false } });
  const iw = probe.width, ih = probe.height;
  if (!(iw > 0) || !(ih > 0)) throw new RenderError('SVG has no rasterisable size');
  let capScale = Math.min(MAX_RASTER_EDGE_PX / iw, MAX_RASTER_EDGE_PX / ih);
  if (maxPixels && maxPixels > 0) capScale = Math.min(capScale, Math.sqrt(maxPixels / (iw * ih)));
  const wantScale = width && width > 0 ? width / iw : 1;
  const scale = Math.min(wantScale, capScale);
  // Beyond MAX_RASTER_EDGE_PX:1 aspect the capped raster's short edge drops
  // below one pixel. resvg refuses a zero-size target, so refuse honestly here.
  if (iw * scale < 1 || ih * scale < 1) {
    throw new RenderError('SVG aspect ratio is too extreme to rasterise within the size cap - export svg instead.');
  }
  // Exact requested width when it fits the cap; otherwise a zoom that clamps the
  // LONGEST edge (a width-mode fit alone couldn't bound a very tall SVG's height).
  const fitTo = width && width > 0 && scale === wantScale
    ? { mode: 'width' as const, value: Math.round(width) }
    : { mode: 'zoom' as const, value: scale };
  const r = new Resvg(svg, {
    ...(background ? { background } : {}),
    fitTo,
    font: { fontDirs: [fontsDir()], loadSystemFonts: true },
  });
  return r.render().asPng();
}

// ── Tier B: headless Chromium (lazy, env-gated, pooled) ──────────────────────

let browserPromise: Promise<import('playwright-core').Browser> | null = null;
const browserJobs = new BrowserJobQueue(browserQueueOptions());
const MAX_BROWSER_OUTPUT_BYTES = 256 * 1024 * 1024;
export const MAX_TRANSFORM_INPUT_BYTES = 24 * 1024 * 1024;

async function withBrowserJob<T>(job: () => Promise<T>): Promise<T> {
  try {
    return await browserJobs.run(job);
  } catch (error) {
    if (error instanceof BrowserQueueFullError || error instanceof BrowserQueueTimeoutError) {
      throw new RenderError(`${error.message}; retry later.`);
    }
    throw error;
  }
}

async function readBoundedDownload(filename: string): Promise<Uint8Array> {
  const info = await stat(filename);
  if (info.size > MAX_BROWSER_OUTPUT_BYTES) {
    throw new RenderError(`Browser export exceeds the ${MAX_BROWSER_OUTPUT_BYTES}-byte output limit.`);
  }
  return new Uint8Array(await readFile(filename));
}

/** Browser sandboxing is the default. Containers that genuinely cannot provide
 * a Chromium sandbox must opt out explicitly and supply the surrounding
 * container controls documented by the deployment guide. */
export function browserLaunchArgs(env: NodeJS.ProcessEnv = process.env): string[] {
  return [
    ...(env.LOLLY_BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
  ];
}

async function getBrowser(): Promise<import('playwright-core').Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const channel = process.env.LOLLY_BROWSER_CHANNEL; // e.g. 'chrome'
      const executablePath = process.env.LOLLY_BROWSER_PATH;
      // Resolve Chromium from this package's scoped install (services/mcp/.browsers,
      // via `pnpm run install:browser`) unless the deployment pins its own browser:
      // an installed OS channel, an explicit binary, or a preset browsers path.
      if (!channel && !executablePath) {
        process.env.PLAYWRIGHT_BROWSERS_PATH ??= BROWSERS_DIR;
      }
      const { chromium } = await import('playwright-core');
      try {
        return await chromium.launch({
          ...(channel ? { channel } : {}),
          ...(executablePath ? { executablePath } : {}),
          // Rendering-intent pins, mirrored from packages/node-shell/src/browsers.ts
          // (see the full comment there): host-profile-independent sRGB colour and
          // unhinted glyph metrics, so hosted layouts don't reflow vs desktop.
          // Known divergence from node-shell: no swiftshader pair here, so a
          // WebGL-dependent tool (3d, viz) renders its fallback rather than GL
          // content on this tier. Add '--use-angle=swiftshader',
          // '--enable-unsafe-swiftshader' if a hosted deployment needs those tools.
          args: browserLaunchArgs(),
        });
      } catch (err) {
        const msg = (err as Error).message || '';
        if (/executable doesn't exist|Executable doesn't exist|please run/i.test(msg)) {
          // On a hosted/serverless deployment (no browser by design) the dev "install a
          // browser" advice is noise. Steer the caller to the browser-free formats that
          // DO render here. Keep the actionable install hint for local / self-host dev.
          const hosted = !!process.env.VERCEL || process.env.LOLLY_MCP_HOSTED === '1';
          throw new RenderError(
            hosted
              ? `This format needs the browser render tier, which isn't enabled on this hosted ` +
                `endpoint. What renders here: vector formats (svg, eps, emf), the data formats ` +
                `(html, md, json, csv, ics, vcf), and png for SVG-native tools. Try svg - it works ` +
                `for every tool - or png for a simple vector tool (e.g. qr-code).`
              : `Chromium is not installed for the Tier-B render path. Run ` +
                `\`pnpm run install:browser\` (downloads Chromium into services/mcp/.browsers), ` +
                `or point LOLLY_BROWSER_CHANNEL / LOLLY_BROWSER_PATH at an existing browser.`,
          );
        }
        throw err;
      }
    })().catch(err => { browserPromise = null; throw err; });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  const b = browserPromise;
  browserPromise = null;
  if (b) { try { (await b).close(); } catch { /* ignore */ } }
}

/** Reserved params we set ourselves on the export URL - cleared from the inbound
 *  query first so the caller's opts win. `c2pa` is dropped because render() stamps
 *  Content Credentials AFTER the browser returns (one path for both tiers). */
const EXPORT_URL_RESERVED = ['format', 'export', 'copy', 'width', 'w', 'height', 'h', 'unit', 'dpi', 'password', 'profile', 'c2pa', 'preview', 'options'];

/**
 * Whether a request asked for emoji artwork. The two params travel to the web
 * shell untouched, so a browser-tier render really does place a set's artwork
 * while the census that would record it stays here in Node.
 */
export function carriesEmojiParams(query: string): boolean {
  const p = new URLSearchParams(query);
  return Boolean(p.get('emoji') || p.get('emojifx') || p.get('emojistyle'));
}

/** Build the `#/tool/<id>?…` URL that makes the web shell auto-export on load. */
export function exportUrl(base: string, toolId: string, query: string, fmt: string, o: RenderOpts): string {
  const p = new URLSearchParams(query);
  for (const k of EXPORT_URL_RESERVED) p.delete(k);
  p.set('format', fmt);
  const unit = o.unit || 'px';
  if (o.width && o.width > 0) p.set('width', String(o.width));
  if (o.height && o.height > 0) p.set('height', String(o.height));
  if (unit !== 'px') { p.set('unit', unit); p.set('dpi', String(o.dpi || 300)); }
  // CMYK press condition for pdf-cmyk / cmyk-tiff (the app's `profile` reserved param).
  if (o.colorProfile) p.set('profile', o.colorProfile);
  if (o.hdr) p.set('hdr', serializeHdr(o.hdr));
  if (o.depth && o.depth !== 'auto') p.set('depth', String(o.depth));
  p.set('export', '1'); // presence flag → immediate download on load
  const q = p.toString();
  const tmpl = process.env.LOLLY_TOOL_URL_TEMPLATE || `${base}/#/tool/{id}?{query}`;
  return tmpl.replace('{id}', encodeURIComponent(toolId)).replace('{query}', q);
}

type ExportSecretContext = Pick<import('playwright-core').BrowserContext, 'exposeBinding'>;

/** Publish a PDF password as a one-shot browser-context RPC. It never enters
 * navigation, request headers, console output, or an init-script literal. */
export async function exposeExportPassword(
  context: ExportSecretContext,
  password: string | undefined,
): Promise<() => void> {
  let held = password || undefined;
  if (!held) return () => {};
  await context.exposeBinding('__lollyTakeExportSecret', (_source, kind: unknown) => {
    if (kind !== 'pdf-password') return null;
    const value = held ?? null;
    held = undefined;
    return value;
  });
  return () => { held = undefined; };
}

/** How long to wait for the download to arrive. Video records in real time. */
function exportTimeoutMs(fmt: string): number {
  const f = normFormat(fmt);
  if (f === 'webm' || f === 'mp4' || f === 'gif' || f === 'apng') return 180_000;
  if (f === 'pdf' || f === 'pdf-cmyk' || f === 'cmyk-tiff' || f === 'tiff') return 90_000;
  return 60_000;
}

/**
 * Tier B render - the full browser export pipeline (M1). Serves/points at a real
 * Lolly web shell (webShellBase: local built dist, or LOLLY_WEB_BASE), drives the
 * scoped Chromium to the tool with `?…&format=<fmt>&export`, and captures the bytes
 * the app's own export path downloads. So HTML-layout raster, pdf (incl. CMYK +
 * marks), and video all render exactly as a user's Download would. No canvas
 * screenshot: this is the real export, honouring the full param contract.
 */
async function renderTierB(
  toolId: string,
  query: string,
  fmt: string,
  o: RenderOpts,
): Promise<{ bytes: Uint8Array; mime: string }> {
  return withBrowserJob(async () => {
  const base = await webShellBase();
  const url = exportUrl(base, toolId, query, fmt, o);
  let browser: import('playwright-core').Browser;
  try {
    browser = await getBrowser();
  } catch (e) {
    if (e instanceof RenderError) throw e;
    throw new RenderError(`Tier-B browser unavailable: ${(e as Error).message}`);
  }
  const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
  let clearPassword = (): void => {};
  try {
    await ctx.addInitScript(() => {
      Object.defineProperty(globalThis, '__LOLLY_AI_DISABLED__', { value: true, writable: false, configurable: false });
    });
    clearPassword = await exposeExportPassword(ctx, fmt === 'pdf' ? o.password : undefined);
    const page = await ctx.newPage();
    await installBrowserEgressPolicy(page, base);
    const downloadP = page.waitForEvent('download', { timeout: exportTimeoutMs(fmt) });
    // 'commit' returns as soon as navigation starts; the export fires later, after
    // the tool mounts + settles (onInit, fonts). waitForEvent above is the real gate.
    await page.goto(url, { waitUntil: 'commit', timeout: 30_000 });
    let download: Awaited<typeof downloadP>;
    try {
      download = await downloadP;
    } catch {
      throw new RenderError(
        `Tool "${toolId}" produced no "${fmt}" export within the time limit - the tool may ` +
        `have failed to render, or the format isn't supported in the browser. Check the inputs.`,
      );
    }
    const path = await download.path();
    if (!path) throw new RenderError(`Tier-B download for "${toolId}" yielded no file.`);
    const bytes = await readBoundedDownload(path);
    await download.delete().catch(() => {});
    return { bytes, mime: mimeForFormat(fmt) };
  } finally {
    clearPassword();
    await ctx.close();
  }
  });
}

/** Exported for the test that pins the source-ingredient wiring; `render` is its only caller. */
export async function stampC2pa(
  bytes: Uint8Array, fmt: string, manifest: ToolManifest, values: Record<string, unknown>, o: RenderOpts,
  ingredients: C2paSourceIngredient[] = [],
): Promise<Uint8Array> {
  // The shared node-shell payload (dimensions, inputs digest, date, author gate),
  // so an MCP-made asset inspects as richly as a CLI/TUI/browser-made one.
  const opts = buildExportC2paOpts({
    surface: 'mcp',
    manifest,
    model: buildInputModel(manifest, { initial: values as never }),
    format: fmt,
    dims: { width: o.width ?? null, height: o.height ?? null, unit: o.unit ?? null, dpi: o.dpi ?? null },
    days: o.c2pa?.days,
    profile: o.profile,
    // One componentOf source ingredient per distinct glyph this render placed,
    // carrying the pack's own licence, creator and the exact bytes it came from.
    // Without it an MCP export that drew CC BY artwork records no licence for it.
    ...(ingredients.length ? { ingredients } : {}),
  });
  return embedC2pa(bytes, fmt as ExportFormat, opts);
}

/**
 * Render a tool to bytes. `query` is a plain (or packed `z=`) URL query - the
 * shared param contract. Explicit opts override anything parsed from the query.
 */
export async function render(toolId: string, query: string, o: RenderOpts = {}): Promise<RenderResult> {
  const tool = await loadToolCached(toolId);
  const formats = (tool.manifest.render.formats ?? []).map(f => f.toLowerCase());
  const supported = new Set<string>();
  for (const f of formats) { supported.add(f); if (f === 'jpeg') supported.add('jpg'); if (f === 'jpg') supported.add('jpeg'); }

  const q = await expandQuery(query);
  const st = parseUrlState(q, tool.manifest);
  const fmt = normFormat(o.format ?? st.format ?? formats[0] ?? 'svg');
  // exr / .hdr are admitted for any tool, declared or not - depth is an export
  // concern and plans/61-deeprichpixels.md section 10 rules out per-tool depth declarations.
  // The honest gate is at render time (no vector root, or no float source ⇒ refuse).
  if (!supported.has(fmt) && !isDeepFormat(fmt)) {
    throw new RenderError(`Tool "${toolId}" does not support format "${fmt}". Supported: ${formats.join(', ')} (plus the pro float formats exr, hdr, which need hdr=1)`);
  }
  // Map jpeg↔jpg to what the engine's ExportFormat expects.
  const exportFmt = fmt === 'jpg' && !formats.includes('jpg') ? 'jpg' : fmt;

  const values: Record<string, unknown> = { ...st.values };
  if (o.transparentBg !== undefined) values['transparentBg'] = o.transparentBg;
  if (o.convertPaths !== undefined) values['convertPaths'] = o.convertPaths;

  const merged: RenderOpts = {
    ...o,
    width: o.width ?? st.width ?? undefined,
    height: o.height ?? st.height ?? undefined,
    unit: o.unit ?? st.unit ?? undefined,
    dpi: o.dpi ?? st.dpi ?? undefined,
    password: o.password ?? st.password ?? undefined,
    c2pa: o.c2pa ?? st.c2pa ?? null,
    // The `hdr=` request, the CLI/MCP's only float pixel source (see exportOpts).
    hdr: o.hdr ?? st.hdr ?? null,
    depth: o.depth ?? st.depth ?? undefined,
  };
  const profile = o.profile ?? {};
  // The set and treatment travel in the query, so one reader answers for the
  // file, the editable link and the browser tier's URL alike.
  const emoji: EmojiRequest = { emoji: st.emoji, emojifx: st.emojiFx, emojistyle: st.emojiStyle };
  const warnings: string[] = [];
  // Open-password is only wired through for standard `pdf` (via the one-shot
  // browser binding); the
  // CMYK press path drops it, so the returned PDF would be UNprotected. Report it.
  if (merged.password && exportFmt === 'pdf-cmyk') {
    warnings.push('Password is not applied for pdf-cmyk - the returned PDF is not protected. Use format "pdf" for an open-password.');
  }
  let out: { bytes: Uint8Array; mime: string; tier: string };
  // The emoji artwork a browser-free render placed. Tier B stamps inside the web
  // shell, which records its own, so this stays empty there.
  let placed: C2paSourceIngredient[] = [];
  // What those sources ask of a delivery, for the same tier and the same reason.
  let evaluation: RightsEvaluationV1 | null = null;

  const floatScene = needsFloatScene(toolId, values.editingRange, exportFmt, merged.hdr);
  if (floatScene && o.noBrowser) throw new RenderError('HDR Design composition requires the browser render tier.');
  if (TIER_A.has(exportFmt) && !floatScene) {
    try {
      const r = await renderTierA(toolId, values, exportFmt, exportOpts(merged), profile, emoji);
      placed = r.ingredients;
      evaluation = r.rights;
      warnings.push(...r.warnings);
      out = { bytes: r.bytes, mime: r.mime, tier: 'A' };
    } catch (e) {
      // Same decision the CLI runner and the png fast path below already made:
      // on a browser-capable host, escalate ANY browser-free failure rather than
      // gate on needsBrowserTier's prose. The bridge's refusals (a script-drawn
      // tool's "root drawable" error) don't all match it, and a hook-integrity
      // blank is exactly what Tier B's real web shell fixes. A Tier-A-only host
      // (noBrowser) keeps the honest hard failure.
      if (o.noBrowser) throw e;
      warnings.push(`Browser-free path unavailable (${(e as Error).message}); trying the browser tier.`);
      placed = [];
      evaluation = null;
      out = { ...(await renderTierB(toolId, q, exportFmt, merged)), tier: 'B' };
    }
  } else if (exportFmt === 'png' && formats.includes('svg') && !floatScene && values.editingRange !== 'hdr') {
    // SVG-native fast path: engine SVG → resvg PNG, no browser.
    try {
      const svg = await renderTierA(toolId, values, 'svg', exportOpts({ ...merged, width: undefined, height: undefined, unit: 'px' }), profile, emoji);
      // The raster below is that SVG, so it placed the same artwork.
      placed = svg.ingredients;
      evaluation = svg.rights;
      warnings.push(...svg.warnings);
      const px = targetPx(merged.width, merged.unit, merged.dpi);
      const png = await svgToPng(new TextDecoder().decode(svg.bytes), px, merged.background, o.maxRasterPixels);
      out = { bytes: png, mime: 'image/png', tier: 'A(resvg)' };
    } catch (e) {
      if (o.noBrowser) {
        // No silent Tier-B escalation on the browser-free contract. Surface the
        // fast path's own failure (hook error, resvg refusal) as the answer.
        throw e instanceof RenderError ? e : new RenderError(`SVG→PNG render failed: ${(e as Error).message}`);
      }
      warnings.push(`SVG→PNG fast path unavailable (${(e as Error).message}); trying the browser tier.`);
      placed = [];
      evaluation = null;
      out = { ...(await renderTierB(toolId, q, exportFmt, merged)), tier: 'B' };
    }
  } else {
    if (o.noBrowser) {
      throw new RenderError(`Format "${fmt}" needs the browser render tier, which is not available for this request.`);
    }
    out = { ...(await renderTierB(toolId, q, exportFmt, merged)), tier: 'B' };
  }

  let bytes = out.bytes;
  // The browser tier draws its emoji inside the web shell and hands back only
  // the bytes, so the census is established here instead: the same tool, the
  // same values, the same set, hydrated in Node. Without it the credential
  // stamped below would record no sources at all, which reads in Verify as a
  // file that used none, even where the picture carries a CC BY-SA glyph.
  // Only when a set was actually asked for: an ordinary browser render places
  // no artwork and should not pay a second hydrate to be told so.
  if (out.tier.startsWith('B') && !evaluation && carriesEmojiParams(q)) {
    try {
      const census = await emojiCensus(toolId, values, exportFmt, profile, emoji);
      placed = census.ingredients;
      evaluation = census.rights;
    } catch (e) {
      // A hook that throws in jsdom is the one case left. Say which check failed
      // rather than letting the silence speak (plan 253 section 4.3 asks for
      // what was checked, in words), and never fail a finished render over it.
      warnings.push('This render drew emoji in the browser tier, and the source census could not be established '
        + `here (${(e as Error).message}), so the result records no creative sources and no rights answer. `
        + 'Ask for a format the browser-free tier renders, or read the set\'s licence from the catalog entry.');
    }
  }
  if (merged.c2pa?.on && C2PA_FORMATS.includes(exportFmt as ExportFormat) && !(exportFmt === 'pdf' && merged.password)) {
    try { bytes = await stampC2pa(bytes, exportFmt, tool.manifest, values, merged, placed); }
    catch (e) { warnings.push(`Content Credentials not attached - ${(e as Error).message}`); }
  } else if (merged.c2pa?.on) {
    warnings.push(`Format "${fmt}" cannot carry Content Credentials - skipped.`);
  }

  return {
    bytes, mime: out.mime, format: fmt, tier: out.tier, warnings,
    ...(evaluation ? { rights: await rightsResult(evaluation, bytes) } : {}),
  };
}

/**
 * The rights half of a render result. `creditsInFile` is measured by reading the
 * delivered bytes back, never by trusting that the stamp above ran: the stamp
 * catches its own failures and warns, so a promise of credits would otherwise
 * outlive a credential that was never written. Nothing to credit means nothing
 * to read back, and the field stays false rather than claiming a check happened.
 */
export async function rightsResult(evaluation: RightsEvaluationV1, bytes: Uint8Array): Promise<RenderRightsResult> {
  let creditsInFile = false;
  if (evaluation.plan.required.length) {
    try {
      const report = await verifyC2pa(bytes);
      creditsInFile = checkAttributionReadback(evaluation.plan, report).state === 'readback-confirmed';
    } catch { /* unreadable bytes are not a confirmed delivery, which is the default */ }
  }
  return {
    status: evaluation.status,
    issues: evaluation.issues.map((issue) => ({ code: issue.code, ...(issue.work ? { work: issue.work } : {}), summary: issue.summary })),
    credits: attributionCredits(evaluation.plan),
    fingerprint: evaluation.fingerprint,
    creditsInFile,
  };
}

export interface FileArg {
  base64: string;
  name?: string;
  mime?: string;
}

/**
 * A transform hook that cannot run in this Node host says so with a typed sentinel
 * (`err.code === 'NEEDS_BROWSER'`) or, for already-shipped tools, in its thrown sentence
 * (redact: "needs a browser canvas" / "isn't available in this app"). Those exports are
 * re-run on Tier B rather than failing - a rebuild-the-pixels utility has no honest
 * jsdom path. A failed verification gate reads like neither, so it still fails.
 *
 * Re-exported, NOT reimplemented: this file used to carry its own prose-only copy that
 * missed the "isn't"/"is not" split, so `convert-image` escalated correctly on the CLI
 * and failed hard over MCP. One predicate, one answer, whichever host you reach.
 */
export { needsBrowserTier };

/**
 * Tier-B transform - drive the real web shell, drop the caller's bytes into the tool's
 * file picker and capture the file its `[data-export-file]` button downloads. The
 * tool's own export gate runs in that browser, on these bytes; a thrown gate paints
 * its sentence on the button and downloads nothing, which surfaces here as a failure.
 */
async function transformTierB(
  toolId: string, fileInputId: string, file: { name: string; mime: string; bytes: Uint8Array }, query: string,
): Promise<{ bytes: Uint8Array; filename: string }> {
  return withBrowserJob(async () => {
  const base = await webShellBase();
  const p = new URLSearchParams(query);
  p.delete('export');
  const q = p.toString();
  const tmpl = process.env.LOLLY_TOOL_URL_TEMPLATE || `${base}/#/tool/{id}?{query}`;
  const url = tmpl.replace('{id}', encodeURIComponent(toolId)).replace('{query}', q);
  let browser: import('playwright-core').Browser;
  try {
    browser = await getBrowser();
  } catch (e) {
    if (e instanceof RenderError) throw e;
    throw new RenderError(`Tier-B browser unavailable: ${(e as Error).message}`);
  }
  const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
  try {
    await ctx.addInitScript(() => {
      Object.defineProperty(globalThis, '__LOLLY_AI_DISABLED__', { value: true, writable: false, configurable: false });
    });
    const page = await ctx.newPage();
    await installBrowserEgressPolicy(page, base);
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    const picker = `.file-picker[data-input-id="${fileInputId}"] input.file-native`;
    try {
      await page.waitForSelector(picker, { state: 'attached', timeout: 30_000 });
    } catch {
      throw new RenderError(`The web shell showed no file picker for "${fileInputId}" on "${toolId}" - the built shell may predate this tool.`);
    }
    await page.setInputFiles(picker, { name: file.name, mimeType: file.mime || 'application/octet-stream', buffer: Buffer.from(file.bytes) });
    try {
      await page.waitForSelector('[data-export-file]:not([disabled])', { state: 'visible', timeout: 60_000 });
    } catch {
      throw new RenderError(`"${toolId}" never offered its export button for ${file.name} - the tool may have refused this file.`);
    }
    // [data-export-wait] means the tool's canvas still owes these inputs work
    // (redact: page previews rendering, or bars from the instruction string that
    // have not been snapped to cover against the real page yet). The export
    // button enables first, so clicking on sight burned bars exactly as supplied.
    // Best-effort - a stuck page proceeds rather than failing the run.
    await page.waitForFunction(() => !document.querySelector('[data-export-wait]'), undefined, { timeout: 30_000 })
      .catch(() => {});
    const downloadP = page.waitForEvent('download', { timeout: 120_000 })
      .then(d => ({ kind: 'download' as const, d }), () => ({ kind: 'timeout' as const }));
    const errorP = page.waitForFunction(() => {
      const b = document.querySelector('[data-export-file]');
      return b && b.classList.contains('is-error') ? (b.textContent || '').trim() || 'Export failed.' : null;
    }, undefined, { timeout: 120_000 })
      .then(h => h.jsonValue() as Promise<string>)
      .then(msg => ({ kind: 'error' as const, msg }), () => new Promise<never>(() => {}));
    await page.click('[data-export-file]');
    const outcome = await Promise.race([downloadP, errorP]);
    if (outcome.kind === 'error') throw new RenderError(outcome.msg);
    if (outcome.kind === 'timeout') throw new RenderError(`"${toolId}" produced no file for ${file.name} within the time limit. Nothing was written.`);
    const path = await outcome.d.path();
    if (!path) throw new RenderError(`Tier-B download for "${toolId}" yielded no file.`);
    const bytes = await readBoundedDownload(path);
    const filename = outcome.d.suggestedFilename() || file.name;
    await outcome.d.delete().catch(() => {});
    return { bytes, filename };
  } finally {
    await ctx.close();
  }
  });
}

/** Transform path: file in → file out via a tool's exportFile hook. */
export async function transform(
  toolId: string,
  file: FileArg,
  inputs: Record<string, unknown> = {},
  profile: Profile = {},
  o: { noBrowser?: boolean } = {},
): Promise<{ bytes: Uint8Array; filename: string; mime: string; tier: string }> {
  const tool = await loadToolCached(toolId);
  if (!tool.manifest.hooks?.exportFile) {
    throw new RenderError(`Tool "${toolId}" is not a transform (file-in/file-out) tool.`);
  }
  const { fileInputId } = await import('./schema.ts');
  const inputId = fileInputId(tool.manifest);
  if (!inputId) throw new RenderError(`Tool "${toolId}" declares no file input.`);

  // Reject before Buffer.from allocates. HTTP calls have a request-body cap,
  // but stdio clients reach this method directly.
  const compactBase64 = file.base64.replace(/\s/g, '');
  const padding = compactBase64.endsWith('==') ? 2 : compactBase64.endsWith('=') ? 1 : 0;
  const estimatedBytes = Math.max(0, Math.floor(compactBase64.length * 3 / 4) - padding);
  if (estimatedBytes > MAX_TRANSFORM_INPUT_BYTES) {
    throw new RenderError(`Transform input exceeds the ${MAX_TRANSFORM_INPUT_BYTES}-byte decoded-file limit.`);
  }
  const bytes = Uint8Array.from(Buffer.from(compactBase64, 'base64'));
  if (bytes.length > MAX_TRANSFORM_INPUT_BYTES) {
    throw new RenderError(`Transform input exceeds the ${MAX_TRANSFORM_INPUT_BYTES}-byte decoded-file limit.`);
  }
  const fileRef: InputFile = {
    __file: true,
    name: file.name || 'input',
    mime: file.mime || 'application/octet-stream',
    size: bytes.length,
    bytes,
    url: null,
  };
  const values: Record<string, unknown> = { ...inputs, [inputId]: fileRef };

  const done = (out: { bytes: Uint8Array; filename?: string }, tier: string) => {
    const filename = out.filename || `${toolId}-output`;
    const ext = filename.includes('.') ? filename.split('.').pop()! : '';
    return { bytes: out.bytes, filename, mime: mimeForFormat(ext), tier };
  };

  try {
    return await withHost(profile, async (_dom, host) => {
      const runtime = await createRuntime(tool, host, values as never);
      const res = await (runtime as unknown as { exportFile: () => Promise<{ bytes: Uint8Array; filename?: string }> }).exportFile();
      return done(res, 'A');
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (!needsBrowserTier(msg)) throw e;
    if (o.noBrowser) {
      throw new RenderError(`${msg} That needs the browser tier, which is not available for this request.`);
    }
    // Everything except the file itself travels as the tool's URL state - the same
    // canonical instruction string a share link and the CLI carry.
    const query = serializeUrlState(buildInputModel(tool.manifest, { initial: inputs as never }));
    const out = await transformTierB(toolId, inputId, { name: fileRef.name, mime: fileRef.mime, bytes }, query);
    return done(out, 'B');
  }
}
