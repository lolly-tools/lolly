// SPDX-License-Identifier: MPL-2.0
/** Local revision storage (plan 221). No transport, DOM, or global database opens. */
import type { IDBPDatabase } from 'idb';
import { indexSavedWork } from './history-index.ts';
import type { AppHistoryAPI } from './app-history.ts';
import type { RevisionArchiveAPI } from './revision-archive-format.ts';
import type { RevisionFidelityAPI } from './revision-fidelity.ts';
import { createRevisionRecovery, type RecoveryStore, type RecoveryAPI } from './revision-recovery.ts';
import { type DocumentHead, type RevisionCursor, documentVersion, holdsUnsavedWork, needsAdopt, savedRevision } from './revision-records.ts';
export { revisionSnapshot } from './revision-snapshot.ts';
import type { SavedStateData, StateRecord } from './state.ts';
import type { RevisionQuery } from './revision-query.ts';
import type { RevisionCapture } from './revision-capture.ts';
export type { RevisionQuery } from './revision-query.ts';

export interface RevisionEntry {
  id: string;
  documentId: string;
  slot: string;
  parentId: string | null;
  toolId: string;
  label: string;
  milestone?: string;
  at: string;
  reason: 'automatic' | 'save';
  hash: string;
  /** Canonical JSON length; with `hash`, what a read verifies. */
  bytes: number;
  /** Deflated length in storage, which history usage counts. Absent on
   * checkpoints written before compression and on restored backups, whose
   * payload is the JSON itself. */
  stored?: number;
  assetRefs: string[];
  toolVersion?: string;
  formatVersion?: number;
  engineVersion?: string;
  designSystem?: { id: string; label: string };
}
export interface RevisionOptions {
  reason: RevisionEntry['reason']; expectedHead: string | null; expectedVersion?: string | null;
  /** Record the current state as a saved revision without rewriting it: an editor
   * opening a state that was saved outside it (or before history existed) keeps
   * that state's thumbnail and times, and Leave without saving has it to return to. */
  adopt?: boolean;
  /** The document as the editor froze it (revision-capture.ts): canonical and
   * pinned already, so the store hashes it without walking it again. When given,
   * the store keeps this data and ignores the record's. */
  capture?: RevisionCapture;
}
/** What a commit wrote. `skipped`: an explicit save found no room in the history
 * budget, so it was written as the current state and no revision was recorded
 * (plan 277 P4 section 5); `id` is then the head the document still has, or
 * empty when the document has none. */
export type CommitResult = RevisionEntry & { currentVersion?: string; skipped?: true };
/** Bytes history holds, as `revision-usage` counts them. */
export interface RevisionUsage { checkpoints: number; previews: number; recovery: number }
/** What Leave without saving did: put the last explicit save back, moved a
 * never-saved creation out of Projects (to `slot`), or found nothing to undo. */
