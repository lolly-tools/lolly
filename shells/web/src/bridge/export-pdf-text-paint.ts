// SPDX-License-Identifier: MPL-2.0
/**
 * How the PDF walker paints an HTML text run (renderInlineContent in export.ts): the
 * run's own fill, and the background that `background-clip: text` shows through its
 * glyphs.
 *
 * A box with `background-clip: text` paints its background only inside its text, and
 * the text's own colour on top, which is often transparent so the background is all
 * that shows. The walker therefore leaves that box's background out
 * (clipsBackgroundToText) and paints the background through each run inside the box: the
 * glyphs become a clip, the background is painted inside the clip and then the run's
 * own colour at its own alpha. A single linear or radial gradient with opaque stops
 * goes in as a vector shading. Any other background (an image, a repeating or conic
 * gradient, several layers, transparent stops) goes in as a picture of the box's
 * background, which the caller supplies. The background is placed on the box, so it
 * runs across the whole box and not glyph by glyph.
 *
 * Live text is set once per run, whatever is painted through the glyphs, so copy and
 * search find each word once. A run with no paint of its own and no background beneath
 * is set as invisible text (render mode 3), which keeps the words searchable.
 */
import { drawSvgPathToPdf, pdfGradientSpec, sampleGradientMidpoint } from './export-pdf-vector.ts';
import { parseCssColorFull } from './export-css.ts';
import { textStrokeAttrs } from './text-svg.ts';
import { rasterizeNodeToDataUrl } from './export-svg-walker.ts';
import { MAX_RASTER_PX, type ImprintState } from './export-shared.ts';
import type { PdfDoc, ShadingFill } from './export-pdf-doc.ts';

type Rgb = [number, number, number];
interface Box { x: number; y: number; w: number; h: number }

/** The background a run's glyphs show, placed on its box in page points. */
type Under =
  | { kind: 'shading'; fill: ShadingFill; box: Box }
  | { kind: 'solid'; rgb: Rgb; alpha: number; box: Box }
  | { kind: 'picture'; src: string; box: Box };

export interface RunPaint {
  /** The run's own fill, -webkit-text-fill-color, which follows color unless set. */
  rgb: Rgb;
  alpha: number;
  /** What background-clip: text shows through the glyphs, under the run's own fill. */
  under: Under | null;
}

/** A picture of a box's background as a PNG data URL, `w` by `h` page points, or null. */
export type BackgroundPicture = (box: Element, w: number, h: number) => Promise<string | null>;

/**
 * A picture of a box's background alone at `dpi`, for text that shows a background the
 * writer cannot shade. A stand-in with the box's size, borders, padding and background
 * longhands is pictured, so the text itself is not in the picture. `wPt` by `hPt` is
 * the box on the page.
 */
export async function backgroundPicture(box: Element, wPt: number, hPt: number, dpi: number, imprint?: ImprintState): Promise<string | null> {
  const r = box.getBoundingClientRect();
  if (r.width < 0.5 || r.height < 0.5) return null;
  const s = getComputedStyle(box);
  const stand = document.createElement('div');
  stand.style.cssText = `position:absolute;left:-99999px;top:0;margin:0;box-sizing:border-box;width:${r.width}px;height:${r.height}px;border-style:solid;border-color:transparent`;
  for (const p of ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'background-image', 'background-color', 'background-size', 'background-position', 'background-repeat', 'background-origin', 'background-blend-mode']) {
    stand.style.setProperty(p, s.getPropertyValue(p));
  }
  stand.style.setProperty('background-clip', 'border-box');
  document.body.appendChild(stand);
  try {
    const px = (pt: number): number => Math.max(2, Math.min(MAX_RASTER_PX, Math.round((pt * dpi) / 72)));
    return await rasterizeNodeToDataUrl(stand, px(wPt), px(hPt), undefined, imprint, true);
  } finally { stand.remove(); }
}

/** The parts of the writer this module draws with, so a test double needs no more. */
type Writer = Pick<PdfDoc, 'addShadingPattern' | 'ShadingPattern' | 'Matrix' | 'fill' | 'setFillColor' | 'setDrawColor' | 'setLineWidth'
  | 'setLineJoin' | 'stroke' | 'text' | 'moveTo' | 'lineTo' | 'curveTo' | 'close' | 'rect' | 'clip' | 'discardPath' | 'addImage'
  | 'setGState' | 'GState' | 'saveGraphicsState' | 'restoreGraphicsState' | 'getTextWidth' | 'currentAlpha'>;

