// SPDX-License-Identifier: MPL-2.0
/**
 * Drawing operations written as PDF (plan 295, phase 3, P3d).
 *
 * The PDF twin of `design-draw-svg.ts`: the same operations, painted with the same
 * model (an outer group for the clip, opacity and blend, an inner one for the pose;
 * fills, then the picture, then the words; the frame first and its clip around the
 * rows), written as a complete PDF 1.7 file with no fonts, because the words arrive as
 * outlines. Gradients are axial and radial shadings, with a luminosity soft mask when
 * a stop is translucent; opacity and blend paint the operation as a transparency group;
 * pictures embed as JPEG (DCT, as delivered) or PNG (its own compressed rows, or
 * decoded when it carries transparency). What PDF cannot carry without rasterising
 * (shadows, blur, live text, other picture formats) is a finding from
 * `designDrawPdfFindings`, so a caller hands such a page to another renderer.
 *
 * Deterministic: the same pages give the same bytes. No dates, no identifiers; the
 * shells' finishing pass adds those.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */
import { unzlibSync, zlibSync } from 'fflate';

import { pictureRect, type DesignDrawPage, type DrawArea, type DrawBox, type DrawFinding, type DrawOp, type DrawPaint, type DrawPicture, type DrawShape, type DrawShapeOp, type DrawStop, type DrawStroke } from './design-draw.ts';
import type { Contour } from './geom/path.ts';
import { unfilterPng } from './png-unfilter.ts';
import { parseSvgPath } from './svg-path.ts';

/** One page to write: its operations, the bytes of the pictures they use, and where they land in points. */
export interface DesignPdfPage {
  page: DesignDrawPage;
  pictures: ReadonlyMap<string, { bytes: Uint8Array; mime: string }>;
  /** The page's own size, in points. */
  size: { w: number; h: number };
  /** The artwork's box on the page, in points; the whole page when absent. */
  artwork?: DrawBox;
}

/** The document information dictionary. */
export interface DesignPdfInfo { title?: string; author?: string; subject?: string; keywords?: string; creator?: string }

const enc = new TextEncoder();

/** A number as PDF writes it: at most four decimals, never an exponent, never `-0`. */
function n(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
}

/** A text string: literal when plain ASCII, otherwise UTF-16BE with its byte order mark. */
function pdfText(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

function rgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})/i.exec(hex) ?? /^#([0-9a-f]{3})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const h = m[1]!.length === 3 ? m[1]!.split('').map((c) => c + c).join('') : m[1]!;
  return [0, 2, 4].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) * 1000) / 1000) as [number, number, number];
}
const color = (hex: string, op: 'rg' | 'RG'): string => `${rgb(hex).map(n).join(' ')} ${op}`;

