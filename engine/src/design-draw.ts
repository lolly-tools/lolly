// SPDX-License-Identifier: MPL-2.0
/**
 * Authored Design rows compiled into drawing operations (plan 295, phase 3, P3a).
 *
 * In the document model (`docs/spec/document-model/`) the authored rows are the
 * instance record, and these operations are the rendering half of an evaluation:
 * each row's meaning resolved once, as plain data, so a preview, an exporter or a
 * GPU renderer draws from the same answer instead of reconstructing the row. The shape
 * here is engine-internal and versioned (`DESIGN_DRAW_VERSION`). It is not a shared
 * type, and nothing persists these operations.
 *
 * Version 0 covers what `framePreviewSvg` already drew from the same rows, and draws
 * it the same way: rectangles, rounded and pill rectangles, ellipses and circles,
 * authored paths lowered to cubics, solid fills, linear and radial gradients with
 * per-stop opacity, outlines with caps, joins and dashes, opacity, the turn and
 * mirror about the box centre, images with their `fit`, and text wrapped by the
 * average-advance estimate inside its pad. Every other authored feature a row carries
 * is reported as a finding, never dropped without a word, so a consumer can refuse or
 * label an output that would lose the feature.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */
import type { DesignBoxRowV1 } from '@lolly-tools/core';

import { DESIGN_LINE_HEIGHT, designTextPad, layoutDesignText } from './deck-compile.ts';
import type { DesignTextRunV1 } from './design-text.ts';
import { decodeAuthoredPaths } from './geom/authored-url.ts';
import type { Contour } from './geom/path.ts';
import { toCubics } from './geom/spline.ts';
import { colorToHexString } from './css-color.ts';
import { gradientSpecStops, parseGradientSpec } from './gradient-spec.ts';

export const DESIGN_DRAW_VERSION = 0;

export interface DrawBox { x: number; y: number; w: number; h: number }
/** One gradient stop: offset 0..1, an sRGB `#rrggbb` colour and its own opacity. */
export interface DrawStop { offset: number; color: string; opacity: number }
/** A paint. `color` keeps the row's own colour text; resolving tokens is a later slice. */
export type DrawPaint =
  | { kind: 'color'; color: string }
  | { kind: 'linear'; x1: number; y1: number; x2: number; y2: number; stops: DrawStop[] }
  /** The ellipse through the box corners, as Design writes its radial form. */
  | { kind: 'radial'; stops: DrawStop[] };
export interface DrawStroke { color: string; width: number; cap?: string; join?: string; dash?: [number, number] }
/** The turn (degrees, clockwise) and mirror about the box centre, composed `rotate() scale()`. */
export interface DrawPose { rot: number; flipH: boolean; flipV: boolean }
export type DrawShape =
  | { kind: 'rect'; radius: number }
  | { kind: 'ellipse' }
  | { kind: 'path'; contours: Contour[]; evenOdd: boolean };

interface DrawOpBase {
  /** The row id, so findings, hit-testing and damage can point back at authored state. */
  id: string;
  /** Page coordinates: the frame's top left is the origin. */
  box: DrawBox;
  /** 0..100, as authored; 100 draws without a group opacity. */
  opacity: number;
  pose?: DrawPose;
}
/** Fills paint in order, under first; the stroke goes with the last fill. */
export interface DrawShapeOp extends DrawOpBase { op: 'shape'; shape: DrawShape; fills: DrawPaint[]; stroke?: DrawStroke }
export interface DrawImageOp extends DrawOpBase {
  op: 'image';
  /** The authored asset reference, which a consumer resolves. */
  ref: string;
  fit: string;
  /** What to show a person when the reference cannot be drawn. */
  label: string;
}
export interface DrawTextBlock {
  /** The box inside the row's pad, where the lines are laid out. */
  inner: DrawBox;
  size: number;
  lines: DesignTextRunV1[][];
  /** Leading spaces per line, in average advances. */
  indents: number[];
  lineHeight: number;
  align: string;
  valign: string;
  /** The authored font: a Design slot (`sans`, `display`, `mono`), a family, or empty. */
  font: string;
  weight: number;
  ink: string;
}
/** A text row: its box fills, then its words, clipped to the box as Design clips them. */
export interface DrawTextOp extends DrawOpBase { op: 'text'; fills: DrawPaint[]; text: DrawTextBlock | null }
export type DrawOp = DrawShapeOp | DrawImageOp | DrawTextOp;

