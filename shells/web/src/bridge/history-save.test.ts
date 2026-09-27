// SPDX-License-Identifier: MPL-2.0
/**
 * Save never fails silently in the tools with history (plan 277 P1, the P4
 * review's B1 and B2). Driven through the real automatic-history controller, the
 * real state bridge and revision store, over the in-memory IndexedDB, wired the way
 * views/tool-revision-history.ts wires them (`store` is the state bridge's save).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/history-save.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IDBPDatabase } from 'idb';
import { memoryDb } from './idb-memory.test-utils.ts';

const { createStateAPI } = await import('./state.ts');
const { createRevisionStore } = await import('./revision-history.ts');
const { createAutomaticHistory } = await import('../views/automatic-history.ts');
const { MAX_REVISION_BYTES } = await import('./revision-limits.ts');
import type { SavedStateData, StateDb } from './state.ts';

function setup() {
  const { db: memory, stores } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  const state = createStateAPI(db as unknown as StateDb, createRevisionStore(db));
  return { stores, state, history: state.history! };
}
type Setup = ReturnType<typeof setup>;

/** Mount a controller on `slot` the way the tool view does after openToolSession. */
async function mount(env: Setup, slot: string, live: () => SavedStateData) {
  const opened = await env.history.open(slot);
  const failures: string[] = [];
  let active: string | null = slot;
  const controller = createAutomaticHistory({
    history: env.history, initial: { head: opened.head, version: opened.version, ...(opened.workingHash !== undefined ? { workingHash: opened.workingHash } : {}) },
    toolId: 'qr-code', getSlot: () => active, setSlot: next => { active = next; }, snapshot: live,
    load: s => env.state.load(s), capture: async () => null, saved() {},
    store: (s, data) => env.state.save(s, data), failure: message => { failures.push(message); },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  return { controller, failures };
}
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const qr = (url: string, logo?: Record<string, unknown>): SavedStateData => ({ __toolId: 'qr-code', __label: 'Launch QR', payload: 'url', url, ...(logo ? { logo } : {}) });
/** A temporary file whose bytes live only in this page: nothing can fetch it again. */
const temporaryLogo = { source: 'user', id: 'baked/1', type: 'raster', format: 'png', url: 'blob:http://localhost:5173/3f0c', meta: { baked: true } };
/** What URL mode stores for `?logo=<an http image URL>` (bridge/url-asset.ts). */
const remoteLogo = { source: 'remote', id: 'http://localhost:5173/og.png', type: 'raster', format: 'png', url: 'blob:http://localhost:5173/9a1e' };

test('B1: an old record history cannot adopt still saves: edit, Save, and the record holds the edit', async () => {
  const env = setup();
  await env.state.save('qr-code:old', qr('https://example.com/old', temporaryLogo));
  let live = qr('https://example.com/old', temporaryLogo);
  const { controller, failures } = await mount(env, 'qr-code:old', () => live);
  assert.match(controller.status(), /^History is paused for this creation\. History needs a saved asset for this temporary file\.$/);
  assert.equal(failures.length, 1);
  live = qr('https://example.com/edited', temporaryLogo);
  controller.changed(); await controller.flush();
  assert.equal((await env.state.load('qr-code:old'))?.url, 'https://example.com/old', 'no draft wrote over the saved record');
  assert.equal(await controller.save('qr-code:old', live), 'stored');
  assert.equal((await env.state.load('qr-code:old'))?.url, 'https://example.com/edited', 'Save wrote the record');
  // Leave without saving after that save keeps it: the direct save counts as saved.
  await controller.close();
  assert.equal((await env.history.discard('qr-code:old')).outcome, 'unchanged');
  assert.equal((await env.state.load('qr-code:old'))?.url, 'https://example.com/edited');
  controller.dispose();
});

test('B1: a full history budget does not block Save, and the save is kept by a later discard', async () => {
  const env = setup();
  let live = qr('https://example.com/v1');
  const { controller } = await mount(env, 'qr-code:full', () => live);
  assert.equal(await controller.save('qr-code:full', live), 'recorded');
  env.stores.get('revision-usage')!.set(JSON.stringify('total'), { key: 'total', value: { bytes: MAX_REVISION_BYTES, previews: 0 } });
  live = qr('https://example.com/v2');
  assert.equal(await controller.save('qr-code:full', live), 'stored', 'the budget refuses the revision, not the save');
  assert.equal((await env.state.load('qr-code:full'))?.url, 'https://example.com/v2');
  assert.match(controller.status(), /^History is paused for this creation\. History storage is full/);
  live = qr('https://example.com/v3-unsaved');
  controller.changed(); await controller.flush();
  assert.equal((await env.state.load('qr-code:full'))?.url, 'https://example.com/v2', 'paused history writes no draft over the save');
  await controller.close();
  await env.history.discard('qr-code:full');
  assert.equal((await env.state.load('qr-code:full'))?.url, 'https://example.com/v2', 'Leave without saving returns to the direct save, not to v1');
  controller.dispose();
});

test('B2: a logo filled from an http URL checkpoints, saves and reopens by its id', async () => {
  const env = setup();
  let live = qr('https://example.com/a', remoteLogo);
  const { controller, failures } = await mount(env, 'qr-code:remote', () => live);
  assert.equal(await controller.save('qr-code:remote', live), 'recorded', 'history takes the document');
  live = qr('https://example.com/b', remoteLogo);
  controller.changed(); await controller.flush(); await tick();
  assert.deepEqual(failures, []);
  const record = await env.state.load('qr-code:remote');
  assert.equal(record?.url, 'https://example.com/b');
  assert.deepEqual(record?.logo, { format: 'png', id: 'http://localhost:5173/og.png', source: 'remote', type: 'raster' },
    'the page-local blob: copy is gone; the id the runtime fetches again on open stays');
  const entries = (await env.history.list({ slot: 'qr-code:remote' })).entries;
  assert.ok(entries.length >= 2);
  for (const entry of entries) {
    const logo = (await env.history.read(entry.id))?.logo as { id?: string; url?: string } | undefined;
    assert.equal(logo?.id, 'http://localhost:5173/og.png'); assert.equal(logo?.url, undefined);
  }
  controller.dispose();
});

test('B2: a tool link keeps its id, a data: image stays whole, and a temporary file keeps its explicit refusal', async () => {
  const { canonicalRevisionData } = await import('./revision-snapshot.ts');
  const { pinRevisionAssets } = await import('./revision-asset-pins.ts');
  const toolLink = { source: 'remote', id: 'https://lolly.tools/tool/qr-code.svg?url=https%3A%2F%2Fexample.com', type: 'vector', format: 'svg', url: 'data:image/svg+xml;base64,PHN2Zy8+' };
  const inline = { source: 'remote', id: 'data:image/png;base64,AA==', type: 'raster', format: 'png', url: 'data:image/png;base64,AA==' };
  // Canonical form of data admitted before is unchanged, so old checkpoints keep their hash.
  assert.deepEqual(canonicalRevisionData({ logo: toolLink }).logo, toolLink);
  assert.deepEqual(canonicalRevisionData({ logo: { ...toolLink, url: 'blob:http://x/1' } }).logo, { format: 'svg', id: toolLink.id, source: 'remote', type: 'vector' });
  // A new capture keeps only the id of a link the runtime renders again on open.
  assert.deepEqual(pinRevisionAssets({ logo: toolLink }).logo, { format: 'svg', id: toolLink.id, source: 'remote', type: 'vector' });
  assert.deepEqual(pinRevisionAssets({ logo: inline }).logo, inline);
  assert.throws(() => canonicalRevisionData({ logo: temporaryLogo }), /History needs a saved asset for this temporary file\./);
  assert.throws(() => canonicalRevisionData({ logo: { source: 'remote', id: 'picked-file', url: 'blob:http://x/2' } }), /temporary file/);
});
