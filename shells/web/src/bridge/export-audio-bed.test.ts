// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the music bed's in-point (opts.audio.start) - the clamp and the
 * loop-window wiring in export.ts's connectMusic. The real Web Audio graph runs only
 * in a browser, so the context is faked down to the three calls connectMusic makes;
 * what's pinned is the scheduling (start offset, loopStart/loopEnd), which is where a
 * looping bed silently throws its in-point away.
 *
 * Run directly:  node --test shells/web/src/bridge/export-audio-bed.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bedStartOffset, connectMusic } from './export.ts';

interface FakeSource {
  buffer: unknown; loop: boolean; loopStart: number; loopEnd: number;
  started: [number, number?][]; connect(n: unknown): unknown; start(when: number, offset?: number): void; stop(): void;
}

function fakeCtx(): { ctx: unknown; src: FakeSource } {
  const gain = { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect: (n: unknown) => n };
  const src: FakeSource = {
    buffer: null, loop: false, loopStart: 0, loopEnd: 0, started: [],
    connect: (n: unknown) => n,
    start(when, offset) { this.started.push([when, offset]); },
    stop() {},
  };
  const ctx = { currentTime: 0, createBufferSource: () => src, createGain: () => gain };
  return { ctx, src };
}

const buffer = (duration: number) => ({ duration } as AudioBuffer);

test('bedStartOffset: honours an in-point inside the track, ignores junk', () => {
  assert.equal(bedStartOffset(4.5, 30), 4.5);
  assert.equal(bedStartOffset(undefined, 30), 0);
  assert.equal(bedStartOffset(0, 30), 0);
  assert.equal(bedStartOffset(-3, 30), 0);
  assert.equal(bedStartOffset(Number.NaN, 30), 0);
});

test('bedStartOffset: a start past the end of the track degrades to 0, never silence', () => {
  assert.equal(bedStartOffset(45, 30), 0);
  assert.equal(bedStartOffset(30, 30), 0);   // exactly at the end plays nothing
  assert.equal(bedStartOffset(5, 0), 0);     // undecodable/empty buffer
});

test('connectMusic: the in-point moves the loop window with it', () => {
  const { ctx, src } = fakeCtx();
  connectMusic(ctx as BaseAudioContext, buffer(30), {} as AudioNode, { clipSec: 25, start: 20 }).start();
  assert.deepEqual(src.started, [[0, 20]]);
  assert.equal(src.loop, true);
  // Without these the wrap would replay 0→15, i.e. the head the visuals skipped.
  assert.equal(src.loopStart, 20);
  assert.equal(src.loopEnd, 30);
});

test('connectMusic: no in-point leaves the loop over the whole track', () => {
  const { ctx, src } = fakeCtx();
  connectMusic(ctx as BaseAudioContext, buffer(30), {} as AudioNode, { clipSec: 25 }).start();
  assert.deepEqual(src.started, [[0, 0]]);
  assert.equal(src.loopStart, 0);
  assert.equal(src.loopEnd, 0);   // untouched = end of buffer
});

test('connectMusic: an out-of-range in-point falls back to the whole track', () => {
  const { ctx, src } = fakeCtx();
  connectMusic(ctx as BaseAudioContext, buffer(10), {} as AudioNode, { clipSec: 25, start: 99 }).start();
  assert.deepEqual(src.started, [[0, 0]]);
  assert.equal(src.loopStart, 0);
});

test('connectMusic: loop:false plays the source once (a narration over a mix-in bed)', () => {
  // section 6.1 - with a bed underneath, the primary must END so the bed's full-gain
  // tail can happen; looping it would hold the duck forever.
  const { ctx, src } = fakeCtx();
  connectMusic(ctx as BaseAudioContext, buffer(30), {} as AudioNode, { clipSec: 25, loop: false }).start();
  assert.equal(src.loop, false);
  // The default stays looped - no caller changes without opting in.
  const plain = fakeCtx();
  connectMusic(plain.ctx as BaseAudioContext, buffer(30), {} as AudioNode, { clipSec: 25 }).start();
  assert.equal(plain.src.loop, true);
});
