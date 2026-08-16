// SPDX-License-Identifier: MPL-2.0
/**
 * The seam between an AUTHORED path and the cubics that geometry runs on.
 *
 * ## The one architectural decision that avoids boxing this in
 *
 * Boolean operations, offsetting, and intersection all work on cubic Béziers, and they
 * should: no serious implementation does booleans on Spiro or Catmull-Rom curves
 * directly, and every spline type has a well-defined lowering to cubics anyway. The
 * mistake would be letting that make the cubic the *authoring* model too.
 *
 * If a pen tool stores only cubics, a Spiro path cannot round-trip. Spiro is defined by
 * knots plus a curvature-continuity solve, and once it is lowered you can recover the
 * shape but not the knots, so the next edit re-solves from the wrong starting point.
 * The same applies to a node the user declared "smooth": two adjacent cubics that
 * merely happen to be tangent-continuous look identical to a node whose handles are
 * *constrained* to stay collinear, but only the constrained one drags correctly.
 *
 * So: an `AuthoredPath` keeps whatever the user is editing, and `toCubics` lowers it
 * for geometry. Conversion runs one direction only. This is not a limitation, it is
 * what every design tool does, and it is why a boolean's OUTPUT is always plain
 * Béziers in Illustrator and Figma too: an intersection of two Spiro curves is not a
 * Spiro curve.
 *
 * ## What this file does and does not contain
 *
 * It contains the seam, the node model a pen tool needs, the lowerings that are a few
 * lines of arithmetic (`cubic`, `line`, `catmull-rom`, `bspline`), and, since the pen
 * tool wanted a default that drags well, the `hyperbezier` global solve. It does NOT
 * contain a Spiro solver. That kind stays declared and throws, because Spiro is the
 * curve hyperbezier was designed to replace: its constraint system has no unique
 * solution, so dragging a knot can flip a loop's direction or fail to converge, and
 * "the shape jumped" is not a defect a user can work around.
 *
 * Both curve families were built from Raph Levien's own work rather than from a
 * second-hand reimplementation:
 * - https://github.com/raphlinus/spiro: the original curvature-continuity solver, the
 *     one Inkscape and FontForge ship.
 * - https://github.com/raphlinus/spline-research: the later two-parameter curve
 *     (MIT/Apache-2.0), designed specifically to fix how Spiro behaves when a knot is
 *     DRAGGED, which is the case this seam exists to serve.
 * The math is ported, not depended on: engine/ takes handlebars, ajv, and the
 * tool-author SDK, and nothing else.
 */
import { type Cubic, lineToCubic } from './bezier.ts';
import { spiroCubics } from './spiro.ts';

/**
 * How a node's handles behave when one is dragged. This is authoring intent, and it
 * cannot be inferred from the geometry afterwards - which is the whole reason the
 * authored form has to be kept.
 */
export type Continuity =
  /** Handles independent; a hard corner. */
  | 'corner'
  /** Handles held collinear, lengths independent. */
  | 'smooth'
  /** Handles held collinear AND equal length. */
  | 'symmetric';

/** One authored on-curve point. Handles are OFFSETS from the point, not absolute -
 *  so moving a node moves its handles without touching them. */
export interface Node {
  x: number;
  y: number;
  /** Incoming handle offset (towards the previous node). */
  hInX?: number;
  hInY?: number;
  /** Outgoing handle offset (towards the next node). */
  hOutX?: number;
  hOutY?: number;
  continuity?: Continuity;
}

export type SplineKind =
  /** Nodes with explicit handles - the ordinary pen-tool path. */
  | 'cubic'
  /** Nodes only; straight segments between them. */
  | 'line'
  /** Interpolating spline through every node; handles derived from neighbours. */
  | 'catmull-rom'
  /** Uniform cubic B-spline; nodes are control points, the curve does NOT pass
   *  through them. */
  | 'bspline'
  /** Levien's two-parameter spline, a.k.a. the hyperbezier: nodes only, tangents
   *  solved globally for curvature continuity. The pen-tool default; see
   *  `solveHyperbezier`. */
  | 'hyperbezier'
  /** Levien's Spiro: the Euler-spiral interpolating spline Inkscape and FontForge
   *  ship. Knot-only, G2 curvature-continuous, `'corner'` knots break the run. See
   *  `spiroCubics` in geom/spiro.ts (a separate curve from hyperbezier by design). */
  | 'spiro';

export interface AuthoredPath {
  kind: SplineKind;
  nodes: Node[];
  closed: boolean;
  /** Catmull-Rom only: 0 = uniform, 0.5 = centripetal, 1 = chordal. Centripetal is
   *  the default because uniform Catmull-Rom self-intersects on uneven spacing, which
   *  is a cusp in the user's face rather than a subtle artefact. */
  tension?: number;
}

/**
 * Lower an authored path to cubics - the only form the geometry kernel accepts.
 *
 * `warm` is only read by `hyperbezier`, whose lowering runs a solve: pass the previous
 * frame's solution during a drag and the solve starts from it. Callers that want the
 * solution back (to warm the next frame) should call `solveHyperbezier` and
 * `hyperbezierCubics` directly; this entry point discards it.
 */
export function toCubics(path: AuthoredPath, warm?: HyperbezierSolution): Cubic[] {
  const n = path.nodes;
  if (n.length < 2) return [];
  switch (path.kind) {
    case 'line': return lineSegments(n, path.closed);
    case 'cubic': return cubicSegments(n, path.closed);
    case 'catmull-rom': return catmullRom(n, path.closed, path.tension ?? 0.5);
    case 'bspline': return bspline(n, path.closed);
    case 'hyperbezier':
      return hyperbezierCubics(n, path.closed, solveHyperbezier(n, path.closed, warm));
    case 'spiro':
      return spiroCubics(n, path.closed);
    default:
      throw new Error(`unknown spline kind: ${String(path.kind)}`);
  }
}

/** Pairs of consecutive nodes, wrapping when closed. */
function pairs<T>(items: T[], closed: boolean): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i + 1 < items.length; i++) out.push([items[i]!, items[i + 1]!]);
  if (closed && items.length > 2) out.push([items[items.length - 1]!, items[0]!]);
  return out;
}

function lineSegments(n: Node[], closed: boolean): Cubic[] {
  return pairs(n, closed).map(([a, b]) => lineToCubic(a.x, a.y, b.x, b.y));
}

