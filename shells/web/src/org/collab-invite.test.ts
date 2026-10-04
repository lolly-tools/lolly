// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-invite.ts - "Invite to edit now" for a live work collab.
 *
 * Pins, in order: the wire readers (what the invitees answer may and may not contain,
 * and which status means which refusal); the two requests as the instance documents
 * them; the dialog (load, search with only the newest answer drawn, invite, refusals,
 * the subtitle and the viewer case, names as text); who is offered the button; the
 * presence pill's provider; and the Share dialog's "Work collab" row, which offers the
 * button while live and once a start from the row succeeds.
 *
 * jsdom with a shimmed <dialog> (the surface components/modal.ts touches), a
 * reassignable fetch router that records POST bodies, and a real initOrg() pass for
 * the Share row's own `collab.join` gate, as org/collab-share.test.ts does.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/org/collab-invite.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/#/tool/qr-code', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
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
let requests: { url: string; method: string; body?: unknown }[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = (init?.method || 'GET').toUpperCase();
  let body: unknown;
  if (init?.body) { try { body = JSON.parse(String(init.body)); } catch { body = init.body; } }
  requests.push({ url, method, ...(body !== undefined ? { body } : {}) });
  return router(url, init);
}) as typeof fetch;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const {
  readInvitees, inviteFailureFor, inviteFailureMessage, fetchInvitees, sendCollabInvite,
  openCollabInviteDialog, buildInviteToEditButton, registerWorkCollabPillInvite, MAX_QUERY_CHARS,
} = await import('./collab-invite.ts');
type InviteeList = import('./collab-invite.ts').InviteeList;
const { buildWorkCollabShareSection, _clearCollabStartsForTests } = await import('./collab-share.ts');
const { initOrg, _resetOrgForTests } = await import('./index.ts');
const { registerCollabOpener, _clearCollabOpenersForTests } = await import('../lib/collab-launch.ts');
type CollabLaunchOutcome = import('../lib/collab-launch.ts').CollabLaunchOutcome;
const { registerWorkCollabPolicy, _clearWorkCollabPolicyForTests } = await import('../lib/collab-availability.ts');
const { collabPillInviteFor, _clearCollabPillInviteForTests } = await import('../lib/collab-pill-invite.ts');
const { adoptTeamSessionOrigin, noteTeamSessionLive, _clearTeamSessionOriginForTests } = await import('./team-session-origin.ts');

const PEOPLE = [{ id: 'u2', name: 'Priya Shah' }, { id: 'u3', name: 'Sam Lee' }];

function reset(): void {
  _resetOrgForTests();
  _clearCollabOpenersForTests();
  _clearCollabStartsForTests();
  _clearWorkCollabPolicyForTests();
  _clearCollabPillInviteForTests();
  _clearTeamSessionOriginForTests();
  store.clear();
  requests = [];
  router = () => new Response('', { status: 404 });
  for (const d of document.querySelectorAll('dialog')) d.remove();
}

/** The instance's two collab routes, answering as configured. */
function serving(opts: { invitees?: unknown; status?: number; post?: number } = {}): void {
  router = (url, init) => {
    if (url.includes('/api/v1/collab/invitees')) return json(opts.invitees ?? { invitees: PEOPLE, truncated: false }, opts.status ?? 200);
    if (url.includes('/api/v1/collab/invites') && (init?.method || '').toUpperCase() === 'POST') {
      const status = opts.post ?? 201;
      return status === 201 ? json({ messageId: 'msg_collab_x' }, 201) : json({ error: { code: 'X', message: 'no' } }, status);
    }
    return new Response('', { status: 404 });
  };
}

/** A work collab this member could start: a 'work' opener plus the collab.edit policy. */
function workCollabAllowed(): void {
  registerCollabOpener('work', () => {});
  registerWorkCollabPolicy(() => true);
}

const dialogEl = (): HTMLDialogElement | null => document.querySelector('dialog.collab-invite-dialog');
const rows = (dlg: Element): string[] => [...dlg.querySelectorAll('[data-invitee-id]')].map((r) => r.getAttribute('data-invitee-id')!);
const typeInto = (dlg: Element, value: string): void => {
  const search = dlg.querySelector<HTMLInputElement>('[data-invite-search]')!;
  search.value = value;
  search.dispatchEvent(new dom.window.Event('input'));
};

