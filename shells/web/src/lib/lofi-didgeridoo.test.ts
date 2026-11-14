// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Didgeridoo, YIDAKI, type DidgeEvent } from './lofi-didgeridoo.ts';
import { DIDGE_BREATH, DIDGE_DRONE, DIDGE_TOOT } from '../../../../engine/src/lofi-straya.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
/** A harmonic's level (dB) between `a` and `b` seconds (a Hann-windowed DFT bin). */
function level(x: Float32Array, hz: number, a: number, b: number): number {
  const w = (2 * Math.PI * hz) / SR, i0 = Math.floor(a * SR), i1 = Math.floor(b * SR);
  let re = 0, im = 0;
  for (let i = i0; i < i1; i++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - i0)) / (i1 - i0)); re += x[i]! * h * Math.cos(w * i); im += x[i]! * h * Math.sin(w * i); }
  return 10 * Math.log10(re * re + im * im + 1e-30);
}
/** The strongest frequency near `hz` (±`span`), by a fine search. */
function peak(x: Float32Array, hz: number, span: number, a: number, b: number): number {
  let best = -Infinity, at = hz;
  for (let f = hz * (1 - span); f <= hz * (1 + span); f += hz * 0.001) { const l = level(x, f, a, b); if (l > best) { best = l; at = f; } }
  return at;
}
const drone = (seconds: number): DidgeEvent[] => [{ at: 0, dur: seconds, art: DIDGE_DRONE, vel: 0.6, role: 0 }];

test('every kind drones in tune on its note, its odd harmonics strong and its even ones weak', () => {
  for (let kind = 0; kind < YIDAKI.length; kind++) {
    // Each instrument across its own range: the Didgeridoo low, the Yidaki higher.
    for (const midi of YIDAKI[kind]!.family === 'yidaki' ? [34, 41, 47] : [29, 34, 40]) {
      const f = mtof(midi);
      const x = new Didgeridoo({ sr: SR, f, seed: 3, variant: kind }).render(drone(1.6), 1.6);
      assert.ok(x.every(Number.isFinite), `kind ${kind} ${midi}: finite`);
      const at = peak(x, f, 0.04, 0.7, 1.5);
      const cents = 1200 * Math.log2(at / f);
      assert.ok(Math.abs(cents) < 30, `kind ${kind} ${midi}: ${cents.toFixed(0)} cents`);
      const h = (k: number): number => level(x, at * k, 0.7, 1.5);
      // The recordings' median: the 3rd 8 dB under the fundamental, the 2nd 25 dB under.
      assert.ok(h(3) > h(2) + 4, `kind ${kind} ${midi}: the 3rd (${(h(3) - h(1)).toFixed(0)} dB) over the 2nd (${(h(2) - h(1)).toFixed(0)} dB)`);
      assert.ok(h(1) > h(2), `kind ${kind} ${midi}: the fundamental leads`);
    }
  }
});

test('a toot jumps up to the bore\'s second resonance, about a tenth to a twelfth over the drone', () => {
  for (let kind = 0; kind < YIDAKI.length; kind++) {
    const f = mtof(38);
    const notes: DidgeEvent[] = [...drone(0.6), { at: 0.6, dur: 0.3, art: DIDGE_TOOT, vel: 0.8, role: 2 }, { at: 0.9, dur: 0.6, art: DIDGE_DRONE, vel: 0.6, role: 0 }];
    const x = new Didgeridoo({ sr: SR, f, seed: 7, variant: kind }).render(notes, 1.5);
    const toot = peak(x, f * YIDAKI[kind]!.second, 0.08, 0.66, 0.78);
    const ratio = toot / f;
    // Recorded didgeridoos toot 2.2 to 3 times their drone.
    assert.ok(ratio > 2.45 && ratio < 3.1, `kind ${kind}: the toot at ${ratio.toFixed(2)} times the drone`);
    assert.ok(level(x, toot, 0.66, 0.78) > level(x, f, 0.66, 0.78), `kind ${kind}: the toot is the loudest thing while it sounds`);
  }
});

