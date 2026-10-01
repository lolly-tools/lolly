// SPDX-License-Identifier: MPL-2.0
/**
 * tone-curve.ts - a photo tone curve: control points on the 0..255 scale, the
 * text form an input stores them in, and the curve drawn through them.
 *
 * This is Photoshop's and Lightroom's point curve. Points map an input level to
 * an output level; the curve through them is a monotone cubic (Fritsch-Carlson),
 * which passes through every point and never overshoots between two of them, so
 * a curve that only rises never dips. Outside the first and last point the curve
 * is flat: dragging the black point to the right clips everything below it, as
 * it does in Photoshop.
 *
 * WIRE FORM. `in-out` pairs of integer levels joined by `_`, e.g.
 * `0-0_64-48_192-208_255-255` ("64 becomes 48"). Digits, `-` and `_` are the
 * characters a URL query keeps as they are (URLSearchParams escapes `~` and
 * `,`), so a share link carries a curve unescaped. The empty string is the
 * straight line (the identity). The reader is lenient about what a person or an
 * agent types - `0,0 64,48` and a JSON array of pairs both read - and
 * `formatToneCurve` always writes the canonical form back.
 *
 * ONE DEFINITION, TWO COPIES. The Darkroom tool evaluates the same curves in its
 * hooks, and tools cannot import the engine (that is what lets one tool run
 * unchanged in every shell). So `community/darkroom/hooks.js` keeps a copy of
 * `parseToneCurve` and the evaluator, and `tests/tone-curve-drift.test.ts` lifts
 * that copy out of the hook source and checks the two agree on a fixed corpus,
 * as `tests/grade-drift.test.ts` does for the LUT maths. Change one and that test
 * fails until the other matches. The web sidebar's curve control uses this
 * module directly.
 */

/** One control point: [input level, output level], both 0..255. */
export type ToneCurvePoint = [number, number];

/** The straight line: every level maps to itself. */
export const TONE_CURVE_IDENTITY: readonly ToneCurvePoint[] = Object.freeze([
  Object.freeze([0, 0]) as ToneCurvePoint,
  Object.freeze([255, 255]) as ToneCurvePoint,
]);

/** Photoshop's limit, and plenty for a tone curve. Extra points are ignored. */
export const TONE_CURVE_MAX_POINTS = 16;

const clampLevel = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/**
 * Sort, round, clamp and thin a list of points into a valid curve: integer
 * levels in 0..255, strictly increasing input levels (a later point with the
 * same input level as an earlier one is dropped), at most
 * {@link TONE_CURVE_MAX_POINTS}, and at least two points. Anything that leaves
 * fewer than two is the identity.
 */
export function normaliseToneCurve(points: ReadonlyArray<readonly [number, number]>): ToneCurvePoint[] {
  const valid: ToneCurvePoint[] = [];
  for (const p of points) {
    if (valid.length >= TONE_CURVE_MAX_POINTS) break;
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    valid.push([clampLevel(p[0]), clampLevel(p[1])]);
  }
  // Stable sort by input level, then keep the first point at each level.
  const sorted = valid.map((p, i) => ({ p, i })).sort((a, b) => a.p[0] - b.p[0] || a.i - b.i).map(e => e.p);
  const out: ToneCurvePoint[] = [];
  for (const p of sorted) if (!out.length || p[0] > out[out.length - 1]![0]) out.push(p);
  return out.length >= 2 ? out : TONE_CURVE_IDENTITY.map(p => [p[0], p[1]] as ToneCurvePoint);
}

/**
 * Read a stored or typed curve. Accepts the canonical `in-out_in-out` form, pairs
 * joined by a hyphen, comma or colon and listed with underscores, spaces, tildes
 * or semicolons, and a JSON array of `[in, out]` pairs. Unreadable pairs are
 * skipped; an empty or unreadable value is the identity.
 */
export function parseToneCurve(text: unknown): ToneCurvePoint[] {
  const s = typeof text === 'string' ? text.trim() : '';
  if (!s) return normaliseToneCurve([]);
  const pairs: Array<[number, number]> = [];
  if (s[0] === '[') {
    try {
      const arr: unknown = JSON.parse(s);
      if (Array.isArray(arr)) {
        for (const p of arr) {
          if (Array.isArray(p) && p.length >= 2) pairs.push([Number(p[0]), Number(p[1])]);
        }
      }
    } catch { /* unreadable JSON is the identity */ }
    return normaliseToneCurve(pairs);
  }
  for (const chunk of s.replace(/\s*([,:-])\s*/g, '$1').split(/[_~;\s]+/)) {
    const parts = chunk.split(/[,:-]/);
    if (parts.length !== 2 || parts[0] === '' || parts[1] === '') continue;
    pairs.push([Number(parts[0]), Number(parts[1])]);
  }
  return normaliseToneCurve(pairs);
}

/** True when the curve maps every level to itself. */
export function isIdentityToneCurve(points: ReadonlyArray<readonly [number, number]>): boolean {
  return points.every(p => p[0] === p[1]) && points.length >= 2
    && points[0]![0] === 0 && points[points.length - 1]![0] === 255;
}

/** The canonical wire form. The identity writes as the empty string. */
export function formatToneCurve(points: ReadonlyArray<readonly [number, number]>): string {
  const norm = normaliseToneCurve(points);
  if (isIdentityToneCurve(norm) && norm.length === 2) return '';
  return norm.map(p => `${p[0]}-${p[1]}`).join('_');
}

/**
 * The curve through the points as a function of an input level (0..255, any
 * real) returning an output level clamped to 0..255. Monotone cubic
 * (Fritsch-Carlson) inside the points, flat outside them.
 */
export function toneCurveEvaluator(points: ReadonlyArray<readonly [number, number]>): (x: number) => number {
  const pts = normaliseToneCurve(points);
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const np = xs.length;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < np - 1; i++) { dx.push(xs[i + 1]! - xs[i]!); m.push((ys[i + 1]! - ys[i]!) / dx[i]!); }
  const c1: number[] = [m[0]!];
  for (let i = 1; i < np - 1; i++) {
    if (m[i - 1]! * m[i]! <= 0) c1.push(0);
    else {
      const common = dx[i - 1]! + dx[i]!;
      c1.push(3 * common / ((common + dx[i]!) / m[i - 1]! + (common + dx[i - 1]!) / m[i]!));
    }
  }
  c1.push(m[np - 2]!);
  const x0 = xs[0]!, xn = xs[np - 1]!;
  return (x: number): number => {
    const xc = x < x0 ? x0 : x > xn ? xn : x;
    let lo = 0, hi = np - 2;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (xs[mid]! <= xc) lo = mid; else hi = mid - 1; }
    const h = dx[lo]!, t = (xc - xs[lo]!) / h;
    const t2 = t * t, t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * ys[lo]! + (t3 - 2 * t2 + t) * h * c1[lo]!
      + (-2 * t3 + 3 * t2) * ys[lo + 1]! + (t3 - t2) * h * c1[lo + 1]!;
    return y < 0 ? 0 : y > 255 ? 255 : y;
  };
}
