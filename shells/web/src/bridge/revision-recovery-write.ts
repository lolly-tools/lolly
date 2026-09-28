// SPDX-License-Identifier: MPL-2.0
import { indexSavedWork } from './history-index.ts';
/** Load recovery writes only when an author saves or replaces work. */
import type { IDBPDatabase } from 'idb';
import type { StateRecord } from './state.ts';
import { collectAssetRefs } from './asset-ref-collector.ts';
import { captureRevision } from './revision-capture.ts';
import { canonicalRevisionData, captureSnapshot, revisionSnapshot } from './revision-snapshot.ts';
import { noteWritten, relieveQuota, retryOnQuota, revisionBudgets, sweepOldDrafts, trimDrafts } from './revision-budget.ts';
import { t } from '../i18n.ts';
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
/**
 * Write one draft inside the budget (plan 277 P4 section 5): past the recovery
 * budget, protected drafts older than 30 days go first, oldest first; a protected
 * draft written here leaves its document with at most its three newest. With no
 * room even then, an editor's draft is refused; an `optional` draft (the copy a
 * save from outside the editor keeps of the state it replaces) is left out
 * instead, and false says so, because that save must never be refused.
 */
async function putRecovery(tx: RevisionTransaction, row: RecoveryRecord, budget: number, optional = false): Promise<boolean> {
  const store = tx.objectStore('revision-recovery');
  const old = (await store.get(row.id)) as RecoveryRecord | undefined;
  if (old && old.slot !== row.slot) throw new Error(t('A recovery writer cannot change documents.'));
  const usage = (await tx.objectStore('revision-usage').get('recovery')) ?? 0;
  let bytes = usage + row.bytes - (old?.bytes ?? 0);
  if (bytes > budget) bytes -= (await sweepOldDrafts(tx, bytes - budget, Date.now(), row.id)).freed;
  if (bytes > budget) {
    if (optional) {
      // The sweep's deletions still stand.
      await tx.objectStore('revision-usage').put(Math.max(0, bytes - row.bytes + (old?.bytes ?? 0)), 'recovery');
      return false;
    }
    throw new Error(t('Recovery storage is full. Keep this tab open and save an editable file.'));
  }
  const { data: _data, ...entry } = row;
  await store.put(entry);
  await tx.objectStore('revision-recovery-payloads').put(row.data, row.id);
  if (row.diverged) bytes -= (await trimDrafts(tx, row.slot, row.id)).freed;
  await tx.objectStore('revision-usage').put(Math.max(0, bytes), 'recovery');
  noteWritten(bytes - usage);
  return true;
}

export async function writeRecovery(
  db: IDBPDatabase,
  record: StateRecord,
  options: RecoveryOptions
): Promise<RecoveryEntry> {
  // A capture from the editor is canonical already, so it is hashed, not walked again.
  const snapshot = await captureSnapshot(options.capture ?? captureRevision(record.data));
  const refs = new Set<string>();
  collectAssetRefs(snapshot.data, refs);
  const { recovery: budget } = await revisionBudgets();
  return retryOnQuota(() => writeDraft(db, record, options, snapshot, [...refs], budget), () => freeDraftSpace(db));
}

/** After a QuotaExceededError, drop protected drafts older than 30 days before the one retry. */
async function freeDraftSpace(db: IDBPDatabase): Promise<void> {
  const tx = db.transaction(['revision-recovery', 'revision-recovery-payloads', 'revision-usage'], 'readwrite');
  const usage = (await tx.objectStore('revision-usage').get('recovery')) ?? 0;
  const { freed } = await sweepOldDrafts(tx, Infinity, Date.now());
  await tx.objectStore('revision-usage').put(Math.max(0, usage - freed), 'recovery');
  await tx.done;
  noteWritten(-freed);
}

async function writeDraft(
  db: IDBPDatabase,
  record: StateRecord,
  options: RecoveryOptions,
  snapshot: { data: StateRecord['data']; hash: string; bytes: number },
  refs: string[],
  budget: number
): Promise<RecoveryEntry> {
  const tx = db.transaction(STORES, 'readwrite');
  void tx.done.catch(() => {});
  try {
    const docs = tx.objectStore('revision-documents');
    const doc = (await docs.get(record.slot)) as DocumentHead | undefined;
    const diverged =
      options.branch === true ||
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
      assetRefs: refs,
    };
    await putRecovery(tx, { ...entry, data: snapshot.data }, budget);
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

/**
 * Imports, Sync, a Projects rename and state.save keep the prior working version
 * as a protected draft before replacing that version. The replacement is never
 * refused by history (plan 277 P4, review B2): a prior state history cannot
 * snapshot (too large, a temporary file) or has no room to keep is replaced
 * without a draft. So is one a revision already holds.
 */
export async function replaceRecovery(db: IDBPDatabase, record: StateRecord): Promise<void> {
  const before = (await db.get('revision-documents', record.slot)) as DocumentHead | undefined;
  const beforeState = before
    ? ((await db.get('state', record.slot)) as StateRecord | undefined)
    : undefined;
  const snapshot = beforeState ? await revisionSnapshot(beforeState.data).catch(() => null) : null;
  // A record history cannot canonicalise is never equal to the prior state.
  let incoming: string | null = null;
  try { incoming = snapshot ? JSON.stringify(canonicalRevisionData(record.data)) : null; } catch { incoming = null; }
  const { recovery: budget } = await revisionBudgets();
  // Out of device quota, history makes room (drafts, previews, unopened documents'
  // checkpoints) and the save is tried once more.
  await retryOnQuota(() => replaceOnce(db, record, before, snapshot, incoming, budget),
    async () => { await freeDraftSpace(db); await relieveQuota(db, new TextEncoder().encode(JSON.stringify(record.data)).byteLength, record.slot); });
}

async function replaceOnce(db: IDBPDatabase, record: StateRecord, before: DocumentHead | undefined,
  snapshot: { data: StateRecord['data']; hash: string; bytes: number } | null, incoming: string | null, budget: number): Promise<void> {
  const tx = db.transaction(STORES, 'readwrite');
  void tx.done.catch(() => {});
  try {
    const docs = tx.objectStore('revision-documents');
    const doc = (await docs.get(record.slot)) as DocumentHead | undefined;
    if (doc) {
      if (documentVersion(doc) !== documentVersion(before))
        throw new Error(t('This document changed during replacement. Reopen it before trying again.'));
      if (snapshot && incoming === JSON.stringify(snapshot.data)) {
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
      // The head or the last explicit save already holds the state being replaced.
      const held = !!snapshot && (snapshot.hash === doc.hash || snapshot.hash === doc.saved?.hash);
      if (prior && snapshot && !held) {
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
        }, budget, true);
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
