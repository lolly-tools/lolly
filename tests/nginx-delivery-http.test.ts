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

async function unusedPort(): Promise<number> {
  const allocator = createServer();
  await new Promise<void>(done => allocator.listen(0, '127.0.0.1', done));
  const address = allocator.address(); assert.ok(address && typeof address !== 'string');
  await new Promise<void>(done => allocator.close(() => done()));
  return address.port;
}

for (const configuration of ['nginx.conf', 'public.nginx.conf']) {
test(`actual ${configuration} preserves validators, decoded signatures, ranges and private errors`, { skip: !installed }, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'lolly-nginx-'));
  const root = join(temporary, 'site'); mkdirSync(root);
  const port = await unusedPort(), innerPort = await unusedPort();
  const bytes = Buffer.from('const signed = "original";\n'.repeat(1000));
  const longAssetPath = `catalog/assets/${'variant'.repeat(28)}.0123456789abcdef.svg`;
  const toolPath = 'tools/example@0123456789abcdef/hooks.js';
  for (const name of ['index.html', 'sw.js', '_app/app.js', 'catalog/tools/index.json', 'view/tools.html', toolPath, longAssetPath]) {
    mkdirSync(resolve(root, name, '..'), { recursive: true }); writeFileSync(join(root, name), bytes);
  }
  const modelPaths = ['models/specimen.onnx', 'models/specimen@0123456789abcdef/weights.onnx'];
  const modelBytes = Buffer.from(Array.from({ length: 64 }, (_, i) => i));
  for (const name of modelPaths) {
    mkdirSync(resolve(root, name, '..'), { recursive: true }); writeFileSync(join(root, name), modelBytes);
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
    .replaceAll('127.0.0.1:8081', `127.0.0.1:${innerPort}`)
    .replace(/root\s+\/usr\/share\/nginx\/html;/, `root ${root};`);
  writeFileSync(join(temporary, 'nginx.conf'), `pid ${temporary}/nginx.pid;\nerror_log ${temporary}/error.log;\nevents {}\nhttp { access_log off; ${serverConfig} }\n`);
  const child = spawn(nginx, ['-p', temporary, '-c', join(temporary, 'nginx.conf'), '-g', 'daemon off;']);
  let errors = ''; child.stderr.on('data', chunk => { errors += chunk; });
  const get = (path: string, headers: Record<string, string> = {}, method = 'GET') => new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; rawHeaders: string[]; bytes: Buffer }>((done, reject) => {
    const call = request({ host: '127.0.0.1', port, path, headers, method }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => done({ status: response.statusCode!, headers: response.headers, rawHeaders: response.rawHeaders, bytes: Buffer.concat(chunks) }));
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
    const toolsPage = await get('/tools');
    assert.equal(toolsPage.status, 200);
    assert.deepEqual(toolsPage.bytes, bytes);
    const toolAsset = await get(`/${toolPath}`);
    assert.equal(toolAsset.status, 200);
    assert.deepEqual(toolAsset.bytes, bytes);
    assert.equal(toolAsset.headers.etag, `"${sha(bytes)}"`);
    assert.match(toolAsset.headers['cache-control']!, /immutable/);
    for (const path of ['/_app/missing.js', '/models/demo@aaaaaaaaaaaaaaaa/missing.onnx', '/catalog/missing.json', '/api/missing', '/tool/missing', '/info/missing.png', '/tools/missing@0000000000000000/missing.js']) {
      const missing = await get(path);
      assert.equal(missing.status, 404, path);
      assert.match(missing.headers['cache-control']!, /private, no-store/);
      assert.equal(missing.headers['cdn-cache-control'], 'no-store');
      assert.equal(missing.headers.etag, undefined);
    }
    if (configuration === 'public.nginx.conf') {
      const corsNames = ['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers', 'access-control-expose-headers'];
      for (const name of modelPaths) {
        const path = `/${name}`, tag = `"${sha(modelBytes)}"`;
        for (const origin of [undefined, 'null', 'https://lolly.ing', 'https://lolly.tools', 'https://example.net']) {
          const originHeader: Record<string, string> = origin === undefined ? {} : { origin };
          const cases: Array<[string, Record<string, string>, number, number | undefined]> = [
            ['GET', {}, 200, 64], ['HEAD', {}, 200, 0],
            ['GET', { 'if-none-match': tag }, 304, 0],
            ['GET', { range: 'bytes=5-9', 'if-range': tag }, 206, 5],
            ['GET', { range: 'bytes=5-9', 'if-range': '"wrong"' }, 200, 64],
            ['GET', { range: 'bytes=99-100' }, 416, undefined],
            ['OPTIONS', { 'access-control-request-method': 'GET', 'access-control-request-headers': 'range,if-range' }, 204, 0],
            ['POST', {}, 405, undefined],
          ];
          for (const [method, headers, status, length] of cases) {
            const response = await get(path, { ...originHeader, ...headers }, method);
            assert.equal(response.status, status, `${path} ${method}`);
            for (const header of corsNames) {
              assert.equal(response.rawHeaders.filter((value, i) => i % 2 === 0 && value.toLowerCase() === header).length, 1, `${status} ${header}`);
            }
            assert.equal(response.headers['access-control-allow-origin'], '*');
            assert.equal(response.headers['access-control-allow-credentials'], undefined);
            assert.equal(response.headers['content-encoding'], undefined);
            assert.equal(response.headers['last-modified'], undefined);
            if (length !== undefined) assert.equal(response.bytes.length, length);
            if ([200, 206, 304].includes(status)) {
              assert.equal(response.headers.etag, tag);
              assert.match(response.headers['cache-control']!, name.includes('@') ? /immutable, no-transform/ : /must-revalidate, no-transform/);
              if (status === 200 && method === 'GET') assert.deepEqual(response.bytes, modelBytes);
              if (status === 206) {
                assert.deepEqual(response.bytes, modelBytes.subarray(5, 10));
                assert.equal(response.headers['content-range'], 'bytes 5-9/64');
              }
            } else if (status !== 204) {
              assert.match(response.headers['cache-control']!, /^private, no-store/);
              assert.equal(response.headers['cdn-cache-control'], 'no-store');
              assert.equal(response.headers.etag, undefined);
              if (status === 416) assert.equal(response.headers['content-range'], 'bytes */64');
            }
          }
        }
      }
      for (const path of ['/models/missing.onnx', '/models/.lolly-model-release.json', '/models/model-manifest.json', '/models/models-release.json']) {
        const missing = await get(path, { origin: 'https://lolly.ing' });
        assert.equal(missing.status, 404);
        assert.equal(missing.headers['access-control-allow-origin'], '*');
        assert.equal(missing.rawHeaders.filter((value, i) => i % 2 === 0 && value.toLowerCase() === 'access-control-allow-origin').length, 1);
        assert.match(missing.headers['cache-control']!, /^private, no-store/);
        assert.equal(missing.headers.etag, undefined);
      }
      assert.equal((await get('/_app/app.js', { origin: 'https://example.net' })).headers['access-control-allow-origin'], undefined);
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
