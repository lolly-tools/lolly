// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas-pencil.ts - freehand strokes to editable Bezier paths, the pure half of the
 * Pencil tool.
 *
 * A pointer trace is hundreds of jittery samples; a path someone can edit afterwards is a
 * handful of nodes with handles. Getting from one to the other takes four steps, each a
 * plain function here so each can be tested on its own:
 *
 *   1. `dedupeSamples` drops samples closer together than a fraction of a pixel, which a
 *      slow hand or a high-rate tablet produces in runs and which would otherwise give the
 *      fit zero-length chords to divide by.
 *   2. `simplifyRdp` (Ramer-Douglas-Peucker) reduces the trace to the few samples that hold
 *      its outline within a tolerance. It is used to FIND structure, not as the output: its
 *      polyline has corners everywhere.
 *   3. `cornerIndices` reads that polyline's turning angles. A turn sharper than the corner
 *      angle, between two legs long enough not to be jitter, is a corner the hand meant.
 *   4. `fitCubics` fits each run between corners with Schneider's algorithm ("An Algorithm
 *      for Automatically Fitting Digitized Curves", Graphics Gems, 1990): a least-squares
 *      cubic with fixed end tangents, refined by Newton-Raphson reparameterisation and
 *      split at the worst sample until every sample is within the error bound.
 *
 * The error bound is a promise about the result: every recorded sample lies within
 * `tolerance` of the curve at its fitted parameter, so within `tolerance` of the curve.
 * A two-sample run is a straight segment through both, which meets the bound trivially, so
 * the recursion always ends.
 */
import type { AuthoredPath, SplineNode } from '@lolly/engine';

export interface PencilPt { x: number; y: number }
/** One fitted cubic: start, first control, second control, end. */
export type PencilBezier = [PencilPt, PencilPt, PencilPt, PencilPt];

const sub = (a: PencilPt, b: PencilPt): PencilPt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: PencilPt, b: PencilPt): PencilPt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: PencilPt, k: number): PencilPt => ({ x: a.x * k, y: a.y * k });
const dot = (a: PencilPt, b: PencilPt): number => a.x * b.x + a.y * b.y;
const dist = (a: PencilPt, b: PencilPt): number => Math.hypot(a.x - b.x, a.y - b.y);
function unit(v: PencilPt): PencilPt | null {
  const l = Math.hypot(v.x, v.y);
  return l > 1e-12 ? { x: v.x / l, y: v.y / l } : null;
}

/** Drop samples within `minDist` of the last kept one, keeping the final sample so the
 *  stroke still ends where the hand lifted. Non-finite samples are dropped outright. */
export function dedupeSamples(pts: readonly PencilPt[], minDist: number): PencilPt[] {
  const out: PencilPt[] = [];
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (!out.length || dist(out[out.length - 1]!, p) >= minDist) out.push({ x: p.x, y: p.y });
  }
  const last = pts[pts.length - 1];
  if (out.length > 1 && last && Number.isFinite(last.x) && Number.isFinite(last.y)) {
    const tail = out[out.length - 1]!;
    if (tail.x !== last.x || tail.y !== last.y) out[out.length - 1] = { x: last.x, y: last.y };
  }
  return out;
}

/** Distance from `p` to the segment `a`-`b`. */
function segDist(p: PencilPt, a: PencilPt, b: PencilPt): number {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  if (len2 < 1e-24) return dist(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2));
  return dist(p, add(a, mul(ab, t)));
}

/**
 * Ramer-Douglas-Peucker: the INDICES of the samples to keep, first and last always among
 * them, such that every dropped sample is within `eps` of the kept polyline. Iterative,
 * with an explicit stack, so a very long stroke cannot exhaust the call stack.
 */
export function simplifyRdp(pts: readonly PencilPt[], eps: number): number[] {
  const n = pts.length;
  if (n <= 2) return pts.map((_, i) => i);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1, worstD = eps;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i]!, pts[a]!, pts[b]!);
      if (d > worstD) { worstD = d; worst = i; }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

/**
 * The sample indices where the stroke turns a corner, read off the simplified polyline
 * `keep` (indices into `pts`). A vertex is a corner when the direction turns by more than
 * `cornerDeg` there AND both legs are at least `minLeg` long: a sharp turn between two
 * short legs is the hand wobbling, not a corner it meant.
 */
