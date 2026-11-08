// SPDX-License-Identifier: MPL-2.0
/**
 * The Lofi composer's promises.
 *
 * Run directly:  node --test engine/src/lofi-compose.test.ts
 *
 * What is pinned:
 *  - a seed is a tune: the same seed and mood give exactly the same bars, and a
 *    station's run of tunes follows from its first seed;
 *  - every note is playable: inside its bar, in range for its instrument, a velocity
 *    between 0 and 1, no NaN anywhere;
 *  - the harmony holds: the keys voice four or fewer chord tones in their range and move
 *    smoothly, and the lead plays a chord tone on the strong beats;
 *  - tunes differ: across seeds the keys, lead, groove, kit and the way a tune opens all
 *    vary, and the mood leans the key (warm is major, late night and rainy minor);
 *  - a tune's shape: it opens, has a verse, ends with a fading outro and one silent bar;
 *  - a fixed style part (auditioning one instrument) changes that part only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, lofiStream, nextLofiSeed, LOFI_MOODS, LOFI_DRUM_VOICES } from './lofi-compose.ts';
import type { LofiBar } from './lofi-compose.ts';

const SEEDS = Array.from({ length: 24 }, (_, i) => (i * 2654435761) >>> 0);
const DRUMS = new Set(LOFI_DRUM_VOICES);

test('a seed is a tune: the same seed and mood compose the same bars', () => {
  for (const mood of LOFI_MOODS) {
    assert.deepEqual(composeLofiTune(1234, mood), composeLofiTune(1234, mood));
  }
  assert.notDeepEqual(composeLofiTune(1, 'warm')[8]!.notes, composeLofiTune(2, 'warm')[8]!.notes, 'different seeds differ');
});

test('a station plays one tune after another, each seed following from the last', () => {
  const stream = lofiStream(99, { mood: 'rainy' });
  const first = composeLofiTune(99, 'rainy');
  for (let i = 0; i < first.length; i++) assert.equal(stream.next().tune.seed, 99);
  const next = stream.next();
  assert.equal(next.index, 0, 'the next tune starts at its first bar');
  assert.equal(next.tune.seed, nextLofiSeed(99));
  assert.equal(next.tune.mood, 'rainy', 'and keeps the mood');
});

test('every note is playable', () => {
  for (const mood of LOFI_MOODS) for (const seed of SEEDS.slice(0, 8)) {
    for (const bar of composeLofiTune(seed, mood)) {
      for (const n of bar.notes) {
        const where = `${mood} ${seed} bar ${bar.index} ${n.voice}`;
        for (const v of [n.beat, n.dur, n.midi, n.vel]) assert.ok(Number.isFinite(v), `${where}: a non-finite value`);
        assert.ok(n.beat >= -0.05 && n.beat < 4.2, `${where}: starts at beat ${n.beat}`);
        assert.ok(n.vel > 0 && n.vel <= 1, `${where}: velocity ${n.vel}`);
        if (DRUMS.has(n.voice)) continue;
        assert.ok(n.dur > 0, `${where}: length ${n.dur}`);
        const [lo, hi] = n.voice === 'bass' ? [33, 53] : n.voice === 'keys' ? [52, 76] : [64, 84];
        assert.ok(n.midi >= lo && n.midi <= hi, `${where}: note ${n.midi} outside ${lo}..${hi}`);
      }
    }
  }
});

const PC = (m: number): number => ((m % 12) + 12) % 12;

test('the keys voice a few chord tones and move smoothly from chord to chord', () => {
  let moves = 0, total = 0;
  for (const seed of SEEDS.slice(0, 8)) {
    let prev: number[] | null = null;
    for (const bar of composeLofiTune(seed, 'lateNight')) {
      const onset = new Map<number, number[]>();
      for (const n of bar.notes.filter(x => x.voice === 'keys')) {
        const at = Math.round(n.beat * 4);
        onset.set(at, [...(onset.get(at) ?? []), n.midi]);
      }
      for (const chord of onset.values()) {
        if (chord.length < 3) continue;   // a broken chord's single notes
        assert.ok(chord.length <= 4, `seed ${seed} bar ${bar.index}: ${chord.length} keys at once`);
        const v = [...chord].sort((a, b) => a - b);
        if (prev && prev.length === v.length) { total += v.reduce((s, p, i) => s + Math.abs(p - prev![i]!), 0); moves++; }
        prev = v;
      }
    }
  }
  assert.ok(moves > 20, 'enough chord changes to judge');
  assert.ok(total / moves < 8, `the voices move ${(total / moves).toFixed(1)} semitones a change on average`);
});

test('the lead plays a chord tone on the strong beats, and the keys play only chord tones', () => {
  let checked = 0;
  for (const mood of LOFI_MOODS) for (const seed of SEEDS) {
    for (const bar of composeLofiTune(seed, mood)) {
      const tones = new Set(bar.tones);
      for (const n of bar.notes) {
        if (n.voice === 'keys') assert.ok(tones.has(PC(n.midi)), `${mood} ${seed} bar ${bar.index}: keys ${n.midi} is not in ${bar.chord}`);
        const strong = Math.abs(n.beat - Math.round(n.beat / 2) * 2) < 0.03;
        if (n.voice === 'lead' && strong) {
          assert.ok(tones.has(PC(n.midi)), `${mood} ${seed} bar ${bar.index}: lead ${n.midi} on beat ${n.beat.toFixed(2)} is off ${bar.chord}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 30, 'enough strong-beat lead notes to judge');
});

test('tunes differ: instruments, groove, kit and openings vary, and the mood leans the key', () => {
  const seen: Record<string, Set<string>> = { keys: new Set(), lead: new Set(), groove: new Set(), snare: new Set(), opening: new Set() };
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'warm');
    const st = bars[0]!.tune.style;
    seen.keys!.add(st.keys); seen.lead!.add(st.lead); seen.groove!.add(st.groove); seen.snare!.add(st.snare);
    seen.opening!.add(bars[0]!.layers.join('+'));
  }
  for (const [part, values] of Object.entries(seen)) assert.ok(values.size >= 3, `${part}: only ${[...values].join(', ')}`);
  for (const seed of SEEDS.slice(0, 6)) {
    assert.match(composeLofiTune(seed, 'warm')[0]!.tune.key, /major$/);
    assert.match(composeLofiTune(seed, 'lateNight')[0]!.tune.key, /minor$/);
    assert.match(composeLofiTune(seed, 'rainy')[0]!.tune.key, /minor$/);
  }
});

test("a tune's shape: an opening, a verse, a fading outro and one silent bar", () => {
  for (const seed of SEEDS.slice(0, 8)) {
    const bars: LofiBar[] = composeLofiTune(seed, 'warm');
    assert.equal(bars[0]!.section, 'intro');
    assert.ok(bars.some(b => b.section === 'verse'), 'a verse');
    const rest = bars.at(-1)!;
    assert.equal(rest.section, 'rest');
    assert.equal(rest.notes.length, 0, 'the last bar is silent');
    const outro = bars.filter(b => b.section === 'outro');
    assert.ok(outro.length >= 2, 'an outro');
    assert.ok(outro.at(-1)!.level < outro[0]!.level, 'that fades');
    assert.equal(bars[0]!.tune.bars, bars.length);
  }
});

test('Lolly Sings: a lead in every tune, singing through every verse, in a major key', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = composeLofiTune(seed, 'sings');
    const st = bars[0]!.tune.style;
    assert.notEqual(st.lead, 'none', `seed ${seed}: Lolly Sings always has a lead`);
    assert.equal(st.crunch, false, 'and no sampler grit');
    assert.ok(st.dust < 1, 'and less dust than Lofi');
    assert.match(bars[0]!.tune.key, /major$/);
    for (const bar of bars.filter(b => b.section === 'verse')) {
      assert.ok(bar.layers.includes('lead'), `seed ${seed} bar ${bar.index}: the lead sings the whole verse`);
    }
  }
});

test('adding Lolly Sings changed no Lofi tune: a seed still composes what it did', () => {
  // A shared Lofi link is a seed, so a new genre must not shift the old ones' draws.
  const t = composeLofiTune(12345, 'warm')[0]!.tune;
  assert.equal(t.key, 'B major');
  assert.equal(t.bpm, 88);
  assert.equal(t.style.keys, 'rhodes');
  assert.equal(t.style.lead, 'flute');
});

test('fixing one style part changes that part only', () => {
  const base = composeLofiTune(77, 'warm')[0]!.tune;
  const fixed = composeLofiTune(77, 'warm', { keys: 'felt' })[0]!.tune;
  assert.equal(fixed.style.keys, 'felt');
  assert.equal(fixed.key, base.key);
  assert.equal(fixed.bpm, base.bpm);
  assert.equal(fixed.style.groove, base.style.groove);
  assert.equal(fixed.style.lead, base.style.lead);
});
