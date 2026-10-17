// SPDX-License-Identifier: MPL-2.0
/**
 * Trim's clip preparation in a real browser: the paths node cannot run because they
 * decode and encode (shells/web/src/bridge/media-trim.ts).
 *
 * Run with: node --test tests/trim-prepare.browser.test.ts
 *
 * The node tier (shells/web/src/bridge/media-trim.test.ts) pins every copy path and
 * every refusal. This tier re-encodes, against the sequence harness's self-identifying
 * VP8 and Opus clip (a key frame every 30 frames), and asserts only what a decoder can
 * show:
 *   - an exact cut between key frames re-encodes the picture, its first frame is the
 *     one asked for, and sound and picture stay in step,
 *   - a fast cut copies from the key frame before, and its first frame is that key
 *     frame,
 *   - a turn into WebM redraws the picture and the report sees the turned size,
 *   - a sharing size shrinks the picture, and a size limit reports its outcome,
 *   - a poster frame is the frame at the start point, and a contact sheet has the laid
 *     out size with every frame drawn.
 * Every case uses WebM codecs, which every Chromium build encodes, so nothing here
 * skips on codec support.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openHarness, browserGate, type Harness } from './helpers/sequence-browser.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { sheetLayout } from '../shells/web/src/lib/clip-checks.ts';
import type { MediaTrimReport } from '../packages/core/src/host-v1.ts';

const gate = browserGate();
const FPS = 30;
/** A time inside frame n, clear of both of its boundaries. */
const at = (n: number): number => (n + 0.25) / FPS;

interface TrimRun {
  key: string;
  mime: string;
  size: number;
  frameCount?: number;
  report: MediaTrimReport;
  image: { width: number; height: number; code: number | null } | null;
}
interface TrimApi {
  makeClip(spec: object): Promise<{ key: string }>;
  trim(key: string, opts: object): Promise<TrimRun>;
  decodeCodes(key: string, idx: number[], fps: number): Promise<(number | null)[]>;
}

describe('trim clip preparation (browser tier)', { skip: gate ?? false, concurrency: 1 }, () => {
  let H: Harness;
  let clip = '';

  before(async () => {
    H = await openHarness();
    clip = await H.page.evaluate(async () => (await (window as never as { SEQ: TrimApi }).SEQ.makeClip({ frames: 90, fps: 30, tone: { hz: 440, gain: 0.3 } })).key);
  });

  after(async () => {
    await H?.close();
    await closeBrowser();
  });

  const trim = (opts: Record<string, unknown>): Promise<TrimRun> => H.page.evaluate(
    ([key, o]) => (window as never as { SEQ: TrimApi }).SEQ.trim(key, o),
    [clip, { sourceName: 'clip.webm', sourceMime: 'video/webm', ...opts }] as const,
  );
  const firstCode = async (key: string): Promise<number | null> =>
    (await H.page.evaluate((k) => (window as never as { SEQ: TrimApi }).SEQ.decodeCodes(k, [0], 30), key))[0] ?? null;
  const videoTrack = (run: TrimRun) => run.report.tracks.find((t) => t.kind === 'video');

  test('an exact cut between key frames re-encodes the picture and starts on the frame asked for', async () => {
    const run = await trim({ start: at(40), end: at(70) });
    const video = videoTrack(run)!;
    assert.equal(video.action, 're-encode');
    assert.ok(video.reasons.includes('cut-between-key-frames'), video.reasons.join());
    assert.ok(Math.abs(run.report.actualStart - at(40)) < 1e-6, 'an exact cut starts where asked');
    assert.ok(Math.abs(run.report.keyFrameGap - (at(40) - 1)) < 0.002, 'the key frame before is frame 30');
    assert.equal(await firstCode(run.key), 40);
    assert.equal(run.report.sync?.ok, true, JSON.stringify(run.report.sync));
  });

  test('a fast cut copies from the key frame before the start', async () => {
    const run = await trim({ start: at(40), end: at(70), cut: 'keyframe' });
    assert.equal(videoTrack(run)?.action, 'copy');
    assert.ok(Math.abs(run.report.actualStart - 1) < 0.002, 'frame 30 is the key frame');
    assert.equal(await firstCode(run.key), 30);
    assert.equal(run.report.sync?.ok, true, JSON.stringify(run.report.sync));
  });

  test('a turn into WebM redraws the picture and the report sees the turned size', async () => {
    const run = await trim({ start: 0, end: at(30), rotate: 90, cut: 'keyframe' });
    assert.ok(videoTrack(run)?.reasons.includes('rotation-needs-pixels'));
    assert.equal(run.report.orientation?.method, 'pixels');
    assert.equal(run.report.orientation?.ok, true, JSON.stringify(run.report.orientation));
    assert.deepEqual(run.report.size, { width: 240, height: 320 });
  });

  test('a sharing size shrinks the picture and a size limit reports its outcome', async () => {
    const small = await trim({ start: 0, end: at(60), maxShortEdge: 120, cut: 'keyframe' });
    assert.ok(videoTrack(small)?.reasons.includes('resize'));
    assert.deepEqual(small.report.size, { width: 160, height: 120 });
    assert.equal(small.report.orientation?.ok, true);

    const limited = await trim({ start: 0, end: at(60), targetBytes: 40_000, cut: 'keyframe' });
    const target = limited.report.target!;
    assert.equal(target.bytes, 40_000);
    assert.equal(target.met, limited.size <= 40_000, 'the outcome is measured on the written file');
    assert.ok(target.attempts >= 1 && target.attempts <= 2);
    assert.ok(videoTrack(limited)?.reasons.includes('target-size'));
  });

  test('a poster frame is the frame at the start point', async () => {
    const run = await trim({ output: 'poster', start: at(45) });
    assert.equal(run.mime, 'image/jpeg');
    assert.equal(run.report.method, 'frames');
    assert.deepEqual([run.image?.width, run.image?.height], [320, 240]);
    assert.equal(run.image?.code, 45);
  });

  test('a contact sheet has the laid out size with every frame drawn', async () => {
    const run = await trim({ output: 'contact-sheet', sheetFrames: 6, image: 'png', start: 0, end: 3 });
    const layout = sheetLayout(6, 320, 240);
    assert.equal(run.mime, 'image/png');
    assert.equal(run.frameCount, 6);
    assert.deepEqual([run.image?.width, run.image?.height], [layout.width, layout.height]);
  });
});
