// SPDX-License-Identifier: MPL-2.0
/**
 * "Available offline" tool pinning.
 *
 * The offline story is strong but passive: tool files cache network-first only
 * after first use (sw.js), and only core-tier catalog assets prefetch. A pin
 * turns that into a per-tool guarantee:
 *
 *   1. Tool FILES - tool.json, template.html, styles.css, hooks.js, sibling
 *      text templates (template.ics/.vcf/.csv/.md), the active language's
 *      i18n sidecar, plus any tool-local /tools/<id>/assets/… files referenced
 *      literally from the template/hooks - are fetched into a dedicated
 *      UNVERSIONED Cache Storage bucket (PIN_CACHE). sw.js consults it as the
 *      last-resort fallback on /tools/ requests, and its activate handler never
 *      deletes it, so pins survive service-worker CACHE-generation bumps. The
 *      page owns the bucket's lifecycle (pin writes, unpin deletes).
 *   2. Catalog ASSET refs the manifest declares statically (asset-input
 *      defaults, colour palettes, block asset fields) are prefetched into the
 *      IDB blob cache through catalog/sync.ts's checksum-verified prefetch
 *      path. The caller threads that function in (`PrefetchAssets`) because
 *      sync.ts itself imports THIS module - to exclude pinned assets from its
 *      browsed-but-unsaved prune and to refresh them with the core tier each
 *      boot - so importing sync.ts back would be a cycle.
 *
 * Pin state persists in IndexedDB (its own key in the 'profile' KV store - 
 * never localStorage). It is deliberately NOT on the profile record itself:
 * a pin describes THIS device's cache, so it must not travel in the portable
 * backup (data-transfer.ts exports only the 'me' record).
 */

import { openDB } from '../bridge/db.ts';
import { currentLang } from '../i18n.ts';
import { instanceFetch, instancePath } from './instance.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

/** The Cache Storage bucket pinned tool files live in. Mirrored by sw.js
 *  (PIN_CACHE there) - keep the two literals in sync. */
export const PIN_CACHE = 'lolly-pins';

/** Key of the pin map inside the 'profile' KV store (a sibling of the 'me' record). */
const PIN_KEY = 'offline-pins';

/** Key of the tool-index watermark the pinned FILES were last successfully
 *  refreshed against (sibling of PIN_KEY - deliberately NOT inside the pin map,
 *  whose keys are tool ids). */
const PIN_SYNC_KEY = 'offline-pins-synced';

/** Sibling text templates the loader fetches per declared data format. */
const TEXT_TEMPLATE_EXTS = ['ics', 'vcf', 'csv', 'md'] as const;

export interface PinRecord {
  /** ISO timestamp of the last (re)pin. */
  at: string;
  /** Measured bytes of the pinned tool FILES (catalog asset blobs are counted
   *  by the storage meter's Asset-cache slice instead - never double-counted). */
  bytes: number;
  /** How many files the pin cached. */
  files: number;
  /** Catalog asset ids the manifest references - sync.ts protects these from
   *  the prune and refreshes them alongside the core tier. */
  assetIds: string[];
}

type PinMap = Record<string, PinRecord>;

/** Prefetch catalog assets by id - catalog/sync.ts's prefetchAssetsById, bound
 *  to a host by the caller (see the module comment for why it's threaded in). */
export type PrefetchAssets = (ids: string[]) => Promise<void>;

async function readPins(): Promise<PinMap> {
  const db = await openDB();
  return ((await db.get('profile', PIN_KEY)) as PinMap | undefined) ?? {};
}

async function writePins(pins: PinMap): Promise<void> {
  const db = await openDB();
  await db.put('profile', pins, PIN_KEY);
}

/** The pinned tool ids (empty when none / Cache Storage unsupported). */
export async function pinnedToolIds(): Promise<Set<string>> {
  return new Set(Object.keys(await readPins()));
}

/** Union of catalog asset ids referenced by any pinned tool - sync.ts adds
 *  their current-version blob keys to the prune keep-set. */
export async function pinnedAssetIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const rec of Object.values(await readPins())) {
    for (const id of rec.assetIds) ids.add(id);
  }
  return ids;
}

/** The full pin map, tool id → record - the profile's offline download manager
 *  reads per-tool sizes and timestamps from it. Same measured-at-pin-time
 *  numbers pinnedToolBytes() totals. */
export async function pinRecords(): Promise<Record<string, PinRecord>> {
  return readPins();
}

/** Total recorded bytes + count of pinned tools (the storage meter's slice).
 *  Reads the sizes measured at (re)pin time rather than re-reading every cached
 *  blob on each meter open - pins refresh on catalog change, so drift is bounded. */
export async function pinnedToolBytes(): Promise<{ bytes: number; count: number }> {
  const recs = Object.values(await readPins());
  return { bytes: recs.reduce((n, r) => n + (r.bytes || 0), 0), count: recs.length };
}

