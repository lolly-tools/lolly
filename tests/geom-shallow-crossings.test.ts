// SPDX-License-Identifier: MPL-2.0
/**
 * Shallow crossings between a shape and a near-copy of it.
 *
 * The first fix for the fuzz reproducer in tests/geom-coincident-repeats.test.ts stopped
 * the intersector's search on any stalled pair of pieces that were straight and within
 * the tolerance of each other. That was fast, but it also dropped real crossings where two
 * curves meet at a very small angle, and a boolean between a shape and a near-copy of it
 * then kept or dropped a whole arc: a third of a disc went missing. engine/src/geom/
 * intersect.ts now scans such a stretch for the places where one curve changes sides of
 * the other and reports one contact for it, plus the stretch's two ends when it is longer
 * than a thousandth of the pair's size. Nothing is moved: round 4 removed the two folds
 * that used to report a crossing at a vertex or at a touch beside it, and fixed the boolean
 * instead, which is where the pieces either side of such a sliver are decided. The cases
 * here come from the reviews of those changes.
 *
 * ## Oracles
 *
 * 1. **Membership.** A shape and a copy that differs from it by far less than the grid
 *    spacing fill the same grid points, except within a small margin of the boundary.
 *    Where two shapes meet along a shared edge, each grid point is in the result exactly
 *    when the region algebra says so. Membership is counted on outlines flattened to many
 *    chords, independently of the boolean module's own winding test.
 * 2. **Area.** The same statement for area, up to slivers far thinner than the margin.
 * 3. **Where the crossing is.** A copy rotated about a point on the curve crosses the
 *    original at that point and nowhere else nearby. A copy built as c1 + eps·p(t)·n,
 *    with p a cubic, crosses c1 where p changes sign and touches it at a double root.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import type { GeomPathResult, GeomResult } from '../packages/core/src/host-v1.ts';
import { type Cubic, evalCubic, nearestOnCubic } from '../engine/src/geom/bezier.ts';
import { CLIP_BUDGET, intersectCubics } from '../engine/src/geom/intersect.ts';

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
const num = (v: number) => String(+v.toPrecision(17));

/** Rotate every point of a path by `th` radians about (px, py), at full precision. */
function rotated(d: string, px: number, py: number, th: number): string {
  const co = Math.cos(th), si = Math.sin(th);
  const nums = d.match(/-?[\d.]+(?:e-?\d+)?/g)!.map(Number);
  const out: number[] = [];
  for (let i = 0; i < nums.length; i += 2) {
    const x = nums[i]! - px, y = nums[i + 1]! - py;
    out.push(+(px + co * x - si * y).toPrecision(17), +(py + si * x + co * y).toPrecision(17));
  }
  let k = 0;
  return d.replace(/-?[\d.]+(?:e-?\d+)?/g, () => String(out[k++]));
}

type Op = 'union' | 'intersect' | 'difference' | 'xor';
const OPS: Op[] = ['union', 'intersect', 'difference', 'xor'];

/**
 * Winding number, from each curve flattened to 600 chords and a crossing count. It is
 * deliberately not `windingNumber`: the oracle must not share code with what it checks.
 */
