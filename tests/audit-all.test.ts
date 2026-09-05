// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  discoverAuthoritativeLocks,
  loadInventory,
  validateCoverage,
} from '../scripts/audit-all.ts';

test('every authoritative npm/Cargo lock has an audit owner', () => {
  const inventory = loadInventory();
  assert.doesNotThrow(() => validateCoverage(inventory));
  assert.deepEqual(discoverAuthoritativeLocks(), [
    'package-lock.json',
    'shells/tauri-desktop/package-lock.json',
    'shells/tauri-desktop/src-tauri/Cargo.lock',
    'shells/tauri-mobile/package-lock.json',
    'shells/tauri-mobile/src-tauri/Cargo.lock',
  ]);
});

