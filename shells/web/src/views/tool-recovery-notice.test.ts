// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import type { CollabHistoryCapability } from '../lib/collab-history.ts';
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

test('guidance stays outside the canvas, supports tools without a sidebar and is removed on teardown', () => {
  const dom = new JSDOM('<div id="view"><div class="tool-stage"><div id="tool-canvas"></div></div></div>');
  const previous = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    const root = document.querySelector<HTMLElement>('#view')!;
    const dispose = mountRecoveryNotice(root, { ...base, native: true });
    assert.equal(root.querySelectorAll('[data-recovery-notice]').length, 1);
    assert.equal(root.querySelector('#tool-canvas [data-recovery-notice]'), null);
    assert.ok(root.querySelector('[data-recovery-notice][data-export-hide]'));
    dispose();
    assert.equal(root.querySelector('[data-recovery-notice]'), null);
    root.insertAdjacentHTML('afterbegin', '<div class="sidebar-body"></div>');
    const release = mountRecoveryNotice(root, base);
    assert.ok(root.querySelector('.sidebar-body > [data-recovery-notice]'));
    release();
    mountRecoveryNotice(root, { ...base, automatic: true });
    assert.equal(root.querySelector('[data-recovery-notice]'), null);
  } finally { globalThis.document = previous; dom.window.close(); }
});
