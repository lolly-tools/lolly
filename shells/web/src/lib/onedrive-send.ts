// SPDX-License-Identifier: MPL-2.0
/**
 * OneDrive send target (plans/129) - the `o365` driver (the lolly-work
 * vocabulary; one driver covers consumer OneDrive AND work/school O365 drives)
 * on the shared provider-auth machinery: Microsoft identity platform,
 * authorization-code + PKCE, as a SINGLE-PAGE APPLICATION client ON THE WEB.
 * That client type matters twice over there: it is what makes the token
 * endpoint answer CORS from a browser, and what allows a public client (no
 * secret) - the redirect URI must be registered under "Single-page
 * application" in the Azure app or the exchange fails, which the setup guide
 * spells out. The desktop shells need a different platform on the same app;
 * see the DESKTOP note below.
 *
 * SCOPES, minimal and named in the UI: Files.ReadWrite.AppFolder (the app's
 * own folder under Apps/, never the whole drive), User.Read (the /profile
 * account label), offline_access (a refresh token - persisted only when the
 * user opts into "stay connected"; Microsoft ROTATES refresh tokens, so every
 * refresh re-saves the new one).
 *
 * UPLOADS: files up to 4 MB go straight to Graph
 * (PUT /me/drive/special/approot:/name:/content); larger media goes through an
 * UPLOAD SESSION - Graph hands back a pre-authenticated uploadUrl (NO
 * Authorization header on the chunk PUTs, per Graph's contract) on a
 * Microsoft-owned upload host. Those hosts are in the deploy CSP; a
 * self-hosted deploy that trims them keeps small files working and gets an
 * honest error for large ones.
 *
 * DESKTOP (plans/129 WP4b) needs a SECOND registration, exactly like Google's:
 * a token exchange from a native client sends no Origin header, so an
 * SPA-registered redirect is refused and a Web-registered one demands a
 * secret. The desktop redirect belongs under Entra's "Mobile and desktop
 * applications" platform - still a public client, still code+PKCE, no secret -
 * and Microsoft ignores the PORT when matching a localhost reply URL, so
 * registering `http://localhost/oauth-return` once covers every ephemeral port
 * the loopback listener binds. The `http://127.0.0.1` form cannot be added
 * through the portal UI at all, which is why the leg uses host 'localhost'.
 * Config: VITE_MS_DESKTOP_CLIENT_ID (the same application id, once its
 * registration carries that platform, or a separate one), runtime-overridable
 * via setOneDriveDesktopClientId. No id → no OneDrive UI in the desktop apps.
 */

import { t } from '../i18n.ts';
import { isTauriShell, isTauriMobileShell } from './instance-choice.ts';
import {
  codeGrant, loopbackVia, mobileVia, popupVia, providerFetch, refreshGrant,
  type AuthorizeVia, type TokenSet,
} from './provider-auth.ts';
import {
  getConnection, saveConnection, removeConnection,
  cachedToken, cacheToken, dropToken,
} from './provider-connections.ts';
import type { SendTarget } from './send-target.ts';
import type { SyncRemote, SnapshotMeta, PutOpts } from './sync-remote.ts';
import { SyncConflictError } from './sync-remote.ts';

const KIND = 'o365';
const AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'Files.ReadWrite.AppFolder User.Read offline_access';

/** Graph accepts simple PUTs up to 4 MB; anything larger needs a session. */
export const GRAPH_SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024;
/** Session chunk size - Graph requires a multiple of 320 KiB; 12 of them. */
export const GRAPH_CHUNK_BYTES = 320 * 1024 * 12;

let clientIdOverride: string | null = null;

/** Runtime override (an instance config or a test); null restores the env value. */
export function setOneDriveClientId(id: string | null): void { clientIdOverride = id; }

export function oneDriveClientId(): string {
  if (clientIdOverride !== null) return clientIdOverride;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_MS_CLIENT_ID || '';
}

export function oneDriveAvailable(): boolean { return !!oneDriveClientId(); }

