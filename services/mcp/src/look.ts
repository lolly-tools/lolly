// SPDX-License-Identifier: MPL-2.0
/**
 * The looking tools (plans/289 section 6): lolly_look, lolly_sample_color and
 * lolly_trace_edges. They let an agent see a render in the render's own
 * coordinates instead of guessing from a small picture.
 *
 *   - lolly_look draws the render, or one region of it at full size, with a
 *     labelled grid. The numbers on the grid are document units: the SVG's
 *     viewBox, which for Design is the artboard's pixel space, so they are the
 *     numbers a layer's x, y, w and h use.
 *   - lolly_sample_color reads the colours at points and gives the nearest
 *     colour of the active design system, with its distance.
 *   - lolly_trace_edges returns the picture's edges as polylines in document
 *     units, optionally as ready Design path layers.
 *
 * Each works on a tool render (the same toolId / inputs / layerOperations as
 * lolly_render) or on an image the agent supplies. What it returns is for
 * looking: never an export, never stamped, never linked.
 *
 * THE RASTERISER READS LOCAL FILES. resvg resolves an `<image href>` that is a
 * file path, and has no switch to stop that, so a supplied SVG could otherwise
 * make the server draw any image on its disk into the answer. Every SVG is
 * therefore cleaned before resvg sees it (`cleanImageRefs`): only `#` fragments
 * and strict-base64 `data:` images survive, a `data:` SVG is cleaned
 * recursively, and a local reference is inlined only when it resolves inside
 * the profile's own content (catalog, tool packs, shared asset roots), which is
 * where a render's catalog pictures come from.
 */

import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageDimensions } from '@lolly/engine';
import {
  clampRegion, gridOverlaySvg, nearestSwatch, niceGridSpacing, rasterAsSvg, reframeSvg, sampleDisc,
  svgDocumentFrame, viewSize, type ColorSwatch, type PixelImage, type ViewRegion,
} from '../../../engine/src/agent-view.ts';
import { polylineToDesignLayer, traceEdges } from '../../../engine/src/edge-trace.ts';
import type { ContentBlock, ToolCallResult } from './protocol.ts';
import { contentImageRoots, fontsDir } from './paths.ts';
import { withHost } from './host.ts';
import { MAX_TRANSFORM_INPUT_BYTES, maxRasterPixelsFor } from './render.ts';
import { RasterCrash, rasterInChild } from './raster-child.ts';
import { isHostedServer } from './rebrand.ts';

/** What tools.ts renders for a look: the tool's own SVG when it draws vector,
 *  else its first raster format. */
export type LookRender = (args: Record<string, unknown>) => Promise<
  { bytes: Uint8Array; mime: string; format: string; warnings: string[] } | { error: string }
>;

/** The schema fragments tools.ts shares, so these tools take a source exactly
 *  as lolly_render takes one. */
export interface LookSchemaParts {
  toolId: unknown; inputs: unknown; template: Record<string, unknown>; layerOperations: unknown; layerPatches: unknown; file: unknown;
}

const REGION_ARG = {
  type: 'object',
  description: 'A rectangle in document units (x, y, w, h). Left out for the whole document.',
  properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } },
  required: ['x', 'y', 'w', 'h'],
  additionalProperties: false,
};

const SOURCE_NOTE = 'Give a toolId with its inputs (as lolly_render takes them) or a file (PNG, JPEG, GIF, WebP or SVG).';

