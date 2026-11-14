// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { blowReed, blowSax, saxNote, saxPressure, SAX_GROWL, SAX_PLAYED, SAX_SUBTONE, type ReedNote } from './lofi-reeds.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (bore: ReedNote['bore'], midi: number, vel: number): ReedNote => ({ sr: SR, f: mtof(midi), vel, dur: 0.8, seconds: 0.9, bore, vibrato: 0, rate: 5.4, scoop: 0, attack: 0.04 });
/** A frequency's level (dB) between two times (s). */
function at(x: Float32Array, hz: number, from = 0.3, to = 0.7): number {
  const w = (2 * Math.PI * hz) / SR;
  let re = 0, im = 0;
  for (let i = Math.floor(from * SR); i < Math.floor(to * SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
  return 10 * Math.log10(re * re + im * im + 1e-20);
}
/** A frequency's level (dB) between two times (s), through a Hann window, so a strong harmonic does not leak into the neighbouring bins. */
function windowed(x: Float32Array, hz: number, from = 0.3, to = 0.7): number {
  const w = (2 * Math.PI * hz) / SR;
  const i0 = Math.floor(from * SR), n = Math.floor(to * SR) - i0;
  let re = 0, im = 0;
  for (let k = 0; k < n; k++) { const v = x[i0 + k]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / n)); re += v * Math.cos(w * (i0 + k)); im += v * Math.sin(w * (i0 + k)); }
  return 10 * Math.log10(re * re + im * im + 1e-20);
}
/** The air between the harmonics (dB against the tone): the bands halfway between the 8th and the 20th, against the first 20 harmonics. */
function air(x: Float32Array, f: number): number {
  let gap = 0, tone = 0;
  for (let h = 8; h <= 20; h++) gap += 10 ** (windowed(x, f * (h + 0.5)) / 10);
  for (let h = 1; h <= 20; h++) tone += 10 ** (windowed(x, f * h) / 10);
  return 10 * Math.log10(gap / tone);
}
/** A harmonic's level (dB) over the held part of the note. */
const harmonic = (x: Float32Array, f: number, h: number): number => at(x, f * h);
/** The fundamental's pitch in cents from `f`: a coarse search, then a fine one round the best. */
function cents(x: Float32Array, f: number, from = 0.3, to = 0.7): number {
  let best = -Infinity, c0 = 0;
  for (let c = -60; c <= 60; c += 2) { const p = at(x, f * 2 ** (c / 1200), from, to); if (p > best) { best = p; c0 = c; } }
  let fine = c0;
  for (let c = c0 - 2; c <= c0 + 2; c += 0.25) { const p = at(x, f * 2 ** (c / 1200), from, to); if (p > best) { best = p; fine = c; } }
  return fine;
}
/** RMS between two times (s). */
function rms(x: Float32Array, a: number, b: number): number {
  let s = 0;
  const i0 = Math.floor(a * SR), i1 = Math.floor(b * SR);
  for (let i = i0; i < i1; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, i1 - i0));
}
/** A two-pole RBJ high-pass run over a copy. */
function highPass(x: Float32Array, hz: number, q = 0.7): Float32Array {
  const w = (2 * Math.PI * hz) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  const b0 = (1 + cs) / 2, b1 = -(1 + cs), b2 = (1 + cs) / 2;
  const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!, o = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o;
  }
  return y;
}
/** Energy above 1 kHz against the whole note (dB), over the held part. */
const bright = (x: Float32Array): number => 20 * Math.log10(rms(highPass(x, 1000), 0.3, 0.7) / rms(x, 0.3, 0.7));
/** How much a held note's loudness moves between 15 and 90 Hz (a share of its level). */
function roughness(x: Float32Array, f: number, from: number, to: number): number {
  const per = Math.max(1, Math.round(SR / f));
  const i0 = Math.floor(from * SR), i1 = Math.floor(to * SR);
  const env: number[] = [];
  let s = 0;
  for (let i = i0 - per; i < i1; i++) { s += Math.abs(x[i]!) - (i - per >= i0 - per ? Math.abs(x[i - per]!) : 0); if (i >= i0 && (i - i0) % 44 === 0) env.push(s / per); }
  const mean = env.reduce((a, b) => a + b, 0) / env.length;
  const e = new Float32Array(env.map(v => v / mean - 1));
  // Back to the audio rate's filter at about a millisecond a step: keep 15 to 90 Hz.
  const band = (() => {
    const fs = SR / 44, lo = 15, hi = 90, c = Math.sqrt(lo * hi), w = (2 * Math.PI * c) / fs, q = c / (hi - lo);
    const cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const y = new Float32Array(e.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < e.length; i++) { const v = e[i]!, o = (al * v - al * x2 + 2 * cs * y1 - (1 - al) * y2) / a0; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; }
    return y;
  })();
  let p = 0;
  for (let i = Math.floor(band.length * 0.1); i < band.length; i++) p += band[i]! * band[i]!;
  return Math.sqrt(p / (band.length * 0.9)) * Math.SQRT2;
}

