// SPDX-License-Identifier: MPL-2.0
/**
 * Dropbox send target (plans/129) - the `dropbox` driver on the shared
 * provider-auth machinery: authorization-code + PKCE (public client, no
 * secret), refresh tokens when the user opts into "stay connected", uploads
 * into the app's OWN FOLDER only.
 *
 * SCOPES, minimal and named in the UI: files.content.write (put the file),
 * files.content.read (mint the short-lived "Open" link via get_temporary_link
 * - no public share is ever created), account_info.read (the /profile row's
 * account label). The Dropbox app registration must be "App folder" access
 * type, so the token can only ever see Apps/<app-name>/.
 *
 * DORMANT without a client id (VITE_DROPBOX_CLIENT_ID, or an instance's
 * runtime override) - the gdrive precedent: no id, no button, byte-identical.
 *
 * DESKTOP (plans/129 WP4b): the SAME app key, no second registration. Dropbox
 * documents localhost redirect URIs as allowed without pre-registration, over
 * http or https - so the Tauri shells run the same code+PKCE grant through the
 * system browser with a `http://localhost:<port>/oauth-return` loopback leg
 * (provider-auth's loopbackVia with host 'localhost'; the IP form 127.0.0.1 is
 * NOT documented as exempt, so it stays unused here). API calls ride
 * providerFetch, which is the CORS-free Tauri client on desktop and plain
 * fetch on the web.
 *
 * GOTCHA the test pins: the Dropbox-API-Arg header must be ASCII - a filename
 * with any non-ASCII character must be \uXXXX-escaped into the JSON header or
 * the request is refused at the HTTP layer.
 */

import { t } from '../i18n.ts';
import { isTauriShell, isTauriMobileShell } from './instance-choice.ts';
import {
  codeGrant, loopbackVia, mobileVia, popupVia, providerFetch, refreshGrant,
  type AuthorizeVia, type TokenSet,
} from './provider-auth.ts';
import {
  getConnection, saveConnection, removeConnection,
  cachedToken, cacheToken, dropToken, cachedConnection, hasConnection,
} from './provider-connections.ts';
import {
  ShareRefusedError, ShareUnavailableError,
  type SendTarget, type ShareCapabilities, type ShareLinkOutcome, type ShareOptions,
} from './send-target.ts';
import type { SyncRemote, SnapshotMeta, PutOpts } from './sync-remote.ts';
import { SyncConflictError } from './sync-remote.ts';

const KIND = 'dropbox';
const AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';
const SCOPES = 'files.content.write files.content.read account_info.read';

let clientIdOverride: string | null = null;

/** Runtime override (an instance config or a test); null restores the env value. */
export function setDropboxClientId(id: string | null): void { clientIdOverride = id; }

export function dropboxClientId(): string {
  if (clientIdOverride !== null) return clientIdOverride;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  // In the mobile apps the build's key counts only when its Dropbox app also
  // lists the mobile redirect (VITE_DROPBOX_MOBILE=1, plans/138 Tier D, M1);
  // otherwise the person brings their own key, registered for that redirect.
  const deployKey = isTauriMobileShell() && env?.VITE_DROPBOX_MOBILE !== '1' ? '' : env?.VITE_DROPBOX_CLIENT_ID;
  // Deploy id first, else the user's OWN app key saved with their connection -
  // the /profile bring-your-own path for deploys with no Dropbox registration.
  // Sync read of the primed cache, same rule as hasConnection().
  return deployKey || cachedConnection(KIND)?.config?.clientId || '';
}

export function dropboxAvailable(): boolean { return !!dropboxClientId(); }

// ── Auth ──────────────────────────────────────────────────────────────────────

const grantCfg = () => ({
  authorizeUrl: AUTHORIZE_URL,
  tokenUrl: TOKEN_URL,
  clientId: dropboxClientId(),
  scopes: SCOPES,
  // offline = a refresh token comes back; whether it PERSISTS is the user's
  // custody choice, decided in connect() below.
  extraAuthParams: { token_access_type: 'offline' },
  windowName: 'lolly-dropbox-auth',
});

/** The authorize leg for this shell: the browser popup on the web, the system
 *  browser + a localhost loopback listener on the desktop, and the system
 *  sign-in sheet with the tools.lolly.mobile redirect in the mobile apps. */
