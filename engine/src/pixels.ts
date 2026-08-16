// SPDX-License-Identifier: MPL-2.0
/**
 * Deep pixel buffers: the engine's float image interchange (deeprichpixels section 5.1).
 *
 * Every pixel Lolly historically touched was 8-bit display-encoded sRGB. This
 * module is the babl lesson applied to that seam: ONE buffer type whose format
 * (linear light, un-premultiplied, and *which* primaries/white point) travels
 * with the data, plus the converters between it and the byte world. Operations
 * downstream (filters, view transforms, deep encoders) are written once against
 * `DeepFrame` and never see encoded bytes.
 *
 * Ground rules, in order of how much they matter:
 *
 *   - `data` is LINEAR light. No transfer curve is ever baked into a frame;
 *     sRGB gamma exists only inside {@link fromU8Srgb} / {@link toU8Srgb}.
 *   - `data` is UNBOUNDED. Values > 1 are HDR headroom, values < 0 are
 *     out-of-gamut excursions (a P3 red expressed in sRGB). Both are legal and
 *     must survive conversion. Clamping happens only at integer encode
 *     boundaries ({@link toU8Srgb}, {@link toU16}), never in {@link convertSpace}.
 *     Float is RANGE, not just precision (Krita's lesson).
 *   - `data` is un-premultiplied. Encoders that need premultiplied alpha call
 *     {@link premultiply} at their boundary; the working buffer never is.
 *   - Correctness is defined HERE, on the CPU, in plain typed-array math.
 *     It is DOM-free, deterministic, identical in browser/CLI/MCP. GPU or platform
 *     paths added later are accelerators validated against this module.
 *
 * Colour science sources (every constant cited at its definition):
 *   - RGB<->XYZ matrices and the Bradford D65<->D50 pair: CSS Color Level 4
 *     sample code, https://www.w3.org/TR/css-color-4/#color-conversion-code
 *     (conversions.js). The sRGB<->P3 pre-composed matrices in gamut-source.ts
 *     and hdr.ts's M_709_TO_2020 are products of the same primaries. The
 *     cross-agreement is pinned by tests/pixels.test.ts against the functions
 *     gamut-source.ts exports.
 *   - sRGB transfer curve: IEC 61966-2.1 piecewise (same maths as
 *     brand-derive.ts / hdr.ts, kept in sync deliberately).
 *   - CIELAB: CIE 15 formulas with the CSS Color 4 rational constants
 *     (k = 24389/27, e = 216/24389) and the D50 reference white. These are the
 *     same constants as brand-derive.ts#labToOklch, kept in sync.
 *   - IEEE 754-2008 binary16 for the half-float pack/unpack.
 *
 * Exported from the engine barrel since 1.86.0, alongside the first consumers
 * (hdr.ts's float view transform and icc-pixels.ts).
 */

// ─── the buffer ───────────────────────────────────────────────────────────────

/**
 * The colour space a frame's linear values are expressed in. All RGB spaces are
 * D65; `xyz-d50` and `lab` carry the Bradford-adapted D50 white that ICC PCS
 * and CIELAB are defined against.
 *
 * `lab` channel conventions: L in 0..100 (CIE, NOT 0..1), a/b unbounded signed;
 * alpha stays 0..1. Lab frames cannot pass through the 0..1 integer encoders.
 */
export type PixelSpace = 'srgb-linear' | 'display-p3-linear' | 'rec2020-linear' | 'xyz-d50' | 'lab';

export const PIXEL_SPACES: readonly PixelSpace[] = [
  'srgb-linear', 'display-p3-linear', 'rec2020-linear', 'xyz-d50', 'lab',
];

/** A deep image: RGBA interleaved float32, linear light, un-premultiplied, unbounded. */
export interface DeepFrame {
  width: number;
  height: number;
  /** RGBA interleaved, length = width * height * 4. Linear, un-premultiplied, unbounded. */
  data: Float32Array;
  /** babl's lesson: the primaries + white point travel WITH the buffer. */
  space: PixelSpace;
}

function assertSpace(space: PixelSpace): void {
  if (!PIXEL_SPACES.includes(space)) throw new Error(`unknown pixel space: ${String(space)}`);
}

function assertDims(len: number, width: number, height: number, what: string): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`invalid frame dimensions ${width}x${height}`);
  }
  if (len !== width * height * 4) {
    throw new Error(`${what}: buffer length ${len} != ${width}x${height}x4 (${width * height * 4})`);
  }
}

