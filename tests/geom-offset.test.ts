// SPDX-License-Identifier: MPL-2.0
/**
 * Offsetting and curve fitting (engine/src/geom/offset.ts).
 *
 * ## How this is checked
 *
 * The same three oracles as `geom-intersect.test.ts`, aimed at the one property that
 * defines an offset:
 *
 * 1. **Analytic** - a polygon's offset is a polygon, so its area is a closed-form
 *    number. A square grown by 10 with mitre joins is exactly 120×120; with bevels the
 *    corners are triangles of ½d²·sin θ; with mitres, kites of d²·tan(θ/2). Those are
 *    exact, and a test that accepts 14399 instead of 14400 is not testing anything.
 *    Morphology supplies the exact answers past the radius of curvature too: eroding a
 *    rounded rectangle by more than its corner radius gives a SHARP-cornered square,
 *    because erosion of (K ⊕ disc r) by disc d is erosion of K by disc (d − r).
 * 2. **Residual** - the defining property, and the one that bites: every point of the
 *    output must be exactly `|distance|` from the SOURCE, measured with `nearestOnCubic`
 *    against the original curves. An approximation that merely looks parallel fails
 *    this; so does one that cuts a corner across a cusp. This is the check the module's
 *    own subdivision claims to certify, so it is checked independently here.
 * 3. **Dense** - two brute-force references, both built on `flattenCubic`, which is
 *    forbidden inside the module and perfectly good outside it. Areas come from a
 *    shoelace over a fine polyline; and `assertMinkowski` classifies a grid of points
 *    against what an offset IS as a set - dilation of the filled region by a disc when
 *    `d > 0`, erosion when `d < 0` - using an even-odd crossing test written here. The
 *    residual can only see the boundary it is given; this is what catches a region that
 *    should have been kept and was dropped, or a fold that should have been dropped and
 *    was kept.
 *
 * ## Three deliberate choices about the oracles
 *
 * **Areas do not come from `contourArea`.** The module's outward/inward decision is
 * taken FROM `contourArea`, so checking its results with the same function would let a
 * sign error there cancel itself out. A shoelace over a densely flattened contour shares
 * no arithmetic with it. (One test does compare the two directly, since a wrong area on
 * a curved contour inverts every offset's sign.)
 *
 * **Round joins are checked against their OWN circle, not against π.** Four quadrant
 * arcs at k = 4/3·tan(π/8) enclose 314.2452586 for r=10, not 314.1592653: the standard
 * approximation bulges 0.027% outside the circle it approximates. Expecting πd² makes
 * exactly correct code look 0.086 wrong, which is the same mistake the intersection
 * suite records against a quarter-circle's area.
 *
 * **The Minkowski oracle needs round joins and a simple source.** A mitre deliberately
 * reaches past the disc, so only `join: 'round'` is the set operation. And on a
 * self-intersecting source the chords through the interior are not boundary at all,
 * while `nearestOnCubic` measures to them anyway - so the pentagram gets the residual
 * and the contour count, not the grid.
 *
 * ## Sign convention under test
 *
 * `offsetCubic` positive = LEFT of travel, i.e. `(-Ty, Tx)`. Closed contours normalise
 * so positive = outward whichever way they were wound. Both are asserted, because
 * stroke.ts is built on them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Cubic, type Pt, evalCubic, flattenCubic, lineToCubic, isLineCubic, nearestOnCubic,
  tangentAt,
} from '../engine/src/geom/bezier.ts';
import {
  type Contour, type GeomPath, JOIN_EPS, closeContour, contourArea,
} from '../engine/src/geom/path.ts';
import { offsetCubic, offsetContour, offsetPath, fitCubic } from '../engine/src/geom/offset.ts';

const near = (a: number, b: number, eps = 1e-9, msg = '') =>
  assert.ok(Math.abs(a - b) <= eps, `${msg}${msg ? ': ' : ''}${a} !== ${b} (within ${eps})`);

/** Control-point-by-control-point comparison. Deliberately not `deepEqual`: the handle
 *  lengths come out of a least-squares solve, so a result that is geometrically exact
 *  can still differ from a hand-written literal in the last ulp. 1e-12 on coordinates of
 *  order 100 IS "exact" - it is fourteen significant figures. */
function sameCurve(got: Cubic | undefined, want: Cubic, eps = 1e-12): void {
  assert.ok(got, 'no curve produced');
  for (let i = 0; i < 8; i++) near(got![i]!, want[i]!, eps);
}

/** A closed polygon as line-cubics, with the closing edge stored explicitly so the
 *  distance oracle can see the whole boundary. */
function poly(...pts: [number, number][]): Contour {
  const curves: Cubic[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    curves.push(lineToCubic(a[0], a[1], b[0], b[1]));
  }
  return { curves, closed: true };
}

/** The four-cubic circle everyone draws, counter-clockwise in a y-up frame. Its area is
 *  NOT πr² and the tests must not pretend otherwise. */
const KAPPA = 0.5522847498307936;
function circleAt(cx: number, cy: number, r: number): Contour {
  const k = KAPPA * r;
  const p = (x: number, y: number): [number, number] => [cx + x, cy + y];
  return { closed: true, curves: [
    [...p(r, 0), ...p(r, k), ...p(k, r), ...p(0, r)] as Cubic,
    [...p(0, r), ...p(-k, r), ...p(-r, k), ...p(-r, 0)] as Cubic,
    [...p(-r, 0), ...p(-r, -k), ...p(-k, -r), ...p(0, -r)] as Cubic,
    [...p(0, -r), ...p(k, -r), ...p(r, -k), ...p(r, 0)] as Cubic,
  ] };
}
const circleContour = (r: number): Contour => circleAt(0, 0, r);

/** The same construction stretched: a four-cubic ellipse, counter-clockwise. Its minimum
 *  radius of curvature is ry²/rx, so it folds under an inward offset long before its
 *  inradius - the case where part of the boundary has folded and part has not. */
function ellipseContour(rx: number, ry: number): Contour {
  const kx = KAPPA * rx, ky = KAPPA * ry;
  return { closed: true, curves: [
    [rx, 0, rx, ky, kx, ry, 0, ry],
    [0, ry, -kx, ry, -rx, ky, -rx, 0],
    [-rx, 0, -rx, -ky, -kx, -ry, 0, -ry],
    [0, -ry, kx, -ry, rx, -ky, rx, 0],
  ] as Cubic[] };
}

/** Rotate a path about the origin. Exact: a rotation is a linear map on the control
 *  points, so the rotated cubic IS the cubic of the rotated curve, with no fitting and no
 *  approximation to muddy the comparison. */
function rotatePath(p: GeomPath, angle: number): GeomPath {
  const c = Math.cos(angle), s = Math.sin(angle);
  return p.map((contour) => ({
    closed: contour.closed,
    curves: contour.curves.map((k) => {
      const out = [...k] as Cubic;
      for (let i = 0; i < 8; i += 2) {
        out[i] = k[i]! * c - k[i + 1]! * s;
        out[i + 1] = k[i]! * s + k[i + 1]! * c;
      }
      return out;
    }),
  }));
}

/** Two-sided Hausdorff distance between two paths: the worst distance from a point of
 *  either boundary to the other boundary. Built on `flattenCubic` for the samples and
 *  `nearestOnCubic` for the distances - sampling the RESULT is measurement, which is what
 *  makes it a legitimate oracle for geometry the module must not sample internally.
 *
 *  Stronger than comparing areas: a boundary that bulged one way and pinched the other by
 *  the same amount passes an area test and fails this. */
function hausdorff(a: GeomPath, b: GeomPath): number {
  const oneWay = (from: GeomPath, to: GeomPath): number => {
    let worst = 0;
    for (const c of from) {
      for (const k of c.curves) {
        for (const p of flattenCubic(k, 1e-4)) {
          let best = Infinity;
          for (const tc of to) for (const tk of tc.curves) best = Math.min(best, nearestOnCubic(tk, p.x, p.y, 32).distance);
          worst = Math.max(worst, best);
        }
      }
    }
    return worst;
  };
  return Math.max(oneWay(a, b), oneWay(b, a));
}

// ── oracle 3: dense flattening ────────────────────────────────────────────────

function flattenContour(c: Contour, tol = 1e-7): Pt[] {
  const pts: Pt[] = [];
  for (const k of c.curves) {
    const seg = flattenCubic(k, tol);
    for (let i = pts.length ? 1 : 0; i < seg.length; i++) pts.push(seg[i]!);
  }
  return pts;
}

function polyArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

