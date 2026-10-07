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
import type { DesignBoxRowV1, TextMeasureFontsV1, TextMeasureSpecV1 } from '@lolly-tools/core';

import { DESIGN_LINE_HEIGHT, designTextPad, layoutDesignText } from './deck-compile.ts';
import type { DesignTextRunV1 } from './design-text.ts';
import { drawDesignText, textMeasureSpecOfRow, type DesignTextDrawV1, type TextShaperV1 } from './design-text-measure.ts';
import { decodeAuthoredPaths } from './geom/authored-url.ts';
import type { Contour } from './geom/path.ts';
import { toCubics } from './geom/spline.ts';
import { colorToHexString } from './css-color.ts';
import { gradientSpecStops, parseGradientSpec } from './gradient-spec.ts';
import { parsePenpotColor } from './draw-color.ts';
import * as pmath from './geom/portable-math.ts';

export const DESIGN_DRAW_VERSION = 0;

export interface DrawBox { x: number; y: number; w: number; h: number }
/** One gradient stop: offset 0..1, an sRGB `#rrggbb` colour and its own opacity. */
export interface DrawStop { offset: number; color: string; opacity: number }
/** A paint. `color` keeps the row's own colour text; resolving tokens is a later slice. */
export type DrawPaint =
  | { kind: 'color'; color: string; opacity?: number }
  | { kind: 'linear'; x1: number; y1: number; x2: number; y2: number; stops: DrawStop[] }
  /** The ellipse through the box corners, as Design writes its radial form. */
  | { kind: 'radial'; stops: DrawStop[] };
/** `inside` is a CSS border: the stroke lies within the box, as Design draws a box outline. Absent is centred on the edge. */
export interface DrawStroke { color: string; opacity?: number; width: number; cap?: string; join?: string; dash?: [number, number]; align?: 'inside' }
/** The turn (degrees, clockwise) and mirror about the box centre, composed `rotate() scale()`. */
export interface DrawPose { rot: number; flipH: boolean; flipV: boolean }
export type DrawShape =
  | { kind: 'rect'; radius: number }
  | { kind: 'ellipse' }
  | { kind: 'path'; contours: Contour[]; evenOdd: boolean };

/** Another row's silhouette, as the polygon Design clips with, in page coordinates. */
export interface DrawClip { points: Array<[number, number]> }
/**
 * A shadow, following Design's `shadow` target. `box` follows the box outline (CSS
 * box-shadow, sigma half the blur), `content` the drawn silhouette (CSS drop-shadow,
 * sigma equal to the blur) and `text` the words (CSS text-shadow, sigma half the blur).
 * A `depth` shadow arrives as `content` with offsets derived from the row's `z`.
 */
export interface DrawShadow { target: 'box' | 'content' | 'text'; dx: number; dy: number; blur: number; color: string; opacity?: number }

interface DrawOpBase {
  /** The row id, so findings, hit-testing and damage can point back at authored state. */
  id: string;
  /** Page coordinates: the frame's top left is the origin. */
  box: DrawBox;
  /** 0..100, as authored; 100 draws without a group opacity. */
  opacity: number;
  pose?: DrawPose;
  /** Present only when compiled with `effects`. */
  clip?: DrawClip;
  /** A CSS `mix-blend-mode` keyword. */
  blend?: string;
  shadow?: DrawShadow;
  /** Gaussian layer blur, sigma in px (CSS `blur()`). */
  blur?: number;
  /** The box outline a `box` shadow follows. */
  outline?: Exclude<DrawShape, { kind: 'path' }>;
  /** Design semantics: the row's text, which the renderer draws on any kind of box. */
  words?: DrawWords;
}

/**
 * A row's text as Design lays it out: the measure spec (the renderer's defaults and
 * clamps applied by the shared row rule), the horizontal alignment and the ink.
 * `layout` is filled by `layoutDesignDrawText` with the host's shaper.
 */
