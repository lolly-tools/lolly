// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSignedCatalogSnapshot, CatalogPairError, CatalogTrustError } from './snapshot.ts';
import type { AcceptedCatalog, CatalogSnapshotIO } from './snapshot.ts';
import { CATALOG_SIG_ALG, catalogFreshness, catalogIndexPath, sha256Hex, signCatalogEnvelope } from '../../../../engine/src/catalog-integrity.ts';
import type { CatalogSignatureEnvelope } from '../../../../engine/src/catalog-integrity.ts';

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const bytes = (text: string) => new TextEncoder().encode(text);
const toolText = JSON.stringify({ tools: [{ id: 'demo' }] });
const assetText = JSON.stringify({ assets: [{ id: 'demo/picture', formats: [{ format: 'png', checksum: 'sha256-' + 'A'.repeat(43) + '=', url: '/catalog/picture.png' }] }] });
const slimText = JSON.stringify({ tools: [{ id: 'demo', name: 'Demo' }] });
async function envelope(seq = 2, extra: Partial<CatalogSignatureEnvelope> = {}): Promise<CatalogSignatureEnvelope> {
  return signCatalogEnvelope({ alg: CATALOG_SIG_ALG, keyId: 'test', signedAt: '2026-10-11T00:00:00.000Z', seq,
    indexHash: await sha256Hex(bytes(toolText)), assetIndexHash: await sha256Hex(bytes(assetText)), slimHash: await sha256Hex(bytes(slimText)), files: {}, ...extra }, pair.privateKey);
}
function harness(offered: CatalogSignatureEnvelope) {
  let stored: AcceptedCatalog | null = null;
  const calls: Array<{ path: string; cache?: RequestCache; headers: Headers }> = [];
  let accepts = 0;
  const io: CatalogSnapshotIO = {
    publicKey: pair.publicKey,
    fetch: async (path, init) => {
      calls.push({ path, cache: init.cache, headers: new Headers(init.headers) });
      if (path.endsWith('index.sig.json')) return Response.json(offered, { headers: { etag: '"signature"' } });
      if (path === catalogIndexPath(offered.indexHash)) return new Response(toolText, { headers: { etag: '"tools"' } });
      if (path === catalogIndexPath(offered.assetIndexHash!, 'assets')) return new Response(assetText, { headers: { etag: '"assets"' } });
      if (path === catalogIndexPath(offered.slimHash!, 'slim')) return new Response(slimText, { headers: { etag: '"slim"' } });
      return new Response('', { status: 404 });
    },
    read: async () => stored,
    latest: async () => stored,
    accept: async (_scope, snapshot) => {
      const fresh = catalogFreshness(snapshot.envelope, stored?.watermark ?? null);
      if (!fresh.ok) throw new Error(fresh.reason);
      stored = { watermark: { seq: snapshot.envelope.seq, signedAt: snapshot.envelope.signedAt }, snapshot };
      accepts++;
    },
  };
  return { io, calls, accepts: () => accepts, stored: () => stored, seed: (value: AcceptedCatalog) => { stored = value; } };
}

test('signature-first snapshot authenticates all indexes before accepting the floor', async () => {
  const offered = await envelope(), h = harness(offered);
  const snapshot = await fetchSignedCatalogSnapshot(h.io);
  assert.deepEqual(h.calls.map(c => c.path), ['/catalog/tools/index.sig.json', catalogIndexPath(offered.indexHash), catalogIndexPath(offered.assetIndexHash!, 'assets'), catalogIndexPath(offered.slimHash!, 'slim')]);
  assert.equal(snapshot.assetText, assetText);
  assert.equal(h.accepts(), 1);
  assert.equal(h.stored()!.watermark.seq, 2);
});

test('a stale byte pair gets exactly one reload retry; repeated mismatch never advances trust', async () => {
  const offered = await envelope(), h = harness(offered), original = h.io.fetch;
  h.io.fetch = async (path, init) => path === catalogIndexPath(offered.indexHash) ? new Response('wrong bytes') : original(path, init);
  await assert.rejects(fetchSignedCatalogSnapshot(h.io), CatalogPairError);
  assert.deepEqual(h.calls.filter(c => c.path.endsWith('index.sig.json')).map(c => c.cache), ['no-cache', 'reload']);
  assert.equal(h.accepts(), 0);
  assert.equal(h.stored(), null);
});

test('a stale pair that repairs on reload is accepted once', async () => {
  const offered = await envelope(), h = harness(offered), original = h.io.fetch;
  h.io.fetch = async (path, init) => path === catalogIndexPath(offered.indexHash) && init.cache !== 'reload' ? new Response('stale') : original(path, init);
  await fetchSignedCatalogSnapshot(h.io);
  assert.equal(h.accepts(), 1);
  assert.equal(h.calls.filter(c => c.path.endsWith('index.sig.json')).length, 2);
});

