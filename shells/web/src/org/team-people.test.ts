// SPDX-License-Identifier: MPL-2.0
/**
 * org/project-members.ts and org/team-people.ts - "People with access" for a team
 * project (plan 74 scope change).
 *
 * The adapter is proved against a stubbed fetch: the members list (with and without
 * the manager-only fields), invite results and the link, a role change, removal,
 * revoking an invitation, and each failure keeping its status. The panel is then
 * mounted in jsdom: a manager gets role selects, Remove, pending invitations and the
 * invite form with per-address results and a copyable link; a viewer gets the list
 * only, plus Leave on their own row (`isMe`). A refusal keeps the instance's error
 * code beside the status, and the codes that share a status get their own sentence.
 *
 * plans/75 additions: each waiting invitation's own link, end day, Opened and inviter,
 * with Copy link, Copy message and New link, and Invite again for an expired one; the
 * people asking for access, answered with Approve (with a role) or Decline, and the
 * sentences when someone answered first; the password tick and the message to send
 * for each address; Ask to edit for a viewer.
 *
 * Run directly:  node --test shells/web/src/org/team-people.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/#/p', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.Element = dom.window.Element as unknown as typeof Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
const calls: Array<{ url: string; method: string; body: unknown }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  calls.push({ url: String(input), method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
  return router(String(input), init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const {
  listProjectPeople, inviteToProject, changeMemberRole, removeMember, revokeInvitation, teamProjectLinkUrl, teamProjectFileLinkUrl, peopleFromBody, personalInviteLink, renameTeamProject, renameTeamSession, deleteTeamSession,
  rotateInvitationLink, reinvite, answerRequest, signInProviderNames,
} = await import('./project-members.ts');
const { buildPeoplePanel, peoplePanelView, revealPeoplePanel, roleChoices } = await import('./team-people.ts');
const { invitePolicy } = await import('./team-access.ts');

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 8; i++) await tick(); }
const reset = (): void => { calls.length = 0; router = () => new Response('', { status: 404 }); document.body.replaceChildren(); };

const MANAGER_LIST = {
  myRole: 'manager',
  members: [
    { userId: 'u1', name: 'Ana', email: 'ana@acme.com', role: 'owner', addedAt: '2026-10-01' },
    { userId: 'u2', name: 'Bo', email: 'bo@acme.com', role: 'editor', addedAt: '2026-10-01' },
    { userId: 'bad', role: 'admin' },
  ],
  invitations: [{ id: 'i1', email: 'cy@acme.com', role: 'viewer', createdAt: '2026-10-01', expiresAt: '2026-10-31' }],
};

// ── Adapter ──────────────────────────────────────────────────────────────────

test('listProjectPeople maps the list and drops rows it cannot use', async () => {
  reset();
  router = (url) => url === '/api/v1/projects/p1/members' ? json(MANAGER_LIST) : new Response('', { status: 404 });
  const got = await listProjectPeople('p1');
  assert.ok(got.ok);
  assert.equal(got.data.myRole, 'manager');
  assert.deepEqual(got.data.members.map((m) => [m.userId, m.role, m.email]), [['u1', 'owner', 'ana@acme.com'], ['u2', 'editor', 'bo@acme.com']]);
  assert.deepEqual(got.data.invitations, [{ id: 'i1', email: 'cy@acme.com', role: 'viewer', status: 'pending', passwordSetup: false, createdAt: '2026-10-01', expiresAt: '2026-10-31' }]);
});

test('a viewer list carries no addresses and no invitations', () => {
  const people = peopleFromBody({ myRole: 'viewer', members: [{ userId: 'u1', name: 'Ana', role: 'owner' }] });
  assert.deepEqual(people, { myRole: 'viewer', members: [{ userId: 'u1', name: 'Ana', role: 'owner' }], invitations: [], requests: [] });
  assert.equal(peopleFromBody({ members: [] }), null, 'no role: not a members answer');
});

test('listProjectPeople keeps the status of a refusal or of no answer', async () => {
  reset();
  router = () => json({ error: { code: 'FORBIDDEN' } }, 403);
  assert.deepEqual(await listProjectPeople('p1'), { ok: false, status: 403, code: 'FORBIDDEN' }, 'the instance code rides beside the status');
  router = () => { throw new Error('offline'); };
  assert.deepEqual(await listProjectPeople('p1'), { ok: false, status: 0 });
  router = () => json({ nope: true });
  assert.deepEqual(await listProjectPeople('p1'), { ok: false, status: 0 });
});

test('inviteToProject posts the addresses and role, and reads each outcome and the link', async () => {
  reset();
  router = (url) => url === '/api/v1/projects/p1/invite'
    ? json({
      results: [
        { email: 'bo@acme.com', status: 'added' },
        { email: 'new@acme.com', status: 'invited' },
        { email: 'ana@acme.com', status: 'already' },
        { email: 'x@other.org', status: 'refused', reason: 'outside the allowed domains' },
        { email: 'odd@acme.com', status: 'weird' },
      ],
      link: 'https://work.acme.com/#/team/project/p1',
    })
    : new Response('', { status: 404 });
  const got = await inviteToProject('p1', ['bo@acme.com', 'new@acme.com'], 'editor');
  assert.deepEqual(calls.at(-1), { url: '/api/v1/projects/p1/invite', method: 'POST', body: { emails: ['bo@acme.com', 'new@acme.com'], role: 'editor' } });
  assert.ok(got.ok);
  assert.deepEqual(got.data.results.map((r) => r.status), ['added', 'invited', 'already', 'refused']);
  assert.equal(got.data.results[3]!.reason, 'outside the allowed domains');
  assert.equal(got.data.link, 'https://work.acme.com/#/team/project/p1');
});

test('an invite with no usable link falls back to this app address; an empty list is not sent', async () => {
  reset();
  router = () => json({ results: [], link: 'javascript:alert(1)' });
  const got = await inviteToProject('p 1', ['a@b.co'], 'viewer');
  assert.ok(got.ok);
  assert.equal(got.data.link, 'https://instance.test/#/team/project/p%201');
  assert.equal(teamProjectLinkUrl('p1', 'https://w.test/'), 'https://w.test/#/team/project/p1');
  assert.equal(teamProjectFileLinkUrl('p 1', 'fil_a&b', 'https://w.test/'), 'https://w.test/#/team/project/p%201?file=fil_a%26b');
  calls.length = 0;
  assert.deepEqual(await inviteToProject('p1', [], 'viewer'), { ok: false, status: 400 });
  assert.equal(calls.length, 0);
  router = () => json({ error: {} }, 403);
  assert.deepEqual(await inviteToProject('p1', ['a@b.co'], 'viewer'), { ok: false, status: 403 });
});

test('personal invitation links retain their recipient and never substitute the project URL', async () => {
  reset();
  const links = ['https://instance.test/l/invite/ana-token', 'https://instance.test/l/invite/bo-token'];
  router = url => url.endsWith('/members') ? json(MANAGER_LIST) : json({
    results: links.map((link, i) => ({ email: ['ana-new@acme.com', 'bo-new@acme.com'][i], status: 'invited', link, invitationId: `invite-${i}` })),
    link: 'https://instance.test/#/team/project/p1',
    message: { workspace: 'Event team', inviter: 'Ana', providers: ['Google'], note: 'Use your work address.' },
  });
  const copied: string[] = [];
  const panel = buildPeoplePanel({ projectId: 'p1', projectName: 'Launch event', policy: invitePolicy({ can: { 'user.invite': true }, invites: {} }), copy: async text => { copied.push(text); } });
  document.body.append(panel); await settle();
  panel.querySelector<HTMLTextAreaElement>('textarea')!.value = 'ana-new@acme.com bo-new@acme.com';
  panel.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); await settle();
  // Changing the next invite's role must not change the message for invitations already sent.
  panel.querySelector<HTMLSelectElement>('form select')!.value = 'viewer';
  const rows = [...panel.querySelectorAll<HTMLElement>('.team-people-results li')];
  assert.equal(rows.length, 2);
  for (const [i, row] of rows.entries()) {
    assert.equal(row.querySelector<HTMLInputElement>('input')!.value, links[i]);
    row.querySelector<HTMLElement>('[data-act="people-copy-invite"]')!.click(); await settle();
    assert.equal(copied.at(-1), links[i]);
    row.querySelector<HTMLElement>('[data-act="people-copy-message"]')!.click(); await settle();
    assert.match(copied.at(-1)!, /Launch event on Event team\. Your role: Editor\./);
    assert.ok(copied.at(-1)!.includes(links[i]!));
    assert.ok(!copied.at(-1)!.includes(links[1 - i]!));
    assert.ok(copied.at(-1)!.includes(`Sign in as ${i === 0 ? 'ana-new' : 'bo-new'}@acme.com with Google.`));
    assert.match(copied.at(-1)!, /Use your work address\./);
  }
  assert.equal(panel.querySelector<HTMLElement>('[data-act="people-copy-link"]')!.textContent, 'Copy project link');
});

test('expired invitations cannot be copied and unsafe personal links are discarded', () => {
  for (const link of ['javascript:alert(1)', 'https://instance.test/#/team/project/p1', 'https://user:password@instance.test/l/invite/token', 'https://instance.test/l/invite/<script>']) assert.equal(personalInviteLink(link), undefined);
  const got = peopleFromBody({ ...MANAGER_LIST, invitations: [
    { id: 'pending', email: 'pending@acme.com', role: 'editor', status: 'pending', link: 'https://instance.test/l/invite/pending' },
    { id: 'expired', email: 'expired@acme.com', role: 'viewer', status: 'expired', link: 'https://instance.test/l/invite/expired' },
  ] });
  assert.equal(got?.invitations[0]?.link, 'https://instance.test/l/invite/pending');
  assert.equal(got?.invitations[1]?.link, undefined);
});

test('password setup is an explicit invite option and is absent for existing-user-only inviters', async () => {
  reset(); router = url => url.endsWith('/members') ? json(MANAGER_LIST) : json({ results: [] });
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ can: { 'user.invite': true }, invites: { passwordSetup: true, passwordDomains: ['acme.com'] } }) });
  document.body.append(panel); await settle();
  const field = panel.querySelector<HTMLTextAreaElement>('textarea')!;
  field.value = 'new@acme.com'; field.dispatchEvent(new dom.window.Event('input'));
  assert.equal(panel.querySelector<HTMLInputElement>('[type="checkbox"]')?.checked, true);
  panel.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); await settle();
  assert.deepEqual(calls.find(c => c.method === 'POST')?.body, { emails: ['new@acme.com'], role: 'editor', passwordSetup: true });
  const memberPanel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ can: { 'user.invite': false }, invites: { passwordSetup: true } }) });
  document.body.append(memberPanel); await settle();
  assert.equal(memberPanel.querySelector('[type="checkbox"]'), null);
  assert.match(memberPanel.textContent!, /people who already use this instance/);
});

test('role change, removal and revoking use their routes and keep a refusal status', async () => {
  reset();
  router = (url, init) => {
    if (url === '/api/v1/projects/p1/members/u2' && init?.method === 'PATCH') return json({ userId: 'u2', name: 'Bo', role: 'manager' });
    if (url === '/api/v1/projects/p1/members/u2' && init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (url === '/api/v1/projects/p1/invitations/i1' && init?.method === 'DELETE') return new Response(null, { status: 204 });
    return json({ error: {} }, 403);
  };
  const changed = await changeMemberRole('p1', 'u2', 'manager');
  assert.ok(changed.ok);
  assert.equal(changed.data.role, 'manager');
  assert.deepEqual(calls.at(-1), { url: '/api/v1/projects/p1/members/u2', method: 'PATCH', body: { role: 'manager' } });
  assert.deepEqual(await removeMember('p1', 'u2'), { ok: true, data: null });
  assert.deepEqual(await revokeInvitation('p1', 'i1'), { ok: true, data: null });
  assert.deepEqual(await changeMemberRole('p1', 'u9', 'viewer'), { ok: false, status: 403 });
  assert.deepEqual(await removeMember('p1', 'u9'), { ok: false, status: 403 });
});

// ── Rendering decisions ──────────────────────────────────────────────────────

test('peoplePanelView: managers manage and invite, others read', () => {
  const policy = invitePolicy({ can: { 'user.invite': true }, invites: { projectRoles: ['viewer', 'editor'] } });
  const base = { members: [], invitations: [], requests: [] };
  assert.deepEqual(peoplePanelView({ ...base, myRole: 'manager' }, policy), { manage: true, invite: true, roles: ['viewer', 'editor'], askToEdit: false, transfer: false });
  assert.deepEqual(peoplePanelView({ ...base, myRole: 'editor' }, policy), { manage: false, invite: false, roles: ['viewer', 'editor'], askToEdit: false, transfer: false });
  const asks = invitePolicy({ invites: {}, requests: { project: true } });
  assert.equal(peoplePanelView({ ...base, myRole: 'viewer' }, asks).askToEdit, true, 'a viewer may ask to edit');
  assert.equal(peoplePanelView({ ...base, myRole: 'editor' }, asks).askToEdit, false, 'an editor already edits');
  assert.equal(peoplePanelView({ ...base, myRole: 'viewer' }, policy).askToEdit, false, 'an instance that takes no requests');
  assert.equal(peoplePanelView({ ...base, myRole: 'owner' }, invitePolicy({ invites: { projectRoles: [] } })).invite, false, 'no role to give: no form');
  assert.equal(peoplePanelView({ ...base, myRole: 'owner' }, null).invite, false);
  assert.deepEqual(roleChoices('manager', ['viewer', 'editor']), ['viewer', 'editor', 'manager'], 'the current role stays choosable');
});

// ── Panel ────────────────────────────────────────────────────────────────────

test('a manager sees roles to change, Remove, pending invitations and the invite form', async () => {
  reset();
  router = (url, init) => {
    if (url === '/api/v1/projects/p1/members') return json(MANAGER_LIST);
    if (url === '/api/v1/projects/p1/members/u2' && init?.method === 'PATCH') return json({ error: {} }, 403);
    if (url === '/api/v1/projects/p1/invite') {
      return json({
        results: [{ email: 'new@acme.com', status: 'invited' }, { email: 'x@other.org', status: 'refused', reason: 'domain-not-allowed' }],
        link: 'https://instance.test/#/team/project/p1',
      });
    }
    return new Response('', { status: 404 });
  };
  const copied: string[] = [];
  const policy = invitePolicy({ can: { 'user.invite': true }, invites: { domains: ['acme.com'] } });
  const panel = buildPeoplePanel({ projectId: 'p1', projectName: 'Summit', policy, copy: async (t) => { copied.push(t); } });
  document.body.append(panel);
  await settle();
  const rows = [...panel.querySelectorAll<HTMLElement>('[data-member]')];
  assert.deepEqual(rows.map((r) => r.dataset.member), ['u1', 'u2']);
  assert.equal(rows[0]!.querySelector('select'), null, 'the owner row has no role control');
  const select = rows[1]!.querySelector<HTMLSelectElement>('select')!;
  assert.deepEqual([...select.options].map((o) => o.value), ['viewer', 'editor', 'manager']);
  assert.ok(rows[1]!.querySelector('[data-act="people-remove"]'));
  assert.equal(panel.querySelectorAll('[data-invitation]').length, 1);
  assert.match(panel.textContent!, /acme\.com/);

  // A refused role change goes back to the old role and says why.
  select.value = 'manager';
  select.dispatchEvent(new dom.window.Event('change'));
  await settle();
  assert.equal(select.value, 'editor');
  assert.match(panel.querySelector('.team-people-status')!.textContent!, /cannot change who has access/);

  // Invite: per-address results, the refused address stays in the field, the link copies.
  const field = panel.querySelector<HTMLTextAreaElement>('textarea')!;
  field.value = 'new@acme.com, x@other.org';
  panel.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  const post = calls.find((c) => c.method === 'POST');
  assert.deepEqual(post?.body, { emails: ['new@acme.com', 'x@other.org'], role: 'editor' });
  const results = [...panel.querySelectorAll<HTMLElement>('.team-people-results li')];
  assert.deepEqual(results.map((r) => r.dataset.status), ['invited', 'refused']);
  // The instance's code becomes a sentence naming the allowed domains, never the code.
  assert.match(results[1]!.textContent!, /Not added\. Addresses must be at acme\.com\./);
  assert.doesNotMatch(results[1]!.textContent!, /domain-not-allowed/);
  assert.equal(field.value, 'x@other.org');
  const link = panel.querySelector<HTMLInputElement>('.share-link-field')!;
  assert.equal(link.value, 'https://instance.test/#/team/project/p1');
  panel.querySelector<HTMLElement>('[data-act="people-copy-link"]')!.click();
  await settle();
  assert.deepEqual(copied, ['https://instance.test/#/team/project/p1']);
});

test('everyone added directly: no invite link, a plain sentence and the project link', async () => {
  reset();
  let results: Array<{ email: string; status: string }> = [{ email: 'bo@acme.com', status: 'added' }, { email: 'ana@acme.com', status: 'already' }];
  router = (url) => {
    if (url === '/api/v1/projects/p1/members') return json(MANAGER_LIST);
    if (url === '/api/v1/projects/p1/invite') return json({ results, link: 'https://instance.test/#/team/project/p1' });
    return new Response('', { status: 404 });
  };
  const copied: string[] = [];
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ can: { 'user.invite': true }, invites: {} }), copy: async (t) => { copied.push(t); } });
  document.body.append(panel);
  await settle();
  const submit = async (emails: string): Promise<void> => {
    panel.querySelector<HTMLTextAreaElement>('textarea')!.value = emails;
    panel.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await settle();
  };
  await submit('bo@acme.com, ana@acme.com');
  assert.doesNotMatch(panel.textContent!, /Send this link/);
  assert.equal(panel.querySelector<HTMLElement>('[data-link-note]')!.textContent, 'Added. They can open this project now.');
  const btn = panel.querySelector<HTMLElement>('[data-act="people-copy-link"]')!;
  assert.equal(btn.textContent, 'Copy project link');
  assert.equal(panel.querySelector('.share-link-field')!.getAttribute('aria-label'), 'Project link');
  btn.click();
  await settle();
  assert.deepEqual(copied, ['https://instance.test/#/team/project/p1']);

  // Everyone already had access: said as such, still with the project link.
  results = [{ email: 'ana@acme.com', status: 'already' }];
  await submit('ana@acme.com');
  assert.equal(panel.querySelector<HTMLElement>('[data-link-note]')!.textContent, 'They can already open this project.');

  // One invitation among them: the link to send, with the sentence about sending the link.
  results = [{ email: 'bo@acme.com', status: 'added' }, { email: 'new@acme.com', status: 'invited' }];
  await submit('bo@acme.com, new@acme.com');
  assert.equal(panel.querySelector('[data-link-note]'), null);
  assert.match(panel.textContent!, /Send new people their personal invitation link\./);
  assert.equal(panel.querySelector<HTMLElement>('[data-act="people-copy-link"]')!.textContent, 'Copy project link');

  // Nobody went through: no link left over from the last invite.
  results = [{ email: 'x@other.org', status: 'refused' }];
  await submit('x@other.org');
  assert.equal(panel.querySelector('[data-act="people-copy-link"]'), null);
});

test('revealPeoplePanel brings the panel into view and focuses its heading', async () => {
  reset();
  router = (url) => url === '/api/v1/projects/p1/members' ? json(MANAGER_LIST) : new Response('', { status: 404 });
  const panel = buildPeoplePanel({ projectId: 'p1', policy: null });
  const scrolls: unknown[] = [];
  panel.scrollIntoView = ((o?: unknown) => { scrolls.push(o); }) as typeof panel.scrollIntoView;
  revealPeoplePanel(panel);
  assert.equal(scrolls.length, 0, 'nothing happens for a panel not yet on the page');
  document.body.append(panel);
  revealPeoplePanel(panel);
  assert.deepEqual(scrolls, [{ block: 'nearest', behavior: 'smooth' }]);
  assert.equal(panel.style.scrollMarginTop, '.75rem', 'room above the heading for its focus ring');
  assert.equal(document.activeElement, panel.querySelector('h3'));
  // Reduced motion (the app preference): the scroll is instant.
  document.documentElement.dataset.a11yMotion = 'reduce';
  try {
    revealPeoplePanel(panel);
    assert.deepEqual(scrolls[1], { block: 'nearest', behavior: 'auto' });
  } finally {
    delete document.documentElement.dataset.a11yMotion;
  }
  await settle();
});

test("'already' for an invitation still waiting is said as invited, never as access", async () => {
  reset();
  // lolly-work answers 'already' for an open invitation that covers the project at
  // that role, too: cy@acme.com is in the list's "Waiting to accept".
  let results: Array<{ email: string; status: string }> = [{ email: 'Cy@acme.com', status: 'already' }];
  let list: typeof MANAGER_LIST = MANAGER_LIST;
  router = (url) => {
    if (url === '/api/v1/projects/p1/members') return json(list);
    if (url === '/api/v1/projects/p1/invite') return json({ results, link: 'https://instance.test/#/team/project/p1' });
    return new Response('', { status: 404 });
  };
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ can: { 'user.invite': true }, invites: {} }) });
  document.body.append(panel);
  await settle();
  const submit = async (emails: string): Promise<void> => {
    panel.querySelector<HTMLTextAreaElement>('textarea')!.value = emails;
    panel.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await settle();
  };
  await submit('cy@acme.com');
  const row = panel.querySelector<HTMLElement>('.team-people-results li')!;
  assert.equal(row.dataset.status, 'already-invited');
  assert.match(row.textContent!, /Already invited/);
  assert.doesNotMatch(panel.textContent!, /can already open|Already has access/);
  assert.equal(panel.querySelector('[data-link-note]'), null);
  assert.match(panel.textContent!, /Send new people their personal invitation link\./);
  assert.equal(panel.querySelector<HTMLElement>('[data-act="people-copy-link"]')!.textContent, 'Copy project link');

  // Added directly beside a waiting invitation: still the link to send.
  results = [{ email: 'bo@acme.com', status: 'added' }, { email: 'cy@acme.com', status: 'already' }];
  await submit('bo@acme.com, cy@acme.com');
  assert.equal(panel.querySelector('[data-link-note]'), null);
  assert.equal(panel.querySelector<HTMLElement>('[data-act="people-copy-link"]')!.textContent, 'Copy project link');

  // A list that was out of date when the answer came: the reload corrects the outcome.
  results = [{ email: 'dee@acme.com', status: 'already' }];
  list = { ...MANAGER_LIST, invitations: [...MANAGER_LIST.invitations, { id: 'i2', email: 'dee@acme.com', role: 'editor', createdAt: '2026-10-01', expiresAt: '2026-10-31' }] };
  await submit('dee@acme.com');
  assert.equal(panel.querySelector<HTMLElement>('.team-people-results li')!.dataset.status, 'already-invited');
  assert.equal(panel.querySelector<HTMLElement>('[data-act="people-copy-link"]')!.textContent, 'Copy project link');

  // Someone who really has access keeps the access wording.
  results = [{ email: 'bo@acme.com', status: 'already' }];
  await submit('bo@acme.com');
  assert.equal(panel.querySelector<HTMLElement>('[data-link-note]')!.textContent, 'They can already open this project.');
});

test('a typo is caught before anything is sent, and said under the field', async () => {
  reset();
  router = (url) => url === '/api/v1/projects/p1/members' ? json(MANAGER_LIST) : new Response('', { status: 404 });
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ can: { 'user.invite': true }, invites: {} }) });
  document.body.append(panel);
  await settle();
  const field = panel.querySelector<HTMLTextAreaElement>('textarea')!;
  field.value = 'ana@acme';
  panel.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
  // The message is in the form, next to the field, and the field points at the message.
  const formStatus = panel.querySelector<HTMLElement>('.team-people-invite-status')!;
  assert.match(formStatus.textContent!, /not email addresses: ana@acme/);
  assert.equal(formStatus.hidden, false);
  assert.ok(field.getAttribute('aria-describedby')!.split(' ').includes(formStatus.id));
  assert.equal(field.getAttribute('aria-invalid'), 'true');
  assert.equal(panel.querySelector<HTMLElement>('.team-people-status')!.hidden, true, 'the list status line stays quiet');
  field.dispatchEvent(new dom.window.Event('input'));
  assert.equal(field.hasAttribute('aria-invalid'), false, 'typing clears the mark');
});

test('a word with no @ is reported, not dropped while the rest is sent', async () => {
  reset();
  router = (url) => url === '/api/v1/projects/p1/members' ? json(MANAGER_LIST) : new Response('', { status: 404 });
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ can: { 'user.invite': true }, invites: {} }) });
  document.body.append(panel);
  await settle();
  panel.querySelector<HTMLTextAreaElement>('textarea')!.value = 'ana@acme.com, bob.acme.com';
  panel.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
  assert.match(panel.querySelector('.team-people-invite-status')!.textContent!, /not email addresses: bob\.acme\.com/);
});

test('a link the clipboard refused does not say Copied', async () => {
  reset();
  router = (url) => {
    if (url === '/api/v1/projects/p1/members') return json(MANAGER_LIST);
    if (url === '/api/v1/projects/p1/invite') return json({ results: [{ email: 'new@acme.com', status: 'invited' }], link: 'https://instance.test/#/team/project/p1' });
    return new Response('', { status: 404 });
  };
  // No async clipboard (plain http) and a refused selection copy.
  const doc = document as unknown as { execCommand: (cmd: string) => boolean };
  const before = doc.execCommand;
  doc.execCommand = () => false;
  try {
    const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ can: { 'user.invite': true }, invites: {} }) });
    document.body.append(panel);
    await settle();
    panel.querySelector<HTMLTextAreaElement>('textarea')!.value = 'new@acme.com';
    panel.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await settle();
    const btn = panel.querySelector<HTMLElement>('[data-act="people-copy-link"]')!;
    btn.click();
    await settle();
    assert.equal(btn.textContent, 'Copy project link');
    assert.match(panel.querySelector('.team-people-invite-status')!.textContent!, /Could not copy\. The link is selected/);
    assert.equal(document.activeElement, panel.querySelector('.share-link-field'));
  } finally {
    doc.execCommand = before;
  }
});

test('a revoke that finds the invitation gone says so, and the list is read again', async () => {
  reset();
  let invitations = MANAGER_LIST.invitations;
  router = (url, init) => {
    if (url === '/api/v1/projects/p1/members') return json({ ...MANAGER_LIST, invitations });
    if (url === '/api/v1/projects/p1/invitations/i1' && init?.method === 'DELETE') return json({ error: { code: 'NOT_FOUND' } }, 404);
    return new Response('', { status: 404 });
  };
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ invites: {} }) });
  document.body.append(panel);
  await settle();
  // The invitee accepted meanwhile: the instance no longer lists the invitation.
  invitations = [];
  panel.querySelector<HTMLElement>('[data-act="people-revoke"]')!.click();
  await settle();
  const status = panel.querySelector('.team-people-status')!.textContent!;
  assert.equal(status, 'That person or invitation has already changed.');
  assert.doesNotMatch(status, /no longer on this instance/);
  assert.equal(panel.querySelectorAll('[data-invitation]').length, 0, 'the stale row is gone');
});

test('revoking moves focus to the next row instead of losing it', async () => {
  reset();
  let invitations = [
    { id: 'i1', email: 'cy@acme.com', role: 'viewer', createdAt: '2026-10-01' },
    { id: 'i2', email: 'di@acme.com', role: 'editor', createdAt: '2026-10-01' },
  ];
  router = (url, init) => {
    if (url === '/api/v1/projects/p1/members') return json({ ...MANAGER_LIST, invitations });
    if (url === '/api/v1/projects/p1/invitations/i1' && init?.method === 'DELETE') { invitations = invitations.slice(1); return new Response(null, { status: 204 }); }
    return new Response('', { status: 404 });
  };
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ invites: {} }) });
  document.body.append(panel);
  await settle();
  const first = panel.querySelector<HTMLElement>('[data-invitation="i1"] [data-act="people-revoke"]')!;
  first.focus();
  first.click();
  await settle();
  const active = document.activeElement as HTMLElement;
  assert.equal(active.dataset.act, 'people-revoke');
  assert.equal(active.closest<HTMLElement>('li')!.dataset.invitation, 'i2');
});

test('the role select stays usable while a change is saved; the last choice wins', async () => {
  reset();
  const patched: string[] = [];
  let role = 'editor';
  let release: (() => void) | null = null;
  router = (url) => {
    if (url === '/api/v1/projects/p1/members') {
      return json({ ...MANAGER_LIST, members: [MANAGER_LIST.members[0], { ...MANAGER_LIST.members[1], role }] });
    }
    return new Response('', { status: 404 });
  };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/v1/projects/p1/members/u2' && init?.method === 'PATCH') {
      const want = JSON.parse(String(init.body)).role as string;
      patched.push(want);
      if (patched.length === 1) await new Promise<void>((r) => { release = r; });
      role = want;
      return json({ userId: 'u2', name: 'Bo', role: want });
    }
    return router(url, init);
  }) as typeof fetch;
  try {
    const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ invites: {} }) });
    document.body.append(panel);
    await settle();
    const select = panel.querySelector<HTMLSelectElement>('[data-member="u2"] select')!;
    select.focus();
    select.value = 'manager';
    select.dispatchEvent(new dom.window.Event('change'));
    await settle();
    assert.equal(select.disabled, false, 'never disabled under the keyboard');
    assert.equal(select.closest('li')!.getAttribute('aria-busy'), 'true');
    // A second arrow press while the first is still saving.
    select.value = 'viewer';
    select.dispatchEvent(new dom.window.Event('change'));
    release!();
    await settle();
    assert.deepEqual(patched, ['manager', 'viewer']);
    const after = panel.querySelector<HTMLSelectElement>('[data-member="u2"] select')!;
    assert.equal(after.value, 'viewer');
    assert.equal(after.closest('li')!.hasAttribute('aria-busy'), false);
    assert.equal(document.activeElement, after, 'focus stays on the role control after the redraw');
  } finally {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ url: String(input), method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      return router(String(input), init);
    }) as typeof fetch;
  }
});

test('demoting yourself takes the manage controls away at once', async () => {
  reset();
  let myRole = 'manager';
  router = (url, init) => {
    if (url === '/api/v1/projects/p1/members') {
      return json({ myRole, members: [MANAGER_LIST.members[0], { userId: 'me', name: 'Me', role: myRole }], ...(myRole === 'manager' ? { invitations: [] } : {}) });
    }
    if (url === '/api/v1/projects/p1/members/me' && init?.method === 'PATCH') { myRole = 'viewer'; return json({ userId: 'me', name: 'Me', role: 'viewer' }); }
    return new Response('', { status: 404 });
  };
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ invites: {} }) });
  document.body.append(panel);
  await settle();
  assert.ok(panel.querySelector('form'));
  const select = panel.querySelector<HTMLSelectElement>('[data-member="me"] select')!;
  select.value = 'viewer';
  select.dispatchEvent(new dom.window.Event('change'));
  await settle();
  assert.equal(panel.querySelector('select'), null, 'no role selects');
  assert.equal(panel.querySelector('[data-act="people-remove"]'), null);
  assert.equal(panel.querySelector('form'), null, 'no invite form');
});

test('a viewer sees the list only', async () => {
  reset();
  router = (url) => url === '/api/v1/projects/p1/members'
    ? json({ myRole: 'viewer', members: [{ userId: 'u1', name: 'Ana', role: 'owner' }, { userId: 'u3', name: 'Di', role: 'viewer' }] })
    : new Response('', { status: 404 });
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ can: { 'user.invite': true }, invites: {} }) });
  document.body.append(panel);
  await settle();
  assert.equal(panel.querySelectorAll('[data-member]').length, 2);
  assert.equal(panel.querySelector('select'), null);
  assert.equal(panel.querySelector('[data-act="people-remove"]'), null);
  assert.equal(panel.querySelector('form'), null);
  assert.match(panel.textContent!, /Viewer/);
});

test('a refusal keeps the instance code where one status means several things', async () => {
  reset();
  router = () => json({ error: { code: 'PROJECT_ARCHIVED', message: 'restore the project first' } }, 409);
  assert.deepEqual(await inviteToProject('p1', ['a@b.co'], 'viewer'), { ok: false, status: 409, code: 'PROJECT_ARCHIVED' });
  router = () => json({ error: { code: 'ROLE_NOT_ALLOWED' } }, 403);
  assert.deepEqual(await changeMemberRole('p1', 'u2', 'manager'), { ok: false, status: 403, code: 'ROLE_NOT_ALLOWED' });
  router = () => new Response('not json', { status: 500 });
  assert.deepEqual(await removeMember('p1', 'u2'), { ok: false, status: 500 }, 'no readable body: the status alone');
});

test('the caller\'s own row is read from isMe, and only a literal true counts', () => {
  const people = peopleFromBody({
    myRole: 'viewer',
    members: [{ userId: 'u1', name: 'Ana', role: 'owner' }, { userId: 'me', name: 'Me', role: 'viewer', isMe: true }, { userId: 'u3', name: 'Di', role: 'viewer', isMe: 'yes' }],
  })!;
  assert.deepEqual(people.members.map((m) => m.isMe ?? false), [false, true, false]);
});

test('an archived project or a role the instance does not give is said plainly', async () => {
  reset();
  router = (url) => {
    if (url === '/api/v1/projects/p1/members') return json(MANAGER_LIST);
    if (url === '/api/v1/projects/p1/invite') return json({ error: { code: 'PROJECT_ARCHIVED' } }, 409);
    if (url === '/api/v1/projects/p1/members/u2') return json({ error: { code: 'ROLE_NOT_ALLOWED' } }, 403);
    return new Response('', { status: 404 });
  };
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ can: { 'user.invite': true }, invites: {} }) });
  document.body.append(panel);
  await settle();
  panel.querySelector<HTMLTextAreaElement>('textarea')!.value = 'new@acme.com';
  panel.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  assert.match(panel.querySelector('.team-people-invite-status')!.textContent!, /archived\. Restore it/);
  const select = panel.querySelector<HTMLSelectElement>('[data-member="u2"] select')!;
  select.value = 'manager';
  select.dispatchEvent(new dom.window.Event('change'));
  await settle();
  assert.match(panel.querySelector('.team-people-status')!.textContent!, /does not give that role/);
});

test('your own row offers Leave, even read-only, and leaving says so', async () => {
  reset();
  let member = true;
  router = (url, init) => {
    if (url === '/api/v1/projects/p1/members') {
      return member
        ? json({ myRole: 'viewer', members: [{ userId: 'u1', name: 'Ana', role: 'owner' }, { userId: 'me', name: 'Me', role: 'viewer', isMe: true }] })
        : json({ error: { code: 'FORBIDDEN' } }, 403);
    }
    if (url === '/api/v1/projects/p1/members/me' && init?.method === 'DELETE') { member = false; return new Response(null, { status: 204 }); }
    return new Response('', { status: 404 });
  };
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ invites: {} }) });
  document.body.append(panel);
  await settle();
  assert.equal(panel.querySelector('[data-member="u1"] [data-act="people-remove"]'), null, 'nothing to do on the owner row');
  const leave = panel.querySelector<HTMLElement>('[data-member="me"] [data-act="people-remove"]')!;
  assert.equal(leave.textContent, 'Leave');
  assert.equal(leave.getAttribute('aria-label'), 'Leave this project');
  leave.click();
  await settle();
  const confirm = document.querySelector('dialog[open]')!;
  assert.match(confirm.textContent!, /Leave this project\?/);
  confirm.querySelector<HTMLElement>('[data-act="ok"]')!.click();
  await settle();
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url === '/api/v1/projects/p1/members/me'));
  const status = panel.querySelector<HTMLElement>('.team-people-status')!;
  assert.equal(status.textContent, 'You left this project.', 'the reload that now answers 403 does not replace it');
  assert.equal(panel.querySelectorAll('[data-member]').length, 0);
});

test('a manager\'s own row says Leave, other rows say Remove', async () => {
  reset();
  router = (url) => url === '/api/v1/projects/p1/members'
    ? json({ ...MANAGER_LIST, members: [...MANAGER_LIST.members.slice(0, 2), { userId: 'me', name: 'Me', email: 'me@acme.com', role: 'manager', isMe: true }] })
    : new Response('', { status: 404 });
  const panel = buildPeoplePanel({ projectId: 'p1', policy: invitePolicy({ invites: {} }) });
  document.body.append(panel);
  await settle();
  assert.equal(panel.querySelector('[data-member="u2"] [data-act="people-remove"]')!.textContent, 'Remove');
  assert.equal(panel.querySelector('[data-member="me"] [data-act="people-remove"]')!.textContent, 'Leave');
});

test('a list the instance refuses says so', async () => {
  reset();
  router = () => json({ error: {} }, 404);
  const panel = buildPeoplePanel({ projectId: 'gone', policy: null });
  document.body.append(panel);
  await settle();
  assert.match(panel.querySelector('.team-people-status')!.textContent!, /no longer on this instance/);
});


test('shared rename sends metadata only, preserves revision and reports an active room', async () => {
  reset();
  router = () => json({ error: { code: 'COLLAB_ACTIVE' } }, 409);
  assert.deepEqual(await renameTeamSession('s/1', 'Event guide', 7, { emoji: '🎪', label: 'Before' }), { ok: false, status: 409, code: 'COLLAB_ACTIVE' });
  assert.deepEqual(calls[0], { url: '/api/v1/sessions/s%2F1', method: 'PUT', body: { rev: 7, meta: { emoji: '🎪', label: 'Event guide' } } });
  assert.ok(!Object.hasOwn(calls[0]!.body as object, 'inputs'), 'renaming cannot overwrite document inputs');
  router = () => json({}, 200);
  assert.deepEqual(await renameTeamProject('p/1', 'Autumn event'), { ok: true, data: null });
  assert.deepEqual(calls[1], { url: '/api/v1/projects/p%2F1', method: 'PATCH', body: { name: 'Autumn event' } });
  router = () => new Response(null, { status: 204 });
  assert.deepEqual(await deleteTeamSession('s/1'), { ok: true, data: null });
  assert.equal(calls[2]!.url, '/api/v1/sessions/s%2F1');
  assert.equal(calls[2]!.method, 'DELETE');
});

// ── plans/75: invite links, requests and the message to send ─────────────────

const R17 = {
  myRole: 'manager',
  members: MANAGER_LIST.members.slice(0, 2),
  invitations: [
    {
      id: 'i1', email: 'sam@suse.com', role: 'editor', createdAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-31T12:00:00Z',
      status: 'pending', openedAt: '2026-10-02T10:00:00Z', invitedByName: 'Ana', passwordSetup: true, link: 'https://lolly.ing/l/invite/tok1',
    },
    {
      id: 'i2', email: 'old@acme.com', role: 'viewer', createdAt: '2026-08-01T00:00:00Z', expiresAt: '2026-09-30T12:00:00Z',
      status: 'expired', invitedByName: 'Bo', passwordSetup: false, link: 'https://lolly.ing/l/invite/stale',
    },
  ],
  requests: [
    { id: 'req_1', userId: 'u7', name: 'Priya', email: 'priya@acme.com', role: 'editor', currentRole: 'viewer', note: '<script>alert(1)</script> please', createdAt: '2026-10-02T09:00:00Z' },
    { id: 'req_2', userId: 'u8', name: 'Kai', email: 'kai@acme.com', role: 'viewer', currentRole: 'none', createdAt: '2026-10-02T11:00:00Z' },
  ],
  message: { workspace: 'lolly.ing', providers: ['Google', 'GitHub'], note: 'Use GitHub if Google is blocked.' },
};
const ADMIN = { can: { 'user.invite': true }, instance: { name: 'lolly.ing' }, invites: {} };
/** A day in this machine's time zone, the way the panel and the message give a day. */
const day = (iso: string): string => new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(Date.parse(iso));

