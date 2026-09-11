// SPDX-License-Identifier: MPL-2.0
/**
 * Locally INSTALLED (sideloaded) tools.
 *
 * A catalog tool ships from the CDN under `/tools/<id>/…`; the loader fetches it and,
 * under a signed catalog, verifies every file against the pinned public key. But a tool
 * can also arrive OUT of the catalog - carried inside a `.lolly` share file (plans/114
 * Wave 7). Such a tool has no CDN home and is not in the recipient's signed catalog, so
 * it needs a device-local place to live and its own load path.
 *
 * This module is that place. It mirrors `lib/offline-pins.ts` deliberately:
 *   - the tool's FILES (tool.json, template.html, styles.css, hooks.js, sibling text
 *     templates, i18n sidecars, tool-local assets) are written into a dedicated,
 *     UNVERSIONED Cache Storage bucket (INSTALLED_CACHE) keyed by `/tools/<id>/…`;
 *   - a small METADATA map (trust class, sizes, the parsed manifest) rides the single
 *     'profile' KV store, a sibling of the offline-pins map - never localStorage, never
 *     the portable profile record (an install describes THIS device).
 *
 * Two consumers read it back:
 *   - the loader's `fetchFile` (via {@link installedFetchFile}) serves the tool's text
 *     files straight from the bucket, so a tool loads with NO network and NO service
 *     worker - which is what makes a sideloaded tool work in dev and on first load;
 *   - the service worker serves the same bucket as a `/tools/` fallback (sw.js), which
 *     additionally covers tool-local asset URLs (`<img src="/tools/<id>/assets/…">`) and
 *     full offline.
 *
 * TRUST. An installed tool is loaded WITHOUT the signed-catalog integrity check: the
 * recipient's catalog has no authority over a sideloaded tool. Its bytes were already
 * integrity-verified when the `.lolly` was read (the file's own SRI map), and a `custom`
 * tool was additionally accepted by the user at import. The `trust` field records which:
 * `signed-catalog` (byte-identical to a public-catalog tool) vs `custom` (a fork /
 * private-brand / hand-authored tool). Hooks run unsandboxed in-realm, so installing a
 * `custom` tool is an explicit-trust act, gated upstream by the import flow - NOT a
 * safety boundary this module enforces.
 *
 * MODULE HOOKS are refused at install: `hooks.module` needs an importable URL with
 * working sibling imports, which a device-local blob URL can't provide yet. Every other
 * tool shape (no hooks, classic `hooks.js`) sideloads fully.
 */

import { openDB } from '../bridge/db.ts';
import { instancePath } from './instance.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

/** The Cache Storage bucket sideloaded tool files live in. Mirrored by sw.js
 *  (INSTALLED_CACHE there) - keep the two literals in sync. */
export const INSTALLED_CACHE = 'lolly-installed';

/** Key of the installed-tools metadata map inside the 'profile' KV store. */
const INSTALLED_KEY = 'installed-tools';

/** How much a sideloaded tool's code is trusted (see the module comment). */
export type InstalledToolTrust = 'signed-catalog' | 'custom';

/** Per-tool metadata - everything the listing + loader need without touching the
 *  Cache Storage bucket. The parsed manifest drives the tool-index entry. */
export interface InstalledToolMeta {
  id: string;
  /** ISO timestamp of the install (or last reinstall). */
  at: string;
  trust: InstalledToolTrust;
  version?: string;
  /** Total bytes of the cached tool files. */
  bytes: number;
  /** How many files were cached. */
  fileCount: number;
  /** Engine version the tool was authored against (from the `.lolly`), for reference. */
  engineVersion?: string;
  /** Inlined `icon.svg`, when the tool shipped one - the gallery card glyph. */
  icon?: string;
  /** The parsed `tool.json`, so the tool-index entry needs no extra fetch. */
  manifest: ToolManifest;
}

type InstalledMap = Record<string, InstalledToolMeta>;

export interface InstallToolInput {
  /** The parsed `tool.json`. Its `id` is the install key. */
  manifest: ToolManifest;
  /** Tool-dir-relative path → bytes (`tool.json`, `template.html`, `assets/x.svg`, …). */
  files: Record<string, Uint8Array>;
  trust: InstalledToolTrust;
  version?: string;
  engineVersion?: string;
}

// ── Pure helpers (unit-tested headlessly) ──────────────────────────────────────

/** The scalar manifest fields the catalog index copies verbatim (mirrors
 *  scripts/build-catalog-index.ts INDEX_FIELDS), so a sideloaded tool's index entry
 *  carries the same shape the gallery/pickers already read. */
const INDEX_FIELDS = ['id', 'name', 'description', 'version', 'status', 'category', 'capabilities', 'privacy', 'new', 'listed', 'tags'] as const;

