/**
 * Contract tests for the DOM-free CSS "paint" parsers the export walkers (SVG + PDF)
 * share: clip-path basic shapes, radial-gradient geometry, and drop-shadow filters.
 * These feed the vector clip / gradient / shadow output, so the geometry must match
 * what a browser renders. Run with: node --test tests/css-paint.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseClipShape, parseRadialGradient, parseDropShadowFilter,
  splitCssArgs, parseGradientStop,
} from '../engine/src/css-paint.ts';

const close = (a: number, b: number, eps = 1e-3): boolean => Math.abs(a - b) <= eps;

// ── clip-path ─────────────────────────────────────────────────────────────────

test('parseClipShape: circle at centre (closest-side default)', () => {
  const s = parseClipShape('circle(at 50% 50%)', 200, 100);
  assert.equal(s?.kind, 'circle');
  if (s?.kind === 'circle') { assert.equal(s.cx, 100); assert.equal(s.cy, 50); assert.equal(s.r, 50); } // min side dist
});

test('parseClipShape: circle explicit radius + position', () => {
  const s = parseClipShape('circle(40px at 30px 20px)', 200, 100);
  assert.deepEqual(s, { kind: 'circle', cx: 30, cy: 20, r: 40 });
});

test('parseClipShape: ellipse with two radii', () => {
  const s = parseClipShape('ellipse(60px 30px at 50% 50%)', 200, 100);
  assert.equal(s?.kind, 'ellipse');
  if (s?.kind === 'ellipse') { assert.equal(s.rx, 60); assert.equal(s.ry, 30); assert.equal(s.cx, 100); assert.equal(s.cy, 50); }
});

test('parseClipShape: inset with per-side values and round radius', () => {
  const s = parseClipShape('inset(10px 20px 30px 40px round 8px)', 200, 100);
  // top=10 right=20 bottom=30 left=40 → x=40 y=10 w=200-40-20=140 h=100-10-30=60
  assert.deepEqual(s, { kind: 'inset', x: 40, y: 10, w: 140, h: 60, r: 8 });
});

test('parseClipShape: inset single value (all sides equal)', () => {
  const s = parseClipShape('inset(10px)', 200, 100);
  assert.deepEqual(s, { kind: 'inset', x: 10, y: 10, w: 180, h: 80, r: 0 });
});

test('parseClipShape: polygon keeps >=3 points, drops <3', () => {
  const tri = parseClipShape('polygon(0 0, 100 0, 50 80)', 100, 80);
  assert.equal(tri?.kind, 'polygon');
  if (tri?.kind === 'polygon') assert.deepEqual(tri.points, [[0, 0], [100, 0], [50, 80]]);
  assert.equal(parseClipShape('polygon(0 0, 100 0)', 100, 80), null);   // <3 → null
});

test('parseClipShape: url()/path()/unparseable → null (caller rasterises)', () => {
  assert.equal(parseClipShape('url(#m)', 100, 100), null);
  assert.equal(parseClipShape('path("M0 0 L10 10Z")', 100, 100), null);
  assert.equal(parseClipShape('circle(closest-corner at 50% 50%)', 100, 100), null); // NaN radius → null
});

// ── radial-gradient geometry ────────────────────────────────────────────────

test('parseRadialGradient: default ellipse farthest-corner at centre', () => {
  // default shape = ellipse, size = farthest-corner: rx = (w/2)·√2, ry = (h/2)·√2
  const g = parseRadialGradient('radial-gradient(rgb(255, 0, 0), rgb(0, 0, 255))', 200, 100);
  assert.ok(g);
  assert.equal(g!.cx, 100); assert.equal(g!.cy, 50);
  assert.ok(close(g!.rx, 100 * Math.SQRT2));
  assert.ok(close(g!.ry, 50 * Math.SQRT2));
  assert.equal(g!.stops.length, 2);
});

test('parseRadialGradient: explicit ellipse size (percent) + position — the quotes/daily-card form', () => {
  const g = parseRadialGradient('radial-gradient(42% 48% at 30% 28%, rgb(48, 186, 120), transparent 70%)', 500, 300);
  assert.ok(g);
  assert.ok(close(g!.cx, 150));         // 30% of 500
  assert.ok(close(g!.cy, 84));          // 28% of 300
  assert.ok(close(g!.rx, 210));         // 42% of 500
  assert.ok(close(g!.ry, 144));         // 48% of 300
  assert.equal(g!.stops[0]!.colorStr, 'rgb(48, 186, 120)');
  assert.equal(g!.stops[1]!.opacity, 0); // transparent
  assert.equal(g!.stops[1]!.offset, '70%');
});

test('parseRadialGradient: circle closest-side', () => {
  // circle at centre of 200×100 → closest side dist = 50 (min of 100,50)
  const g = parseRadialGradient('radial-gradient(circle closest-side at 50% 50%, rgb(0,0,0), rgb(255,255,255))', 200, 100);
  assert.ok(g);
  assert.ok(close(g!.rx, 50)); assert.ok(close(g!.ry, 50));
});

test('parseRadialGradient: circle farthest-corner (hypot of far sides)', () => {
  // circle at top-left corner of 200×100: far x=200, far y=100 → r=hypot(200,100)
  const g = parseRadialGradient('radial-gradient(circle at 0 0, rgb(0,0,0), rgb(1,1,1))', 200, 100);
  assert.ok(g);
  assert.ok(close(g!.rx, Math.hypot(200, 100)));
});

test('parseRadialGradient: non-radial → null', () => {
  assert.equal(parseRadialGradient('linear-gradient(rgb(0,0,0), rgb(1,1,1))', 100, 100), null);
  assert.equal(parseRadialGradient('none', 100, 100), null);
});

// ── drop-shadow filter ──────────────────────────────────────────────────────

test('parseDropShadowFilter: single shadow, colour-first (computed form)', () => {
  const s = parseDropShadowFilter('drop-shadow(rgb(0, 0, 0) 2px 4px 6px)');
  assert.deepEqual(s, [{ dx: 2, dy: 4, blur: 6, color: 'rgb(0, 0, 0)' }]);
});

test('parseDropShadowFilter: blur omitted defaults to 0', () => {
  const s = parseDropShadowFilter('drop-shadow(rgba(0, 0, 0, 0.5) 3px 3px)');
  assert.deepEqual(s, [{ dx: 3, dy: 3, blur: 0, color: 'rgba(0, 0, 0, 0.5)' }]);
});

test('parseDropShadowFilter: chained shadows preserved in order', () => {
  const s = parseDropShadowFilter('drop-shadow(rgb(0, 0, 0) 1px 1px 1px) drop-shadow(rgb(255, 0, 0) -2px -2px 2px)');
  assert.equal(s?.length, 2);
  assert.equal(s![0]!.dx, 1);
  assert.equal(s![1]!.dx, -2);
  assert.equal(s![1]!.color, 'rgb(255, 0, 0)');
});

test('parseDropShadowFilter: any non-drop-shadow function → null (rasterise)', () => {
  assert.equal(parseDropShadowFilter('blur(4px)'), null);
  assert.equal(parseDropShadowFilter('drop-shadow(rgb(0,0,0) 2px 2px) grayscale(1)'), null);
  assert.equal(parseDropShadowFilter('none'), null);
  assert.equal(parseDropShadowFilter(''), null);
});

// ── shared splitters (spot-check the parens-aware behaviour) ─────────────────

test('splitCssArgs: does not split commas inside parens', () => {
  assert.deepEqual(splitCssArgs('rgb(1, 2, 3) 0%, rgb(4, 5, 6) 100%'), ['rgb(1, 2, 3) 0%', 'rgb(4, 5, 6) 100%']);
});

test('parseGradientStop: peels position off a spaced rgb() colour', () => {
  const s = parseGradientStop('rgb(48, 186, 120) 25%', 0, 2);
  assert.equal(s.colorStr, 'rgb(48, 186, 120)');
  assert.equal(s.offset, '25%');
});
