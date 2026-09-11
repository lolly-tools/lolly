// SPDX-License-Identifier: MPL-2.0
/**
 * Reword worker (plans/127) - runs SmolLM2-360M-Instruct off-thread to propose
 * shorter, plainer rewrites of ONE sentence at a time. Everything heavy
 * (transformers.js, the ~370 MB q4 ONNX model) loads HERE, dynamically, so none
 * of it can reach the boot chunk. Same id-keyed pending-map protocol as the
 * speech workers, with per-request download/generation progress and a
 * cooperative abort checked between samples (a sample mid-inference cannot be
 * preempted in-wasm).
 *
 * SELF-HOSTED ONLY: the model is served same-origin from
 * /models/reword/smollm2-360m-instruct/ (staged by
 * scripts/fetch-reword-models.ts) on the onnxruntime-web build transformers.js
 * pins (/ort-hf/, scripts/copy-transformers-ort.ts). Remote models are disabled
 * outright, so no text or bytes ever leave the device
 * (lib/reword-privacy.test.ts pins these lines, like speech's).
 *
 * The worker returns RAW candidate strings. The engine's deterministic pipeline
 * (normalise → humanizeText → rewordGate) runs on the MAIN thread - the model
 * samples freely before the gate; the gate decides what a person ever sees.
 * The prompt itself is engine data (buildRewordMessages), so shells cannot
 * drift.
 *
 * Every sample is WATERMARKED (engine text-watermark.ts - the green-list
 * scheme of Kirchenbauer et al., arXiv:2301.10226): a logits processor biases
 * the hash-keyed green quarter of the vocabulary each step, so reworded text
 * stays statistically attributable to Lolly after copy/paste. The dual
 * 'wm-detect' request scores any text against that scheme with the tokenizer
 * alone - the model is never downloaded for a detection.
 *
 * Device: WebGPU when the worker has it, else wasm - same q4 file either way.
 * A WebGPU init failure falls back to wasm rather than failing the request.
 */

import { buildRewordMessages, addGreenBias, scoreTokenWatermark, REWORD_WATERMARK } from '@lolly/engine';
import type { TextWatermarkScore } from '@lolly/engine';
import {
  REWORD_MODEL_DIR, REWORD_MODEL_BYTES, REWORD_SAMPLES, REWORD_TEMPERATURE,
  REWORD_TOP_P, rewordMaxNewTokens,
} from './reword-models.ts';
import { ORT_HF_BASE } from './ort-hf-base.ts';
import { MODELS_BASE } from './models-base.ts';

export interface RewordWorkerRequest {
  id: number;
  type: 'reword' | 'abort' | 'wm-detect';
  sentence?: string;
  /** Candidates to sample (default REWORD_SAMPLES). */
  count?: number;
  /** wm-detect only: the text to score against the reword watermark. */
  text?: string;
}

export interface RewordWorkerProgress {
  phase: 'download' | 'generate';
  fraction: number;
  loaded?: number;
  total?: number;
}

export interface RewordWorkerReply {
  id: number;
  progress?: RewordWorkerProgress;
  /** Raw model replies, in sample order - unfiltered; the engine gate judges. */
  result?: string[];
  /** wm-detect only: the watermark score for the submitted text. */
  wm?: TextWatermarkScore;
  error?: string;
}

// Worker scope: `postMessage` here is the DedicatedWorkerGlobalScope overload.
const post = postMessage as (message: unknown, transfer?: Transferable[]) => void;

/** Requests aborted from the main thread; the sample loop checks between samples. */
const aborted = new Set<number>();

