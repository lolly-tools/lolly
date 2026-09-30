// SPDX-License-Identifier: MPL-2.0
/**
 * The public image proxy - `GET /api/fetch-image?url=<remote image URL>`.
 *
 * Why it exists: the web PWA's CSP is `img-src`/`connect-src 'self'`
 * (vercel.json), so the browser can neither fetch nor display an arbitrary
 * remote image. "Add from URL" in the asset picker and the catalogue routes the
 * user's chosen image URL through here - the function fetches it server-side and
 * streams the bytes back from the app's OWN origin, which `'self'` permits. The
 * Tauri shells (no CSP, tauri-plugin-http) fetch directly and never touch this
 * route; a same-origin or `data:` URL never reaches it either.
 *
 * It sits beside the render route (render-get.ts) and shares its policy shape:
 * PUBLIC, unauthenticated, stateless (stores nothing, reads no user state, needs
 * no MCP secrets), and disabled the same way (`LOLLY_DISABLE_IMAGE_PROXY=1`). It
 * is a dumb pass-through: given a URL it returns the upstream bytes and their
 * content-type, nothing else.
 *
 * SSRF is the entire risk of a "fetch a URL the caller picked" endpoint, so:
 *  - only http/https, and no credentials in the URL;
 *  - the hostname is DNS-resolved and EVERY answer must be a public address
 *    (egress.ts `isPublicAddress`) - a name that resolves to 127.0.0.1, 10.x,
 *    169.254.169.254 (cloud metadata) or any private/link-local range is
 *    refused, which is also what defeats DNS rebinding;
 *  - redirects are followed BY HAND, re-validating each hop the same way, so a
 *    public URL cannot 3xx the fetch onto an internal address;
 *  - only `image/*` content types return, and the body is capped
 *    (`MAX_IMAGE_BYTES`) by a counting read so a huge upstream cannot exhaust
 *    memory.
 * Abuse is bounded exactly like render: per-address + global RPM through the
 * gateway's durable limiter, and a 503 (never unlimited admission) if that
 * limiter is unconfigured.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPublicAddress } from './egress.ts';
import { MemoryRateLimiter, RateLimitUnavailableError, type RateLimiter } from './rate-limit.ts';
import { budgetRefusal, type UsageBudget } from './usage-budget.ts';

export interface ImageProxyResponse {
  status: number;
  headers: Record<string, string>;
  body?: Uint8Array | string;
}

// Matched as a path SUFFIX so it works whether the platform hands us
// `/api/fetch-image` or the rewritten `/api/mcp/fetch-image`.
const PATH_RE = /\/fetch-image$/;

/** Recognise an image-proxy path. The gateway routes GET/HEAD here when true. */
export function matchImageProxyPath(path: string): boolean {
  return PATH_RE.test(path);
}

const MAX_URL_LEN = 2048;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
// On Vercel a response body over 4.5 MB is refused by the platform, so a larger
// image would be downloaded in full only to fail on the way out.
const VERCEL_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 4;
// One deadline covers the whole request (every redirect hop plus the body read),
// so a chain of slow hops cannot outlive the serverless function's own limit.
const OVERALL_TIMEOUT_MS = 20_000;

const RL_WINDOW_MS = 60_000;
const DEFAULT_RPM = 60;
const DEFAULT_GLOBAL_RPM = 600;
const localRateLimiter = new MemoryRateLimiter();

// image/* only: a short allowlist keeps a text/html or application/* upstream (a
// login page, an error document) from being stored as an "image". SVG is allowed
// and returned under `sandbox` + `nosniff`; the web client additionally sanitises
// it (DOMPurify) before it is stored, so script in an SVG never survives.
const ALLOWED_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'image/avif', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon',
  'image/tiff', 'image/apng',
]);

const NO_STORE: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
};

function errorResponse(status: number, error: string, extra: Record<string, string> = {}): ImageProxyResponse {
  return { status, headers: { ...NO_STORE, ...extra }, body: JSON.stringify({ error }) };
}

function budget(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

/** Refusal the caller can and should surface verbatim (scheme / creds / SSRF). */
class ProxyRefused extends Error {}

async function resolveHost(hostname: string): Promise<string[]> {
  try { return (await lookup(hostname, { all: true, verbatim: true })).map(answer => answer.address); }
  catch { return []; }
}

/** Cheap, synchronous shape checks - run before spending any rate budget. */
function assertFetchableShape(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ProxyRefused(`Only http(s) image URLs are supported, not ${url.protocol.replace(':', '')}.`);
  if (url.username || url.password) throw new ProxyRefused('The URL must not carry a username or password.');
}

/**
 * Resolve the host and refuse it unless EVERY answer is a public address. This
 * is the same resolve-and-check-all shape as egress.ts's browser tier, and
 * carries the same documented residual (docs/threat-model.md): the fetch below
 * re-resolves the name independently, so a DNS answer that flips from public to
 * private in that window is a narrow TOCTOU gap. The layers around it - image
 * content-type only, byte cap, no credential forwarding, a sandboxed response,
 * and the rate limit - are what bound what that gap could yield.
 */
async function assertPublicTarget(url: URL, resolver: (h: string) => Promise<string[]>): Promise<void> {
  const literal = stripBrackets(url.hostname);
  if (isIP(literal)) {
    if (!isPublicAddress(literal)) throw new ProxyRefused('That address is not reachable from here.');
    return;
  }
  const addresses = await resolver(url.hostname);
  if (!addresses.length) throw new ProxyRefused('That address could not be resolved.');
  if (addresses.some(a => !isPublicAddress(a))) throw new ProxyRefused('That address is not reachable from here.');
}

class TooLarge extends Error {}

async function readCapped(response: Response, max: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await response.arrayBuffer());
    if (buf.byteLength > max) throw new TooLarge();
    return buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) { try { await reader.cancel(); } catch { /* already gone */ } throw new TooLarge(); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const chunk of chunks) { out.set(chunk, off); off += chunk.byteLength; }
  return out;
}

