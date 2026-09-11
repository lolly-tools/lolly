// SPDX-License-Identifier: MPL-2.0
/**
 * The Kokoro worker's per-chunk maths (plans/181 sections 4 and 6): the
 * blended style row, and a word's phonemes when the script overrode its
 * pronunciation.
 *
 * These are pinned here because the worker itself cannot be imported in Node,
 * and both are silent failures if they drift - a wrong style row is a voice
 * that does not sound like the blend anyone asked for, and a lost comma is a
 * sentence that runs on.
 *
 * Run: node --test shells/web/src/lib/tts-blend.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { blendStyleRow, phonemesForWord } from './tts-blend.ts';
import { KOKORO_STYLE_DIM, parseVoiceBlend, filterToVocab } from './speech-kokoro.ts';

/** A 510x256 matrix whose every value is recognisable: `tag + row/1000`. */
function matrix(tag: number): Float32Array {
  const rows = 4;
  const m = new Float32Array(rows * KOKORO_STYLE_DIM);
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < KOKORO_STYLE_DIM; i++) m[r * KOKORO_STYLE_DIM + i] = tag + r + i / 1000;
  }
  return m;
}

describe('blendStyleRow', () => {
  test('one voice is the plain row, value for value', () => {
    const m = matrix(10);
    const row = blendStyleRow([m], [1], 2);
    assert.equal(row.length, KOKORO_STYLE_DIM);
    for (let i = 0; i < KOKORO_STYLE_DIM; i++) {
      assert.equal(row[i], m[2 * KOKORO_STYLE_DIM + i], `value ${i} of the row changed`);
    }
  });

  test('a blend is the weighted sum of the same row of each voice', () => {
    const a = matrix(10);
    const b = matrix(100);
    const row = blendStyleRow([a, b], [0.7, 0.3], 1);
    for (let i = 0; i < KOKORO_STYLE_DIM; i++) {
      const want = 0.7 * (a[KOKORO_STYLE_DIM + i] as number) + 0.3 * (b[KOKORO_STYLE_DIM + i] as number);
      assert.ok(Math.abs((row[i] as number) - want) < 1e-4, `value ${i}: ${row[i]} vs ${want}`);
    }
  });

  test('the row is indexed by token count, and a zero weight contributes nothing', () => {
    const a = matrix(10);
    const b = matrix(100);
    for (const tokens of [0, 3]) {
      const only = blendStyleRow([a, b], [1, 0], tokens);
      for (let i = 0; i < KOKORO_STYLE_DIM; i++) {
        assert.ok(Math.abs((only[i] as number) - (a[tokens * KOKORO_STYLE_DIM + i] as number)) < 1e-4);
      }
    }
  });

  test('the weights parseVoiceBlend hands back keep a 50/50 blend halfway', () => {
    const components = parseVoiceBlend('af_heart+bf_lily');
    const a = matrix(10);
    const b = matrix(100);
    const row = blendStyleRow([a, b], components.map(c => c.w), 0);
    for (let i = 0; i < KOKORO_STYLE_DIM; i++) {
      const midpoint = ((a[i] as number) + (b[i] as number)) / 2;
      assert.ok(Math.abs((row[i] as number) - midpoint) < 1e-4, `value ${i} is not the midpoint`);
    }
  });

  test('no matrices is a silent row rather than a crash', () => {
    const row = blendStyleRow([], [], 0);
    assert.equal(row.length, KOKORO_STYLE_DIM);
    assert.ok([...row].every(v => v === 0));
  });
});

describe('phonemesForWord', () => {
  test('the override replaces the word and keeps its punctuation', () => {
    assert.equal(phonemesForWord('SUSE', 'sˈuːsə'), 'sˈuːsə');
    assert.equal(phonemesForWord('SUSE,', 'sˈuːsə'), 'sˈuːsə,');
    assert.equal(phonemesForWord('SUSE.', 'sˈuːsə'), 'sˈuːsə.');
    assert.equal(phonemesForWord('"SUSE"?', 'sˈuːsə'), '"sˈuːsə"?');
  });

  test('the result never carries a symbol the tokenizer would delete', () => {
    // A guillemet is not in the vocabulary; leaving one in costs the clip its
    // word alignment, which is the whole point of the filter.
    assert.equal(phonemesForWord('«word»', 'wˈɜːd'), 'wˈɜːd');
    assert.equal(phonemesForWord('word', 'wˈɜːd«»'), 'wˈɜːd');
    assert.equal(phonemesForWord('SUSE!', 'sˈuːsə'), filterToVocab('sˈuːsə!'));
  });

  test('a word with nothing to replace passes through as itself', () => {
    assert.equal(phonemesForWord('...', 'anything'), filterToVocab('...'));
    assert.equal(phonemesForWord('', 'anything'), '');
  });
});
