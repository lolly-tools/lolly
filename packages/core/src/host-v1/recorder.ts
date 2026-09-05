// SPDX-License-Identifier: MPL-2.0

import type { ExportMeta } from './export.ts';

// ─── Device capture / recorder (optional) ───────────────────────────────────────

export interface RecorderAPI {
  /**
   * Whether device capture of the given kind is usable right now (a secure context
   * exposing getUserMedia + MediaRecorder; for 'screen', getDisplayMedia). Sync +
   * cheap, so a shell can decide whether to offer a "record" affordance. `kind`
   * defaults to 'audio'. A `true` here does not pre-grant permission - the prompt
   * happens on meter.start()/record()/still().
   */
  isAvailable(kind?: 'audio' | 'video' | 'screen'): boolean;

  /**
   * Live input-level meter, DOM-free - a pre-record "sound check". Prompts for the
   * microphone on first start(), reference-counted + idempotent like MediaAPI. A web
   * shell opens it RAW (noiseSuppression/AGC/echoCancellation OFF, v1.19) so the level
   * and the noiseFloor/hum/hiss cues reflect the true room; the recording session
   * (record()) keeps suppression ON for a clean file, so the two use separate streams.
   * The grant is per-origin, so a sound-check then record() still prompts only once.
   */
  meter: MeterAPI;

  /**
   * Open a capture session (prompting for the requested devices the first time).
   * Resolves once the recorder is running; rejects if the user denies or a device
   * is missing (the shell surfaces the error). The returned session owns the
   * MediaStream + MediaRecorder; the engine only receives its live levels and,
   * on stop(), the finished Blob.
   */
  record(opts?: RecordOpts): Promise<RecordSession>;

  /**
   * Grab ONE still frame and resolve to its encoded bytes - a screenshot (v1.54).
   * Where record() opens a session that runs until stop(), this opens the source,
   * takes a single frame, and releases it immediately: the picker/permission is the
   * whole interaction, so there is nothing to stop() and no session to leak.
   *
   * `source: 'screen'` prompts the display picker (whole screen / a window / a tab -
   * the user's choice IS the selection, made by browser-native UI a page cannot
   * spoof or pre-answer) and is gated behind the `screen` capability. Rejects if the
   * user dismisses the picker (NotAllowedError) or the shell can't grab a frame.
   *
   * DOM-free like the rest of `recorder`: the shell owns the MediaStream and the
   * frame grab; the engine only ever receives the finished Blob.
   */
  still(opts?: StillOpts): Promise<Blob>;
}

export interface StillOpts {
  /**
   * What to photograph. 'screen' prompts the display picker; 'camera' takes a frame
   * from the camera. Default 'screen' - the camera path already has host.media.
   */
  source?: 'screen' | 'camera';
  /**
   * Encoded image type. Default 'image/png' - lossless, which is what a screenshot of
   * text and UI wants. A shell falls back to PNG where the type is unsupported, so read
   * the returned Blob's `type` rather than assuming.
   */
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  /** Quality 0..1 for the lossy types. Ignored for PNG. Default 0.97. */
  quality?: number;
  /** Downscale: longest edge in px. Omit for the source's native resolution (the default -
   *  a screenshot scaled down is a blurry screenshot). */
  maxEdge?: number;
  /** Provenance stamped into the finished Blob (best-effort, per format). */
  meta?: ExportMeta;
}

export interface MeterAPI {
  /**
   * Begin the mic + the level loop (prompting the first time). Resolves once levels
   * are flowing; rejects on denial / no mic. Reference-counted + idempotent:
   * concurrent callers share one stream, and the mic stops only when the matching
   * number of stop() calls arrive.
   * `opts.deviceId` (v1.154) sound-checks a SPECIFIC mic - it MUST be the same
   * device the following `record()` uses (RecordOpts.audioDeviceId), or the meter's
   * levels/noise floor describe a different mic than the take. Honoured only when
   * this start() creates the stream (a device switch is stop() then start()).
   */
  start(opts?: { deviceId?: string }): Promise<void>;
  /** Release one start() reference; the mic + loop stop when the last is released. */
  stop(): void;
  /**
   * Subscribe to audio-level frames. The shell computes each AudioLevel from an
   * AnalyserNode and pushes it on its own cadence (throttled; paused while the
   * document is hidden). Returns an unsubscribe function. Levels flow only while
   * the meter is start()ed.
   */
  subscribe(cb: (level: AudioLevel) => void): () => void;
}

/**
 * One audio-level sample - DOM-free, so the engine can hand it to a hook (the
 * audio counterpart to MediaFrame). All amplitudes are 0..1 linear except `dbfs`.
 */
