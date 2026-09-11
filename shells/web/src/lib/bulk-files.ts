// SPDX-License-Identifier: MPL-2.0
/**
 * plans/147 M2 - "Bulk from files": run a file-transform tool over N picked files.
 *
 * The live runtime already turns ONE input file into output bytes through its
 * exportFile hook (the file in → file out path the Download button uses). This walks
 * a list of files through that same path - `runOne(i)` sets file i on the runtime and
 * returns its exportFile output - and gathers the results into zip-ready entries. A
 * file that throws is recorded in `failed` and skipped, never aborting the run, so one
 * unreadable image doesn't lose the other forty conversions.
 *
 * Deliberately engine-free: it returns entries (name + bytes) and the caller calls
 * storeZip. That keeps the loop (per-file error isolation + name de-duplication, the
 * only non-trivial logic) unit-testable without the engine, and leaves the one legal
 * export container change (the zip) on the shell side that owns delivery.
 *
 * The loop is foreground by design: it drives the runtime mounted in the current tool
 * view, so it cannot be a navigate-away background job. Callers show inline progress.
 */
import { allocateFileName } from '@lolly-tools/core/file-v1';

/** One output of a tool's exportFile hook (see engine ExportFileResult). */
export interface BulkExportItem {
  bytes: Uint8Array | ArrayBuffer | ArrayLike<number>;
  filename?: string;
}

export interface BulkFilesResult {
  /** Zip-ready, collision-free entries (empty when every file failed). */
  entries: { name: string; bytes: Uint8Array }[];
  /** Names of the files that threw and were skipped. */
  failed: string[];
}

export async function collectBulkFiles(
  files: readonly { name: string }[],
  runOne: (index: number) => Promise<BulkExportItem[]>,
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<BulkFilesResult> {
  const entries: { name: string; bytes: Uint8Array }[] = [];
  const failed: string[] = [];
  const used = new Set<string>();
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length, files[i]!.name);
    try {
      for (const it of await runOne(i)) {
        const name = allocateFileName(it.filename || files[i]!.name, used);
        entries.push({ name, bytes: it.bytes instanceof Uint8Array ? it.bytes : new Uint8Array(it.bytes) });
      }
    } catch {
      failed.push(files[i]!.name);
    }
  }
  onProgress?.(files.length, files.length, '');
  return { entries, failed };
}
