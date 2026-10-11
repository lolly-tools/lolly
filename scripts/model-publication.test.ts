// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { generateModelManifest, materializeModels } from './gen-models-manifest.ts';
import { publishModels, verifyPublicModel, type ModelInventoryObservation } from './publish-models.ts';
import { modelCorsFailures, modelCorsOrigins, PUBLIC_MODEL_CORS_ORIGINS } from './lib/model-cors.ts';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'lolly-model-publish-test-'));
  await mkdir(join(root, 'source/example/onnx'), { recursive: true });
  await writeFile(join(root, 'source/example/config.json'), '{}');
  await writeFile(join(root, 'source/example/onnx/model.onnx'), 'model bytes');
  return { root, source: join(root, 'source'), entries: await generateModelManifest(join(root, 'source')) };
}
test('family hash is stable, materializes real directories, and refuses existing corrupted bytes', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await generateModelManifest(f.source), f.entries);
    assert.equal(new Set(f.entries.map(e => e.directorySha256)).size, 1);
    const target = join(f.root, 'hashed'); await materializeModels(f.entries, f.source, target);
    await materializeModels(f.entries, f.source, target);
    assert.equal((await readFile(join(target, f.entries[1]!.immutableUrl.slice('/models/'.length)))).toString(), 'model bytes');
    await writeFile(join(target, f.entries[1]!.immutableUrl.slice('/models/'.length)), 'evil bytes!');
    await assert.rejects(materializeModels(f.entries, f.source, target), /Immutable model collision/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('publisher hashes full existing GETs, refuses same-size collisions, and never uses HEAD', async () => {
  const f = await fixture(); let puts = 0;
  const observations: ModelInventoryObservation[] = [];
  try {
    await assert.rejects(publishModels(f.entries, { sourceRoot: f.source, endpoint: 'https://objects.test', region: 'eu', bucket: 'test', publicBase: 'https://models.test', access: 'test', secret: 'test', observeInventory: record => { observations.push(record); }, log() {}, fetcher: async (_input, init) => {
      assert.notEqual(init?.method, 'HEAD'); if (init?.method === 'PUT') puts++;
      return new Response('[]'); // same size as {}, different full digest
    } }), /Immutable model collision/);
    assert.equal(puts, 0);
    assert.deepEqual(observations, [{ origin: 'https://models.test', path: f.entries[0]!.immutableUrl, immutable: true, status: 200, size: 2, sha256: createHash('sha256').update('[]').digest('hex') }]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
test('publication uses create-only PUTs, verifies public full bytes, and retains old legacy objects', async () => {
  const f = await fixture(), objects = new Map<string, Uint8Array>(); const verified: string[] = [];
  const observations: ModelInventoryObservation[] = [];
  let inventoryReads = 0;
  objects.set('/models/example/config.json', new TextEncoder().encode('old bytes'));
  try {
    await publishModels(f.entries, { sourceRoot: f.source, endpoint: 'https://objects.test', region: 'eu', bucket: 'test', publicBase: 'https://models.test', access: 'test', secret: 'test', observeInventory: async record => { observations.push(record); }, log() {}, fetcher: async (input, init) => {
      const url = new URL(String(input)), key = decodeURIComponent(url.pathname.replace(/^\/test/, ''));
      if (init?.method === 'PUT') {
        assert.equal((init.headers as Record<string, string>)['if-none-match'], '*'); assert.equal(objects.has(key), false);
        objects.set(key, new Uint8Array(init.body as Buffer)); return new Response('', { status: 200 });
      }
      if (url.host === 'objects.test') inventoryReads++;
      const held = objects.get(key); if (!held) return new Response('', { status: 404 });
      if (url.host === 'models.test') verified.push(key);
      return new Response(new Uint8Array(held), { headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag, Content-Range, Accept-Ranges' } });
    } });
    assert.equal(new TextDecoder().decode(objects.get('/models/example/config.json')), 'old bytes');
    for (const entry of f.entries) assert.ok(verified.includes(entry.immutableUrl));
    assert.equal(inventoryReads, f.entries.length * 2, 'archival adds no additional inventory reads');
    assert.equal(observations.length, inventoryReads);
    assert.deepEqual(observations.find(record => record.path === '/models/example/config.json'), { origin: 'https://models.test', path: '/models/example/config.json', immutable: false, status: 200, size: 9, sha256: createHash('sha256').update('old bytes').digest('hex') });
    assert.deepEqual(observations.find(record => record.path === f.entries[0]!.immutableUrl), { origin: 'https://models.test', path: f.entries[0]!.immutableUrl, immutable: true, status: 404 });
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('dry-run receipts hash complete streamed bodies and omit request credentials', async () => {
  const f = await fixture(), observations: ModelInventoryObservation[] = [];
  let inventoryReads = 0, writes = 0;
  try {
    await publishModels([f.entries[0]!], { sourceRoot: f.source, endpoint: 'https://objects.test', region: 'eu', bucket: 'test', publicBase: 'https://models.test', access: 'private-access-marker', secret: 'private-secret-marker', dryRun: true, log() {}, observeInventory: async record => {
      assert.ok(Object.isFrozen(record));
      await Promise.resolve(); observations.push(record);
    }, fetcher: async (_input, init) => {
      if (init?.method === 'PUT') writes++;
      inventoryReads++;
      assert.ok(init?.headers);
      assert.match(new Headers(init.headers).get('authorization') ?? '', /Credential=private-access-marker/);
      return new Response(new ReadableStream<Uint8Array>({ start(controller) {
        controller.enqueue(new TextEncoder().encode('{')); controller.enqueue(new TextEncoder().encode('}')); controller.close();
      } }), { headers: { 'content-length': '999', 'x-private-server-header': 'private-secret-marker' } });
    } });
    assert.equal(inventoryReads, 2);
    assert.equal(writes, 0);
    for (const [i, record] of observations.entries()) assert.deepEqual(record, { origin: 'https://models.test', path: i === 0 ? f.entries[0]!.immutableUrl : f.entries[0]!.url, immutable: i === 0, status: 200, size: 2, sha256: f.entries[0]!.sha256 });
    assert.doesNotMatch(JSON.stringify(observations), /private-|objects\.test|authorization|x-amz/i);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('failed inventory status is archived without a fake body hash, and archival failure prevents writes', async () => {
  const f = await fixture(), observations: ModelInventoryObservation[] = [];
  let writes = 0;
  try {
    const options = { sourceRoot: f.source, endpoint: 'https://objects.test', region: 'eu', bucket: 'test', publicBase: 'https://models.test', access: 'test', secret: 'test', log() {}, fetcher: async (_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'PUT') writes++;
      return new Response('partial bytes', { status: 206 });
    }, observeInventory: (record: Readonly<ModelInventoryObservation>) => { observations.push(record); } };
    await assert.rejects(publishModels([f.entries[0]!], options), /Model inventory failed: 206/);
    assert.deepEqual(observations, [{ origin: 'https://models.test', path: f.entries[0]!.immutableUrl, immutable: true, status: 206 }]);
    await assert.rejects(publishModels([f.entries[0]!], { ...options, fetcher: async () => new Response('', { status: 404 }), observeInventory: async () => { throw new Error('Receipt storage failed'); } }), /Receipt storage failed/);
    assert.equal(writes, 0);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('an interrupted inventory stream never creates a complete-byte receipt or publishes', async () => {
  const f = await fixture(), observations: ModelInventoryObservation[] = [];
  let writes = 0;
  try {
    await assert.rejects(publishModels([f.entries[0]!], { sourceRoot: f.source, endpoint: 'https://objects.test', region: 'eu', bucket: 'test', publicBase: 'https://models.test', access: 'test', secret: 'test', log() {}, observeInventory: record => { observations.push(record); }, fetcher: async (_input, init) => {
      if (init?.method === 'PUT') writes++;
      return new Response(new ReadableStream<Uint8Array>({ start(controller) {
        controller.enqueue(new TextEncoder().encode('{')); controller.error(new Error('Interrupted model transfer'));
      } }));
    } }), /Interrupted model transfer/);
    assert.deepEqual(observations, []);
    assert.equal(writes, 0);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('public CORS distinguishes anonymous reflection from the constant cache boundary', () => {
  assert.deepEqual(modelCorsFailures(new Headers({ 'access-control-allow-origin': 'null' }), 'null'), ['cors-reflection-missing-vary', 'cors-nonconstant-origin']);
  assert.deepEqual(modelCorsFailures(new Headers({ 'access-control-allow-origin': 'https://lolly.ing', vary: 'Origin, Accept-Encoding' }), 'https://lolly.ing'), ['cors-nonconstant-origin', 'cors-vary']);
  assert.deepEqual(modelCorsFailures(new Headers({ 'access-control-allow-origin': '*' }), 'https://lolly.tools'), []);
  assert.deepEqual(modelCorsFailures(new Headers({ 'access-control-allow-origin': '*' }), null), []);
  assert.deepEqual(modelCorsFailures(new Headers({ 'access-control-allow-origin': 'https://other.test' }), 'https://lolly.ing'), ['cors-origin']);
  assert.deepEqual(modelCorsFailures(new Headers({ 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true', 'set-cookie': 'session=secret' }), 'null'), ['cors-credentials', 'cors-set-cookie']);
  for (const origin of ['*', 'https://user:secret@models.test', 'https://models.test/path', 'https://models.test?secret=value', 'null\r\nCookie:secret']) assert.throws(() => modelCorsOrigins([origin]));
});

test('small public files are hashed anonymously from every required origin and without Origin', async () => {
  const body = '{}', sha256 = createHash('sha256').update(body).digest('hex'), origins: Array<string | null> = [];
  await verifyPublicModel({ size: body.length, sha256 }, '/models/example/config.json', { publicBase: 'https://models.test', fetcher: async (_input, init) => {
    const headers = new Headers(init?.headers); origins.push(headers.get('origin'));
    assert.equal(init?.method, 'GET'); assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'manual');
    assert.equal(headers.has('authorization'), false); assert.equal(headers.has('cookie'), false); assert.equal(headers.get('accept-encoding'), 'identity');
    return new Response(body, { headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag, Content-Range, Accept-Ranges' } });
  } });
  assert.deepEqual(origins, [...PUBLIC_MODEL_CORS_ORIGINS, null]);
});

test('origin-specific denials, bytes and missing no-Origin wildcard prevent publication qualification', async () => {
  const body = '{}', file = { size: 2, sha256: createHash('sha256').update(body).digest('hex') };
  for (const fault of ['denied-origin', 'changed-bytes', 'no-origin-header', 'redirect', 'partial'] as const) {
    await assert.rejects(verifyPublicModel(file, '/models/example/config.json', { publicBase: 'https://models.test', fetcher: async (_input, init) => {
      const origin = new Headers(init?.headers).get('origin');
      const target = origin === 'https://lolly.ing';
      return new Response(target && fault === 'changed-bytes' ? '[]' : body, { status: target && fault === 'redirect' ? 302 : target && fault === 'partial' ? 206 : 200, headers: target && fault === 'denied-origin' || !origin && fault === 'no-origin-header' ? {} : { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag, Content-Range, Accept-Ranges' } });
    } }), fault === 'changed-bytes' ? /digest mismatch/ : /CORS verification failed/);
  }
});

test('large weights hash one full body and separately verify strong metadata across anonymous origins', async () => {
  const body = Buffer.alloc(1024 * 1024 + 1, 7), file = { size: body.length, sha256: createHash('sha256').update(body).digest('hex') };
  let reads = 0, heads = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    const head = init?.method === 'HEAD'; if (head) heads++; else reads++;
    return new Response(head ? null : body, { headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*', 'content-length': String(body.length), etag: '"full-model"' } });
  };
  await verifyPublicModel(file, '/models/example/model.onnx', { publicBase: 'https://models.test', fetcher });
  assert.equal(reads, 1); assert.equal(heads, PUBLIC_MODEL_CORS_ORIGINS.length);
  for (const fault of ['changed-etag', 'weak-etag', 'wrong-size']) await assert.rejects(verifyPublicModel(file, '/models/example/model.onnx', { publicBase: 'https://models.test', fetcher: async (input, init) => {
    const response = await fetcher(input, init);
    if (fault === 'weak-etag') response.headers.set('etag', 'W/"full-model"');
    if (init?.method === 'HEAD' && fault === 'changed-etag') response.headers.set('etag', '"changed-model"');
    if (init?.method === 'HEAD' && fault === 'wrong-size') response.headers.set('content-length', String(body.length - 1));
    return response;
  } }), /origin-validator|origin-size/);
});

test('reflected CORS remains unqualified with or without Vary and credential opt-in never passes', async () => {
  const file = { size: 2, sha256: createHash('sha256').update('{}').digest('hex') };
  for (const kind of ['reflection', 'vary-reflection', 'credentials', 'set-cookie']) await assert.rejects(verifyPublicModel(file, '/models/example/config.json', { publicBase: 'https://models.test', fetcher: async (_input, init) => {
    const origin = new Headers(init?.headers).get('origin')!;
    return new Response('{}', { headers: { 'access-control-allow-origin': kind.endsWith('reflection') ? origin : '*', ...(kind === 'vary-reflection' ? { vary: 'Origin' } : {}), ...(kind === 'credentials' ? { 'access-control-allow-credentials': 'true' } : {}), ...(kind === 'set-cookie' ? { 'set-cookie': 'session=private' } : {}) } });
  } }), /cors-nonconstant-origin|cors-credentials|cors-set-cookie/);
});

test('the actual HTTP verifier keeps every origin anonymous and rejects reflected wire headers', async () => {
  const body = '{}', file = { size: 2, sha256: createHash('sha256').update(body).digest('hex') }, seen: Array<string | null> = [];
  const server = createServer((request, response) => {
    seen.push(request.headers.origin ?? null);
    assert.equal(request.headers.authorization, undefined); assert.equal(request.headers.cookie, undefined);
    const reflected = request.url === '/reflected.json';
    response.writeHead(200, { 'Access-Control-Allow-Origin': reflected ? request.headers.origin ?? 'null' : '*', 'Access-Control-Expose-Headers': 'ETag, Content-Range, Accept-Ranges', 'Content-Type': 'application/json' });
    response.end(body);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const publicBase = `http://127.0.0.1:${address.port}`;
  try {
    await verifyPublicModel(file, '/constant.json', { publicBase });
    assert.deepEqual(seen, [...PUBLIC_MODEL_CORS_ORIGINS, null]);
    await assert.rejects(verifyPublicModel(file, '/reflected.json', { publicBase }), /cors-reflection-missing-vary/);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('model CORS exposes resume validators to anonymous browsers, not only Node probes', () => {
  const headers = new Headers({ 'access-control-allow-origin': '*' });
  assert.deepEqual(modelCorsFailures(headers, 'https://lolly.ing', ['etag', 'content-range', 'accept-ranges']), ['cors-expose-etag', 'cors-expose-content-range', 'cors-expose-accept-ranges']);
  headers.set('access-control-expose-headers', 'ETag, Content-Range, Accept-Ranges');
  assert.deepEqual(modelCorsFailures(headers, 'https://lolly.ing', ['etag', 'content-range', 'accept-ranges']), []);
  headers.set('access-control-expose-headers', '*');
  assert.deepEqual(modelCorsFailures(headers, 'null', ['etag', 'content-range', 'accept-ranges']), []);
});

test('invalid public origin configuration fails before signed inventory or publication', async () => {
  const f = await fixture(); let requests = 0;
  try {
    for (const publicBase of ['https://user:secret@models.test', 'https://models.test?token=secret', 'https://models.test/path', 'ftp://models.test']) await assert.rejects(publishModels(f.entries, { sourceRoot: f.source, endpoint: 'https://objects.test', region: 'eu', bucket: 'test', publicBase, access: 'private', secret: 'private', log() {}, fetcher: async () => { requests++; return new Response(null, { status: 404 }); } }), /Public model verification/);
    assert.equal(requests, 0);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
