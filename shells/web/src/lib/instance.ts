// SPDX-License-Identifier: MPL-2.0
/**
 * Instance base - point this installed shell at a REMOTE Lolly deployment for
 * its catalog + tools (first-run instance choice). '' (the default) means the
 * bundled same-origin content, and every helper here is a byte-identical
 * passthrough in that state.
 *
 * The base persists in IndexedDB (its own key in the 'profile' KV store, like
 * lib/offline-pins.ts - never localStorage) and is loaded by initInstanceBase()
 * BEFORE the first catalog sync (catalog/sync.ts awaits it at the top of
 * syncCatalog, so no main.ts wiring is needed).
 *
 * Fetch routing: under Tauri (window.__TAURI_INTERNALS__) a cross-origin
 * instance fetch goes through the bounded native `remote_fetch` command - the
 * WebView's own fetch would be CORS-bound. That command accepts only HTTPS,
 * pins public DNS answers, rechecks redirects and caps metadata/body sizes.
 * Everywhere else (browser PWA, or same-origin URLs under Tauri) it is plain
 * window.fetch - which means a browser pointed at a cross-origin instance needs
 * that deployment to serve CORS headers.
 *
 * A "Lolly instance" can be any public deployment the user names, so this is
 * not a fixed host allowlist. Private, loopback, link-local, metadata and
 * reserved address space are deliberately refused at the native boundary. The
 * connect flow still carries the trust warning because public does not mean
 * trustworthy.
 *
 * The native command binding is implemented minimally below via
 * __TAURI_INTERNALS__.invoke rather than imported: this file is bundled by the
 * web shell's Vite (where @tauri-apps/* is not a dependency) AND by the Tauri
 * shells' Vite (which roots at ../web), so a static import would break the web
 * build - and invoke is the only primitive the binding actually uses.
 *
 * OFFLINE / CACHING interplay with a remote base set (verified against
 * public/sw.js, lib/offline-pins.ts and catalog/integrity.ts):
 *   - sw.js returns early for every cross-origin request (`url.origin !==
 *     self.location.origin`), so the /tools/ network-first cache, the
 *     /catalog/previews/ stale-while-revalidate cache and the PIN_CACHE
 *     fallback never see instance traffic (Tauri native requests bypass
 *     the SW entirely, by construction). Remote-instance mode therefore
 *     degrades offline to the SW default for cross-origin: the app shell and
 *     same-origin chrome still load, the tool INDEX falls back to its
 *     localStorage copy and already-cached asset BLOBS still resolve from
 *     IndexedDB, but un-cached tool files / previews / on-demand assets fail
 *     until the network returns.
 *   - Offline pins fetch AND key their PIN_CACHE entries through instancePath,
 *     so a pin made in remote mode caches the remote bytes under the remote URL
 *     (never poisoning the same-origin fallback keys) - but since the SW only
 *     serves PIN_CACHE for same-origin requests, pinned tools are not
 *     offline-servable while a remote base is active.
 *   - Catalog signing (catalog/integrity.ts) fetches its envelope through the
 *     base too: a key-pinned build requires the remote instance to be signed by
 *     the SAME pinned key, or sync fails closed. Asset checksum verification
 *     (verifyAssetChecksum) keeps running on remote bytes unchanged - the
 *     remote index's checksums travel with its format entries.
 */

// Deep engine imports, NOT the `@lolly/engine` barrel: this module is on the
// boot path, and engine/src/index.ts is one shared facade whose retained export
// set is the UNION over every importer - touching it here drags createRuntime
// (Handlebars) + loadTool/validate (Ajv) + c2pa onto first paint. See
// scripts/check-bundle-budget.ts.
import { ENGINE_VERSION } from '../../../../engine/src/version.ts';
import { openDB } from '../bridge/db.ts';
import { initPackStore, packActive, packAssetEntries, packFetch } from './pack-store.ts';

/** Key of the persisted base inside the 'profile' KV store. */
const INSTANCE_KEY = 'instance-base';
/** Key of the per-device install id (org/index.ts mints it for a MEMBER
 *  session only - see setInstallTag below). Cleared by leaveInstance(), so a
 *  device that re-enrolls returns as a NEW install: no identity carries across
 *  enrollments, which is the covenant's privacy default. */
const INSTALL_ID_KEY = 'install-id';
/** Key of the stored instance session cookie pair (`lw_session=…`) - the
 *  NATIVE shells' session store. A browser keeps the deployment's cookie in
 *  its own jar; the Tauri Rust client has no jar, so the device-code sign-in
 *  (org/index.ts) parks the pair here and tauriRemoteFetch attaches it - to the
 *  instance base origin ONLY, never to any other URL this transport fetches. */
