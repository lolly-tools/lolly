// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAT_BELL, fingerChord, perform } from './lofi-perform.ts';
import { composeLofiTune, type LofiBar } from '../../../../engine/src/lofi-compose.ts';

const TUNING = [40, 45, 50, 55, 59, 64];
const frets = (shape: Array<number | null>): string => shape.map((p, s) => (p === null ? 'x' : String(p - TUNING[s]!))).join('');

test('a folk guitarist fingers the open chords; a jazz guitarist keeps off the open strings and the top string', () => {
  // C major (C E G), G major (G B D), E minor (E G B), A minor (A C E), D major (D F♯ A).
  assert.equal(frets(fingerChord([0, 4, 7], 'steel', 1)!), 'x32010');
  assert.equal(frets(fingerChord([7, 11, 2], 'steel', 1)!), '320003');
  assert.equal(frets(fingerChord([4, 7, 11], 'steel', 1)!), '022000');
  assert.equal(frets(fingerChord([9, 0, 4], 'steel', 1)!), 'x02210');
  for (const tones of [[0, 4, 7, 11], [2, 5, 9, 0], [7, 11, 2, 5]]) {
    const shape = fingerChord(tones, 'jazzbox', 5)!;
    assert.ok(shape, `a jazz shape for ${tones}`);
    assert.equal(shape[5], null, 'the top string left out');
    for (const [s, p] of shape.entries()) if (p !== null) assert.ok(p > TUNING[s]!, `no open string in ${frets(shape)}`);
    const pcs = new Set(shape.filter((p): p is number => p !== null).map(p => p % 12));
    for (const t of tones) if (t !== (tones[0]! + 7) % 12) assert.ok(pcs.has(t), `${frets(shape)} sounds every tone`);
  }
});

/** A bar where a strummed guitar plays chords (three or more notes at once), from the styles that strum. */
function chordBar(): { bar: LofiBar; keys: string } {
  for (const mood of ['country', 'jazz', 'grunge', 'shoegaze'] as const) {
    for (let seed = 1; seed <= 30; seed++) {
      for (const b of composeLofiTune(seed, mood)) {
        const keys = b.voices?.keys ?? b.tune.style.keys;
        if (!['steel', 'jazzbox', 'clean', 'wall'].includes(keys)) continue;
        const at = new Map<number, number>();
        for (const n of b.notes) if (n.voice === 'keys') at.set(Math.round(n.beat * 48), (at.get(Math.round(n.beat * 48)) ?? 0) + 1);
        if ([...at.values()].some(c => c >= 3)) return { bar: b, keys };
      }
    }
  }
  throw new Error('no strummed chord found');
}

test('a strummed chord is spread across the strings, low to high on a downstroke, high to low on an upstroke', () => {
  const { bar, keys } = chordBar();
  const played = perform(bar, 0.5, keys as 'steel', bar.tune.style.lead).filter(n => n.voice === 'keys');
  const strokes = new Map<number, typeof played>();
  for (const n of played) {
    const at = Math.round(n.beat * 8);
    if (!strokes.has(at)) strokes.set(at, []);
    strokes.get(at)!.push(n);
  }
  let seen = 0;
  for (const s of strokes.values()) {
    if (s.length < 3) continue;
    seen++;
    const spread = (Math.max(...s.map(n => n.beat)) - Math.min(...s.map(n => n.beat))) * 0.5 * 1000;
    assert.ok(spread > 5 && spread < 40, `a strum takes ${spread.toFixed(1)} ms`);
    const byTime = [...s].sort((a, b) => a.beat - b.beat).map(n => n.midi);
    const rising = byTime.every((m, i) => i === 0 || m > byTime[i - 1]!);
    const falling = byTime.every((m, i) => i === 0 || m < byTime[i - 1]!);
    assert.ok(rising || falling, `strings in order: ${byTime}`);
    for (const m of byTime) assert.ok(m >= 40 && m <= 88, `on the guitar: ${m}`);
  }
  assert.ok(seen > 0, 'some chords were strummed');
});

