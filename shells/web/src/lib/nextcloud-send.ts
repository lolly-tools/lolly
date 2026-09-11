// SPDX-License-Identifier: MPL-2.0
/**
 * Nextcloud / WebDAV send target (plans/129) - the `webdav` driver for the
 * user's OWN server: a Nextcloud (or ownCloud, or any plain WebDAV) instance
 * reached with a per-app password. No OAuth, no app registration, no Lolly
 * server: the user enters the server URL + username + app password in
 * /profile (device-local via provider-connections - never in a backup, wiped
 * on disconnect), and every send is one authenticated PUT.
 *
 * The sovereignty fit is the point: this is the provider for people who host
 * their own files, which is exactly Lolly's crowd. App passwords, not the
 * account password - Nextcloud: Settings → Security → Devices & sessions.
 *
 * REALITY NOTE, said in the UI: browsers require the SERVER's CORS blessing
 * for cross-origin WebDAV (Nextcloud does not send CORS headers by default),
 * and a hosted deploy's CSP cannot pre-list arbitrary servers - so on the
 * hosted web app this target shines with same-origin/reverse-proxied setups
 * and self-hosted deploys; the desktop shell (native fetch, no CORS) is the
 * everywhere-answer later (plans/129 WP4).
 */

import { t } from '../i18n.ts';
import {
  getConnection, saveConnection, removeConnection, hasConnection,
} from './provider-connections.ts';
import type { SendTarget } from './send-target.ts';
import type { SyncRemote, SnapshotMeta } from './sync-remote.ts';
import { metaFromHeaders } from './sync-remote.ts';

const KIND = 'webdav';

export interface WebdavConfig {
  /** The Nextcloud root, e.g. https://cloud.example.org (no trailing slash needed). */
  baseUrl: string;
  username: string;
  appPassword: string;
  /** Folder under the user's files, e.g. "Lolly" - created if missing. */
  folder?: string;
}

const basic = (c: WebdavConfig): string => `Basic ${btoa(`${c.username}:${c.appPassword}`)}`;

/** files DAV url for one path under the user's root. Exported for tests. */
export function davUrl(c: WebdavConfig, path: string): string {
  const base = c.baseUrl.replace(/\/+$/, '');
  const segs = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${base}/remote.php/dav/files/${encodeURIComponent(c.username)}/${segs}`;
}

async function config(): Promise<WebdavConfig | null> {
  const c = (await getConnection(KIND))?.config;
  if (!c?.baseUrl || !c.username || !c.appPassword) return null;
  return { baseUrl: c.baseUrl, username: c.username, appPassword: c.appPassword, folder: c.folder || '' };
}

export async function connectWebdav(cfg: WebdavConfig): Promise<void> {
  await saveConnection({
    kind: KIND,
    account: `${cfg.username} @ ${new URL(cfg.baseUrl).host}`,
    persist: true,
    config: { ...cfg, folder: cfg.folder ?? '' } as unknown as Record<string, string>,
    connectedAt: new Date().toISOString(),
  });
}

export async function disconnectWebdav(): Promise<void> {
  await removeConnection(KIND);
}

/** PROPFIND depth 0 on the target folder (root when none). */
export async function testWebdav(cfg: WebdavConfig, fetchFn: typeof fetch = fetch): Promise<{ ok: boolean; note: string }> {
  try {
    const res = await fetchFn(davUrl(cfg, cfg.folder ?? ''), {
      method: 'PROPFIND',
      headers: { Authorization: basic(cfg), Depth: '0' },
    });
    if (res.status === 401) return { ok: false, note: t('The server refused the sign-in (401) - check the username and app password') };
    if (res.status === 404 && cfg.folder) return { ok: true, note: t('Signed in; the folder will be created on first send') };
    return { ok: res.ok || res.status === 207, note: res.ok || res.status === 207 ? t('Connection works') : t('The server answered {status}', { status: res.status }) };
  } catch {
    return { ok: false, note: t('Could not reach the server - it must allow this origin (CORS), or use the desktop app') };
  }
}

async function ensureFolder(cfg: WebdavConfig, fetchFn: typeof fetch): Promise<void> {
  if (!cfg.folder) return;
  const res = await fetchFn(davUrl(cfg, cfg.folder), { method: 'MKCOL', headers: { Authorization: basic(cfg) } });
  // 201 created, 405 already exists - both fine; anything else surfaces at PUT.
  void res;
}

// ── The SendTarget ────────────────────────────────────────────────────────────

export function nextcloudSendTarget(): SendTarget {
  return {
    kind: KIND,
    label: t('Nextcloud / WebDAV'),
    available: () => hasConnection(KIND),
    hint: t('Uploads this file to your own Nextcloud or WebDAV server with the app password you saved in Profile. It stays on this device - there is no server between you and yours.'),
    send: async ({ bytes, name, format, mime }) => {
      const cfg = await config();
      if (!cfg) throw new Error(t('Set up your server in Profile first'));
      const filename = name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`;
      const path = cfg.folder ? `${cfg.folder}/${filename}` : filename;
      await ensureFolder(cfg, fetch);
      let res: Response;
      try {
        res = await fetch(davUrl(cfg, path), {
          method: 'PUT',
          headers: { Authorization: basic(cfg), 'Content-Type': mime || 'application/octet-stream' },
          body: bytes as unknown as BodyInit,
        });
      } catch {
        throw new Error(t('Could not reach the server - it must allow this origin (CORS), or use the desktop app'));
      }
      if (!res.ok) throw new Error(t('Server upload failed ({status})', { status: res.status }));
      const dir = cfg.folder ? `/${cfg.folder}` : '/';
      return {
        url: `${cfg.baseUrl.replace(/\/+$/, '')}/apps/files/files?dir=${encodeURIComponent(dir)}`,
        label: t('Saved to {path}', { path }),
      };
    },
  };
}

