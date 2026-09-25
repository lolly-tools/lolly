// SPDX-License-Identifier: MPL-2.0
/**
 * A byte-bounded LRU for decoded slide pictures (plan 274 section 9, "Memory";
 * the Codex review section 5: "Bound caches in bytes, release ImageBitmaps,
 * canvases and object URLs when evicted").
 *
 * WHY BYTES AND NOT ENTRY COUNT
 * A count bounds nothing: forty thumbnails and forty full previews are the same
 * count and two orders of magnitude apart in memory. The ceiling here is the
 * budget's maxCacheBytes, and an entry states its own decoded size, so the sum is
 * what gets held under the ceiling.
 *
 * WHAT THE CACHE OWNS
 * It owns release, not decode. A caller hands over an entry that may carry an
 * ImageBitmap, an object URL, or both; on eviction, on replacement, on delete and
 * on clear the cache calls close() and revokes the URL exactly once.
 *
 * WHAT A REFUSAL DOES NOT DO
 * An entry whose own size is over the whole ceiling, or whose size is not a
 * finite number, is refused: set() returns false, the cache stores nothing and
 * takes ownership of nothing, so the refused picture stays the caller's to close.
 * A refusal also leaves whatever was already held at that key exactly where it
 * was: a refused write must not cost the caller a picture it was already
 * drawing from.
 *
 * KEY
 * (assetRef, longEdge, planRevision?). The asset ref is the exact media hash, the
 * long edge is the rung of the resolution ladder, and the plan revision is there
 * for a proposed picture, which changes when a decision changes. A source picture
 * passes no revision, so changing a decision never evicts the originals.
 *
 * Nothing here reads storage or the clock. `stats()` carries a high-water mark so
 * plan 274's memory measurement has a number to record.
 */
import type { DecodeBudgetV1 } from '@lolly-tools/core';

/** The part of an ImageBitmap (or a canvas) this cache needs. */
export interface CloseableBitmapV1 {
  close?: () => void;
  readonly width?: number;
  readonly height?: number;
}

export interface BitmapCacheKeyV1 {
  /** Exact media hash of the source bytes. Never a blob URL and never base64. */
  assetRef: string;
  /** The ladder rung this picture was decoded at. */
  longEdge: number;
  /** Set for a proposed picture, which is bound to a plan revision. */
  planRevision?: number;
}

export interface BitmapCacheEntryV1 {
  /** The decoded picture, released with close() on eviction. */
  bitmap?: CloseableBitmapV1 | null;
  /** An object URL for the same picture, revoked on eviction. */
  objectUrl?: string;
  /** Decoded size in bytes. The caller knows it; the cache never guesses. */
  bytes: number;
}

export interface BitmapCacheStatsV1 {
  bytesUsed: number;
  maxBytes: number;
  entries: number;
  /** Largest bytesUsed this cache ever held. */
  highWaterBytes: number;
  /** Largest entry count this cache ever held. */
  highWaterEntries: number;
  evictions: number;
  /** Entries refused because one alone would exceed the ceiling. */
  refusals: number;
  hits: number;
  misses: number;
}

export interface BitmapCacheOptsV1 {
  maxBytes: number;
  /** Replaceable so a test can count revocations without a browser. */
  revokeObjectUrl?: (url: string) => void;
}

export interface BitmapCacheV1 {
  get(key: BitmapCacheKeyV1): BitmapCacheEntryV1 | undefined;
  has(key: BitmapCacheKeyV1): boolean;
  /**
   * Stores the entry, evicting the oldest until the total is under the ceiling.
   * Returns false when the entry alone is over the ceiling or states no finite
   * size; nothing is stored, nothing already held is disturbed, and the refused
   * entry is the caller's to release.
   */
  set(key: BitmapCacheKeyV1, entry: BitmapCacheEntryV1): boolean;
  /** Releases and removes one entry. Returns whether it was there. */
  delete(key: BitmapCacheKeyV1): boolean;
  /** Releases every entry whose asset ref matches. Returns how many went. */
  deleteAsset(assetRef: string): number;
  /** Releases every entry bound to a plan revision other than this one. Returns how many went. */
  deleteStaleRevisions(currentRevision: number): number;
  clear(): void;
  bytesUsed(): number;
  maxBytes(): number;
  size(): number;
  stats(): BitmapCacheStatsV1;
}

function defaultRevoke(url: string): void {
  const revoker = (globalThis as { URL?: { revokeObjectURL?: (u: string) => void } }).URL;
  try { revoker?.revokeObjectURL?.(url); } catch { /* a revoke must never break an eviction */ }
}

