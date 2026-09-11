// SPDX-License-Identifier: MPL-2.0
/**
 * Instance-pack store (plans/131 WP-D) - brand content as a loadable file.
 *
 * A `.lolly` instance pack replaces this shell's brand wholesale: tokens,
 * fonts and logos land through brand-transfer's existing parts, and this
 * module ingests the rest -
 *
 *   TOOLS ride the existing sideload system (lib/installed-tools.ts, plan 114
 *   Wave 7): one installTool() per pack tool. That path already solves
 *   everything a pack tool needs - the loader serves it from INSTALLED_CACHE
 *   with NO signed-catalog envelope check (the pack's own signature vouched
 *   for the bytes at import; the remote catalog has no authority over it),
 *   sw.js serves its `assets/` subresources, and main.ts's boot merge lists
 *   it in the gallery. Nothing here duplicates that.
 *
 *   CATALOG ASSETS (icons, backgrounds, fonts at /catalog/fonts/ paths, the
 *   brand's asset-index entries) go into IndexedDB ('pack-files', keyed by
 *   canonical root-relative path) and are served by the overlay
 *   lib/instance.ts runs inside instanceFetch, before any transport. The
 *   asset INDEX comes back MERGED - pack entries over the underlying
 *   source's, pack winning on id. The TOOLS index is deliberately NOT
 *   touched by the overlay: pack tools reach the gallery through the
 *   installed-tools merge, so a key-pinned build still verifies the remote
 *   tool index against its signed envelope byte-for-byte.
 *
 * Trust: a pack carries tools, and tools carry hooks.js - loading one is
 * installing code. importInstancePackParts verifies the pack signature
 * (pack.sig: ECDSA P-256/SHA-256 over the exact manifest.json bytes, whose
 * integrity map covers every part) against the SAME pinned key catalog
 * signing uses (VITE_CATALOG_PUBLIC_KEY_JWK). Key pinned ⇒ fail closed;
 * no key pinned ⇒ the result records 'unsigned'/'unverified' for the UI to
 * say so. The zip-level SHA-256 integrity map is enforced upstream by
 * brand-transfer's verifyIntegrity either way.
 *
 * Boot cost: initPackStore loads the meta record and the path SET only (no
 * bytes); with no pack loaded it is one IDB get. The signature-verification
 * engine import and the installed-tools import are dynamic - never on the
 * boot path.
 */

import { openDB } from '../bridge/db.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

/** The idb surface this module actually uses - narrow so the unit tests can
 *  hand in a Map-backed fake (node has no IndexedDB; the pattern user-fonts
 *  uses for its host seam). */
interface PackDb {
  get(store: string, key: string): Promise<unknown>;
  put(store: string, value: unknown, key: string): Promise<unknown>;
  delete(store: string, key: string): Promise<unknown>;
  clear(store: string): Promise<unknown>;
  getAllKeys(store: string): Promise<unknown[]>;
  transaction(stores: string[], mode: 'readwrite'): {
    objectStore(name: string): { put(value: unknown, key: string): unknown; clear(): unknown };
    done: Promise<unknown>;
  };
}

let dbOverride: PackDb | null = null;
const getDb = async (): Promise<PackDb> => dbOverride ?? (openDB() as unknown as Promise<PackDb>);

/** Install a platform storage backend. The Tauri shells call this from their
 *  bridge-overrides/state.ts with the fs-backed PackDb
 *  (shells/tauri-shared/bridge-overrides/pack-store-fs.ts) - iOS purges
 *  WKWebView site data under pressure, and a purged IndexedDB silently lost
 *  the loaded brand (plans/132 wave 3). initPackStore migrates a legacy
 *  IndexedDB copy into the backend once, so already-loaded packs survive the
 *  switch. */
export function setPackStoreBackend(db: PackDb | null): void {
  dbOverride = db;
}

/** TEST-ONLY alias for the backend seam. */
export function _setDbForTests(db: PackDb | null): void {
  setPackStoreBackend(db);
}

