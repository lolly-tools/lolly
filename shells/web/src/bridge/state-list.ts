// SPDX-License-Identifier: MPL-2.0
/**
 * The lean list of sessions and the move of old pictures into the preview store
 * (plan 373, sections 6.2 and decision 6).
 *
 * `state-list` holds one small row per saved session (names, times, a picture
 * reference), written in the same transaction as the record itself
 * (state-rows.ts). A list of sessions reads those rows and the record keys, and
 * never a document or a picture.
 *
 * The rows do not exist for records written before database version 27, and the
 * upgrade does not build them: building them means reading every record whole,
 * which is long work, and a long upgrade transaction is the one that fails on a
 * large library. So until a pass has visited every record, `list()` reads the old
 * way, and `migrateSessions` walks the records on idle time, a few per
 * transaction:
 *
 *  - a record with a legacy `thumb` data URL gets its picture decoded, hashed and
 *    stored, then the record is rewritten with a `preview` reference and without
 *    the `thumb`, in ONE transaction that also writes its lean row. The stored
 *    bytes are read back inside that transaction before the record changes, and
 *    a record whose `updatedAt` moved since it was read is left for the next pass;
 *  - a record with no picture to move only gains its lean row.
 *
 * Progress is one row in `preview-index` (`meta:state-list`, the last slot done),
 * so a closed tab resumes where it stopped; each step is its own transaction, so
 * a step is either whole or absent. `migrateRevisionPreviews` and
 * `migrateExportPictures` do the same for History previews and the export log.
 */
import type { IDBPDatabase } from 'idb';
import type { StateRecord } from './state.ts';
import type { ExportEntry } from '../lib/export-history.ts';
import {
  PREVIEW_BLOBS, PREVIEW_INDEX, STATE_LIST, bindOwner, exportOwner, isPrepared, ownerRef, preparePicture, revisionOwner, scopeFor, type PreparedPicture, type PreviewBlobRow,
} from './preview-store.ts';
import { leanRow, putStateRecord, withPicture, type StateListRow } from './state-rows.ts';
import { sessionPreviewRef } from '../../../../engine/src/session-record.ts';

const META = 'meta:state-list';
interface ListMeta { id: string; kind: 'meta'; complete: boolean; last?: string; at: number }

/** Records read per migration transaction. */
const BATCH = 8;

const textBytes = (value: string): number => new TextEncoder().encode(value).byteLength;

/** Whether a record still carries its picture as a data URL. */
function holdsLegacyPicture(record: StateRecord): boolean {
  return typeof record.thumb === 'string' && !!record.thumb;
}

/**
 * Every saved session's lean row, or null while the rows are not all built yet
 * (the caller then reads the records whole, as before). Rows and record keys are
 * read in one transaction and reconciled: a record with no row gets one, and a row
 * whose record is gone is dropped, so a write that ever slipped past the shared
 * writer cannot hide or invent a session.
 */
export async function leanList(db: IDBPDatabase): Promise<StateListRow[] | null> {
  const tx = db.transaction([STATE_LIST, 'state', PREVIEW_INDEX]);
  const meta = await tx.objectStore(PREVIEW_INDEX).get(META) as ListMeta | undefined;
  if (!meta?.complete) { await tx.done; return null; }
  const [rows, keys] = await Promise.all([
    tx.objectStore(STATE_LIST).getAll() as Promise<StateListRow[]>,
    tx.objectStore('state').getAllKeys() as Promise<string[]>,
  ]);
  await tx.done;
  const live = new Set(keys);
  const have = new Set(rows.map(row => row.slot));
  const missing = keys.filter(slot => !have.has(slot));
  const extra = rows.filter(row => !live.has(row.slot));
  let out = rows;
  if (missing.length || extra.length) {
    const fix = db.transaction([STATE_LIST, 'state'], 'readwrite');
    for (const row of extra) if (!await fix.objectStore('state').count(row.slot)) await fix.objectStore(STATE_LIST).delete(row.slot);
    const added: StateListRow[] = [];
    for (const slot of missing) {
      const record = await fix.objectStore('state').get(slot) as StateRecord | undefined;
      if (!record) continue;
      const row = leanRow(record);
      await fix.objectStore(STATE_LIST).put(row);
      added.push(row);
    }
    await fix.done;
    out = [...rows.filter(row => live.has(row.slot)), ...added];
  }
  // A record whose old picture could not be moved keeps it; its row says so, and
  // the picture is read off the record (rare: a data URL that does not decode).
  for (const row of out) {
    if (!row.legacyThumb) continue;
    const record = await db.get('state', row.slot) as StateRecord | undefined;
    row.thumb = typeof record?.thumb === 'string' ? record.thumb : null;
  }
  return out;
}

