// SPDX-License-Identifier: MPL-2.0
/**
 * The web bridge's photo look bake (plan 291 W7): a Worker when the browser can
 * decode and encode there (OffscreenCanvas), else the main thread. LUT sampling
 * requires WebGPU in either realm; other treatments keep their existing recipe.
 */
import type { PhotoLookBakeRequest } from './photo-look-raster.ts';
import { WebGpuError } from '../lib/webgpu/device.ts';
import { createPhotoLookWorkerClient } from './photo-look-worker-client.ts';

let workerBroken = false;
const workerOptions = {
  createWorker: () => new Worker(new URL('./photo-look.worker.ts', import.meta.url), { type: 'module' }),
  onError: () => { workerBroken = true; },
};
const lutWorker = createPhotoLookWorkerClient(workerOptions);

async function bake(req: PhotoLookBakeRequest, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted();
  if (!workerBroken && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    const client = req.look.kind === 'lut' ? lutWorker : createPhotoLookWorkerClient(workerOptions);
    try { return await client.run(req, signal); } catch (error) {
      if (!workerBroken) throw error;
    } finally {
      if (req.look.kind !== 'lut') client.dispose();
    }
  }
  const { bakePhotoLookInRealm } = await import('./photo-look-raster.ts');
  return bakePhotoLookInRealm(req, signal);
}

let lutTail: Promise<void> = Promise.resolve();
let lutBakes = 0;

/** LUT workers share a bounded admission queue so independent asset reads cannot exhaust graphics memory. */
export async function bakePhotoLookBlob(req: PhotoLookBakeRequest, options: { signal?: AbortSignal } = {}): Promise<Blob> {
  options.signal?.throwIfAborted();
  if (req.look.kind !== 'lut') return bake(req, options.signal);
  if (lutBakes >= 8) throw new WebGpuError('WEBGPU_BUSY', 'The photo grading queue is full. Try again after the current work finishes.');
  lutBakes++;
  const pending = lutTail.then(() => bake(req, options.signal)).finally(() => { lutBakes--; });
  lutTail = pending.then(() => {}, () => {});
  if (!options.signal) return pending;
  const signal = options.signal;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
