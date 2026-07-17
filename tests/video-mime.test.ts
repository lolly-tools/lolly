// SPDX-License-Identifier: MPL-2.0
// Contract tests for the web shell's MediaRecorder mimetype ordering
// (shells/web/src/bridge/video-mime.js). DOM-free by design — same pattern as
// export-size.test.js: the ordering logic is pure so it can be asserted here;
// the isTypeSupported() probe stays in export.js and needs a real browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEBM_CODECS, MP4_CODECS, WEBM_AUDIO_CODECS, MP4_AUDIO_CODECS,
  videoMimeCandidates, videoBitrate, LIVE_BITS_PER_PIXEL,
} from '../shells/web/src/bridge/video-mime.ts';

test('silent candidates prefer the requested container, then fall back', () => {
  assert.deepEqual(videoMimeCandidates('webm'), [...WEBM_CODECS, ...MP4_CODECS]);
  assert.deepEqual(videoMimeCandidates('mp4'),  [...MP4_CODECS, ...WEBM_CODECS]);
  // Unknown/absent preference behaves like webm (matches videoMimeType's historic default).
  assert.deepEqual(videoMimeCandidates(undefined as unknown as string), [...WEBM_CODECS, ...MP4_CODECS]);
});

test('audio candidates never pin video-only codecs', () => {
  for (const preferred of ['webm', 'mp4']) {
    const candidates = videoMimeCandidates(preferred, { audio: true });
    for (const mime of candidates) {
      const codecs = /codecs=([^;]*)/.exec(mime)?.[1];
      // Either a bare container (recorder picks its default audio codec) or a
      // codec list that names an audio codec — a video-only pin can make
      // MediaRecorder throw NotSupportedError when the stream carries audio.
      if (codecs) assert.match(codecs, /opus|mp4a|aac/, `${mime} pins video-only codecs`);
    }
  }
});

test('audio candidates prefer the requested container and cover both', () => {
  assert.deepEqual(videoMimeCandidates('webm', { audio: true }), [...WEBM_AUDIO_CODECS, ...MP4_AUDIO_CODECS]);
  assert.deepEqual(videoMimeCandidates('mp4',  { audio: true }), [...MP4_AUDIO_CODECS, ...WEBM_AUDIO_CODECS]);
});

test('every candidate is a well-formed video/* mimetype', () => {
  const all = [
    ...videoMimeCandidates('webm'), ...videoMimeCandidates('mp4'),
    ...videoMimeCandidates('webm', { audio: true }), ...videoMimeCandidates('mp4', { audio: true }),
  ];
  for (const mime of all) assert.match(mime, /^video\/(webm|mp4)(;codecs=[\w.,]+)?$/);
});

test('videoBitrate scales with pixels × fps and clamps to 1–24 Mbps', () => {
  // 1080p30 at the offline default: 1920×1080×30×0.1 ≈ 6.2 Mbps — inside the clamp.
  assert.equal(videoBitrate(1920, 1080, 30), Math.round(1920 * 1080 * 30 * 0.1));
  // Tiny clip floors at 1 Mbps rather than a degenerate rate.
  assert.equal(videoBitrate(64, 64, 10), 1_000_000);
  // Runaway request (URL-driven 4K60) ceilings at 24 Mbps.
  assert.equal(videoBitrate(3840, 2160, 60), 24_000_000);
  // Zero/absent dimensions still yield a sane floor, never 0 or NaN.
  assert.equal(videoBitrate(0, 0, 0), 1_000_000);
});

test('live capture tier outbids the offline default for the same geometry', () => {
  const live = videoBitrate(1920, 1080, 30, LIVE_BITS_PER_PIXEL);
  assert.equal(live, Math.round(1920 * 1080 * 30 * LIVE_BITS_PER_PIXEL));
  assert.ok(live > videoBitrate(1920, 1080, 30), 'live tier must exceed the offline default');
  assert.ok(live <= 24_000_000, 'live tier still respects the ceiling');
});
