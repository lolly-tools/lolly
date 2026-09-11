// SPDX-License-Identifier: MPL-2.0
/**
 * WP-E - the lossless stream-copy (remux) engine (lib/audio-remux.ts).
 *
 * Run directly:  node --test shells/web/src/lib/audio-remux.test.ts
 *
 * Pure node, no jsdom: audio-remux.ts is DOM-free, and the copy it performs never
 * decodes anything, so its losslessness is verifiable with mediabunny alone. What is
 * pinned here:
 *   - the codec to container map picks the honest container, and returns null for a
 *     codec no container in the set can carry (the fall-back trigger),
 *   - a real Ogg Opus source stream-copies into a valid Ogg Opus file whose encoded
 *     packets are BYTE-IDENTICAL to the source's (the losslessness proof),
 *   - the output opens as a valid audio file with the expected codec and MIME,
 *   - a source mediabunny cannot read returns null (fall back to decode), not a throw.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mb from 'mediabunny';
import { pickAudioContainer, streamCopyAudio } from './audio-remux.ts';

/** Read every encoded packet's data (decode-free) from a container blob, plus its
 *  primary audio codec and decoder config. */
async function readPackets(bytes: ArrayBuffer): Promise<{ codec: string; data: Uint8Array[] }> {
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(new Blob([bytes])) });
  const track = await input.getPrimaryAudioTrack();
  assert.ok(track, 'the container has a primary audio track');
  const codec = await track.getCodec();
  const sink = new mb.EncodedPacketSink(track);
  const data: Uint8Array[] = [];
  for await (const packet of sink.packets()) data.push(packet.data);
  input.dispose();
  return { codec: codec as string, data };
}

/** true when two lists of packet byte arrays are identical, else a description of
 *  the first difference. */
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

/** A minimal, valid OpusHead identification header (19 bytes), so mediabunny's Ogg
 *  muxer can build a well-formed stream from our synthetic packets. */
function opusHead(channels = 1, sampleRate = 48000): Uint8Array {
  const b = new Uint8Array(19);
  b.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
  b[8] = 1;                 // version
  b[9] = channels;          // channel count
  b[10] = 0; b[11] = 0;     // pre-skip (LE)
  b[12] = sampleRate & 0xff; b[13] = (sampleRate >> 8) & 0xff;
  b[14] = (sampleRate >> 16) & 0xff; b[15] = (sampleRate >> 24) & 0xff;
  b[16] = 0; b[17] = 0;     // output gain
  b[18] = 0;                // channel mapping family
  return b;
}

/** Build a source Ogg Opus file from N synthetic Opus packets with known bytes, and
 *  return both the container bytes and the packet payloads we fed in. */
async function makeOggOpusSource(n: number): Promise<{ bytes: ArrayBuffer; bodies: Uint8Array[] }> {
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.OggOutputFormat(), target });
  const source = new mb.EncodedAudioPacketSource('opus');
  output.addAudioTrack(source);
  await output.start();
  const meta = { decoderConfig: { codec: 'opus', numberOfChannels: 1, sampleRate: 48000, description: opusHead() } };
  const bodies: Uint8Array[] = [];
  let ts = 0;
  const dur = 0.02; // 20 ms per packet
  for (let p = 0; p < n; p++) {
    const body = new Uint8Array(8 + p);
    body[0] = 0xf8; // a plausible Opus TOC byte
    for (let i = 1; i < body.length; i++) body[i] = (p * 17 + i) & 0xff;
    bodies.push(body);
    await source.add(new mb.EncodedPacket(body, 'key', ts, dur), p === 0 ? meta : undefined);
    ts += dur;
  }
  await output.finalize();
  return { bytes: target.buffer!, bodies };
}

// ── the codec to container map ─────────────────────────────────────────────────

