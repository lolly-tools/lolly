// SPDX-License-Identifier: MPL-2.0
/**
 * The public image proxy (src/image-proxy.ts) - "Add from URL" fetches a
 * caller-chosen image server-side so the web PWA's img-src 'self' CSP can show
 * it. The whole risk is SSRF, so most of this file proves the refusals: private
 * / link-local / metadata addresses, DNS answers that point inward, redirects
 * that try to hop inward, non-image content, oversized bodies. Plus the shared
 * render-route policy: per-IP + global rate limit, 503 on an unconfigured
 * limiter, the kill switch, and one pass through the gateway for routing + CORS.
 *
 * Both the DNS resolver and fetch are injected, so nothing here touches the
 * network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { proxyImage, matchImageProxyPath, upstreamImagePolicy } from '../src/image-proxy.ts';
import { createGateway } from '../src/gateway.ts';
import { RateLimitUnavailableError, type RateLimiter } from '../src/rate-limit.ts';

const env = {} as NodeJS.ProcessEnv;
let ipSeq = 0;
const ip = (): string => `10.0.0.${++ipSeq}`;

// A resolver that maps a few test hostnames to canned answers; anything else
// resolves to nothing (refused).
const RESOLVE: Record<string, string[]> = {
  'good.example': ['93.184.216.34'],       // public
  'evil.example': ['127.0.0.1'],           // loops back
  'rebind.example': ['93.184.216.34', '10.0.0.5'], // one public, one private
  'redir.example': ['93.184.216.34'],      // public, but its response redirects inward
};
const resolver = async (h: string): Promise<string[]> => RESOLVE[h] ?? [];

/** Build a canned fetch. `plan[url]` is the Response (or a function of the URL). */
function fakeFetch(plan: (url: string) => Response): { impl: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return plan(url);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const imageResponse = (bytes = new Uint8Array([1, 2, 3, 4]), type = 'image/png'): Response =>
  new Response(bytes, { status: 200, headers: { 'content-type': type } });

const proxyReq = (target: string): URL => new URL(`/api/fetch-image?url=${encodeURIComponent(target)}`, 'http://internal');

test('path matcher accepts the proxy path (bare and rewritten) and nothing else', () => {
  assert.equal(matchImageProxyPath('/api/fetch-image'), true);
  assert.equal(matchImageProxyPath('/api/mcp/fetch-image'), true);
  assert.equal(matchImageProxyPath('/fetch-image'), true);
  assert.equal(matchImageProxyPath('/api/mcp'), false);
  assert.equal(matchImageProxyPath('/tool/qr-code.svg'), false);
  assert.equal(matchImageProxyPath('/api/fetch-image/evil'), false);
});

test('happy path: a public image returns bytes + cache / nosniff / sandbox headers', async () => {
  const { impl, calls } = fakeFetch(() => imageResponse());
  const r = await proxyImage(proxyReq('https://good.example/logo.png'), { ip: ip(), env, resolver, fetchImpl: impl });
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'image/png');
  assert.equal(r.headers['content-security-policy'], 'sandbox');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.match(r.headers['cache-control']!, /s-maxage=0/);
  assert.match(r.headers['cache-control']!, /no-transform/);
  assert.ok(r.body instanceof Uint8Array && r.body.byteLength === 4);
  assert.equal(calls.length, 1);
});

test('missing / malformed url is a 400 and never fetches', async () => {
  const { impl, calls } = fakeFetch(() => imageResponse());
  assert.equal((await proxyImage(new URL('/api/fetch-image', 'http://internal'), { ip: ip(), env, resolver, fetchImpl: impl })).status, 400);
  assert.equal((await proxyImage(proxyReq('not a url'), { ip: ip(), env, resolver, fetchImpl: impl })).status, 400);
  assert.equal(calls.length, 0);
});

test('a non-http scheme and a credentialed URL are refused (422) without fetching', async () => {
  const { impl, calls } = fakeFetch(() => imageResponse());
  assert.equal((await proxyImage(proxyReq('file:///etc/passwd'), { ip: ip(), env, resolver, fetchImpl: impl })).status, 422);
  assert.equal((await proxyImage(proxyReq('https://user:pass@good.example/x.png'), { ip: ip(), env, resolver, fetchImpl: impl })).status, 422);
  assert.equal(calls.length, 0);
});

