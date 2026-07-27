// SPDX-License-Identifier: MPL-2.0
/**
 * The authored-path seam (engine/src/geom/spline.ts), and mostly the `hyperbezier`
 * global solve.
 *
 * ## How these are checked
 *
 * Nothing here compares against a stored expected control point. A spline solver has one
 * property that matters — the curve is continuous where it says it is — and a golden file
 * of coordinates asserts only that the implementation still agrees with whatever it did
 * the day the file was written, including its bugs. So:
 *
 * 1. **Independent curvature.** Curvature at a join is measured from the EMITTED cubics
 *    with a Bernstein second derivative written out here, not with the solver's own
 *    arctan-curvature or its unit-frame shortcut (`ddot` is exactly 3·arm there, which is
 *    precisely the kind of shared simplification that hides a sign error). Two different
 *    formulae agreeing is evidence; one formula agreeing with itself is not.
 * 2. **Symmetry and equivariance.** Mirror the input, rotate it, translate it, scale it:
 *    the output must follow exactly. These need no tolerance argument at all beyond
 *    rounding, and rotation equivariance has caught a real bug in this kernel before.
 * 3. **Locality.** A corner is a claim about INDEPENDENCE, so it is tested by editing one
 *    side and asserting the other side's cubics are bit-identical.
 * 4. **Stated guarantees only.** Interpolation and G1 are exact by construction and are
 *    asserted tightly. G2 is what the solve converges to, so it is asserted relative to
 *    the curvature magnitude and cross-checked against the solver's own `converged` and
 *    `residual` flags — if the tolerance below ever needed loosening, the flag would have
 *    to be lying, and that is the real assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Cubic, evalCubic, tangentAt } from '../engine/src/geom/bezier.ts';
import {
  type Node, type AuthoredPath, type HyperbezierSolution,
  toCubics, solveHyperbezier, hyperbezierCubics, enforceContinuity,
} from '../engine/src/geom/spline.ts';

// ── independent measurement helpers ───────────────────────────────────────────

/** Second derivative of a cubic at `t`, from the Bernstein form. Deliberately a
 *  different expression from anything in spline.ts. */
function secondDeriv(c: Cubic, t: number): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: 6 * mt * (c[4] - 2 * c[2] + c[0]) + 6 * t * (c[6] - 2 * c[4] + c[2]),
    y: 6 * mt * (c[5] - 2 * c[3] + c[1]) + 6 * t * (c[7] - 2 * c[5] + c[3]),
  };
}

/** Signed curvature, (x'y'' − y'x'')/|r'|³. */
function curvature(c: Cubic, t: number): number {
  const d = tangentAt(c, t);
  const d2 = secondDeriv(c, t);
  const speed = Math.hypot(d.x, d.y);
  if (speed < 1e-12) return 0;
  return (d.x * d2.y - d.y * d2.x) / (speed * speed * speed);
}

/** Tangent direction as an angle, or null where there is no direction to read. */
function tangentAngle(c: Cubic, t: number): number | null {
  const d = tangentAt(c, t);
  if (Math.hypot(d.x, d.y) < 1e-12) return null;
  return Math.atan2(d.y, d.x);
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

function allFinite(cs: Cubic[]): boolean {
  return cs.every((c) => c.every((v) => Number.isFinite(v)));
}

function hb(nodes: Node[], closed = false): Cubic[] {
  return toCubics({ kind: 'hyperbezier', nodes, closed });
}

/** Every join of a lowered path, as (incoming cubic, outgoing cubic, node index). */
function joins(cs: Cubic[], closed: boolean): { a: Cubic; b: Cubic; at: number }[] {
  const out: { a: Cubic; b: Cubic; at: number }[] = [];
  for (let i = 0; i + 1 < cs.length; i++) out.push({ a: cs[i]!, b: cs[i + 1]!, at: i + 1 });
  if (closed && cs.length > 1) out.push({ a: cs[cs.length - 1]!, b: cs[0]!, at: 0 });
  return out;
}

const WAVE: Node[] = [
  { x: 0, y: 0 }, { x: 100, y: 80 }, { x: 200, y: 0 }, { x: 300, y: 120 }, { x: 400, y: 20 },
];
const BLOB: Node[] = [
  { x: 0, y: 0 }, { x: 120, y: 30 }, { x: 160, y: 140 }, { x: 40, y: 190 }, { x: -60, y: 90 },
];

// ── interpolation ─────────────────────────────────────────────────────────────

test('hyperbezier interpolates every node', () => {
  for (const [name, nodes, closed] of [
    ['open wave', WAVE, false],
    ['closed blob', BLOB, true],
    ['two nodes', WAVE.slice(0, 2), false],
    ['three nodes', WAVE.slice(0, 3), false],
  ] as [string, Node[], boolean][]) {
    const cs = hb(nodes, closed);
    assert.equal(cs.length, closed && nodes.length > 2 ? nodes.length : nodes.length - 1, name);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!;
      const start = evalCubic(c, 0), end = evalCubic(c, 1);
      const a = nodes[i]!, b = nodes[(i + 1) % nodes.length]!;
      // Exact, not approximate: the endpoints ARE the nodes, copied.
      assert.equal(start.x, a.x, `${name} seg ${i} start x`);
      assert.equal(start.y, a.y, `${name} seg ${i} start y`);
      assert.equal(end.x, b.x, `${name} seg ${i} end x`);
      assert.equal(end.y, b.y, `${name} seg ${i} end y`);
    }
  }
});

