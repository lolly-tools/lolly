// SPDX-License-Identifier: MPL-2.0
/**
 * Monocular depth for the Node shells: Depth Anything V2 small over
 * onnxruntime-node.
 *
 * NOT A HostV1 MEMBER, and deliberately so: `packages/core/src/host-v1.ts` has
 * no `depth` on the bridge (see lib/depth-models.ts's header - spatial-photo is
 * the only consumer, and a bridge method with one caller is contract surface for
 * nothing). So this exports its own small API for the CLI wrapper, shaped like
 * the contract members beside it, and the CLI attaches nothing to `host`.
 *
 * The web twin is shells/web/src/lib/depth-worker.ts, and the whole pipeline
 * except `session.run()` is the SAME module: ml/depth-math.ts owns both
 * resamplers, the channel packing, the min-max normalisation and the pre/post
 * pair, and depth-worker.ts imports it too. Depth never needed a canvas, so this
 * runner is thinner than matte's - sharp is not used at all.
 *
 * TODAY IT ALWAYS REFUSES on a stock checkout: DEPTH_STAGED is false (the
 * quantised weights have not been published, plans/160 section 7), and the
 * candidate ONNX in the repo sits under `models/depth/.candidates/`, which is
 * not the served path. `models()` is honestly empty and `run()` names the
 * download. Flip DEPTH_STAGED with the published pin and this path runs.
 */
import {
  DEPTH_DEFAULT_MODEL, DEPTH_MODEL_BYTES, DEPTH_MODEL_FILES, DEPTH_MODEL_SPEC,
  depthModel, stagedDepthModels,
  type DepthFrame, type DepthMap, type DepthModelId, type DepthModelInfo, type DepthOpts,
} from './depth-models.ts';
import { postprocessDepth, preprocessDepth } from './depth-math.ts';
import {
  checkSignal, createSession, firstOutput, isOrtAvailable, loadOrt, modelFileExists, modelPath,
  refuseMissing, tensorFloats,
} from './session.ts';

/** The Node depth surface. Mirrors the contract members beside it (isAvailable /
 *  models / modelBytes / cached / run) so a future `host.depth` minor is a
 *  rename, not a rewrite. */
export interface NodeDepthAPI {
  isAvailable(): boolean;
  models(): DepthModelInfo[];
  modelBytes(id: DepthModelId): number;
  cached(id: DepthModelId): Promise<boolean>;
  run(frame: DepthFrame, opts?: DepthOpts): Promise<DepthMap>;
}

/** A depth map as an 8-bit greyscale RGBA frame, white nearest - what a CLI
 *  writes out as a PNG. The map itself is float and stays float for a caller
 *  that wants the real field. */
export function depthMapToRgba(map: DepthMap): { width: number; height: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(map.width * map.height * 4);
  for (let i = 0; i < map.data.length; i++) {
    const v = Math.round(Math.min(1, Math.max(0, map.data[i] as number)) * 255);
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = v;
    data[o + 3] = 255;
  }
  return { width: map.width, height: map.height, data };
}

/**
 * The Node depth runner, or null when onnxruntime-node cannot be resolved here.
 * sharp is not required: every resample is a typed-array loop in ml/depth-math.ts.
 */
export function createNodeDepthAPI(): NodeDepthAPI | null {
  if (!isOrtAvailable()) return null;
  return {
    isAvailable: () => true,
    models: () => stagedDepthModels().map((m) => ({ ...m })),
    modelBytes: (id) => DEPTH_MODEL_BYTES[id] ?? 0,
    cached: async (id) => modelFileExists('depth', DEPTH_MODEL_FILES[id] ?? ''),

    async run(frame: DepthFrame, opts: DepthOpts = {}): Promise<DepthMap> {
      checkSignal(opts.signal);
      const id = opts.model ?? DEPTH_DEFAULT_MODEL;
      const spec = DEPTH_MODEL_SPEC[id];
      const file = DEPTH_MODEL_FILES[id];
      if (!spec || !file) throw new Error(`Unknown depth model: ${id}`);
      if (!modelFileExists('depth', file)) {
        refuseMissing('depth', depthModel(id)?.name ?? id, DEPTH_MODEL_BYTES[id] ?? 0);
      }
      const session = await createSession(modelPath('depth', file));
      checkSignal(opts.signal);
      opts.onProgress?.({ phase: 'inference', fraction: 0 });

      const pre = preprocessDepth(frame, spec, opts);
      checkSignal(opts.signal);
      const ort = await loadOrt();
      const inName = session.inputNames[0];
      if (!inName) throw new Error('depth model has no input tensor');
      const result = await session.run({ [inName]: new ort.Tensor('float32', pre.input, [1, 3, pre.edge, pre.edge]) });
      checkSignal(opts.signal);
      const raw = tensorFloats(firstOutput(result, session.outputNames[0]));
      const map = postprocessDepth(raw, pre);
      opts.onProgress?.({ phase: 'inference', fraction: 1 });
      return map;
    },
  };
}
