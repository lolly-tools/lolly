// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { nginxDeliveryMaps, prepareStaticDelivery } from '../scripts/build-delivery.ts';
import { generateModelManifest } from '../scripts/gen-models-manifest.ts';
import { compileMountedModelDelivery, verifyMountedModelVolume } from '../scripts/lib/mounted-model-delivery.ts';

const nginx = process.env.LOLLY_TEST_NGINX ?? 'nginx';
const installed = spawnSync(nginx, ['-v']).status === 0;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function allocatePort(): Promise<number> {
  const allocator = createServer();
  await new Promise<void>(done => allocator.listen(0, '127.0.0.1', done));
  const address = allocator.address(); assert.ok(address && typeof address !== 'string');
  await new Promise<void>(done => allocator.close(() => done()));
  return address.port;
}

for (const configuration of ['nginx.conf', 'public.nginx.conf']) {
  test(`actual ${configuration} binds a separate model volume to reviewed full hash validators`, { skip: !installed }, async () => {
    const temporary = mkdtempSync(join(tmpdir(), 'lolly-mounted-models-'));
    const site = join(temporary, 'site'), source = join(temporary, 'source'), mount = join(temporary, 'mounted');
    mkdirSync(site); mkdirSync(join(source, 'depth'), { recursive: true });
    const current = { 'model.onnx': Buffer.from('current model bytes'.repeat(1500)), 'config.json': Buffer.from('{"current":true}\n'.repeat(200)) };
    const older = { 'model.onnx': Buffer.from('archive model bytes'.repeat(1500)), 'config.json': Buffer.from('{"archive":true}\n'.repeat(200)) };
    assert.equal(current['model.onnx'].length, older['model.onnx'].length);
    for (const [name, bytes] of Object.entries(current)) writeFileSync(join(source, 'depth', name), bytes);
    const manifest = await generateModelManifest(source);
    const legacy = Object.entries(older).map(([name, bytes]) => ({ url: `/models/depth/${name}`, size: bytes.length, sha256: sha(bytes) }));
    const archivedHash = createHash('sha256').update([...legacy].sort((a, b) => a.url < b.url ? -1 : 1).map(row => `${row.url.split('/').at(-1)}\0${row.size}\0${row.sha256}\n`).join('')).digest('hex');
    const historical = legacy.map(row => ({ ...row, url: row.url.replace('/depth/', `/depth@${archivedHash.slice(0, 16)}/`) }));
    const rows = compileMountedModelDelivery(manifest, { version: 1, files: [...legacy, ...historical] });
    const served = new Map<string, Buffer>();
    for (const row of rows) {
      const name = row.url.split('/').at(-1)! as keyof typeof current;
      const bytes = row.url.includes(`@${manifest[0]!.directorySha256.slice(0, 16)}/`) ? current[name] : older[name];
      const path = join(mount, row.url.slice(1));
      mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, bytes); utimesSync(path, 0, 0); served.set(row.url, bytes);
    }
    assert.equal((await verifyMountedModelVolume(join(mount, 'models'), rows)).files, rows.length);
    writeFileSync(join(site, 'index.html'), 'site without weight files');
    const first = prepareStaticDelivery(site, { mountedModels: rows });
    assert.equal(first.files, 1); assert.equal(first.mountedModels, rows.length);
    const validators = readFileSync(join(site, '.delivery-etags.conf'));
    prepareStaticDelivery(site, { mountedModels: [...rows].reverse() });
    assert.deepEqual(readFileSync(join(site, '.delivery-etags.conf')), validators);
    writeFileSync(join(temporary, 'delivery-maps.conf'), nginxDeliveryMaps());
    writeFileSync(join(temporary, 'delivery-etags.conf'), validators);
    for (const file of ['delivery-headers.conf', 'security-headers.conf']) writeFileSync(join(temporary, file), readFileSync(resolve('deploy/docker', file), 'utf8').replaceAll('/etc/nginx/', `${temporary}/`));
    const port = await allocatePort(), inner = await allocatePort();
    const config = readFileSync(resolve('deploy/docker', configuration), 'utf8')
      .replaceAll('/etc/nginx/', `${temporary}/`).replaceAll('127.0.0.1:8081', `127.0.0.1:${inner}`)
      .replace('listen 8080;', `listen 127.0.0.1:${port};`).replace('listen [::]:8080;', '')
      .replace(/root\s+\/usr\/share\/nginx\/html;/, `root ${site};`)
      .replace('location /models/ {', `location /models/ {\n        root ${mount};`);
    writeFileSync(join(temporary, 'nginx.conf'), `pid ${temporary}/nginx.pid;\nerror_log ${temporary}/error.log;\nevents {}\nhttp { access_log off; ${config} }\n`);
    const child = spawn(nginx, ['-p', temporary, '-c', join(temporary, 'nginx.conf'), '-g', 'daemon off;']);
    let errors = ''; child.stderr.on('data', chunk => { errors += chunk; });
    const get = (path: string, headers: Record<string, string> = {}, method = 'GET') => new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; bytes: Buffer }>((done, reject) => {
      const call = request({ host: '127.0.0.1', port, path, method, headers }, response => {
        const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => done({ status: response.statusCode!, headers: response.headers, bytes: Buffer.concat(chunks) }));
      }); call.on('error', reject); call.end();
    });
    try {
      for (let i = 0; i < 100; i++) {
        try { await get('/healthz'); break; } catch { if (child.exitCode !== null) throw new Error(errors); await delay(20); }
      }
      for (const row of rows) {
        const bytes = served.get(row.url)!, tag = `"${row.sha256}"`;
        const response = await get(row.url, { 'accept-encoding': 'gzip', origin: 'https://untrusted.example' });
        assert.equal(response.status, 200); assert.deepEqual(response.bytes, bytes); assert.equal(response.headers.etag, tag);
        assert.equal(response.headers['content-encoding'], undefined); assert.equal(response.headers['last-modified'], undefined);
        assert.equal(response.headers['access-control-allow-origin'], '*');
        assert.match(String(response.headers['access-control-expose-headers']), /ETag.*Content-Range.*Accept-Ranges/i);
        assert.doesNotMatch(String(response.headers.vary), /origin/i);
        assert.match(String(response.headers['cache-control']), row.url.includes('@') ? /immutable/ : /max-age=0, s-maxage=0, must-revalidate/);
        const head = await get(row.url, {}, 'HEAD'); assert.equal(head.status, 200); assert.equal(head.bytes.length, 0); assert.equal(head.headers.etag, tag);
        for (const condition of [tag, `W/${tag}`, `"other", W/${tag}`, '*']) {
          const match = await get(row.url, { 'if-none-match': condition }); assert.equal(match.status, 304); assert.equal(match.headers.etag, tag); assert.equal(match.bytes.length, 0);
        }
        assert.equal((await get(row.url, { 'if-none-match': `"0-${row.size.toString(16)}"` })).status, 200);
        const range = await get(row.url, { range: 'bytes=1-15', 'if-range': tag });
        assert.equal(range.status, 206); assert.deepEqual(range.bytes, bytes.subarray(1, 16)); assert.equal(range.headers.etag, tag);
        assert.equal(range.headers['content-range'], `bytes 1-15/${row.size}`);
        assert.equal((await get(row.url, { range: 'bytes=1-15', 'if-range': '"wrong"' })).status, 200);
        const options = await get(row.url, { origin: 'https://untrusted.example', 'access-control-request-method': 'GET', 'access-control-request-headers': 'range,if-range,if-none-match' }, 'OPTIONS');
        assert.equal(options.status, 204); assert.equal(options.bytes.length, 0); assert.equal(options.headers['access-control-allow-origin'], '*');
        assert.match(String(options.headers['access-control-allow-methods']), /GET.*HEAD.*OPTIONS/);
        assert.match(String(options.headers['access-control-allow-headers']), /Range.*If-Range.*If-None-Match/i);
      }
      const currentRow = manifest.find(row => row.url.endsWith('/model.onnx'))!;
      assert.equal((await get(currentRow.url, { 'if-none-match': `"${currentRow.sha256}"` })).status, 200);
      assert.equal((await get(currentRow.immutableUrl, { 'if-none-match': `"${legacy.find(row => row.url.endsWith('/model.onnx'))!.sha256}"` })).status, 200);
      for (const [path, method, status] of [[currentRow.immutableUrl, 'POST', 405], ['/models/depth@0000000000000000/missing.onnx', 'GET', 404]] as const) {
        const result = await get(path, {}, method); assert.equal(result.status, status); assert.match(String(result.headers['cache-control']), /private, no-store/); assert.equal(result.headers['cdn-cache-control'], 'no-store');
      }
    } finally {
      child.kill('SIGTERM'); await new Promise<void>(done => { if (child.exitCode !== null) done(); else child.once('exit', () => done()); });
      rmSync(temporary, { recursive: true, force: true });
    }
  });
}
