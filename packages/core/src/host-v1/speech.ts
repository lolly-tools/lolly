// SPDX-License-Identifier: MPL-2.0

import type { AudioSource } from './audio.ts';

// ─── Speech synthesis (optional, v1.96) ───────────────────────────────────────

/** A voice the shell's model can speak in. */
export interface SpeechVoiceInfo {
  /** Stable voice id, the value `SpeechSynthesizeOpts.voice` takes. */
  id: string;
  /** Human-readable name for a picker. */
  name: string;
  /** BCP 47 language tag, e.g. 'en-US'. */
  lang: string;
  gender?: 'female' | 'male';
  /** Model-reported quality grade, where the model publishes one. */
  grade?: string;
}

/** One spoken word's span. Times are seconds, relative to the clip start. */
export interface SpeechWordTiming {
  text: string;
  start: number;
  end: number;
}

export interface SpeechResult {
  /** Mono samples. */
  pcm: Float32Array;
  /** Sample rate in Hz - 24000 for Kokoro. */
  sampleRate: number;
  /** Clip length in seconds. */
  duration: number;
  /**
   * Word spans for captioning. May be sentence-granular when the model only
   * aligns at sentence level; empty when no alignment is available at all -
   * check `granularity` rather than inferring it from span lengths.
   */
  words: SpeechWordTiming[];
  /** What one entry of `words` spans. */
  granularity: 'word' | 'sentence' | 'none';
}

/** Progress during the one-time model download or the synthesis itself. */
export interface SpeechProgress {
  phase: 'download' | 'synthesis';
  /** Bytes so far (download phase). */
  loaded?: number;
  /** Total bytes, or null when the transport doesn't say. */
  total?: number | null;
  /** 0..1 where a fraction is knowable. */
  fraction?: number;
}

export interface SpeechSynthesizeOpts {
  /**
   * A `SpeechVoiceInfo.id`, or a `+`-joined weighted blend of them
   * ('af_heart+bf_lily:0.3'): components carry an optional `:weight`, the
   * unweighted ones split what is left, and the shares normalise to 1. The
   * shell mixes the style rows and takes the heaviest component's accent.
   * `voices()` still lists only the atomic ids, because a blend is a setting
   * rather than a voice you pick from a list. The shell's default voice when
   * omitted.
   */
  voice?: string;
  /** Speaking rate multiplier, 1 = the voice's natural pace. */
  speed?: number;
  /**
   * The text already went through the shell's speech normalizer, so skip it
   * (v1.170). Set it when re-synthesizing text the shell handed back, such as
   * a saved clip's stored script: normalizing twice is not the same as
   * normalizing once (a second pass reads '2,024', already collapsed to
   * '2024', as the year '20 24'), so a second pass would change the words.
   * Shells that do no normalizing ignore it.
   */
  prenormalized?: boolean;
  /**
   * Abort a long synthesis: the promise rejects promptly (AbortError) and the
   * shell stops synthesizing at the next sentence boundary. Aborting during
   * the first-use model download also rejects promptly, but the download
   * itself is not cancelled - it completes in the background and is cached,
   * so the next request starts warm instead of re-downloading.
   */
  signal?: AbortSignal;
  onProgress?: (p: SpeechProgress) => void;
}

/** What on-device Whisper heard in a clip. */
export interface SpeechTranscript {
  /** The full transcription as one string. */
  text: string;
  /**
   * Timed spans for captioning - the same shape synthesis emits, so caption
   * plumbing built on `SpeechResult.words` reads a transcript unchanged.
   */
  words: SpeechWordTiming[];
  /** BCP 47 tag of the language the model detected (or was told). */
  lang: string;
  /** What one entry of `words` spans - check this, not span lengths. */
  granularity: 'word' | 'segment';
}

export interface SpeechTranscribeOpts {
  /** BCP 47 hint. The model auto-detects when omitted. */
  lang?: string;
  /** Abort a long transcription: the promise rejects promptly (AbortError). */
  signal?: AbortSignal;
  onProgress?: (p: SpeechProgress) => void;
}

export interface SpeechAPI {
  /**
   * Whether this shell can synthesise at all (possibly after a model download).
   * Sync feature-detect - a tool uses it to decide whether to offer a voiceover
   * affordance, before any bytes move.
   */
  isAvailable(): boolean;
  /** Are the model bytes already on-device? Never downloads. */
  cached(): Promise<boolean>;
  /** Approximate one-time download size in bytes, for a consent UI. */
  modelBytes(): number;
  voices(): Promise<SpeechVoiceInfo[]>;
  synthesize(text: string, opts?: SpeechSynthesizeOpts): Promise<SpeechResult>;

  /**
   * Transcription (v1.99) - audio in, text plus word timings out, via
   * on-device Whisper. Feature-detected like synthesis, not capability-gated:
   * audio never leaves the device, and the first use downloads the STT model
   * once (a separate download from the TTS model - gate it with its own
   * consent via `transcribeModelBytes`). Word timestamps feed the same
   * caption cues synthesis produces. The CLI transcribes WAV input only (Node has
   * no decoder for the other containers) - always check `transcribeAvailable()` first.
   */
  transcribeAvailable(): boolean;
  /** Are the STT model bytes already on-device? Never downloads. */
  transcribeCached(): Promise<boolean>;
  /** Approximate one-time STT download size in bytes, for a consent UI. */
  transcribeModelBytes(): number;
  transcribe(src: AudioSource, opts?: SpeechTranscribeOpts): Promise<SpeechTranscript>;
}
