// SPDX-License-Identifier: MPL-2.0
/**
 * The Work instance catalog key (instance-key.ts): when the web app may read one, how
 * each answer from the route is classified, rotation and offline reuse, and, through
 * the real snapshot transaction, that the key verifies only envelopes carrying its
 * keyId while a catalog signed by any third key is still refused.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTANCE_KEY_PATH, createCatalogKeySelector, instanceKeyAllowed, keyIdOf, parseInstanceKeyDocument,
  resolveInstanceCatalogKey, type InstanceKeyIO, type SavedInstanceKey,
} from './instance-key.ts';
import { fetchSignedCatalogSnapshot, CatalogTrustError, type AcceptedCatalog, type CatalogSnapshotIO } from './snapshot.ts';
import { CATALOG_SIG_ALG, catalogFreshness, catalogIndexPath, jwkThumbprint, sha256Hex, signCatalogEnvelope } from '../../../../engine/src/catalog-integrity.ts';
import type { CatalogSignatureEnvelope } from '../../../../engine/src/catalog-integrity.ts';

const ORIGIN = 'https://work.example';
const EC = { name: 'ECDSA', namedCurve: 'P-256' } as const;
interface TestKey { pair: CryptoKeyPair; keyId: string; jwk: JsonWebKey; doc: Record<string, unknown> }
async function key(): Promise<TestKey> {
  const pair = await crypto.subtle.generateKey(EC, true, ['sign', 'verify']) as CryptoKeyPair;
  const full = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: full.x, y: full.y };
  const keyId = await jwkThumbprint(jwk);
  return { pair, keyId, jwk, doc: { version: 1, alg: CATALOG_SIG_ALG, keyId, publicKey: jwk } };
}
const [publisher, instance, rotated, third] = await Promise.all([key(), key(), key(), key()]);

/** A fake origin: `answer` is what the route returns, `saved` the IndexedDB record. */
function io(answer: () => Response | Promise<Response>, saved: SavedInstanceKey | null = null) {
  const state = { saved: saved as unknown, requests: 0, writes: 0 };
  const value: InstanceKeyIO = {
    origin: ORIGIN,
    fetch: async (url) => { state.requests++; assert.equal(url, ORIGIN + INSTANCE_KEY_PATH); return answer(); },
    load: async () => state.saved,
    save: async (_origin, record) => { state.saved = record; state.writes++; },
    forget: async () => { state.saved = null; state.writes++; },
  };
  return { io: value, state };
}
const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, init);
const savedOf = (k: TestKey): SavedInstanceKey => ({ v: 1, keyId: k.keyId, publicKey: k.jwk as SavedInstanceKey['publicKey'] });

test('only a browser page whose catalog comes from its own origin may read the key', () => {
  assert.equal(instanceKeyAllowed({ pageOrigin: ORIGIN, instanceBase: '', tauri: false }), true);
  assert.equal(instanceKeyAllowed({ pageOrigin: ORIGIN, instanceBase: ORIGIN + '/sub', tauri: false }), true);
  // An instance on another origin, the desktop and mobile apps, and odd origins keep the pin.
  assert.equal(instanceKeyAllowed({ pageOrigin: 'https://lolly.tools', instanceBase: ORIGIN, tauri: false }), false);
  assert.equal(instanceKeyAllowed({ pageOrigin: 'http://tauri.localhost', instanceBase: '', tauri: true }), false);
  assert.equal(instanceKeyAllowed({ pageOrigin: 'tauri://localhost', instanceBase: ORIGIN, tauri: true }), false);
  assert.equal(instanceKeyAllowed({ pageOrigin: 'null', instanceBase: '', tauri: false }), false);
  assert.equal(instanceKeyAllowed({ pageOrigin: null, instanceBase: '', tauri: false }), false);
  assert.equal(instanceKeyAllowed({ pageOrigin: ORIGIN, instanceBase: 'not a url', tauri: false }), false);
});