// ── Wire readers ──────────────────────────────────────────────────────────────

test('readInvitees: keeps id and name, drops rows without an id, de-duplicates, reads truncated', () => {
  const got = readInvitees({
    invitees: [{ id: 'u2', name: ' Priya ' }, { id: '', name: 'Nobody' }, null, { id: 'u3' }, { id: 'u2', name: 'Again' }],
    truncated: true,
  });
  assert.deepEqual(got, { ok: true, invitees: [{ id: 'u2', name: 'Priya' }, { id: 'u3', name: 'u3' }], truncated: true });
  assert.deepEqual(readInvitees({ invitees: [] }), { ok: true, invitees: [], truncated: false });
});

test('readInvitees: anything but the documented shape is a failed load, never an empty list', () => {
  for (const body of [null, {}, { invitees: 'u2' }, [], 'x']) assert.deepEqual(readInvitees(body), { ok: false });
});

test('inviteFailureFor: each refusal the route gives has its own sentence', () => {
  assert.equal(inviteFailureFor(400), 'not-eligible');
  assert.equal(inviteFailureFor(401), 'signed-out');
  assert.equal(inviteFailureFor(403), 'forbidden');
  assert.equal(inviteFailureFor(410), 'gone');
  assert.equal(inviteFailureFor(404), 'failed');
  assert.equal(inviteFailureFor(500), 'failed');
  assert.equal(inviteFailureMessage('not-eligible', "O'Brien"), "O'Brien cannot open this session any more.", 'a name is text, not escaped markup');
  assert.equal(inviteFailureMessage('gone', 'x'), 'This session was deleted.');
  assert.equal(inviteFailureMessage('failed', 'x'), 'Could not send the invite. Try again.');
});

// ── The two requests ──────────────────────────────────────────────────────────

test('fetchInvitees asks for the session, trims and bounds the query, and reads the answer', async () => {
  reset();
  serving();
  const got = await fetchInvitees('ses 1', '  pri  ');
  const url = new URL(requests[0]!.url, 'https://instance.test');
  assert.equal(url.pathname, '/api/v1/collab/invitees');
  assert.equal(url.searchParams.get('sessionId'), 'ses 1');
  assert.equal(url.searchParams.get('q'), 'pri');
  assert.deepEqual(got, { ok: true, invitees: PEOPLE, truncated: false });

  requests = [];
  await fetchInvitees('ses_1', 'x'.repeat(200));
  assert.equal(new URL(requests[0]!.url, 'https://instance.test').searchParams.get('q')!.length, MAX_QUERY_CHARS);
  requests = [];
  await fetchInvitees('ses_1');
  assert.equal(new URL(requests[0]!.url, 'https://instance.test').searchParams.has('q'), false, 'an empty query is left off');
});

test('fetchInvitees: a refusal or no answer is a failed load', async () => {
  reset();
  serving({ status: 403, invitees: { error: { code: 'FORBIDDEN' } } });
  assert.deepEqual(await fetchInvitees('ses_1'), { ok: false });
  router = () => { throw new Error('offline'); };
  assert.deepEqual(await fetchInvitees('ses_1'), { ok: false });
});

test('sendCollabInvite posts the session and the person, and reads the status', async () => {
  reset();
  serving();
  assert.deepEqual(await sendCollabInvite('ses_1', 'u2'), { ok: true });
  assert.deepEqual(requests[0], {
    url: '/api/v1/collab/invites', method: 'POST', body: { sessionId: 'ses_1', userId: 'u2' },
  });
  serving({ post: 400 });
  assert.deepEqual(await sendCollabInvite('ses_1', 'u2'), { ok: false, reason: 'not-eligible' });
  serving({ post: 410 });
  assert.deepEqual(await sendCollabInvite('ses_1', 'u2'), { ok: false, reason: 'gone' });
  router = () => { throw new Error('offline'); };
  assert.deepEqual(await sendCollabInvite('ses_1', 'u2'), { ok: false, reason: 'failed' });
});

