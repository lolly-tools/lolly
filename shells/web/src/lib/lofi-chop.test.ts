// SPDX-License-Identifier: MPL-2.0
/**
 * The vocal chops: the tune's vocal, the chopper's choices and the sung slices.
 *
 * Run directly:  node --test shells/web/src/lib/lofi-chop.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHOP_FALL, CHOP_FLIP, CHOP_GATE, CHOP_ONLY, CHOP_PIECE, CHOP_PLAIN, CHOP_REVERSE, CHOP_SCOOP, CHOP_SLIDE,
  chopMod, chopVocal, chopper, readChop, singChop, type ChopSlice,
} from './lofi-chop.ts';
import { perform } from './lofi-perform.ts';
import { ownOnly } from './lofi-lead-art.ts';
import { composeLofiTune, type LofiMood } from '../../../../engine/src/lofi-compose.ts';

test('a chopped note carries its slice and move in its mod, and a note the chopper never saw reads as none', () => {
  for (const [syllable, gesture, amount, only] of [[0, CHOP_PLAIN, 0, false], [19, CHOP_SLIDE, -7, false], [5, CHOP_FLIP, 12, false], [3, CHOP_REVERSE, 0, true], [8, CHOP_FALL, -5, false]] as const) {
    assert.deepEqual(readChop(chopMod(syllable, gesture, amount, only)), { syllable, gesture, amount, only });
  }
  assert.equal(readChop(0), null);
  assert.equal(readChop(1), null, "the composer's scoop on a plain note is not the chopper's");
  assert.ok(ownOnly(chopMod(2, CHOP_PIECE, 0, true)) && !ownOnly(chopMod(2, CHOP_PIECE)), 'only a stutter piece or a swell is the chop\'s alone');
  assert.ok((chopMod(1, CHOP_REVERSE, 0, true) & CHOP_ONLY) !== 0);
});

test("each tune draws its own vocal from its seed: a singer and six syllables, two of them open vowels", () => {
  const a = chopVocal(7), b = chopVocal(7), c = chopVocal(8);
  assert.deepEqual(a, b, 'the same seed, the same vocal');
  assert.notDeepEqual(a, c, 'another seed, another vocal');
  const kinds = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const v = chopVocal(seed);
    assert.equal(new Set(v.slices).size, 6, 'six different slices');
    assert.ok(v.slices.slice(0, 2).every(s => s <= 5), 'opening on two open vowels');
    assert.equal(v.byPitch.length, 12);
    assert.ok(v.byPitch.every(i => i >= 0 && i < v.slices.length));
    assert.ok(v.tract >= 1.06 && v.tract <= 1.2 && v.breathy > 0 && v.breathy < 0.5);
    kinds.add(v.slices.join(','));
  }
  assert.ok(kinds.size >= 35, `tunes sing different syllables (${kinds.size} vocals in 40)`);
});

/** Every played lead note of a few tunes of a style with the chop leading. */
function chopped(mood: LofiMood, seeds: number[]): Array<{ n: ReturnType<typeof perform>[number]; c: NonNullable<ReturnType<typeof readChop>> }> {
  const out = [];
  for (const seed of seeds) {
    for (const bar of composeLofiTune(seed, mood, { lead: 'chop' })) {
      for (const n of perform(bar, 60 / bar.tune.bpm, bar.tune.style.keys, 'chop')) {
        if (n.voice !== 'lead') continue;
        const c = readChop(n.mod ?? 0);
        assert.ok(c, `${mood} ${seed}: every chopped note says how it is sung`);
        out.push({ n, c });
      }
    }
  }
  return out;
}

