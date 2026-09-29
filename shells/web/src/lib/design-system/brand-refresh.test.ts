// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://brand.example/' });
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
const { createBrandRefresh } = await import('./brand-refresh.ts');

function rig() {
  const state = { origin: 'alpha', revision: '1', safe: true, online: true, refreshes: 0, pending: false };
  const deps = { initial: '1', origin: () => state.origin, fetchRevision: async () => state.online ? state.revision : null,
    canRefresh: async () => state.safe, refresh: async () => { state.refreshes++; return state.online; },
    notify: (pending: boolean) => { state.pending = pending; } };
  return { state, deps };
}
test('revision refresh preserves open work and editable copies until a safe route is available', async () => {
  const { state, deps } = rig(); const check = createBrandRefresh(deps);
  await check(); assert.equal(state.refreshes, 0);
  state.revision = '2'; state.safe = false;
  await check(); assert.equal(state.refreshes, 0); assert.equal(state.pending, true);
  state.safe = true; await check(); assert.equal(state.refreshes, 1); assert.equal(state.pending, false);
  await check(); assert.equal(state.refreshes, 1);
});
test('offline checks retain their revision and retry after reconnect', async () => {
  const { state, deps } = rig(); const check = createBrandRefresh(deps);
  state.revision = '2'; state.online = false; await check(); assert.equal(state.refreshes, 0);
  state.online = true; await check(); assert.equal(state.refreshes, 1);
});
test('overlapping checks and a changed connection cannot apply an earlier response', async () => {
  const { state, deps } = rig(); let resolve!: (value: string) => void;
  deps.fetchRevision = () => new Promise<string>(done => { resolve = done; });
  const check = createBrandRefresh(deps), first = check(); await check();
  state.origin = 'beta'; resolve('2'); await first; assert.equal(state.refreshes, 0);
});
