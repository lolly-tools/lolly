// SPDX-License-Identifier: MPL-2.0
/**
 * The prosody chip set and the Tips copy (lib/prosody-chips.ts, plans/181
 * sections 3 and 11).
 *
 * Two things are pinned here. First, the DECIDED set: the Phase 0 listening
 * matrix ruled out ALL CAPS (a measured no-op), the rising-intonation arrow
 * (read aloud as "up right arrow") and any round-bracket insertion, so a chip
 * for one of those must not reappear. Second, that every chip's text is a mark
 * the ENGINE actually understands - each insert goes through the engine's own
 * parseScriptMarks, so this module's regex can never drift away from the
 * grammar it mirrors.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/prosody-chips.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { prosodyChips, prosodyTips, sayItAs, tokenizeMarks, hasMarks } from './prosody-chips.ts';
import { parseScriptMarks, PAUSE_DEFAULT_S, SLOW_SPEED, FAST_SPEED } from '../../../../engine/src/speech-text.ts';

test('the chip set is exactly what Phase 0 decided, in order', () => {
  assert.deepEqual(prosodyChips().map((c) => c.id), [
    'bang', 'bangbang', 'bangq', 'question', 'ellipsis', 'emdash', 'comma',
    'pause', 'slow', 'fast', 'say',
  ]);
});

test('no chip inserts ALL CAPS, an arrow, or a round bracket', () => {
  for (const chip of prosodyChips()) {
    assert.equal(/[()]/.test(chip.insert), false, `${chip.id} must not insert round brackets`);
    assert.equal(/[←-⇿]/.test(chip.insert), false, `${chip.id} must not insert an arrow`);
    assert.equal(/[A-Z]{2,}/.test(chip.insert), false, `${chip.id} must not insert shouting`);
  }
});

test('every bracket chip parses as the mark the engine expects', () => {
  const marked = prosodyChips().filter((c) => c.insert.includes('['));
  assert.equal(marked.length, 3, 'pause, slow and fast');
  const pause = parseScriptMarks('[pause] Then this.');
  assert.equal(pause.sentences[0]?.gapBefore, PAUSE_DEFAULT_S);
  const slow = parseScriptMarks('[slow] Then this.');
  assert.equal(slow.sentences[0]?.speed, SLOW_SPEED);
  const fast = parseScriptMarks('[fast] Then this.');
  assert.equal(fast.sentences[0]?.speed, FAST_SPEED);
});

test('sayItAs writes the pronunciation form the engine reads back', () => {
  const parsed = parseScriptMarks(`${sayItAs('Rancher', 'ɹˈantʃɚ')} ships today.`);
  assert.equal(parsed.sentences[0]?.text, 'Rancher ships today.');
  assert.equal(parsed.sentences[0]?.pronunciations?.[0], 'ɹˈantʃɚ');
  assert.equal(parsed.stripped.includes('['), false, 'the mark never reaches the spoken text');
});

test('the Tips say ALL CAPS is a no-op and that acronyms are spelled whatever the case', () => {
  const caps = prosodyTips().find((tip) => tip.id === 'caps');
  assert.ok(caps, 'there is a line about capitals');
  assert.match(caps.text, /does nothing/i);
  assert.match(caps.text, /whatever its case/i);
  assert.equal(/louder|shout|emphas/i.test(caps.text), false, 'it must not promise emphasis');
});

test('the Tips promise no pitch rise, and every line carries an example', () => {
  const tips = prosodyTips();
  assert.ok(tips.length >= 6);
  for (const tip of tips) {
    assert.ok(tip.text.length > 0, `${tip.id} has copy`);
    assert.ok(tip.example.length > 0, `${tip.id} has an example`);
    assert.equal(/pitch|rises in pitch|rising tone/i.test(tip.text), false,
      `${tip.id} must not claim a pitch move the measurement could not resolve`);
  }
  // Short sentences pace the read; the matrix measured level as flat, so no Tip
  // may say a short sentence is louder.
  assert.equal(tips.some((tip) => /louder/i.test(tip.text)), false);
});

test('tokenizeMarks covers every character and classifies each mark', () => {
  const line = 'Ready. [pause 1.2] [slow] Then [SUSE](/sˈuːsə/) ships.';
  const toks = tokenizeMarks(line);
  assert.equal(toks.map((tok) => tok.text).join(''), line, 'the pieces rebuild the line exactly');
  assert.deepEqual(
    toks.filter((tok) => tok.kind !== 'text').map((tok) => tok.kind),
    ['pause', 'speed', 'say'],
  );
  const pause = toks.find((tok) => tok.kind === 'pause');
  assert.equal(pause?.seconds, 1.2);
  const speed = toks.find((tok) => tok.kind === 'speed');
  assert.equal(speed?.rate, 'slow');
  const say = toks.find((tok) => tok.kind === 'say');
  assert.equal(say?.word, 'SUSE');
  assert.equal(say?.ipa, 'sˈuːsə');
});

test('tokenizeMarks reads a bracketed pronunciation of the word "pause" as a pronunciation', () => {
  const toks = tokenizeMarks('[pause](/pˈɔːz/)');
  assert.equal(toks.length, 1);
  assert.equal(toks[0]?.kind, 'say');
  assert.equal(toks[0]?.word, 'pause');
});

test('a line of plain words holds no marks', () => {
  assert.equal(hasMarks('Just the words, thank you.'), false);
  assert.equal(hasMarks('Wait [pause] for it.'), true);
});
