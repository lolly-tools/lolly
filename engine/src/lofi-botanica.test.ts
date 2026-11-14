// SPDX-License-Identifier: MPL-2.0
/**
 * Botanica's composer (lofi-botanica.ts), through composeLofiTune.
 *
 * Run directly:  node --test engine/src/lofi-botanica.test.ts
 *
 * What is pinned:
 *  - a seed is a tune, and tunes cover both ends of the genre's tempo: slow drifts (40 to
 *    70) and glitchy grooves (100 to 168), drawn per tune;
 *  - every tune is set somewhere: beds of its place under it, birds singing in the lead's
 *    rests (one bird at a time), granular pads on the chord's tones, glitches;
 *  - a drift is free of the grid and has no backbeat; a groove's bloom has its kick, its
 *    backbeat and the place's twigs and drops as percussion;
 *  - the clearing (the break) is a free passage: no drums, notes off the grid, a frozen chord;
 *  - the note encodings round-trip, and the section names are the genre's own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, lofiSectionName, type LofiBar } from './lofi-compose.ts';
import {
  BOTANICA_BIRDS, BOTANICA_CLOUDS, BOTANICA_GLITCHES, BOTANICA_NATURE, BOTANICA_SOURCES,
  glitchMod, grainMod, natureMod, readGlitch, readGrain, readNature,
} from './lofi-botanica.ts';

const SEEDS = Array.from({ length: 40 }, (_, i) => (i * 2654435761 + 17) >>> 0);
const tunes = new Map<number, LofiBar[]>();
const tune = (seed: number): LofiBar[] => {
  let bars = tunes.get(seed);
  if (!bars) { bars = composeLofiTune(seed, 'botanica'); tunes.set(seed, bars); }
  return bars;
};
const notesOf = (bars: readonly LofiBar[], voice: string, section?: string) => bars.filter(b => !section || b.section === section).flatMap(b => b.notes.filter(n => n.voice === voice));
const kindOf = (n: { mod?: number }): string => readNature(n.mod ?? 0).kind;

test('a seed is a tune, and tunes cover the slow drift and the glitchy groove', () => {
  assert.deepEqual(composeLofiTune(77, 'botanica'), composeLofiTune(77, 'botanica'));
  let slow = 0, quick = 0;
  for (const seed of SEEDS) {
    const bpm = tune(seed)[0]!.tune.bpm;
    assert.ok((bpm >= 40 && bpm <= 70) || (bpm >= 100 && bpm <= 168), `${seed}: ${bpm} bpm is at one end of the genre`);
    if (bpm <= 70) slow++; else quick++;
  }
  assert.ok(slow >= 10 && quick >= 10, `both kinds of tune turn up (${slow} drifts, ${quick} grooves)`);
});

test('every tune is set somewhere: beds of its place, birds in the rests, pads on the chords, glitches', () => {
  let birdTunes = 0;
  for (const seed of SEEDS) {
    const bars = tune(seed);
    const where = `botanica ${seed}`;
    const nature = notesOf(bars, 'nature');
    const beds = new Set(nature.filter(n => n.dur >= 2).map(kindOf).filter(k => k !== 'bird'));
    assert.ok(beds.size >= 1, `${where}: a bed of its place under the tune`);
    // The beds run under the whole tune, two bars at a time, from the first bar.
    assert.ok(bars[0]!.notes.some(n => n.voice === 'nature' && n.dur >= 2 && kindOf(n) !== 'bird'), `${where}: the place is heard from the top`);
    const birds = nature.filter(n => kindOf(n) === 'bird');
    if (birds.length) birdTunes++;
    for (const b of birds) assert.ok(BOTANICA_BIRDS[readNature(b.mod!).variant % 8], `${where}: a bird the shell can sing`);
    // One bird at a time: no phrase starts while another is still singing.
    const spans = bars.flatMap((bar, i) => bar.notes.filter(n => n.voice === 'nature' && kindOf(n) === 'bird').map(n => [i * 4 + n.beat, i * 4 + n.beat + n.dur] as const));
    for (let k = 1; k < spans.length; k++) assert.ok(spans[k]![0] >= spans[k - 1]![1], `${where}: a bird waits for the last to finish`);
    const pads = notesOf(bars, 'grain');
    assert.ok(pads.length >= 8, `${where}: granular pads (${pads.length})`);
    for (const p of pads) assert.ok(bars.some(b => b.notes.includes(p) && b.tones.includes(((p.midi % 12) + 12) % 12)), `${where}: a pad plays a tone of its chord`);
    assert.ok(notesOf(bars, 'glitch').length >= 2, `${where}: glitches over the organic sounds`);
  }
  assert.ok(birdTunes >= SEEDS.length * 0.7, `most places have birds (${birdTunes} of ${SEEDS.length})`);
});

test('a drift floats free of the grid with no backbeat; a groove blooms on a kick, a backbeat and the place as percussion', () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const bars = tune(seed);
    const drift = bars[0]!.tune.bpm <= 70;
    const where = `botanica ${seed} (${drift ? 'drift' : 'groove'})`;
    const offGrid = notesOf(bars, 'keys').filter(n => Math.abs(n.beat * 4 - Math.round(n.beat * 4)) > 0.04).length;
    const keys = notesOf(bars, 'keys').length;
    if (drift) {
      assert.equal(notesOf(bars, 'snare').length, 0, `${where}: no backbeat`);
      assert.ok(offGrid / keys > 0.5, `${where}: the keys are played by feel, ${offGrid} of ${keys} off the grid`);
    } else {
      const bloom = bars.filter(b => b.section === 'drop');
      assert.ok(bloom.every(b => b.notes.some(n => n.voice === 'kick')), `${where}: a kick through every bloom bar`);
      assert.ok(bloom.filter(b => b.notes.some(n => n.voice === 'snare' && n.vel > 0.7)).length >= bloom.length * 0.9, `${where}: the backbeat`);
      assert.ok(bloom.some(b => b.notes.some(n => n.voice === 'nature' && ['twig', 'droplet'].includes(kindOf(n)))), `${where}: twigs and drops keep time`);
      assert.ok(bars.some(b => b.notes.some(n => n.voice === 'glitch' && readGlitch(n.mod!).kind === 'repeat')), `${where}: the mix repeats at a phrase's end`);
    }
  }
});

test('the clearing is a free passage: no drums, notes off the grid, a chord frozen under it', () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const bars = tune(seed);
    const clearing = bars.filter(b => b.section === 'break');
    const where = `botanica ${seed}`;
    assert.ok(clearing.length >= 4, `${where}: a clearing`);
    assert.ok(!clearing.some(b => b.notes.some(n => n.voice === 'kick' || n.voice === 'snare' || n.voice === 'hat')), `${where}: no drums in the clearing`);
    const keys = clearing.flatMap(b => b.notes.filter(n => n.voice === 'keys'));
    assert.ok(keys.filter(n => Math.abs(n.beat * 4 - Math.round(n.beat * 4)) > 0.04).length > keys.length / 2, `${where}: off the grid`);
    assert.ok(clearing[0]!.notes.some(n => n.voice === 'glitch' && readGlitch(n.mod!).kind === 'freeze'), `${where}: a frozen chord opens it`);
  }
});

test('the second bloom brings a second voice, the quiet sections softer keys, and the sections have the genre\'s names', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = tune(seed);
    const st = bars[0]!.tune.style;
    const second = bars.filter(b => b.section === 'drop').at(-1)!;
    assert.notEqual(second.voices?.lead ?? st.lead, st.lead, `${seed}: a second lead`);
    assert.notEqual(bars[0]!.voices?.keys ?? st.keys, st.keys, `${seed}: softer keys to open`);
  }
  assert.equal(lofiSectionName('botanica', 'drop'), 'bloom');
  assert.equal(lofiSectionName('botanica', 'break'), 'clearing');
  assert.equal(lofiSectionName('botanica', 'intro'), 'intro');
  assert.equal(lofiSectionName('jazz', 'drop'), 'chorus', 'other genres keep their names');
});

test('the note encodings round-trip', () => {
  for (const kind of BOTANICA_NATURE) for (const variant of [0, 5, 77]) assert.deepEqual(readNature(natureMod(kind, variant)), { kind, variant });
  for (const source of BOTANICA_SOURCES) for (const cloud of BOTANICA_CLOUDS) assert.deepEqual(readGrain(grainMod(source, cloud)), { source, cloud });
  for (const kind of BOTANICA_GLITCHES) for (const material of [0, 3, 15]) assert.deepEqual(readGlitch(glitchMod(kind, material)), { kind, material });
  assert.equal(readNature(-3).kind, 'wind', 'a stray mod reads as something playable');
});