/** A zero-filled (transparent black) frame. */
export function createDeepFrame(width: number, height: number, space: PixelSpace = 'srgb-linear'): DeepFrame {
  assertSpace(space);
  assertDims(width * height * 4, width, height, 'createDeepFrame');
  return { width, height, data: new Float32Array(width * height * 4), space };
}

// ─── sRGB transfer curve (IEC 61966-2.1) ─────────────────────────────────────

/**
 * sRGB EOTF: encoded [0,1] -> linear light. The standard piecewise IEC
 * 61966-2.1 curve, same maths as brand-derive.ts and hdr.ts, kept in sync
 * deliberately. Anchor: 0.5 -> 0.21404114 (pinned by tests).
 */
export const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** sRGB inverse EOTF (OETF): linear light [0,1] -> encoded [0,1]. */
export const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

// sRGB byte -> linear light via a 256-entry LUT, matching the structure of
// hdr.ts:107's LINEAR_LUT (module-private there, so re-derived here from the
// same shared curve rather than duplicated by hand). The values are identical
// by construction and the decode loop stays pow-free.
const LINEAR_LUT = new Float64Array(256);
for (let i = 0; i < 256; i++) LINEAR_LUT[i] = srgbToLinear(i / 255);

// ─── u8 sRGB <-> f32 linear ──────────────────────────────────────────────────

/**
 * Display-encoded 8-bit sRGB RGBA (canvas `ImageData.data` order) -> linear
 * float frame in `srgb-linear`. Alpha is linear already and just rescales.
 */
export function fromU8Srgb(src: Uint8ClampedArray | Uint8Array, width: number, height: number): DeepFrame {
  assertDims(src.length, width, height, 'fromU8Srgb');
  const data = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 4) {
    data[i] = LINEAR_LUT[src[i]!]!;
    data[i + 1] = LINEAR_LUT[src[i + 1]!]!;
    data[i + 2] = LINEAR_LUT[src[i + 2]!]!;
    data[i + 3] = src[i + 3]! / 255;
  }
  return { width, height, data, space: 'srgb-linear' };
}

/**
 * Frame -> display-encoded 8-bit sRGB. This is a display-referred ENCODE
 * boundary: the frame is first converted to `srgb-linear`, then each channel
 * is clamped to [0,1] (HDR headroom and out-of-gamut excursions do not survive
 * an 8-bit sRGB byte, by design; a view transform that wants better mapping
 * runs before this) and gamma-encoded with round-to-nearest.
 */
export function toU8Srgb(frame: DeepFrame): Uint8ClampedArray {
  const f = convertSpace(frame, 'srgb-linear');
  const src = f.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    out[i] = Math.round(linearToSrgb(clamp01(src[i]!)) * 255);
    out[i + 1] = Math.round(linearToSrgb(clamp01(src[i + 1]!)) * 255);
    out[i + 2] = Math.round(linearToSrgb(clamp01(src[i + 2]!)) * 255);
    out[i + 3] = Math.round(clamp01(src[i + 3]!) * 255);
  }
  return out;
}

const clamp01 = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v);

// ─── u16 linear interchange ──────────────────────────────────────────────────

/**
 * Linear 16-bit interchange (0..65535 maps linearly onto 0..1) -> float frame.
 * NO transfer curve: 16-bit interchange in this pipeline is linear light
 * (deep PNG/TIFF writers apply their own encode separately if they need one).
 */
export function fromU16(src: Uint16Array, width: number, height: number, space: PixelSpace = 'srgb-linear'): DeepFrame {
  assertDims(src.length, width, height, 'fromU16');
  if (space === 'lab') throw new Error('fromU16: lab is not a 0..1 interchange space');
  assertSpace(space);
  const data = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) data[i] = src[i]! / 65535;
  return { width, height, data, space };
}

/**
 * Frame -> linear 16-bit interchange in the frame's OWN space (no space
 * conversion; callers convert first). Values clamp to [0,1]; a Lab frame is
 * refused because its channels are not 0..1.
 */
export function toU16(frame: DeepFrame): Uint16Array {
  if (frame.space === 'lab') throw new Error('toU16: lab channels are not 0..1; convertSpace first');
  const src = frame.data;
  const out = new Uint16Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = Math.round(clamp01(src[i]!) * 65535);
  return out;
}

// ─── IEEE 754 binary16 (half float) ──────────────────────────────────────────

// Manual bit math so the engine works without Float16Array (Safari 18.2+ /
// Chrome 135+ / Node 24+ have it; jsdom and older runtimes do not). This is a
// capability-ladder rung: the fast path below uses the platform's Float16Array
// when the global exists, and tests cross-check the two paths bit-for-bit.
// Rounding is round-to-nearest-even, matching IEEE 754-2008 and Float16Array.