/** A colour written with no alpha at all: transparent, or a fourth component of zero. */
const ZERO_ALPHA = /^transparent$|^rgba?\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*0*\.?0*%?\s*\)$|\/\s*0*\.?0*%?\s*\)$/;

/** Whether a box's background is painted only inside its text. */
export function clipsBackgroundToText(style: CSSStyleDeclaration): boolean {
  const clip = style.backgroundClip || style.getPropertyValue('-webkit-background-clip');
  return /(^|,)\s*text\s*($|,)/.test(clip);
}

/** Per export and box: the background its text shows, worked out once. */
const unders = new WeakMap<object, Map<Element, Promise<Under | null>>>();
let shadingSeq = 0;

/**
 * The background of `box` that its text shows, placed on the box in page points: a
 * single linear or radial gradient with opaque stops as a shading, any other
 * background as a picture or the background colour alone. Without a picture, a
 * gradient falls back to its middle colour.
 */
async function underOf(pdf: Writer, box: Element, style: CSSStyleDeclaration, origin: { left: number; top: number }, scaleX: number, scaleY: number, cssToPt: number, picture?: BackgroundPicture): Promise<Under | null> {
  const r = box.getBoundingClientRect();
  const place: Box = { x: (r.left - origin.left) * scaleX, y: (r.top - origin.top) * scaleY, w: r.width * scaleX, h: r.height * scaleY };
  const image = style.backgroundImage && style.backgroundImage !== 'none' ? style.backgroundImage : '';
  const color = parseCssColorFull(style.backgroundColor);
  if (image) {
    const spec = pdfGradientSpec(image, place.x, place.y, place.w, place.h, cssToPt);
    if (spec && !spec.hasAlpha) {
      const key = `textbg${++shadingSeq}`;
      pdf.addShadingPattern(key, new pdf.ShadingPattern(spec.type, spec.coords, spec.stops.map(s => ({ offset: s.offset, color: [...s.color] }))));
      return { kind: 'shading', fill: { key, ...(spec.matrix ? { matrix: new pdf.Matrix(...spec.matrix) } : {}) }, box: place };
    }
    const src = picture ? await picture(box, place.w, place.h).catch(() => null) : null;
    if (src) return { kind: 'picture', src, box: place };
    const mid = sampleGradientMidpoint(image);
    if (mid) return { kind: 'solid', rgb: mid, alpha: 1, box: place };
  }
  return color && color[3] > 0 ? { kind: 'solid', rgb: [color[0], color[1], color[2]], alpha: color[3], box: place } : null;
}

/**
 * The paint for a run whose text node sits in `el`: its own fill, and the background
 * of the nearest box at or above `el` whose background is clipped to its text.
 */
export async function runPaint(pdf: Writer, el: Element | null, style: CSSStyleDeclaration, origin: { left: number; top: number }, scaleX: number, scaleY: number, cssToPt: number, picture?: BackgroundPicture): Promise<RunPaint> {
  const raw = style.getPropertyValue('-webkit-text-fill-color') || style.color;
  const own = parseCssColorFull(raw);
  const rgb: Rgb = own ? [own[0], own[1], own[2]] : [0, 0, 0];
  // The colour parser has no answer for a fully transparent colour, which is not the
  // same as a colour it cannot read: that one keeps the old black.
  const alpha = own ? own[3] : ZERO_ALPHA.test(raw.trim()) ? 0 : 1;
  let under: Promise<Under | null> | null = null;
  for (let box = el; box && box !== document.documentElement; box = box.parentElement) {
    const s = getComputedStyle(box);
    if (!clipsBackgroundToText(s)) continue;
    let seen = unders.get(pdf);
    if (!seen) { seen = new Map(); unders.set(pdf, seen); }
    under = seen.get(box) ?? underOf(pdf, box, s, origin, scaleX, scaleY, cssToPt, picture);
    seen.set(box, under);
    break;
  }
  return { rgb, alpha, under: under ? await under : null };
}

/** Paint at `alpha` times the alpha already in force, which an element's opacity may have set. */
function withRunAlpha(pdf: Writer, alpha: number, draw: () => void): void {
  if (alpha >= 1) { draw(); return; }
  const outer = typeof pdf.currentAlpha === 'function' ? pdf.currentAlpha() : 1;
  pdf.saveGraphicsState();
  try {
    pdf.setGState(new pdf.GState({ opacity: outer * alpha, 'stroke-opacity': outer * alpha }));
    draw();
  } finally { pdf.restoreGraphicsState(); }
}