/** An authored feature version 0 does not carry yet. */
export type DrawFeature =
  | 'clip' | 'blend' | 'shadow' | 'blur' | 'background-blur' | 'tilt' | 'vector-paint'
  | 'composed-text' | 'dash-pattern' | 'arrowheads' | 'conic-gradient' | 'image-position'
  | 'line-height' | 'tracking' | 'text-layout-estimate' | 'non-static-kind';
export interface DrawFinding { id: string; feature: DrawFeature }

export interface DesignDrawPage {
  version: typeof DESIGN_DRAW_VERSION;
  width: number;
  height: number;
  /** The frame row's own fill, or empty for the consumer's default ground. */
  background: string;
  ops: DrawOp[];
  findings: DrawFinding[];
}

export function rowStr(row: DesignBoxRowV1, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

export function rowNum(row: DesignBoxRowV1, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function rowFlag(row: DesignBoxRowV1, key: string): boolean {
  const value = row[key];
  return value === true || value === 'true' || value === 1 || value === '1';
}

/** A row's `grad` as a paint over `box`, or null when absent, unreadable or conic. */
function gradientOf(row: DesignBoxRowV1, box: DrawBox): DrawPaint | null {
  const spec = rowStr(row, 'grad');
  if (!spec) return null;
  const g = parseGradientSpec(spec);
  if (!g || g.kind === 'conic') return null;
  const baked = gradientSpecStops(g);
  if (baked.length < 2) return null;
  const stops = baked.map((s): DrawStop => {
    const hex = colorToHexString(s.color);
    return {
      offset: Math.max(0, Math.min(100, s.pos)) / 100,
      color: hex.slice(0, 7),
      opacity: hex.length === 9 ? Number.parseInt(hex.slice(7, 9), 16) / 255 : 1,
    };
  });
  if (g.kind === 'radial') return { kind: 'radial', stops };
  // The CSS gradient line of the box: length |w sin a| + |h cos a|, through the centre.
  const rad = (g.angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(box.w * dx) + Math.abs(box.h * dy)) / 2;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return { kind: 'linear', x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half, stops };
}

function strokeOf(row: DesignBoxRowV1, defaults?: { cap: string; join: string }): DrawStroke | undefined {
  const color = rowStr(row, 'stroke');
  const width = rowNum(row, 'strokeW');
  if (!color || !(width > 0)) return undefined;
  const stroke: DrawStroke = { color, width };
  if (defaults) {
    stroke.cap = rowStr(row, 'strokeCap') || defaults.cap;
    stroke.join = rowStr(row, 'strokeJoin') || defaults.join;
  }
  if (rowStr(row, 'strokeDash') === 'dashed') stroke.dash = [rowNum(row, 'strokeDashLen') || width * 3, rowNum(row, 'strokeGapLen') || width * 2];
  return stroke;
}

/** Whether a contour, its nodes in box fractions, spans under a pixel both ways at `scale`. */
function subPixel(nodes: ReadonlyArray<{ x: number; y: number }>, w: number, h: number, scale: number): boolean {
  if (nodes.length === 0) return true;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }
  return (maxX - minX) * w * scale < 1 && (maxY - minY) * h * scale < 1;
}

/** Every authored contour scaled from box fractions to the row's size and lowered to cubics. */
function pathContours(row: DesignBoxRowV1, box: DrawBox, thumbScale?: number): Contour[] {
  const paths = decodeAuthoredPaths(rowStr(row, 'path'));
  if (!paths || paths.length === 0) return [];
  const w = Math.max(1, box.w);
  const h = Math.max(1, box.h);
  const contours: Contour[] = [];
  for (const path of paths) {
    if (thumbScale !== undefined && subPixel(path.nodes, w, h, thumbScale)) continue;
    const nodes = path.nodes.map((n) => ({
      ...n,
      x: box.x + n.x * w,
      y: box.y + n.y * h,
      ...(n.hInX !== undefined ? { hInX: n.hInX * w } : {}),
      ...(n.hInY !== undefined ? { hInY: n.hInY * h } : {}),
      ...(n.hOutX !== undefined ? { hOutX: n.hOutX * w } : {}),
      ...(n.hOutY !== undefined ? { hOutY: n.hOutY * h } : {}),
    }));
    try {
      const curves = toCubics({ ...path, nodes });
      if (curves.length) contours.push({ curves, closed: path.closed });
    } catch {
      // A node set the lowering refuses draws nothing, as Design draws that path.
    }
  }
  return contours;
}

const NON_STATIC = new Set(['audio', 'camera', '3d', 'web']);
const DEFAULT_FONT_SIZE = 16;

/** Features this row authors that version 0 does not draw. */
export function designDrawFindings(row: DesignBoxRowV1): DrawFeature[] {
  const found: DrawFeature[] = [];
  const set = (key: string) => rowStr(row, key).trim() !== '';
  const blend = rowStr(row, 'blend');
  if (set('clip')) found.push('clip');
  if (blend && blend !== 'normal') found.push('blend');
  const shadow = rowStr(row, 'shadow');
  if (shadow && shadow !== 'none' && shadow !== 'false' && shadow !== '0') found.push('shadow');
  if (rowNum(row, 'blur') > 0) found.push('blur');
  if (rowNum(row, 'bgBlur') > 0) found.push('background-blur');
  if (rowNum(row, 'rx') !== 0 || rowNum(row, 'ry') !== 0) found.push('tilt');
  if (set('pathPaint')) found.push('vector-paint');
  if (set('textStory') || set('textFrame')) found.push('composed-text');
  if (set('strokeDashArray')) found.push('dash-pattern');
  for (const end of ['headStart', 'headEnd']) if (set(end) && rowStr(row, end) !== 'none') { found.push('arrowheads'); break; }
  const grad = rowStr(row, 'grad');
  if (grad && parseGradientSpec(grad)?.kind === 'conic') found.push('conic-gradient');
  const kind = rowStr(row, 'kind');
  if (kind === 'image' && set('imgpos')) found.push('image-position');
  if (kind === 'text' && rowStr(row, 'text')) {
    found.push('text-layout-estimate');
    if (set('lineHeight')) found.push('line-height');
    if (rowNum(row, 'tracking') !== 0) found.push('tracking');
  }
  if (NON_STATIC.has(kind)) found.push('non-static-kind');
  return found;
}

/**
 * One row as one drawing operation, placed against `offset` (the frame's top left).
 * `thumbScale` (px per unit) leaves out path contours under a pixel both ways.
 */
export function compileDesignRow(row: DesignBoxRowV1, offset: { x: number; y: number }, opts: { thumbScale?: number } = {}): DrawOp {
  const box: DrawBox = {
    x: rowNum(row, 'x') - offset.x,
    y: rowNum(row, 'y') - offset.y,
    w: Math.max(0, rowNum(row, 'w')),
    h: Math.max(0, rowNum(row, 'h')),
  };
  const rot = rowNum(row, 'rot');
  const flipH = rowFlag(row, 'flipH');
  const flipV = rowFlag(row, 'flipV');
  const base = {
    id: rowStr(row, 'id'),
    box,
    opacity: rowNum(row, 'opacity', 100),
    ...(rot !== 0 || flipH || flipV ? { pose: { rot, flipH, flipV } } : {}),
  };
  const kind = rowStr(row, 'kind');
  const fill = rowStr(row, 'bg');
  if (kind === 'image') {
    // `alt` is not one of Design's own field ids, so a document that has been through
    // Design carries none; the row's name comes next, and a plain sentence last.
    return { ...base, op: 'image', ref: rowStr(row, 'image'), fit: rowStr(row, 'fit'), label: rowStr(row, 'alt') || rowStr(row, 'name') || 'Picture not available here' };
  }
  if (kind === 'text') {
    const grad = gradientOf(row, box);
    const fills: DrawPaint[] = [...(fill ? [{ kind: 'color' as const, color: fill }] : []), ...(grad ? [grad] : [])];
    const text = rowStr(row, 'text');
    if (!text) return { ...base, op: 'text', fills, text: null };
    const size = rowNum(row, 'fontSize', DEFAULT_FONT_SIZE) || DEFAULT_FONT_SIZE;
    const pad = designTextPad(row);
    const inner = { x: box.x + pad, y: box.y + pad, w: Math.max(0, box.w - pad * 2), h: Math.max(0, box.h - pad * 2) };
    const { lines, indents } = layoutDesignText(text, size, inner.w);
    return {
      ...base, op: 'text', fills,
      text: {
        inner, size, lines, indents, lineHeight: DESIGN_LINE_HEIGHT,
        align: rowStr(row, 'align'),
        // Design centres a row that states no vertical alignment.
        valign: rowStr(row, 'valign') || 'middle',
        font: rowStr(row, 'font').trim(),
        weight: rowNum(row, 'weight'),
        ink: rowStr(row, 'fg') || '#111111',
      },
    };
  }
  if (kind === 'path') {
    // Design paints a path's `bg` and outline; a gradient is not applied to path boxes.
    return {
      ...base, op: 'shape',
      shape: { kind: 'path', contours: pathContours(row, box, opts.thumbScale), evenOdd: rowStr(row, 'fillRule') === 'evenodd' },
      fills: fill ? [{ kind: 'color', color: fill }] : [],
      ...(() => { const stroke = strokeOf(row, { cap: 'round', join: 'round' }); return stroke ? { stroke } : {}; })(),
    };
  }
  // A circle is an ellipse the editor keeps square, and a pill is a rectangle rounded
  // to half its short side, the two Design's own `radiusFor` maps to 50% and 9999px.
  const shapeName = rowStr(row, 'shape');
  const radius = rowNum(row, 'radius');
  const shape: DrawShape = shapeName === 'ellipse' || shapeName === 'circle'
    ? { kind: 'ellipse' }
    : { kind: 'rect', radius: shapeName === 'pill' ? Math.min(box.w, box.h) / 2 : shapeName === 'rounded' ? Math.max(radius, 0) : radius };
  const grad = gradientOf(row, box);
  // Design paints `bg` under the gradient, so a row with both draws both, in that order.
  const fills: DrawPaint[] = [...(fill ? [{ kind: 'color' as const, color: fill }] : []), ...(grad ? [grad] : [])];
  const stroke = strokeOf(row);
  return { ...base, op: 'shape', shape, fills, ...(stroke ? { stroke } : {}) };
}

/**
 * One frame's rows as a page. `rows` are in paint order and placed against the frame
 * row, which leads them when present; hidden rows draw nothing.
 */
export function compileDesignDraw(rows: readonly DesignBoxRowV1[], size: { width: number; height: number }): DesignDrawPage {
  const head = rows[0];
  const framed = head !== undefined && rowStr(head, 'kind') === 'frame';
  const offset = framed ? { x: rowNum(head, 'x'), y: rowNum(head, 'y') } : { x: 0, y: 0 };
  const page: DesignDrawPage = { version: DESIGN_DRAW_VERSION, width: size.width, height: size.height, background: framed ? rowStr(head, 'bg') : '', ops: [], findings: [] };
  for (const row of rows) {
    if (rowStr(row, 'kind') === 'frame' || rowFlag(row, 'hidden')) continue;
    page.ops.push(compileDesignRow(row, offset));
    for (const feature of designDrawFindings(row)) page.findings.push({ id: rowStr(row, 'id'), feature });
  }
  return page;
}
