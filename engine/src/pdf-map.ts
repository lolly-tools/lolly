// SPDX-License-Identifier: MPL-2.0
/**
 * PDF (and Adobe Illustrator .ai — an .ai IS a PDF) page content stream → DesignNodes.
 *
 * The counterpart to design-map.ts's Figma/Penpot walkers, for the PDF import path.
 * An Illustrator .ai file saved with PDF compatibility (the default) is a normal PDF,
 * so both land here. The shell (design-import.js) owns the byte work — it uses pdf-lib
 * to load the document, decode the page's content stream(s), and pre-extract resources
 * (fonts → per-font byte→text decoders, XObjects → image markers or nested form streams,
 * ExtGStates → alpha, optional-content groups → layer labels). This module is PURE and
 * DOM-free: it tokenizes the already-decoded content string and interprets the graphics
 * operators into normalized `DesignNode`s that flow through the same `finalizeBoxes`
 * pipeline as every other importer, so a PDF/AI import is fully re-editable.
 *
 * Fidelity ladder (matches the SVG/Figma importers):
 *   • axis-aligned OR rotated rectangles + axis-aligned ellipses → editable box nodes
 *   • text runs (position + size + colour, grouped per BT/ET block) → editable text nodes
 *   • arbitrary filled/stroked paths → a `_vectorPath` (SVG `d`) the shell stores as a
 *     crisp SVG image — vector, not raster, and still one movable box
 *   • image XObjects → `_imageXObject` the shell resolves to a stored raster asset
 *   • groups → the box `group` field, captured from three PDF signals (Illustrator
 *     layers / optional-content groups, form XObjects, and q…Q blocks) and kept only
 *     where a group actually holds ≥2 items, so an imported group can be moved or
 *     ungrouped as a unit in the editor. Nested groups flatten to the innermost real
 *     group (the box model's `group` is a single flat id, not a hierarchy).
 *
 * Coordinate systems: PDF user space is bottom-left origin, y-up; the box model is
 * top-left, y-down. We seed the CTM with a flip matrix (d = -1, f = pageHeight) and bake
 * every path point through the current CTM at CONSTRUCTION time, so nodes land directly
 * in box space and are immune to CTM changes between path build and paint (q/Q).
 */

import { boxGeomFromBBox, safeColor } from './design-map.ts';

// ── types ────────────────────────────────────────────────────────────────────

/** A 2-D affine (PDF/SVG convention: point (x,y) → (a·x + c·y + e, b·x + d·y + f)). */
interface Mat { a: number; b: number; c: number; d: number; e: number; f: number; }

/** A normalized node — structurally the design-map `DesignNode` (feed to finalizeBoxes). */
export interface PdfNode {
  kind: 'box' | 'text' | 'image';
  x: number; y: number; w: number; h: number; rot: number;
  opacity?: number;
  shape?: string;
  radius?: number;
  fill?: string;
  fg?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  textAlign?: string;
  lineHeight?: number;
  text?: string;
  fit?: string;
  group?: string;
  _imageXObject?: string;
  _vectorPath?: string;
  _vectorFill?: string;
  /** PDF even-odd fill (the starred f/B operators) — REQUIRED for ring-shaped
   *  fills: an inner subpath is a hole only under this rule; nonzero would fill
   *  it solid. */
  _vectorFillRule?: 'evenodd';
  _vectorStroke?: { color: string; width: number } | null;
  _vectorViewBox?: { x: number; y: number; w: number; h: number };
  /** A text node's glyphs outlined to SVG path `d` strings, one per line (baseline
   *  at y=0, pen at x=0 — HarfBuzz's frame). Set by a shell that can shape text
   *  (pdf-import's outlineText hook); when present, pdf-svg emits real `<path>`
   *  outlines instead of a font-dependent `<text>`, so the SVG is self-contained
   *  and pixel-faithful without the recipient's fonts. */
  _outlinePath?: string[];
  /** Enclosing group ids, outermost→innermost (OCG layers / form XObjects / q…Q blocks).
   *  Resolved to the final flat `group` after the walk, then deleted. */
  _groupPath?: string[];
  /** Active clipping paths (outermost→innermost), baked into box space — the
   *  `W`/`W*` stack in force when this node painted. Print engines draw soft
   *  shadows as LARGE low-alpha shapes cut down by a clip; ignoring the clip
   *  renders them as giant plates. Serializers intersect these (pdf-svg emits
   *  nested <clipPath> wraps); the layout-import path may ignore them. */
  _clips?: ClipPath[];
  /** An axial/radial gradient fill (PDF ShadingType 2/3), resolved into box
   *  space. When present, pdf-svg emits a `<linearGradient>`/`<radialGradient>`
   *  and paints the node with it instead of the flat `fill`/`_vectorFill`. Set
   *  by a shading-pattern (`scn`) fill or the `sh` operator; the geometry stays
   *  in the shading's own coordinate space with `matrix` mapping it to box
   *  space (so any affine — incl. skew on a radial — is exact). */
  _gradient?: PdfGradient;
}

/** One clipping path in box space (`d` as an SVG path string). */
export interface ClipPath { d: string; evenOdd: boolean }

/** A colour stop along a gradient's parameter axis (offset 0..1, resolved to hex). */
export interface PdfGradientStop { offset: number; color: string }

/**
 * A normalized axial (type 2) or radial (type 3) shading — the shell resolves the
 * PDF /Function into a pre-sampled colour ramp (`stops`), so this pure module never
 * needs the PDF function machinery. Coords are in the shading's OWN space (before
 * the CTM / pattern matrix is applied):
 *   • type 2 (axial):  [x0, y0, x1, y1]        — the gradient axis endpoints
 *   • type 3 (radial): [x0, y0, r0, x1, y1, r1] — start circle → end circle
 */
export interface PdfShading {
  type: 2 | 3;
  coords: number[];
  stops: PdfGradientStop[];
  /** [extendStart, extendEnd] — paint beyond the axis with the end colours. */
  extend: [boolean, boolean];
}

/** A PDF Pattern resource. Only PatternType 2 (a shading pattern) is modelled;
 *  its /Matrix maps pattern space to the parent content stream's default space. */
export interface PdfPattern {
  shading?: PdfShading;
  /** Pattern /Matrix [a b c d e f] (default identity). */
  matrix?: number[];
}