test('collinear nodes lower to the exact chord, controls at the thirds', () => {
  // The shape function returns exactly 1/3 at zero deflection, so this is an equality
  // rather than a tolerance. A straight run that bulges means the free-end condition or
  // the arm formula has picked up an offset.
  const cs = hb([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }]);
  assert.equal(cs.length, 3);
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]!;
    assert.equal(c[1], 0);
    assert.equal(c[3], 0);
    assert.equal(c[5], 0);
    assert.equal(c[7], 0);
    assert.ok(Math.abs(c[2] - (c[0] + 10 / 3)) < 1e-12, `seg ${i} arm 0`);
    assert.ok(Math.abs(c[4] - (c[0] + 20 / 3)) < 1e-12, `seg ${i} arm 1`);
  }
});

// ── continuity ────────────────────────────────────────────────────────────────

test('hyperbezier is G1 at every smooth join, to rounding', () => {
  for (const [name, nodes, closed] of [
    ['open wave', WAVE, false],
    ['closed blob', BLOB, true],
  ] as [string, Node[], boolean][]) {
    const sol = solveHyperbezier(nodes, closed);
    // G1 is exact only where no control arm has reversed, so the guarantee is asserted
    // alongside the condition it holds under rather than in spite of it.
    assert.equal(sol.reversals, 0, `${name} has no reversed arms`);
    const cs = hyperbezierCubics(nodes, closed, sol);
    for (const j of joins(cs, closed)) {
      const ta = tangentAngle(j.a, 1), tb = tangentAngle(j.b, 0);
      assert.ok(ta !== null && tb !== null, `${name} node ${j.at} has a tangent`);
      // Both sides read their angle from the SAME solved tangent, so this is only as
      // inexact as sin/cos round-tripping.
      assert.ok(angleDiff(ta, tb) < 1e-12, `${name} node ${j.at} G1: ${angleDiff(ta, tb)}`);
    }
  }
});

test('hyperbezier converges to G2, and says so', () => {
  for (const [name, nodes, closed] of [
    ['open wave', WAVE, false],
    ['closed blob', BLOB, true],
    ['tight zigzag', [{ x: 0, y: 0 }, { x: 20, y: 40 }, { x: 40, y: -30 }, { x: 60, y: 35 }, { x: 80, y: 0 }], false],
    ['uneven spacing', [{ x: 0, y: 0 }, { x: 5, y: 20 }, { x: 300, y: 40 }, { x: 310, y: -60 }], false],
  ] as [string, Node[], boolean][]) {
    const sol = solveHyperbezier(nodes, closed);
    // The flag is the real assertion: the tolerance below is only allowed to be as loose
    // as it is BECAUSE the solver claims convergence, and the claim is checkable.
    assert.ok(sol.converged, `${name} converged (residual ${sol.residual})`);
    assert.ok(sol.residual < 1e-10, `${name} residual ${sol.residual}`);
    const cs = hyperbezierCubics(nodes, closed, sol);
    for (const j of joins(cs, closed)) {
      const ka = curvature(j.a, 1), kb = curvature(j.b, 0);
      const scale = Math.max(Math.abs(ka), Math.abs(kb), 1e-9);
      // Relative, because the guarantee is a converged residual, not an absolute
      // curvature bound. Measured agreement across these four cases is 4e-13 to 3e-10
      // relative (the zigzag is the worst); 1e-7 keeps three orders of margin over that
      // while still failing by a mile if the solve ever stopped short.
      assert.ok(Math.abs(ka - kb) / scale < 1e-7, `${name} node ${j.at} G2: ${ka} vs ${kb}`);
    }
  }
});

