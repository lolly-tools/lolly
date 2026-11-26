// SPDX-License-Identifier: MPL-2.0
/**
 * The future-bass chord voice (lofi-future.ts), against a fake AudioContext that records
 * every node and automation call: what a chord is made of, what it shares with the other
 * chords, and how it moves. How it sounds was measured in a real browser.
 *
 * Run directly:  node --test shells/web/src/lib/lofi-future.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { future, pump } from './lofi-future.ts';
import type { KeysArt, VoiceKit } from './lofi-voices.ts';
import { gateOpens } from '../../../../engine/src/lofi-future.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';

type Ev = [kind: string, value: number, time: number];
class Param {
  value = 0;
  events: Ev[] = [];
  private add(kind: string, v: number, t: number): this {
    assert.ok(Number.isFinite(v) && Number.isFinite(t) && t >= 0, `${kind} ${v} at ${t}`);
    this.events.push([kind, v, t]);
    return this;
  }
  setValueAtTime(v: number, t: number): this { return this.add('set', v, t); }
  linearRampToValueAtTime(v: number, t: number): this { return this.add('lin', v, t); }
  exponentialRampToValueAtTime(v: number, t: number): this { assert.ok(v > 0, 'an exponential ramp to zero throws'); return this.add('exp', v, t); }
  setTargetAtTime(v: number, t: number, k: number): this { assert.ok(k > 0); return this.add('target', v, t); }
}
class Node {
  outs: unknown[] = [];
  channelCount = 2;
  channelCountMode = 'max';
  channelInterpretation = 'speakers';
  connect<T>(to: T): T { this.outs.push(to); return to; }
}
class Gain extends Node { gain = new Param(); }
class Source extends Node {
  buffer: { length: number } | null = null;
  loop = false;
  playbackRate = new Param();
  detune = new Param();
  frequency = new Param();
  started: [number, number] = [-1, 0];
  stopped = Infinity;
  start(t = 0, offset = 0): void { this.started = [t, offset]; }
  stop(t = 0): void { this.stopped = t; }
  setPeriodicWave(): void { /* a cosine */ }
}
class Ctx {
  sampleRate = 4000;
  currentTime = 0;
  gains: Gain[] = [];
  sources: Source[] = [];
  oscs: Source[] = [];
  comps = 0;
  createGain(): Gain { const g = new Gain(); this.gains.push(g); return g; }
  createBufferSource(): Source { const s = new Source(); this.sources.push(s); return s; }
  createOscillator(): Source { const s = new Source(); this.oscs.push(s); return s; }
  createBiquadFilter(): Node & Record<'frequency' | 'Q' | 'gain', Param> & { type: string } { return Object.assign(new Node(), { type: 'lowpass', frequency: new Param(), Q: new Param(), gain: new Param() }); }
  createStereoPanner(): Node & { pan: Param } { return Object.assign(new Node(), { pan: new Param() }); }
  createDelay(): Node & { delayTime: Param } { return Object.assign(new Node(), { delayTime: new Param() }); }
  createConvolver(): Node & { buffer: unknown } { return Object.assign(new Node(), { buffer: null }); }
  createWaveShaper(): Node & { curve: unknown; oversample: string } { return Object.assign(new Node(), { curve: null, oversample: 'none' }); }
  createDynamicsCompressor(): Node & Record<'threshold' | 'knee' | 'ratio' | 'attack' | 'release', Param> {
    this.comps++;
    return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() });
  }
  createPeriodicWave(): object { return {}; }
  createBuffer(channels: number, n: number): { length: number; numberOfChannels: number; getChannelData: (c: number) => Float32Array } {
    const data = Array.from({ length: channels }, () => new Float32Array(n));
    return { length: n, numberOfChannels: channels, getChannelData: (c: number) => data[c]! };
  }
}

