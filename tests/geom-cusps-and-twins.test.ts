// SPDX-License-Identifier: MPL-2.0
/**
 * Crossings at a cusp, and boundaries that a boolean has to decide twice.
 *
 * The fourth review of engine/src/geom/intersect.ts found that the scan still lost the
 * crossing where two curves meet at a cusp, and that a boolean came apart on stacks of
 * near-copies. The causes were four, and each case below pins one of them:
 *
 * 1. The projection used to read which side of one curve the other is on was wrong near a
 *    tight turn: the root solve behind it exits on a flat polynomial VALUE while its root
 *    is still 3e-6 away in PARAMETER, so a point ON both curves measured 5e-8 off one of
 *    them and was refused. `nearest` now polishes every projection with Newton on the
 *    geometric condition itself.
 * 2. The sign of the gap flips across a cusp of the curve projected onto, because the left
 *    normal follows the direction of travel. The samples of a zone are now oriented against
 *    each other first, and a sign is read only at a proper foot.
 * 3. Inside a zone where two curves stay within the tolerance of each other the sampled
 *    gaps are rounding noise, and reading a crossing at every change of sign produced five
 *    where there was one. A zone is now certified by parity from its two ends, which lie
 *    outside it, and one contact is reported.
 * 4. `cubicRoots01` returned NO root for a cubic whose leading coefficient is a billionth
 *    of the others, which is exactly what a 1e-9 copy of a symmetric curve gives against a
 *    horizontal line. The ray a boolean casts to decide a piece never saw the copy. Such a
 *    cubic is now solved by isolating its roots between its critical points.
 *
 * Two contract changes come with them, and are pinned here as well: one contact per zone
 * where the curves stay within the tolerance of each other, plus the two ends of a zone
 * longer than a thousandth of the pair's size; and nothing is folded, so a crossing is
 * reported where it is rather than moved onto a touch or a vertex beside it.
 *
 * Section 6 holds the four the repair after that had to answer for, each one a case where a
 * test was read at its bare value while the numbers going into it carried rounding: a closed
 * band measured against the weld radius and deleted, a root isolated over [0, 1] when the
 * root sat a rounding error outside it, a clip's box and band levels read without the
 * rounding deep subdivision leaves on a piece, and a point emitted from two pieces that had
 * not been measured against each other.
 *
 * The regions: A is below a base curve, down to a line; B is above a near-copy of it, up
 * to another line. Both are written out in full, every coordinate at 17 significant
 * digits, so a case reproduces whatever builds them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import type { GeomContour, GeomPathResult, GeomResult } from '../packages/core/src/host-v1.ts';
import { type Cubic, evalCubic, nearestOnCubic } from '../engine/src/geom/bezier.ts';
import { CLIP_BUDGET, cubicRoots01, intersectCubics, intersectLineCubic } from '../engine/src/geom/intersect.ts';

/**
 * Run `f` with the clip budget at zero, so every cubic against cubic pair is answered by the
 * overrun search rather than by the clip search.
 *
 * The cases wrapped in this are ones the clip search finishes inside `CLIP_BUDGET.maxNodes`
 * on, so what SHIPS for them is the clip search's answer, which is what it always was. What
 * they pin is the overrun search's promise, which the shipped build keeps for the pairs that
 * do cross the budget. Each case says above it what the shipped answer is instead.
 */
function overrunOnly<T>(f: () => T): T {
  const was = CLIP_BUDGET.maxNodes;
  CLIP_BUDGET.maxNodes = 0;
  try { return f(); } finally { CLIP_BUDGET.maxNodes = was; }
}


const geom = makeGeomApi();
const EXACT = { decimals: 12 } as const;

function pathOf(r: GeomPathResult, what: string): string {
  assert.ok(r.ok, `${what}: expected ok, got ${r.ok ? '' : `${r.code} - ${r.message}`}`);
  return r.d;
}

function val<T>(r: GeomResult<T>, what: string): T {
  assert.ok(r.ok, `${what}: expected ok, got ${r.ok ? '' : `${r.code} - ${r.message}`}`);
  return r.value;
}

const area = (d: string) => (d === '' ? 0 : Math.abs(val(geom.area(d), 'area')));
const parsed = (d: string): GeomContour[] => (d === '' ? [] : val(geom.parse(d), 'parse'));

/** Hits in both orders, each as [t on the first-named curve, t on the second]. */
function bothOrders(c1: Cubic, c2: Cubic): { name: string; hits: [number, number][] }[] {
  return [
    { name: 'c1 x c2', hits: intersectCubics(c1, c2).map((h): [number, number] => [h.t1, h.t2]) },
    { name: 'c2 x c1', hits: intersectCubics(c2, c1).map((h): [number, number] => [h.t2, h.t1]) },
  ];
}

/** How far a hit is from the curve it is furthest from. Every hit must be on both. */
const onBoth = (c1: Cubic, c2: Cubic, [t1, t2]: [number, number]): number => {
  const p = evalCubic(c1, t1), q = evalCubic(c2, t2);
  return Math.max(nearestOnCubic(c2, p.x, p.y).distance, nearestOnCubic(c1, q.x, q.y).distance);
};