const areaOf = (c: Contour): number => polyArea(flattenContour(c));

/** Signed: a hole subtracts, which is how the donut fixtures are read. */
function pathArea(p: GeomPath): number {
  return p.reduce((s, c) => s + areaOf(c), 0);
}

function contourPerimeter(c: Contour): number {
  const pts = flattenContour(c);
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return l;
}

function curveCount(p: GeomPath): number {
  return p.reduce((s, c) => s + c.curves.length, 0);
}

/** Even-odd crossing test over a flattened path. Written out rather than taken from
 *  boolean.ts: an oracle that shares its winding code with the module being checked
 *  proves only that the two agree. The results this is asked about never overlap
 *  themselves, so even-odd and nonzero read them identically. */
function insideFlat(rings: Pt[][], x: number, y: number): boolean {
  let inside = false;
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i]!, b = r[(i + 1) % r.length]!;
      if ((a.y > y) !== (b.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        if (x < a.x + t * (b.x - a.x)) inside = !inside;
      }
    }
  }
  return inside;
}

/**
 * An offset is a set operation, and this is the only oracle that checks it as one:
 * for `d > 0` the result is the filled source dilated by a disc of radius d, for
 * `d < 0` it is the source eroded by one. Every grid point is classified from the
 * SOURCE - inside it, or within |d| of it - and compared against the result.
 *
 * Points within `band` of the deciding distance are skipped, because that is where the
 * fit's own tolerance lives and the answer is genuinely undecidable there. Everything
 * else is decided exactly, which is what makes a dropped region or a surviving fold
 * visible: neither moves the boundary, so neither shows up in the residual.
 */
function assertMinkowski(src: GeomPath, d: number, label: string, band = 0.05, step = 3.7): void {
  const out = offsetPath(src, d, { join: 'round' });
  const srcRings = src.map((c) => flattenContour(c, 1e-4));
  const outRings = out.map((c) => flattenContour(c, 1e-4));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of srcRings) for (const p of r) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  const pad = Math.abs(d) + 2 * step;
  let tested = 0;
  const wrong: string[] = [];
  for (let x = x0 - pad; x <= x1 + pad; x += step) {
    for (let y = y0 - pad; y <= y1 + pad; y += step) {
      const dist = distanceToPath(src, x, y);
      if (dist < band || Math.abs(dist - Math.abs(d)) < band) continue;
      const inSrc = insideFlat(srcRings, x, y);
      const want = d > 0 ? (inSrc || dist <= Math.abs(d)) : (inSrc && dist >= Math.abs(d));
      tested++;
      if (insideFlat(outRings, x, y) !== want) {
        if (wrong.length < 5) wrong.push(`(${x.toFixed(2)},${y.toFixed(2)}) want ${want}, dist ${dist.toFixed(3)}`);
      }
    }
  }
  assert.ok(tested > 200, `${label}: only ${tested} points classified - the grid missed the shape`);
  assert.equal(wrong.length, 0, `${label}: ${wrong.length}+ points on the wrong side -${wrong.join(';')}`);
}

// ── oracle 2: the residual an offset is defined by ────────────────────────────

function distanceToPath(src: GeomPath, x: number, y: number): number {
  let best = Infinity;
  for (const c of src) for (const k of c.curves) best = Math.min(best, nearestOnCubic(k, x, y, 64).distance);
  return best;
}

/** The worst |true distance − requested distance| over the whole result. Valid only
 *  while |d| stays under the source's radius of curvature, where the true offset does
 *  not fold; every fixture using it is chosen so it does. */
function worstOffsetError(src: GeomPath, out: GeomPath, d: number, samples = 20): number {
  let worst = 0;
  for (const c of out) {
    for (const k of c.curves) {
      for (let i = 0; i <= samples; i++) {
        const p = evalCubic(k, i / samples);
        worst = Math.max(worst, Math.abs(distanceToPath(src, p.x, p.y) - Math.abs(d)));
      }
    }
  }
  return worst;
}

/** Consecutive curves must share an endpoint, and a closed contour must return to its
 *  start. A result that fails this is not a contour, whatever its area says. */
function assertChained(p: GeomPath, what: string): void {
  for (const c of p) {
    for (let i = 1; i < c.curves.length; i++) {
      const a = c.curves[i - 1]!, b = c.curves[i]!;
      assert.ok(Math.hypot(b[0] - a[6], b[1] - a[7]) <= JOIN_EPS,
        `${what}: curves ${i - 1}/${i} do not meet`);
    }
    if (c.closed && c.curves.length) {
      const a = c.curves[c.curves.length - 1]!, b = c.curves[0]!;
      assert.ok(Math.hypot(b[0] - a[6], b[1] - a[7]) <= JOIN_EPS, `${what}: contour is not closed`);
    }
    for (const k of c.curves) for (const v of k) assert.ok(Number.isFinite(v), `${what}: non-finite coordinate`);
  }
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const SQUARE = poly([0, 0], [100, 0], [100, 100], [0, 100]);          // ccw, area 10000
const TRIANGLE = poly([0, 0], [100, 0], [50, 100]);                    // ccw, area 5000
const ARCH: Cubic = [0, 0, 30, 60, 70, 60, 100, 0];
const SCURVE: Cubic = [0, 0, 100, 0, 0, 100, 100, 100];
/** P2 + P3 = P0 + P1 makes C'(0.5) vanish: a genuine cusp, not a tight bend. */
const CUSP: Cubic = [0, 0, 100, 0, 0, 100, 100, -100];
/** A rectangle pinched to a 10-wide neck at y=50, so an inward offset past 5 severs it. */
const WAIST = poly(
  [0, 0], [100, 0], [100, 30], [55, 50], [100, 70], [100, 100],
  [0, 100], [0, 70], [45, 50], [0, 30],
);
/** A slot cut in from the right edge: two reflex corners, and a mouth whose two sides
 *  grow into each other. */
const CSHAPE = poly(
  [0, 0], [100, 0], [100, 40], [30, 40], [30, 60], [100, 60], [100, 100], [0, 100],
);
/** A pentagram, drawn as five chords - the everyday self-intersecting input, and unlike
 *  a bowtie it has a well-defined interior under the nonzero rule. */
const STAR = poly(...Array.from({ length: 5 }, (_, i): [number, number] => {
  const a = -Math.PI / 2 + (2 * Math.PI * ((i * 2) % 5)) / 5;
  return [100 * Math.cos(a), 100 * Math.sin(a)];
}));

// ── offsetCubic: the primitive ────────────────────────────────────────────────

test('offsetCubic moves a line sideways exactly, and it stays one line', () => {
  // The sign convention stroke.ts is built on: positive is LEFT of travel, so a curve
  // running +x moves to +y. Exact, because an offset line is a translated line.
  const out = offsetCubic(lineToCubic(0, 0, 100, 0), 10);
  assert.equal(out.length, 1, 'a straight source must not be subdivided');
  assert.ok(isLineCubic(out[0]!), 'the offset of a line is a line');
  sameCurve(out[0], [0, 10, 100 / 3, 10, 200 / 3, 10, 100, 10]);
  const back = offsetCubic(lineToCubic(0, 0, 100, 0), -10);
  assert.equal(back.length, 1);
  sameCurve(back[0], [0, -10, 100 / 3, -10, 200 / 3, -10, 100, -10]);
});

test('offsetCubic ends exactly on the true offset, pointing exactly the same way', () => {
  // The claim that makes the fit worth anything: only the two handle LENGTHS are
  // approximated. If the endpoints or the tangent directions were fitted too, a chain of
  // pieces would drift and the joins downstream would be measured from the wrong place.
  const d = 7;
  const pieces = offsetCubic(ARCH, d, 0.01);
  assert.ok(pieces.length >= 1);
  for (const [t, k] of [[0, pieces[0]!], [1, pieces[pieces.length - 1]!]] as const) {
    const tan = tangentAt(ARCH, t), len = Math.hypot(tan.x, tan.y);
    const p = evalCubic(ARCH, t);
    const want = { x: p.x - (d * tan.y) / len, y: p.y + (d * tan.x) / len };
    const got = { x: t === 0 ? k[0] : k[6], y: t === 0 ? k[1] : k[7] };
    near(got.x, want.x, 1e-12, `end ${t} x`); near(got.y, want.y, 1e-12, `end ${t} y`);
    const at = tangentAt(k, t), al = Math.hypot(at.x, at.y);
    near((tan.x * at.y - tan.y * at.x) / (len * al), 0, 1e-12, `end ${t} tangent is not parallel`);
    assert.ok(tan.x * at.x + tan.y * at.y > 0, `end ${t}: the offset runs the other way`);
  }
});

test('offsetCubic: every point of the result is exactly |d| from the source', () => {
  // The property the whole module exists to deliver. A fitted curve that merely looks
  // parallel fails this; the subdivision is supposed to certify it.
  for (const [src, ds] of [[ARCH, [5, -5, 20]], [SCURVE, [5, -5]]] as const) {
    const asPath: GeomPath = [{ curves: [src], closed: false }];
    for (const d of ds) {
      const out: GeomPath = [{ curves: offsetCubic(src, d, 0.01), closed: false }];
      const err = worstOffsetError(asPath, out, d);
      assert.ok(err <= 0.01, `d=${d}: worst deviation ${err} exceeds the 0.01 tolerance`);
    }
  }
});

test('offsetCubic honours a tighter tolerance rather than just cutting more pieces', () => {
  const asPath: GeomPath = [{ curves: [ARCH], closed: false }];
  const loose = worstOffsetError(asPath, [{ curves: offsetCubic(ARCH, 20, 0.01), closed: false }], 20);
  const tight = worstOffsetError(asPath, [{ curves: offsetCubic(ARCH, 20, 0.0001), closed: false }], 20);
  assert.ok(loose <= 0.01, `loose fit missed by ${loose}`);
  assert.ok(tight <= 0.0001, `tight fit missed by ${tight}`);
});

test('offsetCubic keeps the piece count proportional - one curve does not become a polyline', () => {
  // The failure this module exists to prevent. A subdivider with no error feedback
  // emits hundreds of pieces; these numbers leave room for the curvature-feature split
  // (four pieces on an S) without leaving room for flattening.
  assert.ok(offsetCubic(ARCH, 5, 0.01).length <= 16, `arch: ${offsetCubic(ARCH, 5, 0.01).length} pieces`);
  assert.ok(offsetCubic(SCURVE, 5, 0.01).length <= 16, `S: ${offsetCubic(SCURVE, 5, 0.01).length} pieces`);
  assert.ok(offsetCubic(ARCH, 5, 1).length <= offsetCubic(ARCH, 5, 0.01).length,
    'a looser tolerance must not cost more pieces');
});

test('offsetCubic returns the curve untouched for a zero or non-finite distance', () => {
  for (const d of [0, NaN, Infinity, -Infinity]) {
    const out = offsetCubic(ARCH, d);
    assert.equal(out.length, 1, `d=${d} should pass the curve through`);
    assert.deepEqual(out[0], ARCH);
    assert.notEqual(out[0], ARCH, 'the caller must not be handed the input array');
  }
});

test('offsetCubic on a curve that is a single point returns nothing', () => {
  assert.deepEqual(offsetCubic([50, 50, 50, 50, 50, 50, 50, 50], 5), []);
});

// ── fitCubic: Schneider ───────────────────────────────────────────────────────

test('fitCubic recovers ONE curve from points sampled off one cubic', () => {
  // The reason Schneider's reparameterisation gate was dropped: chord length is a poor
  // guess where speed varies, so gating on the first fit splits a shape that one curve
  // matches exactly. 41 points off a single cubic must come back as a single cubic.
  const src: Cubic = [0, 0, 20, 90, 80, -30, 100, 50];
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) pts.push(evalCubic(src, i / 40));
  const fit = fitCubic(pts, { start: unit(20, 90), end: unit(20, 80) }, 0.01);
  assert.equal(fit.length, 1, `expected one curve, got ${fit.length}`);
  assert.ok(worstFitError(pts, fit) <= 0.01, `fit missed by ${worstFitError(pts, fit)}`);
});