export function lookToolDefs(p: LookSchemaParts) {
  const source = {
    toolId: p.toolId, inputs: p.inputs, ...p.template, layerOperations: p.layerOperations, layerPatches: p.layerPatches, file: p.file,
  };
  return [
    {
      name: 'lolly_look',
      description: 'Look at a render with a labelled coordinate grid, or at one region of it enlarged. '
        + 'The grid numbers are document units: for Design, the artboard pixels that a layer\'s x, y, w and h use, '
        + 'so you can place and check layers by reading the picture. For looking only; not an export. ' + SOURCE_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          ...source,
          grid: { description: 'Grid spacing in document units; true (the default) picks a round spacing, false or 0 draws none.', oneOf: [{ type: 'number', minimum: 0 }, { type: 'boolean' }] },
          region: REGION_ARG,
          maxSide: { type: 'number', minimum: 128, maximum: 2048, description: 'Longest side of the returned image in pixels (default 1024). A region is enlarged to fill it, up to 8 times.' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'lolly_sample_color',
      description: 'Read the colours at points of a render or image, each averaged over a small disc, and name the nearest '
        + 'colour of the active design system with its distance (ΔE in OKLab; about 0.02 is just noticeable). '
        + 'Use it to check that a colour is a brand colour, or to pick one from a photo. ' + SOURCE_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          ...source,
          points: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, description: 'Points as [[x, y], ...] in document units.' },
          radius: { type: 'number', minimum: 0, maximum: 50, description: 'Radius of the averaged disc in document units (default 2; 0 reads one pixel).' },
        },
        required: ['points'],
        additionalProperties: false,
      },
    },
    {
      name: 'lolly_trace_edges',
      description: 'The edges in a render or image as polylines in document units, longest first, so line work and '
        + 'outlines can follow where a subject really is. With asDesignLayers, each line is also returned as a Design '
        + 'path layer (give it an id) ready for layerOperations. ' + SOURCE_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          ...source,
          region: REGION_ARG,
          detail: { type: 'number', minimum: 0, maximum: 100, description: 'How faint an edge may be, 0 to 100 (default 50).' },
          minLength: { type: 'number', minimum: 0, description: 'Shortest line kept, in document units (default 20).' },
          simplify: { type: 'number', minimum: 0, description: 'How far a line may stray from the edge, in document units (default 2). Higher means fewer points.' },
          maxLines: { type: 'number', minimum: 1, maximum: 500, description: 'At most this many lines (default 50).' },
          maxSide: { type: 'number', minimum: 128, maximum: 2048, description: 'Resolution the edges are found at: longest side in pixels (default 1024).' },
          asDesignLayers: { type: 'boolean', description: 'Also return each line as a Design path layer.' },
        },
        additionalProperties: false,
      },
    },
  ];
}

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

