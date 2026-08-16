// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/dash-fit.ts - manual dash entry + Illustrator-style corner-fit dashes
 * (plan 96). Two properties carry most of the weight here:
 *
 *  1. `parseDashArray` returns NUMBERS or nothing. It is the injection boundary for a
 *     free-text dash field, so the table below is deliberately hostile.
 *  2. `cornerFitDashArray` and `dashSegments` are two views of ONE solve. Every corner of
 *     a closed shape gets a dash centred on it, the array ends exactly at the path length
 *     (so the renderer never wraps the pattern), and the two views ink the same total.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDashArray, cornerFitDashArray, dashSegments,
} from '../engine/src/dash-fit.ts';

/** Sum, rounded off the last bits of float noise - every emitted entry is already 2dp,
 *  but adding four thousand of them is not exact and the assertions are about geometry. */
const sum = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) * 1e6) / 1e6;
/** Total inked length of an alternating dash array (the even indices). */
const inked = (runs: number[]): number => runs.reduce((a, v, i) => (i % 2 === 0 ? a + v : a), 0);

// ── parseDashArray: the manual-entry table ───────────────────────────────────────

test('parseDashArray: the accepted forms', () => {
  assert.deepEqual(parseDashArray('6 4'), [6, 4]);
  assert.deepEqual(parseDashArray('6,4'), [6, 4]);
  assert.deepEqual(parseDashArray('  6 ,  4  '), [6, 4], 'whitespace and commas mix');
  assert.deepEqual(parseDashArray('6, 4, 2, 4'), [6, 4, 2, 4]);
  assert.deepEqual(parseDashArray('0 4'), [0, 4], 'a zero DASH is legal (dots via round caps)');
  assert.deepEqual(parseDashArray('6 0'), [6, 0], 'a zero GAP is legal');
  assert.deepEqual(parseDashArray('.5 1.25'), [0.5, 1.25], 'a leading dot is a number');
  assert.deepEqual(parseDashArray('6 4,'), [6, 4], 'a trailing separator is ignored');
  assert.deepEqual(parseDashArray('1000 1000'), [1000, 1000], 'the bound itself is in range');
});

test('parseDashArray: an odd-length list is doubled (the SVG rule), so output is canonical', () => {
  assert.deepEqual(parseDashArray('5'), [5, 5]);
  assert.deepEqual(parseDashArray('5 3 2'), [5, 3, 2, 5, 3, 2]);
  for (const src of ['5', '5 3 2', '9 1 4 2 7']) {
    assert.equal(parseDashArray(src)!.length % 2, 0, `${src} → even length`);
  }
});

test('parseDashArray: garbage, out-of-range and overlong input all return null', () => {
  const bad = [
    '', '   ', ',', ' , ',
    'abc', '6 abc', '6px 4', '6;4', '6/4', '6..4', '6.', '#6 4',
    '-6 4', '6 -4',                                   // negative
    '1e3 4', 'Infinity 4', 'NaN 4', '0x10 4',         // not a plain decimal
    '1001 4', '6 100000',                             // over the 1000 bound
    '0 0', '0', '0,0,0,0',                            // no ink at all
    '1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1',              // 17 entries
    `6 ${'4'.repeat(300)}`,                           // longer than the scan bound
    'expression(alert(1))', '6 4"onload=x',           // the reason this returns numbers
  ];
  for (const s of bad) assert.equal(parseDashArray(s), null, JSON.stringify(s));
  assert.equal(parseDashArray(undefined as unknown as string), null);
  assert.equal(parseDashArray(42 as unknown as string), null);
});

test('parseDashArray: 16 entries pass, 17 do not (the entry bound)', () => {
  const sixteen = Array.from({ length: 16 }, () => '3').join(' ');
  assert.equal(parseDashArray(sixteen)!.length, 16);
  assert.equal(parseDashArray(`${sixteen} 3`), null);
});

// ── the corner fit: a square ─────────────────────────────────────────────────────

// Four 100px spans, pattern [6,4]: cycle 10 divides 100 exactly, so the fit is s = 1 and
// the authored pattern is left ALONE - the property that says "if it already fits, don't
// touch it". Each span therefore runs 3, 4, (6, 4)×9, 3.
const SQUARE = [100, 100, 100, 100];

test('square: a span that already fits the cycle is not rescaled', () => {
  const runs = cornerFitDashArray([100], [6, 4]);
  assert.deepEqual(runs.slice(0, 6), [3, 4, 6, 4, 6, 4], 'half a dash, then whole cycles');
  assert.deepEqual(runs.slice(-2), [3, 0], 'half a dash at the end, then the even-length pad');
  assert.equal(sum(runs), 100, 'ends exactly at the span length');
});

