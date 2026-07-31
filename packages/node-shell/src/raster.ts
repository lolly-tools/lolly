// SPDX-License-Identifier: MPL-2.0
/**
 * Shared no-browser raster plumbing for the Node shells (CLI + TUI): the format split,
 * pixel-dimension resolution, and the resvg SVG→PNG fast path ("Tier A" — pure Rust,
 * a few-MB native module, not a browser). Each shell keeps its own orchestration on
 * top (the CLI's renderRaster, the TUI's exportToFile).
 */
import { join } from 'node:path';
import { parseDimension, toPixels, fromU8Srgb, hdrViewTransform } from '@lolly/engine';
import type { DeepFrame } from '@lolly/engine';
// DEEP RELATIVE IMPORTS, not the `@lolly/engine` barrel: exr.ts and radiance.ts are
// deliberately engine-INTERNAL (their own module headers say so — the bytes.ts /
// gainmap.ts precedent recorded in plans/deeprichpixels.md §9c). They are consumed by
// deep-path import, exactly the way packages/node-shell/src/pptx.ts reaches
// engine/src/pptx-read.ts. Nothing was added to the barrel for this feature.
import { packExr, type ExrPixelType } from '../../../engine/src/exr.ts';
import { packRadiance } from '../../../engine/src/radiance.ts';
import { repoRoot } from './repo-root.ts';

/** Formats the DOM-free engine writes on its own (svg/emf/eps + text/data), plus the
 *  PRO float formats (exr/hdr) the engine's own writers emit over a resvg-rasterised
 *  frame. Everything else — raster, pdf, video — is produced by the raster tiers
 *  (resvg fast path, else the scoped Chromium driving the built web shell — see
 *  webshell-render.ts). */
export const NODE_FORMATS = ['svg', 'emf', 'eps', 'eps-cmyk', 'dxf', 'exr', 'hdr', 'html', 'json', 'csv', 'ics', 'vcf', 'txt', 'md'];

/**
 * The float interchange formats (plans/deeprichpixels.md §4.2 / §6 B3, surfaced
 * CLI-first per §10 item 4): OpenEXR and Radiance RGBE.
 *
 * These are deliberately NOT declared per tool in `tool.json`. §10's "deliberately
 * not doing" list rules out per-tool depth declarations — depth is an export
 * concern, tools stay declarative — so adding `"exr"` to 60-odd manifests (and to
 * the schema enum, and to every per-brand generated catalog index) would be exactly
 * the mistake the plan names. Instead the CLI/MCP format gate admits these for any
 * tool whose render can be reduced to an `<svg>`, and refuses honestly otherwise.
 */
export const DEEP_FORMATS = ['exr', 'hdr'] as const;
export type DeepFormat = (typeof DEEP_FORMATS)[number];

/** MIME for the pro float formats. `image/x-exr` is the de-facto OpenEXR type (no
 *  IANA registration exists); `image/vnd.radiance` IS IANA-registered for RGBE. */
export function deepFormatMime(fmt: string): string {
  return fmt.toLowerCase() === 'exr' ? 'image/x-exr' : 'image/vnd.radiance';
}

export function isDeepFormat(fmt: string): fmt is DeepFormat {
  const f = fmt.toLowerCase();
  return f === 'exr' || f === 'hdr';
}

// Catalog fonts feed resvg so text-bearing SVG tools rasterise with the brand faces,
// not whatever the OS happens to have.
const FONTS_DIR = join(repoRoot(), 'catalog', 'fonts');

/** The dimension subset pxDims reads (both shells' export-dims shapes satisfy it). */
export interface PxDimsInput { width?: number; height?: number; unit?: string; dpi?: number }

/** Resolve export dims to plain pixels (converts a physical unit like mm via the engine's
 *  own unit math; falls back to the tool's render size, else 1280×720). */
