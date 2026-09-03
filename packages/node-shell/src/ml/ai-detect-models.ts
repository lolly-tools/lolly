// SPDX-License-Identifier: MPL-2.0
/**
 * On-device AI-text detector - the PURE catalogue half of plans/126 WP-A's
 * local-model tier, the structural twin of lib/reword-models.ts: constants
 * only, NO transformers.js, NO DOM - safe to import from the main thread (the
 * ai-detect facade, the views) or the worker.
 *
 * The file NAMES and byte counts are a PINNED CONTRACT shared verbatim with
 * scripts/fetch-ai-detect-models.ts (Andy-run - this repo never vendors
 * weights): the worker loads whatever that script writes under
 * `/models/ai-detect/<id>/`, via transformers.js's localModelPath.
 *
 * MODEL CHOICE (plans/126 WP-A; REVERSED at staging, 2026-08-21, on measured
 * evidence): the plan named the ModernBERT RAID+MAGE fine-tune primary on its
 * benchmarks, but calibration against the corpus + REAL local-LLM generations
 * found its top region saturated - a real SmolLM2 answer (0.9828) and the
 * corpus's NON-NATIVE-ENGLISH HUMAN sample (0.9829) are inseparable, so no
 * threshold both catches machine text and spares that writer. The e5-small
 * LoRA detector (MIT) separates cleanly on the same data (humans <= 0.46,
 * real LLM output 0.78-0.92) and is a fifth of the size, so IT is the staged
 * primary; ModernBERT stays exported + pinned, unstaged, awaiting a larger
 * calibration corpus. Rejected outright: desklib DeBERTa (size),
 * SuperAnnotate (copyleft), the 2019 OpenAI RoBERTa detectors (obsolete +
 * documented non-native-English bias), Binoculars / Fast-DetectGPT
 * (paired-LLM compute, not WASM-feasible).
 *
 * HONESTY CONTRACT (mirror this wherever the estimate surfaces): strong on
 * GPT-4/ChatGPT/Llama-era text, degraded under paraphrase or humanizer
 * attack, unquantified on the newest model generations - and low-perplexity
 * HUMAN prose (especially non-native English) can score high, which is why
 * the engine caps the model's evidence below 'strong' on its own
 * (`applyModelEstimate`) and the verdict renders as an estimate row, never in
 * the band heading.
 *
 * WHY IT LIVES IN packages/node-shell (moved 2026-09-03, plans/183 WS2): the
 * detector now runs on the Node shells too (onnxruntime-node through
 * transformers.js, packages/node-shell/src/ml/ai-detect.ts). The roster, the
 * calibrated threshold and the eligibility gate must be the SAME on both, or a
 * `lolly detect-ai` reading would not be the reading the app gives. The parent
 * repo is the only place both can import from (shells/web and shells/cli are
 * separately versioned submodules), so the constants live here and
 * shells/web/src/lib/ai-detect-models.ts re-exports them unchanged. The one
 * thing that stays behind is `aiDetectCacheUrl`, which is a browser Cache API
 * probe built from the web build's MODELS_BASE.
 */


export interface AiDetectModel {
  /** Roster id; doubles as the directory under /models/ai-detect/. */
  id: string;
  /** Display name for the findings row and the consent line. */
  name: string;
  /** transformers.js model path (against env.localModelPath = '/models/'). */
  dir: string;
  /** Repo-relative files the fetch script stages - the from_pretrained set. */
  files: readonly string[];
  /** Approximate one-time download for the consent line; the fetch script
   *  prints the exact figure at staging time - update it then. */
  bytes: number;
  /** Token budget for one classification pass (the model's usable context). */
  maxTokens: number;
  /**
   * The calibrated operating threshold: probAi at or above this counts as
   * evidence, below it the run reports NOTHING (absence, never exoneration).
   * PROVISIONAL until staging - the fetch gate includes measuring it against
   * the corpus at a ~1% false-positive rate and pinning the measured value.
   */
  threshold: number;
  /** Which id2label name means "AI" (matched case-insensitively at runtime;
   *  verified against config.json at staging). */
  aiLabel: RegExp;
  license: string;
  attribution: string;
}

