// SPDX-License-Identifier: MPL-2.0
/**
 * Seeking a generated tune in the Neurospicy player by bar, and the moment a link names.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/neurospicy-seek.test.ts
 *
 * Node has no Web Audio, so the live station plays into a fake AudioContext whose clock
 * the test moves by hand. What is pinned:
 *  - a position snaps to the nearest bar start, and the bar playing is the last that has
 *    started;
 *  - a tune's timeline: every bar's start at its tempo, its parts, and where they change;
 *  - a seek starts the same tune again from the nearest bar, and the station reports that
 *    bar at once, before its first note sounds, so the progress bar never blinks;
 *  - a moment shared after a seek records the bar playing, and opening the link starts the
 *    same tune on that bar;
 *  - a saved tune started part way through moves on once it comes round to its top;
 *  - a track saved from the music generator seeks by its own bars, across its tunes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startLofi, stopLofi, seekLofi, lofiPosition, lofiLive, currentLofiBar, currentLofiRecipe, queueLofiSeed,
  lofiTimeline, nearestBar, barAt, lofiLinkValue, readLofiLink, rememberSavedTune, lofiId,
} from './neurospicy-lofi.ts';
import { linkTo, momentParts, readNeuroShare } from './neuro-share.ts';
import { positionWords, sectionWord } from './neuro-position.ts';
import { composeLofiTune, lofiSectionName } from '../../../../engine/src/lofi-compose.ts';
import { composeTrack, musicStateParams, DEFAULT_STATE } from './music-state.ts';

// ── a fake AudioContext: every node and parameter the station touches, doing nothing ──
class Param {
  value = 0;
  setValueAtTime(): this { return this; }
  linearRampToValueAtTime(): this { return this; }
  exponentialRampToValueAtTime(): this { return this; }
  setTargetAtTime(): this { return this; }
  cancelScheduledValues(): this { return this; }
}
class Node {
  gain = new Param(); frequency = new Param(); detune = new Param(); Q = new Param(); pan = new Param();
  playbackRate = new Param(); delayTime = new Param(); threshold = new Param(); knee = new Param();
  ratio = new Param(); attack = new Param(); release = new Param();
  type = ''; buffer: unknown = null; curve: unknown = null; oversample = 'none'; loop = false;
  connect<T>(to: T): T { return to; }
  disconnect(): void { /* nothing */ }
  start(): void { /* nothing */ }
  stop(): void { /* nothing */ }
  setPeriodicWave(): void { /* nothing */ }
}
class FakeCtx {
  currentTime = 0;
  sampleRate = 4000;
  destination = new Node();
  createGain(): Node { return new Node(); }
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

const prefs = { drums: true, texture: 0.5 };
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** Move the fake clock on and give the station's timers time to play the bars now due. */
async function advance(ctx: FakeCtx, seconds: number): Promise<void> {
  ctx.currentTime += seconds;
  await wait(120);
}
async function start(id: string): Promise<FakeCtx> {
  const ctx = new FakeCtx();
  await startLofi(ctx as unknown as AudioContext, ctx.destination as unknown as AudioNode, id, prefs);
  await wait(200);   // the first bar starts 0.1 s in
  return ctx;
}

test('a position snaps to the nearest bar start; the bar playing is the last one started', () => {
  const starts = [0, 2, 4, 6, 8];
  assert.equal(nearestBar(starts, 0), 0);
  assert.equal(nearestBar(starts, 0.9), 0);
  assert.equal(nearestBar(starts, 1), 1, 'halfway goes to the later bar');
  assert.equal(nearestBar(starts, 5.2), 3);
  assert.equal(nearestBar(starts, 99), 4, 'past the end, the last bar');
  assert.equal(nearestBar(starts, -3), 0);
  assert.equal(barAt(starts, 5.9), 2);
  assert.equal(barAt(starts, 6), 3, 'a bar has started at its own start');
  assert.equal(barAt(starts, 100), 4);
});

test('a tune\'s timeline: each bar at its tempo, its parts, and where the parts change', () => {
  const bars = composeLofiTune(1234, 'jazz');
  const line = lofiTimeline(bars, (b) => lofiSectionName('jazz', b.section));
  const bar = 240 / bars[0]!.tune.bpm;
  assert.equal(line.starts.length, bars[0]!.tune.bars, 'one start per bar, the rest bar included');
  assert.ok(Math.abs(line.starts[10]! - 10 * bar) < 1e-9);
  assert.ok(Math.abs(line.total - bars.length * bar) < 1e-9);
  assert.equal(line.sections[0], 'intro');
  assert.equal(line.sections.at(-1), 'rest');
  for (const m of line.marks) {
    const i = line.starts.indexOf(m);
    assert.ok(i > 0 && line.sections[i] !== line.sections[i - 1], `a mark at ${m} s starts a new part`);
  }
  assert.ok(line.sections.includes('chorus'), 'a band style names its drops the chorus, as the music generator does');
  const words = positionWords(line.starts[5]! + 0.4, line.total, line);
  assert.equal(words.label, `Bar 6 of ${line.starts.length} · ${sectionWord(line.sections[5]!)}`);
  assert.match(words.spoken, /^Bar 6 of \d+, [\w -]+, \d:\d\d of \d:\d\d$/);
  const last = line.starts.length;
  assert.equal(positionWords(line.starts[last - 1]!, line.total, line).label, `Bar ${last} of ${last}`, 'the rest bar names no part');
  assert.equal(sectionWord('pre-chorus'), 'Pre-chorus');
  assert.equal(sectionWord('drop'), 'Drop');
  assert.deepEqual(positionWords(65, 130, null), { spoken: '1:05 of 2:10' }, 'a recorded track: the times');
});

test('a seek starts the same tune again on the nearest bar, and says so at once', async () => {
  queueLofiSeed(424242);
  const ctx = await start(lofiId('warm'));
  try {
    assert.ok(lofiLive());
    const first = lofiPosition()!;
    assert.equal(first.bar, 0);
    const line = first.timeline;
    const target = line.starts[12]! + 0.3 * (line.starts[13]! - line.starts[12]!);   // a third of the way into bar 12
    const seeking = seekLofi(target);
    assert.equal(lofiPosition()?.bar, 12, 'the bar it lands on, before the new station has played a note');
    assert.equal(lofiPosition()?.seconds, line.starts[12], 'from the top of that bar');
    assert.equal(currentLofiBar(), 12);
    assert.equal(await seeking, 12);
    await wait(200);
    assert.equal(currentLofiRecipe()?.seed, 424242, 'the same tune');
    assert.equal(lofiPosition()?.bar, 12, 'the new station is playing bar 12');
    await advance(ctx, line.starts[14]! - line.starts[12]! + 0.05);
    assert.equal(lofiPosition()?.bar, 14, 'and plays on from there');
    assert.ok(Math.abs(lofiPosition()!.seconds - line.starts[14]!) < 0.2);
    // The nearest bar, not the one under the pointer: two thirds of the way in goes on to the next.
    await seekLofi(line.starts[3]! + 0.7 * (line.starts[4]! - line.starts[3]!));
    assert.equal(lofiPosition()?.bar, 4);
  } finally {
    stopLofi();
  }
});

test('a moment shared after a seek records the bar playing, and its link opens the same tune on that bar', async () => {
  queueLofiSeed(777001);
  await start(lofiId('sings'));
  let link = '';
  try {
    const line = lofiPosition()!.timeline;
    await seekLofi(line.starts[9]!);
    await wait(200);
    const recipe = currentLofiRecipe()!;
    const bar = currentLofiBar()!;
    assert.equal(bar, 9);
    // What the share card writes (lib/neurospicy-dock-host.ts shareOffer).
    link = linkTo('https://lolly.tools', '/', '#/', [`lofi=${lofiLinkValue(recipe)}`, ...momentParts({ bar })]);
  } finally {
    stopLofi();
  }
  assert.equal(link, 'https://lolly.tools/#/?lofi=sings.777001&ns.at=9');
  // The receiving app: read the link, queue its tune and bar, and start the station.
  const u = new URL(link);
  const tune = readLofiLink({ hash: u.hash, search: u.search })!;
  const moment = readNeuroShare({ hash: u.hash, search: u.search })!.moment;
  queueLofiSeed(tune.seed, moment.bar);
  await start(lofiId(tune.mood));
  try {
    assert.equal(currentLofiRecipe()?.seed, 777001, 'the tune the sender heard');
    assert.equal(currentLofiBar(), 9, 'from the bar the link names');
    assert.equal(lofiPosition()?.bar, 9);
  } finally {
    stopLofi();
  }
});

test('a saved tune started part way through moves on when it comes round to its top', async () => {
  rememberSavedTune('user/tune/seek-test', { mood: 'warm', seed: 515151 });
  const ctx = new FakeCtx();
  let ends = 0;
  await startLofi(ctx as unknown as AudioContext, ctx.destination as unknown as AudioNode, 'user/tune/seek-test', prefs, () => { ends++; });
  await wait(200);
  try {
    const line = lofiPosition()!.timeline;
    const last = line.starts.length - 1;
    await seekLofi(line.starts[last - 1]!);
    await wait(200);
    assert.equal(lofiPosition()?.bar, last - 1);
    assert.equal(ends, 0);
    await advance(ctx, line.total - line.starts[last - 1]! + 0.05);
    assert.equal(lofiPosition()?.bar, 0, 'round to the top');
    assert.equal(ends, 1, 'which ends the tune for a player going through the list');
  } finally {
    stopLofi();
  }
});

test('a track from the music generator seeks by its own bars, across the tunes it holds', async () => {
  const state = { ...DEFAULT_STATE, bars: 96 };
  const bars = composeTrack(state);
  const tunes = new Set(bars.map((b) => b.tune.seed));
  assert.ok(tunes.size > 1, 'the track holds more than one tune');
  rememberSavedTune('user/tune/generator-seek', { mood: state.mood, seed: state.seed, generator: musicStateParams(state) });
  await start('user/tune/generator-seek');
  try {
    const line = lofiPosition()!.timeline;
    assert.equal(line.starts.length, bars.length, 'the timeline is the whole track');
    // A bar in the second tune: its index within its tune is small, its place in the track is not.
    const second = bars.findIndex((b) => b.tune.seed !== bars[0]!.tune.seed) + 3;
    await seekLofi(line.starts[second]!);
    await wait(200);
    assert.equal(lofiPosition()?.bar, second, `bar ${second} of the track`);
    assert.equal(lofiPosition()?.seconds, line.starts[second]);
  } finally {
    stopLofi();
  }
});
