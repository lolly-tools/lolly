// SPDX-License-Identifier: MPL-2.0
/**
 * The bass stack's graph (lib/lofi-bass-stack.ts), checked against a fake AudioContext that
 * records every node and every connection.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-bass-stack.test.ts
 *
 * What is pinned:
 *  - the sub is one channel: every sine a stack plays under 100 Hz reaches the lane only
 *    through a one-channel node, so its two sides are the same signal (correlation 1);
 *  - everything the takes leave under the style's `mono` frequency is summed to one channel
 *    too, and only what is higher reaches the lane in stereo;
 *  - the doubled mids are wide: in a drop a note is two takes, high-passed at the style's
 *    crossover, one panned left and one right as far as the style's width, detuned from
 *    each other and with their filter swings out of step;
 *  - a quieter section is the sub and one take in the centre, darker;
 *  - the croak laid over a bass is high-passed and off centre, the sub dips under a kick,
 *    and the styles that keep one bass have no stack.
 * How wide and how mono the stacks measure in a render is in docs/generated-music.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as BS from './lofi-bass-stack.ts';
import type { Tone, VoiceKit } from './lofi-voices.ts';
import type { LofiBar, LofiMood, LofiSection } from '../../../../engine/src/lofi-compose.ts';

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
  channelCount = 2;
  channelCountMode = 'max';
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
  constructor() { super('osc'); }
  start(): void { /* scheduled */ }
  stop(): void { /* scheduled */ }
}
class Source extends Node { buffer: unknown = null; loop = false; constructor() { super('source'); } start(): void { /* */ } stop(): void { /* */ } }
class Ctx {
  sampleRate = 4000;
  currentTime = 0;
  oscs: Osc[] = [];
  createGain(): Gain { return new Gain(); }
  createBiquadFilter(): Filter { return new Filter(); }
  createStereoPanner(): Panner { return new Panner(); }
  createOscillator(): Osc { const o = new Osc(); this.oscs.push(o); return o; }
  createBufferSource(): Source { return new Source(); }
  createWaveShaper(): Node & { curve: unknown; oversample: string } { return Object.assign(new Node('shaper'), { curve: null, oversample: 'none' }); }
}

/** A kit on the fake context, its draws seeded. */
function kitOf(): { ctx: Ctx; k: VoiceKit; lane: Gain } {
  const ctx = new Ctx();
  let a = 7;
  const rng = (): number => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  return { ctx, k: { ctx: ctx as unknown as BaseAudioContext, noise: {} as AudioBuffer, rng }, lane: ctx.createGain() };
}
const barOf = (mood: LofiMood, section: LofiSection, index = 0): LofiBar => ({ tune: { mood, seed: 5 }, section, index } as unknown as LofiBar);

/** Every path from `from` to `to`, as the nodes along the path. */
function paths(from: Node, to: Node, seen: Node[] = []): Node[][] {
  if (from === to) return [[...seen, from]];
  if (seen.includes(from)) return [];
  return from.outs.flatMap(n => paths(n, to, [...seen, from]));
}
const mono = (n: Node): boolean => n.channelCount === 1 && n.channelCountMode === 'explicit';
const filters = (path: Node[], type: string): Filter[] => path.filter((n): n is Filter => n instanceof Filter && n.type === type);

interface Take { out: Node; t: number; midi: number; level: number; tone: Tone }
function play(mood: LofiMood, section: LofiSection): { ctx: Ctx; lane: Gain; takes: Take[] } {
  const { ctx, k, lane } = kitOf();
  const takes: Take[] = [];
  BS.bassNote(k, lane as unknown as AudioNode, barOf(mood, section), 1, 33, 0.8, 0.5, { bright: 1, drive: 1 }, (_kit, out, t, midi, level, tone) => { takes.push({ out: out as unknown as Node, t, midi, level, tone }); });
  return { ctx, lane, takes };
}

test('the sub is one channel: a stack\'s sine under 100 Hz reaches the lane only through a one-channel node', () => {
  for (const mood of ['dnb', 'dubstep', 'brostep', 'electro', 'lofiHouse', 'nudisco'] as const) {
    for (const section of ['drop', 'verse'] as const) {
      const { ctx, lane } = play(mood, section);
      const subs = ctx.oscs.filter(o => o.type === 'sine' && (o.frequency.events[0]?.[1] ?? 999) < 100);
      assert.equal(subs.length, 1, `${mood} ${section}: one sub for the note`);
      const ways = paths(subs[0]!, lane);
      assert.ok(ways.length > 0 && ways.every(p => p.some(mono)), `${mood} ${section}: the sub is summed to one channel on every way to the lane`);
    }
  }
});