test('fitCubic honours the endpoints and the tangents it was given, exactly', () => {
  // Its contract with the offset code: the ends are DATA, not something to be fitted.
  // Both tangents are in the direction of travel - start leaves, end arrives - and a
  // fitter that took the end one as Schneider's inward convention would hand back a
  // curve that arrives backwards.
  const src: Cubic = [0, 0, 20, 90, 80, -30, 100, 50];
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) pts.push(evalCubic(src, i / 40));
  const start = unit(20, 90), end = unit(20, 80);
  const fit = fitCubic(pts, { start, end }, 0.01);
  const first = fit[0]!, last = fit[fit.length - 1]!;
  near(first[0], 0, 1e-12); near(first[1], 0, 1e-12);
  near(last[6], 100, 1e-12); near(last[7], 50, 1e-12);
  for (const [want, k, t] of [[start, first, 0], [end, last, 1]] as const) {
    const got = tangentAt(k, t), l = Math.hypot(got.x, got.y);
    near((want.x * got.y - want.y * got.x) / l, 0, 1e-12, `tangent at ${t} is not parallel`);
    assert.ok(want.x * got.x + want.y * got.y > 0, `tangent at ${t} points backwards`);
  }
});

test('fitCubic splits only when one cubic genuinely cannot hold the shape', () => {
  // A semicircle is past what a single cubic can do at 0.01 of a 100-unit radius, and
  // well within it at 5.
  const semi: Pt[] = [];
  for (let i = 0; i <= 60; i++) {
    const a = Math.PI * (i / 60);
    semi.push({ x: 100 * Math.cos(a), y: 100 * Math.sin(a) });
  }
  const tight = fitCubic(semi, { start: { x: 0, y: 1 }, end: { x: 0, y: -1 } }, 0.01);
  assert.ok(tight.length > 1, 'one cubic cannot be within 0.01 of a semicircle');
  assert.ok(worstFitError(semi, tight) <= 0.01, `tight fit missed by ${worstFitError(semi, tight)}`);
  const loose = fitCubic(semi, { start: { x: 0, y: 1 }, end: { x: 0, y: -1 } }, 5);
  assert.equal(loose.length, 1, 'at a 5-unit tolerance one curve is enough');
  assert.ok(worstFitError(semi, loose) <= 5);
});

test('fitCubic on collinear points is the straight line itself', () => {
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) pts.push({ x: i * 10, y: 0 });
  const fit = fitCubic(pts, { start: { x: 1, y: 0 }, end: { x: 1, y: 0 } });
  assert.equal(fit.length, 1);
  assert.ok(isLineCubic(fit[0]!), 'collinear points must not fit a bulge');
  near(fit[0]![6], 100, 1e-9); near(fit[0]![7], 0, 1e-9);
});

test('fitCubic degenerates safely rather than emitting NaN', () => {
  const t = { start: { x: 1, y: 0 }, end: { x: 1, y: 0 } };
  assert.deepEqual(fitCubic([], t), []);
  assert.deepEqual(fitCubic([{ x: 0, y: 0 }], t), []);
  // A freehand drag that pauses produces runs of identical points.
  assert.deepEqual(fitCubic([{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }], t), []);
  // Zero-length tangents must fall back to the chord, not divide by zero.
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) pts.push({ x: i * 10, y: 0 });
  const fit = fitCubic(pts, { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } });
  assert.equal(fit.length, 1);
  for (const v of fit[0]!) assert.ok(Number.isFinite(v));
});

// ── offsetContour: closed, with analytic areas ────────────────────────────────

test('a square grown by 10 with mitre joins is exactly a 120×120 square', () => {
  const out = offsetContour(SQUARE, 10, { join: 'miter' });
  assert.equal(out.length, 1, `expected one contour, got ${out.length}`);
  near(pathArea(out), 14400, 1e-6);
  assertChained(out, 'square +10 miter');
});

test('bevel and round joins have exactly the areas their corner geometry predicts', () => {
  // Corner contributions at exterior angle θ: bevel ½d²·sin θ, mitre d²·tan(θ/2),
  // round ½d²·θ. For a square all four are right angles, so 50, 100 and 78.54 each.
  near(pathArea(offsetContour(SQUARE, 10, { join: 'bevel' })), 10000 + 4000 + 4 * 50, 1e-6);
  // The round corners are four quadrant arcs at k = 4/3·tan(π/8) - which is exactly the
  // four-cubic circle of radius 10, and NOT π·100. Comparing against π here is the
  // mistake that makes correct code look 0.086 wrong.
  const ownCircle = areaOf(circleContour(10));
  assert.ok(Math.abs(ownCircle - Math.PI * 100) > 0.05, 'the fixture assumption is stale');
  near(pathArea(offsetContour(SQUARE, 10, { join: 'round' })), 14000 + ownCircle, 1e-5);
});