test('square: a dash is centred on every corner', () => {
  const segs = dashSegments(SQUARE, [6, 4]);
  const mid = (s: { start: number; end: number }): number => (s.start + s.end) / 2;
  for (const corner of [100, 200, 300]) {
    const hit = segs.find((s) => s.start < corner && s.end > corner);
    assert.ok(hit, `a dash straddles the corner at ${corner}`);
    assert.equal(mid(hit!), corner, `and is CENTRED on it`);
    assert.equal(hit!.end - hit!.start, 6, 'a whole dash wide (two halves joined)');
  }
  // The closing corner is the path start: the first and last dashes are the two halves.
  assert.deepEqual(segs[0], { start: 0, end: 3 }, 'half a dash leaves the start point');
  assert.deepEqual(segs[segs.length - 1], { start: 397, end: 400 }, 'and half arrives back at it');
});

test('square: the array is even-length and ends exactly at the path length', () => {
  const runs = cornerFitDashArray(SQUARE, [6, 4]);
  assert.equal(runs.length % 2, 0, 'even, as SVG wants');
  assert.equal(sum(runs), 400, 'so the pattern never wraps back to the start');
  assert.equal(runs[0], 3, 'the leading half dash');
  assert.equal(runs[runs.length - 2], 3, 'the trailing half dash (the last entry is the pad)');
});

test('a mid-span corner dash is ONE merged entry, not two adjacent dashes', () => {
  // Two spans of 100: each is 3, 4, (6,4)×9, 3 - 21 entries - and the two 3s either side
  // of the corner merge into one 6. If the merge were missing the array would carry 3, 3
  // in a row, which SVG reads as dash-then-GAP and the corner would go bare.
  const runs = cornerFitDashArray([100, 100], [6, 4]);
  assert.equal(sum(runs.slice(0, 20)), 97, 'entry 20 starts 3 before the corner');
  assert.equal(runs[20], 6, 'the corner dash is a single full-width entry');
  assert.equal(runs.length, 42, '21 + 21 entries, merged at the corner, plus the pad');
});

// ── scaling + the clamp ──────────────────────────────────────────────────────────

test('a span that does not divide the cycle is scaled slightly, not truncated', () => {
  // 13 = 1.3 cycles → n = 1, s = 1.3: 3.9, 5.2, 3.9.
  assert.deepEqual(cornerFitDashArray([13], [6, 4]), [3.9, 5.2, 3.9, 0]);
  // 16 = 1.6 cycles → n = 2, s = 0.8: 2.4, 3.2, 4.8, 3.2, 2.4.
  assert.deepEqual(cornerFitDashArray([16], [6, 4]), [2.4, 3.2, 4.8, 3.2, 2.4, 0]);
  for (const L of [7, 13, 16, 23, 47, 99, 101, 999]) {
    assert.equal(sum(cornerFitDashArray([L], [6, 4])), L, `${L} covered exactly`);
  }
});

test('every span at least minScale × cycle long is FITTED, and inside the band', () => {
  // The whole-cycle-count rule keeps the scale in [0.75, 1.5) for any span from 0.66
  // cycles up, so the fallback is reserved for genuine stubs rather than firing on
  // ordinary geometry (which is what `round((L − dash0) / cycle)` would have done - 
  // 16 units of a 10-unit cycle would have wanted s = 1.6 and given up).
  for (let L = 7; L <= 400; L += 0.25) {
    const runs = cornerFitDashArray([L], [6, 4]);
    const s = runs[0]! / 3;                       // a fitted span opens with half a dash
    assert.ok(s >= 0.66 - 1e-9 && s <= 1.5 + 1e-9, `L=${L} scale ${s}`);
    // The same half dash closes it - to within the 2dp the positions are quantised to.
    assert.ok(Math.abs(runs[runs.length - 2]! - runs[0]!) < 0.0101, `L=${L} closes with a half dash`);
  }
});

test('a stub span falls back to the AUTHORED pattern rather than minting absurd dashes', () => {
  // 2px of a 10px cycle would need s = 0.2 - far below minScale, so no fit: the stub is
  // simply the pattern's first 2px of dash.
  assert.deepEqual(cornerFitDashArray([2], [6, 4]), [2, 0]);
  assert.deepEqual(dashSegments([2], [6, 4]), [{ start: 0, end: 2 }]);
  // 6.5px: the pattern tiled and cut - a 6 dash then half a gap, exact lengths kept.
  assert.deepEqual(cornerFitDashArray([6.5], [6, 4]), [6, 0.5]);
  // A stub between two real spans still hands the rest of the path back correctly.
  assert.equal(sum(cornerFitDashArray([100, 2, 100], [6, 4])), 202);
});

