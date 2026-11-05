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

  /**
   * Measure a recording against EBU R128 (BS.1770-4): momentary, short-term,
   * integrated, loudness range and true peak, at the file's own sample rate. Pure
   * measurement; nothing is changed. Shell support is additive: a shell without the
   * audio module leaves this undefined, and `clean` then reports integrated
   * loudness only. Every shell that has the module gives the same numbers.
   */
  loudness?(src: AudioSource, opts?: AudioLoudnessOpts): Promise<AudioLoudness>;

  /**
   * Find where recording `b` starts relative to recording `a` when both captured
   * the same event (two microphones, a camera and a recorder). Resolves null when
   * they share too little sound to align. A result with `reliable: false` is a
   * guess and should be shown as one. Each clip is read up to its first 4 minutes.
   */
  align?(a: AudioSource, b: AudioSource, opts?: AudioAlignOpts): Promise<AudioAlignment | null>;

  /**
   * Decode `src` to PCM, or render it when the audio is computed rather than
   * recorded: a rondocode song (an asset of format `rondo`, its `.rondo.json`
   * bytes or a rondocode share link), a ZzFXM song or a tracker module. v1.246.
   *
   * A computed source's code never runs in the caller's realm. A rondocode song
   * is evaluated in the `vm` execution class (packages/rondo), and `run` records
   * that, so a tool can put it in a credit or a receipt. What the shell cannot
   * play is listed in `findings` by name rather than returned as silence that
   * looks like a render (a sung part without the voice models, a live
   * microphone, a sample that was loaded into the editor and not saved with the
   * song). Rejects with a named error when the source cannot be read at all.
   */
  decode?(src: AudioSource, opts?: AudioDecodeOpts): Promise<AudioDecoded>;
}

export interface AudioDecodeOpts {
  /**
   * Length in seconds for a computed source. A rondocode song renders exactly
   * this long; omitted, it renders its own arrangement, or 8 cycles when it has
   * none. Recorded audio ignores it and returns the whole file.
   */
  seconds?: number;
  /**
   * Also write the song's notes as a Standard MIDI File, returned as
   * `AudioDecoded.midi`. Only a rondocode song has notes to write; for any other
   * source `midi` is absent from the result. The file is format 1: a conductor track (tempo, a 4/4
   * time signature, `text` as a text event) and one track per synth, with note
   * velocities and General MIDI programs where a synth's name maps to one. Synthesis
   * parameters, effects, samples and tuning other than twelve-tone are not in the file.
   */
  midi?: { /** A text event written at tick 0 of the conductor track. */ text?: string; /** The conductor track's name. */ title?: string };
}

/** One part of a computed source the shell could not play, and why. */
export interface AudioFinding {
  /** Stable code, for example `rondo.part.sing` or `rondo.part.mic`. */
  code: string;
  /** One plain sentence for a person. */
  message: string;
  /** The synths, samples or models it concerns. */
  parts: string[];
}

export interface AudioDecoded {
  sampleRate: number;
  /** One array per channel. */
  channels: Float32Array[];
  seconds: number;
  /** Empty when everything played. */
  findings: AudioFinding[];
  /** The song as a Standard MIDI File, when the call set `AudioDecodeOpts.midi`. */
  midi?: Uint8Array;
  /** How a computed source ran. Absent for recorded audio. */
  run?: {
    /** The document model's execution class: `vm` for a rondocode song. */
    executionClass: string;
    /** What produced the audio, for example `rondocode`. */
    source: string;
    /** The renderer's version, for example the pinned upstream commit and adapter revision. */
    version: string;
    /** The fixed seed behind any randomness the source asked for. */
    seed?: number;
  };
}

/** Model-free repair: plain signal processing that needs no download and runs offline. */
export interface AudioRepairOpts {
  /** Steady background noise (fans, hiss). */
  noise?: 'off' | 'light' | 'strong';
  /** Mains hum and its harmonics. */
  hum?: 'off' | '50' | '60';
  /** Harsh "s" sounds. */
  deEss?: 'off' | 'light' | 'strong';
  /** Clicks and pops. */
  declick?: boolean;
  /** Room echo. */
  dereverb?: 'off' | 'light' | 'strong';
}

/** EBU R128 readings. LUFS for loudness, LU for the range, dB for peaks; null where there is nothing to measure. */
export interface AudioLoudnessReport {
  integrated: number | null;
  momentary: number | null;
  shortTerm: number | null;
  maxMomentary: number | null;
  maxShortTerm: number | null;
  loudnessRange: number | null;
  samplePeakDb: number | null;
  /** True peak, dBTP. */
  truePeakDb: number | null;
}

export interface AudioLoudnessOpts {
  /** Also return momentary and short-term loudness every 100 ms. */
  series?: boolean;
}

export interface AudioLoudness extends AudioLoudnessReport {
  sampleRate: number;
  seconds: number;
  /** Every 100 ms, when asked for. `null` is below the meter's floor. */
  series?: { stepSeconds: number; momentary: (number | null)[]; shortTerm: (number | null)[] };
}

export interface AudioAlignOpts {
  /** Largest offset to consider, in seconds. Default: anything with enough overlap. */
  maxLagSeconds?: number;
}

export interface AudioAlignment {
  /** Seconds `b` starts after `a` (negative when it starts before). */
  offsetSeconds: number;
  /** The same in samples at `sampleRate`. */
  offsetSamples: number;
  sampleRate: number;
  confidence: number;
  distinct: number;
  /** One recording has inverted polarity. */
  inverted: boolean;
  /** Clear enough to trust. */
  reliable: boolean;
  /** A clip was longer than the aligner reads. */
  truncated: boolean;
}

export interface AudioCleanOpts {
  /** Model-based speech clean-up. Needs the shell's local model. */
  denoise?: 'off' | 'light' | 'strong';
  /**
   * Model-free repair, run before the model clean-up and the other steps. Works in
   * every shell that has the audio module, including the command line.
   */
  repair?: AudioRepairOpts;
  normalize?: 'off' | -16 | -14 | -23;
  trimSilence?: boolean;
  /**
   * `opus` is Opus in WebM; `ogg` (v1.246) is Opus in an Ogg file, the `.opus`
   * file; `flac` (v1.246) is lossless. A shell without an encoder for a format
   * rejects by name.
   */
  output?: 'wav' | 'mp3' | 'm4a' | 'opus' | 'ogg' | 'flac';
  /** Hints needed when raw bytes came from a file input. */
  sourceName?: string;
  sourceMime?: string;
}

export interface AudioCleanResult {
  bytes: Uint8Array;
  mime: string;
  format: 'wav' | 'mp3' | 'm4a' | 'opus' | 'ogg' | 'flac';
  durationBefore: number;
  durationAfter: number;
  secondsTrimmed: number;
  loudnessBefore: number | null;
  loudnessAfter: number | null;
  /** Sample peak in dBFS, or the true peak in dBTP when `report` is present. */
  truePeakDb: number;
  operations: string[];
  /** Full R128 readings of the input and the output, when the shell has the audio module. */
  report?: { before: AudioLoudnessReport; after: AudioLoudnessReport };
  /** Clicks the declick step repaired. */
  clicksRepaired?: number;
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
