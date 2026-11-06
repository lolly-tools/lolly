// SPDX-License-Identifier: MPL-2.0
/**
 * The live page's cheap test for text that can never need a fallback font
 * (page-fallback-watch.ts): it runs after every paint, so it has to stay linear.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlainText } from './page-fallback-watch.ts';

test('ASCII and emoji are plain; letters of other scripts and typography are not', () => {
  for (const t of ['', 'Hello, world.', 'Ship it \u{1F389}', '\u{1F468}‍\u{1F469}‍\u{1F467} family', '\u{1F44D}\u{1F3FD}', '\u{1F1E6}\u{1F1FA}', '1️⃣']) {
    assert.equal(isPlainText(t), true, JSON.stringify(t));
  }
  for (const t of ['Café', '“quotes”', 'مرحبا', 'Привет', '−2']) {
    assert.equal(isPlainText(t), false, JSON.stringify(t));
  }
});

test('a long run of digits before a non-plain character answers at once', () => {
  // Digits, # and * are emoji components as well as ASCII: an alternation of the three
  // sets backtracked exponentially here and froze a chart's page before its export.
  const text = `${'0123456789#*'.repeat(400)}−`;
  const start = performance.now();
  assert.equal(isPlainText(text), false);
  assert.ok(performance.now() - start < 50, 'linear in the length of the text');
});

test('a very long canvas text, style and script included, is read without running out of stack', () => {
  // A pattern with astral emoji ranges over the whole text overflowed V8's regular
  // expression stack on the Design canvas; the loop reads any length.
  const long = `${'body { font: 16px/1.4 sans-serif; } '.repeat(60000)}\u{1F389}`;
  const start = performance.now();
  assert.equal(isPlainText(long), true);
  assert.equal(isPlainText(`${long}\u00E9`), false);
  assert.ok(performance.now() - start < 200, 'linear in the length of the text');
});
