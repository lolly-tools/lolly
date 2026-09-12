// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog sync.
 *
 * On boot, fetch the tool catalog manifest and asset catalog manifest from
 * known URLs. Diff against IndexedDB. Update meta. Prefetch core-tier assets.
 *
 * The catalog base defaults to same-origin /catalog/, and every fetch here goes
 * through lib/instance.ts (instancePath/instanceFetch): when the user points
 * the shell at a remote Lolly deployment, the same sync runs against that
 * instance's catalog - checksum verification included. See lib/instance.ts's
 * module header for the offline/SW/signing consequences of a remote base.
 *
 * Sync is idempotent and resumable. Network failure ≠ broken app - we fall back
 * to whatever is in cache and flip `networkStatus.offline`, which surfaces a small
 * self-contained "offline" chip (and is readable by views that want their own
 * indicator).
 */

import { AssetChecksumError } from '../bridge/assets.ts';
import { assertToolIndexIntegrity, getToolIntegrity } from './integrity.ts';
import { currentLang, t } from '../i18n.ts';
import { pinnedAssetIds, refreshPinnedToolFiles } from '../lib/offline-pins.ts';
// The "Available offline" download manager is DYNAMICALLY imported: this module is
// on the boot path (main.ts syncs the catalog), but both reads below happen inside
// `syncCorePrefetch`, which already runs on the idle pass AFTER first paint - and
// they are the only two edges to a ~7.9 KB module that also drags the upscale/matte
// model tables along. Both call sites are async, so the import is invisible.
const offlineManager = () => import('../lib/offline-manager.ts');
import { adoptBootFetch, initInstanceBase, instanceFetch, instancePath, usesBrowserCors } from '../lib/instance.ts';

/** One resolvable file for a catalog asset (an entry in an asset's `formats`).
 *  Structurally matches the bridge's AssetFormat so it flows into
 *  _ensureBlob unchanged. */
interface AssetFormat {
  format: string;
  url: string;
  checksum?: string;
  /** Byte size stamped by scripts/build-catalog-index.ts - what the offline
   *  download UI prices tags/scopes with before fetching anything. */
  size?: number;
}

/** A catalog asset's stored metadata, as it arrives in /catalog/assets/index.json
 *  and flows straight into host.assets._syncFromIndex. */
interface AssetMetaRecord {
  id: string;
  version?: string;
  tier?: string;
  /** Generative-AI provenance disclosure - flows verbatim into the asset-meta store. */
  aiGenerated?: 'full' | 'partial';
  formats: AssetFormat[];
  [key: string]: unknown;
}

/** The tool catalog index as fetched from /catalog/tools/index.json. */
export interface ToolIndex {
  version?: string;
  /** Rolls only when the tool set actually changes (build-catalog-index.ts keeps
   *  it stable on idempotent regeneration) - the pin-refresh watermark. */
  generatedAt?: string;
  /** Each entry may carry `en` - the pristine English name/description, stashed
   *  by localizeToolIndex before it overlays a translation (in-memory only, never
   *  serialized) so search haystacks can keep matching the English name in whatever
   *  session (plans/99 section 2e). */
  tools: Array<{ id: string; en?: { name: unknown; description: unknown } } & Record<string, unknown>>;
}

/** The asset catalog index as fetched from /catalog/assets/index.json. */
interface AssetIndex {
  assets: AssetMetaRecord[];
  /** Curated asset ids every user starts with favourited (seeded once, on first run -
   *  see boot() in main.ts). SUSE-specific content, so it's authored here in the catalog
   *  data, not in shell code. */
  defaultFavourites?: string[];
  /** TOOL ids hidden from the gallery grid by default (the "Hide tool" state, pre-applied).
   *  Merged into the user's hidden-tools overlay until they first edit it - the tool twin of
   *  DEFAULT_HIDDEN_ASSETS. Authored in the brand catalog data so it's per-brand (SUSE-scoped;
   *  omitted from lolly-start), never in shell code. See lib/hidden-tools.ts + gallery.ts. */
  defaultHiddenTools?: string[];
  /** Template refs (`"<toolId>:<tid>"`) a brand ships hidden for a fresh profile (plans/226) -
   *  the template twin of `defaultHiddenTools`, merged by lib/hidden-templates.ts until seeded. */
  defaultHiddenTemplates?: string[];
}