test('the doubled mids are wide: in a drop, two detuned takes, high-passed above the sub, panned left and right, their swings out of step', () => {
  for (const mood of ['dnb', 'dubstep', 'brostep', 'electro', 'lofiHouse', 'nudisco'] as const) {
    const plan = BS.STACKS[mood]!;
    const { lane, takes } = play(mood, 'drop');
    assert.equal(takes.length, 2, `${mood}: two takes`);
    const [a, b] = takes as [Take, Take];
    assert.ok(Math.abs(Math.abs(b.midi - a.midi) * 100 - plan.cents) < 1e-9, `${mood}: the takes ${plan.cents} cents apart`);
    assert.ok(a.tone.sub === false && b.tone.sub === false, `${mood}: neither take plays a sub of its own`);
    assert.notEqual(a.tone.phase, b.tone.phase, `${mood}: the swings out of step`);
    assert.ok(b.t >= a.t && b.t - a.t <= plan.late, `${mood}: the second take a moment late at most`);
    const pans = takes.map(take => {
      const ways = paths(take.out, lane);
      assert.ok(ways.length > 0, `${mood}: the take reaches the lane`);
      for (const p of ways) {
        // High-passed at the crossover (or, the top's way, above 1.8 kHz); in stereo only
        // above `mono`, and summed to one channel under that frequency.
        const hp = filters(p, 'highpass');
        assert.ok(hp.some(f => f.frequency.value === plan.xover || f.frequency.value >= 1800), `${mood}: high-passed at ${plan.xover} Hz`);
        if (p.some(mono)) assert.ok(filters(p, 'lowpass').some(f => f.frequency.value === plan.mono), `${mood}: only what is under ${plan.mono} Hz goes to one channel`);
        else assert.ok(hp.some(f => f.frequency.value === plan.mono), `${mood}: in stereo only above ${plan.mono} Hz`);
      }
      const panner = ways[0]!.find((n): n is Panner => n instanceof Panner);
      return panner?.pan.value ?? 0;
    });
    assert.ok(Math.abs(pans[0]! + plan.width) < 1e-9 && Math.abs(pans[1]! - plan.width) < 1e-9, `${mood}: panned to ±${plan.width} (${pans.join(', ')})`);
  }
});

test('a quieter section is the sub and one darker take in the centre', () => {
  for (const section of ['verse', 'intro'] as const) {
    const { lane, takes } = play('dubstep', section);
    assert.equal(takes.length, 1, `${section}: one take`);
    const take = takes[0]!;
    assert.equal(take.tone.bright, 0.75, `${section}: darker`);
    assert.ok(paths(take.out, lane).every(p => !p.some(n => n instanceof Panner)), `${section}: in the centre`);
  }
});

test('the croak laid over a bass sits above the bass, off centre: on a side of the stack, or high-passed and panned where there is none', () => {
  const tone: Tone = { bright: 1, drive: 1 };
  const note = { voice: 'layer' as const, beat: 3, dur: 0.25, midi: 52, vel: 0.66, mod: 3 + 16 };
  for (const [mood, index] of [['sugar', 0], ['dubstep', 0], ['dubstep', 1]] as const) {
    const { k, lane } = kitOf();
    const seen: Array<{ out: Node; how: number; tone: Tone }> = [];
    BS.overNote(k, lane as unknown as AudioNode, barOf(mood, 'drop', index), note, tone, (out, _level, how, t) => { seen.push({ out: out as unknown as Node, how, tone: t }); });
    assert.equal(seen.length, 1);
    assert.equal(seen[0]!.how, 2, `${mood}: played as the note says (slid into)`);
    assert.equal(seen[0]!.tone.sub, false, `${mood}: no weight of its own`);
    const way = paths(seen[0]!.out, lane).find(p => p.some(n => n instanceof Panner))!;
    assert.ok(way, `${mood}: off centre`);
    const pan = way.find((n): n is Panner => n instanceof Panner)!.pan.value;
    if (mood === 'sugar') assert.ok(pan > 0 && filters(way, 'highpass').some(f => f.frequency.value >= 150), 'sugar: high-passed and panned');
    else assert.ok(index === 0 ? pan < 0 : pan > 0, `dubstep bar ${index}: the calls answer from alternate sides`);
  }
});

test('the sub dips under a kick and comes back', () => {
  const { k, lane } = kitOf();
  BS.bassNote(k, lane as unknown as AudioNode, barOf('dnb', 'drop'), 1, 33, 0.8, 0.5, { bright: 1, drive: 1 }, () => { /* the takes */ });
  BS.duck(lane as unknown as AudioNode, 2, 1.2);
  // The sub's way to the lane passes its duck: a gain whose level falls and returns to 1.
  const ducks: Gain[] = [];
  const walk = (n: Node, seen = new Set<Node>()): void => { if (seen.has(n)) return; seen.add(n); if (n instanceof Gain && n.gain.events.some(e => e[0] === 'target' && e[1] < 0.6) && n.gain.events.at(-1)?.[1] === 1) ducks.push(n); for (const o of n.outs) walk(o, seen); };
  for (const o of (k.ctx as unknown as Ctx).oscs) walk(o);
  assert.equal(ducks.length, 1, 'one duck on the sub');
});

test('the styles that keep one bass have no stack', () => {
  for (const mood of ['acid', 'synthwave', 'sherbert', 'sugar', 'rock', 'warm'] as const) assert.equal(BS.stacked(mood), false, mood);
  for (const mood of ['dnb', 'dubstep', 'brostep', 'electro', 'lofiHouse', 'nudisco'] as const) assert.equal(BS.stacked(mood), true, mood);
});
