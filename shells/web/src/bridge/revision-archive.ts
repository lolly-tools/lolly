// SPDX-License-Identifier: MPL-2.0
import type { IDBPDatabase } from 'idb';
import { indexSavedWork } from './history-index.ts';
import type { RevisionEntry } from './revision-history.ts';
import type { RecoveryEntry } from './revision-recovery.ts';
import { MAX_REVISION_ARCHIVE_BYTES } from './revision-limits.ts';
import { packCanonical, revisionSnapshot, type RevisionPayload } from './revision-snapshot.ts';
import { pinRevisionAssets } from './revision-asset-pins.ts';
import { revisionBudgets } from './revision-budget.ts';
import { collectAssetRefs } from './asset-ref-collector.ts';
import { REVISION_STORES, type DocumentHead, type RevisionTransaction, documentVersion, holdsUnsavedWork, savedRevision } from './revision-records.ts';
import { validateRevisionArchive, type RevisionArchive, type RevisionArchiveAPI, type RevisionArchiveSummary } from './revision-archive-format.ts';
import type { SavedStateData, StateRecord } from './state.ts';
import { isDiscardedSlot, isTrashedSlot } from '../lib/batch-slots.ts';
import { incomingIsNewer, sessionSavedAt } from '../lib/backup-sessions.ts';


