// SPDX-License-Identifier: MPL-2.0
/**
 * `host.geom` - the tool-facing geometry bridge (engine/src/geom-api.ts).
 *
 * ## What is under test, and against what
 *
 * The BRIDGE, not the kernel: the string↔`GeomPath` currency, the bounded parser, and
 * the returned-error contract. `geom-boolean.test.ts` / `geom-offset.test.ts` /
 * `geom-stroke.test.ts` already hold the kernel to its own oracles, so nothing here
 * re-checks a boolean's internals. What it checks is that a tool asking through
 * `host.geom` gets the same geometry the engine would compute, and that a tool feeding
 * it hostile input gets a clean refusal instead of a hang, a stack overflow, or a path
 * full of NaN.
 *
 * Four oracles, none of them the bridge itself:
 *
 * 1. **Analytic.** A stroked circle's outline area is Steiner's 2·P·(w/2) - exact for a
 *    convex closed curve, and independent of the π d² term that makes the outer and
 *    inner offsets individually awkward. An offset unit square is (s+2d)² for a miter
 *    join, s² + 4sd + πd² for round, s² + 4sd + 2d² for bevel. An arc's area is πr²/2.
 * 2. **The kernel, called directly.** Every boolean through the bridge is compared with
 *    `unionPath`/`intersectPath`/… on the path `parseSvgPath` produces - by area and by
 *    point membership over a grid, never by string equality, since the bridge rounds
 *    coordinates on the way out and a string comparison would be testing `toFixed`.
 * 3. **Local integration.** Areas are computed HERE, by 3-point Gauss-Legendre on
 *    ∮x dy (the integrand is degree 5 for a cubic and the rule is exact to degree 5, so
 *    it is a closed form, not a sample). `contourArea` is not used, so a wrong answer
 *    from path.ts cannot excuse a wrong answer from the bridge.
 * 4. **Hand-computed segments.** The S/T reflection rules and the quadratic degree
 *    elevation are written out per fixture, so a parser that silently dropped a
 *    reflection would fail rather than merely differ.
 *
 * Every path-producing assertion also runs `assertFinite`, which rejects a `d`
 * containing `NaN`/`Infinity` and re-parses the result to confirm every coordinate is a
 * usable number. That is the invariant the whole hostile-input section exists to
 * protect: a refusal is acceptable, a plausible-looking wrong path is not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import type { GeomContour, GeomPathResult, GeomResult } from '../packages/core/src/host-v1.ts';
import { parseSvgPath } from '../engine/src/svg-path.ts';
import { type Cubic, evalCubic, lengthCubic } from '../engine/src/geom/bezier.ts';
import { type GeomPath, pathFromSubPaths } from '../engine/src/geom/path.ts';
import {
  differencePath, intersectPath, pointInPath, unionPath, xorPath,
} from '../engine/src/geom/boolean.ts';

const geom = makeGeomApi();

// ── harness ───────────────────────────────────────────────────────────────────

const near = (a: number, b: number, eps: number, what = '') =>
  assert.ok(Math.abs(a - b) <= eps, `${what ? `${what}: ` : ''}${a} !== ${b} (within ${eps})`);

/** Unwrap a path result, asserting success and finiteness. */
function d(r: GeomPathResult, what = ''): string {
  assert.ok(r.ok, `${what}: expected ok, got ${r.ok ? '' : `${r.code} - ${r.message}`}`);
  assertFinite(r.d, what);
  return r.d;
}

function val<T>(r: GeomResult<T>, what = ''): T {
  assert.ok(r.ok, `${what}: expected ok, got ${r.ok ? '' : `${r.code} - ${r.message}`}`);
  return r.value;
}

/** A failure, with its code. */
function err(r: GeomPathResult | GeomResult<unknown>, what = ''): string {
  assert.ok(!r.ok, `${what}: expected a failure, got ok`);
  assert.equal(typeof r.message, 'string');
  assert.ok(r.message.length > 0, `${what}: failure carries no message`);
  return r.code;
}

/** No path may ever carry a non-finite coordinate - checked in the STRING (a template
 *  would render it verbatim) and again after re-parsing. */
function assertFinite(pathData: string, what = ''): void {
  assert.ok(!/NaN|Infinity|undefined/.test(pathData), `${what}: non-finite token in "${pathData.slice(0, 120)}"`);
  if (!pathData) return;
  const parsed = geom.parse(pathData);
  assert.ok(parsed.ok, `${what}: own output does not re-parse (${parsed.ok ? '' : parsed.message})`);
  for (const c of parsed.value) {
    for (const k of c.curves) {
      for (const n of k) assert.ok(Number.isFinite(n), `${what}: non-finite coordinate ${n}`);
    }
  }
}

/** Signed area by 3-point Gauss-Legendre on ∮x dy - exact for cubics, computed here
 *  rather than taken from the engine. */
const GL = [
  { t: 0.5 - Math.sqrt(3 / 5) / 2, w: 5 / 18 },
  { t: 0.5, w: 8 / 18 },
  { t: 0.5 + Math.sqrt(3 / 5) / 2, w: 5 / 18 },
];

function curveArea(k: readonly number[]): number {
  let sum = 0;
  for (const { t, w } of GL) {
    const mt = 1 - t;
    const x = mt ** 3 * k[0]! + 3 * mt * mt * t * k[2]! + 3 * mt * t * t * k[4]! + t ** 3 * k[6]!;
    const dy = 3 * mt * mt * (k[3]! - k[1]!) + 6 * mt * t * (k[5]! - k[3]!) + 3 * t * t * (k[7]! - k[5]!);
    sum += w * x * dy;
  }
  return sum;
}

function contourAreaLocal(c: GeomContour): number {
  let a = 0;
  for (const k of c.curves) a += curveArea(k);
  const first = c.curves[0], last = c.curves[c.curves.length - 1];
  if (first && last) {
    // The closing chord's own ∫x dy, whether or not it was stored as a curve.
    const sx = first[0]!, sy = first[1]!, ex = last[6]!, ey = last[7]!;
    a += ((ex + sx) / 2) * (sy - ey);
  }
  return a;
}

/** Area of a path-data string, via the bridge's parse but this file's integration. */
function areaOf(pathData: string): number {
  if (!pathData) return 0;
  const contours = val(geom.parse(pathData), 'areaOf/parse');
  let a = 0;
  for (const c of contours) a += contourAreaLocal(c);
  return a;
}

