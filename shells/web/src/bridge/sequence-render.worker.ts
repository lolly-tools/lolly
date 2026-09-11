// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-render.worker.ts - the DOM-FREE HALF of the sequence compositor, and
 * the Worker entry that runs it off the main thread (Fable timeline, phase 4
 * Track B).
 *
 * WHY THIS FILE IS BOTH A MODULE AND A WORKER. Determinism is the hard
 * requirement: the worker path must produce output IDENTICAL to the in-thread
 * path (phase 3 pinned frame-exactness with a sha256 across two runs). The only
 * way to guarantee that without a second sha is to have exactly ONE compositor.
 * So the frame loop, `drawItem`, the provider lifecycle and the truncation
 * reconciliation live here, and BOTH callers drive them:
 *
 *   • sequence-render.ts imports `runSequenceJob` and calls it directly for the
 *     in-thread path (and for gif / apng / the MediaRecorder fallback, which can
 *     never leave the main thread);
 *   • this same file, loaded as a module Worker, calls `runSequenceJob` with an
 *     IO that feeds a streaming muxer and posts the bytes back.
 *
 * The `addEventListener('message', …)` registration at the bottom is therefore
 * guarded on actually being in worker scope: importing this module on the main
 * thread must not install a window message listener.
 *
 * THE SPLIT RULE (the crux of Track B). Three things cannot leave the main
 * thread, and none of them are in this file:
 *   1. dom-to-image rasterisation of a box. It needs the live DOM and computed
 *      styles. Statics are shot ONCE up front and arrive here as ImageBitmaps.
 *   2. the OfflineAudioContext mix, main-thread only. It arrives here as planar
 *      Float32Array PCM.
 *   3. a LOTTIE layer, which must be advanced on the live lottie-web player and
 *      re-rasterised per frame. lottie-web is not runnable in a worker, so a
 *      lottie frame is requested back over the message channel (`need-lottie`)
 *      and the worker blocks on it. At most ONE such request is ever outstanding,
 *      the tightest possible bound on the queue, so a slow main thread cannot
 *      balloon worker memory.
 * Consequently: a sequence with NO lottie layer runs 100% worker-side; one with
 * a lottie layer runs hybrid, and the compositor reports which.
 *
 * MEMORY. Unchanged from the in-thread path: one canvas, at most two decoded
 * samples per open provider, at most HIGH_WATER+1 VideoFrames in the mux, and at
 * most one lottie ImageBitmap in flight. Nothing here is O(frames).
 */

import {
  EMPTY_KF_TRACK,
  camerasMove,
  ownsLayerFx,
  planCameraView,
  sequenceDrawPlan,
  stageCameras,
  activeFrameWindow,
  crossfadeJunctions,
  reconcileDecoded,
  sequenceError,
  SequenceError,
  toCodedError,
  type SeqLayer,
  type PlanItem,
} from './sequence-plan.ts';
import type { KfTrack } from '@lolly/engine';
import {
  createVideoProvider,
  type InstrumentedProvider,
  type ProviderStats,
} from './sequence-providers.ts';
import {
  createStreamingMux,
  type EncodePick,
  type EncodeAudio,
  type PcmSource,
  type StreamingMux,
} from './video-encode-core.ts';
import { parseClipShape, projectLayer } from '@lolly/engine';
// The two blur lanes (plans/104 section 5.5, section 11 S1). DOM-free at import, so the executor
// keeps its own DOM-free contract; the probe inside decides which lane a context gets.
import {
  laneFor, releaseBlurScratches, releaseStage, renderFx, scaleFilter, scratchPadCap,
  spillPad, takeStage,
  type BlurStage, type FxSpec,
} from '../lib/canvas-blur.ts';
// Pure arithmetic (no DOM, no canvas), so the executor keeps its DOM-free contract.
import { fxCacheBudgetBytes } from './plate-budget.ts';

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type AnyCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── streaming-mux target gate (plans/156 WP-A part 3) ────────────────────────
//
// A SEQUENCE streaming export (mp4/webm on the WebCodecs path) streams its container
// to OPFS once it is long enough that holding the whole encoded stream in memory is the
// real cost; a shorter one keeps the lean in-memory BufferTarget (already minimal after
// Phase B, and byte-for-byte its historical layout). The gate is on FRAME COUNT alone,
// and it lives HERE - the DOM-free file both threads import - precisely so the in-thread
// path (sequence-render.ts, `frameCount`) and the worker path (`handleStart`,
// `job.frameCount`) call the SAME function on the SAME number and therefore pick the
// SAME target. That is what keeps the two byte-identical (the worker==in-thread SHA
// golden), which requires the same `fastStart:false` OPFS layout on both once the gate
// is crossed. Requesting 'opfs' is always safe: buildMediabunnyMux falls back to a
// BufferTarget when OPFS is absent (part 1).

/** Frames at/above which a streaming sequence export uses the OPFS StreamTarget. 900 =
 *  30 s @30fps, comfortably below the 45 s / 1350-frame browser golden, so that golden
 *  exercises (and thereby validates) the OPFS path while short exports stay on buffer. */
export const OPFS_STREAM_MIN_FRAMES = 900;

/** The streaming-mux target for an export of `frameCount` frames - the ONE gate both
 *  the in-thread and worker sequence paths call, so they never diverge. */
export function streamMuxTargetFor(frameCount: number): 'buffer' | 'opfs' {
  return frameCount >= OPFS_STREAM_MIN_FRAMES ? 'opfs' : 'buffer';
}

// ── geometry: clip shapes and object-fit (pure, so they can be reasoned about) ──

/**
 * `border-radius` shorthand → four corner radii in UNSCALED box px.
 *
 * The 1–4 value form with px / % only; the elliptical `a / b` form collapses to
 * its horizontal radii. That is the whole vocabulary the box editor authors
 * (`0`, `12px`, `9999px`), and an unparsed value degrades to a square corner - 
 * a visible-but-harmless difference, never a thrown export.
 */
export function radiiOf(borderRadius: string, w: number, h: number): [number, number, number, number] {
  const s = (borderRadius || '').split('/')[0]?.trim() ?? '';
  if (!s || s === '0') return [0, 0, 0, 0];
  const toks = s.split(/\s+/).slice(0, 4);
  const min = Math.min(w, h);
  const one = (tok: string | undefined, ref: number): number => {
    if (!tok) return 0;
    const v = parseFloat(tok);
    if (!Number.isFinite(v)) return 0;
    return tok.endsWith('%') ? (v / 100) * ref : v;
  };
  const a = one(toks[0], min);
  const b = one(toks[1] ?? toks[0], min);
  const c = one(toks[2] ?? toks[0], min);
  const d = one(toks[3] ?? toks[1] ?? toks[0], min);
  // CSS shrinks every radius by one factor when a pair overflows its edge.
  const f = Math.min(1, w / Math.max(1e-6, a + b), w / Math.max(1e-6, d + c), h / Math.max(1e-6, a + d), h / Math.max(1e-6, b + c));
  const k = Math.min(1, f);
  return [a * k, b * k, c * k, d * k];
}

/** Where the media lands inside its box, honouring object-fit / object-position. */
export function fitRect(
  fit: string, pos: string, natW: number, natH: number, boxW: number, boxH: number,
): { x: number; y: number; w: number; h: number } {
  const nw = natW > 0 ? natW : boxW;
  const nh = natH > 0 ? natH : boxH;
  let w = boxW;
  let h = boxH;
  if (fit === 'contain' || fit === 'scale-down') {
    const s = Math.min(boxW / nw, boxH / nh, fit === 'scale-down' ? 1 : Infinity);
    w = nw * s; h = nh * s;
  } else if (fit === 'cover') {
    const s = Math.max(boxW / nw, boxH / nh);
    w = nw * s; h = nh * s;
  } else if (fit === 'none') {
    w = nw; h = nh;
  } // 'fill' (the CSS default) stretches to the box - w/h already are the box.
  const frac = (token: string, fallback: number): number => {
    const t = token.trim().toLowerCase();
    if (t === 'left' || t === 'top') return 0;
    if (t === 'right' || t === 'bottom') return 1;
    if (t === 'center' || t === '') return fallback;
    const v = parseFloat(t);
    return Number.isFinite(v) && t.endsWith('%') ? v / 100 : fallback;
  };
  const parts = (pos || '').trim() ? pos.trim().split(/\s+/) : [];
  const fx = frac(parts[0] ?? '', 0.5);
  const fy = frac(parts[1] ?? parts[0] ?? '', 0.5);
  return { x: (boxW - w) * fx, y: (boxH - h) * fy, w, h };
}

/** CSS mix-blend-mode values that are also canvas composite operations. */
const BLEND_OPS = new Set([
  'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
]);

// ── the wire structure of a layer ───────────────────────────────────────────────

/**
 * A `SeqLayer` with the DOM taken out of it - everything the compositor needs,
 * and nothing that cannot cross a `postMessage`.
 *
 * The two readings that USED to be taken off the live `<video>` inside the draw
 * call (`style.objectFit` / `style.objectPosition`) are lifted here, so the
 * executor never touches an element. `el` is deliberately absent: the planner
 * (`sequenceDrawPlan`, `crossfadeJunctions`, `activeFrameWindow`) never
 * dereferences it, which is what makes hydrating a `SeqLayer` without one safe.
 */
