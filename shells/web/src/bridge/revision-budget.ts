// SPDX-License-Identifier: MPL-2.0
/**
 * History's budget (plan 277 P4 section 5; Andy's decisions of 27 September 2026).
 *
 * The numbers are the ceilings in revision-limits.ts (256 MiB of deflated
 * checkpoints, 48 MiB of previews, 64 MiB of recovery drafts), lowered on a small
 * device to a share of what the browser grants: `min(ceiling, 10 % of quota)`, and
 * `min(64 MiB, 2.5 % of quota)` for recovery. The quota is read once per session.
 *
 * Everything that deletes runs inside the caller's transaction, walks the
 * `documentReason`, `documentId` and `time` indexes, and stops after a bounded
 * number of deletions, so one save never holds every history write for long. What
 * a bound leaves is picked up by the next write.
 *
 * Kept, whatever the pressure: an explicit save, a named version (both are
 * `reason: 'save'`), every document's head, and the target of every document's
 * last explicit save (the P1 `saved` pointer).
 */
import type { IDBPDatabase } from 'idb';
import type { RevisionEntry } from './revision-history.ts';
import type { DocumentHead, RevisionTransaction } from './revision-records.ts';
import type { RecoveryEntry } from './revision-recovery.ts';
import type { StateRecord } from './state.ts';
import { MAX_RECOVERY_BYTES, MAX_REVISION_BYTES, MAX_REVISION_PREVIEWS } from './revision-limits.ts';

const MIB = 1024 * 1024;
const DAY = 86_400_000;
/** One document's automatic checkpoints, in deflated bytes and again in expanded
 * bytes (the sum of `entry.bytes`), because a backup carries expanded JSON: two
 * documents at a deflated-only cap would pass the backup limit on their own.
 * Explicit saves are not counted: the cap can only thin automatic checkpoints, so
 * counting saves would leave a much-saved document one automatic checkpoint. */
export const DOCUMENT_CAP = 24 * MIB;
/** Past the cap, the last hour keeps one checkpoint per ten minutes, not per minute. */
export const CAPPED_RECENT_UNIT = 10 * 60_000;
/** Global eviction starts when a budget is this full... */
export const EVICT_AT = 0.9;
/** ...and frees space down to this share, so it runs once in a while rather than
 * on every write near the line. */
export const EVICT_TO = 0.85;
/** A document nobody opened or changed for this long gives up its automatic checkpoints first. */
export const UNOPENED_MS = 30 * DAY;
/** Protected (diverged) recovery drafts kept per document, newest first. */
export const DRAFTS_KEPT = 3;
/** Protected drafts older than this are swept when History opens. */
export const DRAFT_AGE_MS = 30 * DAY;
/** Deletions one write's thinning may make. */
export const DELETIONS_PER_WRITE = 64;
/** Deletions one eviction pass may make. Eviction reads only rows it may delete
 * (previews by their own keys, one unopened document's automatic checkpoints by the
 * documentReason index), so no window of undeletable rows can stall the pass. */
export const EVICTIONS_PER_WRITE = 256;
/** How long the one quota reading may take before history goes on without it: a
 * hung estimate must never hold up a write, a Save least of all. */
export const QUOTA_READING_MS = 2000;

export interface RevisionBudgets { checkpoints: number; previews: number; recovery: number }
export interface RevisionUsageRow { bytes: number; previews: number }

/** The budgets for a quota: the ceilings, or a share of a small quota. */
export function budgetsForQuota(quota?: number | null): RevisionBudgets {
  const share = (ceiling: number, part: number): number =>
    typeof quota === 'number' && Number.isFinite(quota) && quota > 0 ? Math.min(ceiling, Math.floor(quota * part)) : ceiling;
  return { checkpoints: share(MAX_REVISION_BYTES, 0.1), previews: share(MAX_REVISION_PREVIEWS, 0.1), recovery: share(MAX_RECOVERY_BYTES, 0.025) };
}

interface QuotaReading { budgets: RevisionBudgets; free: number | null }
let reading: Promise<QuotaReading> | null = null;
/** Bytes history wrote (or freed, negative) since the quota was read. */
let writtenSinceProbe = 0;

/** Read the quota once per session (`navigator.storage.estimate()`), never inside a
 * transaction: awaiting anything but IndexedDB closes one. No estimate, or none
 * within QUOTA_READING_MS, and the ceilings stand. */