/** Each session's size from its lean row, or null while the rows are not built. */
export async function leanSizes(db: IDBPDatabase): Promise<Record<string, number> | null> {
  const meta = await db.get(PREVIEW_INDEX, META) as ListMeta | undefined;
  if (!meta?.complete) return null;
  const out: Record<string, number> = {};
  for (const row of await db.getAll(STATE_LIST) as StateListRow[]) out[row.slot] = (row.bytes ?? 0) + (row.preview?.bytes ?? 0);
  return out;
}

/** Whether every record has been visited and the lean list is in use. */
export async function leanListReady(db: IDBPDatabase): Promise<boolean> {
  try { return !!(await db.get(PREVIEW_INDEX, META) as ListMeta | undefined)?.complete; } catch { return false; }
}

export interface MigrationOptions {
  /** Checked between steps: true stops the pass, which resumes on the next call. */
  stop?: () => boolean;
  /** Records read per step. */
  batch?: number;
}

/**
 * Visit the records the lean list has not seen yet, moving each legacy picture
 * into the preview store. Returns true when every record has been visited (the
 * lean list is then in use), false when `stop` asked it to pause.
 */
export async function migrateSessions(db: IDBPDatabase, options: MigrationOptions = {}): Promise<boolean> {
  const batch = Math.max(1, options.batch ?? BATCH);
  const retries = new Map<string, number>();
  for (;;) {
    if (options.stop?.()) return false;
    const meta = await db.get(PREVIEW_INDEX, META) as ListMeta | undefined;
    if (meta?.complete) return true;
    const range = meta?.last !== undefined ? IDBKeyRange.lowerBound(meta.last, true) : undefined;
    const records = await db.getAll('state', range, batch) as StateRecord[];
    if (!records.length) {
      await db.put(PREVIEW_INDEX, { id: META, kind: 'meta', complete: true, at: Date.now() } satisfies ListMeta);
      return true;
    }
    // Decoding and hashing happen here, before the write transaction opens.
    const prepared = new Map<string, PreparedPicture>();
    for (const record of records) {
      if (!holdsLegacyPicture(record) || sessionPreviewRef(record)) continue;
      const picture = await preparePicture(record.thumb, 'legacy').catch(() => null);
      if (picture && isPrepared(picture)) prepared.set(record.slot, picture);
    }
    const tx = db.transaction(scopeFor(db, ['state']), 'readwrite');
    let last = meta?.last;
    for (const read of records) {
      const current = await tx.objectStore('state').get(read.slot) as StateRecord | undefined;
      if (current && current.updatedAt !== read.updatedAt && holdsLegacyPicture(current) && (retries.get(read.slot) ?? 0) < 3) {
        // Written since it was read and still holding its old picture: read it
        // again on the next step rather than move a picture from a stale copy.
        retries.set(read.slot, (retries.get(read.slot) ?? 0) + 1);
        break;
      }
      last = read.slot;
      if (!current) continue;
      const picture = current.updatedAt === read.updatedAt ? prepared.get(read.slot) : undefined;
      const ref = sessionPreviewRef(current);
      if (picture) await putStateRecord(tx, await withPicture(tx, current, picture));
      else if (ref && holdsLegacyPicture(current)) {
        // Both forms: the reference wins once its bytes are here.
        const next = await withPicture(tx, current, ref);
        await putStateRecord(tx, next.preview ? next : current);
      } else await tx.objectStore(STATE_LIST).put(leanRow(current));
    }
    await tx.objectStore(PREVIEW_INDEX).put({ id: META, kind: 'meta', complete: false, ...(last !== undefined ? { last } : {}), at: Date.now() } satisfies ListMeta);
    await tx.done;
  }
}

/**
 * Move the records the lean list still marks as holding an old picture: the ones
 * the first pass left because they were being edited at the time. Cheap: reads
 * the lean rows, then only those records.
 */
export async function migrateStragglers(db: IDBPDatabase, options: MigrationOptions = {}): Promise<void> {
  if (!await leanListReady(db)) return;
  const rows = (await db.getAll(STATE_LIST) as StateListRow[]).filter(row => !row.preview && (row.thumb || row.legacyThumb));
  for (const row of rows) {
    if (options.stop?.()) return;
    const read = await db.get('state', row.slot) as StateRecord | undefined;
    if (!read || !holdsLegacyPicture(read) || sessionPreviewRef(read)) continue;
    const picture = await preparePicture(read.thumb, 'legacy').catch(() => null);
    if (!picture || !isPrepared(picture)) continue;
    const tx = db.transaction(scopeFor(db, ['state']), 'readwrite');
    const current = await tx.objectStore('state').get(row.slot) as StateRecord | undefined;
    if (current && current.updatedAt === read.updatedAt) await putStateRecord(tx, await withPicture(tx, current, picture));
    await tx.done;
  }
}

