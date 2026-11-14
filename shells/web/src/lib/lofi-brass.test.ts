// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blowLips, heardSolo, pressure, type Horn, type LipNote } from './lofi-brass.ts';
import { lead, soloist } from './lofi-winds.ts';
import type { VoiceKit } from './lofi-voices.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (horn: Horn, midi: number, vel: number, more: Partial<LipNote> = {}): LipNote => ({ sr: SR, f: mtof(midi), vel, dur: 0.8, seconds: 0.95, horn, scoop: 0, fall: 0, vibrato: 0, rate: 5, ...more });
/** A harmonic's level (dB) between `a` and `b` seconds. */
function harmonic(x: Float32Array, f: number, h: number, a = 0.3, b = 0.7): number {
  const w = (2 * Math.PI * f * h) / SR;
  let re = 0, im = 0;
  for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
  return 10 * Math.log10(re * re + im * im + 1e-20);
}
/** The fundamental's pitch in cents from `f`, by a fine search over the held part. */
function cents(x: Float32Array, f: number): number {
  let best = -Infinity, at = 0;
  for (let c = -40; c <= 40; c += 0.5) { const p = harmonic(x, f * 2 ** (c / 1200), 1); if (p > best) { best = p; at = c; } }
  return at;
}
function rms(x: Float32Array, a: number, b: number): number {
  let s = 0;
  for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / ((b - a) * SR));
}
/** The amplitude-weighted mean harmonic number over the first `k` harmonics: how bright the note is. */
function centroid(x: Float32Array, f: number, k = 14): number {
  let num = 0, den = 0;
  for (let h = 1; h <= k; h++) { const a = 10 ** (harmonic(x, f, h) / 20); num += h * a; den += a; }
  return num / den;
}

test('a trumpet and a trombone speak by themselves, in tune across their range and strengths', () => {
  for (const [horn, notes] of [['trumpet', [55, 62, 70, 77, 84]], ['trombone', [41, 48, 55, 62, 67]]] as const) {
    for (const midi of notes) for (const vel of [0.3, 0.9]) {
      const x = blowLips(note(horn, midi, vel), seeded(midi));
      assert.ok(x.every(Number.isFinite), `${horn} ${midi} ${vel}: finite`);
      assert.ok(rms(x, 0.3, 0.7) > 1e-3, `${horn} ${midi} ${vel}: it sounds (${rms(x, 0.3, 0.7)})`);
      const c = cents(x, mtof(midi));
      assert.ok(Math.abs(c) <= 12, `${horn} ${midi} ${vel}: ${c} cents`);
    }
  }
});

test('blown harder, brass gets brighter, not only louder', () => {
  const f = mtof(70);
  const soft = blowLips(note('trumpet', 70, 0.35), seeded(1));
  const hard = blowLips(note('trumpet', 70, 0.95), seeded(1));
  // A recorded section's held Bb4 sits near the 6th harmonic at ff; softly it is darker by several harmonics.
  assert.ok(centroid(hard, f) > centroid(soft, f) + 1.5, `centroid ${centroid(soft, f).toFixed(2)} -> ${centroid(hard, f).toFixed(2)}`);
  assert.ok(centroid(hard, f) > 5 && centroid(hard, f) < 8, `ff centroid ${centroid(hard, f).toFixed(2)}`);
  // The radiated fundamental sits under the 2nd harmonic, as a bell sends it out.
  assert.ok(harmonic(hard, f, 1) < harmonic(hard, f, 2), 'the bell thins the fundamental');
  // The steady pressure climbs about twentyfold from the softest breath to the hardest.
  assert.ok(pressure('trumpet', 1) / pressure('trumpet', 0) > 15);
});