function cubicSegments(n: Node[], closed: boolean): Cubic[] {
  return pairs(n, closed).map(([a, b]) => {
    // A missing handle means "no handle", i.e. the control sits on the node - which
    // makes the segment straight, exactly as a pen tool with un-dragged handles draws.
    const c1x = a.x + (a.hOutX ?? 0), c1y = a.y + (a.hOutY ?? 0);
    const c2x = b.x + (b.hInX ?? 0), c2y = b.y + (b.hInY ?? 0);
    return [a.x, a.y, c1x, c1y, c2x, c2y, b.x, b.y] as Cubic;
  });
}

/**
 * Catmull-Rom → cubic, exactly (the conversion is closed form, not a fit).
 *
 * `alpha` parameterises the knot spacing: 0 uniform, 0.5 centripetal, 1 chordal.
 * Centripetal is the default because uniform Catmull-Rom is guaranteed to produce
 * cusps and self-intersections when the points are unevenly spaced - a well-known
 * result, and a very visible one when the points come from a freehand drag.
 */
function catmullRom(n: Node[], closed: boolean, alpha: number): Cubic[] {
  const at = (i: number): Node => {
    if (closed) return n[((i % n.length) + n.length) % n.length]!;
    return n[Math.min(n.length - 1, Math.max(0, i))]!;
  };
  const out: Cubic[] = [];
  const last = closed ? n.length : n.length - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const d = (a: Node, b: Node) => Math.max(1e-9, Math.hypot(b.x - a.x, b.y - a.y) ** alpha);
    const d1 = d(p0, p1), d2 = d(p1, p2), d3 = d(p2, p3);
    // Barry-Goldman formulation, rearranged to Bézier controls.
    const b1x = (d1 * d1 * p2.x - d2 * d2 * p0.x + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1.x) / (3 * d1 * (d1 + d2));
    const b1y = (d1 * d1 * p2.y - d2 * d2 * p0.y + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1.y) / (3 * d1 * (d1 + d2));
    const b2x = (d3 * d3 * p1.x - d2 * d2 * p3.x + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2.x) / (3 * d3 * (d3 + d2));
    const b2y = (d3 * d3 * p1.y - d2 * d2 * p3.y + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2.y) / (3 * d3 * (d3 + d2));
    out.push([p1.x, p1.y, b1x, b1y, b2x, b2y, p2.x, p2.y]);
  }
  return out;
}

/** Uniform cubic B-spline → cubic Béziers, exactly (a basis change, not a fit).
 *  Note the curve does NOT pass through its control points. */
function bspline(n: Node[], closed: boolean): Cubic[] {
  const at = (i: number): Node => {
    if (closed) return n[((i % n.length) + n.length) % n.length]!;
    return n[Math.min(n.length - 1, Math.max(0, i))]!;
  };
  const out: Cubic[] = [];
  const last = closed ? n.length : n.length - 3;
  for (let i = 0; i < last; i++) {
    const p0 = at(i), p1 = at(i + 1), p2 = at(i + 2), p3 = at(i + 3);
    const s = 1 / 6;
    out.push([
      s * (p0.x + 4 * p1.x + p2.x), s * (p0.y + 4 * p1.y + p2.y),
      s * (4 * p1.x + 2 * p2.x), s * (4 * p1.y + 2 * p2.y),
      s * (2 * p1.x + 4 * p2.x), s * (2 * p1.y + 4 * p2.y),
      s * (p1.x + 4 * p2.x + p3.x), s * (p1.y + 4 * p2.y + p3.y),
    ]);
  }
  return out;
}

// ── hyperbezier ───────────────────────────────────────────────────────────────
//
// Levien's two-parameter spline, ported from the mathematics in
// https://github.com/raphlinus/spline-research (Raph Levien, MIT/Apache-2.0) and the
// account at https://raphlinus.github.io/curves/2018/12/21/new-spline.html. Nothing
// below is copied from that prototype; the formulae that define the curve family and
// the continuity residual are reproduced because they ARE the method, and the solver
// is a different one (see `hbSolveRun`).
//
// ## Why this is the pen-tool default and Spiro is not
//
// A segment is one cubic in the frame of its own chord, and its only two degrees of
// freedom are the tangent ANGLES at its ends. The arm lengths are a function of those
// angles, not free parameters. So the whole path is described by one angle per node,
// and the solve adjusts those angles to make curvature agree across every join. Three
// consequences, all of which are why this curve is used and not Spiro:
//
//   - The lowering is TOTAL. Any angles at all render a real cubic, and the arm-length
//     formula is bounded by a third of a chord (two thirds once the curvature blend's
//     clamp is allowed for), so the output is always inside a known box around the
//     polygon. A half-converged solve gives a slightly-wrong-curvature spline, never a
//     wildly wrong shape.
//   - The residual is an angle DIFFERENCE of arctan-curvatures rather than a curvature
//     difference. It is bounded and monotone, and it stays meaningful through a
//     reversal, which is exactly where Spiro's constraint system loses uniqueness and
//     flips.
//   - Every node's angle couples only to its two neighbours, so the Jacobian is
//     tridiagonal (cyclic when closed) and a Newton step costs O(n). A drag reuses the
//     previous solution and converges in one or two steps.
//
// ## What is actually guaranteed
//
// Interpolation is exact: the endpoints are the nodes, copied. G1 is exact at every
// smooth join, with one stated exception: a segment whose deflection exceeds a right
// angle has a reversed control arm and meets its neighbour at a cusp. `reversals`
// counts those, and it is zero for any input a pen tool produces (see `hbArm`). G2 is
// what the solve CONVERGES to: the residual is driven under `HB_TOL`, and `converged`
// reports whether it got there. Corners are G0 on purpose. A node with an authored
// handle pins its tangent, which breaks curvature continuity there by construction; the
// blend below corrects for that approximately, and is documented as approximate.

/** Reduce an angle to (−π, π]. Every tangent angle here is absolute (world) and every
 *  th0/th1 is relative to a chord, so the two only ever meet through this. */
function mod2pi(th: number): number {
  const f = th * (0.5 / Math.PI);
  return 2 * Math.PI * (f - Math.round(f));
}