export function revisionBudgets(): Promise<RevisionBudgets> {
  reading ??= (async (): Promise<QuotaReading> => {
    try {
      const storage = (globalThis as { navigator?: { storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> } } }).navigator?.storage;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), QUOTA_READING_MS); });
      const estimate = storage?.estimate ? await Promise.race([storage.estimate(), late]).finally(() => clearTimeout(timer)) : undefined;
      const quota = estimate?.quota;
      const free = typeof quota === 'number' && typeof estimate?.usage === 'number' ? quota - estimate.usage : null;
      return { budgets: budgetsForQuota(quota), free };
    } catch { return { budgets: budgetsForQuota(null), free: null }; }
  })();
  return reading.then(value => value.budgets);
}

/** Read the quota again on the next write (tests; a Clear all reloads the page anyway). */
export function forgetQuotaReading(): void { reading = null; writtenSinceProbe = 0; }

/** Record bytes a write added (or, negative, freed) so the free-space check stays roughly current. */
export function noteWritten(bytes: number): void { writtenSinceProbe += bytes; }

/** Free quota under two checkpoints' worth: eviction runs before the write rather
 * than after a failure. Unknown quota never counts as low. */
export async function quotaLow(stored: number): Promise<boolean> {
  await revisionBudgets();
  const value = await reading!;
  return value.free !== null && value.free - writtenSinceProbe < 2 * Math.max(stored, 256 * 1024);
}

export const isQuotaError = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'QuotaExceededError';

/** Run `write`; on a QuotaExceededError, make room with `relieve` and try once more. */
export async function retryOnQuota<T>(write: () => Promise<T>, relieve: () => Promise<unknown>): Promise<T> {
  try { return await write(); } catch (error) {
    if (!isQuotaError(error)) throw error;
    await relieve();
    return write();
  }
}

const textBytes = (value: string): number => new TextEncoder().encode(value).byteLength;
const storedBytes = (entry: RevisionEntry): number => entry.stored ?? entry.bytes;
const oldestFirst = (rows: RevisionEntry[]): RevisionEntry[] => [...rows].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

export async function readUsage(tx: RevisionTransaction): Promise<RevisionUsageRow> {
  const row = await tx.objectStore('revision-usage').get('total') as Partial<RevisionUsageRow> | undefined;
  return { bytes: row?.bytes ?? 0, previews: row?.previews ?? 0 };
}
export async function writeUsage(tx: RevisionTransaction, usage: RevisionUsageRow): Promise<void> {
  await tx.objectStore('revision-usage').put({ bytes: Math.max(0, usage.bytes), previews: Math.max(0, usage.previews) }, 'total');
}

/** Every document's head and the target of its last explicit save: never evicted. */
export async function keptRevisions(tx: RevisionTransaction): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const doc of await tx.objectStore('revision-documents').getAll() as DocumentHead[]) {
    if (doc.head) ids.add(doc.head);
    if (doc.saved) ids.add(doc.saved.id);
  }
  return ids;
}

/** Remove one checkpoint with its payload and preview, keeping `usage` exact. */
export async function retireRevision(tx: RevisionTransaction, usage: RevisionUsageRow, entry: RevisionEntry): Promise<void> {
  const previews = tx.objectStore('revision-previews');
  const preview = await previews.get(entry.id) as string | undefined;
  usage.bytes -= storedBytes(entry);
  await tx.objectStore('revisions').delete(entry.id);
  await tx.objectStore('revision-payloads').delete(entry.id);
  if (preview) { usage.previews -= textBytes(preview); await previews.delete(entry.id); }
}

/** Minute detail for an hour (ten-minute detail past the document cap), hourly for
 * a day, daily for a month, weekly after that. Explicit saves are outside
 * compaction. Keeps the newest point per bucket. */
export function expiredAutomatic(entries: RevisionEntry[], now: number, recentUnit = 60_000): RevisionEntry[] {
  const occupied = new Set<string>();
  return [...entries].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).filter(entry => {
    if (entry.reason !== 'automatic') return false;
    const at = Date.parse(entry.at), age = Math.max(0, now - at);
    const unit = age < 3_600_000 ? recentUnit : age < DAY ? 3_600_000 : age < 30 * DAY ? DAY : 7 * DAY;
    const bucket = `${unit}:${Math.floor(at / unit)}`;
    if (occupied.has(bucket)) return true;
    occupied.add(bucket);
    return false;
  });
}

/** Whether a document's automatic checkpoints pass the cap, in either measure. */
export function overDocumentCap(entries: Iterable<RevisionEntry>, cap = DOCUMENT_CAP): boolean {
  let stored = 0, expanded = 0;
  for (const entry of entries) if (entry.reason === 'automatic') { stored += storedBytes(entry); expanded += entry.bytes; }
  return stored > cap || expanded > cap;
}