export interface DiscardResult { outcome: 'restored' | 'removed' | 'unchanged'; slot: string }
export interface RevisionPage { entries: RevisionEntry[]; before?: string }
export interface RevisionStore {
  activity?: AppHistoryAPI;
  fidelity?: RevisionFidelityAPI;
  backup: RevisionArchiveAPI;
  head(slot: string): Promise<string | null>;
  current(slot: string): Promise<RevisionCursor>;
  open(slot: string): Promise<RevisionCursor & { record: StateRecord | null }>;
  recovery: RecoveryStore;
  replace(record: StateRecord): Promise<void>;
  commit(record: StateRecord, options: RevisionOptions): Promise<CommitResult>;
  list(options?: RevisionQuery): Promise<RevisionPage>;
  name(id: string, name: string): Promise<void>;
  read(id: string): Promise<SavedStateData | null>;
  preview(id: string): Promise<string | null>;
  attachPreview(id: string, thumb: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  delete(slot: string): Promise<void>;
  /** Leave without saving: return the document to its last explicit save. */
  discard(slot: string): Promise<DiscardResult>;
  assetRefs(): Promise<Set<string>>;
  recentSessions(): Promise<Array<{ slot: string; toolId: string; label?: string; filename?: string; updatedAt: string }>>;
  /** Checkpoint, preview and recovery bytes, for Settings > Storage. */
  usage(): Promise<RevisionUsage>;
  /** The History-open sweep: discarded never-saved creations and protected drafts
   * older than 30 days go for good. */
  sweep(): Promise<{ discarded: number; drafts: number }>;
  /** Remove automatic checkpoints older than 30 days. Explicit saves, named
   * versions and each document's head stay. */
  pruneAutomatic(): Promise<{ removed: number; bytes: number }>;
}
export interface RevisionHistoryAPI extends Omit<RevisionStore, 'commit' | 'replace' | 'recovery'> {
  recovery: RecoveryAPI;
  checkpoint(slot: string, data: SavedStateData, options: RevisionOptions): Promise<CommitResult>;
}

/** Constructed with the SAME database as host.state. Memory/native hosts do not
 * acquire this capability accidentally; absence never invokes database repair. */
export function createRevisionStore(db: IDBPDatabase): RevisionStore {
  const recovery = createRevisionRecovery(db);
  return {
    fidelity: {
      inspect: async id => (await import('./revision-fidelity.ts')).createRevisionFidelity(db).inspect(id),
      prepareCopy: async (id, choices) => (await import('./revision-fidelity.ts')).createRevisionFidelity(db).prepareCopy(id, choices),
    },
    activity: {
      list: async (query, context) => (await import('./app-history.ts')).queryAppHistory(db, query, context),
      preview: async row => (await import('./app-history.ts')).appHistoryPreview(db, row),
      reopenExport: async id => (await import('./app-history.ts')).appHistoryExportHref(db, id),
    },
    recovery,
    backup: {
      export: async options => (await import('./revision-archive.ts')).createRevisionArchive(db).export(options),
      restore: async (archive, options) => (await import('./revision-archive.ts')).createRevisionArchive(db).restore(archive, options),
    },
    replace: record => recovery.replace(record),
    async current(slot) {
      const doc = await db.get('revision-documents', slot) as DocumentHead | undefined;
      return { head: doc?.head ?? null, version: documentVersion(doc), ...(doc?.workingHash !== undefined ? { workingHash: doc.workingHash } : {}),
        ...(needsAdopt(doc) ? { adopt: true } : {}) };
    },
    async open(slot) {
      const tx = db.transaction(['state', 'revision-documents', 'revisions'], 'readwrite');
      const doc = await tx.objectStore('revision-documents').get(slot) as DocumentHead | undefined;
      const record = await tx.objectStore('state').get(slot) as StateRecord | undefined;
      if (record) await tx.objectStore('state').put(indexSavedWork({ ...record, openedAt: new Date().toISOString() }));
      const unsaved = !!record && holdsUnsavedWork(doc, doc ? await savedRevision(tx, doc) : null);
      await tx.done;
      return { record: record ?? null, head: doc?.head ?? null, version: documentVersion(doc), unsaved,
        ...(doc?.workingHash !== undefined ? { workingHash: doc.workingHash } : {}), ...(record && needsAdopt(doc) ? { adopt: true } : {}),
        ...(record && doc?.saved === null && doc.workingHash !== '' ? { neverSaved: true } : {}) };
    },
    async head(slot) { return (await db.get('revision-documents', slot) as DocumentHead | undefined)?.head ?? null; },
    commit: async (record, options) => (await import('./revision-commit.ts')).commitRevision(db, recovery, record, options),
    list: async query => (await import('./revision-query.ts')).queryRevisions(db, query),
    name: async (id, name) => (await import('./revision-maintenance.ts')).revisionMaintenance(db, recovery).name(id, name),
    read: async id => (await import('./revision-read.ts')).readRevision(db, id),
    async preview(id) { return await db.get('revision-previews', id) ?? null; },
    attachPreview: async (id, thumb) => (await import('./revision-maintenance.ts')).revisionMaintenance(db, recovery).attachPreview(id, thumb),
    move: async (from, to) => (await import('./revision-maintenance.ts')).revisionMaintenance(db, recovery).move(from, to),
    delete: async slot => (await import('./revision-maintenance.ts')).revisionMaintenance(db, recovery).delete(slot),
    discard: async slot => (await import('./revision-discard.ts')).discardUnsaved(db, recovery, slot),
    assetRefs: async () => (await import('./revision-maintenance.ts')).revisionMaintenance(db, recovery).assetRefs(),
    recentSessions: async () => (await import('./revision-maintenance.ts')).revisionMaintenance(db, recovery).recentSessions(),
    async usage() {
      const [total, drafts] = await Promise.all([db.get('revision-usage', 'total'), db.get('revision-usage', 'recovery')]) as [{ bytes?: number; previews?: number } | undefined, number | undefined];
      return { checkpoints: Math.max(0, total?.bytes ?? 0), previews: Math.max(0, total?.previews ?? 0), recovery: Math.max(0, drafts ?? 0) };
    },
    sweep: async () => (await import('./revision-maintenance.ts')).revisionMaintenance(db, recovery).sweep(),
    pruneAutomatic: async () => (await import('./revision-maintenance.ts')).revisionMaintenance(db, recovery).pruneAutomatic(),
  };
}
