// SPDX-License-Identifier: MPL-2.0
/**
 * An SVG painted into a PDF page as vectors. Every PDF export uses this for an inline
 * `<svg>`, an SVG in an `<img>`, an SVG-rooted page, a Design path box and the artwork
 * of an emoji placement.
 *
 * Each transform goes into the content stream as a matrix, so geometry is written in
 * user units and strokes scale with their shapes, as in SVG. Transforms are read from
 * the computed style, so a CSS transform counts as well as the attribute, about its
 * transform-origin. The painter draws:
 *
 * - clip paths on any element, with `<use>` outlines, `clip-rule` and both
 *   `clipPathUnits`: one outline as a PDF clip, several as a soft mask of their union;
 * - paint carried on `<use>`, which the drawn instance inherits (StyleScope);
 * - the edge of every viewport, root and nested `<svg>`, as a clip; a nested one's
 *   overflow visible or auto, as in Chromium, leaves it unclipped;
 * - fill, stroke and element opacity as alpha in the graphics state, and the opacity
 *   of a group or of a shape with both fill and stroke as a transparency group, so
 *   overlapping parts are faded as one picture;
 * - mix-blend-mode as the group's PDF blend mode, and isolation as an isolated group;
 * - linear and radial gradients as PDF shadings, with their units, transform, focal
 *   point and an href chain. Stop opacities become a soft mask, a gradient stroke is
 *   the shading seen through a soft mask of the stroke and outlined text takes the
 *   shading as a shape does. Live text keeps its font and fills through a shading
 *   pattern;
 * - markers on paths, lines, polylines and polygons (export-pdf-svg-markers.ts);
 * - text runs on dominant-baseline as the browser places them, with the computed
 *   weight, so a keyword such as bold counts. A group's bounds take in the text the
 *   PDF actually sets, which its own font can make wider than the browser's box.
 *
 * What stays a picture (scanSvg): an SVG holding a filter, a mask, a pattern, a
 * textPath, a foreignObject, text in a clip path or a gradient that spreads by reflect
 * or repeat. An element with a CSS filter, a CSS mask, a basic-shape clip-path, a
 * perspective transform or a plus-lighter or plus-darker blend does the same, as does
 * text with a baseline shift, a vertical writing mode or a per-glyph rotate. The
 * painter does not draw those, so the whole SVG is rasterised at 150 dpi instead.
 */
import { _host, blobToDataUrl } from './export-shared.ts';
import { drawSvgPathToPdf } from './export-pdf-vector.ts';
import { resolveVectorFont } from './font-registry.ts';
import { embedResolvedFont } from './export-font-data.ts';
import { embedSuseFont, pdfFontEmbed, suseFontName } from './export-pdf-fonts.ts';
import { inlineSvgFromImg } from './export-svg-walker.ts';
import { PDF_BLEND_MODES, type PdfDoc, type ShadingFill } from './export-pdf-doc.ts';
import {
  IDENT, emitSubpaths, firstLen, invert, isIdentity, len, lengthScale, mapBox, mul, parseCssTransform, shapeSubpaths,
  subpathsBox, transformOf, translate, unionBox, viewBoxMatrix, viewBoxOf, type Box, type Mat, type SubPath, type Viewport,
} from './export-pdf-svg-geom.ts';
import { StyleScope, findById, parsePaint, resolveGradient, type Paint, type ShadingSpec } from './export-pdf-svg-style.ts';
import { markerLayout, markerReach, markerRef, markerVertices } from './export-pdf-svg-markers.ts';

export interface SvgPaintOptions {
  registeredFonts?: Set<unknown> | null;
  /** Outline text runs (the export's Convert paths setting). Default true. */
  convertPaths?: boolean;
  /** Mirror the picture horizontally inside its region. */
  flipX?: boolean;
  /** Mirror the picture vertically inside its region; with flipX, a half turn. */
  flipY?: boolean;
  /**
   * The SVG is a document of its own, the source of an `<img>` or `<image>`, so its
   * blend modes mix only with what the SVG itself draws, never with the page beneath.
   */
  isolated?: boolean;
  /** Draw the SVG as a picture instead: a PNG data URL at this pixel size. */
  rasterize?: (svgEl: Element, pxW: number, pxH: number) => Promise<string>;
  /** Make an image source placeable as PNG or JPEG. */
  imageForPdf?: (src: string) => Promise<{ src: string; fmt: string }>;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
/** Shapes that carry markers. */
const MARKABLE = new Set(['path', 'line', 'polyline', 'polygon']);
/** Elements that draw nothing where they stand. */
const SKIP = new Set(['defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'symbol', 'pattern', 'filter',
  'title', 'desc', 'metadata', 'style', 'script', 'marker', 'view', 'foreignObject', 'animate', 'animateMotion', 'animateTransform', 'set']);
/** Elements whose presence alone makes the SVG a picture. */
const PICTURE_ONLY = 'filter, mask, pattern, textPath, foreignObject';

/** What the painter needs to know about an SVG before drawing any part. */
export interface SvgScan {
  /** Why the SVG has to be drawn as a picture, or null when the painter can draw every part. */
  reason: string | null;
  /** Whether any element blends with what lies beneath the element. */
  blends: boolean;
}

/**
 * Look through the SVG, the root included, for what the painter cannot draw and for
 * blend modes. The check is by presence, as the previous painter's was, so a
 * definition nothing uses still counts.
 */
export function scanSvg(svgEl: Element): SvgScan {
  const unsupported = svgEl.querySelector(PICTURE_ONLY);
  if (unsupported) return { reason: `<${unsupported.localName}>`, blends: false };
  for (const g of svgEl.querySelectorAll('linearGradient, radialGradient')) {
    const spread = g.getAttribute('spreadMethod');
    if (spread && spread !== 'pad') return { reason: `spreadMethod ${spread}`, blends: false };
  }
  if (svgEl.querySelector('clipPath text')) return { reason: 'text in a clip path', blends: false };
  let blends = false;
  for (const el of [svgEl, ...svgEl.querySelectorAll('*')]) {
    if (el.namespaceURI !== SVG_NS) continue;
    const s = getComputedStyle(el);
    if (s.filter && s.filter !== 'none') return { reason: `a CSS filter (${s.filter})`, blends };
    const mask = s.maskImage || s.getPropertyValue('-webkit-mask-image') || 'none';
    if (mask !== 'none') return { reason: 'a CSS mask', blends };
    const cp = s.clipPath || 'none';
    if (cp !== 'none' && !cp.startsWith('url(')) return { reason: `clip-path ${cp}`, blends };
    if (parseCssTransform(s.transform || 'none') === 'perspective') return { reason: 'a perspective transform', blends };
    const blend = s.mixBlendMode || 'normal';
    if (blend !== 'normal') {
      if (!PDF_BLEND_MODES[blend]) return { reason: `mix-blend-mode ${blend}`, blends };
      if (el !== svgEl) blends = true;
    }
    if (el.localName === 'text' || el.localName === 'tspan') {
      const reason = textLayoutReason(el, s);
      if (reason) return { reason, blends };
    }
  }
  return { reason: null, blends };
}

/**
 * Text layout drawText does not reproduce: a baseline shift (super, sub or a length),
 * a vertical writing mode and a per-glyph rotate. The painter sets each run on one
 * horizontal baseline, so such text would print in the wrong place or the wrong
 * direction; the SVG is drawn as a picture instead.
 */
function textLayoutReason(el: Element, s: CSSStyleDeclaration): string | null {
  const shift = (s.getPropertyValue('baseline-shift') || '0px').trim();
  if (shift !== '0px' && shift !== '0' && shift !== 'baseline' && parseFloat(shift) !== 0) return `text with baseline-shift ${shift}`;
  const mode = (s.writingMode || 'horizontal-tb').trim();
  if (mode !== 'horizontal-tb' && !/^(lr|lr-tb|rl|rl-tb)$/.test(mode)) return `text in writing-mode ${mode}`;
  if (el.getAttribute('rotate')?.split(/[\s,]+/).some(v => v && parseFloat(v) !== 0)) return 'text with a per-glyph rotate';
  return null;
}

/** Why this SVG has to be drawn as a picture, or null when the painter can draw every part. */
export function svgRasterReason(svgEl: Element): string | null {
  return scanSvg(svgEl).reason;
}

/** The mirrors an `<svg>` box carries: horizontal, vertical or both for a half turn. */
export interface SvgFlips { x: boolean; y: boolean }

/**
 * The mirrors an `<svg>` box carries that the walker left for the painter. The walker
 * draws an axis-aligned transform as the element's box, and a mirror does not change
 * the box, so the mirrors are read from the computed transform (a matrix3d without
 * perspective included, so rotateY(180deg) counts) and the computed scale property,
 * which the walker does not read at all. A transform that scales both axes by a
 * negative amount is a half turn the walker draws itself, as it does a rotation or a
 * skew, which it neutralises and draws under the full matrix; the scale property's
 * half turn is the painter's. A class name says nothing about any of this.
 */
export function svgFlips(style: Pick<CSSStyleDeclaration, 'transform' | 'scale'>): SvgFlips {
  const m = parseCssTransform(style.transform || 'none');
  const t = m && m !== 'perspective' ? m : null;
  const scale = (style.scale || 'none').trim().split(/\s+/).map(Number);
  // One value scales both axes.
  const sx = Number.isFinite(scale[0]) ? scale[0]! : 1, sy = Number.isFinite(scale[1]) ? scale[1]! : sx;
  return { x: (t ? t.a < 0 && t.d > 0 : false) !== sx < 0, y: (t ? t.a > 0 && t.d < 0 : false) !== sy < 0 };
}

/** Per export: shadings by their content, and pictures of emoji artwork by glyph and size. */
const shadingKeys = new WeakMap<object, Map<string, string>>();
const glyphPictures = new WeakMap<object, Map<string, Promise<string>>>();
let shadingSeq = 0;

interface Ctx {
  pdf: PdfDoc;
  root: Element;
  scope: StyleScope;
  opts: SvgPaintOptions;
  vp: Viewport;
  /** User space to page points, for group bounds and non-scaling strokes. */
  ctm: Mat;
  /** Page points per CSS pixel of the outermost SVG: the space a non-scaling stroke is measured in. */
  hostScale: number;
  groups: boolean;
  walked: number;
  depth: number;
  /** Markers being drawn, so a marker that marks its own content stops there. */
  markers: Set<Element>;
  /** The shape whose markers are being drawn: what context-fill and context-stroke paint with. */
  context: Element | null;
  /** That shape's user space to page points and its viewport, for a gradient it lends. */
  contextCtm: Mat | null;
  contextVp: Viewport | null;
  /**
   * One record per open group, of what drawText drew inside the group, in page points.
   * Text is laid out by the PDF's own font, which can run wider than the browser's box
   * for the same text, so a group's bounds take in what was drawn.
   */
  drawn: { box: Box | null }[];
}

/** Nesting deeper than this is not drawn, which bounds a hostile or runaway tree. */
const MAX_DEPTH = 256;
const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1);
const setMatrix = (pdf: PdfDoc, m: Mat): void => { pdf.setCurrentTransformationMatrix(new pdf.Matrix(m.a, m.b, m.c, m.d, m.e, m.f)); };
const warned = new WeakMap<object, Set<string>>();
function note(ctx: Ctx, msg: string): void {
  let seen = warned.get(ctx.pdf);
  if (!seen) { seen = new Set(); warned.set(ctx.pdf, seen); }
  if (seen.has(msg)) return;
  seen.add(msg);
  _host?.log?.('info', `pdf: ${msg}`);
}

