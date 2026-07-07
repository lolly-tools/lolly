/**
 * Contract tests for the DOM-free CSS box / border-radius geometry that the
 * export walkers (SVG + PDF) share. The crux is the CSS §5.5 corner-overlap rule:
 * a huge border-radius must render as a pill (rx==ry==min(w,h)/2), not an ellipse.
 * Run with: node --test tests/css-box.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCssLength, cornerRadii, uniformRadius, insetCorners, roundedRectPath, parseBoxShadow,
} from '../engine/src/css-box.ts';
import type { CornerInputs, CornerRadii } from '../engine/src/css-box.ts';

const close = (a: number, b: number, eps = 1e-3): boolean => Math.abs(a - b) <= eps;
const corners = (v: string): CornerInputs => ({ topLeft: v, topRight: v, bottomRight: v, bottomLeft: v });

test('parseCssLength: px, %, junk, math functions', () => {
  assert.equal(parseCssLength('10px', 200), 10);
  assert.equal(parseCssLength('0'), 0);
  assert.equal(parseCssLength('50%', 300), 150);
  assert.equal(parseCssLength('', 100), 0);
  assert.equal(parseCssLength(null, 100), 0);
  // calc/min/max/clamp can't be resolved here → deterministic 0, never NaN
  assert.equal(parseCssLength('calc(5% + 10px)', 200), 0);
  assert.equal(parseCssLength('max(10px, 5%)', 200), 0);
});

test('cornerRadii: huge uniform radius collapses to a pill (rx==ry==min(w,h)/2)', () => {
  const r = cornerRadii(corners('999px'), 300, 80);
  for (const k of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const) {
    assert.ok(close(r[k][0], 40), `${k} rx`);   // min(w,h)/2 = 40
    assert.ok(close(r[k][1], 40), `${k} ry`);
  }
  assert.deepEqual(uniformRadius(r)!.map(Math.round), [40, 40]);
});

test('cornerRadii: 50% stays an ellipse on a non-square box, a circle on a square one', () => {
  const ell = cornerRadii(corners('50%'), 300, 80);
  assert.ok(close(ell.topLeft[0], 150) && close(ell.topLeft[1], 40)); // rx=w/2, ry=h/2
  assert.deepEqual(uniformRadius(ell)!.map(Math.round), [150, 40]);

  const circ = cornerRadii(corners('50%'), 200, 200);
  assert.deepEqual(uniformRadius(circ)!.map(Math.round), [100, 100]);
});

test('cornerRadii: small radius is unscaled (f = 1)', () => {
  const r = cornerRadii(corners('20px'), 300, 80);
  assert.deepEqual(uniformRadius(r), [20, 20]);
});

test('cornerRadii: radius bigger than half-height but smaller than half-width → pill, not ellipse', () => {
  // The vertical edge constraint pulls BOTH axes down to 40, so it is a stadium.
  const r = cornerRadii(corners('200px'), 300, 80);
  assert.deepEqual(uniformRadius(r)!.map(Math.round), [40, 40]);
});

test('cornerRadii: top-only rounding keeps the bottom corners square (4 distinct corners)', () => {
  const r = cornerRadii(
    { topLeft: '12px', topRight: '12px', bottomRight: '0px', bottomLeft: '0px' },
    200, 60,
  );
  // No overlap (12+12 ≤ 200, ≤ 60) so f = 1: top corners 12, bottom corners 0.
  assert.deepEqual(r.topLeft, [12, 12]);
  assert.deepEqual(r.topRight, [12, 12]);
  assert.deepEqual(r.bottomRight, [0, 0]);
  assert.deepEqual(r.bottomLeft, [0, 0]);
  assert.equal(uniformRadius(r), null, 'asymmetric corners are not uniform');
});

test('cornerRadii: asymmetric overlap scales every corner by one factor f', () => {
  // Top edge: 100 + 60 = 160 > 100 width → f = 100/160 = 0.625, applied to all.
  const r = cornerRadii(
    { topLeft: '100px', topRight: '60px', bottomRight: '0px', bottomLeft: '0px' },
    100, 400,
  );
  assert.ok(close(r.topLeft[0], 62.5) && close(r.topRight[0], 37.5));
  assert.ok(close(r.bottomRight[0], 0) && close(r.bottomLeft[0], 0));
});

test('uniformRadius: zero radius → [0,0]; equal corners → pair', () => {
  assert.deepEqual(uniformRadius(cornerRadii(corners('0'), 100, 100)), [0, 0]);
  assert.deepEqual(uniformRadius(cornerRadii(corners('8px'), 100, 100)), [8, 8]);
});

test('insetCorners: shrinks by inset, clamped to 0', () => {
  const r = { topLeft: [10, 10], topRight: [4, 4], bottomRight: [0, 0], bottomLeft: [10, 10] } as CornerRadii;
  const i = insetCorners(r, 6);
  assert.deepEqual(i.topLeft, [4, 4]);
  assert.deepEqual(i.topRight, [0, 0]);    // clamped, not -2
  assert.deepEqual(i.bottomRight, [0, 0]);
});

test('roundedRectPath: emits a closed 4-corner arc path; uniform pill is symmetric', () => {
  const r = cornerRadii(corners('999px'), 200, 60);
  const d = roundedRectPath(0, 0, 200, 60, r);
  assert.match(d, /^M/);
  assert.match(d, /Z$/);
  assert.equal((d.match(/A/g) || []).length, 4, 'four corner arcs');
  // pill radius = 30 on this box
  assert.ok(d.includes('A30,30'));
});

test('roundedRectPath: square (zero) corners emit no arcs', () => {
  const r = cornerRadii(corners('0'), 100, 50);
  const d = roundedRectPath(0, 0, 100, 50, r);
  assert.equal((d.match(/A/g) || []).length, 0);
});

test('parseBoxShadow: none / empty → []', () => {
  assert.deepEqual(parseBoxShadow('none'), []);
  assert.deepEqual(parseBoxShadow(''), []);
  assert.deepEqual(parseBoxShadow(null), []);
});

test('parseBoxShadow: single shadow (Chrome computed form, color first)', () => {
  const s = parseBoxShadow('rgba(0, 0, 0, 0.55) 0px 32px 80px 0px');
  assert.equal(s.length, 1);
  assert.deepEqual({ x: s[0]!.x, y: s[0]!.y, blur: s[0]!.blur, spread: s[0]!.spread }, { x: 0, y: 32, blur: 80, spread: 0 });
  assert.equal(s[0]!.color, 'rgba(0, 0, 0, 0.55)');
});

test('parseBoxShadow: multiple shadows, commas inside rgba() are not separators', () => {
  const s = parseBoxShadow('rgba(0, 0, 0, 0.55) 0px 32px 80px, rgba(0, 0, 0, 0.35) 0px 8px 24px');
  assert.equal(s.length, 2);
  assert.equal(s[1]!.y, 8);
  assert.equal(s[1]!.blur, 24);
});

test('parseBoxShadow: blur/spread optional; negative spread kept; blur clamped ≥0', () => {
  const s = parseBoxShadow('rgb(0,0,0) 4px 4px');
  assert.deepEqual({ blur: s[0]!.blur, spread: s[0]!.spread }, { blur: 0, spread: 0 });
  const sp = parseBoxShadow('rgb(0,0,0) 0px 2px 6px -2px');
  assert.equal(sp[0]!.spread, -2);
});

test('parseBoxShadow: inset shadows are skipped (not vector-expressible)', () => {
  assert.deepEqual(parseBoxShadow('rgba(0,0,0,0.5) 0px 2px 4px inset'), []);
  const mixed = parseBoxShadow('rgba(0,0,0,0.5) 0px 2px 4px, rgba(0,0,0,0.3) 0px 1px 2px inset');
  assert.equal(mixed.length, 1);
});
