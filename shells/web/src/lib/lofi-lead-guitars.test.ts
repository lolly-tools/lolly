// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bendCurve } from './lofi-guitars.ts';
import { bridgeAt, partialsOf, type ElectricSpec } from './lofi-electric.ts';
import { CAB_4X12, CAB_GAIN, DOUBLED, doubleTrack, LEADS, TAKES, triodeCurve } from './lofi-lead-guitars.ts';
import type { VoiceKit } from './lofi-voices.ts';
import { leadPosition, perform, TUNING } from './lofi-perform.ts';
import { composeLofiTune, ELECTRIC_FRET } from '../../../../engine/src/lofi-compose.ts';

function seeded(a: number): () => number {
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const cents = (rate: number): number => 1200 * Math.log2(rate);

/** A Web Audio biquad's magnitude (dB) at `f`, by the spec's formulas (a low- or high-pass's Q in dB). */
function biquadDb([type, hz, q, db = 0]: readonly [BiquadFilterType, number, number, number?], f: number, sr = 44100): number {
  const w0 = (2 * Math.PI * hz) / sr, A = 10 ** (db / 40), cw = Math.cos(w0), sw = Math.sin(w0);
  const aQ = sw / (2 * q), aQdB = sw / (2 * 10 ** (q / 20));
  let b: number[], a: number[];
  if (type === 'lowpass') { b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + aQdB, -2 * cw, 1 - aQdB]; }
  else if (type === 'highpass') { b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + aQdB, -2 * cw, 1 - aQdB]; }
  else if (type === 'peaking') { b = [1 + aQ * A, -2 * cw, 1 - aQ * A]; a = [1 + aQ / A, -2 * cw, 1 - aQ / A]; }
  else throw new Error(type);
  const w = (2 * Math.PI * f) / sr;
  const mag = (c: number[]): number => Math.hypot(c[0]! + c[1]! * Math.cos(w) + c[2]! * Math.cos(2 * w), -(c[1]! * Math.sin(w) + c[2]! * Math.sin(2 * w)));
  return 20 * Math.log10(mag(b) / mag(a));
}
const cab = (f: number): number => CAB_4X12.reduce((s, b) => s + biquadDb(b, f), 0) - CAB_GAIN;

test('the 4x12 follows the measured cabinet: little under 80 Hz, its thump near 160, its fall above 6 kHz', () => {
  // The measured cabinet (a sixth of an octave smoothed, against 600 Hz to 2 kHz): 63 Hz -10, 160 Hz +4, 1 kHz +2, 2.5 kHz +2, 6.3 kHz -9, 8 kHz -29.
  const measured: Array<[number, number]> = [[63, -10.2], [100, 0.7], [160, 4.2], [200, 4.3], [315, 2.8], [1000, 1.8], [2500, 1.9], [4000, 1.1], [6300, -9.4]];
  for (const [f, db] of measured) assert.ok(Math.abs(cab(f) - db) < 3, `${f} Hz: ${cab(f).toFixed(1)} dB, measured ${db}`);
  assert.ok(cab(8000) < -20 && cab(10000) < -28, 'the speakers are gone by 8 kHz');
  const mids = [700, 1000, 1400, 2000].map(cab);
  assert.ok(Math.abs(mids.reduce((x, y) => x + y, 0) / mids.length) < 1.5, 'the level through the mids is the voicing\'s level');
});

test('a triode stage is silent at silence, of slope one there, and clips the top of the swing before the bottom', () => {
  const c = triodeCurve(0.5, 4001);
  const at = (x: number): number => c[Math.round(((x / 8 + 1) / 2) * 4000)]!;
  assert.equal(at(0), 0);
  assert.ok(Math.abs(at(0.2) / 0.2 - 1) < 0.03);
  assert.ok(Math.abs(at(-6)) > at(6) * 1.3, 'the bottom swings further before it flattens');
  for (let i = 1; i < c.length; i++) assert.ok(c[i]! >= c[i - 1]!, 'never turns back');
});

test('a bend holds at the picked pitch, rises in an S, lands a little sharp and settles on the note', () => {
  const c = bendCurve(2, 'bend', 100);
  assert.ok(Math.abs(cents(c[0]!) + 200) < 0.5 && Math.abs(cents(c[10]!) + 200) < 1, 'held a moment at the pick');
  assert.equal(c[99], 1);
  const over = Math.max(...Array.from(c).map(cents));
  assert.ok(over > 10 && over < 60, `over the note by ${over.toFixed(0)} cents`);
  // An S: slow off the fret, fastest through the middle.
  const step = (i: number): number => cents(c[i + 1]!) - cents(c[i]!);
  assert.ok(step(48) > 3 * step(20));
});

