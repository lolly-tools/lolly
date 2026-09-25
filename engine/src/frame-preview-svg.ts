// SPDX-License-Identifier: MPL-2.0
/**
 * A compiled frame drawn as a plain SVG (plan 274 section 3.4, "preview and
 * Design share one geometry").
 *
 * The review needs a picture of a proposed slide before anything is exported, and
 * mounting a Design runtime per thumbnail is not that picture. This module draws
 * the SAME rows the compile wrote, at the same coordinates, so a preview and the
 * document Design opens agree by construction rather than by two implementations
 * staying in step.
 *
 * What it draws, and nothing else:
 *
 *   - a box row as a `rect` with its fill, stroke, corner radius and opacity;
 *   - a path row as a `path`: its authored nodes (Design's own path value, each
 *     node a fraction of the row box) lowered to cubics at the row's size, with
 *     its fill, fill rule, stroke, caps, joins and dash, so a chart carried as
 *     shapes previews as the chart rather than as dark rectangles;
 *   - a posed row inside a `g` that turns and mirrors it about its own centre, in
 *     the order Design composes the two, so a rotated or mirrored object is not
 *     drawn square and the right way round;
 *   - an image row as an `image` whose href the caller supplies, with the
 *     `preserveAspectRatio` its `fit` asks for. A reference the caller cannot
 *     resolve is drawn as a muted box with a label, never as an empty gap;
 *   - a text row as `text` lines, wrapped by an average glyph width, in the row's
 *     family, size, weight, colour and alignment, inside the row's `pad` inset on
 *     every side (Design's own default of 8 px when the row states none), each
 *     line Design's own line box tall (`DESIGN_LINE_HEIGHT`), centred when the row
 *     states no vertical alignment, and clipped to its box, as Design clips it;
 *   - a placeholder layer as a hatched muted box with its label, so a placeholder
 *     can never be mistaken for a picture of the source;
 *   - a slot of the master that nothing filled (a text slot with no words, a
 *     picture slot with no picture) as a hatched box with a 1 px edge and no
 *     label, so an empty box reads as a box rather than as a hole in the slide;
 *   - nothing at all for a hidden row.
 *
 * Two options change what is drawn, and both leave every other drawing byte for
 * byte as it was:
 *
 *   - `detail: 'thumbnail'` is for a drawing shown at `longEdge` px or less. It
 *     leaves out path contours and rows smaller than a pixel at that size, writes
 *     path coordinates in whole units, draws a run of outlined glyphs (a chart's
 *     label that reached the compile as shapes) as one bar the width of the run,
 *     since its words cannot be read at that size and its outlines are most of the
 *     drawing's bytes, and draws placeholders flat, without their hatch or label.
 *   - `fonts.brand` on a frame the renovate compile wrote (one that names its
 *     slide master) sets every text in the design system's faces: a family the
 *     row states that is neither the brand face nor the mono face is drawn in the
 *     brand face (close-out 9.2). The guard is for rows the compile did not write
 *     that way, such as a compile stored by an older version. A faithful frame
 *     keeps the source's own families, since it is the before.
 *
 * Two promises the drawing keeps. Everything is XML-escaped, because a row's text
 * is document-controlled. And the result names no external resource of its own: no
 * stylesheet, no font file, no script. The one href in it is the one the caller
 * returned from `assetHref`, which is the caller's own choice.
 *
 * The wrap is an estimate, the same average-advance estimate the compile's fit pass
 * uses (`designTextFit`), for the same reason: an engine module has no font file and
 * no shaper. The two read one layout, so the words a preview clips are the words the
 * compile reports as cut. A preview drawn from it is a preview, not a proof of fit.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */

import type { CompiledFrameV1, DesignBoxRowV1 } from '@lolly-tools/core';

import {
  AVERAGE_GLYPH_EM,
  DESIGN_LINE_HEIGHT,
  DESIGN_TEXT_PAD,
  ESTIMATE_LINE_HEIGHT,
  designTextPad,
  layoutDesignText,
  wrapByAverageWidth,
} from './deck-compile.ts';
import { decodeAuthoredPaths } from './geom/authored-url.ts';
import { toSvgPathData, type Contour } from './geom/path.ts';
import { toCubics } from './geom/spline.ts';
import type { DesignTextRunV1 } from './design-text.ts';

/** The wrap the preview and the compile's fit pass share, re-exported where callers found it first. */
export { wrapByAverageWidth };