/**
 * The distance between the two points a hit names, one on each curve.
 *
 * Used instead of `onBoth` at a cusp, because `nearestOnCubic` is the routine whose error
 * at a near-stationary point this file is about: at the apex of the cusp pair below it
 * answers 1.1e-7 for a point the two curves share exactly. The parameters a hit carries are
 * the answer, so comparing the points they name asks the question directly.
 */
const agrees = (c1: Cubic, c2: Cubic, [t1, t2]: [number, number]): number => {
  const p = evalCubic(c1, t1), q = evalCubic(c2, t2);
  return Math.hypot(p.x - q.x, p.y - q.y);
};

/** Areas of the self-union and the four booleans of A and B. */
function areas(A: string, B: string): Record<string, number> {
  const out: Record<string, number> = { selfUnion: area(pathOf(geom.selfUnion(`${A} ${B}`, EXACT), 'selfUnion')) };
  for (const op of ['union', 'intersect', 'difference', 'xor'] as const) {
    out[op] = area(pathOf(geom[op]([A, B], EXACT), op));
  }
  return out;
}

/** Every area within `slack` of what it should be. */
function assertAreas(got: Record<string, number>, want: Record<string, number>, slack: number, what: string): void {
  for (const [op, v] of Object.entries(want)) {
    assert.ok(Math.abs(got[op]! - v) <= slack, `${what}, ${op}: area ${got[op]}, expected ${v}`);
  }
}

/**
 * The walk snaps every join, so the pieces of a contour meet EXACTLY, not within the weld
 * radius. Every consumer reads the output as a chain, and a gap of a billionth is still a
 * gap. Checked on every result these tests produce.
 */
function assertChainedExactly(d: string, what: string): void {
  for (const [ci, c] of parsed(d).entries()) {
    assert.ok(c.curves.length > 0, `${what}: contour ${ci} has no curves`);
    for (let i = 1; i < c.curves.length; i++) {
      const a = c.curves[i - 1]!, b = c.curves[i]!;
      assert.equal(b[0], a[6], `${what}: contour ${ci} breaks in x between curves ${i - 1} and ${i}`);
      assert.equal(b[1], a[7], `${what}: contour ${ci} breaks in y between curves ${i - 1} and ${i}`);
    }
    if (c.closed) {
      const first = c.curves[0]!, last = c.curves[c.curves.length - 1]!;
      assert.equal(last[6], first[0], `${what}: contour ${ci} does not close in x`);
      assert.equal(last[7], first[1], `${what}: contour ${ci} does not close in y`);
    }
  }
}

/** Every result of every boolean of A and B is a chain that closes. */
function assertAllChained(A: string, B: string, what: string): void {
  assertChainedExactly(pathOf(geom.selfUnion(`${A} ${B}`, EXACT), 'selfUnion'), `${what}, selfUnion`);
  for (const op of ['union', 'intersect', 'difference', 'xor'] as const) {
    assertChainedExactly(pathOf(geom[op]([A, B], EXACT), op), `${what}, ${op}`);
  }
}

/**
 * Winding number of a path from each curve flattened to 600 chords, deliberately not the
 * module's own winding test: an oracle that shares code with what it checks proves nothing.
 */
function filler(d: string): (x: number, y: number) => boolean {
  const polys = parsed(d).map((c) => {
    const pts: number[] = [];
    for (const k of c.curves) for (let i = 0; i < 600; i++) {
      const p = evalCubic([...k] as Cubic, i / 600);
      pts.push(p.x, p.y);
    }
    const last = c.curves[c.curves.length - 1]!;
    pts.push(last[6]!, last[7]!);
    return pts;
  });
  return (x, y) => {
    let w = 0;
    for (const pts of polys) {
      const m = pts.length / 2;
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m;
        const x0 = pts[2 * i]!, y0 = pts[2 * i + 1]!, x1 = pts[2 * j]!, y1 = pts[2 * j + 1]!;
        const side = (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0);
        if (y0 <= y && y1 > y && side > 0) w++;
        else if (y0 > y && y1 <= y && side < 0) w--;
      }
    }
    return w !== 0;
  };
}

/** Distance to the nearest point of a path's outline. */
function distanceTo(d: string): (x: number, y: number) => number {
  const curves = parsed(d).flatMap((c) => c.curves.map((k) => [...k] as Cubic));
  return (x, y) => Math.min(...curves.map((k) => nearestOnCubic(k, x, y).distance));
}

/**
 * Membership of every boolean of A and B against the region algebra, on a grid, skipping
 * points within `margin` of either operand's outline: nearer than that the flattening error
 * and the answer are the same size.
 */
