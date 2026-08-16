// SPDX-License-Identifier: MPL-2.0
/**
 * Boolean operations on Bézier regions (engine/src/geom/boolean.ts).
 *
 * ## How these are checked
 *
 * Three oracles, in order of strength, matching `geom-intersect.test.ts`:
 *
 * 1. **Analytic** - answers known in closed form. Overlapping unit squares give exact
 *    rationals; a pentagram's nonzero and even-odd fills are shoelace areas of a 10-gon
 *    and a pentagon whose radii are R and R/φ²; a self-intersecting cubic's two lobes
 *    are integrated over the sub-ranges its loop parameters bracket. Circles-as-cubics
 *    are checked against *their own* area, never against πr² - the fixture is the cubic
 *    APPROXIMATION of a circle and encloses 2.8e-4 more, so an idealised expectation
 *    makes exact code look broken. Where a circle appears in an exact test it is via set
 *    algebra that holds whatever the shape is: area(A∪B) + area(A∩B) = area(A) + area(B).
 * 2. **Residual** - every point of every output curve must lie ON an input curve to
 *    machine precision, measured with `nearestOnCubic` against every input. This is the
 *    oracle a flattening implementation fails by construction: it would be off by its
 *    flattening tolerance, ~1e-3, not the ~1e-14 measured here. Paired with a curve-count
 *    ceiling, because silently turning eight curves into four hundred line segments is
 *    the exact failure the module exists to prevent.
 * 3. **Dense** - an independent brute-force region test built on `flattenCubic`: rings of
 *    line segments, a crossing-count winding number, and a grid of sample points. That is
 *    the thing the module refuses to do internally, which is precisely what makes it a
 *    good reference for it.
 *
 * ## Why the area oracle is local
 *
 * Areas are integrated here rather than taken from `contourArea`, so that a wrong answer
 * from path.ts cannot excuse a wrong answer from boolean.ts. ∮x dy per curve by 3-point
 * Gauss-Legendre: the integrand is degree 5 for a cubic and the rule is exact to degree 5,
 * so it is a closed form and not a sample. The two are then asserted to agree on a curved
 * contour, which is also the regression guard on path.ts's own correction - `contourArea`
 * used to assemble itself from `signedAreaCubic` plus a chord term of the opposite sign
 * and reported 85.75 for a circle of 314.25, exact for straight contours and wrong for
 * every curved one.
 *
 * ## What is failing, and why it is left failing
 *
 * Five tests are red against the current implementation, from two defects, and both
 * surface the same way: the module emits contours that do not close, because the walk
 * runs out of edges and marks a dangling chain closed without bridging it.
 *
 * - Three of them are one cubic that crosses ITSELF. The two loop parameters name the
 *   same POINT, and the splitter merges cuts by position, so the second cut is discarded
 *   as a duplicate and the loop is never separated from the rest of the curve.
 * - Two are single-point contact between separate curves: two tangent arches, and the
 *   second pass of `selfUnion` over its own output where two lobes meet at a vertex. The
 *   contact is bracketed only to the weld radius, the sub-weld pieces around it are
 *   dropped, and the chain dangles.
 *
 * Both matter beyond these fixtures: an inward offset produces self-crossing curves as a
 * matter of course, and Stage 3 self-unions an offset and then combines the result again,
 * so the canonical form has to be a fixed point. The assertions are the spec rather than a
 * description of the code, so they stay red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Cubic, evalCubic, flattenCubic, isLineCubic, lineToCubic, nearestOnCubic, splitCubic,
  subCubic, tangentAt,
} from '../engine/src/geom/bezier.ts';
import { intersectCubics } from '../engine/src/geom/intersect.ts';
import { type Contour, type GeomPath, JOIN_EPS, contourArea } from '../engine/src/geom/path.ts';
import {
  type BooleanOp, GeomLimitError, booleanPath, differencePath, intersectPath, pointInPath,
  selfUnion, unionPath, windingNumber, xorPath,
} from '../engine/src/geom/boolean.ts';

const near = (a: number, b: number, eps = 1e-9, what = '') =>
  assert.ok(Math.abs(a - b) <= eps, `${what ? `${what}: ` : ''}${a} !== ${b} (within ${eps})`);

// ── fixtures ──────────────────────────────────────────────────────────────────

/** A closed polygon as cubics with collinear controls - the module's "a line is a
 *  cubic" premise exercised rather than special-cased. */
function poly(pts: readonly (readonly [number, number])[]): Contour {
  const curves: Cubic[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    curves.push(lineToCubic(a[0], a[1], b[0], b[1]));
  }
  return { curves, closed: true };
}

const rect = (x0: number, y0: number, x1: number, y1: number): Contour =>
  poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

/** The standard four-cubic circle. κ = 4(√2−1)/3 makes it pass EXACTLY through the eight
 *  cardinal and 45° points, and bulge ~2.7e-4 of a radius outside between them. Every
 *  tangency fixture below touches at a 45° point for that reason: contact there is exact
 *  geometry rather than an artefact of the approximation. */
const KAPPA = 0.5522847498307936;
function circle(cx: number, cy: number, r: number): Contour {
  const k = KAPPA * r;
  return { closed: true, curves: [
    [cx + r, cy, cx + r, cy + k, cx + k, cy + r, cx, cy + r],
    [cx, cy + r, cx - k, cy + r, cx - r, cy + k, cx - r, cy],
    [cx - r, cy, cx - r, cy - k, cx - k, cy - r, cx, cy - r],
    [cx, cy - r, cx + k, cy - r, cx + r, cy - k, cx + r, cy],
  ] as Cubic[] };
}

const reverse = (c: Contour): Contour => ({
  curves: c.curves.slice().reverse().map((k) => [k[6], k[7], k[4], k[5], k[2], k[3], k[0], k[1]] as Cubic),
  closed: c.closed,
});

const curveCount = (p: GeomPath) => p.reduce((n, c) => n + c.curves.length, 0);
const allCurves = (p: GeomPath) => p.flatMap((c) => c.curves);

/** Translate a whole path. Used to bring a result back to the origin BEFORE integrating
 *  its area: ∮x dy at coordinates of 1e8 multiplies numbers of order 1e16, where one ulp
 *  is 2, so the oracle itself loses whole units of area while the geometry is exact. The
 *  translation is a subtraction of an exactly representable number, so it moves nothing. */
function shiftPath(p: GeomPath, dx: number, dy: number): GeomPath {
  return p.map((c) => ({
    closed: c.closed,
    curves: c.curves.map((k) => [
      k[0] - dx, k[1] - dy, k[2] - dx, k[3] - dy, k[4] - dx, k[5] - dy, k[6] - dx, k[7] - dy,
    ] as Cubic),
  }));
}

// ── oracle 1: exact signed area ───────────────────────────────────────────────

/** 3-point Gauss-Legendre on [0,1]. x(t)·y'(t) is degree 5 for a cubic and the rule is
 *  exact to degree 5, so this integrates ∮x dy exactly rather than approximately. */
const GAUSS: readonly (readonly [number, number])[] = [
  [0.5 - 0.5 * Math.sqrt(3 / 5), 5 / 18],
  [0.5, 8 / 18],
  [0.5 + 0.5 * Math.sqrt(3 / 5), 5 / 18],
];

function areaCubic(k: Cubic): number {
  let a = 0;
  for (const [t, w] of GAUSS) {
    const p = evalCubic(k, t), d = tangentAt(k, t);
    a += w * p.x * d.y;
  }
  return a;
}

/** Signed area of a path, positive counter-clockwise in a y-up frame. An unclosed
 *  contour is closed by its chord, the same convention the module normalises to. */
function pathArea(p: GeomPath): number {
  let a = 0;
  for (const c of p) {
    for (const k of c.curves) a += areaCubic(k);
    const f = c.curves[0], l = c.curves[c.curves.length - 1];
    if (f && l) {
      const gap = Math.hypot(l[6] - f[0], l[7] - f[1]);
      if (gap > 1e-12) a += ((l[6] + f[0]) / 2) * (f[1] - l[7]);
    }
  }
  return a;
}

/**
 * The two parameters where a cubic crosses itself, derived here independently of the
 * module. P(t1) = P(t2) divided by (t1 − t2) is linear in s = t1+t2 and s²−q, so the
 * answer is a 2×2 solve and one quadratic. Used to state what a loop's two lobes are
 * WITHOUT asking the code under test where it thinks the crossing is.
 */
function loopParams(c: Cubic): [number, number] {
  const ax = -c[0] + 3 * c[2] - 3 * c[4] + c[6], bx = 3 * c[0] - 6 * c[2] + 3 * c[4], cx = -3 * c[0] + 3 * c[2];
  const ay = -c[1] + 3 * c[3] - 3 * c[5] + c[7], by = 3 * c[1] - 6 * c[3] + 3 * c[5], cy = -3 * c[1] + 3 * c[3];
  const det = ax * by - ay * bx;
  const m = (bx * cy - cx * by) / det, s = (ay * cx - ax * cy) / det;
  const r = Math.sqrt(s * s - 4 * (s * s - m));
  return [(s - r) / 2, (s + r) / 2];
}

