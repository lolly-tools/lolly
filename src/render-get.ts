// SPDX-License-Identifier: MPL-2.0
/**
 * The public GET render endpoint - `GET /tool/<id>.<ext>?<query>`.
 *
 * Answers the exact canonical embed-URL shape `buildEmbedUrl` mints
 * (engine/src/tool-url.ts) with real bytes: a vercel.json rewrite sends
 * `/tool/:id.:ext` to the MCP function and the gateway routes GET/HEAD here. So
 * the embed URLs the Share dialog and `lolly_build_url` already produce become
 * live `<img src>`s in READMEs, wikis and dashboards.
 *
 * Deliberate v1 policy (a design decision, not an implementation detail - see
 * docs/mcp.md and docs/privacy.md, which describe this surface to users):
 *
 *  - PUBLIC and unauthenticated. It renders only public tool + catalog data (the
 *    same bundled tools/ dir the MCP tools read); no accounts, no cookies, no
 *    user state, nothing stored per request.
 *  - Official/community tools only. Anything else (unknown id, experimental
 *    status) gets the SAME 404, so the response never leaks catalog existence
 *    semantics (a 403 would confirm the tool exists).
 *  - Browser-free formats only: TIER_A plus the resvg PNG fast-path for
 *    SVG-native tools (render.ts). Everything else is an honest 400.
 *  - Content Credentials are OFF here, always: a GET render must be
 *    deterministic for its URL so the ETag + CDN cache are honest (C2PA embeds a
 *    fresh signature + timestamp per render, which would make identical URLs
 *    yield different bytes). Time-varying tools simply go stale within s-maxage.
 *  - Every 200 carries `Content-Security-Policy: sandbox`: html/svg output is
 *    tool-authored markup fed by query params and must never execute in the
 *    lolly.tools origin when navigated to directly (as an `<img src>` the header
 *    is moot; this guards direct navigation).
 *  - Self-hosters can switch the route off entirely: LOLLY_DISABLE_RENDER_GET=1
 *    makes every /tool/<id>.<ext> URL return 404.
 *
 * Caching, in layers - most traffic is the same handful of URLs (the demo pages
 * hot-link their own renders), so a render should happen about once per URL:
 *
 *  1. The CDN. `s-maxage` keeps a 200 at the edge for a day and serves it stale
 *     for a week while refreshing; the cache key is the full URL, so the demo
 *     must spell each image one way (buildEmbedUrl does). Browsers get an hour
 *     (`max-age`) before they even revalidate, and a revalidation is a 304.
 *  2. This instance. A bounded memo of recent renders keyed by ETag serves a
 *     repeat that reached the function (another region's edge, a cold edge, an
 *     If-None-Match miss) without rendering, and identical requests that arrive
 *     while a render is in flight share that one render.
 *
 * Abuse bounds - the function is what an attacker can make expensive, and only
 * an actual render is expensive (304s, memo hits and refusals cost ~nothing):
 *
 *  - Per address: LOLLY_RENDER_GET_RPM renders a minute (default 60).
 *  - In total: LOLLY_RENDER_GET_GLOBAL_RPM renders a minute across every address
 *    (default 600), so a distributed flood is bounded by budget, not by luck.
 *  - Per render: the query's width/height/dpi are bounded, and a PNG raster is
 *    additionally bounded by AREA (MAX_RASTER_PIXELS), because the 10000px edge
 *    cap alone still allows a 400 MB RGBA allocation.
 *  Both limits use the gateway's durable limiter in hosted deployments (per
 *  instance otherwise); if that limiter is unconfigured or unreachable the
 *  answer is a 503 with Retry-After, never unlimited admission.
 */

import { createHash } from 'node:crypto';
import { ENGINE_VERSION, expandQuery, parseDimension, toPixels } from '@lolly/engine';
import { loadIndex } from './catalog.ts';
import { TIER_A, render, normFormat, mimeForFormat, isTextFormat, RenderError } from './render.ts';
import { MemoryRateLimiter, RateLimitUnavailableError, type RateLimiter } from './rate-limit.ts';

export interface RenderGetResponse {
  status: number;
  headers: Record<string, string>;
  body?: Uint8Array | string;
}

