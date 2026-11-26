// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { bowSource, bowString, type BowNote } from './lofi-bowed.ts';
import { BOWED_RANGE, BOWED_STRINGS, bowInstrument, bowedTuning, type BowedString } from './lofi-strings-bowed.ts';
import { bowSection, partFor, sectionPlayers, SECTION } from './lofi-string-section.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (midi: number, vel: number, more: Partial<BowNote> = {}): BowNote => ({ sr: SR, f: mtof(midi), vel, dur: 0.8, seconds: 1.1, vibrato: 0, rate: 5.6, slide: 0, ...more });

/** A harmonic's level (dB) over samples a..b, by Goertzel's recurrence. */
function goertzel(x: Float32Array, hz: number, a: number, b: number): number {
  const w = (2 * Math.PI * hz) / SR, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = a; i < b; i++) { const s0 = x[i]! + c * s1 - s2; s2 = s1; s1 = s0; }
  return 10 * Math.log10(s1 * s1 + s2 * s2 - c * s1 * s2 + 1e-30);
}
function rms(x: Float32Array, a: number, b: number): number {
  let s = 0;
  for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / ((b - a) * SR));
}
/** The fundamental's pitch in cents from `f`, by a fine search over the held part. */
function cents(x: Float32Array, f: number): number {
  let best = -Infinity, at = 0;
  const a = Math.floor(0.4 * SR), b = Math.floor(0.75 * SR);
  for (let c = -40; c <= 40; c += 0.5) { const p = goertzel(x, f * 2 ** (c / 1200), a, b) + goertzel(x, 2 * f * 2 ** (c / 1200), a, b); if (p > best) { best = p; at = c; } }
  return at;
}

/**
 * Whether the string's force on the bridge has left Helmholtz motion anywhere from `from`
 * s on (as lofi-bowed.test.ts judges the fiddle): in a window, the 2nd harmonic over the
 * fundamental by more than 1 dB, or the wave nearly repeating at half its period.
 */
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

test('the fiddle is unchanged: the same notes render the same bytes as before the low strings came', () => {
  // Pinned from lofi-bowed.ts as the fiddle shipped (44ec66fc46): the body, then the string alone.
  const pinned: Array<[number, number, Partial<BowNote>, string, string]> = [
    [64, 0.3, {}, 'a195b4077c092001', '237c4c803f27fdce'],
    [72, 0.6, { vibrato: 13 }, '734797d2981f845e', 'cfd68f8525250e8d'],
    [79, 0.9, { slide: 1 }, '1ae89233fae89ed0', '56a966e22b553070'],
    [76, 0.5, { from: mtof(74) }, 'cf840f36feb58b29', '6db866023ca3b7f2'],
    [84, 0.2, {}, 'c1e1b657bf04ab7c', 'e5fc8ba24cea4277'],
  ];
  const h = (x: Float32Array): string => createHash('sha256').update(Buffer.from(x.buffer, x.byteOffset, x.byteLength)).digest('hex').slice(0, 16);
  for (const [midi, vel, more, body, string] of pinned) {
    const n = { sr: 44100, f: mtof(midi), vel, dur: 0.5, seconds: 0.7, vibrato: 0, rate: 5.6, slide: 0, ...more };
    assert.equal(h(bowString(n, seeded(midi * 7 + 1))), body, `${midi} at ${vel}: the fiddle through its body`);
    assert.equal(h(bowSource(n, seeded(midi * 7 + 1))), string, `${midi} at ${vel}: the fiddle's string`);
  }
});

test('each low string speaks at its note across its range, softly and loudly, in Helmholtz motion', () => {
  for (const inst of BOWED_STRINGS) {
    const [lo, hi] = BOWED_RANGE[inst];
    for (const midi of [lo, Math.round((lo + hi) / 2), hi]) for (const vel of [0.25, 0.85]) {
      const n = note(midi, vel);
      const x = bowInstrument(inst, n, seeded(midi));
      assert.ok(x.every(Number.isFinite), `${inst} ${midi} ${vel}: finite`);
      assert.ok(rms(x, 0.4, 0.75) > 1e-4, `${inst} ${midi} ${vel}: it sounds`);
      const s = bowSource(n, seeded(midi), bowedTuning(inst, n.f));
      assert.ok(Math.abs(cents(s, n.f)) <= 10, `${inst} ${midi} ${vel}: ${cents(s, n.f)} cents`);
      const a = Math.floor(0.4 * SR), b = Math.floor(0.75 * SR);
      assert.ok(goertzel(s, n.f, a, b) > goertzel(s, 2 * n.f, a, b), `${inst} ${midi} ${vel}: the fundamental leads the string`);
    }
  }
});

test('the same note bows the same, and rings on a moment after the bow lifts', () => {
  for (const inst of BOWED_STRINGS) {
    const [lo, hi] = BOWED_RANGE[inst];
    const midi = Math.round((lo + hi) / 2);
    assert.deepEqual(bowInstrument(inst, note(midi, 0.6), seeded(6)), bowInstrument(inst, note(midi, 0.6), seeded(6)));
    const x = bowInstrument(inst, note(midi, 0.6, { dur: 0.4, seconds: 1.4 }), seeded(7));
    const held = rms(x, 0.25, 0.38);
    assert.ok(rms(x, 0.42, 0.46) > held * 0.03, `${inst}: it rings a moment after the bow lifts`);
    assert.ok(rms(x, 1.25, 1.35) < held * 0.01, `${inst}: and is gone well within a second`);
  }
});

