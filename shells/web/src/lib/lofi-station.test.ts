// SPDX-License-Identifier: MPL-2.0
/**
 * The Lofi station's audio graph, checked against a fake AudioContext.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-station.test.ts
 *
 * Node has no Web Audio, so a fake context records every node and every automation
 * call. What is pinned:
 *  - every mood, and every instrument, kit and groove a tune can draw, schedules only
 *    finite values at finite, non-negative times, and never an exponential ramp to zero
 *    or below (a browser throws on that, and the voice would go silent);
 *  - the drums switch takes the kit out (no kick oscillator, fewer noise bursts) and
 *    leaves the music;
 *  - skipping fades out what the old tune left ringing rather than cutting it;
 *  - the same seed and settings schedule the same notes (an offline render repeats).
 *
 * The sound itself (levels, the visualizer's bands, how it feels) was tuned by
 * measurement in a real browser and by ear; none of that can be checked here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LofiStation } from './lofi-station.ts';
import type { LofiSettings } from './lofi-station.ts';
import { STACKS } from './lofi-bass-stack.ts';
import {
  LOFI_MOODS, LOFI_KEYS, LOFI_LEADS, LOFI_BASSES, LOFI_SNARES, LOFI_HATS, LOFI_GROOVES,
} from '../../../../engine/src/lofi-compose.ts';

type Ev = [kind: string, value: number, time: number];

class FakeParam {
  value = 0;
  events: Ev[] = [];
  readonly owner: string;
  constructor(owner: string) { this.owner = owner; }
  /** Value curves' spans: a browser throws on any other event inside one, [start, start + duration). */
  private curves: Array<[number, number]> = [];
  private add(kind: string, v: number, t: number): this {
    assert.ok(Number.isFinite(v), `${this.owner}: ${kind} to ${v}`);
    assert.ok(Number.isFinite(t) && t >= 0, `${this.owner}: ${kind} at time ${t}`);
    assert.ok(!this.curves.some(([a, d]) => t >= a && t < a + d), `${this.owner}: ${kind} at ${t} inside a value curve, which throws in a browser`);
    this.events.push([kind, v, t]);
    return this;
  }
  setValueCurveAtTime(values: ArrayLike<number>, t: number, duration: number): this {
    assert.ok(values.length >= 2 && Array.from(values).every(Number.isFinite), `${this.owner}: a curve of sound values`);
    assert.ok(Number.isFinite(duration) && duration > 0, `${this.owner}: a curve lasting ${duration}`);
    assert.ok(!this.events.some(([, , at]) => at >= t && at < t + duration), `${this.owner}: a curve at ${t} over another event, which throws in a browser`);
    this.add('curve', values[values.length - 1]!, t);
    this.curves.push([t, duration]);
    return this;
  }
  setValueAtTime(v: number, t: number): this { return this.add('set', v, t); }
  linearRampToValueAtTime(v: number, t: number): this { return this.add('lin', v, t); }
  exponentialRampToValueAtTime(v: number, t: number): this {
    assert.ok(v > 0, `${this.owner}: an exponential ramp to ${v} throws in a browser`);
    return this.add('exp', v, t);
  }
  setTargetAtTime(v: number, t: number, k: number): this {
    assert.ok(Number.isFinite(k) && k > 0, `${this.owner}: a time constant of ${k}`);
    return this.add('target', v, t);
  }
  cancelScheduledValues(): this { return this; }
}

