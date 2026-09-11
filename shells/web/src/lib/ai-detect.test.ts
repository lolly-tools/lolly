// SPDX-License-Identifier: MPL-2.0
// The ai-detect facade's PURE half: the eligibility bias guard (the model is
// English-trained and over-scores non-native prose - not asking is the guard)
// and the unstaged-availability posture under node (no Worker, no model).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiDetectEligible, aiDetectAvailable, scoreAiText } from './ai-detect.ts';

const words = (n: number): string => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

test('short text is never eligible', () => {
  assert.equal(aiDetectEligible(words(49)), false);
  assert.equal(aiDetectEligible(words(50)), true);
});

test('mostly non-Latin text is never eligible, regardless of length', () => {
  const ru = 'Возобновляемая энергетика зависит от трёх практических факторов: стоимость, хранение и пропускная способность сети. '.repeat(8);
  assert.equal(aiDetectEligible(ru), false);
});

test('empty and whitespace text is never eligible', () => {
  assert.equal(aiDetectEligible(''), false);
  assert.equal(aiDetectEligible('   \n\t  '), false);
});

test('worker-less environments are unavailable and score null', async () => {
  // node has no Worker, so even with a staged model the facade must resolve
  // to "the check did not run" - never an error, never a verdict.
  assert.equal(aiDetectAvailable(), false);
  assert.equal(await scoreAiText(words(80)), null);
});
