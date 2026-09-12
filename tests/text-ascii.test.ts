// SPDX-License-Identifier: MPL-2.0
/**
 * Pins textAscii: the small original bitmap-alphabet ASCII-banner renderer.
 * Covers the documented output shape (plain ASCII, 7-row glyphs joined by
 * blank lines between input lines), and the boundary conditions the module's
 * own guards name - the 300-char cap, the ASCII-only alphabet, unsupported
 * characters, the single-visible-character ink requirement, and the width
 * cap that throws rather than silently truncating a caller's banner.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textAscii } from '../engine/src/text-ascii.ts';

test('renders a single letter as 7 rows using the default ink character', () => {
  const out = textAscii('A');
  const rows = out.split('\n');
  assert.equal(rows.length, 7);
  assert.ok(rows.every((r) => /^[# ]*$/.test(r)), 'unexpected characters in output');
  assert.ok(out.includes('#'));
});

test('multiple input lines are joined by a blank line between blocks', () => {
  const out = textAscii('A\nB');
  const blocks = out.split('\n\n');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.split('\n').length, 7);
  assert.equal(blocks[1]!.split('\n').length, 7);
});

test('is case-insensitive: lowercase input renders the same as uppercase', () => {
  assert.equal(textAscii('a'), textAscii('A'));
});

test('rejects text over 300 characters', () => {
  assert.throws(() => textAscii('A'.repeat(301)), /300 characters/);
  assert.doesNotThrow(() => textAscii('A'.repeat(300)));
});

test('rejects characters outside the supported ASCII alphabet', () => {
  // '@' is within the printable-ASCII range the module accepts in principle,
  // but has no glyph, so it takes the "no lettering for" path specifically.
  assert.throws(() => textAscii('A@'), /no lettering for/);
  assert.throws(() => textAscii('café'), /ASCII letters/);
  assert.throws(() => textAscii('emoji \u{1F600}'), /ASCII letters/);
});

test('requires the ink option to be exactly one visible ASCII character', () => {
  // opts.ink || '#' means an empty string falls back to the default, not an error.
  assert.throws(() => textAscii('A', { ink: '##' }), /one visible ASCII character/);
  assert.throws(() => textAscii('A', { ink: ' ' }), /one visible ASCII character/);
  assert.doesNotThrow(() => textAscii('A', { ink: '*' }));
});

test('a width narrower than the rendered banner throws instead of truncating', () => {
  assert.throws(() => textAscii('AAAA', { width: 1 }), /Increase the width/);
});

test('block style doubles glyph scale, producing wider rows than compact style', () => {
  const compact = textAscii('A').split('\n')[0]!.length;
  const block = textAscii('A', { style: 'block' }).split('\n')[0]!.length;
  assert.equal(block, compact * 2);
});
