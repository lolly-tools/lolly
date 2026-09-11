// SPDX-License-Identifier: MPL-2.0
/**
 * Send to Google Drive - the individual, fully client-side path that lands a
 * Lolly export in the user's own Drive with the one thing Google's web
 * uploader refuses to set: the stored mimeType.
 *
 * Why this exists (measured in a live Drive, 2026-08-18): Drive re-types every
 * web upload SERVER-side from its own extension table. A normal `.emf` upload,
 * a `.wmf` rename and even a synthetic drop whose File carried
 * `type: application/x-msmetafile` all land as a generic blob with no
 * "Open with Google Drawings" route. Only Drive API metadata sets the stored
 * type - which is also why the classic Apps Script fix works. So the EMF →
 * Google Drawings → Slides journey needs exactly one authenticated
 * `files.create`, and nothing less.
 *
 * Privacy posture, deliberately minimal:
 *   - Scope is `drive.file`: Lolly can see and touch ONLY files it created,
 *     never the rest of the Drive.
 *   - The OAuth token lives in memory for the session and is never persisted.
 *   - No Google script is loaded. The flow is a plain popup to
 *     accounts.google.com (a top-level navigation, outside our CSP) returning
 *     to the same-origin static page public/oauth-return.html, which
 *     postMessages the token fragment back and closes. The shell keeps zero
 *     third-party JS. If Google ever retires the implicit `response_type=token`
 *     grant for web clients, the swap point is requestToken() below (the GIS
 *     token client would replace it, at the cost of loading their script).
 *   - The only fetch target is https://www.googleapis.com (connect-src).
 *
 * The feature is DORMANT unless a Google OAuth client id is configured
 * (VITE_GOOGLE_CLIENT_ID at build time, or setDriveClientId at runtime): no
 * client id, no UI, no requests - a plain build stays byte-identical in
 * behaviour. The client id is public by design (implicit/public OAuth flows
 * have no secret); each deploy origin must be registered on the client with
 * redirect URI `<origin>/oauth-return.html`. The TAURI shells gate on the
 * separate Desktop-type client instead (VITE_GOOGLE_DESKTOP_CLIENT_ID +
 * VITE_GOOGLE_DESKTOP_CLIENT_SECRET, or setDriveDesktopClient at runtime) -
 * see the desktop-client section below for why that pair is safe to ship.
 *
 * Surfaced through the PROVIDER-AGNOSTIC send-target seam (lib/send-target.ts):
 * this module is the `gdrive` driver, and googleDriveSendTarget() is what
 * send-targets-builtin.ts registers. Sibling providers (dropbox, o365, … -
 * the lolly-work provider vocabulary) follow the same shape: their own OAuth
 * + upload here-alike module, one registered SendTarget each.
 */

import type { SendTarget } from './send-target.ts';
import type { SyncRemote, SnapshotMeta } from './sync-remote.ts';
import { codeGrant, loopbackVia, popupOAuth, refreshGrant, type TokenSet } from './provider-auth.ts';
import {
  cachedToken, cacheToken, dropToken, getConnection, removeConnection, saveConnection,
} from './provider-connections.ts';
import { instanceFetch } from './instance.ts';
import { isTauriShell } from './instance-choice.ts';
import { t } from '../i18n.ts';

export interface DriveUploadResult {
  id: string;
  mimeType: string;
  webViewLink?: string;
}

export interface DriveSendOutcome {
  file: DriveUploadResult;
  /** True when Drive converted the upload into a native Google Drawing. */
  converted: boolean;
}

const KIND = 'gdrive';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ABOUT_URL = 'https://www.googleapis.com/drive/v3/about?fields=user';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType,webViewLink';
const METAFILE_MIME = 'application/x-msmetafile';
const DRAWING_MIME = 'application/vnd.google-apps.drawing';

let clientIdOverride: string | null = null;

/** Runtime override (an instance config or a test); null restores the env value. */
export function setDriveClientId(id: string | null): void { clientIdOverride = id; }

export function driveClientId(): string {
  if (clientIdOverride !== null) return clientIdOverride;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_GOOGLE_CLIENT_ID || '';
}

