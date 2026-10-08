// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import { openNotifications } from './notification-center.ts';
import { publishNotification, notificationCount, _resetNotificationsForTests } from '../lib/notifications.ts';

const dom = new JSDOM('<button id="profile">Profile</button>', { url: 'https://lolly.tools/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, location: dom.window.location });
dom.window.matchMedia = () => ({ matches: false } as MediaQueryList);
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const queue = () => document.querySelector<HTMLDialogElement>('.notification-center')!;
const click = (text: string) => { const node = [...queue().querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === text)!; assert.ok(node, text); node.click(); };
beforeEach(() => { queue()?.dispatchEvent(new dom.window.Event('cancel', { cancelable: true })); _resetNotificationsForTests(); });

test('messages use literal text, unsafe links are omitted and closing restores profile focus', () => {
  const profile = document.getElementById('profile')!;
  publishNotification({ id: 'safe', title: '<img src=x onerror=alert(1)>', body: 'Long notice', action: { label: 'Run', href: 'javascript:alert(1)' } });
  openNotifications(profile); assert.equal(queue().getAttribute('aria-label'), 'Notifications');
  assert.equal(queue().querySelector('img'), null); assert.equal(queue().querySelector('a'), null);
  assert.match(queue().textContent!, /<img/); queue().dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  assert.equal(document.activeElement, profile); assert.equal(queue(), null);
});
test('dismissed and delayed messages remain accessible through their filters and can be restored', () => {
  publishNotification({ id: 'reminder', title: 'Review design systems', reminder: true }); openNotifications();
  click('Remind me in 1 hour'); assert.equal(notificationCount(), 0); click('Later'); assert.match(queue().textContent!, /Review design systems/);
  click('Show again'); click('Active'); assert.equal(notificationCount(), 1);
  click('Dismiss'); click('Dismissed'); assert.match(queue().textContent!, /Review design systems/);
  click('Show again'); assert.equal(notificationCount(), 1);
});
test('required notices have actions without dismiss or delay controls', () => {
  publishNotification({ id: 'required', title: 'Required', reminder: true, dismissible: false, action: { label: 'Review', href: '#/profile' } });
  openNotifications(); const card = queue().querySelector('article')!;
  assert.equal(card.querySelector('a')?.getAttribute('href'), '#/profile'); assert.equal(card.querySelector('button'), null);
});
test('callback actions close the queue before opening the next dialog', async () => {
  let sawClosed = false; publishNotification({ id: 'save', title: 'Saving', action: { label: 'Save a copy', run: () => { sawClosed = !queue(); } } });
  openNotifications(); click('Save a copy'); await Promise.resolve(); await Promise.resolve(); assert.equal(sawClosed, true);
});
test('failed callback actions stay recoverable in the queue', async () => {
  publishNotification({ id: 'retry', title: 'Saving', action: { label: 'Try save', run: async () => { throw new Error('Unavailable'); } } });
  openNotifications(); click('Try save'); await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(queue().textContent!, /Could not complete this action/); assert.ok(queue().querySelector('button'));
});
test('a second action sits beside the first and runs without closing the queue', async () => {
  let opened = 0, downloaded = 0;
  publishNotification({ id: 'copy', title: 'Copy saved', action: { label: 'Open copy', run: () => { opened++; } }, secondary: { label: 'Download copy', run: () => { downloaded++; } } });
  openNotifications(); const card = queue().querySelector('article')!;
  assert.deepEqual([...card.querySelectorAll('button')].map(node => [node.textContent, node.classList.contains('btn--primary')]),
    [['Open copy', true], ['Download copy', false], ['Dismiss', false]]);
  click('Download copy'); await Promise.resolve(); await Promise.resolve();
  assert.equal(downloaded, 1); assert.equal(opened, 0); assert.ok(queue(), 'the queue stays open');
});
