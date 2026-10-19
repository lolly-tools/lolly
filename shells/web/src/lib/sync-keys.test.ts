// SPDX-License-Identifier: MPL-2.0
/**
 * lib/sync-keys.ts (plans/138 B2): the per-record key design. Sealing round-trips,
 * refuses the wrong keys, role and changed bytes, and object names hide content
 * hashes behind a key that only the passphrase gives.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveStoreKeys, isSealedObject, objectNameFor, openObject, resetStoreKeyCacheForTests, sealObject,
  sealedKeySettings, sha256Hex, SEAL_OVERHEAD,
} from './sync-keys.ts';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const ROUNDS = 1000; // keeps the test fast; the default is SYNC_KEY_ROUNDS

test('seal and open round-trip; the header names the salt and rounds', async () => {
  const keys = await deriveStoreKeys('correct horse', undefined, ROUNDS);
  const sealed = await sealObject(keys, bytes('a record body'), 'object');
  assert.ok(isSealedObject(sealed));
  assert.equal(sealed.length, bytes('a record body').length + SEAL_OVERHEAD);
  const settings = sealedKeySettings(sealed)!;
  assert.equal(settings.rounds, ROUNDS);
  assert.deepEqual([...settings.salt], [...keys.salt]);
  const again = await deriveStoreKeys('correct horse', settings.salt, settings.rounds);
  assert.equal(new TextDecoder().decode((await openObject(again, sealed, 'object'))!), 'a record body');
  // A fresh IV each time: the same plaintext never seals to the same bytes.
  assert.notDeepEqual([...await sealObject(keys, bytes('a record body'), 'object')], [...sealed]);
});

test('the wrong passphrase, the wrong role or changed bytes open to nothing', async () => {
  const keys = await deriveStoreKeys('correct horse', undefined, ROUNDS);
  const sealed = await sealObject(keys, bytes('index json'), 'index');
  const wrong = await deriveStoreKeys('battery staple', keys.salt, ROUNDS);
  assert.equal(await openObject(wrong, sealed, 'index'), null);
  assert.equal(await openObject(keys, sealed, 'object'), null, 'an index cannot be read as an object');
  const changed = sealed.slice();
  changed[changed.length - 1]! ^= 1;
  assert.equal(await openObject(keys, changed, 'index'), null);
  // Keys from another store generation (another salt) do not open it either.
  const other = await deriveStoreKeys('correct horse', undefined, ROUNDS);
  assert.equal(await openObject(other, sealed, 'index'), null);
  assert.equal(isSealedObject(bytes('{"plain":true}')), false);
  assert.equal(sealedKeySettings(bytes('{"plain":true}')), null);
});

test('object names: the content hash without keys, a keyed hash with them', async () => {
  const hash = await sha256Hex(bytes('known file'));
  assert.equal(await objectNameFor(null, hash), hash);
  const keys = await deriveStoreKeys('correct horse', undefined, ROUNDS);
  const named = await objectNameFor(keys, hash);
  assert.match(named, /^[0-9a-f]{64}$/);
  assert.notEqual(named, hash, 'a store reader cannot match a known file by its hash');
  assert.equal(await objectNameFor(keys, hash), named, 'the same content gets the same name: deduplication');
  resetStoreKeyCacheForTests();
  const sameStore = await deriveStoreKeys('correct horse', keys.salt, ROUNDS);
  assert.equal(await objectNameFor(sameStore, hash), named, 'every device with the passphrase names it the same');
  const otherStore = await deriveStoreKeys('correct horse', undefined, ROUNDS);
  assert.notEqual(await objectNameFor(otherStore, hash), named);
});

test('an empty passphrase or unreadable rounds are refused', async () => {
  await assert.rejects(() => deriveStoreKeys(''), /passphrase/);
  await assert.rejects(() => deriveStoreKeys('pw', new Uint8Array(16), 0), /key settings/);
});