/** Whether the Send-to-Drive affordance should exist at all (web shells). */
export function driveAvailable(): boolean { return !!driveClientId(); }

// ─── Desktop client (plans/129 WP4) ──────────────────────────────────────────
//
// The Tauri shells run sign-in in the SYSTEM browser with a loopback return
// (provider-auth's loopbackVia + src-tauri/src/oauth.rs): Google refuses OAuth
// in embedded webviews, and for managed Workspace accounts the default browser
// already holds the SSO session - so desktop sign-in is an account-chooser
// click, not a password. A Google "Desktop app" client uses code+PKCE and
// grants REFRESH tokens (the implicit web grant cannot), so desktop users can
// opt into staying connected. Google issues Desktop clients a pseudo-secret it
// documents as NON-confidential for installed apps; it ships in config exactly
// like the client id. Both are runtime-overridable so a brand instance or
// `.lolly` pack can supply an org-owned client - a Workspace-internal client
// id skips the unverified-app interstitial entirely.

let desktopClientOverride: { id: string; secret: string } | null = null;

/** Runtime override (an instance config or a test); null restores env values. */
export function setDriveDesktopClient(id: string | null, secret = ''): void {
  desktopClientOverride = id === null ? null : { id, secret };
}

export function driveDesktopClientId(): string {
  if (desktopClientOverride !== null) return desktopClientOverride.id;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_GOOGLE_DESKTOP_CLIENT_ID || '';
}

function driveDesktopClientSecret(): string {
  if (desktopClientOverride !== null) return desktopClientOverride.secret;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_GOOGLE_DESKTOP_CLIENT_SECRET || '';
}

/** Whether the desktop Send-to-Drive affordance exists (Tauri shells). */
export function driveDesktopAvailable(): boolean { return !!driveDesktopClientId(); }

/** googleapis fetches ride the CORS-free Tauri HTTP client on desktop. */
const driveFetch: typeof fetch = (input, init) =>
  isTauriShell() ? instanceFetch(String(input), init) : fetch(input, init);