async function authorizeVia(): Promise<AuthorizeVia> {
  if (isTauriMobileShell()) return mobileVia();
  return isTauriShell()
    ? await loopbackVia(undefined, { host: 'localhost' })
    : popupVia('lolly-dropbox-auth');
}

function remember(set: TokenSet): void {
  cacheToken(KIND, set.accessToken, set.expiresAt);
}

/** A valid access token: cache → refresh (stored connection) → interactive. */
async function token(fetchFn: typeof fetch = providerFetch): Promise<string> {
  const held = cachedToken(KIND);
  if (held) return held;
  const conn = await getConnection(KIND);
  if (conn?.refreshToken) {
    try {
      const set = await refreshGrant({ tokenUrl: TOKEN_URL, clientId: dropboxClientId() }, conn.refreshToken, fetchFn);
      remember(set);
      if (set.refreshToken && set.refreshToken !== conn.refreshToken) {
        await saveConnection({ ...conn, refreshToken: set.refreshToken });
      }
      return set.accessToken;
    } catch { /* refresh revoked/expired - fall through to interactive */ }
  }
  const set = await codeGrant(grantCfg(), fetchFn, await authorizeVia());
  remember(set);
  // A send-time sign-in without a /profile connection stays session-only.
  if (conn) await saveConnection({ ...conn, ...(conn.persist && set.refreshToken ? { refreshToken: set.refreshToken } : {}) });
  return set.accessToken;
}

