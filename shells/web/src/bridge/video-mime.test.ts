// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the DOM-free video-encode scheduling - the timestamp / keyframe /
 * PCM-chunk math the WebCodecs encode loop (export.ts) and a future worker-side encoder
 * both consume. The real VideoEncoder/AudioEncoder run only in a browser; this pins the
 * pure schedule they're driven by.
 *
 * Run directly:  node --test shells/web/src/bridge/video-mime.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoBitrate, bppForQuality, codecBitrateScale, codecAdjustedBitrate, videoFrameSchedule, audioChunkSchedule, videoFramePlan, FPS_FLOOR } from './video-mime.ts';

test('videoBitrate: scales with pixels×fps, clamped to 1–24 Mbps', () => {
  assert.equal(videoBitrate(1, 1, 1), 1_000_000);              // floor
  assert.equal(videoBitrate(10000, 10000, 60), 24_000_000);    // ceiling
  assert.equal(videoBitrate(1920, 1080, 30), Math.round(1920 * 1080 * 30 * 0.1));
});

test('bppForQuality: three stops, balanced == the historical flat 0.1', () => {
  assert.equal(bppForQuality('balanced'), 0.1);
  assert.ok(bppForQuality('smaller') < bppForQuality('balanced'));
  assert.ok(bppForQuality('best') > bppForQuality('balanced'));
});

test('codecBitrateScale: modern codecs get fewer bits; H.264/VP8 unchanged', () => {
  assert.equal(codecBitrateScale('avc1.640033'), 1.0);
  assert.equal(codecBitrateScale('vp8'), 1.0);
  assert.ok(codecBitrateScale('av01.0.08M.08') < codecBitrateScale('hvc1.1.6.L93.B0'));   // AV1 < HEVC
  assert.ok(codecBitrateScale('hvc1.1.6.L93.B0') < codecBitrateScale('vp09.00.10.08'));   // HEVC < VP9
  assert.ok(codecBitrateScale('vp09.00.10.08') < 1.0);                                    // VP9 < H.264
});

test('codecAdjustedBitrate: trims by codec, never below the 1 Mbps floor', () => {
  const base = videoBitrate(1920, 1080, 30);                   // ~6.22 Mbps, above the floor
  assert.equal(codecAdjustedBitrate(base, 'avc1.640033'), base);            // H.264 unchanged
  assert.equal(codecAdjustedBitrate(base, 'av01.0.08M.08'), Math.round(base * 0.55));
  assert.equal(codecAdjustedBitrate(2_000_000, 'av01.0.08M.08'), Math.max(1_000_000, Math.round(2_000_000 * 0.55)));
  assert.equal(codecAdjustedBitrate(1_000_000, 'av01.0.08M.08'), 1_000_000);  // floor holds after the trim
});

test('videoFrameSchedule: µs timestamps + ~2s keyframe cadence', () => {
  const s = videoFrameSchedule(50, 24);
  assert.equal(s.length, 50);
  assert.deepEqual(s[0], { index: 0, timestampUs: 0, durationUs: Math.round(1e6 / 24), keyFrame: true });
  assert.equal(s[1]!.timestampUs, Math.round(1e6 / 24));
  // keyEvery = round(24*2) = 48 → keyframes at 0 and 48 only
  assert.deepEqual(s.filter((t) => t.keyFrame).map((t) => t.index), [0, 48]);
});

test('videoFrameSchedule: 0 frames → [], fps floored at 1', () => {
  assert.deepEqual(videoFrameSchedule(0, 30), []);
  assert.equal(videoFrameSchedule(1, 0)[0]!.durationUs, 1e6);   // fps clamped to 1
});

test('audioChunkSchedule: partitions frames, last chunk is the remainder', () => {
  const c = audioChunkSchedule(11_000, 48_000, 4800);
  assert.equal(c.length, 3);
  assert.deepEqual(c.map((x) => x.numFrames), [4800, 4800, 1400]);
  assert.equal(c[0]!.timestampUs, 0);
  assert.equal(c[1]!.timestampUs, Math.round((4800 / 48_000) * 1e6));
  assert.equal(c[2]!.offsetFrames, 9600);
});

test('audioChunkSchedule: exact multiple has no trailing empty chunk', () => {
  const c = audioChunkSchedule(9600, 48_000, 4800);
  assert.equal(c.length, 2);
  assert.equal(c[1]!.numFrames, 4800);
});

// ── videoFramePlan: the picture clock and the audio clock are the same clock ──
// The regression this pins: renderVideo used to clamp frameCount to the frame-buffer
// cap in place, while still handing tools a fraction normalised against the CLAMPED
// count. A tool that mapped that fraction onto its own analysed span (the audiogram's
// caption cues) therefore painted the WHOLE narration over a SHORT video whose audio
// bed had been cut to match the clamp. A 90 s read exported as 25 s of captions
// sprinting 3.6x ahead of the voice. Nothing failed, because the two clocks were
// computed in different files and no test compared them.

test('videoFramePlan: under the cap, nothing is touched', () => {
  const p = videoFramePlan(5, 24, 600);
  assert.deepEqual(p, { frameCount: 120, fps: 24, clipSec: 5, truncated: false });
});

test('videoFramePlan: clipSec always equals frameCount/fps (the invariant both clocks read)', () => {
  for (const dur of [0.5, 5, 25, 60, 90, 180, 600]) {
    for (const fps of [12, 24, 30, 60]) {
      for (const cap of [200, 600, 1800]) {
        const p = videoFramePlan(dur, fps, cap);
        assert.equal(p.clipSec, p.frameCount / p.fps, `clipSec disagrees at dur=${dur} fps=${fps} cap=${cap}`);
        assert.ok(p.frameCount <= cap, `frameCount ${p.frameCount} exceeds cap ${cap}`);
        assert.ok(p.fps >= FPS_FLOOR || p.fps === fps, `fps ${p.fps} fell below the floor`);
      }
    }
  }
});

test('videoFramePlan: a 90s narration keeps all 90 seconds - the frame rate gives way, not the tail', () => {
  // 90 s at 24 fps wants 2160 frames. The audio-driven ceiling is 1800 (600 × 3).
  const p = videoFramePlan(90, 24, 1800);
  assert.equal(p.truncated, false, 'a narration must not be silently cut short');
  assert.equal(p.clipSec, 90, `exported ${p.clipSec}s of a 90s clip`);
  assert.ok(p.fps < 24 && p.fps >= FPS_FLOOR, `expected a reduced frame rate, got ${p.fps}`);
});

test('videoFramePlan: the old bug - a capped clip is never time-compressed', () => {
  // Precisely the failing case: 90 s requested, the SILENT (unraised) 600-frame cap.
  const p = videoFramePlan(90, 24, 600);
  // Before the fix this produced 600 frames at 24 fps = 25 s of video, while the tool
  // still painted a 90 s caption track across it.
  assert.notEqual(p.clipSec, 25, 'clip was time-compressed into the cap instead of slowed or cut');
  assert.equal(p.clipSec, 90);
  assert.equal(p.fps, 6);
});

test('videoFramePlan: past the frame-rate floor it truncates honestly, as a prefix', () => {
  // 600 s at the 200-frame floor cannot hold 6 fps (1200 frames needed).
  const p = videoFramePlan(600, 24, 200);
  assert.equal(p.truncated, true);
  assert.equal(p.fps, FPS_FLOOR);
  assert.equal(p.clipSec, 200 / FPS_FLOOR);
  assert.ok(p.clipSec < 600, 'a truncated clip is shorter than requested');
  assert.equal(p.clipSec, p.frameCount / p.fps, 'even truncated, the two clocks agree');
});
