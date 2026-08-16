// SPDX-License-Identifier: MPL-2.0
/**
 * Spiro. This is Raph Levien's Euler-spiral interpolating spline, the one Inkscape and
 * FontForge ship. It is a separate `SplineKind` from `hyperbezier` (spline.ts) by
 * design: it uses different knot semantics and a different curve family, and users who
 * know it from Inkscape asked for it (2026-08-06).
 *
 * ## Attribution
 *
 * The mathematics is Raph Levien's. It is REPRODUCED here as formulae, not copied,
 * from:
 *   - the paper/thesis "From Spiral to Spline" and https://github.com/raphlinus/spiro,
 *   - libspiro's `compute_ends` relation between a segment's curvature polynomial and
 *     its end tangents/curvatures, and its `spiro_to_bpath` chord/3 arm construction.
 * The upstream license is MIT OR Apache-2.0, both compatible with this MPL-2.0 engine.
 * Raph's work is the foundation of curvature-continuous curves in typography and
 * Inkscape, and the attribution stays here for that reason. See memory
 * `spiro-spline-references`.
 *
 * ## What this implements
 *
 * A clothoid (Euler-spiral) segment between each pair of knots: curvature LINEAR in
 * arc length, k(s) = k0 + k1·s over s ∈ [−0.5, 0.5]. There are two knot kinds, mapped
 * from the engine's `continuity` field, matching common Inkscape/FontForge usage:
 *   - `'corner'`  → a G0 corner (libspiro 'v'): the two sides are independent. Like
 *      hyperbezier, a corner PARTITIONS the path into runs solved separately. That is
 *      the semantics, not an optimisation.
 *   - `'smooth'` / `'symmetric'` → a G2 curve knot (libspiro 'c'): tangent AND curvature
 *      continuous. This is the ordinary smooth Spiro point.
 *
 * The unknown is one tangent ANGLE per knot (world frame). Sharing it across the two
 * segments on either side of a knot makes G1 automatic, so only G2 needs solving. Two
 * stages:
 *   1. A LINEAR seed. With Levien's algebraic `compute_ends` (tangent = 0.5·k0 ∓
 *      0.125·k1, curvature = k0 ∓ 0.5·k1, chord-relative), the end curvature is linear in
 *      the two knot angles, so the G2 conditions form a tridiagonal (cyclic when closed)
 *      system in bounded per-knot deflections: one dense solve, with no winding blow-up.
 *   2. A NEWTON refinement on the TRUE clothoid curvatures (from `segClothoid`). The
 *      leading-order seed leaves a small curvature step at a knot, so a few damped Newton
 *      steps drive the actual κ_exit(left) − κ_entry(right) to ~0. Free ends take the
 *      natural condition (curvature → 0). `maxSpiroCurvatureJump` measures the result.
 *
 * The bezier LOWERING builds each segment's TRUE chord-frame clothoid: Θ(u) quadratic
 * in arc length, solved for the closing condition (`solveClosing`), and emits it as one
 * or more cubics with Levien's chord/3 arms, subdividing where it turns more than
 * `ARC_TOL`. A segment's outer tangents are exactly psiA/psiB, so joins are G1-exact.
 * (The 2nd derivative of the cubic *approximation* has small jumps. This is an
 * unavoidable property of representing a clothoid with cubic Béziers, and libspiro's own
 * bezier output has the same property, but the curve itself is a smooth chain of Euler
 * spirals with continuous analytic curvature.)
 *
 * NOT (yet) implemented: libspiro's G4 'o' knot (4-parameter spiral, curvature-
 * derivative continuous). The common Inkscape smooth node is G2, which is what ships
 * here. G4 is a documented future `SplineKind`-level addition, not a silent gap.
 */
import type { Cubic } from './bezier.ts';
import type { Node } from './spline.ts';

/** Reduce an angle to (−π, π]. */
function mod2pi(th: number): number {
  const f = th * (0.5 / Math.PI);
  return 2 * Math.PI * (f - Math.round(f));
}