test('the mitre limit turns a spike into a bevel exactly where SVG does', () => {
  // Triangle (0,0)(100,0)(50,100): interior angles 63.435°, 63.435°, 53.130°, so the
  // mitre ratios 1/sin(α/2) are 1.9021, 1.9021 and 2.2360.
  const A = 5000, L = 100 + 2 * Math.hypot(50, 100), d = 10;
  const cot = (a: number) => Math.cos(a / 2) / Math.sin(a / 2);
  const a1 = Math.atan2(100, 50), a3 = Math.PI - 2 * a1;
  const allMitre = A + L * d + d * d * (2 * cot(a1) + cot(a3));
  near(pathArea(offsetContour(TRIANGLE, d)), allMitre, 1e-5);                    // default limit 4
  const allBevel = A + L * d + 0.5 * d * d * (2 * Math.sin(Math.PI - a1) + Math.sin(Math.PI - a3));
  near(pathArea(offsetContour(TRIANGLE, d, { join: 'bevel' })), allBevel, 1e-5);
  // At a limit of 2 only the sharpest corner gives way, so the answer is neither.
  const mixed = A + L * d + d * d * 2 * cot(a1) + 0.5 * d * d * Math.sin(Math.PI - a3);
  const got = pathArea(offsetContour(TRIANGLE, d, { miterLimit: 2 }));
  near(got, mixed, 1e-5);
  assert.ok(Math.abs(got - allMitre) > 100 && Math.abs(got - allBevel) > 100,
    'the limit must bite on exactly one corner');
});

test('a mitre on a 36° spike reaches exactly d/sin(18°) from the vertex', () => {
  // The pentagram's points are the sharpest corner in the suite, and the mitre ratio
  // 1/sin(18°) = 3.236 sits under SVG's default limit of 4, so every one is kept. The
  // furthest the outline then gets from the source is that tip, exactly - which is also
  // the reason a shadow ramp wants round joins and gets spikes if it says nothing.
  const spike = 10 * (1 / Math.sin(Math.PI / 10) - 1);
  near(worstOffsetError([STAR], offsetContour(STAR, 10, { join: 'miter' }), 10), spike, 1e-4);
  assert.ok(worstOffsetError([STAR], offsetContour(STAR, 10, { join: 'round' }), 10) <= 0.01,
    'a round join stays on the true offset all the way around the point');
});

test('shrinking a square is exact to machine precision', () => {
  // An inward offset goes through the loop resolution, so "exact" here is a claim about
  // that path too: no sliver, no spurious corner triangle, no drift.
  const out = offsetContour(SQUARE, -10);
  assert.equal(out.length, 1, `expected one contour, got ${out.length}`);
  near(pathArea(out), 6400, 1e-9);
  assert.ok(worstOffsetError([SQUARE], out, -10) <= 1e-9,
    'every point of an inward polygon offset is exactly |d| from the source');
  assertChained(out, 'square -10');
});

test('an inward offset past the inradius vanishes instead of turning inside out', () => {
  near(pathArea(offsetContour(SQUARE, -49)), 4, 1e-9);
  near(pathArea(offsetContour(SQUARE, -49.9)), 0.04, 1e-9);
  assert.deepEqual(offsetContour(SQUARE, -50), [], 'exactly at the inradius there is nothing left');
  assert.deepEqual(offsetContour(SQUARE, -60), [], 'past it, nonzero winding would keep the inverted core');
});

test('eroding past the radius of curvature gives the exact sharp-cornered answer', () => {
  // The case the whole error-measured subdivision is supposed to survive: |d| beyond the
  // local radius of curvature, where the true offset folds into a swallowtail and the
  // answer depends entirely on the loop resolution. It has a closed form. A 100×100
  // rounded rect of radius 20 is the 60×60 square [20,80]² dilated by a disc of 20, and
  // eroding that by d>20 is eroding the 60×60 square by (d−20) - a SHARP-cornered
  // square, with every trace of the arcs gone.
  const rr = roundedRect(20);
  for (const [d, side] of [[-20, 60], [-25, 50], [-30, 40], [-40, 20]] as const) {
    const out = offsetContour(rr, d, { join: 'round' });
    assert.equal(out.length, 1, `d=${d}: expected one contour, got ${out.length}`);
    assert.equal(out[0]!.curves.length, 4, `d=${d}: a square has four sides, got ${out[0]!.curves.length}`);
    near(pathArea(out), side * side, 1e-6, `d=${d}`);
    const half = (100 - side) / 2;
    for (const k of out[0]!.curves) {
      for (const [x, y] of [[k[0], k[1]], [k[6], k[7]]] as const) {
        near(Math.min(Math.abs(x - half), Math.abs(x - (100 - half))), 0, 1e-6, `d=${d}: corner x`);
        near(Math.min(Math.abs(y - half), Math.abs(y - (100 - half))), 0, 1e-6, `d=${d}: corner y`);
      }
    }
    assert.ok(worstOffsetError([rr], out, d) <= 0.01, `d=${d}: the eroded boundary left the true offset`);
  }
  assert.deepEqual(offsetContour(rr, -51, { join: 'round' }), [], 'past the inradius, nothing');
});

test('a positive distance grows the shape whichever way it was wound', () => {
  const cw = poly([0, 100], [100, 100], [100, 0], [0, 0]);
  assert.ok(areaOf(cw) < 0, 'the fixture must be wound the other way');
  const grown = offsetContour(cw, 10);
  near(pathArea(grown), -14400, 1e-6);      // grown, and still clockwise
  near(pathArea(offsetContour(cw, -10)), -6400, 1e-6);
});

test('the outward decision rests on contourArea, so it is checked against the oracle', () => {
  // `offsetContour` reads the sign of `contourArea` to decide which way is out, and it
  // reads it from ONE contour. An area that is merely close is fine; an area with the
  // wrong sign inverts the whole offset, and on curved contours that is exactly what a
  // decomposition into chord-plus-bulge gets wrong when the two terms are added with
  // mismatched signs.
  for (const c of [circleContour(100), circleContour(3), SQUARE, roundedRect(20), TRIANGLE]) {
    const dense = areaOf(c);
    near(contourArea(c), dense, Math.abs(dense) * 1e-6, 'contourArea disagrees with the dense oracle');
    assert.equal(contourArea(c) > 0, dense > 0, 'contourArea reports the wrong orientation');
  }
});

test('an inward offset severs a waisted shape into two equal halves', () => {
  const cut = offsetContour(WAIST, -6, { join: 'round' });
  assert.equal(cut.length, 2, `a 10-wide neck offset by 6 must split, got ${cut.length} contours`);
  const areas = cut.map(areaOf);
  near(areas[0]!, areas[1]!, Math.abs(areas[0]!) * 1e-9);
  assert.ok(worstOffsetError([WAIST], cut, -6) <= 0.01,
    'the severed boundary is still made of offset material, so it stays 6 from the source');
  assertChained(cut, 'waist -6');
  assert.equal(offsetContour(WAIST, -2, { join: 'round' }).length, 1, 'a 2-unit inset leaves the neck intact');
});

// ── offsetContour: curved sources ─────────────────────────────────────────────

test('every point of a curved offset is the requested distance from the source', () => {
  const circle = circleContour(100);
  const rounded = roundedRect(20);
  for (const [src, ds] of [[circle, [20, -20, 60, -95]], [rounded, [10, -10]]] as const) {
    for (const d of ds) {
      const out = offsetContour(src, d, { join: 'round' });
      assert.ok(out.length >= 1, `d=${d} produced nothing`);
      const err = worstOffsetError([src], out, d);
      assert.ok(err <= 0.01, `d=${d}: worst deviation ${err} exceeds the 0.01 tolerance`);
      assertChained(out, `curved offset ${d}`);
    }
  }
});

test("a convex offset has the area Steiner's formula demands", () => {
  // A(d) = A + L·d + πd² is exact for the parallel body of a convex curve, so it is a
  // check on the whole pipeline that no fitted piece is systematically fat or thin.
  // Both A and L are taken off the SAME source curves, never off an ideal circle.
  const src = circleContour(100);
  const A = areaOf(src), L = contourPerimeter(src);
  for (const d of [20, -20]) {
    const out = offsetContour(src, d, { join: 'round' });
    const predicted = A + L * d + Math.PI * d * d;
    // The result is certified within 0.01 of the true offset everywhere, so its area
    // cannot be out by more than that band times the offset's own perimeter.
    const band = 0.01 * (L + 2 * Math.PI * Math.abs(d));
    assert.ok(Math.abs(pathArea(out) - predicted) <= band,
      `d=${d}: area ${pathArea(out)} vs Steiner ${predicted}, outside the ±${band} the tolerance allows`);
  }
});

