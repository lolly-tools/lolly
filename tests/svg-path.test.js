/**
 * SVG path tokenizer contract tests.
 * Run with: node --test tests/svg-path.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSvgPath, parseSvgPathArgs, svgArcToBeziers } from '../engine/src/svg-path.js';

test('parseSvgPathArgs: tolerant number scan', () => {
  assert.deepEqual(parseSvgPathArgs('10 0 -5.5,3e1'), [10, 0, -5.5, 30]);
  assert.deepEqual(parseSvgPathArgs(''), []);
});

test('closed triangle → one closed subpath of M,L,L', () => {
  const sp = parseSvgPath('M0 0 L10 0 L10 10 Z');
  assert.equal(sp.length, 1);
  assert.equal(sp[0].closed, true);
  assert.deepEqual(sp[0].segments.map(s => s.op), ['M', 'L', 'L']);
  assert.deepEqual(sp[0].segments[0], { op: 'M', x: 0, y: 0 });
});

test('H/V expand to absolute L', () => {
  const [sub] = parseSvgPath('M5 5 H20 V30');
  assert.deepEqual(sub.segments[1], { op: 'L', x: 20, y: 5 });
  assert.deepEqual(sub.segments[2], { op: 'L', x: 20, y: 30 });
});

test('relative commands resolve to absolute', () => {
  const [sub] = parseSvgPath('m10 10 l5 0 l0 5');
  assert.deepEqual(sub.segments.map(s => [s.x, s.y]), [[10, 10], [15, 10], [15, 15]]);
});

test('cubic C is preserved as one C segment', () => {
  const [sub] = parseSvgPath('M0 0 C1 2 3 4 5 6');
  assert.deepEqual(sub.segments[1], { op: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 });
});

test('quadratic Q is normalized to cubic', () => {
  const [sub] = parseSvgPath('M0 0 Q3 0 6 0');
  assert.equal(sub.segments[1].op, 'C');
  // control points are 2/3 toward the quad control from each end
  assert.ok(Math.abs(sub.segments[1].x1 - 2) < 1e-9);
  assert.ok(Math.abs(sub.segments[1].x2 - 4) < 1e-9);
});

test('multiple subpaths (holed glyph) yield multiple entries', () => {
  const sp = parseSvgPath('M0 0 L10 0 L10 10 Z M2 2 L4 2 L4 4 Z');
  assert.equal(sp.length, 2);
  assert.ok(sp.every(s => s.closed));
});

test('Z returns current point to subpath start (relative-after-close)', () => {
  // After Z the pen is back at the subpath start (0,0); the relative m is from there.
  const sp = parseSvgPath('M0 0 L10 0 Z m5 5 l1 0');
  assert.equal(sp.length, 2);
  assert.deepEqual(sp[1].segments[0], { op: 'M', x: 5, y: 5 });
});

test('arc A decomposes into cubic segments', () => {
  const [sub] = parseSvgPath('M0 0 A5 5 0 0 1 10 0');
  assert.ok(sub.segments.length >= 2);
  assert.ok(sub.segments.slice(1).every(s => s.op === 'C'));
  // endpoint of the arc is reached
  const last = sub.segments[sub.segments.length - 1];
  assert.ok(Math.abs(last.x - 10) < 1e-6 && Math.abs(last.y - 0) < 1e-6);
});

test('svgArcToBeziers: degenerate (same point) → empty', () => {
  assert.deepEqual(svgArcToBeziers(0, 0, 5, 5, 0, 0, 1, 0, 0), []);
});

test('empty / lone-move subpaths are dropped', () => {
  assert.deepEqual(parseSvgPath('M5 5'), []);   // a move with no geometry contributes nothing
  assert.deepEqual(parseSvgPath(''), []);
});
