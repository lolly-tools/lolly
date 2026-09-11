// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-render.ts - the EXECUTOR + ORCHESTRATOR for deterministic sequence
 * export (Fable timeline, phase 3 section 2.5).
 *
 * The split this module lives on is the whole point of the phase-3 design (spike
 * section 0.0, "DESIGN REQUIREMENT"):
 *
 *   sequence-plan.ts      decides WHAT is on screen at time t and where its media
 *                         is seeked to - pure, DOM-only-for-reading, node-testable.
 *   sequence-providers.ts turns one clip into pixels/PCM at a source time - 
 *                         mediabunny + WebCodecs live ONLY behind that seam.
 *   sequence-render.worker.ts  the DOM-FREE executor: `drawItem`, the frame loop,
 *                         the provider lifecycle and the truncation reconciliation
 *                         (phase 4 Track B) - plus the Worker entry that runs it.
 *   THIS FILE             reads the LIVE DOM (stage parse, dom-to-image rasters,
 *                         the lottie player), mixes the audio graph, decides which
 *                         thread executes, and owns every output container.
 *
 * There is deliberately NO activity, alpha, crossfade or source-time arithmetic in
 * here. If a question is "should this be visible / how faded / which frame of the
 * source", it belongs in the planner and is already answered by the PlanItem. What
 * is left here is genuinely browser-only: dom-to-image, lottie-web, the
 * OfflineAudioContext, MediaRecorder and the container writers.
 *
 * WORKER OFFLOAD (phase 4 Track B), and the SPLIT RULE. `renderSequence` builds a
 * fully serialisable `SeqJob` - the layers minus their elements, the static
 * rasters, the clip bytes, the mixed PCM - and hands it to ONE executor,
 * `runSequenceJob`. Which thread that executor runs on is the only difference
 * between the two paths, so determinism is structural rather than asserted:
 *
 *   • no lottie layer  ⇒ the whole frame loop (decode, composite, encode, mux)
 *     runs in the Worker and the main thread only awaits the result;
 *   • a lottie layer   ⇒ HYBRID. lottie-web cannot run in a worker, so the worker
 *     asks the main thread for that layer's raster per frame ('need-live') and
 *     blocks on the answer, at most ONE request outstanding;
 *   • gif / apng / the MediaRecorder fallback, or any missing capability
 *     (`supportsWorkerSequenceRender()`), ⇒ the executor runs in-thread, exactly
 *     as it did before this change.
 *
 * The worker path is OPT-IN behind the same `lolly.workerEncode` flag that gates
 * bridge/video-encode.ts, and any non-coded worker failure falls back to a full
 * in-thread render (the static rasters are kept as canvases precisely so that
 * retry costs nothing).
 *
 * MEMORY. The mp4/webm path holds O(1) DECODED frames in duration: one canvas, at
 * most two decoded samples per open provider (the providers' own ledger enforces
 * that), and at most HIGH_WATER+1 VideoFrames inside the streaming mux. That is why
 * `maxVideoFrames()` - which exists purely because the old path buffered an
 * ImageBitmap per frame - is NOT applied to it. It is NOT O(1) overall: both muxers
 * accumulate the ENCODED stream (mp4-muxer's `fastStart:'in-memory'` by design,
 * webm-muxer's `_videoChunkQueue` until an audio chunk with a ≥ timestamp drains
 * it), so peak memory is O(duration × bitrate) in compressed bytes - ~45 MB for a
 * ten-minute 1080p clip, three orders of magnitude below the frame buffering this
 * path replaced. gif/apng buffer every frame as pixels, so they keep the cap; so
 * does the MediaRecorder fallback, which buffers an ImageBitmap per frame.
 *
 * WHAT IS DUPLICATED FROM export.ts, AND WHY. `pickWebCodecsVideo`,
 * `pickWebCodecsAudio`, `withVideoMeta`, `manualCaptureStream`, `recorderOpts`,
 * `maxVideoFrames`, `swapBlobUrls`, `getDomToImage`, the `rasterBox` technique and
 * `connectMusic`'s gain envelope are all module-private in bridge/export.ts. This
 * phase's brief allowed exactly three edits to that file (the stage sniff, the
 * dispatch branch, the snapshotMotion guard) - exporting nine more symbols is not
 * one of them - so they are reproduced here, each marked `// from export.ts:<name>`
 * and kept behaviourally identical. THIS IS A REPORTED DEBT: the right end state is
 * a shared bridge/video-shared.ts that both files import. See the build report.
 */

import {
  parseSequenceStage,
  applyDurationOverride,
  camerasMove,
  boxesTilt,
  camerasTilt,
  frameTimestamps,
  activeFrameWindow,
  crossfadeJunctions,
  DECK_TRANSITION_MS,
  normalizeFrameScene,
  ownsLayerFx,
  planCameraView,
  sequenceDrawPlan,
  stageCameras,
  sequenceError,
  toCodedError,
  SequenceError,
  splitActive,
  splitAnimatingAt,
  type SeqLayer,
  type SeqErrorCode,
  type SeqPlanEnv,
  volumeKeysOf,
  audioCrossfades,
} from './sequence-plan.ts';
// The plate budget (plans/104 section 5.5) and the spill geometry it prices. Both pure; the
// budget is what turns "shoot the flown-past layer sharper" into a bounded promise.
import {
  blurScratchNeedBytes,
  planPlateBudget,
  type PlateLayerNeed,
} from './plate-budget.ts';
import {
  parseDropShadows,
  spillPad,
  renderFx,
  laneFor,
  releaseStage,
  releaseBlurScratches,
  type BlurCanvas,
  type BlurCtx,
} from '../lib/canvas-blur.ts';
// P2b - the WebGL2 quad compositor for tilt export (plans/104 section 6.4). Shell-only; the
// engine supplies the projection math (`projectLayer` → `m3`) and nothing else.
import {
  createGlQuadCompositor,
  glQuadCompositorSupported,
  type GlQuadCompositor,
} from './sequence-gl.ts';
import {
  createClipAudio,
  type ClipAudio,
} from './sequence-providers.ts';
// WP-3 (plan 154): the deep float HDR encode source + its flag/capability gates. Pure,
// node-testable; nothing here runs unless hdrDeep (hdrActive && flag && probe) is true.
import {
  deepHdrCompositorEnabled,
  supportsI420P10Frame,
  hdrDeepI420P10,
} from './hdr-deep-frame.ts';
import {
  createStreamingMux,
  type EncodePick,
  type StreamingMux,
  type PcmSource,
} from './video-encode-core.ts';
import { pickWebCodecsVideo, pickWebCodecsAudio, is10bitHdrCodec, HDR_VF_COLORSPACE, type AudioPick } from './video-shared.ts';
// The DOM-free executor. Imported as an ordinary module for the in-thread path
// AND spawned as a Worker below - one compositor, two hosts (see the header).
import {
  runSequenceJob,
  itemFx,
  toJobLayer,
  jobTransferables,
  closeJobBitmaps,
  streamMuxTargetFor,
  radiiOf,
  fitRect,
  type SeqJob,
  type SeqJobLayer,
  type SeqJobIO,
  type SeqWorkerAudio,
  type SeqWorkerIn,
  type SeqWorkerOut,
  type AnyCanvas,
  type AnyCtx,
} from './sequence-render.worker.ts';

// The geometry helpers moved to the executor with `drawItem`; re-exported so the
// module's public surface (and sequence-render.test.ts) is unchanged.
export { radiiOf, fitRect };
import { videoBitrate, bppForQuality, codecAdjustedBitrate, videoMimeCandidates } from './video-mime.ts';
import { bedDuckEnvelope, MIX_RAMP_SEC, type DuckSpan } from './audio-envelope.ts';
// Separate line on purpose: sequence-render.test.ts pins the line above verbatim
// (the one-envelope contract), and the clip-gain names are a different concern.
import { clipGainEvents, isTrivialGain } from './audio-envelope.ts';
import { clamp01 } from '../lib/util/number.ts';
// plans/156 Phase B: the analytic mix-window evaluator. B2/B3 route BOTH the whole
// buffer (sequenceAudioPcm, the worker handover) AND the on-demand streaming windows
// through this one PURE function, so "whole" and "windowed" are literally the same
// code - the OAC render is gone, and with it the O(duration) mix.buffer hold.
import { mixWindow, type MixSpec, type MixClip, type MixBed } from './mix-window.ts';
import { insertPngPhys, insertPngMeta, insertPngIcc, iccWanted } from './export-image-meta.ts';
import {
  packApng,
  packWebpAnim,
  videoProvenanceTags,
  embedMp4Meta,
  embedWebmMeta,
  iccProfileBytes,
  parseClipShape,
  projectDepth,
  projectLayer,
  resolveCamera,
  hdrBoostToPQ,
} from '@lolly/engine';
import type { CaptionCue, HdrBoostOptions } from '@lolly/engine';
import { activitySpans, createTruePeakLimiter, createLoudnessMeter, normalizeGain, parseFxChain, processFxPcm } from '@lolly/engine';
// The compositor photographs the LIVE artboard, and the phase-2 clock has been
// writing `.seq-off` (display:none) onto every box that is not under the playhead.
// Without clearing it, every clip except the one being scrubbed rasterises blank.
// The class name is imported rather than restated so the two can never drift apart - 
// from sequence-dom.ts, which owns the DOM applier the clock itself now uses (that
// also drops one of the bridge → views edges).
// …and `withAuthoredDom` is the other half of the same story: `.seq-off` is the class
// the clock APPLIES, and the four inline properties it COMPOSES (transform, opacity,
// filter, z-index) have to come off the stage for exactly as long - see the wrapper on
// `renderSequence` below, and plans/104 section 6 point 0.
import {
  OFF_CLASS, applySplitAt, applyTimeToElements, clearSplitUnits, createAuthoredStore, createSequenceTime,
  isActiveAt, readTiming, stageNativeSize, transitionAt, withAuthoredDom,
} from './sequence-dom.ts';
import { poseSlideBoxes, type SlidePose } from '../lib/slide-pose.ts';
// bridge → views. Phase 3 already has this edge (sequence-providers.ts reuses the
// clock's seek semantics); reusing the LIVE Lottie player instance is the only way
// a Lottie box can be exported at all - re-mounting a second player would double
// the memory and, worse, could resolve to a different build of the animation than
// the one the preview showed. Reported alongside the other layering note.
import { lottiePlayerFor } from '../views/lottie-mount.ts';
// The same bridge → views edge, for the caption contract: the class a caption box
// carries and the sliver floor a cue has to clear are both defined once, beside the
// cue maths that mints those boxes, so the collector below cannot drift from them.
import { CAPTION_BOX_CLASS, MIN_CUE_KEEP_S } from '../views/timeline-captions.ts';
import { suspendNodeRasters, drainNodeRasters } from '../lib/clip-thumbs.ts';
import type { ExportOpts } from './export.ts';
// Type only - the encoders themselves stay out of this module's graph.
import type { AudioPcm } from '../lib/audio-encode.ts';
// The provenance gather (plans/130). Its policy lives in its own module because
// nothing in THIS file can be reached by a headless test - see its header.
import { gatherSequenceIngredients, type SequenceIngredientSource } from './sequence-ingredients.ts';
import { assetIdForUrl, MAX_CREDENTIAL_SCAN_BYTES } from './assets.ts';

/**
 * The slice of the web host this renderer needs.
 *
 * Log, plus - optionally - the asset bridge's credential lookup. A rendered
 * document keeps no asset ids, only URLs, so `assetIdForUrl` turns a clip's src
 * back into an id and this is what asks for that id's preserved Content
 * Credentials. Optional because the host handed in is frequently `null` (tests,
 * and the default parameter below), and its absence costs only the byte-scan
 * fallback rather than the export.
 */
export interface SeqHost {
  log?(level: string, msg: string): void;
  /** Surface a user-visible EXPORT QUALITY notice (not an error) - e.g. a sped-up
   *  clip whose audio had to be dropped. host.log() is console-only, so a
   *  degradation reported only through `log` never reaches the person exporting;
   *  the shell's export bridge wires this to the export card. Optional: a host
   *  that does not set it (the CLI, tests) just doesn't show the extra line, and
   *  the parallel `log('warn', …)` still records it. The audio mix runs on the
   *  MAIN thread only (see the module header + sequence-render.worker.ts), so this
   *  reaches the card directly, without a worker `postMessage` hop. */
  notice?(msg: string): void;
  assets?: {
    credential?(id: string): Promise<{ store: Uint8Array; format: string } | null>;
  };
}

// ── policy constants ────────────────────────────────────────────────────────

/**
 * Providers (= open containers + decoders) alive at once.
 *
 * A MEMORY policy, NOT a decoder-count limit (spike rule 4): 16 concurrent
 * Input+sink pairs interleaved with no stall, and mediabunny self-caps its own
 * decoded queue at 8. What is unmeasurable from JS is the native frame memory - 
 * the heap moved 1.6 MB while ~2.8 GB of frame data was nominally held - so the
 * cap is the only instrument we have. A composition needing more overlapping
 * clips than this fails with SEQ_TOO_HEAVY rather than thrashing.
 */
export const MAX_LIVE_PROVIDERS = 3;

/** Sanity ceiling on a sequence, ms - the DEFAULT (BufferTarget / OPFS-unavailable)
 *  bound. Not a memory bound for the streaming path per se, but the in-memory
 *  BufferTarget DOES accumulate the whole encoded stream, so 10 min is where that hold
 *  stops being negligible. The "somebody hand-edited seq-ms in the URL" guard for every
 *  path that is NOT streaming to OPFS. */
export const MAX_SEQUENCE_MS = 600_000;

/**
 * The ceiling lifted to 30 min, selectable ONLY for a streaming export that actually
 * gets the OPFS StreamTarget (plans/156 WP-A part 4). It is guarded, never a bare bump:
 * `ceilingMsFor(useOpfs)` returns this iff the OPFS sink is the active target - long
 * enough to cross the frame gate AND real OPFS present - and `MAX_SEQUENCE_MS` otherwise.
 * OPFS streams the container to disk as it is written, so its peak no longer grows with
 * the encoded stream; the one remaining O(filesize) hold is the bounded C2PA read-back at
 * finalize (a ~135 MB transient tail at 30 min - acceptable; see plans/156 section 2 A3 Step 5).
 */
export const MAX_SEQUENCE_STREAM_MS = 1_800_000;

/** True when this environment can back a real OPFS StreamTarget - the same feature-detect
 *  `buildMediabunnyMux` falls back on (plans/156 WP-A part 1). Used ONLY to decide the
 *  guarded 30-min ceiling: the lift needs the OPFS sink to actually engage, not merely be
 *  requested, so an OPFS-unavailable export keeps the 10-min `MAX_SEQUENCE_MS` bound. */
function opfsStreamingAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
}

/** The length ceiling in ms for this export: the lifted 30-min bound iff the OPFS
 *  StreamTarget is the active sink, the default 10 min otherwise. */
function ceilingMsFor(useOpfs: boolean): number {
  return useOpfs ? MAX_SEQUENCE_STREAM_MS : MAX_SEQUENCE_MS;
}

/** No frame completed for this long ⇒ the export is stuck; fail, never hang. */
export const WATCHDOG_MS = 10_000;

/**
 * Bytes of cached fx plates one render may retain, or null for this machine's own
 * allowance (`fxCacheBudgetBytes`). TEST SEAM ONLY - see `fxPlateKey` in the executor.
 *
 * It exists because the claim the cache makes is PIXEL IDENTITY, and the only way to
 * prove that on a real engine is to render the same scene both ways in one run. 0
 * turns the cache off completely, which is the "both ways" the goldens compare.
 */
let fxCacheBytesOverride: number | null = null;

/** TEST SEAM: pin the fx-plate allowance (null restores the machine's own). */
export function _setFxCacheBytes(bytes: number | null): void {
  fxCacheBytesOverride = Number.isFinite(bytes as number) && (bytes as number) >= 0 ? (bytes as number) : null;
}

/** Everything mixes at 48 kHz stereo - the rate both AAC and Opus want. */
export const MIX_RATE = 48_000;
export const MIX_CHANNELS = 2;

/** The audio window fed to the streaming mux per call - 0.1s @ 48k, the mux's own
 *  internal chunk grid, integer-sample aligned and independent of fps. */
export const AUDIO_WINDOW = 4800;

/** Multiply both planes in place - the normalize master gain. */
function scalePlanes(planes: [Float32Array, Float32Array], g: number): void {
  for (const ch of planes) for (let i = 0; i < ch.length; i++) ch[i] = (ch[i] as number) * g;
}

/**
 * The normalize pre-gain for a mix (plans/101 section 2.5): ONE measurement pass
 * over the analytic mix - the BS.1770 meter keeps block energies, never PCM, so
 * this costs an evaluation, not a buffer. 1 when normalize is off or the mix has
 * no meterable loudness (silence).
 */
export function normalizeMixGain(spec: MixSpec, total: number, target?: number): number {
  if (!Number.isFinite(target as number)) return 1;
  const meter = createLoudnessMeter(MIX_RATE);
  for (let o = 0; o < total; o += AUDIO_WINDOW) {
    const planes = mixWindow(spec, o, Math.min(o + AUDIO_WINDOW, total));
    meter.push(planes[0]!, planes[1]!);
  }
  const lkfs = meter.integrated();
  return lkfs == null ? 1 : normalizeGain(lkfs, target as number);
}

/** A stateful windowed-audio feeder: hand it the current frame timestamp inside the
 *  frame loop and it feeds every audio window whose START time has been reached,
 *  INTERLEAVED with the frames (WP-A step A2), so the mux advances its bounded
 *  merge - and can write to OPFS - as the render proceeds instead of holding the
 *  whole encoded stream to the end. */
interface WindowedAudioFeeder {
  /** Feed every remaining window whose start time is <= `tsUs` (µs). */
  upTo(tsUs: number): Promise<void>;
  /** Feed whatever remains - audio that outlasts the video (e.g. a bed longer than the clip). */
  flush(): Promise<void>;
}

/**
 * Build a feeder that produces each audio window ANALYTICALLY, ON DEMAND, from the
 * mix spec (plans/156 Phase B Step B3) - there is no pre-rendered buffer to slice.
 *
 * BIT-IDENTICAL to one terminal `addAudio(wholeMix)`: `mixWindow(spec, w0, w1)`
 * concatenated over the AUDIO_WINDOW grid equals a single whole-range call
 * sample-for-sample (mix-window.test.ts, plans/156 section 5 STOP-5), because every output
 * sample is an independent accumulator and the envelope/loop-phase are evaluated at
 * the ABSOLUTE sample index - the window seam carries no state. The mux continues its
 * position-based session clock across calls (video-encode-core.ts's addAudio), so the
 * window starting at sample `off` still falls at absolute time round(off / MIX_RATE ·
 * 1e6) µs - the same grid the mux stamps its chunks on - and only the MOMENT each
 * window is produced changes, which the mux's clock does not observe. The win is that
 * the O(duration) finished PCM is never materialised: only one 0.1 s window exists at
 * a time (plans/156 Phase B - the dominant memory hold is gone).
 */
function windowedAudioFeeder(
  mux: StreamingMux, spec: MixSpec, total: number, numberOfChannels: number,
  normalizeTarget?: number,
): WindowedAudioFeeder {
  let off = 0;
  // Normalize-to-target BEFORE the limiter (plans/101 section 2.5): one master
  // gain from one measurement pass; the limiter then catches any peak the lift
  // pushes toward the ceiling.
  const preGain = normalizeMixGain(spec, total, normalizeTarget);
  // The master pass (plans/165 Slice E, plans/101 section 2.5): every window runs
  // through ONE streaming -1 dBTP limiter before the mux. Transparent (a literal
  // copy) while the mix stays under the ceiling, and chunk-invariant by
  // construction, so this stream is byte-identical to the worker's limited
  // whole-range call. Emission lags production by the lookahead (~2.5 ms); the
  // mux's position-based clock never notices, only the moment bytes arrive moves.
  const limiter = createTruePeakLimiter({ rate: MIX_RATE });
  const emit = async (l: Float32Array, r: Float32Array): Promise<void> => {
    if (!l.length) return;
    await mux.addAudio({
      length: l.length,
      numberOfChannels,
      getChannelData: (ch: number) => (ch === 0 ? l : r),
    });
  };
  const feedOne = async (): Promise<void> => {
    const from = off;
    const end = Math.min(off + AUDIO_WINDOW, total);
    off = end;
    // The window is evaluated here and nowhere retained: mixWindow returns a fresh
    // stereo pair of length `end - from`, the limiter hands back what is emittable,
    // addAudio copies it into the encoder, and it is collected before the next frame.
    const planes = mixWindow(spec, from, end);
    if (preGain !== 1) scalePlanes(planes, preGain);
    const [lL, lR] = limiter.process(planes[0], planes[1]);
    await emit(lL, lR);
  };
  const startUsOf = (sample: number): number => Math.round((sample / MIX_RATE) * 1e6);
  return {
    async upTo(tsUs: number): Promise<void> {
      while (off < total && startUsOf(off) <= tsUs) await feedOne();
    },
    async flush(): Promise<void> {
      while (off < total) await feedOne();
      const [tL, tR] = limiter.flush();
      await emit(tL, tR);
    },
  };
}

