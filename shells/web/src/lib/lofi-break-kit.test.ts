// SPDX-License-Identifier: MPL-2.0
/**
 * Chopped breaks, recorded and played (lib/lofi-break-record.ts, lib/lofi-break-kit.ts),
 * against a fake AudioContext.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-break-kit.test.ts
 *
 * What is pinned:
 *  - a tune's break is the same recording however its steps are spread, and a different
 *    tune's is not;
 *  - the recording runs the whole take at the tune's tempo (sped up or slowed from the
 *    drummer's), mono, normalised, and the old samplers' output filters keep the top dark
 *    where drum and bass's clean one does not;
 *  - a slice plays its stretch of the recording from where its sound starts, at its pitch,
 *    a moment early so its attack is whole, until the next slice takes over; a reversed
 *    slice plays backwards, a held one the time-stretch, a falling one slows to a stop;
 *  - the break's filter teases it under an intro, climbs through a build and drops back at
 *    the drop, and drum and bass's sits well clear of the kit's kick.
 * How the breaks measure against recordings is in docs/generated-music.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakTake, sliceMod, type BreakStyle } from '../../../../engine/src/lofi-break-chop.ts';
import type { LofiBar, LofiMood, LofiNote, LofiSection } from '../../../../engine/src/lofi-compose.ts';
import { BreakRecorder, SAMPLERS, sliceStart, stretchSlice, type BreakKit } from './lofi-break-record.ts';
import * as BK from './lofi-break-kit.ts';
import type { VoiceKit } from './lofi-voices.ts';

const KIT: BreakKit = { snareHead: 205, wires: 1.1, ring: 1, hatBright: 1, hatDecay: 1, rideRate: 0.88, wash: 1.1, kick: 58 };
const record = (style: BreakStyle, seed: number, bpm: number, sr = 16000, spread = false): Float32Array => {
  const rec = new BreakRecorder(breakTake(seed, style, bpm), style, KIT, bpm, sr, seed);
  if (spread) while (rec.step()) { /* a step a tick */ }
  return rec.finish();
};
/** The share of a signal's energy above `hz`, through a fourth-order Butterworth high-pass. */
function above(x: Float32Array, sr: number, hz: number): number {
  let y = Float32Array.from(x);
  for (const q of [0.5412, 1.3066]) {
    const w = (2 * Math.PI * hz) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const b0 = (1 + cw) / 2 / a0, b1 = -(1 + cw) / a0, a1 = (-2 * cw) / a0, a2 = (1 - al) / a0;
    const out = new Float32Array(y.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let n = 0; n < y.length; n++) { const v = y[n]!; const o = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; out[n] = o; }
    y = out;
  }
  let all = 0, top = 0;
  for (let n = 0; n < x.length; n++) { all += x[n]! * x[n]!; top += y[n]! * y[n]!; }
  return top / Math.max(1e-12, all);
}

test('a break is the same recording however its steps are spread, and another tune\'s is not', () => {
  const a = record('jungle', 3, 168, 16000, true);
  const b = record('jungle', 3, 168, 16000, false);
  assert.equal(a.length, b.length);
  assert.ok(a.every((v, i) => v === b[i]), 'step by step and at once give the same bytes');
  const c = record('jungle', 4, 168, 16000);
  assert.ok(c.length !== a.length || c.some((v, i) => v !== a[i]), 'another seed, another break');
});

test('the recording is the whole take at the tune\'s tempo, normalised, the old samplers dark at the top', () => {
  const sr = 44100;
  const jungle = record('jungle', 5, 170, sr);
  const take = breakTake(5, 'jungle', 170);
  const bars = 16 * (60 / 170);
  assert.ok(jungle.length / sr > bars && jungle.length / sr < bars + 1.2, `64 slices at 170 bpm and a tail (${(jungle.length / sr).toFixed(2)} s)`);
  assert.ok(170 / take.bpm > 1.15, 'sped up from the drummer\'s tempo');
  let peak = 0;
  for (const v of jungle) peak = Math.max(peak, Math.abs(v));
  assert.ok(Math.abs(peak - 0.9) < 1e-6, `normalised (${peak})`);
  // The same take through drum and bass's clean sampler.
  const clean = new BreakRecorder(take, 'dnb', KIT, 170, sr, 5).finish();
  const a = above(jungle, sr, 15000), b = above(clean, sr, 15000);
  assert.ok(a * 5 < b, `the twelve-bit sampler's filter keeps the top dark: above 15 kHz ${a.toExponential(2)} against the clean one's ${b.toExponential(2)}`);
  assert.equal(SAMPLERS.jungle.bits, 12);
  assert.equal(SAMPLERS.dnb.bits, 16);
  assert.ok(!SAMPLERS.hiphop.filtered, 'the hip-hop sampler lets its cymbals fold back');
});

