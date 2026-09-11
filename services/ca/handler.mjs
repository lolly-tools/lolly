// SPDX-License-Identifier: MPL-2.0
/**
 * The Lolly CA HTTP handler - one (req, res) function that runs three ways:
 * `node services/ca/server.mjs` locally, api/ca/[...path].js on Vercel, and
 * imported by tests (route logic is exported per-route so pure results are
 * testable without a socket).
 *
 * Routing is always on the full /api/ca/... path - the Vite dev proxy
 * preserves the prefix and Vercel mounts the function there:
 *
 *   GET  /api/ca/health
 *   GET  /api/ca/root.pem
 *   GET  /api/ca/auth/:provider?origin=
 *   GET  /api/ca/callback/:provider?code&state
 *   POST /api/ca/email/start   { email, origin }
 *   POST /api/ca/enroll        { token, spki, pop, days? }
 *
 * Route functions return { status, headers?, json? | body?, type? } and
 * writeResult() serialises - no res access inside route logic.
 */

import { buildAuthorizeUrl, configuredProviders, fetchVerifiedEmail, looksLikeEmail, OAUTH_PROVIDERS } from './lib/oidc.mjs';
import { isIP } from 'node:net';
import { mintEnrollToken, randomB64u, signValue, verifyValue } from './lib/tokens.mjs';
import { completionPage, errorPage } from './lib/pages.mjs';
import { enroll } from './lib/enroll.mjs';
import { createRateLimiter, RateLimitUnavailableError } from './lib/rate-limit.mjs';

const STATE_COOKIE = 'lolly_ca_state';
const STATE_TTL_SECONDS = 600;
// The completion page's BroadcastChannel only reaches the app when BOTH ends
// share the same cross-origin-isolation status (same-origin channels are
// partitioned by it) - the web shell ships COOP/COEP (plans/127), so the
// popup's completion page must match. Harmless on non-isolated deployments.
const ISOLATION_HEADERS = {
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-embedder-policy': 'credentialless',
};
const BODY_CAP = 64 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const STATE_TYP = 'lolly-ca/state'; // domain-separation tag (see tokens.mjs TOKEN_TYP)

// Local belt beneath the durable limiter: collapse repeated sends to one address
// inside a warm instance as well, before consuming provider quota.
const EMAIL_COOLDOWN_MS = 60 * 1000;
const lastEmailAt = new Map();
function emailOnCooldown(email, now) {
  // Opportunistic prune so the map can't grow unbounded on a long-lived instance.
  if (lastEmailAt.size > 5000) {
    for (const [k, t] of lastEmailAt) if (now - t > EMAIL_COOLDOWN_MS) lastEmailAt.delete(k);
  }
  const prev = lastEmailAt.get(email);
  return prev !== undefined && now - prev < EMAIL_COOLDOWN_MS;
}

