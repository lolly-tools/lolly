// SPDX-License-Identifier: MPL-2.0
/**
 * ICC profiles applied to deep pixel buffers: the digiKam act (deeprichpixels
 * section 3, section 5.1): input profile → PCS → working/output space, per pixel, over a
 * {@link DeepFrame}. icc.ts READS a profile and answers per-colour questions;
 * this module is the missing half. It runs that transform over a float image,
 * which is what makes soft-proofing and honest deep ingest possible.
 *
 * Division of labour, deliberately strict: icc.ts stays the single
 * implementation of ICC semantics (curve evaluation, CLUT layout, the 16-bit
 * legacy Lab scale its decodePcs/encodePcs own, see icc.ts:880, and the
 * media-white rules). Its pipelines are private on purpose, so this module
 * consumes only the reader's public contract (`toLab`/`fromLab`) and never
 * re-reads profile bytes:
 *
 *   - Matrix/TRC and gray profiles ({@link iccRoundTripDecides} false) are
 *     evaluated DIRECTLY per pixel: analytic, so no resampling error is added.
 *   - Pure-LUT profiles are pre-linked ONCE per (profile, direction, intent)
 *     into a 33-per-axis device-link lattice sampled through the reader (the
 *     same shape littleCMS's cmsCreateTransform pre-links; 33 is the
 *     conventional device-link grid), then evaluated per pixel by TETRAHEDRAL
 *     interpolation. Tetrahedral over trilinear (Sakamoto's 6-tetrahedron cell
 *     split, the default CLUT interpolator in littleCMS and most CMMs): all six
 *     tetrahedra share the cell's main diagonal. That is the axis a well-formed
 *     profile lays its neutral along, so greys interpolate through the
 *     diagonal's own nodes instead of being averaged from all 8 corners
 *     (trilinear tints greys between nodes), and each output reads 4 lattice
 *     nodes rather than 8. Resampling error is bounded by the profile's own
 *     CLUT quantisation (real B2A tables are 17³/33³ grids of 8/16-bit nodes).
 *
 * Rendering-intent fallback (ICC.1:2010, i.e. ICC v4.3): the required-tag
 * tables of clause 8 (section 8.4 display-class, section 8.5 output-class) make only the
 * perceptual …0 LUT pair universally mandatory. A2B1/B2A1 and A2B2/B2A2 are
 * optional outside output-class profiles, so a CMM asked for an intent whose
 * table is absent substitutes the perceptual table rather than refusing.
 * {@link iccResolvedIntent} implements that: absolute degrades through relative
 * first (Annex A defines it AS relative plus the media-white rescale), then
 * everything degrades to perceptual. Note the contrast with icc.ts's
 * `hasIntent`, which deliberately refuses to fall back: for GAMUT membership a
 * silently substituted table is a wrong answer, but for RENDERING pixels the
 * fallback is what the spec's optional tags imply. Refusing would fail on
 * nearly every real display profile.
 *
 * Frame conventions (the seam between babl-style tagged buffers and ICC's
 * profile-defined device spaces):
 *
 *   - `toPcs` reads the frame's first `nChannels` channels (R, or R/G/B) as the
 *     profile's ENCODED device channel values in 0..1, NOT linear light. That
 *     claim is REQUIRED of the caller, not assumed: the input must be tagged
 *     {@link ICC_DEVICE_SPACE}, the same sentinel `fromPcs` stamps on its own
 *     output, so the two halves are symmetric and a device frame flows from one
 *     into the other untouched. Every member of PixelSpace is refused: the four
 *     linear ones because a frame from `fromU8Srgb` holds LINEAR LIGHT and
 *     reading those channels as encoded device values is precisely the
 *     laundering this module exists to prevent (linear 0.21404114 IS encoded
 *     0.5, i.e. L* 53.389; read as an encoded value it lands near L* 22.9, a
 *     plausible-looking 30-unit lie), and `lab` because it is the PCS side, not
 *     a device side. Deep ingest builds device frames from decoded file bytes
 *     and tags them ICC_DEVICE_SPACE. Output is a real `lab` frame (L 0..100,
 *     matching pixels.ts's lab convention).
 *   - `fromPcs` takes a colorimetric frame (any real PixelSpace; converted to
 *     Lab per scanline) and returns the profile's encoded device channels. A
 *     one-channel (gray) result is replicated into R=G=B.
 *   - Device-side OUTPUT frames are tagged {@link ICC_DEVICE_SPACE}, a value
 *     deliberately OUTSIDE the PixelSpace union. There is no honest member for
 *     "channels whose meaning is this profile": tagging them `srgb-linear`
 *     would let convertSpace/toU8Srgb silently launder device values into wrong
 *     colour. With the sentinel, pixels.ts's colorimetric machinery throws its
 *     own loud "unknown pixel space" instead, while `toU16` (which only refuses
 *     lab) still encodes device bytes for a writer: exactly the split a
 *     terminal device frame wants. If PixelSpace ever grows a device member
 *     this constant collapses into it.
 *   - ICC transforms are display-referred: `toLab` clamps device channels to
 *     0..1 and PCS Lab is bounded by its encoding box (L 0..100, a/b −128..127,
 *     ICC.1:2010 section 6.3.4.2), so HDR headroom does not survive. A view
 *     transform maps it first (deeprichpixels section 5.2). Non-finite pixel values
 *     (data damage) are read as 0 rather than poisoning the row.
 *
 * Contract, matching icc.ts: NEVER throws. A malformed profile, an unusable
 * intent, an unsupported channel count (only 1- and 3-channel device spaces fit
 * an RGBA frame; CMYK frames have no representation yet) or a nonsense frame
 * yields `null`. {@link iccFrameRefusal} is the pure companion that says WHY a
 * frame was refused, since a bare null cannot carry a sentence.
 * Scanline processing throughout: the only whole-frame
 * allocation is the output buffer; `convertViaIcc` fuses both legs per row so
 * no intermediate PCS frame exists.
 *
 * Pure and deterministic: typed-array maths only. No DOM, no IO, no clock.
 */

