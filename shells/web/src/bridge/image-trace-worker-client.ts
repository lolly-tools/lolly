// SPDX-License-Identifier: MPL-2.0
import {
  ImageTraceError, readImageTraceWire, type ImageTracePreset, type ImageTraceResult,
} from '../../../../engine/src/image-trace.ts';
import type { ImageTraceWorkerReply, ImageTraceWorkerRequest } from './image-trace-protocol.ts';

export interface ImageTraceWorker {
  onmessage: ((event: MessageEvent) => unknown) | null;
  onerror: ((event: ErrorEvent) => unknown) | null;
  postMessage(message: ImageTraceWorkerRequest, transfer: Transferable[]): void;
  terminate(): void;
}
interface ClientOptions { createWorker(): ImageTraceWorker; budgetMs?: number }
export type ImageTraceStage = 'loading' | 'tracing';

/**
 * Traces on a dedicated worker, one job at a time. The module cannot be interrupted part way,
 * so cancelling terminates the worker and the next call starts a fresh one. The pixel buffer is
 * transferred, which detaches it for the caller.
 */
export function createImageTraceWorkerClient(options: ClientOptions) {
  let worker: ImageTraceWorker | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  let sequence = 0;
  let cancelActive: (() => void) | undefined;

  function dispose(): void { worker?.terminate(); worker = null; }

  function once(rgba: Uint8Array, width: number, height: number, preset: ImageTracePreset, signal?: AbortSignal, onStage?: (stage: ImageTraceStage) => void): Promise<ImageTraceResult> {
    signal?.throwIfAborted();
    worker ??= options.createWorker();
    const current = worker;
    const id = ++sequence;
    const owned = rgba.byteOffset === 0 && rgba.byteLength === rgba.buffer.byteLength ? rgba : rgba.slice();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (failure: unknown, result?: ImageTraceResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        cancelActive = undefined;
        current.onmessage = null; current.onerror = null;
        if (failure) { dispose(); reject(failure); } else resolve(result!);
      };
      const abort = () => finish(signal?.reason ?? new ImageTraceError('cancelled', 'The trace was cancelled.'));
      const timer = setTimeout(() => finish(new ImageTraceError('failed', 'The trace ran past its time limit.')), options.budgetMs ?? 180_000);
      cancelActive = abort;
      signal?.addEventListener('abort', abort, { once: true });
      current.onerror = event => {
        event.preventDefault?.();
        finish(new ImageTraceError('failed', event.message || 'The image tracer could not start.'));
      };
      current.onmessage = event => {
        const data = event.data as ImageTraceWorkerReply;
        if (data.id !== id) return;
        if ('stage' in data) { onStage?.(data.stage); return; }
        if (!data.ok) { finish(new ImageTraceError(data.code, data.error)); return; }
        try { finish(null, readImageTraceWire(JSON.parse(new TextDecoder().decode(data.json)))); }
        catch (error) { finish(error instanceof ImageTraceError ? error : new ImageTraceError('invalid', 'The tracer returned a result that could not be read.')); }
      };
      onStage?.('loading');
      try { current.postMessage({ id, rgba: owned, width, height, preset }, [owned.buffer as ArrayBuffer]); }
      catch (error) { finish(error); }
    });
  }

  function trace(rgba: Uint8Array, width: number, height: number, preset: ImageTracePreset, signal?: AbortSignal, onStage?: (stage: ImageTraceStage) => void): Promise<ImageTraceResult> {
    const run = tail.then(() => once(rgba, width, height, preset, signal, onStage));
    tail = run.catch(() => undefined);
    return run;
  }
  /** Stop the running job, if any, and release the worker. */
  function cancel(): void { cancelActive?.(); dispose(); }
  return { trace, cancel, dispose };
}