test('the members list reads waiting and expired invitations, requests and the words for a message', async () => {
  reset();
  router = (url) => url === '/api/v1/projects/p1/members' ? json(R17) : new Response('', { status: 404 });
  const got = await listProjectPeople('p1');
  assert.ok(got.ok);
  assert.deepEqual(got.data.invitations[0], {
    id: 'i1', email: 'sam@suse.com', role: 'editor', status: 'pending', passwordSetup: true, createdAt: '2026-10-01T00:00:00Z',
    expiresAt: '2026-10-31T12:00:00Z', openedAt: '2026-10-02T10:00:00Z', invitedByName: 'Ana', link: 'https://lolly.ing/l/invite/tok1',
  });
  assert.equal(got.data.invitations[1]!.status, 'expired');
  assert.equal(got.data.invitations[1]!.link, undefined, 'an expired invitation carries no link');
  assert.deepEqual(got.data.requests.map((r) => [r.id, r.name, r.role]), [['req_1', 'Priya', 'editor'], ['req_2', 'Kai', 'viewer']]);
  assert.equal(got.data.requests[0]!.note, '<script>alert(1)</script> please', 'kept as typed; the panel renders it as text');
  assert.deepEqual(got.data.message, { workspace: 'lolly.ing', providers: ['Google', 'GitHub'], note: 'Use GitHub if Google is blocked.' });
  const odd = peopleFromBody({ ...R17, invitations: [{ ...R17.invitations[0], link: 'javascript:alert(1)' }], requests: [{ id: 'x', role: 'owner', name: 'Z' }] })!;
  assert.equal(odd.invitations[0]!.link, undefined, 'a link that is not http(s) is dropped');
  assert.deepEqual(odd.requests, [], 'a request for a role nobody hands out is dropped');
});