function winder(d: string): (x: number, y: number) => number {
  if (d === '') return () => 0;
  const polys = val(geom.parse(d), 'parse').map((c) => {
    const pts: number[] = [];
    for (const k of c.curves) {
      for (let i = 0; i < 600; i++) {
        const p = evalCubic([...k] as Cubic, i / 600);
        pts.push(p.x, p.y);
      }
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
    return w;
  };
}

/** Nonzero membership, from `winder`. */
function filler(d: string): (x: number, y: number) => boolean {
  const w = winder(d);
  return (x, y) => w(x, y) !== 0;
}

/** Distance to a path's outline, parsed once. */
function distanceTo(d: string): (x: number, y: number) => number {
  const curves = val(geom.parse(d), 'parse').flatMap((c) => c.curves.map((k) => [...k] as Cubic));
  return (x, y) => Math.min(...curves.map((k) => nearestOnCubic(k, x, y).distance));
}

/**
 * Check all four booleans of A and a near-copy B against A alone: membership on a grid,
 * skipping points within `margin` of A's outline, and area.
 */
function checkNearCopy(
  A: string, B: string, box: { x0: number; y0: number; x1: number; y1: number },
  margin: number, areaTol: number, opts?: typeof EXACT,
): void {
  const aArea = area(A);
  const inA = filler(A), fromA = distanceTo(A);
  const G = 30;
  const grid: { x: number; y: number; inside: boolean }[] = [];
  for (let i = 0; i <= G; i++) {
    for (let j = 0; j <= G; j++) {
      const x = box.x0 + ((i + 0.137) / G) * (box.x1 - box.x0);
      const y = box.y0 + ((j + 0.219) / G) * (box.y1 - box.y0);
      if (fromA(x, y) >= margin) grid.push({ x, y, inside: inA(x, y) });
    }
  }
  assert.ok(grid.length > 700 && grid.some((g) => g.inside), `grid too thin (${grid.length})`);
  for (const op of OPS) {
    const d = pathOf(geom[op]([A, B], opts), op);
    const got = area(d);
    const keeps = op === 'union' || op === 'intersect';
    assert.ok(Math.abs(got - (keeps ? aArea : 0)) <= areaTol, `${op}: area ${got}, expected ${keeps ? aArea : 0}`);
    const filled = filler(d);
    for (const { x, y, inside } of grid) {
      assert.equal(filled(x, y), keeps && inside, `${op} at (${x}, ${y}): inside A ${inside}`);
    }
  }
}

/** A region below the curve `lower` and a region above `upper`, down to y = -0.3·L and up
 *  to y = 0.5·L. When the two curves are near-copies the regions meet along them. */
function tiles(lower: number[], upper: number[], L: number): { A: string; B: string } {
  const edge = (c: number[]) => `M${num(c[0]!)} ${num(c[1]!)} C${c.slice(2).map(num).join(' ')}`;
  return {
    A: `${edge(lower)} L${num(lower[6]!)} ${num(-0.3 * L)} L${num(lower[0]!)} ${num(-0.3 * L)} Z`,
    B: `${edge(upper)} L${num(upper[6]!)} ${num(0.5 * L)} L${num(upper[0]!)} ${num(0.5 * L)} Z`,
  };
}

/**
 * Check the self-union of A and B together and all four booleans of A and B, where A and B
 * meet along a shared edge: membership on a grid, skipping points within 2e-3·L of either
 * outline, and area. The two regions overlap, or leave a gap, only in slivers far thinner
 * than that.
 */
function checkTiles(A: string, B: string, L: number, opts: { decimals?: number } = {}): void {
  const windA = winder(A), windB = winder(B);
  const fromA = distanceTo(A), fromB = distanceTo(B);
  const aA = area(A), aB = area(B);
  const grid: { x: number; y: number; wa: number; wb: number }[] = [];
  for (let i = 0; i <= 14; i++) {
    for (let j = 0; j <= 14; j++) {
      const x = L * (-0.05 + (i + 0.137) * 0.075), y = L * (-0.35 + (j + 0.219) * 0.062);
      if (Math.min(fromA(x, y), fromB(x, y)) < 2e-3 * L) continue;
      grid.push({ x, y, wa: windA(x, y), wb: windB(x, y) });
    }
  }
  assert.ok(grid.length > 180, `grid too thin (${grid.length})`);
  // The self-union fills the path made of both outlines by the nonzero rule, so a point is
  // in it where the two winding numbers do not cancel, not wherever it is in either region.
  // A and B run in opposite senses, so a point in both would be left out.
  type Rule = (wa: number, wb: number) => boolean;
  const cases: [string, string, Rule, number][] = [
    ['selfUnion', pathOf(geom.selfUnion(`${A} ${B}`, opts), 'selfUnion'), (wa, wb) => wa + wb !== 0, aA + aB],
    ...OPS.map((op): [string, string, Rule, number] => [
      op, pathOf(geom[op]([A, B], opts), op),
      op === 'union' ? (wa, wb) => wa !== 0 || wb !== 0 : op === 'intersect' ? (wa, wb) => wa !== 0 && wb !== 0
        : op === 'difference' ? (wa, wb) => wa !== 0 && wb === 0 : (wa, wb) => (wa !== 0) !== (wb !== 0),
      op === 'intersect' ? 0 : op === 'difference' ? aA : aA + aB,
    ]),
  ];
  for (const [op, d, rule, want] of cases) {
    const got = area(d);
    assert.ok(Math.abs(got - want) <= 2e-3 * (aA + aB), `${op}: area ${got}, expected ${want}`);
    const filled = filler(d);
    for (const { x, y, wa, wb } of grid) {
      assert.equal(filled(x, y), rule(wa, wb), `${op} at (${x}, ${y}): winding in A ${wa}, in B ${wb}`);
    }
  }
}

/** c1 moved along +y by eps·p(t), where p(t) = (t - a)²(t - t0): the copy touches c1 at
 *  t = a and crosses it at t = t0. */
function touchThenCross(c1: number[], a: number, t0: number, eps: number): number[] {
  const k2 = -(2 * a + t0), k1 = a * a + 2 * a * t0, k0 = -a * a * t0;
  const b = [k0, k0 + k1 / 3, k0 + (2 * k1) / 3 + k2 / 3, k0 + k1 + k2 + 1];
  return c1.map((v, i) => (i % 2 === 1 ? +(v + eps * b[(i - 1) / 2]!).toPrecision(17) : v));
}

test('a circle against its copy rounded to four decimals', () => {
  // Four decimals is the geom API's default output precision, so this is what a round
  // trip through that API gives back. The copy differs from the circle by less than
  // 1e-4 and crosses it at shallow angles. The first fix returned a difference of 224
  // square units, a third of the circle, here, and the search before it an intersection
  // of three contours with the centre left out.
  const A = 'M8.763796814719365 9.991846756633487 C0.8958102687134817 12.538172640149993 -7.546658034371864 8.224114293342437 -10.09298391788837 0.3561277473365534 C-12.639309801404876 -7.51185879866933 -8.32525145459732 -15.954327101754675 -0.4572649085914371 -18.50065298527118 C7.410721637414445 -21.046978868787686 15.85318994049979 -16.732920521980134 18.399515824016298 -8.864933975974251 C20.945841707532804 -0.9969474299683689 16.63178336072525 7.445520873116978 8.76379681471937 9.991846756633485 Z';
  const B = 'M8.7638 9.9918 C0.8958 12.5382 -7.5467 8.2241 -10.093 0.3561 C-12.6393 -7.5119 -8.3253 -15.9543 -0.4573 -18.5007 C7.4107 -21.047 15.8532 -16.7329 18.3995 -8.8649 C20.9458 -0.9969 16.6318 7.4455 8.7638 9.9918 Z';
  checkNearCopy(A, B, { x0: -12, y0: -20, x1: 20, y1: 12 }, 1e-3, 0.01);
  // The centre is the quickest sign of a lost arc.
  for (const op of OPS) {
    const d = pathOf(geom[op]([A, B]), op);
    assert.equal(filler(d)(4.15, -4.25), op === 'union' || op === 'intersect', `${op} at the centre`);
    if (op !== 'xor') assert.equal(val(geom.parse(d), 'parse').length, 1, `${op} is one contour`);
  }
});

/** Unit disc, four arcs. */
const DISC = 'M1 0 C1 0.5523 0.5523 1 0 1 C-0.5523 1 -1 0.5523 -1 0 C-1 -0.5523 -0.5523 -1 0 -1 C0.5523 -1 1 -0.5523 1 0 Z';
const K = 0.5523;
const FIRST_ARC: Cubic = [1, 0, 1, K, K, 1, 0, 1];

test('a disc against a copy rotated by a millionth of a radian about a point on its edge', () => overrunOnly(() => {
  // Under the shipped budget the clip search answers this pair.
  // The copy crosses the disc at the pivot, at an angle of 1e-6, and the two outlines
  // stay within a millionth of each other everywhere. The first fix returned a union of
  // three contours with the centre left empty.
  const P = evalCubic(FIRST_ARC, 0.56);
  const B = rotated(DISC, P.x, P.y, 1e-6);
  const arc2 = B.match(/-?[\d.]+(?:e-?\d+)?/g)!.slice(0, 8).map(Number) as unknown as Cubic;
  const hits = intersectCubics(FIRST_ARC, arc2);
  // The pivot, and the two ends of the stretch either side of it where the two arcs stay
  // within the tolerance of each other: at this angle that stretch is 0.0012 long.
  assert.equal(hits.length, 3, JSON.stringify(hits));
  assert.ok(Math.abs(hits[1]!.t1 - 0.56) < 1e-6 && Math.abs(hits[1]!.t2 - 0.56) < 1e-6, JSON.stringify(hits));
  for (const h of hits) {
    const p = evalCubic(FIRST_ARC, h.t1), q = evalCubic(arc2, h.t2);
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 1e-8, `a hit names two points: ${JSON.stringify(h)}`);
  }
  checkNearCopy(DISC, B, { x0: -1.1, y0: -1.1, x1: 1.1, y1: 1.1 }, 1e-4, 1e-5, EXACT);
  for (const op of ['union', 'intersect'] as const) {
    const d = pathOf(geom[op]([DISC, B], EXACT), op);
    assert.equal(val(geom.parse(d), 'parse').length, 1, `the ${op} is one contour`);
    for (const [x, y] of [[0, 0], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5], [0.5, -0.5], [0.9, 0.1], [0.1, 0.9]] as const) {
      assert.equal(val(geom.winding(d, x, y), 'winding'), 1, `${op} winding at (${x}, ${y})`);
    }
  }
}));

