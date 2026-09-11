// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-providers.ts - frame + audio sources for the sequence compositor
 * (Fable timeline, phase 3 section 2.2).
 *
 * The compositor asks one question per clip per output frame: paint the pixels
 * of THIS source at THIS source time into THIS rectangle. It asks one question
 * per clip per export: hand me the PCM for this span. Everything behind those
 * two questions (a WebCodecs decode pipeline, a hidden <video> being seeked, a
 * container demuxer) lives in this file and nowhere else.
 *
 * WHY THE INTERFACES ARE SHAPED LIKE THIS
 *
 * `FrameProvider` is DRAW-AND-RELEASE, not "give me an image source". The spike
 * (plans/54-fable-timeline-phase-3.md section 0.0 rule 3) found that mediabunny's
 * `VideoSample` is already the draw wrapper: `sample.draw(ctx, dx, dy, dw, dh)`
 * applies the container's rotation metadata into the destination rect for us.
 * `toCanvasImageSource()` may auto-close in the next microtask, and
 * `toVideoFrame()` mints a second object with its own lifetime. Handing a
 * `CanvasImageSource` to the caller would hand out a resource the caller cannot
 * close correctly. So the provider owns the sample from decode to close, and the
 * caller only ever supplies a context and a rect.
 *
 * `ClipAudio.pcm()` returns PCM already trimmed to the exact sample offsets.
 * `AudioBufferSink.buffers(a, b)` respects its range only to packet granularity
 * (AAC = 1024 frames = 21.33 ms): it includes the packet straddling `a` and the
 * one straddling `b` (spike rule 6). A caller that just concatenated what the
 * sink yields would give every clip up to 21 ms of its neighbour's audio, heard
 * as a click at every cut. The trim happens here, once, in a pure function, so
 * it is unit-testable without a decoder.
 *
 * RESOURCE DISCIPLINE
 *
 * At most `MAX_IN_FLIGHT` (2) decoded samples are held at any instant, and each
 * one closes in the same tick as its draw. mediabunny already caps its own
 * decode queue at 8, and the spike could not reproduce a hardware-decoder stall
 * at any N. So this cap is a MEMORY policy, not a decoder-count limit: the JS
 * heap moved 1.6 MB while roughly 2.8 GB of frame data was nominally held, so no
 * JS instrument can see the real ceiling. `stats()` exposes the in-flight count
 * because it is the only observable the tests have.
 *
 * NEVER HANGS. Every await in this file runs inside `withTimeout`, because a
 * stalled decoder looks the same as a slow one, and a hung export is worse than
 * a failed one. Every failure is normalised through the one `toCodedError` in
 * ./sequence-plan.ts (spike rule 8: failures arrive as mediabunny typed errors,
 * raw WebCodecs `DOMException`s, and plain `Error`s).
 *
 * TRUNCATION IS SILENT (spike rule 7): a half-written container decodes a
 * clean, short iteration with no error at all. This module cannot decide what
 * to do about that - the renderer owns the fail-closed policy - so it exposes
 * the evidence instead: `stats().decoded`, `stats().missed` and
 * `stats().lastSourceSec` against `durationSec()`.
 *
 * BUNDLE SIZE. mediabunny is `import()`ed lazily, and only the container
 * singletons we actually accept are pulled in, never `ALL_FORMATS`. The video
 * and audio paths register DIFFERENT sets (see VIDEO_CONTAINERS /
 * AUDIO_CONTAINERS): registering only the video four here is what silently
 * broke every catalog music bed, because Lolly's audio ships as Ogg/Opus and
 * MP3. A static import would cost the preload entry +352 kB (+89 kB gzip)
 * versus +0.14 kB lazy. `sequence-providers.test.ts` has a source guard that
 * fails the build if either rule is broken by an innocent-looking editor
 * auto-import.
 *
 * NOT EVERY SOURCE IS A FILE. An audio box may carry a `zzfxm:<seed>[:<style>]`
 * ref instead of an asset url: a procedural track, synthesised here from the
 * engine's seeded composer. It arrives through the same `createClipAudio` and
 * satisfies the same `ClipAudio`, so the mix cannot tell the difference. See the
 * "procedural audio" section at the foot of this file for the grammar and for
 * why it reports a duration of 0. A TRACKER MODULE (.mod/.xm/.it/.s3m/.stm/.mtm)
 * is the same kind of thing from the other direction: a real file, but a score
 * rather than an encoded stream, which no demuxer can read. It arrives through
 * the same door: see the "tracker modules" section, also at the foot of this
 * file.
 *
 * BROWSER-ONLY, AND WHAT ISN'T. The decode/draw path needs WebCodecs and a real
 * canvas context, so it can only be proven in the Playwright tier. Everything
 * that decides what to do - the provider pick ladder, the primed-grid matcher,
 * the PCM window trim/resample, the in-flight accounting, error normalisation,
 * dispose idempotency - is injectable and covered headlessly.
 */

import {
  createSeekQueue, METADATA_TIMEOUT_MS, readBounded, withinDecodeBudget,
  MAX_AUDIO_DECODE_BYTES, type SeekQueue,
} from '../lib/clip-thumbs.ts';
// The element-seek fallback must behave exactly like the phase-2 preview seeker,
// or a clip would export frames the editor never showed. Instead of restating
// the rules (serialise per element, confirm with requestVideoFrameCallback's
// mediaTime, one quarter-frame nudge when the decoder falls short, hard
// timeout), this imports the shipped implementation and its tuning constants
// from the clock. Nothing there is modified: this is a read-only reuse.
// The tracker-module recogniser comes from the same place for the same reason:
// the preview and this mix must never disagree about which box libopenmpt owns,
// so there is one definition of "is this a module" and both import it.
import {
  waitSeekConfirmed,
  SEEK_TOLERANCE_S,
  SEEK_NUDGE_S,
  MEDIA_END_EPS_S,
  isModuleUrl,
  sniffTrackerModule,
  urlExtension,
} from '../views/sequence-clock.ts';
// The error vocabulary is the plan module's, not a second one invented here.
// The renderer switches on `SeqErrorCode`, and a provider that minted its own
// codes would be invisible to it. `toCodedError` is the single normaliser for
// the three kinds of throw (mediabunny typed, WebCodecs DOMException, plain Error).
import { sequenceError, toCodedError, SequenceError, type SeqErrorCode } from './sequence-plan.ts';
// The `zzfxm:` id format. Alone in its own module so bridge/assets.ts can
// recognise one without pulling this file (and its lazy mediabunny import site)
// into the first-paint graph - see engine/src/zzfxm-ref.ts's header.
import { ZZFXM_SCHEME, parseZzfxmRef, type ZzfxmRef } from '../../../../engine/src/zzfxm-ref.ts';
// The procedural (`zzfxm:`) audio source composes with the ENGINE's composer.
// There is exactly one ZzFXM composer in this codebase, not a second one. It is
// pure, DOM-free and seeded, so it is safe to import eagerly. The renderer (a
// Worker) is the heavy half and stays lazy, below.
import {
  composeSong,
  generatedSongSpec,
} from '../../../../engine/src/zzfx-compose.ts';
import type { RenderedPcm, ZzfxSong } from '../../../../engine/src/zzfxm.ts';

// ── tunables ────────────────────────────────────────────────────────────────

/**
 * Decoded samples held at once. A MEMORY policy (see the header) - 16 concurrent
 * decoders ran fine in the spike, so this is not about decoder count.
 */
export const MAX_IN_FLIGHT = 2;
/** Budget for any single decode/seek/open step. A stall must fail, never hang. */
export const OP_TIMEOUT_MS = 10_000;
/** Budget for opening a container (demux + duration probe). */
export const OPEN_TIMEOUT_MS = 15_000;
/** Two timestamps closer than this are the same point on the export grid. */
export const TS_EPSILON_S = 1e-4;

/**
 * Marks a rejection produced by `withTimeout`.
 *
 * A timeout is a `SEQ_DECODE_FAILED` to the renderer like any other decode
 * failure, but INSIDE this module it needs distinguishing: it is the one failure
 * after which the primed generator's state is unknown and the fast path has to
 * be abandoned. A property rather than a distinct code, so the plan module's
 * vocabulary stays the only one anyone outside has to know.
 */
const TIMEOUT_FLAG = 'seqTimeout';

/** Did this rejection come from a deadline rather than a decoder saying no? */
export function isSeqTimeout(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as Record<string, unknown>)[TIMEOUT_FLAG] === true;
}

// ── the public contract ─────────────────────────────────────────────────────