/**
 * Overlay a tool's translated name/description/featured.blurb (the `i18n` block
 * scripts/build-catalog-index.ts folds into each index entry from the tool's own
 * `i18n/<lang>.json` sidecar - see engine/src/loader.ts's applyManifestI18n for
 * the full-manifest counterpart used when a tool is actually opened) onto the
 * flat index entries every tool-listing view reads via window.__toolIndex.
 * Mutates in place. Called at every point that assigns window.__toolIndex (below,
 * and main.ts's synchronous cache-priming path) so gallery/catalog/projects/
 * dashboard/picker all get the active language for free - no per-view changes.
 * No-op for English (the index's own fields already are English) and for whatever
 * tool whose sidecar doesn't cover the active language (English fallback).
 */
export function localizeToolIndex(index: ToolIndex): void {
  const lang = currentLang();
  if (lang === 'en') return;
  for (const tool of index.tools) {
    const i18n = tool.i18n as Record<string, { name?: string; description?: string; blurb?: string }> | undefined;
    const overlay = i18n?.[lang];
    if (!overlay) continue;
    // Stash the pristine English strings BEFORE overlaying - once (the guard keeps
    // a second localize pass from stashing already-localized strings) - so a search
    // in whatever language still finds "Compress PDF" by "compress" (plans/99 section 2e). The
    // localStorage index cache is unaffected: it stores the pre-localize JSON.
    if (!tool.en) tool.en = { name: tool.name, description: tool.description };
    if (overlay.name) tool.name = overlay.name;
    if (overlay.description) tool.description = overlay.description;
    if (overlay.blurb && tool.featured && typeof tool.featured === 'object') {
      (tool.featured as Record<string, unknown>).blurb = overlay.blurb;
    }
  }
}

declare global {
  interface Window {
    /** In-memory tool catalog index, populated at boot by syncTools. */
    __toolIndex?: ToolIndex;
    /** The slim FIRST-PAINT index (plans/155 Task 3.8), populated by
     *  loadSlimToolIndex on a cold visit only. Deliberately a SEPARATE global from
     *  __toolIndex: ~30 surfaces read that one for descriptions, templates, formats
     *  and i18n, and none of them may ever be handed a cut-down entry. The gallery
     *  is the single reader here, and only while __toolIndex is still absent. */
    __toolIndexSlim?: ToolIndex;
  }
}

/** The slice of the host bridge catalog sync drives. */
interface SyncHost {
  log(level: string, msg: string, data?: Record<string, unknown>): void;
  assets: {
    _syncFromIndex(assets: AssetMetaRecord[]): Promise<unknown>;
    _pruneStale(assets: AssetMetaRecord[], sessionRefs: Set<string>, keepIds?: Set<string>): Promise<{ blobs: number; meta: number }>;
    _hasBlob(key: string): Promise<boolean>;
    _cacheBlob(key: string, blob: Blob): Promise<unknown>;
    /** Fetch-and-cache one format's bytes, sharing whatever download already in
     *  flight for them; null when they are already on device. See prefetchAsset. */
    _ensureBlob(meta: AssetMetaRecord, format: AssetFormat): Promise<Blob | null>;
  };
  state: { _getAssetRefs(): Promise<Set<string>> };
}

/** Stored conditional-request validators for a catalog resource. */
interface CatalogMeta {
  etag?: string | null;
  lastModified?: string | null;
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
 * it can never steal focus or intercept clicks - a richer indicator belongs in a
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
    chip.textContent = t('Offline - showing saved content');
    chip.style.cssText = [
      'position:fixed', 'left:12px', 'bottom:12px', 'z-index:2147483647',
      'pointer-events:none', 'padding:6px 10px', 'border-radius:999px',
      'font:500 12px/1.2 SUSE,system-ui,-apple-system,sans-serif', 'color:#fff',
      'background:rgba(20,20,20,.82)', 'box-shadow:0 1px 4px rgba(0,0,0,.3)',
    ].join(';');
    document.body.appendChild(chip);
  }
  chip.hidden = false;
}

// The tool index is the one fetch the whole gallery depends on. A single
// transient failure on a cold first load would otherwise leave a brand-new user
// (no localStorage fallback) with an empty gallery and no recovery short of a
// manual hard refresh - so retry a few times with linear backoff before giving up.
const CATALOG_FETCH_ATTEMPTS = 3;
const CATALOG_RETRY_BASE_MS = 400; // waits ~400ms, ~800ms between attempts
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function getCatalogMeta(key: string): CatalogMeta | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as CatalogMeta) : null;
  } catch {
    return null;
  }
}

