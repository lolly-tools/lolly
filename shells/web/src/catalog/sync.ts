// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog sync.
 *
 * On boot, fetch the tool catalog manifest and asset catalog manifest from
 * known URLs. Diff against IndexedDB. Update meta. Prefetch core-tier assets.
 *
 * The catalog URL is environment-configured (defaults to /catalog/ for the
 * MVP, which serves from the same origin). In Tauri this will point to the
 * production CDN with checksum verification.
 *
 * Sync is idempotent and resumable. Network failure ≠ broken app — we fall back
 * to whatever is in cache and flip `networkStatus.offline`, which surfaces a small
 * self-contained "offline" chip (and is readable by views that want their own
 * indicator).
 */

import { verifyAssetChecksum } from '../bridge/assets.ts';
import type { AssetMetaRecord } from '../bridge/assets.ts';

/** The tool catalog index as fetched from /catalog/tools/index.json. */
export interface ToolIndex {
  tools: Array<{ id: string } & Record<string, unknown>>;
}

/** The asset catalog index as fetched from /catalog/assets/index.json. Each entry
 *  is the same shape the bridge stores as asset metadata (AssetMetaRecord), so it
 *  flows straight into host.assets._syncFromIndex with no second shape to keep in
 *  step — the parse below is the trust boundary that vouches for it. */
export interface AssetIndex {
  assets: AssetMetaRecord[];
}

/** The slice of the host bridge catalog sync drives. */
interface SyncHost {
  log(level: string, msg: string, data?: Record<string, unknown>): void;
  assets: {
    _syncFromIndex(assets: AssetMetaRecord[]): Promise<unknown>;
    _pruneStale(assets: AssetMetaRecord[], sessionRefs: unknown): Promise<{ blobs: number; meta: number }>;
    _hasBlob(key: string): Promise<boolean>;
    _cacheBlob(key: string, blob: Blob): Promise<unknown>;
  };
  state: { _getAssetRefs(): Promise<unknown> };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
/** Exported so callers who read the localStorage cache directly (e.g. the shell's
 *  boot-time prime) validate at that trust boundary the same way sync does. */
export function isToolIndex(v: unknown): v is ToolIndex {
  return isRecord(v) && Array.isArray(v.tools);
}
function isAssetIndex(v: unknown): v is AssetIndex {
  return isRecord(v) && Array.isArray(v.assets);
}

const CATALOG_BASE = '/catalog';
const LS_PREFIX = 'sbt-catalog:';

/**
 * Set true whenever a catalog/asset sync falls back to cache instead of fresh
 * network data (offline or a failed fetch). Exported as a live, mutable object so
 * views can read `networkStatus.offline` without importing a getter.
 */
export const networkStatus = { offline: false };

function setOffline(value: boolean): void {
  networkStatus.offline = value;
  renderOfflineChip(value);
}

/**
 * Minimal, self-contained offline chip. Non-interactive (pointer-events:none) so
 * it can never steal focus or intercept clicks — a richer indicator belongs in a
 * view, which can read networkStatus.offline directly.
 */
function renderOfflineChip(offline: boolean): void {
  if (typeof document === 'undefined' || !document.body) return;
  let chip = document.getElementById('sbt-offline-chip');
  if (!offline) {
    if (chip) chip.hidden = true;
    return;
  }
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'sbt-offline-chip';
    chip.setAttribute('role', 'status');
    chip.setAttribute('aria-live', 'polite');
    chip.textContent = 'Offline — showing saved content';
    chip.style.cssText = [
      'position:fixed', 'left:12px', 'bottom:12px', 'z-index:2147483647',
      'pointer-events:none', 'padding:6px 10px', 'border-radius:999px',
      'font:500 12px/1.2 system-ui,-apple-system,sans-serif', 'color:#fff',
      'background:rgba(20,20,20,.82)', 'box-shadow:0 1px 4px rgba(0,0,0,.3)',
    ].join(';');
    document.body.appendChild(chip);
  }
  chip.hidden = false;
}

// The tool index is the one fetch the whole gallery depends on. A single
// transient failure on a cold first load would otherwise leave a brand-new user
// (no localStorage fallback) with an empty gallery and no recovery short of a
// manual hard refresh — so retry a few times with linear backoff before giving up.
const CATALOG_FETCH_ATTEMPTS = 3;
const CATALOG_RETRY_BASE_MS = 400; // waits ~400ms, ~800ms between attempts
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface CatalogMeta { etag: string | null; lastModified: string | null; }

function getCatalogMeta(key: string): CatalogMeta | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return {
      etag: typeof parsed.etag === 'string' ? parsed.etag : null,
      lastModified: typeof parsed.lastModified === 'string' ? parsed.lastModified : null,
    };
  } catch {
    return null;
  }
}

function setCatalogMeta(key: string, value: CatalogMeta): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded — non-fatal, ETags are a perf hint only.
  }
}

// Stash the parsed asset index from the most recent fresh (200) fetch so
// syncCorePrefetch can consume the core subset without re-fetching index.json.
let cachedAssetIndex: AssetIndex | null = null;

