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
 * The web twin is shells/web/src/lib/ai-detect-worker.ts. THE MODEL CONFIGURATION USES THE
 * SAME MODULE: the roster, the operating threshold, the label regex and the
 * eligibility gate come from ml/ai-detect-models.ts, which the web facade
 * imports too. Both sides return a raw classifier score and let the ENGINE do the
 * fold (`applyModelEstimate`). Located reports record the runtime separately;
 * quantized CPU and WebAssembly scores can differ numerically.
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
import { forensicModelWindows, forensicChunkScores, type AiModelEstimate, type ForensicModelChunk } from '@lolly/engine';
import {
  aiDetectEligible, aiDetectModel, type AiDetectModel,
} from './ai-detect-models.ts';
import {
  familyDir, isTransformersAvailable, modelFilesExist, refuseMissing, resolveModelsDir,
} from './session.ts';
import { transformersSessionOptions } from './session.ts';

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
  /** `chunks` also scores each sentence chunk for the heat view (forensic/heat.ts). */
  score(text: string, opts?: { prefixOnly?: boolean; chunks?: boolean }): Promise<(AiModelEstimate & { chunks?: ForensicModelChunk[] }) | null>;
}

interface TensorLike { data: Float32Array; dims: number[] }
interface ClassifierLike {
  (inputs: Record<string, unknown>): Promise<{ logits: TensorLike }>;
  config: { id2label?: Record<string, string> };
}
type TokenizeFnLike = (text: string, opts: { truncation: boolean; max_length: number }) => Record<string, unknown>;

const runtimes = new Map<string, Promise<{ model: ClassifierLike; tokenize: TokenizeFnLike }>>();

function ensureRuntime(m: AiDetectModel, legacy = false): Promise<{ model: ClassifierLike; tokenize: TokenizeFnLike }> {
  const key = `${m.id}:${legacy ? 'legacy' : 'basic'}`;
  const cached = runtimes.get(key);
  if (cached) return cached;
  const runtime = (async () => {
    const { env, AutoModelForSequenceClassification, AutoTokenizer } = await import('@huggingface/transformers');
    // The privacy pins, the same three the web worker sets.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = `${resolveModelsDir()}/`;
    const [model, tokenizer] = await Promise.all([
      AutoModelForSequenceClassification.from_pretrained(m.dir, { dtype: 'q8', device: 'cpu', session_options: { ...transformersSessionOptions().session_options, graphOptimizationLevel: legacy ? 'all' : 'basic' } }),
      AutoTokenizer.from_pretrained(m.dir),
    ]);
    return { model: model as unknown as ClassifierLike, tokenize: tokenizer as unknown as TokenizeFnLike };
  })().catch((e) => { runtimes.delete(key); throw e; });
  runtimes.set(key, runtime);
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

    async score(text: string, opts: { prefixOnly?: boolean; chunks?: boolean } = {}): Promise<(AiModelEstimate & { chunks?: ForensicModelChunk[] }) | null> {
      const m = aiDetectModel();
      if (!m) return null;
      if (!aiDetectEligible(text)) return null;
      if (!modelFilesExist('ai-detect', filesFor(m))) {
        refuseMissing('ai-detect', m.name, m.bytes);
      }
      const { model, tokenize } = await ensureRuntime(m, opts.prefixOnly === true);
      const measure = (part: string): number => (tokenize(part, { truncation: false, max_length: m.maxTokens }).input_ids as TensorLike).dims.at(-1)!;
      // Which output index is "AI"? Read the graph's own labels; a two-label
      // graph with no readable labels falls back to index 1 (the conventional
      // positive). The same read the web worker does.
      const labels = model.config.id2label ?? {};
      let aiIndex = -1;
      for (const [k, v] of Object.entries(labels)) {
        if (m.aiLabel.test(v)) { aiIndex = Number(k); break; }
      }
      if (aiIndex < 0) aiIndex = 1;
      if (opts.prefixOnly) {
        const { logits } = await model(tokenize(text.slice(0, 65_536), { truncation: true, max_length: m.maxTokens }));
        return { probAi: softmax(logits.data)[aiIndex] ?? 0, threshold: m.threshold, modelId: m.id, modelName: m.name, complete: false };
      }
      const result = await forensicModelWindows(text, m.maxTokens, measure, async part => {
        const { logits } = await model(tokenize(part, { truncation: false, max_length: m.maxTokens }));
        return softmax(logits.data)[aiIndex] ?? 0;
      });
      // A chunk outside the English prose gate (a list of names, a code line)
      // is left unscored rather than read by a model trained on prose.
      const chunks = opts.chunks
        ? await forensicChunkScores(text, async (chunk) => {
          if (!aiDetectEligible(chunk)) return null;
          const { logits } = await model(tokenize(chunk, { truncation: true, max_length: m.maxTokens }));
          return softmax(logits.data)[aiIndex] ?? 0;
        })
        : undefined;
      return { probAi: result.rawMean, windows: result.windows, complete: result.complete, threshold: m.threshold, modelId: m.id, modelName: m.name, ...(chunks ? { chunks } : {}) };
    },
  };
}

/** Where the detector's files are expected, for a diagnostic line. */
export function aiDetectDir(): string {
  return familyDir('ai-detect');
}
