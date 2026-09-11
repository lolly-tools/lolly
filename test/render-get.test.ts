// SPDX-License-Identifier: MPL-2.0
/**
 * The public GET render endpoint (src/render-get.ts) - the scoped-v1 policy:
 * Tier-A + resvg-png formats, official/community tools only, c2pa off, cacheable
 * (ETag/304), best-effort per-IP rate limit, LOLLY_DISABLE_RENDER_GET kill switch.
 * Driven through renderGet() directly (browser-free), plus one pass through the
 * gateway to prove the /tool/<id>.<ext> routing + CORS.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { renderGet, matchRenderGetPath, _resetRenderGetCaches, MAX_RASTER_PIXELS } from '../src/render-get.ts';
import { loadIndex } from '../src/catalog.ts';
import { createGateway } from '../src/gateway.ts';
import { MemoryRateLimiter, RateLimitUnavailableError, type RateLimiter } from '../src/rate-limit.ts';

const env = {} as NodeJS.ProcessEnv;
let ipSeq = 0;
const ip = (): string => `10.0.0.${++ipSeq}`;

/** A limiter that admits everything and counts what it was asked to admit. */
function countingLimiter(): RateLimiter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async consume(scope, subject) { calls.push(`${scope}:${subject}`); return { ok: true, retryAfter: 0, remaining: 1 }; },
  };
}

test('path matcher accepts the embed shape and nothing else', () => {
  assert.deepEqual(matchRenderGetPath('/tool/qr-code.svg'), { toolId: 'qr-code', ext: 'svg' });
  assert.deepEqual(matchRenderGetPath('/api/mcp/tool/qr-code.png'), { toolId: 'qr-code', ext: 'png' });
  assert.equal(matchRenderGetPath('/tool/qr-code'), null);        // pretty path stays SPA-owned
  assert.equal(matchRenderGetPath('/tool/QR.svg'), null);         // id grammar is lowercase
  assert.equal(matchRenderGetPath('/api/mcp'), null);
});

test('happy path: svg render carries bytes + the cache/robots headers', async () => {
  const r = await renderGet('/tool/qr-code.svg', 'url=https%3A%2F%2Fsuse.com', { ip: ip(), env });
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type']!, /^image\/svg\+xml/);
  assert.equal(r.headers['cache-control'], 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
  assert.match(r.headers['etag']!, /^"[0-9a-f]{32}"$/);
  assert.equal(r.headers['x-robots-tag'], 'noindex');
  assert.equal(r.headers['content-security-policy'], 'sandbox');
  const text = new TextDecoder().decode(r.body as Uint8Array);
  assert.match(text, /<svg/);
});

test('happy path: png via the resvg fast-path (no browser)', async () => {
  const r = await renderGet('/tool/qr-code.png', 'url=https%3A%2F%2Fsuse.com&width=128', { ip: ip(), env });
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'image/png');
  const bytes = r.body as Uint8Array;
  assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'PNG magic');
});

test('ETag is stable for a URL and If-None-Match yields 304', async () => {
  const q = 'url=https%3A%2F%2Fsuse.com';
  const a = await renderGet('/tool/qr-code.svg', q, { ip: ip(), env });
  const b = await renderGet('/tool/qr-code.svg', q, { ip: ip(), env });
  assert.equal(a.headers['etag'], b.headers['etag']);
  const cached = await renderGet('/tool/qr-code.svg', q, { ip: ip(), ifNoneMatch: a.headers['etag'], env });
  assert.equal(cached.status, 304);
  assert.equal(cached.body, undefined);
  assert.equal(cached.headers['etag'], a.headers['etag']);
});

