// SPDX-License-Identifier: MPL-2.0
/**
 * AssetsAPI — global catalog + user uploads, presented as one surface.
 *
 * Resolution order for host.assets.get(id):
 *   1. user-assets store (if id starts with 'user/')
 *   2. asset-blob store (cached library asset)
 *   3. on-demand fetch from catalog URL (if 'on-demand' tier and net OK)
 *   4. throw if unavailable
 *
 * Tier behaviour:
 *   - core      → bundled with shell, always present
 *   - catalog   → synced at boot via catalog/sync.js
 *   - on-demand → fetched lazily, then cached
 */

import type { AssetsAPI, AssetQuery, AssetPickerOpts, AssetRef } from '../../../../engine/src/bridge/host-v1.ts';
import type { IDBPDatabase } from 'idb';

const OBJECT_URL_CACHE = new Map<string, string>(); // key → blob URL, kept alive while bridge is.

/**
 * Max number of device images a user may keep in their personal library.
 * Enforced at the bridge boundary (see _uploadUserAsset) so the cap holds
 * regardless of which UI initiated the upload. Tunable.
 *
 * At a typical ~100–200 KB/image (post-downscale WebP), 50 is ≤~10 MB total —
 * comfortably within every browser's quota incl. conservative Safari/iOS, while
 * keeping the picker + "My images" grids scannable. assertQuotaRoom() remains
 * the hard backstop if storage is genuinely tight.
 */
export const MAX_USER_ASSETS = 50;

// Refuse a write that would push storage past this fraction of the quota,
// rather than letting IndexedDB throw a QuotaExceededError mid-write.
const QUOTA_SAFETY_FRACTION = 0.9;

/** One resolvable file for a catalog asset (an entry in AssetMetaRecord.formats). */
export interface AssetFormat {
  format: string;
  url: string;
  checksum?: string;
}

/** A catalog asset's stored metadata (the 'asset-meta' IDB store). */
export interface AssetMetaRecord {
  id: string;
  type: AssetRef['type'];
  name?: string;
  tags?: string[];
  version?: string | number;
  tier?: string;
  deprecated?: boolean;
  checksum?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
  formats: AssetFormat[];
}

/** A user-uploaded asset (the 'user-assets' IDB store) — already resolved to one blob/format. */
export interface UserAssetRecord {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string | number;
  checksum?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
}

/** A catalog record resolved to one concrete blob/format, ready for toAssetRef. */
type ResolvedCatalogRecord = AssetMetaRecord & { blob?: Blob; format: string };

/** The slice of the idb database this API touches (the asset-* + user-assets stores). */
export interface AssetsDb {
  get(store: 'user-assets', id: string): Promise<UserAssetRecord | undefined>;
  get(store: 'asset-meta', id: string): Promise<AssetMetaRecord | undefined>;
  get(store: 'asset-blob', key: string): Promise<Blob | undefined>;
  getAll(store: 'user-assets'): Promise<UserAssetRecord[]>;
  getAll(store: 'asset-meta'): Promise<AssetMetaRecord[]>;
  getAll(store: 'asset-blob'): Promise<Blob[]>;
  // idb's real getAllKeys() returns the DOM-wide IDBValidKey union (string |
  // number | Date | ArrayBuffer | ...), since IDBPDatabase has no way to know
  // our schema always keys these three stores by string (keyPath 'id', or a
  // manually-built `${id}:${format}:${version}` string for asset-blob). Kept
  // honest here rather than narrowed to string[], so this interface stays a
  // real structural subtype of the actual db handle; onlyStringKeys() below
  // narrows it back at the two call sites that need string[].
  getAllKeys(store: 'user-assets'): Promise<IDBValidKey[]>;
  getAllKeys(store: 'asset-meta'): Promise<IDBValidKey[]>;
  getAllKeys(store: 'asset-blob'): Promise<IDBValidKey[]>;
  put(store: 'user-assets', record: UserAssetRecord): Promise<unknown>;
  put(store: 'asset-blob', blob: Blob, key: string): Promise<unknown>;
  delete(store: 'user-assets', id: string): Promise<void>;
  // Reused verbatim from idb's own IDBPDatabase, rather than a hand-written
  // shape: idb's `store.put`/`store.delete` types are conditional on the
  // Mode type parameter (readonly transactions have no put/delete), so a
  // structurally-independent redeclaration can't be compared against the
  // real generic method without TS falling back to its worst-case (readonly
  // | readwrite) union. Reusing the exact method type sidesteps that: at each
  // real call site below, literal args ('asset-meta', 'readwrite') let TS
  // instantiate Mode concretely, resolving store.put/delete to real functions.
  transaction: IDBPDatabase<unknown>['transaction'];
}

