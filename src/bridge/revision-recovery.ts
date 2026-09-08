// SPDX-License-Identifier: MPL-2.0
import { MAX_RECOVERY_BYTES } from './revision-limits.ts';
/** Rolling writer drafts. IndexedDB replaces a generation atomically, leaving
 * the preceding generation intact on failure. No previews or timeline rows. */
import type { IDBPDatabase } from 'idb';
import { collectAssetRefs, type SavedStateData, type StateRecord } from './state.ts';
import { canonicalRevisionData, revisionSnapshot } from './revision-snapshot.ts';
import { documentVersion, writeCurrentState, type DocumentHead, type RevisionTransaction } from './revision-records.ts';

export interface RecoveryOptions { writerId: string; expectedHead: string | null; expectedVersion: string | null }
export interface RecoveryEntry {
  id: string; slot: string; documentId: string; version: string;
  baseHead: string | null; baseVersion: string | null;
  toolId: string; label: string; at: string; hash: string; bytes: number;
  diverged: boolean; assetRefs: string[];
}
export interface RecoveryRecord extends RecoveryEntry { data: SavedStateData }
export interface RecoveryAPI {
  save(slot: string, data: SavedStateData, options: RecoveryOptions): Promise<RecoveryEntry>;
  list(options?: { slot?: string; before?: string; limit?: number }): Promise<{ entries: RecoveryEntry[]; before?: string }>;
  read(id: string): Promise<SavedStateData | null>;
}
export interface RecoveryStore extends Omit<RecoveryAPI, 'save'> {
  write(record: StateRecord, options: RecoveryOptions): Promise<RecoveryEntry>;
  replace(record: StateRecord): Promise<void>;
  clearCommitted(tx: RevisionTransaction, slot: string, all?: boolean): Promise<void>;
  assetRefs(): Promise<Set<string>>;
}
const STORES = ['state', 'revision-documents', 'revision-recovery', 'revision-recovery-payloads', 'revision-usage'];

function metadata({ data: _data, ...entry }: RecoveryRecord): RecoveryEntry { return entry; }
async function putRecovery(tx: RevisionTransaction, row: RecoveryRecord): Promise<void> {
  const store = tx.objectStore('revision-recovery');
  const old = await store.get(row.id) as RecoveryRecord | undefined;
  if (old && old.slot !== row.slot) throw new Error('A recovery writer cannot change documents.');
  const usage = await tx.objectStore('revision-usage').get('recovery') ?? 0;
  const bytes = usage + row.bytes - (old?.bytes ?? 0);
  if (bytes > MAX_RECOVERY_BYTES) throw new Error('Recovery storage is full. Keep this tab open and save an editable file.');
  await store.put(metadata(row));
  await tx.objectStore('revision-recovery-payloads').put(row.data, row.id);
  await tx.objectStore('revision-usage').put(bytes, 'recovery');
}