// Round-ties-to-even of a non-negative real to an integer (Math.round rounds
// ties away from zero, which is the wrong IEEE behaviour at every half-ulp).
function roundTiesToEven(x: number): number {
  const fl = Math.floor(x);
  const frac = x - fl;
  if (frac > 0.5) return fl + 1;
  if (frac < 0.5) return fl;
  return fl % 2 === 0 ? fl : fl + 1;
}

/**
 * JS number -> IEEE 754 binary16 bit pattern (uint16), rounding ties to even
 * in a SINGLE step from the double (converting via float32 first would
 * double-round and disagree with the platform Float16Array on rare doubles;
 * caught by the exhaustive cross-check test).
 */
export function floatToHalf(v: number): number {
  if (Number.isNaN(v)) return 0x7e00; // canonical quiet NaN
  const sign = v < 0 || Object.is(v, -0) ? 0x8000 : 0;
  const a = Math.abs(v);
  if (a === Number.POSITIVE_INFINITY) return sign | 0x7c00;
  if (a === 0) return sign;
  if (a < 2 ** -14) {
    // Subnormal half: value = hm * 2^-24. The scale by a power of two is exact
    // in doubles, so the RNE happens exactly once here.
    const hm = roundTiesToEven(a * 2 ** 24);
    return hm >= 0x400 ? sign | 0x0400 : sign | hm; // carry -> smallest normal
  }
  // Normal: find the unbiased exponent, robust at power-of-two boundaries
  // where Math.log2's rounding can land a hair off.
  let E = Math.floor(Math.log2(a));
  if (2 ** E > a) E--;
  else if (2 ** (E + 1) <= a) E++;
  if (E >= 16) return sign | 0x7c00; // >= 65536 overflows to Inf
  // Significand scaled so the 10 mantissa bits sit below the point: exact
  // power-of-two scale, then one RNE. hm in [1024, 2048]; 2048 = exponent carry.
  let hm = roundTiesToEven(a * 2 ** (10 - E));
  if (hm === 2048) { E++; hm = 1024; }
  if (E >= 16) return sign | 0x7c00; // 65504..65536 tie region rounds up to Inf
  return sign | ((E + 15) << 10) | (hm - 1024);
}

/** IEEE 754 binary16 bit pattern (uint16) -> JS number. Exact (f16 is a subset of f64). */
export function halfToFloat(bits: number): number {
  const h = bits & 0xffff;
  const e = (h >>> 10) & 0x1f;
  const m = h & 0x3ff;
  let v: number;
  if (e === 0) v = m * 2 ** -24; // subnormal (or zero)
  else if (e === 31) v = m ? Number.NaN : Number.POSITIVE_INFINITY;
  else v = (1 + m / 1024) * 2 ** (e - 15);
  return h & 0x8000 ? -v : v; // -0 preserved
}

// Detected once: the platform Float16Array constructor, when it exists.
// deno-lint-ignore no-explicit-any
const F16: (new (n: number | ArrayBufferLike) => { buffer: ArrayBufferLike; set(a: ArrayLike<number>): void; length: number }) | undefined =
  (globalThis as Record<string, unknown>).Float16Array as never;

/** Float32 array -> packed binary16 bit patterns. Platform Float16Array fast path when present. */
export function packF16(src: Float32Array): Uint16Array {
  if (F16) {
    const h = new F16(src.length);
    h.set(src); // the platform's f32 -> f16 conversion (RNE, same as the manual path)
    return new Uint16Array(h.buffer, 0, src.length);
  }
  const out = new Uint16Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = floatToHalf(src[i]!);
  return out;
}

/** Packed binary16 bit patterns -> Float32 array. Platform Float16Array fast path when present. */
export function unpackF16(src: Uint16Array): Float32Array {
  const out = new Float32Array(src.length);
  if (F16) {
    const bits = new Uint16Array(src); // copy: src may be an offset subarray
    const view = new F16(bits.buffer);
    out.set(view as unknown as ArrayLike<number>); // element-wise f16 -> f32
    return out;
  }
  for (let i = 0; i < src.length; i++) out[i] = halfToFloat(src[i]!);
  return out;
}

// ─── alpha ───────────────────────────────────────────────────────────────────

/**
 * In-place premultiply, an ENCODE-boundary helper (the working buffer is
 * always un-premultiplied). Returns the same frame for chaining.
 */