// 8-point Gauss–Legendre nodes/weights on [−0.5, 0.5] (shifted from [−1,1]). Ample for
// the smooth clothoid integrand over a single (sub)segment.
const GL_X = [
  -0.4830766568773831, -0.4183605950159868, -0.3115468316959411, -0.1738056351822426,
  0.1738056351822426, 0.3115468316959411, 0.4183605950159868, 0.4830766568773831,
];
const GL_W = [
  0.05061426814518821, 0.11119051722668724, 0.15685332293894367, 0.18134189168918102,
  0.18134189168918102, 0.15685332293894367, 0.11119051722668724, 0.05061426814518821,
];

/** The clothoid segment in its CHORD frame: tangent (relative to the chord) is a
 *  quadratic in the arc parameter u ∈ [0,1], Θ(u) = a + b·u + c·u². Curvature ∝ dΘ/du =
 *  b + 2c·u, so curvature is linear in u. That is the defining property of an Euler
 *  spiral. */
const theta = (a: number, b: number, c: number, u: number): number => a + b * u + c * u * u;

/** ∫ over [u0,u1] of (cos Θ, sin Θ) du for Θ(u) = a + b·u + c·u². Gauss–Legendre. */
function intCosSin(a: number, b: number, c: number, u0: number, u1: number): { x: number; y: number } {
  const mid = 0.5 * (u0 + u1);
  const half = 0.5 * (u1 - u0);
  let x = 0, y = 0;
  for (let i = 0; i < GL_X.length; i++) {
    const u = mid + 2 * half * GL_X[i]!;
    const t = theta(a, b, c, u);
    x += GL_W[i]! * Math.cos(t);
    y += GL_W[i]! * Math.sin(t);
  }
  const len = u1 - u0;
  return { x: x * len, y: y * len };
}

/**
 * Given the entry deflection α and exit deflection β (both tangent-vs-chord, forward),
 * find the clothoid Θ(u) = α + b·u + c·u² that starts and ends ON the chord. Θ(1) = β
 * fixes b + c = β − α; the CLOSING condition ∫₀¹ sin Θ du = 0 (no net perpendicular
 * drift) fixes the last degree of freedom. Solved for c by Newton from the circular-arc
 * seed c = 0, with a bounded fallback - the residual is smooth and shallow here.
 */
function solveClosing(alpha: number, beta: number): { b: number; c: number } {
  let c = 0;
  for (let it = 0; it < 24; it++) {
    const b = beta - alpha - c;
    // F(c) = ∫ sin Θ du ; F'(c) = ∫ cos Θ · ∂Θ/∂c du, ∂Θ/∂c = u² − u (since ∂b/∂c = −1).
    let f = 0, df = 0;
    for (let i = 0; i < GL_X.length; i++) {
      const u = 0.5 + GL_X[i]!;         // Gauss node mapped to [0,1] (GL_W sums to 1)
      const t = theta(alpha, b, c, u);
      f += GL_W[i]! * Math.sin(t);                  // ∫₀¹ sin Θ du
      df += GL_W[i]! * Math.cos(t) * (u * u - u);   // ∫₀¹ cos Θ · ∂Θ/∂c du
    }
    if (Math.abs(f) < 1e-12) break;
    if (Math.abs(df) < 1e-12) break;
    const step = f / df;
    c -= Math.max(-Math.PI, Math.min(Math.PI, step)); // clamp to keep the iteration sane
  }
  return { b: beta - alpha - c, c };
}

/** One segment's solved clothoid: its chord-frame quadratic Θ(u)=α+b·u+c·u², the scale
 *  onto the real chord, and the physical curvature at each end (κ = (dΘ/du)/scale, since
 *  arc length s = scale·u). Shared by the curvature solve and the bezier lowering. */
interface SegClothoid { alpha: number; b: number; c: number; scale: number; kEntry: number; kExit: number }