test('a tongued note speaks within about 40 ms with an accent; a slur glides in without one', () => {
  const f = mtof(70);
  const x = blowLips(note('trumpet', 70, 0.85), seeded(2));
  const steady = rms(x, 0.3, 0.7);
  assert.ok(rms(x, 0.035, 0.045) > steady * 0.7, 'near full by 40 ms');
  assert.ok(rms(x, 0, 0.004) < steady * 0.3, 'not at full at once');
  const peak = Math.max(...[0.03, 0.04, 0.05, 0.06].map((t) => rms(x, t, t + 0.01)));
  assert.ok(peak > steady * 1.05, 'the tongue\'s push stands out at the front');
  const slur = blowLips(note('trumpet', 70, 0.85, { from: mtof(68) }), seeded(2));
  assert.ok(rms(slur, 0.004, 0.012) > rms(x, 0.004, 0.012), 'a slur sounds at once');
  assert.ok(Math.abs(cents(slur, f)) <= 12, 'and arrives in tune');
});

test('the same note blows the same; it ends when the breath stops, or falls off', () => {
  assert.deepEqual(blowLips(note('trumpet', 67, 0.7), seeded(3)), blowLips(note('trumpet', 67, 0.7), seeded(3)));
  const x = blowLips(note('trumpet', 67, 0.7, { dur: 0.3, seconds: 0.6 }), seeded(4));
  assert.ok(rms(x, 0.45, 0.55) < rms(x, 0.15, 0.25) * 0.01, 'silent after the release');
  // A fall slides down from the note as the note ends, well under the written pitch by the end.
  const fall = blowLips(note('trumpet', 72, 0.8, { dur: 0.5, seconds: 0.9, fall: 5 }), seeded(5));
  const f = mtof(72);
  const at = (c: number): number => harmonic(fall, f * 2 ** (c / 1200), 1, 0.55, 0.62);
  assert.ok(at(-300) > at(0), 'well under the note as it falls');
});

// ── the soloist ────────────────────────────────────────────────────────────

/** A harmonic's power from 0.3 to 0.7 s in 50 ms Hann windows, so a held note's few cents of wander do not hide its upper harmonics. */
function power(x: Float32Array, f: number, h: number): number {
  const n = Math.round(0.05 * SR), w = (2 * Math.PI * f * h) / SR;
  let sum = 0, count = 0;
  for (let a = Math.round(0.3 * SR); a + n <= 0.7 * SR; a += n) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const v = x[a + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)); re += v * Math.cos(w * i); im += v * Math.sin(w * i); }
    sum += re * re + im * im; count++;
  }
  return sum / count;
}
/** A third-octave band's energy (dB): the sum of the note's harmonics inside the band. */
function band(x: Float32Array, f: number, centre: number): number {
  const lo = centre / 2 ** (1 / 6), hi = centre * 2 ** (1 / 6);
  let e = 0;
  for (let h = Math.ceil(lo / f); h * f < hi; h++) e += power(x, f, h);
  return 10 * Math.log10(e + 1e-20);
}
/** Bands at 4, 6.3 and 10 kHz against the strongest third-octave from 400 Hz to 3.2 kHz, the median over a few notes of the lead's range. */
function top(vel: number, solo: boolean): number[] {
  const rows = [65, 67, 69, 72, 74, 76, 79].map((midi) => {
    const x = blowLips(note('trumpet', midi, vel), seeded(midi));
    if (solo) heardSolo(x, SR, vel);
    const f = mtof(midi);
    const peak = Math.max(...[400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150].map((c) => band(x, f, c)));
    return [4000, 6300, 10000].map((c) => band(x, f, c) - peak);
  });
  return [0, 1, 2].map((k) => rows.map((r) => r[k]!).sort((a, b) => a - b)[3]!);
}