test('unknown tool is a 404', async () => {
  const r = await renderGet('/tool/no-such-tool-xyz.svg', '', { ip: ip(), env });
  assert.equal(r.status, 404);
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('a non-official/community tool is the same 404 (no existence leak)', async () => {
  const { tools } = await loadIndex();
  const exp = tools.find(t => t.status === 'experimental');
  assert.ok(exp, 'active catalog should carry at least one experimental tool');
  const r = await renderGet(`/tool/${exp!.id}.svg`, '', { ip: ip(), env });
  assert.equal(r.status, 404);
  assert.equal(r.body, JSON.stringify({ error: 'not_found' }));
});

test('formats outside Tier-A + resvg-png are refused with a 400', async () => {
  const r = await renderGet('/tool/qr-code.mp4', '', { ip: ip(), env });
  assert.equal(r.status, 400);
  assert.match(String(r.body), /browser render tier/);
});

test('bad queries are honest 400s (oversize dims, oversize query)', async () => {
  const big = await renderGet('/tool/qr-code.svg', 'width=999999', { ip: ip(), env });
  assert.equal(big.status, 400);
  assert.match(String(big.body), /output cap/);

  const long = await renderGet('/tool/qr-code.svg', `url=${'a'.repeat(5000)}`, { ip: ip(), env });
  assert.equal(long.status, 400);
  assert.match(String(long.body), /Query too long/);
});

test('LOLLY_DISABLE_RENDER_GET=1 turns the whole route into 404s', async () => {
  const off = { LOLLY_DISABLE_RENDER_GET: '1' } as NodeJS.ProcessEnv;
  const r = await renderGet('/tool/qr-code.svg', 'url=https%3A%2F%2Fsuse.com', { ip: ip(), env: off });
  assert.equal(r.status, 404);
});

test('per-IP rate limit answers 429 with Retry-After once the window fills', async () => {
  const limited = { LOLLY_RENDER_GET_RPM: '1' } as NodeJS.ProcessEnv;
  const me = ip();
  // Only RENDERS are limited: a repeat the instance memoised would be served
  // outside the limit, so each call here asks for a URL nobody has rendered yet.
  _resetRenderGetCaches();
  const first = await renderGet('/tool/qr-code.svg', 'url=https%3A%2F%2Fsuse.com%2Fa', { ip: me, env: limited });
  assert.equal(first.status, 200);
  const second = await renderGet('/tool/qr-code.svg', 'url=https%3A%2F%2Fsuse.com%2Fb', { ip: me, env: limited });
  assert.equal(second.status, 429);
  assert.ok(Number(second.headers['retry-after']) >= 1, 'carries Retry-After seconds');
  // …and another client is unaffected.
  const other = await renderGet('/tool/qr-code.svg', 'url=https%3A%2F%2Fsuse.com%2Fc', { ip: ip(), env: limited });
  assert.equal(other.status, 200);
});

test('a repeat of a URL this instance rendered is served from the memo, outside the limits', async () => {
  _resetRenderGetCaches();
  const limiter = countingLimiter();
  const q = 'url=https%3A%2F%2Fsuse.com%2Fmemo';
  const first = await renderGet('/tool/qr-code.svg', q, { ip: ip(), env, rateLimiter: limiter });
  assert.equal(first.status, 200);
  assert.deepEqual(limiter.calls.map(c => c.split(':')[0]), ['render', 'render-all'], 'one render = one per-address and one global admission');
  const again = await renderGet('/tool/qr-code.svg', q, { ip: ip(), env, rateLimiter: limiter });
  assert.equal(again.status, 200);
  assert.equal(limiter.calls.length, 2, 'the repeat asked the limiter for nothing');
  const { etag: firstTag } = first.headers;
  const { etag: againTag } = again.headers;
  assert.equal(againTag, firstTag);
  assert.deepEqual(again.body, first.body, 'the exact bytes of the first render');
});

test('identical requests in flight share one render', async () => {
  _resetRenderGetCaches();
  const limiter = countingLimiter();
  const q = 'url=https%3A%2F%2Fsuse.com%2Fcoalesce';
  const [a, b, c] = await Promise.all([
    renderGet('/tool/qr-code.svg', q, { ip: ip(), env, rateLimiter: limiter }),
    renderGet('/tool/qr-code.svg', q, { ip: ip(), env, rateLimiter: limiter }),
    renderGet('/tool/qr-code.svg', q, { ip: ip(), env, rateLimiter: limiter }),
  ]);
  assert.deepEqual([a.status, b.status, c.status], [200, 200, 200]);
  assert.equal(limiter.calls.filter(x => x.startsWith('render:')).length, 1, 'one render admitted for three identical requests');
  assert.deepEqual(b.body, a.body);
  assert.deepEqual(c.body, a.body);
});

test('a joiner whose leader was refused admits itself rather than inheriting the refusal', async () => {
  _resetRenderGetCaches();
  // The leader's address is over quota; the joiner's is not. Both ask for the
  // same URL at the same moment.
  let calls = 0;
  const limiter: RateLimiter = {
    async consume(scope, subject) {
      calls++;
      const ok = !(scope === 'render' && subject === 'leader');
      return { ok, retryAfter: ok ? 0 : 7, remaining: 0 };
    },
  };
  const q = 'url=https%3A%2F%2Fsuse.com%2Fjoiner';
  const [leader, joiner] = await Promise.all([
    renderGet('/tool/qr-code.svg', q, { ip: 'leader', env, rateLimiter: limiter }),
    renderGet('/tool/qr-code.svg', q, { ip: 'joiner', env, rateLimiter: limiter }),
  ]);
  assert.equal(leader.status, 429);
  assert.equal(joiner.status, 200, 'the joiner rendered on its own admission');
  assert.equal(calls, 3, 'leader: 1 refused; joiner: per-address + global');
});

test('the global render budget answers 429 across addresses', async () => {
  _resetRenderGetCaches();
  // Its own limiter: the module-level one has counted every render above.
  const limiter = new MemoryRateLimiter();
  const limited = { LOLLY_RENDER_GET_GLOBAL_RPM: '1' } as NodeJS.ProcessEnv;
  const first = await renderGet('/tool/qr-code.svg', 'url=https%3A%2F%2Fsuse.com%2Fg1', { ip: ip(), env: limited, rateLimiter: limiter });
  assert.equal(first.status, 200);
  const second = await renderGet('/tool/qr-code.svg', 'url=https%3A%2F%2Fsuse.com%2Fg2', { ip: ip(), env: limited, rateLimiter: limiter });
  assert.equal(second.status, 429, 'a different address, a different URL - the shared budget is spent');
  assert.match(JSON.parse(second.body as string).error, /busy/);
  assert.ok(Number(second.headers['retry-after']) >= 1);
});

test('a png raster is bounded by area, not just by edge', async () => {
  // 5000 x 5000 passes the 10000px edge cap and is still 25 MP - over the budget.
  const r = await renderGet('/tool/qr-code.png', 'url=https%3A%2F%2Fsuse.com&width=5000&height=5000', { ip: ip(), env });
  assert.equal(r.status, 400);
  assert.match(JSON.parse(r.body as string).error, /raster cap/);
  assert.ok(MAX_RASTER_PIXELS < 5000 * 5000);
  // The same size as svg is text, not a raster: allowed.
  const svg = await renderGet('/tool/qr-code.svg', 'url=https%3A%2F%2Fsuse.com&width=5000&height=5000', { ip: ip(), env });
  assert.equal(svg.status, 200);
});

test('an unconfigured hosted limiter answers 503 + Retry-After instead of crashing the function', async () => {
  _resetRenderGetCaches();
  const unavailable: RateLimiter = { async consume() { throw new RateLimitUnavailableError('unconfigured'); } };
  const r = await renderGet('/tool/qr-code.svg', 'url=https%3A%2F%2Fsuse.com%2F503', { ip: ip(), env, rateLimiter: unavailable });
  assert.equal(r.status, 503);
  assert.equal(r.headers['retry-after'], '5');
  assert.equal(r.headers['cache-control'], 'no-store');
});

// ── gateway routing ──────────────────────────────────────────────────────────

interface FakeRes { status: number; headers: Record<string, string>; body: Buffer | undefined }

function drive(url: string, method = 'GET'): Promise<FakeRes> {
  // No MCP secrets in env: proves the render route works OUTSIDE the mcpEnabled gate.
  const handler = createGateway({} as NodeJS.ProcessEnv);
  const req = {
    method, url,
    headers: { host: 'lolly.tools', 'x-forwarded-for': `172.16.0.${++ipSeq}, 10.0.0.1` },
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as IncomingMessage;
  return new Promise((resolve, reject) => {
    const out: FakeRes = { status: 0, headers: {}, body: undefined };
    const res = {
      writeHead(status: number, headers?: Record<string, string>) { out.status = status; out.headers = headers ?? {}; return this; },
      end(body?: string | Buffer) { out.body = body === undefined ? undefined : Buffer.from(body); resolve(out); },
    } as unknown as ServerResponse;
    handler(req, res).catch(reject);
  });
}

test('gateway serves GET /tool/<id>.<ext> publicly, with CORS, even with no MCP secrets', async () => {
  const r = await drive('/tool/qr-code.svg?url=https%3A%2F%2Fsuse.com');
  assert.equal(r.status, 200);
  assert.equal(r.headers['access-control-allow-origin'], '*');
  assert.match(r.headers['content-type']!, /svg/);
  assert.match(r.body!.toString('utf8'), /<svg/);

  // …while everything else on the unconfigured deployment stays a 404.
  const rpc = await drive('/api/mcp', 'POST');
  assert.equal(rpc.status, 404);
});

test('gateway HEAD answers headers only', async () => {
  const r = await drive('/tool/qr-code.svg?url=https%3A%2F%2Fsuse.com', 'HEAD');
  assert.equal(r.status, 200);
  assert.ok(r.headers['etag']);
  assert.equal(r.body, undefined);
});

test('a hosted gateway with no durable limiter still boots: renders 503, the rest of the surface answers', async () => {
  _resetRenderGetCaches();
  // VERCEL=1 and no LOLLY_RATE_LIMIT_REST_* pair, no opt-in - the 2026-09-10 outage shape.
  const handler = createGateway({ VERCEL: '1' } as NodeJS.ProcessEnv);
  const call = (url: string, method = 'GET'): Promise<FakeRes> => new Promise((resolve, reject) => {
    const req = { method, url, headers: { host: 'lolly.tools' }, socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage;
    const out: FakeRes = { status: 0, headers: {}, body: undefined };
    const res = {
      writeHead(status: number, headers?: Record<string, string>) { out.status = status; out.headers = headers ?? {}; return this; },
      end(body?: string | Buffer) { out.body = body === undefined ? undefined : Buffer.from(body); resolve(out); },
    } as unknown as ServerResponse;
    handler(req, res).catch(reject);
  });
  const render = await call('/tool/qr-code.svg?url=https%3A%2F%2Fsuse.com%2Fhosted');
  assert.equal(render.status, 503);
  assert.equal(render.headers['retry-after'], '5');
  const rpc = await call('/api/mcp', 'POST');
  assert.equal(rpc.status, 404, 'no MCP secrets: the endpoint cleanly does not exist, and nothing threw');
});