import type { RenderingIntent } from './gamut-source.ts';
import { type IccProfile, iccRoundTripDecides } from './icc.ts';
import { PIXEL_SPACES, type DeepFrame, type PixelSpace, convertSpace } from './pixels.ts';

// ─── public vocabulary ────────────────────────────────────────────────────────

/** Which half of the profile's transform to run. */
export type IccDirection = 'toPcs' | 'fromPcs';

/**
 * The `space` tag on a device-side frame this module returns. Deliberately not
 * a member of the PixelSpace union (see the header): pixels.ts's colorimetric
 * functions throw their own "unknown pixel space" on it (loud, immediate),
 * while `toU16` still encodes the 0..1 device channels for a writer.
 */
export const ICC_DEVICE_SPACE = 'icc-device' as PixelSpace;

// ─── intent resolution ────────────────────────────────────────────────────────

// Fallback chains per ICC.1:2010 clause 8 (see header): absolute IS relative
// plus the Annex A rescale, so it degrades through relative; everything ends at
// perceptual, the only universally required table. Object.hasOwn-guarded before
// indexing (an unchecked WHITELIST[v] is truthy for 'constructor').
const FALLBACK: Readonly<Record<RenderingIntent, readonly RenderingIntent[]>> = {
  perceptual: ['perceptual'],
  relative: ['relative', 'perceptual'],
  saturation: ['saturation', 'perceptual'],
  absolute: ['absolute', 'relative', 'perceptual'],
};

/**
 * The intent whose table will actually be used for `direction`, after the ICC
 * v4 fallback rules, or null when the profile has no usable transform in that
 * direction at all. Exposed so a caller (soft-proof UI, export report) can say
 * "rendered relative: this profile has no saturation table" instead of
 * silently substituting; {@link applyIccToFrame} uses exactly this resolution.
 *
 * Probed by evaluation (mid-grey device / Lab 50) rather than tag presence,
 * because `hasIntent` is direction-blind: a profile with only A2B1 reports
 * relative support that `fromLab` cannot honour.
 */