/** Kept in sync with catalog/integrity.ts's PINNED_KEY - one deployment key
 *  vouches for both the catalog index and any loadable pack. Mutable only for
 *  the unit tests (the exported-mutable HOOK_BUDGET_MS pattern) - the fail-
 *  closed path must be testable or it will quietly stop failing closed. */
let pinnedKey: string = import.meta.env?.VITE_CATALOG_PUBLIC_KEY_JWK ?? '';

/** TEST-ONLY: pin/unpin the pack-signature key. */
export function _setPinnedKeyForTests(key: string): void {
  pinnedKey = key;
}

const STORE = 'pack-files';
/** Meta record's key in the 'profile' KV store (same home as the instance base). */
const META_KEY = 'instance-pack-meta';
/** Synthetic path for the pack's asset-index part - '//' so it can never
 *  collide with a real root-relative request path. */
const CATALOG_PART = '//pack/catalog.json';

export interface InstancePackMeta {
  kind: 'instance-pack';
  name: string;
  publisher?: string;
  version?: string;
  /** Where community content comes from while this pack is loaded. */
  instance?: string;
  engineVersion?: string;
  toolCount?: number;
  assetCount?: number;
  /** Tool ids this pack installed via installed-tools - what a replace or a
   *  clear must uninstall again. */
  toolIds: string[];
  loadedAt: string;
  signature: 'verified' | 'unverified' | 'unsigned';
}

export interface PackImportResult {
  tools: number;
  /** Pack tools refused by the sideload system (module hooks etc.), by id. */
  toolsSkipped: string[];
  assets: number;
  files: number;
  name: string;
  signature: InstancePackMeta['signature'];
  /** The instance base the pack asks for; the CALLER applies it (keeps this
   *  module import-cycle-free with lib/instance.ts, which imports us). */
  instance: string | null;
}

/** The installed-tools surface this module drives - injectable so the unit
 *  tests need neither Cache Storage nor the real module. */
export interface PackToolInstaller {
  installTool(input: {
    manifest: ToolManifest; files: Record<string, Uint8Array>;
    trust: 'signed-catalog' | 'custom'; version?: string; engineVersion?: string;
  }): Promise<unknown>;
  uninstallTool(id: string): Promise<void>;
}

let meta: InstancePackMeta | null = null;
let paths: Set<string> | null = null;
let initPromise: Promise<void> | null = null;

const MIME: Record<string, string> = {
  json: 'application/json', html: 'text/html; charset=utf-8', js: 'application/javascript',
  css: 'text/css', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
  jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8',
  ics: 'text/calendar', vcf: 'text/vcard', csv: 'text/csv',
};