/** The objects of one document, numbered as they are reserved. */
class PdfObjects {
  private bodies: Array<Uint8Array | null> = [null];
  reserve(): number { this.bodies.push(null); return this.bodies.length - 1; }
  put(num: number, body: string): void { this.bodies[num] = enc.encode(`${num} 0 obj\n${body}\nendobj\n`); }
  stream(num: number, dict: string, data: Uint8Array, filter?: string): void {
    const head = enc.encode(`${num} 0 obj\n<< ${dict}${filter ? ` /Filter ${filter}` : ''} /Length ${data.length} >>\nstream\n`);
    const tail = enc.encode('\nendstream\nendobj\n');
    const out = new Uint8Array(head.length + data.length + tail.length);
    out.set(head); out.set(data, head.length); out.set(tail, head.length + data.length);
    this.bodies[num] = out;
  }
  /** Content compressed with Flate. */
  flate(num: number, dict: string, text: string): void { this.stream(num, dict, zlibSync(enc.encode(text)), '/FlateDecode'); }
  bytes(root: number, info: number | null): Uint8Array {
    const header = enc.encode('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n');
    const parts: Uint8Array[] = [header];
    const offsets: number[] = [];
    let at = header.length;
    for (let i = 1; i < this.bodies.length; i++) {
      const body = this.bodies[i] ?? enc.encode(`${i} 0 obj\nnull\nendobj\n`);
      offsets.push(at);
      parts.push(body);
      at += body.length;
    }
    let xref = `xref\n0 ${this.bodies.length}\n0000000000 65535 f \n`;
    for (const o of offsets) xref += `${String(o).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${this.bodies.length} /Root ${root} 0 R${info ? ` /Info ${info} 0 R` : ''} >>\nstartxref\n${at}\n%%EOF\n`;
    parts.push(enc.encode(xref));
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
}

/** A page's named resources, each written once. */
class Resources {
  readonly gs = new Map<string, string>();
  readonly xobject = new Map<string, number>();
  readonly shading = new Map<string, number>();
  private keys = new Map<string, string>();
  name(kind: 'gs' | 'xobject' | 'shading', key: string, make: () => string | number): string {
    const k = `${kind}\u0000${key}`;
    const known = this.keys.get(k);
    if (known) return known;
    const prefix = kind === 'gs' ? 'G' : kind === 'xobject' ? 'X' : 'S';
    const table = kind === 'gs' ? this.gs : kind === 'xobject' ? this.xobject : this.shading;
    const name = `${prefix}${table.size}`;
    (table as Map<string, string | number>).set(name, make());
    this.keys.set(k, name);
    return name;
  }
  dict(): string {
    const part = (label: string, table: Map<string, string | number>) => (table.size
      ? ` /${label} << ${[...table].map(([k, v]) => `/${k} ${typeof v === 'number' ? `${v} 0 R` : v}`).join(' ')} >>` : '');
    return `<<${part('ExtGState', this.gs)}${part('XObject', this.xobject)}${part('Shading', this.shading)} >>`;
  }
}

const KAPPA = 0.5522847498;

function rectPath(b: DrawBox, radius: number): string {
  const r = Math.max(0, Math.min(radius, b.w / 2, b.h / 2));
  if (r === 0) return `${n(b.x)} ${n(b.y)} ${n(b.w)} ${n(b.h)} re\n`;
  const k = r * KAPPA, x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
  return `${n(x0 + r)} ${n(y0)} m ${n(x1 - r)} ${n(y0)} l ${n(x1 - r + k)} ${n(y0)} ${n(x1)} ${n(y0 + r - k)} ${n(x1)} ${n(y0 + r)} c `
    + `${n(x1)} ${n(y1 - r)} l ${n(x1)} ${n(y1 - r + k)} ${n(x1 - r + k)} ${n(y1)} ${n(x1 - r)} ${n(y1)} c `
    + `${n(x0 + r)} ${n(y1)} l ${n(x0 + r - k)} ${n(y1)} ${n(x0)} ${n(y1 - r + k)} ${n(x0)} ${n(y1 - r)} c `
    + `${n(x0)} ${n(y0 + r)} l ${n(x0)} ${n(y0 + r - k)} ${n(x0 + r - k)} ${n(y0)} ${n(x0 + r)} ${n(y0)} c h\n`;
}

function ellipsePath(b: DrawBox): string {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2, kx = rx * KAPPA, ky = ry * KAPPA;
  return `${n(cx + rx)} ${n(cy)} m ${n(cx + rx)} ${n(cy + ky)} ${n(cx + kx)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)} c `
    + `${n(cx - kx)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + ky)} ${n(cx - rx)} ${n(cy)} c `
    + `${n(cx - rx)} ${n(cy - ky)} ${n(cx - kx)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)} c `
    + `${n(cx + kx)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - ky)} ${n(cx + rx)} ${n(cy)} c h\n`;
}

function outlinePath(shape: Exclude<DrawShape, { kind: 'path' }>, b: DrawBox): string {
  return shape.kind === 'ellipse' ? ellipsePath(b) : rectPath(b, shape.radius);
}

function contoursPath(contours: readonly Contour[]): string {
  let out = '';
  for (const c of contours) {
    const first = c.curves[0];
    if (!first) continue;
    out += `${n(first[0])} ${n(first[1])} m`;
    for (const k of c.curves) out += ` ${n(k[2])} ${n(k[3])} ${n(k[4])} ${n(k[5])} ${n(k[6])} ${n(k[7])} c`;
    out += c.closed ? ' h\n' : '\n';
  }
  return out;
}

function svgPath(d: string): string {
  let out = '';
  for (const sub of parseSvgPath(d)) {
    for (const s of sub.segments) {
      if (s.op === 'M') out += `${n(s.x)} ${n(s.y)} m `;
      else if (s.op === 'L') out += `${n(s.x)} ${n(s.y)} l `;
      else out += `${n(s.x1)} ${n(s.y1)} ${n(s.x2)} ${n(s.y2)} ${n(s.x)} ${n(s.y)} c `;
    }
    if (sub.closed) out += 'h ';
  }
  return `${out}\n`;
}

const CAPS: Record<string, number> = { butt: 0, round: 1, square: 2 };
const JOINS: Record<string, number> = { miter: 0, round: 1, bevel: 2 };
const BLEND: Record<string, string> = {
  multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken', lighten: 'Lighten', 'color-dodge': 'ColorDodge',
  'color-burn': 'ColorBurn', 'hard-light': 'HardLight', 'soft-light': 'SoftLight', difference: 'Difference', exclusion: 'Exclusion',
  hue: 'Hue', saturation: 'Saturation', color: 'Color', luminosity: 'Luminosity',
};

/** The features of a compiled page that PDF cannot carry without rasterising; none means the page writes as vectors. */
export function designDrawPdfFindings(page: DesignDrawPage, pictures: ReadonlyMap<string, { bytes: Uint8Array; mime: string }>): DrawFinding[] {
  const out: DrawFinding[] = [];
  for (const op of [...(page.frame ? [page.frame] : []), ...page.ops]) {
    if (op.shadow) out.push({ id: op.id, feature: 'pdf-shadow' });
    if (op.blur) out.push({ id: op.id, feature: 'pdf-blur' });
    if (op.op !== 'shape') out.push({ id: op.id, feature: 'pdf-preview-op' });
    if (op.words?.layout?.lines.some((line, l) => line.runs.some((run, r) => run.text.trim() && !op.words!.outlines?.[l]?.[r]))) {
      out.push({ id: op.id, feature: 'pdf-live-text' });
    }
    if (op.picture) {
      const picture = pictures.get(op.picture.ref);
      if (!picture || !op.picture.natural || !pdfImage(picture.bytes, picture.mime)) out.push({ id: op.id, feature: 'pdf-image-format' });
    }
  }
  return out;
}

/** A picture as a PDF image: its XObject dictionary, data and soft mask, or null when this writer cannot embed the picture. */
interface PdfImage { dict: string; data: Uint8Array; filter?: string; mask?: { dict: string; data: Uint8Array; filter?: string } }

function pngChunks(bytes: Uint8Array): { ihdr: Uint8Array; plte?: Uint8Array; trns?: Uint8Array; idat: Uint8Array } | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 8, ihdr: Uint8Array | undefined, plte: Uint8Array | undefined, trns: Uint8Array | undefined;
  const idat: Uint8Array[] = [];
  while (at + 8 <= bytes.length) {
    const len = dv.getUint32(at);
    const type = String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
    const data = bytes.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') ihdr = data;
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    at += 12 + len;
  }
  if (!ihdr || !idat.length) return null;
  const total = idat.reduce((s, d) => s + d.length, 0);
  const joined = new Uint8Array(total);
  let o = 0;
  for (const d of idat) { joined.set(d, o); o += d.length; }
  return { ihdr, ...(plte ? { plte } : {}), ...(trns ? { trns } : {}), idat: joined };
}

