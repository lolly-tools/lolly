// SPDX-License-Identifier: MPL-2.0
/**
 * org/banner.ts - the inbox banner, one message at a time.
 *
 * pickMessage is pure (severity selection, in org/inbox.ts). The mount path is
 * exercised DOM-light with jsdom for the info/action bar: it renders one bar and, on
 * dismiss, POSTs the ack and shows the next message in its place; View all appears
 * while more than one message is waiting. (The blocking path uses the house modal
 * primitive, covered by the modal component's own tests; showModal is not driven
 * here.)
 *
 * Run directly:  node --test shells/web/src/org/banner.test.ts
 */
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

test('a project share message (lolly-work plan 74) opens the team project route', async () => {
  _resetBannerForTests();
  document.getElementById('org-banner')?.remove();
  fetchLog = [];
  // The message as lolly-work's buildShareMessage writes it when instance.appUrl is unset.
  inbox = [{
    id: 'share_abc', kind: 'share', severity: 'info', title: 'Ana shared Launch with you',
    cta: { label: 'Open', url: '/#/team/project/prj_12345678' },
    data: { kind: 'project-share', projectId: 'prj_12345678', role: 'editor' }, dismissible: true,
  }];
  await mountOrgBanner();
  const bar = document.getElementById('org-banner');
  assert.ok(bar, 'banner rendered');
  assert.match(bar!.textContent || '', /Ana shared Launch with you/);
  const cta = bar!.querySelector<HTMLAnchorElement>('a.org-banner-cta');
  assert.ok(cta, 'the Open link is kept');
  assert.equal(cta!.getAttribute('href'), '/#/team/project/prj_12345678');
  bar!.remove();
});

// ── A share message is done once its project is open ───────────────────────────

const shareMsg = (id: string, projectId: string): InboxMessage => ({
  id, kind: 'share', severity: 'info', title: 'Ana shared Launch with you',
  cta: { label: 'Open', url: `/#/team/project/${projectId}` },
  data: { kind: 'project-share', projectId, role: 'editor' }, dismissible: true,
});

test('sharedProjectOf reads only a project share payload', async () => {
  const { sharedProjectOf } = await import('./inbox.ts');
  assert.equal(sharedProjectOf(shareMsg('s', 'prj_1')), 'prj_1');
  assert.equal(sharedProjectOf(msg('n', 'info')), '');
  assert.equal(sharedProjectOf({ data: { kind: 'collab-invite', projectId: 'prj_1' } }), '');
  assert.equal(sharedProjectOf(null), '');
});

test('splitOpenedShares sets aside shares whose project is already open', async () => {
  const { splitOpenedShares } = await import('./inbox.ts');
  const a = shareMsg('a', 'prj_open');
  const b = shareMsg('b', 'prj_other');
  const n = msg('n', 'action');
  const { keep, done } = splitOpenedShares([a, b, n], new Set(['prj_open']));
  assert.deepEqual(keep.map((m) => m.id), ['b', 'n']);
  assert.deepEqual(done.map((m) => m.id), ['a']);
});

test('opening the shared project takes the bar down and acks it', async () => {
  const { noteProjectOpened } = await import('./opened-projects.ts');
  _resetBannerForTests();
  document.getElementById('org-banner')?.remove();
  fetchLog = [];
  inbox = [shareMsg('share_1', 'prj_launch')];
  await mountOrgBanner();
  assert.ok(document.getElementById('org-banner'), 'banner rendered');
  noteProjectOpened('prj_other');
  assert.ok(document.getElementById('org-banner'), 'another project leaves it up');
  noteProjectOpened('prj_launch');
  assert.equal(document.getElementById('org-banner'), null, 'bar removed');
  await Promise.resolve();
  assert.ok(fetchLog.some(c => c.method === 'POST' && c.url.endsWith('/api/v1/inbox/share_1/ack')), 'acked');
});

test('a project opened before the inbox loads acks its share instead of showing it', async () => {
  const { noteProjectOpened } = await import('./opened-projects.ts');
  _resetBannerForTests();
  document.getElementById('org-banner')?.remove();
  fetchLog = [];
  noteProjectOpened('prj_launch');
  inbox = [shareMsg('share_2', 'prj_launch')];
  await mountOrgBanner();
  assert.equal(document.getElementById('org-banner'), null, 'nothing shown');
  await Promise.resolve();
  assert.ok(fetchLog.some(c => c.method === 'POST' && c.url.endsWith('/api/v1/inbox/share_2/ack')), 'acked');
});

test('opening a project acks its share message even while another message is on screen', async () => {
  const { noteProjectOpened } = await import('./opened-projects.ts');
  _resetBannerForTests();
  document.getElementById('org-banner')?.remove();
  fetchLog = [];
  inbox = [shareMsg('share_autumn', 'prj_other'), shareMsg('share_spring', 'prj_launch')];
  await mountOrgBanner();
  assert.match(document.querySelector('#org-banner a.org-banner-cta')?.getAttribute('href') || '', /prj_other$/, 'the first share is the one shown');
  noteProjectOpened('prj_launch');
  await Promise.resolve();
  const acks = fetchLog.filter(c => c.method === 'POST').map(c => c.url);
  assert.ok(acks.some(u => u.endsWith('/api/v1/inbox/share_spring/ack')), 'the waiting share for the opened project is acked');
  assert.ok(!acks.some(u => u.endsWith('/api/v1/inbox/share_autumn/ack')), 'the one on screen is about another project and stays');
  assert.ok(document.getElementById('org-banner'), 'its bar stays up');
  // Opened again: nothing is left to ack for that project.
  fetchLog = [];
  noteProjectOpened('prj_launch');
  await Promise.resolve();
  assert.equal(fetchLog.filter(c => c.method === 'POST').length, 0, 'acked once');
});