/**
 * Paint `svgEl` into `region` (points, in the current user space of the page). The
 * viewBox and preserveAspectRatio map the SVG onto the region the way the browser maps
 * the SVG onto its box. `parentCtm` places the region on the page in a nested call.
 */
export async function paintSvgToPdf(pdf: PdfDoc, svgEl: Element, region: Box, opts: SvgPaintOptions = {}, parentCtm: Mat = IDENT): Promise<void> {
  if (!(region.w > 0) || !(region.h > 0)) return;
  const scan = scanSvg(svgEl);
  if (scan.reason && opts.rasterize) { await paintPicture(pdf, svgEl, region, opts, parentCtm, scan.reason); return; }
  const scope = new StyleScope();
  const own = { w: (svgEl as SVGSVGElement).clientWidth || svgEl.getBoundingClientRect().width || region.w, h: (svgEl as SVGSVGElement).clientHeight || svgEl.getBoundingClientRect().height || region.h };
  const vb = viewBoxOf(svgEl) ?? { x: 0, y: 0, w: own.w, h: own.h };
  let m = viewBoxMatrix(vb, region, svgEl.getAttribute('preserveAspectRatio'));
  if (opts.flipX || opts.flipY) {
    m = mul({ a: opts.flipX ? -1 : 1, b: 0, c: 0, d: opts.flipY ? -1 : 1, e: opts.flipX ? 2 * region.x + region.w : 0, f: opts.flipY ? 2 * region.y + region.h : 0 }, m);
  }
  const ctx: Ctx = {
    pdf, root: svgEl, scope, opts, vp: { w: vb.w, h: vb.h }, ctm: mul(parentCtm, m),
    hostScale: lengthScale(parentCtm) * (region.w / own.w),
    groups: typeof pdf.beginGroup === 'function', walked: 0, depth: 0, markers: new Set(), context: null,
    contextCtm: null, contextVp: null, drawn: [],
  };
  // The walker fades an <img>, or an <svg> of a few shapes, by setting an alpha around
  // the picture. PDF sets alpha rather than multiplying it, so the picture is drawn as
  // one group under that alpha: alphas inside start again from 1, and overlapping
  // parts fade together, as they do under CSS opacity. A group also keeps the blend
  // modes of an SVG drawn as its own document inside that document, and carries the
  // root's own blend mode onto the page.
  const outer = typeof pdf.currentAlpha === 'function' ? clamp01(pdf.currentAlpha()) : 1;
  const rootBlend = blendOf(svgEl, ctx);
  const group = ctx.groups && (outer < 1 || rootBlend !== null || (opts.isolated === true && scan.blends));
  const draw = async (fold: number): Promise<void> => {
    pdf.saveGraphicsState();
    try {
      if (scope.raw(svgEl, 'overflow') !== 'visible') { pdf.rect(region.x, region.y, region.w, region.h, null); pdf.clip(); pdf.discardPath(); }
      setMatrix(pdf, m);
      await drawChildren(svgEl, ctx, fold);
    } finally { pdf.restoreGraphicsState(); }
  };
  if (!group) { await draw(outer); return; }
  pdf.beginGroup();
  try { await draw(1); }
  finally { pdf.paintGroup(pdf.endGroup(boundsOf(parentCtm, region)), outer, undefined, rootBlend); }
}

/** The SVG as a picture at 150 dpi; emoji artwork is captured once per glyph, size, mirrors and colour. */
async function paintPicture(pdf: PdfDoc, svgEl: Element, region: Box, opts: SvgPaintOptions, parentCtm: Mat, reason: string): Promise<void> {
  const dpr = (150 / 72) * lengthScale(parentCtm);
  const pxW = Math.max(2, Math.min(2000, Math.round(region.w * dpr)));
  const pxH = Math.max(2, Math.min(2000, Math.round(region.h * dpr)));
  const sum = svgEl.parentElement?.getAttribute('data-emoji-sum');
  let cache = glyphPictures.get(pdf);
  if (!cache) { cache = new Map(); glyphPictures.set(pdf, cache); }
  // Artwork painted in currentColor follows the text colour, and a mirrored placement
  // is captured mirrored, so both belong in the key.
  const key = sum ? `${sum}:${pxW}x${pxH}:${opts.flipX ? 'x' : ''}${opts.flipY ? 'y' : ''}:${getComputedStyle(svgEl).color}` : '';
  let png = key ? cache.get(key) : undefined;
  if (!png) {
    png = opts.rasterize!(svgEl, pxW, pxH);
    if (key) cache.set(key, png);
  }
  try {
    pdf.addImage(await png, 'PNG', region.x, region.y, region.w, region.h);
    _host?.log?.('info', `pdf: an SVG drawn as a picture because it holds ${reason}`);
  } catch { /* a picture that will not capture leaves the region empty, as before */ }
}

