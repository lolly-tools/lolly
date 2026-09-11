// SPDX-License-Identifier: MPL-2.0
/**
 * Controlled WebCodecs recording path (plan 153 spike, Chromium-first).
 *
 * Everything the recorder captures today goes through MediaRecorder: the browser picks
 * the codec, the bitrate and the GOP, a WebM take is written with duration=Infinity, and
 * only Opus/AAC audio is on offer. This is the controlled alternative - one mediabunny
 * `Output` fed by `MediaStreamVideoTrackSource` / `MediaStreamAudioTrackSource`, where WE
 * choose the codec (AV1-leading, the SAME video-shared ladder the video EXPORT path uses),
 * the bitrate, a fixed ~2s keyframe interval, and - the point for provenance - the
 * CONTAINER up front. That last one is what stops the C2PA `CaptureFormat` mapping from
 * guessing off whatever mime MediaRecorder happened to choose.
 *
 * Same mediabunny `Mp4OutputFormat` / `WebMOutputFormat` writer the export path already
 * stamps AV1-in-mp4 through, so a take from here arrives in a container the capture
 * credential path already knows - a confirmation, not new placer work.
 *
 * Chromium-first by design: the whole path leans on `MediaStreamTrackProcessor` (mediabunny
 * pulls frames off the live track through it) plus the WebCodecs encoders, none of which
 * Safari/Firefox ship yet. `webCodecsRecorderAvailable()` is the gate; recorder.ts falls
 * back to MediaRecorder wherever it returns false (and while the owner sign-off switch is
 * still off).
 *
 * Lazy-imported from recorder.ts - NEVER static - so this module + video-shared +
 * mediabunny-mux stay out of the boot bundle recorder.ts rides. mediabunny itself is
 * `import()`ed inside the factory, as everywhere else.
 */
import type { AudioEncodingConfig, VideoEncodingConfig } from 'mediabunny';
import { pickWebCodecsAudio, pickWebCodecsVideo } from './video-shared.ts';
import { mapAudioCodec, mapVideoCodec } from './mediabunny-mux.ts';
import { codecAdjustedBitrate, LIVE_BITS_PER_PIXEL, videoBitrate } from './video-mime.ts';

/**
 * The encode+mux seam recorder.ts drives both engines through, structurally identical to
 * the MediaRecorder engine's shape (recorder.ts owns the canonical type). `type` is the
 * container mime the finished Blob carries - known UP FRONT here; `produceBlob()` finalizes
 * the container (promise-driven, vs MediaRecorder's onstop event); `abort()` discards it.
 */
export interface RecordEngine {
  readonly type: string;
  produceBlob(): Promise<Blob>;
  abort(): void;
}

const hasGlobal = (name: string): boolean =>
  typeof (globalThis as Record<string, unknown>)[name] !== 'undefined';

/**
 * The Chromium-first capability gate, CORRECT PER TRACK SET. `MediaStreamTrackProcessor` is
 * always required (it is how mediabunny reads the live track), but the encoders are gated by
 * what the take actually needs: a mic-only take needs no `VideoEncoder`, a muted screen take
 * no `AudioEncoder`. Requiring all three unconditionally would refuse both of the recorder's
 * real shapes - a deliberately conservative gate, but conservative per track set, not blind.
 * A take with neither track is not a recording.
 */
export function webCodecsRecorderAvailable(need: { wantVideo: boolean; wantAudio: boolean }): boolean {
  if (!need.wantVideo && !need.wantAudio) return false;
  if (!hasGlobal('MediaStreamTrackProcessor')) return false;
  if (need.wantVideo && !hasGlobal('VideoEncoder')) return false;
  if (need.wantAudio && !hasGlobal('AudioEncoder')) return false;
  return true;
}

/**
 * The Blob's container mime, decided UP FRONT. A video take derives its container from the
 * codec pick (the container the chosen codec is legal in); a mic-only take has NO video
 * pick, so its container is spelled out from the preferred format here - audio/mp4 (→ m4a)
 * or audio/webm, both of which `captureContainer` maps to a signable `CaptureFormat`.
 */
export function webCodecsContainerMime(kind: 'video' | 'audio', container: 'mp4' | 'webm'): string {
  return `${kind}/${container}`;
}

export interface WebCodecsRecorderOpts {
  wantVideo: boolean;
  /** Whether a live audio track is actually present (screen audio is opportunistic). */
  haveAudio: boolean;
  /** Preferred container hint (RecordOpts.format). */
  format?: 'webm' | 'mp4';
  /** A display capture, not a sensor - biases the video contentHint to 'text' for sharp screen text. */
  screen?: boolean;
}

/**
 * Build a controlled WebCodecs recorder over `stream`. Throws if a needed codec cannot be
 * picked or the `Output` will not start - recorder.ts catches that and falls back to
 * MediaRecorder on the still-live stream. The source tracks are NOT stopped here: recorder.ts
 * owns their lifetime and releases them after `produceBlob()` resolves.
 */