function setCatalogMeta(key: string, value: CatalogMeta): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded - non-fatal, ETags are a perf hint only.
  }
}

// Stash the parsed asset index from the most recent fresh (200) fetch so
// syncCorePrefetch can consume the core subset without re-fetching index.json.
let cachedAssetIndex: AssetIndex | null = null;

export async function syncCatalog(host: SyncHost): Promise<void> {
  // Load the persisted instance base BEFORE the first fetch. Wired here (not in
  // main.ts) so the sync bootstrap is self-contained: every entry point that
  // syncs gets the right base with no boot-order coordination. Never throws.
  await initInstanceBase();
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

/**
 * Conditional (ETag/Last-Modified) fetch of a catalog index, with the validator
 * kept in localStorage rather than left to the browser's HTTP cache - that cache
 * is evictable and small, and this layer exists precisely so a repeat visitor
 * whose disk entry is gone still gets a 304 instead of the whole index.
 *
 * WHICH IS WHY THESE URLS MUST NOT BE PRELOADED. A `<link rel=preload>` looks
 * like free speed here and is the opposite: markup cannot set request headers,
 * so a preloaded request is unconditional by construction. It can only ever
 * spend the bytes the 304 was about to save - 40.3 KB gz for the asset index,
 * 168.8 KB gz for the tool index - on every visitor who has a validator.
 *
 * Nor can the app adopt the preloaded response instead of re-requesting, on two
 * independent counts. (1) `as="fetch"` without `crossorigin` creates a request
 * with mode "no-cors" and credentials "include", while a bare `fetch()` defaults
 * to mode "cors" and credentials "same-origin" - the preload key differs, so the
 * entry is never matched. (2) Even with `crossorigin` it still would not match:
 * instanceFetch stamps every same-origin request with `x-lolly-client`, and
 * Chromium compares request headers when matching a preloaded raw resource
 * (RawResource::CanReuse ignores only Cache-Control, If-Modified-Since,
 * If-None-Match, Origin, Pragma, Purpose, Referer, User-Agent and
 * X-HTTP-Method-Override - a custom header is not on that list). The result is
 * the body downloaded twice, or once plus a must-revalidate round-trip.
 *
 * plans/155 task 3.1 added a preload for `/catalog/assets/index.json` on the
 * reasoning that the fetch started too late; it was removed again once the above
 * was traced. The fetch genuinely does start late - the fix for that is a
 * smaller first-paint payload (loadSlimToolIndex below), not a hint that cannot
 * speak this protocol.
 */
async function conditionalFetch(url: string, etagKey: string): Promise<Response | null> {
  // A remote instance reached through the browser's own fetch gets NO validator
  // headers. If-None-Match / If-Modified-Since are not CORS-safelisted, so they turn
  // this simple GET into a preflighted one, and Vercel answers the OPTIONS for a
  // static file with no CORS headers at all: the request fails, every sync after
  // the first "loads from cache (offline)", and a tool added to the instance never
  // shows up (found 2026-09-04 with a dev shell connected to lolly.tools).
  // `cache: 'no-cache'` has the browser revalidate against its own HTTP cache
  // instead - its internal conditional request needs no preflight - so an
  // unchanged index still costs only a 304 on the wire; it just arrives here as a
  // full response rather than the early null. Tauri's transport is CORS-free and
  // keeps the explicit validators.
  if (usesBrowserCors(url)) {
    const fresh = await instanceFetch(url, { cache: 'no-cache' });
    if (!fresh.ok) throw new Error(`HTTP ${fresh.status} fetching ${url}`);
    return fresh;
  }
  const stored = getCatalogMeta(etagKey);
  const headers: Record<string, string> = {};
  if (stored?.etag) headers['If-None-Match'] = stored.etag;
  else if (stored?.lastModified) headers['If-Modified-Since'] = stored.lastModified;

  const resp = await instanceFetch(url, { headers });
  if (resp.status === 304) return null; // unchanged

  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);

  const etag = resp.headers.get('ETag');
  const lastModified = resp.headers.get('Last-Modified');
  if (etag || lastModified) {
    setCatalogMeta(etagKey, { etag, lastModified });
  }
  return resp;
}