async function drawChildren(el: Element, ctx: Ctx, fold: number): Promise<void> {
  for (const child of el.children) await visit(child, ctx, fold);
}

/** The PDF blend mode an element's mix-blend-mode asks for, or null for normal. */
function blendOf(el: Element, ctx: Ctx): string | null {
  const mode = ctx.scope.raw(el, 'mix-blend-mode') || 'normal';
  return mode === 'normal' ? null : (PDF_BLEND_MODES[mode] ?? null);
}

/** A fill or stroke value, with context-fill and context-stroke taken from the shape a marker is drawn for. */
function paintValue(el: Element, prop: 'fill' | 'stroke', ctx: Ctx): string {
  const v = ctx.scope.get(el, prop);
  if ((v === 'context-fill' || v === 'context-stroke') && ctx.context) return ctx.scope.get(ctx.context, v === 'context-fill' ? 'fill' : 'stroke');
  return v;
}

/**
 * The paint an element fills or strokes with. Context paint that is a gradient stays
 * the context shape's own gradient, as Chromium draws context paint: spanning that shape's box,
 * placed in that shape's user space and seen through the marker content. A shape whose
 * box has no width or height lends no objectBoundingBox gradient, so nothing is drawn.
 */
function paintFor(el: Element, prop: 'fill' | 'stroke', subs: SubPath[] | null, ctx: Ctx, boxEl: Element = el): Solid | ShadingSpec | null {
  const v = ctx.scope.get(el, prop);
  const src = ctx.context;
  if ((v === 'context-fill' || v === 'context-stroke') && src && ctx.contextCtm && ctx.contextVp) {
    const paint = parsePaint(ctx.scope.get(src, v === 'context-fill' ? 'fill' : 'stroke'));
    if (paint.kind !== 'url') return paintOf(paint, boxEl, subs, ctx);
    const vp = ctx.vp;
    ctx.vp = ctx.contextVp;
    let box: Box | null;
    try { box = boxOf(src, ctx); } finally { ctx.vp = vp; }
    const resolved = resolvedPaint(paint, resolveGradient(ctx.root, paint.id, box, ctx.contextVp, ctx.scope), ctx);
    if (!resolved || 'rgb' in resolved) return resolved;
    const inv = invert(ctx.ctm);
    return inv ? { ...resolved, matrix: mul(inv, mul(ctx.contextCtm, resolved.matrix)) } : null;
  }
  return paintOf(parsePaint(v), boxEl, subs, ctx);
}

/** Whether a viewport clips what falls outside: hidden, scroll and clip do; visible and auto do not. */
function clipsOverflow(el: Element, ctx: Ctx): boolean {
  const overflow = ctx.scope.raw(el, 'overflow');
  return overflow !== 'visible' && overflow !== 'auto';
}

/** A stroke's width in the shape's user space. A non-scaling stroke is measured in the outermost SVG's own pixels. */
function effectiveStrokeWidth(el: Element, ctx: Ctx): number {
  const w = ctx.scope.num(el, 'stroke-width', 1);
  return ctx.scope.get(el, 'vector-effect') === 'non-scaling-stroke' ? (w * ctx.hostScale) / (lengthScale(ctx.ctm) || 1) : w;
}

/** Record a box drawn in the current user space with every open group. */
function noteDrawn(ctx: Ctx, box: Box | null): void {
  if (!box || !ctx.drawn.length || !Number.isFinite(box.x + box.y + box.w + box.h)) return;
  const onPage = mapBox(box, ctx.ctm);
  for (const record of ctx.drawn) record.box = unionBox(record.box, onPage);
}

/** Whether a shape takes markers it can draw. */
function hasMarkers(el: Element, ctx: Ctx): boolean {
  if (!MARKABLE.has(el.localName)) return false;
  const s = ctx.scope;
  return ['marker-start', 'marker-mid', 'marker-end'].some(p => markerRef(s.get(el, p), id => findById(ctx.root, id)) !== null);
}

/** Whether a shape paints its interior: everything but a `<line>`, which has none. */
function fillsInterior(el: Element, ctx: Ctx): boolean {
  if (el.localName === 'line') return false;
  return parsePaint(paintValue(el, 'fill', ctx)).kind !== 'none' && ctx.scope.num(el, 'fill-opacity', 1) > 0;
}

/** A single paint: a shape that fills or strokes but not both, and has no markers, which an alpha can fade exactly. */
function singlePaint(el: Element, ctx: Ctx): boolean {
  const s = ctx.scope;
  const strokes = parsePaint(paintValue(el, 'stroke', ctx)).kind !== 'none' && s.num(el, 'stroke-width', 1) > 0 && s.num(el, 'stroke-opacity', 1) > 0;
  return !(fillsInterior(el, ctx) && strokes) && !hasMarkers(el, ctx);
}

/** Whether an element's opacity can fade its one painted descendant instead of a group. */
function foldable(el: Element, ctx: Ctx): boolean {
  if (blendOf(el, ctx)) return false;
  if (SHAPES.has(el.localName)) return singlePaint(el, ctx);
  if (el.localName === 'text' || el.localName === 'image') return true;
  if (el.localName === 'g' && el.children.length === 1) return foldable(el.children[0]!, ctx);
  return false;
}

/** The clipPath an element points at, or null. */
function clipPathOf(el: Element, ctx: Ctx): Element | null {
  const raw = ctx.scope.raw(el, 'clip-path');
  const ref = /url\(\s*["']?[^"')]*#([^"')]+)["']?\s*\)/.exec(raw);
  const target = ref ? findById(ctx.root, ref[1]!) : null;
  return target?.localName === 'clipPath' ? target : null;
}

/**
 * An element's transform as the browser draws the element: the computed transform
 * (the attribute, or a CSS rule that overrides the attribute) about the computed
 * transform-origin in its transform-box. The attribute is the answer only when the
 * computed value cannot be read.
 */
function matrixOf(el: Element, ctx: Ctx): Mat | null {
  const raw = ctx.scope.raw(el, 'transform');
  if (!raw) return transformOf(el);
  const m = parseCssTransform(raw);
  if (!m || m === 'perspective' || isIdentity(m)) return null;
  const origin = ctx.scope.raw(el, 'transform-origin').split(/\s+/).map(parseFloat);
  let ox = origin[0] || 0, oy = origin[1] || 0;
  // A fill-box or stroke-box origin is measured from the element's own bounding box.
  if (/fill-box|stroke-box|content-box|border-box/.test(ctx.scope.raw(el, 'transform-box'))) {
    const b = boxOf(el, ctx);
    if (b) { ox += b.x; oy += b.y; }
  }
  return ox || oy ? mul(translate(ox, oy), mul(m, translate(-ox, -oy))) : m;
}