/** The web shell's assets surface: HostV1's AssetsAPI plus internal (underscore) helpers
 *  used by the picker UI, catalog sync, and data-transfer backup/restore. Not part of
 *  the public v1 bridge contract. */
/** The web picker's opts: the v1 contract plus web-only host-UI chrome. */
export interface WebAssetPickerOpts extends AssetPickerOpts {
  /** Configure-then-insert: open this tool URL in the embed editor first (see
   *  views/tool/embed-editor.ts); choosing a tool in the picker calls it. */
  editTool?(toolUrl: string): Promise<AssetRef | null>;
}

export interface WebAssetsAPI extends AssetsAPI {
  /** Web pick accepts the extended opts (editTool). */
  pick(opts: WebAssetPickerOpts): Promise<AssetRef | null>;
  _uploadUserAsset(record: UserAssetRecord): Promise<void>;
  _listUserAssets(): Promise<AssetRef[]>;
  _exportUserAssets(): Promise<UserAssetRecord[]>;
  _importUserAsset(record: UserAssetRecord): Promise<void>;
  _userAssetsCount(): Promise<number>;
  _userAssetsSize(): Promise<number>;
  _deleteUserAsset(id: string): Promise<void>;
  _syncFromIndex(assets: AssetMetaRecord[]): Promise<void>;
  _cacheBlob(key: string, blob: Blob): Promise<void>;
  _hasBlob(key: string): Promise<boolean>;
  _getBlob(id: string, opts?: { format?: string; version?: string }): Promise<Blob | null>;
  _blobCacheSize(): Promise<number>;
  _pruneStale(currentAssets: AssetMetaRecord[], sessionBlobKeys?: Set<string>): Promise<{ blobs: number; meta: number }>;
}

