// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { safeFileName, allocateFileName, normalizeSha256 } from '../src/file-v1.ts';

test('output names are portable basenames without traversal or reserved devices', () => {
  assert.equal(safeFileName('../../private/file.png'), 'file.png');
  assert.equal(safeFileName('C:\\folder\\CON.txt'), '_CON.txt');
  assert.equal(safeFileName('..'), 'file');
  assert.equal(safeFileName('hello?.png  '), 'hello-.png');
  const name = safeFileName('写真'.repeat(100) + '.png');
  assert.ok(new TextEncoder().encode(name).length <= 220);
  assert.ok(name.endsWith('.png'));
});

test('equivalent Unicode filenames and generated suffixes share a namespace', () => {
  const used = new Set<string>();
  assert.equal(allocateFileName('café.png', used), 'café.png');
  assert.equal(allocateFileName('cafe\u0301.png', used), 'café-2.png');
  assert.equal(allocateFileName('café-2.png', used), 'café-2-2.png');
});

test('SHA-256 normalization agrees with Node and refuses malformed digests', () => {
  const digest = createHash('sha256').update('a source file').digest();
  assert.equal(normalizeSha256(`sha256-${digest.toString('base64')}`), digest.toString('hex'));
  assert.equal(normalizeSha256(digest.toString('hex').toUpperCase()), digest.toString('hex'));
  assert.equal(normalizeSha256('sha256-invalid'), null);
  assert.equal(normalizeSha256('f'.repeat(63)), null);
});