// ── oracle 2: residual against the input curves ───────────────────────────────

/** The worst distance from any point of the output to the nearest input curve. Sampled
 *  along each output curve, not just at its ends: a piece that drifted in the middle
 *  would still have endpoints on the inputs. */
function worstResidual(out: GeomPath, inputs: Cubic[]): number {
  let worst = 0;
  for (const k of allCurves(out)) {
    for (const t of [0, 0.2, 0.5, 0.8, 1]) {
      const p = evalCubic(k, t);
      let d = Infinity;
      for (const q of inputs) d = Math.min(d, nearestOnCubic(q, p.x, p.y, 64).distance);
      worst = Math.max(worst, d);
    }
  }
  return worst;
}

/** Consecutive curves must meet, and the last must return to the first. A contour that
 *  fails this is not a region at all, whatever its area integrates to. */
function assertClosedContours(p: GeomPath, eps = JOIN_EPS) {
  for (const [ci, c] of p.entries()) {
    for (let i = 1; i < c.curves.length; i++) {
      const a = c.curves[i - 1]!, b = c.curves[i]!;
      const gap = Math.hypot(a[6] - b[0], a[7] - b[1]);
      assert.ok(gap <= eps, `contour ${ci} breaks between curve ${i - 1} and ${i} by ${gap}`);
    }
    const f = c.curves[0]!, l = c.curves[c.curves.length - 1]!;
    const gap = Math.hypot(l[6] - f[0], l[7] - f[1]);
    assert.ok(gap <= eps, `contour ${ci} is open by ${gap}`);
  }
}

// ── oracle 3: dense flattening ────────────────────────────────────────────────

/** Polyline rings from the real curves. Only ever an oracle - the module doing this
 *  internally is the failure everything above is guarding against.
 *
 *  Every flattened point is kept and only exact duplicates at the joins are dropped. An
 *  earlier version dropped each curve's last point, which is right at a join and wrong at
 *  the end of a contour whose closure is implicit: the ring then closed from the
 *  second-to-last sample instead of the real endpoint and shaved a sliver off the shape,
 *  which reads as the module being wrong along one row of samples. */
function flatRings(p: GeomPath, tol = 0.002): { x: number; y: number }[][] {
  return p.map((c) => {
    const ring: { x: number; y: number }[] = [];
    for (const k of c.curves) {
      for (const pt of flattenCubic(k, tol)) {
        const last = ring[ring.length - 1];
        if (last && Math.hypot(last.x - pt.x, last.y - pt.y) < 1e-12) continue;
        ring.push(pt);
      }
    }
    const first = ring[0], last = ring[ring.length - 1];
    if (first && last && ring.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-12) ring.pop();
    return ring;
  });
}

/** Winding number of a polygon ring set, by signed crossings of a rightward ray. Wholly
 *  independent of the module: no curves, no parameters, just segment arithmetic. */
function ringWinding(rings: { x: number; y: number }[][], x: number, y: number): number {
  let w = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
      const side = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y);
      if (a.y <= y) { if (b.y > y && side > 0) w++; }
      else if (b.y <= y && side < 0) w--;
    }
  }
  return w;
}

const opHolds = (a: boolean, b: boolean, op: BooleanOp): boolean =>
  op === 'union' ? a || b : op === 'intersection' ? a && b : op === 'difference' ? a && !b : a !== b;

/** A jittered grid over a box. The offsets are irrational-ish so no sample lands on an
 *  axis-aligned edge, where both the module's answer and the oracle's are legitimately
 *  arbitrary. */
function* gridPoints(box: { x0: number; y0: number; x1: number; y1: number }, n: number) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      yield [box.x0 + (box.x1 - box.x0) * (i + 0.51372) / n,
             box.y0 + (box.y1 - box.y0) * (j + 0.42713) / n] as const;
    }
  }
}

/** Where the module's region disagrees with the operator applied to the flattened
 *  operands. */
function gridDisagreements(
  a: GeomPath, b: GeomPath, result: GeomPath, op: BooleanOp,
  box: { x0: number; y0: number; x1: number; y1: number }, n: number,
): { bad: number; total: number } {
  const fa = flatRings(a), fb = flatRings(b), fr = flatRings(result);
  let bad = 0, total = 0;
  for (const [x, y] of gridPoints(box, n)) {
    const want = opHolds(ringWinding(fa, x, y) !== 0, ringWinding(fb, x, y) !== 0, op);
    if (want !== (ringWinding(fr, x, y) !== 0)) bad++;
    total++;
  }
  return { bad, total };
}

// ── the area oracle itself ────────────────────────────────────────────────────

test('the area oracle is exact, checked against a dense numeric integral', () => {
  // Everything analytic below rests on this, so it is checked first, the same way the
  // intersector's signed area is checked against the SAME curve rather than an ideal.
  const c = circle(0, 0, 10);
  let numeric = 0;
  for (const k of c.curves) {
    const N = 200000;
    for (let i = 0; i < N; i++) {
      const p = evalCubic(k, i / N), q = evalCubic(k, (i + 1) / N);
      numeric += ((p.x + q.x) / 2) * (q.y - p.y);
    }
  }
  near(pathArea([c]), numeric, 1e-4);
  near(pathArea([rect(0, 0, 1, 1)]), 1, 1e-15);
  near(pathArea([reverse(rect(0, 0, 1, 1))]), -1, 1e-15);
});

test('the local oracle and contourArea agree on a CURVED contour', () => {
  // Two independent closed forms for the same integral. They diverge the moment either
  // side regresses, and path.ts's has: contourArea used to add `signedAreaCubic`'s bulge
  // to a chord term of the opposite sign and returned 85.75 here. Polygons hide it - 
  // a straight curve has no bulge - so the check has to be on curves.
  const c = circle(0, 0, 10);
  near(contourArea(c), pathArea([c]), 1e-9);
  near(contourArea(reverse(c)), -pathArea([c]), 1e-9);
  // A two-cubic half circle closed by its chord: the shape most rounded outlines and
  // glyph curves are actually built from, and the one that used to come back negative.
  const half: Contour = { closed: true, curves: c.curves.slice(0, 2) };
  assert.ok(contourArea(half) > 0, `a counter-clockwise half disc must have positive area, got ${contourArea(half)}`);
  near(contourArea(half), pathArea([half]), 1e-9);
});

test('the cubic circle is NOT a circle, and the tests must expect its own area', () => {
  // 2.8e-4 too large. Every circle expectation below is derived from this number, never
  // from pi r^2 - checking an exact algorithm against an idealised fixture reads as a bug
  // in the algorithm.
  const own = pathArea([circle(0, 0, 10)]);
  const ideal = Math.PI * 100;
  assert.ok(own > ideal, 'the four-cubic approximation encloses more than the circle');
  const rel = (own - ideal) / ideal;
  assert.ok(rel > 1e-4 && rel < 5e-4, `expected ~2.8e-4 of excess area, got ${rel}`);
});

// ── analytic: polygons ────────────────────────────────────────────────────────

test('two unit squares overlapping by half give exact rational areas', () => {
  const a = [rect(0, 0, 1, 1)], b = [rect(0.5, 0, 1.5, 1)];
  near(pathArea(unionPath(a, b)), 1.5, 1e-12);
  near(pathArea(intersectPath(a, b)), 0.5, 1e-12);
  near(pathArea(differencePath(a, b)), 0.5, 1e-12);
  near(pathArea(xorPath(a, b)), 1, 1e-12);
  near(unionPath(a, b).reduce((s, c) => s + contourArea(c), 0), 1.5, 1e-12);
});

test('the overlap halves come back as two separate contours from xor', () => {
  const x = xorPath([rect(0, 0, 1, 1)], [rect(0.5, 0, 1.5, 1)]);
  assert.equal(x.length, 2, `xor of half-overlapping squares is two pieces, got ${x.length}`);
  for (const c of x) near(pathArea([c]), 0.5, 1e-12);
});

test('disjoint operands settle every operator without touching geometry', () => {
  const a = [rect(0, 0, 1, 1)], b = [rect(5, 5, 6, 6)];
  near(pathArea(unionPath(a, b)), 2, 1e-12);
  assert.equal(unionPath(a, b).length, 2);
  assert.deepEqual(intersectPath(a, b), []);
  near(pathArea(differencePath(a, b)), 1, 1e-12);
  near(pathArea(xorPath(a, b)), 2, 1e-12);
});

test('one square fully inside another', () => {
  const outer = [rect(0, 0, 10, 10)], inner = [rect(3, 3, 7, 7)];
  near(pathArea(unionPath(outer, inner)), 100, 1e-12);
  assert.equal(unionPath(outer, inner).length, 1, 'the swallowed contour must not survive');
  near(pathArea(intersectPath(outer, inner)), 16, 1e-12);
  near(pathArea(differencePath(outer, inner)), 84, 1e-12);
  near(pathArea(xorPath(outer, inner)), 84, 1e-12);
});

