// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's link and its track (views/music-studio.ts): every setting
 * round-trips through the link, nonsense falls back to the defaults, and the composed
 * track has the length asked for with a locked part held all the way through.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMusicState, musicStateParams, composeTrack } from './music-studio.ts';

test('a link carries every setting and reads back the same', () => {
  const s = parseMusicState('style=funk&seed=4111860815&bars=48&lead=riff&bass=slap&keys=wah&drums=0&texture=0.6&bright=1.3&drive=2.4&mix.bass=1.4&mix.reverb=0.5');
  assert.equal(s.mood, 'funk');
  assert.equal(s.seed, 4111860815);
  assert.equal(s.bars, 48);
  assert.deepEqual([s.lead, s.bass, s.keys], ['riff', 'slap', 'wah']);
  assert.equal(s.drums, false);
  assert.equal(s.mix.bass, 1.4);
  assert.deepEqual(parseMusicState(musicStateParams(s)), s);
});

test('nonsense in a link falls back to the defaults', () => {
  const s = parseMusicState('style=polka&seed=-3&bars=9999&lead=kazoo&mix.keys=50');
  assert.equal(s.mood, 'sugar');
  assert.equal(s.seed, 2024);
  assert.equal(s.bars, 64);
  assert.equal(s.lead, undefined);
  assert.equal(s.mix.keys, 1);
});

test('a short link: settings at their defaults are left out', () => {
  assert.equal(musicStateParams(parseMusicState('style=dnb&seed=5&bars=32')), 'style=dnb&seed=5&bars=32');
});

test('the track has the bars asked for, and a locked lead plays all the way through', () => {
  const s = parseMusicState('style=dubstep&seed=9&bars=96&lead=metal');
  const bars = composeTrack(s);
  assert.equal(bars.length, 96);
  assert.ok(bars.every(b => (b.voices?.lead ?? b.tune.style.lead) === 'metal'), 'no section swaps the locked lead');
  assert.ok(bars.every(b => !b.voices?.double), 'and no drop doubles it with another');
  // Locking the lead changes nothing else: the same seed's bass and chords.
  const free = composeTrack(parseMusicState('style=dubstep&seed=9&bars=96'));
  assert.deepEqual(bars.map(b => b.chord), free.map(b => b.chord));
});

test('instruments chosen for a kind of section apply to every bar of it, and travel in the link', () => {
  const s = parseMusicState('style=sugar&seed=7&bars=96&drop.lead=metal&build.keys=pad');
  assert.deepEqual(s.sections, { build: { keys: 'pad' }, drop: { lead: 'metal' } });
  assert.match(musicStateParams(s), /build\.keys=pad/);
  assert.match(musicStateParams(s), /drop\.lead=metal/);
  const bars = composeTrack(s);
  const drops = bars.filter(b => b.section === 'drop');
  assert.ok(drops.length > 0 && drops.every(b => b.voices?.lead === 'metal' && !b.voices.double), 'every drop plays the metal guitar, undoubled');
  assert.ok(bars.filter(b => b.section === 'build').every(b => b.voices?.keys === 'pad'));
  assert.ok(bars.filter(b => b.section === 'verse').every(b => b.voices?.lead !== 'metal'), 'other sections keep their own');
});

