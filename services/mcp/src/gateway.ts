// SPDX-License-Identifier: MPL-2.0
/**
 * The single (req, res) handler mounted both on Vercel (api/mcp/[...path].js, via
 * vercel-entry.ts) and by the standalone HTTP server (http.ts). It routes:
 *
 *   OPTIONS *                                     → CORS preflight
 *   GET  …/tool/<id>.<ext>                         → public render      (render-get.ts)
 *   GET  /.well-known/oauth-protected-resource    → resource metadata  (oauth.ts)
 *   GET  /.well-known/oauth-authorization-server   → AS metadata        (oauth.ts)
 *   POST …/register  …/authorize  …/token          → the OAuth flow     (oauth.ts)
 *   GET  …/authorize                               → consent page
 *   POST …/mcp  (or /api/mcp)                       → JSON-RPC dispatch  (server.ts)
 *
 * Routing is by path SUFFIX (…endsWith('/register') etc.), so it is robust to
 * however Vercel presents the path after the well-known rewrites, and to the
 * standalone `/mcp` mount. The JSON-RPC endpoint is gated by oauth.isAuthorized;
 * a 401 carries `WWW-Authenticate` pointing at the resource metadata, which is
 * what makes a spec client (claude.ai) begin the OAuth dance.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { allowedOrigin, validRequest, validateHttpHeaders, modernRequest } from './negotiation.ts';
import { ERR, fail, ok } from './protocol.ts';
import { dispatch } from './server.ts';
import type { JsonRpcRequest } from './protocol.ts';
import { matchRenderGetPath, renderGet } from './render-get.ts';
import { matchImageProxyPath, proxyImage } from './image-proxy.ts';
import {
  authorizationServerMetadata, authorizeGet, authorizePost, isAuthorized, openAccess,
  protectedResourceMetadata, register, signingSecret, token, type Result,
} from './oauth.ts';
import { createHash } from 'node:crypto';
import { createRateLimiter, RateLimitUnavailableError, type RateLimiter } from './rate-limit.ts';
import { budgetRefusal, createUsageBudget, type UsageBudget } from './usage-budget.ts';
import { LIVE_LIMITS } from '@lolly-tools/core';

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, mcp-session-id, mcp-protocol-version, mcp-method, mcp-name',
  // Expose the 401 challenge so a browser-side MCP client can read where to auth.
  'access-control-expose-headers': 'WWW-Authenticate',
};

export const MCP_BODY_MAX = 32 * 1024 * 1024; // room for base64 transform inputs
/** Vercel refuses a function response over 4.5 MB with a bare platform error, so
 *  on Vercel a larger JSON-RPC answer is replaced by one the agent can act on. */
export const VERCEL_MCP_RESPONSE_MAX = 4_400_000;
export const OAUTH_BODY_MAX = 64 * 1024;
const RATE_WINDOW_MS = 60_000;

export class BodyTooLargeError extends Error {
  readonly status = 413;
  readonly maxBytes: number;
  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = 'BodyTooLargeError';
    this.maxBytes = maxBytes;
  }
}

function materializedBody(pre: unknown, maxBytes: number): string {
  let raw: string;
  if (typeof pre === 'string') raw = pre;
  else if (Buffer.isBuffer(pre)) raw = pre.toString('utf8');
  else if (pre instanceof Uint8Array) raw = Buffer.from(pre).toString('utf8');
  else {
    const encoded = JSON.stringify(pre);
    if (typeof encoded !== 'string') throw new Error('Request body cannot be encoded as JSON');
    raw = encoded;
  }
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new BodyTooLargeError(maxBytes);
  return raw;
}