test('a difference that creates a hole winds the hole the other way', () => {
  // boolean.ts's own header promises this in contourArea's terms: outer counter-clockwise,
  // hole clockwise. Holes are how a filled region with a void is expressed at all, and the
  // sign is the entire expression of it.
  const d = differencePath([rect(0, 0, 10, 10)], [rect(3, 3, 7, 7)]);
  assert.equal(d.length, 2);
  const areas = d.map((c) => contourArea(c)).sort((p, q) => q - p);
  near(areas[0]!, 100, 1e-12);
  near(areas[1]!, -16, 1e-12);
});

test('a hole with a CURVED boundary is wound the other way too', () => {
  const big = circle(0, 0, 20), small = circle(0, 0, 5);
  const d = differencePath([big], [small]);
  assert.equal(d.length, 2);
  const areas = d.map((c) => contourArea(c)).sort((p, q) => q - p);
  near(areas[0]!, pathArea([big]), 1e-9);
  near(areas[1]!, -pathArea([small]), 1e-9);
});

test('identical operands: the four algebraic identities', () => {
  const x = [rect(0, 0, 10, 10)];
  near(pathArea(unionPath(x, x)), 100, 1e-12);
  near(pathArea(intersectPath(x, x)), 100, 1e-12);
  assert.deepEqual(differencePath(x, x), []);
  assert.deepEqual(xorPath(x, x), []);
});

test('squares sharing exactly one edge fuse into one contour', () => {
  // The everyday coincident-boundary case: the shared edge is traversed one way by each
  // operand, so a union must keep one copy and an intersection none.
  const a = [rect(0, 0, 1, 1)], b = [rect(1, 0, 2, 1)];
  const u = unionPath(a, b);
  assert.equal(u.length, 1, `a shared edge must fuse, got ${u.length} contours`);
  near(pathArea(u), 2, 1e-12);
  assert.deepEqual(intersectPath(a, b), []);
  near(pathArea(differencePath(a, b)), 1, 1e-12);
  near(pathArea(xorPath(a, b)), 2, 1e-12);
});

test('an edge shared along only part of its length is cut at the run ends', () => {
  const a = [rect(0, 0, 10, 10)], b = [rect(10, 2, 20, 8)];
  near(pathArea(unionPath(a, b)), 160, 1e-12);
  near(pathArea(differencePath(a, b)), 100, 1e-12);
  assert.deepEqual(intersectPath(a, b), []);
});

test('squares touching at a single corner stay two regions', () => {
  const u = unionPath([rect(0, 0, 1, 1)], [rect(1, 1, 2, 2)]);
  near(pathArea(u), 2, 1e-12);
  assert.equal(u.length, 2, 'a point of contact does not merge two regions');
});

test('a donut and a bar through its hole: exact areas and two surviving holes', () => {
  const donut: GeomPath = [rect(0, 0, 10, 10), reverse(rect(3, 3, 7, 7))];
  near(pathArea(donut), 84, 1e-12);
  const u = unionPath(donut, [rect(4, -2, 6, 12)]);
  near(pathArea(u), 100, 1e-12);          // 84 + 28 bar - 12 already covered
  const holes = u.filter((c) => pathArea([c]) < 0);
  assert.equal(holes.length, 2, 'the bar cuts the single hole into two');
  for (const h of holes) near(pathArea([h]), -4, 1e-12);
  const i = intersectPath(donut, [rect(4, -2, 6, 12)]);
  near(pathArea(i), 12, 1e-12);
  assert.equal(i.length, 2, 'the bar meets the ring in two separate pieces');
});

test('a disc sitting inside a donut hole touches nothing', () => {
  // The nesting a hole makes possible: B is inside A's bounding box and inside its outer
  // contour, and still wholly outside its region.
  const donut: GeomPath = [circle(0, 0, 20), reverse(circle(0, 0, 12))];
  const disc = [circle(0, 0, 5)];
  const ring = pathArea(donut), inner = pathArea(disc);
  near(pathArea(unionPath(donut, disc)), ring + inner, 1e-9);
  assert.equal(unionPath(donut, disc).length, 3, 'outer, hole and disc are three contours');
  assert.deepEqual(intersectPath(donut, disc), []);
  near(pathArea(differencePath(donut, disc)), ring, 1e-9);
});

// ── analytic: self-intersecting inputs ────────────────────────────────────────

test('a bowtie resolves into its two triangles', () => {
  const s = selfUnion([poly([[0, 0], [10, 10], [10, 0], [0, 10]])]);
  assert.equal(s.length, 2, `two lobes expected, got ${s.length}`);
  near(pathArea(s), 50, 1e-12);
  for (const c of s) near(pathArea([c]), 25, 1e-12);
});

test('a pentagram fills differently under nonzero and even-odd, to exact shoelace areas', () => {
  // The textbook case where the fill rule is visible: the centre is wound twice, so
  // nonzero fills it and even-odd punches it out, leaving five triangles that meet only
  // at points. Expectations are shoelace areas of the 10-gon (radii R and R/phi^2) and of
  // the inner pentagon, both exact.
  const R = 100, phi = (1 + Math.sqrt(5)) / 2;
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + i * 2 * (2 * Math.PI / 5);
    return [R * Math.cos(a), R * Math.sin(a)] as [number, number];
  });
  const star = [poly(pts)];
  const outer = 5 * R * (R / (phi * phi)) * Math.sin(Math.PI / 5);
  const inner = 2.5 * (R / (phi * phi)) ** 2 * Math.sin(2 * Math.PI / 5);

  const nz = selfUnion(star);
  near(pathArea(nz), outer, 1e-9);
  assert.equal(nz.length, 1, 'nonzero fills the centre, so the star is one contour');

  const eo = selfUnion(star, { fillRule: 'evenodd' });
  near(pathArea(eo), outer - inner, 1e-9);
  assert.equal(eo.length, 5, `even-odd leaves five points, got ${eo.length}`);
  assertClosedContours(eo);
  // Residual: selfUnion is a public entry point, and Stage 3 feeds its output straight
  // back into another boolean, so its vertices have to be on the input as much as
  // booleanPath's do.
  assert.ok(worstResidual(eo, star[0]!.curves) < 1e-9, 'a star point left the input edges');
});

test('the even-odd star agrees with a flattened parity test, point by point', () => {
  const R = 100;
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + i * 2 * (2 * Math.PI / 5);
    return [R * Math.cos(a), R * Math.sin(a)] as [number, number];
  });
  const star = [poly(pts)];
  const eo = selfUnion(star, { fillRule: 'evenodd' });
  const rings = flatRings(star);
  let bad = 0, total = 0;
  for (const [x, y] of gridPoints({ x0: -110, y0: -110, x1: 110, y1: 110 }, 90)) {
    const want = (Math.abs(ringWinding(rings, x, y)) & 1) === 1;
    if (want !== pointInPath(eo, x, y)) bad++;
    total++;
  }
  assert.equal(bad, 0, `${bad}/${total} points disagree with the flattened even-odd oracle`);
});

test('a self-intersecting cubic loop resolves into two closed lobes', () => {
  // One curve, no other geometry: the crossing is the curve against ITSELF. Inward
  // offsets and freehand fits produce these constantly, which is why the module solves
  // the loop parameters in closed form rather than hoping an intersector finds them.
  const k: Cubic = [0, 0, 150, 100, -50, 100, 100, 0];
  const loop: GeomPath = [{ closed: true, curves: [k] }];
  const s = selfUnion(loop);
  assertClosedContours(s);
  assert.equal(s.length, 2, `a loop bounds two regions, got ${s.length} contours`);
});

test('the two lobes of a cubic loop have their exact integrated areas', () => {
  // The expectation comes from the loop parameters solved independently here and
  // integrated over the sub-ranges they bracket, so it does not depend on the module
  // agreeing with itself about where the crossing is.
  const k: Cubic = [0, 0, 150, 100, -50, 100, 100, 0];
  const [t1, t2] = loopParams(k);
  const lobe = Math.abs(areaCubic(subCubic(k, t1, t2)));
  const outer = Math.abs(areaCubic(subCubic(k, 0, t1)) + areaCubic(subCubic(k, t2, 1)));
  const s = selfUnion([{ closed: true, curves: [k] }]);
  const got = s.map((c) => pathArea([c])).sort((a, b) => a - b);
  assert.equal(got.length, 2, `expected two lobes of ${lobe.toFixed(4)} and ${outer.toFixed(4)}`);
  // Both sides solve the loop from the same closed form and both integrate exact
  // sub-ranges, so they agree to machine precision or the pieces are not the same pieces.
  near(got[0]!, lobe, 1e-9);
  near(got[1]!, outer, 1e-9);
  // Both filled under nonzero even though the original winds them opposite ways, so both
  // come back counter-clockwise.
  for (const a of got) assert.ok(a > 0, 'canonical output is oriented interior-left');
});

test('the resolved loop still lies on the original curve and fills the same region', () => {
  const k: Cubic = [0, 0, 150, 100, -50, 100, 100, 0];
  const loop: GeomPath = [{ closed: true, curves: [k] }];
  const s = selfUnion(loop);
  assert.ok(worstResidual(s, [k, lineToCubic(100, 0, 0, 0)]) < 1e-9,
    'the resolved loop left the original curve');
  const before = flatRings(loop), after = flatRings(s);
  let bad = 0, total = 0;
  for (const [x, y] of gridPoints({ x0: -60, y0: -30, x1: 160, y1: 130 }, 60)) {
    if ((ringWinding(before, x, y) !== 0) !== (ringWinding(after, x, y) !== 0)) bad++;
    total++;
  }
  assert.equal(bad, 0, `${bad}/${total} sample points disagree with the flattened original`);
});