export interface AudioLevel {
  /** Short-window RMS (loudness), 0..1 linear. The value a VU-style bar tracks. */
  rms: number;
  /** Instantaneous peak amplitude over the window, 0..1 linear. */
  peak: number;
  /** Peak in decibels-relative-to-full-scale: 20·log10(peak). 0 = clip, −∞ = silence. */
  dbfs: number;
  /** True while `peak` sits at/above the clipping threshold (~0.99) - drives a "too hot" warning. */
  clipping: boolean;
  /**
   * Estimated background-noise floor in dBFS - a slow min-hold of the loudness over a
   * few seconds (the level in the quiet gaps). −∞ = silence. Only trustworthy from a
   * RAW meter (the sound-check runs the mic with noiseSuppression/AGC OFF); a recording
   * session runs them ON for a clean file, so its floor reads artificially low.
   * Optional (added v1.19); undefined on shells that don't compute spectral levels.
   */
  noiseFloor?: number;
  /** Signal-to-noise ratio in dB = current RMS loudness − noiseFloor (like-with-like, both RMS). Low (≲15 dB) = noisy room. Optional (v1.19). */
  snr?: number;
  /** 0..1 share of energy in the mains bands (50/60 Hz + harmonics) - tonal electrical HUM / ground loop. Optional (v1.19). */
  hum?: number;
  /** 0..1 spectral flatness (geometric/arithmetic mean of the magnitude spectrum) - broadband HISS (fan/HVAC). Optional (v1.19). */
  hiss?: number;
  /**
   * 0..1 STEADINESS of the loudness envelope over ~1.5s - how constant the RMS is. ~1 =
   * a steady drone (a fan / AC / HVAC / broadband hiss holds a near-constant RMS); ~0 = a
   * modulated signal (speech, whose syllables make the RMS peak and dip). Lets coaching
   * tell background NOISE from SPEECH independent of level - a constant mid-level hiss no
   * longer reads as "speaking". Optional (v1.20). */
  steady?: number;
  /** Monotonic timestamp (ms) of the sample, matching MediaFrame.t. */
  t: number;
}

export interface RecordOpts {
  /**
   * Where the video track comes from (v1.54). 'device' = the camera (getUserMedia);
   * 'screen' = the display picker (getDisplayMedia - whole screen / a window / a tab,
   * chosen in browser-native UI), gated behind the `screen` capability. Default
   * 'device', so every pre-1.54 caller keeps its exact behaviour. Ignored when
   * `video` is false: there is no such thing as an audio-only screen.
   */
  source?: 'device' | 'screen';
  /** Capture the microphone. Default true. */
  audio?: boolean;
  /** Capture the camera (or, with source:'screen', the display) - an audio+video clip.
   *  Default false (audio-only). */
  video?: boolean;
  /**
   * Also capture the source's own audio - tab/system sound (v1.54). Only meaningful
   * with source:'screen'; the user grants it in the SAME picker as the video (there is
   * no separate prompt), and may withhold it, so the finished clip can be silent even
   * with this true. Mixed with the mic track when `audio` is also true, so a narrated
   * screen recording is one track. Ignored for source:'device'. Default false.
   *
   * Platform reality this cannot paper over: system-wide audio is Chromium-on-
   * Windows/ChromeOS only; elsewhere the user gets tab audio (Chromium) or nothing
   * (Safari/Firefox). Never promise the user sound you can't know you'll get.
   */
  systemAudio?: boolean;
  /**
   * Preferred container. The shell falls back across containers exactly like the
   * video-export path (a browser that can't encode the requested one uses what it
   * can), so this is a hint, not a guarantee - read the returned Blob's `type`.
   */
  format?: 'webm' | 'mp4';
  /** Video downscale: longest edge in px (mirrors MediaAPI subscribe maxEdge). Ignored for audio-only. */
  maxEdge?: number;
  /** Which camera to prefer for a video capture (v1.21). 'user' (front/selfie, default) or
   *  'environment' (rear). Ignored for audio-only and for source:'screen'; falls back to any
   *  camera if unavailable. */
  facingMode?: 'user' | 'environment';
  /**
   * v1.165 - a target FRAME for a camera take: the shell cover-crops and scales the
   * camera into a canvas of exactly this size and records THAT, so the clip matches a
   * target such as the artboard's export dimensions instead of whatever the camera
   * natively produces (a 4:3 webcam into a 9:16 story, say). Video only; the live
   * self-view (where the shell offers one) shows the same framing the file gets.
   * Ignored when either side is not a positive integer. Costs one canvas redraw per
   * frame, so it is asked for by the caller that needs an exact size, never assumed.
   */
  frame?: { width: number; height: number };
  /** Which microphone to record from (v1.154, device picker) - a specific
   *  `deviceId`, else the platform default. Pairs with `MeterAPI.start({deviceId})`:
   *  a sound-check meter MUST open the SAME mic as the take, or its levels describe
   *  a different device. Ignored where the shell can't select a mic. */
  audioDeviceId?: string;
  /** Hard ceiling on clip length in ms; the session auto-stops when reached. */
  maxMs?: number;
  /** Provenance stamped into the finished Blob (best-effort, per container). */
  meta?: ExportMeta;
}

/**
 * A running capture session. The shell keeps the MediaStream + MediaRecorder; the
 * engine holds only this handle. Live levels flow through subscribe() (same shape
 * as MeterAPI) so a tool's coaching UI updates during the take.
 */
export interface RecordSession {
  /** Subscribe to live audio levels while recording. Returns an unsubscribe fn. */
  subscribe(cb: (level: AudioLevel) => void): () => void;
  /** Finalise the recording and resolve the finished media Blob (with provenance where supported). */
  stop(): Promise<Blob>;
  /** Discard the recording and release the devices - no Blob is produced. */
  cancel(): void;
  /**
   * Whether a microphone track was ACTUALLY acquired for this session (v1.54).
   * Distinguishes a granted mic from a requested-but-denied one: a screen recording
   * proceeds without the mic if the user blocks it, so `audio: true` in the request
   * does NOT prove a mic was captured. Callers use this to keep the provenance honest
   * (never stamp "with microphone narration" on a silent take) and to warn the user.
   * Known synchronously once record() resolves. Undefined on shells/paths that don't
   * report it - treat undefined as "unknown", not "no mic".
   */
  readonly micActive?: boolean;
}