test('closed paths wrap: the seam is no worse than any other join', () => {
  const sol = solveHyperbezier(BLOB, true);
  assert.ok(sol.converged);
  const cs = hyperbezierCubics(BLOB, true, sol);
  assert.equal(cs.length, BLOB.length);
  const rel: number[] = [];
  for (const j of joins(cs, true)) {
    const ka = curvature(j.a, 1), kb = curvature(j.b, 0);
    rel.push(Math.abs(ka - kb) / Math.max(Math.abs(ka), Math.abs(kb), 1e-9));
  }
  // The seam is the LAST entry (the wrap join at node 0). If the solve had been cut at
  // the seam and solved as an open run with free ends, this one would be orders of
  // magnitude worse than the rest rather than the same size.
  const seam = rel[rel.length - 1]!;
  const worstInterior = Math.max(...rel.slice(0, -1));
  assert.ok(seam < 1e-7, `seam G2 ${seam}`);
  assert.ok(seam <= Math.max(worstInterior, 1e-12) * 1e3, `seam ${seam} vs interior ${worstInterior}`);
});

test('a closed path has no privileged starting node', () => {
  // Rotating which node is listed first must give the same SHAPE, which for a genuinely
  // cyclic solve it does. (Cutting the loop at node 0 would make node 0 special.)
  const a = hyperbezierCubics(BLOB, true, solveHyperbezier(BLOB, true));
  const rotated = [...BLOB.slice(2), ...BLOB.slice(0, 2)];
  const b = hyperbezierCubics(rotated, true, solveHyperbezier(rotated, true));
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    const want = a[(i + 2) % a.length]!;
    const got = b[i]!;
    for (let k = 0; k < 8; k++) {
      assert.ok(Math.abs(want[k]! - got[k]!) < 1e-9, `seg ${i} coord ${k}: ${want[k]} vs ${got[k]}`);
    }
  }
});

// ── corners ───────────────────────────────────────────────────────────────────

test('a corner node produces a real tangent discontinuity', () => {
  const nodes: Node[] = [
    { x: 0, y: 0 }, { x: 60, y: 60 },
    { x: 120, y: 0, continuity: 'corner' },
    { x: 180, y: 60 }, { x: 240, y: 0 },
  ];
  const cs = hb(nodes);
  assert.equal(cs.length, 4);
  const before = tangentAngle(cs[1]!, 1), after = tangentAngle(cs[2]!, 0);
  assert.ok(before !== null && after !== null);
  // Not merely "not equal": a corner in a symmetric V must turn by a visible angle.
  assert.ok(angleDiff(before, after) > 0.5, `corner turn ${angleDiff(before, after)}`);
  // And the smooth joins either side of it are still smooth.
  for (const j of [{ a: cs[0]!, b: cs[1]! }, { a: cs[2]!, b: cs[3]! }]) {
    const ta = tangentAngle(j.a, 1), tb = tangentAngle(j.b, 0);
    assert.ok(ta !== null && tb !== null && angleDiff(ta, tb) < 1e-12);
  }
});

test('a corner does not leak influence across itself', () => {
  const base: Node[] = [
    { x: 0, y: 0 }, { x: 40, y: 50 }, { x: 90, y: 20 },
    { x: 140, y: 70, continuity: 'corner' },
    { x: 200, y: 10 }, { x: 260, y: 90 }, { x: 320, y: 30 },
  ];
  const moved = base.map((n, i) => (i === 1 ? { ...n, x: 35, y: 95 } : n));
  const a = hb(base);
  const b = hb(moved);
  assert.equal(a.length, 6);
  assert.equal(b.length, 6);
  // Segments 0..2 are before the corner and must change; 3..5 are after it and must be
  // BIT-identical. Exact equality is the point — "nearly the same" would mean the corner
  // is a strong coupling rather than no coupling.
  let changed = 0;
  for (let i = 0; i < 3; i++) if (a[i]!.some((v, k) => v !== b[i]![k]!)) changed++;
  assert.ok(changed > 0, 'the edited side actually moved');
  for (let i = 3; i < 6; i++) {
    assert.deepEqual(b[i], a[i], `segment ${i} across the corner must be untouched`);
  }
});