/** Fixed GIF frame rate (the gif encoder's own; it ignores opts.fps). */
const GIF_FPS = 15;

/** CSS pixels per inch - the APNG pHYs default, matching export.ts's exportDims. */
const CSS_DPI = 96;

/** Lottie/live-raster requests the worker may have outstanding at once. One is
 *  the whole bound: the executor asks, then blocks, so a slow main thread can
 *  never queue frames up in worker memory. */
export const LIVE_RASTER_QUEUE = 1;

// ── small helpers reproduced from export.ts (see the header) ────────────────

// from export.ts:getDomToImage
let domToImageMore: any = null;
async function getDomToImage(): Promise<any> {
  if (!domToImageMore) {
    const mod: any = await import('dom-to-image-more');
    domToImageMore = mod.default ?? mod;
  }
  return domToImageMore;
}

// from export.ts:blobToDataUrl
function blobToDataUrl(url: string): Promise<string> {
  return fetch(url)
    .then((r) => r.blob())
    .then((b) => new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => rej(new Error('blob read failed'));
      fr.readAsDataURL(b);
    }));
}

// from export.ts:swapBlobUrls - dom-to-image cannot serialise a blob: URL, so any
// <img>/<image> pointing at one is temporarily rewritten to a data: URL.
async function swapBlobUrls(node: Element): Promise<() => void> {
  const swaps: { el: Element; attr: string; url: string }[] = [];
  await Promise.all([...node.querySelectorAll('image, img')].map(async (el) => {
    for (const attr of ['href', 'src']) {
      const url = el.getAttribute(attr);
      if (url?.startsWith('blob:')) {
        try {
          el.setAttribute(attr, await blobToDataUrl(url));
          swaps.push({ el, attr, url });
        } catch { /* leave as-is */ }
      }
    }
  }));
  return () => swaps.forEach(({ el, attr, url }) => el.setAttribute(attr, url));
}

// from export.ts:maxVideoFrames - only the buffering (gif/apng) path uses it.
function maxVideoFrames(): number {
  const gb = (navigator as { deviceMemory?: number }).deviceMemory;
  if (!gb) return 600;
  return Math.max(200, Math.round((Math.min(8, gb) / 8) * 600));
}

// `pickWebCodecsVideo` / `pickWebCodecsAudio` now live in bridge/video-shared.ts
// (imported above) - the shared ladder that retired the copy this file used to
// carry. Sequence audio is 48 kHz stereo, so the shared defaults apply and the
// call sites pass only the container.

// from export.ts:withVideoMeta - provenance tags into the container, before the
// C2PA stamp renderFormat applies to whatever this function returns.
async function withVideoMeta(blob: Blob, container: string, meta: ExportOpts['meta'], host: SeqHost | null): Promise<Blob> {
  if (!meta) return blob;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const tags = videoProvenanceTags(meta as never, new Date());
    const out = container === 'video/mp4' ? embedMp4Meta(bytes, tags) : embedWebmMeta(bytes, tags);
    if (out === bytes) host?.log?.('warn', 'Provenance metadata not embedded (unrecognised container structure).');
    return new Blob([out as BlobPart], { type: container });
  } catch (err) {
    host?.log?.('warn', `Provenance metadata not embedded (${(err as { message?: string })?.message ?? err}).`);
    return blob;
  }
}

// from export.ts:manualCaptureStream
function manualCaptureStream(canvas: HTMLCanvasElement, fps: number): { stream: MediaStream; deliver: () => void } {
  const s = canvas.captureStream(0);
  const track = s.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  if (typeof track?.requestFrame === 'function') return { stream: s, deliver: () => track.requestFrame() };
  s.getTracks().forEach((t) => t.stop());
  return { stream: canvas.captureStream(fps), deliver: () => {} };
}

// from export.ts:videoMimeType (inlined - two lines, and importing it statically
// would drag the whole rasteriser into this lazy chunk's dependency graph).
function videoMimeType(preferred: string, audio: boolean): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return videoMimeCandidates(preferred, { audio }).find((t) => MediaRecorder.isTypeSupported?.(t)) ?? null;
}

// ── HDR (plan 154 WP-2, extended to the streaming path) ─────────────────────
// The streaming compositor is 8-bit (the deep compositor is WP-3, deferred), so this
// reuses the buffered renderVideo Phase-1 boost EXACTLY: PQ-transform each composited
// frame and hand its RGBA buffer to the 10-bit streaming encoder. hdrTargets/hdrTune are
// reproduced from export.ts (the same // from export.ts: convention this module already
// uses for nine other helpers) so the glow is byte-for-byte identical between a buffered
// video export and a sequence/viz/audiogram one - export.ts only exports renderSequence,
// not these module-private helpers.

