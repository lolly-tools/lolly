// SPDX-License-Identifier: MPL-2.0
/**
 * Near-copies of a curve: the cases the fifth round of the geometry kernel work fixed, each
 * pinned with the input that found it.
 *
 * 1. The cubic root solver isolates roots between the derivative's zeros instead of
 *    closing the form with Cardano. Cardano returned no root for a near-quadratic cubic
 *    (pinned in geom-cusps-and-twins) and, at a repeated root, a polished root a hundredth
 *    of the curve away from anything. Each root now carries the direction the cubic
 *    crosses zero in, which the ray cast reads instead of the tangent at the root: at the
 *    apex of a cusp the tangent is a rounding-sized vector pointing anywhere.
 * 2. A single contour whose first curve is a cusp used to be oriented by a probe at that
 *    curve's midpoint, the apex, where every line through the point touches the curve and
 *    the side test has nothing to count with. It is probed where the curve has a direction.
 * 3. A leaf the clip closes on at a nearly stationary point is handed to the scan rather
 *    than reported: two cusps touching at their apexes reported 129 points for that one
 *    contact, filled the hit cap, and the two real crossings further along were never
 *    searched.
 * 4. A curve against a near-copy of itself is decided from the polynomial of the offset
 *    where the pieces are regular (`twinNode`), not by cutting the pieces down until their
 *    fat lines part. Two loops a ten-millionth apart spent a million clip nodes and most of
 *    a second that way.
 * 5. `quadRoots01` in bezier.ts judges degeneracy against the coefficients and uses the
 *    cancellation-free formula: the bounding box of an arc symmetric to within rounding at
 *    coordinates near 3e4 was its chord, and a ray cast skipped the arc as out of reach.
 * 6. The boolean finds twins and duplicates through a spatial hash of each piece's start,
 *    midpoint and end. Two copies cut at parameters a millionth apart have their cut points
 *    together but their midpoints a hundred weld radii apart, and bucketed by midpoint alone
 *    the second copy survived as a contour of its own.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Cubic, boundsCubic, evalCubic, extremaCubic } from '../engine/src/geom/bezier.ts';
import { CLIP_BUDGET, cubicRoots01, intersectCubics, intersectLineCubic } from '../engine/src/geom/intersect.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';

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


const api = makeGeomApi();
const EXACT = { decimals: 12 } as const;
const areaOf = (d: string): number => (api.area(d) as { value: number }).value;
type Res = { ok: boolean; d: string; contours: number };
const run = (op: 'union' | 'intersect' | 'difference' | 'xor', a: string, b: string): Res =>
  (api as unknown as Record<string, (p: string[], o: unknown) => Res>)[op]!([a, b], EXACT);
const near = (a: number, b: number, eps: number, what: string) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const cpuMs = (f: () => void): number => { const c = process.cpuUsage(); f(); const u = process.cpuUsage(c); return (u.user + u.system) / 1000; };
/** How far apart the two curves are at a hit's two parameters. */
const onBoth = (c1: Cubic, c2: Cubic, h: { t1: number; t2: number }): number => {
  const p = evalCubic(c1, h.t1), q = evalCubic(c2, h.t2);
  return Math.hypot(p.x - q.x, p.y - q.y);
};
const curvesOf = (d: string): Cubic[] => (api.parse(d) as unknown as { value: { curves: Cubic[] }[] }).value[0]!.curves;

