// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer, request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { prepareStaticDelivery, nginxDeliveryMaps } from '../scripts/build-delivery.ts';

const nginx = process.env.LOLLY_TEST_NGINX ?? 'nginx';
const installed = spawnSync(nginx, ['-v']).status === 0;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

for (const configuration of ['nginx.conf', 'public.nginx.conf']) {
test(`actual ${configuration} preserves validators, decoded signatures, ranges and private errors`, { skip: !installed }, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'lolly-nginx-'));
  const root = join(temporary, 'site'); mkdirSync(root);
  const allocator = createServer();
  await new Promise<void>(done => allocator.listen(0, '127.0.0.1', done));
  const address = allocator.address(); assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>(done => allocator.close(() => done()));
  const bytes = Buffer.from('const signed = "original";\n'.repeat(1000));
  const longAssetPath = `catalog/assets/${'variant'.repeat(28)}.0123456789abcdef.svg`;
  for (const name of ['index.html', 'sw.js', '_app/app.js', 'catalog/tools/index.json', longAssetPath]) {
    mkdirSync(resolve(root, name, '..'), { recursive: true }); writeFileSync(join(root, name), bytes);
  }
  prepareStaticDelivery(root);
  writeFileSync(join(temporary, 'delivery-maps.conf'), nginxDeliveryMaps());
  writeFileSync(join(temporary, 'delivery-etags.conf'), readFileSync(join(root, '.delivery-etags.conf')));
  for (const file of ['delivery-headers.conf', 'security-headers.conf']) {
    writeFileSync(join(temporary, file), readFileSync(resolve('deploy/docker', file), 'utf8').replaceAll('/etc/nginx/', `${temporary}/`));
  }
  const serverConfig = readFileSync(resolve('deploy/docker', configuration), 'utf8')
    .replaceAll('/etc/nginx/', `${temporary}/`)
    .replace('listen 8080;', `listen 127.0.0.1:${port};`)
    .replace('listen [::]:8080;', '')
    .replace(/root\s+\/usr\/share\/nginx\/html;/, `root ${root};`);
  writeFileSync(join(temporary, 'nginx.conf'), `pid ${temporary}/nginx.pid;\nerror_log ${temporary}/error.log;\nevents {}\nhttp { access_log off; ${serverConfig} }\n`);
  const child = spawn(nginx, ['-p', temporary, '-c', join(temporary, 'nginx.conf'), '-g', 'daemon off;']);
  let errors = ''; child.stderr.on('data', chunk => { errors += chunk; });
  const get = (path: string, headers: Record<string, string> = {}, method = 'GET') => new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; bytes: Buffer }>((done, reject) => {
    const call = request({ host: '127.0.0.1', port, path, headers, method }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => done({ status: response.statusCode!, headers: response.headers, bytes: Buffer.concat(chunks) }));
    }); call.on('error', reject); call.end();
  });
  try {
    for (let i = 0; i < 100; i++) {
      try { await get('/healthz'); break; } catch { if (child.exitCode !== null) throw new Error(errors); await delay(20); }
    }
    const identity = await get('/_app/app.js', { 'accept-encoding': 'identity' });
    assert.equal(identity.status, 200); assert.deepEqual(identity.bytes, bytes);
    assert.equal(identity.headers.etag, `"${sha(bytes)}"`);
    const longAsset = await get(`/${longAssetPath}`, { 'accept-encoding': 'identity' });
    assert.equal(longAsset.status, 200);
    assert.deepEqual(longAsset.bytes, bytes);
    assert.equal(longAsset.headers.etag, identity.headers.etag);
    assert.equal((await get(`/${longAssetPath}`, { 'if-none-match': longAsset.headers.etag! })).status, 304);
    assert.equal(identity.headers['last-modified'], undefined);
    assert.equal((await get('/_app/app.js', { 'if-modified-since': 'Wed, 01 Jan 2050 00:00:00 GMT' })).status, 200);
    assert.match(identity.headers['cache-control']!, /immutable, no-transform/);
    const compressed = await get('/_app/app.js', { 'accept-encoding': 'gzip' });
    assert.equal(compressed.headers['content-encoding'], 'gzip');
    assert.deepEqual(gunzipSync(compressed.bytes), bytes);
    assert.equal(compressed.headers.etag, `"${sha(compressed.bytes)}"`);
    assert.notEqual(identity.headers.etag, compressed.headers.etag);
    for (const [coding, tag] of [['identity', compressed.headers.etag], ['gzip', identity.headers.etag]] as const) {
      assert.equal((await get('/_app/app.js', { 'accept-encoding': coding, 'if-none-match': tag! })).status, 200);
    }
    const gzipDenied = await get('/_app/app.js', { 'accept-encoding': 'gzip;q=0, br' });
    assert.equal(gzipDenied.headers['content-encoding'], undefined);
    assert.equal(gzipDenied.headers.etag, identity.headers.etag);
    assert.equal((await get('/_app/app.js', { 'if-none-match': '*' })).status, 304);
    assert.equal((await get('/_app/app.js', { 'accept-encoding': 'gzip', 'if-none-match': 'W/' + compressed.headers.etag! })).status, 304);
    const brHash = `"${sha(readFileSync(join(root, '_app/app.js.br')))}"`;
    assert.equal((await get('/_app/app.js', { 'accept-encoding': 'gzip', 'if-none-match': brHash })).status, 200);
    for (const [coding, response] of [['identity', identity], ['gzip', compressed]] as const) {
      const unchanged = await get('/_app/app.js', { 'accept-encoding': coding, 'if-none-match': response.headers.etag! });
      assert.equal(unchanged.status, 304); assert.equal(unchanged.bytes.length, 0);
      assert.equal(unchanged.headers.etag, response.headers.etag);
      assert.match(unchanged.headers['cache-control']!, /immutable/);
      for (const tags of [
        `"unrelated", W/${response.headers.etag}`,
        `${identity.headers.etag}, ${compressed.headers.etag}`,
        `${compressed.headers.etag}, ${identity.headers.etag}`,
      ]) {
        const listed = await get('/_app/app.js', { 'accept-encoding': coding, 'if-none-match': tags });
        assert.equal(listed.status, 304);
        assert.equal(listed.headers.etag, response.headers.etag);
      }
    }
    const head = await get('/_app/app.js', { 'accept-encoding': 'identity' }, 'HEAD');
    assert.equal(head.bytes.length, 0); assert.equal(head.headers.etag, identity.headers.etag);
    const range = await get('/_app/app.js', { 'accept-encoding': 'identity', range: 'bytes=1-20', 'if-range': identity.headers.etag! });
    assert.equal(range.status, 206); assert.deepEqual(range.bytes, bytes.subarray(1, 21));
    const changed = await get('/_app/app.js', { range: 'bytes=1-20', 'if-range': '"wrong"' });
    assert.equal(changed.status, 200); assert.deepEqual(changed.bytes, bytes);
    const rootPage = await get('/');
    assert.equal(rootPage.status, 200, JSON.stringify(rootPage.headers));
    assert.equal(typeof rootPage.headers.etag, 'string', JSON.stringify(rootPage.headers));
    assert.equal((await get('/', { 'if-none-match': rootPage.headers.etag! })).status, 304);
    for (const path of ['/_app/missing.js', '/models/demo@aaaaaaaaaaaaaaaa/missing.onnx', '/catalog/missing.json', '/api/missing', '/tool/missing', '/info/missing.png']) {
      const missing = await get(path);
      assert.equal(missing.status, 404, path);
      assert.match(missing.headers['cache-control']!, /private, no-store/);
      assert.equal(missing.headers['cdn-cache-control'], 'no-store');
    }
    const sw = await get('/sw.js');
    assert.match(sw.headers['cache-control']!, /^no-cache/);
    assert.equal(sw.headers['cdn-cache-control'], 'no-store');
  } finally {
    child.kill('SIGTERM');
    await new Promise<void>(done => { if (child.exitCode !== null) done(); else child.once('exit', () => done()); });
    rmSync(temporary, { recursive: true, force: true });
  }
});
}