/** POST an RPC endpoint with one 401 retry through a fresh token. */
async function rpc(path: string, body: unknown, fetchFn: typeof fetch = providerFetch): Promise<Record<string, unknown>> {
  const doPost = async (tok: string) => fetchFn(`${API}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? null),
  });
  let res = await doPost(await token(fetchFn));
  if (res.status === 401) {
    dropToken(KIND);
    res = await doPost(await token(fetchFn));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(t('Dropbox request failed ({status})', { status: res.status }) + (text ? `: ${text.slice(0, 160)}` : ''));
  }
  return await res.json() as Record<string, unknown>;
}

// ── /profile connection surface ───────────────────────────────────────────────

/** Interactive connect from /profile: grant, identity, custody. `appKey` is the
 *  bring-your-own client id for deploys with no Dropbox registration - it rides
 *  the connection record's config so later sends and refreshes find it. */
export async function connectDropbox(persist: boolean, fetchFn: typeof fetch = providerFetch, appKey?: string): Promise<string> {
  const set = await codeGrant(appKey ? { ...grantCfg(), clientId: appKey } : grantCfg(), fetchFn, await authorizeVia());
  remember(set);
  const who = await rpc('users/get_current_account', null, fetchFn);
  const account = (who.email as string) || ((who.name as { display_name?: string })?.display_name ?? t('Dropbox account'));
  await saveConnection({
    kind: KIND,
    account,
    persist,
    ...(persist && set.refreshToken ? { refreshToken: set.refreshToken } : {}),
    ...(appKey ? { config: { clientId: appKey } } : {}),
    scopes: SCOPES,
    connectedAt: new Date().toISOString(),
  });
  return account;
}

/** Disconnect: best-effort provider-side revocation, then wipe locally. */
export async function disconnectDropbox(fetchFn: typeof fetch = providerFetch): Promise<void> {
  const held = cachedToken(KIND);
  if (held) {
    try {
      await fetchFn(`${API}/auth/token/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${held}` } });
    } catch { /* revocation is a courtesy; the wipe below is the guarantee */ }
  }
  sharingGrantedThisSession = false;
  await removeConnection(KIND);
}

// ── Upload ────────────────────────────────────────────────────────────────────

/** Dropbox-API-Arg must be ASCII: escape every non-ASCII char in the JSON.
 *  Exported for its test. */
export function dropboxApiArg(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) =>
    `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

interface DropboxFile { path_display?: string; path_lower?: string; name?: string }

export async function dropboxUpload(bytes: Uint8Array, path: string, fetchFn: typeof fetch = providerFetch): Promise<DropboxFile> {
  const doPost = async (tok: string) => fetchFn(`${CONTENT}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tok}`,
      'Dropbox-API-Arg': dropboxApiArg({ path, mode: 'add', autorename: true, mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: bytes as unknown as BodyInit,
  });
  let res = await doPost(await token(fetchFn));
  if (res.status === 401) {
    dropToken(KIND);
    res = await doPost(await token(fetchFn));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(t('Dropbox upload failed ({status})', { status: res.status }) + (text ? `: ${text.slice(0, 160)}` : ''));
  }
  return await res.json() as DropboxFile;
}

// ── The SendTarget ────────────────────────────────────────────────────────────

export function dropboxSendTarget(): SendTarget {
  return {
    kind: KIND,
    label: t('Dropbox'),
    // No formats list: every export format Lolly makes is welcome.
    // In the mobile apps a send needs a connection: without one, the key alone
    // does not prove the mobile redirect was registered (plans/138 Tier D, M1).
    available: () => dropboxAvailable() && (!isTauriMobileShell() || hasConnection(KIND)),
    hint: isTauriShell()
      ? t('Uploads this file to the Lolly app folder in your Dropbox. Lolly can only see that folder, and whether your sign-in is remembered on this device is your choice in Profile.')
      : t('Uploads this file to the Lolly app folder in your Dropbox. Lolly can only see that folder, and whether your sign-in is remembered in this browser is your choice in Profile.'),
    send: async ({ bytes, name, format }) => {
      const filename = name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`;
      const file = await dropboxUpload(bytes, `/${filename}`);
      // A short-lived direct link (4h), never a public share.
      let url: string | undefined;
      try {
        const link = await rpc('files/get_temporary_link', { path: file.path_lower ?? `/${filename}` });
        if (typeof link.link === 'string') url = link.link;
      } catch { /* the upload stands; the label carries the outcome */ }
      return { url, label: t('Saved to Dropbox ({path})', { path: file.path_display ?? `/${filename}` }), ref: file.path_lower ?? `/${filename}` };
    },
    shareCapabilities: dropboxShareCapabilities,
    share: (ref, options) => dropboxShare(ref, options),
    revoke: (link) => dropboxRevoke(link.revokeRef ?? link.url),
  };
}

// ── Share links (sharing/create_shared_link_with_settings) ────────────────────
//
// Making a link needs the `sharing.write` scope, which an ordinary Send does not.
// It is asked for ONLY here, the first time a person creates a link, as a second
// consent that adds to what they already granted (include_granted_scopes). Until
// the Dropbox app's own console lists the scope, that consent is refused by Dropbox
// and the person is told so; Send itself is untouched either way.
//
// Dropbox lets a Basic plan make a public link but not set a password or expiry.
// An expiry that is refused is dropped and the link says so. A PASSWORD that is
// refused is not dropped: a link that is open when the person asked for it to be
// locked is wider than asked, so that is reported as a refusal instead.

const SHARE_SCOPE = 'sharing.write';
let sharingGrantedThisSession = false;

export function dropboxShareCapabilities(): ShareCapabilities {
  return { audiences: ['anyone', 'organisation'], password: true, expiry: true, revocable: true };
}

/** Run the second, incremental consent for `sharing.write`. */
async function grantSharingScope(fetchFn: typeof fetch): Promise<string> {
  const conn = await getConnection(KIND);
  const appKey = conn?.config?.clientId;
  const cfg = {
    ...grantCfg(),
    ...(appKey ? { clientId: appKey } : {}),
    scopes: `${SCOPES} ${SHARE_SCOPE}`,
    extraAuthParams: { token_access_type: 'offline', include_granted_scopes: 'user' },
  };
  let set: TokenSet;
  try {
    set = await codeGrant(cfg, fetchFn, await authorizeVia());
  } catch (error) {
    const msg = String((error as Error)?.message ?? '');
    if (/scope|access_denied/i.test(msg) && !/cancel|closed/i.test(msg)) {
      throw new ShareUnavailableError(t('Dropbox did not allow sharing. The app needs the sharing.write permission switched on in the Dropbox App Console first.'));
    }
    throw error;
  }
  remember(set);
  sharingGrantedThisSession = true;
  if (conn) {
    await saveConnection({
      ...conn,
      ...(conn.persist && set.refreshToken ? { refreshToken: set.refreshToken } : {}),
      scopes: `${SCOPES} ${SHARE_SCOPE}`,
    });
  }
  return set.accessToken;
}

interface DropboxErrorBody { error_summary?: string; error?: { '.tag'?: string; settings_error?: { '.tag'?: string }; shared_link_already_exists?: { metadata?: { url?: string } } } }

/** POST a sharing RPC. Asks for the scope up front when this connection has not
 *  been given it, and again if Dropbox answers `missing_scope`. */
async function sharingRpc(path: string, body: unknown, fetchFn: typeof fetch): Promise<Response> {
  const conn = await getConnection(KIND);
  const have = sharingGrantedThisSession || !!conn?.scopes?.split(' ').includes(SHARE_SCOPE);
  let tok = have ? await token(fetchFn) : await grantSharingScope(fetchFn);
  const doPost = (tk: string) => fetchFn(`${API}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let res = await doPost(tok);
  if (res.status === 401) {
    const text = await res.clone().text().catch(() => '');
    if (text.includes('missing_scope')) { tok = await grantSharingScope(fetchFn); }
    else { dropToken(KIND); tok = await token(fetchFn); }
    res = await doPost(tok);
  }
  return res;
}

/** Dropbox timestamps are second-precision UTC. */
const dropboxTime = (iso: string): string => iso.replace(/\.\d+Z$/, 'Z');

export async function dropboxShare(ref: string, options: ShareOptions, fetchFn: typeof fetch = providerFetch): Promise<ShareLinkOutcome> {
  if (options.audience === 'people') throw new ShareRefusedError('people', t('Lolly cannot share with named people through Dropbox.'));
  const expiresAt = options.expiresInDays !== undefined ? new Date(Date.now() + options.expiresInDays * 86_400_000).toISOString() : undefined;
  const settings = (withExtras: boolean): Record<string, unknown> => ({
    audience: { '.tag': options.audience === 'organisation' ? 'team' : 'public' },
    access: { '.tag': 'viewer' },
    ...(withExtras && options.password ? { require_password: true, link_password: options.password } : {}),
    ...(withExtras && expiresAt ? { expires: dropboxTime(expiresAt) } : {}),
  });
  const attempt = (withExtras: boolean) => sharingRpc('sharing/create_shared_link_with_settings', { path: ref, settings: settings(withExtras) }, fetchFn);
  const notes: string[] = [];
  let res = await attempt(true);
  let err: DropboxErrorBody = res.ok ? {} : ((await res.clone().json().catch(() => ({}))) as DropboxErrorBody);

  if (!res.ok && err.error?.['.tag'] === 'settings_error') {
    // A Basic plan cannot set a password or an expiry. Say what was dropped.
    if (options.password) {
      throw new ShareRefusedError(options.audience, t('Your Dropbox plan does not allow a password on a link, so no link was made. You can make one without a password.'));
    }
    if (options.audience === 'organisation') {
      throw new ShareRefusedError('organisation', t('Your Dropbox account has no team to share with.'));
    }
    if (expiresAt) {
      res = await attempt(false);
      err = res.ok ? {} : ((await res.clone().json().catch(() => ({}))) as DropboxErrorBody);
      if (res.ok) notes.push(t('Your Dropbox plan does not allow an expiry date, so this link does not expire. Stop sharing to switch it off.'));
    }
  }
  if (!res.ok && err.error?.['.tag'] === 'shared_link_already_exists') {
    const url = err.error.shared_link_already_exists?.metadata?.url;
    if (!url) throw new Error(t('This file already has a Dropbox link with other settings. Manage that link in Dropbox.'));
    return { url, audience: options.audience, revokeRef: url, notes: [t('This file already had a link, so Lolly reused that link. Its settings are the ones Dropbox holds.')] };
  }
  if (res.status === 403 || (!res.ok && err.error?.['.tag'] === 'access_denied')) {
    throw new ShareRefusedError(options.audience, t('Dropbox will not make this link. Your team administrator may have turned link sharing off.'));
  }
  if (!res.ok) throw new Error(t('Dropbox could not make the link ({status})', { status: res.status }));
  const made = (await res.json()) as { url?: string; expires?: string };
  if (!made.url) throw new Error(t('Dropbox could not make the link ({status})', { status: 502 }));
  return {
    url: made.url,
    audience: options.audience,
    ...(made.expires ? { expiresAt: made.expires } : {}),
    revokeRef: made.url,
    ...(notes.length ? { notes } : {}),
  };
}

/** Revoke a shared link by its url. A link already gone counts as done. */
export async function dropboxRevoke(url: string, fetchFn: typeof fetch = providerFetch): Promise<void> {
  const res = await sharingRpc('sharing/revoke_shared_link', { url }, fetchFn);
  if (res.ok) return;
  const err = (await res.json().catch(() => ({}))) as DropboxErrorBody;
  if (res.status === 409 && /not_found/.test(err.error_summary ?? '')) return;
  throw new Error(t('Dropbox could not stop the sharing ({status})', { status: res.status }));
}

// ── The SyncRemote (plans/138 B1) ─────────────────────────────────────────────
// Device sync's two-way access over the SAME app-folder OAuth the send target
// uses. The sender is upload-only; sync adds get_metadata (HEAD-equivalent, cheap)
// and download (GET). ONE fixed path in the app folder holds the snapshot,
// uploaded with mode:overwrite (Dropbox auto-creates the parent dir). `rev` is
// Dropbox's own file `rev` (changes on every content write). A not-found metadata
// / download returns 409, mapped to null.

const SYNC_PATH = '/lolly-sync/snapshot.lolly';

interface DropboxMeta { rev?: string; size?: number; server_modified?: string }
const dbxMeta = (m: DropboxMeta, fallbackSize: number): SnapshotMeta => ({
  rev: m.rev ?? '',
  updatedAt: m.server_modified ?? new Date().toISOString(),
  size: Number(m.size) || fallbackSize,
});

/** A Dropbox-backed SyncRemote over the user's app folder. `path` defaults to the
 *  device-sync snapshot; the collab rendezvous (plans/138 Tier C) points it at
 *  signalling paths. `fetchFn` is injectable for tests; production uses providerFetch. */
export function dropboxSyncRemote(fetchFn: typeof fetch = providerFetch, path: string = SYNC_PATH): SyncRemote {
  // One 401 retry through a fresh token, like rpc()/dropboxUpload().
  const withToken = async (call: (tok: string) => Promise<Response>): Promise<Response> => {
    let res = await call(await token(fetchFn));
    if (res.status === 401) { dropToken(KIND); res = await call(await token(fetchFn)); }
    return res;
  };

  const head = async (): Promise<SnapshotMeta | null> => {
    const res = await withToken((tok) => fetchFn(`${API}/files/get_metadata`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }));
    if (res.status === 409) return null;   // path/not_found
    if (!res.ok) throw new Error(t('Dropbox request failed ({status})', { status: res.status }));
    return dbxMeta(await res.json() as DropboxMeta, 0);
  };

  const get = async (): Promise<{ bytes: Uint8Array; meta: SnapshotMeta } | null> => {
    const res = await withToken((tok) => fetchFn(`${CONTENT}/files/download`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Dropbox-API-Arg': dropboxApiArg({ path }) },
    }));
    if (res.status === 409) return null;
    if (!res.ok) throw new Error(t('Dropbox request failed ({status})', { status: res.status }));
    const metaJson = res.headers.get('dropbox-api-result');
    const meta = metaJson ? (JSON.parse(metaJson) as DropboxMeta) : {};
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, meta: dbxMeta(meta, bytes.length) };
  };

  const put = async (bytes: Uint8Array, opts?: PutOpts): Promise<SnapshotMeta> => {
    // Dropbox checks the condition itself: `update` writes only over that exact
    // rev, and `add` without autorename writes only where nothing exists yet.
    const ifRev = opts?.ifRev;
    const mode = ifRev === undefined ? 'overwrite'
      : ifRev === null ? 'add'
        : { '.tag': 'update', update: ifRev };
    const res = await withToken((tok) => fetchFn(`${CONTENT}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tok}`,
        // strict_conflict: an `update` naming a rev also conflicts when the file
        // was deleted since, and a write of identical bytes still reports the
        // conflict, so the engine always learns that the stored copy moved on.
        'Dropbox-API-Arg': dropboxApiArg({
          path, mode, autorename: false, mute: true, ...(ifRev === undefined ? {} : { strict_conflict: true }),
        }),
        'Content-Type': 'application/octet-stream',
      },
      body: bytes as unknown as BodyInit,
    }));
    if (res.status === 409 && ifRev !== undefined) {
      const summary = String(((await res.json().catch(() => ({}))) as { error_summary?: string }).error_summary ?? '');
      if (summary.includes('conflict')) throw new SyncConflictError();
    }
    if (!res.ok) throw new Error(t('Dropbox upload failed ({status})', { status: res.status }));
    return dbxMeta(await res.json() as DropboxMeta, bytes.length);
  };

  const canSyncSilently = async (): Promise<boolean> =>
    !!cachedToken(KIND) || !!(await getConnection(KIND))?.refreshToken;

  return { kind: KIND, head, get, put, canSyncSilently };
}