test('a sax and a clarinet sound by themselves, in tune across their range', () => {
  for (const [bore, notes, within] of [['cone', [49, 56, 63, 70, 77], 8], ['cylinder', [52, 58, 64, 72], 2]] as const) {
    for (const midi of notes) for (const vel of [0.4, 0.9]) {
      const x = blowReed(note(bore, midi, vel), seeded(midi));
      const level = rms(x, 0.3, 0.7);
      assert.ok(x.every(Number.isFinite) && level > 0.2, `${bore} ${midi} ${vel}: it speaks (${level.toFixed(2)})`);
      assert.ok(Math.abs(cents(x, mtof(midi))) <= within, `${bore} ${midi} ${vel}: ${cents(x, mtof(midi))} cents`);
    }
  }
});

test('the clarinet blows exactly as it did before the sax was rebuilt', () => {
  const h = createHash('sha1');
  for (const [m, v, from, scoop] of [[52, 0.3, 0, 0], [60, 0.7, 0, 1], [64, 0.9, 62, 0], [72, 0.5, 0, 0]] as const) {
    const x = blowReed({ sr: SR, f: mtof(m), from: from ? mtof(from) : undefined, vel: v, dur: 0.6, seconds: 0.7, bore: 'cylinder', vibrato: 6, rate: 5.3, scoop, attack: 0.045 }, seeded(m));
    h.update(Buffer.from(x.buffer));
  }
  assert.equal(h.digest('hex'), 'e3c80af8f483cb600d64cb2f2599c8a71ec0f9b2');
});

test('a clarinet\'s low notes lead with the odd harmonics; a sax has them all, and is brighter blown harder', () => {
  const f = mtof(55);
  const clarinet = blowReed(note('cylinder', 55, 0.6), seeded(1));
  for (const h of [2, 4]) assert.ok(harmonic(clarinet, f, h) < harmonic(clarinet, f, h + 1) - 15, `even harmonic ${h} well under ${h + 1}`);
  const fs = mtof(63);
  const soft = blowReed(note('cone', 63, 0.35), seeded(2));
  const hard = blowReed(note('cone', 63, 0.95), seeded(2));
  for (const h of [2, 3]) assert.ok(harmonic(soft, fs, h) > harmonic(soft, fs, 1) - 20, `the sax's harmonic ${h} sounds`);
  const top = (x: Float32Array) => harmonic(x, fs, 6) + harmonic(x, fs, 7) - 2 * harmonic(x, fs, 1);
  assert.ok(top(hard) > top(soft) + 3, 'blown harder, the top comes up');
});

test('the same note blows the same; a slurred note glides in without starting again', () => {
  assert.deepEqual(blowReed(note('cone', 60, 0.7), seeded(3)), blowReed(note('cone', 60, 0.7), seeded(3)));
  const slur = blowReed({ ...note('cone', 62, 0.7), from: mtof(60) }, seeded(4));
  const fresh = blowReed(note('cone', 62, 0.7), seeded(4));
  // A slur's breath is already full, while a fresh note speaks over its first tens of ms.
  const early = (x: Float32Array) => { let s = 0; for (let i = Math.floor(0.002 * SR); i < Math.floor(0.012 * SR); i++) s += x[i]! * x[i]!; return s; };
  assert.ok(early(slur) > early(fresh) * 3, 'a slur sounds at once; a fresh note is still speaking');
});