test('a corner in a closed path splits it into one open run', () => {
  const nodes: Node[] = BLOB.map((n, i) => (i === 2 ? { ...n, continuity: 'corner' } : n));
  const cs = hb(nodes, true);
  assert.equal(cs.length, nodes.length);
  assert.ok(allFinite(cs));
  const before = tangentAngle(cs[1]!, 1), after = tangentAngle(cs[2]!, 0);
  assert.ok(before !== null && after !== null);
  assert.ok(angleDiff(before, after) > 1e-3, 'the corner is a corner');
  // Every OTHER join, including the wrap, stays G1.
  for (const j of joins(cs, true)) {
    if (j.at === 2) continue;
    const ta = tangentAngle(j.a, 1), tb = tangentAngle(j.b, 0);
    assert.ok(ta !== null && tb !== null && angleDiff(ta, tb) < 1e-12, `node ${j.at}`);
  }
});

test('consecutive corners lower to straight segments', () => {
  const nodes: Node[] = [
    { x: 0, y: 0, continuity: 'corner' },
    { x: 50, y: 30, continuity: 'corner' },
    { x: 100, y: 0, continuity: 'corner' },
  ];
  const cs = hb(nodes);
  for (const c of cs) {
    // Controls on the chord at the thirds — the polyline case.
    assert.ok(Math.abs(c[2]! - (c[0]! + (c[6]! - c[0]!) / 3)) < 1e-12);
    assert.ok(Math.abs(c[3]! - (c[1]! + (c[7]! - c[1]!) / 3)) < 1e-12);
  }
});

// ── symmetry and equivariance ─────────────────────────────────────────────────

test('a mirror-symmetric input gives a mirror-symmetric output', () => {
  const nodes: Node[] = [
    { x: -200, y: 0 }, { x: -100, y: 90 }, { x: 0, y: 130 }, { x: 100, y: 90 }, { x: 200, y: 0 },
  ];
  const cs = hb(nodes);
  assert.equal(cs.length, 4);
  // Segment i mirrored in x, traversed backwards, must equal segment n−1−i.
  for (let i = 0; i < cs.length; i++) {
    // As number[] rather than the Cubic tuple: indexing a fixed-length tuple with a
    // computed index defeats TS's inference here.
    const c: readonly number[] = cs[i]!;
    const other: readonly number[] = cs[cs.length - 1 - i]!;
    for (let k = 0; k < 4; k++) {
      const wantX = -other[6 - 2 * k]!;
      const wantY = other[7 - 2 * k]!;
      assert.ok(Math.abs(c[2 * k]! - wantX) < 1e-9, `seg ${i} pt ${k} x: ${c[2 * k]} vs ${wantX}`);
      assert.ok(Math.abs(c[2 * k + 1]! - wantY) < 1e-9, `seg ${i} pt ${k} y: ${c[2 * k + 1]} vs ${wantY}`);
    }
  }
});

test('lowering is equivariant under rotation, translation and uniform scale', () => {
  for (const [name, nodes, closed] of [
    ['open wave', WAVE, false],
    ['closed blob', BLOB, true],
    ['with a corner', WAVE.map((n, i) => (i === 2 ? { ...n, continuity: 'corner' as const } : n)), false],
  ] as [string, Node[], boolean][]) {
    const plain = hb(nodes, closed);
    for (const [th, s, tx, ty] of [
      [0.7, 1, 13, -9], [-2.4, 3.5, -500, 800], [Math.PI / 2, 0.01, 0, 0],
    ] as [number, number, number, number][]) {
      const co = Math.cos(th) * s, si = Math.sin(th) * s;
      const xf = (x: number, y: number): [number, number] => [co * x - si * y + tx, si * x + co * y + ty];
      const moved = nodes.map((n) => {
        const [x, y] = xf(n.x, n.y);
        return { ...n, x, y };
      });
      const got = hb(moved, closed);
      assert.equal(got.length, plain.length, name);
      for (let i = 0; i < plain.length; i++) {
        for (let k = 0; k < 4; k++) {
          const [wx, wy] = xf(plain[i]![2 * k]!, plain[i]![2 * k + 1]!);
          const tol = 1e-9 * Math.max(1, Math.abs(wx), Math.abs(wy));
          assert.ok(Math.abs(got[i]![2 * k]! - wx) < tol, `${name} th=${th} seg ${i} pt ${k} x`);
          assert.ok(Math.abs(got[i]![2 * k + 1]! - wy) < tol, `${name} th=${th} seg ${i} pt ${k} y`);
        }
      }
    }
  }
});

