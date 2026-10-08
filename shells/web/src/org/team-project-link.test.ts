// SPDX-License-Identifier: MPL-2.0
/**
 * The `#/team/project/<projectId>` link (plan 74 scope change), the project and
 * session list fields it relies on, and what a person's project role changes.
 *
 *  1. The resolver is pure: a bad id, a member (open it), an instance without a
 *     session (sign in, coming back to this link), no instance, no answer.
 *  2. The route mounted through org/team-link.ts: a 404 and a 403 say which; a
 *     member goes on to Projects, which is asked to open the Team projects dialog on
 *     that project. The dialog itself: the "Edited by" line, a session count,
 *     focus, Close and Escape.
 *  3. The list adapter carries `myRole` and `updatedByName` only when sent.
 *  4. The Share dialog's Team section offers a viewer "Save a copy to a project"
 *     instead of "Save changes", and leaves the viewer's projects out of the list.
 *  6. A member the instance turns away (plans/75 G13): a 403 says who they are
 *     signed in as and offers Ask for access (when the instance takes requests) and
 *     Use a different account; an approval opens the link again; a 401 offers
 *     Sign in, coming back to the link.
 *
 * Run directly:  node --test shells/web/src/org/team-project-link.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/#/team/project/p1', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
// The overlay Back stack (lib/overlay-back.ts) pushes and pops real history entries.
globalThis.history = dom.window.history as unknown as History;
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
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => router(String(input), init)) as typeof fetch;
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { planTeamProjectLink, teamProjectLinkId, teamProjectMessage } = await import('./team-project-link.ts');
const { mountTeamLink } = await import('./team-link.ts');
const { createInstanceSessionSource, fetchTeamProjectSessions } = await import('./session-source.ts');
const { registerSessionSource, takeSourceProjectRequest, _clearSessionSourceForTests } = await import('../lib/session-source.ts');
const { openTeamProjectsModal } = await import('./team-projects.ts');
const { buildTeamShareSection, _clearTeamProjectsForTests } = await import('./team-save.ts');
const { adoptTeamSessionOrigin, _clearTeamSessionOriginForTests } = await import('./team-session-origin.ts');
const { initOrg, _resetOrgForTests } = await import('./index.ts');
const { noAccessCard, switchAccountHref } = await import('./team-link-shared.ts');
type AnswerMessage = import('./access-request.ts').AnswerMessage;

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 10; i++) await tick(); }
async function until(ok: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}
const view = (): HTMLElement => document.getElementById('view')!;
const HOUR = 3600_000;
const ago = (h: number): string => new Date(Date.now() - h * HOUR).toISOString();

function reset(hash = '#/team/project/p1'): void {
  _clearSessionSourceForTests();
  _clearTeamSessionOriginForTests();
  _clearTeamProjectsForTests();
  store.clear();
  router = () => new Response('', { status: 404 });
  document.querySelectorAll('dialog').forEach((d) => { d.remove(); });
  document.body.querySelectorAll('section.share-team').forEach((s) => { s.remove(); });
  view().replaceChildren();
  window.location.hash = hash;
}

// ── 1. Resolver ──────────────────────────────────────────────────────────────

test('planTeamProjectLink: each case', () => {
  const base = { returnTo: '/#/team/project/p1' };
  assert.deepEqual(planTeamProjectLink({ ...base, projectId: '', hasSource: true, loginPath: '/x' }), { kind: 'invalid' });
  assert.deepEqual(planTeamProjectLink({ ...base, projectId: 'p1', hasSource: true, loginPath: undefined }), { kind: 'open', projectId: 'p1' });
  assert.deepEqual(planTeamProjectLink({ ...base, projectId: 'p1', hasSource: false, loginPath: '/api/auth/login' }), {
    kind: 'sign-in', href: '/api/auth/login?returnTo=%2F%23%2Fteam%2Fproject%2Fp1',
  });
  assert.deepEqual(planTeamProjectLink({ ...base, projectId: 'p1', hasSource: false, loginPath: undefined }), { kind: 'no-instance' });
  assert.deepEqual(planTeamProjectLink({ ...base, projectId: 'p1', hasSource: false, loginPath: undefined, unreachable: true }), { kind: 'unreachable' });
  assert.equal(teamProjectLinkId('p%2D1'), 'p-1');
  assert.equal(teamProjectLinkId('a/b'), '');
  assert.match(teamProjectMessage(404), /not found/);
  assert.match(teamProjectMessage(403), /do not have access to that team project/);
});

// ── 2. The route ─────────────────────────────────────────────────────────────

test('a project the person cannot see, or that is gone, says which', async () => {
  reset();
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = () => json({ error: {} }, 403);
  await mountTeamLink(view(), 'project/p1');
  await settle();
  assert.match(view().textContent!, /do not have access to that team project/);
  assert.equal(document.querySelector('dialog'), null);

  reset();
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = () => json({ error: {} }, 404);
  await mountTeamLink(view(), 'project/p1');
  await settle();
  assert.match(view().textContent!, /team project was not found/);
});

test('a member lands on Projects with the project requested, and no card stays', async () => {
  reset();
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = (url) => {
    if (url === '/api/v1/projects/p1/sessions') return json({ sessions: [] });
    return new Response('', { status: 404 });
  };
  await mountTeamLink(view(), 'project/p1');
  await until(() => window.location.hash === '#/p');
  await settle();
  assert.equal(document.querySelector('dialog'), null, 'the Projects view opens the dialog, not this route');
  assert.equal(view().querySelector('section.team-link'), null, 'no card left behind');
  assert.equal(takeSourceProjectRequest(), 'p1', 'Projects is asked to open the project');
  assert.equal(takeSourceProjectRequest(), null, 'once');
});

test('an individual file link lands on Files only after project access succeeds', async () => {
  const fileId = `fil_${'a'.repeat(22)}`;
  reset(`#/team/project/p1?file=${fileId}`);
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = url => url === '/api/v1/projects/p1/sessions' ? json({ sessions: [] }) : new Response('', { status: 404 });
  await mountTeamLink(view(), 'project/p1');
  await until(() => window.location.hash === `#/p?team=p1&tab=files&file=${fileId}`);
  assert.equal(takeSourceProjectRequest(), null, 'the selected file travels in the destination address');

  reset(`#/team/project/p1?file=${fileId}`);
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = () => json({ error: {} }, 403);
  await mountTeamLink(view(), 'project/p1'); await settle();
  assert.match(view().textContent!, /do not have access to that team project/);
  assert.equal(window.location.hash, `#/team/project/p1?file=${fileId}`);

  reset('#/team/project/p1?file=bad%2Fid');
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = () => json({ sessions: [] });
  await mountTeamLink(view(), 'project/p1'); await settle();
  assert.match(view().textContent!, /link is incomplete/);
});

test('the Team projects dialog: the project, its activity, a session count, Close and Escape', async () => {
  reset('#/p');
  await settle();
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = (url) => {
    if (url === '/api/v1/projects/p1/sessions') return json({ sessions: [{ id: 's1', toolId: 'chart', label: 'Q3', updatedAt: ago(3), updatedByName: 'Ana' }] });
    if (url === '/api/v1/projects') return json({ projects: [{ id: 'p1', name: 'Summit', sessionCount: 1, myRole: 'viewer', updatedAt: ago(3), updatedByName: 'Ana' }] });
    return new Response('', { status: 404 });
  };
  let closed: boolean | null = null;
  openTeamProjectsModal({ toolName: (id) => id, initialProject: { id: 'p1' }, onClose: (opened) => { closed = opened; } });
  await settle();
  const dialog = document.querySelector('dialog')!;
  assert.ok(dialog.classList.contains('modal'), 'the shared modal chrome');
  assert.equal(document.activeElement?.textContent, 'Summit', 'focus on the project it opened on');
  assert.match(dialog.textContent!, /Edited by Ana, 3h ago/);
  // No `invites` in org-config here (no control plane config), so no People action.
  assert.equal(dialog.querySelector('[data-team-people]'), null);
  dialog.querySelector<HTMLElement>('[data-team-back]')!.click();
  await settle();
  assert.match(dialog.textContent!, /1 session · Edited by Ana/, 'one session, not "1 sessions"');
  assert.equal((document.activeElement as HTMLElement | null)?.dataset.teamProject, 'p1', 'Back returns focus to the project row');
  dialog.querySelector<HTMLElement>('[data-team-close]')!.click();
  assert.equal(dialog.isConnected, false, 'Close closes');
  assert.equal(closed, false);

  openTeamProjectsModal({ toolName: (id) => id });
  await settle();
  const again = document.querySelector('dialog')!;
  again.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  assert.equal(again.isConnected, false, 'Escape closes');
  await settle();
});

test('a project link leaves no way Back to the link', async () => {
  reset('#/p');
  // Arrive on the link from Projects, as a pasted link would.
  window.location.hash = '#/team/project/p1';
  await settle();
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = (url) => url === '/api/v1/projects/p1/sessions' ? json({ sessions: [] }) : new Response('', { status: 404 });
  await mountTeamLink(view(), 'project/p1');
  await until(() => window.location.hash === '#/p');
  await settle();
  // Back must not land on the link again (it would remount and open it again).
  const popped = new Promise<void>((r) => { window.addEventListener('popstate', () => r(), { once: true }); });
  window.history.back();
  await popped;
  assert.equal(window.location.hash, '#/p', 'Back goes to where the person was before the link');
  takeSourceProjectRequest();
});

test('the router announces a project link as a Team project', () => {
  const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
  const fn = main.slice(main.indexOf('function announceRoute('), main.indexOf('function navKeyForRoute('));
  assert.match(fn, /route\.name === 'team' && route\.slug\.startsWith\('project\/'\) \? 'Team project'/);
  assert.match(main, /announceRoute\(route\);/);
});

test('a bad project link is incomplete, and no instance says so', async () => {
  reset('#/team/project/');
  await mountTeamLink(view(), 'project/');
  assert.match(view().textContent!, /incomplete/);
});

// ── 3. The list adapter ──────────────────────────────────────────────────────

test('project and session rows carry myRole and updatedByName only when sent', async () => {
  reset();
  const src = createInstanceSessionSource('Acme');
  router = (url) => {
    if (url === '/api/v1/projects') {
      return json({ projects: [
        { id: 'p1', name: 'A', sessionCount: 1, updatedAt: 't', myRole: 'editor', updatedByName: 'Ana' },
        { id: 'p2', name: 'B', sessionCount: 0, updatedAt: 't', myRole: 'admin', updatedByName: null },
      ] });
    }
    if (url === '/api/v1/projects/p1/sessions') return json({ sessions: [{ id: 's1', toolId: 'chart', updatedByName: 'Bo' }, { id: 's2', toolId: 'chart' }] });
    return new Response('', { status: 404 });
  };
  assert.deepEqual(await src.listProjects(), [
    { id: 'p1', name: 'A', sessionCount: 1, updatedAt: 't', myRole: 'editor', updatedByName: 'Ana' },
    { id: 'p2', name: 'B', sessionCount: 0, updatedAt: 't' },
  ]);
  const sessions = await src.listSessions('p1');
  assert.equal(sessions[0]!.updatedByName, 'Bo');
  assert.equal('updatedByName' in sessions[1]!, false);
  const got = await fetchTeamProjectSessions('p1');
  assert.ok(got.ok);
  assert.equal(got.sessions.length, 2);
  router = () => { throw new Error('offline'); };
  assert.deepEqual(await fetchTeamProjectSessions('p1'), { ok: false, status: 0 });
});

// ── 4. Role-gated save ───────────────────────────────────────────────────────

const DOC = { inputs: { title: 'Hi' }, toolVersion: '1.0.0', label: 'Cover' };
const ctx = { toolId: 'qr-code', baseParts: [], currentFormat: 'png', copy: async () => {}, document: () => DOC };

test('a viewer is offered a copy, not Save changes, and only projects they can save to', async () => {
  reset('#/tool/qr-code');
  registerSessionSource(createInstanceSessionSource('Acme', () => ({})));
  router = (url, init) => {
    if (url === '/api/v1/projects' && (init?.method ?? 'GET') === 'GET') {
      return json({ projects: [{ id: 'p1', name: 'Theirs', myRole: 'viewer' }, { id: 'p2', name: 'Mine', myRole: 'editor' }] });
    }
    return new Response('', { status: 404 });
  };
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 1, label: 'Cover' });
  const section = buildTeamShareSection(ctx)!;
  document.body.append(section);
  await settle();
  assert.equal(section.querySelector('[data-act="team-save-changes"]'), null, 'no Save changes for a viewer');
  const copy = section.querySelector<HTMLElement>('[data-act="team-save-copy"]');
  assert.ok(copy);
  copy.click();
  await settle();
  const options = [...section.querySelectorAll<HTMLOptionElement>('select option')].map((o) => o.textContent);
  assert.deepEqual(options.filter((o) => o !== 'New project…'), ['Mine']);
  assert.equal(section.querySelector<HTMLInputElement>('input[type="text"]')!.value, 'Cover (copy)');
  section.querySelector<HTMLElement>('[data-act="team-save-copy-cancel"]')!.click();
  assert.ok(section.querySelector('[data-act="team-save-copy"]'), 'Cancel goes back to the team document');
});

test('a role change reaches the Share dialog without a reload', async () => {
  reset('#/tool/qr-code');
  registerSessionSource(createInstanceSessionSource('Acme', () => ({})));
  let myRole = 'viewer';
  router = (url) => url === '/api/v1/projects' ? json({ projects: [{ id: 'p1', name: 'Ours', myRole }] }) : new Response('', { status: 404 });
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 1 });
  const first = buildTeamShareSection(ctx)!;
  document.body.append(first);
  await settle();
  assert.ok(first.querySelector('[data-act="team-save-copy"]'), 'a viewer first');
  first.remove();
  // Promoted to editor; the kept project list has expired by the next time Share opens.
  myRole = 'editor';
  const realNow = Date.now;
  Date.now = () => realNow() + 31_000;
  try {
    const again = buildTeamShareSection(ctx)!;
    document.body.append(again);
    await settle();
    assert.ok(again.querySelector('[data-act="team-save-changes"]'), 'now Save changes');
    assert.equal(again.querySelector('[data-act="team-save-copy"]'), null);
  } finally {
    Date.now = realNow;
  }
});

test('a viewer of every project is told why there is nowhere to save', async () => {
  reset('#/tool/qr-code');
  registerSessionSource(createInstanceSessionSource('Acme', () => ({})));
  router = (url) => url === '/api/v1/projects' ? json({ projects: [{ id: 'p1', name: 'Theirs', myRole: 'viewer' }] }) : new Response('', { status: 404 });
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 1, label: 'Cover' });
  const section = buildTeamShareSection(ctx)!;
  document.body.append(section);
  await settle();
  section.querySelector<HTMLElement>('[data-act="team-save-copy"]')!.click();
  await settle();
  const options = [...section.querySelectorAll<HTMLOptionElement>('select option')].map((o) => o.textContent);
  assert.ok(!options.includes('No team projects yet'), 'they do have team projects');
  assert.ok(options.includes('No projects you can save to'));
  assert.match(section.textContent!, /Create a project to save this document\./);
});

test('an editor keeps Save changes', async () => {
  reset('#/tool/qr-code');
  registerSessionSource(createInstanceSessionSource('Acme', () => ({})));
  router = (url) => url === '/api/v1/projects' ? json({ projects: [{ id: 'p1', name: 'Ours', myRole: 'editor' }] }) : new Response('', { status: 404 });
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 1 });
  const section = buildTeamShareSection(ctx)!;
  document.body.append(section);
  await settle();
  assert.ok(section.querySelector('[data-act="team-save-changes"]'));
  assert.equal(section.querySelector('[data-act="team-save-copy"]'), null);
});

// ── 5. Review fixes: the empty picker, the dialog's screens, a failed open, Back ─

test('a creator with no projects sees a New project button beside the hint', async () => {
  reset('#/tool/qr-code');
  registerSessionSource(createInstanceSessionSource('Acme', () => ({})));
  router = (url) => url === '/api/v1/projects' ? json({ projects: [] }) : new Response('', { status: 404 });
  const section = buildTeamShareSection(ctx)!;
  document.body.append(section);
  await settle();
  const start = section.querySelector<HTMLButtonElement>('[data-act="team-new-project"]')!;
  assert.ok(start && !start.hidden, 'a visible way to create one');
  assert.match(section.textContent!, /Create a project to save this document\./);
  start.click();
  await settle();
  assert.equal(section.querySelector('select')!.value, '__new__', 'it opens the same New project form');
  assert.ok(start.hidden, 'and steps aside while the form is up');
});

test('someone who cannot create a project and has none sees who can help, not a dead form', async () => {
  reset('#/tool/qr-code');
  registerSessionSource(createInstanceSessionSource('Acme', () => ({ can: { 'project.create': false } })));
  router = (url) => url === '/api/v1/projects' ? json({ projects: [] }) : new Response('', { status: 404 });
  const section = buildTeamShareSection(ctx)!;
  document.body.append(section);
  await settle();
  assert.match(section.textContent!, /Ask a teammate to add you to a project\./);
  assert.ok(section.querySelector<HTMLButtonElement>('[data-act="team-new-project"]')!.hidden, 'no New project');
  assert.ok(section.querySelector<HTMLButtonElement>('[data-act="team-save-new"]')!.hidden, 'no Save button that can never be pressed');
  assert.ok(section.querySelector<HTMLInputElement>('input.field-input')!.hidden, 'no Name field');
});

test('a project list that arrives late does not replace the New project form', async () => {
  reset('#/p');
  await settle();
  registerSessionSource(createInstanceSessionSource('Acme', () => ({})));
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  router = (url) => url === '/api/v1/projects' ? json({ projects: [{ id: 'p1', name: 'Summit' }] }) : new Response('', { status: 404 });
  const slow = router;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/v1/projects') await gate;
    return slow(String(input), init);
  }) as typeof fetch;
  try {
    openTeamProjectsModal({ toolName: (id) => id });
    await settle();
    const dialog = document.querySelector('dialog')!;
    const newBtn = dialog.querySelector<HTMLButtonElement>('[data-team-new]')!;
    assert.ok(newBtn.hidden, 'New project waits for the list');
    // Pressed anyway (a fast tap as the button appears): the form is the screen now.
    newBtn.click();
    const form = dialog.querySelector('[data-team-body]')!.firstElementChild;
    assert.ok(form, 'the form is up');
    release();
    await settle();
    assert.equal(dialog.querySelector('[data-team-body]')!.firstElementChild, form, 'the late list was dropped');
    dialog.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  } finally {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => router(String(input), init)) as typeof fetch;
  }
  await settle();
});

test('a session that cannot be opened keeps the dialog up and says so on screen', async () => {
  reset('#/p');
  await settle();
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = (url) => {
    if (url === '/api/v1/projects/p1/sessions') return json({ sessions: [{ id: 's1', toolId: 'chart', label: 'Q3' }] });
    if (url === '/api/v1/projects') return json({ projects: [{ id: 'p1', name: 'Summit', myRole: 'editor' }] });
    if (url === '/api/v1/sessions/s1') return json({ error: { code: 'SESSION_DELETED' } }, 410);
    return new Response('', { status: 404 });
  };
  let navigated = false;
  openTeamProjectsModal({ host: {} as never, toolName: (id) => id, initialProject: { id: 'p1' }, beforeNavigate: () => { navigated = true; } });
  await settle();
  const dialog = document.querySelector('dialog')!;
  dialog.querySelector<HTMLElement>('[data-team-session="s1"]')!.click();
  await until(() => !!dialog.querySelector('[data-team-failure]'));
  assert.ok(dialog.isConnected, 'the dialog is still up');
  assert.equal(dialog.querySelector('[data-team-failure]')!.textContent, 'That session is no longer available.');
  assert.equal(navigated, false);
  assert.equal(window.location.hash, '#/p');
  assert.equal(dialog.querySelector('[aria-busy]'), null, 'the row is no longer busy');
  dialog.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  await settle();
});

test('the dialog\'s two back controls share one look and a 44px target', async () => {
  const projects = readFileSync(new URL('./team-projects.ts', import.meta.url), 'utf8');
  const people = readFileSync(new URL('./team-people.ts', import.meta.url), 'utf8');
  assert.match(projects, /styleTeamBack\(/);
  assert.match(people, /styleTeamBack\(button\(/);
  const { TEAM_BACK_STYLE } = await import('./team-back.ts');
  assert.match(TEAM_BACK_STYLE, /min-height:44px/);
  assert.match(TEAM_BACK_STYLE, /font-size:var\(--fs-md\)/, 'grows with Large text');
});

test('isProjectsHref: Projects by hash or by path, nothing else', async () => {
  const { isProjectsHref } = await import('./team-project-link.ts');
  for (const yes of ['/#/p', '#/p', '/#/p?x=1', '/#/p/fld_1', '/#/projects', '/p', '/projects/fld_1']) assert.equal(isProjectsHref(yes), true, yes);
  for (const no of ['', null, undefined, '/#/', '/#/pro', '/#/profile', '/#/team/project/p1', '/', '/pdf']) assert.equal(isProjectsHref(no), false, String(no));
});

test('a project link followed from Projects steps back to it instead of adding a second copy', async () => {
  const { noteMountedView, recordLeave } = await import('../lib/back-nav.ts');
  reset('#/');
  await settle();
  window.location.hash = '#/p';
  await settle();
  noteMountedView('projects');
  window.location.hash = '#/team/project/p1';
  await settle();
  recordLeave();
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = (url) => url === '/api/v1/projects/p1/sessions' ? json({ sessions: [] }) : new Response('', { status: 404 });
  await mountTeamLink(view(), 'project/p1');
  await until(() => window.location.hash === '#/p');
  await settle();
  assert.equal(takeSourceProjectRequest(), 'p1');
  // One Back from Projects now leaves Projects: history holds no second #/p entry.
  const popped = new Promise<void>((r) => { window.addEventListener('popstate', () => r(), { once: true }); });
  window.history.back();
  await popped;
  assert.equal(window.location.hash, '#/', 'Back leaves Projects in one step');
});

test('a second open while the dialog is up does not stack another dialog', async () => {
  reset('#/p');
  await settle();
  registerSessionSource(createInstanceSessionSource('Acme'));
  router = (url) => url === '/api/v1/projects' ? json({ projects: [] }) : new Response('', { status: 404 });
  // Both queued opens run once the module has loaded (a double click on a slow network).
  openTeamProjectsModal({ toolName: (id) => id });
  openTeamProjectsModal({ toolName: (id) => id });
  await settle();
  assert.equal(document.querySelectorAll('dialog.team-projects-dialog').length, 1);
  document.querySelector('dialog')!.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  await settle();
  openTeamProjectsModal({ toolName: (id) => id });
  assert.equal(document.querySelectorAll('dialog.team-projects-dialog').length, 1, 'closed, it opens again');
  document.querySelector('dialog')!.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  await settle();
});

// ── 6. Turned away: no access, a lapsed sign-in ──────────────────────────────

const posts: Array<{ url: string; body: unknown }> = [];

/** A signed-in member of Acme, with `config` in their org-config. Then `route`
 *  answers everything else, and POSTs are recorded. */