test('cubicRoots01 reports a repeated root once, with the direction the cubic crosses in', () => {
  // (t - 0.5)^2 (t - 0.394): a simple root rising through zero and a double root that touches.
  const dirs: number[] = [];
  const double = cubicRoots01(1, -1.394, 0.644, -0.0985, dirs);
  assert.equal(double.length, 2, JSON.stringify(double));
  near(double[0]!, 0.394, 1e-9, 'simple root');
  near(double[1]!, 0.5, 1e-7, 'double root');
  assert.deepEqual(dirs, [1, 0]);
  // (t - 0.5)^3: one root, a crossing, not the two of its critical points.
  const triple = cubicRoots01(1, -1.5, 0.75, -0.125, dirs);
  assert.deepEqual(triple.map((t) => +t.toFixed(9)), [0.5]);
  assert.deepEqual(dirs, [1]);
  // (t - 0.5)^3 - 1e-12: still one real root, a hundredth of a percent past 0.5.
  const nudged = cubicRoots01(1, -1.5, 0.75, -0.125 - 1e-12, dirs);
  assert.equal(nudged.length, 1, JSON.stringify(nudged));
  near(nudged[0]!, 0.5001, 1e-6, 'nudged triple root');
  assert.deepEqual(dirs, [1]);
});

test('a line through the apex of a cusp reads as one crossing or one touch, by direction', () => {
  const cusp: Cubic = [0, 0, 100, 100, 0, 100, 100, 0];
  // Vertical through the apex: the distance polynomial has a triple root, and the curve
  // does cross the line there.
  const vertical = intersectLineCubic(50, -10, 50, 200, cusp);
  assert.equal(vertical.length, 1, JSON.stringify(vertical));
  near(vertical[0]!.t2, 0.5, 1e-9, 'apex');
  assert.equal(Math.abs(vertical[0]!.dir!), 1);
  // Horizontal through the apex: a double root, the curve touches the line from below.
  const horizontal = intersectLineCubic(-10, 75, 200, 75, cusp);
  assert.equal(horizontal.length, 1, JSON.stringify(horizontal));
  assert.equal(horizontal[0]!.dir, 0);
  // Horizontal a hair below: two crossings, one each way.
  const below = intersectLineCubic(-10, 74.99, 200, 74.99, cusp);
  assert.deepEqual(below.map((h) => h.dir), [1, -1]);
});

test('a contour whose first curve is a cusp is oriented by a probe off the apex', () => {
  // The cusp is nudged by a billionth so its apex is a tight turn rather than an exact
  // cusp; the search before this returned an EMPTY self-union for it.
  const B = 'M-6e-10 -8.000000000000001e-10 C1.000000000592477 1.0000000007899694 -5.846212995001922e-10 0.999999999220505 1.0000000005764706 7.686274509803932e-10 L1 -0.5 L0 -0.5 Z';
  const A = 'M0 0 C1 1 0 1 1 0 L1 -0.3 L0 -0.3 Z';
  const self = api.selfUnion(B, EXACT) as Res;
  assert.equal(self.contours, 1);
  near(areaOf(self.d), 0.8, 1e-6, 'self-union of the nudged cusp shape');
  // A lies inside B, so the union is B whichever way round the operands come.
  for (const [p, q] of [[A, B], [B, A]] as const) {
    const u = run('union', p, q);
    assert.equal(u.contours, 1);
    near(areaOf(u.d), 0.8, 1e-6, 'union with the shape inside it');
  }
});

