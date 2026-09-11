// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the design-system registry (plans/186 sections 3.1, 3.3, 4).
 * Run directly:  node --test shells/web/src/lib/design-system/registry.test.ts
 *
 * DOM-free: the registry takes an `idb`-shaped store, stubbed here as maps, and
 * a probe for the two reads the migration makes. The pack meta read goes through
 * lib/pack-store.ts's module state, which is null in a fresh process - the pack
 * cases set it through the store's own test seam.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_DESIGN_SYSTEM_KEY, DESIGN_SYSTEMS_STORE, createDesignSystemRegistry, stripTokensSuffix,
  type DesignSystemRecord, type RegistryDb, type RegistryProbe,
} from './registry.ts';

function memDb(withStore = true): RegistryDb & { stores: Map<string, Map<IDBValidKey, unknown>> } {
  const stores = new Map<string, Map<IDBValidKey, unknown>>([['profile', new Map()]]);
  if (withStore) stores.set(DESIGN_SYSTEMS_STORE, new Map());
  const of = (s: string) => stores.get(s) ?? (() => { throw new Error(`no store ${s}`); })();
  return {
    stores,
    async get(s, k) { return of(s).get(k); },
    async put(s, v, k) {
      const key = k ?? (v as { id: IDBValidKey }).id;
      of(s).set(key, v);
      return key;
    },
    async delete(s, k) { of(s).delete(k); },
    async getAll(s) { return [...of(s).values()]; },
    objectStoreNames: { contains: (n) => stores.has(n) },
  };
}

const probe = (o: Partial<{ catalog: { id: string; name?: string; brandLock?: boolean } | null; legacy: { meta?: Record<string, unknown> } | null }> = {}): RegistryProbe => ({
  catalogTokens: async () => o.catalog === undefined ? { id: 'lolly/tokens/brand', name: 'Lolly Starter Tokens' } : o.catalog,
  legacyHead: async () => o.legacy ?? null,
});

test('a fresh device migrates to a shipped record only, and it is active', async () => {
  const db = memDb();
  const reg = createDesignSystemRegistry(db, probe());
  await reg.ensure();
  const rows = await reg.list();
  assert.deepEqual(rows.map(r => r.id), ['shipped']);
  assert.equal(rows[0]!.label, 'Lolly Starter');   // the tokens suffix is trimmed for a switcher
  assert.equal(rows[0]!.headId, 'lolly/tokens/brand');
  assert.equal(await reg.activeId(), 'shipped');
  assert.equal(db.stores.get('profile')!.get(ACTIVE_DESIGN_SYSTEM_KEY), 'shipped');
});

test('a device with a legacy user head migrates to a default record under user/ and activates it', async () => {
  const db = memDb();
  const reg = createDesignSystemRegistry(db, probe({ legacy: { meta: { name: 'Acme' } } }));
  await reg.ensure();
  const rows = await reg.list();
  assert.deepEqual(rows.map(r => r.id), ['shipped', 'default']);
  const d = rows[1]!;
  assert.equal(d.label, 'Acme');
  assert.equal(d.ns, 'user/');                       // never re-keyed (plan 186 section 3.2)
  assert.equal(d.headId, 'user/tokens/brand');
  assert.equal(d.source.kind, 'local');
  assert.equal(await reg.activeId(), 'default');
});

test('the placeholder name "Brand tokens" is not carried as a label', async () => {
  const reg = createDesignSystemRegistry(memDb(), probe({ legacy: { meta: { name: 'Brand tokens' } } }));
  assert.equal((await reg.get('default'))!.label, 'My design system');
});

test('ensure() is idempotent - a second call never re-migrates or duplicates', async () => {
  const db = memDb();
  const reg = createDesignSystemRegistry(db, probe({ legacy: { meta: {} } }));
  await reg.ensure();
  await reg.ensure();
  await reg.setActive('shipped');
  const again = createDesignSystemRegistry(db, probe({ legacy: { meta: {} } }));
  await again.ensure();
  assert.equal((await again.list()).length, 2);
  assert.equal(await again.activeId(), 'shipped');   // the pointer survived, not reset by a re-open
});

