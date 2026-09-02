// SPDX-License-Identifier: MPL-2.0
/**
 * The Penpot RPC proxy (services/penpot/vercel-entry.ts) at its contract seams.
 *
 * The proxy is transport-only: an allowlisted command forwards POST + the
 * opaque Authorization header + the RAW body byte-exact to design.penpot.app;
 * everything else is refused. These tests exercise the HANDLER SOURCE (not the
 * generated api/penpot bundle) with a stubbed fetch, and spy on console to
 * prove the custody rule - the token never appears in anything the handler
 * logs, whatever the outcome.
 *
 * Run with: node --test tests/penpot-fn.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { ALLOWLIST, createPenpotProxy } from '../services/penpot/vercel-entry.ts';

const TOKEN = 'Token super-secret-pat-value';

/** A fake IncomingMessage: a real Readable stream so readRawBody buffers it. */
function makeReq(opts: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: Buffer | string;
}): IncomingMessage {
  const body = opts.body === undefined ? Buffer.alloc(0) : Buffer.from(opts.body);
  const req = Readable.from(body.length ? [body] : []) as unknown as IncomingMessage;
  (req as { method?: string }).method = opts.method ?? 'POST';
  (req as { url?: string }).url = opts.url ?? '/api/penpot/rpc/get-all-projects';
  (req as { headers: Record<string, string> }).headers = opts.headers ?? {};
  return req;
}

/** A fake ServerResponse capturing status, headers, and body. A REAL Writable:
 *  the handler pipes the upstream stream into it (import-binfile answers SSE),
 *  and a pipe needs a destination with the whole Writable surface, not two
 *  stubbed methods. */
function makeRes(): {
  res: ServerResponse;
  status: () => number;
  headers: () => Record<string, string>;
  body: () => Buffer;
} {
  let status = 0;
  let headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(c: Buffer, _enc, cb) { chunks.push(Buffer.from(c)); cb(); },
  });
  (sink as unknown as { writeHead: (s: number, h?: Record<string, string>) => unknown }).writeHead =
    (s: number, h?: Record<string, string>) => { status = s; headers = h ?? {}; return sink; };
  return {
    res: sink as unknown as ServerResponse,
    status: () => status,
    headers: () => headers,
    body: () => Buffer.concat(chunks),
  };
}

/** Run fn with console spied; returns everything logged, stringified. */
async function withConsoleSpy(fn: () => Promise<void>): Promise<string> {
  const logged: string[] = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  const spy = (...args: unknown[]) => { logged.push(args.map((a) => String(a)).join(' ')); };
  console.log = spy; console.warn = spy; console.error = spy;
  try { await fn(); } finally { console.log = orig.log; console.warn = orig.warn; console.error = orig.error; }
  return logged.join('\n');
}

const okJson = () =>
  new Response('[{"id":"p1"}]', { status: 200, headers: { 'content-type': 'application/json' } });

// ─── forwarding ──────────────────────────────────────────────────────────────

test('allowlisted command forwards POST with Authorization and raw body intact', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;
  const handler = createPenpotProxy(async (url, init) => {
    seenUrl = String(url); seenInit = init; return okJson();
  });

  // Binary body stands in for multipart - it must pass through byte-exact.
  const raw = Buffer.from([0x7b, 0x00, 0xff, 0x0d, 0x0a, 0x7d]);
  const { res, status, headers, body } = makeRes();
  const logged = await withConsoleSpy(() =>
    handler(
      makeReq({
        url: '/api/penpot/rpc/import-binfile',
        headers: {
          authorization: TOKEN,
          'content-type': 'multipart/form-data; boundary=xyz',
          accept: 'application/json',
        },
        body: raw,
      }),
      res,
    ),
  );

  assert.equal(seenUrl, 'https://design.penpot.app/api/rpc/command/import-binfile');
  assert.equal(seenInit?.method, 'POST');
  const h = seenInit?.headers as Record<string, string>;
  assert.equal(h.authorization, TOKEN, 'PAT must transit untouched');
  assert.equal(h['content-type'], 'multipart/form-data; boundary=xyz');
  assert.equal(h.accept, 'application/json');
  assert.deepEqual(Buffer.from(seenInit?.body as Uint8Array), raw, 'body must be byte-exact');

  assert.equal(status(), 200);
  assert.equal(body().toString(), '[{"id":"p1"}]');
  // CORS headers ride every POST response - that is the whole point of the proxy.
  assert.equal(headers()['access-control-allow-origin'], '*');
  assert.equal(headers()['access-control-allow-headers'], 'authorization, content-type');
  assert.equal(headers()['access-control-allow-methods'], 'POST, OPTIONS');
  assert.ok(!logged.includes('super-secret-pat-value'), 'token must never be logged');
});

test('every allowlisted command is accepted', async () => {
  for (const cmd of ALLOWLIST) {
    const handler = createPenpotProxy(async () => okJson());
    const { res, status } = makeRes();
    await withConsoleSpy(() =>
      handler(makeReq({ url: `/api/penpot/rpc/${cmd}`, headers: { authorization: TOKEN } }), res),
    );
    assert.equal(status(), 200, `${cmd} should proxy`);
  }
});

