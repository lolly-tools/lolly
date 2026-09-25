// SPDX-License-Identifier: MPL-2.0
/**
 * lib/ask/embed-offer.ts: when the Ask "Better matching" chip offers the model.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/ask/embed-offer.test.ts
 *
 * The part facts come from lib/model-parts.ts with its dependencies stubbed, so
 * no precache.json, HEAD request or cache read is made.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { embedModelOffer } = await import('./embed-offer.ts');
const { __setModelPartsDepsForTest } = await import('../model-parts.ts');

afterEach(() => {
  __setModelPartsDepsForTest();
  delete (globalThis as { __LOLLY_AI_DISABLED__?: boolean }).__LOLLY_AI_DISABLED__;
});

test('no precache.json (a dev server, tauri dev): the chip still offers, with the listed embed files', async () => {
  __setModelPartsDepsForTest({ precache: async () => null, probe: async () => true, ready: async () => false, records: async () => ({}) });
  const offer = await embedModelOffer();
  assert.ok(offer, 'offered');
  const { manifest } = offer;
  assert.ok(offer.bytes && offer.bytes > 0, 'with the size Profile states');
  assert.ok((manifest.groups.embed ?? []).length > 0, 'the embed group is filled from the listing');
  assert.ok(manifest.groups.embed!.every((f) => f.url.startsWith('/models/embed/')));
});

test('already on this device: no offer', async () => {
  __setModelPartsDepsForTest({ precache: async () => null, probe: async () => true, ready: async () => true, records: async () => ({}) });
  assert.equal(await embedModelOffer(), null);
});

test('the model host does not serve it: no offer', async () => {
  __setModelPartsDepsForTest({ precache: async () => null, probe: async () => false, ready: async () => false, records: async () => ({}) });
  assert.equal(await embedModelOffer(), null);
});

test('the AI policy forbids it: no offer, and nothing is probed', async () => {
  (globalThis as { __LOLLY_AI_DISABLED__?: boolean }).__LOLLY_AI_DISABLED__ = true;
  const probed: string[] = [];
  __setModelPartsDepsForTest({ precache: async () => null, probe: async (u) => { probed.push(u); return true; }, ready: async () => false, records: async () => ({}) });
  assert.equal(await embedModelOffer(), null);
  assert.deepEqual(probed, []);
});

test('the Ask view gates its chip on this answer, not on a precache group', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../views/ask.ts', import.meta.url), 'utf8');
  assert.match(src, /embedModelOffer\(\)/);
  assert.doesNotMatch(src, /groups\.embed/);
});