// ── drag behaviour ────────────────────────────────────────────────────────────

test('a tiny nudge moves the output by a comparably tiny amount', () => {
  // The whole reason this curve was chosen over Spiro. A solver that flipped branch or
  // settled into a different basin would show up here as a jump of order the curve size
  // for a nudge of order 1e-6.
  for (const [name, nodes, closed] of [
    ['open wave', WAVE, false],
    ['closed blob', BLOB, true],
  ] as [string, Node[], boolean][]) {
    const base = hb(nodes, closed);
    for (const eps of [1e-6, 1e-4, 1e-2]) {
      for (let moveIx = 0; moveIx < nodes.length; moveIx++) {
        const nudged = nodes.map((n, i) => (i === moveIx ? { ...n, x: n.x + eps, y: n.y - eps } : n));
        const got = hb(nudged, closed);
        let worst = 0;
        for (let i = 0; i < base.length; i++) {
          for (let k = 0; k < 8; k++) worst = Math.max(worst, Math.abs(got[i]![k]! - base[i]![k]!));
        }
        // A Lipschitz bound. The curve is a smooth function of the nodes, so the
        // constant is O(1) — measured at 1.41 across every case here. A solver flip would
        // put this in the hundreds of thousands at eps = 1e-6, so the exact ceiling
        // hardly matters; 10 is close enough to the truth to also catch a merely bad
        // amplification.
        assert.ok(worst < 10 * eps, `${name} node ${moveIx} eps ${eps}: moved ${worst}`);
      }
    }
  }
});

test('a warm start reaches the same solution in fewer iterations', () => {
  const cold = solveHyperbezier(WAVE, false);
  assert.ok(cold.iterations > 0);
  const nudged = WAVE.map((n, i) => (i === 2 ? { ...n, y: n.y + 0.5 } : n));
  const fresh = solveHyperbezier(nudged, false);
  const warmed = solveHyperbezier(nudged, false, cold);
  assert.ok(warmed.converged);
  // Same answer, not merely a nearby one: both are converged solutions of the same
  // system, so they agree far more tightly than the tolerance.
  for (let i = 0; i < WAVE.length; i++) {
    assert.ok(Math.abs(warmed.rth[i]! - fresh.rth[i]!) < 1e-8, `node ${i} rth`);
  }
  assert.ok(warmed.iterations <= fresh.iterations, `warm ${warmed.iterations} vs cold ${fresh.iterations}`);
});

test('warm-starting from a mismatched solution is ignored, not trusted', () => {
  const stale = solveHyperbezier(WAVE, false);
  const longer = [...WAVE, { x: 500, y: 90 }];
  const got = solveHyperbezier(longer, false, stale);
  assert.ok(got.converged);
  assert.deepEqual(got.rth, solveHyperbezier(longer, false).rth);
  const nan = { ...stale, rth: stale.rth.map(() => Number.NaN) };
  const recovered = solveHyperbezier(WAVE, false, nan);
  assert.ok(recovered.converged);
  assert.ok(recovered.rth.every((v) => Number.isFinite(v)));
});

// ── authored handles pin tangents ─────────────────────────────────────────────

test('an authored handle pins the tangent direction and breaks the run', () => {
  // The pin is horizontal and both adjacent chords rise at ±34°, so the deflection stays
  // well inside the right angle past which the family reverses its arm (see `hbArm`).
  const nodes: Node[] = [
    { x: 0, y: 0 }, { x: 60, y: 40 },
    { x: 120, y: 0, continuity: 'smooth', hOutX: 30, hOutY: 0 },
    { x: 180, y: 40 }, { x: 240, y: 0 },
  ];
  const sol = solveHyperbezier(nodes, false);
  assert.ok(sol.converged);
  assert.equal(sol.reversals, 0);
  const cs = hyperbezierCubics(nodes, false, sol);
  // The pinned node's outgoing tangent must be horizontal, as authored — the handle's
  // LENGTH is the solve's business, only its direction is the user's.
  const th = tangentAngle(cs[2]!, 0);
  assert.ok(th !== null);
  assert.ok(angleDiff(th, 0) < 1e-9, `pinned tangent ${th}`);
  // Smooth continuity means the incoming side is pinned collinear with it.
  const thIn = tangentAngle(cs[1]!, 1);
  assert.ok(thIn !== null && angleDiff(thIn, 0) < 1e-9, `incoming ${thIn}`);
  // A pinned tangent forces a curvature break, so the mitigation aims both sides at one
  // blended target rather than leaving the raw mismatch.
  assert.ok(sol.kBlend[2] !== null, 'blend engaged at the pinned node');
  for (let i = 0; i < nodes.length; i++) {
    if (i !== 2) assert.equal(sol.kBlend[i], null, `no blend at node ${i}`);
  }
  assert.ok(allFinite(cs));
});

