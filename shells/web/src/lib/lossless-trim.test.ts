// SPDX-License-Identifier: MPL-2.0
/**
 * WP-E lossless keyframe-aligned trim (lib/lossless-trim.ts).
 *
 * Run directly:  node --test shells/web/src/lib/lossless-trim.test.ts
 *
 * Pure node, no jsdom: lossless-trim.ts is DOM-free, and the copy it performs never
 * decodes anything, so its losslessness is provable with mediabunny alone. The source
 * is synthesised with a KNOWN keyframe cadence (a keyframe every 5 frames at 25 fps, so
 * keyframes land on 0.2 second boundaries) plus an audio track, so every bound and every
 * copied byte is predictable. What is pinned here:
 *   - a keyframe-aligned window copies the exact kept packets BYTE-IDENTICAL to the
 *     source's, on both tracks (the losslessness proof),
 *   - the output's first video packet is a key packet (decodable standalone),
 *   - the copied timestamps are rebased to start at 0 and the reported duration matches
 *     the window,
 *   - an off-keyframe inSec SNAPS back to the previous keyframe and the snap is reported,
 *   - exactBounds on an off-keyframe cut returns null (the caller transcodes instead),
 *     while exactBounds on an aligned cut still copies,
 *   - the video track's HDR colour space is carried onto the output unchanged,
 *   - a genuine cancel throws an AbortError rather than falling back,
 *   - a source with no video track, and an unreadable source, return null.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mb from 'mediabunny';
import { losslessTrim } from './lossless-trim.ts';

/** A wide-gamut HDR colour space: BT.2020 primaries with the PQ transfer function, the
 *  signalling an HDR video carries in its container. The installed DOM lib's
 *  VideoColorPrimaries union predates BT.2020, so the runtime-valid values are widened
 *  through unknown; mediabunny accepts and reads them back unchanged. */
const HDR_COLOR_SPACE = {
  primaries: 'bt2020', transfer: 'pq', matrix: 'bt2020-ncl', fullRange: false,
} as unknown as VideoColorSpaceInit;

/** A minimal, valid OpusHead identification header (19 bytes) so mediabunny can build a
 *  well-formed Opus stream from our synthetic packets. */
function opusHead(channels = 2, sampleRate = 48000): Uint8Array {
  const b = new Uint8Array(19);
  b.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
  b[8] = 1;                 // version
  b[9] = channels;          // channel count
  b[12] = sampleRate & 0xff; b[13] = (sampleRate >> 8) & 0xff;
  b[14] = (sampleRate >> 16) & 0xff; b[15] = (sampleRate >> 24) & 0xff;
  return b;
}

/** One synthesised packet: its bytes, its type, and its source-time timestamp. */
interface Synth { data: Uint8Array; type: import('mediabunny').PacketType; ts: number }

/** Build a WebM (VP9 video with an HDR colour space, plus Opus audio) whose video track
 *  has a known keyframe cadence: frame i is a key packet when i is a multiple of
 *  keyEvery, else a delta packet. 25 fps (0.04 second frames) keeps every timestamp
 *  exact in the container's millisecond timescale. Returns the container bytes plus the
 *  exact per-frame data fed to each track, so a trim can be checked byte for byte and by
 *  timestamp. */