// from export.ts:hdrTargets - brand primary hexes to boost, pulled from the live palette.
// The engine stays brand-agnostic; white is added by hdrBoostToPQ itself.
function hdrTargets(opts: ExportOpts): string[] {
  const out: string[] = [];
  for (const p of (opts.palette ?? []) as Array<{ hex?: string }>) {
    if (p.hex && /^#?[0-9a-fA-F]{3,8}$/.test(p.hex)) out.push(p.hex);
  }
  return out;
}

// from export.ts:hdrTune - map the author's 0-100 dials onto the hdrBoostToPQ knobs. Any
// dial left undefined falls through to the engine default (a plain hdr=1 looks as before).
function hdrTune(opts: ExportOpts): Partial<HdrBoostOptions> {
  const t: Partial<HdrBoostOptions> = {};
  if (opts.hdrPeakNits != null) t.peakNits = opts.hdrPeakNits;
  if (opts.hdrReach != null) {
    const r = Math.min(1, Math.max(0, opts.hdrReach / 100));
    const center = 0.65 - 0.45 * r;
    t.kneeLo = Math.max(0, center - 0.12);
    t.kneeHi = Math.min(1, center + 0.12);
  }
  if (opts.hdrLift != null) t.boostFloor = Math.min(1, Math.max(0, opts.hdrLift / 100));
  if (opts.hdrRichness != null) t.richness = Math.min(1, Math.max(0, opts.hdrRichness / 100));
  return t;
}

/** One-shot perf holder (plan 154 WP-3): the first deep frame times the float pipeline
 *  against the 8-bit path at the real resolution and logs the delta, so the flag's cost
 *  is data-driven. `done` flips after the first deep frame; `log` is the render's own. */
interface HdrDeepPerf { log: (level: string, msg: string) => void; done: boolean; }

// Boost a composited 8-bit frame to Rec.2100-PQ and hand back the buffer the streaming
// mux's HDR path (opts.colorSpace set) feeds to the buffer VideoFrame ctor.
//   deep=false (default / degraded): engine hdrBoostToPQ IN PLACE -> 8-bit RGBA PQ,
//     byte-for-byte the WP-2 Phase-1 path (the goldens set no hdr, so never reached).
//   deep=true  (WP-3, opt-in + I420P10-capable): the engine's float dual -> 10-bit
//     I420P10, so a boosted highlight rides 1024 PQ codes instead of banding at 256.
// Only called when hdrActive; SDR frames pass the canvas straight through, byte-for-byte.
function hdrFrameData(
  ctx: AnyCtx, w: number, h: number, opts: ExportOpts, deep: boolean, perf: HdrDeepPerf | null,
): { data: BufferSource } {
  const id = (ctx as CanvasRenderingContext2D).getImageData(0, 0, w, h);
  const tune = { targets: hdrTargets(opts), ...hdrTune(opts) };
  if (!deep) {
    hdrBoostToPQ(id.data, tune);
    // Uint8ClampedArray is a valid VideoFrame buffer source; the cast just crosses TS's
    // ArrayBufferLike-vs-ArrayBuffer typed-array generic (the RGBA bytes are the same).
    return { data: id.data as BufferSource };
  }
  if (perf && !perf.done) {
    // A/B on the FIRST deep frame only: the 8-bit path on a throwaway copy vs the float
    // pipeline, both on real pixels at the export resolution. Surfaces the added cost.
    const t0 = performance.now();
    hdrBoostToPQ(id.data.slice() as Uint8ClampedArray, tune);
    const t1 = performance.now();
    const data = hdrDeepI420P10(id.data, w, h, tune);
    const t2 = performance.now();
    perf.done = true;
    perf.log('info', `[measured] deep-hdr float frame ${(t2 - t1).toFixed(1)}ms vs 8-bit ${(t1 - t0).toFixed(1)}ms at ${w}×${h} (+${(t2 - t1 - (t1 - t0)).toFixed(1)}ms/frame; lolly.hdrCompositor)`);
    return { data: data as unknown as BufferSource };
  }
  return { data: hdrDeepI420P10(id.data, w, h, tune) as unknown as BufferSource };
}

// ── the audio envelope (from export.ts:connectMusic) ────────────────────────

interface BedFade {
  fadeIn?: number;
  fadeOut?: number;
  clipSec?: number;
  volume?: number;
  /** Duck the bed under the sequence's own audio: `level` is the centre gain
   *  multiplier, `spans` the clip-time windows where sequence audio plays. The
   *  bed runs at full volume between and around them (top/tail intro-outro). */
  duck?: { level: number; spans: DuckSpan[] };
  /** Gain ramp seconds. Defaults to the legacy snappy 0.25 for clip ducks
   *  (speech-under-bed; a short clip must SIT at the ducked level - pinned by
   *  tests/sequence-render.browser.test.ts). The section 6.1 mix-in path passes the
   *  slower musical MIX_RAMP_SEC. */
  rampSec?: number;
  /** In-point into the SOURCE, seconds. Independent of the envelope, which is
   *  still timed from t0 against clipSec. */
  start?: number;
}

/**
 * Describe a looping music bed as a `MixBed` for the analytic mixer (plans/156 B2).
 *
 * This is the exact translation of the OAC bed graph `connectBed` used to build,
 * into the closed form mixWindow evaluates - the automation itself is still
 * bedDuckEnvelope (audio-envelope.ts), the same math export.ts's mix graphs consume,
 * so a bed ducks identically in a tool export and a sequence render: fade in, glide
 * down to volume·level over each span of sequence audio (~0.8 s ramps, never steps),
 * back to full between spans, fade out. The bed still begins at output sample 0 reading
 * from its in-point and loops within [in-point, duration) - `src.start(0, offset)` with
 * `loop=true` - which is exactly what `startSample`/`offsetSample` and mixWindow's
 * default loop region (the whole buffer) reproduce.
 */
function buildBed(buffer: AudioBuffer, fade: BedFade, log: (l: string, m: string) => void): MixBed {
  // In-point, reproduced from export.ts:bedStartOffset (importing it would drag that
  // module's whole graph into this lazy chunk - the same reason rasterBox is copied).
  // The bed loops within [offset, duration): the OAC graph set loopStart = offset,
  // loopEnd = buffer.duration, so mixWindow's default `loopEndSample` (the buffer
  // length) is left implicit and only the in-point is carried.
  let offset = fade.start ?? 0;
  if (!Number.isFinite(offset) || offset <= 0) offset = 0;
  else if (offset >= buffer.duration) {
    log('warn', `Audio starts at ${offset}s but the track is only ${buffer.duration.toFixed(2)}s long; playing it from 0:00.`);
    offset = 0;
  }
  const events = bedDuckEnvelope({
    clipSec: fade.clipSec ?? 0,
    volume: fade.volume,
    centre: fade.duck?.level ?? 1,
    spans: fade.duck?.spans ?? [],
    fadeIn: fade.fadeIn,
    fadeOut: fade.fadeOut,
    // Clip ducks are speech-under-bed: the legacy 0.25s ramps, so a short clip
    // actually SITS at the ducked level instead of riding a 0.8s triangle
    // (tests/sequence-render.browser.test.ts pins this). The section 6.1 mix-in call
    // passes the slower musical MIX_RAMP_SEC explicitly.
    rampSec: fade.rampSec ?? 0.25,
  });
  // COPY the decoded planes off the transient AudioBuffer: they travel into the spec
  // (and, on the worker path, get transferred). Small - a few seconds of bed, never
  // O(duration).
  const nc = Math.max(1, buffer.numberOfChannels);
  const pcm: Float32Array[] = [];
  for (let ch = 0; ch < nc; ch++) pcm.push(new Float32Array(buffer.getChannelData(ch)));
  return { pcm, events, offsetSample: Math.round(offset * MIX_RATE), startSample: 0 };
}

// ── rasterisation (the renderRecord technique) ──────────────────────────────

/**
 * Rasterise ONE box, unrotated, at capture scale.
 *
 * Reproduced from export.ts:renderRecord's `rasterBox` (it is module-private
 * there): render the element at its authored size but transform-scaled to the
 * export's pixel size, so text and vectors are resampled rather than upscaled.
 * `hide` is temporarily display:none'd for the shot - that is how a video box's
 * background/chrome is captured without the (blank-serialising) <video> in it.
 */
interface RasterOpts {
  /** Shoot the element with no background of its own (the video "over" plate). */
  transparentBg?: boolean;
  /**
   * Shoot the element at full opacity.
   *
   * A box's authored `opacity` belongs to the PLANNER: `PlanItem.alpha` is already
   * `layer.opacity x transition alpha`, and `drawItem` puts it on `globalAlpha`. If
   * the raster also carried the element's own opacity it would be applied twice and
   * a 0.45 box would export at 0.20. Every `.lolly-box` raster must set this; the
   * stage raster must not, because the artboard is not a planned layer.
   */
  opaque?: boolean;
  /**
   * Shoot the element with its INLINE `filter` removed - the blur rule, and the exact
   * twin of `opaque` (plans/104 section 5.5).
   *
   * `PlanItem.blur` is the WHOLE blur: the box's authored `filter: blur()`, plus the
   * keyframe `b` channel, plus depth-of-field. The executor applies that one number.
   * A plate that still carried the element's own blur would be blurred twice - softly
   * at first (2 + 2 = 4px on a 2px box), then catastrophically the moment a fly-past
   * adds 40px of DOF to a plate that was already soft. So every PLANNED layer's plate
   * is shot clean and the planner owns the number; the stage background is not a
   * planned layer and keeps its own filter, exactly as it keeps its own opacity.
   *
   * PAIRED WITH `drawItem`: a clean plate is only correct because the executor applies
   * `PlanItem.blur`. The two land together (plans/104 M1 streams F + G) and neither is
   * complete alone - a clean plate with an executor that ignores the number is a box
   * that quietly lost its authored blur.
   */
  neutralFilter?: boolean;
  /**
   * Extra margin, in ELEMENT px, captured on all four sides (plans/104 section 5.5).
   *
   * The capture canvas grows to `(bw + 2·pad) × (bh + 2·pad)` at scale S and the clone
   * is translated INSIDE the scale - `scale(S) translate(pad, pad)` - so the offset is
   * `pad·S` device px and the pad is expressed in the same units as the box. The plate
   * therefore has its origin at `(-pad, -pad)` in box space, which is what a consumer
   * has to subtract when it draws: content that spills outside the box rect (a soft
   * silhouette, a shadow) falls INSIDE the canvas instead of being clipped away at the
   * exact moment the executor wants to blur it.
   *
   * 0 - the default, and what every P0 call site passes - is byte-for-byte today's
   * shot: the canvas is `bw·S × bh·S` and the transform string is `scale(S)` exactly as
   * it always was. The budget that chooses a non-zero pad is the planner's (section 5.5).
   */
  pad?: number;
  /**
   * Shoot the element with its inline `clip-path` removed - the SHADOW rule, and the
   * third member of the `opaque` / `neutralFilter` family (plans/104 P1 obligation 5b).
   *
   * Measured, not theorised (M1's browser-verify run, real Chromium and WebKit against
   * real DOM output): `rasterBox` neutralises the inline `filter` but never the inline
   * `clip-path`, and dom-to-image copies the latter onto its clone. So a
   * compositor-owned layer's plate arrives ALREADY CLIPPED, and `drawItem` - which is
   * correct, and was confirmed correct by the same run - then casts its drop-shadow
   * from the clipped silhouette while the browser casts it from the UNCLIPPED element
   * and clips the filter's OUTPUT afterwards (Filter Effects section 5 / CSS Masking). Mean
   * error 1.93 / 2.26, max 204, over 2–3 % of the frame; with an unclipped plate,
   * 0.00 / 0.54. The fix belongs here, in the capture, and nowhere else.
   *
   * Only ever set when the compositor will reproduce the clip at the destination - i.e.
   * when `parseClipShape` understands the value. An unparseable `clip-path`
   * (`url(#mask)`, a shape nobody has taught the executor) is clipped by NOBODY once
   * the plate stops carrying it, so those layers keep it baked in, exactly as today.
   */
  neutralClipPath?: boolean;
  /**
   * Shoot the element at a size other than its authored one, in ELEMENT px - the
   * `w`/`h` channels' half of the capture (section 5.2).
   *
   * A size tween REFLOWS: text rewraps, a border stays one pixel wide. A plate cannot
   * be stretched to fake that, so a sized layer is re-photographed per frame with the
   * element temporarily laid out at the tweened size. Absent - every layer that
   * keyframes no size - is byte-for-byte today's shot.
   */
  size?: { w: number; h: number };
}

/**
 * The capture frame one plate shot asks dom-to-image for: canvas size in device px,
 * and the clone transform that places the box inside it.
 *
 * Pure, exported and tested for one reason - `pad` (plans/104 section 5.5) changes the shot's
 * geometry, and "a document that uses no depth exports the same bytes it always did"
 * has to be a pinned property rather than a reading of the diff. At pad 0 both numbers
 * and the transform string are what they have always been.
 *
 * The translate sits INSIDE the scale so the pad stays in ELEMENT px: `scale(S)
 * translate(p,p)` maps a point x to S·(x + p), i.e. the box sits `p·S` device px in
 * from the top-left corner and the plate's origin is `(-p, -p)` in box space.
 */
export function plateShotFrame(
  bw: number, bh: number, S: number, pad = 0,
): { width: number; height: number; transform: string } {
  // Non-finite / negative pads are simply no pad: this number can arrive from a
  // budget calculation over hostile attribute values, and a NaN here would size a
  // canvas to NaN and lose the whole plate.
  const p = Number.isFinite(pad) && pad > 0 ? pad : 0;
  return {
    width: Math.max(1, Math.round((bw + p * 2) * S)),
    height: Math.max(1, Math.round((bh + p * 2) * S)),
    transform: p ? `scale(${S}) translate(${p}px, ${p}px)` : `scale(${S})`,
  };
}

/** What one layer's plates must be shot at, measured over its WHOLE active window. */
export interface PlateWindowDemand {
  /**
   * Capture margin on all four sides, stage-native px: the largest distance this
   * layer's effects reach outside its own box at any frame (plans/104 section 5.5).
   *
   * Zero on a layer with no blur and no authored filter - which is every layer of
   * every document written before this feature, and the reason their plates are the
   * exact canvases they always were.
   */
  pad: number;
  /**
   * The largest projection magnification over the window. Plates are shot at `S·eff`
   * so a layer flown toward the camera does not arrive as a blown-up S-resolution
   * plate. 1 on a flat scene, and 1 everywhere in P0, where there is no camera.
   */
  maxEff: number;
  /**
   * The largest DRAW size the layer reaches over the window, stage-native px - its
   * authored box unless the track keys `w`/`h` (section 5.2). The budget prices a size-tweened
   * layer at its widest, because its plate is re-shot per frame and the peak is what
   * has to fit.
   */
  maxW: number;
  maxH: number;
  /** True when the layer keys `w`/`h` at any frame: its plate is a per-frame re-capture. */
  sized: boolean;
}

/**
 * Ask the PLANNER what every layer will need, once, before anything is photographed.
 *
 * Deliberately not a re-derivation: it walks the same output grid the frame loop will
 * walk and reads `PlanItem.blur` and `PlanItem.resolvedZ` off the same
 * `sequenceDrawPlan` the executor consumes, so the plate a layer gets is sized by the
 * numbers that will actually be drawn with it. The only arithmetic added on top is the
 * engine's own `projectDepth` - the parity law's "import the formula, never restate
 * it", applied to a budget instead of to a frame.
 *
 * O(frames × layers), the same shape as one extra pass of the frame loop's planning
 * and a rounding error next to the rasterisation it sizes.
 */
export function plateWindowDemands(
  layers: SeqLayer[], grid: number[], totalMs: number, env?: SeqPlanEnv | null,
  cameraMoves = false,
): Map<number, PlateWindowDemand> {
  const out = new Map<number, PlateWindowDemand>();
  const shadowsOf = new Map<number, ReturnType<typeof parseDropShadows>>();
  for (const L of layers) {
    out.set(L.idx, { pad: 0, maxEff: 1, maxW: L.rect.w, maxH: L.rect.h, sized: false });
    // Only a layer whose fx the COMPOSITOR owns needs room for the spill: a layer that
    // keeps its filter on its plate has its effect baked in and clipped at the box
    // edge, exactly as every export before this feature did it (section 5.5, `ownsLayerFx`).
    shadowsOf.set(
      L.idx,
      L.shadowFilter && ownsLayerFx(L, cameraMoves) ? parseDropShadows(L.shadowFilter) : [],
    );
  }
  for (const t of grid) {
    const cam = resolveCamera(env?.cameras ?? null, t);
    for (const item of sequenceDrawPlan(layers, t, totalMs, env)) {
      const rec = out.get(item.layer.idx);
      if (!rec) continue;
      const shadows = shadowsOf.get(item.layer.idx) ?? [];
      const blur = ownsLayerFx(item.layer, cameraMoves) ? item.blur : 0;
      if (blur > 0 || shadows.length) {
        const pad = spillPad(blur, shadows);
        if (pad > rec.pad) rec.pad = pad;
      }
      const eff = projectDepth(cam, item.resolvedZ).eff;
      if (eff > rec.maxEff) rec.maxEff = eff;
      if (item.sized) {
        rec.sized = true;
        if (item.w > rec.maxW) rec.maxW = item.w;
        if (item.h > rec.maxH) rec.maxH = item.h;
      }
    }
  }
  return out;
}

/**
 * The OVERSCAN the stage background must be photographed with (plans/104 section 5.5).
 *
 * THE BUG THIS EXISTS TO FIX: the bg plate is drawn full-canvas and untransformed,
 * while every layer above it is projected - so a camera pan would slide the whole
 * composition across frozen wallpaper, which is the exact opposite of a camera move.
 * The bg is an implicit z = 0 LAYER and is projected like one; projecting it reveals
 * what used to be off the edge, so it has to be shot bigger than the stage.
 *
 * The margin, derived rather than guessed. At z = 0 the plane maps to a rect of
 * `W·eff × H·eff` centred at `(W/2 − camX·eff, H/2 − camY·eff)`, and a native-px margin
 * of `pad` covers `pad·eff` of projected space, so covering the viewport on both sides
 * of an axis needs
 *
 *     pad ≥ |camX| + (W/2)·(1/eff − 1)         (and likewise camY / H)
 *
 * - the pan term plus the pull-back term, since `eff < 1` (the camera moved AWAY) is
 * what shrinks the plane inside the frame and opens a gap at every edge at once. Taken
 * as the window maximum over the SAME grid the frame loop walks, exactly as `maxEff` is.
 *
 * 0 whenever there is no camera, which is every export written before this - and then
 * the plate is the plate it always was and the executor takes its untransformed draw.
 */
export function bgOverscanPad(
  stageW: number, stageH: number, grid: number[], env?: SeqPlanEnv | null,
): number {
  if (!env?.cameras || env.cameras.length === 0) return 0;
  const w = Number.isFinite(stageW) && stageW > 0 ? stageW : 0;
  const h = Number.isFinite(stageH) && stageH > 0 ? stageH : 0;
  let pad = 0;
  for (const t of grid) {
    const cam = resolveCamera(env.cameras, t);
    const eff = projectDepth(cam, 0).eff;
    if (!(eff > 0)) continue;
    const k = (1 / eff - 1) / 2;
    pad = Math.max(pad, Math.abs(cam.x) + w * k, Math.abs(cam.y) + h * k);
  }
  return pad > 0 ? pad : 0;
}

async function rasterBox(
  el: HTMLElement, S: number, hide: Element[] = [], ropts: RasterOpts = {},
): Promise<HTMLCanvasElement | null> {
  const lib = await getDomToImage();
  const restore: (() => void)[] = [];
  // The SIZE OVERRIDE goes on FIRST, before anything is measured: a size tween's whole
  // point is that the element re-lays-out, so the shot's own `bw`/`bh` have to be the
  // tweened ones and the clone's `style.width/height` (below) have to agree with them.
  if (ropts.size && ropts.size.w > 0 && ropts.size.h > 0) {
    const s = el.style;
    const pw = s.width;
    const ph = s.height;
    s.width = `${ropts.size.w}px`;
    s.height = `${ropts.size.h}px`;
    restore.push(() => {
      if (pw) s.width = pw; else s.removeProperty('width');
      if (ph) s.height = ph; else s.removeProperty('height');
    });
  }
  const bw = Math.max(1, parseFloat(el.style.width) || el.offsetWidth || 1);
  const bh = Math.max(1, parseFloat(el.style.height) || el.offsetHeight || 1);
  const frame = plateShotFrame(bw, bh, S, ropts.pad ?? 0);
  // THE STAGE IS LIVE, AND THE CLOCK HAS BEEN ON IT. Every box outside the
  // playhead window carries `.seq-off`, which timeline.css turns into
  // `display:none !important`, and dom-to-image copies the computed cssText
  // wholesale into its clone - so a box that is merely "not under the playhead"
  // rasterises BLANK, and an export taken with the playhead at 4 s would ship
  // picture for exactly one clip. Cleared for the duration of the shot only (so
  // nothing flickers on screen for longer than a frame) and restored on every
  // path, including a thrown serialisation.
  for (const off of [
    ...(el.classList?.contains?.(OFF_CLASS) ? [el] : []),
    ...(el.querySelectorAll?.(`.${OFF_CLASS}`) ?? []),
  ]) {
    off.classList.remove(OFF_CLASS);
    restore.push(() => off.classList.add(OFF_CLASS));
  }
  for (const h of hide) {
    const s = (h as HTMLElement).style;
    const prev = s.display;
    s.display = 'none';
    restore.push(() => { s.display = prev; });
  }
  if (ropts.transparentBg) {
    const prev = el.style.background;
    el.style.background = 'transparent';
    restore.push(() => { el.style.background = prev; });
  }
  if (ropts.opaque) {
    const prev = el.style.opacity;
    el.style.opacity = '1';
    restore.push(() => { el.style.opacity = prev; });
  }
  if (ropts.neutralFilter) {
    // REMOVE THE INLINE DECLARATION, and only that - because the inline declaration is
    // exactly what the planner owns. `readLayer` splits `styleProp(el,'filter')`, which
    // is `el.style.getPropertyValue('filter')`: inline by construction. A `filter`
    // arriving from a tool's `styles.css` never reaches `SeqLayer.blur`/`shadowFilter`,
    // so nobody would re-apply it - and writing `filter:none` here (which DOES
    // out-specify a class) would delete it from the plate as well, silently losing an
    // effect that shipped in every export before this feature existed. The neutralised
    // set and the read set are now the same set: inline is compositor-owned, a
    // stylesheet filter stays baked into the plate exactly as it always was.
    const prev = el.style.filter;
    el.style.removeProperty('filter');
    restore.push(() => { if (prev) el.style.filter = prev; else el.style.removeProperty('filter'); });
  }
  if (ropts.neutralClipPath) {
    // Same posture as `neutralFilter`, for the same reason: REMOVE the inline
    // declaration, never write `clip-path:none`, which would also out-specify a
    // stylesheet-authored clip the executor has no idea about and never reproduces.
    // The inline one is the one `readLayer` reads and the one `drawItem` re-applies.
    const prev = el.style.clipPath;
    el.style.removeProperty('clip-path');
    restore.push(() => { if (prev) el.style.clipPath = prev; else el.style.removeProperty('clip-path'); });
  }
  try {
    return await lib.toCanvas(el, {
      width: frame.width,
      height: frame.height,
      style: {
        transform: frame.transform, transformOrigin: 'top left',
        width: `${bw}px`, height: `${bh}px`, left: '0', top: '0', margin: '0',
      },
    });
  } catch {
    return null;
  } finally {
    for (const r of restore.reverse()) r();
  }
}

// ── the audio mix ───────────────────────────────────────────────────────────

interface MixResult {
  /** The analytic mix description (plans/156): the placed clips + looping beds
   *  mixWindow evaluates, or null when there is genuinely nothing to mix. BOTH the
   *  whole buffer (sequenceAudioPcm, the worker handover) and the streaming windows
   *  are produced from this one spec, so they are the same code by construction. */
  spec: MixSpec | null;
  /** The whole-mix length in sample frames - ceil(totalSec · MIX_RATE), the exact
   *  count the OAC destination buffer used to have. Drives the whole-buffer length
   *  and the streaming window grid alike. */
  totalSamples: number;
  hasClipAudio: boolean;
  /** Whether a music bed actually CONNECTED - false when none was picked and false
   *  when the pick could not be fetched or decoded. Not the same as `opts.audio.url`
   *  being set, which is only the request. The video path does not care (a bed that
   *  failed leaves silent-but-harmless space under the picture); an audio-only
   *  export does, because with no clip audio either the whole file would be that
   *  silence. */
  hasBed: boolean;
}

/** The "nothing to mix" result - the non-streaming tiers and the empty guard. */
const EMPTY_MIX: MixResult = { spec: null, totalSamples: 0, hasClipAudio: false, hasBed: false };

/**
 * The whole mix as ONE PcmSource, evaluated by mixWindow over the full length.
 *
 * Used only for the WORKER handover, which transfers planar PCM (an AudioBuffer is
 * not transferable and the worker cannot open an OfflineAudioContext to decode the
 * bed itself). This is the one O(duration) audio allocation left on the streaming
 * side, and it exists ONLY on the worker path; the in-thread / GL / tilt tiers stream
 * 0.1 s windows through `windowedAudioFeeder` and never materialise the whole mix. The
 * worker then feeds this via `addAudio`, chunked on the SAME 4800 grid the in-thread
 * feeder uses, so both threads stay byte-identical (the worker-SHA golden).
 */
function wholeMixPcm(spec: MixSpec, total: number, normalizeTarget?: number): PcmSource {
  const [left, right] = limitPlanes(mixWindow(spec, 0, total), normalizeTarget);
  return {
    length: total,
    numberOfChannels: MIX_CHANNELS,
    getChannelData: (ch: number): Float32Array => (ch === 0 ? left : right),
  };
}

/**
 * The master pass over an already-materialised mix (plans/165 Slice E): the same
 * -1 dBTP limiter the windowed feeder streams through, run whole-range. The limiter
 * is chunk-invariant, so this and the feeder produce byte-identical streams from
 * the same spec - the worker-SHA golden's precondition.
 */
function limitPlanes(planes: [Float32Array, Float32Array], normalizeTarget?: number): [Float32Array, Float32Array] {
  if (Number.isFinite(normalizeTarget as number)) {
    const meter = createLoudnessMeter(MIX_RATE);
    meter.push(planes[0], planes[1]);
    const lkfs = meter.integrated();
    if (lkfs != null) scalePlanes(planes, normalizeGain(lkfs, normalizeTarget as number));
  }
  const lim = createTruePeakLimiter({ rate: MIX_RATE });
  const [aL, aR] = lim.process(planes[0], planes[1]);
  const [bL, bR] = lim.flush();
  const left = new Float32Array(planes[0].length);
  const right = new Float32Array(planes[1].length);
  left.set(aL, 0);
  left.set(bL, aL.length);
  right.set(aR, 0);
  right.set(bR, aR.length);
  return [left, right];
}

/**
 * One OfflineAudioContext carrying every clip's own sound plus the export bar's
 * music bed, ducked under the clips.
 *
 * v1 rule: a clip whose `speed !== 1` is MUTED with a warning. Resampling PCM to
 * a new rate is easy; time-stretching it without a pitch shift is a real DSP
 * project, and a chipmunk voiceover is worse than a silent one.
 */
async function mixSequenceAudio(
  layers: SeqLayer[], totalSec: number, opts: ExportOpts, host: SeqHost | null,
): Promise<MixResult> {
  const OAC = (globalThis as any).OfflineAudioContext ?? (globalThis as any).webkitOfflineAudioContext;
  const empty: MixResult = { spec: null, totalSamples: 0, hasClipAudio: false, hasBed: false };
  if (!OAC || !(totalSec > 0)) return empty;
  const log = (l: string, m: string): void => host?.log?.(l, m);

  // The mix still opens an OfflineAudioContext, but ONLY as the platform's audio
  // DECODER: decodeAudioData is the sole route from compressed bed bytes (mp3/ogg) to
  // PCM on this bridge. NO graph is rendered and startRendering is never called - every
  // clip is read as PCM by its provider and every bed is looped + enveloped
  // analytically by mixWindow - so nothing here allocates the O(duration) destination
  // buffer the OAC render used to hold (plans/156 Phase B: the dominant memory hold).
  const octx: OfflineAudioContext = new OAC(MIX_CHANNELS, Math.max(1, Math.ceil(totalSec * MIX_RATE)), MIX_RATE);
  const totalSamples = Math.max(1, Math.ceil(totalSec * MIX_RATE));
  const clips: MixClip[] = [];
  const spans: { from: number; to: number }[] = [];
  const xfade = audioCrossfades(layers);
  const pushed: { L: SeqLayer; mixClip: MixClip; placedSec: number; fadeInSec: number; fadeOutSec: number }[] = [];

  for (const L of layers) {
    if (L.kind !== 'video' && L.kind !== 'audio') continue;
    if (L.mute) continue;
    if (L.ignored) continue;   // struck-through: dropped from the mix (plans/174)
    if (L.durMs <= 0) continue;
    const url = mediaSrc(L);
    if (!url) {
      if (L.kind === 'audio') {
        log('warn', `sequence audio: the audio box at ${Math.round(L.startMs)}ms has no source - it will be silent.`);
      }
      continue;
    }
    let clip: ClipAudio | null = null;
    try {
      clip = await createClipAudio(url, { log });
    } catch (err) {
      log('warn', `sequence audio: ${toCodedError(err).message} - clip will be silent`);
      continue;
    }
    if (!clip) {
      // createClipAudio returns null for BOTH "this file has no audio track" and
      // "nothing here could open it". For a video layer the first is the common,
      // correct answer and warning would be noise. For an AUDIO BOX it never is:
      // the user placed it precisely to be heard, so a null is always worth
      // saying out loud. This branch used to be a bare `continue`, which is how
      // an unregistered container (Ogg/Opus and MP3 - i.e. the entire shipped
      // music catalog) produced a silent export with nothing in the log at all.
      if (L.kind === 'audio') {
        log('warn', `sequence audio: could not decode the audio box at ${Math.round(L.startMs)}ms (${url.slice(0, 120)}) - it will be silent. If this is an unusual container, re-encode it as mp3, m4a, ogg, wav or flac.`);
      }
      continue;
    }
    try {
      const from = L.clipInMs / 1000;
      const srcDur = clip.durationSec();
      // Never ask for audio past the end of the MIX. The OfflineAudioContext is
      // only `totalSec` long, so a sample starting at `startMs` can contribute at
      // most `totalSec - startMs` of sound and everything beyond that is
      // allocated, resampled, copied and then thrown away. For a decoded file the
      // source's own end already caps it - but a PROCEDURAL clip reports
      // `durationSec() === 0` by design ("I am composed to fit"), so it has no cap
      // at all: an audio box left at the parser's ceiling (MAX_TIME_MS = 1 hour)
      // would allocate ~1.4 GB of Float32 for a five-second render, twice over.
      const room = Math.max(0, totalSec - L.startMs / 1000);
      // plans/165 WP-4: at a seq-lane fade|fade cut the sound hands over exactly as
      // the picture does - the A side keeps playing past the cut for the straddle
      // (audioCrossfades' tailSec) while B fades in over the same window - so the
      // mix pulls that much extra source material when the file has it.
      const shape = xfade.get(L.idx);
      const span = Math.min(L.durMs / 1000 + (shape?.tailSec ?? 0), room);
      // Speed != 1 consumes SOURCE material at the clip's rate: the window is
      // span*speed source seconds, stretched back to span timeline seconds after
      // the decode (plans/165 WP-7 - the un-NLE "sped clips are silent" rule ends).
      const srcSpan = span * L.speed;
      const to = srcDur > 0 ? Math.min(from + srcSpan, srcDur) : from + srcSpan;
      if (!(to > from)) continue;
      let { channels } = await clip.pcm(from, to, MIX_RATE);
      const pitchSt = Math.max(-12, Math.min(12, L.pitch ?? 0));
      if ((L.speed !== 1 || pitchSt !== 0) && channels[0]?.length) {
        // The pitch pair (plans/165 WP-7/WP-7b) through ONE engine, loaded as its
        // own lazy chunk: preserve-pitch stretch by default; varispeed folds the
        // clip's speed into the transpose factor (tape-style, formants riding
        // along, an authored pitch composing on top); an explicit pitch at any
        // speed transposes with formants preserved. The source window
        // collapses/expands to the clip's timeline span, and everything
        // downstream - fades, keys, duck, the master limiter - reads the placed
        // length exactly as for any other clip.
        const { stretchPcm } = await import('../lib/audio-stretch-core.ts');
        channels = await stretchPcm(channels, L.varispeed && L.speed !== 1
          ? { speed: L.speed, factor: L.speed * 2 ** (pitchSt / 12), rate: MIX_RATE }
          : { speed: L.speed, semitones: pitchSt, rate: MIX_RATE });
      }
      // The fx chain (plans/101 section 3.4), applied AFTER the stretch - the DAW
      // convention: speed remaps the clip, inserts process the remapped output,
      // so an echo(250) rings 250 ms apart on the TIMELINE at any speed. In
      // place over the mix's own copies; unknown tokens already fell out in the
      // parse, so an older chain never throws here. `clean()` entries are the
      // SHELL's (the GTCRN model cannot live in the engine): the chain runs in
      // segments with the cleanup driver spliced in at each token's position.
      if (L.fx && channels[0]?.length) {
        const parsed = parseFxChain(L.fx);
        if (parsed.skipped.length) log('warn', `sequence audio: unknown fx entr${parsed.skipped.length === 1 ? 'y' : 'ies'} skipped (${parsed.skipped.join(', ')})`);
        let seg: typeof parsed.entries = [];
        for (const entry of parsed.entries) {
          if (entry.name !== 'clean') { seg.push(entry); continue; }
          if (seg.length) { processFxPcm(channels as Float32Array[], MIX_RATE, seg); seg = []; }
          const { cleanPcm } = await import('../lib/audio-clean-core.ts');
          channels = await cleanPcm(channels, MIX_RATE);
        }
        if (seg.length) processFxPcm(channels as Float32Array[], MIX_RATE, seg);
      }
      const frames = channels[0]?.length ?? 0;
      if (!frames) continue;
      // A buffer read placed at an absolute start. The OAC graph played it
      // with node.start(max(0, startMs/1000)); mixWindow places it at
      // round(startMs · rate / 1000) - the same sample (plans/156 section 1). A mono source
      // fans out into both output channels exactly as copyToChannel's clamp did.
      //
      // The clip's own gain timeline rides along (plans/165 WP-1/2): flat volume from
      // `data-t-gain`, shaped by fades. An AUDIO box fades on any authored in/out
      // (its transition kinds have no picture to mean anything else); a VIDEO clip's
      // soundtrack fades only under the `fade` kind - a rise or pop moves the
      // picture without touching the sound, but a crossfading picture with
      // hard-cutting audio is a mistake no editor ships. Spans anchor to the PLACED
      // audio length, so a window trimmed past its media fades on audible material.
      const placedSec = frames / MIX_RATE;
      const audioBox = L.kind === 'audio';
      // A junction side overrides its own authored fade length with the handover's
      // (min of the two, the junction law): B's fade-in shortens to it, and A's
      // fade-out becomes it, anchored - via the placed length - at the extended
      // end, so the two gains cross at the cut's midpoint like the two alphas do.
      const fadeInSec = shape?.headSec ?? (((audioBox && L.enter) || L.enter === 'fade') ? L.enterMs / 1000 : 0);
      const fadeOutSec = shape?.tailSec ?? (((audioBox && L.exit) || L.exit === 'fade') ? L.exitMs / 1000 : 0);
      const events = clipGainEvents({
        spanSec: placedSec, gain: L.gain, fadeInSec, fadeOutSec,
        volumeKeys: volumeKeysOf(L.kf) ?? undefined,
      });
      const pan = Math.max(-1, Math.min(1, L.pan ?? 0));
      const mixClip: MixClip = {
        pcm: channels, startMs: Math.max(0, L.startMs),
        ...(isTrivialGain(events) ? {} : { events }),
        ...(pan !== 0 ? { pan } : {}),
      };
      clips.push(mixClip);
      // Retained for the post-loop duck pass (plans/165 WP-6 v2): ducking needs to
      // know where every OTHER clip actually makes sound, which is only knowable
      // once all of them are decoded.
      pushed.push({ L, mixClip, placedSec, fadeInSec, fadeOutSec });
      spans.push({ from: L.startMs / 1000, to: L.startMs / 1000 + frames / MIX_RATE });
    } catch (err) {
      log('warn', `sequence audio: ${toCodedError(err).message} - clip will be silent`);
    } finally {
      await clip.dispose().catch(() => { /* already released */ });
    }
  }

  // Signal-derived ducking (plans/165 WP-6 v2): a box asked to sit under other
  // audio ducks where the other clips actually MAKE SOUND - activitySpans over the
  // PCM already decoded into the mix - not across their whole windows. An
  // undecoded clip is silent in the file, so it correctly ducks nothing. The
  // preview keeps the presence-based DOM walk (sequence-clock's duckSpansOf), a
  // conservative superset - the same accepted-divergence class as the junction
  // crossfade the preview cannot show.
  for (const p of pushed) {
    if (p.L.kind !== 'audio' || !(p.L.duck < 1)) continue;
    const duckSpans: { from: number; to: number }[] = [];
    for (const o of pushed) {
      if (o === p) continue;
      const offSec = (o.mixClip.startMs - p.mixClip.startMs) / 1000;
      for (const s of activitySpans(o.mixClip.pcm, { rate: MIX_RATE })) {
        duckSpans.push({ from: s.from + offSec, to: s.to + offSec });
      }
    }
    const events = clipGainEvents({
      spanSec: p.placedSec, gain: p.L.gain, fadeInSec: p.fadeInSec, fadeOutSec: p.fadeOutSec,
      volumeKeys: volumeKeysOf(p.L.kf) ?? undefined,
      duck: duckSpans.length ? { level: p.L.duck, spans: duckSpans } : undefined,
    });
    if (isTrivialGain(events)) delete p.mixClip.events;
    else p.mixClip.events = events;
  }

  const beds: MixBed[] = [];
  let hasBed = false;
  if (opts.audio?.url) {
    try {
      const bytes = await (await fetch(opts.audio.url)).arrayBuffer();
      const bed = await octx.decodeAudioData(bytes);
      // Per-span ducking: the bed returns to full volume BETWEEN clips too, not
      // just before the first and after the last (bedDuckEnvelope merges spans
      // whose gap is too short for the bed to meaningfully come back up).
      const duckLevel = clamp01(opts.audio.duck ?? 1);
      const duck = spans.length && duckLevel < 1 ? { level: duckLevel, spans } : undefined;
      beds.push(buildBed(bed, {
        fadeIn: opts.audio.fadeIn, fadeOut: opts.audio.fadeOut,
        clipSec: totalSec, volume: opts.audio.volume, duck, start: opts.audio.start,
      }, log));
      hasBed = true;
      // A mix-in track (a tool with its own audio, section 6.1). The primary bed above
      // loops the whole clip here, so the mix-in ducks to its centre level for
      // the full duration rather than being silently dropped.
      if (opts.audio.mix?.url) {
        try {
          const bed2 = await octx.decodeAudioData(await (await fetch(opts.audio.mix.url)).arrayBuffer());
          const centre = clamp01(opts.audio.mix.centre ?? 1);
          beds.push(buildBed(bed2, {
            fadeIn: opts.audio.mix.fadeIn, fadeOut: opts.audio.mix.fadeOut,
            clipSec: totalSec, volume: opts.audio.mix.volume,
            duck: centre < 1 ? { level: centre, spans: [{ from: 0, to: totalSec }] } : undefined,
            rampSec: MIX_RAMP_SEC,
          }, log));
        } catch (err) {
          log('warn', `Mix-in track unavailable (${(err as { message?: string })?.message ?? err}); exporting without it.`);
        }
      }
    } catch (err) {
      log('warn', `Music bed unavailable (${(err as { message?: string })?.message ?? err}); exporting without it.`);
    }
  }

  // Nothing to mix: exactly the OAC path's null result. Otherwise the spec that BOTH
  // the whole buffer and the streaming windows are evaluated from - one mixer, one
  // description (plans/156 B2). No startRendering, so no O(duration) buffer is born.
  if (!clips.length && !hasBed) return empty;
  return { spec: { clips, beds, rate: MIX_RATE }, totalSamples, hasClipAudio: clips.length > 0, hasBed };
}

/** The URL a media layer decodes from - the <video>'s src, or the audio marker's. */
function mediaSrc(L: SeqLayer): string {
  const el = L.el;
  if (L.kind === 'audio') {
    const m = el.matches?.('[data-audio-src]') ? el : el.querySelector?.('[data-audio-src]');
    return m?.getAttribute('data-audio-src') ?? '';
  }
  const v = (el.matches?.('video') ? el : el.querySelector?.('video')) as HTMLVideoElement | null;
  return v ? (v.currentSrc || v.getAttribute('src') || '') : '';
}

/**
 * Preserve what this film is MADE OF, into the export's Content Credentials
 * (plans/130).
 *
 * WHERE IT IS CALLED FROM, and why that is the whole design. `renderFormat` reads
 * `opts._ingredientSink` after the render returns, so the gather has to have run by
 * then whichever way the render left - and `renderSequenceAuthored` has FIVE exits
 * (the tilt capture tier, the GL composite, the worker, the in-thread executor, and
 * the nested writers below them), the first of which returns before a single plate
 * is photographed. There is no late point common to all five. So both callers run
 * this immediately after the stage guard, before any path-specific work, and no
 * exit has to remember anything.
 *
 * WHAT COUNTS AS A SOURCE. Every video and audio layer, with no further filter.
 * Not the mixer's list: that skips muted, zero-length and speed-shifted clips,
 * which still put picture on the screen (and were still opened either way), so
 * their provenance is still part of this film's history. Not the worker's `clips`
 * either: that holds only video layers visible in the used grid, which drops every
 * audio box - precisely the case this exists to cover. And the export bar's music
 * bed is not a layer at all, so it is added by hand or it travels uncredited.
 *
 * Never fatal. The gather itself cannot throw; this wrapper catches anyway, because
 * a provenance gather failing is not a reason to refuse someone their film.
 */
async function gatherStageIngredients(
  layers: SeqLayer[], opts: ExportOpts, host: SeqHost | null,
): Promise<void> {
  if (!opts.c2pa || !opts._ingredientSink) return;
  try {
    const sources: SequenceIngredientSource[] = [];
    for (const L of layers) {
      if (L.kind !== 'video' && L.kind !== 'audio') continue;
      const url = mediaSrc(L);
      if (url) sources.push({ kind: L.kind, url });
    }
    if (opts.audio?.url) sources.push({ kind: 'audio', url: opts.audio.url });
    if (opts.audio?.mix?.url) sources.push({ kind: 'audio', url: opts.audio.mix.url });
    await gatherSequenceIngredients(sources, opts._ingredientSink, {
      // A rendered document holds URLs and nothing else, so the id has to be
      // recovered from the asset bridge's own object-URL cache. This is the only
      // route to an upload's credential at all: ingest re-encoded its pixels, so
      // the store lives beside the record rather than in the bytes being played.
      credentialForUrl: async (url) => {
        try {
          const id = assetIdForUrl(url);
          if (!id) return null;
          return (await host?.assets?.credential?.(id)) ?? null;
        } catch {
          return null;
        }
      },
      // The fallback, for the sources with no id to find. Capped at the same size
      // the asset bridge refuses to scan past: a timeline can hold several
      // multi-hundred-megabyte clips, and reading all of them to look for a
      // manifest most of them do not carry is a cost nobody asked for.
      fetchBytes: async (url, answered) => {
        // Only a URL the bridge ANSWERED for is already settled: that store is the
        // authoritative one, and for an upload it is the only copy that exists, so
        // re-reading the whole clip could only reach the same place slowly, with
        // the artboard held posed by withAuthoredDom. A null answer settles
        // nothing. Naming an id and carrying a credential are different facts: a
        // video job signs its output into its own bytes, and a record written
        // before that capture existed has an id and an empty credential field -
        // skipping the scan on the id alone threw those clips' provenance away
        // silently, which is the one outcome this gather exists to prevent.
        if (answered) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          if (blob.size > MAX_CREDENTIAL_SCAN_BYTES) return null;
          return new Uint8Array(await blob.arrayBuffer());
        } catch {
          return null;
        }
      },
    });
  } catch (err) {
    host?.log?.('warn', `Source credentials not gathered (${(err as { message?: string })?.message ?? err}); exporting without them.`);
  }
}