test('a solo trumpet is heard darker than a section is miked, as recorded soloists are, and brightens as it is blown harder', () => {
  // Recorded solo trumpet at mezzo-forte to forte (Iowa, Philharmonia, solo phrases): about
  // -20, -31 and -47 dB at 4, 6.3 and 10 kHz; the section's model gives about -12, -21, -27.
  const [b4, b6, b10] = top(0.55, true);
  assert.ok(b4! > -26 && b4! < -14, `4 kHz ${b4!.toFixed(1)}`);
  assert.ok(b6! > -38 && b6! < -25, `6.3 kHz ${b6!.toFixed(1)}`);
  assert.ok(b10! > -56 && b10! < -37, `10 kHz ${b10!.toFixed(1)}`);
  const [, s6, s10] = top(0.55, false);
  assert.ok(s6! > b6! + 6 && s10! > b10! + 10, `the section keeps its bright, close-miked top (${s6!.toFixed(1)}, ${s10!.toFixed(1)})`);
  const soft = top(0.3, true)[1]!, loud = top(0.85, true)[1]!;
  assert.ok(soft < b6! - 4 && loud > b6! + 4, `6.3 kHz softly ${soft.toFixed(1)}, mezzo-forte ${b6!.toFixed(1)}, loud ${loud.toFixed(1)}`);
});

/** The pitch (cents from `f`) of a short window starting at `t` s: the lag of least difference near the period. */
function pitchAt(x: Float32Array, f: number, t: number): number {
  const p = SR / f, w = Math.round(0.008 * SR + p), i0 = Math.round(t * SR);
  const diff = (lag: number): number => { let d = 0, e = 0; for (let i = 0; i < w; i++) { const a = x[i0 + i]!, b = x[i0 + i + lag]!; d += (a - b) ** 2; e += a * a + b * b; } return d / e; };
  let at = Math.round(p), best = Infinity;
  for (let lag = Math.floor(p * 0.8); lag <= Math.ceil(p * 1.2); lag++) { const v = diff(lag); if (v < best) { best = v; at = lag; } }
  const a = diff(at - 1), b = diff(at), c = diff(at + 1);
  return 1200 * Math.log2(SR / (at + (0.5 * (a - c)) / (a - 2 * b + c || 1)) / f);
}

test('a soloist lips up into about a quarter of the notes, by about 45 cents, and starts the rest near the note in every register', () => {
  const draw = (art: number) => {
    let lifted = 0;
    for (let s = 1; s <= 400; s++) if (soloist(70, 0.4, art, false, seeded(s)).scoopTime > 0.07) lifted++;
    return lifted / 400;
  };
  const marked = draw(1), other = draw(0);
  assert.ok(marked > 0.32 && marked < 0.48 && other > 0.16 && other < 0.28, `lifted: marked ${marked}, others ${other}`);
  assert.equal(soloist(70, 0.4, 1, true, seeded(1)).scoop, 0, 'a slurred note glides from the last instead');
  // Recorded: lifted notes start a median 45 cents flat (36 to 59 by player) and settle within
  // 15 cents in about 55 ms; all the tongued notes start a median 9 cents under, alike from
  // E3 to F5. The model's lips by themselves start 35 cents sharp at E4 and none by C6.
  const lifted: number[][] = [], plain: number[][] = [], bare: number[][] = [];
  for (let s = 1; s <= 63; s++) {
    const midi = 64 + (s % 21), f = mtof(midi);
    const play = soloist(midi, 0.5, s % 3 === 0 ? 1 : 0, false, seeded(s * 13));
    const start = (scoop: number, scoopTime: number): number => {
      const x = blowLips(note('trumpet', midi, 0.55, { dur: 0.45, seconds: 0.45, scoop, scoopTime }), seeded(s));
      const held = pitchAt(x, f, 0.35);
      return (pitchAt(x, f, 0.01) + pitchAt(x, f, 0.015) + pitchAt(x, f, 0.02)) / 3 - held;
    };
    (play.scoopTime > 0.07 ? lifted : plain).push([midi, start(play.scoop, play.scoopTime)]);
    if (s % 3 === 1) bare.push([midi, start(0, 0.12)]);
  }
  const median = (v: number[][], lo = 0, hi = 99) => { const c = v.filter(([m]) => m! >= lo && m! <= hi).map(([, c]) => c!).sort((a, b) => a - b); return c[c.length >> 1]!; };
  assert.ok(median(lifted) < -36 && median(lifted) > -58, `lifted notes start a median ${median(lifted).toFixed(0)} cents off`);
  assert.ok(Math.abs(median(plain)) < 10, `plain notes start a median ${median(plain).toFixed(0)} cents off`);
  assert.ok(median(bare, 64, 70) - median(bare, 78, 84) > 20, `the bare model starts sharper low (${median(bare, 64, 70).toFixed(0)}) than high (${median(bare, 78, 84).toFixed(0)})`);
  assert.ok(Math.abs(median(plain, 64, 70) - median(plain, 78, 84)) < 12, `the soloist starts alike low (${median(plain, 64, 70).toFixed(0)}) and high (${median(plain, 78, 84).toFixed(0)})`);
});

