// SPDX-License-Identifier: MPL-2.0
/**
 * `host.upscale` for the Node shells: Real-ESRGAN (general / x4plus / anime) and
 * GFPGAN face restore over onnxruntime-node, with sharp where the web runner
 * uses a canvas.
 *
 * The web twin is shells/web/src/lib/upscaler.ts. THE MATHS IS THE SAME MODULE:
 * the tile grid, the padded windows, the target plan, the denoise blend, the
 * plane-to-RGBA crop and the memory estimate all come from ml/upscale-math.ts,
 * which upscaler.ts imports too. What differs is only the plumbing:
 *
 *   web                              node
 *   onnxruntime-web (wasm/webgpu)  → onnxruntime-node (CPU, CoreML by opt-in)
 *   fetch + IndexedDB cache        → a file on disk, or an honest refusal
 *   OffscreenCanvas getImageData   → a typed-array crop
 *   canvas drawImage downscale     → sharp, lanczos3
 *
 * The roster is ml/upscale-models.ts, the same constants the web bridge answers
 * `models()` and `modelBytes()` from, so a tool sees one catalogue on both.
 *
 * HONESTY: no model is ever downloaded here. `cached()` reads the filesystem,
 * and `run()` on a model that is not there refuses by name with the command that
 * would fetch it. `backend()` returns null, because the contract's union names
 * only 'webgpu' and 'wasm' and the native CPU provider is neither - claiming
 * wasm would be a lie about which kernels produced the pixels.
 */
import type {
  UpscaleAPI, UpscaleFeasibility, UpscaleFrame, UpscaleModelId, UpscaleModelInfo, UpscaleOpts,
} from '@lolly-tools/core/host-v1';
import {
  GFPGAN_FACE_SIZE, UPSCALE_DEFAULT_MODEL, UPSCALE_FACE_DETECT_FILE, UPSCALE_MODEL_BYTES,
  UPSCALE_MODEL_FILES, UPSCALE_WDN_FILE, stagedUpscaleModels, upscaleModel,
} from './upscale-models.ts';
import {
  ABS_MAX_EDGE, ABS_MAX_PIXELS, blendPlanes, clamp255, estimatePeakBytes, hasAlpha,
  planTarget, planTiles, planesToRgba, tileEdgeFor,
} from './upscale-math.ts';
import { packNchw01 } from './tensor.ts';
import {
  checkSignal, createSession, cropResizeRgba, deviceMemoryGb, firstOutput, loadOrt,
  modelFileExists, modelPath, pasteFrame, pixelMlAvailable, refuseMissing, resizeRgba, tensorFloats,
  type OrtSessionLike, type RgbaFrame,
} from './session.ts';

/** Crop a w x h window out of an RGBA frame without resampling. */
function cropRgba(frame: RgbaFrame, x: number, y: number, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const from = ((y + row) * frame.width + x) * 4;
    out.set(frame.data.subarray(from, from + w * 4), row * w * 4);
  }
  return out;
}

/** Run one session on an NCHW [1,3,H,W] float32 tensor and return the output as
 *  a plane-major Float32Array plus its own H/W (the model decides the multiple). */
async function runModel(
  session: OrtSessionLike, input: Float32Array, w: number, h: number,
): Promise<{ data: Float32Array; w: number; h: number }> {
  const ort = await loadOrt();
  const inName = session.inputNames[0];
  if (!inName) throw new Error('model has no input tensor');
  const results = await session.run({ [inName]: new ort.Tensor('float32', input, [1, 3, h, w]) });
  const out = firstOutput(results, session.outputNames[0]);
  const dims = out.dims;
  return {
    data: tensorFloats(out),
    w: Number(dims[dims.length - 1]),
    h: Number(dims[dims.length - 2]),
  };
}

/** Composite the model's RGB output with the source alpha (bilinear-enlarged by
 *  sharp), then trim to the final size. Mirrors upscaler.ts's `finalize`. */
