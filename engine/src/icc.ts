// SPDX-License-Identifier: MPL-2.0
/**
 * ICC profile reader — the authority for "what can this device actually print?".
 *
 * Everything else in the engine's colour stack works in additive light: a 3×3
 * and a transfer curve describe sRGB, P3 and Rec.2020 completely. A press does
 * not work that way. Its gamut is a measured lookup table, its neutral axis is
 * four inks deep, and the only honest description of it is the ICC profile the
 * printer hands you. This module reads that file and evaluates its transforms,
 * so `gamut-source.ts` can answer the same membership question for a press that
 * it answers for a monitor, and so an export can be soft-proofed before it is
 * committed to plate.
 *
 * Scope: enough of ICC.1:2010 (v2 and v4) to run a device↔PCS transform —
 *   - the 128-byte header and the tag table (§7.2, §7.3);
 *   - `mft1` / `mft2` (lut8Type / lut16Type, §10.10–10.11) and `mAB ` / `mBA `
 *     (lutAtoBType / lutBtoAType, §10.12–10.13) for the A2B / B2A tags;
 *   - `curv` and `para` curves (§10.5, §10.16), the matrix/TRC path for
 *     three-component RGB profiles, and the single-curve path for GRAY;
 *   - `desc` (v2 textDescriptionType) and `mluc` (v4) for a human label.
 * Deliberately out of scope: named-colour tags, device-link chains, spectral
 * (`MS10`) data, the `gamt` gamut tag (Apple's own CMYK profile fills it with
 * 255 — "everything is out of gamut" — so trusting it would be worse than
 * ignoring it), and the v4 `chad` tag beyond noting its presence: a v2 or v4
 * profile's `rXYZ`/`gXYZ`/`bXYZ` are already D50-adapted in the file, and `chad`
 * only records the adaptation that got them there.
 *
 * SECURITY: profiles arrive embedded in user-supplied JPEG/PNG/PDF/TIFF, so
 * every byte here is hostile until proven otherwise. The contract is the
 * house reader contract (see png-unfilter.ts, file-metadata.ts): this module
 * NEVER throws on bad input — malformed, truncated or self-contradicting data
 * yields `null`. Nothing declared by the file is trusted: tag offsets and sizes
 * are re-checked against the real byte length (Apple's `gamt` tag over-reports
 * its size by one byte, so element geometry is derived from the element header
 * and the tag size is used only as an upper bound), channel counts, grid counts
 * and curve lengths are capped before any allocation, and CLUT sections must fit
 * inside both their own tag and the file.
 *
 * Pure and deterministic: no Date, no Math.random, no IO.
 */

import { convertColor } from './css-color.ts';
import { gamutInputSane, type GamutSource, type RenderingIntent } from './gamut-source.ts';

// ─── Caps ─────────────────────────────────────────────────────────────────────

// Every one of these bounds something a hostile file declares. The comparison
// point in each comment is the largest value seen across the 40-odd profiles
// shipped by macOS, so a real profile is nowhere near any of them.
const MAX_TAGS = 512;              // real profiles carry 10–20
const MAX_CHANNELS = 15;           // ICC's own ceiling (nCLR tops out at FCLR)
const MAX_TABLE_ENTRIES = 4096;    // ICC's cap for mft2 in/out tables; Black & White.icc uses exactly 4096
const MAX_CURVE_ENTRIES = 65536;   // a `curv` table; sRGB's TRC has 1024
const MAX_CLUT_VALUES = 1 << 22;   // 4 M float32 = 16 MB. A 33⁴×4 CMYK LUT is 4.7 M — refused, and no such profile exists
const MAX_PARA_PARAMS = 7;         // parametricCurveType function 4

// Bisection steps when inverting a curve: 2^-40 is far past float32 table precision.
const MAX_CURVE_INVERT_STEPS = 40;

// ─── Primitive reads ──────────────────────────────────────────────────────────
//
// Each returns a sentinel rather than throwing, and takes the exclusive `end` of
// the window it is allowed to touch — the tag's own end, not the file's, so a
// tag that lies about its size cannot read its neighbour. Bounds are checked
// BEFORE the read because an out-of-range Uint8Array index yields `undefined`,
// which NaN-poisons any arithmetic derived from it and silently defeats a later
// guard (the lesson der-read.ts records).

/** Big-endian u32, or -1 when the read would pass `end`. */
function u32(b: Uint8Array, p: number, end: number): number {
  if (p < 0 || p + 4 > end) return -1;
  return b[p]! * 0x1000000 + (b[p + 1]! << 16) + (b[p + 2]! << 8) + b[p + 3]!;
}

/** Big-endian u16, or -1 when the read would pass `end`. */
function u16(b: Uint8Array, p: number, end: number): number {
  if (p < 0 || p + 2 > end) return -1;
  return (b[p]! << 8) | b[p + 1]!;
}

/** Single byte, or -1 when out of range. */
function u8(b: Uint8Array, p: number, end: number): number {
  if (p < 0 || p + 1 > end) return -1;
  return b[p]!;
}

/** s15Fixed16Number (signed, /65536), or null when the read would pass `end`. */
function s15f16(b: Uint8Array, p: number, end: number): number | null {
  const v = u32(b, p, end);
  if (v < 0) return null;
  return (v >= 0x80000000 ? v - 0x100000000 : v) / 65536;
}