// ── caption collection (plans/180 section 4) ────────────────────────────────
//
// A caption on this stage is an ordinary drawn text box, so it is already burned
// into the picture. What the subtitle track and the sidecar files need is the same
// set of cues as DATA: what was said, and between which two moments of the film.
// The stage is the one place both facts sit together, which is why the collection
// is here rather than beside the model - the export bar never has to know a tool's
// field names, and a re-timed or trimmed caption cannot disagree with the picture
// it was rendered into.

/** The class the caption preset stamps on a caption box (views/timeline-captions.ts
 *  owns it). `data-caption` is the same statement as an attribute, for a tool that
 *  marks its captions itself rather than through the Design box `cls` field. */
const CAPTION_SELECTOR = `.lolly-box.${CAPTION_BOX_CLASS}[data-t-start], .lolly-box[data-caption][data-t-start]`;

/** Collapse every run of whitespace, including the line breaks a two-line caption
 *  box holds, to one space: a blank line TERMINATES a cue block in both WebVTT and
 *  SubRip, so a cue carrying one would split into a good cue and a broken fragment. */
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

const attrMs = (el: Element, name: string): number => {
  const v = parseFloat(el.getAttribute(name) ?? '');
  return Number.isFinite(v) ? v : Number.NaN;
};

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** How {@link stageCaptionCues} is bounded. */
export interface StageCaptionOpts {
  /** The film's length in ms. Defaults to the stage's own `data-seq-ms`; pass the
   *  export's length when the user typed a shorter one, so no cue outlives the file. */
  totalMs?: number;
}

/**
 * The caption boxes on a `[data-sequence]` stage, as cues in FILM seconds.
 *
 * Read straight off the rendered markup: `data-t-start` / `data-t-dur` are the
 * same numbers the compositor gates the picture with, and the box's own text is
 * what the viewer sees burned in. So a cue here can never say something the frame
 * does not, which is the property that lets the sidecar and the embedded track be
 * generated without a second pass over the audio.
 *
 * Struck-through clips (`data-t-ignored`) are skipped - the compositor draws none
 * of them - and a cue is clamped to the film, then dropped if the clamp leaves it
 * too short to read. Empty in, empty out: a document with no caption boxes gives
 * back no cues at all, which is what keeps a caption-less export byte-identical.
 */
export function stageCaptionCues(node: Element | null | undefined, opts: StageCaptionOpts = {}): CaptionCue[] {
  const root = node as HTMLElement | null | undefined;
  const stage = root?.matches?.('[data-sequence]')
    ? root
    : (root?.querySelector?.('[data-sequence]') as HTMLElement | null);
  if (!stage?.querySelectorAll) return [];
  const declared = attrMs(stage, 'data-seq-ms');
  const totalMs = Number.isFinite(Number(opts.totalMs)) && Number(opts.totalMs) > 0
    ? Number(opts.totalMs)
    : (Number.isFinite(declared) && declared > 0 ? declared : 0);
  const endLimit = totalMs > 0 ? totalMs / 1000 : Number.POSITIVE_INFINITY;
  const out: CaptionCue[] = [];
  for (const el of stage.querySelectorAll<HTMLElement>(CAPTION_SELECTOR)) {
    if (el.getAttribute('data-t-ignored') != null) continue;
    const startMs = attrMs(el, 'data-t-start');
    if (!Number.isFinite(startMs)) continue;
    const durMs = attrMs(el, 'data-t-dur');
    const start = Math.max(0, startMs / 1000);
    // An open-ended caption box (no authored duration) runs to the end of the film,
    // exactly as the compositor draws it.
    const end = Math.min(endLimit, Number.isFinite(durMs) && durMs > 0 ? start + durMs / 1000 : endLimit);
    if (!(end > start) || !Number.isFinite(end)) continue;
    const text = oneLine((el.querySelector('.lolly-box-text') ?? el).textContent ?? '');
    if (!text) continue;
    if (end - start < MIN_CUE_KEEP_S) continue;
    out.push({ start: round3(start), end: round3(end), text });
  }
  out.sort((a, b) => (a.start - b.start) || (a.end - b.end));
  return out;
}

/**
 * The mixed timeline audio as planar PCM: every unmuted clip's own sound plus the
 * export bar's music bed, ducked under them. This is what an audio-only export
 * (wav/mp3/m4a/opus) of a sequence IS - the soundtrack of the video export, in a
 * file with no picture.
 *
 * It runs the SAME `mixSequenceAudio` the mp4/webm path feeds to the muxer, over
 * the same layers at the same length, because a second mixer would drift and the
 * exported wav would stop matching the exported mp4's sound - which is the whole
 * point of offering the format.
 *
 * `null` means there is genuinely nothing to mix (no bed, and no unmuted clip that
 * carries sound). That is exactly the case in which the video path exports silent
 * video; the audio-only caller turns it into a refusal instead, because a file
 * that is only silence reads as a broken export rather than an empty one.
 *
 * Shape matches `AudioPcm` in lib/audio-encode.ts, which is the DOM convention
 * export.ts's `lollyAudioSource()` reads. The import is type-only so the encoders
 * (lamejs, the muxers) stay off this module's graph.
 */
export async function sequenceAudioPcm(
  node: Element, opts: ExportOpts, host: SeqHost | null = null,
): Promise<AudioPcm | null> {
  const parsed = parseSequenceStage(node as HTMLElement);
  const stage = parsed ? applyDurationOverride(parsed, opts) : null;
  if (!stage || !stage.totalMs) throw sequenceError('SEQ_DECODE_FAILED', 'not a timed sequence stage');
  if (stage.totalMs > MAX_SEQUENCE_MS) {
    throw sequenceError('SEQ_TOO_HEAVY', `sequence is ${Math.round(stage.totalMs / 1000)}s; the export ceiling is ${MAX_SEQUENCE_MS / 1000}s`);
  }
  // An audio-only export of a sequence is stamped by the same renderFormat tail the
  // video is, so it earns its ingredients the same way. Threading them only through
  // renderSequence would credit the film and orphan its soundtrack.
  await gatherStageIngredients(stage.layers, opts, host);
  // Length is derived through the frame grid rather than from totalMs directly,
  // so it is the identical number renderSequence hands the mix for mp4/webm (the
  // streaming path never caps the grid). Same fps default, same rounding.
  const fps = Math.max(1, Math.round(opts.fps ?? 30));
  const grid = frameTimestamps(stage.totalMs, fps);
  if (!grid.length) throw sequenceError('SEQ_DECODE_FAILED', 'sequence has no frames');

  const mix = await mixSequenceAudio(stage.layers, grid.length / fps, opts, host);
  if (!mix.spec || (!mix.hasClipAudio && !mix.hasBed)) return null;
  // The WHOLE buffer, produced by the SAME mixWindow the streaming path feeds in 0.1 s
  // windows (plans/156 B2) - one range call over the full length, through the SAME
  // master limiter. So the audio-only export (wav/mp3/m4a/opus) is, sample-for-sample,
  // the soundtrack the mp4/webm path muxes: not a second mixer that could drift, but
  // the identical closed form.
  const [left, right] = limitPlanes(mixWindow(mix.spec, 0, mix.totalSamples), opts.normalize);
  return { channels: [left, right], sampleRate: MIX_RATE };
}

// ── the orchestrator ────────────────────────────────────────────────────────

/**
 * Render a `[data-sequence]` stage to a motion file.
 *
 * Contract with the export funnel: this returns the finished container with
 * provenance tags already embedded (like every other video renderer); the C2PA
 * stamp is applied uniformly by renderFormat afterwards. What this render owes
 * that stamp is its INGREDIENTS - the credentials of the clips and the bed it was
 * cut from, gathered up front into `opts._ingredientSink` (plans/130) because
 * renderFormat reads that sink whichever exit the render took.
 *
 * THE READ/RESTORE SEAM (plans/104 section 6 point 0) is this wrapper, and it is the whole
 * reason the render is one function inside another. Everything below reads or
 * photographs the LIVE artboard - `parseSequenceStage` takes each box's rotation,
 * opacity and blur off its inline style; `rasterBox` photographs the element itself - 
 * and the preview clock has been WRITING those very properties, composed for whatever
 * frame the playhead is parked on. The playhead can be parked anywhere when an export
 * starts. So the whole render runs inside `withAuthoredDom`: every live writer over
 * this node hands its per-frame writes back and stays stood down until the last plate
 * (and every live Lottie re-shot mid-render) is in, then re-asserts the frame the user
 * was looking at. Failure paths included - the scope restores on a throw.
 *
 * It wraps the ENTIRE render rather than just the parse because the plates are not the
 * only live read: the hybrid Lottie path re-photographs its box on demand, deep inside
 * the frame loop, and an rAF tick landing between two of those shots would pose the
 * stage again half way through the film.
 */
export async function renderSequence(
  node: Element, format: 'mp4' | 'webm' | 'gif' | 'apng' | 'webp-anim', opts: ExportOpts, host: SeqHost | null = null,
): Promise<Blob> {
  return await withAuthoredDom(node as HTMLElement, () => renderSequenceAuthored(node, format, opts, host));
}

/** A start so far ahead it can only be a parked fragment - never a rest moment. */
const PENDING_SLIDE_MS = 86_400_000;

