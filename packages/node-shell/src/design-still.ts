// SPDX-License-Identifier: MPL-2.0
/**
 * A Design page's PNG drawn in Node, with no browser (plan 371, M3a).
 *
 * The page is the one an SVG export writes from the drawing operations
 * (`designOpsSvgNode`), with every word outlined so that no font is read when the
 * pixels are drawn. resvg, the Rust renderer the Node shells already ship, draws that
 * SVG at the export's pixel size, and the PNG is finished the way the web shell finishes
 * one (`finishPng` in shells/web/src/bridge/export-raster-finish.ts): the Lolly Imprint,
 * then the resolution, the provenance text, the XMP packet and the sRGB profile, in that
 * order. The caller stamps the Content Credential afterwards, with this route recorded
 * in it (`nodeResvgRoute`), as it does for every PNG it writes.
 *
 * When this route draws a page (`designStillDecision`):
 * - no browser render tier is available here, so the export would otherwise fail; or
 * - `LOLLY_DESIGN_RASTER=resvg` asks for this route.
 * In every other case the browser render tier draws the page, as before. A page that
 * this route cannot draw faithfully is refused with its reason (`resvgRefusals`, and
 * every finding `designOpsSvgNode` already reports) and goes to the browser tier.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { ExportMeta, IngredientCredential } from '@lolly-tools/core/host-v1';
import { designOperationsRenderer, type DesignExportRouteRecord } from '../../../engine/src/design-export-route.ts';
import { DESIGN_DRAW_VERSION } from '../../../engine/src/design-draw.ts';
import { browserInstalled } from './browsers.ts';
import { desktopInstalled, readRenderServer, rendererPreference } from './desktop-renderer.ts';
import { cleanJpeg } from './pdf-images.ts';
import { rasterizeSvgToRgba } from './raster.ts';
import { repoRoot } from './repo-root.ts';

/** The environment variable that asks for this route while a browser tier is available. */
export const DESIGN_RASTER_ENV = 'LOLLY_DESIGN_RASTER';

/** `auto` (unset): this route only when no browser tier is available. `resvg`: this route first. */
export type DesignRasterChoice = 'auto' | 'resvg';

/** The choice `LOLLY_DESIGN_RASTER` makes, and the value it ignored when it names neither choice. */
export function designRasterChoice(env: Record<string, string | undefined> = process.env): { choice: DesignRasterChoice; ignored?: string } {
  const raw = env[DESIGN_RASTER_ENV];
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'resvg') return { choice: 'resvg' };
  return value === '' || value === 'auto' ? { choice: 'auto' } : { choice: 'auto', ignored: raw };
}

/**
 * Whether a browser render tier could take a Design page here, read the same way the
 * environment report reads it (shells/cli/src/environment.ts): Chromium with a built or
 * running web shell, or a desktop app that serves the render endpoint, as far as
 * `LOLLY_RENDERER` allows each. Nothing is launched. An unreadable `LOLLY_RENDERER`
 * counts as available, so the browser tier reports that value itself.
 */
export function browserTierState(): { available: boolean; reason?: string } {
  let preference: ReturnType<typeof rendererPreference>;
  try { preference = rendererPreference(); } catch { return { available: true }; }
  const dist = process.env.LOLLY_WEB_DIST || join(repoRoot(), 'shells', 'web', 'dist');
  const webShell = Boolean(process.env.LOLLY_WEB_BASE) || existsSync(join(dist, 'index.html'));
  const chromium = browserInstalled();
  if (preference !== 'desktop' && chromium && webShell) return { available: true };
  if (preference !== 'chromium' && (readRenderServer() || desktopInstalled())) return { available: true };
  const missing = preference === 'desktop'
    ? ['LOLLY_RENDERER=desktop and no Lolly desktop app is running or installed']
    : [
        chromium ? null : 'no Chromium (`lolly install-browser`)',
        webShell ? null : 'no built web shell (`pnpm run build:web`, or set LOLLY_WEB_BASE or LOLLY_WEB_DIST)',
        preference === 'chromium' ? null : 'no Lolly desktop app',
      ].filter((line): line is string => line !== null);
  return { available: false, reason: missing.join('; ') };
}

/** Which renderer a Design PNG asks for first, and why, before the page is compiled. */
export interface DesignStillDecision {
  /** `here`: try this route; `browser`: the browser render tier draws the page. */
  draw: 'here' | 'browser';
  /** Reads after "because". */
  because: string;
  /** A `LOLLY_DESIGN_RASTER` value that is neither choice, to be reported once. */
  ignored?: string;
}

