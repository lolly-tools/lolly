// SPDX-License-Identifier: MPL-2.0
/** User-triggered History maintenance stays off the gallery boot path. All
 * transactions begin after this module loads; no live transaction crosses it. */
import type { IDBPDatabase } from 'idb';
import type { RevisionEntry, RevisionStore } from './revision-history.ts';
import type { RecoveryStore } from './revision-recovery.ts';
import type { StateRecord } from './state.ts';
import { REVISION_STORES as STORES, type DocumentHead, type RevisionTransaction } from './revision-records.ts';
import { indexSavedWork } from './history-index.ts';
import { collectAssetRefs } from './asset-ref-collector.ts';
import { DISCARDED_SLOT_PREFIX, DISCARD_RETENTION_MS, discardedAt, isHiddenSlot } from '../lib/batch-slots.ts';
import {
  EVICTIONS_PER_WRITE, EVICT_AT, EVICT_TO, RELIEF_STORES, evictPreviews, keptRevisions, noteWritten, readUsage, retireRevision,
  revisionBudgets, sweepDrafts, writeUsage,
} from './revision-budget.ts';

/** A preview History keeps: a small raster data URL. */
const KEEPABLE_PREVIEW = /^data:image\/(png|jpeg|webp);base64,/;
/** A picture the Projects tile may show: any image data URL, as a save writes one. */
const TILE_PICTURE = /^data:image\//;

/** Automatic checkpoints older than this are what Settings > Storage offers to remove. */
export const PRUNE_AGE_MS = 30 * 86_400_000;
/** Checkpoints one pruning transaction retires; the prune runs as many as it needs. */
const PRUNE_BATCH = 200;

/** The stores a slot move touches; a caller that checks more first opens these. */
export const MOVE_STORES = ['state', 'revision-documents', 'revisions', 'revision-recovery'];

/** Move a document with its whole history to another slot, inside `tx`. Trash,
 * undo and Leave without saving (plan 277 P1) all move this way. */
export async function moveSlot(tx: RevisionTransaction, from: string, to: string): Promise<void> {
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
}

/** Discarded creations keep their history for DISCARD_RETENTION_MS, as the trash
 * does, then go for good: on a later discard, and when History opens. */
export async function purgeDiscarded(db: IDBPDatabase, recovery: RecoveryStore, now: number): Promise<number> {
  const slots = await db.getAllKeys('state', IDBKeyRange.bound(DISCARDED_SLOT_PREFIX, `${DISCARDED_SLOT_PREFIX}\uffff`)) as string[];
  const maintenance = revisionMaintenance(db, recovery);
  let removed = 0;
  for (const slot of slots) {
    const at = discardedAt(slot);
    if (at !== null && now - at > DISCARD_RETENTION_MS) { await maintenance.delete(slot); removed++; }
  }
  return removed;
}

export function revisionMaintenance(db: IDBPDatabase, recovery: RecoveryStore): Pick<RevisionStore, 'move' | 'delete' | 'recentSessions' | 'name' | 'attachPreview' | 'assetRefs' | 'sweep' | 'pruneAutomatic'> {
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
      const keepable = KEEPABLE_PREVIEW.test(thumb) && thumb.length <= 256 * 1024;
      if (!keepable && !TILE_PICTURE.test(thumb)) return;
      const budgets = await revisionBudgets();
      const tx = db.transaction(RELIEF_STORES, 'readwrite');
      const row = await tx.objectStore('revisions').get(id) as RevisionEntry | undefined;
      if (!row) return;
      const previews = tx.objectStore('revision-previews');
      const prior = await previews.get(id) as string | undefined;
      const usage = await readUsage(tx);
      const before = usage.previews;
      const size = new TextEncoder().encode(thumb).byteLength, priorSize = prior ? new TextEncoder().encode(prior).byteLength : 0;
      // Previews are the budget that fills first (plan 277 P4 section 5): past 90 %,
      // older automatic checkpoints give up their previews, down to 85 %, before
      // this one is refused.
      if (keepable && usage.previews + size - priorSize > EVICT_AT * budgets.previews) {
        const kept = await keptRevisions(tx); kept.add(id);
        await evictPreviews(tx, usage, usage.previews + size - priorSize - EVICT_TO * budgets.previews, kept, EVICTIONS_PER_WRITE);
      }
      // A preview that still does not fit, or is too big to keep, is skipped:
      // text-only history stays usable.
      if (keepable && usage.previews + size - priorSize <= budgets.previews) {
        await previews.put(thumb, id);
        usage.previews += size - priorSize;
      }
      await writeUsage(tx, usage);
      // The Projects tile is not history: it gets its picture whether or not the
      // preview was kept.
      const head = await tx.objectStore('revision-documents').get(row.slot) as DocumentHead | undefined;
      const state = await tx.objectStore('state').get(row.slot) as StateRecord | undefined;
      if (state && head?.head === id && (head.workingHash ?? head.hash) === row.hash && state.documentId === row.documentId) await tx.objectStore('state').put({ ...state, thumb });
      await tx.done;
      noteWritten(usage.previews - before);
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
      const tx = db.transaction(MOVE_STORES, 'readwrite');
      await moveSlot(tx, from, to);
      await tx.done;
    },
    async delete(slot) {
      const tx = db.transaction(STORES, 'readwrite');
      const doc = await tx.objectStore('revision-documents').get(slot) as DocumentHead | undefined;
      if (doc) {
        const usage = await tx.objectStore('revision-usage').get('total') ?? { bytes: 0, previews: 0 };
        for (const row of await tx.objectStore('revisions').index('documentId').getAll(doc.documentId) as RevisionEntry[]) {
          const preview = await tx.objectStore('revision-previews').get(row.id) as string | undefined;
          usage.bytes -= row.stored ?? row.bytes;
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
    async sweep() {
      const now = Date.now();
      const discarded = await purgeDiscarded(db, recovery, now);
      const drafts = await sweepDrafts(db, now);
      return { discarded, drafts };
    },
    async pruneAutomatic() {
      const cutoff = new Date(Date.now() - PRUNE_AGE_MS).toISOString();
      let removed = 0, bytes = 0;
      for (;;) {
        const tx = db.transaction(RELIEF_STORES, 'readwrite');
        const usage = await readUsage(tx), kept = await keptRevisions(tx);
        const before = usage.bytes + usage.previews;
        let batch = 0;
        let cursor = await tx.objectStore('revisions').index('time').openCursor(IDBKeyRange.upperBound([cutoff]));
        while (cursor && batch < PRUNE_BATCH) {
          const row = cursor.value as RevisionEntry;
          if (row.reason === 'automatic' && !kept.has(row.id)) { await retireRevision(tx, usage, row); batch++; }
          cursor = await cursor.continue();
        }
        await writeUsage(tx, usage);
        await tx.done;
        const freed = before - (usage.bytes + usage.previews);
        noteWritten(-freed);
        removed += batch; bytes += freed;
        if (batch < PRUNE_BATCH) return { removed, bytes };
      }
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