test('a soloist\'s vibrato grows towards the end of a held note, and the note tapers', () => {
  const f = mtof(72);
  const x = blowLips(note('trumpet', 72, 0.55, { dur: 2, seconds: 2.1, vibrato: 9, rate: 4.5, vibratoFrom: 0.35, taper: 0.35 }), seeded(9));
  // The pitch's swing (half its range, cents) over a window, every 10 ms.
  const swing = (a: number, b: number): number => { const c: number[] = []; for (let t = a; t < b; t += 0.01) c.push(pitchAt(x, f, t)); return (Math.max(...c) - Math.min(...c)) / 2; };
  const early = swing(0.1, 0.34), late = swing(1.6, 1.95);
  assert.ok(early < 5, `straight at first (${early.toFixed(1)} cents)`);
  assert.ok(late > 6 && late < 13, `singing by the end (${late.toFixed(1)} cents)`);
  // Recorded soloists' held notes end about 2.5 dB (1.5 to 7) under their middle.
  const fall = 20 * Math.log10(rms(x, 0.9, 1.1) / rms(x, 1.7, 1.95));
  assert.ok(fall > 1 && fall < 6, `tapers ${fall.toFixed(1)} dB`);
  // The breath swings with the vibrato: the level moves about a third of a dB, as recorded.
  const lv: number[] = []; for (let t = 1.6; t < 1.95; t += 0.01) lv.push(20 * Math.log10(rms(x, t, t + 0.02)));
  const am = (Math.max(...lv) - Math.min(...lv)) / 2;
  assert.ok(am > 0.1 && am < 1.2, `the level swings ${am.toFixed(2)} dB`);
});

test('a solo trumpet plays one note at a time: the note before stops as the next one starts', () => {
  const events: Array<[string, number, number]> = [];
  const param = (name: string) => ({ value: 0, setValueAtTime: () => undefined, setTargetAtTime: (v: number, t: number) => { events.push([name, v, t]); } });
  let gains = 0;
  const node = () => ({ connect: (n: unknown) => n });
  const ctx = {
    sampleRate: 4000,
    createBuffer: (_c: number, n: number) => { const d = new Float32Array(n); return { getChannelData: () => d }; },
    createBufferSource: () => ({ ...node(), buffer: null, start: () => undefined }),
    createGain: () => ({ ...node(), gain: param(`gain${gains++}`) }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param('f'), Q: param('q') }),
  };
  let r = 7;
  const k = { ctx, noise: null, rng: () => { r = (r * 16807) % 2147483647; return r / 2147483647; } } as unknown as VoiceKit;
  const seat = node() as unknown as AudioNode;
  lead('trumpet', k, seat, 1, 70, 0.55, 0.5);
  lead('trumpet', k, seat, 1.4, 72, 0.55, 0.5);
  lead('trumpet', k, seat, 1.8, 74, 0.55, 0.5, 0, 72);
  assert.deepEqual(events.map(([g, v, t]) => [g, v, t]), [['gain0', 0, 1.4], ['gain1', 0, 1.8]], 'each note stops when the next starts');
  // A section's players are each their own instrument: nothing is stopped.
  events.length = 0;
  lead('trumpet', k, seat, 3, 70, 0.55, 0.5, 0, undefined, { straight: true });
  lead('trumpet', k, seat, 3.2, 72, 0.55, 0.5, 0, undefined, { straight: true });
  assert.equal(events.length, 0);
});

