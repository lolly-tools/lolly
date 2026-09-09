// SPDX-License-Identifier: MPL-2.0
/**
 * A minimal, stateless OAuth 2.1 authorization server. It does just enough for a
 * remote MCP client (claude.ai's "custom connector", Claude Code, any spec
 * client) to discover, register, and obtain a bearer token for the `/api/mcp`
 * endpoint.
 *
 * WHY STATELESS: Vercel functions share no memory or disk, so there is no client
 * registry, code store, or token store. Instead every artefact is an HMAC-signed
 * value (sign.ts): the `client_id` encodes its own redirect URIs, the auth `code`
 * encodes the PKCE challenge and target, and the access/refresh tokens encode
 * scope and expiry. Verification needs only the shared secret. Trade-off: an
 * auth code cannot be hard "one-time" without a store. We bound it to a 60 s
 * TTL plus PKCE, the standard mitigation. See README "Not yet".
 *
 * AUTH MODEL (passphrase): the consent page asks the operator for the value of
 * `LOLLY_MCP_TOKEN`, the same shared secret that already gates the endpoint. So
 * OAuth here is a spec-compliant wrapper around the existing gate: anyone who
 * knows the token can connect claude.ai; the MCP endpoint keeps accepting the raw
 * token too, so Claude Code is unaffected. Per-user identity (GitHub) is a
 * documented later upgrade. The CA already has the OIDC code to graft on.
 *
 * Endpoints (mounted by gateway.ts):
 *   GET  /.well-known/oauth-protected-resource   → RFC 9728 resource metadata
 *   GET  /.well-known/oauth-authorization-server  → RFC 8414 AS metadata
 *   POST /api/mcp/register                        → RFC 7591 dynamic client reg
 *   GET  /api/mcp/authorize                       → consent page
 *   POST /api/mcp/authorize                       → passphrase → auth code
 *   POST /api/mcp/token                           → code / refresh → access token
 */

import { safeEqual, sha256B64u, signValue, verifyValue } from './sign.ts';

export interface Result {
  status: number;
  headers?: Record<string, string>;
  json?: unknown;
  html?: string;
  redirect?: string;
}

const ACCESS_TTL = 3600;              // 1 h
const REFRESH_TTL = 30 * 24 * 3600;   // 30 d
const CODE_TTL = 60;                  // 1 min - bounds the stateless (non-one-time) code
const SCOPE = 'mcp';

interface ClientPayload { t: 'client'; ru: string[]; iat: number }
interface CodePayload { t: 'code'; cid: string; ru: string; cc: string; sc: string; aud?: string; exp: number }
interface TokenPayload { t: 'access' | 'refresh'; sc: string; aud?: string; exp: number }

const now = (): number => Math.floor(Date.now() / 1000);

/** The signing secret (defaults to the passphrase so no new env is required). */
export function signingSecret(env: NodeJS.ProcessEnv): string {
  return env.LOLLY_MCP_SIGNING_SECRET || env.LOLLY_MCP_TOKEN || '';
}
/** The passphrase the consent page checks. */
function passphrase(env: NodeJS.ProcessEnv): string {
  return env.LOLLY_MCP_TOKEN || '';
}

// ─── discovery metadata ──────────────────────────────────────────────────────

export function protectedResourceMetadata(base: string): Result {
  return {
    status: 200,
    json: {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://lolly.tools',
    },
  };
}

export function authorizationServerMetadata(base: string): Result {
  return {
    status: 200,
    json: {
      issuer: base,
      authorization_endpoint: `${base}/api/mcp/authorize`,
      token_endpoint: `${base}/api/mcp/token`,
      registration_endpoint: `${base}/api/mcp/register`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: [SCOPE],
    },
  };
}

// ─── dynamic client registration (RFC 7591) ──────────────────────────────────

const isValidRedirect = (u: unknown): boolean => {
  if (typeof u !== 'string') return false;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch { return false; }
};

export async function register(body: Record<string, unknown>, env: NodeJS.ProcessEnv): Promise<Result> {
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
  if (!redirectUris.length || !redirectUris.every(isValidRedirect)) {
    return { status: 400, json: { error: 'invalid_redirect_uri', error_description: 'redirect_uris must be a non-empty array of https (or localhost) URLs' } };
  }
  const client: ClientPayload = { t: 'client', ru: redirectUris as string[], iat: now() };
  const clientId = await signValue(client, signingSecret(env));
  return {
    status: 201,
    json: {
      client_id: clientId,
      client_id_issued_at: client.iat,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: SCOPE,
      // Echo back any client_name the caller sent, per RFC 7591.
      ...(typeof body.client_name === 'string' ? { client_name: body.client_name } : {}),
    },
  };
}

// ─── authorize ────────────────────────────────────────────────────────────────