test('a four-curve circle offsets to a handful of curves, not to a polyline', () => {
  const src = circleContour(100);
  const fine = offsetContour(src, 20, { tol: 0.01 });
  const coarse = offsetContour(src, 20, { tol: 1 });
  assert.ok(curveCount(fine) <= 40, `${curveCount(fine)} curves for a 4-curve source at tol 0.01`);
  assert.ok(curveCount(coarse) <= curveCount(fine), 'a looser tolerance must not cost more curves');
});

test('a smooth contour gets no joins at all - the pieces already meet', () => {
  // The shared-endpoint trap, in its offset form. Consecutive curves of a circle are
  // tangent-continuous, so their offsets meet exactly and nothing may be inserted
  // between them. A join wedged in at every source vertex would still chain, still be
  // closed, and still measure |d| from the source - and would quietly add a curve per
  // vertex to every shape that goes near this code.
  const src = circleContour(100);
  for (const d of [20, -20]) {
    const pieces = src.curves.reduce((s, k) => s + offsetCubic(k, -d, 0.01).length, 0);
    const out = offsetContour(src, d, { tol: 0.01 });
    assert.equal(out.length, 1);
    assert.equal(curveCount(out), pieces,
      `d=${d}: ${curveCount(out)} curves for ${pieces} offset pieces - joins were inserted at a smooth vertex`);
  }
});

// ── offsetPath: several contours at once ──────────────────────────────────────

test('a hole closes in as the outline pushes out', () => {
  // The sign is resolved once for the whole path, from its largest contour. If it were
  // resolved per contour the hole would march the same way as the outline.
  const donut: GeomPath = [SQUARE, poly([40, 40], [40, 60], [60, 60], [60, 40])];
  const out = offsetPath(donut, 5);
  assert.equal(out.length, 2, `expected an outline and a hole, got ${out.length}`);
  const areas = out.map(areaOf).sort((a, b) => b - a);
  near(areas[0]!, 12100, 1e-6);      // 110 × 110
  near(areas[1]!, -100, 1e-6);       // 10 × 10, wound the other way
  const shrunk = offsetPath(donut, -5);
  const inner = shrunk.map(areaOf).sort((a, b) => b - a);
  near(inner[0]!, 8100, 1e-6);       // 90 × 90
  near(inner[1]!, -900, 1e-6);       // 30 × 30
  assertChained(out, 'donut +5');
});

test('a curved hole shrinks by the same distance the curved outline grows', () => {
  const donut: GeomPath = [circleContour(100), reverse(circleContour(40))];
  const out = offsetPath(donut, 10, { join: 'round' });
  assert.equal(out.length, 2, `expected an outline and a hole, got ${out.length}`);
  const areas = out.map(areaOf).sort((a, b) => b - a);
  const A = areaOf(circleContour(100)), L = contourPerimeter(circleContour(100));
  const hA = areaOf(circleContour(40)), hL = contourPerimeter(circleContour(40));
  near(areas[0]!, A + L * 10 + Math.PI * 100, 0.01 * (L + 20 * Math.PI), 'outline');
  near(-areas[1]!, hA - hL * 10 + Math.PI * 100, 0.01 * (hL + 20 * Math.PI), 'hole');
  assert.ok(worstOffsetError(donut, out, 10) <= 0.01);
  assertChained(out, 'circular donut +10');
});

test('growing past the inradius of a hole consumes it', () => {
  const donut: GeomPath = [SQUARE, poly([40, 40], [40, 60], [60, 60], [60, 40])];
  const out = offsetPath(donut, 12);
  assert.equal(out.length, 1, 'the hole must be gone, not left inverted');
  near(pathArea(out), 15376, 1e-6);  // 124 × 124
});

test('disjoint shapes merge when they grow into each other', () => {
  const two: GeomPath = [SQUARE, poly([110, 0], [210, 0], [210, 100], [110, 100])];
  const apart = offsetPath(two, 2);
  assert.equal(apart.length, 2, 'a 10-unit gap survives a 2-unit growth');
  near(pathArea(apart), 2 * 104 * 104, 1e-6);
  const merged = offsetPath(two, 6);
  assert.equal(merged.length, 1, 'growing by 6 closes the gap, so the two become one');
  near(pathArea(merged), 112 * 112 * 2 - 2 * 112, 1e-6);
});

test('coincident and nested duplicates collapse instead of doubling up', () => {
  // Two ways of handing the same region in twice. Under the nonzero rule both are the
  // same shape, and a winding filter that counted them separately would show it here.
  const identical = offsetPath([SQUARE, poly([0, 0], [100, 0], [100, 100], [0, 100])], 5);
  assert.equal(identical.length, 1);
  near(pathArea(identical), 12100, 1e-6);
  const nested = offsetPath([SQUARE, poly([40, 40], [60, 40], [60, 60], [40, 60])], 5);
  assert.equal(nested.length, 1, 'a same-winding contour inside another is not a hole');
  near(pathArea(nested), 12100, 1e-6);
});

test('shapes that touch without crossing are handled as contact, not as a crossing', () => {
  const abutting: GeomPath = [SQUARE, poly([100, 0], [200, 0], [200, 100], [100, 100])];
  const grown = offsetPath(abutting, 5);
  // The region is right either way; what is asked here is that the result is only the
  // region. A contour enclosing no area is not geometry - it renders as nothing, and it
  // is a knot the next boolean has to resolve.
  const solid = grown.filter((c) => Math.abs(areaOf(c)) > 1e-9);
  assert.equal(solid.length, 1, 'a shared edge means one region');
  near(pathArea(grown), 210 * 110, 1e-6);
  const shrunk = offsetPath(abutting, -5);
  assert.equal(shrunk.length, 2, 'shrinking pulls them apart again');
  near(pathArea(shrunk), 2 * 90 * 90, 1e-6);
  assert.equal(grown.length, solid.length,
    `${grown.length - solid.length} zero-area hairline contours survived the offset`);
});

test('two circles touching at a single point merge outward and separate inward', () => {
  // Tangency is contact without crossing: there is no isolated intersection to find at
  // (50,0), and a resolver that needs one either fuses the two grown discs into a shape
  // with a knot at the contact or leaves the overlap in twice.
  const kiss: GeomPath = [circleAt(0, 0, 50), circleAt(100, 0, 50)];
  const grown = offsetPath(kiss, 5, { join: 'round' });
  assert.equal(grown.length, 1, `growing through a tangency must give one region, got ${grown.length}`);
  assert.ok(worstOffsetError(kiss, grown, 5) <= 0.01, 'the merged boundary is all offset material');
  assertChained(grown, 'kissing circles +5');
  const shrunk = offsetPath(kiss, -5, { join: 'round' });
  assert.equal(shrunk.length, 2, 'shrinking through the same tangency gives two');
  near(shrunk.map(areaOf)[0]!, shrunk.map(areaOf)[1]!, 1e-6);
});

test('open contours keep the primitive sign convention and come back open', () => {
  const line: Contour = { closed: false, curves: [lineToCubic(0, 0, 100, 0)] };
  const left = offsetPath([line], 10);
  assert.equal(left.length, 1);
  assert.equal(left[0]!.closed, false, 'an open path must not be closed into a region');
  assert.equal(left[0]!.curves.length, 1);
  sameCurve(left[0]!.curves[0], [0, 10, 100 / 3, 10, 200 / 3, 10, 100, 10]);
  // Mixed input: the closed contour normalises to outward, the open one does not.
  const mixed = offsetPath([SQUARE, line], 10);
  assert.deepEqual(mixed.map((c) => c.closed), [true, false]);
  near(areaOf(mixed[0]!), 14400, 1e-6);
});

test('an outward round join around a corner stays exactly |d| from the corner', () => {
  // The arc IS the offset there, so the residual holds through the join. A mitre puts
  // its tip at d·√2 and a bevel dips to d·cos45, both exactly.
  const corner: Contour = { closed: false, curves: [lineToCubic(0, 0, 100, 0), lineToCubic(100, 0, 100, 100)] };
  const src: GeomPath = [corner];
  const rounded = offsetContour(corner, -10, { join: 'round' });
  assert.ok(worstOffsetError(src, rounded, -10) <= 0.01,
    `round join deviates by ${worstOffsetError(src, rounded, -10)}`);
  near(worstOffsetError(src, offsetContour(corner, -10, { join: 'miter' }), -10), 10 * (Math.SQRT2 - 1), 1e-6);
  near(worstOffsetError(src, offsetContour(corner, -10, { join: 'bevel' }), -10), 10 * (1 - Math.SQRT1_2), 1e-6);
});

