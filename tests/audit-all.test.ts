// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCounts,
  discoverAuthoritativeLocks,
  loadInventory,
  validateCoverage,
} from '../scripts/audit-all.ts';

test('every authoritative npm/Cargo lock has an audit owner', () => {
  const inventory = loadInventory();
  assert.doesNotThrow(() => validateCoverage(inventory));
  assert.deepEqual(discoverAuthoritativeLocks(), [
    'pnpm-lock.yaml',
    'shells/tauri-desktop/pnpm-lock.yaml',
    'shells/tauri-desktop/src-tauri/Cargo.lock',
    'shells/tauri-mobile/pnpm-lock.yaml',
    'shells/tauri-mobile/src-tauri/Cargo.lock',
  ]);
});

test('pnpm advisories count every severity while enforcing high/critical separately', () => {
  assert.deepEqual(auditCounts({ advisories: {} }), { total: 0, high: 0, critical: 0 });
  assert.deepEqual(auditCounts({ advisories: {
    one: { severity: 'moderate' }, two: { severity: 'high' }, three: { severity: 'critical' },
  } }), { total: 3, high: 1, critical: 1 });
});

test('audit errors and malformed advisory responses cannot look clean', () => {
  for (const report of [null, {}, { error: 'offline' }, { advisories: [] }, { advisories: { one: {} } }]) {
    assert.throws(() => auditCounts(report), /invalid advisory/);
  }
});