// Same id grammar as engine/src/tool-url.ts ID_RE; the extension is short and
// alphanumeric-with-hyphen (eps-cmyk). Matched as a path SUFFIX so it works
// whether the platform hands us `/tool/x.svg` or `/api/mcp/tool/x.svg`.
const PATH_RE = /\/tool\/([a-z0-9][a-z0-9-]*[a-z0-9])\.([a-z0-9-]{1,12})$/;

/** Recognise a render-GET path. The gateway routes GET/HEAD here when non-null. */
export function matchRenderGetPath(path: string): { toolId: string; ext: string } | null {
  const m = PATH_RE.exec(path);
  return m ? { toolId: m[1]!, ext: m[2]! } : null;
}

// MAX_URL parity with parseEmbedUrl/buildEmbedUrl (engine/src/tool-url.ts): a
// query longer than the longest mintable embed URL is refused outright.
const MAX_QUERY = 4096;
// Sane output bound - caps the resvg raster allocation (physical units convert
// to pixels at `dpi` before the check, so 10000mm can't sneak in a huge raster).
const MAX_EDGE_PX = 10_000;
const MAX_DPI = 1200;
// A PNG raster's pixel budget (4096 x 4096). The edge cap bounds each side; this
// bounds the allocation, which is what a public route must actually bound.
export const MAX_RASTER_PIXELS = 4096 * 4096;

const RL_WINDOW_MS = 60_000;
const DEFAULT_RPM = 60;
const DEFAULT_GLOBAL_RPM = 600;
const localRateLimiter = new MemoryRateLimiter();

// The instance memo: recent renders by ETag, bounded by bytes and evicted least
// recently used. One entry never exceeds MEMO_MAX_ENTRY_BYTES so a single huge
// render cannot flush the working set.
const MEMO_MAX_BYTES = 32 * 1024 * 1024;
const MEMO_MAX_ENTRY_BYTES = 4 * 1024 * 1024;
interface Rendered { bytes: Uint8Array; mime: string }
const memo = new Map<string, Rendered>();
let memoBytes = 0;
const inFlight = new Map<string, Promise<Rendered>>();

function memoGet(etag: string): Rendered | null {
  const hit = memo.get(etag);
  if (!hit) return null;
  memo.delete(etag);
  memo.set(etag, hit);
  return hit;
}

function memoPut(etag: string, rendered: Rendered): void {
  const size = rendered.bytes.byteLength;
  if (size > MEMO_MAX_ENTRY_BYTES) return;
  if (memo.has(etag)) return;
  memo.set(etag, rendered);
  memoBytes += size;
  while (memoBytes > MEMO_MAX_BYTES) {
    const oldest = memo.entries().next().value as [string, Rendered] | undefined;
    if (!oldest) break;
    memo.delete(oldest[0]);
    memoBytes -= oldest[1].bytes.byteLength;
  }
}

/** Test seam: forget every memoised render and in-flight join. */
export function _resetRenderGetCaches(): void {
  memo.clear();
  memoBytes = 0;
  inFlight.clear();
}

/** The leader of an in-flight slot was refused admission (429/503): joiners must
 *  not inherit that refusal (it was about the leader's address and moment), so
 *  the slot rejects with this marker and each joiner admits itself instead. */
class AdmissionRefused extends Error {}

interface Slot { promise: Promise<Rendered>; resolve: (r: Rendered) => void; reject: (e: unknown) => void }

/** An in-flight slot registered SYNCHRONOUSLY, before any await, so concurrent
 *  identical requests find it. Its rejection is observed here so a slot nobody
 *  joined can never surface as an unhandled rejection. */
function openSlot(etag: string): Slot {
  let resolve!: (r: Rendered) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<Rendered>((res, rej) => { resolve = res; reject = rej; });
  promise.catch(() => {});
  inFlight.set(etag, promise);
  return { promise, resolve, reject };
}

function closeSlot(etag: string, slot: Slot): void {
  if (inFlight.get(etag) === slot.promise) inFlight.delete(etag);
}

const NO_STORE: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
};

