// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAT_BELL, fingerChord, flautist, perform, trumpeter } from './lofi-perform.ts';
import { TRUMPET_PLAYED, TRUMPET_SCOOP, TRUMPET_SLUR, TRUMPET_TONGUE } from './lofi-brass.ts';
import { composerMod, FLUTE_BREATH, FLUTE_KU, FLUTE_PLAYED, FLUTE_SCOOP, FLUTE_SOFT, FLUTE_STOP, FLUTE_SWELL, FLUTE_TAPER } from './lofi-flutes.ts';
import { composeLofiTune, ELECTRIC_FRET, type LofiBar, type LofiNote } from '../../../../engine/src/lofi-compose.ts';

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
      if ((n.mod ?? 0) % ELECTRIC_FRET === 1) bends++;
      if ((n.mod ?? 0) % ELECTRIC_FRET === 2) slides++;
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

test('a flautist marks every lead note as its own, half-tongues close notes and stops the one before, and breathes in a rest', () => {
  const lead = (beat: number, dur: number, mod?: number): LofiNote => ({ voice: 'lead', midi: 72, beat, dur, vel: 0.55, ...(mod ? { mod } : {}) });
  const spb = 0.5;
  let soft = 0, stops = 0, shaped = 0, breaths = 0;
  for (let seed = 1; seed <= 40; seed++) {
    let a = seed;
    const rand = (): number => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
    // a close pair (a 0.2-beat gap is 0.1 s), a held note (0.6 s), then a rest of 0.45 s and a last note
    const notes: LofiNote[] = [lead(0, 0.8, 1), lead(1, 0.8), lead(1.8, 1.2), lead(3.9, 0.1), { voice: 'kick', midi: 36, beat: 0, dur: 0, vel: 1 }];
    flautist(notes, spb, rand);
    for (const n of notes.slice(0, 4)) assert.ok((n.mod ?? 0) & FLUTE_PLAYED, 'every lead note carries the flute\'s mark');
    assert.equal(notes[4]!.mod, undefined, 'other parts are left alone');
    assert.ok(notes[0]!.mod! & FLUTE_SCOOP, 'the composer\'s bend is kept as a scoop');
    if (notes[1]!.mod! & FLUTE_SOFT) soft++;
    if (notes[0]!.mod! & FLUTE_STOP) stops++;
    if (notes[2]!.mod! & (FLUTE_SWELL | FLUTE_TAPER)) shaped++;
    if (notes[2]!.mod! & FLUTE_BREATH) breaths++;
    assert.equal(notes[1]!.mod! & FLUTE_BREATH, 0, 'no breath in a gap too short for one');
    assert.equal(notes[2]!.mod! & FLUTE_STOP, 0, 'a note before a rest is let go, not stopped');
  }
  assert.equal(stops, 40, 'a note followed close by another is always stopped by the tongue');
  assert.ok(soft > 20 && soft < 40, `most close notes half-tongued (${soft} of 40)`);
  assert.ok(shaped > 20 && shaped < 40, `most held notes shaped (${shaped} of 40)`);
  assert.ok(breaths > 20 && breaths < 40, `most long rests breathed in (${breaths} of 40)`);
  // An instrument doubling the flute reads only the composer's articulation.
  assert.equal(composerMod(FLUTE_PLAYED | FLUTE_SOFT | FLUTE_SCOOP), FLUTE_SCOOP);
  assert.equal(composerMod(FLUTE_PLAYED | FLUTE_BREATH), 0);
  assert.equal(composerMod(1), 1);
  assert.equal(composerMod(ELECTRIC_FRET * 3 + 2), ELECTRIC_FRET * 3 + 2);
});

test('a flautist double-tongues a quick run: every other note a "ku"', () => {
  const run: LofiNote[] = [0, 0.5, 1, 1.5, 2, 2.5].map((beat) => ({ voice: 'lead', midi: 72 + beat * 2, beat, dur: 0.3, vel: 0.55 }));
  flautist(run, 0.5, () => 0.5);
  // A 0.3-beat note is 0.15 s, with 0.1 s between: the first note starts the run, the rest alternate "ku", "tu".
  assert.deepEqual(run.map((n) => (n.mod! & FLUTE_KU ? 'ku' : 'tu')), ['tu', 'ku', 'tu', 'ku', 'tu', 'ku']);
  const slow: LofiNote[] = [0, 1, 2].map((beat) => ({ voice: 'lead', midi: 72, beat, dur: 0.8, vel: 0.55 }));
  flautist(slow, 0.5, () => 0.5);
  assert.ok(slow.every((n) => !(n.mod! & FLUTE_KU)), 'held notes are not double-tongued');
});

