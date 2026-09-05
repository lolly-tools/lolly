// SPDX-License-Identifier: MPL-2.0
/**
 * On-device rewording for the Node shells: SmolLM2-360M-Instruct through
 * transformers.js, which runs on onnxruntime-node here and onnxruntime-web in
 * the browser worker.
 *
 * NOT A HostV1 MEMBER: `packages/core/src/host-v1.ts` has no `reword` on the
 * bridge. On the web this is a lib the catalog UI calls (lib/reworder.ts), so
 * the Node twin is the same shape - an API for the CLI wrapper, nothing attached
 * to `host`.
 *
 * The web twin is shells/web/src/lib/reword-worker.ts, and everything that
 * decides what a person is shown is shared:
 *
 *   the prompt          @lolly/engine buildRewordMessages (engine DATA - the
 *                       reason shells cannot drift on behaviour)
 *   the watermark       @lolly/engine addGreenBias + REWORD_WATERMARK, applied
 *                       as a logits processor before the sampler, exactly as the
 *                       web worker and the native Rust sampler do
 *   the gate            @lolly/engine rewordCandidates (normalise → humanize →
 *                       gate → dedupe → rank)
 *   the model + params  ml/reword-models.ts, which lib/reword-models.ts
 *                       re-exports
 *
 * So this file is the model call and nothing else.
 *
 * THERE IS NO STYLE AXIS, and the CLI must not pretend there is: the system
 * prompt is engine data and asks for one thing, shorter and plainer. A caller
 * naming any other style is told so rather than quietly getting the same output
 * under a different name.
 *
 * SELF-HOSTED ONLY: `env.allowRemoteModels = false` and `env.localModelPath` is
 * the resolved models directory, so no text and no bytes leave the machine.
 */
import {
  addGreenBias, buildRewordMessages, rewordCandidates, scoreTokenWatermark, REWORD_WATERMARK,
} from '@lolly/engine';
import type { RewordCandidate, TextWatermarkScore } from '@lolly/engine';
import {
  REWORD_MODEL_BYTES, REWORD_MODEL_DIR, REWORD_MODEL_FILES, REWORD_SAMPLES, REWORD_STAGED,
  REWORD_TEMPERATURE, REWORD_TOP_P, rewordMaxNewTokens,
} from './reword-models.ts';
import { isTransformersAvailable, modelFilesExist, refuseMissing, resolveModelsDir, transformersSessionOptions } from './session.ts';

/** The one style the staged model is prompted for. */
export const REWORD_STYLES = ['plain'] as const;
export type RewordStyle = (typeof REWORD_STYLES)[number];

export interface NodeRewordAPI {
  isAvailable(): boolean;
  modelBytes(): number;
  cached(): Promise<boolean>;
  /** Raw model replies for one sentence, before the engine gate. */
  sample(sentence: string, count?: number): Promise<string[]>;
  /** Sample, then run the engine's gate: what a shell may actually offer. */
  reword(sentence: string, count?: number): Promise<RewordCandidate[]>;
  /** Score any text against the reword watermark. Tokenizer only, no model. */
  detectWatermark(text: string): Promise<TextWatermarkScore>;
}

interface TensorLike { dims: number[]; slice(...args: unknown[]): TensorLike }
interface LogitsLike { dims: number[]; data: Float32Array }
interface TokenizerLike {
  apply_chat_template(
    messages: Array<{ role: string; content: string }>,
    opts: { add_generation_prompt: boolean; return_dict: boolean },
  ): { input_ids: TensorLike; attention_mask: TensorLike };
  batch_decode(ids: TensorLike, opts: { skip_special_tokens: boolean }): string[];
  encode(text: string, opts?: { add_special_tokens?: boolean }): number[];
}
interface ModelLike { generate(opts: Record<string, unknown>): Promise<TensorLike> }
interface TfLike {
  env: {
    allowRemoteModels: boolean;
    allowLocalModels: boolean;
    localModelPath: string;
  };
  AutoModelForCausalLM: { from_pretrained(dir: string, opts: Record<string, unknown>): Promise<unknown> };
  AutoTokenizer: { from_pretrained(dir: string, opts?: Record<string, unknown>): Promise<unknown> };
  LogitsProcessor: unknown;
  LogitsProcessorList: unknown;
}