test('SSRF: a literal private / loopback / metadata address is refused without fetching', async () => {
  const { impl, calls } = fakeFetch(() => imageResponse());
  for (const host of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '169.254.169.254', '[::1]']) {
    const r = await proxyImage(proxyReq(`http://${host}/x.png`), { ip: ip(), env, resolver, fetchImpl: impl });
    assert.equal(r.status, 422, `${host} must be refused`);
  }
  assert.equal(calls.length, 0, 'no blocked target is ever fetched');
});

test('SSRF: a hostname that resolves inward (incl. one bad answer) is refused', async () => {
  const { impl, calls } = fakeFetch(() => imageResponse());
  assert.equal((await proxyImage(proxyReq('https://evil.example/x.png'), { ip: ip(), env, resolver, fetchImpl: impl })).status, 422);
  // rebind.example resolves to a public AND a private address - refused because SOME answer is private.
  assert.equal((await proxyImage(proxyReq('https://rebind.example/x.png'), { ip: ip(), env, resolver, fetchImpl: impl })).status, 422);
  // A name that resolves to nothing is refused too.
  assert.equal((await proxyImage(proxyReq('https://nowhere.example/x.png'), { ip: ip(), env, resolver, fetchImpl: impl })).status, 422);
  assert.equal(calls.length, 0);
});

test('SSRF: a public URL that redirects inward is refused on the redirect hop', async () => {
  const { impl, calls } = fakeFetch((url) =>
    url.startsWith('https://redir.example')
      ? new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
      : imageResponse());
  const r = await proxyImage(proxyReq('https://redir.example/x.png'), { ip: ip(), env, resolver, fetchImpl: impl });
  assert.equal(r.status, 422);
  assert.equal(calls.length, 1, 'the inward redirect target is validated, never fetched');
});

test('too many redirects is a 502', async () => {
  // Always redirect to another public host (good.example resolves public).
  const { impl } = fakeFetch(() => new Response(null, { status: 301, headers: { location: 'https://good.example/next' } }));
  const r = await proxyImage(proxyReq('https://good.example/start'), { ip: ip(), env, resolver, fetchImpl: impl });
  assert.equal(r.status, 502);
});

test('a non-image content type is a 415', async () => {
  const { impl } = fakeFetch(() => new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }));
  const r = await proxyImage(proxyReq('https://good.example/login'), { ip: ip(), env, resolver, fetchImpl: impl });
  assert.equal(r.status, 415);
});

test('an oversized image is a 413', async () => {
  const big = new Uint8Array(26 * 1024 * 1024); // over the 25 MB cap
  const { impl } = fakeFetch(() => imageResponse(big, 'image/png'));
  const r = await proxyImage(proxyReq('https://good.example/huge.png'), { ip: ip(), env, resolver, fetchImpl: impl });
  assert.equal(r.status, 413);
});

test('the kill switch makes every request a 404', async () => {
  const { impl } = fakeFetch(() => imageResponse());
  const r = await proxyImage(proxyReq('https://good.example/logo.png'), { ip: ip(), env: { LOLLY_DISABLE_IMAGE_PROXY: '1' } as NodeJS.ProcessEnv, resolver, fetchImpl: impl });
  assert.equal(r.status, 404);
});

test('per-address and global rate limits each answer 429 with retry-after', async () => {
  const refuse = (scope: string): RateLimiter => ({
    async consume(s) { return s === scope ? { ok: false, retryAfter: 7, remaining: 0 } : { ok: true, retryAfter: 0, remaining: 1 }; },
  });
  const { impl } = fakeFetch(() => imageResponse());
  const perIp = await proxyImage(proxyReq('https://good.example/a.png'), { ip: ip(), env, resolver, fetchImpl: impl, rateLimiter: refuse('imgproxy') });
  assert.equal(perIp.status, 429);
  assert.equal(perIp.headers['retry-after'], '7');
  const global = await proxyImage(proxyReq('https://good.example/b.png'), { ip: ip(), env, resolver, fetchImpl: impl, rateLimiter: refuse('imgproxy-all') });
  assert.equal(global.status, 429);
});

test('an unconfigured limiter answers 503 with retry-after, never unlimited admission', async () => {
  const throwing: RateLimiter = { async consume() { throw new RateLimitUnavailableError(); } };
  const { impl, calls } = fakeFetch(() => imageResponse());
  const r = await proxyImage(proxyReq('https://good.example/a.png'), { ip: ip(), env, resolver, fetchImpl: impl, rateLimiter: throwing });
  assert.equal(r.status, 503);
  assert.equal(r.headers['retry-after'], '5');
  assert.equal(calls.length, 0, 'no fetch happens when admission is unavailable');
});