test('the intersector reports the pivot of a slightly rotated copy', () => overrunOnly(() => {
  // Under the shipped budget the clip search answers this pair.
  // Rotating a curve about a point on it gives a curve that crosses it there and runs
  // alongside it, within a hair, everywhere else. The crossing is real however small the
  // angle, and a boolean needs it. The first fix reported nothing for most of these, and
  // the search before it reported nothing for most of the larger curves.
  const curves: Record<string, Cubic> = {
    'unit arc': FIRST_ARC,
    'arc of radius 100': [100, 0, 100, 55.23, 55.23, 100, 0, 100],
    'S curve': [0, 0, 60, 0, 40, 100, 100, 100],
  };
  for (const [name, c1] of Object.entries(curves)) {
    for (const t0 of [0.13, 0.37, 0.56, 0.71]) {
      const P = evalCubic(c1, t0);
      for (const th of [1e-4, 1e-5, 1e-6, 3e-7]) {
        const d = rotated(`M${c1.slice(0, 2).join(' ')} C${c1.slice(2).join(' ')}`, P.x, P.y, th);
        const c2 = d.match(/-?[\d.]+(?:e-?\d+)?/g)!.map(Number) as unknown as Cubic;
        const what = `${name}, pivot at t=${t0}, angle ${th}`;
        const hits = intersectCubics(c1, c2).filter((h) => h.t1 > 1e-6 && h.t1 < 1 - 1e-6);
        // Every hit is a point the two curves share, to within ten times the tolerance.
        // A hit the clip search converged on takes its point from the middle of a piece
        // about `tol` long, so the point can sit that far from its parameter.
        for (const h of hits) {
          const p = evalCubic(c1, h.t1), q = evalCubic(c2, h.t2);
          assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 1e-8, `${what}: (${h.t1}, ${h.t2}) name different points`);
          assert.ok(Math.hypot(p.x - h.x, p.y - h.y) < 1e-8, `${what}: the point is not on the first curve`);
        }
        // The pivot is one of them. Its position along the curves is known only to the
        // rounding noise divided by the angle, so the bound loosens as the angle shrinks.
        const slack = Math.max(1e-7, 1e-12 / th);
        assert.ok(hits.some((h) => Math.abs(h.t1 - t0) < slack && Math.abs(h.t2 - t0) < slack),
          `${what}: no hit at the pivot in ${JSON.stringify(hits)}`);
        // Below about 1e-5 on the unit arc the curves stay within the tolerance of each
        // other for a thousandth of a unit either side of the pivot, and that stretch
        // reports its two ends as well as the pivot. Either way the pivot is the middle
        // answer, and there is no third possibility.
        assert.ok(hits.length === 1 || hits.length === 3, `${what}: ${JSON.stringify(hits)}`);
        if (hits.length === 3) {
          assert.ok(Math.abs(hits[1]!.t1 - t0) < slack, `${what}: the pivot is not between the ends`);
        }
        if (th >= 1e-5) assert.equal(hits.length, 1, `${what}: ${JSON.stringify(hits)}`);
      }
    }
  }
}));