function segClothoid(ax: number, ay: number, bx: number, by: number, psiA: number, psiB: number): SegClothoid {
  const chord = Math.hypot(bx - ax, by - ay);
  const phi = Math.atan2(by - ay, bx - ax);
  const alpha = mod2pi(psiA - phi);
  const beta = mod2pi(psiB - phi);
  const { b, c } = solveClosing(alpha, beta);
  const span = intCosSin(alpha, b, c, 0, 1);
  const scale = chord / (Math.hypot(span.x, span.y) || 1e-12);
  return { alpha, b, c, scale, kEntry: b / scale, kExit: (b + 2 * c) / scale };
}

/** One knot run to solve: indices into the node array, and whether it wraps (closed with
 *  no corner). Mirrors hyperbezier's run partitioning. */
interface Run { idx: number[]; wrap: boolean }

const isCorner = (n: Node): boolean => (n.continuity ?? 'corner') === 'corner';

/** Partition the path into runs at corner knots, exactly like `solveHyperbezier`:
 *  a corner declares the two sides independent, so they never share a solve. */
function partition(nodes: Node[], closed: boolean): Run[] {
  const n = nodes.length;
  const wrap = closed && n > 2;
  const runs: Run[] = [];
  if (wrap) {
    const corners: number[] = [];
    for (let i = 0; i < n; i++) if (isCorner(nodes[i]!)) corners.push(i);
    if (corners.length === 0) { runs.push({ idx: nodes.map((_, i) => i), wrap: true }); return runs; }
    const s = corners[0]!;
    let cur = [s];
    for (let k = 1; k <= n; k++) {
      const i = (s + k) % n;
      cur.push(i);
      if (k < n && isCorner(nodes[i]!)) { runs.push({ idx: cur, wrap: false }); cur = [i]; }
    }
    runs.push({ idx: cur, wrap: false });
  } else {
    let cur = [0];
    for (let i = 1; i < n; i++) {
      cur.push(i);
      if (i < n - 1 && isCorner(nodes[i]!)) { runs.push({ idx: cur, wrap: false }); cur = [i]; }
    }
    runs.push({ idx: cur, wrap: false });
  }
  return runs;
}

/**
 * Solve one run's per-knot WORLD tangent angles for G2 curvature continuity.
 *
 * The unknowns are per-knot DEFLECTIONS `θ_j` (the tangent relative to a chord), not
 * absolute angles: deflections are mod-2π bounded, so a closed loop's 2π of total
 * turning never accumulates into the linear system and blows up the cyclic seam.
 * `θ_j := th1(seg j−1)` (the exit deflection of the segment arriving at knot j; for an
 * open run's first knot it is `th0(seg 0)`, the entry deflection, and `bend[0]=0`
 * expresses "no arriving chord"). With Levien's compute_ends the exit/entry curvatures
 * at a knot are linear in θ, so one equation per knot:
 *   interior/closed join → physical exit-curvature(left) = entry-curvature(right)
 *   open free end        → natural curvature 0
 * Absolute ψ is reconstructed from θ and the raw (un-unwrapped) chord angles.
 */
