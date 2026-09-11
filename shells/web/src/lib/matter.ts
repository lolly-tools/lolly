// SPDX-License-Identifier: MPL-2.0
/**
 * The on-device background-removal runner - the ORT half of `host.matte`, the
 * structural twin of lib/upscaler.ts but simpler: a saliency/matting net runs a
 * SINGLE forward pass at its own fixed input size (no seam-tiling), so the work
 * is letterbox → normalize → run → activate → unpad → scale mask back → straight
 * alpha. Worker-only (imports onnxruntime-web); the bridge never loads it on the
 * main thread until an actual run.
 *
 * HONESTY LEDGER (same as upscaler.ts): none of the ORT path has been run in
 * this environment - the dev box has no matte weights and no test can drive
 * onnxruntime-web headlessly. The PURE math below (letterbox geometry,
 * per-model normalization, activation, mask→alpha) IS unit-tested
 * (lib/matter.test.ts); the orchestration around it is verified by hand once a
 * model is staged. Per-model normalization + activation come from
 * MATTE_MODEL_SPEC and MUST be confirmed against the real ONNX before staging - 
 * a wrong mean/std or activation degrades the matte silently, never crashes.
 */

import type { MatteFeasibility, MatteFrame, MatteModelId, MatteOpts, MatteProgress } from '@lolly-tools/core/host-v1';
import {
  createDebugLogger, createModelFetcher, loadOrt, makeCanvas, serializeSessionCreate,
  type FetchProgress,
} from './ort.ts';
import {
  MATTE_MODEL_CACHE_VERSION, MATTE_MODEL_DIR, MATTE_MODEL_FILES,
  MATTE_MODEL_SPEC, MATTE_MODEL_STORE, resolveMatteModel, type MatteModelSpec,
} from './matte-models.ts';
import {
  activateMask, packNchwNormalized, planLetterbox, type LetterboxPlan,
} from '../../../../packages/node-shell/src/ml/matte-math.ts';

type OrtModule = typeof import('onnxruntime-web');
type InferenceSession = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;

const dbg = createDebugLogger({ tag: 'matte', storageKey: 'lolly:matte:debug', globalFlag: '__MATTE_DEBUG__' });
const fetchModelBytes = createModelFetcher({
  store: MATTE_MODEL_STORE, dir: MATTE_MODEL_DIR, version: MATTE_MODEL_CACHE_VERSION, dbg,
});

// ─── backend probe ───────────────────────────────────────────────────────────
//
// Matte is WASM-ONLY, unlike the upscaler. ort-web's WebGPU (JSEP) kernels throw
// "using ceil() in shape computation is not yet supported for MaxPool" at run() on
// these saliency/segmentation nets - AFTER a clean create, so a create-time EP
// fallback can't catch it (see loadSession). Rather than per-model EP juggling the
// whole roster runs on the CPU/WASM kernels (which handle it, verified in
// onnxruntime-node). So we never claim webgpu: the reported backend and the EP the
// session actually runs on stay in sync, and the meter never promises a GPU path
// that would fail at inference.

let backendProbed: 'webgpu' | 'wasm' | null | undefined;

export async function probeBackend(): Promise<'webgpu' | 'wasm' | null> {
  if (backendProbed !== undefined) return backendProbed;
  backendProbed = typeof WebAssembly !== 'undefined' ? 'wasm' : null;
  return backendProbed;
}
/** The resolved backend without re-probing (null until probeBackend ran). */
export function currentBackend(): 'webgpu' | 'wasm' | null {
  return backendProbed ?? null;
}

/** A DOMException-shaped AbortError (with a plain-Error fallback for old runtimes). */
export function abortError(msg = 'The matte run was aborted.'): Error {
  try { return new DOMException(msg, 'AbortError'); }
  catch { return Object.assign(new Error(msg), { name: 'AbortError' }); }
}

/** Raised when a run is requested but the model's weights aren't on device. */
export class ModelNotInstalledError extends Error {
  readonly model: MatteModelId;
  constructor(model: MatteModelId) {
    super(`The ${model} matte model isn't downloaded on this device yet.`);
    this.name = 'ModelNotInstalledError';
    this.model = model;
  }
}

// ─── session cache ────────────────────────────────────────────────────────────

const sessionCache = new Map<string, Promise<InferenceSession | null>>();