interface LookSource {
  /** A cleaned SVG document in document units. */
  svg: string;
  frame: ViewRegion;
  /** 'document' for a vector render (its viewBox); 'pixels' for a raster. */
  units: 'document' | 'pixels';
  label: string;
  warnings: string[];
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

async function sourceFromBytes(bytes: Uint8Array, mime: string | undefined, roots: readonly string[], label: string, warnings: string[]): Promise<LookSource | { error: string }> {
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

async function lookSource(args: Record<string, unknown>, renderFn: LookRender): Promise<LookSource | { error: string }> {
  const file = args.file as { base64?: unknown; name?: unknown; mime?: unknown } | undefined;
  if (file && args.toolId) return { error: 'Give a toolId or a file, not both.' };
  if (file) {
    if (typeof file.base64 !== 'string') return { error: 'file.base64 is required.' };
    const bytes = Uint8Array.from(Buffer.from(file.base64, 'base64'));
    if (!bytes.length) return { error: 'The file is empty.' };
    if (bytes.length > MAX_TRANSFORM_INPUT_BYTES) return { error: `The file is larger than ${MAX_TRANSFORM_INPUT_BYTES / 1024 / 1024} MB.` };
    return sourceFromBytes(bytes, typeof file.mime === 'string' ? file.mime : undefined, [], typeof file.name === 'string' ? file.name : 'the file', []);
  }
  if (!args.toolId) return { error: SOURCE_NOTE };
  const rendered = await renderFn(args);
  if ('error' in rendered) return rendered;
  const source = await sourceFromBytes(rendered.bytes, rendered.mime, contentImageRoots(), `${String(args.toolId)} (${rendered.format})`, rendered.warnings);
  return source;
}

/** Pixels the fallback may draw for the whole document before cropping. */
const FALLBACK_MAX_PIXELS = 16_000_000;

/**
 * Draw `region` of the source at `width` x `height`, with `overlay` on top, as
 * a PNG or as premultiplied RGBA. Always in a child process (raster-child.ts).
 *
 * The usual way frames the document to the region, so only the region is drawn.
 * resvg has panicked on that for some documents, so when the child crashes the
 * whole document is drawn instead, at a scale capped near FALLBACK_MAX_PIXELS,
 * cropped to the region, and the overlay drawn over that picture. A region
 * enlarged further than the cap allows comes back softer, not missing.
 */
async function drawRegion(src: LookSource, region: ViewRegion, width: number, height: number, overlay: string, want: 'png' | 'rgba'): Promise<{ width: number; height: number; bytes: Uint8Array }> {
  const fontDirs = [fontsDir()];
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

async function pixels(src: LookSource, region: ViewRegion, width: number, height: number): Promise<PixelImage> {
  const out = await drawRegion(src, region, width, height, '', 'rgba');
  return { data: out.bytes, width: out.width, height: out.height, premultiplied: true };
}

/** The pixel area one look may draw: the hosted raster cap when there is one. */
function areaCap(): number {
  return maxRasterPixelsFor(process.env, isHostedServer()) ?? 16_000_000;
}

/** A view size that also respects the server's pixel-area cap. */
function cappedSize(frame: ViewRegion, region: ViewRegion, maxSide: number) {
  let size = viewSize(frame, region, maxSide);
  const cap = areaCap();
  if (size.width * size.height > cap) {
    const k = Math.sqrt(cap / (size.width * size.height));
    const pxPerUnit = size.pxPerUnit * k;
    size = { width: Math.max(1, Math.floor(region.w * pxPerUnit)), height: Math.max(1, Math.floor(region.h * pxPerUnit)), pxPerUnit };
  }
  return size;
}

const num = (v: unknown, dflt: number, lo: number, hi: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const r1 = (v: number) => Math.round(v * 10) / 10;
const fmtRegion = (r: ViewRegion) => `x ${r1(r.x)}, y ${r1(r.y)}, ${r1(r.w)} x ${r1(r.h)}`;

function errorResult(message: string): ToolCallResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// ── the tools ────────────────────────────────────────────────────────────────

export async function callLookTool(name: string, args: Record<string, unknown>, renderFn: LookRender): Promise<ToolCallResult> {
  const source = await lookSource(args, renderFn);
  if ('error' in source) return errorResult(`${name}: ${source.error}`);
  const unitsNote = source.units === 'document'
    ? 'Coordinates are document units (the SVG viewBox; for Design, the artboard pixels a layer\'s x, y, w and h use).'
    : 'Coordinates are the pixels of this image.';
  const warnings = source.warnings.length ? `\nWarnings: ${source.warnings.join('; ')}` : '';

  if (name === 'lolly_look') {
    const region = clampRegion(source.frame, args.region as Partial<ViewRegion> | undefined);
    const size = cappedSize(source.frame, region, num(args.maxSide, 1024, 128, 2048));
    const gridArg = args.grid;
    const spacing = gridArg === false || gridArg === 0 ? 0
      : typeof gridArg === 'number' && gridArg > 0 ? Math.max(gridArg, (Math.max(region.w, region.h)) / 200)
        : niceGridSpacing(Math.max(region.w, region.h));
    const img = await drawRegion(source, region, size.width, size.height, gridOverlaySvg(region, spacing, size.pxPerUnit), 'png');
    const text = [
      `Looking at ${source.label}: document ${fmtRegion(source.frame)}.`,
      `Showing ${region.w >= source.frame.w && region.h >= source.frame.h ? 'the whole document' : `region ${fmtRegion(region)}`} at ${img.width} x ${img.height} px (${r1(size.pxPerUnit * 100) / 100} px per unit).`,
      spacing ? `Grid every ${r1(spacing)} units, numbered on the top and left edges.` : 'No grid.',
      unitsNote,
    ].join('\n') + warnings;
    const content: ContentBlock[] = [{ type: 'text', text }, { type: 'image', data: Buffer.from(img.bytes).toString('base64'), mimeType: 'image/png' }];
    return { content };
  }

  if (name === 'lolly_sample_color') {
    const raw = Array.isArray(args.points) ? args.points : [];
    const points = raw.slice(0, 500).filter((p): p is [number, number] =>
      Array.isArray(p) && p.length === 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))).map(p => [Number(p[0]), Number(p[1])] as [number, number]);
    if (!points.length) return errorResult('lolly_sample_color: points must be [[x, y], ...] with at least one point.');
    const radius = num(args.radius, 2, 0, 50);
    // Draw only the area the points cover, at one pixel per unit where the
    // server's area cap allows, so a disc's radius is measured in real pixels.
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const box = clampRegion(source.frame, {
      x: Math.min(...xs) - radius - 1, y: Math.min(...ys) - radius - 1,
      w: Math.max(...xs) - Math.min(...xs) + 2 * radius + 2, h: Math.max(...ys) - Math.min(...ys) + 2 * radius + 2,
    });
    let pxPerUnit = 1;
    const cap = areaCap();
    if (box.w * box.h > cap) pxPerUnit = Math.sqrt(cap / (box.w * box.h));
    const width = Math.max(1, Math.round(box.w * pxPerUnit)), height = Math.max(1, Math.round(box.h * pxPerUnit));
    const img = await pixels(source, box, width, height);
    const swatches = await withHost({}, async (_dom, host) => {
      try { return (await host.tokens?.colors?.()) as ColorSwatch[] ?? []; } catch { return []; }
    });
    const samples = points.map(([x, y]) => {
      const inside = x >= source.frame.x && y >= source.frame.y && x <= source.frame.x + source.frame.w && y <= source.frame.y + source.frame.h;
      if (!inside) return { x, y, hex: null, note: 'outside the document' };
      const c = sampleDisc(img, (x - box.x) * (width / box.w), (y - box.y) * (height / box.h), radius * pxPerUnit);
      const near = c.hex ? nearestSwatch(c.hex, swatches) : null;
      return {
        x, y, hex: c.hex, rgb: c.rgb, alpha: c.alpha, oklab: c.oklab,
        ...(near ? { nearest: { name: near.swatch.name ?? null, path: near.swatch.path ?? null, ref: near.swatch.ref ?? null, value: near.swatch.value, deltaE: near.deltaE, verdict: near.verdict } } : {}),
      };
    });
    const lines = samples.slice(0, 20).map(s => {
      if (!s.hex) return `(${r1(s.x)}, ${r1(s.y)}): ${'note' in s ? s.note : 'transparent'}`;
      const n = (s as { nearest?: { name: string | null; path: string | null; value: string; deltaE: number; verdict: string } }).nearest;
      return `(${r1(s.x)}, ${r1(s.y)}): ${s.hex}` + (n ? ` - ${n.verdict === 'match' ? 'matches' : n.verdict === 'close' ? 'close to' : 'nearest brand colour'} ${n.name ?? n.path ?? n.value} ${n.value} (ΔE ${n.deltaE})` : '');
    });
    const header = `Sampled ${samples.length} point${samples.length === 1 ? '' : 's'} of ${source.label}, radius ${radius} units. ${unitsNote}`
      + (swatches.length ? ` Compared with ${swatches.length} design-system colour${swatches.length === 1 ? '' : 's'}.` : ' No design-system colours to compare with.');
    return {
      content: [
        { type: 'text', text: [header, ...lines, samples.length > 20 ? `... and ${samples.length - 20} more in the JSON below.` : ''].filter(Boolean).join('\n') + warnings },
        { type: 'text', text: JSON.stringify({ frame: source.frame, units: source.units, radius, samples }, null, 2) },
      ],
    };
  }

  if (name === 'lolly_trace_edges') {
    const region = clampRegion(source.frame, args.region as Partial<ViewRegion> | undefined);
    const size = cappedSize(source.frame, region, num(args.maxSide, 1024, 128, 2048));
    const img = await pixels(source, region, size.width, size.height);
    const k = size.pxPerUnit;
    const edges = traceEdges(img, {
      detail: num(args.detail, 50, 0, 100),
      minLength: num(args.minLength, 20, 0, 1e9) * k,
      simplify: num(args.simplify, 2, 0, 1e9) * k,
      maxLines: num(args.maxLines, 50, 1, 500),
    });
    const toDoc = (px: number, py: number): [number, number] => [r1(region.x + px * (region.w / img.width)), r1(region.y + py * (region.h / img.height))];
    const asLayers = args.asDesignLayers === true;
    const lines = edges.map(e => {
      const points = e.points.map(([x, y]) => toDoc(x, y));
      return {
        points, length: r1(e.length / k), closed: e.closed,
        ...(asLayers && points.length >= 2 ? { layer: polylineToDesignLayer(points, e.closed) } : {}),
      };
    });
    const text = `Traced ${lines.length} edge line${lines.length === 1 ? '' : 's'} in ${source.label}, ${region.w >= source.frame.w && region.h >= source.frame.h ? 'whole document' : `region ${fmtRegion(region)}`}, `
      + `found at ${img.width} x ${img.height} px. ${lines.filter(l => l.closed).length} closed. ${unitsNote}`
      + (asLayers ? ' Each line carries a Design path layer: add an id and pass it to layerOperations as { op: "add", layer }.' : '')
      + warnings;
    return { content: [{ type: 'text', text }, { type: 'text', text: JSON.stringify({ frame: source.frame, region, units: source.units, lines }, null, 2) }] };
  }

  return errorResult(`Unknown tool: ${name}`);
}
