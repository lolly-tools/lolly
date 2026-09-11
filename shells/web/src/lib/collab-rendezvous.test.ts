// SPDX-License-Identifier: MPL-2.0
/**
 * lib/collab-rendezvous.ts (plans/138 Tier C) - the shared-store signalling
 * rendezvous. The full inviter/joiner handshake over an in-memory PathStore, and
 * the security properties: payload encrypted at rest, path is a hash of the code
 * (never the code itself), and a mismatched code can't read the exchange.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  publishOfferAwaitAnswer, awaitOfferPublishAnswer, pathStoreFor, rendezvousKinds,
  type PathStore,
} from './collab-rendezvous.ts';
import { isEncryptedSnapshot } from './snapshot-crypto.ts';

function memStore(): PathStore & { dump(): Map<string, Uint8Array> } {
  const m = new Map<string, Uint8Array>();
  return {
    kind: 'memory',
    async getAt(path) { return m.get(path) ?? null; },
    async putAt(path, bytes) { m.set(path, bytes.slice()); },
    dump() { return m; },
  };
}

const sleep = (): Promise<void> => new Promise((r) => setTimeout(r, 1));

test('inviter and joiner complete the handshake through the store', async () => {
  const store = memStore();
  const [answer, joiner] = await Promise.all([
    publishOfferAwaitAnswer(store, 'code-123', 'THE_OFFER', { sleep, pollMs: 1, timeoutMs: 5000 }),
    awaitOfferPublishAnswer(store, 'code-123', async (offer) => `ANSWER<${offer}>`, { sleep, pollMs: 1, timeoutMs: 5000 }),
  ]);
  assert.equal(joiner.offerToken, 'THE_OFFER', 'joiner read the offer');
  assert.equal(answer, 'ANSWER<THE_OFFER>', 'inviter got the joiner’s answer');
});

test('the store holds only ciphertext, at a path that does not carry the code', async () => {
  const store = memStore();
  // Publish the offer, then let the answer-wait time out immediately (no joiner).
  await publishOfferAwaitAnswer(store, 'super-secret', 'OFFER', { sleep, pollMs: 1, timeoutMs: 1, now: (() => { let n = 0; return () => (n += 10); })() })
    .catch(() => { /* expected timeout; the offer was published first */ });

  const keys = [...store.dump().keys()];
  const offerKey = keys.find((k) => k.endsWith('/offer'));
  assert.ok(offerKey, 'an offer was published');
  assert.ok(!offerKey!.includes('super-secret'), 'the path is a hash, not the code');
  assert.ok(isEncryptedSnapshot(store.dump().get(offerKey!)!), 'the payload is encrypted to the code');
});

test('a mismatched code cannot read the exchange (different path, times out)', async () => {
  const store = memStore();
  await publishOfferAwaitAnswer(store, 'right-code', 'OFFER', { sleep, pollMs: 1, timeoutMs: 1, now: (() => { let n = 0; return () => (n += 10); })() }).catch(() => {});
  // A joiner with the wrong code derives a different rendezvous path → never sees the offer.
  const advancing = (() => { let n = 0; return () => (n += 10); })();
  await assert.rejects(
    () => awaitOfferPublishAnswer(store, 'wrong-code', async () => 'A', { sleep, pollMs: 1, timeoutMs: 1, now: advancing }),
    /Timed out/,
  );
});

test('a wait aborts promptly on signal', async () => {
  const store = memStore();
  const ac = new AbortController();
  const p = awaitOfferPublishAnswer(store, 'c', async () => 'A', { sleep, pollMs: 50, timeoutMs: 100_000, signal: ac.signal });
  ac.abort();
  await assert.rejects(() => p, /cancelled/i);
});

test('pathStoreFor: known providers yield a store, unknown yields null', () => {
  assert.equal(pathStoreFor('nope'), null);
  assert.equal(pathStoreFor('s3')?.kind, 's3');
  assert.deepEqual(rendezvousKinds().sort(), ['dropbox', 'gdrive', 's3', 'webdav']);
});
