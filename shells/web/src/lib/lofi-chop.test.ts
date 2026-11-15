// SPDX-License-Identifier: MPL-2.0
/**
 * The vocal chops: the tune's vocal, the chopper's choices and the sung slices, and the
 * four voices that sing them (lib/lofi-chop-voices.ts).
 *
 * Run directly:  node --test shells/web/src/lib/lofi-chop.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHOP_FALL, CHOP_FLIP, CHOP_GATE, CHOP_ONLY, CHOP_PIECE, CHOP_PLAIN, CHOP_REVERSE, CHOP_SCOOP, CHOP_SLIDE,
  castOf, chopMod, chopVocal, chopper, leadMean, readChop, singChop, type ChopSlice,
} from './lofi-chop.ts';
import { CHOP_VOICE, LEGACY_VOICE, upperShare } from './lofi-chop-voices.ts';
import { CHOP_LEADS, chopCasting, type ChopVoice } from '../../../../engine/src/lofi-chop-cast.ts';
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

// ── the voices ──────────────────────────────────────────────────────────────

const fnvBytes = (xs: Float32Array[]): number => { let h = 2166136261; for (const x of xs) { const b = new Uint8Array(x.buffer, x.byteOffset, x.byteLength); for (let i = 0; i < b.length; i++) { h ^= b[i]!; h = Math.imul(h, 16777619) >>> 0; } } return h; };

test('the chop voice as it was sings the same bytes, so the botanica grains that sing it are unchanged', () => {
  // Hashes of singChop's output with the vocal drawn with no voice, taken before the voices were measured.
  const want = [4198412037, 2561836990, 3925384359, 1923474909, 4158614919, 1287893451];
  const overs: Array<Partial<ChopSlice>> = [{}, { syllable: 2, midi: 64, gesture: CHOP_FLIP, amount: 12 }, { gesture: CHOP_REVERSE, dur: 0.8 }, { gesture: CHOP_GATE, amount: 4, dur: 0.8 }, { syllable: 12, vel: 0.9, gesture: CHOP_FALL, amount: -4 }, { syllable: 6, gesture: CHOP_SLIDE, amount: -3, vel: 0.3 }];
  for (const [i, over] of overs.entries()) assert.equal(fnvBytes(singChop(44100, slice(over), 5)), want[i], `slice ${i}`);
  assert.equal(chopVocal(3).spec, LEGACY_VOICE);
});

test("the genre's own chop (`chop`) still plays a woman's tunes the chopper's way: Sherbert and Sugar, the same every time", () => {
  // These were exact fingerprints of the performed bars, but the same commit fingerprints
  // differently on CI's Linux runners and on a Mac, so the pin tested the machine rather
  // than the music. What the pin stood for is checked here instead: a woman's chops are
  // performed the same every time, and keep the chopper's own moves (scoops, slides,
  // flips and falls), with no children's choir in these tunes.
  for (const [mood, seed] of [['sherbert', 3], ['sugar', 3]] as const) {
    const key = `${mood}.${seed}`;
    assert.equal(chopCasting(mood, seed).choirIn.length, 0, `${key} has no choir`);
    const bars = composeLofiTune(seed, mood, { lead: 'chop' });
    const once = JSON.stringify(bars.map(b => perform(b, 60 / b.tune.bpm, b.tune.style.keys, 'chop')));
    const again = JSON.stringify(composeLofiTune(seed, mood, { lead: 'chop' }).map(b => perform(b, 60 / b.tune.bpm, b.tune.style.keys, 'chop')));
    assert.equal(once, again, `${key} is performed the same every time`);
    const moves = new Set(chopped(mood, [seed]).map(({ c }) => c.gesture));
    for (const g of [CHOP_SCOOP, CHOP_SLIDE, CHOP_FLIP]) assert.ok(moves.has(g), `${key} keeps the chopper's move ${g}`);
  }
});

test('each voice is measured: a man\'s formants under a woman\'s, a child\'s over them, each its own range, turn and vibrato', () => {
  const { female, male, baritone, child } = CHOP_VOICE;
  for (const v of ['ah', 'ee', 'oo'] as const) {
    for (let j = 0; j < 3; j++) {
      const m = male.vowels[v][j]! / female.vowels[v][j]!, c = child.vowels[v][j]! / female.vowels[v][j]!;
      assert.ok(m > 0.72 && m < 0.95, `a man's ${v} F${j + 1} is ${m.toFixed(2)} of a woman's`);
      assert.ok(c > 0.98 && c < 1.25, `a child's ${v} F${j + 1} is ${c.toFixed(2)} of a woman's`);
    }
  }
  assert.ok(baritone.tract[1] <= male.tract[1] && baritone.tract[0] < male.tract[0], 'a baritone\'s tract is the longer');
  assert.ok(baritone.ringHz < male.ringHz && male.ring > female.ring && child.ring === 0, 'the ring: lower for a baritone, a woman\'s fainter, none in a child');
  assert.ok(baritone.range[1] < male.range[1] && male.range[1] < female.range[1], 'each voice\'s range');
  assert.ok(baritone.flip <= male.flip && male.flip < female.range[1], 'a man turns over into falsetto, a baritone sooner');
  assert.ok(male.high.open > male.low.open && male.highLevel < 1, 'his falsetto is open and quieter');
  assert.ok(baritone.vibRate[1] < female.vibRate[1] && baritone.vibRate[0] < female.vibRate[0], 'a baritone\'s vibrato is slower');
  assert.ok(child.vibDepth[0] < female.vibDepth[0] && child.vibDepth[1] < female.vibDepth[1] && child.vibShare < 1 && child.vibRate[1] < female.vibRate[0], 'a child has a small, slow vibrato, on few notes');
  assert.ok(child.jitter > female.jitter && child.shimmer > female.shimmer && child.breathy[0] > female.breathy[1] - 0.1 && child.drift > 0, 'a child\'s voice wobbles more, drifts and is breathier');
  assert.ok(baritone.glide > male.glide && male.glide >= female.glide && child.glide < female.glide, 'a baritone slides slowest, a child quickest');
  assert.equal(upperShare(male, male.flip - 1), 0);
  assert.equal(upperShare(male, male.flip + male.flipSpan + 1), 1);
});

/** A slice sung by a voice at a note, one take. */
const voiced = (voice: ChopVoice, midi: number, over: Partial<ChopSlice> = {}): Float32Array => singChop(SR, slice({ syllable: 0, midi, dur: 0.6, vocal: chopVocal(3, undefined, voice), ...over }), 5, 1)[0];
/** The fundamental's level against the second harmonic's (dB), by correlating with each over the slice's middle. */
function h1h2(x: Float32Array, midi: number): number {
  const f = 440 * 2 ** ((midi - 69) / 12), from = Math.floor(x.length * 0.35), to = Math.floor(x.length * 0.8);
  const amp = (hz: number): number => { let c = 0, s = 0; for (let i = from; i < to; i++) { const w = (2 * Math.PI * hz * i) / SR; c += x[i]! * Math.cos(w); s += x[i]! * Math.sin(w); } return Math.hypot(c, s); };
  return 20 * Math.log10(amp(f) / amp(2 * f));
}

