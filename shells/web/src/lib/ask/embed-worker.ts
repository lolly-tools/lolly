// SPDX-License-Identifier: MPL-2.0
/**
 * Ask embed worker (plans/103 M1) - runs the all-MiniLM-L6-v2 q8 embedder
 * off-thread to turn ONE query string into a 384-dim L2-normalised vector.
 * Everything heavy (transformers.js, the ~23 MB model) loads HERE, dynamically,
 * so none of it can reach the boot chunk. Same id-keyed pending-map protocol as
 * the speech and reword workers.
 *
 * SELF-HOSTED ONLY: the model is served same-origin from /models/embed/
 * (staged by scripts/fetch-embed-model.ts) on the onnxruntime-web build
 * transformers.js pins (/ort-hf/). Remote models are disabled outright, so no
 * query text or bytes ever leave the device - the speech workers' exact
 * privacy lines.
 *
 * Device: plain wasm, always - a 384-dim single-sentence embed is milliseconds
 * there, so the WebGPU ladder would buy nothing (plans/103 section 2).
 */

import { EMBED_MODEL_ID, EMBED_MODEL_BYTES } from './embed.ts';
import { ORT_HF_BASE } from '../ort-hf-base.ts';
import { MODELS_BASE } from '../models-base.ts';

export interface EmbedWorkerRequest {
  id: number;
  text: string;
}

export interface EmbedWorkerProgress {
  phase: 'download';
  fraction: number;
  loaded?: number;
  total?: number;
}

export interface EmbedWorkerReply {
  id: number;
  progress?: EmbedWorkerProgress;
  /** The L2-normalised embedding, transferred. */
  result?: Float32Array;
  error?: string;
}

// Worker scope: `postMessage` here is the DedicatedWorkerGlobalScope overload.
const post = postMessage as (message: unknown, transfer?: Transferable[]) => void;

type ExtractorFn = (text: string, opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: Float32Array | number[] }>;

let runtime: Promise<ExtractorFn> | null = null;

/** Load transformers.js + the model + tokenizer, once. Download progress is
 *  attributed to the request that triggered the load; later requests find
 *  everything resident and skip straight to the embed. */
function ensureRuntime(id: number): Promise<ExtractorFn> {
  if (runtime) return runtime;
  runtime = (async (): Promise<ExtractorFn> => {
    const { env, pipeline } = await import('@huggingface/transformers');

    // Same-origin everything - the whole privacy story rides on these lines
    // (the speech workers' exact block).
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    // MODELS_BASE is '' on the web build (→ same-origin '/models/', unchanged); the
    // desktop shell bakes https://lolly.tools so the embed model pulls from there.
    env.localModelPath = `${MODELS_BASE}/models/`;
    if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = ORT_HF_BASE;

    const loadedByFile = new Map<string, number>();
    const progressCallback = (p: { status?: string; file?: string; loaded?: number }): void => {
      if (p.status !== 'progress' || !p.file || typeof p.loaded !== 'number') return;
      loadedByFile.set(p.file, p.loaded);
      let loaded = 0;
      for (const v of loadedByFile.values()) loaded += v;
      post({ id, progress: { phase: 'download', loaded, total: EMBED_MODEL_BYTES, fraction: Math.min(1, loaded / EMBED_MODEL_BYTES) } } satisfies EmbedWorkerReply);
    };

    const extractor = await pipeline('feature-extraction', EMBED_MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: progressCallback,
    });
    return extractor as unknown as ExtractorFn;
  })();
  runtime.catch(() => { runtime = null; }); // a failed load must not poison later tries
  return runtime;
}

onmessage = async (e: MessageEvent<EmbedWorkerRequest>): Promise<void> => {
  const { id, text } = e.data;
  try {
    const extractor = await ensureRuntime(id);
    const out = await extractor(text, { pooling: 'mean', normalize: true });
    const vec = out.data instanceof Float32Array ? out.data : Float32Array.from(out.data);
    post({ id, result: vec } satisfies EmbedWorkerReply, [vec.buffer]);
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : String(err) } satisfies EmbedWorkerReply);
  }
};
