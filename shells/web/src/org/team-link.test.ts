// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-link.ts - the `#/team/<sessionId>` deep link (plan 74, W-SHARE-UI).
 *
 * The resolver is pure and proved case by case: a bad id, a member (open it), an
 * instance without a session (sign in, coming back to this link), no instance at all.
 * The route itself is then mounted into a jsdom view against a stubbed fetch, for the
 * outcomes that need no tool to be built: the two notices, and the clear sentences
 * for a deleted (410) and an unknown (404) session. Also the Team projects modal's
 * "New project" action, which shares the create form with the Share dialog. And a
 * member the instance turns away (plans/75 G13): a 403 asks for access to the
 * session's project through the session, and a 401 offers Sign in. And a link to one
 * comment thread (plan 76 M4): the thread id is checked, held for the session's
 * comments panel, carried through sign-in, and held again by the open that follows an
 * access answer, however late that answer comes.
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
globalThis.localStorage = dom.window.localStorage;
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

const { planTeamLink, teamLinkSessionId, teamLinkThread, mountTeamLink } = await import('./team-link.ts');
const { onReviewTarget, takeReviewTarget, REVIEW_TARGET_TTL_MS } = await import('../lib/review-target.ts');
const { teamOpenMessage } = await import('./team-open.ts');
const { openTeamProjectsModal } = await import('./team-projects.ts');
const { createInstanceSessionSource } = await import('./session-source.ts');
const { registerSessionSource, _clearSessionSourceForTests } = await import('../lib/session-source.ts');
const { setHostRef } = await import('../lib/host-ref.ts');
const { pendingTeamSessionOrigin, _clearTeamSessionOriginForTests } = await import('./team-session-origin.ts');
const { initOrg, _resetOrgForTests } = await import('./index.ts');
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

// ── Turned away: no access, a lapsed sign-in ──────────────────────────────────

/** A signed-in member of Acme whose org-config takes project requests; then `route`
 *  answers everything else. */
async function member(route: Handler): Promise<void> {
  reset();
  _resetOrgForTests();
  setHostRef({ log: () => {} } as unknown as HostV1);
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/api/auth/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', email: 'bo@acme.test', role: 'member' } });
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, inboxUnread: 0, requests: { project: true } });
    return new Response('', { status: 404 });
  };
  await initOrg();
  posts.length = 0;
  router = route;
}

test('a session this member may not open: the sentence, who they are, and a request through the session', async () => {
  await member((url, init) => {
    if (url.endsWith('/api/v1/sessions/sess-1')) return json({ error: { code: 'FORBIDDEN' } }, 403);
    if (url === '/api/v1/access-requests/mine?sessionId=sess-1') return json({ requests: [] });
    if (url === '/api/v1/sessions/sess-1/access-requests' && init?.method === 'POST') return json({ ok: true }, 202);
    return new Response('', { status: 404 });
  });
  await mountTeamLink(view(), 'sess-1');
  await settle();
  const text = view().textContent ?? '';
  assert.match(text, /You do not have access to this team session\./);
  assert.match(text, /You are signed in to Acme as bo@acme\.test\./);
  assert.ok(view().querySelector('[data-team-switch-account]'));
  const form = view().querySelector('[data-team-ask] form')!;
  form.querySelector('select')!.value = 'viewer';
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  assert.deepEqual(posts, [{ url: '/api/v1/sessions/sess-1/access-requests', body: { role: 'viewer' } }]);
  _resetOrgForTests();
});

test('a lapsed sign-in on a session link offers Sign in, coming back to the link', async () => {
  await member((url) => url.endsWith('/api/v1/sessions/sess-1') ? json({ error: {} }, 401) : new Response('', { status: 404 }));
  await mountTeamLink(view(), 'sess-1');
  await settle();
  assert.match(view().textContent ?? '', /Your sign-in has expired\. Sign in again to open the link\./);
  assert.equal(view().querySelector('a.btn')?.getAttribute('href'), '/api/auth/login?returnTo=%2F%23%2Fteam%2Fsess-1');
  _resetOrgForTests();
});

// ── A link to one comment thread ──────────────────────────────────────────────

test('teamLinkThread takes a comment id from the link and refuses anything else', () => {
  assert.equal(teamLinkThread('#/team/sess-1?thread=th_1'), 'th_1');
  assert.equal(teamLinkThread('#/team/sess-1?x=1&thread=c-2'), 'c-2');
  assert.equal(teamLinkThread('#/team/sess-1?thread=th%5F1'), 'th_1', 'an escaped id is read as the id');
  assert.equal(teamLinkThread('#/team/sess-1'), '');
  assert.equal(teamLinkThread('#/team/sess-1?thread='), '');
  assert.equal(teamLinkThread(undefined), '');
  assert.equal(teamLinkThread('#/team/sess-1?thread=%3Cscript%3E'), '');
  assert.equal(teamLinkThread('#/team/sess-1?thread=th.1'), '', 'a dot is not in a comment id');
  assert.equal(teamLinkThread('#/team/sess-1?thread=th%201'), '');
  assert.equal(teamLinkThread(`#/team/sess-1?thread=${'a'.repeat(81)}`), '', 'longer than a comment id');
  assert.equal(teamLinkThread('#/team/sess-1?thread=%E0%A4%A'), '', 'a broken escape is not an id');
});

