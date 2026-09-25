// SPDX-License-Identifier: MPL-2.0
/**
 * The census candidate hashes (plan 274 section 3.2), on inputs small enough to
 * read: a nine by eight difference hash over grey samples, the Hamming distance
 * two of them are compared by, a path hash that ignores a drawing's position,
 * and the digit-wildcarded key a repeated line is grouped by.
 *
 * None of these decides anything on its own. Each one GENERATES candidates that
 * the census then verifies, so what is pinned here is the arithmetic, not a
 * classification.
 *
 * Run with: node --test "tests/rebrand-census-hash.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  censusHash,
  dhashFromGrey,
  digitNormalise,
  hammingDistance,
  pathHash,
} from '../engine/src/deck-census-hash.ts';

/** A nine by eight grey field built from a per-cell function. */
function field(f: (x: number, y: number) => number): number[] {
  const out: number[] = [];
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 9; x += 1) out.push(f(x, y));
  return out;
}

test('a dHash writes 16 hex characters, one bit per adjacent pair', () => {
  const rising = dhashFromGrey(9, 8, field((x) => x * 20));
  assert.equal(rising.length, 16);
  assert.equal(rising, '0'.repeat(16), 'every left sample is darker than the one right of it');

  const falling = dhashFromGrey(9, 8, field((x) => 200 - x * 20));
  assert.equal(falling, 'f'.repeat(16), 'every left sample is brighter than the one right of it');

  const flat = dhashFromGrey(9, 8, field(() => 128));
  assert.equal(flat, '0'.repeat(16), 'equal samples set no bit, so a flat field has no ones');
});

test('a dHash reads the picture, not its resolution', () => {
  const small = field((x, y) => (x * 17 + y * 31) % 256);
  // The same picture at twice the size: every cell repeated two by two.
  const large: number[] = [];
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 18; x += 1) {
      large.push(small[Math.floor(y / 2) * 9 + Math.floor(x / 2)] ?? 0);
    }
  }
  assert.equal(dhashFromGrey(18, 16, large), dhashFromGrey(9, 8, small));
});

test('a dHash is the same on a second run and moves when the picture moves', () => {
  const samples = field((x, y) => (x * 11 + y * 7) % 256);
  assert.equal(dhashFromGrey(9, 8, samples), dhashFromGrey(9, 8, samples));
  const flipped = field((x, y) => (((8 - x) * 11 + y * 7) % 256));
  assert.notEqual(dhashFromGrey(9, 8, samples), dhashFromGrey(9, 8, flipped));
  assert.equal(dhashFromGrey(9, 8, Uint8Array.from(samples)), dhashFromGrey(9, 8, samples));
});

test('a dHash refuses input it cannot read rather than guessing', () => {
  assert.throws(() => dhashFromGrey(0, 8, [1, 2, 3]), RangeError);
  assert.throws(() => dhashFromGrey(9, 8, [1, 2, 3]), RangeError);
  assert.throws(() => dhashFromGrey(2.5, 8, new Uint8Array(100)), RangeError);
});

test('hamming distance counts the bits two hashes differ by', () => {
  assert.equal(hammingDistance('0'.repeat(16), '0'.repeat(16)), 0);
  assert.equal(hammingDistance('0'.repeat(16), 'f'.repeat(16)), 64);
  assert.equal(hammingDistance('0000000000000000', '0000000000000001'), 1);
  assert.equal(hammingDistance('0000000000000000', '0000000000000007'), 3);
  assert.throws(() => hammingDistance('00', '000'), RangeError);
  assert.throws(() => hammingDistance('zz', '00'), RangeError);
});

test('a path hash ignores a drawing position and rounds to its tolerance', () => {
  const origin = 'M0 0 L10 0 L10 10 Z';
  const moved = 'M100 50 L110 50 L110 60 Z';
  assert.equal(pathHash(moved), pathHash(origin), 'a translated copy is the same drawing');

  const wider = 'M0 0 L20 0 L20 10 Z';
  assert.notEqual(pathHash(wider), pathHash(origin), 'a different shape is a different hash');

  const nudged = 'M0 0 L10.2 0 L10.2 10 Z';
  assert.equal(pathHash(nudged, 0.5), pathHash(origin, 0.5), 'a fifth of a unit is under the default tolerance');
  assert.notEqual(pathHash(nudged, 0.01), pathHash(origin, 0.01), 'a tighter tolerance keeps them apart');
});

test('a path hash reads a whole svg document the same way as bare path data', () => {
  const data = 'M4 4 L24 4 L24 24 Z';
  const svg = `<svg viewBox="0 0 40 40"><path d="${data}" fill="#1F4E79"/></svg>`;
  assert.equal(pathHash(svg), pathHash(data));

  const two = '<svg><path d="M0 0 L5 0"/><path d="M0 10 L5 10"/></svg>';
  assert.notEqual(pathHash(two), pathHash('M0 0 L5 0'), 'a second subpath is more drawing, not the same one');
  assert.equal(pathHash('<svg></svg>'), null, 'a document with no geometry hashes to nothing, so it forms no family');
  assert.equal(pathHash(''), null, 'empty input is not a drawing');
});

test('a path hash reads the basic shapes, so two path-free drawings stay apart', () => {
  const rect = '<svg><rect x="10" y="20" width="64" height="64" fill="#D0021B"/></svg>';
  const circle = '<svg><circle cx="42" cy="52" r="32" fill="#1F4E79"/><text>SUSE</text></svg>';
  const rectHash = pathHash(rect);
  const circleHash = pathHash(circle);
  assert.ok(rectHash !== null && circleHash !== null, 'a rect and a circle are both geometry');
  assert.notEqual(rectHash, circleHash, 'a red square and a blue disc are not one drawing');

  const moved = '<svg><rect x="910" y="620" width="64" height="64" fill="#D0021B"/></svg>';
  assert.equal(pathHash(moved), rectHash, 'the same rect somewhere else is the same drawing');

  const wider = '<svg><rect x="10" y="20" width="128" height="64"/></svg>';
  assert.notEqual(pathHash(wider), rectHash, 'a different size is a different drawing');

  const poly = '<svg><polygon points="0,0 10,0 5,8"/></svg>';
  const line = '<svg><line x1="0" y1="0" x2="10" y2="8"/></svg>';
  assert.ok(pathHash(poly) !== null && pathHash(line) !== null);
  assert.notEqual(pathHash(poly), pathHash(line));

  const ellipse = '<svg><ellipse cx="42" cy="52" rx="32" ry="32"/></svg>';
  assert.notEqual(pathHash(ellipse), circleHash, 'an ellipse states its geometry differently from a circle');
});

test('digit normalisation wildcards numbers and settles whitespace', () => {
  assert.equal(digitNormalise('Source: report 2021'), 'source: report #');
  assert.equal(digitNormalise('Source: report 2021'), digitNormalise('Source: report 2023'));
  assert.notEqual(digitNormalise('Source: report 2021'), digitNormalise('Source: notes 2021'));
  assert.equal(digitNormalise('  Key:   EU,  US  '), 'key: eu, us');
  assert.equal(digitNormalise('7'), '#');
  assert.equal(digitNormalise(''), '');
});

test('the census hash is 16 hex characters and the same on a second run', () => {
  const first = censusHash('media:user/media/abc');
  assert.match(first, /^[0-9a-f]{16}$/);
  assert.equal(first, censusHash('media:user/media/abc'));
  assert.notEqual(first, censusHash('media:user/media/abd'));
  assert.notEqual(censusHash('ab'), censusHash('ba'), 'the backward pass separates a swap');
});
