// SPDX-License-Identifier: MPL-2.0
import { aiAllowed, assertAiAllowed, guardAiWorker } from '../ai-policy.ts';
/**
 * Ask embed client (plans/103 M1) - the main-thread face of the embed worker.
 * Mirrors bridge/speech.ts's protocol: id-keyed pending map, progress fan-out,
 * terminate-then-drop on worker error so a broken thread never leaks its model
 * session. The worker owns every heavy import; this module is boot-chunk safe.
 *
 * Consent contract (the speech `cached()` pattern): `cachedEmbedModel()` probes
 * the transformers Cache API bucket WITHOUT fetching, so callers can gate the
 * "~23 MB on-device download" chip - nothing here ever triggers the download
 * implicitly. The first embedQuery() after consent warms the cache through
 * transformers.js itself (or finds the offline part's pre-download).
 */

import { MODELS_BASE } from '../models-base.ts';

/** The staged model's directory name under /models/ - transformers.js resolves
 *  this id against env.localModelPath, so it doubles as the model id. */
export const EMBED_MODEL_ID = 'embed';

/** Consent-chip size: the q8 ONNX + tokenizer set scripts/fetch-embed-model.ts
 *  stages (config 650 + tokenizer_config 366 + tokenizer.json 711,661 + the
 *  22,972,370-byte model). Keep in sync with the staged bytes - the pinned
 *  sizes live in that script's PINS table. */
export const EMBED_MODEL_BYTES = 23_685_047;

/** The cache key transformers.js stores the model under (utils/hub.js: the
 *  resolved local path, relative to origin). Probed by cachedEmbedModel(),
 *  never fetched. */
const MODEL_CACHE_URL = `${MODELS_BASE}/models/${EMBED_MODEL_ID}/onnx/model_quantized.onnx`;

export interface EmbedProgress { phase: 'download'; fraction: number; loaded?: number; total?: number }

interface Pending {
  resolve: (v: Float32Array) => void;
  reject: (e: unknown) => void;
  onProgress?: (p: EmbedProgress) => void;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function ensureWorker(): Worker {
  assertAiAllowed('embedding');
  if (worker) return worker;
  worker = guardAiWorker('embedding', () => new Worker(new URL('./embed-worker.ts', import.meta.url), { type: 'module' }));
  worker.onmessage = (e: MessageEvent<{ id: number; progress?: EmbedProgress; result?: Float32Array; error?: string }>): void => {
    const { id, progress, result, error } = e.data;
    const p = pending.get(id);
    if (!p) return; // late reply for an aborted request - already rejected
    if (progress) { p.onProgress?.(progress); return; }
    pending.delete(id);
    if (error || !result) p.reject(new Error(error ?? 'embedding failed'));
    else p.resolve(result);
  };
  worker.onerror = (): void => {
    for (const p of pending.values()) p.reject(new Error('embed worker error'));
    pending.clear();
    // Terminate, then drop, the dead worker so the next embedQuery() spawns a
    // fresh one - detaching alone would leak the broken thread and its session.
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
    worker = null;
  };
  return worker;
}

/** True when the embed model is already on-device (Cache API probe, no fetch).
 *  False under jsdom / sealed caches - callers then stay lexical-only. */
export async function cachedEmbedModel(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const c = await caches.open('transformers-cache');
    return (await c.match(MODEL_CACHE_URL)) !== undefined;
  } catch {
    return false; // Cache API visible but sealed (incognito iframe) - treat as cold
  }
}

/** Worker support probe - false under jsdom, where retrieval stays lexical. */
export function embedAvailable(): boolean {
  return aiAllowed('embedding') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function';
}

/** Embed ONE query string to a 384-dim L2-normalised vector. The first call
 *  after consent may stream the model download through onProgress. */
export function embedQuery(text: string, opts: { onProgress?: (p: EmbedProgress) => void } = {}): Promise<Float32Array> {
  assertAiAllowed('embedding');
  const id = ++seq;
  return new Promise<Float32Array>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress: opts.onProgress });
    ensureWorker().postMessage({ id, text });
  });
}

/** Tear the worker down (tests, and the Ask view's unmount is free to call it -
 *  the next query just respawns). */
export function disposeEmbedWorker(): void {
  if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
  worker = null;
  for (const p of pending.values()) p.reject(new Error('embed worker disposed'));
  pending.clear();
}