function assertRegions(
  A: string, B: string, box: [number, number, number, number], margin: number, what: string,
): number {
  const inA = filler(A), inB = filler(B);
  const nearA = distanceTo(A), nearB = distanceTo(B);
  const rules: Record<string, (a: boolean, b: boolean) => boolean> = {
    selfUnion: (a, b) => a || b, union: (a, b) => a || b, intersect: (a, b) => a && b,
    difference: (a, b) => a && !b, xor: (a, b) => a !== b,
  };
  const got: Record<string, (x: number, y: number) => boolean> = {
    selfUnion: filler(pathOf(geom.selfUnion(`${A} ${B}`, EXACT), 'selfUnion')),
  };
  for (const op of ['union', 'intersect', 'difference', 'xor'] as const) {
    got[op] = filler(pathOf(geom[op]([A, B], EXACT), op));
  }
  const [x0, y0, x1, y1] = box;
  let checked = 0;
  for (let i = 0; i <= 24; i++) {
    for (let j = 0; j <= 24; j++) {
      const x = x0 + ((x1 - x0) * i) / 24 + 1.7e-9, y = y0 + ((y1 - y0) * j) / 24 + 3.1e-9;
      if (nearA(x, y) < margin || nearB(x, y) < margin) continue;
      const a = inA(x, y), b = inB(x, y);
      for (const [op, rule] of Object.entries(rules)) {
        assert.equal(got[op]!(x, y), rule(a, b), `${what}, ${op} at (${x}, ${y})`);
      }
      checked++;
    }
  }
  return checked;
}

// ── 1. a crossing at a cusp ───────────────────────────────────────────────────

test('the crossing where two cusp curves meet is found in both orders', () => overrunOnly(() => {
  // Under the shipped budget this pair finishes in the clip search, which reports the one
  // contact three times, at 0.49999, 0.49999 and 0.49999. The boolean welds those together.
  // The symmetric cusp [0, 0, L, L, 0, L, L, 0] has C'(0.5) = 0, and the copy is moved
  // along y by a hundredth. The projection onto a curve with no speed is where the root
  // solve behind `nearestOnCubic` stops short, so the crossing at the apex measured 2.8e-8
  // off one of the curves and was refused. The search before the scan reported it three
  // times, at 0.49999, and its boolean lost 1500 of 15000.
  const c1: Cubic = [0, 0, 100, 100, 0, 100, 100, 0];
  const c2: Cubic = [0, -0.01, 100, 100 - 0.01 / 3, 0, 100 + 0.01 / 3, 100, 0.01];
  for (const { name, hits } of bothOrders(c1, c2)) {
    const what = `${name}: ${JSON.stringify(hits)}`;
    assert.equal(hits.length, 1, what);
    assert.ok(Math.abs(hits[0]![0] - 0.5) < 1e-4, what);
    assert.ok(Math.abs(hits[0]![1] - 0.5) < 1e-4, what);
    assert.ok(agrees(c1, c2, hits[0]!) <= 1e-9 * 100, `the two points differ, ${what}`);
  }
  const A = 'M0 0 C100 100 0 100 100 0 L100 -30 L0 -30 Z';
  const B = 'M0 -0.01 C100 99.99666666666667 0 100.00333333333333 100 0.01 L100 120 L0 120 Z';
  // A fills 6000 and B 9000, and they overlap by the sliver the copy opens at the apex.
  assertAreas(areas(A, B), {
    selfUnion: 14999.25, union: 14999.625, intersect: 0.375, difference: 5999.625, xor: 14999.25,
  }, 0.01, 'cusp copy');
  assertAllChained(A, B, 'cusp copy');
}));

test('a cusp crossed at a triple root, sideways, is one point', () => overrunOnly(() => {
  // Under the shipped budget the clip search answers, with five points spread over 0.49993
  // to 0.49995, all inside one weld radius of the apex.
  // The copy is moved along x, by a cubic with a triple root at the apex, so the two curves
  // agree to third order there: the gap is 1e-9 over a hundredth of the curve, and the clip
  // closes on points anywhere in that stretch. The search before the scan reported five.
  // The window is the run, not a point. Measured on these two curves: the stretch where they
  // stay within the default tolerance of each other runs from 0.4998 to 0.5002, and within
  // the 1e-6 this test accepts a hit on both curves at, from 0.495 to 0.505. Every parameter
  // in that stretch is a closest approach at the tolerance asked for, so which one comes back
  // depends on which samples the scan took: one order reports 0.5000007, the middle of the
  // run, the other 0.4998082, where a readable change of sign was narrowed at the run's edge.
  // Both are the same contact at this tolerance and the boolean cuts within the weld radius
  // of the apex either way. Pinning one of them would pin the sampling, not the answer.
  const c1: Cubic = [0, 0, 1000, 1000, 0, 1000, 1000, 0];
  const c2: Cubic = [-1, 0, 1001, 1000, -1, 1000, 1001, 0];
  for (const { name, hits } of bothOrders(c1, c2)) {
    const what = `${name}: ${JSON.stringify(hits)}`;
    assert.equal(hits.length, 1, what);
    assert.ok(Math.abs(hits[0]![0] - 0.5) < 1e-3 && Math.abs(hits[0]![1] - 0.5) < 1e-3, what);
    assert.ok(onBoth(c1, c2, hits[0]!) <= 1e-9 * 1000, `not on both curves, ${what}`);
    assert.ok(agrees(c1, c2, hits[0]!) <= 1e-9 * 1000, `the two points differ, ${what}`);
  }
}));

