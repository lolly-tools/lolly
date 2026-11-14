// SPDX-License-Identifier: MPL-2.0
/**
 * The Latin percussion (lib/lofi-latin-perc.ts), on the pure renderings: every stroke is a
 * finite sound that starts and stops; the drums are pitched in their order (quinto over
 * conga over tumba, the macho over the hembra); a slap is brighter and shorter than an
 * open tone and the hand's strokes die fast; a struck head starts sharp and settles; a
 * bell rings longer at its mouth than at its neck; the clave rings near 2.4 kHz; a güiro
 * scrape is a run of clicks as long as the note, a down-stroke sharper than an up-stroke.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-latin-perc.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guiroStroke, latinStroke, maracaStroke, LATIN_PERCUSSION, type LatinKind } from './lofi-latin-perc.ts';
import { LOFI_PERCUSSION } from '../../../../engine/src/lofi-compose.ts';
import { CONGA_DRUM, CONGA_STROKES, BONGO_STROKES, TIMBAL_STROKES } from '../../../../engine/src/lofi-salsa.ts';

const SR = 44100;
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const render = (kind: LatinKind, midi: number, vel = 0.65, seconds = 0.2): Float32Array => latinStroke(SR, kind, midi, vel, seeded(3), seconds).data;
/** The magnitude of `x` at `f` Hz over [t0, t1) seconds. */
function at(x: Float32Array, f: number, t0 = 0, t1 = 0.06): number {
  let re = 0, im = 0;
  const a = Math.floor(t0 * SR), b = Math.min(x.length, Math.floor(t1 * SR));
  for (let n = a; n < b; n++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (n - a)) / (b - a)); re += x[n]! * w * Math.cos((2 * Math.PI * f * n) / SR); im -= x[n]! * w * Math.sin((2 * Math.PI * f * n) / SR); }
  return Math.hypot(re, im);
}
/** The spectral centroid (Hz) over the first `t1` seconds, every 20 Hz to 12 kHz. */
function centroid(x: Float32Array, t1 = 0.05): number {
  let num = 0, den = 0;
  for (let f = 60; f < 12000; f += 20) { const p = at(x, f, 0, t1) ** 2; num += f * p; den += p; }
  return num / den;
}
/** The strongest frequency between `lo` and `hi` Hz. */
function peak(x: Float32Array, lo: number, hi: number, t0 = 0.005, t1 = 0.08): number {
  let best = lo, top = 0;
  for (let f = lo; f <= hi; f += 1) { const m = at(x, f, t0, t1); if (m > top) { top = m; best = f; } }
  return best;
}
/** RMS over [t0, t1) seconds. */
function rms(x: Float32Array, t0: number, t1: number): number {
  let s = 0, n = 0;
  for (let i = Math.floor(t0 * SR); i < Math.min(x.length, Math.floor(t1 * SR)); i++) { s += x[i]! ** 2; n++; }
  return Math.sqrt(s / Math.max(1, n));
}
const db = (r: number): number => 20 * Math.log10(r + 1e-12);

test('the kinds are the composer\'s percussion from congas on', () => {
  assert.deepEqual([...LATIN_PERCUSSION], LOFI_PERCUSSION.slice(LOFI_PERCUSSION.indexOf('congas')));
});

test('every stroke of every instrument is a finite sound that starts and dies away', () => {
  const strokes: Array<[LatinKind, number]> = [
    ...[0, 1, 2].flatMap(d => [1, 2, 3, 4, 5, 6].map(s => ['congas', d * CONGA_DRUM + s] as [LatinKind, number])),
    ...[1, 2, 3, 4, 5, 6].map(s => ['bongos', s] as [LatinKind, number]),
    ...[1, 2, 3, 4, 5, 6, 7].map(s => ['timbales', s] as [LatinKind, number]),
    ['bongoBell', 1], ['bongoBell', 2], ['mamboBell', 1], ['mamboBell', 2], ['clave', 1], ['guiro', 1], ['guiro', 2],
    ['maracas', 1], ['maracas', 2], ['maracas', 3], ['maracas', 4],
  ];
  for (const [kind, midi] of strokes) {
    for (const vel of [0.35, 0.95]) {
      const x = render(kind, midi, vel);
      let top = 0;
      for (const v of x) { assert.ok(Number.isFinite(v), `${kind} ${midi}: finite`); top = Math.max(top, Math.abs(v)); }
      assert.ok(top > 0.5 && top <= 1, `${kind} ${midi}: peak ${top}`);
      assert.ok(db(rms(x, x.length / SR - 0.02, x.length / SR)) < db(rms(x, 0, 0.03)) - 30, `${kind} ${midi}: it dies away before its end`);
    }
  }
});