export async function syncCatalog(host: SyncHost): Promise<void> {
  setOffline(false);
  try {
    await Promise.all([
      syncTools(host),
      syncAssets(host),
    ]);
  } catch (e) {
    setOffline(true);
    host.log('warn', 'Catalog sync failed; using cached', { error: String(e) });
  }
}

async function conditionalFetch(url: string, etagKey: string): Promise<Response | null> {
  const stored = getCatalogMeta(etagKey);
  const headers: Record<string, string> = {};
  if (stored?.etag) headers['If-None-Match'] = stored.etag;
  else if (stored?.lastModified) headers['If-Modified-Since'] = stored.lastModified;

  const resp = await fetch(url, { headers });
  if (resp.status === 304) return null; // unchanged

  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);

  const etag = resp.headers.get('ETag');
  const lastModified = resp.headers.get('Last-Modified');
  if (etag || lastModified) {
    setCatalogMeta(etagKey, { etag, lastModified });
  }
  return resp;
}

async function syncTools(host: SyncHost): Promise<void> {
  // Always fetch fresh — window.__toolIndex is in-memory only and must be
  // re-populated on every page load. A 304 would leave it empty.
  // We keep a localStorage copy so the gallery can fall back offline.
  for (let attempt = 0; attempt < CATALOG_FETCH_ATTEMPTS; attempt++) {
    try {
      // cache: 'no-store' so the HTTP cache can never pin a bad/partial response
      // — one would survive a normal reload and only clear on a hard refresh.
      const resp = await fetch(`${CATALOG_BASE}/tools/index.json`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const index: unknown = await resp.json();
      if (!isToolIndex(index)) throw new Error('malformed tool index');
      const w: Window & { __toolIndex?: ToolIndex } = window;
      w.__toolIndex = index;
      try { localStorage.setItem('sbt-tool-index', JSON.stringify(index)); } catch { /* quota */ }
      host.log('info', `Tool catalog: ${index.tools.length} tools`);
      return;
    } catch (e) {
      if (attempt < CATALOG_FETCH_ATTEMPTS - 1) {
        await delay(CATALOG_RETRY_BASE_MS * (attempt + 1));
        continue;
      }
      // Every attempt failed — restore from localStorage cache if available.
      setOffline(true);
      const cached = localStorage.getItem('sbt-tool-index');
      const parsed: unknown = cached ? JSON.parse(cached) : null;
      if (isToolIndex(parsed)) {
        const w: Window & { __toolIndex?: ToolIndex } = window;
        w.__toolIndex = parsed;
        host.log('info', 'Tool catalog loaded from cache (offline)');
      } else {
        host.log('warn', `Tool catalog fetch failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}

async function syncAssets(host: SyncHost): Promise<void> {
  const resp = await conditionalFetch(`${CATALOG_BASE}/assets/index.json`, 'assets-index');
  if (!resp) {
    host.log('info', 'Asset catalog unchanged (304)');
    return;
  }
  const index: unknown = await resp.json();
  if (!isAssetIndex(index)) throw new Error('malformed asset index');
  cachedAssetIndex = index; // let syncCorePrefetch reuse this fresh fetch

  // Write metadata into IndexedDB so host.assets.get(id) can resolve any asset.
  await host.assets._syncFromIndex(index.assets);

  // Remove stale blobs: old versions, removed assets, and on-demand blobs not
  // referenced by any saved session (browsed-but-unsaved fetches don't accumulate).
  const sessionRefs = await host.state._getAssetRefs();
  const pruned = await host.assets._pruneStale(index.assets, sessionRefs);
  if (pruned.blobs || pruned.meta) {
    host.log('info', `Pruned stale assets: ${pruned.blobs} blobs, ${pruned.meta} metadata entries`);
  }

  host.log('info', `Asset catalog synced: ${index.assets.length} assets`);
}

async function prefetchAsset(host: SyncHost, meta: AssetMetaRecord): Promise<void> {
  for (const fmt of meta.formats) {
    const key = `${meta.id}:${fmt.format}:${meta.version}`;
    if (await host.assets._hasBlob(key)) continue;
    const resp = await fetch(fmt.url);
    if (!resp.ok) continue;
    const blob = await resp.blob();
    try {
      await verifyAssetChecksum(blob, fmt);
    } catch (e) {
      // Corrupt/tampered bytes — skip caching rather than storing a bad blob.
      host.log('warn', `Skipping prefetch (checksum mismatch): ${fmt.url}`, { error: String(e) });
      continue;
    }
    await host.assets._cacheBlob(key, blob);
  }
}

export async function syncCorePrefetch(host: SyncHost): Promise<void> {
  try {
    // Reuse the index syncAssets already fetched this boot. Only fall back to a
    // network fetch if it ran a 304 (unchanged) and never stashed one.
    let index = cachedAssetIndex;
    if (!index) {
      const resp = await fetch(`${CATALOG_BASE}/assets/index.json`);
      if (!resp.ok) return;
      const fetched: unknown = await resp.json();
      if (!isAssetIndex(fetched)) return;
      index = fetched;
    }
    const core = index.assets.filter(a => a.tier === 'core');
    await Promise.allSettled(core.map(a => prefetchAsset(host, a)));
  } catch (e) {
    host.log('warn', 'Core prefetch failed', { error: String(e) });
  }
}