/** Load (once) the ONNX session for a model file, or null when its bytes aren't
 *  on device yet. Never throws - a missing/failed model is 'not-installed'. */
function loadSession(fileName: string, onDownload?: (p: FetchProgress) => void): Promise<InferenceSession | null> {
  let entry = sessionCache.get(fileName);
  if (entry) return entry;
  entry = (async (): Promise<InferenceSession | null> => {
    const bytes = await fetchModelBytes(fileName, false, onDownload);
    if (!bytes) return null;
    const ort: OrtModule = await loadOrt();
    await probeBackend();
    // WASM only - deliberately. The roster's MaxPool ceil_mode isn't supported by
    // ort-web's WebGPU kernels and throws at run() (AFTER a clean create, so an
    // EP fallback at create time can't catch it - this is exactly the bug that made
    // both models fail with the ceil()/MaxPool error). The CPU/WASM kernels handle
    // ceil_mode correctly (verified on the real graphs in onnxruntime-node). If a
    // future model exports ceil-free, reintroduce webgpu per-model, not roster-wide.
    try {
      return await serializeSessionCreate(() =>
        ort.InferenceSession.create(new Uint8Array(bytes), {
          executionProviders: ['wasm'] as never,
          // GPU-resident output tensors read back empty; force CPU (upscaler's lesson).
          preferredOutputLocation: 'cpu' as never,
        }));
    } catch (e) {
      dbg('session', { file: fileName, error: String(e) });
      return null;
    }
  })();
  sessionCache.set(fileName, entry);
  entry.then((s) => { if (!s) sessionCache.delete(fileName); }, () => sessionCache.delete(fileName));
  return entry;
}

/** Are a model's bytes already on device? Never downloads. A retired id resolves to
 *  the default, so the answer is about a file that exists rather than a probe for
 *  `/models/matte/undefined`. */
export async function modelCached(id: MatteModelId): Promise<boolean> {
  const bytes = await fetchModelBytes(MATTE_MODEL_FILES[resolveMatteModel(id)], true);
  return !!bytes;
}

// ─── PURE math (unit-tested; no DOM, no ORT) ─────────────────────────────────
//
// The letterbox geometry, the per-model normalization and the mask activation
// MOVED to packages/node-shell/src/ml/matte-math.ts (2026-09-03, plans/183 WS2)
// so the Node matte runner reuses the exact same numbers instead of carrying a
// second copy. They are re-exported here unchanged: lib/matter.test.ts and every
// call site below still import them from this module.
export { activateMask, packNchwNormalized, planLetterbox } from '../../../../packages/node-shell/src/ml/matte-math.ts';
export type { LetterboxPlan } from '../../../../packages/node-shell/src/ml/matte-math.ts';

// ─── the run ──────────────────────────────────────────────────────────────────

export interface MatteRunCtx {
  checkAbort(): void;
  onProgress?: (p: MatteProgress) => void;
}

const ABS_MAX_EDGE = 12000;
const ABS_MAX_PIXELS = 40_000_000;