function areaOfKernel(p: GeomPath): number {
  let a = 0;
  for (const c of p) {
    a += contourAreaLocal({ curves: c.curves.map((k) => [...k]), closed: c.closed });
  }
  return a;
}

const kernel = (pathData: string): GeomPath => pathFromSubPaths(parseSvgPath(pathData));

function sampleContours(contours: GeomContour[]): number[] {
  const out: number[] = [];
  for (const c of contours) {
    for (const k of c.curves) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const p = evalCubic(k as unknown as Cubic, t);
        out.push(p.x, p.y);
      }
    }
    out.push(c.closed ? 1 : 0);
  }
  return out;
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const SQUARE = 'M0 0 L100 0 L100 100 L0 100 Z';
/** The same square shifted, overlapping SQUARE over a 50×50 corner. */
const SQUARE_B = 'M50 50 L150 50 L150 150 L50 150 Z';
/** A circle of r as four cubics - the k = 4/3·(√2−1) approximation. */
const K = (4 / 3) * (Math.SQRT2 - 1);
function circlePath(r: number, cx = 0, cy = 0, dp = 9): string {
  const k = K * r;
  const p = (x: number, y: number): string => `${(cx + x).toFixed(dp)} ${(cy + y).toFixed(dp)}`;
  return [
    `M${p(r, 0)}`,
    `C${p(r, k)} ${p(k, r)} ${p(0, r)}`,
    `C${p(-k, r)} ${p(-r, k)} ${p(-r, 0)}`,
    `C${p(-r, -k)} ${p(-k, -r)} ${p(0, -r)}`,
    `C${p(k, -r)} ${p(r, -k)} ${p(r, 0)}`,
    'Z',
  ].join('');
}

// ── 1. round trip ─────────────────────────────────────────────────────────────

test('parse → toPathData → parse is geometrically identical', () => {
  const fixtures = [
    SQUARE,
    circlePath(37.5, 12, -8),
    'M10 10 h20 v20 H0 V0 Z',
    'm5 5 l10 0 l0 10 z m20 0 l10 0 l0 10 z',
    'M0 0 C10 0 20 10 20 20 S30 40 40 40',
    'M0 0 Q10 0 10 10 T20 20 T30 10',
    'M0 0 A50 50 0 0 1 100 0 A50 50 0 1 0 0 0 Z',
    'M0 0 L10 0 10 10 0 10 Z',
  ];
  for (const fx of fixtures) {
    const first = val(geom.parse(fx), fx);
    const round = d(geom.toPathData(first, { decimals: 12 }), fx);
    const again = val(geom.parse(round), fx);
    const a = sampleContours(first), b = sampleContours(again);
    assert.equal(a.length, b.length, `${fx}: contour/curve shape changed`);
    for (let i = 0; i < a.length; i++) near(a[i]!, b[i]!, 1e-9, `${fx} sample ${i}`);
    near(areaOf(fx), areaOf(round), 1e-9, `${fx} area`);
  }
});

test('toPathData writes straight pieces as L and honours `decimals`', () => {
  const r = geom.toPathData(val(geom.parse(SQUARE)), { decimals: 2 });
  const out = d(r, 'square');
  assert.ok(out.includes('L'), 'a straight edge should be an L, not a cubic');
  assert.ok(!/\d\.\d{3}/.test(out), `decimals:2 should not print 3 decimals: ${out}`);
  assert.equal(r.ok && r.contours, 1);
  // Three stored curves, not four: a `Z`'s closing edge is implicit in the model and
  // is re-emitted as the `Z`, never as a fourth line.
  assert.equal(r.ok && r.curves, 3);
});

// ── 2. every SVG command ──────────────────────────────────────────────────────

test('H/V, relative forms and implicit repeats agree with the explicit path', () => {
  const explicit = 'M10 10 L30 10 L30 30 L10 30 Z';
  for (const variant of [
    'M10 10 H30 V30 H10 Z',
    'm10 10 h20 v20 h-20 z',
    'M10 10 30 10 30 30 10 30 Z',              // implicit L after M
    'M10 10 L30 10 30 30 10 30 Z',             // implicit repeat of L
  ]) {
    near(areaOf(variant), areaOf(explicit), 1e-9, variant);
    const box = val(geom.bounds(variant), variant)!;
    assert.deepEqual(box, { x0: 10, y0: 10, x1: 30, y1: 30 }, variant);
  }
});

test('S reflects the previous cubic control, and collapses to the current point otherwise', () => {
  // After "C10 0 20 10 20 20": current (20,20), last control (20,10) → reflection (20,30).
  const after = val(geom.parse('M0 0 C10 0 20 10 20 20 S30 40 40 40'), 'S after C');
  assert.equal(after[0]!.curves.length, 2);
  assert.deepEqual(after[0]!.curves[1], [20, 20, 20, 30, 30, 40, 40, 40]);
  // After an L there is nothing to reflect: the first control IS the current point.
  const plain = val(geom.parse('M0 0 L10 10 S20 30 30 30'), 'S after L');
  assert.deepEqual(plain[0]!.curves[1], [10, 10, 10, 10, 20, 30, 30, 30]);
  // An implicit repeat reflects the S itself, not the original C.
  const chained = val(geom.parse('M0 0 C10 0 20 10 20 20 S30 40 40 40 50 50 60 40'), 'S repeat');
  assert.equal(chained[0]!.curves.length, 3);
  assert.deepEqual(chained[0]!.curves[2], [40, 40, 50, 40, 50, 50, 60, 40]);
});

