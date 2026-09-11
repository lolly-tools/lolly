// SPDX-License-Identifier: MPL-2.0
/**
 * Streaming on-device VIDEO processing (plans/124 section 10, WP-G). ONE pipeline,
 * three ops hung off it:
 *
 *   1. MATTE (the marquee) - per-frame background removal to a TRANSPARENT
 *      animated WebP / APNG. Every RGB pixel is the source; only the alpha is
 *      model-computed, then temporally smoothed (EMA + scene-cut reset) to kill
 *      per-frame flicker. Alpha survives end-to-end: canvas.toBlob keeps the
 *      alpha channel, and engine/apng.ts / engine/webp-anim.ts splice the frames'
 *      bitstreams VERBATIM (no premultiply/flatten). The animated-image formats
 *      (WebP/PNG/GIF) can't carry audio, so those DROP it (the dialog says so); the
 *      transparent-WebM output (alpha VP9/AV1 via mediabunny, browser-gated on
 *      pickAlphaVideoCodec) keeps alpha AND the source sound AND a container C2PA in one
 *      file - see alphaVideoWriter.
 *   2. CROP - rect crop (even-dimension rounded for the encoders) to a normal
 *      video, KEEPING the source audio track.
 *   3. UPSCALE - per-frame Real-ESRGAN to a normal video, keeping audio. Desktop-
 *      first; on wasm the dialog shows an honest time estimate from a 3-frame
 *      probe and lets the user decide.
 *   4. GRADE - a colour look applied per frame: a 3D LUT (darkroom's baked .cube,
 *      or a user's own) plus film grain and a vignette. Pure maths, no model, no
 *      network; the LUT is parsed ONCE at op construction, never per frame.
 *   5. TRIM - no pixel change at all (an identity op); the WINDOW does the work.
 *      A request-level `range` narrows both the decode grid and the audio slice,
 *      so a trim is a re-encode of the selected seconds and nothing else.
 *
 * ── ARCHITECTURE: a source → op → sink loop, strictly streaming ───────────────
 * The pure loop `runFramePipeline` pulls one DecodedFrame at a time from a
 * VideoFrameReader, passes it through a FrameOp `(RGBA) → RGBA`, and hands the
 * result to a VideoFrameWriter. Memory is bounded by the reader's window, never
 * the whole clip - the wasm address space is the ceiling (the video-render
 * parallelism rule). It reports progress per frame to a WP-F job and is
 * cancellable BETWEEN frames.
 *
 * The reader/writer are SEAMS: the real ones decode with mediabunny (the
 * bridge/sequence-providers approach) and encode with the streaming WebCodecs mux
 * (bridge/video-encode-core.ts) or the alpha packers. The seams let the loop and
 * every op be unit-tested with a synthetic decoder/encoder pair - there are no
 * real codecs in jsdom.
 *
 * ── HONESTY LEDGER (same convention as lib/matter.ts / lib/upscaler.ts) ───────
 * The PURE parts below - the frame loop, the EMA/scene-cut smoother, even-crop
 * rounding, the grade op, the audio slice, the provenance branch, the estimate
 * extrapolation - are unit-tested headless (video-jobs.test.ts). The mediabunny
 * decode and the WebCodecs/alpha encode adapters have NOT been run in this
 * environment (no codecs under node); they are verified by Andy's in-browser
 * smoke test. Their shape mirrors the already-shipping sequence-providers decode and
 * sequence-render streaming mux. That covers the reader's RANGE window and its
 * source-fps derivation (mediabunny packet stats) too: the range reaches the
 * reader through a dep seam a fake can record, but what a real decoder does with
 * a windowed timestamp grid is browser-smoke-verified only. The same line runs
 * through the audio: `mediabunnyAudioRange` (decode only the window's samples)
 * is browser-smoke-only, while the DECISION around it - window first, whole-file
 * decode only when the source is short enough to survive one, otherwise drop the
 * sound with a logged warning - is unit-tested through the `decodeAudioRange` seam.
 *
 * ── PROVENANCE (plans/124 section 2 table, fixed) ────────────────────────────
 * Container-level C2PA on the OUTPUT (the existing video rule - never per-frame
 * imprints), the source video carried as an ingredient. Matte = plain
 * `c2pa.edited` ("Background removed…"); crop = plain `c2pa.cropped`; upscale =
 * the genAI-partial stamp (compositeWithTrainedAlgorithmicMedia). A catalog-
 * initiated job saves a PLAIN derived asset - the 'renders' tag is WP-B's
 * download-path contract only.
 */

import {
  packApng, packWebpAnim, extractC2paStore, prepareC2paIngredientFromStore, COMPOSITE_SOURCE_TYPE,
  chromaKeyAlpha, parseLutText, applyLutFrame, applyGrainVignette, GRAIN_REF_LONG_EDGE,
} from '@lolly/engine';
import { packGifAlpha } from './gif-alpha.ts';
import type { LosslessTrimCtx, LosslessTrimResult } from './lossless-trim.ts';
import { startJob, type JobHandle } from './jobs.ts';
import { t, tRaw } from '../i18n.ts';
import type {
  AssetRef, HostV1, MatteModelId, UpscaleModelId,
} from '@lolly-tools/core/host-v1';

// ── The op set + per-op params ───────────────────────────────────────────────

export type VideoOp = 'matte' | 'crop' | 'upscale' | 'grade' | 'trim';

/** A rectangle in source pixels. */
export interface CropRect { x: number; y: number; w: number; h: number; }

/** A half-open time window over the SOURCE, in seconds. Present on a request, it
 *  narrows the decode grid AND the audio slice; absent means the whole clip.
 *  Any op may carry one - a trim is just the identity op plus a range. */
export interface VideoRange { startSec: number; endSec: number; }

export interface MatteVideoParams {
  /** Defaults to u2netp - a video is hundreds of runs, so the cheapest general net
   *  wins. Read only for the 'model' method; the colour key ignores it. */
  model: MatteModelId;
  /** Transparent output container. WebP/PNG carry the matte's SOFT alpha verbatim;
   *  GIF thins it to 1-bit (hard-edged) - the dialog says so. 'webm' is the one
   *  transparent output that ALSO carries sound: alpha VP9/AV1 in a WebM/Matroska
   *  container (browser-gated - only where alpha actually encodes; the dialog probes
   *  pickAlphaVideoCodec before offering it). */
  format: 'webp' | 'png' | 'gif' | 'webm';
  /** Output frame rate. Whole frames are stored, so this is a real size lever. */
  fps: number;
  /** Longest output edge in px - bounds both memory and file size, and (WP-resolution)
   *  the destination resolution the user chose: a smaller edge is faster to work with
   *  and a smaller file. Both methods honour it (the model via maxEdge, the colour key
   *  by scaling the frame before it keys). */
  longEdge: number;
  /** How the alpha is derived. 'model' (default) runs the on-device matte net;
   *  'chroma' is a deterministic COLOUR-RANGE key for footage shot against a flat
   *  wall/screen - no model download, cheaper per frame, and often cleaner on a clean
   *  background. Absent reads as 'model' (back-compat with every existing caller). */
  method?: 'model' | 'chroma';
  /** Colour-key parameters, read only when method === 'chroma'. */
  chroma?: ChromaKeyParams;
}

/** Colour-range keying params: remove a flat background colour by its PERCEPTUAL
 *  (OKLab) distance. Distances are in OKLab ΔEOK units (0 = the key, black↔white ≈ 1,
 *  a just-noticeable difference ≈ 0.02) - the same metric the engine's chromaKeyAlpha
 *  keys on, so the dialog's sliders and the render agree. */
export interface ChromaKeyParams {
  /** The background colour to remove, 0..255 per channel. */
  keyColor: { r: number; g: number; b: number };
  /** OKLab distance at/below which a pixel is fully removed (0..1). */
  tolerance: number;
  /** Ramp width above `tolerance` over which alpha climbs back to fully opaque (0..1) -
   *  the soft edge. */
  softness: number;
  /** 0..1 spill suppression: de-saturate near-key edge pixels toward their luma, so a
   *  green/blue rim does not survive the key. 0 disables. */
  spill?: number;
}

export interface CropVideoParams {
  rect: CropRect;
  fps: number;
  /** Output video bitrate, bits/s. */
  bitrate: number;
}

export interface UpscaleVideoParams {
  model: UpscaleModelId;
  fps: number;
  bitrate: number;
}

/** The creator of a shipped/known LUT, recorded in the grade's C2PA when their
 *  look is applied. Set only for presets whose author asked to be credited (the
 *  CC0 film-emulation LUTs carry none); an uploaded LUT is anonymous by nature.
 *  Rides into the `c2pa.color_adjustments` action's `parameters` + description so
 *  the credit travels with every file the graded clip ends up in. */
export interface LutCredit {
  /** The LUT's name as shown to the user ("S-Log3 (Heavy)"). */
  name: string;
  /** The person who authored the look ("Peter Chamalian"). */
  author: string;
  /** Their role, if worth recording ("Director of Photography & Editor"). */
  role?: string;
  /** The organisation the author works for ("SUSE") - their affiliation, shown in
   *  the readable credit. Distinct from `copyright`: the rights owner is named
   *  there, the human author in `author`. */
  org?: string;
  /** The copyright line ("© 2025 SUSE"). The author (`author`) and the rights
   *  owner can differ - here Peter authored it in his role, so SUSE owns it. */
  copyright?: string;
  /** SPDX-ish licence label ("CC BY 4.0"). */
  license: string;
  /** Canonical licence URL, for the machine-readable record. */
  licenseUrl?: string;
  /** When the LUT was authored ("2025-09") - the creation date of the look, not
   *  of the grade (the C2PA action stamps its own `when` for that). */
  created?: string;
}

/** A colour look for the grade op: an optional 3D LUT plus the two spatial effects
 *  darkroom applies after it. Every field is a plain number/string so the whole look
 *  round-trips through a URL or a saved preset. */
export interface GradeVideoParams {
  /** The LUT as .cube/.3dl TEXT (darkroom bakes its whole colour pipeline into one),
   *  or '' for no LUT at all - a grain/vignette-only grade is legal. */
  cubeText: string;
  /** A human name for the look, used in the provenance description ("Chrome",
   *  "my-look.cube"). Absent → a generic "Colour graded (on-device)". */
  lutLabel?: string;
  /** Attribution for a credited LUT (a preset whose author asked to be named).
   *  When set, the grade's C2PA credits them; absent for CC0/uploaded looks. */
  lutCredit?: LutCredit;
  /** 0..1 mix of the LUT result over the original pixel. */
  lutIntensity: number;
  /** Film grain amount, 0..1 (0 skips the whole spatial pass with vignette 0). */
  grain: number;
  /** Grain lattice cell size in px, 1..4 - bigger cells read as coarser stock. */
  grainSize: number;
  /** Vignette strength, 0..1. */
  vignette: number;
  /** Grain PRNG seed. The engine advances it per FRAME, so the noise moves like
   *  real stock instead of sitting still as a fixed pattern. */
  seed: number;
  /** Output frame rate. `fps <= 0` means "keep the source's own rate", exactly as
   *  trim reads it - a colour look changes no timing, so resampling a 60fps clip
   *  onto a 30Hz grid would be a second edit nobody asked for. */
  fps: number;
  /** Output video bitrate, bits/s. */
  bitrate: number;
}

/** Trim carries no pixel parameters - the request-level `range` is the whole edit.
 *  `fps <= 0` means "keep the source's own frame rate" (the reader derives it). */