export interface FramePreviewOptsV1 {
  /** Turns a row's image reference into something an `image` element can draw. */
  assetHref: (ref: string) => string | undefined;
  /**
   * Families for the drawing. A row states a Design font SLOT (`sans`, `display`,
   * `mono`), which the master writes, or a family of its own, which a font mapping
   * writes; `brand` answers for a row that states nothing and for a slot the caller
   * left unnamed.
   */
  fonts?: { brand?: string; sans?: string; display?: string; mono?: string };
  /** Draw placeholder layers. Defaults to true; false leaves their space empty. */
  showPlaceholders?: boolean;
  /**
   * Draw a master slot that nothing filled as its hatched box. Defaults to true; false
   * leaves its space empty, for a view that draws its own empty boxes over the drawing
   * (the rebrand stage hatches an empty title at rest and the other slots on hover).
   */
  emptySlots?: boolean;
  /**
   * How much the drawing carries. `full`, the default, draws every row as written.
   * `thumbnail` is for a drawing shown at `longEdge` px or less; see the header.
   */
  detail?: FramePreviewDetailV1;
  /** The long edge, in px, a `thumbnail` drawing is shown at. `THUMBNAIL_LONG_EDGE` when absent. */
  longEdge?: number;
}

/** What a preview drawing carries: every row as written, or what reads at a thumbnail's size. */
export type FramePreviewDetailV1 = 'full' | 'thumbnail';

/** The long edge a `thumbnail` drawing is sized for when the caller names none, in px. */
export const THUMBNAIL_LONG_EDGE = 192;

/**
 * The tallest box, in frame units, a run of outlined glyphs is read as at the
 * thumbnail rung: a label line on a slide 720 units tall. A taller drawing is art.
 */
const GLYPH_RUN_MAX_HEIGHT = 40;

/** Contours a path row needs before it reads as a run of glyphs rather than one shape. */
const GLYPH_RUN_MIN_CONTOURS = 2;

/** The widest a contour of a glyph run is, as a share of the run's height: a wide letter such as W. */
const GLYPH_MAX_ASPECT = 1.5;

/** The bar a glyph run is drawn as: its share of the run's height, and its ink's opacity. */
const GLYPH_BAR_HEIGHT = 0.4;
const GLYPH_BAR_OPACITY = 0.45;

/** Fill of the hatch a placeholder and an unresolvable picture are drawn with. */
const MUTED_FILL = '#e7e7e7';

/** Ink of a placeholder label and of the hatch strokes. */
const MUTED_INK = '#8a8a8a';

/** Label ink, darker than the hatch so the words read. */
const LABEL_INK = '#555555';

/** Family every text row takes when the caller names none. */
const DEFAULT_FAMILY = 'system-ui, sans-serif';

/** Family a `mono` slot takes when the caller names none. */
const DEFAULT_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** Size a row with no size of its own is drawn at, in px. */
const DEFAULT_FONT_SIZE = 16;

/**
 * The inset between a text box's edge and its text, in px, when the row states
 * none: Design's `pad` default, the number the compile's fit pass reads too.
 */
