// SPDX-License-Identifier: MPL-2.0
/**
 * Stroke outlining (engine/src/geom/stroke.ts).
 *
 * ## How this is checked
 *
 * The same three oracles as the intersector suite, aimed at a region rather than at a
 * point:
 *
 * 1. **Analytic** - strokes whose area is a rational number. A straight segment stroked
 *    butt is a rectangle; a square ring is the difference of two squares; two
 *    perpendicular strokes crossing at their midpoints overlap in exactly one square of
 *    side w. And the identity that reaches curves too: for a stroke that does not
 *    self-overlap the area is exactly `width × centreline length`, because the curvature
 *    terms on the two sides cancel - the outer edge gains w/2·∫κ of length and the inner
 *    loses it. That makes a curved fixture checkable without ever naming a circle, and it
 *    is what settles a stroked circle as well: an annulus is `width × perimeter`.
 * 2. **Residual** - properties every output must satisfy whatever the shape. Contours
 *    joined end-to-start within `JOIN_EPS`; curve count proportional to the input,
 *    because turning a 4-curve circle into 400 curves is the failure this module exists
 *    to prevent; and two distance claims of different strength - the outline's KNOTS sit
 *    at exactly w/2 from the source to machine precision, since an offset piece's
 *    endpoints are a source point plus w/2 along an exact normal, while the interior of
 *    each piece is only within the fitting tolerance asked for.
 * 3. **Dense oracle** - a grid classified by an independent distance test built on
 *    `flattenCubic` + `nearestOnCubic`, checked against the module's own `pointInPath`.
 *    Flattening is forbidden inside the geometry and perfectly good outside it. A stroke
 *    whose caps and joins are both round is exactly the Minkowski sum of the centreline
 *    with a disc, so the distance test decides every point in the plane with no reference
 *    to the outline at all.
 *
 * Circles are compared against the same kappa construction the module draws its caps
 * with, never against πr². Checking an exact result against an idealised value rather
 * than against the same curve makes correct code look broken - that mistake cost an
 * afternoon in the intersector suite and is written down in the plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Cubic, type Pt, evalCubic, flattenCubic, isLineCubic, lengthCubic, lineToCubic,
  nearestOnCubic,
} from '../engine/src/geom/bezier.ts';
import {
  type Contour, type GeomPath, JOIN_EPS, contourArea, pathBounds, reverseContour,
} from '../engine/src/geom/path.ts';
import { pointInPath } from '../engine/src/geom/boolean.ts';
import { strokeToPath } from '../engine/src/geom/stroke.ts';

// ── fixtures ──────────────────────────────────────────────────────────────────

/** The quarter-circle control handle length. The same constant stroke.ts uses, so a
 *  cap drawn there and a reference circle built here are the same curve. */
const KAPPA = 0.5522847498307936;

function openSeg(x0: number, y0: number, x1: number, y1: number): GeomPath {
  return [{ curves: [lineToCubic(x0, y0, x1, y1)], closed: false }];
}

/** A polyline as one contour. Every edge explicit, including the closing one - the
 *  distance oracles measure against real curves and cannot see an implicit wrap. */
function poly(pts: readonly (readonly [number, number])[], closed: boolean): Contour {
  const curves: Cubic[] = [];
  for (let i = 1; i < pts.length; i++) {
    curves.push(lineToCubic(pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1]));
  }
  if (closed) {
    const a = pts[pts.length - 1]!, b = pts[0]!;
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > JOIN_EPS) curves.push(lineToCubic(a[0], a[1], b[0], b[1]));
  }
  return { curves, closed };
}

function rectPath(x: number, y: number, w: number, h: number): GeomPath {
  return [poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true)];
}

/** Circle as four kappa quarter arcs, counter-clockwise. */
function circleContour(cx: number, cy: number, r: number): Contour {
  const k = KAPPA * r;
  const q = (ax: number, ay: number, bx: number, by: number): Cubic => [
    cx + r * ax, cy + r * ay,
    cx + r * ax + k * bx, cy + r * ay + k * by,
    cx + r * bx + k * ax, cy + r * by + k * ay,
    cx + r * bx, cy + r * by,
  ];
  return { curves: [q(1, 0, 0, 1), q(0, 1, -1, 0), q(-1, 0, 0, -1), q(0, -1, 1, 0)], closed: true };
}

const circlePath = (cx: number, cy: number, r: number): GeomPath => [circleContour(cx, cy, r)];

// ── oracles ───────────────────────────────────────────────────────────────────

/** Flattening tolerance for the dense oracles. At 1e-6 the inscribed polygon of a
 *  few-hundred-unit perimeter loses well under a thousandth of a unit of area, which is
 *  two orders below anything asserted here. */
const FLAT = 1e-6;

function contourPoints(c: Contour, tol: number): Pt[] {
  const pts: Pt[] = [];
  for (const k of c.curves) {
    const f = flattenCubic(k, tol);
    for (let i = pts.length ? 1 : 0; i < f.length; i++) pts.push(f[i]!);
  }
  return pts;
}

/** Oracle 3, for area: shoelace over a dense flattening. Independent of `contourArea`,
 *  which is what lets the two be compared against each other. */
function denseArea(p: GeomPath, tol = FLAT): number {
  let a = 0;
  for (const c of p) {
    const pts = contourPoints(c, tol);
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i]!, n = pts[(i + 1) % pts.length]!;
      a += q.x * n.y - n.x * q.y;
    }
  }
  return a / 2;
}

const areaOf = (p: GeomPath): number => Math.abs(denseArea(p));

/** Centreline length, for the width × length identity. Summed per curve so it works on
 *  an open contour and a closed one alike. */
function pathLength(p: GeomPath): number {
  let l = 0;
  for (const c of p) for (const k of c.curves) l += lengthCubic(k, 1e-7);
  return l;
}

/** True distance from a point to a path, exactly - `nearestOnCubic` per curve, no
 *  sampling of the curve itself. */
function distToPath(p: GeomPath, x: number, y: number): number {
  let d = Infinity;
  for (const c of p) for (const k of c.curves) {
    const n = nearestOnCubic(k, x, y, 32);
    if (n.distance < d) d = n.distance;
  }
  return d;
}

