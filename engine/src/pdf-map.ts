// SPDX-License-Identifier: MPL-2.0
/**
 * PDF (and Adobe Illustrator .ai - an .ai IS a PDF) page content stream → DesignNodes.
 *
 * The counterpart to design-map.ts's Figma/Penpot walkers, for the PDF import path.
 * An Illustrator .ai file saved with PDF compatibility (the default) is a normal PDF,
 * so both land here. The shell (design-import.js) owns the byte work - it uses pdf-lib
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
 *     crisp SVG image - vector, not raster, and still one movable box
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
import { constantMask, isAchromatic, maskRegion } from './pdf-smask.ts';

// ── types ────────────────────────────────────────────────────────────────────

/** A 2-D affine (PDF/SVG convention: point (x,y) → (a·x + c·y + e, b·x + d·y + f)). */
interface Mat { a: number; b: number; c: number; d: number; e: number; f: number; }

/** A normalized node - structurally the design-map `DesignNode` (feed to finalizeBoxes). */
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
  /** A multi-line text node's REAL leading as a multiple of `fontSize` (the
   *  average of the pen moves its lines were merged across). Serializers place
   *  line i's baseline at `y + 0.8·size + i·lineHeight·size`; absent, they fall
   *  back to the historical 1.4 estimate. */
  lineHeight?: number;
  text?: string;
  fit?: string;
  group?: string;
  /**
   * The innermost open marked-content id when this run began, from a tagged
   * PDF's `/P <</MCID n>> BDC`. Absent when the content is untagged.
   *
   * This is the ONLY link between painted content and the document's structure
   * tree, and therefore the only route to a true reading order - geometry can
   * only ever guess at it. Latched at the run's origin (with the fill, font and
   * mask), not at ET, because a single BT…ET block can cross several marked
   * runs and the first one is what the origin belongs to.
   */
  mcid?: number;
  _imageXObject?: string;
  _vectorPath?: string;
  _vectorFill?: string;
  /** PDF even-odd fill (the starred f/B operators) - REQUIRED for ring-shaped
   *  fills: an inner subpath is a hole only under this rule; nonzero would fill
   *  it solid. */
  _vectorFillRule?: 'evenodd';
  _vectorStroke?: { color: string; width: number; cap?: 'butt' | 'round' | 'square'; join?: 'miter' | 'round' | 'bevel' } | null;
  _vectorViewBox?: { x: number; y: number; w: number; h: number };
  /** A text node's glyphs outlined to SVG path `d` strings, one per line (baseline
   *  at y=0, pen at x=0 - HarfBuzz's frame). Set by a shell that can shape text
   *  (pdf-import's outlineText hook); when present, pdf-svg emits real `<path>`
   *  outlines instead of a font-dependent `<text>`, so the SVG is self-contained
   *  and pixel-faithful without the recipient's fonts. */
  _outlinePath?: string[];
  /** Enclosing group ids, outermost→innermost (OCG layers / form XObjects / q…Q blocks).
   *  Resolved to the final flat `group` after the walk, then deleted. */
  _groupPath?: string[];
  /** Active clipping paths (outermost→innermost), baked into box space - the
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
   *  space (so any affine - incl. skew on a radial - is exact). */
  _gradient?: PdfGradient;
  /**
   * The /Luminosity (or /Alpha) soft mask in force when this node painted, already
   * resolved into BOX space. pdf-svg emits a `<mask>` whose children are `nodes`
   * and wraps the painted element in `<g mask="url(#…)">`. This is how a CSS
   * box-shadow finally renders: its blur, offset and rounded corners live entirely
   * in the mask (see pdf-smask.ts).
   *
   * SHARED - the interpreter memoises one object per (mask, CTM) pair and hands the
   * same reference to every node it covers, so pdf-svg's dedup is a `key` lookup and
   * the per-node cost is one pointer. NEVER mutate it.
   *
   * Deliberate limitation: PDF masks a transparency GROUP; we mask each node
   * independently, so overlapping nodes under one mask composite differently (each
   * sees the backdrop). The same approximation the per-node `_clips` and `opacity`
   * model already makes, and Chromium's shadow idiom paints exactly one node per
   * mask, so it does not bite on printed output.
   */
  _softMask?: PdfSoftMask;
}

/**
 * An ExtGState soft mask (/SMask), pre-decoded by the SHELL into the same shape as a
 * form XObject: a content stream plus resources this interpreter can `run()`.
 * PDF 32000-1 section 11.6.5.2.
 *
 * No bytes and no PDF objects cross this boundary - the mask group's own images
 * arrive as ordinary `imageKey`s in `resources.xobjects`, and the shell resolves them
 * through the SAME `images` record as any other raster. That keeps the engine
 * platform-agnostic: it never learns that a mask is usually a blurred JPEG.
 */
export interface PdfSoftMaskDef {
  /** Stable identity: the memoisation key and the `<mask>` dedup key. Shell-assigned
   *  and opaque (one id per distinct mask group in the document). */
  id: string;
  /** /S. 'Alpha' is emitted as `mask-type="alpha"` and warned - Chromium never uses
   *  it (0 of 136 probed masks), and resvg does not implement it. */
  subtype: 'Luminosity' | 'Alpha';
  /** The /G form XObject's decoded content stream. */
  content: string;
  /** The /G form's own resources, extracted recursively exactly like a form XObject. */
  resources: PdfResources;
  /** The /G form's /Matrix. */
  matrix?: number[];
  /** The /G form's /BBox, in group space. Outside it the mask is the backdrop. */
  bbox?: number[];
  /** /BC reduced to a 0..1 magnitude. Anything but 0/absent REFUSES the group: a
   *  non-black backdrop extends to infinity and a userSpaceOnUse `<mask>` cannot
   *  say that. Chromium has never emitted one. */
  backdrop?: number;
  /** /TR present and not /Identity - a transfer function we cannot express, so the
   *  group is refused rather than rendered with the wrong response curve. */
  transfer?: boolean;
}

/**
 * A soft mask evaluated into box space, ready for serialization. `nodes` are the mask
 * group's own painted nodes (a raster, a gradient rect, or real vector shapes - one
 * code path, because they came out of this same interpreter).
 */
export interface PdfSoftMask {
  /** Dedup key: the mask's id plus the base transform it was evaluated under. */
  key: string;
  nodes: PdfNode[];
  /** The mask region (the /BBox's box-space AABB) - `<mask>` userSpaceOnUse geometry. */
  x: number; y: number; w: number; h: number;
  subtype: 'Luminosity' | 'Alpha';
}

/** One clipping path in box space (`d` as an SVG path string). */
export interface ClipPath { d: string; evenOdd: boolean }

/** A colour stop along a gradient's parameter axis (offset 0..1, resolved to hex). */
export interface PdfGradientStop { offset: number; color: string }

/**
 * A normalized shading - the shell resolves the PDF /Function into a pre-sampled
 * colour ramp (`stops`), so this pure module never needs the PDF function machinery
 * (and never sees a PostScript program). Coords are in the shading's OWN space
 * (before the CTM / pattern matrix is applied):
 *   • type 1 (function-based): no coords; `domain` is the 2-D rect the function
 *     covers. Chromium prints CSS `oklch()` / `conic-gradient()` / wide-gamut
 *     interpolated gradients this way (a ShadingType 1 over a FunctionType 4
 *     PostScript calculator), NOT as an axial shading - so this rung is the one
 *     the docs-screenshot pipeline actually hits on a colour-heavy page. The shell
 *     classifies each one: constant → `flat` only; near-linear → re-expressed as a
 *     type 2 axial; irreducibly 2-D → `tileKey` + `flat`.
 *   • type 2 (axial):  [x0, y0, x1, y1]        - the gradient axis endpoints
 *   • type 3 (radial): [x0, y0, r0, x1, y1, r1] - start circle → end circle
 */
export interface PdfShading {
  type: 1 | 2 | 3;
  /** type 2/3 only. */
  coords: number[];
  /** type 2/3 only. */
  stops: PdfGradientStop[];
  /** [extendStart, extendEnd] - paint beyond the axis with the end colours. */
  extend: [boolean, boolean];
  /**
   * The shading dictionary's OWN /Matrix (PDF 32000-1 Table 79) - shading space →
   * the parent pattern/user space. ShadingType 1 only; type 2/3 have none.
   *
   * Deliberately NOT called `matrix`: `PdfGradient.matrix` is the COMPOSED
   * box-space transform, and one name for two different matrices is exactly the
   * kind of silent-wrongness this interpreter cannot afford. The interpreter
   * composes this into the box-space matrix at `scn`/`sh` time and never emits it.
   */
  shadingMatrix?: number[];
  /** ShadingType 1 only: [x0 x1 y0 y1] - the function-based domain rect, in the
   *  shading's own space (PDF 32000-1 Table 78). */
  domain?: [number, number, number, number];
  /** ShadingType 1 only: an OPAQUE key the serializer resolves through
   *  `PdfSvgOptions.images` - identical in kind to `PdfNode._imageXObject`. The
   *  engine never learns that it denotes pixels; a shell that can't rasterise
   *  simply doesn't register one and the node paints `flat` instead. */
  tileKey?: string;
  /** A representative flat colour for this shading (the constant value of a
   *  degenerate function-based shading, or the area-weighted mean of one that
   *  can't be reproduced exactly). The LAST rung of the fidelity ladder: a paint
   *  we can't emit lands on a colour rather than on nothing. */
  flat?: string;
}

/** A PatternType 1 (tiling) pattern body - PDF 32000-1 section 8.7.3.1. The shell decodes
 *  the stream and extracts the pattern's own resources; the interpreter executes
 *  the content to find out what the tile actually paints (see the collapse pre-pass
 *  in `scn`). */
export interface PdfTiling {
  /** Decoded content stream (the tile's drawing procedure). */
  content: string;
  /** The pattern's own /Resources, recursively extracted by the shell. */
  resources: PdfResources;
  /** /BBox [x0 y0 x1 y1] in pattern space. */
  bbox: [number, number, number, number];
  /** /XStep, /YStep - the tile spacing in pattern space. */
  xStep: number;
  yStep: number;
  /** /PaintType: 1 = coloured (the tile carries its own colours), 2 = uncoloured
   *  (the tile is a stencil; the tint comes from the `scn` operands). */
  paintType: 1 | 2;
}