/**
 * Move History's data-URL previews (`revision-previews`, one string per revision)
 * into the preview store, one revision's picture per step. The legacy value is
 * deleted in the same transaction that bound and read back the new form, and the
 * usage count moves from the text size to the byte size. A value that does not
 * decode is left where it is.
 */
export async function migrateRevisionPreviews(db: IDBPDatabase, options: MigrationOptions = {}): Promise<boolean> {
  if (!db.objectStoreNames.contains('revision-previews') || !db.objectStoreNames.contains('revisions')) return true;
  let after: string | undefined;
  for (;;) {
    if (options.stop?.()) return false;
    const range = after !== undefined ? IDBKeyRange.lowerBound(after, true) : undefined;
    const keys = await db.getAllKeys('revision-previews', range, options.batch ?? BATCH) as string[];
    if (!keys.length) return true;
    const values = new Map<string, string>();
    const prepared = new Map<string, PreparedPicture>();
    for (const id of keys) {
      const value = await db.get('revision-previews', id) as unknown;
      if (typeof value !== 'string') continue;
      values.set(id, value);
      const picture = await preparePicture(value, 'legacy').catch(() => null);
      if (picture && isPrepared(picture)) prepared.set(id, picture);
    }
    const tx = db.transaction(['revision-previews', 'revision-usage', 'revisions', PREVIEW_BLOBS, PREVIEW_INDEX], 'readwrite');
    const usage = { bytes: 0, previews: 0, ...(await tx.objectStore('revision-usage').get('total') as { bytes?: number; previews?: number } | undefined) };
    for (const id of keys) {
      after = id;
      const value = values.get(id);
      const picture = prepared.get(id);
      if (value === undefined || !picture) continue;
      if (await tx.objectStore('revision-previews').get(id) !== value) continue;
      if (!await tx.objectStore('revisions').count(id)) {
        // A preview whose checkpoint is gone (budget eviction drops these first).
        await tx.objectStore('revision-previews').delete(id);
        usage.previews -= textBytes(value);
        continue;
      }
      await bindOwner(tx, revisionOwner(id), 'revision', picture);
      if ((await ownerRef(tx, revisionOwner(id)))?.key !== picture.ref.key) continue;
      await tx.objectStore('revision-previews').delete(id);
      usage.previews += picture.bytes.byteLength - textBytes(value);
    }
    await tx.objectStore('revision-usage').put({ bytes: Math.max(0, usage.bytes), previews: Math.max(0, usage.previews) }, 'total');
    await tx.done;
  }
}

/** Move the export log's data-URL pictures into the preview store. At most a
 *  couple of dozen rows, so one pass, one row per transaction. */
export async function migrateExportPictures(db: IDBPDatabase, options: MigrationOptions = {}): Promise<boolean> {
  if (!db.objectStoreNames.contains('exports')) return true;
  for (const entry of await db.getAll('exports') as Array<ExportEntry>) {
    if (options.stop?.()) return false;
    if (typeof entry.thumb !== 'string' || !entry.thumb) continue;
    const picture = await preparePicture(entry.thumb, 'legacy').catch(() => null);
    if (!picture || !isPrepared(picture)) continue;
    const tx = db.transaction(['exports', PREVIEW_BLOBS, PREVIEW_INDEX], 'readwrite');
    const current = await tx.objectStore('exports').get(entry.id) as ExportEntry | undefined;
    if (current && current.thumb === entry.thumb) {
      const ref = await bindOwner(tx, exportOwner(entry.id), 'export', picture);
      if (ref && (await ownerRef(tx, exportOwner(entry.id)))?.key === ref.key) await tx.objectStore('exports').put({ ...current, thumb: null, preview: ref });
    }
    await tx.done;
  }
  return true;
}

/** Pictures no owner points at, older than an hour (a write that stored bytes and
 *  then never committed its record). Returns how many went. */
export async function sweepOrphanPictures(db: IDBPDatabase, options: MigrationOptions = {}, now = Date.now()): Promise<number> {
  let removed = 0;
  const keys = await db.getAllKeys(PREVIEW_BLOBS) as string[];
  for (const key of keys) {
    if (options.stop?.()) break;
    const tx = db.transaction([PREVIEW_BLOBS, PREVIEW_INDEX], 'readwrite');
    if (!await tx.objectStore(PREVIEW_INDEX).index('content').count(key)) {
      const row = await tx.objectStore(PREVIEW_BLOBS).get(key) as PreviewBlobRow | undefined;
      if (row && now - (row.at ?? 0) > 3_600_000) { await tx.objectStore(PREVIEW_BLOBS).delete(key); removed++; }
    }
    await tx.done;
  }
  return removed;
}
