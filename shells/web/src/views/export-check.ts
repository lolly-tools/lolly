// SPDX-License-Identifier: MPL-2.0
/**
 * The export check: after a download, the delivered bytes are read back and
 * compared with the export settings.
 *
 * The engine owns the facts and the comparison (`engine/src/output-facts.ts`,
 * `engine/src/preflight-output.ts`); `views/tool-actions/preflight.ts` collects
 * the request from the live panel. This module holds the two shell-side pieces
 * between them: reading a Blob within a memory bound, and choosing which
 * findings reach the export card.
 *
 * Only differences reach the card. Notes and named gaps stay in the report a
 * caller can build with `verifyExport`, because a line on every export that
 * says "this property could not be read" teaches people to ignore the card.
 */
import type { ExportRequest, Finding, PreflightJob } from '@lolly/engine';

/**
 * Largest delivered file read back. A longer video is skipped rather than
 * copied into memory a second time after the download has already been handed over.
 */
export const EXPORT_CHECK_MAX_BYTES = 256 * 1024 * 1024;

/** The card's lines: warnings and errors, in the engine's severity order. */
export function exportCheckLines(findings: readonly Finding[]): string[] {
  return findings.filter((f) => f.severity === 'error' || f.severity === 'warn').map((f) => f.message);
}

/** Read a delivered Blob and compare it with the request the job describes, plus `extra`. */
export async function exportCheckFindings(job: PreflightJob, blob: Blob, extra: Partial<ExportRequest>): Promise<Finding[]> {
  if (!blob || blob.size > EXPORT_CHECK_MAX_BYTES) return [];
  // Loaded on the first check, so the readers stay out of the panel's own chunk.
  const [{ compareExport, exportRequestFromJob }, { inspectOutput }] = await Promise.all([
    import('../../../../engine/src/preflight-output.ts'),
    import('../../../../engine/src/output-facts.ts'),
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return compareExport(exportRequestFromJob(job, extra), inspectOutput(bytes)).findings;
}
