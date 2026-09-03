// SPDX-License-Identifier: MPL-2.0
/**
 * The on-device ML utilities for the Node shells (plans/183 WS2): image
 * upscaling, background removal, text recognition, AI-text detection, rewording
 * and monocular depth, all over onnxruntime-node with sharp for pixels.
 *
 * Three of the six are HostV1 members and are attached to the CLI's bridge
 * conditionally (`host.upscale`, `host.matte`, `host.ocr`). The other three have
 * no contract member today - the web shell reaches them as libs, not bridge
 * methods - so they are CLI surfaces only, and nothing invents a bridge member
 * for them here.
 *
 * IMPORTING THIS BARREL IS CHEAP: every factory is a synchronous
 * `require.resolve` probe, and onnxruntime-node, sharp and transformers.js are
 * loaded by dynamic import on first use. A shell that has none of them gets six
 * nulls and attaches nothing.
 */
export { createNodeUpscaleAPI } from './upscale.ts';
export { UPSCALE_DEFAULT_MODEL } from './upscale-models.ts';
export { createNodeMatteAPI } from './matte.ts';
export { MATTE_DEFAULT_MODEL, resolveMatteModel } from './matte-models.ts';
export { createNodeOcrAPI } from './ocr.ts';
export { createNodeAiDetectAPI, aiDetectDir } from './ai-detect.ts';
export type { NodeAiDetectAPI } from './ai-detect.ts';
export { createNodeRewordAPI, REWORD_STYLES } from './reword.ts';
export type { NodeRewordAPI, RewordStyle } from './reword.ts';
export { createNodeDepthAPI, depthMapToRgba } from './depth.ts';
export type { NodeDepthAPI } from './depth.ts';
export { ML_MODEL_FILES } from './model-pins.ts';
export type { MlFamilyPins, MlModelFamily } from './model-pins.ts';
export {
  decodeRgba, encodeRgbaPng, familyDir, formatBytes, isOrtAvailable, isSharpAvailable,
  isTransformersAvailable, ModelNotInstalledError, modelFileExists, modelFilesExist, modelPath,
  modelsDirCandidates, modelsDirNote, pixelMlAvailable, refuseMissing, releaseSessions,
  resolveModelsDir, setRuntimeProbes,
} from './session.ts';
export type { ModelFamily, RgbaFrame, RuntimeProbeOverrides } from './session.ts';