const curveCount = (p: GeomPath): number => p.reduce((n, c) => n + c.curves.length, 0);

/** Points along an output outline, for measuring where the outline actually runs.
 *  Sampling the RESULT is measurement; sampling inside the algorithm is the thing the
 *  module refuses to do. */
function sampleOutline(p: GeomPath, per = 12): Pt[] {
  const out: Pt[] = [];
  for (const c of p) for (const k of c.curves) {
    for (let i = 0; i <= per; i++) out.push(evalCubic(k, i / per));
  }
  return out;
}

/** Just the knots - where one output curve hands over to the next. These are the points
 *  the offsetter placed exactly rather than fitted. */
function outlineKnots(p: GeomPath): Pt[] {
  const out: Pt[] = [];
  for (const c of p) for (const k of c.curves) {
    out.push({ x: k[0], y: k[1] }, { x: k[6], y: k[7] });
  }
  return out;
}

const near = (a: number, b: number, eps: number, what: string) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} !== ${b} (within ${eps})`);

function nearBox(p: GeomPath, x0: number, y0: number, x1: number, y1: number, eps: number, what: string) {
  const b = pathBounds(p);
  assert.ok(b, `${what}: empty bounds`);
  near(b.x0, x0, eps, `${what} x0`); near(b.y0, y0, eps, `${what} y0`);
  near(b.x1, x1, eps, `${what} x1`); near(b.y1, y1, eps, `${what} y1`);
}

/** Oracle 2: an outline bounds a region, so every contour must come back closed and
 *  every curve must start where the last one ended. A stroke with a gap anywhere is a
 *  stroke a filler will paint wrong, however good the area looks. */
function assertJoined(p: GeomPath, what: string) {
  for (const [ci, c] of p.entries()) {
    assert.ok(c.curves.length > 0, `${what}: contour ${ci} has no curves`);
    for (let i = 1; i < c.curves.length; i++) {
      const a = c.curves[i - 1]!, b = c.curves[i]!;
      const gap = Math.hypot(b[0] - a[6], b[1] - a[7]);
      assert.ok(gap <= JOIN_EPS, `${what}: contour ${ci} breaks between curves ${i - 1} and ${i}, gap ${gap}`);
    }
    assert.equal(c.closed, true, `${what}: contour ${ci} came back open`);
    const first = c.curves[0]!, last = c.curves[c.curves.length - 1]!;
    const wrap = Math.hypot(first[0] - last[6], first[1] - last[7]);
    assert.ok(wrap <= JOIN_EPS, `${what}: contour ${ci} does not close, gap ${wrap}`);
  }
}

/**
 * Oracle 3, for the region itself: a stroke whose caps AND joins are round is exactly
 * the set of points within w/2 of the centreline (the Minkowski sum with a disc), so an
 * independent distance test classifies every point and `pointInPath` must agree.
 *
 * `band` excludes points too near the boundary to be decidable - that is not a
 * correctness tolerance, it is the strip where the offsetter's fitting error and the
 * grid are the same size.
 */
function assertRegionIsDiscSum(out: GeomPath, src: GeomPath, r: number, band: number, what: string, n = 34) {
  const b = pathBounds(out);
  assert.ok(b, `${what}: empty output`);
  let checked = 0;
  const wrong: string[] = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = b.x0 - 2 + ((b.x1 - b.x0 + 4) * i) / n;
      const y = b.y0 - 2 + ((b.y1 - b.y0 + 4) * j) / n;
      const d = distToPath(src, x, y);
      if (Math.abs(d - r) < band) continue;
      checked++;
      const inside = pointInPath(out, x, y, 'nonzero');
      if (inside !== d < r) {
        wrong.push(`(${x.toFixed(2)},${y.toFixed(2)}) dist ${d.toFixed(4)} → pointInPath ${inside}`);
      }
    }
  }
  assert.ok(checked > 200, `${what}: only ${checked} decidable grid points — the oracle is not testing anything`);
  assert.deepEqual(wrong.slice(0, 6), [], `${what}: ${wrong.length}/${checked} grid points misclassified`);
}

// ── analytic: the straight cases, exactly ─────────────────────────────────────

test('a butt-capped straight stroke is exactly the rectangle', () => {
  const out = strokeToPath(openSeg(0, 0, 100, 0), 10);
  assert.equal(out.length, 1, 'one segment paints one region');
  assertJoined(out, 'butt rectangle');
  near(areaOf(out), 1000, 1e-9, 'area');
  nearBox(out, 0, -5, 100, 5, 1e-9, 'butt rectangle');
  // 2 sides + 2 caps. Anything much above that is subdivision nobody asked for.
  assert.ok(curveCount(out) <= 8, `${curveCount(out)} curves for a rectangle`);
});

test('a square cap extends by exactly half the width at each end', () => {
  const out = strokeToPath(openSeg(0, 0, 100, 0), 10, { cap: 'square' });
  near(areaOf(out), 1100, 1e-9, 'area');
  nearBox(out, -5, -5, 105, 5, 1e-9, 'square-capped rectangle');
  assertJoined(out, 'square cap');
});

test('a round cap adds one disc, measured against the same kappa circle it is drawn from', () => {
  const disc = areaOf(circlePath(0, 0, 5));
  // The construction really is a circle, just not exactly one: this is the 2.7e-4·r
  // radial error every font and drawing tool ships with.
  near(disc, Math.PI * 25, 0.05, 'the reference kappa disc');
  const out = strokeToPath(openSeg(0, 0, 100, 0), 10, { cap: 'round' });
  near(areaOf(out), 1000 + disc, 1e-3, 'area');
  nearBox(out, -5, -5, 105, 5, 1e-3, 'round-capped rectangle');
  assertJoined(out, 'round cap');
  assert.ok(curveCount(out) <= 12, `${curveCount(out)} curves — two sides and four quarter arcs is six`);
});

test('a diagonal segment strokes to the same rectangle a horizontal one does', () => {
  // Nothing in a stroke depends on which way the segment points: the outline is a
  // rectangle of area w·L plus whatever the caps add, rotated. The 45° case is worth
  // naming because the two offset sides then sit at irrational coordinates while the
  // caps land on the segment's own endpoints, which is where a positional tolerance can
  // mistake the cap for a continuation of the side.
  const disc = areaOf(circlePath(0, 0, 5));
  const src = openSeg(0, 0, 100, 100);
  const L = Math.hypot(100, 100);
  near(areaOf(strokeToPath(src, 10)), 10 * L, 1e-6, '45° butt-capped area');
  const round = strokeToPath(src, 10, { cap: 'round' });
  near(areaOf(round), 10 * L + disc, 1e-3, '45° round-capped area');
  const square = strokeToPath(src, 10, { cap: 'square' });
  near(areaOf(square), 10 * (L + 10), 1e-3, '45° square-capped area');
  assert.equal(round.length, 1, 'one segment paints one region');
  assertJoined(round, '45° round cap');
  assertJoined(square, '45° square cap');
});

test('every straight stroke is width × length, whatever direction and length', () => {
  // A property sweep rather than one fixture, because the failure this catches is not a
  // wrong formula - it is a tolerance in the boolean cleanup that trips on some
  // orientations and not others, so a single well-chosen segment proves nothing.
  const disc = areaOf(circlePath(0, 0, 5));
  const wrong: string[] = [];
  for (const x of [0, 20, 40, 60, 80, 100]) {
    for (const y of [0, 20, 40, 60, 80, 100]) {
      if (!x && !y) continue;
      const src = openSeg(0, 0, x, y);
      const L = Math.hypot(x, y);
      for (const [cap, want] of [
        ['butt', 10 * L] as const,
        ['round', 10 * L + disc] as const,
        ['square', 10 * (L + 10)] as const,
      ]) {
        const out = strokeToPath(src, 10, { cap });
        const got = areaOf(out);
        if (out.length !== 1 || Math.abs(got - want) > 1e-3) {
          wrong.push(`(${x},${y}) ${cap}: ${out.length} contour(s), area ${got.toFixed(3)} want ${want.toFixed(3)}`);
        }
      }
    }
  }
  assert.deepEqual(wrong.slice(0, 8), [], `${wrong.length} of 105 straight strokes came out wrong`);
});

test('a stroked square ring is the difference of the two squares', () => {
  const out = strokeToPath(rectPath(0, 0, 100, 100), 10);
  // 110² − 90². The abs of the SIGNED sum is the assertion: it only comes to 4000 if
  // the two offsets carry opposite winding, which is what makes the middle a hole.
  near(Math.abs(denseArea(out)), 4000, 1e-9, 'ring area');
  assert.equal(out.length, 2, 'a ring is an outer contour and a hole');
  nearBox(out, -5, -5, 105, 105, 1e-9, 'ring');
  assertJoined(out, 'square ring');
  assert.equal(pointInPath(out, 50, 50, 'nonzero'), false, 'the middle of a ring is not painted');
  assert.equal(pointInPath(out, 0, 50, 'nonzero'), true, 'the centreline is painted');
  assert.equal(pointInPath(out, -4.5, 50, 'nonzero'), true, 'just inside the outer edge');
  assert.equal(pointInPath(out, -5.5, 50, 'nonzero'), false, 'just outside the outer edge');
  assert.equal(pointInPath(out, 5.5, 50, 'nonzero'), false, 'just inside the inner edge');
});

test('an implicit wrap is stroked as a real edge', () => {
  // `closed: true` with no closing curve - the offsetter has nothing to push out unless
  // strokeToPath materialises the wrap first.
  const three = poly([[0, 0], [100, 0], [100, 100], [0, 100]], false);
  const implicit: GeomPath = [{ curves: three.curves, closed: true }];
  const out = strokeToPath(implicit, 10);
  near(Math.abs(denseArea(out)), 4000, 1e-9, 'ring area from an implicit wrap');
  nearBox(out, -5, -5, 105, 105, 1e-9, 'implicit wrap ring');
});

test('joins: miter, bevel and round differ by exactly the corner they cut', () => {
  const src = rectPath(0, 0, 100, 100);
  const miter = strokeToPath(src, 10, { join: 'miter' });
  const bevel = strokeToPath(src, 10, { join: 'bevel' });
  const round = strokeToPath(src, 10, { join: 'round' });
  near(Math.abs(denseArea(miter)), 4000, 1e-9, 'miter ring');
  // A bevel replaces each 5×5 outer corner square with its diagonal: four half-squares.
  near(Math.abs(denseArea(bevel)), 4000 - 4 * 12.5, 1e-9, 'bevel ring');
  // A round join replaces each corner square with a quarter disc.
  near(Math.abs(denseArea(round)), 4000 - 4 * 25 + areaOf(circlePath(0, 0, 5)), 0.05, 'round ring');
  nearBox(bevel, -5, -5, 105, 105, 1e-9, 'bevel ring');
  nearBox(round, -5, -5, 105, 105, 1e-3, 'round ring');
});

test('a miter is bounded by miterLimit rather than spiking to infinity', () => {
  // A 1.7° turn. The miter ratio 1/sin(θ/2) is about 67, so SVG requires the fallback
  // to bevel; a miter honoured literally would put the tip 333 units off the path.
  const spike: GeomPath = [poly([[0, 0], [100, 0], [0, 3]], false)];
  const out = strokeToPath(spike, 10, { join: 'miter', miterLimit: 4 });
  assert.ok(out.length > 0, 'a spike still paints something');
  let far = 0;
  for (const p of sampleOutline(out, 6)) far = Math.max(far, distToPath(spike, p.x, p.y));
  // SVG: miterLength/strokeWidth ≤ miterLimit, and the tip sits at miterLength/2.
  assert.ok(far <= 4 * 5 + 1e-6, `the outline reaches ${far.toFixed(3)} from the path, past the miterLimit's 20`);
});

