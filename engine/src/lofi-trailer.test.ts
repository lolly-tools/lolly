// SPDX-License-Identifier: MPL-2.0
/** The trailer genre (lofi-trailer.ts): its running order, its hits, the lift into every fourth bar and its section names. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, lofiSectionName, lofiTrack, LOFI_PERCUSSION, type LofiBar } from './lofi-compose.ts';
import { arrangeTrailer, TRAILER_BRAAMS, TRAILER_IMPACTS } from './lofi-trailer.ts';
import { mulberry32 } from './zzfx-compose.ts';

const SEEDS = Array.from({ length: 48 }, (_, i) => (i * 2654435761 + 9) >>> 0);
const TAIKO = LOFI_PERCUSSION.indexOf('taiko');
const has = (b: LofiBar, voice: string): boolean => b.notes.some(n => n.voice === voice);
/** A full hit: the impact (not the soft boom), the braam and the drums' stroke, all on the bar line. */
const struck = (b: LofiBar): boolean => b.notes.some(n => n.voice === 'impact' && n.beat === 0 && n.mod === 0)
  && b.notes.some(n => n.voice === 'braam' && n.beat === 0) && b.notes.some(n => n.voice === 'kick' && n.beat === 0)
  && b.notes.some(n => n.voice === 'perc' && n.mod === TAIKO && n.beat === 0);

test('a cue opens, strikes three or four hits at uneven gaps, rises, drops, stops, sings its theme, drops again and ends on the button', () => {
  const gaps = new Set<number>();
  const counts = new Set<number>();
  for (const seed of SEEDS) {
    const parts = arrangeTrailer(mulberry32(seed));
    assert.deepEqual(parts.map(p => p.kind).filter((k, i, a) => k !== a[i - 1]), ['open', 'hit', 'rise', 'drop', 'stop', 'theme', 'rise', 'drop', 'button']);
    const hits = parts.filter(p => p.kind === 'hit');
    counts.add(hits.length);
    for (const h of hits) { assert.ok(h.bars >= 1 && h.bars <= 4); gaps.add(h.bars); }
    assert.equal(parts[0]!.bars, 4, 'the open is four bars');
    assert.ok(parts.find(p => p.kind === 'rise')!.bars >= 2);
  }
  assert.deepEqual([...counts].sort(), [3, 4]);
  assert.deepEqual([...gaps].sort(), [1, 2, 3, 4], 'the gaps between hits are uneven');
});

test('every hit, each drop and the button are struck: an impact, a braam and the drums together', () => {
  for (const seed of SEEDS.slice(0, 16)) {
    const bars = composeLofiTune(seed, 'trailer');
    const info = bars[0]!.tune;
    assert.equal(info.mood, 'trailer');
    assert.match(info.key, / minor$/, 'a trailer is in a minor key');
    assert.ok(info.bpm >= 150 && info.bpm <= 170);
    assert.equal(bars.length, info.bars);
    assert.equal(bars[bars.length - 1]!.section, 'rest');
    const firstOf = (section: string): LofiBar[] => bars.filter((b, i) => b.section === section && bars[i - 1]?.section !== section);
    for (const b of [...firstOf('drop'), ...firstOf('outro')]) assert.ok(struck(b), `seed ${seed}: bar ${b.index} (${b.section}) is struck`);
    const hits = bars.filter(b => b.section === 'verse' && struck(b)).length;
    assert.ok(hits === 3 || hits === 4, `seed ${seed}: ${hits} hits`);
    // The stop opens on the sub drop, and the button ends on one.
    assert.ok(has(firstOf('break')[0]!, 'subdrop'), `seed ${seed}: the stop's sub drop`);
    assert.ok(has(firstOf('outro')[0]!, 'subdrop'), `seed ${seed}: the button's sub drop`);
    // A rise runs a riser the whole way and leaves a breath before the drop.
    for (const b of firstOf('build')) assert.ok(b.notes.some(n => n.voice === 'riser' && n.beat === 0), `seed ${seed}: the rise's riser`);
    const lastRise = bars.filter((b, i) => b.section === 'build' && bars[i + 1]?.section === 'drop');
    for (const b of lastRise) assert.ok(b.notes.every(n => n.beat < 3.5), `seed ${seed}: a breath before the drop`);
    for (const b of bars) for (const n of b.notes) {
      if (n.voice === 'impact') assert.ok((n.mod ?? 0) < TRAILER_IMPACTS.length && n.midi >= 24 && n.midi <= 35, 'an impact is tuned low, to the chord');
      if (n.voice === 'braam') assert.ok((n.mod ?? 0) < TRAILER_BRAAMS.length && n.midi >= 33 && n.midi <= 44);
      assert.ok(n.vel > 0 && n.vel <= 1 && n.beat >= 0 && n.beat < 4);
    }
  }
});

test('every fourth bar the drums play lifts into the next, so a track cut short rises into its button', () => {
  for (const seed of SEEDS.slice(0, 16)) {
    const bars = composeLofiTune(seed, 'trailer');
    for (const b of bars) {
      if (b.section !== 'drop' || b.index % 4 !== 3) continue;
      assert.ok(has(b, 'riser') && b.notes.filter(n => n.voice === 'tom' && n.beat >= 2).length >= 8, `seed ${seed}: bar ${b.index} lifts`);
    }
    // A short track: the tune's first bars, cut at a fourth bar, then the button.
    const short = lofiTrack(seed, { mood: 'trailer' }, 21);
    const button = short.findIndex(b => b.section === 'outro');
    assert.ok(button > 0 && button % 4 === 0, `seed ${seed}: the cut falls on a fourth bar`);
    assert.ok(struck(short[button]!), `seed ${seed}: the button is struck`);
    if (short[button - 1]!.section === 'drop') assert.ok(has(short[button - 1]!, 'riser'), `seed ${seed}: the bar before the button lifts into it`);
  }
});

test('a tune composes the same way twice, and its sections carry a trailer editor\'s names', () => {
  for (const seed of SEEDS.slice(0, 6)) assert.deepEqual(composeLofiTune(seed, 'trailer'), composeLofiTune(seed, 'trailer'));
  assert.deepEqual(['intro', 'verse', 'build', 'drop', 'break', 'bridge', 'outro'].map(s => lofiSectionName('trailer', s as LofiBar['section'])),
    ['open', 'hits', 'rise', 'back end', 'stop', 'theme', 'button']);
});

test('a person\'s choice of instrument is kept through the whole cue', () => {
  const bars = composeLofiTune(7, 'trailer', { keys: 'grand', lead: 'trumpet' });
  assert.equal(bars[0]!.tune.style.keys, 'grand');
  assert.equal(bars[0]!.tune.style.lead, 'trumpet');
  assert.ok(bars.every(b => b.voices?.keys === undefined), 'no section swaps the keys a person chose');
});
