// SPDX-License-Identifier: MPL-2.0
/** Checkpoint writes and compaction load on the first edit. Hashing, the quota
 * reading and module loading finish before the atomic storage transaction begins. */
import type { IDBPDatabase } from 'idb';
import type { CommitResult, RevisionEntry, RevisionOptions } from './revision-history.ts';
import type { RecoveryStore } from './revision-recovery.ts';
import type { StateRecord } from './state.ts';
import { packCapture, type PackedRevisionSnapshot } from './revision-snapshot.ts';
import { captureRevision } from './revision-capture.ts';
import { collectAssetRefs } from './asset-ref-collector.ts';
import { REVISION_STORES as STORES, type DocumentHead, type RevisionTransaction, documentVersion, savedPointer, writeCurrentState } from './revision-records.ts';
import { indexSavedWork } from './history-index.ts';
import {
  DELETIONS_PER_WRITE, EVICTIONS_PER_WRITE, EVICT_AT, EVICT_TO, evictUnopened, keptRevisions, noteWritten, planThinning, plannedBytes,
  quotaLow, readUsage, relieveQuota, retireRevision, retryOnQuota, revisionBudgets, writeUsage, type RevisionBudgets,
} from './revision-budget.ts';
import { t } from '../i18n.ts';
export { expiredAutomatic } from './revision-budget.ts';

// Translated when thrown, not when this module loads: the locale arrives later.
const FULL = (): string => t('History storage is full. Your previous checkpoints are safe; export an editable .lolly file.');
const CHANGED = (): string => t('This document changed in another tab. Reopen it before saving more history.');

export async function commitRevision(db: IDBPDatabase, recovery: RecoveryStore, record: StateRecord, options: RevisionOptions): Promise<CommitResult> {
  // Hash before opening IDB: awaiting crypto inside a transaction closes it. A
  // capture from the editor is canonical already, so it is not walked again.
  const snapshot = await packCapture(options.capture ?? captureRevision(record.data));
  const assetRefs = new Set<string>();
  collectAssetRefs(snapshot.data, assetRefs);
  const budgets = await revisionBudgets();
  const low = await quotaLow(snapshot.stored);
  return retryOnQuota(
    () => commitOnce(db, recovery, record, options, snapshot, [...assetRefs], budgets, low),
    () => relieveQuota(db, snapshot.stored, record.slot),
  );
}

async function commitOnce(db: IDBPDatabase, recovery: RecoveryStore, record: StateRecord, options: RevisionOptions,
  snapshot: PackedRevisionSnapshot, assetRefs: string[], budgets: RevisionBudgets, low: boolean): Promise<CommitResult> {
  const tx = db.transaction(STORES, 'readwrite');
  const done = tx.done;
  // A deliberate abort must not become an unhandled tx.done rejection.
  void done.catch(() => {});
  // A refused automatic checkpoint still commits the room eviction made for it, so
  // the next write starts from there instead of evicting the same rows again.
  let committed = false;
  try {
    const docs = tx.objectStore('revision-documents'), revisions = tx.objectStore('revisions');
    const prior = await docs.get(record.slot) as DocumentHead | undefined;
    if ((prior?.head ?? null) !== options.expectedHead || options.expectedVersion !== undefined && documentVersion(prior) !== options.expectedVersion) throw new Error(CHANGED());
    // An adopted state keeps its own record: its save time and stamps describe that state.
    const adopted = options.adopt ? await tx.objectStore('state').get(record.slot) as StateRecord | undefined : undefined;
    const stamps = adopted ?? record;
    // The head already holds this content: no new revision. A head that is missing
    // (a store damaged before this rule existed) is written again as a new one.
    const existing = prior?.head && prior.hash === snapshot.hash ? await revisions.get(prior.head) as RevisionEntry | undefined : undefined;
    if (prior && existing) {
      if (options.reason === 'save' && existing.reason === 'automatic') {
        existing.reason = 'save';
        await revisions.put(existing);
      }
      const currentVersion = crypto.randomUUID();
      await docs.put({ ...prior, version: currentVersion, workingHash: snapshot.hash,
        ...(options.reason === 'save' ? { saved: savedPointer(existing, stamps) } : {}) });
      if (options.adopt) await adoptState(tx, adopted, prior.documentId, existing.id, budgets);
      else {
        await writeCurrentState(tx, record, snapshot.data, prior.documentId);
        await recovery.clearCommitted(tx, record.slot);
      }
      await done;
      return { ...existing, currentVersion };
    }
    const documentId = prior?.documentId ?? crypto.randomUUID();
    const entry: RevisionEntry = {
      id: crypto.randomUUID(), documentId, slot: record.slot, parentId: prior?.head ?? null,
      toolId: record.toolId ?? '', label: record.label || record.toolId || 'Untitled',
      at: adopted?.updatedAt ?? record.updatedAt, reason: options.reason, hash: snapshot.hash, bytes: snapshot.bytes, stored: snapshot.stored, assetRefs,
      toolVersion: record.toolVersion, formatVersion: record.formatVersion,
      engineVersion: record.engineVersion, designSystem: record.designSystem,
    };
    const usage = await readUsage(tx);
    const before = usage.bytes + usage.previews;
    // Bounded automatic history per document (revision-budget.ts): the usual
    // buckets, then the per-document cap. Planned now, applied only once this
    // checkpoint is sure to be written. The document's head and its last explicit
    // save are never retired, so a skipped save cannot leave the head dangling.
    const own = await revisions.index('documentId').getAll(documentId) as RevisionEntry[];
    const keep = new Set<string>([...(prior?.head ? [prior.head] : []), ...(prior?.saved ? [prior.saved.id] : [])]);
    const thinning = planThinning([...own, entry], entry.id, Date.parse(entry.at) || Date.now(), DELETIONS_PER_WRITE, keep);
    const needed = (): number => usage.bytes - plannedBytes(thinning) + snapshot.stored;
    // Past 90 % of the budget, or short of quota: documents nobody opened for a
    // month give up their oldest automatic checkpoints, down to 85 %, before this
    // write is refused. Eviction never touches this document.
    if (needed() > EVICT_AT * budgets.checkpoints || low) {
      const need = Math.max(low ? 2 * snapshot.stored : 0, needed() - EVICT_TO * budgets.checkpoints);
      await evictUnopened(tx, usage, need, await keptRevisions(tx), record.slot, Date.now(), EVICTIONS_PER_WRITE);
    }
    if (needed() > budgets.checkpoints) {
      await writeUsage(tx, usage);
      const result = options.reason === 'save' ? await skipRevision(tx, recovery, record, snapshot, prior, options, entry) : null;
      await done; committed = true;
      noteWritten(usage.bytes + usage.previews - before);
      if (!result) throw new Error(FULL());
      return result;
    }
    for (const row of thinning) await retireRevision(tx, usage, row);
    usage.bytes += snapshot.stored;
    await writeUsage(tx, usage);
    await revisions.add(entry);
    await tx.objectStore('revision-payloads').add(snapshot.payload, entry.id);
    // The last explicit save moves only on a save; any other write keeps it, and a
    // document born from an automatic write has none (plan 277 P1).
    const saved = options.reason === 'save' ? { saved: savedPointer(entry, stamps) }
      : prior ? ('saved' in prior ? { saved: prior.saved } : {}) : { saved: null };
    await docs.put({ slot: record.slot, documentId, head: entry.id, hash: entry.hash, workingHash: entry.hash, version: entry.id, ...saved });
    if (options.adopt) await adoptState(tx, adopted, documentId, entry.id, budgets);
    else {
      await writeCurrentState(tx, record, snapshot.data, documentId);
      await recovery.clearCommitted(tx, record.slot);
    }
    await done; committed = true;
    noteWritten(usage.bytes + usage.previews - before);
    return entry;
  } catch (error) {
    if (!committed) try { tx.abort(); } catch { /* transaction already failed */ }
    throw error;
  }
}