// A second local belt caps address-list walking inside one warm instance. The
// durable limiter below is authoritative across instances.
const IP_WINDOW_MS = 60 * 1000;
const IP_MAX_PER_WINDOW = 5;
const ipHits = new Map();
function ipRateLimited(ip, now) {
  if (!ip) return false; // no usable client IP - lean on the per-address cooldown
  // Opportunistic prune so the map can't grow unbounded on a long-lived instance.
  if (ipHits.size > 5000) {
    for (const [k, hits] of ipHits) if (!hits.some((t) => now - t < IP_WINDOW_MS)) ipHits.delete(k);
  }
  const recent = (ipHits.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  ipHits.set(ip, recent);
  if (recent.length >= IP_MAX_PER_WINDOW) return true;
  recent.push(now);
  return false;
}

// ─── origin allowlist ─────────────────────────────────────────────────────────

/**
 * The popup/postMessage target and magic-link base must be ours. This is a
 * security check on the origin/redirect PARAMS, not CORS - the app is
 * same-origin with the service in both dev (Vite proxy) and prod (Vercel).
 * With the dev fake provider on, any http://localhost:* origin is allowed so
 * local setups need no env.
 */
export function isAllowedOrigin(origin, env) {
  if (!origin || typeof origin !== 'string') return false;
  const list = String(env.CA_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  if (env.CA_DEV_FAKE_PROVIDER === '1' && /^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

// ─── routes ───────────────────────────────────────────────────────────────────

export function routeHealth(env) {
  return {
    status: 200,
    json: {
      ok: true,
      devProvider: env.CA_DEV_FAKE_PROVIDER === '1',
      configured: configuredProviders(env),
    },
  };
}

export function routeRootPem(env) {
  if (!env.CA_ROOT_CERT_PEM) {
    return { status: 404, body: 'CA root certificate is not configured on this deployment\n', type: 'text/plain; charset=utf-8' };
  }
  return { status: 200, body: `${String(env.CA_ROOT_CERT_PEM).trim()}\n`, type: 'text/plain; charset=utf-8' };
}

const stateCookie = (value, redirectUri, maxAge = STATE_TTL_SECONDS) =>
  `${STATE_COOKIE}=${value}; Max-Age=${maxAge}; Path=/api/ca; HttpOnly; SameSite=Lax${String(redirectUri).startsWith('https') ? '; Secure' : ''}`;

/**
 * Start OIDC. 'dev' (only with CA_DEV_FAKE_PROVIDER=1) skips OAuth entirely
 * and answers with the completion page for dev@example.com; real providers
 * get a signed HttpOnly state cookie and a 302 to their authorize URL.
 */
export async function routeAuth(env, { provider, origin, redirectUri }) {
  if (!isAllowedOrigin(origin, env)) return { status: 403, json: { error: 'origin is not allowlisted' } };
  if (provider === 'dev') {
    if (env.CA_DEV_FAKE_PROVIDER !== '1') return { status: 404, json: { error: 'unknown provider' } };
    const token = await mintEnrollToken({ email: 'dev@example.com', provider: 'dev' }, env.CA_SERVICE_SECRET);
    return { status: 200, body: completionPage({ token, origin }), type: 'text/html; charset=utf-8', headers: ISOLATION_HEADERS };
  }
  if (!OAUTH_PROVIDERS.includes(provider)) return { status: 404, json: { error: 'unknown provider' } };
  if (!configuredProviders(env)[provider]) return { status: 501, json: { error: `${provider} sign-in is not configured on this deployment` } };
  const nonce = randomB64u(24); // doubles as the OAuth state param + OIDC nonce claim
  const pkceVerifier = randomB64u(48); // 64 chars - inside RFC 7636's 43–128
  const state = { typ: STATE_TYP, provider, origin, pkceVerifier, nonce, exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS };
  const location = await buildAuthorizeUrl(provider, env, { redirectUri, state: nonce, nonce, pkceVerifier });
  return {
    status: 302,
    headers: {
      location,
      'set-cookie': stateCookie(await signValue(state, env.CA_SERVICE_SECRET), redirectUri),
    },
  };
}

/**
 * Finish OIDC: state cookie must verify, match the provider and the echoed
 * state param, and still be fresh; then the code is exchanged server-side
 * for a VERIFIED email, which becomes a 10-minute enrollment token handed to
 * the opener via postMessage. Failures render a human-readable page - this
 * runs in a popup, not an API client.
 */
export async function routeCallback(env, { provider, query, cookieHeader, redirectUri }) {
  const clear = { 'set-cookie': stateCookie('', redirectUri, 0) };
  const fail = (status, message) => ({ status, body: errorPage(message), type: 'text/html; charset=utf-8', headers: clear });
  const state = await verifyValue(parseCookies(cookieHeader)[STATE_COOKIE], env.CA_SERVICE_SECRET);
  if (!state || state.typ !== STATE_TYP) return fail(401, 'The sign-in state is missing or invalid. Start again from Lolly.');
  if (typeof state.exp !== 'number' || state.exp * 1000 < Date.now()) return fail(401, 'The sign-in attempt expired - it only lives 10 minutes.');
  if (state.provider !== provider) return fail(400, 'The sign-in state does not match this provider.');
  if (!query.state || query.state !== state.nonce) return fail(400, 'The sign-in state does not match this browser.');
  if (!query.code) return fail(400, query.error_description || query.error || 'The provider returned no authorization code.');
  let email;
  try {
    email = await fetchVerifiedEmail(provider, env, {
      code: query.code,
      redirectUri,
      pkceVerifier: state.pkceVerifier,
      nonce: state.nonce,
    });
  } catch (err) {
    return fail(401, err?.message || 'Could not verify your email with the provider.');
  }
  const token = await mintEnrollToken({ email, provider }, env.CA_SERVICE_SECRET);
  return { status: 200, body: completionPage({ token, origin: state.origin }), type: 'text/html; charset=utf-8', headers: { ...clear, ...ISOLATION_HEADERS } };
}

/** Magic-link start: mint a token for { email, provider: 'email' } and send it via Resend. */
export async function routeEmailStart(env, body, ip) {
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const origin = body?.origin;
  if (!isAllowedOrigin(origin, env)) return { status: 403, json: { error: 'origin is not allowlisted' } };
  if (!looksLikeEmail(email)) return { status: 400, json: { error: 'invalid email address' } };
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return { status: 501, json: { error: 'email sign-in is not configured on this deployment (RESEND_API_KEY / EMAIL_FROM)' } };
  }
  // Collapse repeat requests for the same address to one send per window. Return
  // the normal success shape (never reveal whether a mail actually went out) so
  // this can't be used to probe which addresses were recently requested.
  const now = Date.now();
  if (emailOnCooldown(email, now)) return { status: 200, json: { sent: true } };
  // Then cap total sends per client IP so one host can't email-bomb a whole list
  // of distinct addresses (each of which sails past the per-address cooldown).
  // Checked after the cooldown so repeat requests for one address don't burn the
  // IP budget. An attacker hitting this is fine to tell - no victim info leaks.
  if (ipRateLimited(ip, now)) return { status: 429, json: { error: 'too many requests, please try again shortly' } };
  lastEmailAt.set(email, now);
  // The lifetime choice rides the token itself: the magic link may be opened
  // long after this request (even in another tab), so a POST-body `days` at
  // /enroll time would be lost. leafDays() clamps it at issuance either way.
  const days = Number(body?.days);
  const token = await mintEnrollToken(
    { email, provider: 'email', ...(Number.isFinite(days) ? { days } : {}) },
    env.CA_SERVICE_SECRET,
  );
  const link = `${origin}/#/profile?enrollToken=${encodeURIComponent(token)}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: 'Verify your email for Lolly Content Credentials',
      text: `Open this link in the browser where Lolly is open (it expires in 10 minutes):\n\n${link}\n\nIf you didn't request this, ignore this email.`,
    }),
  });
  if (!res.ok) {
    // Status only. The provider's error body echoes the recipient address back,
    // so logging it would put the very email we're trying not to retain into the
    // host's function logs on every bounced send.
    console.error('verification email send failed, status', res.status);
    return { status: 502, json: { error: 'sending the verification email failed' } };
  }
  return { status: 200, json: { sent: true } };
}

