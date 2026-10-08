// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import type { CollabSaveState, CollabSessionHandle } from '../lib/collab-session.ts';
import { notificationEntries, _resetNotificationsForTests } from '../lib/notifications.ts';
import { mountCollabControls } from './tool-collab-controls.ts';

test('transfer failures use queue actions while ordinary save feedback stays in the room controls', async () => {
  const dom = new JSDOM('<div id="bar"></div>', { url: 'https://lolly.tools/' });
  const previous = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement,
    requestAnimationFrame: globalThis.requestAnimationFrame };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    requestAnimationFrame: (run: FrameRequestCallback) => { run(0); return 0; } });
  _resetNotificationsForTests();
  try {
    let update!: (state: CollabSaveState) => void; let retries = 0;
    const handle = { self: { clientId: 'person' }, saveIn: { subscribe(fn: typeof update) {
      update = fn; fn({ pending: 0, message: 'Saved to work' }); return () => {};
    } } } as unknown as CollabSessionHandle;
    const bar = document.getElementById('bar')!; const dispose = mountCollabControls(bar, handle);
    assert.match(bar.textContent!, /Saved to work/);
    update({ pending: 0, message: 'Image transfer failed. Your upload is still on this device.', retry: () => { retries++; } });
    assert.equal(bar.querySelector('.collab-save-status')?.textContent, '');
    const queued = notificationEntries()[0]!; assert.equal(queued.action?.label, 'Retry image transfer');
    await queued.action?.run?.(); assert.equal(retries, 1);
    update({ pending: 0, message: 'Saved to work' }); assert.equal(notificationEntries().length, 0);
    update({ pending: 0, message: 'Another transfer failed', retry: () => {} });
    assert.notEqual(notificationEntries()[0]?.id, queued.id, 'a new failure is not hidden by an earlier dismissal');
    dispose(); assert.equal(notificationEntries().length, 0);
  } finally { _resetNotificationsForTests(); Object.assign(globalThis, previous); dom.window.close(); }
});
