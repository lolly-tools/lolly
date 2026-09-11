// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memberSaveValues, applySharedEdit, type LazyMember } from './multi-edit-lazy.ts';
import type { Runtime } from '../../../../engine/src/runtime.js';
import type { InputValue } from '../../../../engine/src/inputs.js';

// A minimal fake runtime: records setInput calls; modelValues reads its store.
function fakeRuntime(store: Record<string, InputValue>): Runtime {
  return {
    async setInput(id: string, value: unknown) { store[id] = value as InputValue; },
  } as unknown as Runtime;
}
const model = (r: Runtime): Record<string, InputValue> => (r as unknown as { _store?: never }) && STORE.get(r)!;
const STORE = new WeakMap<Runtime, Record<string, InputValue>>();
function runtimeWith(store: Record<string, InputValue>): Runtime {
  const r = fakeRuntime(store);
  STORE.set(r, store);
  return r;
}

test('save reads the runtime model when a cell is live', () => {
  const store = { url: 'https://live.example', size: 4 };
  const m: LazyMember = { runtime: runtimeWith(store), values: { url: 'stale' }, dirty: false };
  assert.deepEqual(memberSaveValues(m, model), store);
});

test('save reads the buffered seed when a cell was never built', () => {
  const m: LazyMember = { runtime: null, values: { url: 'https://seed.example' }, dirty: false };
  assert.deepEqual(memberSaveValues(m, model), { url: 'https://seed.example' });
});

test('a shared edit on a live cell goes through its runtime', async () => {
  const store: Record<string, InputValue> = { url: 'old' };
  const m: LazyMember = { runtime: runtimeWith(store), values: {}, dirty: false };
  await applySharedEdit(m, 'url', 'https://new.example');
  assert.equal(store.url, 'https://new.example', 'runtime received the edit');
  assert.deepEqual(m.values, {}, 'the seed is not touched for a live cell');
  assert.equal(m.dirty, true);
});

test('a shared edit on a frozen cell buffers into the seed, so createRuntime picks it up', async () => {
  const m: LazyMember = { runtime: null, values: { url: 'https://seed.example' }, dirty: false };
  await applySharedEdit(m, 'url', 'https://buffered.example');
  // The buffered value is exactly what memberSaveValues (and the createRuntime seed) will use.
  assert.equal(m.values.url, 'https://buffered.example');
  assert.deepEqual(memberSaveValues(m, model), { url: 'https://buffered.example' });
  assert.equal(m.dirty, true);
});