/** A PDF Pattern resource: PatternType 2 (a shading pattern) or PatternType 1 (a
 *  tiling pattern). Its /Matrix maps pattern space to the parent content stream's
 *  default space. */
export interface PdfPattern {
  shading?: PdfShading;
  /** Pattern /Matrix [a b c d e f] (default identity). */
  matrix?: number[];
  /**
   * A flat colour the shell already resolved for this pattern (a constant
   * function-based shading, or the mean of one it could not reproduce exactly).
   * Set ALONGSIDE `shading` too, as the back-stop for a paint the serializer
   * ultimately refuses - an unemittable gradient must degrade to a colour, not to
   * a hole. That hole is precisely how 76 filled elements became a white ghost
   * page on the Brand Studio colours tab.
   */
  flat?: string;
  /** PatternType 1 body. The interpreter collapses it (see `scn`). */
  tiling?: PdfTiling;
}

/** A shading resolved into box space for emission - the shading's coords plus a
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
 * `<path>` outlines of the EXACT glyphs it rendered - no font resolution, any face.
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
  /** The font's own resources - CharProcs run against these. */
  resources: PdfResources;
}

export interface PdfFontInfo {
  /** Decode raw string bytes to text. Falls back to Latin-1 (fine for ASCII) if absent. */
  decode?: FontDecoder;
  /** Composite / Type0 (CID) fonts use 2-byte codes; simple fonts are 1 byte. */
  twoByte?: boolean;
  /** Family name (remapped onto the target tool's font vocabulary - see
   *  design-map.ts `mapFontFamily`/`DesignMapOptions`). */
  family?: string;
  /** A weight hint parsed from the font descriptor / name. */
  weight?: number | string;
  /** Present for Type3 fonts - text is drawn by executing these glyph procedures
   *  instead of emitting a font-dependent `<text>`. */
  type3?: Type3Font;
}