export function createRevisionArchive(db: IDBPDatabase): RevisionArchiveAPI {
  return {
    async export(options = {}) {
      const limit = options.maxBytes ?? MAX_REVISION_ARCHIVE_BYTES;
      // A single read transaction pairs each current session with its exact head
      // and draft generation, even while another tab continues editing.
      const tx = db.transaction(REVISION_STORES);
      const archive: RevisionArchive = { version: 1, documents: [], revisions: [], recoveries: [] };
      const size = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;
      // Current states, drafts, explicit saves, named versions, heads and the last
      // explicit saves always travel; only automatic checkpoints may be left out,
      // oldest first, when the archive would pass the limit (plan 277 P4 section 5).
      let fixed = 0;
      const pinned = new Set<string>();
      for (const document of await tx.objectStore('revision-documents').getAll() as DocumentHead[]) {
        const state = await tx.objectStore('state').get(document.slot) as StateRecord | undefined;
        if (!state) throw new Error('A history document is missing its current state. Keep this device and repair it before backing up.');
        // The archive carries the state without its thumbnail (validateRevisionArchive).
        fixed += size(document) + size({ ...state, thumb: null });
        archive.documents.push({ document, state });
        if (document.head) pinned.add(document.head);
        if (document.saved) pinned.add(document.saved.id);
      }
      const drafts = await tx.objectStore('revision-recovery').getAll() as RecoveryEntry[];
      for (const entry of drafts) fixed += entry.bytes + size(entry);
      // What each checkpoint adds, measured before any payload is inflated: its
      // canonical JSON length is on the entry, and the preview is read as it is.
      const rows: Array<{ entry: RevisionEntry; preview?: string; bytes: number }> = [];
      let cursor = await tx.objectStore('revisions').openCursor();
      while (cursor) {
        const entry = cursor.value as RevisionEntry;
        const preview = await tx.objectStore('revision-previews').get(entry.id) as string | undefined;
        rows.push({ entry, ...(preview ? { preview } : {}), bytes: entry.bytes + size(entry) + (preview?.length ?? 0) + 64 });
        if (entry.reason === 'save') pinned.add(entry.id);
        cursor = await cursor.continue();
      }
      const chosen = admit(rows.map(row => ({ id: row.entry.id, at: row.entry.at, bytes: row.bytes })), limit - fixed - 1024, pinned);
      if (rows.filter(row => pinned.has(row.entry.id)).reduce((sum, row) => sum + row.bytes, fixed) > limit)
        throw new Error('Complete revision history exceeds the 384 MiB backup limit. No partial history backup was created.');
      for (const row of rows) {
        if (!chosen.ids.has(row.entry.id)) continue;
        const data = await tx.objectStore('revision-payloads').get(row.entry.id);
        archive.revisions.push({ entry: row.entry, data, ...(row.preview ? { preview: row.preview } : {}) });
      }
      for (const entry of drafts) archive.recoveries.push({ ...entry, data: await tx.objectStore('revision-recovery-payloads').get(entry.id) });
      await tx.done;
      if (chosen.leftOut) options.leftOut?.(chosen.leftOut);
      return validateRevisionArchive(archive);
    },
    async restore(value, options = {}) {
      const archive = await validateRevisionArchive(value);
      // Everything that needs hashing happens before the write transaction opens.
      const plans = await planDocuments(db, archive, options.sameId ?? 'newer');
      const budgets = await revisionBudgets();
      // Restored checkpoints are stored deflated, as new ones are, so restored
      // history costs its deflated size (plan 277 P4 section 5). Compressing is
      // asynchronous, so it happens here too.
      const packed = new Map<string, { payload: RevisionPayload; stored: number }>();
      for (const row of archive.revisions) packed.set(row.entry.id, await packCanonical(row.data));
      const tx = db.transaction(REVISION_STORES, 'readwrite'); void tx.done.catch(() => {});
      try {
        // Counts describe what this import changed here (plan 277 P1, recheck R1), not
        // what the archive holds, so a backup imported twice reports nothing new.
        const summary: RevisionArchiveSummary = { revisions: 0, recoveryDrafts: 0, added: 0, kept: 0, replaced: 0, copies: 0, hidden: 0, skippedCheckpoints: 0, historyLeftOut: 0 };
        const slotOf = new Map(plans.map(plan => [plan.row.document.documentId, plan.slot]));
        // A creation whose current state here is not the backup's keeps the backup's
        // drafts as a separate branch, so a later commit here cannot clear them.
        const branch = new Set(plans.filter(plan => !plan.takeIncoming).map(plan => plan.row.document.documentId));
        const usage = await tx.objectStore('revision-usage').get('total') ?? { bytes: 0, previews: 0 };
        // History that does not fit this browser's history space is left out, oldest
        // first, so the sessions and everything else still arrive. The backup's current
        // states and last explicit saves always come in.
        const present = new Set<string>();
        for (const row of archive.revisions) if (await tx.objectStore('revisions').get(row.entry.id)) present.add(row.entry.id);
        const admitted = admit(archive.revisions.filter(row => !present.has(row.entry.id)).map(row => ({ id: row.entry.id, at: row.entry.at, bytes: packed.get(row.entry.id)!.stored })),
          budgets.checkpoints - usage.bytes, pinnedCheckpoints(archive));
        summary.historyLeftOut! += admitted.leftOut;
        for (const row of archive.revisions) {
          const existing = await tx.objectStore('revisions').get(row.entry.id) as RevisionEntry | undefined;
          if (!existing && !admitted.ids.has(row.entry.id)) continue;
          if (existing) {
            // One checkpoint, two copies: the same id always means the same content
            // (the hash says so); a name or a promotion to a save made on one side is
            // kept. A different hash under the same id keeps this device's.
            if (existing.hash !== row.entry.hash) { summary.skippedCheckpoints!++; continue; }
            const milestone = existing.milestone ?? row.entry.milestone;
            if ((row.entry.reason === 'save' && existing.reason === 'automatic') || (milestone && !existing.milestone))
              await tx.objectStore('revisions').put({ ...existing, reason: 'save', ...(milestone ? { milestone } : {}) });
          } else {
            const { payload, stored } = packed.get(row.entry.id)!;
            usage.bytes += stored; summary.revisions++;
            await tx.objectStore('revisions').add({ ...row.entry, stored, slot: slotOf.get(row.entry.documentId) ?? row.entry.slot });
            await tx.objectStore('revision-payloads').add(payload, row.entry.id);
          }
          // A preview is decoration: one that does not fit is skipped, not counted.
          if (row.preview && usage.previews + row.preview.length <= budgets.previews && !await tx.objectStore('revision-previews').get(row.entry.id)) {
            usage.previews += row.preview.length;
            await tx.objectStore('revision-previews').put(row.preview, row.entry.id);
          }
        }
        let recoveryBytes = await tx.objectStore('revision-usage').get('recovery') ?? 0;
        const putDraft = async (entry: RecoveryEntry, data: unknown): Promise<void> => {
          const prior = await tx.objectStore('revision-recovery').get(entry.id) as RecoveryEntry | undefined;
          recoveryBytes += entry.bytes - (prior?.bytes ?? 0);
          if (!prior) summary.recoveryDrafts++;
          await tx.objectStore('revision-recovery').put(entry);
          await tx.objectStore('revision-recovery-payloads').put(data, entry.id);
        };
        const fits = (bytes: number): boolean => recoveryBytes + bytes <= budgets.recovery;
        // Drafts that keep this device's state before a replacement come first; the
        // backup's own drafts share what space is left, newest first.
        const reserved = plans.reduce((sum, plan) => sum + (plan.takeIncoming && plan.localSnapshot && !plan.held.has(plan.localSnapshot.hash) ? plan.localSnapshot.bytes : 0), 0);
        const incomingDrafts: Array<{ entry: RecoveryEntry; data: unknown }> = [];
        for (const { data, ...entry } of archive.recoveries) {
          const existing = await tx.objectStore('revision-recovery').get(entry.id) as RecoveryEntry | undefined;
          const moved = { ...entry, slot: slotOf.get(entry.documentId) ?? entry.slot, ...(branch.has(entry.documentId) ? { diverged: true } : {}) };
          // A writer's draft on both sides keeps its later generation.
          if (!existing || (existing.hash !== entry.hash && entry.at > existing.at)) incomingDrafts.push({ entry: moved, data });
        }
        const draftsAdmitted = admit(incomingDrafts.map(row => ({ id: row.entry.id, at: row.entry.at, bytes: row.entry.bytes })), budgets.recovery - recoveryBytes - reserved, new Set());
        summary.historyLeftOut! += draftsAdmitted.leftOut;
        for (const row of incomingDrafts) if (draftsAdmitted.ids.has(row.entry.id)) await putDraft(row.entry, row.data);
        for (const plan of plans) await applyPlan(tx, plan, summary, putDraft, fits);
        await tx.objectStore('revision-usage').put(usage, 'total');
        await tx.objectStore('revision-usage').put(recoveryBytes, 'recovery');
        await tx.done;
        return summary;
      } catch (error) { try { tx.abort(); } catch { /* already aborted */ } throw error; }
    },
  };
}