async function makeSource(frames: number, keyEvery: number): Promise<{
  bytes: ArrayBuffer; video: Synth[]; audio: Synth[]; dur: number;
}> {
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.WebMOutputFormat(), target });
  const vSrc = new mb.EncodedVideoPacketSource('vp9');
  const aSrc = new mb.EncodedAudioPacketSource('opus');
  output.addVideoTrack(vSrc);
  output.addAudioTrack(aSrc);
  await output.start();

  const vConfig: VideoDecoderConfig = { codec: 'vp09.02.10.10', codedWidth: 16, codedHeight: 16, colorSpace: HDR_COLOR_SPACE };
  const aConfig: AudioDecoderConfig = { codec: 'opus', numberOfChannels: 2, sampleRate: 48000, description: opusHead() };
  const dur = 0.04;
  const video: Synth[] = [];
  const audio: Synth[] = [];
  let ts = 0;
  for (let i = 0; i < frames; i++) {
    const vType: import('mediabunny').PacketType = i % keyEvery === 0 ? 'key' : 'delta';
    const vb = new Uint8Array(12 + i);
    for (let j = 0; j < vb.length; j++) vb[j] = (i * 31 + j + 1) & 0xff;
    video.push({ data: vb, type: vType, ts });
    await vSrc.add(new mb.EncodedPacket(vb, vType, ts, dur), i === 0 ? { decoderConfig: vConfig } : undefined);

    const ab = new Uint8Array(6 + i);
    ab[0] = 0xf8;
    for (let j = 1; j < ab.length; j++) ab[j] = (i * 17 + j) & 0xff;
    audio.push({ data: ab, type: 'key', ts });
    await aSrc.add(new mb.EncodedPacket(ab, 'key', ts, dur), i === 0 ? { decoderConfig: aConfig } : undefined);
    ts += dur;
  }
  await output.finalize();
  return { bytes: target.buffer!, video, audio, dur };
}

/** Everything a check needs from a container: its detected format, the primary video and
 *  audio codecs, each track's encoded packets (bytes, type, timestamp, decode-free), and
 *  the video track's colour space plus its HDR flag. */
async function readContainer(bytes: ArrayBuffer): Promise<{
  format: import('mediabunny').InputFormat;
  videoCodec: string | null;
  audioCodec: string | null;
  video: { data: Uint8Array; type: string; ts: number }[];
  audio: { data: Uint8Array; type: string; ts: number }[];
  colorSpace: VideoColorSpaceInit | null;
  hdr: boolean;
}> {
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(new Blob([bytes])) });
  const format = await input.getFormat();
  const vt = await input.getPrimaryVideoTrack();
  const at = await input.getPrimaryAudioTrack();
  const readPackets = async (track: import('mediabunny').InputTrack | null): Promise<{ data: Uint8Array; type: string; ts: number }[]> => {
    if (!track) return [];
    const sink = new mb.EncodedPacketSink(track);
    const out: { data: Uint8Array; type: string; ts: number }[] = [];
    for await (const p of sink.packets()) out.push({ data: p.data, type: p.type, ts: p.timestamp });
    return out;
  };
  const result = {
    format,
    videoCodec: vt ? await vt.getCodec() : null,
    audioCodec: at ? await at.getCodec() : null,
    video: await readPackets(vt),
    audio: await readPackets(at),
    colorSpace: vt ? await vt.getColorSpace() : null,
    hdr: vt ? await vt.hasHighDynamicRange() : false,
  };
  input.dispose();
  return result;
}

/** true when two lists of packet byte arrays are identical, else a description of the
 *  first difference. */
function bytesEqual(a: Uint8Array[], b: Uint8Array[]): true | string {
  if (a.length !== b.length) return `packet count ${a.length} vs ${b.length}`;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.length !== b[i]!.length) return `packet ${i} length ${a[i]!.length} vs ${b[i]!.length}`;
    for (let j = 0; j < a[i]!.length; j++) {
      if (a[i]![j] !== b[i]![j]) return `packet ${i} byte ${j}: ${a[i]![j]} vs ${b[i]![j]}`;
    }
  }
  return true;
}

function approx(a: number, b: number, tol = 1e-4): boolean {
  return Math.abs(a - b) <= tol;
}

// A keyframe-aligned window: byte-lossless, keyframe first, rebased timestamps ---------