test('circular breathing sags the drone and pushes it back without stopping it', () => {
  const f = mtof(38);
  const x = new Didgeridoo({ sr: SR, f, seed: 2 }).render([...drone(1), { at: 1, dur: 0.5, art: DIDGE_BREATH, vel: 0.7, role: 0 }, { at: 1.5, dur: 1, art: DIDGE_DRONE, vel: 0.6, role: 0 }], 2.5);
  const rms = (a: number, b: number): number => { let s = 0; for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) s += x[i]! ** 2; return 10 * Math.log10(s / ((b - a) * SR)); };
  const before = rms(0.6, 0.95), sag = rms(1.06, 1.13), push = rms(1.17, 1.25);
  assert.ok(before - sag > 1.5 && before - sag < 10, `the sag: ${(before - sag).toFixed(1)} dB`);
  assert.ok(push > sag + 1.5, `the push back: ${(push - sag).toFixed(1)} dB over the sag`);
  assert.ok(sag > before - 12, 'the drone never stops');
});

test('a player carries on: two spans rendered one after the other are one span', () => {
  const f = mtof(36);
  const notes: DidgeEvent[] = [{ at: 0, dur: 0.5, art: 1, vel: 0.6, role: 1 }, { at: 0.5, dur: 0.5, art: 7, vel: 0.7, role: 1 }];
  const whole = new Didgeridoo({ sr: SR, f, seed: 9 }).render(notes, 1);
  const p = new Didgeridoo({ sr: SR, f, seed: 9 });
  const a = p.render(notes, 0.5);
  const b = p.render(notes.map(n => ({ ...n, at: n.at - 0.5 })), 0.5);
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i]! - whole[i]!));
  for (let i = 0; i < b.length; i++) worst = Math.max(worst, Math.abs(b[i]! - whole[a.length + i]!));
  assert.ok(worst < 1e-4, `the two pieces are the whole (${worst})`);
});

test('the same notes and seed blow the same bytes', () => {
  const f = mtof(40);
  const n = drone(0.4);
  assert.deepEqual(new Didgeridoo({ sr: SR, f, seed: 4, variant: 3 }).render(n, 0.4), new Didgeridoo({ sr: SR, f, seed: 4, variant: 3 }).render(n, 0.4));
});

test('the Yidaki is the brighter instrument, its toot higher and stronger; the Didgeridoo the darker, its toot softer and lower', () => {
  const f = mtof(36);
  const band = (x: Float32Array, at: number, a: number, b: number, lo: number, hi: number): number => {
    let s = 0;
    for (let k = 1; k * at < hi; k++) if (k * at >= lo) s += 10 ** (level(x, k * at, a, b) / 10);
    return 10 * Math.log10(s + 1e-30);
  };
  const of = (kind: number) => {
    const x = new Didgeridoo({ sr: SR, f, seed: 4, variant: kind }).render([...drone(1), { at: 1, dur: 0.3, art: DIDGE_TOOT, vel: 0.8, role: 1 }, { at: 1.3, dur: 0.5, art: DIDGE_DRONE, vel: 0.6, role: 0 }], 1.8);
    const at = peak(x, f, 0.04, 0.4, 0.95);
    const rms = (a: number, b: number): number => { let s = 0; for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) s += x[i]! ** 2; return 10 * Math.log10(s / ((b - a) * SR)); };
    return { bright: band(x, at, 0.4, 0.95, 800, 3200) - level(x, at, 0.4, 0.95), toot: YIDAKI[kind]!.second, up: rms(1.05, 1.25) - rms(0.6, 0.95) };
  };
  const deep = [0, 1, 3].map(of), bright = [2, 4].map(of);
  for (const d of deep) for (const b of bright) {
    assert.ok(b.bright > d.bright + 4, `brighter by ${(b.bright - d.bright).toFixed(1)} dB above 800 Hz`);
    assert.ok(b.toot > d.toot, 'the Yidaki\'s toot sits higher over its drone');
    assert.ok(b.up > d.up + 1, `the Yidaki's toot ${b.up.toFixed(1)} dB up against the Didgeridoo's ${d.up.toFixed(1)}`);
  }
});