const INSTANCE_SESSION_KEY = 'instance-session';

let base = '';
let initPromise: Promise<void> | null = null;
/** The install token riding x-lolly-client, or null (untagged - the default).
 *  Set ONLY by org/index.ts when a member session is confirmed: an anonymous
 *  or signed-out shell never speaks an install id. */
let installTag: string | null = null;
/** The stored session cookie pair for native shells, or null. */
let instanceSession: string | null = null;

/** The active instance base URL ('' = bundled same-origin content). */
export function getInstanceBase(): string {
  return base;
}

/**
 * Validate + normalize a user-entered instance URL: https only, no embedded
 * credentials, query/hash dropped (a base is a prefix, not a page), trailing
 * slashes stripped. Throws with a plain message on anything unusable.
 */
export function normalizeInstanceBase(url: string): string {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new Error(`Not a valid URL: ${url}`);
  }
  if (u.protocol !== 'https:') throw new Error('Instance URL must be https');
  if (u.username || u.password) throw new Error('Instance URL must not contain credentials');
  // origin keeps any explicit port; pathname keeps a sub-path deployment.
  return (u.origin + u.pathname).replace(/\/+$/, '');
}

/**
 * Persist (or with null/'' clear) the instance base. Takes effect for code that
 * reads instancePath()/instanceFetch() from now on; callers should resync or
 * reload so already-fetched catalog data is replaced.
 */
export async function setInstanceBase(url: string | null): Promise<void> {
  const next = url ? normalizeInstanceBase(url) : '';
  const db = await openDB();
  if (next) await db.put('profile', next, INSTANCE_KEY);
  else await db.delete('profile', INSTANCE_KEY);
  base = next;
  // Drop catalog/sync.ts's conditional-request validators (perf-hint ETags it
  // already keeps in localStorage - not tool state): they validate the PREVIOUS
  // base's copies, and a stale 304 against the new base would skip the first
  // full sync of the instance's index. Also drop the actual cached tool-index
  // CONTENT ('sbt-tool-index', a separate key) - main.ts primes window.__toolIndex
  // from it for the pre-sync fast paint, and catalog/sync.ts falls back to it when
  // every fetch attempt fails, so leaving the PREVIOUS base's bytes in it would
  // resurface a foreign catalog on the next cold/offline boot.
  try {
    localStorage.removeItem('sbt-catalog:tool-index');
    localStorage.removeItem('sbt-catalog:assets-index');
    localStorage.removeItem('sbt-tool-index');
  } catch { /* storage unavailable - sync will just revalidate */ }
}

/** Load the persisted base. Memoised; never throws (unreadable → bundled).
 *  Also initialises the instance-pack store (plans/131): catalog/sync.ts awaits
 *  this before its first fetch, so the pack overlay below is ready without any
 *  main.ts wiring - the same trick the base itself uses. */
export function initInstanceBase(): Promise<void> {
  initPromise ??= (async () => {
    try {
      const db = await openDB();
      const stored = await db.get('profile', INSTANCE_KEY);
      if (typeof stored === 'string' && stored) base = normalizeInstanceBase(stored);
      // The native-shell session pair, if the device-code sign-in parked one -
      // loaded here so the org probe's very first request already carries it.
      const sess = await db.get('profile', INSTANCE_SESSION_KEY);
      if (typeof sess === 'string' && /^lw_session=[^;\s]+$/.test(sess)) instanceSession = sess;
    } catch {
      base = ''; // unreadable/invalid - fall back to bundled content
    }
    await initPackStore();
  })();
  return initPromise;
}

/** TEST-ONLY: set the in-memory base without persistence (unit tests have no
 *  IndexedDB). Same pattern as the engine's exported-mutable HOOK_BUDGET_MS. */
export function _setBaseForTests(value: string): void {
  base = value;
}

// ── Install identity (the org covenant's device half) ────────────────────────

/**
 * Turn the install token on (org/index.ts, member session confirmed) or off.
 * While set, x-lolly-client grows an `install/<id>` token on tagged requests,
 * so the deployment's fleet registry can tell installs apart - and because the
 * tag rides only requests the person's own use already makes, there is no
 * heartbeat and nothing to phone home. The value is sanitised to the header
 * grammar's charset; anything else is refused (tag stays off).
 */
export function setInstallTag(id: string | null): void {
  installTag = id && /^[A-Za-z0-9._-]{1,64}$/.test(id) ? id : null;
}

/** The persisted per-device install id, minted on first use. Callers gate WHEN
 *  to call this (member session only); this module only stores the value. */