// ── The dialog ────────────────────────────────────────────────────────────────

test('the dialog lists the people the instance offers, with plans/75 copy', async () => {
  reset();
  serving();
  openCollabInviteDialog({ sessionId: 'ses_1' }, { debounceMs: 0 });
  const dlg = dialogEl()!;
  assert.ok(dlg, 'mounted');
  assert.equal(dlg.getAttribute('aria-label'), 'Invite to edit now');
  assert.match(dlg.textContent ?? '', /Invite to edit now/);
  assert.match(dlg.textContent ?? '', /Type a name/);
  assert.equal(dlg.querySelector<HTMLElement>('[data-invitees-note]')!.textContent, 'Loading…', 'says so while it loads');
  await tick();
  assert.deepEqual(rows(dlg), ['u2', 'u3']);
  const first = dlg.querySelector<HTMLButtonElement>('[data-invitee-id="u2"] [data-act="invite"]')!;
  assert.equal(first.textContent, 'Invite');
  assert.equal(first.getAttribute('aria-label'), 'Invite Priya Shah', 'each Invite says who it is for');
  assert.equal(dlg.querySelector<HTMLElement>('[data-invitees-note]')!.hidden, true);
  assert.equal(dlg.querySelector('[data-invite-project]')!.hasAttribute('hidden'), true, 'no project, no subtitle');
});

test('a name is text: markup in a display name never becomes an element', async () => {
  reset();
  serving({ invitees: { invitees: [{ id: 'u9', name: '<img src=x onerror="alert(1)">' }] } });
  openCollabInviteDialog({ sessionId: 'ses_1' }, { debounceMs: 0 });
  await tick();
  const dlg = dialogEl()!;
  assert.equal(dlg.querySelector('img'), null);
  assert.match(dlg.querySelector('[data-invitee-id="u9"]')!.textContent ?? '', /<img src=x/);
});

test('Invite sends one invite, then the row reads Invited and the line says what happens next', async () => {
  reset();
  serving();
  openCollabInviteDialog({ sessionId: 'ses_1' }, { debounceMs: 0 });
  await tick();
  const dlg = dialogEl()!;
  const btn = dlg.querySelector<HTMLButtonElement>('[data-invitee-id="u2"] [data-act="invite"]')!;
  btn.click();
  assert.equal(btn.disabled, true);
  assert.equal(btn.textContent, 'Sending…');
  btn.click(); // a second press while sending is ignored
  await tick();
  const posts = requests.filter((r) => r.method === 'POST');
  assert.deepEqual(posts.map((r) => r.body), [{ sessionId: 'ses_1', userId: 'u2' }]);
  assert.equal(btn.textContent, 'Invited');
  assert.equal(btn.disabled, true);
  const status = dlg.querySelector<HTMLElement>('[data-invite-status]')!;
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, 'Sent. Priya Shah gets a message in the inbox.');

  // A new search draws the rows again, and the person invited still reads Invited.
  typeInto(dlg, 'p');
  await tick(); await tick();
  const again = dlg.querySelector<HTMLButtonElement>('[data-invitee-id="u2"] [data-act="invite"]')!;
  assert.equal(again.textContent, 'Invited');
  assert.equal(again.disabled, true);
});

test('a search that redraws the list while an invite is on its way keeps the row from a second press', async () => {
  reset();
  serving();
  let answer: (r: { ok: true }) => void = () => {};
  const sendStub = (): Promise<{ ok: true }> => new Promise((resolve) => { answer = resolve; });
  openCollabInviteDialog({ sessionId: 'ses_1' }, { debounceMs: 0, sendInvite: sendStub });
  await tick();
  const dlg = dialogEl()!;
  dlg.querySelector<HTMLButtonElement>('[data-invitee-id="u2"] [data-act="invite"]')!.click();
  typeInto(dlg, 'pr');
  await tick(); await tick();
  const redrawn = dlg.querySelector<HTMLButtonElement>('[data-invitee-id="u2"] [data-act="invite"]')!;
  assert.equal(redrawn.textContent, 'Sending…');
  assert.equal(redrawn.disabled, true);
  answer({ ok: true });
  await tick();
  assert.equal(redrawn.textContent, 'Invited', 'the row on screen shows the answer');
});