test('the document is read down to its public members, and its keyId is recomputed', async () => {
  assert.equal((await parseInstanceKeyDocument(instance.doc))?.keyId, instance.keyId);
  const withPrivate = { ...instance.doc, publicKey: { ...instance.jwk, d: 'private' } };
  for (const bad of [
    withPrivate,
    { ...instance.doc, keyId: third.keyId },
    { ...instance.doc, alg: 'ES256' },
    { ...instance.doc, version: 2 },
    { ...instance.doc, publicKey: { ...instance.jwk, crv: 'P-384' } },
    { ...instance.doc, publicKey: { kty: 'RSA', n: 'x', e: 'AQAB' } },
    null, 'text', [],
  ]) assert.equal(await parseInstanceKeyDocument(bad), null, JSON.stringify(bad));
  const extra = await parseInstanceKeyDocument({ ...instance.doc, publicKey: { ...instance.jwk, kid: 'label', ext: true } });
  assert.deepEqual(Object.keys(extra!.jwk).sort(), ['crv', 'kty', 'x', 'y']);
});

test('a served key is used and saved, replacing the key saved before it', async () => {
  const h = io(() => json(rotated.doc), savedOf(instance));
  const resolved = await resolveInstanceCatalogKey(h.io);
  assert.equal(resolved?.keyId, rotated.keyId);
  assert.equal(resolved?.source, 'served');
  assert.deepEqual(h.state.saved, savedOf(rotated));
});

test('a definitive "no key here" forgets the saved key', async () => {
  for (const answer of [
    () => json({ error: { code: 'CATALOG_SIGNING_OFF' } }, { status: 404 }),
    () => new Response('', { status: 405 }),
    () => new Response('', { status: 410 }),
    // A static host's SPA fallback: the app's own HTML with a 200.
    () => new Response('<!doctype html><title>Lolly</title>', { headers: { 'content-type': 'text/html' } }),
  ]) {
    const h = io(answer, savedOf(instance));
    assert.equal(await resolveInstanceCatalogKey(h.io), null);
    assert.equal(h.state.saved, null);
  }
});

test('no answer falls back to the saved key unchanged, and never to a new one', async () => {
  const unanswered = [
    () => { throw new TypeError('offline'); },
    () => { throw new DOMException('timed out', 'TimeoutError'); },
    () => json({ error: { code: 'CATALOG_SIGNING_UNAVAILABLE' } }, { status: 503 }),
    () => new Response('', { status: 401 }),
    () => json({ ...third.doc, publicKey: { ...third.jwk, d: 'private' } }),
    () => json({ ...third.doc, keyId: instance.keyId }),
    () => new Response('{', { headers: { 'content-type': 'application/json' } }),
    () => json({ ...third.doc, padding: 'x'.repeat(5000) }),
  ];
  for (const answer of unanswered) {
    const withSaved = io(answer, savedOf(instance));
    const resolved = await resolveInstanceCatalogKey(withSaved.io);
    assert.equal(resolved?.keyId, instance.keyId);
    assert.equal(resolved?.source, 'saved');
    assert.equal(withSaved.state.writes, 0);
    const empty = io(answer);
    assert.equal(await resolveInstanceCatalogKey(empty.io), null);
    assert.equal(empty.state.writes, 0);
  }
});

test('a saved record that does not verify its own keyId is ignored', async () => {
  const tampered = { ...savedOf(instance), keyId: third.keyId };
  assert.equal(await resolveInstanceCatalogKey(io(() => { throw new TypeError('offline'); }, tampered).io), null);
  const privateRecord = { ...savedOf(instance), publicKey: { ...instance.jwk, d: 'private' } } as unknown as SavedInstanceKey;
  assert.equal(await resolveInstanceCatalogKey(io(() => { throw new TypeError('offline'); }, privateRecord).io), null);
});