export function cornerIndices(pts: readonly PencilPt[], keep: readonly number[], cornerDeg: number, minLeg: number): number[] {
  const out: number[] = [];
  const limit = (cornerDeg * Math.PI) / 180;
  for (let k = 1; k < keep.length - 1; k++) {
    const a = pts[keep[k - 1]!]!, b = pts[keep[k]!]!, c = pts[keep[k + 1]!]!;
    const u = sub(b, a), v = sub(c, b);
    const lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
    if (lu < minLeg || lv < minLeg) continue;
    const cos = Math.max(-1, Math.min(1, dot(u, v) / (lu * lv)));
    if (Math.acos(cos) > limit) out.push(keep[k]!);
  }
  return out;
}

// ── Schneider's fit ─────────────────────────────────────────────────────────────

function bezierAt(b: PencilBezier, t: number): PencilPt {
  const mt = 1 - t;
  const k0 = mt * mt * mt, k1 = 3 * mt * mt * t, k2 = 3 * mt * t * t, k3 = t * t * t;
  return {
    x: b[0].x * k0 + b[1].x * k1 + b[2].x * k2 + b[3].x * k3,
    y: b[0].y * k0 + b[1].y * k1 + b[2].y * k2 + b[3].y * k3,
  };
}
function bezierD1(b: PencilBezier, t: number): PencilPt {
  const mt = 1 - t;
  return add(add(mul(sub(b[1], b[0]), 3 * mt * mt), mul(sub(b[2], b[1]), 6 * mt * t)), mul(sub(b[3], b[2]), 3 * t * t));
}
function bezierD2(b: PencilBezier, t: number): PencilPt {
  return add(mul(add(sub(b[2], mul(b[1], 2)), b[0]), 6 * (1 - t)), mul(add(sub(b[3], mul(b[2], 2)), b[1]), 6 * t));
}

/** Chord-length parameters for samples `first..last`, 0 at the first and 1 at the last. */
function chordParams(pts: readonly PencilPt[], first: number, last: number): number[] {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1]! + dist(pts[i]!, pts[i - 1]!));
  const total = u[u.length - 1]!;
  return total > 0 ? u.map((v) => v / total) : u.map((_, i) => i / Math.max(1, u.length - 1));
}

/** The least-squares cubic through `first..last` at parameters `u`, with the end tangents
 *  fixed (`t1` leaving the start, `t2` pointing BACK into the curve from the end). */