async function renderSequenceAuthored(
  node: Element, format: 'mp4' | 'webm' | 'gif' | 'apng' | 'webp-anim', opts: ExportOpts, host: SeqHost | null = null,
): Promise<Blob> {
  const log = (l: string, m: string): void => host?.log?.(l, m);
  // The stage declares its own length (data-seq-ms), which is the default and tracks
  // the timeline. A duration the USER typed into the export bar overrides it - the
  // override lands here, before the ceiling check and before anything is sized off
  // totalMs, so the whole render (frame grid, open-ended layers, audio, the
  // truncation verdict) is derived from one number.
  const parsed = parseSequenceStage(node as HTMLElement);
  const stage = parsed ? applyDurationOverride(parsed, opts) : null;
  if (!stage || !stage.totalMs) throw sequenceError('SEQ_DECODE_FAILED', 'not a timed sequence stage');
  // First, cheap, upper-bound guard (plans/156 WP-A part 4). 10 min (MAX_SEQUENCE_MS)
  // normally; lifted to 30 min for the streaming formats (mp4/webm) - the only ones that
  // can stream the container to OPFS instead of holding it in memory. Whether THIS export
  // actually gets the OPFS sink (long enough, WebCodecs present, OPFS present) is settled
  // precisely below once pick + frameCount are known, and a streaming export that stays on
  // BufferTarget or falls back is re-bounded at 10 min there. Here we only refuse a
  // hand-edited seq-ms no target could ever hold.
  const earlyCeilingMs = (format === 'mp4' || format === 'webm') ? MAX_SEQUENCE_STREAM_MS : MAX_SEQUENCE_MS;
  if (stage.totalMs > earlyCeilingMs) {
    throw sequenceError('SEQ_TOO_HEAVY', `sequence is ${Math.round(stage.totalMs / 1000)}s; the export ceiling is ${earlyCeilingMs / 1000}s`);
  }

  // FIRST, before a single plate is photographed or a thread is chosen: the film's
  // sources are the same whichever of the five exits below this render leaves by,
  // and the tilt tier takes the earliest of them. See gatherStageIngredients.
  await gatherStageIngredients(stage.layers, opts, host);

  const stageEl = ((node as HTMLElement).matches?.('[data-sequence]') ? node : node.querySelector('[data-sequence]')) as HTMLElement;
  // A frames-as-scenes slideshow ("Design", plan 92) sizes to a SLIDE, not the stage:
  // the [data-sequence] element spans the whole side-by-side pasteboard of every frame,
  // so its offsetWidth is the strip, not one slide. Size the output to the first timed
  // frame's own box; combined with normalizeFrameScene (which re-anchors each slide's
  // draw rect to (0,0,nativeW,nativeH)) every slide then fills this slide-sized canvas
  // at the origin. Object-clip Video / Sequence Studio docs carry no frameScene layer,
  // so they keep the stageEl.offsetWidth path byte-for-byte.
  const frameScene0 = stage.layers.find((l) => l.frameScene && l.rect.w > 0 && l.rect.h > 0);
  const wantW = Number(opts.width);
  const wantH = Number(opts.height);
  // Frames mode: the output frame is the CALLER'S requested size when given - the
  // export bar mirrors the artboard under the playhead (plans/141 WP-B/C) - falling
  // back to the first timed frame's own box. Every slide then contain-fits into it
  // via normalizeFrameScene: a different-sized artboard letterboxes, never stretches.
  const nativeW = frameScene0
    ? (Number.isFinite(wantW) && wantW > 0 ? Math.round(wantW) : frameScene0.rect.w)
    : Math.max(1, stageEl.offsetWidth || 1920);
  const nativeH = frameScene0
    ? (Number.isFinite(wantH) && wantH > 0 ? Math.round(wantH) : frameScene0.rect.h)
    : Math.max(1, stageEl.offsetHeight || 1080);
  // Even dimensions: H.264 chroma subsampling refuses an odd width or height. The
  // rounding happens BEFORE the scale is derived, so an odd requested width is
  // resampled to fit rather than losing its last pixel column of content.
  const outW = Math.max(2, Math.round(Number.isFinite(wantW) && wantW > 0 ? wantW : nativeW)) & ~1;
  const S = outW / nativeW;
  const targetH = Math.max(2, Math.round(nativeH * S) & ~1);
  if (Number.isFinite(wantH) && wantH > 0 && Math.abs(wantH - targetH) > 2) {
    log('warn', `sequence: exporting ${outW}x${targetH} - a sequence keeps the stage's aspect ratio, so the requested height (${Math.round(wantH)}) is derived from the width.`);
  }

  const fps = format === 'gif' ? GIF_FPS : Math.max(1, Math.round(opts.fps ?? 30));
  const grid = frameTimestamps(stage.totalMs, fps);
  if (!grid.length) throw sequenceError('SEQ_DECODE_FAILED', 'sequence has no frames');

  const streaming = format === 'mp4' || format === 'webm';
  // Encoder selection happens HERE, before anything is sized against the frame
  // count, because whether WebCodecs can encode decides whether the frame cap
  // applies: the streaming muxer holds no frames, the MediaRecorder fallback holds
  // an ImageBitmap for every one of them.
  // Codec-agnostic base at the chosen quality stop probes the ladder; an explicit codec
  // (pro-settings) is honoured where supported; then trim `bitrate` to the picked codec's
  // efficiency, so every downstream mux/worker call inherits the AV1/HEVC saving.
  const baseBitrate = videoBitrate(outW, targetH, fps, bppForQuality(opts.videoQuality ?? 'balanced'));
  // Plan 154 WP-2, extended to the streaming path. DEVICE-INDEPENDENT: hdrDesired is the
  // explicit opts.hdr toggle ONLY, never displaySupportsHdr() - the display governs
  // preview, never the encoded bytes, so a credentialed HDR viz/audiogram is byte-repro-
  // ducible across machines. hdrActive additionally requires the ladder to have landed a
  // real 10-bit HDR codec (pickWebCodecsVideo's hdr arm), so a browser that cannot encode
  // one SILENTLY gets today's SDR bytes. When hdrActive is false, everything below is
  // byte-for-byte the pre-WP-2 streaming path (the goldens set no opts.hdr).
  const hdrDesired = opts.hdr === true;
  const pick = streaming ? await pickWebCodecsVideo(format, outW, targetH, fps, baseBitrate, opts.videoCodec, hdrDesired) : null;
  const hdrActive = hdrDesired && !!pick && is10bitHdrCodec(pick.codec);
  // WP-3 (plan 154): the DEEP float HDR encode. Opt-in (perf-sensitive) AND capability-
  // gated - the deep path only runs where the runtime can build the 10-bit I420P10 frame
  // it emits; anywhere else (WebKit today, flag off, or SDR) it DEGRADES to the 8-bit
  // path above, byte-for-byte. So `hdrDeep` false ⇒ the WP-2 streaming path unchanged.
  const hdrDeep = hdrActive && deepHdrCompositorEnabled() && supportsI420P10Frame();
  // The buffer layout the mux tags each HDR VideoFrame with: 10-bit YUV on the deep path,
  // 8-bit RGBA otherwise. Only consulted when hdrActive (the ...spread below is empty when not).
  const hdrFrameFormat: 'RGBA' | 'I420P10' = hdrDeep ? 'I420P10' : 'RGBA';
  // One-shot perf A/B, shared across the render tiers (only one runs per export).
  const hdrPerf: HdrDeepPerf | null = hdrDeep ? { log, done: false } : null;
  if (hdrDeep) log('info', 'sequence: HDR deep float encode (plan 154 WP-3, lolly.hdrCompositor) - boost in float, 10-bit I420P10 out.');
  const bitrate = pick ? codecAdjustedBitrate(baseBitrate, pick.codec) : baseBitrate;
  if (streaming && !pick) {
    log('warn', 'sequence: WebCodecs encode unavailable - falling back to a real-time MediaRecorder replay (correct, but as slow as the clip is long).');
  }

  let frameCount = grid.length;
  // plans/156 WP-A part 4 - the GUARDED ceiling. The 30-min lift is selectable ONLY when
  // the OPFS StreamTarget is the ACTIVE sink: a streaming (mp4/webm) export, on the
  // WebCodecs path (pick), long enough to cross the frame gate (streamMuxTargetFor), with
  // real OPFS present. Anything else - a short buffered export, a gif/apng, a MediaRecorder
  // fallback, or an OPFS-unavailable browser - keeps the 10-min MAX_SEQUENCE_MS bound.
  const useOpfs = streaming && !!pick
    && streamMuxTargetFor(frameCount) === 'opfs'
    && opfsStreamingAvailable();
  const ceilingMs = ceilingMsFor(useOpfs);
  if (streaming && pick) {
    if (frameCount > fps * (ceilingMs / 1000)) {
      throw sequenceError('SEQ_TOO_HEAVY', `sequence needs ${frameCount} frames (over the ${ceilingMs / 1000}s ceiling)`);
    }
  } else {
    // Every non-streaming path buffers each frame - gif/apng as pixels or encoded
    // PNGs, the MediaRecorder fallback as ImageBitmaps - so the historical memory
    // cap applies to all of them (see the header). These never touch the OPFS sink, so
    // they keep the 10-min MAX_SEQUENCE_MS bound: refuse a hand-edited over-ceiling length
    // rather than silently capping a half-hour request down to a few hundred frames.
    if (stage.totalMs > MAX_SEQUENCE_MS) {
      throw sequenceError('SEQ_TOO_HEAVY', `sequence is ${Math.round(stage.totalMs / 1000)}s; the export ceiling is ${MAX_SEQUENCE_MS / 1000}s`);
    }
    const cap = maxVideoFrames();
    if (frameCount > cap) {
      log('warn', `${format.toUpperCase()} capped at ${cap} frames (requested ${frameCount}); shorten the sequence, or export mp4/webm, to fit it all in.`);
      frameCount = cap;
    }
  }
  // ONE grid for everything downstream: the frame loop, every layer's activity
  // window, the overlap budget and the truncation verdict. Deriving any of those
  // from the uncapped grid is how a complete gif export dies as SEQ_TRUNCATED.
  const usedGrid = frameCount === grid.length ? grid : grid.slice(0, frameCount);

  // Overlapping-clip budget, checked BEFORE any decoder is opened so a hopeless
  // composition fails in milliseconds instead of half way through a render.
  const junctions = crossfadeJunctions(stage.layers);
  const ext = new Map(junctions.map((j) => [j.aIdx, j.ms]));
  // The deck's slide transition standing in as a dissolve (plans/184 R2), said once.
  const standIns = [...new Set(stage.layers.filter((l) => l.deckDissolve && l.frameTransition !== 'fade').map((l) => l.frameTransition))];
  if (standIns.length) {
    log('info', `sequence: the deck's "${standIns.join('", "')}" slide transition has no video form, so each slide change is a ${DECK_TRANSITION_MS} ms dissolve - the presenter's own length. Set the transition to "fade" or a frame's own to "none" to choose.`);
  }
  for (const j of junctions) {
    const a = stage.layers.find((l) => l.idx === j.aIdx);
    if (a && a.exitMs > j.ms) {
      log('info', `sequence: the crossfade at ${Math.round(a.startMs + a.durMs)}ms runs ${j.ms}ms - the shorter of the two clips' fade lengths (this clip authored ${a.exitMs}ms). Match the two fade lengths to get the longer dissolve.`);
    }
  }
  // Activity windows for the OVERLAP BUDGET only - the executor derives its own
  // from the same wire layers and the same grid, so the two cannot disagree.
  const win = new Map<number, { first: number; last: number; span: number[] }>();
  for (const L of stage.layers) win.set(L.idx, activeFrameWindow(L, usedGrid, ext.get(L.idx) ?? 0));
  {
    let peak = 0;
    for (let i = 0; i < frameCount; i++) {
      let n = 0;
      for (const L of stage.layers) {
        if (L.kind !== 'video') continue;
        const r = win.get(L.idx)!;
        if (r.first >= 0 && i >= r.first && i <= r.last) n++;
      }
      peak = Math.max(peak, n);
    }
    if (peak > MAX_LIVE_PROVIDERS) {
      throw sequenceError('SEQ_TOO_HEAVY', `${peak} video clips overlap; at most ${MAX_LIVE_PROVIDERS} can be decoded at once`);
    }
  }

  const transparent = opts.background === 'transparent';

  // ── plate geometry + the plate budget (plans/104 section 5.5) ─────────────────
  //
  // Two numbers per layer, decided ONCE and then obeyed by the static plates, the
  // per-frame live re-shots and the wire alike - a live plate that padded or scaled
  // differently from the static one it replaces would shift the picture on exactly the
  // frames it covers, which is the worst kind of bug to look at.
  //
  //   pad - how far the layer's own effects reach outside its box, so the blur has
  //          real content at the box edge instead of a hard cut. 0 with no effects.
  //   eff - how much EXTRA resolution the projection asked for, after the budget has
  //          had its say. 1 with no camera, which is every P0 export, and `S * 1` is
  //          exactly `S`.
  // The cameras (section 5.4), derived from the stage's own `camera` layers - the same
  // function the worker calls over the same layers, so the two evaluators can never be
  // told different cameras. `camMoves` is asked ONCE for the whole render because a
  // plate is shot once for the whole render (the P1 obligation): under a moving camera
  // eff and the depth-of-field radius vary per frame, so the compositor owns every
  // projectable layer's filter rather than letting a plate bake one instant of it.
  const cameras = stageCameras(stage.layers);
  const planEnv: SeqPlanEnv = { stageW: nativeW, stageH: nativeH, cameras };
  const camMoves = camerasMove(cameras);

  // ── the TILT GATE (plans/104 section 6.4, P2) ────────────────────────────────────
  //
  // Here, and here specifically: after the stage and its keyframe tracks have been
  // parsed (so the question is asked of the camera set the render will actually use)
  // and BEFORE a single plate is photographed (so a refusal costs nothing and a capture
  // run does not pay for plates it will never draw).
  //
  // A tilted camera projects a screen-parallel layer through a HOMOGRAPHY, and the
  // canvas compositor's transform is affine by definition - there is no approximation
  // to fall back to, only a wrong picture. So the whole render moves to the P2a capture
  // tier: the DOM applier already writes the engine's matrix as a per-element
  // `matrix3d`, so the live artboard IS the composite, and every frame is a photograph
  // of it. Slower by an order of magnitude and correct, which is the trade section 6.4 makes
  // explicitly ("that's the price of correct-first").
  //
  // AND A BOX CAN TILT ON ITS OWN (P2.1), which reaches the compositor the same way: a
  // box-sourced homography arrives in the very same `PlanItem.m3` slot, so the gate has
  // to ask both questions or a box-tilt-only document takes the canvas tier and draws
  // the affine approximation with nothing said. `??` rather than `||` because the
  // answer is the logged TRIGGER, and the camera's is the one to name when both tilt.
  const tilt = camerasTilt(cameras) ?? boxesTilt(stage.layers);
  // P2b (plans/104 section 6.4, plan 98 section 9.1 Phase C): with the opt-in GPU compositor flag on
  // AND WebGL2 present, a tilted export takes the GL quad-compositor path - ONE clean
  // plate texture per layer, resampled coherently through each per-quad homography,
  // which fixes the P2a capture-tier flicker (127 independent full-frame dom-to-image
  // rasters). It reuses the very plate pipeline below (the tilt gate has always sat
  // BEFORE it, so plates are never built under P2a) - hence the render does NOT return
  // here; it falls through, builds plates, and hands the finished SeqJob to
  // `renderGlComposite` after the thread-selection point. Everything else about the
  // export (the plates, the audio mix, the mux, the ingredient gather that already
  // ran above, one container-level C2PA over its results) is identical.
  const useGl = !!tilt && glSequenceRenderEnabled() && supportsGlSequenceRender();
  if (tilt && !useGl) {
    log('info', `sequence: TILT export - the scene authors ${tilt.ch} ${Math.round(tilt.deg * 10) / 10}°${tilt.atMs == null ? ' as its scene pose' : ` at ${Math.round(tilt.atMs)}ms`}, which is a homography the canvas compositor cannot draw. Every frame is captured off the live artboard instead (slower, and pixel-for-pixel what the preview shows).`);
    return await renderTiltCapture(tilt);
  }
  if (useGl) {
    // The video refusal stays reachable on the P2b path too (section 6.4 first cut: video
    // under tilt is an explicit follow-up). Failed up front, before a single plate is
    // photographed, exactly as `renderTiltCapture` refuses it - same coded error, same
    // wording, so a user sees one answer whichever tilt tier is active.
    const videos = stage.layers.filter((L) => L.kind === 'video');
    if (videos.length > 0) {
      throw sequenceError(
        'SEQ_TILT_UNSUPPORTED',
        `tilt export of video needs the GPU compositor's video path, which is a follow-up. This scene tilts (${tilt.ch} ${Math.round(tilt.deg * 10) / 10}°) and holds ${videos.length} video clip${videos.length === 1 ? '' : 's'}. Remove the tilt to export it now, or replace the video clip with a still.`,
      );
    }
  }

  const demands = plateWindowDemands(stage.layers, usedGrid, stage.totalMs, planEnv, camMoves);
  // The blur lanes pool their scratch canvases ACROSS frames (canvas-blur.ts's POOL),
  // and those scratches are plate-sized - so they are part of what this render will
  // actually hold, not an unpriced extra. Peak pool occupancy is what the budget has to
  // see; `blurScratchNeedBytes` derives it from the same per-layer pads and effs.
  const budget = planPlateBudget({
    layers: stage.layers.map((L): PlateLayerNeed => {
      const d = demands.get(L.idx);
      return {
        idx: L.idx,
        kind: L.kind,
        // A size-tweened layer is priced at its WIDEST: its plate is re-shot per frame,
        // so the peak is the one that has to fit.
        w: Math.max(L.rect.w, d?.maxW ?? 0),
        h: Math.max(L.rect.h, d?.maxH ?? 0),
        pad: d?.pad ?? 0,
        maxEff: d?.maxEff ?? 1,
        // The lottie player is not consulted until the loop below, so a lottie layer is
        // priced as if it WILL go live (two plates). Over-counting is the safe direction
        // for a memory budget - and a size-tweened layer goes live for certain.
        needsLiveRaster: L.kind === 'lottie' || (d?.sized ?? false),
      };
    }),
    scale: S,
    worker: supportsWorkerSequenceRender(),
    reserveBytes: blurScratchNeedBytes(
      stage.layers.map((L) => ({
        w: Math.max(L.rect.w, demands.get(L.idx)?.maxW ?? 0),
        h: Math.max(L.rect.h, demands.get(L.idx)?.maxH ?? 0),
        pad: demands.get(L.idx)?.pad ?? 0,
        owned: ownsLayerFx(L, camMoves),
      })),
      S,
    ),
  });
  // The no-silent-caps rule: exactly one line, naming what was clamped and why.
  if (budget.warning) log('warn', budget.warning);
  const padOf = (idx: number): number => budget.padOf.get(idx) ?? 0;
  const plateScaleOf = (idx: number): number => S * (budget.effOf.get(idx) ?? 1);
  // Whether this layer's plate is shot with its inline filter removed - the ONE
  // predicate the executor's `itemFx` asks too, so a plate and the draw that places it
  // can never disagree about who owns the effect.
  const ownedFx = new Map(stage.layers.map((L) => [L.idx, ownsLayerFx(L, camMoves)]));
  const neutralOf = (idx: number): boolean => ownedFx.get(idx) ?? false;
  // …and whether its plate is ALSO shot without the `clip-path` (P1 obligation 5b).
  // Only when the compositor both owns the fx (so the shadow it casts is its own) and
  // can actually reproduce the shape at the destination - `parseClipShape` returning
  // null means nobody would clip it, and an unclipped plate would then leak.
  const clipNeutral = new Map(stage.layers.map((L) => [
    L.idx,
    !!L.clipPath && ownsLayerFx(L, camMoves) && parseClipShape(L.clipPath, L.rect.w, L.rect.h) != null,
  ]));
  const clipNeutralOf = (idx: number): boolean => clipNeutral.get(idx) ?? false;
  // The DRAW size a size-tweened layer's live plate is shot at, per frame.
  const sizedLayers = new Set(stage.layers.filter((L) => demands.get(L.idx)?.sized).map((L) => L.idx));
  // The stage background's own margin (section 5.5). It joins the memory budget the same way
  // every other plate does - as bytes on a layer the budget can see - rather than as an
  // unpriced extra: a big pull-back can ask for a plate several times the artboard.
  const bgPadWanted = transparent ? 0 : bgOverscanPad(nativeW, nativeH, usedGrid, planEnv);
  const bgBudget = bgPadWanted > 0
    ? planPlateBudget({
      layers: [{ idx: -1, kind: 'static', w: nativeW, h: nativeH, pad: bgPadWanted, maxEff: 1 }],
      scale: S,
      worker: supportsWorkerSequenceRender(),
    })
    : null;
  const bgPad = bgBudget ? (bgBudget.padOf.get(-1) ?? 0) : 0;
  if (bgBudget?.warning) log('warn', `sequence: the camera's background overscan was trimmed - ${bgBudget.warning}`);

  const wire: SeqJobLayer[] = [];
  const plates: SeqJob['plates'] = [];
  const clips: SeqJob['clips'] = [];
  /**
   * Layers whose picture must be re-rastered off the LIVE DOM every frame.
   *
   * Two reasons a layer lands here, and they are independent: a Lottie box with a
   * mounted player (`marker` set - the frame has to be scrubbed before the shot), and a
   * layer whose `w`/`h` are tweened (section 5.2 - the element has to be laid out at the size
   * of the moment before the shot, because a stretched plate does not REFLOW).
   *
   * `hide` is the static plate's own hide list, carried so the live shot is the SAME
   * photograph: a video layer's plates are taken with the `<video>` (and any frozen
   * `[data-motion-still]` sibling) hidden, because the decoded frame is composited
   * between them - a live shot that kept them would paint a stale poster under the
   * frame it is about to draw.
   */
  const liveBoxes = new Map<number, { marker: Element | null; box: HTMLElement; hide: Element[] }>();
  // A slide's boxes on the film's clock (plans/184 R1): the poses written onto the live
  // frame pages for this render, and the store their per-frame styles compose through.
  // Both are undone in the outer `finally`, so the editor gets its DOM back whatever way
  // the render ends.
  const slidePoses = new Map<number, SlidePose>();
  const slideStore = createAuthoredStore();
  const slideCtx = { seqMs: stage.totalMs, store: slideStore, stage: () => stageNativeSize(stageEl) };
  /** The boxes of a posed slide that are OFF at `t` - hidden from that shot, since
   *  rasterBox lifts the applier's own off class for its photograph. */
  const slideHiddenAt = (pose: SlidePose, t: number): Element[] =>
    pose.boxes.filter((b) => !isActiveAt(readTiming(b), t, stage.totalMs));
  /** When a posed slide is at rest for its static plate: every enter done. */
  const slideRestMs = (pose: SlidePose, L: SeqLayer): number => {
    let rest = L.startMs;
    for (const b of pose.boxes) {
      const tm = readTiming(b);
      if (tm.start >= PENDING_SLIDE_MS) continue;
      rest = Math.max(rest, tm.start + (tm.enter && tm.enter !== 'none' ? tm.enterMs : 0));
    }
    return Math.min(rest, L.startMs + Math.max(0, L.durMs - 1));
  };
  let bgRaster: HTMLCanvasElement | null = null;
  // The timeline panel's frame thumbnails run through the SAME dom-to-image instance
  // this render is about to drive, and that library's options / url cache / sandbox
  // iframe are module-global - whichever call tears down first clears them out from
  // under the other, corrupting both pictures. Hold them for the whole render.
  const resumeThumbRasters = suspendNodeRasters();

  try {
    // Suspending stops the NEXT thumbnail shot; the one already inside the library
    // cannot be cancelled, only waited out - and its teardown would clear the sandbox
    // iframe and url cache out from under the first rasterBox below.
    await drainNodeRasters();
    // ── static + chrome rasters (once each) ───────────────────────────────
    // dom-to-image needs the live DOM, so this is the half of the render that can
    // never move to a worker. Everything downstream consumes the canvases it
    // produces and nothing else.
    const restoreBlobs = await swapBlobUrls(stageEl);
    try {
      if (!transparent) {
        // Hide every planned layer while photographing the stage background: the
        // `.lolly-box` clips (object-clip Video / Sequence Studio) AND the timed
        // `[data-pdf-page]` frame pages (frames-as-scenes). rasterBox strips `.seq-off`
        // from the stage + all descendants for its shot, so without hiding the frames a
        // frames-as-scenes bg plate would capture EVERY slide un-gated and paint them,
        // stacked, under every output frame - the "stuck on slide 1" bug. Each timed
        // frame is instead photographed as its own per-layer plate below, gated to its
        // window. Harmless in object-clip mode: the frame selector matches nothing there.
        // …and with the camera's OVERSCAN, so a pan/pull-back reveals artboard rather
        // than a hard edge (section 5.5). `bgPad` is 0 on every camera-less export, and at 0
        // `plateShotFrame` produces byte-for-byte the shot it always did.
        bgRaster = await rasterBox(stageEl, S, [
          ...stageEl.querySelectorAll('.lolly-box'),
          ...stageEl.querySelectorAll('[data-pdf-page][data-t-start]'),
        ], bgPad > 0 ? { pad: bgPad } : {});
      }
      // A frames-as-scenes slide poses its boxes the way the podium does (plans/184 R1,
      // `poseSlideBoxes` - the one rule both read): a with-the-slide box enters when the
      // slide arrives and exits where it ends, a timed box at its time, a click box from
      // the start (a film has nobody to click). Written onto the LIVE page for this
      // render and restored after. A slide with something on its clock is re-shot per
      // frame while anything moves (`slideShotAt` below) and served one at-rest shot in
      // between, so its static plate is only the fallback - posed at rest, with the boxes
      // not yet on screen hidden from the shot.
      const staged = stageEl.hasAttribute('data-deck-staged');
      for (const L of stage.layers) {
        if (!L.frameScene || L.durMs <= 0) continue;
        const pose = poseSlideBoxes(L.el, {
          reduced: false, clicks: 'show', pageStartMs: L.startMs,
          authoredPageStartMs: staged ? 0 : L.startMs, pageDurMs: L.durMs,
        });
        if (!pose.posed) { pose.restore(); continue; }
        slidePoses.set(L.idx, pose);
      }
      // Every PLANNED layer's plate is shot the same way: at full opacity, with no
      // filter, and with its own padding and resolution - the things the planner owns
      // rather than the picture. The stage background above takes none of them (it is
      // not a planned layer: no PlanItem carries its alpha or its blur).
      for (const L of stage.layers) {
        const w = win.get(L.idx)!;
        const el = L.el;
        // A posed slide's static plate is its picture at rest (see above).
        const slidePose = slidePoses.get(L.idx) ?? null;
        if (slidePose) applyTimeToElements(slidePose.boxes, slideRestMs(slidePose, L), slideCtx);
        // `neutralFilter` follows the ONE ownership predicate (section 5.5, `ownsLayerFx`): a
        // layer with depth is shot clean and the compositor applies its whole filter;
        // a layer without keeps its filter baked into the plate, which is what every
        // pre-104 `shadow: content` / `blur` document has always exported.
        const plateOpts: RasterOpts = {
          opaque: true,
          neutralFilter: neutralOf(L.idx),
          neutralClipPath: clipNeutralOf(L.idx),
          pad: padOf(L.idx),
        };
        const PS = plateScaleOf(L.idx);
        let under: HTMLCanvasElement | null = null;
        let over: HTMLCanvasElement | null = null;
        let media: HTMLElement | null = null;
        let needsLiveRaster = false;
        /** What this layer's plates were shot WITHOUT - the live re-shot must match. */
        let plateHide: Element[] = [];
        // A CAMERA is a pose over time, not a picture (plans/104 section 5.4): no plate, the
        // same way an audio bed has none. `w.first >= 0` would otherwise photograph its
        // marker div - an empty, `data-export-hide` box - once per export.
        if (w.first >= 0 && L.kind !== 'audio' && L.kind !== 'camera') {
          if (L.kind === 'video') {
            media = (el.matches?.('video') ? el : el.querySelector('video')) as HTMLElement | null;
            // A ZIP bundle re-dispatches each sub-format through renderFormat, whose
            // motion guard keys on the OUTER format ('zip'), so snapshotMotion has
            // already frozen every <video> into a sibling <img>. That still must be
            // hidden too or it bakes into `over` and sits frozen on top of every
            // decoded frame for the clip's whole span.
            const hide = [
              ...(media ? [media] : []),
              ...el.querySelectorAll('[data-motion-still]'),
            ];
            plateHide = hide;
            under = await rasterBox(el, PS, hide, plateOpts);
            over = await rasterBox(el, PS, hide, { ...plateOpts, transparentBg: true });
          } else if (L.kind === 'lottie') {
            const marker = el.matches?.('[data-lottie-src]') ? el : el.querySelector('[data-lottie-src]');
            under = await rasterBox(el, PS, [], plateOpts); // the still fallback if no player mounted
            // A lottie layer only forces the hybrid split when a live player is
            // actually mounted; without one the static plate IS the picture, and
            // the sequence still runs fully worker-side.
            const player = marker ? (lottiePlayerFor(marker) as LottieScrubber | null) : null;
            if (marker && player?.goToAndStop) {
              liveBoxes.set(L.idx, { marker, box: el, hide: [] });
              needsLiveRaster = true;
            }
          } else {
            if (slidePose) plateHide = slideHiddenAt(slidePose, slideRestMs(slidePose, L));
            under = await rasterBox(el, PS, plateHide, plateOpts);
          }
          // A posed slide (plans/184 R1) is re-shot live while its boxes move.
          if (slidePose && !liveBoxes.has(L.idx)) {
            liveBoxes.set(L.idx, { marker: null, box: el, hide: [] });
            needsLiveRaster = true;
          }
          // A size tween re-photographs per frame whatever kind the layer is - the
          // static plate above stays as the fallback for a frame whose shot fails.
          if (sizedLayers.has(L.idx) && !liveBoxes.has(L.idx)) {
            liveBoxes.set(L.idx, { marker: null, box: el, hide: plateHide });
            needsLiveRaster = true;
          }
          // Split text (plans/175 WP-A): the units' mid-animation state is DOM state,
          // so the layer is re-photographed live during its enter/exit windows (the
          // live raster drives applySplitAt before each shot) and served one at-rest
          // shot everywhere else - the memo collapses the steady middle to one key.
          if (splitActive(L) && !liveBoxes.has(L.idx)) {
            liveBoxes.set(L.idx, { marker: null, box: el, hide: plateHide });
            needsLiveRaster = true;
          }
        }
        plates.push({ idx: L.idx, under, over });
        // Re-anchor a timed frame-page scene to the output viewport so a side-by-side
        // slideshow stacks each slide into the frame (ISSUE 1). No-op for a `.lolly-box`
        // (frameScene=false → returned verbatim), so object-clip export is unchanged.
        // The plate above is the frame's OWN picture at scale S; the normalized rect
        // (0,0,nativeW,nativeH) draws it over the full outW×outH at the origin.
        wire.push(toJobLayer(normalizeFrameScene(L, nativeW, nativeH), {
          // The inline style, exactly as the old in-draw read took it.
          objectFit: media?.style?.objectFit ?? '',
          objectPosition: media?.style?.objectPosition ?? '',
          needsLiveRaster,
          // The margin the plates above were actually captured with - the executor
          // subtracts it when it draws them. Sent rather than re-derived so a plate and
          // the draw that places it can never disagree about where its origin is.
          platePad: padOf(L.idx),
          // …and the resolution they were captured at, over S. The filtered draw path
          // sizes its scratch by it, so the pixels the budget bought are the pixels the
          // blur runs on.
          plateEff: budget.effOf.get(L.idx) ?? 1,
        }));
        if (L.kind === 'video' && w.first >= 0) {
          const url = mediaSrc(L);
          if (url) clips.push({ idx: L.idx, src: url });
        }
      }
    } finally {
      restoreBlobs();
    }

    // ── audio (independent of the frame loop, so it is resolved up front) ──
    // Length is the ACTUAL clip length (frameCount/fps), not the authored one, so a
    // capped gif/apng and a full-length mp4 both get a bed that ends where they do.
    // OfflineAudioContext is main-thread only; the worker receives the rendered PCM.
    const mix = streaming ? await mixSequenceAudio(stage.layers, (frameCount / fps), opts, host) : EMPTY_MIX;
    const audioPick = pick && mix.spec ? await pickWebCodecsAudio(pick.container) : null;

    const job: SeqJob = {
      layers: wire, grid: usedGrid, frameCount, fps, totalMs: stage.totalMs,
      outW, outH: targetH, scale: S,
      // The stage the depth projection anchors on (plans/104 section 4.1): its NATIVE size,
      // the same number `S` was derived from, so the principal point stays the stage
      // centre at every export scale.
      stageW: nativeW, stageH: nativeH,
      bg: bgRaster, bgPad, plates, clips,
      maxLiveProviders: MAX_LIVE_PROVIDERS, watchdogMs: WATCHDOG_MS,
      // A plain number, so the worker path caches exactly the layers the in-thread
      // path does (plans/104 P3.1). Omitted unless a test pinned it, which keeps the
      // wire - and `structuredClone(job)` - identical to what it was.
      ...(fxCacheBytesOverride == null ? {} : { fxCacheBytes: fxCacheBytesOverride }),
    };
    // The DRAW size of a size-tweened layer at one output frame. Answered by re-running
    // the SAME planner the executor runs, over the same layers, grid, totalMs and env - 
    // never by a second evaluation of the track - so the plate is shot at exactly the
    // size the draw will place it at. Memoised per frame index because a frame typically
    // asks for at most one or two layers and the executor walks the grid in order.
    let sizeCache: { i: number; byIdx: Map<number, { w: number; h: number }> } | null = null;
    const sizeAt = (idx: number, frameIndex: number): { w: number; h: number } | null => {
      if (!sizedLayers.has(idx)) return null;
      if (!sizeCache || sizeCache.i !== frameIndex) {
        const t = usedGrid[frameIndex];
        const byIdx = new Map<number, { w: number; h: number }>();
        if (t != null) {
          for (const it of sequenceDrawPlan(stage.layers, t, stage.totalMs, planEnv)) {
            if (it.sized) byIdx.set(it.layer.idx, { w: it.w, h: it.h });
          }
        }
        sizeCache = { i: frameIndex, byIdx };
      }
      return sizeCache.byIdx.get(idx) ?? null;
    };
    // Which layers animate text units, and whether a given output frame falls inside
    // one of their windows - the live raster keys its memo on the answer, so the
    // steady middle of a split clip is one shot, not nine hundred.
    const splitLayerByIdx = new Map(stage.layers.filter((L) => splitActive(L)).map((L) => [L.idx, L]));
    const splitShotAt = (idx: number, frameIndex: number): { t: number; animating: boolean } | null => {
      const L = splitLayerByIdx.get(idx);
      if (!L) return null;
      const t = usedGrid[frameIndex] ?? 0;
      return { t, animating: splitAnimatingAt(L, t, stage.totalMs) };
    };
    // A posed slide at an output frame (plans/184 R1): the boxes are driven to that
    // frame's time before the shot, the ones not yet on screen are named so the shot can
    // hide them, and the memo key says whether anything is mid-transition - the steady
    // middle of a slide collapses onto one shot per set of boxes on screen.
    const slideShotAt = (idx: number, frameIndex: number): { t: number; animating: boolean; restKey: number; hide: Element[] } | null => {
      const pose = slidePoses.get(idx);
      if (!pose) return null;
      const t = usedGrid[frameIndex] ?? 0;
      applyTimeToElements(pose.boxes, t, slideCtx);
      let animating = false;
      let restKey = 7;
      const hide: Element[] = [];
      for (const b of pose.boxes) {
        const tm = readTiming(b);
        const on = isActiveAt(tm, t, stage.totalMs);
        restKey = Math.imul(restKey, 31) + (on ? 1 : 0);
        if (!on) { hide.push(b); continue; }
        if (tm.hold || tm.kf.length > 0 || tm.split || transitionAt(tm, t, stage.totalMs)) animating = true;
      }
      return { t, animating, restKey: Math.abs(restKey) + 1, hide };
    };
    const liveRaster = makeLiveRaster(
      liveBoxes, plateScaleOf, padOf, neutralOf, clipNeutralOf, sizeAt, splitShotAt, stage.totalMs, slideShotAt,
    );
    const hybrid = liveBoxes.size > 0;

    // ── P2b: the GPU compositor draws tilt (plans/104 section 6.4) ────────────────
    // Reached only under a tilted camera with the opt-in flag on and WebGL2 present
    // (`useGl`, decided at the gate above). The plate pipeline just ran, so this reuses
    // the SeqJob verbatim - plates, clips, the live raster, the audio mix - and only the
    // COMPOSITOR differs: GL quads through the per-quad homography instead of `drawItem`'s
    // affine canvas. Kept ahead of the worker/in-thread selection because tilt cannot run
    // on either of those (both call `drawItem`, which has no homography to draw).
    if (useGl) return await renderGlComposite(job, mix, audioPick, liveRaster);

    // ── which thread executes ─────────────────────────────────────────────
    // HDR forces the in-thread core: the worker offload transfers ImageBitmap frames and
    // builds its own mux WITHOUT threading a colorSpace, so an HDR sequence takes the
    // in-thread path below (whose frames are RGBA buffers), exactly as the buffered
    // renderVideo path skips its worker for HDR.
    if (pick && !hdrActive && supportsWorkerSequenceRender()) {
      log('info', `sequence: worker offload - ${hybrid
        ? `HYBRID (${liveBoxes.size} lottie layer(s) rastered on the main thread, one request in flight)`
        : 'fully worker-side (decode, composite, encode and mux all off the main thread)'}`);
      try {
        const blob = await renderSequenceInWorker(job, pick, bitrate, audioPick,
          mix.spec && audioPick ? wholeMixPcm(mix.spec, mix.totalSamples, opts.normalize) : null, {
          log,
          // Every progress message is a frame boundary, which is where a cancel can be
          // acted on: the abort posts to the worker so it unwinds its own loop, then
          // rejects this run with SEQ_ABORTED (mapped to the AbortError below).
          progress: (d, t) => {
            if (opts.signal?.aborted) abortSequenceWorkerRenders('the export was cancelled');
            opts.onProgress?.(d, t);
          },
          live: liveRaster,
        });
        return await withVideoMeta(blob, blob.type, opts.meta, host);
      } catch (err) {
        // A CODED failure is the render's real verdict (a truncated source, a
        // codec that isn't there, a cancel) - re-running it in-thread would only
        // reach the same answer more slowly. Anything else is the offload itself
        // failing, and the in-thread path is the honest fallback: the plates are
        // still canvases, so the retry costs no re-rasterisation.
        if (err instanceof SequenceError) throw err;
        log('warn', `sequence: worker offload unavailable (${(err as { message?: string })?.message ?? err}) - rendering in-thread.`);
      }
    }

    return await renderInThread(job, mix, audioPick, liveRaster);
  } catch (err) {
    const coded = toCodedError(err);
    log('error', `sequence export failed (${coded.code}): ${coded.message}`);
    // ONE cancellation shape for callers: whichever path was executing - the
    // in-thread executor's per-frame poll, the worker rejection, a loop below -
    // a cancelled run leaves as the signal's AbortError. Gated on the signal
    // having actually fired, because the frame watchdog's stall is SEQ_ABORTED
    // too and a stall is a failure, not a cancel.
    if (coded.code === 'SEQ_ABORTED') opts.signal?.throwIfAborted();
    throw err;
  } finally {
    resumeThumbRasters();
    // The live split shots wrote unit-span styles outside the authored store's
    // sight (plans/175); hand the text back at rest whatever way the render ended.
    for (const entry of liveBoxes.values()) clearSplitUnits(entry.box);
    // The slide poses (plans/184 R1): composed styles first, then the attributes, so
    // the editor's pages read exactly as they did before the render.
    slideStore.restoreAll();
    for (const pose of slidePoses.values()) {
      for (const b of pose.boxes) b.classList.remove(OFF_CLASS);
      pose.restore();
    }
    slidePoses.clear();
  }

  // ── inner helpers (closures over the render's state) ──────────────────────

  /**
   * The historical path: one compositor (`runSequenceJob`), driven here, with the
   * frame sink chosen by output format. Unchanged in behaviour - the loop, the
   * watchdog labels, the provider lifecycle and the reconciliation all now live
   * in the executor the worker runs too, which is what makes the two identical.
   */
  async function renderInThread(
    job: SeqJob, mix: MixResult, audioPick: AudioPick | null, liveRaster: SeqJobIO['lottieAt'],
  ): Promise<Blob> {
    const canvas: AnyCanvas = streaming && typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(outW, targetH)
      : Object.assign(document.createElement('canvas'), { width: outW, height: targetH });
    const ctx = (canvas as unknown as { getContext(id: string, o?: unknown): unknown }).getContext('2d', { alpha: true }) as AnyCtx | null;
    if (!ctx) throw sequenceError('SEQ_DECODE_FAILED', 'no 2D context for the sequence canvas');

    let mux: StreamingMux | null = null;
    const bitmaps: ImageBitmap[] = [];             // MediaRecorder fallback only
    const apngFrames: Uint8Array[] = [];
    const webpFrames: Uint8Array[] = [];
    const gifPixels: Uint8ClampedArray[] = [];
    try {
      if (pick) {
        mux = await createStreamingMux(pick, {
          width: outW, height: targetH, fps, bitrate,
          bitrateMode: opts.bitrateMode, hardwareAcceleration: opts.hardwareAcceleration,
          audio: audioPick ? { ...audioPick, channels: [] } : null,
          // plans/156 WP-A part 3: a long export streams its container to OPFS instead
          // of accumulating it in memory. Gated on frameCount, the SAME number the worker
          // path gates on (job.frameCount), so the two paths stay byte-identical.
          target: streamMuxTargetFor(frameCount),
          // Plan 154 WP-2: an HDR pick tags the container colr/nclx and takes RGBA buffer
          // frames. Absent ⇒ today's image-source path, byte-for-byte (the goldens).
          ...(hdrActive ? { colorSpace: HDR_VF_COLORSPACE, frameFormat: hdrFrameFormat } : {}),
        });
        log('info', `sequence: WebCodecs ${pick.container}/${pick.codec}${hdrActive ? ' HDR' : ''}${audioPick ? `+${audioPick.codec}` : ''} ${outW}×${targetH}@${fps} ${frameCount}f (in-thread)`);
      }
      // The audio mix is ready before the loop; feed its windows INTERLEAVED with
      // the frames (A2) so the mux's bounded merge advances as the render proceeds.
      const feeder = mux && mix.spec && audioPick ? windowedAudioFeeder(mux, mix.spec, mix.totalSamples, MIX_CHANNELS, opts.normalize) : null;

      await runSequenceJob(job, canvas, ctx, {
        log,
        lottieAt: liveRaster,
        progress: (done, total) => opts.onProgress?.(done, total),
        // The executor already polls this once per frame and tears the render down
        // with SEQ_ABORTED - the same seam the worker's abort message trips.
        aborted: () => opts.signal?.aborted === true,
        frame: async (c, cx, _i, tsUs) => {
          if (feeder) await feeder.upTo(tsUs);        // audio windows due by this frame
          if (mux) await mux.addFrame(hdrActive ? hdrFrameData(cx, outW, targetH, opts, hdrDeep, hdrPerf) : c as CanvasImageSource, tsUs);
          else if (streaming) bitmaps.push(await createImageBitmap(c as ImageBitmapSource));
          else if (format === 'apng') apngFrames.push(new Uint8Array(await (await canvasBlob(c, 'image/png')).arrayBuffer()));
          else if (format === 'webp-anim') webpFrames.push(await webpFrame(c, opts.quality ?? 0.9));
          else gifPixels.push((cx as CanvasRenderingContext2D).getImageData(0, 0, outW, targetH).data);
        },
      });

      if (mux) {
        if (feeder) await feeder.flush();             // any audio past the last frame
        const blob = await mux.finalize();
        mux = null;
        return await withVideoMeta(blob, blob.type, opts.meta, host);
      }
      if (streaming) return await recorderReplay(bitmaps, canvas as HTMLCanvasElement, ctx as CanvasRenderingContext2D, format, fps, opts, host);
      if (format === 'apng') return await apngBlob(apngFrames, fps, opts);
      if (format === 'webp-anim') return await webpAnimBlob(webpFrames, outW, targetH, fps, opts);
      return await gifBlob(gifPixels, outW, targetH, opts);
    } finally {
      if (mux) { try { await mux.abort(); } catch { /* already down */ } }
    }
  }

  /**
   * **P2b - the GPU COMPOSITOR** (plans/104 section 6.4, plan 98 section 9.1 Phase C).
   *
   * The sibling of `renderInThread`: same SeqJob, same plates, same audio mix, same mux
   * sink, same one-container-C2PA - but the frame is COMPOSED on the GPU instead of by
   * `drawItem`, which is the only thing that lets a TILTED camera export cleanly. Each
   * layer's clean plate becomes one texture; every frame draws each PlanItem as a quad
   * through its per-quad homography (`item.m3`), resampled coherently in one GL pass.
   * That is the flicker fix: P2a takes 127 independent full-frame dom-to-image rasters
   * (each its own serialise → SVG → raster with its own rounding); this takes one
   * texture per layer and resamples them together.
   *
   * It draws CLEAN plates and reads them back CLEAN - no per-frame, per-quad imprint;
   * provenance stays at the container exactly as P2a's does (this file makes zero
   * imprint calls, and this path keeps it that way). A tilted-video export is refused up
   * front at the gate, so no `<video>` reaches here in this cut.
   */
  async function renderGlComposite(
    job: SeqJob, mix: MixResult, audioPick: AudioPick | null, liveRaster: SeqJobIO['lottieAt'],
  ): Promise<Blob> {
    // Re-bound because a closure does not inherit the outer narrowing of `stage`, which
    // the guard at the top of the render has already made non-null (same as P2a).
    const stageLayers: SeqLayer[] = stage?.layers ?? [];
    const totalMs = stage?.totalMs ?? 0;
    const comp: GlQuadCompositor | null = createGlQuadCompositor(outW, targetH);
    if (!comp) {
      // WebGL2 vanished between the probe and here (a lost context, a refused
      // allocation). The correct-but-slow capture tier is the honest fallback; the video
      // refusal already ran, so `renderTiltCapture` cannot meet a `<video>` it can't shoot.
      log('warn', 'sequence: the GPU compositor could not be created - falling back to the P2a capture tier.');
      return await renderTiltCapture(tilt as { ch: 'rx' | 'ry'; deg: number; atMs: number | null });
    }

    // The 2D readback destination - same kind and shape as `renderInThread`'s canvas, so
    // every frame sink (mp4/webm/gif/apng) consumes an ordinary 2D canvas and keeps
    // working unchanged. The GL frame is blitted onto it once per frame.
    const destCanvas: AnyCanvas = streaming && typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(outW, targetH)
      : Object.assign(document.createElement('canvas'), { width: outW, height: targetH });
    const destCtx = (destCanvas as unknown as { getContext(id: string, o?: unknown): unknown }).getContext('2d', { alpha: true }) as AnyCtx | null;
    if (!destCtx) throw sequenceError('SEQ_DECODE_FAILED', 'no 2D context for the GL readback canvas');

    const plateOf = new Map(job.plates.map((p) => [p.idx, p]));
    const wireOf = new Map(job.layers.map((w) => [w.idx, w]));
    /** A texture slot the stage background owns - never a real layer idx (those are ≥ 0). */
    const BG_TEX_IDX = -1;

    let mux: StreamingMux | null = null;
    const bitmaps: ImageBitmap[] = [];
    const apngFrames: Uint8Array[] = [];
    const webpFrames: Uint8Array[] = [];
    const gifPixels: Uint8ClampedArray[] = [];
    try {
      if (pick) {
        mux = await createStreamingMux(pick, {
          width: outW, height: targetH, fps, bitrate,
          bitrateMode: opts.bitrateMode, hardwareAcceleration: opts.hardwareAcceleration,
          audio: audioPick ? { ...audioPick, channels: [] } : null,
          // plans/156 WP-A part 3: long exports stream to OPFS (same frameCount gate).
          target: streamMuxTargetFor(frameCount),
          // Plan 154 WP-2: HDR colr/nclx tag + RGBA buffer frames (SDR ⇒ untouched).
          ...(hdrActive ? { colorSpace: HDR_VF_COLORSPACE, frameFormat: hdrFrameFormat } : {}),
        });
        log('info', `sequence: TILT export via the GPU compositor (plans/104 P2b) - WebCodecs ${pick.container}/${pick.codec}${hdrActive ? ' HDR' : ''}${audioPick ? `+${audioPick.codec}` : ''} ${outW}×${targetH}@${fps} ${job.frameCount}f, one clean plate texture per layer.`);
      } else {
        log('info', `sequence: TILT export via the GPU compositor (plans/104 P2b) - ${job.frameCount} frames of ${outW}×${targetH}, one clean plate texture per layer resampled on the GPU.`);
      }
      // Audio windows fed INTERLEAVED with the frames (A2), same as the in-thread path.
      const feeder = mux && mix.spec && audioPick ? windowedAudioFeeder(mux, mix.spec, mix.totalSamples, MIX_CHANNELS, opts.normalize) : null;

      for (let i = 0; i < job.frameCount; i++) {
        // Cancel at the frame boundary; the finally aborts the mux and disposes the
        // compositor exactly as it does for a failed frame.
        opts.signal?.throwIfAborted();
        const t = usedGrid[i] as number;
        comp.beginFrame();

        // THE BACKGROUND is an implicit z = 0 layer (section 5.5) and is projected like one - 
        // through the SAME `projectLayer`, so a tilt tilts the wallpaper too (the DOM
        // does exactly this in `sequence-dom.ts`). `bgPad` is the overscan the plate was
        // captured with so the reveal has artboard in it.
        if (job.bg) {
          const view = planCameraView(planEnv, t);
          const proj = projectLayer(view, { bx: nativeW / 2, by: nativeH / 2, z: 0 });
          const bgTex = comp.uploadPlate(BG_TEX_IDX, job.bg);
          if (bgTex) {
            comp.drawQuad({
              texture: bgTex,
              rect: { x: 0, y: 0, w: nativeW, h: nativeH },
              S,
              item: { dx: proj.dx, dy: proj.dy, scale: proj.scale, rot: 0, alpha: clamp01(proj.alphaGuard), blend: '', m3: proj.m },
              platePad: Number.isFinite(job.bgPad) && (job.bgPad as number) > 0 ? (job.bgPad as number) : 0,
              plateEff: 1,
            });
          }
        }

        // The plan is ALREADY depth-sorted (sequence-plan.ts's `out.sort` by resolvedZ)
        // - DO NOT re-sort. Drawing it in order is the painter's order a perspective
        // render needs, and it holds under tilt (κ > 0 over the control range, section 4.2).
        const plan = sequenceDrawPlan(stageLayers, t, totalMs, planEnv);
        for (const item of plan) {
          const L = item.layer;
          if (L.kind === 'audio' || L.kind === 'camera') continue;   // no picture (section 5.4)
          if (item.alpha <= 0) continue;
          const wire = wireOf.get(L.idx);
          // The RESOLVED box (section 5.2) - the authored rect unless the track keyed `w`/`h`.
          const bw = item.sized ? item.w : (Number.isFinite(item.w) && item.w > 0 ? item.w : L.rect.w);
          const bh = item.sized ? item.h : (Number.isFinite(item.h) && item.h > 0 ? item.h : L.rect.h);
          if (bw <= 0 || bh <= 0) continue;
          const platePad = Number.isFinite(wire?.platePad) ? (wire?.platePad as number) : 0;
          const plateEff = Number.isFinite(wire?.plateEff) && (wire?.plateEff as number) > 0 ? (wire?.plateEff as number) : 1;

          // The picture: the static plate, or a live re-raster for a Lottie/size-tween
          // layer (video is refused, so `over` never applies here).
          let src: CanvasImageSource | null = plateOf.get(L.idx)?.under ?? null;
          let perFrame = false;
          if ((wire?.needsLiveRaster || item.sized) && liveRaster) {
            const live = await liveRaster(L.idx, i, item.sourceSec ?? 0, 'under');
            if (live) { src = live; perFrame = true; }
          }
          if (!src) continue;

          // DEPTH-OF-FIELD / owned filter (section 5.5): when the compositor owns this layer's
          // blur it bakes a variant via the SAME S1 mip lane the canvas path uses
          // (`renderFx`), at the plate's own resolution (`S·plateEff`) so the scaling
          // law holds - the quad then minifies it to `S`, and `item.scale` (carrying
          // eff) magnifies it back, exactly as `drawItem` does. `renderFx` hands back a
          // POOLED scratch: upload it, then release it the same tick.
          let tex: WebGLTexture | null = null;
          if (ownsLayerFx(L, camMoves)) {
            const fx = itemFx(item, S * plateEff, camMoves);
            if (fx) {
              const dof = renderFx(src as BlurCanvas, fx, laneFor(destCtx as BlurCtx));
              if (dof) { tex = comp.setDofVariant(L.idx, dof.canvas); releaseStage(dof); }
            }
          }
          if (!tex) tex = perFrame ? comp.setDofVariant(L.idx, src) : comp.uploadPlate(L.idx, src);
          if (!tex) continue;

          comp.drawQuad({
            texture: tex,
            rect: { x: L.rect.x, y: L.rect.y, w: bw, h: bh },
            S,
            item: {
              dx: item.dx, dy: item.dy, scale: item.scale, rot: item.rot,
              alpha: item.alpha, blend: L.blend, m3: item.m3,
            },
            platePad,
            plateEff,
          });
        }

        // Blit the finished GL frame onto the 2D canvas and hand it to the SAME sink the
        // in-thread path uses. `tsUs = round(t·1000)`, matching P2a exactly.
        comp.readInto(destCtx as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D);
        const tsUs = Math.round(t * 1000);
        if (feeder) await feeder.upTo(tsUs);          // audio windows due by this frame
        if (mux) await mux.addFrame(hdrActive ? hdrFrameData(destCtx, outW, targetH, opts, hdrDeep, hdrPerf) : destCanvas as CanvasImageSource, tsUs);
        else if (streaming) bitmaps.push(await createImageBitmap(destCanvas as ImageBitmapSource));
        else if (format === 'apng') apngFrames.push(new Uint8Array(await (await canvasBlob(destCanvas, 'image/png')).arrayBuffer()));
        else if (format === 'webp-anim') webpFrames.push(await webpFrame(destCanvas, opts.quality ?? 0.9));
        else gifPixels.push((destCtx as CanvasRenderingContext2D).getImageData(0, 0, outW, targetH).data);
        opts.onProgress?.(i + 1, job.frameCount);
      }

      if (mux) {
        if (feeder) await feeder.flush();             // any audio past the last frame
        const blob = await mux.finalize();
        mux = null;
        return await withVideoMeta(blob, blob.type, opts.meta, host);
      }
      if (streaming) return await recorderReplay(bitmaps, destCanvas as HTMLCanvasElement, destCtx as CanvasRenderingContext2D, format, fps, opts, host);
      if (format === 'apng') return await apngBlob(apngFrames, fps, opts);
      if (format === 'webp-anim') return await webpAnimBlob(webpFrames, outW, targetH, fps, opts);
      return await gifBlob(gifPixels, outW, targetH, opts);
    } finally {
      if (mux) { try { await mux.abort(); } catch { /* already down */ } }
      // The blur lanes pooled plate-sized scratches for the DOF bakes - a finished
      // render has no next frame to hold them warm for. No-op if nothing blurred.
      releaseBlurScratches();
      comp.dispose();
    }
  }

  /**
   * **P2a - the CAPTURE TIER** (plans/104 section 6.4, verbatim: "its own loop
   * `createSequenceTime(root).apply(grid[i])` per frame → dom-to-image capture → the
   * existing streaming mux").
   *
   * The other renderer in this file plans a frame and DRAWS it; this one poses the
   * live artboard and PHOTOGRAPHS it. Everything downstream of the picture - the
   * encoder pick, the streaming muxer, the gif/apng sinks, the audio mix, the
   * provenance tags - is the same machinery, which is the point: the tilt tier changes
   * where pixels come from and nothing else about what an export is.
   *
   * Why it has to be a photograph. A tilted camera's projection is a homography, and
   * `CanvasRenderingContext2D.setTransform` takes six numbers - an affine map. There
   * is no approximation of a perspective divide in that vocabulary, only a wrong
   * picture. The browser, meanwhile, has done this since CSS transforms shipped: the
   * DOM applier writes the engine's own matrix as a per-element `matrix3d` (see
   * `composeTransform`), so by the time this loop takes its shot the artboard already
   * IS the composite, tilt and all. Capturing it is the shortest correct path, and it
   * makes "the video reflects the preview" true by construction rather than by parity
   * testing.
   *
   * NOT `createFrameSource`. That drives animation clocks, not the sequence session
   * (section 6.4 says so explicitly): its `frame(t)` knows nothing about `.seq-off`, the
   * per-frame `filter`/`z-index` surface or the camera. This loop drives the same
   * `createSequenceTime` session the contact sheet uses, which is the one apply site
   * every still and every preview already goes through.
   *
   * VIDEO REFUSES, visibly (section 6.4). dom-to-image serialises the DOM into an SVG
   * `<foreignObject>`, and a `<video>` element does not survive that - the freeze would
   * bake one frame of it under the whole move, silently. Hybrid compositing (draw the
   * decoded frames, then the captured chrome over them) is P2b's job with the GPU
   * compositor; until then this says no with a reason.
   *
   * The static-chrome fast path self-declines here for a reason worth stating: the
   * session writes inline styles on every frame, which raises MutationObserver records,
   * so every frame pays a full dom-to-image serialisation. That is the price section 6.4 named
   * in advance, and it is why the log below quotes an estimate rather than pretending
   * this is free.
   */
  async function renderTiltCapture(
    trigger: { ch: 'rx' | 'ry'; deg: number; atMs: number | null },
  ): Promise<Blob> {
    // Re-bound because a closure does not inherit the outer narrowing of `stage`, which
    // the guard above the gate has already made non-null.
    const layers: SeqLayer[] = stage?.layers ?? [];
    const videos = layers.filter((L) => L.kind === 'video');
    if (videos.length > 0) {
      throw sequenceError(
        'SEQ_TILT_UNSUPPORTED',
        `tilt export of video needs the GPU compositor. This scene tilts (${trigger.ch} ${Math.round(trigger.deg * 10) / 10}°) and holds ${videos.length} video clip${videos.length === 1 ? '' : 's'}, and a tilted frame is captured off the live page - which cannot photograph a playing video. Remove the tilt to export it now, or replace the video clip with a still.`,
      );
    }
    const resumeThumbs = suspendNodeRasters();
    try {
      await drainNodeRasters();
      const lib = await getDomToImage();
      const restoreBlobs = await swapBlobUrls(stageEl);
      // ONE session for the whole film, exactly as the contact sheet keeps one across
      // all N cuts: a per-frame session would capture frame 0's composed pose as
      // "authored" and compound the offsets from frame 1 onward. It composes normally
      // because `renderSequence`'s `withAuthoredDom` scope was opened BEFORE it existed
      // (section 6 point 0) - the other writers are stood down, this one is not in the snapshot.
      const session = createSequenceTime(stageEl);
      // The stage's own background rides along inside the photograph (there is no
      // separate bg plate here - the whole artboard is one shot), so a transparent
      // export has to take it off the element for the duration.
      const bgPrev = stageEl.style.background;
      if (transparent) stageEl.style.background = 'transparent';
      const canvas: AnyCanvas = streaming && typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(outW, targetH)
        : Object.assign(document.createElement('canvas'), { width: outW, height: targetH });
      const ctx = (canvas as unknown as { getContext(id: string, o?: unknown): unknown }).getContext('2d', { alpha: true }) as AnyCtx | null;
      if (!ctx) throw sequenceError('SEQ_DECODE_FAILED', 'no 2D context for the tilt capture canvas');
      let mux: StreamingMux | null = null;
      const bitmaps: ImageBitmap[] = [];
      const apngFrames: Uint8Array[] = [];
      const webpFrames: Uint8Array[] = [];
      const gifPixels: Uint8ClampedArray[] = [];
      try {
        const mix = streaming
          ? await mixSequenceAudio(layers, frameCount / fps, opts, host)
          : EMPTY_MIX;
        const audioPick = pick && mix.spec ? await pickWebCodecsAudio(pick.container) : null;
        if (pick) {
          mux = await createStreamingMux(pick, {
            width: outW, height: targetH, fps, bitrate,
            bitrateMode: opts.bitrateMode, hardwareAcceleration: opts.hardwareAcceleration,
            audio: audioPick ? { ...audioPick, channels: [] } : null,
            // plans/156 WP-A part 3: long exports stream to OPFS (same frameCount gate).
            target: streamMuxTargetFor(frameCount),
            // Plan 154 WP-2: HDR colr/nclx tag + RGBA buffer frames (SDR ⇒ untouched).
            ...(hdrActive ? { colorSpace: HDR_VF_COLORSPACE, frameFormat: hdrFrameFormat } : {}),
          });
        }
        log('info', `sequence: tilt capture${hdrActive ? ' HDR' : ''} - ${frameCount} frames of ${outW}×${targetH}, one dom-to-image shot each.`);
        // Audio windows fed INTERLEAVED with the frames (A2), same as the other tiers.
        const feeder = mux && mix.spec && audioPick ? windowedAudioFeeder(mux, mix.spec, mix.totalSamples, MIX_CHANNELS, opts.normalize) : null;
        for (let i = 0; i < frameCount; i++) {
          // Cancel at the frame boundary; the finally restores the artboard (the pose,
          // the background, the blob URLs) the same way a failed shot does.
          opts.signal?.throwIfAborted();
          const t = usedGrid[i] as number;
          session.apply(t);
          let shot: HTMLCanvasElement | null = null;
          try {
            shot = await lib.toCanvas(stageEl, {
              width: outW,
              height: targetH,
              style: {
                transform: `scale(${S})`, transformOrigin: 'top left',
                width: `${nativeW}px`, height: `${nativeH}px`, left: '0', top: '0', margin: '0',
              },
            }) as HTMLCanvasElement;
          } catch (err) {
            throw sequenceError('SEQ_DECODE_FAILED', `tilt capture failed at frame ${i}: ${toCodedError(err).message}`);
          }
          // CLEARED, not painted over: a transparent export has to stay transparent
          // where the artboard is, and an opaque one already carries its own background
          // inside the shot.
          ctx.clearRect(0, 0, outW, targetH);
          if (shot) ctx.drawImage(shot as unknown as CanvasImageSource, 0, 0);
          const tsUs = Math.round(t * 1000);
          if (feeder) await feeder.upTo(tsUs);        // audio windows due by this frame
          if (mux) await mux.addFrame(hdrActive ? hdrFrameData(ctx, outW, targetH, opts, hdrDeep, hdrPerf) : canvas as CanvasImageSource, tsUs);
          else if (streaming) bitmaps.push(await createImageBitmap(canvas as ImageBitmapSource));
          else if (format === 'apng') apngFrames.push(new Uint8Array(await (await canvasBlob(canvas, 'image/png')).arrayBuffer()));
          else if (format === 'webp-anim') webpFrames.push(await webpFrame(canvas, opts.quality ?? 0.9));
          else gifPixels.push((ctx as CanvasRenderingContext2D).getImageData(0, 0, outW, targetH).data);
          opts.onProgress?.(i + 1, frameCount);
        }
        if (mux) {
          if (feeder) await feeder.flush();           // any audio past the last frame
          const blob = await mux.finalize();
          mux = null;
          return await withVideoMeta(blob, blob.type, opts.meta, host);
        }
        if (streaming) return await recorderReplay(bitmaps, canvas as HTMLCanvasElement, ctx as CanvasRenderingContext2D, format, fps, opts, host);
        if (format === 'apng') return await apngBlob(apngFrames, fps, opts);
        if (format === 'webp-anim') return await webpAnimBlob(webpFrames, outW, targetH, fps, opts);
        return await gifBlob(gifPixels, outW, targetH, opts);
      } finally {
        if (mux) { try { await mux.abort(); } catch { /* already down */ } }
        // Unwound in the reverse order it was built, on every path including a throw
        // from the middle of frame 300: the artboard must not be left posed on the last
        // captured frame with `.seq-off` still hiding two thirds of the composition.
        if (transparent) { if (bgPrev) stageEl.style.background = bgPrev; else stageEl.style.removeProperty('background'); }
        session.restore();
        restoreBlobs();
      }
    } finally {
      resumeThumbs();
    }
  }
}