test('a paired reader accepts only the keyId it was given', async () => {
  const matching = io(() => json(instance.doc));
  assert.equal((await resolveInstanceCatalogKey({ ...matching.io, expectedKeyId: instance.keyId }))?.keyId, instance.keyId);
  const other = io(() => json(third.doc), savedOf(instance));
  assert.equal(await resolveInstanceCatalogKey({ ...other.io, expectedKeyId: instance.keyId }), null);
  assert.deepEqual(other.state.saved, savedOf(instance), 'a key the pairing did not name is never saved');
});

test('the selector asks for the instance key only for an envelope that names another key', async () => {
  let asked = 0;
  const select = createCatalogKeySelector({
    pinned: publisher.pair.publicKey, pinnedKeyId: await keyIdOf(publisher.pair.publicKey),
    instanceKey: async () => { asked++; return { keyId: instance.keyId, publicKey: instance.pair.publicKey, source: 'served' }; },
  });
  assert.equal(await select({ keyId: publisher.keyId }), publisher.pair.publicKey);
  assert.equal(asked, 0, 'a publisher-signed catalog never causes the request');
  assert.equal(await select({ keyId: instance.keyId }), instance.pair.publicKey);
  assert.equal(await select({ keyId: third.keyId }), publisher.pair.publicKey);
  assert.equal(await select({}), publisher.pair.publicKey);
  assert.equal(asked, 1, 'one request per load');
  const pinnedOnly = createCatalogKeySelector({ pinned: publisher.pair.publicKey, pinnedKeyId: publisher.keyId, instanceKey: null });
  assert.equal(await pinnedOnly({ keyId: instance.keyId }), publisher.pair.publicKey);
  const failing = createCatalogKeySelector({ pinned: publisher.pair.publicKey, pinnedKeyId: publisher.keyId, instanceKey: () => Promise.reject(new Error('boom')) });
  assert.equal(await failing({ keyId: instance.keyId }), publisher.pair.publicKey);
});

// ── through the real snapshot transaction ─────────────────────────────────────

const bytes = (text: string) => new TextEncoder().encode(text);
const toolText = JSON.stringify({ tools: [{ id: 'demo' }] });
async function envelope(signer: TestKey, keyId = signer.keyId, seq = 2): Promise<CatalogSignatureEnvelope> {
  return signCatalogEnvelope({ alg: CATALOG_SIG_ALG, keyId, signedAt: '2026-10-27T00:00:00.000Z', seq,
    indexHash: await sha256Hex(bytes(toolText)), files: {} }, signer.pair.privateKey);
}
function catalog(offered: CatalogSignatureEnvelope | (() => never), keyFor: CatalogSnapshotIO['keyFor']) {
  let stored: AcceptedCatalog | null = null;
  const value: CatalogSnapshotIO = {
    publicKey: publisher.pair.publicKey,
    keyFor,
    fetch: async (path) => {
      if (typeof offered === 'function') return offered();
      if (path.endsWith('index.sig.json')) return Response.json(offered);
      if (path === catalogIndexPath(offered.indexHash)) return new Response(toolText);
      return new Response('', { status: 404 });
    },
    read: async () => stored,
    latest: async () => stored,
    accept: async (_scope, snapshot) => {
      const fresh = catalogFreshness(snapshot.envelope, stored?.watermark ?? null);
      if (!fresh.ok) throw new Error(fresh.reason);
      stored = { watermark: { seq: snapshot.envelope.seq, signedAt: snapshot.envelope.signedAt }, snapshot };
    },
  };
  return { io: value, stored: () => stored, seed: (s: AcceptedCatalog | null) => { stored = s; } };
}
function selector(answer: () => Response | Promise<Response>, saved: SavedInstanceKey | null = null, allowed = true) {
  const origin = io(answer, saved);
  return {
    state: origin.state,
    keyFor: createCatalogKeySelector({ pinned: publisher.pair.publicKey, pinnedKeyId: publisher.keyId,
      instanceKey: allowed ? () => resolveInstanceCatalogKey(origin.io) : null }),
  };
}