export interface TrimVideoParams {
  fps: number;
  bitrate: number;
  /** Opt in (WP-H) to the lossless packet-copy fast path snapping the cut-in back to
   *  the previous keyframe when the requested in-point is mid-GOP. Off (the default)
   *  keeps the exact bounds: an off-keyframe cut then falls back to the transcoding
   *  trim rather than the fast path silently moving the in-point. A cut that already
   *  aligns to a keyframe takes the fast path either way. */
  snapToKeyframe?: boolean;
}

// ── Caps (refuse, never OOM) ─────────────────────────────────────────────────

/** Longest INPUT edge a job will accept before refusing. Above this the per-frame
 *  op (a wasm model, a full-frame crop) risks the tab. */
export const VIDEO_JOB_MAX_LONG_EDGE = 3840;
/** Longest input edge for the MATTE op specifically - a per-frame transformer at
 *  1024² over hundreds of frames is far heavier than a crop, so it caps lower. */
export const MATTE_MAX_INPUT_LONG_EDGE = 1920;
/** Longest input edge for UPSCALE - Real-ESRGAN x4 quadruples every dimension, so
 *  a 1024px source already targets 4096px (a common H.264 encoder ceiling). Cap
 *  the input so the 4× output stays inside what the encoder will accept. */
export const UPSCALE_MAX_INPUT_LONG_EDGE = 1024;
/** Duration ceiling (s). A background job must stay a background job. */
export const VIDEO_JOB_MAX_DURATION_SEC = 120;
/** Source-byte ceiling - fetched whole for decode + the C2PA ingredient scan. */
export const VIDEO_JOB_MAX_SOURCE_BYTES = 300 * 1024 * 1024;
/** Whole animated-WebP/APNG frames live in memory until finalize, so the matte
 *  output's frame COUNT is capped (fps × duration). 720p×360 frames ≈ a big file. */
export const MATTE_MAX_OUTPUT_FRAMES = 450;

/** Transparent-output defaults (WP-H honesty: whole frames, so keep them small). */
export const MATTE_DEFAULT_LONG_EDGE = 720;
export const MATTE_DEFAULT_FPS = 12;
/** The video default. Same id as the still default since 2026-08-26, but kept as its
 *  own constant: a video runs the net once per frame, so if the still default ever
 *  moves to something heavier this must NOT follow it. */
export const MATTE_VIDEO_DEFAULT_MODEL: MatteModelId = 'u2netp';

/** Destination-resolution choices the dialog offers (longest output edge, px). The
 *  dialog clamps the list to the source's own long edge so it never offers to upscale. */
export const MATTE_LONG_EDGE_PRESETS = [360, 480, 720, 1080] as const;

/** Bitrate (bits/s) for the transparent-WebM matte output. Alpha VP9/AV1 at the small
 *  matte long edges is cheap, and a soft feathered edge wants headroom - ~4 Mbit/s keeps
 *  the alpha clean without the frame-by-frame bloat of the WebP/PNG path. */
export const MATTE_WEBM_BITRATE = 4_000_000;

/** Colour-key defaults: a standard chroma green (#00b140), a moderate OKLab tolerance,
 *  a soft edge, and half-strength spill suppression (tolerance/softness in ΔEOK units). */
export const CHROMA_DEFAULT_KEY: { r: number; g: number; b: number } = { r: 0, g: 177, b: 64 };
export const CHROMA_DEFAULT_TOLERANCE = 0.12;
export const CHROMA_DEFAULT_SOFTNESS = 0.1;
export const CHROMA_DEFAULT_SPILL = 0.5;
const DEFAULT_CHROMA: ChromaKeyParams = {
  keyColor: CHROMA_DEFAULT_KEY, tolerance: CHROMA_DEFAULT_TOLERANCE,
  softness: CHROMA_DEFAULT_SOFTNESS, spill: CHROMA_DEFAULT_SPILL,
};

/** EMA weight on the PREVIOUS smoothed alpha: new = a·prev + (1−a)·current. */
export const MATTE_EMA_ALPHA = 0.6;
/** Total-variation distance (0..1) between successive luma histograms above which
 *  the frame is a scene cut and the EMA resets (no blend across the cut). */
export const SCENE_CUT_THRESHOLD = 0.45;

// ── The streamed frame + the seams ───────────────────────────────────────────

/** One decoded frame: straight-alpha RGBA plus its place on the timeline. */
export interface DecodedFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  timestampUs: number;
  durationUs: number;
}

/** A per-frame op stage: RGBA in, RGBA out (may change dimensions - crop/upscale). */
export type FrameOp = (frame: DecodedFrame) => DecodedFrame | Promise<DecodedFrame>;

/** Sequential frame source. The real one decodes with mediabunny; tests inject a
 *  fake. `frameCount` is the expected total for the progress bar. */
export interface VideoFrameReader {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly frameCount: number;
  /** The WHOLE source's duration in seconds, when the adapter knows it - not the
   *  window's. The reader has already opened the container to build its grid, so
   *  it is the cheapest place to learn how long the file behind a 3-second window
   *  actually is, which is what decides whether that file's audio can safely be
   *  decoded whole (see `jobAudio`). Absent means "unknown". */
  readonly sourceDurationSec?: number;
  read(): AsyncGenerator<DecodedFrame, void, unknown>;
  close(): Promise<void> | void;
}

/** What a finished write produced. */
export interface WriterResult { blob: Blob; format: string; width: number; height: number; }

/** Frame sink. Crop/upscale → the streaming video mux; matte → the alpha packers. */
export interface VideoFrameWriter {
  write(frame: DecodedFrame): Promise<void> | void;
  finalize(): Promise<WriterResult>;
  abort(reason?: unknown): Promise<void> | void;
}

/** Cooperative controls the loop honours between frames. */
export interface PipelineCtx {
  onProgress?: (done: number, total: number) => void;
  isCancelled?: () => boolean;
}

export interface PipelineResult { cancelled: boolean; result?: WriterResult; }

/**
 * The streaming loop: reader → op → writer, one frame at a time.
 *
 * Cancellation is checked BEFORE each op (cooperative, between frames); a
 * cancelled loop aborts the writer and returns `{ cancelled: true }` without a
 * result. Any thrown error aborts the writer and closes the reader before
 * rethrowing, so neither a decoder nor an encoder is ever left running.
 */
export async function runFramePipeline(
  reader: VideoFrameReader, op: FrameOp, writer: VideoFrameWriter, ctx: PipelineCtx = {},
): Promise<PipelineResult> {
  let done = 0;
  const total = reader.frameCount;
  try {
    for await (const frame of reader.read()) {
      if (ctx.isCancelled?.()) {
        await writer.abort('cancelled');
        await reader.close();
        return { cancelled: true };
      }
      const out = await op(frame);
      await writer.write(out);
      done++;
      ctx.onProgress?.(done, total);
    }
    const result = await writer.finalize();
    await reader.close();
    return { cancelled: false, result };
  } catch (err) {
    try { await writer.abort(err); } catch { /* already down */ }
    try { await reader.close(); } catch { /* already down */ }
    throw err;
  }
}

// ── Pure math: luma histogram + scene-cut EMA smoother ───────────────────────

/** A normalized (sum = 1) luma histogram of an RGBA frame - the scene-cut signal. */
export function lumaHistogram(data: ArrayLike<number>, bins = 64): Float64Array {
  const hist = new Float64Array(bins);
  const n = Math.floor(data.length / 4);
  if (n <= 0) return hist;
  const scale = bins / 256;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const y = 0.299 * (data[o] as number) + 0.587 * (data[o + 1] as number) + 0.114 * (data[o + 2] as number);
    let b = Math.floor(y * scale);
    if (b < 0) b = 0; else if (b >= bins) b = bins - 1;
    hist[b]!++;
  }
  for (let i = 0; i < bins; i++) hist[i]! /= n;
  return hist;
}

/** Total-variation distance between two normalized histograms: 0 (identical) .. 1
 *  (disjoint). Half the summed absolute difference. */
export function histogramDelta(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) s += Math.abs((a[i] as number) - (b[i] as number));
  return s / 2;
}

/**
 * Temporal alpha smoother for a matte video: an EMA over the alpha channel that
 * RESETS on a scene cut so a hard cut isn't smeared into the next shot.
 *
 * `apply` mutates the frame's alpha IN PLACE. The RGB is never touched (a matte
 * invents no colour); only the model's noisy per-frame alpha is calmed, which is
 * what kills the shimmer around hair/edges between otherwise-identical frames.
 */
export class MatteAlphaSmoother {
  private prevAlpha: Uint8ClampedArray | null = null;
  private prevHist: Float64Array | null = null;
  private prevW = 0;
  private prevH = 0;
  private readonly alpha: number;
  private readonly threshold: number;
  /** True when the last apply() treated the frame as a scene cut (test hook). */
  lastWasCut = true;

  constructor(alpha = MATTE_EMA_ALPHA, threshold = SCENE_CUT_THRESHOLD) {
    this.alpha = alpha;
    this.threshold = threshold;
  }

  apply(frame: { data: Uint8ClampedArray; width: number; height: number }): void {
    const hist = lumaHistogram(frame.data);
    const dimsChanged = frame.width !== this.prevW || frame.height !== this.prevH;
    const cut = !this.prevAlpha || dimsChanged
      || (this.prevHist ? histogramDelta(hist, this.prevHist) > this.threshold : true);
    this.lastWasCut = cut;

    const data = frame.data;
    if (!cut && this.prevAlpha) {
      const a = this.alpha;
      const prev = this.prevAlpha;
      for (let i = 3; i < data.length; i += 4) {
        data[i] = Math.round(a * (prev[i] as number) + (1 - a) * (data[i] as number));
      }
    }
    // Store the POST-smoothing alpha as the next frame's history.
    if (!this.prevAlpha || this.prevAlpha.length !== data.length) this.prevAlpha = new Uint8ClampedArray(data.length);
    const prev = this.prevAlpha;
    for (let i = 3; i < data.length; i += 4) prev[i] = data[i]!;
    this.prevHist = hist;
    this.prevW = frame.width;
    this.prevH = frame.height;
  }

  reset(): void {
    this.prevAlpha = null;
    this.prevHist = null;
    this.prevW = this.prevH = 0;
    this.lastWasCut = true;
  }
}

// ── Pure math: even-dimension crop rounding + the crop op ─────────────────────

/** Round a length DOWN to an even value ≥ 2 (encoders reject odd 4:2:0 dims). */
export function evenFloor(n: number): number {
  const v = Math.floor(n / 2) * 2;
  return v < 2 ? 2 : v;
}

/**
 * Clamp + even-round a crop rect into a source frame. x/y are snapped to even
 * offsets (chroma alignment) and w/h to even lengths that stay inside the frame.
 */
export function roundCropRect(rect: CropRect, srcW: number, srcH: number): CropRect {
  let x = Math.max(0, Math.min(Math.floor(rect.x), Math.max(0, srcW - 2)));
  let y = Math.max(0, Math.min(Math.floor(rect.y), Math.max(0, srcH - 2)));
  x -= x % 2;
  y -= y % 2;
  const w = evenFloor(Math.min(rect.w, srcW - x));
  const h = evenFloor(Math.min(rect.h, srcH - y));
  return { x, y, w, h };
}

/** Copy a rect out of a frame's RGBA into a new, smaller frame. Pure. */
export function cropFrame(frame: DecodedFrame, rect: CropRect): DecodedFrame {
  const { x, y, w, h } = rect;
  const out = new Uint8ClampedArray(w * h * 4);
  const sw = frame.width;
  for (let row = 0; row < h; row++) {
    const srcStart = ((y + row) * sw + x) * 4;
    out.set(frame.data.subarray(srcStart, srcStart + w * 4), row * w * 4);
  }
  return { data: out, width: w, height: h, timestampUs: frame.timestampUs, durationUs: frame.durationUs };
}

