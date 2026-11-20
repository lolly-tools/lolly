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
import { inflateSync } from 'node:zlib';
import type { ExportMeta, IngredientCredential } from '@lolly-tools/core/host-v1';
import { designOperationsRenderer, type DesignExportRouteRecord } from '../../../engine/src/design-export-route.ts';
import { DESIGN_DRAW_VERSION } from '../../../engine/src/design-draw.ts';
import { designStrokeSides } from '../../../engine/src/design-stroke.ts';
import { browserInstalled } from './browsers.ts';
import { desktopInstalled, readRenderServer, rendererPreference } from './desktop-renderer.ts';
import { cleanJpeg } from './pdf-images.ts';
import { jpegSegmentBody, scanJpegSegments } from '@lolly/engine';
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

/**
 * The note a person reads when a Design page was drawn on this route: that no browser
 * drew it, and how to get the browser's own render. One sentence pair, the same on the
 * CLI and in the TUI.
 */
export function designStillNote(decision: DesignStillDecision): string {
  const what = 'This Design page was drawn without a browser, by resvg from its drawing operations';
  if (decision.because.startsWith(DESIGN_RASTER_ENV)) return `${what}, because ${DESIGN_RASTER_ENV}=resvg is set. Unset it for the browser's own render.`;
  return `${what}, because no browser render tier is available here. For the browser's own render, install one: \`lolly install-browser\` with a built web shell (\`pnpm run build:web\`, or LOLLY_WEB_BASE set to a running one), or the Lolly desktop app.`;
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

/**
 * A JPEG's frame components (3 for RGB, 4 for CMYK) and its ICC profile, read with the
 * engine's segment walker (which skips fill bytes), or null when the file cannot be walked.
 */
function jpegFacts(bytes: Uint8Array): { components: number; icc: Uint8Array | null } | null {
  const scan = scanJpegSegments(bytes);
  if (!scan) return null;
  let components = 0;
  const parts: Array<{ seq: number; body: Uint8Array }> = [];
  for (const seg of scan.segments) {
    const body = jpegSegmentBody(bytes, seg);
    if (seg.marker >= 0xc0 && seg.marker <= 0xcf && seg.marker !== 0xc4 && seg.marker !== 0xc8 && seg.marker !== 0xcc && body.length >= 6) components = body[5]!;
    if (seg.marker === 0xe2 && body.length > 14 && Buffer.from(body.subarray(0, 12)).toString('latin1') === 'ICC_PROFILE\0') parts.push({ seq: body[12]!, body: body.subarray(14) });
  }
  parts.sort((a, b) => a.seq - b.seq);
  return { components, icc: parts.length ? new Uint8Array(Buffer.concat(parts.map((p) => p.body))) : null };
}

/** Whether `markup` holds an element of this name, with or without a namespace prefix. */
const hasElement = (markup: string, name: string): boolean => new RegExp(`<(?:[^\\s<>/:="']+:)?${name}[\\s/>]`, 'iu').test(markup);

/** One tag of an ICC profile by its signature, or null. */
function iccTag(icc: Uint8Array, sig: string): Uint8Array | null {
  if (icc.length < 132) return null;
  const view = new DataView(icc.buffer, icc.byteOffset, icc.byteLength);
  const count = Math.min(view.getUint32(128), 256);
  for (let i = 0; i < count; i++) {
    const at = 132 + i * 12;
    if (at + 12 > icc.length) break;
    if (Buffer.from(icc.subarray(at, at + 4)).toString('latin1') !== sig) continue;
    const offset = view.getUint32(at + 4), size = view.getUint32(at + 8);
    return offset + size <= icc.length ? icc.subarray(offset, offset + size) : null;
  }
  return null;
}

/** A tone curve tag (`curv` or `para`) evaluated at one half, or NaN when unreadable. */
function toneAtHalf(tag: Uint8Array | null): number {
  if (!tag || tag.length < 12) return NaN;
  const view = new DataView(tag.buffer, tag.byteOffset, tag.byteLength);
  const type = Buffer.from(tag.subarray(0, 4)).toString('latin1');
  if (type === 'curv') {
    const count = view.getUint32(8);
    if (count === 0) return 0.5;
    if (count === 1) return tag.length >= 14 ? 0.5 ** (view.getUint16(12) / 256) : NaN;
    if (tag.length < 12 + count * 2) return NaN;
    const at = 0.5 * (count - 1), lo = Math.floor(at), hi = Math.min(count - 1, lo + 1), t = at - lo;
    return (view.getUint16(12 + lo * 2) * (1 - t) + view.getUint16(12 + hi * 2) * t) / 65535;
  }
  if (type === 'para') {
    const fn = view.getUint16(8);
    const p = Array.from({ length: Math.min(7, Math.floor((tag.length - 12) / 4)) }, (_, i) => view.getInt32(12 + i * 4) / 65536);
    const [g = NaN, a = 1, b = 0, c = 0, d = 0, e = 0, f = 0] = p;
    const x = 0.5;
    if (fn === 0) return x ** g;
    if (fn === 1) return x >= -b / a ? (a * x + b) ** g : 0;
    if (fn === 2) return x >= -b / a ? (a * x + b) ** g + c : c;
    if (fn === 3) return x >= d ? (a * x + b) ** g : c * x;
    if (fn === 4) return x >= d ? (a * x + b) ** g + e : c * x + f;
  }
  return NaN;
}

/**
 * Whether an ICC profile draws as sRGB: its red, green and blue colorants within 0.003
 * of sRGB's (D50) and each tone curve within 0.01 of sRGB's at one half (0.214). Read
 * from the numbers, never the profile's description, which can say anything.
 */
function isSrgbProfile(icc: Uint8Array): boolean {
  const colorants: Record<string, [number, number, number]> = { rXYZ: [0.4361, 0.2225, 0.0139], gXYZ: [0.3851, 0.7169, 0.0971], bXYZ: [0.1431, 0.0606, 0.7141] };
  for (const [sig, want] of Object.entries(colorants)) {
    const tag = iccTag(icc, sig);
    if (!tag || tag.length < 20 || Buffer.from(tag.subarray(0, 4)).toString('latin1') !== 'XYZ ') return false;
    const view = new DataView(tag.buffer, tag.byteOffset, tag.byteLength);
    if (want.some((v, k) => Math.abs(view.getInt32(8 + k * 4) / 65536 - v) > 0.003)) return false;
  }
  return ['rTRC', 'gTRC', 'bTRC'].every((sig) => Math.abs(toneAtHalf(iccTag(icc, sig)) - 0.214) <= 0.01);
}

/**
 * Why a PNG picture's colours would differ here, or null. The browser applies a PNG's
 * own colour profile (iCCP) and its chromaticities (cHRM); resvg applies neither, so a
 * Display P3 picture comes out with sRGB's reading of its numbers.
 */
function pngProfileRefusal(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let srgb = false;
  for (let at = 8; at + 8 <= bytes.length;) {
    const length = view.getUint32(at), type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IDAT' || type === 'IEND') break;
    if (type === 'sRGB') srgb = true;
    if (type === 'iCCP') {
      const nul = body.indexOf(0);
      let icc: Uint8Array | null = null;
      // An ICC profile is a few kilobytes; a larger one is not read (and not admitted).
      try { icc = new Uint8Array(inflateSync(body.subarray(nul + 2), { maxOutputLength: 1 << 20 })); } catch { icc = null; }
      if (!icc || !isSrgbProfile(icc)) return 'a PNG picture with a colour profile other than sRGB, which resvg does not apply';
    }
    if (type === 'cHRM' && !srgb) return 'a PNG picture with its own chromaticities, which resvg does not apply';
    at += 12 + length;
  }
  return null;
}

/** Why one embedded picture would not draw here as the browser draws it, or null. */
function pictureRefusal(mime: string, bytes: Uint8Array | null): string | null {
  if (!bytes) return 'a picture whose bytes cannot be read';
  if (mime === 'image/webp') return 'a WebP picture, which this resvg build does not decode';
  if (mime === 'image/jpeg') {
    let orientation = 1;
    try { orientation = cleanJpeg(bytes).orientation; } catch { return 'a JPEG picture this route cannot read'; }
    if (orientation !== 1) return 'a JPEG picture turned by its Exif orientation, which resvg does not apply';
    const facts = jpegFacts(bytes);
    if (!facts) return 'a JPEG picture this route cannot read';
    if (facts.components === 4) return 'a CMYK JPEG picture, which resvg converts without its colour profile';
    return facts.icc && !isSrgbProfile(facts.icc) ? 'a JPEG picture with a colour profile other than sRGB, which resvg does not apply' : null;
  }
  if (mime === 'image/svg+xml') {
    // Measured against the browser tier on resvg-js 2.6.2: the 44.725 x 19.706 Lolly logo
    // in a 204 x 90 box differs over 24 levels on 0.73% of its region (band 0.5%), along
    // the edges of its letters, with its ink within 0.5% and its centroid within 0.04 px.
    // The two renderers anti-alias a vector picture's edges differently. resvg also rounds
    // a vector picture's own size to whole pixels before fitting it to its box, and leaves
    // out a picture held inside one.
    return 'a vector picture, whose edges resvg and the browser anti-alias differently';
  }
  if (mime === 'image/png') return pngProfileRefusal(bytes);
  if (mime === 'image/gif') return null;
  return `a picture of type ${mime || 'unknown'}, which resvg does not decode`;
}

/** Why the pictures an SVG references would not draw here, one reason each. */
function hrefRefusals(svg: string): string[] {
  const out: string[] = [];
  for (const match of svg.matchAll(/\s(?:[^\s:="'<>/]+:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/giu)) {
    const href = (match[1] ?? match[2] ?? '').trim();
    if (href.startsWith('#')) continue;
    const data = /^data:([^;,]*)((?:;[^;,]*)*),([\s\S]*)$/i.exec(href);
    if (!data) { out.push('a picture that points outside the page, which this route does not fetch'); continue; }
    const mime = data[1]!.toLowerCase();
    const base64 = /;base64/i.test(data[2] ?? '');
    let bytes: Uint8Array | null;
    try { bytes = base64 ? base64Bytes(data[3]!) : new TextEncoder().encode(decodeURIComponent(data[3]!)); } catch { bytes = null; }
    const refusal = pictureRefusal(mime, bytes);
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
  if (hasElement(svg, 'text')) out.add('the page keeps live text, which would be drawn without its font');
  if (hasElement(svg, 'foreignObject')) out.add('the page holds HTML, which resvg does not draw');
  for (const match of svg.matchAll(/mix-blend-mode\s*:\s*([a-z-]+)/gi)) {
    if (!RESVG_BLENDS.has(match[1]!.toLowerCase())) out.add(`the blend mode ${match[1]}, which resvg does not draw`);
  }
  for (const reason of hrefRefusals(svg)) out.add(reason);
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

/** A row's bounds in its frame, turned as its rotation turns them. */
function turnedBounds(row: Record<string, unknown>, frame: Record<string, unknown>): { x0: number; y0: number; x1: number; y1: number } {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const w = n(row.w), h = n(row.h), angle = n(row.rot) * Math.PI / 180;
  const tw = Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h, th = Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h;
  const cx = n(row.x) - n(frame.x) + w / 2, cy = n(row.y) - n(frame.y) + h / 2;
  return { x0: cx - tw / 2, y0: cy - th / 2, x1: cx + tw / 2, y1: cy + th / 2 };
}

/**
 * The rows a rounded frame clips along one of its curves. Measured on the two fidelity
 * boards (frame radius 48 with a 10 px border, and 32 with 8 px), the browser and resvg
 * anti-alias that curve differently: against the exact coverage, the browser draws the
 * clipped row 0.215 short on average (0.46 at worst) and resvg 0.041 short (0.17 at
 * worst), and the frame's own edge is 0.134 over in the browser and 0.246 over in resvg.
 * The browser tier also leaves a faint shadow (alpha 7 to 17) outside the rounded corner.
 * Neither can be matched from here, so such a page goes to the browser tier.
 */
export function roundedFrameClips(rows: readonly unknown[], frameId: string): string[] {
  const all = rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
  const frame = all.find((row) => row.kind === 'frame' && String(row.id ?? '') === frameId);
  if (!frame || frame.clipChildren === false || frame.clipChildren === 'false') return [];
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const w = n(frame.w), h = n(frame.h), shape = String(frame.shape ?? 'rect');
  const curved = shape === 'ellipse' || shape === 'circle';
  // Only `rounded` and `pill` round, as the operations read them (outlineOf in engine/src/design-draw.ts).
  const radius = curved ? 0 : shape === 'pill' ? Math.min(w, h) / 2 : shape === 'rounded' ? Math.min(Math.max(0, n(frame.radius)), w / 2, h / 2) : 0;
  if (!curved && radius <= 0) return [];
  const sides = String(frame.stroke ?? '').trim() ? designStrokeSides(frame) : [0, 0, 0, 0];
  const [top, right, bottom, left] = sides.map((v) => Math.max(0, v)) as [number, number, number, number];
  const widest = Math.max(top, right, bottom, left);
  // The clip is the padding box: inside the border, each corner an ellipse whose radii are
  // the frame's radius less the two sides that meet there (CSS's inner border radius).
  // A point within a pixel of a curve counts as on the curve.
  const inner = { x0: left, y0: top, x1: w - right, y1: h - bottom };
  // A corner no more than a pixel round is a curve all the same: any point in its box counts.
  const beyond = (dx: number, dy: number, rx: number, ry: number): boolean =>
    rx > 0 && ry > 0 && (rx <= 1 || ry <= 1 || (dx / (rx - 1)) ** 2 + (dy / (ry - 1)) ** 2 > 1);
  const offCurve = (x: number, y: number): boolean => {
    const rl = radius - left, rr = radius - right, rt = radius - top, rb = radius - bottom;
    if (x < inner.x0 + rl && y < inner.y0 + rt) return beyond(inner.x0 + rl - x, inner.y0 + rt - y, rl, rt);
    if (x > inner.x1 - rr && y < inner.y0 + rt) return beyond(x - (inner.x1 - rr), inner.y0 + rt - y, rr, rt);
    if (x < inner.x0 + rl && y > inner.y1 - rb) return beyond(inner.x0 + rl - x, y - (inner.y1 - rb), rl, rb);
    if (x > inner.x1 - rr && y > inner.y1 - rb) return beyond(x - (inner.x1 - rr), y - (inner.y1 - rb), rr, rb);
    return false;
  };
  return all.filter((row) => row.kind !== 'frame' && String(row.frame ?? '') === frameId && !['true', '1'].includes(String(row.hidden)) && row.hidden !== true)
    .filter((row) => {
      // What the row paints past its box: a border of any alignment, a shadow, a blur.
      const reach = (String(row.stroke ?? '').trim() ? Math.max(0, ...designStrokeSides(row)) : 0)
        + (String(row.shadow ?? '').trim() && !['none', 'false', '0'].includes(String(row.shadow)) ? Math.abs(n(row.shadowX)) + Math.abs(n(row.shadowY)) + 3 * Math.abs(n(row.shadowBlur)) + 2 * Math.abs(n(row.z)) : 0)
        + 3 * Math.abs(n(row.blur));
      const t = turnedBounds(row, frame);
      const b = { x0: t.x0 - reach, y0: t.y0 - reach, x1: t.x1 + reach, y1: t.y1 + reach };
      const x0 = Math.max(b.x0, inner.x0), y0 = Math.max(b.y0, inner.y0), x1 = Math.min(b.x1, inner.x1), y1 = Math.min(b.y1, inner.y1);
      if (x0 >= x1 || y0 >= y1) return false;
      if (curved) {
        // An ellipse's clip is the padding ellipse, inside the border's widest side.
        const rx = w / 2 - widest, ry = h / 2 - widest;
        return rx <= 1 || ry <= 1 || [x0, x1].some((x) => [y0, y1].some((y) => beyond(x - w / 2, y - h / 2, rx, ry)));
      }
      // The row's corners, held inside the clip box: a row the clip curves through has one off the curve.
      return [x0, x1].some((x) => [y0, y1].some((y) => offCurve(x, y)));
    })
    .map((row) => String(row.id ?? ''));
}

/** The pixel box and resolution of a Design page's PNG. */
export interface DesignStillSize { width: number; height: number; dpi: number }

/** The largest side this route draws; anything larger goes to the browser tier, which has its own limit. */
const MAX_SIDE = 16384;

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
  if (!given(dims.width) && !given(dims.height)) {
    return page.width > MAX_SIDE || page.height > MAX_SIDE ? { reason: `the page is over ${MAX_SIDE} px a side` } : { width: Math.round(page.width), height: Math.round(page.height), dpi };
  }
  if (!given(dims.width) || !given(dims.height)) return { reason: 'the export gives one side of its size only' };
  const toPx = (v: number): number => {
    if (!physical) return Math.round(v);
    const inches = unit === 'mm' ? v / 25.4 : unit === 'cm' ? v / 2.54 : unit === 'in' ? v : unit === 'pt' ? v / 72 : NaN;
    return Math.round(inches * dpi);
  };
  const width = toPx(dims.width), height = toPx(dims.height);
  if (!(width > 0 && height > 0)) return { reason: `the export's unit "${unit}" is not one this route reads` };
  if (!Number.isFinite(width) || !Number.isFinite(height) || width > MAX_SIDE || height > MAX_SIDE) return { reason: `the requested size is over ${MAX_SIDE} px a side` };
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
  const clipped = roundedFrameClips(req.rows ?? [], frameId);
  if (clipped.length) return { refused: [`the frame's rounded edge clips ${clipped.join(', ')}, which resvg and the browser anti-alias differently`] };
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