/** Whether a manifest declares module hooks - refused at install (see module comment). */
export function usesModuleHooks(manifest: ToolManifest): boolean {
  const h = manifest.hooks as { module?: boolean } | undefined;
  return !!h && h.module === true;
}

/** A response content-type for a tool file, so the bucket serves believable headers
 *  (the loader's fetchFile rejects an HTML body for a non-.html path). */
export function contentTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'html': return 'text/html; charset=utf-8';
    case 'css': return 'text/css; charset=utf-8';
    case 'js': return 'text/javascript; charset=utf-8';
    case 'json': return 'application/json; charset=utf-8';
    case 'svg': return 'image/svg+xml';
    case 'ics': case 'vcf': case 'csv': case 'md': case 'txt': return 'text/plain; charset=utf-8';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'avif': return 'image/avif';
    case 'woff2': return 'font/woff2';
    case 'woff': return 'font/woff';
    case 'ttf': return 'font/ttf';
    case 'otf': return 'font/otf';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    default: return 'application/octet-stream';
  }
}

/** A safe tool-dir-relative path (no leading slash, no `.`/`..` segment), or '' to skip. */
export function safeToolRelPath(rel: string): string {
  const segs = rel.split(/[\\/]/);
  if (segs.some(seg => seg === '..')) return '';       // never allow traversal
  return segs.filter(seg => seg && seg !== '.').join('/');
}

/** Build a `window.__toolIndex` entry from an installed tool's metadata - the same
 *  field shape the catalog index produces, plus `_installed`/`_trust` markers so the
 *  UI can badge a sideloaded tool and the loader can branch on it. */
export function toolIndexEntryFromMeta(meta: InstalledToolMeta): Record<string, unknown> {
  const m = meta.manifest as unknown as Record<string, unknown>;
  const entry: Record<string, unknown> = {};
  for (const f of INDEX_FIELDS) if (m[f] !== undefined) entry[f] = m[f];
  const render = meta.manifest.render;
  if (render) entry.render = render;
  entry.formats = render?.formats ?? [];
  entry.exportable = render?.export !== false && (render?.formats?.length ?? 0) > 0;
  if (meta.icon) entry.icon = meta.icon;
  entry._installed = true;
  entry._trust = meta.trust;
  // The gallery reads `en.name`/`en.description` for its localised fallback.
  entry.en = { name: entry.name ?? meta.id, description: entry.description ?? '' };
  return entry;
}

/**
 * Splice installed-tool entries into a tool-index `tools` array: drop any prior
 * `_installed` entries (idempotent re-merge), then append one entry per installed tool
 * whose id the catalog does NOT already list (a catalog tool of the same id wins - it is
 * the signed, canonical copy). Pure + in-place-free; returns the new array.
 */
export function mergeInstalledEntries(tools: Array<Record<string, unknown>>, metas: InstalledToolMeta[]): Array<Record<string, unknown>> {
  const catalog = tools.filter(t => t && t._installed !== true);
  const catalogIds = new Set(catalog.map(t => t.id));
  const added = metas.filter(meta => !catalogIds.has(meta.id)).map(toolIndexEntryFromMeta);
  return [...catalog, ...added];
}

// ── Metadata store (the 'profile' KV, like offline-pins) ───────────────────────

async function readMap(): Promise<InstalledMap> {
  const db = await openDB();
  return ((await db.get('profile', INSTALLED_KEY)) as InstalledMap | undefined) ?? {};
}

async function writeMap(map: InstalledMap): Promise<void> {
  const db = await openDB();
  await db.put('profile', map, INSTALLED_KEY);
}

/** The installed tool ids (empty when none). */
export async function installedToolIds(): Promise<Set<string>> {
  return new Set(Object.keys(await readMap()));
}

/** Whether a tool id is installed on this device. */
export async function isToolInstalled(id: string): Promise<boolean> {
  const map = await readMap();
  return Object.hasOwn(map, id);
}

/** Every installed tool's metadata (for the listing + storage meter). */
export async function installedToolMetas(): Promise<InstalledToolMeta[]> {
  return Object.values(await readMap());
}

/** One installed tool's metadata, or null. */
export async function getInstalledTool(id: string): Promise<InstalledToolMeta | null> {
  return (await readMap())[id] ?? null;
}

// ── Install / uninstall (Cache Storage + metadata) ─────────────────────────────

/** Delete every cached file of a tool from the bucket (reinstall + uninstall). */
async function evictToolFiles(cache: Cache, id: string): Promise<void> {
  const prefix = `/tools/${id}/`;
  for (const req of await cache.keys()) {
    try { if (new URL(req.url).pathname.startsWith(prefix)) await cache.delete(req); } catch { /* opaque key */ }
  }
}

/** Raised when a tool can't be sideloaded yet (module hooks). `code` lets the import
 *  flow present a specific message rather than a generic failure. */