test('a held slice is stretched to its length, its grains read on through the material', () => {
  const sr = 8000;
  const rec = new Float32Array(sr).map((_, i) => Math.sin(i * 0.3) * (i < 800 ? 1 : 0.2));
  const held = stretchSlice(rec, sr, 0.01, 0.05, 0.4);
  assert.equal(held.length, Math.round(0.4 * sr));
  assert.ok(held.some(v => Math.abs(v) > 0.3), 'it sounds');
  assert.ok(sliceStart(breakTake(1, 'jungle', 168), 0, 168) < 0.02, 'slice 0 starts at the top');
  const t = breakTake(1, 'jungle', 168);
  for (let s = 1; s < 64; s++) assert.ok(sliceStart(t, s, 168) > sliceStart(t, s - 1, 168), `slice ${s} after slice ${s - 1}`);
});

// ── a fake audio context, enough for the slices and their filter ─────────────────
type Ev = [kind: string, value: number, time: number];
class Param {
  value = 0;
  events: Ev[] = [];
  setValueAtTime(v: number, t: number): this { this.events.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v: number, t: number): this { this.events.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v: number, t: number): this { assert.ok(v > 0); this.events.push(['exp', v, t]); return this; }
  setTargetAtTime(v: number, t: number): this { this.events.push(['target', v, t]); return this; }
}
class Node { outs: unknown[] = []; connect<T>(to: T): T { this.outs.push(to); return to; } }
class Gain extends Node { gain = new Param(); }
class Filter extends Node { type = 'lowpass'; frequency = new Param(); Q = new Param(); }
class Buf { readonly data: Float32Array; readonly length: number; readonly duration: number; constructor(n: number, sr: number) { this.data = new Float32Array(n); this.length = n; this.duration = n / sr; } getChannelData(): Float32Array { return this.data; } }
class Source extends Node { buffer: Buf | null = null; playbackRate = new Param(); startAt = -1; offset = -1; stopAt = -1; start(t: number, o = 0): void { this.startAt = t; this.offset = o; } stop(t: number): void { this.stopAt = t; } }
class Ctx {
  sampleRate = 16000;
  currentTime = 0;
  sources: Source[] = [];
  filters: Filter[] = [];
  buffers: Buf[] = [];
  createGain(): Gain { return new Gain(); }
  createBiquadFilter(): Filter { const f = new Filter(); this.filters.push(f); return f; }
  createBufferSource(): Source { const s = new Source(); this.sources.push(s); return s; }
  createBuffer(_c: number, n: number, sr: number): Buf { const b = new Buf(n, sr); this.buffers.push(b); return b; }
}
const kitOf = (): { ctx: Ctx; k: VoiceKit; lane: Gain } => {
  const ctx = new Ctx();
  return { ctx, k: { ctx: ctx as unknown as BaseAudioContext, noise: {} as AudioBuffer, rng: () => 0.5 }, lane: new Gain() };
};
const barOf = (mood: LofiMood, section: LofiSection, layers: LofiBar['layers'], notes: LofiNote[] = [], bpm = 168): LofiBar => ({
  tune: { mood, seed: 11, bpm, swing: 0.5, swing8: 0.5, key: 'C minor', progressions: [[], []], style: {} as LofiBar['tune']['style'], bars: 1 }, section, index: 0, layers, chord: 'Cm', tones: [0], notes, open: 1, level: 1,
});
const slice = (voice: LofiNote['voice'], s: number, beat: number, dur: number, semis = 0, gesture: Parameters<typeof sliceMod>[2] = 'plain'): LofiNote => ({ voice, midi: 0, beat, dur, vel: 0.9, mod: sliceMod(s, semis, gesture) });

