// SPDX-License-Identifier: MPL-2.0
/**
 * An SVG painted into a PDF page as vectors. Every PDF export uses this for an inline
 * `<svg>`, an SVG in an `<img>`, an SVG-rooted page, a Design path box and the artwork
 * of an emoji placement.
 *
 * Each transform goes into the content stream as a matrix, so geometry is written in
 * user units and strokes scale with their shapes, as in SVG. The painter draws:
 *
 * - clip paths on any element, with `<use>` outlines, `clip-rule` and both
 *   `clipPathUnits`: one outline as a PDF clip, several as a soft mask of their union;
 * - paint carried on `<use>`, which the drawn instance inherits (StyleScope);
 * - the edge of every viewport, root and nested `<svg>`, unless its overflow is
 *   visible, as a clip;
 * - fill, stroke and element opacity as alpha in the graphics state, and the opacity
 *   of a group or of a shape with both fill and stroke as a transparency group, so
 *   overlapping parts are faded as one picture;
 * - linear and radial gradients as PDF shadings, with their units, transform, focal
 *   point and an href chain, and stop opacities as a soft mask. A gradient stroke is
 *   the shading seen through a soft mask of the stroke, and outlined text takes the
 *   shading as a shape does. Live text draws in the gradient's middle stop.
 *
 * What stays a picture: an SVG holding a filter, a mask, a pattern or text in a clip
 * path, or a gradient that spreads by reflect or repeat. The painter does not draw
 * those, so the whole SVG is rasterised at 150 dpi instead (svgRasterReason). Markers
 * and foreignObject content are not drawn.
 */
import { _host, blobToDataUrl } from './export-shared.ts';
import { drawSvgPathToPdf } from './export-pdf-vector.ts';
import { resolveVectorFont } from './font-registry.ts';
import { embedResolvedFont } from './export-font-data.ts';
import { embedSuseFont, pdfFontEmbed, suseFontName } from './export-pdf-fonts.ts';
import { inlineSvgFromImg } from './export-svg-walker.ts';
import type { PdfDoc, ShadingFill } from './export-pdf-doc.ts';
import {
  IDENT, emitSubpaths, invert, len, lengthScale, mapBox, mul, shapeSubpaths, subpathsBox,
  transformOf, translate, unionBox, viewBoxMatrix, viewBoxOf, type Box, type Mat, type SubPath, type Viewport,
} from './export-pdf-svg-geom.ts';
import { StyleScope, findById, parsePaint, resolveGradient, type Paint, type ShadingSpec } from './export-pdf-svg-style.ts';