/**
 * The curve family's arm length, for the end whose deflection is `tha` when the far
 * end's is `thb`.
 *
 * Levien's shape function. The `offset` term is the cross-coupling that makes the pair
 * of arms respond to the whole segment's bend rather than each to its own end, and the
 * third-harmonic term is what makes the family approximate an Euler spiral (linear
 * curvature) rather than a circular arc:
 *
 *   arm = (cos a − 0.2·cos 3a) / 2.4,  a = tha − 0.3·sin(2·thb − 0.4·sin(2·thb))
 *
 * Expanding cos 3a = 4cos³a − 3cos a collapses that to `c(2 − c²)/3` for c = cos a,
 * which is worth doing because it makes three properties provable rather than empirical:
 * the arm is exactly 1/3 at zero deflection, so a straight run of nodes lowers to
 * exactly the chord with controls at the thirds; |arm| ≤ 1/3, so no set of angles can
 * throw a control point further than a third of a chord off the polygon; and the arm is
 * negative exactly when cos a < 0, i.e. only past a right angle of deflection.
 *
 * ## Past a right angle the arm reverses, and that is left alone on purpose
 *
 * A negative arm puts the control point on the far side of the node from the tangent
 * angle the solve named, so the segment's real tangent there is that angle plus π, and
 * the join with its neighbour is a cusp rather than G1. This looks like a defect, and
 * the obvious fix (take the magnitude, keeping the direction the solve asked for) was
 * tried and is worse. It costs convergence: no C¹ function can agree with `c(2 − c²)/3`
 * for c ≥ 0 and stay non-negative for c < 0 (the slope at c = 0 is 2/3, not 0), so
 * clamping introduces a kink, and the kink gives the solver's merit function real local
 * minima. Sharp input that solves to 1e-15 with the signed arm stalls at a residual of
 * 0.65 rad with the clamped version: a curve visibly wrong everywhere instead of one
 * cusp where the data has a hairpin.
 *
 * The signed form also stays consistent rather than being merely tolerable: `ak0`/`ak1`
 * record the reversal in their quadrant, so the continuity solve knows about it and
 * still matches curvature across the join. The cost is that a tangent PINNED by an
 * authored handle at more than a right angle from its chord renders reversed. The
 * family has no way to represent that shape, so the report is a plain count:
 * `HyperbezierSolution.reversals`.
 */
function hbArm(tha: number, thb: number): number {
  const w = 2 * thb;
  const c = Math.cos(tha - 0.3 * Math.sin(w - 0.4 * Math.sin(w)));
  return (c * (2 - c * c)) / 3;
}

/** A segment of the family in its unit chord frame: P0 = (0,0), P3 = (1,0). */
interface HbCurve {
  /** Control arm lengths, in chords. */
  a0: number;
  a1: number;
  /**
   * ARCTAN of the curvature at each end, in the end's own tangent frame.
   *
   * The arctan is the point. Raw curvature runs to infinity at a cusp and its
   * difference across a join is unbounded, so a solver on it is unbounded too; the
   * angle is bounded, and a magnitude past π/2 is a legible signal that the tangent
   * has reversed relative to the chord rather than a numerical accident.
   */
  ak0: number;
  ak1: number;
  /** Plain unit-frame curvature at each end, for the blend. Zero where the arm
   *  vanishes and there is no tangent to measure against. */
  k0u: number;
  k1u: number;
}

function hbCurve(th0: number, th1: number): HbCurve {
  const a0 = hbArm(th0, th1), a1 = hbArm(th1, th0);
  const c0 = Math.cos(th0), s0 = Math.sin(th0);
  const c1 = Math.cos(th1), s1 = Math.sin(th1);
  const p1x = a0 * c0, p1y = a0 * s0;
  const p2x = 1 - a1 * c1, p2y = a1 * s1;
  // C''(0)/6 = P2 − 2P1 + P0 and C''(1)/6 = P3 − 2P2 + P1.
  const q0x = p2x - 2 * p1x, q0y = p2y - 2 * p1y;
  const q1x = 1 - 2 * p2x + p1x, q1y = p1y - 2 * p2y;
  // C'(0) = 3·a0·(cos th0, sin th0), so its component along the tangent is exactly
  // 3·a0 - the general dot product would only reintroduce rounding.
  const dot0 = 3 * a0, dot1 = 3 * a1;
  // Cross of the second derivative with the tangent direction. At the far end the
  // frame is (cos th1, −sin th1), which is where the sign flip comes from.
  const cross0 = 6 * (q0y * c0 - q0x * s0);
  const cross1 = 6 * (q1y * c1 + q1x * s1);
  return {
    a0, a1,
    ak0: Math.atan2(cross0, dot0 * Math.abs(dot0)),
    ak1: Math.atan2(cross1, dot1 * Math.abs(dot1)),
    k0u: Math.abs(dot0) > 1e-9 ? cross0 / (dot0 * dot0) : 0,
    k1u: Math.abs(dot1) > 1e-9 ? cross1 / (dot1 * dot1) : 0,
  };
}

/**
 * The free-end condition: the deflection an unconstrained end takes, given the
 * deflection at the other end of its segment.
 *
 * Levien's `0.5·sin(2θ)`, which agrees with the parabola-through-three-points condition
 * `atan(2 tan θ) − θ` to third order while staying bounded and smooth everywhere. It is
 * what makes an open end behave like a natural spline instead of flattening or curling.
 */
function hbEndTangent(th: number): number {
  return 0.5 * Math.sin(2 * th);
}

/** ∂/∂θ of the above. */
function hbEndTangentD(th: number): number {
  return Math.cos(2 * th);
}

/** One segment's solved state, plus the four curvature partials the Jacobian needs. */
interface HbSegState {
  th0: number;
  th1: number;
  chord: number;
  ak0: number;
  ak1: number;
  k0u: number;
  k1u: number;
  /** Control arm lengths, negative where the tangent has reversed. */
  a0: number;
  a1: number;
  /** ∂ak0/∂th0, ∂ak1/∂th0, ∂ak0/∂th1, ∂ak1/∂th1. */
  d00: number;
  d10: number;
  d01: number;
  d11: number;
}

/** Below this a chord is treated as degenerate: its direction is unknowable, so the
 *  segment lowers to a point and its residual rows go slack rather than dividing by it. */
