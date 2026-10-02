// SPDX-License-Identifier: MPL-2.0
/**
 * Looking at a picture in its own coordinates (plans/289 section 6), shared by the
 * MCP tools (lolly_look, lolly_sample_color, lolly_trace_edges) and the CLI verbs
 * (`lolly look`, `lolly sample`, `lolly trace`). Each shell turns its own input
 * into a `LookSource` and its own answer from the plain data returned here, so the
 * two never draw, sample or trace differently.
 *
 *   - lookAt draws the source, or one region of it at full size, with a labelled
 *     grid. The grid numbers are document units: the SVG's viewBox, which for
 *     Design is the artboard's pixel space.
 *   - sampleColors reads the colours at points and gives the nearest design-system
 *     colour with its distance.
 *   - traceSourceEdges returns the picture's edges as polylines in document units,
 *     optionally as Design path layers.
 *
 * THE RASTERISER READS LOCAL FILES. resvg resolves an `<image href>` that is a
 * file path, and has no switch to stop that, so a supplied SVG could otherwise
 * draw any image on the machine's disk into the answer. Every SVG is therefore
 * cleaned before resvg sees it (`cleanImageRefs`): only `#` fragments and
 * strict-base64 `data:` images survive, a `data:` SVG is cleaned recursively, and
 * a local reference is inlined only when it resolves inside `roots`, the
 * profile's own content, which is where a render's catalog pictures come from.
 * Drawing always happens in a child process (raster-child.ts).
 */

import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clampRegion, gridOverlaySvg, imageDimensions, nearestSwatch, niceGridSpacing, polylineToDesignLayer, rasterAsSvg,
  reframeSvg, sampleDisc, svgDocumentFrame, traceEdges, viewSize,
  type ColorSwatch, type DesignPathLayer, type PixelImage, type ViewRegion,
} from '@lolly/engine';
import { RasterCrash, rasterInChild } from './raster-child.ts';

// ── cleaning image references ────────────────────────────────────────────────

const B64 = /^[A-Za-z0-9+/]*={0,2}$/;
const RASTER_DATA = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=\s]*)$/i;
const SVG_DATA = /^data:image\/svg\+xml(;charset=[\w-]+)?(;base64)?,([\s\S]*)$/i;
const IMAGE_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const MAX_INLINE_BYTES = 16 * 1024 * 1024;
const MAX_NESTING = 3;

function localPath(href: string): string | null {
  try {
    if (/^file:\/\//i.test(href)) return fileURLToPath(href);
    if (href.startsWith('/')) return decodeURIComponent(href);
  } catch { /* unreadable path */ }
  return null;
}

/**
 * The SVG with every image reference made safe for resvg. `roots` are the
 * directories a local reference may be inlined from; empty for a supplied file.
 */
export async function cleanImageRefs(svg: string, roots: readonly string[], depth = 0): Promise<string> {
  const re = /(\s(?:xlink:)?href\s*=\s*)("([^"]*)"|'([^']*)')/gi;
  const parts: (string | Promise<string>)[] = [];
  let last = 0;
  for (const m of svg.matchAll(re)) {
    parts.push(svg.slice(last, m.index));
    last = m.index! + m[0].length;
    const prefix = m[1]!, value = (m[3] ?? m[4] ?? '').trim();
    parts.push(cleanRef(value, roots, depth).then(safe => `${prefix}"${safe}"`));
  }
  parts.push(svg.slice(last));
  return (await Promise.all(parts)).join('');
}

