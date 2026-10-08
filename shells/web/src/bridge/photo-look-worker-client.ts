// SPDX-License-Identifier: MPL-2.0
import { WebGpuError } from '../lib/webgpu/device.ts';
import type { PhotoLookBakeRequest } from './photo-look-raster.ts';
import type { PhotoLookWorkerReply, PhotoLookWorkerRequest } from './photo-look-protocol.ts';

export interface PhotoLookWorker {
  onmessage: ((event: MessageEvent<PhotoLookWorkerReply>) => unknown) | null;
  onerror: ((event: ErrorEvent) => unknown) | null;
  postMessage(message: PhotoLookWorkerRequest): void;
  terminate(): void;
}

interface WorkerClientOptions {
  createWorker(): PhotoLookWorker;
  onError(): void;
  idleMs?: number;
  budgetMs?: number;
  cancelMs?: number;
}

/** One active bake; cancellation waits for cleanup or terminates the worker before reuse. */
export function createPhotoLookWorkerClient(options: WorkerClientOptions) {
  let worker: PhotoLookWorker | null = null;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let active = false;
  let sequence = 0;

  function dispose(): void {
    clearTimeout(idle);
    worker?.terminate();
    worker = null;
  }

  function run(request: PhotoLookBakeRequest, signal?: AbortSignal): Promise<Blob> {
    signal?.throwIfAborted();
    if (active) return Promise.reject(new WebGpuError('WEBGPU_BUSY', 'The photo worker is already processing an image.'));
    clearTimeout(idle);
    if (!worker) worker = options.createWorker();
    const current = worker;
    const id = ++sequence;
    active = true;
    return new Promise((resolve, reject) => {
      let settled = false;
      let cancelTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = (failure: { reason: unknown } | null, blob?: Blob, retain = false): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer); clearTimeout(cancelTimer);
        signal?.removeEventListener('abort', abort);
        current.onmessage = null; current.onerror = null;
        active = false;
        if (retain) idle = setTimeout(dispose, options.idleMs ?? 30_000);
        else dispose();
        if (failure) reject(failure.reason);
        else resolve(blob!);
      };
      const timer = setTimeout(() => finish({ reason: new Error('photo look: the bake ran past its budget') }), options.budgetMs ?? 60_000);
      const post = (message: PhotoLookWorkerRequest) => current.postMessage(message);
      const abort = () => {
        // Keep admission occupied until the worker has released this job's resources.
        cancelTimer = setTimeout(() => finish({ reason: signal?.reason }), options.cancelMs ?? 1000);
        try { post({ kind: 'cancel', id }); } catch { finish({ reason: signal?.reason }); }
      };
      signal?.addEventListener('abort', abort, { once: true });
      current.onerror = event => {
        event.preventDefault?.(); options.onError();
        finish({ reason: new Error(event.message || 'photo look worker could not start') });
      };
      current.onmessage = ({ data }: MessageEvent<PhotoLookWorkerReply>) => {
        if (data.id !== id) return;
        if (signal?.aborted) { finish({ reason: signal.reason }, undefined, true); return; }
        if (data.ok) { finish(null, data.blob, true); return; }
        const error = data.code ? new WebGpuError(data.code, data.error) : new Error(data.error);
        error.name = data.name;
        finish({ reason: error });
      };
      try { post({ kind: 'bake', id, request }); } catch (reason) { finish({ reason }); }
    });
  }
  return { run, dispose };
}
