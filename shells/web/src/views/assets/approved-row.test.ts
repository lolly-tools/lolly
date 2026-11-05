// SPDX-License-Identifier: MPL-2.0
/**
 * views/assets/approved-row.ts - a kept approved file's way back to its request.
 *
 * Run directly:  node --test shells/web/src/views/assets/approved-row.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;

const { approvedRow, openApprovedRequest } = await import('./approved-row.ts');
const { registerApprovalOpener, _clearApprovalOpenerForTests } = await import('../../lib/approval-request.ts');

const link = (instance: string) => ({ meta: { approval: { id: 'apr_1', instance, sha256: 'a', decidedAt: '2026-11-02T00:00:00Z' } } });
const opened: string[] = [];
const register = (): void => {
  registerApprovalOpener(() => {}, { work: { status: async () => null, files: async () => [], approvedFile: async () => ({ blob: new Blob([]), name: '' }), open: (id) => { opened.push(id); }, sessions: async () => new Map() } });
};

test('an ordinary asset has no row', () => {
  _clearApprovalOpenerForTests();
  assert.equal(approvedRow({ meta: {} }), '');
  assert.equal(approvedRow({}), '');
});

test('this instance offers the way back', () => {
  register();
  const row = approvedRow(link('https://instance.test'));
  assert.match(row, /data-meta="approval"/);
  assert.match(row, /Approved /);
  assert.match(row, /data-act="open-approval"/);
  opened.length = 0;
  openApprovedRequest(link('https://instance.test'));
  assert.deepEqual(opened, ['apr_1']);
});

test('another workspace keeps the fact and offers nothing to open', () => {
  register();
  const row = approvedRow(link('https://other.test'));
  assert.match(row, /Approved /);
  assert.doesNotMatch(row, /open-approval/);
  opened.length = 0;
  openApprovedRequest(link('https://other.test'));
  assert.deepEqual(opened, []);
  _clearApprovalOpenerForTests();
});