test('the inner side of an open corner is left uncleaned, but still a connected chain', () => {
  // Documented: an open offset is not a region, so selfUnion cannot resolve it and
  // strokeToPath must close its two sides itself. What is still owed is continuity.
  const corner: Contour = { closed: false, curves: [lineToCubic(0, 0, 100, 0), lineToCubic(100, 0, 100, 100)] };
  const inner = offsetContour(corner, 10, { join: 'round' });
  assert.equal(inner.length, 1);
  assert.equal(inner[0]!.closed, false);
  assertChained(inner, 'inner open offset');
});

test('empty and no-op inputs give empty or untouched output', () => {
  assert.deepEqual(offsetPath([], 10), []);
  assert.deepEqual(offsetContour({ curves: [], closed: true }, 10), []);
  assert.deepEqual(offsetContour({ curves: [[50, 50, 50, 50, 50, 50, 50, 50]], closed: true }, 5), []);
  for (const d of [0, NaN, Infinity]) {
    const out = offsetPath([SQUARE], d);
    assert.equal(out.length, 1, `d=${d}`);
    near(pathArea(out), 10000, 1e-9);
    out[0]!.curves[0]![0] = 999;
    assert.equal(SQUARE.curves[0]![0], 0, 'the pass-through must be a copy, not the input arrays');
  }
});

test('eroding a CIRCLE past its radius leaves nothing, however far past', () => {
  // The defect a winding-based retain test cannot see, and the reason the survivors are
  // chosen by measurement instead. Eroding a counter-clockwise circle of r=50 by 51 maps
  // the point at angle θ to the point of radius 1 at angle θ+π, which still sweeps
  // counter-clockwise: handedness is PRESERVED, so the inside-out disc reads as material
  // and the offsetter grew a shape where it owed the caller nothing. It grew with the
  // distance - 3.07, 78.2, 1255, 7851, 31408 for the five distances below - so the guard
  // has to cover the range rather than one value. A square of the same proportions was
  // always right, which is how this survived a suite.
  for (const [what, c] of [['ccw', circleContour(50)], ['cw', reverse(circleContour(50))]] as const) {
    assert.equal(Math.sign(areaOf(c)), what === 'ccw' ? 1 : -1, 'the fixture must be wound as labelled');
    for (const d of [-51, -55, -70, -100, -150]) {
      for (const join of ['miter', 'round', 'bevel'] as const) {
        const out = offsetPath([c], d, { join });
        assert.deepEqual(out, [],
          `${what} circle r=50 eroded by ${d} with ${join} joins: expected nothing, got ${out.length} contours of area ${pathArea(out)}`);
      }
    }
    // Just inside the radius the ring is still real, so the rule is not "curves vanish".
    const alive = offsetPath([c], -49, { join: 'round' });
    assert.equal(alive.length, 1, 'eroding by less than the radius must leave a disc');
    // A disc of r≈1, and only approximately π: what is left is the fitted offset of a
    // cubic circle, so it carries both the fixture's 2.8e-4 excess and the fit's own
    // tolerance - magnified here because 0.01 of tolerance on a radius of 1 is a percent.
    near(Math.abs(pathArea(alive)), Math.PI, 0.05, 'the r=1 disc that is left');
  }
});

test('an ellipse eroded past its own radius of curvature is empty too', () => {
  // The same property where the fold is partial rather than total: an 80×25 ellipse has a
  // minimum radius of curvature of 25²/80 = 7.8 at its ends, so an erosion of 25 folds
  // there while the flanks are still ordinary - and at 26 nothing at all is left, since 25
  // is its inradius.
  const e = ellipseContour(80, 25);
  assert.ok(Math.abs(pathArea([offsetPath([e], -24, { join: 'round' })].flat())) > 1,
    'at -24 there is still material');
  for (const d of [-25.1, -30, -60, -120]) {
    const out = offsetPath([e], d, { join: 'round' });
    assert.deepEqual(out, [], `ellipse eroded by ${d}: got ${out.length} contours of area ${pathArea(out)}`);
  }
});