// Minimal shapes for the transformers.js pieces we touch - its own typings are
// bundler-hostile generics, and the operations below are the whole surface.
interface TensorLike {
  dims: number[];
  slice(...args: unknown[]): TensorLike;
}
/** One next-token logits row batch, as the logits processor sees it. */
interface LogitsLike {
  dims: number[];
  data: Float32Array;
}
interface TokenizerLike {
  apply_chat_template(
    messages: Array<{ role: string; content: string }>,
    opts: { add_generation_prompt: boolean; return_dict: boolean },
  ): { input_ids: TensorLike; attention_mask: TensorLike };
  batch_decode(ids: TensorLike, opts: { skip_special_tokens: boolean }): string[];
  encode(text: string, opts?: { add_special_tokens?: boolean }): number[];
}
interface ModelLike {
  generate(opts: Record<string, unknown>): Promise<TensorLike>;
}
interface TfLike {
  AutoModelForCausalLM: { from_pretrained(dir: string, opts: Record<string, unknown>): Promise<unknown> };
  AutoTokenizer: { from_pretrained(dir: string, opts?: Record<string, unknown>): Promise<unknown> };
  LogitsProcessor: unknown;
  LogitsProcessorList: unknown;
}
interface RewordRuntime {
  model: ModelLike;
  tokenizer: TokenizerLike;
  /** The green-list watermark bias, as a LogitsProcessorList for generate(). */
  wm: object;
}

type ProgressCb = (p: { status?: string; file?: string; loaded?: number; total?: number }) => void;

let tfP: Promise<TfLike> | null = null;

/** Import transformers.js once and pin its environment before anything loads. */
function tf(): Promise<TfLike> {
  if (tfP) return tfP;
  tfP = import('@huggingface/transformers').then((mod) => {
    const { env } = mod;
    // Same-origin everything (see the module header) - the whole privacy story
    // rides on these three lines, and reword-privacy.test.ts pins them.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    // MODELS_BASE is '' on the web build (→ same-origin '/models/', unchanged); the
    // desktop shell bakes https://lolly.tools so the wasm reword path pulls weights
    // from there. allowRemoteModels stays false - nothing hits the HF hub.
    env.localModelPath = `${MODELS_BASE}/models/`;
    if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = ORT_HF_BASE;
    return mod as unknown as TfLike;
  });
  return tfP;
}

let tokenizerP: Promise<TokenizerLike> | null = null;

/** Load the tokenizer alone (a few MB) - watermark detection never pays for
 *  the ~370 MB model it does not need. Generation shares the same promise. */
function ensureTokenizer(progress?: ProgressCb): Promise<TokenizerLike> {
  if (!tokenizerP) {
    tokenizerP = tf()
      .then((m) => m.AutoTokenizer.from_pretrained(REWORD_MODEL_DIR, progress ? { progress_callback: progress } : {}))
      .then((t) => t as TokenizerLike)
      .catch((e) => { tokenizerP = null; throw e; });
  }
  return tokenizerP;
}

/** The Kirchenbauer green-list watermark (engine text-watermark.ts,
 *  arXiv:2301.10226): +delta on every green logit each step, seeded by the
 *  previous token id. Runs BEFORE the temperature/top-p sampler, exactly like
 *  the native sampler in reword.rs - the two embedders share the engine hash
 *  so /verify reads them identically. */
function watermarkProcessorList(mod: TfLike): object {
  const Processor = mod.LogitsProcessor as new () => object;
  class GreenListBias extends Processor {
    _call(inputIds: Array<ArrayLike<number | bigint>>, logits: LogitsLike): LogitsLike {
      const vocab = logits.dims[logits.dims.length - 1] ?? logits.data.length;
      for (let b = 0; b < inputIds.length; b++) {
        const row = inputIds[b]!;
        const prev = Number(row[row.length - 1] ?? 0);
        addGreenBias(logits.data.subarray(b * vocab, (b + 1) * vocab), prev, REWORD_WATERMARK);
      }
      return logits;
    }
  }
  const list = new (mod.LogitsProcessorList as new () => { push(p: object): void })();
  list.push(new GreenListBias());
  return list;
}

let runtime: Promise<RewordRuntime> | null = null;

/**
 * Load transformers.js + the model + tokenizer, once. Download progress is
 * attributed to the request that triggered the load; later requests find
 * everything resident and skip straight to generation.
 */