const pdfImageCache = new WeakMap<Uint8Array, PdfImage | null>();

function pdfImage(bytes: Uint8Array, mime: string): PdfImage | null {
  if (pdfImageCache.has(bytes)) return pdfImageCache.get(bytes)!;
  let out: PdfImage | null = null;
  try { out = mime === 'image/jpeg' ? jpegImage(bytes) : mime === 'image/png' ? pngImage(bytes) : null; } catch { out = null; }
  pdfImageCache.set(bytes, out);
  return out;
}

function jpegImage(b: Uint8Array): PdfImage | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const h = (b[i + 5]! << 8) | b[i + 6]!, w = (b[i + 7]! << 8) | b[i + 8]!, components = b[i + 9]!;
      // Four-component JPEG is CMYK with an encoder-specific inversion; leave it to another renderer.
      if (components !== 1 && components !== 3) return null;
      return { dict: `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /${components === 1 ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8`, data: b, filter: '/DCTDecode' };
    }
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function pngImage(bytes: Uint8Array): PdfImage | null {
  const png = pngChunks(bytes);
  if (!png) return null;
  const dv = new DataView(png.ihdr.buffer, png.ihdr.byteOffset, png.ihdr.byteLength);
  const w = dv.getUint32(0), h = dv.getUint32(4), depth = png.ihdr[8]!, type = png.ihdr[9]!, interlace = png.ihdr[12]!;
  if (depth !== 8 || interlace !== 0) return null;
  const head = (space: string) => `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace ${space} /BitsPerComponent 8`;
  const predictor = (colors: number) => ` /DecodeParms << /Predictor 15 /Colors ${colors} /BitsPerComponent 8 /Columns ${w} >>`;
  const palette = png.plte ? `[/Indexed /DeviceRGB ${png.plte.length / 3 - 1} <${[...png.plte].map((v) => v.toString(16).padStart(2, '0')).join('')}>]` : '';
  // Opaque grey, colour and palette images keep their own compressed rows, read with the PNG predictor.
  if ((type === 0 || type === 2) && !png.trns) return { dict: head(type === 0 ? '/DeviceGray' : '/DeviceRGB') + predictor(type === 0 ? 1 : 3), data: png.idat, filter: '/FlateDecode' };
  if (type === 3 && palette && !png.trns) return { dict: head(palette) + predictor(1), data: png.idat, filter: '/FlateDecode' };
  // Transparency: decode the rows and write the colour and the alpha apart.
  const channels = type === 6 ? 4 : type === 4 ? 2 : type === 3 ? 1 : 0;
  if (!channels) return null;
  const raw = unfilterPng(unzlibSync(png.idat), w, h, channels);
  if (!raw) return null;
  const count = w * h;
  const alpha = new Uint8Array(count);
  let colour: Uint8Array, space: string;
  if (type === 3) {
    const trns = png.trns!;
    colour = raw;
    space = palette;
    for (let i = 0; i < count; i++) alpha[i] = raw[i]! < trns.length ? trns[raw[i]!]! : 255;
  } else {
    const c = channels - 1;
    colour = new Uint8Array(count * c);
    space = c === 1 ? '/DeviceGray' : '/DeviceRGB';
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < c; k++) colour[i * c + k] = raw[i * channels + k]!;
      alpha[i] = raw[i * channels + c]!;
    }
  }
  return {
    dict: head(space), data: zlibSync(colour), filter: '/FlateDecode',
    mask: { dict: `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8`, data: zlibSync(alpha), filter: '/FlateDecode' },
  };
}