test('put/get/remove/setActive round-trip; removing the active one falls back to shipped', async () => {
  const reg = createDesignSystemRegistry(memDb(), probe());
  const rec: DesignSystemRecord = {
    id: 'acme', label: 'Acme', ns: 'user/ds/acme/', headId: 'user/ds/acme/tokens/brand',
    source: { kind: 'local' }, locked: false, createdAt: 1, lastUsedAt: 1,
  };
  await reg.put(rec);
  assert.equal((await reg.get('acme'))!.label, 'Acme');
  await reg.setActive('acme');
  assert.equal(await reg.activeId(), 'acme');
  assert.ok((await reg.get('acme'))!.lastUsedAt > 1);  // a switch stamps last use
  await reg.remove('acme');
  assert.equal(await reg.get('acme'), null);
  assert.equal(await reg.activeId(), 'shipped');
});

test('the shipped record cannot be removed and an unknown id cannot be activated', async () => {
  const reg = createDesignSystemRegistry(memDb(), probe());
  await assert.rejects(() => reg.remove('shipped'), /cannot be removed/);
  await assert.rejects(() => reg.setActive('nope'), /no system/);
  await assert.rejects(() => reg.put({ id: 'Bad Id', label: '', ns: '', headId: '', source: { kind: 'local' }, locked: false, createdAt: 0, lastUsedAt: 0 }), /not a usable id/);
});

test('a pointer at a record that no longer exists reads as shipped', async () => {
  const db = memDb();
  const reg = createDesignSystemRegistry(db, probe());
  await reg.ensure();
  db.stores.get('profile')!.set(ACTIVE_DESIGN_SYSTEM_KEY, 'ghost');
  reg.bust();
  assert.equal(await reg.activeId(), 'shipped');
  assert.equal((await reg.active()).id, 'shipped');
});

test('summary() is the HostV1 shape, with the instance only for a hosted record', async () => {
  const reg = createDesignSystemRegistry(memDb(), probe());
  const hosted: DesignSystemRecord = {
    id: 'suse', label: 'SUSE', ns: 'user/ds/suse/', headId: 'user/ds/suse/tokens/brand',
    source: { kind: 'hosted', instance: 'https://brand.suse.com', packUrl: null, signature: 'verified' },
    locked: true, createdAt: 1, lastUsedAt: 1,
  };
  assert.deepEqual(reg.summary(hosted, 'suse'), {
    id: 'suse', label: 'SUSE', source: 'hosted', active: true, locked: true,
    headId: 'user/ds/suse/tokens/brand', instance: 'https://brand.suse.com',
  });
  const local = { ...hosted, id: 'a', source: { kind: 'local' as const }, locked: false };
  assert.equal('instance' in reg.summary(local, 'suse'), false);
  assert.equal(reg.summary(local, 'suse').active, false);
});

test('without the object store (a DB rebuilt at an older version) the registry is inert', async () => {
  const reg = createDesignSystemRegistry(memDb(false), probe({ legacy: { meta: { name: 'X' } } }));
  await reg.ensure();
  assert.deepEqual(await reg.list(), []);
  assert.equal(await reg.activeId(), 'shipped');
});

test('stripTokensSuffix trims the catalog naming convention and leaves other names alone', () => {
  assert.equal(stripTokensSuffix('Lolly Starter Tokens'), 'Lolly Starter');
  assert.equal(stripTokensSuffix('SUSE Brand Tokens'), 'SUSE');
  assert.equal(stripTokensSuffix('SUSE Design Tokens'), 'SUSE');
  assert.equal(stripTokensSuffix('Tokens'), 'Tokens');
  assert.equal(stripTokensSuffix('Acme'), 'Acme');
});