function solveRun(pts: { x: number; y: number }[], wrap: boolean): number[] {
  const m = pts.length;
  const nSeg = wrap ? m : m - 1;
  const rawPhi = new Array<number>(nSeg);
  const len = new Array<number>(nSeg);
  for (let i = 0; i < nSeg; i++) {
    const a = pts[i]!, b = pts[(i + 1) % m]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    rawPhi[i] = Math.atan2(dy, dx);
    len[i] = Math.max(1e-9, Math.hypot(dx, dy));
  }
  // Turning at each knot (mod-2π). For an open run the first knot has no arriving chord.
  const bend = new Array<number>(m).fill(0);
  if (wrap) for (let j = 0; j < m; j++) bend[j] = mod2pi(rawPhi[j % nSeg]! - rawPhi[(j - 1 + nSeg) % nSeg]!);
  else for (let j = 1; j < m; j++) bend[j] = mod2pi(rawPhi[j]! - rawPhi[j - 1]!);

  // Unknowns are per-knot deflections θ_j := th1(seg j−1) - the EXIT deflection of the
  // arriving segment in Levien's reversed convention (th1 = chord − exit-tangent). With
  // compute_ends the curvatures at knot j are:
  //   exit-curvature(seg j−1) = 3θ_j + θ_{j−1} + bend[j−1]
  //   entry-curvature(seg j)  = −3θ_j − θ_{j+1} − 3·bend[j]
  // G2 equates them scaled by chord length; the resulting tridiagonal system is
  // diagonally dominant (θ_j coeff 3/l_L + 3/l_R vs 1/l each side), so a plain solve is
  // stable. bend is mod-2π so a closed loop's 2π of turning never enters the matrix.
  const A: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const r = new Array<number>(m).fill(0);
  const add = (row: number, col: number, v: number) => { A[row]![((col % m) + m) % m]! += v; };
  const g2 = (j: number) => {
    const lL = len[((j - 1) % nSeg + nSeg) % nSeg]!, lR = len[j % nSeg]!;
    add(j, j - 1, 1 / lL); add(j, j, 3 / lL + 3 / lR); add(j, j + 1, 1 / lR);
    r[j] = -bend[((j - 1) % m + m) % m]! / lL - (3 * bend[j % m]!) / lR;
  };

  if (wrap) {
    for (let j = 0; j < m; j++) g2(j);
  } else {
    // Open first end: entry-curvature(seg 0) = 0 → 3θ0 + θ1 = 0 (bend[0] = 0).
    add(0, 0, 3); add(0, 1, 1); r[0] = 0;
    for (let j = 1; j < m - 1; j++) g2(j);
    // Open last end: exit-curvature(seg m−2) = 0 → θm−2 + 3θm−1 = −bend[m−2].
    add(m - 1, m - 2, 1); add(m - 1, m - 1, 3); r[m - 1] = -bend[m - 2]!;
  }

  const thetaSol = solveDense(A, r);
  // Reconstruct absolute world tangent angles. θ_j = rawPhi(prev seg) − ψ_j, so
  // ψ_j = rawPhi(prev seg) − θ_j; the "prev seg" for an open run's first knot is seg 0.
  const psi = new Array<number>(m);
  for (let j = 0; j < m; j++) {
    const prev = wrap ? (j - 1 + nSeg) % nSeg : j === 0 ? 0 : j - 1;
    psi[j] = rawPhi[prev]! - thetaSol[j]!;
  }

  // ── Newton refinement on the TRUE clothoid curvatures ────────────────────────
  // The linear solve above used Levien's leading-order compute_ends curvature, which
  // leaves a visible curvature step at a knot. Refine the world tangent angles ψ so the
  // ACTUAL clothoid curvatures (from segClothoid) are continuous - that is the property
  // Spiro exists for. Residual per knot: interior/closed = κ_exit(left) − κ_entry(right);
  // open free end = the end curvature itself (natural, → 0). The Jacobian is
  // tridiagonal (a knot's residual moves only with its own and its two neighbours' ψ),
  // built by finite difference; a few damped steps converge from the good linear seed.
  const residual = (p: number[]): number[] => {
    const seg: SegClothoid[] = [];
    for (let i = 0; i < nSeg; i++) seg.push(segClothoid(pts[i]!.x, pts[i]!.y, pts[(i + 1) % m]!.x, pts[(i + 1) % m]!.y, p[i]!, p[(i + 1) % m]!));
    const res = new Array<number>(m).fill(0);
    if (wrap) {
      for (let j = 0; j < m; j++) res[j] = seg[(j - 1 + nSeg) % nSeg]!.kExit - seg[j % nSeg]!.kEntry;
    } else {
      res[0] = seg[0]!.kEntry;                    // natural free end
      for (let j = 1; j < m - 1; j++) res[j] = seg[j - 1]!.kExit - seg[j]!.kEntry;
      res[m - 1] = seg[m - 2]!.kExit;             // natural free end
    }
    return res;
  };
  const norm = (v: number[]) => Math.max(...v.map(Math.abs));
  const EPS = 1e-6;
  for (let it = 0; it < 8; it++) {
    const r0 = residual(psi);
    if (norm(r0) < 1e-9) break;
    // Finite-difference Jacobian J[i][k] = ∂res_i/∂ψ_k.
    const J: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    for (let k = 0; k < m; k++) {
      const save = psi[k]!;
      psi[k] = save + EPS;
      const rk = residual(psi);
      psi[k] = save;
      for (let i = 0; i < m; i++) J[i]![k] = (rk[i]! - r0[i]!) / EPS;
    }
    const rhs = r0.map((v) => -v);
    const dpsi = solveDense(J, rhs);
    let damp = 1;
    for (const d of dpsi) if (Math.abs(d) > 0.6) damp = Math.min(damp, 0.6 / Math.abs(d)); // cap the step
    let moved = false;
    for (let k = 0; k < m; k++) { const d = damp * dpsi[k]!; if (Number.isFinite(d)) { psi[k]! += d; moved = true; } }
    if (!moved) break;
  }
  return psi;
}

