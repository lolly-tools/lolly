// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request, type Server } from 'node:http';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import { createPenpotHttpServer } from '../services/penpot/http.ts';
import { createPenpotProxy, MAX_BODY } from '../services/penpot/vercel-entry.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';

async function listen(server: Server): Promise<string> {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test('standalone Penpot accepts only its exact RPC routes and preserves preflight and methods', async () => {
  let calls = 0;
  const server = createPenpotHttpServer(async () => { calls++; return new Response('[]'); });
  const base = await listen(server);
  try {
    for (const path of ['/api/mcp', '/rpc/get-all-projects', '/other/rpc/get-all-projects', '/api/penpot/nested/rpc/get-all-projects']) {
      assert.equal((await fetch(base + path, { method: 'POST' })).status, 404, path);
    }
    assert.equal((await fetch(`${base}/api/penpot/rpc/delete-project`, { method: 'POST' })).status, 403);
    assert.equal((await fetch(`${base}/api/penpot/rpc/get-all-projects`)).status, 405);
    const preflight = await fetch(`${base}/api/penpot/rpc/import-binfile`, { method: 'OPTIONS' });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
    assert.equal(calls, 0);
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.equal(await (await fetch(`${base}/healthz`, { method: 'HEAD' })).text(), '');
    assert.equal((await fetch(`${base}/healthz`, { method: 'POST' })).status, 405);
  } finally { await close(server); }
});

test('standalone Penpot preserves opaque Authorization and multipart bytes while discarding ambient credentials', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;
  const server = createPenpotHttpServer(async (url, init) => {
    seenUrl = String(url); seenInit = init;
    return new Response('{"type":"authentication"}', { status: 401, headers: { 'set-cookie': 'upstream=secret' } });
  });
  const base = await listen(server);
  const bytes = new Uint8Array([0, 255, 13, 10, 123]);
  try {
    const response = await fetch(`${base}/api/penpot/rpc/import-binfile/?upstream=https://attacker.invalid`, {
      method: 'POST', body: bytes,
      headers: {
        authorization: 'Token opaque-test-token', cookie: 'session=private',
        'proxy-authorization': 'Bearer private-proxy', 'content-type': 'multipart/form-data; boundary=exact',
      },
    });
    assert.equal(seenUrl, 'https://design.penpot.app/api/rpc/command/import-binfile');
    assert.equal(seenInit?.redirect, 'error');
    const headers = seenInit?.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Token opaque-test-token');
    assert.equal(headers['content-type'], 'multipart/form-data; boundary=exact');
    assert.equal(headers.cookie, undefined);
    assert.equal(headers['proxy-authorization'], undefined);
    assert.deepEqual(seenInit?.body, bytes);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), '{"type":"authentication"}');
  } finally { await close(server); }
});

test('standalone Penpot delivers import progress before the upstream stream finishes', async () => {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
  const server = createPenpotHttpServer(async () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } }));
  const base = await listen(server);
  const first = 'event: progress\ndata: {}\n\n';
  const last = 'event: end\ndata: ["file-id"]\n\n';
  try {
    const pending = fetch(`${base}/api/penpot/rpc/import-binfile`, { method: 'POST' });
    controller?.enqueue(new TextEncoder().encode(first));
    const response = await pending;
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    const reader = response.body?.getReader();
    assert.ok(reader);
    assert.equal(new TextDecoder().decode((await reader.read()).value), first);
    controller?.enqueue(new TextEncoder().encode(last));
    controller?.close();
    assert.equal(new TextDecoder().decode((await reader.read()).value), last);
    assert.equal((await reader.read()).done, true);
  } finally { await close(server); }
});

test('standalone Penpot rejects oversized Content-Length without calling upstream', async () => {
  let called = false;
  const server = createPenpotHttpServer(async () => { called = true; return new Response('[]'); });
  const base = await listen(server);
  try {
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(`${base}/api/penpot/rpc/import-binfile`, {
        method: 'POST', headers: { 'content-length': String(MAX_BODY + 1) },
      }, res => { res.resume(); resolve(res.statusCode ?? 0); });
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 413);
    assert.equal(called, false);
  } finally { await close(server); }
});