async function cleanRef(value: string, roots: readonly string[], depth: number): Promise<string> {
  if (/^#[\w.:-]*$/.test(value)) return value;
  const raster = RASTER_DATA.exec(value);
  if (raster) {
    const data = raster[2]!.replace(/\s+/g, '');
    return B64.test(data) ? `data:image/${raster[1]!.toLowerCase()};base64,${data}` : '';
  }
  const svgData = SVG_DATA.exec(value);
  if (svgData) {
    if (depth >= MAX_NESTING) return '';
    let text: string;
    try {
      if (svgData[2]) {
        const data = svgData[3]!.replace(/\s+/g, '');
        if (!B64.test(data)) return '';
        text = Buffer.from(data, 'base64').toString('utf8');
      } else {
        if (svgData[3]!.includes('&')) return '';
        text = decodeURIComponent(svgData[3]!);
      }
    } catch { return ''; }
    return `data:image/svg+xml;base64,${Buffer.from(await cleanImageRefs(text, roots, depth + 1)).toString('base64')}`;
  }
  const path = roots.length ? localPath(value) : null;
  if (!path) return '';
  const full = resolve(path);
  if (!roots.some(root => full.startsWith(resolve(root) + sep))) return '';
  const mime = IMAGE_TYPES[extname(full).toLowerCase()];
  if (!mime) return '';
  try {
    const bytes = await readFile(full);
    if (bytes.length > MAX_INLINE_BYTES) return '';
    if (mime === 'image/svg+xml') {
      if (depth >= MAX_NESTING) return '';
      return `data:image/svg+xml;base64,${Buffer.from(await cleanImageRefs(bytes.toString('utf8'), roots, depth + 1)).toString('base64')}`;
    }
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch {
    return '';
  }
}

// ── sources ──────────────────────────────────────────────────────────────────

export interface LookSource {
  /** A cleaned SVG document in document units. */
  svg: string;
  frame: ViewRegion;
  /** 'document' for a vector source (its viewBox); 'pixels' for a raster. */
  units: 'document' | 'pixels';
  label: string;
  warnings: string[];
}

/** How a shell's limits reach the core: where fonts are, and the pixel area one
 *  picture may take (a hosted server's raster cap, or a local default). */
export interface LookContext {
  fontDirs: string[];
  areaCap: number;
}

const MAX_SOURCE_PIXELS = 40_000_000;

function sniffSvg(bytes: Uint8Array, mime?: string): boolean {
  if (mime === 'image/svg+xml') return true;
  const head = Buffer.from(bytes.subarray(0, 512)).toString('utf8').trimStart().toLowerCase();
  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));
}

function rasterMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return null;
}

/** An SVG or raster image as a source, or the reason it cannot be one. */
export async function sourceFromBytes(bytes: Uint8Array, mime: string | undefined, roots: readonly string[], label: string, warnings: string[] = []): Promise<LookSource | { error: string }> {
  if (sniffSvg(bytes, mime)) {
    const svg = await cleanImageRefs(Buffer.from(bytes).toString('utf8'), roots);
    const frame = svgDocumentFrame(svg);
    if (!frame) return { error: 'The SVG has no viewBox or size to measure.' };
    if (frame.w * frame.h > 1e12) return { error: 'The SVG is too large to look at.' };
    return { svg, frame, units: 'document', label, warnings };
  }
  const type = rasterMime(bytes);
  if (!type) return { error: 'Not a PNG, JPEG, GIF, WebP or SVG image.' };
  const dims = imageDimensions(bytes);
  if (!dims || dims.w < 1 || dims.h < 1) return { error: 'The image size could not be read.' };
  if (dims.w * dims.h > MAX_SOURCE_PIXELS) return { error: `The image is larger than ${MAX_SOURCE_PIXELS.toLocaleString('en')} pixels.` };
  const svg = rasterAsSvg(type, Buffer.from(bytes).toString('base64'), dims.w, dims.h);
  return { svg, frame: { x: 0, y: 0, w: dims.w, h: dims.h }, units: 'pixels', label, warnings };
}

// ── drawing ──────────────────────────────────────────────────────────────────

/** Pixels the fallback may draw for the whole document before cropping. */
const FALLBACK_MAX_PIXELS = 16_000_000;

/**
 * Draw `region` of the source at `width` x `height`, with `overlay` on top, as
 * a PNG or as premultiplied RGBA. Always in a child process.
 *
 * The usual way frames the document to the region, so only the region is drawn.
 * resvg has panicked on that for some documents, so when the child crashes the
 * whole document is drawn instead, at a scale capped near FALLBACK_MAX_PIXELS,
 * cropped to the region, and the overlay drawn over that picture. A region
 * enlarged further than the cap allows comes back softer, not missing.
 */
export async function drawRegion(src: LookSource, region: ViewRegion, width: number, height: number, overlay: string, want: 'png' | 'rgba', ctx: LookContext): Promise<{ width: number; height: number; bytes: Uint8Array }> {
  const { fontDirs } = ctx;
  try {
    return await rasterInChild({ svg: reframeSvg(src.svg, region, width, height, overlay), want, fontDirs });
  } catch (e) {
    if (!(e instanceof RasterCrash)) throw e;
  }
  const f = src.frame;
  const zoom = Math.min(width / region.w, Math.sqrt(FALLBACK_MAX_PIXELS / (f.w * f.h)));
  const full = reframeSvg(src.svg, f, Math.max(1, Math.round(f.w * zoom)), Math.max(1, Math.round(f.h * zoom)));
  const crop = {
    left: Math.floor((region.x - f.x) * zoom), top: Math.floor((region.y - f.y) * zoom),
    right: Math.ceil((region.x + region.w - f.x) * zoom), bottom: Math.ceil((region.y + region.h - f.y) * zoom),
  };
  const part = await rasterInChild({ svg: full, crop, want: 'png', fontDirs });
  const composed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${region.x} ${region.y} ${region.w} ${region.h}" width="${width}" height="${height}" preserveAspectRatio="none">`
    + `<image href="data:image/png;base64,${Buffer.from(part.bytes).toString('base64')}" x="${crop.left / zoom + f.x}" y="${crop.top / zoom + f.y}" `
    + `width="${(crop.right - crop.left) / zoom}" height="${(crop.bottom - crop.top) / zoom}" preserveAspectRatio="none"/>${overlay}</svg>`;
  return rasterInChild({ svg: composed, want, fontDirs });
}

