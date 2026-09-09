// SPDX-License-Identifier: MPL-2.0
/** User-triggered History maintenance stays off the gallery boot path. All
 * transactions begin after this module loads; no live transaction crosses it. */
import type { IDBPDatabase } from 'idb';
import type { RevisionEntry, RevisionStore } from './revision-history.ts';
import type { RecoveryStore } from './revision-recovery.ts';
import type { StateRecord } from './state.ts';
import { REVISION_STORES as STORES, type DocumentHead } from './revision-records.ts';
import { indexSavedWork } from './history-index.ts';
import { MAX_REVISION_PREVIEWS as MAX_PREVIEWS } from './revision-limits.ts';
import { collectAssetRefs } from './asset-dependencies.ts';
import { isHiddenSlot } from '../lib/batch-slots.ts';

export function revisionMaintenance(db: IDBPDatabase, recovery: RecoveryStore): Pick<RevisionStore, 'move' | 'delete' | 'recentSessions' | 'name' | 'attachPreview' | 'assetRefs'> {
  return {
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
    async name(id, name) {
      const label = name.trim();
      if (!label || label.length > 120) throw new Error('Use a milestone name between 1 and 120 characters.');
      const tx = db.transaction('revisions', 'readwrite');
      const entry = await tx.store.get(id) as RevisionEntry | undefined;
      if (!entry) throw new Error('This version is no longer available.');
      // Promote the existing checkpoint, preserving identity, payload, head
      // and working state. Named versions are excluded from automatic thinning.
      await tx.store.put({ ...entry, reason: 'save', milestone: label }); await tx.done;
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
      await tx.objectStore('state').put(indexSavedWork({ ...state, slot: to }));
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
    async recentSessions() {
      const result: Array<{ slot: string; toolId: string; label?: string; filename?: string; updatedAt: string }> = [];
      let cursor = await db.transaction('state').store.index('updatedAt').openCursor(undefined, 'prev');
      while (cursor && result.length < 12) {
        const row = cursor.value as StateRecord;
        if (!isHiddenSlot(row.slot)) result.push({ slot: row.slot, toolId: row.toolId ?? '', label: row.label, filename: row.data.__export_filename, updatedAt: row.updatedAt });
        cursor = await cursor.continue();
      }
      return result;
    },
  };
}