test('two shapes sharing a curved edge whose far end was rounded to four decimals', () => {
  // The start vertex and first handle are exact, the far handle and vertex rounded. The
  // two edges cross 0.686 of the way along, inside a sliver no wider than 5e-6. Reporting
  // that crossing at the shared start instead, as the previous version of this fix did,
  // lost 35 percent of the self-union: both edges were then decided at their midpoints,
  // which lie on the wrong side of the crossing.
  const e1 = [0, 0, 38.68476271629333, -5.575015544891357, 67.65078037977219, 6.817111968994141, 104.65711593627928, -3.291616439819336];
  const e2 = [0, 0, 38.68476271629333, -5.575015544891357, 67.6508, 6.8171, 104.6571, -3.2916];
  const hits = intersectCubics(e1 as Cubic, e2 as Cubic).filter((h) => h.t1 > 0);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0]!.t1 - 0.686074) < 1e-5 && Math.abs(hits[0]!.t2 - 0.686074) < 1e-5, JSON.stringify(hits));
  const { A, B } = tiles(e1, e2, 100);
  checkTiles(A, B, 100);
  checkTiles(A, B, 100, EXACT);
});

test('a crossing after a second-order touch at a shared start is reported where it is', () => {
  // The copy agrees with the curve to second order at their shared start and crosses it
  // further on, with the two never more than a few millionths apart before the crossing
  // and parting beyond it. The previous version of this fix reported each of these at the
  // shared start and lost the region below the edge from the self-union.
  const flat = [0, 0, 100 / 3, 0.1, 200 / 3, 0.1, 100, 0];
  for (const t0 of [0.53, 0.6, 0.7]) {
    const c2 = touchThenCross(flat, 0, t0, 1e-4);
    const hits = intersectCubics(flat as Cubic, c2 as Cubic);
    assert.ok(hits.some((h) => Math.abs(h.t1 - t0) < 1e-6 && Math.abs(h.t2 - t0) < 1e-6),
      `t0 = ${t0}: ${JSON.stringify(hits)}`);
    const { A, B } = tiles(flat, c2, 100);
    checkTiles(A, B, 100, EXACT);
  }
  // The same with the touch at the shared far end, on a large arc.
  const arc = [0, 0, 300, 200, 700, 200, 1000, 0];
  const c2 = touchThenCross(arc, 1, 0.5, 1e-3);
  const hits = intersectCubics(arc as Cubic, c2 as Cubic);
  assert.ok(hits.some((h) => Math.abs(h.t1 - 0.5) < 1e-6 && Math.abs(h.t2 - 0.5) < 1e-6), JSON.stringify(hits));
  const { A, B } = tiles(arc, c2, 1000);
  checkTiles(A, B, 1000, EXACT);
});

