// SPDX-License-Identifier: MPL-2.0
/**
 * WP-E for video - the lossless container rewrite engine (lib/transmux.ts).
 *
 * Run directly:  node --test shells/web/src/lib/transmux.test.ts
 *
 * Pure node, no jsdom: transmux.ts is DOM-free, and the copy it performs never decodes
 * anything, so its losslessness is provable with mediabunny alone. What is pinned here:
 *   - a real multi-track WebM (VP9 video with an HDR colour space, plus Opus audio)
 *     rewrites into a valid MKV whose encoded packets are BYTE-IDENTICAL to the
 *     source's, on both tracks (the losslessness proof),
 *   - the output re-opens as the target container (Matroska, not WebM) carrying the
 *     same tracks and codecs,
 *   - the video track's HDR colour space (primaries, transfer, matrix, range) is
 *     carried onto the output unchanged, and both read back as HDR,
 *   - a codec that is illegal in the target (AAC audio into WebM, which only takes
 *     Opus or Vorbis) is dropped while the legal video is kept, and a source whose
 *     only track is illegal returns null (the dropped-or-null contract),
 *   - a rewrite into the source's own container, and a source mediabunny cannot read,
 *     both return null (the fall-back trigger), not a throw,
 *   - a genuine cancel throws an AbortError rather than falling back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mb from 'mediabunny';
import { TRANSMUX_CONTAINERS, transmuxContainer } from './transmux.ts';

/** A wide-gamut HDR colour space: BT.2020 primaries with the PQ transfer function,
 *  the signalling an HDR video carries in its container. The installed DOM lib's
 *  VideoColorPrimaries union predates BT.2020 (it stops at bt709/smpte170m), so the
 *  runtime-valid values are widened through unknown; mediabunny accepts and reads them
 *  back unchanged. */
const HDR_COLOR_SPACE = {
  primaries: 'bt2020', transfer: 'pq', matrix: 'bt2020-ncl', fullRange: false,
} as unknown as VideoColorSpaceInit;

/** A minimal, valid OpusHead identification header (19 bytes) so mediabunny can build
 *  a well-formed Opus stream from our synthetic packets. */
function opusHead(channels = 2, sampleRate = 48000): Uint8Array {
  const b = new Uint8Array(19);
  b.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
  b[8] = 1;                 // version
  b[9] = channels;          // channel count
  b[12] = sampleRate & 0xff; b[13] = (sampleRate >> 8) & 0xff;
  b[14] = (sampleRate >> 16) & 0xff; b[15] = (sampleRate >> 24) & 0xff;
  return b;
}

/** A 2-byte AAC-LC AudioSpecificConfig (object type 2, 48 kHz, stereo), enough for
 *  mediabunny to declare an AAC track. The audio bytes are never decoded. */
const AAC_ASC = new Uint8Array([0x11, 0x90]);

interface SourceSpec {
  format: import('mediabunny').OutputFormat;
  video?: { codec: import('mediabunny').VideoCodec; config: VideoDecoderConfig };
  audio?: { codec: import('mediabunny').AudioCodec; config: AudioDecoderConfig };
  frames: number;
}

/** Build a source container with a video track, an audio track, or both, from
 *  synthetic encoded packets with known bytes. The packets are interleaved by
 *  timestamp as they are added. Returns the container bytes and the exact packet
 *  bodies fed to each track, so a rewrite can be checked byte for byte. */
async function makeSource(spec: SourceSpec): Promise<{ bytes: ArrayBuffer; video: Uint8Array[]; audio: Uint8Array[] }> {
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: spec.format, target });
  const vSrc = spec.video ? new mb.EncodedVideoPacketSource(spec.video.codec) : null;
  const aSrc = spec.audio ? new mb.EncodedAudioPacketSource(spec.audio.codec) : null;
  if (vSrc) output.addVideoTrack(vSrc);
  if (aSrc) output.addAudioTrack(aSrc);
  await output.start();

  const video: Uint8Array[] = [];
  const audio: Uint8Array[] = [];
  const dur = 1 / 30;
  let ts = 0;
  for (let i = 0; i < spec.frames; i++) {
    if (vSrc) {
      const vb = new Uint8Array(12 + i);
      for (let j = 0; j < vb.length; j++) vb[j] = (i * 31 + j + 1) & 0xff;
      video.push(vb);
      await vSrc.add(new mb.EncodedPacket(vb, 'key', ts, dur), i === 0 ? { decoderConfig: spec.video!.config } : undefined);
    }
    if (aSrc) {
      const ab = new Uint8Array(6 + i);
      ab[0] = 0xf8;
      for (let j = 1; j < ab.length; j++) ab[j] = (i * 17 + j) & 0xff;
      audio.push(ab);
      await aSrc.add(new mb.EncodedPacket(ab, 'key', ts, dur), i === 0 ? { decoderConfig: spec.audio!.config } : undefined);
    }
    ts += dur;
  }
  await output.finalize();
  return { bytes: target.buffer!, video, audio };
}