export interface PdfResources {
  fonts?: Record<string, PdfFontInfo>;
  xobjects?: Record<string, PdfXObject>;
  /**
   * ExtGState name → { fill alpha ca, stroke alpha CA, soft mask }.
   *
   * `smask` is a FOUR-state field, and the distinction matters because an ExtGState
   * only changes the parameters it actually lists:
   *   • a `PdfSoftMaskDef`  → a mask comes into force AND can be evaluated;
   *   • `true`  → a mask comes into force but the shell could not pre-decode its
   *     group (legacy/degraded). The interpreter falls to the last-resort rung;
   *   • `false` → `/SMask /None`, an explicit clear;
   *   • `undefined` → no /SMask key at all: leave whatever mask is in force ALONE.
   */
  extgstates?: Record<string, { ca?: number; CA?: number; smask?: PdfSoftMaskDef | boolean }>;
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
  /**
   * Report a paint the interpreter had to approximate or drop. A PURE callback -
   * no I/O, no formatting decisions - so this module stays platform-free; the
   * shell turns `(code, detail)` into a human string. `code` is a stable dotted
   * slug so a caller can tally categories (`pattern.tiling.collapsed`,
   * `pattern.unsupported`, …). Every silent drop in here is a pixel that goes
   * missing in an export, so silence is the bug, not the safe default.
   */
  onWarn?: (code: string, detail?: string) => void;
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
  /**
   * An inline `<<…>>` property dictionary operand (the BDC property list).
   *
   * Only `/MCID` is lifted out - that is the one key this interpreter needs, and
   * parsing the rest would mean a second PDF object parser inside the tokenizer.
   * It MUST be its own token type: while it was reported as `{t:'op'}` it fell
   * through the operator switch to `default`, which calls `reset()` and wiped
   * the pending `/OC /Name` operand, so `/OC /MC0 <</MCID 0>> BDC` silently lost
   * its layer name (see tests/pdf-map.test.ts).
   */
  | { t: 'dict'; v: { mcid: number | null } }
  | { t: 'op'; v: string };

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set('()<>[]{}/%'.split('').map((c) => c.charCodeAt(0)));

/**
 * Tokenize a content stream. Operates on Latin-1 char codes so binary string bytes
 * survive. Inline images (BI … ID … EI) are skipped wholesale - their binary payload
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

  /**
   * Consume an inline `<<…>>` dictionary, returning its /MCID if it has one.
   *
   * STRING-AWARE, unlike the depth counter this replaced. A tagged PDF routinely
   * writes `/ActualText (…)` into a BDC property list, and a `>>` inside that
   * literal used to close the dictionary early and leave the remainder to be
   * mis-tokenized as operators. Parenthesised literals (with backslash escapes
   * and nesting) and `<…>` hex strings are therefore skipped whole.
   */
  const readDict = (): { mcid: number | null } => {
    // 1, not 0: the caller has already consumed the opening `<<`.
    let depth = 1;
    let mcid: number | null = null;
    while (i < n) {
      const c = code(i);
      // A literal string: balanced parens, backslash escapes.
      if (c === 0x28) {
        let par = 0;
        while (i < n) {
          const d = code(i);
          if (d === 0x5c) { i += 2; continue; }          // escape - skip the pair
          if (d === 0x28) par++;
          else if (d === 0x29) { par--; if (par === 0) { i++; break; } }
          i++;
        }
        continue;
      }
      if (c === 0x3c && code(i + 1) === 0x3c) { depth++; i += 2; continue; }
      // A lone '<' opens a HEX string, which can legally contain '>' … it ends at
      // the first '>', so consuming it here keeps it out of the depth count.
      if (c === 0x3c) { while (i < n && code(i) !== 0x3e) i++; i++; continue; }
      if (c === 0x3e && code(i + 1) === 0x3e) { depth--; i += 2; if (depth <= 0) break; continue; }
      // /MCID <int> - the only key we lift out.
      if (c === 0x2f) {
        const start = i;
        const key = readName();
        if (key === 'MCID') {
          while (i < n && WS.has(code(i))) i++;
          const numStart = i;
          while (i < n && !WS.has(code(i)) && !DELIM.has(code(i))) i++;
          const v = parseInt(src.slice(numStart, i), 10);
          if (isFinite(v)) mcid = v;
        } else if (i === start) i++;   // readName made no progress - never spin
        continue;
      }
      i++;
    }
    return { mcid };
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
      if (c === 0x3c && code(i + 1) === 0x3c) { i += 2; readDict(); continue; }
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
      if (code(i + 1) === 0x3c) { i += 2; return { t: 'dict', v: readDict() }; }
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
  /**
   * The soft mask in force, WITH the CTM at the `gs` that installed it - a mask
   * group is evaluated in the coordinate system in effect when the ExtGState was
   * applied (section 11.6.5.2; what pdf.js and poppler both do). Probed and confirmed on
   * Chromium print output: the mask /BBox under that CTM is identical to the masked
   * fill's own `re` rect.
   *
   * IMMUTABLE - cloneState shares the reference, so `gs` must REPLACE it, never
   * mutate it.
   */
  softMask: { def: PdfSoftMaskDef; ctm: Mat } | null;
  /** A mask is in force but its group was not supplied (legacy `smask: true`), so
   *  there is nothing to evaluate - the last-resort rung. */
  softMaskOpaque: boolean;
  lineWidth: number;
  /** PDF `J` line cap (0 butt, 1 round, 2 square) and `j` line join (0 miter,
   *  1 round, 2 bevel) - section 8.4.3.3-4. Unread until now, so every stroke fell back to
   *  SVG's defaults, butt + miter. Chromium prints an icon's
   *  `stroke-linecap:round; stroke-linejoin:round` as `1 J 1 j`, so outline icons
   *  came out with clipped ends and spiked corners: thin, pale, and for the
   *  chain-link glyph, structurally wrong. */
  lineCap: number;
  lineJoin: number;
  font: string;
  fontSize: number;
  leading: number;
  /** Active clip stack. COPY-ON-WRITE - cloneState shares the array, so append
   *  via `s.clips = [...s.clips, c]`, never mutate in place. */
  clips: ClipPath[];
  /** A pending gradient fill (a shading-pattern selected via `scn`), already
   *  resolved to box space. Cleared whenever a solid fill colour is set. */
  fillGradient: FillGradient | null;
  /** Raster tile nodes selected by `scn`, waiting for the path that will clip them.
   *  A pattern paints only where the PATH is; emitting the tile at its own bbox
   *  paints the whole cell. Chromium's pasteboard checkerboard is a page-sized
   *  cell, so that covered the entire page - sidebar included - instead of the
   *  canvas rect that selected it. */
  fillTileNodes: PdfNode[] | null;
  /**
   * A soft mask ADOPTED from a collapsed tiling pattern, to be applied to whatever
   * this fill next paints. Chromium encodes "a CSS gradient that carries alpha" as a
   * one-cell tiling pattern whose body installs a /Luminosity mask (the alpha ramp)
   * and fills with a function shading (the colour ramp); the collapse pre-pass
   * adopts the tile's paint verbatim, so it has to adopt the tile's mask too or the
   * gradient paints fully opaque. Cleared with `fillGradient`.
   */
  fillMask: PdfSoftMask | null;
  /**
   * An extra fill-alpha multiplier adopted from a collapsed tiling pattern; 1 when
   * there is none. A tile paints with its OWN graphics state, so its alpha (an /ca, or
   * a soft mask that folded to a constant) ends up on the node the pre-pass produced,
   * not on ours - adopting the tile's colour and dropping its alpha would paint a
   * translucent wash at full strength. Kept separate from `fillAlpha` so it cannot
   * leak onto a later plain-colour fill in the same q…Q block; cleared with
   * `fillGradient`.
   */
  fillScale: number;
  /**
   * A stroke pattern (`SC`/`SCN` with a name) this interpreter cannot reproduce -
   * the pattern's name, or '' when there is none. NOT warned at selection time:
   * Chromium sets stroke AND fill to the same pattern in one breath and then only
   * ever fills, so warning at `SCN` fired 78 times across the audit fixtures with a
   * 100% benign rate (inflating the streams shows 80 `/Pn SCN` occurrences and ZERO
   * followed by a stroke paint op). Deferred to the paint site so a page that
   * genuinely strokes with a tiling pattern still reports, and the census stays
   * readable. Part of the graphics state, so q/Q restores it.
   */
  strokePatternUnsupported: string;
}
function cloneState(s: GState): GState { return { ...s }; }

/**
 * The subset of the graphics state a nested `run()` INHERITS - PDF 32000-1 section 8.10.1:
 * "the form XObject's content stream shall be executed with the current graphics
 * state". Passing only the CTM and the clip (what this interpreter did before) meant
 * `q /GS0 gs /Fm0 Do Q` - the canonical Illustrator/InDesign soft-mask idiom - painted
 * the form's contents at full opacity and unmasked, silently.
 *
 * The TEXT state (font name / size / leading) is deliberately NOT inherited: a font is
 * named through the resource dictionary in force, and a form brings its OWN /Resources,
 * so carrying the name `/F1` across that boundary can resolve to a different face.
 * Every real producer issues `Tf` inside the form's own `BT`, so nothing is lost.
 */
type InheritedGState = Pick<GState,
  'fill' | 'stroke' | 'fillAlpha' | 'strokeAlpha' | 'softMask' | 'softMaskOpaque'
  | 'lineWidth' | 'lineCap' | 'lineJoin' | 'fillGradient' | 'fillMask' | 'fillScale' | 'strokePatternUnsupported' | 'fillTileNodes'>;

/** A gradient selected as the current fill - the shading plus its box-space matrix
 *  (which ALREADY has the shading's own /Matrix composed in, see `scn`/`sh`). */
interface FillGradient extends PdfShading { mat: Mat; }
/** Snapshot a live fill gradient onto a node (matrix as a plain array). `shadingMatrix`
 *  is deliberately NOT copied: it is already baked into `mat`, and re-emitting it
 *  would apply it twice. */
function nodeGradient(g: FillGradient): PdfGradient {
  const m = g.mat;
  return {
    type: g.type, coords: g.coords, stops: g.stops, extend: g.extend,
    matrix: [m.a, m.b, m.c, m.d, m.e, m.f],
    ...(g.domain ? { domain: g.domain } : {}),
    ...(g.tileKey ? { tileKey: g.tileKey } : {}),
    ...(g.flat ? { flat: g.flat } : {}),
  };
}
/** The inverse of `nodeGradient` - re-adopt a node's already-box-space gradient as
 *  the live fill (the tiling-pattern collapse pre-pass). */
function adoptGradient(g: PdfGradient): FillGradient {
  return {
    type: g.type, coords: g.coords, stops: g.stops, extend: g.extend,
    ...(g.domain ? { domain: g.domain } : {}),
    ...(g.tileKey ? { tileKey: g.tileKey } : {}),
    ...(g.flat ? { flat: g.flat } : {}),
    mat: fromArr(g.matrix),
  };
}

/** Where a `run()` deposits its nodes, with its own budget. The page gets one; the
 *  tiling-pattern collapse pre-pass gets a small private one so a hostile PDF full
 *  of patterns can't spend the page's whole node budget off-screen.
 *
 *  EVERY nested `run` - form XObjects, Type3 glyph procedures, the collapse
 *  pre-pass - must forward the sink it was given. A nested run that fell back to
 *  the page sink would paint a pattern tile's contents straight onto the page, in
 *  pattern-space coordinates. */
interface Sink { nodes: PdfNode[]; count: number; max: number; }

/** A path segment already baked into box space. */
/** `h` is an explicit CLOSE marker, not geometry: PDF's `h` (and `re`, `s`, `b`,
 *  `b*`) close the current subpath, and SVG needs a real `Z` to join the ends
 *  rather than cap them. Everything else carries points. */
interface Seg { op: 'm' | 'l' | 'c' | 'h'; pts: number[]; }

/**
 * The outcome of evaluating one ExtGState /SMask group - the fidelity ladder, as a
 * type. `null` (not a member here) is the refusal: the caller then falls back to the
 * pre-mask behaviour.
 *   • 'mask'     → a real `<mask>` (raster / gradient / vector, one code path)
 *   • 'constant' → the group is one flat rect over its bbox: fold its luminosity
 *                  into the painted node's alpha and emit no `<mask>` at all
 *   • 'none'     → the group painted nothing, so its luminosity is the backdrop,
 *                  which defaults to black = 0. Fully masked out: paint NOTHING.
 *                  Exact, not a guess (section 11.6.5.2).
 */
type MaskEval =
  | { kind: 'mask'; mask: PdfSoftMask }
  | { kind: 'constant'; value: number }
  | { kind: 'none' };

/** What a paint site must do about the mask in force: extras to spread onto the
 *  node, and a multiplier for its alpha. `null` means DROP this paint. */
interface MaskPaint { extra: { _softMask?: PdfSoftMask }; scale: number }

// ── interpreter ────────────────────────────────────────────────────────────

/**
 * Interpret one page's content stream into DesignNodes (paint order, back-to-front).
 * @param page decoded content + MediaBox size + pre-extracted resources.
 * @returns DesignNodes for `finalizeBoxes(nodes, { prefix: 'p' })`.
 */
export function interpretPdfPage(page: PdfPageInput): PdfNode[] {
  const nodes: PdfNode[] = [];
  const flip: Mat = { a: 1, b: 0, c: 0, d: -1, e: -(page.originX || 0), f: (page.originY || 0) + (page.height || 0) };
  let gseq = 0;   // unique id generator for q…Q + form-XObject group frames (shared across runs)
  const MAX = 4000;
  const onWarn = page.onWarn ?? ((): void => {});
  const pageSink: Sink = { nodes, count: 0, max: MAX };

  // Tiling-pattern collapse budgets. A page can name the same pattern dozens of
  // times (Chromium emits one per element), so results are memoised per
  // pattern-name + base CTM + tint; `collapseBudget` bounds the number of DISTINCT
  // re-entries so a hostile PDF can't multiply work, and `inFlight` breaks a
  // self-referential pattern (P1's tile paints with /P1) that the memo alone
  // wouldn't catch, since the cache entry isn't written until the run returns.
  const COLLAPSE_MAX_NODES = 256;
  let collapseBudget = 512;
  const collapseCache = new Map<string, PdfNode[]>();
  /**
   * Bumped every time a paint happened while a soft mask was in force that we could
   * NOT evaluate - so what reached the sink is the UNMASKED shape (or was dropped).
   * A tiling pattern that paints a box-shadow installs its mask INSIDE its own
   * content stream (`/G8 gs` then fill-with-pattern), so the outer graphics state is
   * clean when `scn` selects it; watching this counter across the sub-run is the only
   * way for the collapse pre-pass to know whether the tile it just interpreted is
   * trustworthy. When the mask WAS evaluated the tile's nodes already carry it, and
   * the collapse can proceed normally - which is what recovers a CSS gradient that
   * carries alpha.
   */
  let softMaskUnresolved = 0;
  const inFlight = new Set<string>();

  // ── soft-mask evaluation budgets (untrusted input) ─────────────────────────
  // A mask group is a raster, a gradient rect or a small shape - never a page. 64
  // nodes is generous for every real case and bounds both the work and the emitted
  // markup. `maskBudget` bounds the number of DISTINCT (mask, CTM) evaluations a
  // page may spend; `maskInFlight` breaks a self-referential group (its content
  // installs the very ExtGState that names it), which the memo alone cannot, since
  // the cache entry is not written until the run returns. `maskDepth` forbids a mask
  // inside a mask: section 11.6.5.2 turns soft masks OFF inside a mask group anyway, and
  // this makes that structural rather than a matter of trusting the seed state.
  //
  // The old budget was a flat 96 evaluations, which is really "96 shadows per page" -
  // a cliff an ordinary Illustrator page clears easily, and past it EVERY remaining
  // mask silently degrades to the grey-plate heuristic. Two changes: the count rises
  // to 256, and the real bound moves to the thing that actually costs (total mask
  // nodes interpreted and emitted, MASK_TOTAL_NODES) so a page may have many tiny
  // masks or a few large ones without a fixed count deciding for it. Exhaustion is
  // announced ONCE with its own code, so the census shows the cliff was reached
  // instead of it hiding among generic per-group refusals.
  const MASK_MAX_NODES = 64;
  const MASK_TOTAL_NODES = 4000;
  // Node ceilings do not bound WORK: a content stream that paints nothing still has
  // to be tokenised, and `q Q` repeated 200k times Flate-compresses to a few KB. A
  // mask group named under N distinct CTMs is N full tokenisations of it, so the eval
  // counter alone let a small crafted PDF block the main thread for ~11 s. Bound the
  // tokens actually consumed, page-wide, across every nested run.
  const TOKEN_BUDGET = 4_000_000;
  let tokensSpent = 0;
  let tokenBudgetAnnounced = false;
  let maskBudget = 256;
  let maskNodesSpent = 0;
  let maskBudgetAnnounced = false;
  const maskExhausted = (): void => {
    if (!maskBudgetAnnounced) { maskBudgetAnnounced = true; onWarn('smask.budget.exhausted', ''); }
  };
  let maskDepth = 0;
  const maskCache = new Map<string, MaskEval | null>();
  const maskInFlight = new Set<string>();

  const run = (content: string, res: PdfResources, baseCtm: Mat, depth: number, parentGroups: string[], baseClips: ClipPath[] = [], baseFill = '', sink: Sink = pageSink, inherit: InheritedGState | null = null, glyphRun = false): void => {
    if (depth > 12) return;
    // Untrusted input: this runs on a PDF a user uploaded. Charge every nested run
    // against one page-wide token budget so recursion, re-evaluation under many CTMs
    // and pathological fanout are all bounded by the same ceiling.
    if (tokensSpent >= TOKEN_BUDGET) {
      if (!tokenBudgetAnnounced) { tokenBudgetAnnounced = true; onWarn('content.budget.exhausted', ''); }
      return;
    }
    const toks = tokenize(content || '');
    tokensSpent += toks.length;
    // `inherit` = a form XObject / Type3 glyph procedure, which section 8.10.1 (and section 9.6.5
    // for Type3) executes with the CURRENT graphics state. `baseFill` still wins over
    // the inherited fill when non-empty: it is the uncoloured-pattern (PaintType 2)
    // tint, which overrides colour operators outright.
    // Mask groups and the tiling-pattern collapse pre-pass pass no `inherit` on
    // purpose - section 11.6.5.2 turns soft masks and alpha OFF inside a mask group, and a
    // tile paints with its own state.
    let s: GState = inherit
      ? {
        ...inherit, ctm: baseCtm, clips: baseClips,
        ...(baseFill ? { fill: baseFill } : {}),
        font: '', fontSize: 0, leading: 0,
      }
      : {
        ctm: baseCtm, fill: baseFill, stroke: '', fillAlpha: 1, strokeAlpha: 1,
        softMask: null, softMaskOpaque: false, lineWidth: 1,
        font: '', fontSize: 0, leading: 0, clips: baseClips, fillGradient: null, fillMask: null, fillTileNodes: null, fillScale: 1, lineCap: 0, lineJoin: 0,
        strokePatternUnsupported: '',
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
    /**
     * Marked-content ids currently open, innermost last. A tagged PDF wraps each
     * logical run in `/P <</MCID n>> BDC … EMC`, and that n is the only link
     * between painted content and the document's structure tree - which is what
     * states the true READING ORDER, as opposed to the order things happen to sit
     * on the page. Parallel to `gstack` rather than merged into it because a
     * group is about visual nesting and an MCID is about document structure; the
     * same BDC can carry both, and they are consumed by different callers.
     */
    const mcstack: number[] = [];
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
    /** Device-space x of the CURRENT LINE'S START - a next-line move is only a
     *  line break in this node when it returns close to it. */
    let lastLineX = 0;
    /** Accumulated real leading (as a multiple of the font size) across the
     *  '\n' merges in this node, so flushText can record the document's actual
     *  line height instead of the serializer guessing 1.4. */
    let leadSum = 0, leadCount = 0;
    /**
     * The fill alpha and the soft-mask decision captured AT THE RUN'S ORIGIN, not at
     * `ET`. A BT…ET block can change `gs` between shows, and the node carries a single
     * alpha/mask - so the state that painted the first glyph is the one that describes
     * the run. `textMask === null` means the run is fully masked out and must not paint.
     * Text used to record neither: every muted or secondary label imported at full
     * strength (reads as "wrong colour", not "slightly off"), and masked type painted
     * unmasked with no warning at all.
     */
    let textAlpha = 1;
    let textMcid = -1;
    let textMask: MaskPaint | null = { extra: {}, scale: 1 };

    let args: number[] = [];
    let nameArg = '';
    let strArg: number[] | null = null;
    let arrArg: Tok[] | null = null;
    /** The pending inline `<<…>>` property dict (BDC's property list). */
    let dictArg: { mcid: number | null } | null = null;
    const reset = (): void => { args = []; nameArg = ''; strArg = null; arrArg = null; dictArg = null; };

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
      for (const c of codes) outS += WIN_ANSI_HIGH[c] ?? String.fromCharCode(c);
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
        // Innermost open MCID, or -1 when this run is untagged.
        textMcid = mcstack.length ? mcstack[mcstack.length - 1]! : -1;
        // 'raw', not 'fill': a text run is never a box-shadow plate (so no shadow-drop
        // rung) and never adopts a collapsed tiling pattern's mask (that belongs to a
        // path fill). It DOES take a real <mask> and a folded constant.
        textAlpha = clamp(s.fillAlpha * s.fillScale, 0, 1);
        textMask = maskPaint('raw');
        lastLineY = p.y; lastLineX = p.x;
        leadSum = 0; leadCount = 0;
      } else if (!textBuf) {
        // Nothing SHOWN yet in this run, so this move is pen positioning, not
        // layout - re-latch the origin at the new position. The origin must
        // belong to where glyphs are shown, not to the first positioning op:
        // Chromium prints every word as `1 0 0 -1 0 0 Tm` (a flip set-up at the
        // line box's top-left) followed by `x -leading Td` to the true glyph
        // origin, and treating that Td as a line MOVE kept the stale Tm origin -
        // every line-start word painted one leading too high, at x=0 of its
        // block, colliding with the next word's identically stale origin.
        originSet = false;
        onTextMove();
        return;
      } else {
        // One BT…ET block is NOT always one visual run: producers that write a
        // whole frame/column set in a single block (Penpot exports, TeX, many
        // office printers) move the pen with Tm/Td between logically separate
        // runs. Only two moves continue THIS node - anything else (an upward
        // move, a column-sized x jump, a leading the serializer's line model
        // cannot reproduce) flushes and starts a fresh node at the true origin,
        // so every run keeps its real position instead of being re-typeset on a
        // synthetic grid under the first run.
        const dy = p.y - lastLineY;
        const dx = p.x - lastLineX;
        if (Math.abs(dy) <= textSize * 0.35) {
          // Same baseline. Small forward positioning (kerning, word placement)
          // keeps accumulating; a leftward move or a tab/column jump is a new run.
          if (dx < -textSize * 0.35 || dx > textSize * 3) { flushText(); onTextMove(); return; }
        } else if (dy > textSize * 0.35 && dy <= textSize * 2.1 && Math.abs(dx) <= textSize * 2) {
          // Next line: downward, near the line start, at a plausible leading.
          if (textBuf && !textBuf.endsWith('\n')) { textBuf += '\n'; leadSum += dy / textSize; leadCount++; }
          lastLineY = p.y; lastLineX = p.x;
        } else {
          flushText(); onTextMove(); return;
        }
      }
    };

    // Type3: draw each code's glyph procedure at the pen (the live text matrix
    // `tm`), then advance `tm` by the glyph width - so subsequent shows continue
    // from the right place. The glyph's fills inherit the text fill colour (d1
    // glyphs are uncoloured). `tm` doubles as the pen: a following Td/Tm resets it.
    const drawType3 = (codes: number[], t3: Type3Font): void => {
      if (!codes.length || sink.count >= sink.max) return;
      const fm = t3.fontMatrix;
      const fmMat: Mat = { a: fm[0] ?? 0.001, b: fm[1] ?? 0, c: fm[2] ?? 0, d: fm[3] ?? 0.001, e: fm[4] ?? 0, f: fm[5] ?? 0 };
      const scale: Mat = { a: s.fontSize || 1, b: 0, c: 0, d: s.fontSize || 1, e: 0, f: 0 };
      const gid = 'g' + (++gseq);
      for (const code of codes) {
        const proc = t3.encoding[code] ? t3.charProcs[t3.encoding[code]!] : undefined;
        if (proc && sink.count < sink.max) {
          const glyphCtm = matMul(matMul(matMul(s.ctm, tm), scale), fmMat);
          // section 9.6.5: a glyph procedure executes in the graphics state in effect, so it
          // inherits alpha and the soft mask, not just the fill colour it always had.
          // `glyphRun` keeps it out of the box-shadow-plate rung - glyph outlines are
          // never a print engine's shadow plate, and dropping them loses the TEXT.
          run(proc, t3.resources, glyphCtm, depth + 1, [...gpath(), gid], s.clips, s.fill, sink, s, true);
        }
        const adv = (t3.widths[code] ?? 0) * (fm[0] ?? 0.001) * (s.fontSize || 0);
        tm = matMul(tm, { a: 1, b: 0, c: 0, d: 1, e: adv, f: 0 });
      }
    };

    /**
     * Latch the marked-content id for the run being built, if it has none yet.
     *
     * Called where glyphs are actually SHOWN rather than where the origin is set:
     * a tagged PDF commonly writes `BT … Tm /P <</MCID n>> BDC (text) Tj EMC ET`,
     * so at origin-set time (Tm) the BDC has not been seen. First id wins, since
     * one BT…ET block is one node and the node's text begins in that run.
     */
    const latchMcid = (): void => {
      if (textMcid < 0 && mcstack.length) textMcid = mcstack[mcstack.length - 1]!;
    };

    const showString = (codes: number[] | null): void => {
      if (!codes || !codes.length) return;
      const fi = res.fonts && res.fonts[s.font];
      if (fi?.type3) { drawType3(codes, fi.type3); return; }
      if (!originSet) onTextMove();
      latchMcid();
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
      latchMcid();
      for (const el of arr) {
        if (el.t === 'str') textBuf += decodeStr(el.v, s.font);
        else if (el.t === 'num' && el.v <= -180) textBuf += ' ';
      }
    };
    const flushText = (): void => {
      const txt = textBuf.replace(/[ \t]+\n/g, '\n').replace(/\s+$/g, '');
      if (originSet && txt.trim() && sink.count < sink.max && textMask) {
        const size = Math.max(1, textSize);
        // The document's real leading (average of the moves merged as '\n'),
        // as a multiple of the font size - pdf-svg's line placement reads it
        // so merged lines land on the true baselines, not a synthetic grid.
        const lead = leadCount ? Math.round((leadSum / leadCount) * 1000) / 1000 : 0;
        sink.nodes.push({
          kind: 'text',
          x: origin.x, y: origin.y - size * 0.8,
          w: Math.max(4, txt.replace(/\n.*/s, '').length * size * 0.55, size * 2), h: size * (lead || 1.4) * (txt.split('\n').length),
          ...(lead ? { lineHeight: lead } : {}),
          rot: Math.abs(textRot) < 0.5 ? 0 : textRot,
          fg: safeColor(textFill, '#000000') || '#000000',
          opacity: clamp(Math.round(textAlpha * 100 * textMask.scale), 0, 100),
          fontSize: size,
          fontFamily: (res.fonts && res.fonts[textFont] && res.fonts[textFont]!.family) || '',
          fontWeight: (res.fonts && res.fonts[textFont] && res.fonts[textFont]!.weight) || 400,
          text: txt,
          ...(textMcid >= 0 ? { mcid: textMcid } : {}),
          _groupPath: gpath(),
          ...(s.clips.length ? { _clips: s.clips } : {}),
          ...textMask.extra,
        });
        sink.count++;
      }
      textBuf = ''; originSet = false; leadSum = 0; leadCount = 0;
      textAlpha = 1; textMcid = -1; textMask = { extra: {}, scale: 1 };
    };

    /**
     * The soft mask in force → what this paint site must do about it. THE ladder
     * (see MaskEval): a real `<mask>`, a folded constant, a drop, or a refusal that
     * falls back to the pre-mask behaviour.
     *
     * `source` says which paint is asking, and it governs two things:
     *   • 'fill' is the only one that consults `s.fillMask` (a mask adopted from a
     *     collapsed tiling pattern belongs to the FILL, not to an image or an `sh`
     *     that happens to be drawn while it is pending);
     *   • 'fill' is also the only one that enables the LAST-RESORT rung below. A
     *     masked, translucent, achromatic fill whose group could not be evaluated is a
     *     print engine's box-shadow plate, and an opaque grey plate behind every
     *     rounded control is worse than the shadow simply being absent. A raster or a
     *     gradient is never a shadow plate, so those keep the pre-mask paint instead
     *     of losing the picture - and neither is a Type3 GLYPH outline, which is why
     *     `glyphRun` opts out too: dropping those loses the page's words.
     *   Text runs ask as 'raw' (see flushText): a label is not a shadow plate either,
     *     and a mask adopted by a path fill is not the text's.
     *
     * This is the placeholder heuristic from before mask groups could be read, and it
     * is DELIBERATELY RETAINED - demoted from "the answer" to the bottom rung. On
     * Chromium print output it now fires zero times across all five audit fixtures
     * (`smask.shadow.skipped` went 86 → 0). What still depends on it is every OTHER
     * producer's masks, i.e. the user-uploaded `.pdf` / `.ai` half of this path:
     * a group with a /TR transfer function or a non-black /BC, a page past the
     * mask budget, a group that paints 64+ nodes, a mask nested inside a mask, a
     * degenerate /BBox, and a group the shell could not decode at all (`smask: true`).
     * In every one of those the alternative is not "the real shadow" - it is the grey
     * plate. Delete this and those files regress; the honest fix is to shrink the
     * refusal set, not to remove the fallback.
     */
    const maskPaint = (source: 'fill' | 'stroke' | 'raw'): MaskPaint | null => {
      if (!s.softMask && !s.softMaskOpaque) {
        // No graphics-state mask, but the current FILL may have adopted one from a
        // collapsed tiling pattern (a CSS gradient carrying alpha).
        return (source === 'fill' && s.fillMask)
          ? { extra: { _softMask: s.fillMask }, scale: 1 }
          : { extra: {}, scale: 1 };
      }
      // The graphics-state mask wins over an adopted one: a `gs` is the more specific
      // statement, and SVG cannot nest two masks on one element without multiplying
      // them (which is not what either source means).
      const ev = s.softMask ? evalSoftMask(s.softMask, depth) : null;
      if (ev) {
        if (ev.kind === 'none') return null;
        // A near-zero constant is an invisible node; emit nothing rather than an
        // `opacity="0"` element.
        if (ev.kind === 'constant') return ev.value < 0.005 ? null : { extra: {}, scale: ev.value };
        return { extra: { _softMask: ev.mask }, scale: 1 };
      }
      softMaskUnresolved++;
      if (source === 'fill' && !glyphRun && s.fillAlpha < 0.9 && isAchromatic(s.fill)) { onWarn('smask.shadow.skipped', ''); return null; }
      return { extra: {}, scale: 1 };
    };

    const paintPath = (mode: 'fill' | 'stroke' | 'both', evenOdd = false): void => {
      if (!segs.length || sink.count >= sink.max) { segs = []; return; }
      // A stroke pattern we could not reproduce is only worth reporting HERE - at a
      // real stroke - not at the `SCN` that selected it. Cleared once reported so a
      // hostile stream of thousands of strokes cannot flood the census.
      if (mode !== 'fill' && s.strokePatternUnsupported) {
        onWarn('pattern.unsupported', s.strokePatternUnsupported);
        s.strokePatternUnsupported = '';
      }
      // Fill and stroke are separate paints with separate alphas, so `B` must ask the
      // mask about each independently. Asking once for the fill meant an unevaluable
      // mask over a translucent achromatic fill (the shadow-plate rung) threw away the
      // OPAQUE stroke with it: `/GS0 gs 0.9 0.9 0.9 rg 1 0 0 RG 0 0 100 100 re B`
      // produced zero nodes. `maskPaint` is memoised, so the second call is a lookup.
      const mpFill = mode === 'stroke' ? null : maskPaint('fill');
      const mpStroke = mode === 'fill' ? null : maskPaint('stroke');
      if (!mpFill && !mpStroke) { segs = []; return; }
      const fillCol = mpFill ? s.fill : '';
      const strokeCol = mpStroke ? s.stroke : '';
      const grad = mpFill ? s.fillGradient : null;
      const gradExtra = grad ? { _gradient: nodeGradient(grad) } : {};
      // One node carries one mask and one alpha, so the paint that actually produces
      // ink leads: the fill unless it was dropped (or is absent and a stroke remains).
      const lead = (mpFill && (fillCol || grad || !mpStroke)) ? mpFill : (mpStroke ?? mpFill)!;
      const maskExtra = lead.extra;
      const alpha = clamp(Math.round(
        (lead === mpFill ? s.fillAlpha * s.fillScale : s.strokeAlpha) * 100 * lead.scale), 0, 100);

      // A deferred raster tile paints HERE, clipped to the path that selected it.
      if (s.fillTileNodes && mode !== 'stroke') {
        const baked = serializePath(segs);
        const pathClip: ClipPath[] = baked.d ? [{ d: baked.d, evenOdd }] : [];
        for (const n of s.fillTileNodes) {
          if (sink.count >= sink.max) break;
          sink.nodes.push(pathClip.length ? { ...n, _clips: [...(n._clips ?? []), ...pathClip] } : { ...n });
          sink.count++;
        }
        s.fillTileNodes = null;
        segs = [];
        return;
      }

      const clip = s.clips.length ? { _clips: s.clips } : {};
      // The rect/ellipse fast paths only apply to a SINGLE subpath: a multi-
      // subpath fill (e.g. a shadow ring = outer + inner circle under even-odd)
      // must stay a real path or the inner subpath's hole is lost. A gradient
      // fill (empty `fill`, `_gradient` set) still takes them - a hero gradient
      // is almost always a plain rect.
      const subpaths = segs.reduce((c2, sg) => c2 + (sg.op === 'm' ? 1 : 0), 0);
      if ((fillCol || grad) && mode !== 'stroke' && subpaths === 1) {
        const rect = asRectangle(segs);
        if (rect) {
          sink.nodes.push({ kind: 'box', x: rect.x, y: rect.y, w: rect.w, h: rect.h, rot: rect.rot,
            fill: safeColor(fillCol, ''), opacity: alpha, shape: 'rect', _groupPath: gpath(), ...clip, ...gradExtra, ...maskExtra });
          sink.count++; segs = []; return;
        }
        const ell = asEllipse(segs);
        if (ell) {
          sink.nodes.push({ kind: 'box', x: ell.x, y: ell.y, w: ell.w, h: ell.h, rot: 0,
            fill: safeColor(fillCol, ''), opacity: alpha, shape: 'ellipse', _groupPath: gpath(), ...clip, ...gradExtra, ...maskExtra });
          sink.count++; segs = []; return;
        }
      }

      const baked = serializePath(segs);
      // A stroked straight line is degenerate in one axis but its stroke width
      // gives it real area - floor its box at 1 so it isn't dropped (icon glyphs
      // print as individual `m l S` segments). A FILL only needs positive extent:
      // a thin glyph stem (an 'i', an 'l' at a small size) is ~0.5px wide, so a
      // 1px floor would drop it - Type3 text is filled glyphs, so admit anything
      // with real area and reject only sub-pixel noise.
      const bw = strokeCol ? Math.max(baked.w, 1) : baked.w;
      const bh = strokeCol ? Math.max(baked.h, 1) : baked.h;
      const minDim = strokeCol ? 1 : 0.06;
      if (bw >= minDim && bh >= minDim) {
        sink.nodes.push({
          kind: 'image', x: baked.x, y: baked.y, w: bw, h: bh, rot: 0, fit: 'fill', opacity: alpha,
          _vectorPath: baked.d,
          _vectorFill: fillCol ? safeColor(fillCol, 'none') : 'none',
          _vectorStroke: strokeCol ? {
            color: safeColor(strokeCol, '#000000'),
            width: Math.max(0.3, s.lineWidth * scaleMag(s.ctm)),
            ...(s.lineCap === 1 ? { cap: 'round' as const } : s.lineCap === 2 ? { cap: 'square' as const } : {}),
            ...(s.lineJoin === 1 ? { join: 'round' as const } : s.lineJoin === 2 ? { join: 'bevel' as const } : {}),
          } : null,
          _vectorViewBox: { x: baked.x, y: baked.y, w: baked.w, h: baked.h },
          _groupPath: gpath(),
          ...clip,
          ...(evenOdd ? { _vectorFillRule: 'evenodd' as const } : {}),
          ...gradExtra,
          ...maskExtra,
        });
        sink.count++;
      }
      segs = [];
    };

    /**
     * PatternType 1 (tiling) collapse pre-pass - PDF 32000-1 section 8.7.3.
     *
     * Chromium prints an out-of-sRGB CSS colour (`oklch()`, a wide-gamut gradient)
     * as a tiling pattern whose ENTIRE body is `/Pn scn <bbox> re f*` - a tile that
     * does nothing but fill its own bbox with ANOTHER pattern. Rather than
     * pattern-match that against Chromium's current emitter, RE-INTERPRET the tile
     * with this same interpreter and look at what came out:
     *   • exactly one node covering ≥95% of the tile bbox → adopt its paint
     *     verbatim. Its gradient matrix is already correct box space because the
     *     pre-pass ran with the composed base CTM. This is the observed case, and
     *     it falls out of the architecture instead of being special-cased.
     *   • any other node set → the area-weighted mean colour. A hatch or a
     *     checkerboard pasteboard becomes a flat mid-tone: visibly wrong, but
     *     VISIBLE and reported. Painting real `<pattern>` tile geometry is the
     *     natural next rung and is deliberately NOT built here.
     *   • nothing painted → clear the fill (the original anti-stale-black valve).
     */
    const collapseTiling = (pat: PdfPattern, tl: PdfTiling, name: string, patMat: Mat, tint: string | null): void => {
      // NB no soft-mask guard here any more. A mask on the OUTER graphics state is
      // applied by paintPath when the selecting path actually paints, and a mask the
      // TILE installs inside its own content stream is applied per-node by the
      // sub-run's own paintPath - so a mask we can evaluate no longer forces this
      // pre-pass to decline. The `softMaskUnresolved` check after the sub-run is what
      // still declines the cases we cannot read (see below).
      //
      // Pattern space maps to the parent content stream's default space, so the
      // tile runs under baseCtm ∘ /Matrix - not the live CTM.
      // Selecting a pattern replaces the fill outright, so any mask a PREVIOUS fill
      // had adopted from an earlier collapse is stale from here on.
      s.fillMask = null; s.fillScale = 1;
      const base = matMul(baseCtm, patMat);
      // PaintType 2 is a stencil: the tint comes from the `scn` operands (falling
      // back to the live fill), and `run`'s existing `baseFill` parameter carries it.
      const paintTint = tl.paintType === 2 ? (tint ?? s.fill) : '';
      const key = `${name}|${[base.a, base.b, base.c, base.d, base.e, base.f].map((v) => Math.round(v * 1e4)).join(',')}|${paintTint}`;
      let out = collapseCache.get(key);
      if (!out) {
        if (depth >= 12 || collapseBudget <= 0 || inFlight.has(key)) {
          s.fill = safeColor(pat.flat, ''); s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null;
          onWarn('pattern.tiling.averaged', name);
          return;
        }
        collapseBudget--;
        inFlight.add(key);
        const sub: Sink = { nodes: [], count: 0, max: COLLAPSE_MAX_NODES };
        const unresolvedBefore = softMaskUnresolved;
        try { run(tl.content, tl.resources, base, depth + 1, [], [], paintTint, sub); }
        finally { inFlight.delete(key); }
        // The tile installed a soft mask whose group could NOT be evaluated, so what
        // the sub-run emitted is the UNMASKED shape (or nothing). Flattening that
        // paints an opaque plate the size of the element's box behind every rounded
        // control - visibly worse than the shadow being absent. Decline, exactly as
        // before mask groups could be read. When the mask WAS evaluated the nodes
        // carry it and the collapse proceeds normally.
        if (softMaskUnresolved > unresolvedBefore) {
          s.fill = ''; s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null;
          collapseCache.set(key, []);
          onWarn('pattern.smasked.skipped', name);
          return;
        }
        out = sub.nodes;
        collapseCache.set(key, out);
      }
      if (!out.length) {
        s.fill = ''; s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null; onWarn('pattern.unsupported', name);
        return;
      }

      // A tile whose content is a RASTER is the other way Chromium prints a
      // box-shadow: it renders the blurred shadow to an image XObject and fills
      // the element's box with a one-cell pattern containing it (BBox 279x110,
      // XStep 281 - a step wider than the cell, so it never actually repeats).
      // An image has no meaningful flat colour: `nodeFlat` reads none and the
      // mean-colour rung paints the tile's whole rectangle in one opaque grey,
      // which is the hard plate that shows up behind every rounded, shadowed
      // control. Declining leaves the shadow absent, which is what this
      // interpreter did before tiles could be collapsed at all, and is plainly
      // the better of the two wrong answers.
      // So EMIT the tile instead of flattening it. Its nodes were produced by
      // running the tile's own content under `base` (= baseCtm ∘ /Matrix), so
      // they are already in box space and correctly placed - they can go
      // straight into the sink, and the path that selected this pattern then
      // paints nothing. This is what recovers the brand palette's swatches, the
      // L/C/H slider tracks and the primary-colour bar (Chromium rasterises
      // those because they are rounded AND shadowed, not because of oklch), and
      // it renders real blurred shadows instead of dropping them.
      //
      // Only when the pattern does NOT actually repeat: a step at least as large
      // as the cell means one cell covers the fill, which is the shape Chromium
      // emits here (BBox 34x34, XStep 36). A genuinely repeating raster tile
      // would need the fill path's extent to know how many cells to lay down,
      // and that is not known until the path is painted - so it keeps the old
      // flatten-or-average behaviour below.
      // NB `kind: 'image'` alone does NOT mean raster - it is this interpreter's
      // generic drawn-node carrier, and a vector path arrives as an 'image' node
      // with `_vectorPath` set. A real raster is the one with an `_imageXObject`
      // key for the shell to resolve. Testing `kind` alone silently swallowed
      // every vector tile too, which is how the palette swatches went blank.
      const isRaster = (n: PdfNode): boolean => !!n._imageXObject && !n._vectorPath;
      if (out.some(isRaster)) {
        // `every`, not `some`: emitting whole is only right when the tile IS the
        // raster. A tile that mixes a raster with vector nodes is some other
        // construction, so it keeps the flatten/average path below.
        const allRaster = out.every(isRaster);
        const noRepeat = tl.xStep >= (tl.bbox[2] - tl.bbox[0]) - 0.5
          && tl.yStep >= (tl.bbox[3] - tl.bbox[1]) - 0.5;
        if (allRaster && noRepeat && sink.count + out.length <= sink.max) {
          // The tile's nodes are emitted INSTEAD of the selecting path's paint, so
          // they - not that path - are what a mask on the outer graphics state has to
          // apply to. A node the tile already masked keeps its own mask (SVG could
          // nest two `<g mask>` wraps, but the tile's mask is the shape and the outer
          // one is then almost always the same shadow group, so nesting would double
          // it); only the folded-constant scale composes in either way.
          const mp = maskPaint('raw');
          if (!mp) {
            s.fill = ''; s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null;
            onWarn('pattern.tiling.raster.skipped', name);
            return;
          }
          // Prepare the nodes but DEFER them: paintPath clips them to the path that
          // selected this pattern, exactly as it does a gradient fill.
          s.fillTileNodes = out.map((n) => {
            // Clone: these nodes are shared with collapseCache, and the outer
            // clip/mask have to be composed in without mutating the cached copy.
            const c: PdfNode = s.clips.length ? { ...n, _clips: [...(n._clips ?? []), ...s.clips] } : { ...n };
            if (!c._softMask && mp.extra._softMask) c._softMask = mp.extra._softMask;
            if (mp.scale < 1) c.opacity = clamp(Math.round((typeof c.opacity === 'number' ? c.opacity : 100) * mp.scale), 0, 100);
            return c;
          });
          // NB: no `fillTileNodes = null` here - that is the one we just set.
          s.fill = ''; s.fillGradient = null; s.fillMask = null; s.fillScale = 1;
          onWarn('pattern.tiling.raster.emitted', name);
          return;
        }
        s.fill = ''; s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null;
        onWarn('pattern.tiling.raster.skipped', name);
        return;
      }

      const bb = tl.bbox;
      const cs = [apply(base, bb[0], bb[1]), apply(base, bb[2], bb[1]), apply(base, bb[2], bb[3]), apply(base, bb[0], bb[3])];
      const bboxArea = (Math.max(...cs.map((p) => p.x)) - Math.min(...cs.map((p) => p.x)))
        * (Math.max(...cs.map((p) => p.y)) - Math.min(...cs.map((p) => p.y)));
      const only = out.length === 1 ? out[0]! : null;
      if (only && bboxArea > 0 && (only.w * only.h) / bboxArea >= 0.95) {
        s.fill = nodeFlat(only) || safeColor(pat.flat, '');
        s.fillGradient = only._gradient ? adoptGradient(only._gradient) : null;
        // Adopt the tile's MASK along with its paint. Chromium encodes "a CSS
        // gradient that carries alpha" as exactly this shape: a one-cell tile whose
        // body installs a /Luminosity mask (the alpha ramp) and fills with a function
        // shading (the colour ramp). Adopting the colour but not the mask would paint
        // the whole ambient page wash fully opaque.
        s.fillMask = only._softMask ?? null;
        // …and its ALPHA: a tile that folded a constant mask (or carried an /ca) put
        // that alpha on its node, and the graphics state has nowhere else to keep it.
        s.fillScale = typeof only.opacity === 'number' ? clamp(only.opacity, 0, 100) / 100 : 1;
        onWarn('pattern.tiling.collapsed', name);
        return;
      }
      s.fill = meanNodeColor(out) || safeColor(pat.flat, '');
      s.fillGradient = null;
      s.fillMask = null; s.fillScale = 1;
      onWarn('pattern.tiling.averaged', name);
    };

    /**
     * Resolve a `scn` pattern NAME to a paint, down the fidelity ladder:
     *   1. a shading pattern (PatternType 2) → a real gradient fill, with the
     *      shell-resolved flat colour kept as the serializer's back-stop;
     *   2. a tiling pattern (PatternType 1) → the collapse pre-pass above;
     *   3. a pattern the shell could only reduce to a colour → that colour;
     *   4. nothing usable → clear the paint and report it.
     */
    const applyPattern = (pat: PdfPattern, name: string, tint: string | null): void => {
      const patMat = fromArr(pat.matrix && pat.matrix.length >= 6 ? pat.matrix : [1, 0, 0, 1, 0, 0]);
      if (pat.shading) {
        const sh = pat.shading;
        // Pattern /Matrix maps pattern space to the parent content stream's default
        // space (section 8.7.3.1) - hence baseCtm, not s.ctm. The shading dict's OWN
        // /Matrix (Table 79) composes inside that; baking it into the coords instead
        // would be exact only for a similarity transform and silently wrong on skew.
        const mat = matMul(matMul(baseCtm, patMat),
          fromArr(sh.shadingMatrix && sh.shadingMatrix.length >= 6 ? sh.shadingMatrix : [1, 0, 0, 1, 0, 0]));
        s.fillGradient = { ...sh, mat };
        s.fill = safeColor(pat.flat ?? sh.flat, '');
        s.fillMask = null; s.fillScale = 1;
        return;
      }
      if (pat.tiling) { collapseTiling(pat, pat.tiling, name, patMat, tint); return; }
      if (pat.flat) { s.fill = safeColor(pat.flat, ''); s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null; return; }
      s.fill = ''; s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null; onWarn('pattern.unsupported', name);
    };

    for (const tk of toks) {
      if (tk.t === 'num') { args.push(tk.v); continue; }
      if (tk.t === 'name') { nameArg = tk.v; continue; }
      if (tk.t === 'str') { strArg = tk.v; continue; }
      if (tk.t === 'arr') { arrArg = tk.v; continue; }
      if (tk.t === 'dict') { dictArg = tk.v; continue; }
      if (tk.t !== 'op') continue;

      switch (tk.v) {
        case 'q': stack.push(cloneState(s)); gstack.push('g' + (++gseq)); break;
        case 'Q': if (stack.length) s = stack.pop()!; if (gstack.length) gstack.pop(); break;
        case 'cm': if (args.length >= 6) s.ctm = matMul(s.ctm, fromArr(args)); break;
        case 'w': s.lineWidth = args[0] ?? s.lineWidth; break;
        case 'J': s.lineCap = args[0] ?? s.lineCap; break;      // section 8.4.3.3
        case 'j': s.lineJoin = args[0] ?? s.lineJoin; break;    // section 8.4.3.4
        case 'gs': {
          const g = res.extgstates && res.extgstates[nameArg];
          if (g) {
            if (typeof g.ca === 'number') s.fillAlpha = g.ca;
            if (typeof g.CA === 'number') s.strokeAlpha = g.CA;
            // Only touch the mask if this ExtGState actually names /SMask - see the
            // four-state note on PdfResources.extgstates. A pre-decoded group is
            // captured together with the CTM in force RIGHT NOW, because that is the
            // space the group's own content executes in (section 11.6.5.2).
            if (g.smask !== undefined) {
              if (g.smask === false) { s.softMask = null; s.softMaskOpaque = false; }
              else if (g.smask === true) { s.softMask = null; s.softMaskOpaque = true; }
              else { s.softMask = { def: g.smask, ctm: s.ctm }; s.softMaskOpaque = false; }
            }
          }
          break;
        }
        case 'rg': s.fill = rgbHex(args[0]!, args[1]!, args[2]!); s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null; break;
        case 'RG': s.stroke = rgbHex(args[0]!, args[1]!, args[2]!); s.strokePatternUnsupported = ''; break;
        case 'g': s.fill = rgbHex(args[0]!, args[0]!, args[0]!); s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null; break;
        case 'G': s.stroke = rgbHex(args[0]!, args[0]!, args[0]!); s.strokePatternUnsupported = ''; break;
        case 'k': s.fill = cmykHex(args); s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null; break;
        case 'K': s.stroke = cmykHex(args); s.strokePatternUnsupported = ''; break;
        // sc/scn: numeric operands → a real colour; a pattern NAME → `applyPattern`
        // (see its comment for the fidelity ladder). A name we have NO pattern
        // resource for still CLEARS the paint rather than letting it inherit the
        // previous fill, since a stale colour (often black) would flood the shape -
        // the original anti-stale-black safety valve, now the rare case rather than
        // the common one. An uncoloured pattern (PaintType 2) carries its tint in
        // the numeric operands, which scColor resolves.
        case 'sc': case 'scn': {
          const pat = nameArg && res.patterns ? res.patterns[nameArg] : undefined;
          if (pat) {
            applyPattern(pat, nameArg, scColor(args));
          } else {
            const col = scColor(args);
            if (col) { s.fill = col; s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null; }
            else if (nameArg) { s.fill = ''; s.fillGradient = null; s.fillMask = null; s.fillScale = 1; s.fillTileNodes = null; onWarn('pattern.unsupported', nameArg); }
          }
          break;
        }
        // Stroke patterns: there is no stroke-gradient support in this interpreter
        // at all, so the best available answer is the pattern's flat back-stop.
        // A pattern with no back-stop is NOT reported here - see
        // GState.strokePatternUnsupported; the report moves to the paint site so the
        // 78 benign Chromium "set stroke to the fill's pattern, then only fill"
        // selections stop burying real signal in the warning census.
        case 'SC': case 'SCN': {
          const col = scColor(args);
          if (col) { s.stroke = col; s.strokePatternUnsupported = ''; break; }
          if (!nameArg) break;
          const pat = res.patterns ? res.patterns[nameArg] : undefined;
          if (pat?.flat) { s.stroke = pat.flat; s.strokePatternUnsupported = ''; }
          else { s.stroke = ''; s.strokePatternUnsupported = nameArg; }
          break;
        }
        case 'cs': case 'CS': break;

        // `sh` paints a shading across the current clip. We only emit it when a clip
        // is in force (the normal case - Chromium clips a gradient to its element
        // box): a page-sized gradient rect cropped by the clip. Unclipped `sh` is
        // rare and can't be bounded here (extend:false paints only the axis extent,
        // not the page), so it's skipped rather than risk flooding the page.
        //
        // The shading's own /Matrix (Table 79) composes onto the CTM here; the flat
        // back-stop rides along as the node fill, so a shading the serializer can't
        // emit (a function-based one with no rasterised tile) still paints a colour.
        case 'sh': {
          const sd = res.shadings && res.shadings[nameArg];
          if (!sd) { if (nameArg) onWarn('shading.unsupported', nameArg); break; }
          if (!s.clips.length) { onWarn('shading.sh.unclipped', nameArg); break; }
          if (sink.count < sink.max) {
            // `sh` under a soft mask is a masked gradient (CSS `mask-image` over a
            // gradient background). No shadow-drop rung here: a gradient is never a
            // shadow plate, so an unevaluable mask keeps today's unmasked paint.
            const mp = maskPaint('raw');
            if (!mp) break;
            const sm = matMul(s.ctm, fromArr(sd.shadingMatrix && sd.shadingMatrix.length >= 6 ? sd.shadingMatrix : [1, 0, 0, 1, 0, 0]));
            sink.nodes.push({
              kind: 'box', x: 0, y: 0, w: page.width || 0, h: page.height || 0, rot: 0, shape: 'rect',
              fill: safeColor(sd.flat, ''), opacity: clamp(Math.round(s.fillAlpha * 100 * mp.scale), 0, 100),
              _gradient: nodeGradient({ ...sd, mat: sm }),
              _groupPath: gpath(),
              _clips: s.clips,
              ...mp.extra,
            });
            sink.count++;
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
          segs.push({ op: 'h', pts: [] });          // `re` is a CLOSED subpath (section 8.5.2.1)
          cxU = startXU = x; cyU = startYU = y;
          break;
        }
        case 'h': if (segs.length) { push(startXU, startYU, 'l'); segs.push({ op: 'h', pts: [] }); cxU = startXU; cyU = startYU; } break;

        // A pending W/W* applies at the path's terminating operator. Applying it
        // just BEFORE the paint deviates from the spec by one op (the painted
        // path self-clips - a no-op, a path clipped by itself is itself) and
        // keeps the common `re W n` clip-only sequence exact.
        case 'f': case 'F': applyPendingClip(); paintPath('fill'); break;
        case 'f*': applyPendingClip(); paintPath('fill', true); break;
        // `s`/`b`/`b*` are the CLOSE-then-paint forms of `S`/`B`/`B*` (section 8.5.3.1);
        // they must close, or a stroked shape is left with a gap where it started.
        case 'S': applyPendingClip(); paintPath('stroke'); break;
        case 's': if (segs.length) { push(startXU, startYU, 'l'); segs.push({ op: 'h', pts: [] }); } applyPendingClip(); paintPath('stroke'); break;
        case 'B': applyPendingClip(); paintPath('both'); break;
        case 'b': if (segs.length) { push(startXU, startYU, 'l'); segs.push({ op: 'h', pts: [] }); } applyPendingClip(); paintPath('both'); break;
        case 'B*': applyPendingClip(); paintPath('both', true); break;
        case 'b*': if (segs.length) { push(startXU, startYU, 'l'); segs.push({ op: 'h', pts: [] }); } applyPendingClip(); paintPath('both', true); break;
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
          if (xo && xo.kind === 'image' && sink.count < sink.max) {
            // An image drawn under a soft mask is a masked raster (a photo behind a
            // CSS mask, and 2 of the 136 probed masks cover exactly this). No
            // shadow-drop rung: a raster is never a shadow plate, so an unevaluable
            // mask keeps today's unmasked paint rather than losing the picture.
            const mp = maskPaint('raw');
            if (!mp) break;
            const geom = boxGeomFromBBox({ x: 0, y: 0, width: 1, height: 1 }, s.ctm);
            sink.nodes.push({ kind: 'image', x: geom.x, y: geom.y, w: geom.w, h: geom.h, rot: geom.rot,
              fit: 'fill', opacity: clamp(Math.round(s.fillAlpha * 100 * mp.scale), 0, 100), _imageXObject: xo.imageKey || nameArg, _groupPath: gpath(),
              ...(s.clips.length ? { _clips: s.clips } : {}), ...mp.extra });
            sink.count++;
          } else if (xo && xo.kind === 'form') {
            const fm = (xo.matrix && xo.matrix.length >= 6) ? matMul(s.ctm, fromArr(xo.matrix)) : s.ctm;
            // section 8.10.1: "the form XObject's content stream shall be executed with the
            // CURRENT graphics state" - so the form inherits the caller's clip stack
            // AND its paint state (fill/stroke colour, ca/CA, line width, and above
            // all the /SMask in force). Seeding a fresh state here made
            // `q /GS0 gs /Fm0 Do Q` - the Illustrator/InDesign soft-mask idiom -
            // paint the form's contents unmasked at full opacity with no warning.
            // `s` is passed by reference but `run` copies it into its own state
            // object, and `q`/`Q` inside the form use the form's own stack, so
            // nothing the form does can leak back out (section 8.10.1 again).
            // Depth alone does not bound fanout: a self-referential form with k `Do`s
            // costs k^12, and a form that paints nothing never trips the node ceiling -
            // measured 9.6 s at fanout 4 from a ~40-byte stream. Stop descending once
            // the sink is full or the token budget is gone.
            if (sink.count < sink.max && tokensSpent < TOKEN_BUDGET) {
              run(xo.content || '', xo.resources || {}, fm, depth + 1, [...gpath(), 'g' + (++gseq)], s.clips, '', sink, s, glyphRun);
            }
          }
          break;
        }

        // Marked content pushes a frame too (an OCG layer id, or '' for a non-group marker)
        // so it nests correctly with the q…Q frames on the same stack.
        case 'BDC': case 'BMC':
          gstack.push(ocgLabel(tk.v, nameArg, res));
          // -1 marks "this level had no MCID", so EMC can pop unconditionally and
          // the stack stays in lockstep with gstack however the two interleave.
          mcstack.push(dictArg?.mcid ?? -1);
          break;
        case 'EMC':
          if (gstack.length) gstack.pop();
          if (mcstack.length) mcstack.pop();
          break;
        default: break;
      }
      reset();
    }
    flushText(); // in case ET was omitted
  };