/**
 * Catalog asset ids a manifest references statically: asset-input defaults,
 * colour-input palettes, and block asset-field defaults/entries. User uploads
 * (user/…) already live on-device; presentation modifiers (?theme= / ?treatment=)
 * resolve from the base asset's bytes, so only the base id is collected. Assets
 * picked at runtime (picker queries) or held in saved sessions are covered by
 * the session-refs prune path instead.
 */
export function collectManifestAssetIds(manifest: ToolManifest): string[] {
  const ids = new Set<string>();
  const add = (v: unknown): void => {
    if (typeof v !== 'string' || !v || v.startsWith('user/')) return;
    const base = v.split('?')[0];
    if (base) ids.add(base);
  };
  for (const input of manifest.inputs ?? []) {
    if (input.type === 'asset') add(input.default);
    if (input.type === 'color') add(input.palette);
    if (input.type === 'blocks') {
      const assetFields = (input.fields ?? []).filter(f => f.type === 'asset');
      for (const f of assetFields) add((f as { default?: unknown }).default);
      if (Array.isArray(input.default)) {
        for (const block of input.default) {
          if (!block || typeof block !== 'object') continue;
          for (const f of assetFields) add((block as Record<string, unknown>)[f.id]);
        }
      }
    }
  }
  return [...ids];
}

/** Fetch one tool file into the pin cache. Returns its byte size; 0 when the
 *  file doesn't exist (optional files); throws when a `required` file fails.
 *  With a remote instance base set (lib/instance.ts) both the fetch AND the
 *  cache key go through instancePath: a remote pin caches the remote bytes
 *  under the remote URL, never poisoning the same-origin keys sw.js serves as
 *  its PIN_CACHE fallback - the trade-off being that remote pins are not
 *  offline-servable (the SW ignores cross-origin requests entirely). */
async function pinFile(cache: Cache, url: string, required: boolean): Promise<number> {
  const fetchUrl = instancePath(url);
  let resp: Response | null = null;
  try { resp = await instanceFetch(fetchUrl); } catch { /* network failure - treated as missing below */ }
  // SPA-fallback guard (same as the tool loader's fetchFile): an HTML body for a
  // non-.html path means the server served the app shell for a missing file.
  const ct = resp?.headers.get('content-type') ?? '';
  if (!resp || !resp.ok || (ct.includes('text/html') && !url.endsWith('.html'))) {
    if (required) throw new Error(`offline pin: failed to fetch ${fetchUrl}`);
    return 0;
  }
  const blob = await resp.blob();
  await cache.put(fetchUrl, new Response(blob, { status: resp.status, statusText: resp.statusText, headers: resp.headers }));
  return blob.size;
}

/** Literal /tools/<id>/assets/… and /tools/<id>/lib/… references in the tool's
 *  own sources. lib/ matters for the tools that ship vendored libraries (d3's
 *  d3.min.js, street-map's leaflet bundle) - before it was matched those pins
 *  only worked offline if the runtime /tools/ cache happened to hold the lib
 *  from an online open. Computed paths (e.g. 3d's '…/assets/' + model + '.glb')
 *  can't be enumerated from the client, so those tools stay partially pinned. */
export function localAssetPaths(toolId: string, sources: Array<string | null>): string[] {
  const re = new RegExp(`/tools/${toolId}/(?:assets|lib)/[\\w./-]+`, 'g');
  const found = new Set<string>();
  for (const src of sources) {
    for (const m of src?.match(re) ?? []) found.add(m);
  }
  return [...found];
}

/**
 * Pin one tool: cache its files (see module comment for the exact set) and
 * prefetch its manifest-declared catalog assets, then record the pin. Re-pinning
 * an already-pinned tool refreshes its cached copies in place. Returns the
 * parsed manifest so the caller can e.g. warm the matching editor view chunk.
 */
