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
 * deletion, ...) reachable from any origin with a stolen token. Only the two
 * commands the send flow actually uses may pass - list the user's projects,
 * and import a `.penpot` archive into the one they picked - and everything
 * else is 403. `import-binfile` answers a server-sent-event stream (progress
 * per section, then `end` or `error`), so the upstream body is PIPED through
 * rather than buffered.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** The ONLY RPC commands this proxy will relay - see the header comment. */
export const ALLOWLIST = [
  'get-all-projects',
  'import-binfile',
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

// Tell @vercel/node NOT to parse the body: import-binfile is
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

    // The timeout covers the REQUEST phase only (connect + headers). It is cleared
    // the moment upstream answers, so a body that is still streaming - an import
    // Penpot takes 26 s to finish and does finish - is never cut mid-flight; the
    // function's own maxDuration bounds the pipe below.
    const ac = new AbortController();
    let timerFired = false;
    const timer = setTimeout(() => { timerFired = true; ac.abort(); }, UPSTREAM_TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await fetchImpl(UPSTREAM_BASE + command, {
        method: 'POST',
        headers,
        body: body.length > 0 ? new Uint8Array(body) : undefined,
        signal: ac.signal,
      });
    } catch (err) {
      // Network failure / timeout. The hint stays generic: an upstream error
      // string could not contain the token, but keeping the body synthetic
      // guarantees nothing user-supplied is ever echoed.
      clearTimeout(timer);
      const timedOut = timerFired || (err as Error)?.name === 'TimeoutError';
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
    clearTimeout(timer);
    console.log(`[penpot] ${command} -> ${upstream.status}`);
    res.writeHead(upstream.status, {
      ...CORS,
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    });
    // import-binfile answers text/event-stream: PIPE it so an import's progress
    // events reach the browser as they happen instead of the whole stream being
    // held in memory until Penpot finishes. Buffering stays the fallback for a
    // response with no readable web stream (some fetch stubs).
    if (upstream.body) {
      try {
        await pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), res);
      } catch {
        // The client went away, or the stream broke after the head was sent -
        // there is no error body to write at that point, so just close.
        if (!res.writableEnded) res.end();
      }
    } else {
      res.end(Buffer.from(await upstream.arrayBuffer()));
    }
  };
}

export default createPenpotProxy();
