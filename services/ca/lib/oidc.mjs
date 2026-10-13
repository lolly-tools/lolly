// SPDX-License-Identifier: MPL-2.0
/**
 * OIDC / OAuth provider glue - github, google, suse, plus config
 * introspection for /health and the startup log.
 *
 * Google and SUSE (id.suse.com - Keycloak) share the generic OIDC path: discovery document
 * (cached in module scope), PKCE S256 + client secret, and an id_token
 * verified against the provider's JWKS (RS256 via jose). An unverified
 * JWT decode is not acceptable here - the email claim goes straight into a
 * certificate SAN, so the signature is checked before the claim is believed.
 * GitHub is plain OAuth: token exchange, then the /user/emails API for a
 * primary + verified address.
 */

import { createLocalJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

export const OAUTH_PROVIDERS = ['github', 'google', 'suse'];

/** Which providers have complete env config - the /health `configured` map. */
export function configuredProviders(env) {
  return {
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    suse: Boolean(env.SUSE_ISSUER && env.SUSE_CLIENT_ID && env.SUSE_CLIENT_SECRET),
    email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
  };
}

/** Loose-but-useful email shape check (also used by /email/start). */
export const looksLikeEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const jsonCache = new Map();
const CACHE_TTL_MS = 600_000;

function secureUrl(value, issuer = false) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.hash || (issuer && u.search)) throw new Error('invalid OIDC endpoint URL');
  return u;
}

