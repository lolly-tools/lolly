// SPDX-License-Identifier: MPL-2.0
/**
 * Viewing as a partner (org/view-as.ts) shows none of the first-run prompts: the
 * gallery's banner slot (the privacy notice, "Add your details" and "Lolly works
 * offline"), the welcome dialog, a tool's first-visit guide, the device image
 * milestone notice and the automatic Performance UI notice. Nothing in a view
 * records a dismissal for this browser, and a workspace notice the browser's own
 * person closed still shows in the view.
 *
 * Run directly:  node --test shells/web/src/org/view-as-prompts.test.ts
 */
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://work.test/#/' });
const install = (key: string, value: unknown): void => {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
};
install('window', dom.window);
install('document', dom.window.document);
install('localStorage', dom.window.localStorage);
install('sessionStorage', dom.window.sessionStorage);
install('navigator', dom.window.navigator);
install('HTMLElement', dom.window.HTMLElement);
install('Event', dom.window.Event);

const { firstRunBannerMarkup } = await import('../views/first-run-banner.ts');
const { galleryWelcomeStep } = await import('../views/gallery-welcome.ts');
const { autoOpenToolGuide } = await import('../components/tool-guide.ts');
const { maybeNudgeAssetMilestone } = await import('../lib/asset-milestone.ts');
const { perfUiAutoAllowedHere } = await import('../lib/perf-ui-auto.ts');
const { mountOrgChrome, _resetChromeForTests } = await import('./chrome.ts');
const notifications = await import('../lib/notifications.ts');

const VIEW = JSON.stringify({
  token: 'view-token', expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  programme: { id: 'resellers-emea', name: 'Resellers, EMEA' }, company: { id: 'northwind', name: 'Northwind IT' },
});
const view = (): void => { sessionStorage.setItem('lolly-view-as', VIEW); };
const guide = { id: 'partner-data-sheet', guide: { tracks: [{ steps: ['Add your price.'] }] } } as never;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = '';
  notifications._resetNotificationsForTests();
  _resetChromeForTests();
});
afterEach(() => { document.body.innerHTML = ''; });

test('the gallery banner slot is empty in a view: no privacy notice, details nudge or offline nudge', () => {
  // Outside a view each banner takes the slot in turn.
  assert.match(firstRunBannerMarkup({}, false), /privacy-notice/);
  localStorage.setItem('lolly-privacy-ack', '1');
  const next = firstRunBannerMarkup({}, false);
  const offline = firstRunBannerMarkup({}, true);
  assert.notEqual(next, '', 'with the privacy notice answered, a nudge takes the slot');
  assert.match(offline, /offline-nudge/);
  localStorage.clear();
  view();
  assert.equal(firstRunBannerMarkup({}, false), '');
  assert.equal(firstRunBannerMarkup({}, true), '');
  localStorage.setItem('lolly-privacy-ack', '1');
  assert.equal(firstRunBannerMarkup({}, false), '');
  assert.equal(firstRunBannerMarkup({}, true), '', 'not "Lolly works offline" either');
});

test('the welcome dialog does not open in a view, even when a link forces it', async () => {
  view();
  // A first visit on the shipped design system, where the welcome would be due.
  const asked: string[] = [];
  const cold = {
    tokens: { isLocked: async () => false, activeRecord: async () => ({ source: { kind: 'shipped' }, label: 'Lolly' }) },
    assets: { query: async () => [], _findMetaByType: async () => undefined },
  };
  const host = new Proxy(cold, { get(target, key) { asked.push(String(key)); return Reflect.get(target, key); } });
  assert.deepEqual(await galleryWelcomeStep(host as never, () => true, true), { unbranded: false });
  assert.deepEqual(asked, [], 'a view never asks whether the welcome is due');
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(localStorage.getItem('lolly-welcome-dismissed'), null, 'no settled welcome is recorded');
});

test('a tool\'s first-visit guide does not open in a view and is not marked seen', () => {
  view();
  assert.equal(autoOpenToolGuide(guide), null);
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(localStorage.getItem('lolly-guide-seen'), null);
});

test('the device image milestone notice does not open in a view and is not marked seen', async () => {
  view();
  await maybeNudgeAssetMilestone({ assets: { _userAssetsCount: async () => 100_000 } });
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(localStorage.getItem('lolly-asset-milestones-seen'), null);
});

test('the automatic Performance UI notice is not allowed in a view', () => {
  assert.equal(perfUiAutoAllowedHere(), true, 'allowed outside a view in this test browser');
  view();
  assert.equal(perfUiAutoAllowedHere(), false);
});

test('a workspace notice this browser closed still shows in a view, and closing it there records nothing', async () => {
  const base = 'lolly:org-chrome-dismissed:same-origin';
  localStorage.setItem(base, JSON.stringify(['maintenance']));
  view();
  await notifications.configureNotifications();
  mountOrgChrome([{ kind: 'chrome', slot: 'banner', id: 'maintenance', title: 'Maintenance on Sunday', text: 'Saving pauses for an hour.' } as never]);
  const entry = notifications.notificationEntries().find(row => row.id.endsWith(':maintenance'));
  assert.ok(entry, 'the partner sees the notice');
  assert.equal(entry.dismissed, false);
  notifications.dismissNotification(entry.id);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(localStorage.getItem(base), JSON.stringify(['maintenance']), 'the browser\'s own list is unchanged');
  assert.equal(localStorage.getItem('lolly:notification-preferences'), null, 'no dismissal is stored');
});
