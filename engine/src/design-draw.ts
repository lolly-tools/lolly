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
 * Two readings of a row. `design` (the default) follows the Design renderer, the
 * authority on what a row means: whole-pixel boxes, CSS borders inside the box, the
 * renderer's radii and flags, effects as drawing state, text laid out by the engine's
 * measure (`layoutDesignDrawText`, then `outlineDesignDrawText` for glyph outlines),
 * pictures fitted and framed as CSS fits them (`describeDesignDrawPictures` supplies
 * their own size), and the frame's own paint and clip. `preview` keeps the
 * approximations `framePreviewSvg` drew before this compiler existed. Every authored
 * feature a reading does not carry is reported as a finding, never dropped without a
 * word, so a consumer can refuse or label an output that would lose the feature.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */
import type { DesignBoxRowV1, TextMeasureFontsV1, TextMeasureSpecV1 } from '@lolly-tools/core';

import { DESIGN_LINE_HEIGHT, designTextPad, layoutDesignText } from './deck-compile.ts';
import type { DesignTextRunV1 } from './design-text.ts';
import { strikeGeometry, type DrawStrike, type StrikeMetrics } from './text-decoration.ts';
import { DICTIONARY_SCRIPT, drawDesignText, textMeasureSpecOfRow, type DesignTextDrawV1, type TextShaperV1 } from './design-text-measure.ts';
import { segmentEmojiText } from './emoji-segment.ts';
import { decodeAuthoredPaths } from './geom/authored-url.ts';
import type { Contour } from './geom/path.ts';
import type { SubPath } from './svg-path.ts';
import { compileLottieCompatRow } from './design-draw-lottie.ts';
export { lottieCompatNumber } from './design-draw-lottie.ts';
import { compilePenpotCompatRow } from './design-draw-penpot.ts';
import { compilePptxCompatRow } from './design-draw-pptx.ts';
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
  | { kind: 'path'; contours: Contour[]; evenOdd: boolean;
    /** Box-local, evaluated SVG commands retained by the legacy Lottie reading for exact quantization and move-only paths. */
    commands?: SubPath[] };

/** A rectangle or ellipse a picture, or a frame's children, are clipped to. */
export interface DrawArea { box: DrawBox; shape: Exclude<DrawShape, { kind: 'path' }> }
/** The CSS `object-fit` keywords Design accepts; it reads anything else as `contain`. */
export type DrawFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
/**
 * A picture as Design draws it: an `<img>` filling `area` (the box inside its border),
 * sized by CSS `object-fit`, placed by `object-position` (`x` and `y`, percent of the
 * room left over) and scaled by `zoom` about that same point. CSS clips the picture to
 * its element (`element`, after the zoom) and to the box that holds it (`clip`).
 */
export interface DrawPicture {
  /** The authored asset reference, which a consumer resolves. */
  ref: string;
  fit: DrawFit;
  x: number;
  y: number;
  /** 1 when the row has no framing zoom; below 1 the picture is zoomed out. */
  zoom: number;
  area: DrawBox;
  /** The `<img>` element's own outline after the zoom. */
  element: DrawArea;
  /** What the box clips its content to; absent on a box that does not clip, as a path box. */
  clip?: DrawArea;
  /** What to show a person when the reference cannot be drawn. */
  label: string;
  /**
   * The picture's own size, from `describeDesignDrawPictures`. Contain, cover and fill
   * anchored at 0, 50 or 100 percent place the same without the size; other fits and anchors need the size.
   */
  natural?: { width: number; height: number };
}

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
  /** Design semantics: the row's picture, drawn over its fills and under its words. */
  picture?: DrawPicture;
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
  /** Strike-through geometry per laid-out line/run, from that run's font instance. */
  strikes?: Array<Array<DrawStrike | null>>;
}
/** Fills paint in order, under first; the stroke goes with the last fill. */
export interface DrawShapeOp extends DrawOpBase {
  op: 'shape'; shape: DrawShape; fills: DrawPaint[]; stroke?: DrawStroke;
  /** A target may retain an authored fill rule even on a primitive. */
  fillRule?: 'evenodd';
  /** A named internal compatibility reading; absent on Design and preview operations. */
  compatibility?: 'lottie-native-v1' | 'penpot-native-v1' | 'pptx-native-v1';
}
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
  | 'fit-text' | 'text-direction' | 'text-unlaid' | 'text-decoration' | 'text-unoutlined' | 'image-motion' | 'image-unsized'
  | 'text-emoji' | 'text-dictionary' | 'text-fallback-face' | 'image-oversize' | 'image-unread' | 'color-unresolved'
  | 'pdf-shadow' | 'pdf-blur' | 'pdf-live-text' | 'pdf-image-format' | 'pdf-preview-op';
