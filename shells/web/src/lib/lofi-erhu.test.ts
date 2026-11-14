// SPDX-License-Identifier: MPL-2.0
/**
 * The erhu (lib/lofi-erhu.ts): it speaks in Helmholtz motion over its range, its held
 * harmonics sit where recorded erhus' do, register by register, and its player sings,
 * slides and falls as recorded players do.
 *
 * Run directly: node --test shells/web/src/lib/lofi-erhu.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bowSource, type BowNote } from './lofi-bowed.ts';
import { ERHU_INNER, ERHU_PLAYER, ERHU_REST, bowErhu, erhuOpen, erhuPlay, erhuTuning, erhuist } from './lofi-erhu.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (midi: number, vel: number, more: Partial<BowNote> = {}): BowNote => ({ sr: SR, f: mtof(midi), vel, dur: 0.9, seconds: 1.1, vibrato: 0, rate: 5, slide: 0, ...more });

function goertzel(x: Float32Array, hz: number, a: number, b: number): number {
  const w = (2 * Math.PI * hz) / SR, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = a; i < b; i++) { const s0 = x[i]! + c * s1 - s2; s2 = s1; s1 = s0; }
  return 10 * Math.log10(s1 * s1 + s2 * s2 - c * s1 * s2 + 1e-30);
}
/** A harmonic's level (dB) between `a` and `b` seconds: the best of five filters a few cents apart, averaged over 0.1 s windows. */
function harmonic(x: Float32Array, f: number, h: number, a = 0.4, b = 0.8): number {
  let p = 0, n = 0;
  for (let t = a; t + 0.1 <= b + 1e-9; t += 0.1, n++) {
    let best = -Infinity;
    for (const c of [-12, -6, 0, 6, 12]) best = Math.max(best, goertzel(x, f * h * 2 ** (c / 1200), Math.floor(t * SR), Math.floor((t + 0.1) * SR)));
    p += 10 ** (best / 10);
  }
  return 10 * Math.log10(p / n);
}

/** Leaves Helmholtz motion: the second harmonic over the fundamental, or the wave repeating every half period. */
function jumped(x: Float32Array, f: number, from: number): string | undefined {
  const T = SR / f, win = Math.max(Math.round(4 * T), Math.round(0.03 * SR));
  const L = Math.floor(T / 2), fr = T / 2 - L;
  for (let a = Math.round(from * SR); a + win + L + 2 < x.length; a += win) {
    const d = goertzel(x, f, a, a + win) - goertzel(x, 2 * f, a, a + win);
    let xy = 0, xx = 0, yy = 0;
    for (let i = a; i < a + win; i++) { const y = x[i + L]! * (1 - fr) + x[i + L + 1]! * fr; xy += x[i]! * y; xx += x[i]! * x[i]!; yy += y * y; }
    const half = xy / Math.sqrt(xx * yy + 1e-30);
    if (d < -1 || half > 0.5) return `at ${(a / SR).toFixed(2)} s: 2nd harmonic ${(-d).toFixed(1)} dB over the fundamental, half-period correlation ${half.toFixed(2)}`;
  }
  return undefined;
}

test('the erhu speaks in Helmholtz motion: every note the composer gives it, every strength, slurred and slid', () => {
  const intervals = [-2, 3, -5, 7, 2, -3, 4, 5];
  const bad: string[] = [];
  for (let midi = 64; midi <= 84; midi++) for (const vel of [0.3, 0.5, 0.7, 0.9]) for (let seed = 1; seed <= 4; seed++) {
    const f = mtof(midi), rand = seeded(seed * 7919 + midi * 31 + vel * 10);
    const slurred = seed % 2 === 1, slide = !slurred && seed === 2 ? 2 : 0;
    const from = slurred ? mtof(Math.max(ERHU_INNER, midi + intervals[(seed + midi) % 8]!)) : undefined;
    const x = bowSource(note(midi, vel, { dur: 0.3, seconds: 0.3, from: from === f ? undefined : from, slide, vibrato: seed === 4 ? 20 : 0 }), rand, erhuTuning(f, vel));
    const why = jumped(x, f, slide ? 0.2 : 0.06);
    if (why) bad.push(`${midi} at ${vel}${slurred ? ' slurred' : slide ? ' slid' : ''}, seed ${seed}: ${why}`);
  }
  assert.deepEqual(bad, [], `${bad.length} notes left Helmholtz motion:\n${bad.slice(0, 10).join('\n')}`);
});

/**
 * Recorded erhus' held harmonics 1 to 8 (dB against the note's power over them), averaged
 * over each register: the ErhuPT dataset (Zenodo 4320991, CC BY 4.0), CC0 Freesound erhu
 * phrases and the FolkMusic dataset's erhu clips (Zenodo 8012071, CC BY 4.0), one share each.
 */
const RECORDED: ReadonlyArray<readonly [number, number, readonly number[]]> = [
  [61, 66, [-21.5, -4.4, -12.1, -13.2, -6.6, -11.6, -24.7, -35.2]],
  [66, 71, [-3.4, -7.8, -14.2, -10.3, -20.2, -30.4, -31.9, -35.0]],
  [71, 76, [-1.3, -15.6, -10.5, -30.3, -34.9, -35.0, -37.9, -38.9]],
  [76, 81, [-3.6, -4.3, -15.0, -26.7, -29.2, -28.3, -29.2, -33.9]],
  [81, 86, [-6.5, -2.6, -17.8, -17.9, -17.1, -29.9, -28.7, -31.1]],
];

