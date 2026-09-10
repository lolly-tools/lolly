// SPDX-License-Identifier: MPL-2.0
import type { PreparationInspection, PreparationResult } from '@lolly-tools/core/host-v1';
import type { PreparationRequest } from './prepare-worker.ts';
export function runPreparation<T extends PreparationInspection | PreparationResult>(request: PreparationRequest, signal?: AbortSignal, progress?: (message: string) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const worker = new Worker(new URL('./prepare-worker.ts', import.meta.url), { type: 'module' });
    const finish = (): void => { worker.terminate(); signal?.removeEventListener('abort', cancel); };
    const cancel = (): void => { finish(); reject(new DOMException('Cancelled. Your originals are unchanged.', 'AbortError')); };
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onerror = () => { finish(); reject(new Error('The local worker could not finish. Your originals are unchanged.')); };
    worker.onmessage = ({ data }) => {
      if (data.progress) { progress?.(`Inspecting ${data.progress.phase === 'output' ? 'output' : 'input'} file ${data.progress.completed} of ${data.progress.total}…`); return; }
      finish();
      if (data.error) reject(new Error(data.error)); else resolve(data.result as T);
    };
    worker.postMessage(request); // Copy, never detach the recoverable originals.
  });
}