test('standalone Penpot bounds concurrent imports and restores exactly one slot on finish or disconnect', async () => {
  const controllers: ReadableStreamDefaultController<Uint8Array>[] = [];
  let cancellation: (() => void) | undefined;
  const cancelled = new Promise<void>(resolve => { cancellation = resolve; });
  const server = createPenpotHttpServer(async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controllers.push(controller);
      controller.enqueue(new TextEncoder().encode('event: progress\ndata: {}\n\n'));
    },
    cancel() { cancellation?.(); },
  }), { headers: { 'content-type': 'text/event-stream' } }));
  const base = await listen(server);
  const url = `${base}/api/penpot/rpc/import-binfile`;
  const post = () => fetch(url, { method: 'POST' });
  try {
    const first = await post();
    const refused = await post();
    assert.equal(refused.status, 503);
    assert.equal(refused.headers.get('retry-after'), '2');
    assert.equal(refused.headers.get('access-control-allow-origin'), '*');
    assert.equal(JSON.parse(await refused.text()).error, 'penpot-busy');
    assert.equal(controllers.length, 1, 'a refused import never reaches upstream');
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.equal((await fetch(url, { method: 'OPTIONS' })).status, 204);
    assert.equal((await fetch(`${base}/api/penpot/rpc/delete-project`, { method: 'POST' })).status, 403);
    controllers[0]?.close();
    await first.text();
    const second = await post();
    assert.equal(second.status, 200, 'completed response restores capacity');
    const stillRefused = await post();
    assert.equal(stillRefused.status, 503, 'finish followed by close releases only one slot');
    await stillRefused.text();
    await second.body?.cancel();
    await cancelled;
    const third = await post();
    assert.equal(third.status, 200, 'client disconnect restores capacity');
    controllers[2]?.close();
    await third.text();
    assert.equal(controllers.length, 3);
  } finally { await close(server); }
});

test('Penpot caps chunked and materialized raw bodies without exposing read errors', async () => {
  const block = Buffer.alloc(1024 * 1024);
  const chunks = Array.from({ length: 33 }, () => block);
  const requests = [
    Object.assign(Readable.from(chunks), { method: 'POST', url: '/api/penpot/rpc/import-binfile', headers: {} }),
    { method: 'POST', url: '/api/penpot/rpc/import-binfile', headers: {}, body: Buffer.alloc(MAX_BODY + 1) },
  ];
  for (const req of requests) {
    let status = 0;
    let body = '';
    const sink = Object.assign(new Writable({ write(_chunk, _encoding, callback) { callback(); } }), {
      writeHead(value: number) { status = value; return this; },
      end(value: string) { body = value; return this; },
    });
    await createPenpotProxy(async () => { throw new Error('must not fetch'); })(req as IncomingMessage, sink as unknown as ServerResponse);
    assert.equal(status, 413);
    assert.match(body, /request-too-large/);
  }
  const req = Object.assign(new Readable({ read() { this.destroy(new Error('Token private-value')); } }), {
    method: 'POST', url: '/api/penpot/rpc/import-binfile', headers: {},
  });
  let errorBody = '';
  const res = { writeHead() {}, end(body: string) { errorBody = body; } } as unknown as ServerResponse;
  await createPenpotProxy()(req as IncomingMessage, res);
  assert.doesNotMatch(errorBody, /private-value/);
});

test('public Penpot recipe keeps token, cookie, streaming and secret boundaries explicit', async () => {
  const files = await Promise.all(['penpot.caddy', 'penpot.compose.yml', 'penpot.Dockerfile'].map(name => readFile(new URL(`../deploy/docker/${name}`, import.meta.url), 'utf8')));
  const [caddy = '', compose = '', docker = ''] = files;
  assert.match(caddy, /handle \/api\/penpot\/\*/);
  assert.doesNotMatch(caddy, /handle_path|uri strip|header_up -Authorization|request_buffers|response_buffers/);
  assert.match(caddy, /max_size 33554432/);
  assert.match(caddy, /header_up -Cookie/);
  assert.match(caddy, /header_down -Set-Cookie/);
  assert.match(caddy, /flush_interval -1/);
  assert.match(compose, /127\.0\.0\.1:8791:8791/);
  assert.doesNotMatch(compose, /env_file:|volumes:|build:|CA_ROOT|LW_DATABASE|LOLLY_MCP_TOKEN/);
  assert.match(compose, /read_only: true/);
  assert.match(docker, /USER node/);
  assert.match(docker, /COPY services\/penpot/);
  assert.doesNotMatch(docker, /COPY \. \.|COPY brands|COPY engine|pnpm install/);
});
