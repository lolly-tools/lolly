// SPDX-License-Identifier: MPL-2.0
/**
 * MediaRecorder mimetype candidates for the capture + video export paths
 * (export.ts's renders, bridge/recorder.ts's device takes).
 *
 * Kept DOM-free (no MediaRecorder probing here) so the ordering logic is
 * unit-testable in node - same split as views/export-size.js. export.js owns
 * the isTypeSupported() probe; this module owns which strings to try, in
 * which order.
 *
 * Audio: when a music bed is being muxed in, the mimetype must name (or at
 * least permit) an audio codec - some browsers throw NotSupportedError when
 * the stream carries an audio track but the mimeType pins video-only codecs.
 * So the audio candidates are audio-codec forms first, then the bare
 * containers (which let the recorder pick its default audio codec), and
 * never the video-only-pinned forms.
 */

export const WEBM_CODECS = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
// H.264 profiles, best→worst: High@4.0 (avc1.640028), Main@4.0 (avc1.4D0028), then
// the generic strings, then Constrained Baseline@3.0 (avc1.42E01E, ~720p ceiling) as
// the last resort. The recorder probe (isTypeSupported) picks the first the browser
// can actually encode, so 1080p output isn't pinned to Baseline where a better
// profile is available, and older browsers still fall back cleanly.
export const MP4_CODECS  = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.4D0028', 'video/mp4;codecs=h264', 'video/mp4;codecs=avc1', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'];

export const WEBM_AUDIO_CODECS = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
export const MP4_AUDIO_CODECS  = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4D0028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'];

/**
 * Ordered mimetype candidates, preferring the requested container
 * ('webm' | 'mp4') but falling back to the other so a deep-link/CLI request
 * still produces a video (Safari records mp4 only, Firefox webm only).
 */
export function videoMimeCandidates(preferred: string, { audio = false }: { audio?: boolean } = {}): string[] {
  const [first, second]: [string[], string[]] = audio
    ? [WEBM_AUDIO_CODECS, MP4_AUDIO_CODECS]
    : [WEBM_CODECS, MP4_CODECS];
  return preferred === 'mp4' ? [...second, ...first] : [...first, ...second];
}

// ── Audio-only capture (bridge/recorder.ts) ───────────────────────────────────
// A voice take's container is what its Content Credential is placed in, so this
// list is not free-floating: every string here must map through
// export.ts's captureContainer() to a CaptureFormat the engine can embed into,
// or the take ships unsigned. bridge/capture-clip-c2pa.test.ts asserts exactly
// that over these arrays, so adding a candidate that has no placer fails there
// rather than silently on a user's machine. (Firefox's own audio/ogg default is
// not listed - it is never requested, it is what the recorder reports back.)
export const AUDIO_WEBM_CODECS = ['audio/webm;codecs=opus', 'audio/webm'];
export const AUDIO_MP4_CODECS  = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];

/** Ordered audio-only mimetype candidates, preferring the requested container. */
export function audioMimeCandidates(preferred?: string): string[] {
  return preferred === 'mp4'
    ? [...AUDIO_MP4_CODECS, ...AUDIO_WEBM_CODECS]
    : [...AUDIO_WEBM_CODECS, ...AUDIO_MP4_CODECS];
}

// ── Encode bitrate ────────────────────────────────────────────────────────────
// Left to its defaults, MediaRecorder encodes at a flat browser default (~2.5 Mbps
// in Chromium) regardless of resolution - soft/blocky at 1080p+, and wasteful for a
// tiny clip. Scale the target with pixels × fps, clamped to 1–24 Mbps so a huge
// canvas can't request a runaway rate.
//   bitsPerPixel 0.1  (default) - offline tool renders: flat fills, text, few
//                                 gradients, frame-perfect delivery
//   bitsPerPixel 0.15 - live capture (screen/camera): real motion, one
//                                 take, no chance to re-render
export const LIVE_BITS_PER_PIXEL = 0.15;
export function videoBitrate(width: number, height: number, fps: number, bitsPerPixel = 0.1): number {
  const raw = Math.round(width * height * fps * bitsPerPixel);
  return Math.max(1_000_000, Math.min(raw, 24_000_000));
}

