// SPDX-License-Identifier: MPL-2.0
import { hashBlob, recordExport, type ExportEntry } from './export-history.ts';

/** Capture policy is fixed by the editor mount. Shared/temporary sessions do
 * not capture, hash, or persist private activity, even if the download succeeds. */
export async function recordExportActivity(opts: {
  allowed: boolean;
  entry: Omit<ExportEntry, 'id' | 'at' | 'thumb'>;
  capture(): Promise<string | null>;
  bytes?: Blob | null;
}, write: typeof recordExport = recordExport): Promise<void> {
  if (!opts.allowed) return;
  const entry = { ...opts.entry }, at = Date.now();
  try {
    const thumb = await opts.capture();
    const contentHash = opts.bytes ? await hashBlob(opts.bytes) : undefined;
    await write({ ...entry, at, thumb, ...(contentHash ? { contentHash } : {}) });
  } catch { /* A history failure cannot interrupt a completed download. */ }
}