/** Paint the background over its box, inside whatever clip is in force. */
function paintUnder(pdf: Writer, under: Under): void {
  const { x, y, w, h } = under.box;
  if (under.kind === 'picture') { pdf.addImage(under.src, 'PNG', x, y, w, h); return; }
  if (under.kind === 'shading') { pdf.rect(x, y, w, h, null); pdf.fill(under.fill); return; }
  withRunAlpha(pdf, under.alpha, () => { pdf.setFillColor(under.rgb[0], under.rgb[1], under.rgb[2]); pdf.rect(x, y, w, h, null); pdf.fill(); });
}

/**
 * An outlined run: the background its glyphs show, then its own fill at its own alpha
 * unless that is transparent, with -webkit-text-stroke over or under the fill as
 * paint-order says.
 */
export function paintOutlinedRun(pdf: Writer, d: string, mapX: (v: number) => number, mapY: (v: number) => number, style: CSSStyleDeclaration, cssToPt: number, paint: RunPaint): void {
  const emit = (): void => drawSvgPathToPdf(pdf, d, mapX, mapY);
  if (paint.under) {
    pdf.saveGraphicsState();
    try { emit(); pdf.clip(); pdf.discardPath(); paintUnder(pdf, paint.under); } finally { pdf.restoreGraphicsState(); }
  }
  // -webkit-text-stroke / SVG stroke on the outlined run: a centred stroke, width CSS px
  // to pt, at the stroke colour's own alpha. `paint-order: stroke` puts it under the fill.
  const ts = textStrokeAttrs(style, parseCssColorFull);
  const attr = (k: string): string | undefined => ts.find(([name]) => name === k)?.[1];
  const tsCol = ts.length ? parseCssColorFull(ts[0]![1]) : null;
  const strokeFirst = (attr('paint-order') ?? '').indexOf('stroke') === 0;
  const lj = attr('stroke-linejoin');
  const stroke = (): void => {
    if (!tsCol) return;
    withRunAlpha(pdf, parseFloat(attr('stroke-opacity') ?? '1'), () => {
      pdf.setDrawColor(tsCol[0], tsCol[1], tsCol[2]);
      pdf.setLineWidth(Math.max(0.1, parseFloat(attr('stroke-width') ?? '1') * cssToPt));
      if (lj) pdf.setLineJoin(lj);
      emit();
      pdf.stroke();
      if (lj) pdf.setLineJoin('miter');
    });
  };
  const fill = (): void => {
    if (paint.alpha <= 0) return;
    withRunAlpha(pdf, paint.alpha, () => { pdf.setFillColor(paint.rgb[0], paint.rgb[1], paint.rgb[2]); emit(); pdf.fill(); });
  };
  if (strokeFirst) { stroke(); fill(); } else { fill(); stroke(); }
}

/**
 * A live run. With a background beneath, the run is set once as a clip and the
 * background and then its own colour are painted through the glyphs. Without one it is
 * set in its own colour at its own alpha, or as invisible text when that colour is
 * transparent, so the words can still be found.
 */
export function paintLiveRun(pdf: Writer, text: string, x: number, y: number, paint: RunPaint): void {
  const under = paint.under;
  if (!under) {
    if (paint.alpha > 0) withRunAlpha(pdf, paint.alpha, () => { pdf.text(text, x, y, { baseline: 'alphabetic' }); });
    else pdf.text(text, x, y, { baseline: 'alphabetic', render: 'invisible' });
    return;
  }
  pdf.saveGraphicsState();
  try {
    pdf.text(text, x, y, { baseline: 'alphabetic', render: 'clip' });
    paintUnder(pdf, under);
    if (paint.alpha > 0) {
      // The run's own colour over the background, across the run's extent; the clip
      // keeps the paint to the glyphs.
      const width = pdf.getTextWidth(text);
      const pad = Math.max(under.box.h, width);
      withRunAlpha(pdf, paint.alpha, () => {
        pdf.setFillColor(paint.rgb[0], paint.rgb[1], paint.rgb[2]);
        pdf.rect(x - pad, y - pad, width + 2 * pad, 2 * pad, null);
        pdf.fill();
      });
    }
  } finally { pdf.restoreGraphicsState(); }
}
