// SPDX-License-Identifier: MPL-2.0
// Golden + parity tests for the editor's connector routing geometry
// (shells/web/src/views/free-canvas-math.ts). This math was lifted out of
// free-canvas.ts so it could be tested, and it MIRRORS the committed-render routing in
// tools/org-chart/hooks.js. These golden values lock the shell path output; the parity
// test at the end guards the elbow fractions from drifting between the two files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  edgeWaypoints, edgeBorderPt, edgeNested, roundedEdgePath, smoothEdgePath,
} from '../shells/web/src/views/free-canvas-math.ts';

// A stacked pair (a above b) and a diagonal pair (a up-left of b), in native px.
const aTop = { x: 0, y: 0, w: 100, h: 50 };
const bBelow = { x: 0, y: 200, w: 100, h: 50 };
const bDiag = { x: 300, y: 200, w: 100, h: 50 };

test('edgeWaypoints: straight leaves + meets the box borders', () => {
  assert.deepEqual(edgeWaypoints(aTop, bBelow, 'straight'), [
    { x: 50, y: 50 },   // bottom-centre of a
    { x: 50, y: 200 },  // top-centre of b
  ]);
});

test('edgeWaypoints: mid elbow (auto orientation) routes through a horizontal trunk', () => {
  // |dy| < |dx| here, so the trunk is horizontal (useV false) and bends at the midpoint.
  assert.deepEqual(edgeWaypoints(aTop, bDiag, 'elbow'), [
    { x: 100, y: 25 }, { x: 200, y: 25 }, { x: 200, y: 225 }, { x: 300, y: 225 },
  ]);
});

test('edgeWaypoints: elbow-src bends near the source (frac 0.18)', () => {
  assert.deepEqual(edgeWaypoints(aTop, bDiag, 'elbow-src'), [
    { x: 100, y: 25 }, { x: 136, y: 25 }, { x: 136, y: 225 }, { x: 300, y: 225 },
  ]);
});

test('edgeWaypoints: elbow-tgt bends near the target (frac 0.82)', () => {
  assert.deepEqual(edgeWaypoints(aTop, bDiag, 'elbow-tgt'), [
    { x: 100, y: 25 }, { x: 264, y: 25 }, { x: 264, y: 225 }, { x: 300, y: 225 },
  ]);
});

test('edgeWaypoints: elbow-v forces a vertical trunk even when dx dominates', () => {
  const pts = edgeWaypoints(aTop, bDiag, 'elbow-v');
  // Vertical trunk: leaves the bottom face of a and meets the top face of b.
  assert.equal(pts[0]!.y, 50);        // a.y + a.h
  assert.equal(pts[pts.length - 1]!.y, 200); // b.y
});

test('edgeBorderPt: projects onto the ray toward the target', () => {
  assert.deepEqual(edgeBorderPt({ cx: 50, cy: 25, hw: 50, hh: 25 }, 50, 225), { x: 50, y: 50 });
});

test('edgeNested: a box fully inside another (or identical) reports nested', () => {
  assert.equal(edgeNested({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 50, h: 50 }), true);
  assert.equal(edgeNested({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0, w: 100, h: 100 }), true);
  assert.equal(edgeNested({ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 200, w: 50, h: 50 }), false);
});

test('roundedEdgePath: two points draw a straight segment', () => {
  assert.equal(roundedEdgePath([{ x: 0, y: 0 }, { x: 100, y: 0 }], 16), 'M0 0L100 0');
});

test('roundedEdgePath: corners are rounded with quadratics (golden)', () => {
  const pts = edgeWaypoints(aTop, bDiag, 'elbow');
  assert.equal(
    roundedEdgePath(pts, 16),
    'M100 25L184 25Q200 25 200 41L200 209Q200 225 216 225L300 225',
  );
});

test('smoothEdgePath: renders a single cubic S-curve (golden)', () => {
  const pts = edgeWaypoints(aTop, bBelow, 'elbow');
  assert.equal(smoothEdgePath(pts), 'M50 50C50 125 50 125 50 200');
});

test('parity: the tool hook and the shell math share the elbow fractions', () => {
  // tools/org-chart/hooks.js (committed render) and free-canvas-math.ts (editor preview)
  // hand-mirror the routing. If someone re-tunes the elbow bend in one, this fails.
  const hook = readFileSync(new URL('../tools/org-chart/hooks.js', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../shells/web/src/views/free-canvas-math.ts', import.meta.url), 'utf8');
  for (const frac of ['0.18', '0.82']) {
    assert.ok(hook.includes(frac), `hooks.js should encode elbow fraction ${frac}`);
    assert.ok(shell.includes(frac), `free-canvas-math.ts should encode elbow fraction ${frac}`);
  }
});

// ── Arc family (a sampled quadratic bow; the render draws a real Q) ────────────

test('edgeWaypoints: arc is a sampled bow off the chord, ending on the borders', () => {
  const pts = edgeWaypoints(aTop, bBelow, 'arc');
  assert.ok(pts.length > 2, 'arc samples into a polyline');
  assert.deepEqual(pts[0], { x: 50, y: 50 });                 // bottom-centre of a
  assert.deepEqual(pts[pts.length - 1]!, { x: 50, y: 200 });  // top-centre of b
  const mid = pts[Math.floor(pts.length / 2)]!;
  assert.ok(Math.abs(mid.x - 50) > 5, 'it bows sideways off the straight chord (x=50)');
});

test('edgeWaypoints: arc-flip bows the opposite side; arc-wide bows deeper', () => {
  const m = (s: string): number => { const p = edgeWaypoints(aTop, bBelow, s); return p[Math.floor(p.length / 2)]!.x - 50; };
  assert.equal(Math.sign(m('arc')), -Math.sign(m('arc-flip')), 'reverse bows the other way');
  assert.ok(Math.abs(m('arc-wide')) > Math.abs(m('arc')), 'wide bows deeper than the plain arc');
});

test('parity: the tool hook and the shell math share the arc variants', () => {
  const hook = readFileSync(new URL('../tools/org-chart/hooks.js', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../shells/web/src/views/free-canvas-math.ts', import.meta.url), 'utf8');
  for (const key of ['arc-wide', 'arc-flip', 'arc-flip-wide']) {
    assert.ok(hook.includes(key), `hooks.js should encode arc variant ${key}`);
    assert.ok(shell.includes(key), `free-canvas-math.ts should encode arc variant ${key}`);
  }
});