/** Everything a check needs from a container: its detected format, the primary video
 *  and audio codecs, each track's encoded packet bytes (decode-free), and the video
 *  track's colour space plus its HDR flag. */
async function readContainer(bytes: ArrayBuffer): Promise<{
  format: import('mediabunny').InputFormat;
  videoCodec: string | null;
  audioCodec: string | null;
  video: Uint8Array[];
  audio: Uint8Array[];
  colorSpace: VideoColorSpaceInit | null;
  hdr: boolean;
}> {
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(new Blob([bytes])) });
  const format = await input.getFormat();
  const vt = await input.getPrimaryVideoTrack();
  const at = await input.getPrimaryAudioTrack();
  const readPackets = async (track: import('mediabunny').InputTrack | null): Promise<Uint8Array[]> => {
    if (!track) return [];
    const sink = new mb.EncodedPacketSink(track);
    const out: Uint8Array[] = [];
    for await (const p of sink.packets()) out.push(p.data);
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
function packetsEqual(a: Uint8Array[], b: Uint8Array[]): true | string {
  if (a.length !== b.length) return `packet count ${a.length} vs ${b.length}`;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.length !== b[i]!.length) return `packet ${i} length ${a[i]!.length} vs ${b[i]!.length}`;
    for (let j = 0; j < a[i]!.length; j++) {
      if (a[i]![j] !== b[i]![j]) return `packet ${i} byte ${j}: ${a[i]![j]} vs ${b[i]![j]}`;
    }
  }
  return true;
}

// The container info map ----------------------------------------------------------

test('TRANSMUX_CONTAINERS names the honest extension and MIME for each target', () => {
  assert.deepEqual(TRANSMUX_CONTAINERS.mp4, { ext: 'mp4', mime: 'video/mp4' });
  assert.deepEqual(TRANSMUX_CONTAINERS.mov, { ext: 'mov', mime: 'video/quicktime' });
  assert.deepEqual(TRANSMUX_CONTAINERS.mkv, { ext: 'mkv', mime: 'video/x-matroska' });
  assert.deepEqual(TRANSMUX_CONTAINERS.webm, { ext: 'webm', mime: 'video/webm' });
});

// Byte-lossless rewrite + HDR preservation ----------------------------------------

test('transmuxContainer: a WebM (VP9 HDR + Opus) rewrites to a valid MKV, byte-lossless on both tracks', async () => {
  const src = await makeSource({
    format: new mb.WebMOutputFormat(),
    video: { codec: 'vp9', config: { codec: 'vp09.02.10.10', codedWidth: 16, codedHeight: 16, colorSpace: HDR_COLOR_SPACE } },
    audio: { codec: 'opus', config: { codec: 'opus', numberOfChannels: 2, sampleRate: 48000, description: opusHead() } },
    frames: 4,
  });
  const before = await readContainer(src.bytes);
  assert.equal(before.format, mb.WEBM, 'the source is a WebM');
  assert.equal(before.videoCodec, 'vp9');
  assert.equal(before.audioCodec, 'opus');

  const result = await transmuxContainer(new mb.BlobSource(new Blob([src.bytes])), 'mkv');
  assert.ok(result, 'the rewrite produced a result rather than falling back');
  assert.equal(result.container, 'mkv');
  assert.equal(result.ext, 'mkv');
  assert.equal(result.mime, 'video/x-matroska');
  assert.equal(result.blob.type, 'video/x-matroska');
  assert.equal(result.videoCodec, 'vp9');
  assert.equal(result.audioCodec, 'opus');
  assert.equal(result.droppedTracks, 0);

  const after = await readContainer(await result.blob.arrayBuffer());
  // (b) the output re-opens as the target container (Matroska, distinct from the WebM
  // subset it came from) with the same tracks and codecs.
  assert.equal(after.format, mb.MATROSKA, 'the rewrite re-opens as MKV, not WebM');
  assert.equal(after.videoCodec, 'vp9');
  assert.equal(after.audioCodec, 'opus');

  // (a) every kept track's encoded packets are byte-identical to the source's - no
  // sample was touched.
  assert.equal(packetsEqual(before.video, after.video), true, 'video packets equal the source');
  assert.equal(packetsEqual(before.audio, after.audio), true, 'audio packets equal the source');
  assert.equal(packetsEqual(src.video, after.video), true, 'video packet bodies survive verbatim');
  assert.equal(packetsEqual(src.audio, after.audio), true, 'audio packet bodies survive verbatim');

  // (c) the HDR colour space is carried onto the output unchanged, and both the source
  // and the rewrite read back as HDR.
  assert.deepEqual(after.colorSpace, HDR_COLOR_SPACE, 'the HDR colour space is preserved intact');
  assert.deepEqual(after.colorSpace, before.colorSpace, 'the rewrite matches the source colour space');
  assert.equal(before.hdr, true, 'the source is HDR');
  assert.equal(after.hdr, true, 'the rewrite stays HDR');
});