/** Every checkpoint the backup's creations stand on: current heads and last
 * explicit saves. These always come in, whatever the space. */
function pinnedCheckpoints(archive: RevisionArchive): Set<string> {
  const ids = new Set<string>();
  for (const { document } of archive.documents) {
    if (document.head) ids.add(document.head);
    if (document.saved) ids.add(document.saved.id);
  }
  return ids;
}

/** Which new items fit in `room` bytes: pinned ones always, then the rest with the
 * oldest left out first until what remains fits. */
export function admit(items: ReadonlyArray<{ id: string; at: string; bytes: number }>, room: number, pinned: ReadonlySet<string>): { ids: Set<string>; leftOut: number } {
  const ids = new Set(items.filter(item => pinned.has(item.id)).map(item => item.id));
  const free = room - items.filter(item => pinned.has(item.id)).reduce((sum, item) => sum + item.bytes, 0);
  const rest = items.filter(item => !pinned.has(item.id)).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  let total = rest.reduce((sum, item) => sum + item.bytes, 0), from = 0;
  while (from < rest.length && total > free) total -= rest[from++]!.bytes;
  for (const item of rest.slice(from)) ids.add(item.id);
  return { ids, leftOut: from };
}

type ArchiveDocument = RevisionArchive['documents'][number];
type Snapshot = { data: SavedStateData; hash: string; bytes: number };
/**
 * What one archived creation does on this device (plan 277 P1, review B1). Never a
 * reason to refuse the import: every outcome keeps what either side held.
 *  - add: new here, added as it is.
 *  - copy: its slot here holds a different creation, so it is added at a new slot.
 *  - hidden: in the Trash or discarded here; left there.
 *  - merge: on both sides; the newer (or, for a restore, the backup's) current
 *    state wins and the other becomes a protected draft.
 */
interface Plan {
  kind: 'add' | 'copy' | 'hidden' | 'merge';
  row: ArchiveDocument;
  /** The slot the creation lives at here after the import. */
  slot: string;
  incoming: Snapshot | null;
  /** This device's document and state, as read before the write. */
  local?: DocumentHead;
  localState?: StateRecord;
  localSnapshot?: Snapshot | null;
  /** The backup's current state replaces this device's. */
  takeIncoming: boolean;
  /** Hashes a checkpoint or draft on either side already holds for this creation. */
  held: Set<string>;
  /** This device's state counts as saved (for a creation with equal states). */
  localSaved: boolean;
}

