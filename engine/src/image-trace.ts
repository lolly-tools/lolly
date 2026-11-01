// SPDX-License-Identifier: MPL-2.0
/**
 * image-trace.ts - a traced picture as Design paths (plan 342, K5).
 *
 * The tracing itself is a WASM module the shell loads (`packages/node-shell`,
 * wasm/image-trace). The engine stays wasm-free: a shell supplies an
 * `ImageTraceFn`, the way `readPsdPortable` reaches the PSD module. This file
 * holds the pure parts around it:
 *
 *   - the presets and the pixel cap, so every shell states the same limits;
 *   - `readImageTraceWire`, which checks the module's JSON before anything
 *     else touches it;
 *   - `imageTraceView`, which says which part of an image box shows (object-fit
 *     and object-position) so the trace covers what a person sees;
 *   - `imageTraceToPaths`, which scales the traced shapes into canvas pixels
 *     and builds `GeomPath` contours with a paint.
 *
 * Pure and synchronous; no DOM. Every refusal is an `ImageTraceError`.
 */
import { lineToCubic, type Cubic } from './geom/bezier.ts';
import type { Contour, GeomPath } from './geom/path.ts';

export const IMAGE_TRACE_PRESETS = ['logo', 'illustration', 'line-art', 'centreline'] as const;
export type ImageTracePreset = (typeof IMAGE_TRACE_PRESETS)[number];

/** The module's operation number for each preset. */
export const IMAGE_TRACE_OPS: Readonly<Record<ImageTracePreset, number>> = {
  logo: 1, illustration: 2, 'line-art': 3, centreline: 4,
};

/** The most pixels the module takes (4 megapixels). Shells scale down to `IMAGE_TRACE_WORK_SIDE` first. */
export const IMAGE_TRACE_MAX_PIXELS = 4 * 1024 * 1024;
/** The longest side a shell traces at. A larger image is scaled down, never refused. */
export const IMAGE_TRACE_WORK_SIDE = 1500;
/** Most shapes one trace may put on the canvas. */
export const IMAGE_TRACE_MAX_SHAPES = 1500;
/** Most anchor points one trace may put on the canvas. */
export const IMAGE_TRACE_MAX_ANCHORS = 60_000;

export class ImageTraceError extends Error {
  readonly code: 'invalid' | 'limit' | 'cancelled' | 'failed';
  constructor(code: ImageTraceError['code'], message: string) {
    super(message);
    this.name = 'ImageTraceError';
    this.code = code;
  }
}

/** One traced subpath: anchors as `[x, y, inX, inY, outX, outY]` sextuples, in image pixels. */
export interface TracedSubpath { closed: boolean; anchors: Float64Array }
export interface TracedShape {
  color: readonly [number, number, number];
  /** Stroke width in image pixels; absent for a filled shape. */
  stroke?: number;
  subpaths: TracedSubpath[];
}
export interface ImageTraceResult { width: number; height: number; shapes: TracedShape[] }

/** What a shell supplies: trace straight-alpha RGBA, top row first. */
export type ImageTraceFn = (
  rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, preset: ImageTracePreset,
) => ImageTraceResult | Promise<ImageTraceResult>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Check the module's JSON and give back typed shapes. Throws `ImageTraceError('invalid')`. */
export function readImageTraceWire(value: unknown): ImageTraceResult {
  const bad = (): never => { throw new ImageTraceError('invalid', 'The tracer returned a result that could not be read.'); };
  if (typeof value !== 'object' || value === null) return bad();
  const v = value as { w?: unknown; h?: unknown; paths?: unknown };
  if (!isNum(v.w) || !isNum(v.h) || v.w < 1 || v.h < 1 || !Array.isArray(v.paths)) return bad();
  const shapes: TracedShape[] = [];
  for (const p of v.paths as unknown[]) {
    if (typeof p !== 'object' || p === null) return bad();
    const q = p as { c?: unknown; s?: unknown; d?: unknown };
    if (!Array.isArray(q.c) || q.c.length !== 3 || !q.c.every(n => isNum(n) && n >= 0 && n <= 255) || !Array.isArray(q.d)) return bad();
    if (q.s !== undefined && (!isNum(q.s) || q.s < 0)) return bad();
    const subpaths: TracedSubpath[] = [];
    for (const d of q.d as unknown[]) {
      if (!Array.isArray(d) || d.length < 7 || (d.length - 1) % 6 !== 0 || !d.every(isNum)) return bad();
      subpaths.push({ closed: d[0] === 1, anchors: Float64Array.from(d.slice(1) as number[]) });
    }
    shapes.push({ color: q.c as [number, number, number], ...(q.s !== undefined ? { stroke: q.s as number } : {}), subpaths });
  }
  return { width: v.w, height: v.h, shapes };
}

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * The part of an image box a person sees. `crop` is that part in image pixels (what
 * to trace), `placed` is where it goes in canvas pixels (the box itself for `cover`
 * and `fill`, the letterboxed picture for `contain`).
 */
export interface ImageTraceView { crop: Rect; placed: Rect }

/** `object-position` as two fractions. Keywords and percentages are read; anything else is centred. */
export function imagePositionFractions(position: string | undefined): [number, number] {
  let fx = 0.5, fy = 0.5;
  const parts = String(position ?? 'center').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const pct = (s: string): number | null => (/^-?\d+(\.\d+)?%$/.test(s) ? Math.min(1, Math.max(0, parseFloat(s) / 100)) : null);
  if (parts.length === 2 && pct(parts[0]!) !== null && pct(parts[1]!) !== null) return [pct(parts[0]!)!, pct(parts[1]!)!];
  for (const p of parts) {
    if (p === 'left') fx = 0;
    else if (p === 'right') fx = 1;
    else if (p === 'top') fy = 0;
    else if (p === 'bottom') fy = 1;
  }
  return [fx, fy];
}