test('gateway routes /api/fetch-image and adds CORS', async () => {
  const gateway = createGateway(env);
  const headers: Record<string, string> = {};
  let status = 0;
  const res = {
    writeHead(s: number, h: Record<string, string>) { status = s; Object.assign(headers, h); return this; },
    end() { return this; },
  } as unknown as ServerResponse;
  // No injected fetch through the gateway path, so this exercises routing + the
  // real (blocked) SSRF/limiter path; a bad host gives a deterministic non-200.
  const req = { method: 'GET', url: '/api/fetch-image?url=http://127.0.0.1/x.png', headers: {}, socket: { remoteAddress: ip() } } as unknown as IncomingMessage;
  await gateway(req, res);
  assert.equal(headers['access-control-allow-origin'], '*');
  assert.equal(status, 422, 'a loopback target is refused through the gateway too');
});

test('upstream freshness is capped, aged, and never invented', () => {
  const url = new URL('https://good.example/a.png');
  for (const [control, age, expected] of [['public, max-age=86400', '0', 3600], ['max-age=120', '30', 90], ['max-age=120', '121', 0], ['no-cache, max-age=120', '0', 0], ['', '0', 0], ['max-age=broken', '0', 0], ['max-age=120, max-age=600', '0', 0], ['max-age=120', 'broken', 0]] as const) {
    assert.equal(upstreamImagePolicy(url, new Headers({ 'cache-control': control, age })).age, expected);
  }
});
test('private/no-store/cookies and signed URLs stay out of every shared cache', async () => {
  for (const [query, headers] of [
    ['', { 'cache-control': 'private, max-age=600' }], ['', { 'cache-control': 'no-store' }],
    ['', { 'set-cookie': 'session=private', 'cache-control': 'max-age=600' }],
    ['?X-Amz-Signature=hidden', { 'cache-control': 'public, max-age=600' }],
    ['?sig=hidden', { 'cache-control': 'public, max-age=600' }],
    ['?Expires=9999999', { 'cache-control': 'public, max-age=600' }],
    ['', { vary: 'Cookie', 'cache-control': 'max-age=600' }],
  ] as const) {
    const { impl } = fakeFetch(() => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png', ...headers } }));
    const r = await proxyImage(proxyReq(`https://good.example/a.png${query}`), { ip: ip(), env, resolver, fetchImpl: impl });
    assert.equal(r.status, 200); assert.equal(r.headers['cache-control'], 'private, no-store, max-age=0, no-transform');
    assert.equal(r.headers['cdn-cache-control'], 'no-store'); assert.equal(r.headers['set-cookie'], undefined); assert.equal(r.headers['cache-tag'], undefined);
    assert.equal(r.headers['referrer-policy'], 'no-referrer');
  }
});
test('a private redirect hop cannot become a public cached final image', async () => {
  const { impl } = fakeFetch(url => url.includes('start') ? new Response(null, { status: 302, headers: { location: 'https://good.example/final.png', 'set-cookie': 'upstream=session' } })
    : new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' } }));
  const r = await proxyImage(proxyReq('https://good.example/start.png'), { ip: ip(), env, resolver, fetchImpl: impl });
  assert.equal(r.status, 200); assert.equal(r.headers['cdn-cache-control'], 'no-store'); assert.match(r.headers['cache-control']!, /^private,/);
});
test('the proxy returns exact source bytes with a byte digest, validator and opaque upstream tag', async () => {
  const bytes = new Uint8Array([0, 255, 42, 17]);
  const { impl } = fakeFetch(() => new Response(bytes, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=120' } }));
  const options = { ip: ip(), env, resolver, fetchImpl: impl };
  const a = await proxyImage(proxyReq('https://good.example/a.png'), options);
  assert.deepEqual(a.body, bytes); assert.match(a.headers.etag!, /^"[0-9a-f]{64}"$/);
  assert.match(a.headers['cache-tag']!, /^x_public-bounded,u_[0-9a-f]{12}$/);
  assert.equal(a.headers['cache-control'], 'public, max-age=120, s-maxage=120, no-transform');
  const b = await proxyImage(proxyReq('https://good.example/a.png'), { ...options, ifNoneMatch: a.headers.etag });
  assert.equal(b.status, 304); assert.equal(b.body, undefined); assert.equal(b.headers.etag, a.headers.etag);
});
