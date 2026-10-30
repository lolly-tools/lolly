// SPDX-License-Identifier: MPL-2.0
/**
 * The Pencil's fit: freehand samples to an editable cubic path. The claims are the ones
 * the module header makes, checked against the ENGINE's lowering of the result rather than
 * against the fitter's own bookkeeping: every sample lies within the tolerance of the
 * committed curve, corners the hand made survive as corners, smooth joins really are
 * smooth, and a dab is not a shape.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-pencil.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type AuthoredPath, type Cubic, nearestOnCubic } from '@lolly/engine';
import { lowerAuthored } from './free-canvas-pen.ts';
import { MAX_SAMPLES, cornerIndices, dedupeSamples, fitCubics, freehandPath, simplifyRdp } from './free-canvas-pencil.ts';

type Pt = { x: number; y: number };

/** A deterministic wobble, so a "hand-drawn" trace is the same trace on every run. */
function wobble(i: number, amp: number): number {
  return Math.sin(i * 1.7) * amp * 0.6 + Math.sin(i * 0.37 + 1) * amp * 0.4;
}

/** The farthest any sample sits from the lowered curve. */
function worstDistance(path: AuthoredPath, pts: readonly Pt[]): number {
  const cubics: Cubic[] = lowerAuthored(path).cubics;
  let worst = 0;
  for (const p of pts) {
    let best = Infinity;
    for (const c of cubics) best = Math.min(best, nearestOnCubic(c, p.x, p.y).distance);
    worst = Math.max(worst, best);
  }
  return worst;
}

test('dedupeSamples drops the near-duplicates a slow hand makes, and keeps the lift point', () => {
  const pts = [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 5, y: 0 }, { x: 5.05, y: 0.02 }, { x: 5.2, y: 0 }];
  const out = dedupeSamples(pts, 1);
  assert.deepEqual(out, [{ x: 0, y: 0 }, { x: 5.2, y: 0 }]);
  assert.deepEqual(dedupeSamples([{ x: Number.NaN, y: 0 }, { x: 1, y: 1 }], 1), [{ x: 1, y: 1 }], 'non-finite samples go');
});

test('simplifyRdp keeps both ends and every vertex that holds the outline', () => {
  // An L: 0..50 along x, then 0..50 down y, sampled every 1px with a little jitter.
  const pts: Pt[] = [];
  for (let i = 0; i <= 50; i++) pts.push({ x: i, y: wobble(i, 0.3) });
  for (let i = 1; i <= 50; i++) pts.push({ x: 50 + wobble(i + 60, 0.3), y: i });
  const keep = simplifyRdp(pts, 1);
  assert.equal(keep[0], 0);
  assert.equal(keep[keep.length - 1], pts.length - 1);
  assert.ok(keep.length <= 5, `jitter under the tolerance is gone (${keep.length} kept)`);
  assert.ok(keep.some((i) => Math.abs(i - 50) <= 1), 'the corner sample is kept');
});

test('cornerIndices finds the turn a hand meant and ignores a wobble on short legs', () => {
  const pts: Pt[] = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }];
  assert.deepEqual(cornerIndices(pts, [0, 1, 2], 70, 4), [1], 'a right angle is a corner');
  assert.deepEqual(cornerIndices(pts, [0, 1, 2], 100, 4), [], 'unless the corner angle is wider');
  const jitter: Pt[] = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 51, y: 1 }, { x: 100, y: 1 }];
  assert.deepEqual(cornerIndices(jitter, [0, 1, 2, 3], 70, 4), [], 'a sharp turn between short legs is not a corner');
});