function deviceMemoryGb(): number {
  return (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
}

/** Feasibility, before any bytes move. Never throws. */
export function canRun(src: { width: number; height: number }, opts: MatteOpts = {}): MatteFeasibility {
  try {
    const longEdge = Math.max(src.width, src.height);
    const cap = Math.min(longEdge, opts.maxEdge ?? longEdge);
    const scale = cap / longEdge;
    const outW = Math.round(src.width * scale), outH = Math.round(src.height * scale);
    if (outW > ABS_MAX_EDGE || outH > ABS_MAX_EDGE || outW * outH > ABS_MAX_PIXELS) {
      return { ok: false, reason: 'too-large', message: 'This image is too large to process on this device.',
        suggestedMaxEdge: Math.min(ABS_MAX_EDGE, Math.floor(Math.sqrt(ABS_MAX_PIXELS))) };
    }
    if (currentBackend() === null && typeof WebAssembly === 'undefined') {
      return { ok: false, reason: 'no-backend', message: 'This browser can’t run the model.' };
    }
    // Rough peak: source RGBA + output RGBA + model input tensor + output mask.
    const model = MATTE_MODEL_SPEC[resolveMatteModel(opts.model)];
    const edge = model.inputSize[0];
    const peak = src.width * src.height * 4 + outW * outH * 4 + edge * edge * 3 * 4 + edge * edge * 4;
    const budget = deviceMemoryGb() * 1024 * 1024 * 1024 * 0.25;
    if (peak > budget) {
      return { ok: false, reason: 'memory', message: 'Not enough memory for an image this size - try a smaller export size.',
        suggestedMaxEdge: Math.max(512, Math.floor(cap * 0.7)) };
    }
    return { ok: true };
  } catch {
    return { ok: true }; // an estimate failure never blocks the run
  }
}

// The letterbox/normalize (in) and activate/unpad/scale/compose (out) halves are
// split out so BOTH the wasm runner below and the desktop NATIVE override
// (shells/tauri-desktop/bridge-overrides/matte.ts) reuse the exact same geometry - 
// the fiddly canvas math has ONE source of truth, and only the inference call in
// the middle differs (ort-web session.run vs. a native ORT invoke()).

/** Everything preprocessMatte produces that postprocessMatte needs to reassemble
 *  the cutout from the model's raw mask. */
export interface MattePre {
  /** Work-size source RGBA (identity when uncapped) - the final RGB planes. */
  workRgba: Uint8ClampedArray;
  workW: number;
  workH: number;
  /** Letterbox placement of the work image inside the model square. */
  plan: LetterboxPlan;
  /** NCHW [1,3,edge,edge] float32, normalized per the spec - the model input. */
  input: Float32Array;
  /** Model square edge (spec.inputSize[0]). */
  edge: number;
  /** The model spec (its activation is read back in postprocessMatte). */
  spec: MatteModelSpec;
}

/** Source frame → the model's normalized NCHW input, keeping the work-size RGB and
 *  letterbox plan needed to reassemble the matte. `maxEdge` caps the OUTPUT (the RGB
 *  is byte-identical when uncapped); the model input is always its fixed square. */
export function preprocessMatte(frame: MatteFrame, spec: MatteModelSpec, opts: MatteOpts = {}): MattePre {
  const edge = spec.inputSize[0];
  const longEdge = Math.max(frame.width, frame.height);
  const cap = Math.min(longEdge, opts.maxEdge ?? longEdge);
  const wScale = cap / longEdge;
  const workW = Math.max(1, Math.round(frame.width * wScale));
  const workH = Math.max(1, Math.round(frame.height * wScale));

  // Source → work canvas (identity when uncapped), kept for the final RGB.
  const workCanvas = makeCanvas(workW, workH);
  const workCtx = workCanvas.getContext('2d') as CanvasRenderingContext2D;
  const srcImage = new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height);
  if (workW === frame.width && workH === frame.height) {
    workCtx.putImageData(srcImage, 0, 0);
  } else {
    const tmp = makeCanvas(frame.width, frame.height);
    (tmp.getContext('2d') as CanvasRenderingContext2D).putImageData(srcImage, 0, 0);
    workCtx.imageSmoothingQuality = 'high';
    workCtx.drawImage(tmp as unknown as CanvasImageSource, 0, 0, workW, workH);
  }
  const workRgba = workCtx.getImageData(0, 0, workW, workH).data;

  // Letterbox the work image into the model's square input.
  const plan = planLetterbox(workW, workH, edge);
  const inCanvas = makeCanvas(edge, edge);
  const inCtx = inCanvas.getContext('2d') as CanvasRenderingContext2D;
  inCtx.fillStyle = '#000';
  inCtx.fillRect(0, 0, edge, edge);
  inCtx.imageSmoothingQuality = 'high';
  inCtx.drawImage(workCanvas as unknown as CanvasImageSource, plan.offsetX, plan.offsetY, plan.contentW, plan.contentH);
  const inRgba = inCtx.getImageData(0, 0, edge, edge).data;

  const input = packNchwNormalized(inRgba, edge, spec);
  return { workRgba, workW, workH, plan, input, edge, spec };
}

/** The model's single-channel output → the finished straight-alpha cutout:
 *  activate → unpad → scale the mask back to work size → compose over the work RGB. */
