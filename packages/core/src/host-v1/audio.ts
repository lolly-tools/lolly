// SPDX-License-Identifier: MPL-2.0

import type { AssetRef } from './asset-ref.ts';

// ─── Audio analysis (optional, v1.71) ─────────────────────────────────────────

export interface AudioAPI {
  /**
   * Whether this shell can decode and analyse audio at all. Sync + cheap - a tool
   * uses it to decide whether to offer reactive styles or stay on a static
   * waveform. True does not promise any PARTICULAR file decodes: a container the
   * platform lacks a codec for still rejects at `analyse`.
   */
  isAvailable(): boolean;

  /**
   * Decode `src` and analyse it. Rejects when the bytes can't be fetched or the
   * platform has no codec for them - a tool should catch and fall back rather than
   * assume, since codec support genuinely differs (Safari and Chromium disagree
   * about Ogg; nothing but Chromium reads much of what a phone records).
   *
   * Costs one FFT per output frame, so it is linear in `fps × window` and
   * independent of `bands`. The shell decides where that runs (the web shell moves
   * it to a Worker); either way it is a single await, not a stream.
   */
  analyse(src: AudioSource, opts?: AudioAnalyseOpts): Promise<AudioAnalysis>;

  /**
   * Decode, clean and encode an audio file locally. Shell support is additive:
   * Node accepts WAV and emits WAV; browser shells may expose their platform
   * codecs and an optional speech denoiser. Unsupported containers are refused
   * by name rather than silently bypassing a requested operation.
   */
  clean?(src: AudioSource, opts?: AudioCleanOpts): Promise<AudioCleanResult>;
}

export interface AudioCleanOpts {
  denoise?: 'off' | 'light' | 'strong';
  normalize?: 'off' | -16 | -14 | -23;
  trimSilence?: boolean;
  output?: 'wav' | 'mp3' | 'm4a' | 'opus';
  /** Hints needed when raw bytes came from a file input. */
  sourceName?: string;
  sourceMime?: string;
}

export interface AudioCleanResult {
  bytes: Uint8Array;
  mime: string;
  format: 'wav' | 'mp3' | 'm4a' | 'opus';
  durationBefore: number;
  durationAfter: number;
  secondsTrimmed: number;
  loudnessBefore: number | null;
  loudnessAfter: number | null;
  truePeakDb: number;
  operations: string[];
  /** Set when a video input was remuxed with its picture track unchanged. */
  videoPreserved?: boolean;
  /** Actual output container when it differs from the requested audio codec. */
  container?: string;
  /** Bounded PCM audition for large outputs/video; never substitutes for export bytes. */
  preview?: { bytes: Uint8Array; mime: string; duration: number; excerpt: boolean };
}

/**
 * What can be analysed: a fetchable URL (including a `blob:` or `data:` one), a
 * catalog/user AssetRef, or raw encoded bytes - the last so a `file` input's
 * in-memory upload can be analysed without being written anywhere first.
 */
export type AudioSource = string | AssetRef | ArrayBuffer | Uint8Array;

export interface AudioAnalyseOpts {
  /** Frames per second of the analysis track. Default 30. Match the export fps. */
  fps?: number;
  /** Magnitude bins per frame, log-spaced across the audible range. Default 64. */
  bands?: number;
  /** Static waveform buckets (the classic peak-per-column overview). Default 128. */
  buckets?: number;
  /** In-point in seconds. Default 0. Clamped into the source rather than erroring. */
  start?: number;
  /** Window length in seconds from `start`. Default: to the end of the source. */
  window?: number;
  /**
   * Also emit raw time-domain windows of this many samples per frame (rounded UP to
   * a power of two, capped at 4096). Off by default because it is by far the largest
   * thing here - 1,024 samples × 3 channels × every frame - and only a caller that
   * feeds a sample-domain visualiser needs it. `1024` is what butterchurn wants: its
   * AudioProcessor is `numSamps = 512`, `fftSize = numSamps * 2`, and `updateAudio`
   * does a bare `.set()`, so a longer window throws RangeError inside the renderer
   * and stands the visualizer down over a black canvas with nothing logged near the
   * cause.
   */
  samples?: number;
}

/**
 * Per-frame reactivity, indexed by frame number.
 *
 * Struct-of-arrays, not an array of per-frame objects: a minute at 60fps is 3,600
 * frames, and a draw loop wants a few flat Float32Arrays it can index, not 3,600
 * allocations to chase. `magnitude` and the `wave*` arrays are `count` consecutive
 * rows of `bands` / `samples` entries - row i starts at `i * bands`.
 *
 * Everything is normalised 0..1 across the analysed window EXCEPT `peak`, which
 * stays absolute so a tool can still see that the source clipped. Normalising is
 * what lets a quiet voice memo and a mastered single both fill the frame;
 * `bass`/`mid`/`treb` share one scale between them, so they read as a balance
 * rather than each independently reaching 1.
 */
export interface AudioFrames {
  /** Number of frames. */
  count: number;
  /** Magnitude bins per frame (`magnitude` row length). */
  bands: number;
  /** Time-domain window length per frame, or 0 when `opts.samples` was not asked for. */
  samples: number;
  /** Frame time in seconds, relative to the analysed window's start. */
  t: Float32Array;
  /** Window RMS (loudness), 0..1 normalised. The value a VU-style bar tracks. */
  rms: Float32Array;
  /** Window peak amplitude, 0..1 ABSOLUTE (not normalised - 1 means it clipped). */
  peak: Float32Array;
  /** Energy below 320Hz, 0..1. Shares a scale with `mid`/`treb`. */
  bass: Float32Array;
  /** Energy 320Hz–2.8kHz, 0..1. */
  mid: Float32Array;
  /** Energy above 2.8kHz, 0..1. */
  treb: Float32Array;
  /** Spectral centroid ("brightness") as a 0..1 position across the audible range. */
  centroid: Float32Array;
  /** Positive spectral flux, 0..1 - onset strength. Peaks land on note attacks. */
  flux: Float32Array;
  /** `count` × `bands` log-spaced magnitudes, 0..1. */
  magnitude: Float32Array;
  /** `count` × `samples` mono time-domain bytes, 128 = silence. Empty unless asked for. */
  wave: Uint8Array;
  /** Left channel of the above; equals `wave` for a mono source. */
  waveL: Uint8Array;
  /** Right channel of the above; equals `wave` for a mono source. */
  waveR: Uint8Array;
}

export interface AudioAnalysis {
  /** Duration of the WHOLE source in seconds - not of the analysed window. */
  duration: number;
  /** Source sample rate in Hz. */
  sampleRate: number;
  /** Source channel count. */
  channels: number;
  /** The in-point actually analysed, in seconds (`opts.start` clamped). */
  start: number;
  /** The window length actually analysed, in seconds (`opts.window` clamped). */
  window: number;
  /** Frames per second of `frames` (`opts.fps` clamped to 1..120). */
  fps: number;
  /** `buckets` peak amplitudes over the window, 0..1 normalised - the overview waveform. */
  peaks: Float32Array;
  /** Per-frame reactivity. */
  frames: AudioFrames;
  /**
   * Estimated tempo, or **null** when the window holds too little rhythm to call
   * one. Null is a real answer and the common one for speech, ambience and pads -
   * a visual built on a wrong beat grid looks far worse than one built on none, so
   * this refuses rather than guesses. Never treat null as 120.
   */
  bpm: number | null;
  /** Beat times in seconds relative to `start`. Empty when `bpm` is null. */
  beats: Float32Array;
}
