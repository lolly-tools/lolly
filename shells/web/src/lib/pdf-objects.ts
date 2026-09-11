// SPDX-License-Identifier: MPL-2.0
/**
 * PDF object access + function / shading / pattern decoding (pure pdf-lib, no DOM).
 *
 * Extracted from views/pdf-import.ts so this - the part that decides whether a fill
 * survives at all - can be unit-tested against real in-memory PDF dictionaries
 * without dragging a view module (and its CSS imports) into a node test. The view
 * keeps the browser-only work: canvases, image decoding, storage, dialogs.
 *
 * Everything here answers one question: what colour does this paint resolve to, and
 * in what form can the PURE engine consume it? The engine never evaluates a PDF
 * /Function and never sees a PostScript program - it receives a pre-sampled colour
 * ramp, a flat colour, or an opaque raster-tile key.
 *
 * Soft masks (PDF 32000-1 section 11.6.5) are no longer the gap this header used to record:
 * views/pdf-import.ts pre-decodes the mask group and the engine emits a real SVG
 * `<mask>`. What lives here is the part of that decision which is pure object
 * arithmetic and therefore testable - `groupColorSpace` / `backdropLuminosity` (does
 * the /BC backdrop hide or reveal?) and `softMaskId` (when are two /SMask dicts the
 * same mask?). Both answer questions the shell must settle before the engine, which
 * never sees a PDF object, can do anything with the mask.
 */

