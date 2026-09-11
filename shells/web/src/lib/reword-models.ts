// SPDX-License-Identifier: MPL-2.0
/**
 * On-device rewording - the PURE catalogue half of the reword model tier
 * (plans/127).
 *
 * The model directory, the staged file list, the sampling parameters and the
 * decode budget MOVED to packages/node-shell/src/ml/reword-models.ts
 * (plans/183 WS2): reword now runs on the Node shells too, and a candidate the
 * terminal proposes has to be one the app would have proposed. One copy, in the
 * parent repo both submodules can import from - the move net.ts and pptx.ts
 * already made.
 *
 * What stays here is the one browser-only piece: the Cache API probe URL, built
 * from this build's MODELS_BASE.
 */

import { MODELS_BASE } from './models-base.ts';
import { REWORD_MODEL_DIR, REWORD_MODEL_ONNX } from '../../../../packages/node-shell/src/ml/reword-models.ts';

export * from '../../../../packages/node-shell/src/ml/reword-models.ts';

/** The cache probe URL: the big file's local path, as transformers.js keys its
 *  Cache API entries ('transformers-cache', keyed by fetched path). */
export const REWORD_MODEL_CACHE_URL = `${MODELS_BASE}/models/${REWORD_MODEL_DIR}/${REWORD_MODEL_ONNX}`;