export function pxDims(
  dims: PxDimsInput, manifest: { render?: { width?: number; height?: number } },
): { width: number; height: number; dpi: number } {
  const dpi = dims.dpi && dims.dpi > 0 ? dims.dpi : 300;
  const render = manifest.render ?? {};
  const toPx = (v: number | undefined, fallback: number): number => {
    if (!(typeof v === 'number' && v > 0)) return fallback;
    const u = dims.unit || 'px';
    if (u === 'px') return Math.round(v);
    const d = parseDimension(`${v}${u}`);
    return d ? Math.round(toPixels(d, dpi)) : Math.round(v);
  };
  return { width: toPx(dims.width, render.width ?? 1280), height: toPx(dims.height, render.height ?? 720), dpi };
}

/** Rasterise an SVG string to a `width`×`height` px PNG via resvg (pure Rust, no browser).
 *  resvg's `fitTo` can only constrain ONE axis, so to honour BOTH requested dimensions we
 *  set the root's width/height to the exact target box and render at that intrinsic size —
 *  the SVG's own viewBox + preserveAspectRatio then place the content (letterbox/meet as the
 *  tool authored it), matching the web/desktop raster rather than dropping the height.
 *  Text renders from the catalog fonts; the SVG's own background/transparency is kept. */
export async function rasterizeSvgToPng(svg: string, width: number, height: number): Promise<Uint8Array> {
  const { Resvg } = await import('@resvg/resvg-js');
  const r = new Resvg(sizeSvg(svg, width, height), {
    fitTo: { mode: 'original' },
    font: { fontDirs: [FONTS_DIR], loadSystemFonts: true },
  });
  return r.render().asPng();
}

/** Rewrite the root `<svg>` to render at exactly `width`×`height` px — see
 *  rasterizeSvgToPng's doc comment for why both axes are set this way. */
function sizeSvg(svg: string, width: number, height: number): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const m = svg.match(/<svg\b([^>]*)>/);
  if (!m) return svg;
  let attrs = m[1]!;
  // Keep a viewBox (the content coordinate space); synthesise one from the root's own
  // width/height if it lacks one, so the content still scales to the target box.
  if (!/\bviewBox=/.test(attrs)) {
    const ow = attrs.match(/\bwidth="([\d.]+)"/)?.[1];
    const oh = attrs.match(/\bheight="([\d.]+)"/)?.[1];
    if (ow && oh) attrs += ` viewBox="0 0 ${ow} ${oh}"`;
  }
  attrs = attrs.replace(/\s(width|height)="[^"]*"/g, '');   // drop native size, keep viewBox + PAR
  return svg.replace(/<svg\b[^>]*>/, `<svg${attrs} width="${w}" height="${h}">`);
}

/**
 * Rasterise an SVG to raw RGBA8 with STRAIGHT (un-premultiplied) alpha, the shape
 * `fromU8Srgb` wants.
 *
 * resvg hands back PREMULTIPLIED bytes — verified, not assumed: a 50%-alpha pure red
 * rect comes out `128,0,0,128`, where straight alpha would be `255,0,0,128`. Feeding
 * those straight into a DeepFrame (whose contract is un-premultiplied) would darken
 * every semi-transparent pixel toward black in the EXR, so the division happens here,
 * once, at the source. `tests/cli-deep-export.test.ts` pins it against resvg's own
 * `asPng()` output decoded by `sharp` (an independent oracle that produces straight
 * alpha), so a resvg release that changed this convention fails loudly.
 *
 * Honesty note: un-premultiplying 8-bit bytes cannot recover precision the
 * premultiply threw away — at alpha 1/255 a channel has two distinguishable values.
 * That is a property of the resvg source, not something this function papers over.
 */
export async function rasterizeSvgToRgba(
  svg: string, width: number, height: number,
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const { Resvg } = await import('@resvg/resvg-js');
  const r = new Resvg(sizeSvg(svg, width, height), {
    fitTo: { mode: 'original' },
    font: { fontDirs: [FONTS_DIR], loadSystemFonts: true },
  });
  const img = r.render();
  const src = img.pixels;
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3]!;
    if (a === 0) { out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0; continue; }
    if (a === 255) { out[i] = src[i]!; out[i + 1] = src[i + 1]!; out[i + 2] = src[i + 2]!; out[i + 3] = 255; continue; }
    out[i] = Math.min(255, Math.round((src[i]! * 255) / a));
    out[i + 1] = Math.min(255, Math.round((src[i + 1]! * 255) / a));
    out[i + 2] = Math.min(255, Math.round((src[i + 2]! * 255) / a));
    out[i + 3] = a;
  }
  return { data: out, width: img.width, height: img.height };
}