// ── 2. zones, their ends, and nothing folded ──────────────────────────────────

test('a pair that crosses four times far from the origin reports all four', () => overrunOnly(() => {
  // Under the shipped budget the clip search answers, and reports ONE of the four, at 0.508.
  // Losing the other three to a band padded by a fixed 1e-12 is a committed defect this
  // change fixes only past the budget.
  // The cusp of the test above, offset along (0.6, 0.8) by a cubic with roots at 0.3 and
  // 0.31, then turned by 1.1 radians and moved to (3700, -1100). The fat-line clip padded
  // its band by a fixed 1e-12; at these coordinates the control distances carry 3e-12 of
  // rounding, so the clip threw away the range holding the crossing at 0.508. The pad is
  // now the rounding noise of the coordinates in play.
  const K1: Cubic = [
    3700, -1100, 3656.238876136414, -965.5196518512987,
    3610.8792639938565, -1054.6403878574422, 3745.3596121425576, -1010.8792639938565,
  ];
  const K2: Cubic = [
    3699.99915123884, -1099.998271699335, 3656.239883089618, -965.5217022725179,
    3610.8790845067297, -1054.6400223745059, 3745.355204060406, -1010.8702879807247,
  ];
  for (const { name, hits } of bothOrders(K1, K2)) {
    const what = `${name}: ${JSON.stringify(hits)}`;
    assert.equal(hits.length, 4, what);
    for (const [k, want] of [0.125, 0.3, 0.31, 0.508].entries()) {
      assert.ok(Math.abs(hits[k]![0] - want) < 1e-3, `${what}: hit ${k} is not at ${want}`);
    }
    for (const h of hits) assert.ok(onBoth(K1, K2, h) <= 1e-9 * 4000, `not on both curves, ${what}`);
  }
}));

test('a touch beside two crossings is reported beside them, not instead of them', () => {
  // A touch at 0.46 and crossings at 0.48 and 0.50, all inside one stretch where the two
  // curves stay within the tolerance of each other. The fold that moved a crossing onto a
  // touch beside it is gone: all three come back where they are, and the stretch reports
  // its two ends as well.
  const c1: Cubic = [0, 0, 3, 3, 7, 3, 10, 0];
  const c2: Cubic = [-0.06698322253877806, 0, 3.0766100383384334, 3, 6.912440645773979, 3, 10.1, 0];
  for (const { name, hits } of bothOrders(c1, c2)) {
    const what = `${name}: ${JSON.stringify(hits)}`;
    assert.ok(hits.some(([t1]) => Math.abs(t1 - 0.46) < 1e-3), `no touch, ${what}`);
    assert.ok(hits.some(([t1]) => Math.abs(t1 - 0.48) < 1e-6), `no crossing at 0.48, ${what}`);
    assert.ok(hits.some(([t1]) => Math.abs(t1 - 0.5) < 1e-5), `no crossing at 0.50, ${what}`);
    for (const h of hits) assert.ok(onBoth(c1, c2, h) <= 1e-8, `not on both curves, ${what}`);
  }
});

test('two curves meeting at one weld radius keep the self-union whole', () => {
  // A triple root at 0.1 on a unit-sized pair: the two curves run within the boolean's weld
  // radius of each other over the first tenth. The walk used to join ends at exactly that
  // radius, and a pair built to sit on it came out one unit in the last place outside.
  const A = 'M0 0 C0.3 0.3 0.7 0.3 1 0 L1 -0.3 L0 -0.3 Z';
  const B = 'M0 -1.0000000000000002e-7 C0.3 0.3000009 0.7 0.2999919 1 0.0000729 L1 0.5 L0 0.5 Z';
  const got = areas(A, B);
  assertAreas(got, { selfUnion: 0.799984, union: 0.799984, difference: 0.453 }, 1e-6, 'weld border');
  assert.ok(got.intersect! < 1e-6, `weld border, intersect: area ${got.intersect}`);
  assert.equal(parsed(pathOf(geom.selfUnion(`${A} ${B}`, EXACT), 'selfUnion')).length, 1,
    'the self-union is one contour');
  assertAllChained(A, B, 'weld border');
});

