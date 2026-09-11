// SPDX-License-Identifier: MPL-2.0
import { aiAllowed, assertAiAllowed, guardAiWorker } from '../lib/ai-policy.ts';
/**
 * Web implementation of `host.upscale` (v1.101) - on-device AI image upscaling.
 * THIN by design: this file is only worker plumbing (an id-keyed pending map,
 * progress fan-out, abort translation). The onnxruntime-web runtime, the ONNX
 * weights, the WebGPU→WASM backend choice and the memory-bounded tiling all live
 * in lib/upscale-worker.ts → lib/upscaler.ts so none of it can block the thread
 * a tool is being typed into, nor reach the boot budget.
 *
 * The SYNCHRONOUS, static answers (isAvailable/backend/models/modelBytes) are
 * served straight from lib/upscale-models.ts without spawning the worker - the
 * worker (and its multi-MB runtime) only wakes for the async methods
 * (cached/canRun/run). The worker echoes the resolved backend on every reply, so
 * backend() reports it the moment the first async call has probed.
 *
 * Abort mirrors bridge/speech.ts: on `signal`, reject NOW with an AbortError and
 * tell the worker, which stops at the next tile boundary; its late reply then
 * finds no pending entry and is dropped.
 */
import type {
  UpscaleAPI, UpscaleFeasibility, UpscaleFrame, UpscaleModelId, UpscaleModelInfo, UpscaleOpts, UpscaleProgress,
} from '@lolly-tools/core/host-v1';
import { stagedUpscaleModels, UPSCALE_MODEL_BYTES } from '../lib/upscale-models.ts';
import type { UpscaleWorkerReply, UpscaleWorkerRequest } from '../lib/upscale-worker.ts';

interface Pending {
  settle: (r: UpscaleWorkerReply) => void; // terminal replies (frame/feasibility/cached/error/aborted)
  onProgress?: (p: UpscaleProgress) => void;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
let resolvedBackend: 'webgpu' | 'wasm' | null = null;

function ensureWorker(): Worker {
  assertAiAllowed('upscale');
  if (worker) return worker;
  worker = guardAiWorker('upscale', () => new Worker(new URL('../lib/upscale-worker.ts', import.meta.url), { type: 'module' }));
  worker.onmessage = (e: MessageEvent<UpscaleWorkerReply>): void => {
    const reply = e.data;
    if (reply.backend) resolvedBackend = reply.backend; // latch (also the id:0 spawn probe)
    if (reply.id === 0) return; // unsolicited backend warm-up
    const p = pending.get(reply.id);
    if (!p) return; // late reply for an aborted/dropped request
    if (reply.progress) { p.onProgress?.(reply.progress); return; }
    pending.delete(reply.id);
    p.settle(reply);
  };
  worker.onerror = (): void => {
    for (const p of pending.values()) p.settle({ id: -1, error: 'upscale worker error' });
    pending.clear();
    // Terminate + drop the dead worker so the next call spawns a fresh one - 
    // detaching alone would leak the broken thread (and its slice of the model).
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
    worker = null;
  };
  return worker;
}

/** Strip the non-cloneable parts of opts before crossing to the worker. */
function serializeOpts(opts: UpscaleOpts = {}): Omit<UpscaleOpts, 'signal' | 'onProgress'> {
  const { signal: _signal, onProgress: _onProgress, ...rest } = opts;
  return rest;
}

function abortError(message = 'upscale aborted'): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException(message, 'AbortError')
    : Object.assign(new Error(message), { name: 'AbortError' });
}

export function createUpscaleAPI(): UpscaleAPI {
  return {
    isAvailable(): boolean {
      // A wasm backend to run the model + a Worker to run it off-thread. The
      // Worker check is also what answers false under jsdom (the CLI omits this).
      return aiAllowed('upscale') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function';
    },

    backend(): 'webgpu' | 'wasm' | null {
      return resolvedBackend;
    },

    models(): UpscaleModelInfo[] {
      // Only the STAGED models (real vendored weights) - a placeholder-pinned model
      // would promise a download that can't complete. Copies so a caller mutating
      // the list can't corrupt the source of truth.
      return stagedUpscaleModels().map((m) => ({ ...m }));
    },

    modelBytes(id: UpscaleModelId): number {
      return UPSCALE_MODEL_BYTES[id] ?? 0;
    },

    cached(id: UpscaleModelId): Promise<boolean> {
      const w = ensureWorker();
      const reqId = ++seq;
      return new Promise<boolean>((resolve, reject) => {
        pending.set(reqId, {
          settle: (r) => (r.error ? reject(new Error(r.error)) : resolve(!!r.cached)),
        });
        w.postMessage({ id: reqId, type: 'cached', model: id } satisfies UpscaleWorkerRequest);
      });
    },

    canRun(src: { width: number; height: number }, opts?: UpscaleOpts): Promise<UpscaleFeasibility> {
      const w = ensureWorker();
      const reqId = ++seq;
      return new Promise<UpscaleFeasibility>((resolve, reject) => {
        pending.set(reqId, {
          settle: (r) => {
            if (r.error) reject(new Error(r.error));
            else resolve(r.feasibility ?? { ok: true });
          },
        });
        w.postMessage({ id: reqId, type: 'canRun', src, opts: serializeOpts(opts) } satisfies UpscaleWorkerRequest);
      });
    },

    run(frame: UpscaleFrame, opts?: UpscaleOpts): Promise<UpscaleFrame> {
      const signal = opts?.signal;
      if (signal?.aborted) return Promise.reject(abortError());
      const w = ensureWorker();
      const reqId = ++seq;
      return new Promise<UpscaleFrame>((resolve, reject) => {
        const onAbort = (): void => {
          if (!pending.has(reqId)) return;
          pending.delete(reqId);
          w.postMessage({ id: reqId, type: 'abort' } satisfies UpscaleWorkerRequest);
          reject(abortError());
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        pending.set(reqId, {
          settle: (r) => {
            signal?.removeEventListener('abort', onAbort);
            if (r.aborted) reject(abortError());
            else if (r.error || !r.frame) reject(new Error(r.error ?? 'upscale failed'));
            else resolve(r.frame);
          },
          onProgress: opts?.onProgress,
        });
        // Transfer the source pixels - the caller's frame is consumed by the run.
        w.postMessage(
          { id: reqId, type: 'run', frame, opts: serializeOpts(opts) } satisfies UpscaleWorkerRequest,
          [frame.data.buffer],
        );
      });
    },
  };
}
