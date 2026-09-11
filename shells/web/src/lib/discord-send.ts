// SPDX-License-Identifier: MPL-2.0
/**
 * Discord send target (plans/129 WP5) - the `discord` driver, webhook-based:
 * zero OAuth, zero app registration. The user pastes a channel webhook URL
 * (Channel settings → Integrations → Webhooks) in /profile; a send POSTs the
 * export as a real file attachment to that channel.
 *
 * Custody: the webhook URL is a bearer capability (anyone holding it can post
 * to the channel) - it is stored exactly like the S3 keys: device-local,
 * never in backups, wiped by Disconnect. The /profile note says as much.
 *
 * Web CORS: discord.com answers CORS on webhook endpoints (they are built for
 * browser use); desktop rides the CORS-free Tauri client via providerFetch.
 * Size limits are the server's own (boost-dependent) - a refusal maps to an
 * honest message rather than a hardcoded cap that would drift.
 */

import { t } from '../i18n.ts';
import { providerFetch } from './provider-auth.ts';
import { getConnection, hasConnection, removeConnection, saveConnection } from './provider-connections.ts';
import type { SendTarget } from './send-target.ts';

const KIND = 'discord';

/** A canonical webhook URL, or null when the paste is not one. */
export function parseWebhookUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (!/^(?:[a-z]+\.)?discord(?:app)?\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+$/);
  return m ? `${u.origin}${u.pathname}` : null;
}

/** GET the webhook object (no auth beyond the URL itself) - the connect test. */
export async function testDiscord(rawUrl: string, fetchFn: typeof fetch = providerFetch): Promise<{ ok: boolean; note: string; name?: string }> {
  const url = parseWebhookUrl(rawUrl);
  if (!url) return { ok: false, note: t('That does not look like a Discord webhook URL') };
  try {
    const res = await fetchFn(url);
    if (!res.ok) return { ok: false, note: t('Discord did not accept that webhook ({status})', { status: res.status }) };
    const hook = await res.json() as { name?: string };
    return { ok: true, note: t('Connected'), name: hook.name };
  } catch {
    return { ok: false, note: t('Could not reach Discord - check the URL and your connection') };
  }
}

export async function connectDiscord(rawUrl: string, name?: string): Promise<void> {
  const url = parseWebhookUrl(rawUrl);
  if (!url) throw new Error(t('That does not look like a Discord webhook URL'));
  await saveConnection({
    kind: KIND,
    account: name || t('Discord webhook'),
    persist: true,
    config: { url },
    connectedAt: new Date().toISOString(),
  });
}

export async function disconnectDiscord(): Promise<void> {
  await removeConnection(KIND);
}

export function discordSendTarget(): SendTarget {
  return {
    kind: KIND,
    label: t('Discord'),
    // No formats list: webhooks take any file the channel's size limit allows.
    available: () => hasConnection(KIND),
    hint: t('Posts this file into the Discord channel behind your webhook. The webhook URL stays on this device; anyone holding such a URL can post to that channel, so treat it like a key.'),
    send: async ({ bytes, name, format, mime }) => {
      const conn = await getConnection(KIND);
      const url = conn?.config?.url;
      if (!url) throw new Error(t('Connect a Discord webhook in Profile first'));
      const filename = name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`;
      const form = new FormData();
      form.append('payload_json', JSON.stringify({ attachments: [{ id: 0, filename }] }));
      form.append('files[0]', new Blob([bytes as BlobPart], { type: mime || 'application/octet-stream' }), filename);
      const res = await providerFetch(`${url}?wait=true`, { method: 'POST', body: form });
      if (res.status === 413) throw new Error(t('That file is larger than this Discord server accepts'));
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(t('Discord refused the post ({status})', { status: res.status }) + (body ? `: ${body.slice(0, 160)}` : ''));
      }
      const msg = await res.json() as { attachments?: Array<{ url?: string }> };
      return {
        url: msg.attachments?.[0]?.url,
        label: t('Posted to Discord ({name})', { name: conn.account }),
      };
    },
  };
}