/** Where a frame goes on the compositor's canvas, in device pixels. */
export interface DrawDest {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** What a provider can tell you about itself. The only resource observable. */
export interface ProviderStats {
  /** Which implementation answered `createVideoProvider`. */
  kind: 'mediabunny' | 'element';
  /** Samples held right now. Must never exceed MAX_IN_FLIGHT. */
  inFlight: number;
  /** High-water mark of the above, for the resource-discipline assertions. */
  maxInFlight: number;
  /** Frames successfully drawn. Half of the truncation reconciliation. */
  decoded: number;
  /** Requests that produced no frame (past the end, or a hole in the file). */
  missed: number;
  /**
   * `drawAt` calls, answered or not.
   *
   * `decoded` counts draws, and the compositor legitimately skips some (a fully
   * transparent box, a zero-size box, the first frame of a fade). So `decoded`
   * is not a measure of what was asked for. The truncation guard reconciles
   * answers against REQUESTS, which is what this field is for.
   */
  requests: number;
  /** Source time of the first request, seconds. -1 before the first. */
  firstRequestSec: number;
  /** Source time of the last request, seconds. -1 before the first. */
  lastRequestSec: number;
  /**
   * Requests that fell at or past the length the source CLAIMS to have.
   *
   * A clip may legitimately be trimmed longer than its media (the timeline
   * clamps `dur` to MAX_TIME_S, never to the file), and those frames can never
   * be answered. Counted separately so "the file stopped answering" stays
   * distinguishable from "we asked past the end on purpose".
   */
  unreachable: number;
  /**
   * The length the container CLAIMS, seconds - `max(computeDuration, metadata)`.
   *
   * This is the one signal that separates two situations that look identical
   * from inside a decode: a clip trimmed past the end of an INTACT file (both
   * numbers agree, so requests past the end are legitimately unanswerable), and
   * a TRUNCATED file (the header still claims the original length while the
   * packets stop early, so the same requests are evidence of a bad file).
   * `computeDuration` alone cannot tell them apart - it walks real packets, so
   * on a truncated file it reports the truncated length and the shortfall
   * vanishes. 0 when unknown.
   */
  claimedDurationSec: number;
  /**
   * The source's own frame interval, seconds - the largest sample duration
   * seen. 0 when the source does not report one. The truncation tolerance needs
   * it: a decoded frame's PTS can lag the requested time by up to one source frame.
   */
  sourceFrameSec: number;
  /** Source timestamp of the last frame drawn, seconds. -1 before the first. */
  lastSourceSec: number;
  /** True once the primed fast path has been abandoned (a timeout or a scrub). */
  randomAccess: boolean;
}

/**
 * One clip's pixels, addressable by source time.
 *
 * DRAW-AND-RELEASE: `drawAt` paints and disposes the underlying sample before
 * it resolves. No VideoSample, VideoFrame or CanvasImageSource ever crosses
 * this boundary - see the header for why that is a correctness rule, not a
 * style choice.
 */
export interface FrameProvider {
  /** Native display width of the source, px. */
  readonly w: number;
  /** Native display height of the source, px. */
  readonly h: number;
  /**
   * Draw the frame at `sourceSec` into `dest`. Resolves `false` when the source
   * has no frame there (past the end, or a gap) - that is not an error, and the
   * compositor is expected to leave whatever it already painted.
   */
  drawAt(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    sourceSec: number,
    dest: DrawDest,
  ): Promise<boolean>;
  /**
   * Hand over the sorted source times this export will ask for, up front. That
   * lets the mediabunny provider use `samplesAtTimestamps`, which decodes each
   * packet at most once for a monotonic list. That is the difference between a
   * sequential export and one random access per frame. Out-of-order requests
   * still work; they just leave the fast path (see `stats().randomAccess`).
   */
  prime?(timestamps: number[]): void;
  /** Source duration in seconds, from a real packet walk. 0 when unknown. */
  durationSec(): number;
  /** Idempotent. Releases decoders, elements and object URLs on every path. */
  dispose(): Promise<void>;
}

/** One clip's audio, addressable by source time, already trimmed. */
export interface ClipAudio {
  /**
   * PCM for `[fromSec, toSec)`, resampled to `sampleRate` and trimmed to the
   * exact sample offsets - the sink's packet-granular range is corrected here
   * (spike rule 6). Channels are the source's; an empty array means silence.
   */
  pcm(fromSec: number, toSec: number, sampleRate: number): Promise<{ channels: Float32Array[]; sampleRate: number }>;
  /** Source duration in seconds. 0 when unknown. */
  durationSec(): number;
  /** Idempotent. */
  dispose(): Promise<void>;
}

/** Providers expose their counters through this (the interface stays minimal). */
export interface InstrumentedProvider extends FrameProvider {
  stats(): ProviderStats;
}

// ── mediabunny, structurally typed ──────────────────────────────────────────
//
// Deliberately not `import type { Input } from 'mediabunny'`. Describing only
// the handful of members we touch keeps the test fake a few lines long and
// makes the real surface area obvious at a glance. It also means a mediabunny
// major version that changes something we don't use cannot break this file's
// types.

interface MbSample {
  readonly timestamp: number;
  readonly duration: number;
  draw(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number,
  ): void;
  close(): void;
}

interface MbVideoSink {
  getSample(timestamp: number): Promise<MbSample | null>;
  samplesAtTimestamps(timestamps: Iterable<number>): AsyncGenerator<MbSample | null, void, unknown>;
  /** Monotonic cluster walk. The rescue path for index-poor files - see sampleSequential. */
  samples(start?: number, end?: number): AsyncGenerator<MbSample | null, void, unknown>;
}

interface MbVideoTrack {
  canDecode(): Promise<boolean>;
  getDisplayWidth(): Promise<number>;
  getDisplayHeight(): Promise<number>;
}

interface MbAudioTrack {
  canDecode(): Promise<boolean>;
  getSampleRate(): Promise<number>;
}

interface MbWrappedAudioBuffer {
  buffer: {
    readonly sampleRate: number;
    readonly numberOfChannels: number;
    readonly length: number;
    getChannelData(channel: number): Float32Array;
  };
  timestamp: number;
  duration: number;
}

interface MbAudioSink {
  buffers(from?: number, to?: number): AsyncGenerator<MbWrappedAudioBuffer, void, unknown>;
}

interface MbInput {
  getPrimaryVideoTrack(): Promise<MbVideoTrack | null>;
  getPrimaryAudioTrack(): Promise<MbAudioTrack | null>;
  computeDuration(): Promise<number>;
  /** Optional: absent on a test fake, and null when the file states nothing. */
  getDurationFromMetadata?(): Promise<number | null>;
  dispose(): void;
}

/** The constructors and container singletons this module imports. */
export interface MediabunnyModule {
  Input: new (options: { formats: unknown[]; source: unknown }) => MbInput;
  BlobSource: new (blob: Blob) => unknown;
  UrlSource: new (url: string) => unknown;
  VideoSampleSink: new (track: MbVideoTrack) => MbVideoSink;
  AudioBufferSink: new (track: MbAudioTrack) => MbAudioSink;
  // Video containers.
  MP4: unknown;
  QTFF: unknown;
  WEBM: unknown;
  MATROSKA: unknown;
  // Audio-only containers - see AUDIO_CONTAINERS.
  OGG: unknown;
  MP3: unknown;
  WAVE: unknown;
  ADTS: unknown;
  FLAC: unknown;
}

/**
 * Which containers each decode path registers.
 *
 * These are DIFFERENT SETS on purpose. Getting it wrong is not a size
 * regression, it is silence. A clip's own soundtrack lives inside a video
 * container, so the audio path needs the video four plus the audio-only ones.
 * The video path never needs an .ogg.
 *
 * The audio list comes from what the product actually ships and accepts, not
 * from taste:
 *   - catalog audio assets are `mp3` and `opus` (Ogg) - brands/asts index.json
 *   - picker.ts UPLOAD_ACCEPT takes .mp3 .wav .ogg .oga .opus .m4a .aac .flac
 * (.m4a is an MP4 container, already covered. Tracker/MIDI uploads never reach
 * mediabunny; they render through the zzfxm/mod path.)
 *
 * Cost, measured with esbuild --bundle --minify | gzip -9, not estimated: the
 * video four are 60.5 kB gzip; adding OGG/MP3/WAVE takes it to 72.7 kB, and
 * ADTS/FLAC to 75.3 kB. All of it sits in the lazily-imported chunk that only
 * a motion export pulls, so first paint stays untouched, which is the rule
 * that actually matters. ALL_FORMATS would still be wrong: it adds TS/HLS on
 * top for containers nothing in Lolly can produce or accept.
 */
const VIDEO_CONTAINERS = (m: MediabunnyModule): unknown[] => [m.MP4, m.QTFF, m.WEBM, m.MATROSKA];
const AUDIO_CONTAINERS = (m: MediabunnyModule): unknown[] =>
  [m.MP4, m.QTFF, m.WEBM, m.MATROSKA, m.OGG, m.MP3, m.WAVE, m.ADTS, m.FLAC];

/**
 * The one place mediabunny is loaded.
 *
 * Named members only, and only the four format singletons - see the header.
 * The `as unknown as` is the seam between the real (much larger) declarations
 * and the structural subset above. It is a narrowing, so nothing unsafe crosses
 * it.
 */
async function loadMediabunny(): Promise<MediabunnyModule> {
  // Literal specifier on purpose: a variable here would defeat Vite's chunking
  // and ship an unresolvable bare import to the browser.
  const m = await import('mediabunny');
  return {
    Input: m.Input,
    BlobSource: m.BlobSource,
    UrlSource: m.UrlSource,
    VideoSampleSink: m.VideoSampleSink,
    AudioBufferSink: m.AudioBufferSink,
    MP4: m.MP4,
    QTFF: m.QTFF,
    WEBM: m.WEBM,
    MATROSKA: m.MATROSKA,
    OGG: m.OGG,
    MP3: m.MP3,
    WAVE: m.WAVE,
    ADTS: m.ADTS,
    FLAC: m.FLAC,
  } as unknown as MediabunnyModule;
}

// ── failure normalisation + timeouts ────────────────────────────────────────

/**
 * Every throw in this file goes through here.
 *
 * `toCodedError` classifies by name and wording, which is right for a foreign
 * error but weaker than what the call site already knows. So when it can only
 * say "SEQ_DECODE_FAILED" and the caller has a more specific reason (an
 * unreadable container, a refused codec), the caller's `fallback` wins. An
 * error that is already one of ours passes through untouched, so a code cannot
 * be re-derived (and downgraded) on its way up through two layers.
 */
function coded(err: unknown, fallback: SeqErrorCode): SequenceError {
  if (err instanceof SequenceError) return err;
  const c = toCodedError(err);
  const code = c.code === 'SEQ_DECODE_FAILED' && fallback !== 'SEQ_DECODE_FAILED' ? fallback : c.code;
  const out = sequenceError(code, c.message);
  if (isSeqTimeout(err)) (out as unknown as Record<string, unknown>)[TIMEOUT_FLAG] = true;
  return out;
}

/**
 * Await with a deadline. Not a cancellation - a `VideoDecoder` that has gone
 * quiet cannot be un-stuck - but it converts a hang into a coded failure the
 * renderer's watchdog can report. That is the whole difference between a stuck
 * export and a failed one.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  if (!(ms > 0) || !Number.isFinite(ms)) return p;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const e = sequenceError('SEQ_DECODE_FAILED', `${label} timed out after ${ms}ms`);
      (e as unknown as Record<string, unknown>)[TIMEOUT_FLAG] = true;
      reject(e);
    }, ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// ── capability ──────────────────────────────────────────────────────────────

type CodecGlobal = typeof globalThis & {
  VideoDecoder?: { isConfigSupported?: unknown };
  AudioDecoder?: unknown;
};

/**
 * Can this browser decode through WebCodecs at all?
 *
 * Async by contract even though today's answer is synchronous. A future probe
 * (`VideoDecoder.isConfigSupported`) is per-codec and genuinely async, and
 * callers written against a sync answer would all need to change.
 */
export function providerCapability(): Promise<{ webcodecs: boolean }> {
  const g = globalThis as CodecGlobal;
  const webcodecs = typeof g.VideoDecoder !== 'undefined' && typeof g.VideoDecoder?.isConfigSupported === 'function';
  return Promise.resolve({ webcodecs });
}

// ── the primed-grid matcher (pure) ──────────────────────────────────────────

/** What `drawAt` should do with a request, given where the primed cursor sits. */
export interface PullPlan {
  /** 'primed' pulls from the sequential generator; 'random' does getSample(t). */
  mode: 'primed' | 'random';
  /**
   * For 'primed': how many samples to pull. The first `advance - 1` are frames
   * the caller skipped over and must be closed immediately; the last is the one
   * to draw.
   */
  advance: number;
  /** The primed index the cursor ends on (only meaningful for 'primed'). */
  index: number;
}

/**
 * Decide how to service a request for `t` against a primed timestamp grid.
 *
 * A fixed-fps export walks the grid in order, so the common case is `advance 1`.
 * Two things break that, and both must be handled without wedging the
 * generator. A caller that skips frames (a clip visible only every other frame
 * because of a crossfade) walks FORWARD, which the generator can absorb by
 * pulling and discarding. A caller that goes BACKWARDS (scrub, or a second
 * pass) cannot, because an async generator has no rewind, so that request falls
 * back to random access.
 *
 * `window` bounds the forward scan so a wildly out-of-range request degrades to
 * one `getSample` instead of draining the whole grid.
 */
export function planPull(primed: number[], cursor: number, t: number, window = 256): PullPlan {
  if (cursor < 0 || cursor >= primed.length) return { mode: 'random', advance: 0, index: cursor };
  const last = Math.min(primed.length - 1, cursor + window);
  for (let i = cursor; i <= last; i++) {
    const ts = primed[i] as number;
    if (Math.abs(ts - t) <= TS_EPSILON_S) return { mode: 'primed', advance: i - cursor + 1, index: i };
    // The grid is sorted: once it has passed `t`, no later entry can match.
    if (ts > t + TS_EPSILON_S) break;
  }
  return { mode: 'random', advance: 0, index: cursor };
}

// ── the PCM window (pure) ───────────────────────────────────────────────────

/** One decoded audio chunk, stripped of any AudioBuffer dependency. */
export interface PcmChunk {
  /** Per-channel samples, all of the same length. */
  channels: Float32Array[];
  sampleRate: number;
  /** Presentation time of the chunk's FIRST sample, seconds. */
  timestamp: number;
}

/**
 * Linear resample of one channel. Deliberately linear, not windowed-sinc: this
 * only runs when a clip's own rate differs from the mix rate (48 kHz), the
 * output is a background layer under a video, and a polyphase resampler here
 * would be a large, untested chunk of DSP for an inaudible difference. If a
 * future mix needs better quality, `OfflineAudioContext` resampling is the drop-in.
 */
export function resampleLinear(src: Float32Array, srcRate: number, dstRate: number, dstLength: number): Float32Array {
  const out = new Float32Array(dstLength);
  if (src.length === 0 || !(srcRate > 0) || !(dstRate > 0)) return out;
  const ratio = srcRate / dstRate;
  for (let i = 0; i < dstLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    if (i0 >= src.length - 1) {
      out[i] = src[src.length - 1] as number;
      continue;
    }
    const frac = pos - i0;
    const a = src[i0] as number;
    const b = src[i0 + 1] as number;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/**
 * Fold a multi-channel source to stereo with the standard ITU-R BS.775 matrix, so a
 * surround clip's centre and surround energy is MIXED IN rather than dropped on the
 * floor (which is what happens today: the mixer reads only channels 0 and 1). 1-2
 * channels pass straight through untouched - mono duplication stays the caller's job.
 *
 * The fold assumes the SMPTE channel order a browser AudioDecoder emits, keyed by count:
 *   3 = L R C      4 = L R Ls Rs      5 = L R C Ls Rs
 *   6 = L R C LFE Ls Rs (5.1)         8 = 5.1 + Lb Rb (7.1)
 * Centre and surrounds fold in at -3 dB (0.707); the LFE (channel 3 of 5.1/7.1) is
 * dropped - it carries no localisable content and would only muddy a stereo mix. The
 * matrix is not renormalised, so a hot surround mix can exceed unity; the sequence
 * mixer's own levels ride above this and a clip bed is quiet by construction. Pure and
 * deterministic (a fixed weighted sum), so the analytic mix stays byte-identical.
 */
export function downmixToStereo(channels: Float32Array[]): Float32Array[] {
  const n = channels.length;
  if (n <= 2) return channels;
  const len = channels[0]?.length ?? 0;
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  const G = Math.SQRT1_2;   // 0.70710678..., a -3 dB fold
  const at = (k: number, i: number): number => channels[k]?.[i] ?? 0;
  for (let i = 0; i < len; i++) {
    let l = at(0, i);
    let r = at(1, i);
    if (n === 3 || n >= 5) { const c = at(2, i); l += G * c; r += G * c; }   // centre
    if (n === 4)      { l += G * at(2, i); r += G * at(3, i); }              // quad surrounds
    else if (n === 5) { l += G * at(3, i); r += G * at(4, i); }             // 5.0 surrounds
    else if (n >= 6)  { l += G * at(4, i); r += G * at(5, i); }             // 5.1 surrounds (LFE = ch3, dropped)
    if (n >= 8)       { l += G * at(6, i); r += G * at(7, i); }             // 7.1 rears
    L[i] = l;
    R[i] = r;
  }
  return [L, R];
}

/**
 * Assemble the exact PCM window `[fromSec, toSec)` from packet-granular chunks.
 *
 * THIS IS THE TRIM (spike rule 6). `AudioBufferSink.buffers(a, b)` yields the
 * packet that straddles `a` and the packet that straddles `b`, so a naive
 * concatenation starts up to one packet (21.33 ms for AAC) early and ends that
 * much late. Every clip would then bleed its neighbour's audio across the cut.
 * Here each chunk is placed at its true offset - `(chunk.timestamp - fromSec)`
 * in output samples - and anything landing outside the window is simply not
 * written. That trims both ends by construction and fills gaps with silence
 * instead of sliding later audio earlier.
 *
 * Pure and AudioBuffer-free on purpose: this is the part of the audio path that
 * can be proven headlessly, and the part most likely to be subtly wrong.
 */
export function assemblePcmWindow(
  chunks: PcmChunk[],
  fromSec: number,
  toSec: number,
  sampleRate: number,
): { channels: Float32Array[]; sampleRate: number } {
  const span = Math.max(0, toSec - fromSec);
  const length = Math.max(0, Math.round(span * sampleRate));
  let channelCount = 0;
  for (const c of chunks) channelCount = Math.max(channelCount, c.channels.length);
  if (length === 0 || channelCount === 0) return { channels: [], sampleRate };
  // The sequence mix is stereo: a >2-channel source is folded to 2 with the BS.775
  // matrix (downmixToStereo) rather than having its centre/surround silently dropped by
  // the mixer. An all-mono set stays 1 channel (the mixer duplicates it into both).
  const targetChannels = Math.min(2, channelCount);

  const out: Float32Array[] = [];
  for (let c = 0; c < targetChannels; c++) out.push(new Float32Array(length));

  for (const chunk of chunks) {
    if (!chunk.channels.length || !(chunk.sampleRate > 0)) continue;
    const srcLen = chunk.channels[0]?.length ?? 0;
    if (!srcLen) continue;
    const chunkEnd = chunk.timestamp + srcLen / chunk.sampleRate;
    if (chunkEnd <= fromSec || chunk.timestamp >= toSec) continue;   // wholly outside: the straddle trim

    // Fold surround to stereo BEFORE resample/place - fewer channels to resample, and
    // the placement loop then reads real L/R. Mono/stereo pass through unchanged.
    const srcChannels = chunk.channels.length > 2 ? downmixToStereo(chunk.channels) : chunk.channels;

    // Resample first, then place: doing it the other way round would round the
    // offset at the source rate and drift by up to a sample per chunk.
    const needsResample = Math.abs(chunk.sampleRate - sampleRate) > 1e-6;
    const dstLen = needsResample ? Math.max(1, Math.round((srcLen / chunk.sampleRate) * sampleRate)) : srcLen;
    const dstStart = Math.round((chunk.timestamp - fromSec) * sampleRate);

    for (let c = 0; c < targetChannels; c++) {
      // Mono source into a stereo window: duplicate rather than leave a dead channel.
      const src = srcChannels[Math.min(c, srcChannels.length - 1)] as Float32Array;
      const data = needsResample ? resampleLinear(src, chunk.sampleRate, sampleRate, dstLen) : src;
      const target = out[c] as Float32Array;
      // Head trim (chunk starts before the window) and tail trim (runs past it).
      const skip = dstStart < 0 ? -dstStart : 0;
      const writeAt = dstStart < 0 ? 0 : dstStart;
      const count = Math.min(data.length - skip, length - writeAt);
      for (let i = 0; i < count; i++) target[writeAt + i] = data[skip + i] as number;
    }
  }
  return { channels: out, sampleRate };
}

// ── in-flight accounting ────────────────────────────────────────────────────

/**
 * The sample ledger. Every acquire/release goes through it, so `stats()` gives
 * the actual count, not a best-effort estimate. An accounting bug trips a coded
 * error in a test instead of an OOM in a user's 30-second export.
 */
function createLedger(kind: 'mediabunny' | 'element') {
  const s: ProviderStats = {
    kind,
    inFlight: 0,
    maxInFlight: 0,
    decoded: 0,
    missed: 0,
    requests: 0,
    firstRequestSec: -1,
    lastRequestSec: -1,
    unreachable: 0,
    claimedDurationSec: 0,
    sourceFrameSec: 0,
    lastSourceSec: -1,
    randomAccess: false,
  };
  return {
    stats: (): ProviderStats => ({ ...s }),
    raw: s,
    /** Record one request, in the source's own time domain. */
    request(sec: number): void {
      s.requests++;
      if (s.firstRequestSec < 0) s.firstRequestSec = sec;
      s.lastRequestSec = sec;
      if (s.claimedDurationSec > 0 && sec >= s.claimedDurationSec) s.unreachable++;
    },
    acquire(): void {
      s.inFlight++;
      if (s.inFlight > s.maxInFlight) s.maxInFlight = s.inFlight;
      if (s.inFlight > MAX_IN_FLIGHT) {
        // Not a warning: exceeding the cap means a close was missed somewhere,
        // and the leak is invisible to the JS heap (see the header).
        throw coded(
          new Error(`sequence provider held ${s.inFlight} samples (max ${MAX_IN_FLIGHT})`),
          'SEQ_TOO_HEAVY',
        );
      }
    },
    release(): void {
      if (s.inFlight > 0) s.inFlight--;
    },
  };
}

// ── the mediabunny frame provider ───────────────────────────────────────────

export interface ProviderOpts {
  /** Per-operation deadline. Default OP_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Force the element-seek path (used by the renderer when a codec is refused). */
  forceElement?: boolean;
  /** Log sink; failures that are recovered from are logged, never thrown. */
  log?(level: string, msg: string): void;
  /** Test seams. Never set in production code. */
  deps?: ProviderDeps;
}

/** Everything a test needs to replace, in one bag. */
export interface ProviderDeps {
  loadMediabunny?(): Promise<MediabunnyModule>;
  hasWebCodecs?(): boolean;
  /** Build the fallback. Given a URL because a hidden <video> needs one. */
  elementProvider?(url: string, opts: ProviderOpts): Promise<InstrumentedProvider>;
}

const srcUrl = (src: Blob | string): { url: string; revoke: boolean } => {
  if (typeof src === 'string') return { url: src, revoke: false };
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw coded(new Error('no URL.createObjectURL for the element fallback'), 'SEQ_UNSUPPORTED_MEDIA');
  }
  return { url: URL.createObjectURL(src), revoke: true };
};

/**
 * Open a clip and return the best provider for THAT clip.
 *
 * Per-clip, not per-session (section 2.2): a composition can mix an H.264 clip the
 * hardware decoder handles and a HEVC one it refuses. One refusal must not
 * demote the whole export to element seeking. The ladder is:
 *
 *   no WebCodecs → element
 *   mediabunny opens + `track.canDecode()` → mediabunny
 *   anything else (unsupported container, no video track, a decoder that says
 *   no, a throw) → element, with the coded reason logged
 *
 * The element provider is genuinely last. If it fails too, the coded error is
 * thrown, because at that point there is no way to paint the clip, and a
 * silent export with a black hole in it is worse than a failure.
 */
export async function createVideoProvider(src: Blob | string, opts: ProviderOpts = {}): Promise<InstrumentedProvider> {
  const deps = opts.deps ?? {};
  const log = opts.log ?? ((): void => {});
  const timeout = opts.timeoutMs ?? OPEN_TIMEOUT_MS;

  const wantElement = opts.forceElement === true;
  const hasWc = deps.hasWebCodecs ? deps.hasWebCodecs() : (await providerCapability()).webcodecs;

  if (!wantElement && hasWc) {
    try {
      return await withTimeout(openMediabunnyProvider(src, opts), timeout, 'open (mediabunny)');
    } catch (err) {
      const e = err as Error & { code?: string };
      log('warn', `sequence provider: mediabunny declined (${e.code ?? 'error'}: ${e.message}) - falling back to element seek`);
    }
  }
  const make = deps.elementProvider ?? createElementProvider;
  const { url, revoke } = srcUrl(src);
  try {
    return await make(url, opts);
  } catch (err) {
    if (revoke) { try { URL.revokeObjectURL(url); } catch { /* already gone */ } }
    throw coded(err, 'SEQ_UNSUPPORTED_MEDIA');
  }
}

async function openMediabunnyProvider(src: Blob | string, opts: ProviderOpts): Promise<InstrumentedProvider> {
  const deps = opts.deps ?? {};
  const timeout = opts.timeoutMs ?? OP_TIMEOUT_MS;
  const log = opts.log ?? ((): void => { /* silent by default */ });
  const mb = await (deps.loadMediabunny ?? loadMediabunny)();

  const source = typeof src === 'string' ? new mb.UrlSource(src) : new mb.BlobSource(src);
  // Explicit singletons only - see the header, and the source guard in the tests.
  const input = new mb.Input({ formats: VIDEO_CONTAINERS(mb), source });

  let track: MbVideoTrack | null = null;
  try {
    track = await input.getPrimaryVideoTrack();
  } catch (err) {
    input.dispose();
    throw coded(err, 'SEQ_UNSUPPORTED_MEDIA');
  }
  if (!track) {
    input.dispose();
    throw coded(new Error('no video track'), 'SEQ_UNSUPPORTED_MEDIA');
  }
  // Always gate on canDecode: without it the sink throws a plain `Error` later,
  // mid-export, instead of here where the fallback is still available.
  let decodable = false;
  try {
    decodable = await track.canDecode();
  } catch { decodable = false; }
  if (!decodable) {
    input.dispose();
    throw coded(new Error('track cannot be decoded here'), 'SEQ_UNSUPPORTED_MEDIA');
  }

  let w = 0;
  let h = 0;
  let duration = 0;
  try {
    [w, h, duration] = await Promise.all([
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      // Never getDurationFromMetadata(): a fragmented MP4 out of MediaRecorder
      // reports 0.100 s for a 3.010 s file (spike rule 1). computeDuration costs
      // 0.2 ms and gives the real answer.
      input.computeDuration(),
    ]);
  } catch (err) {
    input.dispose();
    throw coded(err, 'SEQ_UNSUPPORTED_MEDIA');
  }

  // What the file CLAIMS, alongside what it can actually deliver. Never used as
  // THE duration (spike rule 1: a fragmented MP4 out of MediaRecorder reports
  // 0.100 s for a 3.010 s file). It is only the cross-check that separates a
  // truncated container from a clip trimmed past the end of an intact one.
  let claimed = duration;
  try {
    const meta = await input.getDurationFromMetadata?.();
    if (typeof meta === 'number' && Number.isFinite(meta) && meta > claimed) claimed = meta;
  } catch { /* metadata duration is a bonus, never a requirement */ }

  const sink = new mb.VideoSampleSink(track);
  const ledger = createLedger('mediabunny');
  ledger.raw.claimedDurationSec = claimed;

  let primed: number[] = [];
  let cursor = 0;
  let gen: AsyncGenerator<MbSample | null, void, unknown> | null = null;
  let disposed = false;

  /**
   * Let the primed generator go.
   *
   * `abandoned` distinguishes the two reasons, because they mean opposite things
   * to whoever reads `stats().randomAccess`: reaching the end of the grid means
   * the fast path SUCCEEDED, while a stall or a re-prime means it was abandoned.
   */
  const dropGenerator = (abandoned = true): void => {
    const g = gen;
    gen = null;
    primed = [];
    cursor = 0;
    if (abandoned) ledger.raw.randomAccess = true;
    if (g) { void Promise.resolve(g.return(undefined)).catch(() => { /* already finished */ }); }
  };

  /** Pull one sample off the primed generator, counted and time-boxed. */
  const pull = async (): Promise<MbSample | null> => {
    const g = gen;
    if (!g) return null;
    const res = await withTimeout(g.next(), timeout, 'decode (primed)');
    if (res.done) { gen = null; return null; }
    const sample = res.value;
    if (sample) ledger.acquire();
    return sample;
  };

  const closeSample = (sample: MbSample): void => {
    try { sample.close(); } finally { ledger.release(); }
  };

  // ── the sequential rescue: for containers timestamp addressing goes blind on ──
  //
  // A MediaRecorder capture writes no Cues element (no seek index), and on such a
  // file mediabunny's timestamp addressing - samplesAtTimestamps AND getSample -
  // returns null for every instant past the first cluster, while the plain cluster
  // walk `samples(from, to)` reads every frame from ANY offset (measured on a real
  // capture: getSample(t) null for all t >= 0.4 s of a 2.2 s file; samples(1.8, end)
  // complete). Real users upload exactly these files - screen recordings, Meet
  // exports - so a miss the file's own computeDuration() contradicts switches this
  // clip to a monotonic walk: each packet decoded once, the primed grid's own cost
  // profile. Export grids are monotonic, so one walk serves the whole clip.
  //
  // KNOWN CEILING: when the output grid is denser than the source (60 fps export of
  // a 30 fps file) the walk can serve a frame half a source-frame early - it holds
  // ONE look-ahead sample, never a back-buffer, to stay inside MAX_IN_FLIGHT. Only
  // index-poor files ever enter this path, and a half-frame nudge beats the black
  // frame / SEQ_TRUNCATED refusal it replaces.
  let seqGen: AsyncGenerator<MbSample | null, void, unknown> | null = null;
  /** The walk sample currently ON SCREEN. Owned here, never by drawAt's close - it is
   *  re-served for every end-hold (a clip trimmed past its media redraws its last
   *  frame) and for a grid denser than the source, without re-opening the walk. */
  let seqServed: MbSample | null = null;
  let seqAhead: MbSample | null = null;
  let seqLastT = -1;
  let addressingBlind = false;   // once true, skip the doomed addressing for this clip

  const dropSeq = (): void => {
    const g = seqGen;
    seqGen = null;
    if (seqServed) { closeSample(seqServed); seqServed = null; }
    if (seqAhead) { closeSample(seqAhead); seqAhead = null; }
    seqLastT = -1;
    if (g) { void Promise.resolve(g.return(undefined)).catch(() => { /* already finished */ }); }
  };

  const pullSeq = async (): Promise<MbSample | null> => {
    const g = seqGen;
    if (!g) return null;
    const res = await withTimeout(g.next(), timeout, 'decode (sequential walk)');
    if (res.done) { seqGen = null; return null; }
    if (res.value) ledger.acquire();
    return res.value ?? null;
  };

  /**
   * The latest frame at or before `t` off the walk (or, past the walk's end, the
   * retained tail). The returned sample stays OWNED by the walk - the caller draws
   * it and must NOT close it; dropSeq/dispose do.
   */
  const sampleSequential = async (t: number): Promise<MbSample | null> => {
    // The walk is over and the frame in hand still answers: an end-hold.
    if (!seqGen && !seqAhead && seqServed && t >= seqServed.timestamp) return seqServed;
    if ((!seqGen && !seqAhead) || t < seqLastT) {
      dropSeq();
      try { seqGen = sink.samples(t, duration); } catch { seqGen = null; return null; }
    }
    seqLastT = t;
    try {
      for (;;) {
        const next = seqAhead ?? await pullSeq();
        seqAhead = null;
        if (!next) return seqServed;             // exhausted: hold whatever is on screen
        if (next.timestamp > t && seqServed) { seqAhead = next; return seqServed; }
        if (seqServed) closeSample(seqServed);
        seqServed = next;
        if (seqServed.timestamp > t) return seqServed;   // first frame already past t
      }
    } catch (err) {
      dropSeq();
      throw coded(err, 'SEQ_DECODE_FAILED');
    }
  };

  const provider: InstrumentedProvider = {
    get w() { return w; },
    get h() { return h; },
    durationSec: () => duration,
    stats: ledger.stats,

    prime(timestamps) {
      if (disposed) return;
      // Addressing already proved blind on this file: a primed grid would yield
      // nothing but nulls, so leave the sequential walk in charge.
      if (addressingBlind) return;
      dropGenerator();
      const list = timestamps.filter((t) => Number.isFinite(t)).map((t) => Math.max(0, t));
      // A grid that is not sorted would defeat the whole point of
      // samplesAtTimestamps (one decode per packet), so it is refused rather
      // than silently sorted. A caller handing an unsorted grid has a bug the
      // renderer needs to see, and random access still produces correct pixels.
      for (let i = 1; i < list.length; i++) {
        if ((list[i] as number) < (list[i - 1] as number)) return;
      }
      if (!list.length) return;
      primed = list;
      cursor = 0;
      ledger.raw.randomAccess = false;
      gen = sink.samplesAtTimestamps(list);
    },

    async drawAt(ctx, sourceSec, dest) {
      if (disposed) throw coded(new Error('provider disposed'), 'SEQ_ABORTED');
      const t = Number.isFinite(sourceSec) ? Math.max(0, sourceSec) : 0;
      ledger.request(t);
      // A request past the media's own end HOLDS THE LAST FRAME, matching both the
      // preview (sequence-clock's MEDIA_END_EPS_S rule) and the element provider
      // (currentTime clamps) - without this a clip trimmed longer than its media
      // simply vanished from the rendered file while the preview kept showing it.
      // The ledger got the RAW time first: `unreachable` is how reconcile excuses
      // asks past an intact file's end, and that accounting must stay truthful.
      const tc = Math.min(t, Math.max(0, duration - 0.001));
      let sample: MbSample | null = null;
      let fromWalk = false;

      const plan = gen ? planPull(primed, cursor, t) : { mode: 'random' as const, advance: 0, index: cursor };
      if (plan.mode === 'primed') {
        try {
          for (let i = 0; i < plan.advance; i++) {
            const next = await pull();
            // Frames the caller skipped over: close IMMEDIATELY, never batched.
            // Holding them to the end of the loop is exactly how a two-sample
            // cap becomes a hundred.
            if (sample) closeSample(sample);
            sample = next;
          }
          cursor = plan.index + 1;
          // The grid is spent: release the generator, but this is the fast path
          // finishing its job, not being abandoned.
          if (cursor >= primed.length) dropGenerator(false);
        } catch (err) {
          if (sample) closeSample(sample);
          sample = null;
          // A timeout leaves the generator in an unknown state: abandon the
          // fast path for the rest of this clip and retry the frame through
          // random access. A real decode error is the file's answer for this
          // frame, though, and retrying would just get it twice.
          dropGenerator();
          if (!isSeqTimeout(err)) throw coded(err, 'SEQ_DECODE_FAILED');
        }
      }

      if (!sample && !addressingBlind) {
        try {
          sample = await withTimeout(sink.getSample(tc), timeout, 'decode (random access)');
          if (sample) ledger.acquire();
        } catch (err) {
          throw coded(err, 'SEQ_DECODE_FAILED');
        }
      }

      // Addressing found nothing for an instant the file's own duration says exists:
      // an index-poor container. Walk instead - see sampleSequential.
      if (!sample) {
        sample = await sampleSequential(tc);
        fromWalk = !!sample;
        if (sample && !addressingBlind) {
          addressingBlind = true;
          dropGenerator();   // the primed grid would only yield more nulls
          log('warn', 'sequence provider: this file has no usable seek index - decoding it as a straight walk instead');
        }
      }

      if (!sample) { ledger.raw.missed++; return false; }
      try {
        sample.draw(ctx, dest.dx, dest.dy, dest.dw, dest.dh);
        ledger.raw.decoded++;
        ledger.raw.lastSourceSec = sample.timestamp;
        // The source's own frame interval, straight off the sample. The
        // truncation tolerance has to absorb one of these (a PTS can lag its
        // request by up to this much).
        if (Number.isFinite(sample.duration) && sample.duration > 0) {
          ledger.raw.sourceFrameSec = Math.max(ledger.raw.sourceFrameSec, sample.duration);
        }
        return true;
      } catch (err) {
        throw coded(err, 'SEQ_UNSUPPORTED_MEDIA');
      } finally {
        // Same tick as the draw, on every path including a throwing draw. A WALK
        // sample is the one exception: sampleSequential retains it for end-holds
        // and denser grids, and dropSeq/dispose own its close.
        if (!fromWalk) closeSample(sample);
      }
    },

    async dispose() {
      if (disposed) return;
      disposed = true;
      dropSeq();
      dropGenerator();
      // Give the abandoned generator its return() a microtask to land before the
      // input pulls the decoders out from under it.
      await Promise.resolve();
      try { input.dispose(); } catch { /* already disposed */ }
    },
  };
  return provider;
}

// ── the element-seek fallback provider ──────────────────────────────────────

type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?(cb: (now: number, meta: { mediaTime?: number }) => void): number;
  cancelVideoFrameCallback?(handle: number): void;
};

const isCrossOrigin = (url: string): boolean => {
  if (typeof location === 'undefined') return false;
  if (!/^https?:/i.test(url)) return false;
  try { return new URL(url, location.href).origin !== location.origin; } catch { return false; }
};

function waitMetadata(v: HTMLVideoElement, timeoutMs: number): Promise<boolean> {
  if (v.readyState >= 1 /* HAVE_METADATA */) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeEventListener('loadedmetadata', onOk);
      v.removeEventListener('error', onFail);
      resolve(ok);
    };
    const onOk = (): void => finish(true);
    const onFail = (): void => finish(false);
    const timer = setTimeout(() => finish(false), timeoutMs);
    v.addEventListener('loadedmetadata', onOk, { once: true });
    v.addEventListener('error', onFail, { once: true });
  });
}