/** A shading resolved into box space for emission — the shading's coords plus a
 *  box-space transform matrix (shading space → box space). */
export interface PdfGradient extends PdfShading {
  matrix: [number, number, number, number, number, number];
}

/** Byte codes → text. Provided per font by the shell (from ToUnicode / Encoding). */
export type FontDecoder = (codes: number[]) => string;

/**
 * A Type3 font: glyphs are per-character PDF content streams (vector drawing
 * procedures), not an embedded outline font. Chromium's printToPDF emits app text
 * this way, so executing the CharProcs is how a screenshot's text becomes real
 * `<path>` outlines of the EXACT glyphs it rendered — no font resolution, any face.
 */
export interface Type3Font {
  /** Glyph space → text space, [a b c d e f] (typically [0.001 0 0 ±0.001 0 0]). */
  fontMatrix: number[];
  /** Glyph name → decoded content-stream text (the drawing procedure). */
  charProcs: Record<string, string>;
  /** Byte code → glyph name (from /Encoding /Differences). */
  encoding: Record<number, string>;
  /** Byte code → advance width, in glyph space (scaled by fontMatrix). */
  widths: Record<number, number>;
  /** The font's own resources — CharProcs run against these. */
  resources: PdfResources;
}

export interface PdfFontInfo {
  /** Decode raw string bytes to text. Falls back to Latin-1 (fine for ASCII) if absent. */
  decode?: FontDecoder;
  /** Composite / Type0 (CID) fonts use 2-byte codes; simple fonts are 1 byte. */
  twoByte?: boolean;
  /** Family name (remapped onto the target tool's font vocabulary — see
   *  design-map.ts `mapFontFamily`/`DesignMapOptions`). */
  family?: string;
  /** A weight hint parsed from the font descriptor / name. */
  weight?: number | string;
  /** Present for Type3 fonts — text is drawn by executing these glyph procedures
   *  instead of emitting a font-dependent `<text>`. */
  type3?: Type3Font;
}

export interface PdfResources {
  fonts?: Record<string, PdfFontInfo>;
  xobjects?: Record<string, PdfXObject>;
  /** ExtGState name → { fill alpha ca, stroke alpha CA }. */
  extgstates?: Record<string, { ca?: number; CA?: number }>;
  /** Marked-content property name (e.g. "MC0") → optional-content group label. */
  ocgs?: Record<string, string>;
  /** Shading name → normalized axial/radial shading (for the `sh` operator). */
  shadings?: Record<string, PdfShading>;
  /** Pattern name → pattern (PatternType 2 shading patterns, for `scn` fills). */
  patterns?: Record<string, PdfPattern>;
}

export interface PdfXObject {
  kind: 'image' | 'form';
  /** image only: an opaque, globally-unique id the shell resolves to stored bytes.
   *  Form-nested images can share local names, so the node carries this, not the name. */
  imageKey?: string;
  /** form only: decoded content stream. */
  content?: string;
  /** form only: the form's /Matrix [a b c d e f]. */
  matrix?: number[];
  /** form only: the form's own resources (nested). */
  resources?: PdfResources;
}

export interface PdfPageInput extends PdfResources {
  content: string;
  /** MediaBox width / height, in points. */
  width: number;
  height: number;
  /** MediaBox lower-left origin (usually 0,0; AI artboards can offset it). */
  originX?: number;
  originY?: number;
}

// ── small helpers ─────────────────────────────────────────────────────────────

function clamp(v: number, a: number, b: number): number { return v < a ? a : (v > b ? b : v); }
function clamp255(v: number): number { return clamp(Math.round(v * 255), 0, 255); }
function hx(v: number): string { return clamp255(v).toString(16).padStart(2, '0'); }
function rgbHex(r: number, g: number, b: number): string { return '#' + hx(r) + hx(g) + hx(b); }

const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Compose P ∘ C: transform(P∘C, p) = transform(P, transform(C, p)). */
function matMul(P: Mat, C: Mat): Mat {
  return {
    a: P.a * C.a + P.c * C.b,
    b: P.b * C.a + P.d * C.b,
    c: P.a * C.c + P.c * C.d,
    d: P.b * C.c + P.d * C.d,
    e: P.a * C.e + P.c * C.f + P.e,
    f: P.b * C.e + P.d * C.f + P.f,
  };
}
function apply(m: Mat, x: number, y: number): { x: number; y: number } {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}
/** A PDF operand matrix [a b c d e f] → our Mat. */
function fromArr(a: number[]): Mat {
  return { a: a[0] || 0, b: a[1] || 0, c: a[2] || 0, d: a[3] || 0, e: a[4] || 0, f: a[5] || 0 };
}
/** Uniform-ish scale magnitude of a matrix (used for effective font size / line width). */
function scaleMag(m: Mat): number {
  const sx = Math.hypot(m.a, m.b), sy = Math.hypot(m.c, m.d);
  return (sx + sy) / 2 || 1;
}
function rotationOf(m: Mat): number { return Math.atan2(m.b, m.a) * 180 / Math.PI; }

// ── tokenizer ────────────────────────────────────────────────────────────────

type Tok =
  | { t: 'num'; v: number }
  | { t: 'name'; v: string }
  | { t: 'str'; v: number[] }      // string operand as raw byte codes
  | { t: 'arr'; v: Tok[] }         // for TJ
  | { t: 'op'; v: string };

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set('()<>[]{}/%'.split('').map((c) => c.charCodeAt(0)));

/**
 * Tokenize a content stream. Operates on Latin-1 char codes so binary string bytes
 * survive. Inline images (BI … ID … EI) are skipped wholesale — their binary payload
 * isn't token-structured and we don't import them.
 */
