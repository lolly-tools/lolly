// SPDX-License-Identifier: MPL-2.0
/**
 * LinkedIn send target (plans/129 WP5, built 2026-09-02) - the `linkedin`
 * driver: an image or document post to the signed-in member's OWN feed.
 *
 * DESKTOP ONLY, and the reason is worth stating plainly rather than hiding
 * behind a gate. LinkedIn's token endpoint REQUIRES a client_secret for the
 * authorization-code exchange, and it offers PKCE to partner applications
 * only - a normal app that sends a code_verifier is refused. So there is no
 * public-client shape available here: a browser page carrying the secret would
 * publish it to everyone who opens the site, and api.linkedin.com answers no
 * CORS to a browser anyway. Both problems disappear in the Tauri shells, where
 * the secret sits in a binary the org distributes and requests go through the
 * CORS-free Tauri HTTP client. Hence `isTauriShell()` on the gate, no web row,
 * and no LinkedIn host in the web app's Content-Security-Policy.
 *
 * That secret is still a secret LinkedIn treats as confidential, so the
 * registration behind a shipped desktop build should be one an ORG owns and
 * accepts as an installed-app credential (rotate it if a binary leaks); the
 * hosted lolly.tools build ships none. Config: VITE_LINKEDIN_CLIENT_ID +
 * VITE_LINKEDIN_CLIENT_SECRET at build time, or setLinkedInClient() at runtime
 * for a brand instance / `.lolly` pack. No pair → no row, no button (the
 * dormant rule).
 *
 * REDIRECT: LinkedIn matches redirect URLs exactly - host, port AND path, with
 * no port wildcard - so the loopback leg cannot take an ephemeral port. It asks
 * for one of LINKEDIN_LOOPBACK_PORTS below, and the setup guide tells the
 * deploy to register all three as `http://localhost:<port>/oauth-return`. Three
 * because a port can be busy; more than three is a longer registration list for
 * a case that has never happened.
 *
 * CUSTODY, the Mastodon shape: LinkedIn access tokens last 60 days and
 * programmatic refresh tokens are partner-only, so the token IS the connection.
 * Session-only keeps it in the memory cache; "stay connected" writes it into
 * the connection config at rest (device-local, never in backups, wiped by
 * Disconnect, revoked best-effort server-side). When 60 days pass, the honest
 * outcome is "connect again in Profile" - there is nothing to refresh.
 *
 * A POST IS PUBLIC AND UNDER THE MEMBER'S OWN NAME. The hint says so.
 */

import { t } from '../i18n.ts';
import { isTauriShell } from './instance-choice.ts';
import { codeGrant, loopbackVia, providerFetch, type AuthorizeVia } from './provider-auth.ts';
import {
  cacheToken, cachedToken, getConnection, hasConnection, removeConnection, saveConnection,
} from './provider-connections.ts';
import type { SendTarget } from './send-target.ts';

const KIND = 'linkedin';
const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const REVOKE_URL = 'https://www.linkedin.com/oauth/v2/revoke';
const API = 'https://api.linkedin.com';
const SCOPES = 'openid profile w_member_social';

/** Every versioned REST call carries this. One constant, so a version bump is
 *  one edit - LinkedIn dates its API and retires versions on a schedule. */
export const LINKEDIN_VERSION = '202608';

/** The loopback ports the desktop leg may bind, in order. Each one must be
 *  registered on the LinkedIn app as `http://localhost:<port>/oauth-return`. */
export const LINKEDIN_LOOPBACK_PORTS = [47811, 47812, 47813];

/** LinkedIn's document ceiling: 100 MB (and 300 pages, which is not cheap to
 *  count here - the byte cap is the one this driver can check honestly). */
export const LINKEDIN_DOCUMENT_MAX = 100 * 1024 * 1024;

/** Image posts: JPG, GIF and PNG are the formats LinkedIn accepts. */
const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'gif'] as const;
/** Document posts: PDF and the Office formats Lolly exports. */
const DOCUMENT_FORMATS = ['pdf', 'pptx', 'docx'] as const;

let clientOverride: { id: string; secret: string } | null = null;

/** Runtime override (a brand instance, a `.lolly` pack, or a test); null
 *  restores the env values. */
export function setLinkedInClient(id: string | null, secret = ''): void {
  clientOverride = id === null ? null : { id, secret };
}

export function linkedInClientId(): string {
  if (clientOverride !== null) return clientOverride.id;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_LINKEDIN_CLIENT_ID || '';
}

function linkedInClientSecret(): string {
  if (clientOverride !== null) return clientOverride.secret;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_LINKEDIN_CLIENT_SECRET || '';
}

/** Both halves or nothing: the token exchange fails without the secret, so an
 *  id on its own would offer a Connect button that cannot finish. */
export function linkedInAvailable(): boolean {
  return !!linkedInClientId() && !!linkedInClientSecret();
}

// ── Errors, in sentences a person can act on ─────────────────────────────────

function linkedInError(status: number): Error {
  if (status === 401) return new Error(t('Your LinkedIn session ended - connect again in Profile'));
  if (status === 403) {
    return new Error(t('LinkedIn refused this post - the app needs the "Share on LinkedIn" product and permission to post as you'));
  }
  if (status === 413) return new Error(t('LinkedIn refused that file as too large'));
  return new Error(t('LinkedIn request failed ({status})', { status }));
}

const restHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  'LinkedIn-Version': LINKEDIN_VERSION,
  'X-Restli-Protocol-Version': '2.0.0',
});

// ── /profile connection surface ──────────────────────────────────────────────

/** Interactive connect: the system-browser grant, then the member identity that
 *  becomes both the row label and the author URN every post needs. `via` is the
 *  injectable authorize leg (tests); production binds a registered port. */
