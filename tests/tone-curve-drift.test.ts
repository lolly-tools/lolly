// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/tone-curve.ts, and the drift guard between it and Darkroom's copy.
 *
 * Darkroom evaluates user tone curves inside its hooks, and a tool cannot import
 * the engine, so `community/darkroom/hooks.js` keeps its own `parseToneCurve`,
 * `normaliseToneCurve` and `toneCurveFn`. The web sidebar's curve control draws
 * with the engine module. If the two drift, the curve a person drags is not the
 * curve the photo gets. So this file lifts Darkroom's functions out of the hook
 * source the way the runtime compiles a hook (the tests/grade-drift.test.ts
 * technique) and checks both agree on a fixed corpus: the same points from the
 * same text, and the same output level at every input level, exactly.
 *
 * A failure here means one copy moved. Fix whichever one is wrong; do not relax
 * the comparison.
 *
 * Run with: node --test tests/tone-curve-drift.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TONE_CURVE_MAX_POINTS,
  formatToneCurve,
  isIdentityToneCurve,
  normaliseToneCurve,
  parseToneCurve,
  toneCurveEvaluator,
  type ToneCurvePoint,
} from '../engine/src/tone-curve.ts';

type Pts = Array<[number, number]>;
const darkroom = (() => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'community', 'darkroom', 'hooks.js'),
    'utf8',
  );
  return new Function('host', `${src}\nreturn { parseToneCurve, normaliseToneCurve, toneCurveFn, isIdentityToneCurve };`)({}) as {
    parseToneCurve: (text: unknown) => Pts;
    normaliseToneCurve: (points: Pts) => Pts;
    toneCurveFn: (points: Pts) => (x: number) => number;
    isIdentityToneCurve: (points: Pts) => boolean;
  };
})();

const CORPUS: unknown[] = [
  '', '   ', null, undefined, 42,
  '0-0_255-255',
  '0-0_64-48_192-208_255-255',
  '0-255_255-0',
  '64-0_255-255',
  '0-0_128-200_255-128',
  '0-30_60-40_120-200_200-190_255-240',
  '0,0 64,48 192,208 255,255',
  '0, 0; 64 ,48 ; 255,255',
  '0:0~128:64~255:255',
  '[[0,0],[100,40],[255,255]]',
  '[[0,0],[100,"x"],[255,255]]',
  '[not json',
  '10-10_10-200_255-255',
  '300,-20 -5,400 128,128',
  '0-0_12.6-40.4_255-255',
  '0-0',
  '0_0~64_48~255_255',
  'junk_more_junk',
  '5--3_7-',
  Array.from({ length: 30 }, (_, i) => `${i * 8}-${255 - i * 8}`).join('_'),
];

test('drift: Darkroom parses every corpus entry to the same points as the engine', () => {
  for (const text of CORPUS) {
    assert.deepEqual(darkroom.parseToneCurve(text), parseToneCurve(text), `text ${JSON.stringify(text)}`);
    const pts = parseToneCurve(text);
    assert.equal(darkroom.isIdentityToneCurve(pts as Pts), isIdentityToneCurve(pts), `identity ${JSON.stringify(text)}`);
  }
});

test('drift: Darkroom evaluates every corpus curve to exactly the engine\'s levels', () => {
  for (const text of CORPUS) {
    const pts = parseToneCurve(text);
    const engine = toneCurveEvaluator(pts);
    const tool = darkroom.toneCurveFn(pts as Pts);
    for (let x = -10; x <= 265; x += 0.5) {
      assert.equal(tool(x), engine(x), `text ${JSON.stringify(text)} at ${x}`);
    }
  }
});

test('reader: the canonical form, typed forms and JSON all read to the same points', () => {
  const want: ToneCurvePoint[] = [[0, 0], [64, 48], [192, 208], [255, 255]];
  assert.deepEqual(parseToneCurve('0-0_64-48_192-208_255-255'), want);
  assert.deepEqual(parseToneCurve('0,0 64,48 192,208 255,255'), want);
  assert.deepEqual(parseToneCurve('0, 0; 64, 48; 192, 208; 255, 255'), want);
  assert.deepEqual(parseToneCurve('[[0,0],[64,48],[192,208],[255,255]]'), want);
});

test('reader: empty, unreadable and one-point values are the straight line', () => {
  for (const v of ['', 'junk', '[nope', '0-0', null, 7]) {
    assert.deepEqual(parseToneCurve(v), [[0, 0], [255, 255]], String(v));
    assert.ok(isIdentityToneCurve(parseToneCurve(v)));
  }
});

test('normalise: rounds, clamps, sorts, keeps the first point at a level, caps the count', () => {
  assert.deepEqual(normaliseToneCurve([[300, -20], [-5, 400], [128.4, 127.6]]), [[0, 255], [128, 128], [255, 0]]);
  assert.deepEqual(normaliseToneCurve([[10, 10], [10, 200], [255, 255]]), [[10, 10], [255, 255]]);
  const many = Array.from({ length: 30 }, (_, i) => [i * 8, i * 8] as [number, number]);
  assert.equal(normaliseToneCurve(many).length, TONE_CURVE_MAX_POINTS);
});

test('format: canonical, round-trips, and the identity is the empty string', () => {
  assert.equal(formatToneCurve([[0, 0], [255, 255]]), '');
  assert.equal(formatToneCurve([[255, 255], [0, 0], [64, 48]]), '0-0_64-48_255-255');
  for (const text of CORPUS) {
    const once = formatToneCurve(parseToneCurve(text));
    assert.equal(formatToneCurve(parseToneCurve(once)), once);
    assert.match(once, /^$|^(\d{1,3}-\d{1,3})(_\d{1,3}-\d{1,3})+$/);
    assert.equal(new URLSearchParams({ c: once }).toString(), `c=${once}`, 'a URL query keeps the canonical form unescaped');
  }
});

test('evaluator: passes through every point, flat outside the ends, clamped to 0..255', () => {
  const pts = parseToneCurve('64-20_128-200_200-210_240-250');
  const f = toneCurveEvaluator(pts);
  for (const [x, y] of pts) assert.ok(Math.abs(f(x) - y) < 1e-9, `${x} -> ${f(x)}`);
  assert.equal(f(0), 20);
  assert.equal(f(-50), 20);
  assert.equal(f(255), 250);
  assert.equal(f(999), 250);
  const wild = toneCurveEvaluator(parseToneCurve('0-0_20-255_40-0_255-255'));
  for (let x = 0; x <= 255; x++) { const y = wild(x); assert.ok(y >= 0 && y <= 255, `${x} -> ${y}`); }
});

test('evaluator: a rising set of points gives a curve that never dips', () => {
  const f = toneCurveEvaluator(parseToneCurve('0-0_40-10_60-120_200-130_255-255'));
  let prev = -1;
  for (let x = 0; x <= 255; x += 0.25) { const y = f(x); assert.ok(y >= prev - 1e-9, `dip at ${x}`); prev = y; }
});