export const DESIGN_DEFAULT_PAD = DESIGN_TEXT_PAD;

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function str(row: DesignBoxRowV1, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function num(row: DesignBoxRowV1, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function flag(row: DesignBoxRowV1, key: string): boolean {
  const value = row[key];
  return value === true || value === 'true' || value === 1 || value === '1';
}

function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** The `preserveAspectRatio` one Design `fit` asks for. */
function aspect(fit: string): string {
  if (fit === 'cover') return 'xMidYMid slice';
  if (fit === 'fill') return 'none';
  return 'xMidYMid meet';
}

/** SVG text anchor and the x it is placed at, for one alignment inside a box. */
function anchorOf(align: string, x: number, w: number): { anchor: string; x: number } {
  if (align === 'center') return { anchor: 'middle', x: round2(x + w / 2) };
  if (align === 'right') return { anchor: 'end', x: round2(x + w) };
  return { anchor: 'start', x: round2(x) };
}

/**
 * The y of the first baseline inside a box, for one vertical alignment. Each line is
 * `lineHeight` of the size tall with its glyphs centred in it, as a CSS line box
 * sets them; a block taller than the box starts above it under `middle` and `bottom`,
 * as Design's flex box places it.
 */
function firstBaseline(valign: string, y: number, h: number, fontSize: number, lines: number, lineHeight = ESTIMATE_LINE_HEIGHT): number {
  const line = fontSize * lineHeight;
  const block = lines * line;
  const ascent = (line - fontSize) / 2 + fontSize * 0.8;
  if (valign === 'middle') return round2(y + (h - block) / 2 + ascent);
  if (valign === 'bottom') return round2(y + h - block + ascent);
  return round2(y + ascent);
}

/** The distance between two hatch lines, across them, in frame units. */
const HATCH_STEP = 8;

/**
 * A muted box with its hatch drawn in place: the fill, the diagonal lines cut to the
 * box, and a 1 px edge that stays 1 px at every size. The lines are written out
 * rather than referenced from a pattern, because the same drawing is mounted many
 * times in one document (the stage, the inset, the strip, the queue) and a pattern
 * id resolves to its first copy there, which draws nothing when that copy is hidden.
 * Flat at the thumbnail rung, where the lines would only be grey noise.
 */
function hatchedBox(box: { x: number; y: number; w: number; h: number }, flat: boolean): string {
  const rect = `<rect x="${round2(box.x)}" y="${round2(box.y)}" width="${round2(box.w)}" height="${round2(box.h)}"`
    + ` fill="${MUTED_FILL}" stroke="${MUTED_INK}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  if (flat || box.w <= 0 || box.h <= 0) return rect;
  // Lines of x + y = k, one every HATCH_STEP across them, each cut to the box.
  const x0 = box.x;
  const y0 = box.y;
  const x1 = box.x + box.w;
  const y1 = box.y + box.h;
  const along = HATCH_STEP * Math.SQRT2;
  const parts: string[] = [];
  for (let k = x0 + y0 + along; k < x1 + y1; k += along) {
    const from = Math.max(x0, k - y1);
    const to = Math.min(x1, k - y0);
    if (to - from <= 0) continue;
    parts.push(`M${round1(from)} ${round1(k - from)}L${round1(to)} ${round1(k - to)}`);
  }
  if (parts.length === 0) return rect;
  return `${rect}<path d="${parts.join('')}" fill="none" stroke="${MUTED_INK}" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0.5"/>`;
}

function round1(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

interface DrawCtxV1 {
  family: string;
  slots: { sans: string; display: string; mono: string };
  assetHref: FramePreviewOptsV1['assetHref'];
  /**
   * The design system's own families, lower case, when every text of this frame is
   * held to them (a renovated frame drawn with `fonts.brand`). Absent otherwise.
   */
  faces?: ReadonlySet<string>;
  /** Px per frame unit at the thumbnail rung; absent for a full drawing. */
  thumbScale?: number;
}

/**
 * The family one row draws in.
 *
 * A master states one of Design's three font slots, a font mapping states a real
 * family, and the same `font` field carries both, so the three slot names are read
 * as slots and everything else as a family. The switch is what keeps a row saying
 * `constructor` from reaching a function's source text, and the family is reduced
 * to the characters Design's own `fontFamily` keeps.
 */
function familyOf(row: DesignBoxRowV1, ctx: DrawCtxV1): string {
  const stated = str(row, 'font').trim();
  switch (stated) {
    case '':
      return ctx.family;
    case 'sans':
      return ctx.slots.sans;
    case 'display':
      return ctx.slots.display;
    case 'mono':
      return ctx.slots.mono;
    default: {
      const safe = stated.replace(/[^\w -]/g, '').trim();
      // A renovated frame is set wholly in the design system (close-out 9.2): a family
      // the row states outside its faces draws in the brand face.
      if (ctx.faces) {
        if (safe && ctx.faces.has(safe.toLowerCase())) {
          return safe.toLowerCase() === ctx.slots.mono.toLowerCase() ? ctx.slots.mono : ctx.family;
        }
        return ctx.family;
      }
      return safe ? `${safe}, ${ctx.family}` : ctx.family;
    }
  }
}

/**
 * The turn and the mirror one row states, about the box centre.
 *
 * Design folds both into one transform with its origin at the centre and composes
 * them `rotate() scale()`, so the artwork turns over in place; the same order is
 * written here, between the two translations SVG needs to move the origin.
 */
function poseTransform(box: { x: number; y: number; w: number; h: number }, rot: number, flipH: boolean, flipV: boolean): string {
  const cx = round2(box.x + box.w / 2);
  const cy = round2(box.y + box.h / 2);
  const parts = [`translate(${cx} ${cy})`];
  if (rot !== 0) parts.push(`rotate(${round2(rot)})`);
  if (flipH || flipV) parts.push(`scale(${flipH ? -1 : 1} ${flipV ? -1 : 1})`);
  parts.push(`translate(${round2(-cx)} ${round2(-cy)})`);
  return parts.join(' ');
}

/**
 * A slot of the master that nothing filled: the hatch and a 1 px edge that stays
 * 1 px at every size, with no label, so the box reads as an empty box of the layout.
 * Flat at the thumbnail rung, where the hatch would only be grey noise.
 */
function drawEmptySlot(box: { x: number; y: number; w: number; h: number }, ctx: DrawCtxV1): string {
  return hatchedBox(box, ctx.thumbScale !== undefined);
}

/** True for a row the master placed as a slot and nothing filled. */
function emptySlot(row: DesignBoxRowV1): boolean {
  if (!str(row, 'role')) return false;
  const kind = str(row, 'kind');
  if (kind === 'text') return str(row, 'text').trim() === '' && str(row, 'bg') === '';
  if (kind === 'image') return str(row, 'image') === '';
  return false;
}

/** One muted, hatched box with a label in the middle of it. */
function drawMuted(box: { x: number; y: number; w: number; h: number }, label: string, ctx: DrawCtxV1): string {
  // At the thumbnail rung the words cannot be read and the hatch is only noise.
  let out = hatchedBox(box, ctx.thumbScale !== undefined);
  if (ctx.thumbScale !== undefined || label.trim() === '') return out;
  const size = Math.max(10, Math.min(18, round2(box.h / 4)));
  const lines = wrapByAverageWidth(label, size, box.w);
  const x = round2(box.x + box.w / 2);
  const baseline = firstBaseline('middle', box.y, box.h, size, lines.length);
  out += `<text x="${x}" y="${baseline}" font-family="${esc(ctx.family)}" font-size="${size}"`
    + ` fill="${LABEL_INK}" text-anchor="middle">`;
  lines.forEach((line, i) => {
    out += `<tspan x="${x}"${i > 0 ? ` dy="${round2(size * ESTIMATE_LINE_HEIGHT)}"` : ''}>${esc(line)}</tspan>`;
  });
  return `${out}</text>`;
}

function drawRow(row: DesignBoxRowV1, offset: { x: number; y: number }, placeholder: boolean, ctx: DrawCtxV1): string {
  const box = {
    x: num(row, 'x') - offset.x,
    y: num(row, 'y') - offset.y,
    w: Math.max(0, num(row, 'w')),
    h: Math.max(0, num(row, 'h')),
  };
  const opacity = num(row, 'opacity', 100);
  const rot = num(row, 'rot');
  const flipH = flag(row, 'flipH');
  const flipV = flag(row, 'flipV');
  const attrs = (opacity !== 100 ? ` opacity="${round2(Math.max(0, Math.min(100, opacity)) / 100)}"` : '')
    + (rot !== 0 || flipH || flipV ? ` transform="${poseTransform(box, rot, flipH, flipV)}"` : '');
  const open = attrs ? `<g${attrs}>` : '';
  const close = open ? '</g>' : '';
  const kind = str(row, 'kind');

  if (placeholder) {
    // The label of a placeholder pair rides on its own row, so the box is drawn
    // hatched and the label row is drawn as ordinary text over it. At the thumbnail
    // rung the label is left out with the hatch.
    if (kind === 'text') return ctx.thumbScale !== undefined ? '' : `${open}${drawText(row, box, ctx)}${close}`;
    return `${open}${drawMuted(box, str(row, 'text'), ctx)}${close}`;
  }

  if (emptySlot(row)) return `${open}${drawEmptySlot(box, ctx)}${close}`;

  // At the thumbnail rung a row smaller than a pixel both ways draws nothing.
  if (ctx.thumbScale !== undefined && box.w * ctx.thumbScale < 1 && box.h * ctx.thumbScale < 1) return '';

  if (kind === 'image') {
    const ref = str(row, 'image');
    const href = ref ? ctx.assetHref(ref) : undefined;
    if (!href) {
      // `alt` is not one of Design's own field ids, so a document that has been
      // through Design carries none. The row's name is the next best thing to put
      // in front of a person, and the plain sentence is the last resort.
      const label = str(row, 'alt') || str(row, 'name') || 'Picture not available here';
      return `${open}${drawMuted(box, label, ctx)}${close}`;
    }
    return `${open}<image x="${round2(box.x)}" y="${round2(box.y)}" width="${round2(box.w)}" height="${round2(box.h)}"`
      + ` href="${esc(href)}" preserveAspectRatio="${aspect(str(row, 'fit'))}"/>${close}`;
  }

  if (kind === 'text') return `${open}${drawText(row, box, ctx)}${close}`;

  if (kind === 'path') return `${open}${drawPath(row, box, ctx.thumbScale)}${close}`;

  return `${open}${drawBox(row, box)}${close}`;
}

/**
 * A path row: every authored contour scaled from box fractions to the row's size
 * and lowered to cubics, joined into one `d` so a hole cut by an opposite contour
 * stays a hole. A value that does not decode draws nothing, the answer Design's
 * own renderer gives an unreadable path (it shows a notice there, which a
 * preview has no room for).
 */
function drawPath(row: DesignBoxRowV1, box: { x: number; y: number; w: number; h: number }, thumbScale?: number): string {
  const paths = decodeAuthoredPaths(str(row, 'path'));
  if (!paths || paths.length === 0) return '';
  if (thumbScale !== undefined && glyphRun(row, box, paths)) return drawGlyphBar(row, box);
  const w = Math.max(1, box.w);
  const h = Math.max(1, box.h);
  const contours: Contour[] = [];
  for (const path of paths) {
    // At the thumbnail rung a contour under a pixel both ways is left out.
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
      // A node set the lowering refuses draws nothing, as Design draws it.
    }
  }
  if (!contours.length) return '';
  const fill = str(row, 'bg');
  const stroke = str(row, 'stroke');
  const strokeW = num(row, 'strokeW');
  const rule = str(row, 'fillRule') === 'evenodd' ? ' fill-rule="evenodd"' : '';
  let paint = `fill="${fill ? esc(fill) : 'none'}"${rule}`;
  if (stroke && strokeW > 0) {
    const cap = str(row, 'strokeCap') || 'round';
    const join = str(row, 'strokeJoin') || 'round';
    paint += ` stroke="${esc(stroke)}" stroke-width="${round2(strokeW)}" stroke-linecap="${esc(cap)}" stroke-linejoin="${esc(join)}"`;
    if (str(row, 'strokeDash') === 'dashed') {
      const dash = num(row, 'strokeDashLen') || strokeW * 3;
      const gap = num(row, 'strokeGapLen') || strokeW * 2;
      paint += ` stroke-dasharray="${round2(dash)} ${round2(gap)}"`;
    }
  }
  return `<path d="${esc(toSvgPathData(contours, thumbScale !== undefined ? 0 : 2))}" ${paint}/>`;
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

/**
 * A run of outlined glyphs: a filled row with no stroke, several contours, no taller
 * than a label line and wider than tall, and no contour wider than a glyph (a row of
 * bars in one series fails there). A chart's label reaches the compile this way when
 * its source outlined the text.
 */
function glyphRun(row: DesignBoxRowV1, box: { w: number; h: number }, paths: ReadonlyArray<{ nodes: ReadonlyArray<{ x: number }> }>): boolean {
  if (paths.length < GLYPH_RUN_MIN_CONTOURS || !str(row, 'bg')) return false;
  if (str(row, 'stroke') && num(row, 'strokeW') > 0) return false;
  if (!(box.h > 0 && box.h <= GLYPH_RUN_MAX_HEIGHT && box.w >= box.h)) return false;
  const widest = box.h * GLYPH_MAX_ASPECT;
  return paths.every((path) => {
    if (path.nodes.length === 0) return true;
    let min = Infinity;
    let max = -Infinity;
    for (const node of path.nodes) {
      min = Math.min(min, node.x);
      max = Math.max(max, node.x);
    }
    return (max - min) * box.w <= widest;
  });
}

/** A glyph run at the thumbnail rung: one bar across the run, in its own ink, lighter and thinner than the words. */
function drawGlyphBar(row: DesignBoxRowV1, box: { x: number; y: number; w: number; h: number }): string {
  const h = box.h * GLYPH_BAR_HEIGHT;
  return `<rect x="${Math.round(box.x)}" y="${Math.round(box.y + (box.h - h) / 2)}" width="${Math.max(1, Math.round(box.w))}"`
    + ` height="${Math.max(1, Math.round(h))}" fill="${esc(str(row, 'bg'))}" opacity="${GLYPH_BAR_OPACITY}"/>`;
}

function drawBox(row: DesignBoxRowV1, box: { x: number; y: number; w: number; h: number }): string {
  const fill = str(row, 'bg');
  const stroke = str(row, 'stroke');
  const strokeW = num(row, 'strokeW');
  const radius = num(row, 'radius');
  const shape = str(row, 'shape');
  let paint = `fill="${fill ? esc(fill) : 'none'}"`
    + (stroke && strokeW > 0 ? ` stroke="${esc(stroke)}" stroke-width="${round2(strokeW)}"` : '');
  // A dashed outline draws dashed, with the same lengths `drawPath` uses.
  if (stroke && strokeW > 0 && str(row, 'strokeDash') === 'dashed') {
    const dash = num(row, 'strokeDashLen') || strokeW * 3;
    const gap = num(row, 'strokeGapLen') || strokeW * 2;
    paint += ` stroke-dasharray="${round2(dash)} ${round2(gap)}"`;
  }
  // A circle is an ellipse the editor keeps square, and a pill is a rectangle
  // rounded to half its short side: the two Design's own `radiusFor` maps to 50%
  // and 9999px. Drawing either as a square-cornered rectangle would disagree with
  // the document Design opens.
  if (shape === 'ellipse' || shape === 'circle') {
    return `<ellipse cx="${round2(box.x + box.w / 2)}" cy="${round2(box.y + box.h / 2)}"`
      + ` rx="${round2(box.w / 2)}" ry="${round2(box.h / 2)}" ${paint}/>`;
  }
  const rx = shape === 'pill'
    ? Math.min(box.w, box.h) / 2
    : shape === 'rounded' ? Math.max(radius, 0) : radius;
  return `<rect x="${round2(box.x)}" y="${round2(box.y)}" width="${round2(box.w)}" height="${round2(box.h)}"`
    + (rx > 0 ? ` rx="${round2(rx)}"` : '') + ` ${paint}/>`;
}

function drawText(row: DesignBoxRowV1, box: { x: number; y: number; w: number; h: number }, ctx: DrawCtxV1): string {
  const text = str(row, 'text');
  const size = num(row, 'fontSize', DEFAULT_FONT_SIZE) || DEFAULT_FONT_SIZE;
  const fill = str(row, 'bg');
  const lead = fill
    ? `<rect x="${round2(box.x)}" y="${round2(box.y)}" width="${round2(box.w)}" height="${round2(box.h)}" fill="${esc(fill)}"/>`
    : '';
  if (!text) return lead;
  // The fill covers the whole box; the words sit inside the pad, as Design lays them.
  const pad = designTextPad(row);
  const inner = {
    x: box.x + pad,
    y: box.y + pad,
    w: Math.max(0, box.w - pad * 2),
    h: Math.max(0, box.h - pad * 2),
  };
  // SVG folds leading spaces, so a styled line's indent is an offset on its first line.
  const { lines, indents } = layoutDesignText(text, size, inner.w);
  const { anchor, x } = anchorOf(str(row, 'align'), inner.x, inner.w);
  // Design centres a row that states no vertical alignment, and its box clips the words.
  const valign = str(row, 'valign') || 'middle';
  const baseline = firstBaseline(valign, inner.y, inner.h, size, lines.length, DESIGN_LINE_HEIGHT);
  const weight = num(row, 'weight');
  const ink = str(row, 'fg') || '#111111';
  let out = `<text x="${x}" y="${baseline}" font-family="${esc(familyOf(row, ctx))}" font-size="${round2(size)}"`
    + ` fill="${esc(ink)}" text-anchor="${anchor}"`
    + (weight > 0 ? ` font-weight="${round2(weight)}"` : '') + '>';
  lines.forEach((runs, i) => {
    const dx = (indents[i] ?? 0) * size * AVERAGE_GLYPH_EM;
    out += `<tspan x="${x}"${dx > 0 ? ` dx="${round2(dx)}"` : ''}${i > 0 ? ` dy="${round2(size * DESIGN_LINE_HEIGHT)}"` : ''}>`;
    for (const run of runs) out += runSpan(run, ctx);
    out += '</tspan>';
  });
  out += '</text>';
  // The box clips its words where Design's does (`overflow: hidden` on every box). A
  // nested viewport clips without an id, so a drawing mounted many times in one
  // document clips every copy.
  const clip = `<svg x="${round2(box.x)}" y="${round2(box.y)}" width="${round2(box.w)}" height="${round2(box.h)}"`
    + ` viewBox="${round2(box.x)} ${round2(box.y)} ${round2(box.w)} ${round2(box.h)}" overflow="hidden">${out}</svg>`;
  return `${lead}${clip}`;
}

/**
 * One run of a styled line. A run with no style of its own is bare text in its line's
 * `tspan`, so a row in Design's text subset draws its plain words exactly as before.
 */
function runSpan(run: DesignTextRunV1, ctx: DrawCtxV1): string {
  const attrs: string[] = [];
  const weight = run.weight ?? (run.bold ? 700 : undefined);
  if (weight !== undefined) attrs.push(`font-weight="${round2(weight)}"`);
  if (run.italic) attrs.push('font-style="italic"');
  const deco = [run.underline ? 'underline' : '', run.strike ? 'line-through' : ''].filter(Boolean).join(' ');
  if (deco) attrs.push(`text-decoration="${deco}"`);
  if (run.color && /^#[0-9a-fA-F]{3,8}$/.test(run.color)) attrs.push(`fill="${esc(run.color)}"`);
  if (run.font === 'mono') attrs.push(`font-family="${esc(ctx.slots.mono)}"`);
  return attrs.length > 0 ? `<tspan ${attrs.join(' ')}>${esc(run.text)}</tspan>` : esc(run.text);
}

/**
 * Draw one compiled frame as a standalone SVG string at the frame's own size.
 *
 * The frame's own Design row leads its layer list and states the origin every
 * child is placed against, so the drawing takes that origin off each row and
 * writes a document whose own top left is the frame's.
 */
export function framePreviewSvg(frame: CompiledFrameV1, opts: FramePreviewOptsV1): string {
  const head = frame.layers[0];
  const offset = head && str(head, 'kind') === 'frame'
    ? { x: num(head, 'x'), y: num(head, 'y') }
    : { x: 0, y: 0 };
  const brand = opts.fonts?.brand || DEFAULT_FAMILY;
  // A frame the renovate compile wrote names its slide master; drawn with the design
  // system's brand face, every text in it is held to the design system's faces.
  const held = Boolean(opts.fonts?.brand) && typeof frame.masterId === 'string' && frame.masterId !== '';
  const mono = opts.fonts?.mono || (held ? brand : DEFAULT_MONO);
  const thumbnail = opts.detail === 'thumbnail';
  const ctx: DrawCtxV1 = {
    family: brand,
    slots: {
      sans: opts.fonts?.sans || brand,
      display: opts.fonts?.display || brand,
      mono,
    },
    assetHref: opts.assetHref,
  };
  if (held) ctx.faces = new Set([brand, mono].map((face) => face.toLowerCase()));
  if (thumbnail) {
    const long = Math.max(frame.width, frame.height, 1);
    const edge = opts.longEdge !== undefined && Number.isFinite(opts.longEdge) && opts.longEdge > 0 ? opts.longEdge : THUMBNAIL_LONG_EDGE;
    ctx.thumbScale = edge / long;
  }
  const placeholders = new Set(frame.placeholderLayerIds);
  const showPlaceholders = opts.showPlaceholders ?? true;
  const showEmptySlots = opts.emptySlots ?? showPlaceholders;

  const body: string[] = [];
  const ground = head ? str(head, 'bg') : '';
  body.push(
    `<rect x="0" y="0" width="${round2(frame.width)}" height="${round2(frame.height)}"`
    + ` fill="${ground ? esc(ground) : '#ffffff'}"/>`,
  );

  for (const row of frame.layers) {
    if (str(row, 'kind') === 'frame') continue;
    if (flag(row, 'hidden')) continue;
    const isPlaceholder = placeholders.has(str(row, 'id'));
    if (isPlaceholder ? !showPlaceholders : !showEmptySlots && emptySlot(row)) continue;
    body.push(drawRow(row, offset, isPlaceholder, ctx));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${round2(frame.width)}" height="${round2(frame.height)}"`
    + ` viewBox="0 0 ${round2(frame.width)} ${round2(frame.height)}" role="img"`
    + ` aria-label="${esc(frame.name)}">${body.join('')}</svg>`;
}