test('Q raises exactly to a cubic and T reflects the quadratic control', () => {
  // Degree elevation: c1 = p0 + ⅔(q − p0), c2 = p1 + ⅔(q − p1).
  const q = val(geom.parse('M0 0 Q30 60 60 0'), 'Q');
  for (const [i, want] of [[0, 0], [1, 0], [2, 20], [3, 40], [4, 40], [5, 40], [6, 60], [7, 0]] as const) {
    near(q[0]!.curves[0]![i]!, want, 1e-12, `Q control ${i}`);
  }
  // After "Q10 0 10 10": current (10,10), quad control (10,0) → reflection (10,20).
  const t = val(geom.parse('M0 0 Q10 0 10 10 T20 20'), 'T');
  const seg = t[0]!.curves[1]!;
  const expect = [10, 10, 10 + (2 / 3) * 0, 10 + (2 / 3) * 10, 20 + (2 / 3) * (10 - 20), 20, 20, 20];
  for (let i = 0; i < 8; i++) near(seg[i]!, expect[i]!, 1e-12, `T control ${i}`);
  // T with no preceding quadratic is a straight-ish cubic through the current point.
  // A T with nothing to reflect uses the CURRENT point as the quadratic control, which
  // is a straight line - unevenly parameterised (controls at 0 and ⅓), which is
  // geometry and not an artefact, so it is asserted as written rather than tidied.
  const lone = val(geom.parse('M0 0 L10 0 T20 0'), 'lone T');
  const loneSeg = lone[0]!.curves[1]!;
  for (const [i, want] of [[0, 10], [1, 0], [2, 10], [3, 0], [4, 40 / 3], [5, 0], [6, 20], [7, 0]] as const) {
    near(loneSeg[i]!, want, 1e-12, `lone T control ${i}`);
  }
});

test('A arcs: semicircle and full-circle areas match πr²', () => {
  // Magnitudes, and a tolerance that admits the cubic decomposition's own excess: a
  // 90°-per-cubic arc encloses ~2.8e-4 more than the true circle does, which is the
  // fixture being an approximation and not the bridge being wrong.
  near(Math.abs(areaOf('M0 0 A50 50 0 0 1 100 0 Z')), (Math.PI * 2500) / 2, 2, 'semicircle');
  near(
    Math.abs(areaOf('M100 0 A100 100 0 0 1 -100 0 A100 100 0 0 1 100 0 Z')),
    Math.PI * 10000, 10, 'full circle from two arcs',
  );
});

test('A arcs: every large-arc/sweep flag combination is distinct and correctly ordered', () => {
  const areas = new Map<string, number>();
  for (const la of [0, 1]) {
    for (const sw of [0, 1]) {
      const key = `${la}${sw}`;
      const path = `M0 0 A60 60 0 ${la} ${sw} 100 0 Z`;
      const a = areaOf(path);
      areas.set(key, a);
      // The endpoint is reached exactly, whatever the flags.
      const contours = val(geom.parse(path), key);
      const last = contours[0]!.curves[contours[0]!.curves.length - 1]!;
      near(last[6]!, 100, 1e-9, `${key} end x`);
      near(last[7]!, 0, 1e-9, `${key} end y`);
    }
  }
  // The sweep flag chooses the direction, which flips the sign of the enclosed area.
  assert.ok(areas.get('00')! * areas.get('01')! < 0, 'sweep should flip orientation');
  assert.ok(areas.get('10')! * areas.get('11')! < 0, 'sweep should flip orientation');
  // The large-arc flag chooses the bigger of the two arcs, which encloses more.
  assert.ok(Math.abs(areas.get('10')!) > Math.abs(areas.get('00')!), 'large arc should enclose more');
  assert.ok(Math.abs(areas.get('11')!) > Math.abs(areas.get('01')!), 'large arc should enclose more');
  // Small + large arc over the same chord = the whole ellipse.
  near(
    Math.abs(areas.get('01')!) + Math.abs(areas.get('11')!),
    Math.PI * 3600, 5, 'small + large = full disc',
  );
});

test('A arcs: the spec\'s degenerate cases (zero radius, equal endpoints, undersized radii)', () => {
  // Zero radius is a straight line (SVG 1.1 F.6.2).
  const zero = val(geom.parse('M0 0 A0 0 0 0 1 10 10'), 'zero radius');
  assert.equal(zero[0]!.curves.length, 1);
  const line = zero[0]!.curves[0]!;
  near(line[6]!, 10, 1e-12); near(line[7]!, 10, 1e-12);
  for (let i = 0; i < 8; i++) assert.ok(Number.isFinite(line[i]!));
  // Coincident endpoints: the arc is omitted entirely, and the rest of the path lives.
  const coincident = val(geom.parse('M0 0 A50 50 0 1 1 0 0 L10 0'), 'coincident endpoints');
  assert.equal(coincident.length, 1);
  assert.equal(coincident[0]!.curves.length, 1, 'only the L should survive');
  near(coincident[0]!.curves[0]![6]!, 10, 1e-12);
  // Radii too small for the chord are scaled up until they fit (F.6.6), giving a
  // semicircle of radius 50 rather than a NaN.
  const scaled = 'M0 0 A1 1 0 0 1 100 0 Z';
  near(Math.abs(areaOf(scaled)), (Math.PI * 2500) / 2, 2, 'undersized radii scaled up');
  const box = val(geom.bounds(scaled), scaled)!;
  near(box.x0, 0, 1e-6); near(box.x1, 100, 1e-6);
  near(Math.max(Math.abs(box.y0), Math.abs(box.y1)), 50, 0.05);
});

test('Z followed by more commands starts a new contour from the closed subpath\'s start', () => {
  const r = geom.parse('M10 10 h10 v10 Z m20 0 h10 v10 Z');
  const contours = val(r, 'two closed contours');
  assert.equal(contours.length, 2);
  assert.ok(contours.every((c) => c.closed));
  // The relative `m` is offset from the SUBPATH START (10,10), not from the last point.
  const box = val(geom.bounds('M10 10 h10 v10 Z m20 0 h10 v10 Z'))!;
  assert.deepEqual(box, { x0: 10, y0: 10, x1: 40, y1: 20 });
  // An absolute command after Z works the same way.
  const abs = val(geom.parse('M0 0 h10 v10 Z M50 50 h10 v10 Z'));
  assert.equal(abs.length, 2);
  near(abs[1]!.curves[0]![0]!, 50, 1e-12);
});

test('an empty or whitespace-only `d` is an empty path, not an error', () => {
  for (const empty of ['', '   ', '\n\t ']) {
    const r = geom.parse(empty);
    assert.deepEqual(val(r, JSON.stringify(empty)), []);
    const b = geom.bounds(empty);
    assert.equal(val(b), null);
    near(val(geom.area(empty)), 0, 0);
  }
});

// ── 3. booleans agree with the kernel ─────────────────────────────────────────

