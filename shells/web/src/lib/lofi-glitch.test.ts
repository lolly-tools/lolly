// SPDX-License-Identifier: MPL-2.0
/**
 * Botanica's glitches (lib/lofi-glitch.ts): the bitcrush, the sample-rate reduction, the
 * stutter, the spectral freeze, the reverse and the tape stop, each on the tune's own
 * material, and the beat repeater on the whole mix.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-glitch.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BeatRepeat, bitcrush, downsample, fft, glitch, repeatSlice, reversed, spectralFreeze, stutter, tapeStop } from './lofi-glitch.ts';
import { glitchMod } from '../../../../engine/src/lofi-botanica.ts';

const SR = 22050;
const tone = (hz: number, seconds: number): Float32Array => Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / SR));
/** The frequency of a signal's strongest bin, by the module's own FFT. */
function peakHz(x: Float32Array, n = 4096): number {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = (x[i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  fft(re, im);
  let best = 1;
  for (let k = 1; k < n / 2; k++) if (re[k]! ** 2 + im[k]! ** 2 > re[best]! ** 2 + im[best]! ** 2) best = k;
  return (best * SR) / n;
}

test('the FFT goes there and back', () => {
  const re = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i * 0.7) + (i % 5) * 0.1), im = new Float64Array(64);
  const orig = Float64Array.from(re);
  fft(re, im);
  fft(re, im, true);
  for (let i = 0; i < 64; i++) assert.ok(Math.abs(re[i]! / 64 - orig[i]!) < 1e-9);
});

test('a bitcrush leaves only its levels; a lower rate holds each sample until the next', () => {
  const x = tone(441, 0.1);
  const crushed = bitcrush(x, 4);
  assert.ok(new Set(crushed).size <= 17, `4 bits: ${new Set(crushed).size} levels`);
  for (const v of crushed) assert.ok(Math.abs(v * 8 - Math.round(v * 8)) < 1e-6);
  const held = downsample(x, 4);
  for (let i = 0; i + 4 <= held.length; i += 4) for (let k = 1; k < 4; k++) assert.equal(held[i + k], held[i], 'held across each step');
  assert.ok(held.some((v, i) => v !== x[i]), 'and not the signal it was');
});

test('a stutter repeats its slice, stepping in pitch when asked', () => {
  const x = tone(500, 1);
  const slice = Math.round(0.05 * SR);
  const s = stutter(x, SR, 100, slice, 4);
  assert.equal(s.length, slice * 4);
  // Away from the cut's few-millisecond fades, each repeat is the same slice.
  for (let i = 60; i < slice - 60; i++) assert.ok(Math.abs(s[i]! - s[slice * 2 + i]!) < 1e-6);
  const up = stutter(x, SR, 0, Math.round(0.2 * SR), 3, 12);
  assert.ok(Math.abs(peakHz(up.subarray(Math.round(0.4 * SR))) - 2000) < 40, 'two octaves up by the third repeat');
});

test('a spectral freeze holds the moment\'s spectrum and loudness, and is the same for the same seed', () => {
  const x = tone(880, 1.2);
  const n = Math.round(5 * SR);
  const f = spectralFreeze(x, 2000, n, 3);
  assert.equal(f.length, n);
  assert.ok(Math.abs(peakHz(f.subarray(SR, SR + 4096)) - 880) < 12 && Math.abs(peakHz(f.subarray(4 * SR - 4096, 4 * SR)) - 880) < 12, 'still at its pitch, early and late');
  const rmsOf = (a: Float32Array): number => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
  const ratio = rmsOf(f.subarray(SR, 3 * SR)) / 0.354;
  assert.ok(ratio > 0.6 && ratio < 1.6, `as loud as the moment it froze (${ratio.toFixed(2)})`);
  const again = spectralFreeze(x, 2000, n, 3);
  assert.ok(f.every((v, i) => v === again[i]), 'the same seed, the same bytes');
});

test('a reverse plays backwards; a tape stop slows to nothing', () => {
  const ramp = Float32Array.from({ length: 100 }, (_, i) => i / 100);
  assert.deepEqual([...reversed(ramp).slice(0, 3)], [0.99, 0.98, 0.97].map(v => Math.fround(v)));
  const x = tone(1000, 1);
  const stop = tapeStop(x, SR);
  assert.ok(peakHz(stop.subarray(0, 4096)) > 850, 'it starts at speed');
  assert.ok(peakHz(stop.subarray(Math.round(0.6 * SR), Math.round(0.6 * SR) + 4096)) < 450, 'and has fallen by its last part');
  for (const kind of ['stutter', 'crush', 'freeze', 'reverse', 'tape'] as const) {
    const g = glitch(kind, x, SR, Math.round(0.6 * SR), 4);
    assert.ok(g.length > 0 && g.every(Number.isFinite), `${kind}: only sound values`);
  }
});

test('the beat repeater loops the mix\'s last slice for the note, the live mix gated off, and then lets go', () => {
  const events: string[] = [];
  class Param {
    value = 0;
    readonly name: string;
    constructor(name: string) { this.name = name; }
    setValueAtTime(v: number, t: number): void { events.push(`${this.name}=${v}@${t.toFixed(3)}`); }
    linearRampToValueAtTime(v: number, t: number): void { events.push(`${this.name}->${v}@${t.toFixed(3)}`); }
  }
  class Node {
    outs: unknown[] = [];
    connect<T>(to: T): T { this.outs.push(to); return to; }
    disconnect(): void { this.outs = []; }
  }
  const names = ['gate', 'feed', 'loop', 'wet'];
  let k = 0;
  const ctx = {
    createGain: () => Object.assign(new Node(), { gain: new Param(names[k++] ?? 'gain') }),
    createDelay: () => Object.assign(new Node(), { delayTime: new Param('delay') }),
  };
  const from = new Node(), to = new Node();
  from.connect(to);
  const rep = new BeatRepeat(ctx as unknown as BaseAudioContext, from as unknown as AudioNode, to as unknown as AudioNode);
  assert.ok(!from.outs.includes(to), 'the mix no longer goes straight on: it runs through the gate');
  const spb = 0.5;
  rep.repeat(10, repeatSlice(glitchMod('repeat', 2), spb), 0.5);
  assert.ok(events.includes('delay=0.125@9.855'), 'the slice is a quarter of the beat, set before it is caught');
  assert.ok(events.includes('gate->0@10.000') && events.includes('gate->1@10.500'), 'the live mix gated off for the repeat, then back');
  assert.ok(events.includes('loop->1@10.000') && events.includes('loop->0@10.500'), 'the delay feeds itself for the repeat');
  assert.ok(events.includes('wet->1@10.000') && events.includes('wet->0@10.500'));
});
