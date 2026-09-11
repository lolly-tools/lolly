// SPDX-License-Identifier: MPL-2.0
/**
 * approval-request.ts - the generic approval-opener seam.
 *
 * Pure, DOM-free: proves the dormant default (no opener ⇒ openApprovalRequest is a
 * no-op returning false), that a registered opener receives the context, last-wins
 * replacement, unregister, and tolerance of a throwing opener.
 *
 * Run directly:  node --test shells/web/src/lib/approval-request.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerApprovalOpener, openApprovalRequest, _clearApprovalOpenerForTests,
} from './approval-request.ts';
import type { ApprovalRequestContext } from './approval-request.ts';

test('dormant by default: no opener ⇒ no-op returning false', () => {
  _clearApprovalOpenerForTests();
  assert.equal(openApprovalRequest({ toolId: 'qr-code' }), false);
});

test('a registered opener receives the context and openApprovalRequest returns true', () => {
  _clearApprovalOpenerForTests();
  const seen: ApprovalRequestContext[] = [];
  registerApprovalOpener((ctx) => { seen.push(ctx); });
  assert.equal(openApprovalRequest({ toolId: 'event-badge', title: 'Badge' }), true);
  assert.deepEqual(seen, [{ toolId: 'event-badge', title: 'Badge' }]);
});

test('last register wins; unregister restores dormancy', () => {
  _clearApprovalOpenerForTests();
  let a = 0, b = 0;
  registerApprovalOpener(() => { a++; });
  const off = registerApprovalOpener(() => { b++; });
  openApprovalRequest({ toolId: 't' });
  assert.equal(a, 0);
  assert.equal(b, 1, 'later registration replaces the earlier');
  off();
  assert.equal(openApprovalRequest({ toolId: 't' }), false, 'unregister returns to dormant');
});

test('a throwing opener is swallowed (never breaks the caller)', () => {
  _clearApprovalOpenerForTests();
  registerApprovalOpener(() => { throw new Error('boom'); });
  assert.equal(openApprovalRequest({ toolId: 't' }), false);
});
