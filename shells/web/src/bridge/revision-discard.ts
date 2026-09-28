// SPDX-License-Identifier: MPL-2.0
/**
 * Leave without saving (plan 277 P1, Andy's decision of 27 September 2026): the
 * person means to throw the edits away. In the tools with automatic history,
 * recovery drafts and checkpoints have already written those edits into the saved
 * record, so leaving alone would keep them. This returns the document to its last
 * explicit save, or moves a creation that was never explicitly saved out of
 * Projects entirely (not to the trash). Either way the automatic checkpoints stay
 * in History, so a discard made by mistake can still be opened as a copy.
 *
 * Loaded only when someone leaves without saving; nothing here runs on boot.
 */
import type { IDBPDatabase } from 'idb';
import type { DiscardResult, RevisionEntry } from './revision-history.ts';
import type { RecoveryStore } from './revision-recovery.ts';
import type { StateRecord } from './state.ts';
import { type DocumentHead, type SavedPointer, documentVersion, holdsUnsavedWork, savedRevision } from './revision-records.ts';
import { indexSavedWork } from './history-index.ts';
import { readRevision } from './revision-read.ts';
import { MOVE_STORES, moveSlot, purgeDiscarded } from './revision-maintenance.ts';
import { discardedSlot } from '../lib/batch-slots.ts';

const CHANGED = 'This creation changed in another tab. Your edits were kept.';
/** A discard that could not run, with the reason the tool view tells the person. */
const refused = (message: string, reason: 'changed' | 'missing'): Error => Object.assign(new Error(message), { reason });

export async function discardUnsaved(db: IDBPDatabase, recovery: RecoveryStore, slot: string, now = Date.now()): Promise<DiscardResult> {
  const read = db.transaction(['state', 'revision-documents', 'revisions']);
  const doc = await read.objectStore('revision-documents').get(slot) as DocumentHead | undefined;
  const state = await read.objectStore('state').get(slot) as StateRecord | undefined;
  const saved = doc ? await savedRevision(read, doc) : null;
  await read.done;
  // No document means no automatic write ever happened; a state replaced from
  // outside the editor, or one equal to its last save, has nothing to undo.
  if (!doc || !state || !holdsUnsavedWork(doc, saved)) return { outcome: 'unchanged', slot };
  const version = documentVersion(doc);
  if (!saved) {
    const to = discardedSlot(slot, now);
    const tx = db.transaction(MOVE_STORES, 'readwrite');
    void tx.done.catch(() => {});
    try {
      const current = await tx.objectStore('revision-documents').get(slot) as DocumentHead | undefined;
      if (documentVersion(current) !== version) throw refused(CHANGED, 'changed');
      await moveSlot(tx, slot, to);
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* already aborted */ }
      throw error;
    }
    await purgeDiscarded(db, recovery, now).catch(() => { /* the next discard tries again */ });
    return { outcome: 'removed', slot: to };
  }
  // Verified before the write transaction opens: hashing inside one would close the transaction.
  const data = await readRevision(db, saved.id);
  const entry = await db.get('revisions', saved.id) as RevisionEntry | undefined;
  if (!data || !entry) throw refused('The last saved version is no longer available. Your edits were kept.', 'missing');
  const preview = await db.get('revision-previews', saved.id) as string | undefined;
  const tx = db.transaction(['state', 'revision-documents', 'revision-recovery'], 'readwrite');
  void tx.done.catch(() => {});
  try {
    const current = await tx.objectStore('revision-documents').get(slot) as DocumentHead | undefined;
    const record = await tx.objectStore('state').get(slot) as StateRecord | undefined;
    if (!current || !record || documentVersion(current) !== version) throw refused(CHANGED, 'changed');
    // The discarded edits' drafts become a separate branch, so the next checkpoint
    // here does not clear them: History keeps them even when checkpoints were paused.
    const drafts = tx.objectStore('revision-recovery');
    for (const draft of await drafts.index('slot').getAll(slot) as Array<{ id: string; diverged: boolean }>)
      if (!draft.diverged) await drafts.put({ ...draft, diverged: true });
    await tx.objectStore('state').put(indexSavedWork(restoredRecord(record, data, entry, saved, current.saved !== undefined, preview)));
    // The saved revision becomes the head again. The discarded checkpoints keep
    // their place in the document's history; the next checkpoint follows the save.
    await tx.objectStore('revision-documents').put({ ...current, head: entry.id, hash: entry.hash, workingHash: entry.hash,
      version: crypto.randomUUID() });
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* already aborted */ }
    throw error;
  }
  return { outcome: 'restored', slot };
}

/**
 * The saved record in the state the last explicit save wrote. The revision holds the data
 * and the save's stamps; the pointer holds the emoji set and licence choices a
 * revision payload does not. A pointer recovered from an older document (`known`
 * false) cannot say which set was chosen, so the current one stays.
 */
export function restoredRecord(record: StateRecord, data: StateRecord['data'], entry: RevisionEntry, saved: SavedPointer,
  known: boolean, preview: string | undefined): StateRecord {
  const { emoji, rightsDecisions, designSystem: _drop, ...rest } = record;
  const stamps = known ? saved : { emoji, rightsDecisions };
  return {
    ...rest,
    data,
    toolId: typeof data.__toolId === 'string' ? data.__toolId : record.toolId,
    toolVersion: typeof data.__toolVersion === 'string' ? data.__toolVersion : record.toolVersion,
    label: typeof data.__label === 'string' ? data.__label : undefined,
    thumb: preview ?? null,
    updatedAt: entry.at,
    formatVersion: entry.formatVersion ?? record.formatVersion,
    engineVersion: entry.engineVersion ?? record.engineVersion,
    ...(entry.designSystem ? { designSystem: entry.designSystem } : {}),
    ...(stamps.emoji ? { emoji: stamps.emoji } : {}),
    ...(stamps.rightsDecisions ? { rightsDecisions: stamps.rightsDecisions } : {}),
  };
}
