// SPDX-License-Identifier: MPL-2.0
/** Workspace queue, acknowledgements, permissions and project-opening behaviour. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { pickMessage } from './inbox.ts';
import type { InboxMessage } from './inbox.ts';

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
globalThis.location = dom.window.location as unknown as Location;
globalThis.Element = dom.window.Element as unknown as typeof Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
// The blocking dialog (components/modal.ts) needs the dialog element's two methods.
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
// a11y.ts's announce() paints on the next frame.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

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

const { notificationEntries, dismissNotification, notificationCount, _resetNotificationsForTests } = await import('../lib/notifications.ts');
const { dismissMessage, refreshInbox, sharedProjectOf, splitOpenedShares } = await import('./inbox.ts');
const { noteProjectOpened } = await import('./opened-projects.ts');
const reset = () => { _resetBannerForTests(); _resetNotificationsForTests(); fetchLog = []; };
const queue = () => notificationEntries().filter(m => !m.dismissed);
const share = (id: string, projectId: string): InboxMessage => ({ ...msg(id, 'info'), kind: 'share',
  cta: { label: 'Open', url: `/#/team/project/${projectId}` }, data: { kind: 'project-share', projectId } });

test('ordinary messages enter the profile queue without covering the app', async () => {
  reset(); inbox = [{ ...msg('quota', 'action'), title: 'Storage almost full', body: 'Free up space', cta: { label: 'Manage', url: '#/profile' } }];
  await mountOrgBanner();
  assert.equal(document.getElementById('org-banner'), null);
  assert.equal(queue()[0]?.title, 'Storage almost full');
  assert.equal(queue()[0]?.action?.href, '#/profile');
});
test('an unsafe workspace CTA is excluded while its message remains readable', async () => {
  reset(); inbox = [{ ...msg('unsafe', 'action'), cta: { label: 'Run', url: 'javascript:fetch("/steal")' } }];
  await mountOrgBanner(); assert.equal(queue().length, 1); assert.equal(queue()[0]?.action, undefined);
});
test('dismissing a queued workspace message ACKs once and removes its content', async () => {
  reset(); inbox = [msg('ack', 'info')]; await mountOrgBanner();
  const id = queue()[0]!.id; dismissNotification(id); dismissNotification(id); await Promise.resolve();
  assert.equal(queue().length, 0); assert.equal(notificationEntries().length, 0);
  assert.equal(fetchLog.filter(c => c.method === 'POST' && c.url.endsWith('/ack')).length, 1);
});
test('a non-dismissible workspace message cannot be dismissed through the queue', async () => {
  reset(); inbox = [{ ...msg('required', 'info'), dismissible: false }]; await mountOrgBanner();
  dismissNotification(queue()[0]!.id); assert.equal(queue().length, 1);
  assert.equal(fetchLog.filter(c => c.method === 'POST').length, 0);
});
test('project share actions retain their route and are acknowledged when the project opens', async () => {
  reset(); inbox = [share('launch', 'prj_launch')]; await mountOrgBanner();
  assert.equal(queue()[0]?.action?.href, '/#/team/project/prj_launch');
  noteProjectOpened('prj_other'); assert.equal(queue().length, 1);
  noteProjectOpened('prj_launch'); assert.equal(queue().length, 0);
  assert.ok(fetchLog.some(c => c.url.endsWith('/api/v1/inbox/launch/ack')));
});
test('opening a project before messages arrive ACKs its share without listing it', async () => {
  reset(); noteProjectOpened('prj_launch'); inbox = [share('launch', 'prj_launch')]; await mountOrgBanner();
  assert.equal(queue().length, 0); assert.ok(fetchLog.some(c => c.url.endsWith('/api/v1/inbox/launch/ack')));
});
test('opening a project ACKs all of its shares while other messages remain', async () => {
  reset(); inbox = [share('other', 'prj_other'), share('a', 'prj_launch'), share('b', 'prj_launch')]; await mountOrgBanner();
  noteProjectOpened('prj_launch'); assert.equal(queue().length, 1); assert.equal(queue()[0]?.title, 'other');
  assert.equal(fetchLog.filter(c => c.method === 'POST').length, 2);
  noteProjectOpened('prj_launch'); assert.equal(fetchLog.filter(c => c.method === 'POST').length, 2);
});
test('the queue count stays current when the role-aware inbox dismisses a message', async () => {
  reset(); inbox = [msg('a', 'action'), msg('b', 'info'), msg('c', 'info')]; await mountOrgBanner();
  assert.equal(notificationCount(), 3); dismissMessage('b'); assert.equal(notificationCount(), 2);
  dismissMessage('a'); dismissMessage('c'); assert.equal(notificationCount(), 0);
});
test('refreshing workspace notices does not duplicate queued messages', async () => {
  reset(); inbox = [msg('one', 'info')]; await mountOrgBanner(); await refreshInbox({ force: true });
  assert.equal(queue().length, 1);
});
test('an authentication refusal clears private workspace messages', async () => {
  reset(); inbox = [msg('private', 'info')]; await mountOrgBanner();
  const previous = globalThis.fetch; globalThis.fetch = async () => new Response('', { status: 401 });
  try { await refreshInbox({ force: true }); assert.equal(queue().length, 0); }
  finally { globalThis.fetch = previous; }
});
test('collaboration invitations and access requests retain role-aware Review actions', async () => {
  reset(); inbox = [{ ...msg('invite', 'action'), data: { kind: 'collab-invite' } },
    { ...msg('request', 'action'), data: { kind: 'access-request', requestId: 'r' } }];
  await mountOrgBanner(); assert.ok(queue().every(row => row.action?.label === 'Review' && typeof row.action.run === 'function'));
});
test('sharedProjectOf and splitOpenedShares recognise only project shares', () => {
  assert.equal(sharedProjectOf(share('s', 'p')), 'p'); assert.equal(sharedProjectOf(msg('n', 'info')), '');
  assert.equal(sharedProjectOf({ data: { kind: 'collab-invite', projectId: 'p' } }), ''); assert.equal(sharedProjectOf(null), '');
  const split = splitOpenedShares([share('a', 'p'), share('b', 'q'), msg('n', 'action')], new Set(['p']));
  assert.deepEqual(split.keep.map(m => m.id), ['b', 'n']); assert.deepEqual(split.done.map(m => m.id), ['a']);
});

// ── A blocking comment notice (plan 76 M4) ───────────────────────────────────

const blockingNotice = (id: string, data: Record<string, string> = {}): InboxMessage => ({
  id, kind: 'comment', severity: 'blocking', title: 'Server title in English', body: 'This comment is no longer available.',
  cta: { label: 'Open thread', url: 'https://elsewhere.example/#/team/ses_other?thread=th_other' },
  data: { kind: 'comment-mention', sessionId: 'ses_1', projectId: 'prj_1', threadId: 'th_1', actorName: '<b>Ana</b>', label: 'Spring poster', count: '1', ...data },
  dismissible: true,
});
const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
const acks = (id: string): number => fetchLog.filter(c => c.method === 'POST' && c.url.endsWith(`/api/v1/inbox/${id}/ack`)).length;

test('a blocking comment notice shows its own title as text and opens its thread from the payload', async () => {
  reset(); inbox = [blockingNotice('cn_1')]; await mountOrgBanner();
  const dlg = document.querySelector('dialog')!;
  assert.equal(dlg.querySelector('h2')?.textContent, '<b>Ana</b> mentioned you in Spring poster');
  assert.equal(dlg.getAttribute('aria-label'), '<b>Ana</b> mentioned you in Spring poster');
  assert.equal(dlg.querySelector('h2 b'), null, 'the name stays text');
  assert.equal(dlg.querySelector('.modal-msg')?.textContent, 'This comment is no longer available.');
  assert.equal(dlg.querySelector('a[href*="elsewhere"]'), null, 'never the instance link');
  const links = dlg.querySelectorAll<HTMLAnchorElement>('.modal-actions a');
  assert.equal(links.length, 1);
  assert.equal(links[0]!.textContent, 'Open thread');
  assert.equal(links[0]!.getAttribute('href'), '#/team/ses_1?thread=th_1');
  assert.equal(dlg.querySelector('[data-act="ok"]')?.textContent, 'Dismiss');
  links[0]!.click();
  await settle();
  assert.equal(window.location.hash, '#/team/ses_1?thread=th_1');
  assert.equal(document.querySelector('dialog'), null, 'the route change closes the dialog');
  assert.equal(acks('cn_1'), 1, 'following the link acks the notice');
  window.history.replaceState(null, '', '/');
});

test('a blocking comment notice whose thread id fails its check has no link at all', async () => {
  reset(); inbox = [blockingNotice('cn_2', { threadId: 'th 2', kind: 'comment-reply', count: '2' })]; await mountOrgBanner();
  const dlg = document.querySelector('dialog')!;
  assert.equal(dlg.querySelector('h2')?.textContent, 'New replies in Spring poster: 2');
  assert.equal(dlg.querySelector('a'), null);
  const ok = dlg.querySelector<HTMLButtonElement>('[data-act="ok"]')!;
  assert.equal(ok.textContent, 'Got it');
  ok.click();
  await settle();
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(acks('cn_2'), 1);
});

test('any other blocking message keeps its title, body and link as before', async () => {
  reset(); inbox = [{ ...msg('policy', 'blocking'), title: 'New <i>policy</i>', body: 'Read & accept', cta: { label: 'Read it', url: 'https://acme.example/policy' } }];
  await mountOrgBanner();
  const dlg = document.querySelector('dialog')!;
  assert.equal(dlg.querySelector('h2')?.textContent, 'New <i>policy</i>');
  assert.equal(dlg.querySelector('.modal-msg')?.textContent, 'Read & accept');
  const link = dlg.querySelector<HTMLAnchorElement>('a.org-banner-cta')!;
  assert.equal(link.textContent, 'Read it');
  assert.equal(link.getAttribute('href'), 'https://acme.example/policy');
  dlg.querySelector<HTMLButtonElement>('[data-act="ok"]')!.click();
  await settle();
  assert.equal(acks('policy'), 1);
});