const mimeOf = (path: string): string =>
  MIME[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';

/** One-shot legacy migration: a pack loaded into IndexedDB before the shells
 *  installed the fs backend is copied over, then removed from IDB - so a
 *  desktop/mobile update never silently drops an already-loaded brand. Silent
 *  on any failure (no IDB in node, nothing to migrate, storage errors): the
 *  worst outcome is the pre-migration status quo. */
async function migrateLegacyIdb(backend: PackDb): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') return false;
    const legacy = (await openDB()) as unknown as PackDb;
    const stored = await legacy.get('profile', META_KEY);
    if (!stored || (stored as InstancePackMeta).kind !== 'instance-pack') return false;
    for (const key of (await legacy.getAllKeys(STORE)) as string[]) {
      const bytes = await legacy.get(STORE, key);
      if (bytes) await backend.put(STORE, bytes, key);
    }
    await backend.put('profile', stored, META_KEY);
    await legacy.clear(STORE);
    await legacy.delete('profile', META_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Load meta + the path set. Memoised, never throws - failure reads as "no pack". */
export function initPackStore(): Promise<void> {
  initPromise ??= (async () => {
    try {
      const db = await getDb();
      let stored = await db.get('profile', META_KEY);
      if (!stored && dbOverride && await migrateLegacyIdb(db)) {
        stored = await db.get('profile', META_KEY);
      }
      if (!stored || (stored as InstancePackMeta).kind !== 'instance-pack') return;
      meta = stored as InstancePackMeta;
      paths = new Set((await db.getAllKeys(STORE)) as string[]);
    } catch {
      meta = null;
      paths = null;
    }
  })();
  return initPromise;
}

export function packActive(): boolean {
  return meta !== null && paths !== null && paths.size > 0;
}

export function getPackMeta(): InstancePackMeta | null {
  return meta;
}

/** Serve one pack file as a Response, or null when the pack doesn't carry it. */
export async function packFetch(path: string): Promise<Response | null> {
  if (!packActive() || !paths!.has(path)) return null;
  try {
    const bytes = await (await getDb()).get(STORE, path) as Uint8Array | undefined;
    if (!bytes) return null;
    // Copy into a fresh buffer: stored views can sit on larger shared buffers.
    const body = new Uint8Array(bytes);
    return new Response(body as unknown as BodyInit, {
      status: 200,
      headers: { 'content-type': mimeOf(path), 'content-length': String(body.byteLength) },
    });
  } catch {
    return null;
  }
}

/** The pack's asset-index entries (checksums intact from the brand catalog). */
export async function packAssetEntries(): Promise<Array<{ id: string }>> {
  const resp = await packFetch(CATALOG_PART);
  if (!resp) return [];
  try { return ((await resp.json()) as { assets?: Array<{ id: string }> }).assets ?? []; }
  catch { return []; }
}

const installer = async (): Promise<PackToolInstaller> =>
  (await import('./installed-tools.ts')) as unknown as PackToolInstaller;

export async function clearInstancePack(tools?: PackToolInstaller): Promise<void> {
  const it = tools ?? await installer();
  for (const id of meta?.toolIds ?? []) {
    await it.uninstallTool(id).catch(() => { /* already gone */ });
  }
  const db = await getDb();
  await db.clear(STORE);
  await db.delete('profile', META_KEY);
  meta = null;
  paths = null;
}

const decoder = new TextDecoder();

/**
 * Ingest the instance-pack parts of an unzipped `.lolly` bundle. Called by
 * brand-transfer's importBrandPack AFTER the brand parts (tokens/fonts/logos)
 * have landed and AFTER the zip integrity map verified. Replaces any
 * previously loaded pack whole - its catalog store is rewritten and every
 * tool the previous pack installed but this one doesn't carry is
 * uninstalled; two half-packs is a broken instance.
 */
export async function importInstancePackParts(
  files: Record<string, Uint8Array>,
  tools?: PackToolInstaller,
  /** Runs after the signature verdict, before any ingestion. The caller sets
   *  the pack's instance base HERE, not afterwards: installed-tools keys its
   *  cache through instancePath, so tools must install under the base they
   *  will be loaded under - and a refused pack must never move the base. */
  beforeIngest?: (meta: { instance: string | null }) => void | Promise<void>,
): Promise<PackImportResult> {
  const packMeta = readPart(files, 'instance.json') as Omit<InstancePackMeta, 'loadedAt' | 'signature' | 'toolIds'> | null;
  if (!packMeta || packMeta.kind !== 'instance-pack') {
    throw new Error('Not an instance pack (no instance.json part).');
  }

  const signature = await verifyPackSignature(files);
  const packInstance = typeof packMeta.instance === 'string' ? packMeta.instance : null;
  await beforeIngest?.({ instance: packInstance });
  const it = tools ?? await installer();

  const toolsPart = readPart(files, 'tools.json') as
    { tools?: Array<{ id: string }>; files?: Record<string, string[]> } | null;
  const catalogPart = readPart(files, 'catalog.json') as { assets?: Array<{ id: string }> } | null;
  const assets = catalogPart?.assets ?? [];

  // Tools → the sideload system. `trust: 'custom'` is the honest class - a
  // brand-pack tool is exactly its "private-brand" case; the pack's signature
  // state travels on OUR meta, not the trust field. A tool the sideloader
  // refuses (module hooks) is skipped and reported, never fatal - the brand
  // and the other tools still land.
  const previousToolIds = meta?.toolIds ?? [];
  const installedIds: string[] = [];
  const skipped: string[] = [];
  for (const [id, relFiles] of Object.entries(toolsPart?.files ?? {})) {
    const manifestBytes = files[`tools/${id}/tool.json`];
    if (!manifestBytes) { skipped.push(id); continue; }
    let manifest: ToolManifest;
    try { manifest = JSON.parse(decoder.decode(manifestBytes)) as ToolManifest; }
    catch { skipped.push(id); continue; }
    const toolFiles: Record<string, Uint8Array> = {};
    for (const rel of relFiles) {
      const bytes = files[`tools/${id}/${rel}`];
      if (bytes) toolFiles[rel] = bytes;
    }
    try {
      await it.installTool({
        manifest,
        files: toolFiles,
        trust: 'custom',
        ...(packMeta.version ? { version: packMeta.version } : {}),
        ...(packMeta.engineVersion ? { engineVersion: packMeta.engineVersion } : {}),
      });
      installedIds.push(id);
    } catch {
      skipped.push(id);
    }
  }
  // A tool the previous pack installed that this pack no longer carries.
  for (const id of previousToolIds) {
    if (!installedIds.includes(id)) await it.uninstallTool(id).catch(() => { /* already gone */ });
  }

  // Catalog assets → the pack-files store, served by the instanceFetch overlay.
  const db = await getDb();
  const tx = db.transaction([STORE], 'readwrite');
  await tx.objectStore(STORE).clear();
  let count = 0;
  for (const [path, bytes] of Object.entries(files)) {
    let key: string | null = null;
    if (path.startsWith('catalog/')) key = `/${path}`;
    else if (path === 'catalog.json') key = CATALOG_PART;
    if (!key) continue;
    tx.objectStore(STORE).put(bytes, key);
    count++;
  }
  await tx.done;

  const stored: InstancePackMeta = {
    ...packMeta,
    kind: 'instance-pack',
    toolIds: installedIds,
    loadedAt: new Date().toISOString(),
    signature,
  };
  await db.put('profile', stored, META_KEY);
  meta = stored;
  paths = new Set((await db.getAllKeys(STORE)) as string[]);

  return {
    tools: installedIds.length,
    toolsSkipped: skipped,
    assets: assets.length,
    files: count,
    name: stored.name,
    signature,
    instance: packInstance,
  };
}

function readPart(files: Record<string, Uint8Array>, name: string): unknown {
  const raw = files[name];
  if (!raw) return null;
  try { return JSON.parse(decoder.decode(raw)); } catch { return null; }
}

/**
 * pack.sig: ECDSA P-256/SHA-256 over the EXACT manifest.json bytes. Key pinned
 * ⇒ a missing or failing signature refuses the pack (fail closed, same posture
 * as catalog/integrity.ts). No key pinned ⇒ record what we saw so the UI can
 * say "unsigned"/"unverified" - the zip integrity map still guarantees the
 * parts match the manifest either way.
 */
async function verifyPackSignature(
  files: Record<string, Uint8Array>,
): Promise<InstancePackMeta['signature']> {
  const sig = readPart(files, 'pack.sig') as { signature?: string } | null;
  const manifestBytes = files['manifest.json'];
  if (!pinnedKey) return sig?.signature ? 'unverified' : 'unsigned';
  if (!sig?.signature || !manifestBytes) {
    throw new Error('This build only loads signed packs, and this pack has no valid signature.');
  }
  const { importSpkiOrJwkPublicKey } = await import('../../../../engine/src/catalog-integrity.ts');
  const key = await importSpkiOrJwkPublicKey(pinnedKey);
  const raw = Uint8Array.from(atob(sig.signature), c => c.charCodeAt(0));
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, key,
    raw as unknown as BufferSource, manifestBytes as unknown as BufferSource,
  );
  if (!ok) throw new Error("This pack's signature doesn't match the key this build trusts.");
  return 'verified';
}

/** TEST-ONLY: reset module memoisation (unit tests re-init per case). */
export function _resetPackStoreForTests(): void {
  meta = null;
  paths = null;
  initPromise = null;
}