// ── Provenance branch (plans/124 section 2 table) ────────────────────────────

export interface VideoC2paAction { action: string; digitalSourceType?: string; description?: string; parameters?: unknown; }

/** The human tail of a grade action's description when a credited LUT is used:
 *  "… by Peter Chamalian, SUSE · CC BY 4.0". Kept next to the parameters builder
 *  so the readable credit and the machine-readable one never drift. */
export function lutCreditText(c: LutCredit): string {
  const who = c.org ? `${c.author}, ${c.org}` : c.author;
  return `by ${who} · ${c.license}`;
}

/** The `c2pa.color_adjustments` action parameters recording a credited LUT's
 *  creator, under a Lolly-namespaced key so it never collides with a standard
 *  C2PA parameter. This is what carries the attribution into every downstream
 *  file the graded clip becomes an ingredient of. */
export function lutCreditParameters(c: LutCredit): { 'com.lolly.lut': Record<string, string> } {
  return {
    'com.lolly.lut': {
      name: c.name,
      creator: c.author,
      ...(c.role ? { role: c.role } : {}),
      ...(c.org ? { organization: c.org } : {}),
      ...(c.copyright ? { copyright: c.copyright } : {}),
      license: c.license,
      ...(c.licenseUrl ? { licenseUrl: c.licenseUrl } : {}),
      ...(c.created ? { created: c.created } : {}),
    },
  };
}
export interface VideoProvenance {
  /** The export assertion's `tool`. */
  tool: string;
  /** The honest c2pa action step(s). */
  actions: VideoC2paAction[];
  /** Set only for the upscale op (the model invents high-frequency detail). */
  aiGenerated?: 'partial';
}

/**
 * The container-level provenance for a finished video job. Matte and crop are
 * plain edits; upscale is the genAI-partial stamp. The source video is added as
 * an ingredient by the caller (not here - this is the action branch only).
 */
export function videoProvenanceFor(
  op: VideoOp,
  p: { model?: string; version?: string; scale?: number; method?: 'model' | 'chroma'; lutLabel?: string; lutCredit?: LutCredit } = {},
): VideoProvenance {
  if (op === 'crop') {
    return { tool: 'Crop', actions: [{ action: 'c2pa.cropped', description: 'Cropped' }] };
  }
  if (op === 'grade') {
    // A LUT + grain/vignette is a colour adjustment and nothing else - c2pa has a
    // dedicated action for exactly that, and no model runs, so no aiGenerated flag.
    // A credited look (a preset whose author asked to be named) additionally
    // carries the creator in the description AND the action parameters, so the
    // attribution travels forward into any file that uses the graded clip.
    const label = p.lutLabel ? `Colour graded - ${p.lutLabel}` : 'Colour graded (on-device)';
    return {
      tool: 'Colour grade',
      actions: [{
        action: 'c2pa.color_adjustments',
        description: p.lutCredit ? `${label} ${lutCreditText(p.lutCredit)}` : label,
        ...(p.lutCredit ? { parameters: lutCreditParameters(p.lutCredit) } : {}),
      }],
    };
  }
  if (op === 'trim') {
    // No pixel is altered; the edit is entirely which seconds survived.
    return { tool: 'Trim', actions: [{ action: 'c2pa.edited', description: 'Trimmed to a shorter clip' }] };
  }
  if (op === 'matte') {
    // A colour key runs no model and invents nothing - record it as a plain edit with
    // no model name and, deliberately, NO aiGenerated flag (unlike upscale below).
    if (p.method === 'chroma') {
      return {
        tool: 'Remove background',
        actions: [{ action: 'c2pa.edited', description: 'Background removed with a colour key (on-device)' }],
      };
    }
    const who = `${p.model ?? 'a model'} ${p.version ?? ''}`.trim();
    return {
      tool: 'Remove background',
      actions: [{ action: 'c2pa.edited', description: `Background removed with ${who} (on-device)` }],
    };
  }
  // upscale - a super-resolver infers pixels from a trained model.
  const who = `${p.model ?? 'a model'} ${p.version ?? ''}`.trim();
  return {
    tool: 'Upscale',
    actions: [{
      action: 'c2pa.edited',
      digitalSourceType: COMPOSITE_SOURCE_TYPE,
      description: `Upscaled ${p.scale ?? 4}× with ${who} (on-device)`,
    }],
    aiGenerated: 'partial',
  };
}

// ── Refusals + estimate (pure) ───────────────────────────────────────────────

export interface SourceProbe { longEdge: number; durationSec: number; bytes: number; }

/**
 * A refusal message for a source a given op can't safely process, or null.
 *
 * With a `range`, the duration cap applies to the EFFECTIVE window rather than the
 * whole source - which is the point of a trim: a 200s clip is refused outright, but
 * 30 seconds selected out of it is an ordinary job. The byte cap still measures the
 * whole file, because the whole file is fetched and scanned for its credential
 * before anything is decoded.
 */
export function videoJobRefusal(op: VideoOp, probe: SourceProbe, range?: VideoRange): string | null {
  if (probe.bytes > VIDEO_JOB_MAX_SOURCE_BYTES) {
    return t('This video is too large to process in the browser.');
  }
  if (range && !(Number.isFinite(range.startSec) && Number.isFinite(range.endSec)
    && range.startSec >= 0 && range.endSec > range.startSec)) {
    return t("That section of the video isn't valid.");
  }
  if (!(probe.durationSec > 0)) return t("Couldn't read this video's length.");
  const effectiveSec = range ? Math.min(range.endSec, probe.durationSec) - range.startSec : probe.durationSec;
  if (!(effectiveSec > 0)) return t("That section of the video isn't valid.");
  if (effectiveSec > VIDEO_JOB_MAX_DURATION_SEC) {
    return t('This video is too long to process in the browser ({sec}s max).', { sec: VIDEO_JOB_MAX_DURATION_SEC });
  }
  const cap = op === 'matte' ? MATTE_MAX_INPUT_LONG_EDGE
    : op === 'upscale' ? UPSCALE_MAX_INPUT_LONG_EDGE
    : VIDEO_JOB_MAX_LONG_EDGE;
  if (probe.longEdge > cap) {
    return t('This video is too high-resolution to process on this device ({px}px max on the long edge).', { px: cap });
  }
  return null;
}

/** Expected matte output frame count at `fps` over `durationSec`, clamped to the
 *  in-memory frame cap. */
export function matteOutputFrames(durationSec: number, fps: number): number {
  const n = Math.max(1, Math.round(durationSec * Math.max(1, fps)));
  return Math.min(MATTE_MAX_OUTPUT_FRAMES, n);
}

/** Extrapolate a whole-job estimate from a small probe (WP-G/H honesty). */
export function extrapolateEstimate(
  sample: { perFrameMs: number; sampleFrameBytes: number }, frameCount: number,
): { totalMs: number; totalBytes: number } {
  return {
    totalMs: Math.round(sample.perFrameMs * frameCount),
    totalBytes: Math.round(sample.sampleFrameBytes * frameCount),
  };
}

// ── Output dimensions ────────────────────────────────────────────────────────

/** Even-clamped dims for a source scaled so its long edge is `longEdge`. */
export function scaledEvenDims(srcW: number, srcH: number, longEdge: number): { width: number; height: number } {
  const long = Math.max(srcW, srcH);
  const scale = long > longEdge ? longEdge / long : 1;
  return { width: evenFloor(srcW * scale), height: evenFloor(srcH * scale) };
}

/** The destination long edge a matte actually renders at, for a chosen preset and a
 *  known source: the request, never ABOVE the source's own long edge (no upscaling
 *  here) nor the matte input cap. This is the contract the dialog's Resolution select
 *  feeds into `params.longEdge`; an unknown/zero source falls back to the request. */
export function clampMatteLongEdge(requested: number, srcLongEdge: number): number {
  const source = srcLongEdge > 0 ? srcLongEdge : requested;
  return Math.max(1, Math.min(requested, source, MATTE_MAX_INPUT_LONG_EDGE));
}

// ── The ops (browser side; matte/upscale call host models) ───────────────────

/** Build the matte op: run the model per frame, then smooth the alpha in place. */
export function makeMatteOp(
  host: HostV1, params: MatteVideoParams, smoother: MatteAlphaSmoother, signal?: AbortSignal,
): FrameOp {
  const matte = host.matte;
  if (!matte) throw new Error('host.matte is unavailable');
  return async (frame: DecodedFrame): Promise<DecodedFrame> => {
    // matte.run TRANSFERS (neuters) the frame buffer to the worker - hand it a copy.
    const runFrame = { width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.data) };
    const out = await matte.run(runFrame, { model: params.model, maxEdge: params.longEdge, ...(signal ? { signal } : {}) });
    smoother.apply(out);
    return { data: out.data, width: out.width, height: out.height, timestampUs: frame.timestampUs, durationUs: frame.durationUs };
  };
}

// ── Pure math: bilinear resize + the colour-range (chroma) key ───────────────

/** Bilinear-resample an RGBA frame to `outW`×`outH`. Returns a fresh buffer (never
 *  aliases the source), so a same-size call is a defensive copy. Pure. */
export function resizeFrameRGBA(
  frame: { data: Uint8ClampedArray; width: number; height: number }, outW: number, outH: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const { data, width: sw, height: sh } = frame;
  if (outW === sw && outH === sh) return { data: new Uint8ClampedArray(data), width: sw, height: sh };
  const out = new Uint8ClampedArray(outW * outH * 4);
  const sx = sw / outW;
  const sy = sh / outH;
  for (let y = 0; y < outH; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < outW; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = fx - x0;
      const p00 = (y0 * sw + x0) * 4, p01 = (y0 * sw + x1) * 4, p10 = (y1 * sw + x0) * 4, p11 = (y1 * sw + x1) * 4;
      const o = (y * outW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = data[p00 + c]! * (1 - wx) + data[p01 + c]! * wx;
        const bot = data[p10 + c]! * (1 - wx) + data[p11 + c]! * wx;
        out[o + c] = Math.round(top * (1 - wy) + bot * wy);
      }
    }
  }
  return { data: out, width: outW, height: outH };
}

/** Build the colour-key op: scale the frame to the chosen long edge (the destination
 *  resolution), then key it with the engine's perceptual (OKLab) chromaKeyAlpha. No host
 *  model is touched - this is why the chroma method works without any staged matte model,
 *  and the keying MATH lives in engine/chroma-key.ts so web and CLI key identically. Full
 *  OKLab distance (lightness included) is what keeps a NEUTRAL key (a white/grey/black
 *  wall) from wiping the frame, with no special-case luma weighting needed. */
export function makeChromaKeyOp(params: ChromaKeyParams, longEdge: number): FrameOp {
  return (frame: DecodedFrame): DecodedFrame => {
    const dims = scaledEvenDims(frame.width, frame.height, longEdge);
    const scaled = resizeFrameRGBA(frame, dims.width, dims.height);
    const keyed = chromaKeyAlpha(scaled.data, scaled.width, scaled.height, {
      keyColor: [params.keyColor.r, params.keyColor.g, params.keyColor.b],
      tolerance: params.tolerance, softness: params.softness, spill: params.spill ?? 0,
    });
    return { data: keyed, width: scaled.width, height: scaled.height, timestampUs: frame.timestampUs, durationUs: frame.durationUs };
  };
}