/**
 * A `reason: 'save'` commit is never refused by the budget (plan 277 P4 section 5,
 * review B1 item 3). With no room left, the save is written as the current state
 * and no revision is recorded: the document reads as saved outside the editor
 * (`workingHash: ''`), so the next editor that can record it adopts it, and Leave
 * without saving has nothing newer than that save to undo. The tile keeps the
 * picture it had, since no checkpoint preview will replace that picture.
 */
async function skipRevision(tx: RevisionTransaction, recovery: RecoveryStore, record: StateRecord, snapshot: PackedRevisionSnapshot,
  prior: DocumentHead | undefined, options: RevisionOptions, entry: RevisionEntry): Promise<CommitResult> {
  const currentVersion = prior ? crypto.randomUUID() : undefined;
  if (prior) await tx.objectStore('revision-documents').put({ ...prior, version: currentVersion, workingHash: '' });
  if (!options.adopt) {
    const state = tx.objectStore('state');
    const current = await state.get(record.slot) as StateRecord | undefined;
    // A creation with no history document stays a plain saved session.
    const { documentId: _none, ...plain } = record;
    await state.put(indexSavedWork({ ...plain, data: snapshot.data, thumb: current?.thumb ?? null, openedAt: current?.openedAt,
      createdAt: current?.createdAt ?? record.createdAt, ...(prior ? { documentId: prior.documentId } : {}) }));
    if (prior) await recovery.clearCommitted(tx, record.slot);
  }
  // Nothing was recorded: the entry's id is the head the document still has.
  return { ...entry, id: prior?.head ?? '', ...(currentVersion ? { currentVersion } : {}), skipped: true };
}

/** An adopted state stays as it was saved: same record, times and thumbnail. The
 * thumbnail also becomes the revision's preview, so a later Leave without saving
 * can put the picture back with the data. Drafts are left for the next write. */
async function adoptState(tx: RevisionTransaction, current: StateRecord | undefined, documentId: string, revisionId: string, budgets: RevisionBudgets): Promise<void> {
  if (!current) return;
  if (current.documentId !== documentId) await tx.objectStore('state').put(indexSavedWork({ ...current, documentId }));
  const thumb = current.thumb;
  if (!thumb || !/^data:image\/(png|jpeg|webp);base64,/.test(thumb) || thumb.length > 256 * 1024) return;
  const previews = tx.objectStore('revision-previews');
  if (await previews.get(revisionId)) return;
  const usage = await readUsage(tx);
  const size = new TextEncoder().encode(thumb).byteLength;
  if (usage.previews + size > budgets.previews) return;
  await previews.put(thumb, revisionId);
  await writeUsage(tx, { ...usage, previews: usage.previews + size });
}