export interface SeqJobLayer {
  idx: number;
  startMs: number;
  durMs: number;
  clipInMs: number;
  speed: number;
  mute: boolean;
  /** Struck-through / ignored (plans/174) - dropped from frames and mix on the worker side. */
  ignored?: boolean;
  /** Clip volume 0..2; absent from an older job reads as 1. */
  gain?: number;
  /** Stereo pan -1..1; absent from an older job reads as 0 (centred). */
  pan?: number;
  /** Duck-to level 0..1; absent from an older job reads as 1 (no duck). */
  duck?: number;
  /** Pitch transpose in semitones; absent from an older job reads as 0. */
  pitch?: number;
  /** Tape-style varispeed; absent from an older job reads as false (preserve pitch). */
  varispeed?: boolean;
  /** Audio effect chain; absent from an older job reads as '' (none). */
  fx?: string;
  enter: SeqLayer['enter'];
  enterMs: number;
  exit: SeqLayer['exit'];
  exitMs: number;
  /** The authored geometry curves, carried verbatim - the planner is the validator. */
  enterEase: string;
  exitEase: string;
  /**
   * Split text animation (plans/175 WP-A), carried so the worker's own
   * `sequenceDrawPlan` suppresses the whole-box transition on exactly the frames
   * the main thread's does. `splitUnits`/`splitSeed` are DOM facts captured at
   * parse (the worker has no element to count spans on). Absent from an older
   * job they read as '' / 0 - not split, the pre-existing behaviour.
   */
  split?: SeqLayer['split'];
  splitStaggerMs?: number;
  splitOrder?: SeqLayer['splitOrder'];
  splitUnits?: number;
  splitSeed?: number;
  /** Hold effect (plans/175 WP-B) - carried so the worker's planner composes the
   *  same looping pose the main thread's does. Absent from an older job = still. */
  hold?: SeqLayer['hold'];
  holdRate?: number;
  lane: SeqLayer['lane'];
  kind: SeqLayer['kind'];
  rect: { x: number; y: number; w: number; h: number; rot: number };
  opacity: number;
  blend: string;
  radius: string;
  clipPath: string;
  openEnded: boolean;
  /** True for a timed frame-page scene layer - see SeqLayer.frameScene. */
  frameScene: boolean;
  /** The deck transition a frame page plays into the next - see SeqLayer.frameTransition.
   *  OPTIONAL so a job posted by an older build reads as absent, which hydrates to ''. */
  frameTransition?: string;
  /** The box's depth, px above the surface - see SeqLayer.z. */
  z: number;
  /**
   * The box's own tilt in degrees - see SeqLayer.rx/ry (P2.1). OPTIONAL so a job
   * posted by an older build reads as absent, which hydrates to 0, which is flat.
   */
  rx?: number;
  ry?: number;
  /**
   * The PARSED keyframe track, as plain data.
   *
   * A `KfTrack` is arrays of records of numbers and strings and nothing else, which
   * is the whole reason the engine hands it back in that shape: a compiled bezier
   * closure inside the cached form would throw DataCloneError on `postMessage` and
   * silently kill worker offload (section 5.1). The evaluator's own caches - the per-track
   * channel index, the bezier control points - are module state, so they simply
   * rebuild on this side from the values that crossed. `structuredClone(toJobLayer(…))`
   * is pinned in sequence-render-worker.test.ts.
   */
  kf: KfTrack;
  /** The AUTHORED blur radius, px, split out of the inline filter - see SeqLayer.blur. */
  blur: number;
  /** Everything else the authored filter said - see SeqLayer.shadowFilter. */
  shadowFilter: string;
  /**
   * The margin, in stage-native px, this layer's plates were CAPTURED with
   * (`rasterBox`'s `pad`, plans/104 section 5.5). The plate's origin is `(-platePad,
   * -platePad)` in box space, so every draw of it subtracts the pad and adds twice it
   * to the size. 0 - what P0 always computes - makes those expressions the identical
   * numbers they were before padding existed, which is the byte-identity floor.
   */
  platePad?: number;
  /**
   * The RESOLUTION multiplier this layer's plates were captured at, over the export
   * scale S (the plate budget's bucketed `eff`, plans/104 section 5.5). 1 - every P0 export - 
   * means "shot at exactly S", which is what every plate before depth was.
   *
   * The executor needs it because the FILTERED path composites through a scratch, and
   * a scratch sized in S px would resample an `S·eff` plate down to S and then blow the
   * result back up by eff - throwing away precisely the resolution the budget just paid
   * for, on precisely the layers (lifted, depth-shadowed) that asked for it.
   */
  plateEff?: number;
  /** Computed object-fit of the layer's media element ('' when it has none). */
  objectFit: string;
  /** Computed object-position of the layer's media element. */
  objectPosition: string;
  /**
   * True when this layer's picture comes from a LIVE DOM raster taken per frame
   * (a lottie box with a mounted player). The one thing that forces the hybrid
   * split - see the header.
   */
  needsLiveRaster: boolean;
}

/** Strip a parsed `SeqLayer` to its wire form. `media` supplies the two style reads. */
export function toJobLayer(
  L: SeqLayer,
  extra: {
    objectFit?: string; objectPosition?: string; needsLiveRaster?: boolean;
    platePad?: number; plateEff?: number;
  } = {},
): SeqJobLayer {
  return {
    idx: L.idx, startMs: L.startMs, durMs: L.durMs, clipInMs: L.clipInMs, speed: L.speed,
    mute: L.mute, ignored: L.ignored, gain: L.gain, pan: L.pan, duck: L.duck, pitch: L.pitch, varispeed: L.varispeed, fx: L.fx, enter: L.enter, enterMs: L.enterMs, exit: L.exit, exitMs: L.exitMs,
    enterEase: L.enterEase, exitEase: L.exitEase,
    split: L.split, splitStaggerMs: L.splitStaggerMs, splitOrder: L.splitOrder,
    splitUnits: L.splitUnits, splitSeed: L.splitSeed,
    hold: L.hold, holdRate: L.holdRate,
    lane: L.lane, kind: L.kind,
    rect: { x: L.rect.x, y: L.rect.y, w: L.rect.w, h: L.rect.h, rot: L.rect.rot },
    opacity: L.opacity, blend: L.blend, radius: L.radius, clipPath: L.clipPath,
    openEnded: L.openEnded,
    frameScene: L.frameScene,
    frameTransition: L.frameTransition,
    z: L.z, rx: L.rx, ry: L.ry, kf: L.kf, blur: L.blur, shadowFilter: L.shadowFilter,
    platePad: extra.platePad ?? 0,
    plateEff: Number.isFinite(extra.plateEff) && (extra.plateEff as number) > 0 ? extra.plateEff as number : 1,
    objectFit: extra.objectFit ?? '',
    objectPosition: extra.objectPosition ?? '',
    needsLiveRaster: extra.needsLiveRaster ?? false,
  };
}

/**
 * The element-free stand-in a hydrated layer carries.
 *
 * A frozen empty object, not `null`: the plan module reads `layer.el` nowhere,
 * but a defensive `l.el?.something` somewhere downstream should read as "no
 * element" rather than throwing inside a frame loop.
 */
const NO_EL = Object.freeze({}) as unknown as HTMLElement;

/** Wire form → the `SeqLayer` the pure planner consumes. */
export function hydrateJobLayer(w: SeqJobLayer): SeqLayer {
  return {
    el: NO_EL,
    idx: w.idx, startMs: w.startMs, durMs: w.durMs, clipInMs: w.clipInMs, speed: w.speed,
    mute: w.mute, ignored: !!w.ignored, gain: Number.isFinite(w.gain as number) ? (w.gain as number) : 1, pan: Number.isFinite(w.pan as number) ? (w.pan as number) : 0, duck: Number.isFinite(w.duck as number) ? (w.duck as number) : 1, pitch: Number.isFinite(w.pitch as number) ? (w.pitch as number) : 0, varispeed: !!w.varispeed, fx: w.fx || '', enter: w.enter, enterMs: w.enterMs, exit: w.exit, exitMs: w.exitMs,
    enterEase: w.enterEase || '', exitEase: w.exitEase || '',
    split: w.split || '', splitStaggerMs: Number.isFinite(w.splitStaggerMs as number) ? (w.splitStaggerMs as number) : 0,
    splitOrder: w.splitOrder || '', splitUnits: Number.isFinite(w.splitUnits as number) ? (w.splitUnits as number) : 0,
    splitSeed: Number.isFinite(w.splitSeed as number) ? (w.splitSeed as number) : 0,
    hold: w.hold || '', holdRate: Number.isFinite(w.holdRate as number) ? (w.holdRate as number) : 1,
    lane: w.lane, kind: w.kind, rect: { ...w.rect }, opacity: w.opacity, blend: w.blend,
    radius: w.radius, clipPath: w.clipPath, openEnded: w.openEnded,
    frameScene: w.frameScene ?? false,
    frameTransition: w.frameTransition ?? '',
    // A structured clone arrives unfrozen and, from an older job, possibly absent
    // entirely - so the track is re-normalised to the empty singleton rather than
    // trusted to be an array. Nothing mutates it after this point, which is the one
    // thing the engine's memoised channel index asks of a track.
    z: Number.isFinite(w.z) ? w.z : 0,
    rx: Number.isFinite(w.rx) ? (w.rx as number) : 0,
    ry: Number.isFinite(w.ry) ? (w.ry as number) : 0,
    kf: Array.isArray(w.kf) ? w.kf : EMPTY_KF_TRACK,
    blur: Number.isFinite(w.blur) ? w.blur : 0,
    shadowFilter: w.shadowFilter ?? '',
  };
}

