// SPDX-License-Identifier: MPL-2.0
/**
 * #/convert AV column (plan 153 WP-H) - the target-offer logic for an uploaded video.
 *
 * Only the PURE decision (`transmuxTargetsFor`) is pinned here: which container
 * rewrites are offered for a given track set, that a rewrite into the source's own
 * container is refused, and that MP4 leads. The mediabunny probe that feeds it and the
 * copy engines it drives are proven in lib/transmux.test.ts / lib/extract-audio.test.ts
 * against real containers; there is no honest way to build one under plain node, so the
 * `legal` predicate is injected here to model each container's real codec allowances.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/convert-av.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { transmuxTargetsFor, type VideoProbe } from './convert.ts';

/** A `legal` predicate modelling the real container/codec allowances the four output
 *  formats report: mp4/mov/mkv (ISO base media + Matroska) carry the common web codecs;
 *  webm is the vp8/vp9/av1 + opus/vorbis subset, and rejects h264/h265/aac. */
const legal = (target: 'mp4' | 'mov' | 'mkv' | 'webm', kind: 'video' | 'audio', codec: string): boolean => {
  if (target === 'webm') {
    return kind === 'video' ? ['vp8', 'vp9', 'av1'].includes(codec) : ['opus', 'vorbis'].includes(codec);
  }
  // mp4/mov/mkv: carry everything in these fixtures (h264/h265/vp9/av1 + aac/opus).
  return true;
};

test('an MP4 (H.264 + AAC) offers MOV and MKV, never MP4 itself, and not WebM (H.264 is illegal there)', () => {
  const probe: VideoProbe = { container: 'mp4', hasVideo: true, videoCodec: 'avc', audioCodecs: ['aac'] };
  // 'avc' is mediabunny's name for H.264; the injected legal() carries it in iso, not webm.
  const isoLegal = (t: 'mp4' | 'mov' | 'mkv' | 'webm', kind: 'video' | 'audio', codec: string): boolean =>
    t === 'webm' ? false : legal(t, kind, codec);
  assert.deepEqual(transmuxTargetsFor(probe, isoLegal), ['mov', 'mkv']);
});

test('a WebM (VP9 + Opus) offers MP4, MOV, MKV (all legal), never WebM itself - MP4 leads', () => {
  const probe: VideoProbe = { container: 'webm', hasVideo: true, videoCodec: 'vp9', audioCodecs: ['opus'] };
  assert.deepEqual(transmuxTargetsFor(probe, legal), ['mp4', 'mov', 'mkv']);
});

test('container-into-itself is always refused (nothing to copy)', () => {
  const probe: VideoProbe = { container: 'mkv', hasVideo: true, videoCodec: 'vp9', audioCodecs: ['opus'] };
  assert.ok(!transmuxTargetsFor(probe, legal).includes('mkv'));
});

test('a source with a picture whose codec no target can carry offers nothing (video must be kept)', () => {
  // hasVideo but a codec the injected legal() rejects everywhere: transmuxContainer
  // returns null in this case rather than write an audio-only file, so no target is offered.
  const probe: VideoProbe = { container: 'mp4', hasVideo: true, videoCodec: 'theora', audioCodecs: ['opus'] };
  assert.deepEqual(transmuxTargetsFor(probe, () => false), []);
});

test('a video track whose codec mediabunny could not name offers nothing', () => {
  const probe: VideoProbe = { container: 'mp4', hasVideo: true, videoCodec: null, audioCodecs: ['aac'] };
  assert.deepEqual(transmuxTargetsFor(probe, legal), []);
});

test('an audio-only source is gated on the audio codec being carriable, MP4 first', () => {
  const probe: VideoProbe = { container: 'webm', hasVideo: false, videoCodec: null, audioCodecs: ['opus'] };
  // Opus is legal in every target here, so all but the source container are offered.
  assert.deepEqual(transmuxTargetsFor(probe, legal), ['mp4', 'mov', 'mkv']);

  // AAC-only: illegal in WebM, so WebM drops out even though it is not the source.
  const aac: VideoProbe = { container: 'mov', hasVideo: false, videoCodec: null, audioCodecs: ['aac'] };
  assert.deepEqual(transmuxTargetsFor(aac, legal), ['mp4', 'mkv']);
});
