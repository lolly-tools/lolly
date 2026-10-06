// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import type { CollabHistoryCapability } from '../lib/collab-history.ts';
import { notificationEntries, dismissNotification, _resetNotificationsForTests } from '../lib/notifications.ts';
import { recoveryNotice, mountRecoveryNotice } from './tool-recovery-notice.ts';

const manifest = { id: 'design', inputs: [{ id: 'title', type: 'text' }] };
const base = { manifest, automatic: false, canSave: true };

test('recovery guidance distinguishes native saves, imported files, utilities and recordings', () => {
  assert.equal(recoveryNotice({ ...base, automatic: true }), null);
  assert.equal(recoveryNotice({ ...base, manifest: { id: 'countdown', inputs: [] } }), null);
  assert.match(recoveryNotice({ ...base, native: true })!, /not saved automatically in this app.*Save before leaving/);
  assert.match(recoveryNotice({ ...base, manifest: { ...manifest, inputs: [{ id: 'model', type: 'file' }] } })!, /Save before leaving.*original imported files/);
  assert.match(recoveryNotice({ ...base, canSave: false, manifest: { ...manifest, inputs: [{ id: 'file', type: 'file' }], render: { actions: [] } } })!, /Download your result.*original files/);
  assert.match(recoveryNotice({ ...base, manifest: { ...manifest, capabilities: ['microphone'] } })!, /no automatic recovery.*Save or download your result/);
});

test('shared history is described by its durability, without promising local recovery', () => {
  assert.match(recoveryNotice({ ...base, shared: true })!, /no local automatic recovery/);
  assert.match(recoveryNotice({ ...base, shared: true, collab: { durability: 'session' } as CollabHistoryCapability })!, /history is temporary/);
  assert.match(recoveryNotice({ ...base, shared: true, collab: { durability: 'durable' } as CollabHistoryCapability })!, /kept by your organisation/);
});

test('recovery guidance is queued, supports Save a copy and cleans up on teardown', async () => {
  _resetNotificationsForTests();
  const dom = new JSDOM('<div id="view"><div id="tool-canvas"></div></div>');
  const previous = globalThis.document; globalThis.document = dom.window.document;
  try {
    const root = document.querySelector<HTMLElement>('#view')!; let saved = 0;
    const dispose = mountRecoveryNotice(root, { ...base, native: true, onSave: () => { saved++; } });
    assert.equal(root.querySelector('[data-recovery-notice]'), null);
    const notice = notificationEntries()[0]!; assert.equal(notice.title, 'Saving and recovery');
    assert.equal(notice.action?.label, 'Save a copy'); await notice.action?.run?.(); assert.equal(saved, 1);
    dismissNotification(notice.id); assert.equal(notificationEntries()[0]?.dismissed, true);
    root.remove(); await notice.action?.run?.(); assert.equal(saved, 1, 'no save from a stale editor');
    dispose(); assert.equal(notificationEntries().length, 0);
    mountRecoveryNotice(root, { ...base, automatic: true }); assert.equal(notificationEntries().length, 0);
  } finally { _resetNotificationsForTests(); globalThis.document = previous; dom.window.close(); }
});
