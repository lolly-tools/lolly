// SPDX-License-Identifier: MPL-2.0
import { aiAllowed, assertAiAllowed, guardAiWorker } from './ai-policy.ts';
import { abortError as makeAbortError } from './util/abort.ts';
/**
 * The WASM implementation of `host.matte` (v1.103) - worker plumbing only: an
 * id-keyed pending map, progress fan-out, abort translation. The onnxruntime-web
 * runtime, the ONNX weights, the WebGPU→WASM choice and the letterbox/compose
 * maths all live in lib/matte-worker.ts → lib/matter.ts, off the boot budget and
 * off the thread a tool is being used on.
 *
 * This is the PORTABLE half: it lives under lib/ (not bridge/) so a native shell
 * override (shells/tauri-desktop/bridge-overrides/matte.ts) can reuse it verbatim
 * for the wasm-runnable models and only intercept any native-only heavyweight.
 * bridge/matte.ts is a one-line re-export of createWasmMatteAPI so the web host
 * path (bridge/index.ts → import('./matte.ts')) is byte-identical.
 *
 * The synchronous static answers (isAvailable/backend/models/modelBytes) are
 * served straight from lib/matte-models.ts without spawning the worker; the
 * worker (and its multi-MB runtime) only wakes for cached/canRun/run.
 *
 * Abort mirrors bridge/upscale.ts: on `signal`, reject NOW with an AbortError and
 * tell the worker; its late reply then finds no pending entry and is dropped.
 */
import type {
  MatteAPI, MatteFeasibility, MatteFrame, MatteModelId, MatteModelInfo, MatteOpts, MatteProgress,
} from '@lolly-tools/core/host-v1';
import { matteModelsFor, MATTE_MODEL_BYTES } from './matte-models.ts';
import type { MatteWorkerReply, MatteWorkerRequest } from './matte-worker.ts';

interface Pending {
  settle: (r: MatteWorkerReply) => void;
  onProgress?: (p: MatteProgress) => void;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
let resolvedBackend: 'webgpu' | 'wasm' | null = null;

function ensureWorker(): Worker {
  assertAiAllowed('matte');
  if (worker) return worker;
  worker = guardAiWorker('matte', () => new Worker(new URL('./matte-worker.ts', import.meta.url), { type: 'module' }));
  worker.onmessage = (e: MessageEvent<MatteWorkerReply>): void => {
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
    for (const p of pending.values()) p.settle({ id: -1, error: 'matte worker error' });
    pending.clear();
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
    worker = null;
  };
  return worker;
}

function serializeOpts(opts: MatteOpts = {}): Omit<MatteOpts, 'signal' | 'onProgress'> {
  const { signal: _signal, onProgress: _onProgress, ...rest } = opts;
  return rest;
}

/** This path's AbortError - the shared constructor with the matte message. */
const abortError = (message = 'matte aborted'): Error => makeAbortError(message);

export function createWasmMatteAPI(): MatteAPI {
  return {
    isAvailable(): boolean {
      return aiAllowed('matte') && typeof WebAssembly !== 'undefined' && typeof Worker === 'function';
    },

    backend(): 'webgpu' | 'wasm' | null {
      return resolvedBackend;
    },

    models(): MatteModelInfo[] {
      // The wasm-runnable staged set: a model that would OOM the wasm32 heap is
      // withheld here (no model on today's roster does - see MATTE_NATIVE_ONLY) and a
      // native shell override provides its own models() with the full set. Copies so
      // a caller can't corrupt the source of truth.
      return matteModelsFor(false).map((m) => ({ ...m }));
    },

    modelBytes(id: MatteModelId): number {
      // A retired id has no size; 0 is the honest answer for the consent UI, and
      // `run` will resolve the same id to the default anyway (resolveMatteModel).
      return MATTE_MODEL_BYTES[id] ?? 0;
    },

    cached(id: MatteModelId): Promise<boolean> {
      const w = ensureWorker();
      const reqId = ++seq;
      return new Promise<boolean>((resolve, reject) => {
        pending.set(reqId, {
          settle: (r) => (r.error ? reject(new Error(r.error)) : resolve(!!r.cached)),
        });
        w.postMessage({ id: reqId, type: 'cached', model: id } satisfies MatteWorkerRequest);
      });
    },

    canRun(src: { width: number; height: number }, opts?: MatteOpts): Promise<MatteFeasibility> {
      const w = ensureWorker();
      const reqId = ++seq;
      return new Promise<MatteFeasibility>((resolve, reject) => {
        pending.set(reqId, {
          settle: (r) => {
            if (r.error) reject(new Error(r.error));
            else resolve(r.feasibility ?? { ok: true });
          },
        });
        w.postMessage({ id: reqId, type: 'canRun', src, opts: serializeOpts(opts) } satisfies MatteWorkerRequest);
      });
    },

    run(frame: MatteFrame, opts?: MatteOpts): Promise<MatteFrame> {
      const signal = opts?.signal;
      if (signal?.aborted) return Promise.reject(abortError());
      const w = ensureWorker();
      const reqId = ++seq;
      return new Promise<MatteFrame>((resolve, reject) => {
        const onAbort = (): void => {
          if (!pending.has(reqId)) return;
          pending.delete(reqId);
          w.postMessage({ id: reqId, type: 'abort' } satisfies MatteWorkerRequest);
          reject(abortError());
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        pending.set(reqId, {
          settle: (r) => {
            signal?.removeEventListener('abort', onAbort);
            if (r.aborted) reject(abortError());
            else if (r.error || !r.frame) reject(new Error(r.error ?? 'matte failed'));
            else resolve(r.frame);
          },
          onProgress: opts?.onProgress,
        });
        // Transfer the source pixels - the caller's frame is consumed by the run.
        w.postMessage(
          { id: reqId, type: 'run', frame, opts: serializeOpts(opts) } satisfies MatteWorkerRequest,
          [frame.data.buffer],
        );
      });
    },
  };
}
