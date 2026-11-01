// SPDX-License-Identifier: MPL-2.0
import { InddError, INDD_MAX_INPUT, type InddConversion } from '@lolly-tools/node-shell/indd';
import type { InddWorkerReply, InddWorkerRequest } from './indd-protocol.ts';

export interface InddWorker {
  onmessage: ((event: MessageEvent) => unknown) | null;
  onerror: ((event: ErrorEvent) => unknown) | null;
  postMessage(message: InddWorkerRequest, transfer: Transferable[]): void;
  terminate(): void;
}
interface ClientOptions { createWorker(): InddWorker; budgetMs?: number }

/**
 * Converts on a dedicated worker, one job at a time. The worker is created on demand and thrown
 * away after any failure, abort or crash, so the next call starts fresh. The input buffer is
 * transferred, which detaches it for the caller; a view onto part of a larger buffer is copied first.
 */
export function createInddWorkerClient(options: ClientOptions) {
  let worker: InddWorker | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  let sequence = 0;
  let cancelActive: (() => void) | undefined;

  function dispose(): void { worker?.terminate(); worker = null; }

  function once(bytes: Uint8Array, name: string, signal?: AbortSignal): Promise<InddConversion> {
    signal?.throwIfAborted();
    if (!bytes.length) return Promise.reject(new InddError('failed', 'This InDesign file is empty.'));
    if (bytes.length > INDD_MAX_INPUT) return Promise.reject(new InddError('limit', 'Choose an InDesign file smaller than 128 MB for on-device conversion.'));
    worker ??= options.createWorker();
    const current = worker;
    const id = ++sequence;
    const owned = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (failure: unknown, result?: InddConversion): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        cancelActive = undefined;
        current.onmessage = null; current.onerror = null;
        if (failure) { dispose(); reject(failure); } else resolve(result!);
      };
      const abort = () => finish(signal?.reason ?? new DOMException('The InDesign conversion was cancelled.', 'AbortError'));
      const timer = setTimeout(() => finish(new InddError('crashed', 'The InDesign converter ran past its time limit.')), options.budgetMs ?? 120_000);
      cancelActive = abort;
      signal?.addEventListener('abort', abort, { once: true });
      current.onerror = event => {
        event.preventDefault?.();
        finish(new InddError('crashed', event.message || 'The InDesign converter could not start.'));
      };
      current.onmessage = event => {
        const data = event.data as InddWorkerReply;
        if (data.id !== id) return;
        if (data.ok) finish(null, { idml: data.idml, warnings: data.warnings });
        else finish(new InddError(data.code, data.error));
      };
      try { current.postMessage({ id, bytes: owned, name }, [owned.buffer as ArrayBuffer]); }
      catch (error) { finish(error); }
    });
  }

  function convert(bytes: Uint8Array, name: string, signal?: AbortSignal): Promise<InddConversion> {
    const run = tail.then(() => once(bytes, name, signal));
    tail = run.catch(() => undefined);
    return run;
  }
  /** Stop the running job, if any, and release the worker. */
  function cancel(): void { cancelActive?.(); dispose(); }
  return { convert, cancel, dispose };
}
