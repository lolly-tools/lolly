// SPDX-License-Identifier: MPL-2.0
/** Rolling writer drafts. IndexedDB replaces a generation atomically, leaving
 * the preceding generation intact on failure. No previews or timeline rows. */
import type { IDBPDatabase } from 'idb';
import type { SavedStateData, StateRecord } from './state.ts';
import type { RevisionTransaction } from './revision-records.ts';
import type { RevisionCapture } from './revision-capture.ts';

export interface RecoveryOptions {
  writerId: string; expectedHead: string | null; expectedVersion: string | null;
  /** The editor's frozen, canonical document; the store hashes it without walking it again. */
  capture?: RevisionCapture;
  /** Keep this draft as a protected branch beside the current state, never over
   * it: the state holds an explicit save that history could not record yet. */
  branch?: boolean;
}
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

function metadata({ data: _data, ...entry }: RecoveryRecord): RecoveryEntry { return entry; }

export function createRevisionRecovery(db: IDBPDatabase): RecoveryStore {
  return {
    write: async (record, options) => (await import('./revision-recovery-write.ts')).writeRecovery(db, record, options),
    replace: async record => (await import('./revision-recovery-write.ts')).replaceRecovery(db, record),
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