class FakeNode {
  outs: unknown[] = [];
  connect<T>(to: T): T { this.outs.push(to); return to; }
  disconnect(): void { this.outs = []; }
}
class FakeGain extends FakeNode { gain = new FakeParam('gain'); }
class FakeOsc extends FakeNode {
  type = 'sine';
  frequency = new FakeParam('osc.frequency');
  detune = new FakeParam('osc.detune');
  setPeriodicWave(): void { /* the record's eccentric pull */ }
  start(t = 0): void { assert.ok(Number.isFinite(t)); }
  stop(t = 0): void { assert.ok(Number.isFinite(t)); }
}
class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam('filter.frequency');
  Q = new FakeParam('filter.Q');
  gain = new FakeParam('filter.gain');
}
class FakePanner extends FakeNode { pan = new FakeParam('panner.pan'); }
class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  playbackRate = new FakeParam('source.playbackRate');
  detune = new FakeParam('source.detune');
  start(t = 0, offset = 0): void { assert.ok(Number.isFinite(t) && Number.isFinite(offset)); }
  stop(): void { /* ends */ }
}
class FakeCtx {
  currentTime = 0;
  sampleRate = 4000;   // small, so the station's seeded buffers are cheap to fill
  destination = new FakeNode();
  oscs: FakeOsc[] = [];
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  createGain(): FakeGain { const n = new FakeGain(); this.gains.push(n); return n; }
  createOscillator(): FakeOsc { const n = new FakeOsc(); this.oscs.push(n); return n; }
  createBiquadFilter(): FakeFilter { return new FakeFilter(); }
  createStereoPanner(): FakePanner { return new FakePanner(); }
  createBufferSource(): FakeSource { const n = new FakeSource(); this.sources.push(n); return n; }
  createBuffer(channels: number, n: number): { getChannelData: (c: number) => Float32Array; length: number } {
    const data = Array.from({ length: channels }, () => new Float32Array(n));
    return { getChannelData: (c: number) => data[c]!, length: n };
  }
  createDelay(): FakeNode & { delayTime: FakeParam } { return Object.assign(new FakeNode(), { delayTime: new FakeParam('delayTime') }); }
  createConvolver(): FakeNode & { buffer: unknown } { return Object.assign(new FakeNode(), { buffer: null }); }
  createWaveShaper(): FakeNode & { curve: unknown; oversample: string } { return Object.assign(new FakeNode(), { curve: null, oversample: 'none' }); }
  createDynamicsCompressor(): FakeNode & Record<'threshold' | 'knee' | 'ratio' | 'attack' | 'release', FakeParam> {
    return Object.assign(new FakeNode(), {
      threshold: new FakeParam('threshold'), knee: new FakeParam('knee'), ratio: new FakeParam('ratio'),
      attack: new FakeParam('attack'), release: new FakeParam('release'),
    });
  }
  createPeriodicWave(): object { return {}; }
}

function play(seed: number, settings: LofiSettings, seconds = 40): FakeCtx {
  const ctx = new FakeCtx();
  const station = new LofiStation(ctx as unknown as BaseAudioContext, ctx.destination as unknown as AudioNode, seed, settings);
  station.scheduleAll(seconds);
  return ctx;
}
const base: LofiSettings = { mood: 'warm', drums: true, texture: 0.5 };

test('every mood, instrument, kit and groove schedules only sound values', () => {
  for (const mood of LOFI_MOODS) play(11, { ...base, mood });
  for (const keys of LOFI_KEYS) play(12, { ...base, style: { keys } });
  for (const lead of LOFI_LEADS) play(13, { ...base, style: { lead } });
  for (const bass of LOFI_BASSES) play(14, { ...base, style: { bass } });
  for (const snare of LOFI_SNARES) play(15, { ...base, style: { snare } });
  for (const hats of LOFI_HATS) play(16, { ...base, style: { hats } });
  for (const groove of LOFI_GROOVES) play(17, { ...base, style: { groove } });
  for (const texture of [0, 1]) play(18, { ...base, texture, style: { crunch: true } });
});

test('lofi house plays its deep-house bass: a saw on each take of a note and a sine under the first, each settling into its pitch', () => {
  const ctx = play(61, { ...base, mood: 'lofiHouse' }, 90);
  // A bass note starts 1.2 per cent sharp and settles on its pitch, a bass's register (under 140 Hz).
  const settling = (type: string) => ctx.oscs.filter(o => o.type === type && o.frequency.events.length >= 2
    && o.frequency.events[1]![0] === 'exp' && o.frequency.events[1]![1] < 140 && Math.abs(o.frequency.events[0]![1] / o.frequency.events[1]![1] - 1.012) < 1e-6).length;
  assert.ok(settling('sine') > 20, `sines under the bass notes (${settling('sine')})`);
  // A drop's note is two takes (lib/lofi-bass-stack.ts), the second without the sine; a quieter section's is one.
  const saws = settling('sawtooth');
  assert.ok(saws > settling('sine') && saws <= 2 * settling('sine'), `a saw on every take (${saws} saws, ${settling('sine')} sines)`);
});