function tokenize(src: string): Tok[] {
  const n = src.length;
  const out: Tok[] = [];
  let i = 0;
  const code = (k: number): number => src.charCodeAt(k);

  const readString = (): number[] => {
    const bytes: number[] = [];
    let depth = 0;
    i++; // skip '('
    while (i < n) {
      const c = code(i);
      if (c === 0x5c) { // backslash escape
        i++;
        const e = code(i);
        if (e === 0x6e) bytes.push(0x0a);
        else if (e === 0x72) bytes.push(0x0d);
        else if (e === 0x74) bytes.push(0x09);
        else if (e === 0x62) bytes.push(0x08);
        else if (e === 0x66) bytes.push(0x0c);
        else if (e >= 0x30 && e <= 0x37) { // octal \ddd
          let oct = '';
          for (let k = 0; k < 3 && code(i) >= 0x30 && code(i) <= 0x37; k++) { oct += src[i]; i++; }
          bytes.push(parseInt(oct, 8) & 0xff);
          continue;
        } else if (e === 0x0a) { /* line continuation */ }
        else if (e === 0x0d) { if (code(i + 1) === 0x0a) i++; }
        else bytes.push(e);
        i++;
      } else if (c === 0x28) { depth++; bytes.push(c); i++; }
      else if (c === 0x29) { if (depth === 0) { i++; break; } depth--; bytes.push(c); i++; }
      else { bytes.push(c); i++; }
    }
    return bytes;
  };

  const readHexString = (): number[] => {
    const bytes: number[] = [];
    i++; // skip '<'
    let hi = '';
    while (i < n) {
      const c = code(i);
      if (c === 0x3e) { i++; break; }
      if (WS.has(c)) { i++; continue; }
      hi += src[i]; i++;
      if (hi.length === 2) { bytes.push(parseInt(hi, 16) & 0xff); hi = ''; }
    }
    if (hi.length === 1) bytes.push(parseInt(hi + '0', 16) & 0xff);
    return bytes;
  };

  const readName = (): string => {
    i++; // skip '/'
    let s = '';
    while (i < n) {
      const c = code(i);
      if (WS.has(c) || DELIM.has(c)) break;
      if (c === 0x23) { s += String.fromCharCode(parseInt(src.substr(i + 1, 2), 16) || 0); i += 3; }
      else { s += src[i]; i++; }
    }
    return s;
  };

  const readNumberOrOp = (): Tok | null => {
    let s = '';
    while (i < n) {
      const c = code(i);
      if (WS.has(c) || DELIM.has(c)) break;
      s += src[i]; i++;
    }
    if (s === '') return null;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return { t: 'num', v: parseFloat(s) };
    return { t: 'op', v: s };
  };

  const skipDict = (): void => {
    let depth = 0;
    while (i < n) {
      if (code(i) === 0x3c && code(i + 1) === 0x3c) { depth++; i += 2; continue; }
      if (code(i) === 0x3e && code(i + 1) === 0x3e) { depth--; i += 2; if (depth <= 0) break; continue; }
      i++;
    }
  };

  // Real TJ arrays never nest; a hostile stream of thousands of `[` must not
  // recurse the readArray ↔ readOne pair into a stack overflow. Past the cap
  // the array body is consumed iteratively (strings/dicts skipped whole so a
  // bracket inside them can't unbalance the count) and dropped.
  const MAX_ARRAY_DEPTH = 16;
  let arrayDepth = 0;

  const skipArrayBody = (): void => {
    let depth = 1;
    while (i < n && depth > 0) {
      const c = code(i);
      if (c === 0x28) { readString(); continue; }
      if (c === 0x3c && code(i + 1) === 0x3c) { skipDict(); continue; }
      if (c === 0x5b) depth++;
      else if (c === 0x5d) depth--;
      i++;
    }
  };

  const readArray = (): Tok[] => {
    i++; // skip '['
    if (arrayDepth >= MAX_ARRAY_DEPTH) { skipArrayBody(); return []; }
    arrayDepth++;
    const items: Tok[] = [];
    while (i < n) {
      const c = code(i);
      if (WS.has(c)) { i++; continue; }
      if (c === 0x5d) { i++; break; }
      const tk = readOne();
      if (tk) items.push(tk); else if (i < n && code(i) !== 0x5d) i++;
    }
    arrayDepth--;
    return items;
  };

  function readOne(): Tok | null {
    const c = code(i);
    if (c === 0x2f) return { t: 'name', v: readName() };
    if (c === 0x28) return { t: 'str', v: readString() };
    if (c === 0x3c) {
      if (code(i + 1) === 0x3c) { skipDict(); return { t: 'op', v: '<<>>' }; }
      return { t: 'str', v: readHexString() };
    }
    if (c === 0x5b) return { t: 'arr', v: readArray() };
    if (c === 0x5d) { i++; return null; }
    return readNumberOrOp();
  }

  const skipInlineImage = (): void => {
    while (i < n) { if (src[i] === 'I' && src[i + 1] === 'D') { i += 2; break; } i++; }
    while (i < n) { if (src[i] === 'E' && src[i + 1] === 'I' && (i + 2 >= n || WS.has(code(i + 2)))) { i += 2; break; } i++; }
  };

  while (i < n) {
    const c = code(i);
    if (WS.has(c)) { i++; continue; }
    if (c === 0x25) { while (i < n && code(i) !== 0x0a && code(i) !== 0x0d) i++; continue; }
    const before = i;
    const tk = readOne();
    if (tk) {
      if (tk.t === 'op' && tk.v === 'BI') { skipInlineImage(); continue; }
      out.push(tk);
    }
    if (i === before) i++; // never stall
  }
  return out;
}

// ── graphics state ──────────────────────────────────────────────────────────

interface GState {
  ctm: Mat;
  fill: string;
  stroke: string;
  fillAlpha: number;
  strokeAlpha: number;
  lineWidth: number;
  font: string;
  fontSize: number;
  leading: number;
  /** Active clip stack. COPY-ON-WRITE — cloneState shares the array, so append
   *  via `s.clips = [...s.clips, c]`, never mutate in place. */
  clips: ClipPath[];
  /** A pending gradient fill (a shading-pattern selected via `scn`), already
   *  resolved to box space. Cleared whenever a solid fill colour is set. */
  fillGradient: FillGradient | null;
}
function cloneState(s: GState): GState { return { ...s }; }

/** A gradient selected as the current fill — the shading plus its box-space matrix. */
interface FillGradient extends PdfShading { mat: Mat; }
/** Snapshot a live fill gradient onto a node (matrix as a plain array). */
function nodeGradient(g: FillGradient): PdfGradient {
  const m = g.mat;
  return { type: g.type, coords: g.coords, stops: g.stops, extend: g.extend, matrix: [m.a, m.b, m.c, m.d, m.e, m.f] };
}

/** A path segment already baked into box space. */
interface Seg { op: 'm' | 'l' | 'c'; pts: number[]; }

// ── interpreter ────────────────────────────────────────────────────────────