test('the drums are pitched in their order: quinto over conga over tumba, the macho over the hembra', () => {
  const open = (kind: LatinKind, midi: number): number => peak(render(kind, midi), 100, 900, 0.03, 0.15);
  const [quinto, conga, tumba] = [0, 1, 2].map(d => open('congas', d * CONGA_DRUM + CONGA_STROKES.open));
  assert.ok(quinto! > conga! && conga! > tumba!, `${quinto} > ${conga} > ${tumba}`);
  assert.ok(Math.abs(1200 * Math.log2(conga! / 218)) < 60, `the conga's open tone near 218 Hz (${conga})`);
  assert.ok(open('bongos', BONGO_STROKES.open) > open('bongos', BONGO_STROKES.hembra), 'macho over hembra');
  assert.ok(open('timbales', TIMBAL_STROKES.macho) > open('timbales', TIMBAL_STROKES.hembra), 'the timbales too');
});

test('a slap is a bright crack over a choked tone; the hand\'s strokes die fast; an open tone rings', () => {
  const c = CONGA_DRUM;
  const open = render('congas', c + CONGA_STROKES.open, 0.8);
  const slap = render('congas', c + CONGA_STROKES.slap, 0.8);
  // Recorded: a slap's 2 to 8 kHz bands sit 11 to 14 dB under its loudest over its first
  // 20 ms, an open tone's 27 to 34 dB under; over 50 ms a slap's centroid is 390 to 510 Hz,
  // an open tone's 220 to 290.
  const band = (x: Float32Array, lo: number, hi: number, by: number): number => { let e = 0, n = 0; for (let f = lo; f <= hi; f += by) { e += at(x, f, 0, 0.02) ** 2; n++; } return 10 * Math.log10(e / n + 1e-24); };
  const top = (x: Float32Array): number => band(x, 2000, 8000, 50) - band(x, 150, 700, 50);
  assert.ok(top(slap) > top(open) + 10, `the slap's top ${top(slap).toFixed(1)} dB, the open tone's ${top(open).toFixed(1)}`);
  assert.ok(centroid(slap) > centroid(open) * 1.5, `slap ${centroid(slap).toFixed(0)} Hz over open ${centroid(open).toFixed(0)} Hz`);
  const ring = (x: Float32Array): number => db(at(x, 218, 0.15, 0.25)) - db(at(x, 218, 0.005, 0.06));
  assert.ok(ring(open) > ring(slap) + 6, `the open tone rings on (${ring(open).toFixed(1)} dB at 0.2 s, the slap ${ring(slap).toFixed(1)})`);
  for (const s of [CONGA_STROKES.muff, CONGA_STROKES.heel, CONGA_STROKES.toe]) {
    const x = render('congas', c + s, 0.6);
    assert.ok(db(rms(x, 0.12, 0.16)) < db(rms(x, 0, 0.03)) - 25, `stroke ${s} is damped by the hand`);
  }
});

test('a struck head starts sharp and settles, more so struck harder', () => {
  const start = (vel: number): number => peak(render('congas', CONGA_DRUM + CONGA_STROKES.open, vel), 180, 280, 0, 0.012);
  const settled = peak(render('congas', CONGA_DRUM + CONGA_STROKES.open, 0.95), 180, 280, 0.08, 0.2);
  assert.ok(start(0.95) > settled, `a hard stroke starts at ${start(0.95)} Hz and settles to ${settled}`);
  assert.ok(start(0.95) >= start(0.35), 'harder is sharper');
});

test('a bell is brighter at its neck than at its mouth; the clave rings near 2.4 kHz', () => {
  for (const bell of ['bongoBell', 'mamboBell'] as const) {
    // Recorded mambo bell: a centroid of 760 Hz at the mouth, 1760 Hz at the neck.
    assert.ok(centroid(render(bell, 2)) > centroid(render(bell, 1)) * 1.3, `${bell}: the neck is the brighter`);
  }
  // Both lead near 470 to 490 Hz (recorded); the mambo bell has more above (its recorded centroid 760 Hz, the bongo bell's 490).
  for (const bell of ['bongoBell', 'mamboBell'] as const) assert.ok(Math.abs(peak(render(bell, 1), 300, 900) - 480) < 25, `${bell} rings near 480 Hz`);
  assert.ok(centroid(render('mamboBell', 1)) > centroid(render('bongoBell', 1)), 'the mambo bell is the brighter');
  const clave = peak(render('clave', 1), 1500, 3500);
  assert.ok(Math.abs(clave - 2380) < 80, `clave at ${clave} Hz`);
});

