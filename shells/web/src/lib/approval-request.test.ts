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
  approvalPdfPreview, approvalWork, registerApprovalOpener, openApprovalRequest, setApprovalPdfPreview, _clearApprovalOpenerForTests,
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

test('the view makes a file only when the opener asks for one, and a broken check asks for nothing', async () => {
  const { approvalWantsArtifact } = await import('./approval-request.ts');
  _clearApprovalOpenerForTests();
  assert.equal(approvalWantsArtifact('tool'), false, 'no opener');
  const off = registerApprovalOpener(() => {}, { wantsArtifact: (id) => id === 'bound' });
  assert.equal(approvalWantsArtifact('bound'), true);
  assert.equal(approvalWantsArtifact('other'), false);
  off();
  assert.equal(approvalWantsArtifact('bound'), false, 'gone with its opener');
  registerApprovalOpener(() => {}, { wantsArtifact: () => { throw new Error('no'); } });
  assert.equal(approvalWantsArtifact('bound'), false);
  registerApprovalOpener(() => {});
  assert.equal(approvalWantsArtifact('bound'), false, 'an opener that takes no file');
  _clearApprovalOpenerForTests();
});

test('working state is dormant until registered, and goes with its opener', () => {
  _clearApprovalOpenerForTests();
  assert.equal(approvalWork(), undefined);
  const work = { status: async () => null, approvedFile: async () => ({ blob: new Blob([]), name: '' }), open: () => {}, sessions: async () => new Map() };
  const off = registerApprovalOpener(() => {}, { work });
  assert.equal(approvalWork(), work);
  off();
  assert.equal(approvalWork(), undefined);
});

test('the PDF preview is null with no reader, and a failing reader is null too', async () => {
  _clearApprovalOpenerForTests();
  assert.equal(await approvalPdfPreview(new Blob([])), null);
  const page = new Blob(['<svg/>']);
  setApprovalPdfPreview(async () => page);
  assert.equal(await approvalPdfPreview(new Blob([])), page);
  setApprovalPdfPreview(async () => { throw new Error('bad pdf'); });
  assert.equal(await approvalPdfPreview(new Blob([])), null);
  _clearApprovalOpenerForTests();
});
