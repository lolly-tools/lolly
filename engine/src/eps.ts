// SPDX-License-Identifier: MPL-2.0
/**
 * EPS (Encapsulated PostScript) emitter - pure, DOM-free, platform-agnostic.
 *
 * Third sink on the SVG vector pipeline (alongside SVG and EMF): turns the same
 * normalized device-px IR that emf.js serializes into an EPSF-3.0 document whose
 * only drawing primitive is the path (filled / stroked). Text is outlined to
 * paths upstream (the "always text-as-paths" rule), so this writes no fonts.
 *
 * PostScript's coordinate space is bottom-left origin, y-up, in points (1/72in),
 * so the IR's top-left / y-down / device-px space is flipped and scaled to the
 * physical output size by a single CTM set once at the top.
 *
 * Like color.js / units.js this is a format authority: it imports only those two
 * (toPoints for the bounding box, rgbToCmyk for the DeviceCMYK variant). No DOM,
 * no Handlebars, no ajv - fully node:test-able.
 */
import { parseDimension, toPoints, CSS_DPI } from './units.ts';
import { rgbToCmyk } from './color.ts';
import type { Rgb, VectorIr, VectorPathPrim, VectorImagePrim, VectorEmitOpts } from './emf.ts';
import type { PrintGeometry } from './print-marks.ts';

/** A brand ink lookup keyed by a quantised RGB triple (see rgbPaletteKey). CMYK
 *  values are 0–1 fractions, matching rgbToCmyk's output. Mirrors
 *  buildCmykPaletteMap in shells/web/src/bridge/export.ts so a caller can build
 *  one map and reuse it across both the PDF and EPS CMYK export paths. */
export type EpsCmykPalette = Map<string, { cmyk: [number, number, number, number] }>;

/** EPS options: physical size + colour mode + optional DSC metadata. */
export interface EpsEmitOpts extends VectorEmitOpts {
  cmyk?: boolean;
  meta?: { title?: string };
  cmykPalette?: EpsCmykPalette;
  /** Print geometry (bleed + marks + colour bar). When present, the media box is the
   *  page box, the artwork is placed into the bleed box, and the marks are drawn. */
  geometry?: PrintGeometry;
  /** Which space the marks paint in: 'cmyk' (registration on every plate) for
   *  eps-cmyk, 'rgb' (process black) for plain eps. Defaults from `cmyk`. */
  markSpace?: 'rgb' | 'cmyk';
}