test('a piece whose copies lie one decision radius apart is decided the same way twice', () => {
  // The copy meets the base at a touch and a crossing, and past both the two run 1e-9 of
  // the size apart: the radius within which the boolean counts another boundary as passing
  // through the point it decides a piece at. One copy was counted as a shared boundary and
  // the other was not, and the self-union lost half its area. The ray now looks behind its
  // origin as well as ahead, so both copies see each other.
  const A = 'M0 0 C3 3 7 3 10 0 L10 -3 L0 -3 Z';
  const B = 'M0 -0.0000020665593129361243 C3 3.00000066499672 7 2.999999786286555 10 6.858710562414266e-8 L10 5 L0 5 Z';
  for (const [first, second, what] of [[A, B, 'A then B'], [B, A, 'B then A']] as const) {
    const got = areas(first, second);
    assertAreas(got, { union: 80, selfUnion: 79.999996, xor: 79.999996 }, 1e-4, what);
    assert.ok(got.intersect! < 1e-4, `${what}, intersect: area ${got.intersect}`);
    assertAllChained(first, second, what);
  }
  assertAreas(areas(A, B), { difference: 45.299996 }, 1e-4, 'A then B');
  assertAreas(areas(B, A), { difference: 34.699999 }, 1e-4, 'B then A');
});

// ── 3. a piece decided off a stationary midpoint ──────────────────────────────

test('a cusp curve is decided away from its apex', () => overrunOnly(() => {
  // The areas here are the overrun search's. Under the shipped budget the triple-root union
  // comes out 14999.7786 where this asks for 14999.75, a sliver of 0.03 at the apex.
  // Once the intersector stops scattering hits along a cusp curve, the whole curve reaches
  // the boolean's side test as one piece, and the symmetric cusp's tangent vanishes at
  // exactly the midpoint the test used. The two copies were decided differently there.
  const simple = {
    A: 'M0 0 C1 1 0 1 1 0 L1 -0.3 L0 -0.3 Z',
    B: 'M0 -0.001 C1 0.9996666666666667 0 1.0003333333333333 1 0.001 L1 1.2 L0 1.2 Z',
    want: { union: 1.499625, intersect: 0.000375, selfUnion: 1.49925 },
    slack: 1e-5,
  };
  // The same, at a triple root, a hundred times the size and in a turned frame.
  const triple = {
    A: 'M3700 -1100 C3656.238876136414 -965.5196518512987 3610.8792639938565 -1054.6403878574422 3745.3596121425576 -1010.8792639938565 L3772.0958329444006 -1024.4871476366238 L3726.736220801843 -1113.6078836427673 Z',
    B: 'M3700.0089120736006 -1100.0045359612143 C3656.2299640628135 -965.5151158900844 3610.888176067457 -1054.6449238186565 3745.350700068957 -1010.8747280326422 L3638.4147289351854 -956.4477294227872 L3593.055116792628 -1045.5684654289307 Z',
    want: { union: 14999.75, xor: 14999.5, intersect: 0.25 },
    slack: 0.01,
  };
  for (const [name, c] of Object.entries({ simple, triple })) {
    assertAreas(areas(c.A, c.B), c.want, c.slack, name);
    assertAllChained(c.A, c.B, name);
  }
}));

test('a cusp curve and an exact copy of it meet only at their ends', () => {
  // The copy is the same curve to within a ten-billionth, at the same parameters. It has no
  // crossing to report, and both copies have to be decided alike or one of them is dropped
  // and the union loses the region behind it.
  const c1: Cubic = [0, 0, 1, 1, 0, 1, 1, 0];
  const c2: Cubic = [-4.2857142857142864e-10, 0, 1.000000000047619, 1, 5.238095238095239e-10, 1, 1.000000001, 0];
  for (const { name, hits } of bothOrders(c1, c2)) {
    const what = `${name}: ${JSON.stringify(hits)}`;
    assert.equal(hits.length, 2, what);
    assert.deepEqual(hits[0], [0, 0], what);
    assert.ok(Math.abs(hits[1]![0] - 1) < 1e-9 && Math.abs(hits[1]![1] - 1) < 1e-9, what);
  }
  const A = 'M0 0 C1 1 0 1 1 0 L1 -0.3 L0 -0.3 Z';
  const B = 'M-4.2857142857142864e-10 0 C1.000000000047619 1 5.238095238095239e-10 1 1.000000001 0 L1 1.2 L0 1.2 Z';
  const d = pathOf(geom.selfUnion(`${A} ${B}`, EXACT), 'selfUnion');
  assert.equal(parsed(d).length, 1, 'the self-union is one contour');
  assert.ok(Math.abs(area(d) - 1.5) < 1e-6, `self-union area ${area(d)}, expected 1.5`);
  assertChainedExactly(d, 'exact copy');
});

// ── 4. the root solve a near-copy needs ───────────────────────────────────────

