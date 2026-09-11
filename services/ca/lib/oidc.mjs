// SPDX-License-Identifier: MPL-2.0
/**
 * OIDC / OAuth provider glue - github, google, suse, plus config
 * introspection for /health and the startup log.
 *
 * Google and SUSE (id.suse.com - Keycloak) share the generic OIDC path: discovery document
 * (cached in module scope), PKCE S256 + client secret, and an id_token
 * verified against the provider's JWKS (RS256 via WebCrypto). An unverified
 * JWT decode is not acceptable here - the email claim goes straight into a
 * certificate SAN, so the signature is checked before the claim is believed.
 * GitHub is plain OAuth: token exchange, then the /user/emails API for a
 * primary + verified address.
 */

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

const b64uBytes = (str) => new Uint8Array(Buffer.from(String(str), 'base64url'));
const b64uJson = (str) => JSON.parse(Buffer.from(String(str), 'base64url').toString('utf8'));

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

// ─── discovery + JWKS cache ───────────────────────────────────────────────────
// Module scope: long enough for a serverless instance's lifetime, refreshed
// hourly on a warm local server. Failed fetches are evicted immediately.

const jsonCache = new Map(); // url → { at, promise }
const CACHE_TTL_MS = 3600_000;

function cachedJson(url) {
  const hit = jsonCache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = fetch(url, { headers: { accept: 'application/json' } }).then((r) => {
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
    return r.json();
  });
  promise.catch(() => jsonCache.delete(url));
  jsonCache.set(url, { at: Date.now(), promise });
  return promise;
}

const GOOGLE_DISCOVERY = 'https://accounts.google.com/.well-known/openid-configuration';

function discoveryUrl(provider, env) {
  if (provider === 'google') return GOOGLE_DISCOVERY;
  return `${String(env.SUSE_ISSUER || '').replace(/\/$/, '')}/.well-known/openid-configuration`;
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
  const disco = await cachedJson(discoveryUrl(provider, env));
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
  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw new Error('id_token is not a JWT');
  const [h64, p64, s64] = parts;
  const header = b64uJson(h64);
  if (header.alg !== 'RS256') throw new Error(`unsupported id_token alg: ${header.alg}`);
  const jwks = await cachedJson(jwksUri);
  const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
  const jwk = keys.find((k) => k.kid === header.kid) || keys.find((k) => k.kty === 'RSA' && (k.use || 'sig') === 'sig');
  if (!jwk) throw new Error('no matching key in the provider JWKS');
  const key = await subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await subtle.verify('RSASSA-PKCS1-v1_5', key, b64uBytes(s64), te.encode(`${h64}.${p64}`));
  if (!ok) throw new Error('id_token signature does not verify');
  const claims = b64uJson(p64);
  if (claims.iss !== issuer) throw new Error(`id_token issuer mismatch: ${claims.iss}`);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(clientId)) throw new Error('id_token audience mismatch');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) throw new Error('id_token expired');
  if (nonce && claims.nonce !== nonce) throw new Error('id_token nonce mismatch');
  return claims;
}

async function exchangeOidc(provider, env, { code, redirectUri, pkceVerifier, nonce }) {
  const disco = await cachedJson(discoveryUrl(provider, env));
  const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.SUSE_CLIENT_ID;
  const clientSecret = provider === 'google' ? env.GOOGLE_CLIENT_SECRET : env.SUSE_CLIENT_SECRET;
  const res = await fetch(disco.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: pkceVerifier,
    }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.id_token) {
    throw new Error(tok.error_description || tok.error || `${provider} token exchange failed (HTTP ${res.status})`);
  }
  return verifyIdToken(tok.id_token, { jwksUri: disco.jwks_uri, issuer: disco.issuer, clientId, nonce });
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
      const best = list.find((e) => e.primary && e.verified) || list.find((e) => e.verified);
      if (best && looksLikeEmail(best.email)) return best.email;
    }
  }
  const userRes = await gh('/user'); // fallback: the public profile email
  const user = userRes.ok ? await userRes.json() : {};
  if (looksLikeEmail(user.email)) return user.email;
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
  // suse (id.suse.com, Keycloak): require the `email` claim. Some IdP tenants
  // omit email_verified, so we reject only an explicit false rather than
  // demanding true. We do NOT
  // fall back to `preferred_username` - OIDC Core says it MAY be any string and
  // the RP must not treat it as verified or unique, so it must never become a
  // cert-bound identity. A tenant that only issues preferred_username should be
  // configured to release the `email` scope/claim instead.
  if (claims.email_verified === false) throw new Error('account email is not verified');
  if (!looksLikeEmail(claims.email)) throw new Error('id_token carries no verified email claim');
  return claims.email;
}