export interface SvgPaintOptions {
  registeredFonts?: Set<unknown> | null;
  /** Outline text runs (the export's Convert paths setting). Default true. */
  convertPaths?: boolean;
  /** Mirror the picture horizontally inside its region. */
  flipX?: boolean;
  /** Draw the SVG as a picture instead: a PNG data URL at this pixel size. */
  rasterize?: (svgEl: Element, pxW: number, pxH: number) => Promise<string>;
  /** Make an image source placeable as PNG or JPEG. */
  imageForPdf?: (src: string) => Promise<{ src: string; fmt: string }>;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
/** Elements that draw nothing where they stand. */
const SKIP = new Set(['defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'symbol', 'pattern', 'filter',
  'title', 'desc', 'metadata', 'style', 'script', 'marker', 'view', 'foreignObject', 'animate', 'animateMotion', 'animateTransform', 'set']);

/**
 * Why this SVG has to be drawn as a picture, or null when the painter can draw every
 * part. The check is by presence, as the previous painter's was, so a definition
 * nothing uses still counts.
 */
export function svgRasterReason(svgEl: Element): string | null {
  const unsupported = svgEl.querySelector('filter, mask, pattern');
  if (unsupported) return `<${unsupported.localName}>`;
  for (const g of svgEl.querySelectorAll('linearGradient, radialGradient')) {
    const spread = g.getAttribute('spreadMethod');
    if (spread && spread !== 'pad') return `spreadMethod ${spread}`;
  }
  if (svgEl.querySelector('clipPath text')) return 'text in a clip path';
  return null;
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
  /** User space to page points, for transparency-group bounds and non-scaling strokes. */
  ctm: Mat;
  /** Page points per CSS pixel of the outermost SVG: the space a non-scaling stroke is measured in. */
  hostScale: number;
  groups: boolean;
  walked: number;
  depth: number;
}

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
  const reason = opts.rasterize ? svgRasterReason(svgEl) : null;
  if (reason) { await paintPicture(pdf, svgEl, region, opts, parentCtm, reason); return; }
  const scope = new StyleScope();
  const own = { w: (svgEl as SVGSVGElement).clientWidth || svgEl.getBoundingClientRect().width || region.w, h: (svgEl as SVGSVGElement).clientHeight || svgEl.getBoundingClientRect().height || region.h };
  const vb = viewBoxOf(svgEl) ?? { x: 0, y: 0, w: own.w, h: own.h };
  let m = viewBoxMatrix(vb, region, svgEl.getAttribute('preserveAspectRatio'));
  if (opts.flipX) m = mul({ a: -1, b: 0, c: 0, d: 1, e: 2 * region.x + region.w, f: 0 }, m);
  const ctx: Ctx = {
    pdf, root: svgEl, scope, opts, vp: { w: vb.w, h: vb.h }, ctm: mul(parentCtm, m),
    hostScale: lengthScale(parentCtm) * (region.w / own.w),
    groups: typeof pdf.beginGroup === 'function', walked: 0, depth: 0,
  };
  // The walker fades an <img>, or an <svg> of a few shapes, by setting an alpha around
  // the picture. PDF sets alpha rather than multiplying it, so the picture is drawn as
  // one group under that alpha: alphas inside start again from 1, and overlapping
  // parts fade together, as they do under CSS opacity.
  const outer = typeof pdf.currentAlpha === 'function' ? clamp01(pdf.currentAlpha()) : 1;
  const group = outer < 1 && ctx.groups;
  pdf.saveGraphicsState();
  try {
    if (scope.raw(svgEl, 'overflow') !== 'visible') { pdf.rect(region.x, region.y, region.w, region.h, null); pdf.clip(); pdf.discardPath(); }
    setMatrix(pdf, m);
    if (group) {
      pdf.beginGroup();
      try { await drawChildren(svgEl, ctx, 1); }
      finally { pdf.paintGroup(pdf.endGroup(groupBounds(ctx)), outer); }
    } else await drawChildren(svgEl, ctx, outer);
  } finally { pdf.restoreGraphicsState(); }
}

