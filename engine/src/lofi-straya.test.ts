// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, LOFI_MOODS } from './lofi-compose.ts';
import { didgeridooPitch, isYidaki, playOnDidge, yidakiPitch, DIDGE_CAMEO, DIDGE_LEAD, DIDGE_MID, DIDGE_TOOT, readBird, readDidge } from './lofi-straya.ts';

const SEEDS = Array.from({ length: 24 }, (_, i) => (i * 2654435761 + 5) >>> 0);

test('Straya\'s didgeridoos play three roles by section: the drone, the rhythm, the solo', () => {
  let layered = 0;
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = composeLofiTune(seed, 'straya');
    let both = false;
    for (const b of bars) {
      const drone = b.notes.filter(n => n.voice === 'bass');
      const didge = b.notes.filter(n => n.voice === 'didge').map(n => readDidge(n.mod ?? 0));
      const where = `seed ${seed} bar ${b.index} (${b.section})`;
      // The drone is always the Didgeridoo's; the solo always the Yidaki's.
      for (const n of drone) assert.ok(!isYidaki(readDidge(n.mod ?? 0).kind), `${where}: the drone is the Didgeridoo's`);
      for (const d of didge) if (d.role === DIDGE_LEAD) assert.ok(isYidaki(d.kind), `${where}: the solo is the Yidaki's`);
      if (b.section === 'build' || b.section === 'drop') {
        if (b.layers.includes('bass')) assert.ok(didge.length > 0 && didge.every(d => d.role === DIDGE_MID), `${where}: the rhythm plays`);
        // Both together: the Didgeridoo holds its drone under the Yidaki's rhythm; else the drone becomes the rhythm.
        if (drone.length) { both = true; assert.ok(didge.every(d => isYidaki(d.kind)), `${where}: the Yidaki's rhythm over the Didgeridoo's drone`); }
        else assert.ok(didge.every(d => !isYidaki(d.kind)), `${where}: alone, the Didgeridoo turns its drone into the rhythm`);
        for (const n of b.notes.filter(x => x.voice === 'didge' && isYidaki(readDidge(x.mod ?? 0).kind))) {
          const under = drone[0];
          if (under) assert.equal(n.midi, under.midi + 7, `${where}: the Yidaki a fifth above the Didgeridoo`);
        }
      }
      if (b.section === 'verse') {
        assert.ok(drone.length > 0, `${where}: the drone under the verse`);
        assert.equal(didge.length, 0, `${where}: no rhythm or solo in a verse`);
        // The drone's notes join up: each ends where the next starts.
        const sorted = [...drone].sort((x, y) => x.beat - y.beat);
        for (let i = 0; i + 1 < sorted.length; i++) assert.ok(sorted[i + 1]!.beat - (sorted[i]!.beat + sorted[i]!.dur) < 0.05, `${where}: the drone never stops`);
      }
      if (didge.some(d => d.role === DIDGE_LEAD)) {
        assert.equal(b.section, 'break', `${where}: the didgeridoo leads only in the solo`);
        assert.ok(!b.notes.some(n => n.voice === 'lead'), `${where}: the banjo or the fiddle rests while it leads`);
      }
    }
    // The solo trades: some bars the didgeridoo's, some the answering lead's.
    const solo = bars.filter(b => b.section === 'break');
    assert.ok(solo.some(b => b.notes.some(n => n.voice === 'didge' && readDidge(n.mod ?? 0).role === DIDGE_LEAD)), `seed ${seed}: the didgeridoo takes the solo`);
    assert.ok(solo.some(b => b.notes.some(n => n.voice === 'lead')), `seed ${seed}: and the band answers`);
    if (both) layered++;
  }
  assert.ok(layered >= 6, `most tunes layer the two (${layered} of 12)`);
});

test('the kinds: each note names one, the rhythm and the solo often another than the drone\'s', () => {
  let changed = 0;
  for (const seed of SEEDS) {
    const kinds = new Set<number>();
    for (const b of composeLofiTune(seed, 'straya')) for (const n of b.notes) if (n.voice === 'didge' || (n.voice === 'bass' && b.tune.style.bass === 'didgeridoo')) kinds.add(readDidge(n.mod ?? 0).kind);
    for (const k of kinds) assert.ok(k >= 0 && k < 5, `seed ${seed}: kind ${k}`);
    if (kinds.size > 1) changed++;
  }
  assert.ok(changed >= SEEDS.length / 3, `most tunes move between kinds (${changed} of ${SEEDS.length})`);
});

test('most Straya tunes have a signature bird moment, one or two, and the lead stays clear of it', () => {
  let some = 0;
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'straya');
    const featured = bars.flatMap(b => b.notes.filter(n => (n.voice === 'magpie' || n.voice === 'kookaburra') && readBird(n.mod ?? 0).featured).map(n => ({ b, n })));
    assert.ok(featured.length <= 2, `seed ${seed}: ${featured.length} featured birds`);
    if (featured.length) some++;
    for (const { b, n } of featured) assert.ok(!b.notes.some(x => x.voice === 'lead' && x.beat >= n.beat), `seed ${seed} bar ${b.index}: the lead is cleared under the ${n.voice}`);
  }
  assert.ok(some >= SEEDS.length * 0.75, `most tunes (${some} of ${SEEDS.length})`);
});

