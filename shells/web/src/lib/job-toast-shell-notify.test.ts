// SPDX-License-Identifier: MPL-2.0
/**
 * The job toast's notification channel is PROBED, not assumed (plans/202 WP4.1).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/job-toast-shell-notify.test.ts
 *
 * A shell that can post through its platform's own notification service installs
 * `window.__lollyNotify` - the Tauri desktop app does it from
 * shells/tauri-desktop/bridge-overrides/notify.ts, wrapping
 * tauri-plugin-notification. When that global is there the toast must use it and
 * must NOT also raise a web `Notification`, or a finished job would notify twice.
 *
 * Its own file, beside job-toast-notify.test.ts (the web-API case): the module's
 * once-per-session permission flag has to start fresh, and node runs each test
 * file in its own process.
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

// The shell channel, installed before the module loads - exactly as the bridge
// override does, on the boot path ahead of the first job.
const requests: number[] = [];
const sent: Array<{ title: string; body: string }> = [];
(globalThis as { __lollyNotify?: unknown }).__lollyNotify = {
  request(): void { requests.push(1); },
  send(title: string, body: string): void { sent.push({ title, body }); },
};

// A web Notification is present too (the Tauri webview has one). Nothing may use
// it while the shell channel is installed.
let webPermCalls = 0;
const webFired: string[] = [];
class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission(): Promise<NotificationPermission> {
    webPermCalls++;
    return Promise.resolve('granted');
  }
  onclick: (() => void) | null = null;
  constructor(title: string) { webFired.push(title); }
  close(): void {}
}
(globalThis as { Notification?: unknown }).Notification = FakeNotification;

const { mountJobToast } = await import('./job-toast.ts');
const { startJob } = await import('./jobs.ts');

test('the shell channel takes the permission request, the web API is untouched', () => {
  mountJobToast();
  assert.equal(requests.length, 0, 'mount must never ask');

  const job = startJob({ title: 'Removing background' });
  assert.equal(requests.length, 1, 'asked once, on the first long job');
  assert.equal(webPermCalls, 0, 'the web Notification API must not also be asked');
  job.finish();
});

test('a job finishing in a hidden window notifies through the shell, once', () => {
  sent.length = 0;
  webFired.length = 0;
  Object.defineProperty(dom.window.document, 'hidden', { value: true, configurable: true });

  const job = startJob({ title: 'Matte while hidden' });
  job.finish();

  assert.equal(sent.length, 1, 'one notification through the shell');
  assert.equal(sent[0]!.title, 'Matte while hidden');
  assert.equal(webFired.length, 0, 'and no second one through the web API');
});

test('a visible window still notifies through nothing at all', () => {
  sent.length = 0;
  webFired.length = 0;
  Object.defineProperty(dom.window.document, 'hidden', { value: false, configurable: true });

  const job = startJob({ title: 'Crop while visible' });
  job.finish();

  assert.equal(sent.length, 0, 'the toast is the whole story while the window is up');
  assert.equal(webFired.length, 0);
});

test('a malformed global is ignored and the web API is used instead', async () => {
  // Half an object is not a channel. The probe checks both methods, so a shell
  // that installs a partial global falls back rather than throwing mid-job.
  (globalThis as { __lollyNotify?: unknown }).__lollyNotify = { send: () => {} };
  const mod = await import('./job-toast.ts');
  assert.equal(typeof mod.mountJobToast, 'function');

  sent.length = 0;
  webFired.length = 0;
  Object.defineProperty(dom.window.document, 'hidden', { value: true, configurable: true });
  const job = startJob({ title: 'Half a channel' });
  job.finish();

  assert.equal(sent.length, 0, 'the partial global is not used');
  assert.equal(webFired.length, 1, 'the web Notification API carried it');
});