/** Every lead bar of a few jazz tunes with a trumpet lead: the line as written and as the trumpeter plays the line. */
function trumpetBars(): Array<{ written: LofiNote[]; played: LofiNote[]; bar: LofiBar }> {
  const out: Array<{ written: LofiNote[]; played: LofiNote[]; bar: LofiBar }> = [];
  for (const seed of [11, 12, 13, 14, 15, 16]) {
    for (const bar of composeLofiTune(seed, 'jazz', { lead: 'trumpet' })) {
      const spb = 60 / bar.tune.bpm;
      const written = bar.notes.filter(n => n.voice === 'lead').sort((a, b) => a.beat - b.beat);
      if (!written.length) continue;
      const played = perform(bar, spb, bar.tune.style.keys, 'trumpet').filter(n => n.voice === 'lead').sort((a, b) => a.beat - b.beat);
      out.push({ written, played, bar });
    }
  }
  return out;
}

test('a trumpeter slurs by the interval as recorded players do, holds the line legato and keeps its harmony and rhythm', () => {
  const bars = trumpetBars();
  const slurs: Record<string, [number, number]> = { step: [0, 0], third: [0, 0], wide: [0, 0] };
  let leaps = 0, back = 0, repeats = 0, moves = 0, gaps = 0, pairs = 0;
  for (const { written, played, bar } of bars) {
    const spb = 60 / bar.tune.bpm;
    for (const n of played) assert.ok((n.mod ?? 0) & TRUMPET_PLAYED && (n.mod! & (TRUMPET_SLUR | TRUMPET_TONGUE)), 'every note is the trumpeter\'s, slurred or tongued');
    // Harmony and rhythm: every note on the beat keeps its pitch, and every written start is still played.
    for (const w of written) {
      const p = played.find(n => Math.abs(n.beat - w.beat) < 1e-9);
      assert.ok(p, 'the written start is played');
      if (Math.abs(w.beat - Math.round(w.beat)) < 0.02) assert.equal(p!.midi, w.midi, 'a note on the beat keeps its pitch');
      if (w.mod === 1) assert.ok(p!.mod! & TRUMPET_SCOOP, 'the composer\'s bend is kept');
    }
    for (let i = 1; i < played.length; i++) {
      const a = played[i - 1]!, b = played[i]!, iv = Math.abs(b.midi - a.midi);
      moves++;
      if (iv === 0) { repeats++; assert.ok(!(b.mod! & TRUMPET_SLUR), 'a repeated note is tongued'); continue; }
      const k = iv <= 2 ? 'step' : iv <= 4 ? 'third' : 'wide';
      slurs[k]![1]++;
      if (b.mod! & TRUMPET_SLUR) slurs[k]![0]++;
      pairs++;
      const gap = (b.beat - (a.beat + a.dur)) * spb;
      if (gap > 0.04 && gap < 0.3) gaps++;
      if (i >= 2 && Math.abs(a.midi - played[i - 2]!.midi) >= 5) { leaps++; if (iv <= 2 && Math.sign(b.midi - a.midi) !== Math.sign(a.midi - played[i - 2]!.midi)) back++; }
    }
  }
  const share = (k: string) => slurs[k]![0] / slurs[k]![1];
  // Recorded: steps 68 to 77 % slurred, thirds 26 to 29 %, wider 11 to 24 %; written (by timing) 35, 25 and 70.
  assert.ok(share('step') > 0.58 && share('step') < 0.82, `steps slurred ${share('step')}`);
  assert.ok(share('third') > 0.15 && share('third') < 0.38, `thirds slurred ${share('third')}`);
  assert.ok(share('wide') < 0.32, `wider moves slurred ${share('wide')}`);
  // Legato: no short gaps left between the notes of a phrase.
  assert.ok(gaps / pairs < 0.05, `short gaps ${gaps} of ${pairs}`);
  // After a leap a step back, a third of the time or so (recorded 32 to 33 %, written 9 %); fewer repeated notes (recorded 5 to 7 %, written 12 %).
  assert.ok(back / leaps > 0.2, `step back after a leap ${back} of ${leaps}`);
  assert.ok(repeats / moves < 0.1, `repeated notes ${repeats} of ${moves}`);
});

test('a trumpeter leaves a section\'s line alone, and the same bar plays the same', () => {
  for (const bar of composeLofiTune(21, 'ska', { lead: 'trumpet' }).slice(0, 24)) {
    const spb = 60 / bar.tune.bpm;
    const played = perform(bar, spb, bar.tune.style.keys, 'trumpet').filter(n => n.voice === 'lead');
    for (const n of played) assert.ok(!((n.mod ?? 0) & TRUMPET_PLAYED), 'a ska section plays the written line');
  }
  // A tune composed afresh plays the same, bar after bar (each bar follows on from the last).
  const play = () => composeLofiTune(12, 'jazz', { lead: 'trumpet' }).flatMap(bar => trumpeter([...bar.notes], bar, 60 / bar.tune.bpm, (() => { let a = bar.index + 5; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })()).filter(n => n.voice === 'lead').map(n => [n.midi, n.beat, n.dur, n.mod]));
  assert.deepEqual(play(), play());
});
