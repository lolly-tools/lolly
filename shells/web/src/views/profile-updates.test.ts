// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import type { ShellUpdater } from '../lib/update-coordinator.ts';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/settings' });
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.location = dom.window.location;
const { updatesRowHtml, wireUpdatesRow } = await import('./profile-updates.ts');
const { startDesktopUpdates, stopDesktopUpdates, updateCoordinator } = await import('../lib/desktop-updates.ts');
const { notificationEntries } = await import('../lib/notifications.ts');

test('browser and mobile markup has no desktop controls', () => { assert.equal(updatesRowHtml(false), ''); });
test('Settings remount preserves download state and renders hostile notes as text', async () => {
  let downloads = 0, closed = 0, manual = 0;
  const notes = '<img src=x onerror=alert(1)>';
  const shell: ShellUpdater = {
    async environment() { return { interactive: true, canInstall: true, reason: '', version: '1.1.3' }; },
    async check() { return { version: '1.1.4', currentVersion: '1.1.3', notes,
      async download(progress) { downloads++; progress(3, 3); }, async install() {}, async close() { closed++; } }; },
    async focused() { return true; }, async openDownload() { manual++; }, async notify() {}, async requestNotifications() {}, async onQuit() { return () => {}; }, async finish() {},
  };
  const owner = await startDesktopUpdates(shell)!;
  const root = document.createElement('div'); document.body.append(root); root.innerHTML = updatesRowHtml(true);
  let off = wireUpdatesRow(root, shell, '');
  assert.equal(root.querySelector('#updates-notes p')?.textContent, notes);
  assert.equal(root.querySelector('#updates-notes img'), null);
  assert.equal(notificationEntries().filter(row => row.id.startsWith('desktop-update:')).length, 1);
  await owner.download(); off(); root.innerHTML = updatesRowHtml(true); off = wireUpdatesRow(root, shell, '');
  assert.equal(updateCoordinator(shell), owner); assert.equal(downloads, 1);
  assert.equal(root.querySelector<HTMLButtonElement>('#updates-install')?.hidden, false);
  const link = root.querySelector<HTMLAnchorElement>('#updates-manual'); assert.equal(link?.href, 'https://lolly.tools/info/install.html');
  link!.click(); await Promise.resolve(); assert.equal(manual, 1); assert.equal(location.href, 'https://lolly.tools/#/settings');
  off(); stopDesktopUpdates(); await Promise.resolve(); root.remove(); assert.equal(closed, 1);
});