// ── Quality stops + codec efficiency (WP-B Decision 3) ────────────────────────
// The one bitrate authority the three-stop quality select drives. 'balanced' equals
// the historical flat 0.1 bits-per-pixel, so an export that does not choose a stop is
// byte-for-byte what it was. The base bitrate is CODEC-AGNOSTIC (the H.264-equivalent,
// which also probes the ladder); once a codec is picked, codecAdjustedBitrate trims it
// for that codec's efficiency, so AV1 reaches the same quality at fewer bytes instead
// of wasting bits at the H.264 rate.
export type VideoQuality = 'smaller' | 'balanced' | 'best';
const QUALITY_BPP: Record<VideoQuality, number> = { smaller: 0.06, balanced: 0.1, best: 0.16 };
export function bppForQuality(quality: VideoQuality): number { return QUALITY_BPP[quality]; }

/** Per-codec bitrate efficiency vs H.264 (=1.0): a modern codec reaches the same
 *  visual quality at fewer bits, so it is GIVEN fewer bits, not the same. AV1 and HEVC
 *  are the big wins, VP9 is between, VP8 is no better than H.264. Conservative (biased
 *  to preserve quality) and tunable against a visual A/B. */
export function codecBitrateScale(codec: string): number {
  if (codec.startsWith('av01')) return 0.55;
  if (codec.startsWith('hvc1') || codec.startsWith('hev1')) return 0.65;
  if (codec.startsWith('vp09') || codec.startsWith('vp9')) return 0.8;
  return 1.0; // avc / vp8
}

/** The codec-aware encode bitrate: the quality/size base scaled for the chosen codec's
 *  efficiency, never below 1 Mbps. Callers compute the base with videoBitrate, then
 *  adjust once a codec is picked. */
export function codecAdjustedBitrate(baseBitrate: number, codec: string): number {
  return Math.max(1_000_000, Math.round(baseBitrate * codecBitrateScale(codec)));
}

// ── WebCodecs encode scheduling (pure - DOM-free, unit-tested) ────────────────
// The per-frame timing + keyframe cadence for the WebCodecs video encode, and the audio
// PCM chunk boundaries, split out of the encode loop (export.ts encodeVideoWithWebCodecs)
// so the timestamp / keyframe / chunking math is verifiable without a real VideoEncoder - 
// and so a Worker-side encoder can reuse the exact same schedule. Same numbers as before.

/** One frame's encode timing: microsecond timestamp + duration, and whether it's a keyframe. */
export interface FrameTiming { index: number; timestampUs: number; durationUs: number; keyFrame: boolean }

/** Timestamps (µs) + a ~2s keyframe cadence for `frameCount` frames at `fps`. */
export function videoFrameSchedule(frameCount: number, fps: number): FrameTiming[] {
  const f = Math.max(1, fps);
  const keyEvery = Math.max(1, Math.round(f * 2));   // a keyframe roughly every 2s
  const durationUs = Math.round(1e6 / f);
  const out: FrameTiming[] = [];
  for (let i = 0; i < Math.max(0, frameCount); i++) {
    out.push({ index: i, timestampUs: Math.round(i * 1e6 / f), durationUs, keyFrame: i % keyEvery === 0 });
  }
  return out;
}

/** One audio PCM slice: start offset + length in frames, and its µs timestamp. */
export interface AudioChunkSpan { offsetFrames: number; numFrames: number; timestampUs: number }