test('a cubic whose leading coefficient is a billionth of the rest keeps its roots', () => {
  // Against a horizontal line, a copy of a symmetric curve nudged by a billionth has a
  // leading coefficient of 2.5e-9 where the original's is exactly zero. Cardano's depressed
  // form has p and q of the order of (b/a) squared and cubed, they cancel, the discriminant
  // reads positive, and the single root it returns is far outside [0, 1]: no root at all
  // where the line crosses the curve twice. The roots are now isolated between the cubic's
  // critical points, which needs no closed form.
  const roots = cubicRoots01(2.4715770989605977e-9, -3.0000000023232825, 3.000000000727632, -0.5141400000759269);
  assert.equal(roots.length, 2, JSON.stringify(roots));
  assert.ok(Math.abs(roots[0]! - 0.21960741807) < 1e-9, JSON.stringify(roots));
  assert.ok(Math.abs(roots[1]! - 0.78039258208) < 1e-9, JSON.stringify(roots));

  // The same cubic, as the ray a boolean casts through a copy of a cusp curve. Before, the
  // ray reported nothing and the copy vanished from the winding count.
  const copy: Cubic = [
    -5.6945130993573894e-11, -7.59268413247652e-11, 1.000000000124963, 1.0000000001666172,
    -0.02000000027394958, 0.9999999996347338, 1.0000000006, 8.000000000000004e-10,
  ];
  const hits = intersectLineCubic(0.3, 0.51414, 10, 0.51414, copy);
  assert.equal(hits.length, 2, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0]!.t2 - 0.2196074) < 1e-6 && Math.abs(hits[1]!.t2 - 0.7803926) < 1e-6, JSON.stringify(hits));
  // A ray starting on the first crossing sees the second, whichever side of its origin the
  // first falls on by rounding.
  const fromCrossing = intersectLineCubic(0.40957, 0.51414, 10, 0.51414, copy);
  assert.ok(fromCrossing.some((h) => Math.abs(h.t2 - 0.7803926) < 1e-6), JSON.stringify(fromCrossing));

  const A = 'M0 0 C1 1 -0.02 1 1 0 L1 -0.3 L0 -0.3 Z';
  const B = 'M-5.6945130993573894e-11 -7.59268413247652e-11 C1.000000000124963 1.0000000001666172 -0.02000000027394958 0.9999999996347338 1.0000000006 8.000000000000004e-10 L1 1.2 L0 1.2 Z';
  const d = pathOf(geom.selfUnion(`${A} ${B}`, EXACT), 'selfUnion');
  assert.equal(parsed(d).length, 1, 'the self-union is one contour');
  assert.ok(Math.abs(area(d) - 1.5) < 1e-6, `self-union area ${area(d)}, expected 1.5`);
});

test('a ray cast at a cusp counts the crossings its two ends allow', () => {
  // The copy lies on the same side as the base, so the boolean's answer is B alone. A
  // vertical ray from the midpoint of a closing line passes through the apex of the cusp,
  // where the curve crosses the line three times; the root solve returned two roots of one
  // sign and the far count was off by one, so the line was dropped. A curve whose two ends
  // lie on opposite sides of the ray's LINE crosses it an odd number of times, which is
  // checkable, and a mismatch is a degeneracy another direction avoids.
  const A = 'M0 0 C1 1 0 1 1 0 L1 -0.3 L0 -0.3 Z';
  const B = 'M-9.6078431372549e-8 0 C0.9999999692810457 1 3.4640522875817005e-8 1 1.0000001 0 L1 -0.5 L0 -0.5 Z';
  const aA = area(A), aB = area(B);
  const union = pathOf(geom.union([A, B], EXACT), 'union');
  assert.equal(parsed(union).length, 1, 'the union is one contour');
  assert.ok(Math.abs(area(union) - aB) < 1e-6, `union area ${area(union)}, expected ${aB}`);
  const xor = pathOf(geom.xor([A, B], EXACT), 'xor');
  assert.ok(Math.abs(area(xor) - (aB - aA)) < 1e-6, `xor area ${area(xor)}, expected ${aB - aA}`);
  assertAllChained(A, B, 'same-side cusp');
});

// ── 5. a loop against a near-copy: every hit is a cut ─────────────────────────

test('a loop against a copy a ten-thousandth away is cut at every contact', () => overrunOnly(() => {
  // Under the shipped budget the clip search answers this pair and scatters its contacts.
  // The loop crosses itself, and the copy crosses it at two points and runs alongside it
  // twice. Ten points come back: the crossings, the contacts, and the ends of the runs of
  // contact. The boolean used to throw all of them away, because "more than nine hits is a
  // scatter" is false once run ends are reported, and the loop lost the cuts at its own
  // crossings.
  const c1: Cubic = [0, 0, 1.5, 1, -0.5, 1, 1, 0];
  const c2: Cubic = [0, 0.0001, 1.5, 1.0000198977859946, -0.5, 0.9999879165704307, 1, 0.00000405635330787375];
  for (const { name, hits } of bothOrders(c1, c2)) {
    const what = `${name}: ${JSON.stringify(hits)}`;
    assert.equal(hits.length, 10, what);
    assert.ok(hits.some(([t1, t2]) => Math.abs(t1 - 0.17267) < 1e-4 && Math.abs(t2 - 0.82733) < 1e-4), `no crossing at 0.173, ${what}`);
    assert.ok(hits.some(([t1, t2]) => Math.abs(t1 - 0.82731) < 1e-4 && Math.abs(t2 - 0.17266) < 1e-4), `no crossing at 0.827, ${what}`);
    for (const t of [0.31100, 0.68898, 0.8273, 0.8373]) {
      assert.ok(hits.some(([t1]) => Math.abs(t1 - t) < 1e-4), `no contact at ${t}, ${what}`);
    }
    for (const h of hits) assert.ok(onBoth(c1, c2, h) <= 1e-9, `not on both curves, ${what}`);
  }
  const A = 'M0 0 C1.5 1 -0.5 1 1 0 L1 -0.3 L0 -0.3 Z';
  const B = 'M0 0.0001 C1.5 1.0000198977859946 -0.5 0.9999879165704307 1 0.00000405635330787375 L1 -0.5 L0 -0.5 Z';
  const su = pathOf(geom.selfUnion(`${A} ${B}`, EXACT), 'selfUnion');
  assert.equal(parsed(su).length, 1, 'the self-union is one contour');
  assert.ok(Math.abs(area(su) - 0.7342157486) < 1e-6, `self-union area ${area(su)}`);
  assertAreas(areas(A, B), {
    union: 0.7342157486, intersect: 0.5341645250, difference: 0.0000051866, xor: 0.2000511775,
  }, 1e-6, 'loop against a copy');
  assertAllChained(A, B, 'loop against a copy');
  // The areas above are the region algebra's answer, checked point by point.
  const checked = assertRegions(A, B, [-0.35, -0.55, 1.35, 0.8], 2e-3, 'loop against a copy');
  assert.ok(checked > 300, `grid too thin: ${checked}`);
}));