/** A 4-byte ASCII signature (space-padded, kept verbatim), or null out of range. */
function sig4(b: Uint8Array, p: number, end: number): string | null {
  if (p < 0 || p + 4 > end) return null;
  return String.fromCharCode(b[p]!, b[p + 1]!, b[p + 2]!, b[p + 3]!);
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

// ─── Curves ───────────────────────────────────────────────────────────────────

/**
 * A one-dimensional transfer curve, normalised: input and output are both 0–1
 * regardless of how the file encoded the samples.
 */
type Curve =
  | { kind: 'identity' }
  | { kind: 'gamma'; g: number }
  | { kind: 'table'; t: Float32Array }
  | { kind: 'para'; fn: number; p: number[] };

const IDENTITY_CURVE: Curve = { kind: 'identity' };

/** `x^g` with a negative base treated as 0 — pow would give NaN and poison the pipeline. */
const pow = (x: number, g: number): number => (x <= 0 ? 0 : x ** g);

/** Evaluate a curve at `x` (0–1 in, 0–1 out). Linear interpolation between table entries. */
function evalCurve(c: Curve, x: number): number {
  const v = clamp01(x);
  switch (c.kind) {
    case 'identity':
      return v;
    case 'gamma':
      return clamp01(pow(v, c.g));
    case 'table': {
      const n = c.t.length;
      if (n === 0) return v;
      if (n === 1) return c.t[0]!;
      const t = v * (n - 1);
      const i = Math.min(Math.floor(t), n - 2);
      const f = t - i;
      return c.t[i]! * (1 - f) + c.t[i + 1]! * f;
    }
    case 'para': {
      // ICC.1:2010 §10.16.1, parameters in file order g,a,b,c,d,e,f.
      const [g = 1, a = 1, bb = 0, cc = 0, d = 0, e = 0, f = 0] = c.p;
      switch (c.fn) {
        case 0:
          return clamp01(pow(v, g));
        case 1:
          return clamp01(v >= (a === 0 ? 0 : -bb / a) ? pow(a * v + bb, g) : 0);
        case 2:
          return clamp01(v >= (a === 0 ? 0 : -bb / a) ? pow(a * v + bb, g) + cc : cc);
        case 3:
          return clamp01(v >= d ? pow(a * v + bb, g) : cc * v);
        case 4:
          return clamp01(v >= d ? pow(a * v + bb, g) + e : cc * v + f);
        default:
          return v;
      }
    }
    default:
      return v;
  }
}

/**
 * Preimage of `y` under a curve assumed monotone increasing, by bisection on the
 * forward evaluation. One implementation serves tables, gammas and parametric
 * curves, which matters because a device's inverse is needed on the matrix/TRC
 * path where there is no B2A LUT to consult. A non-monotone curve (legal but
 * absent from every real profile) yields *some* preimage, not a defined one.
 */
function invertCurve(c: Curve, y: number): number {
  if (c.kind === 'identity') return clamp01(y);
  const target = clamp01(y);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < MAX_CURVE_INVERT_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (evalCurve(c, mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Parse a `curv` or `para` element at `off`.
 *
 * @returns the curve plus the byte length it occupied (mAB chains curves back to
 * back, each padded to a 4-byte boundary), or null on anything malformed.
 */
function parseCurve(b: Uint8Array, off: number, end: number): { curve: Curve; size: number } | null {
  const type = sig4(b, off, end);
  if (type === 'curv') {
    const count = u32(b, off + 8, end);
    if (count < 0 || count > MAX_CURVE_ENTRIES) return null;
    const size = 12 + count * 2;
    if (off + size > end) return null;
    // count 0 means identity; count 1 means the single value is a u8Fixed8 gamma,
    // NOT a one-entry table (§10.5) — reading it as a table would flatten the curve.
    if (count === 0) return { curve: IDENTITY_CURVE, size };
    if (count === 1) {
      const g = u16(b, off + 12, end);
      if (g < 0) return null;
      return { curve: { kind: 'gamma', g: g / 256 }, size };
    }
    const t = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const v = u16(b, off + 12 + i * 2, end);
      if (v < 0) return null;
      t[i] = v / 65535;
    }
    return { curve: { kind: 'table', t }, size };
  }
  if (type === 'para') {
    const fn = u16(b, off + 8, end);
    // Function types are 0–4; a higher value is a profile we cannot evaluate, and
    // guessing a parameter count from an unknown type would read arbitrary bytes.
    if (fn < 0 || fn > 4) return null;
    const counts = [1, 3, 4, 5, 7];
    const n = counts[fn]!;
    if (n > MAX_PARA_PARAMS) return null;
    const size = 12 + n * 4;
    if (off + size > end) return null;
    const p: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = s15f16(b, off + 12 + i * 4, end);
      if (v === null || !Number.isFinite(v)) return null;
      p.push(v);
    }
    return { curve: { kind: 'para', fn, p }, size };
  }
  return null;
}

// ─── Pipelines ────────────────────────────────────────────────────────────────

/**
 * One transform stage. A LUT element of any type reduces to an ordered list of
 * these, which is what lets `mft1`, `mft2`, `mAB ` and `mBA ` share a single
 * evaluator: they differ only in which stages exist and in what order.
 */
type Stage =
  | { kind: 'curves'; curves: Curve[] }
  /** 3×3 row-major, optionally followed by 3 offsets (mAB/mBA carry both). */
  | { kind: 'matrix'; m: number[] }
  | { kind: 'clut'; grid: number[]; nOut: number; data: Float32Array };

/**
 * How Lab is encoded on the PCS side of an element.
 *
 * THE DECISION, because getting it wrong shifts every colour by 0.4% of the
 * scale rather than failing: it is STRUCTURAL, never content-sniffed. `mft1` and
 * `mft2` are the v2-era tag types and always carry the legacy encoding, where
 * full-scale L*=100 is 0xFF00 rather than 0xFFFF (ICC.1:2010 Annex A). `mAB ` /
 * `mBA ` are only legal from v4 and always carry the full-range encoding.
 *
 * Normalised to 0–1 the two collapse into one formula for `mft1`, because 8-bit
 * legacy IS full-range (v/255 for L*, v−128 for a* and b*); only the 16-bit legacy
 * form needs the 65535/65280 correction. So this enum has two members, not
 * three, and `legacy16` applies to `mft2` alone.
 */
type LabEnc = 'legacy16' | 'full';

interface Pipeline {
  nIn: number;
  nOut: number;
  stages: Stage[];
  labEnc: LabEnc;
}

/** Multilinear (n-linear) CLUT interpolation — the reference method; tetrahedral is an optimisation of it. */
function evalClut(st: Extract<Stage, { kind: 'clut' }>, v: number[]): number[] | null {
  const nIn = st.grid.length;
  if (v.length !== nIn) return null;
  const strides = new Array<number>(nIn);
  // Last input channel varies fastest (§10.10): node = Σ idx[d] · Π grid[d+1..].
  let s = 1;
  for (let d = nIn - 1; d >= 0; d--) {
    strides[d] = s;
    s *= st.grid[d]!;
  }
  const base = new Array<number>(nIn);
  const frac = new Array<number>(nIn);
  for (let d = 0; d < nIn; d++) {
    const g = st.grid[d]!;
    const u = clamp01(v[d]!) * (g - 1);
    const j = Math.min(Math.floor(u), g - 2);
    base[d] = j;
    frac[d] = u - j;
  }
  const out = new Array<number>(st.nOut).fill(0);
  const corners = 1 << nIn;
  for (let corner = 0; corner < corners; corner++) {
    let w = 1;
    let node = 0;
    for (let d = 0; d < nIn; d++) {
      const bit = (corner >> d) & 1;
      w *= bit ? frac[d]! : 1 - frac[d]!;
      if (w === 0) break;
      node += (base[d]! + bit) * strides[d]!;
    }
    if (w === 0) continue;
    const o = node * st.nOut;
    if (o + st.nOut > st.data.length) return null;
    for (let k = 0; k < st.nOut; k++) out[k]! += w * st.data[o + k]!;
  }
  return out;
}

/** Run a pipeline over normalised 0–1 inputs. Returns null if any stage's arity disagrees. */
function evalPipeline(p: Pipeline, input: readonly number[]): number[] | null {
  if (input.length !== p.nIn) return null;
  let v = input.map(clamp01);
  for (const st of p.stages) {
    if (st.kind === 'curves') {
      if (st.curves.length !== v.length) return null;
      v = v.map((x, i) => evalCurve(st.curves[i]!, x));
    } else if (st.kind === 'matrix') {
      if (v.length !== 3) return null;
      const [x, y, z] = v as [number, number, number];
      const m = st.m;
      v = [
        m[0]! * x + m[1]! * y + m[2]! * z + (m[9] ?? 0),
        m[3]! * x + m[4]! * y + m[5]! * z + (m[10] ?? 0),
        m[6]! * x + m[7]! * y + m[8]! * z + (m[11] ?? 0),
      ];
    } else {
      const out = evalClut(st, v);
      if (!out) return null;
      v = out;
    }
  }
  if (v.length !== p.nOut) return null;
  for (const x of v) if (!Number.isFinite(x)) return null;
  return v.map(clamp01);
}

// ─── mft1 / mft2 ──────────────────────────────────────────────────────────────

/**
 * Parse a lut8Type (`mft1`) or lut16Type (`mft2`) element.
 *
 * @param inputIsPcsXyz whether this element's INPUT side is PCSXYZ — the only
 * case in which the element's 3×3 matrix means anything (§10.10). Every matrix
 * in every profile on a stock macOS install is identity, so applying it
 * unconditionally would be harmless there, but a device-specific profile with a
 * real matrix would be silently mangled on the Lab side.
 */
function parseMft(
  b: Uint8Array,
  off: number,
  end: number,
  bits: 8 | 16,
  inputIsPcsXyz: boolean,
): Pipeline | null {
  const nIn = u8(b, off + 8, end);
  const nOut = u8(b, off + 9, end);
  const g = u8(b, off + 10, end);
  if (nIn < 1 || nIn > MAX_CHANNELS || nOut < 1 || nOut > MAX_CHANNELS) return null;
  if (g < 2) return null; // grid interpolation divides by g-1

  const m: number[] = [];
  for (let i = 0; i < 9; i++) {
    const v = s15f16(b, off + 12 + i * 4, end);
    if (v === null || !Number.isFinite(v)) return null;
    m.push(v);
  }

  let n = 256;
  let mOut = 256;
  let p = off + 48;
  if (bits === 16) {
    n = u16(b, off + 48, end);
    mOut = u16(b, off + 50, end);
    // 2 is the legal minimum and real profiles use it (a bare "identity between
    // the endpoints"); 0 or 1 cannot be interpolated.
    if (n < 2 || n > MAX_TABLE_ENTRIES || mOut < 2 || mOut > MAX_TABLE_ENTRIES) return null;
    p = off + 52;
  }

  // Node count before allocating: g^nIn overflows fast (g=255, nIn=15 is a
  // 36-digit claim), so it is accumulated with a cap check on every multiply.
  let nodes = 1;
  for (let d = 0; d < nIn; d++) {
    nodes *= g;
    if (!Number.isSafeInteger(nodes) || nodes * nOut > MAX_CLUT_VALUES) return null;
  }
  const clutValues = nodes * nOut;

  const unit = bits === 8 ? 1 : 2;
  const maxVal = bits === 8 ? 255 : 65535;
  const inBytes = nIn * n * unit;
  const clutBytes = clutValues * unit;
  const outBytes = nOut * mOut * unit;
  if (!Number.isSafeInteger(inBytes + clutBytes + outBytes)) return null;
  if (p + inBytes + clutBytes + outBytes > end) return null;

  const readAt = (q: number): number => (bits === 8 ? u8(b, q, end) : u16(b, q, end));

  const inCurves: Curve[] = [];
  for (let d = 0; d < nIn; d++) {
    const t = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = readAt(p + (d * n + i) * unit);
      if (v < 0) return null;
      t[i] = v / maxVal;
    }
    inCurves.push({ kind: 'table', t });
  }
  const clutBase = p + inBytes;
  const data = new Float32Array(clutValues);
  for (let i = 0; i < clutValues; i++) {
    const v = readAt(clutBase + i * unit);
    if (v < 0) return null;
    data[i] = v / maxVal;
  }
  const outBase = clutBase + clutBytes;
  const outCurves: Curve[] = [];
  for (let k = 0; k < nOut; k++) {
    const t = new Float32Array(mOut);
    for (let i = 0; i < mOut; i++) {
      const v = readAt(outBase + (k * mOut + i) * unit);
      if (v < 0) return null;
      t[i] = v / maxVal;
    }
    outCurves.push({ kind: 'table', t });
  }

  const grid = new Array<number>(nIn).fill(g);
  const stages: Stage[] = [];
  if (inputIsPcsXyz) stages.push({ kind: 'matrix', m });
  stages.push({ kind: 'curves', curves: inCurves });
  stages.push({ kind: 'clut', grid, nOut, data });
  stages.push({ kind: 'curves', curves: outCurves });
  return { nIn, nOut, stages, labEnc: bits === 16 ? 'legacy16' : 'full' };
}

// ─── mAB / mBA ────────────────────────────────────────────────────────────────

/** Parse `count` back-to-back curves, each padded to a 4-byte boundary (§10.12). */
function parseCurveChain(b: Uint8Array, off: number, end: number, count: number): Curve[] | null {
  const out: Curve[] = [];
  let p = off;
  for (let i = 0; i < count; i++) {
    const c = parseCurve(b, p, end);
    if (!c) return null;
    out.push(c.curve);
    p += (c.size + 3) & ~3;
    if (p > end) return null;
  }
  return out;
}

/** Parse a lutAtoBType/lutBtoAType CLUT sub-element: per-axis grid counts, then 8- or 16-bit nodes. */
function parseMabClut(
  b: Uint8Array,
  off: number,
  end: number,
  nIn: number,
  nOut: number,
): Extract<Stage, { kind: 'clut' }> | null {
  if (off + 20 > end) return null;
  const grid: number[] = [];
  let nodes = 1;
  for (let d = 0; d < nIn; d++) {
    const g = u8(b, off + d, end);
    if (g < 2) return null;
    grid.push(g);
    nodes *= g;
    if (!Number.isSafeInteger(nodes) || nodes * nOut > MAX_CLUT_VALUES) return null;
  }
  const prec = u8(b, off + 16, end);
  if (prec !== 1 && prec !== 2) return null;
  const values = nodes * nOut;
  const dataOff = off + 20;
  if (dataOff + values * prec > end) return null;
  const maxVal = prec === 1 ? 255 : 65535;
  const data = new Float32Array(values);
  for (let i = 0; i < values; i++) {
    const v = prec === 1 ? u8(b, dataOff + i, end) : u16(b, dataOff + i * 2, end);
    if (v < 0) return null;
    data[i] = v / maxVal;
  }
  return { kind: 'clut', grid, nOut, data };
}

/**
 * Parse a v4 `mAB ` (A-to-B) or `mBA ` (B-to-A) element.
 *
 * The element is five optional pieces reached by offsets from the element start.
 * A-to-B runs A curves → CLUT → M curves → matrix → B curves; B-to-A runs the
 * same list backwards. Any piece may be absent (offset 0), which is how a v4
 * profile expresses a pure matrix/curve transform in the same tag.
 *
 * UNVERIFIED against a real file: no macOS-shipped profile uses these tags —
 * every LUT profile on a stock install is v2 with `mft1`/`mft2` — so this path is
 * exercised only by synthesised fixtures. Treated as best-effort accordingly.
 */
function parseMab(b: Uint8Array, off: number, end: number, atoB: boolean): Pipeline | null {
  const nIn = u8(b, off + 8, end);
  const nOut = u8(b, off + 9, end);
  if (nIn < 1 || nIn > MAX_CHANNELS || nOut < 1 || nOut > MAX_CHANNELS) return null;
  const offB = u32(b, off + 12, end);
  const offMat = u32(b, off + 16, end);
  const offM = u32(b, off + 20, end);
  const offClut = u32(b, off + 24, end);
  const offA = u32(b, off + 28, end);
  if (offB < 0 || offMat < 0 || offM < 0 || offClut < 0 || offA < 0) return null;

  // Channel counts on each side of the CLUT: for A-to-B the A curves are per
  // input and the B curves per output; B-to-A is the mirror image.
  const nA = atoB ? nIn : nOut;
  const nB = atoB ? nOut : nIn;

  const aCurves = offA ? parseCurveChain(b, off + offA, end, nA) : null;
  const bCurves = offB ? parseCurveChain(b, off + offB, end, nB) : null;
  // M curves sit between the matrix and the CLUT, and the matrix is 3×3 + 3
  // offsets, so both only exist on a three-channel side (§10.12.3).
  const mCurves = offM ? parseCurveChain(b, off + offM, end, 3) : null;
  if (offA && !aCurves) return null;
  if (offB && !bCurves) return null;
  if (offM && !mCurves) return null;

  let matrix: Stage | null = null;
  if (offMat) {
    const m: number[] = [];
    for (let i = 0; i < 12; i++) {
      const v = s15f16(b, off + offMat + i * 4, end);
      if (v === null || !Number.isFinite(v)) return null;
      m.push(v);
    }
    matrix = { kind: 'matrix', m };
  }

  let clut: Stage | null = null;
  if (offClut) {
    clut = atoB
      ? parseMabClut(b, off + offClut, end, nIn, nB === 3 && mCurves ? 3 : nOut)
      : parseMabClut(b, off + offClut, end, nIn === 3 && mCurves ? 3 : nIn, nOut);
    if (!clut) return null;
  }

  const forward: (Stage | null)[] = atoB
    ? [aCurves ? { kind: 'curves', curves: aCurves } : null, clut,
       mCurves ? { kind: 'curves', curves: mCurves } : null, matrix,
       bCurves ? { kind: 'curves', curves: bCurves } : null]
    : [bCurves ? { kind: 'curves', curves: bCurves } : null, matrix,
       mCurves ? { kind: 'curves', curves: mCurves } : null, clut,
       aCurves ? { kind: 'curves', curves: aCurves } : null];
  const stages = forward.filter((s): s is Stage => s !== null);
  if (stages.length === 0) return null;
  return { nIn, nOut, stages, labEnc: 'full' };
}

// ─── Text tags ────────────────────────────────────────────────────────────────

/** `desc` (v2 textDescriptionType), `mluc` (v4) or `text` → a plain string, '' when unreadable. */
function parseTextTag(b: Uint8Array, off: number, size: number, fileEnd: number): string {
  const end = Math.min(off + size, fileEnd);
  const type = sig4(b, off, end);
  if (type === 'desc') {
    // The ASCII count includes the trailing NUL.
    const count = u32(b, off + 8, end);
    if (count <= 1 || off + 12 + count > end) return '';
    let s = '';
    for (let i = 0; i < count - 1; i++) {
      const ch = u8(b, off + 12 + i, end);
      if (ch <= 0) break;
      s += String.fromCharCode(ch);
    }
    return s;
  }
  if (type === 'mluc') {
    const n = u32(b, off + 8, end);
    const recSize = u32(b, off + 12, end);
    if (n < 1 || recSize < 12 || n > MAX_TAGS) return '';
    let best = -1;
    for (let i = 0; i < n; i++) {
      const rec = off + 16 + i * recSize;
      if (rec + 12 > end) break;
      const lang = u16(b, rec, end);
      if (best < 0 || lang === 0x656e /* 'en' */) best = rec;
      if (lang === 0x656e) break;
    }
    if (best < 0) return '';
    const len = u32(b, best + 4, end);
    const strOff = u32(b, best + 8, end);
    if (len < 0 || strOff < 0 || off + strOff + len > end) return '';
    let s = '';
    for (let i = 0; i + 1 < len; i += 2) {
      const cu = u16(b, off + strOff + i, end);
      if (cu < 0) break;
      if (cu === 0) break;
      s += String.fromCharCode(cu);
    }
    return s;
  }
  if (type === 'text') {
    let s = '';
    for (let p = off + 8; p < end; p++) {
      const ch = u8(b, p, end);
      if (ch <= 0) break;
      s += String.fromCharCode(ch);
    }
    return s;
  }
  return '';
}

// ─── Colour-space bookkeeping ─────────────────────────────────────────────────

const SPACE_CHANNELS: Readonly<Record<string, number>> = {
  'XYZ ': 3, 'Lab ': 3, 'Luv ': 3, 'YCbr': 3, 'Yxy ': 3, 'RGB ': 3,
  'GRAY': 1, 'HSV ': 3, 'HLS ': 3, 'CMYK': 4, 'CMY ': 3,
};

/** Channel count for a data-colour-space signature, or 0 when unrecognised. */
function spaceChannels(s: string): number {
  if (Object.hasOwn(SPACE_CHANNELS, s)) return SPACE_CHANNELS[s]!;
  // nCLR: '2CLR'…'FCLR', the count in hex.
  if (/^[0-9A-F]CLR$/.test(s)) {
    const n = Number.parseInt(s[0]!, 16);
    return n >= 2 && n <= MAX_CHANNELS ? n : 0;
  }
  return 0;
}

/** Is the device space subtractive, i.e. does "total ink" mean anything? */
const isInkSpace = (s: string): boolean => s === 'CMYK' || s === 'CMY ' || /^[0-9A-F]CLR$/.test(s);

/** Intent → A2B/B2A tag number. `absolute` uses the relative tag plus a white-point rescale. */
const INTENT_TAG: Readonly<Record<RenderingIntent, number>> = {
  perceptual: 0,
  relative: 1,
  saturation: 2,
  absolute: 1,
};

const xyzToLab = (x: number, y: number, z: number): [number, number, number] =>
  convertColor({ space: 'xyz-d50', components: [x, y, z], alpha: 1, missing: 0 }, 'lab')
    .components as [number, number, number];

const labToXyz = (l: number, a: number, bb: number): [number, number, number] =>
  convertColor({ space: 'lab', components: [l, a, bb], alpha: 1, missing: 0 }, 'xyz-d50')
    .components as [number, number, number];

/**
 * D50, the illuminant every ICC PCS is referenced to. Taken from css-color's own
 * Lab white rather than the header's s15Fixed16 copy (0.964203, 1.0, 0.824905) or
 * the rounded book value, so the one path that both multiplies it in and divides
 * it out cancels exactly — the GRAY neutral axis, where Generic Gray Profile's
 * white comes back Lab (100, −0.00002, +0.00002) instead of the (100, −0.016,
 * +0.016) the book value leaves.
 *
 * It does NOT set a matrix/TRC profile's neutral residual: that path never reads
 * this constant (`toLab` feeds the profile's own rXYZ+gXYZ+bXYZ sum straight to
 * xyzToLab), so AdobeRGB1998's white stays (100, −0.016, +0.016) and sRGB
 * Profile's (100, +0.002, −0.001) whatever value stands here — each ~0.02 ΔE, set
 * by that profile's colorant tags. Look there, not here, when a matrix profile's
 * greys tint. Besides the gray path the only other reader is the absolute
 * intent's rescale.
 */
const PCS_D50: readonly [number, number, number] = labToXyz(100, 0, 0);

/** 3×3 inverse, or null when singular. Not colour maths — plain linear algebra the matrix/TRC inverse needs. */
function invert3(m: readonly number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
}

// ─── The profile ──────────────────────────────────────────────────────────────

export interface IccProfile {
  readonly deviceClass: string;      // 'prtr' | 'mntr' | 'scnr' | ...
  readonly dataColourSpace: string;  // 'CMYK' | 'RGB ' | 'GRAY' | ...
  readonly pcs: 'XYZ' | 'Lab';
  readonly version: string;
  readonly description: string;      // from 'desc'
  readonly nChannels: number;
  hasIntent(intent: RenderingIntent): boolean;
  /** device channels (each 0-1) -> PCS Lab (L 0-100, a/b -128..127). */
  toLab(intent: RenderingIntent, channels: readonly number[]): [number, number, number] | null;
  /** PCS Lab -> device channels (each 0-1). */
  fromLab(intent: RenderingIntent, lab: readonly [number, number, number]): number[] | null;
}

interface TagRef { offset: number; size: number }

/** Content digest of the profile, for `iccGamutSource`'s stable id. */
const PROFILE_DIGEST = new WeakMap<IccProfile, string>();

/**
 * PCS Lab → unclamped linear device values, for the profiles that have no B2A
 * table. Present only for matrix/TRC and gray profiles; a WeakMap rather than a
 * member of {@link IccProfile} because it is this module's own evidence, not part
 * of the reader's contract.
 *
 * `iccGamutSource` needs it because the round-trip membership test silently
 * over-reports for these profiles. A LUT profile's B2A table maps an unreachable
 * colour onto the gamut SURFACE, so the trip back is visibly far. A matrix/TRC
 * profile has no table: `fromLab` clips each linear channel into [0,1] instead,
 * and clipping a channel that barely contributes to the colour moves Lab only a
 * little. Measured on Apple's ITU-2020 profile, OKLCH (0.4, 0.35, 240) needs
 * linear red −0.02; clipping it to 0 costs 2.2 ΔE — under ICC_GAMUT_DELTA_E — so
 * the trip alone called saturated blues reproducible to chroma 0.39, against the
 * matrix path's true 0.235. The cube these values must fall inside is the same
 * question the display gamuts answer, so ask it directly.
 */
const DIRECT_LINEAR = new WeakMap<
  IccProfile,
  (intent: RenderingIntent, lab: readonly [number, number, number]) => number[] | null
>();

/**
 * Slack on the linear-light cube test, matching gamut-source.ts's EPS.
 *
 * The same value for the same question, so a display profile read from bytes and
 * the same gamut reached through its pre-composed matrix agree at the boundary
 * rather than differing by whichever epsilon each chose. A profile's matrix is
 * stored as s15Fixed16, so its primaries land a few ulps off the ideal ones and
 * an exact primary can read either way — a hundredth of nothing, either way.
 */
const CUBE_EPS = 1e-6;

/**
 * Parse an ICC profile.
 *
 * @param bytes the whole profile (as embedded in a file's ICC chunk, or a `.icc`).
 * @returns null when the buffer is not a profile we can evaluate — no exception is
 * thrown for any input, however malformed.
 */
export function parseIccProfile(bytes: Uint8Array): IccProfile | null {
  try {
    return parseInner(bytes);
  } catch {
    // Belt and braces behind the explicit bounds checks: a reader contract that
    // throws would take down whatever export or preview asked the question.
    return null;
  }
}

function parseInner(b: Uint8Array): IccProfile | null {
  if (!(b instanceof Uint8Array) || b.length < 132) return null;
  const declared = u32(b, 0, b.length);
  if (declared < 128) return null;
  // The header's size must be inside the buffer. Trailing slack is tolerated (a
  // profile lifted from a JPEG APP2 segment is padded), but a profile claiming
  // more than it has is rejected rather than parsed to its truncation point.
  if (declared > b.length) return null;
  const fileEnd = declared;
  if (sig4(b, 36, fileEnd) !== 'acsp') return null;

  const major = u8(b, 8, fileEnd);
  const bcd = u8(b, 9, fileEnd);
  if (major < 0 || bcd < 0) return null;
  const version = `${major}.${bcd >> 4}.${bcd & 0x0f}`;

  const deviceClass = sig4(b, 12, fileEnd);
  const dataColourSpace = sig4(b, 16, fileEnd);
  const pcsSig = sig4(b, 20, fileEnd);
  if (!deviceClass || !dataColourSpace || !pcsSig) return null;
  if (pcsSig !== 'Lab ' && pcsSig !== 'XYZ ') return null;
  const pcs: 'XYZ' | 'Lab' = pcsSig === 'Lab ' ? 'Lab' : 'XYZ';
  const nChannels = spaceChannels(dataColourSpace);
  if (nChannels === 0) return null;

  const tagCount = u32(b, 128, fileEnd);
  if (tagCount < 0 || tagCount > MAX_TAGS) return null;
  if (132 + tagCount * 12 > fileEnd) return null;

  const tags = new Map<string, TagRef>();
  for (let i = 0; i < tagCount; i++) {
    const p = 132 + i * 12;
    const s = sig4(b, p, fileEnd);
    const offset = u32(b, p + 4, fileEnd);
    const size = u32(b, p + 8, fileEnd);
    if (!s || offset < 0 || size < 4) continue;
    // Checked against the real end, not the declared one: a tag may not reach
    // past the profile, and tags are neither ordered nor guaranteed disjoint —
    // aliasing is the norm (Apple's CMYK profile points A2B0/1/2 at one element).
    if (offset + size > fileEnd) continue;
    if (!tags.has(s)) tags.set(s, { offset, size });
  }

  const descTag = tags.get('desc') ?? tags.get('dscm');
  const description = descTag ? parseTextTag(b, descTag.offset, descTag.size, fileEnd) : '';

  // Media white point, needed for the absolute intent's rescale.
  let wtpt: [number, number, number] | null = null;
  const wt = tags.get('wtpt');
  if (wt && wt.size >= 20) {
    const end = Math.min(wt.offset + wt.size, fileEnd);
    const x = s15f16(b, wt.offset + 8, end);
    const y = s15f16(b, wt.offset + 12, end);
    const z = s15f16(b, wt.offset + 16, end);
    if (x !== null && y !== null && z !== null && y > 0) wtpt = [x, y, z];
  }

  // The media white the absolute intent rescales by, which is NOT always the tag.
  // A v2 display profile stores its white UNADAPTED (sRGB Profile's wtpt is D65)
  // while its colorant/TRC tags are already D50-adapted, so the two describe
  // different things and multiplying by the tag puts a 19.5 ΔE blue cast on every
  // neutral — Lab (100, −2.4, −19.4), the same cast the grayTrc branch below
  // avoids. For those profiles the media white IS the PCS illuminant and the
  // rescale is identity, which is the rule littleCMS applies in
  // _cmsReadMediaWhitePoint (version < 4 and class 'mntr' → D50). v4 profiles
  // carry the adaptation in `chad` and their wtpt really is D50, so they are
  // untouched; a v2 PRINTER profile's tag is a genuine measured media white and
  // must still be honoured, which is why the class is part of the test.
  const mediaWhite: readonly [number, number, number] | null =
    major < 4 && deviceClass === 'mntr' ? PCS_D50 : wtpt;

  // Elements are shared between intents, so parse once per (offset,size).
  const elements = new Map<string, Pipeline | null>();
  function pipeline(tagSig: string, atoB: boolean): Pipeline | null {
    const t = tags.get(tagSig);
    if (!t) return null;
    const key = `${t.offset}:${t.size}:${atoB ? 'a' : 'b'}`;
    if (elements.has(key)) return elements.get(key) ?? null;
    const end = Math.min(t.offset + t.size, fileEnd);
    const type = sig4(b, t.offset, end);
    // The element's input is PCSXYZ only on the B-to-A side of an XYZ-PCS profile
    // — the one place mft's 3×3 applies.
    const inputIsPcsXyz = !atoB && pcs === 'XYZ';
    let out: Pipeline | null = null;
    if (type === 'mft1') out = parseMft(b, t.offset, end, 8, inputIsPcsXyz);
    else if (type === 'mft2') out = parseMft(b, t.offset, end, 16, inputIsPcsXyz);
    else if (type === 'mAB ') out = parseMab(b, t.offset, end, true);
    else if (type === 'mBA ') out = parseMab(b, t.offset, end, false);
    if (out) {
      // Arity must match the profile's own declaration, or the tag belongs to a
      // different profile than its header describes.
      const wantIn = atoB ? nChannels : 3;
      const wantOut = atoB ? 3 : nChannels;
      if (out.nIn !== wantIn || out.nOut !== wantOut) out = null;
    }
    elements.set(key, out);
    return out;
  }

  // ── matrix/TRC and gray paths (no LUT at all) ──
  const trcOf = (s: string): Curve | null => {
    const t = tags.get(s);
    if (!t) return null;
    const c = parseCurve(b, t.offset, Math.min(t.offset + t.size, fileEnd));
    return c ? c.curve : null;
  };
  const colOf = (s: string): [number, number, number] | null => {
    const t = tags.get(s);
    if (!t || t.size < 20) return null;
    const end = Math.min(t.offset + t.size, fileEnd);
    const x = s15f16(b, t.offset + 8, end);
    const y = s15f16(b, t.offset + 12, end);
    const z = s15f16(b, t.offset + 16, end);
    return x === null || y === null || z === null ? null : [x, y, z];
  };

  let matrixTrc: { m: number[]; inv: number[]; trc: [Curve, Curve, Curve] } | null = null;
  if (dataColourSpace === 'RGB ' && pcs === 'XYZ') {
    const r = colOf('rXYZ');
    const g = colOf('gXYZ');
    const bl = colOf('bXYZ');
    const rt = trcOf('rTRC');
    const gt = trcOf('gTRC');
    const bt = trcOf('bTRC');
    if (r && g && bl && rt && gt && bt) {
      // Columns are the primaries: [X Y Z]ᵀ = M · [R G B]ᵀ, already D50-adapted.
      const m = [r[0], g[0], bl[0], r[1], g[1], bl[1], r[2], g[2], bl[2]];
      const inv = invert3(m);
      if (inv) matrixTrc = { m, inv, trc: [rt, gt, bt] };
    }
  }
  let grayTrc: Curve | null = null;
  if (dataColourSpace === 'GRAY') grayTrc = trcOf('kTRC');

  // ── PCS encode / decode ──
  const decodePcs = (enc: LabEnc, y: readonly number[]): [number, number, number] | null => {
    if (y.length !== 3) return null;
    if (pcs === 'Lab') {
      // 65535/65280: the legacy 16-bit scale puts L*=100 at 0xFF00. Values a hair
      // above it are legal and real (one stock profile peaks at 65338), so the raw
      // sample must not be clamped before this multiply — L* slightly over 100 is
      // the file's actual claim.
      const k = enc === 'legacy16' ? 65535 / 65280 : 1;
      return [y[0]! * 100 * k, y[1]! * 255 * k - 128, y[2]! * 255 * k - 128];
    }
    // 16-bit PCSXYZ is u1Fixed15: 0x8000 is 1.0, so the normalised value scales by 65535/32768.
    const s = 65535 / 32768;
    return xyzToLab(y[0]! * s, y[1]! * s, y[2]! * s);
  };
  const encodePcs = (enc: LabEnc, lab: readonly [number, number, number]): number[] | null => {
    if (pcs === 'Lab') {
      const k = enc === 'legacy16' ? 65280 / 65535 : 1;
      return [
        clamp01((lab[0] / 100) * k),
        clamp01(((lab[1] + 128) / 255) * k),
        clamp01(((lab[2] + 128) / 255) * k),
      ];
    }
    const xyz = labToXyz(lab[0], lab[1], lab[2]);
    const s = 32768 / 65535;
    return [clamp01(xyz[0] * s), clamp01(xyz[1] * s), clamp01(xyz[2] * s)];
  };

  // ── absolute intent ──
  // ICC.1:2010 Annex A: absolute colorimetric is relative scaled by the ratio of
  // the media white point to the PCS illuminant, channel-wise in XYZ.
  const relToAbs = (lab: [number, number, number], forward: boolean): [number, number, number] | null => {
    if (!mediaWhite) return null;
    // A media white that already IS the PCS illuminant makes the rescale identity;
    // returned directly so absolute is bit-for-bit relative rather than relative
    // plus a Lab→XYZ→Lab round trip's noise.
    if (mediaWhite === PCS_D50) return [lab[0], lab[1], lab[2]];
    const [x, y, z] = labToXyz(lab[0], lab[1], lab[2]);
    const rx = mediaWhite[0] / PCS_D50[0];
    const ry = mediaWhite[1] / PCS_D50[1];
    const rz = mediaWhite[2] / PCS_D50[2];
    if (!(rx > 0) || !(ry > 0) || !(rz > 0)) return null;
    return forward ? xyzToLab(x * rx, y * ry, z * rz) : xyzToLab(x / rx, y / ry, z / rz);
  };

  const hasDirect = (): boolean => matrixTrc !== null || grayTrc !== null;

  /**
   * PCS Lab → the direct transform's LINEAR device values, UNCLAMPED — the
   * inverse matrix's raw output for matrix/TRC, Y/Y(D50) for gray. Null for a
   * profile with no direct transform.
   *
   * Unclamped because the excursion past [0,1] is the only honest evidence that
   * a matrix/TRC profile cannot reach a colour: it has no B2A table to project
   * onto its gamut surface, so `fromLab` clips instead, and a clip is not always
   * visible in the round trip (see DIRECT_LINEAR).
   */
  const directLinear = (want: readonly [number, number, number]): number[] | null => {
    if (matrixTrc) {
      const [x, y, z] = labToXyz(want[0], want[1], want[2]);
      const inv = matrixTrc.inv;
      return [
        inv[0]! * x + inv[1]! * y + inv[2]! * z,
        inv[3]! * x + inv[4]! * y + inv[5]! * z,
        inv[6]! * x + inv[7]! * y + inv[8]! * z,
      ];
    }
    // Only Y survives: a one-ink device has no way to carry a* or b*, so the
    // round trip a gamut test performs correctly rejects anything chromatic.
    if (grayTrc) return [labToXyz(want[0], want[1], want[2])[1] / PCS_D50[1]];
    return null;
  };

  const profile: IccProfile = {
    deviceClass,
    dataColourSpace,
    pcs,
    version,
    description,
    nChannels,

    /**
     * True when this intent's transform exists. For a LUT profile that means the
     * A2B{n} or B2A{n} tag is physically present — there is deliberately NO
     * fallback to A2B0, because quietly answering with the perceptual table when
     * saturation was asked for returns plausible, wrong colour. A matrix/TRC or
     * gray profile has one colorimetric transform that every CMM uses for all
     * three table intents, so it reports them all. `absolute` additionally needs
     * a media white to rescale relative by, and is unsupported without one.
     */
    hasIntent(intent: RenderingIntent): boolean {
      if (intent === 'absolute') return mediaWhite !== null && profile.hasIntent('relative');
      if (!Object.hasOwn(INTENT_TAG, intent)) return false;
      if (hasDirect()) return true;
      const n = INTENT_TAG[intent];
      return tags.has(`A2B${n}`) || tags.has(`B2A${n}`);
    },

    toLab(intent, channels) {
      // Length-and-index checked rather than Array.isArray'd: a caller with the
      // device values in a Float32Array is legitimate, and a bare object claiming
      // a length still cannot get past the per-element finite test.
      if (!channels || typeof channels.length !== 'number' || channels.length !== nChannels) return null;
      for (let i = 0; i < nChannels; i++) {
        if (typeof channels[i] !== 'number' || !Number.isFinite(channels[i])) return null;
      }
      if (!Object.hasOwn(INTENT_TAG, intent)) return null;
      const dev = Array.from(channels, clamp01);

      let lab: [number, number, number] | null = null;
      const lut = pipeline(`A2B${INTENT_TAG[intent]}`, true);
      if (lut) {
        const y = evalPipeline(lut, dev);
        lab = y ? decodePcs(lut.labEnc, y) : null;
      } else if (matrixTrc) {
        const lin = [
          evalCurve(matrixTrc.trc[0], dev[0]!),
          evalCurve(matrixTrc.trc[1], dev[1]!),
          evalCurve(matrixTrc.trc[2], dev[2]!),
        ];
        const m = matrixTrc.m;
        lab = xyzToLab(
          m[0]! * lin[0]! + m[1]! * lin[1]! + m[2]! * lin[2]!,
          m[3]! * lin[0]! + m[4]! * lin[1]! + m[5]! * lin[2]!,
          m[6]! * lin[0]! + m[7]! * lin[1]! + m[8]! * lin[2]!,
        );
      } else if (grayTrc) {
        // A gray profile's tone curve is luminance and the result is neutral on the
        // PCS axis: the D50 illuminant scaled by Y, NOT the profile's own `wtpt`.
        // Stock v2 gray profiles store an UNADAPTED white (Generic Gray Profile's
        // is D65), so using it would report media white as Lab (100, −2.4, −19.4)
        // — a blue cast on every grey. Relative colorimetric is white-normalised;
        // the media white only enters through the absolute intent's rescale, and
        // for a v2 display-class profile that rescale is identity too (mediaWhite).
        const yv = evalCurve(grayTrc, dev[0]!);
        lab = xyzToLab(PCS_D50[0] * yv, PCS_D50[1] * yv, PCS_D50[2] * yv);
      }
      if (!lab) return null;
      if (intent === 'absolute') return relToAbs(lab, true);
      return lab;
    },

    fromLab(intent, lab) {
      if (lab?.length !== 3) return null;
      for (let i = 0; i < 3; i++) {
        if (typeof lab[i] !== 'number' || !Number.isFinite(lab[i])) return null;
      }
      if (!Object.hasOwn(INTENT_TAG, intent)) return null;
      let want: [number, number, number] = [lab[0]!, lab[1]!, lab[2]!];
      if (intent === 'absolute') {
        const rel = relToAbs(want, false);
        if (!rel) return null;
        want = rel;
      }
      const lut = pipeline(`B2A${INTENT_TAG[intent]}`, false);
      if (lut) {
        const enc = encodePcs(lut.labEnc, want);
        if (!enc) return null;
        return evalPipeline(lut, enc);
      }
      const raw = directLinear(want);
      // Clamped, per the contract that device channels are 0–1. What the clamp
      // hides is recorded in DIRECT_LINEAR for the gamut test — see there.
      if (raw && matrixTrc) return raw.map((v, i) => invertCurve(matrixTrc!.trc[i]!, clamp01(v)));
      if (raw && grayTrc) return [invertCurve(grayTrc, clamp01(raw[0]!))];
      return null;
    },
  };

  PROFILE_DIGEST.set(profile, sha256Prefix(b.subarray(0, fileEnd)));
  if (matrixTrc || grayTrc) DIRECT_LINEAR.set(profile, (intent, lab) => {
    if (!Object.hasOwn(INTENT_TAG, intent)) return null;
    // A LUT wins over the direct transform when both are present, and then the
    // cube question below does not apply — the table already answers it.
    if (pipeline(`B2A${INTENT_TAG[intent]}`, false)) return null;
    let want: [number, number, number] = [lab[0]!, lab[1]!, lab[2]!];
    if (intent === 'absolute') {
      const rel = relToAbs(want, false);
      if (!rel) return null;
      want = rel;
    }
    return directLinear(want);
  });
  return profile;
}

// ─── Gamut source ─────────────────────────────────────────────────────────────

/**
 * ΔE*ab (CIE76) between two PCS Lab values — a Euclidean distance in the space
 * both arguments are already in, not a colour conversion.
 */
const deltaE76 = (a: readonly number[], c: readonly number[]): number =>
  Math.hypot(a[0]! - c[0]!, a[1]! - c[1]!, a[2]! - c[2]!);

/**
 * Round-trip tolerance for {@link iccGamutSource}'s membership test, in ΔE*ab.
 *
 * The test is the standard one: a colour is in a device's gamut if Lab → device
 * → Lab comes back where it started, because a B2A table has nowhere to send an
 * unreachable colour except onto the gamut surface. It applies only to profiles
 * that HAVE such a table — matrix/TRC and gray profiles are answered by the
 * device cube instead (DIRECT_LINEAR), which is exact, so none of the tolerance
 * below is in play for them.
 *
 * Measured on Apple's Generic CMYK Profile, whose B2A is a 17³ grid of 8-bit
 * nodes (its a* and b* axes step ~16 ΔE per node), the round trip returns:
 *   interior body colours      ~1.0–1.5 ΔE   ← the noise floor to clear
 *   solid cyan                  9.2 ΔE
 *   solid yellow               22.7 ΔE
 *   a colour no press prints    35–61 ΔE
 * 3.0 clears the floor with room and rejects everything genuinely outside it.
 *
 * ## What it costs — more than the corners
 *
 * Compared against the same profile's FORWARD table (a 21⁴ device grid pushed
 * through A2B, every result in gamut by definition), `contains` accepts about 65%
 * of the device values the profile itself can produce, covering ~80% of the Lab
 * volume they reach. The loss is not spread evenly, and it is not confined to
 * saturated primaries:
 *   - a single-ink YELLOW ramp is refused from a 20% tint upward (Y=10% →
 *     2.0 ΔE, in; Y=20% → 4.6 ΔE, out; Y=100% → 22.7 ΔE), so above L* ≈ 90 the
 *     yellow lobe keeps only a quarter to a half of its reachable chroma. That is
 *     the one region where a coated CMYK gamut rivals sRGB, and this rule is
 *     where the spike a ColorSync-style solid would draw goes missing;
 *   - the dark heavy-ink end fares worse still (~11% accepted below L* 10);
 *   - below L* 85 the boundary is within a few percent of the forward one, which
 *     is why body colours and the charts built from them read correctly.
 *
 * The inconsistency is the profile's own B2A, not this reader: littleCMS returns
 * the same device values on the same file to 0.002 (yellow 0.796 vs 0.798). But
 * the truncation above is this rule's, so treat what it draws as a conservative
 * soft-proof — markedly conservative in light yellows and deep shadows — never as
 * a colorimetric gamut boundary. The cure is a different question, a boundary
 * sampled from the FORWARD table, not a looser threshold: the alternatives here
 * are worse, since the `gamt` tag in this profile reports everything out of gamut
 * and 10 ΔE starts admitting colours that are really outside.
 */
export const ICC_GAMUT_DELTA_E = 3.0;

/** Cheap fallback identity for a profile this module did not parse (no digest recorded). */
const fallbackId = (p: IccProfile): string =>
  `${p.deviceClass}-${p.dataColourSpace}-${p.nChannels}-${p.description}`;

/**
 * Can this profile answer a GAMUT question under `intent`? The gate to check
 * before building or trusting an {@link iccGamutSource}.
 *
 * `hasIntent` answers a different question — that a transform exists in EITHER
 * direction — and is right to: a scanner or an abstract profile carrying A2B0
 * alone can legitimately be asked for device → Lab. Membership cannot: `contains`
 * goes through `fromLab` first, so with no reverse transform every colour is
 * refused and the source reports an EMPTY gamut behind a valid id and label.
 * "This press prints nothing" and "this profile cannot say" are then
 * indistinguishable, which is the failure the empty-gamut result is reserved for.
 * The six stock abstract profiles (Sepia Tone, Black & White, …) are exactly this
 * shape: `abst`, A2B0 present, no B2A0.
 *
 * `abst` and `link` classes are refused outright whatever tags they carry — an
 * abstract effect and a device link have no device gamut to ask about.
 */
export function iccGamutIntent(p: IccProfile, intent: RenderingIntent): boolean {
  if (p.deviceClass === 'abst' || p.deviceClass === 'link') return false;
  if (!p.hasIntent(intent)) return false;
  // Probed on the neutral axis: mid grey exists in every device space, so a null
  // here means there is no reverse path at all (no B2A{n}, no direct inverse),
  // not that this particular colour is unreachable.
  return p.fromLab(intent, [50, 0, 0]) !== null;
}

/**
 * A {@link GamutSource} backed by an ICC profile under one rendering intent.
 *
 * `contains` maps the OKLCH request to PCS Lab through css-color's conversion
 * hub (the engine's single implementation of that maths), then asks the profile
 * to round-trip it — see {@link ICC_GAMUT_DELTA_E} for why that answers the
 * question and what the threshold costs. A profile with no B2A table has its
 * device cube tested as well, because the round trip alone under-reports there
 * (see DIRECT_LINEAR).
 *
 * An intent the profile cannot be asked this question in yields a source that
 * contains nothing, rather than one that silently answers with a different
 * intent's table. {@link iccGamutIntent} is that test, and is what a caller should
 * gate on: an empty gamut is not distinguishable from a refusal after the fact.
 */
/** OKLCH → PCS Lab → this profile's device values, or null when it cannot answer. */
function iccDevice(
  p: IccProfile, intent: RenderingIntent, l: number, c: number, h: number,
): { dev: number[]; lab: [number, number, number] } | null {
  if (!gamutInputSane(l, c, h)) return null;
  const lab = convertColor(
    { space: 'oklch', components: [l, c, h], alpha: 1, missing: 0 },
    'lab',
  ).components as [number, number, number];
  const dev = p.fromLab(intent, lab);
  return dev ? { dev, lab } : null;
}

/**
 * How far this colour MOVES on the round trip Lab → device → Lab, in ΔE*ab.
 *
 * The quantity {@link ICC_GAMUT_DELTA_E} is the threshold on, surfaced as a
 * number so a reader can see where inside (or outside) the boundary a colour
 * sits: 0.4 is solidly reproducible, 2.8 "passes" and will still visibly shift.
 * A tolerance stated as a rule is a hidden rule; stated as a measurement it is
 * information.
 *
 * Deliberately NOT a member of {@link GamutSource}. A matrix-backed gamut has no
 * such quantity at all, and an optional method returning null for three of the
 * four sources in the codebase is a worse contract than a function only the ICC
 * callers reach for.
 *
 * Null when the profile cannot be asked this question under `intent` — the same
 * gate {@link iccGamutIntent} applies — or when the colour is not one (NaN, l
 * outside [0,1]). Note that a profile answered by its device CUBE rather than by
 * a B2A table (matrix/TRC and gray — see DIRECT_LINEAR) still returns a number
 * here, and that number is near zero even well outside the gamut: the round trip
 * is not what decides membership for those, so do not read a small ΔE from one
 * as "comfortably inside".
 */
/**
 * Is the round trip what DECIDES membership for this profile?
 *
 * False for a matrix/TRC or gray profile: those have no B2A table, so `fromLab`
 * clips into the device cube rather than projecting onto a gamut surface, and the
 * clip does not always show up in the round trip. {@link iccGamutSource}'s
 * `contains` tests the unclamped cube directly for them (DIRECT_LINEAR) and never
 * reaches the ΔE comparison — so a caller SHOWING {@link iccRoundTripDeltaE}
 * beside a verdict has to gate on this, or it prints a rule the verdict does not
 * follow ("outside, shift ΔE 0.1" under "in gamut is decided by ΔE 3.0").
 */
export function iccRoundTripDecides(p: IccProfile): boolean {
  return !DIRECT_LINEAR.has(p);
}

export function iccRoundTripDeltaE(
  p: IccProfile, intent: RenderingIntent, l: number, c: number, h: number,
): number | null {
  if (!iccGamutIntent(p, intent)) return null;
  const d = iccDevice(p, intent, l, c, h);
  if (!d) return null;
  const back = p.toLab(intent, d.dev);
  return back ? deltaE76(d.lab, back) : null;
}

export function iccGamutSource(p: IccProfile, intent: RenderingIntent): GamutSource {
  const digest = PROFILE_DIGEST.get(p) ?? fallbackId(p);
  const supported = iccGamutIntent(p, intent);
  const ink = isInkSpace(p.dataColourSpace);
  const direct = DIRECT_LINEAR.get(p);

  const device = (l: number, c: number, h: number): { dev: number[]; lab: [number, number, number] } | null =>
    (supported ? iccDevice(p, intent, l, c, h) : null);

  return {
    id: `icc:${digest}:${intent}`,
    label: `${p.description || p.dataColourSpace.trim()} (${intent})`,
    contains(l, c, h) {
      const d = device(l, c, h);
      if (!d) return false;
      // A profile with no B2A table clips instead of projecting, and the clip can
      // hide under the ΔE threshold — so ask its cube directly first. Null here
      // means the profile HAS a table and the round trip below is the real test.
      const raw = direct?.(intent, d.lab);
      if (raw?.some((v) => v < -CUBE_EPS || v > 1 + CUBE_EPS)) return false;
      const back = p.toLab(intent, d.dev);
      if (!back) return false;
      return deltaE76(d.lab, back) <= ICC_GAMUT_DELTA_E;
    },
    /**
     * Total area coverage: the sum of the device channels the colour maps to, in
     * units where 1.0 is one channel at full. A four-ink profile can therefore
     * return up to 4.0 — the printing trade's "400% TAC" — so this is not
     * normalised to 0–1; normalising would erase exactly the number a pressroom
     * ink limit is expressed in. Null for additive spaces, where the question
     * does not apply.
     */
    inkCoverage(l, c, h) {
      if (!ink) return null;
      const d = device(l, c, h);
      if (!d) return null;
      let sum = 0;
      for (const v of d.dev) sum += clamp01(v);
      return sum;
    },
  };
}

// ─── The characterization target ('targ') ─────────────────────────────

/** How much of a `targ` body is read. The CGATS header is in the first few lines;
 *  PSOcoated_v3's whole tag is 123 kB of measurement data we have no use for. */
const TARG_SCAN = 4096;

/**
 * The characterization data set a profile says it was built from — the
 * `FILE_DESCRIPTOR` line of its `targ` (characterizationTarget) tag, e.g.
 * `FOGRA51`. Null when the profile carries no `targ`, or its header does not
 * state one.
 *
 * This is TESTIMONY, not measurement: it is what the profile's author wrote into
 * the file. It is the strongest identity signal available on-device short of
 * comparing its tables against published aim values (which needs aim data
 * nothing here ships) — which is exactly why a caller may use it to pair a
 * profile with a named press condition but must never read it as proof that the
 * numbers inside are right.
 *
 * Bytes in rather than an {@link IccProfile}, so the reader's contract does not
 * widen for a field only the PDF/X path wants. Never throws, for any input.
 */
export function iccCharacterization(bytes: Uint8Array): string | null {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length < 132) return null;
    const declared = u32(bytes, 0, bytes.length);
    if (declared < 128 || declared > bytes.length) return null;
    const fileEnd = declared;
    if (sig4(bytes, 36, fileEnd) !== 'acsp') return null;
    const tagCount = u32(bytes, 128, fileEnd);
    if (tagCount < 0 || tagCount > MAX_TAGS) return null;
    if (132 + tagCount * 12 > fileEnd) return null;
    for (let i = 0; i < tagCount; i++) {
      const p = 132 + i * 12;
      if (sig4(bytes, p, fileEnd) !== 'targ') continue;
      const offset = u32(bytes, p + 4, fileEnd);
      const size = u32(bytes, p + 8, fileEnd);
      if (offset < 0 || size < 12 || offset + size > fileEnd) return null;
      // textType: 4-byte signature, 4 reserved, then ASCII.
      const body = offset + (sig4(bytes, offset, fileEnd) === 'text' ? 8 : 0);
      const end = Math.min(body + Math.min(size, TARG_SCAN), fileEnd);
      let s = '';
      for (let q = body; q < end; q++) {
        const ch = u8(bytes, q, end);
        if (ch < 0) break;
        s += ch === 0 ? ' ' : String.fromCharCode(ch);
      }
      // CGATS: `FILE_DESCRIPTOR "FOGRA51"`, quoted or bare, one per line.
      const m = /^[ \t]*FILE_DESCRIPTOR[ \t]+"?([^"\r\n]*?)"?[ \t]*$/mi.exec(s);
      const v = m?.[1]?.trim();
      // Empty says nothing; something long enough to be prose is not a
      // characterization name.
      return v && v.length <= 64 ? v : null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── sha256 ───────────────────────────────────────────────────────────────────
