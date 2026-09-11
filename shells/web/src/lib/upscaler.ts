// SPDX-License-Identifier: MPL-2.0
/**
 * On-device AI image upscaler - the onnxruntime-web RUNNER half of
 * `host.upscale` (v1.101). Real-ESRGAN (general fast / x4plus quality) and
 * GFPGAN face restore, tiled to bound memory, alpha-aware, WebGPU→WASM.
 *
 * LAZY + WORKER-ONLY BY DESIGN: this module is only ever reached from
 * lib/upscale-worker.ts (which bridge/upscale.ts spawns). That keeps
 * onnxruntime-web (multi-MB before it fetches a model) and the tens-to-hundreds
 * of MB of ONNX weights entirely out of the boot budget AND off the thread a
 * tool is being typed into - a phone run is multi-second per tile. It reuses the
 * shared ORT plumbing (lib/ort.ts): one memoised runtime + init mutex (so it
 * can't race the /verify deep-scan detectors' initWasm), the fetch-once /
 * IndexedDB-forever model cache (with its HTML-poisoning guard), and the
 * canvas/tensor helpers. Everything here runs against OffscreenCanvas - no
 * document - so it is worker-safe.
 *
 * ── Adaptive backend ─────────────────────────────────────────────────────────
 * Per-session `executionProviders: ['webgpu','wasm']` with
 * `preferredOutputLocation: 'cpu'`. That output location is required: a
 * WebGPU gpu-resident output tensor's `.data` is empty (its getter throws), so
 * the detectors dropped WebGPU entirely - forcing CPU output fixes it and lets
 * us keep WebGPU's big speed-up. `navigator.gpu` is probed once; a session-create
 * failure under WebGPU falls the WHOLE runner back to wasm-only.
 *
 * ── Honesty ledger ───────────────────────────────────────────────────────────
 * NOTHING in this file has been run - there is no ONNX runtime, model, WebGPU
 * adapter or browser in the dev environment. The tiling/alpha/compose maths is
 * ordinary and reviewable; the model I/O contracts (tensor names, channel order,
 * GFPGAN normalization) are researched but UNVERIFIED end-to-end. Assumptions
 * are documented inline. Every "no model on device" path degrades softly (a
 * missing model → an honest reject from run(), never half output); run() rejects
 * only on a real failure or an abort.
 */

import type {
  UpscaleFeasibility, UpscaleFrame, UpscaleModelId, UpscaleModelInfo, UpscaleOpts, UpscaleProgress,
} from '@lolly-tools/core/host-v1';
import { openDB } from '../bridge/db.ts';
import {
  createDebugLogger, createModelFetcher, loadOrt, makeCanvas, packNchw01, serializeSessionCreate,
  type FetchProgress,
} from './ort.ts';
import {
  GFPGAN_FACE_SIZE, UPSCALE_DEFAULT_MODEL, UPSCALE_FACE_DETECT_FILE, UPSCALE_MODEL_CACHE_VERSION,
  UPSCALE_MODEL_DIR, UPSCALE_MODEL_FILES, UPSCALE_MODEL_STORE, UPSCALE_WDN_FILE, upscaleModel,
} from './upscale-models.ts';
// The tiling geometry, the target plan, the denoise blend and the memory estimate
// MOVED to packages/node-shell/src/ml/upscale-math.ts (2026-09-03, plans/183 WS2)
// so the Node upscaler tiles identically instead of carrying a second copy. The
// device RAM figure is passed IN (navigator.deviceMemory here, os.totalmem there).
import {
  ABS_MAX_EDGE, ABS_MAX_PIXELS, blendPlanes, clamp255, estimatePeakBytes, hasAlpha,
  planTarget, planTiles, planesToRgba, tileEdgeFor, type Target,
} from '../../../../packages/node-shell/src/ml/upscale-math.ts';

// ── Diagnostics (gated; console.debug - host.log isn't in scope in a lazy lib) ─
const dbg = createDebugLogger({
  tag: 'upscale', storageKey: 'lolly:upscale:debug', globalFlag: '__UPSCALE_DEBUG__',
});

