// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { publishNotification, notificationEntries, notificationCount, dismissNotification, delayNotification,
  restoreNotification, registerNotificationSource, configureNotifications, onNotificationsChange,
  _resetNotificationsForTests, type NotificationPreferencesStore } from './notifications.ts';

beforeEach(_resetNotificationsForTests);
const notice = { id: 'revision:42', title: 'Design system updated', body: 'Private words', reminder: true };
test('publishing a replacement is deduplicated and an older cleanup cannot remove it', () => {
  const old = publishNotification(notice); const latest = publishNotification({ ...notice, title: 'New revision' });
  old(); assert.equal(notificationCount(), 1); assert.equal(notificationEntries()[0]?.title, 'New revision');
  latest(); assert.equal(notificationCount(), 0);
});
test('dismissal, reminder delay and restore produce the appropriate queue state', () => {
  publishNotification(notice); delayNotification(notice.id, Date.now() + 3600000);
  assert.equal(notificationCount(), 0); assert.ok(notificationEntries()[0]!.until);
  restoreNotification(notice.id); assert.equal(notificationCount(), 1);
  dismissNotification(notice.id); assert.equal(notificationCount(), 0); assert.equal(notificationEntries()[0]!.dismissed, true);
  restoreNotification(notice.id); assert.equal(notificationCount(), 1);
});
test('expired reminders become active and ordinary notices cannot be delayed', () => {
  publishNotification(notice); const later = Date.now() + 1000; delayNotification(notice.id, later);
  assert.equal(notificationEntries(later + 1)[0]?.until, 0);
  publishNotification({ id: 'plain', title: 'Plain' }); delayNotification('plain', later);
  assert.equal(notificationEntries().find(row => row.id === 'plain')?.until, 0);
});
test('required messages remain visible even with an old dismissal preference', async () => {
  await configureNotifications({ read: async () => [{ id: notice.id, dismissed: true, until: 0 }], write: async () => {} });
  publishNotification({ ...notice, dismissible: false }); dismissNotification(notice.id); delayNotification(notice.id, Date.now() + 1000);
  assert.equal(notificationCount(), 1);
});
test('only chrome presentation choices are stored and they survive a reload', async () => {
  let value: unknown; const store: NotificationPreferencesStore = { read: async () => value, write: async rows => { value = rows; } };
  await configureNotifications(store); publishNotification(notice); dismissNotification(notice.id);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.doesNotMatch(JSON.stringify(value), /Private words|Design system updated/);
  _resetNotificationsForTests(); await configureNotifications(store); publishNotification(notice);
  assert.equal(notificationEntries()[0]?.dismissed, true);
});
test('a dismissal during preference loading wins and preserves other remembered choices', async () => {
  let resolve!: (rows: unknown) => void; let saved: unknown;
  const pending = configureNotifications({ read: () => new Promise(done => { resolve = done; }), write: async rows => { saved = rows; } });
  publishNotification(notice); dismissNotification(notice.id);
  resolve([{ id: notice.id, dismissed: false, until: 0 }, { id: 'other', dismissed: true, until: 0 }]);
  await pending; await new Promise(done => setTimeout(done, 0));
  assert.equal(notificationEntries()[0]?.dismissed, true);
  assert.equal((saved as unknown[]).length, 2);
});
test('removing a workspace source removes its private messages and cleanup preserves a replacement source', () => {
  const old = registerNotificationSource('workspace', () => [notice]);
  const latest = registerNotificationSource('workspace', () => [{ ...notice, id: 'new-account' }]);
  old(); assert.equal(notificationEntries()[0]?.id, 'new-account'); latest(); assert.equal(notificationCount(), 0);
});
test('storage failure and a broken observer leave the other controls usable', async () => {
  await configureNotifications({ read: async () => { throw new Error('Unavailable'); }, write: async () => { throw new Error('Unavailable'); } });
  onNotificationsChange(() => { throw new Error('Broken view'); }); let calls = 0; onNotificationsChange(() => { calls++; });
  publishNotification(notice); dismissNotification(notice.id); assert.equal(calls, 2); assert.equal(notificationCount(), 0);
});