test('a contour that passes close to itself keeps only the contour the erosion has', () => {
  // A regression, and the only one found by MEASURING what the retain probe was doing rather
  // than by reasoning about it. `isOffsetMaterial` asks `nearestOnCubic` how far a probe
  // point is from the source; while that probe bracketed its answer on a sample grid it
  // picked a basin, and on a contour whose branches pass close to one another it refined the
  // wrong one and under-reported the distance by orders of magnitude. Here it kept a whole
  // second contour of area 208.6 alongside the real 1058.8 - a fifth of the output invented,
  // in the same family as the eroded circle that grew above.
  const src: GeomPath = [{ closed: true, curves: [
    [34.904874823987484, 25.09455450810492, 46.455714628100395, 46.71949555166066,
      36.66128469631076, 53.23728340677917, -18.329239916056395, -49.74311702884734],
    [-18.329239916056395, -49.74311702884734, 55.866357777267694, -22.492636749520898,
      -7.857339531183243, -29.754986045882106, -22.509174160659313, -54.79161470197141],
    [-22.509174160659313, -54.79161470197141, -49.81986517086625, -22.745379405096173,
      15.67388903349638, 48.47163730300963, 34.904874823987484, 25.09455450810492],
  ] }];
  const out = offsetPath(src, -3);

  // Brute force for the verdict, deliberately: the thing under test is the probe, so the
  // check cannot go through it. A contour of an erosion by 3 has every point of its own
  // boundary at least 3 from the source - the spurious one came within 0.087.
  const brute = (x: number, y: number): number => {
    let best = Infinity;
    for (const c of src) for (const k of c.curves) {
      for (let i = 0; i <= 20000; i++) {
        const p = evalCubic(k, i / 20000);
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  };
  for (const c of out) {
    for (const k of c.curves) {
      for (const u of [0.1, 0.5, 0.9]) {
        const p = evalCubic(k, u);
        const d = brute(p.x, p.y);
        assert.ok(d >= 3 - 0.01,
          `a kept contour of area ${areaOf(c).toFixed(4)} has a point only ${d.toFixed(4)} from the source`);
      }
    }
  }
  assert.equal(out.length, 1, `expected one contour, got ${out.length} of areas ${out.map((c) => areaOf(c).toFixed(4)).join(',')}`);
  near(Math.abs(pathArea(out)), 1058.7971, 0.01, 'the one contour the erosion has');
});

// ── rotation invariance ───────────────────────────────────────────────────────

test('offsetting commutes with rotation, on every shape and both signs', () => {
  // The property behind the bbox-epsilon defect, and the most valuable single assertion in
  // this file: an offset is defined by distances, and distances do not know about axes. The
  // probe step used to be a bbox-scaled epsilon, so a 200×20 rectangle inset by −9.95 kept
  // its 0.1-thick ribbon axis-aligned and came back EMPTY at 45°.
  //
  // Compared two ways. Areas catch a region kept or dropped; the two-sided Hausdorff
  // distance catches a boundary that moved without changing area, which is the failure an
  // area test alone would ratify.
  const shapes: [string, GeomPath, number[]][] = [
    ['thin 200×20 rect', [poly([0, 0], [200, 0], [200, 20], [0, 20])], [-9.95, -5, 8, 20]],
    ['ellipse 80×25', [ellipseContour(80, 25)], [-24, -20, 10, 40]],
    ['rounded rect r=20', [roundedRect(20)], [-30, -10, 12]],
    ['C shape', [CSHAPE], [-8, 15]],
  ];
  for (const [name, shape, ds] of shapes) {
    for (const d of ds) {
      const base = offsetPath(shape, d, { join: 'round' });
      const baseArea = pathArea(base);
      assert.ok(base.length > 0, `${name} d=${d}: the axis-aligned case must be non-empty to compare against`);
      for (const deg of [0, 13, 30, 45, 90, 137]) {
        const a = (deg * Math.PI) / 180;
        const rotatedThenOffset = offsetPath(rotatePath(shape, a), d, { join: 'round' });
        const offsetThenRotated = rotatePath(base, a);
        const label = `${name} d=${d} at ${deg}°`;
        assert.equal(rotatedThenOffset.length, offsetThenRotated.length, `${label}: contour count`);
        assert.ok(rotatedThenOffset.length > 0, `${label}: came back EMPTY - the defect exactly`);
        near(pathArea(rotatedThenOffset), baseArea, Math.abs(baseArea) * 1e-4, `${label}: area`);
        // 0.02 is twice the offsetter's own default fitting tolerance of 0.01, so this is
        // "the two agree to the accuracy either was promised", not a slackened bound. The
        // worst measured across this matrix is 5.4e-3.
        assert.ok(hausdorff(rotatedThenOffset, offsetThenRotated) <= 0.02,
          `${label}: the two boundaries differ by ${hausdorff(rotatedThenOffset, offsetThenRotated)}`);
        assertChained(rotatedThenOffset, label);
      }
    }
  }
});

test('the thin-ribbon inset is exact at every angle, not merely non-empty', () => {
  // The original reproduction, with its closed form: 200×20 inset by 9.95 leaves a
  // 180.1×0.1 ribbon of area 18.01, whatever the shape was rotated by first.
  const rectangle: GeomPath = [poly([0, 0], [200, 0], [200, 20], [0, 20])];
  for (const deg of [0, 13, 30, 45, 90, 137]) {
    const out = offsetPath(rotatePath(rectangle, (deg * Math.PI) / 180), -9.95);
    assert.equal(out.length, 1, `${deg}°: expected one ribbon, got ${out.length}`);
    near(pathArea(out), 18.01, 1e-6, `${deg}° ribbon area`);
  }
});

// ── non-finite input ──────────────────────────────────────────────────────────

test('a non-finite coordinate is dropped, never spread through the output as NaN', () => {
  // A curve with a coordinate that is not a number has no normal, so every step of the
  // offsetter would propagate it: `offsetPath` on a curve ending at Infinity used to emit
  // NaN control points. The contract is to drop the curve - a gap in a contour is the one
  // thing this module already handles everywhere, since gaps become joins.
  const inf = Number.POSITIVE_INFINITY;
  for (const bad of [
    [0, 0, 10, inf, 20, 0, 30, 0], [0, 0, 10, 0, 20, 0, inf, 0],
    [0, 0, 10, Number.NaN, 20, 0, 30, 0], [-inf, 0, 10, 0, 20, 0, 30, 0],
  ] as Cubic[]) {
    assert.deepEqual(offsetCubic(bad, 5), [], 'a non-finite curve has no offset to give');
    assert.deepEqual(offsetCubic(bad, -5), []);
  }
  const inject = (c: Contour, k: Cubic): Contour => ({ closed: true, curves: [...c.curves, k] });
  for (const [what, src] of [
    ['square + an infinite curve', [inject(SQUARE, [0, 0, inf, 0, 0, 0, 0, 0] as Cubic)]],
    ['every coordinate infinite', [{ closed: true, curves: [[inf, inf, inf, inf, inf, inf, inf, inf] as Cubic] }]],
    ['one NaN control point', [{ closed: true,
      curves: [[0, 0, Number.NaN, 0, 50, 50, 100, 0] as Cubic, lineToCubic(100, 0, 0, 0)] }]],
  ] as [string, GeomPath][]) {
    for (const d of [10, -10]) {
      const out = offsetPath(src, d);
      for (const c of out) {
        for (const k of c.curves) {
          for (const v of k) assert.ok(Number.isFinite(v), `${what} d=${d}: a non-finite coordinate reached the output`);
        }
      }
      assertChained(out, `${what} d=${d}`);
    }
  }
  // The square survives its poisoned neighbour intact - dropping is not discarding.
  const poisoned = [inject(SQUARE, [0, 0, inf, 0, 0, 0, 0, 0] as Cubic)];
  near(pathArea(offsetPath(poisoned, 10)), 14400, 1e-6, 'the good geometry still offsets');
  near(pathArea(offsetPath(poisoned, -10)), 6400, 1e-6);
});

// ── oracle 3: the offset as a set operation ───────────────────────────────────

test('an outward offset is the source dilated by a disc, point by point', () => {
  // The check the residual cannot make. Both a region that should have survived and a
  // fold that should have been dropped leave every remaining boundary point exactly |d|
  // from the source, so the residual passes and the shape is still wrong.
  assertMinkowski([SQUARE], 10, 'square +10');
  assertMinkowski([CSHAPE], 15, 'C +15');           // the mouth grows shut
  assertMinkowski([roundedRect(20)], 12, 'rounded rect +12');
  assertMinkowski([circleContour(100)], 20, 'circle +20');
  assertMinkowski([SQUARE, poly([110, 0], [210, 0], [210, 100], [110, 100])], 6, 'two squares +6');
  assertMinkowski([SQUARE, poly([40, 40], [40, 60], [60, 60], [60, 40])], 5, 'donut +5');
});

test('an inward offset is the source eroded by a disc, point by point', () => {
  assertMinkowski([SQUARE], -10, 'square -10');
  assertMinkowski([CSHAPE], -8, 'C -8');
  assertMinkowski([roundedRect(20)], -30, 'rounded rect -30');   // past the corner radius
  assertMinkowski([circleContour(100)], -20, 'circle -20');
  assertMinkowski([WAIST], -6, 'waist -6');                      // severs into two
  assertMinkowski([SQUARE, poly([40, 40], [40, 60], [60, 60], [60, 40])], -5, 'donut -5');
});

test('a concave mouth grows shut without swallowing what is out of reach', () => {
  // The slot in the C is 20 wide and 70 deep, so growing by 15 fills it and the result
  // is the square grown by 15 - except at the mouth, where the two corners at (100,40)
  // and (100,60) are more than 30 apart and their discs do not meet the far side. The
  // notch between them is a fold's opposite: material the offset must NOT invent.
  const out = offsetPath([CSHAPE], 15, { join: 'round' });
  assert.equal(out.length, 1);
  const rings = out.map((c) => flattenContour(c, 1e-4));
  // (110,50) is 14.14 from the corner at (100,40); (114,50) is 17.20 from it.
  assert.ok(insideFlat(rings, 110, 50), 'a point 14.14 from the source must be inside a 15-offset');
  assert.ok(!insideFlat(rings, 114, 50), 'a point 17.20 from the source must not be');
  assert.ok(worstOffsetError([CSHAPE], out, 15) <= 0.01);
});

// ── traps ─────────────────────────────────────────────────────────────────────

test('a cusp inside one cubic is joined, not cut across', () => {
  // At a tangent reversal the true offset jumps 2|d| to the other side, so the two pieces
  // gap by 2|d| and a round join there is a half-disc of radius |d| about the cusp point.
  // Welding the gap shut instead - which is what happens when the cut lands a whisker off
  // the reversal and the two ends come back to the same place - leaves a fitted piece
  // running straight through the cusp, at distance 0 from a source that asked for |d|.
  //
  // The cap is asserted directly rather than through `worstOffsetError`, and on BOTH
  // sides. That helper measures the distance to the whole source and is documented as
  // valid only where |d| stays under the radius of curvature; a cusp's radius of
  // curvature is zero, so on the concave side the exact pointwise offset plunges into the
  // spike's throat, where the OTHER branch of the same curve is nearer than |d|. Measured
  // on this fixture: the branches are 4.59 apart at t=0.3 and 2.08 at t=0.35, so the
  // exact offset at d=−5 comes back 0.25 from the far branch around t=0.32. That is the
  // fold the helper excludes, not a defect, so the concave side is checked against the
  // cusp point itself, which is what the join is about.
  const src: GeomPath = [{ curves: [CUSP], closed: false }];
  const tip = evalCubic(CUSP, 0.5);                     // (50,25), where C'(0.5) vanishes
  for (const d of [5, -5]) {
    const out = offsetContour(src[0]!, d, { join: 'round' });
    assert.equal(out.length, 1, `d=${d}: a cusp must not break the chain in two`);
    assertChained(out, `cusp ${d}`);

    // Nothing may come nearer the cusp than |d|, and something must sit exactly there:
    // together that is "the outline goes around the tip", and a chord across it fails the
    // first half by the whole offset distance.
    let nearest = Infinity, apex = Infinity;
    for (const k of out[0]!.curves) {
      for (let i = 0; i <= 24; i++) {
        const p = evalCubic(k, i / 24);
        nearest = Math.min(nearest, Math.hypot(p.x - tip.x, p.y - tip.y));
        // The spike points up, so the cap arcs over the top of it.
        apex = Math.min(apex, Math.hypot(p.x - tip.x, p.y - (tip.y + Math.abs(d))));
      }
    }
    near(nearest, Math.abs(d), 2e-3, `d=${d}: the outline reaches ${nearest} from the cusp`);
    assert.ok(apex <= 2e-3, `d=${d}: nothing arcs over the cusp - the cap is ${apex} short`);
  }

  // On the convex side the offset does not fold, so the full residual still has to hold
  // through the join: the half-disc IS the offset there.
  const err = worstOffsetError(src, offsetContour(src[0]!, 5, { join: 'round' }), 5);
  assert.ok(err <= 0.01, `the outward offset strays ${err} from |d| near the cusp`);
});

test('the implicit closing edge of a closed contour is part of the shape', () => {
  // path.ts stores the wrap implicitly - `closed: true` with no closing curve is what
  // `pathFromSubPaths` produces for every `Z` that parseSvgPath sees, so this is the
  // shape most real input arrives in. Offsetting it must give the same answer as
  // offsetting the same outline with the edge written out.
  const implicit: Contour = { closed: true, curves: [
    lineToCubic(0, 0, 100, 0), lineToCubic(100, 0, 100, 100), lineToCubic(100, 100, 0, 100),
  ] };
  const explicit = closeContour(implicit);
  assert.equal(explicit.curves.length, 4, 'closeContour must write the edge out');
  near(pathArea(offsetContour(implicit, -10)), pathArea(offsetContour(explicit, -10)), 1e-6);
  near(pathArea(offsetContour(implicit, -10)), 6400, 1e-6);
  near(pathArea(offsetContour(implicit, 10)), 14400, 1e-6);
});

test('a self-intersecting star offsets to one outline, not to five overlapping ones', () => {
  // The trap in its everyday form. A pentagram crosses itself five times and its
  // interior is only defined by the winding rule, so the raw offset loops overlap
  // heavily and the resolver has to collapse them. Unlike a bowtie the answer is not
  // ambiguous: the nonzero interior is one region, and its outward offset is one
  // boundary, everywhere exactly |d| from the source.
  const out = offsetContour(STAR, 10, { join: 'round' });
  assert.equal(out.length, 1, `expected one contour, got ${out.length}`);
  assert.ok(worstOffsetError([STAR], out, 10) <= 0.01,
    `the outline strays ${worstOffsetError([STAR], out, 10)} from |d|`);
  assert.ok(areaOf(out[0]!) > areaOf(STAR), 'growing a star must not shrink it');
  assertChained(out, 'star +10');
});

test('a self-intersecting closed input comes back finite and closed', () => {
  // A bowtie has no well-defined inside, so no area is asserted - what is owed is that
  // the resolver terminates and hands back contours rather than a knot.
  const bowtie = poly([0, 0], [100, 100], [100, 0], [0, 100]);
  const t0 = process.hrtime.bigint();
  const out = offsetContour(bowtie, 5);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 2000, `took ${ms.toFixed(0)}ms on a self-intersecting input`);
  assertChained(out, 'bowtie +5');
});

test('a zero-area slit offsets to the stadium around it', () => {
  // Out and back along the same line: coincident curves, no interior at all. With round
  // joins the answer is exact - a 100×10 rectangle plus two half-discs - and the discs
  // are the same four-cubic circle the join builds, not π·25.
  const slit: Contour = { closed: true, curves: [lineToCubic(0, 0, 100, 0), lineToCubic(100, 0, 0, 0)] };
  const round = offsetContour(slit, 5, { join: 'round' });
  assert.equal(round.length, 1, `expected one contour, got ${round.length}`);
  near(Math.abs(pathArea(round)), 1000 + areaOf(circleContour(5)), 1e-6);
  assertChained(round, 'slit +5 round');
  // A mitre at a 180° reversal is at infinity, so SVG's limit makes it a bevel: the caps
  // flatten and exactly the rectangle is left.
  near(Math.abs(pathArea(offsetContour(slit, 5))), 1000, 1e-6);
});

test('offsetting a many-curve contour stays interactive', () => {
  // A shadow ramp runs this twenty times over. Not a benchmark, a guard against the
  // resolver going superlinear on contour size.
  const curves: Cubic[] = [];
  const N = 60;
  for (let i = 0; i < N; i++) {
    const a0 = (2 * Math.PI * i) / N, a1 = (2 * Math.PI * (i + 1)) / N;
    const r0 = 100 + 10 * Math.sin(6 * a0), r1 = 100 + 10 * Math.sin(6 * a1);
    curves.push(lineToCubic(r0 * Math.cos(a0), r0 * Math.sin(a0), r1 * Math.cos(a1), r1 * Math.sin(a1)));
  }
  const t0 = process.hrtime.bigint();
  const out = offsetContour({ curves, closed: true }, 5, { join: 'round' });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 2000, `${ms.toFixed(0)}ms for a 60-curve ring`);
  assert.ok(out.length >= 1);
  assertChained(out, 'wavy ring');
});

