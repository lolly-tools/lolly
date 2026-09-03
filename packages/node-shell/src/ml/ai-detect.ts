// SPDX-License-Identifier: MPL-2.0
/**
 * The on-device AI-text detector for the Node shells: the staged e5-small LoRA
 * classifier through transformers.js, which runs on onnxruntime-node here and
 * onnxruntime-web in the browser worker.
 *
 * NOT A HostV1 MEMBER: `packages/core/src/host-v1.ts` has no `aiDetect` on the
 * bridge. On the web this is a lib the views call (lib/ai-detect.ts), not a
 * bridge method, so the Node twin is the same shape - an API for the CLI
 * wrapper, and nothing attached to `host`.
 *
 * The web twin is shells/web/src/lib/ai-detect-worker.ts. THE CALIBRATION IS THE
 * SAME MODULE: the roster, the operating threshold, the label regex and the
 * eligibility gate come from ml/ai-detect-models.ts, which the web facade
 * imports too. Both sides return a RAW probability and let the ENGINE do the
 * fold (`applyModelEstimate`), so a reading in the terminal is the reading the
 * app gives.
 *
 * SELF-HOSTED ONLY, exactly as on the web: `env.allowRemoteModels = false` and
 * `env.localModelPath` points at the resolved models directory, so no text and
 * no bytes leave the machine. tests/ai-detect-model-gate.test.ts already drives
 * this same graph through this same path.
 *
 * THE GATE IS NOT DECORATION. The detector is trained on English and is
 * documented to over-score non-native-English human prose, so short or non-Latin
 * text is never sent to the model at all: `score()` answers null, which means
 * "the check did not run" and must never be rendered as a verdict either way.
 */
import type { AiModelEstimate } from '@lolly/engine';
import {
  AI_DETECT_TEXT_CAP, aiDetectEligible, aiDetectModel, type AiDetectModel,
} from './ai-detect-models.ts';
import {
  familyDir, isTransformersAvailable, modelFilesExist, refuseMissing, resolveModelsDir,
} from './session.ts';

/** The Node AI-detect surface. `score` returns the engine-shaped estimate, or
 *  null wherever the check cannot or should not run. */
export interface NodeAiDetectAPI {
  isAvailable(): boolean;
  /** The staged model, or null when none is. */
  model(): AiDetectModel | null;
  modelBytes(): number;
  cached(): Promise<boolean>;
  /** Pure: may the detector honestly be asked about this text? */
  eligible(text: string): boolean;
  score(text: string): Promise<AiModelEstimate | null>;
}

interface TensorLike { data: Float32Array; dims: number[] }
interface ClassifierLike {
  (inputs: Record<string, unknown>): Promise<{ logits: TensorLike }>;
  config: { id2label?: Record<string, string> };
}
type TokenizeFnLike = (text: string, opts: { truncation: boolean; max_length: number }) => Record<string, unknown>;

let runtime: Promise<{ model: ClassifierLike; tokenize: TokenizeFnLike }> | null = null;

function ensureRuntime(m: AiDetectModel): Promise<{ model: ClassifierLike; tokenize: TokenizeFnLike }> {
  runtime ??= (async () => {
    const { env, AutoModelForSequenceClassification, AutoTokenizer } = await import('@huggingface/transformers');
    // The privacy pins, the same three the web worker sets.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = `${resolveModelsDir()}/`;
    const [model, tokenizer] = await Promise.all([
      AutoModelForSequenceClassification.from_pretrained(m.dir, { dtype: 'q8' }),
      AutoTokenizer.from_pretrained(m.dir),
    ]);
    return { model: model as unknown as ClassifierLike, tokenize: tokenizer as unknown as TokenizeFnLike };
  })().catch((e) => { runtime = null; throw e; });
  return runtime;
}

function softmax(row: Float32Array): number[] {
  let max = -Infinity;
  for (const v of row) if (v > max) max = v;
  const exps = [...row].map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** The files a staged model needs on disk, relative to its family directory. */
function filesFor(m: AiDetectModel): string[] {
  const prefix = m.dir.replace(/^ai-detect\//, '');
  return m.files.map((f) => `${prefix}/${f}`);
}

/**
 * The Node AI-text detector, or null when transformers.js cannot be resolved
 * here (a lean install, or the bundled MCP function).
 */
export function createNodeAiDetectAPI(): NodeAiDetectAPI | null {
  if (!isTransformersAvailable()) return null;
  return {
    isAvailable: () => aiDetectModel() !== null,
    model: () => aiDetectModel(),
    modelBytes: () => aiDetectModel()?.bytes ?? 0,
    cached: async () => {
      const m = aiDetectModel();
      return !!m && modelFilesExist('ai-detect', filesFor(m));
    },
    eligible: (text) => aiDetectEligible(text),

    async score(text: string): Promise<AiModelEstimate | null> {
      const m = aiDetectModel();
      if (!m) return null;
      if (!aiDetectEligible(text)) return null;
      if (!modelFilesExist('ai-detect', filesFor(m))) {
        refuseMissing('ai-detect', m.name, m.bytes);
      }
      const { model, tokenize } = await ensureRuntime(m);
      const inputs = tokenize(text.slice(0, AI_DETECT_TEXT_CAP), { truncation: true, max_length: m.maxTokens });
      const { logits } = await model(inputs);
      const probs = softmax(logits.data);
      // Which output index is "AI"? Read the graph's own labels; a two-label
      // graph with no readable labels falls back to index 1 (the conventional
      // positive). The same read the web worker does.
      const labels = model.config.id2label ?? {};
      let aiIndex = -1;
      for (const [k, v] of Object.entries(labels)) {
        if (m.aiLabel.test(v)) { aiIndex = Number(k); break; }
      }
      if (aiIndex < 0) aiIndex = probs.length > 1 ? 1 : 0;
      return { probAi: probs[aiIndex] ?? 0, threshold: m.threshold, modelId: m.id, modelName: m.name };
    },
  };
}

/** Where the detector's files are expected, for a diagnostic line. */
export function aiDetectDir(): string {
  return familyDir('ai-detect');
}