// ─── plumbing ─────────────────────────────────────────────────────────────────

// Forwarded identity is trusted only through an explicitly enabled, exact
// direct-proxy allowlist. This matches the MCP gateway: otherwise a caller can
// mint rate-limit identities by sending arbitrary X-Forwarded-For values.
function clientIp(req, env) {
  const peer = req.socket?.remoteAddress || '';
  if (env.CA_TRUST_PROXY !== '1') return peer;
  const trusted = new Set(String(env.CA_TRUSTED_PROXIES || '').split(',').map((value) => value.trim()).filter(Boolean));
  if (!trusted.has(peer)) return peer;
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return isIP(forwarded) ? forwarded : peer;
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

// https://host/api/ca/callback/:provider from the request itself. Behind the
// Vite proxy the Host header is the Vite origin - correct, because the popup
// goes through the proxy too. Vercel sets x-forwarded-proto.
function redirectUriFor(req, provider) {
  const host = String(req.headers.host || 'localhost');
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwarded || (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}/api/ca/callback/${provider}`;
}

// JSON body with a 64 KB cap. Vercel's Node helpers may have pre-parsed the
// body onto req.body; the raw-stream path covers server.mjs and tests.
async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
      try { return JSON.parse(String(req.body)); } catch { return null; }
    }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_CAP) throw Object.assign(new Error('request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'); } catch { return null; }
}

function writeResult(res, result, cors = {}) {
  const headers = { ...cors, ...(result.headers || {}) };
  let body;
  if (result.json !== undefined) {
    headers['content-type'] = 'application/json; charset=utf-8';
    body = JSON.stringify(result.json);
  } else {
    headers['content-type'] = result.type || 'text/html; charset=utf-8';
    body = result.body || '';
  }
  if (!headers['cache-control']) headers['cache-control'] = 'no-store';
  res.writeHead(result.status, headers);
  res.end(body);
}

const positiveInt = (raw, fallback) => {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

async function admission(limiter, scope, subject, limit) {
  try {
    const result = await limiter.consume(scope, subject || 'unknown', limit, RATE_WINDOW_MS);
    return result.ok ? null : {
      status: 429,
      headers: { 'retry-after': String(result.retryAfter) },
      json: { error: 'too many requests, please try again shortly' },
    };
  } catch (error) {
    if (!(error instanceof RateLimitUnavailableError)) throw error;
    return {
      status: 503,
      headers: { 'retry-after': '5' },
      json: { error: 'request admission is temporarily unavailable' },
    };
  }
}

async function route(env, req, url, path, limiter) {
  const m = req.method;
  if (m === 'GET' && path === '/api/ca/health') return routeHealth(env);
  if (m === 'GET' && path === '/api/ca/root.pem') return routeRootPem(env);
  const auth = m === 'GET' && path.match(/^\/api\/ca\/auth\/([a-z0-9_-]+)$/);
  if (auth) {
    const refusal = await admission(limiter, 'auth', clientIp(req, env), positiveInt(env.CA_AUTH_RPM, 30));
    if (refusal) return refusal;
    return routeAuth(env, {
      provider: auth[1],
      origin: url.searchParams.get('origin'),
      redirectUri: redirectUriFor(req, auth[1]),
    });
  }
  const cb = m === 'GET' && path.match(/^\/api\/ca\/callback\/([a-z0-9_-]+)$/);
  if (cb) {
    const refusal = await admission(limiter, 'callback', clientIp(req, env), positiveInt(env.CA_AUTH_RPM, 30));
    if (refusal) return refusal;
    return routeCallback(env, {
      provider: cb[1],
      query: Object.fromEntries(url.searchParams),
      cookieHeader: req.headers.cookie,
      redirectUri: redirectUriFor(req, cb[1]),
    });
  }
  if (m === 'POST' && (path === '/api/ca/email/start' || path === '/api/ca/enroll')) {
    const ip = clientIp(req, env);
    const routeLimit = path === '/api/ca/enroll'
      ? positiveInt(env.CA_ENROLL_RPM, 30)
      : positiveInt(env.CA_EMAIL_RPM, 5);
    const refusal = await admission(limiter, path.endsWith('/enroll') ? 'enroll' : 'email-ip', ip, routeLimit);
    if (refusal) return refusal;
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      return { status: err.statusCode || 400, json: { error: err.message } };
    }
    if (path === '/api/ca/enroll') return enroll(body || {}, env);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : 'invalid';
    const emailRefusal = await admission(limiter, 'email-address', email, positiveInt(env.CA_EMAIL_PER_ADDRESS_RPM, 1));
    return emailRefusal ?? routeEmailStart(env, body || {}, ip);
  }
  return { status: 404, json: { error: 'not found' } };
}

/** Build the Node (req, res) handler over a given env (process.env by default). */
export function createCaHandler(env = process.env) {
  // Is the CA configured to actually run on THIS deployment? It needs its
  // service secret and/or root key. A deployment with neither - e.g. a
  // blank-brand deployment with no CA_* secrets - should not
  // serve a CA surface (health/root.pem/enroll) that can only dead-end; 404
  // every route so the endpoint cleanly doesn't exist.
  const caEnabled = !!(env.CA_SERVICE_SECRET || env.CA_ROOT_KEY_PEM);
  const limiter = caEnabled ? createRateLimiter(env) : null;
  return async function caHandler(req, res) {
    try {
      const url = new URL(req.url, 'http://internal');
      const path = url.pathname.replace(/\/+$/, '') || '/';
      if (!caEnabled) {
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'not_found' }));
        return;
      }
      // Belt-and-braces CORS: same-origin in practice, so only allowlisted
      // origins are ever echoed. The origin/redirect PARAM checks above are
      // the real gate.
      const requestOrigin = req.headers.origin;
      const cors = isAllowedOrigin(requestOrigin, env)
        ? { 'access-control-allow-origin': requestOrigin, vary: 'Origin' }
        : {};
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { ...cors, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' });
        res.end();
        return;
      }
      writeResult(res, await route(env, req, url, path, limiter), cors);
    } catch (err) {
      // Message only, never the error object: a stack or a fetch error can carry
      // the request URL, and enrollment URLs carry a short-lived (10-minute)
      // stateless HMAC token - time-bounded, not single-use.
      console.error('ca handler error:', err?.message || 'unknown');
      try {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'internal error' }));
      } catch { /* headers already sent */ }
    }
  };
}