const HB_MIN_CHORD = 1e-12;

/**
 * State of the segment between two points, given the absolute tangent angles at each.
 *
 * The curvature partials are central differences. `hbArm` is analytic, but its
 * derivative is a long chain of nested trig that would need re-deriving every time the
 * shape function is tuned, and a 1e-6 central difference of a smooth analytic function
 * is good to ~1e-10, far better than a Jacobian needs: a wrong Jacobian only slows
 * Newton down, it cannot change where Newton converges TO.
 *
 * (Upstream's unfinished `computeCurvatureDerivs` scales its central difference by
 * 2/ε where the rule wants 1/2ε: a factor-of-four error. It is dead code there because
 * the Newton step it was written for was never filled in.)
 */
function hbSegState(ax: number, ay: number, bx: number, by: number, thA: number, thB: number): HbSegState {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  const chth = len > HB_MIN_CHORD ? Math.atan2(dy, dx) : 0;
  const th0 = mod2pi(thA - chth), th1 = mod2pi(chth - thB);
  const base = hbCurve(th0, th1);
  const e = 1e-6, s = 0.5 / e;
  const p0 = hbCurve(th0 + e, th1), m0 = hbCurve(th0 - e, th1);
  const p1 = hbCurve(th0, th1 + e), m1 = hbCurve(th0, th1 - e);
  return {
    th0, th1,
    chord: Math.max(len, HB_MIN_CHORD),
    ak0: base.ak0, ak1: base.ak1, k0u: base.k0u, k1u: base.k1u,
    a0: base.a0, a1: base.a1,
    d00: s * (p0.ak0 - m0.ak0), d10: s * (p0.ak1 - m0.ak1),
    d01: s * (p1.ak0 - m1.ak0), d11: s * (p1.ak1 - m1.ak1),
  };
}

/**
 * The curvature-continuity residual at the join between two segments, and its
 * derivative with respect to each side's arctan-curvature.
 *
 * Real curvature at the join is `tan(ak)/chord` on each side, so continuity is
 * `tan(A)·chord₁ = tan(B)·chord₀`. Solving that form directly is a mistake: `tan`
 * blows up as either side approaches a cusp, and the residual's scale then depends on
 * the curvature rather than on how far from continuous the join is. Re-expressing the
 * SAME root as a difference of two arctans weighted by √chord keeps the residual an
 * angle - bounded by π, monotone in each argument, and finite through a reversal:
 *
 *   r = atan2(sin A·√c₁, cos A·√c₀) − atan2(sin B·√c₀, cos B·√c₁)
 *
 * which is zero exactly when tan A/c₀ = tan B/c₁. The derivatives are closed form:
 * d/dA atan2(q sin A, p cos A) = pq / (q² sin²A + p² cos²A).
 */
function hbJoin(prev: HbSegState, next: HbSegState): { r: number; dA: number; dB: number } {
  const p = Math.sqrt(prev.chord), q = Math.sqrt(next.chord);
  const A = prev.ak1, B = next.ak0;
  const sA = Math.sin(A), cA = Math.cos(A), sB = Math.sin(B), cB = Math.cos(B);
  const r = Math.atan2(sA * q, cA * p) - Math.atan2(sB * p, cB * q);
  const denA = q * q * sA * sA + p * p * cA * cA;
  const denB = p * p * sB * sB + q * q * cB * cB;
  const pq = p * q;
  return {
    r: mod2pi(r),
    dA: denA > 0 ? pq / denA : 0,
    dB: denB > 0 ? -pq / denB : 0,
  };
}

interface HbSystem {
  /** Residual per unknown. */
  r: number[];
  /** Sub-, main and super-diagonal of the Jacobian. Row 0's `a` and row n−1's `c` are
   *  the cyclic corners, used only when the run wraps. */
  a: number[];
  b: number[];
  c: number[];
  segs: HbSegState[];
}

interface HbRunPoint { x: number; y: number }

/**
 * Residual and tridiagonal Jacobian of one run.
 *
 * `wrap` makes the run cyclic: every node then has a segment on both sides, so every
 * row is a continuity condition and the system is cyclic tridiagonal. An open run uses
 * its first and last rows for end conditions instead: either "this tangent is pinned"
 * (an authored handle) or the free-end condition. Folding those into the same linear
 * system, rather than assigning them outside the solve as the prototype does, is what
 * lets the whole thing converge at Newton's rate instead of crawling.
 */
function hbSystem(
  pts: HbRunPoint[],
  wrap: boolean,
  startTh: number | null,
  endTh: number | null,
  ths: number[],
): HbSystem {
  const m = pts.length;
  const nSeg = wrap ? m : m - 1;
  const segs: HbSegState[] = [];
  for (let i = 0; i < nSeg; i++) {
    const p = pts[i]!, q = pts[(i + 1) % m]!;
    segs.push(hbSegState(p.x, p.y, q.x, q.y, ths[i]!, ths[(i + 1) % m]!));
  }
  const r = new Array<number>(m).fill(0);
  const a = new Array<number>(m).fill(0);
  const b = new Array<number>(m).fill(1);
  const c = new Array<number>(m).fill(0);

  const join = (k: number, prevIx: number, nextIx: number): void => {
    const prev = segs[prevIx]!, next = segs[nextIx]!;
    const j = hbJoin(prev, next);
    r[k] = j.r;
    // th1 of the previous segment and th0 of the next both move with ths[k], with
    // opposite signs: th1 = chord − ths[k] while th0 = ths[k] − chord.
    a[k] = j.dA * prev.d10;
    b[k] = j.dA * -prev.d11 + j.dB * next.d00;
    c[k] = j.dB * -next.d01;
  };

  if (wrap) {
    for (let k = 0; k < m; k++) join(k, (k - 1 + m) % m, k);
    return { r, a, b, c, segs };
  }

  for (let k = 1; k < m - 1; k++) join(k, k - 1, k);

  const first = segs[0]!;
  if (startTh !== null) {
    r[0] = mod2pi(ths[0]! - startTh);
    b[0] = 1;
  } else {
    r[0] = mod2pi(first.th0 - hbEndTangent(first.th1));
    b[0] = 1;
    c[0] = hbEndTangentD(first.th1);
  }
  const last = segs[nSeg - 1]!;
  if (endTh !== null) {
    r[m - 1] = mod2pi(ths[m - 1]! - endTh);
    b[m - 1] = 1;
  } else {
    r[m - 1] = mod2pi(last.th1 - hbEndTangent(last.th0));
    b[m - 1] = -1;
    a[m - 1] = -hbEndTangentD(last.th0);
  }
  return { r, a, b, c, segs };
}