/** Build the upscale op: run the model per frame (dims grow by the model scale). */
export function makeUpscaleOp(host: HostV1, params: UpscaleVideoParams, signal?: AbortSignal): FrameOp {
  const upscale = host.upscale;
  if (!upscale) throw new Error('host.upscale is unavailable');
  return async (frame: DecodedFrame): Promise<DecodedFrame> => {
    const runFrame = { width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.data) };
    const out = await upscale.run(runFrame, { model: params.model, ...(signal ? { signal } : {}) });
    // Encoders need even dims; a model scale keeps parity, but guard anyway by
    // trusting the model output (dims are its own multiple of the source).
    return { data: out.data, width: out.width, height: out.height, timestampUs: frame.timestampUs, durationUs: frame.durationUs };
  };
}

/** Build the crop op from a pre-rounded rect. */
export function makeCropOp(rect: CropRect): FrameOp {
  return (frame: DecodedFrame): DecodedFrame => cropFrame(frame, rect);
}

/**
 * Build the colour-grade op: the LUT text is parsed ONCE here, not per frame - a
 * 33³ .cube is ~100k floats, so re-parsing it 900 times would cost more than the
 * grade itself, and a malformed look must fail when the job is built (visibly, on
 * the caller's stack) rather than 40 frames in.
 *
 * Both stages are engine maths (engine/src/grade.ts), so a graded frame here and a
 * graded still in darkroom are the same pixels. The grain seed ADVANCES per frame:
 * a fixed lattice across a whole clip reads as dirt on the lens, not as film.
 *
 * The grain lattice is sized against GRAIN_REF_LONG_EDGE rather than the raw pixel
 * grid. Without that reference the cell is an absolute number of device pixels, so
 * the same slider draws grain twice as fine on a 1080p render as on the ≤960px
 * preview the user judged it on, and four times as fine on a 4K one - the texture
 * is the half of grain being looked at, so it has to be proportional to the picture.
 *
 * The frame's RGBA is graded IN PLACE - the reader hands out a fresh buffer per
 * frame (getImageData allocates), so there is nothing upstream to corrupt, and a
 * full-frame copy per frame is exactly the allocation a streaming pipeline exists
 * to avoid.
 */
export function makeGradeOp(params: GradeVideoParams): FrameOp {
  const lut = params.cubeText.trim() ? parseLutText(params.cubeText, params.lutLabel) : null;
  const spatial = {
    grain: params.grain, grainSize: params.grainSize, vignette: params.vignette, seed: params.seed,
  };
  const spatialOn = params.grain > 0 || params.vignette > 0;
  let frameIndex = 0;
  return (frame: DecodedFrame): DecodedFrame => {
    const data = frame.data;
    if (lut) applyLutFrame(data, lut, params.lutIntensity);
    if (spatialOn) applyGrainVignette(data, frame.width, frame.height, spatial, frameIndex, GRAIN_REF_LONG_EDGE);
    frameIndex++;
    return { data, width: frame.width, height: frame.height, timestampUs: frame.timestampUs, durationUs: frame.durationUs };
  };
}

// ── Real adapters (browser-only, lazily built; honesty ledger) ───────────────
//
// These touch mediabunny / WebCodecs / <canvas> and are NOT exercised under node.
// Tests inject fake readers/writers. Their shape mirrors bridge/sequence-providers.ts
// (decode) and bridge/video-encode-core.ts (encode), both already shipping.

/**
 * Read a source track's own average frame rate from a bounded packet scan. Used
 * only when the caller asks for `fps <= 0` ("keep the source rate"), which is what
 * a TRIM wants: re-timing a clip you only meant to shorten is a silent quality
 * change. The scan is metadata-only and capped at a few hundred packets, so it
 * costs a seek, not a decode. Anything unreadable falls back to 30; the result is
 * clamped to 1..60 so a broken header can't ask for a 1000fps grid.
 */
async function sourceTrackFps(track: { computePacketStats?: (n?: number) => Promise<{ averagePacketRate: number }> }): Promise<number> {
  try {
    const stats = await track.computePacketStats?.(240);
    const rate = stats?.averagePacketRate;
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) return Math.min(60, Math.max(1, rate));
  } catch { /* no stats - fall through to the default */ }
  return 30;
}

/**
 * Decode a video Blob into a sequential RGBA frame reader at `fps` (mediabunny).
 * `fps <= 0` means "the source's own rate"; a `range` narrows the grid to that
 * window of the source.
 *
 * The emitted `timestampUs` stays 0-BASED under a range (it is `i / f`, never
 * `startSec + i / f`). That is deliberate: the streaming mux timestamps the audio
 * it is handed from 0 (video-encode-core.ts's addAudio clock), and the mp4 muxer is
 * built without `firstTimestampBehavior`, so source-absolute video timestamps would
 * open the output with an A/V offset of exactly `startSec`. The window lives in the
 * grid, the output timeline starts at zero.
 */
export async function mediabunnyFrameReader(blob: Blob, fps: number, range?: VideoRange): Promise<VideoFrameReader> {
  const m = await import('mediabunny');
  const input = new m.Input({ formats: [m.MP4, m.QTFF, m.WEBM, m.MATROSKA], source: new m.BlobSource(blob) });
  const track = await input.getPrimaryVideoTrack();
  if (!track) { input.dispose?.(); throw new Error(t("Couldn't read this video.")); }
  if (!(await track.canDecode())) { input.dispose?.(); throw new Error(t("This browser can't decode this video.")); }
  const width = track.displayWidth;
  const height = track.displayHeight;
  const f = fps > 0 ? Math.max(1, fps) : await sourceTrackFps(track);
  // computeDuration() reports the last frame's START for a container that records no
  // final-frame duration. Our own floored WebM exports are exactly that: WebM stores
  // 1ms timecodes and, to keep exact-frame seeking, they carry no DefaultDuration
  // (bridge/mediabunny-mux.ts). Taken literally that would drop the last frame from a
  // whole-clip read, so extend the end to the last packet's presentation end. For a
  // normally-authored file this already equals computeDuration, so nothing changes.
  const lastPacket = await new m.EncodedPacketSink(track).getPacket(Number.POSITIVE_INFINITY, { metadataOnly: true });
  const lastEnd = lastPacket ? lastPacket.timestamp + (lastPacket.duration || 1 / f) : 0;
  const duration = Math.max(await input.computeDuration(), lastEnd);
  // The window, clamped into the clip: a range that runs past the end simply stops
  // at the end, and an absent range is the whole clip (start 0, end = duration).
  const startSec = range ? Math.max(0, Math.min(range.startSec, duration)) : 0;
  const endSec = range ? Math.max(startSec, Math.min(range.endSec, duration)) : duration;
  const frameCount = Math.max(1, Math.round((endSec - startSec) * f));
  const sink = new m.VideoSampleSink(track);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

  async function* read(): AsyncGenerator<DecodedFrame, void, unknown> {
    // A deterministic timestamp grid at 1/fps over the window - one output frame per
    // grid point, decoded from the nearest source sample (samplesAtTimestamps handles
    // the seek). Without a range this is the old whole-clip grid exactly.
    function* grid(): Generator<number> {
      for (let i = 0; i < frameCount; i++) yield Math.max(0, Math.min(endSec - 1e-4, startSec + i / f));
    }
    let i = 0;
    for await (const sample of sink.samplesAtTimestamps(grid())) {
      if (sample) {
        ctx.clearRect(0, 0, width, height);
        sample.draw(ctx, 0, 0, width, height);
        sample.close();
      }
      const data = ctx.getImageData(0, 0, width, height).data;
      yield {
        data, width, height,
        timestampUs: Math.round((i / f) * 1e6),
        durationUs: Math.round(1e6 / f),
      };
      i++;
    }
  }

  return {
    width, height, fps: f, frameCount, sourceDurationSec: duration, read,
    close: () => { try { input.dispose?.(); } catch { /* gone */ } },
  };
}

/**
 * Decode ONLY `[startSec, endSec)` of a source's audio track, via mediabunny's
 * AudioBufferSink (which windows at the packet level, so the samples outside the
 * window are never decoded at all).
 *
 * This exists because the duration cap measures the SELECTED WINDOW, so a trim
 * accepts a source of any length up to the byte cap. Handing such a file to
 * `decodeAudioData` asks the tab to hold the whole compressed file, a copy of it,
 * and a full-length Float32 PCM buffer - roughly a gigabyte for a 45-minute screen
 * recording, to keep ten seconds of it. The window is bounded by the same 120s the
 * refusal enforces, so this path's peak is ~46 MB whatever the source's length.
 *
 * Returns null when there is no audio track, the browser can't decode it, or
 * anything throws. It deliberately does NOT fall back to a whole-file decode
 * itself: the fallback needs the source bytes, the `decodeAudio` seam and
 * `host.log`, all of which live at the call site, and doing it in both places
 * would decode the file twice.
 *
 * Channels are capped at stereo because that is all the mux will carry
 * (videoEncodeWriter clamps `numberOfChannels` to 2), so a 5.1 source cannot make
 * this allocate three times what the encoder can use.
 */
export async function mediabunnyAudioRange(blob: Blob, range: VideoRange): Promise<AudioBufferLike | null> {
  let input: { dispose?: () => void } | null = null;
  try {
    const m = await import('mediabunny');
    const inp = new m.Input({ formats: [m.MP4, m.QTFF, m.WEBM, m.MATROSKA], source: new m.BlobSource(blob) });
    input = inp;
    const track = await inp.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const rate = track.sampleRate;
    const channels = Math.min(2, Math.max(1, track.numberOfChannels));
    const startSec = Math.max(0, range.startSec);
    const endSec = Math.max(startSec, range.endSec);
    // A window longer than the job's own duration cap is not one this path will hold
    // in PCM. Declining it hands the decision back to the caller (fall back, or drop
    // the sound with a warning); truncating it silently would be worse than either.
    // videoJobRefusal already blocks such a window before a job ever starts.
    if (endSec - startSec > VIDEO_JOB_MAX_DURATION_SEC) return null;
    const length = Math.round((endSec - startSec) * rate);
    if (!(rate > 0) || !(length > 0)) return null;
    const out: Float32Array[] = [];
    for (let c = 0; c < channels; c++) out.push(new Float32Array(length));
    const sink = new m.AudioBufferSink(track);
    let wrote = 0;
    for await (const wrapped of sink.buffers(startSec, endSec)) {
      const buf = wrapped.buffer;
      // A packet straddling the window's start arrives whole; the overlap is placed
      // at a negative destination offset, i.e. its head is skipped rather than the
      // window being shifted later than the user asked for.
      const dst = Math.round((wrapped.timestamp - startSec) * rate);
      const from = dst < 0 ? -dst : 0;
      const at = dst < 0 ? 0 : dst;
      const n = Math.min(buf.length - from, length - at);
      if (n <= 0) continue;
      for (let c = 0; c < channels; c++) {
        const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
        out[c]!.set(src.subarray(from, from + n), at);
      }
      wrote += n;
    }
    if (wrote <= 0) return null;
    return {
      length, numberOfChannels: channels, sampleRate: rate,
      getChannelData: (channel: number): Float32Array => out[Math.min(channel, channels - 1)] as Float32Array,
    };
  } catch {
    return null;
  } finally {
    try { input?.dispose?.(); } catch { /* gone */ }
  }
}

/** A matte transparent-video writer for the three alpha formats:
 *   - WebP/PNG: encode each RGBA frame to a still (alpha kept by canvas.toBlob),
 *     then splice the bitstreams alpha-safe with packWebpAnim / packApng - the
 *     matte's SOFT alpha survives verbatim.
 *   - GIF: keep the RAW RGBA and pack with packGifAlpha at finalize, which thins
 *     the alpha to 1 bit against a reserved transparent index (HARD-edged). */