export const AI_DETECT_MODELS: readonly AiDetectModel[] = [
  {
    id: 'e5-small-ai-detector',
    name: 'e5-small AI-text detector',
    dir: 'ai-detect/e5-small-ai-detector',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'special_tokens_map.json',
      'onnx/model_quantized.onnx',
    ],
    // Measured at staging 2026-08-21 (the int8 conversion this repo pins).
    bytes: 34_648_928,
    maxTokens: 512,
    // Calibrated 2026-08-21 against the FP corpus + real local-LLM output:
    // human fixtures score <= 0.4574 (the non-native-English sample 0.4244),
    // machine text 0.78-0.93. 0.75 clears the worst human by a 0.29 margin;
    // the margin-scaled engine weight keeps a barely-past score barely
    // evidence. tests/ai-detect-model-gate.test.ts re-runs this contract
    // against the real graph whenever the staged files are present.
    threshold: 0.75,
    aiLabel: /ai|machine|generated|fake/i,
    license: 'MIT',
    attribution: 'e5-small-lora-ai-generated-detector, © May Zhou (MIT)',
  },
  {
    id: 'modernbert-raid-mage',
    name: 'ModernBERT AI-text detector',
    dir: 'ai-detect/modernbert-raid-mage',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'special_tokens_map.json',
      'onnx/model_quantized.onnx',
    ],
    bytes: 154_500_000,
    maxTokens: 2048,
    // UNSTAGED: measured saturation (see the header) - real machine text and
    // non-native human prose both land at ~0.983, so no honest threshold
    // exists on the current calibration data. 0.99 recorded as the least-bad
    // point if a larger corpus ever justifies staging it.
    threshold: 0.99,
    aiLabel: /ai|machine|generated|fake/i,
    license: 'Apache-2.0',
    attribution: 'modernbert-ai-detection-raid-mage, © George Drayson (Apache-2.0)',
  },
] as const;

// ── Staging gate ─────────────────────────────────────────────────────────────
//
// A model goes true only after scripts/fetch-ai-detect-models.ts has vendored
// its weights AND the 6-step licence/graph gate has passed - the same
// two-part human gate OCR, matte and reword use. Until a model is staged its
// UI is absent entirely and no fetch is ever attempted.
//
// e5 staged 2026-08-21: MIT (card + repo metadata verified), converted to ONNX
// locally with optimum at a pinned revision + int8 quantize_dynamic (command
// recorded in the fetch script), graph runs on both onnxruntime-node and the
// browser worker, labels written into the staged config.json from the card
// (Label_0 human / Label_1 AI, verified empirically: AI-shaped corpus fixtures
// and real SmolLM2 generations score high on index 1, humans low), threshold
// calibrated against the FP corpus (see the roster entry).

export const AI_DETECT_STAGED: Record<string, boolean> = {
  'e5-small-ai-detector': true,
  'modernbert-raid-mage': false,
};

/** The model this build runs: the first staged roster entry (primary first). */
export function aiDetectModel(): AiDetectModel | null {
  return AI_DETECT_MODELS.find((m) => AI_DETECT_STAGED[m.id]) ?? null;
}

// ── The eligibility gate (moved from lib/ai-detect.ts, same change) ──────────
//
// The gate mirrors the engine analyser's own bias guard, deliberately: the
// detector is trained on English, and detector models are documented to score
// high on non-native-English human prose - so short or non-Latin text is never
// sent to the model at all, on any shell.

/** Minimum words before the model runs - the engine's stylometry floor is 25;
 *  the classifier needs more text than that to say anything defensible. */
export const AI_DETECT_MIN_WORDS = 50;
/** Latin-letter share below which the text is not the model's language. */
export const AI_DETECT_MIN_LATIN = 0.6;
/** The runner never sees more than this (the model truncates to its own token
 *  budget anyway; on the web this also bounds the postMessage payload). */
export const AI_DETECT_TEXT_CAP = 65536;

/** Pure: is this text one the detector may honestly be asked about? */
export function aiDetectEligible(text: string): boolean {
  const t = text.slice(0, AI_DETECT_TEXT_CAP);
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words < AI_DETECT_MIN_WORDS) return false;
  const letters = t.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return false;
  const latin = t.match(/\p{Script=Latin}/gu)?.length ?? 0;
  return latin / letters >= AI_DETECT_MIN_LATIN;
}
