// SPDX-License-Identifier: MPL-2.0
/**
 * Job toast desktop-notification gating (lib/job-toast.ts).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/job-toast-notify.test.ts
 *
 * The rule (plans/124 section 9.4, and Andy's "no browser-default hijack"):
 *   - Notification permission is requested ONLY on the first long (heavy) job
 *     start, never at boot/mount. startJob emits synchronously, so the request
 *     rides the same call stack as the Run-button click - a user gesture.
 *   - It is requested once per session even across many jobs.
 *   - A notification fires only when document.hidden, on a job reaching `done`.
 *
 * Its OWN file (not job-toast.test.ts) so the module's once-per-session flag
 * starts fresh - node runs each test file in a separate process.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;

// Fake Notification: jsdom implements none. Tracks permission requests + fired
// notifications.
let permCalls = 0;
const fired: Array<{ title: string; body?: string }> = [];
class FakeNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission(): Promise<NotificationPermission> {
    permCalls++;
    FakeNotification.permission = 'granted';
    return Promise.resolve('granted');
  }
  onclick: (() => void) | null = null;
  title: string;
  options?: { body?: string; tag?: string };
  constructor(title: string, options?: { body?: string; tag?: string }) {
    this.title = title;
    this.options = options;
    fired.push({ title, body: options?.body });
  }
  close(): void {}
}
(globalThis as { Notification?: unknown }).Notification = FakeNotification;

const { mountJobToast } = await import('./job-toast.ts');
const { startJob } = await import('./jobs.ts');

test('no permission request at mount, before any job', () => {
  mountJobToast();
  assert.equal(permCalls, 0, 'boot/mount must never prompt');
});

test('permission is requested on the first heavy job start, once per session', () => {
  const a = startJob({ title: 'Removing background' });
  assert.equal(permCalls, 1, 'requested on the first long job');

  const b = startJob({ title: 'Upscaling' });
  assert.equal(permCalls, 1, 'not requested again for a later job');

  a.finish();
  b.finish();
});

test('a completed job notifies only when the tab is hidden', () => {
  fired.length = 0;
  FakeNotification.permission = 'granted';

  // Visible tab: no OS notification, the toast is enough.
  Object.defineProperty(dom.window.document, 'hidden', { value: false, configurable: true });
  const visible = startJob({ title: 'Crop while visible' });
  visible.finish();
  assert.equal(fired.length, 0, 'no notification while the tab is visible');

  // Hidden tab: it fires, carrying the job title.
  Object.defineProperty(dom.window.document, 'hidden', { value: true, configurable: true });
  const hidden = startJob({ title: 'Matte while hidden' });
  hidden.finish();
  assert.equal(fired.length, 1, 'notified once the tab is hidden');
  assert.equal(fired[0]!.title, 'Matte while hidden');
});
