// SPDX-License-Identifier: MPL-2.0
/**
 * The Waves chip in the music generator's effects lane (lib/music-state.ts, lib/beach-waves.ts):
 * on in Noosacore, which sets its own sea, off everywhere else until a person turns it on, and
 * carried in the link (`waves=1`) the way the Aussie birds are (`birds=1`).
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/beach-waves.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeTrack, fxOn, musicStateParams, parseMusicState, toggleFx, FX_FAMILIES } from './music-state.ts';
import { OWN_WAVES, sprinkleWaves } from './beach-waves.ts';
import { composeLofiTune, type LofiBar } from '../../../../engine/src/lofi-compose.ts';
import { readWave } from '../../../../engine/src/lofi-waves-notes.ts';

const waves = (bars: LofiBar[]): number => bars.reduce((s, b) => s + b.notes.filter(n => n.voice === 'wave').length, 0);

test('the Waves chip: on in Noosacore, off elsewhere, and the link carries it both ways', () => {
  assert.ok(FX_FAMILIES.includes('waves'));
  assert.ok(OWN_WAVES.has('noosa'));
  const noosa = parseMusicState('style=noosa&seed=3&bars=32');
  assert.equal(fxOn(noosa, 'waves'), true, 'Noosacore sets its own sea');
  assert.equal(fxOn(noosa, 'birds'), true, 'and sings its own magpie');
  toggleFx(noosa, 'waves');
  assert.equal(fxOn(noosa, 'waves'), false);
  assert.match(musicStateParams(noosa), /quiet=waves/);
  assert.equal(waves(composeTrack(noosa)), 0, 'turned off, the sea is gone');
  assert.ok(waves(composeTrack(parseMusicState('style=noosa&seed=3&bars=32'))) > 0);

  const jazz = parseMusicState('style=jazz&seed=3&bars=32');
  assert.equal(fxOn(jazz, 'waves'), false, 'a style without its own sea starts without one');
  assert.equal(waves(composeTrack(jazz)), 0);
  toggleFx(jazz, 'waves');
  assert.equal(fxOn(jazz, 'waves'), true);
  const link = musicStateParams(jazz);
  assert.match(link, /waves=1/);
  const back = parseMusicState(link);
  assert.equal(back.waves, true);
  assert.ok(waves(composeTrack(back)) > 0, 'turned on, the sea is laid under the track');
  // The rest of the track is the track it was: only wave notes were added.
  const plain = composeTrack(parseMusicState('style=jazz&seed=3&bars=32'));
  assert.deepEqual(composeTrack(back).map(b => ({ ...b, notes: b.notes.filter(n => n.voice !== 'wave') })), plain);
});

test('the sea laid under another style: the shore every four bars, irregular waves, quieter in a drop', () => {
  const bars = composeLofiTune(11, 'dnb');
  const laid = bars.map(b => sprinkleWaves(b, b.tune));
  assert.deepEqual(laid, bars.map(b => sprinkleWaves(b, b.tune)), 'the same each time');
  const shore = laid.filter(b => b.notes.some(n => n.voice === 'wave' && readWave(n.mod ?? 0).kind === 'shore')).map(b => b.index);
  assert.deepEqual(shore, laid.filter(b => b.section !== 'rest' && b.index % 4 === 0).map(b => b.index));
  const breaks = laid.flatMap(b => b.notes.filter(n => n.voice === 'wave' && readWave(n.mod ?? 0).kind === 'break').map(n => ({ n, b })));
  assert.ok(breaks.length >= 8, `${breaks.length} waves`);
  const drop = breaks.filter(x => x.b.section === 'drop').map(x => x.n.vel);
  const intro = breaks.filter(x => x.b.section === 'intro').map(x => x.n.vel);
  if (drop.length && intro.length) assert.ok(Math.max(...drop) < Math.min(...intro), 'the sea sits under a drop and comes forward in the intro');
  assert.equal(sprinkleWaves(laid.at(-1)!, laid.at(-1)!.tune), laid.at(-1), 'the rest bar stays silent');
});