export async function createWebCodecsRecorder(stream: MediaStream, opts: WebCodecsRecorderOpts): Promise<RecordEngine> {
  const { wantVideo, haveAudio } = opts;
  const MB = await import('mediabunny');

  // ── Container + video codec (guarded behind wantVideo) ───────────────────────
  // The whole pickWebCodecsVideo call AND the container-from-pick derivation live inside
  // this branch, so a mic-only take never touches a null video pick (red-team #1).
  let container: 'mp4' | 'webm';
  let videoTrack: MediaStreamTrack | null = null;
  let videoConfig: VideoEncodingConfig | null = null;
  if (wantVideo) {
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error('webcodecs recorder: video requested but no video track');
    const s = track.getSettings?.() ?? {};
    const w = Math.round(s.width ?? 1280);
    const h = Math.round(s.height ?? 720);
    const fps = Math.round(s.frameRate ?? 30);
    const base = videoBitrate(w, h, fps, LIVE_BITS_PER_PIXEL);
    const preferred: 'mp4' | 'webm' = opts.format === 'webm' ? 'webm' : 'mp4';
    const pick = await pickWebCodecsVideo(preferred, w, h, fps, base);
    if (!pick) throw new Error('webcodecs recorder: no encodable video codec');
    container = pick.container;
    videoTrack = track;
    videoConfig = {
      codec: mapVideoCodec(pick.muxCodec),
      fullCodecString: pick.codec,
      bitrate: codecAdjustedBitrate(base, pick.codec),   // AV1 reaches the same quality at fewer bits
      keyFrameInterval: 2,                               // controlled ~2s GOP (MediaRecorder leaves it to the browser)
      latencyMode: 'realtime',                           // a live take can't re-render: drop frames under load, never stall
      // red-team #4: contentHint set ONCE here (this reaches the WebCodecs config), never
      // ALSO on the track. 'text' sharpens screen text; 'motion' suits a camera.
      contentHint: opts.screen ? 'text' : 'motion',
    };
  } else {
    // Mic-only: container is the preferred format, NOT derived from a (nonexistent) video
    // pick. audio/mp4 → m4a and audio/webm are both signable CaptureFormats (red-team #1).
    container = opts.format === 'mp4' ? 'mp4' : 'webm';
  }

  // ── Audio codec (video takes with a live audio track, and every mic-only take) ──
  let audioTrack: MediaStreamTrack | null = null;
  let audioConfig: AudioEncodingConfig | null = null;
  if (haveAudio) {
    const track = stream.getAudioTracks()[0];
    if (!track) throw new Error('webcodecs recorder: audio expected but no audio track');
    const apick = await pickWebCodecsAudio(container);
    if (!apick) throw new Error('webcodecs recorder: no encodable audio codec');
    audioTrack = track;
    audioConfig = { codec: mapAudioCodec(apick.muxCodec), bitrate: apick.bitrate };
  }

  // ── One Output, container known ──────────────────────────────────────────────
  const format = container === 'mp4'
    ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' })   // the exact writer/layout the export path stamps AV1-in-mp4 through
    : new MB.WebMOutputFormat();
  const target = new MB.BufferTarget();
  const output = new MB.Output({ format, target });
  // getVideoTracks/getAudioTracks hand back the generic MediaStreamTrack; the sources want the
  // kind-narrowed subtype, which the wantVideo/wantAudio gating already guarantees.
  if (videoTrack && videoConfig) output.addVideoTrack(new MB.MediaStreamVideoTrackSource(videoTrack as MediaStreamVideoTrack, videoConfig));
  if (audioTrack && audioConfig) output.addAudioTrack(new MB.MediaStreamAudioTrackSource(audioTrack as MediaStreamAudioTrack, audioConfig));

  try {
    await output.start();   // capture begins now, runs until finalize()/cancel()
  } catch (e) {
    await output.cancel().catch(() => { /* leave the track clean for the MediaRecorder fallback */ });
    throw e;
  }

  const containerMime = webCodecsContainerMime(wantVideo ? 'video' : 'audio', container);
  return {
    type: containerMime,
    async produceBlob(): Promise<Blob> {
      // ponytail: a rejected finalize() loses the whole take (no partial recovery from a
      // half-muxed Output); recorder.ts settles empty on reject, matching MediaRecorder's
      // cancel-on-throw. Acceptable for a Chromium-first spike behind a passed gate;
      // upgrade path is errorPromise-driven partial flush if a field failure shows up.
      await output.finalize();   // flush encoders + write the container
      const buf = (target as unknown as { buffer: ArrayBuffer }).buffer;
      return new Blob([buf], { type: containerMime });
    },
    abort(): void { output.cancel().catch(() => { /* already finalizing / canceled */ }); },
  };
}
