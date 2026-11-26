// SPDX-License-Identifier: MPL-2.0
/**
 * lib/instance.ts: connecting again to an instance that was set aside for this page
 * load keeps the session the person signed in with, and the session still travels to
 * that instance alone. Choosing another instance, or the bundled tools, drops it.
 *
 * Run directly:  node --test shells/web/src/lib/instance-reconnect.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  _setProfileDbForTests, getInstanceBase, hasInstanceSession, initInstanceBase, instanceCatalogKeyId, instanceFetch,
  setInstanceBase, setInstanceCatalogKeyId, setInstanceSession, suspendInstanceBase, suspendedInstanceBase,
} from './instance.ts';

const WORK = 'https://work.example';
const KEY = 'A'.repeat(43);

/** The 'profile' store as a map, in place of IndexedDB. */
function profileStore(seed: Record<string, unknown> = {}): Map<string, unknown> {
  const rows = new Map<string, unknown>(Object.entries(seed));
  _setProfileDbForTests(async () => ({
    get: async (_store: string, key: string) => rows.get(key),
    put: async (_store: string, value: unknown, key: string) => { rows.set(key, value); return key; },
    delete: async (_store: string, key: string) => { rows.delete(key); },
  }) as never);
  return rows;
}

/** A Tauri page on its own origin; every native request is recorded. */
function nativeShell(ctx: { after(fn: () => void): void }): Array<{ url: string; headers: Array<[string, string]> }> {
  const requests: Array<{ url: string; headers: Array<[string, string]> }> = [];
  const saved = ['window', 'location', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'tauri://localhost', href: 'tauri://localhost/' } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    __TAURI_INTERNALS__: { invoke: async (_command: string, args: { request: typeof requests[number] }) => {
      requests.push(args.request);
      return { status: 200, statusText: 'OK', url: args.request.url, headers: [], body: [] };
    } },
  } });
  ctx.after(() => {
    _setProfileDbForTests(null);
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  return requests;
}

const cookieOf = (request: { headers: Array<[string, string]> } | undefined): string | null => new Headers(request?.headers).get('cookie');

test('connecting again to an instance that was set aside keeps the stored session', async (ctx) => {
  const requests = nativeShell(ctx);
  const rows = profileStore({
    'instance-base': WORK,
    'instance-session': { origin: WORK, cookiePair: 'lw_session=kept' },
    'install-id': 'install-1',
  });
  await initInstanceBase();
  assert.equal(getInstanceBase(), WORK);
  assert.ok(hasInstanceSession());

  // The catalog did not verify: bundled tools for this page load, the choice still saved.
  assert.equal(suspendInstanceBase(), WORK);
  assert.equal(hasInstanceSession(), false);
  await instanceFetch(`${WORK}/api/auth/session`);
  assert.equal(cookieOf(requests.at(-1)), null, 'a set-aside instance is sent no session');

  // The person connects to the same instance again and accepts its key.
  await setInstanceBase(WORK);
  await setInstanceCatalogKeyId(KEY);
  assert.deepEqual(rows.get('instance-session'), { origin: WORK, cookiePair: 'lw_session=kept' }, 'the stored session is not deleted');
  assert.equal(rows.get('install-id'), 'install-1');
  assert.equal(suspendedInstanceBase(), '');
  assert.ok(hasInstanceSession(), 'the session is in use again without a second sign-in');
  assert.equal(instanceCatalogKeyId(), KEY);
  await instanceFetch(`${WORK}/api/auth/session`);
  assert.equal(cookieOf(requests.at(-1)), 'lw_session=kept');
  // Still to that instance alone.
  await instanceFetch('https://other.example/catalog/assets/index.json');
  assert.equal(cookieOf(requests.at(-1)), null);
});

test('choosing another instance after a set-aside drops the first one\'s session and key', async (ctx) => {
  nativeShell(ctx);
  const rows = profileStore({
    'instance-base': WORK,
    'instance-session': { origin: WORK, cookiePair: 'lw_session=first' },
    'instance-catalog-key': { origin: WORK, keyId: KEY },
    'install-id': 'install-1',
  });
  await initInstanceBase();
  suspendInstanceBase();
  await setInstanceBase('https://second.example');
  assert.equal(rows.has('instance-session'), false);
  assert.equal(rows.has('instance-catalog-key'), false);
  assert.equal(rows.has('install-id'), false);
  assert.equal(hasInstanceSession(), false);
  assert.equal(instanceCatalogKeyId(), '');
});

test('choosing the bundled tools after a set-aside forgets the instance and its session', async (ctx) => {
  nativeShell(ctx);
  const rows = profileStore({
    'instance-base': WORK,
    'instance-session': { origin: WORK, cookiePair: 'lw_session=first' },
  });
  await initInstanceBase();
  suspendInstanceBase();
  await setInstanceBase(null);
  assert.equal(rows.has('instance-base'), false);
  assert.equal(rows.has('instance-session'), false);
  assert.equal(suspendedInstanceBase(), '');
});

test('a stored session that belongs to another origin is not taken up on reconnect', async (ctx) => {
  const requests = nativeShell(ctx);
  const rows = profileStore({ 'instance-base': WORK });
  await initInstanceBase();
  suspendInstanceBase();
  // A record for another origin under the session key (a damaged or old store).
  rows.set('instance-session', { origin: 'https://other.example', cookiePair: 'lw_session=foreign' });
  await setInstanceBase(WORK);
  assert.equal(hasInstanceSession(), false);
  await instanceFetch(`${WORK}/api/auth/session`);
  assert.equal(cookieOf(requests.at(-1)), null);
  await setInstanceSession(null);
});