export function createAssetsAPI(db: AssetsDb): WebAssetsAPI {
  return {
    async get(id: string, opts: { format?: string; version?: string } = {}): Promise<AssetRef> {
      if (id.startsWith('user/')) {
        const userAsset = await db.get('user-assets', id);
        if (!userAsset) throw new Error(`User asset not found: ${id}`);
        return toAssetRef(userAsset, 'user');
      }

      const meta = await db.get('asset-meta', id);
      if (!meta) throw new Error(`Asset not in catalog: ${id}`);

      const format = pickFormat(meta, opts.format);
      const version = opts.version ?? meta.version;
      const blobKey = `${id}:${format.format}:${version}`;

      let blob = await db.get('asset-blob', blobKey);
      if (!blob) {
        if (meta.tier === 'on-demand') {
          blob = await fetchAndCache(meta, format, blobKey, db);
        } else {
          throw new Error(`Asset not cached: ${id} (tier: ${meta.tier})`);
        }
      }

      return toAssetRef({ ...meta, blob, format: format.format }, 'library');
    },

    async query(filter: AssetQuery = {}): Promise<AssetRef[]> {
      const all = await db.getAll('asset-meta');
      const filtered = all.filter(m => matchesFilter(m, filter));
      // Don't pre-resolve blob URLs — that forces every cached blob into memory.
      // Every format carries a static catalog URL (same-origin for core/catalog,
      // CDN for on-demand), so the picker can show a thumbnail directly without a
      // cached blob first. Only flag a placeholder when there's genuinely no URL
      // to resolve (an unresolved/on-demand tier with no static formats[0].url).
      return filtered.map((m): AssetRef => {
        const directUrl = m.formats[0]?.url ?? '';
        return {
          source: 'library',
          id: m.id,
          type: m.type,
          format: m.formats[0]?.format ?? 'svg',
          url: directUrl,
          version: m.version === undefined ? undefined : String(m.version),
          meta: { name: m.name, tags: m.tags, _placeholder: !directUrl },
        };
      });
    },

    /**
     * Internal: called only by the picker UI to stash an uploaded blob.
     * Tools cannot call this directly — it's prefixed with _ to mark it as
     * non-public, and not declared in the v1 bridge contract.
     *
     * Enforces the personal-library cap and a quota safety net here, at the
     * bridge boundary, so neither can be bypassed by a different caller.
     * Replacing an existing id (same record.id) does not count against the cap.
     */
    async _uploadUserAsset(record: UserAssetRecord): Promise<void> {
      const keys = onlyStringKeys(await db.getAllKeys('user-assets'));
      // The reserved profile headshot ('user/headshot') lives in this store but is not a
      // library image — exclude it from the cap so the UI's "N/MAX" count (which hides the
      // headshot) and the bridge agree, and a saved headshot never eats a library slot.
      const HEADSHOT_KEY = 'user/headshot';
      const libraryCount = keys.filter(k => k !== HEADSHOT_KEY).length;
      if (record.id !== HEADSHOT_KEY && !keys.includes(record.id) && libraryCount >= MAX_USER_ASSETS) {
        throw userAssetError(
          `You've reached your limit of ${MAX_USER_ASSETS} saved images. Remove one to add another.`,
          'USER_ASSET_LIMIT',
        );
      }
      await assertQuotaRoom(record.blob?.size ?? 0);
      await db.put('user-assets', record);
    },

    /** Internal: list the user's saved images, newest first, as resolved AssetRefs. */
    async _listUserAssets(): Promise<AssetRef[]> {
      const all = await db.getAll('user-assets');
      return all
        .sort((a, b) => String(b.id).localeCompare(String(a.id)))
        .map(rec => toAssetRef(rec, 'user'));
    },

    /**
     * Internal: full user-asset records *including the raw Blob*, for the data
     * backup/export. Unlike _listUserAssets (which returns AssetRefs without the
     * bytes), this hands back exactly what's stored so a bundle can round-trip it.
     */
    async _exportUserAssets(): Promise<UserAssetRecord[]> {
      return db.getAll('user-assets');
    },

    /**
     * Internal: write a user-asset record straight back in from a backup import.
     * Deliberately bypasses the personal-library cap and quota check — a restore
     * should faithfully reproduce the library the user exported, not be rejected
     * for being "too big" on arrival.
     */
    async _importUserAsset(record: UserAssetRecord): Promise<void> {
      await db.put('user-assets', record);
    },

    /** Internal: how many images are in the user's personal library. */
    async _userAssetsCount(): Promise<number> {
      return (await db.getAllKeys('user-assets')).length; // count is key-type-agnostic
    },

    /** Internal: total bytes the user's images occupy (for the storage UI). */
    async _userAssetsSize(): Promise<number> {
      const all = await db.getAll('user-assets');
      return all.reduce((sum, r) => sum + (r?.blob?.size ?? 0), 0);
    },

    /** Internal: delete one user image and revoke its cached object URL. */
    async _deleteUserAsset(id: string): Promise<void> {
      await db.delete('user-assets', id);
      // toAssetRef keys user URLs as `user:<id>:<format>:<version>` — evict any.
      evictObjectUrlsByPrefix(`user:${id}:`);
    },

    /**
     * Internal: called by catalog/sync.js at boot to populate asset metadata.
     * Not part of the public HostV1 bridge contract.
     */
    async _syncFromIndex(assets: AssetMetaRecord[]): Promise<void> {
      const tx = db.transaction('asset-meta', 'readwrite');
      await Promise.all(assets.map(a => tx.store.put(a)));
      await tx.done;
    },

    /**
     * Internal: cache a pre-fetched asset blob, keyed by id:format:version.
     * Called by prefetchAsset in catalog/sync.js.
     */
    async _cacheBlob(key: string, blob: Blob): Promise<void> {
      await db.put('asset-blob', blob, key);
    },

    async _hasBlob(key: string): Promise<boolean> {
      return (await db.get('asset-blob', key)) !== undefined;
    },

    /**
     * Internal: the raw cached Blob for an asset, without minting an object URL.
     * Used by callers that just want the bytes (e.g. tokens.loadDoc reading a
     * JSON document) so they don't pin an unused URL in OBJECT_URL_CACHE.
     * Resolves on-demand tiers the same way get() does. Returns null if absent.
     */
    async _getBlob(id: string, opts: { format?: string; version?: string } = {}): Promise<Blob | null> {
      const meta = await db.get('asset-meta', id);
      if (!meta) return null;
      const format = pickFormat(meta, opts.format);
      const version = opts.version ?? meta.version;
      const blobKey = `${id}:${format.format}:${version}`;
      let blob = await db.get('asset-blob', blobKey);
      if (!blob && meta.tier === 'on-demand') {
        blob = await fetchAndCache(meta, format, blobKey, db);
      }
      return blob ?? null;
    },

    async _blobCacheSize(): Promise<number> {
      const blobs = await db.getAll('asset-blob');
      return blobs.reduce((sum, b) => sum + (b?.size ?? 0), 0);
    },

    /**
     * Internal: called by syncAssets after writing new metadata.
     *
     * Keeps a blob only if it passes both tests:
     *   1. Its version is current (matches the catalog index).
     *   2. It is either core-tier (always prefetched) OR referenced by a saved session.
     *
     * This prevents on-demand blobs from accumulating when a user browses the
     * asset picker without saving a session.
     *
     * Also prunes metadata for assets no longer in the catalog.
     * Returns { blobs, meta } counts of records deleted.
     */
    async _pruneStale(currentAssets: AssetMetaRecord[], sessionBlobKeys: Set<string> = new Set()): Promise<{ blobs: number; meta: number }> {
      // All keys that exist at the current catalog version.
      const currentVersionKeys = new Set(
        currentAssets.flatMap(a => a.formats.map(f => `${a.id}:${f.format}:${a.version}`)),
      );

      // Core-tier blobs are kept unconditionally (needed for offline).
      const keepBlobKeys = new Set(
        currentAssets
          .filter(a => a.tier === 'core')
          .flatMap(a => a.formats.map(f => `${a.id}:${f.format}:${a.version}`)),
      );

      // Non-core blobs are kept only if a saved session references them (and they're current).
      for (const key of sessionBlobKeys) {
        if (currentVersionKeys.has(key)) keepBlobKeys.add(key);
      }

      const validIds = new Set(currentAssets.map(a => a.id));

      const [allBlobKeys, allMetaKeys] = await Promise.all([
        db.getAllKeys('asset-blob').then(onlyStringKeys),
        db.getAllKeys('asset-meta').then(onlyStringKeys),
      ]);

      const staleBlobs = allBlobKeys.filter(k => !keepBlobKeys.has(k));
      const staleMeta  = allMetaKeys.filter(k => !validIds.has(k));

      if (staleBlobs.length) {
        const tx = db.transaction('asset-blob', 'readwrite');
        await Promise.all(staleBlobs.map(k => tx.store.delete(k)));
        await tx.done;
        // Revoke any live object URLs minted for these now-deleted blobs.
        // toAssetRef keys library URLs as `library:<blobKey>` — without this the
        // OBJECT_URL_CACHE leaks one entry per pruned blob on every sync.
        for (const k of staleBlobs) evictObjectUrl(`library:${k}`);
      }
      if (staleMeta.length) {
        const tx = db.transaction('asset-meta', 'readwrite');
        await Promise.all(staleMeta.map(k => tx.store.delete(k)));
        await tx.done;
      }

      return { blobs: staleBlobs.length, meta: staleMeta.length };
    },

    async isAvailable(id: string): Promise<boolean> {
      if (id.startsWith('user/')) {
        return Boolean(await db.get('user-assets', id));
      }
      const meta = await db.get('asset-meta', id);
      if (!meta) return false;
      if (meta.tier === 'on-demand') return navigator.onLine;
      // For core/catalog, check if at least one format is cached.
      const cached = await Promise.all(
        meta.formats.map(f => db.get('asset-blob', `${id}:${f.format}:${meta.version}`)),
      );
      return cached.some(Boolean);
    },

    async pick(_opts: AssetPickerOpts): Promise<AssetRef | null> {
      // The web shell's actual picker UI lives outside the bridge (views/picker.ts
      // drives host.assets.query/_uploadUserAsset directly); host.assets.pick is
      // part of the v1 contract for hosts that resolve it entirely in-bridge, and
      // is not wired up here. Kept as an explicit reject rather than silently
      // resolving null, matching the AssetsAPI method's documented Promise shape.
      throw new Error('assets.pick is not implemented by this host — the web shell drives its picker directly');
    },
  };
}