// Fetched at most once per page - the cold-visit fast path, not a sync.
let slimPromise: Promise<ToolIndex | null> | null = null;

/**
 * The slim tool index (`/catalog/tools/index.slim.json`) - the gallery's first paint
 * on a COLD visit, where there is no cached index to prime from and the full
 * 551 KB / 168 KB gz download is the only thing between an empty screen and a
 * gallery (plans/155 Task 3.8). It carries one cut-down entry per tool: what the
 * grid paints with, no i18n blocks, no templates, no example bodies.
 *
 * Not a replacement for syncTools and not a cache layer: it never writes
 * `sbt-tool-index`, never touches `window.__toolIndex`, and never moves the
 * toolIndexChanged() watermark - the full sync below owns all three, and it runs
 * unchanged alongside this. main.ts races the two and re-renders when the full
 * index arrives; everything past the first paint reads only the full one.
 *
 * Deliberately NOT a conditionalFetch: with no stored validator we can never be
 * answered 304 with nothing to show, and storing one would mean caching a second
 * copy of the catalog in localStorage for an audience that by definition has no
 * cache. The file is served must-revalidate (vercel.json) and is small enough that
 * a revalidation round-trip is the whole cost.
 *
 * That is also the one reason index.html may start THIS url early and not the two
 * conditional ones above: with no validator in play there is no 304 for an
 * unconditional early request to defeat. It starts the real fetch and parks the
 * promise for adoptBootFetch (lib/instance.ts) to hand back here, so the request
 * begins at HTML parse instead of after the boot chunks execute and the body is
 * used rather than downloaded twice. It was a `<link rel="preload" as="fetch">`
 * until 2026-09-12, and a preloaded response is never ADOPTED by this fetch
 * (conditionalFetch's note has the mechanism) - all that hint bought was a warm
 * HTTP-cache entry, and where the boot fetch outran the revalidation the whole
 * 22.7 KB came down a second time. The gate is unchanged: only visitors with no
 * cached index at all, since nobody else asks for this file.
 *
 * Resolves null - never throws - on anything unusual: an offline/failed fetch, a
 * deployment that predates the file, an empty index, or a build that pins a catalog
 * signing key. That last one matters: the signed envelope binds index.json's bytes,
 * so a slim index has no signature of its own and a key-pinned build must not paint
 * from unverified bytes. It falls back to today's blocking full-index path instead.
 */
export function loadSlimToolIndex(): Promise<ToolIndex | null> {
  slimPromise ??= (async () => {
    try {
      // The base decides WHICH deployment's catalog this is; syncCatalog awaits the
      // same memoised promise, so this costs one shared IndexedDB read, not two.
      await initInstanceBase();
      if (await getToolIntegrity()) return null;
      // index.html's pre-paint script already started this exact request on a cold
      // visit (see its slim-index note): adopt that response rather than making a
      // second one. Null when there is nothing to adopt - a repeat visitor, a
      // release build with the script stripped, a remote instance or a loaded pack.
      const slimPath = `${CATALOG_BASE}/tools/index.slim.json`;
      const resp = await (adoptBootFetch(slimPath) ?? instanceFetch(instancePath(slimPath)));
      if (!resp.ok) return null;
      const index = await resp.json() as ToolIndex;
      if (!Array.isArray(index?.tools) || !index.tools.length) return null;
      // No localizeToolIndex: the slim entries carry no i18n block by design, so a
      // non-English first paint renders English names and the full index's landing
      // re-runs the overlay - the same trade Task 3.7 already makes while a locale
      // chunk is in flight.
      window.__toolIndexSlim = index;
      return index;
    } catch {
      return null;
    }
  })();
  return slimPromise;
}