test('a touch beside a crossing is reported, so no piece is decided on the touch', () => {
  // The copy touches the curve at t = 0.25 and crosses it at t = 0.5. With only the
  // crossing reported, the boolean cut both curves at 0.5 and decided the first halves at
  // their midpoints, t = 0.25, exactly on the touch: the self-union lost three eighths of
  // its area. The boolean's own contact search is not asked once a crossing has been found.
  const flat = [0, 0, 1 / 3, 0.001, 2 / 3, 0.001, 1, 0];
  const c2 = touchThenCross(flat, 0.25, 0.5, 1e-2);
  const hits = intersectCubics(flat as Cubic, c2 as Cubic);
  assert.ok(hits.some((h) => Math.abs(h.t1 - 0.25) < 1e-3 && Math.abs(h.t2 - 0.25) < 1e-3), `no touch: ${JSON.stringify(hits)}`);
  assert.ok(hits.some((h) => Math.abs(h.t1 - 0.5) < 1e-6 && Math.abs(h.t2 - 0.5) < 1e-6), `no crossing: ${JSON.stringify(hits)}`);
  for (const h of hits) {
    const p = evalCubic(flat as Cubic, h.t1), q = evalCubic(c2 as Cubic, h.t2);
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 1e-8, `(${h.t1}, ${h.t2}) name different points`);
  }
  const { A, B } = tiles(flat, c2, 1);
  checkTiles(A, B, 1, EXACT);
});