test('a güiro scrape: clicks the length of the note, quickest in its middle, a down-stroke sharper than an up-stroke', () => {
  const long = render('guiro', 1, 0.6, 0.3);
  const short = render('guiro', 1, 0.6, 0.1);
  assert.ok(long.length > short.length * 2, 'as long as its note');
  // The scrape fills its length: sound in its middle and near its end, then silence.
  assert.ok(db(rms(long, 0.12, 0.18)) > db(rms(long, 0, 0.3)) - 6, 'sound right through the middle');
  // Recorded: a scrape away from the player speeds up through the stroke (its ridges come
  // quickest in its second half), one back toward the player is quickest in its middle.
  const down = render('guiro', 1, 0.6, 0.3), up = render('guiro', 2, 0.6, 0.3);
  assert.ok(db(rms(down, 0.18, 0.25)) > db(rms(down, 0, 0.03)) + 3, 'the down-stroke builds');
  assert.ok(db(rms(up, 0.12, 0.18)) > db(rms(up, 0.26, 0.3)) + 3, 'the up-stroke peaks in its middle');
  // Counting the clicks: an envelope's peaks, about 95 ridges a second.
  const env: number[] = [];
  const hop = Math.round(SR * 0.002);
  for (let i = 0; i + hop < long.length; i += hop) env.push(rms(long, i / SR, (i + hop) / SR));
  let clicks = 0;
  for (let i = 1; i < env.length - 1; i++) if (env[i]! > env[i - 1]! && env[i]! >= env[i + 1]! && env[i]! > 0.05) clicks++;
  assert.ok(clicks > 15 && clicks < 60, `${clicks} clicks in a 0.3 s scrape`);
});

test('a güiro scrape is grit, not a buzz: uneven ridges, the rub between them, the gourd ringing near 1.85 kHz', () => {
  // Recorded (Iowa MIS, VSCO 2 CE): the gaps between ridges vary by 28 to 75 per cent, the
  // level swings 10 to 25 dB between ridges (never silence), the waveform repeats weakly
  // (autocorrelation 0.13 to 0.55), and the 16 kHz octave is 27 to 45 dB under the loudest.
  const x = guiroStroke(SR, false, 0.3, 0.6, seeded(4));
  const env: number[] = [];
  const w = Math.round(SR * 0.001);
  for (let i = Math.round(0.05 * SR); i + w < Math.round(0.25 * SR); i += w) env.push(rms(x, i / SR, (i + w) / SR));
  const sorted = [...env].sort((a, b) => a - b);
  const depth = db(sorted[Math.floor(sorted.length * 0.9)]!) - db(sorted[Math.floor(sorted.length * 0.1)]!);
  assert.ok(depth > 6 && depth < 22, `the level swings ${depth.toFixed(1)} dB between ridges, not click and silence`);
  // The gaps between ridge peaks are uneven.
  const peaks: number[] = [];
  for (let i = 2; i < env.length - 2; i++) if (env[i]! === Math.max(...env.slice(i - 2, i + 3)) && env[i]! > sorted[Math.floor(sorted.length * 0.6)]!) peaks.push(i);
  const gaps = peaks.slice(1).map((p, i) => p - peaks[i]!);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const cv = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length) / mean;
  assert.ok(cv > 0.25, `the ridge gaps vary by ${(cv * 100).toFixed(0)} per cent`);
  assert.ok(Math.abs(peak(x, 1500, 2300, 0, 0.3) - 1850) < 120, 'the gourd rings near 1.85 kHz');
  assert.ok(db(at(x, 15000, 0, 0.3)) < db(at(x, 1850, 0, 0.3)) - 25, 'little above 8 kHz');
});

test('a maraca shake is a burst of seeds high up: rising in 10 to 40 ms, gone 20 dB in about 40 ms, almost all above 5 kHz', () => {
  for (const midi of [1, 2, 3, 4]) {
    const x = maracaStroke(SR, midi, 0.7, seeded(midi));
    // Recorded: the 8 kHz octave leads, 2 kHz about 30 dB under; centroid 8.7 to 10.7 kHz.
    assert.ok(db(at(x, 2000, 0, 0.08)) < db(at(x, 8000, 0, 0.08)) - 15, `stroke ${midi}: little under 5 kHz`);
    let top = 0, at0 = 0;
    for (let i = 0; i < x.length; i += 44) { const r = rms(x, i / SR, (i + 264) / SR); if (r > top) { top = r; at0 = i; } }
    assert.ok(at0 / SR > 0.008 && at0 / SR < 0.045, `stroke ${midi}: peaks at ${(at0 / SR * 1000).toFixed(0)} ms, as the seeds fly across`);
    assert.ok(db(rms(x, 0.11, 0.14)) < db(top) - 20, `stroke ${midi}: gone 20 dB by 110 ms`);
  }
});

test('a stroke renders the same from the same seed, and differs from another', () => {
  const a = latinStroke(SR, 'congas', CONGA_DRUM + 2, 0.8, seeded(9)).data;
  const b = latinStroke(SR, 'congas', CONGA_DRUM + 2, 0.8, seeded(9)).data;
  const c = latinStroke(SR, 'congas', CONGA_DRUM + 2, 0.8, seeded(10)).data;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});