test('a curved figure of eight resolves into two lobes', () => {
  // The same topology as the loop above, but the crossing is between two DIFFERENT
  // curves. Worth having both: it is what localises a failure to the self-crossing path
  // rather than to the classification.
  const c1: Cubic = [0, 0, 60, 80, 40, -80, 100, 0];
  const c2: Cubic = [100, 0, 40, 80, 60, -80, 0, 0];
  const s = selfUnion([{ closed: true, curves: [c1, c2] }]);
  assertClosedContours(s);
  assert.equal(s.length, 2, `two lobes expected, got ${s.length}`);
  const left = Math.abs(areaCubic(subCubic(c1, 0, 0.5)) + areaCubic(subCubic(c2, 0.5, 1)));
  for (const c of s) near(pathArea([c]), left, 1e-9);
  assert.ok(worstResidual(s, [c1, c2]) < 1e-9);
});

test('selfUnion is idempotent', () => {
  // Not a nicety: Stage 3 self-unions an offset and then combines the result again, so
  // the canonical form has to be a fixed point. The bowtie's two triangles meet at a
  // single point, which is the state the second pass has to leave alone.
  const once = selfUnion([poly([[0, 0], [10, 10], [10, 0], [0, 10]])]);
  const twice = selfUnion(once);
  assertClosedContours(twice);
  assert.equal(twice.length, once.length);
  near(pathArea(twice), pathArea(once), 1e-12);
});

test('selfUnion orients a clockwise input counter-clockwise, curved or straight', () => {
  near(pathArea(selfUnion([reverse(rect(0, 0, 10, 10))])), 100, 1e-12);
  const own = pathArea([circle(0, 0, 10)]);
  near(pathArea(selfUnion([reverse(circle(0, 0, 10))])), own, 1e-9);
});

test('selfUnion collapses two overlapping contours of one path into one', () => {
  const s = selfUnion([rect(0, 0, 10, 10), rect(5, 5, 15, 15)]);
  assert.equal(s.length, 1);
  near(pathArea(s), 175, 1e-12);
});

test('selfUnion collapses a contour traced twice', () => {
  // Winding 2 everywhere inside, and no crossing anywhere to split at. Under nonzero the
  // region is the disc once, and the doubled boundary must not survive doubled.
  const twice: GeomPath = [circle(0, 0, 10), circle(0, 0, 10)];
  assert.equal(windingNumber(twice, 0, 0), 2, 'the fixture should be wound twice');
  const s = selfUnion(twice);
  assert.equal(s.length, 1);
  assert.equal(curveCount(s), 4, 'the shared boundary must survive once');
  near(pathArea(s), pathArea([circle(0, 0, 10)]), 1e-9);
});

test('selfUnion reads a same-wound inner contour by the fill rule it is given', () => {
  const nested: GeomPath = [rect(0, 0, 10, 10), rect(3, 3, 7, 7)];
  near(pathArea(selfUnion(nested)), 100, 1e-12);                          // nonzero: solid
  near(pathArea(selfUnion(nested, { fillRule: 'evenodd' })), 84, 1e-12);  // even-odd: a hole
});

test('selfUnion orients BOTH lobes of a self-touching figure interior-left', () => {
  // Two squares meeting at one corner, traced as a single contour, the second lobe wound
  // the other way. Under nonzero both lobes are filled (winding +1 and -1), so the
  // canonical form is two counter-clockwise loops of area 100 each. The contact sits
  // exactly on a vertex, where no split parameter is recorded, so a contour handed back
  // untouched would have its lobes cancel.
  const fig = poly([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0], [0, -10], [-10, -10], [-10, 0]]);
  assert.equal(windingNumber([fig], 5, 5), 1);
  assert.equal(windingNumber([fig], -5, -5), -1, 'the fixture must have oppositely wound lobes');
  const s = selfUnion([fig]);
  near(pathArea(s), 200, 1e-9);
});

test('selfUnion collapses a retraced spur', () => {
  // A zero-width slit into a square: the same edge traversed both ways. "Overlapping
  // material collapses" is the promise, and an opposed pair of coincident edges encloses
  // nothing between them, so neither copy belongs to the boundary of the result.
  const slit = poly([[0, 0], [10, 0], [10, 10], [5, 10], [5, 5], [5, 10], [0, 10]]);
  const s = selfUnion([slit]);
  near(pathArea(s), 100, 1e-12);
  // Counting curves would over-specify - the top edge may legitimately stay in two
  // pieces - but a surviving retraced pair is unambiguous.
  const curves = allCurves(s);
  for (let i = 0; i < curves.length; i++) {
    for (let j = i + 1; j < curves.length; j++) {
      const a = curves[i]!, b = curves[j]!;
      const opposed = Math.hypot(a[0] - b[6], a[1] - b[7]) < 1e-9
                   && Math.hypot(a[6] - b[0], a[7] - b[1]) < 1e-9;
      assert.ok(!opposed, `curves ${i} and ${j} retrace each other — the spur survived`);
    }
  }
});

// ── analytic: circles, against their own area ─────────────────────────────────

test('union plus intersection equals the sum of the operands, exactly', () => {
  // Set algebra that holds for any two regions, so it tests the operators without
  // needing to know what the areas are. It is the strongest exact statement available
  // about curved operands.
  const a = [circle(0, 0, 10)], b = [circle(9, 3, 7)];
  const sum = pathArea(a) + pathArea(b);
  near(pathArea(unionPath(a, b)) + pathArea(intersectPath(a, b)), sum, 1e-8);
  near(pathArea(differencePath(a, b)) + pathArea(intersectPath(a, b)), pathArea(a), 1e-8);
  near(pathArea(xorPath(a, b)), pathArea(unionPath(a, b)) - pathArea(intersectPath(a, b)), 1e-6);
});

test('a circle inside a circle', () => {
  const big = [circle(0, 0, 20)], small = [circle(0, 0, 5)];
  const aBig = pathArea(big), aSmall = pathArea(small);
  near(pathArea(unionPath(big, small)), aBig, 1e-9);
  near(pathArea(intersectPath(big, small)), aSmall, 1e-9);
  near(pathArea(differencePath(big, small)), aBig - aSmall, 1e-9);
  assert.equal(differencePath(big, small).length, 2, 'the subtracted disc becomes a hole');
  near(pathArea(xorPath(big, small)), aBig - aSmall, 1e-9);
});

test('identical circles: coincident boundary throughout', () => {
  // No isolated crossing exists anywhere on the boundary, which is the case that
  // silently doubles the outline in implementations that split on scattered hits.
  const c = [circle(0, 0, 10)];
  const own = pathArea(c);
  near(pathArea(unionPath(c, c)), own, 1e-9);
  assert.equal(curveCount(unionPath(c, c)), 4, 'the shared boundary must survive once');
  near(pathArea(intersectPath(c, c)), own, 1e-9);
  assert.deepEqual(differencePath(c, c), []);
  assert.deepEqual(xorPath(c, c), []);
});

test('the same circle cut into eight curves instead of four still coincides', () => {
  // Geometrically identical, parametrically not: each of B's curves covers half of one of
  // A's. `coincidence` proves identity by agreeing at four fixed parameters and cannot see
  // this, so the overlap has to be found by projecting endpoints instead. It is not an
  // exotic input - it is what an offset produces the moment its output is recombined.
  const four = circle(0, 0, 10);
  const eight: Contour = { closed: true, curves: four.curves.flatMap((k) => splitCubic(k, 0.5)) };
  const own = pathArea([four]);
  near(pathArea(unionPath([four], [eight])), own, 1e-9);
  near(pathArea(intersectPath([four], [eight])), own, 1e-9);
  assert.deepEqual(differencePath([four], [eight]), [], 'the doubled boundary survived');
  assert.deepEqual(xorPath([four], [eight]), []);
});

test('a circle against its own reverse', () => {
  // Every curve is shared and opposed. A union still sees one disc; a difference sees
  // nothing, because two opposed copies of a boundary enclose nothing between them.
  const c = [circle(0, 0, 10)], rc = [reverse(circle(0, 0, 10))];
  near(pathArea(unionPath(c, rc)), pathArea(c), 1e-9);
  assert.equal(unionPath(c, rc).length, 1);
  assert.deepEqual(differencePath(c, rc), []);
});

test('a union of two circles stays eight curves and none of them straight', () => {
  // The whole premise in one assertion. Two four-curve circles crossing twice can produce
  // at most 8 + 2*2 pieces; a flattening implementation produces hundreds, all straight.
  const a = [circle(0, 0, 10)], b = [circle(10, 0, 10)];
  const crossings = a[0]!.curves.reduce((n, p) =>
    n + b[0]!.curves.reduce((m, q) => m + intersectCubics(p, q).length, 0), 0);
  assert.equal(crossings, 2, 'the fixture should cross exactly twice');
  const u = unionPath(a, b);
  assert.ok(curveCount(u) <= 8 + 2 * crossings, `${curveCount(u)} curves from 8 inputs`);
  assert.equal(allCurves(u).filter((k) => isLineCubic(k, 1e-6)).length, 0,
    'a circular arc came out straight — the boundary was flattened');
});