async function syncTools(host: SyncHost): Promise<void> {
  // Conditional (ETag) fetch, same as syncAssets. window.__toolIndex is primed
  // from the localStorage copy at boot (main.ts) BEFORE this runs, so a 304 is
  // safe - the already-loaded index stays and we skip the 116 KB download plus
  // the re-stringify + synchronous localStorage rewrite. We keep the localStorage
  // copy (rewritten only on a fresh 200) so the gallery can fall back offline.
  for (let attempt = 0; attempt < CATALOG_FETCH_ATTEMPTS; attempt++) {
    try {
      const resp = await conditionalFetch(instancePath(`${CATALOG_BASE}/tools/index.json`), 'tool-index');
      if (!resp) {
        host.log('info', 'Tool catalog unchanged (304)');
        return;
      }
      const text = await resp.text();
      // Fail closed when this build pins a catalog signing key; inert otherwise
      // (catalog/integrity.ts). Throwing lands in the retry/offline path below.
      await assertToolIndexIntegrity(text);
      const index = JSON.parse(text) as ToolIndex;
      // Cache the PRISTINE (English-keyed, every locale's overlay intact) index - 
      // localizeToolIndex runs after, on the in-memory copy only, so a later
      // language switch (or a different device/session) always re-derives from
      // the untranslated source rather than a copy some other language baked in.
      const json = JSON.stringify(index);
      // Record whether the fetched bytes actually differ from the cached copy, reusing
      // this same stringify. boot()'s fast-path reads toolIndexChanged() instead of
      // re-stringifying the 131 KB index twice on the pre-paint critical path. Must be
      // a content compare, not 200-vs-304: ETag-less hosts serve identical 200s.
      try { toolIndexDidChange = localStorage.getItem('sbt-tool-index') !== json; localStorage.setItem('sbt-tool-index', json); } catch { /* quota */ }
      localizeToolIndex(index);
      window.__toolIndex = index;
      host.log('info', `Tool catalog: ${index.tools.length} tools`);
      return;
    } catch (e) {
      if (attempt < CATALOG_FETCH_ATTEMPTS - 1) {
        await delay(CATALOG_RETRY_BASE_MS * (attempt + 1));
        continue;
      }
      // Every attempt failed - restore from localStorage cache if available.
      setOffline(true);
      const cached = localStorage.getItem('sbt-tool-index');
      if (cached) {
        const offlineIndex = JSON.parse(cached) as ToolIndex;
        localizeToolIndex(offlineIndex);
        window.__toolIndex = offlineIndex;
        host.log('info', 'Tool catalog loaded from cache (offline)');
      } else {
        host.log('warn', `Tool catalog fetch failed: ${(e as Error).message}`);
      }
    }
  }
}

// The catalog's curated default-favourite asset ids, captured from the asset index on
// the boot that fetches it (a 304 keeps the prior value). boot() reads this to seed a
// brand-new user's favourites once. Empty until the first non-304 asset sync - which is
// guaranteed the first time this ships, since adding the list changes index.json's bytes.
// True iff the last tool-index sync fetched bytes differing from the cached copy.
// boot()'s fast-path reads this to decide whether to replay the gallery entrance
// cascade - false on a 304 or an offline cache-restore (both leave it untouched).
let toolIndexDidChange = false;
/** Whether the most recent tool-index sync actually changed the catalog data. */
export function toolIndexChanged(): boolean { return toolIndexDidChange; }

let defaultFavouriteIds: readonly string[] = [];
/** Ordered asset ids flagged `defaultFavourites` in the catalog index (empty if the index
 *  hasn't been fetched this session). Read once at boot to seed first-run favourites. */
export function defaultFavouriteAssetIds(): readonly string[] { return defaultFavouriteIds; }

let defaultHiddenToolIds_: readonly string[] = [];
/** Tool ids flagged `defaultHiddenTools` in the catalog index (empty if the index hasn't been
 *  fetched this session). Merged into a fresh profile's hidden-tools overlay by the gallery. */
export function defaultHiddenToolIds(): readonly string[] { return defaultHiddenToolIds_; }

let defaultHiddenTemplateRefs_: readonly string[] = [];
/** Template refs flagged `defaultHiddenTemplates` in the catalog asset index (empty if the index
 *  hasn't been fetched this session). Merged into a fresh profile's hidden-templates overlay by
 *  the chooser, the gallery and the Projects Templates collection (lib/hidden-templates.ts). */
export function defaultHiddenTemplateRefs(): readonly string[] { return defaultHiddenTemplateRefs_; }

/**
 * With a remote instance base set, rewrite the index's root-relative format
 * URLs to absolute instance URLs BEFORE they reach the asset-meta store - one
 * chokepoint that makes every downstream consumer (prefetch here, on-demand
 * fetchAndCache, picker thumbnail <img>s, tokens doc reads) follow the instance
 * without further threading. Passthrough (byte-identical) when no base is set.
 */