// ── Model bytes: fetch-once, IndexedDB-forever (shared coordinates with the
//    Andy-run scripts/fetch-upscale-models.ts - see lib/upscale-models.ts). ────
const fetchModelBytes = createModelFetcher({
  store: UPSCALE_MODEL_STORE, dir: UPSCALE_MODEL_DIR, version: UPSCALE_MODEL_CACHE_VERSION, dbg,
});

// ── ORT structural types (no static onnxruntime-web import - see lib/trustmark.ts) ─
type OrtModule = typeof import('onnxruntime-web');
type InferenceSession = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;
type OrtTensor = Awaited<ReturnType<InferenceSession['run']>>[string];

/** The run context the worker threads through: progress fan-out + the only safe
 *  abort check (between tiles - a tile mid-inference can't be preempted in-wasm/gpu). */
export interface RunContext {
  onProgress?: (p: UpscaleProgress) => void;
  /** Throws an AbortError when the caller has signalled abort. Called between tiles. */
  checkAbort: () => void;
}

/** A DOMException-style AbortError so `err.name === 'AbortError'` works like fetch. */
export function abortError(message = 'upscale aborted'): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException(message, 'AbortError')
    : Object.assign(new Error(message), { name: 'AbortError' });
}

// ── Backend probe (once) ─────────────────────────────────────────────────────

let resolvedBackend: 'webgpu' | 'wasm' | null = null;
let backendProbe: Promise<'webgpu' | 'wasm' | null> | null = null;
let webgpuFailed = false; // latched if a WebGPU session-create ever faults

/** Resolve the execution backend once: WebGPU when an adapter is grantable, else
 *  wasm, else null (no runtime at all). A later WebGPU session failure downgrades
 *  the resolved value to wasm for the rest of the session. */