/**
 * Thomas algorithm for a[i]·x[i−1] + b[i]·x[i] + c[i]·x[i+1] = d[i].
 *
 * No pivoting, so a vanishing pivot is REPORTED as null rather than producing the
 * infinities a Newton step would then smear across every node. The caller has a
 * defined answer for that case.
 */
function hbThomas(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]): number[] | null {
  const n = b.length;
  const bb = b.slice(), dd = d.slice();
  for (let i = 1; i < n; i++) {
    if (Math.abs(bb[i - 1]!) < 1e-300) return null;
    const w = a[i]! / bb[i - 1]!;
    bb[i] = bb[i]! - w * c[i - 1]!;
    dd[i] = dd[i]! - w * dd[i - 1]!;
  }
  if (Math.abs(bb[n - 1]!) < 1e-300) return null;
  const x = new Array<number>(n).fill(0);
  x[n - 1] = dd[n - 1]! / bb[n - 1]!;
  for (let i = n - 2; i >= 0; i--) x[i] = (dd[i]! - c[i]! * x[i + 1]!) / bb[i]!;
  for (const v of x) if (!Number.isFinite(v)) return null;
  return x;
}

/**
 * Cyclic tridiagonal solve for the closed-path case, using Sherman-Morrison.
 *
 * A closed path's seam is not a special case, and the only way to keep that true is to
 * solve the wrapped system. (The prototype instead cuts the loop at one node,
 * duplicates it, and solves the result as an open run with free ends, which leaves the
 * seam visibly less continuous than every other join.) The rank-one correction turns
 * the two corner entries into two ordinary Thomas solves, so the closed case still
 * costs O(n).
 */
function hbCyclic(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]): number[] | null {
  const n = b.length;
  if (n < 3) return null;
  const alpha = a[0]!, beta = c[n - 1]!;
  const gamma = -b[0]! || 1;
  const bb = b.slice();
  bb[0] = b[0]! - gamma;
  bb[n - 1] = b[n - 1]! - (alpha * beta) / gamma;
  const u = new Array<number>(n).fill(0);
  u[0] = gamma;
  u[n - 1] = beta;
  const y = hbThomas(a, bb, c, d);
  if (!y) return null;
  const z = hbThomas(a, bb, c, u);
  if (!z) return null;
  // v = (1, 0, …, 0, alpha/gamma).
  const vy = y[0]! + (alpha / gamma) * y[n - 1]!;
  const vz = z[0]! + (alpha / gamma) * z[n - 1]!;
  const denom = 1 + vz;
  if (!(Math.abs(denom) > 1e-300)) return null;
  const f = vy / denom;
  const x = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    x[i] = y[i]! - f * z[i]!;
    if (!Number.isFinite(x[i]!)) return null;
  }
  return x;
}

/** Residual is an angle in radians, so the tolerance is one too: 1e-10 rad is six
 *  orders finer than any curvature difference a display can show, and Newton reaches it
 *  in a handful of steps from a decent start. */
const HB_TOL = 1e-10;
const HB_MAX_ITER = 24;
/** No single Newton step may turn a tangent by more than this. Only bites on the first
 *  step or two from a bad initial guess, where the linearisation is worthless. */
const HB_MAX_STEP = 1;
const HB_BACKTRACK = 6;

interface HbRunResult {
  ths: number[];
  converged: boolean;
  residual: number;
  iterations: number;
}

/** Worst residual: the CONVERGENCE test, because the guarantee is about every join, and
 *  an average would let one bad join hide behind a thousand good ones. */
function hbMaxAbs(v: readonly number[]): number {
  let m = 0;
  for (const x of v) {
    const a = Math.abs(x);
    if (!(a === a)) return Number.POSITIVE_INFINITY;
    if (a > m) m = a;
  }
  return m;
}

/**
 * Merit for the line search: the 2-norm, NOT the worst residual.
 *
 * These have to be different functions, and that is not a small detail. Accepting a
 * step only when the worst residual improves works fine on five nodes and fails
 * outright on two thousand: a Newton step that improves nineteen hundred joins and
 * slightly worsens the single worst one gets rejected, the backtrack halves the step
 * four times, and the solve stalls at a residual of order one, on input where a shorter
 * path of the same shape solves to 1e-15. The 2-norm is the standard merit function for
 * exactly this reason: it measures whether the step helped overall, which is what a
 * Newton step is trying to do.
 */
function hbNorm2(v: readonly number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Number.isFinite(s) ? Math.sqrt(s) : Number.POSITIVE_INFINITY;
}

/** Chord-bend-weighted initial tangents: at each node, the angle between the two
 *  adjacent chords, apportioned by their lengths. Cheap, and already a passable curve,
 *  which is what makes it a safe fallback. */
function hbInitialThs(pts: HbRunPoint[], wrap: boolean, startTh: number | null, endTh: number | null): number[] {
  const m = pts.length;
  const ths = new Array<number>(m).fill(0);
  const chordTh = (i: number): number => {
    const p = pts[i]!, q = pts[(i + 1) % m]!;
    return Math.atan2(q.y - p.y, q.x - p.x);
  };
  const at = (i: number): number => {
    const h = pts[(i - 1 + m) % m]!, p = pts[i]!, q = pts[(i + 1) % m]!;
    const l0 = Math.hypot(p.x - h.x, p.y - h.y);
    const l1 = Math.hypot(q.x - p.x, q.y - p.y);
    const t0 = Math.atan2(p.y - h.y, p.x - h.x);
    const t1 = Math.atan2(q.y - p.y, q.x - p.x);
    if (!(l0 + l1 > 0)) return t1;
    return mod2pi(t0 + mod2pi(t1 - t0) * (l0 / (l0 + l1)));
  };
  if (wrap) {
    for (let i = 0; i < m; i++) ths[i] = at(i);
  } else {
    ths[0] = chordTh(0);
    ths[m - 1] = chordTh(m - 2);
    for (let i = 1; i < m - 1; i++) ths[i] = at(i);
  }
  if (startTh !== null) ths[0] = startTh;
  if (endTh !== null) ths[m - 1] = endTh;
  return ths;
}