async function fetchJson(url, init = {}) {
  secureUrl(url);
  const res = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`identity provider request failed: ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('empty identity provider response');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error('identity provider response too large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function cachedJson(url, kid) {
  const hit = jsonCache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    const doc = await hit.promise;
    if (!kid || doc.keys?.some(k => k.kid === kid)) return doc;
  }
  const promise = fetchJson(url);
  const entry = { at: Date.now(), promise };
  jsonCache.set(url, entry);
  try { return await promise; } catch (error) {
    if (jsonCache.get(url) === entry) jsonCache.delete(url);
    throw error;
  }
}

function issuerOf(provider, env) {
  return provider === 'google' ? 'https://accounts.google.com' : String(env.SUSE_ISSUER || '');
}

async function discover(provider, env) {
  const issuer = issuerOf(provider, env);
  secureUrl(issuer, true);
  const doc = await cachedJson(`${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`);
  if (!doc || doc.issuer !== issuer) throw new Error('OIDC discovery issuer mismatch');
  for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
    if (typeof doc[key] !== 'string') throw new Error(`OIDC discovery missing ${key}`);
    secureUrl(doc[key]);
  }
  return doc;
}

/** RFC 7636 S256 code challenge for a base64url verifier string. */
export async function pkceChallengeS256(verifier) {
  return Buffer.from(new Uint8Array(await subtle.digest('SHA-256', te.encode(verifier)))).toString('base64url');
}

// ─── authorize URL ────────────────────────────────────────────────────────────

/** The provider authorize URL the popup is 302'd to. */
export async function buildAuthorizeUrl(provider, env, { redirectUri, state, nonce, pkceVerifier }) {
  if (provider === 'github') {
    const u = new URL('https://github.com/login/oauth/authorize');
    u.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('scope', 'user:email');
    u.searchParams.set('state', state);
    return u.href;
  }
  const disco = await discover(provider, env);
  const u = new URL(disco.authorization_endpoint);
  u.searchParams.set('client_id', provider === 'google' ? env.GOOGLE_CLIENT_ID : env.SUSE_CLIENT_ID);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', provider === 'google' ? 'openid email' : 'openid email profile');
  u.searchParams.set('state', state);
  u.searchParams.set('nonce', nonce);
  u.searchParams.set('code_challenge', await pkceChallengeS256(pkceVerifier));
  u.searchParams.set('code_challenge_method', 'S256');
  return u.href;
}

// ─── id_token verification (google + suse) ────────────────────────────────────

async function verifyIdToken(idToken, { jwksUri, issuer, clientId, nonce }) {
  const header = decodeProtectedHeader(idToken);
  if (header.alg !== 'RS256') throw new Error('unsupported id_token algorithm');
  const jwks = await cachedJson(jwksUri, header.kid);
  const { payload: claims } = await jwtVerify(idToken, createLocalJWKSet(jwks), {
    algorithms: ['RS256'], issuer, audience: clientId,
    requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat'],
  });
  if (typeof claims.sub !== 'string' || !claims.sub || !Number.isFinite(claims.iat) || !Number.isFinite(claims.exp)) throw new Error('invalid required id_token claims');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (audiences.some(a => a !== clientId)) throw new Error('untrusted id_token audience');
  if (claims.azp !== undefined && claims.azp !== clientId) throw new Error('id_token authorized party mismatch');
  if (claims.iat * 1000 > Date.now() + 300_000) throw new Error('id_token issued in the future');
  if (!nonce || claims.nonce !== nonce) throw new Error('id_token nonce mismatch');
  return claims;
}

async function exchangeOidc(provider, env, { code, redirectUri, pkceVerifier, nonce }) {
  const disco = await discover(provider, env);
  const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.SUSE_CLIENT_ID;
  const clientSecret = provider === 'google' ? env.GOOGLE_CLIENT_SECRET : env.SUSE_CLIENT_SECRET;
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri,
    client_id: clientId, code_verifier: pkceVerifier });
  const method = env[provider === 'google' ? 'GOOGLE_TOKEN_AUTH_METHOD' : 'SUSE_TOKEN_AUTH_METHOD'] || 'client_secret_post';
  if (!['client_secret_post', 'client_secret_basic'].includes(method)) throw new Error('unsupported client authentication method');
  if (disco.token_endpoint_auth_methods_supported && (!Array.isArray(disco.token_endpoint_auth_methods_supported)
    || !disco.token_endpoint_auth_methods_supported.includes(method))) throw new Error('IdP does not support configured client authentication');
  const headers = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
  if (method === 'client_secret_basic') {
    const form = v => new URLSearchParams({ v }).toString().slice(2);
    headers.authorization = `Basic ${Buffer.from(`${form(clientId)}:${form(clientSecret)}`).toString('base64')}`;
    body.delete('client_id');
  } else body.set('client_secret', clientSecret);
  const tok = await fetchJson(disco.token_endpoint, { method: 'POST', headers, body });
  if (!tok.id_token) throw new Error('identity provider returned no id_token');
  return verifyIdToken(tok.id_token, { jwksUri: disco.jwks_uri, issuer: issuerOf(provider, env), clientId, nonce });
}

// ─── GitHub (plain OAuth, email via the REST API) ─────────────────────────────

async function githubEmail(env, { code, redirectUri }) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.access_token) {
    throw new Error(tok.error_description || tok.error || `GitHub token exchange failed (HTTP ${res.status})`);
  }
  // User-Agent is REQUIRED by the GitHub API - requests without one are 403'd.
  const gh = (path) => fetch(`https://api.github.com${path}`, {
    headers: { authorization: `Bearer ${tok.access_token}`, 'user-agent': 'lolly-ca', accept: 'application/vnd.github+json' },
  });
  const emailsRes = await gh('/user/emails');
  if (emailsRes.ok) {
    const list = await emailsRes.json();
    if (Array.isArray(list)) {
      const best = list.find((e) => e.primary && e.verified === true) || list.find((e) => e.verified === true);
      if (best && looksLikeEmail(best.email)) return best.email;
    }
  }
  throw new Error('GitHub account has no verified email');
}

// ─── the one entry point the callback route uses ──────────────────────────────

/** Exchange the authorization code and return a VERIFIED email, or throw. */
export async function fetchVerifiedEmail(provider, env, { code, redirectUri, pkceVerifier, nonce }) {
  if (provider === 'github') return githubEmail(env, { code, redirectUri });
  const claims = await exchangeOidc(provider, env, { code, redirectUri, pkceVerifier, nonce });
  if (provider === 'google') {
    if (claims.email_verified !== true) throw new Error('Google account email is not verified');
    if (!looksLikeEmail(claims.email)) throw new Error('Google id_token carries no email');
    return claims.email;
  }
  const policy = env.SUSE_EMAIL_VERIFICATION || 'claim';
  if (!['claim', 'trusted'].includes(policy)) throw new Error('invalid SUSE email verification policy');
  // A managed issuer may omit the claim only when its operator explicitly trusts its email directory.
  if (claims.email_verified !== true && !(policy === 'trusted' && claims.email_verified === undefined)) throw new Error('account email is not verified');
  if (!looksLikeEmail(claims.email)) throw new Error('id_token carries no verified email claim');
  return claims.email;
}