/**
 * The fallback: a hidden <video>, seeked one frame at a time.
 *
 * Semantics come from the phase-2 clock, not a re-derivation. `createSeekQueue`
 * (never two seeks in flight on one element, the Safari rule) and
 * `waitSeekConfirmed` (rVFC `mediaTime` is the frame actually presented;
 * `currentTime` is only what we asked for) are imported, and the single
 * quarter-frame nudge on a short landing uses the clock's own tolerance
 * constants. Only ONE nudge: a decoder that cannot hit a time will not hit it
 * on the third try either, and a retry loop on a long-GOP file is a hang.
 *
 * Slower than decode by an order of magnitude, and only as accurate as the
 * engine's seeking, which is why it is the fallback and not the default.
 */
export async function createElementProvider(url: string, opts: ProviderOpts = {}): Promise<InstrumentedProvider> {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    // Tagged `offload`: this is the LAST rung of the provider ladder, and it is
    // missing only because we are in a worker. A clip mediabunny declined (an
    // exotic container, a codec with no hardware decoder) is perfectly decodable
    // by a <video> on the main thread. So this must not reach the user as an
    // "unsupported media" verdict; it must send the render back in-thread, where
    // this provider exists. See `SeqWorkerFail.offload` in sequence-render.worker.ts.
    const err = coded(new Error('no DOM for the element-seek provider'), 'SEQ_UNSUPPORTED_MEDIA');
    (err as unknown as Record<string, unknown>).offload = true;
    throw err;
  }
  const timeout = opts.timeoutMs ?? OP_TIMEOUT_MS;
  const ledger = createLedger('element');
  const objectUrl = url.startsWith('blob:');

  const v = document.createElement('video') as RvfcVideo;
  v.preload = 'auto';
  v.muted = true;
  v.defaultMuted = true;
  v.autoplay = false;
  v.setAttribute('playsinline', '');
  v.setAttribute('aria-hidden', 'true');
  // Attached but off-screen: a detached <video> is allowed to skip decoding in
  // some engines, and then no seek ever presents a frame.
  v.style.cssText = 'position:absolute;left:-99999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  if (isCrossOrigin(url)) v.crossOrigin = 'anonymous';
  document.body.appendChild(v);
  v.src = url;
  try { v.load(); } catch { /* some engines auto-load */ }

  let disposed = false;
  let queue: SeekQueue | null = null;

  const teardown = (): void => {
    queue?.clear();
    queue = null;
    try {
      v.pause?.();
      v.removeAttribute('src');
      v.load?.();
      v.remove();
    } catch { /* already detached */ }
    if (objectUrl) { try { URL.revokeObjectURL(url); } catch { /* already gone */ } }
  };

  const ok = await waitMetadata(v, Math.min(timeout, METADATA_TIMEOUT_MS));
  if (!ok) {
    teardown();
    throw coded(new Error(`element provider could not load metadata for ${url}`), 'SEQ_UNSUPPORTED_MEDIA');
  }
  queue = createSeekQueue(v, (el, signal) => waitSeekConfirmed(el as HTMLVideoElement & { currentTime: number }, signal));

  const duration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
  const w = v.videoWidth || 0;
  const h = v.videoHeight || 0;
  // An element reports the length the CONTAINER states, which is exactly the
  // "claimed" number the truncation guard wants (a truncated file still states
  // its original length in its header). There is no second, packet-walked
  // number here.
  ledger.raw.claimedDurationSec = duration;

  return {
    get w() { return w; },
    get h() { return h; },
    durationSec: () => duration,
    stats: ledger.stats,

    async drawAt(ctx, sourceSec, dest) {
      if (disposed) throw coded(new Error('provider disposed'), 'SEQ_ABORTED');
      const q = queue;
      if (!q) return false;
      const raw = Number.isFinite(sourceSec) ? Math.max(0, sourceSec) : 0;
      ledger.request(raw);
      // Past the source's end the target stops moving; hold the last frame
      // rather than asking for a time the decoder will never present.
      const target = duration > 0 ? Math.min(raw, Math.max(0, duration - MEDIA_END_EPS_S)) : raw;

      let landed: number | null;
      try {
        landed = await withTimeout(q.seek(target, { supersede: false }), timeout, 'seek');
        if (landed != null && Math.abs(landed - target) > SEEK_TOLERANCE_S) {
          // One nudge, a quarter-frame past the target: decoders routinely land
          // on the preceding keyframe.
          landed = await withTimeout(q.seek(target + SEEK_NUDGE_S), timeout, 'seek (nudge)');
        }
      } catch (err) {
        throw coded(err, 'SEQ_DECODE_FAILED');
      }
      if (landed == null && v.readyState < 2 /* HAVE_CURRENT_DATA */) { ledger.raw.missed++; return false; }

      // The element itself IS the sample: it is acquired and released around the
      // single draw so the in-flight ledger reads the same way as mediabunny's.
      ledger.acquire();
      try {
        // CONTAINER ROTATION IS THE BROWSER'S JOB HERE, and it does it. A phone films
        // landscape pixels + a 90/270 rotation TAG; modern Chromium BAKES that tag into
        // the frame the element presents, so `videoWidth/Height` (this provider's w/h)
        // already report the turned display size and `drawImage(v)` already paints the
        // turned picture. Re-applying track.getRotation() on top would DOUBLE-rotate,
        // which is why this path deliberately does NO rotation of its own - matching the
        // mediabunny path, where sample.draw() bakes the same tag. Verified against real
        // Chrome on a 90°-tagged MP4 (plan 153 QW4; guarded by the "OBSERVE: element-seek
        // fallback vs a 90°-tagged MP4" browser golden). WebM never reaches this concern:
        // it cannot carry rotation metadata at all (MkvOutputFormat forbids it).
        ctx.drawImage(v as unknown as CanvasImageSource, dest.dx, dest.dy, dest.dw, dest.dh);
        ledger.raw.decoded++;
        ledger.raw.lastSourceSec = landed ?? target;
        // An element seek has no sample duration to report, but it DOES accept
        // landing up to SEEK_TOLERANCE_S short of the target. That is this
        // provider's PTS lag, and the truncation tolerance must absorb it.
        ledger.raw.sourceFrameSec = SEEK_TOLERANCE_S;
        return true;
      } catch (err) {
        // A tainted canvas (no CORS headers) is not recoverable by retrying.
        throw coded(err, 'SEQ_UNSUPPORTED_MEDIA');
      } finally {
        ledger.release();
      }
    },

    async dispose() {
      if (disposed) return;
      disposed = true;
      teardown();
      await Promise.resolve();
    },
  };
}

