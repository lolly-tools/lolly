// SPDX-License-Identifier: MPL-2.0
/**
 * org/identities.ts and org/linked-signins.ts - "Linked sign-ins" in the profile
 * view (plan 74 scope change), plus the member-only org-config wiring the People
 * action reads.
 *
 *  1. DORMANCY: with no control plane, mountOrgAccount adds nothing and fetches
 *     nothing, and the profile view's generic slot (lib/profile-sections.ts) has
 *     nothing registered, so the profile view is unchanged.
 *  2. The adapter maps the identities list, reads the providers from the auth
 *     config, builds the link address, and keeps a refusal's status.
 *  3. A member's card lists the sign-ins, removes one after asking, and offers a
 *     Link action per provider that comes back to this view.
 *  4. With `invites` in org-config, the Team projects modal offers People to any
 *     member of a project (to read the list) and to a manager (to change the list).
 *
 * Run directly:  node --test shells/web/src/org/identities.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/#/profile', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.Element = dom.window.Element as unknown as typeof Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;
globalThis.sessionStorage = dom.window.sessionStorage;
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
const calls: Array<{ url: string; method: string }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(input), method: (init?.method ?? 'GET').toUpperCase() });
  return router(String(input), init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { listIdentities, unlinkIdentity, listSignInProviders, linkSignInHref, identityFromRow } = await import('./identities.ts');
const { mountLinkedSignIns, unlinkMessage } = await import('./linked-signins.ts');
const { initOrg, mountOrgAccount, _resetOrgForTests } = await import('./index.ts');
const { openTeamProjectsModal } = await import('./team-projects.ts');
const { _clearSessionSourceForTests } = await import('../lib/session-source.ts');
const { _clearShareSectionsForTests } = await import('../lib/share-sections.ts');
const { mountProfileSections } = await import('../lib/profile-sections.ts');

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 10; i++) await tick(); }

function reset(): void {
  _resetOrgForTests();
  _clearSessionSourceForTests();
  _clearShareSectionsForTests();
  store.clear();
  calls.length = 0;
  router = () => new Response('', { status: 404 });
  document.querySelectorAll('dialog').forEach((d) => { d.remove(); });
  document.getElementById('view')!.replaceChildren();
}

const IDENTITIES = {
  identities: [
    { idp: 'primary', displayName: 'Google', email: 'ana@gmail.com', linkedAt: '2026-10-01T00:00:00Z', lastLoginAt: '2026-10-01T00:00:00Z', canUnlink: true, subjectHash: 'h1' },
    { idp: 'github', displayName: 'GitHub', email: 'ana@users.noreply.github.com', linkedAt: '2026-10-02T00:00:00Z', canUnlink: false, subjectHash: 'h2' },
  ],
};
const PROVIDERS = { mode: 'open', provider: 'oidc', loginPath: '/api/auth/login', providers: [
  { id: 'primary', name: 'Google', loginPath: '/api/auth/login?idp=primary' },
  { id: 'github', name: 'GitHub', loginPath: '/api/auth/login?idp=github' },
] };

// ── 1. Dormancy ──────────────────────────────────────────────────────────────

test('no control plane: the account card adds nothing and asks nothing', async () => {
  reset();
  router = () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
  assert.equal(await initOrg(), null);
  calls.length = 0;
  const into = document.createElement('div');
  assert.equal(mountOrgAccount(into), false);
  mountProfileSections(into);
  await settle();
  assert.equal(into.childNodes.length, 0);
  assert.equal(calls.length, 0);
});

// ── 2. Adapter ───────────────────────────────────────────────────────────────

test('the identities list, providers and link address', async () => {
  reset();
  router = (url) => {
    if (url === '/api/v1/me/identities') return json(IDENTITIES);
    if (url === '/api/auth/config') return json(PROVIDERS);
    return new Response('', { status: 404 });
  };
  const got = await listIdentities();
  assert.ok(got.ok);
  assert.deepEqual(got.data.map((i) => [i.idp, i.displayName, i.canUnlink]), [['primary', 'Google', true], ['github', 'GitHub', false]]);
  assert.deepEqual(await listSignInProviders(), [{ id: 'primary', name: 'Google' }, { id: 'github', name: 'GitHub' }]);
  assert.equal(linkSignInHref('github', '/#/profile?focus=x'), '/api/auth/link?idp=github&returnTo=%2F%23%2Fprofile%3Ffocus%3Dx');
  assert.equal(linkSignInHref('github', '//evil.test'), '/api/auth/link?idp=github&returnTo=%2F', 'never an off-site return');
  assert.equal(identityFromRow({ idp: 'x', canUnlink: true })!.canUnlink, false, 'no key to remove it by: not removable');
  assert.equal(identityFromRow({ displayName: 'nameless' }), null);
});

test('a refusal keeps its status', async () => {
  reset();
  router = () => json({ error: {} }, 409);
  assert.deepEqual(await unlinkIdentity({ idp: 'primary', subjectHash: 'h1' }), { ok: false, status: 409 });
  assert.match(unlinkMessage(409), /only sign-in/);
  router = () => json({ error: {} }, 401);
  assert.deepEqual(await listIdentities(), { ok: false, status: 401 });
  router = () => { throw new Error('offline'); };
  assert.deepEqual(await listIdentities(), { ok: false, status: 0 });
  assert.deepEqual(await listSignInProviders(), []);
  assert.deepEqual(await unlinkIdentity({ idp: 'x' }), { ok: false, status: 400 });
});

// ── 3. The card ──────────────────────────────────────────────────────────────

test('a member sees the sign-ins, removes one after asking, and can link another', async () => {
  reset();
  let list = IDENTITIES;
  router = (url, init) => {
    if (url === '/api/v1/me/identities') return json(list);
    if (url === '/api/auth/config') return json(PROVIDERS);
    if (url === '/api/v1/me/identities/primary/h1' && init?.method === 'DELETE') {
      list = { identities: [IDENTITIES.identities[1]!] };
      return new Response(null, { status: 204 });
    }
    return new Response('', { status: 404 });
  };
  const into = document.createElement('div');
  document.body.append(into);
  await mountLinkedSignIns(into, { returnTo: () => '/#/profile' });
  const rows = [...into.querySelectorAll<HTMLElement>('[data-idp]')];
  assert.deepEqual(rows.map((r) => r.dataset.idp), ['primary', 'github']);
  assert.match(rows[0]!.textContent!, /ana@gmail\.com/);
  assert.equal(rows[1]!.querySelector('[data-act="identity-unlink"]'), null, 'the instance said this one stays');
  const links = [...into.querySelectorAll<HTMLAnchorElement>('[data-act="identity-link"]')].map((a) => [a.textContent, a.getAttribute('href')]);
  assert.deepEqual(links, [
    ['Link Google', '/api/auth/link?idp=primary&returnTo=%2F%23%2Fprofile'],
    ['Link GitHub', '/api/auth/link?idp=github&returnTo=%2F%23%2Fprofile'],
  ]);
  rows[0]!.querySelector<HTMLElement>('[data-act="identity-unlink"]')!.click();
  await settle();
  const confirm = document.querySelector('dialog[open]');
  assert.ok(confirm, 'asks first');
  confirm.querySelector<HTMLElement>('[data-act="ok"]')!.click();
  await settle();
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url === '/api/v1/me/identities/primary/h1'));
  assert.deepEqual([...into.querySelectorAll<HTMLElement>('[data-idp]')].map((r) => r.dataset.idp), ['github']);
  into.remove();
});

test('the sign-in the account was created with says why it stays, and a refused remove reads the code', async () => {
  reset();
  // The rows lolly-work sends: the account's own sign-in carries canUnlink false and
  // unlinkBlocked 'account'; a later link carries canUnlink true.
  const rows = {
    identities: [
      { idp: 'primary', subjectHash: 'a1b2c3d4e5f60718', displayName: 'Google', email: 'ana@gmail.com', emailVerified: true, linkedAt: '2026-10-01T00:00:00Z', lastLoginAt: null, canUnlink: false, unlinkBlocked: 'account' },
      { idp: 'github', subjectHash: '0f1e2d3c4b5a6978', displayName: 'GitHub', email: null, emailVerified: false, linkedAt: '2026-10-02T00:00:00Z', lastLoginAt: null, canUnlink: true },
    ],
    available: [{ id: 'github', name: 'GitHub', kind: 'github', linkPath: '/api/auth/link?idp=github' }],
  };
  router = (url, init) => {
    if (url === '/api/v1/me/identities') return json(rows);
    if (url === '/api/auth/config') return json(PROVIDERS);
    if (url === '/api/v1/me/identities/github/0f1e2d3c4b5a6978' && init?.method === 'DELETE') return json({ error: { code: 'ACCOUNT_SIGN_IN', message: 'stays' } }, 409);
    return new Response('', { status: 404 });
  };
  const got = await listIdentities();
  assert.ok(got.ok);
  assert.deepEqual(got.data.map((i) => [i.idp, i.canUnlink, i.unlinkBlocked ?? null, i.email ?? null]), [
    ['primary', false, 'account', 'ana@gmail.com'], ['github', true, null, null],
  ]);
  assert.deepEqual(await unlinkIdentity(got.data[1]!), { ok: false, status: 409, code: 'ACCOUNT_SIGN_IN' });
  assert.equal(unlinkMessage(409, 'ACCOUNT_SIGN_IN'), 'Your account was created with this sign-in, so it stays.');
  assert.match(unlinkMessage(409, 'LAST_SIGN_IN'), /only sign-in/);

  const into = document.createElement('div');
  document.body.append(into);
  await mountLinkedSignIns(into, { returnTo: () => '/#/profile' });
  const account = into.querySelector<HTMLElement>('[data-idp="primary"]')!;
  assert.match(account.textContent!, /created with this sign-in, so it stays/);
  assert.equal(account.querySelector('[data-act="identity-unlink"]'), null);
  into.remove();
});

test('an older instance with no identities route shows nothing', async () => {
  reset();
  router = (url) => url === '/api/auth/config' ? json(PROVIDERS) : new Response('', { status: 404 });
  const into = document.createElement('div');
  document.body.append(into);
  await mountLinkedSignIns(into);
  assert.equal(into.childNodes.length, 0);
  into.remove();
});

// ── 4. Member wiring: the account hook and the People action ─────────────────

function memberRouter(orgConfig: Record<string, unknown>): Handler {
  return (url) => {
    if (url === '/api/auth/config') return json(PROVIDERS);
    if (url === '/api/auth/session') return json({ kind: 'member', user: { sub: 'u1', role: 'member' } });
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, inboxUnread: 0, ...orgConfig });
    if (url === '/api/v1/me/identities') return json(IDENTITIES);
    if (url === '/api/v1/projects') return json({ projects: [{ id: 'p1', name: 'Summit', myRole: 'manager' }, { id: 'p2', name: 'Other', myRole: 'editor' }] });
    if (url === '/api/v1/projects/p1/sessions' || url === '/api/v1/projects/p2/sessions') return json({ sessions: [] });
    if (url === '/api/v1/projects/p1/members') return json({ myRole: 'manager', members: [{ userId: 'u1', name: 'Ana', role: 'manager' }], invitations: [] });
    if (url === '/api/v1/projects/p2/members') return json({ myRole: 'editor', members: [{ userId: 'u9', name: 'Bo', role: 'owner' }, { userId: 'u1', name: 'Ana', role: 'editor' }] });
    return new Response('', { status: 404 });
  };
}

test('a member: the account hook fills the card', async () => {
  reset();
  router = memberRouter({ can: { 'user.invite': true }, invites: {} });
  await initOrg();
  const into = document.createElement('div');
  assert.equal(mountOrgAccount(into), true);
  await settle();
  assert.ok(into.querySelector('.org-linked-signins'));
});

test('a member: the profile view reaches the card through the generic slot only', async () => {
  reset();
  router = memberRouter({ can: { 'user.invite': true }, invites: {} });
  await initOrg();
  const into = document.createElement('div');
  mountProfileSections(into);
  await settle();
  assert.ok(into.querySelector('.org-linked-signins'), 'org/ registered the card');
  // The view imports no control-plane module.
  const { readFileSync } = await import('node:fs');
  const chrome = readFileSync(new URL('../views/profile/chrome.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(chrome, /org\/index\.ts|mountOrgAccount/);
  // Reset drops the registration, so the slot is empty again.
  _resetOrgForTests();
  const empty = document.createElement('div');
  mountProfileSections(empty);
  await settle();
  assert.equal(empty.childNodes.length, 0);
});

test('People: a manager manages, an editor without the invite bit still sees who has access', async () => {
  reset();
  router = memberRouter({ can: { 'user.invite': false }, invites: { projectRoles: ['viewer', 'editor'] } });
  await initOrg();
  openTeamProjectsModal({ toolName: (id) => id, initialProject: { id: 'p1' } });
  await settle();
  const dialog = document.querySelector('dialog')!;
  const people = dialog.querySelector<HTMLElement>('[data-team-people]');
  assert.ok(people, 'a manager gets People');
  people.click();
  await settle();
  assert.match(dialog.textContent!, /People with access/);
  assert.ok(dialog.querySelector('form.team-people-invite'), 'a manager can add people');
  assert.match(dialog.textContent!, /already use this instance/, 'and is told new people cannot be invited');
  dialog.querySelector<HTMLElement>('[data-act="people-back"]')!.click();
  await settle();
  assert.ok(dialog.querySelector('[data-team-back]'), 'Back returns to the sessions');
  assert.equal(document.activeElement, dialog.querySelector('[data-team-people]'), 'focus goes back to People');
  dialog.remove();

  // Seeing who shares a project does not need the right to invite new people.
  openTeamProjectsModal({ toolName: (id) => id, initialProject: { id: 'p2' } });
  await settle();
  const second = document.querySelector('dialog')!;
  const read = second.querySelector<HTMLElement>('[data-team-people]');
  assert.ok(read, 'an editor gets People');
  read.click();
  await settle();
  assert.match(second.textContent!, /Bo/);
  assert.equal(second.querySelector('form.team-people-invite'), null, 'but nothing to change');
  assert.equal(second.querySelector('[data-act="people-remove"]'), null);
});