export async function pinTool(toolId: string, prefetchAssets?: PrefetchAssets): Promise<ToolManifest> {
  if (!('caches' in globalThis)) throw new Error('offline pin: Cache Storage unavailable');
  const cache = await caches.open(PIN_CACHE);
  const base = `/tools/${toolId}`;

  // Manifest first - it names every other file the tool can load.
  const resp = await instanceFetch(instancePath(`${base}/tool.json`));
  if (!resp.ok || (resp.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(`offline pin: no manifest for "${toolId}"`);
  }
  const manifestBlob = await resp.blob();
  await cache.put(instancePath(`${base}/tool.json`), new Response(manifestBlob, { status: resp.status, statusText: resp.statusText, headers: resp.headers }));
  const manifest = JSON.parse(await manifestBlob.text()) as ToolManifest;

  const declared = manifest.render?.formats ?? [];
  const lang = currentLang();
  const wants: Array<[path: string, required: boolean]> = [
    ['template.html', true],
    ['styles.css', false],
  ];
  // A tool that declares hooks and loses them renders wrong output - for a pin
  // that's a hard failure, unlike the loader's silent tryFetch degrade.
  if (manifest.hooks && (manifest.hooks as { module?: boolean }).module !== true) wants.push(['hooks.js', true]);
  for (const ext of TEXT_TEMPLATE_EXTS) {
    if (declared.includes(ext)) wants.push([`template.${ext}`, false]);
  }
  if (lang !== 'en') wants.push([`i18n/${lang}.json`, false]);

  const sizes = await Promise.all(wants.map(([path, required]) => pinFile(cache, `${base}/${path}`, required)));
  let bytes = manifestBlob.size + sizes.reduce((n, s) => n + s, 0);
  let files = 1 + sizes.filter(s => s > 0).length;

  // Tool-local assets referenced literally from the just-pinned sources.
  const readBack = async (path: string): Promise<string | null> => {
    const r = await cache.match(instancePath(`${base}/${path}`));
    return r ? r.text() : null;
  };
  const sources = await Promise.all([readBack('template.html'), readBack('styles.css'), readBack('hooks.js')]);
  const localSizes = await Promise.all(localAssetPaths(toolId, sources).map(url => pinFile(cache, url, false)));
  bytes += localSizes.reduce((n, s) => n + s, 0);
  files += localSizes.filter(s => s > 0).length;

  // Catalog refs through the checksum-verified prefetch (best-effort inside - 
  // sync's prefetch settles per asset and never throws for one bad file).
  const assetIds = collectManifestAssetIds(manifest);
  if (assetIds.length && prefetchAssets) await prefetchAssets(assetIds);

  const pins = await readPins();
  pins[toolId] = { at: new Date().toISOString(), bytes, files, assetIds };
  await writePins(pins);
  return manifest;
}

/** Unpin: evict the tool's files from the pin cache and drop its record.
 *  Prefetched catalog blobs are shared, so they're left for the next catalog
 *  sync's prune to reclaim once no pin or saved session references them. */
export async function unpinTool(toolId: string): Promise<void> {
  if ('caches' in globalThis) {
    const cache = await caches.open(PIN_CACHE);
    const prefix = `/tools/${toolId}/`;
    for (const req of await cache.keys()) {
      if (new URL(req.url).pathname.startsWith(prefix)) await cache.delete(req);
    }
  }
  const pins = await readPins();
  if (pins[toolId]) {
    delete pins[toolId];
    await writePins(pins);
  }
}

/** Remove every pin and the whole pin cache (the storage manager's evict-all). */
export async function unpinAll(): Promise<void> {
  if ('caches' in globalThis) await caches.delete(PIN_CACHE);
  await writePins({});
}

/** Re-pin every pinned tool's FILES when `watermark` (the current tool-index
 *  identity - version|generatedAt) differs from the one the last SUCCESSFUL
 *  refresh recorded. The watermark is PERSISTED, not a session flag: only the
 *  single session that fetches fresh index bytes ever sees a "changed" signal,
 *  and if that tab closes mid-refresh (or a pin fetch fails on a flaky link)
 *  every later 304 boot would leave the unversioned PIN_CACHE serving
 *  deploy-old files offline forever. Best-effort per tool - a failed refresh
 *  keeps the existing cached copy - but the watermark only advances after a
 *  pass in which EVERY pin refreshed, so a partial pass retries next boot.
 *  (Catalog asset blobs refresh separately, with the core tier - sync.ts.) */
export async function refreshPinnedToolFiles(watermark: string): Promise<void> {
  const ids = Object.keys(await readPins());
  if (!ids.length) return;
  const db = await openDB();
  if ((await db.get('profile', PIN_SYNC_KEY)) === watermark) return;
  let allOk = true;
  for (const id of ids) {
    try { await pinTool(id); } catch { allOk = false; /* offline / gone - keep the old pinned copy */ }
  }
  if (allOk) await db.put('profile', watermark, PIN_SYNC_KEY);
}

/** The distinct render.layout values across pinned tools, read from the PINNED
 *  manifests (no network). Lets the gallery warm the matching lazy editor view
 *  chunks (free-canvas / doc-editor / deck-editor) into the SW cache so a
 *  pinned editor-layout tool still boots offline. */
export async function pinnedRenderLayouts(): Promise<Set<string>> {
  const out = new Set<string>();
  if (!('caches' in globalThis)) return out;
  const pins = await readPins();
  if (!Object.keys(pins).length) return out;
  const cache = await caches.open(PIN_CACHE);
  for (const id of Object.keys(pins)) {
    try {
      // Match under the ACTIVE base - a pin made in remote mode is keyed by its
      // remote URL; a miss (e.g. after switching base) just skips the warm-up.
      const resp = await cache.match(instancePath(`/tools/${id}/tool.json`));
      if (!resp) continue;
      const manifest = JSON.parse(await resp.text()) as ToolManifest;
      if (manifest.render?.layout) out.add(manifest.render.layout);
    } catch { /* unreadable manifest - nothing to warm */ }
  }
  return out;
}
