// SPDX-License-Identifier: MPL-2.0
/**
 * Bluesky send target (plans/129 WP5) - the `bluesky` driver: image posts over
 * atproto with an APP PASSWORD (Settings → App passwords), no OAuth ceremony
 * and nobody's app-review queue. The credential trio (service URL, handle, app
 * password) is entered in /profile and stored like the WebDAV app password:
 * device-local, never in backups, wiped by Disconnect.
 *
 * A send is three XRPC calls: createSession (mint short-lived JWTs from the
 * app password - per send, deliberately: no JWT custody), uploadBlob (the
 * image bytes), createRecord (an app.bsky.feed.post embedding the blob). The
 * post text is the export's name; the alt text too, until a caption field
 * exists. Images only, and atproto caps an image blob at ~1 MB - checked
 * before upload so the failure is an honest sentence, not a server error.
 *
 * Web CORS: bsky.social's XRPC answers CORS (browser clients are first-class
 * in atproto); desktop rides the CORS-free Tauri client via providerFetch.
 */

import { t } from '../i18n.ts';
import { providerFetch } from './provider-auth.ts';
import { getConnection, hasConnection, removeConnection, saveConnection } from './provider-connections.ts';
import type { SendTarget } from './send-target.ts';

const KIND = 'bluesky';
/** atproto's image-blob ceiling (1,000,000 bytes on bsky.social). */
export const BLUESKY_IMAGE_MAX = 1_000_000;

export interface BlueskyConfig {
  service: string;
  identifier: string;
  appPassword: string;
}

interface Session { accessJwt: string; did: string; handle: string }

const xrpc = (service: string, method: string): string =>
  `${service.replace(/\/+$/, '')}/xrpc/${method}`;

async function createSession(cfg: BlueskyConfig, fetchFn: typeof fetch): Promise<Session> {
  const res = await fetchFn(xrpc(cfg.service, 'com.atproto.server.createSession'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: cfg.identifier, password: cfg.appPassword }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error(t('Bluesky rejected the handle or app password'));
    throw new Error(t('Bluesky sign-in failed ({status})', { status: res.status }));
  }
  return await res.json() as Session;
}

/** The connect test: mint a session, report the handle. */
export async function testBluesky(cfg: BlueskyConfig, fetchFn: typeof fetch = providerFetch): Promise<{ ok: boolean; note: string; handle?: string }> {
  try {
    const s = await createSession(cfg, fetchFn);
    return { ok: true, note: t('Connected as @{handle}', { handle: s.handle }), handle: s.handle };
  } catch (e) {
    return { ok: false, note: String((e as Error).message) };
  }
}

export async function connectBluesky(cfg: BlueskyConfig, handle?: string): Promise<void> {
  await saveConnection({
    kind: KIND,
    account: `@${handle || cfg.identifier}`,
    persist: true,
    config: { ...cfg } as unknown as Record<string, string>,
    connectedAt: new Date().toISOString(),
  });
}

export async function disconnectBluesky(): Promise<void> {
  await removeConnection(KIND);
}

export function blueskySendTarget(): SendTarget {
  return {
    kind: KIND,
    label: t('Bluesky'),
    formats: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    available: () => hasConnection(KIND),
    hint: t('Posts this image to your Bluesky feed. Your app password stays on this device - revoke it any time in Bluesky settings.'),
    send: async ({ bytes, name, mime }) => {
      const conn = await getConnection(KIND);
      const cfg = conn?.config as unknown as BlueskyConfig | undefined;
      if (!cfg?.service || !cfg.identifier || !cfg.appPassword) {
        throw new Error(t('Connect Bluesky in Profile first'));
      }
      if (bytes.length > BLUESKY_IMAGE_MAX) {
        throw new Error(t('Bluesky caps images at about 1 MB - export a smaller size and try again'));
      }
      const session = await createSession(cfg, providerFetch);
      const auth = { Authorization: `Bearer ${session.accessJwt}` };
      const up = await providerFetch(xrpc(cfg.service, 'com.atproto.repo.uploadBlob'), {
        method: 'POST',
        headers: { ...auth, 'Content-Type': mime || 'image/png' },
        body: bytes as unknown as BodyInit,
      });
      if (!up.ok) throw new Error(t('Bluesky upload failed ({status})', { status: up.status }));
      const { blob } = await up.json() as { blob: unknown };
      const post = await providerFetch(xrpc(cfg.service, 'com.atproto.repo.createRecord'), {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: name,
            createdAt: new Date().toISOString(),
            embed: { $type: 'app.bsky.embed.images', images: [{ image: blob, alt: name }] },
          },
        }),
      });
      if (!post.ok) throw new Error(t('Bluesky post failed ({status})', { status: post.status }));
      const { uri } = await post.json() as { uri?: string };
      const rkey = uri?.split('/').pop();
      return {
        url: rkey ? `https://bsky.app/profile/${encodeURIComponent(session.handle)}/post/${encodeURIComponent(rkey)}` : undefined,
        label: t('Posted to Bluesky as @{handle}', { handle: session.handle }),
      };
    },
  };
}