test('a generous miterLimit does let the spike through — the limit is doing the work', () => {
  // The companion to the test above: without this, a miter implementation that always
  // bevels passes the limit test for the wrong reason.
  const spike: GeomPath = [poly([[0, 0], [100, 1], [0, 2]], false)];
  const bounded = pathBounds(strokeToPath(spike, 10, { join: 'miter', miterLimit: 4 }))!;
  const loose = pathBounds(strokeToPath(spike, 10, { join: 'miter', miterLimit: 200 }))!;
  assert.ok(bounded.x1 <= 100 + 4 * 5 + 1e-6, `bevelled outline still reaches x=${bounded.x1}`);
  assert.ok(loose.x1 > 400, `a 200 miterLimit should mitre out past x=400, reached ${loose.x1}`);
});

test('a round join never leaves the offset distance', () => {
  const spike: GeomPath = [poly([[0, 0], [100, 0], [0, 3]], false)];
  const out = strokeToPath(spike, 10, { join: 'round', cap: 'round' });
  let far = 0;
  for (const p of sampleOutline(out, 8)) far = Math.max(far, distToPath(spike, p.x, p.y));
  near(far, 5, 2e-3, 'the far edge of a fully round outline');
});

// ── analytic: curves, via area = width × length ───────────────────────────────

