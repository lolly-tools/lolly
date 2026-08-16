// SPDX-License-Identifier: MPL-2.0
/**
 * color-curve.ts - a serializable tonal-curve model for brand colour ramps.
 *
 * A tonal ramp is modelled as three per-channel curves - L (lightness),
 * C (chroma), H (hue) - each a list of control points over a normalised
 * tone-step position `t` in [0, 1]. Sampling a curve to `n` steps yields `n`
 * OKLCH stops, which convert to hex through the engine's canonical
 * `oklchToHex` path.
 *
 * This is the editable, persist-or-bake superset behind the ramp UI:
 *   - `sampleCurve(curve, n)`  → n OKLCH stops
 *   - `bakeCurve(curve, n)`    → n hex strings (sampleCurve → oklchToHex)
 *   - `curveFromRamp(hexStops)`→ fit an editable curve back from a baked ramp
 *   - `serializeCurve` / `deserializeCurve` → JSON round-trip (identity)
 *
 * BYTE-IDENTITY CONTRACT: `defaultColorCurve(primary, n)` reproduces today's
 * primary ramp exactly. Today's ramp is built in brand-derive.ts from
 * `rampLightnesses` (the resampled RAMP_L curve, with the mid-step anchor
 * pull) and `chromaBell` (the chroma bell over L); the default curve bakes one
 * control point per tone step at those exact values, so sampling the same `n`
 * returns them verbatim and the emitted hex is unchanged for an untouched
 * brand. The two source functions are imported, not re-implemented, so the
 * curve defaults can never drift from the live ramp math.
 */

import {
  type Oklch,
  oklchToHex,
  hexToOklch,
  rampLightnesses,
  chromaBell,
} from './brand-derive.ts';

/** A single editable control point: value `v` at tone position `t` ∈ [0, 1]. */
export interface CurvePoint {
  t: number;
  v: number;
}

/** One per-channel curve: control points sorted ascending by `t`. */
export interface ChannelCurve {
  points: CurvePoint[];
}

/** The three-channel tonal curve. Hue is stored in absolute degrees. */
export interface ColorCurve {
  L: ChannelCurve;
  C: ChannelCurve;
  H: ChannelCurve;
}

/** Serializable form - version-tagged so a stored curve can migrate later. */
export interface ColorCurveJSON {
  version: 1;
  L: CurvePoint[];
  C: CurvePoint[];
  H: CurvePoint[];
}

// The tone position of step `i` of `n`, matching rampLightnesses' own formula
// (a single centre step at 0.5 for n === 1). Sampling at the same expression a
// default curve was baked at makes t === point.t hold bit-for-bit, so
// evalChannel returns the stored value without interpolation arithmetic.
const stepT = (i: number, n: number): number => (n <= 1 ? 0.5 : i / (n - 1));

// The chroma-bell peak: the primary's L clamped to the mid range, mirroring
// brand-derive.ts line 737 (`Math.min(0.75, Math.max(0.45, p.l))`). Kept as a
// local literal so the default curve peaks exactly where the live ramp does.
const bellPeak = (primaryL: number): number => Math.min(0.75, Math.max(0.45, primaryL));

const sortPoints = (points: CurvePoint[]): CurvePoint[] =>
  [...points].sort((a, b) => a.t - b.t);

const isSorted = (points: CurvePoint[]): boolean => {
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.t < points[i - 1]!.t) return false;
  }
  return true;
};

/** Return the channel's points in ascending-`t` order, copying only if needed.
 *  The interpolation math below relies on ascending order; a hand-edited curve
 *  whose control points were reordered in the UI must not silently corrupt the
 *  ramp, so every sample boundary normalises first. */
const orderedPoints = (curve: ChannelCurve): CurvePoint[] =>
  isSorted(curve.points) ? curve.points : sortPoints(curve.points);

/**
 * Evaluate a channel curve at position `t` via piecewise-linear interpolation.
 * When `t` lands exactly on a control point the stored value is returned
 * unchanged (no arithmetic), which is what preserves byte-identity when a
 * default curve is sampled at the same `n` it was baked for. Control points
 * need not be pre-sorted - they are ordered defensively here.
 */