// ── clip audio ──────────────────────────────────────────────────────────────

export interface ClipAudioOpts {
  timeoutMs?: number;
  log?(level: string, msg: string): void;
  deps?: {
    loadMediabunny?(): Promise<MediabunnyModule>;
    hasWebCodecs?(): boolean;
    /**
     * Render a composed ZzFXM song to PCM. Injected by the tests (the shipped
     * renderer is a Worker, which Node's test tier has no use for) and by any
     * caller that already owns a render pool. Default: `lib/zzfxm-render.ts`.
     */
    renderSong?(song: ZzfxSong): Promise<RenderedPcm>;
    /**
     * Render tracker-module BYTES to PCM. Injected by the tests (the shipped renderer
     * is a libopenmpt Worker). Default: `lib/mod-render.ts`, imported lazily.
     */
    renderModule?(bytes: Uint8Array, sampleRate: number): Promise<RenderedPcm>;
    /**
     * Read a source's bytes, for the module sniff. Injected by the tests; the default
     * is a size-bounded fetch through the shared audio-decode ceiling.
     */
    fetchBytes?(src: Blob | string): Promise<Uint8Array | null>;
  };
  /**
   * Length, in seconds, the PROCEDURAL source composes itself to. Only the
   * `zzfxm:` scheme reads it; a decoded file has an intrinsic length and ignores
   * it. Omitted (the mix's case, which cannot know it here) → derived from the
   * end of the first requested window. See `zzfxmTargetSec`.
   */
  targetSec?: number;
}

