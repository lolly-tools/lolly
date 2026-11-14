// SPDX-License-Identifier: MPL-2.0
/**
 * The oompa band as it plays (lib/lofi-oompa.ts), checked against a fake AudioContext: each
 * line on its own player, the players a little apart in time and tuning, the air before an
 * entry and a breath in a rest, the short notes kept as takes, the band's own drums, and its
 * hall dying away with its low end last.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-oompa.test.ts
 *
 * How the instruments sound was fitted to recordings and is checked by their own tests
 * (lib/lofi-brass.test.ts, lib/lofi-reeds.test.ts); this pins how the band plays them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OOMPA_PART, OOMPA_PARTS } from '../../../../engine/src/lofi-oompa.ts';
import { composeLofiTune, type LofiBar, type LofiNote } from '../../../../engine/src/lofi-compose.ts';
import { drumKit } from './lofi-drums.ts';
import * as OB from './lofi-oompa.ts';
import type { VoiceKit } from './lofi-voices.ts';

class FakeParam { value = 1; setValueAtTime(): this { return this; } setTargetAtTime(): this { return this; } linearRampToValueAtTime(): this { return this; } exponentialRampToValueAtTime(v: number): this { assert.ok(v > 0); return this; } cancelScheduledValues(): this { return this; } }
class FakeNode { outs: unknown[] = []; connect<T>(to: T): T { this.outs.push(to); return to; } disconnect(): void { this.outs = []; } }
class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakeSource extends FakeNode {
  buffer: { length: number; getChannelData: (c: number) => Float32Array } | null = null;
  playbackRate = new FakeParam();
  at = -1;
  private readonly ctx: FakeCtx;
  constructor(ctx: FakeCtx) { super(); this.ctx = ctx; }
  start(t = 0): void { assert.ok(Number.isFinite(t) && t >= 0); this.at = t; this.ctx.started.push(this); }
  stop(): void { /* ends */ }
}
class FakeCtx {
  currentTime = 0;
  sampleRate = 8000;
  started: FakeSource[] = [];
  createGain(): FakeGain { return new FakeGain(); }
  createStereoPanner(): FakeNode & { pan: FakeParam } { return Object.assign(new FakeNode(), { pan: new FakeParam() }); }
  createBiquadFilter(): FakeNode & Record<'frequency' | 'Q' | 'gain', FakeParam> & { type: string } { return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam(), gain: new FakeParam() }); }
  createBufferSource(): FakeSource { return new FakeSource(this); }
  createOscillator(): FakeNode & { frequency: FakeParam; type: string; start(): void; stop(): void } { return Object.assign(new FakeNode(), { frequency: new FakeParam(), type: 'sine', start() { /* */ }, stop() { /* */ } }); }
  createConvolver(): FakeNode & { buffer: unknown } { return Object.assign(new FakeNode(), { buffer: null }); }
  createBuffer(channels: number, n: number): { length: number; getChannelData: (c: number) => Float32Array } {
    const data = Array.from({ length: channels }, () => new Float32Array(n));
    return { length: n, getChannelData: (c: number) => data[c]! };
  }
}
function kitOf(ctx: FakeCtx, seed = 7): VoiceKit {
  let a = seed;
  const rng = (): number => { a = (a * 1103515245 + 12345) >>> 0; return a / 4294967296; };
  return { ctx: ctx as unknown as BaseAudioContext, noise: ctx.createBuffer(1, 16000) as unknown as AudioBuffer, rng };
}
const bar = composeLofiTune(3, 'oompa').find(b => b.section === 'verse')! as LofiBar;
/** Every source a call started, with its time and how loud its buffer is. */
const peakOf = (s: FakeSource): number => { const d = s.buffer!.getChannelData(0); let p = 0; for (const v of d) p = Math.max(p, Math.abs(v)); return p; };

test('each band line plays on its own player, and a melody on a lead the band does not play is the station\'s', () => {
  for (const part of OOMPA_PARTS) {
    const ctx = new FakeCtx();
    const out = ctx.createGain() as unknown as AudioNode;
    assert.ok(OB.line(kitOf(ctx), out, bar, 1, part === 'clarinet' ? 82 : part === 'counter' ? 55 : 70, 0.6, 0.4, OOMPA_PARTS.indexOf(part) * OOMPA_PART, 'flugelhorn'), part);
    assert.ok(ctx.started.length >= 1 && ctx.started.every(s => Number.isFinite(peakOf(s)) && peakOf(s) > 0), `${part}: a sound`);
  }
  const ctx = new FakeCtx();
  assert.equal(OB.line(kitOf(ctx), ctx.createGain() as unknown as AudioNode, bar, 1, 70, 0.6, 0.4, 0, 'kalimba'), false);
  assert.equal(ctx.started.length, 0);
  assert.ok(OB.BAND_LEADS.has('flugelhorn') && OB.BAND_LEADS.has('tenorhorn'));
});