/** The SVG as a picture at 150 dpi; emoji artwork is captured once per glyph and size. */
async function paintPicture(pdf: PdfDoc, svgEl: Element, region: Box, opts: SvgPaintOptions, parentCtm: Mat, reason: string): Promise<void> {
  const dpr = (150 / 72) * lengthScale(parentCtm);
  const pxW = Math.max(2, Math.min(2000, Math.round(region.w * dpr)));
  const pxH = Math.max(2, Math.min(2000, Math.round(region.h * dpr)));
  const sum = svgEl.parentElement?.getAttribute('data-emoji-sum');
  let cache = glyphPictures.get(pdf);
  if (!cache) { cache = new Map(); glyphPictures.set(pdf, cache); }
  const key = sum ? `${sum}:${pxW}x${pxH}` : '';
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

/** A single paint: a shape that fills or strokes but not both, which an alpha can fade exactly. */
function singlePaint(el: Element, ctx: Ctx): boolean {
  const s = ctx.scope;
  const fills = parsePaint(s.get(el, 'fill')).kind !== 'none' && s.num(el, 'fill-opacity', 1) > 0;
  const strokes = parsePaint(s.get(el, 'stroke')).kind !== 'none' && s.num(el, 'stroke-width', 1) > 0 && s.num(el, 'stroke-opacity', 1) > 0;
  return !(fills && strokes);
}

/** Whether an element's opacity can fade its one painted descendant instead of a group. */
function foldable(el: Element, ctx: Ctx): boolean {
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

async function visit(el: Element, ctx: Ctx, fold: number): Promise<void> {
  if (el.namespaceURI !== SVG_NS || SKIP.has(el.localName)) return;
  if (++ctx.walked % 200 === 0) await new Promise<void>((r) => setTimeout(r));
  if (ctx.depth > 64 || ctx.scope.raw(el, 'display') === 'none') return;
  const opacity = clamp01(parseFloat(ctx.scope.raw(el, 'opacity')));
  if (opacity <= 0) return;
  const t = transformOf(el);
  const clip = clipPathOf(el, ctx);
  const group = opacity < 1 && ctx.groups && !foldable(el, ctx);
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
      // Composited as one picture, then faded by the opacity and shown through the
      // union of the clip's outlines.
      ctx.pdf.beginGroup();
      try { await drawElement(el, ctx, 1); }
      finally {
        const content = ctx.pdf.endGroup(groupBounds(ctx));
        ctx.pdf.paintGroup(content, fold * opacity, union ? clipMask(union, ctx) : undefined);
      }
    } else await drawElement(el, ctx, fold * opacity);
  } finally {
    if (wrap) ctx.pdf.restoreGraphicsState();
    ctx.ctm = saved;
    ctx.depth--;
  }
}

/**
 * A transparency group's bounds in the current user space: the page and a margin of
 * its own size all round, so content moved by an enclosing rotation stays inside.
 */
function groupBounds(ctx: Ctx): number[] {
  const page = ctx.pdf.pageSize();
  const inv = invert(ctx.ctm);
  if (!inv) return [-1e5, -1e5, 1e5, 1e5];
  const b = mapBox({ x: -page.w, y: -page.h, w: page.w * 3, h: page.h * 3 }, inv);
  return [b.x, b.y, b.x + b.w, b.y + b.h];
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
      if (subs) drawShape(el, subs, ctx, alpha);
    }
  }
}

/** A nested viewport: its box, its own viewBox, and a clip at its edge unless overflow is visible. */
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
    if (ctx.scope.raw(el, 'overflow') !== 'visible') { ctx.pdf.rect(box.x, box.y, box.w, box.h, null); ctx.pdf.clip(); ctx.pdf.discardPath(); }
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
  const own = transformOf(clipEl);
  if (own) base = mul(base, own);
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
    let m = mul(base, transformOf(child) ?? IDENT);
    if (child.localName === 'use') {
      const href = (child.getAttribute('href') ?? child.getAttribute('xlink:href') ?? '').trim();
      const found = href.startsWith('#') ? findById(ctx.root, href.slice(1)) : null;
      if (!found) continue;
      m = mul(m, mul(translate(len(child.getAttribute('x'), ctx.vp.w), len(child.getAttribute('y'), ctx.vp.h)), transformOf(found) ?? IDENT));
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
  pdf.beginGroup();
  pdf.setFillColor(255, 255, 255);
  for (const p of parts) {
    emitSubpaths(pdf, p.subs, p.m);
    if (p.evenodd) pdf.fillEvenOdd(); else pdf.fill();
  }
  return pdf.endGroup(groupBounds(ctx), 'DeviceGray');
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
    const m = mul(translate(len(el.getAttribute('x'), ctx.vp.w), len(el.getAttribute('y'), ctx.vp.h)), transformOf(target) ?? IDENT);
    return mapBox(inner, m);
  }
  let box: Box | null = null;
  for (const child of el.children) {
    if (child.namespaceURI !== SVG_NS || SKIP.has(child.localName)) continue;
    const inner = boxOf(child, ctx, depth + 1);
    if (inner) box = unionBox(box, mapBox(inner, transformOf(child) ?? IDENT));
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
  const g = resolveGradient(ctx.root, paint.id, subs ? subpathsBox(subs) : boxOf(el, ctx), ctx.vp, ctx.scope);
  if (g.kind === 'none') return null;
  if (g.kind === 'color') return g;
  if (g.kind === 'unsupported') {
    note(ctx, `${g.reason} is drawn with its fallback paint`);
    return paint.fallback.kind === 'color' ? paint.fallback : null;
  }
  return g.spec;
}

