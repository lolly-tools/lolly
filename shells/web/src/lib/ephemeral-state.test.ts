// SPDX-License-Identifier: MPL-2.0
/**
 * The memory-backed `host.state` for an ephemeral collab acceptor (plan 100 section 11.17).
 *
 * What matters here is not that a Map can hold records - it is that this is the SAME
 * StateAPI the web shell persists with, only over a different driver. So the tests
 * exercise the surface a tool and the shell actually call (save/load/list/delete,
 * plus `sizes()`/`_getAssetRefs()`, which the storage meter and the sync pruner
 * use), assert the record-level behaviour that only the shared implementation
 * provides (createdAt carry-forward, the `__`-prefixed markers on list rows), and
 * assert the isolation the feature exists for: two APIs never see each other, and
 * nothing here reaches IndexedDB.
 *
 * Run directly:  node --test shells/web/src/lib/ephemeral-state.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStateAPI, createMemoryStateDb } from './ephemeral-state.ts';

const SESSION = (label: string) => ({
  __toolId: 'qr-code',
  __toolVersion: '1.0.0',
  __label: label,
  __export_filename: `${label}.png`,
  url: 'https://example.test',
});

test('save / load / list / delete round-trip through the shared StateAPI', async () => {
  const state = createMemoryStateAPI();

  assert.equal(await state.load('missing'), null);
  assert.deepEqual(await state.list(), []);

  await state.save('qr-code:1', SESSION('first'), 'data:image/png;base64,AA');
  await state.save('qr-code:2', SESSION('second'));

  assert.deepEqual(await state.load('qr-code:1'), SESSION('first'));

  const rows = await state.list();
  assert.equal(rows.length, 2);
  const first = rows.find(r => r.slot === 'qr-code:1')!;
  assert.equal(first.toolId, 'qr-code');
  assert.equal(first.toolVersion, '1.0.0');
  assert.equal(first.label, 'first');
  assert.equal(first.filename, 'first.png', 'the export filename marker is surfaced');
  assert.equal(first.thumb, 'data:image/png;base64,AA');
  assert.ok(first.updatedAt);

  await state.delete('qr-code:1');
  assert.equal(await state.load('qr-code:1'), null);
  assert.deepEqual((await state.list()).map(r => r.slot), ['qr-code:2']);
});

test('a re-save carries the original creation time forward', async () => {
  const state = createMemoryStateAPI();
  await state.save('slot', SESSION('v1'));
  const created = (await state.list())[0]!.createdAt;
  assert.ok(created);

  await new Promise(r => setTimeout(r, 2));
  await state.save('slot', SESSION('v2'));
  const row = (await state.list())[0]!;

  assert.equal(row.createdAt, created, '"Date added" survives a re-save');
  assert.equal(row.label, 'v2');
});

test('a saved record is a snapshot - later mutation of the caller\'s object cannot reach it', async () => {
  const state = createMemoryStateAPI();
  const data = SESSION('live');
  await state.save('slot', data);

  data.url = 'https://mutated.test';
  assert.equal(((await state.load('slot')) as { url: string }).url, 'https://example.test');
});

test('sizes and the asset-ref walk work, so the storage meter and pruner are honest', async () => {
  const state = createMemoryStateAPI();
  await state.save('slot', {
    ...SESSION('with-assets'),
    logo: { source: 'library', id: 'suse/logo/primary', format: 'svg', version: 3 },
    rows: [{ pic: { source: 'library', id: 'photo/one?treatment=duo', format: 'jpg', version: 1 } }],
  });

  const sizes = await state.sizes();
  assert.ok((sizes.slot ?? 0) > 0);

  const refs = await state._getAssetRefs();
  assert.ok(refs.has('suse/logo/primary:svg:3'));
  assert.ok(refs.has('photo/one:jpg:1'), 'a derived ref resolves to its BASE blob key');
});

test('two ephemeral APIs are isolated, and neither touches a shared store', async () => {
  const acceptor = createMemoryStateAPI();
  const other = createMemoryStateAPI();

  await acceptor.save('slot', SESSION('acceptor only'));

  assert.equal(await other.load('slot'), null);
  assert.deepEqual(await other.list(), []);
  assert.equal((await acceptor.list()).length, 1);
});

test('the driver itself is a plain Map - no store name is honoured, no IDB involved', async () => {
  const db = createMemoryStateDb();
  assert.equal(await db.get('state', 'nope'), undefined);
  await db.put('state', {
    slot: 's', toolId: 't', toolVersion: '1', label: undefined,
    data: {}, thumb: null, updatedAt: 'now',
  });
  assert.equal((await db.getAll('state')).length, 1);
  await db.delete('state', 's');
  assert.deepEqual(await db.getAll('state'), []);
});
