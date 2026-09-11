// SPDX-License-Identifier: MPL-2.0
/**
 * Intent classification (plans/103 M0). Pins that the FIRST token decides, that
 * find/make verbs route away from docs, that a question stays 'docs', and that
 * folding makes it case- and diacritic-insensitive.
 *
 * Run directly:  node --test shells/web/src/lib/ask/intent.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from './intent.ts';

test('question words and the empty query default to docs', () => {
  for (const q of ['how do I export a PNG', 'what is a brand pack', 'why is my logo blurry', '', '   ']) {
    assert.equal(classifyIntent(q), 'docs', q);
  }
});

test('find verbs lead with navigation', () => {
  for (const q of ['where is the export button', 'open the colour lab', 'show my projects', 'go to settings']) {
    assert.equal(classifyIntent(q), 'find', q);
  }
});

test('make verbs lead with tools', () => {
  for (const q of ['make a QR code', 'create a mesh gradient', 'convert a heic', 'compress a pdf', 'remove the background']) {
    assert.equal(classifyIntent(q), 'make', q);
  }
});

test('only the first token decides - "how do I export" is docs, not make', () => {
  assert.equal(classifyIntent('how do I export a transparent png'), 'docs');
  assert.equal(classifyIntent('where do I make a badge'), 'find');
});

test('classification folds case and diacritics', () => {
  assert.equal(classifyIntent('WHERE is verify'), 'find');
  assert.equal(classifyIntent('Créate a palette'), 'make'); // fold: créate→create
});