// ── the live (lottie) raster, the one thing the worker cannot do ────────────

/** The slice of a lottie-web player the exporter scrubs. */
interface LottieScrubber { goToAndStop?(v: number, isFrame?: boolean): void; frameRate?: number }

/**
 * Build the per-frame live-raster function, or `undefined` when no layer needs one.
 *
 * Memoised on the animation's OWN frame number, so a 30 fps export of a 12 fps
 * Lottie rasterises 12 times a second, not 30. A single-entry memo per layer is
 * enough (the grid is monotonic, so repeats are always consecutive) and keeps
 * the cache O(1) instead of growing with the clip. That memo is also what makes
 * the worker's per-frame request cheap: most frames are answered from it without
 * touching lottie-web or dom-to-image at all.
 */
function makeLiveRaster(
  boxes: Map<number, { marker: Element | null; box: HTMLElement; hide: Element[] }>,
  scaleOf: (idx: number) => number,
  padOf: (idx: number) => number,
  neutralOf: (idx: number) => boolean,
  clipNeutralOf: (idx: number) => boolean,
  /** The layer's DRAW size at that output frame, or null when it keyframes no size. */
  sizeAt: (idx: number, frameIndex: number) => { w: number; h: number } | null,
  /** Split-text state at that frame (plans/175), or null when the layer splits nothing. */
  splitAt?: (idx: number, frameIndex: number) => { t: number; animating: boolean } | null,
  /** The sequence's total ms - applySplitAt's open-ended-box authority. */
  seqMs = 0,
  /** A posed slide at that frame (plans/184 R1): drives its boxes and names the hidden ones. */
  slideAt?: (idx: number, frameIndex: number) => { t: number; animating: boolean; restKey: number; hide: Element[] } | null,
): SeqJobIO['lottieAt'] {
  if (!boxes.size) return undefined;
  // Keyed by layer AND slot: a video layer's two plates are two different pictures of
  // the same box (opaque with the media hidden, then transparent), so one memo slot per
  // layer would answer the `over` request with the `under` shot.
  const memo = new Map<string, { key: number; shot: HTMLCanvasElement }>();
  return async (layerIdx, frameIndex, sourceSec, slot = 'under') => {
    const entry = boxes.get(layerIdx);
    if (!entry) return null;
    const memoKey = `${layerIdx}:${slot}`;
    const size = sizeAt(layerIdx, frameIndex);
    let key: number;
    let slideHide: Element[] = [];
    if (entry.marker) {
      const player = lottiePlayerFor(entry.marker) as LottieScrubber | null;
      if (!player?.goToAndStop) return null;
      const rate = Number.isFinite(player.frameRate) && (player.frameRate as number) > 0 ? (player.frameRate as number) : 30;
      key = Math.round(sourceSec * rate);
      // A size tween moves the picture on EVERY frame even when the animation itself
      // does not, so the memo key has to carry the size too or a stretching Lottie
      // would be answered from a plate shot at the previous width.
      if (size) key = key * 4093 + Math.round(size.w * 100) + Math.round(size.h * 100) * 65537;
      const prev = memo.get(memoKey);
      if (prev && prev.key === key) return prev.shot;
      try { player.goToAndStop((Math.round(sourceSec * rate) / rate) * 1000, false); } catch { return prev?.shot ?? null; }
    } else {
      // Size-only: the frame index IS the key, quantised through the size so a track
      // that holds a value for a second is photographed once rather than thirty times.
      // A split-text layer (plans/175) joins the same memo: inside an animation window
      // every frame is its own key; at rest every frame collapses onto one.
      const split = splitAt?.(layerIdx, frameIndex) ?? null;
      const slide = slideAt?.(layerIdx, frameIndex) ?? null;
      if (!size && !split && !slide) return null;
      key = size ? Math.round(size.w * 100) + Math.round(size.h * 100) * 65537 : 0;
      if (split) key = Math.imul(key, 31) + (split.animating ? Math.round(split.t) + 2 : 1);
      // A slide mid-transition is its own frame; at rest it is one shot per set of boxes
      // on screen (a timed box arriving changes the picture without animating anything).
      if (slide) key = Math.imul(key, 37) + (slide.animating ? Math.round(slide.t) * 2 + 1 : slide.restKey * 2);
      slideHide = slide?.hide ?? [];
      const prev = memo.get(memoKey);
      if (prev && prev.key === key) return prev.shot;
      // Drive the unit spans to this frame's state BEFORE the shot - the box's own
      // whole-box transition is suppressed by the planner, so this write is the whole
      // difference between frames inside the window.
      if (split) applySplitAt(entry.box, split.t, seqMs);
    }
    // The SAME shot the static plate for THIS SLOT takes - same hide list, same
    // filter/clip neutralisation, identically padded, at the identical scale, and
    // transparent for `over` exactly as the static pair is. A live plate is a drop-in
    // replacement for the static one on the frames it covers, so any difference in how
    // it is framed is a jump in the picture.
    const hide = slideHide.length ? [...entry.hide, ...slideHide] : entry.hide;
    const shot = await rasterBox(entry.box, scaleOf(layerIdx), hide, {
      opaque: true,
      neutralFilter: neutralOf(layerIdx),
      neutralClipPath: clipNeutralOf(layerIdx),
      pad: padOf(layerIdx),
      ...(slot === 'over' ? { transparentBg: true } : {}),
      ...(size ? { size } : {}),
    });
    const prev = memo.get(memoKey);
    if (shot) { memo.set(memoKey, { key, shot }); return shot; }
    return prev?.shot ?? null;
  };
}

