// SPDX-License-Identifier: MPL-2.0
/**
 * Where a gamut COMES FROM: the membership question behind gamut.ts, factored
 * out so it need not be one of three hard-coded RGB matrices.
 *
 * gamut.ts asks exactly one thing of a gamut: "is this OKLCH colour
 * reproducible?" Everything else it does (the chroma ceiling by bisection, the
 * slice fills, the boundary curves, the 3D solid) is built from that single
 * predicate. So a gamut is a predicate plus an identity, and an ICC print
 * profile can answer it as well as a 3x3 matrix can. The three display gamuts
 * live here as {@link GamutSource}s over the SAME matrices they always used, so
 * the built-in path is the old arithmetic reached through one more indirection,
 * not a reimplementation of it.
 *
 * `inkCoverage` is the one thing a matrix cannot answer and a printer must: an
 * RGB source returns null rather than a made-up number, because "total ink" is
 * not a property additive light has.
 *
 * Pure and deterministic: no Date, no Math.random, no IO.
 */

import { oklabToLinearSrgb } from './brand-derive.ts';

/**
 * The four ICC rendering intents. Only a profile-backed source cares which one
 * it was built for: the same profile is a different gamut under `perceptual`
 * than under `absolute`, which is why the intent is part of a source's identity
 * rather than an argument to `contains`.
 */
export type RenderingIntent = 'perceptual' | 'relative' | 'saturation' | 'absolute';

export interface GamutSource {
  /** Stable identity. 'srgb' | 'p3' | 'rec2020' for the built-ins; for a profile
   *  'icc:<sha256-prefix>:<intent>' so an override can be keyed by it. */
  readonly id: string;
  /** Human label, e.g. 'sRGB' or 'Coated FOGRA39 (perceptual)'. */
  readonly label: string;
  /** Is this OKLCH colour reproducible? l is 0-1 (NOT the CSS percent), h in degrees. */
  contains(l: number, c: number, h: number): boolean;
  /**
   * Total ink coverage for the device values this colour maps to, or null when
   * the concept does not apply (RGB sources return null).
   *
   * The unit is channels: 1.0 is one ink at full, so a four-ink profile can
   * return up to 4.0, the printing trade's "400% TAC", which is the number a
   * pressroom ink limit is actually written in. Deliberately NOT normalised to
   * 0-1: dividing by the channel count would turn a 340% limit into 0.85 and
   * lose the only figure a printer would recognise.
   */
  inkCoverage?(l: number, c: number, h: number): number | null;
}

/** The three display gamuts, narrowest first. `GamutName` adds `'none'` on top. */
export type BuiltinGamutName = 'srgb' | 'p3' | 'rec2020';

/** Anything the gamut functions accept as "the gamut to test against". */
export type GamutLimit = BuiltinGamutName | GamutSource;

type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

const apply3 = (m: Mat3, x: number, y: number, z: number): [number, number, number] => [
  m[0] * x + m[1] * y + m[2] * z,
  m[3] * x + m[4] * y + m[5] * z,
  m[6] * x + m[7] * y + m[8] * z,
];

// Linear sRGB -> linear Display-P3 and -> linear Rec.2020, pre-composed from the
// CSS Color 4 primaries (sRGB->XYZ(D65) then XYZ->the target's inverse matrix).
// Both share sRGB's D65 white point, so no chromatic adaptation is involved and
// pure white/black map to themselves. To note when reading the numbers:
// each row sums to 1.
const SRGB_TO_P3: Mat3 = [
  0.8224621, 0.1775380, 0.0000000,
  0.0331941, 0.9668058, 0.0000000,
  0.0170827, 0.0723974, 0.9105199,
];
const SRGB_TO_REC2020: Mat3 = [
  0.6274040, 0.3292820, 0.0433136,
  0.0690970, 0.9195400, 0.0113612,
  0.0163916, 0.0880132, 0.8955953,
];

// Slack on the cube test, in LINEAR light. Deliberately far tighter than
// brand-derive's `GAMUT_EPSILON` (1e-4), which is a bisection tolerance rather
// than a shape query: an absolute epsilon in linear light is negligible at the
// top of the range but enormous near black, where every channel is a few
// thousandths. At 1e-4 the near-black boundary visibly bulges. maxChroma at
// hue 30 spiked to 0.070 around L 0.012 before falling back to 0.034, a hook in
// the chart that is an artefact of the slack, not a property of sRGB.
//
// 1e-6 is two orders of magnitude clear of reality: the worst out-of-cube
// excursion for an actual 8-bit sRGB colour round-tripped through hexToOklch is
// 2e-7 (at #ffffff), so nothing displayable is misclassified.
// GAMUT_EPSILON keeps its own job in gamut.ts, as maxChroma's bisection tolerance.
const EPS = 1e-6;