export class UnsupportedToolError extends Error {
  code: string;
  constructor(message: string, code = 'unsupported') { super(message); this.name = 'UnsupportedToolError'; this.code = code; }
}

/**
 * Install (or reinstall) a tool onto this device: write its files into INSTALLED_CACHE
 * and record its metadata. Refuses a module-hooks tool (not yet sideloadable) and a
 * malformed id. A reinstall of the same id replaces the prior copy in place.
 */
export async function installTool(input: InstallToolInput): Promise<InstalledToolMeta> {
  const id = input.manifest?.id;
  if (!id || !/^[a-z0-9][\w.-]*(?:\/[a-z0-9][\w.-]*)*$/i.test(id)) {
    throw new UnsupportedToolError(`Cannot install a tool with an invalid id: ${String(id)}`, 'bad-id');
  }
  if (usesModuleHooks(input.manifest)) {
    throw new UnsupportedToolError('This tool uses a code format Lolly cannot sideload yet.', 'module-hooks');
  }
  if (!('caches' in globalThis)) {
    throw new UnsupportedToolError('This browser cannot store an installed tool (Cache Storage unavailable).', 'no-cache');
  }
  const cache = await caches.open(INSTALLED_CACHE);
  await evictToolFiles(cache, id);   // clean slate for a reinstall

  let bytes = 0;
  let fileCount = 0;
  let icon: string | undefined;
  for (const [rel, data] of Object.entries(input.files)) {
    const safeRel = safeToolRelPath(rel);
    if (!safeRel) continue;
    const type = contentTypeFor(safeRel);
    // A BARE root-relative key (plans/186 section 3.7, the plan-131 follow-up): an
    // installed tool's files are addressed by tool path alone, so switching the
    // instance base (a design-system switch does that) never orphans them.
    const url = `/tools/${id}/${safeRel}`;
    await cache.put(url, new Response(new Blob([data as BlobPart], { type }), {
      status: 200,
      headers: { 'content-type': type, 'content-length': String(data.length) },
    }));
    bytes += data.length;
    fileCount++;
    if (safeRel === 'icon.svg') { try { icon = new TextDecoder().decode(data); } catch { /* ignore */ } }
  }

  const meta: InstalledToolMeta = {
    id,
    at: new Date().toISOString(),
    trust: input.trust,
    ...(input.version ? { version: input.version } : {}),
    bytes,
    fileCount,
    ...(input.engineVersion ? { engineVersion: input.engineVersion } : {}),
    ...(icon ? { icon } : {}),
    manifest: input.manifest,
  };
  const map = await readMap();
  map[id] = meta;
  await writeMap(map);
  return meta;
}

/** Uninstall a tool: evict its cached files and drop its metadata. */
export async function uninstallTool(id: string): Promise<void> {
  if ('caches' in globalThis) {
    const cache = await caches.open(INSTALLED_CACHE);
    await evictToolFiles(cache, id);
  }
  const map = await readMap();
  if (map[id]) { delete map[id]; await writeMap(map); }
}

// ── Load path ───────────────────────────────────────────────────────────────

/**
 * A loader `fetchFile` bound to an installed tool: serves its text files straight from
 * INSTALLED_CACHE, no network, no service worker. `path` is tool-dir-prefixed
 * (`<id>/template.html`), exactly as the loader passes it. A miss throws the same
 * `tool-not-found` the network fetchFile does, so an optional file degrades identically.
 */
export function installedFetchFile(toolId: string): (path: string) => Promise<string> {
  return async (path: string) => {
    if (!('caches' in globalThis)) throw new Error('tool-not-found');
    // Bare key first; then the base-prefixed key a tool installed before the keys
    // went bare was written under, so an existing sideload keeps working until it
    // is reinstalled.
    const resp = await caches.match(`/tools/${path}`, { cacheName: INSTALLED_CACHE })
      ?? await caches.match(instancePath(`/tools/${path}`), { cacheName: INSTALLED_CACHE });
    if (!resp) throw new Error('tool-not-found');
    return resp.text();
  };
}

// ── Tool-index surfacing ───────────────────────────────────────────────────────

interface ToolIndexWindow {
  __toolIndex?: { tools?: Array<Record<string, unknown>> };
}

/**
 * Merge installed tools into `window.__toolIndex.tools` so they appear in the galleries/
 * pickers and pass the mount-time existence check. Idempotent (drops prior `_installed`
 * entries first) and catalog-wins (a catalog tool of the same id is never shadowed).
 * Returns the number of installed tools listed. A no-op when the index isn't present yet.
 */
export async function mergeInstalledToolsIntoIndex(win: ToolIndexWindow = window as unknown as ToolIndexWindow): Promise<number> {
  const idx = win.__toolIndex;
  if (!idx || !Array.isArray(idx.tools)) return 0;
  const metas = await installedToolMetas();
  idx.tools = mergeInstalledEntries(idx.tools, metas);
  return metas.length;
}
