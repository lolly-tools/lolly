// SPDX-License-Identifier: MPL-2.0
/**
 * The facts and checks behind host.media.trim's report (lib/clip-checks.ts).
 *
 * Run directly:  node --test shells/web/src/lib/clip-checks.test.ts
 *
 * The sync, orientation and colour checks are pure functions of container facts, so
 * they are pinned here with hand-built facts, including the failures a real file would
 * only show after a faulty encode. The functions that read packets (key frame search,
 * copy detection and a copy's bitrate) run against small synthetic containers, and the
 * size limit arithmetic is pinned with the numbers a phone clip would give.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mb from 'mediabunny';
import {
  MIN_VIDEO_BPS, bitrateForTarget, checkColor, checkOrientation, checkSync, clockLabel, colorLabel, copiedOffset,
  copyFitsTarget, keyFrameCut, leadIn, normaliseRotation, rangeBitrate, readClipFacts, retryBitrate, shareDimensions,
  sheetLayout, sheetTimes,
  type ClipFacts, type ClipVideoFacts,
} from './clip-checks.ts';

const video = (over: Partial<ClipVideoFacts> = {}): ClipVideoFacts => ({
  codec: 'avc', start: 0, end: 10, step: 1 / 30, rotation: 0, displayWidth: 1920, displayHeight: 1080, color: null, ...over,
});
const audio = (over: Partial<ClipFacts['audio'] & object> = {}) => ({ codec: 'aac', start: 0, end: 10, step: 1024 / 48000, ...over });

test('checkSync passes a clip whose sound and picture start and end together', () => {
  const source: ClipFacts = { video: video(), audio: audio() };
  const written: ClipFacts = { video: video({ end: 3 }), audio: audio({ start: -0.04, end: 3.01 }) };
  const sync = checkSync(source, written, 2, 5)!;
  assert.equal(sync.method, 'ranges');
  assert.equal(sync.ok, true);
  assert.equal(sync.startSkew, 0, 'lead-in a player skips counts as starting at zero');
  assert.ok(Math.abs(sync.endSkew - 0.01) < 1e-9);
});

test('checkSync flags sound that drifted against the picture', () => {
  const source: ClipFacts = { video: video(), audio: audio() };
  const late: ClipFacts = { video: video({ end: 3 }), audio: audio({ start: 0.2, end: 3.2 }) };
  const sync = checkSync(source, late, 2, 5)!;
  assert.equal(sync.ok, false);
  assert.ok(Math.abs(sync.startSkew - 0.2) < 1e-9);
  assert.equal(sync.expectedStartSkew, 0);
  // A sound track that ends early is caught by the end check.
  const short = checkSync(source, { video: video({ end: 3 }), audio: audio({ end: 2.5 }) }, 2, 5)!;
  assert.equal(short.ok, false);
});

test('checkSync keeps an offset the source already had', () => {
  // The sound begins 0.25 s into the source. Cut from 0 and the written clip should
  // keep the 0.25 s gap rather than close the gap.
  const source: ClipFacts = { video: video(), audio: audio({ start: 0.25 }) };
  const written: ClipFacts = { video: video({ end: 4 }), audio: audio({ start: 0.25, end: 4 }) };
  const sync = checkSync(source, written, 0, 4)!;
  assert.equal(sync.expectedStartSkew, 0.25);
  assert.equal(sync.ok, true);
});

test('checkSync with packet offsets requires equal shifts on both tracks', () => {
  const source: ClipFacts = { video: video(), audio: audio() };
  const written: ClipFacts = { video: video({ end: 3 }), audio: audio({ end: 3 }) };
  assert.equal(checkSync(source, written, 2, 5, { video: 2, audio: 2.0004 })!.ok, true);
  const shifted = checkSync(source, written, 2, 5, { video: 2, audio: 2.05 })!;
  assert.equal(shifted.method, 'packets');
  assert.equal(shifted.ok, false);
  assert.equal(checkSync({ video: video(), audio: null }, written, 2, 5), undefined, 'no check without both tracks');
});

test('checkOrientation tells a flag turn from a drawn turn and catches the wrong way up', () => {
  const phone = video({ rotation: 90, displayWidth: 1080, displayHeight: 1920 });
  const flag = checkOrientation(phone, video({ rotation: 180, displayWidth: 1920, displayHeight: 1080 }), 90, null);
  assert.deepEqual([flag.method, flag.ok, flag.expectedWidth, flag.expectedHeight], ['flag', true, 1920, 1080]);
  const drawn = checkOrientation(phone, video({ rotation: 0, displayWidth: 1920, displayHeight: 1080 }), 90, null);
  assert.deepEqual([drawn.method, drawn.ok], ['pixels', true]);
  const wrong = checkOrientation(phone, video({ rotation: 0, displayWidth: 1080, displayHeight: 1920 }), 90, null);
  assert.equal(wrong.ok, false);
  const resized = checkOrientation(video(), video({ displayWidth: 1280, displayHeight: 720 }), 0, { width: 1280, height: 720 });
  assert.deepEqual([resized.method, resized.ok], ['none', true]);
});

test('colorLabel and checkColor describe declared colour information', () => {
  assert.equal(colorLabel(null), null);
  assert.equal(colorLabel({ primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false }), 'bt709');
  const hdr = { primaries: 'bt2020', transfer: 'pq', matrix: 'bt2020-ncl', fullRange: false } as unknown as VideoColorSpaceInit;
  assert.equal(colorLabel(hdr), 'bt2020 pq bt2020-ncl');
  assert.equal(colorLabel({ primaries: 'bt709', fullRange: true }), 'bt709 full range');
  assert.deepEqual(checkColor(hdr, { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709' }), { source: 'bt2020 pq bt2020-ncl', output: 'bt709', kept: false });
  assert.equal(checkColor(null, null).kept, true);
});

test('normaliseRotation accepts the four right angles only', () => {
  assert.deepEqual([90, '180', 270, 0, 45, -90, 'x', undefined].map(normaliseRotation), [90, 180, 270, 0, 0, 0, 0, 0]);
});

test('shareDimensions caps the shorter edge, keeps the aspect, rounds to even and never enlarges', () => {
  assert.deepEqual(shareDimensions(1920, 1080, 720), { width: 1280, height: 720 });
  assert.deepEqual(shareDimensions(1080, 1920, 720), { width: 720, height: 1280 });
  assert.deepEqual(shareDimensions(1918, 1078, 721), { width: 1286, height: 722 });
  assert.equal(shareDimensions(1280, 720, 720), null);
  assert.equal(shareDimensions(640, 360, 1080), null);
  assert.equal(shareDimensions(1920, 1080, 0), null);
});

test('bitrateForTarget leaves room for sound and overhead, and reports a budget too small to meet', () => {
  const fit = bitrateForTarget(10_000_000, 60, 128_000);
  assert.equal(fit.feasible, true);
  assert.equal(fit.capped, false);
  assert.equal(fit.videoBps, Math.floor((10_000_000 * 8 * 0.92) / 60 - 128_000));
  assert.deepEqual(bitrateForTarget(1_000_000, 600, 128_000), { videoBps: MIN_VIDEO_BPS, feasible: false, capped: false });
  assert.equal(retryBitrate(1_000_000, 12_000_000, 10_000_000), Math.floor(1_000_000 * (10 / 12) * 0.95));
  assert.equal(retryBitrate(150_000, 50_000_000, 1_000_000), MIN_VIDEO_BPS);
});

test('bitrateForTarget never asks for more than the source carries', () => {
  // A 100 MB limit on a 60 s, 8 Mbps phone clip: the limit alone would ask for about
  // 12.7 Mbps, a larger and lossier file than the source's own 8 Mbps.
  const MB = 1024 * 1024;
  const roomy = bitrateForTarget(100 * MB, 60, 128_000, 8_000_000);
  assert.deepEqual(roomy, { videoBps: 8_000_000, feasible: true, capped: true });
  // A half-second clip with an ordinary limit would ask for hundreds of Mbps.
  assert.equal(bitrateForTarget(25 * MB, 0.5, 128_000, 6_000_000).videoBps, 6_000_000);
  // A sharing size scales the cap by the pixels kept: 720p from 1080p keeps 4/9 of them.
  const shared = bitrateForTarget(100 * MB, 60, 128_000, 9_000_000, (1280 * 720) / (1920 * 1080));
  assert.ok(shared.capped && Math.abs(shared.videoBps - 4_000_000) <= 1, String(shared.videoBps));
  // A tight limit still sets the rate under the cap.
  const tight = bitrateForTarget(20 * MB, 60, 128_000, 8_000_000);
  assert.equal(tight.capped, false);
  assert.equal(tight.videoBps, Math.floor((20 * MB * 8 * 0.92) / 60 - 128_000));
  // An unknown source rate (0) leaves the limit in charge.
  assert.equal(bitrateForTarget(100 * MB, 60, 128_000, 0).capped, false);
});

test('copyFitsTarget keeps a copy whose packets fit with room for the container', () => {
  assert.equal(copyFitsTarget(60_000_000, 100_000_000), true, 'a 60 MB copy fits a 100 MB limit');
  assert.equal(copyFitsTarget(99_000_000, 100_000_000), false, 'too close to the limit once the container is added');
  assert.equal(copyFitsTarget(0, 100_000_000), false, 'an unknown size is not assumed to fit');
});

test('sheetTimes spreads frames over the range and clamps the count', () => {
  assert.deepEqual(sheetTimes(0, 8, 4), [1, 3, 5, 7]);
  assert.equal(sheetTimes(0, 10, 2).length, 4);
  assert.equal(sheetTimes(0, 10, 100).length, 36);
  assert.equal(sheetTimes(0, 10, Number.NaN).length, 12);
});

test('sheetLayout leans towards a landscape page', () => {
  const wide = sheetLayout(12, 1920, 1080);
  assert.deepEqual([wide.cols, wide.rows, wide.tileWidth, wide.tileHeight], [3, 4, 480, 270]);
  assert.equal(wide.width, 16 * 2 + 3 * 480 + 2 * 8);
  const tall = sheetLayout(12, 1080, 1920);
  assert.deepEqual([tall.cols, tall.rows, tall.tileWidth, tall.tileHeight], [6, 2, 270, 480]);
});

test('clockLabel writes minutes, seconds and tenths', () => {
  assert.equal(clockLabel(0), '0:00.0');
  assert.equal(clockLabel(62.54), '1:02.5');
  assert.equal(clockLabel(3723.4), '1:02:03.4');
});

// ── Reading real containers ────────────────────────────────────────────────

async function vp9File(frames: number, gop: number, seed = 31): Promise<Uint8Array> {
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target });
  const source = new mb.EncodedVideoPacketSource('vp9');
  output.addVideoTrack(source);
  await output.start();
  for (let i = 0; i < frames; i++) {
    const data = new Uint8Array(10 + (i % 3)).map((_, j) => (i * seed + j + 1) & 0xff);
    await source.add(new mb.EncodedPacket(data, i % gop === 0 ? 'key' : 'delta', i / 30, 1 / 30),
      i === 0 ? { decoderConfig: { codec: 'vp09.00.10.08', codedWidth: 16, codedHeight: 16 } } : undefined);
  }
  await output.finalize();
  return new Uint8Array(target.buffer!);
}

function open(bytes: Uint8Array): mb.Input {
  return new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BufferSource(bytes) });
}

test('keyFrameCut finds the key frame at or before the start and whether a copy shows the same frame', async () => {
  const input = open(await vp9File(30, 10));
  try {
    const track = (await input.getPrimaryVideoTrack())!;
    assert.deepEqual(await keyFrameCut(mb, track, 0), { keyTime: 0, gap: 0, aligned: true });
    const inside = await keyFrameCut(mb, track, 10 / 30 + 0.01);
    assert.equal(inside.aligned, true);
    assert.ok(Math.abs(inside.gap - 0.01) < 1e-6);
    const between = await keyFrameCut(mb, track, 0.5);
    assert.equal(between.aligned, false);
    assert.ok(Math.abs(between.keyTime! - 10 / 30) < 1e-6);
    assert.ok(Math.abs(between.gap - (0.5 - 10 / 30)) < 1e-6);
  } finally {
    input.dispose();
  }
});

test('rangeBitrate counts the packets a copy carries, from the key frame before the start', async () => {
  const input = open(await vp9File(30, 10));
  try {
    const track = (await input.getPrimaryVideoTrack())!;
    // From 0.5 s a copy begins on the frame 10 key frame and runs to frame 23.
    let bytes = 0;
    for (let i = 10; i <= 23; i++) bytes += 10 + (i % 3);
    const bps = await rangeBitrate(mb, track, 0.5, 0.79);
    assert.ok(bps !== null && Math.abs(bps - (bytes * 8) / (14 / 30)) < 1, String(bps));
  } finally {
    input.dispose();
  }
});

test('leadIn reads the picture a written file keeps before its start', () => {
  assert.ok(Math.abs(leadIn(video({ start: -0.1 })) - 0.1) < 1e-9);
  assert.equal(leadIn(video({ start: 0 })), 0);
  assert.equal(leadIn(video({ start: -0.0001 })), 0, 'timescale rounding is not a lead-in');
  assert.equal(leadIn(null), 0);
});

test('copiedOffset recognises copied packets and rejects new ones', async () => {
  const source = open(await vp9File(30, 10));
  const copy = open(await vp9File(30, 10));
  const other = open(await vp9File(30, 10, 37));
  try {
    const src = (await source.getPrimaryVideoTrack())!;
    assert.equal(await copiedOffset(mb, src, (await copy.getPrimaryVideoTrack())!, 0), 0);
    assert.equal(await copiedOffset(mb, src, (await other.getPrimaryVideoTrack())!, 0), null);
    const facts = await readClipFacts(mb, source);
    assert.equal(facts.audio, null);
    assert.deepEqual([facts.video!.codec, facts.video!.displayWidth, facts.video!.end], ['vp9', 16, 1]);
    assert.ok(Math.abs(facts.video!.step - 1 / 30) < 1e-6);
  } finally {
    source.dispose(); copy.dispose(); other.dispose();
  }
});
