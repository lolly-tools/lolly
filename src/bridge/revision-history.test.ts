// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisionSnapshot, expiredAutomatic, type RevisionEntry } from './revision-history.ts';
import { createMemoryStateAPI } from '../lib/ephemeral-state.ts';

test('canonical snapshots deduplicate key order and resolved asset URLs, preserving authored row identity and order', async () => {
  const first = await revisionSnapshot({ blocks: [{ id: 'a', text: 'hello' }, { id: 'b' }], image: { source: 'library', id: 'photo', version: 1, url: 'blob:one' } });
  const second = await revisionSnapshot({ image: { url: 'blob:two', version: 1, id: 'photo', source: 'library' }, blocks: [{ text: 'hello', id: 'a' }, { id: 'b' }] });
  assert.equal(first.hash, second.hash);
  assert.notEqual(first.hash, (await revisionSnapshot({ ...first.data, blocks: [{ id: 'b' }, { id: 'a', text: 'hello' }] })).hash);
  second.data.blocks = [];
  assert.equal((first.data.blocks as unknown[]).length, 2);
});

test('transient files, cycles, and non-finite numbers fail rather than creating a misleading checkpoint', async () => {
  for (const value of [new Uint8Array([1, 2]), new Blob(['bytes']), 'blob:temporary', NaN, () => {}]) {
    await assert.rejects(revisionSnapshot({ value }));
  }
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  await assert.rejects(revisionSnapshot(cyclic));
});

test('frozen embedded assets keep their exact data URL, while stale baked blob URLs are refused', async () => {
  const asset = { source: 'user', id: 'baked/one', url: 'data:image/png;base64,AA==', meta: { baked: true } };
  assert.equal(((await revisionSnapshot({ asset })).data.asset as typeof asset).url, asset.url);
  await assert.rejects(revisionSnapshot({ asset: { ...asset, url: 'blob:gone' } }));
});

test('retention preserves recent minute detail, samples older hours/days/weeks, and protects every explicit save', () => {
  const now = Date.parse('2026-09-07T12:00:00Z');
  const entries = Array.from({ length: 7 * 24 * 60 }, (_, i) => ({ id: String(i), reason: i % 500 === 0 ? 'save' : 'automatic', at: new Date(now - i * 60_000).toISOString() } as RevisionEntry));
  const expired = new Set(expiredAutomatic(entries, now).map(row => row.id));
  assert.ok(!entries.some(entry => entry.reason === 'save' && expired.has(entry.id)));
  assert.ok(entries.slice(0, 60).every(entry => !expired.has(entry.id)));
  assert.ok(entries.filter(entry => entry.reason === 'automatic' && !expired.has(entry.id)).length < 100);
});

test('P2P guest state has no durable history capability', async () => {
  const state = createMemoryStateAPI();
  assert.equal(state.history, undefined);
  await state.save('guest', { __toolId: 'design', text: 'private' });
  assert.equal((await state.load('guest'))?.text, 'private');
});
