// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOW_TUNING, bowSource, bowString, type BowNote } from './lofi-bowed.ts';
import { KAMANCHEH_PLAYER, bowKamancheh, kamanchehPlay, kamanchehTuning } from './lofi-spike-fiddles.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (midi: number, vel: number, more: Partial<BowNote> = {}): BowNote => ({ sr: SR, f: mtof(midi), vel, dur: 0.8, seconds: 1.1, vibrato: 0, rate: 5.7, slide: 0, ...more });

/** A harmonic's level (dB) over samples a..b, by Goertzel's recurrence. */
function goertzel(x: Float32Array, hz: number, a: number, b: number): number {
  const w = (2 * Math.PI * hz) / SR, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = a; i < b; i++) { const s0 = x[i]! + c * s1 - s2; s2 = s1; s1 = s0; }
  return 10 * Math.log10(s1 * s1 + s2 * s2 - c * s1 * s2 + 1e-30);
}
/**
 * A harmonic's level (dB) between `a` and `b` seconds: its power over 0.1 s windows,
 * averaged, each the highest of five filters a few cents apart, so the cents a finger
 * wanders do not move a high harmonic off the filter.
 */
function harmonic(x: Float32Array, f: number, h: number, a = 0.35, b = 0.75): number {
  let p = 0, n = 0;
  for (let t = a; t + 0.1 <= b + 1e-9; t += 0.1, n++) {
    let best = -Infinity;
    for (const c of [-12, -6, 0, 6, 12]) best = Math.max(best, goertzel(x, f * h * 2 ** (c / 1200), Math.floor(t * SR), Math.floor((t + 0.1) * SR)));
    p += 10 ** (best / 10);
  }
  return 10 * Math.log10(p / n);
}
function rms(x: Float32Array, a: number, b: number): number {
  let s = 0;
  for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / ((b - a) * SR));
}

test('the kamancheh speaks at its note, in Helmholtz motion, from its low strings to the top of the composer\'s range', () => {
  for (const midi of [55, 60, 64, 69, 74, 79, 84]) for (const vel of [0.3, 0.85]) {
    const x = bowKamancheh(note(midi, vel), seeded(midi));
    assert.ok(x.every(Number.isFinite), `${midi} ${vel}: finite`);
    assert.ok(rms(x, 0.35, 0.75) > 1e-4, `${midi} ${vel}: it sounds`);
    // Held, the string's own force on the bridge stays a sawtooth: the fundamental leads in
    // every window (its pitch wanders a few cents, so the windows are short).
    const s = bowSource(note(midi, vel, { seconds: 0.8 }), seeded(midi), kamanchehTuning(mtof(midi)));
    const why = jumped(s, () => mtof(midi), 0.3);
    assert.equal(why, undefined, `${midi} ${vel}: ${why}`);
  }
});

/**
 * The recorded kamancheh's held harmonics 1 to 8 (dB against the note's power over them),
 * averaged over each register: the PCMIR recordings (see lofi-spike-fiddles.ts).
 */
const RECORDED: ReadonlyArray<readonly [number, number, readonly number[]]> = [
  [60, 66, [-15.4, -4.3, -9.1, -11.3, -13.4, -16.0, -16.1, -18.3]],
  [67, 73, [-8.3, -6.8, -8.8, -11.6, -14.4, -16.5, -19.9, -22.3]],
  [74, 80, [-2.7, -8.5, -13.8, -15.7, -17.8, -23.2, -26.3, -29.5]],
];