/**
 * Interpret one page's content stream into DesignNodes (paint order, back-to-front).
 * @param page decoded content + MediaBox size + pre-extracted resources.
 * @returns DesignNodes for `finalizeBoxes(nodes, { prefix: 'p' })`.
 */
export function interpretPdfPage(page: PdfPageInput): PdfNode[] {
  const nodes: PdfNode[] = [];
  const flip: Mat = { a: 1, b: 0, c: 0, d: -1, e: -(page.originX || 0), f: (page.originY || 0) + (page.height || 0) };
  let count = 0;
  let gseq = 0;   // unique id generator for q…Q + form-XObject group frames (shared across runs)
  const MAX = 4000;

  const run = (content: string, res: PdfResources, baseCtm: Mat, depth: number, parentGroups: string[], baseClips: ClipPath[] = [], baseFill = ''): void => {
    if (depth > 12) return;
    const toks = tokenize(content || '');
    let s: GState = {
      ctm: baseCtm, fill: baseFill, stroke: '', fillAlpha: 1, strokeAlpha: 1, lineWidth: 1,
      font: '', fontSize: 0, leading: 0, clips: baseClips, fillGradient: null,
    };
    const stack: GState[] = [];

    // `W`/`W*` marks the CURRENT path as a pending clip; it takes effect at the
    // path's terminating paint/no-op operator (usually `re W n`).
    let pendingClip: false | 'nonzero' | 'evenodd' = false;
    const applyPendingClip = (): void => {
      if (pendingClip && segs.length) {
        const baked = serializePath(segs);
        if (baked.d) s.clips = [...s.clips, { d: baked.d, evenOdd: pendingClip === 'evenodd' }];
      }
      pendingClip = false;
    };

    // Current path, baked into box space at construction time.
    let segs: Seg[] = [];
    let cxU = 0, cyU = 0, startXU = 0, startYU = 0;         // last point, USER space (for v/y/h)

    // Group frames: q…Q blocks and OCG/marked-content each push a frame (an id, or '' for a
    // non-group marker) that any node emitted inside inherits. Properly nested per PDF spec,
    // so one LIFO stack is enough. gpath() is the full outer→inner id path for a node.
    const gstack: string[] = [];
    const gpath = (): string[] => {
      const out = parentGroups.slice();
      for (const id of gstack) if (id) out.push(id);
      return out;
    };

    // Text accumulation (per BT/ET block).
    let tm: Mat = IDENTITY, tlm: Mat = IDENTITY;
    let textBuf = '';
    let originSet = false;
    let origin = { x: 0, y: 0 };
    let textSize = 0, textRot = 0, textFill = '', textFont = '';
    let lastLineY = 0;

    let args: number[] = [];
    let nameArg = '';
    let strArg: number[] | null = null;
    let arrArg: Tok[] | null = null;
    const reset = (): void => { args = []; nameArg = ''; strArg = null; arrArg = null; };

    const push = (x: number, y: number, op: Seg['op'], extra?: number[]): void => {
      const p = apply(s.ctm, x, y);
      if (op === 'c' && extra) {
        const c1 = apply(s.ctm, extra[0]!, extra[1]!);
        const c2 = apply(s.ctm, extra[2]!, extra[3]!);
        segs.push({ op: 'c', pts: [c1.x, c1.y, c2.x, c2.y, p.x, p.y] });
      } else {
        segs.push({ op, pts: [p.x, p.y] });
      }
    };

    const decodeStr = (codes: number[], fontName: string): string => {
      const fi = res.fonts && res.fonts[fontName];
      if (fi && typeof fi.decode === 'function') { try { return fi.decode(codes); } catch { /* fall through */ } }
      if (fi && fi.twoByte) return ' '.repeat(Math.max(1, Math.ceil(codes.length / 2)));
      let outS = '';
      for (const c of codes) outS += String.fromCharCode(c);
      return outS;
    };

    const onTextMove = (): void => {
      const trm = matMul(s.ctm, tm);
      const p = apply(trm, 0, 0);
      if (!originSet) {
        origin = p; originSet = true;
        textSize = Math.max(1, (s.fontSize || 1) * scaleMag(matMul(s.ctm, { ...tm, e: 0, f: 0 })));
        textRot = rotationOf(trm);
        textFill = s.fill; textFont = s.font;
        lastLineY = p.y;
      } else {
        if (p.y - lastLineY > textSize * 0.35 && textBuf && !textBuf.endsWith('\n')) textBuf += '\n';
        lastLineY = p.y;
      }
    };

    // Type3: draw each code's glyph procedure at the pen (the live text matrix
    // `tm`), then advance `tm` by the glyph width — so subsequent shows continue
    // from the right place. The glyph's fills inherit the text fill colour (d1
    // glyphs are uncoloured). `tm` doubles as the pen: a following Td/Tm resets it.
    const drawType3 = (codes: number[], t3: Type3Font): void => {
      if (!codes.length || count >= MAX) return;
      const fm = t3.fontMatrix;
      const fmMat: Mat = { a: fm[0] ?? 0.001, b: fm[1] ?? 0, c: fm[2] ?? 0, d: fm[3] ?? 0.001, e: fm[4] ?? 0, f: fm[5] ?? 0 };
      const scale: Mat = { a: s.fontSize || 1, b: 0, c: 0, d: s.fontSize || 1, e: 0, f: 0 };
      const gid = 'g' + (++gseq);
      for (const code of codes) {
        const proc = t3.encoding[code] ? t3.charProcs[t3.encoding[code]!] : undefined;
        if (proc && count < MAX) {
          const glyphCtm = matMul(matMul(matMul(s.ctm, tm), scale), fmMat);
          run(proc, t3.resources, glyphCtm, depth + 1, [...gpath(), gid], s.clips, s.fill);
        }
        const adv = (t3.widths[code] ?? 0) * (fm[0] ?? 0.001) * (s.fontSize || 0);
        tm = matMul(tm, { a: 1, b: 0, c: 0, d: 1, e: adv, f: 0 });
      }
    };

    const showString = (codes: number[] | null): void => {
      if (!codes || !codes.length) return;
      const fi = res.fonts && res.fonts[s.font];
      if (fi?.type3) { drawType3(codes, fi.type3); return; }
      if (!originSet) onTextMove();
      textBuf += decodeStr(codes, s.font);
    };
    const showTJ = (arr: Tok[] | null): void => {
      if (!Array.isArray(arr)) return;
      const fi = res.fonts && res.fonts[s.font];
      if (fi?.type3) {
        // Each string segment draws glyphs; a numeric adjustment shifts the pen
        // left by amount/1000 of the font size (PDF TJ semantics).
        for (const el of arr) {
          if (el.t === 'str') drawType3(el.v, fi.type3);
          else if (el.t === 'num') tm = matMul(tm, { a: 1, b: 0, c: 0, d: 1, e: -(el.v / 1000) * (s.fontSize || 0), f: 0 });
        }
        return;
      }
      if (!originSet) onTextMove();
      for (const el of arr) {
        if (el.t === 'str') textBuf += decodeStr(el.v, s.font);
        else if (el.t === 'num' && el.v <= -180) textBuf += ' ';
      }
    };
    const flushText = (): void => {
      const txt = textBuf.replace(/[ \t]+\n/g, '\n').replace(/\s+$/g, '');
      if (originSet && txt.trim() && count < MAX) {
        const size = Math.max(1, textSize);
        nodes.push({
          kind: 'text',
          x: origin.x, y: origin.y - size * 0.8,
          w: Math.max(4, txt.replace(/\n.*/s, '').length * size * 0.55, size * 2), h: size * 1.4 * (txt.split('\n').length),
          rot: Math.abs(textRot) < 0.5 ? 0 : textRot,
          fg: safeColor(textFill, '#000000') || '#000000',
          fontSize: size,
          fontFamily: (res.fonts && res.fonts[textFont] && res.fonts[textFont]!.family) || '',
          fontWeight: (res.fonts && res.fonts[textFont] && res.fonts[textFont]!.weight) || 400,
          text: txt,
          _groupPath: gpath(),
          ...(s.clips.length ? { _clips: s.clips } : {}),
        });
        count++;
      }
      textBuf = ''; originSet = false;
    };

    const paintPath = (mode: 'fill' | 'stroke' | 'both', evenOdd = false): void => {
      if (!segs.length || count >= MAX) { segs = []; return; }
      const fillCol = (mode === 'stroke') ? '' : s.fill;
      const strokeCol = (mode === 'fill') ? '' : s.stroke;
      const grad = (mode === 'stroke') ? null : s.fillGradient;
      const gradExtra = grad ? { _gradient: nodeGradient(grad) } : {};
      const alpha = clamp(Math.round((mode === 'stroke' ? s.strokeAlpha : s.fillAlpha) * 100), 0, 100);

      const clip = s.clips.length ? { _clips: s.clips } : {};
      // The rect/ellipse fast paths only apply to a SINGLE subpath: a multi-
      // subpath fill (e.g. a shadow ring = outer + inner circle under even-odd)
      // must stay a real path or the inner subpath's hole is lost. A gradient
      // fill (empty `fill`, `_gradient` set) still takes them — a hero gradient
      // is almost always a plain rect.
      const subpaths = segs.reduce((c2, sg) => c2 + (sg.op === 'm' ? 1 : 0), 0);
      if ((fillCol || grad) && mode !== 'stroke' && subpaths === 1) {
        const rect = asRectangle(segs);
        if (rect) {
          nodes.push({ kind: 'box', x: rect.x, y: rect.y, w: rect.w, h: rect.h, rot: rect.rot,
            fill: fillCol ? safeColor(fillCol, '') : '', opacity: alpha, shape: 'rect', _groupPath: gpath(), ...clip, ...gradExtra });
          count++; segs = []; return;
        }
        const ell = asEllipse(segs);
        if (ell) {
          nodes.push({ kind: 'box', x: ell.x, y: ell.y, w: ell.w, h: ell.h, rot: 0,
            fill: fillCol ? safeColor(fillCol, '') : '', opacity: alpha, shape: 'ellipse', _groupPath: gpath(), ...clip, ...gradExtra });
          count++; segs = []; return;
        }
      }

      const baked = serializePath(segs);
      // A stroked straight line is degenerate in one axis but its stroke width
      // gives it real area — floor its box at 1 so it isn't dropped (icon glyphs
      // print as individual `m l S` segments). A FILL only needs positive extent:
      // a thin glyph stem (an 'i', an 'l' at a small size) is ~0.5px wide, so a
      // 1px floor would drop it — Type3 text is filled glyphs, so admit anything
      // with real area and reject only sub-pixel noise.
      const bw = strokeCol ? Math.max(baked.w, 1) : baked.w;
      const bh = strokeCol ? Math.max(baked.h, 1) : baked.h;
      const minDim = strokeCol ? 1 : 0.06;
      if (bw >= minDim && bh >= minDim) {
        nodes.push({
          kind: 'image', x: baked.x, y: baked.y, w: bw, h: bh, rot: 0, fit: 'fill', opacity: alpha,
          _vectorPath: baked.d,
          _vectorFill: fillCol ? safeColor(fillCol, 'none') : 'none',
          _vectorStroke: strokeCol ? { color: safeColor(strokeCol, '#000000'), width: Math.max(0.3, s.lineWidth * scaleMag(s.ctm)) } : null,
          _vectorViewBox: { x: baked.x, y: baked.y, w: baked.w, h: baked.h },
          _groupPath: gpath(),
          ...clip,
          ...(evenOdd ? { _vectorFillRule: 'evenodd' as const } : {}),
          ...gradExtra,
        });
        count++;
      }
      segs = [];
    };

    for (const tk of toks) {
      if (tk.t === 'num') { args.push(tk.v); continue; }
      if (tk.t === 'name') { nameArg = tk.v; continue; }
      if (tk.t === 'str') { strArg = tk.v; continue; }
      if (tk.t === 'arr') { arrArg = tk.v; continue; }
      if (tk.t !== 'op') continue;

      switch (tk.v) {
        case 'q': stack.push(cloneState(s)); gstack.push('g' + (++gseq)); break;
        case 'Q': if (stack.length) s = stack.pop()!; if (gstack.length) gstack.pop(); break;
        case 'cm': if (args.length >= 6) s.ctm = matMul(s.ctm, fromArr(args)); break;
        case 'w': s.lineWidth = args[0] ?? s.lineWidth; break;
        case 'gs': {
          const g = res.extgstates && res.extgstates[nameArg];
          if (g) { if (typeof g.ca === 'number') s.fillAlpha = g.ca; if (typeof g.CA === 'number') s.strokeAlpha = g.CA; }
          break;
        }
        case 'rg': s.fill = rgbHex(args[0]!, args[1]!, args[2]!); s.fillGradient = null; break;
        case 'RG': s.stroke = rgbHex(args[0]!, args[1]!, args[2]!); break;
        case 'g': s.fill = rgbHex(args[0]!, args[0]!, args[0]!); s.fillGradient = null; break;
        case 'G': s.stroke = rgbHex(args[0]!, args[0]!, args[0]!); break;
        case 'k': s.fill = cmykHex(args); s.fillGradient = null; break;
        case 'K': s.stroke = cmykHex(args); break;
        // sc/scn: numeric operands → a real colour; a pattern NAME → a shading
        // pattern (PatternType 2) becomes a gradient fill, else a pattern we can't
        // reproduce (a tiling/shading pattern, e.g. the checkerboard pasteboard) —
        // CLEAR the paint in that case rather than let it inherit the previous fill,
        // since a stale colour (often black) would flood the pattern-filled shape.
        // An uncoloured pattern (PaintType 2) carries its tint in the numeric
        // operands, which scColor already resolves.
        case 'sc': case 'scn': {
          const pat = nameArg && res.patterns ? res.patterns[nameArg] : undefined;
          if (pat?.shading && (pat.shading.type === 2 || pat.shading.type === 3)) {
            const pm = matMul(baseCtm, fromArr(pat.matrix && pat.matrix.length >= 6 ? pat.matrix : [1, 0, 0, 1, 0, 0]));
            s.fillGradient = { ...pat.shading, mat: pm };
            s.fill = '';
          } else {
            const col = scColor(args);
            if (col) { s.fill = col; s.fillGradient = null; }
            else if (nameArg) { s.fill = ''; s.fillGradient = null; }
          }
          break;
        }
        case 'SC': case 'SCN': { const col = scColor(args); if (col) s.stroke = col; else if (nameArg) s.stroke = ''; break; }
        case 'cs': case 'CS': break;

        // `sh` paints a shading across the current clip. We only emit it when a clip
        // is in force (the normal case — Chromium clips a gradient to its element
        // box): a page-sized gradient rect cropped by the clip. Unclipped `sh` is
        // rare and can't be bounded here (extend:false paints only the axis extent,
        // not the page), so it's skipped rather than risk flooding the page.
        case 'sh': {
          const sd = res.shadings && res.shadings[nameArg];
          if (sd && (sd.type === 2 || sd.type === 3) && s.clips.length && count < MAX) {
            nodes.push({
              kind: 'box', x: 0, y: 0, w: page.width || 0, h: page.height || 0, rot: 0, shape: 'rect',
              fill: '', opacity: clamp(Math.round(s.fillAlpha * 100), 0, 100),
              _gradient: nodeGradient({ ...sd, mat: s.ctm }),
              _groupPath: gpath(),
              _clips: s.clips,
            });
            count++;
          }
          break;
        }

        case 'm': cxU = startXU = args[0]!; cyU = startYU = args[1]!; push(args[0]!, args[1]!, 'm'); break;
        case 'l': cxU = args[0]!; cyU = args[1]!; push(args[0]!, args[1]!, 'l'); break;
        case 'c': push(args[4]!, args[5]!, 'c', [args[0]!, args[1]!, args[2]!, args[3]!]); cxU = args[4]!; cyU = args[5]!; break;
        case 'v': push(args[2]!, args[3]!, 'c', [cxU, cyU, args[0]!, args[1]!]); cxU = args[2]!; cyU = args[3]!; break;
        case 'y': push(args[2]!, args[3]!, 'c', [args[0]!, args[1]!, args[2]!, args[3]!]); cxU = args[2]!; cyU = args[3]!; break;
        case 're': {
          const x = args[0]!, y = args[1]!, w = args[2]!, h = args[3]!;
          push(x, y, 'm'); push(x + w, y, 'l'); push(x + w, y + h, 'l'); push(x, y + h, 'l'); push(x, y, 'l');
          cxU = startXU = x; cyU = startYU = y;
          break;
        }
        case 'h': if (segs.length) { push(startXU, startYU, 'l'); cxU = startXU; cyU = startYU; } break;

        // A pending W/W* applies at the path's terminating operator. Applying it
        // just BEFORE the paint deviates from the spec by one op (the painted
        // path self-clips — a no-op, a path clipped by itself is itself) and
        // keeps the common `re W n` clip-only sequence exact.
        case 'f': case 'F': applyPendingClip(); paintPath('fill'); break;
        case 'f*': applyPendingClip(); paintPath('fill', true); break;
        case 'S': case 's': applyPendingClip(); paintPath('stroke'); break;
        case 'B': case 'b': applyPendingClip(); paintPath('both'); break;
        case 'B*': case 'b*': applyPendingClip(); paintPath('both', true); break;
        case 'n': applyPendingClip(); segs = []; break;
        case 'W': pendingClip = 'nonzero'; break;
        case 'W*': pendingClip = 'evenodd'; break;

        case 'BT': tm = IDENTITY; tlm = IDENTITY; textBuf = ''; originSet = false; break;
        case 'ET': flushText(); break;
        case 'TL': s.leading = args[0] ?? 0; break;
        case 'Tf': s.font = nameArg; s.fontSize = args[0] ?? s.fontSize; break;
        case 'Td': tlm = matMul(tlm, { a: 1, b: 0, c: 0, d: 1, e: args[0] ?? 0, f: args[1] ?? 0 }); tm = tlm; onTextMove(); break;
        case 'TD': s.leading = -(args[1] ?? 0); tlm = matMul(tlm, { a: 1, b: 0, c: 0, d: 1, e: args[0] ?? 0, f: args[1] ?? 0 }); tm = tlm; onTextMove(); break;
        case 'Tm': tlm = fromArr(args); tm = tlm; onTextMove(); break;
        case 'T*': tlm = matMul(tlm, { a: 1, b: 0, c: 0, d: 1, e: 0, f: -s.leading }); tm = tlm; onTextMove(); break;
        case 'Tj': showString(strArg); break;
        case "'": tlm = matMul(tlm, { a: 1, b: 0, c: 0, d: 1, e: 0, f: -s.leading }); tm = tlm; onTextMove(); showString(strArg); break;
        case '"': tlm = matMul(tlm, { a: 1, b: 0, c: 0, d: 1, e: 0, f: -s.leading }); tm = tlm; onTextMove(); showString(strArg); break;
        case 'TJ': showTJ(arrArg); break;

        case 'Do': {
          const xo = res.xobjects && res.xobjects[nameArg];
          if (xo && xo.kind === 'image' && count < MAX) {
            const geom = boxGeomFromBBox({ x: 0, y: 0, width: 1, height: 1 }, s.ctm);
            nodes.push({ kind: 'image', x: geom.x, y: geom.y, w: geom.w, h: geom.h, rot: geom.rot,
              fit: 'fill', opacity: clamp(Math.round(s.fillAlpha * 100), 0, 100), _imageXObject: xo.imageKey || nameArg, _groupPath: gpath(),
              ...(s.clips.length ? { _clips: s.clips } : {}) });
            count++;
          } else if (xo && xo.kind === 'form') {
            const fm = (xo.matrix && xo.matrix.length >= 6) ? matMul(s.ctm, fromArr(xo.matrix)) : s.ctm;
            // A form XObject is a natural group of its contents — inheriting the
            // caller's clip stack, exactly like its graphics state.
            run(xo.content || '', xo.resources || {}, fm, depth + 1, [...gpath(), 'g' + (++gseq)], s.clips);
          }
          break;
        }

        // Marked content pushes a frame too (an OCG layer id, or '' for a non-group marker)
        // so it nests correctly with the q…Q frames on the same stack.
        case 'BDC': case 'BMC': gstack.push(ocgLabel(tk.v, nameArg, res)); break;
        case 'EMC': if (gstack.length) gstack.pop(); break;
        default: break;
      }
      reset();
    }
    flushText(); // in case ET was omitted
  };

  run(page.content || '', page, flip, 0, []);

  // Resolve each node's group: the innermost enclosing frame that actually holds ≥2 nodes
  // wins (so a q…Q wrapper around a single item, or a one-object layer, doesn't become a
  // group), else ungrouped. Flat single id — nested groups collapse to the tightest real one.
  const counts = new Map<string, number>();
  for (const nd of nodes) for (const id of (nd._groupPath ?? [])) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const nd of nodes) {
    const path = nd._groupPath ?? [];
    let g = '';
    for (let k = path.length - 1; k >= 0; k--) {
      const id = path[k]!;
      if ((counts.get(id) ?? 0) >= 2) { g = id; break; }
    }
    if (g) nd.group = g;
    delete nd._groupPath;
  }
  return nodes;
}