/** Membership agreement over a grid: the bridge's own `contains` against `pointInPath`
 *  on the kernel's result. Coordinates near an edge are skipped - the two paths differ
 *  by the bridge's coordinate rounding there, which is not a disagreement about the
 *  region. */
function membershipAgrees(bridgeD: string, kernelResult: GeomPath, box: { x0: number; y0: number; x1: number; y1: number }, what: string): void {
  const step = (box.x1 - box.x0) / 12;
  let checked = 0;
  for (let x = box.x0 - step; x <= box.x1 + step; x += step) {
    for (let y = box.y0 - step; y <= box.y1 + step; y += step) {
      const px = x + step * 0.137, py = y + step * 0.219;   // off-grid, off-vertex
      const mine = val(geom.contains(bridgeD, px, py), what);
      const theirs = bridgeD === '' ? false : pointInPath(kernelResult, px, py, 'nonzero');
      assert.equal(mine, theirs, `${what}: membership differs at (${px}, ${py})`);
      checked++;
    }
  }
  assert.ok(checked > 100, `${what}: grid too small (${checked})`);
}

test('union / intersect / difference / xor match the kernel called directly', () => {
  const ops = [
    ['union', (a: GeomPath, b: GeomPath) => unionPath(a, b), (p: string[]) => geom.union(p, { decimals: 12 })],
    ['intersect', (a: GeomPath, b: GeomPath) => intersectPath(a, b), (p: string[]) => geom.intersect(p, { decimals: 12 })],
    ['difference', (a: GeomPath, b: GeomPath) => differencePath(a, b), (p: string[]) => geom.difference(p, { decimals: 12 })],
    ['xor', (a: GeomPath, b: GeomPath) => xorPath(a, b), (p: string[]) => geom.xor(p, { decimals: 12 })],
  ] as const;
  const pairs: [string, string][] = [
    [SQUARE, SQUARE_B],
    [SQUARE, circlePath(60, 100, 100)],
    [circlePath(50), circlePath(50, 40)],
  ];
  for (const [name, kernelOp, bridgeOp] of ops) {
    for (const [A, B] of pairs) {
      const what = `${name}(${A.slice(0, 12)}…, ${B.slice(0, 12)}…)`;
      const expect = kernelOp(kernel(A), kernel(B));
      const got = d(bridgeOp([A, B]), what);
      near(areaOfKernel(expect), areaOf(got), 1e-6, `${what} area`);
      membershipAgrees(got, expect, { x0: -80, y0: -80, x1: 160, y1: 160 }, what);
    }
  }
});

test('the fill rule reaches the kernel: two same-wound nested squares', () => {
  const nested = `${SQUARE}M25 25 L75 25 L75 75 L25 75 Z`;
  const nonzero = d(geom.selfUnion(nested, { fillRule: 'nonzero' }), 'nonzero');
  const evenodd = d(geom.selfUnion(nested, { fillRule: 'evenodd' }), 'evenodd');
  near(Math.abs(areaOf(nonzero)), 10000, 1e-6, 'nonzero swallows the inner square');
  near(Math.abs(areaOf(evenodd)), 10000 - 2500, 1e-6, 'evenodd punches a hole');
  // `contains` reads the same rule on the raw path.
  assert.equal(val(geom.contains(nested, 50, 50, { fillRule: 'nonzero' })), true);
  assert.equal(val(geom.contains(nested, 50, 50, { fillRule: 'evenodd' })), false);
  assert.equal(val(geom.winding(nested, 50, 50)), 2);
  assert.equal(val(geom.winding(nested, -5, -5)), 0);
});

test('booleans fold over a whole selection, and one operand folds to its canonical form', () => {
  const a = 'M0 0 L100 0 L100 100 L0 100 Z';
  const b = 'M80 0 L180 0 L180 100 L80 100 Z';
  const c = 'M160 0 L260 0 L260 100 L160 100 Z';
  // Three overlapping bars: 3×100×100 minus two 20×100 overlaps.
  near(Math.abs(areaOf(d(geom.union([a, b, c]), 'union3'))), 30000 - 2 * 2000, 1e-6);
  // Intersection folds left to right, and a and c do not touch.
  assert.equal(d(geom.intersect([a, b, c]), 'intersect3'), '');
  // a − b − c
  near(Math.abs(areaOf(d(geom.difference([a, b, c]), 'diff3'))), 10000 - 2000, 1e-6);
  // A single operand is its own canonical form under every operator.
  const self = `${a}M50 50 L150 50 L150 150 L50 150 Z`;
  const expect = Math.abs(areaOf(d(geom.selfUnion(self), 'selfUnion')));
  for (const op of [geom.union, geom.intersect, geom.difference, geom.xor]) {
    near(Math.abs(areaOf(d(op([self]), 'single operand'))), expect, 1e-6);
  }
});

test('a legitimately empty result is ok, not a failure', () => {
  const far = 'M500 500 L600 500 L600 600 L500 600 Z';
  const r = geom.intersect([SQUARE, far]);
  assert.ok(r.ok);
  assert.equal(r.d, '');
  assert.equal(r.contours, 0);
  assert.equal(r.curves, 0);
});

// ── 4. the bounded-work path surfaces as `limit` ──────────────────────────────

/** A closed polygon of `n` edges around a circle of radius `r` - well-formed geometry,
 *  deliberately past the kernel's 8000-curve pairwise ceiling. */
function manyEdgePolygon(n: number, r: number): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(`${i === 0 ? 'M' : 'L'}${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`);
  }
  return `${parts.join('')}Z`;
}

test('an intersection past the kernel\'s ceiling reports `limit`, distinctly from an empty answer', () => {
  const big = manyEdgePolygon(8600, 200);
  const overlapping = 'M-50 -50 L50 -50 L50 50 L-50 50 Z';
  const started = Date.now();
  const r = geom.intersect([big, overlapping]);
  assert.ok(Date.now() - started < 20_000, 'the refusal must be prompt');
  assert.equal(err(r, 'over-ceiling intersection'), 'limit');
  assert.ok(!r.ok && /bounded work/.test(r.message), `message should name the cause: ${!r.ok && r.message}`);
  // The distinction the code exists to keep: a `limit` is NOT an empty answer.
  const empty = geom.intersect([SQUARE, 'M900 900 L950 900 L950 950 L900 950 Z']);
  assert.ok(empty.ok && empty.d === '');
  // Union has an exact way out at the ceiling and takes it, so it still answers.
  const u = geom.union([big, overlapping]);
  assert.ok(u.ok || u.code === 'limit', 'union must answer or refuse, never mislead');
  if (u.ok) assertFinite(u.d, 'over-ceiling union');
});