let desktopClientIdOverride: string | null = null;

/** Runtime override for the desktop client (an instance config, a `.lolly`
 *  pack, or a test); null restores the env value. */
export function setOneDriveDesktopClientId(id: string | null): void { desktopClientIdOverride = id; }

export function oneDriveDesktopClientId(): string {
  if (desktopClientIdOverride !== null) return desktopClientIdOverride;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_MS_DESKTOP_CLIENT_ID || '';
}

/** Whether the desktop Send-to-OneDrive affordance exists (Tauri shells). */
export function oneDriveDesktopAvailable(): boolean { return !!oneDriveDesktopClientId(); }

let mobileClientIdOverride: string | null = null;

/** Runtime override for the mobile client; null restores the env value. */
export function setOneDriveMobileClientId(id: string | null): void { mobileClientIdOverride = id; }

/** The client id for the mobile apps (plans/138 Tier D, WP-M1): an Entra app
 *  whose "Mobile and desktop applications" platform lists the redirect
 *  `tools.lolly.mobile:/oauth2redirect` (provider-auth MOBILE_REDIRECT_URI). It
 *  may be the desktop app with that redirect added. */
export function oneDriveMobileClientId(): string {
  if (mobileClientIdOverride !== null) return mobileClientIdOverride;
  return import.meta.env?.VITE_MS_MOBILE_CLIENT_ID || '';
}

/** Whether OneDrive sign-in can work in the mobile app. */
export function oneDriveMobileAvailable(): boolean {
  return isTauriMobileShell() && !!oneDriveMobileClientId();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/** The client id for THIS shell: the SPA client on the web, the mobile-and-
 *  desktop-platform client in Tauri. One token path serves both - the grant is
 *  the same code+PKCE public-client flow; only the registration differs. */
function activeClientId(): string {
  if (isTauriMobileShell()) return oneDriveMobileClientId();
  return isTauriShell() ? oneDriveDesktopClientId() : oneDriveClientId();
}

const grantCfg = () => ({
  authorizeUrl: AUTHORIZE_URL,
  tokenUrl: TOKEN_URL,
  clientId: activeClientId(),
  scopes: SCOPES,
  windowName: 'lolly-onedrive-auth',
});

/** The authorize leg for this shell: the browser popup on the web, the system
 *  browser + a localhost loopback listener on the desktop, and the system
 *  sign-in sheet in the mobile apps. */
async function authorizeVia(): Promise<AuthorizeVia> {
  if (isTauriMobileShell()) return mobileVia();
  return isTauriShell()
    ? await loopbackVia(undefined, { host: 'localhost' })
    : popupVia('lolly-onedrive-auth');
}

function remember(set: TokenSet): void {
  cacheToken(KIND, set.accessToken, set.expiresAt);
}

/** A valid access token: cache → refresh (stored connection) → interactive.
 *  Microsoft rotates refresh tokens, so a successful refresh RE-SAVES. */
async function token(fetchFn: typeof fetch = providerFetch): Promise<string> {
  const held = cachedToken(KIND);
  if (held) return held;
  const conn = await getConnection(KIND);
  if (conn?.refreshToken) {
    try {
      const set = await refreshGrant({ tokenUrl: TOKEN_URL, clientId: activeClientId(), scopes: SCOPES }, conn.refreshToken, fetchFn);
      remember(set);
      if (set.refreshToken && set.refreshToken !== conn.refreshToken) {
        await saveConnection({ ...conn, refreshToken: set.refreshToken });
      }
      return set.accessToken;
    } catch { /* refresh revoked/expired - fall through to interactive */ }
  }
  const set = await codeGrant(grantCfg(), fetchFn, await authorizeVia());
  remember(set);
  if (conn) await saveConnection({ ...conn, ...(conn.persist && set.refreshToken ? { refreshToken: set.refreshToken } : {}) });
  return set.accessToken;
}

async function graph(path: string, init: RequestInit = {}, fetchFn: typeof fetch = providerFetch): Promise<Response> {
  const doFetch = async (tok: string) => fetchFn(`${GRAPH}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${tok}` },
  });
  let res = await doFetch(await token(fetchFn));
  if (res.status === 401) {
    dropToken(KIND);
    res = await doFetch(await token(fetchFn));
  }
  return res;
}

