// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { compareSkips } from '../scripts/check-skip-identities.ts';

const base = { file: 'tests/a.test.ts', fullName: 'suite > case', reason: 'no browser', capability: 'browser', owner: 'tests' };

test('skip identity comparison rejects replacement skips even when counts match', () => {
  const replacement = { ...base, fullName: 'suite > different case' };
  assert.deepEqual(compareSkips([base], [replacement]), { unexpected: [replacement], stale: [base] });
});

test('skip identity comparison includes reason and ownership metadata', () => {
  const changed = { ...base, reason: 'fixture absent', capability: 'fixture' };
  assert.equal(compareSkips([base], [changed]).unexpected.length, 1);
});
