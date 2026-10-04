// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-link.ts - the `#/team/<sessionId>` deep link (plan 74, W-SHARE-UI).
 *
 * The resolver is pure and proved case by case: a bad id, a member (open it), an
 * instance without a session (sign in, coming back to this link), no instance at all.
 * The route itself is then mounted into a jsdom view against a stubbed fetch, for the
 * outcomes that need no tool to be built: the two notices, and the clear sentences
 * for a deleted (410) and an unknown (404) session. Also the Team projects modal's
 * "New project" action, which shares the create form with the Share dialog.
 *
 * Run directly:  node --test shells/web/src/org/team-link.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/#/team/sess-1', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.Element = dom.window.Element as unknown as typeof Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;
globalThis.sessionStorage = dom.window.sessionStorage;
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
const posts: Array<{ url: string; body: unknown }> = [];
const recordingFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if ((init?.method ?? 'GET') === 'POST' && typeof init?.body === 'string') posts.push({ url: String(input), body: JSON.parse(init.body) });
  return router(String(input), init);
}) as typeof fetch;
globalThis.fetch = recordingFetch;
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { planTeamLink, teamLinkSessionId, mountTeamLink } = await import('./team-link.ts');
const { teamOpenMessage } = await import('./team-open.ts');
const { openTeamProjectsModal } = await import('./team-projects.ts');
const { createInstanceSessionSource } = await import('./session-source.ts');
const { registerSessionSource, _clearSessionSourceForTests } = await import('../lib/session-source.ts');
const { setHostRef } = await import('../lib/host-ref.ts');
const { pendingTeamSessionOrigin, _clearTeamSessionOriginForTests } = await import('./team-session-origin.ts');
type HostV1 = Parameters<typeof setHostRef>[0];

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 6; i++) await tick(); }
const view = (): HTMLElement => document.getElementById('view')!;

function reset(): void {
  _clearSessionSourceForTests();
  _clearTeamSessionOriginForTests();
  router = () => new Response('', { status: 404 });
  posts.length = 0;
  view().replaceChildren();
  document.querySelectorAll('dialog').forEach((d) => { d.remove(); });
  dom.window.location.hash = '#/team/sess-1';
}

// ── The resolver ──────────────────────────────────────────────────────────────

test('teamLinkSessionId accepts plain ids and refuses anything else', () => {
  assert.equal(teamLinkSessionId('sess_1-a.b~c'), 'sess_1-a.b~c');
  assert.equal(teamLinkSessionId('sess%2D1'), 'sess-1');
  assert.equal(teamLinkSessionId(''), '');
  assert.equal(teamLinkSessionId(undefined), '');
  assert.equal(teamLinkSessionId('a/b'), '');
  assert.equal(teamLinkSessionId('%E0%A4%A'), '', 'a broken escape is not an id');
  assert.equal(teamLinkSessionId('<script>'), '');
});

test('planTeamLink: invalid, open, sign in (coming back here), no instance', () => {
  const base = { sessionId: 'sess-1', returnTo: '/#/team/sess-1' };
  assert.deepEqual(planTeamLink({ ...base, sessionId: '', hasSource: true, loginPath: undefined }), { kind: 'invalid' });
  assert.deepEqual(planTeamLink({ ...base, hasSource: true, loginPath: undefined }), { kind: 'open', sessionId: 'sess-1' });
  assert.deepEqual(planTeamLink({ ...base, hasSource: false, loginPath: '/api/auth/login' }),
    { kind: 'sign-in', href: '/api/auth/login?returnTo=%2F%23%2Fteam%2Fsess-1' });
  assert.deepEqual(planTeamLink({ ...base, hasSource: false, loginPath: '/login?x=1' }),
    { kind: 'sign-in', href: '/login?x=1&returnTo=%2F%23%2Fteam%2Fsess-1' });
  assert.deepEqual(planTeamLink({ ...base, hasSource: false, loginPath: 'javascript:alert(1)' }), { kind: 'sign-in', href: null },
    'a hostile sign-in path never reaches an href');
  assert.deepEqual(planTeamLink({ ...base, hasSource: false, loginPath: null }), { kind: 'sign-in', href: null });
  assert.deepEqual(planTeamLink({ ...base, hasSource: false, loginPath: undefined }), { kind: 'no-instance' });
});

test('the failure sentences name 404 and 410 apart', () => {
  assert.match(teamOpenMessage(410), /deleted/);
  assert.match(teamOpenMessage(404), /not found/);
  assert.notEqual(teamOpenMessage(403), teamOpenMessage(500));
});

// ── The route ─────────────────────────────────────────────────────────────────

test('no instance: a short notice, and nothing is armed', async () => {
  reset();
  router = () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
  await mountTeamLink(view(), 'sess-1');
  assert.match(view().textContent ?? '', /not connected to one/);
  assert.equal(pendingTeamSessionOrigin(), null);
});