/**
 * Which of one document's checkpoints a new checkpoint `fresh` retires (`entries`
 * holds it, not stored yet, with the document's stored checkpoints). The usual
 * buckets first; past the cap, ten-minute buckets for the last hour; still past,
 * the oldest automatic checkpoints. Never `fresh`, never anything in `keep` (the
 * document's current head and its last explicit save), never more than
 * `allowance`. A plan, not a deletion: the commit applies it only once it knows the
 * new checkpoint is written, so a save the budget skips thins nothing.
 */
export function planThinning(entries: RevisionEntry[], fresh: string, now: number, allowance: number, keep: ReadonlySet<string>, cap = DOCUMENT_CAP): RevisionEntry[] {
  const alive = new Map(entries.map(entry => [entry.id, entry]));
  const out: RevisionEntry[] = [];
  const retire = (rows: RevisionEntry[]): void => {
    for (const row of rows) {
      if (out.length >= allowance) return;
      if (row.id === fresh || keep.has(row.id) || !alive.has(row.id)) continue;
      alive.delete(row.id); out.push(row);
    }
  };
  retire(oldestFirst(expiredAutomatic([...alive.values()], now)));
  if (!overDocumentCap(alive.values(), cap)) return out;
  retire(oldestFirst(expiredAutomatic([...alive.values()], now, CAPPED_RECENT_UNIT)));
  for (const row of oldestFirst([...alive.values()].filter(entry => entry.reason === 'automatic'))) {
    if (!overDocumentCap(alive.values(), cap) || out.length >= allowance) break;
    retire([row]);
  }
  return out;
}

/** The bytes a plan frees, as `usage.bytes` counts them. */
export const plannedBytes = (rows: RevisionEntry[]): number => rows.reduce((sum, row) => sum + storedBytes(row), 0);

/** Previews go first: those of automatic checkpoints that are not kept, oldest
 * first, until `need` bytes are free. The checkpoints themselves stay. Read by the
 * previews' own keys, so only rows that hold a preview are looked at; a preview
 * whose checkpoint is gone is dropped first. */
export async function evictPreviews(tx: RevisionTransaction, usage: RevisionUsageRow, need: number, kept: ReadonlySet<string>, allowance: number): Promise<number> {
  if (need <= 0) return 0;
  const previews = tx.objectStore('revision-previews'), revisions = tx.objectStore('revisions');
  const ids = await previews.getAllKeys() as string[];
  const rows = await Promise.all(ids.map(id => revisions.get(id) as Promise<RevisionEntry | undefined>));
  const orphans = ids.filter((_, i) => !rows[i]);
  const candidates = oldestFirst(rows.filter((row): row is RevisionEntry => !!row && row.reason === 'automatic' && !kept.has(row.id)));
  let freed = 0, used = 0;
  for (const id of [...orphans, ...candidates.map(row => row.id)]) {
    if (freed >= need || used >= allowance) break;
    const preview = await previews.get(id) as string | undefined;
    if (!preview) continue;
    const size = textBytes(preview);
    await previews.delete(id); usage.previews -= size; freed += size; used++;
  }
  return used;
}

/** Automatic checkpoints of documents nobody opened or changed for 30 days, oldest
 * first, until `need` bytes are free. `busy` is the document being written. Only
 * those documents' automatic checkpoints are read (the documentReason index). */
export async function evictUnopened(tx: RevisionTransaction, usage: RevisionUsageRow, need: number, kept: ReadonlySet<string>, busy: string | null, now: number, allowance: number): Promise<number> {
  if (need <= 0) return 0;
  const docs = (await tx.objectStore('revision-documents').getAll() as DocumentHead[]).filter(doc => doc.slot !== busy);
  const states = await Promise.all(docs.map(doc => tx.objectStore('state').get(doc.slot) as Promise<StateRecord | undefined>));
  const unopened = docs.filter((_, i) => now - Math.max(Date.parse(states[i]?.openedAt ?? '') || 0, Date.parse(states[i]?.updatedAt ?? '') || 0) > UNOPENED_MS);
  const index = tx.objectStore('revisions').index('documentReason');
  const candidates: RevisionEntry[] = [];
  for (const doc of unopened) {
    const range = IDBKeyRange.bound([doc.documentId, 'automatic', '', ''], [doc.documentId, 'automatic', '\uffff', '\uffff']);
    for (const row of await index.getAll(range) as RevisionEntry[]) if (!kept.has(row.id)) candidates.push(row);
  }
  let freed = 0, used = 0;
  for (const row of oldestFirst(candidates)) {
    if (freed >= need || used >= allowance) break;
    await retireRevision(tx, usage, row); freed += storedBytes(row); used++;
  }
  return used;
}