const inUnitCube = (rgb: readonly [number, number, number]): boolean =>
  rgb[0] >= -EPS && rgb[0] <= 1 + EPS
  && rgb[1] >= -EPS && rgb[1] <= 1 + EPS
  && rgb[2] >= -EPS && rgb[2] <= 1 + EPS;

/**
 * Membership in one of the three RGB display gamuts: the original arithmetic,
 * unchanged: Oklab -> linear sRGB, then one pre-composed 3x3 for the wider two.
 *
 * The matrix is chosen by an exhaustive comparison rather than "anything that
 * isn't sRGB or P3", so a name this function has never heard of cannot fall
 * through into the Rec.2020 branch and be answered confidently with the wrong
 * gamut. Callers reach it through a {@link GamutSource}, which keeps the name
 * space closed.
 */
function rgbContains(name: BuiltinGamutName, l: number, c: number, h: number): boolean {
  const hr = (h * Math.PI) / 180;
  const lin = oklabToLinearSrgb(l, c * Math.cos(hr), c * Math.sin(hr));
  if (name === 'srgb') return inUnitCube(lin);
  const m = name === 'p3' ? SRGB_TO_P3 : SRGB_TO_REC2020;
  return inUnitCube(apply3(m, lin[0], lin[1], lin[2]));
}

/**
 * Rejects the values no display can be asked for, before any source sees them.
 *
 * The domain bounds carry the same EPS slack the cube test does, and for the same
 * reason: `l` usually arrives from a conversion rather than a literal, and
 * Lab(100, 0, 0) -> OKLCH overshoots 1 by 1.05e-9. Without the slack, media white
 * (inside every gamut by definition, and the one colour an output profile
 * reproduces exactly) would read as out of gamut when spelled `lab(100 0 0)` and
 * inside sRGB when spelled `#fff`.
 */
export const gamutInputSane = (l: number, c: number, h: number): boolean =>
  l >= -EPS && l <= 1 + EPS && c >= -EPS && Number.isFinite(h);

const rgbSource = (name: BuiltinGamutName, label: string): GamutSource => ({
  id: name,
  label,
  contains: (l, c, h) => gamutInputSane(l, c, h) && rgbContains(name, l, c, h),
  // Additive light has no ink. Answering 0 here would read as "no ink needed",
  // which is a different claim from "the question does not apply".
  inkCoverage: () => null,
});

export const SRGB_SOURCE: GamutSource = rgbSource('srgb', 'sRGB');
export const P3_SOURCE: GamutSource = rgbSource('p3', 'Display-P3');
export const REC2020_SOURCE: GamutSource = rgbSource('rec2020', 'Rec.2020');

/** The built-in sources by name: the only three `GamutName` can stand for. */
export const BUILTIN_GAMUT_SOURCES: Readonly<Record<BuiltinGamutName, GamutSource>> = {
  srgb: SRGB_SOURCE,
  p3: P3_SOURCE,
  rec2020: REC2020_SOURCE,
};

/**
 * The gamut that answers nothing: contains no colour and has no ink to report.
 *
 * Reached when a caller hands over something that is not a gamut at all: null,
 * `{}`, or the inert `ColorProfileGamut` handle from `host.color.iccProfile`,
 * which carries an id, a label and `usable: true` and so reads as source-like.
 * Substituting sRGB there would answer a press question with display numbers, a
 * plausible wrong answer; this way every query degrades to its documented
 * no-answer value (false / 0 / an empty region) instead.
 */
export const NO_GAMUT_SOURCE: GamutSource = {
  id: 'none',
  label: 'unknown gamut',
  contains: () => false,
  inkCoverage: () => null,
};

/** A name or a source in, always a source out. Idempotent on sources. */
export function resolveGamutSource(limit: GamutLimit): GamutSource {
  if (typeof limit !== 'string') {
    // Duck-typed rather than trusted. A limit can arrive from an untyped tool
    // hook, and returning it verbatim made `contains` a TypeError thrown out of
    // whatever asked (from a beforeExport hook, a visibly failed export), where
    // the unknown-NAME branch below has always degraded quietly.
    return typeof (limit as GamutSource | null | undefined)?.contains === 'function'
      ? (limit as GamutSource)
      : NO_GAMUT_SOURCE;
  }
  // Own-property lookup on a literal object would answer 'constructor' too.
  const built = Object.hasOwn(BUILTIN_GAMUT_SOURCES, limit) ? BUILTIN_GAMUT_SOURCES[limit] : undefined;
  return built ?? SRGB_SOURCE;
}

