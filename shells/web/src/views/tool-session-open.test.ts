// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-session-open.ts over the real state bridge and revision store on the
 * in-memory IndexedDB: which source wins when Design opens on a saved slot.
 *
 * The address keeps `slot` as workspace state, so reloading a saved document hands
 * the slot back in the URL. A reload is still a resume of the saved record; only a
 * link this browser entry did not write keeps its URL overrides.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-session-open.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { IDBPDatabase } from 'idb';
import { memoryDb } from '../bridge/idb-memory.test-utils.ts';
import type { StateDb } from '../bridge/state.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/design' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location, history: dom.window.history });

const { createStateAPI } = await import('../bridge/state.ts');
const { createRevisionStore } = await import('../bridge/revision-history.ts');
const { openToolSession } = await import('./tool-session-open.ts');
const { historyParticipation } = await import('./tool-history-adapters.ts');
const { parseUrlState } = await import('../../../../engine/src/url-mode.ts');
const manifest = JSON.parse(readFileSync(new URL('../../../../community/design/tool.json', import.meta.url), 'utf8'));

const slot = 'design:saved';
/** The saved rows, exactly as the editor held them. */
const saved = [{ id: 'guide', kind: 'box', name: 'Circle guide', shape: 'ellipse', x: 510, y: 350, w: 420, h: 420, rot: 0 }];

async function open(entry: unknown) {
  const { db: memory } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  const state = createStateAPI(db as unknown as StateDb, createRevisionStore(db));
  await state.save(slot, { __toolId: 'design', boxes: saved });
  window.history.replaceState(entry, '', '/design');
  // The address bar form: every field written out, and an edit the record does not hold.
  const address = new URLSearchParams({ boxes: JSON.stringify([{ ...saved[0], x: '999', y: '350' }]), format: 'png', slot });
  return openToolSession(state, manifest, parseUrlState(address.toString(), manifest));
}

test('Design keeps local history, so these cases test the resume path', () => {
  assert.equal(historyParticipation(manifest, false).localHistory, true);
});

test('reloading the entry that remembers this slot resumes the saved record', async () => {
  const opened = await open({ lollyHistory: { toolId: 'design', slot } });
  assert.deepEqual(opened.values.boxes, saved, 'the saved rows, not the address copy');
  assert.equal(opened.url.format, null, 'the saved document keeps its own export settings');
});

test('a slot link opened in a new entry keeps its URL overrides', async () => {
  const opened = await open(null);
  assert.equal((opened.values.boxes as Array<Record<string, unknown>>)[0]!.x, '999');
  assert.equal(opened.url.format, 'png');
});

test('an entry that remembers another slot treats the link as an override', async () => {
  const opened = await open({ lollyHistory: { toolId: 'design', slot: 'design:other' } });
  assert.equal((opened.values.boxes as Array<Record<string, unknown>>)[0]!.x, '999');
});