// ── 5. hostile input ──────────────────────────────────────────────────────────

test('malformed path data is rejected with `invalid-path`, never guessed at', () => {
  const cases: [string, string][] = [
    ['L10 10', 'no leading moveto'],
    ['M0 0 G5 5', 'unknown command'],
    ['M0 0 L1e', 'unterminated exponent'],
    ['M0 0 L1,', 'trailing separator, missing argument'],
    ['M0 0 Q1 2 3', 'short argument group'],
    ['M0 0 C1 2 3 4 5', 'short cubic group'],
    ['M0 0 A50 50 0 1 1 100', 'short arc group (missing y)'],
    ['M0 0 A50 50 0 2 1 100 0', 'a large-arc flag that is not 0 or 1'],
    ['M0 0 L', 'command with no arguments'],
    ['M0 0 L NaN NaN', 'literal NaN'],
    ['M0 0 L Infinity 5', 'literal Infinity'],
    ['M0 0 L1e999 5', 'overflowing exponent'],
    ['M0 0 L1e10 5', 'coordinate past the magnitude ceiling'],
    ['M0 0 L. 5', 'a lone decimal point'],
    ['M0 0 L--3 5', 'double sign'],
    ['M0 0 L5 5 <script>alert(1)</script>', 'markup smuggled into path data'],
    ['M0 0 L5 5 \u0000\u0001', 'control bytes'],
    ['M0,0L5,5{}', 'trailing garbage'],
    ['\u0000M0 0 L5 5', 'leading control byte'],
  ];
  for (const [bad, why] of cases) {
    assert.equal(err(geom.parse(bad), why), 'invalid-path', why);
    // Every entry point refuses identically - no method has its own softer parser.
    assert.equal(err(geom.bounds(bad), why), 'invalid-path', `${why} via bounds`);
    assert.equal(err(geom.offset(bad, 5), why), 'invalid-path', `${why} via offset`);
    assert.equal(err(geom.stroke(bad, 5), why), 'invalid-path', `${why} via stroke`);
    assert.equal(err(geom.union([SQUARE, bad]), why), 'invalid-path', `${why} via union`);
  }
});

test('oversized input is refused as `too-large`, promptly and without recursion', () => {
  const cases: [string, string][] = [
    ['M0 0 ' + 'L1 1 '.repeat(100_000), '100k commands'],
    ['M0 0' + 'Z'.repeat(60_000), '60k closepaths'],
    ['M0 0' + ' A1 1 0 0 1 2 0'.repeat(5_000), '5k arcs (4 cubics each)'],
    ['M0 0 L' + '1 1 '.repeat(60_000), 'one command, 60k implicit repeats'],
    ['M' + 'x'.repeat(600_000), 'over the character ceiling'],
    ['M0 0 L5 5' + ' '.repeat(600_000), 'padded past the character ceiling'],
  ];
  for (const [big, why] of cases) {
    const started = Date.now();
    const r = geom.parse(big);
    const ms = Date.now() - started;
    assert.ok(!r.ok, `${why}: expected a refusal`);
    assert.ok(['too-large', 'invalid-path'].includes(r.code), `${why}: unexpected code ${r.code}`);
    assert.ok(ms < 5_000, `${why}: took ${ms}ms - a refusal must be prompt`);
  }
  const limits = geom.limits();
  for (const [k, v] of Object.entries(limits)) {
    assert.ok(typeof v === 'number' && Number.isFinite(v) && v > 0, `limits.${k} = ${v}`);
  }
  assert.ok(limits.maxChars >= 100_000 && limits.maxCommands >= 5_000, 'the ceilings must fit real paths');
});

test('a well-formed path just under the ceilings still works, and its output is finite', () => {
  const n = 2000;
  const poly = manyEdgePolygon(n, 500);
  const r = geom.parse(poly);
  assert.equal(val(r, 'large polygon').length, 1);
  assert.equal(r.ok && r.value[0]!.curves.length, n - 1, 'the closing edge stays implicit');
  near(Math.abs(areaOf(poly)), 0.5 * n * 500 * 500 * Math.sin((2 * Math.PI) / n), 1);
  assertFinite(d(geom.selfUnion(poly), 'large polygon selfUnion'), 'large polygon');
});

test('non-string and non-numeric arguments are `invalid-argument`', () => {
  for (const junk of [null, undefined, 42, {}, [], true, Symbol.iterator] as unknown[]) {
    assert.equal(err(geom.parse(junk as string), String(String(junk))), 'invalid-argument');
  }
  assert.equal(err(geom.union('not an array' as unknown as string[])), 'invalid-argument');
  assert.equal(err(geom.union([])), 'invalid-argument');
  assert.equal(err(geom.union(Array.from({ length: 200 }, () => SQUARE))), 'too-large');
  for (const bad of [NaN, Infinity, -Infinity, '5' as unknown as number, undefined as unknown as number]) {
    assert.equal(err(geom.offset(SQUARE, bad), `offset ${String(bad)}`), 'invalid-argument');
    assert.equal(err(geom.stroke(SQUARE, bad), `stroke ${String(bad)}`), 'invalid-argument');
  }
  assert.equal(err(geom.stroke(SQUARE, 0)), 'invalid-argument', 'a zero-width stroke paints nothing');
  assert.equal(err(geom.stroke(SQUARE, -5)), 'invalid-argument');
  assert.equal(err(geom.offset(SQUARE, 5, { join: 'bogus' as 'miter' })), 'invalid-argument');
  assert.equal(err(geom.stroke(SQUARE, 5, { cap: 'bogus' as 'butt' })), 'invalid-argument');
  assert.equal(err(geom.selfUnion(SQUARE, { fillRule: 'bogus' as 'nonzero' })), 'invalid-argument');
  assert.equal(err(geom.simplify(SQUARE, { tolerance: -1 })), 'invalid-argument');
  assert.equal(err(geom.simplify(SQUARE, { tolerance: NaN })), 'invalid-argument');
  for (const [x, y] of [[NaN, 0], [0, Infinity], [1e12, 0]]) {
    assert.equal(err(geom.contains(SQUARE, x!, y!)), 'invalid-argument');
    assert.equal(err(geom.winding(SQUARE, x!, y!)), 'invalid-argument');
    assert.equal(err(geom.nearest(SQUARE, x!, y!)), 'invalid-argument');
  }
});

