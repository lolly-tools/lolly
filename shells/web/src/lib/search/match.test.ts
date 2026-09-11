// SPDX-License-Identifier: MPL-2.0
/**
 * The shared search matcher (plans/99 M0) - folding, tokenizing and scoring.
 *
 * Run directly:  node --test shells/web/src/lib/search/match.test.ts
 *
 * Pure string maths, no DOM. What these tests pin, per the module contract:
 * fold is the single normalization (diacritics, combining marks, ß) and is
 * idempotent; scoreHaystack is AND-across-tokens (one missed token zeroes the
 * item), sums each token's best field weight, and doubles a word-boundary
 * prefix hit; CJK matches as a plain substring (no segmentation, deliberate).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, tokenize, scoreHaystack, SEARCH_DEBOUNCE_MS } from './match.ts';

test('fold: lowercases and strips Latin diacritics', () => {
  assert.equal(fold('Café'), 'cafe');
  assert.equal(fold('ÀÉÎÕÜ'), 'aeiou');
  assert.equal(fold('Señor Curaçao'), 'senor curacao');
});

test('fold: strips combining marks whether precomposed or decomposed', () => {
  assert.equal(fold('é'), 'e');           // e + COMBINING ACUTE
  assert.equal(fold('é'), 'e');            // precomposed é
  assert.equal(fold(fold('Crème Brûlée')), fold('Crème Brûlée')); // idempotent
});

test('fold: ß folds to ss', () => {
  assert.equal(fold('Straße'), 'strasse');
});

test('fold: leaves CJK and Arabic base letters intact (strips harakat)', () => {
  assert.equal(fold('颜色工具'), '颜色工具');
  assert.equal(fold('كَتَبَ'), 'كتب'); // fatha marks are \p{M}
});

test('tokenize: folds, splits on whitespace, drops empties', () => {
  assert.deepEqual(tokenize('  Hello   Wörld  '), ['hello', 'world']);
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize('   '), []);
});

const FIELDS = [
  { text: 'compress pdf', weight: 3 },       // e.g. name
  { text: 'shrink a pdf on-device', weight: 1 }, // e.g. description
];

test('scoreHaystack: AND semantics - every token must hit, else 0', () => {
  assert.ok(scoreHaystack(FIELDS, tokenize('compress pdf')) > 0);
  assert.equal(scoreHaystack(FIELDS, tokenize('compress svg')), 0);
});

test('scoreHaystack: empty token list scores 0 (empty query never ranks)', () => {
  assert.equal(scoreHaystack(FIELDS, []), 0);
});

test('scoreHaystack: a heavier field outranks a lighter one for the same token', () => {
  const nameHit = scoreHaystack([{ text: 'chart creator', weight: 3 }], tokenize('chart'));
  const descHit = scoreHaystack([{ text: 'draws a chart', weight: 1 }], tokenize('chart'));
  assert.ok(nameHit > descHit);
});

test('scoreHaystack: word-boundary prefix doubles; mid-word substring does not', () => {
  const boundary = scoreHaystack([{ text: 'compress pdf', weight: 1 }], ['com']);
  const midWord = scoreHaystack([{ text: 'decompress', weight: 1 }], ['com']);
  assert.equal(boundary, 2);
  assert.equal(midWord, 1);
  // Boundary is any word start, not just the string start.
  assert.equal(scoreHaystack([{ text: 'take a pdf apart', weight: 1 }], ['pdf']), 2);
});

test('scoreHaystack: per-token best field wins; score sums across tokens', () => {
  // 'compress' hits the name at a boundary (3×2); 'device' hits only the
  // description, mid-hyphen counts as a boundary ('-' is not a word char) (1×2).
  assert.equal(scoreHaystack(FIELDS, tokenize('compress device')), 8);
});

test('scoreHaystack: CJK substring matches without segmentation', () => {
  assert.ok(scoreHaystack([{ text: '颜色工具', weight: 1 }], ['色工']) > 0);
});

test('the shared debounce is the documented 120ms', () => {
  assert.equal(SEARCH_DEBOUNCE_MS, 120);
});