// ── /profile connection surface ───────────────────────────────────────────────

export async function connectOneDrive(persist: boolean, fetchFn: typeof fetch = providerFetch): Promise<string> {
  const set = await codeGrant(grantCfg(), fetchFn, await authorizeVia());
  remember(set);
  const res = await graph('/me', {}, fetchFn);
  if (!res.ok) throw new Error(t('Could not read the Microsoft account ({status})', { status: res.status }));
  const me = await res.json() as { mail?: string; userPrincipalName?: string; displayName?: string };
  const account = me.mail || me.userPrincipalName || me.displayName || t('Microsoft account');
  await saveConnection({
    kind: KIND,
    account,
    persist,
    ...(persist && set.refreshToken ? { refreshToken: set.refreshToken } : {}),
    scopes: SCOPES,
    connectedAt: new Date().toISOString(),
  });
  return account;
}

/** The desktop /profile row's entry point (plans/129 WP4b). Same grant, same
 *  custody: activeClientId() picks the mobile-and-desktop-platform client and
 *  authorizeVia() the system-browser loopback leg, so this is a named door onto
 *  connectOneDrive rather than a second flow to keep in step. */
export async function connectOneDriveDesktop(persist: boolean): Promise<string> {
  return connectOneDrive(persist);
}

/** Microsoft has no simple public revocation endpoint for this shape - the
 *  local wipe is the action; the account's own security page lists the grant.
 *  Shared by both shells: there is nothing shell-specific to revoke. */
export async function disconnectOneDrive(): Promise<void> {
  await removeConnection(KIND);
}

// ── Upload ────────────────────────────────────────────────────────────────────

/** The Content-Range chunks an upload session PUTs. Pure, for its test. */
export function uploadChunkRanges(total: number, chunk = GRAPH_CHUNK_BYTES): Array<{ start: number; end: number; range: string }> {
  const out: Array<{ start: number; end: number; range: string }> = [];
  for (let start = 0; start < total; start += chunk) {
    const end = Math.min(start + chunk, total);
    out.push({ start, end, range: `bytes ${start}-${end - 1}/${total}` });
  }
  return out;
}

interface DriveItem { id?: string; webUrl?: string; name?: string }

async function uploadSmall(bytes: Uint8Array, name: string, mime: string, fetchFn: typeof fetch): Promise<DriveItem> {
  const res = await graph(`/me/drive/special/approot:/${encodeURIComponent(name)}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': mime || 'application/octet-stream' },
    body: bytes as unknown as BodyInit,
  }, fetchFn);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(t('OneDrive upload failed ({status})', { status: res.status }) + (text ? `: ${text.slice(0, 160)}` : ''));
  }
  return await res.json() as DriveItem;
}

async function uploadLarge(bytes: Uint8Array, name: string, fetchFn: typeof fetch): Promise<DriveItem> {
  const sess = await graph(`/me/drive/special/approot:/${encodeURIComponent(name)}:/createUploadSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename', name } }),
  }, fetchFn);
  if (!sess.ok) throw new Error(t('OneDrive upload failed ({status})', { status: sess.status }));
  const { uploadUrl } = await sess.json() as { uploadUrl?: string };
  if (!uploadUrl) throw new Error(t('OneDrive upload failed ({status})', { status: 500 }));
  const last = await putChunks(uploadUrl, bytes, fetchFn);
  if (last && !last.ok) {
    const text = await last.text().catch(() => '');
    throw new Error(t('OneDrive upload failed ({status})', { status: last.status }) + (text ? `: ${text.slice(0, 160)}` : ''));
  }
  return (await last?.json().catch(() => ({}))) as DriveItem;
}