test('the skin: held harmonics as the recorded kamancheh\'s, register by register; a low note is mostly its harmonics, where the violin keeps its fundamental', () => {
  // At the strength the station plays a Persian lead (about 0.73).
  for (const [lo, hi, rec] of RECORDED) {
    const sum = new Array(8).fill(0);
    let n = 0;
    for (let midi = lo; midi <= hi; midi++) {
      const f = mtof(midi), x = bowKamancheh(note(midi, 0.73), seeded(midi));
      const lv = Array.from({ length: 8 }, (_, k) => harmonic(x, f, k + 1));
      const own = 10 * Math.log10(lv.reduce((a, l) => a + 10 ** (l / 10), 0));
      lv.forEach((l, k) => { sum[k] += 10 ** ((l - own) / 20); });
      n++;
    }
    const model = sum.map((a: number) => 20 * Math.log10(a / n));
    const off = model.map((m: number, k: number) => m - rec[k]!);
    const rms = Math.sqrt(off.reduce((p: number, d: number) => p + d * d, 0) / off.length);
    assert.ok(rms < 2.5 && off.every((d: number) => Math.abs(d) < 5), `${lo} to ${hi}: model less recorded ${off.map((d: number) => d.toFixed(1)).join(' ')} dB (rms ${rms.toFixed(1)})`);
    if (process.env.SHOW) console.log(lo, hi, off.map((d: number) => d.toFixed(1)).join(' '), rms.toFixed(2));
  }
  // The fundamental of C4 to E4 against the 3rd and 4th harmonics: recorded about -5 dB
  // over C4 to F#4 (here about -9), a violin's about +14.
  let kam = 0, vln = 0;
  for (const midi of [60, 62, 64]) for (const seed of [1, 2]) {
    const f = mtof(midi);
    const low = (x: Float32Array): number => harmonic(x, f, 1) - (harmonic(x, f, 3) + harmonic(x, f, 4)) / 2;
    kam += low(bowKamancheh(note(midi, 0.73), seeded(seed))) / 6;
    vln += low(bowString(note(midi, 0.73), seeded(seed))) / 6;
  }
  if (process.env.SHOW) console.log('low fundamental', kam.toFixed(1), vln.toFixed(1));
  assert.ok(kam > -11 && kam < -2, `the kamancheh's low fundamental ${kam.toFixed(1)} dB`);
  assert.ok(vln > kam + 12, `the violin's ${vln.toFixed(1)} dB`);
});

test('the player sings about half the held notes, wide, at five to six a second, and turns and slides some bent notes', () => {
  const rand = seeded(9);
  const depths: number[] = [], rates: number[] = [];
  let sung = 0, held = 0, slides = 0, turns = 0, bent = 0, shortSung = 0;
  for (let i = 0; i < 4000; i++) {
    const p = kamanchehPlay({ held: 0.6, art: i % 2, slurred: false }, rand);
    held++;
    if (p.vibrato) { sung++; depths.push(p.vibrato); }
    rates.push(p.rate);
    if (i % 2) { bent++; if (p.slide) slides++; if (p.bend) turns++; }
    if (kamanchehPlay({ held: 0.2, art: 0, slurred: false }, rand).vibrato) shortSung++;
  }
  depths.sort((a, b) => a - b); rates.sort((a, b) => a - b);
  const q = (a: number[], p: number): number => a[Math.floor(p * (a.length - 1))]!;
  assert.ok(Math.abs(sung / held - KAMANCHEH_PLAYER.vibratoShare) < 0.03, `sung ${(sung / held).toFixed(2)}`);
  assert.equal(shortSung, 0, 'a short note does not sing');
  // Recorded: half the swing 9, 15 and 26 cents at the quartiles; 4.7 to 6.3 a second.
  assert.ok(q(depths, 0.25) > 7 && q(depths, 0.25) < 12 && q(depths, 0.5) > 12 && q(depths, 0.5) < 18 && q(depths, 0.75) > 20 && q(depths, 0.75) < 30, `depths ${q(depths, 0.25).toFixed(1)} ${q(depths, 0.5).toFixed(1)} ${q(depths, 0.75).toFixed(1)}`);
  assert.ok(depths[0]! >= 5 && depths[depths.length - 1]! <= 50, 'within 5 to 50 cents');
  assert.ok(q(rates, 0.25) > 5.2 && q(rates, 0.75) < 7, `rates ${q(rates, 0.25).toFixed(2)} to ${q(rates, 0.75).toFixed(2)}`);
  assert.ok(Math.abs(slides / bent - KAMANCHEH_PLAYER.slideShare) < 0.03, `slides ${(slides / bent).toFixed(2)}`);
  assert.ok(Math.abs(turns / bent - KAMANCHEH_PLAYER.turnShare) < 0.03, `turns ${(turns / bent).toFixed(2)}`);
  // A turn goes to a neighbour and comes back: nothing is left over once it is done.
  const r2 = seeded(3);
  for (let i = 0; i < 200; i++) {
    const p = kamanchehPlay({ held: 1, art: 1, slurred: false }, r2);
    if (!p.bend) continue;
    const peak = Math.max(...Array.from({ length: 100 }, (_, k) => Math.abs(p.bend!(k / 200))));
    assert.ok(peak > 50 && peak < 400, `a turn's reach ${peak.toFixed(0)} cents`);
    assert.ok(Math.abs(p.bend(0.9)) < 1e-9, 'and back by the end');
  }
});

test('the same kamancheh note bows the same; the fiddle\'s string is unchanged by it', () => {
  const p = kamanchehPlay({ held: 0.8, art: 1, slurred: false }, seeded(4));
  assert.deepEqual(bowKamancheh(note(70, 0.6, p), seeded(5)), bowKamancheh(note(70, 0.6, p), seeded(5)));
  // The constants the kamancheh adds to the string leave the fiddle's as they were.
  assert.equal(BOW_TUNING.rosinFollow, 0);
});