export function probeBackend(): Promise<'webgpu' | 'wasm' | null> {
  if (!backendProbe) {
    backendProbe = (async (): Promise<'webgpu' | 'wasm' | null> => {
      const hasWasm = typeof WebAssembly !== 'undefined';
      let gpu = false;
      try {
        const g = (navigator as unknown as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
        if (g && typeof g.requestAdapter === 'function') gpu = !!(await g.requestAdapter());
      } catch { gpu = false; }
      resolvedBackend = gpu && !webgpuFailed ? 'webgpu' : hasWasm ? 'wasm' : null;
      dbg('backend', { gpu, hasWasm, resolved: resolvedBackend });
      return resolvedBackend;
    })();
  }
  return backendProbe;
}

/** The backend resolved so far, or null before the first probe. Sync - for the
 *  bridge's `UpscaleAPI.backend()` (the worker echoes it back after a probe). */
export function currentBackend(): 'webgpu' | 'wasm' | null {
  return resolvedBackend;
}

// ── Sessions: one per model file, memoised ───────────────────────────────────

const sessionCache = new Map<string, Promise<InferenceSession | null>>();

/**
 * Load (fetch + create) one model session, memoised by file name. Download
 * progress from the FIRST caller is reported via `onDownload`; a cache hit or
 * later callers skip straight to a resident session. Returns null when the file
 * isn't on device and can't be fetched (offline / never staged) - never throws
 * for that; only a genuine runtime fault rejects.
 */
function loadSession(fileName: string, onDownload?: (p: FetchProgress) => void): Promise<InferenceSession | null> {
  const existing = sessionCache.get(fileName);
  if (existing) return existing;
  const pending = (async (): Promise<InferenceSession | null> => {
    const ort = await loadOrt();
    const bytes = await fetchModelBytes(fileName, false, onDownload);
    if (!bytes) { dbg('session', { file: fileName, status: 'not-installed' }); return null; }
    const backend = await probeBackend();
    const wantGpu = backend === 'webgpu' && !webgpuFailed;
    const providers = wantGpu ? ['webgpu', 'wasm'] : ['wasm'];
    try {
      // serializeSessionCreate: two concurrent FIRST InferenceSession.create()
      // calls trip ORT's one-time initWasm() (why the /verify detectors serialise
      // theirs). We share ort.ts's module + mutex, so a future concurrent caller
      // (batch upscaling, a tool firing host.upscale.run in parallel) can't race it.
      const session = await serializeSessionCreate(() => ort.InferenceSession.create(new Uint8Array(bytes), {
        executionProviders: providers,
        preferredOutputLocation: 'cpu', // gpu-resident .data is empty - see header
      }));
      dbg('session', { file: fileName, status: 'ok', providers });
      return session;
    } catch (err) {
      if (wantGpu) {
        // WebGPU couldn't build a session here - downgrade the whole runner to
        // wasm and retry once (matches the detectors' "wasm is the floor" stance).
        webgpuFailed = true;
        resolvedBackend = 'wasm';
        backendProbe = Promise.resolve('wasm');
        dbg('session', { file: fileName, status: 'webgpu-fail-retry-wasm', error: (err as Error)?.message });
        const session = await serializeSessionCreate(() => ort.InferenceSession.create(new Uint8Array(bytes), {
          executionProviders: ['wasm'], preferredOutputLocation: 'cpu',
        }));
        return session;
      }
      throw err;
    }
  })();
  sessionCache.set(fileName, pending);
  // Don't make a miss/failure sticky - a later run after the model is staged
  // should pick it up.
  void pending.then((s) => { if (!s) sessionCache.delete(fileName); }, () => sessionCache.delete(fileName));
  return pending;
}

/** Are a model's primary bytes already on device? A cheap key-presence probe - 
 *  never reads (or fetches) the multi-MB blob. */
export async function modelCached(id: UpscaleModelId): Promise<boolean> {
  try {
    const db = await openDB();
    const key = await db.getKey(UPSCALE_MODEL_STORE, UPSCALE_MODEL_FILES[id]);
    return key !== undefined;
  } catch { return false; }
}

// ── Canvas helpers (OffscreenCanvas - worker-safe) ───────────────────────────

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
function ctx2d(canvas: AnyCanvas): CanvasRenderingContext2D {
  const c = canvas.getContext('2d') as unknown as CanvasRenderingContext2D | null;
  if (!c) throw new Error('no 2d context');
  return c;
}

/** Straight-alpha RGBA → a canvas holding those pixels. */
function frameToCanvas(data: Uint8ClampedArray, w: number, h: number): AnyCanvas {
  const c = makeCanvas(w, h);
  // ImageData rejects a SharedArrayBuffer-backed view - copy into a plain one.
  const clamped = new Uint8ClampedArray(data.length);
  clamped.set(data);
  ctx2d(c).putImageData(new ImageData(clamped, w, h), 0, 0);
  return c;
}

// ── Model inference: one tensor in, a Float32 plane-major output out ──────────

/** Run one session on an NCHW [1,3,H,W] float32 [0,1] tensor; return its output
 *  as a plane-major Float32Array (R plane, G plane, B plane) plus the output
 *  H/W. Reads CPU-resident data (preferredOutputLocation:'cpu'); defensively
 *  pulls the async CPU copy if a tensor still reports gpu-buffer. */
async function runModel(
  ort: OrtModule, session: InferenceSession, input: Float32Array, w: number, h: number,
): Promise<{ data: Float32Array; w: number; h: number }> {
  const inName = session.inputNames[0];
  const outName = session.outputNames[0];
  if (!inName || !outName) throw new Error('model has no input/output tensor');
  const tensor = new ort.Tensor('float32', input, [1, 3, h, w]);
  const results = await session.run({ [inName]: tensor });
  const out: OrtTensor | undefined = results[outName] ?? results[Object.keys(results)[0] ?? ''];
  if (!out) throw new Error('model produced no output');
  let raw: Float32Array;
  if (out.location === 'cpu') raw = out.data as Float32Array;
  else if (typeof out.getData === 'function') raw = (await out.getData(false)) as Float32Array;
  else raw = out.data as Float32Array;
  // dims [1,3,outH,outW]
  const dims = out.dims;
  const outH = Number(dims[dims.length - 2]);
  const outW = Number(dims[dims.length - 1]);
  return { data: raw, w: outW, h: outH };
}

/** The shared crop, wrapped back into the ImageData the canvas path draws with. */
function planesToImageData(
  planes: Float32Array, srcW: number, srcH: number,
  cropX: number, cropY: number, cropW: number, cropH: number,
): ImageData {
  return new ImageData(planesToRgba(planes, srcW, srcH, cropX, cropY, cropW, cropH), cropW, cropH);
}

// ── Tiling ───────────────────────────────────────────────────────────────────

/**
 * Tile `src` (an w×h RGB canvas) through the model(s) at native scale into a
 * fresh (w·scale)×(h·scale) canvas. Padding each tile by TILE_OVERLAP and
 * cropping the ×scale margin back off hides seams. Emits an inference-phase
 * progress per tile and checks abort BETWEEN tiles.
 */
async function tileThroughModel(
  ort: OrtModule, session: InferenceSession, wdnSession: InferenceSession | null, denoise: number,
  src: AnyCanvas, w: number, h: number, scale: number, ctx: RunContext,
): Promise<AnyCanvas> {
  const backend = (await probeBackend()) ?? 'wasm';
  const T = tileEdgeFor(backend === 'webgpu' ? 'webgpu' : 'wasm', deviceMemoryGb());
  const sctx = ctx2d(src);
  const outW = w * scale, outH = h * scale;
  const out = makeCanvas(outW, outH);
  const octx = ctx2d(out);

  // The tile grid (core rect + padded window per tile) is the shared plan, so the
  // Node runner cuts the image at exactly the same seams.
  const tiles = planTiles(w, h, T);
  const total = tiles.length;
  let idx = 0;

  for (const { cx, cy, cw, ch, px0, py0, pw, ph } of tiles) {
    ctx.checkAbort(); // only safe preemption point

    const inData = sctx.getImageData(px0, py0, pw, ph).data;
    const input = packNchw01(inData, pw, ph);
    const base = await runModel(ort, session, input, pw, ph);
    let planes = base.data;
    if (wdnSession && denoise > 0) {
      const wdn = await runModel(ort, wdnSession, input, pw, ph);
      if (wdn.data.length === base.data.length) planes = blendPlanes(base.data, wdn.data, denoise);
    }

    // Crop the padded margin (×scale) back off, keep the tile core.
    const mx = (cx - px0) * scale, my = (cy - py0) * scale;
    const coreW = cw * scale, coreH = ch * scale;
    const core = planesToImageData(planes, base.w, base.h, mx, my, coreW, coreH);
    octx.putImageData(core, cx * scale, cy * scale);

    idx++;
    ctx.onProgress?.({ phase: 'inference', tile: idx, tiles: total, fraction: idx / total });
  }
  dbg('tile', { tiles: total, tile: T, in: [w, h], out: [outW, outH] });
  return out;
}

// ── Target geometry (scale + targetMaxEdge): planTarget, shared ──────────────

/** Compose the model's RGB output canvas with a bilinear-upscaled alpha plane
 *  (when the source had one), then downscale to the final size if needed, and
 *  read out the RGBA UpscaleFrame. */
function finalize(
  rgbOut: AnyCanvas, srcCanvas: AnyCanvas, needAlpha: boolean, target: Target,
): UpscaleFrame {
  const { outW, outH, finalW, finalH, downscale } = target;
  // Composite alpha at native output size.
  if (needAlpha) {
    const octx = ctx2d(rgbOut);
    const rgb = octx.getImageData(0, 0, outW, outH);
    // Bilinear-upscale the source's alpha by drawing the source scaled up and
    // reading only its alpha channel (RGB there is discarded).
    const aCanvas = makeCanvas(outW, outH);
    const actx = ctx2d(aCanvas);
    actx.imageSmoothingEnabled = true;
    actx.imageSmoothingQuality = 'high';
    actx.drawImage(srcCanvas as CanvasImageSource, 0, 0, outW, outH);
    const alpha = actx.getImageData(0, 0, outW, outH).data;
    for (let i = 3; i < rgb.data.length; i += 4) rgb.data[i] = alpha[i] as number;
    octx.putImageData(rgb, 0, 0);
  }
  if (!downscale) {
    const data = ctx2d(rgbOut).getImageData(0, 0, outW, outH).data;
    return { width: outW, height: outH, data };
  }
  const fin = makeCanvas(finalW, finalH);
  const fctx = ctx2d(fin);
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(rgbOut as CanvasImageSource, 0, 0, finalW, finalH);
  const data = fctx.getImageData(0, 0, finalW, finalH).data;
  return { width: finalW, height: finalH, data };
}

// ── Real-ESRGAN path (general + x4plus) ──────────────────────────────────────

async function runRealEsrgan(frame: UpscaleFrame, model: UpscaleModelInfo, opts: UpscaleOpts, ctx: RunContext): Promise<UpscaleFrame> {
  const ort = await loadOrt();
  const dl = (p: FetchProgress): void => ctx.onProgress?.({
    phase: 'download', loaded: p.loaded, total: p.total, fraction: p.total ? Math.min(1, p.loaded / p.total) : undefined,
  });
  const session = await loadSession(UPSCALE_MODEL_FILES[model.id], dl);
  if (!session) {
    throw new Error(`The ${model.name} model isn't available on this device yet - it needs a one-time download and none is cached.`);
  }
  // Denoise is a general-model-only blend; skip silently if its WDN partner
  // isn't cached (fetch WITHOUT progress - it's an optional add-on to the run).
  let wdnSession: InferenceSession | null = null;
  const denoise = model.id === 'realesr-general-x4v3' && opts.denoise != null
    ? Math.min(1, Math.max(0, opts.denoise)) : 0;
  if (denoise > 0) {
    wdnSession = await loadSession(UPSCALE_WDN_FILE);
    if (!wdnSession) dbg('denoise', { status: 'wdn-not-cached; skipping blend' });
  }

  const { width: w, height: h, data } = frame;
  const needAlpha = hasAlpha(data);
  const srcCanvas = frameToCanvas(data, w, h);
  const rgbOut = await tileThroughModel(ort, session, wdnSession, denoise, srcCanvas, w, h, model.scale, ctx);
  const target = planTarget(w, h, model.scale, opts);
  return finalize(rgbOut, srcCanvas, needAlpha, target);
}

// ── GFPGAN face-restore path ─────────────────────────────────────────────────
//
// GFPGANv1.4 ONNX I/O (researched, UNVERIFIED - xuanandsix/GFPGAN-onnxruntime-demo
// + common ComfyUI/ReActor conversions):
//   input  : NCHW [1,3,512,512], RGB channel order, normalized (v/127.5 − 1) ∈ [−1,1]
//   output : NCHW [1,3,512,512], RGB, [−1,1] → (v+1)·127.5 clamped to [0,255]
// Tensor NAMES vary across conversions, so we read session.inputNames[0] /
// outputNames[0] rather than hard-coding 'input'/'output'. If a real run shows
// swapped colours, the channel order is the thing to flip (RGB↔BGR).
//
// Pipeline: upscale the whole image with the general Real-ESRGAN model for the
// BACKGROUND, detect (best-effort) or centre-crop a 512² face, restore it, and
// paste it back over the upscaled background at the target scale. A missing face
// detector or no detection → a centre square crop (headshots are centred - 
// acceptable v1).

/** Best-effort face box in SOURCE pixel coords, or null → centre-crop fallback.
 *  The detector's exact I/O contract is unknown (face-detect.onnx is staged by
 *  the fetch script); we attempt a permissive read of an [N,≥4]/[N,≥5] box list
 *  and bail to null on anything we can't confidently interpret. */
async function detectFaceBox(
  ort: OrtModule, w: number, h: number, srcCanvas: AnyCanvas,
): Promise<{ x: number; y: number; size: number } | null> {
  const session = await loadSession(UPSCALE_FACE_DETECT_FILE).catch(() => null);
  if (!session) return null;
  try {
    // Feed a 320×320 [0,1] RGB NCHW frame - the common lightweight-detector input.
    const det = 320;
    const c = makeCanvas(det, det);
    const cctx = ctx2d(c);
    cctx.imageSmoothingEnabled = true;
    cctx.drawImage(srcCanvas as CanvasImageSource, 0, 0, det, det);
    const input = packNchw01(cctx.getImageData(0, 0, det, det).data, det, det);
    const { data: box } = await runModel(ort, session, input, det, det);
    // Expect at least [x1,y1,x2,y2(,score)] for the top detection. Values that
    // look normalized (≤1.5) are scaled by the detector input; else treated as
    // detector-pixel coords. Anything degenerate → null (centre crop).
    if (box.length < 4) return null;
    const norm = (box[2] as number) <= 1.5 && (box[3] as number) <= 1.5;
    const sx = norm ? det : 1;
    let x1 = (box[0] as number) * sx, y1 = (box[1] as number) * sx;
    let x2 = (box[2] as number) * sx, y2 = (box[3] as number) * sx;
    // detector-space → source-space
    x1 = (x1 / det) * w; x2 = (x2 / det) * w; y1 = (y1 / det) * h; y2 = (y2 / det) * h;
    const bw = x2 - x1, bh = y2 - y1;
    if (!(bw > 4 && bh > 4)) return null;
    const cxp = x1 + bw / 2, cyp = y1 + bh / 2;
    const size = Math.min(Math.max(bw, bh) * 1.4, Math.min(w, h)); // pad + clamp square
    const x = Math.max(0, Math.min(w - size, cxp - size / 2));
    const y = Math.max(0, Math.min(h - size, cyp - size / 2));
    dbg('face', { path: 'detected', box: [x, y, size] });
    return { x, y, size };
  } catch (err) {
    dbg('face', { path: 'detect-error', error: (err as Error)?.message });
    return null;
  }
}

async function runGfpgan(frame: UpscaleFrame, model: UpscaleModelInfo, opts: UpscaleOpts, ctx: RunContext): Promise<UpscaleFrame> {
  const ort = await loadOrt();
  const dl = (p: FetchProgress): void => ctx.onProgress?.({
    phase: 'download', loaded: p.loaded, total: p.total, fraction: p.total ? Math.min(1, p.loaded / p.total) : undefined,
  });
  const faceSession = await loadSession(UPSCALE_MODEL_FILES[model.id], dl);
  if (!faceSession) {
    throw new Error(`The ${model.name} model isn't available on this device yet - it needs a one-time download and none is cached.`);
  }
  const { width: w, height: h, data } = frame;
  const srcCanvas = frameToCanvas(data, w, h);

  // Background: general Real-ESRGAN at the same target. Fall back to a plain
  // bilinear enlarge only if the general model isn't on device.
  const general = upscaleModel('realesr-general-x4v3');
  let background: UpscaleFrame;
  const generalSession = general ? await loadSession(UPSCALE_MODEL_FILES['realesr-general-x4v3']) : null;
  const target = planTarget(w, h, model.scale, opts);
  if (generalSession && general) {
    const rgbOut = await tileThroughModel(ort, generalSession, null, 0, srcCanvas, w, h, general.scale, ctx);
    background = finalize(rgbOut, srcCanvas, hasAlpha(data), target);
  } else {
    ctx.checkAbort();
    const bg = makeCanvas(target.finalW, target.finalH);
    const bgctx = ctx2d(bg);
    bgctx.imageSmoothingEnabled = true; bgctx.imageSmoothingQuality = 'high';
    bgctx.drawImage(srcCanvas as CanvasImageSource, 0, 0, target.finalW, target.finalH);
    background = { width: target.finalW, height: target.finalH, data: bgctx.getImageData(0, 0, target.finalW, target.finalH).data };
  }

  ctx.checkAbort();

  // Face box (detected, else centre square crop).
  const detected = await detectFaceBox(ort, w, h, srcCanvas);
  const box = detected ?? (() => {
    const size = Math.min(w, h);
    return { x: Math.floor((w - size) / 2), y: Math.floor((h - size) / 2), size };
  })();

  // Crop → 512², normalize to [−1,1], restore, denormalize → 512² RGBA.
  const S = GFPGAN_FACE_SIZE;
  const faceC = makeCanvas(S, S);
  const fctx = ctx2d(faceC);
  fctx.imageSmoothingEnabled = true; fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(srcCanvas as CanvasImageSource, box.x, box.y, box.size, box.size, 0, 0, S, S);
  const faceRgba = fctx.getImageData(0, 0, S, S).data;
  const inTensor = new Float32Array(S * S * 3);
  const page = S * S;
  for (let i = 0; i < page; i++) {
    const p = i * 4;
    inTensor[i] = (faceRgba[p] as number) / 127.5 - 1;
    inTensor[i + page] = (faceRgba[p + 1] as number) / 127.5 - 1;
    inTensor[i + 2 * page] = (faceRgba[p + 2] as number) / 127.5 - 1;
  }
  ctx.checkAbort();
  ctx.onProgress?.({ phase: 'inference', tile: 1, tiles: 1, fraction: 1 });
  const inName = faceSession.inputNames[0];
  const outName = faceSession.outputNames[0];
  if (!inName || !outName) throw new Error('GFPGAN model has no input/output tensor');
  const results = await faceSession.run({ [inName]: new ort.Tensor('float32', inTensor, [1, 3, S, S]) });
  const out = results[outName] ?? results[Object.keys(results)[0] ?? ''];
  if (!out) throw new Error('GFPGAN produced no output');
  const raw = out.location === 'cpu' ? (out.data as Float32Array)
    : typeof out.getData === 'function' ? (await out.getData(false)) as Float32Array : (out.data as Float32Array);
  const restored = new ImageData(S, S);
  for (let i = 0; i < page; i++) {
    const o = i * 4;
    restored.data[o] = clamp255(((raw[i] as number) + 1) * 127.5);
    restored.data[o + 1] = clamp255(((raw[i + page] as number) + 1) * 127.5);
    restored.data[o + 2] = clamp255(((raw[i + 2 * page] as number) + 1) * 127.5);
    restored.data[o + 3] = 255;
  }

  // Paste the restored face over the background at target scale.
  const sf = target.finalW / w;
  const dx = Math.round(box.x * sf), dy = Math.round(box.y * sf), dsize = Math.max(1, Math.round(box.size * sf));
  const bgCanvas = frameToCanvas(background.data, background.width, background.height);
  const bgctx = ctx2d(bgCanvas);
  const restoredCanvas = makeCanvas(S, S);
  ctx2d(restoredCanvas).putImageData(restored, 0, 0);
  bgctx.imageSmoothingEnabled = true; bgctx.imageSmoothingQuality = 'high';
  bgctx.drawImage(restoredCanvas as CanvasImageSource, 0, 0, S, S, dx, dy, dsize, dsize);
  const data2 = bgctx.getImageData(0, 0, background.width, background.height).data;
  dbg('gfpgan', { box: [box.x, box.y, box.size], paste: [dx, dy, dsize], out: [background.width, background.height] });
  return { width: background.width, height: background.height, data: data2 };
}

// ── Public run entrypoint (called by the worker) ─────────────────────────────

export async function runUpscale(frame: UpscaleFrame, opts: UpscaleOpts, ctx: RunContext): Promise<UpscaleFrame> {
  ctx.checkAbort();
  const model = upscaleModel(opts.model ?? UPSCALE_DEFAULT_MODEL) ?? upscaleModel(UPSCALE_DEFAULT_MODEL);
  if (!model) throw new Error('no upscale model available');
  if (frame.width < 1 || frame.height < 1) throw new Error('empty source frame');
  const once = (): Promise<UpscaleFrame> =>
    model.facesOnly ? runGfpgan(frame, model, opts, ctx) : runRealEsrgan(frame, model, opts, ctx);
  try {
    return await once();
  } catch (err) {
    // A WebGPU EP can BUILD a session yet fail at RUN time on a shape/op it can't
    // handle - e.g. "[WebGPU] Kernel '[Clip] /Clip' failed" on a large tile. That's
    // not an abort and not a user error: downgrade the whole runner to WASM (the
    // floor), drop the now-unusable GPU sessions, and retry once. A second failure
    // is real. (Session-CREATE faults are already downgraded in loadSession; this
    // covers the harder run-time case the review flagged WebGPU could hit.)
    if ((err as Error | null)?.name !== 'AbortError' && resolvedBackend === 'webgpu' && !webgpuFailed) {
      webgpuFailed = true;
      resolvedBackend = 'wasm';
      backendProbe = Promise.resolve('wasm');
      sessionCache.clear(); // GPU-built sessions are unusable now - rebuild on wasm
      dbg('run', { status: 'webgpu-run-fail-retry-wasm', error: (err as Error)?.message });
      ctx.checkAbort();
      return await once();
    }
    throw err;
  }
}

// ── Feasibility (canRun) - never throws ──────────────────────────────────────

/** navigator.deviceMemory (GB, capped/rounded), or a conservative 4 when absent. */
function deviceMemoryGb(): number {
  const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  return typeof dm === 'number' && dm > 0 ? dm : 4;
}

/** Usable working-set budget in bytes: a quarter of device RAM, further capped
 *  by 60% of the JS heap limit where the browser exposes it (Chrome). */
function deviceBudgetBytes(): number {
  let budget = deviceMemoryGb() * 1024 ** 3 * 0.25;
  const jsHeap = (performance as unknown as { memory?: { jsHeapSizeLimit?: number } }).memory?.jsHeapSizeLimit;
  if (typeof jsHeap === 'number' && jsHeap > 0) budget = Math.min(budget, jsHeap * 0.6);
  return budget;
}

export async function canRun(src: { width: number; height: number }, opts: UpscaleOpts = {}): Promise<UpscaleFeasibility> {
  try {
    const backend = await probeBackend();
    if (!backend) {
      return {
        ok: false, reason: 'no-backend',
        message: "This browser can't run the upscaler - it has neither WebAssembly nor WebGPU available. Try a current Chrome, Edge, Firefox or Safari.",
      };
    }
    const model = upscaleModel(opts.model ?? UPSCALE_DEFAULT_MODEL) ?? upscaleModel(UPSCALE_DEFAULT_MODEL)!;
    const maxSrcEdge = Math.max(src.width, src.height);
    // The runner ALWAYS builds a native (source × model.scale) canvas, then
    // downscales ONCE to the final size. That native intermediate - not the trimmed
    // final - is what hits the browser's canvas ceiling and dominates memory, so
    // BOTH guards below reason about it. targetMaxEdge/scale only trim the final
    // copy; they cannot shrink the native canvas, so they are not a lever here.
    const nativeEdge = maxSrcEdge * model.scale;
    const nativePixels = (src.width * model.scale) * (src.height * model.scale);

    // Absurd-ask / canvas-ceiling guard on the NATIVE intermediate. A source large
    // enough that source×scale exceeds this can't be built in one pass at any target
    // size - and a large source is not what an upscaler is for. Honest refusal.
    if (nativeEdge > ABS_MAX_EDGE || nativePixels > ABS_MAX_PIXELS) {
      return {
        ok: false, reason: 'too-large',
        message: `This image is already ${maxSrcEdge} px on its longest edge - enlarging it ${model.scale}× would exceed what the app can build in one pass. Upscaling is for small, low-resolution images; this one is large enough to use as it is.`,
        ...(model.id === 'gfpgan-v1.4' ? { suggestedModel: 'realesr-general-x4v3' as const } : {}),
      };
    }

    // Final (post-downscale) geometry - only affects the last, smaller copy.
    const desiredScale = opts.scale ?? model.scale;
    let finalEdge = maxSrcEdge * desiredScale;
    if (opts.targetMaxEdge && opts.targetMaxEdge > 0) finalEdge = Math.min(finalEdge, opts.targetMaxEdge);
    const finalRatio = finalEdge / maxSrcEdge;
    const finalPixels = src.width * finalRatio * src.height * finalRatio;

    const budget = deviceBudgetBytes();
    const peak = estimatePeakBytes(src.width, src.height, nativePixels, finalPixels, model, backend, deviceMemoryGb());
    dbg('canRun', { backend, model: model.id, nativePixels, finalPixels: Math.round(finalPixels), peak: Math.round(peak), budget: Math.round(budget) });
    if (peak > budget) {
      // Peak is dominated by the fixed native canvas, so a smaller target edge barely
      // helps; the honest levers are a lighter model (GFPGAN is heaviest) or a smaller
      // source image. Don't dangle a target-size suggestion that wouldn't fix an OOM.
      const suggestedModel: UpscaleModelId | undefined = model.id === 'realesrgan-x4plus' || model.id === 'gfpgan-v1.4'
        ? 'realesr-general-x4v3' : undefined;
      return {
        ok: false, reason: 'memory',
        message: `This device probably can't enlarge this image ${model.scale}× - it's likely to run out of memory building the full-resolution result. Try ${suggestedModel ? 'the lighter fast model, or ' : ''}a smaller source image.`,
        ...(suggestedModel ? { suggestedModel } : {}),
      };
    }
    return { ok: true };
  } catch (err) {
    // canRun must NEVER throw - an estimate failure is treated as "go ahead"
    // (run() still guards itself and rejects honestly on a real fault).
    dbg('canRun', { status: 'estimate-error', error: (err as Error)?.message });
    return { ok: true };
  }
}