test('toPathData refuses malformed structured input', () => {
  assert.equal(err(geom.toPathData('nope' as unknown as GeomContour[])), 'invalid-argument');
  assert.equal(err(geom.toPathData([{ closed: true } as unknown as GeomContour])), 'invalid-argument');
  assert.equal(err(geom.toPathData([{ curves: [[0, 0, 1, 1, 2, 2]], closed: true }])), 'invalid-argument');
  assert.equal(err(geom.toPathData([{ curves: [[0, 0, 1, 1, 2, 2, NaN, 3]], closed: true }])), 'invalid-argument');
  assert.equal(err(geom.toPathData([{ curves: [[0, 0, 1, 1, 2, 2, 1e12, 3]], closed: true }])), 'invalid-argument');
  assert.equal(
    err(geom.toPathData([{ curves: Array.from({ length: 20_000 }, () => [0, 0, 1, 1, 2, 2, 3, 3]), closed: true }])),
    'too-large',
  );
  // A valid structured path still round-trips.
  assert.equal(d(geom.toPathData([{ curves: [[0, 0, 1, 0, 2, 0, 3, 0]], closed: false }])), 'M0 0L3 0');
});

// ── 6. offset and stroke against the analytic answer ─────────────────────────

test('offsetting a square matches the closed form for each join style', () => {
  const s = 100, dist = 10;
  const square = `M0 0 L${s} 0 L${s} ${s} L0 ${s} Z`;
  const expected = {
    miter: (s + 2 * dist) ** 2,
    round: s * s + 4 * s * dist + Math.PI * dist * dist,
    bevel: s * s + 4 * s * dist + 2 * dist * dist,
  } as const;
  for (const join of ['miter', 'round', 'bevel'] as const) {
    const out = d(geom.offset(square, dist, { join, tolerance: 1e-4 }), join);
    // 0.2 rather than 1e-6 for one reason: a round join is a CUBIC quarter-arc, which
    // encloses ~0.09 more than the exact quarter-disc the formula assumes.
    near(Math.abs(areaOf(out)), expected[join], 0.2, `outward offset, ${join}`);
  }
  // Inward: (s − 2d)², joins irrelevant on a shrinking convex corner.
  near(Math.abs(areaOf(d(geom.offset(square, -dist), 'inward'))), (s - 2 * dist) ** 2, 0.05);
  // Past the inradius there is nothing left - an empty ANSWER, not the input back.
  const gone = geom.offset(square, -60);
  assert.ok(gone.ok && gone.d === '', `over-shrunk offset should be empty, got ${gone.ok ? gone.d : gone.code}`);
  // A zero distance is the identity.
  near(Math.abs(areaOf(d(geom.offset(square, 0), 'zero'))), s * s, 1e-9);
});

test('offsetting a circle matches Steiner\'s A ± Pd + πd²', () => {
  const r = 100;
  const circle = circlePath(r);
  // Measured off the FIXTURE, not off an ideal circle: four cubics enclose ~2e-4 more
  // than a true circle does and an offset inherits its source's error, so an idealised
  // π(r+d)² expectation would make exact code look 11 units wrong.
  const A = Math.abs(areaOf(circle));
  let P = 0;
  for (const c of val(geom.parse(circle))) {
    for (const k of c.curves) P += lengthCubic(k as unknown as Cubic, 1e-7);
  }
  near(A, Math.PI * r * r, 10, 'the fixture really is a circle');
  for (const dist of [25, -25]) {
    const out = d(geom.offset(circle, dist, { tolerance: 1e-4 }), `offset ${dist}`);
    near(Math.abs(areaOf(out)), A + P * dist + Math.PI * dist * dist, 2.5, `circle offset ${dist}`);
  }
});

test('stroke-to-path outlines a circle to Steiner\'s band area', () => {
  const r = 100, width = 12;
  const circle = circlePath(r);
  // The fixture's own perimeter, so the oracle is about the STROKE and not about how
  // well four cubics approximate a circle.
  let perimeter = 0;
  for (const c of val(geom.parse(circle))) {
    for (const k of c.curves) perimeter += lengthCubic(k as unknown as Cubic, 1e-7);
  }
  const outline = d(geom.stroke(circle, width, { tolerance: 1e-4 }), 'stroked circle');
  const contours = val(geom.parse(outline), 'stroked circle');
  assert.equal(contours.length, 2, 'a stroked ring is an outer contour plus a hole');
  // Steiner: outer − inner = 2·P·(w/2) = P·w, whatever the π d² terms are.
  near(Math.abs(areaOf(outline)), perimeter * width, 1.5, 'band area');
  near(perimeter, 2 * Math.PI * r, 0.2, 'the fixture really is a circle');
  // The hole and the shell wind opposite ways, which is what makes it fill as a ring.
  const areas = contours.map(contourAreaLocal);
  assert.ok(areas[0]! * areas[1]! < 0, 'shell and hole must be oppositely wound');
});

test('stroking an open line gives the analytic area for each cap', () => {
  const len = 100, width = 20, r = width / 2;
  const line = `M0 0 L${len} 0`;
  const expect = {
    butt: len * width,
    square: (len + width) * width,
    round: len * width + Math.PI * r * r,
  } as const;
  for (const cap of ['butt', 'square', 'round'] as const) {
    const out = d(geom.stroke(line, width, { cap, tolerance: 1e-4 }), cap);
    near(Math.abs(areaOf(out)), expect[cap], 0.2, `${cap} cap`);
  }
});

test('stroke and offset defaults are SVG\'s', () => {
  const explicit = d(geom.stroke(SQUARE, 8, { cap: 'butt', join: 'miter', miterLimit: 4 }));
  const defaulted = d(geom.stroke(SQUARE, 8));
  near(areaOf(defaulted), areaOf(explicit), 1e-9, 'defaults should equal SVG\'s own');
});

// ── 7. simplify ───────────────────────────────────────────────────────────────