test('a slide moves fret by fret: it sits on each fret most of the way', () => {
  const c = bendCurve(3, 'slide', 120);
  const offFret = Array.from(c).map(cents).filter(v => Math.abs(v / 100 - Math.round(v / 100)) > 0.1).length;
  assert.ok(offFret < 120 * 0.3, `${offFret} of 120 points between frets`);
  for (let i = 1; i < c.length; i++) assert.ok(c[i]! >= c[i - 1]! - 1e-9, 'a slide up never goes back');
  const down = bendCurve(-2, 'slide', 50);
  assert.ok(down[0]! > 1 && down[49] === 1, 'a slide down comes from above');
});

test('the bridge pickup is slanted, nearer the saddle under the treble strings, and hears more of the top', () => {
  assert.ok(bridgeAt(82.4, 0) > bridgeAt(329.6, 0));
  assert.equal(bridgeAt(110 * 2 ** (5 / 12), 5), bridgeAt(110, 0), 'fretted on the A string, it sits under the A');
  const spec: ElectricSpec = { sr: 44100, f: 196, seconds: 1, fret: 0, pick: 0.14, layer: 1 };
  const share = (p: ElectricSpec): number => {
    const parts = partialsOf(p, seeded(3));
    return parts.filter(x => x.hz > 1500).reduce((s, x) => s + x.amp * x.amp, 0) / parts.reduce((s, x) => s + x.amp * x.amp, 0);
  };
  assert.ok(share({ ...spec, pickup: 'bridge' }) > 1.5 * share(spec));
});

test('the lead guitarist fingers each note where the hand sits for the bar, and keeps the bends and slides', () => {
  let notes = 0, bent = 0;
  for (const [mood, lead] of [['rock', 'overdrive'], ['metal', 'metal'], ['grunge', 'riff'], ['funk', 'guitar']] as const) {
    for (const bar of composeLofiTune(4, mood, { lead })) {
      const played = perform(bar, 0.5, bar.tune.style.keys, lead).filter(n => n.voice === 'lead');
      if (!played.length) continue;
      const shift = LEADS[lead]!.shift;
      const frets = played.map(n => {
        const fret = Math.floor((n.mod ?? 0) / ELECTRIC_FRET);
        assert.ok((TUNING as readonly number[]).includes(Math.round(n.midi + shift) - fret) || fret === 0, `${lead}: ${n.midi} on fret ${fret}`);
        if ((n.mod ?? 0) % ELECTRIC_FRET === 1) bent++;
        notes++;
        return fret;
      }).filter(f => f > 0);
      if (frets.length > 1) assert.ok(Math.max(...frets) - Math.min(...frets) <= 7, `${lead} in ${mood}: a bar spans frets ${Math.min(...frets)} to ${Math.max(...frets)}`);
    }
  }
  assert.ok(notes > 100 && bent > 0);
  // A pentatonic line is found a place where the hand reaches every note without moving.
  for (const line of [[57, 60, 62, 64, 67, 69, 72], [69, 72, 74, 76, 79, 81]]) {
    const pos = leadPosition(line);
    for (const p of line) assert.ok(TUNING.some(open => p - open >= pos && p - open <= pos + 3), `${p} from position ${pos}`);
  }
});

test('metal is double-tracked: two takes, either side, each with its own timing and tuning, never a delayed copy', () => {
  assert.ok(DOUBLED.has('metal') && !DOUBLED.has('overdrive') && !DOUBLED.has('guitar') && !DOUBLED.has('riff'));
  const k = { rng: seeded(11) } as unknown as VoiceKit;
  const apart: number[] = [], tuning: number[] = [];
  for (let i = 0; i < 400; i++) {
    const [a, b] = doubleTrack('metal', k);
    assert.ok(a!.pan < 0 && b!.pan > 0 && Math.abs(a!.pan) === TAKES.pan, 'one take each side');
    assert.ok(!a!.second && b!.second, 'the second take goes through the other amp');
    assert.ok(a!.level === b!.level && a!.late >= 0);
    apart.push((b!.late - a!.late) * 1000);
    tuning.push(b!.detune - a!.detune);
  }
  const mean = (xs: number[]): number => xs.reduce((x, y) => x + y, 0) / xs.length;
  const sd = (xs: number[]): number => Math.sqrt(mean(xs.map(x => (x - mean(xs)) ** 2)));
  // The measured pair: the second take 17 ms behind, 2 to 3 ms either way note to note; 6 cents apart.
  assert.ok(mean(apart) > 10 && mean(apart) < 20, `${mean(apart).toFixed(1)} ms apart`);
  assert.ok(sd(apart) > 2 && sd(apart) < 6 && Math.min(...apart) >= 4 && Math.max(...apart) <= 30, `${sd(apart).toFixed(1)} ms either way, ${Math.min(...apart).toFixed(1)} to ${Math.max(...apart).toFixed(1)}`);
  const offTune = mean(tuning.map(Math.abs));
  assert.ok(offTune > 2 && offTune < 8, `${offTune.toFixed(1)} cents apart`);
});