test('inviteToProject sends the password choice only when asked, and reads each address\'s link', async () => {
  reset();
  router = () => json({
    results: [{ email: 'sam@suse.com', status: 'invited', invitationId: 'i9', link: 'https://lolly.ing/l/invite/t9', expiresAt: '2026-11-02T12:00:00Z' }],
    link: 'https://lolly.ing/#/team/project/p1',
    message: { workspace: 'lolly.ing', inviter: 'Andy', providers: ['Google', 'GitHub'] },
  });
  const got = await inviteToProject('p1', ['sam@suse.com'], 'editor', { passwordSetup: true });
  assert.deepEqual(calls.at(-1)!.body, { emails: ['sam@suse.com'], role: 'editor', passwordSetup: true });
  assert.ok(got.ok);
  assert.deepEqual(got.data.results[0], { email: 'sam@suse.com', status: 'invited', invitationId: 'i9', link: 'https://lolly.ing/l/invite/t9', expiresAt: '2026-11-02T12:00:00Z' });
  assert.deepEqual(got.data.message, { workspace: 'lolly.ing', inviter: 'Andy', providers: ['Google', 'GitHub'] });
  await inviteToProject('p1', ['sam@suse.com'], 'editor', { passwordSetup: false });
  assert.deepEqual(calls.at(-1)!.body, { emails: ['sam@suse.com'], role: 'editor', passwordSetup: false });
});