test('the didgeridoo\'s cameo in the bass genres is rare and short, and only Straya and Noosacore play one otherwise', () => {
  for (const mood of LOFI_MOODS) {
    let tunes = 0;
    for (const seed of SEEDS) {
      const bars = composeLofiTune(seed, mood).filter(b => b.notes.some(n => n.voice === 'didge'));
      // Straya plays its own, and so does Noosacore (Andy, 2026-11-14: "noosa core can have didge").
      if (mood === 'straya' || mood === 'noosa') continue;
      if (!DIDGE_CAMEO.has(mood)) { assert.equal(bars.length, 0, `${mood} ${seed}: no didgeridoo`); continue; }
      assert.ok(bars.length <= 2, `${mood} ${seed}: a cameo of ${bars.length} bars`);
      for (const b of bars) for (const n of b.notes) if (n.voice === 'didge') assert.ok(isYidaki(readDidge(n.mod ?? 0).kind), `${mood} ${seed}: the cameo is the Yidaki's`);
      if (bars.length) tunes++;
    }
    if (DIDGE_CAMEO.has(mood)) assert.ok(tunes >= 3 && tunes <= SEEDS.length / 2, `${mood}: a cameo in ${tunes} of ${SEEDS.length} tunes`);
  }
});

test('a bird note\'s and a didgeridoo note\'s mod decode', () => {
  assert.deepEqual(readBird(123 + 4096 + 2 * 8192), { song: 123, featured: true, birds: 3 });
  assert.deepEqual(readBird(77), { song: 77, featured: false, birds: 1 });
  assert.deepEqual(readDidge(2 + 16 * 2 + 64 * 3), { art: 2, role: 2, kind: 3 });
});

test('a track given to the Didgeridoo or the Yidaki plays on its one note, its toots only over a busy band', () => {
  const kick = (beat: number) => ({ voice: 'kick' as const, midi: 36, beat, dur: 0.1, vel: 0.9 });
  const chords = [0, 1, 2, 3].flatMap(beat => [60, 64, 67].map(midi => ({ voice: 'keys' as const, midi, beat, dur: 0.9, vel: 0.7 })));
  const melody = [{ voice: 'lead' as const, midi: 72, beat: 0, dur: 0.5, vel: 0.9 }, { voice: 'lead' as const, midi: 76, beat: 0.5, dur: 0.25, vel: 0.7 }, { voice: 'lead' as const, midi: 79, beat: 1, dur: 2, vel: 0.8 }];
  const busy = ['kick', 'snare', 'hat', 'bass', 'perc'].map((voice, i) => ({ voice: voice as 'kick', midi: 40, beat: i * 0.5, dur: 0.2, vel: 0.5 }));
  const bar = (section: 'verse' | 'drop', notes: typeof chords) => ({ section, index: 3, layers: ['keys', 'kick'] as const, notes: [...notes, kick(0), kick(2)], key: 2, seed: 99, swing: 0.5, swing8: 0.5 });
  for (const [track, instrument, notes] of [['keys', 'yidaki', chords], ['keys', 'didgeridoo', chords], ['lead', 'yidaki', melody], ['bass', 'didgeridoo', chords.map(n => ({ ...n, voice: 'bass' as const }))]] as const) {
    for (const section of ['verse', 'drop'] as const) {
      const out = playOnDidge(bar(section, section === 'drop' ? [...notes, ...busy] as typeof chords : [...notes] as typeof chords), track, instrument, track !== 'bass');
      const own = out.filter(n => n.voice === track);
      assert.ok(own.length > 0, `${track} on the ${instrument}: it plays`);
      const pitch = instrument === 'yidaki' ? yidakiPitch(2, true) : didgeridooPitch(2);
      for (const n of own) {
        const d = readDidge(n.mod ?? 0);
        assert.equal(n.midi, pitch, `${track} on the ${instrument}: one note`);
        assert.equal(isYidaki(d.kind), instrument === 'yidaki', `${track}: the ${instrument}'s own kind`);
        if (section === 'verse') assert.notEqual(d.art, DIDGE_TOOT, `${track} on the ${instrument}: no toot in a verse`);
      }
      // Never more than one note at a time.
      const sorted = [...own].sort((a, b) => a.beat - b.beat);
      for (let i = 0; i + 1 < sorted.length; i++) assert.ok(sorted[i]!.beat + sorted[i]!.dur <= sorted[i + 1]!.beat + 1e-6, `${track} on the ${instrument}: one note at a time`);
    }
  }
  assert.equal(yidakiPitch(2, true), didgeridooPitch(2) + 7, 'over the Didgeridoo, the Yidaki sits a fifth up');
});