async function visit(el: Element, ctx: Ctx, fold: number): Promise<void> {
  if (el.namespaceURI !== SVG_NS || SKIP.has(el.localName)) return;
  if (++ctx.walked % 200 === 0) await new Promise<void>((r) => setTimeout(r));
  if (ctx.depth > MAX_DEPTH) { note(ctx, `elements nested more than ${MAX_DEPTH} deep are not drawn`); return; }
  if (ctx.scope.raw(el, 'display') === 'none') return;
  const opacity = clamp01(parseFloat(ctx.scope.raw(el, 'opacity')));
  if (opacity <= 0) return;
  const t = matrixOf(el, ctx);
  const clip = clipPathOf(el, ctx);
  const blend = blendOf(el, ctx);
  const isolate = ctx.scope.raw(el, 'isolation') === 'isolate';
  const group = ctx.groups && ((opacity < 1 && !foldable(el, ctx)) || blend !== null || isolate);
  const wrap = Boolean(t || clip || group);
  const saved = ctx.ctm;
  ctx.depth++;
  if (wrap) ctx.pdf.saveGraphicsState();
  try {
    if (t) { setMatrix(ctx.pdf, t); ctx.ctm = mul(ctx.ctm, t); }
    const clipped = clip ? applyClip(clip, el, ctx) : true;
    if (clipped === false) return;
    let union = Array.isArray(clipped) ? clipped : null;
    if (union && !ctx.groups) { clipToUnion(ctx, union); union = null; }
    if (group || union) {
      // Composited as one picture, then faded by the opacity, blended by its blend
      // mode and shown through the union of the clip's outlines.
      const record: { box: Box | null } = { box: null };
      ctx.drawn.push(record);
      ctx.pdf.beginGroup();
      try { await drawElement(el, ctx, 1); }
      finally {
        ctx.drawn.pop();
        let box = paintBox(el, ctx);
        const inv = record.box ? invert(ctx.ctm) : null;
        if (box && record.box) box = inv ? unionBox(box, mapBox(record.box, inv)) : null;
        const content = ctx.pdf.endGroup(groupBounds(ctx, box));
        ctx.pdf.paintGroup(content, fold * opacity, union ? clipMask(union, ctx) : undefined, blend);
      }
    } else await drawElement(el, ctx, fold * opacity);
  } finally {
    if (wrap) ctx.pdf.restoreGraphicsState();
    ctx.ctm = saved;
    ctx.depth--;
  }
}

/** A box in some user space as a form's bounding box, padded by a point on the page. */
function boundsOf(ctm: Mat, box: Box): number[] {
  const pad = 1 / (lengthScale(ctm) || 1);
  return [box.x - pad, box.y - pad, box.x + box.w + pad, box.y + box.h + pad];
}

/**
 * A group's bounds in the current user space: the box it paints when that is known,
 * otherwise the page and a margin of its own size all round, so content moved by an
 * enclosing rotation stays inside. A viewer allocates a group as large as its bounds,
 * so a tight box is what keeps a file of many translucent shapes quick to open.
 */
function groupBounds(ctx: Ctx, box: Box | null = null): number[] {
  if (box && Number.isFinite(box.x + box.y + box.w + box.h)) return boundsOf(ctx.ctm, box);
  const page = ctx.pdf.pageSize();
  const inv = invert(ctx.ctm);
  if (!inv) return [-1e5, -1e5, 1e5, 1e5];
  const b = mapBox({ x: -page.w, y: -page.h, w: page.w * 3, h: page.h * 3 }, inv);
  return [b.x, b.y, b.x + b.w, b.y + b.h];
}

const grow = (b: Box, r: number): Box => ({ x: b.x - r, y: b.y - r, w: b.w + 2 * r, h: b.h + 2 * r });

/** How far a shape's stroke reaches outside its outline: half the width, more at mitred corners and square caps. */
function strokeReach(el: Element, ctx: Ctx): number {
  const s = ctx.scope;
  if (parsePaint(paintValue(el, 'stroke', ctx)).kind === 'none') return 0;
  const w = effectiveStrokeWidth(el, ctx);
  if (!(w > 0)) return 0;
  const join = s.get(el, 'stroke-linejoin') || 'miter';
  const miter = join.startsWith('miter') ? Math.max(1, s.num(el, 'stroke-miterlimit', 4)) : 1;
  return (w / 2) * Math.max(miter, Math.SQRT2);
}

/**
 * What an element paints, as a box in its own user space: its geometry grown by the
 * reach of its strokes and markers. Null when that is not known, such as content
 * that overflows a viewport.
 */
function paintBox(el: Element, ctx: Ctx, depth = 0): Box | null {
  if (depth > 32) return null;
  const name = el.localName;
  if (SHAPES.has(name)) {
    const subs = shapeSubpaths(el, ctx.vp);
    const b = subs ? subpathsBox(subs) : null;
    if (!b) return null;
    let reach = strokeReach(el, ctx);
    if (MARKABLE.has(name)) {
      for (const p of ['marker-start', 'marker-mid', 'marker-end']) {
        const marker = markerRef(ctx.scope.get(el, p), id => findById(ctx.root, id));
        if (!marker) continue;
        if (!clipsOverflow(marker, ctx)) return null;
        reach = Math.max(reach, markerReach(marker, effectiveStrokeWidth(el, ctx), ctx.vp));
      }
    }
    return grow(b, reach);
  }
  if (name === 'text') {
    // The browser's box; the group adds what drawText actually drew (Ctx.drawn).
    try { const b = (el as SVGGraphicsElement).getBBox(); return grow({ x: b.x, y: b.y, w: b.width, h: b.height }, (parseFloat(ctx.scope.raw(el, 'font-size')) || 16) / 2); } catch { return null; }
  }
  if (name === 'image') return boxOf(el, ctx);
  if (name === 'svg') {
    if (!clipsOverflow(el, ctx)) return null;
    return { x: len(el.getAttribute('x'), ctx.vp.w), y: len(el.getAttribute('y'), ctx.vp.h), w: len(el.getAttribute('width') ?? '100%', ctx.vp.w), h: len(el.getAttribute('height') ?? '100%', ctx.vp.h) };
  }
  if (name === 'use') {
    const href = (el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '').trim();
    const target = href.startsWith('#') ? findById(ctx.root, href.slice(1)) : null;
    if (!target) return null;
    const at = translate(len(el.getAttribute('x'), ctx.vp.w), len(el.getAttribute('y'), ctx.vp.h));
    if (target.localName === 'symbol' || target.localName === 'svg') {
      if (!clipsOverflow(target, ctx)) return null;
      const w = len(el.getAttribute('width') ?? target.getAttribute('width') ?? '100%', ctx.vp.w);
      const h = len(el.getAttribute('height') ?? target.getAttribute('height') ?? '100%', ctx.vp.h);
      return mapBox({ x: 0, y: 0, w, h }, at);
    }
    const inner = paintBox(target, ctx, depth + 1);
    return inner ? mapBox(inner, mul(at, matrixOf(target, ctx) ?? IDENT)) : null;
  }
  if (name !== 'g' && name !== 'a' && name !== 'switch') return null;
  let box: Box | null = null;
  for (const child of el.children) {
    if (child.namespaceURI !== SVG_NS || SKIP.has(child.localName) || ctx.scope.raw(child, 'display') === 'none') continue;
    const inner = paintBox(child, ctx, depth + 1);
    if (!inner) return null;
    box = unionBox(box, mapBox(inner, matrixOf(child, ctx) ?? IDENT));
  }
  return box;
}

async function drawElement(el: Element, ctx: Ctx, alpha: number): Promise<void> {
  switch (el.localName) {
    case 'g':
    case 'a':
      return drawChildren(el, ctx, alpha);
    case 'switch': {
      // The first child the painter can draw, as a viewer picks one branch.
      const pick = [...el.children].find(c => c.namespaceURI === SVG_NS && !SKIP.has(c.localName));
      if (pick) await visit(pick, ctx, alpha);
      return;
    }
    case 'svg':
      return drawNestedSvg(el, ctx, alpha);
    case 'use':
      return drawUse(el, ctx, alpha);
    case 'text':
      return drawText(el, ctx, alpha);
    case 'image':
      return drawImage(el, ctx, alpha);
    default: {
      const subs = SHAPES.has(el.localName) ? shapeSubpaths(el, ctx.vp) : null;
      if (subs) await drawShape(el, subs, ctx, alpha);
    }
  }
}