/** Collect the targets listeners hear while `fn` runs. */
async function hearing(fn: (heard: Array<[string, string]>) => Promise<void>): Promise<void> {
  const heard: Array<[string, string]> = [];
  const off = onReviewTarget((sessionId, threadId) => { heard.push([sessionId, threadId]); });
  try { await fn(heard); } finally { off(); }
}

test('a thread link: the open holds the thread, and a panel already showing the session hears it at once', async () => {
  reset();
  setHostRef({ log: () => {} } as unknown as HostV1);
  registerSessionSource(createInstanceSessionSource('Acme', () => null));
  dom.window.location.hash = '#/team/sess-1?thread=th_1';
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  router = () => json({ error: { code: 'NOT_FOUND' } }, 404);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => { await gate; return router(String(input), init); }) as typeof fetch;
  try {
    await hearing(async (heard) => {
      await mountTeamLink(view(), 'sess-1');
      assert.match(view().textContent ?? '', /Opening the team session/);
      assert.deepEqual(heard, [['sess-1', 'th_1']], 'told while the session is still on its way');
      release();
      await settle();
    });
    assert.equal(takeReviewTarget('sess-1'), 'th_1', 'held for the comments panel of the session');
    assert.equal(takeReviewTarget('sess-1'), undefined, 'a target is taken once');
  } finally {
    release();
    globalThis.fetch = recordingFetch;
  }
});

test('a thread link whose id is not a comment id opens the session and holds no thread', async () => {
  reset();
  setHostRef({ log: () => {} } as unknown as HostV1);
  registerSessionSource(createInstanceSessionSource('Acme', () => null));
  router = (url) => url.endsWith('/api/v1/sessions/sess-1') ? json({ error: { code: 'GONE' } }, 410) : new Response('', { status: 404 });
  for (const bad of ['%3Cscript%3E', 'th.1', 'a'.repeat(81)]) {
    view().replaceChildren();
    dom.window.location.hash = `#/team/sess-1?thread=${bad}`;
    await hearing(async (heard) => {
      await mountTeamLink(view(), 'sess-1');
      await settle();
      assert.deepEqual(heard, [], `nothing told for ${bad}`);
    });
    assert.match(view().textContent ?? '', /was deleted/, 'the session itself was still opened');
    assert.equal(takeReviewTarget('sess-1'), undefined);
  }
});

test('a thread link signed out: Sign in comes back to the thread, and nothing is held before then', async () => {
  reset();
  dom.window.location.hash = '#/team/sess-1?thread=th_1';
  router = (url) => url.includes('/api/auth/config')
    ? json({ mode: 'open', provider: 'oidc', loginPath: '/api/auth/login' })
    : new Response('', { status: 404 });
  await hearing(async (heard) => {
    await mountTeamLink(view(), 'sess-1');
    assert.deepEqual(heard, []);
  });
  assert.equal(view().querySelector('a.btn')?.getAttribute('href'), '/api/auth/login?returnTo=%2F%23%2Fteam%2Fsess-1%3Fthread%3Dth_1');
  assert.equal(takeReviewTarget('sess-1'), undefined);
});

test('a thread link turned away (403): an answer that gives access more than two minutes later holds the thread afresh', async () => {
  const realNow = Date.now;
  let later = 0;
  Date.now = () => realNow() + later;
  try {
    await member((url) => {
      if (url.endsWith('/api/v1/sessions/sess-1')) return json({ error: { code: 'FORBIDDEN' } }, 403);
      if (url === '/api/v1/access-requests/mine?sessionId=sess-1') {
        return json({ requests: [{ id: 'req_1', status: 'open', role: 'editor', createdAt: new Date(realNow()).toISOString() }] });
      }
      if (url.endsWith('/api/v1/inbox')) {
        return json({ messages: [{ id: 'msg_1', kind: 'request', severity: 'info', title: 'Access approved', dismissible: true,
          data: { kind: 'access-answer', requestId: 'req_1', outcome: 'approved' } }] });
      }
      return new Response('', { status: 404 });
    });
    dom.window.location.hash = '#/team/sess-1?thread=th_1';
    await hearing(async (heard) => {
      await mountTeamLink(view(), 'sess-1');
      await settle();
      assert.match(view().textContent ?? '', /You do not have access to this team session\./);
      assert.deepEqual(heard, [['sess-1', 'th_1']], 'the first open held the thread');
      // The answer arrives after the first hold has run out.
      later = REVIEW_TARGET_TTL_MS + 1_000;
      const { refreshInbox } = await import('./inbox.ts');
      await refreshInbox({ force: true });
      await settle();
      assert.deepEqual(heard, [['sess-1', 'th_1'], ['sess-1', 'th_1']], 'the open after the answer held it again');
    });
    assert.equal(takeReviewTarget('sess-1'), 'th_1', 'held afresh, so it has not run out');
  } finally {
    Date.now = realNow;
    _resetOrgForTests();
  }
});