export function designStillDecision(env: Record<string, string | undefined> = process.env, tier: () => { available: boolean; reason?: string } = browserTierState): DesignStillDecision {
  const { choice, ignored } = designRasterChoice(env);
  const extra = ignored !== undefined ? { ignored } : {};
  if (choice === 'resvg') return { draw: 'here', because: `${DESIGN_RASTER_ENV}=resvg asks for this route`, ...extra };
  const state = tier();
  if (!state.available) return { draw: 'here', because: `no browser render tier is available (${state.reason ?? 'none found'})`, ...extra };
  return { draw: 'browser', because: `a browser render tier is available and ${DESIGN_RASTER_ENV}=resvg was not given`, ...extra };
}

let resvgVersionCache: string | null = null;

/** The installed `@resvg/resvg-js` version, read from its own package file. */
export function resvgVersion(): string {
  if (resvgVersionCache === null) {
    try {
      const pkg = createRequire(import.meta.url)('@resvg/resvg-js/package.json') as { version?: unknown };
      resvgVersionCache = typeof pkg.version === 'string' && pkg.version ? pkg.version : 'unknown';
    } catch {
      resvgVersionCache = 'unknown';
    }
  }
  return resvgVersionCache;
}

/**
 * The renderer this route records: the drawing operations' version, then the resvg
 * build that drew them, so a credential records both halves of the pixels' history.
 */
export const designResvgRenderer = (): string => `${designOperationsRenderer(DESIGN_DRAW_VERSION)}+resvg-js-${resvgVersion()}`;

/**
 * The route record for a page this route drew: the existing `operations` route (the
 * pixels come from the drawing operations, not from the browser's own renderer), with
 * the renderer naming resvg. The same two credential keys every Design export records.
 */
export const nodeResvgRoute = (): DesignExportRouteRecord => ({ route: 'operations', renderer: designResvgRenderer() });