interface AuthzParams {
  response_type?: string; client_id?: string; redirect_uri?: string;
  code_challenge?: string; code_challenge_method?: string;
  state?: string; scope?: string; resource?: string;
}

/** Validate the client + redirect_uri (must pass before we render or redirect). */
async function resolveClient(params: AuthzParams, env: NodeJS.ProcessEnv): Promise<{ ok: true } | { ok: false; result: Result }> {
  const client = await verifyValue<ClientPayload>(params.client_id, signingSecret(env));
  if (!client || client.t !== 'client') {
    return { ok: false, result: { status: 400, html: errorPage('Unknown or invalid client. Re-add the connector so it registers again.') } };
  }
  if (!params.redirect_uri || !client.ru.includes(params.redirect_uri)) {
    return { ok: false, result: { status: 400, html: errorPage('The redirect URL is not registered for this client.') } };
  }
  return { ok: true };
}

/** GET /authorize → the consent page (or an error page for bad params). */
export async function authorizeGet(params: AuthzParams, env: NodeJS.ProcessEnv): Promise<Result> {
  if (!passphrase(env)) return { status: 500, html: errorPage('This deployment has no LOLLY_MCP_TOKEN set, so OAuth connect is disabled.') };
  const client = await resolveClient(params, env);
  if (!client.ok) return client.result;
  if (params.response_type !== 'code') return { status: 400, html: errorPage('Unsupported response_type (only "code").') };
  if (!params.code_challenge || params.code_challenge_method !== 'S256') {
    return { status: 400, html: errorPage('This server requires PKCE with code_challenge_method=S256.') };
  }
  return { status: 200, html: consentPage(params) };
}

/** POST /authorize → check the passphrase, mint a code, 302 back to the client. */
export async function authorizePost(params: AuthzParams & { passphrase?: string }, env: NodeJS.ProcessEnv): Promise<Result> {
  const client = await resolveClient(params, env);
  if (!client.ok) return client.result;
  if (params.response_type !== 'code' || !params.code_challenge || params.code_challenge_method !== 'S256') {
    return { status: 400, html: errorPage('Invalid authorization request.') };
  }
  const given = String(params.passphrase || '');
  if (!given || !(await safeEqual(given, passphrase(env)))) {
    // Re-render with an inline error (do NOT reveal whether the token was close).
    return { status: 401, html: consentPage(params, 'That access token is not correct.') };
  }
  const code = await signValue({
    t: 'code', cid: params.client_id!, ru: params.redirect_uri!, cc: params.code_challenge!,
    sc: SCOPE, aud: params.resource, exp: now() + CODE_TTL,
  } satisfies CodePayload, signingSecret(env));
  const url = new URL(params.redirect_uri!);
  url.searchParams.set('code', code);
  if (params.state) url.searchParams.set('state', params.state);
  return { status: 302, redirect: url.href };
}

// ─── token ────────────────────────────────────────────────────────────────────

const oauthError = (status: number, error: string, desc?: string): Result =>
  ({ status, headers: { 'cache-control': 'no-store' }, json: { error, ...(desc ? { error_description: desc } : {}) } });

export async function token(body: Record<string, string>, env: NodeJS.ProcessEnv): Promise<Result> {
  const secret = signingSecret(env);
  const grant = body.grant_type;

  if (grant === 'authorization_code') {
    const code = await verifyValue<CodePayload>(body.code, secret);
    if (!code || code.t !== 'code') return oauthError(400, 'invalid_grant', 'authorization code is invalid');
    if (code.exp < now()) return oauthError(400, 'invalid_grant', 'authorization code has expired');
    if (body.redirect_uri && body.redirect_uri !== code.ru) return oauthError(400, 'invalid_grant', 'redirect_uri mismatch');
    if (body.client_id && body.client_id !== code.cid) return oauthError(400, 'invalid_grant', 'client_id mismatch');
    // PKCE: the presented verifier must hash to the challenge baked into the code.
    if (!body.code_verifier || (await sha256B64u(body.code_verifier)) !== code.cc) {
      return oauthError(400, 'invalid_grant', 'PKCE verification failed');
    }
    return issueTokens(code.sc, code.aud, secret);
  }

  if (grant === 'refresh_token') {
    const rt = await verifyValue<TokenPayload>(body.refresh_token, secret);
    if (!rt || rt.t !== 'refresh') return oauthError(400, 'invalid_grant', 'refresh token is invalid');
    if (rt.exp < now()) return oauthError(400, 'invalid_grant', 'refresh token has expired');
    return issueTokens(rt.sc, rt.aud, secret);
  }

  return oauthError(400, 'unsupported_grant_type', String(grant || ''));
}