export function alphaAnimWriter(format: 'webp' | 'png' | 'gif', fps: number): VideoFrameWriter {
  // WebP/PNG store per-frame ENCODED still bytes; GIF stores per-frame RAW RGBA.
  const frames: Uint8Array[] = [];
  let w = 0;
  let h = 0;
  const mime = format === 'webp' ? 'image/webp' : format === 'png' ? 'image/png' : 'image/gif';
  // GIF packs from raw RGBA, so it needs no canvas round-trip.
  const canvas = format === 'gif' ? null : document.createElement('canvas');

  const encodeFrame = async (frame: DecodedFrame): Promise<Uint8Array> => {
    const cv = canvas as HTMLCanvasElement;
    cv.width = frame.width;
    cv.height = frame.height;
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
    const img = ctx.createImageData(frame.width, frame.height);
    img.data.set(frame.data);
    ctx.putImageData(img, 0, 0);
    // quality 1 keeps a near-lossless WebP that still carries its ALPH chunk; PNG
    // is always lossless RGBA. Either way the alpha channel survives untouched.
    const blob = await new Promise<Blob | null>((res) =>
      format === 'webp' ? cv.toBlob((b) => res(b), mime, 1) : cv.toBlob((b) => res(b), mime));
    if (!blob) throw new Error('frame encode failed');
    return new Uint8Array(await blob.arrayBuffer());
  };

  return {
    async write(frame: DecodedFrame): Promise<void> {
      if (!w) { w = frame.width; h = frame.height; }
      // GIF: keep a straight-alpha RGBA copy (frame.data may be reused downstream).
      frames.push(format === 'gif' ? new Uint8Array(frame.data) : await encodeFrame(frame));
    },
    async finalize(): Promise<WriterResult> {
      if (frames.length === 0) throw new Error('no frames');
      const delayMs = Math.max(1, Math.round(1000 / Math.max(1, fps)));
      const bytes = format === 'webp'
        ? packWebpAnim(frames, { delayMs, loops: 0, width: w, height: h })
        : format === 'png'
          ? packApng(frames, { delayMs, loops: 0 })
          : packGifAlpha(frames, { delayMs, loops: 0, width: w, height: h });
      // Copy into a fresh ArrayBuffer-backed view for the Blob.
      const blob = new Blob([bytes.slice()], { type: mime });
      return { blob, format, width: w, height: h };
    },
    abort(): void { frames.length = 0; },
  };
}

/** A chosen alpha video codec: the full WebCodecs string it was probed with, plus the
 *  short mediabunny codec id the CanvasSource is built on. */
export interface AlphaVideoPick { codec: string; muxCodec: 'vp9' | 'av1'; }

/** The alpha-capable WebM ladder, VP9 first (Chromium's well-supported transparent
 *  encoder) then AV1 where the browser has it. Full WebCodecs strings for the probe;
 *  short mediabunny ids for the CanvasSource config. */
const ALPHA_WEBM_LADDER: readonly AlphaVideoPick[] = [
  { codec: 'vp09.00.10.08', muxCodec: 'vp9' },
  { codec: 'av01.0.08M.08', muxCodec: 'av1' },
];

/**
 * The FIRST alpha video codec this browser will actually encode at `width×height@fps`,
 * or null. Alpha encode is a per-browser matrix (Chromium yes, Safari/Firefox usually
 * no), so this is the capability gate the dialog checks before offering "WebM
 * (transparent)" and the driver re-checks at the true ENCODE resolution before building
 * the writer. Probes the WebCodecs `VideoEncoder` global with `alpha:'keep'` - NOT
 * mediabunny, so calling it adds no dynamic import to the dialog-open path. A browser
 * with no VideoEncoder (older Firefox) returns null; a browser that can encode the codec
 * but drops alpha is rejected via the echoed config.
 */
export async function pickAlphaVideoCodec(
  width: number, height: number, fps: number, bitrate: number,
): Promise<AlphaVideoPick | null> {
  const VE = (globalThis as {
    VideoEncoder?: { isConfigSupported?: (c: unknown) => Promise<{ supported?: boolean; config?: { alpha?: string } }> };
  }).VideoEncoder;
  if (!VE?.isConfigSupported) return null;
  for (const pick of ALPHA_WEBM_LADDER) {
    try {
      const s = await VE.isConfigSupported({ codec: pick.codec, width, height, bitrate, framerate: fps, alpha: 'keep' });
      // `supported` alone is not enough: a browser may support the codec while silently
      // normalising alpha away, which would encode an opaque video. Require the echoed
      // config to still carry alpha when it reports one.
      if (s?.supported && s.config?.alpha !== 'discard') return pick;
    } catch { /* try the next candidate */ }
  }
  return null;
}

/** The plan a transparent-video (alpha WebM/Matroska) writer is built from. `codec` is
 *  the short mediabunny id from pickAlphaVideoCodec; `audio` (whole-file only) rides as
 *  an Opus track. */
export interface AlphaWriterPlan {
  fps: number;
  bitrate: number;
  codec: 'vp9' | 'av1';
  container?: 'webm' | 'mkv';
  audio?: AudioBufferLike | null;
}

/** The minimal mediabunny surface alphaVideoWriter drives. The real module satisfies it
 *  structurally; a test supplies a fake so the alpha/audio wiring is checkable with no
 *  real codec (there are none under node). */
interface AlphaMbModule {
  Output: new (o: { format: unknown; target: AlphaMbTarget }) => AlphaMbOutput;
  BufferTarget: new () => AlphaMbTarget;
  WebMOutputFormat: new () => unknown;
  MkvOutputFormat: new () => unknown;
  CanvasSource: new (canvas: HTMLCanvasElement, cfg: { codec: string; bitrate: number; alpha: 'keep' | 'discard' }) => AlphaMbVideoSource;
  AudioBufferSource: new (cfg: { codec: string; bitrate: number }) => AlphaMbAudioSource;
}
interface AlphaMbTarget { buffer: ArrayBuffer; }
interface AlphaMbOutput {
  addVideoTrack(s: AlphaMbVideoSource): void;
  addAudioTrack(s: AlphaMbAudioSource): void;
  start(): Promise<void>;
  finalize(): Promise<void>;
  cancel(): Promise<void>;
}
interface AlphaMbVideoSource { add(timestamp: number, duration?: number): Promise<void>; }
interface AlphaMbAudioSource { add(buffer: AudioBuffer): Promise<void>; }

/** Opus bitrate for the WebM/Matroska audio track (matches the WebCodecs export path). */
const ALPHA_AUDIO_BITRATE = 128_000;

/**
 * A transparent-VIDEO writer: alpha VP9/AV1 in a WebM (or Matroska) container, via
 * mediabunny's CanvasSource (`alpha:'keep'`) + AudioBufferSource. Unlike the WebP/PNG/GIF
 * matte writers this carries SOUND, and unlike the WebCodecs mux path (videoEncodeWriter)
 * it keeps the alpha channel end to end.
 *
 * Two things this writer is careful about:
 *  - FIRST-PACKET ALPHA: WebM/Matroska mark a track transparent from the alpha side data
 *    on the FIRST packet. The 2d context is left alpha-capable (never `{alpha:false}`) and
 *    every frame is written with putImageData, so frame 0 carries an alpha plane and the
 *    track is marked transparent even when that frame is fully opaque.
 *  - NULL AUDIO: the audio track + source exist only when `plan.audio` has samples, so a
 *    matte with no sound produces a valid video rather than crashing on an empty track.
 *
 * The whole thing lazy-inits on the first frame, when the matte's output dimensions are
 * known. `loadMb` defaults to the real lazy mediabunny import (so it never enters the
 * preload bundle); the seam exists so the wiring is unit-testable without a codec.
 */
export async function alphaVideoWriter(
  plan: AlphaWriterPlan,
  loadMb: () => Promise<AlphaMbModule> = async () => (await import('mediabunny')) as unknown as AlphaMbModule,
): Promise<VideoFrameWriter> {
  const mb = await loadMb();
  const isMkv = plan.container === 'mkv';
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: isMkv ? new mb.MkvOutputFormat() : new mb.WebMOutputFormat(), target });
  const canvas = document.createElement('canvas');

  let vSrc: AlphaMbVideoSource | null = null;
  let aSrc: AlphaMbAudioSource | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let w = 0;
  let h = 0;
  let started = false;

  return {
    async write(frame: DecodedFrame): Promise<void> {
      if (!vSrc) {
        // First frame fixes the encode size. Build the alpha video source (+ audio, only
        // when there is sound), declare the tracks, and start - all before any add().
        w = frame.width; h = frame.height;
        canvas.width = w; canvas.height = h;
        ctx = canvas.getContext('2d') as CanvasRenderingContext2D; // alpha-capable (no {alpha:false})
        vSrc = new mb.CanvasSource(canvas, { codec: plan.codec, bitrate: plan.bitrate, alpha: 'keep' });
        output.addVideoTrack(vSrc);
        if (plan.audio && plan.audio.length > 0) {
          aSrc = new mb.AudioBufferSource({ codec: 'opus', bitrate: ALPHA_AUDIO_BITRATE });
          output.addAudioTrack(aSrc);
        }
        await output.start();
        started = true;
      }
      const c = ctx as CanvasRenderingContext2D;
      const img = c.createImageData(w, h);
      img.data.set(frame.data);       // straight-alpha RGBA, alpha plane preserved
      c.putImageData(img, 0, 0);
      await vSrc.add(frame.timestampUs / 1e6, frame.durationUs / 1e6);
    },
    async finalize(): Promise<WriterResult> {
      if (!vSrc) throw new Error('no frames');
      // Audio is one whole-file AudioBuffer (matte-webm keeps sound only on the no-range
      // path, where jobAudio returns a real AudioBuffer). Guarded on aSrc AND plan.audio;
      // a failed audio encode drops the sound rather than failing the whole video.
      if (aSrc && plan.audio && plan.audio.length > 0) {
        try { await aSrc.add(plan.audio as unknown as AudioBuffer); } catch { /* ship the video muted */ }
      }
      await output.finalize();
      const blob = new Blob([target.buffer], { type: isMkv ? 'video/x-matroska' : 'video/webm' });
      return { blob, format: isMkv ? 'mkv' : 'webm', width: w, height: h };
    },
    async abort(): Promise<void> {
      if (!started) return;
      try { await output.cancel(); } catch { /* already down */ }
    },
  };
}

/** A normal-video writer over the streaming WebCodecs mux (crop/upscale). Keeps
 *  `audio` (a decoded AudioBuffer) when the encoder can carry it. */