// Compact number: 3 decimals, no negative zero (PostScript tokenises "-0" oddly).
const n = (v: number): string => {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

// Quantises an 0–1 RGB triple to the 2-decimal precision brand CMYK matches are
// keyed on (mirrors cmykKey in shells/web/src/bridge/export.ts).
function rgbPaletteKey(r: number, g: number, b: number): string {
  return Math.round(r * 100) + ',' + Math.round(g * 100) + ',' + Math.round(b * 100);
}

function colorOp(c: Rgb, cmyk: boolean, palette?: EpsCmykPalette): string {
  const r = (c.r & 0xff) / 255, g = (c.g & 0xff) / 255, b = (c.b & 0xff) / 255;
  if (cmyk) {
    const hit = palette?.get(rgbPaletteKey(r, g, b));
    const [cy, m, y, k] = hit ? hit.cmyk : rgbToCmyk(r, g, b);
    return n(cy) + ' ' + n(m) + ' ' + n(y) + ' ' + n(k) + ' setcmykcolor';
  }
  return n(r) + ' ' + n(g) + ' ' + n(b) + ' setrgbcolor';
}

const HEX: string[] = [];
for (let i = 0; i < 256; i++) HEX.push((i < 16 ? '0' : '') + i.toString(16));

// The raster escape-hatch: a Level-2 DeviceRGB `image`. The outer CTM (0 Hpt
// translate; sx -sy scale) already maps device y-down onto the y-up page, so within
// it we translate to the dest top-left, scale to the dest size, and ImageMatrix
// [pxW 0 0 pxH 0 0] lands image row 0 at the top of the dest rect. Opaque RGB only
// (no /SMask - alpha was composited over the background in the shell). Even for the
// CMYK variant the image stays DeviceRGB pixels (like every raster in the pipeline).
function emitImagePrim(prim: VectorImagePrim, out: string[]): void {
  const pxW = Math.max(1, Math.round(prim.pxW));
  const pxH = Math.max(1, Math.round(prim.pxH));
  const need = pxW * pxH * 3;
  const rgb = prim.rgb;
  out.push('gsave');
  out.push(n(prim.x) + ' ' + n(prim.y) + ' translate');
  out.push(n(prim.w) + ' ' + n(prim.h) + ' scale');
  out.push('/DeviceRGB setcolorspace');
  out.push('<< /ImageType 1 /Width ' + pxW + ' /Height ' + pxH + ' /BitsPerComponent 8 /Decode [0 1 0 1 0 1] /ImageMatrix [' + pxW + ' 0 0 ' + pxH + ' 0 0] /DataSource currentfile /ASCIIHexDecode filter >> image');
  let line = '';
  for (let i = 0; i < need; i++) {
    line += HEX[i < rgb.length ? rgb[i]! : 0];
    if (line.length >= 64) { out.push(line); line = ''; }
  }
  if (line) out.push(line);
  out.push('>');            // ASCIIHexDecode EOD
  out.push('grestore');
}

function emitPathPrim(prim: VectorPathPrim, cmyk: boolean, out: string[], palette?: EpsCmykPalette): void {
  const { subpaths, fill, stroke, fillRule } = prim;
  if (!subpaths || !subpaths.length) return;
  out.push('newpath');
  for (const sub of subpaths) {
    const segs = sub.segments;
    if (!segs || !segs.length || segs[0]?.op !== 'M') continue;
    for (const s of segs) {
      if (s.op === 'M') out.push(n(s.x) + ' ' + n(s.y) + ' moveto');
      else if (s.op === 'L') out.push(n(s.x) + ' ' + n(s.y) + ' lineto');
      else if (s.op === 'C') out.push(n(s.x1) + ' ' + n(s.y1) + ' ' + n(s.x2) + ' ' + n(s.y2) + ' ' + n(s.x) + ' ' + n(s.y) + ' curveto');
    }
    if (sub.closed) out.push('closepath');
  }
  const fillVerb = fillRule === 'evenodd' ? 'eofill' : 'fill';
  const lw = n(Math.max(0, stroke ? stroke.width : 0)) + ' setlinewidth';
  if (fill && stroke) {
    out.push('gsave', colorOp(fill, cmyk, palette), fillVerb, 'grestore');
    out.push(colorOp(stroke, cmyk, palette), lw, 'stroke');
  } else if (fill) {
    out.push(colorOp(fill, cmyk, palette), fillVerb);
  } else if (stroke) {
    out.push(colorOp(stroke, cmyk, palette), lw, 'stroke');
  }
}

/**
 * Serialize an IR to EPS text.
 * @param ir   { width, height, prims }
 * @param opts { width, height, unit, dpi, cmyk, meta } - physical size + colour mode
 */
export function emitEps(ir: VectorIr, opts: EpsEmitOpts = {}): string {
  const Wpx = Math.max(1, Math.round(ir.width));
  const Hpx = Math.max(1, Math.round(ir.height));
  const wDim = parseDimension(opts.width, opts.unit || 'px');
  const hDim = parseDimension(opts.height, opts.unit || 'px');
  const Wpt = wDim ? toPoints(wDim) : Wpx * 72 / CSS_DPI;
  const Hpt = hDim ? toPoints(hDim) : Hpx * 72 / CSS_DPI;
  const sx = Wpt / Wpx, sy = Hpt / Hpx;
  const cmyk = Boolean(opts.cmyk);
  const geo = opts.geometry;

  const L: string[] = [];
  L.push('%!PS-Adobe-3.0 EPSF-3.0');
  if (opts.attribution !== false) L.push('%%Creator: Lolly lolly.tools'); // gated: a metadata-stripped export omits it
  if (opts.meta && opts.meta.title) L.push('%%Title: ' + String(opts.meta.title).replace(/[\r\n]+/g, ' '));
  // The media box is the whole page (trim + bleed + mark reach) when there is print
  // geometry, else the artwork's own physical size.
  const bbW = geo ? geo.page.w : Wpt;
  const bbH = geo ? geo.page.h : Hpt;
  L.push('%%BoundingBox: 0 0 ' + Math.ceil(bbW) + ' ' + Math.ceil(bbH));
  L.push('%%HiResBoundingBox: 0 0 ' + n(bbW) + ' ' + n(bbH));
  L.push('%%LanguageLevel: 2');
  L.push('%%EndComments');
  L.push('%%BeginProlog');
  L.push('%%EndProlog');
  L.push('gsave');
  L.push('1 setlinejoin 1 setlinecap');
  if (geo) {
    // Page-level CTM: flip to top-left y-down POINTS once (the geometry is already in
    // points). The artwork is then placed into the bleed box and scaled to cover it,
    // reproducing the single-page PDF's scale-to-bleed; the marks emit verbatim in
    // top-left points afterwards.
    L.push('0 ' + n(geo.page.h) + ' translate');
    L.push('1 -1 scale');
    L.push('gsave');
    L.push(n(geo.artwork.x) + ' ' + n(geo.artwork.y) + ' translate');
    L.push(n(geo.artwork.w / Wpx) + ' ' + n(geo.artwork.h / Hpx) + ' scale');
    for (const prim of ir.prims || []) {
      if (prim && prim.type === 'path') emitPathPrim(prim, cmyk, L, opts.cmykPalette);
      else if (prim && prim.type === 'image') emitImagePrim(prim, L);
    }
    L.push('grestore');
    emitMarksPs(geo, opts.markSpace ?? (cmyk ? 'cmyk' : 'rgb'), L);
  } else {
    L.push('0 ' + n(Hpt) + ' translate');
    L.push(n(sx) + ' ' + n(-sy) + ' scale');
    for (const prim of ir.prims || []) {
      if (prim && prim.type === 'path') emitPathPrim(prim, cmyk, L, opts.cmykPalette);
      else if (prim && prim.type === 'image') emitImagePrim(prim, L);
    }
  }
  L.push('grestore');
  L.push('showpage');
  L.push('%%EOF');
  return L.join('\n') + '\n';
}

// Print marks (crop/bleed/registration lines, registration rings, colour-bar cells)
// in top-left-origin POINTS - the page CTM has already flipped y, so these emit
// verbatim. Provenance labels are DROPPED: the EPS emitter ships no fonts (upstream
// text is outlined; the mark band has none to outline).
function emitMarksPs(geo: PrintGeometry, markSpace: 'rgb' | 'cmyk', L: string[]): void {
  const markColor = markSpace === 'cmyk' ? '1 1 1 1 setcmykcolor' : '0 0 0 setrgbcolor';
  L.push(markColor);
  L.push(n(geo.strokeWeight) + ' setlinewidth');
  for (const ln of geo.primitives.lines) {
    L.push(n(ln.x1) + ' ' + n(ln.y1) + ' moveto ' + n(ln.x2) + ' ' + n(ln.y2) + ' lineto stroke');
  }
  for (const c of geo.primitives.circles) {
    L.push('newpath ' + n(c.cx) + ' ' + n(c.cy) + ' ' + n(c.r) + ' 0 360 arc stroke');
  }
  for (const b of geo.primitives.bars) {
    // Brand pairs force ink 'rgb'/'cmyk'; a generic 'page' cell follows the space.
    const ink = (b.ink === 'page' || !b.ink) ? markSpace : b.ink;
    if (ink === 'cmyk') {
      const [cy, m, y, k] = b.cmyk;
      L.push(n(cy) + ' ' + n(m) + ' ' + n(y) + ' ' + n(k) + ' setcmykcolor');
    } else {
      const [r, g, bl] = b.rgb;
      L.push(n(r) + ' ' + n(g) + ' ' + n(bl) + ' setrgbcolor');
    }
    const r = Math.min(b.r ?? 0, b.w / 2, b.h / 2);
    if (r > 0) {
      // Rounded cell. Each `arcto` leaves 4 numbers on the stack - pop all four, or
      // the file is rejected. Square `rectfill` is the default and avoids the stack.
      const x = b.x, y = b.y, w = b.w, h = b.h;
      L.push('newpath ' + n(x + r) + ' ' + n(y) + ' moveto');
      L.push(n(x + w) + ' ' + n(y) + ' ' + n(x + w) + ' ' + n(y + h) + ' ' + n(r) + ' arcto pop pop pop pop');
      L.push(n(x + w) + ' ' + n(y + h) + ' ' + n(x) + ' ' + n(y + h) + ' ' + n(r) + ' arcto pop pop pop pop');
      L.push(n(x) + ' ' + n(y + h) + ' ' + n(x) + ' ' + n(y) + ' ' + n(r) + ' arcto pop pop pop pop');
      L.push(n(x) + ' ' + n(y) + ' ' + n(x + w) + ' ' + n(y) + ' ' + n(r) + ' arcto pop pop pop pop');
      L.push('closepath fill');
    } else {
      L.push(n(b.x) + ' ' + n(b.y) + ' ' + n(b.w) + ' ' + n(b.h) + ' rectfill');
    }
  }
}
