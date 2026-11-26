// SPDX-License-Identifier: MPL-2.0
/**
 * The club genres' instruments, checked against a fake AudioContext: the break's sped-up
 * kit and its filters (lib/lofi-breaks.ts), the house organ (lib/lofi-organ.ts) and the
 * warp bass (lib/lofi-garage.ts).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-club.test.ts
 *
 * What is pinned:
 *  - a break plays the real kit faster, as a sampled break sped up to the tune's tempo is,
 *    never past seven semitones, and a pitched slice faster or slower again;
 *  - the break's high-pass climbs through a build and falls back to its floor at the drop,
 *    and drum and bass's top loop is high-passed well clear of the kick;
 *  - the house organ speaks with a pop and settles under half its attack, two voices a few
 *    cents apart, one each side;
 *  - the warp bass swings its filter at the beat's rate, a second take out of step, and
 *    slides up into a note from a fourth below.
 * How they sound against recordings is in docs/generated-music.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as BR from './lofi-breaks.ts';
import { houseOrgan } from './lofi-organ.ts';
import * as GA from './lofi-garage.ts';
import type { VoiceKit } from './lofi-voices.ts';
import type { LofiBar, LofiMood, LofiNote, LofiSection } from '../../../../engine/src/lofi-compose.ts';

type Ev = [kind: string, value: number, time: number];
class Param {
  value = 0;
  events: Ev[] = [];
  setValueAtTime(v: number, t: number): this { this.events.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v: number, t: number): this { this.events.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v: number, t: number): this { assert.ok(v > 0); this.events.push(['exp', v, t]); return this; }
  setTargetAtTime(v: number, t: number): this { this.events.push(['target', v, t]); return this; }
}
class Node {
  outs: Node[] = [];
  readonly kind: string;
  constructor(kind: string) { this.kind = kind; }
  connect<T>(to: T): T { this.outs.push(to as unknown as Node); return to; }
}
class Gain extends Node { gain = new Param(); constructor() { super('gain'); } }
class Filter extends Node { type = 'lowpass'; frequency = new Param(); Q = new Param(); gain = new Param(); constructor() { super('filter'); } }
class Panner extends Node { pan = new Param(); constructor() { super('panner'); } }
class Osc extends Node {
  type = 'sine';
  frequency = new Param();
  detune = new Param();
  wave: unknown = null;
  started = 0;
  constructor() { super('osc'); }
  setPeriodicWave(w: unknown): void { this.wave = w; }
  start(t = 0): void { this.started = t; }
  stop(): void { /* scheduled */ }
}
class Source extends Node { buffer: unknown = null; loop = false; playbackRate = new Param(); constructor() { super('source'); } start(): void { /* */ } stop(): void { /* */ } }
class Ctx {
  sampleRate = 8000;
  currentTime = 0;
  oscs: Osc[] = [];
  sources: Source[] = [];
  filters: Filter[] = [];
  createGain(): Gain { return new Gain(); }
  createBiquadFilter(): Filter { const f = new Filter(); this.filters.push(f); return f; }
  createStereoPanner(): Panner { return new Panner(); }
  createOscillator(): Osc { const o = new Osc(); this.oscs.push(o); return o; }
  createBufferSource(): Source { const s = new Source(); this.sources.push(s); return s; }
  createWaveShaper(): Node & { curve: unknown; oversample: string } { return Object.assign(new Node('shaper'), { curve: null, oversample: 'none' }); }
  createPeriodicWave(): object { return {}; }
  createBuffer(_c: number, n: number): { getChannelData: () => Float32Array; length: number } { const d = new Float32Array(n); return { getChannelData: () => d, length: n }; }
}
function kitOf(): { ctx: Ctx; k: VoiceKit; lane: Gain } {
  const ctx = new Ctx();
  let a = 7;
  const rng = (): number => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  return { ctx, k: { ctx: ctx as unknown as BaseAudioContext, noise: {} as AudioBuffer, rng, hq: true }, lane: ctx.createGain() };
}
const barOf = (mood: LofiMood, section: LofiSection, bpm = 132): LofiBar => ({
  tune: { mood, seed: 9, bpm, style: { kick: 56, kickLen: 0.3, snareTone: 2000, hatTone: 9000 } }, section, index: 0,
} as unknown as LofiBar);
const note = (voice: LofiNote['voice'], semis = 0): LofiNote => ({ voice, beat: 0, dur: 0, midi: 0, vel: 0.8, mod: 96 + semis });

test('a break plays the real kit sped up to the tune\'s tempo, never past seven semitones, and a pitched slice faster again', () => {
  for (const bpm of [126, 132, 138]) {
    const kit = BR.breakKit(barOf('breakbeat', 'drop', bpm).tune);
    assert.ok(kit.real && kit.realCymbals, 'the acoustic kit');
    assert.ok(kit.rate! > 1.1 && kit.rate! <= 2 ** (7 / 12) + 1e-9, `${bpm} bpm: played ${kit.rate!.toFixed(3)} times as fast`);
  }
  const { ctx, k, lane } = kitOf();
  const bar = barOf('breakbeat', 'drop');
  BR.playBreak(k, lane as unknown as AudioNode, note('snare'), bar, 1, 0.8);
  BR.playBreak(k, lane as unknown as AudioNode, note('snare', 7), bar, 1.5, 0.8);
  const [plain, up] = ctx.sources.filter(s => s.buffer).map(s => s.playbackRate.value);
  const rate = BR.breakKit(bar.tune).rate!;
  assert.ok(Math.abs(plain! / rate - 1) < 0.01, `the slice at the kit's speed (${plain})`);
  assert.ok(Math.abs(up! / plain! - 2 ** (7 / 12)) < 0.02, `a slice pitched up a fifth (${(up! / plain!).toFixed(3)})`);
});

