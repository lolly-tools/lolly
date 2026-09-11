// SPDX-License-Identifier: MPL-2.0
/**
 * Mastodon send target (plans/129 WP5) - the `mastodon` driver: media + status
 * posts to ANY Mastodon (or API-compatible) instance. There is deliberately no
 * central client id: every Mastodon server offers dynamic app registration
 * (POST /api/v1/apps), so connecting registers a per-server, per-device client
 * on the spot - nobody's app-review queue, which is the whole fit with this
 * audience.
 *
 * The grant is the shared code+PKCE machinery (a server too old for PKCE
 * ignores the extra params harmlessly), through the popup leg on the web and
 * the system-browser loopback leg on desktop (WP4). Because the loopback
 * redirect's port differs per attempt, and Mastodon matches redirect URIs
 * exactly, each interactive connect registers a FRESH app for the leg it is
 * about to use - registrations are free and idle ones are inert.
 *
 * Custody: Mastodon access tokens are long-lived and there is no refresh
 * grant, so the token itself is what "stay connected" stores - in the
 * connection's config beside the server URL, under the same rules as every
 * credential (device-local, never in backups, wiped by Disconnect, revoked
 * best-effort server-side on disconnect).
 *
 * Web CORS: Mastodon's API answers CORS (browser apps are first-class);
 * desktop rides the CORS-free Tauri client via providerFetch.
 */

import { t } from '../i18n.ts';
import {
  codeGrant, loopbackVia, popupVia, providerFetch, type AuthorizeVia,
} from './provider-auth.ts';
import {
  cacheToken, cachedToken, getConnection, hasConnection, removeConnection, saveConnection,
} from './provider-connections.ts';
import { isTauriShell } from './instance-choice.ts';
import type { SendTarget } from './send-target.ts';

const KIND = 'mastodon';
const SCOPES = 'write:media write:statuses read:accounts';
/** Media uploads 202 while the server processes; poll this many times. */
const PROCESS_POLLS = 10;

/** A normalized https server origin, or null. */
export function parseServerUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(/^[a-z]+:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname.includes('.')) return null;
  return u.origin;
}

interface AppRegistration { client_id: string; client_secret: string }

async function registerApp(server: string, redirectUri: string, fetchFn: typeof fetch): Promise<AppRegistration> {
  const res = await fetchFn(`${server}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Lolly',
      redirect_uris: redirectUri,
      scopes: SCOPES,
      website: 'https://lolly.tools',
    }),
  });
  if (!res.ok) throw new Error(t('That server did not accept an app registration ({status})', { status: res.status }));
  const app = await res.json() as Partial<AppRegistration>;
  if (!app.client_id || !app.client_secret) throw new Error(t('That server did not return app credentials'));
  return app as AppRegistration;
}

/** Interactive connect from /profile: register, grant, identify, store. */
export async function connectMastodon(persist: boolean, rawServer: string): Promise<string> {
  const server = parseServerUrl(rawServer);
  if (!server) throw new Error(t('Enter your server like mastodon.social'));
  const via: AuthorizeVia = isTauriShell() ? await loopbackVia() : popupVia('lolly-mastodon-auth');
  const app = await registerApp(server, via.redirectUri, providerFetch);
  const set = await codeGrant({
    authorizeUrl: `${server}/oauth/authorize`,
    tokenUrl: `${server}/oauth/token`,
    clientId: app.client_id,
    clientSecret: app.client_secret,
    scopes: SCOPES,
  }, providerFetch, via);
  const who = await providerFetch(`${server}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${set.accessToken}` },
  });
  const acct = who.ok ? ((await who.json() as { acct?: string }).acct ?? '') : '';
  const account = acct ? `@${acct}@${new URL(server).host}` : new URL(server).host;
  // Mastodon tokens are long-lived with no refresh grant: the token IS the
  // connection. Session-only custody keeps it in the memory cache; persist
  // writes it into the config at rest.
  cacheToken(KIND, set.accessToken, Date.now() + 365 * 24 * 3600 * 1000);
  await saveConnection({
    kind: KIND,
    account,
    persist,
    config: { server, ...(persist ? { accessToken: set.accessToken } : {}) },
    scopes: SCOPES,
    connectedAt: new Date().toISOString(),
  });
  return account;
}

export async function disconnectMastodon(): Promise<void> {
  const conn = await getConnection(KIND);
  const token = cachedToken(KIND) ?? conn?.config?.accessToken;
  const server = conn?.config?.server;
  if (server && token) {
    try {
      // Best-effort: without the (per-connect, unstored) client credentials the
      // revoke endpoint may refuse; the local wipe below is the guarantee.
      await providerFetch(`${server}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      });
    } catch { /* courtesy only */ }
  }
  await removeConnection(KIND);
}

async function mastodonToken(): Promise<{ server: string; token: string }> {
  const conn = await getConnection(KIND);
  const server = conn?.config?.server;
  if (!server) throw new Error(t('Connect Mastodon in Profile first'));
  const token = cachedToken(KIND) ?? conn?.config?.accessToken;
  if (!token) throw new Error(t('Your Mastodon session ended - connect again in Profile'));
  return { server, token };
}

export function mastodonSendTarget(): SendTarget {
  return {
    kind: KIND,
    label: t('Mastodon'),
    formats: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mp3'],
    available: () => hasConnection(KIND),
    hint: t('Posts this file to your Mastodon account. Your sign-in stays on this device, and whether it is remembered between sessions is your choice in Profile.'),
    send: async ({ bytes, name, mime }) => {
      const { server, token } = await mastodonToken();
      const auth = { Authorization: `Bearer ${token}` };
      const form = new FormData();
      form.append('file', new Blob([bytes as BlobPart], { type: mime || 'application/octet-stream' }), name);
      form.append('description', name);
      const up = await providerFetch(`${server}/api/v2/media`, { method: 'POST', headers: auth, body: form });
      if (up.status === 401) throw new Error(t('Your Mastodon session ended - connect again in Profile'));
      if (up.status === 413 || up.status === 422) throw new Error(t('That file is larger than your Mastodon server accepts'));
      if (!up.ok) throw new Error(t('Mastodon upload failed ({status})', { status: up.status }));
      const media = await up.json() as { id: string; url?: string | null };
      // 202 = still processing (video); poll until the server has it.
      if (up.status === 202) {
        let ready = false;
        for (let i = 0; i < PROCESS_POLLS && !ready; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const poll = await providerFetch(`${server}/api/v1/media/${encodeURIComponent(media.id)}`, { headers: auth });
          ready = poll.status === 200;
        }
        if (!ready) throw new Error(t('Your Mastodon server is still processing that upload - try again shortly'));
      }
      const post = await providerFetch(`${server}/api/v1/statuses`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: name, media_ids: [media.id], visibility: 'public' }),
      });
      if (!post.ok) throw new Error(t('Mastodon post failed ({status})', { status: post.status }));
      const status = await post.json() as { url?: string };
      return { url: status.url, label: t('Posted to Mastodon') };
    },
  };
}