async function pixels(src: LookSource, region: ViewRegion, width: number, height: number, ctx: LookContext): Promise<PixelImage> {
  const out = await drawRegion(src, region, width, height, '', 'rgba', ctx);
  return { data: out.bytes, width: out.width, height: out.height, premultiplied: true };
}

/** A view size that also respects the pixel-area cap. */
function cappedSize(frame: ViewRegion, region: ViewRegion, maxSide: number, cap: number) {
  let size = viewSize(frame, region, maxSide);
  if (size.width * size.height > cap) {
    const k = Math.sqrt(cap / (size.width * size.height));
    const pxPerUnit = size.pxPerUnit * k;
    size = { width: Math.max(1, Math.floor(region.w * pxPerUnit)), height: Math.max(1, Math.floor(region.h * pxPerUnit)), pxPerUnit };
  }
  return size;
}

const num = (v: unknown, dflt: number, lo: number, hi: number): number => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const r1 = (v: number) => Math.round(v * 10) / 10;

// ── look ─────────────────────────────────────────────────────────────────────

export interface LookOptions {
  region?: Partial<ViewRegion> | null;
  /** Grid spacing in document units; true or absent picks a round spacing, false or 0 draws none. */
  grid?: number | boolean;
  /** Longest side of the picture in pixels, 128 to 2048 (default 1024). */
  maxSide?: number;
}

export interface LookResult {
  png: Uint8Array;
  width: number;
  height: number;
  region: ViewRegion;
  whole: boolean;
  /** Grid spacing in document units; 0 for none. */
  spacing: number;
  pxPerUnit: number;
}

export async function lookAt(src: LookSource, opts: LookOptions, ctx: LookContext): Promise<LookResult> {
  const region = clampRegion(src.frame, opts.region ?? undefined);
  const size = cappedSize(src.frame, region, num(opts.maxSide, 1024, 128, 2048), ctx.areaCap);
  const g = opts.grid;
  const spacing = g === false || g === 0 ? 0
    : typeof g === 'number' && g > 0 ? Math.max(g, Math.max(region.w, region.h) / 200)
      : niceGridSpacing(Math.max(region.w, region.h));
  const img = await drawRegion(src, region, size.width, size.height, gridOverlaySvg(region, spacing, size.pxPerUnit), 'png', ctx);
  return {
    png: img.bytes, width: img.width, height: img.height, region,
    whole: region.w >= src.frame.w && region.h >= src.frame.h, spacing, pxPerUnit: size.pxPerUnit,
  };
}

// ── sample ───────────────────────────────────────────────────────────────────

export interface ColorSample {
  x: number;
  y: number;
  hex: string | null;
  rgb?: [number, number, number] | null;
  alpha?: number;
  oklab?: [number, number, number] | null;
  note?: string;
  nearest?: { name: string | null; path: string | null; ref: string | null; value: string; deltaE: number; verdict: string };
}

export interface SampleOptions {
  points: Array<[number, number]>;
  /** Radius of the averaged disc in document units, 0 to 50 (default 2; 0 reads one pixel). */
  radius?: number;
  /** The design-system colours to name the nearest of. */
  swatches: readonly ColorSwatch[];
}

