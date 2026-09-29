// SPDX-License-Identifier: MPL-2.0
import { promptFor, parseRanking, resultFor, rulesRanking } from './ranking.ts';
import type { Candidate, ExperimentResult, Method, Progress, Ranker, Ranking, SlideBrief } from './types.ts';

interface Tensor {
  dims: number[];
  data: ArrayLike<number>;
  slice(...args: unknown[]): Tensor;
}
interface Tokenizer {
  apply_chat_template(messages: Array<{ role: string; content: string }>, opts: Record<string, unknown>): { input_ids: Tensor; attention_mask: Tensor };
  encode(text: string, opts: Record<string, unknown>): number[];
  batch_decode(tokens: Tensor, opts: Record<string, unknown>): string[];
}
interface Model { generate(opts: Record<string, unknown>): Promise<Tensor>; dispose(): Promise<void> }
interface Extractor {
  (text: string[], opts: Record<string, unknown>): Promise<Tensor>;
  dispose(): Promise<void>;
}
interface Tf {
  AutoModelForCausalLM: { from_pretrained(id: string, opts: Record<string, unknown>): Promise<Model> };
  AutoTokenizer: { from_pretrained(id: string): Promise<Tokenizer> };
  pipeline(task: string, id: string, opts: Record<string, unknown>): Promise<Extractor>;
  LogitsProcessor: new () => object;
  LogitsProcessorList: new () => { push(p: object): void };
}

export const SMOL_MODEL = 'reword/smollm2-360m-instruct';

export function createRanker(load: () => Promise<unknown>, backend: 'node-cpu' | 'browser-wasm', progress: Progress = () => {}): Ranker {
  let tf: Tf | undefined;
  let model: Model | undefined;
  let tokenizer: Tokenizer | undefined;
  let extractor: Extractor | undefined;
  const options = backend === 'browser-wasm' ? { device: 'wasm' } : { device: 'cpu', session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 } };
  const descriptions = new Map<string, number[]>();
  let busy = false;

  async function ensure(method: Method): Promise<number> {
    const t = performance.now();
    tf ??= await load() as Tf;
    if (method === 'embed' && !extractor) {
      progress('Loading the local MiniLM model');
      extractor = await tf.pipeline('feature-extraction', 'embed', { dtype: 'q8', ...options });
    } else if ((method === 'choice' || method === 'json') && !model) {
      progress('Loading the local SmolLM model');
      tokenizer ??= await tf.AutoTokenizer.from_pretrained(SMOL_MODEL);
      model = await tf.AutoModelForCausalLM.from_pretrained(SMOL_MODEL, { dtype: 'q4', ...options });
    }
    return performance.now() - t;
  }

  async function embed(brief: SlideBrief, candidates: Candidate[]): Promise<Ranking> {
    const missing = candidates.filter(c => !descriptions.has(c.description));
    const query = [brief.request, brief.title, ...brief.blocks.map(b => b.heading), brief.image?.description ?? ''].join('. ');
    const output = await extractor!([query, ...missing.map(c => c.description)], { pooling: 'mean', normalize: true, truncation: true });
    const dim = output.dims.at(-1)!;
    const rows = Array.from({ length: missing.length + 1 }, (_, i) => Array.from(output.data).slice(i * dim, (i + 1) * dim));
    for (const [i, c] of missing.entries()) descriptions.set(c.description, rows[i + 1]!);
    const sorted = candidates.map(c => ({ id: c.id, score: descriptions.get(c.description)!.reduce((sum, n, i) => sum + n * rows[0]![i]!, 0) })).sort((a, b) => b.score - a.score);
    return { ids: sorted.slice(0, 3).map(c => c.id), scores: sorted.slice(0, 3).map(c => c.score), valid: true, raw: '' };
  }

  async function generate(brief: SlideBrief, candidates: Candidate[], method: 'choice' | 'json'): Promise<Ranking & { inputTokens: number; outputTokens: number }> {
    const inputs = tokenizer!.apply_chat_template(promptFor(brief, candidates, method), { add_generation_prompt: true, return_dict: true });
    const inputTokens = inputs.input_ids.dims[1]!;
    if (inputTokens > 1800) throw new Error(`Prompt uses ${inputTokens} tokens; the experiment limit is 1800.`);
    const ranks: Array<{ id: string; score: number }> = [];
    let processor: object | undefined;
    if (method === 'choice') {
      const allowed = new Map<number, string>();
      for (const [i, c] of candidates.entries()) {
        const ids = tokenizer!.encode(String(i + 1), { add_special_tokens: false });
        if (ids.length !== 1) throw new Error('This tokenizer does not encode option numbers as single tokens.');
        allowed.set(ids[0]!, c.id);
      }
      const Base = tf!.LogitsProcessor;
      class ChoiceProcessor extends Base {
        _call(_input: unknown, logits: { data: Float32Array; dims: number[] }): typeof logits {
          const vocab = logits.dims.at(-1)!;
          if (!ranks.length) for (const [token, id] of allowed) ranks.push({ id, score: logits.data[token]! });
          for (let i = 0; i < logits.data.length; i++) if (!allowed.has(i % vocab)) logits.data[i] = -Infinity;
          return logits;
        }
      }
      const list = new tf!.LogitsProcessorList();
      list.push(new ChoiceProcessor());
      processor = list;
    }
    const output = await model!.generate({ ...inputs, do_sample: false, max_new_tokens: method === 'choice' ? 1 : 64, ...(processor ? { logits_processor: processor } : {}) });
    const raw = tokenizer!.batch_decode(output.slice(null, [inputTokens, null]), { skip_special_tokens: true })[0] ?? '';
    const outputTokens = (output.dims[1] ?? inputTokens) - inputTokens;
    if (method === 'json') return { ...parseRanking(raw.trim(), candidates), inputTokens, outputTokens };
    ranks.sort((a, b) => b.score - a.score);
    if (ranks.length !== candidates.length || ranks.some(r => !Number.isFinite(r.score))) throw new Error('The model did not produce a score for every candidate.');
    return { ids: ranks.slice(0, 3).map(r => r.id), scores: ranks.slice(0, 3).map(r => r.score), valid: true, raw, inputTokens, outputTokens };
  }

  return {
    async rank(brief, candidates, method): Promise<ExperimentResult> {
      if (busy) throw new Error('Only one inference job may run at a time.');
      busy = true;
      let loadMs = 0;
      let started = performance.now();
      let loading = true;
      try {
        if (method === 'rules' || !candidates.length) return resultFor(brief, candidates, method, rulesRanking(candidates), { backend: 'rules', loadMs: 0, inferenceMs: 0 });
        loadMs = await ensure(method);
        started = performance.now();
        loading = false;
        progress(`Ranking ${candidates.length} layouts`);
        const rank: Ranking & { inputTokens?: number; outputTokens?: number } = method === 'embed' ? await embed(brief, candidates) : await generate(brief, candidates, method);
        return resultFor(brief, candidates, method, rank, {
          backend, loadMs, inferenceMs: performance.now() - started,
          inputTokens: rank.inputTokens, outputTokens: rank.outputTokens,
        });
      } catch (error) {
        const elapsed = performance.now() - started;
        return resultFor(brief, candidates, method, { ids: [], valid: false, raw: '', error: error instanceof Error ? error.message : String(error) }, { backend, loadMs: loading ? elapsed : loadMs, inferenceMs: loading ? 0 : elapsed });
      } finally { busy = false; }
    },
    async dispose(): Promise<void> {
      await model?.dispose();
      await extractor?.dispose();
      model = undefined;
      extractor = undefined;
      descriptions.clear();
    },
  };
}
