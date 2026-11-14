// SPDX-License-Identifier: MPL-2.0
/**
 * The Ear candy lane's moments (views/music-studio/fx-moments.ts): each sound gets its own
 * icon and name, a sound the table does not know gets the lane's wand, a run of one sound
 * is one moment, and the chips on show never overlap, the rare sounds placed first.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/fx-moments.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fxMoments, fxSound, momentLabel, placeChips, momentKey, type FxMoment } from './fx-moments.ts';
import { composeTrack, parseMusicState } from '../../lib/music-state.ts';

const bar = (...notes: Array<[string, number]>) => ({ notes: notes.map(([voice, beat]) => ({ voice, beat })) });
const isFx = (n: { voice: string }): boolean => !['keys', 'lead', 'bass', 'kick', 'snare', 'hat'].includes(n.voice);

test('each sound has its own kind and name; an unknown sound gets the lane\'s own', () => {
  assert.deepEqual([fxSound('magpie').kind, fxSound('magpie').name()], ['bird', 'Magpie']);
  assert.equal(fxSound('kookaburra').kind, 'bird');
  assert.deepEqual([fxSound('wave').kind, fxSound('wave').name()], ['wave', 'Waves']);
  assert.equal(fxSound('game').kind, 'console');
  assert.equal(fxSound('riser').kind, 'sweep');
  assert.equal(fxSound('hey').kind, 'voice');
  assert.equal(fxSound('tag').name(), 'Lolly tag');
  assert.equal(fxSound('sparkle').kind, 'sparkle');
  const unknown = fxSound('spin');
  assert.deepEqual([unknown.kind, unknown.glyph, unknown.name()], ['other', 'wand', 'Ear candy'], 'a new effect still gets a chip');
  assert.equal(fxSound('toString').glyph, 'wand', 'a property every object has is not a sound');
});

test('a run of one sound is one moment, from its first note; a gap of more than a bar starts another', () => {
  const bars = [
    bar(['sparkle', 2], ['kick', 0]),
    bar(['sparkle', 0], ['magpie', 3]),
    bar(),
    bar(['sparkle', 1]),
    bar(),
    bar(),
    bar(['sparkle', 0.5], ['keys', 0]),
  ];
  const m = fxMoments(bars, isFx);
  assert.deepEqual(m.map(x => [x.voice, x.bar, x.beat, x.lastBar]), [
    ['sparkle', 0, 2, 3],
    ['magpie', 1, 3, 1],
    ['sparkle', 6, 0.5, 6],
  ]);
  assert.equal(momentLabel(m[0]!), 'Sparkles, bars 1 to 4');
  assert.equal(momentLabel(m[1]!), 'Magpie, bar 2');
});

test('the chips on show never overlap, the rare sounds first and the rest where they fit', () => {
  const mk = (voice: string, bar: number): FxMoment => ({ voice, kind: fxSound(voice).kind, bar, beat: 0, lastBar: bar });
  const moments = [mk('sparkle', 0), mk('magpie', 1), mk('sparkle', 3), mk('riser', 10), mk('sparkle', 40)];
  const chips = placeChips(moments, m => m.bar * 10, 0, 200, 18);
  assert.deepEqual(chips.map(c => momentKey(c.moment)), ['magpie:1', 'sparkle:3', 'riser:10'], 'the bird wins its spot; a chip off the lane is left out');
  for (let i = 1; i < chips.length; i++) assert.ok(chips[i]!.x - chips[i - 1]!.x >= 20, 'room between chips');
});

test('a real track\'s ear candy: Straya\'s birds and Chiptune\'s console are moments', () => {
  const lane = (q: string) => fxMoments(composeTrack(parseMusicState(q)), n => !['keys', 'lead', 'bass', 'kick', 'snare', 'rim', 'hat', 'openHat', 'crash', 'tom', 'perc', 'didge', 'soar', 'bwah', 'layer'].includes(n.voice));
  const chip = lane('style=chiptune&seed=5&bars=64');
  assert.ok(chip.some(m => m.kind === 'console'), 'the console\'s sounds');
  const straya = Array.from({ length: 8 }, (_, seed) => lane(`style=straya&seed=${seed + 1}&bars=64`)).flat();
  assert.ok(straya.some(m => m.kind === 'bird'), 'Straya\'s birds');
});