function errorResponse(status: number, error: string, extra: Record<string, string> = {}): RenderGetResponse {
  return { status, headers: { ...NO_STORE, ...extra }, body: JSON.stringify({ error }) };
}

/** width/height/dpi bounds on the (already-expanded) query. Returns an error string or null. */
function dimensionError(params: URLSearchParams, raster: boolean): string | null {
  const rawDpi = params.get('dpi');
  const dpi = rawDpi != null ? Number(rawDpi) : 300;
  if (rawDpi != null && (!Number.isFinite(dpi) || dpi <= 0 || dpi > MAX_DPI)) return `dpi must be between 1 and ${MAX_DPI}`;
  const unit = (params.get('unit') || 'px').toLowerCase();
  const px: Record<string, number> = {};
  for (const [name, alias] of [['width', 'w'], ['height', 'h']] as const) {
    const raw = params.get(name) ?? params.get(alias);
    if (raw == null) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return `${name} must be a positive number`;
    let value = n;
    if (unit !== 'px') {
      const dim = parseDimension(`${n}${unit}`);
      if (dim) value = toPixels(dim, dpi);
    }
    if (value > MAX_EDGE_PX) return `${name} exceeds the ${MAX_EDGE_PX}px output cap`;
    px[name] = value;
  }
  if (raster && px.width && px.height && px.width * px.height > MAX_RASTER_PIXELS) {
    return `width x height exceeds the ${MAX_RASTER_PIXELS.toLocaleString('en')}-pixel raster cap - request svg, or a smaller png`;
  }
  return null;
}