function ensureRuntime(id: number): Promise<RewordRuntime> {
  if (runtime) return runtime;
  runtime = (async (): Promise<RewordRuntime> => {
    const mod = await tf();

    // One aggregate download meter across the model + tokenizer files.
    const loadedByFile = new Map<string, number>();
    const progressCallback: ProgressCb = (p) => {
      if (p.status !== 'progress' || !p.file || typeof p.loaded !== 'number') return;
      loadedByFile.set(p.file, p.loaded);
      let loaded = 0;
      for (const v of loadedByFile.values()) loaded += v;
      post({
        id,
        progress: { phase: 'download', loaded, total: REWORD_MODEL_BYTES, fraction: Math.min(1, loaded / REWORD_MODEL_BYTES) },
      } satisfies RewordWorkerReply);
    };

    // Deliberately wasm, NOT webgpu, for THIS model file: the q4 export's
    // MatMulNBits nodes have no WebGPU kernel in the pinned ORT build, so a
    // "webgpu" session runs every matmul on single-thread CPU per-node
    // fallback - measured ~380 s per span, on any machine. Multi-threaded
    // wasm (cross-origin isolation makes it real) measured ~10 s for load +
    // a sample. The WebGPU tier is the ~260 MB q4f16 export, staged
    // separately when taken up (plans/127 section 6).
    const [model, tokenizer] = await Promise.all([
      mod.AutoModelForCausalLM.from_pretrained(REWORD_MODEL_DIR, { dtype: 'q4', device: 'wasm', progress_callback: progressCallback }),
      ensureTokenizer(progressCallback),
    ]);
    return { model: model as ModelLike, tokenizer, wm: watermarkProcessorList(mod) };
  })().catch((e) => { runtime = null; throw e; });
  return runtime;
}

async function reword(id: number, sentence: string, count: number): Promise<void> {
  const { model, tokenizer, wm } = await ensureRuntime(id);
  const inputs = tokenizer.apply_chat_template(buildRewordMessages(sentence), {
    add_generation_prompt: true,
    return_dict: true,
  });
  const inputLen = inputs.input_ids.dims[1] ?? 0;
  const maxNew = rewordMaxNewTokens(inputLen);
  const out: string[] = [];
  for (let k = 0; k < count; k++) {
    if (aborted.has(id)) break;
    const output = await model.generate({
      ...inputs,
      max_new_tokens: maxNew,
      do_sample: true,
      temperature: REWORD_TEMPERATURE,
      top_p: REWORD_TOP_P,
      logits_processor: wm,
    });
    const decoded = tokenizer.batch_decode(output.slice(null, [inputLen, null]), { skip_special_tokens: true });
    if (decoded[0]) out.push(decoded[0]);
    post({ id, progress: { phase: 'generate', fraction: (k + 1) / count } } satisfies RewordWorkerReply);
  }
  post({ id, result: out } satisfies RewordWorkerReply);
}

/** Score a text against the reword watermark - tokenizer only, no model. The
 *  signal is the visible word choice, so it survives copy/paste and OCR; the
 *  64 KB cap matches the verify view's own analysis head. */
async function detectWatermark(id: number, text: string): Promise<void> {
  const tokenizer = await ensureTokenizer();
  const ids = tokenizer.encode(text.slice(0, 65536), { add_special_tokens: false });
  post({ id, wm: scoreTokenWatermark(ids, REWORD_WATERMARK) } satisfies RewordWorkerReply);
}

onmessage = (e: MessageEvent<RewordWorkerRequest>): void => {
  const { id, type, sentence, count, text } = e.data;
  if (type === 'abort') { aborted.add(id); return; }
  if (type === 'wm-detect') {
    if (typeof text !== 'string' || !text.trim()) {
      post({ id, error: 'nothing to score' } satisfies RewordWorkerReply);
      return;
    }
    detectWatermark(id, text)
      .catch((err) => { post({ id, error: err instanceof Error ? err.message : String(err) } satisfies RewordWorkerReply); });
    return;
  }
  if (type !== 'reword' || typeof sentence !== 'string' || !sentence.trim()) {
    post({ id, error: 'nothing to reword' } satisfies RewordWorkerReply);
    return;
  }
  reword(id, sentence, Math.max(1, Math.min(6, count ?? REWORD_SAMPLES)))
    .catch((err) => { post({ id, error: err instanceof Error ? err.message : String(err) } satisfies RewordWorkerReply); })
    .finally(() => { aborted.delete(id); });
};