test('a new link, inviting again and answering a request use their routes', async () => {
  reset();
  router = (url, init) => {
    if (url === '/api/v1/projects/p1/invitations/i1/link') return json({ link: 'https://lolly.ing/l/invite/tok2', expiresAt: '2026-10-31T12:00:00Z' });
    if (url === '/api/v1/projects/p1/invitations/i2/reinvite') return json({ results: [{ email: 'old@acme.com', status: 'invited', invitationId: 'i3' }] });
    if (url === '/api/v1/projects/p1/invitations/i4/reinvite') return json({ email: 'x@acme.com', status: 'refused', reason: 'domain-not-allowed' });
    if (url === '/api/v1/access-requests/req_1/approve') {
      return json({ request: { id: 'req_1', status: 'approved', answeredBy: { name: 'Me' }, answerRole: JSON.parse(String(init!.body)).role }, outcome: 'added' });
    }
    if (url === '/api/v1/access-requests/req_1/decline') return json({ request: { id: 'req_1', status: 'declined', answeredBy: { name: 'Me' } } });
    if (url === '/api/v1/access-requests/req_2/approve') {
      return json({ error: { code: 'ALREADY_ANSWERED', message: 'answered', request: { status: 'approved', answeredBy: { name: 'Priya' }, answerRole: 'editor' } } }, 409);
    }
    if (url === '/api/v1/access-requests/req_3/approve') return json({ error: { code: 'ALREADY_ANSWERED' }, request: { status: 'declined', answeredBy: { name: 'Bo' } } }, 409);
    return json({ error: { code: 'FORBIDDEN' } }, 403);
  };
  assert.deepEqual(await rotateInvitationLink('p1', 'i1'), { ok: true, data: { link: 'https://lolly.ing/l/invite/tok2', expiresAt: '2026-10-31T12:00:00Z' } });
  assert.deepEqual(calls.at(-1), { url: '/api/v1/projects/p1/invitations/i1/link', method: 'POST', body: {} });
  assert.deepEqual(await reinvite('p1', 'i2'), { ok: true, data: { email: 'old@acme.com', status: 'invited', invitationId: 'i3' } });
  assert.deepEqual(await reinvite('p1', 'i4'), { ok: true, data: { email: 'x@acme.com', status: 'refused', reason: 'domain-not-allowed' } }, 'a bare row reads the same');
  assert.deepEqual(await answerRequest('req_1', 'approve', 'manager'), { ok: true, request: { status: 'approved', answeredBy: 'Me', answerRole: 'manager' }, outcome: 'added' });
  assert.deepEqual(calls.at(-1), { url: '/api/v1/access-requests/req_1/approve', method: 'POST', body: { role: 'manager' } });
  assert.deepEqual(await answerRequest('req_1', 'decline'), { ok: true, request: { status: 'declined', answeredBy: 'Me' } });
  assert.deepEqual(calls.at(-1)!.body, {}, 'a decline sends no role');
  // Someone answered first: the request as it now stands, inside the error object or next to the error object.
  assert.deepEqual(await answerRequest('req_2', 'approve', 'viewer'), {
    ok: false, status: 409, code: 'ALREADY_ANSWERED', request: { status: 'approved', answeredBy: 'Priya', answerRole: 'editor' },
  });
  assert.deepEqual(await answerRequest('req_3', 'approve'), { ok: false, status: 409, code: 'ALREADY_ANSWERED', request: { status: 'declined', answeredBy: 'Bo' } });
  assert.deepEqual(await answerRequest('req_9', 'decline'), { ok: false, status: 403, code: 'FORBIDDEN' });
  assert.deepEqual(await rotateInvitationLink('p1', 'i9'), { ok: false, status: 403, code: 'FORBIDDEN' });
  router = () => { throw new Error('offline'); };
  assert.deepEqual(await answerRequest('req_1', 'approve', 'editor'), { ok: false, status: 0 });
});

