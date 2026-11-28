// SPDX-License-Identifier: MPL-2.0
/**
 * WP-F soft subtitle track (plan 153 accessibility, default-on).
 *
 * When a transcript VTT is threaded through the WebCodecs mux path, mediabunny should
 * embed a SOFT (player-toggleable) WebVTT subtitle track into the mp4/webm, IN ADDITION
 * to any burned-in captions. These tests drive the REAL muxer (defaultMuxerFactory →
 * buildMediabunnyMux, which threads EncodeOpts.subtitlesVtt → MuxSpec.subtitlesVtt) with
 * NO video packets - a declared-but-packet-less video track finalizes fine - so the
 * subtitle wiring is exercised end-to-end in node, without WebCodecs.
 *
 * Verification is a BYTE-MARKER scan, not a demux: mediabunny's Input/getTracks demuxer
 * only surfaces video+audio tracks (its ISOBMFF reader handles handlerType 'vide'/'soun'
 * only, and the Matroska reader has no subtitle path), so a round-tripped subtitle track
 * comes back invisible. The container's own codec identifier is the ground truth instead:
 * ISOBMFF writes a `wvtt` sample-entry box, Matroska/WebM a `S_TEXT/WEBVTT` CodecID.
 *
 * The DETERMINISM GUARD (red-team trap 3) is the point of the without-transcript cases:
 * the sequence-render browser goldens carry no transcript, so the mux must add NO
 * subtitle track and the bytes must stay byte-for-byte identical to today. Asserted two
 * ways here - no marker leaks in, and mux-twice is byte-identical both with and without a
 * VTT.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/subtitle-track.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMuxerFactory, type EncodePick, type EncodeOpts } from './video-encode-core.ts';

const VTT = `WEBVTT

00:00:00.000 --> 00:00:02.000
Hello world

00:00:02.000 --> 00:00:04.000
Second cue
`;

/** The container codec identifier a real WebVTT track leaves in the bytes. */
const WEBVTT_MARKER: Record<'mp4' | 'webm', string> = { mp4: 'wvtt', webm: 'S_TEXT/WEBVTT' };

const PICK: Record<'mp4' | 'webm', EncodePick> = {
  mp4: { container: 'mp4', codec: 'avc1.42001f', muxCodec: 'avc' },
  webm: { container: 'webm', codec: 'vp09.00.10.08', muxCodec: 'V_VP9' },
};

/** Build the real muxer for `container`, feed NO packets, and return the finished bytes. */
async function mux(container: 'mp4' | 'webm', subtitlesVtt?: string): Promise<Uint8Array> {
  const opts: EncodeOpts = { width: 320, height: 240, fps: 30, bitrate: 1_000_000, subtitlesVtt };
  const { muxer, target } = await defaultMuxerFactory(PICK[container], opts);
  await muxer.finalize();
  assert.ok('buffer' in target && target.buffer, 'expected an in-memory BufferTarget');
  return new Uint8Array(target.buffer as ArrayBuffer);
}

/** Does `haystack` contain the ASCII `marker` bytes anywhere? */
function contains(haystack: Uint8Array, marker: string): boolean {
  const needle = new TextEncoder().encode(marker);
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

for (const container of ['mp4', 'webm'] as const) {
  test(`${container}: a soft webvtt track is embedded when subtitlesVtt is set`, async () => {
    const bytes = await mux(container, VTT);
    assert.ok(contains(bytes, WEBVTT_MARKER[container]), `${container} should carry a ${WEBVTT_MARKER[container]} subtitle track`);
  });

  test(`${container}: NO subtitle track without a transcript (determinism guard)`, async () => {
    const none = await mux(container);                // undefined ⇒ no track
    const empty = await mux(container, '');           // empty string ⇒ no track (non-empty gate)
    assert.ok(!contains(none, WEBVTT_MARKER[container]), 'no transcript must add no subtitle track');
    assert.ok(!contains(empty, WEBVTT_MARKER[container]), 'an empty transcript must add no subtitle track');
    // Belt and braces: an added track can only grow the file, so the guard also means
    // the transcript-less output is no larger than the transcript-carrying one.
    const withVtt = await mux(container, VTT);
    assert.ok(none.length < withVtt.length, 'the subtitle track should add bytes');
  });

  test(`${container}: mux is byte-identical across runs (both with and without a VTT)`, async () => {
    const [a, b] = await Promise.all([mux(container, VTT), mux(container, VTT)]);
    assert.deepEqual(a, b, 'same VTT ⇒ byte-identical container');
    const [c, d] = await Promise.all([mux(container), mux(container)]);
    assert.deepEqual(c, d, 'no VTT ⇒ byte-identical container (the goldens must not drift)');
  });
}