test('a stroke that does not self-overlap has area exactly width × centreline length', () => {
  // The curvature terms cancel between the two sides, so this holds for any simple
  // curve - which is what makes it usable as an oracle without naming a circle.
  for (const [what, k] of [
    ['gentle arch', [0, 0, 30, 10, 70, 10, 100, 0]],
    ['quarter arc', [50, 0, 50, 50 * KAPPA, 50 * KAPPA, 50, 0, 50]],
    ['deep S', [0, 0, 60, 80, 40, -80, 100, 0]],
  ] as const) {
    const src: GeomPath = [{ curves: [[...k] as Cubic], closed: false }];
    const out = strokeToPath(src, 10, { tol: 0.002 });
    assertJoined(out, what);
    const expect = 10 * lengthCubic(k as Cubic, 1e-7);
    near(areaOf(out), expect, expect * 2e-3, `${what} area`);
  }
});

test('a stroked circle is an annulus of area width × perimeter', () => {
  const src = circlePath(0, 0, 50);
  const t0 = process.hrtime.bigint();
  const out = strokeToPath(src, 10, { tol: 0.002 });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(out.length, 2, 'an annulus is two contours');
  assertJoined(out, 'annulus');
  // Steiner: the outer parallel body gains w/2·P and the inner loses it, and the πr²
  // corner terms cancel between them. So the band is w·P of the SAME curve - no πr²
  // anywhere, which is the whole point of measuring against the fixture rather than
  // against the circle it approximates.
  near(Math.abs(denseArea(out)), 10 * pathLength(src), 0.2, 'annulus area');
  nearBox(out, -55, -55, 55, 55, 0.02, 'annulus');
  assert.equal(pointInPath(out, 0, 0, 'nonzero'), false, 'the middle of an annulus is a hole');
  assert.equal(pointInPath(out, 50, 0, 'nonzero'), true, 'the centreline is painted');
  assert.equal(pointInPath(out, 44, 0, 'nonzero'), false, 'inside the hole');
  assert.equal(pointInPath(out, 56, 0, 'nonzero'), false, 'outside the outer edge');

  // Same stroke, two more things it has to be. Four source curves in: a fitter that
  // splits at curvature features needs a handful of pieces per side, so a few tens is
  // expected and a few hundred means it flattened and re-emitted.
  const n = curveCount(out);
  assert.ok(n <= 64, `${n} curves out of a 4-curve circle — that is a polyline`);
  const straight = out.flatMap((c) => c.curves).filter((k) => isLineCubic(k)).length;
  assert.ok(straight <= n * 0.2, `${straight}/${n} output curves are straight — an annulus has no straight edges`);
  // And it has to finish. Four curves in is not a workload; anything past a second here
  // means two pieces of the outline came out coincident and the intersector is grinding
  // on a pair that has no isolated crossing.
  assert.ok(ms < 2000, `stroking a 4-curve circle took ${ms.toFixed(0)}ms`);
});

test('output COMPLEXITY follows the input, not the tolerance', () => {
  // A tolerance buys a closer fit - more curves - and must never buy more CONTOURS. This
  // wiggle of ten cubics came back as one contour at tol 1e-2, 1e-3 and 1e-4 and as
  // twenty-one at 1e-5: twenty extra one-curve contours of ~1e-11 area, slivers left where
  // a tighter fit made two pieces of the outline miss each other by less than the weld
  // radius. They are invisible in an area total and fatal to anything that iterates
  // contours - a fill rule, a PDF emitter, a subsequent boolean.
  const curves: Cubic[] = [];
  for (let i = 0; i < 10; i++) {
    const x0 = i * 40, s = i % 2 ? -1 : 1;
    curves.push([x0, 0, x0 + 13, 60 * s, x0 + 27, 60 * s, x0 + 40, 0]);
  }
  const wiggle: GeomPath = [{ curves, closed: false }];
  const seen: { tol: number; contours: number; curves: number; area: number }[] = [];
  for (const tol of [1e-2, 1e-3, 1e-4, 1e-5]) {
    const out = strokeToPath(wiggle, 12, { tol });
    assertJoined(out, `wiggle at tol ${tol}`);
    // No contour may enclose a negligible area. The absolute floor is what matters: a
    // sliver is ~1e-11 here, and the real contours are ~1e4, so anything under a
    // hundredth of a square unit is not geometry.
    for (const [ci, c] of out.entries()) {
      const a = Math.abs(denseArea([c]));
      assert.ok(a > 1e-2, `tol ${tol}: contour ${ci} encloses ${a} — a zero-area sliver`);
    }
    seen.push({ tol, contours: out.length, curves: curveCount(out), area: areaOf(out) });
  }
  const first = seen[0]!;
  for (const s of seen) {
    assert.equal(s.contours, first.contours,
      `tol ${s.tol} gave ${s.contours} contours where tol ${first.tol} gave ${first.contours}: ${JSON.stringify(seen)}`);
    // The region itself must not move either, which is what says the extra curves at a
    // tighter tolerance are refinement rather than different geometry.
    near(s.area, first.area, first.area * 1e-3, `tol ${s.tol} area`);
  }
  assert.equal(first.contours, 1, 'a stroked open wiggle is one region');
  // And the curve count DOES respond to tolerance, or the argument is decorative.
  assert.ok(seen[3]!.curves > seen[0]!.curves,
    `tol 1e-5 must fit more closely than 1e-2: ${seen[0]!.curves} → ${seen[3]!.curves}`);
});

