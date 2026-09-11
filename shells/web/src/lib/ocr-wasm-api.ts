// SPDX-License-Identifier: MPL-2.0
import { aiAllowed, assertAiAllowed, guardAiWorker } from './ai-policy.ts';
/**
 * The WASM implementation of `host.ocr` (plans/125) - worker plumbing only: an
 * id-keyed pending map, progress fan-out, abort translation. The onnxruntime-web
 * runtime, the weights and the detect→recognise maths live in lib/ocr-worker.ts →
 * lib/ocr.ts, off the boot budget and off the thread a tool is being used on.
 *
 * The synchronous static answers (isAvailable/backend/models/modelBytes) are served
 * straight from lib/ocr-models.ts without spawning the worker; the worker (and its
 * multi-MB runtime) only wakes for cached/canRun/run. bridge/ocr.ts is a one-line
 * re-export so the web host path is byte-identical to matte/upscale.
 */
import type {
  OcrAPI, OcrFeasibility, OcrFrame, OcrModelId, OcrModelInfo, OcrOpts, OcrProgress, OcrResult,
} from '@lolly-tools/core/host-v1';
import { ocrModelsFor, OCR_MODEL_BYTES } from './ocr-models.ts';
import type { OcrWorkerReply, OcrWorkerRequest } from './ocr-worker.ts';

interface Pending {
  settle: (r: OcrWorkerReply) => void;
  onProgress?: (p: OcrProgress) => void;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
let resolvedBackend: 'wasm' | null = null;

function ensureWorker(): Worker {
  assertAiAllowed('ocr');
  if (worker) return worker;
  worker = guardAiWorker('ocr', () => new Worker(new URL('./ocr-worker.ts', import.meta.url), { type: 'module' }));
  worker.onmessage = (e: MessageEvent<OcrWorkerReply>): void => {
    const reply = e.data;
    if (reply.backend) resolvedBackend = reply.backend;
    if (reply.id === 0) return; // unsolicited backend warm-up
    const p = pending.get(reply.id);
    if (!p) return; // late reply for an aborted/dropped request
    if (reply.progress) { p.onProgress?.(reply.progress); return; }
    pending.delete(reply.id);
    p.settle(reply);
  };
  worker.onerror = (): void => {
    for (const p of pending.values()) p.settle({ id: -1, error: 'ocr worker error' });
    pending.clear();
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
    worker = null;
  };
  return worker;
}

function serializeOpts(opts: OcrOpts = {}): Omit<OcrOpts, 'signal' | 'onProgress'> {
  const { signal: _signal, onProgress: _onProgress, ...rest } = opts;
  return rest;
}

function abortError(message = 'The text read was aborted.'): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException(message, 'AbortError')
    : Object.assign(new Error(message), { name: 'AbortError' });
}

export function createWasmOcrAPI(): OcrAPI {
  return {
    isAvailable(): boolean {
      return aiAllowed('ocr') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function';
    },

    backend(): 'wasm' | null {
      return resolvedBackend;
    },

    models(): OcrModelInfo[] {
      return ocrModelsFor(false).map((m) => ({ ...m }));
    },

    modelBytes(id: OcrModelId): number {
      return OCR_MODEL_BYTES[id] ?? 0;
    },

    cached(id: OcrModelId): Promise<boolean> {
      const w = ensureWorker();
      const reqId = ++seq;
      return new Promise<boolean>((resolve, reject) => {
        pending.set(reqId, {
          settle: (r) => (r.error ? reject(new Error(r.error)) : resolve(!!r.cached)),
        });
        w.postMessage({ id: reqId, type: 'cached', model: id } satisfies OcrWorkerRequest);
      });
    },

    canRun(src: { width: number; height: number }, opts?: OcrOpts): Promise<OcrFeasibility> {
      const w = ensureWorker();
      const reqId = ++seq;
      return new Promise<OcrFeasibility>((resolve, reject) => {
        pending.set(reqId, {
          settle: (r) => {
            if (r.error) reject(new Error(r.error));
            else resolve(r.feasibility ?? { ok: true });
          },
        });
        w.postMessage({ id: reqId, type: 'canRun', src, opts: serializeOpts(opts) } satisfies OcrWorkerRequest);
      });
    },

    run(frame: OcrFrame, opts?: OcrOpts): Promise<OcrResult> {
      const signal = opts?.signal;
      if (signal?.aborted) return Promise.reject(abortError());
      const w = ensureWorker();
      const reqId = ++seq;
      return new Promise<OcrResult>((resolve, reject) => {
        const onAbort = (): void => {
          if (!pending.has(reqId)) return;
          pending.delete(reqId);
          w.postMessage({ id: reqId, type: 'abort' } satisfies OcrWorkerRequest);
          reject(abortError());
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        pending.set(reqId, {
          settle: (r) => {
            signal?.removeEventListener('abort', onAbort);
            if (r.aborted) reject(abortError());
            else if (r.error || !r.result) reject(new Error(r.error ?? 'The text could not be read.'));
            else resolve(r.result);
          },
          onProgress: opts?.onProgress,
        });
        // Transfer the source pixels - the caller's frame is consumed by the run.
        w.postMessage(
          { id: reqId, type: 'run', frame, opts: serializeOpts(opts) } satisfies OcrWorkerRequest,
          [frame.data.buffer],
        );
      });
    },
  };
}