// ── 6. what the fourth repair had to answer for ───────────────────────────────

test('a closed band two weld radii thick is a region, not a sliver', () => {
  // The walk drops a chain that bounds no more area than the weld radius times its length,
  // because a chain the slack join closed on itself after a piece or two is a manufactured
  // sliver. Applied to every chain, the same test deleted real geometry: at a tolerance of
  // 0.001 the weld radius is 2, and this band is 4 units thick, so its own area is under the
  // bar. The test now applies only to a chain that needed a wide join somewhere.
  const A = 'M0 0 L1000 0 L1000 4 L0 4 Z';
  const B = 'M0 2 L1000 2 L1000 6 L0 6 Z';
  const opts = { decimals: 12, tolerance: 0.001 } as const;
  const one = (d: string, what: string): number => {
    assert.equal(parsed(d).length, 1, `${what} is not one contour: ${d}`);
    return area(d);
  };
  assert.ok(Math.abs(one(pathOf(geom.intersect([A, B], opts), 'intersect'), 'intersect') - 2000) < 1e-6);
  assert.ok(Math.abs(one(pathOf(geom.difference([A, B], opts), 'difference'), 'difference') - 2000) < 1e-6);
  assert.ok(Math.abs(one(pathOf(geom.union([A, B], opts), 'union'), 'union') - 6000) < 1e-6);
  assert.ok(Math.abs(one(pathOf(geom.selfUnion(`${A} ${B}`, opts), 'selfUnion'), 'selfUnion') - 6000) < 1e-6);
  const x = pathOf(geom.xor([A, B], opts), 'xor');
  assert.equal(parsed(x).length, 2, `xor is not two contours: ${x}`);
  assert.ok(Math.abs(area(x) - 4000) < 1e-6, `xor area ${area(x)}`);

  // The same band bowed and turned, so the answer is not a property of axis-aligned
  // rectangles: the same 1000 by 4 band with its long sides bowed by 1.3, rotated by 0.7
  // radians and moved to (10, -5). Written out in full, as everything here is.
  const bowedA =
    'M10 -5 C264.10991276808716 210.73352392270016 520.7322745164014 423.4841633149908 '
    + '774.8421872844885 639.217687237691 L772.2653165355377 642.277055986829 '
    + 'C518.1554037674506 426.5435320641287 261.5330420191364 213.7928926718381 '
    + '7.423129251049236 -1.940631250862046 Z';
  const bowedB =
    'M8.711564625524618 -3.470315625431023 C262.8214773936118 212.26320829726913 '
    + '519.443839141926 425.0138476895598 773.5537519100131 640.74737161226 '
    + 'L770.9768811610624 643.8067403613979 C516.8669683929752 428.0732164386977 '
    + '260.244606644661 215.32257704640708 6.134693876573854 -0.41094687629306925 Z';
  const bowed = pathOf(geom.intersect([bowedA, bowedB], opts), 'bowed intersect');
  assert.equal(parsed(bowed).length, 1, `the bowed intersect is not one contour: ${bowed}`);
  assert.ok(Math.abs(area(bowed) - 2000) < 0.5, `bowed intersect area ${area(bowed)}, expected 2000`);
});