test('two cusps touching at their apexes and crossing twice further along, both orders', () => overrunOnly(() => {
  // Under the shipped budget the clip search answers this pair.
  // The nf-tips pair that lost a fifth of one operand: the apexes coincide to 1e-12, the
  // branches cross at t = 0.51 and t = 0.953, and the search before this reported 129
  // points at the apex and none of the crossings.
  const A = 'M328605.165023352 -9981.14395720078 C320097.7560427992 1315.9349766479925 318702.92106615123 -8586.308980552787 330000 -78.9 L332970.6731871602 -497.35049299439777 L331575.83821051224 -10399.594450195178 Z';
  const B = 'M329999.9205170459 -78.95397707828295 C318702.94864187 -8586.290253811343 320097.78253711725 1315.95296900742 328605.0822961957 -9981.200137425116 L316722.47227471106 -8307.34198522319 L318117.30725135905 1594.901971977591 Z';
  const cA = curvesOf(A)[0]!, cB = curvesOf(B)[0]!;
  for (const [c1, c2, name] of [[cA, cB, 'A x B'], [cB, cA, 'B x A']] as const) {
    const hits = intersectCubics(c1, c2);
    const t1s = hits.map((h) => h.t1).sort((p, q) => p - q);
    const want = name === 'A x B' ? [0.51, 0.9533472] : [0.0466507, 0.49];
    assert.equal(hits.length, 2, `${name}: ${JSON.stringify(hits)}`);
    for (let i = 0; i < 2; i++) near(t1s[i]!, want[i]!, 1e-6, `${name} crossing ${i}`);
    for (const h of hits) assert.ok(onBoth(c1, c2, h) <= 1e-8, `${name}: a hit is not on both curves`);
  }
  // Areas: A is 60,000,000, B 89,999,567, their overlap about 32, so the union is about
  // 149,999,535. Every operator agrees between the two operand orders.
  const expect = { union: [1, 149999534.7], intersect: [1, 32.15], difference: [1, 0], xor: [2, 149999502.55] } as const;
  for (const op of ['union', 'intersect', 'xor'] as const) {
    for (const [p, q] of [[A, B], [B, A]] as const) {
      const r = run(op, p, q);
      assert.equal(r.contours, expect[op][0], `${op}: contours`);
      near(areaOf(r.d), expect[op][1], 0.05, `${op} area`);
    }
  }
  near(areaOf(run('difference', A, B).d), 59999967.85, 0.05, 'A minus B');
  near(areaOf(run('difference', B, A).d), 89999534.7, 0.05, 'B minus A');
}));

test('a loop against a reversed near-copy is searched through the offset polynomial', () => {
  // loop L = 100 in the frame (0.9, 3700, -1100), against a copy offset by 1e-7 times
  // t (t - 0.001)^2 along +y, reversed. The clip alone spent about a million nodes here.
  const k1: Cubic = [3700, -1100, 3714.9088042778512, -920.3399667288111, 3590.5868106237185, -1077.0053486543077, 3762.1609968270664, -1021.6673090372517];
  const k2: Cubic = [3762.160996748734, -1021.6673089750907, 3590.586810623771, -1077.0053486543493, 3714.9088042778512, -920.3399667288111, 3700, -1100];
  let hits: ReturnType<typeof intersectCubics> = [];
  const ms = cpuMs(() => { hits = intersectCubics(k1, k2); });
  const what = JSON.stringify(hits.map((h) => [+h.t1.toFixed(7), +h.t2.toFixed(7)]));
  // The shared end, the two crossings of the loop's other branch, the crossing where the
  // tangent is parallel to the offset, and one contact with its run ends where it is
  // parallel on the way back.
  assert.equal(hits.length, 7, what);
  const t1s = hits.map((h) => h.t1);
  for (const t of [0, 0.1726732, 0.3103833, 0.688981, 0.8273268]) assert.ok(t1s.some((v) => Math.abs(v - t) < 1e-6), `missing ${t}: ${what}`);
  for (const h of hits) assert.ok(onBoth(k1, k2, h) <= 1e-8, `a hit is not on both curves: ${what}`);
  assert.ok(ms < 200, `${ms.toFixed(0)} ms`);
  // The reversed order answers the same contacts, and the pair is fast that way too.
  const rev = intersectCubics(k2, k1);
  assert.equal(rev.length, 7, JSON.stringify(rev));
});

test('two curves agreeing to high order at a shared vertex part quickly', () => {
  // Two of the 44 tangent pairs that took 0.5 to 2 seconds each in the clip alone.
  const pairs: [Cubic, Cubic][] = [
    [[0, 0, 30, 20, 70, 20, 100, 0], [0, 0, 30, 20, 70, 19.999999999666667, 100, 9.000000000000001e-9]],
    [[0, 0, 300, 200, 700, 200, 1000, 0], [0, 0, 300, 200, 700, 199.99999999666667, 1000, 9.000000000000001e-8]],
  ];
  for (const [c1, c2] of pairs) {
    let hits: ReturnType<typeof intersectCubics> = [];
    const ms = cpuMs(() => { hits = intersectCubics(c1, c2); });
    assert.deepEqual(hits.map((h) => [h.t1, h.t2]), [[0, 0]], JSON.stringify(hits));
    assert.ok(ms < 100, `${ms.toFixed(0)} ms`);
  }
});