// Codec legality gate: dropped-or-null --------------------------------------------

test('transmuxContainer: an AAC track illegal in WebM is dropped while the legal VP9 video is kept', async () => {
  const src = await makeSource({
    format: new mb.MkvOutputFormat(),
    video: { codec: 'vp9', config: { codec: 'vp09.02.10.10', codedWidth: 16, codedHeight: 16, colorSpace: HDR_COLOR_SPACE } },
    audio: { codec: 'aac', config: { codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: 48000, description: AAC_ASC } },
    frames: 3,
  });

  const result = await transmuxContainer(new mb.BlobSource(new Blob([src.bytes])), 'webm');
  assert.ok(result, 'the rewrite keeps the legal video and proceeds');
  assert.equal(result.container, 'webm');
  assert.equal(result.videoCodec, 'vp9');
  assert.equal(result.audioCodec, null, 'the AAC audio was dropped, not kept');
  assert.ok(result.droppedTracks >= 1, 'the dropped AAC track is counted');

  const after = await readContainer(await result.blob.arrayBuffer());
  assert.equal(after.format, mb.WEBM, 'the output is a valid WebM');
  assert.equal(after.videoCodec, 'vp9');
  assert.equal(after.audioCodec, null, 'the WebM has no audio track');
  // The kept video is still byte-identical - dropping the audio did not touch it.
  assert.equal(packetsEqual(src.video, after.video), true, 'the kept video is byte-identical');
});

test('transmuxContainer: a source whose only track is illegal in the target returns null', async () => {
  // An AAC-only MKV into WebM: WebM cannot carry AAC and there is no video to keep, so
  // there is nothing legal to write and the caller must fall back.
  const src = await makeSource({
    format: new mb.MkvOutputFormat(),
    audio: { codec: 'aac', config: { codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: 48000, description: AAC_ASC } },
    frames: 3,
  });
  const result = await transmuxContainer(new mb.BlobSource(new Blob([src.bytes])), 'webm');
  assert.equal(result, null, 'no legal track to write means fall back, not an empty file');
});

// The fall-back triggers ----------------------------------------------------------

test('transmuxContainer: a rewrite into the source container is refused (nothing to do)', async () => {
  const src = await makeSource({
    format: new mb.WebMOutputFormat(),
    video: { codec: 'vp9', config: { codec: 'vp09.02.10.10', codedWidth: 16, codedHeight: 16, colorSpace: HDR_COLOR_SPACE } },
    frames: 2,
  });
  const result = await transmuxContainer(new mb.BlobSource(new Blob([src.bytes])), 'webm');
  assert.equal(result, null, 'WebM into WebM has nothing to copy');
});

test('transmuxContainer: a source it cannot read returns null (fall back), never throws', async () => {
  const garbage = await transmuxContainer(new mb.BlobSource(new Blob([new Uint8Array([0, 1, 2, 3, 4, 5])])), 'mkv');
  assert.equal(garbage, null, 'an unreadable source falls back rather than failing');

  const empty = await transmuxContainer(new mb.BlobSource(new Blob([])), 'mkv');
  assert.equal(empty, null);
});

test('transmuxContainer: a genuine cancel throws an AbortError rather than falling back', async () => {
  const src = await makeSource({
    format: new mb.WebMOutputFormat(),
    video: { codec: 'vp9', config: { codec: 'vp09.02.10.10', codedWidth: 16, codedHeight: 16, colorSpace: HDR_COLOR_SPACE } },
    audio: { codec: 'opus', config: { codec: 'opus', numberOfChannels: 2, sampleRate: 48000, description: opusHead() } },
    frames: 4,
  });
  // Cancelled from the first check, before any packet is written.
  await assert.rejects(
    () => transmuxContainer(new mb.BlobSource(new Blob([src.bytes])), 'mkv', { isCancelled: () => true }),
    (e: Error) => e.name === 'AbortError',
    'a cancel surfaces as an AbortError, not a silent null fall-back',
  );
});