test('a shallow crossing on a bisection boundary is found', () => {
  // The two arcs touch at t = 0.25 and cross at exactly t = 0.5, where the search's first
  // bisection falls. A clip there cut one piece down to the single parameter 0.5, a point
  // with no direction to clip against, and the other piece was then only halved, one level
  // at a time, until the depth cap dropped the pair. The search before this change lost it
  // the same way.
  const c1: Cubic = [0, 0, 300, 200, 700, 200, 1000, 0];
  const c2: Cubic = [0, -0.003125, 300, 200.00729166666667, 700, 199.984375, 1000, 0.028125];
  for (const [a, b] of [[c1, c2], [c2, c1]] as const) {
    const hits = intersectCubics(a, b);
    assert.ok(hits.some((h) => Math.abs(h.t1 - 0.5) < 1e-7 && Math.abs(h.t2 - 0.5) < 1e-7), JSON.stringify(hits));
  }
});

test('a crossing that needs more halvings than the depth cap allows is found', () => {
  // Two edges 900 units long share their start and part slowly, crossing at t = 0.754
  // and again at t = 0.969, where they meet at 7e-6 rad. The search ran out of depth on
  // the second before its pieces were short enough to stop on, and the self-union then
  // came back with five contours and 3 percent too much area.
  const e1 = [0, 0, 255.85393905639648, -71.97589874267578, 847.323140501976, 90.13946056365967, 908.0758810043336, -47.45546281337738];
  const e2 = [0, 0, 255.85393905639648, -71.97589874267578, 847.3223696260452, 90.13983451277018, 908.0761807448865, -47.45579047131538];
  for (const [a, b] of [[e1, e2], [e2, e1]] as const) {
    const hits = intersectCubics(a as Cubic, b as Cubic).filter((h) => h.t1 > 0);
    assert.equal(hits.length, 2, JSON.stringify(hits));
    assert.ok(Math.abs(hits[0]!.t1 - 0.754209) < 1e-5 && Math.abs(hits[1]!.t1 - 0.969165) < 1e-5, JSON.stringify(hits));
  }
  const { A, B } = tiles(e1, e2, 1000);
  checkTiles(A, B, 1000);
});

test('a crossing in a sliver thinner than 1e-8 of the size, near a shared start, stays there', () => {
  // Two edges 957 units long share their start. They cross 0.14 of the way along, inside
  // a sliver 6e-7 wide, and again 0.42 of the way along, inside one 5e-6 wide, then part
  // by 5e-4. Reported where it is, the first crossing cut two pieces too close together for
  // the boolean to decide, and the self-union lost 38 percent of its area, so the fold used
  // to report it at the shared start. Both crossings now come back where they are, with the
  // shared start, and the boolean holds: it finds the pieces that trace each other, cuts
  // them at the same places, and decides each with its twin counted as a boundary through
  // the point it is decided at.
  const e1 = [0, 0, 202.1175265312195, -94.07041072845459, 836.6099316626787, -27.882742881774902, 957.5473070144653, 49.57953691482544];
  const e2 = [0, 0, 202.1175265312195, -94.07041072845459, 836.6105655709505, -27.882891497612, 957.5474218645096, 49.58025626468658];
  const hits = intersectCubics(e1 as Cubic, e2 as Cubic);
  assert.equal(hits.length, 3, JSON.stringify(hits));
  assert.deepEqual([hits[0]!.t1, hits[0]!.t2], [0, 0]);
  assert.ok(Math.abs(hits[1]!.t1 - 0.139859) < 1e-5 && Math.abs(hits[1]!.t2 - 0.139859) < 1e-5, JSON.stringify(hits));
  assert.ok(Math.abs(hits[2]!.t1 - 0.416528) < 1e-5 && Math.abs(hits[2]!.t2 - 0.416527) < 1e-5, JSON.stringify(hits));
  const { A, B } = tiles(e1, e2, 1000);
  checkTiles(A, B, 1000);
});