export function createRevisionRecovery(db: IDBPDatabase): RecoveryStore {
  return {
    async write(record, options) {
      const snapshot = await revisionSnapshot(record.data);
      const refs = new Set<string>(); collectAssetRefs(snapshot.data, refs);
      const tx = db.transaction(STORES, 'readwrite'); void tx.done.catch(() => {});
      try {
        const docs = tx.objectStore('revision-documents');
        const doc = await docs.get(record.slot) as DocumentHead | undefined;
        const diverged = (doc?.head ?? null) !== options.expectedHead || documentVersion(doc) !== options.expectedVersion;
        const documentId = doc?.documentId ?? crypto.randomUUID(), version = crypto.randomUUID();
        const entry: RecoveryEntry = { id: options.writerId, slot: record.slot, documentId, version,
          baseHead: options.expectedHead, baseVersion: options.expectedVersion, diverged,
          toolId: record.toolId ?? '', label: record.label || record.toolId || 'Untitled', at: record.updatedAt,
          hash: snapshot.hash, bytes: snapshot.bytes, assetRefs: [...refs] };
        await putRecovery(tx, { ...entry, data: snapshot.data });
        if (!diverged) {
          await docs.put({ ...doc, slot: record.slot, documentId, head: doc?.head ?? null, hash: doc?.hash ?? null, version, workingHash: snapshot.hash });
          await writeCurrentState(tx, record, snapshot.data, documentId);
        }
        await tx.done;
        return entry;
      } catch (error) { try { tx.abort(); } catch { /* already aborted */ } throw error; }
    },
    // Imports and legacy state.save callers preserve the local working version
    // before replacement, and invalidate editors' compare-and-swap tokens.
    async replace(record) {
      const before = await db.get('revision-documents', record.slot) as DocumentHead | undefined;
      const beforeState = before ? await db.get('state', record.slot) as StateRecord | undefined : undefined;
      const snapshot = beforeState ? await revisionSnapshot(beforeState.data) : null;
      const tx = db.transaction(STORES, 'readwrite'); void tx.done.catch(() => {});
      try {
        const docs = tx.objectStore('revision-documents');
        const doc = await docs.get(record.slot) as DocumentHead | undefined;
        if (doc) {
          if (documentVersion(doc) !== documentVersion(before)) throw new Error('This document changed during replacement. Reopen it before trying again.');
          if (snapshot && JSON.stringify(canonicalRevisionData(record.data)) === JSON.stringify(snapshot.data)) {
            await tx.objectStore('state').put({ ...record, data: snapshot.data, documentId: doc.documentId });
            await tx.done; return;
          }
          const prior = await tx.objectStore('state').get(record.slot) as StateRecord | undefined;
          if (prior && snapshot) {
            const refs = new Set<string>(); collectAssetRefs(prior.data, refs);
            const version = documentVersion(doc);
            await putRecovery(tx, { id: `before-replacement:${doc.documentId}:${version}`, slot: record.slot, documentId: doc.documentId,
              version: version!, baseHead: doc.head, baseVersion: version, diverged: true, toolId: prior.toolId ?? '',
              label: prior.label || 'Before replacement', at: prior.updatedAt, data: snapshot.data,
              hash: snapshot.hash, bytes: snapshot.bytes, assetRefs: [...refs] });
          }
          await docs.put({ ...doc, version: crypto.randomUUID(), workingHash: '' });
        }
        await tx.objectStore('state').put({ ...record, ...(doc ? { documentId: doc.documentId } : {}) });
        await tx.done;
      } catch (error) { try { tx.abort(); } catch { /* already aborted */ } throw error; }
    },
    async clearCommitted(tx, slot, all = false) {
      const store = tx.objectStore('revision-recovery');
      let bytes = await tx.objectStore('revision-usage').get('recovery') ?? 0;
      for (const row of await store.index('slot').getAll(slot) as RecoveryRecord[]) {
        if (all || !row.diverged) { bytes -= row.bytes; await store.delete(row.id); await tx.objectStore('revision-recovery-payloads').delete(row.id); }
      }
      await tx.objectStore('revision-usage').put(bytes, 'recovery');
    },
    async list({ slot, before, limit = 30 } = {}) {
      const store = db.transaction('revision-recovery').store;
      const end = before ? JSON.parse(before) as [string, string] : ['\uffff', '\uffff'];
      const range = slot ? IDBKeyRange.bound([slot, '', ''], [slot, ...end], false, !!before) : IDBKeyRange.upperBound(end, !!before);
      let cursor = await store.index(slot ? 'slotTime' : 'time').openCursor(range, 'prev');
      const entries: RecoveryEntry[] = [];
      while (cursor && entries.length < Math.max(1, Math.min(100, limit))) {
        entries.push(metadata(cursor.value as RecoveryRecord)); cursor = await cursor.continue();
      }
      const last = entries.at(-1);
      return { entries, ...(cursor && last ? { before: JSON.stringify([last.at, last.id]) } : {}) };
    },
    async read(id) { return await db.get('revision-recovery-payloads', id) ?? null; },
    async assetRefs() {
      const refs = new Set<string>();
      let cursor = await db.transaction('revision-recovery').store.openCursor();
      while (cursor) { for (const ref of (cursor.value as RecoveryRecord).assetRefs) refs.add(ref); cursor = await cursor.continue(); }
      return refs;
    },
  };
}