/** Darkness: the share of a signal's energy under 1 kHz (two passes of a one-pole low-pass), in dB. */
function dark(x: Float32Array): number {
  const k = 1 - Math.exp((-2 * Math.PI * 1000) / SR);
  let a = 0, b = 0, lo = 0, all = 0;
  for (const v of x) { a += k * (v - a); b += k * (a - b); lo += b * b; all += v * v; }
  return 10 * Math.log10(lo / Math.max(1e-12, all));
}

test('the voices sound as measured: a baritone darker than a woman, a man\'s falsetto open and soft, a child light', () => {
  const woman = voiced('female', 72), bari = voiced('baritone', 52), man = voiced('male', 57);
  assert.ok(dark(bari) > dark(woman) + 3, `a baritone is darker (${dark(bari).toFixed(1)} dB of his energy under 1 kHz against her ${dark(woman).toFixed(1)})`);
  // A man just under his turn and well over it: over it, the fundamental leads and the top falls away.
  const chest = voiced('male', CHOP_VOICE.male.flip - 2), falsetto = voiced('male', CHOP_VOICE.male.flip + CHOP_VOICE.male.flipSpan + 1);
  assert.ok(h1h2(falsetto, CHOP_VOICE.male.flip + CHOP_VOICE.male.flipSpan + 1) > h1h2(chest, CHOP_VOICE.male.flip - 2) + 4, 'falsetto: the fundamental leads');
  assert.ok(bright(falsetto) < bright(chest) - 2, 'falsetto is darker');
  assert.ok(rms(falsetto) < rms(chest), 'and quieter');
  assert.ok(rms(man) > 0.01 && man.every(Number.isFinite));
  // A child sings lighter than a woman at the same note and strength.
  assert.ok(rms(voiced('child', 72)) < rms(woman), 'a child is lighter');
  // One take: mono, the same array on both sides, for a player to place.
  const [l, r] = singChop(SR, slice({ vocal: chopVocal(3, undefined, 'child') }), 5, 1);
  assert.equal(l, r);
  // A sped-up sample's formants rise with it: brighter than the voice as it is.
  assert.ok(bright(singChop(SR, slice({ syllable: 0, vocal: chopVocal(3, undefined, 'female', 1.18) }), 5, 1)[0]) > bright(voiced('female', 72)), 'sped up, brighter');
});