export async function ensureInstallId(): Promise<string> {
  const db = await openDB();
  const stored = await db.get('profile', INSTALL_ID_KEY);
  if (typeof stored === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(stored)) return stored;
  const minted = crypto.randomUUID();
  await db.put('profile', minted, INSTALL_ID_KEY);
  return minted;
}

/** Forget the install id (leaveInstance): the device returns as a NEW install
 *  if it ever re-enrolls - no identity carries across enrollments. */
export async function clearInstallId(): Promise<void> {
  installTag = null;
  try { await (await openDB()).delete('profile', INSTALL_ID_KEY); } catch { /* best-effort */ }
}

// ── Stored instance session (native shells; browsers keep their own cookie) ──

/** Persist (or with null clear) the session cookie pair the device-code
 *  sign-in collected. Loaded by initInstanceBase; attached by tauriRemoteFetch
 *  to instance-base-origin requests only. */
export async function setInstanceSession(cookiePair: string | null): Promise<void> {
  instanceSession = cookiePair && /^lw_session=[^;\s]+$/.test(cookiePair) ? cookiePair : null;
  try {
    const db = await openDB();
    if (instanceSession) await db.put('profile', instanceSession, INSTANCE_SESSION_KEY);
    else await db.delete('profile', INSTANCE_SESSION_KEY);
  } catch { /* best-effort - the in-memory copy still serves this run */ }
}

/** Whether a stored native-shell session exists (the gate uses this only to
 *  decide copy; the server remains the authority on whether it still works). */
export function hasInstanceSession(): boolean {
  return instanceSession !== null;
}

/**
 * Prefix a root-relative catalog/tools path with the instance base. Passthrough
 * when no base is set, and for already-absolute URLs (e.g. asset format URLs a
 * remote sync has absolutized once already).
 */
export function instancePath(p: string): string {
  if (!base) return p;
  if (/^https?:/i.test(p)) return p;
  return p.startsWith('/') ? base + p : `${base}/${p}`;
}

/**
 * fetch() for instance-base traffic: a bounded native command for cross-origin
 * URLs under Tauri (CORS-free, HTTPS/public-address checked in Rust),
 * window.fetch otherwise.
 *
 * A loaded instance pack (lib/pack-store.ts) overlays this - CATALOG paths
 * only: pack asset/font files answer by canonical path BEFORE any transport,
 * and the ASSET index comes back MERGED (pack entries over the underlying
 * source's, pack winning on id - profiles.json's later-roots-win, at
 * runtime). With the underlying source unreachable the pack's own entries
 * still answer. Pack TOOLS are deliberately not served here: they ride the
 * installed-tools sideload path (INSTALLED_CACHE + the sw.js fallback + the
 * boot-time index merge), which keeps the remote TOOL index pristine for the
 * pinned-key signed-envelope check in catalog/integrity.ts.
 */
export function instanceFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (packActive()) {
    const path = pathOf(url);
    if (path === '/catalog/assets/index.json') return packMergedAssetIndex(url, init);
    if (path.startsWith('/catalog/')) {
      return packFetch(path).then(r => r ?? transportFetch(url, init));
    }
  }
  return transportFetch(url, init);
}

function transportFetch(url: string, init?: RequestInit): Promise<Response> {
  if (hasTauriInternals() && isCrossOrigin(url)) return tauriRemoteFetch(url, withClientHeader(init));
  return fetch(url, isCrossOrigin(url) ? init : withClientHeader(init));
}

/** The root-relative path of an instance URL (absolute or already relative).
 *  A sub-path deployment's base prefixes every instancePath URL - strip it so
 *  pack keys stay canonical root-relative paths. */