export function postprocessMatte(rawMask: ArrayLike<number>, pre: MattePre): MatteFrame {
  const { workRgba, workW, workH, plan, edge, spec } = pre;
  // Activate to a 0..1 mask at model resolution.
  const maskEdge = activateMask(rawMask, edge * edge, spec.activation);

  // Unpad (crop the content rect) → grayscale ImageData → scale to work size.
  const maskCanvas = makeCanvas(plan.contentW, plan.contentH);
  const maskCtx = maskCanvas.getContext('2d') as CanvasRenderingContext2D;
  const maskImg = maskCtx.createImageData(plan.contentW, plan.contentH);
  for (let y = 0; y < plan.contentH; y++) {
    for (let x = 0; x < plan.contentW; x++) {
      const v = Math.round(Math.min(1, Math.max(0, maskEdge[(plan.offsetY + y) * edge + (plan.offsetX + x)]!)) * 255);
      const o = (y * plan.contentW + x) * 4;
      maskImg.data[o] = maskImg.data[o + 1] = maskImg.data[o + 2] = v;
      maskImg.data[o + 3] = 255;
    }
  }
  maskCtx.putImageData(maskImg, 0, 0);
  const scaledMaskCanvas = makeCanvas(workW, workH);
  const scaledMaskCtx = scaledMaskCanvas.getContext('2d') as CanvasRenderingContext2D;
  scaledMaskCtx.imageSmoothingQuality = 'high';
  scaledMaskCtx.drawImage(maskCanvas as unknown as CanvasImageSource, 0, 0, workW, workH);
  const scaledMask = scaledMaskCtx.getImageData(0, 0, workW, workH).data;

  // Compose: work RGB (untouched) + mask as straight alpha.
  const outData = new Uint8ClampedArray(workW * workH * 4);
  for (let i = 0; i < workW * workH; i++) {
    const o = i * 4;
    outData[o] = workRgba[o]!;
    outData[o + 1] = workRgba[o + 1]!;
    outData[o + 2] = workRgba[o + 2]!;
    outData[o + 3] = scaledMask[o]!; // R of the grayscale mask is the alpha
  }
  return { width: workW, height: workH, data: outData };
}

/** Run the matte on the WASM (ort-web) path. Returns a MatteFrame whose RGB is the
 *  (work-size) source and alpha is the computed matte. Rejects on abort; throws
 *  ModelNotInstalledError when the model isn't on device yet (the caller shows the
 *  download/consent path). The desktop shell overrides this for the native-only
 *  heavyweight - see shells/tauri-desktop/bridge-overrides/matte.ts. */
export async function runMatte(frame: MatteFrame, opts: MatteOpts, ctx: MatteRunCtx): Promise<MatteFrame> {
  ctx.checkAbort();
  // A saved project or a `?model=` link can still name a RETIRED model (the roster
  // narrows; ids do not). Resolving before the lookup is what turns that into a
  // slightly-different matte plus a console line, instead of a TypeError on
  // `spec.inputSize` or a download of `/models/matte/undefined` that never resolves.
  const id = resolveMatteModel(opts.model);
  const spec = MATTE_MODEL_SPEC[id];
  const edge = spec.inputSize[0];

  const session = await loadSession(MATTE_MODEL_FILES[id], (p) =>
    ctx.onProgress?.({ phase: 'download', loaded: p.loaded, total: p.total }));
  if (!session) throw new ModelNotInstalledError(id);
  ctx.checkAbort();
  ctx.onProgress?.({ phase: 'inference', fraction: 0 });

  const pre = preprocessMatte(frame, spec, opts);
  ctx.checkAbort();

  // Normalize → run.
  const ort = await loadOrt();
  const tensor = new ort.Tensor('float32', pre.input, [1, 3, edge, edge]);
  const result = await session.run({ [session.inputNames[0]!]: tensor });
  ctx.checkAbort();
  const out = result[session.outputNames[0]!]!;
  // Tensor data is a numeric TypedArray for a float mask (never the string[] the
  // union allows - that is text/int-tensor territory); getData() defends against a
  // GPU-resident buffer the way runModel does in upscaler.ts.
  const raw = (typeof out.getData === 'function' ? await out.getData(false) : out.data) as unknown as Float32Array;
  ctx.onProgress?.({ phase: 'inference', fraction: 0.85 });

  const frameOut = postprocessMatte(raw, pre);
  ctx.onProgress?.({ phase: 'inference', fraction: 1 });
  return frameOut;
}