async function issueTokens(scope: string, aud: string | undefined, secret: string): Promise<Result> {
  const access = await signValue({ t: 'access', sc: scope, aud, exp: now() + ACCESS_TTL } satisfies TokenPayload, secret);
  const refresh = await signValue({ t: 'refresh', sc: scope, aud, exp: now() + REFRESH_TTL } satisfies TokenPayload, secret);
  return {
    status: 200,
    headers: { 'cache-control': 'no-store' },
    json: { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope },
  };
}

// ─── endpoint access-token validation ─────────────────────────────────────────

/**
 * Gate for POST /api/mcp. Accepts EITHER the raw shared token (LOLLY_MCP_TOKEN,
 * Claude Code / curl, unchanged) OR an OAuth access token minted above. If no
 * token is configured at all, the endpoint is open (dev/self-host default).
 */
export async function isAuthorized(authorizationHeader: string | undefined, env: NodeJS.ProcessEnv): Promise<boolean> {
  const shared = passphrase(env);
  // Fail CLOSED. A production deploy that forgets/drops/typos LOLLY_MCP_TOKEN
  // must NOT silently become a world-open MCP endpoint (which can invoke tools
  // and read the bundled tools/** + catalog/**). Anonymous access is only for a
  // dev/self-host box that explicitly opts in with LOLLY_MCP_ALLOW_ANONYMOUS=1.
  if (!shared) return env.LOLLY_MCP_ALLOW_ANONYMOUS === '1';
  const bearer = /^Bearer\s+(.+)$/i.exec(String(authorizationHeader || ''))?.[1]?.trim();
  if (!bearer) return false;
  if (await safeEqual(bearer, shared)) return true; // raw shared-secret path
  const tok = await verifyValue<TokenPayload>(bearer, signingSecret(env));
  return !!tok && tok.t === 'access' && tok.exp >= now();
}

// ─── minimal HTML (self-contained, brand-light) ───────────────────────────────

const esc = (s: string): string => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function page(title: string, inner: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
    font:15px/1.5 SUSE,-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;
    background:#f4f7f5; color:#10231f; }
  @media (prefers-color-scheme:dark){ body{ background:#0c1512; color:#e7f0ec; } .card{ background:#12201b; } input{ background:#0c1512; color:inherit; } }
  .card { width:min(420px,92vw); background:#fff; border-radius:16px; padding:28px 26px;
    box-shadow:0 8px 40px rgba(0,0,0,.14); }
  h1 { font-size:1.25rem; margin:0 0 .2em; }
  p { color:#5b6b64; margin:.2em 0 1.1em; }
  @media (prefers-color-scheme:dark){ p{ color:#9fb2aa; } }
  label { font-weight:600; font-size:.82rem; display:block; margin:0 0 .35em; }
  input[type=password] { width:100%; box-sizing:border-box; padding:11px 12px; font:inherit;
    border:1px solid #cdd8d3; border-radius:9px; }
  input:focus { outline:2px solid #30ba78; border-color:#30ba78; }
  button { margin-top:16px; width:100%; padding:11px; font:inherit; font-weight:700; color:#fff;
    background:#30ba78; border:0; border-radius:9px; cursor:pointer; }
  button:hover { background:#28a56a; }
  .err { color:#c0392b; font-size:.85rem; margin:.5em 0 0; }
  .dot { width:34px; height:34px; border-radius:9px; background:#30ba78; display:grid; place-items:center; color:#fff; font-weight:800; margin-bottom:14px; }
</style></head><body><div class="card">${inner}</div></body></html>`;
}

function hidden(params: AuthzParams): string {
  const f = (k: keyof AuthzParams): string => (params[k] ? `<input type="hidden" name="${k}" value="${esc(String(params[k]))}">` : '');
  return ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource']
    .map((k) => f(k as keyof AuthzParams)).join('');
}

function consentPage(params: AuthzParams, error?: string): string {
  let host = 'an application';
  try { host = new URL(params.redirect_uri || '').host || host; } catch { /* keep default */ }
  return page('Connect to Lolly', `
    <div class="dot">L</div>
    <h1>Connect to Lolly</h1>
    <p><strong>${esc(host)}</strong> wants to use the Lolly tools on your behalf. Paste your Lolly access token to allow it.</p>
    <form method="post">
      ${hidden(params)}
      <label for="pp">Access token</label>
      <input id="pp" name="passphrase" type="password" autocomplete="off" autofocus required placeholder="LOLLY_MCP_TOKEN">
      ${error ? `<p class="err">${esc(error)}</p>` : ''}
      <button type="submit">Allow</button>
    </form>`);
}

function errorPage(message: string): string {
  return page('Cannot connect', `<div class="dot">L</div><h1>Cannot connect</h1><p>${esc(message)}</p>`);
}