/** Stops as a PDF function from 0 to 1, padded to both ends and kept increasing. */
function stopsFunction(stops: readonly DrawStop[], value: (s: DrawStop) => number[]): string {
  const list = [...stops].sort((a, b) => a.offset - b.offset);
  if (list[0]!.offset > 0) list.unshift({ ...list[0]!, offset: 0 });
  if (list[list.length - 1]!.offset < 1) list.push({ ...list[list.length - 1]!, offset: 1 });
  const piece = (a: DrawStop, b: DrawStop) => `<< /FunctionType 2 /Domain [0 1] /C0 [${value(a).map(n).join(' ')}] /C1 [${value(b).map(n).join(' ')}] /N 1 >>`;
  if (list.length === 2) return piece(list[0]!, list[1]!);
  const pieces: string[] = [], bounds: number[] = [];
  for (let i = 0; i + 1 < list.length; i++) {
    pieces.push(piece(list[i]!, list[i + 1]!));
    if (i + 2 < list.length) bounds.push(Math.max(list[i + 1]!.offset, (bounds[bounds.length - 1] ?? 0) + 1e-4));
  }
  return `<< /FunctionType 3 /Domain [0 1] /Functions [${pieces.join(' ')}] /Bounds [${bounds.map(n).join(' ')}] /Encode [${pieces.map(() => '0 1').join(' ')}] >>`;
}

/**
 * Write compiled pages as one PDF. Each page's artwork is drawn in CSS px, scaled into
 * its artwork box; a page with findings (see `designDrawPdfFindings`) draws what it can
 * and leaves the rest out, so a caller checks the findings first.
 */
