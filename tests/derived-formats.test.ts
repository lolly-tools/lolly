// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandDerivedFormats } from '../engine/src/derived-formats.ts';

test('derived-formats: each parent yields its child', () => {
  assert.deepEqual(expandDerivedFormats(['svg']), ['svg', 'svgz']);
  assert.deepEqual(expandDerivedFormats(['emf']), ['emf', 'wmf']);
  assert.deepEqual(expandDerivedFormats(['png']), ['png', 'bmp']);
  assert.deepEqual(expandDerivedFormats(['tiff']), ['tiff', 'bmp']);
});

test('derived-formats: a tool with several parents gains every child, in order', () => {
  // qr-code's real list: svg + emf + png are all parents; svgz, wmf, bmp appended.
  const got = expandDerivedFormats(['svg', 'emf', 'eps', 'dxf', 'pdf', 'tiff', 'png', 'jpeg']);
  assert.deepEqual(got, ['svg', 'emf', 'eps', 'dxf', 'pdf', 'tiff', 'png', 'jpeg', 'svgz', 'wmf', 'bmp']);
});

test('derived-formats: png OR tiff is enough for bmp, and it is added only once', () => {
  assert.deepEqual(expandDerivedFormats(['png', 'tiff']), ['png', 'tiff', 'bmp']);
});

test('derived-formats: no parent → no child', () => {
  assert.deepEqual(expandDerivedFormats(['pdf', 'json', 'csv']), ['pdf', 'json', 'csv']);
  assert.deepEqual(expandDerivedFormats([]), []);
});

test('derived-formats: an already-declared child is not duplicated', () => {
  assert.deepEqual(expandDerivedFormats(['svg', 'svgz']), ['svg', 'svgz']);
  assert.deepEqual(expandDerivedFormats(['png', 'bmp', 'tiff']), ['png', 'bmp', 'tiff']);
});

test('derived-formats: idempotent — expanding twice is a no-op', () => {
  const once = expandDerivedFormats(['svg', 'emf', 'png']);
  assert.deepEqual(expandDerivedFormats(once), once);
});

test('derived-formats: input array is not mutated', () => {
  const input = ['svg'];
  const out = expandDerivedFormats(input);
  assert.deepEqual(input, ['svg'], 'original untouched');
  assert.notEqual(out, input, 'returns a new array');
});
