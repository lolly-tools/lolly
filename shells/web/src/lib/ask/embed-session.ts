// SPDX-License-Identifier: MPL-2.0
/** An independent embedding session; cancelling Rebrand never stops Ask. */
import { assertAiAllowed, guardAiWorker } from '../ai-policy.ts';
import type { EmbedWorkerReply } from './embed-worker.ts';

export function createEmbedSession(signal: AbortSignal): { embed: (text: string) => Promise<Float32Array>; dispose: () => void } {
  signal.throwIfAborted();
  const worker = guardAiWorker('embedding', () => new Worker(new URL('./embed-worker.ts', import.meta.url), { type: 'module' }));
  let seq = 0;
  let closed = false;
  let pending: { id: number; resolve: (value: Float32Array) => void; reject: (error: unknown) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  function stop(error: unknown): void {
    if (closed) return;
    closed = true;
    worker.terminate();
    signal.removeEventListener('abort', abort);
    if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null; }
  }
  function abort(): void { stop(signal.reason); }
  signal.addEventListener('abort', abort, { once: true });
  worker.onerror = () => stop(new Error('Local matching could not start.'));
  worker.onmessage = (event: MessageEvent<EmbedWorkerReply>) => {
    const { id, result, error } = event.data;
    if (!pending || pending.id !== id || event.data.progress) return;
    const p = pending;
    clearTimeout(p.timer);
    pending = null;
    try {
      assertAiAllowed('embedding');
      if (error || !result || result.length !== 384 || !result.every(Number.isFinite)) throw new Error(error ?? 'Invalid embedding.');
      p.resolve(result);
    } catch (err) { p.reject(err); }
  };
  return {
    embed(text) {
      signal.throwIfAborted();
      assertAiAllowed('embedding');
      if (closed || pending) return Promise.reject(new Error('Embedding session is unavailable.'));
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending = { id, resolve, reject, timer: setTimeout(() => stop(new Error('Local matching timed out.')), 60_000) };
        try { worker.postMessage({ id, text: text.slice(0, 1600) }); }
        catch (error) { stop(error); }
      });
    },
    dispose: () => stop(new Error('Embedding session closed.')),
  };
}