export interface DrawWords {
  spec: TextMeasureSpecV1;
  /** `left`, `center` or `right`; Design centres a row that states none. */
  align: string;
  ink: string;
  inkOpacity?: number;
  layout?: DesignTextDrawV1;
  /**
   * Glyph outlines per line and run, from `outlineDesignDrawText` (the host's
   * `text.toPath`): SVG path data with the baseline at y=0. A run the host could not
   * outline is null and is drawn as text.
   */
  outlines?: Array<Array<string | null>>;
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
  | 'line-height' | 'tracking' | 'text-layout-estimate' | 'non-static-kind' | 'border-style' | 'bound-path' | 'frame-paint'
  | 'fit-text' | 'text-direction' | 'text-unlaid' | 'image-design' | 'text-decoration' | 'text-unoutlined';
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

/**
 * A row's colour as sRGB and opacity, or null when it draws nothing or cannot be read.
 * A `var(...)` or `{token}` names brand data, so `resolve` (the live brand, when the
 * caller has one) answers first; the literal fallback inside `var(--x, #fallback)` is
 * only the authored copy. The same order the Penpot lowering uses.
 */
export function resolveDrawColor(value: string, resolve?: (css: string) => string | null): { color: string; opacity: number } | null {
  const s = value.trim();
  if (!s) return null;
  if (/var\(/i.test(s) || s.startsWith('{')) {
    const live = resolve?.(s) ?? null;
    const parsed = live ? parsePenpotColor(live) : null;
    if (parsed) return { color: parsed.hex, opacity: parsed.alpha };
  }
  const parsed = parsePenpotColor(s);
  if (parsed) return { color: parsed.hex, opacity: parsed.alpha };
  const last = resolve?.(s) ?? null;
  const resolved = last ? parsePenpotColor(last) : null;
  return resolved ? { color: resolved.hex, opacity: resolved.alpha } : null;
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

type ColorOf = (value: string) => { color: string; opacity?: number } | null;
const authoredColor: ColorOf = (value) => (value ? { color: value } : null);

function strokeOf(row: DesignBoxRowV1, color: ColorOf, defaults?: { cap: string; join: string }): DrawStroke | undefined {
  const width = rowNum(row, 'strokeW');
  const paint = color(rowStr(row, 'stroke'));
  if (!paint || !(width > 0)) return undefined;
  const stroke: DrawStroke = { ...paint, width };
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

/** Features this row authors that the compile does not draw (`effects` carries clip, blend, shadow and blur). */
export function designDrawFindings(row: DesignBoxRowV1, opts: { effects?: boolean; semantics?: 'design' | 'preview' } = {}): DrawFeature[] {
  const found: DrawFeature[] = [];
  const set = (key: string) => rowStr(row, key).trim() !== '';
  const blend = rowStr(row, 'blend');
  if (!opts.effects) {
    if (set('clip')) found.push('clip');
    if (blend && blend !== 'normal') found.push('blend');
    const shadow = rowStr(row, 'shadow');
    if (shadow && shadow !== 'none' && shadow !== 'false' && shadow !== '0') found.push('shadow');
    if (rowNum(row, 'blur') > 0) found.push('blur');
  }
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
  if (opts.semantics === 'preview' && kind === 'text' && rowStr(row, 'text')) {
    found.push('text-layout-estimate');
    if (set('lineHeight')) found.push('line-height');
    if (rowNum(row, 'tracking') !== 0) found.push('tracking');
  }
  if (opts.semantics !== 'preview' && rowStr(row, 'text') && !set('textStory') && !set('textFrame')) {
    // The canvas shrinks fitted text until it fits, and lays right-to-left text out by bidi; the measure does neither.
    if (designFlag(row, 'fitText')) found.push('fit-text');
    if (rowStr(row, 'textDirection') === 'rtl') found.push('text-direction');
  }
  // A picture's framing, crop and clip to the box radius are the next slice; the picture is drawn as before.
  if (opts.semantics !== 'preview' && kind === 'image') found.push('image-design');
  if (NON_STATIC.has(kind)) found.push('non-static-kind');
  // A CSS dashed or dotted border spaces its marks to fit each side; an SVG dash pattern does not.
  if (opts.semantics !== 'preview' && kind !== 'path' && rowStr(row, 'stroke') && rowNum(row, 'strokeW') > 0 && /^(dashed|dotted)$/.test(rowStr(row, 'strokeDash'))) found.push('border-style');
  return found;
}

const BLENDS = new Set(['multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']);
const clampTo = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
function turn(px: number, py: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180, c = pmath.cos(r), s = pmath.sin(r);
  return [px * c - py * s, px * s + py * c];
}

/**
 * The silhouette another row clips this one with, as Design's `clipCss` computes it:
 * the mask's rectangle, or a 48-point polygon for an ellipse or circle, turned by the
 * mask's own rotation, in page coordinates. Absent, self-referencing or unknown masks clip nothing.
 */
function clipOf(row: DesignBoxRowV1, byId: ReadonlyMap<string, DesignBoxRowV1> | undefined, offset: { x: number; y: number }): DrawClip | undefined {
  const maskId = rowStr(row, 'clip') || (typeof row.clip === 'number' ? String(row.clip) : '');
  if (!maskId || maskId === rowStr(row, 'id')) return undefined;
  const m = byId?.get(maskId);
  if (!m) return undefined;
  const mw = Math.max(1, rowNum(m, 'w', 1)), mh = Math.max(1, rowNum(m, 'h', 1));
  const mcx = rowNum(m, 'x') + mw / 2 - offset.x, mcy = rowNum(m, 'y') + mh / 2 - offset.y, mrot = rowNum(m, 'rot');
  const shape = rowStr(m, 'shape');
  const local: Array<[number, number]> = shape === 'ellipse' || shape === 'circle'
    ? Array.from({ length: 48 }, (_, i) => { const t = (i / 48) * 2 * Math.PI; return [pmath.cos(t) * mw / 2, pmath.sin(t) * mh / 2]; })
    : [[-mw / 2, -mh / 2], [mw / 2, -mh / 2], [mw / 2, mh / 2], [-mw / 2, mh / 2]];
  return { points: local.map(([x, y]) => { const w = turn(x, y, mrot); return [mcx + w[0], mcy + w[1]]; }) };
}

/** Design's `shadowCss`: the target, offsets and blur, with a `depth` shadow derived from `z`. */
function shadowOf(row: DesignBoxRowV1, color: (value: string) => { color: string; opacity?: number } | null): DrawShadow | undefined {
  const target = rowStr(row, 'shadow');
  if (target === 'depth') {
    const dz = clampTo(rowNum(row, 'z'), -300, 900);
    const tint = color('#00000055');
    return tint ? { target: 'content', dx: 0, dy: Math.round(dz * 0.15 * 100) / 100, blur: Math.round(clampTo(10 + dz * 0.2, 0, 300) * 100) / 100, ...tint } : undefined;
  }
  if (target !== 'box' && target !== 'text' && target !== 'content') return undefined;
  const tint = color(rowStr(row, 'shadowColor') || '#00000055') ?? color('#00000055');
  if (!tint) return undefined;
  return {
    target,
    dx: Math.round(clampTo(rowNum(row, 'shadowX'), -300, 300)),
    dy: Math.round(clampTo(rowNum(row, 'shadowY'), -300, 300)),
    blur: Math.round(clampTo(rowNum(row, 'shadowBlur', 10), 0, 300)),
    ...tint,
  };
}

/** Options for one compile. */
export interface DesignDrawCompileOpts {
  /** Px per unit at a thumbnail rung: path contours under a pixel both ways are left out. */
  thumbScale?: number;
  /** Carry clip, blend, shadow and layer blur as drawing state instead of findings. */
  effects?: boolean;
  /** Every row of the page by id, for clip masks. */
  byId?: ReadonlyMap<string, DesignBoxRowV1>;
  /**
   * `authored` keeps colours as the row writes them (what the preview draws inside the
   * app, where brand variables are live). `resolved` reads each colour to sRGB and
   * opacity through `resolveColor`, so a drawing carries no CSS variable or token.
   */
  colors?: 'authored' | 'resolved';
  /** The live brand, asked first for a `var(...)` or `{token}` colour. */
  resolveColor?: (css: string) => string | null;
  /** The brand's font families by slot, for the text measure (Design's own faces when absent). */
  fonts?: TextMeasureFontsV1;
  /**
   * `design` (the default) follows the Design renderer, the authority on what a row
   * means. `preview` keeps the approximations `framePreviewSvg` drew before the compiler
   * existed (radius on a plain rectangle, a centred outline, unrounded geometry), so the
   * rebrand preview stays byte for byte as it was until that is decided on its own.
   */
  semantics?: 'design' | 'preview';
}

/** CSS `parseFloat`: a leading number, so `50%` reads as 50. */
function leadingNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}
const DESIGN_TRUE = new Set(['true', '1', 'yes', 'on']);
/** The renderer's `boolVal`: true, 1, yes or on, in any case. */
function designFlag(row: DesignBoxRowV1, key: string): boolean {
  const value = row[key];
  return value === true || value === 1 || (typeof value === 'string' && DESIGN_TRUE.has(value.trim().toLowerCase()));
}

/**
 * The box outline Design's `radiusFor` gives a row: an ellipse for `ellipse` and
 * `circle`, a rectangle rounded to half its short side for `pill`, otherwise its radius.
 */
function outlineOf(row: DesignBoxRowV1, box: DrawBox, semantics: 'design' | 'preview' = 'design'): Exclude<DrawShape, { kind: 'path' }> {
  const name = rowStr(row, 'shape');
  const radius = rowNum(row, 'radius');
  if (name === 'ellipse' || name === 'circle') return { kind: 'ellipse' };
  if (semantics === 'preview') return { kind: 'rect', radius: name === 'pill' ? Math.min(box.w, box.h) / 2 : name === 'rounded' ? Math.max(radius, 0) : radius };
  // `radiusFor`: only `rounded` and `pill` round, and CSS shrinks a radius that does not fit.
  const want = name === 'pill' ? Infinity : name === 'rounded' ? Math.max(radius, 0) : 0;
  return { kind: 'rect', radius: Math.min(want, box.w / 2, box.h / 2) };
}

function effectsOf(row: DesignBoxRowV1, box: DrawBox, offset: { x: number; y: number }, opts: DesignDrawCompileOpts, color: ColorOf): Pick<DrawOpBase, 'clip' | 'blend' | 'shadow' | 'blur' | 'outline'> {
  const out: Pick<DrawOpBase, 'clip' | 'blend' | 'shadow' | 'blur' | 'outline'> = {};
  const clip = clipOf(row, opts.byId, offset);
  if (clip) out.clip = clip;
  const blend = rowStr(row, 'blend');
  if (BLENDS.has(blend)) out.blend = blend;
  const shadow = shadowOf(row, color);
  if (shadow) {
    out.shadow = shadow;
    if (shadow.target === 'box') out.outline = outlineOf(row, box, opts.semantics);
  }
  const blur = clampTo(rowNum(row, 'blur'), 0, 300);
  if (blur > 0) out.blur = Math.round(blur * 10) / 10;
  return out;
}

/**
 * One row as one drawing operation, placed against `offset` (the frame's top left).
 * `thumbScale` (px per unit) leaves out path contours under a pixel both ways.
 */
export function compileDesignRow(row: DesignBoxRowV1, offset: { x: number; y: number }, opts: DesignDrawCompileOpts = {}): DrawOp {
  const design = opts.semantics !== 'preview';
  // Design places a box on whole pixels, at least one pixel each way, turned in tenths of a degree.
  const box: DrawBox = design
    ? { x: Math.round(rowNum(row, 'x')) - offset.x, y: Math.round(rowNum(row, 'y')) - offset.y, w: Math.max(1, Math.round(rowNum(row, 'w', 1))), h: Math.max(1, Math.round(rowNum(row, 'h', 1))) }
    : { x: rowNum(row, 'x') - offset.x, y: rowNum(row, 'y') - offset.y, w: Math.max(0, rowNum(row, 'w')), h: Math.max(0, rowNum(row, 'h')) };
  const rot = design ? Math.round(rowNum(row, 'rot') * 10) / 10 : rowNum(row, 'rot');
  const flipH = design ? designFlag(row, 'flipH') : rowFlag(row, 'flipH');
  const flipV = design ? designFlag(row, 'flipV') : rowFlag(row, 'flipV');
  const color: ColorOf = opts.colors === 'resolved'
    ? (value) => { const c = resolveDrawColor(value, opts.resolveColor); return c ? { color: c.color, ...(c.opacity < 1 ? { opacity: c.opacity } : {}) } : null; }
    : authoredColor;
  const base = {
    id: rowStr(row, 'id'),
    box,
    opacity: design ? clampTo(leadingNumber(row.opacity, 100), 0, 100) : rowNum(row, 'opacity', 100),
    ...(rot !== 0 || flipH || flipV ? { pose: { rot, flipH, flipV } } : {}),
    ...(opts.effects ? effectsOf(row, box, offset, opts, color) : {}),
  };
  const kind = rowStr(row, 'kind');
  const fillColor = color(rowStr(row, 'bg'));
  const fill: DrawPaint[] = fillColor ? [{ kind: 'color', ...fillColor }] : [];
  // Design draws a row's text on every kind of box; composed text is laid out elsewhere.
  if (design && rowStr(row, 'text') && !rowStr(row, 'textStory') && !rowStr(row, 'textFrame') && kind !== 'path') {
    const align = rowStr(row, 'align');
    const ink = color(rowStr(row, 'fg') || '#11141f') ?? { color: '#11141f' };
    (base as DrawOpBase).words = {
      spec: textMeasureSpecOfRow(row as Record<string, unknown>, opts.fonts),
      align: align === 'left' || align === 'right' ? align : 'center',
      ink: ink.color,
      ...(ink.opacity !== undefined ? { inkOpacity: ink.opacity } : {}),
    };
  }
  if (kind === 'image') {
    // `alt` is not one of Design's own field ids, so a document that has been through
    // Design carries none; the row's name comes next, and a plain sentence last.
    return { ...base, op: 'image', ref: rowStr(row, 'image'), fit: rowStr(row, 'fit'), label: rowStr(row, 'alt') || rowStr(row, 'name') || 'Picture not available here' };
  }
  if (kind === 'text' && !design) {
    const grad = gradientOf(row, box);
    const fills: DrawPaint[] = [...fill, ...(grad ? [grad] : [])];
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
        ink: color(rowStr(row, 'fg') || '#111111')?.color ?? '#111111',
      },
    };
  }
  if (kind === 'path') {
    // Design paints a path's `bg` and outline; a gradient is not applied to path boxes.
    return {
      ...base, op: 'shape',
      shape: { kind: 'path', contours: pathContours(row, box, opts.thumbScale), evenOdd: rowStr(row, 'fillRule') === 'evenodd' },
      fills: fill,
      ...(() => { const stroke = strokeOf(row, color, { cap: 'round', join: 'round' }); return stroke ? { stroke } : {}; })(),
    };
  }
  // A circle is an ellipse the editor keeps square, and a pill is a rectangle rounded
  // to half its short side, the two Design's own `radiusFor` maps to 50% and 9999px.
  const shape: DrawShape = outlineOf(row, box, opts.semantics);
  const stroke = strokeOf(row, color);
  // A CSS border lies inside the box, and the gradient image is sized to the padding box within the border.
  if (design && stroke) stroke.align = 'inside';
  const inset = design && stroke ? Math.min(stroke.width, box.w / 2, box.h / 2) : 0;
  const grad = gradientOf(row, inset ? { x: box.x + inset, y: box.y + inset, w: box.w - inset * 2, h: box.h - inset * 2 } : box);
  // Design paints `bg` under the gradient, so a row with both draws both, in that order.
  const fills: DrawPaint[] = [...fill, ...(grad ? [grad] : [])];
  return { ...base, op: 'shape', shape, fills, ...(stroke ? { stroke } : {}) };
}

/**
 * One frame's rows as a page. `rows` are in paint order and placed against the frame
 * row, which leads them when present; hidden rows draw nothing.
 */
export function compileDesignDraw(rows: readonly DesignBoxRowV1[], size: { width: number; height: number }, opts: DesignDrawCompileOpts = {}): DesignDrawPage {
  const head = rows[0];
  const framed = head !== undefined && rowStr(head, 'kind') === 'frame';
  const round = opts.semantics !== 'preview' ? Math.round : (n: number) => n;
  const offset = framed ? { x: round(rowNum(head, 'x')), y: round(rowNum(head, 'y')) } : { x: 0, y: 0 };
  const ground = framed ? rowStr(head, 'bg') : '';
  const background = opts.colors === 'resolved' && ground ? resolveDrawColor(ground, opts.resolveColor)?.color ?? '' : ground;
  const page: DesignDrawPage = { version: DESIGN_DRAW_VERSION, width: size.width, height: size.height, background, ops: [], findings: [] };
  const byId = opts.byId ?? new Map(rows.map((row) => [rowStr(row, 'id') || String(row.id ?? ''), row]));
  const design = opts.semantics !== 'preview';
  const hidden = (row: DesignBoxRowV1) => (design ? designFlag(row, 'hidden') : rowFlag(row, 'hidden'));
  // A hidden frame drops its whole page in Design.
  if (framed && design && hidden(head)) return page;
  if (framed && design && (rowStr(head, 'grad') || head.image || (rowStr(head, 'stroke') && rowNum(head, 'strokeW') > 0) || rowNum(head, 'radius') > 0 || rowStr(head, 'shadow') || leadingNumber(head.opacity, 100) < 100 || rowStr(head, 'blend'))) {
    page.findings.push({ id: rowStr(head, 'id'), feature: 'frame-paint' });
  }
  for (const row of rows) {
    const kind = rowStr(row, 'kind');
    if (kind === 'frame' || hidden(row)) continue;
    // Audio and camera boxes leave no mark on the page; a bound connector is routed, not drawn as authored.
    if (design && (kind === 'audio' || kind === 'camera')) continue;
    if (design && kind === 'path' && (rowStr(row, 'bindStart') || rowStr(row, 'bindEnd'))) { page.findings.push({ id: rowStr(row, 'id'), feature: 'bound-path' }); continue; }
    page.ops.push(compileDesignRow(row, offset, { ...opts, byId }));
    for (const feature of designDrawFindings(row, opts)) page.findings.push({ id: rowStr(row, 'id'), feature });
  }
  return page;
}

/**
 * Lay out every text block of a page with the host's shaper, the same breaks, faces and
 * line boxes `measureDesignText` reports. A block whose fonts the shaper cannot supply
 * keeps no layout and is reported, so no text is drawn from a guess.
 */
export async function layoutDesignDrawText(page: DesignDrawPage, shaper: TextShaperV1): Promise<void> {
  for (const op of page.ops) {
    if (!op.words) continue;
    try { op.words.layout = await drawDesignText(op.words.spec, shaper, { align: op.words.align }); }
    catch { page.findings.push({ id: op.id, feature: 'text-unlaid' }); }
  }
}

/** The host text-to-path call, typed as in `HostV1.text.toPath`. */
export type DrawTextToPath = (opts: { text: string; fontUrl: string; fontSize: number; features?: string[]; letterSpacing?: number; variations?: string[] }) => Promise<{ d: string }>;

/**
 * Outline every laid-out run with the host's `text.toPath`, in the face file and axes
 * the measure chose, so the words travel as shapes and the drawing needs no font.
 * Underline and strike-through are not outlined and are reported; a run the host
 * cannot outline stays text and is reported.
 */
export async function outlineDesignDrawText(page: DesignDrawPage, toPath: DrawTextToPath): Promise<void> {
  for (const op of page.ops) {
    const words = op.words, layout = words?.layout;
    if (!words || !layout) continue;
    const m = layout.measure;
    const features = [...(words.spec.ligatures === false || m.tracking !== 0 ? ['liga=0', 'clig=0'] : []), ...(words.spec.alternates ? ['salt=1'] : [])];
    let decorated = false, missing = false;
    words.outlines = [];
    for (const line of layout.lines) {
      const row: Array<string | null> = [];
      for (const run of line.runs) {
        if (run.underline || run.strike) decorated = true;
        if (!run.text.trim() || !run.face.file) { row.push(run.text.trim() ? null : ''); if (run.text.trim()) missing = true; continue; }
        try {
          const variations = run.face.variations ? Object.entries(run.face.variations).map(([axis, value]) => `${axis}=${value}`) : undefined;
          const { d } = await toPath({ text: run.text, fontUrl: run.face.file, fontSize: m.size, ...(features.length ? { features } : {}), ...(m.tracking ? { letterSpacing: m.tracking } : {}), ...(variations ? { variations } : {}) });
          row.push(d);
        } catch { row.push(null); missing = true; }
      }
      words.outlines.push(row);
    }
    if (decorated) page.findings.push({ id: op.id, feature: 'text-decoration' });
    if (missing) page.findings.push({ id: op.id, feature: 'text-unoutlined' });
  }
}