/**
 * A clip's audio track, or null when there isn't one.
 *
 * `null` is the ordinary answer, not a failure: most boxes are silent, and the
 * mix must not care. It is also the answer when the platform has no
 * `AudioDecoder` or the track's codec is refused. There is no element-based
 * fallback for PCM (an <audio> element cannot hand you sample data offline), so
 * the renderer's choice is a silent clip or a failed export. A silent clip is
 * the one that still produces a usable file.
 */
export async function createClipAudio(src: Blob | string, opts: ClipAudioOpts = {}): Promise<ClipAudio | null> {
  const deps = opts.deps ?? {};
  const log = opts.log ?? ((): void => {});
  const timeout = opts.timeoutMs ?? OPEN_TIMEOUT_MS;

  // A procedural track is decided BEFORE the WebCodecs gate: it is synthesised
  // sample by sample in plain JS, so it is the one audio source that still
  // works on a platform with no AudioDecoder at all.
  if (typeof src === 'string') {
    const ref = parseZzfxmRef(src);
    if (ref) return openZzfxmAudio(ref, opts);
    if (src.startsWith(ZZFXM_SCHEME)) {
      log('warn', `sequence audio: "${src}" is not a valid ${ZZFXM_SCHEME} ref - clip will be silent`);
      return null;
    }
    // A source that NAMES itself a tracker module never goes near the demuxer:
    // no container reads one, and libopenmpt does not need WebCodecs to render
    // it. A failure here is final - the file said what it was and could not be
    // honoured - so it warns instead of falling through to a demux attempt that
    // cannot work.
    if (isModuleUrl(src)) {
      const clip = await openModuleAudio(src, opts, 'declared');
      if (!clip) {
        log('warn', `sequence audio: ${src.slice(0, 120)} is a tracker module that could not be rendered - clip will be silent`);
      }
      return clip;
    }
  }

  const hasWc = deps.hasWebCodecs ? deps.hasWebCodecs() : (await providerCapability()).webcodecs;
  if (hasWc) {
    try {
      const clip = await withTimeout(openClipAudio(src, opts), timeout, 'open (audio)');
      // A clean null means the container OPENED and simply has no decodable
      // audio track: the ordinary answer for a silent video, and definitely not
      // a module.
      if (clip) return clip;
      return null;
    } catch (err) {
      const e = err as Error & { code?: string };
      // Nothing could open it. Before calling it silence, ask the last question
      // the ladder has: an uploaded module arrives as a `blob:` url with no
      // extension and a guessed MIME type, so the BYTES are the only thing that
      // can identify it.
      const mod = await openModuleAudio(src, opts, 'sniffed');
      if (mod) return mod;
      log('warn', `sequence audio: ${e.code ?? 'error'}: ${e.message} - clip will be silent`);
      return null;
    }
  }
  // No WebCodecs at all: a module still plays (it is rendered in plain WASM),
  // so the sniff is the whole ladder for this provider, not just its last rung.
  return await openModuleAudio(src, opts, 'sniffed');
}

