// SPDX-License-Identifier: MPL-2.0
/** Browser exports may run for hours; only a lack of progress ends the wait. */
import type { ConsoleMessage, Download, Page } from 'playwright-core';

const MOTION_FORMATS = new Set(['mp4', 'webm', 'gif', 'apng', 'webp-anim']);

export function exportIdleTimeout(format: string, configured = process.env.LOLLY_EXPORT_IDLE_TIMEOUT): number {
  const seconds = Number(configured);
  if (Number.isFinite(seconds) && seconds > 0 && seconds <= 2_147_483) return seconds * 1000;
  if (MOTION_FORMATS.has(format.toLowerCase())) return 600_000;
  return ['pdf', 'pdf-cmyk', 'cmyk-tiff', 'tiff'].includes(format.toLowerCase()) ? 90_000 : 60_000;
}

export interface ExportProgress { phase: 'start' | 'progress'; done?: number; total?: number }

/** Duplicate reports and console chatter cannot keep a stalled job alive. */
export function advancingProgress(): (report: ExportProgress) => boolean {
  let started = false, done = 0, total = 0;
  return report => {
    if (report?.phase === 'start') { if (started) return false; started = true; return true; }
    const next = report?.done, count = report?.total;
    if (report?.phase !== 'progress' || !Number.isFinite(next) || !Number.isFinite(count)
      || !(next! > 0 && count! > 0 && next! <= count!)) return false;
    if (count === total && next! <= done) return false;
    done = next!; total = count!; return true;
  };
}

export interface ExportWait {
  result: Promise<Download>;
  dispose(): void;
}

/** Register before navigation so fast downloads and early progress are observed. */
export async function waitForExport(page: Page, format: string, idleMs = exportIdleTimeout(format)): Promise<ExportWait> {
  const advanced = advancingProgress();
  let timer: ReturnType<typeof setTimeout>;
  let settled = false;
  let rejectWait: (error: Error) => void;
  let resolveWait: (download: Download) => void;
  const result = new Promise<Download>((resolve, reject) => { resolveWait = resolve; rejectWait = reject; });
  // Navigation may fail before its caller awaits the download.
  void result.catch(() => {});
  const cleanup = () => {
    clearTimeout(timer);
    page.off('console', exportError); page.off('download', downloaded); page.off('close', closed); page.off('crash', crashed);
  };
  const fail = (error: Error) => { if (settled) return; settled = true; cleanup(); rejectWait(error); };
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => fail(new Error(`No export progress or download for ${idleMs / 1000}s. Set LOLLY_EXPORT_IDLE_TIMEOUT (seconds) for slower preparation or frames.`)), idleMs);
  };
  const downloaded = (download: Download) => { if (settled) return; settled = true; cleanup(); resolveWait(download); };
  const closed = () => fail(new Error('The export page closed before producing a file.'));
  const crashed = () => fail(new Error('The export page crashed before producing a file.'));
  const exportError = (message: ConsoleMessage) => {
    const text = message.text();
    if (/^Auto-export (?:failed|did not start):/.test(text)) fail(new Error(text));
  };
  await page.exposeFunction('__lollyExportProgress', (report: ExportProgress) => { if (!settled && advanced(report)) touch(); });
  page.on('console', exportError); page.on('download', downloaded); page.on('close', closed); page.on('crash', crashed);
  touch();
  return { result, dispose: () => fail(new Error('The export wait was cancelled.')) };
}