test('the bar keeps its action next to the message and clears the floating top-row controls', async () => {
  _resetBannerForTests();
  document.getElementById('org-banner')?.remove();
  inbox = [shareMsg('share_3', 'prj_launch')];
  await mountOrgBanner();
  const bar = document.getElementById('org-banner')!;
  assert.match(bar.style.padding || bar.getAttribute('style') || '', /--chrome-h/, 'the message row sits below the top-row controls');
  const cta = bar.querySelector('a.org-banner-cta')!;
  assert.equal(cta.parentElement?.className, 'org-banner-message', 'the action sits with the message');
  assert.match(cta.previousElementSibling?.textContent || '', /shared Launch with you/, 'right after its words');
  assert.equal(bar.lastElementChild?.className, 'org-banner-dismiss', 'dismiss stays at the end');
});

// ── One at a time, from the inbox (plan 74 invite spec 5.2) ─────────────────────

test('after a dismiss the next message takes the place of the first, and focus moves with it', async () => {
  _resetBannerForTests();
  fetchLog = [];
  inbox = [msg('first', 'action'), msg('second', 'info'), msg('third', 'info')];
  await mountOrgBanner();
  assert.match(document.getElementById('org-banner')!.textContent || '', /first/);
  document.querySelector<HTMLButtonElement>('.org-banner-dismiss')!.click();
  const bar = document.getElementById('org-banner');
  assert.ok(bar, 'a bar is still up');
  assert.match(bar!.textContent || '', /second/, 'the next message, in severity then list order');
  assert.equal(document.activeElement, bar!.querySelector('.org-banner-dismiss'), 'focus is on the new bar, not lost to the page');
  await Promise.resolve();
  assert.ok(fetchLog.some((c) => c.method === 'POST' && c.url.endsWith('/api/v1/inbox/first/ack')), 'the first was acked');
  document.querySelector<HTMLButtonElement>('.org-banner-dismiss')!.click();
  document.querySelector<HTMLButtonElement>('.org-banner-dismiss')!.click();
  assert.equal(document.getElementById('org-banner'), null, 'nothing left to show');
});

test('View all shows while more than one message is waiting, with the count kept current', async () => {
  const { dismissMessage } = await import('./inbox.ts');
  _resetBannerForTests();
  inbox = [msg('a', 'action'), msg('b', 'info'), msg('c', 'info')];
  await mountOrgBanner();
  const all = (): HTMLButtonElement | null => document.querySelector<HTMLButtonElement>('#org-banner .org-banner-all');
  assert.equal(all()?.textContent, 'View all (3)');
  assert.equal(all()?.parentElement?.className, 'org-banner-message', 'with the message, not past the dismiss control');
  dismissMessage('c');
  assert.equal(all()?.textContent, 'View all (2)', 'one fewer once another message goes');
  dismissMessage('b');
  assert.equal(all(), null, 'one message left: nothing more to view');
  assert.match(document.getElementById('org-banner')!.textContent || '', /\ba\b/, 'the message on screen stays');
});

test('info and action bars are status regions, and the dismiss control is a full-size target', async () => {
  _resetBannerForTests();
  inbox = [msg('i', 'info')];
  await mountOrgBanner();
  const bar = document.getElementById('org-banner')!;
  assert.equal(bar.getAttribute('role'), 'status');
  const dismiss = bar.querySelector<HTMLElement>('.org-banner-dismiss')!;
  assert.equal(dismiss.style.width, 'var(--ui-size-target)');
  assert.equal(dismiss.style.height, 'var(--ui-size-target)');
});

test('a message that leaves the inbox elsewhere takes its bar with it, acked once', async () => {
  const { dismissMessage } = await import('./inbox.ts');
  _resetBannerForTests();
  fetchLog = [];
  inbox = [msg('only', 'action')];
  await mountOrgBanner();
  assert.ok(document.getElementById('org-banner'));
  dismissMessage('only'); // the inbox sheet's Dismiss
  assert.equal(document.getElementById('org-banner'), null, 'the bar went with the message');
  dismissMessage('only');
  await Promise.resolve();
  assert.equal(fetchLog.filter((c) => c.method === 'POST').length, 1, 'one ack');
});

test('a message is shown once per visit, even when a later fetch still lists it', async () => {
  const { refreshInbox } = await import('./inbox.ts');
  _resetBannerForTests();
  inbox = [{ ...msg('keep', 'info'), dismissible: false }];
  await mountOrgBanner();
  document.getElementById('org-banner')!.remove(); // gone from the page without a dismiss
  await refreshInbox({ force: true });
  assert.equal(document.getElementById('org-banner'), null, 'not drawn a second time');
});