let tfP: Promise<TfLike> | null = null;
function tf(): Promise<TfLike> {
  tfP ??= import('@huggingface/transformers').then((mod) => {
    const m = mod as unknown as TfLike;
    // The privacy pins, the same ones the web worker sets.
    m.env.allowRemoteModels = false;
    m.env.allowLocalModels = true;
    m.env.localModelPath = `${resolveModelsDir()}/`;
    return m;
  });
  return tfP;
}

let tokenizerP: Promise<TokenizerLike> | null = null;
/** The tokenizer alone (a few MB): watermark detection never pays for the model. */
function ensureTokenizer(): Promise<TokenizerLike> {
  tokenizerP ??= tf()
    .then((m) => m.AutoTokenizer.from_pretrained(REWORD_MODEL_DIR))
    .then((t) => t as TokenizerLike)
    .catch((e) => { tokenizerP = null; throw e; });
  return tokenizerP;
}

/** The Kirchenbauer green-list watermark (engine text-watermark.ts,
 *  arXiv:2301.10226): +delta on every green logit each step, seeded by the
 *  previous token id, BEFORE the temperature/top-p sampler. Identical to the web
 *  worker's processor and to the native sampler, so /verify reads them the same. */
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

let runtimeP: Promise<{ model: ModelLike; tokenizer: TokenizerLike; wm: object }> | null = null;
function ensureRuntime(): Promise<{ model: ModelLike; tokenizer: TokenizerLike; wm: object }> {
  runtimeP ??= (async () => {
    const mod = await tf();
    const [model, tokenizer] = await Promise.all([
      // 'q4' resolves to the staged onnx/model_q4.onnx. No `device` here: the
      // Node build's default is the native CPU provider, which is what this
      // shell has (the web worker asks for wasm for its own reasons).
      mod.AutoModelForCausalLM.from_pretrained(REWORD_MODEL_DIR, { dtype: 'q4', ...transformersSessionOptions() }),
      ensureTokenizer(),
    ]);
    return { model: model as ModelLike, tokenizer, wm: watermarkProcessorList(mod) };
  })().catch((e) => { runtimeP = null; throw e; });
  return runtimeP;
}

function requireStaged(): void {
  if (!REWORD_STAGED || !modelFilesExist('reword', REWORD_MODEL_FILES.map((f) => `${REWORD_MODEL_DIR.replace(/^reword\//, '')}/${f}`))) {
    refuseMissing('reword', 'SmolLM2-360M-Instruct', REWORD_MODEL_BYTES);
  }
}

/**
 * The Node reword runner, or null when transformers.js cannot be resolved here.
 */
export function createNodeRewordAPI(): NodeRewordAPI | null {
  if (!isTransformersAvailable()) return null;
  return {
    isAvailable: () => REWORD_STAGED,
    modelBytes: () => REWORD_MODEL_BYTES,
    cached: async () => modelFilesExist(
      'reword', REWORD_MODEL_FILES.map((f) => `${REWORD_MODEL_DIR.replace(/^reword\//, '')}/${f}`),
    ),

    async sample(sentence: string, count = REWORD_SAMPLES): Promise<string[]> {
      requireStaged();
      const { model, tokenizer, wm } = await ensureRuntime();
      const inputs = tokenizer.apply_chat_template(buildRewordMessages(sentence), {
        add_generation_prompt: true, return_dict: true,
      });
      const inputLen = inputs.input_ids.dims[1] ?? 0;
      const maxNew = rewordMaxNewTokens(inputLen);
      const out: string[] = [];
      for (let k = 0; k < Math.max(1, Math.min(6, count)); k++) {
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
      }
      return out;
    },

    async reword(sentence: string, count = REWORD_SAMPLES): Promise<RewordCandidate[]> {
      return rewordCandidates(sentence, await this.sample(sentence, count));
    },

    async detectWatermark(text: string): Promise<TextWatermarkScore> {
      requireStaged();
      const tokenizer = await ensureTokenizer();
      return scoreTokenWatermark(tokenizer.encode(text.slice(0, 65536), { add_special_tokens: false }), REWORD_WATERMARK);
    },
  };
}