test('a tongued sax note speaks as a recorded alto does: quickly blown hard, slowly blown soft, its 4th harmonic in the tone', () => {
  // Measured on an alto's held notes: 10 to 90 per cent of the held level in 21 to 48 ms at
  // ff, 36 to 58 at mf and 150 or more at pp, and the 3rd, 4th and 5th harmonics about level
  // with one another (the 4th within about 2 dB of its neighbours).
  const rise = (x: Float32Array): number => {
    const held = rms(x, 0.4, 0.8);
    let t10 = -1;
    for (let t = 0; t < 0.4; t += 0.002) {
      const now = rms(x, t, t + 0.004);
      if (t10 < 0 && now > held * 0.1) t10 = t;
      if (now > held * 0.9) return t - t10;
    }
    return 1;
  };
  for (const midi of [55, 64, 69]) {
    const hard = blowReed({ ...note('cone', midi, 0.9), dur: 1, seconds: 1.1 }, seeded(midi));
    const soft = blowReed({ ...note('cone', midi, 0.3), dur: 1, seconds: 1.1 }, seeded(midi));
    assert.ok(rise(hard) < 0.05, `${midi}: blown hard, from 10 to 90 per cent in ${(rise(hard) * 1000).toFixed(0)} ms`);
    assert.ok(rise(soft) > rise(hard) + 0.015, `${midi}: blown softly it speaks more slowly (${(rise(soft) * 1000).toFixed(0)} ms)`);
    // The 5th harmonic sits near a node of the reed's place, so one note's reading swings by
    // several dB with the breath: the median over a few takes is what holds.
    const f = mtof(midi);
    const takes = [1, 2, 3, 4, 5].map((s) => {
      const x = blowReed({ ...note('cone', midi, 0.7), dur: 1, seconds: 1.1 }, seeded(midi + s * 1000));
      return harmonic(x, f, 4) - (harmonic(x, f, 3) + harmonic(x, f, 5)) / 2;
    }).sort((a, b) => a - b);
    assert.ok(takes[2]! > -8, `${midi}: the 4th harmonic ${takes[2]!.toFixed(1)} dB against the 3rd and 5th`);
  }
});

test('every note the lead plays sounds on its own pitch at every strength, the top of the range too', () => {
  // The old sax jumped to the octave from G#5 up at the station's usual strength (a tenth of
  // the sax's notes); the pressure's ceiling now falls with the note.
  for (let midi = 64; midi <= 84; midi += 2) for (const vel of [0.1, 0.5, 0.8, 1]) {
    const x = blowReed(note('cone', midi, vel), seeded(midi * 31 + Math.round(vel * 10)));
    const f = mtof(midi);
    assert.ok(harmonic(x, f, 1) > harmonic(x, f, 2) - 10 && harmonic(x, f, 1) > -40, `${midi} at ${vel}: on its pitch, not its octave`);
  }
  assert.ok(saxPressure(1, 84) < saxPressure(1, 70), 'the top notes are blown under a lower ceiling');
  assert.ok(saxPressure(0, 84) >= 0.58 && saxPressure(1, 84) > saxPressure(0, 84), 'and still speak, softer to harder');
});

test('a sax note is brighter blown harder, by about as much as a recorded alto gets brighter getting louder', () => {
  // Recorded altos swelling on one note gain 1.3 to 2 dB above 1 kHz for each dB louder; the
  // station's strengths from 0.35 to 0.85 span about 5 dB of loudness (lib/lofi-winds.ts).
  for (const midi of [55, 62, 69]) {
    const soft = blowReed(note('cone', midi, 0.35), seeded(midi));
    const hard = blowReed(note('cone', midi, 0.85), seeded(midi));
    const gain = bright(hard) - bright(soft);
    assert.ok(gain > 2.5 && gain < 10, `${midi}: ${gain.toFixed(1)} dB more above 1 kHz blown harder`);
  }
});

test('a sax note carries its breath about as far under the note as a recorded player\'s, soft or loud', () => {
  // The recorded players' noise between the harmonics, 2 to 8 kHz, sat 31 to 43 dB under the
  // note, about the same at pp, mf and ff; the old model's sat 53 to 58. Read here as the
  // bands halfway between the harmonics from the 8th to the 20th, against the whole tone.
  const midi = 62, f = mtof(midi);
  const soft = air(blowReed(note('cone', midi, 0.3), seeded(7)), f);
  const hard = air(blowReed(note('cone', midi, 0.9), seeded(7)), f);
  const old = air(blowReed({ ...note('cone', midi, 0.9), air: 0.02 }, seeded(7)), f);
  // Single bins between the harmonics, against the harmonics' sum: the old model read -70 to
  // -75 here (its sax at the same strengths), the new one -54 to -57.
  assert.ok(hard > -62 && hard < -45, `breath ${hard.toFixed(1)} dB under a loud note`);
  assert.ok(soft > hard - 1, `a soft note is at least as airy (${soft.toFixed(1)} against ${hard.toFixed(1)})`);
  assert.ok(hard > old + 5, `and the air in the tone is what carries it (${old.toFixed(1)} dB with almost none)`);
});