function keyOf(key: BitmapCacheKeyV1): string {
  // A null byte cannot appear in an asset ref, so the parts cannot run together.
  return `${key.assetRef}\u0000${key.longEdge}\u0000${key.planRevision ?? ''}`;
}

/** A byte-bounded LRU. Insertion order in a Map is the recency order; a get reinserts. */
export function createBitmapCache(opts: BitmapCacheOptsV1): BitmapCacheV1 {
  // A ceiling that is not a finite number would make every comparison below
  // false and every eviction unbounded, so a nonsense budget becomes a ceiling of
  // zero: the cache then refuses everything instead of holding NaN bytes.
  const ceiling = Number.isFinite(opts.maxBytes) ? Math.max(0, Math.floor(opts.maxBytes)) : 0;
  const revoke = opts.revokeObjectUrl ?? defaultRevoke;
  const entries = new Map<string, { entry: BitmapCacheEntryV1; bytes: number; revision?: number; assetRef: string }>();

  let used = 0;
  let highWaterBytes = 0;
  let highWaterEntries = 0;
  let evictions = 0;
  let refusals = 0;
  let hits = 0;
  let misses = 0;

  function release(entry: BitmapCacheEntryV1): void {
    try { entry.bitmap?.close?.(); } catch { /* a closed bitmap must not break an eviction */ }
    if (entry.objectUrl) revoke(entry.objectUrl);
  }

  function drop(k: string): void {
    const held = entries.get(k);
    if (!held) return;
    entries.delete(k);
    used -= held.bytes;
    if (used < 0) used = 0;
    release(held.entry);
  }

  function mark(): void {
    if (used > highWaterBytes) highWaterBytes = used;
    if (entries.size > highWaterEntries) highWaterEntries = entries.size;
  }

  function evictTo(limit: number): void {
    for (const k of [...entries.keys()]) {
      if (used <= limit) return;
      drop(k);
      evictions++;
    }
  }

  return {
    get(key) {
      const k = keyOf(key);
      const held = entries.get(k);
      if (!held) { misses++; return undefined; }
      hits++;
      // Reinsert so the Map's order stays newest last.
      entries.delete(k);
      entries.set(k, held);
      return held.entry;
    },
    has(key) { return entries.has(keyOf(key)); },
    set(key, entry) {
      const raw = Number(entry.bytes);
      // A size of NaN or undefined would pass a `>` test and then poison the
      // running total for good, so it takes the refusal path with an oversized
      // entry rather than the accounting path.
      const bytes = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : Number.POSITIVE_INFINITY;
      if (bytes > ceiling) {
        // Holding it would put the cache over its ceiling on its own, so it never
        // goes in, whatever is already at that key stays, and the caller keeps
        // ownership of what it offered.
        refusals++;
        return false;
      }
      const k = keyOf(key);
      drop(k);
      entries.set(k, { entry, bytes, revision: key.planRevision, assetRef: key.assetRef });
      used += bytes;
      evictTo(ceiling);
      mark();
      return true;
    },
    delete(key) {
      const k = keyOf(key);
      if (!entries.has(k)) return false;
      drop(k);
      return true;
    },
    deleteAsset(assetRef) {
      let gone = 0;
      for (const [k, held] of [...entries]) {
        if (held.assetRef !== assetRef) continue;
        drop(k);
        gone++;
      }
      return gone;
    },
    deleteStaleRevisions(currentRevision) {
      let gone = 0;
      for (const [k, held] of [...entries]) {
        if (held.revision === undefined || held.revision === currentRevision) continue;
        drop(k);
        gone++;
      }
      return gone;
    },
    clear() {
      for (const k of [...entries.keys()]) drop(k);
      used = 0;
    },
    bytesUsed() { return used; },
    maxBytes() { return ceiling; },
    size() { return entries.size; },
    stats() {
      return {
        bytesUsed: used,
        maxBytes: ceiling,
        entries: entries.size,
        highWaterBytes,
        highWaterEntries,
        evictions,
        refusals,
        hits,
        misses,
      };
    },
  };
}

/** The cache a device class gets, sized from its decode budget. */
export function bitmapCacheFor(budget: DecodeBudgetV1, revokeObjectUrl?: (url: string) => void): BitmapCacheV1 {
  return createBitmapCache({ maxBytes: budget.maxCacheBytes, ...(revokeObjectUrl ? { revokeObjectUrl } : {}) });
}