async function member(config: Record<string, unknown>, route: Handler): Promise<void> {
  reset();
  _resetOrgForTests();
  posts.length = 0;
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/api/auth/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', email: 'ana@acme.test', role: 'member' } });
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, inboxUnread: 0, ...config });
    return new Response('', { status: 404 });
  };
  await initOrg();
  router = (url, init) => {
    if ((init?.method ?? 'GET') === 'POST') posts.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    return route(url, init);
  };
}

test('no access, requests on: who they are, Ask for access, and Use a different account', async () => {
  await member({ requests: { project: true } }, (url, init) => {
    if (url === '/api/v1/projects/p1/sessions') return json({ error: { code: 'FORBIDDEN' } }, 403);
    if (url.startsWith('/api/v1/access-requests/mine')) return json({ requests: [] });
    if (url === '/api/v1/projects/p1/access-requests' && init?.method === 'POST') return json({ ok: true }, 202);
    return new Response('', { status: 404 });
  });
  await mountTeamLink(view(), 'project/p1');
  await settle();
  const text = view().textContent!;
  assert.match(text, /You do not have access to this team project\./);
  assert.match(text, /You are signed in to Acme as ana@acme\.test\./);
  const ask = view().querySelector<HTMLElement>('[data-team-ask]')!;
  assert.ok(ask, 'the ask form');
  assert.equal(ask.querySelector('h2')!.textContent, 'Ask for access', 'under the card\'s h1');
  assert.equal(ask.querySelector('select')!.value, 'editor', 'Edit is the default');
  assert.equal(view().querySelector('[data-team-switch-account]')!.textContent, 'Use a different account');
  ask.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  assert.deepEqual(posts, [{ url: '/api/v1/projects/p1/access-requests', body: { role: 'editor' } }]);
  assert.match(view().textContent!, /Request sent\./);
  _resetOrgForTests();
});