async function finalize(
  rgb: RgbaFrame, src: RgbaFrame, needAlpha: boolean,
  target: { outW: number; outH: number; finalW: number; finalH: number; downscale: boolean },
): Promise<UpscaleFrame> {
  if (needAlpha) {
    const scaledSrc = await resizeRgba(src, target.outW, target.outH);
    for (let i = 3; i < rgb.data.length; i += 4) rgb.data[i] = scaledSrc.data[i] as number;
  }
  const out = target.downscale ? await resizeRgba(rgb, target.finalW, target.finalH) : rgb;
  return { width: out.width, height: out.height, data: out.data };
}

async function sessionFor(id: UpscaleModelId, file: string): Promise<OrtSessionLike | null> {
  if (!modelFileExists('upscale', file)) return null;
  try {
    return await createSession(modelPath('upscale', file));
  } catch {
    // A file that exists but will not load (a truncated download, a graph this
    // build of ORT refuses) is the same practical answer as absent: the caller
    // refuses by name rather than half-producing. The id is kept for the message.
    void id;
    return null;
  }
}

async function runRealEsrgan(
  frame: UpscaleFrame, model: UpscaleModelInfo, opts: UpscaleOpts,
): Promise<UpscaleFrame> {
  const session = await sessionFor(model.id, UPSCALE_MODEL_FILES[model.id]);
  if (!session) refuseMissing('upscale', model.name, model.approxBytes);

  const denoise = model.id === 'realesr-general-x4v3' && opts.denoise != null
    ? Math.min(1, Math.max(0, opts.denoise)) : 0;
  const wdnSession = denoise > 0 ? await sessionFor(model.id, UPSCALE_WDN_FILE) : null;

  const { width: w, height: h } = frame;
  const src: RgbaFrame = { width: w, height: h, data: frame.data };
  const needAlpha = hasAlpha(frame.data);
  const scale = model.scale;
  const target = planTarget(w, h, scale, opts);

  const T = tileEdgeFor('cpu', deviceMemoryGb());
  const tiles = planTiles(w, h, T);
  const out: RgbaFrame = { width: target.outW, height: target.outH, data: new Uint8ClampedArray(target.outW * target.outH * 4) };

  let idx = 0;
  for (const { cx, cy, cw, ch, px0, py0, pw, ph } of tiles) {
    checkSignal(opts.signal); // only safe preemption point: between tiles
    const input = packNchw01(cropRgba(src, px0, py0, pw, ph), pw, ph);
    const base = await runModel(session, input, pw, ph);
    let planes = base.data;
    if (wdnSession && denoise > 0) {
      const wdn = await runModel(wdnSession, input, pw, ph);
      if (wdn.data.length === base.data.length) planes = blendPlanes(base.data, wdn.data, denoise);
    }
    // Crop the padded margin (x scale) back off, keep the tile core.
    const mx = (cx - px0) * scale, my = (cy - py0) * scale;
    const coreW = cw * scale, coreH = ch * scale;
    const core = planesToRgba(planes, base.w, base.h, mx, my, coreW, coreH);
    for (let row = 0; row < coreH; row++) {
      out.data.set(core.subarray(row * coreW * 4, (row + 1) * coreW * 4), ((cy * scale + row) * out.width + cx * scale) * 4);
    }
    idx++;
    opts.onProgress?.({ phase: 'inference', tile: idx, tiles: tiles.length, fraction: idx / tiles.length });
  }
  return finalize(out, src, needAlpha, target);
}

/** GFPGAN: a general-model background, a detected (or centre-cropped) 512² face
 *  restored and pasted back. The tensor contract is upscaler.ts's, unchanged:
 *  NCHW [1,3,512,512] RGB normalized to [-1,1], the same back out. */