async function openClipAudio(src: Blob | string, opts: ClipAudioOpts): Promise<ClipAudio | null> {
  const deps = opts.deps ?? {};
  const timeout = opts.timeoutMs ?? OP_TIMEOUT_MS;
  const mb = await (deps.loadMediabunny ?? loadMediabunny)();
  const source = typeof src === 'string' ? new mb.UrlSource(src) : new mb.BlobSource(src);
  const input = new mb.Input({ formats: AUDIO_CONTAINERS(mb), source });

  let track: MbAudioTrack | null = null;
  try {
    track = await input.getPrimaryAudioTrack();
  } catch (err) {
    input.dispose();
    throw coded(err, 'SEQ_UNSUPPORTED_MEDIA');
  }
  if (!track) { input.dispose(); return null; }
  let decodable = false;
  try { decodable = await track.canDecode(); } catch { decodable = false; }
  if (!decodable) { input.dispose(); return null; }

  let duration = 0;
  try { duration = await input.computeDuration(); } catch { duration = 0; }

  const sink = new mb.AudioBufferSink(track);
  let disposed = false;

  return {
    durationSec: () => duration,

    async pcm(fromSec, toSec, sampleRate) {
      if (disposed) throw coded(new Error('clip audio disposed'), 'SEQ_ABORTED');
      const from = Math.max(0, Number.isFinite(fromSec) ? fromSec : 0);
      const to = Math.max(from, Number.isFinite(toSec) ? toSec : from);
      const chunks: PcmChunk[] = [];
      // A manual next() loop would have to call it.return() itself; `for await`
      // does that on break/throw, which is why the whole read is inside one.
      const iter = sink.buffers(from, to);
      const deadline = withTimeout(
        (async () => {
          for await (const wrapped of iter) {
            const buf = wrapped.buffer;
            const channels: Float32Array[] = [];
            for (let c = 0; c < buf.numberOfChannels; c++) {
              // Copy: the sink is free to recycle the underlying storage once
              // the iterator advances, and these outlive the loop.
              channels.push(Float32Array.from(buf.getChannelData(c)));
            }
            chunks.push({ channels, sampleRate: buf.sampleRate, timestamp: wrapped.timestamp });
          }
        })(),
        timeout,
        'audio decode',
      );
      try {
        await deadline;
      } catch (err) {
        try { await iter.return(undefined); } catch { /* generator already finished */ }
        throw coded(err, 'SEQ_DECODE_FAILED');
      }
      // The trim (spike rule 6) happens here, in the pure assembler.
      return assemblePcmWindow(chunks, from, to, sampleRate);
    },

    async dispose() {
      if (disposed) return;
      disposed = true;
      try { input.dispose(); } catch { /* already disposed */ }
      await Promise.resolve();
    },
  };
}

