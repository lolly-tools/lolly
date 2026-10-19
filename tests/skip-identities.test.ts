// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { compareSkips } from '../scripts/check-skip-identities.ts';
import { capabilityFor } from './reporters/skip-identities.ts';

const base = { file: 'tests/a.test.ts', fullName: 'suite > case', reason: 'no browser', capability: 'browser', owner: 'tests' };

test('skip identity comparison rejects replacement skips even when counts match', () => {
  const replacement = { ...base, fullName: 'suite > different case' };
  assert.deepEqual(compareSkips([base], [replacement]), { unexpected: [replacement], stale: [base] });
});

test('skip identity comparison includes reason and ownership metadata', () => {
  const changed = { ...base, reason: 'fixture absent', capability: 'fixture' };
  assert.equal(compareSkips([base], [changed]).unexpected.length, 1);
});

test('skip reasons classify by what is missing', () => {
  assert.equal(capabilityFor('Playwright webkit browser is not installed'), 'browser');
  assert.equal(capabilityFor('set LOLLY_PRESENT_TEST_URL to a local Vite shell'), 'environment');
  // "not set" with nothing after it names no capability, which the CI check refuses.
  assert.equal(capabilityFor('LOLLY_PRESENT_TEST_URL not set'), 'unspecified');
  assert.equal(capabilityFor(''), 'unspecified');
  assert.equal(
    capabilityFor('live Dropbox run: no live mode: OAuth access tokens cannot be minted without a person signing in'),
    'credentials',
  );
  assert.equal(capabilityFor('the store keeps no write precondition'), 'service-limit');
  assert.equal(
    capabilityFor('the store adapter has no remove call (optional; per-record sync then keeps the objects)'),
    'service-limit',
  );
  assert.equal(
    capabilityFor('live S3 run is off: set LOLLY_SYNC_LIVE_S3_ENDPOINT, LOLLY_SYNC_LIVE_S3_SECRET to run it'),
    'environment',
  );
  assert.equal(capabilityFor('the lolly-work collab fixture is missing; set LOLLY_WORK_DIR to a lolly-work checkout'), 'fixture');
});
