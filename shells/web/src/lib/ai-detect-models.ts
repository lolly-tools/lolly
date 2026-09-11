// SPDX-License-Identifier: MPL-2.0
/**
 * On-device AI-text detector - the PURE catalogue half of plans/126 WP-A's
 * local-model tier.
 *
 * The roster, the calibrated threshold and the eligibility gate MOVED to
 * packages/node-shell/src/ml/ai-detect-models.ts (plans/183 WS2): the detector
 * now runs on the Node shells too, and a reading from `lolly detect-ai` has to
 * be the reading the app gives. One copy, in the parent repo both submodules can
 * import from - the move net.ts and pptx.ts already made.
 *
 * What stays here is the one browser-only piece: the Cache API probe URL, which
 * is built from this build's MODELS_BASE.
 */

import { MODELS_BASE } from './models-base.ts';
import type { AiDetectModel } from '../../../../packages/node-shell/src/ml/ai-detect-models.ts';

export * from '../../../../packages/node-shell/src/ml/ai-detect-models.ts';

/** The cache probe URL: the big file's local path, as transformers.js keys its
 *  Cache API entries ('transformers-cache', keyed by fetched path). */
export function aiDetectCacheUrl(m: AiDetectModel): string {
  return `${MODELS_BASE}/models/${m.dir}/onnx/model_quantized.onnx`;
}