// ── tracker modules: .mod/.xm/.it/.s3m/.stm/.mtm ────────────────────────────
//
// A tracker module is a SCORE: patterns of notes plus the instrument samples
// they play. There is no encoded audio stream in the file, and no demuxer
// reads one. mediabunny returns nothing for it, which is exactly how an audio
// box holding a module came out silent, with the export log saying only that
// the container was unreadable. libopenmpt (lib/mod-render.ts, a vendored WASM
// worker) is the one thing here that can render one, and it is already the
// path the export bar's music bed uses for a 'mod'-format track
// (views/tool-actions.ts). So this is a wiring job, not a new capability.
//
// WHAT IT IS NOT: a second decode pipeline. The rendered PCM goes through the
// same `assemblePcmWindow` a decoded file and a zzfxm song go through, so the
// trim, the resample to the mix rate and the window semantics are literally
// the same code.
//
// HOW ONE IS RECOGNISED: `isModuleUrl` / `sniffTrackerModule`, imported from
// the clock so the preview cannot disagree. See that file's "tracker modules"
// section for why the extension alone is not enough (an upload is a `blob:`
// url), and why the AssetRef `format` field, which would be the honest signal,
// does not survive as far as here.
//
// WHY `renderMod` AND NOT `modUrlToWavBlobUrl`: the WAV round trip exists for
// the URL-driven muxer, which can only be handed a url. Here the caller wants
// samples, and `renderMod` already returns exactly the `{left, right,
// sampleRate}` the zzfxm path returns. Taking the WAV detour would mean
// encoding a RIFF header, minting a blob url, re-fetching it and demuxing it
// back to the same floats. (WAVE is registered in AUDIO_CONTAINERS, so that
// route would work; it is simply two conversions and a revoke-or-leak worse
// than not doing it.)

/**
 * Ceiling on ONE module's rendered PCM, bytes.
 *
 * The real bound is upstream: lib/mod-worker.ts stops at `MAX_SECONDS` (480 s),
 * which at 48 kHz stereo f32 is about 184 MB. This is the assertion that it
 * did. A module declares its own length, and a malformed one can claim to loop
 * forever, so if that cap is ever raised or bypassed, this fails loudly with a
 * warning instead of quietly allocating whatever the file asked for.
 */
export const MAX_MODULE_PCM_BYTES = 200 * 1024 * 1024;

/** Extensions that have already said they are something else. Skipped by the sniff so
 *  an ordinary clip never pays for a speculative read on a failure path. */
const NON_MODULE_EXT = /^(?:mp4|m4v|mov|webm|mkv|mp3|ogg|oga|opus|m4a|aac|flac|wav|wave|aif|aiff|gif|png|jpg|jpeg|svg|json)$/;

/** The shipped renderer, lazily imported so libopenmpt's WASM stays out of the eager
 *  graph - the same rule mediabunny follows above, and for a rarer format. */
async function defaultRenderModule(bytes: Uint8Array, sampleRate: number): Promise<RenderedPcm> {
  const mod = await import('../lib/mod-render.ts');
  return mod.renderMod(bytes, sampleRate);
}

/**
 * A source's bytes, bounded by the SHARED audio-decode ceiling.
 *
 * `MAX_AUDIO_DECODE_BYTES` is the same 6 MiB the waveform reader and the
 * preview decoder use, so "too big to draw", "too big to hear" and "too big to
 * export" agree. It is generous for a module (a big .it with its samples is a
 * couple of MB), and it is what stops a speculative sniff on a 500 MB video
 * from buffering the whole file.
 */
async function fetchModuleBytes(src: Blob | string, opts: ClipAudioOpts): Promise<Uint8Array | null> {
  const custom = opts.deps?.fetchBytes;
  if (custom) return await custom(src);
  if (typeof src !== 'string') {
    if (src.size > MAX_AUDIO_DECODE_BYTES) return null;
    return new Uint8Array(await src.arrayBuffer());
  }
  if (typeof fetch !== 'function') return null;
  const res = await fetch(src);
  if (!res.ok) return null;
  const declared = Number(res.headers?.get?.('content-length') ?? Number.NaN);
  if (!withinDecodeBudget(Number.isFinite(declared) ? declared : null)) return null;
  const buf = await readBounded(res, MAX_AUDIO_DECODE_BYTES);
  return buf ? new Uint8Array(buf) : null;
}

/**
 * Open a tracker module as clip audio, or null when this source is not one (or
 * cannot be read at all).
 *
 * `mode` is the difference between the two call sites: 'declared' means the
 * url named itself a module and the bytes are fetched on that word alone.
 * 'sniffed' is the speculative last rung: the bytes have to identify
 * themselves, and anything that does not is handed straight back so the
 * caller can report its own failure.
 *
 * Never throws: every failure is a null, and the caller owns the warning,
 * because only the caller knows whether a silent source is a surprise (an
 * audio box) or the ordinary case (a video with no soundtrack).
 */
async function openModuleAudio(
  src: Blob | string, opts: ClipAudioOpts, mode: 'declared' | 'sniffed',
): Promise<ClipAudio | null> {
  const timeout = opts.timeoutMs ?? OPEN_TIMEOUT_MS;
  if (mode === 'sniffed' && typeof src === 'string' && NON_MODULE_EXT.test(urlExtension(src))) return null;
  let bytes: Uint8Array | null = null;
  try {
    bytes = await withTimeout(fetchModuleBytes(src, opts), timeout, 'read (tracker module)');
  } catch {
    return null;                                   // unreadable, oversized, or a stall
  }
  if (!bytes || bytes.length < 32) return null;
  if (mode === 'sniffed' && !sniffTrackerModule(bytes)) return null;
  return moduleClip(bytes, opts);
}

/**
 * A `ClipAudio` backed by libopenmpt.
 *
 * DEFERRED like the procedural one, and for the same reason: the first
 * `pcm()` call is the first moment anything knows the mix rate, and rendering
 * natively at that rate is one resample better than rendering at 48 kHz and
 * converting. The render happens ONCE. The worker takes ownership of the byte
 * buffer (it is transferred), so there is nothing to render a second time, and
 * a failed render is remembered as a failure instead of retried against bytes
 * that are already gone.
 *
 * `durationSec()` is 0 until the render lands, the same "no intrinsic length
 * to declare yet" the procedural clip reports. The mix already handles that
 * case: the box is asked for exactly the window it occupies, and the
 * assembler zero-fills any tail past the end of the song. A module does NOT
 * loop to fill its box, and neither does an mp3; the preview's
 * AudioBufferSourceNode stops at the same place.
 */