export interface DrawFinding { id: string; feature: DrawFeature }

export interface DesignDrawPage {
  version: typeof DESIGN_DRAW_VERSION;
  width: number;
  height: number;
  /** The frame row's own fill, or empty for the consumer's default ground. */
  background: string;
  /**
   * Design semantics: the frame's own paint (its fill, white when it has none, gradient,
   * picture and border) as an operation the size of the page, drawn first.
   */
  frame?: DrawShapeOp;
  /** Design semantics: what the frame clips its rows to, when the frame clips them and the page edge alone does not. */
  clip?: DrawArea;
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
export function designDrawFindings(row: DesignBoxRowV1, opts: Pick<DesignDrawCompileOpts, 'effects' | 'semantics' | 'colors' | 'resolveColor'> = {}): DrawFeature[] {
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
  if (opts.semantics === 'preview' && kind === 'image' && set('imgpos')) found.push('image-position');
  if (opts.semantics === 'preview' && kind === 'text' && rowStr(row, 'text')) {
    found.push('text-layout-estimate');
    if (set('lineHeight')) found.push('line-height');
    if (rowNum(row, 'tracking') !== 0) found.push('tracking');
  }
  if (opts.semantics !== 'preview' && rowStr(row, 'text') && !set('textStory') && !set('textFrame')) {
    // The canvas shrinks fitted text until it fits, and lays right-to-left text out by bidi; the measure does neither.
    if (designFlag(row, 'fitText')) found.push('fit-text');
    if (rowStr(row, 'textDirection') === 'rtl') found.push('text-direction');
    // The canvas draws emoji from the chosen pack, and breaks these scripts by dictionary; the layout does neither yet.
    if (segmentEmojiText(rowStr(row, 'text')).some((span) => span.kind === 'emoji')) found.push('text-emoji');
    if (DICTIONARY_SCRIPT.test(rowStr(row, 'text'))) found.push('text-dictionary');
  }
  if (NON_STATIC.has(kind)) found.push('non-static-kind');
  if (opts.colors === 'resolved' && unresolvedColor(row, opts.resolveColor)) found.push('color-unresolved');
  // A CSS dashed or dotted border spaces its marks to fit each side; an SVG dash pattern does not.
  if (opts.semantics !== 'preview' && kind !== 'path' && rowStr(row, 'stroke') && rowNum(row, 'strokeW') > 0 && /^(dashed|dotted)$/.test(rowStr(row, 'strokeDash'))) found.push('border-style');
  return found;
}

/**
 * Whether the row paints with a brand colour (`var(...)` or a `{token}`) the compile
 * could not read. The canvas resolves those through the live brand, so drawing the row
 * without one would lose a fill the canvas shows.
 */
function unresolvedColor(row: DesignBoxRowV1, resolve: DesignDrawCompileOpts['resolveColor']): boolean {
  return ['bg', 'fg', 'stroke', 'shadowColor'].some((key) => {
    const value = rowStr(row, key).trim();
    return /var\(|^\{/i.test(value) && !resolveDrawColor(value, resolve);
  });
}

const FITS = new Set<string>(['contain', 'cover', 'fill', 'none', 'scale-down']);
/** The renderer's `OBJPOS` keywords as CSS reads them, in percent across and down. */
const OBJPOS = new Map<string, readonly [number, number]>([
  ['center', [50, 50]], ['center top', [50, 0]], ['center bottom', [50, 100]], ['left center', [0, 50]], ['right center', [100, 50]],
  ['left top', [0, 0]], ['right top', [100, 0]], ['left bottom', [0, 100]], ['right bottom', [100, 100]],
  ['top', [50, 0]], ['bottom', [50, 100]], ['left', [0, 50]], ['right', [100, 50]],
]);

/**
 * A row's picture as the renderer's `imgCss` reads it: the fit, then either the framing
 * (anchor and zoom) or an `imgpos` keyword. `rounded` is the `<img>` element's own
 * outline before the zoom, as a board rounds its picture; `clip` is what the box clips
 * its content to.
 */
function pictureOf(row: DesignBoxRowV1, area: DrawBox, clip: DrawArea | undefined, rounded: Exclude<DrawShape, { kind: 'path' }> = { kind: 'rect', radius: 0 }): DrawPicture | undefined {
  // A row holds its picture as an asset id, or as the asset reference the picker wrote.
  const image: unknown = row.image;
  const ref = typeof image === 'string' ? image : image && typeof image === 'object' && typeof (image as { id?: unknown }).id === 'string' ? (image as { id: string }).id : '';
  if (!ref) return undefined;
  const fit = (FITS.has(rowStr(row, 'fit')) ? rowStr(row, 'fit') : 'contain') as DrawFit;
  let x = 50, y = 50, zoom = 1;
  const framing = row.imageFraming;
  if (framing && typeof framing === 'object') {
    const f = framing as Record<string, unknown>;
    x = clampTo(leadingNumber(f.x, 50), 0, 100);
    y = clampTo(leadingNumber(f.y, 50), 0, 100);
    zoom = Math.max(1, leadingNumber(f.zoom, 100)) / 100;
  } else {
    const at = OBJPOS.get(String(row.imgpos ?? '').trim());
    if (at) [x, y] = at;
  }
  const ox = area.x + (area.w * x) / 100, oy = area.y + (area.h * y) / 100;
  const element: DrawArea = {
    box: { x: ox + (area.x - ox) * zoom, y: oy + (area.y - oy) * zoom, w: area.w * zoom, h: area.h * zoom },
    shape: rounded.kind === 'ellipse' ? rounded : { kind: 'rect', radius: rounded.radius * zoom },
  };
  const label = rowStr(row, 'alt') || rowStr(row, 'name') || 'Picture not available here';
  return { ref, fit, x, y, zoom, area, element, ...(clip ? { clip } : {}), label };
}

/** The box inside an inside stroke, and the outline CSS clips its content to there. */
function paddingArea(box: DrawBox, shape: Exclude<DrawShape, { kind: 'path' }>, stroke: DrawStroke | undefined): DrawArea {
  const inset = stroke ? Math.min(stroke.width, box.w / 2, box.h / 2) : 0;
  return {
    box: { x: box.x + inset, y: box.y + inset, w: box.w - inset * 2, h: box.h - inset * 2 },
    shape: shape.kind === 'ellipse' ? shape : { kind: 'rect', radius: Math.max(0, shape.radius - inset) },
  };
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
  semantics?: 'design' | 'preview' | 'lottie-compat' | 'penpot-compat' | 'pptx-compat';
  /** Resolved paints and the existing geometry authority for the named legacy vector reading only. */
  lottieCompat?: { fill: readonly number[] | null; stroke: readonly number[] | null; geom?: import('@lolly-tools/core').GeomAPI };
  /** Paints and early geometry facts from the Penpot producer, preserving its callback order. */
  penpotCompat?: { fills: DrawPaint[]; stroke?: DrawStroke;
    capture?: { geometry: DrawBox; opacity: number; rotation: number; shapeKind: string } };
  /** Native deck paints after the producer folds and rounds alpha, in its original callback order. */
  pptxCompat?: { fills: DrawPaint[]; stroke?: DrawStroke; geometry?: DrawBox };
}

/** CSS `parseFloat`: a leading number, so `50%` reads as 50. */
function leadingNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}
/** The renderer's `boolVal`: true, 1, yes or on, and false, 0, no or off, in any case; anything else is `fallback`. */
function designBool(value: unknown, fallback: boolean): boolean {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === '') return fallback;
  const s = String(value).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return fallback;
}
function designFlag(row: DesignBoxRowV1, key: string): boolean {
  return designBool(row[key], false);
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
    if (shadow.target === 'box') out.outline = outlineOf(row, box, opts.semantics === 'lottie-compat' || opts.semantics === 'penpot-compat' || opts.semantics === 'pptx-compat' ? 'design' : opts.semantics);
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
  if (opts.semantics === 'lottie-compat') return compileLottieCompatRow(row, offset, opts.lottieCompat);
  if (opts.semantics === 'penpot-compat') return compilePenpotCompatRow(row, offset, opts.penpotCompat);
  if (opts.semantics === 'pptx-compat') return compilePptxCompatRow(row, offset, opts.pptxCompat);
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
  if (kind === 'image' && !design) {
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
    // A path box does not clip its children, so its picture is clipped by the picture alone.
    const picture = design ? pictureOf(row, box, undefined) : undefined;
    return {
      ...base, op: 'shape',
      shape: { kind: 'path', contours: pathContours(row, box, opts.thumbScale), evenOdd: rowStr(row, 'fillRule') === 'evenodd' },
      fills: fill,
      ...(() => { const stroke = strokeOf(row, color, { cap: 'round', join: 'round' }); return stroke ? { stroke } : {}; })(),
      ...(picture ? { picture } : {}),
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
  // The picture fills the box inside the border, which clips it to the inner corner radius.
  const padding = paddingArea(box, shape, design ? stroke : undefined);
  // A web page or a 3D scene draws its own marker in place of a picture.
  const picture = design && !NON_STATIC.has(kind) ? pictureOf(row, padding.box, padding) : undefined;
  return { ...base, op: 'shape', shape, fills, ...(stroke ? { stroke } : {}), ...(picture ? { picture } : {}) };
}

/**
 * A frame's own paint, as the renderer's page style draws it: the fill (white when the
 * frame has none), the gradient on the box inside the border, the picture filling that
 * box with the frame's own corner radius, and the border inside the page. A frame that
 * clips its rows clips them to the box inside the border, at the inner radius.
 */
function framePaint(head: DesignBoxRowV1, page: DesignDrawPage, opts: DesignDrawCompileOpts): void {
  const color: ColorOf = opts.colors === 'resolved'
    ? (value) => { const c = resolveDrawColor(value, opts.resolveColor); return c ? { color: c.color, ...(c.opacity < 1 ? { opacity: c.opacity } : {}) } : null; }
    : authoredColor;
  const box: DrawBox = { x: 0, y: 0, w: Math.max(1, Math.round(rowNum(head, 'w', 1))), h: Math.max(1, Math.round(rowNum(head, 'h', 1))) };
  const shape = outlineOf(head, box);
  const stroke = strokeOf(head, color);
  if (stroke) stroke.align = 'inside';
  const padding = paddingArea(box, shape, stroke);
  const grad = gradientOf(head, padding.box);
  const fills: DrawPaint[] = [{ kind: 'color', ...(color(rowStr(head, 'bg')) ?? { color: '#ffffff' }) }, ...(grad ? [grad] : [])];
  const clips = designBool(head.clipChildren, true);
  if (clips && (stroke || shape.kind === 'ellipse' || shape.radius > 0)) page.clip = padding;
  // The picture is the page's first child: its own element is rounded by the frame's
  // radius on the box inside the border, and the frame clips it with the rows.
  const rounded = shape.kind === 'ellipse' ? shape : { kind: 'rect' as const, radius: Math.min(shape.radius, padding.box.w / 2, padding.box.h / 2) };
  const picture = pictureOf(head, padding.box, clips ? padding : undefined, rounded);
  page.frame = { id: rowStr(head, 'id'), box, opacity: 100, op: 'shape', shape, fills, ...(stroke ? { stroke } : {}), ...(picture ? { picture } : {}) };
}

/**
 * One frame's rows as a page. `rows` are in paint order and placed against the frame
 * row, which leads them when present; hidden rows draw nothing.
 */
export function compileDesignDraw(rows: readonly DesignBoxRowV1[], size: { width: number; height: number }, opts: DesignDrawCompileOpts = {}): DesignDrawPage {
  if (opts.semantics === 'lottie-compat') throw new Error('The Lottie sequence owns page selection; compile its admitted vectors with compileDesignRow.');
  if (opts.semantics === 'penpot-compat') throw new Error('The Penpot producer owns page selection; compile its admitted primitives with compileDesignRow.');
  if (opts.semantics === 'pptx-compat') throw new Error('The native PPTX producer owns page selection; compile its admitted primitives with compileDesignRow.');
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
  if (framed && design) {
    framePaint(head, page, opts);
    // A page export shows none of a board's shadow, and its opacity and blend composite the
    // page onto whatever the consumer draws it over, so those stay findings.
    const dashed = rowStr(head, 'stroke') && rowNum(head, 'strokeW') > 0 && /^(dashed|dotted)$/.test(rowStr(head, 'strokeDash'));
    if (rowStr(head, 'shadow') || leadingNumber(head.opacity, 100) < 100 || BLENDS.has(rowStr(head, 'blend')) || dashed) {
      page.findings.push({ id: rowStr(head, 'id'), feature: 'frame-paint' });
    }
    if (opts.colors === 'resolved' && unresolvedColor(head, opts.resolveColor)) page.findings.push({ id: rowStr(head, 'id'), feature: 'color-unresolved' });
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
    catch { page.findings.push({ id: op.id, feature: 'text-unlaid' }); continue; }
    // The canvas draws a character its face lacks in a fallback face, which the layout does not know.
    if (op.words.layout.measure.uncovered?.length) page.findings.push({ id: op.id, feature: 'text-fallback-face' });
  }
}

/** The host text-to-path call, typed as in `HostV1.text.toPath`. */
export type DrawTextToPath = (opts: { text: string; fontUrl: string; fontSize: number; features?: string[]; letterSpacing?: number; variations?: string[] }) => Promise<{ d: string }>;
/** Internal host facts, not a tool capability or a renderer-produced result. */
export type DrawStrikeMetrics = (fontUrl: string, variations?: string[]) => Promise<StrikeMetrics | null>;

/**
 * Outline every laid-out run with the host's `text.toPath`, in the face file and axes
 * the measure chose, so the words travel as shapes and the drawing needs no font.
 * Strike-through uses the same face instance's metrics. Underline remains reported
 * until its ink-skipping is qualified; a run the host cannot outline stays text.
 */
export async function outlineDesignDrawText(page: DesignDrawPage, toPath: DrawTextToPath, strikeMetrics?: DrawStrikeMetrics): Promise<void> {
  const metrics = new Map<string, Promise<StrikeMetrics | null>>();
  for (const op of page.ops) {
    const words = op.words, layout = words?.layout;
    if (!words || !layout) continue;
    const m = layout.measure;
    const features = [...(words.spec.ligatures === false || m.tracking !== 0 ? ['liga=0', 'clig=0'] : []), ...(words.spec.alternates ? ['salt=1'] : [])];
    let decorated = false, missing = false;
    words.outlines = [];
    delete words.strikes;
    for (const line of layout.lines) {
      const row: Array<string | null> = [];
      const strikes: Array<DrawStrike | null> = [];
      for (const run of line.runs) {
        if (run.underline) decorated = true;
        const variations = run.face.variations ? Object.entries(run.face.variations).map(([axis, value]) => `${axis}=${value}`) : undefined;
        let strike: DrawStrike | null = null;
        if (run.strike) {
          if (strikeMetrics && run.face.file) {
            const key = JSON.stringify([run.face.file, variations]);
            let hit = metrics.get(key);
            if (!hit) { hit = strikeMetrics(run.face.file, variations).catch(() => null); metrics.set(key, hit); }
            strike = strikeGeometry(await hit, m.size, run.width, op.box.y + line.baseline);
          }
          if (!strike) decorated = true;
        }
        strikes.push(strike);
        if (!run.text.trim() || !run.face.file) { row.push(run.text.trim() ? null : ''); if (run.text.trim()) missing = true; continue; }
        try {
          const { d } = await toPath({ text: run.text, fontUrl: run.face.file, fontSize: m.size, ...(features.length ? { features } : {}), ...(m.tracking ? { letterSpacing: m.tracking } : {}), ...(variations ? { variations } : {}) });
          row.push(d);
        } catch { row.push(null); missing = true; }
      }
      words.outlines.push(row);
      if (line.runs.some((run) => run.strike) || words.strikes) {
        words.strikes ??= words.outlines.slice(0, -1).map((r) => r.map(() => null));
        words.strikes.push(strikes);
      }
    }
    if (decorated) page.findings.push({ id: op.id, feature: 'text-decoration' });
    if (missing) page.findings.push({ id: op.id, feature: 'text-unoutlined' });
  }
}

/**
 * Where CSS draws a picture inside its `<img>`: `object-fit` sizes it from its own size,
 * `object-position` shares out the room left over, the edges are snapped to whole pixels
 * as Chromium snaps a replaced element's content, and the framing zoom scales the result
 * about the anchor.
 */
export function pictureRect(picture: DrawPicture, natural: { width: number; height: number }): DrawBox {
  const a = picture.area, iw = natural.width, ih = natural.height;
  const contain = Math.min(a.w / iw, a.h / ih);
  const scale = picture.fit === 'cover' ? Math.max(a.w / iw, a.h / ih)
    : picture.fit === 'none' ? 1
    : picture.fit === 'scale-down' ? Math.min(1, contain)
    : contain;
  const w = picture.fit === 'fill' ? a.w : iw * scale, h = picture.fit === 'fill' ? a.h : ih * scale;
  const x = a.x + ((a.w - w) * picture.x) / 100, y = a.y + ((a.h - h) * picture.y) / 100;
  const left = Math.round(x), top = Math.round(y), right = Math.round(x + w), bottom = Math.round(y + h);
  const ox = a.x + (a.w * picture.x) / 100, oy = a.y + (a.h * picture.y) / 100;
  const z = picture.zoom;
  return { x: ox + (left - ox) * z, y: oy + (top - oy) * z, w: (right - left) * z, h: (bottom - top) * z };
}

/** What a host knows about a picture once it has resolved the reference. */
export interface DrawPictureInfo {
  /** The picture's own size, in CSS px. */
  width: number;
  height: number;
  /** `motion` for an animation or a video, `audio` for sound, a still picture otherwise. */
  media?: 'still' | 'motion' | 'audio';
}

/** A placement the renderer settles from the picture's own size, not from the box alone. */
function needsNaturalSize(picture: DrawPicture): boolean {
  const anchor = (p: number) => p === 0 || p === 50 || p === 100;
  return picture.fit === 'none' || picture.fit === 'scale-down' || !anchor(picture.x) || !anchor(picture.y);
}

/**
 * Give every picture its own size from the host, and settle what the renderer does with
 * media that is not a still picture: an animation or a video is reported and not drawn,
 * and a row whose asset is sound leaves no mark at all, as on the canvas. A picture whose
 * placement needs its size and cannot be described is reported.
 */
export async function describeDesignDrawPictures(page: DesignDrawPage, describe: (ref: string) => Promise<DrawPictureInfo | null>): Promise<void> {
  const settle = async (op: DrawOp): Promise<boolean> => {
    const picture = op.picture;
    if (!picture) return true;
    let info: DrawPictureInfo | null;
    try { info = await describe(picture.ref); } catch { info = null; }
    if (info?.media === 'audio') return false;
    if (info?.media === 'motion') {
      delete op.picture;
      page.findings.push({ id: op.id, feature: 'image-motion' });
    } else if (info && info.width > 0 && info.height > 0) picture.natural = { width: info.width, height: info.height };
    else if (needsNaturalSize(picture)) page.findings.push({ id: op.id, feature: 'image-unsized' });
    return true;
  };
  // A board's picture that is sound draws nothing, and the board still paints.
  if (page.frame && !(await settle(page.frame))) delete page.frame.picture;
  const kept: DrawOp[] = [];
  for (const op of page.ops) if (await settle(op)) kept.push(op);
  page.ops = kept;
}
