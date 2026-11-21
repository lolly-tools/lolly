// SPDX-License-Identifier: MPL-2.0
/**
 * The one way a session record is written or removed (plan 373).
 *
 * Three things must move together whenever a saved session changes: the record
 * in `state`, its lean row in `state-list` (what a list of sessions reads, with
 * no document and no picture), and its picture row in `preview-index`. Every
 * writer in the bridge (the state API, history commits, recovery drafts, moves,
 * discards, archive restores) goes through `putStateRecord` and
 * `deleteStateRecord` inside its own transaction, opened with `scopeFor`, so the
 * three commit together or not at all. A contract test keeps raw `state` writes
 * out of the rest of the bridge.
 *
 * On a database without the new stores (an upgrade that could not run), the same
 * calls write the record alone, with its picture as a data URL as before.
 */
import type { IDBPTransaction } from 'idb';
import { indexSavedWork } from './history-index.ts';
import type { StateRecord } from './state.ts';
import {
  STATE_LIST, bindOwner, isPrepared, releaseOwner, sessionOwner, txHasPreviews, putPictureBytes, dataUrlOfRow, PREVIEW_BLOBS,
  type PictureTx, type PreparedPicture, type PreviewBlobRow, type SessionPreviewRef,
} from './preview-store.ts';
import { readPreviewRef, pictureDataUrl } from '../../../../engine/src/session-preview.ts';

/** One row of `state-list`: what `list()` returns, read without opening the record. */
export interface StateListRow {
  slot: string;
  toolId: string;
  toolVersion: string;
  label?: string;
  filename: string | null;
  /** A legacy data URL, only for a record whose picture could not be moved into the
   *  preview store (it stays on the record and is read from there). */
  thumb: string | null;
  preview?: SessionPreviewRef;
  updatedAt: string;
  createdAt?: string;
  savedAt?: string;
  openedAt?: string;
  designSystem?: { id: string; label: string };
  /** The record still carries a `thumb` too large to copy into this row. */
  legacyThumb?: true;
  /** Rough stored size of the record without its picture, for `sizes()`. */
  bytes?: number;
}

/** Above this a legacy data URL is not copied into the lean row; the reader asks
 *  for the record instead. Small enough that a list of thousands stays light. */
const LEAN_THUMB_LIMIT = 2048;

/** Rough size of a record without its picture: what Settings > Storage shows for
 *  a session, measured when the record is written rather than on every list. */
export function recordBytes(record: StateRecord): number {
  try {
    const { thumb, preview: _ref, ...rest } = record;
    return JSON.stringify(rest).length + (typeof thumb === 'string' ? thumb.length : 0);
  } catch { return 0; }
}

/** The lean row for a record. */
export function leanRow(record: StateRecord, bytes = recordBytes(record)): StateListRow {
  const preview = readPreviewRef(record.preview);
  const thumb = typeof record.thumb === 'string' && record.thumb ? record.thumb : null;
  return {
    slot: record.slot,
    toolId: record.toolId ?? '',
    toolVersion: record.toolVersion ?? '',
    label: record.label,
    filename: (record.data?.__export_filename as string | undefined) || null,
    thumb: !preview && thumb && thumb.length <= LEAN_THUMB_LIMIT ? thumb : null,
    ...(preview ? { preview } : {}),
    ...(!preview && thumb && thumb.length > LEAN_THUMB_LIMIT ? { legacyThumb: true as const } : {}),
    updatedAt: record.updatedAt,
    ...(record.createdAt ? { createdAt: record.createdAt } : {}),
    ...(record.savedAt ? { savedAt: record.savedAt } : {}),
    ...(record.openedAt ? { openedAt: record.openedAt } : {}),
    ...(record.designSystem ? { designSystem: record.designSystem } : {}),
    ...(bytes > 0 ? { bytes } : {}),
  };
}

const inScope = (tx: PictureTx, name: string): boolean => tx.objectStoreNames.contains(name);
const dbHas = (tx: PictureTx, name: string): boolean => !!(tx.db as { objectStoreNames?: DOMStringList } | undefined)?.objectStoreNames?.contains(name);

