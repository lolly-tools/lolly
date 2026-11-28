// SPDX-License-Identifier: MPL-2.0
/**
 * Opus packet timing through the real mediabunny muxers.
 *
 * mediabunny 1.63 and later read and write an Opus packet's timestamp INCLUDING the
 * pre-skip: the first packet of a stream sits at minus the pre-skip. A WebCodecs
 * AudioEncoder stamps its packets with the input time instead, so the paths that hand
 * mediabunny raw encoder output move each packet back by the pre-skip
 * (opusTimestampFixer). Without that a sequence clip read back through mediabunny
 * starts 6.5 ms late, which is how a clip's pre-clipIn tone leaked into an export.
 *
 * Node has no WebCodecs, so a minimal EncodedAudioChunk stands in; mediabunny only
 * copies its bytes and reads its timing.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/mediabunny-mux-opus.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeChunk {
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration: number;
  readonly data: Uint8Array;
  constructor(init: { type: 'key' | 'delta'; timestamp: number; duration: number; data: Uint8Array }) {
    this.type = init.type; this.timestamp = init.timestamp; this.duration = init.duration; this.data = init.data;
  }
  get byteLength(): number { return this.data.byteLength; }
  copyTo(dst: Uint8Array): void { dst.set(this.data); }
}
const g = globalThis as Record<string, unknown>;
g.EncodedAudioChunk ??= class extends FakeChunk {};
g.EncodedVideoChunk ??= class extends FakeChunk {};

const MB = await import('mediabunny');
const { buildMediabunnyMux, opusPreSkipSeconds, opusTimestampFixer } = await import('./mediabunny-mux.ts');
const { defaultAudioMuxerFactory } = await import('../lib/audio-encode.ts');

/** An RFC 7845 identification header: mono, the given pre-skip, 48 kHz input. */
function opusHead(preSkip: number): Uint8Array {
  const b = new Uint8Array(19);
  b.set(new TextEncoder().encode('OpusHead'), 0);
  b[8] = 1; b[9] = 1;
  b[10] = preSkip & 0xff; b[11] = preSkip >> 8;
  new DataView(b.buffer).setUint32(12, 48_000, true);
  return b;
}

const META = { decoderConfig: { codec: 'opus', sampleRate: 48_000, numberOfChannels: 1, description: opusHead(312) } };

/** Ten 20 ms packets as a WebCodecs encoder emits them: input time, the OpusHead on the first. */
function encoderOutput(): Array<{ chunk: FakeChunk; meta: unknown }> {
  // TOC 0xF8: CELT fullband, 20 ms, one frame.
  return Array.from({ length: 10 }, (_, i) => ({
    chunk: new (g.EncodedAudioChunk as typeof FakeChunk)({ type: 'key', timestamp: i * 20_000, duration: 20_000, data: new Uint8Array([0xf8, 0xff, 0xfe, i]) }),
    meta: i === 0 ? META : undefined,
  }));
}

async function firstPacketTimestamp(bytes: Uint8Array): Promise<number> {
  const input = new MB.Input({ source: new MB.BufferSource(bytes), formats: MB.ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    assert.ok(track, 'the file has an audio track');
    const first = await new MB.EncodedPacketSink(track).getFirstPacket();
    assert.ok(first, 'the track has packets');
    return first.timestamp;
  } finally { input.dispose(); }
}

/** The value of the first CodecDelay element (ID 0x56AA, an unsigned integer), or null. */
function codecDelayNs(bytes: Uint8Array): number | null {
  for (let i = 0; i + 3 < bytes.length; i++) {
    if (bytes[i] !== 0x56 || bytes[i + 1] !== 0xaa || (bytes[i + 2]! & 0xf0) !== 0x80) continue;
    const size = bytes[i + 2]! & 0x0f;
    let value = 0;
    for (let j = 0; j < size; j++) value = value * 256 + bytes[i + 3 + j]!;
    return value;
  }
  return null;
}

test('opusPreSkipSeconds reads the pre-skip from an OpusHead, and nothing else', () => {
  assert.equal(opusPreSkipSeconds(META), 312 / 48_000);
  const padded = new Uint8Array(40);
  padded.set(opusHead(3840), 7);
  assert.equal(opusPreSkipSeconds({ decoderConfig: { description: padded.subarray(7, 26) } }), 3840 / 48_000, 'a view at an offset');
  assert.equal(opusPreSkipSeconds({ decoderConfig: { description: opusHead(312).buffer } }), 312 / 48_000, 'a bare ArrayBuffer');
  assert.equal(opusPreSkipSeconds({ decoderConfig: { description: new Uint8Array(19) } }), null, 'no OpusHead magic');
  assert.equal(opusPreSkipSeconds({ decoderConfig: {} }), null);
  assert.equal(opusPreSkipSeconds(undefined), null);
});

test('opusTimestampFixer moves every packet back by the pre-skip, on the sample grid', () => {
  const fix = opusTimestampFixer();
  const out = encoderOutput().map(({ chunk, meta }) => fix(MB.EncodedPacket.fromEncodedChunk(chunk as never), meta));
  assert.deepEqual(out.slice(0, 3).map((p) => Math.round(p.timestamp * 48_000)), [-312, 648, 1608]);
  assert.ok(out.every((p) => Math.abs(p.timestamp * 48_000 - Math.round(p.timestamp * 48_000)) < 1e-6), 'whole samples');
  assert.equal(out[0]!.duration, 0.02, 'durations are untouched');
  // A stream whose OpusHead never arrives is left as it came.
  const bare = opusTimestampFixer();
  const p = bare(MB.EncodedPacket.fromEncodedChunk(encoderOutput()[3]!.chunk as never), undefined);
  assert.equal(p.timestamp, 0.06);
});

test('a WebM from encoder output carries CodecDelay and reads back starting at the pre-skip', async () => {
  const { muxer, target } = await buildMediabunnyMux({ container: 'webm', audio: 'A_OPUS' });
  for (const { chunk, meta } of encoderOutput()) muxer.addAudioChunk(chunk, meta);
  await muxer.finalize();
  const bytes = new Uint8Array((target as { buffer: ArrayBuffer }).buffer);
  assert.equal(codecDelayNs(bytes), 6_500_000, 'CodecDelay equals the 6.5 ms pre-skip');
  // Matroska keeps whole milliseconds, so the reader floors the -6.5 ms start to -7 ms.
  const first = await firstPacketTimestamp(bytes);
  assert.ok(first <= -0.0065 && first > -0.0075, `first packet at ${first}`);
});

test('an Ogg from encoder output starts at minus the pre-skip and keeps the pre-skip', async () => {
  const { muxer, target } = await defaultAudioMuxerFactory('ogg', { codec: 'A_OPUS', numberOfChannels: 1, sampleRate: 48_000 });
  for (const { chunk, meta } of encoderOutput()) muxer.addAudioChunk(chunk, meta);
  await muxer.finalize();
  const bytes = new Uint8Array(target.buffer);
  assert.equal(Math.round((await firstPacketTimestamp(bytes)) * 48_000), -312);
  const head = new TextEncoder().encode('OpusHead');
  let at = -1;
  for (let i = 0; i + head.length <= bytes.length && at < 0; i++) if (head.every((v, j) => bytes[i + j] === v)) at = i;
  assert.ok(at >= 0, 'the Ogg carries its OpusHead');
  assert.equal(bytes[at + 10]! | (bytes[at + 11]! << 8), 312, 'the pre-skip is written as the encoder stated it');
});
