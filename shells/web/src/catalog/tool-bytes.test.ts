// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createVerifiedToolFetch, signedToolLeaf, resolveVerifiedStaticResources } from './tool-bytes.ts';
import { CATALOG_SIG_ALG, catalogEnvelopeShape, type CatalogSignatureEnvelope } from '../../../../engine/src/catalog-integrity.ts';
const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
const envelope: CatalogSignatureEnvelope = { alg: CATALOG_SIG_ALG, keyId: 'fixture', signedAt: '2026-10-13T00:00:00Z', indexHash: sha('index'), signature: 'fixture',
  files: { 'demo/assets/model.glb': sha('model fixture'), 'demo/lib/loader.js': sha('library fixture'), 'demo/card.html': sha('card fixture') },
  toolDirs: { demo: 'a'.repeat(64) }, resources: { '/catalog/previews/demo.svg': sha('preview fixture') } };
const base = 'https://catalog.example.test/';
function reader(body: string, calls: string[] = []) {
  return createVerifiedToolFetch({ fetch: async (source, init) => { calls.push(String(source)); assert.equal(init?.redirect, 'error'); return new Response(body); },
    envelope: async () => envelope, root: () => base + 'tools/', base: () => base });
}
test('verified child reads reject substituted model, library, card and preview bytes before delivery', async () => {
  for (const [path, bytes] of [['/tools/demo/assets/model.glb', 'model fixture'], ['/tools/demo/lib/loader.js', 'library fixture'], ['/tools/demo/card.html', 'card fixture'], ['/catalog/previews/demo.svg', 'preview fixture']]) {
    const accepted = await reader(bytes!)(base.slice(0, -1) + path); assert.equal(await accepted.text(), bytes);
    await assert.rejects(reader('changed fixture')(base.slice(0, -1) + path), /does not match/);
  }
});
test('unlisted files, other revisions, writes and missing public resource proofs refuse before fetching', async () => {
  const calls: string[] = [];
  for (const path of ['/tools/demo/assets/absent.glb', '/tools/demo@' + 'b'.repeat(16) + '/assets/model.glb', '/catalog/previews/unlisted.svg', '//tools/demo/assets/model.glb', '/%74ools/demo/assets/model.glb']) await assert.rejects(reader('', calls)(base.slice(0, -1) + path));
  await assert.rejects(reader('', calls)(base + 'tools/demo/assets/model.glb', { method: 'POST' }), /reads only/);
  assert.deepEqual(calls, []);
  assert.equal(signedToolLeaf('https://other.example.test/tools/demo/assets/model.glb', envelope, base + 'tools/', base), null);
});
test('bounded child streams cancel before returning oversized bytes', async () => {
  let canceled = false;
  const guarded = createVerifiedToolFetch({ fetch: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(32 * 1024 * 1024 + 1)); }, cancel() { canceled = true; } })),
    envelope: async () => envelope, root: () => base + 'tools/', base: () => base });
  await assert.rejects(guarded(base + 'tools/demo/assets/model.glb'), /read limit/); assert.equal(canceled, true);
});
test('signed resource maps require safe public resource names and full digests', () => {
  assert.equal(catalogEnvelopeShape(envelope).ok, true);
  const invalidResources: Array<Record<string, string>> = [{ '/catalog/previews/../fixture.svg': sha('fixture') }, { '/catalog/previews/fixture.svg': 'a'.repeat(16) }, { '/unlisted/fixture.svg': sha('fixture') }];
  for (const resources of invalidResources) assert.equal(catalogEnvelopeShape({ ...envelope, resources }).ok, false);
});


test('tool-relative reads use the selected instance and its deployment path', async () => {
  const calls: string[] = [];
  const guarded = createVerifiedToolFetch({ fetch: async source => { calls.push(String(source)); return new Response('model fixture'); },
    envelope: async () => envelope, root: () => 'https://catalog.example.test/deployment/tools/', base: () => 'https://shell.example.test/' });
  assert.equal(await (await guarded('/tools/demo/assets/model.glb')).text(), 'model fixture');
  assert.deepEqual(calls, ['https://catalog.example.test/deployment/tools/demo/assets/model.glb']);
});


test('complete child references verify before template parsing while dynamic prefixes remain deferred', async () => {
  const source = '<img src="/tools/demo/assets/model.glb"><script src="/tools/demo/lib/loader.js"></script> var base = "/tools/demo/assets/";';
  const calls: string[] = [];
  const result = await resolveVerifiedStaticResources(source, envelope, async url => { calls.push(url); return 'blob:fixture-approved'; });
  assert.equal(calls.length, 2); assert.ok(result.includes('src="blob:fixture-approved"')); assert.ok(result.includes('"/tools/demo/assets/"'));
  await assert.rejects(resolveVerifiedStaticResources('<img src="/tools/demo/assets/absent.png">', envelope, async () => 'blob:unused'), /absent/);
});