test('held, its harmonics sit where recorded erhus\' do, register by register: the python skin\'s nasal peak and its weak low fundamental', () => {
  for (const [lo, hi, want] of RECORDED) {
    const acc = new Array(8).fill(0);
    let n = 0;
    for (let midi = lo; midi < hi; midi++) for (const seed of [1, 2]) {
      const x = bowErhu(note(midi, 0.55), seeded(midi * 13 + seed));
      const lv = [1, 2, 3, 4, 5, 6, 7, 8].map(h => harmonic(x, mtof(midi), h));
      const total = 10 * Math.log10(lv.reduce((s, v) => s + 10 ** (v / 10), 0));
      lv.forEach((v, k) => { acc[k] += 10 ** ((v - total) / 20); });
      n++;
    }
    const got = acc.map(v => 20 * Math.log10(v / n));
    const rms = Math.sqrt(got.reduce((s, v, k) => s + (v - want[k]!) ** 2, 0) / 8);
    assert.ok(rms < 5, `${lo}-${hi}: ${rms.toFixed(1)} dB rms from the recordings\n got  ${got.map(v => v.toFixed(1)).join(' ')}\n want ${want.join(' ')}`);
  }
  // The low register's fundamental is weak against its second harmonic, as recorded (the skin passes little under its first mode).
  const d4 = bowErhu(note(63, 0.55), seeded(3));
  assert.ok(harmonic(d4, mtof(63), 2) - harmonic(d4, mtof(63), 1) > 6, 'a low note is mostly its harmonics');
});

test('an open string rings without the finger\'s pad; a stopped note goes through it', () => {
  assert.ok(erhuOpen(mtof(62)) && erhuOpen(mtof(69)));
  assert.ok(!erhuOpen(mtof(64)) && !erhuOpen(mtof(76)));
  assert.equal(erhuTuning(mtof(69)).finger, 0);
  assert.ok(erhuTuning(mtof(71)).finger > 0);
});

test('the player sings with a slow, wide vibrato on most long notes, slides, and never under the open inner string', () => {
  const rand = seeded(42);
  let sung = 0, long = 0, slides = 0, marked = 0;
  const depths: number[] = [], rates: number[] = [];
  for (let i = 0; i < 2000; i++) {
    const held = 0.2 + rand() * 1.5, midi = 62 + Math.floor(rand() * 22), art = rand() < 0.5 ? 1 : 0;
    const p = erhuPlay({ midi, held, art, slurred: false, rest: rand() < 0.3 }, rand);
    if (held > ERHU_PLAYER.vibratoFrom) { long++; if (p.vibrato) { sung++; depths.push(p.vibrato); rates.push(p.rate); } }
    if (art) { marked++; if (p.slide) slides++; }
    assert.ok(midi - Math.max(0, p.slide ?? 0) >= ERHU_INNER, `a slide from under the open string (${midi}, ${p.slide})`);
    if (p.bend) for (let s = 0; s < held; s += 0.01) assert.ok(midi + p.bend(s) / 100 >= ERHU_INNER - 0.01, `a bend under the open string at ${midi}`);
  }
  const med = (a: number[]): number => [...a].sort((x, y) => x - y)[a.length >> 1]!;
  // Recorded erhu music: vibrato on about half the held notes, half its swing 11 to 23 cents, at about 5 a second.
  assert.ok(sung / long > 0.45 && sung / long < 0.75, `vibrato on ${(100 * sung / long).toFixed(0)}% of long notes`);
  assert.ok(med(depths) > 11 && med(depths) < 23, `vibrato ${med(depths).toFixed(1)} cents`);
  assert.ok(med(rates) > 4.6 && med(rates) < 5.6, `at ${med(rates).toFixed(2)} Hz`);
  assert.ok(slides / marked > 0.15 && slides / marked < 0.45, `slides into ${(100 * slides / marked).toFixed(0)}% of the bent notes`);
});

test('the player reads ahead: a note before a rest is marked, a doubled line is left as written', () => {
  const notes = [
    { voice: 'lead' as const, beat: 0, dur: 1, midi: 70, vel: 0.7 },
    { voice: 'lead' as const, beat: 1, dur: 1, midi: 72, vel: 0.7, mod: 1 },
    { voice: 'lead' as const, beat: 3, dur: 0.5, midi: 74, vel: 0.7 },
  ];
  const a = notes.map(n => ({ ...n }));
  erhuist(a, 0.5, false);
  assert.equal((a[0]!.mod ?? 0) & ERHU_REST, 0, 'no rest after the first');
  assert.equal(a[1]!.mod, 1 | ERHU_REST, 'a rest after the second, its bend kept');
  const b = notes.map(n => ({ ...n }));
  erhuist(b, 0.5, true);
  assert.deepEqual(b, notes);
});

test('a note is the same every time for the same seed', () => {
  const one = bowErhu(note(74, 0.6, { vibrato: 18 }), seeded(9));
  const two = bowErhu(note(74, 0.6, { vibrato: 18 }), seeded(9));
  assert.deepEqual(one, two);
  assert.ok(one.every(Number.isFinite));
});