/** Cycle-to-cycle jitter (%) and shimmer (dB) over 0.5 to 1.4 s, the cycles found by matching each to the next. */
function grainOf(x: Float32Array, f: number): { jitter: number; shimmer: number } {
  let T = SR / f, p = Math.round(0.5 * SR);
  const periods: number[] = [], levels: number[] = [];
  while (p + 3 * T < 1.4 * SR) {
    const n = Math.round(T);
    let best = -2, at = T;
    const score = (lag: number): number => { let ab = 0, aa = 0, bb = 0; for (let i = 0; i < n; i++) { const a = x[p + i]!, b = x[p + lag + i]!; ab += a * b; aa += a * a; bb += b * b; } return ab / Math.sqrt(aa * bb + 1e-30); };
    for (let lag = Math.floor(T * 0.92); lag <= Math.ceil(T * 1.08); lag++) { const c = score(lag); if (c > best) { best = c; at = lag; } }
    const a = score(at - 1), b = score(at), c = score(at + 1), d = a - 2 * b + c;
    const L = at + (d ? (0.5 * (a - c)) / d : 0);
    let e = 0; for (let i = 0; i < n; i++) e += x[p + i]! ** 2;
    periods.push(L); levels.push(10 * Math.log10(e / n + 1e-30));
    T = 0.8 * T + 0.2 * L;
    p += Math.round(L);
  }
  let dj = 0, ds = 0;
  for (let i = 1; i < periods.length; i++) { dj += Math.abs(periods[i]! - periods[i - 1]!); ds += Math.abs(levels[i]! - levels[i - 1]!); }
  const mean = periods.reduce((s, v) => s + v, 0) / periods.length;
  return { jitter: (100 * dj) / (periods.length - 1) / mean, shimmer: ds / (levels.length - 1) };
}

test('a soloist\'s lips are unsteady as recorded trumpets are, most in the low register; a section\'s stay steady', () => {
  const g = (midi: number, grain: number) => {
    const x = blowLips(note('trumpet', midi, 0.55, { dur: 1.5, seconds: 1.5, grain }), seeded(midi));
    heardSolo(x, SR, 0.55);
    return grainOf(x, mtof(midi));
  };
  // Recorded (Iowa and Philharmonia single notes, by register): jitter 0.06 to 0.10 % low,
  // 0.10 to 0.13 in the middle and 0.14 to 0.21 at the top; shimmer 0.07 to 0.13 dB low and
  // 0.05 to 0.08 above. The model's lips held steady gave a third of that.
  const low = g(63, 1), mid = g(74, 1), high = g(85, 1);
  assert.ok(low.jitter > 0.06 && low.jitter < 0.13 && low.shimmer > 0.06 && low.shimmer < 0.13, `low ${JSON.stringify(low)}`);
  assert.ok(mid.jitter > 0.07 && mid.jitter < 0.15 && mid.shimmer > 0.04 && mid.shimmer < 0.09, `middle ${JSON.stringify(mid)}`);
  assert.ok(high.jitter > 0.13 && high.jitter < 0.25, `top ${JSON.stringify(high)}`);
  assert.ok(low.shimmer > mid.shimmer, 'the low register shimmers most');
  for (const m of [63, 74]) { const s = g(m, 0); assert.ok(s.jitter < 0.05 && s.shimmer < 0.03, `a section player at ${m}: ${JSON.stringify(s)}`); }
});