const desktopGrantCfg = () => ({
  authorizeUrl: AUTH_URL,
  tokenUrl: TOKEN_URL,
  clientId: driveDesktopClientId(),
  clientSecret: driveDesktopClientSecret(),
  scopes: SCOPE,
  // offline = a refresh token; consent forces Google to re-issue one on a
  // repeat grant (it otherwise omits it); whether it PERSISTS is the user's
  // custody choice, same as every other provider.
  extraAuthParams: { access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true' },
});

/** A valid desktop access token: cache → refresh (stored connection) →
 *  interactive system-browser sign-in. The dropbox custody pattern verbatim. */
async function desktopToken(): Promise<string> {
  const held = cachedToken(KIND);
  if (held) return held;
  const conn = await getConnection(KIND);
  if (conn?.refreshToken) {
    try {
      const set = await refreshGrant(
        { tokenUrl: TOKEN_URL, clientId: driveDesktopClientId(), clientSecret: driveDesktopClientSecret() },
        conn.refreshToken, driveFetch,
      );
      cacheToken(KIND, set.accessToken, set.expiresAt);
      return set.accessToken;
    } catch { /* refresh revoked/expired - fall through to interactive */ }
  }
  const set = await codeGrant(desktopGrantCfg(), driveFetch, await loopbackVia());
  cacheToken(KIND, set.accessToken, set.expiresAt);
  if (conn) await saveConnection({ ...conn, ...(conn.persist && set.refreshToken ? { refreshToken: set.refreshToken } : {}) });
  return set.accessToken;
}

/** Interactive connect from /profile (desktop): grant, identity, custody. */
export async function connectDriveDesktop(persist: boolean): Promise<string> {
  const set: TokenSet = await codeGrant(desktopGrantCfg(), driveFetch, await loopbackVia());
  cacheToken(KIND, set.accessToken, set.expiresAt);
  let account = t('Google account');
  try {
    const res = await driveFetch(ABOUT_URL, { headers: { Authorization: `Bearer ${set.accessToken}` } });
    if (res.ok) {
      const about = await res.json() as { user?: { emailAddress?: string; displayName?: string } };
      account = about.user?.emailAddress || about.user?.displayName || account;
    }
  } catch { /* identity is cosmetic; the connection stands */ }
  await saveConnection({
    kind: KIND,
    account,
    persist,
    ...(persist && set.refreshToken ? { refreshToken: set.refreshToken } : {}),
    scopes: SCOPE,
    connectedAt: new Date().toISOString(),
  });
  return account;
}

/** Disconnect (desktop): best-effort Google-side revocation, then wipe. */
export async function disconnectDriveDesktop(): Promise<void> {
  const conn = await getConnection(KIND);
  const tok = cachedToken(KIND) ?? conn?.refreshToken;
  if (tok) {
    try {
      await driveFetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok)}`, { method: 'POST' });
    } catch { /* revocation is a courtesy; the wipe below is the guarantee */ }
  }
  await removeConnection(KIND);
}

// ─── OAuth (implicit token grant via popup + same-origin return page) ────────

/** The auth URL for the popup. Pure, for tests. */
export function buildAuthUrl(clientId: string, state: string, redirectUri: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: SCOPE,
    state,
    // A fresh grant each time the token expired keeps the session tokenless at
    // rest; include_granted_scopes keeps re-consent to a single click.
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${p}`;
}

/** Parse the return page's `#access_token=…` fragment. Pure, for tests.
 *  Throws on an OAuth error, a state mismatch, or a missing token. */
export function parseOAuthReturn(hash: string, expectedState: string): { token: string; expiresInS: number } {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const err = p.get('error');
  if (err) throw new Error(`Google sign-in failed: ${err}`);
  if (p.get('state') !== expectedState) throw new Error('Google sign-in failed: state mismatch');
  const token = p.get('access_token');
  if (!token) throw new Error('Google sign-in failed: no token returned');
  const expiresInS = Math.max(60, Number(p.get('expires_in')) || 3600);
  return { token, expiresInS };
}

let cached: { token: string; expiresAt: number } | null = null;

/** Drop the in-memory token (a 401 from the API, or a test). */
export function resetDriveToken(): void { cached = null; dropToken(KIND); }

/** Seed the in-memory token so tests can exercise the upload path without the
 *  interactive popup (same spirit as the runtime's exported-mutable HOOK_BUDGET_MS). */
export function seedDriveTokenForTests(token: string, ttlMs = 60_000): void {
  cached = { token, expiresAt: Date.now() + ttlMs };
}

async function requestToken(): Promise<string> {
  const clientId = driveClientId();
  if (!clientId) throw new Error('Google Drive is not configured on this build');
  const state = crypto.getRandomValues(new Uint32Array(4)).join('-');
  const redirectUri = `${location.origin}/oauth-return.html`;
  // The popup + both return channels (opener and the isolation-proof
  // BroadcastChannel) live in lib/provider-auth.ts now - the shared machinery
  // every send-target driver rides (plans/129). This driver keeps its own
  // implicit token grant: Google web clients demand a secret for code
  // exchange, so PKCE-without-secret is not on the table here.
  const ret = await popupOAuth(buildAuthUrl(clientId, state, redirectUri), 'lolly-gdrive-auth');
  const { token, expiresInS } = parseOAuthReturn(ret.hash, state);
  // Refresh a minute early so an upload never starts on a dying token.
  cached = { token, expiresAt: Date.now() + (expiresInS - 60) * 1000 };
  return token;
}

async function driveToken(): Promise<string> {
  // Desktop: code+PKCE via the system browser (WP4), custody in
  // provider-connections. Web: the implicit popup grant, session-only.
  if (isTauriShell()) return desktopToken();
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  cached = null;
  return requestToken();
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/** RFC 2387 multipart/related body for uploadType=multipart. Pure, for tests. */
export function buildMultipart(metadata: object, contentType: string, bytes: Uint8Array, boundary: string): Uint8Array {
  const te = new TextEncoder();
  const head = te.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`);
  const tail = te.encode(`\r\n--${boundary}--\r\n`);
  const out = new Uint8Array(head.length + bytes.length + tail.length);
  out.set(head, 0); out.set(bytes, head.length); out.set(tail, head.length + bytes.length);
  return out;
}

async function driveCreate(metadata: object, contentType: string, bytes: Uint8Array,
                           fetchFn: typeof fetch = driveFetch): Promise<DriveUploadResult> {
  const boundary = `lolly-${crypto.getRandomValues(new Uint32Array(2)).join('')}`;
  const doPost = async (token: string) => fetchFn(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: buildMultipart(metadata, contentType, bytes, boundary) as unknown as BodyInit,
  });
  let res = await doPost(await driveToken());
  if (res.status === 401) {           // expired/revoked mid-session: one fresh grant
    resetDriveToken();
    res = await doPost(await driveToken());
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive upload failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return await res.json() as DriveUploadResult;
}

/**
 * Send EMF bytes to Drive so they open in Google Drawings. Tries the straight
 * conversion first - the file lands AS a native Drawing, one copy-paste from
 * Slides. If Drive refuses the import (a metafile its converter can't read),
 * falls back to a plain file typed application/x-msmetafile, which keeps the
 * manual "Open with → Google Drawings" route.
 */
export async function sendEmfToDrive(bytes: Uint8Array, baseName: string,
                                     fetchFn: typeof fetch = fetch): Promise<DriveSendOutcome> {
  const name = baseName.replace(/\.emf$/i, '');
  try {
    const file = await driveCreate({ name, mimeType: DRAWING_MIME }, METAFILE_MIME, bytes, fetchFn);
    if (file.mimeType === DRAWING_MIME) return { file, converted: true };
    return { file, converted: false };
  } catch (e) {
    // Conversion refusals are 4xx with an import error body; auth problems and
    // popup cancellations must NOT silently degrade to the fallback.
    if (!/Drive upload failed \(4\d\d\)/.test(String((e as Error).message))) throw e;
  }
  const file = await driveCreate({ name: `${name}.emf`, mimeType: METAFILE_MIME }, METAFILE_MIME, bytes, fetchFn);
  return { file, converted: false };
}

// ─── The `gdrive` SendTarget (lib/send-target.ts) ────────────────────────────

/** The Google Drive destination the built-ins registration installs. EVERY
 *  export format Lolly makes is welcome (plans/129 - "drive can take all media
 *  made by lolly"); EMF keeps its special journey, converting into a native
 *  Google Drawing for the Slides workflow. On the Tauri shells (WP4) the
 *  sign-in runs in the SYSTEM browser via the loopback leg and needs the
 *  Desktop-type client configured; on the web it is the popup grant. */
export function googleDriveSendTarget(): SendTarget {
  return {
    kind: 'gdrive',
    label: t('Google Drive'),
    available: () => (isTauriShell() ? driveDesktopAvailable() : driveAvailable()),
    actionLabel: () => t('Send to Google Drive'),
    hint: t('Uploads this file to your Google Drive. Lolly can only see files it created (drive.file scope), and the sign-in token is kept in memory for this session only. An EMF lands as a Google Drawing, ready for Slides.'),
    send: async ({ bytes, name, format, mime }) => {
      if (format === 'emf') {
        const out = await sendEmfToDrive(bytes, name);
        return {
          url: out.file.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(out.file.id)}/view`,
          label: out.converted ? t('Open in Google Drawings') : t('Open in Drive, then Open with → Google Drawings'),
        };
      }
      const filename = name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`;
      const file = await driveCreate({ name: filename, mimeType: mime || 'application/octet-stream' }, mime || 'application/octet-stream', bytes);
      return {
        url: file.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
        label: t('Open in Drive'),
      };
    },
  };
}

// ── The SyncRemote (plans/138 B1) ─────────────────────────────────────────────
// Device sync's two-way access reusing the SAME drive.file OAuth the send target
// uses - no extra scope. drive.file can only see files THIS app created, so the
// snapshot is a single well-known-named file the app finds again with files.list
// (which, under drive.file, returns only the app's own files). `rev` is the file's
// headRevisionId (changes on every content update). No fixed path exists under
// drive.file, hence find-by-name then create-or-update.
//
// WEB REALITY: the web Drive token is session-only (implicit grant, in memory), so
// canSyncSilently() is true only once the user has signed in this session - the
// AUTO paths skip Drive until then, and never pop a sign-in outside a gesture. The
// desktop shell holds a refresh token, so it syncs silently like the others.

const DRIVE_SYNC_NAME = 'lolly-sync.lolly';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const SYNC_FIELDS = 'id,headRevisionId,modifiedTime,size';

interface DriveSyncFile { id: string; headRevisionId?: string; modifiedTime?: string; size?: string }

const driveMeta = (f: DriveSyncFile, fallbackSize: number): SnapshotMeta => ({
  rev: f.headRevisionId ?? '',
  updatedAt: f.modifiedTime ?? new Date().toISOString(),
  size: Number(f.size) || fallbackSize,
});

/** A Google-Drive-backed SyncRemote over the app's own drive.file files. `fileName`
 *  defaults to the device-sync file; the collab rendezvous (plans/138 Tier C) points
 *  it at signalling files. `fetchFn` is injectable for tests; production rides driveFetch. */
export function driveSyncRemote(fetchFn: typeof fetch = driveFetch, fileName: string = DRIVE_SYNC_NAME): SyncRemote {
  const auth = async (): Promise<Record<string, string>> => ({ Authorization: `Bearer ${await driveToken()}` });

  const findFile = async (): Promise<DriveSyncFile | null> => {
    const q = encodeURIComponent(`name='${fileName}' and trashed=false`);
    const url = `${DRIVE_FILES}?q=${q}&spaces=drive&fields=${encodeURIComponent(`files(${SYNC_FIELDS})`)}`;
    const res = await fetchFn(url, { headers: await auth() });
    if (!res.ok) throw new Error(t('Drive answered {status}', { status: res.status }));
    const body = await res.json() as { files?: DriveSyncFile[] };
    return body.files?.[0] ?? null;
  };

  const head = async (): Promise<SnapshotMeta | null> => {
    const f = await findFile();
    return f ? driveMeta(f, 0) : null;
  };

  const get = async (): Promise<{ bytes: Uint8Array; meta: SnapshotMeta } | null> => {
    const f = await findFile();
    if (!f) return null;
    const res = await fetchFn(`${DRIVE_FILES}/${encodeURIComponent(f.id)}?alt=media`, { headers: await auth() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(t('Drive answered {status}', { status: res.status }));
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, meta: driveMeta(f, bytes.length) };
  };

  const put = async (bytes: Uint8Array): Promise<SnapshotMeta> => {
    const existing = await findFile();
    const fields = encodeURIComponent(SYNC_FIELDS);
    let res: Response;
    if (existing) {
      // Update the existing file's content (uploadType=media, PATCH).
      res = await fetchFn(`${DRIVE_UPLOAD}/${encodeURIComponent(existing.id)}?uploadType=media&fields=${fields}`, {
        method: 'PATCH',
        headers: { ...(await auth()), 'Content-Type': 'application/octet-stream' },
        body: bytes as unknown as BodyInit,
      });
    } else {
      // Create it (multipart: the name metadata + the bytes).
      const boundary = `lolly-sync-${crypto.getRandomValues(new Uint32Array(2)).join('')}`;
      res = await fetchFn(`${DRIVE_UPLOAD}?uploadType=multipart&fields=${fields}`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: buildMultipart({ name: fileName, mimeType: 'application/octet-stream' }, 'application/octet-stream', bytes, boundary) as unknown as BodyInit,
      });
    }
    if (!res.ok) throw new Error(t('Drive upload failed ({status})', { status: res.status }));
    return driveMeta(await res.json() as DriveSyncFile, bytes.length);
  };

  const canSyncSilently = async (): Promise<boolean> => {
    if (isTauriShell()) return !!cachedToken(KIND) || !!(await getConnection(KIND))?.refreshToken;
    return !!(cached && cached.expiresAt > Date.now());   // web: only after a session sign-in
  };

  return { kind: KIND, head, get, put, canSyncSilently };
}