// ── The SyncRemote (plans/138 B1) ─────────────────────────────────────────────
// Device sync's two-way access over the SAME Basic-auth WebDAV the send target
// uses. The sender is PUT-only; sync adds HEAD (detect a newer snapshot cheaply)
// and GET (fetch it to apply). ONE fixed file under a `lolly-sync/` collection
// holds the whole-person snapshot, overwritten each push (last-write-wins).
//
// `rev` is the file's ETag (Last-Modified fallback) - WebDAV/Nextcloud return an
// ETag on GET/HEAD/PUT. REALITY the spike surfaces (documented for the server
// owner): the server's CORS must expose ETag or JS can't read the rev; Nextcloud
// sends no CORS headers by default, so this shines same-origin/reverse-proxied or
// on the desktop shell (native fetch, no CORS) - exactly like the send target.

const SYNC_REL = 'lolly-sync/snapshot.lolly';

/** Ancestor collections of a path, outermost first (drops the filename). */
function ancestorDirs(path: string): string[] {
  const segs = path.split('/').filter(Boolean);
  segs.pop();
  return segs.map((_, i) => segs.slice(0, i + 1).join('/'));
}

/** A WebDAV-backed SyncRemote over the user's connected server. `relPath` (under
 *  the user's chosen folder) defaults to the device-sync snapshot; the collab
 *  rendezvous (plans/138 Tier C) points it at signalling paths. `fetchFn` is
 *  injectable for tests; production uses the global fetch. */
export function webdavSyncRemote(fetchFn: typeof fetch = fetch, relPath: string = SYNC_REL): SyncRemote {
  const requireCfg = async (): Promise<{ cfg: WebdavConfig; path: string }> => {
    const cfg = await config();
    if (!cfg) throw new Error(t('Set up your server in Profile first'));
    return { cfg, path: [cfg.folder, relPath].filter(Boolean).join('/') };
  };
  const reach = t('Could not reach the server - it must allow this origin (CORS), or use the desktop app');

  const head = async (): Promise<SnapshotMeta | null> => {
    const { cfg, path } = await requireCfg();
    let res: Response;
    try { res = await fetchFn(davUrl(cfg, path), { method: 'HEAD', headers: { Authorization: basic(cfg) } }); }
    catch { throw new Error(reach); }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(t('The server answered {status}', { status: res.status }));
    return metaFromHeaders(res.headers, 0);
  };

  const get = async (): Promise<{ bytes: Uint8Array; meta: SnapshotMeta } | null> => {
    const { cfg, path } = await requireCfg();
    let res: Response;
    try { res = await fetchFn(davUrl(cfg, path), { method: 'GET', headers: { Authorization: basic(cfg) } }); }
    catch { throw new Error(reach); }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(t('The server answered {status}', { status: res.status }));
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, meta: metaFromHeaders(res.headers, bytes.length) };
  };

  const put = async (bytes: Uint8Array): Promise<SnapshotMeta> => {
    const { cfg, path } = await requireCfg();
    // MKCOL each ancestor (201 created / 405 exists both fine; errors surface at PUT).
    for (const dir of ancestorDirs(path)) {
      try { await fetchFn(davUrl(cfg, dir), { method: 'MKCOL', headers: { Authorization: basic(cfg) } }); }
      catch { /* best-effort; the PUT below is the real check */ }
    }
    let res: Response;
    try {
      res = await fetchFn(davUrl(cfg, path), {
        method: 'PUT',
        headers: { Authorization: basic(cfg), 'Content-Type': 'application/octet-stream' },
        body: bytes as unknown as BodyInit,
      });
    } catch { throw new Error(reach); }
    if (!res.ok) throw new Error(t('Server upload failed ({status})', { status: res.status }));
    // Some servers don't CORS-expose ETag on the PUT response; a follow-up HEAD
    // recovers the rev so another device's newer-detection stays correct.
    if (!metaFromHeaders(res.headers, 0).rev) { const h = await head(); if (h?.rev) return h; }
    return metaFromHeaders(res.headers, bytes.length);
  };

  return { kind: KIND, head, get, put };
}
