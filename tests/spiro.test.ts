// SPDX-License-Identifier: MPL-2.0
/**
 * Spiro spline (engine/src/geom/spiro.ts) — the Euler-spiral interpolating spline.
 * Tests the mathematical contract through the public `toCubics` seam: interpolation,
 * straight-line/collinear degeneracy, G1 at every smooth join, curvature continuity,
 * corner independence, and a closed loop. Real module, no mocks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCubics, type AuthoredPath, type Node } from '../engine/src/geom/spline.ts';
import { maxSpiroCurvatureJump } from '../engine/src/geom/spiro.ts';
import type { Cubic } from '../engine/src/geom/bezier.ts';

const spiro = (nodes: Node[], closed = false): Cubic[] =>
  toCubics({ kind: 'spiro', nodes, closed } as AuthoredPath);

const P = (x: number, y: number, continuity: Node['continuity'] = 'smooth'): Node => ({ x, y, continuity });

// ── cubic differential helpers (for G1/G2 checks) ────────────────────────────
const startTangent = (c: Cubic): [number, number] => [c[2] - c[0], c[3] - c[1]];
const endTangent = (c: Cubic): [number, number] => [c[6] - c[4], c[7] - c[5]];
const angle = (v: [number, number]) => Math.atan2(v[1], v[0]);
function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}
/** Signed curvature of a cubic at t=0 (start) or t=1 (end). */
function curvature(c: Cubic, at: 0 | 1): number {
  const [p0x, p0y, c1x, c1y, c2x, c2y, p3x, p3y] = c;
  let dx: number, dy: number, ddx: number, ddy: number;
  if (at === 0) {
    dx = 3 * (c1x - p0x); dy = 3 * (c1y - p0y);
    ddx = 6 * (p0x - 2 * c1x + c2x); ddy = 6 * (p0y - 2 * c1y + c2y);
  } else {
    dx = 3 * (p3x - c2x); dy = 3 * (p3y - c2y);
    ddx = 6 * (p3x - 2 * c2x + c1x); ddy = 6 * (p3y - 2 * c2y + c1y);
  }
  const sp = Math.hypot(dx, dy);
  if (sp < 1e-9) return 0;
  return (dx * ddy - dy * ddx) / (sp * sp * sp);
}
const near = (a: number, b: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${a} ≈ ${b} (tol ${tol})`);

test('two knots lower to a single straight segment', () => {
  const cs = spiro([P(0, 0), P(100, 0)]);
  assert.equal(cs.length, 1);
  const [c] = cs;
  // Collinear controls on the x-axis → a straight line.
  near(c![1], 0, 1e-6, 'p0y'); near(c![3], 0, 1e-6, 'c1y'); near(c![5], 0, 1e-6, 'c2y'); near(c![7], 0, 1e-6, 'p3y');
  near(c![0], 0, 1e-6); near(c![6], 100, 1e-6);
});

test('collinear knots stay straight', () => {
  const cs = spiro([P(0, 0), P(50, 0), P(120, 0), P(200, 0)]);
  assert.ok(cs.length >= 3);
  for (const c of cs) for (let i = 1; i < 8; i += 2) near(c[i]!, 0, 1e-4, 'all y ≈ 0');
});

test('interpolation: the path passes through every knot in order', () => {
  const nodes = [P(0, 0), P(60, 80), P(160, 40), P(220, 140)];
  const cs = spiro(nodes);
  // First cubic starts at node 0.
  near(cs[0]![0], 0, 1e-6); near(cs[0]![1], 0, 1e-6);
  // Last cubic ends at the last node.
  const last = cs[cs.length - 1]!;
  near(last[6], 220, 1e-6); near(last[7], 140, 1e-6);
  // Every node appears as some cubic endpoint (start or end).
  for (const n of nodes) {
    const hit = cs.some((c) =>
      (Math.hypot(c[0] - n.x, c[1] - n.y) < 1e-4) || (Math.hypot(c[6] - n.x, c[7] - n.y) < 1e-4));
    assert.ok(hit, `node (${n.x},${n.y}) is on the curve`);
  }
});

test('every join in an all-smooth path is G1 (tangent continuous)', () => {
  const cs = spiro([P(0, 0), P(60, 90), P(170, 60), P(240, 150), P(320, 60)]);
  for (let i = 0; i + 1 < cs.length; i++) {
    const t0 = angle(endTangent(cs[i]!));
    const t1 = angle(startTangent(cs[i + 1]!));
    // Consecutive cubics must share position too (C0).
    near(cs[i]![6], cs[i + 1]![0], 1e-6, `join ${i} x`);
    near(cs[i]![7], cs[i + 1]![1], 1e-6, `join ${i} y`);
    assert.ok(angDiff(t0, t1) < 1e-3, `join ${i} G1: ${t0} vs ${t1}`);
  }
});

test('the analytic clothoid curvature is continuous at smooth knots (the G2 solve)', () => {
  // The Newton refinement drives the true κ_exit(left) − κ_entry(right) to ~0. This is
  // the real G2 guarantee; the 2nd derivative of the cubic Bézier approximation is jumpy
  // by nature (a clothoid is not a cubic) and is NOT what "smooth" means here.
  for (const nodes of [
    [P(0, 0), P(60, 90), P(170, 60), P(240, 150), P(320, 60)],     // wiggly
    [P(0, 0), P(100, 40), P(220, 20), P(320, 80)],                  // gentle S
    [P(0, 100), P(80, 40), P(160, 100), P(240, 40), P(320, 100)],   // wave
  ]) {
    assert.ok(maxSpiroCurvatureJump(nodes, false) < 1e-6, `max curvature jump ${maxSpiroCurvatureJump(nodes, false)}`);
  }
  // Closed loop: curvature continuous at every knot including the seam.
  const circle = Array.from({ length: 8 }, (_, i) => P(100 * Math.cos((i * Math.PI) / 4), 100 * Math.sin((i * Math.PI) / 4)));
  assert.ok(maxSpiroCurvatureJump(circle, true) < 1e-6, 'closed loop curvature continuity');
});

test('the rendered cubics stay close to the true curve (G1-exact, bounded approximation)', () => {
  // Not a curvature test — a shape test: the emitted cubics interpolate the knots and no
  // control point flies off (a broken clothoid solve throws a control arm to infinity).
  const cs = spiro([P(0, 0), P(60, 90), P(170, 60), P(240, 150), P(320, 60)]);
  const xs = cs.flatMap((c) => [c[0], c[2], c[4], c[6]]);
  const ys = cs.flatMap((c) => [c[1], c[3], c[5], c[7]]);
  assert.ok(Math.min(...xs) > -80 && Math.max(...xs) < 400, 'x within a sane box around the polygon');
  assert.ok(Math.min(...ys) > -80 && Math.max(...ys) < 230, 'y within a sane box around the polygon');
});

test('a corner knot makes the two sides independent', () => {
  const left = [P(0, 0), P(60, 80), P(140, 40, 'corner')];
  // Same left three knots, different right side.
  const a = spiro([...left, P(200, 120), P(260, 40)]);
  const b = spiro([...left, P(210, 20), P(300, 90)]);
  // The cubics up to the corner knot (x reaches 140,y40) must be byte-identical.
  const upTo = (cs: Cubic[]) => {
    const out: Cubic[] = [];
    for (const c of cs) { out.push(c); if (Math.hypot(c[6] - 140, c[7] - 40) < 1e-6) break; }
    return out;
  };
  const la = upTo(a), lb = upTo(b);
  assert.equal(la.length, lb.length, 'same cubic count before the corner');
  for (let i = 0; i < la.length; i++) for (let k = 0; k < 8; k++) near(la[i]![k]!, lb[i]![k]!, 1e-9, `corner isolation cubic ${i}[${k}]`);
});

test('a closed loop is closed, interpolates, and is smooth at the seam', () => {
  // 8 knots on a unit-100 circle, all smooth → a near-circular closed clothoid loop.
  const R = 100, N = 8;
  const nodes: Node[] = [];
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N;
    nodes.push(P(R * Math.cos(a), R * Math.sin(a)));
  }
  const cs = spiro(nodes, true);
  // Closes: last cubic ends at node 0.
  const last = cs[cs.length - 1]!;
  near(last[6], nodes[0]!.x, 1e-4, 'seam x'); near(last[7], nodes[0]!.y, 1e-4, 'seam y');
  // G1 at every join including the seam (first vs last).
  for (let i = 0; i < cs.length; i++) {
    const cur = cs[i]!, nxt = cs[(i + 1) % cs.length]!;
    near(cur[6], nxt[0], 1e-4, `loop join ${i} x`);
    assert.ok(angDiff(angle(endTangent(cur)), angle(startTangent(nxt))) < 2e-3, `loop join ${i} G1`);
  }
  // Every sampled point stays close to the circle (a real circle-ish clothoid, not a
  // polygon or a blow-up). Sample cubic midpoints.
  for (const c of cs) {
    const mx = 0.125 * c[0] + 0.375 * c[2] + 0.375 * c[4] + 0.125 * c[6];
    const my = 0.125 * c[1] + 0.375 * c[3] + 0.375 * c[5] + 0.125 * c[7];
    const rr = Math.hypot(mx, my);
    assert.ok(rr > 90 && rr < 106, `midpoint radius ${rr} within [90,106]`);
  }
});

test('deterministic', () => {
  const nodes = [P(0, 0), P(60, 90), P(170, 60), P(240, 150)];
  assert.deepEqual(spiro(nodes), spiro(nodes));
});

test('fewer than two knots lowers to nothing', () => {
  assert.deepEqual(spiro([]), []);
  assert.deepEqual(spiro([P(10, 10)]), []);
});
