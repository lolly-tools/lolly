// SPDX-License-Identifier: MPL-2.0
/**
 * AI-text detector worker (plans/126 WP-A) - runs the staged classifier
 * off-thread to estimate whether a text is AI-generated. Everything heavy
 * (transformers.js, the ONNX model) loads HERE, dynamically, so none of it can
 * reach the boot chunk. Same id-keyed pending-map protocol as the reword and
 * speech workers, with per-request download progress.
 *
 * SELF-HOSTED ONLY: the model is served same-origin from
 * /models/ai-detect/<id>/ (staged by scripts/fetch-ai-detect-models.ts) on the
 * onnxruntime-web build transformers.js pins (/ort-hf/). Remote models are
 * disabled outright, so no text or bytes ever leave the device
 * (lib/ai-detect-privacy.test.ts pins these lines, like reword's).
 *
 * The worker returns a raw classifier score. The provisional operating
 * threshold, evidence cap and band fold are interpreted in the ENGINE
 * (`applyModelEstimate`), so every shell scores identically - this side owns
 * only tokenise → forward → softmax.
 */

import { forensicModelWindows, forensicChunkScores, type ForensicModelWindow, type ForensicModelChunk } from '@lolly/engine';
import { aiDetectEligible, type AiDetectModel } from './ai-detect-models.ts';
import { ORT_HF_BASE } from './ort-hf-base.ts';
import { MODELS_BASE } from './models-base.ts';

export interface AiDetectWorkerRequest {
  id: number;
  type: 'score' | 'cancel';
  text?: string;
  /** The roster entry to run - passed in so the worker holds no roster copy. */
  model?: AiDetectModel;
  /** Also score each sentence chunk, for the Verify heat view. */
  chunks?: boolean;
}

export interface AiDetectWorkerReply {
  id: number;
  progress?: { phase: 'download'; fraction: number; loaded?: number; total?: number };
  /** The classifier's raw AI-side score, 0-1; not calibrated probability. */
  prob?: number;
  /** Which label was read as the AI side, for the staging gate's sanity log. */
  label?: string;
  windows?: ForensicModelWindow[];
  complete?: boolean;
  chunks?: ForensicModelChunk[];
  error?: string;
}

const post = postMessage as (message: unknown, transfer?: Transferable[]) => void;

// Minimal shapes for the transformers.js pieces we touch (the reword worker's
// idiom - its own typings are bundler-hostile generics).
interface TensorLike { data: Float32Array; dims: number[] }
interface ClassifierLike {
  (inputs: Record<string, unknown>): Promise<{ logits: TensorLike }>;
  config: { id2label?: Record<string, string> };
}
type TokenizeFnLike = (text: string, opts: { truncation: boolean; max_length: number }) => Record<string, unknown>

interface Runtime { model: ClassifierLike; tokenize: TokenizeFnLike }

let runtime: Promise<Runtime> | null = null;
let runtimeFor = '';

function ensureRuntime(id: number, m: AiDetectModel): Promise<Runtime> {
  if (runtime && runtimeFor === m.id) return runtime;
  runtimeFor = m.id;
  runtime = (async (): Promise<Runtime> => {
    const { env, AutoModelForSequenceClassification, AutoTokenizer } = await import('@huggingface/transformers');

    // Same-origin everything - the privacy story rides on these lines, and
    // lib/ai-detect-privacy.test.ts pins them.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = `${MODELS_BASE}/models/`;
    if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = ORT_HF_BASE;

    // One aggregate download meter across the model files.
    const loadedByFile = new Map<string, number>();
    const progress_callback = (p: { status?: string; file?: string; loaded?: number }): void => {
      if (p.status !== 'progress' || !p.file || typeof p.loaded !== 'number') return;
      loadedByFile.set(p.file, p.loaded);
      let loaded = 0;
      for (const v of loadedByFile.values()) loaded += v;
      post({ id, progress: { phase: 'download', loaded, total: m.bytes, fraction: Math.min(1, loaded / m.bytes) } } satisfies AiDetectWorkerReply);
    };

    // 'q8' resolves to the staged onnx/model_quantized.onnx; wasm for the same
    // reason as reword - one file that runs everywhere.
    const [model, tokenizer] = await Promise.all([
      AutoModelForSequenceClassification.from_pretrained(m.dir, { dtype: 'q8', device: 'wasm', session_options: { graphOptimizationLevel: 'basic' }, progress_callback }),
      AutoTokenizer.from_pretrained(m.dir, { progress_callback }),
    ]);
    return { model: model as unknown as ClassifierLike, tokenize: tokenizer as unknown as TokenizeFnLike };
  })().catch((e) => { runtime = null; runtimeFor = ''; throw e; });
  return runtime;
}

function softmax(row: Float32Array): number[] {
  let max = -Infinity;
  for (const v of row) if (v > max) max = v;
  const exps = [...row].map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

const cancelled = new Set<number>(), active = new Set<number>();
async function score(id: number, text: string, m: AiDetectModel, wantChunks = false): Promise<void> {
  const { model, tokenize } = await ensureRuntime(id, m);
  const measure = (part: string): number => (tokenize(part, { truncation: false, max_length: m.maxTokens }).input_ids as TensorLike).dims.at(-1)!;
  // Which output index is "AI"? Read the graph's own labels; a two-label graph
  // with no readable labels falls back to index 1 (the conventional positive).
  const labels = model.config.id2label ?? {};
  let aiIndex = -1;
  for (const [k, v] of Object.entries(labels)) {
    if (m.aiLabel.test(v)) { aiIndex = Number(k); break; }
  }
  if (aiIndex < 0) aiIndex = 1;
  const result = await forensicModelWindows(text, m.maxTokens, measure, async part => {
    const { logits } = await model(tokenize(part, { truncation: false, max_length: m.maxTokens }));
    return softmax(logits.data)[aiIndex] ?? 0;
  }, 32, () => cancelled.has(id));
  // A chunk outside the English prose gate is left unscored, the same gate the
  // whole text passed to get here.
  const chunks = wantChunks && !cancelled.has(id)
    ? await forensicChunkScores(text, async (chunk) => {
      if (!aiDetectEligible(chunk)) return null;
      const { logits } = await model(tokenize(chunk, { truncation: true, max_length: m.maxTokens }));
      return softmax(logits.data)[aiIndex] ?? 0;
    }, () => cancelled.has(id))
    : undefined;
  cancelled.delete(id);
  post({ id, prob: result.rawMean, windows: result.windows, complete: result.complete, ...(chunks ? { chunks } : {}), label: labels[String(aiIndex)] ?? String(aiIndex) } satisfies AiDetectWorkerReply);
}

globalThis.onmessage = (e: MessageEvent<AiDetectWorkerRequest>): void => {
  const { id, type, text, model, chunks } = e.data;
  if (type === 'cancel') { if (active.has(id)) cancelled.add(id); return; }
  if (type !== 'score' || typeof text !== 'string' || !text.trim() || !model) {
    post({ id, error: 'nothing to score' } satisfies AiDetectWorkerReply);
    return;
  }
  active.add(id);
  score(id, text, model, chunks === true)
    .catch((err) => { cancelled.delete(id); post({ id, error: err instanceof Error ? err.message : String(err) } satisfies AiDetectWorkerReply); })
    .finally(() => { active.delete(id); cancelled.delete(id); });
};