function kit(hq = false): { k: VoiceKit; ctx: Ctx; out: AudioNode } {
  const ctx = new Ctx();
  const noise = ctx.createBuffer(1, 8000);
  const k = { ctx: ctx as unknown as BaseAudioContext, noise: noise as unknown as AudioBuffer, rng: mulberry32(1), hq };
  return { k, ctx, out: new Node() as unknown as AudioNode };
}
const HELD: KeysArt = { rate: 0, bend: false, spb: 0.42 };
const CHORD = [57, 60, 64, 67];
function play(k: VoiceKit, out: AudioNode, t: number, dur: number, art: KeysArt, midis = CHORD): void {
  for (const m of midis) future(k, out, t, m, 0.9, dur, art);
}

test('a chord note is one looping stack and a pluck, and the chord\'s lowest note carries the body', () => {
  const { k, ctx, out } = kit();
  play(k, out, 0.5, 1.2, HELD);
  const loops = ctx.sources.filter(s => s.loop);
  const plucks = ctx.sources.filter(s => !s.loop);
  assert.equal(plucks.length, 4, 'a pluck a note');
  assert.equal(loops.length, 5, 'a stack a note and one body');
  for (const s of loops) assert.ok(s.started[0] === 0.5 && s.started[1] >= 0 && s.started[1] < 1.5, 'starts at its own place in the loop');
  // Live, the first chord's notes share the one stack built so far, each at its own pitch:
  // the playback rate and the stack's centre make the note, never more than a fifth away.
  assert.ok(loops.every(s => Math.abs(12 * Math.log2(s.playbackRate.value)) < 7.6), 'within a fifth of the stack');
  // A render builds every note's own stack: within a step (1.5 semitones) of the pitch.
  const r = kit(true);
  play(r.k, r.out, 0.5, 1.2, HELD);
  assert.ok(r.ctx.sources.filter(s => s.loop).every(s => Math.abs(12 * Math.log2(s.playbackRate.value)) < 1.6), 'a render: each note on its own stack');
});

test('every chord in a station shares one chain: its compressors are made once', () => {
  const { k, ctx, out } = kit();
  for (let i = 0; i < 8; i++) play(k, out, 0.5 + i * 0.5, 0.4, HELD);
  assert.equal(ctx.comps, 3, 'three bands, once');
  const other = new Node() as unknown as AudioNode;
  play(k, other, 0.5, 0.4, HELD);
  assert.equal(ctx.comps, 6, 'another output, another chain');
});

test('the notes of one chord share its envelope and its wub; the next chord has its own', () => {
  const { k, ctx, out } = kit();
  const wub: KeysArt = { rate: 3 / 0.42, bend: false, spb: 0.42 };
  const before = ctx.oscs.length;
  play(k, out, 1, 1.5, wub);
  const lfos = ctx.oscs.slice(before).filter(o => o.frequency.events.some(e => Math.abs(e[1] - 3 / 0.42) < 1e-9));
  assert.equal(lfos.length, 1, 'one wub for the chord');
  play(k, out, 2.5, 1.5, wub);
  assert.equal(ctx.oscs.filter(o => o.frequency.events.some(e => Math.abs(e[1] - 3 / 0.42) < 1e-9)).length, 2, 'and one for the next');
});

test('a bend rises a whole tone into the pitch and a dive falls an octave as the chord ends', () => {
  const { k, ctx, out } = kit();
  play(k, out, 1, 1.6, { ...HELD, bend: true, dive: true });
  const stacks = ctx.sources.filter(s => s.loop);
  for (const s of stacks) {
    const ev = s.detune.events;
    assert.deepEqual(ev[0], ['set', -200, 1], 'starts a whole tone under');
    assert.ok(ev.some(e => e[0] === 'lin' && e[1] === 0), 'arrives at the pitch');
    const last = ev[ev.length - 1]!;
    assert.equal(last[1], -1200, 'and falls an octave');
    assert.ok(last[2] > 1 + 1.6 - 0.01, 'by the chord\'s end');
  }
});