/** Partition `totalFrames` of PCM into `chunkFrames`-sized spans with µs timestamps. */
export function audioChunkSchedule(totalFrames: number, sampleRate: number, chunkFrames: number): AudioChunkSpan[] {
  const out: AudioChunkSpan[] = [];
  const step = Math.max(1, chunkFrames);
  const sr = Math.max(1, sampleRate);
  for (let off = 0; off < totalFrames; off += step) {
    out.push({ offsetFrames: off, numFrames: Math.min(step, totalFrames - off), timestampUs: Math.round((off / sr) * 1e6) });
  }
  return out;
}

// ── The clip plan: one place where length, frame rate and frame count agree ──
// Phase 1 of renderVideo buffers every frame as an ImageBitmap before replay, so
// the frame count is the memory ceiling. It used to be clamped in place, which
// silently TIME-COMPRESSED the render: the frames were normalised `i / frameCount`
// against the CLAMPED count while the tool still mapped that fraction onto the
// full analysed span, so a 90 s narration painted its whole caption track over a
// 25 s video whose audio bed stopped a third of the way in. Nothing caught it
// because the two clocks were computed in different files.
//
// So the plan is computed once, here, in pure code that a node test can pin, and
// it degrades in a fixed order: raise the ceiling for audio-driven clips (a
// truncated narration is a worse failure than a slow export), then LOWER THE FRAME
// RATE rather than drop the tail, and only truncate when even the floor will not
// fit. Truncation stays possible - the memory ceiling is real - but it is now an
// honest prefix with `clipSec` telling the caller exactly what was kept.

/** The frame-rate floor. Below this the animation stops reading as animation. */
export const FPS_FLOOR = 6;

/** How much further an audio-driven clip may fill the frame buffer. A narration
 *  audiogram is worthless cut short, so it gets a longer leash than a silent
 *  render - scaled off the SAME memory signal, so a small device still gets a
 *  smaller number than a desktop. */
export const AUDIO_FRAME_HEADROOM = 3;

export interface ClipPlan {
  /** Frames to render. Never exceeds the (possibly raised) cap. */
  frameCount: number;
  /** The frame rate actually used - reduced from `fps` when that is what it took
   *  to keep the full duration. */
  fps: number;
  /** The exported clip's real length in seconds. The audio bed is rendered to
   *  exactly this, and the picture clock must agree with it. */
  clipSec: number;
  /** True when the tail had to be dropped even at FPS_FLOOR. The caller must say
   *  so somewhere a person will see it, not only through host.log. */
  truncated: boolean;
}

/**
 * Resolve `durationSec` at `fps` against a `maxFrames` buffer ceiling.
 *
 * The invariant every caller depends on: `clipSec === frameCount / fps`, and
 * `clipSec === durationSec` unless `truncated` is true. A tool asked to paint
 * normalised time `t` is at `t * clipSec` seconds - always, in every branch.
 */
export function videoFramePlan(durationSec: number, fps: number, maxFrames: number): ClipPlan {
  const wantFps = Math.max(1, fps);
  const dur = Math.max(0, durationSec);
  const cap = Math.max(1, Math.floor(maxFrames));

  const wanted = Math.ceil(dur * wantFps);
  if (wanted <= cap) return { frameCount: wanted, fps: wantFps, clipSec: wanted / wantFps, truncated: false };

  // Too many frames at the requested rate. Keep the whole clip by slowing the
  // frame rate - a choppy complete narration beats a smooth truncated one.
  const fitFps = Math.floor(cap / Math.max(dur, 1e-6));
  if (fitFps >= FPS_FLOOR) {
    const frameCount = Math.min(cap, Math.ceil(dur * fitFps));
    return { frameCount, fps: fitFps, clipSec: frameCount / fitFps, truncated: false };
  }

  // Even the floor will not fit. Truncate - but as a genuine prefix, with the
  // length reported back so the picture clock is cut to match the audio bed.
  return { frameCount: cap, fps: FPS_FLOOR, clipSec: cap / FPS_FLOOR, truncated: true };
}
