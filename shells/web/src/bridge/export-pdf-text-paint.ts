// SPDX-License-Identifier: MPL-2.0
/**
 * How the PDF walker paints an HTML text run (renderInlineContent in export.ts): the
 * run's own fill, and the background that `background-clip: text` shows through its
 * glyphs.
 *
 * A box with `background-clip: text` paints its background only inside its text, and
 * the text's own colour on top, which is usually transparent so the background is all
 * that shows. The walker therefore leaves that box's background out
 * (clipsBackgroundToText) and fills each run inside it with the background instead:
 * an outlined run takes the gradient as a vector shading through its glyph outlines,
 * and live text keeps its font and takes the gradient through a shading pattern, so
 * the words stay selectable and searchable. The gradient is placed on the box as its
 * background is, so it runs across the whole box and not glyph by glyph.
 *
 * A run whose own fill is fully transparent paints nothing of its own; it used to be
 * drawn in black.
 */
import { drawSvgPathToPdf, pdfGradientSpec, withPdfAlpha } from './export-pdf-vector.ts';
import { parseCssColorFull } from './export-css.ts';
import { textStrokeAttrs } from './text-svg.ts';
import type { PdfDoc, ShadingFill } from './export-pdf-doc.ts';

type Rgb = [number, number, number];

/** The background a run's glyphs show: a gradient as a shading, or a solid colour. */
type Under = { fill: ShadingFill } | { rgb: Rgb; alpha: number };

export interface RunPaint {
  /** The run's own fill, -webkit-text-fill-color, which follows color unless set. */
  rgb: Rgb;
  alpha: number;
  /** What background-clip: text shows through the glyphs, under the run's own fill. */
  under: Under | null;
}

/** The parts of the writer this module draws with, so a test double needs no more. */
type Writer = Pick<PdfDoc, 'addShadingPattern' | 'ShadingPattern' | 'Matrix' | 'fill' | 'setFillColor' | 'setDrawColor' | 'setLineWidth'
  | 'setLineJoin' | 'stroke' | 'fillStroke' | 'text' | 'setTextColor' | 'getTextColor' | 'setTextFill' | 'moveTo' | 'lineTo' | 'curveTo' | 'close'
  | 'setGState' | 'GState' | 'saveGraphicsState' | 'restoreGraphicsState'>;

/** A colour written with no alpha at all: transparent, or a fourth component of zero. */
const ZERO_ALPHA = /^transparent$|^rgba?\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*0*\.?0*%?\s*\)$|\/\s*0*\.?0*%?\s*\)$/;

/** Whether a box's background is painted only inside its text. */
export function clipsBackgroundToText(style: CSSStyleDeclaration): boolean {
  const clip = style.backgroundClip || style.getPropertyValue('-webkit-background-clip');
  return /(^|,)\s*text\s*($|,)/.test(clip);
}

/** Per export and box: the background its text shows, worked out once. */
const unders = new WeakMap<object, Map<Element, Under | null>>();
let shadingSeq = 0;

/**
 * The background of `box` that its text shows, in page points: a single linear or
 * radial gradient as a shading placed on the box, or the box's background colour.
 */
function underOf(pdf: Writer, box: Element, style: CSSStyleDeclaration, origin: { left: number; top: number }, scaleX: number, scaleY: number, cssToPt: number): Under | null {
  let seen = unders.get(pdf);
  if (!seen) { seen = new Map(); unders.set(pdf, seen); }
  if (seen.has(box)) return seen.get(box)!;
  const r = box.getBoundingClientRect();
  const x = (r.left - origin.left) * scaleX, y = (r.top - origin.top) * scaleY, w = r.width * scaleX, h = r.height * scaleY;
  const spec = style.backgroundImage && style.backgroundImage !== 'none' ? pdfGradientSpec(style.backgroundImage, x, y, w, h, cssToPt) : null;
  let under: Under | null = null;
  if (spec) {
    const key = `textbg${++shadingSeq}`;
    pdf.addShadingPattern(key, new pdf.ShadingPattern(spec.type, spec.coords, spec.stops.map(s => ({ offset: s.offset, color: [...s.color] }))));
    under = { fill: { key, ...(spec.matrix ? { matrix: new pdf.Matrix(...spec.matrix) } : {}) } };
  } else {
    const bg = parseCssColorFull(style.backgroundColor);
    if (bg && bg[3] > 0) under = { rgb: [bg[0], bg[1], bg[2]], alpha: bg[3] };
  }
  seen.set(box, under);
  return under;
}