// ── colour helpers ───────────────────────────────────────────────────────────

function cmykHex(a: number[]): string {
  const c = a[0] || 0, m = a[1] || 0, y = a[2] || 0, k = a[3] || 0;
  return rgbHex((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k));
}
/** sc/scn with numeric operands: 1 → gray, 3 → rgb, 4 → cmyk. Patterns (a name) → null. */
function scColor(a: number[]): string | null {
  if (a.length === 1) return rgbHex(a[0]!, a[0]!, a[0]!);
  if (a.length === 3) return rgbHex(a[0]!, a[1]!, a[2]!);
  if (a.length >= 4) return cmykHex(a);
  return null;
}

// ── path classification (all points already in box space) ─────────────────────

type Pt = [number, number];

/** Distinct corners of a single-subpath polygon (drops the closing duplicate). */
function polyCorners(segs: Seg[]): Pt[] | null {
  const pts: Pt[] = [];
  for (const sg of segs) {
    if (sg.op === 'c') return null;
    if (sg.op === 'm' && pts.length) return null; // multiple subpaths
    pts.push([sg.pts[0]!, sg.pts[1]!]);
  }
  if (pts.length >= 2) {
    const f = pts[0]!, l = pts[pts.length - 1]!;
    if (Math.abs(f[0] - l[0]) < 0.01 && Math.abs(f[1] - l[1]) < 0.01) pts.pop();
  }
  return pts;
}