test('losslessTrim: a keyframe-aligned window copies both tracks byte-identically, starts on a keyframe, rebased to 0', async () => {
  // 30 frames at 25 fps, a keyframe every 5 frames: keyframes at 0, 0.2, 0.4, 0.6, 0.8.
  const src = await makeSource(30, 5);
  // Window [0.2, 0.6): frame 5 (a keyframe) through frame 14. Ten frames.
  const result = await losslessTrim(new mb.BlobSource(new Blob([src.bytes])), 0.2, 0.6);
  assert.ok(result, 'the aligned window produced a result rather than falling back');
  assert.equal(result.container, 'webm', 'with no target the source container is kept');
  assert.equal(result.videoCodec, 'vp9');
  assert.equal(result.audioCodec, 'opus');
  assert.equal(result.snapped, false, 'an on-keyframe cut-in is not a snap');
  assert.ok(approx(result.snappedInSec, 0.2), `cut-in at 0.2, got ${result.snappedInSec}`);
  assert.ok(approx(result.snappedOutSec, 0.6), `cut-out at 0.6, got ${result.snappedOutSec}`);
  assert.ok(approx(result.durationSec, 0.4), `duration 0.4, got ${result.durationSec}`);

  const after = await readContainer(await result.blob.arrayBuffer());
  assert.equal(after.format, mb.WEBM, 'the output re-opens as WebM');
  assert.equal(after.videoCodec, 'vp9');
  assert.equal(after.audioCodec, 'opus');

  // (a) every kept packet is byte-identical to the corresponding source packet.
  const wantVideo = src.video.slice(5, 15).map((p) => p.data);
  const wantAudio = src.audio.slice(5, 15).map((p) => p.data);
  assert.equal(after.video.length, 10, 'ten video frames kept (5..14)');
  assert.equal(after.audio.length, 10, 'ten audio packets kept (5..14)');
  assert.equal(bytesEqual(after.video.map((p) => p.data), wantVideo), true, 'video packets copied verbatim');
  assert.equal(bytesEqual(after.audio.map((p) => p.data), wantAudio), true, 'audio packets copied verbatim');

  // (b) the output's first video packet is a key packet.
  assert.equal(after.video[0]!.type, 'key', 'the first output video packet is a keyframe');
  // The kept keyframe cadence is preserved: frame 5 was a keyframe, 6..9 delta, 10 key.
  assert.equal(after.video[5]!.type, 'key', 'the frame-10 keyframe is still a keyframe (index 5 in the cut)');
  assert.equal(after.video[1]!.type, 'delta', 'frame 6 is still a delta packet');

  // (c) timestamps rebased to start at 0, in steps of the frame duration.
  assert.ok(approx(after.video[0]!.ts, 0), `first video timestamp is 0, got ${after.video[0]!.ts}`);
  assert.ok(approx(after.audio[0]!.ts, 0), `first audio timestamp is 0, got ${after.audio[0]!.ts}`);
  assert.ok(approx(after.video[9]!.ts, 0.36), `last video timestamp is 0.36, got ${after.video[9]!.ts}`);
});

// Off-keyframe inSec snaps back to the previous keyframe -------------------------------

test('losslessTrim: an off-keyframe inSec snaps back to the previous keyframe and reports it', async () => {
  const src = await makeSource(30, 5);
  // 0.28 is frame 7 (a delta frame); the previous keyframe is frame 5 at 0.2.
  const result = await losslessTrim(new mb.BlobSource(new Blob([src.bytes])), 0.28, 0.6);
  assert.ok(result, 'a mid-GOP cut-in still trims by snapping back');
  assert.equal(result.snapped, true, 'the cut-in was snapped to a keyframe');
  assert.equal(result.requestedInSec, 0.28, 'the requested in point is reported unchanged');
  assert.ok(approx(result.snappedInSec, 0.2), `snapped back to the keyframe at 0.2, got ${result.snappedInSec}`);

  const after = await readContainer(await result.blob.arrayBuffer());
  assert.equal(after.video[0]!.type, 'key', 'the snapped output still begins on a keyframe');
  // Same window as the aligned case (5..14): the snap moved the cut-in to 0.2.
  assert.equal(bytesEqual(after.video.map((p) => p.data), src.video.slice(5, 15).map((p) => p.data)), true, 'the snapped window is the keyframe window, verbatim');
});

// exactBounds refuses an off-keyframe cut, allows an aligned one ----------------------

