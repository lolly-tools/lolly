// SPDX-License-Identifier: MPL-2.0
/** Exercise reference proxies as real isolated processes, never the live instance. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from 'node:zlib';
import { cachePolicy } from '../packages/core/src/delivery-v1.ts';

const nginx = process.env.LOLLY_TEST_NGINX ?? 'nginx';
const caddy = process.env.LOLLY_TEST_CADDY ?? 'caddy';
const available = (command: string, argument: string) => spawnSync(command, [argument]).status === 0;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const signedBytes = Buffer.from('<svg><metadata>c2pa:immutable-credential-fixture</metadata><text>Original asset</text></svg>\n'.repeat(80));
const tags = ['cache-tag', 'surrogate-key', 'x-cache-tag', 'x-cache-tags'];
type Reply = { status: number; headers: IncomingHttpHeaders; bytes: Buffer };

function get(port: number, path: string, headers: Record<string, string> = {}, method = 'GET'): Promise<Reply> {
  return new Promise((done, reject) => {
    const call = request({ host: '127.0.0.1', port, path, headers, method }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => done({ status: response.statusCode!, headers: response.headers, bytes: Buffer.concat(chunks) }));
    });
    call.on('error', reject); call.end();
  });
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return address.port;
}
async function close(server: Server): Promise<void> { await new Promise<void>(done => server.close(() => done())); }
async function unusedPort(): Promise<number> { const server = createServer(); const port = await listen(server); await close(server); return port; }

function launch(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): { child: ChildProcess; errors: () => string } {
  const child = spawn(command, args, { env });
  let errors = '';
  child.stderr?.on('data', chunk => { errors += String(chunk); });
  return { child, errors: () => errors };
}
async function ready(process: ReturnType<typeof launch>, port: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await get(port, '/healthz'); return; }
    catch { if (process.child.exitCode !== null) throw new Error(process.errors()); await delay(25); }
  }
  throw new Error('Reference proxy did not become ready: ' + process.errors());
}
async function stop(process: ReturnType<typeof launch>): Promise<void> {
  process.child.kill('SIGTERM');
  await new Promise<void>(done => { if (process.child.exitCode !== null) done(); else process.child.once('exit', () => done()); });
}

function originFixture() {
  const counts = new Map<string, number>(), requests: IncomingHttpHeaders[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://fixture.invalid');
    const key = url.pathname + url.search, count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count); requests.push(req.headers);
    const credential = req.headers.cookie ?? req.headers.authorization;
    const privateRequest = !!credential || url.pathname.startsWith('/api/') || url.searchParams.size > 0;
    const status = url.pathname.endsWith('/error') ? 503 : 200;
    const policy = cachePolicy(privateRequest ? 'person-private' : 'public-bounded', { status, boundedAgeSec: 3600, tokenBearing: privateRequest });
    res.writeHead(status, {
      ...(url.pathname.endsWith('/unclassified') ? {} : { 'Cache-Control': policy.cacheControl, 'CDN-Cache-Control': policy.cdnCacheControl }),
      'Referrer-Policy': 'no-referrer', 'Content-Type': 'image/svg+xml',
      'Content-Security-Policy': "default-src 'none'", 'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless', 'Vary': 'Accept-Encoding',
      ...Object.fromEntries(tags.map(name => [name, 'internal_release_tag'])),
      'X-Fixture-Origin-Read': String(count),
      ...(url.pathname.endsWith('/set-cookie') ? { 'Set-Cookie': 'fixture=opaque; HttpOnly; SameSite=Lax' } : {}),
      ...(!privateRequest && req.headers['accept-encoding'] === 'gzip' ? { 'Content-Encoding': 'gzip' } : {}),
    });
    const body = privateRequest ? Buffer.from(`${credential ?? url.search}:${count}`) : signedBytes;
    res.end(!privateRequest && req.headers['accept-encoding'] === 'gzip' ? gzipSync(body) : body);
  });
  return { server, counts, requests };
}

function assertHiddenHeaders(response: Reply): void {
  for (const tag of tags) assert.equal(response.headers[tag], undefined, tag);
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.equal(response.headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(response.headers['cross-origin-embedder-policy'], 'credentialless');
  assert.equal(response.headers['content-security-policy'], "default-src 'none'");
}

async function checkPrivateReaders(port: number, fixture: ReturnType<typeof originFixture>, path: string): Promise<void> {
  const replies: Reply[] = [];
  for (const cookie of ['reader=one', 'reader=two']) for (let repeat = 0; repeat < 2; repeat++) {
    const response = await get(port, path, { cookie }); replies.push(response);
    assert.equal(response.status, 200); assertHiddenHeaders(response);
    assert.equal(response.headers['cache-control'], cachePolicy('person-private').cacheControl);
    assert.equal(response.headers['cdn-cache-control'], 'no-store');
    assert.equal(response.headers.age, undefined);
    assert.doesNotMatch([response.headers['cache-status'], response.headers['x-cache']].join(' '), /\b(hit|cached|stored)\b/i);
    assert.ok(response.bytes.toString().startsWith(cookie + ':'));
  }
  assert.equal(new Set(replies.map(response => response.bytes.toString())).size, 4);
  assert.equal(fixture.counts.get(path), 4);
}

async function checkPublicBytes(port: number): Promise<void> {
  for (const coding of ['identity', 'gzip']) {
    const response = await get(port, '/tool/signed-fixture', { 'accept-encoding': coding });
    assert.equal(response.status, 200); assertHiddenHeaders(response);
    const decoded = coding === 'gzip' ? gunzipSync(response.bytes) : response.bytes;
    assert.equal(sha(decoded), sha(signedBytes)); assert.deepEqual(decoded, signedBytes);
    assert.equal(response.headers['cache-control'], cachePolicy('public-bounded', { boundedAgeSec: 3600 }).cacheControl);
  }
}

function assertForwarding(headers: IncomingHttpHeaders): void {
  assert.equal(headers['x-forwarded-for'], '127.0.0.1');
  assert.equal(headers['x-real-ip'], '127.0.0.1');
  assert.equal(headers.forwarded, undefined);
  assert.equal(headers['x-forwarded-proto'], 'http');
  const forwardedHost = headers['x-forwarded-host']; assert.ok(typeof forwardedHost === 'string');
  assert.doesNotMatch(forwardedHost, /attacker/);
}
const spoofedForwarding = {
  'x-forwarded-for': '203.0.113.9, 198.51.100.3', 'x-real-ip': '203.0.113.9',
  'x-forwarded-proto': 'https', 'x-forwarded-host': 'attacker.invalid',
  forwarded: 'for=203.0.113.9;host=attacker.invalid;proto=https',
};

function nginxConfig(temporary: string, port: number, upstream: number): string {
  const reference = readFileSync(resolve('deploy/edge/nginx-render-cache.conf'), 'utf8')
    .replace('/var/cache/lolly/render', join(temporary, 'cache'))
    .replace('listen 8081;', `listen 127.0.0.1:${port};`)
    .replaceAll('__MCP_UPSTREAM__', `127.0.0.1:${upstream}`).replace('__RELEASE_ID__', 'fixture-release');
  return `pid ${temporary}/nginx.pid;\nerror_log ${temporary}/error.log;\nevents {}\nhttp { access_log off; proxy_temp_path ${temporary}/proxy; ${reference} }\n`;
}

test('reference Nginx cache preserves bytes, isolates cookies and strips spoofing across two hops', { skip: !available(nginx, '-v') }, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'lolly-reference-nginx-'));
  const fixture = originFixture(), originPort = await listen(fixture.server);
  const proxies: ReturnType<typeof launch>[] = [];
  try {
    const innerPort = await unusedPort(), outerPort = await unusedPort();
    for (const [name, port, upstream] of [['inner', innerPort, originPort], ['outer', outerPort, innerPort]] as const) {
      const folder = join(temporary, name); mkdirSync(folder);
      const file = join(folder, 'nginx.conf'); writeFileSync(file, nginxConfig(folder, port, upstream));
      const process = launch(nginx, ['-p', folder, '-c', file, '-g', 'daemon off;']); proxies.push(process);
      await ready(process, port);
    }
    await checkPrivateReaders(outerPort, fixture, '/tool/private');
    await checkPrivateReaders(outerPort, fixture, '/api/private');
    await checkPublicBytes(outerPort);
    await get(outerPort, '/tool/cache-proof'); await get(outerPort, '/tool/cache-proof');
    assert.equal(fixture.counts.get('/tool/cache-proof'), 1, 'only explicitly public origin responses may be reused');
    for (const path of ['/tool/unclassified', '/tool/set-cookie', '/tool/query?dt=opaque', '/tool/query?sig=opaque', '/tool/query?%64t=opaque']) {
      await get(outerPort, path); await get(outerPort, path);
      assert.equal(fixture.counts.get(path), 2, path);
    }
    for (let repeat = 0; repeat < 2; repeat++) await get(outerPort, '/tool/bearer', { authorization: 'Bearer fixture' });
    assert.equal(fixture.counts.get('/tool/bearer'), 2);
    const error = await get(outerPort, '/tool/error');
    assert.equal(error.status, 503); assert.equal(error.headers.age, undefined);
    assert.equal(error.headers['cache-control'], cachePolicy('public-bounded', { status: 503 }).cacheControl);
    assert.equal(error.headers['cdn-cache-control'], 'no-store'); assertHiddenHeaders(error);
    await get(outerPort, '/api/forwarding', spoofedForwarding); assertForwarding(fixture.requests.at(-1)!);
  } finally {
    for (const proxy of proxies.reverse()) await stop(proxy);
    await close(fixture.server); rmSync(temporary, { recursive: true, force: true });
  }
});

function caddyConfig(temporary: string, root: string, port: number, upstream: number): string {
  const reference = readFileSync(resolve('deploy/edge/Caddyfile'), 'utf8')
    .replaceAll('{$LOLLY_HOST}', `http://127.0.0.1:${port}`)
    .replaceAll('{$LOLLY_MCP_UPSTREAM}', `127.0.0.1:${upstream}`)
    .replaceAll('{$LOLLY_STATIC_ROOT}', root);
  const file = join(temporary, 'Caddyfile');
  writeFileSync(file, `{\n admin off\n auto_https off\n persist_config off\n storage file_system {\n  root ${temporary}/storage\n }\n}\n${reference}`); return file;
}

async function checkCaddyFiles(port: number, bytes: Buffer): Promise<void> {
  const policy = cachePolicy('public-revalidate');
  const identity = await get(port, '/asset.svg', { 'accept-encoding': 'identity' });
  assert.equal(identity.status, 200); assert.deepEqual(identity.bytes, bytes);
  assert.equal(identity.headers['cache-control'], policy.cacheControl);
  assert.equal(identity.headers['cdn-cache-control'], policy.cdnCacheControl);
  for (const [coding, decode] of [['gzip', gunzipSync], ['br', brotliDecompressSync]] as const) {
    const response = await get(port, '/asset.svg', { 'accept-encoding': coding });
    assert.equal(response.headers['content-encoding'], coding); assert.deepEqual(decode(response.bytes), bytes);
    assert.equal((await get(port, '/asset.svg', { 'accept-encoding': coding, 'if-none-match': response.headers.etag! })).status, 304);
  }
  assert.equal((await get(port, '/asset.svg', { 'if-none-match': identity.headers.etag! })).status, 304);
  const ranged = await get(port, '/asset.svg', { range: 'bytes=2-15', 'if-range': identity.headers.etag! });
  assert.equal(ranged.status, 206); assert.deepEqual(ranged.bytes, bytes.subarray(2, 16));
  // Native Caddy metadata validators are not the qualified full-SHA delivery origin.
  assert.notEqual(identity.headers.etag, `"${sha(bytes)}"`);
  for (const path of ['/catalog/missing.json', '/tools/demo@aaaaaaaaaaaaaaaa/missing.js', '/models/missing.onnx', '/models/manifest.json', '/.delivery-etags.conf']) {
    const missing = await get(port, path);
    assert.equal(missing.status, 404); assert.equal(missing.headers['cache-control'], cachePolicy('person-private').cacheControl);
    assert.equal(missing.headers['cdn-cache-control'], 'no-store');
  }
  const sw = await get(port, '/sw.js');
  assert.equal(sw.headers['cache-control'], 'no-cache, s-maxage=0, no-transform');
  assert.equal(sw.headers['cdn-cache-control'], 'no-store'); assert.equal(sw.headers['service-worker-allowed'], '/');
}

test('reference Caddy preserves proxy privacy and bytes, conservative static policy and real missing responses', { skip: !available(caddy, 'version') }, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'lolly-reference-caddy-')), root = join(temporary, 'site'); mkdirSync(root);
  writeFileSync(join(root, 'asset.svg'), signedBytes);
  writeFileSync(join(root, 'asset.svg.gz'), gzipSync(signedBytes)); writeFileSync(join(root, 'asset.svg.br'), brotliCompressSync(signedBytes));
  writeFileSync(join(root, 'sw.js'), 'self.fixture = true;');
  writeFileSync(join(root, '.delivery-etags.conf'), 'internal fixture inventory');
  mkdirSync(join(root, 'models')); writeFileSync(join(root, 'models/manifest.json'), 'internal fixture model metadata');
  const fixture = originFixture(), upstream = await listen(fixture.server), port = await unusedPort();
  const process = launch(caddy, ['run', '--config', caddyConfig(temporary, root, port, upstream), '--adapter', 'caddyfile']);
  try {
    await ready(process, port);
    await checkPrivateReaders(port, fixture, '/tool/private');
    await checkPrivateReaders(port, fixture, '/api/private');
    await checkPublicBytes(port);
    await get(port, '/api/forwarding', spoofedForwarding); assertForwarding(fixture.requests.at(-1)!);
    const error = await get(port, '/api/error');
    assert.equal(error.status, 503); assert.equal(error.headers['cache-control'], cachePolicy('person-private').cacheControl);
    assert.equal(error.headers['cdn-cache-control'], 'no-store'); assert.equal(error.headers.age, undefined); assertHiddenHeaders(error);
    await checkCaddyFiles(port, signedBytes);
  } finally { await stop(process); await close(fixture.server); rmSync(temporary, { recursive: true, force: true }); }
});