test('the break\'s high-pass climbs through a build, falls back at the drop, and keeps drum and bass\'s top loop clear of the kick', () => {
  const { ctx, k, lane } = kitOf();
  const out = lane as unknown as AudioNode;
  BR.markBreak(k, out, barOf('breakbeat', 'build'), 1, 4, 8);
  BR.markBreak(k, out, barOf('breakbeat', 'build'), 2, 8, 8);
  BR.markBreak(k, out, barOf('breakbeat', 'drop'), 3, 0, 8);
  const hp = ctx.filters.find(f => f.type === 'highpass')!;
  const [half, top, drop] = hp.frequency.events.map(e => e[1]);
  assert.ok(half! > 100 && top! > half! && top! >= 650, `the build climbs (${half!.toFixed(0)}, then ${top!.toFixed(0)} Hz)`);
  assert.ok(drop! < 50, `the drop opens the low end again (${drop} Hz)`);
  const other = kitOf();
  BR.playBreak(other.k, other.lane as unknown as AudioNode, note('hat'), barOf('dnb', 'drop', 174), 1, 0.5);
  const loop = other.ctx.filters.find(f => f.type === 'highpass')!;
  assert.ok(loop.frequency.value >= 300, `the top loop's high-pass (${loop.frequency.value} Hz)`);
});

test('the house organ speaks with a pop and settles under half its attack, two voices a few cents apart, one each side', () => {
  const { ctx, k, lane } = kitOf();
  houseOrgan(k, lane as unknown as AudioNode, 1, 60, 0.8, 0.5);
  const voices = ctx.oscs.filter(o => o.wave);
  assert.equal(voices.length, 2, 'two voices');
  const cents = voices.map(o => o.detune.value);
  assert.ok(Math.abs(cents[0]! - cents[1]!) >= 6 && Math.abs(cents[0]! - cents[1]!) <= 14, `a few cents apart (${cents.map(c => c.toFixed(1)).join(', ')})`);
  const pops = ctx.oscs.filter(o => !o.wave && Math.abs(o.frequency.events[0]![1] - 261.63 * 3) < 1);
  assert.equal(pops.length, 1, 'the pop on the third harmonic');
  // Each voice's envelope: up to its peak, then settling under half of that peak.
  const pans = new Set<number>();
  for (const v of voices) {
    const amp = (v.outs[0] as Filter).outs[0] as Gain;
    const [, peak, settle] = amp.gain.events;
    assert.equal(peak![0], 'exp');
    assert.ok(settle![0] === 'target' && settle![1] / peak![1] < 0.5, `settles to ${(settle![1] / peak![1]).toFixed(2)} of the attack`);
    pans.add(((amp.outs[0] as Filter).outs[0] as Panner).pan.value);
  }
  assert.deepEqual([...pans].sort(), [-0.45, 0.45], 'one each side');
});

test('the warp bass swings its filter at the beat\'s rate, a second take out of step, and slides up into a note', () => {
  const spb = 60 / 132;
  const first = kitOf();
  GA.bass(first.k, first.lane as unknown as AudioNode, 2, 33, 0.8, 1.5, 3, spb, { bright: 1, drive: 1.5, phase: 0, take: 0 });
  const lfo = first.ctx.oscs.find(o => o.frequency.events[0]![1] < 20)!;
  assert.ok(Math.abs(lfo.frequency.events[0]![1] - 3 / spb) < 1e-9, 'three swings a beat');
  assert.ok(lfo.outs[0]!.outs.includes(first.ctx.filters.find(f => f.Q.value === 6)!.frequency as unknown as Node), 'moving the resonant filter');
  const second = kitOf();
  GA.bass(second.k, second.lane as unknown as AudioNode, 2, 33, 0.8, 1.5, 3, spb, { bright: 1, drive: 1.5, phase: 0.4, take: 1, sub: false });
  const lfo2 = second.ctx.oscs.find(o => o.frequency.events[0]![1] < 20)!;
  assert.ok(lfo2.started < lfo.started, 'the second take\'s swing starts part of a cycle on');
  assert.ok(!second.ctx.oscs.some(o => o.type === 'sine' && o.frequency.events[0]![1] > 20), 'a stack\'s take leaves the sine to the sub');
  const slid = kitOf();
  GA.bass(slid.k, slid.lane as unknown as AudioNode, 2, 33, 0.8, 0.3, 10, spb, { bright: 1, drive: 1 });
  const saw = slid.ctx.oscs.find(o => o.type === 'sawtooth')!;
  const from = saw.frequency.events.find(e => e[0] === 'set' && e[1] < 50)!;
  assert.ok(Math.abs(from[1] / 55 - 2 ** (-5 / 12)) < 0.01, `slides up from a fourth below (${from[1].toFixed(1)} Hz)`);
});
