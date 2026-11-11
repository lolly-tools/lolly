// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sayLolly, TAG_DELIVERIES } from './lofi-voice.ts';

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
