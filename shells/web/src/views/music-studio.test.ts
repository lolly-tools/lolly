// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's link and its track (views/music-studio.ts): every setting
 * round-trips through the link, nonsense falls back to the defaults, a retired lead plays the
 * lead that took its place, and the composed track has the length asked for with a locked
 * part held all the way through.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMusicState, musicStateParams, composeTrack, drumRow, instrumentShade } from './music-studio.ts';

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

test('a link that asks for the retired soft lead plays the flute, for the whole track or a kind of section', () => {
  const s = parseMusicState('style=citypop&seed=5&bars=64&lead=soft&drop.lead=soft');
  assert.equal(s.lead, 'flute');
  assert.deepEqual(s.sections, { drop: { lead: 'flute' } });
  assert.equal(musicStateParams(s), 'style=citypop&seed=5&bars=64&lead=flute&drop.lead=flute', 'the link it writes back asks for the flute');
  const bars = composeTrack(s);
  assert.ok(bars.every(b => (b.voices?.lead ?? b.tune.style.lead) === 'flute'), 'every bar plays the flute');
  assert.deepEqual(bars, composeTrack(parseMusicState('style=citypop&seed=5&bars=64&lead=flute&drop.lead=flute')), 'exactly the track a flute link plays');
  const section = parseMusicState('style=soul&seed=5&bars=64&break.lead=soft');
  assert.deepEqual(section.sections, { break: { lead: 'flute' } });
  assert.ok(composeTrack(section).filter(b => b.section === 'break').every(b => b.voices?.lead === 'flute'));
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

test('the track has about the bars asked for, ends with its outro, and a locked lead plays all the way through', () => {
  const s = parseMusicState('style=dubstep&seed=9&bars=96&lead=metal');
  const bars = composeTrack(s);
  assert.ok(Math.abs(bars.length - 96) <= 8, `${bars.length} bars, about 96`);
  assert.equal(bars[bars.length - 1]!.section, 'rest', 'the track ends as a song does');
  assert.ok(bars.every(b => (b.voices?.lead ?? b.tune.style.lead) === 'metal'), 'no section swaps the locked lead');
  assert.ok(bars.every(b => !b.voices?.double), 'and no drop doubles it with another');
  // Locking the lead changes nothing else: the same seed's bass and chords.
  const free = composeTrack(parseMusicState('style=dubstep&seed=9&bars=96'));
  assert.deepEqual(bars.map(b => b.chord), free.map(b => b.chord));
});

test('a lofi house track travels in a link with its deep-house bass, chosen for the whole track or a kind of section', () => {
  const s = parseMusicState('style=lofiHouse&seed=7&bars=64&bass=deep&drop.bass=deep&break.bass=round');
  assert.equal(s.mood, 'lofiHouse');
  assert.equal(s.bass, 'deep');
  assert.deepEqual(s.sections, { drop: { bass: 'deep' }, break: { bass: 'round' } });
  assert.deepEqual(parseMusicState(musicStateParams(s)), s, 'and reads back the same');
  const bars = composeTrack(s);
  assert.ok(bars.filter(b => b.section === 'drop').every(b => (b.voices?.bass ?? b.tune.style.bass) === 'deep'), 'every drop plays the deep bass');
  assert.ok(bars.filter(b => b.section === 'break').every(b => b.voices?.bass === 'round'), 'the breakdown the one chosen for it');
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


test('the tempo travels in the link, stays in range, and plays the same notes faster or slower', () => {
  const set = parseMusicState('style=sherbert&seed=4&bars=8&bpm=128');
  assert.equal(set.bpm, 128);
  assert.match(musicStateParams(set), /(^|&)bpm=128(&|$)/);
  assert.equal(parseMusicState('style=sherbert&bpm=9000').bpm, undefined, 'out of range falls back to the tune\'s own');
  assert.equal(parseMusicState('style=sherbert&bpm=abc').bpm, undefined);
  assert.ok(!/bpm=/.test(musicStateParams(parseMusicState('style=sherbert&seed=4'))), 'no tempo set, none in the link');
  const own = composeTrack(parseMusicState('style=sherbert&seed=4&bars=8'));
  const fast = composeTrack(set);
  assert.notEqual(own[0]!.tune.bpm, 128);
  assert.ok(fast.every(b => b.tune.bpm === 128), 'every bar at the tempo set');
  assert.deepEqual(fast.map(b => b.notes), own.map(b => b.notes), 'the notes are the same notes');
});

test('a hand drum\'s strokes sit on the drum lane\'s rows by register', () => {
  const idx = (kind: string): number => ['shaker', 'tambourine', 'conga', 'cowbell', 'sticks', 'tombak', 'daf', 'woodblock', 'tanggu', 'gong', 'taiko', 'kotsuzumi', 'djembe', 'dunun', 'shekere', 'agogo', 'talking'].indexOf(kind);
  assert.equal(drumRow('kick'), 2);
  assert.equal(drumRow('snare'), 1);
  assert.equal(drumRow('hat'), 0);
  assert.equal(drumRow('perc', idx('tombak'), 1), 2, 'the tom is low');
  assert.equal(drumRow('perc', idx('tombak'), 2), 1, 'the bak is in the middle');
  assert.equal(drumRow('perc', idx('daf'), 3), 0, 'the rings are high');
  assert.equal(drumRow('perc', idx('dunun'), 2), 2);
  assert.equal(drumRow('perc', idx('shekere'), 1), 0);
});

test('an instrument has its own shade of its track\'s colour, the same every time', () => {
  assert.equal(instrumentShade('hsl(200 60% 45%)', 'koto'), instrumentShade('hsl(200 60% 45%)', 'koto'));
  const shades = new Set(['koto', 'kora', 'tar', 'santur', 'rhodes', 'supersaw', 'future', 'pluck'].map(i => instrumentShade('hsl(200 60% 45%)', i)));
  assert.ok(shades.size >= 4, `instruments read apart (${shades.size} shades)`);
  assert.match(instrumentShade('hsl(200 60% 45%)', 'koto'), /^hsl\(\d+ 60% \d+%\)$/);
  assert.equal(instrumentShade('#123456', 'koto'), '#123456', 'a colour it cannot read is kept');
});

test('the key moves every pitched note and the chords, leaves the drums, and travels in the link', () => {
  const own = composeTrack(parseMusicState('style=sugar&seed=2024&bars=24'));
  const up = parseMusicState('style=sugar&seed=2024&bars=24&transpose=3');
  assert.equal(up.transpose, 3);
  assert.match(musicStateParams(up), /(^|&)transpose=3(&|$)/);
  assert.equal(parseMusicState('style=sugar&transpose=9').transpose, undefined, 'out of range falls back to the tune\'s own key');
  assert.equal(parseMusicState('style=sugar&transpose=0').transpose, undefined);
  const moved = composeTrack(up);
  assert.equal(moved[0]!.tune.key, 'C major', 'A major up three is C major');
  assert.equal(own[0]!.tune.key, 'A major');
  for (let b = 0; b < own.length; b++) {
    own[b]!.notes.forEach((n, i) => {
      const m = moved[b]!.notes[i]!;
      const pitched = ['keys', 'lead', 'bass', 'coin', 'hey', 'tag', 'game'].includes(n.voice);
      assert.equal(m.midi, pitched ? n.midi + 3 : n.midi, `bar ${b} ${n.voice}`);
    });
    if (own[b]!.chord) assert.deepEqual(moved[b]!.tones, own[b]!.tones.map(pc => (pc + 3) % 12));
  }
});

test('a chosen kit, tag and quiet effects travel in the link; the kit leaves every note as it was', () => {
  const s = parseMusicState('style=sugar&seed=11&bars=64&kit=jazz&tag=whisper&quiet=console,sweeps');
  assert.equal(s.kit, 'jazz');
  assert.equal(s.tag, 'whisper');
  assert.deepEqual(s.quiet, ['console', 'sweeps']);
  const again = parseMusicState(musicStateParams(s));
  assert.deepEqual([again.kit, again.tag, again.quiet], ['jazz', 'whisper', ['console', 'sweeps']]);
  assert.equal(parseMusicState('kit=tuba&tag=yodel&quiet=nothing').kit, undefined, 'an unknown kit falls back');
  // The kit is sound only: the same notes as the style's own kit.
  const own = composeTrack(parseMusicState('style=sugar&seed=11&bars=64'));
  const kit = composeTrack(parseMusicState('style=sugar&seed=11&bars=64&kit=808'));
  assert.deepEqual(kit.map(b => b.notes), own.map(b => b.notes));
});

test('the effect switches take their effects out and leave every other note', () => {
  const all = composeTrack(parseMusicState('style=chiptune&seed=5&bars=64'));
  const quiet = composeTrack(parseMusicState('style=chiptune&seed=5&bars=64&quiet=console'));
  const count = (bars: typeof all, voices: string[]): number => bars.reduce((n, b) => n + b.notes.filter(x => voices.includes(x.voice)).length, 0);
  assert.ok(count(all, ['game', 'coin']) > 0, 'chiptune plays the console');
  assert.equal(count(quiet, ['game', 'coin']), 0, 'and with the console off, none of it');
  const others = (bars: typeof all) => bars.map(b => b.notes.filter(x => x.voice !== 'game' && x.voice !== 'coin'));
  assert.deepEqual(others(quiet), others(all));
});

test('the Lolly tag: off takes it out, a delivery says every tag that way, and one is placed at the top when the composer placed none', () => {
  const tagsOf = (q: string) => composeTrack(parseMusicState(q)).flatMap((b, i) => b.notes.filter(n => n.voice === 'tag').map(n => ({ i, mod: n.mod })));
  for (let seed = 1; seed <= 12; seed++) {
    const base = `style=rock&seed=${seed}&bars=64`;
    assert.equal(tagsOf(`${base}&tag=off`).length, 0, `seed ${seed}: off`);
    const sung = tagsOf(`${base}&tag=sung`);
    assert.ok(sung.length >= 1 && sung.every(x => x.mod === 3), `seed ${seed}: every tag sung`);
    if (tagsOf(base).length === 0) assert.equal(sung[0]!.i, 0, `seed ${seed}: placed at the top`);
  }
});
