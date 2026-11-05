// SPDX-License-Identifier: MPL-2.0
import { CameraRawError, CAMERA_RAW_MAX_INPUT, type CameraRawQuality } from '@lolly-tools/node-shell/camera-raw';
import type { CameraRawJob, CameraRawResult, CameraRawWorkerReply, CameraRawWorkerRequest } from './camera-raw-protocol.ts';

export interface CameraRawWorker {
  onmessage: ((event: MessageEvent) => unknown) | null;
  onerror: ((event: ErrorEvent) => unknown) | null;
  postMessage(message: CameraRawWorkerRequest, transfer: Transferable[]): void;
  terminate(): void;
}
interface ClientOptions { createWorker(): CameraRawWorker; budgetMs?: number }

/**
 * Develops on a dedicated worker, one job at a time. The worker is created on demand and thrown away
 * after any failure, abort or crash, so the next call starts fresh. The input buffer is transferred,
 * which detaches it for the caller; a view onto part of a larger buffer is copied first.
 */
export function createCameraRawWorkerClient(options: ClientOptions) {
  let worker: CameraRawWorker | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  let sequence = 0;
  let cancelActive: (() => void) | undefined;

  function dispose(): void { worker?.terminate(); worker = null; }

  function once(bytes: Uint8Array, job: CameraRawJob, quality: CameraRawQuality, signal?: AbortSignal): Promise<CameraRawResult> {
    signal?.throwIfAborted();
    if (!bytes.length) return Promise.reject(new CameraRawError('failed', 'This raw file is empty.'));
    if (bytes.length > CAMERA_RAW_MAX_INPUT) return Promise.reject(new CameraRawError('limit', `Choose a raw file smaller than ${CAMERA_RAW_MAX_INPUT / 1024 / 1024} MB for on-device development.`));
    worker ??= options.createWorker();
    const current = worker;
    const id = ++sequence;
    const owned = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (failure: unknown, result?: CameraRawResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        cancelActive = undefined;
        current.onmessage = null; current.onerror = null;
        if (failure) { dispose(); reject(failure); } else resolve(result!);
      };
      const abort = () => finish(signal?.reason ?? new DOMException('The raw development was cancelled.', 'AbortError'));
      const timer = setTimeout(() => finish(new CameraRawError('crashed', 'The camera raw decoder ran past its time limit.')), options.budgetMs ?? 180_000);
      cancelActive = abort;
      signal?.addEventListener('abort', abort, { once: true });
      current.onerror = event => {
        event.preventDefault?.();
        finish(new CameraRawError('crashed', event.message || 'The camera raw decoder could not start.'));
      };
      current.onmessage = event => {
        const data = event.data as CameraRawWorkerReply;
        if (data.id !== id) return;
        if (!data.ok) { finish(new CameraRawError(data.code, data.error)); return; }
        const result: CameraRawResult = { width: data.width, height: data.height, meta: data.meta };
        if (data.pixels) {
          if (data.meta.encoding === 'linear-prophoto-16') result.linear16 = new Uint16Array(data.pixels);
          else result.rgba8 = new Uint8ClampedArray(data.pixels);
        }
        finish(null, result);
      };
      try { current.postMessage({ id, bytes: owned, job, quality }, [owned.buffer as ArrayBuffer]); }
      catch (error) { finish(error); }
    });
  }

  function run(bytes: Uint8Array, job: CameraRawJob, quality: CameraRawQuality = 'best', signal?: AbortSignal): Promise<CameraRawResult> {
    const next = tail.then(() => once(bytes, job, quality, signal));
    tail = next.catch(() => undefined);
    return next;
  }
  /** Stop the running job, if any, and release the worker. */
  function cancel(): void { cancelActive?.(); dispose(); }
  return { run, cancel, dispose };
}