/**
 * Narrow an idb getAllKeys() result to string[]. Every key this bridge ever
 * writes to 'user-assets' / 'asset-meta' / 'asset-blob' is a string (keyPath
 * 'id', or a manually-built `${id}:${format}:${version}` composite for
 * asset-blob) — this is a type-safe filter, not a cast, so a future schema
 * change that introduced a non-string key would show up as fewer results
 * here rather than a runtime type violation.
 */
function onlyStringKeys(keys: IDBValidKey[]): string[] {
  return keys.filter((k): k is string => typeof k === 'string');
}

/** Revoke + drop a single object-URL cache entry, if present. */
function evictObjectUrl(cacheKey: string): void {
  const url = OBJECT_URL_CACHE.get(cacheKey);
  if (url) {
    URL.revokeObjectURL(url);
    OBJECT_URL_CACHE.delete(cacheKey);
  }
}

/** Revoke + drop every object-URL cache entry whose key starts with `prefix`. */
function evictObjectUrlsByPrefix(prefix: string): void {
  for (const [key, url] of OBJECT_URL_CACHE) {
    if (key.startsWith(prefix)) {
      URL.revokeObjectURL(url);
      OBJECT_URL_CACHE.delete(key);
    }
  }
}

interface UserAssetError extends Error {
  code: string;
}