test('a held sax note\'s vibrato comes in late and grows; a tongued note can fall into pitch', () => {
  // The recorded pop and jazz players: about 4.8 a second, 13 to 19 cents at full depth,
  // barely there for the first quarter second.
  const f = mtof(62);
  const held = blowSax({ ...note('cone', 62, 0.7), dur: 1.6, seconds: 1.7, vibrato: 18, rate: 4.8, vibratoAt: 0.22, vibratoGrow: 0.35 }, seeded(8));
  const swing = (a: number, b: number): number => {
    const cs: number[] = [];
    for (let t = a; t < b; t += 0.025) cs.push(cents(held, f, t, t + 0.05));
    const m = cs.reduce((s, c) => s + c, 0) / cs.length;
    return Math.sqrt(cs.reduce((s, c) => s + (c - m) ** 2, 0) / cs.length) * Math.SQRT2;
  };
  assert.ok(swing(0.05, 0.25) < 6, `the first quarter second is nearly straight (${swing(0.05, 0.25).toFixed(1)} cents)`);
  assert.ok(swing(0.8, 1.5) > 8 && swing(0.8, 1.5) < 30, `by its middle it swings ${swing(0.8, 1.5).toFixed(1)} cents`);
  const fall = blowSax({ ...note('cone', 62, 0.7), fallIn: 90, fallTime: 0.06 }, seeded(9));
  assert.ok(cents(fall, f, 0.005, 0.03) < -20, `starts flat (${cents(fall, f, 0.005, 0.03)} cents)`);
  assert.ok(Math.abs(cents(fall, f, 0.12, 0.3)) < 6, `and settles (${cents(fall, f, 0.12, 0.3)} cents)`);
});

test('a growled sax note beats with the player\'s hum; the sax\'s own marks are read only on a sax\'s line', () => {
  // A growled note's loudness moves 20 to 75 per cent between 15 and 90 Hz in the recorded
  // solos; a plain note's 3 to 9 per cent.
  const play = (art: number) => saxNote({ sr: SR, midi: 62, vel: 0.7, dur: 1.2, art, rate: 4.8, straight: true }, seeded(10));
  const f = mtof(62);
  const plain = roughness(play(0), f, 0.3, 1.1);
  const growled = roughness(play(SAX_PLAYED | SAX_GROWL), f, 0.3, 1.1);
  assert.ok(plain > 0.01 && plain < 0.12, `a plain note's loudness moves ${(plain * 100).toFixed(0)} per cent`);
  assert.ok(growled > 0.18, `a growled note's ${(growled * 100).toFixed(0)} per cent`);
  // Another lead's flags (a flute player's, a guitarist's) leave a doubling sax alone.
  assert.ok(roughness(play(SAX_GROWL), f, 0.3, 1.1) < 0.12, 'an unmarked 2 is not a growl');
});

test('a subtone is darker and airier than the same note blown plainly', () => {
  const play = (art: number) => saxNote({ sr: SR, midi: 57, vel: 0.6, dur: 1, art, rate: 4.8, straight: true }, seeded(11));
  const plain = play(0), sub = play(SAX_PLAYED | SAX_SUBTONE);
  assert.ok(bright(sub) < bright(plain) - 2, `darker (${bright(sub).toFixed(1)} against ${bright(plain).toFixed(1)} dB above 1 kHz)`);
  const f = mtof(57);
  assert.ok(air(sub, f) > air(plain, f) + 3, `and airier (${air(sub, f).toFixed(1)} against ${air(plain, f).toFixed(1)} dB)`);
});

test('a tongued sax note puffs as the tongue lets go; a slurred one does not', () => {
  // The recorded tongued notes' air above 4 kHz rose 4 to 14 dB over the held note's for about 30 ms.
  const puff = (x: Float32Array): number => {
    const hf = highPass(highPass(x, 4000), 4000);
    return 20 * Math.log10(rms(hf, 0, 0.015) / rms(hf, 0.15, 0.25));
  };
  const short = saxNote({ sr: SR, midi: 64, vel: 0.8, dur: 0.3, art: 0, rate: 4.8 }, seeded(12));
  const slurred = saxNote({ sr: SR, midi: 64, from: 62, vel: 0.8, dur: 0.3, art: 0, rate: 4.8 }, seeded(12));
  assert.ok(puff(short) > puff(slurred) + 2, `the puff: ${puff(short).toFixed(1)} dB against a slur's ${puff(slurred).toFixed(1)}`);
});
