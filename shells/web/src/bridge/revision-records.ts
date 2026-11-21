// SPDX-License-Identifier: MPL-2.0
import type { IDBPTransaction } from 'idb';
import type { SavedStateData, StateRecord } from './state.ts';
import { putStateRecord } from './state-rows.ts';
import { revisionOwner, txHasPreviews, ownerRef, ownerSize, releaseOwner, type PictureTx } from './preview-store.ts';

/** The stores a history write names. Open a write with `scopeFor(db, ...)`
 *  (preview-store.ts), which adds the lean list and the preview stores where this
 *  database has them, so a session record and its picture commit together.
 *  `revision-previews` is the pre-373 store of History pictures as data URLs: new
 *  pictures go to the preview store, and this one is read until its last entry has
 *  moved (bridge/state-list.ts). */
export const REVISION_STORES = ['state', 'revision-documents', 'revisions', 'revision-payloads', 'revision-previews', 'revision-usage', 'revision-recovery', 'revision-recovery-payloads'];
export interface DocumentHead {
  slot: string;
  documentId: string;
  head: string | null;
  hash: string | null;
  /** Each successful current-state write changes this token, including recovery. */
  version?: string;
  /** Hash of the data the current state holds. An empty string means a save from
   * outside the editor (Projects, an import, a sync) replaced the state, so no
   * revision holds it yet. */
  workingHash?: string;
  /** The last explicit save (plan 277 P1): the revision that Save as, the export
   * panel's Save or Save & leave wrote, or a saved state an editor adopted when it
   * opened. `null` means only recovery and automatic checkpoints ever wrote this
   * document. Absent on documents written before this was kept; savedRevision()
   * then falls back to the newest 'save' revision. */
  saved?: SavedPointer | null;
}
/** What Leave without saving restores. The revision holds the data; the stamps
 * are the parts of the saved record a revision payload does not carry. */
export interface SavedPointer {
  id: string;
  hash: string;
  emoji?: StateRecord['emoji'];
  rightsDecisions?: StateRecord['rightsDecisions'];
}
export interface RevisionCursor {
  head: string | null;
  version: string | null;
  /** The document's workingHash when the editor opened: `''` asks the editor to
   * adopt the replaced state as a saved revision before it writes anything. */
  workingHash?: string | null;
  /** The opened state differs from the last explicit save, or was never saved. */
  unsaved?: boolean;
  /** The current state counts as saved but no revision is recorded as its last
   * explicit save (saved outside the editor, or a document from before the saved
   * pointer existed): the editor records it before the first edit. */
  adopt?: boolean;
  /** Never explicitly saved: Leave without saving would take it out of Projects. */
  neverSaved?: boolean;
}
export function documentVersion(doc?: DocumentHead): string | null { return doc?.version ?? doc?.head ?? null; }
export type RevisionTransaction = IDBPTransaction<unknown, string[], 'readwrite'>;
/** Any transaction that can read `revisions`, read-only or not. */
type RevisionReader = Pick<IDBPTransaction<unknown, string[], IDBTransactionMode>, 'objectStore'>;

export function savedPointer(entry: { id: string; hash: string }, record: Pick<StateRecord, 'emoji' | 'rightsDecisions'>): SavedPointer {
  return { id: entry.id, hash: entry.hash, ...(record.emoji ? { emoji: record.emoji } : {}),
    ...(record.rightsDecisions ? { rightsDecisions: record.rightsDecisions } : {}) };
}

/** The document's last explicit save, or null when it has none. A document from
 * before `saved` existed reads its newest 'save' revision instead; its current
 * state counts as saved anyway (holdsUnsavedWork), so that answer is informational. */
export async function savedRevision(tx: RevisionReader, doc: DocumentHead): Promise<SavedPointer | null> {
  if (doc.saved !== undefined) return doc.saved;
  const range = IDBKeyRange.bound([doc.documentId, 'save', '', ''], [doc.documentId, 'save', '\uffff', '\uffff']);
  const cursor = await tx.objectStore('revisions').index('documentReason').openCursor(range, 'prev');
  const entry = cursor?.value as { id: string; hash: string } | undefined;
  return entry ? { id: entry.id, hash: entry.hash } : null;
}

/** True when the current state is not the last explicit save. A state replaced
 * from outside the editor counts as saved, because no editor wrote that state. So
 * does the state of a document from before the saved pointer existed (review B7):
 * its owner knew it as saved work in Projects, and it must never read as unsaved
 * or leave Projects on a Leave without saving. New work records `saved: null`. */
export function holdsUnsavedWork(doc: DocumentHead | undefined, saved: SavedPointer | null): boolean {
  if (!doc || doc.workingHash === '' || doc.saved === undefined) return false;
  return (doc.workingHash ?? doc.hash) !== (saved?.hash ?? null);
}

/** The current state counts as saved but is not yet recorded as the last explicit
 * save, so an opening editor adopts it (see RevisionCursor.adopt). */
export function needsAdopt(doc: DocumentHead | undefined): boolean {
  return !!doc && (doc.workingHash === '' || doc.saved === undefined);
}

/** Write a draft's or checkpoint's data as the current state. The Projects tile
 * keeps the picture it had until the checkpoint's own capture replaces it
 * (attachPreview): a capture that never arrives (the tool closed first, a busy
 * tab) must not leave the tile blank. */
export async function writeCurrentState(tx: RevisionTransaction, record: StateRecord, data: SavedStateData, documentId: string, bytes?: number): Promise<void> {
  const state = tx.objectStore('state');
  const prior = await state.get(record.slot) as StateRecord | undefined;
  await putStateRecord(tx, { ...withoutPicture(record), ...pictureOf(prior), data, documentId, openedAt: prior?.openedAt, createdAt: prior?.createdAt ?? record.createdAt }, bytes);
}

/** A record's picture fields, to carry onto the next record. */
export function pictureOf(record: Pick<StateRecord, 'thumb' | 'preview'> | undefined): Pick<StateRecord, 'thumb' | 'preview'> {
  return { thumb: record?.preview ? null : record?.thumb ?? null, ...(record?.preview ? { preview: record.preview } : {}) };
}

/** A record without its picture fields. */
export function withoutPicture<T extends Pick<StateRecord, 'thumb' | 'preview'>>(record: T): Omit<T, 'preview'> & { thumb: null } {
  const { preview: _ref, ...rest } = record;
  return { ...rest, thumb: null };
}

/** The bytes a revision's picture counts against the History preview budget: the
 *  stored picture's size, or the legacy data URL's text size before it moved. */
export async function revisionPreviewSize(tx: RevisionTransaction, id: string): Promise<number> {
  const moved = await ownerSize(tx, revisionOwner(id));
  if (moved) return moved;
  const legacy = await tx.objectStore('revision-previews').get(id) as string | undefined;
  return typeof legacy === 'string' ? new TextEncoder().encode(legacy).byteLength : 0;
}

/** Whether a revision holds a picture in either form. */
export async function revisionHasPreview(tx: RevisionTransaction, id: string): Promise<boolean> {
  if (txHasPreviews(tx) && await ownerRef(tx, revisionOwner(id))) return true;
  return !!await tx.objectStore('revision-previews').get(id);
}

/** Remove a revision's picture in both forms and return the bytes it counted. */
export async function dropRevisionPreview(tx: RevisionTransaction, id: string): Promise<number> {
  const size = await revisionPreviewSize(tx, id);
  if (txHasPreviews(tx)) await releaseOwner(tx as unknown as PictureTx, revisionOwner(id));
  await tx.objectStore('revision-previews').delete(id);
  return size;
}