test('the after-beats\' players sit a little apart in time and in tune, and a short note is one of a few takes', () => {
  const ctx = new FakeCtx();
  const k = kitOf(ctx);
  const out = ctx.createGain() as unknown as AudioNode;
  const starts: number[][] = [[], [], []];
  const rates: number[][] = [[], [], []];
  for (let b = 0; b < 12; b++) {
    for (const [i, midi] of [55, 62, 67].entries()) {
      const n = ctx.started.length;
      OB.horns(k, out, 1234, 2 + b * 0.5, midi, 0.55, 0.14);
      const note = ctx.started.slice(n).find(s => s.playbackRate.value !== 1 || s.buffer!.length > 400)!;
      starts[i]!.push(note.at - (2 + b * 0.5));
      rates[i]!.push(1200 * Math.log2(note.playbackRate.value));
    }
  }
  const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
  // Each player's own place against the beat and own tuning, within what recorded bands show.
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(mean(starts[i]!)) < 0.03, `player ${i} sits within 30 ms of the beat (${(mean(starts[i]!) * 1000).toFixed(1)} ms)`);
    assert.ok(Math.abs(mean(rates[i]!)) < 15, `player ${i} within 15 cents (${mean(rates[i]!).toFixed(1)})`);
  }
  assert.ok(new Set(starts.map(s => Math.round(mean(s) * 10000))).size === 3, 'the three players are not together to the sample');
  // The same pah again and again plays kept takes: few buffers for many notes.
  const buffers = new Set(ctx.started.map(s => s.buffer));
  assert.ok(buffers.size < ctx.started.length * 0.6, `${buffers.size} buffers for ${ctx.started.length} sounds`);
});

test('a player who has played a while breathes in a rest, and an entry out of a rest is led by air', () => {
  const ctx = new FakeCtx();
  const k = kitOf(ctx);
  const out = ctx.createGain() as unknown as AudioNode;
  // The tuba's ooms, two a second for four seconds, then a rest of most of a second.
  for (let i = 0; i < 8; i++) OB.tuba(k, out, 99, 1 + i * 0.5, 34, 0.7, 0.3, 0);
  const before = ctx.started.length;
  OB.tuba(k, out, 99, 1 + 8 * 0.5 + 0.8, 34, 0.7, 0.3, 0);
  const after = ctx.started.slice(before);
  const note = after.reduce((a, b) => (a.buffer!.length > b.buffer!.length ? a : b));
  const lead = after.filter(s => s !== note && s.at < 5.8 && s.at > 4.3);
  assert.ok(lead.some(s => s.buffer!.length > 0.1 * ctx.sampleRate), 'a breath drawn in the rest');
  assert.ok(lead.some(s => s.at < 5.8 && s.at + s.buffer!.length / ctx.sampleRate > 5.75 && s.buffer!.length < 0.06 * ctx.sampleRate), 'air through the lips leads into the entry');
});

test('the band plays its own drums unless a kit is chosen, and every stroke sounds', () => {
  const ctx = new FakeCtx();
  const k = kitOf(ctx);
  const out = ctx.createGain() as unknown as AudioNode;
  const kit = drumKit(3, 'oompa');
  for (const note of [{ voice: 'kick' }, { voice: 'hat', mod: 0 }, { voice: 'hat', mod: 1 }, { voice: 'crash' }, { voice: 'snare' }, { voice: 'snare', dur: 1 }, { voice: 'perc', midi: 1, mod: 7 }] as Array<Partial<LofiNote>>) {
    const n = ctx.started.length;
    assert.ok(OB.drum(k, out, { beat: 0, dur: 0, midi: 0, vel: 0.7, ...note } as LofiNote, 1, 0.7, bar, kit), String(note.voice));
    assert.ok(ctx.started.length > n || note.voice === 'snare' || note.voice === 'perc', `${note.voice} starts a sound`);
  }
  assert.equal(OB.drum(k, out, { voice: 'tom', beat: 0, dur: 0, midi: 45, vel: 0.7 }, 1, 0.7, bar, kit), false);
  assert.equal(OB.bandDrums(bar, undefined), true);
  assert.equal(OB.bandDrums(bar, 'acoustic'), false);
});

test('the hall answers early, then dies away, its low octaves last', () => {
  const ctx = new FakeCtx();
  ctx.sampleRate = 16000;
  const ir = OB.hallImpulse(ctx as unknown as BaseAudioContext, 5);
  const d = ir.getChannelData(0);
  const sr = ctx.sampleRate;
  const energy = (a: number, b: number): number => { let e = 0; for (let i = Math.floor(a * sr); i < Math.min(d.length, b * sr); i++) e += d[i]! ** 2; return e; };
  assert.ok(energy(0, 0.005) < energy(0.005, 0.08) * 0.05, 'the first answers come after a few milliseconds');
  const early = energy(0.05, 0.15), late = energy(0.9, 1.0);
  assert.ok(10 * Math.log10(early / late) > 30, `a second on, the hall has fallen ${(10 * Math.log10(early / late)).toFixed(0)} dB`);
  // Low against high, late in the tail: the low end rings longer.
  let lo = 0, hi = 0, x1 = 0;
  for (let i = Math.floor(0.6 * sr); i < Math.floor(0.9 * sr); i++) { lo += ((d[i]! + x1) / 2) ** 2; hi += ((d[i]! - x1) / 2) ** 2; x1 = d[i]!; }
  assert.ok(lo > hi, 'the tail is darker than it is bright');
});