function moduleClip(bytes: Uint8Array, opts: ClipAudioOpts): ClipAudio {
  const log = opts.log ?? ((): void => {});
  const timeout = opts.timeoutMs ?? OP_TIMEOUT_MS;
  const render = opts.deps?.renderModule ?? defaultRenderModule;
  let disposed = false;
  let source: Uint8Array | null = bytes;
  let pending: Promise<RenderedPcm> | null = null;
  let duration = 0;

  return {
    durationSec: () => duration,

    async pcm(fromSec, toSec, sampleRate) {
      if (disposed) throw coded(new Error('clip audio disposed'), 'SEQ_ABORTED');
      const from = Math.max(0, Number.isFinite(fromSec) ? fromSec : 0);
      const to = Math.max(from, Number.isFinite(toSec) ? toSec : from);
      if (!pending) {
        const b = source;
        source = null;                              // transferred to the worker below
        if (!b) throw coded(new Error('tracker module already failed to render'), 'SEQ_DECODE_FAILED');
        const rate = Number.isFinite(sampleRate) && sampleRate > 0 ? Math.round(sampleRate) : 48_000;
        pending = withTimeout(render(b, rate), timeout, 'tracker module render');
      }
      let pcm: RenderedPcm;
      try {
        pcm = await pending;
      } catch (err) {
        throw coded(err, 'SEQ_DECODE_FAILED');
      }
      if (disposed) throw coded(new Error('clip audio disposed'), 'SEQ_ABORTED');
      const frames = pcm.left.length;
      if (frames * 2 * 4 > MAX_MODULE_PCM_BYTES) {
        // Loud, and silent for this box only - the rest of the mix still renders.
        log('warn', `sequence audio: a tracker module rendered ${Math.round(frames / Math.max(1, pcm.sampleRate))}s of PCM, past the ${Math.round(MAX_MODULE_PCM_BYTES / (1024 * 1024))} MB ceiling - clip will be silent`);
        return { channels: [], sampleRate };
      }
      duration = pcm.sampleRate > 0 ? frames / pcm.sampleRate : 0;
      // The SAME pure assembler the decoded and procedural paths use.
      return assemblePcmWindow(
        [{ channels: [pcm.left, pcm.right], sampleRate: pcm.sampleRate, timestamp: 0 }],
        from, to, sampleRate,
      );
    },

    async dispose() {
      if (disposed) return;
      disposed = true;
      source = null;
      pending = null;
      await Promise.resolve();
    },
  };
}

// ── procedural audio: the `zzfxm:` scheme ───────────────────────────────────
//
// A sequence needs a music bed that is OFFLINE, REPRODUCIBLE and LICENCE-FREE.
// A catalog loop is none of those three: it is an on-demand fetch, it only
// exists in a brand pack that shipped it, and it carries whatever licence the
// track came with. So a box may instead carry a procedural asset ref, an id
// rather than a file, and this module synthesises the audio from it.
//
// THE GRAMMAR (the whole contract, deliberately tiny):
//
//     zzfxm:<seed>            e.g. zzfxm:20260726
//     zzfxm:<seed>:<style>    e.g. zzfxm:20260726:lofi
//
//   • `<seed>` is 1-10 DECIMAL DIGITS, read as a uint32. No sign, no `0x`, no
//     decimal point, no whitespace. Anything else is not a procedural ref at
//     all, so it can never be confused with a `blob:`/`data:`/`https:` url.
//   • `<style>` is optional and, when present, one of the engine's archetype
//     names. An unrecognised style is IGNORED (the seed picks the archetype,
//     as if the style had been omitted) instead of failing the bed: a typo in
//     a shared link should still play music. It is still deterministic; the
//     same unrecognised style always yields the same song.
//   • Nothing else is encoded. In particular NOT the length: the same ref is a
//     20-second bed under a 20-second sequence and a 90-second bed under a
//     90-second one, which is what makes the ref survive editing.
//
// WHY `durationSec()` RETURNS 0. A synthesised source has no intrinsic length;
// it is composed to fit. The mix in sequence-render.ts already handles that
// case: `srcDur > 0 ? min(from + durMs, srcDur) : from + durMs`, i.e. a source
// that declines to state a duration is asked for exactly the window the box
// occupies. That is exactly the semantics wanted here, so the procedural clip
// reports 0 and the mix needs no change at all.
//
// DETERMINISM IS THE POINT, AND HERE IS EXACTLY HOW FAR IT GOES. Every value
// in the SPEC comes from `mulberry32(seed)` (integer-only) or from the target
// length. There is no `Math.random`, no `Date`, no `performance.now`, no
// locale, no Map/Set iteration order and no platform read anywhere on that
// path. So the composed song (the notes, the tempo, the instruments, the
// arrangement) is identical everywhere, always.
//
// The RENDER is one step weaker, and the difference is worth stating rather
// than overclaiming: `zzfxG`'s sample loop uses `Math.sin`/`Math.cos`/`Math.tan`
// and `**`, whose results ECMA-262 permits an implementation to approximate.
// V8, JSC and SpiderMonkey are not guaranteed bit-identical for those. So the
// honest claim is: byte-identical PCM for the same ref plus target length on a
// GIVEN engine (which is what the "export twice, get the same bed" promise
// actually needs), and a perceptually identical song everywhere else. The
// target length is quantised (below) so a totalMs wobbling by a millisecond
// between two renders cannot recompose the song.

// The id format itself lives in engine/src/zzfxm-ref.ts - see that file's
// header for why it is alone in a module. Re-exported here so this stays the
// ONE import site for "the procedural bed", exactly as it was before the split.
export { ZZFXM_SCHEME, parseZzfxmRef, formatZzfxmRef, isZzfxmRef, type ZzfxmRef } from '../../../../engine/src/zzfxm-ref.ts';

/** Shortest song the composer is ever asked for. Matches the export bar's floor. */
export const ZZFXM_MIN_TARGET_SEC = 8;
/** Longest. A song is composed and rendered whole, in memory. */
export const ZZFXM_MAX_TARGET_SEC = 600;
/**
 * Target lengths are rounded UP to this grid before composing.
 *
 * Two renders of the same project must produce the same tune, and the length
 * they ask for is derived from a stage's `totalMs` - which is a sum of authored
 * numbers and can differ in its last float bit between a preview and an export.
 * Quantising makes the composer's input stable against that jitter, and rounding
 * up (never down) guarantees the song still covers the window it was asked for.
 */
export const ZZFXM_TARGET_QUANTUM_SEC = 0.5;

/**
 * Slack subtracted before rounding up, so a length that IS on the grid stays
 * on it when it arrives a float-bit long. Without this, `ceil` would send
 * 20.000000001s to 20.5 and 20s to 20, the exact boundary jitter the grid
 * exists to absorb. The cost is that the song may fall up to a microsecond
 * short of the window, under a twentieth of one sample at 48 kHz.
 */
const TARGET_EPS_SEC = 1e-6;

/** Clamp + quantise a wanted length to the grid the composer is actually asked for. */
export function zzfxmTargetSec(wantedSec: number): number {
  const s = Number.isFinite(wantedSec) ? wantedSec : ZZFXM_MIN_TARGET_SEC;
  const q = Math.ceil(Math.max(0, s - TARGET_EPS_SEC) / ZZFXM_TARGET_QUANTUM_SEC) * ZZFXM_TARGET_QUANTUM_SEC;
  const clamped = Math.min(ZZFXM_MAX_TARGET_SEC, Math.max(ZZFXM_MIN_TARGET_SEC, q));
  // Kill the float dust `ceil(x/0.5)*0.5` can leave, so the number that reaches
  // the composer is exactly representable and a cache key over it is stable.
  return Math.round(clamped * 2) / 2;
}

// The seed to spec draw lives in the engine (its order is a frozen contract,
// and a `zzfxm:<seed>` ref must name the same song in every shell). Re-exported
// so this stays the ONE import site for "the procedural bed", as it was before
// the hoist.
export { generatedSongSpec };

/** The shipped renderer, imported lazily so the Worker chunk is not in this module's eager graph. */
async function defaultRenderSong(song: ZzfxSong): Promise<RenderedPcm> {
  const mod = await import('../lib/zzfxm-render.ts');
  return mod.renderSong(song);
}

/**
 * A `ClipAudio` backed by the composer instead of a demuxer.
 *
 * Composition is DEFERRED to the first `pcm()` call, because that call is the
 * first moment anything knows how long the song has to be. The result is
 * cached per target length, so the ordinary one-window-per-clip case renders
 * once, and a caller that asks for several windows of the same bed gets one
 * coherent song instead of several unrelated ones.
 */
function openZzfxmAudio(ref: ZzfxmRef, opts: ClipAudioOpts): ClipAudio {
  const log = opts.log ?? ((): void => {});
  const timeout = opts.timeoutMs ?? OP_TIMEOUT_MS;
  const render = opts.deps?.renderSong ?? defaultRenderSong;
  let disposed = false;
  let cacheKey = -1;
  let cached: Promise<RenderedPcm> | null = null;

  if (ref.rawStyle) {
    log('warn', `sequence audio: unknown ${ZZFXM_SCHEME} style "${ref.rawStyle}" - using the seed's own style.`);
  }

  return {
    // 0 = "no intrinsic duration". See the section header: the mix reads this
    // as "give the box exactly the window it asked for", which is true here.
    durationSec: () => 0,

    async pcm(fromSec, toSec, sampleRate) {
      if (disposed) throw coded(new Error('clip audio disposed'), 'SEQ_ABORTED');
      const from = Math.max(0, Number.isFinite(fromSec) ? fromSec : 0);
      const to = Math.max(from, Number.isFinite(toSec) ? toSec : from);
      // The song's timeline starts at 0 and the window is read out of it, so
      // the length it must cover is the window's END, not its span.
      const target = zzfxmTargetSec(opts.targetSec ?? to);
      if (cacheKey !== target) {
        cacheKey = target;
        cached = withTimeout(render(composeSong(generatedSongSpec(ref.seed, target, ref.style))), timeout, 'zzfxm render');
        // A failed render must not be remembered as this target's answer.
        cached.catch(() => { if (cacheKey === target) { cacheKey = -1; cached = null; } });
      }
      let pcm: RenderedPcm;
      try {
        pcm = await (cached as Promise<RenderedPcm>);
      } catch (err) {
        throw coded(err, 'SEQ_DECODE_FAILED');
      }
      if (disposed) throw coded(new Error('clip audio disposed'), 'SEQ_ABORTED');
      // One chunk at timestamp 0, through the SAME pure assembler a decoded file
      // uses - so the trim and the resample to the mix rate are literally the
      // same code, and a procedural clip cannot drift from a recorded one.
      return assemblePcmWindow(
        [{ channels: [pcm.left, pcm.right], sampleRate: pcm.sampleRate, timestamp: 0 }],
        from, to, sampleRate,
      );
    },

    async dispose() {
      if (disposed) return;
      disposed = true;
      cached = null;
      cacheKey = -1;
      await Promise.resolve();
    },
  };
}