/** A gradient's middle stop, for where a shading cannot go: live text. */
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

function drawShape(el: Element, subs: SubPath[], ctx: Ctx, alpha: number): void {
  const s = ctx.scope;
  const vis = s.get(el, 'visibility');
  if (vis === 'hidden' || vis === 'collapse') return;
  const strokeFirst = /^\s*stroke\b/.test(s.get(el, 'paint-order'));
  for (const pass of strokeFirst ? ['stroke', 'fill'] : ['fill', 'stroke']) {
    if (pass === 'fill') fillShape(el, subs, ctx, alpha);
    else strokeShape(el, subs, ctx, alpha);
  }
}

function fillShape(el: Element, subs: SubPath[], ctx: Ctx, alpha: number): void {
  const s = ctx.scope;
  const paint = paintOf(parsePaint(s.get(el, 'fill')), el, subs, ctx);
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
  let paint = paintOf(parsePaint(s.get(el, 'stroke')), el, subs, ctx);
  if (!paint) return;
  let width = s.num(el, 'stroke-width', 1);
  if (!(width > 0)) return;
  // A non-scaling stroke is measured in the outermost SVG's own pixels.
  if (s.get(el, 'vector-effect') === 'non-scaling-stroke') width = (width * ctx.hostScale) / (lengthScale(ctx.ctm) || 1);
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
    pdf.beginGroup();
    pdf.setDrawColor(255, 255, 255);
    strokeLine();
    const mask = pdf.endGroup(groupBounds(ctx), 'DeviceGray');
    const pad = (width / 2) * miter + 1;
    pdf.beginGroup();
    pdf.rect(b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad, null);
    pdf.fill(shadingFill(ctx, paint));
    pdf.paintGroup(pdf.endGroup(groupBounds(ctx)), a, mask);
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
 * `<text>`, one run per text node or `<tspan>`, in user units. Runs are outlined
 * through host.text when the export converts paths or the face cannot travel as live
 * text, and set as live text otherwise. A `<tspan>` can reset or offset the pen.
 */
async function drawText(el: Element, ctx: Ctx, alpha: number): Promise<void> {
  const { pdf, scope: s } = ctx;
  const convertPaths = ctx.opts.convertPaths !== false;
  const drawRun = async (styleEl: Element, runText: string, x: number, y: number, anchor: string): Promise<number> => {
    const t = (runText ?? '').trim();
    if (!t) return 0;
    // A gradient on a run spans the whole <text>, so its box is the <text>'s.
    const paint = paintOf(parsePaint(s.get(styleEl, 'fill')), el, null, ctx);
    const a = paint ? clamp01(s.num(styleEl, 'fill-opacity', 1)) * alpha * paint.alpha : 0;
    const size = parseFloat(styleEl.getAttribute('font-size') ?? s.raw(styleEl, 'font-size')) || 16;
    const weight = parseInt(styleEl.getAttribute('font-weight') ?? s.raw(styleEl, 'font-weight'), 10) || 400;
    const fontStyle = styleEl.getAttribute('font-style') ?? s.raw(styleEl, 'font-style');
    const italic = fontStyle === 'italic' || fontStyle === 'oblique';
    const familyRaw = s.raw(styleEl, 'font-family') || styleEl.getAttribute('font-family') || '';
    const vf = _host?.text ? await resolveVectorFont({ fontFamily: familyRaw, fontWeight: String(weight), fontStyle: italic ? 'italic' : 'normal' }, t) : null;
    const embedUrl = convertPaths ? null : await pdfFontEmbed(vf);
    if ((convertPaths || (vf && !embedUrl)) && _host?.text && vf) {
      try {
        const shaped = await _host.text.toPath({ text: t, fontUrl: vf.url, fontSize: size, variations: vf.variations, fallbackFonts: vf.fallbacks });
        if (shaped?.d && !shaped.notdef) {
          const adv = shaped.advanceWidth || 0;
          const left = anchor === 'middle' ? x - adv / 2 : anchor === 'end' ? x - adv : x;
          if (paint && a > 0) {
            withAlpha(ctx, a, () => {
              const fill = 'rgb' in paint ? undefined : shadingFill(ctx, paint);
              if ('rgb' in paint) pdf.setFillColor(paint.rgb[0], paint.rgb[1], paint.rgb[2]);
              drawSvgPathToPdf(pdf, shaped.d, (gx: number) => left + gx, (gy: number) => y + gy);
              pdf.fill(fill);
            });
          }
          return adv;
        }
      } catch (e) {
        _host?.log?.('warn', `pdf: svg text outline failed for "${t.slice(0, 24)}" - ${(e as Error).message}`);
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
    const color = paint && ('rgb' in paint ? paint : middleStop(paint, ctx, 'live text run'));
    if (color && a > 0) {
      withAlpha(ctx, a, () => {
        pdf.setTextColor(color.rgb[0], color.rgb[1], color.rgb[2]);
        pdf.text(t, x, y, { align: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left' });
      });
    }
    let w = 0;
    try { w = typeof (styleEl as SVGTextContentElement).getComputedTextLength === 'function' ? (styleEl as SVGTextContentElement).getComputedTextLength() : 0; } catch { w = 0; }
    return w || pdf.getTextWidth(t);
  };

  const vis = s.get(el, 'visibility');
  if (vis === 'hidden' || vis === 'collapse') return;
  const anchorOf = (node: Element, fallback: string): string => node.getAttribute('text-anchor') ?? (s.get(node, 'text-anchor') || fallback);
  let penX = len(el.getAttribute('x'), ctx.vp.w), penY = len(el.getAttribute('y'), ctx.vp.h);
  const nodes = [...el.childNodes];
  if (!nodes.some(n => n.nodeType === 1 && (n as Element).localName === 'tspan')) {
    await drawRun(el, el.textContent ?? '', penX, penY, anchorOf(el, 'start'));
    return;
  }
  for (const node of nodes) {
    if (node.nodeType === 3) {
      if ((node.textContent ?? '').trim()) penX += await drawRun(el, node.textContent ?? '', penX, penY, 'start');
    } else if (node.nodeType === 1 && (node as Element).localName === 'tspan') {
      const ts = node as Element;
      const em = parseFloat(s.raw(ts, 'font-size')) || 16;
      const rel = (v: string | null): number => { if (!v) return 0; const t = v.trim(); return t.endsWith('em') ? parseFloat(t) * em : (parseFloat(t) || 0); };
      if (ts.hasAttribute('x')) penX = len(ts.getAttribute('x'), ctx.vp.w);
      if (ts.hasAttribute('y')) penY = len(ts.getAttribute('y'), ctx.vp.h);
      penX += rel(ts.getAttribute('dx'));
      penY += rel(ts.getAttribute('dy'));
      penX += await drawRun(ts, ts.textContent ?? '', penX, penY, anchorOf(ts, anchorOf(el, 'start')));
    }
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
        await paintSvgToPdf(pdf, inner, fitted, { ...ctx.opts, flipX: false }, ctx.ctm);
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
    if (faded) pdf.paintGroup(pdf.endGroup(groupBounds(ctx)), alpha);
  }
}