// ── the job ─────────────────────────────────────────────────────────────────

/**
 * The already-rasterised plates for one layer (see `SeqJob.plates`).
 *
 * `CanvasImageSource`, not `ImageBitmap`, because the SAME job shape drives both
 * threads: in-thread the plates are the `HTMLCanvasElement`s dom-to-image just
 * produced, and only the worker path converts them to transferable bitmaps.
 * `drawImage` cannot tell the two apart, which is what keeps the output identical.
 */
export interface SeqJobPlate {
  idx: number;
  /** Statics: the whole box. Media: the box with its media element hidden. */
  under: CanvasImageSource | null;
  /** Media only: the box's text/overlay chrome over a transparent background. */
  over: CanvasImageSource | null;
}

/** One clip's bytes (worker path) or its URL (in-thread path). */
export interface SeqJobClip { idx: number; src: Blob | string }

/**
 * Everything the DOM-free executor needs for one render. Every field is
 * structured-cloneable, so the exact same object drives the in-thread call and
 * the worker `postMessage`.
 */
export interface SeqJob {
  layers: SeqJobLayer[];
  /** Output frame times, ms - already capped to `frameCount`. */
  grid: number[];
  frameCount: number;
  fps: number;
  totalMs: number;
  outW: number;
  outH: number;
  /** Export pixels per authored px. */
  scale: number;
  /**
   * The stage's NATIVE size (BEFORE `scale`), px - the projection's principal point
   * is its centre (plans/104 section 4.1). Optional so an older or hand-built job still
   * runs: absent means a zero-sized stage, and a zero-sized stage only differs from a
   * real one once a layer is actually lifted off it.
   */
  stageW?: number;
  stageH?: number;
  /** The artboard behind every layer, or null for a transparent export. */
  bg: CanvasImageSource | null;
  /**
   * The margin, stage-native px, the bg plate was captured with (plans/104 section 5.5).
   *
   * The stage background is an implicit z = 0 LAYER and is projected like one, so a
   * camera pan or pull-back reveals what used to be off the artboard - this is the
   * overscan that has content in it. Absent / 0 (every camera-less export, and every job
   * built before this existed) means the plate is exactly the artboard, and the executor
   * takes the untransformed full-canvas draw it always took.
   */
  bgPad?: number;
  plates: SeqJobPlate[];
  clips: SeqJobClip[];
  /** Copied from the renderer's policy constants so the worker holds no second copy. */
  maxLiveProviders: number;
  watchdogMs: number;
  /**
   * Bytes of cached fx plates this render may retain (plans/104 P3.1) - see
   * `fxPlateKey`. Absent means `fxCacheBudgetBytes()`, this machine's own allowance;
   * 0 turns the cache off entirely, which is how a test pins that a cached frame and
   * an uncached one are the same pixels. Plain number, so it survives `postMessage`
   * and both threads cache the same layers.
   */
  fxCacheBytes?: number;
}

const isBitmap = (v: unknown): v is ImageBitmap =>
  typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap;

/** Collect every transferable inside a job, for `postMessage`'s transfer list. */
export function jobTransferables(job: SeqJob): Transferable[] {
  const out: Transferable[] = [];
  for (const v of [job.bg, ...job.plates.flatMap((p) => [p.under, p.over])]) {
    if (isBitmap(v)) out.push(v);
  }
  return out;
}

/** Close every ImageBitmap a job carries (canvases are left alone). */
export function closeJobBitmaps(job: SeqJob): void {
  for (const v of [job.bg, ...job.plates.flatMap((p) => [p.under, p.over])]) {
    if (isBitmap(v)) { try { v.close(); } catch { /* already closed */ } }
  }
}

/**
 * Which of a layer's two plates a live re-capture is for (plans/104 section 5.2).
 *
 * `under` is the only slot for every kind but `video` - and it is the DEFAULT, so an
 * older caller (or a test stub) that ignores the argument answers the same shot it
 * always did.
 */
export type SeqLiveSlot = 'under' | 'over';

/** The host side of one run: where frames go, and how a live raster is fetched. */
export interface SeqJobIO {
  log?(level: string, msg: string): void;
  /** A composed frame is on the canvas. `tsUs` is its presentation time, µs. */
  frame(canvas: AnyCanvas, ctx: AnyCtx, i: number, tsUs: number): Promise<void>;
  /**
   * The live-DOM raster for a `needsLiveRaster` layer at this frame, or null to
   * fall back to the layer's static plate. Called at most once per layer per
   * SLOT per frame, and never concurrently - that IS the bounded queue.
   *
   * `slot` names which of the layer's two plates is being re-shot. Everything but a
   * video layer has one (`under`); a video layer is photographed twice - opaque with
   * the media hidden, then transparent - because the decoded frame is composited
   * BETWEEN them, and a size tween has to re-shoot both or the stale one ghosts.
   */
  lottieAt?(
    layerIdx: number, frameIndex: number, sourceSec: number, slot?: SeqLiveSlot,
  ): Promise<CanvasImageSource | null>;
  /** Release what `lottieAt` handed over (the worker closes a transferred bitmap). */
  releaseLottie?(img: CanvasImageSource): void;
  progress?(done: number, total: number): void;
  /** Polled once per frame; true tears the render down with SEQ_ABORTED. */
  aborted?(): boolean;
}

// ── per-layer resources ─────────────────────────────────────────────────────

interface LayerRes {
  under: CanvasImageSource | null;
  over: CanvasImageSource | null;
  provider: InstrumentedProvider | null;
  objectFit: string;
  objectPosition: string;
  /** Margin the plates above were captured with, stage-native px (SeqJobLayer.platePad). */
  platePad: number;
  /** Resolution multiplier over S the plates were captured at (SeqJobLayer.plateEff). */
  plateEff: number;
  /** The live raster for the frame being composed, when one was supplied (the `under` slot). */
  live: CanvasImageSource | null;
  /** The `over` slot's live raster - video only, where the media is composited between the two. */
  liveOver: CanvasImageSource | null;
  /** Output-grid frame indices this layer is on screen for, inclusive. */
  first: number;
  last: number;
  /** The source times the provider will be asked for, ascending (seconds). */
  span: number[];
  /** Counters copied off the provider just before it was disposed. */
  lastStats: ProviderStats | null;
  /** The length this clip's source CLAIMS, copied off the provider. */
  srcClaimedSec: number;
  /** This layer's cached filtered picture, or null (plans/104 P3.1) - see `fxPlateKey`. */
  fx?: FxPlate | null;
  /** The allowance every layer of this render shares. Absent = no caching at all. */
  fxBudget?: FxPlateBudget | null;
  /** True once the allowance refused this layer - asked ONCE, not once per frame. */
  fxRefused?: boolean;
}

// ── the fx-plate cache (plans/104 P3.1, failure 1) ──────────────────────────

/**
 * One layer's filtered picture, held across frames.
 *
 * `pad` is the scratch's own margin in SCRATCH px, kept beside the canvas because the
 * draw that places it back on the destination is expressed in terms of it.
 */
interface FxPlate {
  key: string;
  stage: BlurStage;
  pad: number;
  bytes: number;
}

/** The retained-bytes allowance one render's fx plates share, and what it refused. */
export interface FxPlateBudget {
  /**
   * The whole allowance. 0 means the cache is TURNED OFF, which is a different thing
   * from an allowance that ran out: an off cache refuses nothing and warns about
   * nothing (it is what a golden asks for when it wants the uncached path), while an
   * exhausted one is a cap and the no-silent-caps rule applies to it.
   */
  total: number;
  /**
   * Bytes still available to retain.
   *
   * Not a high-water mark: a layer whose key CHANGES (a DOF sigma that moved) hands its
   * old plate back before taking a new one, so one layer holds one plate for the whole
   * render.
   */
  remaining: number;
  /**
   * LAYERS that wanted a cached plate and could not have one, the number the single
   * warn line reports. Counted once per layer, never once per frame: a refusal is a
   * property of the render (this layer is too big for what is left), and re-asking on
   * every frame would report 120 refusals for one layer and re-price the same canvas
   * 120 times to reach the same answer.
   */
  refused: number;
}

/** A fresh allowance. `bytes` ≤ 0 disables the cache entirely (the tests' off switch). */
export function createFxPlateBudget(bytes: number): FxPlateBudget {
  const total = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  return { total, remaining: total, refused: 0 };
}

/** Hand ONE layer's cached plate back to the pool, and its bytes back to the allowance. */
function dropFxPlate(res: LayerRes): void {
  if (!res.fx) return;
  if (res.fxBudget) res.fxBudget.remaining += res.fx.bytes;
  releaseStage(res.fx.stage);
  res.fx = null;
}

/** Give back every cached plate this render is holding. */
export function releaseFxPlates(all: Iterable<LayerRes>): void {
  for (const r of all) if (r) dropFxPlate(r);
}