function pathOf(url: string): string {
  if (!/^https?:/i.test(url)) return url.split(/[?#]/, 1)[0] ?? url;
  let path: string;
  try { path = new URL(url).pathname; } catch { return url; }
  if (base) {
    try {
      const basePath = new URL(base).pathname.replace(/\/+$/, '');
      if (basePath && path.startsWith(`${basePath}/`)) path = path.slice(basePath.length);
    } catch { /* malformed base - leave the path as-is */ }
  }
  return path;
}

/**
 * The asset index, merged: the underlying source's entries (bundled seed or
 * remote instance) with the pack's laid over them. An unreachable underlying
 * index degrades to pack-only entries rather than failing the sync. (The
 * asset index carries no signed envelope - only the TOOL index does, and
 * that one passes through unmerged.)
 */
async function packMergedAssetIndex(url: string, init: RequestInit | undefined): Promise<Response> {
  let baseIndex: Record<string, unknown> | null = null;
  try {
    const resp = await transportFetch(url, init);
    if (resp.ok) baseIndex = await resp.json() as Record<string, unknown>;
  } catch { /* offline / no instance yet - the pack still answers */ }
  const packEntries = await packAssetEntries();
  if (!baseIndex) baseIndex = { version: '1', assets: [] };
  const packIds = new Set(packEntries.map(e => e.id));
  const underlying = Array.isArray(baseIndex.assets) ? baseIndex.assets as Array<{ id: string }> : [];
  baseIndex.assets = [...underlying.filter(e => !packIds.has(e.id)), ...packEntries];
  return new Response(JSON.stringify(baseIndex), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Tag instance traffic with the shell kind + engine version - the same
 * information a User-Agent would carry if browsers let pages set one, so a
 * deployment's operator can tell which Lolly versions are in the field.
 * Same-origin and Tauri-native requests only: a custom header on a browser
 * CROSS-origin fetch forces a CORS preflight, which a plain static host
 * serving a remote instance would fail - those requests stay untagged.
 */
function withClientHeader(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  if (!headers.has('x-lolly-client')) headers.set('x-lolly-client', clientHeaderValue());
  return { ...init, headers };
}

/** The x-lolly-client value, built in one place so the install token can never
 *  ride an untagged path: shell kind + engine version, plus `install/<id>`
 *  exactly while org/index.ts has turned the tag on (member session only).
 *  Exported for tests - the header site itself stays private. */
export function clientHeaderValue(): string {
  const core = `${hasTauriInternals() ? 'tauri' : 'web'} engine/${ENGINE_VERSION}`;
  return installTag ? `${core} install/${installTag}` : core;
}

// ── Narrow Tauri remote-fetch command binding ───────────────────────────────

interface TauriInternals {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

function hasTauriInternals(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__?.invoke === 'function';
}

function isCrossOrigin(url: string): boolean {
  if (!/^https?:/i.test(url)) return false;
  try {
    return new URL(url).origin !== location.origin;
  } catch {
    return false;
  }
}

/**
 * True when a fetch of `url` from this shell goes through the browser's own CORS
 * checks: a cross-origin URL outside Tauri (whose native transport is
 * CORS-free). A caller that adds request headers uses it to stay within the
 * CORS-safelisted set: a non-safelisted header (If-None-Match, If-Modified-Since,
 * x-lolly-client) turns a simple GET into a preflighted one, and a static host
 * that answers the OPTIONS without CORS headers then fails the whole request.
 */
export function usesBrowserCors(url: string): boolean {
  return isCrossOrigin(url) && !hasTauriInternals();
}

/** The bounded Rust command's serialisable response. */
interface TauriRemoteFetchResponse {
  status: number;
  statusText: string;
  url: string;
  headers: Array<[string, string]>;
  body: number[] | ArrayBuffer;
}

/**
 * Whole-body adapter for the native boundary. Rust owns protocol, redirect,
 * DNS/IP, header and byte validation; this side preserves the browser Response
 * shape used throughout the shared shell.
 */
/** Whether `url` sits on the configured instance base's origin - the ONLY
 *  place the stored session pair may travel. instanceFetch also carries
 *  arbitrary user-supplied URLs (a backup-import link, say), and a session
 *  cookie leaking onto one of those would hand the session to whoever runs
 *  that host. */
function isInstanceOrigin(url: string): boolean {
  if (!base) return false;
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

async function tauriRemoteFetch(url: string, init?: RequestInit): Promise<Response> {
  const { invoke } = (window as unknown as { __TAURI_INTERNALS__: TauriInternals }).__TAURI_INTERNALS__;
  const req = new Request(url, init);
  // The Rust client has no cookie jar: attach the parked session pair to
  // instance-origin requests so a device-code sign-in survives - and to no
  // other host, ever (see isInstanceOrigin).
  if (instanceSession && isInstanceOrigin(url) && !req.headers.has('cookie')) {
    req.headers.set('cookie', instanceSession);
  }
  const bodyBuf = await req.arrayBuffer();
  const resp = await invoke<TauriRemoteFetchResponse>('remote_fetch', {
    request: {
      method: req.method,
      url: req.url,
      headers: Array.from(req.headers.entries()),
      body: bodyBuf.byteLength ? Array.from(new Uint8Array(bodyBuf)) : null,
    },
  });
  const body = resp.body instanceof ArrayBuffer ? new Uint8Array(resp.body) : Uint8Array.from(resp.body);
  // Null-body statuses (fetch spec) - Response() throws if handed bytes for them.
  const nullBody = [101, 103, 204, 205, 304].includes(resp.status);
  const out = new Response(nullBody ? null : body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: new Headers(resp.headers),
  });
  Object.defineProperty(out, 'url', { value: resp.url, writable: false });
  return out;
}