//
// bytes.ts owns the engine's SHA-256, but it is async (WebCrypto) and a
// GamutSource's `id` is a synchronous property of a synchronously parsed
// profile. So the digest is computed here, in ~30 lines of pure integer
// arithmetic, rather than making parseIccProfile async and infecting every
// caller with a promise for the sake of a cache key.

const K256 = /* @__PURE__ */ (() => {
  // FIPS 180-4 constants: frac(cbrt(prime)) × 2³². Generated rather than pasted
  // so there is nothing to mistype.
  const primes: number[] = [];
  for (let n = 2; primes.length < 64; n++) {
    let p = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; }
    if (p) primes.push(n);
  }
  return primes.map((n) => Math.floor((Math.cbrt(n) % 1) * 2 ** 32) >>> 0);
})();

/** First 16 hex chars of the SHA-256 of `data` — enough to key a cache on. */
function sha256Prefix(data: Uint8Array): string {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const len = data.length;
  // FIPS 180-4 padding: the smallest multiple of 64 that holds the message, the
  // 0x80 byte and the 8-byte length. `>>6` then `+1` already rounds up, so the
  // slack term is 8, not 9 — at 9 a length of exactly 55 mod 64 (where len+9 is
  // already a multiple of 64) gained a whole extra zero block and the digest
  // stopped being SHA-256.
  const withPad = new Uint8Array((((len + 8) >> 6) + 1) << 6);
  withPad.set(data);
  withPad[len] = 0x80;
  const bitLen = len * 8;
  // Length is written as a 64-bit big-endian count; a >4 GiB profile is impossible here.
  new DataView(withPad.buffer).setUint32(withPad.length - 4, bitLen >>> 0);
  new DataView(withPad.buffer).setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000));
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = ((withPad[off + i * 4]! << 24) | (withPad[off + i * 4 + 1]! << 16)
        | (withPad[off + i * 4 + 2]! << 8) | withPad[off + i * 4 + 3]!) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, bb, c, d, e, f, g, hh] = h as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & bb) ^ (a & c) ^ (bb & c);
      const t2 = (S0 + mj) >>> 0;
      hh = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = bb; bb = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + bb) >>> 0; h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0; h[5] = (h[5]! + f) >>> 0; h[6] = (h[6]! + g) >>> 0; h[7] = (h[7]! + hh) >>> 0;
  }
  return h.slice(0, 2).map((x) => x.toString(16).padStart(8, '0')).join('');
}