test('a pinned tangent is also a run boundary: no leak across it', () => {
  const base: Node[] = [
    { x: 0, y: 0 }, { x: 40, y: 50 }, { x: 90, y: 20 },
    { x: 140, y: 70, hOutX: 40, hOutY: 0 },
    { x: 200, y: 10 }, { x: 260, y: 90 },
  ];
  const moved = base.map((n, i) => (i === 4 ? { ...n, y: -40 } : n));
  const a = hb(base);
  const b = hb(moved);
  // Only the far side moved, so segments 0..1 must be identical. Segment 2 arrives at
  // the pinned node and is allowed to move: the curvature BLEND at that node reads both
  // sides deliberately. That is the documented one-node-wide exception, and stating it
  // here is the point of the test.
  for (let i = 0; i < 2; i++) assert.deepEqual(b[i], a[i], `segment ${i}`);
});

test('a corner with independent handles keeps them independent', () => {
  const nodes: Node[] = [
    { x: 0, y: 0 }, { x: 50, y: 50 },
    { x: 100, y: 0, continuity: 'corner', hInX: -20, hInY: 20, hOutX: 20, hOutY: 0 },
    { x: 150, y: 50 }, { x: 200, y: 0 },
  ];
  const sol = solveHyperbezier(nodes, false);
  assert.equal(sol.reversals, 0);
  const cs = hyperbezierCubics(nodes, false, sol);
  const inTh = tangentAngle(cs[1]!, 1), outTh = tangentAngle(cs[2]!, 0);
  assert.ok(inTh !== null && outTh !== null);
  // hIn points back towards the previous node, so travelling THROUGH the node is its
  // reverse: (20, −20) → −45°. hOut is (20, 0) → 0°. Two different angles at one node is
  // the whole point of a corner, and neither may be substituted for the other.
  assert.ok(angleDiff(inTh, -Math.PI / 4) < 1e-9, `in ${inTh}`);
  assert.ok(angleDiff(outTh, 0) < 1e-9, `out ${outTh}`);
  // No blend at a corner: the two sides have no curvature relationship to reconcile.
  assert.ok(sol.kBlend.every((v) => v === null));
});

test('a tangent pinned past a right angle reverses, and is reported', () => {
  // The family's stated limit. `hbArm` goes negative past a right angle of deflection, so
  // the arm points back and the join is a cusp. What must NOT happen is silence: the
  // count is the contract, and the output still has to be finite and bounded.
  const nodes: Node[] = [
    { x: 0, y: 0 }, { x: 60, y: 40 },
    { x: 120, y: 0, continuity: 'smooth', hOutX: 0, hOutY: -30 },
    { x: 180, y: 40 }, { x: 240, y: 0 },
  ];
  const sol = solveHyperbezier(nodes, false);
  assert.ok(sol.reversals > 0, 'the reversal is reported');
  const cs = hyperbezierCubics(nodes, false, sol);
  assert.ok(allFinite(cs));
  for (const c of cs) {
    const chord = Math.hypot(c[6]! - c[0]!, c[7]! - c[1]!);
    // chord/3 is the family's own bound; the pinned node also engages the curvature
    // blend, whose clamp permits twice that. So 2/3 of a chord is the composed bound,
    // and it is the one a caller can rely on for a bounding box.
    const bound = (2 / 3) * chord + 1e-9;
    assert.ok(Math.hypot(c[2]! - c[0]!, c[3]! - c[1]!) <= bound, 'start arm bounded');
    assert.ok(Math.hypot(c[4]! - c[6]!, c[5]! - c[7]!) <= bound, 'end arm bounded');
  }
});

