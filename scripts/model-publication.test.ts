// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateModelManifest, materializeModels } from './gen-models-manifest.ts';
import { publishModels, type ModelInventoryObservation } from './publish-models.ts';
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
      return new Response(new Uint8Array(held), { headers: { 'access-control-allow-origin': '*' } });
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