test('a refused invite shows why under the list and lets the person try again', async () => {
  reset();
  serving({ post: 403 });
  openCollabInviteDialog({ sessionId: 'ses_1' }, { debounceMs: 0 });
  await tick();
  const dlg = dialogEl()!;
  const btn = dlg.querySelector<HTMLButtonElement>('[data-invitee-id="u3"] [data-act="invite"]')!;
  btn.click();
  await tick();
  assert.equal(btn.disabled, false);
  assert.equal(btn.textContent, 'Invite');
  const status = dlg.querySelector<HTMLElement>('[data-invite-status]')!;
  assert.equal(status.textContent, 'Only people who can edit this session can invite others.');
  assert.match(status.style.color, /destructive/);
});

test('typing asks the instance again, and only the newest answer is drawn', async () => {
  reset();
  const pending: Array<{ q: string; resolve: (v: InviteeList) => void }> = [];
  const fetchStub = (_sessionId: string, q = ''): Promise<InviteeList> =>
    new Promise((resolve) => { pending.push({ q, resolve }); });
  openCollabInviteDialog({ sessionId: 'ses_1' }, { debounceMs: 0, fetchInvitees: fetchStub });
  const dlg = dialogEl()!;
  typeInto(dlg, 'pr');
  await tick();
  typeInto(dlg, 'sa');
  await tick();
  assert.deepEqual(pending.map((p) => p.q), ['', 'pr', 'sa']);
  pending[2]!.resolve({ ok: true, invitees: [PEOPLE[1]!], truncated: false });
  await tick();
  pending[1]!.resolve({ ok: true, invitees: [PEOPLE[0]!], truncated: false });
  pending[0]!.resolve({ ok: true, invitees: PEOPLE, truncated: false });
  await tick();
  assert.deepEqual(rows(dlg), ['u3'], 'an older answer arriving last does not replace the newest');
});

test('the list says when nobody can join, when nothing matches, and when the cap cut it', async () => {
  reset();
  let answer: unknown = { invitees: [], truncated: false };
  router = (url) => (url.includes('/collab/invitees') ? json(answer) : new Response('', { status: 404 }));
  openCollabInviteDialog({ sessionId: 'ses_1' }, { debounceMs: 0 });
  await tick();
  const dlg = dialogEl()!;
  const note = dlg.querySelector<HTMLElement>('[data-invitees-note]')!;
  assert.equal(note.textContent, 'No one else on this project can join this session yet.');
  typeInto(dlg, 'zz');
  await tick(); await tick();
  assert.equal(note.textContent, 'No matches.');
  answer = { invitees: PEOPLE, truncated: true };
  typeInto(dlg, '');
  await tick(); await tick();
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, 'Keep typing to find more people.');
});

test('a failed load offers Try again, which loads the list again', async () => {
  reset();
  serving({ status: 500, invitees: {} });
  openCollabInviteDialog({ sessionId: 'ses_1' }, { debounceMs: 0 });
  await tick();
  const dlg = dialogEl()!;
  assert.equal(dlg.querySelector<HTMLElement>('[data-invitees-note]')!.textContent, 'Could not load the people on this project. Try again.');
  const retry = dlg.querySelector<HTMLButtonElement>('[data-act="retry-invitees"]')!;
  assert.equal(retry.hidden, false);
  serving();
  retry.click();
  await tick();
  assert.deepEqual(rows(dlg), ['u2', 'u3']);
  assert.equal(retry.hidden, true);
});