/** A rectangle (axis-aligned OR rotated) → centre-anchored box rect + rotation, else null. */
function asRectangle(segs: Seg[]): { x: number; y: number; w: number; h: number; rot: number } | null {
  const c = polyCorners(segs);
  if (!c || c.length !== 4) return null;
  const p0 = c[0]!, p1 = c[1]!, p2 = c[2]!, p3 = c[3]!;
  const sub = (a: Pt, b: Pt): Pt => [b[0] - a[0], b[1] - a[1]];
  const len = (v: Pt): number => Math.hypot(v[0], v[1]);
  const dot = (u: Pt, v: Pt): number => u[0] * v[0] + u[1] * v[1];
  const e0 = sub(p0, p1), e1 = sub(p1, p2), e2 = sub(p2, p3), e3 = sub(p3, p0);
  const l0 = len(e0), l1 = len(e1), l2 = len(e2), l3 = len(e3);
  if (l0 < 0.5 || l1 < 0.5) return null;
  const tol = 0.03 * Math.max(l0, l1);
  if (Math.abs(l0 - l2) > tol || Math.abs(l1 - l3) > tol) return null;   // opposite sides equal
  if (Math.abs(dot(e0, e1)) > tol * Math.max(l0, l1)) return null;        // right angle at corner 1

  // Axis-aligned (every edge horizontal or vertical, incl. a 90°-traced rect) → the clean
  // unrotated AABB, so a plain rectangle never imports as a needlessly rotated box.
  const edges = [e0, e1, e2, e3];
  const axisAligned = edges.every((v) => Math.abs(v[0]) < tol || Math.abs(v[1]) < tol);
  const xs = [p0[0], p1[0], p2[0], p3[0]], ys = [p0[1], p1[1], p2[1], p3[1]];
  if (axisAligned) {
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY, rot: 0 };
  }

  const cx = (p0[0] + p1[0] + p2[0] + p3[0]) / 4;
  const cy = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
  const rot = Math.atan2(e0[1], e0[0]) * 180 / Math.PI;
  return { x: cx - l0 / 2, y: cy - l1 / 2, w: l0, h: l1, rot: Math.round(rot * 10) / 10 };
}