/** A nested viewport: its box, its own viewBox and a clip at its edge unless overflow is visible or auto. */
async function drawNestedSvg(el: Element, ctx: Ctx, alpha: number, size?: { w: number; h: number }): Promise<void> {
  const box: Box = {
    x: size ? 0 : len(el.getAttribute('x'), ctx.vp.w), y: size ? 0 : len(el.getAttribute('y'), ctx.vp.h),
    w: size?.w ?? len(el.getAttribute('width') ?? '100%', ctx.vp.w), h: size?.h ?? len(el.getAttribute('height') ?? '100%', ctx.vp.h),
  };
  if (!(box.w > 0) || !(box.h > 0)) return;
  const vb = viewBoxOf(el);
  const m = vb ? viewBoxMatrix(vb, box, el.getAttribute('preserveAspectRatio')) : translate(box.x, box.y);
  const { vp, ctm } = ctx;
  ctx.pdf.saveGraphicsState();
  try {
    if (clipsOverflow(el, ctx)) { ctx.pdf.rect(box.x, box.y, box.w, box.h, null); ctx.pdf.clip(); ctx.pdf.discardPath(); }
    setMatrix(ctx.pdf, m);
    ctx.ctm = mul(ctm, m);
    ctx.vp = vb ? { w: vb.w, h: vb.h } : { w: box.w, h: box.h };
    await drawChildren(el, ctx, alpha);
  } finally {
    ctx.pdf.restoreGraphicsState();
    ctx.vp = vp;
    ctx.ctm = ctm;
  }
}

/** A `<use>` instance: placed at its x and y, inheriting paint from the `<use>` itself. */
async function drawUse(el: Element, ctx: Ctx, alpha: number): Promise<void> {
  const href = (el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '').trim();
  const target = href.startsWith('#') ? findById(ctx.root, href.slice(1)) : null;
  if (!target || target === el || target.contains(el) || ctx.scope.uses.length >= 8) return;
  const at = translate(len(el.getAttribute('x'), ctx.vp.w), len(el.getAttribute('y'), ctx.vp.h));
  const ctm = ctx.ctm;
  ctx.pdf.saveGraphicsState();
  ctx.scope.uses.push({ use: el, root: target });
  try {
    setMatrix(ctx.pdf, at);
    ctx.ctm = mul(ctm, at);
    if (target.localName === 'symbol' || target.localName === 'svg') {
      const w = len(el.getAttribute('width') ?? target.getAttribute('width') ?? '100%', ctx.vp.w);
      const h = len(el.getAttribute('height') ?? target.getAttribute('height') ?? '100%', ctx.vp.h);
      await drawNestedSvg(target, ctx, alpha, { w, h });
    } else await visit(target, ctx, alpha);
  } finally {
    ctx.scope.uses.pop();
    ctx.pdf.restoreGraphicsState();
    ctx.ctm = ctm;
  }
}

/** One outline of a clipPath, in the clipped element's user space, with its clip-rule. */
interface ClipPart { subs: SubPath[]; m: Mat; evenodd: boolean }

/**
 * Clip to a clipPath for `ref`, in ref's user space. A `<use>` child brings its
 * referenced outline. One outline is a PDF clip by its own clip-rule. Several are a
 * union, which one PDF clip cannot hold when their windings cancel or a rule is
 * evenodd, so those are returned for the caller to paint ref through as a soft mask.
 * Returns false when the clip leaves nothing to draw.
 */
function applyClip(clipEl: Element, ref: Element, ctx: Ctx, depth = 0): boolean | ClipPart[] {
  let base = IDENT;
  if (clipEl.getAttribute('clipPathUnits') === 'objectBoundingBox') {
    const bb = boxOf(ref, ctx);
    if (!bb || !(bb.w > 0) || !(bb.h > 0)) return false;
    base = { a: bb.w, b: 0, c: 0, d: bb.h, e: bb.x, f: bb.y };
  }
  // The clipPath's own transform applies after the bounding-box mapping, the order
  // Chromium uses.
  const own = matrixOf(clipEl, ctx);
  if (own) base = mul(own, base);
  // A clipPath may itself be clipped; the two intersect.
  const outer = depth < 4 ? clipPathOf(clipEl, ctx) : null;
  if (outer && outer !== clipEl) {
    const clipped = applyClip(outer, ref, ctx, depth + 1);
    if (clipped === false) return false;
    if (Array.isArray(clipped)) clipToUnion(ctx, clipped);
  }
  const parts: ClipPart[] = [];
  for (const child of clipEl.children) {
    if (ctx.scope.raw(child, 'display') === 'none' || ctx.scope.raw(child, 'visibility') === 'hidden') continue;
    let target = child;
    let m = mul(base, matrixOf(child, ctx) ?? IDENT);
    if (child.localName === 'use') {
      const href = (child.getAttribute('href') ?? child.getAttribute('xlink:href') ?? '').trim();
      const found = href.startsWith('#') ? findById(ctx.root, href.slice(1)) : null;
      if (!found) continue;
      m = mul(m, mul(translate(len(child.getAttribute('x'), ctx.vp.w), len(child.getAttribute('y'), ctx.vp.h)), matrixOf(found, ctx) ?? IDENT));
      target = found;
    }
    const subs = SHAPES.has(target.localName) ? shapeSubpaths(target, ctx.vp) : null;
    if (!subs) { if (target.localName === 'text') note(ctx, 'text inside a clip path is not drawn as a clip'); continue; }
    const rule = target.hasAttribute('clip-rule') ? target.getAttribute('clip-rule') : ctx.scope.raw(child, 'clip-rule');
    parts.push({ subs, m, evenodd: rule === 'evenodd' });
  }
  if (!parts.length) return false;
  if (parts.length > 1) return parts;
  emitSubpaths(ctx.pdf, parts[0]!.subs, parts[0]!.m);
  ctx.pdf.clip(parts[0]!.evenodd ? 'evenodd' : undefined);
  ctx.pdf.discardPath();
  return true;
}

/**
 * Several outlines as one nonzero clip, for where a soft mask cannot go, such as the
 * clip of a clip path. Exact unless the outlines' windings cancel or one is evenodd.
 */
function clipToUnion(ctx: Ctx, parts: ClipPart[]): void {
  note(ctx, 'a clip path of several outlines inside another clip is drawn as their nonzero union');
  for (const p of parts) emitSubpaths(ctx.pdf, p.subs, p.m);
  ctx.pdf.clip();
  ctx.pdf.discardPath();
}

/** A soft mask that is white wherever any of the outlines covers, each by its own rule. */
function clipMask(parts: ClipPart[], ctx: Ctx): string {
  const { pdf } = ctx;
  let box: Box | null = null;
  pdf.beginGroup();
  pdf.setFillColor(255, 255, 255);
  for (const p of parts) {
    box = unionBox(box, subpathsBox(p.subs, p.m));
    emitSubpaths(pdf, p.subs, p.m);
    if (p.evenodd) pdf.fillEvenOdd(); else pdf.fill();
  }
  return pdf.endGroup(groupBounds(ctx, box), 'DeviceGray');
}