export function iccResolvedIntent(
  profile: IccProfile,
  direction: IccDirection,
  intent: RenderingIntent,
): RenderingIntent | null {
  try {
    if (!profile || typeof profile.toLab !== 'function' || typeof profile.fromLab !== 'function') return null;
    if (!Object.hasOwn(FALLBACK, intent)) return null;
    const n = profile.nChannels;
    if (!Number.isInteger(n) || n < 1) return null;
    const midDevice = new Array<number>(n).fill(0.5);
    for (const cand of FALLBACK[intent]) {
      const ok = direction === 'toPcs'
        ? profile.toLab(cand, midDevice) !== null
        : profile.fromLab(cand, [50, 0, 0]) !== null;
      if (ok) return cand;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── the device-link lattice (pure-LUT profiles) ─────────────────────────────

/**
 * Nodes per axis. 33 is the conventional device-link grid (littleCMS device
 * links, ProfileMaker), dense enough that piecewise-linear resampling of a
 * profile's own in-curves adds error well below the source table's 8/16-bit
 * node quantisation, small enough that a build is ~36k reader calls and ~430 kB.
 *
 * The number is PINNED by a test, not decorative: an affine fixture is
 * reproduced exactly at any density, so tests/icc-pixels.test.ts carries a
 * profile whose in-curves kink at every k/32 and asserts the lattice tracks the
 * reader to 0.05 Lab. Lowering this constant fails it by tens of Lab units.
 */
const LATTICE_N = 33;

// Strides of one step along each axis, in floats (3 outputs per node).
const L_S2 = 3;
const L_S1 = LATTICE_N * 3;
const L_S0 = LATTICE_N * LATTICE_N * 3;

/** Built lattices, cached per profile and (direction, resolved intent). */
const LATTICES = new WeakMap<IccProfile, Map<string, Float32Array | null>>();

/**
 * Sample the profile's transform on the regular grid. toPcs domain is the
 * device cube [0,1]³; fromPcs domain is the PCS Lab encoding box (L 0..100,
 * a/b −128..127 (ICC.1:2010 section 6.3.4.2); values outside clamp to the boundary at
 * evaluation time, the same clamp the profile's own PCS encoding applies).
 */
function buildLattice(profile: IccProfile, direction: IccDirection, intent: RenderingIntent): Float32Array | null {
  const s = LATTICE_N - 1;
  const lat = new Float32Array(LATTICE_N * LATTICE_N * LATTICE_N * 3);
  let p = 0;
  for (let i = 0; i < LATTICE_N; i++) {
    for (let j = 0; j < LATTICE_N; j++) {
      for (let k = 0; k < LATTICE_N; k++) {
        const res = direction === 'toPcs'
          ? profile.toLab(intent, [i / s, j / s, k / s])
          : profile.fromLab(intent, [(i / s) * 100, (j / s) * 255 - 128, (k / s) * 255 - 128]);
        if (!res || res.length !== 3) return null;
        if (!Number.isFinite(res[0]!) || !Number.isFinite(res[1]!) || !Number.isFinite(res[2]!)) return null;
        lat[p++] = res[0]!;
        lat[p++] = res[1]!;
        lat[p++] = res[2]!;
      }
    }
  }
  return lat;
}

function getLattice(profile: IccProfile, direction: IccDirection, intent: RenderingIntent): Float32Array | null {
  let byKey = LATTICES.get(profile);
  if (!byKey) {
    byKey = new Map();
    LATTICES.set(profile, byKey);
  }
  const key = `${direction}:${intent}`;
  if (byKey.has(key)) return byKey.get(key) ?? null;
  const lat = buildLattice(profile, direction, intent);
  byKey.set(key, lat);
  return lat;
}

const clamp01 = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v);

/** Non-finite pixel values are data damage; read them as 0 rather than NaN-poisoning the row. */
const san = (v: number): number => (Number.isFinite(v) ? v : 0);

/**
 * Tetrahedral interpolation at normalised coordinates (u,v,w) ∈ [0,1]³,
 * writing the 3 outputs at out[o..o+2]. The cell is split into the 6 tetrahedra
 * that share its main diagonal; the vertex path steps axes in descending order
 * of their fractional parts, so out = P₀ + f₁(P₁−P₀) + f₂(P₂−P₁) + f₃(P₃−P₂)
 * with f₁ ≥ f₂ ≥ f₃, barycentric weights that reproduce any affine function
 * exactly (which is what the tests pin with the identity LUT).
 */
function tetraEval(lat: Float32Array, u: number, v: number, w: number, out: Float32Array, o: number): void {
  const s = LATTICE_N - 1;
  const x = clamp01(u) * s;
  const y = clamp01(v) * s;
  const z = clamp01(w) * s;
  let i = Math.floor(x);
  let j = Math.floor(y);
  let k = Math.floor(z);
  if (i >= s) i = s - 1;
  if (j >= s) j = s - 1;
  if (k >= s) k = s - 1;
  const fx = x - i;
  const fy = y - j;
  const fz = z - k;
  const p0 = i * L_S0 + j * L_S1 + k * L_S2;
  // Axis order by descending fraction → the tetrahedron and its vertex path.
  let o1: number;
  let o2: number;
  let f1: number;
  let f2: number;
  let f3: number;
  if (fx >= fy) {
    if (fy >= fz) { o1 = L_S0; o2 = L_S0 + L_S1; f1 = fx; f2 = fy; f3 = fz; }
    else if (fx >= fz) { o1 = L_S0; o2 = L_S0 + L_S2; f1 = fx; f2 = fz; f3 = fy; }
    else { o1 = L_S2; o2 = L_S2 + L_S0; f1 = fz; f2 = fx; f3 = fy; }
  } else if (fx >= fz) { o1 = L_S1; o2 = L_S1 + L_S0; f1 = fy; f2 = fx; f3 = fz; }
  else if (fy >= fz) { o1 = L_S1; o2 = L_S1 + L_S2; f1 = fy; f2 = fz; f3 = fx; }
  else { o1 = L_S2; o2 = L_S2 + L_S1; f1 = fz; f2 = fy; f3 = fx; }
  const o3 = L_S0 + L_S1 + L_S2;
  for (let c = 0; c < 3; c++) {
    const a = lat[p0 + c]!;
    const b1 = lat[p0 + o1 + c]!;
    const b2 = lat[p0 + o2 + c]!;
    const b3 = lat[p0 + o3 + c]!;
    out[o + c] = a + f1 * (b1 - a) + f2 * (b2 - b1) + f3 * (b3 - b2);
  }
}

// ─── row evaluators ───────────────────────────────────────────────────────────

/** Transforms one RGBA scanline IN PLACE (alpha untouched). False = unrecoverable failure. */
type RowFn = (row: Float32Array) => boolean;

/**
 * Build the per-row evaluator for (profile, direction, resolved intent), or
 * null when the profile cannot run this direction. Matrix/TRC and gray
 * profiles go through the reader directly (exact); pure-LUT profiles through
 * the tetrahedral lattice. A pure-LUT single-channel profile has no direct
 * path and no 3D lattice domain, so it is refused (none is known to exist; stock gray
 * profiles all carry kTRC and take the direct path).
 */
function rowEvaluator(profile: IccProfile, direction: IccDirection, intent: RenderingIntent): RowFn | null {
  const n = profile.nChannels;
  if (n !== 1 && n !== 3) return null;
  const direct = !iccRoundTripDecides(profile);

  if (!direct) {
    if (n !== 3) return null;
    const lat = getLattice(profile, direction, intent);
    if (!lat) return null;
    if (direction === 'toPcs') {
      return (row) => {
        for (let i = 0; i < row.length; i += 4) {
          tetraEval(lat, san(row[i]!), san(row[i + 1]!), san(row[i + 2]!), row, i);
        }
        return true;
      };
    }
    return (row) => {
      for (let i = 0; i < row.length; i += 4) {
        tetraEval(lat, san(row[i]!) / 100, (san(row[i + 1]!) + 128) / 255, (san(row[i + 2]!) + 128) / 255, row, i);
      }
      return true;
    };
  }

  if (direction === 'toPcs') {
    return (row) => {
      for (let i = 0; i < row.length; i += 4) {
        const dev = n === 1
          ? [san(row[i]!)]
          : [san(row[i]!), san(row[i + 1]!), san(row[i + 2]!)];
        const lab = profile.toLab(intent, dev);
        if (!lab) return false;
        row[i] = lab[0];
        row[i + 1] = lab[1];
        row[i + 2] = lab[2];
      }
      return true;
    };
  }
  return (row) => {
    for (let i = 0; i < row.length; i += 4) {
      const dev = profile.fromLab(intent, [san(row[i]!), san(row[i + 1]!), san(row[i + 2]!)]);
      if (!dev || dev.length !== n) return false;
      if (n === 1) {
        row[i] = dev[0]!;
        row[i + 1] = dev[0]!;
        row[i + 2] = dev[0]!;
      } else {
        row[i] = dev[0]!;
        row[i + 1] = dev[1]!;
        row[i + 2] = dev[2]!;
      }
    }
    return true;
  };
}

// ─── validation ───────────────────────────────────────────────────────────────

function frameSane(frame: DeepFrame): boolean {
  return !!frame
    && frame.data instanceof Float32Array
    && Number.isInteger(frame.width) && Number.isInteger(frame.height)
    && frame.width > 0 && frame.height > 0
    && frame.data.length === frame.width * frame.height * 4;
}

const profileSane = (p: IccProfile): boolean =>
  !!p && typeof p.toLab === 'function' && typeof p.fromLab === 'function';

/**
 * Is this frame acceptable as the DEVICE side of a transform? Only the
 * {@link ICC_DEVICE_SPACE} sentinel is. Every real PixelSpace is colorimetric,
 * the four linear-light spaces and Lab, so accepting one would mean reading light
 * as encoded ink, which is the laundering the header describes; the sentinel is
 * the caller's explicit statement that these channels mean "this profile".
 */
const deviceInputOk = (frame: DeepFrame): boolean => frame.space === ICC_DEVICE_SPACE;

/** Is this frame acceptable as the PCS side? Must be genuinely colorimetric (a real PixelSpace). */
const pcsInputOk = (frame: DeepFrame): boolean => PIXEL_SPACES.includes(frame.space);

/**
 * Why `frame` cannot serve as `direction`'s input, as a sentence naming the
 * fix, or null when it can. The transforms keep icc.ts's never-throw /
 * return-null convention, so this is where the reason lives: a caller (or a
 * test) reads the explanation instead of guessing at a bare null. Pure: it
 * inspects the frame's shape and tag only, and is the same predicate
 * {@link applyIccToFrame} and {@link convertViaIcc} gate on.
 */
export function iccFrameRefusal(frame: DeepFrame, direction: IccDirection): string | null {
  if (!frameSane(frame)) return 'not a well-formed DeepFrame: width, height and data length must agree';
  if (direction !== 'toPcs' && direction !== 'fromPcs') return `unknown direction: ${String(direction)}`;
  if (direction === 'toPcs') {
    if (deviceInputOk(frame)) return null;
    return `toPcs needs ENCODED device channels, but this frame is tagged '${String(frame.space)}' — a colorimetric `
      + 'space (linear light, or the PCS itself), whose channels are not this profile\'s device values. '
      + `Tag a genuine device frame with ICC_DEVICE_SPACE ('${String(ICC_DEVICE_SPACE)}'); to transform `
      + "colorimetric pixels, run the profile's other half with direction 'fromPcs' instead.";
  }
  if (pcsInputOk(frame)) return null;
  return `fromPcs needs a colorimetric frame (a real PixelSpace), but this frame is tagged '${String(frame.space)}' `
    + "— device channels carry no colorimetry on their own. Run direction 'toPcs' with their profile first.";
}

// ─── the transforms ───────────────────────────────────────────────────────────

/**
 * Run one half of an ICC transform over a frame under `intent` (with the ICC
 * v4 fallback of {@link iccResolvedIntent} when that intent's table is absent).
 *
 * `toPcs`: device-encoded frame (which must be tagged {@link ICC_DEVICE_SPACE},
 * see the header) → PCS, returned as a `lab` frame.
 * `fromPcs`: colorimetric frame (converted to Lab per scanline if needed) →
 * device channels, returned tagged {@link ICC_DEVICE_SPACE}.
 *
 * Alpha passes through untouched. Returns null (never throws) on any
 * profile, direction, intent or frame this module cannot honestly transform.
 */
export function applyIccToFrame(
  frame: DeepFrame,
  profile: IccProfile,
  direction: IccDirection,
  intent: RenderingIntent,
): DeepFrame | null {
  try {
    if (!profileSane(profile)) return null;
    if (iccFrameRefusal(frame, direction)) return null;
    const resolved = iccResolvedIntent(profile, direction, intent);
    if (!resolved) return null;
    const ev = rowEvaluator(profile, direction, resolved);
    if (!ev) return null;

    const { width, height } = frame;
    const stride = width * 4;
    const out = new Float32Array(frame.data.length);
    const needsLab = direction === 'fromPcs' && frame.space !== 'lab';
    for (let y = 0; y < height; y++) {
      const at = y * stride;
      if (needsLab) {
        // Per-scanline Lab conversion through pixels.ts's own maths: a row
        // wrapped as a 1-high frame, so no whole-frame intermediate exists.
        const labRow = convertSpace(
          { width, height: 1, data: frame.data.subarray(at, at + stride), space: frame.space },
          'lab',
        ).data;
        out.set(labRow, at);
      } else {
        out.set(frame.data.subarray(at, at + stride), at);
      }
      if (!ev(out.subarray(at, at + stride))) return null;
    }
    return { width, height, data: out, space: direction === 'toPcs' ? 'lab' : ICC_DEVICE_SPACE };
  } catch {
    return null;
  }
}

/**
 * Device → PCS → device: `srcProfile`'s forward transform chained into
 * `dstProfile`'s reverse, per scanline with both legs fused over one row. No
 * intermediate PCS frame is allocated. `intent` applies to each leg with its
 * own ICC v4 fallback (the destination's table availability is the one that
 * usually decides; use {@link iccResolvedIntent} to report what actually ran).
 *
 * The input frame holds `srcProfile`'s encoded device channels and must be
 * tagged {@link ICC_DEVICE_SPACE} like any device side; the result carries the
 * same tag and holds `dstProfile`'s channels, so the output of one conversion
 * is a legal input to the next. Null on anything either leg refuses.
 */
export function convertViaIcc(
  frame: DeepFrame,
  srcProfile: IccProfile,
  dstProfile: IccProfile,
  intent: RenderingIntent,
): DeepFrame | null {
  try {
    if (!profileSane(srcProfile) || !profileSane(dstProfile)) return null;
    if (iccFrameRefusal(frame, 'toPcs')) return null;
    const inSrc = iccResolvedIntent(srcProfile, 'toPcs', intent);
    const inDst = iccResolvedIntent(dstProfile, 'fromPcs', intent);
    if (!inSrc || !inDst) return null;
    const toPcs = rowEvaluator(srcProfile, 'toPcs', inSrc);
    const fromPcs = rowEvaluator(dstProfile, 'fromPcs', inDst);
    if (!toPcs || !fromPcs) return null;

    const { width, height } = frame;
    const stride = width * 4;
    const out = new Float32Array(frame.data.length);
    for (let y = 0; y < height; y++) {
      const at = y * stride;
      out.set(frame.data.subarray(at, at + stride), at);
      const row = out.subarray(at, at + stride);
      if (!toPcs(row) || !fromPcs(row)) return null;
    }
    return { width, height, data: out, space: ICC_DEVICE_SPACE };
  } catch {
    return null;
  }
}