test('rewriting an asset index and its bytes does not bypass its signed hash', async () => {
  const offered = await envelope(), h = harness(offered), original = h.io.fetch;
  h.io.fetch = async (path, init) => path === catalogIndexPath(offered.assetIndexHash!, 'assets') ? new Response(JSON.stringify({ assets: [] })) : original(path, init);
  await assert.rejects(fetchSignedCatalogSnapshot(h.io), /out of step/);
  assert.equal(h.accepts(), 0);
});

test('an older signed revision is refused before any index request, without retry', async () => {
  const offered = await envelope(2), h = harness(offered);
  h.seed({ watermark: { seq: 3, signedAt: offered.signedAt }, snapshot: { envelope: offered, toolText, validators: {} } });
  await assert.rejects(fetchSignedCatalogSnapshot(h.io), /older than one already trusted/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.accepts(), 0);
});

test('a forged sequence, expiry or digest fails the signature and cannot raise the floor', async () => {
  for (const extra of [{ seq: 900 }, { expiresAt: '2099-01-01T00:00:00.000Z' }, { assetIndexHash: 'f'.repeat(64) }]) {
    const h = harness({ ...await envelope(), ...extra });
    await assert.rejects(fetchSignedCatalogSnapshot(h.io), CatalogTrustError);
    assert.equal(h.accepts(), 0);
    assert.equal(h.calls.length, 1);
  }
});

test('signed missing checksums and malformed tool JSON are refused before acceptance', async () => {
  const missing = JSON.stringify({ assets: [{ formats: [{ format: 'png' }] }] });
  const offered = await envelope(2, { assetIndexHash: await sha256Hex(bytes(missing)) });
  const h = harness(offered), original = h.io.fetch;
  h.io.fetch = async (path, init) => path === catalogIndexPath(offered.assetIndexHash!, 'assets') ? new Response(missing) : original(path, init);
  await assert.rejects(fetchSignedCatalogSnapshot(h.io), /no SHA-256 checksum/);
  assert.equal(h.accepts(), 0);
  const malformed = JSON.stringify({ tools: 'invalid' }), invalid = await envelope(2, { indexHash: await sha256Hex(bytes(malformed)) });
  const bad = harness(invalid), validFetch = bad.io.fetch;
  bad.io.fetch = async (path, init) => path === catalogIndexPath(invalid.indexHash) ? new Response(malformed) : validFetch(path, init);
  await assert.rejects(fetchSignedCatalogSnapshot(bad.io), /no tools list/);
  assert.equal(bad.accepts(), 0);
});

test('warm hash requests use validators and verify the accepted bytes after 304', async () => {
  const offered = await envelope(), h = harness(offered);
  const first = await fetchSignedCatalogSnapshot(h.io);
  const warm: Array<{ path: string; headers: Headers }> = [];
  h.io.fetch = async (path, init) => { warm.push({ path, headers: new Headers(init.headers) }); return new Response(null, { status: 304 }); };
  const second = await fetchSignedCatalogSnapshot(h.io);
  assert.equal(second.toolText, first.toolText);
  assert.equal(second.assetText, first.assetText);
  assert.equal(h.accepts(), 2);
  assert.equal(warm.length, 4);
  assert.deepEqual(warm.map(c => c.headers.get('If-None-Match')), ['"signature"', '"tools"', '"assets"', '"slim"']);
});

test('network outages reuse only verified, unexpired accepted bytes and never advance trust', async () => {
  const offered = await envelope(), h = harness(offered);
  await fetchSignedCatalogSnapshot(h.io);
  h.io.fetch = async () => { throw new TypeError('network unavailable'); };
  const offline = await fetchSignedCatalogSnapshot(h.io);
  assert.equal(offline.offline, true);
  assert.equal(h.accepts(), 1);
  h.stored()!.snapshot.assetText = JSON.stringify({ assets: [] });
  await assert.rejects(fetchSignedCatalogSnapshot(h.io), /saved catalog bytes do not verify/);
  assert.equal(h.accepts(), 1);
});

test('a served refusal or an expired saved catalog is never hidden by offline reuse', async () => {
  const offered = await envelope(2, { expiresAt: '2099-01-01T00:00:00.000Z' }), h = harness(offered);
  await fetchSignedCatalogSnapshot(h.io);
  h.io.fetch = async () => new Response('', { status: 403 });
  await assert.rejects(fetchSignedCatalogSnapshot(h.io), /HTTP 403/);
  h.io.fetch = async () => { throw new TypeError('network unavailable'); };
  h.io.now = () => Date.parse('2099-01-01T00:00:00.000Z');
  await assert.rejects(fetchSignedCatalogSnapshot(h.io), /expired/);
  assert.equal(h.accepts(), 1);
});

test('exact 404 compatibility fallback still verifies legacy bytes', async () => {
  const offered = await envelope(), h = harness(offered), original = h.io.fetch;
  h.io.fetch = async (path, init) => {
    if (path === catalogIndexPath(offered.indexHash)) return new Response('', { status: 404 });
    if (path === '/catalog/tools/index.json') return new Response(toolText);
    return original(path, init);
  };
  await fetchSignedCatalogSnapshot(h.io);
  assert.equal(h.accepts(), 1);
});