test('signInProviderNames: the OpenID Connect and GitHub sign-ins, never the password one', async () => {
  reset();
  router = (url) => url === '/api/auth/config'
    ? json({ providers: [{ id: 'primary', name: 'Google', kind: 'oidc' }, { id: 'email', name: 'Email and password', kind: 'password' }, { id: 'github', name: 'GitHub', kind: 'github' }, { name: 'Google' }] })
    : new Response('', { status: 404 });
  assert.deepEqual(await signInProviderNames(), ['Google', 'GitHub']);
  router = () => new Response('', { status: 500 });
  assert.deepEqual(await signInProviderNames(), []);
});

/** Mount a panel on R17 (or `list`), with a recording copier. */
async function mountR17(o: { list?: unknown; config?: Parameters<typeof invitePolicy>[0]; extra?: Handler; copyOk?: boolean } = {}) {
  const copied: string[] = [];
  router = (url, init) => {
    const hit = o.extra?.(url, init);
    if (hit && hit.status !== 404) return hit;
    if (url === '/api/v1/projects/p1/members') return json(o.list ?? R17);
    return new Response('', { status: 404 });
  };
  const panel = buildPeoplePanel({
    projectId: 'p1', projectName: 'Summit', policy: invitePolicy(o.config ?? ADMIN),
    copy: async (t) => { copied.push(t); return o.copyOk ?? true; },
  });
  document.body.append(panel);
  await settle();
  return { panel, copied };
}

