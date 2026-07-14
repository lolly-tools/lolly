// SPDX-License-Identifier: MPL-2.0
/**
 * Saved-session record versioning + migrate-or-warn branch (P0-5,
 * engine/src/session-record.ts).
 *
 * Every state bridge (web IndexedDB, Tauri filesystem) now stamps each record
 * with a formatVersion + engineVersion and reads it back through the shared
 * migrate-or-warn branch. This proves the stamp shape, that unversioned legacy
 * records still load (treated as v0), and that a record from a newer app build
 * is read non-destructively but reported.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sessionVersionStamp,
  migrateSessionRecord,
  SESSION_FORMAT_VERSION,
  SESSION_READER_VERSION,
} from '../engine/src/session-record.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';

test('sessionVersionStamp carries the current layout + engine versions', () => {
  const stamp = sessionVersionStamp();
  assert.equal(stamp.formatVersion, SESSION_FORMAT_VERSION);
  assert.equal(stamp.engineVersion, ENGINE_VERSION);
});

test('a current record loads its data unchanged', () => {
  const data = { title: 'hi', __toolId: 'poster' };
  const record = { slot: 'a', data, ...sessionVersionStamp() };
  assert.equal(migrateSessionRecord(record), data);
});

test('an unversioned legacy record still loads (treated as v0, no-op migration)', () => {
  const data = { title: 'legacy' };
  // No formatVersion / engineVersion — exactly what pre-P0-5 records look like.
  const record = { slot: 'old', toolId: 'poster', data };
  assert.equal(migrateSessionRecord(record), data);
});

test('a record from a newer app is read as-is AND reported (non-destructive)', () => {
  const data = { title: 'from the future' };
  const record = { slot: 'future', data, formatVersion: SESSION_READER_VERSION + 5, engineVersion: '9.9.9' };
  const logs: Array<{ level: string; message: string; meta?: unknown }> = [];
  const out = migrateSessionRecord(record, (level, message, meta) => logs.push({ level, message, meta }));
  assert.equal(out, data, 'data is preserved, never dropped');
  assert.equal(logs.length, 1);
  assert.equal(logs[0]!.level, 'warn');
  assert.match(logs[0]!.message, /newer version/);
});

test('empty / dataless / non-object records return null', () => {
  assert.equal(migrateSessionRecord(null), null);
  assert.equal(migrateSessionRecord(undefined), null);
  assert.equal(migrateSessionRecord({ slot: 'x' }), null);        // no data
  assert.equal(migrateSessionRecord({ slot: 'x', data: null }), null);
  assert.equal(migrateSessionRecord({ slot: 'x', data: 'oops' as unknown as object }), null);
});

test('a missing logger is tolerated on the future-record path', () => {
  const data = { title: 'x' };
  assert.doesNotThrow(() =>
    migrateSessionRecord({ slot: 's', data, formatVersion: 999 }),
  );
});