/**
 * Whether the string's force on the bridge has left Helmholtz motion anywhere from `from`
 * s on (as lofi-bowed.test.ts): in a window, the 2nd harmonic over the fundamental by more
 * than 1 dB, or the wave nearly repeating at half its period (an octave).
 */
function jumped(x: Float32Array, fAt: (s: number) => number, from: number): string | undefined {
  const lowest = Math.min(fAt(0), fAt(from), fAt(x.length / SR));
  const win = Math.max(Math.round((4 * SR) / lowest), Math.round(0.03 * SR));
  for (let a = Math.round(from * SR); a + win + SR / lowest + 2 < x.length; a += win) {
    // The pitch the hand is at in this window (it moves through a slur, a slide or a turn).
    const f = fAt((a + win / 2) / SR), T = SR / f;
    const L = Math.floor(T / 2), fr = T / 2 - L;
    const d = goertzel(x, f, a, a + win) - goertzel(x, 2 * f, a, a + win);
    let xy = 0, xx = 0, yy = 0;
    for (let i = a; i < a + win; i++) { const y = x[i + L]! * (1 - fr) + x[i + L + 1]! * fr; xy += x[i]! * y; xx += x[i]! * x[i]!; yy += y * y; }
    const half = xy / Math.sqrt(xx * yy + 1e-30);
    if (d < -1 || half > 0.5) return `at ${(a / SR).toFixed(2)} s: 2nd harmonic ${(-d).toFixed(1)} dB over the fundamental, half-period correlation ${half.toFixed(2)}`;
  }
  return undefined;
}

test('the kamancheh never jumps an octave: G3 to D6, every strength, slurred, slid, turned and sung wide', () => {
  assert.ok(KAMANCHEH_PLAYER.turnMost <= 250);
  // The composer hands a Persian kamancheh E4 to C6 (and quarter tones), which the station
  // plays at strengths about 0.65 to 0.8; the instrument's low strings go down to G3. The
  // strengths here are dense there and reach both ends. Odd seeds slur in from one of
  // eight intervals with the kamancheh's slower glide; even seeds start a stroke, every
  // other one slid in by up to a tone from below or above, every fourth with a turn or a
  // wide vibrato.
  const intervals = [-2, 3, -5, 7, -12, 1, 4, -3];
  const bad: string[] = [];
  for (let midi = 55; midi <= 86; midi++) for (const v of [1, 3, 5, 6, 7, 8, 10]) for (let seed = 1; seed <= 8; seed++) {
    const vel = v / 10, f = mtof(midi), rand = seeded(seed * 7919 + midi * 31 + v);
    const slurred = seed % 2 === 1;
    const slide = !slurred && seed % 4 === 2 ? (v % 2 ? 2 : -1) : 0;
    const from = slurred ? mtof(midi + intervals[(seed + midi) % 8]!) : undefined;
    const turn = seed === 4 ? (v % 2 ? 250 : -250) : 0;
    const bend = turn ? (s: number): number => (s > 0.05 && s < 0.2 ? turn * Math.sin(((s - 0.05) / 0.15) * Math.PI) : 0) : undefined;
    // (A turn reaches at most KAMANCHEH_PLAYER.turnMost cents; this one goes there.)
    const glide = slurred ? 0.08 : slide ? 0.2 : 0;
    const x = bowSource(note(midi, vel, {
      dur: 0.3, seconds: 0.3, from, slide, glide: glide || undefined,
      vibrato: seed === 8 ? 50 : 0, bend, reach: turn < 0 ? 2.2 : 0,
    }), rand, kamanchehTuning(f));
    // Where the pitch is: in from the slur or the slide (smoothly, as the hand moves), plus the turn.
    const start = from ?? f * 2 ** (-slide / 12);
    const fAt = (s: number): number => {
      const u = glide ? Math.min(1, s / glide) : 1;
      return start * (f / start) ** (u * u * (3 - 2 * u)) * 2 ** ((bend ? bend(s) : 0) / 1200);
    };
    // A low note's stroke takes longer to speak, in proportion to its period, as the fiddle's.
    const why = jumped(x, fAt, 0.06 * Math.max(1, mtof(64) / f));
    if (why) bad.push(`${midi} at ${vel}${slurred ? ' slurred' : slide ? ' slid' : turn ? ' turned' : ''}, seed ${seed}: ${why}`);
  }
  assert.deepEqual(bad, [], `${bad.length} notes left Helmholtz motion:\n${bad.slice(0, 12).join('\n')}`);
});
