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
 * Sync is idempotent and resumable. Network failure ≠ broken app — we just
 * use whatever is in cache. The user sees a small "offline" indicator.
 */

const CATALOG_BASE = '/catalog';
const LS_PREFIX = 'sbt-catalog:';

function getCatalogMeta(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCatalogMeta(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded — non-fatal, ETags are a perf hint only.
  }
}

export async function syncCatalog(host) {
  try {
    await Promise.all([
      syncTools(host),
      syncAssets(host),
    ]);
  } catch (e) {
    host.log('warn', 'Catalog sync failed; using cached', { error: String(e) });
  }
}

async function conditionalFetch(url, etagKey) {
  const stored = getCatalogMeta(etagKey);
  const headers = {};
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

async function syncTools(host) {
  // Always fetch fresh — window.__toolIndex is in-memory only and must be
  // re-populated on every page load. A 304 would leave it empty.
  // We keep a localStorage copy so the gallery can fall back offline.
  try {
    const resp = await fetch(`${CATALOG_BASE}/tools/index.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const index = await resp.json();
    window.__toolIndex = index;
    try { localStorage.setItem('sbt-tool-index', JSON.stringify(index)); } catch { /* quota */ }
    host.log('info', `Tool catalog: ${index.tools.length} tools`);
  } catch (e) {
    // Network failure — restore from localStorage cache if available.
    const cached = localStorage.getItem('sbt-tool-index');
    if (cached) {
      window.__toolIndex = JSON.parse(cached);
      host.log('info', 'Tool catalog loaded from cache (offline)');
    } else {
      host.log('warn', `Tool catalog fetch failed: ${e.message}`);
    }
  }
}

async function syncAssets(host) {
  const resp = await conditionalFetch(`${CATALOG_BASE}/assets/index.json`, 'assets-index');
  if (!resp) {
    host.log('info', 'Asset catalog unchanged (304)');
    return;
  }
  const index = await resp.json();

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

async function prefetchAsset(host, meta) {
  for (const fmt of meta.formats) {
    const key = `${meta.id}:${fmt.format}:${meta.version}`;
    if (await host.assets._hasBlob(key)) continue;
    const resp = await fetch(fmt.url);
    if (!resp.ok) continue;
    const blob = await resp.blob();
    await host.assets._cacheBlob(key, blob);
  }
}

export async function syncCorePrefetch(host) {
  try {
    const resp = await fetch(`${CATALOG_BASE}/assets/index.json`);
    if (!resp.ok) return;
    const index = await resp.json();
    const core = index.assets.filter(a => a.tier === 'core');
    await Promise.allSettled(core.map(a => prefetchAsset(host, a)));
  } catch (e) {
    host.log('warn', 'Core prefetch failed', { error: String(e) });
  }
}