test('simplify reduces segment count within tolerance, and never inflates a path', () => {
  // A circle drawn as 32 cubics - more segments than the shape needs.
  const parts: string[] = [];
  const n = 32, r = 100;
  const k = ((4 / 3) * Math.tan(Math.PI / (2 * n))) * r;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const p0 = [r * Math.cos(a0), r * Math.sin(a0)], p1 = [r * Math.cos(a1), r * Math.sin(a1)];
    const t0 = [-Math.sin(a0), Math.cos(a0)], t1 = [-Math.sin(a1), Math.cos(a1)];
    if (i === 0) parts.push(`M${p0[0]} ${p0[1]}`);
    parts.push(`C${p0[0]! + k * t0[0]!} ${p0[1]! + k * t0[1]!} ${p1[0]! - k * t1[0]!} ${p1[1]! - k * t1[1]!} ${p1[0]} ${p1[1]}`);
  }
  const dense = `${parts.join('')}Z`;
  const before = val(geom.parse(dense))[0]!.curves.length;
  const r1 = geom.simplify(dense, { tolerance: 0.5 });
  const out = d(r1, 'simplify');
  assert.ok(r1.ok && r1.curves < before, `expected fewer than ${before} curves, got ${r1.ok && r1.curves}`);
  near(Math.abs(areaOf(out)), Math.PI * r * r, 60, 'simplified area stays close');
  // At a tolerance finer than any real corner, a square is already minimal and comes
  // back untouched rather than refitted worse.
  const sq = geom.simplify(SQUARE, { tolerance: 1e-6 });
  assert.ok(sq.ok && sq.curves === 3, `expected the square unchanged, got ${sq.ok && sq.curves} curves`);
  near(Math.abs(areaOf(d(sq))), 10000, 1e-6);
});

// ── 8. authored splines ───────────────────────────────────────────────────────

test('fromNodes lowers each known spline kind, handles as offsets from the node', () => {
  const nodes = [
    { x: 0, y: 0, hOutX: 30, hOutY: 0 },
    { x: 100, y: 100, hInX: 0, hInY: -30 },
  ];
  const cubic = d(geom.fromNodes({ kind: 'cubic', nodes, closed: false }), 'cubic');
  const parsed = val(geom.parse(cubic));
  assert.deepEqual(parsed[0]!.curves[0], [0, 0, 30, 0, 100, 70, 100, 100]);
  // 'line' ignores handles entirely.
  const line = d(geom.fromNodes({ kind: 'line', nodes, closed: false }), 'line');
  const lineSeg = val(geom.parse(line))[0]!.curves[0]!;
  near(lineSeg[6]!, 100, 1e-12); near(lineSeg[7]!, 100, 1e-12);
  // Interpolating kinds pass through their nodes; a B-spline deliberately does not.
  const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  for (const kind of ['catmull-rom', 'bspline']) {
    const out = d(geom.fromNodes({ kind, nodes: square, closed: true }), kind);
    const box = val(geom.bounds(out), kind)!;
    assert.ok(box.x1 - box.x0 > 10 && box.y1 - box.y0 > 10, `${kind} should enclose something`);
    assert.ok(Math.abs(areaOf(out)) > 1000, `${kind} area`);
  }
  // Fewer than two nodes is an empty path, not a failure.
  const lone = geom.fromNodes({ kind: 'cubic', nodes: [{ x: 1, y: 1 }], closed: false });
  assert.ok(lone.ok && lone.d === '');
});

test('fromNodes validates the kind in the ENGINE, so a new kind needs no bridge change', () => {
  // Never heard of it → the caller's argument was wrong.
  assert.equal(err(geom.fromNodes({ kind: 'not-a-spline', nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false })), 'invalid-argument');
  assert.equal(err(geom.fromNodes({ kind: '', nodes: [], closed: false })), 'invalid-argument');
  assert.equal(err(geom.fromNodes({ kind: 42 as unknown as string, nodes: [], closed: false })), 'invalid-argument');
  assert.equal(err(geom.fromNodes('nope' as unknown as { kind: string; nodes: []; closed: false })), 'invalid-argument');
  assert.equal(err(geom.fromNodes({ kind: 'cubic', nodes: 'no' as unknown as [], closed: false })), 'invalid-argument');
  assert.equal(err(geom.fromNodes({ kind: 'cubic', nodes: [{ x: NaN, y: 0 }, { x: 1, y: 1 }], closed: false })), 'invalid-argument');
  assert.equal(err(geom.fromNodes({ kind: 'cubic', nodes: [{ x: 0, y: 0, hOutX: Infinity }, { x: 1, y: 1 }], closed: false })), 'invalid-argument');
  assert.equal(err(geom.fromNodes({ kind: 'cubic', nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false, tension: NaN })), 'invalid-argument');
  assert.equal(err(geom.fromNodes({ kind: 'cubic', nodes: Array.from({ length: 25_000 }, () => ({ x: 0, y: 0 })), closed: false })), 'too-large');
  // A kind the engine DECLARES but cannot lower yet is 'unsupported', a different
  // answer entirely. Written as "ok or unsupported" on purpose: if a later engine
  // implements the lowering, this must not become a failing test for succeeding.
  const spiro = geom.fromNodes({ kind: 'spiro', nodes: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }], closed: false });
  assert.ok(spiro.ok || spiro.code === 'unsupported', `spiro should lower or say it cannot: ${spiro.ok ? '' : spiro.code}`);
  if (spiro.ok) assertFinite(spiro.d, 'spiro');
});

test('continuity re-applies a node\'s constraint after a handle drag', () => {
  // 'symmetric' mirrors direction AND length.
  const sym = val(geom.continuity({ x: 0, y: 0, hInX: 30, hInY: 40, hOutX: 1, hOutY: 0, continuity: 'symmetric' }, 'in'));
  near(sym.hOutX!, -30, 1e-12); near(sym.hOutY!, -40, 1e-12);
  // 'smooth' mirrors direction only, keeping the other handle's length (here 10).
  const smooth = val(geom.continuity({ x: 0, y: 0, hInX: 30, hInY: 40, hOutX: 0, hOutY: 10, continuity: 'smooth' }, 'in'));
  near(Math.hypot(smooth.hOutX!, smooth.hOutY!), 10, 1e-12);
  near(smooth.hOutX!, -6, 1e-12); near(smooth.hOutY!, -8, 1e-12);
  // 'corner' (and the default) leaves both handles alone.
  const corner = val(geom.continuity({ x: 0, y: 0, hInX: 30, hInY: 40, hOutX: 5, hOutY: 5 }, 'in'));
  assert.equal(corner.hOutX, 5); assert.equal(corner.hOutY, 5);
  assert.equal(err(geom.continuity({ x: 0, y: 0 }, 'sideways' as 'in')), 'invalid-argument');
  assert.equal(err(geom.continuity({ x: NaN, y: 0 }, 'in')), 'invalid-argument');
  assert.equal(err(geom.continuity({ x: 0, y: 0, continuity: 'wobbly' as 'smooth' }, 'in')), 'invalid-argument');
  assert.equal(err(geom.continuity({ y: 0 } as { x: number; y: number }, 'in')), 'invalid-argument');
});