test('an over-wide stroke on a CURVE swallows the hole, at every width past the fold', () => {
  // The defect winding cannot see. Adding the two sweeps assumes a fold reverses the
  // folded sweep's handedness; that holds for a corner and fails for a curve. The inward
  // sweep of a circle of r=50 at w/2=51 comes back as a circle of radius 1 running the
  // SAME way round, so it cancels the outer sweep instead of itself and punches a hole
  // through paint that must be solid. Every width here came back as two contours with the
  // centre UNPAINTED; the equivalent square was correct, which is how it survived a suite.
  //
  // The expected areas are Steiner's formula on the fixture's own area and perimeter - 
  // A + P·r + πr² for a convex source - never π(50+r)², which would be the ideal circle
  // this cubic fixture only approximates.
  const src = circlePath(0, 0, 50);
  const A = contourArea(src[0]!), P = pathLength(src);
  for (const w of [102, 120, 200, 260]) {
    const r = w / 2;
    const out = strokeToPath(src, w, { tol: 0.002 });
    assertJoined(out, `swallowed circle w=${w}`);
    assert.equal(out.length, 1, `w=${w}: the folded inner sweep must leave no contour, got ${out.length}`);
    assert.equal(pointInPath(out, 0, 0, 'nonzero'), true, `w=${w}: the centre must be painted`);
    const want = A + P * r + Math.PI * r * r;
    near(areaOf(out), want, want * 1e-6, `w=${w} area`);
    nearBox(out, -(50 + r), -(50 + r), 50 + r, 50 + r, 0.02, `swallowed circle w=${w}`);
  }
});

test('a stroke narrower than the radius is still an annulus, and half a hole still survives', () => {
  // The other half of the property: dropping a contour must be reserved for the fold. A
  // stroke that does not fold keeps its hole, and one whose inner offset is merely deep
  // keeps what is left of it - a rule that swallowed holes generally would pass the test
  // above and destroy every ordinary ring.
  const src = circlePath(0, 0, 50);
  const P = pathLength(src);
  for (const w of [10, 30]) {
    const out = strokeToPath(src, w, { tol: 0.002 });
    assertJoined(out, `annulus w=${w}`);
    assert.equal(out.length, 2, `w=${w}: an annulus is two contours, got ${out.length}`);
    assert.equal(pointInPath(out, 0, 0, 'nonzero'), false, `w=${w}: the middle is a hole`);
    assert.equal(pointInPath(out, 50, 0, 'nonzero'), true, `w=${w}: the centreline is painted`);
    assert.equal(pointInPath(out, 50 - w / 2 - 1, 0, 'nonzero'), false, `w=${w}: inside the hole`);
    assert.equal(pointInPath(out, 50 + w / 2 + 1, 0, 'nonzero'), false, `w=${w}: outside the outer edge`);
    // The band's area is w·P exactly: the two Steiner curvature terms cancel between the
    // outer and inner parallel bodies.
    near(areaOf(out), w * P, w * P * 1e-6, `w=${w} band area`);
  }
});

test('a width wider than the shape swallows the hole instead of inverting it', () => {
  // w/2 = 30 against a 20×20 square: the inner offset inverts through itself, and the
  // right answer is the solid 80×80 outer offset with no hole at all - every point of
  // the square is within 30 of its perimeter.
  const out = strokeToPath(rectPath(0, 0, 20, 20), 60);
  assert.equal(pointInPath(out, 10, 10, 'nonzero'), true, 'the centre must be painted, not punched out');
  assert.equal(out.length, 1, 'the inner offset inverted and must leave no contour');
  near(areaOf(out), 80 * 80, 1e-6, 'swallowed-square area');
  nearBox(out, -30, -30, 50, 50, 1e-9, 'swallowed square');
});

// ── residual ──────────────────────────────────────────────────────────────────

test('the outline\'s knots sit at exactly half the width from the source', () => {
  // The strong form of the distance claim, and the one that separates real geometry from
  // a plausible approximation. An offset piece's endpoints are not fitted: they are a
  // point of the source plus w/2 along its exact unit normal, and a round cap's arc
  // endpoints are those same two points. So every knot in the output must be at w/2 to
  // MACHINE precision, not to the fitting tolerance. A knot that has drifted means the
  // outline was rebuilt through a sampled intermediate somewhere.
  const bad: string[] = [];
  for (const [what, src] of [
    ['segment', openSeg(0, 0, 100, 0)],
    ['arch', [{ curves: [[0, 0, 30, 40, 70, 40, 100, 0] as Cubic], closed: false }] as GeomPath],
    ['deep S', [{ curves: [[0, 0, 20, 90, 80, -30, 100, 50] as Cubic], closed: false }] as GeomPath],
    ['polyline', [poly([[0, 0], [80, 20], [120, 90]], false)] as GeomPath],
    ['square', rectPath(0, 0, 100, 100)],
    ['circle', circlePath(0, 0, 50)],
  ] as const) {
    const out = strokeToPath(src as GeomPath, 10, { cap: 'round', join: 'round', tol: 0.002 });
    if (!out.length) { bad.push(`${what}: nothing came back`); continue; }
    let worst = 0, at = '';
    for (const p of outlineKnots(out)) {
      const d = Math.abs(distToPath(src as GeomPath, p.x, p.y) - 5);
      if (d > worst) { worst = d; at = `(${p.x.toFixed(4)},${p.y.toFixed(4)})`; }
    }
    if (worst > 1e-9) bad.push(`${what}: a knot sits ${worst.toExponential(3)} off the true offset at ${at}`);
  }
  assert.deepEqual(bad, []);
});

