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

test('the sea laid under another style: one to three soft moments a tune, never a bed', () => {
  const MOODS = ['dnb', 'jazz', 'lofiHouse', 'rainy', 'synthwave', 'botanica'] as const;
  let single = 0, tunes = 0;
  for (const mood of MOODS) for (let seed = 1; seed <= 12; seed++) {
    const bars = composeLofiTune(seed, mood);
    const laid = bars.map(b => sprinkleWaves(b, b.tune));
    assert.deepEqual(laid, bars.map(b => sprinkleWaves(b, b.tune)), 'the same each time');
    const notes = laid.flatMap(b => b.notes.filter(n => n.voice === 'wave').map(n => ({ n, b })));
    const shore = notes.filter(x => readWave(x.n.mod ?? 0).kind === 'shore');
    const crests = notes.filter(x => readWave(x.n.mod ?? 0).kind === 'break');
    // Each moment has one wave breaking: on its own, or at the height of the shore's swell.
    const moments = crests.length;
    const where = `${mood} ${seed}`;
    assert.ok(moments >= 1 && moments <= 3, `${where}: one to three moments (${moments})`);
    assert.ok(shore.length <= 1, `${where}: the shore swells in once at most`);
    for (const x of shore) assert.ok(x.n.dur <= 6 * 4 && x.n.vel <= 0.6, `${where}: a short, soft swell of the shore`);
    for (const x of crests) assert.ok(x.n.vel <= 0.6 && readWave(x.n.mod ?? 0).distance >= 1, `${where}: a wave breaks softly, out from the shore`);
    tunes++;
    if (moments === 1) single++;
    assert.equal(sprinkleWaves(laid.at(-1)!, laid.at(-1)!.tune), laid.at(-1), 'the rest bar stays silent');
  }
  assert.ok(single >= tunes * 0.2, `some tunes have only one moment (${single} of ${tunes})`);
});
