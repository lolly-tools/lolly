// SPDX-License-Identifier: MPL-2.0
/**
 * lib/team-origin-records.ts: the device's record of where team-document copies came
 * from goes in one call, database and mark, without loading the control plane, and
 * Leave (lib/instance-leave.ts) makes that call (plan 75 G17).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/team-origin-records.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (local.has(k) ? local.get(k)! : null),
  setItem: (k: string, v: string) => { local.set(k, String(v)); },
  removeItem: (k: string) => { local.delete(k); },
  clear: () => local.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

const records = await import('./team-origin-records.ts');

/** A browser-style asynchronous read followed by a delete, with failure controls. */
function fakeIdb(answer: 'success' | 'error' | 'blocked' | 'throw', rows: unknown = [{ slot: 'design:team', account: 'private-account', sessionId: 'private-session' }], readFails = false): { deleted: string[]; finishDelete(): void } {
  const deleted: string[] = [];
  let deletion: Record<string, (() => void) | null> | undefined;
  (globalThis as { indexedDB?: unknown }).indexedDB = {
    open(name: string) {
      assert.equal(name, records.TEAM_ORIGINS_DB);
      const req: Record<string, unknown> = { onsuccess: null, onerror: null, error: new Error('Read failed') };
      req.result = {
        close() {},
        objectStoreNames: { contains: () => true },
        transaction(store: string, mode: string) {
          assert.equal(store, 'origins');
          assert.equal(mode, 'readonly');
          return { objectStore: () => ({ getAll() {
            const result: Record<string, unknown> = { result: rows, error: new Error('Read failed'), onsuccess: null, onerror: null };
            setTimeout(() => { (result[readFails ? 'onerror' : 'onsuccess'] as (() => void))?.(); }, 0);
            return result;
          } }) };
        },
      };
      setTimeout(() => { (req.onsuccess as (() => void))?.(); }, 0);
      return req;
    },
    deleteDatabase(name: string) {
      if (answer === 'throw') throw new Error('SecurityError');
      assert.ok(local.get(records.TEAM_COPY_SLOTS_KEY)?.includes('design:team'), 'copy names are kept before deleting their origins');
      deleted.push(name);
      const req: Record<string, (() => void) | null> = { onsuccess: null, onerror: null, onblocked: null };
      deletion = req;
      setTimeout(() => { req[`on${answer}`]?.(); }, 0);
      return req;
    },
  };
  return { deleted, finishDelete() { deletion?.onsuccess?.(); } };
}

test('the names are the ones org/team-origin-durable.ts keeps its records under', () => {
  assert.equal(records.TEAM_ORIGINS_DB, 'lolly-team-origins');
  assert.equal(records.TEAM_ORIGINS_MARK, 'lolly:team-origins');
});

test('a drop keeps copy names first, clears the mark only on success, and always settles', async () => {
  for (const answer of ['success', 'error', 'blocked', 'throw'] as const) {
    local.clear();
    local.set(records.TEAM_ORIGINS_MARK, '1');
    const idb = fakeIdb(answer);
    await records.dropTeamOriginRecords();
    assert.equal(local.has(records.TEAM_ORIGINS_MARK), answer !== 'success', `${answer}: only a completed delete clears the mark`);
    assert.deepEqual(idb.deleted, answer === 'throw' ? [] : ['lolly-team-origins'], answer);
    assert.equal(local.get(records.TEAM_COPY_SLOTS_KEY), '["design:team"]', 'no account, session or workspace is kept');
    if (answer === 'blocked') {
      idb.finishDelete();
      assert.equal(local.has(records.TEAM_ORIGINS_MARK), false, 'a queued delete clears the mark once it finishes');
    }
  }
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
  local.set(records.TEAM_ORIGINS_MARK, '1');
  await records.dropTeamOriginRecords();
  assert.equal(local.has(records.TEAM_ORIGINS_MARK), true, 'an unavailable database retains its evidence');
});

test('Leave and the org fallback cannot delete records after an unreadable listing', async () => {
  for (const rows of [null, [{ slot: '' }], [{ slot: 7 }], [{ slot: 'design:team' }, null]]) {
    local.clear();
    local.set(records.TEAM_ORIGINS_MARK, '1');
    const idb = fakeIdb('success', rows);
    await records.dropTeamOriginRecords();
    assert.deepEqual(idb.deleted, []);
    assert.equal(local.get(records.TEAM_ORIGINS_MARK), '1');
    assert.equal(local.has(records.TEAM_COPY_SLOTS_KEY), false);
  }
  const idb = fakeIdb('success', [], true);
  await records.dropTeamOriginRecords();
  assert.deepEqual(idb.deleted, [], 'an IndexedDB read failure cannot start a delete');
});

test('a malformed or unwriteable copy list preserves the original database and mark', async () => {
  local.clear();
  local.set(records.TEAM_ORIGINS_MARK, '1');
  local.set(records.TEAM_COPY_SLOTS_KEY, '["design:old",7]');
  const idb = fakeIdb('success');
  await records.dropTeamOriginRecords();
  assert.deepEqual(idb.deleted, []);
  assert.equal(local.get(records.TEAM_COPY_SLOTS_KEY), '["design:old",7]');
  local.delete(records.TEAM_COPY_SLOTS_KEY);
  const set = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  try {
    await records.dropTeamOriginRecords();
    assert.deepEqual(idb.deleted, [], 'no deletion after a failed custody write');
    assert.equal(local.get(records.TEAM_ORIGINS_MARK), '1');
  } finally { localStorage.setItem = set; }
});

test('Leave drops them, before the workspace itself is forgotten', () => {
  const src = readFileSync(resolve(import.meta.dirname, 'instance-leave.ts'), 'utf8');
  assert.match(src, /^import \{ dropTeamOriginRecords \} from '\.\/team-origin-records\.ts';$/m);
  const body = src.slice(src.indexOf('export async function leaveInstance('));
  const drop = body.indexOf('await dropTeamOriginRecords();');
  assert.ok(drop > 0, 'leaveInstance drops the records');
  assert.ok(drop < body.indexOf('await setInstanceBase(null);'), 'while the base is still the workspace being left');
});