// ─── the pro float formats (plans/deeprichpixels.md §6 B3, §10 item 4) ────────

/** HDR view-transform request, in the author's 0–100 dial units (url-mode's
 *  HdrSettings) plus the brand colours to boost. Absent ⇒ no float source. */
export interface DeepHdrRequest {
  /** Brand colours to boost, as sRGB hex. Empty is fine — hdr.ts's includeWhite
   *  default still gives every near-white pixel real headroom. */
  targets?: readonly string[];
  peakNits?: number;
  reach?: number;
  lift?: number;
  richness?: number;
}

/** Thrown when a pro float format is asked for over a source that has no float in
 *  it. Its own class so callers can distinguish "won't" from "can't". */
export class DeepSourceError extends Error {
  constructor(message: string) { super(message); this.name = 'DeepSourceError'; }
}

/**
 * The refusal text, in one place so the CLI, the MCP and the tests all assert the
 * same sentence.
 *
 * DELIBERATE WORDING: it must not contain "browser engine", "needs a browser",
 * "requires an", "<svg>" or "chromium" — shells/cli/src/run.ts pattern-matches
 * those to fall back to writing HTML, and this refusal must fail loudly instead of
 * silently handing the user a .html file.
 */
export function deepSourceRefusal(format: string): string {
  const f = format.toLowerCase();
  return (
    `"${f}" is a floating-point format, and this render has no floating-point pixels behind it: ` +
    'the terminal render path rasterises the tool\'s vector output to 8-bit sRGB (resvg), so writing ' +
    'it as float samples would pad 8 bits of picture into 16 or 32 without adding any. ' +
    'Add hdr=1 (--hdr=1) to route the render through the HDR view transform, which generates genuine ' +
    'above-1.0 float headroom from continuous float maths rather than padding. ' +
    'Deep sources from ingest (16-bit PNG/TIFF) and float vector rendering are later phases. ' +
    'See plans/deeprichpixels.md section 10 - depth follows provenance.'
  );
}

/**
 * Map the author's 0–100 dials onto the engine's HdrBoostOptions.
 *
 * DUPLICATE of `hdrTune` in shells/web/src/bridge/export.ts (a web-shell-private
 * function this package cannot import). Kept identical on purpose so a CLI EXR and
 * a web HDR PNG of the same link agree on what "reach 45" means; if one moves the
 * other must move with it.
 */
function hdrTune(h: DeepHdrRequest): Record<string, number> {
  const t: Record<string, number> = {};
  if (h.peakNits != null) t.peakNits = h.peakNits;
  if (h.reach != null) {
    const r = Math.min(1, Math.max(0, h.reach / 100));
    const center = 0.65 - 0.45 * r;
    t.kneeLo = Math.max(0, center - 0.12);
    t.kneeHi = Math.min(1, center + 0.12);
  }
  if (h.lift != null) t.boostFloor = Math.min(1, Math.max(0, h.lift / 100));
  if (h.richness != null) t.richness = Math.min(1, Math.max(0, h.richness / 100));
  return t;
}

export interface DeepRasterRequest {
  /** The tool's own SVG (the DOM-free render). */
  svg: string;
  width: number;
  height: number;
  /** 'exr' | 'hdr'. */
  format: string;
  /** The `hdr=` request. Absent/null ⇒ refuse (see deepSourceRefusal). */
  hdr?: DeepHdrRequest | null;
  /** The `depth=` request. Only 'float' changes anything here (float32 EXR
   *  instead of the default half); everything else is noted via `log`. */
  depth?: 8 | 16 | 'float' | 'auto';
  log?: (level: 'info' | 'warn', message: string) => void;
}

/**
 * SVG → OpenEXR / Radiance `.hdr`, browser-free, via the engine's own writers.
 *
 * The one honest float source available to a terminal render today is the HDR view
 * transform: `fromU8Srgb` linearises the 8-bit raster and `hdrViewTransform` then
 * pushes matched brand colours and near-whites up to `peakNits / 203` in LINEAR
 * light — values above 1.0 that no integer container can hold at all. Those bits
 * are *generated* by continuous float maths (the OKLab match, the smoothstep knee,
 * the Rec.709→2020 matrix), which is the same honesty argument §9b made for the
 * 16-bit HDR PNG. What is NOT claimed is a deeper *source*: the underlying raster
 * is still 256 levels per channel, and without `hdr=` there is nothing above 1.0
 * to preserve — hence the refusal.
 */