test('the bounding box of an arc symmetric to within rounding reaches its apex', () => {
  // The derivative's leading coefficient is 1e-11 against terms of 4e4: solved as a
  // quadratic in the textbook form, the root at t = 0.5 cancelled to nothing and the box
  // was the chord. A boolean's ray cast then skipped the arc as out of reach.
  const arc: Cubic = [123.456, -78.9, 9423.456, 6121.1, 21823.456, 6121.1, 31123.456, -78.9];
  assert.deepEqual(extremaCubic(arc).map((t) => +t.toFixed(9)), [0.5]);
  near(boundsCubic(arc).y1, 4571.1, 1e-6, 'apex of the arc');
  // The shape under that arc against the shape above a copy of it offset by (t - 1)^2
  // (t - 0.1) times 0.031: their self-union is the whole band minus a hairline sliver, in
  // either order. Before the fix the region under the arc was deleted whole.
  const under = 'M123.456 -78.9 C9423.456 6121.1 21823.456 6121.1 31123.456 -78.9 L31123.456 -9378.9 L123.456 -9378.9 Z';
  const over = 'M123.456 -78.90310000000001 C9423.456 6121.1093 21823.456 6121.1 31123.456 -78.9 L31123.456 15421.1 L123.456 15421.1 Z';
  for (const d of [`${under} ${over}`, `${over} ${under}`]) {
    const r = api.selfUnion(d, EXACT) as Res;
    near(areaOf(r.d), 768799946, 200, 'the band');
  }
});

test('copies cut at parameters a millionth apart are deduplicated', () => {
  // cusp L = 100, horizontal offset (t - 0.5)(t - 0.51) at rel 1e-9, closed on the same
  // side: the two copies of the far branch were cut within the weld radius of each other
  // but at parameters a millionth apart, and one of them survived as a second contour.
  const dA = 'M3700 -1100 C3656.238876136414 -965.5196518512987 3610.8792639938565 -1054.6403878574422 3745.3596121425576 -1010.8792639938565 L3772.0958329444006 -1024.4871476366238 L3726.736220801843 -1113.6078836427673 Z';
  const dB = 'M3700.0000000453597 -1099.9999999108793 C3656.238876121887 -965.5196518798407 3610.8792639787366 -1054.6403878871492 3745.3596121861387 -1010.8792639082307 L3789.9199801456293 -1033.5590700651353 L3744.5603680030717 -1122.6798060712788 Z';
  const r = api.selfUnion(`${dA} ${dB}`, EXACT) as Res;
  assert.equal(r.contours, 1);
  near(areaOf(r.d), 8000, 1e-3, 'the self-union is the larger shape');
  // Three copies of one cusp shape, each nudged by less than the weld radius, at 3.3e5.
  const dS = 'M329999.91096215526 24999.003971788796 C330000.9960282264 24999.910962208392 330000.90699040063 24998.914933963017 329999.999999981 25000.000000034168 L329999.7011915074 25000.026711381903 L329999.61215368164 24999.030683136527 Z M329999.91096219816 24999.00397169873 C330000.9960282693 24999.910962118327 330000.90699044353 24998.91493387295 330000.0000000239 24999.999999944102 L329999.7011915503 25000.026711291837 L329999.61215372453 24999.03068304646 Z M329999.9109622131 24999.003971752347 C330000.99602828425 24999.910962171944 330000.9069904585 24998.914933926568 330000.0000000389 24999.99999999772 L329999.70119156525 25000.026711345454 L329999.6121537395 24999.030683100078 Z';
  const stack = api.selfUnion(dS, EXACT) as Res;
  assert.equal(stack.contours, 1, stack.d);
  near(areaOf(stack.d), 0.6000008, 1e-5, 'the stack is one copy');
});
