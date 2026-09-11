// SPDX-License-Identifier: MPL-2.0
/** Local revision storage (plan 221). No transport, DOM, or global database opens. */
import type { IDBPDatabase } from 'idb';
import { indexSavedWork } from './history-index.ts';
import type { AppHistoryAPI } from './app-history.ts';
import type { RevisionArchiveAPI } from './revision-archive-format.ts';
import type { RevisionFidelityAPI } from './revision-fidelity.ts';
import { createRevisionRecovery, type RecoveryStore, type RecoveryAPI } from './revision-recovery.ts';
import { type DocumentHead, type RevisionCursor, documentVersion } from './revision-records.ts';
export { revisionSnapshot } from './revision-snapshot.ts';
import type { SavedStateData, StateRecord } from './state.ts';
import type { RevisionQuery } from './revision-query.ts';
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
  bytes: number;
  assetRefs: string[];
  toolVersion?: string;
  formatVersion?: number;
  engineVersion?: string;
  designSystem?: { id: string; label: string };
}
export interface RevisionOptions { reason: RevisionEntry['reason']; expectedHead: string | null; expectedVersion?: string | null }
export interface RevisionPage { entries: RevisionEntry[]; before?: string }
export interface RevisionStore {
  activity?: AppHistoryAPI;
  fidelity?: RevisionFidelityAPI;
  backup: RevisionArchiveAPI;
  head(slot: string): Promise<string | null>;
  current(slot: string): Promise<{ head: string | null; version: string | null }>;
  open(slot: string): Promise<RevisionCursor & { record: StateRecord | null }>;
  recovery: RecoveryStore;
  replace(record: StateRecord): Promise<void>;
  commit(record: StateRecord, options: RevisionOptions): Promise<RevisionEntry & { currentVersion?: string }>;
  list(options?: RevisionQuery): Promise<RevisionPage>;
  name(id: string, name: string): Promise<void>;
  read(id: string): Promise<SavedStateData | null>;
  preview(id: string): Promise<string | null>;
  attachPreview(id: string, thumb: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  delete(slot: string): Promise<void>;
  assetRefs(): Promise<Set<string>>;
  recentSessions(): Promise<Array<{ slot: string; toolId: string; label?: string; filename?: string; updatedAt: string }>>;
}
export interface RevisionHistoryAPI extends Omit<RevisionStore, 'commit' | 'replace' | 'recovery'> {
  recovery: RecoveryAPI;
  checkpoint(slot: string, data: SavedStateData, options: RevisionOptions): Promise<RevisionEntry & { currentVersion?: string }>;
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
      export: async () => (await import('./revision-archive.ts')).createRevisionArchive(db).export(),
      restore: async archive => (await import('./revision-archive.ts')).createRevisionArchive(db).restore(archive),
    },
    replace: record => recovery.replace(record),
    async current(slot) { const doc = await db.get('revision-documents', slot) as DocumentHead | undefined; return { head: doc?.head ?? null, version: documentVersion(doc) }; },
    async open(slot) {
      const tx = db.transaction(['state', 'revision-documents'], 'readwrite');
      const doc = await tx.objectStore('revision-documents').get(slot) as DocumentHead | undefined;
      const record = await tx.objectStore('state').get(slot) as StateRecord | undefined;
      if (record) await tx.objectStore('state').put(indexSavedWork({ ...record, openedAt: new Date().toISOString() }));
      await tx.done;
      return { record: record ?? null, head: doc?.head ?? null, version: documentVersion(doc) };
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
    assetRefs: async () => (await import('./revision-maintenance.ts')).revisionMaintenance(db, recovery).assetRefs(),
    recentSessions: async () => (await import('./revision-maintenance.ts')).revisionMaintenance(db, recovery).recentSessions(),
  };
}