export async function videoEncodeWriter(
  plan: {
    width: number; height: number; fps: number; bitrate: number;
    audio?: AudioBufferLike | null;
    /** Requested output container. Existing edit jobs default to MP4; Download as
     *  passes the user's explicit MP4/WebM choice. */
    format?: 'mp4' | 'webm';
    /** Refuse a muted result when the source is known to contain audio. */
    requireAudio?: boolean;
  },
): Promise<VideoFrameWriter> {
  const { createStreamingMux } = await import('../bridge/video-encode-core.ts');
  const { pickWebCodecsVideo, pickWebCodecsAudio } = await import('../bridge/video-shared.ts');
  const { codecAdjustedBitrate } = await import('../bridge/video-mime.ts');
  const pick = await pickWebCodecsVideo(plan.format ?? 'mp4', plan.width, plan.height, plan.fps, plan.bitrate);
  if (!pick) throw new Error(t("This browser can't encode video."));
  // The incoming bitrate is the H.264-equivalent target; trim to the picked codec's
  // efficiency so an AV1/HEVC job is not encoded at the wasteful H.264 rate.
  const encBitrate = codecAdjustedBitrate(plan.bitrate, pick.codec);

  let audioDecl: import('../bridge/video-encode-core.ts').EncodeAudio | null = null;
  if (plan.audio && plan.audio.length > 0) {
    const chans = Math.min(2, Math.max(1, plan.audio.numberOfChannels));
    const ac = await pickWebCodecsAudio(pick.container, plan.audio.sampleRate, chans, 128_000);
    if (ac) {
      audioDecl = { channels: [], sampleRate: plan.audio.sampleRate, numberOfChannels: chans, codec: ac.codec, muxCodec: ac.muxCodec, bitrate: 128_000 };
    } else if (plan.requireAudio) {
      throw new Error(t("This browser can't preserve the video's audio in that format."));
    }
  }

  const mux = await createStreamingMux(pick, {
    width: plan.width, height: plan.height, fps: plan.fps, bitrate: encBitrate, audio: audioDecl,
  });

  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  return {
    async write(frame: DecodedFrame): Promise<void> {
      // Frame may already be the plan size (crop/upscale target); putImageData
      // writes it 1:1, and the encoder frame size is fixed at the plan dims.
      if (frame.width === plan.width && frame.height === plan.height) {
        const img = ctx.createImageData(frame.width, frame.height);
        img.data.set(frame.data);
        ctx.putImageData(img, 0, 0);
      } else {
        // Defensive fit (should not happen: ops target the plan dims).
        const tmp = document.createElement('canvas');
        tmp.width = frame.width; tmp.height = frame.height;
        const timg = (tmp.getContext('2d') as CanvasRenderingContext2D).createImageData(frame.width, frame.height);
        timg.data.set(frame.data);
        (tmp.getContext('2d') as CanvasRenderingContext2D).putImageData(timg, 0, 0);
        ctx.clearRect(0, 0, plan.width, plan.height);
        ctx.drawImage(tmp, 0, 0, plan.width, plan.height);
      }
      await mux.addFrame(canvas, frame.timestampUs);
    },
    async finalize(): Promise<WriterResult> {
      if (audioDecl && plan.audio) {
        try { await mux.addAudio(plan.audio); }
        catch (err) {
          if (plan.requireAudio) throw err;
          // Edit jobs retain their historical best-effort behaviour: video is more
          // useful than no result if an optional audio encode fails.
        }
      }
      const blob = await mux.finalize();
      return { blob, format: pick.container, width: plan.width, height: plan.height };
    },
    async abort(reason?: unknown): Promise<void> { await mux.abort(reason); },
  };
}

/** The subset of AudioBuffer videoEncodeWriter needs (structurally satisfied by a
 *  real AudioBuffer; the streaming mux reads the same shape). */
export interface AudioBufferLike {
  length: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

/**
 * Window a decoded audio buffer to `[startSec, endSec)` - the audio half of a
 * range, and the reason a trimmed video is not muxed against the WHOLE clip's
 * sound. Pure and structural: the returned object is an `AudioBufferLike` (and so
 * a `PcmSource`) whose channel data are SUBARRAY VIEWS of the original, so a 2-minute
 * stereo buffer is windowed without copying a single sample.
 *
 * The window is clamped into the buffer, so a range running past the end simply
 * stops at the end; a range that already covers everything returns the ORIGINAL
 * buffer (identity), which keeps the untrimmed path allocation-free.
 */
export function sliceAudio(buf: AudioBufferLike, startSec: number, endSec: number): AudioBufferLike {
  const rate = buf.sampleRate;
  const total = buf.length;
  const s0 = Number.isFinite(startSec) ? startSec : 0;
  const s1 = Number.isFinite(endSec) ? endSec : Infinity;
  const start = Math.max(0, Math.min(total, Math.round(s0 * rate)));
  const end = Math.max(start, Math.min(total, Math.round(s1 * rate)));
  if (start === 0 && end === total) return buf;
  return {
    length: end - start,
    numberOfChannels: buf.numberOfChannels,
    sampleRate: rate,
    getChannelData: (channel: number): Float32Array => buf.getChannelData(channel).subarray(start, end),
  };
}

/** Window `audio` to a request's range, when it has one. The single place every
 *  audio-keeping op (crop, upscale, grade, trim) goes through, so a range can never
 *  reach the muxer as a full-length track against a short video. */
function audioForRange(audio: AudioBufferLike | null, range?: VideoRange): AudioBufferLike | null {
  return audio && range ? sliceAudio(audio, range.startSec, range.endSec) : audio;
}

/** Decode a source video's audio track to one AudioBuffer (kept for crop/upscale).
 *  Returns null when there is no audio or the browser can't decode it. */
export async function decodeSourceAudio(bytes: ArrayBuffer): Promise<AudioBufferLike | null> {
  const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  try {
    const buf = await ctx.decodeAudioData(bytes.slice(0));
    return (buf.length > 0 && buf.numberOfChannels > 0) ? (buf as unknown as AudioBufferLike) : null;
  } catch {
    return null;
  } finally {
    ctx.close().catch(() => { /* already closed */ });
  }
}

// ── Ids + the host surface ───────────────────────────────────────────────────

/** The user-asset record this module writes (mirrors upscale/extract-audio). */
export interface VideoJobAssetRecordInput {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string;
  width?: number;
  height?: number;
  aiGenerated?: 'full' | 'partial';
  meta?: Record<string, unknown>;
}

export interface VideoJobHost extends HostV1 {
  assets: HostV1['assets'] & {
    _uploadUserAsset(record: VideoJobAssetRecordInput): Promise<void>;
  };
}

/** A file-safe id + a display name for a finished job. */
export function videoJobIds(op: VideoOp, sourceName: string, format: string, now: number): { id: string; name: string } {
  const base = sourceName.replace(/\.[a-z0-9]+$/i, '');
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || op;
  const kind = op === 'matte' ? 'cutout' : op === 'grade' ? 'graded' : op === 'trim' ? 'trimmed' : op;
  const shown = base || t('video');
  const label = op === 'matte' ? tRaw('Cutout of {name}', { name: shown })
    : op === 'crop' ? tRaw('Cropped {name}', { name: shown })
    : op === 'grade' ? tRaw('Graded {name}', { name: shown })
    : op === 'trim' ? tRaw('Trimmed {name}', { name: shown })
    : tRaw('Upscaled {name}', { name: shown });
  return { id: `user/video/${now}-${slug}-${kind}.${format}`, name: label };
}

// ── The request + the driver ─────────────────────────────────────────────────

export type VideoJobSource = AssetRef | Blob | string;

export interface VideoJobRequest {
  op: VideoOp;
  source: VideoJobSource;
  sourceName: string;
  matte?: MatteVideoParams;
  crop?: Omit<CropVideoParams, 'rect'> & { rect: CropRect };
  upscale?: UpscaleVideoParams;
  grade?: GradeVideoParams;
  trim?: TrimVideoParams;
  /** The section of the source to work on. Absent = the whole clip. Orthogonal to
   *  the op: a grade or a crop can be windowed too, and a trim is nothing BUT this. */
  range?: VideoRange;
  /** Carried from the source when it discloses AI content (kept on the derivative). */
  aiGeneratedSource?: 'full' | 'partial';
}

/** Injection seam so the whole driver is unit-testable with a fake decode/encode. */
/** The container-level C2PA stamp options runVideoJob assembles (subset of
 *  stampDerivedC2pa's `o`). */
export interface VideoStampOpts {
  title?: string;
  tool: string;
  actions: VideoC2paAction[];
  ingredients?: unknown[];
  dimensions?: string;
}

export interface VideoJobDeps {
  openReader?: (blob: Blob, fps: number, range?: VideoRange) => Promise<VideoFrameReader>;
  openMatteWriter?: (format: 'webp' | 'png' | 'gif', fps: number) => VideoFrameWriter;
  /** The transparent-VIDEO writer (matte → alpha WebM/Matroska with sound). */
  openAlphaVideoWriter?: (plan: AlphaWriterPlan) => Promise<VideoFrameWriter>;
  openVideoWriter?: (plan: {
    width: number; height: number; fps: number; bitrate: number;
    audio?: AudioBufferLike | null; format?: 'mp4' | 'webm'; requireAudio?: boolean;
  }) => Promise<VideoFrameWriter>;
  decodeAudio?: (bytes: ArrayBuffer) => Promise<AudioBufferLike | null>;
  /** Decode only a WINDOW of the source's audio (the bounded path a range takes). */
  decodeAudioRange?: (blob: Blob, range: VideoRange) => Promise<AudioBufferLike | null>;
  fetchBytes?: (source: VideoJobSource) => Promise<{ blob: Blob; bytes: Uint8Array }>;
  /** Extract the source video's own credential as a C2PA ingredient, or null. */
  extractIngredient?: (bytes: Uint8Array) => unknown | null;
  /** Sign the output bytes with the assembled container-level credential. */
  stamp?: (host: VideoJobHost, blob: Blob, format: string, o: VideoStampOpts) => Promise<Blob>;
  /** The lossless keyframe-aligned trim fast path (WP-E). Returns a byte-lossless
   *  packet copy when the window is keyframe-alignable, or null to fall back to the
   *  transcoding trim. Throws AbortError on a genuine cancel. */
  losslessTrim?: (blob: Blob, inSec: number, outSec: number, ctx: LosslessTrimCtx) => Promise<LosslessTrimResult | null>;
}

/** Default ingredient extraction: the source video's preserved C2PA store. */
function defaultExtractIngredient(bytes: Uint8Array): unknown | null {
  const ex = extractC2paStore(bytes);
  return ex ? prepareC2paIngredientFromStore(ex.store, ex.format) : null;
}

/** Default container-level stamp: the shared stampDerivedC2pa (lazily imported so
 *  the pure module stays node-importable). Best-effort - a failed sign ships the
 *  unstamped blob. */
async function defaultStamp(host: VideoJobHost, blob: Blob, format: string, o: VideoStampOpts): Promise<Blob> {
  const { stampDerivedC2pa } = await import('../bridge/export.ts');
  return stampDerivedC2pa(host, blob, format, {
    ...(o.title ? { title: o.title } : {}),
    tool: o.tool,
    actions: o.actions as never,
    ...(o.ingredients ? { ingredients: o.ingredients as never } : {}),
    ...(o.dimensions ? { dimensions: o.dimensions } : {}),
  });
}

/** Default lossless trim (WP-E): wrap the source blob in a mediabunny BlobSource and
 *  run the standalone packet-copy engine. mediabunny AND the engine are imported
 *  lazily (same as every other decode path here) so neither enters the preload
 *  bundle. Returns null when the cut is not keyframe-alignable; throws AbortError on
 *  a genuine cancel - both handled by the caller. */
async function defaultLosslessTrim(blob: Blob, inSec: number, outSec: number, ctx: LosslessTrimCtx): Promise<LosslessTrimResult | null> {
  const { BlobSource } = await import('mediabunny');
  const { losslessTrim } = await import('./lossless-trim.ts');
  return losslessTrim(new BlobSource(blob), inSec, outSec, undefined, ctx);
}

/** A fresh, standalone ArrayBuffer holding a view's bytes (drops any SharedArrayBuffer
 *  / offset ambiguity - decodeAudioData wants a plain, detachable ArrayBuffer). */
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}

/**
 * The audio track a job's writer should carry, decoded the cheapest safe way.
 *
 * Without a range the whole file is decoded, as it always was - the refusal caps a
 * no-range job at 120 seconds, so the whole file IS the window. With a range the
 * source may be arbitrarily long (the cap measures the selection), so the windowed
 * decoder goes first and the whole-file decode is only ever a fallback.
 *
 * When the windowed decode declines, the fallback is gated on the SOURCE's own
 * length: within the duration cap it is the same decode a no-range job would have
 * done, and beyond it the sound is DROPPED with a logged warning rather than
 * risking a gigabyte of PCM to keep a few seconds of it. A reader that reports no
 * source duration (a fake, or a future adapter) keeps the old whole-decode
 * behaviour - only a length the reader actually reports can justify losing sound.
 */