test('a round-capped outline sits at exactly half the width from the source', () => {
  // The weak form, over the whole outline rather than its knots: a round-capped stroke
  // IS {p : dist(p, path) = w/2}, and the interior of each fitted piece is allowed the
  // tolerance that was asked for and no more.
  const bad: string[] = [];
  for (const [what, src] of [
    ['segment', openSeg(0, 0, 100, 0)],
    ['arch', [{ curves: [[0, 0, 30, 40, 70, 40, 100, 0] as Cubic], closed: false }] as GeomPath],
    ['square', rectPath(0, 0, 100, 100)],
    ['circle', circlePath(0, 0, 50)],
  ] as const) {
    const out = strokeToPath(src as GeomPath, 10, { cap: 'round', join: 'round', tol: 0.002 });
    if (!out.length) { bad.push(`${what}: nothing came back, so there is no outline to measure`); continue; }
    let worst = 0, at = '';
    for (const p of sampleOutline(out, 10)) {
      const d = Math.abs(distToPath(src as GeomPath, p.x, p.y) - 5);
      if (d > worst) { worst = d; at = `(${p.x.toFixed(3)},${p.y.toFixed(3)})`; }
    }
    // The budget: the fit tolerance asked for (0.002) plus the kappa cap's 2.7e-4·r.
    if (worst > 0.005) bad.push(`${what}: outline strays ${worst.toFixed(5)} from the true offset at ${at}`);
  }
  // Every fixture measured before anything is reported, so one broken case does not
  // hide the three behind it.
  assert.deepEqual(bad, []);
});

test('a coarser tolerance buys fewer curves, so tol reaches the offsetter at all', () => {
  // An open curved contour: the offsetter's fit is the only thing tol can move here, so
  // a difference in the count is that routing and nothing else.
  const arc: GeomPath = [{ curves: [[50, 0, 50, 27.6, 27.6, 50, 0, 50] as Cubic], closed: false }];
  const fine = curveCount(strokeToPath(arc, 10, { tol: 0.0005 }));
  const coarse = curveCount(strokeToPath(arc, 10, { tol: 2 }));
  assert.ok(fine > 0 && coarse > 0, 'both tolerances must still paint something');
  assert.ok(coarse <= fine, `tol is ignored: ${coarse} curves at tol 2 vs ${fine} at tol 0.0005`);
});

test('stroking is independent of the direction the contour was authored in', () => {
  const fwd: GeomPath = [{ curves: [[0, 0, 30, 60, 80, -20, 100, 30] as Cubic], closed: false }];
  const rev: GeomPath = [reverseContour(fwd[0]!)];
  for (const cap of ['butt', 'round', 'square'] as const) {
    const a = strokeToPath(fwd, 12, { cap, tol: 0.002 });
    const b = strokeToPath(rev, 12, { cap, tol: 0.002 });
    assert.ok(a.length > 0 && b.length > 0, `${cap}: an open contour must paint something either way round`);
    near(areaOf(b), areaOf(a), Math.max(0.01, areaOf(a) * 1e-4), `${cap} area under reversal`);
    const ba = pathBounds(a)!, bb = pathBounds(b)!;
    for (const key of ['x0', 'y0', 'x1', 'y1'] as const) near(bb[key], ba[key], 1e-3, `${cap} ${key} under reversal`);
  }
});

test('a closed contour strokes the same whichever way round it is wound', () => {
  const ccw = rectPath(0, 0, 100, 100);
  const cw: GeomPath = [reverseContour(ccw[0]!)];
  near(Math.abs(denseArea(strokeToPath(cw, 10))), 4000, 1e-9, 'reversed ring area');
  assert.equal(strokeToPath(cw, 10).length, 2, 'a reversed ring is still a ring');
});

// ── the named traps ───────────────────────────────────────────────────────────

test('coincident contours: the same segment twice paints it once', () => {
  const twice: GeomPath = [...openSeg(0, 0, 100, 0), ...openSeg(0, 0, 100, 0)];
  const out = strokeToPath(twice, 10);
  near(areaOf(out), 1000, 1e-6, 'duplicated segment area');
  assert.equal(out.length, 1, 'two coincident strokes are one region');
});

test('coincident and opposed: a segment and its reverse must not cancel under nonzero', () => {
  // Both outlines come out with the same winding - the offset-out, offset-in-reversed
  // construction does not depend on the input's direction. If they did not, nonzero
  // would subtract one from the other and the stroke would vanish.
  const there: GeomPath = [...openSeg(0, 0, 100, 0), ...openSeg(100, 0, 0, 0)];
  const out = strokeToPath(there, 10);
  near(areaOf(out), 1000, 1e-6, 'a segment plus its reverse');
  assert.equal(pointInPath(out, 50, 0, 'nonzero'), true, 'the middle of the stroke must still be painted');
});

test('tangency without crossing: two strokes that share an edge and no area', () => {
  const pair: GeomPath = [...openSeg(0, 0, 100, 0), ...openSeg(0, 10, 100, 10)];
  const out = strokeToPath(pair, 10);
  near(areaOf(out), 2000, 1e-6, 'touching strokes');
  assert.equal(pointInPath(out, 50, 4.5, 'nonzero'), true, 'below the shared edge');
  assert.equal(pointInPath(out, 50, 5.5, 'nonzero'), true, 'above the shared edge');
  assert.equal(pointInPath(out, 50, 15.5, 'nonzero'), false, 'outside both');
});

test('shared endpoints: splitting a straight run into pieces changes nothing', () => {
  const whole = strokeToPath(openSeg(0, 0, 100, 0), 10);
  const pieces: GeomPath = [poly([[0, 0], [30, 0], [70, 0], [100, 0]], false)];
  const out = strokeToPath(pieces, 10);
  near(areaOf(out), areaOf(whole), 1e-6, 'a collinear join must add no area');
  nearBox(out, 0, -5, 100, 5, 1e-9, 'split straight run');
  assert.equal(out.length, 1, 'collinear joins must not fragment the outline');
});

test('crossing subpaths merge into one region, in one boolean pass', () => {
  // Two 100×10 rectangles overlapping in exactly one 10×10 square.
  const cross: GeomPath = [...openSeg(0, 0, 100, 0), ...openSeg(50, -50, 50, 50)];
  const out = strokeToPath(cross, 10);
  near(areaOf(out), 1900, 1e-6, 'crossing strokes');
  assert.equal(out.length, 1, 'crossing strokes are one contour, not two overlapping ones');
  assertJoined(out, 'crossing strokes');
});

