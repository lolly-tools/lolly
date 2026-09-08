// SPDX-License-Identifier: MPL-2.0
/** Local revision storage (plan 221). No transport, DOM, or global database opens. */
import type { IDBPDatabase } from 'idb';
import { MAX_REVISION_BYTES as MAX_BYTES, MAX_REVISION_PREVIEWS as MAX_PREVIEWS } from './revision-limits.ts';
import type { RevisionArchiveAPI } from './revision-archive-format.ts';
import { revisionSnapshot } from './revision-snapshot.ts';
import { createRevisionRecovery, type RecoveryStore, type RecoveryAPI } from './revision-recovery.ts';
import { REVISION_STORES, type DocumentHead, type RevisionCursor, documentVersion, writeCurrentState } from './revision-records.ts';
export { revisionSnapshot } from './revision-snapshot.ts';
import { collectAssetRefs, type SavedStateData, type StateRecord } from './state.ts';

export interface RevisionEntry {
  id: string;
  documentId: string;
  slot: string;
  parentId: string | null;
  toolId: string;
  label: string;
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
  backup: RevisionArchiveAPI;
  head(slot: string): Promise<string | null>;
  current(slot: string): Promise<{ head: string | null; version: string | null }>;
  open(slot: string): Promise<RevisionCursor & { record: StateRecord | null }>;
  recovery: RecoveryStore;
  replace(record: StateRecord): Promise<void>;
  commit(record: StateRecord, options: RevisionOptions): Promise<RevisionEntry & { currentVersion?: string }>;
  list(options?: { slot?: string; before?: string; limit?: number }): Promise<RevisionPage>;
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

const STORES = REVISION_STORES;
/** Minute detail for an hour, hourly for a day, daily for a month, weekly after
 * that. Explicit saves are outside compaction. Keep the newest point per bucket. */
export function expiredAutomatic(entries: RevisionEntry[], now: number): RevisionEntry[] {
  const occupied = new Set<string>();
  return [...entries].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).filter(entry => {
    if (entry.reason !== 'automatic') return false;
    const at = Date.parse(entry.at), age = Math.max(0, now - at);
    const unit = age < 3_600_000 ? 60_000 : age < 86_400_000 ? 3_600_000 : age < 30 * 86_400_000 ? 86_400_000 : 7 * 86_400_000;
    const bucket = `${unit}:${Math.floor(at / unit)}`;
    if (occupied.has(bucket)) return true;
    occupied.add(bucket);
    return false;
  });
}

/** Constructed with the SAME database as host.state. Memory/native hosts do not
 * acquire this capability accidentally; absence never invokes database repair. */