export function readBody(req: IncomingMessage, maxBytes = MCP_BODY_MAX): Promise<string> {
  // Vercel's Node helper may have pre-parsed the body. Some adapters retain
  // `.on()` after consuming the stream, so a present materialised body wins.
  const pre = (req as unknown as { body?: unknown }).body;
  if (pre !== undefined && pre !== null) {
    try { return Promise.resolve(materializedBody(pre, maxBytes)); }
    catch (error) { return Promise.reject(error); }
  }
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      reject(new BodyTooLargeError(maxBytes));
      return;
    }
    let size = 0; const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > maxBytes) { reject(new BodyTooLargeError(maxBytes)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Canonical public origin. Request Host/Forwarded headers are never reflected
 * into OAuth metadata or bearer challenges. Hosted mode requires configuration. */
export function publicOrigin(env: NodeJS.ProcessEnv): string {
  const configured = env.LOLLY_MCP_PUBLIC_ORIGIN?.trim();
  if (!configured) {
    if (env.VERCEL || env.LOLLY_MCP_HOSTED === '1' || env.NODE_ENV === 'production') {
      throw new Error('LOLLY_MCP_PUBLIC_ORIGIN is required in hosted/production mode');
    }
    const port = env.PORT == null || env.PORT.trim() === '' ? 8790 : Number(env.PORT);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be an integer between 1 and 65535');
    return `http://localhost:${port}`;
  }
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new Error('LOLLY_MCP_PUBLIC_ORIGIN must be an absolute URL origin'); }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('LOLLY_MCP_PUBLIC_ORIGIN must contain only scheme, host, and optional port');
  }
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback && env.NODE_ENV !== 'production')) {
    throw new Error('LOLLY_MCP_PUBLIC_ORIGIN must use https outside local development');
  }
  return url.origin;
}

/** Forwarded addresses are honored only through an explicitly enabled, exact
 * direct-proxy allowlist, or on Vercel, whose edge sets x-vercel-forwarded-for
 * and x-real-ip itself and overwrites any value a client sends. Invalid client
 * entries fall back to the socket peer. */
export function clientIp(req: IncomingMessage, env: NodeJS.ProcessEnv): string {
  const peer = req.socket?.remoteAddress || 'unknown';
  if (env.VERCEL) {
    for (const name of ['x-vercel-forwarded-for', 'x-real-ip']) {
      const value = String(req.headers[name] || '').split(',')[0]!.trim();
      if (isIP(value)) return value;
    }
  }
  if (env.LOLLY_MCP_TRUST_PROXY !== '1') return peer;
  const trusted = new Set((env.LOLLY_MCP_TRUSTED_PROXIES || '').split(',').map(v => v.trim()).filter(Boolean));
  if (!trusted.has(peer)) return peer;
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0]!.trim();
  return isIP(forwarded) ? forwarded : peer;
}

function send(res: ServerResponse, r: Result): void {
  const headers: Record<string, string> = { ...CORS, ...(r.headers || {}) };
  if (r.redirect) { res.writeHead(r.status, { ...headers, location: r.redirect }); res.end(); return; }
  if (r.json !== undefined) {
    headers['content-type'] = 'application/json; charset=utf-8';
    res.writeHead(r.status, headers); res.end(JSON.stringify(r.json)); return;
  }
  headers['content-type'] = 'text/html; charset=utf-8';
  res.writeHead(r.status, headers); res.end(r.html || ''); return;
}

const formToObject = (raw: string): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(raw));