/**
 * Solve one run: damped Newton on the tangent angles, iterative but bounded.
 *
 * Bounded three ways, and this documents each. Iterations are capped. Every step is
 * clamped in magnitude and then backtracked until it actually reduces the residual's
 * ∞-norm, so a step can never make things worse. And when the tridiagonal solve is
 * singular, the step falls back to the diagonal of the same system: the damped
 * fixed-point iteration the prototype ships as its only solver. That fallback is
 * slower, but it is very hard to break.
 *
 * ## Why this does not throw
 *
 * `GeomLimitError` is the right choice in boolean.ts, because the alternative there is
 * a confidently wrong topology, and a caller silently unioning the wrong region is
 * worse off than one that was told it failed. Nothing like that applies here.
 * Non-convergence means curvature disagrees slightly at some join, on a curve that
 * still interpolates every node, still has the tangents the solve last named, and
 * still has every control point within half a chord of its polygon. Throwing would
 * mean a pen tool that renders nothing while the user drags through a hard
 * configuration, to report a defect they could not have seen. So: the last iterate is
 * returned, `converged` reports what happened, and `residual` reports by how much. A
 * caller that genuinely needs G2, a CNC toolpath for example, can check it.
 */
function hbSolveRun(
  pts: HbRunPoint[],
  wrap: boolean,
  startTh: number | null,
  endTh: number | null,
  warm: number[] | null,
): HbRunResult {
  const m = pts.length;
  const chordTh0 = Math.atan2(pts[1]!.y - pts[0]!.y, pts[1]!.x - pts[0]!.x);
  // Two points with both ends free is the one system with no interior row, and it is
  // singular AT its own solution (both end conditions reduce to θ = 0.5·sin 2θ, whose
  // root is a double one at zero). The answer is the straight line, exactly.
  if (!wrap && m === 2 && startTh === null && endTh === null) {
    return { ths: [chordTh0, chordTh0], converged: true, residual: 0, iterations: 0 };
  }

  let ths: number[];
  if (warm && warm.length === m && warm.every((v) => Number.isFinite(v))) {
    ths = warm.slice();
    if (startTh !== null) ths[0] = startTh;
    if (endTh !== null) ths[m - 1] = endTh;
  } else {
    ths = hbInitialThs(pts, wrap, startTh, endTh);
  }

  let sys = hbSystem(pts, wrap, startTh, endTh, ths);
  let worst = hbMaxAbs(sys.r);
  let merit = hbNorm2(sys.r);
  let iter = 0;
  for (; iter < HB_MAX_ITER && worst > HB_TOL; iter++) {
    const d = sys.r.map((v) => -v);
    const newton = wrap ? hbCyclic(sys.a, sys.b, sys.c, d) : hbThomas(sys.a, sys.b, sys.c, d);
    // The diagonal of the same system is the prototype's whole solver: slower, but it
    // needs no factorisation, so it is what remains when the tridiagonal one is singular
    // and it is worth a second try when a full Newton step finds nothing downhill.
    const diagonal = (): number[] => sys.b.map((bk, k) => (Math.abs(bk) > 1e-12 ? 0.5 * (d[k]! / bk) : 0));
    let took = false;
    for (const step of newton ? [newton, diagonal()] : [diagonal()]) {
      if (!step.every((v) => Number.isFinite(v))) continue;
      for (let k = 0; k < m; k++) {
        const v = step[k]!;
        step[k] = v > HB_MAX_STEP ? HB_MAX_STEP : v < -HB_MAX_STEP ? -HB_MAX_STEP : v;
      }
      let f = 1;
      for (let t = 0; t < HB_BACKTRACK; t++) {
        const cand = ths.map((v, k) => v + f * step[k]!);
        const cs = hbSystem(pts, wrap, startTh, endTh, cand);
        const cm = hbNorm2(cs.r);
        if (cm < merit) {
          ths = cand; sys = cs; merit = cm; worst = hbMaxAbs(cs.r); took = true;
          break;
        }
        f *= 0.5;
      }
      if (took) break;
    }
    // Nowhere downhill to go. Stop and report; the current iterate is a valid curve.
    if (!took) break;
  }
  return { ths, converged: worst <= HB_TOL, residual: worst, iterations: iter };
}

/**
 * A solved hyperbezier: one tangent angle per node per side, plus what the solve knows
 * about itself.
 *
 * Two angles per node rather than one because a corner has a different tangent on each
 * side, and because that is the form the lowering consumes. Pass the whole thing back
 * as `warm` on the next solve of the same path and a drag re-solves in one or two
 * Newton steps instead of five.
 */
export interface HyperbezierSolution {
  /** Absolute tangent angle LEAVING node i (the start of segment i). */
  rth: number[];
  /** Absolute tangent angle ARRIVING at node i (the end of segment i−1). */
  lth: number[];
  /** Target curvature at node i where the two sides were solved separately and need
   *  blending, else null. Only ever non-null at a node with an authored handle. */
  kBlend: (number | null)[];
  /** True when every run drove its residual under `HB_TOL`, i.e. the path really is
   *  G2 at every non-corner, non-pinned join. */
  converged: boolean;
  /** The worst residual across all runs, in radians. */
  residual: number;
  /** Total Newton iterations across all runs - a drag-cost signal. */
  iterations: number;
  /**
   * Segment ends whose control arm came out reversed, meaning the solve wanted a tangent
   * more than a right angle off that segment's chord. Zero for anything a pen tool draws.
   * Non-zero says the node spacing has a hairpin the curve family cannot express, so the
   * lowering has a cusp there - see `hbArm`.
   */
  reversals: number;
}

/** A node's tangent constraints, as read from its authored handles. */
interface HbPin {
  /** Tangent angle arriving at the node, or null for "let the solve choose". */
  in: number | null;
  out: number | null;
  corner: boolean;
}

