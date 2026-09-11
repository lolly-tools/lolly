// SPDX-License-Identifier: MPL-2.0
/**
 * bridge/state.ts - the createdAt contract: stamped on first save, PRESERVED
 * across re-saves (updatedAt moves, createdAt doesn't), surfaced by list(),
 * and absent (not fabricated) for legacy rows written before the field existed.
 * Projects' "Date added" sort depends on exactly this behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createStateAPI } from './state.ts';
import type { StateDb } from './state.ts';

function memDb(): StateDb & { rows: Map<string, Record<string, unknown>> } {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    rows,
    async put(_store, record) { rows.set(record.slot, record as unknown as Record<string, unknown>); },
    async get(_store, slot) { return rows.get(slot) as never; },
    async getAll() { return [...rows.values()] as never; },
    async delete(_store, slot) { rows.delete(slot); },
  };
}

test('first save stamps createdAt === updatedAt; a re-save moves only updatedAt', async () => {
  const db = memDb();
  const api = createStateAPI(db);
  await api.save('qr-code:100', { __toolId: 'qr-code' });
  const first = db.rows.get('qr-code:100')!;
  assert.equal(first.createdAt, first.updatedAt, 'a fresh record is created when it is saved');

  await new Promise(r => setTimeout(r, 5));   // let the clock move
  await api.save('qr-code:100', { __toolId: 'qr-code', text: 'edited' });
  const second = db.rows.get('qr-code:100')!;
  assert.equal(second.createdAt, first.createdAt, 'creation time survives the re-save');
  assert.notEqual(second.updatedAt, first.updatedAt, 'last-modified moved');
});

test('list() surfaces createdAt when present and omits it for legacy rows', async () => {
  const db = memDb();
  // A legacy row written before the field existed - list() must not invent one.
  db.rows.set('old:1', { slot: 'old:1', toolId: 'qr-code', toolVersion: '1', data: {}, thumb: null, updatedAt: '2026-01-01T00:00:00.000Z' });
  const api = createStateAPI(db);
  await api.save('new:2', { __toolId: 'qr-code' });

  const rows = await api.list();
  const legacy = rows.find(r => r.slot === 'old:1')!;
  const fresh = rows.find(r => r.slot === 'new:2')!;
  assert.ok(!('createdAt' in legacy), 'legacy rows carry no fabricated createdAt');
  assert.ok(typeof fresh.createdAt === 'string' && fresh.createdAt.length > 0);
});
