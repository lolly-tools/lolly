// SPDX-License-Identifier: MPL-2.0
/**
 * `host.matte` for the Node shells: U²-Net lite / MODNet background removal over
 * onnxruntime-node, with sharp where the web runner uses a canvas.
 *
 * The web twin is shells/web/src/lib/matter.ts, and the geometry is the SAME
 * module: ml/matte-math.ts owns the letterbox plan, the per-model normalization
 * and the mask activation, and matter.ts imports it too. A single forward pass at
 * the model's fixed square, so there is no tiling here - the work is letterbox →
 * normalize → run → activate → unpad → scale the mask back → straight alpha.
 *
 * The output's RGB is the (work-size) input's, untouched; only the alpha is new,
 * exactly as the contract states.
 *
 * HONESTY: nothing is downloaded. `cached()` reads the filesystem and `run()`
 * refuses by model name when the weights are absent. `backend()` returns null:
 * the contract's union names 'webgpu' and 'wasm', and the native CPU provider is
 * neither.
 */
import type {
  MatteAPI, MatteFeasibility, MatteFrame, MatteModelId, MatteModelInfo, MatteOpts,
} from '@lolly-tools/core/host-v1';
import {
  MATTE_MODEL_BYTES, MATTE_MODEL_FILES, MATTE_MODEL_SPEC, matteModel, matteModelsFor, resolveMatteModel,
} from './matte-models.ts';
import { activateMask, packNchwNormalized, planLetterbox, unpadMask } from './matte-math.ts';
import {
  blackFrame, checkSignal, createSession, deviceMemoryGb, firstOutput, loadOrt, modelFileExists,
  modelPath, pasteFrame, pixelMlAvailable, refuseMissing, resizeRgba, tensorFloats,
  type RgbaFrame,
} from './session.ts';

const ABS_MAX_EDGE = 12000;
const ABS_MAX_PIXELS = 40_000_000;

/** Feasibility, before any bytes move. Never throws - matter.ts's rule. */
function feasibility(src: { width: number; height: number }, opts: MatteOpts = {}): MatteFeasibility {
  try {
    const longEdge = Math.max(src.width, src.height);
    const cap = Math.min(longEdge, opts.maxEdge ?? longEdge);
    const scale = cap / longEdge;
    const outW = Math.round(src.width * scale), outH = Math.round(src.height * scale);
    if (outW > ABS_MAX_EDGE || outH > ABS_MAX_EDGE || outW * outH > ABS_MAX_PIXELS) {
      return {
        ok: false, reason: 'too-large', message: 'This image is too large to process on this machine.',
        suggestedMaxEdge: Math.min(ABS_MAX_EDGE, Math.floor(Math.sqrt(ABS_MAX_PIXELS))),
      };
    }
    const spec = MATTE_MODEL_SPEC[resolveMatteModel(opts.model)];
    const edge = spec.inputSize[0];
    const peak = src.width * src.height * 4 + outW * outH * 4 + edge * edge * 3 * 4 + edge * edge * 4;
    if (peak > deviceMemoryGb() * 1024 ** 3 * 0.25) {
      return {
        ok: false, reason: 'memory', message: 'Not enough memory for an image this size - try a smaller export size.',
        suggestedMaxEdge: Math.max(512, Math.floor(cap * 0.7)),
      };
    }
    return { ok: true };
  } catch {
    return { ok: true }; // an estimate failure never blocks the run
  }
}

/**
 * The Node `host.matte`, or null when onnxruntime-node or sharp cannot be
 * resolved here. A shell then leaves `host.matte` undefined.
 */
export function createNodeMatteAPI(): MatteAPI | null {
  if (!pixelMlAvailable()) return null;
  return {
    isAvailable: () => true,
    backend: () => null,
    // The SAME gate the web bridge uses. `false` because a Node shell has no
    // native-ORT-only tier of its own to declare; no model on today's roster
    // needs one either (MATTE_NATIVE_ONLY is all false).
    models: (): MatteModelInfo[] => matteModelsFor(false).map((m) => ({ ...m })),
    modelBytes: (id: MatteModelId) => MATTE_MODEL_BYTES[id] ?? 0,
    cached: async (id) => modelFileExists('matte', MATTE_MODEL_FILES[resolveMatteModel(id)]),
    canRun: async (src, o) => feasibility(src, o),

    async run(frame: MatteFrame, opts: MatteOpts = {}): Promise<MatteFrame> {
      checkSignal(opts.signal);
      // A saved project or a `?model=` link can still name a RETIRED model, so
      // resolve first - a slightly different matte beats a crash on spec.inputSize.
      const id = resolveMatteModel(opts.model);
      const spec = MATTE_MODEL_SPEC[id];
      const edge = spec.inputSize[0];
      const file = MATTE_MODEL_FILES[id];
      if (!modelFileExists('matte', file)) {
        refuseMissing('matte', matteModel(id)?.name ?? id, MATTE_MODEL_BYTES[id] ?? 0);
      }
      const session = await createSession(modelPath('matte', file));
      checkSignal(opts.signal);
      opts.onProgress?.({ phase: 'inference', fraction: 0 });

      // Source → work size (identity when uncapped): the RGB the cutout keeps.
      const longEdge = Math.max(frame.width, frame.height);
      const cap = Math.min(longEdge, opts.maxEdge ?? longEdge);
      const wScale = cap / longEdge;
      const workW = Math.max(1, Math.round(frame.width * wScale));
      const workH = Math.max(1, Math.round(frame.height * wScale));
      const work = await resizeRgba({ width: frame.width, height: frame.height, data: frame.data }, workW, workH);

      // Letterbox the work image into the model's square, on black.
      const plan = planLetterbox(workW, workH, edge);
      const square = blackFrame(edge, edge);
      pasteFrame(square, await resizeRgba(work, plan.contentW, plan.contentH), plan.offsetX, plan.offsetY);
      const input = packNchwNormalized(square.data, edge, spec);
      checkSignal(opts.signal);

      const ort = await loadOrt();
      const inName = session.inputNames[0];
      if (!inName) throw new Error('matte model has no input tensor');
      const result = await session.run({ [inName]: new ort.Tensor('float32', input, [1, 3, edge, edge]) });
      checkSignal(opts.signal);
      const raw = tensorFloats(firstOutput(result, session.outputNames[0]));
      opts.onProgress?.({ phase: 'inference', fraction: 0.85 });

      // Activate → unpad → scale the mask back to work size → compose.
      const maskEdge = activateMask(raw, edge * edge, spec.activation);
      const cropped = unpadMask(maskEdge, plan);
      const grey: RgbaFrame = { width: plan.contentW, height: plan.contentH, data: new Uint8ClampedArray(plan.contentW * plan.contentH * 4) };
      for (let i = 0; i < cropped.length; i++) {
        const o = i * 4;
        grey.data[o] = grey.data[o + 1] = grey.data[o + 2] = cropped[i] as number;
        grey.data[o + 3] = 255;
      }
      const scaledMask = await resizeRgba(grey, workW, workH);

      const out = new Uint8ClampedArray(workW * workH * 4);
      for (let i = 0; i < workW * workH; i++) {
        const o = i * 4;
        out[o] = work.data[o] as number;
        out[o + 1] = work.data[o + 1] as number;
        out[o + 2] = work.data[o + 2] as number;
        out[o + 3] = scaledMask.data[o] as number; // R of the grey mask is the alpha
      }
      opts.onProgress?.({ phase: 'inference', fraction: 1 });
      return { width: workW, height: workH, data: out };
    },
  };
}
