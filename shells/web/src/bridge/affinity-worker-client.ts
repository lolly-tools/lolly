// SPDX-License-Identifier: MPL-2.0
import { AffinityError, AFFINITY_MAX_INPUT } from '@lolly-tools/node-shell/affinity';
import type { AffinityRead, AffinityWorkerReply, AffinityWorkerRequest } from './affinity-protocol.ts';

export interface AffinityWorker {
  onmessage: ((event: MessageEvent) => unknown) | null;
  onerror: ((event: ErrorEvent) => unknown) | null;
  postMessage(message: AffinityWorkerRequest, transfer: Transferable[]): void;
  terminate(): void;
}
interface ClientOptions { createWorker(): AffinityWorker; budgetMs?: number }

/**
 * Reads on a dedicated worker, one job at a time. The worker is created on demand and thrown
 * away after any failure, abort or crash, so the next call starts fresh. The input buffer is
 * transferred, which detaches it for the caller; a view onto part of a larger buffer is copied first.
 */
export function createAffinityWorkerClient(options: ClientOptions) {
  let worker: AffinityWorker | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  let sequence = 0;
  let cancelActive: (() => void) | undefined;

  function dispose(): void { worker?.terminate(); worker = null; }

  function once(bytes: Uint8Array, name: string, signal?: AbortSignal): Promise<AffinityRead> {
    signal?.throwIfAborted();
    if (!bytes.length) return Promise.reject(new AffinityError('failed', 'This Affinity file is empty.'));
    if (bytes.length > AFFINITY_MAX_INPUT) return Promise.reject(new AffinityError('limit', 'Choose an Affinity file smaller than 96 MB for on-device reading.'));
    worker ??= options.createWorker();
    const current = worker;
    const id = ++sequence;
    const owned = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (failure: unknown, result?: AffinityRead): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        cancelActive = undefined;
        current.onmessage = null; current.onerror = null;
        if (failure) { dispose(); reject(failure); } else resolve(result!);
      };
      const abort = () => finish(signal?.reason ?? new DOMException('The Affinity read was cancelled.', 'AbortError'));
      const timer = setTimeout(() => finish(new AffinityError('crashed', 'The Affinity reader ran past its time limit.')), options.budgetMs ?? 120_000);
      cancelActive = abort;
      signal?.addEventListener('abort', abort, { once: true });
      current.onerror = event => {
        event.preventDefault?.();
        finish(new AffinityError('crashed', event.message || 'The Affinity reader could not start.'));
      };
      current.onmessage = event => {
        const data = event.data as AffinityWorkerReply;
        if (data.id !== id) return;
        if (data.ok) finish(null, { inspection: data.inspection, model: data.model, payload: data.payload, modelError: data.modelError });
        else finish(new AffinityError(data.code, data.error));
      };
      try { current.postMessage({ id, bytes: owned, name }, [owned.buffer as ArrayBuffer]); }
      catch (error) { finish(error); }
    });
  }

  function read(bytes: Uint8Array, name: string, signal?: AbortSignal): Promise<AffinityRead> {
    const run = tail.then(() => once(bytes, name, signal));
    tail = run.catch(() => undefined);
    return run;
  }
  /** Stop the running job, if any, and release the worker. */
  function cancel(): void { cancelActive?.(); dispose(); }
  return { read, cancel, dispose };
}
