// SPDX-License-Identifier: MPL-2.0
/**
 * The Cover Flow's opening cover: the one whose posed hue is nearest the reader's
 * accent, measured around the hue circle (359° and 1° are neighbours, not
 * opposites). Pure function, so no DOM here - mountCoverFlow's wiring is verified
 * in the browser, this pins the maths the landing's first impression rides on.
 *
 * Run directly:
 *   node --test "shells/web/src/lib/covers-flow.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestCoverIndex, loopShift, realIndexOf } from './covers-flow.ts';

// The sixteen posed hues, 22.5° apart (scripts/build-covers.ts POSES / docs/site/covers.json).
const HUES = Array.from({ length: 16 }, (_, i) => i * 22.5);

test('an exact posed hue picks its own cover', () => {
  HUES.forEach((h, i) => assert.equal(nearestCoverIndex(HUES, h), i));
});

test('a hue between two poses goes to the nearer one', () => {
  assert.equal(nearestCoverIndex(HUES, 150), 7);    // 157.5 (Design) beats 135 (Deck)
  assert.equal(nearestCoverIndex(HUES, 143), 6);    // 135 beats 157.5
  assert.equal(nearestCoverIndex(HUES, 100), 4);    // 90 beats 112.5
});

test('distance wraps around the circle', () => {
  assert.equal(nearestCoverIndex(HUES, 355), 0);    // 5° from red, not 17.5° from rose
  assert.equal(nearestCoverIndex(HUES, 340), 15);   // rose at 337.5
  assert.equal(nearestCoverIndex(HUES, 720 + 45), 2); // out-of-range input still resolves
});

test('no reader hue, or no posed hues, opens on the first cover', () => {
  assert.equal(nearestCoverIndex(HUES, null), 0);
  assert.equal(nearestCoverIndex([], 120), 0);
  assert.equal(nearestCoverIndex([null, null, null], 120), 0);
});

test('covers without a hue are skipped, not treated as 0°', () => {
  // Only the third cover is posed; a red reader must not land on an un-hued first card.
  assert.equal(nearestCoverIndex([null, null, 200, null], 5), 2);
  // A mixed strip: the un-hued card never wins even when it sits where 0° would.
  assert.equal(nearestCoverIndex([null, 90, 180, 270], 3), 1);
});

test("Lolly's own green opens on the Design cover", () => {
  // Pine Green (#30ba78) is OKLCH hue 157.2°: readerHue() falls back to it for a
  // fresh visitor and for the ink-and-paper starter brand (no hue), and the
  // flagship cover is posed at 157.5° so that is where a first visit opens.
  assert.equal(nearestCoverIndex(HUES, 157.2), 7);
});

// The loop: K clones of the tail, the n real covers, K clones of the head.
test('a centred clone re-bases by one period towards its original', () => {
  const K = 10, n = 16;
  assert.equal(loopShift(K - 1, K, n), 1, 'a tail clone in front: jump forward a period');
  assert.equal(loopShift(0, K, n), 1);
  assert.equal(loopShift(K, K, n), 0, 'the first real cover: stay');
  assert.equal(loopShift(K + n - 1, K, n), 0, 'the last real cover: stay');
  assert.equal(loopShift(K + n, K, n), -1, 'a head clone after: jump back a period');
  assert.equal(loopShift(K + n + K - 1, K, n), -1);
});

test('every strip index maps to the real cover it shows', () => {
  const K = 10, n = 16;
  for (let r = 0; r < n; r++) assert.equal(realIndexOf(K + r, K, n), r);
  assert.equal(realIndexOf(K - 1, K, n), n - 1, 'the clone just before the strip is the last cover');
  assert.equal(realIndexOf(0, K, n), n - K, 'the first clone is cover n-K');
  assert.equal(realIndexOf(K + n, K, n), 0, 'the clone just after the strip is the first cover');
  assert.equal(realIndexOf(K + n + K - 1, K, n), K - 1);
});

test('a strip with fewer covers than the clone count still loops', () => {
  const n = 3, K = Math.min(n, 10);
  assert.equal(K, 3);
  assert.equal(realIndexOf(0, K, n), 0);
  assert.equal(realIndexOf(K + n + 2, K, n), 2);
  assert.equal(loopShift(2, K, n), 1);
  assert.equal(loopShift(6, K, n), -1);
});

