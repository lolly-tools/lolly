// SPDX-License-Identifier: MPL-2.0
/**
 * The page's side of the audio DSP worker (lib/audio-dsp-worker.ts). Loaded on demand by
 * the clean, loudness and align paths, never on first paint. Every call is one
 * round trip: PCM goes in by structured clone and the numbers or repaired PCM come back.
 */
import type { LoudnessMeasurement, RepairResult, ClipAlignment } from '@lolly-tools/node-shell/audio-dsp';
import type { RepairStage } from '../../../../engine/src/audio-repair.ts';

interface Reply { id: number; result?: unknown; error?: string }

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

function ensureWorker(): Worker {
  if (worker) return worker;
  if (typeof Worker !== 'function') throw new Error('Audio processing needs Web Workers, which this browser does not offer.');
  const w = new Worker(new URL('../lib/audio-dsp-worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<Reply>): void => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error !== undefined) p.reject(new Error(e.data.error)); else p.resolve(e.data.result);
  };
  w.onerror = (): void => {
    for (const p of pending.values()) p.reject(new Error('The audio worker stopped unexpectedly.'));
    pending.clear();
    w.onmessage = null; w.onerror = null;
    if (worker === w) worker = null;
  };
  worker = w;
  return w;
}

function call<T>(message: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve: v => resolve(v as T), reject });
    try { ensureWorker().postMessage({ ...message, id }); } catch (error) { pending.delete(id); reject(error); }
  });
}

export function measureLoudness(channels: readonly Float32Array[], sampleRate: number, series = false): Promise<LoudnessMeasurement> {
  // Normalize measures a mono file as heard on both speakers.
  return call({ op: 'measure', channels, sampleRate, series, monoAsStereo: true });
}
export function repairAudio(channels: readonly Float32Array[], sampleRate: number, stages: readonly RepairStage[]): Promise<RepairResult> {
  return call({ op: 'repair', channels, sampleRate, stages });
}
export function alignAudio(a: readonly Float32Array[], b: readonly Float32Array[], sampleRate: number, maxLagSeconds?: number): Promise<ClipAlignment | null> {
  return call({ op: 'align', a, b, sampleRate, ...(maxLagSeconds === undefined ? {} : { maxLagSeconds }) });
}