test('with a project: the subtitle gives its name, and a viewer is told why there is no list', async () => {
  reset();
  serving();
  openCollabInviteDialog({ sessionId: 'ses_1', projectId: 'p1' }, {
    debounceMs: 0,
    listProjects: async () => [{ id: 'p0', name: 'Other' }, { id: 'p1', name: 'Brand <refresh>', myRole: 'editor' }],
  });
  await tick();
  const dlg = dialogEl()!;
  const subtitle = dlg.querySelector<HTMLElement>('[data-invite-project]')!;
  assert.equal(subtitle.hidden, false);
  assert.equal(subtitle.textContent, 'People on Brand <refresh>');
  assert.deepEqual(rows(dlg), ['u2', 'u3']);

  reset();
  serving();
  openCollabInviteDialog({ sessionId: 'ses_1', projectId: 'p1' }, {
    debounceMs: 0,
    listProjects: async () => [{ id: 'p1', name: 'Brand refresh', myRole: 'viewer' }],
  });
  await tick(); await tick();
  const view = dialogEl()!;
  assert.deepEqual(rows(view), [], 'no list a viewer could only be refused on');
  assert.equal(view.querySelector<HTMLInputElement>('[data-invite-search]')!.disabled, true);
  assert.equal(view.querySelector<HTMLElement>('[data-invitees-note]')!.textContent, 'Only people who can edit this session can invite others.');
});

test('Close closes the dialog', async () => {
  reset();
  serving();
  openCollabInviteDialog({ sessionId: 'ses_1' }, { debounceMs: 0 });
  dialogEl()!.querySelector<HTMLButtonElement>('[data-act="close"]')!.click();
  assert.equal(dialogEl(), null);
});

// ── Who is offered the button ─────────────────────────────────────────────────

test('the button needs a work opener and the collab.edit policy, and checks again at the press', async () => {
  reset();
  serving();
  assert.equal(buildInviteToEditButton('qr-code', { sessionId: 'ses_1' }), null, 'no opener, no policy');
  registerCollabOpener('work', () => {});
  assert.equal(buildInviteToEditButton('qr-code', { sessionId: 'ses_1' }), null, 'collab.edit not granted');
  let allowed = true;
  registerWorkCollabPolicy(() => allowed);
  assert.equal(buildInviteToEditButton('qr-code', { sessionId: '' }), null, 'no session, nothing to invite to');
  const btn = buildInviteToEditButton('qr-code', { sessionId: 'ses_1', projectId: 'p1' }, { debounceMs: 0, listProjects: async () => [] })!;
  assert.ok(btn);
  assert.equal(btn.textContent, 'Invite to edit now');
  assert.equal(btn.dataset.act, 'invite-to-collab');

  allowed = false;
  btn.click();
  assert.equal(dialogEl(), null, 'the grant went away while the section was open');
  allowed = true;
  btn.click();
  assert.ok(dialogEl(), 'the press opens the dialog');
  await tick();
  assert.match(requests[0]!.url, /sessionId=ses_1/);
});

// ── The presence pill ─────────────────────────────────────────────────────────

test('the pill gets an invite for a team session this member may invite to, and none otherwise', async () => {
  reset();
  serving();
  const off = registerWorkCollabPillInvite({ debounceMs: 0, listProjects: async () => [] });
  let role: 'writer' | 'observer' = 'writer';
  const ctx = { toolId: 'qr-code', role: () => role };

  assert.equal(collabPillInviteFor(ctx), null, 'no work opener or policy: no button');
  workCollabAllowed();
  assert.equal(collabPillInviteFor(ctx), null, 'no team origin: a private collab, or a local session');
  adoptTeamSessionOrigin({ sessionId: 'ses_7', toolId: 'qr-code', projectId: 'p1' });
  assert.equal(collabPillInviteFor({ ...ctx, toolId: 'barcode' }), null, 'the origin answers only for its own tool');
  role = 'observer';
  assert.equal(collabPillInviteFor(ctx), null, 'an observer is not offered an invite to edit');
  role = 'writer';
  const invite = collabPillInviteFor(ctx);
  assert.equal(typeof invite, 'function');

  role = 'observer';
  invite!();
  assert.equal(dialogEl(), null, 'checked again at the press');
  role = 'writer';
  invite!();
  assert.ok(dialogEl(), 'the press opens the dialog');
  await tick();
  assert.match(requests[0]!.url, /sessionId=ses_7/);

  off();
  assert.equal(collabPillInviteFor(ctx), null, 'unregistered');
});

