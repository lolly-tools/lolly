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

test('automatic history in a tool with a file says the file is not kept, and lists the files a reopened creation needs', () => {
  const darkroom = { id: 'darkroom', inputs: [{ id: 'grade', type: 'number' }, { id: 'lutFile', type: 'file' }] };
  assert.match(recoveryNotice({ ...base, automatic: true, manifest: darkroom })!, /saved automatically, but imported files are not kept.*original files/);
  const opened = { grade: 2, lutFile: { notKept: true, name: 'warm & "dry".cube', mime: 'text/plain', size: 9 } };
  const reopened = recoveryNotice({ ...base, automatic: true, manifest: darkroom, opened })!;
  assert.match(reopened, /kept without its imported files: warm & "dry"\.cube\. Load them again/, 'a text sink: the name is not escaped');
  assert.match(recoveryNotice({ ...base, automatic: true, manifest: darkroom, opened: { lutFile: null } })!, /imported files are not kept/);
  assert.equal(recoveryNotice({ ...base, automatic: true, opened }), null, 'a tool with no file has nothing to warn about');
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
    const manual = mountRecoveryNotice(root, { ...base, manifest: { id: 'darkroom', inputs: [{ id: 'lutFile', type: 'file' }] } });
    dismissNotification(notificationEntries()[0]!.id); manual();
    mountRecoveryNotice(root, { ...base, automatic: true, manifest: { id: 'darkroom', inputs: [{ id: 'lutFile', type: 'file' }] } });
    assert.equal(notificationEntries()[0]?.dismissed, false, 'dismissing the manual notice does not hide the automatic one');
  } finally { _resetNotificationsForTests(); globalThis.document = previous; dom.window.close(); }
});