// ── residual ──────────────────────────────────────────────────────────────────

test('every output point lies ON an input curve, to machine precision', () => {
  const a = [circle(0, 0, 10)], b = [circle(11, 4, 9)];
  const inputs = [...a[0]!.curves, ...b[0]!.curves];
  for (const op of ['union', 'intersection', 'difference', 'xor'] as const) {
    const r = booleanPath(a, b, op);
    const worst = worstResidual(r, inputs);
    // Measured ~2e-14. A subdivision or flattening implementation lands near its own
    // tolerance instead, which is why this is asserted at machine scale and not at 1e-3.
    assert.ok(worst < 1e-9, `${op}: worst residual ${worst.toExponential(3)}`);
  }
});

test('residual survives a wiggly pair with six crossings', () => {
  const a: Contour = { closed: true, curves: [[0, 0, 40, 120, 80, -40, 120, 60], [120, 60, 140, 90, 60, 140, 0, 0]] as Cubic[] };
  const b: Contour = { closed: true, curves: [[10, 90, 60, -30, 60, 110, 110, 10], [110, 10, 150, 60, 60, 120, 10, 90]] as Cubic[] };
  const inputs = [...a.curves, ...b.curves];
  for (const op of ['union', 'intersection', 'difference', 'xor'] as const) {
    const r = booleanPath([a], [b], op);
    assert.ok(worstResidual(r, inputs) < 1e-9, `${op}: ${worstResidual(r, inputs).toExponential(3)}`);
  }
  near(pathArea(unionPath([a], [b])) + pathArea(intersectPath([a], [b])),
    pathArea(selfUnion([a])) + pathArea(selfUnion([b])), 1e-6);
});

test('every output contour is closed and every join meets', () => {
  const a = [circle(0, 0, 10)], b = [circle(11, 4, 9)];
  for (const op of ['union', 'intersection', 'difference', 'xor'] as const) {
    assertClosedContours(booleanPath(a, b, op));
  }
  assertClosedContours(unionPath([rect(0, 0, 10, 10)], [rect(5, 5, 15, 15)]));
  assertClosedContours(selfUnion([poly([[0, 0], [10, 10], [10, 0], [0, 10]])]));
});

test('curve count stays proportional to the input, never polygonal', () => {
  // Every operator on a pair of shapes with k crossings can emit at most (curves + 2k)
  // pieces: each crossing cuts one curve of each operand in two. Anything far above that
  // means the geometry was resampled.
  const a: GeomPath = [circle(0, 0, 10), circle(30, 0, 10)];
  const b: GeomPath = [rect(-5, -3, 35, 3)];
  const inCurves = curveCount(a) + curveCount(b);
  let crossings = 0;
  for (const p of allCurves(a)) for (const q of allCurves(b)) crossings += intersectCubics(p, q).length;
  for (const op of ['union', 'intersection', 'difference', 'xor'] as const) {
    const n = curveCount(booleanPath(a, b, op));
    assert.ok(n <= inCurves + 2 * crossings,
      `${op}: ${n} curves from ${inCurves} inputs and ${crossings} crossings`);
  }
});

test('a boolean result feeds straight back in without drifting', () => {
  // Compounding is where flattening error becomes visible; five rounds of it here.
  const start = [circle(0, 0, 20)];
  let acc = start;
  for (let i = 0; i < 5; i++) acc = unionPath(acc, [circle(4 * i, 3, 6)]);
  assertClosedContours(acc);
  const back = differencePath(acc, acc);
  assert.deepEqual(back, [], 'X - X must be empty however X was built');
  near(pathArea(unionPath(acc, acc)), pathArea(acc), 1e-8);
});

test('the result is canonical, so both fill rules read it identically', () => {
  // What BooleanOptions.fillRule promises: the rule describes the OPERANDS, never the
  // output. That is only true if the output has no overlapping or nested-same-wound
  // material left in it, so it is a statement about the result being fully resolved.
  const a = [circle(0, 0, 10)], b = [circle(10, 4, 10)];
  for (const op of ['union', 'intersection', 'difference', 'xor'] as const) {
    const r = booleanPath(a, b, op);
    let bad = 0, total = 0;
    for (const [x, y] of gridPoints({ x0: -25, y0: -25, x1: 25, y1: 25 }, 60)) {
      if (pointInPath(r, x, y, 'nonzero') !== pointInPath(r, x, y, 'evenodd')) bad++;
      total++;
    }
    assert.equal(bad, 0, `${op}: ${bad}/${total} points read differently under the two rules`);
  }
});

// ── dense oracle ──────────────────────────────────────────────────────────────

test('every operator agrees with a flattened brute-force region test', () => {
  const a = [circle(0, 0, 10)], b = [circle(10, 4, 10)];
  const box = { x0: -25, y0: -25, x1: 25, y1: 25 };
  for (const op of ['union', 'intersection', 'difference', 'xor'] as const) {
    const { bad, total } = gridDisagreements(a, b, booleanPath(a, b, op), op, box, 100);
    assert.equal(bad, 0, `${op}: ${bad}/${total} sample points disagree with the dense oracle`);
  }
});

test('the dense oracle also agrees on a shape with a hole', () => {
  const donut: GeomPath = [circle(0, 0, 20), reverse(circle(0, 0, 12))];
  const bar: GeomPath = [rect(-30, -4, 30, 4)];
  const box = { x0: -32, y0: -25, x1: 32, y1: 25 };
  for (const op of ['union', 'intersection', 'difference', 'xor'] as const) {
    const { bad, total } = gridDisagreements(donut, bar, booleanPath(donut, bar, op), op, box, 90);
    assert.equal(bad, 0, `${op}: ${bad}/${total} disagree`);
  }
});

test('pointInPath on the result agrees with the flattened operands', () => {
  const a = [circle(0, 0, 10)], b = [circle(10, 4, 10)];
  const u = unionPath(a, b);
  const fa = flatRings(a), fb = flatRings(b);
  let bad = 0, total = 0;
  for (const [x, y] of gridPoints({ x0: -25, y0: -25, x1: 25, y1: 25 }, 70)) {
    const want = ringWinding(fa, x, y) !== 0 || ringWinding(fb, x, y) !== 0;
    if (want !== pointInPath(u, x, y)) bad++;
    total++;
  }
  assert.equal(bad, 0, `${bad}/${total} points classified differently from the oracle`);
});

// ── winding and point tests ───────────────────────────────────────────────────

test('windingNumber is +1 inside a counter-clockwise contour and -1 reversed', () => {
  assert.equal(windingNumber([rect(0, 0, 10, 10)], 5, 5), 1);
  assert.equal(windingNumber([reverse(rect(0, 0, 10, 10))], 5, 5), -1);
  assert.equal(windingNumber([rect(0, 0, 10, 10)], 50, 5), 0);
  assert.equal(windingNumber([circle(0, 0, 10)], 0, 0), 1);
  assert.equal(windingNumber([circle(0, 0, 10)], 30, 0), 0);
});

test('windingNumber counts nesting, which is what separates the two fill rules', () => {
  const nested: GeomPath = [rect(0, 0, 10, 10), rect(3, 3, 7, 7)];
  assert.equal(windingNumber(nested, 5, 5), 2);
  assert.equal(windingNumber(nested, 1, 1), 1);
  assert.equal(pointInPath(nested, 5, 5, 'nonzero'), true);
  assert.equal(pointInPath(nested, 5, 5, 'evenodd'), false);
  assert.equal(pointInPath(nested, 1, 1, 'evenodd'), true);
});

test('windingNumber is zero inside a hole, under either rule', () => {
  const donut: GeomPath = [circle(0, 0, 20), reverse(circle(0, 0, 12))];
  assert.equal(windingNumber(donut, 0, 0), 0);
  assert.equal(windingNumber(donut, 16, 0), 1);
  assert.equal(pointInPath(donut, 0, 0, 'nonzero'), false);
  assert.equal(pointInPath(donut, 0, 0, 'evenodd'), false);
  assert.equal(pointInPath(donut, 16, 0, 'evenodd'), true);
});

test('windingNumber matches the flattened oracle over a curvy path', () => {
  const p: GeomPath = [{ closed: true, curves: [
    [0, 0, 60, 140, 140, -60, 200, 40],
    [200, 40, 240, 120, 120, 200, 40, 140],
    [40, 140, 10, 110, -20, 60, 0, 0],
  ] as Cubic[] }];
  const rings = flatRings(p, 0.001);
  let bad = 0, total = 0;
  for (const [x, y] of gridPoints({ x0: -40, y0: -40, x1: 260, y1: 220 }, 80)) {
    if (windingNumber(p, x, y) !== ringWinding(rings, x, y)) bad++;
    total++;
  }
  assert.equal(bad, 0, `${bad} of ${total} winding numbers differ from the dense oracle`);
});