// ── degenerate input ──────────────────────────────────────────────────────────

test('degenerate inputs return something sane, never NaN', () => {
  const cases: [string, Node[], boolean][] = [
    ['empty', [], false],
    ['empty closed', [], true],
    ['one node', [{ x: 5, y: 5 }], false],
    ['one node closed', [{ x: 5, y: 5 }], true],
    ['two nodes', [{ x: 0, y: 0 }, { x: 1, y: 1 }], false],
    ['two nodes closed', [{ x: 0, y: 0 }, { x: 1, y: 1 }], true],
    ['all coincident', [{ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 3 }], false],
    ['all coincident closed', [{ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 3 }], true],
    ['one coincident pair', [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 50, y: 50 }, { x: 100, y: 0 }], false],
    ['collinear', [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], false],
    ['collinear closed', [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], true],
    ['collinear doubling back', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 20, y: 0 }], false],
    ['exact reversal', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }], false],
    ['huge coordinates', [{ x: 0, y: 0 }, { x: 1e9, y: 1e9 }, { x: 2e9, y: -1e9 }], false],
    ['tiny coordinates', [{ x: 0, y: 0 }, { x: 1e-9, y: 1e-9 }, { x: 2e-9, y: -1e-9 }], false],
    ['wild spacing', [{ x: 0, y: 0 }, { x: 1e-6, y: 1e-6 }, { x: 1e6, y: 1e-6 }, { x: 1e6, y: 1e6 }], false],
    ['all corners', [{ x: 0, y: 0, continuity: 'corner' }, { x: 1, y: 9, continuity: 'corner' }, { x: 4, y: 2, continuity: 'corner' }], true],
    ['zero-length handles', [{ x: 0, y: 0, hOutX: 0, hOutY: 0 }, { x: 9, y: 9 }, { x: 18, y: 0, hInX: 0, hInY: 0 }], false],
  ];
  for (const [name, nodes, closed] of cases) {
    const sol = solveHyperbezier(nodes, closed);
    assert.ok(sol.rth.every((v) => Number.isFinite(v)), `${name} rth finite`);
    assert.ok(sol.lth.every((v) => Number.isFinite(v)), `${name} lth finite`);
    assert.ok(Number.isFinite(sol.residual), `${name} residual finite`);
    const cs = hyperbezierCubics(nodes, closed, sol);
    assert.ok(allFinite(cs), `${name} cubics finite: ${JSON.stringify(cs)}`);
    // And the same through the public entry point.
    assert.ok(allFinite(hb(nodes, closed)), `${name} via toCubics`);
    // Nothing may escape the neighbourhood of its own polygon. The arm formula is
    // bounded by a third of a chord and the blend clamp doubles that at worst, so 2/3 of
    // a chord is a real bound and not a generous one — an unstuck frame mapping or an
    // unclamped blend breaks it by orders of magnitude, not by a few percent.
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!;
      const chord = Math.hypot(c[6]! - c[0]!, c[7]! - c[1]!);
      const bound = (2 / 3) * chord + 1e-9 * Math.max(1, Math.abs(c[0]!), Math.abs(c[1]!));
      assert.ok(Math.hypot(c[2]! - c[0]!, c[3]! - c[1]!) <= bound, `${name} seg ${i} start arm`);
      assert.ok(Math.hypot(c[4]! - c[6]!, c[5]! - c[7]!) <= bound, `${name} seg ${i} end arm`);
    }
  }
});

test('a very large node count stays bounded and finite', () => {
  const n = 2000;
  const nodes: Node[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push({ x: i * 3, y: 40 * Math.sin(i * 0.31) + (i % 7 === 0 ? 25 : 0) });
  }
  const started = Date.now();
  const sol = solveHyperbezier(nodes, false);
  const cs = hyperbezierCubics(nodes, false, sol);
  const elapsed = Date.now() - started;
  assert.equal(cs.length, n - 1);
  assert.ok(allFinite(cs));
  assert.ok(sol.converged, `residual ${sol.residual}`);
  // O(n) per Newton step and a capped iteration count, so 2000 nodes is milliseconds.
  // A generous ceiling: this is a "did the solve go quadratic" guard, not a benchmark.
  assert.ok(elapsed < 4000, `${n} nodes took ${elapsed}ms`);
  const closed = solveHyperbezier(nodes, true);
  assert.ok(allFinite(hyperbezierCubics(nodes, true, closed)));
});