export function designDrawPdf(pages: readonly DesignPdfPage[], info: DesignPdfInfo = {}): Uint8Array {
  const objects = new PdfObjects();
  const catalog = objects.reserve(), pagesNum = objects.reserve();
  const kids: number[] = [];
  const images = new Map<Uint8Array, number>();

  const imageObject = (picture: { bytes: Uint8Array; mime: string }): number | null => {
    const known = images.get(picture.bytes);
    if (known) return known;
    const img = pdfImage(picture.bytes, picture.mime);
    if (!img) return null;
    const num = objects.reserve();
    let mask = '';
    if (img.mask) {
      const m = objects.reserve();
      objects.stream(m, img.mask.dict, img.mask.data, img.mask.filter);
      mask = ` /SMask ${m} 0 R`;
    }
    objects.stream(num, img.dict + mask, img.data, img.filter);
    images.set(picture.bytes, num);
    return num;
  };

  for (const item of pages) {
    const { page } = item;
    const pageRes = new Resources();
    // The resources the drawing being written names: the page's, or a group's while its body is written.
    let res = pageRes;
    const art = item.artwork ?? { x: 0, y: 0, w: item.size.w, h: item.size.h };

    const opacityGs = (fill?: number, stroke?: number): string => {
      if ((fill ?? 1) >= 1 && (stroke ?? 1) >= 1) return '';
      const key = `${n(fill ?? 1)} ${n(stroke ?? 1)}`;
      return `/${res.name('gs', `o ${key}`, () => `<< /ca ${n(fill ?? 1)} /CA ${n(stroke ?? 1)} >>`)} gs `;
    };

    const shadingFor = (paint: Exclude<DrawPaint, { kind: 'color' }>, gray: boolean): number => {
      const num = objects.reserve();
      const fn = stopsFunction(paint.stops, gray ? (s) => [s.opacity] : (s) => rgb(s.color));
      const space = gray ? '/DeviceGray' : '/DeviceRGB';
      objects.put(num, paint.kind === 'linear'
        ? `<< /ShadingType 2 /ColorSpace ${space} /Coords [${[paint.x1, paint.y1, paint.x2, paint.y2].map(n).join(' ')}] /Function ${fn} /Extend [true true] >>`
        : `<< /ShadingType 3 /ColorSpace ${space} /Coords [0 0 0 0 0 0.71] /Function ${fn} /Extend [true true] >>`);
      return num;
    };

    /** A gradient over the current clip, in the box's own frame for a radial one. */
    const gradientFill = (paint: Exclude<DrawPaint, { kind: 'color' }>, box: DrawBox): string => {
      const key = JSON.stringify(paint);
      const sh = res.name('shading', key, () => shadingFor(paint, false));
      const frame = paint.kind === 'radial' ? `${n(box.w)} 0 0 ${n(box.h)} ${n(box.x + box.w / 2)} ${n(box.y + box.h / 2)} cm ` : '';
      let mask = '';
      if (paint.stops.some((s) => s.opacity < 1)) {
        const gsName = res.name('gs', `m ${key}`, () => {
          const form = objects.reserve(), shade = shadingFor(paint, true);
          objects.flate(form, `/Type /XObject /Subtype /Form /BBox [-100000 -100000 100000 100000] /Group << /Type /Group /S /Transparency /CS /DeviceGray >> /Resources << /Shading << /S0 ${shade} 0 R >> >>`, '/S0 sh\n');
          return `<< /SMask << /Type /Mask /S /Luminosity /G ${form} 0 R >> >>`;
        });
        mask = `/${gsName} gs `;
      }
      return `${frame}${mask}/${sh} sh\n`;
    };

    const strokeOps = (s: DrawStroke): string => {
      let out = `${color(s.color, 'RG')} ${n(s.width)} w `;
      if (s.cap !== undefined) out += `${CAPS[s.cap] ?? 0} J `;
      if (s.join !== undefined) out += `${JOINS[s.join] ?? 0} j `;
      if (s.dash) out += `[${n(s.dash[0])} ${n(s.dash[1])}] 0 d `;
      return out;
    };

    const shapeBody = (op: DrawShapeOp): string => {
      const box = op.box;
      if (op.shape.kind === 'path') {
        if (!op.shape.contours.length) return '';
        const fill = op.fills[0]?.kind === 'color' ? op.fills[0] : undefined;
        const path = contoursPath(op.shape.contours);
        const s = op.stroke;
        const paintOp = fill && s ? (op.shape.evenOdd ? 'B*' : 'B') : fill ? (op.shape.evenOdd ? 'f*' : 'f') : s ? 'S' : 'n';
        return `q ${opacityGs(fill?.opacity, s?.opacity)}${fill ? `${color(fill.color, 'rg')} ` : ''}${s ? strokeOps(s) : ''}\n${path}${paintOp}\nQ\n`;
      }
      const shape = op.shape;
      let out = '';
      for (const fill of op.fills) {
        if (fill.kind === 'color') out += `q ${opacityGs(fill.opacity)}${color(fill.color, 'rg')}\n${outlinePath(shape, box)}f\nQ\n`;
        else out += `q\n${outlinePath(shape, box)}W n\n${gradientFill(fill, box)}Q\n`;
      }
      const s = op.stroke;
      if (s) {
        if (s.align === 'inside') {
          // A CSS border: the centre line runs half the width inside the edge, following the radius less that half.
          const half = s.width / 2;
          const inner = { x: box.x + half, y: box.y + half, w: Math.max(0, box.w - s.width), h: Math.max(0, box.h - s.width) };
          const innerShape: Exclude<DrawShape, { kind: 'path' }> = shape.kind === 'ellipse' ? shape : { kind: 'rect', radius: Math.max(0, shape.radius - half) };
          out += `q ${opacityGs(undefined, s.opacity)}${strokeOps(s)}\n${outlinePath(innerShape, inner)}S\nQ\n`;
        } else out += `q ${opacityGs(undefined, s.opacity)}${strokeOps(s)}\n${outlinePath(shape, box)}S\nQ\n`;
      }
      return out;
    };

    const clipTo = (area: DrawArea): string => `${outlinePath(area.shape, area.box)}W n\n`;

    const pictureBody = (picture: DrawPicture): string => {
      const bytes = item.pictures.get(picture.ref);
      const num = bytes && picture.natural ? imageObject(bytes) : null;
      if (!num || !picture.natural) return '';
      const name = res.name('xobject', `i ${num}`, () => num);
      const r = pictureRect(picture, picture.natural);
      const square = picture.element.shape.kind === 'rect' && picture.element.shape.radius === 0;
      const own = picture.clip && square && picture.zoom >= 1 ? '' : clipTo(picture.element);
      return `q\n${picture.clip ? clipTo(picture.clip) : ''}${own}${n(r.w)} 0 0 ${n(-r.h)} ${n(r.x)} ${n(r.y + r.h)} cm /${name} Do\nQ\n`;
    };

    const wordsBody = (op: DrawOp): string => {
      const words = op.words, layout = words?.layout;
      if (!words || !layout?.lines.length) return '';
      const box = op.box;
      const border = op.op === 'shape' && op.stroke?.align === 'inside' ? Math.min(op.stroke.width, box.w / 2, box.h / 2) : 0;
      const inner = { x: box.x + border, y: box.y + border, w: Math.max(0, box.w - border * 2), h: Math.max(0, box.h - border * 2) };
      const shape: Exclude<DrawShape, { kind: 'path' }> = op.op === 'shape' && op.shape.kind === 'ellipse' ? { kind: 'ellipse' }
        : { kind: 'rect', radius: op.op === 'shape' && op.shape.kind === 'rect' ? Math.max(0, op.shape.radius - border) : 0 };
      let out = `q\n${clipTo({ box: inner, shape })}`;
      for (const [li, line] of layout.lines.entries()) {
        for (const [ri, run] of line.runs.entries()) {
          const d = words.outlines?.[li]?.[ri];
          if (d === undefined || d === null) continue;
          const ink = run.color && /^#[0-9a-fA-F]{3,8}$/.test(run.color) ? run.color : words.ink;
          const strike = words.strikes?.[li]?.[ri];
          if (!d && !strike) continue;
          out += `q ${opacityGs(ink === words.ink ? words.inkOpacity : undefined)}${color(ink, 'rg')} 1 0 0 1 ${n(box.x + line.x + run.x)} ${n(box.y + line.baseline)} cm\n${d ? `${svgPath(d)}f\n` : ''}${strike && strike.width > 0 ? `0 ${n(strike.y)} ${n(strike.width)} ${n(strike.height)} re f\n` : ''}Q\n`;
        }
      }
      return `${out}Q\n`;
    };

    const body = (op: DrawOp): string => {
      let inner = '';
      if (op.pose) {
        const cx = op.box.x + op.box.w / 2, cy = op.box.y + op.box.h / 2, a = (op.pose.rot * Math.PI) / 180;
        const sx = op.pose.flipH ? -1 : 1, sy = op.pose.flipV ? -1 : 1;
        const cos = Math.cos(a), sin = Math.sin(a);
        // translate(c) rotate(a) scale(s) translate(-c), as the SVG pose composes.
        const m = [cos * sx, sin * sx, -sin * sy, cos * sy];
        inner += `${m.map(n).join(' ')} ${n(cx - m[0]! * cx - m[2]! * cy)} ${n(cy - m[1]! * cx - m[3]! * cy)} cm\n`;
      }
      if (op.op === 'shape') inner += shapeBody(op);
      if (op.picture) inner += pictureBody(op.picture);
      inner += wordsBody(op);
      return inner;
    };

    const paint = (op: DrawOp): string => {
      let out = 'q\n';
      if (op.clip?.points.length) {
        const [first, ...rest] = op.clip.points;
        out += `${n(first![0])} ${n(first![1])} m ${rest.map(([x, y]) => `${n(x)} ${n(y)} l`).join(' ')} h W n\n`;
      }
      const blend = op.blend ? BLEND[op.blend] : undefined;
      if (op.opacity < 100 || blend) {
        // The operation as one transparency group, so its parts fade and blend together as CSS composites a box.
        const form = objects.reserve();
        const formRes = new Resources(), outer = res;
        res = formRes;
        const text = body(op);
        res = outer;
        objects.flate(form, `/Type /XObject /Subtype /Form /BBox [-100000 -100000 100000 100000] /Group << /Type /Group /S /Transparency >> /Resources ${formRes.dict()}`, text);
        const xname = res.name('xobject', `f ${form}`, () => form);
        const gs = res.name('gs', `g ${n(op.opacity / 100)} ${blend ?? ''}`, () => `<< /ca ${n(op.opacity / 100)} /CA ${n(op.opacity / 100)}${blend ? ` /BM /${blend}` : ''} >>`);
        out += `/${gs} gs /${xname} Do\n`;
      } else out += body(op);
      return `${out}Q\n`;
    };

    const sx = art.w / page.width, sy = art.h / page.height;
    let content = `1 0 0 -1 0 ${n(item.size.h)} cm ${n(sx)} 0 0 ${n(sy)} ${n(art.x)} ${n(art.y)} cm\n`;
    if (page.frame) content += paint(page.frame);
    else if (page.background) content += `q ${color(page.background, 'rg')} 0 0 ${n(page.width)} ${n(page.height)} re f Q\n`;
    const rows = page.ops.map(paint).join('');
    content += page.clip && rows ? `q\n${clipTo(page.clip)}${rows}Q\n` : rows;

    const contents = objects.reserve(), pageNum = objects.reserve();
    objects.flate(contents, '', content);
    objects.put(pageNum, `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${n(item.size.w)} ${n(item.size.h)}] /Resources ${pageRes.dict()} /Contents ${contents} 0 R /Group << /Type /Group /S /Transparency /CS /DeviceRGB >> >>`);
    kids.push(pageNum);
  }

  objects.put(pagesNum, `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  objects.put(catalog, `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`);
  const fields = Object.entries({ Title: info.title, Author: info.author, Subject: info.subject, Keywords: info.keywords, Creator: info.creator })
    .filter((e): e is [string, string] => !!e[1]);
  let infoNum: number | null = null;
  if (fields.length) {
    infoNum = objects.reserve();
    objects.put(infoNum, `<< ${fields.map(([k, v]) => `/${k} ${pdfText(v)}`).join(' ')} >>`);
  }
  return objects.bytes(catalog, infoNum);
}
