// SPDX-License-Identifier: MPL-2.0
/**
 * Effective access, Make owner and archived projects (plan 75 G15 and ARCH): the shell
 * half of lolly-work's access close-out.
 *
 * Pinned:
 *  - member rows keep `via`, the `effective` list (managers only) keeps its group and
 *    admin rows, and the panel shows them as rows of their own, with no role select and
 *    no Remove; a manager who is not a workspace admin is told admins can open it too;
 *  - the owner, or a workspace admin managing the project through that role, gets Make
 *    owner on other member rows; it asks first, sends `PATCH { ownerId }`, and redraws;
 *  - an older instance (no `via`) draws exactly the rows it always did;
 *  - "Show archived" lists the archived projects this person manages, read only when
 *    switched on, each with Restore project (`PATCH { archived: false }`), and the
 *    Projects view's shared section carries the switch for managers only.
 *
 * Run directly:  node --test shells/web/src/org/team-people-access.test.ts
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
globalThis.Node = dom.window.Node as unknown as typeof Node;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;
(globalThis.window as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });
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

const { memberFromRow, peopleFromBody, transferProjectOwner, listArchivedProjects, restoreTeamProject } = await import('./project-members.ts');
const { buildPeoplePanel, peoplePanelView, viaText } = await import('./team-people.ts');
const { buildArchivedProjects, managesProjects, _resetArchivedForTests } = await import('./team-projects.ts');
const { mountSharedProjectMenus } = await import('./project-sharing.ts');

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 10; i++) await tick(); }
async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400; i++) { if (check()) return; await tick(); }
  assert.fail(`timed out waiting for ${what}`);
}
const reset = (): void => { calls.length = 0; router = () => new Response('', { status: 404 }); document.body.replaceChildren(); _resetArchivedForTests(); };

// ── Effective access rows (G15) ───────────────────────────────────────────────

test('member rows keep where the access comes from, and the group only on group rows', () => {
  assert.deepEqual(memberFromRow({ userId: 'u3', name: 'Lee', role: 'editor', via: 'group', group: 'team' }), { userId: 'u3', name: 'Lee', role: 'editor', via: 'group', group: 'team' });
  assert.deepEqual(memberFromRow({ userId: 'u4', name: 'Kim', role: 'manager', via: 'admin', group: 'ignored' }), { userId: 'u4', name: 'Kim', role: 'manager', via: 'admin' });
  assert.deepEqual(memberFromRow({ userId: 'u1', name: 'Andy', role: 'owner', via: 'owner' }), { userId: 'u1', name: 'Andy', role: 'owner', via: 'owner' });
  assert.deepEqual(memberFromRow({ userId: 'u5', name: 'Mo', role: 'viewer', via: 'telepathy' }), { userId: 'u5', name: 'Mo', role: 'viewer' }, 'an unknown source is left out');
  assert.deepEqual(memberFromRow({ userId: 'u6', name: 'Al', role: 'viewer' }), { userId: 'u6', name: 'Al', role: 'viewer' }, 'an older instance sends no via');
});

test('the effective list holds only group and admin rows, beside how admins are shown', () => {
  const got = peopleFromBody({
    myRole: 'manager',
    members: [{ userId: 'u1', name: 'Andy', role: 'owner', via: 'owner' }],
    effective: [
      { userId: 'u3', name: 'Lee', role: 'editor', via: 'group', group: 'team' },
      { userId: 'u9', name: 'Odd', role: 'editor', via: 'member' },
      { userId: 'u4', name: 'Kim', role: 'manager', via: 'admin', isMe: true },
    ],
    effectiveTruncated: true,
    adminAccess: 'listed',
  })!;
  assert.deepEqual(got.effective!.map((m) => [m.userId, m.via]), [['u3', 'group'], ['u4', 'admin']]);
  assert.equal(got.effectiveTruncated, true);
  assert.equal(got.adminAccess, 'listed');
  assert.equal(peopleFromBody({ myRole: 'manager', members: [], canTransfer: true })!.canTransfer, true);
  assert.equal(peopleFromBody({ myRole: 'owner', members: [], canTransfer: false })!.canTransfer, false);
  const older = peopleFromBody({ myRole: 'manager', members: [], adminAccess: 'everyone', canTransfer: 'yes' })!;
  assert.deepEqual(Object.keys(older).sort(), ['invitations', 'members', 'myRole', 'requests'], 'an older answer keeps its old shape');
});

test('viaText says where inherited access comes from', () => {
  assert.equal(viaText({ role: 'editor', via: 'group', group: 'team' }), 'Editor · via team');
  assert.equal(viaText({ role: 'editor', via: 'group' }), 'Editor', 'without the group name, the role alone');
  assert.equal(viaText({ role: 'manager', via: 'admin' }), 'Admin · via workspace role');
  assert.equal(viaText({ role: 'editor', via: 'member' }), '');
  assert.equal(viaText({ role: 'owner', via: 'owner' }), '');
  assert.equal(viaText({ role: 'viewer' }), '');
});

const people = (myRole: string, more: Record<string, unknown> = {}) => peopleFromBody({
  myRole,
  members: [
    { userId: 'u1', name: 'Andy', role: 'owner', via: 'owner', ...(myRole === 'owner' ? { isMe: true } : {}) },
    { userId: 'u2', name: 'Bo', role: 'editor', via: 'member' },
  ],
  ...more,
})!;

test('Make owner follows the instance\'s own answer (canTransfer), the test the transfer applies', () => {
  assert.equal(peoplePanelView(people('owner', { canTransfer: true }), null).transfer, true);
  assert.equal(peoplePanelView(people('manager', { adminAccess: 'note', canTransfer: false }), null).transfer, false, 'a member manager cannot hand the project on');
  // A workspace role does not decide it: project.manage can be denied to an admin, or
  // granted to someone who is not one.
  assert.equal(peoplePanelView(people('manager', { adminAccess: 'listed', canTransfer: false }), null).transfer, false, 'an admin denied project.manage');
  assert.equal(peoplePanelView(people('manager', { adminAccess: 'note', canTransfer: true }), null).transfer, true, 'a member granted project.manage');
  assert.equal(peoplePanelView(people('viewer', { canTransfer: false }), null).transfer, false);
  // An older instance that does not say: nobody, not even the owner. Its transfer does
  // not keep the old owner on the project, so "The current owner stays on the project as
  // a Manager." would not hold, and the owner would lose their own access.
  assert.equal(peoplePanelView(people('owner'), null).transfer, false);
  assert.equal(peoplePanelView(people('manager', { adminAccess: 'listed' }), null).transfer, false);
  assert.equal(peoplePanelView(people('manager', { effective: [{ userId: 'me', name: 'Kim', role: 'manager', via: 'admin', isMe: true }] }), null).transfer, false);
});

const LIST = {
  myRole: 'manager',
  members: [
    { userId: 'u1', name: 'Andy', email: 'andy@acme.com', role: 'owner', via: 'owner' },
    { userId: 'u2', name: 'Bo', email: 'bo@acme.com', role: 'editor', via: 'member' },
  ],
  effective: [
    { userId: 'u3', name: 'Lee', role: 'editor', via: 'group', group: 'team' },
    { userId: 'u4', name: 'Kim', role: 'manager', via: 'admin' },
  ],
  adminAccess: 'note',
  invitations: [],
};

const row = (panel: HTMLElement, id: string): HTMLElement => panel.querySelector<HTMLElement>(`li[data-member="${id}"]`)!;

test('a manager sees group and admin access as rows that cannot be changed here', async () => {
  reset();
  router = (url) => url.endsWith('/members') ? json(LIST) : new Response('', { status: 404 });
  const panel = buildPeoplePanel({ projectId: 'p1', projectName: 'Brand refresh', policy: null });
  document.body.append(panel);
  await settle();
  const lee = row(panel, 'u3');
  assert.equal(lee.dataset.via, 'group');
  assert.match(lee.textContent!, /Editor · via team/);
  assert.equal(lee.querySelector('select'), null, 'no role select');
  assert.equal(lee.querySelector('[data-act="people-remove"]'), null, 'no Remove');
  const kim = row(panel, 'u4');
  assert.match(kim.textContent!, /Admin · via workspace role/);
  assert.equal(kim.querySelector('select, [data-act="people-remove"]'), null);
  // End dates (the share ladder's) are a member row's: never on access the project cannot change.
  assert.equal(lee.querySelector('.share-access-member'), null, 'no end date on a group row');
  assert.equal(kim.querySelector('.share-access-member'), null, 'nor on an admin row');
  const bo = row(panel, 'u2');
  assert.ok(bo.querySelector('select'), 'an own member row keeps its role select');
  assert.ok(bo.querySelector('[data-act="people-remove"]'));
  assert.ok(bo.querySelector('.share-access-member'), 'a member row keeps its end-date slot');
  assert.equal(panel.querySelector('[data-act="people-make-owner"]'), null, 'a member manager is not offered Make owner');
  assert.equal(panel.querySelector('[data-admin-note]'), null, 'no workspace name, no note');
});

test('a manager who is not an admin is told that admins can open the project too', async () => {
  reset();
  router = (url) => url.endsWith('/members')
    ? json({ ...LIST, effective: [LIST.effective[0]], message: { workspace: 'lolly.ing', providers: [] } })
    : new Response('', { status: 404 });
  const panel = buildPeoplePanel({ projectId: 'p1', projectName: 'Brand refresh', policy: null });
  document.body.append(panel);
  await settle();
  assert.equal(panel.querySelector('[data-admin-note]')?.textContent, 'Admins of lolly.ing can also open this project.');
  assert.equal(panel.querySelectorAll('li[data-via="admin"]').length, 0);
});

test('a viewer is never shown the effective rows', async () => {
  reset();
  router = (url) => url.endsWith('/members') ? json({ ...LIST, myRole: 'viewer' }) : new Response('', { status: 404 });
  const panel = buildPeoplePanel({ projectId: 'p1', policy: null });
  document.body.append(panel);
  await settle();
  assert.equal(panel.querySelectorAll('li[data-via="group"], li[data-via="admin"]').length, 0);
});

test('an older instance with no via draws the rows it always did', async () => {
  reset();
  router = (url) => url.endsWith('/members')
    ? json({ myRole: 'manager', members: [{ userId: 'u1', name: 'Andy', role: 'owner' }, { userId: 'u2', name: 'Bo', role: 'editor' }] })
    : new Response('', { status: 404 });
  const panel = buildPeoplePanel({ projectId: 'p1', policy: null });
  document.body.append(panel);
  await settle();
  assert.ok(row(panel, 'u2').querySelector('select'));
  assert.ok(row(panel, 'u2').querySelector('[data-act="people-remove"]'));
  assert.equal(row(panel, 'u2').dataset.via, undefined);
});

test('the owner makes someone else the owner: asked first, then PATCH ownerId, then a redraw', async () => {
  reset();
  let owner = 'u1';
  router = (url, init) => {
    if (url.endsWith('/members')) {
      return json({
        myRole: owner === 'u1' ? 'owner' : 'manager',
        members: [
          { userId: owner, name: owner === 'u1' ? 'Andy' : 'Bo', role: 'owner', via: 'owner', ...(owner === 'u1' ? { isMe: true } : {}) },
          { userId: owner === 'u1' ? 'u2' : 'u1', name: owner === 'u1' ? 'Bo' : 'Andy', role: owner === 'u1' ? 'editor' : 'manager', via: 'member', ...(owner === 'u1' ? {} : { isMe: true }) },
        ],
        effective: [{ userId: 'u3', name: 'Lee', role: 'editor', via: 'group', group: 'team' }],
        adminAccess: 'note',
        canTransfer: owner === 'u1',
      });
    }
    if (url === '/api/v1/projects/p1' && init?.method === 'PATCH') { owner = 'u2'; return json({ id: 'p1', name: 'Brand refresh', ownerId: 'u2' }); }
    return new Response('', { status: 404 });
  };
  const panel = buildPeoplePanel({ projectId: 'p1', projectName: 'Brand refresh', policy: null });
  document.body.append(panel);
  await settle();
  assert.equal(row(panel, 'u1').querySelector('[data-act="people-make-owner"]'), null, 'not on the owner row');
  assert.equal(row(panel, 'u3').querySelector('[data-act="people-make-owner"]'), null, 'not on a group row');
  const make = row(panel, 'u2').querySelector<HTMLButtonElement>('[data-act="people-make-owner"]')!;
  assert.equal(make.textContent, 'Make owner');
  make.click();
  await until(() => !!document.querySelector('dialog[open]'), 'the question');
  const dialog = document.querySelector('dialog[open]')!;
  assert.equal(dialog.querySelector('.modal-title')?.textContent, 'Make Bo the owner of Brand refresh?');
  assert.match(dialog.textContent!, /The current owner stays on the project as a Manager\./);
  assert.equal(calls.some((c) => c.method === 'PATCH'), false, 'nothing sent before the answer');
  dialog.querySelector<HTMLElement>('[data-act="ok"]')!.click();
  await until(() => calls.some((c) => c.method === 'PATCH'), 'the transfer');
  assert.deepEqual(calls.find((c) => c.method === 'PATCH')!.body, { ownerId: 'u2' });
  await settle();
  assert.equal(panel.querySelector('.team-people-status')!.textContent, 'Bo is now Owner.');
  assert.equal(panel.querySelector('[data-act="people-make-owner"]'), null, 'the old owner, now a Manager, is offered no transfer');
});

test('an older instance that does not say who may transfer offers Make owner to nobody', async () => {
  reset();
  router = (url) => {
    if (url.endsWith('/members')) return json({ myRole: 'owner', members: [{ userId: 'u1', name: 'Andy', role: 'owner', isMe: true }, { userId: 'u2', name: 'Bo', role: 'editor' }] });
    return new Response('', { status: 404 });
  };
  const panel = buildPeoplePanel({ projectId: 'p1', projectName: 'Brand refresh', policy: null });
  document.body.append(panel);
  await settle();
  assert.ok(row(panel, 'u2').querySelector('select'), 'the owner still manages the row');
  assert.equal(panel.querySelector('[data-act="people-make-owner"]'), null, 'its transfer would take the owner off the project');
});

test('a refused transfer says why and changes nothing', async () => {
  reset();
  router = (url, init) => {
    if (url.endsWith('/members')) return json({ myRole: 'owner', canTransfer: true, members: [{ userId: 'u1', name: 'Andy', role: 'owner', isMe: true }, { userId: 'u2', name: 'Bo', role: 'editor' }] });
    if (init?.method === 'PATCH') return json({ error: { code: 'FORBIDDEN', message: 'no' } }, 403);
    return new Response('', { status: 404 });
  };
  const panel = buildPeoplePanel({ projectId: 'p1', projectName: 'Brand refresh', policy: null });
  document.body.append(panel);
  await settle();
  row(panel, 'u2').querySelector<HTMLButtonElement>('[data-act="people-make-owner"]')!.click();
  await until(() => !!document.querySelector('dialog[open]'), 'the question');
  document.querySelector('dialog[open]')!.querySelector<HTMLElement>('[data-act="ok"]')!.click();
  await until(() => !panel.querySelector<HTMLElement>('.team-people-status')!.hidden, 'the status');
  assert.equal(panel.querySelector<HTMLElement>('.team-people-status')!.style.color, 'hsl(var(--destructive))');
});

test('transferProjectOwner, listArchivedProjects and restoreTeamProject speak the projects route', async () => {
  reset();
  router = (url) => {
    if (url === '/api/v1/projects?archived=1') {
      return json({
        projects: [
          { id: 'p1', name: 'Live', myRole: 'manager' },
          { id: 'p2', name: 'Old', myRole: 'manager', archivedAt: '2026-09-01T00:00:00Z' },
          { id: 'p3', name: 'Seen', myRole: 'viewer', archivedAt: '2026-09-02T00:00:00Z' },
          { id: 'p4', archivedAt: '2026-09-03T00:00:00Z' },
        ],
      });
    }
    if (url === '/api/v1/projects/p2' || url === '/api/v1/projects/p1') return json({});
    return new Response('', { status: 404 });
  };
  assert.deepEqual(await transferProjectOwner('p1', 'u9'), { ok: true, data: null });
  assert.deepEqual(calls.at(-1), { url: '/api/v1/projects/p1', method: 'PATCH', body: { ownerId: 'u9' } });
  const got = await listArchivedProjects();
  assert.ok(got.ok);
  assert.deepEqual(got.data, [
    { id: 'p2', name: 'Old', archivedAt: '2026-09-01T00:00:00Z', myRole: 'manager' },
    { id: 'p3', name: 'Seen', archivedAt: '2026-09-02T00:00:00Z', myRole: 'viewer' },
  ], 'only archived rows, and only usable ones');
  assert.deepEqual(await restoreTeamProject('p2'), { ok: true, data: null });
  assert.deepEqual(calls.at(-1), { url: '/api/v1/projects/p2', method: 'PATCH', body: { archived: false } });
  router = () => json({ error: { code: 'FORBIDDEN' } }, 403);
  assert.deepEqual(await restoreTeamProject('p2'), { ok: false, status: 403, code: 'FORBIDDEN' });
  router = () => { throw new Error('offline'); };
  assert.deepEqual(await listArchivedProjects(), { ok: false, status: 0 });
});

// ── Show archived (ARCH) ──────────────────────────────────────────────────────

const ARCHIVED = {
  projects: [
    { id: 'p1', name: 'Live', myRole: 'manager' },
    { id: 'p2', name: 'Old poster', myRole: 'manager', archivedAt: '2026-09-01T00:00:00Z' },
    { id: 'p3', name: 'Not mine to restore', myRole: 'viewer', archivedAt: '2026-09-02T00:00:00Z' },
    { id: 'p5', name: 'Older poster', myRole: 'owner', archivedAt: '2026-08-02T00:00:00Z' },
  ],
};

test('managesProjects: a project this person manages', () => {
  assert.equal(managesProjects([{ myRole: 'viewer' }, { myRole: 'manager' }]), true);
  assert.equal(managesProjects([{ myRole: 'owner' }]), true);
  assert.equal(managesProjects([{ myRole: 'editor' }, {}]), false);
});

test('Show archived reads the list only when switched on, and lists what this person can restore', async () => {
  reset();
  router = (url) => url === '/api/v1/projects?archived=1' ? json(ARCHIVED) : new Response('', { status: 404 });
  const restored: string[] = [];
  const box = buildArchivedProjects({ onRestored: (p) => restored.push(p.id) });
  document.body.append(box);
  await settle();
  assert.equal(calls.length, 0, 'nothing read before the switch');
  const toggle = box.querySelector<HTMLInputElement>('[data-act="show-archived"]')!;
  assert.equal(toggle.getAttribute('role'), 'switch');
  assert.match(box.textContent!, /Show archived/);
  toggle.checked = true;
  toggle.dispatchEvent(new dom.window.Event('change'));
  await until(() => box.querySelectorAll('[data-archived-project]').length > 0, 'the archived list');
  assert.deepEqual([...box.querySelectorAll<HTMLElement>('[data-archived-project]')].map((li) => li.dataset.archivedProject), ['p2', 'p5']);
  const restore = box.querySelector<HTMLButtonElement>('[data-archived-project="p2"] [data-act="restore-project"]')!;
  assert.equal(restore.textContent, 'Restore project');
  router = (url, init) => url === '/api/v1/projects/p2' && init?.method === 'PATCH' ? json({ id: 'p2' }) : new Response('', { status: 404 });
  restore.click();
  await until(() => restored.length === 1, 'the restore');
  assert.deepEqual(calls.at(-1), { url: '/api/v1/projects/p2', method: 'PATCH', body: { archived: false } });
  assert.equal(box.querySelector('[data-archived-project="p2"]'), null, 'the restored project leaves the archived list');
  assert.deepEqual(restored, ['p2']);
  // Switched off, the list goes; a box drawn again later remembers the switch.
  toggle.checked = false;
  toggle.dispatchEvent(new dom.window.Event('change'));
  assert.equal(box.querySelectorAll('[data-archived-project]').length, 0);
});

test('Show archived says when there is nothing to restore, and when the list cannot be read', async () => {
  reset();
  router = () => json({ projects: [{ id: 'p1', name: 'Live', myRole: 'manager' }] });
  const box = buildArchivedProjects();
  document.body.append(box);
  const toggle = box.querySelector<HTMLInputElement>('[data-act="show-archived"]')!;
  toggle.checked = true;
  toggle.dispatchEvent(new dom.window.Event('change'));
  const status = box.querySelector<HTMLElement>('[role="status"]')!;
  await until(() => status.textContent === 'No archived projects.', 'the empty line');
  router = () => json({ error: {} }, 500);
  const again = buildArchivedProjects();
  document.body.append(again);
  await until(() => again.querySelector<HTMLElement>('[role="status"]')!.textContent === 'Could not complete this action. Please try again.', 'the remembered switch to read again and fail');
  assert.equal(again.querySelector<HTMLInputElement>('[data-act="show-archived"]')!.checked, true, 'the switch was remembered');
});

test("the Projects view's shared section carries the switch for managers only", async () => {
  reset();
  const view = document.createElement('div');
  view.innerHTML = '<section class="projects-shared"><div class="projects-shared-head"></div></section>';
  document.body.append(view);
  const offViewer = mountSharedProjectMenus(view, [{ id: 'p1', name: 'Live', myRole: 'viewer' }], () => true, () => {});
  await settle();
  assert.equal(view.querySelector('.team-archived'), null, 'nothing to manage, no switch');
  offViewer();
  let refreshed = 0;
  const off = mountSharedProjectMenus(view, [{ id: 'p1', name: 'Live', myRole: 'manager' }], () => true, () => { refreshed++; });
  await until(() => !!view.querySelector('.projects-shared .team-archived'), 'the switch');
  router = (url) => url === '/api/v1/projects?archived=1' ? json(ARCHIVED) : json({});
  const toggle = view.querySelector<HTMLInputElement>('[data-act="show-archived"]')!;
  toggle.checked = true;
  toggle.dispatchEvent(new dom.window.Event('change'));
  await until(() => !!view.querySelector('[data-archived-project="p5"]'), 'the list');
  view.querySelector<HTMLButtonElement>('[data-archived-project="p5"] [data-act="restore-project"]')!.click();
  await until(() => refreshed === 1, 'the shared projects read again');
  off();
  assert.equal(view.querySelector('.team-archived'), null, 'the cleanup takes the switch away');
});
