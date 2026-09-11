// SPDX-License-Identifier: MPL-2.0
import type { CompareAPI, ComparisonRequest, ComparisonResult, VisualComparisonRequest, VisualComparisonResult } from '@lolly-tools/core/host-v1';
/** One disposable worker per job. Cancellation releases data and computation. */
function runJob<T extends ComparisonResult | VisualComparisonResult>(request: ComparisonRequest | VisualComparisonRequest, mode: 'content' | 'visual', options?: { signal?: AbortSignal }): Promise<T> { return new Promise((resolve, reject) => {
  const signal = options?.signal;
  if (signal?.aborted) { reject(new DOMException('Comparison cancelled.', 'AbortError')); return; }
  const worker = new Worker(new URL('./compare-worker.ts', import.meta.url), { type: 'module' });
  const finish = (): void => { worker.terminate(); signal?.removeEventListener('abort', cancel); };
  const cancel = (): void => { finish(); reject(new DOMException('Comparison cancelled.', 'AbortError')); };
  signal?.addEventListener('abort', cancel, { once: true });
  worker.onerror = () => { finish(); reject(new Error('The local comparison could not finish.')); };
  worker.onmessage = ({ data }: MessageEvent<{ result?: T; error?: string }>) => {
    finish();
    if (data.result) resolve(data.result); else reject(new Error('The supplied snapshots could not be compared.'));
  };
  try { worker.postMessage({ mode, request }); } catch { finish(); reject(new Error('These snapshots are not supported.')); }
}); }
export const runComparison: CompareAPI['run'] = (request, options) => runJob<ComparisonResult>(request, 'content', options);
export const runVisualComparison: NonNullable<CompareAPI['visual']> = (request, options) => runJob<VisualComparisonResult>(request, 'visual', options);