export async function sampleColors(src: LookSource, opts: SampleOptions, ctx: LookContext): Promise<{ radius: number; samples: ColorSample[] }> {
  const points = opts.points.slice(0, 500);
  const radius = num(opts.radius, 2, 0, 50);
  if (!points.length) return { radius, samples: [] };
  // Draw only the area the points cover, at one pixel per unit where the area cap
  // allows, so a disc's radius is measured in real pixels.
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const box = clampRegion(src.frame, {
    x: Math.min(...xs) - radius - 1, y: Math.min(...ys) - radius - 1,
    w: Math.max(...xs) - Math.min(...xs) + 2 * radius + 2, h: Math.max(...ys) - Math.min(...ys) + 2 * radius + 2,
  });
  let pxPerUnit = 1;
  if (box.w * box.h > ctx.areaCap) pxPerUnit = Math.sqrt(ctx.areaCap / (box.w * box.h));
  const width = Math.max(1, Math.round(box.w * pxPerUnit)), height = Math.max(1, Math.round(box.h * pxPerUnit));
  const img = await pixels(src, box, width, height, ctx);
  const f = src.frame;
  const samples = points.map(([x, y]): ColorSample => {
    if (!(x >= f.x && y >= f.y && x <= f.x + f.w && y <= f.y + f.h)) return { x, y, hex: null, note: 'outside the document' };
    const c = sampleDisc(img, (x - box.x) * (width / box.w), (y - box.y) * (height / box.h), radius * pxPerUnit);
    const near = c.hex ? nearestSwatch(c.hex, opts.swatches) : null;
    return {
      x, y, hex: c.hex, rgb: c.rgb, alpha: c.alpha, oklab: c.oklab,
      ...(near ? { nearest: { name: near.swatch.name ?? null, path: near.swatch.path ?? null, ref: near.swatch.ref ?? null, value: near.swatch.value, deltaE: near.deltaE, verdict: near.verdict } } : {}),
    };
  });
  return { radius, samples };
}

/** One sample as a line of text, the same in every shell. */
export function sampleLine(s: ColorSample): string {
  if (!s.hex) return `(${r1(s.x)}, ${r1(s.y)}): ${s.note ?? 'transparent'}`;
  const n = s.nearest;
  return `(${r1(s.x)}, ${r1(s.y)}): ${s.hex}` + (n ? ` - ${n.verdict === 'match' ? 'matches' : n.verdict === 'close' ? 'close to' : 'nearest brand colour'} ${n.name ?? n.path ?? n.value} ${n.value} (ΔE ${n.deltaE})` : '');
}

// ── trace ────────────────────────────────────────────────────────────────────

export interface TraceOptions {
  region?: Partial<ViewRegion> | null;
  /** How faint an edge may be, 0 to 100 (default 50). */
  detail?: number;
  /** Shortest line kept, in document units (default 20). */
  minLength?: number;
  /** How far a line may stray from the edge, in document units (default 2). */
  simplify?: number;
  /** At most this many lines, 1 to 500 (default 50). */
  maxLines?: number;
  /** Resolution the edges are found at: longest side in pixels, 128 to 2048 (default 1024). */
  maxSide?: number;
  asDesignLayers?: boolean;
}

export interface TracedLine {
  points: Array<[number, number]>;
  length: number;
  closed: boolean;
  layer?: DesignPathLayer;
}

export async function traceSourceEdges(src: LookSource, opts: TraceOptions, ctx: LookContext): Promise<{ region: ViewRegion; whole: boolean; width: number; height: number; lines: TracedLine[] }> {
  const region = clampRegion(src.frame, opts.region ?? undefined);
  const size = cappedSize(src.frame, region, num(opts.maxSide, 1024, 128, 2048), ctx.areaCap);
  const img = await pixels(src, region, size.width, size.height, ctx);
  const k = size.pxPerUnit;
  const edges = traceEdges(img, {
    detail: num(opts.detail, 50, 0, 100),
    minLength: num(opts.minLength, 20, 0, 1e9) * k,
    simplify: num(opts.simplify, 2, 0, 1e9) * k,
    maxLines: num(opts.maxLines, 50, 1, 500),
  });
  const toDoc = (px: number, py: number): [number, number] => [r1(region.x + px * (region.w / img.width)), r1(region.y + py * (region.h / img.height))];
  const lines = edges.map((e): TracedLine => {
    const points = e.points.map(([x, y]) => toDoc(x, y));
    return {
      points, length: r1(e.length / k), closed: e.closed,
      ...(opts.asDesignLayers && points.length >= 2 ? { layer: polylineToDesignLayer(points, e.closed) } : {}),
    };
  });
  return { region, whole: region.w >= src.frame.w && region.h >= src.frame.h, width: img.width, height: img.height, lines };
}

/** A region as words, the same in every shell. */
export const regionText = (r: ViewRegion): string => `x ${r1(r.x)}, y ${r1(r.y)}, ${r1(r.w)} x ${r1(r.h)}`;

/** What the coordinates mean, the same in every shell. */
export const unitsText = (units: LookSource['units']): string => units === 'document'
  ? 'Coordinates are document units (the SVG viewBox; for Design, the artboard pixels a layer\'s x, y, w and h use).'
  : 'Coordinates are the pixels of this image.';