async function runGfpgan(
  frame: UpscaleFrame, model: UpscaleModelInfo, opts: UpscaleOpts,
): Promise<UpscaleFrame> {
  const faceSession = await sessionFor(model.id, UPSCALE_MODEL_FILES[model.id]);
  if (!faceSession) refuseMissing('upscale', model.name, model.approxBytes);

  const { width: w, height: h } = frame;
  const src: RgbaFrame = { width: w, height: h, data: frame.data };
  const target = planTarget(w, h, model.scale, opts);

  // Background: the general Real-ESRGAN model when it is on disk, else a plain
  // enlarge. Never a refusal - the face is what this model is for.
  const general = upscaleModel('realesr-general-x4v3');
  let background: UpscaleFrame;
  if (general && modelFileExists('upscale', UPSCALE_MODEL_FILES[general.id])) {
    background = await runRealEsrgan(frame, general, { ...opts, model: general.id });
  } else {
    checkSignal(opts.signal);
    const enlarged = await resizeRgba(src, target.finalW, target.finalH);
    background = { width: enlarged.width, height: enlarged.height, data: enlarged.data };
  }
  checkSignal(opts.signal);

  // Face box: the best-effort detector when staged, else a centre square.
  const box = await detectFaceBox(w, h, src) ?? (() => {
    const size = Math.min(w, h);
    return { x: Math.floor((w - size) / 2), y: Math.floor((h - size) / 2), size };
  })();

  const S = GFPGAN_FACE_SIZE;
  const faceRgba = (await cropResizeRgba(src, box.x, box.y, box.size, box.size, S, S)).data;
  const page = S * S;
  const inTensor = new Float32Array(page * 3);
  for (let i = 0; i < page; i++) {
    const p = i * 4;
    inTensor[i] = (faceRgba[p] as number) / 127.5 - 1;
    inTensor[i + page] = (faceRgba[p + 1] as number) / 127.5 - 1;
    inTensor[i + 2 * page] = (faceRgba[p + 2] as number) / 127.5 - 1;
  }
  checkSignal(opts.signal);
  opts.onProgress?.({ phase: 'inference', tile: 1, tiles: 1, fraction: 1 });

  const ort = await loadOrt();
  const inName = faceSession.inputNames[0];
  if (!inName) throw new Error('GFPGAN model has no input tensor');
  const results = await faceSession.run({ [inName]: new ort.Tensor('float32', inTensor, [1, 3, S, S]) });
  const raw = tensorFloats(firstOutput(results, faceSession.outputNames[0]));

  const restored: RgbaFrame = { width: S, height: S, data: new Uint8ClampedArray(page * 4) };
  for (let i = 0; i < page; i++) {
    const o = i * 4;
    restored.data[o] = clamp255(((raw[i] as number) + 1) * 127.5);
    restored.data[o + 1] = clamp255(((raw[i + page] as number) + 1) * 127.5);
    restored.data[o + 2] = clamp255(((raw[i + 2 * page] as number) + 1) * 127.5);
    restored.data[o + 3] = 255;
  }

  // Paste the restored face over the background at the target scale.
  const sf = background.width / w;
  const dx = Math.round(box.x * sf), dy = Math.round(box.y * sf);
  const dsize = Math.max(1, Math.round(box.size * sf));
  const scaled = await resizeRgba(restored, dsize, dsize);
  const bg: RgbaFrame = { width: background.width, height: background.height, data: background.data };
  pasteFrame(bg, scaled, dx, dy);
  return { width: bg.width, height: bg.height, data: bg.data };
}

/** Best-effort face box in SOURCE pixel coords, or null for the centre-crop
 *  fallback. The permissive box read is upscaler.ts's, unchanged. */
async function detectFaceBox(
  w: number, h: number, src: RgbaFrame,
): Promise<{ x: number; y: number; size: number } | null> {
  if (!modelFileExists('upscale', UPSCALE_FACE_DETECT_FILE)) return null;
  try {
    const session = await createSession(modelPath('upscale', UPSCALE_FACE_DETECT_FILE));
    const det = 320;
    const input = packNchw01((await resizeRgba(src, det, det)).data, det, det);
    const { data: box } = await runModel(session, input, det, det);
    if (box.length < 4) return null;
    const norm = (box[2] as number) <= 1.5 && (box[3] as number) <= 1.5;
    const sx = norm ? det : 1;
    let x1 = (box[0] as number) * sx, y1 = (box[1] as number) * sx;
    let x2 = (box[2] as number) * sx, y2 = (box[3] as number) * sx;
    x1 = (x1 / det) * w; x2 = (x2 / det) * w; y1 = (y1 / det) * h; y2 = (y2 / det) * h;
    const bw = x2 - x1, bh = y2 - y1;
    if (!(bw > 4 && bh > 4)) return null;
    const cxp = x1 + bw / 2, cyp = y1 + bh / 2;
    const size = Math.min(Math.max(bw, bh) * 1.4, Math.min(w, h));
    return {
      x: Math.max(0, Math.min(w - size, cxp - size / 2)),
      y: Math.max(0, Math.min(h - size, cyp - size / 2)),
      size,
    };
  } catch {
    return null;
  }
}