function absolutizeAssetUrls(index: AssetIndex): AssetIndex {
  for (const a of index.assets) {
    for (const f of a.formats) f.url = instancePath(f.url);
  }
  return index;
}

async function syncAssets(host: SyncHost): Promise<void> {
  const resp = await conditionalFetch(instancePath(`${CATALOG_BASE}/assets/index.json`), 'assets-index');
  if (!resp) {
    host.log('info', 'Asset catalog unchanged (304)');
    return;
  }
  const index = absolutizeAssetUrls(await resp.json() as AssetIndex);
  cachedAssetIndex = index; // let syncCorePrefetch reuse this fresh fetch
  if (Array.isArray(index.defaultFavourites)) {
    defaultFavouriteIds = index.defaultFavourites.filter((x): x is string => typeof x === 'string');
  }
  if (Array.isArray(index.defaultHiddenTools)) {
    defaultHiddenToolIds_ = index.defaultHiddenTools.filter((x): x is string => typeof x === 'string');
  }
  if (Array.isArray(index.defaultHiddenTemplates)) {
    defaultHiddenTemplateRefs_ = index.defaultHiddenTemplates.filter((x): x is string => typeof x === 'string');
  }

  // Write metadata into IndexedDB so host.assets.get(id) can resolve whatever asset.
  await host.assets._syncFromIndex(index.assets);

  // Remove stale blobs: old versions, removed assets, and on-demand blobs not
  // referenced by whatever saved session (browsed-but-unsaved fetches don't accumulate).
  const sessionRefs = await host.state._getAssetRefs();
  // Assets referenced by a pinned ("available offline") tool count as referenced
  // too - a pin must survive the browsed-but-unsaved prune. Same for the
  // profile's downloaded catalog scope (tags or 'all'). These go through the
  // ID-level keep-set, not version-exact refs: version-exact would let a
  // catalog version bump prune the downloaded blobs BEFORE syncCorePrefetch's
  // re-fetch has succeeded - the old copy must hold until the new one lands
  // (_pruneStale reclaims it once the current-version blob is on device).
  const keepIds = new Set<string>();
  try {
    const pinned = await pinnedAssetIds();
    const scoped = await offlineScopeFilter();
    if (pinned.size || scoped) {
      for (const a of index.assets) {
        if (pinned.has(a.id) || scoped?.(a)) keepIds.add(a.id);
      }
    }
  } catch { /* pins unreadable - prune with session refs only */ }
  const pruned = await host.assets._pruneStale(index.assets, sessionRefs, keepIds);
  if (pruned.blobs || pruned.meta) {
    host.log('info', `Pruned stale assets: ${pruned.blobs} blobs, ${pruned.meta} metadata entries`);
  }

  host.log('info', `Asset catalog synced: ${index.assets.length} assets`);
}

async function prefetchAsset(host: SyncHost, meta: AssetMetaRecord, signal?: AbortSignal): Promise<void> {
  for (const fmt of meta.formats) {
    signal?.throwIfAborted();
    // The asset bridge owns the fetch: it checks the cache, verifies the checksum,
    // stores the blob, and - the reason this is not a fetch of its own whatever more -
    // shares a download already in flight for the same bytes. A page reader that
    // needs a core asset before this idle pass reaches it (bridge/tokens.ts and
    // brand.json) used to make its own request, and the two overlapped.
    try {
      await host.assets._ensureBlob(meta, fmt);
    } catch (e) {
      // Corrupt/tampered bytes are worth saying out loud; skip caching rather than
      // storing a bad blob. Anything else is a file we could not reach - on an
      // offline boot that is every asset in the tier, so it rethrows to the
      // allSettled above and stays out of the console, exactly as it did before.
      if (!(e instanceof AssetChecksumError)) throw e;
      host.log('warn', `Skipping prefetch (checksum mismatch): ${fmt.url}`, { error: String(e) });
    }
  }
}

/** The predicate form of the profile's downloaded catalog scope: null when no
 *  catalog download is recorded, else a filter over index entries. 'all' keeps
 *  everything; a tag list keeps whatever asset carrying at least one selected tag. */
async function offlineScopeFilter(): Promise<((a: AssetMetaRecord) => boolean) | null> {
  const scope = await offlineManager().then(m => m.offlineCatalogScope()).catch(() => null);
  if (!scope) return null;
  if (scope === 'all') return () => true;
  const tags = new Set(scope);
  return a => Array.isArray(a.tags) && (a.tags as string[]).some(tg => tags.has(tg));
}

