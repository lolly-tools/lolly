// SPDX-License-Identifier: MPL-2.0
/**
 * org/banner.ts - the single-message inbox banner.
 *
 * pickMessage is pure (severity selection). The mount path is exercised DOM-light
 * with jsdom for the info/action bar: it renders one bar and, on dismiss, POSTs
 * the ack and removes itself. (The blocking path uses the house modal primitive,
 * covered by the modal component's own tests; showModal is not driven here.)
 *
 * Run directly:  node --test shells/web/src/org/banner.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { pickMessage } from './banner.ts';
import type { InboxMessage } from './banner.ts';

// ── pickMessage (pure) ────────────────────────────────────────────────────────

const msg = (id: string, severity: InboxMessage['severity']): InboxMessage =>
  ({ id, kind: 'notice', severity, title: id, dismissible: true });

test('pickMessage returns null for an empty inbox', () => {
  assert.equal(pickMessage([]), null);
});

test('pickMessage picks the highest severity (blocking > action > info)', () => {
  assert.equal(pickMessage([msg('a', 'info'), msg('b', 'blocking'), msg('c', 'action')])?.id, 'b');
  assert.equal(pickMessage([msg('a', 'info'), msg('c', 'action')])?.id, 'c');
  assert.equal(pickMessage([msg('a', 'info')])?.id, 'a');
});

test('pickMessage breaks ties by input order', () => {
  assert.equal(pickMessage([msg('first', 'action'), msg('second', 'action')])?.id, 'first');
});

// ── Bar render + dismiss/ack (jsdom) ──────────────────────────────────────────

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/' },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

let fetchLog: Array<{ url: string; method: string }> = [];
let inbox: InboxMessage[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = (init?.method || 'GET').toUpperCase();
  fetchLog.push({ url, method });
  if (url.includes('/api/v1/inbox/') && url.endsWith('/ack')) return new Response('', { status: 200 });
  if (url.includes('/api/v1/inbox')) return new Response(JSON.stringify({ messages: inbox }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response('', { status: 404 });
}) as typeof fetch;

const { mountOrgBanner, _resetBannerForTests } = await import('./banner.ts');

test('an action message renders one dismissible bar above the app', async () => {
  _resetBannerForTests();
  fetchLog = [];
  inbox = [{ id: 'm1', kind: 'quota', severity: 'action', title: 'Storage almost full', body: 'Free up space', dismissible: true, cta: { label: 'Manage', url: '#/profile' } }];
  await mountOrgBanner();

  const bar = document.getElementById('org-banner');
  assert.ok(bar, 'banner rendered');
  // Pinned above the app content (before #view).
  assert.equal(bar!.nextElementSibling?.id, 'view');
  assert.match(bar!.textContent || '', /Storage almost full/);
  assert.ok(bar!.querySelector('a.org-banner-cta'), 'CTA link present');
});

test('a javascript: CTA url is dropped, not rendered as a clickable anchor', async () => {
  _resetBannerForTests();
  fetchLog = [];
  inbox = [{ id: 'm9', kind: 'notice', severity: 'action', title: 'Action required', dismissible: true, cta: { label: 'Review', url: 'javascript:fetch("/steal")' } }];
  await mountOrgBanner();

  const bar = document.getElementById('org-banner');
  assert.ok(bar, 'banner still rendered');
  assert.equal(bar!.querySelector('a.org-banner-cta'), null, 'no CTA anchor for an unsafe scheme');
  assert.doesNotMatch(bar!.innerHTML, /javascript:/);
  bar!.remove();
});

test('dismiss ACKs the message and removes the bar', async () => {
  _resetBannerForTests();
  fetchLog = [];
  inbox = [{ id: 'm42', kind: 'notice', severity: 'info', title: 'Heads up', dismissible: true }];
  await mountOrgBanner();

  const dismiss = document.querySelector<HTMLButtonElement>('.org-banner-dismiss');
  assert.ok(dismiss, 'dismiss control present');
  dismiss!.click();

  assert.equal(document.getElementById('org-banner'), null, 'bar removed on dismiss');
  // Allow the fire-and-forget ack microtask to settle.
  await Promise.resolve();
  const ack = fetchLog.find(c => c.method === 'POST' && c.url.endsWith('/api/v1/inbox/m42/ack'));
  assert.ok(ack, `ack POSTed (log: ${JSON.stringify(fetchLog)})`);
});

test('a non-dismissible info message shows no dismiss control', async () => {
  _resetBannerForTests();
  fetchLog = [];
  inbox = [{ id: 'm7', kind: 'notice', severity: 'info', title: 'Read only', dismissible: false }];
  await mountOrgBanner();
  assert.ok(document.getElementById('org-banner'), 'bar rendered');
  assert.equal(document.querySelector('.org-banner-dismiss'), null);
});