  /**
   * Evaluate one ExtGState /SMask group into box-space nodes - PDF 32000-1 section 11.6.5.2.
   *
   * The group is a content stream plus resources, which is precisely what `run()`
   * already consumes, so re-running it through THIS interpreter makes a raster mask,
   * a gradient mask and a vector mask one code path. There is no classifier: the only
   * thing measured afterwards is whether the result folds to a constant.
   *
   * Never throws. Every refusal is `onWarn` + `null`, and the caller then falls back
   * to the behaviour it had before masks could be read - so nothing renders worse at
   * any rung than it did before. Memoised per (mask id, base transform): a page names
   * the same shadow group dozens of times and one `<mask>` def serves all of them.
   */
  const evalSoftMask = (sm: { def: PdfSoftMaskDef; ctm: Mat }, depth: number): MaskEval | null => {
    const def = sm.def;
    // section 11.6.5.2: soft masks are OFF inside a mask group, so a group that installs one
    // is malformed (or hostile). `run` already seeds `softMask: null`; this makes the
    // guarantee structural rather than a matter of trusting the seed.
    if (maskDepth >= 1) { onWarn('smask.group.unevaluated', 'nested'); return null; }
    if (!def || !def.content) { onWarn('smask.group.unevaluated', 'content'); return null; }
    // A /TR transfer function remaps the mask's response curve; a non-zero /BC
    // backdrop extends past the /BBox to infinity. Neither is expressible as a
    // userSpaceOnUse <mask>, and rendering them wrong is worse than falling back.
    if (def.transfer) { onWarn('smask.group.unevaluated', 'transfer'); return null; }
    if (typeof def.backdrop === 'number' && def.backdrop > 0.004) { onWarn('smask.group.unevaluated', 'bc'); return null; }

    const base = matMul(sm.ctm, fromArr(def.matrix && def.matrix.length >= 6 ? def.matrix : [1, 0, 0, 1, 0, 0]));
    const key = `${def.id}|${[base.a, base.b, base.c, base.d, base.e, base.f].map((v) => Math.round(v * 1e4)).join(',')}`;
    const hit = maskCache.get(key);
    if (hit !== undefined) return hit;
    // The group's content installs the very ExtGState that names it. The memo cannot
    // catch this (the entry is not written until the run returns), so track in-flight.
    if (maskInFlight.has(key)) { onWarn('smask.group.unevaluated', 'recursive'); return null; }
    if (maskBudget <= 0 || maskNodesSpent >= MASK_TOTAL_NODES) {
      maskExhausted();
      onWarn('smask.group.unevaluated', 'budget');
      return null;
    }
    const region = maskRegion(def.bbox, base);
    if (!region) { onWarn('smask.group.unevaluated', 'bbox'); return null; }

    maskBudget--;
    maskInFlight.add(key);
    maskDepth++;
    const sub: Sink = { nodes: [], count: 0, max: MASK_MAX_NODES };
    // baseClips = the TRUE transformed bbox quad, not the AABB: under a rotation the
    // AABB is larger than the group's real extent, and `run` threads baseClips for
    // free, so the group's content is clipped exactly where the spec says it stops.
    try { run(def.content, def.resources || {}, base, depth + 1, [], [region.clip], '', sub); }
    catch { /* an untrusted stream must never take the page down */ }
    finally { maskInFlight.delete(key); maskDepth--; maskNodesSpent += sub.count; }

    let out: MaskEval;
    if (sub.count >= MASK_MAX_NODES) {
      // A mask group is a raster or a small shape. Something that paints 64+ nodes is
      // not a mask we understand, and half a mask is worse than none.
      onWarn('smask.group.unevaluated', 'nodes');
      maskCache.set(key, null);
      return null;
    }
    if (!sub.nodes.length) {
      // Nothing painted → the group's luminosity is the backdrop, which defaults to
      // black = 0 → fully masked out. EXACT per section 11.6.5.2, not a guess: paint nothing.
      out = { kind: 'none' };
      onWarn('smask.group.empty', def.id);
    } else {
      const c = constantMask(sub.nodes, region, def.subtype === 'Alpha' ? 'Alpha' : 'Luminosity');
      if (c != null) {
        out = { kind: 'constant', value: c };
        onWarn('smask.group.folded', def.id);
      } else {
        // Group ids are resolved page-wide from the page sink; a mask's children are
        // never part of that, and pdf-svg does not read them inside a <mask>.
        for (const n of sub.nodes) delete n._groupPath;
        out = {
          kind: 'mask',
          mask: { key, nodes: sub.nodes, x: region.x, y: region.y, w: region.w, h: region.h, subtype: def.subtype === 'Alpha' ? 'Alpha' : 'Luminosity' },
        };
        onWarn('smask.group.applied', def.id);
        // /S /Alpha becomes mask-type="alpha", which browsers implement and resvg
        // does not - worth saying so rather than silently emitting it.
        if (def.subtype === 'Alpha') onWarn('smask.alpha.approx', def.id);
      }
    }
    maskCache.set(key, out);
    return out;
  };

