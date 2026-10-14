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

test('Hide pointers is a per-device choice that hides remote cursors only, and survives unavailable storage', () => {
  const dom = new JSDOM('<div id="bar"></div>', { url: 'https://lolly.tools/' });
  const previous = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
  try {
    const hidden: boolean[] = [];
    const pointers = { setHidden(value: boolean) { hidden.push(value); } };
    const handle = { self: { clientId: 'person' } } as CollabSessionHandle;
    const bar = dom.window.document.getElementById('bar')!;
    const button = (): HTMLButtonElement | null => document.querySelector('[role="menuitemcheckbox"]');
    const openMenu = (): void => { bar.querySelector<HTMLButtonElement>('.collab-settings')!.click(); };

    const none = mountCollabControls(bar, handle);
    assert.equal(bar.querySelector('button'), null, 'no cursor layer, no control');
    none();

    let dispose = mountCollabControls(bar, handle, undefined, pointers);
    openMenu();
    assert.equal(button()!.getAttribute('aria-checked'), 'true');
    assert.deepEqual(hidden, [false], 'pointers start shown');
    button()!.click();
    assert.equal(document.querySelector('.collab-settings-menu'), null, 'selection dismisses the menu');
    openMenu(); assert.equal(button()!.getAttribute('aria-checked'), 'false');
    assert.deepEqual(hidden, [false, true]);
    assert.equal(dom.window.localStorage.getItem('lolly.collab.pointers'), 'hidden');
    dispose();
    assert.equal(button(), null, 'teardown removes the control');

    dispose = mountCollabControls(bar, handle, undefined, pointers);
    assert.deepEqual(hidden.at(-1), true, 'the next document on this device starts with pointers hidden');
    openMenu();
    button()!.click();
    assert.equal(dom.window.localStorage.getItem('lolly.collab.pointers'), null, 'showing them again forgets the choice');
    dispose();

    Object.defineProperty(dom.window, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    dispose = mountCollabControls(bar, handle, undefined, pointers);
    assert.equal(hidden.at(-1), false, 'blocked storage leaves pointers shown');
    openMenu();
    button()!.click();
    assert.equal(hidden.at(-1), true, 'and the toggle still works for this document');
    dispose();
  } finally { Object.assign(globalThis, previous); dom.window.close(); }
});

test('settings keeps live comments and unread feedback, supports keyboard dismissal and releases its menu', async () => {
  const dom = new JSDOM('<div id="bar"><button class="collab-comments-open--docked">Comments<span class="collab-comments-badge">2</span></button></div>', { url: 'https://lolly.tools/' });
  const previous = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
  try {
    const bar = document.getElementById('bar')!, comments = bar.querySelector('button')!;
    let opened = 0; comments.addEventListener('click', () => opened++);
    const dispose = mountCollabControls(bar, { people() {} } as CollabSessionHandle);
    const settings = bar.querySelector<HTMLButtonElement>('.collab-settings')!;
    assert.equal(comments.parentElement?.hidden, true);
    assert.match(settings.getAttribute('aria-label')!, /2 unread/);
    settings.click();
    assert.equal(comments.closest('[role="menu"]')?.getAttribute('aria-label'), 'Collaboration settings');
    comments.click();
    assert.equal(opened, 1); assert.equal(document.querySelector('.collab-settings-menu'), null);
    assert.equal(comments.parentElement?.hidden, true, 'the live control is retained between menu openings');
    comments.querySelector('.collab-comments-badge')!.remove(); await Promise.resolve();
    assert.equal(settings.getAttribute('aria-label'), 'Collaboration settings');
    settings.click();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(document.activeElement, settings);
    assert.equal(settings.getAttribute('aria-expanded'), 'false');
    settings.click(); dispose();
    assert.equal(document.querySelector('.collab-settings-menu'), null);
    assert.equal(comments.parentElement, bar);
  } finally { Object.assign(globalThis, previous); dom.window.close(); }
});
