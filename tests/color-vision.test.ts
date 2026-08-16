// SPDX-License-Identifier: MPL-2.0
/**
 * Machado, Oliveira & Fernandes (2009) colour-vision-deficiency simulation - 
 * contract tests for engine/src/color-vision.ts.
 *
 * Coverage:
 *   (1) Published Machado matrix entries survive verbatim - a handful of pinned
 *       cells at severity 1.0 for each type, proved by feeding pure primaries
 *       (which read off exactly one matrix column) through simulateCvd.
 *   (2) A known colour transforms to its expected simulated value at severity 1
 *       for protan / deutan / tritan.
 *   (3) Severity 0 is a bit-exact identity for every type.
 *   (4) toGrayscale uses the Rec.709 luma coefficients.
 *   (5) hex-in/hex-out wrappers.
 *
 * Run with: node --test tests/color-vision.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  simulateCvd,
  toGrayscale,
  simulateCvdHex,
  toGrayscaleHex,
} from '../engine/src/color-vision.ts';

// Pure primaries read a single matrix column, so simulateCvd on them lets us
// pin the published matrix entries exactly (modulo the *255 + round output).

test('published Machado protanopia (severity 1.0) matrix column: red', () => {
  // Row entries for the R column at protan 1.0: 0.152286, 0.114503, -0.003882.
  // red = (255,0,0): out = round(col * 1 * 255), negative clamped to 0.
  const out = simulateCvd([255, 0, 0], 'protan', 1);
  assert.deepEqual(out, [
    Math.round(0.152286 * 255), // 39
    Math.round(0.114503 * 255), // 29
    0, // -0.003882 clamped
  ]);
  assert.deepEqual(out, [39, 29, 0]);
});

test('published Machado deuteranopia (severity 1.0) matrix column: red', () => {
  // R column at deutan 1.0: 0.367322, 0.280085, -0.011820.
  const out = simulateCvd([255, 0, 0], 'deutan', 1);
  assert.deepEqual(out, [
    Math.round(0.367322 * 255), // 94
    Math.round(0.280085 * 255), // 71
    0,
  ]);
  assert.deepEqual(out, [94, 71, 0]);
});

test('published Machado tritanopia (severity 1.0) matrix column: red', () => {
  // R column at tritan 1.0: 1.255528, -0.078411, 0.004733.
  const out = simulateCvd([255, 0, 0], 'tritan', 1);
  assert.deepEqual(out, [
    255, // 1.255528 clamped to 1.0 → 255
    0, // negative clamped
    Math.round(0.004733 * 255), // 1
  ]);
  assert.deepEqual(out, [255, 0, 1]);
});

test('published Machado protanopia (severity 1.0) matrix column: green', () => {
  // G column at protan 1.0: 1.052583, 0.786281, -0.048116.
  const out = simulateCvd([0, 255, 0], 'protan', 1);
  assert.deepEqual(out, [
    255, // 1.052583 clamped
    Math.round(0.786281 * 255), // 200
    0,
  ]);
});

test('published Machado tritanopia (severity 1.0) matrix column: blue', () => {
  // B column at tritan 1.0: -0.178779, 0.147602, 0.303900.
  const out = simulateCvd([0, 0, 255], 'tritan', 1);
  assert.deepEqual(out, [
    0, // negative clamped
    Math.round(0.147602 * 255), // 38
    Math.round(0.3039 * 255), // 77
  ]);
});

test('known colour transforms to expected value at severity 1 (all three types)', () => {
  // A mid grey-ish blend, computed by hand from the pinned severity-1 matrices.
  const c: [number, number, number] = [120, 200, 80];
  const r = 120 / 255, g = 200 / 255, b = 80 / 255;

  const expect = (m: number[]): [number, number, number] => [
    Math.round(Math.max(0, Math.min(1, m[0]! * r + m[1]! * g + m[2]! * b)) * 255),
    Math.round(Math.max(0, Math.min(1, m[3]! * r + m[4]! * g + m[5]! * b)) * 255),
    Math.round(Math.max(0, Math.min(1, m[6]! * r + m[7]! * g + m[8]! * b)) * 255),
  ];

  assert.deepEqual(
    simulateCvd(c, 'protan', 1),
    expect([0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998]),
  );
  assert.deepEqual(
    simulateCvd(c, 'deutan', 1),
    expect([0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881]),
  );
  assert.deepEqual(
    simulateCvd(c, 'tritan', 1),
    expect([1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039]),
  );
});

test('severity 0 is a bit-exact identity for every type', () => {
  const samples: [number, number, number][] = [
    [0, 0, 0],
    [255, 255, 255],
    [255, 0, 0],
    [13, 200, 77],
    [128, 64, 192],
  ];
  for (const type of ['protan', 'deutan', 'tritan'] as const) {
    for (const s of samples) {
      assert.deepEqual(simulateCvd(s, type, 0), s, `${type} severity 0 identity for ${s}`);
    }
  }
});

test('interpolation between steps stays between the bracketing pinned matrices', () => {
  // At severity 0.15 the matrix is halfway between the 0.1 and 0.2 tables; the
  // simulated red should sit between the two endpoints' simulated reds.
  const at10 = simulateCvd([255, 0, 0], 'protan', 0.1);
  const at20 = simulateCvd([255, 0, 0], 'protan', 0.2);
  const at15 = simulateCvd([255, 0, 0], 'protan', 0.15);
  for (let ch = 0; ch < 3; ch++) {
    const lo = Math.min(at10[ch]!, at20[ch]!);
    const hi = Math.max(at10[ch]!, at20[ch]!);
    assert.ok(at15[ch]! >= lo - 1 && at15[ch]! <= hi + 1, `channel ${ch} interpolated in range`);
  }
});

test('toGrayscale uses Rec.709 coefficients (0.2126 / 0.7152 / 0.0722)', () => {
  assert.deepEqual(toGrayscale([255, 0, 0]), [
    Math.round(0.2126 * 255), // 54
    Math.round(0.2126 * 255),
    Math.round(0.2126 * 255),
  ]);
  assert.deepEqual(toGrayscale([0, 255, 0]), Array(3).fill(Math.round(0.7152 * 255))); // 182
  assert.deepEqual(toGrayscale([0, 0, 255]), Array(3).fill(Math.round(0.0722 * 255))); // 18
  assert.deepEqual(toGrayscale([54, 54, 54]), [54, 54, 54]); // grey → itself
  assert.deepEqual(toGrayscale([255, 255, 255]), [255, 255, 255]);
});

test('hex convenience wrappers round-trip through the numeric path', () => {
  assert.equal(simulateCvdHex('#ff0000', 'protan', 1), '#271d00'); // (39,29,0)
  assert.equal(simulateCvdHex('#ff0000', 'deutan', 1), '#5e4700'); // (94,71,0)
  assert.equal(simulateCvdHex('#ff0000', 'protan', 0), '#ff0000'); // identity
  assert.equal(toGrayscaleHex('#ff0000'), '#363636'); // (54,54,54)
  // short hex accepted, alpha dropped
  assert.equal(simulateCvdHex('#f00', 'protan', 0), '#ff0000');
  // unparseable → null
  assert.equal(simulateCvdHex('nope', 'protan', 1), null);
  assert.equal(toGrayscaleHex('nope'), null);
});