test('pickAudioContainer maps the broadly playable codecs to honest containers', () => {
  assert.deepEqual(pickAudioContainer('aac'), { format: 'mp4', ext: 'm4a', mime: 'audio/mp4', c2paFormat: 'm4a' });
  assert.deepEqual(pickAudioContainer('opus'), { format: 'ogg', ext: 'opus', mime: 'audio/ogg', c2paFormat: 'opus' });
  assert.deepEqual(pickAudioContainer('vorbis'), { format: 'ogg', ext: 'ogg', mime: 'audio/ogg', c2paFormat: 'ogg' });
  assert.deepEqual(pickAudioContainer('mp3'), { format: 'mp3', ext: 'mp3', mime: 'audio/mpeg', c2paFormat: 'mp3' });
  assert.deepEqual(pickAudioContainer('flac'), { format: 'flac', ext: 'flac', mime: 'audio/flac', c2paFormat: null });
  assert.equal(pickAudioContainer('pcm-s16')!.format, 'wav');
  assert.equal(pickAudioContainer('pcm-f32')!.ext, 'wav');
});

test('pickAudioContainer returns null for a codec no container can carry (the fall-back trigger)', () => {
  // AC-3, E-AC-3, mu-law and a-law are deliberately left to the decode fallback.
  assert.equal(pickAudioContainer('ac3'), null);
  assert.equal(pickAudioContainer('eac3'), null);
  assert.equal(pickAudioContainer('ulaw'), null);
  assert.equal(pickAudioContainer('alaw'), null);
  assert.equal(pickAudioContainer('nonsense'), null);
});

// ── losslessness + validity ────────────────────────────────────────────────────

test('streamCopyAudio: an Ogg Opus source copies to a valid Ogg Opus file, byte-lossless', async () => {
  const { bytes, bodies } = await makeOggOpusSource(4);
  const source = await readPackets(bytes);
  assert.equal(source.codec, 'opus');

  const result = await streamCopyAudio(new Blob([bytes]));
  assert.ok(result, 'the copy produced a result rather than falling back');
  // (a) the output declares the right codec, extension and MIME.
  assert.equal(result.codec, 'opus');
  assert.equal(result.ext, 'opus');
  assert.equal(result.mime, 'audio/ogg');
  assert.equal(result.blob.type, 'audio/ogg');

  // (b) the output opens as a valid audio file and its encoded packets are
  // byte-identical to the source's - the copy touched no sample.
  const out = await readPackets(await result.blob.arrayBuffer());
  assert.equal(out.codec, 'opus', 'the remux re-opens as valid Opus');
  assert.equal(packetsEqual(source.data, out.data), true, 'output packets equal source packets');

  // And the essence the source carried survives intact (the audio bodies we fed in
  // are present verbatim among the read packets).
  const outConcat = Buffer.concat(out.data.map((d) => Buffer.from(d)));
  for (const body of bodies) {
    assert.ok(outConcat.includes(Buffer.from(body)), 'each source Opus packet body is present verbatim');
  }
});

test('streamCopyAudio: duration is reported from the source', async () => {
  const { bytes } = await makeOggOpusSource(5);
  const result = await streamCopyAudio(new Blob([bytes]));
  assert.ok(result);
  // 5 packets x 20 ms = 0.1 s, within a small tolerance.
  assert.ok(Math.abs(result.durationSec - 0.1) < 0.03, `duration ~0.1s, got ${result.durationSec}`);
});

// ── fall-back trigger ──────────────────────────────────────────────────────────

test('streamCopyAudio: a source it cannot read returns null (fall back to decode), never throws', async () => {
  const garbage = new Blob([new Uint8Array([0, 1, 2, 3, 4, 5])]);
  const result = await streamCopyAudio(garbage);
  assert.equal(result, null, 'an unreadable source falls back rather than failing');

  const empty = await streamCopyAudio(new Blob([]));
  assert.equal(empty, null);
});

test('streamCopyAudio: a genuine cancel throws an AbortError rather than falling back', async () => {
  const { bytes } = await makeOggOpusSource(4);
  // Cancelled from the very first check, before any packet is written.
  await assert.rejects(
    () => streamCopyAudio(new Blob([bytes]), { isCancelled: () => true }),
    (e: Error) => e.name === 'AbortError',
    'a cancel surfaces as an AbortError, not as a silent null fall-back',
  );
});