test('minScale/maxScale are honoured, and s = 1 always fits whatever is passed', () => {
  // Widen the floor and the 2px stub fits instead (n = 1, s = 0.2).
  assert.deepEqual(cornerFitDashArray([2], [6, 4], { minScale: 0.1 }), [0.6, 0.8, 0.6, 0]);
  // Drop the ceiling to 1 and a span that would need stretching falls back unscaled.
  assert.deepEqual(cornerFitDashArray([13], [6, 4], { maxScale: 1 }), [6, 4, 3, 0]);
  // Nonsense bounds are clamped, never trusted: a whole-cycle span still fits at s = 1.
  for (const opts of [{ minScale: NaN }, { maxScale: 0 }, { minScale: 99 }, { maxScale: -3 }]) {
    assert.equal(cornerFitDashArray([100], [6, 4], opts)[0], 3, JSON.stringify(opts));
  }
});

// ── degenerate input ─────────────────────────────────────────────────────────────

test('degenerate spans and patterns never throw and never wrap', () => {
  assert.deepEqual(cornerFitDashArray([], [6, 4]), [], 'no path → nothing');
  assert.deepEqual(cornerFitDashArray([0, 0], [6, 4]), [], 'zero-length path → nothing');
  assert.deepEqual(dashSegments([], [6, 4]), []);
  // A zero-length span merges its two corners rather than splitting the run.
  assert.deepEqual(cornerFitDashArray([100, 0, 100], [6, 4]), cornerFitDashArray([100, 100], [6, 4]));
  // Junk span lengths are dropped, not propagated as NaN.
  const junk = [100, NaN, -50, Infinity, 100] as number[];
  assert.deepEqual(cornerFitDashArray(junk, [6, 4]), cornerFitDashArray([100, 100], [6, 4]));
  // A pattern with no ink is a solid line, still an even-length array covering the path.
  assert.deepEqual(cornerFitDashArray([100], [0, 0]), [100, 0]);
  assert.deepEqual(cornerFitDashArray([100], []), [100, 0]);
  // An odd pattern is doubled like a parsed one; a junk entry becomes 0, keeping parity.
  assert.equal(sum(cornerFitDashArray([120], [6, 4, 2])), 120);
  assert.equal(sum(cornerFitDashArray([120], [6, NaN, 2, 4] as number[])), 120);
});

test('a sub-pixel cycle over a long path stays bounded and still covers the path', () => {
  const runs = cornerFitDashArray([100000], [0.02, 0.02]);
  assert.ok(runs.length <= 4096, `bounded (${runs.length} entries)`);
  assert.equal(runs.length % 2, 0);
  assert.equal(sum(runs), 100000, 'the uncovered tail is handed back as one gap, so no wrap');
});

// ── the two views agree ──────────────────────────────────────────────────────────

test('dashSegments and cornerFitDashArray describe the same ink', () => {
  const cases: [number[], number[]][] = [
    [SQUARE, [6, 4]],
    [[100], [6, 4]],
    [[13, 47, 6.5, 220], [9, 3, 2, 3]],
    [[2, 3, 4], [6, 4]],
    [[37.5, 37.5], [5, 5]],
  ];
  for (const [spans, pattern] of cases) {
    const runs = cornerFitDashArray(spans, pattern);
    const segs = dashSegments(spans, pattern);
    const label = `${JSON.stringify(spans)} / ${JSON.stringify(pattern)}`;
    assert.ok(Math.abs(inked(runs) - sum(segs.map((s) => s.end - s.start))) < 1e-6,
      `${label}: total inked length agrees`);
    // …and at the same places: walking the array yields the segment starts.
    const walked: number[] = [];
    let pos = 0;
    for (let i = 0; i < runs.length; i++) {
      if (i % 2 === 0 && runs[i]! > 0) walked.push(pos);
      pos = Math.round((pos + runs[i]!) * 100) / 100;
    }
    assert.deepEqual(segs.map((s) => s.start), walked, `${label}: same offsets`);
    // Segments are ordered, non-overlapping and inside the path.
    let prev = -1;
    for (const s of segs) {
      assert.ok(s.start >= prev, `${label}: ordered`);
      assert.ok(s.end > s.start, `${label}: no empty segment`);
      assert.ok(s.end <= sum(spans) + 1e-6, `${label}: inside the path`);
      prev = s.end;
    }
  }
});

test('a parsed pattern feeds the fit directly (the whole point of the numbers-only contract)', () => {
  const pattern = parseDashArray('9 3 2 3')!;
  const runs = cornerFitDashArray([120, 120], pattern);
  assert.equal(runs.length % 2, 0);
  assert.equal(sum(runs), 240);
  assert.ok(runs.every((v) => Number.isFinite(v) && v >= 0), 'every entry is a plain number');
});
