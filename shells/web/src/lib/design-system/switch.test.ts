// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system switch as a recorded call list (plans/186 section 3.4).
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/switch.test.ts
 *
 * jsdom globals go in before the module import: the switch paints chrome
 * (documentElement), fires window events and reads document.fonts. The host is
 * a stub that records what was asked of it; the registry is the real one over a
 * map-backed store, so the pointer and the record reads are exercised for real.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof CustomEvent;
globalThis.Event = dom.window.Event as unknown as typeof Event;
// jsdom has no document.fonts; the font registration path reads it.
Object.defineProperty(dom.window.document, 'fonts', { value: { add() {}, delete() { return true; } }, configurable: true });

const { createDesignSystemRegistry } = await import('./registry.ts');
const { switchDesignSystem, DESIGN_SYSTEM_CHANGED_EVENT, REMOUNTABLE_ROUTES, instanceOf } = await import('./switch.ts');
const { _setBaseForTests, getInstanceBase } = await import('../instance.ts');
type Registry = ReturnType<typeof createDesignSystemRegistry>;
type Record_ = Awaited<ReturnType<Registry['active']>>;

function memDb() {
  const stores = new Map<string, Map<IDBValidKey, unknown>>([['profile', new Map()], ['design-systems', new Map()]]);
  const of = (s: string) => stores.get(s)!;
  return {
    async get(s: string, k: IDBValidKey) { return of(s).get(k); },
    async put(s: string, v: unknown, k?: IDBValidKey) { const key = k ?? (v as { id: IDBValidKey }).id; of(s).set(key, v); return key; },
    async delete(s: string, k: IDBValidKey) { of(s).delete(k); },
    async getAll(s: string) { return [...of(s).values()]; },
    objectStoreNames: { contains: (n: string) => stores.has(n) },
  };
}

async function rig() {
  const calls: string[] = [];
  const registry = createDesignSystemRegistry(memDb(), {
    catalogTokens: async () => ({ id: 'lolly/tokens/brand', name: 'Lolly Starter Tokens' }),
    legacyHead: async () => ({ meta: { name: 'Acme' } }),
  });
  await registry.ensure();
  const hosted: Record_ = {
    id: 'suse', label: 'SUSE', ns: 'user/ds/suse/', headId: 'user/ds/suse/tokens/brand',
    source: { kind: 'hosted', instance: 'https://brand.suse.com', packUrl: null, signature: 'verified' },
    locked: true, createdAt: 2, lastUsedAt: 2,
  };
  await registry.put(hosted);
  const host = {
    designSystems: registry,
    assets: { _exportUserAssets: async () => { calls.push('fonts:read'); return []; } },
    tokens: {
      bust: (o?: { lock?: boolean }) => { calls.push(`bust${o?.lock ? ':lock' : ''}`); },
      colors: async () => { calls.push('colors'); return [{ ref: '{c.x}', value: '#123456', name: 'x', group: 'g' }]; },
      resolve: async () => null,
      get: async () => ({ size: 0 }),
      themes: async () => [],
    },
    profile: { get: async () => ({}), set: async () => {}, subscribe: () => () => {} },
    log() {},
  };
  const resync = async () => { calls.push('resync'); };
  // The shell's base write needs IndexedDB; here the in-memory seam stands in.
  const setBase = async (url: string | null) => { calls.push(`base:${url ?? ''}`); _setBaseForTests(url ?? ''); };
  return { calls, registry, host, resync, setBase };
}

test('a switch moves the pointer, busts with the lock, re-registers fonts, repaints, and fires the event', async () => {
  const r = await rig();
  _setBaseForTests('');
  const events: string[] = [];
  window.addEventListener(DESIGN_SYSTEM_CHANGED_EVENT, (e) => events.push((e as CustomEvent).detail.id));
  const result = await switchDesignSystem(r.host as unknown as Parameters<typeof switchDesignSystem>[0], 'shipped', { route: 'gallery', resync: r.resync, setBase: r.setBase });
  assert.equal(result.record.id, 'shipped');
  assert.equal(await r.registry.activeId(), 'shipped');
  assert.equal(r.calls[0], 'bust:lock');            // the lock verdict goes with the pointer
  assert.ok(r.calls.includes('fonts:read'));        // fonts re-registered for the new system
  assert.ok(r.calls.includes('colors'));            // swatches refreshed from the new tokens
  assert.deepEqual(events, ['shipped']);
  assert.equal(result.needsReload, false);          // the gallery is remountable
  assert.equal(result.baseChanged, false);          // neither record is hosted
});

test('entering a hosted record sets its instance as the base and resyncs; leaving it clears the base', async () => {
  const r = await rig();
  _setBaseForTests('');
  let res = await switchDesignSystem(r.host as unknown as Parameters<typeof switchDesignSystem>[0], 'suse', { route: 'dashboard', resync: r.resync, setBase: r.setBase });
  assert.equal(res.baseChanged, true);
  assert.equal(getInstanceBase(), 'https://brand.suse.com');
  assert.ok(r.calls.includes('resync'));
  res = await switchDesignSystem(r.host as unknown as Parameters<typeof switchDesignSystem>[0], 'default', { route: 'dashboard', resync: r.resync, setBase: r.setBase });
  assert.equal(res.baseChanged, true);
  assert.equal(getInstanceBase(), '');
});

test('a base the person set by hand is left alone when switching between non-hosted records', async () => {
  const r = await rig();
  _setBaseForTests('https://sheet.example');
  const res = await switchDesignSystem(r.host as unknown as Parameters<typeof switchDesignSystem>[0], 'shipped', { route: 'gallery', resync: r.resync, setBase: r.setBase });
  assert.equal(res.baseChanged, false);
  assert.equal(getInstanceBase(), 'https://sheet.example');
  _setBaseForTests('');
});

test('a mounted tool is never remounted under someone - the caller is told to show the banner', async () => {
  const r = await rig();
  let remounts = 0;
  const onRemount = () => { remounts++; };
  window.addEventListener('lolly:remount', onRemount);
  const res = await switchDesignSystem(r.host as unknown as Parameters<typeof switchDesignSystem>[0], 'suse', { route: 'tool', resync: r.resync, setBase: r.setBase });
  assert.equal(res.needsReload, true);
  assert.equal(remounts, 0);
  const again = await switchDesignSystem(r.host as unknown as Parameters<typeof switchDesignSystem>[0], 'default', { route: 'profile', resync: r.resync, setBase: r.setBase });
  assert.equal(again.needsReload, false);
  assert.equal(remounts, 1);
  window.removeEventListener('lolly:remount', onRemount);
  _setBaseForTests('');
});

test('the remountable set is the stateless views only, and instanceOf reads a hosted record', async () => {
  assert.ok(REMOUNTABLE_ROUTES.has('gallery') && REMOUNTABLE_ROUTES.has('profile'));
  assert.equal(REMOUNTABLE_ROUTES.has('tool'), false);
  assert.equal(REMOUNTABLE_ROUTES.has('batch'), false);
  const r = await rig();
  assert.equal(instanceOf((await r.registry.get('suse'))!), 'https://brand.suse.com');
  assert.equal(instanceOf((await r.registry.get('default'))!), '');
});

test('an unknown id is refused before anything moves', async () => {
  const r = await rig();
  await assert.rejects(() => switchDesignSystem(r.host as unknown as Parameters<typeof switchDesignSystem>[0], 'nope', { resync: r.resync, setBase: r.setBase }), /no system/);
  assert.equal(await r.registry.activeId(), 'default');
  assert.deepEqual(r.calls, []);
});
