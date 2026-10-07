// SPDX-License-Identifier: MPL-2.0
/** Independent source-to-fitted-chain offset verification with bounded adaptive sampling. */
import { boundsCubic, type Cubic, nearestOnCubic, type Pt } from './bezier.ts';
import { offsetPoint } from './offset-source.ts';
import * as pmath from './portable-math.ts';

/** Where the error measurement STARTS. It refines from here wherever the exact offset
 *  trace is still coarser than `tol` between neighbours, so this is a floor and not the
 *  resolution: a fixed grid of any size misses a curvature spike narrower than its step,
 *  and near a cusp that step would have to be ~1e-7 to see the feature at all. */
const ERROR_SAMPLES = 12;
/** Caps on the refinement. The depth reaches a 1e-7-wide feature from a 1/12 grid; the
 *  sample budget is what keeps a pathological piece from spending the depth everywhere,
 *  and running out only costs a split that could have been better placed. */
const MAX_ERROR_DEPTH = 20;
const ERROR_BUDGET = 512;
/**
 * How far the approximation is from the true offset, at its worst, and at which source
 * parameter.
 *
 * The only sampling in this file, and it is measurement rather than construction: every
 * point measured is computed exactly (`offsetPoint` is a point of the source plus `d`
 * along an exact normal), and `nearestOnCubic` answers exactly. Nothing here stands in
 * for geometry that should have been solved.
 *
 * `approx` is the whole CHAIN the fitter returned for the piece, measured against the
 * nearest of its curves. Per-curve measurement would need each one's source parameter
 * range, which the fitter does not report, and the chain-wide question is the one that
 * matters anyway: every point of the true offset has to be covered by SOMETHING.
 *
 * The direction of the measurement is the part worth keeping. The obvious test (sample
 * the approximation and check it is |d| from the source) is fooled wherever the offset
 * FOLDS, which is anywhere |distance| exceeds the local radius of curvature: a point
 * that cuts straight across the swallowtail is still exactly |d| from some other part of
 * the source, so a badly wrong curve passes. Asking instead how far the approximation is
 * from a point that must lie ON it cannot be fooled that way, and it hands back the
 * source parameter to split at, rather than one inferred from a nearest-point search.
 *
 * ## Why the step is refined rather than fixed
 *
 * A fixed grid only measures where it looks, and the places an offset goes wrong are
 * narrower than any grid worth paying for. Near a cusp the tangent whips round inside a
 * window of ~1e-7 in `t`, so the exact offset trace travels several units between two
 * neighbours of a 12-point grid: the piece is accepted, and the DELIVERED error stays
 * at 0.07 however small `tol` gets. That is the one failure mode that would make a
 * tolerance argument meaningless. So an interval is subdivided until the exact offset
 * points at its ends and its middle are collinear to within `tol`, which is the
 * condition under which nothing can be hiding between them, and the samples land where
 * the trace actually moves rather than at even spacing.
 * Refining the measurement grid is not flattening: no output coordinate comes from that grid.
 */
export function offsetError(
  src: Cubic,
  approx: Cubic[],
  d: number,
  tol: number
): { error: number; t: number } {
  const boxes = approx.map(boundsCubic);
  const worst = { error: 0, t: 0.5 };
  let budget = ERROR_BUDGET;
  const measure = (u: number): Pt | null => {
    const want = offsetPoint(src, u, d);
    if (!want) return null;
    if (u > 0 && u < 1) {
      const e = nearestOnChain(approx, want, boxes);
      if (e > worst.error) {
        worst.error = e;
        worst.t = u;
      }
    }
    return want;
  };
  const refine = (u0: number, u1: number, w0: Pt | null, w1: Pt | null, depth: number): void => {
    if (budget <= 0 || depth >= MAX_ERROR_DEPTH) return;
    budget--;
    const um = (u0 + u1) / 2;
    const wm = measure(um);
    if (!w0 || !w1 || !wm || sagitta(w0, wm, w1) <= tol) return;
    refine(u0, um, w0, wm, depth + 1);
    refine(um, u1, wm, w1, depth + 1);
  };
  let prev = measure(0);
  for (let i = 1; i <= ERROR_SAMPLES; i++) {
    const u = i / ERROR_SAMPLES;
    const here = measure(u);
    refine(u - 1 / ERROR_SAMPLES, u, prev, here, 0);
    prev = here;
  }
  return worst;
}

/** Nearest distance from a point to a chain of fitted pieces. Bounds are prepared once
 *  per verification pass. The box test runs first,
 *  because this runs once per measured sample against every piece of the chain, and a
 *  chain the fitter split fifteen ways would otherwise cost fifteen quintic solves per
 *  sample.
 *
 *  This used to run with a raised sample count, because the probe bracketed its answer
 *  on a grid, and 24 samples over a piece spanning a whole curvature feature stopped
 *  resolving the basins: the wrong one got refined, and the measurement over-reported,
 *  costing a split that was not needed. `nearestOnCubic` now solves the quintic
 *  outright, so there is no grid to size, and the over-reporting it was compensating
 *  for is gone. */
function nearestOnChain(chain: Cubic[], p: Pt, boxes: ReturnType<typeof boundsCubic>[]): number {
  let best = Infinity;
  for (let i = 0; i < chain.length; i++) {
    const k = chain[i]!;
    const b = boxes[i]!;
    const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1),
      dy = Math.max(b.y0 - p.y, 0, p.y - b.y1);
    if (pmath.hypot(dx, dy) >= best) continue;
    const e = nearestOnCubic(k, p.x, p.y).distance;
    if (e < best) best = e;
  }
  return best;
}

/** How far `m` stands off the chord `a`→`b`. Zero says the three are collinear, which is
 *  what licenses treating the run between them as resolved. */
function sagitta(a: Pt, m: Pt, b: Pt): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len = pmath.hypot(dx, dy);
  if (len < 1e-12) return pmath.hypot(m.x - a.x, m.y - a.y);
  return Math.abs((m.x - a.x) * dy - (m.y - a.y) * dx) / len;
}
