// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeResultLinks } from '../scripts/native-result-links-probe.ts';

test('optional private downloads qualify actual HTTP, distinct owners, real expiry and physical quotas', async () => {
  const receipt = await probeResultLinks();
  assert.equal(receipt.actualHttpQualified, true);
  assert.equal(receipt.defaultLifetimeSeconds, 300);
  assert.equal(receipt.rangeAndConditionalSupport, false);
  assert.ok(Number(receipt.realExpiryElapsedMs) >= 50 && Number(receipt.realExpiryElapsedMs) < 10_000);
});