/** An element's object bounding box in its own user space: geometry only, strokes excluded. */
function boxOf(el: Element, ctx: Ctx, depth = 0): Box | null {
  if (depth > 16) return null;
  if (SHAPES.has(el.localName)) { const subs = shapeSubpaths(el, ctx.vp); return subs ? subpathsBox(subs) : null; }
  if (el.localName === 'image') return { x: len(el.getAttribute('x'), ctx.vp.w), y: len(el.getAttribute('y'), ctx.vp.h), w: len(el.getAttribute('width'), ctx.vp.w), h: len(el.getAttribute('height'), ctx.vp.h) };
  if (el.localName === 'text') { try { const b = (el as SVGGraphicsElement).getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; } catch { return null; } }
  if (el.localName === 'use') {
    const href = (el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '').trim();
    const target = href.startsWith('#') ? findById(ctx.root, href.slice(1)) : null;
    const inner = target ? boxOf(target, ctx, depth + 1) : null;
    if (!inner || !target) return null;
    const m = mul(translate(len(el.getAttribute('x'), ctx.vp.w), len(el.getAttribute('y'), ctx.vp.h)), matrixOf(target, ctx) ?? IDENT);
    return mapBox(inner, m);
  }
  let box: Box | null = null;
  for (const child of el.children) {
    if (child.namespaceURI !== SVG_NS || SKIP.has(child.localName)) continue;
    const inner = boxOf(child, ctx, depth + 1);
    if (inner) box = unionBox(box, mapBox(inner, matrixOf(child, ctx) ?? IDENT));
  }
  return box;
}

/** A shading key for this export, one per distinct gradient. */
function shadingKey(ctx: Ctx, type: 'axial' | 'radial', coords: number[], colors: { offset: number; color: number[] }[], space: 'DeviceRGB' | 'DeviceGray'): string {
  let keys = shadingKeys.get(ctx.pdf);
  if (!keys) { keys = new Map(); shadingKeys.set(ctx.pdf, keys); }
  const sig = JSON.stringify([space, type, coords, colors]);
  let key = keys.get(sig);
  if (!key) {
    key = `svgsh${++shadingSeq}`;
    keys.set(sig, key);
    ctx.pdf.addShadingPattern(key, new ctx.pdf.ShadingPattern(type, coords, colors, space));
  }
  return key;
}

function withAlpha(ctx: Ctx, alpha: number, draw: () => void): void {
  if (alpha >= 1) { draw(); return; }
  ctx.pdf.saveGraphicsState();
  try {
    ctx.pdf.setGState(new ctx.pdf.GState({ opacity: alpha, 'stroke-opacity': alpha }));
    draw();
  } finally { ctx.pdf.restoreGraphicsState(); }
}

type Solid = { rgb: [number, number, number]; alpha: number };

/**
 * The colour a paint draws in, or its gradient as a shading. A gradient in
 * objectBoundingBox units spans `subs`, or the box of `el` when there are no subpaths.
 */
function paintOf(paint: Paint, el: Element, subs: SubPath[] | null, ctx: Ctx): Solid | ShadingSpec | null {
  if (paint.kind === 'none') return null;
  if (paint.kind === 'color') return paint;
  return resolvedPaint(paint, resolveGradient(ctx.root, paint.id, subs ? subpathsBox(subs) : boxOf(el, ctx), ctx.vp, ctx.scope), ctx);
}

/** A resolved gradient reference as the colour or shading it draws in, or its fallback paint where the painter has no shading for the gradient. */
function resolvedPaint(paint: Paint & { kind: 'url' }, g: ReturnType<typeof resolveGradient>, ctx: Ctx): Solid | ShadingSpec | null {
  if (g.kind === 'none') return null;
  if (g.kind === 'color') return g;
  if (g.kind === 'unsupported') {
    note(ctx, `${g.reason} is drawn with its fallback paint`);
    return paint.fallback.kind === 'color' ? paint.fallback : null;
  }
  return g.spec;
}

/** A gradient's middle stop, for where a shading cannot go. */
function middleStop(spec: ShadingSpec, ctx: Ctx, what: string): Solid {
  note(ctx, `a gradient ${what} is drawn in one colour`);
  const mid = spec.colors[Math.floor(spec.colors.length / 2)]!;
  return { rgb: [mid.color[0]!, mid.color[1]!, mid.color[2]!], alpha: spec.alpha };
}

/** The writer's fill for a gradient: the shading, its matrix and any stop-opacity mask. */
function shadingFill(ctx: Ctx, spec: ShadingSpec): ShadingFill {
  const key = shadingKey(ctx, spec.type, spec.coords, spec.colors, 'DeviceRGB');
  const alphaKey = spec.alphas ? shadingKey(ctx, spec.type, spec.coords, spec.alphas, 'DeviceGray') : undefined;
  const m = spec.matrix;
  return { key, matrix: new ctx.pdf.Matrix(m.a, m.b, m.c, m.d, m.e, m.f), ...(alphaKey ? { alpha: alphaKey } : {}) };
}

/** Fill, stroke and markers in the element's paint-order; the default is that order. */
async function drawShape(el: Element, subs: SubPath[], ctx: Ctx, alpha: number): Promise<void> {
  const s = ctx.scope;
  const vis = s.get(el, 'visibility');
  if (vis === 'hidden' || vis === 'collapse') return;
  const passes = ['fill', 'stroke', 'markers'];
  const named = s.get(el, 'paint-order').split(/\s+/).filter(p => passes.includes(p));
  const order = [...named, ...passes.filter(p => !named.includes(p))];
  for (const pass of order) {
    if (pass === 'fill') fillShape(el, subs, ctx, alpha);
    else if (pass === 'stroke') strokeShape(el, subs, ctx, alpha);
    else if (MARKABLE.has(el.localName)) await drawMarkers(el, ctx, alpha);
  }
}

function fillShape(el: Element, subs: SubPath[], ctx: Ctx, alpha: number): void {
  if (el.localName === 'line') return;
  const s = ctx.scope;
  const paint = paintFor(el, 'fill', subs, ctx);
  if (!paint) return;
  const evenOdd = s.get(el, 'fill-rule') === 'evenodd';
  const base = clamp01(s.num(el, 'fill-opacity', 1)) * alpha;
  const { pdf } = ctx;
  withAlpha(ctx, base * paint.alpha, () => {
    const fill = 'rgb' in paint ? undefined : shadingFill(ctx, paint);
    if ('rgb' in paint) pdf.setFillColor(paint.rgb[0], paint.rgb[1], paint.rgb[2]);
    emitSubpaths(pdf, subs);
    if (evenOdd) pdf.fillEvenOdd(fill); else pdf.fill(fill);
  });
}

function strokeShape(el: Element, subs: SubPath[], ctx: Ctx, alpha: number): void {
  const s = ctx.scope;
  let paint = paintFor(el, 'stroke', subs, ctx);
  if (!paint) return;
  const width = effectiveStrokeWidth(el, ctx);
  if (!(width > 0)) return;
  const a = clamp01(s.num(el, 'stroke-opacity', 1)) * alpha * paint.alpha;
  if (a <= 0) return;
  const { pdf } = ctx;
  const miter = Math.max(1, s.num(el, 'stroke-miterlimit', 4));
  const strokeLine = (): void => {
    pdf.setLineWidth(width);
    pdf.setLineCap(s.get(el, 'stroke-linecap') || 'butt');
    pdf.setLineJoin(s.get(el, 'stroke-linejoin') || 'miter');
    pdf.setLineMiterLimit(miter);
    const dash = (s.get(el, 'stroke-dasharray') || 'none').split(/[\s,]+/).map(parseFloat).filter(v => !Number.isNaN(v));
    if (dash.length && dash.every(v => Number.isFinite(v) && v >= 0) && dash.some(v => v > 0)) {
      pdf.setLineDashPattern(dash.length % 2 ? [...dash, ...dash] : dash, s.num(el, 'stroke-dashoffset', 0));
    }
    emitSubpaths(pdf, subs);
    pdf.stroke();
  };
  if (!('rgb' in paint) && !ctx.groups) paint = middleStop(paint, ctx, 'stroke');
  if (!('rgb' in paint)) {
    const b = subpathsBox(subs);
    if (!b) return;
    // A PDF stroke cannot carry a shading, so the stroke is drawn in white into a soft
    // mask and the gradient fills the stroke's bounds through that mask.
    const reach = grow(b, (width / 2) * Math.max(miter, Math.SQRT2) + 1);
    pdf.beginGroup();
    pdf.setDrawColor(255, 255, 255);
    strokeLine();
    const mask = pdf.endGroup(groupBounds(ctx, reach), 'DeviceGray');
    pdf.beginGroup();
    pdf.rect(reach.x, reach.y, reach.w, reach.h, null);
    pdf.fill(shadingFill(ctx, paint));
    pdf.paintGroup(pdf.endGroup(groupBounds(ctx, reach)), a, mask);
    return;
  }
  const solid = paint;
  pdf.saveGraphicsState();
  try {
    if (a < 1) pdf.setGState(new pdf.GState({ opacity: a, 'stroke-opacity': a }));
    pdf.setDrawColor(solid.rgb[0], solid.rgb[1], solid.rgb[2]);
    strokeLine();
  } finally { pdf.restoreGraphicsState(); }
}