test('import-binfile streams the upstream body through with its own content-type', async () => {
  // The real answer is a server-sent-event stream: progress per section, then
  // `end` with the new file id. The handler must PIPE it, not buffer it.
  const sse = 'event: progress\ndata: {"~:section":"~:manifest"}\n\nevent: end\ndata: ["~ubf9b4e3a-0b2a-4a4c-9c1e-2a6b7d8e9f01"]\n\n';
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(sse.slice(0, 40)));
      c.enqueue(new TextEncoder().encode(sse.slice(40)));
      c.close();
    },
  });
  const handler = createPenpotProxy(async () =>
    new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
  const { res, status, headers, body } = makeRes();
  await withConsoleSpy(() =>
    handler(makeReq({ url: '/api/penpot/rpc/import-binfile', headers: { authorization: TOKEN } }), res));

  assert.equal(status(), 200);
  assert.equal(headers()['content-type'], 'text/event-stream');
  assert.equal(headers()['access-control-allow-origin'], '*');
  assert.equal(body().toString(), sse, 'every chunk reaches the caller, in order');
});

// ─── the allowlist boundary ──────────────────────────────────────────────────

test('the retired publish commands are off the allowlist now', async () => {
  // create-file + upload-file-media-object were the 2.x no-op path (an
  // is-local=false media row nothing references); import-binfile replaced them.
  for (const cmd of ['create-file', 'upload-file-media-object', 'get-project-files']) {
    let fetched = false;
    const handler = createPenpotProxy(async () => { fetched = true; return okJson(); });
    const { res, status } = makeRes();
    await withConsoleSpy(() =>
      handler(makeReq({ url: `/api/penpot/rpc/${cmd}`, headers: { authorization: TOKEN } }), res));
    assert.equal(status(), 403, `${cmd} must be refused`);
    assert.equal(fetched, false, `${cmd} must never reach upstream`);
  }
});

test('a command off the allowlist is refused with 403 naming the allowlist', async () => {
  let fetched = false;
  const handler = createPenpotProxy(async () => { fetched = true; return okJson(); });
  const { res, status, headers, body } = makeRes();
  const logged = await withConsoleSpy(() =>
    handler(
      makeReq({ url: '/api/penpot/rpc/delete-project', headers: { authorization: TOKEN } }),
      res,
    ),
  );

  assert.equal(status(), 403);
  assert.equal(fetched, false, 'nothing may reach upstream');
  const parsed = JSON.parse(body().toString());
  for (const cmd of ALLOWLIST) assert.ok(String(parsed.hint).includes(cmd), `hint names ${cmd}`);
  assert.equal(headers()['access-control-allow-origin'], '*');
  assert.ok(!logged.includes('super-secret-pat-value'));
});

test('a path with no /rpc/<command> segment is refused too', async () => {
  const handler = createPenpotProxy(async () => okJson());
  const { res, status } = makeRes();
  await withConsoleSpy(() => handler(makeReq({ url: '/api/penpot/anything' }), res));
  assert.equal(status(), 403);
});

// ─── preflight + method gate ─────────────────────────────────────────────────

test('OPTIONS short-circuits to 204 with the three CORS headers', async () => {
  const handler = createPenpotProxy(async () => { throw new Error('must not fetch'); });
  const { res, status, headers, body } = makeRes();
  await withConsoleSpy(() => handler(makeReq({ method: 'OPTIONS' }), res));

  assert.equal(status(), 204);
  assert.equal(body().length, 0);
  assert.equal(headers()['access-control-allow-origin'], '*');
  assert.equal(headers()['access-control-allow-headers'], 'authorization, content-type');
  assert.equal(headers()['access-control-allow-methods'], 'POST, OPTIONS');
});

test('non-POST methods get 405', async () => {
  const handler = createPenpotProxy(async () => okJson());
  const { res, status, headers } = makeRes();
  await withConsoleSpy(() => handler(makeReq({ method: 'GET' }), res));
  assert.equal(status(), 405);
  assert.equal(headers()['access-control-allow-origin'], '*');
});

// ─── upstream failure ────────────────────────────────────────────────────────

test('upstream network failure returns 502 with a JSON hint, token unlogged', async () => {
  const handler = createPenpotProxy(async () => { throw new TypeError('fetch failed'); });
  const { res, status, headers, body } = makeRes();
  const logged = await withConsoleSpy(() =>
    handler(
      makeReq({ url: '/api/penpot/rpc/import-binfile', headers: { authorization: TOKEN } }),
      res,
    ),
  );

  assert.equal(status(), 502);
  const parsed = JSON.parse(body().toString());
  assert.equal(parsed.error, 'penpot-unreachable');
  assert.ok(String(parsed.hint).includes('design.penpot.app'));
  assert.ok(!JSON.stringify(parsed).includes('super-secret-pat-value'), 'error body must not echo the token');
  assert.equal(headers()['access-control-allow-origin'], '*');
  assert.ok(!logged.includes('super-secret-pat-value'));
});

test('upstream non-2xx status passes through untouched', async () => {
  const handler = createPenpotProxy(async () =>
    new Response('{"type":"authentication"}', { status: 401, headers: { 'content-type': 'application/json' } }),
  );
  const { res, status, body } = makeRes();
  await withConsoleSpy(() =>
    handler(makeReq({ url: '/api/penpot/rpc/get-all-projects', headers: { authorization: TOKEN } }), res),
  );
  assert.equal(status(), 401, 'Penpot speaks its own error statuses through the proxy');
  assert.equal(body().toString(), '{"type":"authentication"}');
});