export async function connectLinkedIn(persist: boolean, via?: AuthorizeVia): Promise<string> {
  if (!linkedInAvailable()) throw new Error(t('This build has no LinkedIn app configured'));
  const leg = via ?? await loopbackVia(undefined, { host: 'localhost', ports: LINKEDIN_LOOPBACK_PORTS });
  const set = await codeGrant({
    authorizeUrl: AUTHORIZE_URL,
    tokenUrl: TOKEN_URL,
    clientId: linkedInClientId(),
    clientSecret: linkedInClientSecret(),
    scopes: SCOPES,
    // Not a public client: LinkedIn enables PKCE per partner app, and its
    // ordinary token endpoint rejects an exchange carrying a verifier.
    pkce: false,
  }, providerFetch, leg);
  const who = await providerFetch(`${API}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${set.accessToken}` },
  });
  if (!who.ok) throw linkedInError(who.status);
  const me = await who.json() as { sub?: string; name?: string };
  if (!me.sub) throw new Error(t('LinkedIn did not return your member id'));
  const account = me.name || me.sub;
  const member = `urn:li:person:${me.sub}`;
  // The token IS the connection (60 days, no refresh grant): memory always,
  // at rest only when the user asked for it.
  cacheToken(KIND, set.accessToken, set.expiresAt);
  await saveConnection({
    kind: KIND,
    account,
    persist,
    config: { member, ...(persist ? { accessToken: set.accessToken } : {}) },
    scopes: SCOPES,
    connectedAt: new Date().toISOString(),
  });
  return account;
}

/** Disconnect: best-effort LinkedIn-side revocation, then the local wipe (which
 *  is the guarantee - revocation needs the client pair and may refuse). */
export async function disconnectLinkedIn(): Promise<void> {
  const conn = await getConnection(KIND);
  const token = cachedToken(KIND) ?? conn?.config?.accessToken;
  if (token && linkedInAvailable()) {
    try {
      await providerFetch(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: linkedInClientId(),
          client_secret: linkedInClientSecret(),
          token,
        }),
      });
    } catch { /* courtesy only */ }
  }
  await removeConnection(KIND);
}

async function linkedInAuth(): Promise<{ token: string; member: string }> {
  const conn = await getConnection(KIND);
  const member = conn?.config?.member;
  if (!member) throw new Error(t('Connect LinkedIn in Profile first'));
  const token = cachedToken(KIND) ?? conn?.config?.accessToken;
  if (!token) throw new Error(t('Your LinkedIn session ended - connect again in Profile'));
  return { token, member };
}

// ── Upload + post ────────────────────────────────────────────────────────────

interface InitializedUpload { uploadUrl: string; asset: string }

/** initializeUpload gives back a one-shot upload URL and the URN the post will
 *  reference. Images and documents differ only in the path and the field the
 *  URN arrives under. */
async function initializeUpload(kindPath: 'images' | 'documents', member: string, token: string): Promise<InitializedUpload> {
  const res = await providerFetch(`${API}/rest/${kindPath}?action=initializeUpload`, {
    method: 'POST',
    headers: { ...restHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ initializeUploadRequest: { owner: member } }),
  });
  if (!res.ok) throw linkedInError(res.status);
  const json = await res.json() as { value?: { uploadUrl?: string; image?: string; document?: string } };
  const uploadUrl = json.value?.uploadUrl;
  const asset = kindPath === 'images' ? json.value?.image : json.value?.document;
  if (!uploadUrl || !asset) throw new Error(t('LinkedIn did not offer an upload address'));
  return { uploadUrl, asset };
}

/** The bytes themselves: a plain PUT to the address above, still authenticated
 *  (unlike Graph's pre-authenticated session URLs). 201 is the success. */
async function putBytes(uploadUrl: string, bytes: Uint8Array, token: string): Promise<void> {
  const res = await providerFetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok && res.status !== 201) throw linkedInError(res.status);
}

// ── The SendTarget ───────────────────────────────────────────────────────────

export function linkedinSendTarget(): SendTarget {
  return {
    kind: KIND,
    label: t('LinkedIn'),
    formats: [...IMAGE_FORMATS, ...DOCUMENT_FORMATS],
    // Desktop only, for the reasons at the top of this file - the gate is the
    // shell, not the config, so a web build never offers a button it cannot
    // honour even if someone sets the env pair.
    available: () => isTauriShell() && hasConnection(KIND),
    hint: t('Posts this file to your own LinkedIn feed, as a public post under your name. Your sign-in stays on this device, and whether it is remembered between sessions is your choice in Profile.'),
    send: async ({ bytes, name, format }) => {
      const { token, member } = await linkedInAuth();
      const isDocument = (DOCUMENT_FORMATS as readonly string[]).includes(format.toLowerCase());
      if (isDocument && bytes.byteLength > LINKEDIN_DOCUMENT_MAX) {
        throw new Error(t('LinkedIn caps documents at 100 MB - this one is larger, so export a smaller file'));
      }
      const { uploadUrl, asset } = await initializeUpload(isDocument ? 'documents' : 'images', member, token);
      await putBytes(uploadUrl, bytes, token);
      const post = await providerFetch(`${API}/rest/posts`, {
        method: 'POST',
        headers: { ...restHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: member,
          // The export's name is the post text, the same convention Bluesky and
          // Mastodon use here until a caption field exists.
          commentary: name,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          content: { media: isDocument ? { id: asset, title: name } : { id: asset, altText: name } },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      });
      if (!post.ok) throw linkedInError(post.status);
      // The post URN comes back in a header, not the body.
      const urn = post.headers.get('x-restli-id') ?? '';
      return {
        ...(urn ? { url: `https://www.linkedin.com/feed/update/${urn}/` } : {}),
        label: t('Posted to LinkedIn'),
      };
    },
  };
}