test('no access, requests off: the sentence says who can help, and no form', async () => {
  await member({}, (url) => url === '/api/v1/projects/p1/sessions' ? json({ error: {} }, 403) : new Response('', { status: 404 }));
  await mountTeamLink(view(), 'project/p1');
  await settle();
  assert.match(view().textContent!, /You do not have access to that team project\. Ask whoever sent the link to add you\./);
  assert.equal(view().querySelector('[data-team-ask]'), null);
  assert.ok(view().querySelector('[data-team-switch-account]'));
  _resetOrgForTests();
});

test('Use a different account signs out first, and says so when that fails', async () => {
  await member({ requests: { project: true } }, (url) => {
    if (url === '/api/v1/projects/p1/sessions') return json({ error: {} }, 403);
    if (url.startsWith('/api/v1/access-requests/mine')) return json({ requests: [] });
    if (url === '/api/auth/logout') return json({ error: {} }, 500);
    return new Response('', { status: 404 });
  });
  await mountTeamLink(view(), 'project/p1');
  await settle();
  const button = view().querySelector<HTMLButtonElement>('[data-team-switch-account]')!;
  button.click();
  await settle();
  assert.deepEqual(posts.map((p) => p.url), ['/api/auth/logout']);
  assert.match(view().textContent!, /Could not sign out\. Try again\./);
  assert.equal(button.disabled, false, 'ready to try again');
  assert.equal(switchAccountHref('/#/team/project/p1'), '/api/auth/login?prompt=select_account&returnTo=%2F%23%2Fteam%2Fproject%2Fp1');
  _resetOrgForTests();
});

