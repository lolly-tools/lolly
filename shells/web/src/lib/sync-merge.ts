// SPDX-License-Identifier: MPL-2.0
/**
 * sync-merge (plans/138 B2) - the three-way decision per-record sync makes for
 * each record. Pure: no storage, no clock, no network, so every case is a plain
 * unit test.
 *
 * Three versions of a record meet:
 *   - here: its content hash on this device now, or null when it is not here;
 *   - base: what this device and the store held when this device last synced
 *     (kept on this device, never synced): the store's hash then, and this
 *     device's own hash just after that sync;
 *   - store: the index entry now, which may be a tombstone.
 *
 * A side "changed" when it differs from the base. One side changed: take that side.
 * Neither: nothing to do. Both, to the same content: nothing to do. Both, to
 * different content, is a conflict, and the rule follows lolly-work's (plans/138
 * D.1): nothing is lost.
 *   - Edited on both sides: 'resolve', for the caller to settle per record kind
 *     (a newer-wins with a conflict copy, or a field merge).
 *   - Edited here and deleted in the store: the edit is kept and goes back to
 *     the store.
 *   - Deleted here and edited in the store: the edited copy comes back here.
 *
 * Without a base (the first sync with this store, or a store that was replaced),
 * every record on either side counts as new, so the two sides merge and nothing
 * is removed, with one exception: a record here whose content matches a store
 * tombstone exactly is the item someone deleted, so it goes here too and is not
 * brought back.
 */

/** One record in the store's index. */
export interface IndexEntry {
  /** SHA-256 of the record body: its identity, compared for equality only. A
   *  tombstone keeps the hash of the content it replaced. */
  hash: string;
  /** The store object holding the body. Absent on a tombstone. */
  object?: string;
  /** The objects holding the binary parts the body names, by content digest. */
  parts?: Record<string, string>;
  /** Bytes of the body and its parts, for the status line. */
  size: number;
  /** When a device wrote this entry. */
  updatedAt: string;
  /** Set on a tombstone: when the record was deleted. */
  deletedAt?: string;
  /** The label of the device that wrote this entry, for display only. */
  writtenBy?: string;
}

/** What this device knew about one record at its last sync. */
export interface BaseEntry {
  /** The store's hash then; null when the store held a tombstone or nothing. */
  remote: string | null;
  /** This device's hash just after that sync; null when the record was not here. */
  local: string | null;
}

export type DecisionAction =
  /** Nothing to change on either side. */
  | 'keep'
  /** Send this device's record to the store. */
  | 'push'
  /** Write a tombstone: this device deleted the record. */
  | 'tombstone'
  /** Write the store's record on this device. */
  | 'pull'
  /** Remove the record from this device: it was deleted elsewhere. */
  | 'drop'
  /** Edited on both sides to different content: the caller settles it per kind. */
  | 'resolve';

export interface Decision {
  action: DecisionAction;
  /** Set when an edit met a delete: which side the edit was on. Counted as a conflict. */
  editMetDelete?: 'here' | 'store';
}

export interface ClassifyInput {
  /** This device's hash for the record, or null. */
  here: string | null;
  /** The base entry; undefined when the base has none for this record. */
  base: BaseEntry | undefined;
  /** The store's entry, tombstone included; undefined when the index has none. */
  store: IndexEntry | undefined;
  /** False for a first sync with this store: every record counts as new. */
  hasBase: boolean;
  /** Records that are never deleted (the profile record): an absent copy here
   *  means "nothing written yet", not "deleted". */
  neverDeleted?: boolean;
}

const liveHash = (entry: IndexEntry | undefined): string | null => (entry && !entry.deletedAt ? entry.hash : null);

/** The decision for one record. */
export function classify({ here, base, store, hasBase, neverDeleted = false }: ClassifyInput): Decision {
  const storeNow = liveHash(store);
  // The record someone deleted, still here with exactly the deleted content: when
  // this device has no say from a base, the deletion stands.
  if (here !== null && store?.deletedAt && store.hash === here && (!hasBase || !base)) return { action: 'drop' };

  const baseStore = hasBase ? base?.remote ?? null : null;
  const baseHere = hasBase ? base?.local ?? null : null;
  const hereNow = here === null && neverDeleted ? baseHere : here;

  const hereChanged = hereNow !== baseHere;
  const storeChanged = storeNow !== baseStore;
  if (hereNow === storeNow || (!hereChanged && !storeChanged)) return { action: 'keep' };
  if (!hereChanged) return { action: storeNow === null ? 'drop' : 'pull' };
  if (!storeChanged) return { action: hereNow === null ? 'tombstone' : 'push' };
  // Both sides changed, to different content.
  if (hereNow !== null && storeNow === null) return { action: 'push', editMetDelete: 'here' };
  if (hereNow === null && storeNow !== null) return { action: 'pull', editMetDelete: 'store' };
  return { action: 'resolve' };
}

/**
 * "Replace the synced copy with this device": every record here goes to the
 * store, and every live record the store holds that is not here gets a
 * tombstone, so the other devices remove it too rather than bringing it back.
 */
export function classifyForced(here: string | null, store: IndexEntry | undefined): Decision {
  const storeNow = liveHash(store);
  if (here !== null) return { action: storeNow === here ? 'keep' : 'push' };
  return { action: storeNow === null ? 'keep' : 'tombstone' };
}
