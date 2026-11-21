// SPDX-License-Identifier: MPL-2.0
/**
 * The cache side of the preview store (plan 373, section 5.7): pictures that can
 * be drawn again from a recipe (gallery covers, template previews, published,
 * team, collab and 3D scene tiles), found by recipe key.
 *
 * A cache row is `cache:<recipe key>` in `preview-index`, pointing at a picture in
 * `preview-blobs`, with a `usedAt` stamp written at most once a day. Its
 * bookkeeping is that row alone (well under 300 bytes, where the old cache kept a
 * 15 KB signature beside every picture). The cache is held to 64 MiB or 5 % of the
 * browser's quota, whichever is smaller, least recently used first; a picture a
 * saved session also holds is counted here but not deleted by the sweep, because
 * its other owner keeps the picture.
 *
 * Every call is best-effort: a failed read is a miss and a failed write is logged
 * and forgotten, so a preview never breaks the view that asked.
 */
import type { IDBPDatabase } from 'idb';
import {
  PREVIEW_BLOBS, PREVIEW_INDEX, PREVIEW_STORES, bindOwner, cacheOwner, hasPreviewStores, pictureSrc, putPictureBytes, releaseOwner, scopeFor, type PreparedPicture, type PreviewIndexRow, type SessionPreviewRef,
} from '../bridge/preview-store.ts';

const DAY = 86_400_000;
const CACHE_CEILING = 64 * 1024 * 1024;

async function database(): Promise<IDBPDatabase | null> {
  try {
    const { openDB } = await import('../bridge/db.ts');
    const db = await openDB();
    return hasPreviewStores(db) ? db : null;
  } catch { return null; }
}

/** Pictures found in the cache since the page loaded, and pictures written. */
const counts = { hits: 0, writes: 0 };
export function previewCacheCounts(): Readonly<typeof counts> { return counts; }

/** An `<img>` source for a cached picture, or null on a miss. */
export async function cachedPreview(recipe: string): Promise<string | null> {
  const db = await database();
  if (!db) return null;
  try {
    const row = await db.get(PREVIEW_INDEX, cacheOwner(recipe)) as PreviewIndexRow | undefined;
    if (!row) return null;
    const src = await pictureSrc(db, row.content);
    if (!src) return null;
    counts.hits++;
    if (!row.usedAt || Date.now() - row.usedAt > DAY) void db.put(PREVIEW_INDEX, { ...row, usedAt: Date.now() }).catch(() => {});
    return src;
  } catch { return null; }
}

/** Store a picture under its recipe and return its `<img>` source. On a database
 *  without the preview store the picture is still shown, just not kept. */
export async function storePreview(recipe: string, picture: PreparedPicture): Promise<string> {
  const db = await database();
  if (db) {
    try {
      const tx = db.transaction([...PREVIEW_STORES], 'readwrite');
      await bindOwner(tx, cacheOwner(recipe), 'cache', picture);
      await tx.done;
      counts.writes++;
      // Held to its limit as it grows, not only after a quota error: team and collab
      // tiles add an entry for every revision they show.
      if (counts.writes % 50 === 0) void sweepPreviewCache().catch(() => 0);
      const src = await pictureSrc(db, picture.ref.key);
      if (src) return src;
    } catch (error) {
      if ((error as { name?: string })?.name === 'QuotaExceededError') void sweepPreviewCache(0).catch(() => 0);
      console.warn('[lolly:previews] A preview could not be kept; it is shown for this visit.', error);
    }
  }
  const { srcForBlob } = await import('./preview-urls.ts');
  return srcForBlob(picture.ref.key, new Blob([picture.bytes.slice()], { type: picture.ref.type }));
}

/** The cache's share of storage: 64 MiB or 5 % of the quota, the smaller. */
export async function previewCacheBudget(): Promise<number> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.quota) return Math.min(CACHE_CEILING, Math.floor(estimate.quota * 0.05));
  } catch { /* no estimate */ }
  return CACHE_CEILING;
}

/** Bytes and pictures the cache rows point at. */
export async function previewCacheUsage(): Promise<{ bytes: number; count: number }> {
  const db = await database();
  if (!db) return { bytes: 0, count: 0 };
  try {
    const rows = await db.getAll(PREVIEW_INDEX, IDBKeyRange.bound('cache:', 'cache:￿')) as PreviewIndexRow[];
    return { bytes: rows.reduce((sum, row) => sum + (row.size ?? 0), 0), count: rows.length };
  } catch { return { bytes: 0, count: 0 }; }
}

