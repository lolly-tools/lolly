// SPDX-License-Identifier: MPL-2.0
/** Optional progress reporting for a Node shell driving this browser. */
import type { ExportOpts } from './export-shared.ts';

type Report = { phase: 'start' | 'progress'; done?: number; total?: number };
type ExportWindow = Window & { __lollyExportProgress?: (report: Report) => Promise<void> };

export function browserExportProgress(opts: ExportOpts): ExportOpts {
  if (typeof window === 'undefined') return opts;
  const sink = (window as ExportWindow).__lollyExportProgress;
  if (!sink) return opts;
  const report = (value: Report) => {
    try { void Promise.resolve(sink(value)).catch(() => {}); } catch { /* Losing the observer cannot fail an export. */ }
  };
  report({ phase: 'start' });
  return { ...opts, onProgress: (done, total) => {
    report({ phase: 'progress', done, total });
    opts.onProgress?.(done, total);
  } };
}

/** Refuse a document whose tool reports that no export can be produced yet. */
export function assertExportReady(node: Element): void {
  const unavailable = node.matches('[data-export-error]') ? node : node.querySelector('[data-export-error]');
  if (unavailable) throw new Error(unavailable.getAttribute('data-export-error') || 'The tool is not ready to export.');
}