test('the chopper plays every move, by the style: future bass flips, gates and stutters; R&B slides and falls', () => {
  const count = (list: ReturnType<typeof chopped>, g: number): number => list.filter(x => x.c.gesture === g).length;
  const sherbert = chopped('sherbert', [1, 2, 3]);
  const rnb = chopped('rnb', [1, 2, 3]);
  for (const g of [CHOP_PLAIN, CHOP_SCOOP, CHOP_SLIDE, CHOP_FLIP, CHOP_GATE, CHOP_REVERSE, CHOP_FALL, CHOP_PIECE]) {
    assert.ok(count(sherbert, g) > 0, `sherbert plays move ${g}`);
  }
  assert.ok(count(sherbert, CHOP_PLAIN) > sherbert.length * 0.35, 'most slices are played as they are');
  assert.ok(count(sherbert, CHOP_FLIP) / sherbert.length > count(rnb, CHOP_FLIP) / rnb.length, 'future bass flips more octaves than R&B');
  assert.ok(count(rnb, CHOP_SLIDE) / rnb.length > count(sherbert, CHOP_SLIDE) / sherbert.length, 'R&B slides more');
  assert.ok(count(rnb, CHOP_FALL) / rnb.length > 0.03, 'R&B falls off its phrases');
  // A slide comes from the note before, within a fifth; a flip is an octave.
  for (const { c } of [...sherbert, ...rnb]) {
    if (c.gesture === CHOP_SLIDE) assert.ok(Math.abs(c.amount) >= 1 && Math.abs(c.amount) <= 7);
    if (c.gesture === CHOP_FLIP) assert.equal(Math.abs(c.amount), 12);
    if (c.gesture === CHOP_GATE) assert.ok(c.amount === 3 || c.amount === 4);
  }
  // A Persian koron's quarter-tone note still finds its slice.
  const koron = chopped('persian', [1, 2, 3]);
  assert.ok(koron.some(x => x.n.midi % 1 !== 0) && koron.every(x => Number.isInteger(x.c.syllable)), 'a quarter-tone note is chopped too');
  // A tune sings several of its syllables.
  const syllables = new Set(chopped('sherbert', [5]).map(x => x.c.syllable));
  assert.ok(syllables.size >= 4, `a tune sings ${syllables.size} syllables`);
});

test('a reversed swell ends as its phrase starts, after a rest, and a stutter\'s pieces come before their note', () => {
  let swells = 0, stutters = 0;
  for (const mood of ['sherbert', 'rnb', 'lofiHouse'] as const) {
    for (const seed of [1, 2, 3, 4]) {
      for (const bar of composeLofiTune(seed, mood, { lead: 'chop' })) {
        const spb = 60 / bar.tune.bpm;
        const lead = perform(bar, spb, bar.tune.style.keys, 'chop').filter(n => n.voice === 'lead');
        for (const [i, n] of lead.entries()) {
          const c = readChop(n.mod ?? 0)!;
          if (c.gesture === CHOP_REVERSE) {
            swells++;
            assert.ok(c.only, 'a swell is the chop\'s alone');
            const next = lead[i + 1];
            assert.ok(next && Math.abs(next.beat - (n.beat + n.dur)) < 0.05, `${mood} ${seed} bar ${bar.index}: the swell runs into its phrase`);
            assert.ok(n.beat >= 0 && n.dur >= 0.5);
          }
          if (c.gesture === CHOP_PIECE && c.only) {
            stutters++;
            const main = lead.slice(i + 1).find(m => !readChop(m.mod ?? 0)!.only);
            assert.ok(main && main.midi === n.midi && readChop(main.mod ?? 0)!.syllable === c.syllable, 'a stutter repeats its note\'s slice');
          }
        }
      }
    }
  }
  assert.ok(swells >= 10, `the odd swell (${swells})`);
  assert.ok(stutters >= 6, `some stutters (${stutters})`);
});

test('the chopper is the same every time, keeps the composer\'s notes, and moves them only milliseconds', () => {
  for (const mood of ['sherbert', 'lofiHouse'] as const) {
    const bars = composeLofiTune(9, mood, { lead: 'chop' });
    for (const bar of bars) {
      const spb = 60 / bar.tune.bpm;
      const a = perform(bar, spb, bar.tune.style.keys, 'chop'), b = perform(bar, spb, bar.tune.style.keys, 'chop');
      assert.deepEqual(a, b);
      const written = bar.notes.filter(n => n.voice === 'lead');
      const played = a.filter(n => n.voice === 'lead' && !readChop(n.mod ?? 0)!.only);
      assert.equal(played.length, written.length, 'every written note is sung');
      for (const [i, n] of played.entries()) {
        assert.equal(n.midi, written[i]!.midi, 'on its written pitch (a flip is the voice\'s)');
        const ms = Math.abs(n.beat - written[i]!.beat) * spb * 1000;
        // A stuttered note starts after its pieces; otherwise a few milliseconds either way.
        assert.ok(ms < (mood === 'sherbert' ? 40 + spb * 1000 : 30 + spb * 1000), `${mood} bar ${bar.index}: moved ${ms.toFixed(1)} ms`);
      }
    }
  }
  // A bar with no lead comes back as it was.
  const quiet = composeLofiTune(9, 'sherbert', { lead: 'chop' }).find(b => !b.notes.some(n => n.voice === 'lead'))!;
  assert.deepEqual(chopper([...quiet.notes], quiet, 0.42, () => 0.5), quiet.notes);
});

