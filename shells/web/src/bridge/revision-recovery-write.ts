// SPDX-License-Identifier: MPL-2.0
import { MAX_RECOVERY_BYTES } from './revision-limits.ts';
import { indexSavedWork } from './history-index.ts';
/** Load recovery writes only when an author saves or replaces work. */
import type { IDBPDatabase } from 'idb';
import type { StateRecord } from './state.ts';
import { collectAssetRefs } from './asset-ref-collector.ts';
import { pinRevisionAssets } from './revision-asset-pins.ts';
import { canonicalRevisionData, revisionSnapshot } from './revision-snapshot.ts';
import {
  documentVersion,
  writeCurrentState,
  type DocumentHead,
  type RevisionTransaction,
} from './revision-records.ts';

import type { RecoveryOptions, RecoveryEntry, RecoveryRecord } from './revision-recovery.ts';

const STORES = [
  'state',
  'revision-documents',
  'revision-recovery',
  'revision-recovery-payloads',
  'revision-usage',
];
async function putRecovery(tx: RevisionTransaction, row: RecoveryRecord): Promise<void> {
  const store = tx.objectStore('revision-recovery');
  const old = (await store.get(row.id)) as RecoveryRecord | undefined;
  if (old && old.slot !== row.slot) throw new Error('A recovery writer cannot change documents.');
  const usage = (await tx.objectStore('revision-usage').get('recovery')) ?? 0;
  const bytes = usage + row.bytes - (old?.bytes ?? 0);
  if (bytes > MAX_RECOVERY_BYTES)
    throw new Error('Recovery storage is full. Keep this tab open and save an editable file.');
  const { data: _data, ...entry } = row;
  await store.put(entry);
  await tx.objectStore('revision-recovery-payloads').put(row.data, row.id);
  await tx.objectStore('revision-usage').put(bytes, 'recovery');
}

export async function writeRecovery(
  db: IDBPDatabase,
  record: StateRecord,
  options: RecoveryOptions
): Promise<RecoveryEntry> {
  const snapshot = await revisionSnapshot(pinRevisionAssets(record.data));
  const refs = new Set<string>();
  collectAssetRefs(snapshot.data, refs);
  const tx = db.transaction(STORES, 'readwrite');
  void tx.done.catch(() => {});
  try {
    const docs = tx.objectStore('revision-documents');
    const doc = (await docs.get(record.slot)) as DocumentHead | undefined;
    const diverged =
      (doc?.head ?? null) !== options.expectedHead ||
      documentVersion(doc) !== options.expectedVersion;
    const documentId = doc?.documentId ?? crypto.randomUUID(),
      version = crypto.randomUUID();
    const entry: RecoveryEntry = {
      id: options.writerId,
      slot: record.slot,
      documentId,
      version,
      baseHead: options.expectedHead,
      baseVersion: options.expectedVersion,
      diverged,
      toolId: record.toolId ?? '',
      label: record.label || record.toolId || 'Untitled',
      at: record.updatedAt,
      hash: snapshot.hash,
      bytes: snapshot.bytes,
      assetRefs: [...refs],
    };
    await putRecovery(tx, { ...entry, data: snapshot.data });
    if (!diverged) {
      await docs.put({
        ...doc,
        slot: record.slot,
        documentId,
        head: doc?.head ?? null,
        hash: doc?.hash ?? null,
        version,
        workingHash: snapshot.hash,
        // A document that recovery creates was never explicitly saved (plan 277 P1).
        ...(doc ? {} : { saved: null }),
      });
      await writeCurrentState(tx, record, snapshot.data, documentId);
    }
    await tx.done;
    return entry;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* already aborted */
    }
    throw error;
  }
}

// Imports and state.save preserve the prior working version before replacement.

export async function replaceRecovery(db: IDBPDatabase, record: StateRecord): Promise<void> {
  const before = (await db.get('revision-documents', record.slot)) as DocumentHead | undefined;
  const beforeState = before
    ? ((await db.get('state', record.slot)) as StateRecord | undefined)
    : undefined;
  const snapshot = beforeState ? await revisionSnapshot(beforeState.data) : null;
  const tx = db.transaction(STORES, 'readwrite');
  void tx.done.catch(() => {});
  try {
    const docs = tx.objectStore('revision-documents');
    const doc = (await docs.get(record.slot)) as DocumentHead | undefined;
    if (doc) {
      if (documentVersion(doc) !== documentVersion(before))
        throw new Error('This document changed during replacement. Reopen it before trying again.');
      if (
        snapshot &&
        JSON.stringify(canonicalRevisionData(record.data)) === JSON.stringify(snapshot.data)
      ) {
        await tx
          .objectStore('state')
          .put(indexSavedWork({ ...record, data: snapshot.data, documentId: doc.documentId }));
        // The same data saved from outside the editor is a save too: a state a
        // recovery draft wrote now counts as saved (plan 277 P1, review B1). The
        // version is kept, so an editor with this document open does not diverge.
        if (doc.workingHash !== '') await docs.put({ ...doc, workingHash: '' });
        await tx.done;
        return;
      }
      const prior = (await tx.objectStore('state').get(record.slot)) as StateRecord | undefined;
      if (prior && snapshot) {
        const refs = new Set<string>();
        collectAssetRefs(prior.data, refs);
        const version = documentVersion(doc);
        await putRecovery(tx, {
          id: `before-replacement:${doc.documentId}:${version}`,
          slot: record.slot,
          documentId: doc.documentId,
          version: version!,
          baseHead: doc.head,
          baseVersion: version,
          diverged: true,
          toolId: prior.toolId ?? '',
          label: prior.label || 'Before replacement',
          at: prior.updatedAt,
          data: snapshot.data,
          hash: snapshot.hash,
          bytes: snapshot.bytes,
          assetRefs: [...refs],
        });
      }
      await docs.put({ ...doc, version: crypto.randomUUID(), workingHash: '' });
    }
    await tx
      .objectStore('state')
      .put(indexSavedWork({ ...record, ...(doc ? { documentId: doc.documentId } : {}) }));
    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* already aborted */
    }
    throw error;
  }
}