test('lofi house seats its bass 7.5 dB up: the same deep bass plays that much louder there than in another style', () => {
  // A deep bass note's level: a ramp from silence to its peak, then settling to 0.82 of the peak.
  const peaks = (mood: LofiSettings['mood']): number[] => play(62, { ...base, mood, style: { bass: 'deep' } }, 120).gains
    .filter(g => g.gain.events.length >= 4 && g.gain.events[1]![0] === 'exp' && g.gain.events[2]![0] === 'target'
      && Math.abs(g.gain.events[2]![1] - g.gain.events[1]![1] * 0.82) < 1e-9)
    .map(g => g.gain.events[1]![1]);
  const house = peaks('lofiHouse');
  const disco = peaks('nudisco');
  assert.ok(house.length > 20 && disco.length > 20, `bass notes in both (${house.length}, ${disco.length})`);
  // The most common level is the same note in both: an offbeat at full level (velocity 0.8).
  const usual = (xs: number[]): number => {
    const count = new Map<number, number>();
    for (const x of xs) count.set(Math.round(x * 1e6), (count.get(Math.round(x * 1e6)) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0] / 1e6;
  };
  // Both styles stack their bass (lib/lofi-bass-stack.ts), each at its own take level, so
  // the seat is what is left once the two stacks' take levels are taken out.
  const stacks = 20 * Math.log10(STACKS.lofiHouse!.take / STACKS.nudisco!.take);
  const db = 20 * Math.log10(usual(house) / usual(disco)) - stacks;
  assert.ok(Math.abs(db - 7.5) < 0.01, `the usual note is ${db.toFixed(2)} dB up`);
});

test('the drums switch takes the kit out and leaves the music', () => {
  const style = { kick: 50, hats: 'hat' as const, snare: 'snare' as const };
  const on = play(21, { ...base, style }, 60);
  const off = play(21, { ...base, drums: false, style }, 60);
  // Every kind of kick in the kits (lib/lofi-drums.ts) settles on its tuning: 50 Hz, or a
  // feathered kick's a little below, or metal's click a little above.
  const kicks = (c: FakeCtx): number => c.oscs.filter(o => o.frequency.events.some(e => [50, 50 * 0.92, 50 * 1.15].includes(e[1] as number))).length;
  assert.ok(kicks(on) > 0, 'kicks with the drums on');
  assert.equal(kicks(off), 0, 'none with them off');
  assert.ok(off.sources.length < on.sources.length, 'and fewer noise bursts (snare, hats)');
  assert.ok(off.oscs.length > 20, 'the music still plays');
});

test('skipping fades out what the old tune left ringing', () => {
  const ctx = new FakeCtx();
  const station = new LofiStation(ctx as unknown as BaseAudioContext, ctx.destination as unknown as AudioNode, 31, base);
  station.scheduleAll(10);
  const before = ctx.gains.length;
  station.skip(32);
  const faded = ctx.gains.slice(0, before).filter(g => g.gain.events.some(([kind, v]) => kind === 'target' && v === 0));
  assert.ok(faded.length >= 4, 'the old tune\'s four lanes fade to silence');
});

test('the same seed and settings schedule the same notes', () => {
  const freqs = (c: FakeCtx): number[] => c.oscs.map(o => o.frequency.events[0]?.[1] ?? 0);
  assert.deepEqual(freqs(play(41, base, 20)), freqs(play(41, base, 20)));
  assert.notDeepEqual(freqs(play(41, base, 20)), freqs(play(42, base, 20)));
});

test('playing live announces every bar from the very first, which is how the dock learns the tune', async () => {
  const ctx = new FakeCtx();
  const station = new LofiStation(ctx as unknown as BaseAudioContext, ctx.destination as unknown as AudioNode, 51, base);
  const heard: number[] = [];
  station.onBar = (bar) => heard.push(bar.index);
  station.start();
  await new Promise((r) => setTimeout(r, 300));   // the first bar starts 0.1 s in, on the fake clock that never moves
  station.stop();
  assert.equal(heard[0], 0, 'bar 0 is announced');
  assert.equal(station.current?.index, 0);
  assert.equal(station.current?.tune.seed, 51);
});