test('a path of every continuity kind at once still lowers cleanly', () => {
  const nodes: Node[] = [
    { x: 0, y: 0, continuity: 'symmetric' },
    { x: 50, y: 60, continuity: 'smooth' },
    { x: 110, y: 10, continuity: 'corner' },
    { x: 170, y: 80, continuity: 'symmetric', hOutX: 10, hOutY: 10 },
    { x: 230, y: 20 },
    { x: 290, y: 90, continuity: 'corner', hInX: -10, hInY: 0 },
    { x: 350, y: 30 },
  ];
  for (const closed of [false, true]) {
    const sol = solveHyperbezier(nodes, closed);
    const cs = hyperbezierCubics(nodes, closed, sol);
    assert.ok(allFinite(cs), `closed=${closed}`);
    assert.equal(cs.length, closed ? nodes.length : nodes.length - 1);
    for (let i = 0; i < cs.length; i++) {
      assert.equal(cs[i]![0], nodes[i]!.x);
      assert.equal(cs[i]![1], nodes[i]!.y);
    }
  }
});

// ── the rest of the seam is untouched ─────────────────────────────────────────

test('the other spline kinds lower unchanged', () => {
  const nodes: Node[] = [
    { x: 0, y: 0, hOutX: 10, hOutY: 20 },
    { x: 100, y: 100, hInX: -10, hInY: -20, hOutX: 10, hOutY: 20 },
    { x: 200, y: 0, hInX: -10, hInY: 20 },
  ];
  assert.deepEqual(toCubics({ kind: 'line', nodes, closed: false }), [
    [0, 0, 100 / 3, 100 / 3, 200 / 3, 200 / 3, 100, 100],
    [100, 100, 100 + 100 / 3, 100 - 100 / 3, 100 + 200 / 3, 100 - 200 / 3, 200, 0],
  ]);
  assert.deepEqual(toCubics({ kind: 'cubic', nodes, closed: false }), [
    [0, 0, 10, 20, 90, 80, 100, 100],
    [100, 100, 110, 120, 190, 20, 200, 0],
  ]);
  // Catmull-Rom interpolates its nodes; B-spline does not. Both are closed-form
  // conversions, so all this needs to assert is that they still run and still differ.
  const cr = toCubics({ kind: 'catmull-rom', nodes, closed: false });
  assert.equal(cr.length, 2);
  assert.equal(cr[0]![0], 0);
  assert.equal(cr[1]![6], 200);
  const bs = toCubics({ kind: 'bspline', nodes: [...nodes, { x: 300, y: 100 }], closed: false });
  assert.equal(bs.length, 1);
  assert.notEqual(bs[0]![0], 0);
  for (const kind of ['line', 'cubic', 'catmull-rom', 'bspline', 'hyperbezier'] as const) {
    assert.deepEqual(toCubics({ kind, nodes: nodes.slice(0, 1), closed: false }), []);
  }
});

test('spiro is still declared and still refuses, and an unknown kind is distinguishable', () => {
  const nodes: Node[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
  assert.throws(() => toCubics({ kind: 'spiro', nodes, closed: false }), /not implemented/);
  assert.throws(
    () => toCubics({ kind: 'nonsense' as AuthoredPath['kind'], nodes, closed: false }),
    /unknown spline kind/,
  );
});

test('enforceContinuity is unaffected by the new kind', () => {
  const sym = enforceContinuity({ x: 0, y: 0, continuity: 'symmetric', hInX: 3, hInY: 4, hOutX: 99, hOutY: 99 }, 'in');
  assert.equal(sym.hOutX, -3);
  assert.equal(sym.hOutY, -4);
  const corner = enforceContinuity({ x: 0, y: 0, continuity: 'corner', hInX: 3, hInY: 4, hOutX: 9, hOutY: 9 }, 'in');
  assert.equal(corner.hOutX, 9);
});

test('the solution round-trips through hyperbezierCubics deterministically', () => {
  const sol: HyperbezierSolution = solveHyperbezier(WAVE, false);
  const a = hyperbezierCubics(WAVE, false, sol);
  const b = hyperbezierCubics(WAVE, false, sol);
  assert.deepEqual(a, b);
  assert.deepEqual(a, toCubics({ kind: 'hyperbezier', nodes: WAVE, closed: false }));
});
