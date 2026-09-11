// SPDX-License-Identifier: MPL-2.0
/**
 * provider-auth - the shared OAuth machinery every personal send-target driver
 * rides (plans/129). Extracted from lib/google-drive.ts's popup flow and grown
 * one grant:
 *
 *   - `popupOAuth()` - the popup + BOTH return channels (opener postMessage and
 *     the BroadcastChannel that survives COOP severance - plans/127), the
 *     closed-poll that stands down under cross-origin isolation, the timeout,
 *     the cleanup. Providers differ only in the URL they open and how they
 *     parse what comes back.
 *   - `codeGrant()` / `refreshGrant()` - authorization-code + PKCE for public
 *     clients (Dropbox, Microsoft SPA): S256 challenge, state validation, the
 *     token exchange over CORS. No client secret for any provider that lets a
 *     public client work; `pkce: false` + `clientSecret` is the one concession,
 *     for a provider that offers PKCE to partner apps only (LinkedIn), and it
 *     is why that driver is desktop-only.
 *
 * Google's web clients still demand a secret for code exchange, so the gdrive
 * driver keeps its implicit token grant and reuses only popupOAuth from here.
 *
 * PRIVACY: everything is client → provider directly. Tokens live in the
 * caller's custody (lib/provider-connections.ts); nothing here persists.
 */

import { t } from '../i18n.ts';
import { instanceFetch } from './instance.ts';
import { isTauriShell } from './instance-choice.ts';

/** Provider API fetch: plain fetch on the web (the provider must answer CORS,
 *  noted per driver), the CORS-free Tauri HTTP client on the desktop shells -
 *  where the webview origin would otherwise fail every provider's CORS policy. */
export const providerFetch: typeof fetch = (input, init) =>
  isTauriShell() ? instanceFetch(String(input), init) : fetch(input, init);

/** What the return page delivers (public/oauth-return.html): the fragment
 *  (token grants) and the query string (code grants), verbatim. */
export interface OAuthReturn {
  hash: string;
  search: string;
}

/** A minted (or refreshed) token set. `refreshToken` only where the provider
 *  granted one AND the flow asked for offline access. */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms; refresh a minute early so a send never starts on a dying token. */
  expiresAt: number;
}

const AUTH_TIMEOUT_MS = 180_000;

/**
 * Open the provider's page in a popup and wait for /oauth-return.html to
 * deliver. Rejects on popup-blocked, timeout, or (outside isolation, where the
 * handle is trustworthy) a closed popup. The caller validates `state`.
 */
export function popupOAuth(url: string, windowName: string): Promise<OAuthReturn> {
  const popup = window.open(url, windowName, 'popup,width=480,height=640');
  if (!popup) return Promise.reject(new Error(t('Sign-in popup was blocked - allow popups for this site')));
  return new Promise<OAuthReturn>((resolve, reject) => {
    const done = (fn: () => void) => { cleanup(); fn(); };
    const accept = (data: { source?: string; hash?: string; search?: string } | null) => {
      if (!data || data.source !== 'lolly-oauth') return;
      done(() => resolve({ hash: data.hash || '', search: data.search || '' }));
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      accept(e.data as { source?: string; hash?: string; search?: string } | null);
    };
    // The isolation-proof channel: under COOP: same-origin the popup's opener
    // handle is severed on the provider's pages, so the return page reaches us
    // over BroadcastChannel instead (same origin, same isolation partition).
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('lolly-oauth');
      bc.onmessage = (e) => accept(e.data as { source?: string; hash?: string; search?: string } | null);
    } catch { /* no BroadcastChannel - the opener path covers it */ }
    // A closed popup never posts; poll so the caller isn't left hanging. A
    // SEVERED handle also reads closed under isolation, so there the timeout
    // is the only honest cancel signal and the poll must stay out of it.
    const closedPoll = globalThis.crossOriginIsolated ? null : setInterval(() => {
      if (popup.closed) done(() => reject(new Error(t('Sign-in was cancelled'))));
    }, 500);
    const timeout = setTimeout(() => done(() => reject(new Error(t('Sign-in timed out')))), AUTH_TIMEOUT_MS);
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      bc?.close();
      if (closedPoll != null) clearInterval(closedPoll);
      clearTimeout(timeout);
      try { if (!popup.closed) popup.close(); } catch { /* cross-origin at half-close */ }
    };
    window.addEventListener('message', onMessage);
  });
}

// ── PKCE (RFC 7636, S256) ─────────────────────────────────────────────────────

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function randomState(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(16)));
}

