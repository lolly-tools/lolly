// SPDX-License-Identifier: MPL-2.0
/**
 * Container detection and the requested-format table - engine/src/format-sniff.ts.
 *
 * The table moved here from the Node shells so the export report and the CLI
 * output guard read one copy. These cases pin that the two stay one: the Node
 * module re-exports the engine's functions rather than keeping its own.
 *
 * Run with: node --test tests/format-sniff.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { acceptedFormats, formatAllows, sniffFormat, SNIFFED_FORMAT_LABEL } from '../engine/src/format-sniff.ts';
import * as nodeSniff from '../packages/node-shell/src/format-sniff.ts';
import { bytesOf, gif, jpeg, mp4, rgbaPng, webm, webp } from './helpers/output-fixtures.ts';

test('the Node output guard uses the engine detection, not a second copy', () => {
  assert.equal(nodeSniff.sniffFormat, sniffFormat);
  assert.equal(nodeSniff.formatAllows, formatAllows);
});

test('containers are identified from bytes', () => {
  assert.equal(sniffFormat(rgbaPng()), 'png');
  assert.equal(sniffFormat(jpeg()), 'jpg');
  assert.equal(sniffFormat(gif()), 'gif');
  assert.equal(sniffFormat(webp()), 'webp');
  assert.equal(sniffFormat(mp4()), 'mp4');
  assert.equal(sniffFormat(webm()), 'webm');
  assert.equal(sniffFormat(bytesOf('%PDF-1.7\n')), 'pdf');
  assert.equal(sniffFormat(bytesOf('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'svg');
  assert.equal(sniffFormat(bytesOf('%!PS-Adobe-3.0 EPSF-3.0\n')), 'eps');
  assert.equal(sniffFormat(bytesOf('name,value\n')), null);
});

test('a variant format checks its container; a format without a row is no opinion', () => {
  assert.deepEqual(acceptedFormats('pdf-cmyk'), ['pdf']);
  assert.deepEqual(acceptedFormats('JPEG'), ['jpg']);
  assert.equal(acceptedFormats('csv'), null);
  assert.equal(formatAllows('csv', 'png'), true);
  assert.equal(formatAllows('png', 'apng'), true);
  assert.equal(formatAllows('apng', 'png'), false);
});

test('an inherited key is not a format row', () => {
  for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    assert.equal(acceptedFormats(key), null, key);
    assert.equal(formatAllows(key, 'png'), true, key);
  }
});

test('every sniffed identity has a label', () => {
  for (const [id, label] of Object.entries(SNIFFED_FORMAT_LABEL)) assert.ok(label.length > 0, id);
});