function generateBezier(pts: readonly PencilPt[], first: number, last: number, u: readonly number[], t1: PencilPt, t2: PencilPt): PencilBezier {
  const p0 = pts[first]!, p3 = pts[last]!;
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < u.length; i++) {
    const t = u[i]!, mt = 1 - t;
    const b0 = mt * mt * mt, b1 = 3 * mt * mt * t, b2 = 3 * mt * t * t, b3 = t * t * t;
    const a1 = mul(t1, b1), a2 = mul(t2, b2);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    const tmp = sub(pts[first + i]!, add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    x0 += dot(a1, tmp);
    x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let alpha1 = Math.abs(det) > 1e-12 ? (x0 * c11 - x1 * c01) / det : 0;
  let alpha2 = Math.abs(det) > 1e-12 ? (c00 * x1 - c01 * x0) / det : 0;
  const seg = dist(p0, p3);
  // Schneider's fallback: a non-positive or vanishing arm means the least-squares answer
  // is degenerate, and the Wu/Barsky heuristic of a third of the chord is safer.
  if (alpha1 < seg * 1e-6 || alpha2 < seg * 1e-6) alpha1 = alpha2 = seg / 3;
  return [p0, add(p0, mul(t1, alpha1)), add(p3, mul(t2, alpha2)), p3];
}

/** The worst squared distance between a sample and the curve at its parameter, and the
 *  sample where it happens (always strictly inside the run, so a split makes progress). */
function maxError(pts: readonly PencilPt[], first: number, last: number, b: PencilBezier, u: readonly number[]): { err: number; split: number } {
  let err = 0, split = Math.floor((first + last) / 2);
  for (let i = first + 1; i < last; i++) {
    const p = bezierAt(b, u[i - first]!);
    const d = (p.x - pts[i]!.x) ** 2 + (p.y - pts[i]!.y) ** 2;
    if (d >= err) { err = d; split = i; }
  }
  return { err, split };
}

/** One Newton-Raphson step per sample towards the parameter of its nearest curve point. */
function reparameterize(pts: readonly PencilPt[], first: number, b: PencilBezier, u: readonly number[]): number[] {
  return u.map((t, i) => {
    const p = pts[first + i]!;
    const d = sub(bezierAt(b, t), p);
    const d1 = bezierD1(b, t), d2 = bezierD2(b, t);
    const den = dot(d1, d1) + dot(d, d2);
    if (Math.abs(den) < 1e-12) return t;
    const next = t - dot(d, d1) / den;
    return Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : t;
  });
}

/** The sample about `len` of arc length away from `i` (forward for `dir` 1, back for -1),
 *  without leaving `lo..hi`. */
function reachIndex(pts: readonly PencilPt[], i: number, dir: 1 | -1, len: number, lo: number, hi: number): number {
  let j = i, acc = 0;
  while (acc < len && j + dir >= lo && j + dir <= hi) {
    acc += dist(pts[j]!, pts[j + dir]!);
    j += dir;
  }
  return j;
}

/** A tangent at sample `i` read over `len` of arc length rather than over one gap: two
 *  samples a pixel or two apart carry the hand's tremor at full strength, and the direction
 *  a whole curve leaves in should not be set by one wobble. `dir` 1 looks forward, -1 back. */
function tangentAt(pts: readonly PencilPt[], i: number, dir: 1 | -1, len: number, lo: number, hi: number): PencilPt {
  const j = reachIndex(pts, i, dir, len, lo, hi);
  return unit(sub(pts[j]!, pts[i]!)) ?? unit(sub(pts[Math.max(lo, Math.min(hi, i + dir))]!, pts[i]!)) ?? { x: dir, y: 0 };
}

/** Every split shortens the run, so the recursion ends on its own; this only bounds the
 *  stack, and `freehandPath` keeps a stroke under it by thinning very long traces. */
const MAX_DEPTH = 4096;
/** The most samples one stroke is fitted from. A longer trace is thinned evenly first. */
export const MAX_SAMPLES = 4000;

function fitRun(pts: readonly PencilPt[], first: number, last: number, t1: PencilPt, t2: PencilPt, errSq: number, reach: number, out: PencilBezier[], depth: number): void {
  const p0 = pts[first]!, p3 = pts[last]!;
  if (last - first === 1 || depth > MAX_DEPTH) {
    const third = dist(p0, p3) / 3;
    out.push([p0, add(p0, mul(t1, third)), add(p3, mul(t2, third)), p3]);
    return;
  }
  let u = chordParams(pts, first, last);
  let bez = generateBezier(pts, first, last, u, t1, t2);
  let { err, split } = maxError(pts, first, last, bez, u);
  if (err <= errSq) { out.push(bez); return; }
  // Close but not there: reparameterising usually finishes the job without a split.
  if (err <= errSq * 4) {
    for (let k = 0; k < 4; k++) {
      u = reparameterize(pts, first, bez, u);
      bez = generateBezier(pts, first, last, u, t1, t2);
      ({ err, split } = maxError(pts, first, last, bez, u));
      if (err <= errSq) { out.push(bez); return; }
    }
  }
  // Split at the worst sample with ONE shared tangent, so the two halves meet smoothly.
  const back = reachIndex(pts, split, -1, reach, first, last), ahead = reachIndex(pts, split, 1, reach, first, last);
  const centre = unit(sub(pts[back]!, pts[ahead]!)) ?? unit(sub(pts[split - 1]!, pts[split]!)) ?? mul(t1, -1);
  fitRun(pts, first, split, t1, centre, errSq, reach, out, depth + 1);
  fitRun(pts, split, last, mul(centre, -1), t2, errSq, reach, out, depth + 1);
}

/**
 * Fit samples `first..last` with as few cubics as keep every sample within `tolerance`.
 * The run's own end tangents are estimated from the samples near each end.
 */
export function fitCubics(pts: readonly PencilPt[], tolerance: number, first = 0, last = pts.length - 1): PencilBezier[] {
  if (last <= first) return [];
  const out: PencilBezier[] = [];
  const tol = Math.max(1e-6, tolerance);
  let runLen = 0;
  for (let i = first + 1; i <= last; i++) runLen += dist(pts[i]!, pts[i - 1]!);
  // Read tangents over a few tolerances of arc, never more than a third of the run, so a
  // short run between two corners still leaves each corner in its own direction.
  const reach = Math.min(tol * 3, runLen / 3);
  const t1 = tangentAt(pts, first, 1, reach, first, last);
  const t2 = tangentAt(pts, last, -1, reach, first, last);
  fitRun(pts, first, last, t1, t2, tol ** 2, reach, out, 0);
  return out;
}

export interface FreehandOptions {
  /** The fit's error bound in the samples' own units (native px for the pencil). */
  tolerance: number;
  /** A turn sharper than this, in degrees, is a corner. */
  cornerDeg?: number;
  /** End within this distance of the start and the stroke closes. 0 never closes. */
  closeDist?: number;
}

/**
 * A freehand trace → an editable `cubic` path, or null when the trace is too small to be
 * a shape (a click, or a dab shorter than twice the tolerance).
 *
 * Nodes sit at the fitted curves' joins. A join inside a run is `smooth`, which is true of
 * the geometry since both halves share the split tangent; a corner the hand made, and the
 * two open ends, are `corner`. A stroke that comes back to its start closes, with the start
 * as one more corner, because a loop drawn by hand rarely meets itself tangent-on.
 */
export function freehandPath(samples: readonly PencilPt[], o: FreehandOptions): AuthoredPath | null {
  const tol = Math.max(1e-3, o.tolerance);
  let pts = dedupeSamples(samples, tol / 4);
  if (pts.length > MAX_SAMPLES) {
    const step = pts.length / MAX_SAMPLES;
    const thin: PencilPt[] = [];
    for (let i = 0; i < MAX_SAMPLES - 1; i++) thin.push(pts[Math.floor(i * step)]!);
    thin.push(pts[pts.length - 1]!);
    pts = thin;
  }
  if (pts.length < 2) return null;
  let extent = 0;
  for (const p of pts) extent = Math.max(extent, dist(p, pts[0]!));
  if (extent < tol * 2) return null;
  const closeDist = o.closeDist ?? 0;
  const closed = closeDist > 0 && pts.length > 3 && extent > closeDist * 2 && dist(pts[0]!, pts[pts.length - 1]!) <= closeDist;
  if (closed) pts = [...pts.slice(0, -1), { ...pts[0]! }];
  const keep = simplifyRdp(pts, tol);
  const corners = cornerIndices(pts, keep, o.cornerDeg ?? 70, tol * 2);
  const bounds = [0, ...corners, pts.length - 1];
  const curves: Array<{ bez: PencilBezier; cornerAfter: boolean }> = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    const run = fitCubics(pts, tol, bounds[k]!, bounds[k + 1]!);
    run.forEach((bez, j) => { curves.push({ bez, cornerAfter: j === run.length - 1 }); });
  }
  if (!curves.length) return null;
  const nodes: SplineNode[] = [];
  const first = curves[0]!.bez;
  nodes.push({ x: first[0].x, y: first[0].y, hOutX: first[1].x - first[0].x, hOutY: first[1].y - first[0].y, continuity: 'corner' });
  curves.forEach(({ bez, cornerAfter }, j) => {
    const next = curves[j + 1]?.bez;
    const node: SplineNode = { x: bez[3].x, y: bez[3].y, hInX: bez[2].x - bez[3].x, hInY: bez[2].y - bez[3].y, continuity: next && !cornerAfter ? 'smooth' : 'corner' };
    if (next) { node.hOutX = next[1].x - next[0].x; node.hOutY = next[1].y - next[0].y; }
    nodes.push(node);
  });
  if (closed && nodes.length > 2) {
    // The last node IS the first, back where the loop began: fold its incoming arm onto
    // node 0 and let the closing segment do the joining.
    const end = nodes.pop()!;
    nodes[0] = { ...nodes[0]!, hInX: end.hInX, hInY: end.hInY };
    return { kind: 'cubic', closed: true, nodes };
  }
  return { kind: 'cubic', closed: false, nodes };
}