/** A fresh verifier (43-128 chars) and its S256 challenge. */
export async function makePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48))); // 64 chars
  const challenge = await pkceChallenge(verifier);
  return { verifier, challenge };
}

/** S256: base64url(SHA-256(ascii(verifier))). Exported for its test vector. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

// ── Authorization-code grant for public clients ───────────────────────────────

export interface CodeGrantConfig {
  /** e.g. https://www.dropbox.com/oauth2/authorize */
  authorizeUrl: string;
  /** e.g. https://api.dropboxapi.com/oauth2/token - must answer CORS (or be
   *  reached through a CORS-free fetchFn, e.g. instanceFetch under Tauri). */
  tokenUrl: string;
  clientId: string;
  /** Google's Desktop-app clients only: the issued "secret" that Google's own
   *  docs state is NOT treated as confidential for installed apps - it ships
   *  in every native binary using this flow. Included in code/refresh
   *  exchanges when present. Never set this for a genuinely confidential
   *  secret: there is no server here to keep it in. */
  clientSecret?: string;
  /** Space-separated provider scopes. */
  scopes: string;
  /** Extra authorize-URL params (e.g. Dropbox token_access_type=offline). */
  extraAuthParams?: Record<string, string>;
  windowName?: string;
  /** PKCE is on by default, and stays on for every provider that supports it -
   *  which is nearly all of them. Set false ONLY for one that refuses the extra
   *  params. LinkedIn is the case that forced the option: it offers PKCE to
   *  partner apps only, and its ordinary token endpoint rejects an exchange
   *  carrying a code_verifier. Such a provider demands a client_secret instead,
   *  which is why the two travel together on that driver and nowhere else. */
  pkce?: boolean;
}

/** The return page - the SAME registered redirect the token grant uses. */
export const oauthRedirectUri = (): string => `${location.origin}/oauth-return.html`;

// ── Authorize legs: browser popup vs system-browser loopback ─────────────────

/** How an authorization URL reaches the user and how its redirect comes back.
 *  The popup leg is the web default; the loopback leg (plans/129 WP4) is the
 *  desktop one - the system browser carries the sign-in (managed-account SSO
 *  and Google's webview ban both demand it), and the redirect lands on a
 *  single-shot 127.0.0.1 listener the Tauri side owns (src-tauri/src/oauth.rs). */
export interface AuthorizeVia {
  redirectUri: string;
  run(url: string): Promise<OAuthReturn>;
}

/** The minimal Tauri invoke surface loopbackVia rides - injectable for tests,
 *  defaulting to the live __TAURI_INTERNALS__ (the lib/instance.ts pattern:
 *  this file is bundled by the web shell's Vite too, so @tauri-apps/* cannot
 *  be a static import). */
export interface LoopbackTransport {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

function tauriTransport(): LoopbackTransport {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: LoopbackTransport }).__TAURI_INTERNALS__;
  if (!internals) throw new Error(t('System-browser sign-in needs the desktop app'));
  return internals;
}

/** How the loopback redirect must be SHAPED for one provider - the two things
 *  their registration policies disagree about (plans/129 WP4b). */
export interface LoopbackOptions {
  /** The literal host in the redirect URI. RFC 8252 treats `127.0.0.1` and
   *  `localhost` as the same loopback, but registration policies do not:
   *  Google's Desktop clients take the IP form (the default here, unchanged),
   *  while Dropbox exempts "localhost URIs" by name and Microsoft cannot even
   *  add an `http://127.0.0.1` reply URL through the portal UI. The bind is
   *  always 127.0.0.1; only the text of the URI changes. */
  host?: '127.0.0.1' | 'localhost';
  /** Preferred ports, tried in order, for a provider that matches the redirect
   *  URI EXACTLY and offers no port wildcard (LinkedIn) - every one of them has
   *  to be registered up front, so the list stays short and fixed. Omitted =
   *  an ephemeral port, which is what RFC 8252 assumes and what every other
   *  provider here accepts. */
  ports?: number[];
}

/**
 * The desktop authorize leg: bind the loopback port FIRST (the redirect URI
 * needs it), open the provider page in the system browser, then wait for the
 * one redirect. The port listener is single-shot; a cancelled sign-in simply
 * times out and the next attempt binds fresh.
 */