function bodyFailure(error: unknown, description: string): Result {
  return error instanceof BodyTooLargeError
    ? { status: 413, json: { error: 'request_too_large', error_description: error.message } }
    : { status: 400, json: { error: 'invalid_request', error_description: description } };
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

async function limited(
  limiter: RateLimiter,
  scope: string,
  subject: string,
  limit: number,
): Promise<Result | null> {
  try {
    const result = await limiter.consume(scope, subject, limit, RATE_WINDOW_MS);
    return result.ok ? null : {
      status: 429,
      headers: { 'retry-after': String(result.retryAfter) },
      json: { error: 'rate_limited', error_description: 'Too many requests; retry later.' },
    };
  } catch (error) {
    if (!(error instanceof RateLimitUnavailableError)) throw error;
    return {
      status: 503,
      headers: { 'retry-after': '5' },
      json: { error: 'temporarily_unavailable', error_description: 'Request admission is temporarily unavailable.' },
    };
  }
}

/** The daily budget's answer as a refusal, or null to go ahead. */
async function overBudget(budget: UsageBudget): Promise<Result | null> {
  try {
    const state = await budget.check();
    return state.ok ? null : budgetRefusal(state);
  } catch (error) {
    if (!(error instanceof RateLimitUnavailableError)) throw error;
    return {
      status: 503,
      headers: { 'retry-after': '5' },
      json: { error: 'temporarily_unavailable', error_description: 'Request admission is temporarily unavailable.' },
    };
  }
}

export function createGateway(env: NodeJS.ProcessEnv = process.env): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  // Is the MCP configured to actually run on THIS deployment? It needs a shared
  // token / signing secret (or an explicit anonymous opt-in). A deployment with
  // none, for example a blank-brand deployment that carries no LOLLY_MCP_*
  // secrets, should not advertise an OAuth/discovery/registration
  // surface that can only dead-end. Return 404 for every route so the endpoint
  // cleanly doesn't exist.
  const mcpEnabled = !!signingSecret(env) || env.LOLLY_MCP_ALLOW_ANONYMOUS === '1';
  // The canonical origin is resolved once, here, never from request headers. A
  // hosted deployment that carries MCP secrets but no LOLLY_MCP_PUBLIC_ORIGIN
  // gets an MCP surface that answers 503 with the reason logged - not a function
  // that fails to boot and takes the public render route down with it (that is
  // what every lolly.tools function did on 2026-09-10).
  let base: string | null = null;
  let mcpUnavailable: string | null = null;
  if (mcpEnabled) {
    try { base = publicOrigin(env); }
    catch (error) {
      mcpUnavailable = (error as Error).message;
      console.error(`[mcp] ${mcpUnavailable} - the MCP surface answers 503 until it is set; the public render route is unaffected`);
    }
  }
  const limiter = createRateLimiter(env);
  // One daily ceiling on CPU and response bytes for every metered route here
  // (usage-budget.ts), so a public deployment's worst-case bill is known.
  const budget = createUsageBudget(env);
  const open = openAccess(env);
  return async (req, res) => {
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', 'http://internal');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path.endsWith('/mcp') && !allowedOrigin(req.headers.origin, base, env.LOLLY_MCP_ALLOWED_ORIGINS)) { res.writeHead(403, { 'content-type': 'application/json' }); res.end(JSON.stringify(fail(null, ERR.INVALID_REQUEST, 'Origin is not allowed'))); return; }
    if (method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

    // ── public GET render: /tool/<id>.<ext>?<query> ─────────────────────────
    // Deliberately OUTSIDE the mcpEnabled gate: it serves public tool+catalog
    // data with no auth and no user state, so it works on deployments that
    // carry no MCP secrets. Policy + refusals live in render-get.ts; self-
    // hosters disable the route entirely with LOLLY_DISABLE_RENDER_GET=1.
    if ((method === 'GET' || method === 'HEAD') && matchRenderGetPath(path)) {
      const r = await renderGet(path, url.search.replace(/^\?/, ''), {
        ip: clientIp(req, env),
        ifNoneMatch: req.headers['if-none-match'] as string | undefined,
        env,
        rateLimiter: limiter,
        budget,
      });
      res.writeHead(r.status, { ...CORS, ...r.headers });
      if (method === 'HEAD' || r.body === undefined) res.end();
      else res.end(typeof r.body === 'string' ? r.body : Buffer.from(r.body));
      return;
    }

    // ── public image proxy: /api/fetch-image?url=<remote image> ─────────────
    // Same policy shape as the render route (public, stateless, no MCP secrets):
    // fetches a caller-chosen image server-side so the web PWA's img-src 'self'
    // CSP can show it. SSRF-guarded + rate-limited in image-proxy.ts; a self-
    // hoster disables it with LOLLY_DISABLE_IMAGE_PROXY=1.
    if ((method === 'GET' || method === 'HEAD') && matchImageProxyPath(path)) {
      const r = await proxyImage(url, { ip: clientIp(req, env), env, rateLimiter: limiter, budget });
      res.writeHead(r.status, { ...CORS, ...r.headers });
      if (method === 'HEAD' || r.body === undefined) res.end();
      else res.end(typeof r.body === 'string' ? r.body : Buffer.from(r.body));
      return;
    }

    // The installed collaborator has no account-wide credential or active tab.
    // Every call supplies its own document capability and keeps the public limits.
    if (path === '/api/mcp/agents' || path === '/agents') {
      if (env.LOLLY_DISABLE_AGENT_CONNECTOR === '1') return send(res, { status: 404, json: { error: 'not_found' } });
      if (method !== 'POST') return send(res, { status: 405, headers: { allow: 'POST, OPTIONS' }, json: { error: 'method_not_allowed' } });
      const refusal = await limited(limiter, 'agents', clientIp(req, env), positiveInt(env.LOLLY_AGENT_RPM, 120))
        || await limited(limiter, 'agents-all', 'all', positiveInt(env.LOLLY_AGENT_GLOBAL_RPM, 1200))
        || await overBudget(budget);
      if (refusal) return send(res, refusal);
      if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return send(res, { status: 415, json: { error: 'Use application/json.' } });
      let message: unknown;
      try { message = JSON.parse(await readBody(req, LIVE_LIMITS.maxRequestBytes)); }
      catch (error) { return send(res, bodyFailure(error, 'body is not JSON')); }
      if (!validRequest(message)) return send(res, { status: 400, json: fail(null, ERR.INVALID_REQUEST, 'Invalid JSON-RPC request') });
      const headerError = validateHttpHeaders(message, req.headers);
      if (headerError) return send(res, { status: 400, json: headerError });
      const response = await dispatch(message, { invitedLive: true, protocolVersion: typeof req.headers['mcp-protocol-version'] === 'string' ? req.headers['mcp-protocol-version'] : undefined });
      if (!response) { await budget.record(0); res.writeHead(202, { ...CORS, 'cache-control': 'no-store' }); res.end(); return; }
      let body = JSON.stringify(response);
      if (env.VERCEL && Buffer.byteLength(body) > VERCEL_MCP_RESPONSE_MAX) body = JSON.stringify(ok(message.id ?? null, { isError: true, content: [{ type: 'text', text: 'Read fewer layers or fields, or request a smaller preview. This result exceeds the hosted response limit.' }] }));
      await budget.record(Buffer.byteLength(body));
      res.writeHead(200, { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(body); return;
    }

    if (!mcpEnabled) {
      res.writeHead(404, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
    if (mcpUnavailable || base === null) {
      res.writeHead(503, { ...CORS, 'content-type': 'application/json', 'retry-after': '60' });
      res.end(JSON.stringify({ error: 'temporarily_unavailable', error_description: 'The MCP surface is not configured on this deployment.' }));
      return;
    }

    // `base` was parsed once when the gateway was constructed. It never depends
    // on attacker-controlled Host/Forwarded request headers.
    const publicBase = base;

    // Open access has no OAuth surface: every caller is admitted, so discovery
    // and the consent flow would only send a client down a dead end.
    if (open && !path.endsWith('/mcp')) {
      res.writeHead(404, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found', path }));
      return;
    }

    // ── discovery (GET) ──────────────────────────────────────────────────────
    if (method === 'GET' && path.includes('oauth-authorization-server')) return send(res, authorizationServerMetadata(publicBase));
    if (method === 'GET' && path.includes('oauth-protected-resource')) return send(res, protectedResourceMetadata(publicBase));

    // ── OAuth endpoints ──────────────────────────────────────────────────────
    if (path.endsWith('/register')) {
      if (method !== 'POST') return send(res, { status: 405, headers: { allow: 'POST' }, json: { error: 'method_not_allowed' } });
      const refusal = await limited(limiter, 'oauth', clientIp(req, env), positiveInt(env.LOLLY_OAUTH_RPM, 30));
      if (refusal) return send(res, refusal);
      let body: Record<string, unknown> = {};
      try { body = JSON.parse((await readBody(req, OAUTH_BODY_MAX)) || '{}'); }
      catch (error) { return send(res, bodyFailure(error, 'body is not JSON')); }
      return send(res, await register(body, env));
    }
    if (path.endsWith('/authorize')) {
      const refusal = await limited(limiter, 'oauth', clientIp(req, env), positiveInt(env.LOLLY_OAUTH_RPM, 30));
      if (refusal) return send(res, refusal);
      const q = Object.fromEntries(url.searchParams) as Record<string, string>;
      if (method === 'GET') return send(res, await authorizeGet(q, env));
      if (method === 'POST') {
        let form: Record<string, string>;
        try { form = formToObject(await readBody(req, OAUTH_BODY_MAX)); }
        catch (error) { return send(res, bodyFailure(error, 'could not read request body')); }
        return send(res, await authorizePost({ ...q, ...form }, env, publicBase));
      }
      return send(res, { status: 405, headers: { allow: 'GET, POST' }, json: { error: 'method_not_allowed' } });
    }
    if (path.endsWith('/token')) {
      if (method !== 'POST') return send(res, { status: 405, headers: { allow: 'POST' }, json: { error: 'method_not_allowed' } });
      const refusal = await limited(limiter, 'oauth', clientIp(req, env), positiveInt(env.LOLLY_OAUTH_RPM, 30));
      if (refusal) return send(res, refusal);
      let form: Record<string, string>;
      try { form = formToObject(await readBody(req, OAUTH_BODY_MAX)); }
      catch (error) { return send(res, bodyFailure(error, 'could not read request body')); }
      return send(res, await token(form, env));
    }

    // ── the MCP JSON-RPC endpoint ────────────────────────────────────────────
    if (path.endsWith('/mcp')) {
      if (method !== 'POST') { res.writeHead(405, { ...CORS, allow: 'POST, OPTIONS' }); res.end(); return; }
      if (!(await isAuthorized(req.headers['authorization'] as string | undefined, env))) {
        res.writeHead(401, {
          ...CORS,
          'content-type': 'application/json',
          'www-authenticate': `Bearer resource_metadata="${publicBase}/.well-known/oauth-protected-resource"`,
        });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } }));
        return;
      }
      const auth = String(req.headers['authorization'] || 'anonymous');
      // With open access any header is admitted, so a header-keyed budget would
      // be a fresh budget per invented header. The caller's address is the key.
      const principal = open
        ? `ip:${clientIp(req, env)}`
        : createHash('sha256').update(auth).digest('hex');
      const refusal = await limited(limiter, 'mcp', principal, positiveInt(env.LOLLY_MCP_RPM, open ? 60 : 120));
      if (refusal) return send(res, refusal);
      const spent = await overBudget(budget);
      if (spent) return send(res, spent);
      let raw: string;
      try { raw = await readBody(req, MCP_BODY_MAX); }
      catch (error) {
        if (error instanceof BodyTooLargeError) {
          res.writeHead(413, { ...CORS, 'content-type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32002, message: 'Request body too large' } }));
          return;
        }
        res.writeHead(400, { ...CORS, 'content-type': 'application/json' }); res.end(); return;
      }
      let msg: JsonRpcRequest;
      try { msg = JSON.parse(raw || 'null') as JsonRpcRequest; }
      catch { res.writeHead(200, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })); return; }
      // Private resources are opt-in for long-lived hosts, never a shared anonymous
      // bucket. Scope uses the already-verified bearer hash, not caller JSON.
      if (!validRequest(msg)) { res.writeHead(400, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify(fail(null, ERR.INVALID_REQUEST, 'Invalid JSON-RPC request'))); return; }
      const protocolVersion = typeof req.headers['mcp-protocol-version'] === 'string' ? req.headers['mcp-protocol-version'] : undefined;
      const modern = modernRequest(msg, protocolVersion);
      const headerError = msg.id === undefined ? null : validateHttpHeaders(msg, req.headers);
      if (headerError) { res.writeHead(400, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify(headerError)); return; }
      if (modern && !String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) { res.writeHead(415, CORS); res.end(); return; }
      const response = await dispatch(msg, { protocolVersion, fileScope: env.LOLLY_MCP_PRIVATE_FILES === '1' && env.LOLLY_MCP_TOKEN?.trim() && !env.VERCEL && auth !== 'anonymous' ? principal : undefined });
      if (!response) { await budget.record(0); res.writeHead(202, CORS); res.end(); return; } // notification
      const status = modern && response.error ? response.error.code === ERR.METHOD_NOT_FOUND ? 404 : new Set<number>([ERR.HEADER_MISMATCH, ERR.MISSING_CAPABILITY, ERR.UNSUPPORTED_VERSION, ERR.INVALID_PARAMS]).has(response.error.code) ? 400 : 200 : 200;
      let body = JSON.stringify(response);
      if (env.VERCEL && Buffer.byteLength(body) > VERCEL_MCP_RESPONSE_MAX) {
        const mb = (Buffer.byteLength(body) / 1e6).toFixed(1);
        const message = `The result is ${mb} MB, over the ${VERCEL_MCP_RESPONSE_MAX / 1e6} MB this hosted endpoint can return. Ask for svg, a smaller size, or run Lolly locally for large files.`;
        // A tool call answers with a tool error the agent reads; anything else with a JSON-RPC error.
        body = JSON.stringify(msg.method === 'tools/call'
          ? ok(response.id ?? null, { content: [{ type: 'text', text: message }], isError: true })
          : fail(response.id ?? null, ERR.INTERNAL, message));
      }
      // Recorded before the response ends: a platform may freeze the function
      // once the body is sent, and an unrecorded render is an unmetered one.
      await budget.record(Buffer.byteLength(body));
      res.writeHead(status, { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(body);
      return;
    }

    res.writeHead(404, { ...CORS, 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found', path }));
  };
}
