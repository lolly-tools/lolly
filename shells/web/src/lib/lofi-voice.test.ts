// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sayLolly, sayShout, SHOUT_PHRASES, TAG_DELIVERIES, type ShoutPhrase } from './lofi-voice.ts';
import { isShoutPhrase } from './lofi-tag.ts';

const SR = 44100;
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const say = (d: typeof TAG_DELIVERIES[number], seed = 1) => sayLolly(SR, d, { midi: 60, beat: 0.5 }, seeded(seed));
/** How long the voice sounds: from the first to the last moment above a fiftieth of its loudest. */
function sounding(x: Float32Array): number {
  const n = 441, e: number[] = [];
  for (let i = 0; i + n <= x.length; i += n) { let s = 0; for (let j = i; j < i + n; j++) s += x[j]! * x[j]!; e.push(s); }
  const top = Math.max(...e), on = e.map((v, i) => (v > top / 50 ? i : -1)).filter(i => i >= 0);
  return ((on[on.length - 1]! - on[0]! + 1) * n) / SR;
}
/** The strongest frequency between lo and hi Hz over a window, in 1 Hz steps. */
function strongest(x: Float32Array, from: number, to: number, lo: number, hi: number): number {
  let best = -1, at = lo;
  for (let f = lo; f <= hi; f++) {
    const w = (2 * Math.PI * f) / SR; let re = 0, im = 0;
    for (let i = Math.floor(from * SR); i < Math.floor(to * SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
    if (re * re + im * im > best) { best = re * re + im * im; at = f; }
  }
  return at;
}

test('every delivery says the word: finite, stereo, at a comfortable peak, the length of a word', () => {
  for (const d of TAG_DELIVERIES) {
    const [l, r] = say(d);
    assert.equal(l.length, r.length);
    assert.ok(l.every(Number.isFinite) && r.every(Number.isFinite), `${d}: finite`);
    let peak = 0;
    for (const ch of [l, r]) for (const v of ch) peak = Math.max(peak, Math.abs(v));
    assert.ok(peak > 0.7 && peak <= 0.8001, `${d}: peak ${peak.toFixed(2)}`);
    const len = sounding(l);
    assert.ok(len > 0.3 && len < 1.6, `${d}: sounds for ${len.toFixed(2)} s`);
  }
});

test('the same tag renders the same; another tune draws another speaker', () => {
  assert.deepEqual(say('spoken', 7), say('spoken', 7));
  assert.notDeepEqual(say('spoken', 7)[0], say('spoken', 8)[0]);
});

test('sung on the key: the fifth on "lol", the note on "ly"', () => {
  // A woman's voice sings at the note (midi 60 is 261.6 Hz), a man's an octave down.
  for (let seed = 1; seed <= 6; seed++) {
    const [l] = say('sung', seed);
    const start = l.findIndex(v => Math.abs(v) > 0.05) / SR;
    const ly = strongest(l, start + 0.55, start + 0.75, 110, 300);
    const lol = strongest(l, start + 0.08, start + 0.2, 160, 420);
    const near = (f: number, want: number): boolean => [want, want / 2].some(w => Math.abs(1200 * Math.log2(f / w)) < 60);
    assert.ok(near(ly, 261.6), `seed ${seed}: "ly" at ${ly} Hz`);
    assert.ok(near(lol, 392), `seed ${seed}: "lol" at ${lol} Hz`);
  }
});

test('a crowd stands across the stage; a whisper has no voice in it', () => {
  const [l, r] = say('crowd');
  let diff = 0, sum = 0;
  for (let i = 0; i < l.length; i++) { diff += (l[i]! - r[i]!) ** 2; sum += (l[i]! + r[i]!) ** 2; }
  assert.ok(diff / sum > 0.05, 'the voices are placed apart');
  // A voiced word repeats itself every period; a whisper, being breath, does not.
  const periodic = (x: Float32Array): number => {
    const from = x.findIndex(v => Math.abs(v) > 0.05) + Math.round(0.1 * SR), n = Math.round(0.15 * SR);
    let e = 0;
    for (let i = from; i < from + n; i++) e += x[i]! * x[i]!;
    let best = 0;
    for (let lag = Math.round(SR / 400); lag <= Math.round(SR / 70); lag++) {
      let c = 0;
      for (let i = from; i < from + n; i++) c += x[i]! * x[i + lag]!;
      best = Math.max(best, c / e);
    }
    return best;
  };
  const voiced = periodic(say('spoken')[0]), breath = periodic(say('whisper')[0]);
  assert.ok(voiced > 0.6 && breath < 0.4, `spoken repeats (${voiced.toFixed(2)}), the whisper does not (${breath.toFixed(2)})`);
});

// ── The band's shouts ─────────────────────────────────────────────────────

const shoutOf = (p: ShoutPhrase, opts: { midi?: number; bpm?: number; crowd?: boolean; voice?: number; take?: number } = {}) =>
  sayShout(SR, p, { midi: opts.midi ?? 60, beat: 60 / (opts.bpm ?? 166), crowd: opts.crowd ?? false }, seeded(opts.voice ?? 3), seeded(opts.take ?? 9));
/** Energy (dB) in 5 ms frames, of the whole signal and of what is above 4 kHz. */
function frames(x: Float32Array): Array<{ t: number; all: number; high: number }> {
  const n = Math.round(SR * 0.005), out: Array<{ t: number; all: number; high: number }> = [];
  let lp = 0;
  const a = 1 - Math.exp((-2 * Math.PI * 4000) / SR);
  for (let i = 0; i + n <= x.length; i += n) {
    let all = 0, high = 0;
    for (let j = i; j < i + n; j++) { lp += a * (x[j]! - lp); all += x[j]! ** 2; high += (x[j]! - lp) ** 2; }
    out.push({ t: i / SR, all: 10 * Math.log10(all / n + 1e-12), high: 10 * Math.log10(high / n + 1e-12) });
  }
  return out;
}

test('every shout is said: finite, stereo, at a comfortable peak, its stressed vowel where it says', () => {
  for (const p of SHOUT_PHRASES) for (const crowd of [false, true]) {
    const { audio: [l, r], at } = shoutOf(p, { crowd });
    assert.equal(l.length, r.length);
    assert.ok(l.every(Number.isFinite) && r.every(Number.isFinite), `${p}: finite`);
    let peak = 0;
    for (const ch of [l, r]) for (const v of ch) peak = Math.max(peak, Math.abs(v));
    assert.ok(peak > 0.7 && peak <= 0.8001, `${p}: peak ${peak.toFixed(2)}`);
    const len = sounding(l);
    assert.ok(len > 0.25 && len < 1.1, `${p}${crowd ? ' (crowd)' : ''}: sounds for ${len.toFixed(2)} s`);
    // The stressed vowel is loud from just after `at` (a crowd's voices beat against each other, so on average).
    const f = frames(l), loud = Math.max(...f.map(x => x.all));
    const after = f.filter(x => x.t >= at + 0.02 && x.t < at + 0.07);
    const level = 10 * Math.log10(after.reduce((sum, x) => sum + 10 ** (x.all / 10), 0) / after.length);
    const before = f.filter(x => x.t >= at - 0.2 && x.t < at - 0.02);
    assert.ok(level > loud - 14, `${p}${crowd ? ' (crowd)' : ''}: the stressed vowel sounds from ${at.toFixed(2)} s (${(level - loud).toFixed(0)} dB)`);
    assert.ok(Math.min(...before.map(x => x.all)) < level - 12, `${p}${crowd ? ' (crowd)' : ''}: and is not under way before it`);
  }
});

test('the consonants are there: the closures of "pick it up" fall silent, the s of "let\'s" hisses', () => {
  // "pick it up" at 166 bpm keeps eighths: three vowels, with the k's and the t's closures between them.
  const { audio: [l], at } = shoutOf('pickitup');
  const f = frames(l), loud = Math.max(...f.map(x => x.all));
  const step = 60 / 166 / 2;
  const gaps = [at + step - 0.05, at + 2 * step - 0.04].map(g => Math.min(...f.filter(x => x.t > g - 0.03 && x.t < g + 0.02).map(x => x.all)));
  for (const [i, g] of gaps.entries()) assert.ok(g < loud - 30, `closure ${i + 1} falls silent (${(g - loud).toFixed(0)} dB)`);
  // The s of "let's", between its vowel and the "go": more hiss above 4 kHz than anywhere in the vowels.
  const lets = shoutOf('letsgo');
  const g = frames(lets.audio[0]);
  const hiss = g.filter(x => x.t > lets.at - 0.14 && x.t < lets.at - 0.07);
  const vowel = g.filter(x => x.t > lets.at + 0.05 && x.t < lets.at + 0.2);
  const tilt = (xs: typeof g): number => Math.max(...xs.map(x => x.high - x.all));
  assert.ok(tilt(hiss) > tilt(vowel) + 10, `the s is hiss (${tilt(hiss).toFixed(0)} dB above 4 kHz against the vowel's ${tilt(vowel).toFixed(0)})`);
});

test('pitched to the tune: the stressed vowel sits near the note, in the shouter\'s own register', () => {
  for (let voice = 1; voice <= 8; voice++) {
    const { audio: [l], at } = shoutOf('go', { midi: 62, voice });
    const f0 = strongest(l, at + 0.06, at + 0.16, 140, 520);
    // "Go" peaks a semitone above the note (D, 293.7 Hz, or an octave away).
    const cents = Math.min(...[146.8, 293.7, 587.3].map(w => Math.abs(1200 * Math.log2(f0 / (w * 1.06)))));
    assert.ok(cents < 120, `voice ${voice}: "go" at ${f0} Hz, ${cents.toFixed(0)} cents from the note`);
  }
});

test('each call is a little different; the same call is the same; a crowd stands across the stage', () => {
  assert.deepEqual(shoutOf('letsgo', { take: 4 }), shoutOf('letsgo', { take: 4 }));
  const a = shoutOf('letsgo', { take: 4 }).audio[0], b = shoutOf('letsgo', { take: 5 }).audio[0];
  assert.notDeepEqual(a, b, 'two takes differ');
  const [l, r] = shoutOf('pickitup', { crowd: true }).audio;
  let diff = 0, sum = 0;
  for (let i = 0; i < l.length; i++) { diff += (l[i]! - r[i]!) ** 2; sum += (l[i]! + r[i]!) ** 2; }
  assert.ok(diff / sum > 0.04, `the crowd is placed apart (${(diff / sum).toFixed(3)})`);
});

test('a hey note plays a phrase only when its mod names one', () => {
  for (const [mod, phrase] of [[0, false], [2, false], [8, false], [9, true], [10, true], [11, true], [12, false], [25, true], [27, true]] as const) assert.equal(isShoutPhrase(mod), phrase, `mod ${mod}`);
});
