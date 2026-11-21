// SPDX-License-Identifier: MPL-2.0
/**
 * The local server behind `lolly app`, driven over a real socket on a port the system
 * picks, against a small built-app fixture in a temporary directory.
 *
 * Requests go through node:http, not fetch: the refusals under test (a foreign Host, a
 * path that climbs out of the directory) are ones fetch would tidy away before sending.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request, type IncomingHttpHeaders } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import {
  APP_PING_MARKER, APP_PING_PATH, AppServerError, cleanRequestPath, isOwnHost, probePort, startAppServer,
  type AppServer,
} from '../src/web-app-server.ts';
import { HOSTING, compileSource, hostedHeaders, resolveRoute } from '../src/web-app-routes.ts';

const REPO_ROOT = new URL('../../../', import.meta.url).pathname;

const FILES: Record<string, string> = {
  'index.html': '<!doctype html><title>shell</title>',
  'sw.js': '// worker',
  'precache.json': JSON.stringify({ version: 'build-123', groups: {} }),
  'manifest.webmanifest': '{}',
  '_app/main-abc123.js': 'console.log("plain");',
  '_app/main-abc123.js.br': 'BROTLI-BYTES',
  '_app/main-abc123.js.gz': 'GZIP-BYTES',
  '_app/kernel.wasm': 'wasm',
  'catalog/tools/index.json': '{"tools":[]}',
  'catalog/tools/index.sig.json': '{"sig":"x"}',
  'catalog/logo.svg': '<svg/>',
  'fonts/face.woff2': 'font',
  'info/index.html': '<!doctype html><title>docs</title>',
  'info/build/cli.html': '<!doctype html><title>cli</title>',
  'view/tools.html': '<!doctype html><title>tools stub</title>',
  't/qr-code.html': '<!doctype html><title>qr stub</title>',
  '.env': 'SECRET=1',
  'catalog/.hidden/file.txt': 'hidden',
};

let dir = '';
let outside = '';
let app: AppServer;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'lolly-app-server-'));
  for (const [rel, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  outside = `${dir}-outside.txt`;
  writeFileSync(outside, 'outside the served directory');
  app = await startAppServer({ dir, port: 0 });
});

after(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
  rmSync(outside, { force: true });
});

interface Answer { status: number; headers: IncomingHttpHeaders; body: string }

function send(path: string, opts: { method?: string; headers?: Record<string, string>; port?: number } = {}): Promise<Answer> {
  const port = opts.port ?? app.port;
  return new Promise((done, fail) => {
    const req = request({
      host: '127.0.0.1', port, path, method: opts.method ?? 'GET',
      headers: { host: `127.0.0.1:${port}`, ...opts.headers },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => done({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', fail);
    req.end();
  });
}

test('a request whose Host is not this server is refused', async () => {
  for (const host of ['evil.example', 'evil.example:80', `127.0.0.1:${app.port + 1}`, `lolly.tools:${app.port}`, `[::1]:${app.port}`]) {
    const res = await send('/', { headers: { host } });
    assert.equal(res.status, 403, host);
    assert.doesNotMatch(res.body, /shell/, host);
  }
  assert.equal((await send('/', { headers: { host: `localhost:${app.port}` } })).status, 200);
  assert.equal((await send('/')).status, 200);
  assert.equal(isOwnHost(undefined, 47474), false);
  assert.equal(isOwnHost('127.0.0.1', 47474), false, 'a Host with no port is not this origin');
});

test('only GET and HEAD are served', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const res = await send('/index.html', { method });
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.allow, 'GET, HEAD');
  }
  const head = await send('/index.html', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], String(FILES['index.html']!.length));
});

test('a path cannot climb out of the served directory', async () => {
  const name = outside.slice(outside.lastIndexOf('/') + 1);
  for (const path of [`/../${name}`, `/%2e%2e/${name}`, `/_app/../../${name}`, `/_app/%2e%2e%2f%2e%2e%2f${name}`, `/..%2f${name}`, `/_app/..%5c..%5c${name}`, `//${name}`, '/%00', '/%zz']) {
    const res = await send(path);
    assert.ok([400, 404].includes(res.status), `${path} answered ${res.status}`);
    assert.doesNotMatch(res.body, /outside the served directory/, path);
  }
  assert.deepEqual(cleanRequestPath('http://other.example/'), { refuse: 400 });
  assert.deepEqual(cleanRequestPath('/a/../b'), { refuse: 404 });
});

test('dotfiles and dot directories are never served', async () => {
  for (const path of ['/.env', '/catalog/.hidden/file.txt', '/.well-known/lolly.json', '/.git/config']) {
    const res = await send(path);
    assert.equal(res.status, 404, path);
    assert.doesNotMatch(res.body, /SECRET|hidden/, path);
  }
});

test('a directory is never listed', async () => {
  for (const path of ['/catalog/', '/_app/', '/fonts/', '/catalog/tools/']) {
    assert.equal((await send(path)).status, 404, path);
  }
  // Without the closing slash the hosted rewrite reads these as app routes: the shell, never a listing.
  for (const path of ['/catalog', '/fonts']) {
    assert.match((await send(path)).body, /<title>shell<\/title>/, path);
  }
});

test('app routes get the shell, and the static families do not', async () => {
  for (const path of ['/', '/some/client/route', '/any-site/', '/any-site/deep']) {
    const res = await send(path);
    assert.equal(res.status, 200, path);
    assert.match(res.body, /<title>shell<\/title>/, path);
  }
  // The families the hosted rewrite keeps away from the shell answer as missing.
  for (const path of ['/_app/missing.js', '/catalog/missing.json', '/fonts/none.woff2', '/tool/qr-code', '/tool/qr-code.svg', '/api/mcp', '/info/none.html', '/models/x.onnx']) {
    assert.equal((await send(path)).status, 404, path);
  }
  assert.match((await send('/tools')).body, /tools stub/);
  assert.match((await send('/t/qr-code')).body, /qr stub/);
  assert.match((await send('/docs')).body, /<title>docs<\/title>/);
  assert.match((await send('/docs/build/cli')).body, /<title>cli<\/title>/);
  // A build made without the share-card pages still opens the shell at those addresses.
  assert.match((await send('/t/chart')).body, /<title>shell<\/title>/);
  assert.match((await send('/profile')).body, /<title>shell<\/title>/);
});

test('redirects keep the query, and a directory page gains its closing slash', async () => {
  const moved = await send('/t/layout-studio?x=1');
  assert.equal(moved.status, 308);
  assert.equal(moved.headers.location, '/design?x=1');
  const docs = await send('/info');
  assert.equal(docs.status, 308);
  assert.equal(docs.headers.location, '/info/');
  assert.match((await send('/info/')).body, /<title>docs<\/title>/);
});

test('content types follow the extension', async () => {
  const expected: Record<string, string> = {
    '/': 'text/html; charset=utf-8',
    '/_app/main-abc123.js': 'text/javascript; charset=utf-8',
    '/_app/kernel.wasm': 'application/wasm',
    '/catalog/tools/index.json': 'application/json; charset=utf-8',
    '/catalog/logo.svg': 'image/svg+xml',
    '/fonts/face.woff2': 'font/woff2',
    '/manifest.webmanifest': 'application/manifest+json',
  };
  for (const [path, type] of Object.entries(expected)) {
    assert.equal((await send(path)).headers['content-type'], type, path);
  }
});

test('hashed build output caches for a year; the shell, the worker and the signature revalidate', async () => {
  assert.match((await send('/_app/main-abc123.js')).headers['cache-control']!, /max-age=31536000.*immutable/);
  for (const path of ['/', '/index.html', '/some/client/route', '/catalog/tools/index.sig.json', '/manifest.webmanifest']) {
    const value = (await send(path)).headers['cache-control']!;
    assert.match(value, /max-age=0/, path);
    assert.match(value, /must-revalidate/, path);
  }
  assert.match((await send('/sw.js')).headers['cache-control']!, /^no-cache/);
  // A missing hashed path must not be remembered as missing for a year.
  assert.match((await send('/_app/missing.js')).headers['cache-control']!, /no-store/);
});

test('an unchanged file answers 304 to its own ETag', async () => {
  const first = await send('/index.html');
  const etag = first.headers.etag!;
  assert.ok(etag);
  const again = await send('/index.html', { headers: { 'if-none-match': etag } });
  assert.equal(again.status, 304);
  assert.equal(again.body, '');
});

test('a byte range is served from the plain file', async () => {
  const text = FILES['_app/main-abc123.js']!;
  const part = await send('/_app/main-abc123.js', { headers: { range: 'bytes=0-6', 'accept-encoding': 'br' } });
  assert.equal(part.status, 206);
  assert.equal(part.body, text.slice(0, 7));
  assert.equal(part.headers['content-range'], `bytes 0-6/${text.length}`);
  assert.equal(part.headers['content-encoding'], undefined);
  const tail = await send('/_app/main-abc123.js', { headers: { range: 'bytes=-3' } });
  assert.equal(tail.body, text.slice(-3));
  assert.equal((await send('/_app/main-abc123.js', { headers: { range: 'bytes=9999-' } })).status, 416);
});

test('a precompressed sibling is sent when the client accepts that encoding', async () => {
  const path = '/_app/main-abc123.js';
  const br = await send(path, { headers: { 'accept-encoding': 'gzip, deflate, br' } });
  assert.equal(br.headers['content-encoding'], 'br');
  assert.equal(br.body, 'BROTLI-BYTES');
  assert.equal(br.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(br.headers.vary, 'Accept-Encoding');
  const gz = await send(path, { headers: { 'accept-encoding': 'gzip, br;q=0' } });
  assert.equal(gz.headers['content-encoding'], 'gzip');
  assert.equal(gz.body, 'GZIP-BYTES');
  const plain = await send(path);
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.equal(plain.body, FILES['_app/main-abc123.js']);
  assert.notEqual(br.headers.etag, plain.headers.etag, 'each encoding has an ETag of its own');
  // A file with no sibling is sent plain whatever the client accepts.
  assert.equal((await send('/sw.js', { headers: { 'accept-encoding': 'br, gzip' } })).headers['content-encoding'], undefined);
});

test('every answer carries the hosted deployment security headers', async () => {
  const hosted = hostedHeaders('/');
  for (const key of ['Content-Security-Policy', 'Referrer-Policy', 'X-Content-Type-Options', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Embedder-Policy', 'Permissions-Policy']) {
    assert.ok(hosted[key], `vercel.json no longer sends ${key}`);
  }
  for (const [path, opts] of [['/', {}], ['/_app/main-abc123.js', {}], ['/_app/missing.js', {}], [APP_PING_PATH, {}], ['/', { method: 'POST' }], ['/', { headers: { host: 'evil.example' } }]] as const) {
    const res = await send(path, opts);
    for (const [key, value] of Object.entries(hosted)) assert.equal(res.headers[key.toLowerCase()], value, `${key} on ${path}`);
  }
});

test('the headers are the ones vercel.json holds, read and not copied', () => {
  const file = JSON.parse(readFileSync(join(REPO_ROOT, 'vercel.json'), 'utf8')) as typeof HOSTING;
  const block = (source: string): Record<string, string> =>
    Object.fromEntries(file.headers!.find(rule => rule.source === source)!.headers.map(h => [h.key, h.value]));
  assert.deepEqual(hostedHeaders('/t/chart'), block('/((?!any-site(?:/|$)).*)'));
  assert.deepEqual(hostedHeaders('/any-site/t/chart'), block('/any-site(/.*)?'));
  assert.notEqual(hostedHeaders('/any-site')['Content-Security-Policy'], hostedHeaders('/')['Content-Security-Policy']);
  assert.equal(hostedHeaders('/info/shots/a.png.c2pa')['Content-Type'], 'application/c2pa');
  assert.equal(hostedHeaders('/')['Cache-Control'], undefined, 'cache headers come from the delivery rules');
});

test('every route and header rule in vercel.json compiles', () => {
  const sources = [...(HOSTING.rewrites ?? []), ...(HOSTING.redirects ?? []), ...(HOSTING.headers ?? [])].map(rule => rule.source);
  assert.ok(sources.length > 40);
  for (const source of sources) assert.doesNotThrow(() => compileSource(source), source);
  assert.throws(() => compileSource('/a/[b]'), /Unsupported/);
  assert.equal(compileSource('/agents.md').test('/agentsxmd'), false, 'a dot in a source is a literal dot');
  assert.deepEqual({ ...compileSource('/t/:id').exec('/t/chart')!.groups }, { id: 'chart' });
});

test('a rewrite to a server function or another host is missing here, not the shell', () => {
  const everything = (): boolean => true;
  for (const path of ['/api/mcp', '/tool/chart.svg', '/models/a/b.onnx', '/api/ca/x']) {
    assert.deepEqual(resolveRoute(path, p => p === '/index.html'), { kind: 'missing' }, path);
  }
  // A file that exists wins over a rewrite, as it does on the hosted deployment.
  assert.deepEqual(resolveRoute('/tools/qr-code/tool.json', everything), { kind: 'file', path: '/tools/qr-code/tool.json' });
});

test('the ping answers with the app marker and the build version', async () => {
  const res = await send(APP_PING_PATH);
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(res.body), { app: APP_PING_MARKER, version: 'build-123' });
  assert.equal(app.version, 'build-123');
});

test('a taken port: a running Lolly is recognised', async () => {
  await assert.rejects(startAppServer({ dir, port: app.port }), (err: unknown) => err instanceof AppServerError && err.code === 'EADDRINUSE');
  assert.deepEqual(await probePort(app.port), { kind: 'lolly', version: 'build-123' });
});

test('a taken port: another program is reported as foreign', async () => {
  const answers: Array<(res: import('node:http').ServerResponse) => void> = [
    res => res.end('hello'),
    res => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ app: 'something-else' })); },
    res => { res.statusCode = 500; res.end(JSON.stringify({ app: APP_PING_MARKER })); },
    () => { /* never answers */ },
  ];
  for (const answer of answers) {
    const other = createServer((_req, res) => answer(res));
    await new Promise<void>(done => other.listen(0, '127.0.0.1', done));
    const port = (other.address() as AddressInfo).port;
    await assert.rejects(startAppServer({ dir, port }), (err: unknown) => err instanceof AppServerError && err.code === 'EADDRINUSE');
    assert.deepEqual(await probePort(port, 300), { kind: 'foreign' });
    other.closeAllConnections();
    await new Promise<void>(done => other.close(() => done()));
  }
});

test('a directory with no index.html is refused before anything listens', async () => {
  const empty = mkdtempSync(join(tmpdir(), 'lolly-app-empty-'));
  try {
    await assert.rejects(startAppServer({ dir: empty, port: 0 }), /no index\.html/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test('the server listens on the loopback address only', () => {
  assert.equal((app.server.address() as AddressInfo).address, '127.0.0.1');
});