test('an X of two diagonal subpaths overlaps in exactly one square of side w', () => {
  // The same identity at 45°, where the two bands meet at right angles so the overlap is
  // still w². Both strokes have to be resolved against each other in the single boolean
  // pass, and the answer is a rational multiple of nothing but √2.
  const x: GeomPath = [...openSeg(0, 0, 100, 100), ...openSeg(100, 0, 0, 100)];
  const out = strokeToPath(x, 10);
  const L = Math.hypot(100, 100);
  near(areaOf(out), 2 * 10 * L - 100, 1e-6, 'crossed diagonals');
  assert.equal(out.length, 1, 'a crossed X is one region');
});

test('a self-intersecting open contour encloses a hole', () => {
  // (50,50)→(50,−50) crosses (0,0)→(100,0) at (50,0), closing a triangle whose
  // inradius is 14.6, comfortably clear of the 5 the stroke eats.
  const src: GeomPath = [poly([[0, 0], [100, 0], [50, 50], [50, -50]], false)];
  const out = strokeToPath(src, 10);
  assertJoined(out, 'self-intersecting');
  assert.equal(out.length, 2, 'the enclosed triangle must survive as a hole');
  const r = (50 + 50 - Math.hypot(50, 50)) / 2;
  assert.equal(pointInPath(out, 50 + r, r, 'nonzero'), false, 'the incentre of the enclosed triangle is a hole');
  assert.equal(pointInPath(out, 50, 0, 'nonzero'), true, 'the crossing itself is painted');
});

test('disjoint subpaths stay disjoint', () => {
  const two: GeomPath = [...openSeg(0, 0, 100, 0), ...openSeg(0, 1000, 100, 1000)];
  const out = strokeToPath(two, 10);
  assert.equal(out.length, 2, 'nothing joins strokes a thousand units apart');
  near(areaOf(out), 2000, 1e-6, 'disjoint strokes');
});

test('one ring fully inside another keeps both', () => {
  const nested: GeomPath = [...rectPath(0, 0, 100, 100), ...rectPath(40, 40, 20, 20)];
  const out = strokeToPath(nested, 10);
  assert.equal(out.length, 4, 'two rings are four contours');
  // 110²−90² for the outer, 30²−10² for the inner.
  near(Math.abs(denseArea(out)), 4000 + 800, 1e-6, 'nested rings');
  assert.equal(pointInPath(out, 50, 50, 'nonzero'), false, 'the inner ring has its own hole');
  assert.equal(pointInPath(out, 50, 25, 'nonzero'), false, 'between the two rings is empty');
  assert.equal(pointInPath(out, 50, 42, 'nonzero'), true, 'the inner ring\'s band is painted');
  // The band's own centreline, which is also the y of two vertices of the outline. A
  // query point level with a vertex is not on the boundary and must not be treated as
  // undecidable - a ray cast that gives up there is guessing, not measuring.
  assert.equal(pointInPath(out, 50, 40, 'nonzero'), true, 'the inner ring\'s own centreline is painted');
});

test('a hole in the input is stroked like any other contour', () => {
  // Outer counter-clockwise, inner clockwise: a real hole. Nothing in strokeToPath
  // normalises orientation, so the result must match the both-the-same-way version.
  const holed: GeomPath = [rectPath(0, 0, 100, 100)[0]!, reverseContour(rectPath(20, 20, 40, 40)[0]!)];
  const plain: GeomPath = [...rectPath(0, 0, 100, 100), ...rectPath(20, 20, 40, 40)];
  const a = strokeToPath(holed, 10), b = strokeToPath(plain, 10);
  near(Math.abs(denseArea(b)), 4000 + (50 * 50 - 30 * 30), 1e-6, 'ring plus ring');
  assert.equal(a.length, b.length, 'winding must not change the contour count');
  near(Math.abs(denseArea(a)), Math.abs(denseArea(b)), 1e-6, 'winding must not change the area');
});

test('a zero-extent subpath paints a dot, or nothing under a butt cap', () => {
  const dot: GeomPath = [{ curves: [lineToCubic(20, 30, 20, 30)], closed: false }];
  assert.deepEqual(strokeToPath(dot, 10), [], 'a butt cap has no extent along a direction that does not exist');

  const square = strokeToPath(dot, 10, { cap: 'square' });
  near(areaOf(square), 100, 1e-9, 'square dot area');
  nearBox(square, 15, 25, 25, 35, 1e-9, 'square dot');

  const round = strokeToPath(dot, 10, { cap: 'round' });
  near(areaOf(round), areaOf(circlePath(0, 0, 5)), 1e-6, 'round dot area');
  nearBox(round, 15, 25, 25, 35, 1e-6, 'round dot');
});

test('empty inputs and impossible widths paint nothing', () => {
  assert.deepEqual(strokeToPath([], 10), []);
  assert.deepEqual(strokeToPath([{ curves: [], closed: false }], 10), []);
  assert.deepEqual(strokeToPath([{ curves: [], closed: true }], 10), []);
  for (const w of [0, -5, Number.NaN]) {
    assert.deepEqual(strokeToPath(rectPath(0, 0, 100, 100), w), [], `width ${w} must paint nothing`);
  }
});

test('a stroke narrower than the gap between two subpaths does not bridge them', () => {
  const pair: GeomPath = [...openSeg(0, 0, 100, 0), ...openSeg(0, 12, 100, 12)];
  const out = strokeToPath(pair, 10);
  assert.equal(out.length, 2, 'a 2-unit gap must stay a gap');
  assert.equal(pointInPath(out, 50, 6, 'nonzero'), false, 'the gap must not be painted');
});

test('a segment shorter than the stroke is wide still resolves to one blob', () => {
  // The two caps overlap each other; only the boolean pass can sort that out.
  const out = strokeToPath(openSeg(0, 0, 2, 0), 20, { cap: 'round' });
  assert.equal(out.length, 1, 'overlapping caps must merge');
  assertJoined(out, 'stubby stroke');
  assert.equal(pointInPath(out, 1, 0, 'nonzero'), true, 'the middle of a stub is painted');
  assert.equal(pointInPath(out, 1, 11, 'nonzero'), false, 'and 11 away is not');
});