export async function syncCorePrefetch(host: SyncHost): Promise<void> {
  try {
    // Reuse the index syncAssets already fetched this boot. Only fall back to a
    // network fetch if it ran a 304 (unchanged) and never stashed one.
    let index = cachedAssetIndex;
    if (!index) {
      const resp = await instanceFetch(instancePath(`${CATALOG_BASE}/assets/index.json`));
      if (!resp.ok) return;
      index = absolutizeAssetUrls(await resp.json() as AssetIndex);
    }
    // Pinned tool FILES freshen on this idle path - keyed on a PERSISTED index
    // watermark, not this session's toolIndexChanged() flag: the flag is only
    // ever true in the one session that fetched fresh bytes, so a tab closed
    // mid-refresh would strand offline pins on the old deploy across every
    // later 304 boot (offline-pins.ts owns the watermark + retry semantics).
    // Runs BEFORE the asset pass below so a manifest that gained an asset ref
    // prefetches it this boot.
    const toolIndex = window.__toolIndex;
    if (toolIndex?.generatedAt) {
      await refreshPinnedToolFiles(`${toolIndex.version ?? ''}|${toolIndex.generatedAt}`).catch(() => {});
    }
    // Pinned ("available offline") tools' asset refs ride the core prefetch, so
    // a catalog version bump re-fetches them at the new version each boot.
    // The profile's downloaded catalog scope rides it too - same freshness
    // guarantee for a whole-catalogue (or tag-scoped) download.
    const pinned = await pinnedAssetIds().catch(() => new Set<string>());
    const scoped = await offlineScopeFilter().catch(() => null);
    const wanted = index.assets.filter(a => a.tier === 'core' || pinned.has(a.id) || scoped?.(a));
    await Promise.allSettled(wanted.map(a => prefetchAsset(host, a)));
    // Downloaded app/docs/verify parts re-sync on this same idle path when
    // their manifest watermark moved (a deploy re-downloads only the delta).
    await offlineManager().then(m => m.resyncOfflineParts()).catch(() => {});
  } catch (e) {
    host.log('warn', 'Core prefetch failed', { error: String(e) });
  }
}

/**
 * Prefetch specific catalog assets (by id) through the same checksum-verified
 * path as the core-tier boot prefetch. Offline pinning calls this at pin time - 
 * threaded in by the view, since lib/offline-pins.ts can't import this module
 * without a cycle (syncAssets/syncCorePrefetch read pin state above).
 */
