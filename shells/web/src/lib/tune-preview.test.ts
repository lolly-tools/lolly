// SPDX-License-Identifier: MPL-2.0
/**
 * A saved tune in the asset preview: played live, the way the Neurospicy player plays a tune.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/tune-preview.test.ts
 *
 * Node has no Web Audio and no media element, so the preview plays into a fake
 * AudioContext and a fake `<audio>`. What is pinned:
 *  - the plan's bars are the tune's (the same timeline the Neurospicy player seeks on);
 *  - the station's output reaches both the element (a MediaStream) and an analyser, and
 *    `tap()` hands that analyser to the meter and the visualiser;
 *  - a seek before play chooses where play starts, and a seek while playing starts the
 *    tune again from the nearest bar, reported at once;
 *  - a pause holds the tune (the context is suspended), and dispose closes the context.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachTunePreview, tunePlan } from './tune-preview.ts';
import { lofiTuneBytes } from './lofi-tune.ts';
import { tuneTimeline } from './neurospicy-lofi.ts';
import * as compose from '../../../../engine/src/lofi-compose.ts';

class Param {
  value = 0;
  setValueAtTime(): this { return this; }
  linearRampToValueAtTime(): this { return this; }
  exponentialRampToValueAtTime(): this { return this; }
  setTargetAtTime(): this { return this; }
  cancelScheduledValues(): this { return this; }
}
class Node {
  outs: unknown[] = [];
  gain = new Param(); frequency = new Param(); detune = new Param(); Q = new Param(); pan = new Param();
  playbackRate = new Param(); delayTime = new Param(); threshold = new Param(); knee = new Param();
  ratio = new Param(); attack = new Param(); release = new Param();
  type = ''; buffer: unknown = null; curve: unknown = null; oversample = 'none'; loop = false;
  fftSize = 2048; smoothingTimeConstant = 0.8; stream = { id: 'stream' };
  connect<T>(to: T): T { this.outs.push(to); return to; }
  disconnect(): void { this.outs = []; }
  start(): void { /* nothing */ }
  stop(): void { /* nothing */ }
  setPeriodicWave(): void { /* nothing */ }
}
const made: FakeCtx[] = [];
class FakeCtx {
  currentTime = 0;
  sampleRate = 4000;
  state: 'running' | 'suspended' | 'closed' = 'running';
  destination = new Node();
  gains: Node[] = [];
  analysers: Node[] = [];
  streams: Node[] = [];
  constructor() { made.push(this); }
  async suspend(): Promise<void> { this.state = 'suspended'; }
  async resume(): Promise<void> { this.state = 'running'; }
  async close(): Promise<void> { this.state = 'closed'; }
  createGain(): Node { const n = new Node(); this.gains.push(n); return n; }
  createAnalyser(): Node { const n = new Node(); this.analysers.push(n); return n; }
  createMediaStreamDestination(): Node { const n = new Node(); this.streams.push(n); return n; }
  createOscillator(): Node { return new Node(); }
  createBiquadFilter(): Node { return new Node(); }
  createStereoPanner(): Node { return new Node(); }
  createBufferSource(): Node { return new Node(); }
  createDelay(): Node { return new Node(); }
  createConvolver(): Node { return new Node(); }
  createWaveShaper(): Node { return new Node(); }
  createDynamicsCompressor(): Node { return new Node(); }
  createPeriodicWave(): object { return {}; }
  createBuffer(channels: number, n: number): { getChannelData: (c: number) => Float32Array; length: number } {
    const data = Array.from({ length: channels }, () => new Float32Array(n));
    return { getChannelData: (c: number) => data[c]!, length: n };
  }
}
(globalThis as { AudioContext?: unknown }).AudioContext = FakeCtx;

/** The parts of an `<audio>` element the preview uses. */
class FakeAudio extends EventTarget {
  paused = true;
  srcObject: unknown = null;
  async play(): Promise<void> { this.paused = false; this.dispatchEvent(new Event('play')); }
  pause(): void { this.paused = true; this.dispatchEvent(new Event('pause')); }
  load(): void { /* nothing */ }
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 100 && !ok(); i++) await wait(20);
  assert.ok(ok(), what);
}
const recipe = { mood: 'warm' as const, seed: 6060 };
const url = `data:application/json,${encodeURIComponent(new TextDecoder().decode(lofiTuneBytes(recipe)))}`;
const line = tuneTimeline(compose, recipe.mood, recipe.seed);

test('a tune\'s plan holds its bars, its settings from any bar, and where it is over', async () => {
  const plan = await tunePlan(recipe);
  assert.deepEqual(plan.line.starts, line.starts, 'the same bars the Neurospicy player seeks on');
  assert.equal(plan.settings(0).startBar, undefined);
  assert.equal(plan.settings(9).startBar, 9);
  assert.equal(plan.end, line.total, 'a station tune ends on its rest bar');
  assert.equal(plan.byPlace, false);
});

test('a saved tune plays live into the element and an analyser, and seeks by bar', async () => {
  const audio = new FakeAudio();
  let failed = false;
  const preview = attachTunePreview(audio as unknown as HTMLAudioElement, url, () => { failed = true; });
  try {
    await until(() => preview.source.position() !== null, 'the recipe loads');
    assert.deepEqual(preview.source.grid?.()?.points, line.starts);
    assert.equal(preview.tap(), null, 'nothing to read before it plays');
    // A seek before play chooses where play starts.
    preview.source.seek(line.starts[5]! + 0.2);
    assert.deepEqual(preview.source.position(), { seconds: line.starts[5], duration: line.total });

    await audio.play();
    await until(() => preview.tap() !== null, 'playing builds the graph');
    const ctx = made.at(-1)!;
    const tap = preview.tap()!;
    assert.equal(tap.context, ctx as unknown as BaseAudioContext);
    assert.equal((tap.analyser as unknown as Node).fftSize, 128, 'the meter\'s own bar resolution');
    const out = ctx.gains.find((g) => g.outs.includes(tap.analyser) && g.outs.includes(ctx.streams[0]));
    assert.ok(out, 'one gain feeds both the analyser and the stream the element plays');
    assert.equal(audio.srcObject, ctx.streams[0]!.stream);
    assert.equal(preview.source.position()?.seconds, line.starts[5], 'from the bar chosen before play');
    await wait(200);
    assert.ok(Math.abs(preview.source.position()!.seconds - line.starts[5]!) < 0.01, 'and the station is playing bar 5');

    // A seek while playing starts again from the nearest bar, reported at once.
    preview.source.seek(line.starts[12]! + 0.4 * (line.starts[13]! - line.starts[12]!));
    assert.equal(preview.source.position()?.seconds, line.starts[12]);
    assert.match(preview.source.describe?.(line.starts[12]!)?.label ?? '', /^Bar 13 of \d+/);

    audio.pause();
    assert.equal(ctx.state, 'suspended', 'a pause holds the tune where it is');
    assert.equal(failed, false);
  } finally {
    preview.dispose();
  }
  assert.equal(made.at(-1)!.state, 'closed');
  assert.equal(audio.srcObject, null);
});