const snapshotOf = async (data: SavedStateData): Promise<Snapshot | null> => {
  try { const snap = await revisionSnapshot(pinRevisionAssets(data)); return { data: snap.data, hash: snap.hash, bytes: snap.bytes }; } catch { return null; }
};

async function planDocuments(db: IDBPDatabase, archive: RevisionArchive, rule: 'newer' | 'incoming'): Promise<Plan[]> {
  const read = db.transaction(['state', 'revision-documents', 'revisions', 'revision-recovery']);
  const docs = read.objectStore('revision-documents');
  const byId = new Map((await docs.getAll() as DocumentHead[]).map(doc => [doc.documentId, doc]));
  const drafts = await read.objectStore('revision-recovery').getAll() as RecoveryEntry[];
  const rows: Array<{ row: ArchiveDocument; local?: DocumentHead; atSlot?: DocumentHead; localState?: StateRecord; held: Set<string>; localSaved: boolean }> = [];
  for (const row of archive.documents) {
    const local = byId.get(row.document.documentId);
    const atSlot = local ? undefined : await docs.get(row.document.slot) as DocumentHead | undefined;
    const localState = await read.objectStore('state').get(local?.slot ?? row.document.slot) as StateRecord | undefined;
    const held = new Set<string>();
    for (const entry of archive.revisions) if (entry.entry.documentId === row.document.documentId) held.add(entry.entry.hash);
    for (const entry of archive.recoveries) if (entry.documentId === row.document.documentId) held.add(entry.hash);
    let localSaved = false;
    if (local) {
      // Only checkpoints and diverged drafts last: the next commit clears the others.
      for (const entry of await read.objectStore('revisions').index('documentId').getAll(local.documentId) as RevisionEntry[]) held.add(entry.hash);
      for (const draft of drafts) if (draft.documentId === local.documentId && draft.diverged) held.add(draft.hash);
      localSaved = !holdsUnsavedWork(local, await savedRevision(read, local));
    }
    rows.push({ row, local, atSlot, localState, held, localSaved });
  }
  await read.done;
  const plans: Plan[] = [];
  for (const { row, local, atSlot, localState, held, localSaved } of rows) {
    const incoming = await snapshotOf(row.state.data);
    const base = { row, incoming, held, localSaved, local, localState };
    if (local && (isTrashedSlot(local.slot) || isDiscardedSlot(local.slot))) { plans.push({ ...base, kind: 'hidden', slot: local.slot, takeIncoming: false }); continue; }
    if (!local && atSlot) { plans.push({ ...base, kind: 'copy', slot: `${row.state.toolId || 'session'}:${crypto.randomUUID()}`, takeIncoming: true }); continue; }
    if (!local && !localState) { plans.push({ ...base, kind: 'add', slot: row.document.slot, takeIncoming: true }); continue; }
    const localSnapshot = localState ? await snapshotOf(localState.data) : null;
    // A local state that cannot be kept as a draft (a temporary file) is never replaced.
    // Compared on the last explicit save of each side (plan 277 P7's savedAt, with
    // updatedAt for records written before it), the rule sessions.json rows follow.
    const newer = rule === 'incoming' || incomingIsNewer(sessionSavedAt(localState), sessionSavedAt(row.state));
    plans.push({ ...base, kind: 'merge', slot: local?.slot ?? row.document.slot, localSnapshot, takeIncoming: newer && !!localSnapshot && !!incoming });
  }
  return plans;
}

/** A protected draft of one side's state, so a creation on both devices loses neither. */
function draftOf(plan: Plan, snapshot: Snapshot, state: StateRecord, side: 'import' | 'kept', doc: DocumentHead | undefined): RecoveryEntry & { data: SavedStateData } {
  const refs = new Set<string>(); collectAssetRefs(snapshot.data, refs);
  const version = documentVersion(doc) ?? plan.row.document.version ?? crypto.randomUUID();
  return { id: `${side}:${plan.row.document.documentId}:${snapshot.hash}`, slot: plan.slot, documentId: plan.row.document.documentId,
    version, baseHead: doc?.head ?? null, baseVersion: version, diverged: true, toolId: state.toolId ?? '',
    label: state.label || state.toolId || 'Untitled', at: state.updatedAt, hash: snapshot.hash, bytes: snapshot.bytes,
    assetRefs: [...refs], data: snapshot.data };
}