/** Feasibility, before any bytes move. Never throws - upscaler.ts's rule. */
function feasibility(src: { width: number; height: number }, opts: UpscaleOpts = {}): UpscaleFeasibility {
  try {
    const model = upscaleModel(opts.model ?? UPSCALE_DEFAULT_MODEL) ?? upscaleModel(UPSCALE_DEFAULT_MODEL);
    if (!model) return { ok: false, reason: 'no-backend', message: 'No upscale model is available.' };
    const maxSrcEdge = Math.max(src.width, src.height);
    const nativeEdge = maxSrcEdge * model.scale;
    const nativePixels = (src.width * model.scale) * (src.height * model.scale);
    if (nativeEdge > ABS_MAX_EDGE || nativePixels > ABS_MAX_PIXELS) {
      return {
        ok: false, reason: 'too-large',
        message: `This image is already ${maxSrcEdge} px on its longest edge - enlarging it ${model.scale}× would exceed what can be built in one pass. Upscaling is for small, low-resolution images; this one is large enough to use as it is.`,
        ...(model.id === 'gfpgan-v1.4' ? { suggestedModel: 'realesr-general-x4v3' as const } : {}),
      };
    }
    const desiredScale = opts.scale ?? model.scale;
    let finalEdge = maxSrcEdge * desiredScale;
    if (opts.targetMaxEdge && opts.targetMaxEdge > 0) finalEdge = Math.min(finalEdge, opts.targetMaxEdge);
    const finalRatio = finalEdge / maxSrcEdge;
    const finalPixels = src.width * finalRatio * src.height * finalRatio;
    const gb = deviceMemoryGb();
    const peak = estimatePeakBytes(src.width, src.height, nativePixels, finalPixels, model, 'cpu', gb);
    if (peak > gb * 1024 ** 3 * 0.25) {
      const suggestedModel: UpscaleModelId | undefined = model.id === 'realesrgan-x4plus' || model.id === 'gfpgan-v1.4'
        ? 'realesr-general-x4v3' : undefined;
      return {
        ok: false, reason: 'memory',
        message: `This machine probably cannot enlarge this image ${model.scale}× - it is likely to run out of memory building the full-resolution result. Try ${suggestedModel ? 'the lighter fast model, or ' : ''}a smaller source image.`,
        ...(suggestedModel ? { suggestedModel } : {}),
      };
    }
    return { ok: true };
  } catch {
    return { ok: true }; // an estimate failure never blocks the run
  }
}

/**
 * The Node `host.upscale`, or null when onnxruntime-node or sharp cannot be
 * resolved here (a lean install, or the bundled MCP function). A shell leaves
 * `host.upscale` undefined in that case, which is what feature detection wants.
 */
export function createNodeUpscaleAPI(): UpscaleAPI | null {
  if (!pixelMlAvailable()) return null;
  return {
    isAvailable: () => true,
    backend: () => null,
    models: (): UpscaleModelInfo[] => stagedUpscaleModels().map((m) => ({ ...m })),
    modelBytes: (id) => UPSCALE_MODEL_BYTES[id] ?? 0,
    cached: async (id) => modelFileExists('upscale', UPSCALE_MODEL_FILES[id] ?? ''),
    canRun: async (src, o) => feasibility(src, o),
    run: async (frame, o = {}) => {
      checkSignal(o.signal);
      if (frame.width < 1 || frame.height < 1) throw new Error('empty source frame');
      const model = upscaleModel(o.model ?? UPSCALE_DEFAULT_MODEL) ?? upscaleModel(UPSCALE_DEFAULT_MODEL);
      if (!model) throw new Error('no upscale model available');
      return model.facesOnly ? runGfpgan(frame, model, o) : runRealEsrgan(frame, model, o);
    },
  };
}
