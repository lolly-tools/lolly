// SPDX-License-Identifier: MPL-2.0
/**
 * Penpot RPC proxy - the Vercel serverless entry bundled by
 * scripts/build-penpot-fn.ts into `api/penpot/[...path].js`.
 *
 * WHY THIS EXISTS
 * Penpot's SaaS RPC (design.penpot.app) answers CORS preflights with a 401 and
 * NO Access-Control-Allow-Origin header, so a browser can never call it
 * cross-origin - the web shell's "publish to Penpot" flow needs a same-origin
 * hop. This function is that hop and NOTHING more: a transport-only
 * pass-through. It adds no behaviour, no caching, no state.
 *
 * CUSTODY RULE: the user's Personal Access Token transits as an opaque
 * `Authorization` header - forwarded byte-for-byte upstream, never logged,
 * never stored, never echoed into an error body. Keep it that way.
 *
 * The upstream is PINNED to design.penpot.app. Accepting a caller-supplied
 * base URL would turn this into an open proxy / SSRF primitive (any origin
 * could bounce authenticated requests at arbitrary hosts through our egress).
 * Self-hosted Penpot instances do not need this proxy at all - their operator
 * controls the box and can enable CORS there - so only the SaaS host is served.
 *
 * The command ALLOWLIST below is the security boundary: without it this would
 * be a general relay to every Penpot RPC command (profile reads, team admin,
 * deletion, ...) reachable from any origin with a stolen token. Only the four
 * commands the publish flow actually uses may pass; everything else is 403.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

/** The ONLY RPC commands this proxy will relay - see the header comment. */
export const ALLOWLIST = [
  'get-all-projects',
  'get-project-files',
  'create-file',
  'upload-file-media-object',
] as const;
const ALLOWED = new Set<string>(ALLOWLIST);

/** Pinned upstream - never derived from the request (see header comment). */
const UPSTREAM_BASE = 'https://design.penpot.app/api/rpc/command/';

// ACAO `*` is safe here because authentication is an explicit user-supplied
// Authorization header the page attaches itself - never a cookie or other
// ambient credential a cross-site attacker could ride on.
const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

// Modest: well under the function's 30s maxDuration, generous for an RPC call.
const UPSTREAM_TIMEOUT_MS = 25_000;

// Vercel caps request bodies at ~4.5 MB anyway; this is just a sanity ceiling
// so a misbehaving client can't balloon the buffer.
const MAX_BODY = 32 * 1024 * 1024;

// Tell @vercel/node NOT to parse the body: upload-file-media-object is
// multipart/form-data and must reach Penpot byte-exact - a parse/re-serialise
// round trip would corrupt the boundary. We buffer the raw stream ourselves.
export const config = { api: { bodyParser: false } };

/** Buffer the raw request body - byte-exact, no decoding. */
function readRawBody(req: IncomingMessage): Promise<Buffer> {
  // Defence in depth: if a helper materialised req.body anyway (config above
  // should prevent it), prefer the raw stream when it is still readable and
  // only fall back to a string/Buffer body - never a parsed object, which
  // could not be re-serialised byte-exact.
  const pre = (req as unknown as { body?: unknown }).body;
  if (pre !== undefined && pre !== null && typeof (req as unknown as { on?: unknown }).on !== 'function') {
    if (typeof pre === 'string') return Promise.resolve(Buffer.from(pre));
    if (Buffer.isBuffer(pre)) return Promise.resolve(pre);
    return Promise.reject(new Error('Pre-parsed request body cannot be forwarded byte-exact'));
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { ...CORS, 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createPenpotProxy(
  fetchImpl: typeof fetch = fetch,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    // Browser preflight - answer it ourselves; the upstream 401s these.
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method-not-allowed', hint: 'POST /api/penpot/rpc/<command>' });
      return;
    }

    // Route: .../rpc/<command>. Anything not on the allowlist is refused -
    // the allowlist IS the security boundary (see header comment).
    const pathname = new URL(req.url ?? '/', 'http://internal').pathname;
    const m = pathname.match(/\/rpc\/([^/]+)\/?$/);
    const command = m?.[1] ?? '';
    if (!ALLOWED.has(command)) {
      sendJson(res, 403, {
        error: 'command-not-allowed',
        hint: `Only these Penpot RPC commands are proxied: ${ALLOWLIST.join(', ')}`,
      });
      return;
    }

    let body: Buffer;
    try {
      body = await readRawBody(req);
    } catch (err) {
      sendJson(res, 400, { error: 'bad-request', hint: String((err as Error)?.message ?? err) });
      return;
    }

    // Forward ONLY the headers the RPC needs. Authorization passes through as
    // an opaque value - never read, never logged (custody rule, header comment).
    const headers: Record<string, string> = {};
    if (typeof req.headers.authorization === 'string') headers.authorization = req.headers.authorization;
    if (typeof req.headers['content-type'] === 'string') headers['content-type'] = req.headers['content-type'];
    if (typeof req.headers.accept === 'string') headers.accept = req.headers.accept;

    let upstream: Response;
    try {
      upstream = await fetchImpl(UPSTREAM_BASE + command, {
        method: 'POST',
        headers,
        body: body.length > 0 ? new Uint8Array(body) : undefined,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (err) {
      // Network failure / timeout. The hint stays generic: an upstream error
      // string could not contain the token, but keeping the body synthetic
      // guarantees nothing user-supplied is ever echoed.
      const timedOut = (err as Error)?.name === 'TimeoutError';
      sendJson(res, 502, {
        error: 'penpot-unreachable',
        hint: timedOut
          ? `design.penpot.app did not answer within ${UPSTREAM_TIMEOUT_MS / 1000}s`
          : 'could not reach design.penpot.app - check your connection and Penpot status',
      });
      return;
    }

    // Pass status + body through untouched; the shell interprets Penpot's own
    // JSON (including its error shapes). Command + status only - never headers.
    console.log(`[penpot] ${command} -> ${upstream.status}`);
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      ...CORS,
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    });
    res.end(payload);
  };
}

export default createPenpotProxy();
