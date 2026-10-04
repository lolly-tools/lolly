// SPDX-License-Identifier: MPL-2.0
/**
 * org/inbox-sheet.ts - every inbox message in one dialog, with Approve and Decline
 * for project access requests (plan 74 invite spec 5.3).
 *
 * The pure parts (newest-first order, reading a request off a message, the outcome
 * sentences) are checked on their own, and answerAccessRequest against a stubbed
 * fetch for each answer the instance can give. The dialog is then mounted in jsdom
 * over a real org/inbox.ts list: the heading and workspace line, rows newest first
 * with instance text kept inert, Open only for a safe link, Dismiss acking with focus
 * kept in the list, a project request answered in place (role, Approve, Decline and
 * every refusal), a join request sent to the console, the empty and failed states,
 * and the list following the inbox while the dialog is open.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/org/inbox-sheet.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.Element = dom.window.Element as unknown as typeof Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
const calls: Array<{ url: string; method: string; body: unknown }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(input), method: (init?.method ?? 'GET').toUpperCase(), body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
  return router(String(input), init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const {
  answerAccessRequest, answerText, openInboxSheet, requestOf, sortNewestFirst, _resetInboxSheetForTests,
} = await import('./inbox-sheet.ts');
const { inboxMessages, refreshInbox } = await import('./inbox.ts');
const { _resetBannerForTests } = await import('./banner.ts');
type InboxMessage = import('./inbox.ts').InboxMessage;

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 8; i++) await tick(); }

const msg = (id: string, extra: Partial<InboxMessage> = {}): InboxMessage =>
  ({ id, kind: 'notice', severity: 'info', title: `Message ${id}`, dismissible: true, ...extra });
const projectRequest = (id: string, extra: Partial<InboxMessage> = {}): InboxMessage => msg(id, {
  kind: 'request', severity: 'action', title: 'Sam asks to edit Launch', body: 'sam@acme.com · GitHub',
  cta: { label: 'Review', url: '/#/team/project/prj_1' },
  data: { kind: 'access-request', requestId: `req_${id}`, requestKind: 'project', projectId: 'prj_1', role: 'editor', name: 'Sam', at: new Date(Date.now() - 2 * 3_600_000).toISOString() },
  ...extra,
});

let inboxList: InboxMessage[] = [];
const inboxRoute = (url: string, init?: RequestInit): Response | null => {
  if (url.endsWith('/api/v1/inbox') && (init?.method ?? 'GET') === 'GET') return json({ messages: inboxList });
  if (url.includes('/api/v1/inbox/') && url.endsWith('/ack')) return json({ ok: true });
  return null;
};

async function reset(list: InboxMessage[] = []): Promise<void> {
  _resetInboxSheetForTests();
  _resetBannerForTests();
  for (const d of document.querySelectorAll('dialog')) d.remove();
  calls.length = 0;
  inboxList = list;
  router = (url, init) => inboxRoute(url, init) ?? new Response('', { status: 404 });
  await refreshInbox({ force: true });
}

const sheet = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>('dialog.inbox-sheet');
const rowsIds = (): string[] => [...sheet()!.querySelectorAll<HTMLElement>('li[data-msg]')].map((li) => li.dataset.msg!);
const row = (id: string): HTMLElement => sheet()!.querySelector<HTMLElement>(`li[data-msg="${id}"]`)!;
const acked = (id: string): boolean => calls.some((c) => c.method === 'POST' && c.url.endsWith(`/api/v1/inbox/${id}/ack`));

// ── Pure ─────────────────────────────────────────────────────────────────────

test('sortNewestFirst: timed messages newest first, untimed ones after them in the instance order', () => {
  const at = (id: string, iso?: string): InboxMessage => msg(id, iso ? { data: { at: iso } } : {});
  const out = sortNewestFirst([at('u1'), at('old', '2026-10-01T00:00:00Z'), at('u2'), at('new', '2026-10-03T00:00:00Z'), at('bad', 'soon')]);
  assert.deepEqual(out.map((m) => m.id), ['new', 'old', 'u1', 'u2', 'bad']);
});

test('requestOf reads an access request off its payload, and nothing else', () => {
  assert.deepEqual(requestOf(projectRequest('a')), { id: 'req_a', kind: 'project', role: 'editor', name: 'Sam' });
  assert.equal(requestOf(msg('b')), null);
  assert.equal(requestOf(msg('c', { data: { kind: 'access-request' } })), null, 'no request id: nothing to answer');
  assert.equal(requestOf(msg('d', { data: { kind: 'access-request', requestId: 'r', requestKind: 'join', email: 'kim@x.org' } }))?.name, 'kim@x.org', 'the address when there is no name');
});

test('answerText gives each outcome its sentence', () => {
  assert.equal(answerText({ kind: 'done', verb: 'approve', role: 'manager' }), 'Approved as Manager.');
  assert.equal(answerText({ kind: 'done', verb: 'decline' }), 'Declined.');
  assert.equal(answerText({ kind: 'already', status: 'approved', by: 'Priya', role: 'editor' }), 'Priya already approved this as Editor.');
  assert.equal(answerText({ kind: 'already', status: 'declined', by: 'Priya' }), 'Priya already declined this.');
  assert.equal(answerText({ kind: 'already', status: 'withdrawn' }), 'This request was withdrawn.');
  assert.equal(answerText({ kind: 'already', status: 'expired' }), 'This request has ended.');
  assert.equal(answerText({ kind: 'already', status: 'approved' }), 'This request has ended.', 'no approver to name');
  assert.equal(answerText({ kind: 'forbidden' }), 'You can no longer answer this request.');
  assert.equal(answerText({ kind: 'ended' }), 'This request has ended.');
  assert.equal(answerText({ kind: 'failed' }), 'Could not answer the request. Try again.');
});

// ── answerAccessRequest ─────────────────────────────────────────────────────

test('answerAccessRequest posts the role to approve and nothing to decline', async () => {
  await reset();
  router = () => json({ request: { status: 'approved', answerRole: 'manager', answeredBy: { name: 'Me' } }, outcome: 'added' });
  assert.deepEqual(await answerAccessRequest('req 1', { verb: 'approve', role: 'editor' }), { kind: 'done', verb: 'approve', role: 'manager' }, 'the role the instance recorded');
  assert.equal(calls.at(-1)!.url, '/api/v1/access-requests/req%201/approve');
  assert.deepEqual(calls.at(-1)!.body, { role: 'editor' });
  router = () => json({ outcome: 'added' });
  assert.deepEqual(await answerAccessRequest('r', { verb: 'approve', role: 'viewer' }), { kind: 'done', verb: 'approve', role: 'viewer' }, 'else the role asked for');
  router = () => json({ request: { status: 'declined' } });
  assert.deepEqual(await answerAccessRequest('r', { verb: 'decline' }), { kind: 'done', verb: 'decline' });
  assert.equal(calls.at(-1)!.url, '/api/v1/access-requests/r/decline');
  assert.deepEqual(calls.at(-1)!.body, {});
});

test('answerAccessRequest reads every refusal', async () => {
  await reset();
  const cases: Array<[Response | (() => never), unknown]> = [
    [json({ error: { code: 'ALREADY_ANSWERED' }, request: { status: 'approved', answeredBy: { name: 'Priya' }, answerRole: 'editor' } }, 409), { kind: 'already', status: 'approved', by: 'Priya', role: 'editor' }],
    [json({ error: { code: 'ALREADY_ANSWERED' }, request: { status: 'withdrawn', answeredBy: null, answerRole: null } }, 409), { kind: 'already', status: 'withdrawn' }],
    [json({ error: { code: 'PROJECT_ARCHIVED' } }, 409), { kind: 'ended' }],
    [json({ error: { code: 'NOT_FOUND' } }, 404), { kind: 'ended' }],
    [json({ error: { code: 'FORBIDDEN' } }, 403), { kind: 'forbidden' }],
    [new Response('nope', { status: 500 }), { kind: 'failed' }],
    [() => { throw new TypeError('offline'); }, { kind: 'failed' }],
  ];
  for (const [answer, want] of cases) {
    router = typeof answer === 'function' ? answer : () => answer;
    assert.deepEqual(await answerAccessRequest('r', { verb: 'approve', role: 'editor' }), want);
  }
});

// ── The dialog ───────────────────────────────────────────────────────────────

test('the dialog lists every message newest first, with instance text kept inert', async () => {
  const now = Date.now();
  await reset([
    msg('older', { title: 'Older', data: { at: new Date(now - 3 * 86_400_000).toISOString() } }),
    msg('newer', { title: '<img src=x onerror=alert(1)>', body: 'sam@acme.com · GitHub · “<script>alert(1)</script><b>text</b>”', data: { at: new Date(now - 2 * 3_600_000).toISOString() }, cta: { label: 'Open', url: '/#/team/project/prj_9' } }),
    msg('unsafe', { title: 'Unsafe link', cta: { label: 'Go', url: 'javascript:alert(1)' } }),
    msg('fixed', { title: 'Policy', dismissible: false }),
  ]);
  openInboxSheet({ workspace: 'lolly.ing' });
  const dlg = sheet()!;
  assert.ok(dlg, 'the dialog is open');
  assert.equal(dlg.querySelector('h2')?.textContent, 'Inbox');
  assert.match(dlg.textContent ?? '', /Messages from lolly\.ing/);
  assert.equal(document.activeElement, dlg.querySelector('h2'), 'focus starts on the heading');
  assert.equal(dlg.getAttribute('aria-labelledby'), dlg.querySelector('h2')?.id);
  assert.deepEqual(rowsIds(), ['newer', 'older', 'unsafe', 'fixed']);
  const newer = row('newer');
  assert.equal(newer.querySelector('strong')?.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(newer.querySelector('img, b, script'), null, 'no markup from the instance');
  assert.equal(newer.querySelector('p')?.textContent, 'sam@acme.com · GitHub · “<script>alert(1)</script><b>text</b>”', 'a note reads as typed');
  assert.equal(newer.querySelector('time')?.textContent, '2h ago');
  const open = newer.querySelector<HTMLAnchorElement>('a[data-act="inbox-open"]')!;
  assert.equal(open.textContent, 'Open');
  assert.equal(open.getAttribute('href'), '/#/team/project/prj_9');
  assert.equal(row('unsafe').querySelector('a'), null, 'an unsafe link is dropped');
  assert.equal(row('fixed').querySelector('[data-act="inbox-dismiss"]'), null, 'no Dismiss for a message that cannot be dismissed');
  const close = dlg.querySelector<HTMLButtonElement>('[data-inbox-close]')!;
  assert.equal(close.getAttribute('aria-label'), 'Close');
  close.click();
  assert.equal(sheet(), null, 'closed');
});

test('Dismiss acks, removes the row and keeps focus in the list', async () => {
  await reset([msg('a', { data: { at: '2026-10-03T12:00:00Z' } }), msg('b', { data: { at: '2026-10-03T11:00:00Z' } })]);
  openInboxSheet();
  const dismiss = row('a').querySelector<HTMLButtonElement>('[data-act="inbox-dismiss"]')!;
  dismiss.focus();
  dismiss.click();
  await settle();
  assert.deepEqual(rowsIds(), ['b']);
  assert.ok(acked('a'));
  assert.deepEqual(inboxMessages().map((m) => m.id), ['b'], 'gone from the inbox too');
  assert.equal(document.activeElement, row('b').querySelector('[data-act="inbox-dismiss"]'), 'focus on the next row');
  row('b').querySelector<HTMLButtonElement>('[data-act="inbox-dismiss"]')!.click();
  await settle();
  assert.equal(sheet()!.querySelector('.projects-empty')?.textContent, 'No messages');
  assert.equal((sheet()!.querySelector('.projects-empty') as HTMLElement).hidden, false);
  assert.equal(document.activeElement, sheet()!.querySelector('h2'), 'then on the heading');
});

test('a project request is answered in place: role, Approve, then the outcome', async () => {
  await reset([projectRequest('r1')]);
  openInboxSheet({ roles: ['viewer', 'editor', 'manager'] });
  const li = row('r1');
  const select = li.querySelector<HTMLSelectElement>('select')!;
  const label = li.querySelector<HTMLLabelElement>(`label[for="${select.id}"]`);
  assert.equal(label?.textContent, 'Role for Sam');
  assert.equal(select.value, 'editor', 'the role asked for');
  assert.deepEqual([...select.options].map((o) => o.textContent), ['Viewer', 'Editor', 'Manager']);
  assert.equal(document.getElementById(select.getAttribute('aria-describedby')!)?.textContent, 'Viewers open and copy. Editors save changes. Managers also add people.');
  assert.equal(li.querySelector('a[data-act="inbox-open"]')?.textContent, 'Open');

  router = (url, init) => inboxRoute(url, init) ?? (url.endsWith('/approve') ? json({ request: { status: 'approved', answerRole: 'manager' }, outcome: 'added' }) : new Response('', { status: 404 }));
  select.value = 'manager';
  const approve = li.querySelector<HTMLButtonElement>('[data-act="inbox-approve"]')!;
  approve.focus();
  approve.click();
  await settle();
  const post = calls.find((c) => c.url.endsWith('/api/v1/access-requests/req_r1/approve'));
  assert.deepEqual(post?.body, { role: 'manager' });
  const result = li.querySelector<HTMLElement>('.inbox-sheet-result')!;
  assert.equal(result.textContent, 'Approved as Manager.');
  assert.equal(result.getAttribute('role'), 'status');
  assert.equal(li.querySelector('select, [data-act="inbox-approve"], [data-act="inbox-decline"], [data-act="inbox-dismiss"]'), null, 'the answer controls are gone');
  assert.ok(acked('r1'), 'the message is acked');
  assert.deepEqual(rowsIds(), ['r1'], 'the row stays, saying how the request ended');
  assert.equal(document.activeElement, result, 'focus moves to the outcome');
});

test('a request someone else answered says who, and how', async () => {
  await reset([projectRequest('r2')]);
  openInboxSheet();
  router = (url, init) => inboxRoute(url, init)
    ?? json({ error: { code: 'ALREADY_ANSWERED' }, request: { status: 'approved', answeredBy: { name: 'Priya' }, answerRole: 'editor' } }, 409);
  row('r2').querySelector<HTMLButtonElement>('[data-act="inbox-decline"]')!.click();
  await settle();
  assert.equal(row('r2').querySelector('.inbox-sheet-result')?.textContent, 'Priya already approved this as Editor.');
  assert.ok(acked('r2'));
});

test('a manager no longer allowed to answer is told so and keeps Dismiss', async () => {
  await reset([projectRequest('r3')]);
  openInboxSheet();
  router = (url, init) => inboxRoute(url, init) ?? json({ error: { code: 'FORBIDDEN' } }, 403);
  row('r3').querySelector<HTMLButtonElement>('[data-act="inbox-approve"]')!.click();
  await settle();
  const li = row('r3');
  assert.equal(li.querySelector('.inbox-sheet-result')?.textContent, 'You can no longer answer this request.');
  assert.equal(li.querySelector('[data-act="inbox-approve"]'), null);
  assert.ok(li.querySelector('[data-act="inbox-dismiss"]'), 'still the person\'s to clear');
  assert.equal(acked('r3'), false);
});

test('a failed answer keeps the controls for another try', async () => {
  await reset([projectRequest('r4')]);
  openInboxSheet();
  router = (url, init) => inboxRoute(url, init) ?? new Response('', { status: 502 });
  row('r4').querySelector<HTMLButtonElement>('[data-act="inbox-approve"]')!.click();
  await settle();
  const li = row('r4');
  assert.equal(li.querySelector('.inbox-sheet-result')?.textContent, 'Could not answer the request. Try again.');
  const approve = li.querySelector<HTMLButtonElement>('[data-act="inbox-approve"]')!;
  assert.equal(approve.disabled, false);
  assert.equal(li.getAttribute('aria-busy'), null);
  assert.equal(acked('r4'), false);
});

test('a join request is answered in the console', async () => {
  await reset([msg('j1', {
    kind: 'request', severity: 'action', title: 'Kim asks to join lolly.ing',
    cta: { label: 'Review', url: 'https://lolly.ing/admin#/users' },
    data: { kind: 'access-request', requestId: 'req_j1', requestKind: 'join' },
  })]);
  openInboxSheet();
  const li = row('j1');
  assert.equal(li.querySelector('[data-act="inbox-approve"], select'), null);
  const link = li.querySelector<HTMLAnchorElement>('a[data-act="inbox-open"]')!;
  assert.equal(link.textContent, 'Answer in the console');
  assert.equal(link.getAttribute('href'), 'https://lolly.ing/admin#/users');
});

test('the list follows the inbox while the dialog is open', async () => {
  await reset([msg('a', { data: { at: '2026-10-02T00:00:00Z' } })]);
  openInboxSheet();
  inboxList = [msg('a', { data: { at: '2026-10-02T00:00:00Z' } }), msg('new', { title: 'Welcome', data: { at: '2026-10-03T00:00:00Z' } })];
  await refreshInbox({ force: true });
  assert.deepEqual(rowsIds(), ['new', 'a'], 'a new message joins at the top');
  inboxList = [msg('new', { title: 'Welcome', data: { at: '2026-10-03T00:00:00Z' } })];
  await refreshInbox({ force: true });
  assert.deepEqual(rowsIds(), ['new'], 'one retired by the instance leaves');
});

test('opening the dialog again keeps the one dialog', async () => {
  await reset([msg('a')]);
  openInboxSheet();
  (sheet()!.querySelector('[data-act="inbox-dismiss"]') as HTMLElement).focus();
  openInboxSheet();
  assert.equal(document.querySelectorAll('dialog.inbox-sheet').length, 1);
  assert.equal(document.activeElement, sheet()!.querySelector('h2'));
});

test('a load that fails says so and offers Try again', async () => {
  _resetInboxSheetForTests();
  _resetBannerForTests();
  calls.length = 0;
  router = () => new Response('', { status: 503 });
  openInboxSheet();
  assert.equal(sheet()!.querySelector('.projects-empty')?.textContent, 'Loading…');
  await settle();
  const note = sheet()!.querySelector('[role="alert"]');
  assert.equal(note?.textContent, 'Could not load your messages. Try again.');
  inboxList = [msg('back')];
  router = (url, init) => inboxRoute(url, init) ?? new Response('', { status: 404 });
  sheet()!.querySelector<HTMLButtonElement>('[data-act="inbox-retry"]')!.click();
  await settle();
  assert.deepEqual(rowsIds(), ['back']);
  assert.equal(document.activeElement, sheet()!.querySelector('h2'));
  _resetInboxSheetForTests();
});
