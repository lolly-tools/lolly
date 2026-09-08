// SPDX-License-Identifier: MPL-2.0
import { MAX_REVISION_ARCHIVE_BYTES } from './revision-limits.ts';
/** Portable local history. IDs are JSON fields, never archive paths. Validate
 * every payload before storage; retained parents may legitimately be compacted. */
import type { StateRecord, SavedStateData } from './state.ts';
import { collectAssetRefs } from './state.ts';
import type { DocumentHead } from './revision-records.ts';
import type { RevisionEntry } from './revision-history.ts';
import type { RecoveryRecord } from './revision-recovery.ts';
import { revisionSnapshot } from './revision-snapshot.ts';

export interface RevisionArchive {
  version: 1;
  documents: Array<{ document: DocumentHead; state: StateRecord }>;
  revisions: Array<{ entry: RevisionEntry; data: SavedStateData; preview?: string }>;
  recoveries: RecoveryRecord[];
}
export interface RevisionArchiveSummary { revisions: number; recoveryDrafts: number }
export interface RevisionArchiveAPI {
  export(): Promise<RevisionArchive>;
  restore(archive: unknown): Promise<RevisionArchiveSummary>;
}
const MAX_ITEMS = 100_000;
const invalid = (): never => { throw new Error('Invalid revision history in this backup. Nothing from its history was restored.'); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function string(value: unknown): string { return typeof value === 'string' && value.length > 0 && value.length <= 4096 ? value : invalid(); }
function date(value: unknown): string { const at = string(value); return Number.isFinite(Date.parse(at)) ? at : invalid(); }
function nullable(value: unknown): string | null { return value === null ? null : string(value); }
function array(value: unknown): unknown[] { return Array.isArray(value) && value.length <= MAX_ITEMS ? value : invalid(); }
function unique(seen: Set<string>, id: string): void { if (seen.has(id)) invalid(); seen.add(id); }
function refs(data: SavedStateData): string[] { const refs = new Set<string>(); collectAssetRefs(data, refs); return [...refs]; }

export async function validateRevisionArchive(value: unknown): Promise<RevisionArchive> {
  const input = object(value);
  if (input.version !== 1) return invalid();
  let bytes = 0;
  const snapshot = async (value: unknown): ReturnType<typeof revisionSnapshot> => {
    const data = object(value);
    for (const key of ['__toolId', '__toolVersion', '__label', '__export_filename']) if (data[key] !== undefined && typeof data[key] !== 'string') invalid();
    const result = await revisionSnapshot(data); bytes += result.bytes;
    if (bytes > MAX_REVISION_ARCHIVE_BYTES) throw new Error('Revision history exceeds the 384 MiB backup limit. Keep this backup and restore it with a larger-history reader.');
    return result;
  };
  const result: RevisionArchive = { version: 1, documents: [], revisions: [], recoveries: [] };
  const documentIds = new Set<string>(), slots = new Set<string>(), revisionIds = new Set<string>(), recoveryIds = new Set<string>();
  for (const item of array(input.documents)) {
    const row = object(item), doc = object(row.document), state = object(row.state);
    const slot = string(doc.slot), documentId = string(doc.documentId);
    unique(documentIds, documentId); unique(slots, slot);
    if (state.slot !== slot || state.documentId !== documentId) invalid();
    const data = await snapshot(state.data);
    const document: DocumentHead = { slot, documentId, head: nullable(doc.head), hash: nullable(doc.hash),
      version: string(doc.version ?? doc.head), workingHash: data.hash };
    if (doc.workingHash && doc.workingHash !== data.hash) invalid();
    result.documents.push({ document, state: { slot, documentId, data: data.data, thumb: null,
      toolId: data.data.__toolId, toolVersion: data.data.__toolVersion, label: data.data.__label,
      updatedAt: date(state.updatedAt), ...(state.createdAt ? { createdAt: date(state.createdAt) } : {}),
      ...stamps(state),
    } });
  }
  const documentSlots = new Map(result.documents.map(row => [row.document.documentId, row.document.slot]));
  for (const item of array(input.revisions)) {
    const row = object(item), entry = object(row.entry), data = await snapshot(row.data);
    const id = string(entry.id); unique(revisionIds, id);
    if (data.data.__toolId && data.data.__toolId !== entry.toolId) invalid();
    if (entry.hash !== data.hash || entry.bytes !== data.bytes || !['automatic', 'save'].includes(String(entry.reason))) invalid();
    const documentId = string(entry.documentId), slot = string(entry.slot);
    if (documentSlots.get(documentId) !== slot) invalid();
    const preview = typeof row.preview === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(row.preview) && row.preview.length <= 256 * 1024 ? row.preview : undefined;
    if (row.preview !== undefined && !preview) invalid();
    bytes += preview?.length ?? 0;
    result.revisions.push({ entry: { id, documentId, slot, parentId: nullable(entry.parentId),
      toolId: string(entry.toolId), label: string(entry.label), at: date(entry.at), reason: entry.reason as RevisionEntry['reason'],
      hash: data.hash, bytes: data.bytes, assetRefs: refs(data.data), ...stamps(entry) }, data: data.data, ...(preview ? { preview } : {}) });
  }
  for (const item of array(input.recoveries)) {
    const row = object(item), data = await snapshot(row.data), id = string(row.id); unique(recoveryIds, id);
    if (data.data.__toolId && data.data.__toolId !== row.toolId) invalid();
    if (row.hash !== data.hash || row.bytes !== data.bytes || typeof row.diverged !== 'boolean') invalid();
    result.recoveries.push({ id, slot: string(row.slot), documentId: string(row.documentId), version: string(row.version),
      baseHead: nullable(row.baseHead), baseVersion: nullable(row.baseVersion), toolId: string(row.toolId), label: string(row.label),
      at: date(row.at), diverged: row.diverged === true, hash: data.hash, bytes: data.bytes, assetRefs: refs(data.data), data: data.data });
  }
  const byId = new Map(result.revisions.map(row => [row.entry.id, row.entry]));
  const checked = new Set<string>();
  for (const { entry } of result.revisions) {
    const path = new Set<string>();
    let cursor: RevisionEntry | undefined = entry;
    while (cursor && !checked.has(cursor.id)) {
      if (path.has(cursor.id) || cursor.documentId !== entry.documentId) invalid();
      path.add(cursor.id); cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    if (cursor && cursor.documentId !== entry.documentId) invalid();
    for (const id of path) checked.add(id);
  }
  for (const { document } of result.documents) {
    const head = document.head ? byId.get(document.head) : null;
    if (document.head && (!head || head.documentId !== document.documentId || head.hash !== document.hash)) invalid();
    if (!document.head && document.hash !== null) invalid();
  }
  if (bytes > MAX_REVISION_ARCHIVE_BYTES) invalid();
  return result;
}

function stamps(row: Record<string, unknown>): Partial<Pick<StateRecord, 'engineVersion' | 'toolVersion' | 'formatVersion' | 'designSystem'>> {
  const result: ReturnType<typeof stamps> = {};
  for (const key of ['engineVersion', 'toolVersion'] as const) if (row[key] !== undefined) result[key] = string(row[key]);
  if (row.formatVersion !== undefined) {
    if (!Number.isInteger(row.formatVersion) || Number(row.formatVersion) < 0) invalid();
    result.formatVersion = Number(row.formatVersion);
  }
  if (row.designSystem !== undefined) { const design = object(row.designSystem); result.designSystem = { id: string(design.id), label: string(design.label) }; }
  return result;
}