test('windingNumber refuses non-finite coordinates rather than looping', () => {
  assert.equal(windingNumber([rect(0, 0, 10, 10)], Number.NaN, 5), 0);
  assert.equal(windingNumber([rect(0, 0, 10, 10)], 5, Number.POSITIVE_INFINITY), 0);
  assert.equal(windingNumber([], 5, 5), 0);
});

test('pointInPath defaults to nonzero', () => {
  const nested: GeomPath = [rect(0, 0, 10, 10), rect(3, 3, 7, 7)];
  assert.equal(pointInPath(nested, 5, 5), pointInPath(nested, 5, 5, 'nonzero'));
});

// ── the named traps ───────────────────────────────────────────────────────────

test('a tangency at a shared vertex does not merge or lose anything', () => {
  // Two circles touching at (10,0), which is a curve endpoint on both.
  const a = [circle(0, 0, 10)], b = [circle(20, 0, 10)];
  const u = unionPath(a, b);
  near(pathArea(u), pathArea(a) + pathArea(b), 1e-9);
  assert.equal(u.length, 2, 'point contact is not overlap');
  assert.deepEqual(intersectPath(a, b), []);
});

test('a straight edge tangent to a curve at an interior point', () => {
  // The line x + y = 10*sqrt(2) sits at distance 10 from the origin, and the cubic circle
  // passes exactly through its 45 degree point, so the contact is exact rather than an
  // artefact of the approximation. That point is t=0.5 of an arc - the exact midpoint at
  // which that piece gets classified.
  const d = 10 * Math.SQRT2;
  const tri = [poly([[d, 0], [0, d], [60, 60]])];
  const c = [circle(0, 0, 10)];
  near(pathArea(unionPath(c, tri)), pathArea(c) + Math.abs(pathArea(tri)), 1e-9);
  assert.deepEqual(intersectPath(c, tri), []);
});

test('two curves tangent at an interior point keep both boundaries', () => {
  // Contact without crossing must not toggle the winding, and must not delete an edge
  // either. The contact here is at 45 degrees, which is the exact midpoint of an arc on
  // both circles - so the piece being classified is decided AT the ambiguous point.
  const s = Math.SQRT1_2 * 20;
  const a = [circle(0, 0, 10)], b = [circle(s, s, 10)];
  const u = unionPath(a, b);
  near(pathArea(u), pathArea(a) + pathArea(b), 1e-8);
  assert.deepEqual(intersectPath(a, b), []);
});

test('two arches touching at their peaks keep both regions', () => {
  // An arch peaking at exactly (50,75) and another dipping to exactly (50,75): a single
  // point of contact between two cubics, at t=0.5 on each and with a shared horizontal
  // tangent. The intersector reports no hit for it at all, so unless the contact search
  // finds it, each arch is judged at the one point where its winding has no value.
  const up: GeomPath = [{ closed: true, curves: [[0, 0, 0, 100, 100, 100, 100, 0] as Cubic] }];
  const down: GeomPath = [{ closed: true, curves: [[0, 150, 0, 50, 100, 50, 100, 150] as Cubic] }];
  near(pathArea(selfUnion(up)), 6000, 1e-9);
  near(pathArea(selfUnion(down)), 6000, 1e-9);
  const u = unionPath(up, down);
  assertClosedContours(u);
  assert.equal(u.length, 2, `point contact leaves two regions, got ${u.length}`);
  near(pathArea(u), 12000, 1e-6);
});

test('circles tangent internally at an interior point', () => {
  // Centres 6 apart along the diagonal for radii 10 and 4, so the small disc kisses the
  // big one from the inside at the 45 degree point both pass exactly through. Internal
  // contact is the case an offset produces every time an inner ring just reaches the
  // outline.
  const u = (10 - 4) / Math.SQRT2;
  const big = [circle(0, 0, 10)], small = [circle(u, u, 4)];
  near(pathArea(unionPath(big, small)), pathArea(big), 1e-8);
  near(pathArea(differencePath(big, small)), pathArea(big) - pathArea(small), 1e-8);
});

test('a tangency is not a coincident run — internal contact, at four scales', () => {
  // The regression this file most needed. B sits strictly inside A and kisses it at ONE
  // point, so every operator is settled by the operands' own areas: A∪B = A, A∩B = B,
  // A−B = A⊕B = A−B's ring. Read as a coincident run instead, the shared "overlap" was
  // decided once and the contact point's edges went the wrong way: 1285.550741 /
  // 428.494467 / 1057.056275 against the 1256.988933 / 314.247233 / 942.741700 below - 
  // 36% wrong on the intersection.
  //
  // Contact at the 45° point, where kappa makes the cubic circle exact. A tangency
  // anywhere else is a shallow double crossing of the APPROXIMATION, and an exact
  // expectation there would be wrong by ~0.009 - ratifying an error instead of testing one.
  //
  // Four scales, because that is the property rather than the instance: the old code was
  // wrong at 12 of 80 such cases with relative errors to 377%, so a single-scale fixture
  // could easily have been one of the 68 it got right.
  for (const s of [1e-2, 1, 1e3, 1e6]) {
    const A = [circle(0, 0, 20 * s)];
    const B = [circle((10 * s) / Math.SQRT2, (10 * s) / Math.SQRT2, 10 * s)];
    const rel = (got: number, want: number, what: string) =>
      assert.ok(Math.abs(got - want) <= Math.abs(want) * 1e-7,
        `s=${s} ${what}: ${got / (s * s)} !== ${want / (s * s)} (scaled)`);
    const aA = pathArea(A), aB = pathArea(B);
    rel(pathArea(unionPath(A, B)), aA, 'union is A');
    rel(pathArea(intersectPath(A, B)), aB, 'intersection is B');
    rel(pathArea(differencePath(A, B)), aA - aB, 'difference is the ring');
    rel(pathArea(xorPath(A, B)), aA - aB, 'xor is the ring too');
    // And the absolute numbers, so a change of fixture cannot quietly move the target.
    rel(pathArea(unionPath(A, B)), 1256.9889330832492 * s * s, 'union, absolute');
    rel(pathArea(intersectPath(A, B)), 314.2472332708123 * s * s, 'intersection, absolute');
    rel(pathArea(differencePath(A, B)), 942.7417 * s * s, 'difference, absolute');
    assert.equal(unionPath(A, B).length, 1, `s=${s}: internal contact leaves one outline`);
    assertClosedContours(differencePath(A, B), Math.max(JOIN_EPS, JOIN_EPS * s));
  }
});

test('a tangency is not a coincident run — external contact, at four scales', () => {
  // The other side of the same property: B outside A, touching at one 45° point. Union is
  // both discs and intersection is empty, and neither may see an overlap to collapse.
  for (const s of [1e-2, 1, 1e3, 1e6]) {
    const A = [circle(0, 0, 20 * s)];
    const B = [circle((30 * s) / Math.SQRT2, (30 * s) / Math.SQRT2, 10 * s)];
    const rel = (got: number, want: number, what: string) =>
      assert.ok(Math.abs(got - want) <= Math.abs(want) * 1e-7,
        `s=${s} ${what}: ${got / (s * s)} !== ${want / (s * s)} (scaled)`);
    const aA = pathArea(A), aB = pathArea(B);
    rel(pathArea(unionPath(A, B)), aA + aB, 'union is both discs');
    rel(pathArea(unionPath(A, B)), 1571.2361663540615 * s * s, 'union, absolute');
    assert.deepEqual(intersectPath(A, B), [], `s=${s}: point contact is not overlap`);
    rel(pathArea(differencePath(A, B)), aA, 'difference is all of A');
    rel(pathArea(xorPath(A, B)), aA + aB, 'xor is both discs');
    // The contour COUNT is not the invariant here and is not asserted: the two discs meet
    // at a pinch point, and a walk may legitimately come back either as two loops or as
    // one that passes through the contact (both happen across these scales). The region
    // is the invariant, so it is stated as a region.
    const u = unionPath(A, B);
    assert.ok(u.length <= 2, `s=${s}: two discs cannot need ${u.length} contours`);
    const c = (20 * s) / Math.SQRT2;                   // the contact point
    assert.equal(pointInPath(u, 0, 0), true, `s=${s}: A's centre is painted`);
    assert.equal(pointInPath(u, (30 * s) / Math.SQRT2, (30 * s) / Math.SQRT2), true,
      `s=${s}: B's centre is painted`);
    assert.equal(pointInPath(u, c + (2 * s) / Math.SQRT2, c - (2 * s) / Math.SQRT2), false,
      `s=${s}: beside the contact is outside both discs`);
  }
});

test('consecutive segments sharing an endpoint are not intersections', () => {
  // If they were, every polygon vertex would be a split and a four-sided square would
  // come back with eight curves.
  const u = unionPath([rect(0, 0, 10, 10)], [rect(100, 100, 110, 110)]);
  assert.equal(curveCount(u), 8, `two untouched squares must stay four curves each, got ${curveCount(u)}`);
});

