// SPDX-License-Identifier: MPL-2.0
/**
 * The web bridge's photo look bake (plan 291 W7): a Worker when the browser can
 * decode and encode there (OffscreenCanvas), else the main thread. Either way the
 * pixels go through the same engine function, so the result is the same.
 */
import type { PhotoLookBakeRequest } from './photo-look-raster.ts';

/** A bake that has not answered in this long gives up; the bridge then serves the plain picture. */
const BAKE_BUDGET_MS = 60_000;

let workerBroken = false;

function bakeInWorker(req: PhotoLookBakeRequest): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./photo-look.worker.ts', import.meta.url), { type: 'module' });
    let settled = false;
    const finish = (error: Error | null, blob?: Blob): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (error) reject(error);
      else resolve(blob!);
    };
    const timer = setTimeout(() => finish(new Error('photo look: the bake ran past its budget')), BAKE_BUDGET_MS);
    worker.onerror = (event) => { event.preventDefault?.(); workerBroken = true; finish(new Error(event.message || 'photo look worker could not start')); };
    worker.onmessage = (event: MessageEvent<{ ok: boolean; blob?: Blob; error?: string }>) => {
      if (event.data.ok && event.data.blob) finish(null, event.data.blob);
      else finish(new Error(event.data.error || 'photo look: the worker returned nothing'));
    };
    worker.postMessage(req);
  });
}

export async function bakePhotoLookBlob(req: PhotoLookBakeRequest): Promise<Blob> {
  if (!workerBroken && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try { return await bakeInWorker(req); } catch (error) {
      if (!workerBroken) throw error;
    }
  }
  const { bakePhotoLookInRealm } = await import('./photo-look-raster.ts');
  return bakePhotoLookInRealm(req);
}
