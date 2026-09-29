// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openHarness, browserGate } from './helpers/sequence-browser.ts';
import type { ExportRun, StageSpec } from './helpers/sequence-browser-harness.ts';
import { inspectMotionBytes } from '../packages/node-shell/src/motion-inspect.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';

interface MotionHarness {
  exportSeq(scene: StageSpec, format: 'webm', opts: Record<string, unknown>): Promise<ExportRun>;
  frameHashes(key: string, indices: number[], fps: number): Promise<string[]>;
  makeBed(seconds: number, hz: number, gain: number): { key: string };
  hasAudioTrack(key: string): Promise<boolean>;
  blobBytes(key: string): Promise<string>;
  makeClip(spec: { frames: number; fps: number; w: number; h: number }): Promise<{ key: string }>;
  exportViaApi(scene: StageSpec, format: string, opts: Record<string, unknown>): Promise<ExportRun>;
  firstFramePixels(key: string, probes: { x: number; y: number }[], width: number): Promise<number[][]>;
  constants: { CODE_BITS: number };
}

test('temporal movie integration preserves static pixels, clocks and worker parity', { skip: browserGate() ?? false, timeout: 180_000 }, async () => {
  const harness = await openHarness();
  try {
    const result = await harness.page.evaluate(async () => {
      const s = (window as unknown as { SEQ: MotionHarness }).SEQ;
      const clip = await s.makeClip({ frames: 90, fps: 30, w: 320, h: 180 });
      const videoCodes: number[] = [];
      for (const at of [0.5, 1]) {
        const sampled = await s.exportViaApi({ w: 320, h: 180, seqMs: 2000, boxes: [{ clip: clip.key, start: 0, dur: 2000, clipIn: 200, speed: 2, w: 320, h: 180 }] }, 'png', { sampleTimes: [at], watermark: false });
        if (sampled.error || !sampled.key) throw new Error(JSON.stringify(sampled.error));
        const pixels = await s.firstFramePixels(sampled.key, Array.from({ length: s.constants.CODE_BITS }, (_, i) => ({ x: (i + 0.5) * 320 / s.constants.CODE_BITS, y: 8 })), 320);
        videoCodes.push(pixels.reduce((n, pixel, i) => n | (pixel[0]! > 128 ? 1 << i : 0), 0));
      }
      const scene: StageSpec = { w: 320, h: 120, seqMs: 1000, bg: '#000000', boxes: [{ x: 20, y: 20, w: 20, h: 80, bg: '#ffffff', start: 0, dur: 1000, lane: 'seq', kf: 't0_el_x0*t1000_x240' }] };
      await s.exportSeq(scene, 'webm', { fps: 24, worker: false });
      const runs = [];
      for (const samples of [1, 4, 8, 16]) {
        const run = await s.exportSeq(scene, 'webm', { fps: 24, worker: false, motionBlur: { samples, shutterAngle: 360 } });
        runs.push({ samples, ms: run.ms, error: run.error, frames: run.frames, counters: run.counters, scratchBytes: 320 * 120 * 20 });
      }
      const opts = { fps: 24, motionBlur: { samples: 8, shutterAngle: 180 } };
      const main = await s.exportSeq(scene, 'webm', { ...opts, worker: false });
      const worker = await s.exportSeq(scene, 'webm', { ...opts, worker: true });
      const hashes = async (key: string | null) => key ? s.frameHashes(key, [0, 6, 12, 23], 24) : [];
      const stationary = { ...scene, boxes: [{ ...scene.boxes[0], kf: '' }] };
      const off = await s.exportSeq(stationary, 'webm', { fps: 24, worker: false });
      const on = await s.exportSeq(stationary, 'webm', { ...opts, worker: false });
      const bed = await s.makeBed(1, 440, 0.1);
      const ranged = await s.exportSeq({ ...scene, boxes: [...scene.boxes, { audioSrc: bed.key, start: 0, dur: 1000 }] }, 'webm', { ...opts, sequenceRange: { from: 0.25, to: 0.75 } });
      const aborted = new AbortController();
      const cancel = await s.exportSeq(scene, 'webm', { ...opts, worker: false, signal: aborted.signal, onProgress: () => aborted.abort() });
      return { videoCodes, runs, main: main.error, worker: worker.error, logs: worker.logs, a: await hashes(main.key), b: await hashes(worker.key), off: await hashes(off.key), on: await hashes(on.key), range: { error: ranged.error, bytes: ranged.key ? await s.blobBytes(ranged.key) : '', audio: ranged.key ? await s.hasAudioTrack(ranged.key) : false }, cancel: cancel.error, counters: cancel.counters };
    });
    console.log(JSON.stringify({ ...result, range: { ...result.range, bytes: '(encoded)' } }));
    assert.deepEqual(result.videoCodes, [36, 66]);
    assert.ok(result.runs.every(run => !run.error && run.frames === 24));
    assert.equal(result.main, null); assert.equal(result.worker, null);
    assert.ok(result.logs.some((line: string) => line.includes('worker offload')));
    assert.deepEqual(result.a, result.b);
    assert.deepEqual(result.off, result.on);
    assert.equal(result.range.error, null); const report = await inspectMotionBytes(Buffer.from(result.range.bytes, 'base64'), { seconds: 0.5, fps: 24, audio: true });
    assert.equal(report.ok, true, JSON.stringify(report)); assert.equal(result.range.audio, true);
    assert.ok(result.cancel);
  } finally { await harness.close(); await closeBrowser(); }
});