test('a catalog signed by this origin\'s key is accepted; one signed by a third key is refused', async () => {
  const accepted = catalog(await envelope(instance), selector(() => json(instance.doc)).keyFor);
  assert.equal((await fetchSignedCatalogSnapshot(accepted.io)).envelope.keyId, instance.keyId);
  // The publisher-signed catalog of a static host still verifies, with no key request.
  const staticHost = selector(() => { throw new Error('a static host is never asked'); });
  await fetchSignedCatalogSnapshot(catalog(await envelope(publisher), staticHost.keyFor).io);
  assert.equal(staticHost.state.requests, 0);
  // A third key, under its own keyId or claiming the instance's, is refused.
  for (const offered of [await envelope(third), await envelope(third, instance.keyId), await envelope(third, publisher.keyId)]) {
    await assert.rejects(fetchSignedCatalogSnapshot(catalog(offered, selector(() => json(instance.doc)).keyFor).io), CatalogTrustError);
  }
  // Even when this origin serves the third key, a catalog naming the instance key is refused.
  await assert.rejects(fetchSignedCatalogSnapshot(catalog(await envelope(instance), selector(() => json(third.doc)).keyFor).io), CatalogTrustError);
});

test('no instance key, for any reason, leaves the pinned key alone and refuses the instance catalog', async () => {
  const offered = await envelope(instance);
  for (const answer of [() => new Response('', { status: 404 }), () => { throw new TypeError('offline'); }, () => json(instance.doc, { status: 500 })]) {
    await assert.rejects(fetchSignedCatalogSnapshot(catalog(offered, selector(answer).keyFor).io), CatalogTrustError);
  }
  // Not allowed (desktop and mobile apps, another origin): the served key is never read.
  const blocked = selector(() => json(instance.doc), null, false);
  await assert.rejects(fetchSignedCatalogSnapshot(catalog(offered, blocked.keyFor).io), CatalogTrustError);
  assert.equal(blocked.state.requests, 0);
});

test('offline, the saved key verifies the saved catalog; after a rotation the old key verifies nothing', async () => {
  const online = catalog(await envelope(instance), selector(() => json(instance.doc)).keyFor);
  await fetchSignedCatalogSnapshot(online.io);
  const saved = online.stored();
  // Offline: the catalog request and the key request both fail; the saved pair still verifies.
  const offline = catalog(() => { throw new TypeError('offline'); }, selector(() => { throw new TypeError('offline'); }, savedOf(instance)).keyFor);
  offline.seed(saved);
  assert.equal((await fetchSignedCatalogSnapshot(offline.io)).offline, true);
  // Offline with nothing saved for the key: refused, never accepted without a check.
  const forgotten = catalog(() => { throw new TypeError('offline'); }, selector(() => { throw new TypeError('offline'); }).keyFor);
  forgotten.seed(saved);
  await assert.rejects(fetchSignedCatalogSnapshot(forgotten.io), CatalogTrustError);
  // Rotation: the origin now serves a new key. An envelope from the old key is refused,
  // and one from the new key is accepted over the same saved floor.
  const stale = catalog(await envelope(instance, instance.keyId, 3), selector(() => json(rotated.doc), savedOf(instance)).keyFor);
  stale.seed(saved);
  await assert.rejects(fetchSignedCatalogSnapshot(stale.io), CatalogTrustError);
  const fresh = catalog(await envelope(rotated, rotated.keyId, 3), selector(() => json(rotated.doc), savedOf(instance)).keyFor);
  fresh.seed(saved);
  assert.equal((await fetchSignedCatalogSnapshot(fresh.io)).envelope.keyId, rotated.keyId);
});

test('the key request refuses redirects, so the answer comes from the address asked', async () => {
  let seen: RequestInit | undefined;
  await resolveInstanceCatalogKey({
    origin: 'https://work.example',
    fetch: async (_url, init) => { seen = init; throw new TypeError('offline'); },
    load: async () => null, save: async () => {}, forget: async () => {},
  });
  assert.equal(seen?.redirect, 'error');
  assert.equal(seen?.credentials, 'same-origin');
});