export function premultiply(frame: DeepFrame): DeepFrame {
  const d = frame.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a !== 1) { d[i]! *= a; d[i + 1]! *= a; d[i + 2]! *= a; }
  }
  return frame;
}

/**
 * In-place unpremultiply. At alpha 0 the colour is unrecoverable, so the
 * channels are left untouched rather than divided into Inf/NaN.
 */
export function unpremultiply(frame: DeepFrame): DeepFrame {
  const d = frame.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a !== 0 && a !== 1) { d[i]! /= a; d[i + 1]! /= a; d[i + 2]! /= a; }
  }
  return frame;
}

// ─── scanline map ────────────────────────────────────────────────────────────

/**
 * Run `fn` over each scanline as a zero-copy subarray view (mutations write
 * through to the frame), so filter work can stream a frame without whole-frame
 * copies, which is the memory mitigation for 16-byte-per-pixel buffers.
 */
export function mapScanlines(frame: DeepFrame, fn: (row: Float32Array, y: number) => void): DeepFrame {
  const stride = frame.width * 4;
  for (let y = 0; y < frame.height; y++) {
    fn(frame.data.subarray(y * stride, (y + 1) * stride), y);
  }
  return frame;
}

// ─── colour-space conversion ─────────────────────────────────────────────────

type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

const mul3 = (a: Mat3, b: Mat3): Mat3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];

// All matrices below: CSS Color Level 4 sample code (conversions.js),
// https://www.w3.org/TR/css-color-4/#color-conversion-code, full-precision
// primary matrices, all D65. gamut-source.ts's pre-composed sRGB<->P3 /
// sRGB->Rec.2020 matrices are 7-digit roundings of products of these; the
// agreement is pinned by tests against its exported functions.

// Linear sRGB (Rec.709 primaries) <-> CIE XYZ, D65.
const SRGB_TO_XYZ_D65: Mat3 = [
  0.41239079926595934, 0.357584339383878, 0.1804807884018343,
  0.21263900587151027, 0.715168678767756, 0.07219231536073371,
  0.01933081871559182, 0.11919477979462598, 0.9505321522496607,
];
const XYZ_D65_TO_SRGB: Mat3 = [
  3.2409699419045226, -1.537383177570094, -0.4986107602930034,
  -0.9692436362808796, 1.8759675015077202, 0.04155505740717559,
  0.05563007969699366, -0.20397695888897652, 1.0569715142428786,
];

// Linear Display-P3 <-> CIE XYZ, D65.
const P3_TO_XYZ_D65: Mat3 = [
  0.4865709486482162, 0.26566769316909306, 0.19821728523436247,
  0.2289745640697488, 0.6917385218365064, 0.079286914093745,
  0.0, 0.04511338185890264, 1.043944368900976,
];
const XYZ_D65_TO_P3: Mat3 = [
  2.493496911941425, -0.9313836179191239, -0.40271078445071684,
  -0.8294889695615747, 1.7626640603183463, 0.023624685841943577,
  0.03584583024378447, -0.07617238926804182, 0.9568845240076872,
];

// Linear Rec.2020 <-> CIE XYZ, D65.
const REC2020_TO_XYZ_D65: Mat3 = [
  0.6369580483012914, 0.14461690358620832, 0.16888097516417205,
  0.2627002120112671, 0.6779980715188708, 0.05930171646986196,
  0.0, 0.028072693049087428, 1.060985057710791,
];
const XYZ_D65_TO_REC2020: Mat3 = [
  1.716651187971268, -0.355670783776392, -0.25336628137366,
  -0.666684351832489, 1.616481236634939, 0.0157685458139111,
  0.017639857445311, -0.042770613257809, 0.942103121235474,
];

// Bradford chromatic adaptation, D65 <-> D50: the CSS Color 4 pair (which is
// also the ICC-recommended CAT). brand-derive.ts carries the same D50->D65
// matrix for its lch() path; kept in sync deliberately.
const XYZ_D65_TO_D50: Mat3 = [
  1.0479298208405488, 0.022946793341019088, -0.05019222954313557,
  0.029627815688159344, 0.990434484573249, -0.01707382502938514,
  -0.009243058152591178, 0.015055144896577895, 0.7518742899580008,
];
const XYZ_D50_TO_D65: Mat3 = [
  0.9554734527042182, -0.023098536874261423, 0.0632593086610217,
  -0.028369706963208136, 1.0099954580058226, 0.021041398966943008,
  0.012314001688319899, -0.020507696433477912, 1.3303659366080753,
];