/**
 * The stable string identity of a limit, for cache keys.
 *
 * Interpolating a limit into a template string used to be safe when every limit
 * was a name; a source stringifies to '[object Object]', so two different
 * profiles would collide into one cache entry and a chart would keep showing the
 * previous gamut's fill. Key on this instead.
 */
/**
 * A membership test for one of the three built-in gamuts with everything hoisted
 * out of the loop, or null for any other source.
 *
 * `contains` on a source is the right general shape, but it is the wrong thing to
 * call 400,000 times: the call site is megamorphic (a source may be ICC-backed, so
 * nothing inlines), it re-compares the gamut NAME per pixel, and it re-runs the
 * domain guard per pixel. Measured on the slice painter that cost ~2x per pixel
 * against the pre-abstraction arithmetic.
 *
 * The domain guard is deliberately NOT applied here. Every caller of this is a
 * generator that computes l/c/h itself from a plane and a chroma ceiling, so the
 * values are finite and in range by construction. A caller passing values from
 * anywhere else must use `contains`.
 */
export function fastRgbContains(
  src: GamutSource,
): ((l: number, c: number, h: number) => boolean) | null {
  const m = src === P3_SOURCE ? SRGB_TO_P3 : src === REC2020_SOURCE ? SRGB_TO_REC2020 : null;
  if (src === SRGB_SOURCE) {
    return (l, c, h) => {
      const hr = (h * Math.PI) / 180;
      return inUnitCube(oklabToLinearSrgb(l, c * Math.cos(hr), c * Math.sin(hr)));
    };
  }
  if (!m) return null;
  return (l, c, h) => {
    const hr = (h * Math.PI) / 180;
    const lin = oklabToLinearSrgb(l, c * Math.cos(hr), c * Math.sin(hr));
    return inUnitCube(apply3(m, lin[0], lin[1], lin[2]));
  };
}

/**
 * Linear sRGB -> linear Display-P3.
 *
 * Exported so an ENCODER (oklchSlice writing bytes for a `display-p3` canvas) uses
 * the very same primaries as the membership test above. Duplicating the matrix
 * would let "is this colour in P3?" and "what are its P3 bytes?" drift apart, and
 * they must answer from one source. Both spaces share the sRGB transfer curve, so
 * this is the whole conversion while values are still linear.
 */
export const linearSrgbToLinearP3 = (
  r: number, g: number, b: number,
): [number, number, number] => apply3(SRGB_TO_P3, r, g, b);

// The exact inverse of SRGB_TO_P3, for the DECODE direction: bytes read off a
// display-p3 canvas back into the linear sRGB every other module here speaks.
// Written out rather than inverted at runtime so it can be read and checked, and
// the round-trip is pinned by a test. An inverse that has drifted from its
// forward matrix is invisible until a colour is a few percent wrong.
const P3_TO_SRGB: Mat3 = [
  1.2249401, -0.2249404, 0.0000000,
  -0.0420569, 1.0420571, 0.0000000,
  -0.0196376, -0.0786361, 1.0982735,
];

/**
 * Linear Display-P3 -> linear sRGB.
 *
 * Values outside the sRGB cube come back outside it. Negative channels and
 * values above 1 are the whole POINT here, because they are what "this colour is
 * beyond sRGB" looks like numerically. Clamping belongs at the paint, not here.
 */
export const linearP3ToLinearSrgb = (
  r: number, g: number, b: number,
): [number, number, number] => apply3(P3_TO_SRGB, r, g, b);

export const gamutSourceId = (limit: GamutLimit): string =>
  typeof limit === 'string' ? limit : limit.id;

/**
 * Chroma the bisection in {@link maxChroma} starts above.
 *
 * 0.5 is past every RGB display gamut's ceiling at every hue, so for the three
 * built-ins the first probe is outside and the search is the one it always was.
 * An arbitrary source need not honour that, hence {@link GAMUT_PROBE_MAX}.
 */
export const GAMUT_PROBE_START = 0.5;

/**
 * Ceiling on the upward probe when a source still reproduces chroma 0.5.
 *
 * Rather than silently clamping such a source at 0.5 (which would draw a flat
 * false boundary and look like a real result), the search doubles its bracket
 * until the colour falls outside, up to here. 4 is roughly ten times the widest
 * chroma any real display or press reaches, so hitting it means the source
 * claims everything, and `maxChroma` then returns this bound as its honest
 * answer: "at least this much, and the source never said no".
 */
export const GAMUT_PROBE_MAX = 4;