/** The checkpoint stores a quota relief writes. */
export const RELIEF_STORES = ['state', 'revision-documents', 'revisions', 'revision-payloads', 'revision-previews', 'revision-usage'];

/** After a QuotaExceededError: previews first, then unopened documents' automatic
 * checkpoints, in a transaction of its own, before the one retry. */
export async function relieveQuota(db: IDBPDatabase, need: number, busy: string | null): Promise<void> {
  const tx = db.transaction(RELIEF_STORES, 'readwrite');
  const usage = await readUsage(tx), kept = await keptRevisions(tx);
  const before = usage.bytes + usage.previews;
  const target = Math.max(need, 2 * 1024 * 1024);
  await evictPreviews(tx, usage, target, kept, EVICTIONS_PER_WRITE);
  const freed = before - (usage.bytes + usage.previews);
  if (freed < target) await evictUnopened(tx, usage, target - freed, kept, busy, Date.now(), EVICTIONS_PER_WRITE);
  await writeUsage(tx, usage);
  await tx.done;
  noteWritten(usage.bytes + usage.previews - before);
}

// ---- Recovery drafts ------------------------------------------------------------

type RecoveryRow = Pick<RecoveryEntry, 'id' | 'slot' | 'at' | 'bytes' | 'diverged'>;
const newestFirst = (a: RecoveryRow, b: RecoveryRow): number => b.at.localeCompare(a.at) || b.id.localeCompare(a.id);

async function dropDraft(tx: RevisionTransaction, row: RecoveryRow): Promise<number> {
  await tx.objectStore('revision-recovery').delete(row.id);
  await tx.objectStore('revision-recovery-payloads').delete(row.id);
  return row.bytes;
}

/** Keep a slot's newest DRAFTS_KEPT protected drafts, and always `keep`. */
export async function trimDrafts(tx: RevisionTransaction, slot: string, keep?: string): Promise<{ freed: number; removed: number }> {
  const rows = (await tx.objectStore('revision-recovery').index('slot').getAll(slot) as RecoveryRow[]).filter(row => row.diverged).sort(newestFirst);
  let freed = 0, removed = 0;
  for (const row of rows.slice(DRAFTS_KEPT)) if (row.id !== keep) { freed += await dropDraft(tx, row); removed++; }
  return { freed, removed };
}

/** Protected drafts older than DRAFT_AGE_MS, oldest first, until `need` bytes are
 * free (Infinity for the History-open sweep). Never `keep`. Returns the bytes freed. */
export async function sweepOldDrafts(tx: RevisionTransaction, need: number, now: number, keep?: string, allowance = DELETIONS_PER_WRITE): Promise<{ freed: number; removed: number }> {
  const cutoff = new Date(now - DRAFT_AGE_MS).toISOString();
  let freed = 0, removed = 0;
  let cursor = await tx.objectStore('revision-recovery').index('time').openCursor(IDBKeyRange.upperBound([cutoff]));
  while (cursor && freed < need && removed < allowance) {
    const row = cursor.value as RecoveryRow;
    if (row.diverged && row.id !== keep) { freed += await dropDraft(tx, row); removed++; }
    cursor = await cursor.continue();
  }
  return { freed, removed };
}

export const RECOVERY_BUDGET_STORES = ['revision-recovery', 'revision-recovery-payloads', 'revision-usage'];

/** The History-open sweep of protected drafts: those older than 30 days, and any
 * past each document's newest three. Returns how many went. */
export async function sweepDrafts(db: IDBPDatabase, now: number): Promise<number> {
  const tx = db.transaction(RECOVERY_BUDGET_STORES, 'readwrite');
  let bytes = await tx.objectStore('revision-usage').get('recovery') as number | undefined ?? 0;
  const old = await sweepOldDrafts(tx, Infinity, now, undefined, 512);
  bytes -= old.freed;
  let removed = old.removed;
  const slots = new Set((await tx.objectStore('revision-recovery').getAll() as RecoveryRow[]).filter(row => row.diverged).map(row => row.slot));
  for (const slot of slots) {
    const trimmed = await trimDrafts(tx, slot);
    bytes -= trimmed.freed; removed += trimmed.removed;
  }
  await tx.objectStore('revision-usage').put(Math.max(0, bytes), 'recovery');
  await tx.done;
  return removed;
}