test('a swell rises out of nothing into the next hit and stops there', () => {
  const { k, ctx, out } = kit();
  play(k, out, 2, 1.5, { ...HELD, swell: true });
  const env = ctx.gains.find(g => g.gain.events.some(e => e[0] === 'exp' && Math.abs(e[2] - (2 + 1.5 - 0.012)) < 1e-9));
  assert.ok(env, 'an envelope climbing to the hit');
  assert.ok(env.gain.events[0]![1] < env.gain.events[1]![1] / 100, 'from 40 dB under');
  assert.equal(ctx.sources.filter(s => !s.loop && s.buffer && s.buffer.length > 8000).length, 0, 'no pluck: a swell has no strike');
});

test('a gated chord opens in its pattern, on the beat it keeps', () => {
  const { k, ctx, out } = kit();
  play(k, out, 1, 1.68, { ...HELD, gate: 1 });
  const opens = gateOpens(1, 1.68 / 0.42).map(([b]) => 1 + b * 0.42);
  const env = ctx.gains.find(g => g.gain.events.filter(e => e[0] === 'target').length >= opens.length * 2);
  assert.ok(env, 'an envelope that opens and shuts');
  const rises = env.gain.events.filter((e, i, all) => e[0] === 'target' && i > 0 && e[1] > (all[i - 1]![1] ?? 0)).map(e => e[2]);
  for (const at of opens) assert.ok(rises.some(r => Math.abs(r - at) < 1e-9), `opens at ${at.toFixed(3)}`);
});

test('the kicks pump the chords\' chain, and do nothing where no chord has played', () => {
  const { k, ctx, out } = kit();
  const lonely = new Node() as unknown as AudioNode;
  pump(lonely, 1, 2);
  assert.equal(ctx.gains.length, 0, 'no chain made by a kick');
  play(k, out, 0.5, 1, HELD);
  const count = (): number => ctx.gains.reduce((n, g) => n + g.gain.events.length, 0);
  const was = count();
  pump(out, 1, 2.2);
  assert.equal(count(), was + 2, 'a dip and a recovery');
  const dip = ctx.gains.find(g => g.gain.events.length === 2 && g.gain.events[0]![0] === 'target')!;
  assert.ok(dip.gain.events[0]![1] < 0.4, `down by more than 8 dB (${dip.gain.events[0]![1]})`);
});

test('a render builds its own, denser stacks; live playing in a page builds as it goes', () => {
  const live = kit(false), render = kit(true);
  play(live.k, live.out, 0.5, 1, HELD, [60]);
  play(render.k, render.out, 0.5, 1, HELD, [60]);
  const data = (c: Ctx): Float32Array => (c.sources.find(s => s.loop)!.buffer as unknown as { getChannelData: (n: number) => Float32Array }).getChannelData(0);
  assert.notDeepEqual(data(live.ctx), data(render.ctx), 'a different stack for a render');
});

test('nothing the chords start runs on for ever: a skipped tune\'s chain falls silent and stops', () => {
  const { k, ctx, out } = kit();
  for (let i = 0; i < 6; i++) play(k, out, 0.5 + i * 2, 1.5, { rate: 2 / 0.42, bend: false, spb: 0.42 });
  for (const o of [...ctx.oscs, ...ctx.sources]) assert.ok(Number.isFinite(o.stopped), 'every oscillator and buffer has an end');
  // The chorus's swings follow on from stretch to stretch, whole cycles each, without a gap.
  const swings = ctx.oscs.filter(o => o.frequency.value === 0.29).sort((a, b) => a.started[0] - b.started[0]);
  assert.ok(swings.length >= 1);
  for (let i = 1; i < swings.length; i++) assert.ok(Math.abs(swings[i]!.started[0] - swings[i - 1]!.stopped) < 1e-9, 'each stretch starts where the last stopped');
  assert.ok(swings[swings.length - 1]!.stopped >= 0.5 + 5 * 2 + 1.5, 'and runs past the last chord');
});