import { PDFName, PDFDict, PDFArray, PDFNumber, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import type { PDFContext, PDFObject } from 'pdf-lib';
import type { PdfShading, PdfPattern, PdfGradientStop, PdfResources } from '../../../../engine/src/pdf-map.ts';
import {
  classifyFunctionShading, sampleStops, type ColorFn, type TileSource,
} from './pdf-shading.ts';
import { compilePostScriptCalculator } from './pdf-ps-calc.ts';

/** A pdf-lib lookup key - a value we can hand to `ctx.lookup(...)`. We also let
 *  `null` through (some helpers pass a `dictOf(...) → PDFDict | null` result
 *  straight back in), mirroring `ctx.lookup(null)` simply yielding undefined. */
export type Ref = PDFObject | null | undefined;

/**
 * The state a resource walk threads through the decoders here.
 *
 * `resources` is INJECTED rather than imported: a tiling pattern owns a full
 * /Resources dict (fonts, images, further patterns), and the walker that handles
 * images needs the browser. Passing it in keeps the cycle broken and keeps this
 * module DOM-free.
 */
export interface ShadingCtx {
  ctx: PDFContext;
  /** Function-based shadings that need a raster tile, keyed by `tileKey`. */
  tiles: Map<string, TileSource>;
  /** Report a resource we could not reproduce, prefixed with a stable dotted code
   *  so a caller (the docs-shot audit) can tally categories. */
  warn: (msg: string) => void;
  /** Recurse into a nested /Resources dict. */
  resources: (dict: Ref, depth: number) => PdfResources;
}

// ── generic object access ────────────────────────────────────────────────────

export function dictOf(ctx: PDFContext, o: Ref): PDFDict | null { o = ctx.lookup(o as PDFObject | undefined); return (o instanceof PDFRawStream) ? o.dict : (o instanceof PDFDict ? o : null); }
export function getKey(ctx: PDFContext, o: Ref, key: string): PDFObject | undefined { const d = dictOf(ctx, o); return d ? d.get(PDFName.of(key)) : undefined; }
export function numOf(ctx: PDFContext, o: Ref): number | null { o = ctx.lookup(o as PDFObject | undefined); return o instanceof PDFNumber ? o.asNumber() : null; }
export function nameOf(ctx: PDFContext, o: Ref): string | null { o = ctx.lookup(o as PDFObject | undefined); return o instanceof PDFName ? o.asString().replace(/^\//, '') : null; }
export function decodedText(ctx: PDFContext, o: Ref): string | null {
  o = ctx.lookup(o as PDFObject | undefined);
  if (o instanceof PDFRawStream) { try { return new TextDecoder('latin1').decode(decodePDFRawStream(o).decode()); } catch { return null; } }
  return null;
}

export function numArray(ctx: PDFContext, o: Ref): number[] | null {
  o = ctx.lookup(o as PDFObject | undefined);
  return o instanceof PDFArray ? o.asArray().map((v) => numOf(ctx, v) ?? 0) : null;
}
export function boolArray(ctx: PDFContext, o: Ref): boolean[] {
  o = ctx.lookup(o as PDFObject | undefined);
  // PDFBool stringifies to "true"/"false"; avoids importing the class.
  return o instanceof PDFArray ? o.asArray().map((v) => String(ctx.lookup(v)) === 'true') : [];
}

/** A shading/image colour-space object → a device space NAME.
 *  ICCBased is an embedded profile with no device name - resolved by /N. */
export function colorSpaceName(ctx: PDFContext, o: Ref): string | null {
  o = ctx.lookup(o as PDFObject | undefined);
  if (o instanceof PDFName) return o.asString().replace(/^\//, '');
  if (o instanceof PDFArray && o.size()) {
    const head = nameOf(ctx, o.get(0));
    // ICCBased is an embedded profile with no device name - resolve it to a
    // device space by its component count (/N). Chromium encodes EVERY print
    // raster as [/ICCBased <N=3>], so without this every screenshot/photo on a
    // captured page decodes as "unsupported" and drops.
    if (head === 'ICCBased') {
      const n = numOf(ctx, dictOf(ctx, o.get(1))?.get(PDFName.of('N')));
      return n === 1 ? 'DeviceGray' : n === 4 ? 'DeviceCMYK' : 'DeviceRGB';
    }
    return head;
  }
  return null;
}

/** Colour space names that mean something on their own as a bare `/Name` operand.
 *  Anything else written as a bare name is a key into a /Resources /ColorSpace
 *  dict (PDF 32000-1 section 8.6.3), not a space. */
const BARE_SPACES = new Set(['DeviceGray', 'DeviceRGB', 'DeviceCMYK', 'Pattern']);

/**
 * The colour space of a transparency group XObject - its `/Group /CS`, reduced to a
 * device/CIE space NAME (PDF 32000-1 section 11.6.6, Table 147).
 *
 * WHY this exists separately from `colorSpaceName`: `/CS` may be written as a bare
 * name that is NOT a device space, in which case section 8.6.3 says it names an entry in the
 * *form's own* `/Resources /ColorSpace` dict - Illustrator and InDesign both do this
 * (`/CS /CS0`) where Chromium always writes `/DeviceRGB` inline. One level of
 * indirection is resolved; deeper chains and unresolvable names return null so the
 * caller refuses rather than guessing.
 *
 * `gRef` is the group form XObject (the soft mask's `/G`), not the group dict.
 */
export function groupColorSpace(ctx: PDFContext, gRef: Ref): string | null {
  const cs = ctx.lookup(getKey(ctx, dictOf(ctx, getKey(ctx, gRef, 'Group')), 'CS'));
  if (!cs) return null;
  const direct = colorSpaceName(ctx, cs);
  if (cs instanceof PDFName && direct && !BARE_SPACES.has(direct)) {
    const viaRes = getKey(ctx, getKey(ctx, getKey(ctx, gRef, 'Resources'), 'ColorSpace'), direct);
    return viaRes === undefined ? null : colorSpaceName(ctx, viaRes);
  }
  return direct;
}

/**
 * The registry behind `softMaskId` - one per page walk.
 *
 * `groups` collapses object identity (fifty ExtGStates naming the same shadow group
 * are one group); `ids` collapses full mask identity. Both are plain Maps so the
 * caller owns their lifetime and nothing is shared between documents.
 */
export interface SoftMaskIdRegistry {
  groups: Map<object, number>;
  ids: Map<string, string>;
}

/**
 * Mint the opaque id the engine memoises an evaluated soft mask under, and dedups its
 * `<mask>` def by.
 *
 * The unit of identity is the MASK, not the group. The engine's memo key is
 * (id, base transform), so two /SMask dictionaries that share one /G form but differ in
 * /S, /TR or /BC must get different ids - otherwise the second is silently served the
 * first's evaluation, and an /Alpha mask renders with /Luminosity semantics (no
 * `mask-type="alpha"` ever reaches the SVG). Observed with Illustrator files that reuse
 * a single blur group for both an alpha and a luminosity mask.
 *
 * Conversely everything that does NOT distinguish the dicts must collapse, or a page
 * with fifty shadows emits fifty identical `<mask>` defs instead of one.
 */
export function softMaskId(
  reg: SoftMaskIdRegistry, g: object, subtype: string, transfer: boolean, backdrop?: number,
): string {
  let gid = reg.groups.get(g);
  if (gid === undefined) { gid = reg.groups.size; reg.groups.set(g, gid); }
  // Backdrop is quantised into the key: it is a continuous value and only its
  // rendered effect distinguishes two masks.
  const variant = `${gid}|${subtype}|${transfer ? 1 : 0}|${backdrop === undefined ? '' : Math.round(backdrop * 1e4)}`;
  let id = reg.ids.get(variant);
  if (!id) { id = `sm${reg.ids.size}`; reg.ids.set(variant, id); }
  return id;
}

/**
 * A soft mask's `/BC` backdrop colour → its LUMINOSITY in 0..1, or null when the
 * colour space is one we cannot convert (the caller must then refuse the mask).
 *
 * This is the whole point of reading the group's colour space. section 11.6.5.2 composites
 * the group against a full-plane backdrop of `/BC` and takes the luminosity of the
 * result: luminosity 0 (the DEFAULT when /BC is absent) hides everything outside the
 * group's /BBox, luminosity 1 reveals it. In an ADDITIVE space (DeviceGray/RGB,
 * CalGray/CalRGB, Lab, and ICCBased resolved to those) all-zero components are BLACK;
 * in a SUBTRACTIVE one (DeviceCMYK) all-zero is WHITE - the exact inversion. Reading
 * `/BC` without its space therefore gets print/Illustrator PDFs backwards in the
 * unsafe direction: DeviceCMYK white `[0 0 0 0]` read as black hides live artwork.
 *
 * Formulas are the spec's own: Y = 0.3R + 0.59G + 0.11B (section 11.6.5.2), with DeviceCMYK
 * first converted by R = 1 − min(1, C + K) (section 10.4.2.1).
 *
 * DELIBERATE LIMITATIONS, all of which return null (= refuse, the safe direction - 
 * the mask is dropped and content stays visible):
 *   • /Separation and /DeviceN are subtractive but their luminosity needs the tint
 *     transform function evaluated into the alternate space. Their common case, an
 *     all-zero tint, is white = refuse anyway, so evaluating buys almost nothing.
 *   • /Indexed and /Pattern are not legal group spaces (section 11.6.6) - refused.
 *   • A component count that disagrees with the space is malformed - refused.
 */
export function backdropLuminosity(cs: string | null, bc: number[]): number | null {
  if (!bc.length || bc.some((v) => !Number.isFinite(v))) return null;
  const cl = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
  // Quantised to 1e-6: the weights sum to 0.9999999999999999 in binary floating point,
  // and white must report exactly 1 so the endpoints stay exact.
  const luma = (r: number, g: number, b: number): number =>
    Math.round(cl(0.3 * r + 0.59 * g + 0.11 * b) * 1e6) / 1e6;
  switch (cs) {
    case 'DeviceGray': case 'CalGray':
      return bc.length === 1 ? cl(bc[0]!) : null;
    case 'DeviceRGB': case 'CalRGB':
      return bc.length === 3 ? luma(cl(bc[0]!), cl(bc[1]!), cl(bc[2]!)) : null;
    // Lab's L* axis is 0..100 and L* = 0 is black, which is the distinction that
    // matters here; the L*→Y curve itself is not modelled.
    case 'Lab':
      return bc.length === 3 ? cl(bc[0]! / 100) : null;
    case 'DeviceCMYK':
      return bc.length === 4
        ? luma(1 - cl(bc[0]! + bc[3]!), 1 - cl(bc[1]! + bc[3]!), 1 - cl(bc[2]! + bc[3]!))
        : null;
    default: return null;
  }
}

// ── shadings & gradients ────────────────────────────────────────────────────
//
// PDF shadings → a normalized descriptor the engine can emit. The byte work - 
// evaluating the PDF /Function that maps the domain to colour - lives HERE (in the
// shell), so the pure engine only ever sees a pre-sampled colour ramp, a flat
// colour, or an opaque raster-tile key.
//
//   • ShadingType 2/3 (axial/radial) → an SVG <linearGradient>/<radialGradient>.
//   • ShadingType 1 (function-based) → classified by lib/pdf-shading.ts down a
//     three-rung ladder (constant / near-linear / irreducibly 2-D). This is how
//     Chromium prints CSS `oklch()`, `conic-gradient()` and wide-gamut interpolated
//     gradients - NOT as an axial shading - so it is the path a colour-heavy app
//     screenshot actually takes.
//   • ShadingTypes 4–7 (free-form / lattice / Coons / tensor meshes) are still
//     dropped. Chromium does not emit them from the print path; DELIBERATE.
//
// Functions: Type 0 (sampled), 2 (exponential), 3 (stitching) and 4 (PostScript
// calculator, via lib/pdf-ps-calc.ts). Type 4 outside a shading - a transfer
// function, a /Separation or /DeviceN tint transform in numeric `scn` operands - is
// NOT wired up; DELIBERATE.

/** A parsed PDF function: input value(s) → colour components (each in [0,1]), or
 *  null when the function faulted. Multi-input for the function-based shading path;
 *  every 1-in call site passes a single argument unchanged. */
type PdfFn = ColorFn;
/** Component count for a shading colour space (device or ICCBased-resolved). */
export function shadingComps(cs: string | null): number {
  return cs ? (/CMYK/i.test(cs) ? 4 : /Gray/i.test(cs) ? 1 : 3) : 3;
}
// A shading /Function is one function, or an array of n single-output functions
// (one per colour component). Return a single inputs → components evaluator either
// way. The array branch forwards ALL inputs - a function-based shading's component
// functions are 2-in, and dropping the second would collapse every wheel to a line.
function parseShadingFunction(ec: ShadingCtx, o: Ref): PdfFn | null {
  const ctx = ec.ctx;
  const lu = ctx.lookup(o as PDFObject | undefined);
  if (lu instanceof PDFArray) {
    const fns = lu.asArray().map((f) => parseFunction(ec, f, 0));
    if (!fns.length || fns.some((f) => !f)) return null;
    return (...inputs) => {
      const out: number[] = [];
      for (const f of fns) {
        const r = f!(...inputs);
        if (!r) return null;         // a fault must never read as black
        out.push(r[0] ?? 0);
      }
      return out;
    };
  }
  return parseFunction(ec, o, 0);
}

// PDF functions: Type 2 (exponential), Type 3 (stitching), Type 0 (sampled stream),
// Type 4 (PostScript calculator).
//
// Type 0 stays 1-in here on purpose: a multilinear N-dimensional sampled function is
// real but is NOT what Chromium emits for a function-based shading, so it would be
// unmotivated machinery. A 2-in Type 0 therefore falls through to `null` and the
// shading degrades to its flat/tile rung.
function parseFunction(ec: ShadingCtx, o: Ref, depth: number): PdfFn | null {
  const ctx = ec.ctx;
  if (depth > 8) return null;
  const d = dictOf(ctx, o);
  if (!d) return null;
  const type = numOf(ctx, d.get(PDFName.of('FunctionType')));
  const domain = numArray(ctx, d.get(PDFName.of('Domain'))) || [0, 1];
  const d0 = domain[0] ?? 0, d1 = domain[1] ?? 1;
  const clampT = (t: number): number => (t < d0 ? d0 : t > d1 ? d1 : t);

  if (type === 2) {
    const c0 = numArray(ctx, d.get(PDFName.of('C0'))) || [0];
    const c1 = numArray(ctx, d.get(PDFName.of('C1'))) || [1];
    const N = numOf(ctx, d.get(PDFName.of('N'))) ?? 1;
    return (t) => { const p = Math.pow(clampT(t), N); return c0.map((c, j) => c + p * ((c1[j] ?? c) - c)); };
  }

  if (type === 3) {
    const subs = (ctx.lookup(d.get(PDFName.of('Functions'))) as PDFObject | undefined);
    const fnRefs = subs instanceof PDFArray ? subs.asArray() : [];
    const fns = fnRefs.map((f) => parseFunction(ec, f, depth + 1));
    if (!fns.length || fns.some((f) => !f)) return null;
    const bounds = numArray(ctx, d.get(PDFName.of('Bounds'))) || [];
    const encode = numArray(ctx, d.get(PDFName.of('Encode'))) || [];
    const k = fns.length;
    return (t) => {
      const tt = clampT(t);
      let i = 0;
      while (i < bounds.length && i < k - 1 && tt >= (bounds[i] ?? Infinity)) i++;
      const lo = i === 0 ? d0 : (bounds[i - 1] ?? d0);
      const hi = i >= k - 1 ? d1 : (bounds[i] ?? d1);
      const e0 = encode[2 * i] ?? 0, e1 = encode[2 * i + 1] ?? 1;
      const x = hi > lo ? e0 + (tt - lo) * (e1 - e0) / (hi - lo) : e0;
      return fns[i]!(x);
    };
  }

  if (type === 0) return parseSampledFunction(ctx, o, d0, d1);

  // Type 4 - a PostScript calculator program. Compiled ONCE here (the classifier
  // makes ~550 calls per shading), and clipped to /Domain per input per section 7.10.2.
  if (type === 4) {
    const src = decodedText(ctx, o);
    const range = numArray(ctx, d.get(PDFName.of('Range'))) || [];
    const nIn = Math.max(1, Math.floor(domain.length / 2));
    const calc = src ? compilePostScriptCalculator(src, nIn, range) : null;
    if (!calc) { ec.warn('function.type4.unparsed'); return null; }
    return (...inputs) => {
      const argv: number[] = [];
      for (let i = 0; i < nIn; i++) {
        const lo = domain[2 * i] ?? 0, hi = domain[2 * i + 1] ?? 1;
        const v = inputs[i] ?? lo;
        argv.push(v < lo ? lo : v > hi ? hi : v);
      }
      return calc(argv);
    };
  }
  return null;
}

// Type 0 sampled function: a stream of N samples × M components packed at
// BitsPerSample bits, big-endian. Linear-interpolate between the two nearest
// samples and decode each component to its output range.
function parseSampledFunction(ctx: PDFContext, o: Ref, d0: number, d1: number): PdfFn | null {
  const stream = ctx.lookup(o as PDFObject | undefined);
  if (!(stream instanceof PDFRawStream)) return null;
  const d = stream.dict;
  const size = numArray(ctx, d.get(PDFName.of('Size'))) || [];
  const range = numArray(ctx, d.get(PDFName.of('Range'))) || [];
  const bps = numOf(ctx, d.get(PDFName.of('BitsPerSample'))) ?? 8;
  const n = Math.floor(size[0] ?? 0), m = Math.floor(range.length / 2);
  if (n < 1 || m < 1 || bps < 1 || bps > 32) return null;
  const encode = numArray(ctx, d.get(PDFName.of('Encode'))) || [0, n - 1];
  const decode = numArray(ctx, d.get(PDFName.of('Decode'))) || range;
  let bytes: Uint8Array;
  try { bytes = decodePDFRawStream(stream).decode(); } catch { return null; }
  if (bytes.length < Math.ceil((n * m * bps) / 8)) return null;
  const maxVal = Math.pow(2, bps) - 1;
  const sampleAt = (idx: number, comp: number): number => {
    let bit = (idx * m + comp) * bps, v = 0;
    for (let b = 0; b < bps; b++, bit++) v = (v << 1) | ((bytes[bit >> 3]! >> (7 - (bit & 7))) & 1);
    return v;
  };
  return (t) => {
    const tt = t < d0 ? d0 : t > d1 ? d1 : t;
    let e = d1 > d0 ? (encode[0] ?? 0) + (tt - d0) * ((encode[1] ?? n - 1) - (encode[0] ?? 0)) / (d1 - d0) : (encode[0] ?? 0);
    e = e < 0 ? 0 : e > n - 1 ? n - 1 : e;
    const i0 = Math.floor(e), i1 = Math.min(n - 1, i0 + 1), frac = e - i0;
    const out: number[] = [];
    for (let c = 0; c < m; c++) {
      const s = sampleAt(i0, c) + (sampleAt(i1, c) - sampleAt(i0, c)) * frac;
      const dl = decode[2 * c] ?? 0, dh = decode[2 * c + 1] ?? 1;
      out.push(dl + (s / maxVal) * (dh - dl));
    }
    return out;
  };
}

export function buildShading(ec: ShadingCtx, o: Ref): PdfShading | null {
  const ctx = ec.ctx;
  const d = dictOf(ctx, o);
  if (!d) return null;
  const type = numOf(ctx, d.get(PDFName.of('ShadingType')));
  const comps = shadingComps(colorSpaceName(ctx, d.get(PDFName.of('ColorSpace'))));
  if (type === 1) return buildFunctionShading(ec, d, comps);
  if (type !== 2 && type !== 3) { ec.warn(`shading.unsupported (ShadingType ${type ?? '?'})`); return null; }
  const coords = numArray(ctx, d.get(PDFName.of('Coords'))) || [];
  if ((type === 2 && coords.length < 4) || (type === 3 && coords.length < 6)) { ec.warn('shading.unsupported (bad Coords)'); return null; }
  const fn = parseShadingFunction(ec, d.get(PDFName.of('Function')));
  if (!fn) { ec.warn('shading.unsupported (unparsable Function)'); return null; }
  const domain = numArray(ctx, d.get(PDFName.of('Domain'))) || [0, 1];
  const stops = sampleStops(fn, domain, comps);
  if (stops.length < 2) { ec.warn('shading.unsupported (degenerate ramp)'); return null; }
  const ext = boolArray(ctx, d.get(PDFName.of('Extend')));
  return {
    type: type as 2 | 3, coords, stops,
    extend: [ext[0] ?? false, ext[1] ?? false],
    flat: stops[Math.floor(stops.length / 2)]!.color,
  };
}

/**
 * ShadingType 1 - a colour function over a 2-D domain rectangle (PDF 32000-1
 * section 8.7.4.5.3, Table 78). Classified into one of three rungs by lib/pdf-shading.ts:
 *
 *   flat      → a `type: 1` shading carrying ONLY `flat`. `buildPattern` unwraps
 *               that to a plain colour so the interpreter never builds a gradient
 *               def that can only resolve to its own fallback. The bulk win.
 *   axialised → a synthesised ShadingType 2 along the fitted direction: real
 *               vector output, indistinguishable from a natively-axial gradient.
 *   tiled     → the domain + a raster-tile key, registered in `ec.tiles` but NOT
 *               rasterised yet, plus the mean colour as the back-stop.
 *
 * The shading's own /Matrix (Table 79) rides on `shadingMatrix` for the interpreter
 * to compose. Baking it into the coords would be exact only for a similarity
 * transform and silently wrong under skew.
 */
function buildFunctionShading(ec: ShadingCtx, d: PDFDict, comps: number): PdfShading | null {
  const ctx = ec.ctx;
  const fn = parseShadingFunction(ec, d.get(PDFName.of('Function')));
  if (!fn) { ec.warn('shading.unsupported (function-based, unparsable Function)'); return null; }
  const dom = numArray(ctx, d.get(PDFName.of('Domain'))) || [0, 1, 0, 1];
  const domain: [number, number, number, number] = [dom[0] ?? 0, dom[1] ?? 1, dom[2] ?? 0, dom[3] ?? 1];
  const mtx = numArray(ctx, d.get(PDFName.of('Matrix')));
  const base = {
    coords: [] as number[],
    stops: [] as PdfGradientStop[],
    extend: [false, false] as [boolean, boolean],
    ...(mtx && mtx.length >= 6 ? { shadingMatrix: mtx } : {}),
  };

  const cls = classifyFunctionShading(fn, comps, domain);
  if (cls.rung === 'failed') { ec.warn('shading.unsupported (function-based, unevaluable)'); return null; }
  if (cls.rung === 'flat') { ec.warn('shading.type1.flat'); return { type: 1, ...base, domain, flat: cls.flat }; }
  if (cls.rung === 'axial') {
    ec.warn('shading.type1.axialised');
    return { type: 2, ...base, coords: cls.coords!, stops: cls.stops!, extend: [true, true], flat: cls.flat };
  }
  const tileKey = `shd${ec.tiles.size}`;
  ec.tiles.set(tileKey, { evaluate: fn, comps, domain });
  ec.warn('shading.type1.tiled');
  return { type: 1, ...base, domain, tileKey, flat: cls.flat };
}

/**
 * A PDF Pattern resource → the engine's PdfPattern.
 *
 * PatternType 2 (shading) → { shading, matrix, flat }.
 * PatternType 1 (tiling)  → { tiling, matrix }: the decoded tile stream plus its
 *   own recursively-extracted resources. The shell has no content-stream tokenizer
 *   and must not grow one - the ENGINE re-interprets the tile (its collapse
 *   pre-pass) and decides what the tile actually paints. This is what makes
 *   Chromium's `/Pattern cs /P5 scn <bbox> re f*` wrapper transparent to us.
 *   A self-referential pattern is cut off by the depth cap in `extractResources`.
 */
export function buildPattern(ec: ShadingCtx, o: Ref, depth: number): PdfPattern | null {
  const ctx = ec.ctx;
  const d = dictOf(ctx, o);
  if (!d) return null;
  const ptype = numOf(ctx, d.get(PDFName.of('PatternType')));
  const matrix = numArray(ctx, d.get(PDFName.of('Matrix'))) || undefined;

  if (ptype === 2) {
    const shading = buildShading(ec, d.get(PDFName.of('Shading')));
    if (!shading) return null;   // buildShading already warned with the reason
    // A CONSTANT function-based shading is just a colour - say so, rather than
    // shipping a gradient the serializer can only decline.
    if (shading.type === 1 && !shading.tileKey) return { flat: shading.flat, matrix };
    return { shading, matrix, ...(shading.flat ? { flat: shading.flat } : {}) };
  }

  if (ptype === 1) {
    const content = decodedText(ctx, o);
    const bb = numArray(ctx, d.get(PDFName.of('BBox'))) || [];
    if (content == null || bb.length < 4) { ec.warn('pattern.unsupported (tiling, no stream or BBox)'); return null; }
    const bbox: [number, number, number, number] = [bb[0]!, bb[1]!, bb[2]!, bb[3]!];
    return {
      matrix,
      tiling: {
        content,
        resources: ec.resources(d.get(PDFName.of('Resources')), depth + 1),
        bbox,
        xStep: numOf(ctx, d.get(PDFName.of('XStep'))) || (bbox[2] - bbox[0]),
        yStep: numOf(ctx, d.get(PDFName.of('YStep'))) || (bbox[3] - bbox[1]),
        paintType: numOf(ctx, d.get(PDFName.of('PaintType'))) === 2 ? 2 : 1,
      },
    };
  }

  ec.warn(`pattern.unsupported (PatternType ${ptype ?? '?'})`);
  return null;
}