/** Which part of an image shows in a box of `box` size at `at`, for `fit` (`contain`, `cover` or `fill`). */
export function imageTraceView(
  box: Rect, imageWidth: number, imageHeight: number, fit: string | undefined, position?: string,
): ImageTraceView {
  if (![box.x, box.y, box.w, box.h, imageWidth, imageHeight].every(isNum) || box.w <= 0 || box.h <= 0 || imageWidth < 1 || imageHeight < 1) {
    throw new ImageTraceError('invalid', 'The image has no size to trace.');
  }
  const whole: Rect = { x: 0, y: 0, w: imageWidth, h: imageHeight };
  if (fit === 'fill') return { crop: whole, placed: { x: box.x, y: box.y, w: box.w, h: box.h } };
  const [fx, fy] = imagePositionFractions(position);
  if (fit === 'cover') {
    const scale = Math.max(box.w / imageWidth, box.h / imageHeight);
    const cw = Math.min(imageWidth, box.w / scale), ch = Math.min(imageHeight, box.h / scale);
    return { crop: { x: (imageWidth - cw) * fx, y: (imageHeight - ch) * fy, w: cw, h: ch }, placed: { x: box.x, y: box.y, w: box.w, h: box.h } };
  }
  const scale = Math.min(box.w / imageWidth, box.h / imageHeight);
  const pw = imageWidth * scale, ph = imageHeight * scale;
  return { crop: whole, placed: { x: box.x + (box.w - pw) * fx, y: box.y + (box.h - ph) * fy, w: pw, h: ph } };
}

/** The size to trace at: the crop scaled so its longest side is at most `side`, never larger than the crop. */
export function imageTraceWorkSize(cropW: number, cropH: number, side = IMAGE_TRACE_WORK_SIDE): { width: number; height: number } {
  const k = Math.min(1, side / Math.max(cropW, cropH));
  let width = Math.max(1, Math.round(cropW * k)), height = Math.max(1, Math.round(cropH * k));
  while (width * height > IMAGE_TRACE_MAX_PIXELS) { width = Math.max(1, Math.floor(width * 0.9)); height = Math.max(1, Math.floor(height * 0.9)); }
  return { width, height };
}

export interface TracePaint { fill?: string; stroke?: string; strokeW?: number }
export interface TracedDesignPath { paint: TracePaint; path: GeomPath; anchors: number }

const hex = (c: readonly [number, number, number]): string =>
  '#' + c.map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');

/**
 * The traced shapes as Design paths in canvas pixels. Image pixel (0, 0) goes to the
 * top left of `placed`, and the traced size `result.width` by `result.height` fills that rectangle.
 * Refuses a result with more shapes or anchors than `IMAGE_TRACE_MAX_*`.
 */
export function imageTraceToPaths(result: ImageTraceResult, placed: Rect): TracedDesignPath[] {
  if (result.shapes.length > IMAGE_TRACE_MAX_SHAPES) {
    throw new ImageTraceError('limit', 'This trace makes too many shapes. Try the logo or line art preset, or a simpler image.');
  }
  const sx = placed.w / result.width, sy = placed.h / result.height;
  const strokeScale = (sx + sy) / 2;
  let total = 0;
  const out: TracedDesignPath[] = [];
  for (const shape of result.shapes) {
    const path: GeomPath = [];
    let anchors = 0;
    for (const sp of shape.subpaths) {
      const a = sp.anchors, n = a.length / 6;
      if (n < 1) continue;
      const pt = (i: number, k: number): [number, number] => [placed.x + a[i * 6 + k]! * sx, placed.y + a[i * 6 + k + 1]! * sy];
      const curves: Cubic[] = [];
      const seg = (i: number, j: number): void => {
        const [x0, y0] = pt(i, 0), [x1, y1] = pt(i, 4), [x2, y2] = pt(j, 2), [x3, y3] = pt(j, 0);
        const straight = x1 === x0 && y1 === y0 && x2 === x3 && y2 === y3;
        curves.push(straight ? lineToCubic(x0, y0, x3, y3) : [x0, y0, x1, y1, x2, y2, x3, y3]);
      };
      for (let i = 0; i + 1 < n; i++) seg(i, i + 1);
      if (sp.closed && n > 1) seg(n - 1, 0);
      if (!curves.length) continue;
      const contour: Contour = { curves, closed: sp.closed };
      path.push(contour);
      anchors += n;
    }
    if (!path.length) continue;
    total += anchors;
    if (total > IMAGE_TRACE_MAX_ANCHORS) {
      throw new ImageTraceError('limit', 'This trace makes too many points for the canvas. Try the logo or line art preset, or a simpler image.');
    }
    const paint: TracePaint = shape.stroke === undefined
      ? { fill: hex(shape.color) }
      : { stroke: hex(shape.color), strokeW: Math.max(0.25, Math.round(shape.stroke * strokeScale * 100) / 100) };
    out.push({ paint, path, anchors });
  }
  return out;
}

/** Trace through the shell's function and check what comes back. */
export async function traceImage(
  fn: ImageTraceFn, rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, preset: ImageTracePreset,
): Promise<ImageTraceResult> {
  if (!IMAGE_TRACE_PRESETS.includes(preset)) throw new ImageTraceError('invalid', 'Choose one of the trace presets.');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new ImageTraceError('invalid', 'The image has no size to trace.');
  if (width * height > IMAGE_TRACE_MAX_PIXELS) throw new ImageTraceError('limit', 'This image is too large to trace. Scale it down first.');
  if (rgba.length !== width * height * 4) throw new ImageTraceError('invalid', 'The pixel data does not match the image size.');
  return fn(rgba, width, height, preset);
}