export async function prefetchAssetsById(host: SyncHost, ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  let index = cachedAssetIndex;
  if (!index) {
    const resp = await instanceFetch(instancePath(`${CATALOG_BASE}/assets/index.json`));
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching asset index`);
    index = absolutizeAssetUrls(await resp.json() as AssetIndex);
    cachedAssetIndex = index;
  }
  const want = new Set(ids);
  await Promise.allSettled(index.assets.filter(a => want.has(a.id)).map(a => prefetchAsset(host, a)));
}

/** How the profile's offline section describes the downloadable catalogue
 *  before anything is fetched: per-tag file counts + byte sizes (from the
 *  index's format sizes - no network beyond the index itself), plus the
 *  whole-catalogue total. */
export interface CatalogDownloadSummary {
  totalBytes: number;
  totalAssets: number;
  tags: Array<{ tag: string; assets: number; bytes: number }>;
}

/** The asset index for the download surfaces. `fresh` forces a re-fetch - 
 *  downloadCatalogScope uses it so a user action prices and fetches against
 *  the CURRENT deploy, not whatever this session's boot cached (a mid-session
 *  deploy would otherwise 404 the old format URLs unrecoverably). The cached
 *  copy remains the offline fallback. */
async function loadAssetIndex(fresh = false): Promise<AssetIndex | null> {
  if (cachedAssetIndex && !fresh) return cachedAssetIndex;
  try {
    const resp = await instanceFetch(instancePath(`${CATALOG_BASE}/assets/index.json`));
    if (!resp.ok) return cachedAssetIndex;
    cachedAssetIndex = absolutizeAssetUrls(await resp.json() as AssetIndex);
    return cachedAssetIndex;
  } catch {
    return cachedAssetIndex;
  }
}

const assetBytes = (a: AssetMetaRecord): number =>
  a.formats.reduce((n, f) => n + (typeof f.size === 'number' ? f.size : 0), 0);

const scopeFilter = (scope: 'all' | readonly string[]): ((a: AssetMetaRecord) => boolean) => {
  if (scope === 'all') return () => true;
  const tags = new Set(scope);
  return a => Array.isArray(a.tags) && (a.tags as string[]).some(tg => tags.has(tg));
};

/** Size up one scope over ASSETS (a per-tag sum would double-count an asset
 *  carrying two selected tags). Null when the index is unreachable. */
export async function catalogScopeSize(scope: 'all' | readonly string[]): Promise<{ bytes: number; assets: number } | null> {
  const index = await loadAssetIndex();
  if (!index) return null;
  const wanted = index.assets.filter(scopeFilter(scope));
  return { bytes: wanted.reduce((n, a) => n + assetBytes(a), 0), assets: wanted.length };
}

/** Size up the downloadable catalogue (null when the index is unreachable). */
export async function catalogDownloadSummary(): Promise<CatalogDownloadSummary | null> {
  const index = await loadAssetIndex();
  if (!index) return null;
  const byTag = new Map<string, { assets: number; bytes: number }>();
  let totalBytes = 0;
  for (const a of index.assets) {
    const bytes = assetBytes(a);
    totalBytes += bytes;
    for (const tag of Array.isArray(a.tags) ? (a.tags as string[]) : []) {
      const row = byTag.get(tag) ?? { assets: 0, bytes: 0 };
      row.assets++;
      row.bytes += bytes;
      byTag.set(tag, row);
    }
  }
  return {
    totalBytes,
    totalAssets: index.assets.length,
    tags: [...byTag].map(([tag, row]) => ({ tag, ...row })).sort((x, y) => y.bytes - x.bytes),
  };
}

/**
 * Download the catalogue for offline - whole ('all') or scoped to a tag
 * selection - through the same checksum-verified prefetch as everything else,
 * with per-asset byte progress and cancellation. Returns the measured size for
 * the caller to record via offline-manager's recordCatalogDownload (which is
 * what protects the blobs from the prune and refreshes them each boot).
 * Throws when whatever asset fails, so a "downloaded" catalogue is never silently
 * partial; already-cached blobs skip straight to progress.
 */
export async function downloadCatalogScope(
  host: SyncHost,
  scope: 'all' | readonly string[],
  opts: { signal?: AbortSignal; onProgress?: (p: { loaded: number; total: number; done: number; count: number }) => void } = {},
): Promise<{ bytes: number; files: number }> {
  const { signal, onProgress } = opts;
  // A user action prices and fetches against the current deploy - never a
  // stale boot-time index (see loadAssetIndex).
  const index = await loadAssetIndex(true);
  if (!index) throw new Error('catalog download: asset index unreachable');
  const wanted = index.assets.filter(scopeFilter(scope));
  const total = wanted.reduce((n, a) => n + assetBytes(a), 0);
  let loaded = 0;
  let done = 0;
  onProgress?.({ loaded, total, done, count: wanted.length });
  let failures = 0;
  // Sequential like the pin sweep - parallel fetch storms help nobody on the
  // connections this feature exists for, and progress reads better.
  for (const a of wanted) {
    signal?.throwIfAborted();
    let landed = false;
    try {
      await prefetchAsset(host, a, signal);
      // prefetchAsset degrades quietly (a 404 or checksum mismatch just skips
      // that file) - right for an idle boot prefetch, but a DOWNLOAD must not
      // claim bytes it doesn't hold. Verify every format actually landed.
      landed = true;
      for (const f of a.formats) {
        if (!await host.assets._hasBlob(`${a.id}:${f.format}:${a.version}`)) { landed = false; break; }
      }
    } catch (e) {
      if (signal?.aborted) throw e;
    }
    // Only bytes actually held count as loaded - a bar that reaches 100% by
    // counting failures would contradict the error it's about to throw.
    if (landed) loaded += assetBytes(a);
    else failures++;
    done++;
    onProgress?.({ loaded, total, done, count: wanted.length });
  }
  if (failures) throw new Error(`catalog download: ${failures} of ${wanted.length} assets failed`);
  return { bytes: total, files: wanted.length };
}