export async function loopbackVia(
  transport?: LoopbackTransport, opts: LoopbackOptions = {},
): Promise<AuthorizeVia> {
  const inv = transport ?? tauriTransport();
  // No list = the Rust side binds :0 exactly as before; a list makes it try
  // each in order and FAIL rather than fall back, because an unregistered port
  // would be refused by the provider anyway.
  const port = await inv.invoke<number>('oauth_listen', opts.ports ? { ports: opts.ports } : undefined);
  return {
    redirectUri: `http://${opts.host ?? '127.0.0.1'}:${port}/oauth-return`,
    async run(url: string): Promise<OAuthReturn> {
      await inv.invoke('oauth_open', { raw: url });
      const search = await inv.invoke<string>('oauth_wait', { port, timeoutMs: AUTH_TIMEOUT_MS });
      return { hash: '', search };
    },
  };
}

/** The web authorize leg: the popup + return-page machinery above. */
export function popupVia(windowName = 'lolly-oauth'): AuthorizeVia {
  return {
    redirectUri: oauthRedirectUri(),
    run: (url: string) => popupOAuth(url, windowName),
  };
}

/** Map one token-endpoint JSON response to a TokenSet. Exported for tests. */
export function tokenSetFrom(json: Record<string, unknown>): TokenSet {
  const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
  if (!accessToken) throw new Error(t('Sign-in failed: the provider returned no token'));
  const expiresInS = Math.max(60, Number(json.expires_in) || 3600);
  return {
    accessToken,
    ...(typeof json.refresh_token === 'string' && json.refresh_token ? { refreshToken: json.refresh_token } : {}),
    expiresAt: Date.now() + (expiresInS - 60) * 1000,
  };
}

/** Parse and validate a code-grant return. Exported for tests. */
export function parseCodeReturn(search: string, expectedState: string): string {
  const p = new URLSearchParams(search.replace(/^\?/, ''));
  const err = p.get('error');
  if (err) throw new Error(t('Sign-in failed: {reason}', { reason: p.get('error_description') || err }));
  if (p.get('state') !== expectedState) throw new Error(t('Sign-in failed: state mismatch'));
  const code = p.get('code');
  if (!code) throw new Error(t('Sign-in failed: the provider returned no code'));
  return code;
}

/** The full interactive code+PKCE flow: authorize leg → code → token
 *  exchange. The leg defaults to the web popup; a desktop caller passes
 *  `loopbackVia()` for the system-browser + 127.0.0.1 return (WP4). */
export async function codeGrant(
  cfg: CodeGrantConfig, fetchFn: typeof fetch = fetch, via?: AuthorizeVia,
): Promise<TokenSet> {
  const state = randomState();
  const pkce = cfg.pkce === false ? null : await makePkce();
  const leg = via ?? popupVia(cfg.windowName ?? 'lolly-oauth');
  const url = `${cfg.authorizeUrl}?${new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: leg.redirectUri,
    response_type: 'code',
    scope: cfg.scopes,
    state,
    ...(pkce ? { code_challenge: pkce.challenge, code_challenge_method: 'S256' } : {}),
    ...cfg.extraAuthParams,
  })}`;
  const ret = await leg.run(url);
  const code = parseCodeReturn(ret.search, state);
  const res = await fetchFn(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: cfg.clientId,
      ...(cfg.clientSecret ? { client_secret: cfg.clientSecret } : {}),
      ...(pkce ? { code_verifier: pkce.verifier } : {}),
      redirect_uri: leg.redirectUri,
      ...(cfg.scopes && cfg.tokenUrl.includes('microsoftonline') ? { scope: cfg.scopes } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(t('Sign-in failed ({status})', { status: res.status }) + (body ? `: ${body.slice(0, 160)}` : ''));
  }
  return tokenSetFrom(await res.json() as Record<string, unknown>);
}

/** Exchange a refresh token for a fresh set. Providers may ROTATE the refresh
 *  token (Microsoft does) - the caller must store the returned one. */
export async function refreshGrant(
  cfg: { tokenUrl: string; clientId: string; clientSecret?: string; scopes?: string },
  refreshToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<TokenSet> {
  const res = await fetchFn(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: cfg.clientId,
      ...(cfg.clientSecret ? { client_secret: cfg.clientSecret } : {}),
      ...(cfg.scopes && cfg.tokenUrl.includes('microsoftonline') ? { scope: cfg.scopes } : {}),
    }),
  });
  if (!res.ok) throw new Error(t('Your connection has expired - connect again'));
  const set = tokenSetFrom(await res.json() as Record<string, unknown>);
  // A provider that does not rotate keeps the old refresh token working.
  return { refreshToken, ...set };
}