/**
 * The cache key for one layer's filtered picture at this instant, or null when the
 * picture is not the same picture every frame and must not be cached at all.
 *
 * WHY THIS EXISTS (plans/104 P3.1, measured failure 1). `drawItem`'s filtered path is
 * per-frame by construction: take a padded scratch, paint the plate into it, run it
 * through a blur lane, composite. That is right when the effect changes frame to
 * frame, and a depth shadow does not. section 5.3's shadow is derived from the box's `z`
 * alone, so for a layer at a fixed depth it is one filter over one unchanging plate,
 * re-computed for every frame of the export. A LIFTED layer makes that catastrophic
 * rather than merely wasteful: every derived document keeps the source's root
 * coordinates (section 7), so a lifted layer is a FULL-STAGE box and its `shadow: depth` is a
 * full-frame gaussian. Eleven of them at 960x540/30 measured 854 ms/frame against
 * 51 ms/frame with the shadows off, and on a slower machine the encoder's stall
 * watchdog fires first and the export ABORTS.
 *
 * So the filtered picture is rendered ONCE and re-composited per frame through the
 * transform, which is exactly what the plate itself already does. A shadow under a
 * uniform scale + translate scales WITH the layer, and the transform is applied to the
 * cached canvas by the identical `ctx.drawImage` the uncached path uses. The pixels are
 * therefore IDENTICAL, not approximated: this is a cache, not a lower-quality lane.
 *
 * WHAT THE KEY HAS TO COVER is everything that reaches the scratch, and nothing that
 * does not. `item.alpha`, `item.dx/dy`, `item.rot`, `item.scale` and `L.blend` are
 * written on the DESTINATION context outside the scratch, so a camera move changes none
 * of them here. What does reach it:
 *
 *   • the resolved box `bw`/`bh` - the radius clip is scaled against it;
 *   • the export scale `S` and the plate's own resolution multiplier `k`;
 *   • `fx.sigma` and `fx.rest` - the whole effect. A DOF blur under an animated
 *     APERTURE varies sigma per frame, which misses every frame and costs exactly what
 *     it costs today. That is correct and stated: the blur genuinely changed;
 *   • `pad`, which the two above already determine, keyed anyway because it is the
 *     number the composite draw is expressed in;
 *   • `clipsAfter` - whether the clip went on the destination or into the scratch.
 *
 * And the refusals, which are about the PICTURE rather than the effect. A `video`
 * layer has a decoded frame composited between its two plates; a `lottie` layer is
 * re-rasterised off a live player; a `w`/`h` tween is re-photographed at the size it is
 * at. In all three the content of the scratch is this frame's content, so there is
 * nothing to reuse. `res.live`/`res.liveOver` catch the same thing from the other side
 * - the frame loop sets them immediately before `drawItem` and clears them after - and
 * the plates a `static` layer draws from (`res.under`) are shot once, before the frame
 * loop, and never replaced.
 */
function fxPlateKey(
  item: PlanItem, res: LayerRes | undefined, S: number, k: number, fx: FxSpec,
  bw: number, bh: number, pad: number, clipsAfter: boolean,
): string | null {
  // `total`, not `remaining`: an exhausted allowance still has to REACH `adoptFxPlate`,
  // which is the one place a refusal is counted. Short-circuiting on the remaining
  // bytes here would make every layer after the one that filled it a silent cap.
  if (!res?.fxBudget || res.fxBudget.total <= 0 || res.fxRefused) return null;
  const kind = item.layer.kind;
  if (kind !== 'static') return null;                 // video / lottie: this frame's picture
  if (item.sized) return null;                        // a size tween re-photographs per frame
  if (res.live || res.liveOver || res.provider) return null;
  return `${bw}|${bh}|${S}|${k}|${fx.sigma}|${fx.rest}|${pad}|${clipsAfter ? 1 : 0}`;
}

/**
 * Retain `stage` as this layer's cached picture, or answer null when the render's
 * allowance cannot hold it (and then the caller releases it as usual - the layer just
 * pays the filter again next frame, at today's cost and today's pixels).
 */
function adoptFxPlate(
  res: LayerRes, key: string, stage: BlurStage, pad: number,
): BlurStage | null {
  const budget = res.fxBudget;
  if (!budget) return null;
  const bytes = Math.max(1, stage.canvas.width) * Math.max(1, stage.canvas.height) * 4;
  // The layer's PREVIOUS plate goes back first: a key change (a DOF sigma that moved,
  // a size that settled) must not make one layer hold two.
  dropFxPlate(res);
  if (bytes > budget.remaining) {
    // Once, and then never asked again for this layer (`fxRefused`): what is left of
    // the allowance only ever shrinks, so re-pricing the same canvas every frame would
    // reach the same answer 120 times and report it 120 times.
    budget.refused++;
    res.fxRefused = true;
    return null;
  }
  budget.remaining -= bytes;
  res.fx = { key, stage, pad, bytes };
  return stage;
}

// ── the executor ────────────────────────────────────────────────────────────

/**
 * The effects one plan item asks for, in DEVICE px, or null when the layer is CLEAN.
 *
 * CLEAN means: no blur of any kind (authored, keyframed or depth-of-field) and no
 * authored filter remainder. That is the byte-identity gate (plans/104 section 5.5): a clean
 * layer never enters the restructured path, never allocates a scratch, and issues the
 * exact canvas calls in the exact order it issued before this existed.
 *
 * `item.blur` is the planner's TOTAL blur at stage-native scale, so it is multiplied by
 * S here and nowhere else; the authored remainder (today: the `shadow` / `depth`
 * drop-shadow) is scaled the same way, because the plate it used to be baked into was
 * photographed at S.
 */
export function itemFx(item: PlanItem, S: number, cameraMoves = false): FxSpec | null {
  // The plate KEEPS its own filter unless this layer authored depth (`ownsLayerFx`,
  // and the plate loop shoots to the same predicate). Re-applying it here would then
  // be a second application: a shadow drawn twice, a blur squared. This is also the
  // byte-identity floor: a pre-104 `shadow: content` document never reaches the
  // restructured path at all.
  //
  // `cameraMoves` is the P1 obligation (plans/104 section 9.2): a camera that moves varies
  // eff and the depth-of-field radius frame by frame, and a plate is shot ONCE for the
  // whole render. So under a moving camera the compositor owns every projectable
  // layer's filter, including a flat one that authored no depth of its own. The three
  // obeying sites (plate pad, plate neutralisation, this) must be told the same thing,
  // or a plate is shot clean and then never re-filtered, or filtered twice.
  if (!ownsLayerFx(item.layer, cameraMoves)) return null;
  const rest = item.layer.shadowFilter;
  const sigma = item.blur > 0 ? item.blur * S : 0;
  if (!(sigma > 0) && !rest) return null;
  const scaled = scaleFilter(rest, S);
  return { sigma, rest: scaled.rest, shadows: scaled.shadows };
}

/**
 * Apply the layer's `clip-path` / `border-radius` to `ctx`, with the box's top-left at
 * `(ox, oy)`. False means the clip encloses nothing and the layer must not be drawn.
 *
 * Clips are authored against the UNSCALED box, so they are parsed there and scaled - a
 * `12px` radius must grow with the export, a `50%` must not drift.
 */
function clipLayer(
  ctx: AnyCtx, L: SeqLayer, ox: number, oy: number, w: number, h: number, S: number,
  bw = L.rect.w, bh = L.rect.h,
): boolean {
  if (L.clipPath) {
    // `bw`/`bh` are the layer's RESOLVED box, which is the authored rect unless the
    // track keyed `w`/`h` (section 5.2). Percentage clip shapes and percentage radii resolve
    // against the box the browser laid out, so under a size tween they have to resolve
    // against the tweened one - otherwise a `circle(50%)` stops being a circle exactly
    // when the box stops being its authored size.
    const shape = parseClipShape(L.clipPath, bw, bh);
    if (shape) {
      if (shape.kind === 'empty') return false;   // a well-formed clip enclosing nothing
      const p = new Path2D();
      if (shape.kind === 'circle') p.arc(ox + shape.cx * S, oy + shape.cy * S, shape.r * S, 0, Math.PI * 2);
      else if (shape.kind === 'ellipse') p.ellipse(ox + shape.cx * S, oy + shape.cy * S, shape.rx * S, shape.ry * S, 0, 0, Math.PI * 2);
      else if (shape.kind === 'inset') p.rect(ox + shape.x * S, oy + shape.y * S, shape.w * S, shape.h * S);
      else {
        shape.points.forEach(([px, py], i) => (i ? p.lineTo(ox + px * S, oy + py * S) : p.moveTo(ox + px * S, oy + py * S)));
        p.closePath();
      }
      ctx.clip(p);
    }
  } else if (L.radius) {
    const r = radiiOf(L.radius, bw, bh).map((v) => v * S) as [number, number, number, number];
    if (r.some((v) => v > 0)) {
      const p = new Path2D();
      p.roundRect(ox, oy, w, h, r);
      ctx.clip(p);
    }
  }
  return true;
}

/**
 * Paint the layer's picture into `ctx` with the box's top-left at `(ox, oy)`.
 *
 * `pp` is the plate's own capture margin in DEVICE px: a plate shot with `pad` has its
 * origin at `(-pad, -pad)` in box space and is `2·pad` bigger on each axis, so every
 * plate draw subtracts it and adds twice it. At pp = 0 - every P0 export - the four
 * expressions evaluate to the identical numbers the un-padded draws used.
 *
 * THE LIVE RASTER OUTRANKS THE PLATE ON EVERY KIND (plans/104 section 5.2). It is asked for by
 * a mounted Lottie player OR by a `w`/`h` tween, and a size tween is answered by a
 * re-photograph of the box laid out at the tweened size - the whole point being that
 * text REFLOWS. Reading it only in the `lottie` branch (which is what shipped) paid for
 * that shot per frame and then drew the authored-size plate STRETCHED to the tweened
 * rect: a rewrapped paragraph scaled instead, a 1 px border four px wide at w×4. The
 * kinds the size channel exists for - `static` (a text box is one) and `video` - are
 * exactly the ones that were dropping it.
 */