const SR = 22050;
const slice = (over: Partial<ChopSlice> = {}): ChopSlice => ({ syllable: 8, midi: 72, dur: 0.6, vel: 0.6, gesture: CHOP_PLAIN, amount: 0, beat: 0.42, vocal: chopVocal(3), take: 0.4, ...over });
const rms = (x: Float32Array, from = 0, to = x.length): number => { let e = 0; for (let i = from; i < to; i++) e += x[i]! ** 2; return Math.sqrt(e / Math.max(1, to - from)); };
/** Brightness: the share of a signal's energy above 2.5 kHz (two passes of a cookbook high-pass), in dB. */
function bright(x: Float32Array): number {
  const w = (2 * Math.PI * 2500) / SR, alpha = Math.sin(w) / (2 * Math.SQRT1_2), c = Math.cos(w), a0 = 1 + alpha;
  const b = [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0], a = [(-2 * c) / a0, (1 - alpha) / a0];
  let y = Float64Array.from(x);
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float64Array(y.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) { const v = b[0]! * y[i]! + b[1]! * x1 + b[2]! * x2 - a[0]! * y1 - a[1]! * y2; x2 = x1; x1 = y[i]!; y2 = y1; y1 = v; out[i] = v; }
    y = out;
  }
  let hi = 0, all = 0;
  for (let i = 0; i < x.length; i++) { hi += y[i]! ** 2; all += x[i]! ** 2; }
  return 10 * Math.log10(hi / Math.max(1e-12, all));
}

test('a slice is sung in stereo, the same every time, louder and brighter the harder it is sung', () => {
  const [L, R] = singChop(SR, slice(), 5);
  assert.equal(L.length, R.length);
  assert.ok(L.every(Number.isFinite) && R.every(Number.isFinite));
  assert.ok(Math.abs(L.length / SR - 0.65) < 0.05, 'as long as the note, and a little tail');
  assert.ok(rms(L) > 0.01 && Math.max(...L.map(Math.abs)) < 1, 'a sensible level');
  let diff = 0;
  for (let i = 0; i < L.length; i++) diff += (L[i]! - R[i]!) ** 2;
  assert.ok(diff > 0, 'double-tracked: the two sides differ');
  assert.deepEqual(singChop(SR, slice(), 5), [L, R], 'the same slice, the same bytes');
  const soft = singChop(SR, slice({ vel: 0.3 }), 5)[0], hard = singChop(SR, slice({ vel: 0.9 }), 5)[0];
  assert.ok(rms(hard) / rms(soft) > 2.5, 'louder');
  assert.ok(bright(hard) > bright(soft) + 4, `brighter (${bright(hard).toFixed(1)} dB above 2.5 kHz against ${bright(soft).toFixed(1)})`);
  assert.notDeepEqual(singChop(SR, slice({ take: 0.1 }), 5)[0], singChop(SR, slice({ take: 0.9 }), 5)[0], 'each take its own');
});

test('a reversed slice swells into its end, a gated one opens and shuts on the beat, and a flip sings an octave up', () => {
  const [rev] = singChop(SR, slice({ gesture: CHOP_REVERSE, dur: 0.8 }), 5);
  const q = Math.floor(rev.length / 4);
  assert.ok(rms(rev, 3 * q) > rms(rev, 0, q) * 3, 'quiet at first, swelling to the end');
  const beat = 0.4;
  const [gated] = singChop(SR, slice({ gesture: CHOP_GATE, amount: 4, dur: 0.8, beat }), 5);
  const step = (beat / 4) * SR;
  // Shut for the last third of each sixteenth, open in its middle.
  for (let k = 1; k < 7; k++) {
    const shut = rms(gated, Math.floor(step * k + step * 0.72), Math.floor(step * k + step * 0.95));
    const open = rms(gated, Math.floor(step * k + step * 0.15), Math.floor(step * k + step * 0.55));
    assert.ok(shut < open * 0.05, `step ${k}: gated shut`);
  }
  /** The period (samples) of a steady stretch: the shortest lag that repeats nearly as well as the best. */
  const period = (x: Float32Array): number => {
    const from = Math.floor(x.length * 0.4), n = 2048;
    const r = (lag: number): number => { let s = 0; for (let i = from; i < from + n; i++) s += x[i]! * x[i + lag]!; return s; };
    const lags = Array.from({ length: 200 }, (_, i) => i + 15);
    const best = Math.max(...lags.map(r));
    return lags.find(l => r(l) > 0.85 * best && r(l) >= r(l - 1) && r(l) >= r(l + 1))!;
  };
  // Sung on "ooh", whose low first formant leaves the fundamental the strongest partial.
  const plain = singChop(SR, slice({ syllable: 2, midi: 64, dur: 0.5 }), 5)[0], up = singChop(SR, slice({ syllable: 2, midi: 64, dur: 0.5, gesture: CHOP_FLIP, amount: 12 }), 5)[0];
  const ratio = period(plain) / period(up);
  assert.ok(Math.abs(ratio - 2) < 0.15, `the flip sings an octave up (periods ${period(plain)} and ${period(up)})`);
});