// ── 9. measurement ────────────────────────────────────────────────────────────

test('bounds are the curves\' true extent, not their control hull', () => {
  // Controls reach to y = 300; the curve itself only reaches 225.
  const arch = 'M0 0 C0 300 100 300 100 0';
  const box = val(geom.bounds(arch), 'arch')!;
  near(box.x0, 0, 1e-9); near(box.x1, 100, 1e-9);
  near(box.y0, 0, 1e-9); near(box.y1, 225, 1e-9);
  const circle = val(geom.bounds(circlePath(100, 10, -10)), 'circle')!;
  near(circle.x0, -90, 1e-6); near(circle.x1, 110, 1e-6);
  near(circle.y0, -110, 1e-6); near(circle.y1, 90, 1e-6);
});

test('area is exact and signed, and reverses with orientation', () => {
  // (0,0) \u2192 (100,0) \u2192 (100,100) \u2192 (0,100) is counter-clockwise in a y-up frame, which
  // is what the sign describes; on an SVG screen (y down) the same winding reads
  // clockwise.
  near(val(geom.area(SQUARE)), 10000, 1e-9, 'counter-clockwise in y-up is positive');
  near(val(geom.area('M0 0 L0 100 L100 100 L100 0 Z')), -10000, 1e-9, 'the other way round');
  // 2.5, not 1e-9: the fixture is four cubics, which enclose ~2.8e-4 more than the
  // circle they approximate. The AREA is exact; the shape is the approximation.
  near(Math.abs(val(geom.area(circlePath(50)))), Math.PI * 2500, 2.5);
  // Documented behaviour: raw self-overlap gives the winding-weighted area; selfUnion
  // first for the filled one.
  const doubled = `${SQUARE}${SQUARE}`;
  near(Math.abs(val(geom.area(doubled))), 20000, 1e-9, 'algebraic area counts twice');
  near(Math.abs(areaOf(d(geom.selfUnion(doubled)))), 10000, 1e-6, 'canonical area counts once');
});

test('nearest reports the point, the address and the parameter to split at', () => {
  const line = val(geom.nearest('M0 0 L100 0', 50, 10), 'line');
  near(line.x, 50, 1e-9); near(line.y, 0, 1e-9);
  near(line.distance, 10, 1e-9); near(line.t, 0.5, 1e-9);
  assert.equal(line.contour, 0); assert.equal(line.curve, 0);
  // A point outside a circle: the nearest point is on the ray to the centre.
  const c = val(geom.nearest(circlePath(100), 300, 0), 'circle');
  near(c.distance, 200, 1e-6);
  near(c.x, 100, 1e-6); near(c.y, 0, 1e-6);
  // The right contour is reported when there are several.
  const two = val(geom.nearest(`${SQUARE}M500 500 L600 500 L600 600 L500 600 Z`, 590, 590), 'two contours');
  assert.equal(two.contour, 1);
  assert.ok(two.distance < 20);
  assert.ok(Number.isFinite(two.t) && two.t >= 0 && two.t <= 1);
  // Nothing to measure against is a refusal, not a NaN distance.
  assert.equal(err(geom.nearest('', 0, 0)), 'invalid-path');
});

test('contains and winding agree with each other under the nonzero rule', () => {
  const ring = `${circlePath(100)}${circlePath(50)}`;   // same winding: nonzero fills the middle
  for (const [x, y] of [[0, 0], [70, 0], [0, 70], [150, 0], [-90, 0]] as const) {
    const w = val(geom.winding(ring, x, y));
    assert.equal(val(geom.contains(ring, x, y)), w !== 0, `nonzero at (${x},${y}) with winding ${w}`);
  }
  assert.equal(val(geom.contains(ring, 0, 0, { fillRule: 'evenodd' })), false, 'evenodd punches the hole');
  assert.equal(val(geom.contains(ring, 75, 0, { fillRule: 'evenodd' })), true);
});

// ── 10. the surface itself ────────────────────────────────────────────────────

test('every method is synchronous, present, and returns a discriminated result', () => {
  const methods = [
    'union', 'intersect', 'difference', 'xor', 'selfUnion', 'offset', 'stroke', 'simplify',
    'fromNodes', 'continuity', 'bounds', 'area', 'contains', 'winding', 'nearest',
    'parse', 'toPathData', 'limits',
  ] as const;
  for (const m of methods) {
    assert.equal(typeof geom[m], 'function', `host.geom.${m} must exist`);
  }
  // Nothing returns a promise: a pen tool computes geometry inside an input handler.
  const results: unknown[] = [
    geom.union([SQUARE, SQUARE_B]), geom.selfUnion(SQUARE), geom.offset(SQUARE, 1),
    geom.stroke(SQUARE, 1), geom.simplify(SQUARE), geom.bounds(SQUARE), geom.area(SQUARE),
    geom.contains(SQUARE, 1, 1), geom.winding(SQUARE, 1, 1), geom.nearest(SQUARE, 1, 1),
    geom.parse(SQUARE), geom.fromNodes({ kind: 'line', nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false }),
    geom.continuity({ x: 0, y: 0 }, 'in'),
  ];
  for (const r of results) {
    assert.ok(!(r instanceof Promise), 'host.geom must be synchronous');
    assert.equal(typeof (r as { ok: unknown }).ok, 'boolean');
  }
  // `limits()` hands back a copy - a tool cannot lower the engine's own ceilings.
  const a = geom.limits();
  a.maxCurves = 1;
  assert.notEqual(geom.limits().maxCurves, 1);
});