/**
 * Authored handles → tangent constraints.
 *
 * Only the handle's DIRECTION is read; its length is discarded. This trade-off needs
 * stating plainly, because it is the one place this kind differs from what a Bézier pen
 * tool trains a user to expect: you may say which way the curve leaves a node, but the
 * solve still owns how far the control point goes, because arm length is what it has
 * to spend to make curvature continuous. A user who wants control over both is asking
 * for kind `'cubic'`.
 *
 * A node's `continuity` defaults to `'smooth'` here, NOT to `'corner'` as
 * `enforceContinuity` defaults. These are opposite defaults for opposite jobs: this
 * kind exists so that clicking a sequence of points yields a smooth curve, and a pen
 * tool whose default node broke the spline would draw polylines instead.
 */
function hbPin(node: Node): HbPin {
  const corner = (node.continuity ?? 'smooth') === 'corner';
  const hix = node.hInX ?? 0, hiy = node.hInY ?? 0;
  const hox = node.hOutX ?? 0, hoy = node.hOutY ?? 0;
  // The incoming handle points BACK towards the previous node, so the direction of
  // travel through the node is its reverse.
  let pin = Math.hypot(hix, hiy) > 1e-12 ? mod2pi(Math.atan2(-hiy, -hix)) : null;
  let pout = Math.hypot(hox, hoy) > 1e-12 ? mod2pi(Math.atan2(hoy, hox)) : null;
  if (!corner) {
    // Smooth means collinear, so one handle pins both sides.
    if (pin === null) pin = pout;
    if (pout === null) pout = pin;
  }
  return { in: pin, out: pout, corner };
}

function hbIsBreak(p: HbPin): boolean {
  return p.corner || p.in !== null || p.out !== null;
}

/**
 * Solve the tangent angles of a hyperbezier path.
 *
 * Corners and pinned tangents partition the path into RUNS that are solved
 * independently. That is not an optimisation, it is the semantics. A corner is a
 * declaration that the two sides have nothing to do with each other, so an edit on one
 * side of a corner must not move a single control point on the other, and the only way
 * to guarantee that is for the two sides to never share a solve. The same partition is
 * what keeps the cost of a drag proportional to the run being dragged, not to the whole
 * path.
 *
 * A closed path with no corner and no pinned tangent anywhere is one cyclic run, so its
 * seam is an ordinary join. With at least one break the path is rotated to start there
 * and cut into open runs.
 */
export function solveHyperbezier(nodes: Node[], closed: boolean, warm?: HyperbezierSolution): HyperbezierSolution {
  const n = nodes.length;
  const rth = new Array<number>(n).fill(0);
  const lth = new Array<number>(n).fill(0);
  const kBlend = new Array<number | null>(n).fill(null);
  const empty: HyperbezierSolution = { rth, lth, kBlend, converged: true, residual: 0, iterations: 0, reversals: 0 };
  if (n < 2) return empty;
  // Matches every other kind in this file: `pairs` only wraps above two nodes, so a
  // two-node "closed" path is one segment, not two coincident ones.
  const wrap = closed && n > 2;
  const nSeg = wrap ? n : n - 1;

  const pins = nodes.map(hbPin);
  const breaks: number[] = [];
  for (let i = 0; i < n; i++) if (hbIsBreak(pins[i]!)) breaks.push(i);

  /** Runs as index lists into `nodes`; a cyclic run lists every node exactly once. */
  const runs: { idx: number[]; wrap: boolean }[] = [];
  if (wrap && breaks.length === 0) {
    runs.push({ idx: nodes.map((_, i) => i), wrap: true });
  } else if (wrap) {
    const s = breaks[0]!;
    let cur = [s];
    for (let k = 1; k <= n; k++) {
      const i = (s + k) % n;
      cur.push(i);
      if (k < n && hbIsBreak(pins[i]!)) { runs.push({ idx: cur, wrap: false }); cur = [i]; }
    }
    runs.push({ idx: cur, wrap: false });
  } else {
    let cur = [0];
    for (let i = 1; i < n; i++) {
      cur.push(i);
      if (i < n - 1 && hbIsBreak(pins[i]!)) { runs.push({ idx: cur, wrap: false }); cur = [i]; }
    }
    runs.push({ idx: cur, wrap: false });
  }

  let converged = true;
  let residual = 0;
  let iterations = 0;
  for (const run of runs) {
    const idx = run.idx;
    const m = idx.length;
    if (m < 2) continue;
    const pts = idx.map((i) => ({ x: nodes[i]!.x, y: nodes[i]!.y }));
    const startTh = run.wrap ? null : pins[idx[0]!]!.out;
    const endTh = run.wrap ? null : pins[idx[m - 1]!]!.in;
    let warmRun: number[] | null = null;
    if (warm && warm.rth.length === n && warm.lth.length === n) {
      warmRun = idx.map((i, j) => (run.wrap || j < m - 1 ? warm.rth[i]! : warm.lth[i]!));
    }
    const res = hbSolveRun(pts, run.wrap, startTh, endTh, warmRun);
    if (!res.converged) converged = false;
    if (res.residual > residual) residual = res.residual;
    iterations += res.iterations;
    // A run's last node keeps only its arriving tangent; the next run sets its leaving
    // one. For a cyclic run every node is interior and gets both.
    for (let j = 0; j < m; j++) {
      const i = idx[j]!;
      if (run.wrap || j < m - 1) rth[i] = res.ths[j]!;
      if (run.wrap || j > 0) lth[i] = res.ths[j]!;
    }
  }
  // Every other node is written twice, once by the run on each side. An open path's two
  // outer ends face nothing on one side, so give them the other side's angle: a caller
  // reading either array unconditionally then sees something sensible rather than a zero.
  if (!wrap) {
    lth[0] = pins[0]!.in ?? rth[0]!;
    rth[n - 1] = pins[n - 1]!.out ?? lth[n - 1]!;
  }

  /**
   * Curvature blending at a pinned smooth node.
   *
   * A pinned tangent is a hard constraint, so the two runs meeting at that node solve
   * to different curvatures there, and the join is only G1. Levien's fix: aim both
   * sides at one target curvature (the harmonic mean of what they each wanted, or zero
   * when they disagree in sign, since there is no sensible mean of a left bend and a
   * right bend), then bend each side towards it. Only the arm-length rescale is ported;
   * see `hbBlendArm`.
   */
  const segs: HbSegState[] = [];
  let reversals = 0;
  for (let i = 0; i < nSeg; i++) {
    const a = nodes[i]!, b = nodes[(i + 1) % n]!;
    const st = hbSegState(a.x, a.y, b.x, b.y, rth[i]!, lth[(i + 1) % n]!);
    if (st.a0 < 0) reversals++;
    if (st.a1 < 0) reversals++;
    segs.push(st);
  }
  for (let i = 0; i < n; i++) {
    const p = pins[i]!;
    if (p.corner || !hbIsBreak(p)) continue;
    const prev = wrap ? segs[(i - 1 + n) % n] : i > 0 ? segs[i - 1] : undefined;
    const next = wrap ? segs[i] : i < n - 1 ? segs[i] : undefined;
    if (!prev || !next) continue;
    // Unit-frame curvature over chord length is real curvature. (This is upstream's
    // `myTan(ak)` in closed form: for ak = atan2(cross, dot·|dot|), tan reflected into
    // (−π/2, π/2] is exactly cross/dot².)
    const rK = next.k0u / next.chord;
    const lK = prev.k1u / prev.chord;
    if (!Number.isFinite(rK) || !Number.isFinite(lK)) continue;
    if (Math.sign(rK) !== Math.sign(lK)) { kBlend[i] = 0; continue; }
    const h = 2 / (1 / rK + 1 / lK);
    kBlend[i] = Number.isFinite(h) ? h : 0;
  }

  return { rth, lth, kBlend, converged, residual, iterations, reversals };
}

