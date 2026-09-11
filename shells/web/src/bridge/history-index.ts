// SPDX-License-Identifier: MPL-2.0
import type { StateRecord } from './state.ts';
import type { ExportEntry } from '../lib/export-history.ts';

/** Compound index keys let History read captions with openKeyCursor(), without
 * cloning canvas payloads or preview data. Recomputed on every owning write. */
export function indexSavedWork(record: StateRecord): StateRecord {
  return { ...record, historyKey: [record.openedAt && record.openedAt > record.updatedAt ? record.openedAt : record.updatedAt,
    record.slot, record.toolId ?? '', record.label ?? '', record.data.__export_filename ?? ''] };
}
export function indexExport(entry: ExportEntry): ExportEntry {
  return { ...entry, historyKey: [new Date(entry.at).toISOString(), entry.id, entry.toolId,
    entry.filename || entry.label, entry.format, entry.slot ?? ''] };
}
