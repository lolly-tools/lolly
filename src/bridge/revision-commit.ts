// SPDX-License-Identifier: MPL-2.0
/** Checkpoint writes and compaction load on the first edit. Hashing and module
 * loading finish before the atomic storage transaction begins. */
import type { IDBPDatabase } from 'idb';
import type { RevisionEntry, RevisionOptions } from './revision-history.ts';
import type { RecoveryStore } from './revision-recovery.ts';
import type { StateRecord } from './state.ts';
import { MAX_REVISION_BYTES as MAX_BYTES } from './revision-limits.ts';
import { revisionSnapshot } from './revision-snapshot.ts';
import { pinRevisionAssets } from './revision-asset-pins.ts';
import { collectAssetRefs } from './asset-dependencies.ts';
import { REVISION_STORES as STORES, type DocumentHead, documentVersion, writeCurrentState } from './revision-records.ts';

/** Minute detail for an hour, hourly for a day, daily for a month, weekly after
 * that. Explicit saves are outside compaction. Keep the newest point per bucket. */
export function expiredAutomatic(entries: RevisionEntry[], now: number): RevisionEntry[] {
  const occupied = new Set<string>();
  return [...entries].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).filter(entry => {
    if (entry.reason !== 'automatic') return false;
    const at = Date.parse(entry.at), age = Math.max(0, now - at);
    const unit = age < 3_600_000 ? 60_000 : age < 86_400_000 ? 3_600_000 : age < 30 * 86_400_000 ? 86_400_000 : 7 * 86_400_000;
    const bucket = `${unit}:${Math.floor(at / unit)}`;
    if (occupied.has(bucket)) return true;
    occupied.add(bucket);
    return false;
  });
}

export async function commitRevision(db: IDBPDatabase, recovery: RecoveryStore, record: StateRecord, options: RevisionOptions): Promise<RevisionEntry & { currentVersion?: string }> {
  // Hash before opening IDB: awaiting crypto inside a transaction closes it.
  const snapshot = await revisionSnapshot(pinRevisionAssets(record.data));
  const assetRefs = new Set<string>();
  collectAssetRefs(snapshot.data, assetRefs);
  const tx = db.transaction(STORES, 'readwrite');
  const done = tx.done;
  // A deliberate abort must not become an unhandled tx.done rejection.
  void done.catch(() => {});
  try {
    const docs = tx.objectStore('revision-documents'), revisions = tx.objectStore('revisions');
    const prior = await docs.get(record.slot) as DocumentHead | undefined;
    if ((prior?.head ?? null) !== options.expectedHead || options.expectedVersion !== undefined && documentVersion(prior) !== options.expectedVersion) throw new Error('This document changed in another tab. Reopen it before saving more history.');
    if (prior?.head && prior.hash === snapshot.hash) {
      const existing = await revisions.get(prior.head) as RevisionEntry;
      if (options.reason === 'save' && existing.reason === 'automatic') {
        existing.reason = 'save';
        await revisions.put(existing);
      }
      const currentVersion = crypto.randomUUID();
      await docs.put({ ...prior, version: currentVersion, workingHash: snapshot.hash });
      await writeCurrentState(tx, record, snapshot.data, prior.documentId);
      await recovery.clearCommitted(tx, record.slot);
      await done;
      return { ...existing, currentVersion };
    }
    const documentId = prior?.documentId ?? crypto.randomUUID();
    const entry: RevisionEntry = {
      id: crypto.randomUUID(), documentId, slot: record.slot, parentId: prior?.head ?? null,
      toolId: record.toolId ?? '', label: record.label || record.toolId || 'Untitled',
      at: record.updatedAt, reason: options.reason, hash: snapshot.hash, bytes: snapshot.bytes, assetRefs: [...assetRefs],
      toolVersion: record.toolVersion, formatVersion: record.formatVersion,
      engineVersion: record.engineVersion, designSystem: record.designSystem,
    };
    const usage = (await tx.objectStore('revision-usage').get('total')) ?? { bytes: 0, previews: 0 };
    // Bounded automatic history per document; explicit saves are protected.
    // Retire only the oldest automatic checkpoints, never the new head.
    const range = IDBKeyRange.bound([documentId, 'automatic', '', ''], [documentId, 'automatic', '\uffff', '\uffff']);
    const old = await revisions.index('documentReason').getAll(range) as RevisionEntry[];
    for (const expired of expiredAutomatic([...old, entry], Date.parse(entry.at))) {
      if (expired.id === entry.id) continue;
      const preview = await tx.objectStore('revision-previews').get(expired.id) as string | undefined;
      usage.bytes -= expired.bytes;
      usage.previews -= preview ? new TextEncoder().encode(preview).byteLength : 0;
      await revisions.delete(expired.id);
      await tx.objectStore('revision-payloads').delete(expired.id);
      await tx.objectStore('revision-previews').delete(expired.id);
    }
    if (usage.bytes + snapshot.bytes > MAX_BYTES) throw new Error('History storage is full. Your previous checkpoints are safe; export an editable .lolly file.');
    usage.bytes += snapshot.bytes;
    await tx.objectStore('revision-usage').put(usage, 'total');
    await revisions.add(entry);
    await tx.objectStore('revision-payloads').add(snapshot.data, entry.id);
    await docs.put({ slot: record.slot, documentId, head: entry.id, hash: entry.hash, workingHash: entry.hash, version: entry.id });
    await writeCurrentState(tx, record, snapshot.data, documentId);
    await recovery.clearCommitted(tx, record.slot);
    await done;
    return entry;
  } catch (error) {
    try { tx.abort(); } catch { /* transaction already failed */ }
    throw error;
  }
}