export function createRevisionStore(db: IDBPDatabase): RevisionStore {
  const recovery = createRevisionRecovery(db);
  return {
    recovery,
    backup: {
      export: async () => (await import('./revision-archive.ts')).createRevisionArchive(db).export(),
      restore: async archive => (await import('./revision-archive.ts')).createRevisionArchive(db).restore(archive),
    },
    replace: record => recovery.replace(record),
    async current(slot) { const doc = await db.get('revision-documents', slot) as DocumentHead | undefined; return { head: doc?.head ?? null, version: documentVersion(doc) }; },
    async open(slot) {
      const tx = db.transaction(['state', 'revision-documents']);
      const doc = await tx.objectStore('revision-documents').get(slot) as DocumentHead | undefined;
      const record = await tx.objectStore('state').get(slot) as StateRecord | undefined;
      return { record: record ?? null, head: doc?.head ?? null, version: documentVersion(doc) };
    },
    async head(slot) { return (await db.get('revision-documents', slot) as DocumentHead | undefined)?.head ?? null; },
    async commit(record, options) {
      // Hash before opening IDB: awaiting crypto inside a transaction closes it.
      const snapshot = await revisionSnapshot(record.data);
      const assetRefs = new Set<string>();
      collectAssetRefs(snapshot.data, assetRefs);
      const tx = db.transaction(STORES, 'readwrite');
      const done = tx.done;
      // A deliberate abort must not become an unhandled tx.done rejection.
      void done.catch(() => {});
      try {
        const docs = tx.objectStore('revision-documents'), revisions = tx.objectStore('revisions');
        const prior = await docs.get(record.slot) as DocumentHead | undefined;
        if ((prior?.head ?? null) !== options.expectedHead || options.expectedVersion !== undefined && documentVersion(prior) !== options.expectedVersion) throw new Error('This document changed in another tab. Reopen it before saving more history.');
        if (prior?.head && prior.hash === snapshot.hash) {
          const existing = await revisions.get(prior.head) as RevisionEntry;
          if (options.reason === 'save' && existing.reason === 'automatic') {
            existing.reason = 'save';
            await revisions.put(existing);
          }
          const currentVersion = crypto.randomUUID();
          await docs.put({ ...prior, version: currentVersion, workingHash: snapshot.hash });
          await writeCurrentState(tx, record, snapshot.data, prior.documentId);
          await recovery.clearCommitted(tx, record.slot);
          await done;
          return { ...existing, currentVersion };
        }
        const documentId = prior?.documentId ?? crypto.randomUUID();
        const entry: RevisionEntry = {
          id: crypto.randomUUID(), documentId, slot: record.slot, parentId: prior?.head ?? null,
          toolId: record.toolId ?? '', label: record.label || record.toolId || 'Untitled',
          at: record.updatedAt, reason: options.reason, hash: snapshot.hash, bytes: snapshot.bytes, assetRefs: [...assetRefs],
          toolVersion: record.toolVersion, formatVersion: record.formatVersion,
          engineVersion: record.engineVersion, designSystem: record.designSystem,
        };
        const usage = (await tx.objectStore('revision-usage').get('total')) ?? { bytes: 0, previews: 0 };
        // Bounded automatic history per document; explicit saves are protected.
        // Retire only the oldest automatic checkpoints, never the new head.
        const range = IDBKeyRange.bound([documentId, 'automatic', '', ''], [documentId, 'automatic', '\uffff', '\uffff']);
        const old = await revisions.index('documentReason').getAll(range) as RevisionEntry[];
        for (const expired of expiredAutomatic([...old, entry], Date.parse(entry.at))) {
          if (expired.id === entry.id) continue;
          const preview = await tx.objectStore('revision-previews').get(expired.id) as string | undefined;
          usage.bytes -= expired.bytes;
          usage.previews -= preview ? new TextEncoder().encode(preview).byteLength : 0;
          await revisions.delete(expired.id);
          await tx.objectStore('revision-payloads').delete(expired.id);
          await tx.objectStore('revision-previews').delete(expired.id);
        }
        if (usage.bytes + snapshot.bytes > MAX_BYTES) throw new Error('History storage is full. Your previous checkpoints are safe; export an editable .lolly file.');
        usage.bytes += snapshot.bytes;
        await tx.objectStore('revision-usage').put(usage, 'total');
        await revisions.add(entry);
        await tx.objectStore('revision-payloads').add(snapshot.data, entry.id);
        await docs.put({ slot: record.slot, documentId, head: entry.id, hash: entry.hash, workingHash: entry.hash, version: entry.id });
        await writeCurrentState(tx, record, snapshot.data, documentId);
        await recovery.clearCommitted(tx, record.slot);
        await done;
        return entry;
      } catch (error) {
        try { tx.abort(); } catch { /* transaction already failed */ }
        throw error;
      }
    },
    async list({ slot, before, limit = 30 } = {}) {
      const tx = db.transaction(['revision-documents', 'revisions']);
      const document = slot ? await tx.objectStore('revision-documents').get(slot) as DocumentHead | undefined : undefined;
      if (slot && !document) return { entries: [] };
      const index = tx.objectStore('revisions').index(slot ? 'documentTime' : 'time');
      const end = before ? JSON.parse(before) as [string, string] : ['\uffff', '\uffff'];
      const range = slot
        ? IDBKeyRange.bound([document!.documentId, '', ''], [document!.documentId, ...end], false, !!before)
        : IDBKeyRange.upperBound(end, !!before);
      const entries: RevisionEntry[] = [];
      let cursor = await index.openCursor(range, 'prev');
      const count = Math.max(1, Math.min(100, limit));
      while (cursor && entries.length < count) { entries.push(cursor.value as RevisionEntry); cursor = await cursor.continue(); }
      const last = entries.at(-1);
      return { entries, ...(cursor && last ? { before: JSON.stringify([last.at, last.id]) } : {}) };
    },
    async read(id) { return await db.get('revision-payloads', id) ?? null; },
    async preview(id) { return await db.get('revision-previews', id) ?? null; },
    async attachPreview(id, thumb) {
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(thumb) || thumb.length > 256 * 1024) return;
      const tx = db.transaction(['state', 'revision-documents', 'revisions', 'revision-previews', 'revision-usage'], 'readwrite');
      const row = await tx.objectStore('revisions').get(id) as RevisionEntry | undefined;
      if (!row) return;
      const previews = tx.objectStore('revision-previews');
      const prior = await previews.get(id) as string | undefined;
      const usage = await tx.objectStore('revision-usage').get('total') ?? { bytes: 0, previews: 0 };
      const size = new TextEncoder().encode(thumb).byteLength;
      const total = usage.previews + size - (prior ? new TextEncoder().encode(prior).byteLength : 0);
      if (total > MAX_PREVIEWS) return; // text-only history remains fully usable
      await previews.put(thumb, id);
      await tx.objectStore('revision-usage').put({ ...usage, previews: total }, 'total');
      const head = await tx.objectStore('revision-documents').get(row.slot) as DocumentHead | undefined;
      const state = await tx.objectStore('state').get(row.slot) as StateRecord | undefined;
      if (head?.head === id && (head.workingHash ?? head.hash) === row.hash && state?.documentId === row.documentId) await tx.objectStore('state').put({ ...state, thumb });
      await tx.done;
    },
    async move(from, to) {
      const tx = db.transaction(['state', 'revision-documents', 'revisions', 'revision-recovery'], 'readwrite');
      const state = await tx.objectStore('state').get(from) as StateRecord | undefined;
      if (!state) return;
      if (await tx.objectStore('state').get(to)) throw new Error('The destination already exists.');
      const doc = await tx.objectStore('revision-documents').get(from) as DocumentHead | undefined;
      if (doc) {
        await tx.objectStore('revision-documents').put({ ...doc, slot: to });
        await tx.objectStore('revision-documents').delete(from);
        for (const row of await tx.objectStore('revisions').index('documentId').getAll(doc.documentId)) await tx.objectStore('revisions').put({ ...row, slot: to });
      }
      for (const row of await tx.objectStore('revision-recovery').index('slot').getAll(from)) await tx.objectStore('revision-recovery').put({ ...row, slot: to });
      await tx.objectStore('state').put({ ...state, slot: to });
      await tx.objectStore('state').delete(from);
      await tx.done;
    },
    async delete(slot) {
      const tx = db.transaction(STORES, 'readwrite');
      const doc = await tx.objectStore('revision-documents').get(slot) as DocumentHead | undefined;
      if (doc) {
        const usage = await tx.objectStore('revision-usage').get('total') ?? { bytes: 0, previews: 0 };
        for (const row of await tx.objectStore('revisions').index('documentId').getAll(doc.documentId) as RevisionEntry[]) {
          const preview = await tx.objectStore('revision-previews').get(row.id) as string | undefined;
          usage.bytes -= row.bytes;
          usage.previews -= preview ? new TextEncoder().encode(preview).byteLength : 0;
          await tx.objectStore('revisions').delete(row.id);
          await tx.objectStore('revision-payloads').delete(row.id);
          await tx.objectStore('revision-previews').delete(row.id);
        }
        await tx.objectStore('revision-usage').put(usage, 'total');
        await tx.objectStore('revision-documents').delete(slot);
      }
      await recovery.clearCommitted(tx, slot, true);
      await tx.objectStore('state').delete(slot);
      await tx.done;
    },
    async assetRefs() {
      const refs = new Set<string>();
      const tx = db.transaction(['revisions', 'revision-payloads']);
      let cursor = await tx.objectStore('revisions').openCursor();
      while (cursor) {
        const row = cursor.value as RevisionEntry;
        if (row.assetRefs) for (const ref of row.assetRefs) refs.add(ref);
        else collectAssetRefs(await tx.objectStore('revision-payloads').get(row.id), refs);
        cursor = await cursor.continue();
      }
      for (const ref of await recovery.assetRefs()) refs.add(ref);
      return refs;
    },
    async recentSessions() {
      const result: Array<{ slot: string; toolId: string; label?: string; filename?: string; updatedAt: string }> = [];
      let cursor = await db.transaction('state').store.index('updatedAt').openCursor(undefined, 'prev');
      while (cursor && result.length < 12) {
        const row = cursor.value as StateRecord;
        if (!row.slot.startsWith('__trash__:')) result.push({ slot: row.slot, toolId: row.toolId ?? '', label: row.label, filename: row.data.__export_filename, updatedAt: row.updatedAt });
        cursor = await cursor.continue();
      }
      return result;
    },
  };
}