/**
 * The paint for a run whose text node sits in `el`: its own fill, and the background
 * of the nearest box at or above `el` whose background is clipped to its text.
 */
export function runPaint(pdf: Writer, el: Element | null, style: CSSStyleDeclaration, origin: { left: number; top: number }, scaleX: number, scaleY: number, cssToPt: number): RunPaint {
  const raw = style.getPropertyValue('-webkit-text-fill-color') || style.color;
  const own = parseCssColorFull(raw);
  const rgb: Rgb = own ? [own[0], own[1], own[2]] : [0, 0, 0];
  // The colour parser has no answer for a fully transparent colour, which is not the
  // same as a colour it cannot read: that one keeps the old black.
  const alpha = own ? own[3] : ZERO_ALPHA.test(raw.trim()) ? 0 : 1;
  let under: Under | null = null;
  for (let box = el; box && box !== document.documentElement; box = box.parentElement) {
    const s = getComputedStyle(box);
    if (clipsBackgroundToText(s)) { under = underOf(pdf, box, s, origin, scaleX, scaleY, cssToPt); break; }
  }
  return { rgb, alpha, under };
}

/** Fill the path `emit` adds with the background a run's glyphs show. */
function fillUnder(pdf: Writer, under: Under, emit: () => void): void {
  if ('fill' in under) { emit(); pdf.fill(under.fill); return; }
  withPdfAlpha(pdf, under.alpha, () => { pdf.setFillColor(under.rgb[0], under.rgb[1], under.rgb[2]); emit(); pdf.fill(); });
}

/**
 * An outlined run: the background its glyphs show, then its own fill unless that is
 * transparent, with -webkit-text-stroke over or under the fill as paint-order says.
 */
export function paintOutlinedRun(pdf: Writer, d: string, mapX: (v: number) => number, mapY: (v: number) => number, style: CSSStyleDeclaration, cssToPt: number, paint: RunPaint): void {
  const emit = (): void => drawSvgPathToPdf(pdf, d, mapX, mapY);
  if (paint.under) fillUnder(pdf, paint.under, emit);
  // -webkit-text-stroke / SVG stroke on the outlined run: a centred stroke, width CSS px
  // to pt. `paint-order: stroke` wants the stroke UNDER the fill, which PDF's B operator
  // (fill then stroke) cannot express, so the path is issued twice in that one case.
  const ts = textStrokeAttrs(style, parseCssColorFull);
  const tsCol = ts.length ? parseCssColorFull(ts[0]![1]) : null;
  const strokeFirst = ts.some(([k, v]) => k === 'paint-order' && v.indexOf('stroke') === 0);
  const lj = ts.find(([k]) => k === 'stroke-linejoin')?.[1];
  const fills = paint.alpha > 0;
  pdf.setFillColor(paint.rgb[0], paint.rgb[1], paint.rgb[2]);
  if (tsCol) {
    pdf.setDrawColor(tsCol[0], tsCol[1], tsCol[2]);
    pdf.setLineWidth(Math.max(0.1, parseFloat(ts.find(([k]) => k === 'stroke-width')?.[1] ?? '1') * cssToPt));
    if (lj) pdf.setLineJoin(lj);
  }
  if (tsCol && strokeFirst) { emit(); pdf.stroke(); }
  if (tsCol && !strokeFirst) { emit(); if (fills) pdf.fillStroke(); else pdf.stroke(); }
  else if (fills) { emit(); pdf.fill(); }
  if (lj) pdf.setLineJoin('miter');
}

/** A live run: the background its glyphs show as live text, then its own fill unless that is transparent. */
export function paintLiveRun(pdf: Writer, text: string, x: number, y: number, paint: RunPaint): void {
  const under = paint.under;
  if (under && 'fill' in under) {
    pdf.setTextFill(under.fill);
    try { pdf.text(text, x, y, { baseline: 'alphabetic' }); } finally { pdf.setTextFill(null); }
  } else if (under) {
    const prior = pdf.getTextColor();
    withPdfAlpha(pdf, under.alpha, () => { pdf.setTextColor(under.rgb[0], under.rgb[1], under.rgb[2]); pdf.text(text, x, y, { baseline: 'alphabetic' }); });
    pdf.setTextColor(prior);
  }
  if (paint.alpha > 0) pdf.text(text, x, y, { baseline: 'alphabetic' });
}