test('a curve that starts exactly on the line capping it keeps that vertex', () => {
  // The distance polynomial of a cap line against the curve it caps is near-linear, and its
  // root sits a rounding error outside [0, 1]: at -1.1e-19 for this pair. Isolating roots
  // over [0, 1] alone found no sign change and reported nothing, so the T junction lost its
  // shared vertex, the contact search then scattered cuts along the cap, and the walk closed
  // garbage. The isolation now spans the same parameter slack every root is accepted at.
  assert.deepEqual(cubicRoots01(0, 0, 1000.0000000000002, 1.1102230246251565e-16), [0]);
  const B0: Cubic = [
    8.711564625524618, -3.470315625431023, 262.8214773936118, 212.26320829726913,
    519.443839141926, 425.0138476895598, 773.5537519100131, 640.74737161226,
  ];
  const hits = intersectLineCubic(7.423129251049236, -1.940631250862046, 10, -5, B0);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0]!.t1 - 0.5) < 1e-9, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0]!.t2) < 1e-9, JSON.stringify(hits));
});

test('two near-copies at icon coordinates cross in both orders', () => overrunOnly(() => {
  // Under the shipped budget the clip search answers this pair.
  // Real outlines from an icon set, each against a copy of itself a hair away: the pieces of
  // a near-parallel pair are cut down twenty-five levels, so at these coordinates they carry
  // a few hundred ulps of rounding. The clip's box test and its band levels were both read
  // at their bare values, and a crossing the search had already converged on was refused for
  // lying 1.4e-9 outside a box, or fell outside a surviving range a few ulps wide. Both are
  // now read with the rounding the pieces carry. One hit, in BOTH orders, is the point: the
  // search used to find it in one order and not the other, and a boolean that got the right
  // answer got it by which operand it happened to put first.
  const cases: { name: string; c1: Cubic; c2: Cubic; t1: number; t2: number }[] = [
    {
      name: 'two arcs 37 apart at 5e4',
      c1: [37000, 67000, 39000, 63000, 43000, 61000, 48000, 62000],
      c2: [37037, 67000, 39039, 63000, 43043, 61000, 48048, 62000],
      t1: 0.830066, t2: 0.826788,
    },
    {
      name: 'two arcs of radius 2e6, 250 apart, at 1.3e7',
      c1: [
        12840000, 11820000, 12312794.145881156, 12060476.237207348,
        11707205.854118843, 12060476.237207348, 11180000, 11820000,
      ],
      c2: [
        12840240, 11820072, 12313034.145881156, 12060548.237207348,
        11707445.854118843, 12060548.237207348, 11180240, 11820072,
      ],
      t1: 0.841796, t2: 0.841942,
    },
    {
      name: 'two arcs 2.5 apart at 2e5',
      c1: [168000, 206000, 163000, 208000, 158000, 207000, 155000, 203000],
      c2: [168002.4, 206000.72, 163002.4, 208000.72, 158002.4, 207000.72, 155002.4, 203000.72],
      t1: 0.552686, t2: 0.552868,
    },
  ];
  for (const { name, c1, c2, t1, t2 } of cases) {
    for (const { name: order, hits } of bothOrders(c1, c2)) {
      const what = `${name}, ${order}: ${JSON.stringify(hits)}`;
      assert.equal(hits.length, 1, what);
      assert.ok(Math.abs(hits[0]![0] - t1) < 1e-6 && Math.abs(hits[0]![1] - t2) < 1e-6, what);
    }
  }
  // The third pair's crossing, as a point: a boolean cuts both operands there.
  const A2: Cubic = [168000, 206000, 163000, 208000, 158000, 207000, 155000, 203000];
  const B2: Cubic = [168002.4, 206000.72, 163002.4, 208000.72, 158002.4, 207000.72, 155002.4, 203000.72];
  const hit = intersectCubics(A2, B2)[0]!;
  assert.ok(Math.abs(hit.x - 160047.36) < 0.01 && Math.abs(hit.y - 206566.96) < 0.01, JSON.stringify(hit));
}));

test('a hit at the tip of a near-copy lies on both curves, in both orders', () => overrunOnly(() => {
  // Under the shipped budget the clip search answers this pair.
  // A tight turn of size 1 moved to x = 330000, against a copy a thousandth away whose offset
  // has a triple root at the turn. The clip's box test is padded by the rounding of deep
  // subdivision, so two pieces can reach the point emit up to a thousand ulps apart without
  // meeting. The emit had no distance check, and pairs that close but not touching reported a
  // point 1e-7 off a curve, which the contract forbids. It now measures the gap first.
  const c1: Cubic = [
    330000, 0, 329999.91767117666, 1.4118151312560399,
    329999.26622288575, 0.6796845934922502, 330000.66474315396, 0.7470719773099894,
  ];
  const c2: Cubic = [
    330000.66518567945, 0.7479687332300948, 329999.26578036026, 0.6787878375721449,
    329999.91811370215, 1.4127118871761453, 329999.9995574745, -0.0008967559201053508,
  ];
  for (const { name, hits } of bothOrders(c1, c2)) {
    const what = `${name}: ${JSON.stringify(hits)}`;
    assert.equal(hits.length, 1, what);
    assert.ok(Math.abs(hits[0]![0] - 0.5) < 1e-3 && Math.abs(hits[0]![1] - 0.5) < 1e-3, what);
    assert.ok(onBoth(c1, c2, hits[0]!) <= 1e-8, `not on both curves, ${what}`);
  }
}));
