// SPDX-License-Identifier: MPL-2.0
/**
 * On-device rewording - the PURE catalogue half of the reword model tier
 * (plans/127), the structural twin of lib/ocr-models.ts: constants only, NO
 * transformers.js, NO DOM - safe to import from the main thread (the reworder
 * facade, the catalog UI) or the worker.
 *
 * The file NAMES and byte counts are a PINNED CONTRACT shared verbatim with
 * scripts/fetch-reword-models.ts (Andy-run - this repo never vendors weights):
 * the worker loads whatever that script writes under
 * `/models/reword/smollm2-360m-instruct/`, via transformers.js's localModelPath.
 *
 * MODEL CHOICE (plans/127): SmolLM2-360M-Instruct, Apache-2.0, the q4 ONNX
 * export - the one dtype that runs on BOTH wasm and WebGPU, so a single ~370 MB
 * staged file serves every device. The q4f16 export (~260 MB) is WebGPU-only
 * and is the named future optimisation, not worth doubling the staging for
 * today. Qwen2.5-1.5B-Instruct is the named desktop-tier upgrade slot;
 * Llama 3.2 and Gemma fail the licence bar.
 *
 * WHY IT LIVES IN packages/node-shell (moved 2026-09-03, plans/183 WS2): reword
 * now runs on the Node shells too (onnxruntime-node through transformers.js,
 * packages/node-shell/src/ml/reword.ts). The model directory, the sampling
 * parameters and the decode budget must be the SAME on both, or a candidate the
 * terminal proposes is not one the app would have proposed. The parent repo is
 * the only place both can import from (shells/web and shells/cli are separately
 * versioned submodules), so the constants live here and
 * shells/web/src/lib/reword-models.ts re-exports them unchanged. The one thing
 * that stays behind is REWORD_MODEL_CACHE_URL, a browser Cache API probe built
 * from the web build's MODELS_BASE.
 */


/** The one staged model. The id doubles as the directory under /models/reword/. */
export const REWORD_MODEL_ID = 'smollm2-360m-instruct';

/** transformers.js model path (resolved against env.localModelPath = '/models/'). */
export const REWORD_MODEL_DIR = `reword/${REWORD_MODEL_ID}`;

/** Repo-relative files the fetch script stages - the full from_pretrained set. */
export const REWORD_MODEL_FILES = [
  'config.json',
  'generation_config.json',
  'special_tokens_map.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/model_q4.onnx',
] as const;

/** One-time download size for the consent UI (sum of REWORD_MODEL_FILES,
 *  verified against the upstream tree 2026-08-19; onnx/model_q4.onnx is
 *  387,943,246 of it). */
export const REWORD_MODEL_BYTES = 390_053_199;

/** Licence line - a real obligation the shell carries in its credits. */
export const REWORD_MODEL_LICENSE = 'Apache-2.0';
export const REWORD_MODEL_ATTRIBUTION =
  'SmolLM2-360M-Instruct, © Hugging Face SmolLM team (Apache-2.0)';

// ── Sampling parameters (shared by the worker; tuned in plans/127 WP4) ────────

/** Candidates sampled per sentence. The engine gate discards failures, so this
 *  is the ceiling on what a person is ever shown, not a promise. */
export const REWORD_SAMPLES = 3;
export const REWORD_TEMPERATURE = 0.8;
export const REWORD_TOP_P = 0.9;

/** Decode budget for one candidate: the output must end up SHORTER than the
 *  input to pass the gate, so paying for much more than the input length only
 *  buys tokens the gate will refuse. */
export function rewordMaxNewTokens(inputTokens: number): number {
  return Math.min(120, Math.max(24, Math.round(inputTokens * 1.25)));
}

// ── Staging gate ─────────────────────────────────────────────────────────────
//
// False until scripts/fetch-reword-models.ts has vendored the weights AND the
// staged set has been confirmed working end-to-end (tokenizer chat template
// applies, the graph loads, a real sentence generates) - the same two-part
// human gate OCR and matte use. Until then the reword UI is absent entirely
// and no fetch is ever attempted.

export const REWORD_STAGED = true;
// Staged 2026-08-19: files vendored via scripts/fetch-reword-models.ts (sha256
// pins recorded there, byte counts verified against the upstream tree), licence
// Apache-2.0 (official HuggingFaceTB export). The WP4 browser E2E - chat
// template applies, q4 graph loads, real sentences generate and gate - is the
// second half of the staging gate; see plans/127-reword-on-device.md.

/** The quantised weights file inside the model directory. Named here so the
 *  browser's Cache API probe and the Node existence check agree. */
export const REWORD_MODEL_ONNX = 'onnx/model_q4.onnx';