test('the drummer: off the grid by milliseconds, in the style\'s pocket, a machine tight; the same every time', () => {
  const spb = 0.5;
  const offsets = (mood: Parameters<typeof composeLofiTune>[1], voice: string): number[] => {
    const out: number[] = [];
    for (const bar of composeLofiTune(5, mood).slice(4, 24)) {
      const played = perform(bar, spb, bar.tune.style.keys, bar.tune.style.lead);
      const drums = bar.notes.filter(n => n.voice === voice);
      // Each played hit against the written one it came from (the nearest): a drummer riding the bell drops some hats.
      for (const n of played.filter(m => m.voice === voice)) {
        const src = drums.reduce((a, b) => (Math.abs(b.beat - n.beat) < Math.abs(a.beat - n.beat) ? b : a));
        out.push((n.beat - src.beat) * spb * 1000);
      }
    }
    return out;
  };
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = (xs: number[]) => Math.sqrt(mean(xs.map(x => (x - mean(xs)) ** 2)));
  const hipHopSnare = offsets('hiphop', 'snare');
  assert.ok(mean(hipHopSnare) > 8, `hip hop's snare sits back: ${mean(hipHopSnare).toFixed(1)} ms`);
  const rockHats = offsets('rock', 'hat');
  assert.ok(sd(rockHats) > 3 && sd(rockHats) < 10 && Math.max(...rockHats.map(Math.abs)) < 25, `rock hats ${sd(rockHats).toFixed(1)} ms either way`);
  const houseHats = offsets('lofiHouse', 'hat');
  assert.ok(mean(houseHats) > 2.5 && sd(houseHats) > 3, `lofi house is played by hand, the hats a little late: ${mean(houseHats).toFixed(1)} ms, ${sd(houseHats).toFixed(1)} either way`);
  const dnbHats = offsets('dnb', 'hat');
  assert.ok(sd(dnbHats) < 2.5, `a machine stays tight: ${sd(dnbHats).toFixed(1)} ms`);
  const bar = composeLofiTune(5, 'rock')[10]!;
  assert.deepEqual(perform(bar, spb, 'steel', 'overdrive'), perform(bar, spb, 'steel', 'overdrive'));
});

test('a lead guitarist bends some long notes and slides into some, and keeps the composer\'s bends', () => {
  let bends = 0, slides = 0, notes = 0;
  for (const bar of composeLofiTune(9, 'rock')) {
    for (const n of perform(bar, 0.5, bar.tune.style.keys, 'overdrive')) {
      if (n.voice !== 'lead') continue;
      notes++;
      if (n.mod === 1) bends++;
      if (n.mod === 2) slides++;
    }
  }
  assert.ok(bends > 0 && slides > 0, `${bends} bends and ${slides} slides`);
  assert.ok(bends + slides < notes * 0.5, 'most notes are picked as written');
});

test('the drummer chooses the stroke: about half the rock and ska drummers ride the bell in a chorus, and a jazz drummer press-rolls into the turn', () => {
  for (const mood of ['rock', 'ska'] as const) {
    let riders = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let bells = 0;
      for (const bar of composeLofiTune(seed, mood)) {
        const played = perform(bar, 0.5, bar.tune.style.keys, bar.tune.style.lead);
        const here = played.filter(n => n.voice === 'hat' && n.mod === HAT_BELL).length;
        assert.ok(here === 0 || bar.section === 'drop', `${mood} ${seed}: the bell only in a chorus`);
        bells += here;
      }
      if (bells > 0) riders++;
    }
    assert.ok(riders >= 3 && riders <= 9, `${mood}: ${riders} of 12 drummers ride the bell`);
  }
  let rolls = 0;
  for (let seed = 1; seed <= 6; seed++) {
    for (const bar of composeLofiTune(seed, 'jazz')) {
      for (const n of perform(bar, 0.5, bar.tune.style.keys, bar.tune.style.lead)) {
        if (n.voice !== 'snare' || !(n.dur > 0)) continue;
        assert.equal(bar.section, 'drop', 'a press roll only in a chorus');
        rolls++;
      }
    }
  }
  assert.ok(rolls > 0, 'some jazz choruses end on a press roll');
});