function userAssetError(message: string, code: string): UserAssetError {
  const err = new Error(message) as UserAssetError;
  err.code = code;
  return err;
}

/**
 * Best-effort quota guard. Throws STORAGE_FULL if writing `incomingBytes` would
 * push usage past the safety fraction of the quota. If the platform can't
 * estimate (older browsers, private mode), we allow the write — the IDB layer
 * remains the hard backstop.
 */
async function assertQuotaRoom(incomingBytes: number): Promise<void> {
  let est: StorageEstimate | undefined;
  try {
    est = await navigator.storage?.estimate?.();
  } catch {
    return; // estimate() failing must not block uploads.
  }
  if (!est || !est.quota) return;
  const projected = (est.usage ?? 0) + incomingBytes;
  if (projected > est.quota * QUOTA_SAFETY_FRACTION) {
    throw userAssetError(
      'Not enough local storage space for this image. Remove some saved images or sessions and try again.',
      'STORAGE_FULL',
    );
  }
}

function pickFormat(meta: AssetMetaRecord, requested?: string): AssetFormat {
  if (requested) {
    const exact = meta.formats.find(f => f.format === requested);
    if (exact) return exact;
  }
  // Sensible default per type.
  const preferred = meta.type === 'vector' ? meta.formats.find(f => f.format === 'svg') : undefined;
  const fallback = preferred ?? meta.formats[0];
  // Defensive: the catalog schema guarantees ≥1 format per asset, so this never
  // fires in practice — added only to satisfy strict indexed-access checking.
  if (!fallback) throw new Error(`Asset ${meta.id} has no formats`);
  return fallback;
}

function toAssetRef(record: UserAssetRecord | ResolvedCatalogRecord, source: 'user' | 'library'): AssetRef {
  const cacheKey = `${source}:${record.id}:${record.format}:${record.version ?? 'x'}`;
  let url = OBJECT_URL_CACHE.get(cacheKey);
  if (!url && record.blob) {
    url = URL.createObjectURL(record.blob);
    OBJECT_URL_CACHE.set(cacheKey, url);
  }
  return {
    source,
    id: record.id,
    type: record.type,
    format: record.format,
    url: url ?? '',
    version: record.version === undefined ? undefined : String(record.version),
    checksum: record.checksum,
    width: record.width,
    height: record.height,
    meta: record.meta,
  };
}

function matchesFilter(meta: AssetMetaRecord, filter: AssetQuery): boolean {
  if (filter.type && meta.type !== filter.type) return false;
  if (filter.namespace && !meta.id.startsWith(filter.namespace + '/') && meta.id !== filter.namespace) return false;
  if (filter.tags?.length) {
    const tags = new Set(meta.tags ?? []);
    if (!filter.tags.every(t => tags.has(t))) return false;
  }
  if (!filter.includeDeprecated && meta.deprecated) return false;
  return true;
}

async function fetchAndCache(meta: AssetMetaRecord, format: AssetFormat, blobKey: string, db: AssetsDb): Promise<Blob> {
  const resp = await fetch(format.url);
  if (!resp.ok) throw new Error(`Failed to fetch asset: ${resp.status}`);
  const blob = await resp.blob();
  await verifyAssetChecksum(blob, format);
  await db.put('asset-blob', blob, blobKey);
  return blob;
}

/**
 * SRI SHA-256 (`sha256-<base64>`) for a blob's bytes, byte-for-byte matching the
 * build-time format from scripts/checksum-assets.js — there it's
 * createHash('sha256').digest('base64'); Node's base64 alphabet + `=` padding is
 * identical to btoa over the raw digest, so the strings compare equal.
 */
async function sriForBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return `sha256-${btoa(bin)}`;
}

/**
 * Verify freshly-fetched bytes against the catalog checksum, throwing on a real
 * mismatch (tampered/corrupt download). No-ops when the format carries no
 * checksum or the runtime lacks crypto.subtle (non-secure context) — integrity
 * is a guard, not a hard gate that should brick loading on edge runtimes. The
 * deployed catalog's checksums are kept current by validate-catalog.js (CI), so
 * this never false-positives on a correctly-published asset.
 */
export async function verifyAssetChecksum(blob: Blob, format: AssetFormat | undefined): Promise<void> {
  if (!format?.checksum || !globalThis.crypto?.subtle) return;
  const actual = await sriForBlob(blob);
  if (actual !== format.checksum) {
    throw new Error(
      `Asset checksum mismatch for ${format.url}: expected ${format.checksum}, got ${actual}`,
    );
  }
}