/**
 * The octave-jump sweep, for each low string over its whole range: every semitone, ten
 * strengths, slurred from eight intervals, slid, plain and with vibrato, as the fiddle's.
 * A lower note's period is longer and its stroke slower, so each note is held for 24 of
 * its periods past a quarter second, and judged once it has spoken: a stroke once the bow
 * is up to speed (and at least 12 periods in), a slide once its glide is over too, a slur
 * at once (the string was already playing under the same bow).
 */
for (const inst of BOWED_STRINGS) {
  test(`the ${inst} never jumps an octave: every semitone it plays, every strength, slurred, slid and plain`, () => {
    const [lo, hi] = BOWED_RANGE[inst];
    const intervals = [-2, 3, -5, 7, -12, 1, 4, -3];
    const bad: string[] = [];
    for (let midi = lo; midi <= hi; midi++) for (let v = 1; v <= 10; v++) for (let seed = 1; seed <= 8; seed++) {
      const vel = v / 10, f = mtof(midi), rand = seeded(seed * 7919 + midi * 31 + v);
      const slurred = seed % 2 === 1, slide = !slurred && seed % 4 === 2 ? 1 : 0;
      const from = slurred ? mtof(Math.max(lo - 2, midi + intervals[(seed + midi) % 8]!)) : undefined;
      const len = Math.max(0.3, 0.25 + 24 / f);
      const T = bowedTuning(inst, f);
      const x = bowSource(note(midi, vel, { dur: len, seconds: len, from, slide, vibrato: seed % 8 === 0 ? 14 : 0 }), rand, T);
      const ramp = (T.rampSoft + (T.rampLoud - T.rampSoft) * vel) * (523.25 / f);
      const stroke = Math.max(0.06, 12 / f, T.creep + ramp + 0.02);
      const why = jumped(x, f, slurred ? 0.04 : slide ? stroke + 0.12 : stroke);
      if (why) bad.push(`${midi} at ${vel}${slurred ? ' slurred' : slide ? ' slid' : ''}, seed ${seed}: ${why}`);
    }
    assert.deepEqual(bad, [], `${bad.length} ${inst} notes left Helmholtz motion:\n${bad.slice(0, 12).join('\n')}`);
  });
}

/** Each harmonic's width over a held second (cents, the standard deviation of its power about its centre). */
function width(x: Float32Array, f: number, h: number, a: number): number {
  const n = SR;
  let p = 0, m = 0, m2 = 0;
  for (let c = -60; c <= 60; c += 1) {
    const q = 10 ** (goertzel(x, h * f * 2 ** (c / 1200), a, a + n) / 10);
    p += q; m += q * c; m2 += q * c * c;
  }
  m /= p;
  return Math.sqrt(Math.max(0, m2 / p - m * m));
}

test('a section part spreads its unison as a recorded section does, and its players come in a few milliseconds apart', () => {
  // The players as drawn: a few cents apart (standard deviation SECTION.spread) and a few
  // milliseconds late, never early.
  const many = sectionPlayers(seeded(11), 2000);
  const sd = Math.sqrt(many.reduce((s, p) => s + p.detune * p.detune, 0) / many.length);
  assert.ok(Math.abs(sd - SECTION.spread) < SECTION.spread * 0.15, `players ${sd.toFixed(1)} cents apart`);
  const late = many.map(p => p.late).sort((a, b) => a - b);
  assert.ok(late[0]! >= 0 && late[Math.floor(late.length / 2)]! > 0.004 && late[Math.floor(late.length / 2)]! < 0.02, `players a median ${(late[1000]! * 1000).toFixed(0)} ms late`);
  assert.equal(sectionPlayers(seeded(11)).length, SECTION.players);
  // Recorded sections (the VSCO 2 violas and cellos, held, loud) spread each harmonic from
  // the 4th to the 10th by 10 to 12 cents (standard deviation over a second): the players'
  // vibratos and their tunings together.
  for (const [part, midi] of [['cello', 50], ['viola', 62]] as const) {
    const f = mtof(midi);
    const w = (x: Float32Array): number => [4, 5, 6, 7, 8, 9, 10].reduce((s, h) => s + width(x, f, h, Math.floor(0.9 * SR)), 0) / 7;
    const ws = w(bowSection(part, SR, f, 0.8, 2.6, sectionPlayers(seeded(midi))));
    assert.ok(ws > 7 && ws < 16, `${part}: the section's width ${ws.toFixed(1)} cents (recorded sections 10 to 12)`);
  }
  // Every chord tone goes to a part whose range holds the note.
  assert.equal(partFor(40), 'doublebass');
  assert.equal(partFor(50), 'cello');
  assert.equal(partFor(62), 'viola');
  assert.equal(partFor(72), 'violins');
});

test('the parts are bowed the instruments they are: a low string\'s body holds its low notes', () => {
  // A held note's level stays within reach across each instrument's range (no dead notes).
  for (const inst of BOWED_STRINGS) {
    const [lo, hi] = BOWED_RANGE[inst];
    const levels: number[] = [];
    for (let midi = lo; midi <= hi; midi += 3) levels.push(20 * Math.log10(rms(bowInstrument(inst as BowedString, note(midi, 0.6), seeded(midi)), 0.4, 0.75)));
    const spread = Math.max(...levels) - Math.min(...levels);
    assert.ok(spread < 30, `${inst}: held levels within ${spread.toFixed(1)} dB across its range`);
  }
});