/**
 * Rescale one control arm to aim its end's curvature at `kTarget` (unit-frame).
 *
 * Levien's `1/(2 + k/k_old)`. His own comment calls this formula rough, and it is
 * approximate by construction: matching an endpoint curvature exactly needs the
 * segment split and a quintic correction field, and that field's amplitude divides by
 * the squared tangent speed, so it is unbounded near a cusp. Trading exactness for a
 * bounded, monotone, single-cubic adjustment is the right choice for a curve whose
 * whole reason to exist is behaving well while dragged. The clamp is what makes it
 * bounded: arm ∈ [a/4, 2a], so still under one chord.
 */
function hbBlendArm(arm: number, oldK: number, kTarget: number): number {
  let k = oldK;
  if (!Number.isFinite(k) || Math.abs(k) < 1e-6) k = 1e-6;
  const ratio = kTarget / k;
  if (!Number.isFinite(ratio)) return arm;
  const raw = 1 / (2 + ratio);
  const scale = raw > 2 / 3 ? 2 / 3 : raw < 1 / 12 ? 1 / 12 : raw;
  return 3 * arm * scale;
}

/**
 * Lower a solved hyperbezier to cubics: one per segment, and a blended segment is
 * still one cubic (see `hbBlendArm`).
 *
 * The unit-frame control points are placed using the chord VECTOR rather than a
 * rotation and a separate scale, which makes the whole lowering exactly equivariant
 * under any similarity of the input: translate, rotate, or uniformly scale the nodes,
 * and every emitted coordinate follows exactly, to rounding. This is worth stating
 * because it is easy to lose by accident: normalising the chord and multiplying its
 * length back in later is algebraically identical but not numerically identical.
 */
export function hyperbezierCubics(nodes: Node[], closed: boolean, solution: HyperbezierSolution): Cubic[] {
  const n = nodes.length;
  if (n < 2) return [];
  const wrap = closed && n > 2;
  const nSeg = wrap ? n : n - 1;
  const out: Cubic[] = [];
  for (let i = 0; i < nSeg; i++) {
    const a = nodes[i]!, b = nodes[(i + 1) % n]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const chord = Math.hypot(dx, dy);
    if (!(chord > HB_MIN_CHORD)) {
      // Coincident nodes: there is no chord direction to build a frame on, so the
      // segment is the point itself. Emitting it keeps one cubic per segment, which
      // callers index against.
      out.push([a.x, a.y, a.x, a.y, b.x, b.y, b.x, b.y]);
      continue;
    }
    const chth = Math.atan2(dy, dx);
    const th0 = mod2pi((solution.rth[i] ?? chth) - chth);
    const th1 = mod2pi(chth - (solution.lth[(i + 1) % n] ?? chth));
    const cur = hbCurve(th0, th1);
    let arm0 = cur.a0, arm1 = cur.a1;
    const kb0 = solution.kBlend[i] ?? null;
    const kb1 = solution.kBlend[(i + 1) % n] ?? null;
    if (kb0 !== null) arm0 = hbBlendArm(cur.a0, cur.k0u, kb0 * chord);
    if (kb1 !== null) arm1 = hbBlendArm(cur.a1, cur.k1u, kb1 * chord);
    const ux1 = arm0 * Math.cos(th0), uy1 = arm0 * Math.sin(th0);
    const ux2 = 1 - arm1 * Math.cos(th1), uy2 = arm1 * Math.sin(th1);
    out.push([
      a.x, a.y,
      a.x + dx * ux1 - dy * uy1, a.y + dy * ux1 + dx * uy1,
      a.x + dx * ux2 - dy * uy2, a.y + dy * ux2 + dx * uy2,
      b.x, b.y,
    ]);
  }
  return out;
}

/**
 * Re-apply a node's continuity constraint after one of its handles moved.
 *
 * The operation a pen tool performs on every handle drag, and the reason `Continuity`
 * is stored rather than inferred: `smooth` and `symmetric` are indistinguishable from
 * `corner` by looking at a path that happens to be tangent-continuous.
 */
export function enforceContinuity(node: Node, moved: 'in' | 'out'): Node {
  const c = node.continuity ?? 'corner';
  if (c === 'corner') return node;
  const [mx, my] = moved === 'in' ? [node.hInX ?? 0, node.hInY ?? 0] : [node.hOutX ?? 0, node.hOutY ?? 0];
  const len = Math.hypot(mx, my);
  if (len < 1e-12) return node;
  const otherLen = moved === 'in'
    ? Math.hypot(node.hOutX ?? 0, node.hOutY ?? 0)
    : Math.hypot(node.hInX ?? 0, node.hInY ?? 0);
  // Opposite direction; `symmetric` mirrors the length too.
  const k = (c === 'symmetric' ? len : otherLen) / len;
  const ox = -mx * k, oy = -my * k;
  return moved === 'in'
    ? { ...node, hOutX: ox, hOutY: oy }
    : { ...node, hInX: ox, hInY: oy };
}
