// SPDX-License-Identifier: MPL-2.0
/**
 * Main-thread client for the ambience bake worker - the same shape as
 * zzfxm-render.ts: one lazily-spawned worker, concurrent bakes keyed by request
 * id, transferable channels back.
 *
 * The worker is a progressive enhancement, not a requirement: where Worker is
 * unavailable (or the module fails to load - an old service-worker cache serving
 * a stale chunk, say), the caller falls back to baking on the main thread. A brief
 * freeze beats no rain at all.
 */
import { bakeAmbience, type AmbienceKind } from './ambience-dsp.ts';

interface WorkerReply { id: number; channels?: Float32Array[]; error?: string }

let worker: Worker | null = null;
let unavailable = false;
let seq = 0;
const pending = new Map<number, { resolve: (c: Float32Array[]) => void; reject: (e: unknown) => void }>();

function ensureWorker(): Worker | null {
  if (worker) return worker;
  if (unavailable || typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./ambience-worker.ts', import.meta.url), { type: 'module' });
  } catch { unavailable = true; return null; }
  worker.onmessage = (e: MessageEvent<WorkerReply>): void => {
    const { id, channels, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error || !channels) p.reject(new Error(error ?? 'ambience bake failed'));
    else p.resolve(channels);
  };
  worker.onerror = (): void => {
    for (const p of pending.values()) p.reject(new Error('ambience worker error'));
    pending.clear();
    if (worker) { worker.onmessage = null; worker.onerror = null; }
    worker = null;
  };
  return worker;
}

/**
 * Bake a bed's stereo channels, off the main thread when that's possible.
 * Rejection is not expected - the fallback swallows a dead worker - so a caller
 * only has to handle a genuine synthesis failure.
 */
export async function bakeAmbienceOffThread(kind: AmbienceKind, sampleRate: number): Promise<Float32Array[]> {
  const w = ensureWorker();
  if (!w) return bakeAmbience(kind, sampleRate);
  const id = ++seq;
  try {
    return await new Promise<Float32Array[]>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      w.postMessage({ id, kind, sampleRate });
    });
  } catch {
    // The worker died or refused the job: bake here rather than leaving the layer
    // switched on and silent.
    pending.delete(id);
    return bakeAmbience(kind, sampleRate);
  }
}