/** One move + exactly four cubic segments → axis-aligned ellipse bbox, else null. */
function asEllipse(segs: Seg[]): { x: number; y: number; w: number; h: number } | null {
  const moves = segs.filter((sg) => sg.op === 'm').length;
  const curves = segs.filter((sg) => sg.op === 'c').length;
  const lines = segs.filter((sg) => sg.op === 'l').length;
  if (moves !== 1 || curves !== 4 || lines > 1) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const sg of segs) for (let k = 0; k < sg.pts.length; k += 2) {
    minX = Math.min(minX, sg.pts[k]!); maxX = Math.max(maxX, sg.pts[k]!);
    minY = Math.min(minY, sg.pts[k + 1]!); maxY = Math.max(maxY, sg.pts[k + 1]!);
  }
  const w = maxX - minX, h = maxY - minY;
  if (w < 0.5 || h < 0.5) return null;
  return { x: minX, y: minY, w, h };
}

/** Serialize box-space segs to an SVG `d` + its bbox. */
function serializePath(segs: Seg[]): { d: string; x: number; y: number; w: number; h: number } {
  let d = '';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const track = (x: number, y: number): void => { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; };
  const r = (v: number): number => Math.round(v * 100) / 100;
  for (const sg of segs) {
    if (sg.op === 'm') { track(sg.pts[0]!, sg.pts[1]!); d += `M${r(sg.pts[0]!)} ${r(sg.pts[1]!)}`; }
    else if (sg.op === 'l') { track(sg.pts[0]!, sg.pts[1]!); d += `L${r(sg.pts[0]!)} ${r(sg.pts[1]!)}`; }
    else { track(sg.pts[0]!, sg.pts[1]!); track(sg.pts[2]!, sg.pts[3]!); track(sg.pts[4]!, sg.pts[5]!); d += `C${r(sg.pts[0]!)} ${r(sg.pts[1]!)} ${r(sg.pts[2]!)} ${r(sg.pts[3]!)} ${r(sg.pts[4]!)} ${r(sg.pts[5]!)}`; }
  }
  if (!isFinite(minX)) return { d: '', x: 0, y: 0, w: 0, h: 0 };
  return { d: d + 'Z', x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function ocgLabel(op: string, name: string, res: PdfResources): string {
  if (op === 'BDC' && res.ocgs && name && res.ocgs[name]) return res.ocgs[name]!;
  return '';
}

// ── ToUnicode CMap → text (for embedded / subset fonts) ───────────────────────

/** UTF-16BE hex (1+ code units) → a JS string. */
function hexToUtf16(hex: string): string {
  let out = '';
  for (let i = 0; i + 3 < hex.length + 1 && i + 4 <= hex.length; i += 4) {
    out += String.fromCharCode(parseInt(hex.substr(i, 4), 16) || 0);
  }
  if (!out && hex.length >= 2) out = String.fromCharCode(parseInt(hex.substr(0, hex.length), 16) || 0);
  return out;
}

/**
 * Parse a PDF /ToUnicode CMap (already decoded to text) into a code → text map. Handles
 * both `beginbfchar`/`endbfchar` (single mappings) and `beginbfrange`/`endbfrange`
 * (range mappings, with either a base destination or an explicit array). Character codes
 * are the source-byte integers used in content-stream strings.
 */
// Source codes are 1-byte (simple fonts) or 2-byte (Type0/CID), so a single
// bfrange can never legitimately span more than 0x10000 codes. A hostile CMap
// (`<00000000> <ffffffff> <0041>`) would otherwise drive an ~4-billion-iteration
// loop that OOM-crashes the process — never trust the declared span. Ranges
// wider than this cap are clamped (the leading, plausibly-real codes still map).
const MAX_BF_RANGE = 0x10000;

export function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  if (!cmap) return map;

  // bfchar: <src> <dst>
  const charBlock = /beginbfchar([\s\S]*?)endbfchar/g;
  let mb: RegExpExecArray | null;
  const pair = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
  while ((mb = charBlock.exec(cmap))) {
    let pm: RegExpExecArray | null;
    pair.lastIndex = 0;
    while ((pm = pair.exec(mb[1]!))) map.set(parseInt(pm[1]!, 16), hexToUtf16(pm[2]!));
  }

  // bfrange: <lo> <hi> <dstBase>  OR  <lo> <hi> [<d0> <d1> …]
  const rangeBlock = /beginbfrange([\s\S]*?)endbfrange/g;
  const rangeSingle = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
  const rangeArray = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g;
  while ((mb = rangeBlock.exec(cmap))) {
    const body = mb[1]!;
    let rm: RegExpExecArray | null;
    rangeArray.lastIndex = 0;
    const arrSpans: Array<[number, number]> = [];
    while ((rm = rangeArray.exec(body))) {
      const lo = parseInt(rm[1]!, 16), hi = parseInt(rm[2]!, 16);
      arrSpans.push([rm.index, rm.index + rm[0].length]);
      const dsts = rm[3]!.match(/<([0-9A-Fa-f]+)>/g) || [];
      for (let k = 0; k <= hi - lo && k < dsts.length; k++) {
        map.set(lo + k, hexToUtf16(dsts[k]!.replace(/[<>]/g, '')));
      }
    }
    rangeSingle.lastIndex = 0;
    while ((rm = rangeSingle.exec(body))) {
      // skip matches that were actually the "<lo> <hi> [" prefix of an array span
      if (arrSpans.some(([a, b]) => rm!.index >= a && rm!.index < b)) continue;
      const lo = parseInt(rm[1]!, 16), hi = parseInt(rm[2]!, 16);
      const baseHex = rm[3]!;
      const base = parseInt(baseHex, 16);
      const span = Math.min(hi - lo, MAX_BF_RANGE - 1); // never trust the declared span
      for (let k = 0; k <= span; k++) {
        map.set(lo + k, String.fromCharCode((base + k) & 0xffff));
      }
    }
  }
  return map;
}

/**
 * Build a FontDecoder from a parsed ToUnicode map. `twoByte` fonts (Type0/CID) read the
 * content string in 2-byte big-endian codes; simple fonts read one byte per code.
 */
export function toUnicodeDecoder(map: Map<number, string>, twoByte: boolean): FontDecoder {
  return (codes: number[]): string => {
    let out = '';
    if (twoByte) {
      for (let i = 0; i + 1 < codes.length; i += 2) {
        const code = (codes[i]! << 8) | codes[i + 1]!;
        out += map.has(code) ? map.get(code)! : '';
      }
    } else {
      for (const code of codes) out += map.has(code) ? map.get(code)! : String.fromCharCode(code);
    }
    return out;
  };
}