export function evalChannel(curve: ChannelCurve, t: number): number {
  const pts = orderedPoints(curve);
  if (pts.length === 0) return 0;
  if (pts.length === 1) return pts[0]!.v;
  // Below the first / above the last control point → clamp to the endpoint.
  if (t <= pts[0]!.t) return pts[0]!.v;
  const last = pts[pts.length - 1]!;
  if (t >= last.t) return last.v;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (t === a.t) return a.v;
    if (t === b.t) return b.v;
    if (t > a.t && t < b.t) {
      const span = b.t - a.t;
      const f = span <= 0 ? 0 : (t - a.t) / span;
      return a.v + (b.v - a.v) * f;
    }
  }
  return last.v;
}

/** Sample a colour curve to `n` OKLCH stops (defaults to the L control count).
 *  Each channel is ordered once up front so re-ordered control points sample
 *  correctly without re-sorting on every step. */
export function sampleCurve(curve: ColorCurve, n = curve.L.points.length): Oklch[] {
  const count = Math.floor(n);
  if (count <= 0) return [];
  const L: ChannelCurve = { points: orderedPoints(curve.L) };
  const C: ChannelCurve = { points: orderedPoints(curve.C) };
  const H: ChannelCurve = { points: orderedPoints(curve.H) };
  const out: Oklch[] = [];
  for (let i = 0; i < count; i++) {
    const t = stepT(i, count);
    out.push({
      l: evalChannel(L, t),
      c: evalChannel(C, t),
      h: evalChannel(H, t),
    });
  }
  return out;
}

/** Bake a colour curve to `n` sRGB hex strings via the canonical OKLCH path. */
export function bakeCurve(curve: ColorCurve, n = curve.L.points.length): string[] {
  return sampleCurve(curve, n).map((stop) => oklchToHex(stop));
}

/**
 * Build the DEFAULT tonal curve for a brand primary - the one that reproduces
 * today's ramp byte-for-byte at the same `n`. `chromaScale` mirrors the
 * `mkRamp` chroma multiplier in brand-derive (1 = primary ramp).
 */
export function defaultColorCurve(primary: Oklch, n: number, chromaScale = 1): ColorCurve {
  const count = Math.max(1, Math.floor(n));
  const peak = bellPeak(primary.l);
  const Ls = rampLightnesses(primary.l, count);
  const L: CurvePoint[] = [];
  const C: CurvePoint[] = [];
  const H: CurvePoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = stepT(i, count);
    const l = Ls[i]!;
    L.push({ t, v: l });
    C.push({ t, v: primary.c * chromaScale * chromaBell(l, peak) });
    H.push({ t, v: primary.h });
  }
  return { L: { points: L }, C: { points: C }, H: { points: H } };
}

/**
 * Reverse an already-baked ramp (hex stops) into an editable curve - one
 * control point per stop, positioned evenly across [0, 1]. Unparseable stops
 * are skipped. Baking the result at the same length reproduces the input
 * (hexToOklch → oklchToHex is bit-perfect), so the round-trip is stable.
 */
export function curveFromRamp(hexStops: readonly string[]): ColorCurve {
  const parsed: Array<{ t: number; c: Oklch }> = [];
  const n = hexStops.length;
  for (let i = 0; i < n; i++) {
    const c = hexToOklch(hexStops[i]!);
    if (!c) continue;
    parsed.push({ t: stepT(i, n), c });
  }
  return {
    L: { points: parsed.map((p) => ({ t: p.t, v: p.c.l })) },
    C: { points: parsed.map((p) => ({ t: p.t, v: p.c.c })) },
    H: { points: parsed.map((p) => ({ t: p.t, v: p.c.h })) },
  };
}

/** Serialize a curve to a stable, version-tagged JSON string. */
export function serializeCurve(curve: ColorCurve): string {
  const json: ColorCurveJSON = {
    version: 1,
    L: curve.L.points.map((p) => ({ t: p.t, v: p.v })),
    C: curve.C.points.map((p) => ({ t: p.t, v: p.v })),
    H: curve.H.points.map((p) => ({ t: p.t, v: p.v })),
  };
  return JSON.stringify(json);
}

/** Parse a serialized curve back into a `ColorCurve` (control points re-sorted). */
export function deserializeCurve(input: string | ColorCurveJSON): ColorCurve {
  const json: ColorCurveJSON = typeof input === 'string' ? JSON.parse(input) : input;
  const chan = (arr: CurvePoint[] | undefined): ChannelCurve => ({
    points: sortPoints((arr ?? []).map((p) => ({ t: p.t, v: p.v }))),
  });
  return { L: chan(json.L), C: chan(json.C), H: chan(json.H) };
}