/** Bytes every stored picture occupies, owned and cached, for Settings > Storage. */
export async function previewStoreBytes(): Promise<number> {
  const db = await database();
  if (!db) return 0;
  try {
    let bytes = 0;
    let cursor = await db.transaction(PREVIEW_BLOBS).store.openCursor();
    while (cursor) { bytes += (cursor.value as { size?: number }).size ?? 0; cursor = await cursor.continue(); }
    return bytes;
  } catch { return 0; }
}

/** Drop cache rows, least recently used first, until the cache is within `budget`. A
 *  picture another owner still holds stays. Returns how many rows went. */
export async function sweepPreviewCache(budget?: number): Promise<number> {
  const db = await database();
  if (!db) return 0;
  const limit = budget ?? await previewCacheBudget();
  const rows = (await db.getAll(PREVIEW_INDEX, IDBKeyRange.bound('cache:', 'cache:￿')) as PreviewIndexRow[])
    .sort((a, b) => (a.usedAt ?? a.at) - (b.usedAt ?? b.at));
  let total = rows.reduce((sum, row) => sum + (row.size ?? 0), 0);
  let removed = 0;
  for (const row of rows) {
    if (total <= limit) break;
    const tx = db.transaction([...PREVIEW_STORES], 'readwrite');
    await releaseOwner(tx, row.id);
    await tx.done;
    total -= row.size ?? 0; removed++;
  }
  return removed;
}

/** Empty the cache (Settings > Storage "Clear tool previews"). Saved work keeps
 *  its pictures: only cache rows go. */
export async function clearPreviewCache(): Promise<void> {
  await sweepPreviewCache(-1);
}

/**
 * Give a saved session a picture drawn on idle time (a redraw of a stale tile),
 * only when the record has not changed since the picture was drawn. The record's
 * times do not move: a new picture is not new work.
 */
export async function attachSessionPicture(db: IDBPDatabase, slot: string, updatedAt: string, picture: PreparedPicture): Promise<SessionPreviewRef | null> {
  if (!hasPreviewStores(db)) return null;
  const { putStateRecord, withPicture } = await import('../bridge/state-rows.ts');
  const tx = db.transaction(scopeFor(db, ['state']), 'readwrite');
  const record = await tx.objectStore('state').get(slot) as import('../bridge/state.ts').StateRecord | undefined;
  if (!record || record.updatedAt !== updatedAt) { await tx.done; return null; }
  await putPictureBytes(tx, picture);
  const next = await withPicture(tx, record, picture);
  await putStateRecord(tx, next);
  await tx.done;
  return next.preview ?? null;
}

/** How many pages a paged tool's cached preview set holds (a tiny row beside the
 *  pictures, so a stored set needs no render to be read back). */
export async function cachedPageCount(recipe: string): Promise<number | null> {
  const db = await database();
  if (!db) return null;
  try {
    const row = await db.get(PREVIEW_INDEX, `pages:${recipe}`) as { count?: unknown } | undefined;
    return typeof row?.count === 'number' && row.count > 0 ? row.count : null;
  } catch { return null; }
}

export async function storePageCount(recipe: string, count: number): Promise<void> {
  const db = await database();
  if (!db) return;
  try { await db.put(PREVIEW_INDEX, { id: `pages:${recipe}`, kind: 'meta', count, at: Date.now() }); } catch { /* best-effort */ }
}

/** The host surface Settings > Storage and the dashboard read (`host.previews`):
 *  the cache's rows, their bytes, and "Clear tool previews". Not part of the tool
 *  contract. */
export interface PreviewCacheAPI {
  list(): Promise<Array<{ id: string; size: number }>>;
  size(): Promise<number>;
  clear(): Promise<void>;
}

export function createPreviewCacheAPI(): PreviewCacheAPI {
  return {
    async list() {
      const db = await database();
      if (!db) return [];
      try {
        const rows = await db.getAll(PREVIEW_INDEX, IDBKeyRange.bound('cache:', 'cache:￿')) as PreviewIndexRow[];
        return rows.map(row => ({ id: row.id, size: row.size ?? 0 }));
      } catch { return []; }
    },
    async size() { return (await previewCacheUsage()).bytes; },
    clear: clearPreviewCache,
  };
}