async function jobAudio(
  host: VideoJobHost, req: VideoJobRequest, source: { blob: Blob; bytes: Uint8Array },
  reader: VideoFrameReader, deps: VideoJobDeps,
): Promise<AudioBufferLike | null> {
  const decodeWhole = deps.decodeAudio ?? decodeSourceAudio;
  if (!req.range) return await decodeWhole(toArrayBuffer(source.bytes));
  const windowed = await (deps.decodeAudioRange ?? mediabunnyAudioRange)(source.blob, req.range);
  if (windowed) return windowed;
  const sourceSec = reader.sourceDurationSec;
  if (sourceSec !== undefined && sourceSec > VIDEO_JOB_MAX_DURATION_SEC) {
    host.log?.('warn', 'Video job: the source is too long to decode whole, so this output has no sound', {
      sourceSec, windowSec: req.range.endSec - req.range.startSec,
    });
    return null;
  }
  return audioForRange(await decodeWhole(toArrayBuffer(source.bytes)), req.range);
}

async function defaultFetchBytes(source: VideoJobSource): Promise<{ blob: Blob; bytes: Uint8Array }> {
  let blob: Blob;
  if (source instanceof Blob) blob = source;
  else {
    const url = typeof source === 'string' ? source : source.url;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    blob = await res.blob();
  }
  return { blob, bytes: new Uint8Array(await blob.arrayBuffer()) };
}

/** Options for a container conversion that downloads a file instead of adding a
 *  derived asset to the catalogue. `fps <= 0` preserves the source cadence. */
export interface VideoTranscodeOptions {
  format: 'mp4' | 'webm';
  fps: number;
  /** Exact bits/s. Absent lets the quality stop scale against the decoder-resolved
   *  dimensions and source cadence instead of guessing before the file is opened. */
  bitrate?: number;
  quality?: 'smaller' | 'balanced' | 'best';
}

export interface VideoTranscodeDeps extends Pick<VideoJobDeps, 'fetchBytes' | 'openReader' | 'openVideoWriter' | 'decodeAudio'> {
  hasAudio?: (blob: Blob) => Promise<boolean>;
}

/** Ask the container, not AudioContext, whether a source track exists. A null
 * decode can then mean "unsupported" without being mistaken for "silent". */
async function sourceHasAudio(blob: Blob): Promise<boolean> {
  const m = await import('mediabunny');
  const input = new m.Input({ formats: [m.MP4, m.QTFF, m.WEBM, m.MATROSKA], source: new m.BlobSource(blob) });
  try { return Boolean(await input.getPrimaryAudioTrack()); }
  finally { input.dispose?.(); }
}

/** Decode and re-encode a video into the requested container without saving an
 *  intermediate catalogue asset. Provenance is deliberately a delivery concern:
 *  the caller stamps the returned bytes with the source as an ingredient before
 *  download, using the same shared derived-asset path as image/audio conversion. */
export async function transcodeVideo(
  source: VideoJobSource, opts: VideoTranscodeOptions,
  ctx: PipelineCtx = {}, deps: VideoTranscodeDeps = {},
): Promise<(WriterResult & { fps: number; bitrate: number }) | null> {
  const { blob, bytes } = await (deps.fetchBytes ?? defaultFetchBytes)(source);
  if (bytes.byteLength > VIDEO_JOB_MAX_SOURCE_BYTES) {
    throw new Error(t('This video is too large to process in the browser.'));
  }

  const reader = await (deps.openReader ?? mediabunnyFrameReader)(blob, opts.fps);
  const durationSec = reader.sourceDurationSec ?? (reader.frameCount / Math.max(1, reader.fps));
  const refusal = videoJobRefusal('trim', {
    longEdge: Math.max(reader.width, reader.height), durationSec, bytes: bytes.byteLength,
  });
  if (refusal) { await reader.close(); throw new Error(refusal); }

  const { bppForQuality, videoBitrate } = await import('../bridge/video-mime.ts');
  const bitrate = opts.bitrate ?? videoBitrate(
    evenFloor(reader.width), evenFloor(reader.height), reader.fps,
    bppForQuality(opts.quality ?? 'balanced'),
  );

  let writer: VideoFrameWriter;
  try {
    const hasAudio = await (deps.hasAudio ?? sourceHasAudio)(blob);
    const audio = await (deps.decodeAudio ?? decodeSourceAudio)(toArrayBuffer(bytes));
    if (hasAudio && !audio) throw new Error(t("This browser can't decode the video's audio, so conversion was stopped instead of making a muted file."));
    writer = await (deps.openVideoWriter ?? videoEncodeWriter)({
      width: evenFloor(reader.width), height: evenFloor(reader.height),
      fps: reader.fps, bitrate, audio, format: opts.format, requireAudio: hasAudio,
    });
  } catch (err) {
    await reader.close();
    throw err;
  }
  const piped = await runFramePipeline(reader, (frame) => frame, writer, ctx);
  if (piped.cancelled || !piped.result) return null;
  if (piped.result.format !== opts.format) {
    throw new Error(t('The encoder produced {actual} instead of {requested}.', {
      actual: piped.result.format.toUpperCase(), requested: opts.format.toUpperCase(),
    }));
  }
  return { ...piped.result, fps: reader.fps, bitrate };
}

/**
 * Run one video job end-to-end: fetch → decode → op → encode → stamp → save.
 * Reports progress + honours cancellation through `ctx`. Resolves the saved
 * AssetRef, or null when cancelled before any output.
 *
 * The pure `runFramePipeline` does the frame work; this wires the op, the
 * reader/writer, the source-audio pass-through (crop/upscale), the provenance
 * stamp and the user-asset save around it.
 */