test('an instance that does not answer is not called "no instance": the link can be tried again', async () => {
  reset();
  globalThis.fetch = (async () => { throw new TypeError('network down'); }) as typeof fetch;
  try {
    await mountTeamLink(view(), 'sess-1');
    assert.doesNotMatch(view().textContent ?? '', /not connected to one/);
    assert.match(view().textContent ?? '', /could not be reached/);
    const again = view().querySelector<HTMLButtonElement>('button[data-team-retry]');
    assert.ok(again, 'a Try again action');
  } finally {
    globalThis.fetch = recordingFetch;
  }
  assert.deepEqual(planTeamLink({ sessionId: 'sess-1', hasSource: false, loginPath: undefined, unreachable: true, returnTo: '/' }), { kind: 'unreachable' });
});

test('an instance but no member session: a sign-in link that returns to this link', async () => {
  reset();
  router = (url) => url.includes('/api/auth/config')
    ? json({ mode: 'open', provider: 'oidc', loginPath: '/api/auth/login' })
    : new Response('', { status: 404 });
  await mountTeamLink(view(), 'sess-1');
  const a = view().querySelector<HTMLAnchorElement>('a.btn');
  assert.ok(a, 'a sign-in link');
  assert.equal(a!.getAttribute('href'), '/api/auth/login?returnTo=%2F%23%2Fteam%2Fsess-1');
});

test('a member: a deleted session and an unknown one each get their own sentence', async () => {
  reset();
  setHostRef({ log: () => {} } as unknown as HostV1);
  registerSessionSource(createInstanceSessionSource('Acme', () => null));
  router = (url) => url.endsWith('/api/v1/sessions/gone') ? json({ error: { code: 'GONE' } }, 410) : json({ error: { code: 'NOT_FOUND' } }, 404);
  await mountTeamLink(view(), 'gone');
  assert.match(view().textContent ?? '', /Opening the team session/);
  await settle();
  assert.match(view().textContent ?? '', /was deleted/);
  assert.equal(pendingTeamSessionOrigin(), null, 'a failed open arms nothing');

  reset();
  registerSessionSource(createInstanceSessionSource('Acme', () => null));
  await mountTeamLink(view(), 'missing');
  await settle();
  assert.match(view().textContent ?? '', /not found/);
  assert.equal(view().querySelector('a.btn')?.getAttribute('href'), '#/p');
});

test('an incomplete link says so without asking the instance', async () => {
  reset();
  let asked = 0;
  router = () => { asked++; return new Response('', { status: 404 }); };
  await mountTeamLink(view(), '');
  assert.match(view().textContent ?? '', /incomplete/);
  assert.equal(asked, 0);
});

test('leaving before the session arrives abandons the open', async () => {
  reset();
  setHostRef({ log: () => {} } as unknown as HostV1);
  registerSessionSource(createInstanceSessionSource('Acme', () => null));
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  router = () => json({ error: { code: 'NOT_FOUND' } }, 404);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => { await gate; return router(String(input), init); }) as typeof fetch;
  try {
    await mountTeamLink(view(), 'sess-1');
    (view() as HTMLElement & { _cleanup?: () => void })._cleanup?.();
    view().replaceChildren(); // the next route's view
    release();
    await settle();
    assert.equal(view().textContent, '', 'nothing paints over the view that replaced it');
  } finally {
    globalThis.fetch = recordingFetch;
  }
});

// ── Team projects modal: New project ──────────────────────────────────────────

test('Team projects: "New project" creates one with the chosen visibility, then shows it', async () => {
  reset();
  registerSessionSource(createInstanceSessionSource('Acme', () => ({ can: { 'project.create': true }, sharing: { groups: ['design'] } })));
  router = (url, init) => {
    if (url.endsWith('/api/v1/projects') && (init?.method ?? 'GET') === 'POST') return json({ id: 'p9', name: 'Launch' }, 201);
    if (url.endsWith('/api/v1/projects')) return json({ projects: [] });
    if (url.endsWith('/api/v1/projects/p9/sessions')) return json({ sessions: [] });
    return new Response('', { status: 404 });
  };
  openTeamProjectsModal({ host: {} as HostV1, toolName: (id) => id });
  await settle();
  const dialog = document.querySelector('dialog.team-projects-dialog')!;
  dialog.querySelector<HTMLElement>('[data-team-new]')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const form = dialog.querySelector<HTMLFormElement>('form.team-new-project')!;
  assert.ok(form, 'the create form opens in place');
  const select = form.querySelector('select')!;
  assert.deepEqual([...select.options].map((o) => o.textContent), ['Only people I add', 'Everyone in design']);
  form.querySelector<HTMLInputElement>('input')!.value = 'Launch';
  select.value = 'g:design';
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  assert.deepEqual(posts, [{ url: '/api/v1/projects', body: { name: 'Launch', visibility: { groups: ['design'] } } }]);
  assert.match(dialog.textContent ?? '', /Launch/);
  assert.match(dialog.textContent ?? '', /no sessions yet/);
});

test('Team projects: no "New project" when the instance says the person may not create', async () => {
  reset();
  registerSessionSource(createInstanceSessionSource('Acme', () => ({ can: { 'project.create': false } })));
  router = () => json({ projects: [] });
  openTeamProjectsModal({ host: {} as HostV1, toolName: (id) => id });
  await settle();
  assert.equal(document.querySelector('dialog.team-projects-dialog [data-team-new]'), null);
});