test('a slice plays its stretch of the recording, a moment early, at its pitch, until the next takes over', () => {
  const { ctx, k, lane } = kitOf();
  const note = slice('snare', 4, 1, 0.25, 3);
  const bar = barOf('jungle', 'drop', ['kick', 'snare', 'hats'], [note]);
  const spb = 60 / 168;
  BK.playSlice(k, lane as unknown as AudioNode, note, bar, 2, 0.9);
  const src = ctx.sources.at(-1)!;
  const take = breakTake(11, 'jungle', 168);
  const from = sliceStart(take, 4, 168);
  const rate = 2 ** (3 / 12);
  assert.ok(Math.abs(src.offset - (from - 0.003)) < 1e-9, `from where the slice's sound starts, 3 ms early (${src.offset} against ${from})`);
  assert.ok(Math.abs(src.startAt - (2 - 0.003 / rate)) < 1e-9, 'started early by that much at its rate');
  assert.equal(src.playbackRate.events[0]![1], rate, 'pitched up three semitones');
  assert.ok(Math.abs(src.stopAt - (2 + 0.25 * spb + 0.004)) < 1e-9, 'stops once the next has taken over');
  assert.ok(ctx.buffers.length >= 2, 'the recording, forwards and backwards');
});

test('a reversed slice plays backwards, a held one the stretch, a falling one slows to a stop', () => {
  const { ctx, k, lane } = kitOf();
  const bar = barOf('jungle', 'drop', ['kick', 'snare', 'hats']);
  BK.playSlice(k, lane as unknown as AudioNode, slice('snare', 12, 3, 1, 0, 'reverse'), bar, 1, 0.9);
  const rev = ctx.sources.at(-1)!;
  const [fwd, back] = ctx.buffers;
  assert.equal(rev.buffer, back, 'the backwards recording');
  assert.equal(back!.data[0], fwd!.data[fwd!.length - 1], 'backwards indeed');
  BK.playSlice(k, lane as unknown as AudioNode, slice('snare', 12, 3, 1, 0, 'stretch'), bar, 2, 0.9);
  const held = ctx.sources.at(-1)!;
  assert.ok(held.buffer !== fwd && held.buffer !== back && held.offset === 0, 'its own stretched buffer');
  BK.playSlice(k, lane as unknown as AudioNode, slice('snare', 12, 3, 1, 0, 'fall'), bar, 3, 0.9);
  const fall = ctx.sources.at(-1)!;
  assert.ok(fall.playbackRate.events.some(([kind, v]) => kind === 'exp' && v < 0.2), 'the rate falls away');
});

test('the break\'s filter: teased under an intro, climbing through a build, its floor at the drop, drum and bass\'s high', () => {
  const { ctx, k, lane } = kitOf();
  const notes = [slice('kick', 0, 0, 0.5)];
  BK.markChop(k, lane as unknown as AudioNode, barOf('jungle', 'intro', ['keys', 'hats'], notes), 1, 0, 4);
  const hp = ctx.filters.find(f => f.type === 'highpass')!;
  assert.equal(hp.frequency.events.at(-1)![1], 650, 'teased: the break without its kick, high-passed');
  BK.markChop(k, lane as unknown as AudioNode, barOf('jungle', 'build', ['snare', 'hats'], notes), 2, 4, 4);
  assert.ok(hp.frequency.events.at(-1)![1] > 400, 'climbing by a build\'s last bar');
  BK.markChop(k, lane as unknown as AudioNode, barOf('jungle', 'drop', ['kick', 'snare', 'hats'], notes), 3, 0, 4);
  assert.ok(hp.frequency.events.at(-1)![1] < 40, 'back to its floor at the drop');
  const other = kitOf();
  BK.markChop(other.k, other.lane as unknown as AudioNode, barOf('dnb', 'drop', ['kick', 'snare', 'hats'], notes, 174), 1, 0, 4);
  assert.ok(other.ctx.filters.find(f => f.type === 'highpass')!.frequency.events.at(-1)![1] >= 300, 'drum and bass\'s break clear of the kit\'s kick');
  assert.equal(BK.chops('rock'), false);
  assert.equal(BK.chops('jungle'), true);
});
