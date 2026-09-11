// SPDX-License-Identifier: MPL-2.0
/**
 * The writing view's pure pieces: the word count and the listening estimate.
 * The rest is element wiring over host.speech (shared plumbing already covered
 * by script-audio.test.ts), verified in a real browser.
 *
 * The module imports its stylesheets (a Vite-only construct), so the run relies
 * on the stylesheet-import stub the `test` script registers (tests/css-stub.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countWords, estimateListenSeconds, formatListenEstimate, LISTEN_WPM } from './script-studio.ts';

test('countWords counts whitespace-separated runs, nothing fancier', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   \n\t '), 0);
  assert.equal(countWords('one'), 1);
  assert.equal(countWords('Hello there.\nAcross two lines, six words.'), 7);
  assert.equal(countWords('  padded   runs\n\ncount once  '), 4);
});

test('estimateListenSeconds is the honest wpm math', () => {
  assert.equal(estimateListenSeconds(0), 0);
  // 150 words at 150 wpm is exactly a minute.
  assert.equal(estimateListenSeconds(LISTEN_WPM), 60);
  // Faster speech shortens the estimate proportionally.
  assert.equal(estimateListenSeconds(LISTEN_WPM, 1.2), 50);
  assert.equal(estimateListenSeconds(LISTEN_WPM, 0.8), 75);
  // A degenerate speed multiplier falls back to the natural pace, never Infinity.
  assert.equal(estimateListenSeconds(LISTEN_WPM, 0), 60);
  assert.equal(estimateListenSeconds(LISTEN_WPM, -1), 60);
});

test('formatListenEstimate picks the right whole-sentence shape', () => {
  // Sub-minute: seconds only. Never claims zero - the floor is one second.
  assert.equal(formatListenEstimate(0), 'About 1 sec to listen, an estimate');
  assert.equal(formatListenEstimate(42), 'About 42 sec to listen, an estimate');
  // Exact minutes drop the seconds clause entirely.
  assert.equal(formatListenEstimate(120), 'About 2 min to listen, an estimate');
  // Mixed: both units, with rounding to the nearest second.
  assert.equal(formatListenEstimate(89.6), 'About 1 min 30 sec to listen, an estimate');
});

// ── Voice blending: the rail's three controls ↔ one recipe string (plans/181) ──
import {
  blendVoiceString, readBlendSetting, crossAccentOf, wordRangeAt, applyChip,
  BLEND_DEFAULT_PCT, BLEND_MIN_PCT, BLEND_MAX_PCT,
} from './script-studio.ts';
import { prosodyChips } from '../lib/prosody-chips.ts';

test('blendVoiceString writes the engine grammar, or a bare id when there is no blend', () => {
  assert.equal(blendVoiceString('bf_lily', '', 30), 'bf_lily');
  assert.equal(blendVoiceString('bf_lily', 'af_heart', 30), 'bf_lily+af_heart:0.3');
  // A partner that IS the lead voice is not a blend, it is the voice twice.
  assert.equal(blendVoiceString('bf_lily', 'bf_lily', 30), 'bf_lily');
  // No lead voice yet (the list has not loaded) writes nothing rather than a
  // setting the engine would refuse.
  assert.equal(blendVoiceString('', 'af_heart', 30), '');
  // The share is clamped to a mix a listener can actually hear on both sides.
  assert.equal(blendVoiceString('bf_lily', 'af_heart', 0), `bf_lily+af_heart:${BLEND_MIN_PCT / 100}`);
  assert.equal(blendVoiceString('bf_lily', 'af_heart', 140), `bf_lily+af_heart:${BLEND_MAX_PCT / 100}`);
  assert.equal(blendVoiceString('bf_lily', 'af_heart', Number.NaN), `bf_lily+af_heart:${BLEND_DEFAULT_PCT / 100}`);
});

test('readBlendSetting round-trips what blendVoiceString wrote', () => {
  assert.deepEqual(readBlendSetting('bf_lily'), { primary: 'bf_lily', partner: '', partnerPct: BLEND_DEFAULT_PCT });
  assert.deepEqual(readBlendSetting('bf_lily+af_heart:0.3'), { primary: 'bf_lily', partner: 'af_heart', partnerPct: 30 });
  // Weights that do not name a share split the remainder, exactly as the engine
  // reads them - a 50/50 blend comes back as 50.
  assert.deepEqual(readBlendSetting('bf_lily+af_heart'), { primary: 'bf_lily', partner: 'af_heart', partnerPct: 50 });
  // A hand-typed link with an unknown voice leaves the rail empty rather than
  // throwing the mount.
  assert.deepEqual(readBlendSetting('not_a_voice'), { primary: '', partner: '', partnerPct: BLEND_DEFAULT_PCT });
  assert.deepEqual(readBlendSetting(''), { primary: '', partner: '', partnerPct: BLEND_DEFAULT_PCT });
});

test('crossAccentOf names the heaviest voice accent, and only when it is a surprise', () => {
  // Two British voices agree, so there is nothing to say.
  assert.equal(crossAccentOf('bf_lily+bm_george:0.3'), null);
  assert.equal(crossAccentOf('bf_lily'), null);
  // Crossing accents: the heavier component decides, ties to the first listed.
  assert.equal(crossAccentOf('bf_lily+af_heart:0.3'), 'b');
  assert.equal(crossAccentOf('bf_lily+af_heart:0.7'), 'a');
  assert.equal(crossAccentOf('af_heart+bf_lily'), 'a');
  assert.equal(crossAccentOf('nonsense+bf_lily'), null);
});

// ── The chip bar over a plain textarea ───────────────────────────────────────

test('wordRangeAt finds the word the caret means', () => {
  // A selection is taken as given.
  assert.deepEqual(wordRangeAt('hello world', 6, 11), [6, 11]);
  // Caret at the end of a word, and inside one.
  assert.deepEqual(wordRangeAt('hello', 5, 5), [0, 5]);
  assert.deepEqual(wordRangeAt('hello world', 8, 8), [6, 11]);
  // Caret in whitespace reaches back to the word just typed.
  assert.deepEqual(wordRangeAt('hello ', 6, 6), [0, 5]);
  assert.deepEqual(wordRangeAt('hello  world', 6, 6), [0, 5]);
  // Nothing to reach: an empty script, or only whitespace behind the caret.
  assert.deepEqual(wordRangeAt('', 0, 0), [0, 0]);
  assert.deepEqual(wordRangeAt('  ', 2, 2), [2, 2]);
});

const chip = (id: string) => prosodyChips().find(c => c.id === id)!;

test('applyChip inserts a mark at the caret and says where the caret lands', () => {
  const bang = applyChip('That worked', 11, 11, chip('bang'));
  assert.deepEqual(bang, { value: 'That worked!', caret: 12 });
  // A selection is replaced, not pushed aside.
  const comma = applyChip('one XX two', 4, 7, chip('comma'));
  assert.equal(comma.value, 'one , two');
  assert.equal(comma.caret, 6);
  // A bracket mark carries its own trailing space, so the next word is typed
  // clear of it.
  assert.equal(applyChip('', 0, 0, chip('pause')).value, '[pause] ');
});

test('"Say it as…" wraps the word and parks the caret between the slashes', () => {
  const out = applyChip('Rancher ships', 7, 7, chip('say'));
  assert.equal(out.value, '[Rancher](//) ships');
  assert.equal(out.value.slice(out.caret - 1, out.caret + 1), '//', 'the caret sits where the phonemes go');
  // Nothing to wrap leaves the script exactly as it was.
  const none = applyChip('   ', 3, 3, chip('say'));
  assert.deepEqual(none, { value: '   ', caret: 3 });
});