// ── the Worker client (modelled on bridge/video-encode.ts) ──────────────────
//
// Same conventions as the shipped video-encode worker client: ONE lazily spawned
// module worker, respawned on error, runs keyed by id, an opt-in localStorage
// gate and an up-front capability probe. The differences are inherent to this
// being a long render rather than a single call: progress and log messages flow
// back during the run, the main thread answers 'need-live' requests mid-render,
// and an abort has to reach a loop that is already going.

/** What one in-flight worker render needs from its caller. */
interface SeqWorkerRun {
  resolve(b: Blob): void;
  reject(e: unknown): void;
  log(level: string, msg: string): void;
  progress(done: number, total: number): void;
  live?: SeqJobIO['lottieAt'];
  /** Restart the liveness deadline - called for every message this run sends. */
  touch(): void;
  /** Stop the liveness deadline (the run settled). */
  clear(): void;
}

/**
 * How long the CLIENT waits without hearing anything from a run before it gives up.
 *
 * The executor's own `watchdogMs` protects the frame loop, but it runs on the
 * WORKER's event loop: a thread killed for memory pressure (Chrome does not
 * reliably surface that as an `error` on the parent) or wedged inside a
 * synchronous native decode cannot fire its own timer either, and the returned
 * promise would then never settle - the export UI hangs with no error at all.
 * This is the only deadline that survives the worker dying silently. Generous by
 * design: a frame that is merely slow is the worker's watchdog's business, not this
 * one's, and every message a run emits (progress, log, need-live) resets it.
 */