async function paintLayer(
  ctx: AnyCtx, item: PlanItem, res: LayerRes | undefined,
  ox: number, oy: number, w: number, h: number, pp: number,
): Promise<void> {
  const L = item.layer;
  const px = ox - pp;
  const py = oy - pp;
  const pw = w + pp * 2;
  const ph = h + pp * 2;

  if (L.kind === 'lottie') {
    if (res?.live) ctx.drawImage(res.live, px, py, pw, ph);
    else if (res?.under) ctx.drawImage(res.under, px, py, pw, ph);
    return;
  }

  if (L.kind === 'video') {
    // Background + anything painted UNDER the media, then the frame, then the
    // box's own text back on top (the DOM order the preview paints in). BOTH plates
    // are re-shot live under a size tween - they are one box photographed twice
    // (opaque with the media hidden, then transparent), so a stale `over` would ghost
    // its text over the reflowed copy in `under`.
    const under = res?.live ?? res?.under;
    const over = res?.liveOver ?? res?.over;
    if (under) ctx.drawImage(under, px, py, pw, ph);
    if (res?.provider && item.sourceSec != null) {
      const f = fitRect(res.objectFit || 'contain', res.objectPosition || '', res.provider.w, res.provider.h, w, h);
      await res.provider.drawAt(ctx, item.sourceSec, { dx: ox + f.x, dy: oy + f.y, dw: f.w, dh: f.h });
    }
    if (over) ctx.drawImage(over, px, py, pw, ph);
    return;
  }

  if (res?.live) ctx.drawImage(res.live, px, py, pw, ph);
  else if (res?.under) ctx.drawImage(res.under, px, py, pw, ph);
}

/**
 * Draw ONE plan item. No decisions live here beyond "how do I express this on a
 * canvas" - activity, alpha, rotation, blur and source time all arrive decided.
 *
 * The transform order reproduces sequence-clock's composed CSS transform exactly:
 * `translate(anim) → rotate(authored + anim) → scale(anim)` about the box centre,
 * which is the same matrix the preview builds and the same one renderRecord's
 * drawObject issues.
 *
 * TWO PATHS, AND WHICH ONE A LAYER TAKES IS THE POINT (plans/104 section 5.5).
 *
 *  • CLEAN (the compositor owns no effect here): clip into the destination and draw.
 *    Byte for byte the path this function has always taken. `itemFx` returning null is
 *    the only gate, and it asks `ownsLayerFx` FIRST - a layer with no depth keeps its
 *    filter on its plate, exactly as every pre-104 `shadow: content` document did.
 *
 *  • FILTERED: clip the content into a PADDED scratch, run the scratch through a blur
 *    lane, composite the result. The order matters and it is the DOM's: a radius clips
 *    the CONTENT and the filter applies to the clipped result - so a blurred rounded
 *    box spills softly OUTSIDE its radius - while a `clip-path` applies to the FILTER
 *    OUTPUT, so its blur and drop-shadow are cut off at the path. Clipping everything
 *    at the destination first (what this function used to do) shaved the radius case's
 *    spill straight off at the moment the blur produced it; clipping nothing at the
 *    destination let the clip-path case's spill escape a boundary the browser cuts.
 *
 * The scratch also solves a subtler problem: a blur applied INSIDE `ctx.scale(eff)` is
 * interpreted in user space by some engines and device space by others. Blurring at
 * plate resolution under identity and drawing the result through the transform is one
 * answer on every engine - and it is CSS's answer, where `filter` applies in the
 * element's own box and `transform` magnifies what comes out.
 */
export async function drawItem(
  ctx: AnyCtx, item: PlanItem, res: LayerRes | undefined, S: number, cameraMoves = false,
): Promise<void> {
  const L = item.layer;
  // Timeline citizens with no picture: an audio bed, and (plans/104 section 5.4) a camera
  // marker, which carries a pose rather than pixels. Neither is given a plate, and
  // neither may leave one behind here either.
  if (L.kind === 'audio' || L.kind === 'camera') return;
  if (item.alpha <= 0) return;
  // The RESOLVED box (section 5.2): the authored rect unless the track keyed `w`/`h`. Equal
  // to `L.rect.w/h` on every layer that keyframes no size, so every expression below is
  // the one that shipped - and a sized layer grows from its top-left, exactly as the
  // reflowed DOM does, because `rect.x/y` is still the origin and the centre moved by
  // half the growth inside the fold.
  // `item.sized` is the authority, not `item.w > 0`: a track may legitimately key a
  // size to ZERO (a box that collapses away), and reading that as "absent" would draw
  // it at its authored size instead of not at all. The fallback is for a PlanItem built
  // before these fields existed, or by hand.
  const bw = item.sized ? item.w : (Number.isFinite(item.w) && item.w > 0 ? item.w : L.rect.w);
  const bh = item.sized ? item.h : (Number.isFinite(item.h) && item.h > 0 ? item.h : L.rect.h);
  const w = bw * S;
  const h = bh * S;
  if (w <= 0 || h <= 0) return;
  const pp = (res?.platePad ?? 0) * S;

  ctx.save();
  try {
    ctx.globalAlpha = clamp01(item.alpha);
    if (L.blend && BLEND_OPS.has(L.blend)) ctx.globalCompositeOperation = L.blend as GlobalCompositeOperation;
    ctx.translate((L.rect.x + bw / 2) * S + item.dx * S, (L.rect.y + bh / 2) * S + item.dy * S);
    if (item.rot) ctx.rotate((item.rot * Math.PI) / 180);
    if (item.scale !== 1) ctx.scale(item.scale, item.scale);

    const ox = -w / 2;
    const oy = -h / 2;
    // THE SCRATCH'S OWN RESOLUTION, over S. The plate was captured at `S·plateEff` - 
    // the budget bought that resolution precisely so a flown-past layer is not a
    // blown-up S-resolution plate - and this layer lands on the destination magnified
    // by `item.scale`, which carries eff. A scratch sized in S px resamples the plate
    // DOWN to S, blurs it there, and then lets the transform blow the result back up:
    // the bought pixels thrown away on exactly the layers (lifted, depth-shadowed)
    // that paid for them. So the scratch is the PLATE's resolution.
    //
    // The plate's, rather than `min(item.scale, plateEff)` - which would be the
    // tightest allocation frame by frame, and would resize the pooled scratch on every
    // one of them, which is the exact cost the pool exists to avoid. `plateEff` is
    // already the bucketed window maximum, so this is one size per layer per render.
    // 1 on every flat layer, which is the byte-identity floor: at k = 1 every
    // expression below is the one that shipped.
    const k = Math.max(1, res?.plateEff ?? 1);
    const fx = itemFx(item, S * k, cameraMoves);

    if (!fx) {
      if (!clipLayer(ctx, L, ox, oy, w, h, S, bw, bh)) return;
      await paintLayer(ctx, item, res, ox, oy, w, h, pp);
      return;
    }

    // WHERE THE CLIP GOES, and the two answers are not the same (Filter Effects section 5 /
    // CSS Masking): `border-radius` clips the element's own content, and the filter
    // then applies to that - soft spill escapes the radius. `clip-path` applies to the
    // FILTER OUTPUT - the browser cuts the blur and the drop-shadow off at the path.
    // The DOM evaluator writes `filter` on the element and gets the browser's order
    // for free, so the canvas has to reproduce both or preview and export disagree for
    // every clip-path'd blurred box. (The plate itself already carries the clip - 
    // dom-to-image copies `clip-path` onto its clone - so this is about the SPILL, not
    // about the picture.) Taken FIRST so an empty clip costs no scratch at all.
    const clipsAfter = !!L.clipPath;
    if (clipsAfter && !clipLayer(ctx, L, ox, oy, w, h, S, bw, bh)) return;

    const sw = w * k;
    const sh = h * k;
    const ppk = pp * k;
    // The scratch's margin, in the scratch's own px. Never less than the PLATE's own
    // margin: the plate is drawn `ppk` outside the box on each side, and a scratch
    // narrower than that would clip the padded capture away before the blur ever saw
    // it. Never more than `scratchPadCap` allows, either: an authored 300 px blur asks
    // for a 4880×4320 scratch (21 Mpx, ~84 MB, and `renderFx` holds three or four at
    // once) that the plate budget never sees, and `takeStage` answering null means the
    // layer is drawn UNFILTERED - worse than a spill clipped a long way out.
    const pad = Math.max(
      Math.ceil(ppk),
      Math.min(spillPad(fx.sigma, fx.shadows), scratchPadCap(Math.ceil(sw), Math.ceil(sh))),
    );

    // THE CACHED PICTURE (plans/104 P3.1) - see `fxPlateKey` for what the key covers
    // and why a hit is pixel-identical rather than an approximation. A miss falls
    // straight through to the path below, which is the path that always ran.
    const cacheKey = fxPlateKey(item, res, S, k, fx, bw, bh, pad, clipsAfter);
    // A layer that has STOPPED being cacheable (a `w`/`h` tween that started, a live
    // raster that arrived) is holding a plate nothing will ask for again. Give it back
    // now rather than at the end of the render - the allowance is shared.
    if (!cacheKey && res?.fx) dropFxPlate(res);
    const cached = cacheKey && res?.fx?.key === cacheKey ? res.fx : null;
    if (cached) {
      ctx.drawImage(
        cached.stage.canvas as CanvasImageSource,
        ox - cached.pad / k, oy - cached.pad / k,
        cached.stage.canvas.width / k, cached.stage.canvas.height / k,
      );
      return;
    }

    const stage = takeStage(Math.ceil(sw) + pad * 2, Math.ceil(sh) + pad * 2);
    if (!stage) {
      // No canvas in this realm (bare Node, a refused allocation). Draw the picture
      // sharp rather than not at all: a visibly un-softened layer beats a missing one.
      if (!clipsAfter && !clipLayer(ctx, L, ox, oy, w, h, S, bw, bh)) return;
      await paintLayer(ctx, item, res, ox, oy, w, h, pp);
      return;
    }

    let out: BlurStage | null = null;
    /** The one scratch the cache adopted, which must NOT go back to the pool. */
    let kept: BlurStage | null = null;
    try {
      stage.ctx.save();
      stage.ctx.translate(pad, pad);
      const visible = clipsAfter || clipLayer(stage.ctx, L, 0, 0, sw, sh, S * k, bw, bh);
      if (visible) await paintLayer(stage.ctx, item, res, 0, 0, sw, sh, ppk);
      stage.ctx.restore();
      if (!visible) return;
      out = renderFx(stage.canvas, fx, laneFor(ctx));
      // The scratch maps 1:1 onto its own px, so drawing it at `size / k` in this
      // (already `item.scale`-scaled) space puts the content back at exactly
      // (ox, oy, w, h) with the spill around it - at k = 1, the identical four numbers
      // the un-scaled draw always used.
      ctx.drawImage(
        (out?.canvas ?? stage.canvas) as CanvasImageSource,
        ox - pad / k, oy - pad / k, stage.canvas.width / k, stage.canvas.height / k,
      );
      // …and keep it, so the next frame re-composites this exact canvas instead of
      // re-running the filter over it. `renderFx` hands back a canvas of the SAME
      // dimensions as its source, so the draw above is the draw a hit repeats.
      //
      // ONLY when it actually produced one. `renderFx` answers null on a refused
      // allocation, and the draw above then puts the UNFILTERED picture down - right for
      // one frame (a visibly un-softened layer beats a missing one), wrong to latch for
      // the whole render. Not caching it is what makes the next frame try again.
      if (cacheKey && res && out) kept = adoptFxPlate(res, cacheKey, out, pad);
    } finally {
      if (out && out !== kept) releaseStage(out);
      releaseStage(stage);
    }
  } finally {
    ctx.restore();
  }
}