test('losslessTrim: exactBounds returns null on an off-keyframe cut, but copies an aligned one', async () => {
  const src = await makeSource(30, 5);
  const off = await losslessTrim(new mb.BlobSource(new Blob([src.bytes])), 0.28, 0.6, undefined, { exactBounds: true });
  assert.equal(off, null, 'exactBounds refuses a cut-in that is not on a keyframe');

  const aligned = await losslessTrim(new mb.BlobSource(new Blob([src.bytes])), 0.2, 0.6, undefined, { exactBounds: true });
  assert.ok(aligned, 'exactBounds still copies a cut whose bounds are already aligned');
  assert.equal(aligned.snapped, false);
  assert.ok(approx(aligned.snappedInSec, 0.2));
});

// HDR colour space preserved ----------------------------------------------------------

test('losslessTrim: the HDR colour space is carried onto the trimmed output unchanged', async () => {
  const src = await makeSource(20, 5);
  const before = await readContainer(src.bytes);
  assert.equal(before.hdr, true, 'the source is HDR');

  const result = await losslessTrim(new mb.BlobSource(new Blob([src.bytes])), 0.2, 0.6);
  assert.ok(result);
  const after = await readContainer(await result.blob.arrayBuffer());
  assert.deepEqual(after.colorSpace, HDR_COLOR_SPACE, 'the HDR colour space is preserved intact');
  assert.deepEqual(after.colorSpace, before.colorSpace, 'the trim matches the source colour space');
  assert.equal(after.hdr, true, 'the trimmed clip stays HDR');
});

// A target container different from the source (trim + transmux in one) ---------------

test('losslessTrim: an explicit target trims into a different container, still byte-lossless', async () => {
  const src = await makeSource(30, 5);
  const result = await losslessTrim(new mb.BlobSource(new Blob([src.bytes])), 0.2, 0.6, 'mkv');
  assert.ok(result, 'the trim into MKV produced a result');
  assert.equal(result.container, 'mkv');
  const after = await readContainer(await result.blob.arrayBuffer());
  assert.equal(after.format, mb.MATROSKA, 'the output is Matroska, not the source WebM');
  assert.equal(bytesEqual(after.video.map((p) => p.data), src.video.slice(5, 15).map((p) => p.data)), true, 'video packets copied verbatim into the new container');
  assert.equal(after.video[0]!.type, 'key', 'the first video packet is still a keyframe');
});

// The fall-back triggers --------------------------------------------------------------

test('losslessTrim: a source with no video track returns null (fall back)', async () => {
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.WebMOutputFormat(), target });
  const aSrc = new mb.EncodedAudioPacketSource('opus');
  output.addAudioTrack(aSrc);
  await output.start();
  let ts = 0;
  for (let i = 0; i < 6; i++) {
    const ab = new Uint8Array([0xf8, i]);
    await aSrc.add(new mb.EncodedPacket(ab, 'key', ts, 0.04), i === 0 ? { decoderConfig: { codec: 'opus', numberOfChannels: 2, sampleRate: 48000, description: opusHead() } } : undefined);
    ts += 0.04;
  }
  await output.finalize();
  const result = await losslessTrim(new mb.BlobSource(new Blob([target.buffer!])), 0.0, 0.2);
  assert.equal(result, null, 'no video track means no keyframe grid, so fall back');
});

test('losslessTrim: an unreadable source and an empty window both return null, never throw', async () => {
  const garbage = await losslessTrim(new mb.BlobSource(new Blob([new Uint8Array([0, 1, 2, 3, 4, 5])])), 0.0, 1.0);
  assert.equal(garbage, null, 'an unreadable source falls back rather than failing');

  const src = await makeSource(10, 5);
  const empty = await losslessTrim(new mb.BlobSource(new Blob([src.bytes])), 0.4, 0.4);
  assert.equal(empty, null, 'an empty window (out <= in) falls back');
});

// A genuine cancel is abortive --------------------------------------------------------

test('losslessTrim: a genuine cancel throws an AbortError rather than falling back', async () => {
  const src = await makeSource(30, 5);
  await assert.rejects(
    () => losslessTrim(new mb.BlobSource(new Blob([src.bytes])), 0.2, 0.6, undefined, { isCancelled: () => true }),
    (e: Error) => e.name === 'AbortError',
    'a cancel surfaces as an AbortError, not a silent null fall-back',
  );
});