export async function renderDeepRaster(req: DeepRasterRequest): Promise<{ bytes: Uint8Array; mime: string }> {
  const fmt = req.format.toLowerCase();
  if (!isDeepFormat(fmt)) throw new DeepSourceError(`renderDeepRaster: unsupported format "${req.format}"`);
  if (!req.hdr) throw new DeepSourceError(deepSourceRefusal(fmt));

  const raster = await rasterizeSvgToRgba(req.svg, req.width, req.height);
  const sdr = fromU8Srgb(raster.data, raster.width, raster.height);
  // rec2020-linear, unbounded, 1.0 == SDR reference white (203 nits).
  const frame: DeepFrame = hdrViewTransform(sdr, {
    targets: req.hdr.targets ?? [],
    ...hdrTune(req.hdr),
  });

  if (fmt === 'hdr') {
    // Radiance ignores `depth`: RGBE is one shared exponent per pixel, full stop.
    if (req.depth === 'float' || req.depth === 16 || req.depth === 8) {
      req.log?.('info', `Note: depth=${req.depth} is not a Radiance .hdr option — RGBE is 8-bit mantissas with one shared exponent per pixel. Wrote RGBE.`);
    }
    return {
      bytes: packRadiance(frame, { software: 'Lolly', comments: ['Rec.2020 primaries, linear light, 1.0 = 203 nits (BT.2408 diffuse white)'] }),
      mime: deepFormatMime('hdr'),
    };
  }

  // EXR: depth=float is the FIRST CLI consumer of the depth param — it selects
  // 32-bit FLOAT samples over the default 16-bit HALF. 8/16/auto keep half, which
  // is what every DCC writes and what the frame's precision actually justifies.
  let pixelType: ExrPixelType = 'half';
  if (req.depth === 'float') pixelType = 'float';
  else if (req.depth === 8 || req.depth === 16) {
    req.log?.('info', `Note: depth=${req.depth} has no OpenEXR sample type (EXR is float-only) — wrote HALF. Use depth=float for 32-bit samples.`);
  }
  return {
    bytes: packExr(frame, {
      pixelType,
      attributes: {
        comments: 'Linear light, 1.0 = 203 nits (BT.2408 diffuse white); above 1.0 is HDR headroom',
        software: 'Lolly',
      },
    }),
    mime: deepFormatMime('exr'),
  };
}

/**
 * matchExportFormat (web parity — shells/web/src/views/tool-actions.ts): a manifest can
 * flag one `asset`/`file` input so the export format DEFAULTS to the uploaded file's own
 * format (a dropped JPEG → jpg) until the user picks one explicitly. Reads `format` off
 * a resolved AssetRef, or the mime subtype off a FileRef, normalises the synonyms
 * (jpeg→jpg, svg+xml→svg), and only answers with a format the tool actually declares.
 * Returns null when the flag is absent, the input is empty, or the format isn't offered.
 */
export function matchedExportFormat(
  manifest: { inputs?: Array<{ id: string; matchExportFormat?: boolean }>; render?: { formats?: string[] } },
  model: ReadonlyArray<{ id: string; value: unknown }>,
): string | null {
  const flagged = (manifest.inputs ?? []).find(i => i.matchExportFormat);
  if (!flagged) return null;
  const v = model.find(m => m.id === flagged.id)?.value as { format?: string; mime?: string } | null | undefined;
  if (!v || typeof v !== 'object') return null;
  let f = (v.format ? String(v.format) : v.mime ? String(v.mime).split('/')[1] ?? '' : '').toLowerCase();
  if (f === 'jpeg') f = 'jpg';
  if (f === 'svg+xml') f = 'svg';
  const formats = (manifest.render?.formats ?? []).map(x => x.toLowerCase());
  return f && formats.includes(f) ? f : null;
}
