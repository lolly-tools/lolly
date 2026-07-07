// SPDX-License-Identifier: MPL-2.0
/**
 * EPS (Encapsulated PostScript) emitter — pure, DOM-free, platform-agnostic.
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
 * no Handlebars, no ajv — fully node:test-able.
 */
import { parseDimension, toPoints, CSS_DPI } from './units.ts';
import { rgbToCmyk } from './color.ts';
import type { Rgb, VectorIr, VectorPathPrim, VectorImagePrim, VectorEmitOpts } from './emf.ts';

/** EPS options: physical size + colour mode + optional DSC metadata. */
export interface EpsEmitOpts extends VectorEmitOpts {
  cmyk?: boolean;
  meta?: { title?: string };
}

// Compact number: 3 decimals, no negative zero (PostScript tokenises "-0" oddly).
const n = (v: number): string => {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

function colorOp(c: Rgb, cmyk: boolean): string {
  const r = (c.r & 0xff) / 255, g = (c.g & 0xff) / 255, b = (c.b & 0xff) / 255;
  if (cmyk) {
    const [cy, m, y, k] = rgbToCmyk(r, g, b);
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
// (no /SMask — alpha was composited over the background in the shell). Even for the
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

function emitPathPrim(prim: VectorPathPrim, cmyk: boolean, out: string[]): void {
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
    out.push('gsave', colorOp(fill, cmyk), fillVerb, 'grestore');
    out.push(colorOp(stroke, cmyk), lw, 'stroke');
  } else if (fill) {
    out.push(colorOp(fill, cmyk), fillVerb);
  } else if (stroke) {
    out.push(colorOp(stroke, cmyk), lw, 'stroke');
  }
}

/**
 * Serialize an IR to EPS text.
 * @param ir   { width, height, prims }
 * @param opts { width, height, unit, dpi, cmyk, meta } — physical size + colour mode
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

  const L: string[] = [];
  L.push('%!PS-Adobe-3.0 EPSF-3.0');
  L.push('%%Creator: Lolly');
  if (opts.meta && opts.meta.title) L.push('%%Title: ' + String(opts.meta.title).replace(/[\r\n]+/g, ' '));
  L.push('%%BoundingBox: 0 0 ' + Math.ceil(Wpt) + ' ' + Math.ceil(Hpt));
  L.push('%%HiResBoundingBox: 0 0 ' + n(Wpt) + ' ' + n(Hpt));
  L.push('%%LanguageLevel: 2');
  L.push('%%EndComments');
  L.push('%%BeginProlog');
  L.push('%%EndProlog');
  L.push('gsave');
  L.push('1 setlinejoin 1 setlinecap');
  L.push('0 ' + n(Hpt) + ' translate');
  L.push(n(sx) + ' ' + n(-sy) + ' scale');
  for (const prim of ir.prims || []) {
    if (prim && prim.type === 'path') emitPathPrim(prim, cmyk, L);
    else if (prim && prim.type === 'image') emitImagePrim(prim, L);
  }
  L.push('grestore');
  L.push('showpage');
  L.push('%%EOF');
  return L.join('\n') + '\n';
}