test('a lapsed sign-in offers Sign in, coming back to the link', async () => {
  await member({ requests: { project: true } }, (url) => url === '/api/v1/projects/p1/sessions' ? json({ error: {} }, 401) : new Response('', { status: 404 }));
  await mountTeamLink(view(), 'project/p1');
  await settle();
  assert.match(view().textContent!, /Your sign-in has expired\. Sign in again to open the link\./);
  assert.equal(view().querySelector('a.btn')!.getAttribute('href'), '/api/auth/login?returnTo=%2F%23%2Fteam%2Fproject%2Fp1');
  assert.equal(view().querySelector('[data-team-ask]'), null);
  _resetOrgForTests();
});

test('an approval seen in the inbox opens the link again', async () => {
  await member({ requests: { project: true } }, (url) => url.startsWith('/api/v1/access-requests/mine')
    ? json({ requests: [{ id: 'req_7', status: 'open', role: 'editor', createdAt: new Date().toISOString() }] })
    : new Response('', { status: 404 }));
  let listener: ((msgs: readonly AnswerMessage[]) => void) | null = null;
  let opened = 0;
  noAccessCard(view(), {
    heading: 'Team project',
    message: 'You do not have access to this team project.',
    target: { projectId: 'p1' },
    onApproved: () => { opened++; },
    watch: (fn) => { listener = fn; return () => { listener = null; }; },
  });
  await settle();
  assert.match(view().textContent!, /Nobody has answered yet/);
  listener!([{ id: 'msg_ans_req_7', data: { kind: 'access-answer', requestId: 'req_7', projectId: 'p1', outcome: 'approved' } }]);
  assert.equal(opened, 1);
  assert.equal(listener, null, 'the watch let go');
  _resetOrgForTests();
});