test('a contour reversed against itself annihilates', () => {
  const a = [rect(0, 0, 10, 10)], b = [reverse(rect(0, 0, 10, 10))];
  // Every edge is shared and opposed. Union sees one region; difference sees none.
  near(pathArea(unionPath(a, b)), 100, 1e-12);
  assert.deepEqual(differencePath(a, b), []);
});

test('difference is not "intersect with a reversed operand"', () => {
  // B here is two nested same-wound contours, whose interior under nonzero is the whole
  // outer square. Reversing it would make the inner square doubly wound the other way
  // rather than a hole, and the shortcut would leave a phantom ring behind.
  const a = [rect(-5, -5, 15, 15)];
  const b: GeomPath = [rect(0, 0, 10, 10), rect(3, 3, 7, 7)];
  near(pathArea(booleanPath(a, b, 'difference')), 300, 1e-12);
  near(pathArea(booleanPath(a, b, 'difference', { fillRule: 'evenodd' })), 316, 1e-12);
});

test('operands are read by the fill rule the caller declares', () => {
  const donut: GeomPath = [rect(0, 0, 10, 10), rect(3, 3, 7, 7)];
  const bar = [rect(4, -2, 6, 12)];
  near(pathArea(booleanPath(donut, bar, 'union', { fillRule: 'evenodd' })), 100, 1e-12);
  near(pathArea(booleanPath(donut, bar, 'union', { fillRule: 'nonzero' })), 108, 1e-12);
});

test('difference is not commutative, and B−A is the other crescent', () => {
  const a = [circle(0, 0, 10)], b = [circle(9, 3, 7)];
  const ab = pathArea(differencePath(a, b)), ba = pathArea(differencePath(b, a));
  assert.ok(Math.abs(ab - ba) > 1, 'the fixture should be asymmetric');
  near(ab + ba, pathArea(xorPath(a, b)), 1e-6);
});

// ── degenerate and empty input ────────────────────────────────────────────────

test('an empty operand resolves every operator', () => {
  const a = [rect(0, 0, 1, 1)];
  near(pathArea(unionPath([], a)), 1, 1e-12);
  near(pathArea(unionPath(a, [])), 1, 1e-12);
  assert.deepEqual(intersectPath([], a), []);
  assert.deepEqual(intersectPath(a, []), []);
  near(pathArea(differencePath(a, [])), 1, 1e-12);
  assert.deepEqual(differencePath([], a), []);
  near(pathArea(xorPath([], a)), 1, 1e-12);
  assert.deepEqual(unionPath([], []), []);
  assert.deepEqual(selfUnion([]), []);
});

test('NaN coordinates and point contours are dropped, not propagated', () => {
  const bad: GeomPath = [{ closed: true, curves: [[Number.NaN, 0, 1, 1, 2, 2, 3, 3] as Cubic] }];
  const point: GeomPath = [{ closed: true, curves: [[5, 5, 5, 5, 5, 5, 5, 5] as Cubic] }];
  near(pathArea(unionPath(bad, [rect(0, 0, 1, 1)])), 1, 1e-12);
  near(pathArea(unionPath(point, [rect(0, 0, 1, 1)])), 1, 1e-12);
  for (const k of allCurves(unionPath(bad, [rect(0, 0, 1, 1)]))) {
    for (const v of k) assert.ok(Number.isFinite(v), 'a NaN reached the output');
  }
});

test('an open contour is closed rather than discarded', () => {
  // Booleans are defined on regions; silently dropping an open contour would lose
  // geometry the caller passed in.
  const open: Contour = { curves: [lineToCubic(0, 0, 10, 0), lineToCubic(10, 0, 10, 10)], closed: false };
  near(pathArea(unionPath([open], [rect(20, 20, 21, 21)])), 51, 1e-12);   // triangle 50 + 1
  assert.ok(unionPath([open], []).every((c) => c.closed));
});

test('the same answer at a thousandth of the scale and at a millionfold', () => {
  // The weld radius is relative to the operands' span, so nothing should depend on the
  // absolute size of the coordinates.
  for (const s of [1e-3, 1, 1e6]) {
    const u = unionPath([rect(0, 0, s, s)], [rect(s / 2, 0, 1.5 * s, s)]);
    near(pathArea(u) / (s * s), 1.5, 1e-9);
    assert.equal(u.length, 1);
  }
});

// ── bounded work ──────────────────────────────────────────────────────────────

test('a mutually overlapping pile of circles resolves in bounded time', () => {
  const many: GeomPath = [];
  for (let i = 0; i < 60; i++) many.push(circle(Math.cos(i) * 40, Math.sin(i * 1.7) * 40, 18));
  const t0 = process.hrtime.bigint();
  const s = selfUnion(many);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 4000, `selfUnion of 60 overlapping circles took ${ms.toFixed(0)}ms`);
  assert.ok(s.length >= 1 && pathArea(s) > 0, 'the pile collapsed to nothing');
  assertClosedContours(s);
});

test('near-coincident operands do not spin', () => {
  // A hair apart is the case a clipper stalls on: no clean crossing, no clean overlap.
  const a = [circle(0, 0, 50)];
  const b = [circle(1e-6, 0, 50)];
  const t0 = process.hrtime.bigint();
  const u = unionPath(a, b);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 4000, `took ${ms.toFixed(0)}ms`);
  near(pathArea(u), pathArea(a), 1e-2);
});

test('input past the ceiling degrades to a finite valid answer, not a hang', () => {
  // Untrusted path data is ordinary input here - an imported SVG, a pasted glyph - so the
  // documented degradation is part of the contract: over the curve ceiling the pairwise
  // pass is skipped and the disjoint answer is returned. It must still be a path.
  const many: GeomPath = [];
  for (let i = 0; i < 9000; i++) {
    many.push(poly([[i * 2, 0], [i * 2 + 1, 0], [i * 2, 1]]));
  }
  const t0 = process.hrtime.bigint();
  const u = unionPath(many, [circle(0, 0, 5)]);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 4000, `9000 contours took ${ms.toFixed(0)}ms`);
  assert.ok(u.length > 0, 'the operands were discarded rather than passed through');
  for (const k of allCurves(u)) for (const v of k) assert.ok(Number.isFinite(v));
});

test('over the ceiling, the three operators with nothing honest to return THROW', () => {
  // 3000 axis-aligned 2×2 squares (12000 curves, past the 8000 ceiling) minus a rectangle
  // that contains every one of them. The true difference is EMPTY, and the answer a
  // disjoint pair would give is the whole of the first operand - 12000 units of area that
  // is a valid path, is silently wrong, and that no caller can tell from the real answer.
  // That is what the old fallback returned. It now refuses.
  const many: GeomPath = [];
  for (let i = 0; i < 3000; i++) {
    const x = (i % 55) * 9 + 1, y = Math.floor(i / 55) * 9 + 1;
    many.push(rect(x, y, x + 2, y + 2));
  }
  const big = [rect(0, 0, 510, 510)];
  assert.ok(curveCount(many) > 8000, `the fixture must clear the ceiling: ${curveCount(many)} curves`);
  for (const [op, fn] of [
    ['difference', differencePath], ['intersection', intersectPath], ['xor', xorPath],
  ] as const) {
    let thrown: unknown;
    try { fn(many, big); } catch (e) { thrown = e; }
    assert.ok(thrown instanceof GeomLimitError, `${op} returned a wrong answer instead of throwing`);
    assert.equal((thrown as GeomLimitError).op, op, 'the error names the operator that failed');
    assert.equal((thrown as Error).name, 'GeomLimitError');
    assert.match((thrown as Error).message, /bounded work/);
  }
  // Specifically NOT the old silent answer: difference must not hand back the operand.
  assert.throws(() => differencePath(many, big), (e: unknown) => e instanceof GeomLimitError);
  // Union is the exception, and it is exact rather than a shrug: both operands are
  // canonical and interior-left, so the concatenation's nonzero region IS A∪B. What it
  // gives up is canonical FORM - the contours still overlap where the operands did.
  const u = unionPath(many, big);
  assert.equal(u.length, 3001, `union concatenates the operands, got ${u.length} contours`);
  for (const k of allCurves(u)) for (const v of k) assert.ok(Number.isFinite(v));
  for (const [x, y] of [[1.5, 1.5], [300, 300], [509, 509]] as const) {
    assert.equal(pointInPath(u, x, y), true, `(${x},${y}) is inside A∪B`);
  }
  assert.equal(pointInPath(u, 600, 600), false, 'outside both operands');
});