/** PUT every chunk to an upload session in order. Returns the last response,
 *  which is the first one that was not OK when a chunk fails, and null when
 *  there were no bytes. Shared by the send target and the sync remote. */
async function putChunks(uploadUrl: string, bytes: Uint8Array, fetchFn: typeof fetch): Promise<Response | null> {
  let last: Response | null = null;
  for (const { start, end, range } of uploadChunkRanges(bytes.byteLength)) {
    // The session URL is PRE-AUTHENTICATED - no Authorization header, per Graph.
    last = await fetchFn(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Range': range, 'Content-Type': 'application/octet-stream' },
      body: bytes.subarray(start, end) as unknown as BodyInit,
    });
    if (!last.ok) return last;
  }
  return last;
}

// ── The SendTarget ────────────────────────────────────────────────────────────

export function oneDriveSendTarget(): SendTarget {
  return {
    kind: KIND,
    label: t('OneDrive'),
    // No formats list: every export format Lolly makes is welcome.
    available: () => (isTauriMobileShell() ? oneDriveMobileAvailable()
      : isTauriShell() ? oneDriveDesktopAvailable() : oneDriveAvailable()),
    hint: isTauriShell()
      ? t('Uploads this file to the Lolly app folder in your OneDrive. Lolly can only see that folder, and whether your sign-in is remembered on this device is your choice in Profile.')
      : t('Uploads this file to the Lolly app folder in your OneDrive. Lolly can only see that folder, and whether your sign-in is remembered in this browser is your choice in Profile.'),
    send: async ({ bytes, name, format, mime }) => {
      const filename = name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`;
      const item = bytes.byteLength <= GRAPH_SIMPLE_UPLOAD_MAX
        ? await uploadSmall(bytes, filename, mime, providerFetch)
        : await uploadLarge(bytes, filename, providerFetch);
      return {
        url: item.webUrl,
        label: item.webUrl ? t('Open in OneDrive') : t('Saved to OneDrive ({name})', { name: item.name ?? filename }),
      };
    },
  };
}

// ── The SyncRemote (plans/138 Tier D, WP-P1) ──────────────────────────────────
// Device sync's two-way access over the SAME app-folder token the send target
// uses (Files.ReadWrite.AppFolder already allows reading back). ONE path in the
// app folder holds the snapshot, addressed by path under special/approot, so no
// item id is ever stored. Graph creates the item on the first write.
//
// REV: the item's cTag, not its eTag. Graph documents cTag as "an eTag for the
// content of the item", unchanged when only metadata changes, while eTag covers
// metadata too. A rev that moved on a metadata-only change would read as a
// newer copy on every device and refuse this device's next push as a conflict,
// with no content to show for it. The eTag is still what a write condition
// names (see put below).
//
// DOWNLOAD: the item's @microsoft.graph.downloadUrl, fetched with no
// Authorization header. Microsoft's docs say a JavaScript app cannot use
// /content, because its 302 redirect is refused after a CORS preflight; the
// pre-authenticated URL needs no preflight. /content stays as the fallback for a
// read that carries no download URL.
//
// WEB REALITY, as for Dropbox: the token is session-only unless the person chose
// "stay connected", so canSyncSilently() keeps the automatic paths away from a
// sign-in outside a gesture.

const SYNC_PATH = 'lolly-sync/snapshot.lolly';
/** The fields a metadata read needs. get() reads the default set instead,
 *  because that set carries the download URL. */
const META_SELECT = 'id,eTag,cTag,size,lastModifiedDateTime';

interface GraphSyncItem {
  id?: string;
  eTag?: string;
  cTag?: string;
  size?: number;
  lastModifiedDateTime?: string;
  '@microsoft.graph.downloadUrl'?: string;
}

/** Graph path addressing under the app folder: every segment percent-encoded,
 *  the slashes between them kept. Empty, "." and ".." segments are dropped. */
function appFolderItem(path: string): string {
  const segs = path.split('/').filter((s) => s && s !== '.' && s !== '..');
  const use = segs.length ? segs : SYNC_PATH.split('/');
  return `/me/drive/special/approot:/${use.map(encodeURIComponent).join('/')}:`;
}

/** cTag first; eTag only for an answer that has no cTag (Graph omits it for
 *  folders, never for files). */
const itemRev = (item: GraphSyncItem): string => item.cTag ?? item.eTag ?? '';

const itemMeta = (item: GraphSyncItem, fallbackSize: number): SnapshotMeta => ({
  rev: itemRev(item),
  updatedAt: item.lastModifiedDateTime ?? new Date().toISOString(),
  size: Number(item.size) || fallbackSize,
});

type ConflictBehavior = 'replace' | 'fail';

/** A OneDrive-backed SyncRemote over the user's app folder. `path` (relative to
 *  the app folder) defaults to the device-sync snapshot; the sync service passes
 *  the backup slots (`lolly-backup/day-3.lolly`). `fetchFn` is injectable for
 *  tests; production uses providerFetch, the browser fetch on the web and the
 *  native request command in the Tauri apps. */
export function onedriveSyncRemote(fetchFn: typeof fetch = providerFetch, path: string = SYNC_PATH): SyncRemote {
  const item = appFolderItem(path);

  /** The stored item's metadata, or null when there is none. `query` picks the
   *  fields ('' = Graph's default set). */
  const readItem = async (query: string): Promise<GraphSyncItem | null> => {
    const res = await graph(`${item}${query}`, {}, fetchFn);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(t('OneDrive request failed ({status})', { status: res.status }));
    return await res.json() as GraphSyncItem;
  };

  const head = async (): Promise<SnapshotMeta | null> => {
    const found = await readItem(`?$select=${META_SELECT}`);
    return found ? itemMeta(found, 0) : null;
  };

  const get = async (): Promise<{ bytes: Uint8Array; meta: SnapshotMeta } | null> => {
    // Metadata first, then the bytes. Another device writing in between can only
    // make the bytes NEWER than the rev returned with them, which the engine
    // then reports as a newer copy or a conflict. The reverse order could pair
    // older bytes with a newer rev and let this device overwrite a copy it never saw.
    const found = await readItem('');
    if (!found) return null;
    const downloadUrl = found['@microsoft.graph.downloadUrl'];
    let res: Response;
    try {
      res = downloadUrl
        ? await fetchFn(downloadUrl)   // pre-authenticated: no Authorization header
        : await graph(`${item}/content`, {}, fetchFn);
    } catch (err) {
      // Personal accounts serve the bytes from Microsoft download hosts that the
      // web app's content policy does not list yet (plans/138 Tier D, D14). The
      // Tauri apps are not affected.
      if (!isTauriShell()) throw new Error(t('OneDrive sent the file from a Microsoft address this site does not allow yet. Use the Lolly app for OneDrive sync, or another sync home.'));
      throw err;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(t('OneDrive request failed ({status})', { status: res.status }));
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, meta: { ...itemMeta(found, bytes.length), size: bytes.length } };
  };

  /**
   * A Graph request that may carry If-Match. The value is the eTag exactly as
   * Graph returned it, not a rev passed through preconditionHeaders(): work and
   * school eTags arrive already quoted ("{GUID},3") while older personal-account
   * eTags arrive bare, and the safe choice is to send back the same string Graph
   * gave out. In a browser, a Graph CORS answer that does not allow If-Match
   * fails the preflight before any request is made, so the request is tried once
   * more without it: put() compared the stored copy just before. Never in the
   * Tauri apps, whose native transport has no preflight.
   */
  const send = async (reqPath: string, init: RequestInit, ifMatch: string | undefined): Promise<Response> => {
    if (!ifMatch) return graph(reqPath, init, fetchFn);
    const headers = init.headers as Record<string, string>;
    try {
      return await graph(reqPath, { ...init, headers: { ...headers, 'If-Match': ifMatch } }, fetchFn);
    } catch (err) {
      if (!(err instanceof TypeError) || isTauriShell()) throw err;
      return graph(reqPath, init, fetchFn);
    }
  };

  /** One upload attempt. Resolves to Graph's answer, OK or not, so put() can
   *  read a refused condition. The send target's upload helpers are not used:
   *  they rename on a name clash, and sync must replace or fail instead. */
  const write = async (bytes: Uint8Array, behavior: ConflictBehavior, ifMatch?: string): Promise<Response> => {
    if (bytes.byteLength <= GRAPH_SIMPLE_UPLOAD_MAX) {
      // Graph reads the conflict behaviour from the URL on a PUT.
      return send(`${item}/content?@microsoft.graph.conflictBehavior=${behavior}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        // A copy (at most 4 MB) whose type is a plain BufferSource.
        body: new Uint8Array(bytes),
      }, ifMatch);
    }
    // An upload session reads it from the body, and its default is 'fail', so
    // an overwrite names 'replace' explicitly.
    const sess = await send(`${item}/createUploadSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': behavior } }),
    }, ifMatch);
    if (!sess.ok) return sess;
    const { uploadUrl } = await sess.json().catch(() => ({})) as { uploadUrl?: string };
    if (!uploadUrl) throw new Error(t('OneDrive upload failed ({status})', { status: 500 }));
    const last = await putChunks(uploadUrl, bytes, fetchFn);
    if (!last) throw new Error(t('OneDrive upload failed ({status})', { status: 500 }));
    if (!last.ok) {
      // A failed session keeps its bytes until it expires; a retry opens a new
      // one, so this one is cancelled now. Best effort.
      await fetchFn(uploadUrl, { method: 'DELETE' }).catch(() => undefined);
    }
    return last;
  };

  const put = async (bytes: Uint8Array, opts?: PutOpts): Promise<SnapshotMeta> => {
    const ifRev = opts?.ifRev;
    let res: Response;
    if (ifRev === undefined) {
      res = await write(bytes, 'replace');
    } else {
      // A conditional write reads the stored item first: the rev is a cTag,
      // while Graph documents If-Match against the eTag, so the eTag to name
      // comes from this read. A copy that already differs is refused here,
      // without an upload.
      const current = await readItem(`?$select=${META_SELECT}`);
      const holds = ifRev === null ? !current : !!current && itemRev(current) === ifRev;
      if (!holds) throw new SyncConflictError();
      // "Nothing stored yet" is conflictBehavior 'fail' (409 when the name is
      // taken). "Still this copy" is If-Match with that eTag (412 when it moved).
      res = ifRev === null
        ? await write(bytes, 'fail')
        : await write(bytes, 'replace', current?.eTag);
      if (res.status === 412 || res.status === 409) {
        // Graph refused the condition. Read again to see why.
        const now = await readItem(`?$select=${META_SELECT}`);
        if (ifRev === null ? !!now : !now || itemRev(now) !== ifRev) throw new SyncConflictError();
        // The content is still the copy the engine named, so the refusal was
        // about metadata alone (for example an eTag that moved when the upload
        // session opened). The contract allows this write, so try once more
        // without If-Match. A write from another device in the moment between
        // that read and this upload is not caught.
        if (ifRev !== null) res = await write(bytes, 'replace');
      }
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(t('OneDrive upload failed ({status})', { status: res.status }) + (text ? `: ${text.slice(0, 160)}` : ''));
    }
    const written = await res.json().catch(() => ({})) as GraphSyncItem;
    // An answer without a cTag would give this device a rev that the next
    // head() never matches, so the rev is read back instead.
    if (!written.cTag) {
      const readBack = await readItem(`?$select=${META_SELECT}`);
      if (readBack) return itemMeta(readBack, bytes.length);
    }
    return itemMeta(written, bytes.length);
  };

  const canSyncSilently = async (): Promise<boolean> =>
    !!cachedToken(KIND) || !!(await getConnection(KIND))?.refreshToken;

  return { kind: KIND, head, get, put, canSyncSilently };
}