// Each space's matrix leg to/from the XYZ-D65 hub. Lab is the one nonlinear
// space; its matrix neighbour is xyz-d50 (CIELAB is defined against D50).
type MatSpace = Exclude<PixelSpace, 'lab'>;
const TO_XYZ_D65: Readonly<Record<MatSpace, Mat3>> = {
  'srgb-linear': SRGB_TO_XYZ_D65,
  'display-p3-linear': P3_TO_XYZ_D65,
  'rec2020-linear': REC2020_TO_XYZ_D65,
  'xyz-d50': XYZ_D50_TO_D65,
};
const FROM_XYZ_D65: Readonly<Record<MatSpace, Mat3>> = {
  'srgb-linear': XYZ_D65_TO_SRGB,
  'display-p3-linear': XYZ_D65_TO_P3,
  'rec2020-linear': XYZ_D65_TO_REC2020,
  'xyz-d50': XYZ_D65_TO_D50,
};

// ─── CIELAB (D50) ────────────────────────────────────────────────────────────

// D50 reference white: CSS Color 4 rational values (0.3457/0.3585 chromaticity),
// the same constants as brand-derive.ts#D50_WHITE, kept in sync.
const D50_WHITE: readonly [number, number, number] = [0.9642956764295677, 1, 0.8251046025104602];

// CIE 15 constants in the exact rational form CSS Color 4 (and brand-derive.ts) use.
const LAB_K = 24389 / 27;
const LAB_E = 216 / 24389;

// XYZ (D50) -> CIELAB. L 0..100, a/b unbounded.
function xyzD50ToLab(X: number, Y: number, Z: number): [number, number, number] {
  const f = (t: number): number => (t > LAB_E ? Math.cbrt(t) : (LAB_K * t + 16) / 116);
  const fx = f(X / D50_WHITE[0]);
  const fy = f(Y / D50_WHITE[1]);
  const fz = f(Z / D50_WHITE[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// CIELAB -> XYZ (D50). Same piecewise inverse as brand-derive.ts#labToOklch.
function labToXyzD50(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const xr = fx ** 3 > LAB_E ? fx ** 3 : (116 * fx - 16) / LAB_K;
  const yr = L > LAB_K * LAB_E ? fy ** 3 : L / LAB_K;
  const zr = fz ** 3 > LAB_E ? fz ** 3 : (116 * fz - 16) / LAB_K;
  return [xr * D50_WHITE[0], yr * D50_WHITE[1], zr * D50_WHITE[2]];
}

// ─── convertSpace ────────────────────────────────────────────────────────────

/**
 * Convert a frame between pixel spaces. Returns the SAME frame when the target
 * equals the source (no copy; callers who need isolation copy first);
 * otherwise a new frame with a fresh buffer. Alpha passes through untouched.
 *
 * Matrix legs are pre-composed into a single 3x3 per call, so e.g.
 * srgb -> rec2020 involves no intermediate quantisation and no Bradford pass
 * (both are D65); xyz-d50 legs fold the Bradford adaptation into the same
 * single matrix. Out-of-gamut and >1 values pass straight through; that
 * unboundedness is the point of the float buffer.
 */
export function convertSpace(frame: DeepFrame, target: PixelSpace): DeepFrame {
  assertSpace(frame.space);
  assertSpace(target);
  if (frame.space === target) return frame;

  const srcLab = frame.space === 'lab';
  const dstLab = target === 'lab';
  const matSrc: MatSpace = frame.space === 'lab' ? 'xyz-d50' : frame.space;
  const matDst: MatSpace = target === 'lab' ? 'xyz-d50' : target;
  // Identity when both nonlinear legs share the xyz-d50 neighbour (lab <-> xyz-d50).
  const M: Mat3 | null = matSrc === matDst ? null : mul3(FROM_XYZ_D65[matDst], TO_XYZ_D65[matSrc]);

  const src = frame.data;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 4) {
    let x = src[i]!;
    let y = src[i + 1]!;
    let z = src[i + 2]!;
    if (srcLab) [x, y, z] = labToXyzD50(x, y, z);
    if (M) {
      const nx = M[0] * x + M[1] * y + M[2] * z;
      const ny = M[3] * x + M[4] * y + M[5] * z;
      const nz = M[6] * x + M[7] * y + M[8] * z;
      x = nx; y = ny; z = nz;
    }
    if (dstLab) [x, y, z] = xyzD50ToLab(x, y, z);
    out[i] = x;
    out[i + 1] = y;
    out[i + 2] = z;
    out[i + 3] = src[i + 3]!;
  }
  return { width: frame.width, height: frame.height, data: out, space: target };
}