/** True when `ifNoneMatch` (a comma-separated header value) contains `etag`. */
function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(',').some(t => t.trim().replace(/^W\//, '') === etag);
}

function budget(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

export interface RenderGetOpts {
  /** First-hop client IP (x-forwarded-for), for the best-effort rate limit. */
  ip: string;
  ifNoneMatch?: string;
  env?: NodeJS.ProcessEnv;
  rateLimiter?: RateLimiter;
}

/**
 * Handle `GET /tool/<id>.<ext>?<query>`. `path` is the URL pathname, `query` the
 * raw query string (no leading '?'). Pure of the transport: the gateway writes
 * the returned status/headers/body (dropping the body for HEAD).
 */
export async function renderGet(path: string, query: string, opts: RenderGetOpts): Promise<RenderGetResponse> {
  const env = opts.env ?? process.env;
  if (env.LOLLY_DISABLE_RENDER_GET === '1') return errorResponse(404, 'not_found');

  const match = matchRenderGetPath(path);
  if (!match) return errorResponse(404, 'not_found');

  const fmt = normFormat(match.ext); // FORMAT_EXT parity: 'jpeg' collapses to 'jpg'
  const pngRequested = fmt === 'png';
  if (!TIER_A.has(fmt) && !pngRequested) {
    return errorResponse(400, `Format "${fmt}" needs the browser render tier, which this public endpoint does not run. ` +
      `Available here: ${[...TIER_A].join(', ')} - plus png for SVG-native tools.`);
  }

  if (query.length > MAX_QUERY) return errorResponse(400, `Query too long (max ${MAX_QUERY} characters).`);

  // Same load-boundary expansion as the app/CLI: packed z= links work here too.
  const expanded = await expandQuery(query);
  const params = new URLSearchParams(expanded);
  const dimErr = dimensionError(params, pngRequested);
  if (dimErr) return errorResponse(400, dimErr);

  // Existence + status from the generated catalog index (cheap; no tool files
  // touched for garbage ids). Non-official/community is the SAME 404 as unknown.
  const index = await loadIndex();
  const entry = index.tools.find(t => t.id === match.toolId);
  if (!entry || (entry.status !== 'official' && entry.status !== 'community')) {
    return errorResponse(404, 'not_found');
  }
  const formats = (entry.formats ?? []).map(f => f.toLowerCase());
  if (pngRequested && !formats.includes('svg')) {
    return errorResponse(400, 'png is only served for SVG-native tools on this endpoint - request svg, or use the app for full raster.');
  }

  // Renders are deterministic for their URL (c2pa forced off below), so a strong
  // ETag over (engine + catalog build + canonical URL) is honest. Catalog or
  // engine updates roll every ETag - over-invalidation, never staleness.
  const etag = `"${createHash('sha256')
    .update(`${ENGINE_VERSION}|${index.version}|${index.generatedAt}|${match.toolId}.${fmt}?${expanded}`)
    .digest('hex').slice(0, 32)}"`;
  const cacheHeaders: Record<string, string> = {
    'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    etag,
    'x-robots-tag': 'noindex',
  };
  if (etagMatches(opts.ifNoneMatch, etag)) return { status: 304, headers: cacheHeaders };

  const ok = (rendered: Rendered): RenderGetResponse => {
    const mime = rendered.mime || mimeForFormat(fmt);
    return {
      status: 200,
      headers: {
        ...cacheHeaders,
        'content-type': isTextFormat(fmt) && !mime.includes('charset') ? `${mime}; charset=utf-8` : mime,
        'content-security-policy': 'sandbox',
        'x-content-type-options': 'nosniff',
        'content-disposition': `inline; filename="${match.toolId}.${fmt}"`,
      },
      body: rendered.bytes,
    };
  };

  // A repeat this instance already rendered, or is rendering right now, is not a
  // render: serve it outside the limits, like a 304. A joiner whose leader was
  // refused admission comes back round and admits itself.
  const memoised = memoGet(etag);
  if (memoised) return ok(memoised);
  for (;;) {
    const joined = inFlight.get(etag);
    if (!joined) break;
    try { return ok(await joined); }
    catch (e) { if (!(e instanceof AdmissionRefused)) return renderFailure(e); }
  }
  const slot = openSlot(etag);

  // Rate-limit actual renders only: per address first, then the whole route's
  // budget, so one address over its own limit never spends the shared one.
  const limiter = opts.rateLimiter ?? localRateLimiter;
  let refused: RenderGetResponse | null = null;
  try {
    const perIp = await limiter.consume('render', opts.ip || 'unknown', budget(env.LOLLY_RENDER_GET_RPM, DEFAULT_RPM), RL_WINDOW_MS);
    if (!perIp.ok) refused = errorResponse(429, 'Too many renders from this address - slow down.', { 'retry-after': String(perIp.retryAfter) });
    else {
      const total = await limiter.consume('render-all', 'all', budget(env.LOLLY_RENDER_GET_GLOBAL_RPM, DEFAULT_GLOBAL_RPM), RL_WINDOW_MS);
      if (!total.ok) refused = errorResponse(429, 'The public render endpoint is busy - try again shortly.', { 'retry-after': String(total.retryAfter) });
    }
  } catch (e) {
    if (!(e instanceof RateLimitUnavailableError)) { closeSlot(etag, slot); slot.reject(e); throw e; }
    refused = errorResponse(503, 'Render admission is temporarily unavailable.', { 'retry-after': '5' });
  }
  if (refused) {
    closeSlot(etag, slot);
    slot.reject(new AdmissionRefused());
    return refused;
  }

  // c2pa OFF (never from the query): see the module comment - determinism is
  // what makes the ETag + CDN cache correct. format comes from the path
  // extension, which is authoritative over any `format=` query param.
  // noBrowser keeps the "browser-free formats only" policy honest: without it a
  // fast-path failure would silently fall through to a full Chromium render on
  // deployments that configured a browser for the AUTHENTICATED MCP tools.
  let rendered: Rendered;
  try {
    const result = await render(match.toolId, expanded, { format: fmt, c2pa: { on: false, days: null }, noBrowser: true, maxRasterPixels: MAX_RASTER_PIXELS });
    rendered = { bytes: result.bytes, mime: result.mime };
  } catch (e) {
    closeSlot(etag, slot);
    slot.reject(e);
    return renderFailure(e);
  }
  memoPut(etag, rendered);
  closeSlot(etag, slot);
  slot.resolve(rendered);
  return ok(rendered);
}

function renderFailure(e: unknown): RenderGetResponse {
  if (e instanceof RenderError) return errorResponse(400, e.message);
  return errorResponse(500, `Render failed: ${(e as Error).message}`);
}