test('a waiting invitation: its end day, Opened and who invited, its own link and message', async () => {
  reset();
  const { panel, copied } = await mountR17();
  const row = panel.querySelector<HTMLElement>('[data-invitation="i1"]')!;
  assert.ok(row.textContent!.includes(`Editor · Ends ${day('2026-10-31T12:00:00Z')}`));
  assert.match(row.textContent!, /Opened .+ · Invited by Ana/);
  assert.match(row.textContent!, /Anyone with this link can set the password for sam@suse\.com\. Send the link privately\./);
  // The actions are a group under the address, so a screen reader reads each action with the address.
  const group = row.querySelector<HTMLElement>('[role="group"]')!;
  assert.equal(document.getElementById(group.getAttribute('aria-labelledby')!)!.textContent, 'sam@suse.com');
  assert.deepEqual([...group.querySelectorAll<HTMLElement>('[data-act]')].map((b) => b.textContent), ['Copy link', 'Copy message', 'New link', 'Revoke']);

  row.querySelector<HTMLElement>('[data-act="people-copy-invite-link"]')!.click();
  await settle();
  assert.deepEqual(copied, ['https://lolly.ing/l/invite/tok1']);
  assert.equal(row.querySelector<HTMLElement>('[data-act="people-copy-invite-link"]')!.textContent, 'Copied!');
  row.querySelector<HTMLElement>('[data-act="people-copy-message"]')!.click();
  await settle();
  assert.equal(copied[1], [
    'Ana invited you to Summit on lolly.ing. Your role: Editor.',
    'https://lolly.ing/l/invite/tok1',
    'Sign in as sam@suse.com with Google or GitHub.',
    'Open the link to set your password.',
    `This invitation ends on ${day('2026-10-31T12:00:00Z')}.`,
    'Use GitHub if Google is blocked.',
  ].join('\n'));

  // The expired one: said so, no link to copy, and Invite again.
  const old = panel.querySelector<HTMLElement>('[data-invitation="i2"]')!;
  assert.ok(old.textContent!.includes(`Ended ${day('2026-09-30T12:00:00Z')}`));
  assert.match(old.textContent!, /Expired · Invited by Bo/);
  assert.deepEqual([...old.querySelectorAll<HTMLElement>('[data-act]')].map((b) => b.dataset.act), ['people-reinvite', 'people-revoke']);
});

test('Invite again is only for someone who may invite new people', async () => {
  reset();
  const { panel } = await mountR17({ config: { can: {}, invites: {} } });
  assert.equal(panel.querySelector('[data-act="people-reinvite"]'), null);
  assert.ok(panel.querySelector('[data-invitation="i2"] [data-act="people-revoke"]'), 'Revoke stays');
});

