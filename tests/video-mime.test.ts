// SPDX-License-Identifier: MPL-2.0
// Contract tests for the web shell's MediaRecorder mimetype ordering
// (shells/web/src/bridge/video-mime.js). DOM-free by design — same pattern as
// export-size.test.js: the ordering logic is pure so it can be asserted here;
// the isTypeSupported() probe stays in export.js and needs a real browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEBM_CODECS, MP4_CODECS, WEBM_AUDIO_CODECS, MP4_AUDIO_CODECS,
  videoMimeCandidates,
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