test('the chopper suits its moves to the voice: a baritone flips less than a woman, a child falls and slides less', () => {
  const moves = (lead: string): Record<number, number> => {
    const n: Record<number, number> = {};
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const bar of composeLofiTune(seed, 'sherbert', { lead: lead as never })) {
        for (const x of perform(bar, 60 / bar.tune.bpm, bar.tune.style.keys, lead as never)) {
          const c = x.voice === 'lead' ? readChop(x.mod ?? 0) : null;
          if (c) n[c.gesture] = (n[c.gesture] ?? 0) + 1;
        }
      }
    }
    return n;
  };
  const woman = moves('chopFemale'), bari = moves('chopBaritone'), kid = moves('chopChild');
  assert.ok((bari[CHOP_FLIP] ?? 0) < (woman[CHOP_FLIP] ?? 0) * 0.7, `a baritone flips less (${bari[CHOP_FLIP]} against ${woman[CHOP_FLIP]})`);
  assert.ok((kid[CHOP_FALL] ?? 0) < (woman[CHOP_FALL] ?? 0) * 0.8, `a child falls less (${kid[CHOP_FALL]} against ${woman[CHOP_FALL]})`);
  assert.ok((kid[CHOP_SLIDE] ?? 0) < (woman[CHOP_SLIDE] ?? 0), 'and slides less');
  // Every chop lead is chopped, and its notes say how each is sung.
  for (const lead of CHOP_LEADS) assert.ok(Object.values(moves(lead)).reduce((a, b) => a + b, 0) > 50, `${lead} is chopped`);
});

test('a chop names who sings it: a group is each its own voice, and a voice alone is not the one before the voices', () => {
  const bar = composeLofiTune(4, 'sherbert', { lead: 'chop' }).find(b => b.notes.some(n => n.voice === 'lead'))!;
  assert.deepEqual(castOf('chopChoir', bar).map(s => s.voice), ['child', 'child', 'child', 'child', 'child']);
  const v = chopVocal(4, undefined, 'baritone');
  assert.equal(v.spec, CHOP_VOICE.baritone);
  assert.ok(v.tract >= CHOP_VOICE.baritone.tract[0] && v.tract <= CHOP_VOICE.baritone.tract[1]);
  assert.deepEqual(v.slices, chopVocal(4).slices, 'the same syllables whoever sings them');
  assert.notDeepEqual(chopVocal(4, undefined, 'child').vibRate, chopVocal(4).vibRate);
  assert.equal(leadMean([]), 72);
});