/**
 * A shape's markers: each vertex's marker laid out by export-pdf-svg-markers.ts and
 * its content drawn there. Marker content inherits from the `<marker>` element's own
 * ancestors, never from the shape, which is how StyleScope reads marker content.
 */
async function drawMarkers(el: Element, ctx: Ctx, alpha: number): Promise<void> {
  const s = ctx.scope;
  const find = (id: string): Element | null => findById(ctx.root, id);
  const markers = { start: markerRef(s.get(el, 'marker-start'), find), mid: markerRef(s.get(el, 'marker-mid'), find), end: markerRef(s.get(el, 'marker-end'), find) };
  if (!markers.start && !markers.mid && !markers.end) return;
  const vertices = markerVertices(el, ctx.vp) ?? [];
  // markerUnits strokeWidth scales by the width the stroke is drawn at, a non-scaling one included.
  const strokeWidth = effectiveStrokeWidth(el, ctx);
  for (const v of vertices) {
    const marker = markers[v.kind];
    if (!marker || ctx.markers.has(marker)) continue;
    const lay = markerLayout(marker, v, strokeWidth, ctx.vp, clipsOverflow(marker, ctx));
    if (!lay) continue;
    const { ctm, vp, context, contextCtm, contextVp } = ctx;
    ctx.markers.add(marker);
    ctx.context = el;
    ctx.contextCtm = ctm;
    ctx.contextVp = vp;
    ctx.pdf.saveGraphicsState();
    try {
      setMatrix(ctx.pdf, lay.matrix);
      if (lay.clip) { ctx.pdf.rect(lay.clip.x, lay.clip.y, lay.clip.w, lay.clip.h, null); ctx.pdf.clip(); ctx.pdf.discardPath(); }
      setMatrix(ctx.pdf, lay.viewBox);
      ctx.ctm = mul(ctm, lay.content);
      ctx.vp = lay.vp;
      await drawChildren(marker, ctx, alpha);
    } finally {
      ctx.pdf.restoreGraphicsState();
      ctx.markers.delete(marker);
      ctx.context = context;
      ctx.contextCtm = contextCtm;
      ctx.contextVp = contextVp;
      ctx.ctm = ctm;
      ctx.vp = vp;
    }
  }
}

/** The browser's measure for a CSS font, through one canvas the painter keeps. */
let measurer: CanvasRenderingContext2D | null | undefined;
function measureWith(font: string): CanvasRenderingContext2D | null {
  if (measurer === undefined) {
    try { measurer = document.createElement('canvas').getContext('2d'); } catch { measurer = null; }
  }
  if (measurer) measurer.font = font;
  return measurer ?? null;
}

/**
 * How far below a run's y its alphabetic baseline sits, for dominant-baseline. The
 * offsets are the ones Chromium uses, from the font's metrics. middle is half the
 * x-height. central is halfway between the ascent and the descent. hanging is the
 * font's hanging baseline. mathematical is half the ascent. text-before-edge is the
 * ascent. ideographic and text-after-edge sit the descent above the baseline.
 */
function baselineOffset(baseline: string, font: string): number {
  if (!baseline || baseline === 'auto' || baseline === 'alphabetic') return 0;
  const m = measureWith(font)?.measureText('x');
  if (!m) return 0;
  const ascent = m.fontBoundingBoxAscent, descent = m.fontBoundingBoxDescent;
  switch (baseline) {
    case 'middle': return m.actualBoundingBoxAscent / 2;
    case 'central': return (ascent - descent) / 2;
    case 'hanging': return (m as TextMetrics & { hangingBaseline?: number }).hangingBaseline ?? ascent * 0.8;
    case 'mathematical': return ascent / 2;
    case 'text-before-edge': return ascent;
    case 'ideographic':
    case 'text-after-edge': return -descent;
    default: return 0;
  }
}

/**
 * A `<text>`'s runs in order: its own text nodes and its `<tspan>` and `<a>` children.
 * White space is collapsed across the runs as the browser lays the text out: none at
 * the start or the end of the whole text, and one space for each stretch of spaces,
 * tabs and line breaks. A pre white-space keeps every space.
 */
function textRuns(el: Element, s: StyleScope): { el: Element; text: string }[] {
  const runs: { el: Element; text: string }[] = [];
  for (const node of el.childNodes) {
    if (node.nodeType === 3) runs.push({ el, text: node.textContent ?? '' });
    else if (node.nodeType === 1 && /^(tspan|a)$/.test((node as Element).localName)) runs.push({ el: node as Element, text: node.textContent ?? '' });
  }
  if (/^(pre|pre-wrap|break-spaces)$/.test(s.raw(el, 'white-space'))) return runs;
  let afterSpace = true;
  for (const run of runs) {
    let out = '';
    for (const ch of run.text.replace(/[\t\n\r]/g, ' ')) {
      if (ch === ' ' && afterSpace) continue;
      afterSpace = ch === ' ';
      out += ch;
    }
    run.text = out;
  }
  for (let i = runs.length - 1; i >= 0; i--) {
    if (!runs[i]!.text) continue;
    runs[i]!.text = runs[i]!.text.replace(/ $/, '');
    break;
  }
  return runs;
}

/** The box a path's points span, control points included, through `tx` and `ty`. */
function pathPointsBox(d: string, tx: (v: number) => number, ty: (v: number) => number): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number): void => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  drawSvgPathToPdf({
    moveTo: add, lineTo: add, close: () => {},
    curveTo: (a: number, b: number, c: number, e: number, f: number, g: number) => { add(a, b); add(c, e); add(f, g); },
  }, d, tx, ty);
  return x0 <= x1 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/**
 * `<text>`, one run per text node, `<tspan>` or `<a>`, in user units. Runs are
 * outlined through host.text when the export converts paths or the face cannot travel
 * as live text, and set as live text otherwise. A `<tspan>` can reset or offset the
 * pen. dominant-baseline moves each run's baseline as the browser does; a baseline
 * shift, a vertical writing mode and a per-glyph rotate make the SVG a picture instead
 * (scanSvg).
 */
