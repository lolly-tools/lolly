// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the folder store (profile-backed group organization).
 * Run directly:  node --test shells/web/src/folders.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFolderStore } from './folders.ts';

// Minimal in-memory host: a single profile record plus the two backing stores
// prune() reconciles against.
function makeHost({ slots = [], images = [], catalog }: { slots?: string[]; images?: string[]; catalog?: string[] } = {}) {
  let profile: any = {};
  return {
    profile: {
      async get() { return profile; },
      async set(p: any) { profile = p; },
    },
    state: { async list() { return slots.map(slot => ({ slot })); } },
    assets: {
      async _listUserAssets() { return images.map(id => ({ id })); },
      // Only present when the test opts in - mirrors the optional web-host method, so
      // a host without it still prunes (catalog references simply aren't recognised).
      ...(catalog ? { async _listCatalogAssetIds() { return catalog; } } : {}),
    },
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

  const all = await store.list();
  assert.equal(all.length, 1);

  await store.rename(f.id, 'Renamed');
  assert.equal((await store.get(f.id))!.name, 'Renamed');

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
  assert.equal((await store.get(a.id))!.items.length, 1);

  await store.addItem(b.id, { type: 'session', ref: '__batch__:x' });
  assert.equal((await store.get(a.id))!.items.length, 0);
  assert.equal((await store.get(b.id))!.items.length, 1);

  // folderOfRef finds the current owner.
  const folders = await store.list();
  assert.equal(store.folderOfRef(folders, '__batch__:x'), b.id);
});

test('moveItem to a folder and back to root', async () => {
  const host = makeHost();
  const store = createFolderStore(host);
  const a = await store.create('A');

  await store.moveItem('user/img1', a.id, 'image');
  assert.equal((await store.get(a.id))!.items[0]!.ref, 'user/img1');

  await store.moveItem('user/img1', null);   // → root
  assert.equal((await store.get(a.id))!.items.length, 0);
});

test('swapSessionSlot rewrites a batch rename in place', async () => {
  const host = makeHost();
  const store = createFolderStore(host);
  const a = await store.create('A');
  await store.addItem(a.id, { type: 'session', ref: '__batch__:old' });

  await store.swapSessionSlot('__batch__:old', '__batch__:new');
  assert.equal((await store.get(a.id))!.items[0]!.ref, '__batch__:new');
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
  const refs = (await store.get(a.id))!.items.map(i => i.ref).sort();
  assert.deepEqual(refs, ['__batch__:keep', 'user/keep']);
});

test('prune keeps catalog references (by base id) and drops unknown image refs', async () => {
  const host = makeHost({ catalog: ['suse/logo/primary'] });
  const store = createFolderStore(host);
  const a = await store.create('A');
  await store.addItem(a.id, { type: 'image', ref: 'suse/logo/primary' });          // referenced catalog asset → kept
  await store.addItem(a.id, { type: 'image', ref: 'suse/logo/primary?treatment=x' }); // modifier stripped → same base → kept
  await store.addItem(a.id, { type: 'image', ref: 'suse/removed/asset' });          // not in catalog, not a user asset → dropped

  const { removed } = await store.prune();
  assert.equal(removed, 1);
  const refs = (await store.get(a.id))!.items.map(i => i.ref).sort();
  assert.deepEqual(refs, ['suse/logo/primary', 'suse/logo/primary?treatment=x']);
});

test('prune drops a catalog-style ref when the host cannot list catalog ids', async () => {
  // No _listCatalogAssetIds on the host → the old behaviour: only user assets survive.
  const host = makeHost({ images: ['user/keep'] });
  const store = createFolderStore(host);
  const a = await store.create('A');
  await store.addItem(a.id, { type: 'image', ref: 'user/keep' });
  await store.addItem(a.id, { type: 'image', ref: 'suse/logo/primary' });

  const { removed } = await store.prune();
  assert.equal(removed, 1);
  assert.deepEqual((await store.get(a.id))!.items.map(i => i.ref), ['user/keep']);
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

test('project templates: snapshot → add → instantiate with fresh ids + remapped slots', async () => {
  const host = makeHost({ slots: ['qr:1', 'qr:2'] });
  const store = createFolderStore(host);
  const root = await store.create('Campaign');
  const child = await store.create('Print', root.id);
  await store.addItem(root.id, { type: 'session', ref: 'qr:1' });
  await store.addItem(child.id, { type: 'session', ref: 'qr:2' });
  await store.addItem(child.id, { type: 'image', ref: 'user/hero' });

  const tree = (await store.snapshotSubtree(root.id))!;
  assert.deepEqual(tree.map(f => f.name), ['Campaign', 'Print']);
  // The view copies each session to a __ptpl__: slot and rewrites the refs before saving.
  const captured = tree.map(f => ({ ...f, items: f.items.filter(i => i.type === 'session').map(i => ({ type: i.type, ref: `__ptpl__:t1:${i.ref}` })) }));
  const tpl = await store.templateAdd({ name: 'Campaign kit', tree: captured });
  assert.equal((await store.templateList())[0]!.id, tpl.id);

  // Instantiate twice: distinct folder ids each time, slots remapped, unknown slots dropped.
  const slotMap = new Map([['__ptpl__:t1:qr:1', 'qr:10'], ['__ptpl__:t1:qr:2', 'qr:11']]);
  const a = (await store.instantiateSubtree(tpl.tree, null, slotMap))!;
  const b = (await store.instantiateSubtree(tpl.tree, root.id, new Map([['__ptpl__:t1:qr:1', 'qr:20']])))!;
  const all = await store.list();
  assert.equal(all.length, 6);
  assert.notEqual(a.id, root.id);
  assert.notEqual(a.id, b.id);
  assert.equal(b.parentId, root.id);
  const aChild = all.find(f => f.parentId === a.id)!;
  assert.equal(aChild.name, 'Print');
  assert.deepEqual(aChild.items, [{ type: 'session', ref: 'qr:11' }]);   // image ref dropped, slot remapped
  const bChild = all.find(f => f.parentId === b.id)!;
  assert.deepEqual(bChild.items, []);                                     // unmapped slot dropped

  await store.templateDrop(tpl.id);
  assert.deepEqual(await store.templateList(), []);
  assert.equal(host._profile().folders.length, 6);   // sibling field untouched by the drop
});