/** Refuse a write whose transaction left out a store this database has: the lean
 *  row or the picture row would drift from the record. */
function checkScope(tx: PictureTx): void {
  for (const name of [STATE_LIST, 'preview-index', 'preview-blobs']) {
    if (dbHas(tx, name) && !inScope(tx, name)) throw new Error(`A session write must include ${name}; open it with scopeFor().`);
  }
}

/**
 * Write one session record with its lean row and picture row. A record that
 * carries a picture reference binds `session:<slot>` to the picture; one that carries none
 * releases the slot's row. A reference whose bytes are not here is dropped from
 * the record rather than kept pointing at nothing. `bytes` is the record's size
 * when the caller already measured it (a checkpoint knows its canonical length),
 * so a large document is not serialised a second time.
 */
export async function putStateRecord(tx: PictureTx, record: StateRecord, bytes?: number): Promise<StateRecord> {
  checkScope(tx);
  let next = record;
  if (txHasPreviews(tx)) {
    const ref = readPreviewRef(record.preview);
    if (ref) {
      const bound = await bindOwner(tx, sessionOwner(record.slot), 'session', ref);
      if (!bound) { const { preview: _gone, ...rest } = record; next = rest as StateRecord; }
    } else {
      if (record.preview !== undefined) { const { preview: _junk, ...rest } = record; next = rest as StateRecord; }
      await releaseOwner(tx, sessionOwner(record.slot));
    }
  }
  const indexed = indexSavedWork(next);
  await tx.objectStore('state').put(indexed);
  if (inScope(tx, STATE_LIST)) await tx.objectStore(STATE_LIST).put(leanRow(indexed, bytes ?? recordBytes(indexed)));
  return indexed;
}

/** Remove one session record with its lean row and picture row. */
export async function deleteStateRecord(tx: PictureTx, slot: string): Promise<void> {
  checkScope(tx);
  await tx.objectStore('state').delete(slot);
  if (inScope(tx, STATE_LIST)) await tx.objectStore(STATE_LIST).delete(slot);
  if (txHasPreviews(tx)) await releaseOwner(tx, sessionOwner(slot));
}

/**
 * A record with a picture applied, inside the caller's transaction. Prepared
 * bytes are stored and referenced, and the legacy `thumb` leaves the record; a
 * reference is kept when its bytes are here. On a database without the preview
 * stores the picture goes on the record as a data URL, as before plan 373.
 */
export async function withPicture(tx: PictureTx, record: StateRecord, picture: PreparedPicture | SessionPreviewRef): Promise<StateRecord> {
  const prepared = isPrepared(picture) ? picture : null;
  if (txHasPreviews(tx)) {
    const ref = prepared ? prepared.ref : picture as SessionPreviewRef;
    if (prepared) await putPictureBytes(tx, prepared);
    else if (!await tx.objectStore(PREVIEW_BLOBS).count(ref.key)) return record;
    const { thumb: _legacy, ...rest } = record;
    return { ...rest, thumb: null, preview: ref } as StateRecord;
  }
  if (prepared) return { ...record, thumb: pictureDataUrl(prepared.bytes, prepared.ref.type, prepared.form) };
  return record;
}

/** The picture a record shows, as a data URL, for a format that still carries one.
 *  Reads the stored bytes for a reference, or returns the legacy field. */
export async function recordDataUrl(tx: Pick<IDBPTransaction<unknown, string[], IDBTransactionMode>, 'objectStore' | 'objectStoreNames'>, record: Pick<StateRecord, 'preview' | 'thumb'>): Promise<string | null> {
  const ref = readPreviewRef(record.preview);
  if (ref && tx.objectStoreNames.contains(PREVIEW_BLOBS)) {
    const row = await tx.objectStore(PREVIEW_BLOBS).get(ref.key) as PreviewBlobRow | undefined;
    if (row) return dataUrlOfRow(row);
  }
  return typeof record.thumb === 'string' && record.thumb ? record.thumb : null;
}