export async function runVideoJob(
  host: VideoJobHost, req: VideoJobRequest, ctx: PipelineCtx & { signal?: AbortSignal } = {}, deps: VideoJobDeps = {},
): Promise<AssetRef | null> {
  const fetchBytes = deps.fetchBytes ?? defaultFetchBytes;
  const { blob: sourceBlob, bytes: sourceBytes } = await fetchBytes(req.source);
  if (sourceBytes.byteLength > VIDEO_JOB_MAX_SOURCE_BYTES) {
    throw new Error(t('This video is too large to process in the browser.'));
  }

  const openReader = deps.openReader ?? mediabunnyFrameReader;

  // Choose the working fps per op. Trim AND grade ask for 0 - "the source's own
  // rate" - because re-timing a clip the user only meant to shorten, or only meant
  // to recolour, is a silent quality change: a 60fps phone clip handed to Grade
  // would come back at 30 with half its frames gone, for an edit that touches no
  // timing at all.
  const fps = req.op === 'matte' ? (req.matte?.fps ?? MATTE_DEFAULT_FPS)
    : req.op === 'crop' ? (req.crop?.fps ?? 30)
    : req.op === 'grade' ? (req.grade?.fps ?? 0)
    : req.op === 'trim' ? (req.trim?.fps ?? 0)
    : (req.upscale?.fps ?? 30);

  const reader = await openReader(sourceBlob, fps, req.range);

  // Stamp the output bytes, save the derived user asset, resolve its ref. The single
  // finish path both the transcode pipeline and the lossless fast path below run
  // through, so they stamp C2PA identically (the source carried as an ingredient) and
  // save the same record shape.
  const finish = async (
    result: WriterResult, prov: VideoProvenance, outFmt: string,
    assetType: AssetRef['type'], animated: boolean,
  ): Promise<AssetRef | null> => {
    const outFormat = outFmt || result.format;
    // Container-level C2PA: stamp the OUTPUT bytes with the op's plain/genAI edit and
    // carry the source video as an ingredient. Best-effort - a failed sign still ships.
    let blob = result.blob;
    try {
      const ingredient = (deps.extractIngredient ?? defaultExtractIngredient)(sourceBytes);
      blob = await (deps.stamp ?? defaultStamp)(host, result.blob, outFormat, {
        title: req.sourceName,
        tool: prov.tool,
        actions: prov.actions,
        ...(ingredient ? { ingredients: [ingredient] } : {}),
        dimensions: `${result.width}×${result.height}`,
      });
    } catch (e) {
      host.log?.('warn', 'Video job: provenance stamp failed', { error: String(e) });
    }

    const now = Date.now();
    const { id, name } = videoJobIds(req.op, req.sourceName, outFormat, now);
    const aiGenerated = prov.aiGenerated ?? req.aiGeneratedSource;
    await host.assets._uploadUserAsset({
      id,
      type: assetType,
      format: outFormat,
      blob,
      width: result.width,
      height: result.height,
      version: '1.0.0',
      ...(aiGenerated ? { aiGenerated } : {}),
      meta: {
        name,
        bytes: blob.size,
        ...(animated ? { animated: true } : {}),
        // A catalog-initiated job is a PLAIN derived asset - NOT tagged 'renders'
        // (that is WP-B's download-path contract only).
      },
    });
    return await host.assets.get(id);
  };

  // ── Lossless trim FAST PATH (plan 153 WP-E/WP-H) ─────────────────────────────
  // Before decoding + re-encoding every frame, try lifting the window out as a
  // byte-lossless, keyframe-aligned packet copy: instant, no generation loss, HDR
  // colour signalling preserved. losslessTrim returns null when the cut is not
  // keyframe-alignable (or the source is unreadable), which is the cue to fall through
  // to the transcoding trim below UNCHANGED. exactBounds is on unless the user opted
  // into keyframe snapping, so a mid-GOP cut keeps its exact bounds (falls back) rather
  // than the fast path silently moving the in-point - a cut already on a keyframe takes
  // the fast path either way. The C2PA stamp is `videoProvenanceFor('trim')`, the exact
  // credential the transcode trim records (finish() above signs both).
  if (req.op === 'trim' && req.range) {
    const doLosslessTrim = deps.losslessTrim ?? defaultLosslessTrim;
    let fast: LosslessTrimResult | null;
    try {
      fast = await doLosslessTrim(sourceBlob, req.range.startSec, req.range.endSec, {
        ...(ctx.signal ? { signal: ctx.signal } : {}),
        ...(ctx.isCancelled ? { isCancelled: ctx.isCancelled } : {}),
        onProgress: (done, total) => ctx.onProgress?.(done, total),
        copyNote: t('Trimming video'),
        exactBounds: !req.trim?.snapToKeyframe,
      });
    } catch (e) {
      // A genuine cancel is the SAME null result the transcode path returns on cancel
      // (runFramePipeline's cancelled branch), never a job failure.
      if ((e as Error | null)?.name === 'AbortError') { await reader.close(); return null; }
      throw e;
    }
    if (fast) {
      // The packet copy decoded nothing; drop the reader we opened only for its dims.
      // The copied track keeps the source's exact display size (no even-dimension snap).
      // ponytail: reader.width/height reuse means a source the browser can't DECODE
      // fails at openReader above even though a packet copy needs no decoder - read the
      // dims from the mediabunny track in defaultLosslessTrim if that source ever matters.
      await reader.close();
      return await finish(
        { blob: fast.blob, format: fast.ext, width: reader.width, height: reader.height },
        videoProvenanceFor('trim'), fast.ext, 'video', false,
      );
    }
    // null → fall through to the transcoding trim below, unchanged.
  }

  // Build the op + the writer per op.
  let op: FrameOp;
  let writer: VideoFrameWriter;
  let outFormat: string;
  let assetType: AssetRef['type'];
  let prov: VideoProvenance;
  let animated = false;

  if (req.op === 'matte') {
    const params = req.matte ?? { model: MATTE_VIDEO_DEFAULT_MODEL, format: 'webp', fps: MATTE_DEFAULT_FPS, longEdge: MATTE_DEFAULT_LONG_EDGE };
    if (params.method === 'chroma') {
      // Deterministic colour key - no host.matte, no model download.
      op = makeChromaKeyOp(params.chroma ?? DEFAULT_CHROMA, params.longEdge);
      prov = videoProvenanceFor('matte', { method: 'chroma' });
    } else {
      const info = host.matte?.models().find((m) => m.id === params.model);
      op = makeMatteOp(host, params, new MatteAlphaSmoother(), ctx.signal);
      prov = videoProvenanceFor('matte', { model: info?.name ?? params.model, version: info?.version });
    }
    if (params.format === 'webm') {
      // Transparent VIDEO: alpha VP9/AV1 in WebM/Matroska, carrying the source audio +
      // container C2PA in ONE file (the WebP/PNG/GIF paths drop sound). Alpha encode is
      // browser-gated, so probe pickAlphaVideoCodec at the true ENCODE resolution -
      // scaledEvenDims of the reader's size, NOT the source's - and refuse where alpha
      // will not encode (the dialog already gated the offer; this is the belt-and-braces
      // for a request that reaches here anyway).
      const dims = scaledEvenDims(reader.width, reader.height, params.longEdge);
      const pick = await pickAlphaVideoCodec(dims.width, dims.height, params.fps, MATTE_WEBM_BITRATE);
      if (!pick) { await reader.close(); throw new Error(t("This browser can't make a transparent video.")); }
      // Sound is kept on the WHOLE-FILE (no-range) path only: AudioBufferSource needs a
      // real AudioBuffer, which jobAudio yields for a no-range job; a windowed decode
      // returns a synthetic view AudioBufferSource can't take. The matte dialog never
      // ranges a matte, so a ranged matte simply ships muted.
      const audio = req.range ? null : await jobAudio(host, req, { blob: sourceBlob, bytes: sourceBytes }, reader, deps);
      writer = await (deps.openAlphaVideoWriter ?? alphaVideoWriter)({ fps: params.fps, bitrate: MATTE_WEBM_BITRATE, codec: pick.muxCodec, audio });
      outFormat = 'webm';
      assetType = 'video';
    } else {
      writer = (deps.openMatteWriter ?? alphaAnimWriter)(params.format, params.fps);
      outFormat = params.format;
      assetType = 'raster';
      animated = true;
    }
  } else if (req.op === 'crop') {
    const params = req.crop ?? { rect: { x: 0, y: 0, w: reader.width, h: reader.height }, fps: 30, bitrate: 8_000_000 };
    const rect = roundCropRect(params.rect, reader.width, reader.height);
    op = makeCropOp(rect);
    const audio = await jobAudio(host, req, { blob: sourceBlob, bytes: sourceBytes }, reader, deps);
    writer = await (deps.openVideoWriter ?? videoEncodeWriter)({ width: rect.w, height: rect.h, fps, bitrate: params.bitrate, audio });
    outFormat = ''; // filled from the writer result
    assetType = 'video';
    prov = videoProvenanceFor('crop');
  } else if (req.op === 'grade') {
    // Same shape as crop: a pure per-frame op at the source's own dimensions, audio
    // kept. The writer takes the READER's fps and the reader's own dimensions snapped
    // DOWN to even: a colour look changes neither timing nor geometry, and an odd
    // displayWidth (an anamorphic PAR, a window-sized screen recording) is exactly
    // what evenFloor exists for - encoders reject odd 4:2:0 dims, and the writer's
    // fit path absorbs the missing row rather than failing the job.
    const params = req.grade ?? {
      cubeText: '', lutIntensity: 1, grain: 0, grainSize: 2, vignette: 0, seed: 1, fps: 0, bitrate: 8_000_000,
    };
    op = makeGradeOp(params);
    const audio = await jobAudio(host, req, { blob: sourceBlob, bytes: sourceBytes }, reader, deps);
    writer = await (deps.openVideoWriter ?? videoEncodeWriter)({
      width: evenFloor(reader.width), height: evenFloor(reader.height), fps: reader.fps, bitrate: params.bitrate, audio,
    });
    outFormat = '';
    assetType = 'video';
    prov = videoProvenanceFor('grade', {
      ...(params.lutLabel ? { lutLabel: params.lutLabel } : {}),
      ...(params.lutCredit ? { lutCredit: params.lutCredit } : {}),
    });
  } else if (req.op === 'trim') {
    // The identity op: every pixel is passed through untouched, and the RANGE (already
    // applied to the reader's grid and the audio slice) is the entire edit. The writer
    // takes the READER's fps - a trim at fps 0 asked the reader to resolve the source
    // rate - and the same even-dimension snap the grade branch above explains.
    const params = req.trim ?? { fps: 0, bitrate: 8_000_000 };
    op = (frame: DecodedFrame): DecodedFrame => frame;
    const audio = await jobAudio(host, req, { blob: sourceBlob, bytes: sourceBytes }, reader, deps);
    writer = await (deps.openVideoWriter ?? videoEncodeWriter)({
      width: evenFloor(reader.width), height: evenFloor(reader.height), fps: reader.fps, bitrate: params.bitrate, audio,
    });
    outFormat = '';
    assetType = 'video';
    prov = videoProvenanceFor('trim');
  } else {
    const params = req.upscale ?? { model: 'realesr-general-x4v3' as UpscaleModelId, fps: 30, bitrate: 12_000_000 };
    const info = host.upscale?.models().find((m) => m.id === params.model);
    const scale = info?.scale ?? 4;
    op = makeUpscaleOp(host, params, ctx.signal);
    const audio = await jobAudio(host, req, { blob: sourceBlob, bytes: sourceBytes }, reader, deps);
    const outW = evenFloor(reader.width * scale);
    const outH = evenFloor(reader.height * scale);
    writer = await (deps.openVideoWriter ?? videoEncodeWriter)({ width: outW, height: outH, fps, bitrate: params.bitrate, audio });
    outFormat = '';
    assetType = 'video';
    prov = videoProvenanceFor('upscale', { model: info?.name ?? params.model, version: info?.version, scale });
  }

  // A range composes with any op (the reader's decode window), so a windowed
  // crop/grade/matte/upscale performed TWO edits and the credential must say so:
  // the op's own action above, plus the trim. The trim op itself already stamps it.
  if (req.range && req.op !== 'trim') {
    prov.actions.push({ action: 'c2pa.edited', description: 'Trimmed to a shorter clip' });
  }

  const piped = await runFramePipeline(reader, op, writer, ctx);
  if (piped.cancelled || !piped.result) return null;
  return await finish(piped.result, prov, outFormat, assetType, animated);
}

/**
 * A cheap up-front probe for the dialog's HONEST estimate (WP-G/H): decode a few
 * frames, run the op on them, and measure the per-frame time + one processed
 * frame's encoded size. `extrapolateEstimate` scales those to the whole clip. All
 * of this is browser-only (real decode/model); it degrades to null on any error,
 * so the dialog never blocks on it. `frameCount` comes back so the caller can
 * extrapolate without re-opening the reader.
 */
export async function probeVideoJob(
  host: VideoJobHost, req: VideoJobRequest, deps: VideoJobDeps = {}, sampleFrames = 3,
): Promise<{ perFrameMs: number; sampleFrameBytes: number; frameCount: number; width: number; height: number } | null> {
  try {
    const fetchBytes = deps.fetchBytes ?? defaultFetchBytes;
    const { blob } = await fetchBytes(req.source);
    const fps = req.op === 'matte' ? (req.matte?.fps ?? MATTE_DEFAULT_FPS)
      : req.op === 'crop' ? (req.crop?.fps ?? 30)
      : req.op === 'grade' ? (req.grade?.fps ?? 0)
      : req.op === 'trim' ? (req.trim?.fps ?? 0)
      : (req.upscale?.fps ?? 30);
    // The same window the real run will use, so the estimate describes the TRIMMED
    // clip rather than the whole source (reader.frameCount is what the caller scales by).
    const reader = await (deps.openReader ?? mediabunnyFrameReader)(blob, fps, req.range);
    let op: FrameOp;
    if (req.op === 'matte') {
      const params = req.matte ?? { model: MATTE_VIDEO_DEFAULT_MODEL, format: 'webp' as const, fps, longEdge: MATTE_DEFAULT_LONG_EDGE };
      op = params.method === 'chroma'
        ? makeChromaKeyOp(params.chroma ?? DEFAULT_CHROMA, params.longEdge)
        : makeMatteOp(host, params, new MatteAlphaSmoother());
    } else if (req.op === 'upscale') {
      const params = req.upscale ?? { model: 'realesr-general-x4v3' as UpscaleModelId, fps, bitrate: 12_000_000 };
      op = makeUpscaleOp(host, params);
    } else if (req.op === 'grade') {
      op = makeGradeOp(req.grade ?? {
        cubeText: '', lutIntensity: 1, grain: 0, grainSize: 2, vignette: 0, seed: 1, fps, bitrate: 8_000_000,
      });
    } else if (req.op === 'trim') {
      // Identity: the probe measures the decode, which is all a trim costs per frame.
      op = (frame: DecodedFrame): DecodedFrame => frame;
    } else {
      op = makeCropOp(roundCropRect(req.crop?.rect ?? { x: 0, y: 0, w: reader.width, h: reader.height }, reader.width, reader.height));
    }
    let count = 0;
    let totalMs = 0;
    let sampleBytes = 0;
    for await (const frame of reader.read()) {
      const t0 = (globalThis.performance ?? Date).now();
      const out = await op(frame);
      totalMs += (globalThis.performance ?? Date).now() - t0;
      if (count === 0) sampleBytes = out.data.length; // raw RGBA; a rough size floor
      count++;
      if (count >= sampleFrames) break;
    }
    await reader.close();
    if (count === 0) return null;
    return { perFrameMs: totalMs / count, sampleFrameBytes: sampleBytes, frameCount: reader.frameCount, width: reader.width, height: reader.height };
  } catch {
    return null;
  }
}

/**
 * Drive a video job through a WP-F job (serial heavy queue + global toast +
 * desktop notification). Returns the JobHandle immediately; the work runs in the
 * background and survives navigating away from the catalog. `onComplete` fires
 * with the saved AssetRef so a still-open view can refresh.
 */
export function runVideoJobAsJob(
  host: VideoJobHost, req: VideoJobRequest,
  hooks: { onComplete?: (ref: AssetRef) => void; onError?: (err: unknown) => void } = {},
  deps: VideoJobDeps = {},
): JobHandle {
  const title = req.op === 'matte' ? t('Removing background')
    : req.op === 'crop' ? t('Cropping video')
    : req.op === 'grade' ? t('Grading video')
    : req.op === 'trim' ? t('Trimming video')
    : t('Upscaling video');
  const controller = new AbortController();
  const job = startJob({ title, cancel: () => controller.abort() });
  void (async (): Promise<void> => {
    await job.started;
    if (job.cancelled) return;
    try {
      const ref = await runVideoJob(host, req, {
        signal: controller.signal,
        isCancelled: () => job.cancelled,
        onProgress: (done, total) => job.progress(done, total),
      }, deps);
      if (job.cancelled) return;
      if (ref) { job.finish(ref); hooks.onComplete?.(ref); }
      else job.finish();
    } catch (err) {
      job.fail(err);
      hooks.onError?.(err);
    }
  })();
  return job;
}