  run(page.content || '', page, flip, 0, [], [], '', pageSink);

  // Resolve each node's group: the innermost enclosing frame that actually holds ≥2 nodes
  // wins (so a q…Q wrapper around a single item, or a one-object layer, doesn't become a
  // group), else ungrouped. Flat single id - nested groups collapse to the tightest real one.
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
/** #rgb / #rrggbb → [r,g,b] 0–255, else null. Only the forms this interpreter
 *  itself emits are accepted (everything upstream went through safeColor). */
function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
  if (!m) return null;
  const h = m[1]!;
  const p = h.length === 3
    ? [h[0]! + h[0]!, h[1]! + h[1]!, h[2]! + h[2]!]
    : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  return [parseInt(p[0]!, 16), parseInt(p[1]!, 16), parseInt(p[2]!, 16)];
}

/** The flat colour a painted node carries, if any ('none' is not a colour). */
function nodeFlat(n: PdfNode): string {
  const v = n.fill || (n._vectorFill && n._vectorFill !== 'none' ? n._vectorFill : '') || n._gradient?.flat || '';
  return hexRgb(v) ? v : '';
}

/** Area-weighted (and alpha-weighted) mean of a node set's flat colours - the
 *  tiling-pattern fallback. Naive sRGB averaging: this is a "something visible
 *  rather than nothing" rung, not a colour-management path. */