export interface ImageProxyOpts {
  /** First-hop client IP (x-forwarded-for), for the best-effort rate limit. */
  ip: string;
  env?: NodeJS.ProcessEnv;
  rateLimiter?: RateLimiter;
  /** The gateway's daily usage budget. Absent means unmetered (tests, embedding). */
  budget?: UsageBudget;
  /** Injectable for tests: DNS resolver and fetch. */
  resolver?: (hostname: string) => Promise<string[]>;
  fetchImpl?: typeof fetch;
}

/**
 * Handle `GET /api/fetch-image?url=<remote image>`. `reqUrl` is the parsed
 * request URL (the target is its `url` query param). Pure of the transport: the
 * gateway writes the returned status/headers/body (dropping the body for HEAD).
 */
export async function proxyImage(reqUrl: URL, opts: ImageProxyOpts): Promise<ImageProxyResponse> {
  const env = opts.env ?? process.env;
  if (env.LOLLY_DISABLE_IMAGE_PROXY === '1') return errorResponse(404, 'not_found');

  const target = reqUrl.searchParams.get('url');
  if (!target) return errorResponse(400, 'Pass ?url=<image URL>.');
  if (target.length > MAX_URL_LEN) return errorResponse(400, `URL too long (max ${MAX_URL_LEN} characters).`);
  let parsed: URL;
  try { parsed = new URL(target); }
  catch { return errorResponse(400, "That doesn't look like a URL."); }
  // Cheap shape refusals happen before any rate budget is spent.
  try { assertFetchableShape(parsed); }
  catch (e) { if (e instanceof ProxyRefused) return errorResponse(422, e.message); throw e; }

  // Rate-limit the outbound fetch (the expensive part): per address first, then
  // the whole route's budget, mirroring the render route.
  const limiter = opts.rateLimiter ?? localRateLimiter;
  try {
    const perIp = await limiter.consume('imgproxy', opts.ip || 'unknown', budget(env.LOLLY_IMAGE_PROXY_RPM, DEFAULT_RPM), RL_WINDOW_MS);
    if (!perIp.ok) return errorResponse(429, 'Too many image fetches from this address - slow down.', { 'retry-after': String(perIp.retryAfter) });
    const total = await limiter.consume('imgproxy-all', 'all', budget(env.LOLLY_IMAGE_PROXY_GLOBAL_RPM, DEFAULT_GLOBAL_RPM), RL_WINDOW_MS);
    if (!total.ok) return errorResponse(429, 'The image proxy is busy - try again shortly.', { 'retry-after': String(total.retryAfter) });
    const state = await opts.budget?.check();
    if (state && !state.ok) {
      const r = budgetRefusal(state);
      return { status: r.status, headers: { ...NO_STORE, ...r.headers }, body: JSON.stringify(r.json) };
    }
  } catch (e) {
    if (!(e instanceof RateLimitUnavailableError)) throw e;
    return errorResponse(503, 'Image fetching is temporarily unavailable.', { 'retry-after': '5' });
  }

  const resolver = opts.resolver ?? resolveHost;
  const doFetch = opts.fetchImpl ?? fetch;

  // Follow redirects by hand, re-validating each hop: a public URL must not be
  // able to 3xx the fetch onto an internal address. One deadline spans the chain.
  const deadline = AbortSignal.timeout(OVERALL_TIMEOUT_MS);
  let response: Response;
  let current = parsed;
  try {
    for (let hop = 0; ; hop++) {
      assertFetchableShape(current);
      await assertPublicTarget(current, resolver);
      response = await doFetch(current.toString(), {
        redirect: 'manual',
        signal: deadline,
        headers: { accept: 'image/*' },
      });
      const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
      if (!location) break;
      if (hop >= MAX_REDIRECTS) return errorResponse(502, 'That address redirected too many times.');
      let next: URL;
      try { next = new URL(location, current); }
      catch { return errorResponse(502, 'That address redirected to an invalid location.'); }
      try { await response.body?.cancel(); } catch { /* already gone */ }
      current = next;
    }
  } catch (e) {
    if (e instanceof ProxyRefused) return errorResponse(422, e.message);
    const name = (e as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') return errorResponse(504, 'That address took too long to answer.');
    return errorResponse(502, `Couldn't fetch that URL: ${(e as Error).message}`);
  }

  if (!response.ok) {
    try { await response.body?.cancel(); } catch { /* already gone */ }
    return errorResponse(502, `That address answered with ${response.status}.`);
  }

  const rawType = (response.headers.get('content-type') || '').split(';')[0]!.trim().toLowerCase();
  if (!ALLOWED_TYPES.has(rawType)) {
    try { await response.body?.cancel(); } catch { /* already gone */ }
    return errorResponse(415, 'That URL is not an image.');
  }

  const maxBytes = env.VERCEL ? VERCEL_MAX_IMAGE_BYTES : MAX_IMAGE_BYTES;
  let bytes: Uint8Array;
  try { bytes = await readCapped(response, maxBytes); }
  catch (e) {
    await opts.budget?.record(0);
    if (e instanceof TooLarge) return errorResponse(413, `That image is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
    return errorResponse(502, `Couldn't read that image: ${(e as Error).message}`);
  }
  await opts.budget?.record(bytes.byteLength);

  return {
    status: 200,
    headers: {
      'content-type': rawType,
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'content-security-policy': 'sandbox',
      'x-content-type-options': 'nosniff',
      'content-disposition': 'inline',
      'x-robots-tag': 'noindex',
    },
    body: bytes,
  };
}
