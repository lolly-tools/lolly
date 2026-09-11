// SPDX-License-Identifier: MPL-2.0
/**
 * The PDF drawing surface the vector walkers paint into, written on pdf-lib.
 *
 * The walkers in export.ts and the helpers in export-pdf-vector.ts emit page
 * content one operator at a time: set a colour, add a path, fill it, place an
 * image, draw a run of text. That drawing API used to come from a second PDF
 * library; this module provides it over pdf-lib, which the shell already loads
 * for print marks, page boxes, PDF/X finishing and AES-256 encryption. One
 * library, one document model.
 *
 * Coordinates are POINTS with the origin at the top-left of the page and y
 * growing downward, which is the space every caller already works in. The page
 * content stream opens with the change-of-basis matrix that maps it to PDF's own
 * bottom-left space, so a caller's rotation or matrix transform composes in the
 * space it was computed in. Images and text carry their own local flip, so they
 * are not drawn mirrored.
 *
 * Colour operators are written at two decimals, and a neutral triple collapses to
 * the DeviceGray form, because the CMYK export pass rewrites `rg`/`RG` operator
 * text and its palette keys are quantised to match (engine cmykKey).
 *
 * What runs when: a caller's drawing call is synchronous string building plus a
 * resource name reserved up front. The bytes for images, embedded fonts and
 * gradients are built once at output() time.
 */
import { parseSfnt, subsetSfnt, type SfntFont } from './export-pdf-sfnt.ts';
import { encryptPdfRc4 } from './export-pdf-rc4.ts';
// Types only, so pdf-lib stays a lazy runtime import (createPdfDoc below).
import type { PDFContext, PDFDocument, PDFFont, PDFPage, PDFRef } from 'pdf-lib';

/** The pdf-lib module itself, as the lazy import hands it over. */
type PdfLib = typeof import('pdf-lib');

/** One page's resource dictionary in the plain-object form `ctx.obj()` accepts:
 *  the ProcSet name list, plus a per-category map of resource name to object. */
type PdfResources = Record<string, string[] | Record<string, PDFRef>>;

export interface PdfDocOptions {
  /** Page size in points, [width, height]. */
  format?: [number, number];
  orientation?: 'portrait' | 'landscape';
  /** Standard (40-bit RC4) lock applied to the finished bytes. */
  encryption?: { userPassword: string; ownerPassword?: string; userPermissions?: string[] } | null;
}

export interface PdfMetaProperties {
  creator?: string;
  author?: string;
  title?: string;
  subject?: string;
  keywords?: string;
}

/** A 2-D affine in PDF operator order. */
export class PdfMatrix {
  a: number; b: number; c: number; d: number; e: number; f: number;
  constructor(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
  }
  toString(): string {
    return [this.a, this.b, this.c, this.d, this.e, this.f].map(num).join(' ');
  }
}

/** Fill and stroke alpha, the only graphics-state entries the walkers set. */
export class PdfGState {
  opacity: number;
  strokeOpacity: number;
  constructor(opts: { opacity?: number; 'stroke-opacity'?: number } = {}) {
    this.opacity = opts.opacity ?? 1;
    this.strokeOpacity = opts['stroke-opacity'] ?? this.opacity;
  }
}

/** An axial or radial gradient, painted with the `sh` operator. */
export class PdfShadingPattern {
  type: 'axial' | 'radial';
  coords: number[];
  colors: { offset: number; color: number[] }[];
  constructor(type: 'axial' | 'radial', coords: number[], colors: { offset: number; color: number[] }[]) {
    this.type = type;
    this.coords = coords;
    this.colors = colors;
  }
}

type Style = 'S' | 'D' | 'F' | 'DF' | 'FD' | 'f' | 'f*' | 'B' | 'B*' | 'n' | null | undefined;

interface PageState {
  page: PDFPage;
  w: number;
  h: number;
  ops: string[];
  fonts: Set<string>;
  images: Set<string>;
  shadings: Set<string>;
  gstates: Set<string>;
}

interface FontEntry {
  key: string;
  /** Resource name, e.g. F1. */
  name: string;
  /** The parsed face for an embedded font, null for a base-14 one. */
  sfnt: SfntFont | null;
  /** Which base-14 face this is, for the handle built on first use. */
  standard: string;
  /** pdf-lib's own font handle, built lazily so an unused font is never written. */
  std: PDFFont | null;
  /** Glyph ids drawn, which is what the subset keeps. */
  gids: Set<number>;
  toUnicode: Map<number, number>;
}