function meanNodeColor(list: PdfNode[]): string {
  let r = 0, g = 0, b = 0, wsum = 0;
  for (const n of list) {
    const c = hexRgb(nodeFlat(n));
    if (!c) continue;
    const a = Math.max(0, n.w) * Math.max(0, n.h) * (clamp(typeof n.opacity === 'number' ? n.opacity : 100, 0, 100) / 100);
    if (!(a > 0)) continue;
    r += c[0] * a; g += c[1] * a; b += c[2] * a; wsum += a;
  }
  if (!wsum) return '';
  return rgbHex(r / wsum / 255, g / wsum / 255, b / wsum / 255);
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
    if (sg.op === 'h') continue;                  // close marker, not a corner
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
    if (sg.op === 'h') { d += 'Z'; }
    else if (sg.op === 'm') { track(sg.pts[0]!, sg.pts[1]!); d += `M${r(sg.pts[0]!)} ${r(sg.pts[1]!)}`; }
    else if (sg.op === 'l') { track(sg.pts[0]!, sg.pts[1]!); d += `L${r(sg.pts[0]!)} ${r(sg.pts[1]!)}`; }
    else { track(sg.pts[0]!, sg.pts[1]!); track(sg.pts[2]!, sg.pts[3]!); track(sg.pts[4]!, sg.pts[5]!); d += `C${r(sg.pts[0]!)} ${r(sg.pts[1]!)} ${r(sg.pts[2]!)} ${r(sg.pts[3]!)} ${r(sg.pts[4]!)} ${r(sg.pts[5]!)}`; }
  }
  if (!isFinite(minX)) return { d: '', x: 0, y: 0, w: 0, h: 0 };
  // NO unconditional 'Z'. It used to be appended to every path, which is invisible
  // on a FILL (SVG closes subpaths implicitly when filling) but draws a false edge
  // on a STROKE: an open 3-point chevron `M7 8 L3 12 L7 16` became a triangle. That
  // is every open stroked icon in the app - arrowheads especially, which is how it
  // was spotted. Closure now comes only from an explicit `h` marker.
  return { d, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * WinAnsiEncoding (CP1252) bytes 0x80–0x9F → their real characters.
 *
 * A simple font with no /ToUnicode falls back to treating each byte as a code
 * point, which is Latin-1 - and Latin-1 is right for EVERY byte except this
 * range, where CP1252 puts printable punctuation and Latin-1 puts C1 control
 * characters. WinAnsiEncoding is the default for non-symbolic simple fonts in
 * practice, so without this table the most ordinary punctuation in English
 * publishing decodes to invisible controls: smart quotes (0x91–0x94), the
 * en/em dash (0x96/0x97), the bullet (0x95) and the ellipsis (0x85).
 *
 * Sparse on purpose - 0x81, 0x8D, 0x8F, 0x90 and 0x9D are unassigned in CP1252,
 * so those keep the pass-through rather than inventing a character.
 */
const WIN_ANSI_HIGH: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”',
  0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™',
  0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

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
// loop that OOM-crashes the process - never trust the declared span. Ranges
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