/**
 * Compose every frame of `job` onto `ctx`, handing each one to `io.frame`.
 *
 * This is the ENTIRE frame loop for every output format and both threads. It
 * opens a clip's decoder at its first active frame and disposes it at its last,
 * runs the silent-truncation reconciliation once every provider has finished,
 * and guarantees no decoder outlives the call.
 */
export async function runSequenceJob(job: SeqJob, canvas: AnyCanvas, ctx: AnyCtx, io: SeqJobIO): Promise<void> {
  const log = (l: string, m: string): void => io.log?.(l, m);
  const layers = job.layers.map(hydrateJobLayer);
  const wireOf = new Map(job.layers.map((w) => [w.idx, w]));
  const clipOf = new Map(job.clips.map((c) => [c.idx, c.src]));
  const plateOf = new Map(job.plates.map((p) => [p.idx, p]));
  const S = job.scale;
  // The stage the planner projects through, and the cameras on it. The cameras are
  // DERIVED from the very layers that just crossed the wire (`stageCameras`) rather
  // than sent as a second field: the main thread derives them from the same function
  // over the same `kind`/`z`/`kf`, so the two threads cannot be handed different
  // cameras for the same stage - the property the worker-vs-in-thread sha identity
  // test exists to protect. With no camera box this resolves to the DEFAULT camera for
  // every frame, which is not an identity: it is what makes a lifted layer read as
  // lifted (plans/104 section 5.4).
  const cameras = stageCameras(layers);
  const env = { stageW: job.stageW ?? 0, stageH: job.stageH ?? 0, cameras };
  // Asked ONCE for the whole render, because a plate is shot once for the whole render
  // (section 5.5 / the P1 obligation). See `itemFx`.
  const camMoves = camerasMove(cameras);

  const ext = new Map(crossfadeJunctions(layers).map((j) => [j.aIdx, j.ms]));
  // The fx-plate allowance every layer shares (plans/104 P3.1). A render with no
  // compositor-owned filter never touches it, so nothing before this feature can
  // notice it exists; `job.fxCacheBytes` is the seam the tests turn it off through.
  const fxBudget = createFxPlateBudget(
    Number.isFinite(job.fxCacheBytes) ? (job.fxCacheBytes as number) : fxCacheBudgetBytes(),
  );
  const res = new Map<number, LayerRes>();
  for (const L of layers) {
    const win = activeFrameWindow(L, job.grid, ext.get(L.idx) ?? 0);
    const w = wireOf.get(L.idx);
    const plate = plateOf.get(L.idx);
    res.set(L.idx, {
      under: plate?.under ?? null,
      over: plate?.over ?? null,
      provider: null,
      objectFit: w?.objectFit ?? '',
      objectPosition: w?.objectPosition ?? '',
      platePad: Number.isFinite(w?.platePad) ? (w?.platePad as number) : 0,
      plateEff: Number.isFinite(w?.plateEff) && (w?.plateEff as number) > 0 ? (w?.plateEff as number) : 1,
      live: null,
      liveOver: null,
      first: win.first, last: win.last, span: win.span,
      lastStats: null, srcClaimedSec: 0,
      fx: null,
      fxBudget,
    });
  }

  const openProviders = new Set<InstrumentedProvider>();
  const disposeAll = async (): Promise<void> => {
    for (const p of [...openProviders]) { try { await p.dispose(); } catch { /* already gone */ } }
    openProviders.clear();
  };

  /** Fail rather than hang: a decoder that has gone quiet cannot be un-stuck. */
  const watchdog = async <T>(p: Promise<T>, label: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        p,
        new Promise<never>((_, rej) => {
          timer = setTimeout(() => rej(sequenceError('SEQ_ABORTED', `sequence export stalled: ${label} made no progress for ${job.watchdogMs / 1000}s`)), job.watchdogMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  try {
    for (let i = 0; i < job.frameCount; i++) {
      if (io.aborted?.()) throw sequenceError('SEQ_ABORTED', 'sequence export cancelled');
      const t = job.grid[i] as number;
      await watchdog(composeFrame(i, t), `frame ${i + 1}/${job.frameCount}`);
      await watchdog(io.frame(canvas, ctx, i, Math.round((i * 1e6) / job.fps)), `encode ${i + 1}/${job.frameCount}`);
      io.progress?.(i + 1, job.frameCount);
    }
    // Every provider has finished; only now is a shortfall meaningful.
    reconcileProviders(layers, res, job.fps, log);
  } finally {
    await disposeAll();
    // The NO-SILENT-CAPS rule, applied to the fx-plate allowance: a layer that could
    // not keep its filtered picture re-rendered it every frame, which is slower by a
    // lot and identical to the pixel - worth one line, never more than one.
    if (fxBudget.refused > 0) {
      log('warn', `sequence: ${fxBudget.refused} depth layer(s) did not fit the ${Math.round(fxBudget.remaining / (1024 * 1024))}MB remaining of the cached-shadow allowance - those layers re-rendered their filter on every frame. Output is unchanged; the export was slower.`);
    }
    // Give the cached fx plates back BEFORE the pool is dropped - they came out of it,
    // and a render that has finished has no next frame to hold them for.
    releaseFxPlates(res.values());
    // The blur lanes pool their scratches across frames, which is the whole reason a
    // 300-frame export does not spend itself in the allocator - but a FINISHED export
    // has no next frame, and holding plate-sized canvases warm for one is just a leak
    // with good manners. No-op on a render that never blurred anything.
    releaseBlurScratches();
  }

  /** Paint the whole stage at `t`, opening/closing providers on their edges. */
  async function composeFrame(i: number, t: number): Promise<void> {
    // Providers are created at a clip's FIRST active frame and disposed at its
    // last, so a 12-clip sequence never has 12 decoders open.
    for (const L of layers) {
      if (L.kind !== 'video') continue;
      const r = res.get(L.idx)!;
      if (i !== r.first || r.provider) continue;
      const src = clipOf.get(L.idx);
      if (!src) continue;
      if (openProviders.size >= job.maxLiveProviders) {
        throw sequenceError('SEQ_TOO_HEAVY', `more than ${job.maxLiveProviders} video clips are decoding at once`);
      }
      const p = await createVideoProvider(src, { log });
      openProviders.add(p);
      r.provider = p;
      r.srcClaimedSec = p.stats().claimedDurationSec;
      if (r.span.length) p.prime?.(r.span);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, job.outW, job.outH);
    // THE BACKGROUND IS AN IMPLICIT z = 0 LAYER (plans/104 section 5.5). Untransformed it would
    // be frozen wallpaper the whole composition slides across under a pan - the opposite
    // of a camera move - so it goes through the same `projectLayer` every other layer
    // does, anchored on the stage centre, and is drawn from a plate captured with
    // `bgPad` of overscan so the reveal has artboard in it rather than a hard edge.
    // With no camera the projection is an exact identity and this is the one-line draw
    // it has always been, on the same plate it has always been.
    if (job.bg) {
      const bgPad = Number.isFinite(job.bgPad) && (job.bgPad as number) > 0 ? (job.bgPad as number) : 0;
      if (!camMoves && bgPad === 0) {
        ctx.drawImage(job.bg, 0, 0, job.outW, job.outH);
      } else {
        const view = planCameraView(env, t);
        const proj = projectLayer(view, { bx: view.w / 2, by: view.h / 2, z: 0 });
        // THE PLATE'S OWN SIZE, and the STAGE's own centre - never the canvas's.
        // `outW/outH` are the ENCODER's dimensions (`Math.round(…) & ~1`, forced even for
        // the video codecs) while the plate is `Math.round((native + 2·bgPad)·S)` and every
        // layer above is placed in native·S space. Deriving the draw from `outW` therefore
        // assumed `outW === nativeW·S`, which the even-rounding breaks by up to ~2 px - a
        // static stretch nobody could see while the bg was untransformed, but a sub-pixel
        // drift of the background AGAINST the layers the moment the camera moves.
        const plate = job.bg as { width?: number; height?: number };
        const cx = ((job.stageW as number) > 0 ? (job.stageW as number) * S : job.outW) / 2;
        const cy = ((job.stageH as number) > 0 ? (job.stageH as number) * S : job.outH) / 2;
        const dw = Number.isFinite(plate.width) && (plate.width as number) > 0
          ? (plate.width as number) : cx * 2 + bgPad * 2 * S;
        const dh = Number.isFinite(plate.height) && (plate.height as number) > 0
          ? (plate.height as number) : cy * 2 + bgPad * 2 * S;
        ctx.save();
        try {
          ctx.globalAlpha = clamp01(proj.alphaGuard);
          ctx.translate(cx + proj.dx * S, cy + proj.dy * S);
          if (proj.scale !== 1) ctx.scale(proj.scale, proj.scale);
          // The plate's origin is `(-bgPad, -bgPad)` in stage px, so the stage centre sits
          // `bgPad·S + cx` in from its left edge - the offset that puts it on the origin.
          ctx.drawImage(job.bg, -(bgPad * S + cx), -(bgPad * S + cy), dw, dh);
        } finally {
          ctx.restore();
        }
      }
    }

    const plan = sequenceDrawPlan(layers, t, job.totalMs, env);
    // The live-DOM rasters for this frame, fetched BEFORE any drawing so the
    // request/response hop overlaps nothing and stays strictly one-at-a-time.
    const taken: { r: LayerRes; slot: SeqLiveSlot; img: CanvasImageSource }[] = [];
    try {
      if (io.lottieAt) {
        for (const item of plan) {
          const w = wireOf.get(item.layer.idx);
          // A LIVE re-capture is asked for by the wire flag (a mounted Lottie player)
          // OR by the frame itself: a layer whose `w`/`h` are being tweened has to be
          // re-photographed at the size it is at, because a stretched plate is a
          // stretched picture and the preview REFLOWS (section 5.2). `sourceSec` is no longer
          // part of the gate - a static box has none, and needing a size is not needing
          // a source time.
          if (!w?.needsLiveRaster && !item.sized) continue;
          const r = res.get(item.layer.idx);
          if (!r) continue;
          // A video layer's picture is TWO plates with the decoded frame between them,
          // so a size tween re-shoots both; every other kind has only `under`.
          const slots: SeqLiveSlot[] = item.layer.kind === 'video' && r.over ? ['under', 'over'] : ['under'];
          for (const slot of slots) {
            const img = await watchdog(
              io.lottieAt(item.layer.idx, i, item.sourceSec ?? 0, slot),
              `live raster ${i + 1}/${job.frameCount}`,
            );
            if (!img) continue;
            if (slot === 'over') r.liveOver = img; else r.live = img;
            taken.push({ r, slot, img });
          }
        }
      }
      for (const item of plan) await drawItem(ctx, item, res.get(item.layer.idx), S, camMoves);
    } finally {
      for (const { r, slot, img } of taken) {
        if (slot === 'over') r.liveOver = null; else r.live = null;
        io.releaseLottie?.(img);
      }
    }

    for (const L of layers) {
      if (L.kind !== 'video') continue;
      const r = res.get(L.idx)!;
      if (i === r.last && r.provider) {
        const p = r.provider;
        r.lastStats = p.stats();          // the only evidence the truncation guard gets
        r.provider = null;
        openProviders.delete(p);
        await p.dispose().catch(() => {});
      }
    }
  }
}

// ── truncation reconciliation (spike rule 7) ────────────────────────────────

/**
 * Did every clip actually answer the requests we made of it?
 *
 * A truncated container decodes a clean, short iteration with no error, so the only
 * evidence is arithmetic. Getting the arithmetic right means reconciling the
 * provider's ANSWERS against its own REQUESTS, in the SOURCE's time domain, with
 * four corrections that each turned a healthy export into a false SEQ_TRUNCATED:
 *
 *  • speed. The span is in source seconds and a speed-s clip walks it s times
 *    faster than the output grid, so the sampling rate is `fps / speed`, not `fps`.
 *  • requests, not draws. `decoded` counts DRAWS, and the compositor skips them for
 *    a transparent or zero-size box (a hidden clip kept only for its audio draws
 *    nothing at all, and every fade's first frame has alpha exactly 0).
 *  • the source's own end. A clip may be trimmed longer than its media, and a
 *    crossfade tail deliberately samples past the out-point; those requests can
 *    never be answered and are not evidence of anything.
 *  • PTS granularity. `lastSourceSec` is the decoded sample's presentation time,
 *    which lags the request by up to one SOURCE frame - 83 ms on a 12 fps screen
 *    recording, against a tolerance that would otherwise be 67 ms.
 */
function reconcileProviders(
  layers: SeqLayer[], res: Map<number, LayerRes>, fps: number, log: (l: string, m: string) => void,
): void {
  for (const L of layers) {
    if (L.kind !== 'video') continue;
    const r = res.get(L.idx);
    if (!r || !r.span.length) continue;
    const s = r.provider?.stats() ?? r.lastStats;
    if (!s) continue;
    if (!s.requests) {
      log('info', 'sequence: a clip was never asked for a frame (invisible or zero-size) - nothing to reconcile.');
      continue;
    }
    const srcFps = fps / (Number.isFinite(L.speed) && L.speed > 0 ? L.speed : 1);
    const from = s.firstRequestSec >= 0 ? s.firstRequestSec : (r.span[0] as number);
    // What the source could actually have answered: our last request, but never
    // past the media's own end.
    const dur = r.srcClaimedSec > 0 ? r.srcClaimedSec : 0;
    const askedEnd = s.lastRequestSec >= 0 ? s.lastRequestSec : (r.span[r.span.length - 1] as number);
    const reachEnd = dur > 0 ? Math.min(askedEnd, dur) : askedEnd;
    const expected = Math.max(0, reachEnd - from) + 1 / srcFps;
    const check = reconcileDecoded({
      expectedSec: expected,
      decodedFrames: s.decoded,
      lastTsSec: Math.max(0, s.lastSourceSec - from),
      fps: srcFps,
      requestedFrames: s.requests,
      unreachableFrames: s.unreachable,
      sourceFrameSec: s.sourceFrameSec,
    });
    if (!check.ok) {
      throw sequenceError('SEQ_TRUNCATED', `a clip decoded ${check.shortfallSec.toFixed(2)}s short of its ${expected.toFixed(2)}s span - the source file looks truncated`);
    }
    log('info', `sequence: clip answered ${s.decoded}/${s.requests} requests (${s.missed} missed, ${s.unreachable} past its end, ${s.randomAccess ? 'random access' : 'primed'})`);
  }
}

// ── the message protocol (mirrors video-encode.worker.ts's shape) ───────────

/** Planar PCM for the mix, already rendered by the main thread's OfflineAudioContext. */
export interface SeqWorkerAudio {
  codec: string;
  muxCodec: string;
  sampleRate: number;
  numberOfChannels: number;
  bitrate: number;
  /** One Float32Array per channel; TRANSFERRED, so the sender loses them. */
  channels: Float32Array[];
  /** Sample frames per channel. */
  length: number;
}

export interface SeqWorkerStart {
  type: 'start';
  id: number;
  job: SeqJob;
  pick: EncodePick;
  bitrate: number;
  audio: SeqWorkerAudio | null;
}
/** The main thread's answer to `need-live`; `bitmap` null means "use the static plate". */
export interface SeqWorkerLive { type: 'live'; id: number; token: number; bitmap: ImageBitmap | null }
export interface SeqWorkerAbortMsg { type: 'abort'; id: number }
export type SeqWorkerIn = SeqWorkerStart | SeqWorkerLive | SeqWorkerAbortMsg;

export interface SeqWorkerNeedLive {
  type: 'need-live'; id: number; token: number; layerIdx: number; frame: number; sourceSec: number;
  /** Which plate is being re-shot; absent means `under`, the only slot a non-video layer has. */
  slot?: SeqLiveSlot;
}
export interface SeqWorkerProgress { type: 'progress'; id: number; done: number; total: number }
export interface SeqWorkerLog { type: 'log'; id: number; level: string; msg: string }
export interface SeqWorkerDone { type: 'done'; id: number; buffer: ArrayBuffer; mime: string }
/**
 * A failed run.
 *
 * `offload` is the whole reason this is not just a coded error. The renderer's
 * fallback rule is "a CODED failure is the render's verdict; anything else is the
 * offload itself failing, so retry in-thread" - and `toCodedError` has no uncoded
 * outcome, so a protocol that carried only a code would classify EVERY worker-side
 * infrastructure failure as a verdict and make the in-thread fallback unreachable
 * for anything but a spawn error. Two things set it:
 *
 *   • an uncoded throw (`!(err instanceof SequenceError)`) - the same test the
 *     in-thread caller applies, evaluated where the throw actually happened;
 *   • a coded error explicitly tagged `offload` by code that KNOWS it only failed
 *     because it is in a worker. There is exactly one today: the element-seek
 *     provider, the last rung of the provider ladder, which needs a `<video>` and
 *     therefore cannot run here. A clip mediabunny declines (an exotic container,
 *     a codec with no hardware decoder) is decodable in-thread and must not be
 *     reported as an unsupported-media verdict just because the worker tried first.
 */
export interface SeqWorkerFail { type: 'error'; id: number; code: string; message: string; offload: boolean }
export type SeqWorkerOut = SeqWorkerNeedLive | SeqWorkerProgress | SeqWorkerLog | SeqWorkerDone | SeqWorkerFail;

/** Planar channels → the structural PCM source `StreamingMux.addAudio` consumes. */
export function pcmSourceOf(a: SeqWorkerAudio): PcmSource {
  return {
    length: a.length,
    numberOfChannels: a.numberOfChannels,
    getChannelData: (ch: number): Float32Array => a.channels[Math.min(ch, a.channels.length - 1)] ?? new Float32Array(a.length),
  };
}

/**
 * Run one `start` message to completion. Exported so a test can drive the whole
 * worker body against a stub port without spawning a Worker.
 */
export async function handleStart(
  msg: SeqWorkerStart,
  port: { post(m: SeqWorkerOut, transfer?: Transferable[]): void },
  ctl: { aborted(): boolean; awaitLive(token: number): Promise<ImageBitmap | null> },
  deps: {
    makeCanvas?: (w: number, h: number) => AnyCanvas;
    makeMux?: (pick: EncodePick, o: { width: number; height: number; fps: number; bitrate: number; audio: EncodeAudio | null; target?: 'buffer' | 'opfs' }) => Promise<StreamingMux>;
  } = {},
): Promise<void> {
  const { id, job, pick } = msg;
  // EVERY exit from here on must close the transferred plates. They are the job's
  // only owner in this thread - the main thread's copies were detached by the
  // transfer - and at 1080p a ten-layer job is ~170 MB of native bitmap memory
  // that nothing else will ever reclaim. The outermost try is what guarantees it
  // covers the canvas, the context and the muxer construction too, all three of
  // which can throw before a frame is ever composed.
  try {
    await runOneJob();
  } finally {
    closeJobBitmaps(job);
  }

  async function runOneJob(): Promise<void> {
  const canvas = (deps.makeCanvas ?? ((w, h) => new OffscreenCanvas(w, h)))(job.outW, job.outH);
  const ctx = (canvas as OffscreenCanvas).getContext('2d', { alpha: true }) as AnyCtx | null;
  if (!ctx) throw sequenceError('SEQ_DECODE_FAILED', 'no 2D context for the sequence canvas');

  const audio = msg.audio;
  const mux = await (deps.makeMux ?? createStreamingMux)(pick, {
    width: job.outW, height: job.outH, fps: job.fps, bitrate: msg.bitrate,
    audio: audio ? { ...audio, channels: [] } : null,
    // plans/156 WP-A part 3: long exports stream to OPFS - keyed on job.frameCount, the
    // SAME number sequence-render.ts gates its in-thread mux on, so worker == in-thread.
    target: streamMuxTargetFor(job.frameCount),
  });

  let token = 0;
  let ok = false;
  try {
    await runSequenceJob(job, canvas, ctx, {
      log: (level, m) => port.post({ type: 'log', id, level, msg: m }),
      aborted: () => ctl.aborted(),
      progress: (done, total) => port.post({ type: 'progress', id, done, total }),
      frame: (c, _ctx2, _i, tsUs) => mux.addFrame(c as CanvasImageSource, tsUs),
      lottieAt: async (layerIdx, frame, sourceSec, slot) => {
        const tk = ++token;
        port.post({ type: 'need-live', id, token: tk, layerIdx, frame, sourceSec, ...(slot ? { slot } : {}) });
        return await ctl.awaitLive(tk);
      },
      releaseLottie: (img) => { try { (img as ImageBitmap).close?.(); } catch { /* not a bitmap */ } },
    });
    if (audio) await mux.addAudio(pcmSourceOf(audio));
    const blob = await mux.finalize();
    ok = true;
    const buffer = await blob.arrayBuffer();
    port.post({ type: 'done', id, buffer, mime: blob.type }, [buffer]);
  } finally {
    if (!ok) { try { await mux.abort(); } catch { /* already down */ } }
  }
  }
}

/**
 * Is this throw the offload failing, or the render's verdict?
 *
 * Deliberately the SAME test `sequence-render.ts` applies to an in-thread throw
 * (`err instanceof SequenceError`), evaluated in the worker where the throw
 * happened - plus the explicit tag for a coded error that only exists because
 * this is a worker. See `SeqWorkerFail.offload`.
 */
export function isOffloadFailure(err: unknown): boolean {
  if (err instanceof SequenceError) {
    return (err as { offload?: unknown }).offload === true;
  }
  return true;
}

// ── per-run control state ───────────────────────────────────────────────────

/** The two things `handleStart` needs from its host: am I cancelled, and the raster. */
export interface RunControls { aborted(): boolean; awaitLive(token: number): Promise<ImageBitmap | null> }

/**
 * Run-scoped abort flags and live-raster waiters.
 *
 * EXTRACTED FROM THE WORKER ENTRY SO IT CAN BE TESTED. The client mints a fresh
 * run id per call and keeps its runs in a Map with no single-flight guard, so two
 * exports CAN overlap. A single-slot worker turns that into two silent
 * corruptions, and only one of them is even an error:
 *
 *   • the second `start` clears the first run's pending live-raster resolver, so
 *     run 1's `awaitLive` never settles, its watchdog fires, and a healthy export
 *     dies with SEQ_ABORTED;
 *   • both runs mint tokens 1, 2, 3… into the same waiter map, so run 2's reply
 *     resolves run 1's waiter and run 1 composites RUN 2's lottie frame into its
 *     own picture - a wrong-pixels export with no error anywhere.
 *
 * Keying every piece of state by run id is what makes the runs independent.
 */
export function createRunRegistry() {
  interface Run { aborted: boolean; waiters: Map<number, (b: ImageBitmap | null) => void> }
  const runs = new Map<number, Run>();
  return {
    /** Open a run and hand back the controls `handleStart` consumes. */
    begin(id: number): RunControls {
      const run: Run = { aborted: false, waiters: new Map() };
      runs.set(id, run);
      return {
        aborted: () => run.aborted,
        awaitLive: (token) => new Promise<ImageBitmap | null>((resolve) => {
          if (run.aborted) { resolve(null); return; }
          run.waiters.set(token, resolve);
        }),
      };
    },
    /** Cancel ONE run, unblocking whatever it is waiting for. */
    abort(id: number): void {
      const run = runs.get(id);
      if (!run) return;
      run.aborted = true;
      for (const [, resolve] of run.waiters) resolve(null);
      run.waiters.clear();
    },
    /**
     * Deliver a live raster. Returns false when nobody was waiting for it, in
     * which case the caller owns the transferred bitmap and must close it.
     */
    deliver(id: number, token: number, bitmap: ImageBitmap | null): boolean {
      const waiters = runs.get(id)?.waiters;
      const resolve = waiters?.get(token);
      if (!resolve) return false;
      waiters?.delete(token);
      resolve(bitmap);
      return true;
    },
    /** The run finished (either way). */
    end(id: number): void {
      runs.get(id)?.waiters.clear();
      runs.delete(id);
    },
    /** For tests. */
    size: (): number => runs.size,
  };
}

// ── the Worker entry ────────────────────────────────────────────────────────

/** True only inside a real dedicated/module worker - never on the main thread. */
function inWorkerScope(): boolean {
  const g = globalThis as { WorkerGlobalScope?: unknown; document?: unknown; importScripts?: unknown };
  return typeof g.WorkerGlobalScope !== 'undefined' && typeof g.document === 'undefined';
}

if (inWorkerScope()) {
  // Worker-scope postMessage overload (message, transfer) - narrow it past the
  // DOM lib's Window overload, as video-encode.worker.ts and zzfxm-worker.ts do.
  const raw = postMessage as (message: unknown, transfer: Transferable[]) => void;
  const port = { post: (m: SeqWorkerOut, transfer: Transferable[] = []): void => raw(m, transfer) };

  const registry = createRunRegistry();

  addEventListener('message', (e: MessageEvent<SeqWorkerIn>) => {
    const m = e.data;
    if (m.type === 'abort') { registry.abort(m.id); return; }
    if (m.type === 'live') {
      // No waiter: the run aborted or finished between the request and this
      // reply. The bitmap was transferred to us, so we own it and must close it.
      if (!registry.deliver(m.id, m.token, m.bitmap) && m.bitmap) {
        try { m.bitmap.close(); } catch { /* already closed */ }
      }
      return;
    }
    // 'start'
    void handleStart(m, port, registry.begin(m.id))
      .catch((err) => {
        const coded = toCodedError(err);
        port.post({ type: 'error', id: m.id, code: coded.code, message: coded.message, offload: isOffloadFailure(err) });
      })
      .finally(() => registry.end(m.id));
  });
}
