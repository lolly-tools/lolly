// SPDX-License-Identifier: MPL-2.0
/**
 * The Sound room's starting sounds (lib/sonic-music.ts): each is the study's exact recipe,
 * choosing one gives every use its settings while each use keeps its own seed and
 * balance, and a sound reads back in plain words.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/sonic-music.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import corpus from '../../../../examples/open-media/corpus.json' with { type: 'json' };
import { readSonicProfile } from '../../../../engine/src/sonic-profile.ts';
import { musicStateParams, parseMusicState } from './music-state.ts';
import {
  applySonicDirection,
  applySonicMix,
  mixCopy,
  sonicStartOf,
  directionCopy,
  musicInDirection,
  SONIC_DIRECTIONS,
  sonicDirectionOf,
  soundSummary,
  starterSonicProfile,
} from './sonic-music.ts';

test('the starting sounds are the study’s candidate expressions, recipe for recipe', () => {
  assert.deepEqual(SONIC_DIRECTIONS.map((d) => d.id), corpus.modes.map((m) => m.id));
  for (const [i, direction] of SONIC_DIRECTIONS.entries()) {
    assert.equal(direction.parameters, musicStateParams(parseMusicState(corpus.modes[i]!.music)));
    const { name, line } = directionCopy(direction);
    assert.ok(name && line, `${direction.id} has a name and a line`);
    assert.doesNotMatch(line, /seed|recipe|bed\b|intelligib/i, 'the card speaks plainly');
  }
});

test('choosing a starting sound keeps each use’s seed and balance, and returns a copy', () => {
  const profile = starterSonicProfile('sound', 'Harbour');
  const before = structuredClone(profile);
  const bright = SONIC_DIRECTIONS.find((d) => d.id === 'play')!;
  const next = applySonicDirection(profile, bright);
  assert.deepEqual(profile, before, 'the original is untouched');
  assert.ok(readSonicProfile(next), 'the result is still a valid profile');
  for (const [i, context] of next.contexts.entries()) {
    const own = parseMusicState(before.contexts[i]!.music.parameters);
    const now = parseMusicState(context.music.parameters);
    assert.equal(now.mood, 'sugar');
    assert.equal(now.lead, 'kalimba');
    assert.equal(now.seed, own.seed, `${context.id} keeps its own tune`);
    assert.deepEqual(now.mix, own.mix, `${context.id} keeps its balance`);
  }
  assert.equal(sonicDirectionOf(next)?.id, 'play');
  assert.equal(next.review.state, 'draft');
});

test('a sound edited past every starting sound is nobody’s choice any more', () => {
  const profile = applySonicDirection(starterSonicProfile('sound', 'Harbour'), SONIC_DIRECTIONS[0]!);
  assert.equal(sonicDirectionOf(profile)?.id, SONIC_DIRECTIONS[0]!.id);
  const main = profile.contexts.find((c) => c.id === profile.defaultContext)!;
  const state = parseMusicState(main.music.parameters);
  state.seed = 77;
  state.mix.drums = 0.9;
  main.music.parameters = musicStateParams(state);
  assert.equal(sonicDirectionOf(profile)?.id, SONIC_DIRECTIONS[0]!.id, 'a new tune or balance is still the same sound');
  state.mood = 'jazz';
  main.music.parameters = musicStateParams(state);
  assert.equal(sonicDirectionOf(profile), null);
  assert.equal(parseMusicState(musicInDirection(SONIC_DIRECTIONS[1]!, main.music.parameters)).seed, 77);
});

test('a sound in plain words: genre, tempo and the instruments that play', () => {
  assert.equal(soundSummary(SONIC_DIRECTIONS.find((d) => d.id === 'explain')!.parameters), 'Warm · 84 bpm · Rhodes, rolling bass, dusty kit');
  // A melody turned all the way down is not mentioned.
  assert.doesNotMatch(soundSummary('style=sugar&seed=1&lead=kalimba&mix.lead=0'), /kalimba/i);
  assert.equal(soundSummary('style=sugar&seed=1&lead=kalimba'), 'Sugar · Kalimba, drums');
  assert.match(soundSummary('style=sugar&seed=1&drums=0'), /^Sugar$/);
});

test('the mix gives each study use its own sound, keeps every tune and balance, and says it was chosen', () => {
  const start = starterSonicProfile('sound', 'Harbour');
  const added = structuredClone(start.contexts[0]!);
  added.id = 'launch';
  added.label = 'Launch';
  added.music.parameters = musicStateParams({ ...parseMusicState(SONIC_DIRECTIONS[2]!.parameters), seed: 5 });
  start.contexts.push(added);
  const bright = applySonicDirection(start, SONIC_DIRECTIONS.find((d) => d.id === 'play')!);
  assert.deepEqual(bright.startingSound, { mode: 'one', sound: 'play' });
  const mixed = applySonicMix(bright);
  assert.ok(readSonicProfile(mixed), 'still a valid profile');
  assert.deepEqual(mixed.startingSound, { mode: 'mixed' });
  for (const [i, context] of mixed.contexts.entries()) {
    const before = parseMusicState(bright.contexts[i]!.music.parameters);
    const now = parseMusicState(context.music.parameters);
    assert.equal(now.seed, before.seed, `${context.id} keeps its tune`);
    assert.deepEqual(now.mix, before.mix, `${context.id} keeps its balance`);
    const own = SONIC_DIRECTIONS.find((d) => d.id === context.id);
    assert.equal(now.mood, own ? own.mood : before.mood, own ? `${context.id} plays the study’s sound for it` : 'a use the study did not name keeps its sound');
  }
  // And back to one sound: the tunes and balances are still each use's own.
  const calm = applySonicDirection(mixed, SONIC_DIRECTIONS[0]!);
  for (const [i, context] of calm.contexts.entries()) {
    assert.equal(parseMusicState(context.music.parameters).seed, parseMusicState(bright.contexts[i]!.music.parameters).seed);
    assert.equal(parseMusicState(context.music.parameters).mood, SONIC_DIRECTIONS[0]!.mood);
  }
});

test('the starting sound is read from the profile, or from its music when an older save never recorded one', () => {
  const start = starterSonicProfile('sound', 'Harbour');
  assert.deepEqual(sonicStartOf(applySonicMix(start)), { mode: 'mixed' });
  assert.deepEqual(sonicStartOf(applySonicDirection(start, SONIC_DIRECTIONS[1]!)), { mode: 'one', sound: SONIC_DIRECTIONS[1]!.id });
  // Saved before the field existed: the study's own arrangement reads as the mix ...
  assert.deepEqual(sonicStartOf(start), { mode: 'mixed' });
  // ... and every use on one sound reads as that sound.
  const legacy = applySonicDirection(start, SONIC_DIRECTIONS[2]!);
  delete legacy.startingSound;
  assert.deepEqual(sonicStartOf(legacy), { mode: 'one', sound: SONIC_DIRECTIONS[2]!.id });
  // A recorded sound this build does not offer is not trusted.
  assert.equal(sonicStartOf({ ...legacy, startingSound: { mode: 'one', sound: 'gone' } })?.mode, 'one');
});

test('the mix card names which sound each use plays', () => {
  const { name, line, meta } = mixCopy();
  assert.equal(name, 'Mixed');
  assert.equal(line, 'Each use plays its own sound: Calm for Explain, Steady for Demonstrate, Bright for Play.');
  assert.equal(meta, 'Warm · City pop · Sugar');
});