test('a hand-drawn arc becomes a few smooth nodes, every sample within the tolerance', () => {
  const pts: Pt[] = [];
  for (let i = 0; i <= 240; i++) {
    const a = (Math.PI * i) / 240;
    const r = 150 + wobble(i, 1.2);
    pts.push({ x: 200 + Math.cos(a) * r, y: 200 - Math.sin(a) * r });
  }
  const tol = 2.5;
  const path = freehandPath(pts, { tolerance: tol, closeDist: 10 });
  assert.ok(path, 'an arc is a shape');
  assert.equal(path!.kind, 'cubic', 'stored as Bezier handles, so every node is editable');
  assert.equal(path!.closed, false, 'its ends are far apart, so it stays open');
  assert.ok(path!.nodes.length <= 6, `a smooth arc needs few nodes (${path!.nodes.length})`);
  const worst = worstDistance(path!, pts);
  assert.ok(worst <= tol + 1e-6, `every sample within ${tol}px of the curve (worst ${worst.toFixed(3)})`);
  // Interior joins are smooth, and truly so: the two handles are collinear and opposed.
  for (const n of path!.nodes.slice(1, -1)) {
    assert.equal(n.continuity, 'smooth');
    const cross = (n.hInX ?? 0) * (n.hOutY ?? 0) - (n.hInY ?? 0) * (n.hOutX ?? 0);
    const dotp = (n.hInX ?? 0) * (n.hOutX ?? 0) + (n.hInY ?? 0) * (n.hOutY ?? 0);
    const len = Math.hypot(n.hInX ?? 0, n.hInY ?? 0) * Math.hypot(n.hOutX ?? 0, n.hOutY ?? 0);
    assert.ok(Math.abs(cross) / len < 1e-9, 'the handles are in line');
    assert.ok(dotp < 0, 'and point opposite ways');
  }
  assert.equal(path!.nodes[0]!.continuity, 'corner', 'an open end is a corner');
});

test('a V keeps its point as a corner node', () => {
  const pts: Pt[] = [];
  for (let i = 0; i <= 100; i++) pts.push({ x: i, y: i * 1.5 + wobble(i, 0.4) });
  for (let i = 1; i <= 100; i++) pts.push({ x: 100 + i, y: 150 - i * 1.5 + wobble(i + 7, 0.4) });
  const path = freehandPath(pts, { tolerance: 2 });
  assert.ok(path);
  const tip = path!.nodes.find((n) => Math.hypot(n.x - 100, n.y - 150) < 4);
  assert.ok(tip, 'a node sits at the tip of the V');
  assert.equal(tip!.continuity, 'corner');
  assert.ok(worstDistance(path!, pts) <= 2 + 1e-6);
});

test('a loop that comes back to its start closes', () => {
  const pts: Pt[] = [];
  for (let i = 0; i <= 200; i++) {
    const a = (2 * Math.PI * i) / 200;
    pts.push({ x: 300 + Math.cos(a) * 80 + wobble(i, 0.5), y: 300 + Math.sin(a) * 80 });
  }
  pts.push({ x: 384, y: 303 }); // the hand overshoots a little past where it began
  const path = freehandPath(pts, { tolerance: 2.5, closeDist: 10 });
  assert.ok(path);
  assert.equal(path!.closed, true);
  const n0 = path!.nodes[0]!;
  assert.ok(n0.hInX !== undefined && n0.hOutX !== undefined, 'the start carries both arms of the join');
  assert.ok(worstDistance(path!, pts.slice(0, -1)) <= 2.5 + 1e-6);
  assert.equal(freehandPath(pts, { tolerance: 2.5 })!.closed, false, 'closeDist 0 never closes');
});

test('a click or a dab is not a shape', () => {
  assert.equal(freehandPath([{ x: 10, y: 10 }], { tolerance: 2 }), null);
  assert.equal(freehandPath([{ x: 10, y: 10 }, { x: 10.2, y: 10.1 }, { x: 11, y: 11 }], { tolerance: 2 }), null);
});

test('fitCubics meets the bound on a jagged scribble too', () => {
  const pts: Pt[] = [];
  for (let i = 0; i < 400; i++) pts.push({ x: i * 2, y: Math.sin(i / 9) * 60 + wobble(i, 3) });
  const fitted = fitCubics(pts, 1.5);
  assert.ok(fitted.length > 1);
  for (let k = 1; k < fitted.length; k++) {
    assert.deepEqual(fitted[k]![0], fitted[k - 1]![3], 'consecutive curves share their join');
  }
  const path = freehandPath(pts, { tolerance: 1.5 });
  assert.ok(worstDistance(path!, pts) <= 1.5 + 1e-6);
});

test('a very long trace is thinned rather than refused', () => {
  const pts: Pt[] = [];
  for (let i = 0; i < MAX_SAMPLES * 3; i++) pts.push({ x: i * 0.5, y: Math.sin(i / 200) * 100 });
  const path = freehandPath(pts, { tolerance: 2 });
  assert.ok(path && path.nodes.length >= 2);
  const last = path!.nodes[path!.nodes.length - 1]!;
  assert.deepEqual([last.x, last.y], [pts[pts.length - 1]!.x, pts[pts.length - 1]!.y], 'it still ends where the hand lifted');
});
