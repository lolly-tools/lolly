// SPDX-License-Identifier: MPL-2.0
import type { IDBPDatabase } from 'idb';
import type { RevisionEntry } from './revision-history.ts';
import type { SavedStateData } from './state.ts';
import { revisionSnapshot } from './revision-snapshot.ts';

/** Read metadata and payload from one snapshot. Hashing happens after the IDB
 * transaction completes; a failed read never repairs or deletes the evidence. */
export async function readRevision(db: IDBPDatabase, id: string): Promise<SavedStateData | null> {
  const tx = db.transaction(['revisions', 'revision-payloads']);
  const [entry, data] = await Promise.all([
    tx.objectStore('revisions').get(id) as Promise<RevisionEntry | undefined>,
    tx.objectStore('revision-payloads').get(id) as Promise<SavedStateData | undefined>,
  ]);
  await tx.done;
  if (!entry) return null;
  try {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    const snapshot = await revisionSnapshot(data);
    if (snapshot.hash !== entry.hash || snapshot.bytes !== entry.bytes) throw new Error();
    return snapshot.data;
  } catch {
    throw new Error('This version failed its integrity check. Its saved data has been kept.');
  }
}