// ── The Share dialog's "Work collab" row ─────────────────────────────────────

async function memberWithCan(can: Record<string, boolean>): Promise<void> {
  router = (url, init) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', role: 'member' } });
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, inboxUnread: 0, can });
    if (url.includes('/api/v1/collab/invitees')) return json({ invitees: PEOPLE, truncated: false });
    if (url.includes('/api/v1/collab/invites') && (init?.method || '').toUpperCase() === 'POST') return json({}, 201);
    return new Response('', { status: 404 });
  };
  await initOrg();
}

const shareCtx = { toolId: 'qr-code', baseParts: [], copy: async () => {}, document: () => ({ inputs: {} }) };

test('Share row, live: the member who may invite gets Invite to edit now under the live note', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  registerCollabOpener('work', () => {});
  adoptTeamSessionOrigin({ sessionId: 'ses_1', toolId: 'qr-code' });
  const leave = noteTeamSessionLive('ses_1');

  const without = buildWorkCollabShareSection(shareCtx)!;
  assert.match(without.textContent ?? '', /You are in a live collab on this session\./);
  assert.equal(without.querySelector('[data-act="invite-to-collab"]'), null, 'no collab.edit, no invite');

  registerWorkCollabPolicy(() => true);
  const section = buildWorkCollabShareSection(shareCtx)!;
  const invite = section.querySelector<HTMLButtonElement>('[data-act="invite-to-collab"]')!;
  assert.ok(invite);
  assert.equal(section.querySelector('[data-act="start-work-collab"]'), null, 'still no second start');
  invite.click();
  assert.ok(dialogEl());
  await tick();
  assert.ok(requests.some((r) => r.url.includes('/api/v1/collab/invitees?sessionId=ses_1')));
  leave();
});

test('Share row: a start that worked becomes Invite to edit now for the same session; a failed one keeps Start', async () => {
  reset();
  await memberWithCan({ 'collab.join': true, 'collab.edit': true });
  const answers: Array<(o: CollabLaunchOutcome) => void> = [];
  registerCollabOpener('work', (c) => { answers.push(c.onOutcome!); });
  registerWorkCollabPolicy(() => true);
  adoptTeamSessionOrigin({ sessionId: 'ses_4', toolId: 'qr-code', projectId: 'p1' });
  const section = buildWorkCollabShareSection(shareCtx)!;
  const start = (): void => { section.querySelector<HTMLButtonElement>('[data-act="start-work-collab"]')!.click(); };

  start();
  answers[0]!({ ok: false, message: 'The collab did not answer in time.' });
  assert.ok(section.querySelector('[data-act="start-work-collab"]'), 'a failed start keeps Start');
  assert.equal(section.querySelector('[data-act="invite-to-collab"]'), null);

  start();
  // The remount that follows a start releases the origin the press read, so the
  // invite uses the session the press started on.
  _clearTeamSessionOriginForTests();
  answers[1]!({ ok: true });
  assert.equal(section.querySelector('[data-act="start-work-collab"]'), null, 'Start is replaced');
  const invite = section.querySelector<HTMLButtonElement>('[data-act="invite-to-collab"]')!;
  assert.ok(invite, 'by the invite');
  assert.match(section.textContent ?? '', /You are in a live collab on this session\./);
  invite.click();
  await tick();
  assert.ok(requests.some((r) => r.url.includes('/api/v1/collab/invitees?sessionId=ses_4')));
});

test('Share row: a start that worked for a member who may not invite leaves the row as it was', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  const answers: Array<(o: CollabLaunchOutcome) => void> = [];
  registerCollabOpener('work', (c) => { answers.push(c.onOutcome!); });
  adoptTeamSessionOrigin({ sessionId: 'ses_4', toolId: 'qr-code' });
  const section = buildWorkCollabShareSection(shareCtx)!;
  section.querySelector<HTMLButtonElement>('[data-act="start-work-collab"]')!.click();
  answers[0]!({ ok: true });
  assert.ok(section.querySelector('[data-act="start-work-collab"]'));
  assert.equal(section.querySelector('[data-act="invite-to-collab"]'), null);
});