test('the same answer at coordinates where an absolute epsilon is below one ulp', () => {
  // castRay's hit tolerance used to be an absolute 1e-9. At x ≈ 1e7 one ulp is 1.9e-9, so
  // the ray's own origin - which sits ON the curve being classified, at exactly u = 0 - 
  // landed a couple of ulps the wrong side of it, the curve vanished from the count, the
  // edge was classified 0/0 and deleted, and the operation returned non-closed geometry
  // with half the area.
  //
  // The oracle is translated back to the origin before integrating: at 1e8 the integrand
  // multiplies numbers of order 1e16 where one ulp is 2, so ∮x dy loses whole units of
  // area on geometry that is exact. Translating by an exactly representable offset moves
  // nothing and lets the expectation stay the rational 150 / 50 / 50.
  for (const off of [0, 5e6, 1e7, 1e8]) {
    const a = [rect(off, off, off + 10, off + 10)];
    const b = [rect(off + 5, off, off + 15, off + 10)];
    const at = (p: GeomPath) => pathArea(shiftPath(p, off, off));
    const u = unionPath(a, b), d = differencePath(a, b), i = intersectPath(a, b);
    near(at(u), 150, 1e-9, `union at ${off}`);
    near(at(d), 50, 1e-9, `difference at ${off}`);
    near(at(i), 50, 1e-9, `intersection at ${off}`);
    near(at(xorPath(a, b)), 100, 1e-9, `xor at ${off}`);
    // The failure showed up as area, but what it WAS is unclosed output.
    for (const [what, p] of [['union', u], ['difference', d], ['intersection', i]] as const) {
      assert.equal(p.length, 1, `${what} at ${off}: expected one contour, got ${p.length}`);
      assertClosedContours(shiftPath(p, off, off), 1e-9);
    }
  }
});

test('a query point that defeats every ray direction is still inside the shape', () => {
  // `windingNumber` tries twelve directions and gives up on any that hits a curve
  // endpoint. Its fallback used to be the last cast's `far`, which is a PREFIX SUM - the
  // curves the failing cast never reached are simply missing from it - so a point deep
  // inside a shape came back outside it.
  //
  // The fixture defeats all twelve at once: a 12-gon whose vertices sit exactly along the
  // module's own ray directions from the query point, so every ray leaves through a vertex.
  // The directions are reconstructed here rather than imported, which is the point - if
  // the module's list changes, this fixture stops being adversarial and says so by the
  // count below.
  const dirs: [number, number][] = [[1, 0], [0, 1]];
  for (let k = 1; k <= 10; k++) {
    const a = k * 2.399963229728653;                 // the golden angle, in radians
    dirs.push([Math.cos(a), Math.sin(a)]);
  }
  assert.equal(dirs.length, 12);
  for (const [qx, qy] of [[0, 0], [7, -3]] as const) {
    const verts = dirs
      .map((d) => ({ a: Math.atan2(d[1], d[0]), p: [qx + 100 * d[0], qy + 100 * d[1]] as [number, number] }))
      .sort((m, n) => m.a - n.a)
      .map((v) => v.p);
    const gon = [poly(verts)];
    assert.ok(pathArea(gon) > 0, 'the fixture must be counter-clockwise');
    assert.equal(windingNumber(gon, qx, qy), 1, `(${qx},${qy}) is strictly inside: winding must be 1`);
    assert.equal(pointInPath(gon, qx, qy), true, 'and pointInPath must agree');
    assert.equal(pointInPath(gon, qx, qy, 'evenodd'), true, 'under either rule');
    // Reversed, the same point is wound the other way - not zero.
    assert.equal(windingNumber([reverse(poly(verts))], qx, qy), -1, 'reversed winding');
    // Every vertex really is on a ray from the query point, or the fixture is not
    // adversarial and this test proves nothing.
    for (const v of verts) {
      const ang = Math.atan2(v[1] - qy, v[0] - qx);
      assert.ok(dirs.some((d) => Math.abs(Math.atan2(d[1], d[0]) - ang) < 1e-12),
        'a vertex drifted off its ray direction');
    }
    // Outside is still outside: the completing cast must not simply answer "inside".
    assert.equal(windingNumber(gon, qx + 500, qy), 0, 'far outside must be zero');
  }
});

test('a non-finite tolerance falls back to the default instead of returning empty', () => {
  // A NaN tolerance is not a loose one, it is a poisoned one: the weld radius becomes NaN,
  // every comparison against it is false, and the operation returned an empty path with
  // nothing to say it had been skipped. Both NaN and Infinity come out of arithmetic on an
  // unset dimension upstream, so they arrive as ordinary input.
  const a = [rect(0, 0, 10, 10)], b = [rect(5, 0, 15, 10)];
  for (const tol of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 0]) {
    near(pathArea(unionPath(a, b, { tol })), 150, 1e-9, `union at tol ${tol}`);
    near(pathArea(intersectPath(a, b, { tol })), 50, 1e-9, `intersection at tol ${tol}`);
    near(pathArea(differencePath(a, b, { tol })), 50, 1e-9, `difference at tol ${tol}`);
    near(pathArea(selfUnion(a, { tol })), 100, 1e-9, `selfUnion at tol ${tol}`);
    assert.equal(unionPath(a, b, { tol }).length, 1, `tol ${tol}: one contour`);
  }
  // A usable tolerance is still honoured - the conditioning must not swallow every value.
  near(pathArea(unionPath(a, b, { tol: 1e-6 })), 150, 1e-6);
});

test('a curve recombined with a sub-range of itself is exact, and fast', () => {
  // The composition Stage 3 lives on: an offset is self-unioned and then combined again,
  // so an operand's boundary is routinely a PIECE of the other's - geometrically the same
  // curve, differently parameterised. Asking an intersector for isolated crossings that do
  // not exist is what makes this composition grind, so the time is asserted too.
  const arch: Cubic = [0, 0, 30, 90, 70, 90, 100, 0];
  const whole: GeomPath = [{ closed: true, curves: [arch] }];
  const part: GeomPath = [{ closed: true, curves: [subCubic(arch, 0.25, 0.75)] }];
  const wholeArea = Math.abs(pathArea(whole)), partArea = Math.abs(pathArea(part));
  const t0 = process.hrtime.bigint();
  const d = differencePath(whole, part);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  near(pathArea(d), wholeArea - partArea, 1e-6);
  assert.ok(ms < 1000, `two curves and a chord each took ${ms.toFixed(0)}ms`);
});

// ── operator algebra ──────────────────────────────────────────────────────────

test('the identities hold on polygonal operands, exactly', () => {
  const a = [rect(0, 0, 10, 10)], b = [rect(6, 4, 20, 20)];
  const u = unionPath(a, b), i = intersectPath(a, b), d = differencePath(a, b), x = xorPath(a, b);
  near(pathArea(differencePath(u, b)), pathArea(d), 1e-12);             // (A∪B)−B = A−B
  near(pathArea(differencePath(u, i)), pathArea(x), 1e-12);             // A⊕B = (A∪B)−(A∩B)
  near(pathArea(differencePath(a, d)), pathArea(i), 1e-12);             // A−(A−B) = A∩B
  near(pathArea(unionPath(b, a)), pathArea(u), 1e-12);                  // commutative
  near(pathArea(intersectPath(b, a)), pathArea(i), 1e-12);
});

test('the identities hold on curved operands', () => {
  // Tolerance derived from the intersector's contract rather than picked: it pins a
  // crossing to EPS = 1e-9 in POSITION, and a boundary ~100 units long displaced by that
  // much moves the enclosed area by ~1e-7. Anything tighter would be testing the root
  // solver, not the operators.
  const a = [circle(0, 0, 10)], b = [circle(9, 3, 7)];
  const u = unionPath(a, b), i = intersectPath(a, b), x = xorPath(a, b);
  near(pathArea(u) + pathArea(i), pathArea(a) + pathArea(b), 1e-6);
  near(pathArea(differencePath(u, i)), pathArea(x), 1e-6);              // A⊕B = (A∪B)−(A∩B)
  near(pathArea(unionPath(b, a)), pathArea(u), 1e-6);                   // commutative
  near(pathArea(intersectPath(b, a)), pathArea(i), 1e-6);
});

// ── evidence at the size of the tolerance ─────────────────────────────────────

test('a shared edge broken into a weld-scale piece still unions to the whole rectangle', () => {
  // The shared edge between the two squares carries a sub-piece 1.5e-5 long, which for a
  // 100-unit span is one and a half weld radii - short enough that `coincidence` cannot tell
  // "the same curve running the other way" from "the same curve running the same way", since
  // both are decided by positions known only to that radius. `dedupeEdges` therefore leaves
  // such a pair alone instead of annihilating it on the strength of a rounding, and the
  // second copy stays in the edge set.
  //
  // This is the guard's cost, and the point of the test is that it costs nothing: the surplus
  // sliver is shorter than the radius the walk joins edges at, so both copies leave the same
  // vertex, one is never taken, and the union is still exactly the 100×200 rectangle. What the
  // guard buys is in the stroke suite, where annihilating one such sliver broke a chain and
  // lost a whole lobe.
  const m = 50, e = m + 1.5e-5;
  const top = poly([[0, 0], [m, 0], [e, 0], [100, 0], [100, 100], [0, 100]]);
  const bottom = poly([[100, 0], [e, 0], [m, 0], [0, 0], [0, -100], [100, -100]]);
  const out = unionPath([top], [bottom]);
  assertClosedContours(out);
  near(pathArea(out), 20000, 1e-6, 'two squares sharing a broken edge');
  assert.equal(out.length, 1, 'the union of two squares meeting along an edge is one region');
  // And the shared edge itself is gone from the interior - nothing survives across y = 0
  // except the two outer verticals.
  assert.ok(pointInPath(out, 50, 0.5, 'nonzero') && pointInPath(out, 50, -0.5, 'nonzero'),
    'both halves are filled');
});