const SEQ_CLIENT_SILENCE_MS = 60_000;

let seqWorker: Worker | null = null;
let seqRunSeq = 0;
const seqPending = new Map<number, SeqWorkerRun>();

/** Swappable so a test can drive the protocol against a stub port. */
let seqWorkerFactory: () => Worker = () =>
  new Worker(new URL('./sequence-render.worker.ts', import.meta.url), { type: 'module' });

/** TEST SEAM: replace the worker factory (pass null to restore the real one). */
export function _setSequenceWorkerFactory(f: (() => Worker) | null): void {
  // Swapping the factory tears the current worker down, so any run still on it
  // would hang forever waiting for a thread that no longer exists. Settle them.
  abortSequenceWorkerRenders('the worker factory was replaced');
  seqWorkerFactory = f ?? (() => new Worker(new URL('./sequence-render.worker.ts', import.meta.url), { type: 'module' }));
  disposeSequenceWorker();
}

/** Drop the worker instance itself (does not touch pending runs). */
function disposeSequenceWorker(): void {
  const w = seqWorker;
  seqWorker = null;
  if (!w) return;
  w.onmessage = null;
  w.onerror = null;
  try { w.terminate(); } catch { /* already gone */ }
}

/**
 * Cancel every render when the page goes away.
 *
 * Armed on first spawn rather than at import (this module is lazily loaded, and a
 * listener that only matters once a worker exists should not be a side effect of
 * loading the file). Without it, navigating away mid-export leaves a full
 * decode+composite+encode of the whole sequence running invisibly off-thread,
 * holding its providers, its canvas and a growing muxer buffer, until the tab
 * closes. In-thread that work died with the render; off-thread it does not.
 */
let seqPageHideArmed = false;
function armSeqPageHide(): void {
  if (seqPageHideArmed) return;
  seqPageHideArmed = true;
  try {
    globalThis.addEventListener?.('pagehide', () => abortSequenceWorkerRenders('the page was closed'));
  } catch { /* no event target (node tests) */ }
}

function ensureSeqWorker(): Worker {
  if (seqWorker) return seqWorker;
  armSeqPageHide();
  const w = seqWorkerFactory();
  w.onmessage = (e: MessageEvent<SeqWorkerOut>): void => { void onSeqWorkerMessage(w, e.data); };
  w.onerror = (): void => {
    for (const run of seqPending.values()) { run.clear(); run.reject(new Error('sequence-render worker error')); }
    seqPending.clear();
    disposeSequenceWorker();      // the next render spawns a fresh one
  };
  seqWorker = w;
  return w;
}

async function onSeqWorkerMessage(w: Worker, m: SeqWorkerOut): Promise<void> {
  const run = seqPending.get(m.id);
  if (!run) return;
  run.touch();
  if (m.type === 'log') { run.log(m.level, m.msg); return; }
  if (m.type === 'progress') { run.progress(m.done, m.total); return; }
  if (m.type === 'need-live') {
    // The bounded queue in practice: the worker is blocked until this reply, so
    // exactly one live raster exists at a time and a slow main thread simply
    // slows the render instead of growing worker memory.
    let bitmap: ImageBitmap | null = null;
    try {
      const img = await run.live?.(m.layerIdx, m.frame, m.sourceSec, m.slot);
      if (img) bitmap = await createImageBitmap(img as ImageBitmapSource);
    } catch { bitmap = null; }
    const reply: SeqWorkerIn = { type: 'live', id: m.id, token: m.token, bitmap };
    try {
      w.postMessage(reply, bitmap ? [bitmap] : []);
    } catch {
      // The worker went away between the request and this reply (a terminate on
      // abort, or onerror). The bitmap was neither transferred nor consumed, so
      // it is still ours to close - the run itself is settled elsewhere.
      try { bitmap?.close(); } catch { /* already closed */ }
    }
    return;
  }
  seqPending.delete(m.id);
  run.clear();
  if (m.type === 'done') { run.resolve(new Blob([m.buffer], { type: m.mime })); return; }
  // An OFFLOAD failure is rejected as a PLAIN Error on purpose: that is the exact
  // signal `renderSequence`'s catch tests for before retrying in-thread. Rejecting
  // it as a coded SequenceError would present an infrastructure failure to the user
  // as the render's verdict and skip a fallback that would have succeeded.
  run.reject(m.offload
    ? new Error(`worker offload failed (${m.code}): ${m.message}`)
    : sequenceError(m.code as SeqErrorCode, m.message));
  // A worker that failed on its own infrastructure (a muxer it could not build, a
  // dynamic import that would not load) is not trustworthy for the retry, and it
  // may still be holding the run's transferred plates. Drop the thread; the next
  // render spawns a fresh one.
  if (m.offload) disposeSequenceWorker();
}

/** The opt-in flag - the same one bridge/video-encode.ts uses. */
export function workerSequenceRenderEnabled(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem('lolly.workerEncode') === '1'; }
  catch { return false; }
}

/**
 * Can (and should) the composite+encode run in a Worker?
 *
 * Needs module Workers, an OffscreenCanvas to composite onto, WebCodecs to encode
 * with, `createImageBitmap` to ship the plates over - and the opt-in. Anything
 * missing falls back to the in-thread executor, which is the same code.
 */
export function supportsWorkerSequenceRender(): boolean {
  return typeof Worker !== 'undefined'
    && typeof OffscreenCanvas !== 'undefined'
    && typeof VideoEncoder !== 'undefined'
    && typeof createImageBitmap === 'function'
    && workerSequenceRenderEnabled();
}

/**
 * The opt-in flag for the P2b GPU compositor (plans/104 section 6.4) - its own switch,
 * separate from the worker one, so a user can trial the tilt compositor without also
 * moving the untilted render off-thread. A test flips it with
 * `localStorage.setItem('lolly.glCompositor', '1')`.
 */
export function glSequenceRenderEnabled(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem('lolly.glCompositor') === '1'; }
  catch { return false; }
}

/**
 * Can (and should) a tilted export take the GPU compositor?
 *
 * Needs WebGL2 (probed once, cached) and the opt-in; the compositor runs IN-THREAD
 * (this cut skips Worker-OffscreenGL), so unlike `supportsWorkerSequenceRender` it asks
 * for no Worker/WebCodecs capability - a gif/apng tilt export composites on the GPU and
 * reads back to a 2D canvas just the same. Anything missing keeps the P2a capture tier,
 * which is correct, only slower. Mirrors `supportsWorkerSequenceRender`'s shape.
 */
export function supportsGlSequenceRender(): boolean {
  return glSequenceRenderEnabled() && glQuadCompositorSupported();
}

/**
 * Cancel every in-flight worker render and tear the worker down.
 *
 * Both halves matter: the `abort` message lets the worker unwind its own frame
 * loop (disposing decoders, aborting the muxer) rather than being killed mid
 * decode, and `terminate()` guarantees the thread is gone even if it never
 * answers. Idempotent.
 */
export function abortSequenceWorkerRenders(reason?: string): void {
  const w = seqWorker;
  const had = seqPending.size > 0;
  for (const [id, run] of seqPending) {
    if (w) { try { w.postMessage({ type: 'abort', id } satisfies SeqWorkerIn); } catch { /* already gone */ } }
    run.clear();
    run.reject(sequenceError('SEQ_ABORTED', reason ?? 'sequence export cancelled'));
  }
  seqPending.clear();
  if (!w) { disposeSequenceWorker(); return; }
  // Terminating in this same task would mean the worker never even DEQUEUES the
  // abort we just posted, making every cancel a hard kill mid-decode. Detach the
  // instance now (so the next render spawns a clean one and nothing here can
  // observe its messages) and give its event loop one turn to unwind - dispose
  // providers, abort the muxer - before pulling the thread out from under it.
  seqWorker = null;
  w.onmessage = null;
  w.onerror = null;
  const kill = (): void => { try { w.terminate(); } catch { /* already gone */ } };
  if (had) setTimeout(kill, SEQ_ABORT_GRACE_MS);
  else kill();
}

/** How long a cancelled worker gets to unwind before it is terminated. */
export const SEQ_ABORT_GRACE_MS = 250;

/**
 * Render one job in the Worker. Rejects with a `SequenceError` for a coded
 * failure the render itself produced, and a plain Error for an offload failure
 * the caller should retry in-thread.
 *
 * Exported as a test seam (with `_setSequenceWorkerFactory`) so the whole
 * message protocol - start, progress, log, need-live, done, error, abort - is
 * provable in node against a stub port, not only in a browser.
 */
export async function renderSequenceInWorker(
  job: SeqJob, pick: EncodePick, bitrate: number, audioPick: AudioPick | null,
  mixPcm: PcmSource | null,
  io: { log(l: string, m: string): void; progress(d: number, t: number): void; live?: SeqJobIO['lottieAt'] },
): Promise<Blob> {
  // The plates are canvases (the in-thread fallback still needs them), so the
  // worker gets transferable COPIES. createImageBitmap does not consume its source.
  const bitmapOf = async (c: CanvasImageSource | null): Promise<ImageBitmap | null> =>
    (c ? await createImageBitmap(c as ImageBitmapSource) : null);
  const wireJob: SeqJob = {
    ...job,
    bg: await bitmapOf(job.bg),
    plates: await Promise.all(job.plates.map(async (p) => ({
      idx: p.idx, under: await bitmapOf(p.under), over: await bitmapOf(p.over),
    }))),
    // A blob: URL is resolvable from a worker, but handing over the Blob itself
    // is both cheaper (structured clone is by reference) and keeps the worker
    // free of any dependency on the document's URL store. A remote URL is passed
    // through so mediabunny can range-request it rather than us buffering it all.
    clips: await Promise.all(job.clips.map(async (c) => ({
      idx: c.idx,
      src: typeof c.src === 'string' && c.src.startsWith('blob:')
        ? await (await fetch(c.src)).blob()
        : c.src,
    }))),
  };

  const audio: SeqWorkerAudio | null = audioPick && mixPcm
    ? {
        ...audioPick,
        length: mixPcm.length,
        // COPIES of the analytic planes: these are transferred, and detaching the
        // planes the in-thread fallback would re-derive from the same spec is not a
        // trade worth making for one memcpy of a few MB. The worker feeds this whole
        // mix through addAudio, re-chunked on the SAME 4800 grid the in-thread feeder
        // uses, so the two paths stay byte-identical (the worker-SHA golden).
        channels: Array.from({ length: audioPick.numberOfChannels }, (_, ch) =>
          new Float32Array(mixPcm.getChannelData(Math.min(ch, mixPcm.numberOfChannels - 1)))),
      }
    : null;

  const w = ensureSeqWorker();
  const id = ++seqRunSeq;
  const transfer: Transferable[] = jobTransferables(wireJob);
  if (audio) for (const ch of audio.channels) transfer.push(ch.buffer);

  return await new Promise<Blob>((resolve, reject) => {
    let silence: ReturnType<typeof setTimeout> | undefined;
    const clear = (): void => { if (silence) { clearTimeout(silence); silence = undefined; } };
    const touch = (): void => {
      clear();
      silence = setTimeout(() => {
        seqPending.delete(id);
        // A plain Error, not a coded one: a silent worker is the offload failing,
        // and the in-thread path is the honest retry.
        reject(new Error(`the render worker went silent for ${SEQ_CLIENT_SILENCE_MS / 1000}s`));
        disposeSequenceWorker();
      }, SEQ_CLIENT_SILENCE_MS);
      // Never hold the process open for this in a node test run.
      (silence as unknown as { unref?: () => void }).unref?.();
    };
    seqPending.set(id, { resolve, reject, log: io.log, progress: io.progress, live: io.live, touch, clear });
    const start: SeqWorkerIn = { type: 'start', id, job: wireJob, pick, bitrate, audio };
    try {
      w.postMessage(start, transfer);
      touch();
    } catch (err) {
      seqPending.delete(id);
      clear();
      closeJobBitmaps(wireJob);
      reject(err);
    }
  });
}

// ── output encoders ─────────────────────────────────────────────────────────

function canvasBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  if (typeof (canvas as OffscreenCanvas).convertToBlob === 'function') {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality });
  }
  return new Promise<Blob>((res, rej) =>
    (canvas as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error('frame encode failed'))), type, quality));
}

/**
 * APNG: the engine splices already-encoded PNGs at the chunk level.
 *
 * DPI + provenance + colour profile are stamped exactly as export.ts's renderApng
 * stamps them, including the 96 dpi default (a sequence is authored in CSS px, so
 * the physical-unit 300 dpi branch of `exportDims` never applies here) and the ICC
 * profile, whose absence would silently drop a colour profile the user selected.
 */
async function apngBlob(frames: Uint8Array[], fps: number, opts: ExportOpts): Promise<Blob> {
  let bytes = packApng(frames, {
    delayMs: Math.round(1000 / fps),
    loops: opts.repeat === -1 ? 1 : (opts.repeat ?? 0),
  });
  const wantDpi = Number(opts.dpi);
  const dpi = Number.isFinite(wantDpi) && wantDpi > 0 ? wantDpi : CSS_DPI;
  bytes = insertPngPhys(bytes, dpi) || bytes;
  bytes = insertPngMeta(bytes, opts.meta as never);
  const icc = iccWanted(opts) ? iccProfileBytes(opts.colorProfile) : null;
  if (icc) bytes = await insertPngIcc(bytes, icc);
  return new Blob([bytes as BlobPart], { type: 'image/png' });
}

/** GIF: gifenc, one local palette per frame (the renderGif no-dither policy). */
async function gifBlob(frames: Uint8ClampedArray[], w: number, h: number, opts: ExportOpts): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = (await import('gifenc')) as any;
  const gif = GIFEncoder();
  const delay = Math.round(1000 / GIF_FPS);
  const repeat = opts.repeat != null ? opts.repeat : 0;
  frames.forEach((pixels, i) => {
    const palette = quantize(pixels, 256);
    const indexed = applyPalette(pixels, palette);
    gif.writeFrame(indexed, w, h, i === 0 ? { palette, delay, repeat } : { palette, delay });
  });
  gif.finish();
  return new Blob([gif.bytesView()], { type: 'image/gif' });
}

/** One animated-WebP frame: a browser-encoded WebP bitstream. Throws (like the still
 *  renderWebpAnim) when this browser lacks WebP canvas encoding, so the caller fails
 *  loudly rather than muxing PNGs the engine would reject. */
async function webpFrame(canvas: AnyCanvas, quality: number): Promise<Uint8Array> {
  const b = await canvasBlob(canvas, 'image/webp', quality);
  if (!/webp/.test(b.type)) throw sequenceError('SEQ_NO_CODEC', 'This browser cannot encode WebP; export as GIF or APNG instead.');
  return new Uint8Array(await b.arrayBuffer());
}

/** Animated WebP: the engine muxes the per-frame WebP bitstreams into one RIFF/WEBP
 *  (full colour + alpha, smaller than GIF or APNG). C2PA is placed downstream via the
 *  'webp' key mapping, exactly as gif/apng are stamped after this returns. */
async function webpAnimBlob(frames: Uint8Array[], w: number, h: number, fps: number, opts: ExportOpts): Promise<Blob> {
  const bytes = packWebpAnim(frames, {
    width: w, height: h,
    delayMs: Math.round(1000 / fps),
    loops: opts.repeat === -1 ? 1 : (opts.repeat ?? 0),
  });
  return new Blob([bytes as BlobPart], { type: 'image/webp' });
}

/**
 * MediaRecorder fallback: replay the already-composed frames at wall pace.
 *
 * Reached only when WebCodecs cannot encode at all. Correct but real-time, and
 * it re-introduces the buffered-frame memory profile - which is why the composed
 * frames were kept as ImageBitmaps for this path only.
 */
async function recorderReplay(
  bitmaps: ImageBitmap[], canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D,
  format: 'mp4' | 'webm', fps: number, opts: ExportOpts, host: SeqHost | null,
): Promise<Blob> {
  const mimeType = videoMimeType(format, false);
  if (!mimeType) {
    bitmaps.forEach((b) => b.close());
    throw sequenceError('SEQ_NO_CODEC', 'Video recording is not supported in this browser. Use GIF instead, or try Chrome or Firefox for WebM.');
  }
  const frameMs = 1000 / fps;
  const { stream, deliver } = manualCaptureStream(canvas, fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: videoBitrate(canvas.width, canvas.height, fps) });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const container = mimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
  const blob = await new Promise<Blob>((resolve, reject) => {
    recorder.onerror = (e) => {
      stream.getTracks().forEach((t) => t.stop());
      bitmaps.forEach((b) => b.close());
      reject((e as { error?: Error }).error ?? new Error('MediaRecorder error'));
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      bitmaps.forEach((b) => b.close());
      resolve(new Blob(chunks, { type: container }));
    };
    recorder.start();
    let i = 0;
    // setTimeout, not rAF: rAF stops entirely in a backgrounded tab and would
    // strand the export mid-record (the renderVideo Phase-2 pump's reasoning).
    const pump = (): void => {
      if (i >= bitmaps.length) {
        setTimeout(() => { try { recorder.stop(); } catch { /* already stopping */ } }, Math.max(frameMs, 40));
        return;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmaps[i++]!, 0, 0);
      deliver();
      setTimeout(pump, frameMs);
    };
    pump();
  });
  return await withVideoMeta(blob, container, opts.meta, host);
}