async function drawText(el: Element, ctx: Ctx, alpha: number): Promise<void> {
  const { pdf, scope: s } = ctx;
  const convertPaths = ctx.opts.convertPaths !== false;
  /**
   * Draw one run and return how far it moves the pen: the browser's length for a
   * `<tspan>` (`browserLength`), else the width of what was drawn, spaces included.
   */
  const drawRun = async (styleEl: Element, t: string, x: number, y: number, anchor: string, browserLength: number | null): Promise<number> => {
    // Computed values, so a keyword weight reads as its number and a size in em as pixels.
    const size = parseFloat(s.get(styleEl, 'font-size')) || 16;
    const weight = parseInt(s.get(styleEl, 'font-weight'), 10) || 400;
    const fontStyle = s.get(styleEl, 'font-style');
    const italic = fontStyle === 'italic' || fontStyle.startsWith('oblique');
    const familyRaw = s.get(styleEl, 'font-family') || styleEl.getAttribute('font-family') || '';
    const cssFont = `${italic ? 'italic ' : ''}${weight} ${size}px ${familyRaw || 'sans-serif'}`;
    // White space between runs moves the pen by the browser's width of that space.
    if (!t.trim()) return browserLength ?? (t ? measureWith(cssFont)?.measureText(t).width ?? size / 4 : 0);
    const by = y + baselineOffset(s.raw(styleEl, 'dominant-baseline'), cssFont);
    // A gradient on a run spans the whole <text>, so its box is the <text>'s.
    const paint = paintFor(styleEl, 'fill', null, ctx, el);
    const a = paint ? clamp01(s.num(styleEl, 'fill-opacity', 1)) * alpha * paint.alpha : 0;
    const vf = _host?.text ? await resolveVectorFont({ fontFamily: familyRaw, fontWeight: String(weight), fontStyle: italic ? 'italic' : 'normal' }, t.trim()) : null;
    const embedUrl = convertPaths ? null : await pdfFontEmbed(vf);
    if ((convertPaths || (vf && !embedUrl)) && _host?.text && vf) {
      try {
        const shaped = await _host.text.toPath({ text: t, fontUrl: vf.url, fontSize: size, variations: vf.variations, fallbackFonts: vf.fallbacks });
        if (shaped?.d && !shaped.notdef) {
          const adv = shaped.advanceWidth || 0;
          const left = anchor === 'middle' ? x - adv / 2 : anchor === 'end' ? x - adv : x;
          const tx = (gx: number): number => left + gx, ty = (gy: number): number => by + gy;
          if (paint && a > 0) {
            withAlpha(ctx, a, () => {
              const fill = 'rgb' in paint ? undefined : shadingFill(ctx, paint);
              if ('rgb' in paint) pdf.setFillColor(paint.rgb[0], paint.rgb[1], paint.rgb[2]);
              drawSvgPathToPdf(pdf, shaped.d, tx, ty);
              pdf.fill(fill);
            });
            noteDrawn(ctx, pathPointsBox(shaped.d, tx, ty));
          }
          return adv;
        }
      } catch (e) {
        _host?.log?.('warn', `pdf: svg text outline failed for "${t.trim().slice(0, 24)}" - ${(e as Error).message}`);
      }
    }
    pdf.setFontSize(Math.max(0.01, size));
    let fontSet = false;
    const fonts = ctx.opts.registeredFonts;
    if (embedUrl && fonts) {
      const name = await embedResolvedFont(pdf, fonts, embedUrl);
      if (name) { pdf.setFont(name, 'normal'); fontSet = true; }
    }
    const family = familyRaw.toLowerCase();
    if (!fontSet && family.includes('suse') && fonts) {
      const mono = family.includes('mono');
      const suseStyle = await embedSuseFont(pdf, fonts, weight, italic, mono);
      if (suseStyle) { pdf.setFont(suseFontName(mono), suseStyle); fontSet = true; }
    }
    if (!fontSet) pdf.setFont('helvetica', weight >= 600 ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'));
    const width = pdf.getTextWidth(t);
    if (paint && a > 0) {
      // Live text keeps its font and takes a gradient through a shading pattern.
      const gradient = !('rgb' in paint) && typeof pdf.setTextFill === 'function' ? shadingFill(ctx, paint) : null;
      const color = 'rgb' in paint ? paint : gradient ? { rgb: [0, 0, 0] as [number, number, number], alpha: paint.alpha } : middleStop(paint, ctx, 'live text run');
      withAlpha(ctx, a, () => {
        pdf.setTextColor(color.rgb[0], color.rgb[1], color.rgb[2]);
        if (gradient) pdf.setTextFill(gradient);
        try { pdf.text(t, x, by, { align: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left' }); }
        finally { if (gradient) pdf.setTextFill(null); }
      });
      // The glyphs' extent, with room for accents, descenders and an italic overhang.
      const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
      noteDrawn(ctx, { x: left - size * 0.3, y: by - size * 1.3, w: width + size * 0.6, h: size * 1.9 });
    }
    return browserLength ?? width;
  };

  const vis = s.get(el, 'visibility');
  if (vis === 'hidden' || vis === 'collapse') return;
  const anchorOf = (node: Element, fallback: string): string => node.getAttribute('text-anchor') ?? (s.get(node, 'text-anchor') || fallback);
  // A list of positions places each character; only the first is used, for the run.
  let penX = firstLen(el.getAttribute('x'), ctx.vp.w), penY = firstLen(el.getAttribute('y'), ctx.vp.h);
  const runs = textRuns(el, s);
  if (runs.every(r => r.el === el)) {
    await drawRun(el, runs.map(r => r.text).join(''), penX, penY, anchorOf(el, 'start'), null);
    return;
  }
  for (const run of runs) {
    if (run.el === el) {
      // A bare text node advances by its own width, not the whole <text>'s.
      if (run.text) penX += await drawRun(el, run.text, penX, penY, 'start', null);
      continue;
    }
    const ts = run.el;
    const em = parseFloat(s.raw(ts, 'font-size')) || 16;
    const rel = (v: string | null): number => { if (!v) return 0; const t = v.trim().split(/[\s,]+/)[0]!; return t.endsWith('em') ? parseFloat(t) * em : (parseFloat(t) || 0); };
    if (ts.hasAttribute('x')) penX = firstLen(ts.getAttribute('x'), ctx.vp.w);
    if (ts.hasAttribute('y')) penY = firstLen(ts.getAttribute('y'), ctx.vp.h);
    penX += rel(ts.getAttribute('dx'));
    penY += rel(ts.getAttribute('dy'));
    let length: number | null = null;
    try { length = typeof (ts as SVGTextContentElement).getComputedTextLength === 'function' ? (ts as SVGTextContentElement).getComputedTextLength() || null : null; } catch { length = null; }
    penX += await drawRun(ts, run.text, penX, penY, anchorOf(ts, anchorOf(el, 'start')), length);
  }
}

/** `<image>`: an SVG source is painted as vectors into its box, anything else placed as a picture. */
async function drawImage(el: Element, ctx: Ctx, alpha: number): Promise<void> {
  const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
  if (!href) return;
  const box: Box = { x: len(el.getAttribute('x'), ctx.vp.w), y: len(el.getAttribute('y'), ctx.vp.h), w: len(el.getAttribute('width'), ctx.vp.w), h: len(el.getAttribute('height'), ctx.vp.h) };
  if (!(box.w > 0) || !(box.h > 0)) return;
  const { pdf } = ctx;
  const faded = alpha < 1 && ctx.groups;
  if (faded) pdf.beginGroup();
  try {
    let inner: Element | null = null;
    try {
      inner = await inlineSvgFromImg(href);
      if (inner) {
        // A referenced picture is never imprinted, so its own rasterising fallback stays unmarked.
        inner.setAttribute('style', `position:absolute;left:-99999px;top:0;width:${Math.max(1, Math.round(box.w))}px;height:${Math.max(1, Math.round(box.h))}px`);
        document.body.appendChild(inner);
        const ivb = viewBoxOf(inner) ?? { x: 0, y: 0, w: box.w, h: box.h };
        const fit = viewBoxMatrix(ivb, box, el.getAttribute('preserveAspectRatio'));
        const fitted = mapBox(ivb, fit);
        await paintSvgToPdf(pdf, inner, fitted, { ...ctx.opts, flipX: false, flipY: false, isolated: true }, ctx.ctm);
        return;
      }
    } catch { /* fall through to the picture */ }
    finally { inner?.remove(); }
    try {
      const dataUrl = href.startsWith('data:') ? href : await blobToDataUrl(href);
      const placed = await (ctx.opts.imageForPdf?.(dataUrl) ?? Promise.resolve({ src: dataUrl, fmt: 'PNG' }));
      withAlpha(ctx, faded ? 1 : alpha, () => { pdf.addImage(placed.src, placed.fmt, box.x, box.y, box.w, box.h); });
    } catch { /* skip an image that will not load */ }
  } finally {
    if (faded) pdf.paintGroup(pdf.endGroup(groupBounds(ctx, box)), alpha);
  }
}