// ── dense oracle: the region, point by point ──────────────────────────────────

test('dense grid: a round-capped stroke is exactly the disc sum of its centreline', () => {
  // 0.02 excludes the strip where the offsetter's 0.002 fit and the grid are the same
  // size; everything else must be classified correctly.
  assertRegionIsDiscSum(
    strokeToPath(openSeg(10, 10, 90, 60), 16, { cap: 'round', join: 'round', tol: 0.002 }),
    openSeg(10, 10, 90, 60), 8, 0.02, 'straight segment',
  );
});

test('dense grid: a curved stroke, caps and all', () => {
  const src: GeomPath = [{ curves: [[0, 0, 20, 90, 80, -30, 100, 50] as Cubic], closed: false }];
  assertRegionIsDiscSum(
    strokeToPath(src, 14, { cap: 'round', join: 'round', tol: 0.002 }), src, 7, 0.02, 'S curve',
  );
});

test('dense grid: a closed ring, hole included', () => {
  const src = rectPath(0, 0, 100, 60);
  assertRegionIsDiscSum(strokeToPath(src, 12, { join: 'round', tol: 0.002 }), src, 6, 0.02, 'rounded ring');
});

test('dense grid: a self-crossing path, where the overlap must not punch a hole', () => {
  const src: GeomPath = [poly([[0, 0], [100, 0], [50, 60], [50, -30]], false)];
  assertRegionIsDiscSum(
    strokeToPath(src, 12, { cap: 'round', join: 'round', tol: 0.002 }), src, 6, 0.02, 'self-crossing',
  );
});

test('dense grid: a path that doubles back over itself at 45°', () => {
  // Three edges, one genuine self-crossing, and both diagonals at 45° - the orientation
  // where the offset sides land on irrational coordinates. Round throughout, so the
  // painted region is the disc sum and the grid decides it outright.
  const src: GeomPath = [poly([[0, 0], [100, 100], [100, 0], [0, 100]], false)];
  assertRegionIsDiscSum(
    strokeToPath(src, 10, { cap: 'round', join: 'round', tol: 0.002 }), src, 5, 0.02, 'doubling back',
  );
});

// ── the area oracle callers will actually reach for ───────────────────────────

test('contourArea agrees with a dense shoelace on the curves it is given', () => {
  // Not a stroke test as such: `contourArea` is documented exact and is how a caller
  // reads a stroke's area back. If it disagrees with an independent shoelace on the
  // SAME curves then every orientation decision built on it is wrong too - and it is
  // checked against that shoelace rather than against πr², since the fixture is the
  // cubic approximation OF a circle and encloses slightly more.
  const unit = circleContour(0, 0, 1);
  near(contourArea(unit), denseArea([unit]), 1e-5, 'a counter-clockwise unit circle');
  assert.ok(contourArea(unit) > 0, 'a counter-clockwise contour must have positive area');
  const ring = strokeToPath(rectPath(0, 0, 100, 100), 10, { join: 'round' });
  const viaContour = ring.reduce((a, c) => a + contourArea(c), 0);
  near(Math.abs(viaContour), Math.abs(denseArea(ring)), 1e-3, 'round-jointed ring area');
});

// ── the outline that lost a lobe ───────────────────────────────────────────────

/** Three cubics, open, coming back to the point they started from - so the two butt caps
 *  land on top of each other and the sweep folds against itself twice over. The coordinates
 *  are the ones that produced the defect and are not to be tidied: it turns on features a
 *  weld radius across, and rounding any of them moves them.
 *
 *  What went wrong: `dedupeEdges` annihilated a pair of 1.0e-5-long opposed slivers, one of
 *  which was the only link between a vertex and the rest of its curve. The walk dead-ended
 *  there, everything past it was abandoned, and an 87-unit lobe vanished from a 1047-unit
 *  outline - 3 contours came back as 7, four of them slivers. Two curves that short have no
 *  reliable direction to be opposed BY, which is what the guard in `dedupeEdges` now says.
 *
 *  It only became reachable when `nearestOnCubic` started reporting true distances: the old
 *  probe over-reported by enough that the pieces were never recognised as coincident, so the
 *  annihilation never fired. Fixing the probe did not cause this, it exposed it. */
const lostLobe: GeomPath = [{
  curves: [
    [-46.1499, -53.9709, 11.0416, -33.8951, -54.2973, -54.8821, 26.8313, -27.0415],
    [26.8313, -27.0415, 1.4180, -36.9279, 32.4307, -10.5099, -30.8422, 33.3265],
    [-30.8422, 33.3265, -57.0003, 25.3133, 14.3070, 46.5770, -46.1499, -53.9709],
  ] as Cubic[],
  closed: false,
}];

test('dense grid: the self-folding chain that lost a lobe of solid paint', () => {
  // Round throughout, so the painted region IS the disc sum and the grid settles it with no
  // reference to the outline. A coarse grid is no use here - the lost lobe is 87 units of a
  // 1047-unit region, a few cells at the default resolution - so this one counts fine.
  assertRegionIsDiscSum(
    strokeToPath(lostLobe, 4, { cap: 'round', join: 'round' }), lostLobe, 2, 0.02,
    'self-folding chain', 150,
  );
});

test('the self-folding chain resolves to three contours, lobe included', () => {
  const out = strokeToPath(lostLobe, 4);
  assertJoined(out, 'self-folding chain');
  // The count is part of the assertion. The failure did not merely misplace area, it left
  // the outline in pieces: one contour per broken chain, each a sliver of no area, and
  // output complexity has to follow the input's.
  assert.equal(out.length, 3, 'outer boundary, its hole, and one genuine sliver');
  // Butt caps, and the two of them sit on the same point, so the painted region is the disc
  // sum less two half-discs less what they share. Measured on a 900² grid: 1045.2 for the
  // disc sum, 1034.4 once the caps are squared off. The lobe alone is 87 of it, so a
  // tolerance of 1 cannot pass with the lobe missing.
  near(areaOf(out), 1034.4, 1, 'butt-capped area with the lobe present');
});
