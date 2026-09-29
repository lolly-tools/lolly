// SPDX-License-Identifier: MPL-2.0
import { createRanker } from './runtime.ts';
import type { Candidate, Method, SlideBrief } from './types.ts';

// The dev server bundles the installed Transformers.js browser entry beside this worker.
export function startWorker(module: unknown): void {
  const tf = module as { env: {
    allowRemoteModels: boolean; allowLocalModels: boolean; localModelPath: string; useBrowserCache: boolean;
    backends: { onnx: { wasm: { wasmPaths: string; numThreads: number } } };
  } };
  tf.env.allowRemoteModels = false;
  tf.env.allowLocalModels = true;
  tf.env.localModelPath = '/models/';
  tf.env.useBrowserCache = false;
  tf.env.backends.onnx.wasm.wasmPaths = '/ort/';
  tf.env.backends.onnx.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
  let active = 0;
  const runner = createRanker(async () => module, 'browser-wasm', message => postMessage({ id: active, progress: message }));
  globalThis.onmessage = async (event: MessageEvent<{ id: number; brief: SlideBrief; candidates: Candidate[]; method: Method }>): Promise<void> => {
    const { id, brief, candidates, method } = event.data;
    active = id;
    try { postMessage({ id, result: await runner.rank(brief, candidates, method) }); }
    catch (error) { postMessage({ id, error: String(error) }); }
  };
}