interface ImageEntry { name: string; src: string }
interface ShadingEntry { name: string; pattern: PdfShadingPattern }
interface GStateEntry { name: string; gs: PdfGState }

/** Up to four decimals, never exponent notation (which PDF does not accept). */
function num(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const s = v.toFixed(4);
  const trimmed = s.includes('.') ? s.replace(/\.?0+$/, '') : s;
  return trimmed === '' || trimmed === '-' || trimmed === '-0' ? '0' : trimmed;
}

/** Two decimals with trailing zeros dropped, the colour-operator form. */
function f2(v: number): string {
  return v.toFixed(2).replace(/0+$/, '');
}

function colorOp(r: number, g: number, b: number, stroke: boolean): string {
  const letters = stroke ? ['G', 'RG'] : ['g', 'rg'];
  if (r === g && g === b) return `${f2(r / 255)} ${letters[0]}`;
  return `${f2(r / 255)} ${f2(g / 255)} ${f2(b / 255)} ${letters[1]}`;
}

function hexColor(r: number, g: number, b: number): string {
  const h = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function parseHexColor(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const LINE_CAPS: Record<string, number> = { butt: 0, round: 1, square: 2, projecting: 2 };
const LINE_JOINS: Record<string, number> = { miter: 0, round: 1, bevel: 2, arcs: 0, 'miter-clip': 0 };

/** Bezier offset for a quarter arc, the constant the previous writer used. */
const ARC_K = (4 / 3) * (Math.SQRT2 - 1);

/** Decode a data: URL, or fetch a remote URL, to bytes. */
async function bytesForSource(src: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/i.exec(src);
    if (m) {
      const mime = (m[1] || '').toLowerCase();
      if (m[2]) return { bytes: base64Bytes(m[3]!), mime };
      return { bytes: new TextEncoder().encode(decodeURIComponent(m[3]!)), mime };
    }
    const resp = await fetch(src);
    if (!resp.ok) return null;
    const buf = new Uint8Array(await resp.arrayBuffer());
    return { bytes: buf, mime: (resp.headers.get('content-type') || '').split(';')[0]!.toLowerCase() };
  } catch { return null; }
}

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A 1x1 fully transparent PNG, stood in for an image that would not decode. */
const BLANK_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

/**
 * One PDF document being written. Build it with createPdfDoc(), draw into it,
 * then await output('blob').
 */
export class PdfDoc {
  // Constructors the drawing helpers reach for through the document handle.
  readonly Matrix = PdfMatrix;
  readonly GState = PdfGState;
  readonly ShadingPattern = PdfShadingPattern;

  private fillOp = '0 g';
  private drawOp = '0 G';
  private pages: PageState[] = [];
  private current!: PageState;
  private fonts = new Map<string, FontEntry>();
  private images = new Map<string, ImageEntry>();
  private shadings = new Map<string, ShadingEntry>();
  private gstates = new Map<string, GStateEntry>();
  private vfs = new Map<string, Uint8Array>();
  private activeFont: FontEntry;
  private fontSize = 16;
  private textColor = '#000000';
  private meta: PdfMetaProperties = {};
  private encryption: PdfDocOptions['encryption'];
  private warnings: string[] = [];
  private built: Promise<Uint8Array> | null = null;

  private lib: PdfLib;
  private doc: PDFDocument;

  constructor(lib: PdfLib, doc: PDFDocument, opts: PdfDocOptions = {}) {
    this.lib = lib;
    this.doc = doc;
    this.encryption = opts.encryption ?? null;
    this.activeFont = this.standardFont('helvetica', 'normal');
    const [w, h] = normaliseFormat(opts.format ?? [595.28, 841.89], opts.orientation);
    this.newPage(w, h);
  }

  // ── page + stream plumbing ──────────────────────────────────────────────────

  private newPage(w: number, h: number): void {
    this.current = {
      page: this.doc.addPage([w, h]), w, h, ops: [],
      fonts: new Set(), images: new Set(), shadings: new Set(), gstates: new Set(),
    };
    this.pages.push(this.current);
    // Change of basis: the rest of this stream is written top-left, y-down.
    this.out(`1 0 0 -1 0 ${num(h)} cm`);
    this.out(this.fillOp);
    this.out(this.drawOp);
  }

  addPage(format?: [number, number], orientation?: 'portrait' | 'landscape'): this {
    // A path left open on the previous page (drawn, never painted) is written there,
    // never carried across to the new page's stream.
    if (this.pathOps.length) this.flushPath();
    const [w, h] = normaliseFormat(format ?? [this.current.w, this.current.h], orientation);
    this.newPage(w, h);
    return this;
  }

  private out(op: string): void {
    this.current.ops.push(op);
  }

  // ── colour and line state ───────────────────────────────────────────────────

  setFillColor(r: number, g: number, b: number): this {
    this.fillOp = colorOp(r, g, b, false);
    this.out(this.fillOp);
    return this;
  }

  setDrawColor(r: number, g: number, b: number): this {
    this.drawOp = colorOp(r, g, b, true);
    this.out(this.drawOp);
    return this;
  }

  setTextColor(r: number | string, g?: number, b?: number): this {
    const rgb = typeof r === 'string' ? parseHexColor(r) : ([r, g ?? 0, b ?? 0] as [number, number, number]);
    this.textColor = hexColor(rgb[0], rgb[1], rgb[2]);
    return this;
  }

  getTextColor(): string {
    return this.textColor;
  }

  setLineWidth(w: number): this {
    this.out(`${num(w)} w`);
    return this;
  }

  setLineCap(style: string | number): this {
    this.out(`${typeof style === 'number' ? style : LINE_CAPS[style] ?? 0} J`);
    return this;
  }

  setLineJoin(style: string | number): this {
    this.out(`${typeof style === 'number' ? style : LINE_JOINS[style] ?? 0} j`);
    return this;
  }

  setLineMiterLimit(limit: number): this {
    this.out(`${num(limit)} M`);
    return this;
  }

  setLineDashPattern(pattern: number[], phase = 0): this {
    const dashes = (pattern ?? []).filter(v => Number.isFinite(v)).map(num).join(' ');
    this.out(`[${dashes}] ${num(phase)} d`);
    return this;
  }

  saveGraphicsState(): this {
    this.out('q');
    return this;
  }

  restoreGraphicsState(): this {
    this.out('Q');
    return this;
  }

  setGState(gs: PdfGState): this {
    const key = `${gs.opacity}:${gs.strokeOpacity}`;
    let entry = this.gstates.get(key);
    if (!entry) {
      entry = { name: `GA${this.gstates.size + 1}`, gs };
      this.gstates.set(key, entry);
    }
    this.current.gstates.add(key);
    this.out(`/${entry.name} gs`);
    return this;
  }

  setCurrentTransformationMatrix(m: PdfMatrix): this {
    this.out(`${m.toString()} cm`);
    return this;
  }

  /**
   * Kept so callers written against the older library keep working. The page is
   * always in the top-left space that mode used to switch on, so the body runs
   * unchanged.
   */
  advancedAPI(body?: (doc: this) => void): this {
    body?.(this);
    return this;
  }

  isAdvancedAPI(): boolean {
    return true;
  }

  // ── paths ───────────────────────────────────────────────────────────────────

  private putStyle(style: Style): void {
    if (style === null) return;                    // path only, the caller paints later
    this.flushPath();
    const op = style === undefined || style === 'D' || style === 'S' ? 'S'
      : style === 'F' ? 'f'
      : style === 'FD' || style === 'DF' ? 'B'
      : style;
    this.out(op);
  }

  // Path construction is buffered until the operator that ends the path object (S, f,
  // B, W n, ...). PDF forbids a general graphics operator such as `q` inside a path
  // object, and a gradient fill needs its `q` BEFORE the path so the clip it sets is
  // undone by the matching `Q`. Buffering lets paint() emit q, path, W n, cm, sh, Q in
  // that order even though the caller drew the path first.
  private pathOps: string[] = [];
  private seg(op: string): void { this.pathOps.push(op); }
  private flushPath(): void {
    for (const op of this.pathOps) this.out(op);
    this.pathOps.length = 0;
  }

  moveTo(x: number, y: number): this { this.seg(`${num(x)} ${num(y)} m`); return this; }
  lineTo(x: number, y: number): this { this.seg(`${num(x)} ${num(y)} l`); return this; }
  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    this.seg(`${num(x1)} ${num(y1)} ${num(x2)} ${num(y2)} ${num(x3)} ${num(y3)} c`);
    return this;
  }
  close(): this { this.seg('h'); return this; }
  clip(rule?: string): this { this.flushPath(); this.out(rule === 'evenodd' ? 'W*' : 'W'); return this; }
  clipEvenOdd(): this { return this.clip('evenodd'); }
  discardPath(): this { this.flushPath(); this.out('n'); return this; }
  stroke(): this { this.flushPath(); this.out('S'); return this; }
  fill(pattern?: { key: string; matrix?: PdfMatrix }): this { return this.paint('f', pattern); }
  fillEvenOdd(pattern?: { key: string; matrix?: PdfMatrix }): this { return this.paint('f*', pattern); }
  fillStroke(pattern?: { key: string; matrix?: PdfMatrix }): this { return this.paint('B', pattern); }

  private paint(op: string, pattern?: { key: string; matrix?: PdfMatrix }): this {
    const entry = pattern && typeof pattern === 'object' ? this.shadings.get(pattern.key) : undefined;
    // No entry, or a gradient with no stops (buildShading would return null and the
    // stream would name a resource the page never carries): paint the plain fill.
    if (!entry?.pattern.colors.length) { this.flushPath(); this.out(op); return this; }
    this.current.shadings.add(pattern!.key);
    // q first, then the path, so the clip the path sets is undone by the matching Q.
    this.out('q');
    this.flushPath();
    this.out(op === 'f*' ? 'W* n' : 'W n');
    this.out(`${(pattern!.matrix ?? new PdfMatrix(1, 0, 0, 1, 0, 0)).toString()} cm`);
    this.out(`/${entry.name} sh`);
    this.out('Q');
    return this;
  }

  rect(x: number, y: number, w: number, h: number, style?: Style): this {
    this.seg(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re`);
    this.putStyle(style);
    return this;
  }

  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style?: Style): this {
    const cx = Math.min(rx, w * 0.5);
    const cy = Math.min(ry, h * 0.5);
    const kx = cx * ARC_K;
    const ky = cy * ARC_K;
    this.moveTo(x + cx, y);
    this.lineTo(x + w - cx, y);
    this.curveTo(x + w - cx + kx, y, x + w, y + cy - ky, x + w, y + cy);
    this.lineTo(x + w, y + h - cy);
    this.curveTo(x + w, y + h - cy + ky, x + w - cx + kx, y + h, x + w - cx, y + h);
    this.lineTo(x + cx, y + h);
    this.curveTo(x + cx - kx, y + h, x, y + h - cy + ky, x, y + h - cy);
    this.lineTo(x, y + cy);
    this.curveTo(x, y + cy - ky, x + cx - kx, y, x + cx, y);
    this.close();
    this.putStyle(style);
    return this;
  }

  ellipse(x: number, y: number, rx: number, ry: number, style?: Style): this {
    const lx = ARC_K * rx;
    const ly = ARC_K * ry;
    this.moveTo(x + rx, y);
    this.curveTo(x + rx, y - ly, x + lx, y - ry, x, y - ry);
    this.curveTo(x - lx, y - ry, x - rx, y - ly, x - rx, y);
    this.curveTo(x - rx, y + ly, x - lx, y + ry, x, y + ry);
    this.curveTo(x + lx, y + ry, x + rx, y + ly, x + rx, y);
    this.putStyle(style);
    return this;
  }

  circle(x: number, y: number, r: number, style?: Style): this {
    return this.ellipse(x, y, r, r, style);
  }

  line(x1: number, y1: number, x2: number, y2: number, style?: Style): this {
    this.moveTo(x1, y1);
    this.lineTo(x2, y2);
    this.putStyle(style ?? 'S');
    return this;
  }

  // ── gradients ───────────────────────────────────────────────────────────────

  addShadingPattern(key: string, pattern: PdfShadingPattern): this {
    if (!this.shadings.has(key)) this.shadings.set(key, { name: `Sh${this.shadings.size + 1}`, pattern });
    return this;
  }

  // ── images ──────────────────────────────────────────────────────────────────

  /**
   * Place an already-encoded image. PNG and JPEG go in as they are; the callers
   * convert every other format to PNG before they reach this point, so anything
   * else is reported and left blank rather than breaking the page.
   */
  addImage(src: string, _format: string, x: number, y: number, w: number, h: number): this {
    if (!src || !(w > 0) || !(h > 0)) return this;
    let entry = this.images.get(src);
    if (!entry) {
      entry = { name: `I${this.images.size + 1}`, src };
      this.images.set(src, entry);
    }
    this.current.images.add(src);
    // The image's own unit square is y-up, so its placement matrix flips back.
    this.out('q');
    this.out(`${num(w)} 0 0 ${num(-h)} ${num(x)} ${num(y + h)} cm`);
    this.out(`/${entry.name} Do`);
    this.out('Q');
    return this;
  }

  // ── fonts and text ──────────────────────────────────────────────────────────

  addFileToVFS(file: string, base64: string): this {
    try { this.vfs.set(file, base64Bytes(base64)); }
    catch { /* an unreadable file simply never registers */ }
    return this;
  }

  /** Register a font file already added to the VFS under a family + style key. */
  addFont(file: string, name: string, style: string): this {
    const key = fontKey(name, style);
    if (this.fonts.has(key)) return this;
    const bytes = this.vfs.get(file);
    const sfnt = bytes ? parseSfnt(bytes) : null;
    if (!sfnt) {
      this.warnings.push(`pdf: ${file} is not a TrueType file this writer can embed - the run falls back to a base font`);
      return this;
    }
    this.fonts.set(key, {
      key, name: `F${this.fonts.size + 1}`, sfnt, standard: '', std: null,
      gids: new Set(), toUnicode: new Map(),
    });
    return this;
  }

  setFont(name: string, style = 'normal'): this {
    this.activeFont = this.fonts.get(fontKey(name, style)) ?? this.standardFont(name, style);
    return this;
  }

  setFontSize(size: number): this {
    this.fontSize = size;
    return this;
  }

  getFontSize(): number {
    return this.fontSize;
  }

  private standardFont(name: string, style: string): FontEntry {
    const standard = standardFontName(name, style);
    const key = fontKey('@base14', standard);
    let entry = this.fonts.get(key);
    if (!entry) {
      entry = {
        key, name: `F${this.fonts.size + 1}`, sfnt: null, standard, std: null,
        gids: new Set(), toUnicode: new Map(),
      };
      this.fonts.set(key, entry);
    }
    return entry;
  }

  /** pdf-lib's handle for a base-14 face, built the first time a run needs it. */
  private base14(font: FontEntry): PDFFont {
    if (!font.std) {
      const { StandardFonts } = this.lib;
      const named = StandardFonts[font.standard as keyof typeof StandardFonts];
      font.std = this.doc.embedStandardFont(named ?? StandardFonts.Helvetica);
    }
    return font.std;
  }

  /** Width of a string at the current font size, in points. */
  getTextWidth(text: string): number {
    return this.widthOf(String(text ?? ''), this.activeFont, this.fontSize);
  }

  private widthOf(text: string, font: FontEntry, size: number): number {
    if (font.sfnt) {
      let units = 0;
      for (const ch of text) units += font.sfnt.advance(font.sfnt.gidFor(ch.codePointAt(0)!));
      return (units / font.sfnt.unitsPerEm) * size;
    }
    const std = this.base14(font);
    try { return std.widthOfTextAtSize(text, size); }
    catch { return std.widthOfTextAtSize(toWinAnsi(text), size); }
  }

  text(text: string, x: number, y: number, opts: { align?: string; baseline?: string } = {}): this {
    if (text == null) return this;
    const font = this.activeFont;
    const lines = String(text).split('\n');
    const rgb = parseHexColor(this.textColor);
    const lead = this.fontSize * 1.15;
    this.current.fonts.add(font.key);
    this.out('q');
    this.out('BT');
    this.out(`/${font.name} ${num(this.fontSize)} Tf`);
    this.out(colorOp(rgb[0], rgb[1], rgb[2], false));
    lines.forEach((line, i) => {
      if (!line) return;
      const w = this.widthOf(line, font, this.fontSize);
      const align = opts.align ?? 'left';
      const lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      // The text matrix carries its own y flip, so glyphs sit upright inside the
      // page's top-left change of basis. y is the baseline.
      this.out(`1 0 0 -1 ${num(lx)} ${num(y + i * lead)} Tm`);
      this.out(`${this.encodeText(line, font)} Tj`);
    });
    this.out('ET');
    this.out('Q');
    return this;
  }

  private encodeText(text: string, font: FontEntry): string {
    if (font.sfnt) {
      let hex = '';
      for (const ch of text) {
        const cp = ch.codePointAt(0)!;
        const gid = font.sfnt.gidFor(cp);
        font.gids.add(gid);
        if (!font.toUnicode.has(gid)) font.toUnicode.set(gid, cp);
        hex += gid.toString(16).padStart(4, '0');
      }
      return `<${hex}>`;
    }
    const std = this.base14(font);
    try { return std.encodeText(text).toString(); }
    catch { return std.encodeText(toWinAnsi(text)).toString(); }
  }

  // ── document metadata ───────────────────────────────────────────────────────

  setProperties(props: PdfMetaProperties): this {
    this.meta = { ...this.meta, ...props };
    return this;
  }

  /** Anything the render could not do, for the caller to put in the host log. */
  takeWarnings(): string[] {
    const out = this.warnings;
    this.warnings = [];
    return out;
  }

  // ── output ──────────────────────────────────────────────────────────────────

  async output(kind: 'blob' | 'arraybuffer' = 'blob'): Promise<Blob | ArrayBuffer> {
    // Built once: build() writes the page content and resource dictionaries into the
    // document, so a second run would register every image and font again.
    this.built ??= this.build();
    const bytes = await this.built;
    if (kind === 'arraybuffer') {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }
    return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  }

  private async build(): Promise<Uint8Array> {
    const { PDFName } = this.lib;
    const doc = this.doc;
    const ctx = doc.context;

    const creator = this.meta.creator || 'Lolly';
    doc.setProducer(creator);
    doc.setCreator(creator);
    if (this.meta.author) doc.setAuthor(this.meta.author);
    if (this.meta.title) doc.setTitle(this.meta.title);
    if (this.meta.subject) doc.setSubject(this.meta.subject);
    if (this.meta.keywords) doc.setKeywords([this.meta.keywords]);

    const imageRefs = new Map<string, PDFRef>();
    for (const [src] of this.images) imageRefs.set(src, await this.embedImage(src));

    // Only fonts a run actually drew with: a document whose text was all outlined
    // to paths carries no font object at all, which is what PDF/X wants to see.
    const drawn = new Set<string>();
    for (const page of this.pages) for (const key of page.fonts) drawn.add(key);
    const fontRefs = new Map<string, PDFRef>();
    for (const key of drawn) {
      const font = this.fonts.get(key);
      if (!font) continue;
      fontRefs.set(key, font.sfnt ? this.buildEmbeddedFont(font) : this.base14(font).ref);
    }

    const shadingRefs = new Map<string, PDFRef | null>();
    for (const [key, entry] of this.shadings) shadingRefs.set(key, buildShading(ctx, entry.pattern));

    const gstateRefs = new Map<string, PDFRef>();
    for (const [key, entry] of this.gstates) {
      gstateRefs.set(key, ctx.register(ctx.obj({
        Type: 'ExtGState', ca: entry.gs.opacity, CA: entry.gs.strokeOpacity,
      })));
    }

    for (const page of this.pages) {
      const resources: PdfResources = { ProcSet: ['PDF', 'Text', 'ImageB', 'ImageC', 'ImageI'] };
      collect(resources, 'Font', page.fonts, this.fonts, fontRefs);
      collect(resources, 'XObject', page.images, this.images, imageRefs);
      collect(resources, 'Shading', page.shadings, this.shadings, shadingRefs);
      collect(resources, 'ExtGState', page.gstates, this.gstates, gstateRefs);
      page.page.node.set(PDFName.of('Resources'), ctx.obj(resources));
      page.page.node.set(PDFName.of('Contents'), ctx.register(ctx.flateStream(page.ops.join('\n'))));
    }

    const bytes = await doc.save({ useObjectStreams: false });
    const enc = this.encryption;
    return enc?.userPassword
      ? encryptPdfRc4(bytes, enc.userPassword, enc.userPermissions ?? ['print'])
      : bytes;
  }

  private async embedImage(src: string): Promise<PDFRef> {
    const data = await bytesForSource(src);
    const bytes = data?.bytes;
    try {
      if (bytes && bytes.length > 3) {
        if (bytes[0] === 0x89 && bytes[1] === 0x50) return (await this.doc.embedPng(bytes)).ref;
        if (bytes[0] === 0xff && bytes[1] === 0xd8) return (await this.doc.embedJpg(bytes)).ref;
      }
      this.warnings.push(`pdf: an image could not be embedded (${data?.mime || 'unreadable source'}) and was left blank`);
    } catch (err) {
      this.warnings.push(`pdf: an image could not be embedded - ${(err as Error).message}`);
    }
    return (await this.doc.embedPng(BLANK_PNG)).ref;
  }

  /** The Type0 / CIDFontType2 object set for one embedded face. */
  private buildEmbeddedFont(font: FontEntry): PDFRef {
    const { PDFString } = this.lib;
    const ctx = this.doc.context;
    const sfnt = font.sfnt!;
    const scale = 1000 / sfnt.unitsPerEm;
    const subset = subsetSfnt(sfnt, font.gids);
    const fileRef = ctx.register(ctx.flateStream(subset, { Length1: subset.length }));

    const descriptor = ctx.register(ctx.obj({
      Type: 'FontDescriptor',
      FontName: sfnt.postScriptName,
      // 4 is the symbolic flag: an Identity-H run addresses glyphs directly, so
      // no standard encoding is being claimed. 64 adds the italic bit.
      Flags: 4 | (sfnt.italicAngle !== 0 || sfnt.italic ? 64 : 0),
      FontBBox: sfnt.bbox.map(v => Math.round(v * scale)),
      ItalicAngle: Math.round(sfnt.italicAngle),
      Ascent: Math.round(sfnt.ascent * scale),
      Descent: Math.round(sfnt.descent * scale),
      CapHeight: Math.round(sfnt.capHeight * scale),
      StemV: 80,
      FontFile2: fileRef,
    }));

    // Widths for the glyphs this document drew, in the compact [gid [w]] form.
    const widths: (number | number[])[] = [];
    for (const gid of [...font.gids].sort((a, b) => a - b)) {
      widths.push(gid, [Math.round(sfnt.advance(gid) * scale)]);
    }

    const descendant = ctx.register(ctx.obj({
      Type: 'Font',
      Subtype: 'CIDFontType2',
      BaseFont: sfnt.postScriptName,
      CIDSystemInfo: { Registry: PDFString.of('Adobe'), Ordering: PDFString.of('Identity'), Supplement: 0 },
      FontDescriptor: descriptor,
      DW: 1000,
      W: widths,
      CIDToGIDMap: 'Identity',
    }));

    return ctx.register(ctx.obj({
      Type: 'Font',
      Subtype: 'Type0',
      BaseFont: sfnt.postScriptName,
      Encoding: 'Identity-H',
      DescendantFonts: [descendant],
      ToUnicode: ctx.register(ctx.flateStream(buildToUnicode(font.toUnicode))),
    }));
  }
}

/** Build a document. Async so pdf-lib stays a lazy import. */
export async function createPdfDoc(opts: PdfDocOptions = {}): Promise<PdfDoc> {
  const lib = await import('pdf-lib');
  const doc = await lib.PDFDocument.create();
  return new PdfDoc(lib, doc, opts);
}

/** Add one resource category to a page's resource dictionary, when it used one. */
function collect(
  resources: PdfResources,
  category: string,
  used: Set<string>,
  registry: Map<string, { name: string }>,
  refs: Map<string, PDFRef | null>,
): void {
  if (!used.size) return;
  const dict: Record<string, PDFRef> = {};
  for (const key of used) {
    const entry = registry.get(key);
    const ref = refs.get(key);
    if (entry && ref) dict[entry.name] = ref;
  }
  if (Object.keys(dict).length) resources[category] = dict;
}

function normaliseFormat(format: [number, number], orientation?: 'portrait' | 'landscape'): [number, number] {
  let [w, h] = format;
  if (!(w > 0)) w = 1;
  if (!(h > 0)) h = 1;
  if (orientation === 'landscape' && h > w) return [h, w];
  if (orientation === 'portrait' && w > h) return [h, w];
  return [w, h];
}

function fontKey(name: string, style: string): string {
  return `${String(name).toLowerCase()}|${String(style).toLowerCase()}`;
}

/** Map the family + style a caller asks for onto one of the base-14 faces. */
function standardFontName(name: string, style: string): string {
  const s = String(style).toLowerCase();
  const bold = s.includes('bold');
  const italic = s.includes('italic') || s.includes('oblique');
  const family = String(name).toLowerCase();
  if (family.includes('courier') || family.includes('mono')) {
    return bold && italic ? 'CourierBoldOblique' : bold ? 'CourierBold' : italic ? 'CourierOblique' : 'Courier';
  }
  if (family.includes('times')) {
    return bold && italic ? 'TimesRomanBoldItalic' : bold ? 'TimesRomanBold' : italic ? 'TimesRomanItalic' : 'TimesRoman';
  }
  return bold && italic ? 'HelveticaBoldOblique' : bold ? 'HelveticaBold' : italic ? 'HelveticaOblique' : 'Helvetica';
}

/** Drop to the characters a base-14 font can actually paint. */
function toWinAnsi(text: string): string {
  let out = '';
  for (const ch of text) out += ch.codePointAt(0)! < 256 ? ch : '?';
  return out;
}

/** The CMap that lets a reader copy text back out of an embedded font run. */
function buildToUnicode(map: Map<number, number>): string {
  const entries = [...map.entries()].sort((a, b) => a[0] - b[0]);
  const hex4 = (v: number): string => v.toString(16).padStart(4, '0');
  const chunks: string[] = [];
  for (let i = 0; i < entries.length; i += 100) {
    const slice = entries.slice(i, i + 100);
    const body = slice.map(([gid, cp]) => {
      let value: string;
      if (cp > 0xffff) {
        const v = cp - 0x10000;
        value = `${hex4(0xd800 + (v >> 10))}${hex4(0xdc00 + (v & 0x3ff))}`;
      } else {
        value = hex4(cp);
      }
      return `<${hex4(gid)}> <${value}>`;
    }).join('\n');
    chunks.push(`${slice.length} beginbfchar\n${body}\nendbfchar`);
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    ...chunks,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
}

/** A gradient as a shading dictionary whose colour function keeps every stop exactly:
 *  one exponential (Type 2) function per stop pair, stitched (Type 3) at the stop
 *  offsets. A sampled table would blur a hard stop and move a stop that sits between
 *  samples; the stitching function reproduces the authored ramp at its real positions. */
function buildShading(ctx: PDFContext, pattern: PdfShadingPattern): PDFRef | null {
  const stops = [...pattern.colors].sort((a, b) => a.offset - b.offset);
  if (!stops.length) return null;
  if (stops[0]!.offset !== 0) stops.unshift({ offset: 0, color: stops[0]!.color });
  if (stops[stops.length - 1]!.offset !== 1) stops.push({ offset: 1, color: stops[stops.length - 1]!.color });
  const unit = (color: number[]): number[] => [0, 1, 2].map(c => Math.max(0, Math.min(1, (color[c] ?? 0) / 255)));
  const fns: PDFRef[] = [];
  const bounds: number[] = [];
  const encode: number[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    // Two stops at one offset are a hard edge: the next segment starts at b's colour,
    // so the zero-length segment adds nothing (and Bounds must strictly increase).
    if (b.offset <= a.offset) continue;
    fns.push(ctx.register(ctx.obj({ FunctionType: 2, Domain: [0, 1], C0: unit(a.color), C1: unit(b.color), N: 1 })));
    if (fns.length > 1) bounds.push(a.offset);
    encode.push(0, 1);
  }
  if (!fns.length) {
    const only = unit(stops[0]!.color);
    fns.push(ctx.register(ctx.obj({ FunctionType: 2, Domain: [0, 1], C0: only, C1: only, N: 1 })));
    encode.push(0, 1);
  }
  const fn = fns.length === 1
    ? fns[0]!
    : ctx.register(ctx.obj({ FunctionType: 3, Domain: [0, 1], Functions: fns, Bounds: bounds, Encode: encode }));
  return ctx.register(ctx.obj({
    ShadingType: pattern.type === 'axial' ? 2 : 3,
    ColorSpace: 'DeviceRGB',
    Coords: pattern.coords,
    Function: fn,
    Extend: [true, true],
  }));
}
