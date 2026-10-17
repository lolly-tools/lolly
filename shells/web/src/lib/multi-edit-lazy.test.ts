// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memberSaveValues, applySharedEdit, runtimeSaveValues, sessionSaveData, sessionSeedValues, type LazyMember } from './multi-edit-lazy.ts';
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

// A stored session as the tool view saves it: inputs, token context and other meta.
const stored = () => ({
  __toolId: 'poster', __label: 'Card', __export_format: 'png', gap: 20, title: 'Hello',
  __tokenLinks: { gap: '{space.gap}' }, __tokenSelection: { appearance: 'night' },
});
// A runtime whose model and theme choices are given directly.
const liveRuntime = (model: Array<{ id: string; value: unknown; restoreTokenRef?: string }>, tokenSelection?: Record<string, string>): Runtime =>
  ({ getModel: () => model, tokenSelection }) as unknown as Runtime;

test('a session seed keeps its inputs and token context, and no other meta', () => {
  assert.deepEqual(sessionSeedValues(stored()), {
    gap: 20, title: 'Hello', __tokenLinks: { gap: '{space.gap}' }, __tokenSelection: { appearance: 'night' },
  });
});

test('a live runtime saves its theme choices and the previous link of each custom value', () => {
  const runtime = liveRuntime([
    { id: 'gap', value: 20, restoreTokenRef: '{space.gap}' },
    { id: 'pad', value: { ref: '{space.pad}', value: 8 }, restoreTokenRef: '{space.old}' },
    { id: 'title', value: 'Hello' },
  ], { appearance: 'night' });
  assert.deepEqual(runtimeSaveValues(runtime), {
    gap: 20, pad: { ref: '{space.pad}', value: 8 }, title: 'Hello',
    __tokenLinks: { gap: '{space.gap}' }, __tokenSelection: { appearance: 'night' },
  });
  assert.deepEqual(runtimeSaveValues(liveRuntime([{ id: 'title', value: 'Hello' }])), { title: 'Hello' }, 'no context, no keys');
});

test('the token context survives a load and save round trip, with the other meta', () => {
  const data = stored();
  const m: LazyMember = { runtime: null, values: sessionSeedValues(data), dirty: false };
  assert.deepEqual(sessionSaveData(data, memberSaveValues(m, runtimeSaveValues)), data);
});

test('a link restored before save drops the earlier Restore reference, built or not', async () => {
  const data = stored();
  const frozen: LazyMember = { runtime: null, values: sessionSeedValues(data), dirty: false };
  await applySharedEdit(frozen, 'gap', { ref: '{space.gap}', value: 36 });
  const fromSeed = sessionSaveData(data, memberSaveValues(frozen, runtimeSaveValues));
  assert.equal('__tokenLinks' in fromSeed, false);
  assert.deepEqual(fromSeed.gap, { ref: '{space.gap}', value: 36 });
  assert.deepEqual(fromSeed.__tokenSelection, { appearance: 'night' });
  assert.equal(fromSeed.__label, 'Card');

  const live: LazyMember = { runtime: liveRuntime([{ id: 'gap', value: { ref: '{space.gap}', value: 36 } }, { id: 'title', value: 'Hello' }]), values: {}, dirty: false };
  const fromRuntime = sessionSaveData(data, memberSaveValues(live, runtimeSaveValues));
  assert.equal('__tokenLinks' in fromRuntime, false);
  assert.equal('__tokenSelection' in fromRuntime, false, 'the runtime is authoritative for its theme choices too');
  assert.equal(fromRuntime.__export_format, 'png');
});