/** Gaussian elimination with partial pivoting for the small dense per-run system. */
function solveDense(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(M[row]![col]!) > Math.abs(M[piv]![col]!)) piv = row;
    if (piv !== col) { const t = M[piv]!; M[piv] = M[col]!; M[col] = t; }
    const d = M[col]![col]!;
    if (Math.abs(d) < 1e-12) continue; // singular row (degenerate run) - leave as-is
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = M[row]![col]! / d;
      if (f === 0) continue;
      for (let k = col; k <= n; k++) M[row]![k]! -= f * M[col]![k]!;
    }
  }
  return M.map((row, i) => (Math.abs(M[i]![i]!) < 1e-12 ? 0 : row[n]! / M[i]![i]!));
}

const ARC_TOL = 0.25; // radians of turn per emitted cubic before subdividing


/**
 * Lower one segment (knots A→B, solved world tangent angles psiA/psiB) to cubics by
 * rendering its TRUE chord-frame clothoid, subdividing where it turns more than ARC_TOL.
 *
 * The clothoid's end tangents are EXACTLY psiA and psiB by construction (Θ(0) = α,
 * Θ(1) = β), so consecutive segments meet G1-exactly at the shared knot - no cusp.
 */
function segToCubics(
  ax: number, ay: number, bx: number, by: number, psiA: number, psiB: number,
): Cubic[] {
  const dx = bx - ax, dy = by - ay;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) return [];
  const phi = Math.atan2(dy, dx);
  const alpha = mod2pi(psiA - phi);   // entry deflection from the chord (forward)
  const beta = mod2pi(psiB - phi);    // exit deflection from the chord (forward)
  const { b, c } = solveClosing(alpha, beta);

  // Chord-frame → world: the clothoid is integrated in a frame whose chord is +x from A;
  // scale so its span reaches the real chord length, and rotate by phi. The perpendicular
  // component closes to ~0 by solveClosing, so the endpoint lands on B.
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const span = intCosSin(alpha, b, c, 0, 1);
  const scale = chord / (Math.hypot(span.x, span.y) || 1e-12);
  const pos = (u: number): { x: number; y: number } => {
    const d = intCosSin(alpha, b, c, 0, u);
    const sx = scale * d.x, sy = scale * d.y;
    return { x: ax + sx * cosP - sy * sinP, y: ay + sx * sinP + sy * cosP };
  };
  const tan = (u: number): number => phi + theta(alpha, b, c, u);

  const out: Cubic[] = [];
  const emit = (u0: number, u1: number, p0: { x: number; y: number }, p1: { x: number; y: number }, depth: number): void => {
    const dTurn = theta(alpha, b, c, u1) - theta(alpha, b, c, u0);
    if (Math.abs(dTurn) > ARC_TOL && depth < 10) {
      const um = 0.5 * (u0 + u1);
      const pm = pos(um);
      emit(u0, um, p0, pm, depth + 1);
      emit(um, u1, pm, p1, depth + 1);
      return;
    }
    // Chord/3 arms along the sub-arc's end tangents - Levien's spiro_to_bpath arm. The
    // segment's outer tangents are psiA/psiB exactly and interior sub-arcs share tan(um),
    // so joins are G1; curvature continuity comes from sampling the true clothoid finely
    // (ARC_TOL), the same way libspiro's own bezier output does.
    const t0 = tan(u0), t1 = tan(u1);
    const arm = Math.hypot(p1.x - p0.x, p1.y - p0.y) / 3;
    out.push([
      p0.x, p0.y,
      p0.x + arm * Math.cos(t0), p0.y + arm * Math.sin(t0),
      p1.x - arm * Math.cos(t1), p1.y - arm * Math.sin(t1),
      p1.x, p1.y,
    ]);
  };
  emit(0, 1, { x: ax, y: ay }, { x: bx, y: by }, 0);
  return out;
}