// ── helpers used above, kept below the tests they serve ───────────────────────

function unit(x: number, y: number): Pt {
  const l = Math.hypot(x, y);
  return { x: x / l, y: y / l };
}

function reverse(c: Contour): Contour {
  return { closed: c.closed, curves: c.curves.map((k) => [k[6], k[7], k[4], k[5], k[2], k[3], k[0], k[1]] as Cubic).reverse() };
}

/** True nearest distance from each sample to the fitted chain - stricter than the
 *  parameter-based error the fitter minimises, and the one a caller can see. */
function worstFitError(pts: Pt[], fit: Cubic[]): number {
  let worst = 0;
  for (const p of pts) {
    let best = Infinity;
    for (const k of fit) best = Math.min(best, nearestOnCubic(k, p.x, p.y, 64).distance);
    worst = Math.max(worst, best);
  }
  return worst;
}

/** A 100×100 rounded rectangle: straight runs and real curves in one contour, which is
 *  where a corner between a line and a curve has to be joined without a gap. */
function roundedRect(r: number): Contour {
  const k = KAPPA * r;
  return { closed: true, curves: [
    lineToCubic(r, 0, 100 - r, 0),
    [100 - r, 0, 100 - r + k, 0, 100, r - k, 100, r],
    lineToCubic(100, r, 100, 100 - r),
    [100, 100 - r, 100, 100 - r + k, 100 - r + k, 100, 100 - r, 100],
    lineToCubic(100 - r, 100, r, 100),
    [r, 100, r - k, 100, 0, 100 - r + k, 0, 100 - r],
    lineToCubic(0, 100 - r, 0, r),
    [0, r, 0, r - k, r - k, 0, r, 0],
  ] };
}

// ── the outward offset that came back as confetti ─────────────────────────────

test('an outward offset of a five-times-self-crossing loop is one region, not fourteen', () => {
  // A closed contour that crosses itself repeatedly, grown outward far enough that every lobe
  // merges into a single blob. The self-union that resolves the sweep used to annihilate a
  // pair of weld-scale opposed slivers in it, break the walk at the vertex they linked, and
  // hand back fourteen contours enclosing a quarter of the right area - 1370 against 5579.
  //
  // The coordinates come from a randomised sweep and nothing about them is special except
  // that two boundary strands of the sweep land a weld radius apart, so rounding them moves
  // the case out from under the defect. Only the default mitred join reaches it; the same
  // input jointed round was always correct, which is why the oracle here is the round answer.
  const src: GeomPath = [{ closed: true, curves: [
    [5.3941, -49.5121, -1.3494, -32.0786, -30.6456, -57.4887, -52.4931, 20.7614],
    [-52.4931, 20.7614, 16.1985, 43.3485, 22.5823, -33.6112, 25.6171, 6.5897],
    [25.6171, 6.5897, 48.1933, -23.4278, -29.2288, 7.7406, -40.159, -42.6903],
    [-40.159, -42.6903, -53.4551, -11.9816, -15.6685, -55.4734, -19.2914, 42.2458],
    [-19.2914, 42.2458, 23.5786, -20.8941, -40.5981, -40.444, 5.3941, -49.5121],
  ] as Cubic[] }];
  // The round answer is the oracle. A mitre can only ever ADD to it, and only in the corners,
  // so the mitred answer is bracketed from both sides by the module's other join style, and a
  // quarter of the area cannot pass. The dense Minkowski oracle is deliberately NOT applied
  // here: it disagrees with the round answer on this input by about a unit along one strand,
  // before this fix and after it identically, which is a separate question about how far an
  // outward offset of a five-times self-crossing loop should reach.
  const round = offsetPath(src, 7, { join: 'round' });
  const out = offsetPath(src, 7);
  assertChained(out, 'self-crossing loop grown by 7');
  assert.equal(out.length, 1, `grown until every lobe merges is one region, got ${out.length}`);
  const a = Math.abs(pathArea(out)), ref = Math.abs(pathArea(round));
  assert.ok(a >= ref - 1e-6, `a mitred join cannot enclose less than a round one: ${a} < ${ref}`);
  assert.ok(a <= ref * 1.1, `mitres add corners, not area: ${a} against ${ref}`);
});