test('New link asks first, then says the links copied earlier stopped working', async () => {
  reset();
  const { panel } = await mountR17({ extra: (url) => url === '/api/v1/projects/p1/invitations/i1/link' ? json({ link: 'https://lolly.ing/l/invite/tok2' }) : new Response('', { status: 404 }) });
  const fresh = panel.querySelector<HTMLElement>('[data-invitation="i1"] [data-act="people-new-link"]')!;
  fresh.click();
  await settle();
  let dialog = document.querySelector('dialog[open]')!;
  assert.match(dialog.textContent!, /Make a new link for sam@suse\.com\?/);
  assert.match(dialog.textContent!, /Links copied earlier for this address will stop working\./);
  dialog.querySelector<HTMLElement>('[data-act="cancel"]')!.click();
  await settle();
  assert.equal(calls.filter((c) => c.url.endsWith('/link')).length, 0, 'Cancel changes nothing');
  fresh.click();
  await settle();
  dialog = document.querySelector('dialog[open]')!;
  dialog.querySelector<HTMLElement>('[data-act="ok"]')!.click();
  await settle();
  assert.deepEqual(calls.filter((c) => c.url.endsWith('/link')).map((c) => c.method), ['POST']);
  assert.equal(panel.querySelector('.team-people-status')!.textContent, 'New link made. Links copied earlier for this address no longer work.');
});

test('Invite again sends an expired invitation again, or says why it could not', async () => {
  reset();
  let answer: Response = json({ results: [{ email: 'old@acme.com', status: 'invited', invitationId: 'i3' }] });
  const { panel } = await mountR17({ extra: (url) => url === '/api/v1/projects/p1/invitations/i2/reinvite' ? answer : new Response('', { status: 404 }) });
  panel.querySelector<HTMLElement>('[data-act="people-reinvite"]')!.click();
  await settle();
  assert.equal(panel.querySelector('.team-people-status')!.textContent, 'Invited again. The earlier link no longer works.');
  answer = json({ results: [{ email: 'old@acme.com', status: 'refused', reason: 'domain-not-allowed' }] });
  panel.querySelector<HTMLElement>('[data-act="people-reinvite"]')!.click();
  await settle();
  assert.equal(panel.querySelector('.team-people-status')!.textContent, 'Not added. That address is outside the allowed domains.');
});

test('a message the clipboard refused is shown selected, ready to copy by hand', async () => {
  reset();
  const { panel } = await mountR17({ copyOk: false });
  const row = panel.querySelector<HTMLElement>('[data-invitation="i1"]')!;
  const btn = row.querySelector<HTMLElement>('[data-act="people-copy-message"]')!;
  btn.click();
  await settle();
  const area = row.querySelector<HTMLTextAreaElement>('textarea')!;
  assert.equal(area.readOnly, true);
  assert.equal(row.querySelector(`label[for="${area.id}"]`)!.textContent, 'Invite message for sam@suse.com');
  assert.match(area.value, /^Ana invited you to Summit on lolly\.ing\./);
  assert.equal(document.activeElement, area);
  assert.equal(btn.textContent, 'Copy message', 'never says Copied');
  assert.equal(panel.querySelector('.team-people-status')!.textContent, 'Could not copy. The message is selected, ready to copy by hand.');
});

