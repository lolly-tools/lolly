// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('the database name isolates a viewing tab from the usual database', async (ctx) => {
  const savedSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const savedIDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  ctx.after(() => {
    for (const [key, descriptor] of [['sessionStorage', savedSession], ['indexedDB', savedIDB]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const names: string[] = [];
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open(name: string) { names.push(name); throw new Error('test database open'); },
  } });
  for (const active of [false, true]) {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
      getItem: () => active ? JSON.stringify({ token: 'view-token', expiresAt: new Date(Date.now() + 60_000).toISOString(), programme: { id: 'p1', name: 'Partners' } }) : null,
    } });
    const url = new URL(`./db.ts?view-as-test=${active}`, import.meta.url);
    const { openDB } = await import(url.href);
    await assert.rejects(openDB(), /test database open/);
  }
  assert.deepEqual(names, ['lolly', 'lolly-view-as']);
});