async function applyPlan(tx: RevisionTransaction, plan: Plan, summary: RevisionArchiveSummary,
  putDraft: (entry: RecoveryEntry, data: unknown) => Promise<void>, fits: (bytes: number) => boolean): Promise<void> {
  const docs = tx.objectStore('revision-documents'), states = tx.objectStore('state');
  const { row } = plan;
  const incomingState = { ...row.state, slot: plan.slot };
  const keep = async (snapshot: Snapshot | null | undefined, state: StateRecord | undefined, side: 'import' | 'kept', doc: DocumentHead | undefined): Promise<void> => {
    if (!snapshot || !state || plan.held.has(snapshot.hash)) return;
    const { data, ...entry } = draftOf(plan, snapshot, state, side, doc);
    if (await tx.objectStore('revision-recovery').get(entry.id)) return;
    if (!fits(entry.bytes)) { summary.historyLeftOut!++; return; }
    await putDraft(entry, data);
  };
  const addDocument = async (document: DocumentHead): Promise<void> => {
    await docs.put(document);
    const preview = document.head ? await tx.objectStore('revision-previews').get(document.head) as string | undefined : undefined;
    await states.put(indexSavedWork({ ...incomingState, documentId: document.documentId, thumb: document.hash === document.workingHash ? preview ?? null : null }));
  };
  if (plan.kind === 'add' || plan.kind === 'copy') {
    await addDocument({ ...row.document, slot: plan.slot });
    if (plan.kind === 'copy') summary.copies!++;
    else summary.added!++;
    return;
  }
  const current = plan.local ? await docs.get(plan.local.slot) as DocumentHead | undefined : undefined;
  const state = await states.get(plan.slot) as StateRecord | undefined;
  // Another tab wrote this creation since the plan was read: its copy stays.
  const moved = documentVersion(current) !== documentVersion(plan.local) || state?.updatedAt !== plan.localState?.updatedAt;
  if (plan.kind === 'hidden') {
    summary.hidden!++;
    await keep(plan.incoming, incomingState, 'import', current);
    return;
  }
  if (plan.localSnapshot && plan.incoming && plan.localSnapshot.hash === plan.incoming.hash && !moved) {
    // The same state on both sides: saved if either side counts it as saved.
    const incomingSaved = row.document.workingHash === '' || row.document.saved === undefined || row.document.saved?.hash === plan.incoming.hash;
    if (current && !plan.localSaved && incomingSaved) await docs.put({ ...current, workingHash: '' });
    else if (!current) await addDocument({ ...row.document, slot: plan.slot, workingHash: '' });
    return;
  }
  // This device's state is replaced only when its draft fits (space was reserved).
  const localKeepable = !plan.localSnapshot || plan.held.has(plan.localSnapshot.hash) || fits(plan.localSnapshot.bytes);
  if (plan.takeIncoming && !moved && localKeepable) {
    // The backup's newer copy becomes current; this device's is kept as a draft.
    const { saved: _replaced, ...base } = current ?? { ...row.document, slot: plan.slot };
    const document: DocumentHead = { ...base, slot: plan.slot, head: row.document.head, hash: row.document.hash,
      workingHash: row.document.workingHash, version: crypto.randomUUID(), ...(row.document.saved !== undefined ? { saved: row.document.saved } : {}) };
    await keep(plan.localSnapshot, state, 'kept', document);
    const preview = document.head ? await tx.objectStore('revision-previews').get(document.head) as string | undefined : undefined;
    await docs.put(document);
    await states.put(indexSavedWork({ ...incomingState, documentId: document.documentId, openedAt: state?.openedAt,
      createdAt: state?.createdAt ?? incomingState.createdAt, thumb: document.hash === document.workingHash ? preview ?? null : null }));
    summary.replaced!++;
    return;
  }
  // This device's copy stays. A state here with no history document gains the
  // backup's document, marked as saved outside the editor so it is adopted on open.
  if (!current && state) {
    await docs.put({ ...row.document, slot: plan.slot, workingHash: '' });
    await states.put(indexSavedWork({ ...state, documentId: row.document.documentId }));
  }
  await keep(plan.incoming, incomingState, 'import', current ?? { ...row.document, slot: plan.slot });
  // "Kept this browser's newer copy" is said only when this copy is the newer one.
  if (!plan.takeIncoming) summary.kept!++;
}