test('asking for access: a section above the list, notes as text, Approve with a role', async () => {
  reset();
  const answers: Record<string, Response> = {};
  let open = R17.requests;
  const { panel } = await mountR17({
    list: undefined,
    extra: (url) => {
      if (url === '/api/v1/projects/p1/members') return json({ ...R17, requests: open });
      const m = /^\/api\/v1\/access-requests\/(\w+)\/(approve|decline)$/.exec(url);
      return m ? answers[`${m[1]}/${m[2]}`] ?? new Response('', { status: 404 }) : new Response('', { status: 404 });
    },
  });
  const box = panel.querySelector<HTMLElement>('.team-people-requests')!;
  assert.ok(box, 'shown to a manager');
  assert.equal(box.compareDocumentPosition(panel.querySelector('[data-member]')!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'above the members');
  assert.equal(document.getElementById(box.getAttribute('aria-labelledby')!)!.textContent, 'Asking for access');
  const priya = box.querySelector<HTMLElement>('[data-request="req_1"]')!;
  assert.match(priya.textContent!, /Priya/);
  assert.match(priya.textContent!, /priya@acme\.com/);
  assert.match(priya.textContent!, /Asks to edit · Asked /);
  assert.match(priya.textContent!, /<script>alert\(1\)<\/script> please/, 'the note is text');
  assert.equal(box.querySelector('script'), null);
  assert.match(box.querySelector<HTMLElement>('[data-request="req_2"]')!.textContent!, /Asks to view/);
  const select = priya.querySelector<HTMLSelectElement>('select')!;
  assert.equal(select.getAttribute('aria-label'), 'Role for Priya');
  assert.equal(select.value, 'editor', 'starts on what was asked for');
  assert.equal(document.getElementById(select.getAttribute('aria-describedby')!)!.textContent, 'Viewers open and copy. Editors save changes. Managers also add people.');

  // Approve as Manager: the role chosen is sent, and the list is read again.
  answers['req_1/approve'] = json({ request: { status: 'approved', answeredBy: { name: 'Me' }, answerRole: 'manager' }, outcome: 'added' });
  select.value = 'manager';
  open = R17.requests.slice(1);
  const loads = calls.filter((c) => c.url === '/api/v1/projects/p1/members').length;
  const approve = priya.querySelector<HTMLElement>('[data-act="people-approve"]')!;
  approve.focus();
  approve.click();
  await settle();
  assert.deepEqual(calls.find((c) => c.url === '/api/v1/access-requests/req_1/approve')!.body, { role: 'manager' });
  assert.equal(panel.querySelector('.team-people-status')!.textContent, 'Approved as Manager.');
  assert.ok(calls.filter((c) => c.url === '/api/v1/projects/p1/members').length > loads);
  assert.equal(panel.querySelector('[data-request="req_1"]'), null);
  // Focus moves on to the next request's Approve, not back to the top.
  const active = document.activeElement as HTMLElement;
  assert.equal(active.dataset.act, 'people-approve');
  assert.equal(active.closest<HTMLElement>('li')!.dataset.request, 'req_2');

  // Someone else answered first: who, and as what.
  answers['req_2/approve'] = json({ error: { code: 'ALREADY_ANSWERED', request: { status: 'approved', answeredBy: { name: 'Priya Admin' }, answerRole: 'editor' } } }, 409);
  panel.querySelector<HTMLElement>('[data-request="req_2"] [data-act="people-approve"]')!.click();
  await settle();
  assert.equal(panel.querySelector('.team-people-status')!.textContent, 'Priya Admin already approved this as Editor.');

  answers['req_2/decline'] = json({ error: { code: 'FORBIDDEN' } }, 403);
  panel.querySelector<HTMLElement>('[data-request="req_2"] [data-act="people-decline"]')!.click();
  await settle();
  assert.equal(panel.querySelector('.team-people-status')!.textContent, 'You can no longer answer this request.');

  answers['req_2/decline'] = json({ request: { status: 'declined', answeredBy: { name: 'Me' } } });
  open = [];
  panel.querySelector<HTMLElement>('[data-request="req_2"] [data-act="people-decline"]')!.click();
  await settle();
  assert.equal(panel.querySelector('.team-people-status')!.textContent, 'Declined.');
  assert.equal(panel.querySelector('.team-people-requests'), null, 'nothing left to answer');
});

test('requests are for managers only', async () => {
  reset();
  const { panel } = await mountR17({ list: { ...R17, myRole: 'editor', members: R17.members } });
  assert.equal(panel.querySelector('.team-people-requests'), null);
});

test('a viewer may ask to edit; the button says when the request is out', async () => {
  reset();
  const viewerList = { myRole: 'viewer', members: [{ userId: 'u1', name: 'Ana', role: 'owner' }, { userId: 'me', name: 'Me', role: 'viewer', isMe: true }] };
  const { panel } = await mountR17({
    list: viewerList,
    config: { invites: {}, requests: { project: true } },
    extra: (url) => {
      if (url === '/api/v1/access-requests/mine?projectId=p1') return json({ requests: [] });
      if (url === '/api/v1/projects/p1/access-requests') return json({ ok: true }, 202);
      return new Response('', { status: 404 });
    },
  });
  assert.match(panel.textContent!, /You can view this project\. Ask to edit to save changes here\./);
  const ask = panel.querySelector<HTMLButtonElement>('[data-act="people-ask-edit"]')!;
  assert.equal(ask.textContent, 'Ask to edit');
  ask.click();
  await settle();
  assert.equal(ask.getAttribute('aria-expanded'), 'true');
  const form = panel.querySelector<HTMLElement>('[data-team-ask]')!;
  assert.ok(form, 'the ask form opens under the button');
  assert.equal(form.querySelector('h4')!.textContent, 'Ask to edit Summit');
  assert.match(form.textContent!, /The managers of Summit will see your request\./);
  assert.equal(form.querySelector('select'), null, 'the role is fixed: edit');
  form.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  assert.deepEqual(calls.find((c) => c.url === '/api/v1/projects/p1/access-requests')!.body, { role: 'editor' });
  assert.equal(ask.textContent, 'Edit request sent');
  assert.equal(ask.getAttribute('aria-disabled'), 'true');
  assert.equal(ask.disabled, false, 'still focusable');

  // Not offered where the instance takes no requests, nor to an editor.
  reset();
  const none = await mountR17({ list: viewerList, config: { invites: {} } });
  assert.equal(none.panel.querySelector('[data-act="people-ask-edit"]'), null);
  reset();
  const editor = await mountR17({ list: { ...viewerList, myRole: 'editor' }, config: { invites: {}, requests: { project: true } } });
  assert.equal(editor.panel.querySelector('[data-act="people-ask-edit"]'), null);
});

test('the password tick follows the addresses until set, and its links come with a warning', async () => {
  reset();
  const config = { ...ADMIN, invites: { passwordSetup: true, passwordDomains: ['suse.com'] } };
  const { panel, copied } = await mountR17({
    config,
    extra: (url) => url === '/api/v1/projects/p1/invite'
      ? json({
        results: [{ email: 'sam@suse.com', status: 'invited', invitationId: 'i9', link: 'https://lolly.ing/l/invite/t9', expiresAt: '2026-11-02T12:00:00Z' }],
        link: 'https://lolly.ing/#/team/project/p1',
        message: { workspace: 'lolly.ing', inviter: 'Andy', providers: ['Google', 'GitHub'], note: 'Use GitHub if Google is blocked.' },
      })
      : new Response('', { status: 404 }),
  });
  const field = panel.querySelector<HTMLTextAreaElement>('.team-people-invite textarea')!;
  const tick = panel.querySelector<HTMLInputElement>('[data-act="people-password"]')!;
  assert.equal(panel.querySelector(`label[for="${tick.id}"]`)!.textContent, 'Let them set a password from the invite link');
  assert.equal(document.getElementById(tick.getAttribute('aria-describedby')!)!.textContent, 'For people who cannot use Google or GitHub.');
  const type = (v: string): void => { field.value = v; field.dispatchEvent(new dom.window.Event('input')); };
  assert.equal(tick.checked, false);
  type('sam@suse.com');
  assert.equal(tick.checked, true, 'every address at a password domain');
  type('sam@suse.com, bo@gmail.com');
  assert.equal(tick.checked, false);
  type('sam@suse.com');
  assert.equal(tick.checked, true);

  panel.querySelector('.team-people-invite')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  assert.deepEqual(calls.find((c) => c.url === '/api/v1/projects/p1/invite')!.body, { emails: ['sam@suse.com'], role: 'editor', passwordSetup: true });
  const row = panel.querySelector<HTMLElement>('.team-people-results li')!;
  assert.match(row.textContent!, /Anyone with this link can set the password for sam@suse\.com\. Send the link privately\./);
  row.querySelector<HTMLElement>('[data-act="people-copy-message"]')!.click();
  await settle();
  assert.equal(row.querySelector<HTMLElement>('[data-act="people-copy-message"]')!.textContent, 'Copied!');
  assert.equal(copied.at(-1), [
    'Andy invited you to Summit on lolly.ing. Your role: Editor.',
    'https://lolly.ing/l/invite/t9',
    'Sign in as sam@suse.com with Google or GitHub.',
    'Open the link to set your password.',
    `This invitation ends on ${day('2026-11-02T12:00:00Z')}.`,
    'Use GitHub if Google is blocked.',
  ].join('\n'));
  // A new batch starts over, and a tick the person set stays set.
  assert.equal(tick.checked, false, 'the field is empty again');
  tick.click();
  assert.equal(tick.checked, true);
  type('bo@gmail.com');
  assert.equal(tick.checked, true, 'their choice, not the domain rule');
});

test('without the password option there is no tick, and an invited address is told who the link is for', async () => {
  reset();
  const { panel } = await mountR17({
    extra: (url) => url === '/api/v1/projects/p1/invite'
      ? json({ results: [{ email: 'bo@gmail.com', status: 'invited', link: 'https://lolly.ing/l/invite/b1' }], link: 'https://lolly.ing/#/team/project/p1', message: { workspace: 'lolly.ing', inviter: 'Andy', providers: ['GitHub'] } })
      : new Response('', { status: 404 }),
  });
  assert.equal(panel.querySelector('[data-act="people-password"]'), null);
  panel.querySelector<HTMLTextAreaElement>('.team-people-invite textarea')!.value = 'bo@gmail.com';
  panel.querySelector('.team-people-invite')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  assert.deepEqual(calls.find((c) => c.url === '/api/v1/projects/p1/invite')!.body, { emails: ['bo@gmail.com'], role: 'editor' });
  const row = panel.querySelector<HTMLElement>('.team-people-results li')!;
  assert.match(row.textContent!, /The link works only for someone who signs in as bo@gmail\.com\./);
  assert.equal(row.querySelector('[data-act="people-copy-message"]')!.textContent, 'Copy invite message');
});

test('someone added directly gets the share message; an older instance sends no words, so no message', async () => {
  reset();
  let body: unknown = { results: [{ email: 'bo@acme.com', status: 'added' }], link: 'https://instance.test/#/team/project/p1', message: { workspace: 'lolly.ing', inviter: 'Andy', providers: [] } };
  const { panel, copied } = await mountR17({ extra: (url) => url === '/api/v1/projects/p1/invite' ? json(body) : new Response('', { status: 404 }) });
  const submit = async (emails: string): Promise<void> => {
    panel.querySelector<HTMLTextAreaElement>('.team-people-invite textarea')!.value = emails;
    panel.querySelector('.team-people-invite')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await settle();
  };
  await submit('bo@acme.com');
  const btn = panel.querySelector<HTMLElement>('.team-people-results [data-act="people-copy-message"]')!;
  assert.equal(btn.textContent, 'Copy message');
  btn.click();
  await settle();
  assert.equal(copied.at(-1), 'Andy shared Summit with you on lolly.ing. Your role: Editor.\nhttps://instance.test/#/team/project/p1');
  body = { results: [{ email: 'new@acme.com', status: 'invited' }], link: 'https://instance.test/#/team/project/p1' };
  await submit('new@acme.com');
  assert.equal(panel.querySelector('.team-people-results [data-act="people-copy-message"]'), null);
});

test('a waiting row\'s message uses the instance\'s sign-ins when the list carries no words', async () => {
  reset();
  const { panel, copied } = await mountR17({
    list: { ...R17, message: undefined },
    extra: (url) => url === '/api/auth/config'
      ? json({ providers: [{ name: 'Google', kind: 'oidc' }, { name: 'Email and password', kind: 'password' }, { name: 'GitHub', kind: 'github' }] })
      : new Response('', { status: 404 }),
  });
  panel.querySelector<HTMLElement>('[data-invitation="i1"] [data-act="people-copy-message"]')!.click();
  await settle();
  const lines = copied.at(-1)!.split('\n');
  assert.equal(lines[0], 'Ana invited you to Summit on lolly.ing. Your role: Editor.', 'the workspace name from org-config');
  assert.equal(lines[2], 'Sign in as sam@suse.com with Google or GitHub.');
  assert.equal(calls.filter((c) => c.url === '/api/auth/config').length, 1, 'asked once');
});

test('the invite form: what each role may do, and who invites new people on this workspace', async () => {
  reset();
  const { panel } = await mountR17({ config: { can: {}, instance: { name: 'lolly.ing' }, invites: {} } });
  const role = panel.querySelector<HTMLSelectElement>('.team-people-invite select')!;
  assert.equal(document.getElementById(role.getAttribute('aria-describedby')!)!.textContent, 'Viewers open and copy. Editors save changes. Managers also add people.');
  assert.match(panel.querySelector('.team-people-invite')!.textContent!, /Only admins of lolly\.ing invite new people\. You can add people who already use lolly\.ing\./);
  reset();
  const unnamed = await mountR17({ config: { can: {}, invites: {} } });
  assert.match(unnamed.panel.querySelector('.team-people-invite')!.textContent!, /You can add people who already use this instance\./, 'no name: the earlier sentence');
});