/** The blend modes the drawing operations write (`BLENDS` in engine/src/design-draw.ts), each of which resvg draws. */
const RESVG_BLENDS = new Set(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']);

function base64Bytes(body: string): Uint8Array | null {
  try { return new Uint8Array(Buffer.from(body, 'base64')); } catch { return null; }
}

/** The components of a JPEG's frame header (3 for RGB, 4 for CMYK), or 0 when none is read. */
function jpegComponents(bytes: Uint8Array): number {
  for (let at = 2; at + 9 < bytes.length;) {
    if (bytes[at] !== 0xff) { at++; continue; }
    const marker = bytes[at + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    const length = (bytes[at + 2]! << 8) | bytes[at + 3]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return bytes[at + 9]!;
    if (marker === 0xda) return 0;
    at += 2 + length;
  }
  return 0;
}

/** Why one embedded picture would not draw here as the browser draws it, or null. */
function pictureRefusal(mime: string, bytes: Uint8Array | null, depth: number): string | null {
  if (!bytes) return 'a picture whose bytes cannot be read';
  if (mime === 'image/webp') return 'a WebP picture, which this resvg build does not decode';
  if (mime === 'image/jpeg') {
    let orientation = 1;
    try { orientation = cleanJpeg(bytes).orientation; } catch { return 'a JPEG picture this route cannot read'; }
    if (orientation !== 1) return 'a JPEG picture turned by its Exif orientation, which resvg does not apply';
    if (jpegComponents(bytes) === 4) return 'a CMYK JPEG picture, which resvg converts without its colour profile';
    return null;
  }
  if (mime === 'image/svg+xml') {
    const markup = new TextDecoder().decode(bytes);
    if (/<text[\s>]/i.test(markup)) return 'a vector picture holding live text, which would be drawn without its font';
    if (/<foreignObject[\s>]/i.test(markup)) return 'a vector picture holding HTML, which resvg does not draw';
    const blended = premultipliedGradients(markup);
    if ('reason' in blended || blended.svg !== markup) return 'a vector picture with a gradient that blends through transparency, which resvg blends differently';
    return depth < 2 ? hrefRefusals(markup, depth + 1)[0] ?? null : 'a vector picture nested more than two deep';
  }
  if (mime === 'image/png' || mime === 'image/gif') return null;
  return `a picture of type ${mime || 'unknown'}, which resvg does not decode`;
}

/** Why the pictures an SVG references would not draw here, one reason each. */
function hrefRefusals(svg: string, depth: number): string[] {
  const out: string[] = [];
  for (const match of svg.matchAll(/\s(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const href = (match[1] ?? match[2] ?? '').trim();
    if (href.startsWith('#')) continue;
    const data = /^data:([^;,]*)((?:;[^;,]*)*),([\s\S]*)$/i.exec(href);
    if (!data) { out.push('a picture that points outside the page, which this route does not fetch'); continue; }
    const mime = data[1]!.toLowerCase();
    const base64 = /;base64/i.test(data[2] ?? '');
    let bytes: Uint8Array | null;
    try { bytes = base64 ? base64Bytes(data[3]!) : new TextEncoder().encode(decodeURIComponent(data[3]!)); } catch { bytes = null; }
    const refusal = pictureRefusal(mime, bytes, depth);
    if (refusal) out.push(refusal);
  }
  return out;
}

/**
 * The reasons this route would not draw an operations SVG the way the browser draws it,
 * one each, empty when it may. The drawing operations already refuse what they do not
 * carry; these are the further limits of resvg itself, measured on resvg-js 2.6.2:
 * live text (no font is loaded, so the words would vanish), HTML inside the drawing,
 * pictures it does not decode or turn (WebP, Exif orientation, CMYK JPEG), vector
 * pictures with live text, and a blend mode outside the ones it draws.
 */
export function resvgRefusals(svg: string): string[] {
  const out = new Set<string>();
  if (/<text[\s>]/i.test(svg)) out.add('the page keeps live text, which would be drawn without its font');
  if (/<foreignObject[\s>]/i.test(svg)) out.add('the page holds HTML, which resvg does not draw');
  for (const match of svg.matchAll(/mix-blend-mode\s*:\s*([a-z-]+)/gi)) {
    if (!RESVG_BLENDS.has(match[1]!.toLowerCase())) out.add(`the blend mode ${match[1]}, which resvg does not draw`);
  }
  for (const reason of hrefRefusals(svg, 0)) out.add(reason);
  return [...out];
}

interface GradientStop { offset: number; rgb: [number, number, number]; opacity: number }

/** A stop's `#rgb`, `#rrggbb` or `#rrggbbaa` colour with its opacity, or null for any other spelling. */
function readStop(attrs: string): GradientStop | null {
  const attr = (name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1];
  const offset = Number(attr('offset') ?? '0');
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec((attr('stop-color') ?? '#000000').trim())?.[1];
  if (!hex || !Number.isFinite(offset)) return null;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const channel = (i: number) => parseInt(full.slice(i * 2, i * 2 + 2), 16);
  const opacity = Number(attr('stop-opacity') ?? '1') * (full.length === 8 ? channel(3) / 255 : 1);
  return Number.isFinite(opacity) ? { offset, rgb: [channel(0), channel(1), channel(2)], opacity: Math.max(0, Math.min(1, opacity)) } : null;
}

/** Stops between which a premultiplied and a straight blend give different colours. */
const blendsThroughOpacity = (a: GradientStop, b: GradientStop): boolean =>
  a.opacity !== b.opacity && (a.rgb[0] !== b.rgb[0] || a.rgb[1] !== b.rgb[1] || a.rgb[2] !== b.rgb[2]);

/** Samples per stop pair when a gradient is rewritten; enough that resvg's blend between two samples stays within a level. */
const GRADIENT_SAMPLES = 32;

/**
 * The browser blends gradient stops premultiplied by their opacity (CSS Images), and
 * resvg 2.6 blends them straight: measured on resvg-js 2.6.2, a stop from transparent
 * red to blue reads 64,0,64 at its midpoint where the browser draws pure blue. Only a
 * stop pair that changes both colour and opacity is affected. Such a gradient is
 * rewritten here with its premultiplied colours sampled along each pair, so resvg's
 * straight blend between neighbouring samples draws what the browser draws. A stop
 * colour this function cannot read leaves the page with a reason instead.
 */
export function premultipliedGradients(svg: string): { svg: string } | { reason: string } {
  let reason: string | null = null;
  const out = svg.replace(/<(linearGradient|radialGradient)\b([^>]*)>([\s\S]*?)<\/\1>/g, (whole, tag: string, head: string, body: string) => {
    const raw = [...body.matchAll(/<stop\b([^>]*?)\/?>/g)].map((m) => readStop(m[1]!));
    if (raw.length < 2) return whole;
    if (raw.some((s) => !s)) {
      reason = 'a gradient whose stop colours this route cannot read';
      return whole;
    }
    const stops = raw as GradientStop[];
    if (!stops.some((s, i) => i > 0 && blendsThroughOpacity(stops[i - 1]!, s))) return whole;
    const hex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
    const written: string[] = [];
    const put = (offset: number, rgb: number[], opacity: number) => {
      written.push(`<stop offset="${+offset.toFixed(5)}" stop-color="${hex(rgb)}"${opacity < 1 ? ` stop-opacity="${+opacity.toFixed(5)}"` : ''}/>`);
    };
    stops.forEach((b, i) => {
      if (i === 0) return;
      const a = stops[i - 1]!;
      const samples = blendsThroughOpacity(a, b) ? GRADIENT_SAMPLES : 1;
      for (let k = i === 1 ? 0 : 1; k <= samples; k++) {
        const t = k / samples, alpha = a.opacity + (b.opacity - a.opacity) * t;
        // A transparent end takes the colour of the stop it blends towards, as premultiplying does.
        const rgb = alpha > 0
          ? [0, 1, 2].map((c) => (a.rgb[c]! * a.opacity * (1 - t) + b.rgb[c]! * b.opacity * t) / alpha)
          : (t < 0.5 ? b.rgb : a.rgb);
        put(a.offset + (b.offset - a.offset) * t, rgb, alpha);
      }
    });
    return `<${tag}${head}>${written.join('')}</${tag}>`;
  });
  return reason ? { reason } : { svg: out };
}

/** The pixel box and resolution of a Design page's PNG. */
export interface DesignStillSize { width: number; height: number; dpi: number }

/** The export size controls a Design PNG reads, as the Node shells hold them. */
export interface DesignStillDims { width?: number; height?: number; unit?: string; dpi?: number }

/**
 * The pixel box the browser render tier draws a Design page at, measured on that tier
 * on 2026-11-19 (plan 371 evidence): the page's own size in pixels when no size is given,
 * the requested size otherwise, converted at the export's resolution for a physical unit
 * (300 dpi unless one is given) and 96 dpi for pixels. The resolution is also what the
 * PNG's pHYs chunk records. A request naming one side only, or a size of other
 * proportions than the page, is answered with a reason instead: the browser tier anchors
 * and crops those itself, and this route does not copy that yet.
 */
export function designStillSize(page: { width: number; height: number }, dims: DesignStillDims): DesignStillSize | { reason: string } {
  const unit = dims.unit || 'px';
  const physical = unit !== 'px';
  const dpi = physical ? (dims.dpi && dims.dpi > 0 ? dims.dpi : 300) : 96;
  const given = (v: number | undefined): v is number => typeof v === 'number' && v > 0;
  if (!given(dims.width) && !given(dims.height)) return { width: Math.round(page.width), height: Math.round(page.height), dpi };
  if (!given(dims.width) || !given(dims.height)) return { reason: 'the export gives one side of its size only' };
  const toPx = (v: number): number => {
    if (!physical) return Math.round(v);
    const inches = unit === 'mm' ? v / 25.4 : unit === 'cm' ? v / 2.54 : unit === 'in' ? v : unit === 'pt' ? v / 72 : NaN;
    return Math.round(inches * dpi);
  };
  const width = toPx(dims.width), height = toPx(dims.height);
  if (!(width > 0 && height > 0)) return { reason: `the export's unit "${unit}" is not one this route reads` };
  if (Math.abs(height - page.height * (width / page.width)) > 0.5) return { reason: `the requested size changes the page's proportions (the page is ${Math.round(page.width)} x ${Math.round(page.height)})` };
  return { width, height, dpi };
}

/** The page size an operations SVG declares in its viewBox. */
function viewBoxSize(svg: string): { width: number; height: number } | null {
  const m = /<svg\b[^>]*\sviewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const width = m ? Number(m[1]) : NaN, height = m ? Number(m[2]) : NaN;
  return width > 0 && height > 0 ? { width, height } : null;
}

/** What a Design PNG drawn here hands back: the bytes, and what the credential records. */
export interface DesignStillDrawn {
  bytes: Uint8Array;
  imprinted: boolean;
  width: number;
  height: number;
  route: DesignExportRouteRecord;
  /** Credentialed pictures the page drew, for the credential's ingredients. */
  ingredients: IngredientCredential[];
}

/** One Design page to draw: the shell's own export call and the request's controls. */
export interface DesignStillRequest {
  /** The runtime's export, which runs the tool's export hook and writes the operations SVG. */
  exportSvg: (node: Element, opts: Record<string, unknown>) => Promise<Blob>;
  /** The metadata record that export assembled (`runtime.lastExportMeta`). */
  meta: () => Partial<ExportMeta> | null | undefined;
  /** The page to draw, or null when the export picks no single page. */
  page: Element | null;
  /** The document's rows (the `boxes` input), to find the ones laid out after the page is read. */
  rows?: readonly unknown[];
  dims: DesignStillDims & { imprint?: boolean | null; durable?: boolean; depth?: unknown };
}

/** Errors that say the render itself is broken, which no other renderer may launder. */
const FATAL = new Set(['RenderIntegrityError', 'ExportHookError']);

/**
 * Draw one Design page here, or say why not. The reasons read after "because"; the
 * caller hands such a page to the browser render tier, which owns everything this
 * route does not draw. A render that is itself broken (a hook failure) still throws.
 */
export async function drawDesignStill(req: DesignStillRequest): Promise<{ drawn: DesignStillDrawn } | { refused: string[] }> {
  const reasons: string[] = [];
  if (req.dims.durable) reasons.push('the durable credential needs the browser\'s TrustMark encoder');
  if (req.dims.depth === 16 || req.dims.depth === 'float') reasons.push('the export asks for more than 8 bits per channel');
  if (!req.page) reasons.push('the export is not a single frame (name one with --s)');
  if (reasons.length || !req.page) return { refused: reasons };
  // Design's export hook lays flex and grid boxes out after the document is read, so the
  // operations would draw those boxes where they were authored, not where they are shown.
  const frameId = req.page.getAttribute('data-frame-id') ?? '';
  const laidOut = (req.rows ?? []).filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => (row.layout === 'flex' || row.layout === 'grid') && (String(row.id ?? '') === frameId || String(row.frame ?? '') === frameId))
    .map((row) => String(row.id ?? ''));
  if (laidOut.length) return { refused: [`the page lays out ${laidOut.join(', ')} with flex or grid, which the export hook works out after the page is read`] };
  const ingredients: IngredientCredential[] = [];
  let drawnFrom: DesignExportRouteRecord | undefined;
  let svg: string;
  try {
    // Outlined words whatever the document's Convert paths says: a PNG carries no text,
    // and outlines are what keep the fonts out of the drawing step.
    const blob = await req.exportSvg(req.page, {
      convertPaths: true,
      ingredientSink: ingredients,
      onExportRoute: (record: DesignExportRouteRecord) => { drawnFrom = record; },
    });
    svg = await blob.text();
  } catch (error) {
    if (error instanceof Error && FATAL.has(error.name)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    return { refused: [/\bbecause (.+)$/s.exec(message)?.[1]?.replace(/\.$/, '') ?? message] };
  }
  if (drawnFrom?.route !== 'operations') return { refused: ['the page was not written from the drawing operations'] };
  const page = viewBoxSize(svg);
  if (!page) return { refused: ['the page SVG declares no size'] };
  const size = designStillSize(page, req.dims);
  if ('reason' in size) return { refused: [size.reason] };
  const limits = resvgRefusals(svg);
  if (limits.length) return { refused: limits };
  const blended = premultipliedGradients(svg);
  if ('reason' in blended) return { refused: [blended.reason] };
  const { bytes, imprinted } = await designStillPng(blended.svg, size, { imprint: req.dims.imprint, meta: req.meta() ?? null });
  return { drawn: { bytes, imprinted, width: size.width, height: size.height, route: nodeResvgRoute(), ingredients } };
}

/**
 * Draw an operations SVG at `size` and finish it as the web shell finishes a PNG.
 * `imprinted` is true only when the Lolly Imprint was embedded: a picture below the
 * watermark's detection floor is written without one, as on every other Node route.
 */
export async function designStillPng(
  svg: string, size: DesignStillSize, opts: { imprint?: boolean | null; meta?: Partial<ExportMeta> | null } = {},
): Promise<{ bytes: Uint8Array; imprinted: boolean }> {
  const engine = await import('@lolly/engine');
  const frame = await rasterizeSvgToRgba(svg, size.width, size.height);
  const imprinted = !!opts.imprint && engine.canCarryWatermark(frame.width, frame.height);
  const rgba = imprinted
    ? engine.embedWatermark(frame.data, { width: frame.width, height: frame.height, strength: engine.LOSSLESS_STRENGTH })
    : frame.data;
  let png: Uint8Array = engine.packPng(rgba, { width: frame.width, height: frame.height, channels: 4, depth: 8 });
  // The web shell's finishing order (finishPng): each chunk goes in after IHDR, so the
  // file reads IHDR, iCCP, XMP, the provenance text, pHYs, then the image.
  const meta = (opts.meta ?? null) as ExportMeta | null;
  png = engine.insertPngPhys(png, size.dpi) ?? png;
  png = engine.insertPngMeta(png, meta);
  png = engine.insertPngXmp(png, meta);
  const icc = engine.iccProfileBytes('srgb');
  if (icc) png = await engine.insertPngIcc(png, icc, 'sRGB');
  return { bytes: png, imprinted };
}
