// SPDX-License-Identifier: MPL-2.0
/**
 * export-policy.ts - the generic export-affordance seam.
 *
 * Pure, DOM-free: proves the dormant default (undefined ⇒ 'download', byte-identical
 * to today), the download/request/blocked decision truth table, the per-tool chain
 * lookup, and that clearing restores dormancy.
 *
 * Run directly:  node --test shells/web/src/lib/export-policy.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getExportPolicy, setExportPolicy, exportAffordance, _clearExportPolicyForTests,
} from './export-policy.ts';

test('dormant by default: no policy ⇒ getExportPolicy undefined, affordance is download', () => {
  _clearExportPolicyForTests();
  assert.equal(getExportPolicy(), undefined);
  assert.equal(exportAffordance(undefined), 'download');
  assert.equal(exportAffordance(getExportPolicy()), 'download');
});

test('exportAffordance truth table (canDownload × canRequestApproval)', () => {
  const mk = (canDownload: boolean, canRequestApproval: boolean) => {
    setExportPolicy({ canDownload, canRequestApproval });
    return exportAffordance(getExportPolicy());
  };
  // canDownload wins whenever true - byte-identical to today.
  assert.equal(mk(true, false), 'download');
  assert.equal(mk(true, true), 'download');
  // Withheld but requestable → the approval CTA.
  assert.equal(mk(false, true), 'request-approval');
  // Withheld with no request path → blocked (a note, not a dead button).
  assert.equal(mk(false, false), 'blocked');
});

test('approvalChainFor looks up the per-tool chain; unknown tools → undefined', () => {
  setExportPolicy({
    canDownload: false,
    canRequestApproval: true,
    chains: { 'event-badge': 'brand-signoff', 'poster': 'legal-review' },
  });
  const p = getExportPolicy()!;
  assert.equal(p.approvalChainFor('event-badge'), 'brand-signoff');
  assert.equal(p.approvalChainFor('poster'), 'legal-review');
  assert.equal(p.approvalChainFor('qr-code'), undefined, 'ungated tool has no chain');
});

test('a policy with no chains map: approvalChainFor is always undefined (no throw)', () => {
  setExportPolicy({ canDownload: false, canRequestApproval: true });
  assert.equal(getExportPolicy()!.approvalChainFor('anything'), undefined);
});

test('setExportPolicy(undefined) restores the dormant default', () => {
  setExportPolicy({ canDownload: false, canRequestApproval: true });
  assert.ok(getExportPolicy());
  setExportPolicy(undefined);
  assert.equal(getExportPolicy(), undefined);
  assert.equal(exportAffordance(getExportPolicy()), 'download');
});