/**
 * Solve the per-knot LEAVING / ARRIVING world tangent angles. They agree at a smooth
 * knot. At a CORNER (shared by two runs) they differ, which is the whole point of a
 * corner. So, like hyperbezier's rth/lth, a segment reads its start knot's leaving
 * tangent and its end knot's arriving tangent. Writing one shared `psi` instead would
 * let the second run overwrite the first run's corner tangent, which would corrupt
 * that run's last segment.
 */
function solveTangents(nodes: Node[], closed: boolean): { psiOut: number[]; psiIn: number[] } {
  const n = nodes.length;
  const psiOut = new Array<number>(n).fill(0);
  const psiIn = new Array<number>(n).fill(0);
  for (const run of partition(nodes, closed)) {
    const m = run.idx.length;
    if (m < 2) continue;
    const pts = run.idx.map((i) => ({ x: nodes[i]!.x, y: nodes[i]!.y }));
    const sol = solveRun(pts, run.wrap);
    for (let j = 0; j < m; j++) {
      const i = run.idx[j]!;
      if (run.wrap || j < m - 1) psiOut[i] = sol[j]!;
      if (run.wrap || j > 0) psiIn[i] = sol[j]!;
    }
  }
  return { psiOut, psiIn };
}

/**
 * Lower a Spiro authored path to cubic Béziers - the entry point `toCubics` calls.
 */
export function spiroCubics(nodes: Node[], closed: boolean): Cubic[] {
  const n = nodes.length;
  if (n < 2) return [];
  const wrap = closed && n > 2;
  const nSeg = wrap ? n : n - 1;
  const { psiOut, psiIn } = solveTangents(nodes, closed);
  const out: Cubic[] = [];
  for (let i = 0; i < nSeg; i++) {
    const a = nodes[i]!, b = nodes[(i + 1) % n]!;
    out.push(...segToCubics(a.x, a.y, b.x, b.y, psiOut[i]!, psiIn[(i + 1) % n]!));
  }
  return out;
}

/**
 * The largest curvature discontinuity (per unit length) across any smooth interior knot,
 * measured on the ANALYTIC clothoid segments. This is the real thing the G2 solve
 * guarantees, as opposed to the 2nd derivative of the cubic-Bézier *approximation*,
 * which is jumpy by nature. Exposed for tests; ~0 means the solve achieved curvature
 * continuity.
 */
export function maxSpiroCurvatureJump(nodes: Node[], closed: boolean): number {
  const n = nodes.length;
  if (n < 3) return 0;
  const wrap = closed && n > 2;
  const nSeg = wrap ? n : n - 1;
  const { psiOut, psiIn } = solveTangents(nodes, closed);
  const seg: SegClothoid[] = [];
  for (let i = 0; i < nSeg; i++) {
    const a = nodes[i]!, b = nodes[(i + 1) % n]!;
    seg.push(segClothoid(a.x, a.y, b.x, b.y, psiOut[i]!, psiIn[(i + 1) % n]!));
  }
  let worst = 0;
  const check = (leftSeg: number, rightSeg: number, knot: number) => {
    if ((nodes[knot]!.continuity ?? 'corner') === 'corner') return; // corner = no G2 claim
    worst = Math.max(worst, Math.abs(seg[leftSeg]!.kExit - seg[rightSeg]!.kEntry));
  };
  if (wrap) for (let j = 0; j < n; j++) check((j - 1 + nSeg) % nSeg, j % nSeg, j);
  else for (let j = 1; j < n - 1; j++) check(j - 1, j, j);
  return worst;
}
