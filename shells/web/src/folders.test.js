// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the folder store (profile-backed group organization).
 * Run directly:  node --test shells/web/src/folders.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFolderStore } from './folders.js';

// Minimal in-memory host: a single profile record plus the two backing stores
// prune() reconciles against.
function makeHost({ slots = [], images = [] } = {}) {
  let profile = {};
  return {
    profile: {
      async get() { return profile; },
      async set(p) { profile = p; },
    },
    state: { async list() { return slots.map(slot => ({ slot })); } },
    assets: { async _listUserAssets() { return images.map(id => ({ id })); } },
    _profile: () => profile,
  };
}

test('create / list / rename / remove', async () => {
  const host = makeHost();
  const store = createFolderStore(host);

  const f = await store.create('My Event');
  assert.equal(f.name, 'My Event');
  assert.ok(f.id);
  assert.deepEqual(f.items, []);

  let all = await store.list();
  assert.equal(all.length, 1);

  await store.rename(f.id, 'Renamed');
  assert.equal((await store.get(f.id)).name, 'Renamed');

  await store.remove(f.id);
  assert.deepEqual(await store.list(), []);
});

test('create rejects an empty name', async () => {
  const store = createFolderStore(makeHost());
  await assert.rejects(() => store.create('   '), /name is required/);
});

test('single-membership: adding a ref pulls it out of any other folder', async () => {
  const host = makeHost();
  const store = createFolderStore(host);
  const a = await store.create('A');
  const b = await store.create('B');

  await store.addItem(a.id, { type: 'session', ref: '__batch__:x' });
  assert.equal((await store.get(a.id)).items.length, 1);

  await store.addItem(b.id, { type: 'session', ref: '__batch__:x' });
  assert.equal((await store.get(a.id)).items.length, 0);
  assert.equal((await store.get(b.id)).items.length, 1);

  // folderOfRef finds the current owner.
  const folders = await store.list();
  assert.equal(store.folderOfRef(folders, '__batch__:x'), b.id);
});

test('moveItem to a folder and back to root', async () => {
  const host = makeHost();
  const store = createFolderStore(host);
  const a = await store.create('A');

  await store.moveItem('user/img1', a.id, 'image');
  assert.equal((await store.get(a.id)).items[0].ref, 'user/img1');

  await store.moveItem('user/img1', null);   // → root
  assert.equal((await store.get(a.id)).items.length, 0);
});

test('swapSessionSlot rewrites a batch rename in place', async () => {
  const host = makeHost();
  const store = createFolderStore(host);
  const a = await store.create('A');
  await store.addItem(a.id, { type: 'session', ref: '__batch__:old' });

  await store.swapSessionSlot('__batch__:old', '__batch__:new');
  assert.equal((await store.get(a.id)).items[0].ref, '__batch__:new');
});

test('prune drops refs missing from both backing stores', async () => {
  const host = makeHost({ slots: ['__batch__:keep'], images: ['user/keep'] });
  const store = createFolderStore(host);
  const a = await store.create('A');
  await store.addItem(a.id, { type: 'session', ref: '__batch__:keep' });
  await store.addItem(a.id, { type: 'session', ref: '__batch__:gone' });
  await store.addItem(a.id, { type: 'image', ref: 'user/keep' });
  await store.addItem(a.id, { type: 'image', ref: 'user/gone' });

  const { removed } = await store.prune();
  assert.equal(removed, 2);
  const refs = (await store.get(a.id)).items.map(i => i.ref).sort();
  assert.deepEqual(refs, ['__batch__:keep', 'user/keep']);
});

test('prune is a no-op (no write) when everything still exists', async () => {
  const host = makeHost({ slots: ['__batch__:keep'] });
  const store = createFolderStore(host);
  const a = await store.create('A');
  await store.addItem(a.id, { type: 'session', ref: '__batch__:keep' });

  const before = host._profile();
  const { removed } = await store.prune();
  assert.equal(removed, 0);
  // Same object identity → no profile.set happened.
  assert.equal(host._profile(), before);
});

test('mutations preserve sibling profile fields', async () => {
  const host = makeHost();
  host.profile.set({ firstname: 'Ada', featureFlags: { 'pro-batch': true } });
  const store = createFolderStore(host);
  await store.create('A');
  const p = host._profile();
  assert.equal(p.firstname, 'Ada');
  assert.deepEqual(p.featureFlags, { 'pro-batch': true });
  assert.equal(p.folders.length, 1);
});
