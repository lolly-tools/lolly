// SPDX-License-Identifier: MPL-2.0
/**
 * Export history - a small, capped log of the files you actually DOWNLOADED (the
 * Download button), each with a thumbnail and enough state to reopen it exactly as
 * it was. Unlike a saved session (the Save button), a download leaves no record on
 * its own, so this is what powers the Dashboard's "Latest exports" stack.
 *
 * Stored in the 'exports' IndexedDB store (db.ts v5). Best-effort throughout: a
 * failure to record must never disrupt the download it followed.
 */
import { openDB } from '../bridge/db.ts';
import { indexExport } from '../bridge/history-index.ts';

export interface ExportEntry {
  id: string;
  toolId: string;
  label: string;        // tool name (fallback caption)
  filename: string;     // the download filename (preferred caption)
  format: string;
  thumb: string | null; // data-URL preview
  query: string;        // serialised URL-state → reopen link
  at: number;           // epoch ms
  /** Hex SHA-256 of the exact bytes downloaded - lets /verify match a file back to
   *  this record. Optional: absent on pre-hash records and where crypto.subtle is. */
  contentHash?: string;
  /** Local creation association, absent on older downloads and unsaved tools. */
  slot?: string;
  historyKey?: string[];
}

const STORE = 'exports';
const CAP = 24;         // keep the most recent N; older ones are pruned

/** Record one export. Fire-and-forget; swallows all errors. */
export async function recordExport(e: Omit<ExportEntry, 'id'>): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE)) return;
    const id = `${e.at}-${Math.random().toString(36).slice(2, 8)}`;
    await db.put(STORE, indexExport({ ...e, id }));
    // Prune to the newest CAP so the log (and its thumbnails) stay bounded.
    const all = (await db.getAll(STORE)) as ExportEntry[];
    if (all.length > CAP) {
      all.sort((a, b) => b.at - a.at);
      const tx = db.transaction(STORE, 'readwrite');
      await Promise.all(all.slice(CAP).map((old) => tx.store.delete(old.id)));
      await tx.done;
    }
  } catch { /* history is best-effort */ }
}

/** The most recent exports, newest first. */
export async function listExports(limit = 12): Promise<ExportEntry[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE)) return [];
    const all = (await db.getAll(STORE)) as ExportEntry[];
    return all.sort((a, b) => b.at - a.at).slice(0, limit);
  } catch { return []; }
}

/** The reopen link for an entry - the tool plus the exact state it was downloaded
 *  with. The single source of the URL shape (dashboard stack + export popup rail). */
export function exportReopenHref(e: Pick<ExportEntry, 'toolId' | 'query'>): string {
  return `#/tool/${e.toolId}${e.query ? '?' + e.query : ''}`;
}

/** Hex SHA-256 of a blob's bytes; undefined where crypto.subtle is unavailable
 *  (insecure contexts) or the read fails - callers treat the hash as best-effort. */
export async function hashBlob(blob: Blob): Promise<string | undefined> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return undefined; }
}
