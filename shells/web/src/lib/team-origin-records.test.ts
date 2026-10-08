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

/** A stand-in for the browser's IndexedDB factory that answers a delete as told. */
function fakeIdb(answer: 'success' | 'error' | 'blocked' | 'throw'): { deleted: string[] } {
  const deleted: string[] = [];
  (globalThis as { indexedDB?: unknown }).indexedDB = {
    deleteDatabase(name: string) {
      if (answer === 'throw') throw new Error('SecurityError');
      deleted.push(name);
      const req: Record<string, (() => void) | null> = { onsuccess: null, onerror: null, onblocked: null };
      setTimeout(() => { req[`on${answer}`]?.(); }, 0);
      return req;
    },
  };
  return { deleted };
}

test('the names are the ones org/team-origin-durable.ts keeps its records under', () => {
  assert.equal(records.TEAM_ORIGINS_DB, 'lolly-team-origins');
  assert.equal(records.TEAM_ORIGINS_MARK, 'lolly:team-origins');
});

test('a drop deletes the database and the mark, and always settles', async () => {
  for (const answer of ['success', 'error', 'blocked', 'throw'] as const) {
    local.set(records.TEAM_ORIGINS_MARK, '1');
    const idb = fakeIdb(answer);
    await records.dropTeamOriginRecords();
    assert.equal(local.has(records.TEAM_ORIGINS_MARK), false, `${answer}: the mark is gone`);
    assert.deepEqual(idb.deleted, answer === 'throw' ? [] : ['lolly-team-origins'], answer);
  }
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
  local.set(records.TEAM_ORIGINS_MARK, '1');
  await records.dropTeamOriginRecords();
  assert.equal(local.has(records.TEAM_ORIGINS_MARK), false, 'no IndexedDB at all: the mark still goes');
});

test('Leave drops them, before the workspace itself is forgotten', () => {
  const src = readFileSync(resolve(import.meta.dirname, 'instance-leave.ts'), 'utf8');
  assert.match(src, /^import \{ dropTeamOriginRecords \} from '\.\/team-origin-records\.ts';$/m);
  const body = src.slice(src.indexOf('export async function leaveInstance('));
  const drop = body.indexOf('await dropTeamOriginRecords();');
  assert.ok(drop > 0, 'leaveInstance drops the records');
  assert.ok(drop < body.indexOf('await setInstanceBase(null);'), 'while the base is still the workspace being left');
});