test('a crossing in a sliver that runs into two ends 1e-7 apart is reported where it is', () => overrunOnly(() => {
  // Under the shipped budget the clip search answers this pair.
  // Two pieces of the stroke outline of a closed curve and a copy shifted by 1e-7. They
  // cross properly twice, and a third time 0.07 units before their ends, after which the
  // sliver between them never opens wider than the 1e-7 between the ends. That third
  // crossing used to be reported at the two ends, because the boolean could not tell the
  // two sides of the sliver apart. It is now reported where it is, and the pieces it cuts
  // are decided alike because each is a twin of the other.
  const a: Cubic = [
    50.496138938356836, -0.8682431421244592, 38.189189554658114, -7.900785647095153,
    25.709197917793, -15.043137108516927, 13.92537979694464, -11.698035660320304,
  ];
  const b: Cubic = [
    53.13440592625311, 0.6357051834681838, 39.9529428395211, -6.842067673079992,
    26.541626989876086, -15.279440769306577, 13.925379896944643, -11.698035660320304,
  ];
  const hits = intersectCubics(a, b);
  assert.equal(hits.length, 3, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0]!.t1 - 0.1966843) < 1e-6 && Math.abs(hits[0]!.t2 - 0.2500077) < 1e-6, JSON.stringify(hits[0]));
  assert.ok(Math.abs(hits[1]!.t1 - 0.6138196) < 1e-6 && Math.abs(hits[1]!.t2 - 0.6393209) < 1e-6, JSON.stringify(hits[1]));
  assert.ok(Math.abs(hits[2]!.t1 - 0.9982534) < 1e-6 && Math.abs(hits[2]!.t2 - 0.9983687) < 1e-6, JSON.stringify(hits[2]));
  for (const h of hits) {
    const p = evalCubic(a, h.t1), q = evalCubic(b, h.t2);
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 1e-8, `a hit names two points: ${JSON.stringify(h)}`);
  }
}));

test('strokes of a closed curve repeated with tiny shifts cover what one copy covers', () => {
  // Each copy's stroke outline runs within a millionth of the others', with slivers
  // between them. Before this change the last two had 167 and 131 wrong points of about a
  // thousand. The crossings in those slivers are reported where they are, and what holds
  // the cover together is the boolean: two outlines of one shape cut at different places
  // trace each other, so their cuts are aligned and their pieces decided alike.
  const copy = (o: number) => `M${o} 0 C${30 + o} -40 ${70 + o} 40 ${100 + o} 0 C${70 + o} 60 ${30 + o} 60 ${o} 0 Z`;
  const centre = distanceTo(copy(0));
  for (const [n, shift, width] of [[3, 1e-7, 2], [5, 1e-7, 2], [10, 1e-8, 3], [5, 3e-7, 3]] as const) {
    const d = Array.from({ length: n }, (_, i) => copy(i * shift)).join(' ');
    const filled = filler(pathOf(geom.stroke(d, width), 'stroke'));
    const half = width / 2;
    let checked = 0;
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j <= 30; j++) {
        const x = -8 + i * (116 / 40) + 1.3e-7, y = -40 + j * 3 + 3.1e-7;
        // The two sharp corners, at (0, 0) and (100, 0), are left out: how a join fills
        // there is a question about joins, and one copy alone leaves points unpainted there.
        if (Math.hypot(x, y) < 4 * half + 0.05 || Math.hypot(x - 100, y) < 4 * half + 0.05) continue;
        const dist = centre(x, y);
        // Paint within half the width, none beyond the mitre limit (4 half widths).
        const want = dist < half - 0.05 ? true : dist > 4 * half + 0.05 ? false : null;
        if (want === null) continue;
        assert.equal(filled(x, y), want, `${n} copies ${shift} apart, width ${width}, at (${x}, ${y}), distance ${dist}`);
        checked++;
      }
    }
    assert.ok(checked > 800, `grid too thin: ${checked}`);
  }
});
