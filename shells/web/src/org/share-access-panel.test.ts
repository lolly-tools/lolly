// SPDX-License-Identifier: MPL-2.0
/**
 * org/share-access.ts, org/share-access-panel.ts and org/share-groups-sheet.ts - the
 * sharing ladder in the People panel (lolly plan 299 M1).
 *
 * Proved against a stubbed instance in jsdom: an instance without the sharing routes
 * leaves the section hidden; a manager changes a group's role and end date, removes a
 * group, adds one, and shares with everyone on the workspace at a capped role; anyone
 * else reads the same facts as text; a member row gains an end-date control; and the
 * group sheet makes a group from suggestions without ever showing an address.
 *
 * Run directly:  node --test shells/web/src/org/share-access-panel.test.ts
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
const calls: Array<{ url: string; method: string; body: any }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  calls.push({ url: String(input), method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
  return router(String(input), init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { getShareState, suggestPeople, setMemberExpiry } = await import('./share-access.ts');
const { shareAccessFor, endOfDay, endDateText } = await import('./share-access-panel.ts');
const { openShareGroupSheet } = await import('./share-groups-sheet.ts');

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 10; i++) await tick(); }
const reset = (): void => { calls.length = 0; router = () => new Response('', { status: 404 }); document.body.replaceChildren(); };

const STATE = {
  general: { audience: 'restricted', role: 'viewer' },
  grants: [
    { principal: { kind: 'group', name: 'brand' }, role: 'editor' },
    { principal: { kind: 'custom-group', id: 'sg_1', name: 'Agency reviewers', memberCount: 3 }, role: 'commenter', expiresAt: '2026-12-01T00:00:00.000Z' },
  ],
  expiries: { u2: '2026-12-01T00:00:00.000Z' },
  settings: { viewersCanComment: true, viewersCanExport: true, editorsCanShare: false },
  policy: { audiences: ['restricted', 'instance'], instanceMaxRole: 'commenter', roles: ['viewer', 'commenter', 'editor', 'manager'], customGroups: true },
  canManage: true,
};
const GROUPS = { groups: [{ id: 'sg_1', name: 'Agency reviewers', memberCount: 3, myRole: 'owner' }, { id: 'sg_2', name: 'Legal', memberCount: 2, myRole: 'member' }] };
const context = () => ({ workspace: 'lolly.ing', directoryGroups: ['brand', 'sales'], canCreateGroups: true });

function serve(state: any = STATE): void {
  router = (url, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url === '/api/v1/projects/p1/sharing' && method === 'GET') return json(state);
    if (url === '/api/v1/projects/p1/sharing' && method === 'PUT') {
      const body = JSON.parse(String(init!.body));
      const grants = (body.grants ?? state.grants).map((g: any) => ({
        ...g, principal: g.principal.kind === 'custom-group' ? { ...g.principal, name: g.principal.id === 'sg_2' ? 'Legal' : 'Agency reviewers', memberCount: 3 } : g.principal,
      }));
      state = { ...state, grants, general: body.general ? (body.general.audience === 'restricted' ? { audience: 'restricted', role: 'viewer' } : body.general) : state.general };
      return json(state);
    }
    if (url === '/api/v1/share-groups') return json(GROUPS);
    if (url.startsWith('/api/v1/projects/p1/members/') && method === 'PUT') return json({ userId: 'u2', role: 'editor', ...(JSON.parse(String(init!.body)).expiresAt ? { expiresAt: JSON.parse(String(init!.body)).expiresAt } : {}) });
    return new Response('', { status: 404 });
  };
}

function mount(state: any = STATE) {
  serve(state);
  const said: Array<[string, boolean]> = [];
  const handle = shareAccessFor({ projectId: 'p1', say: (m, e) => said.push([m, e]), context });
  document.body.append(handle.section);
  return { handle, said };
}

const lastPut = () => calls.filter((c) => c.method === 'PUT').at(-1)!;

test('the adapter reads a share answer and people without addresses', async () => {
  reset();
  serve();
  const got = await getShareState('p1');
  assert.ok(got.ok);
  assert.equal(got.data.grants.length, 2);
  assert.equal(got.data.canManage, true);
  router = () => json({ people: [{ id: 'u5', name: 'Dee' }, { id: 'u6' }, 'x'], truncated: false });
  const people = await suggestPeople('  de ');
  assert.ok(people.ok);
  assert.deepEqual(people.data, [{ id: 'u5', name: 'Dee' }]);
  assert.equal(calls.at(-1)!.url, '/api/v1/share-groups/people?q=de');
  router = () => json({ error: { code: 'FORBIDDEN' } }, 403);
  const refused = await setMemberExpiry('p1', 'u2', null);
  assert.deepEqual(refused, { ok: false, status: 403, code: 'FORBIDDEN' });
});

test('an instance without the sharing routes leaves the section hidden', async () => {
  reset();
  const handle = shareAccessFor({ projectId: 'p1', say: () => {}, context });
  document.body.append(handle.section);
  await settle();
  assert.equal(handle.section.hidden, true);
  const controls = document.createElement('div');
  handle.decorateMember(controls, { userId: 'u2', name: 'Bo', role: 'editor' }, true);
  assert.equal(controls.querySelector('select'), null, 'no end-date control without the routes');
});

test('a manager changes a group role and end date, and removes a group', async () => {
  reset();
  const { handle, said } = mount();
  await settle();
  assert.equal(handle.section.hidden, false);
  const rows = handle.section.querySelectorAll('.share-access-list > li');
  assert.equal(rows.length, 2);
  const role = rows[0]!.querySelector<HTMLSelectElement>('select[aria-label="Role for brand"]')!;
  assert.deepEqual([...role.options].map((o) => o.value), ['viewer', 'commenter', 'editor', 'manager']);
  role.value = 'viewer';
  role.dispatchEvent(new dom.window.Event('change'));
  await settle();
  assert.deepEqual(lastPut().body.grants[0], { principal: { kind: 'group', name: 'brand' }, role: 'viewer' });
  assert.equal(said.at(-1)![0], 'brand is now Viewer.');

  const ends = handle.section.querySelectorAll('.share-access-list > li')[1]!.querySelector<HTMLSelectElement>('select[aria-label="End date for Agency reviewers"]')!;
  assert.equal(ends.value, 'current');
  assert.match(ends.selectedOptions[0]!.textContent!, /^Until /);
  ends.value = 'none';
  ends.dispatchEvent(new dom.window.Event('change'));
  await settle();
  assert.deepEqual(lastPut().body.grants[1], { principal: { kind: 'custom-group', id: 'sg_1' }, role: 'commenter' });

  const remove = handle.section.querySelector<HTMLButtonElement>('button[aria-label="Remove brand"]')!;
  remove.click();
  await settle();
  assert.deepEqual(lastPut().body.grants.map((g: any) => g.principal.kind), ['custom-group']);
  assert.equal(handle.section.querySelectorAll('.share-access-list > li').length, 1);
});

test('adding a group offers groups you are in and directory groups not already added', async () => {
  reset();
  const { handle } = mount();
  await settle();
  const pick = handle.section.querySelector<HTMLSelectElement>('select[aria-label="Group to add"]')!;
  const values = [...pick.options].map((o) => o.value);
  assert.deepEqual(values, ['', 'custom-group:sg_2', 'group:sales', 'new'], 'sg_1 and brand are already on the project');
  const add = handle.section.querySelector<HTMLButtonElement>('.share-access-add button')!;
  assert.equal(add.disabled, true);
  pick.value = 'custom-group:sg_2';
  pick.dispatchEvent(new dom.window.Event('change'));
  assert.equal(add.disabled, false);
  add.click();
  await settle();
  assert.deepEqual(lastPut().body.grants.at(-1), { principal: { kind: 'custom-group', id: 'sg_2' }, role: 'viewer' });
});

test('general access: everyone on the workspace, at a role no higher than the ceiling', async () => {
  reset();
  const { handle } = mount();
  await settle();
  const audience = handle.section.querySelector<HTMLSelectElement>('select[aria-label="Who can open this project"]')!;
  assert.deepEqual([...audience.options].map((o) => o.textContent), ['Only people and groups added', 'Anyone at lolly.ing']);
  const role = handle.section.querySelector<HTMLSelectElement>('select[aria-label="Role for everyone at lolly.ing"]')!;
  assert.deepEqual([...role.options].map((o) => o.value), ['viewer', 'commenter'], 'Editor is not offered under a Commenter ceiling');
  assert.equal(role.hidden, true);
  audience.value = 'instance';
  audience.dispatchEvent(new dom.window.Event('change'));
  await settle();
  assert.deepEqual(lastPut().body, { general: { audience: 'instance', role: 'viewer' } });
  assert.match(handle.section.textContent!, /Everyone who signs in to lolly\.ing can open this project as Viewer\./);
  const again = handle.section.querySelector<HTMLSelectElement>('select[aria-label="Role for everyone at lolly.ing"]')!;
  assert.equal(again.hidden, false);
});

test('someone who cannot manage reads the same facts as text', async () => {
  reset();
  const { handle } = mount({ ...STATE, canManage: false, expiries: {}, general: { audience: 'instance', role: 'commenter' } });
  await settle();
  assert.equal(handle.section.querySelector('select'), null);
  assert.equal(handle.section.querySelector('button'), null);
  const text = handle.section.textContent!;
  assert.match(text, /brand/);
  assert.match(text, /Agency reviewers/);
  assert.match(text, /Until /, 'a group end date is shown to everyone');
  assert.match(text, /Anyone at lolly\.ing/);
});

test('a member row gets an end-date control for managers and a note otherwise', async () => {
  reset();
  const { handle } = mount();
  const controls = document.createElement('div');
  const role = document.createElement('select'), remove = document.createElement('button');
  controls.append(role, remove);
  handle.decorateMember(controls, { userId: 'u2', name: 'Bo', role: 'editor' }, true);
  await settle();
  assert.equal(controls.children[1]!.className, 'share-access-member', 'between the role and Remove');
  const ends = controls.querySelector<HTMLSelectElement>('select[aria-label="End date for Bo"]')!;
  assert.equal(ends.value, 'current');
  ends.value = '7';
  ends.dispatchEvent(new dom.window.Event('change'));
  await settle();
  const put = lastPut();
  assert.equal(put.url, '/api/v1/projects/p1/members/u2/expiry');
  const days = (Date.parse(put.body.expiresAt) - Date.now()) / 86_400_000;
  assert.ok(days > 6.9 && days <= 7, `about a week (${days})`);

  const owner = document.createElement('div');
  handle.decorateMember(owner, { userId: 'u1', name: 'Ana', role: 'owner' }, true);
  await settle();
  assert.equal(owner.querySelector('select'), null, 'the owner has no end date');

  reset();
  const reader = mount({ ...STATE, canManage: false });
  const row = document.createElement('div');
  reader.handle.decorateMember(row, { userId: 'u2', name: 'Bo', role: 'editor' }, false);
  await settle();
  assert.equal(row.querySelector('select'), null);
  assert.match(row.textContent!, /^Until /);
});

test('a refused change says why and keeps the old choice', async () => {
  reset();
  const { handle, said } = mount();
  await settle();
  router = (url, init) => (init?.method === 'PUT' ? json({ error: { code: 'ROLE_NOT_ALLOWED' } }, 403) : url === '/api/v1/share-groups' ? json(GROUPS) : json(STATE));
  const role = handle.section.querySelector<HTMLSelectElement>('select[aria-label="Role for brand"]')!;
  role.value = 'manager';
  role.dispatchEvent(new dom.window.Event('change'));
  await settle();
  assert.equal(role.value, 'editor');
  assert.deepEqual(said.at(-1), ['This workspace does not allow that role here.', true]);
});

test('end dates: the end of a chosen local day, and the words for one', () => {
  const at = endOfDay('2026-10-14')!;
  const d = new Date(at);
  assert.equal(d.getDate(), 14);
  assert.equal(d.getHours(), 23);
  assert.equal(endOfDay('14/10/2026'), null);
  assert.match(endDateText('2020-01-01T00:00:00Z'), /^Ended /);
  assert.match(endDateText('2999-01-01T00:00:00Z'), /^Until /);
});

test('the group sheet makes a group from suggestions, never showing an address', async () => {
  reset();
  router = (url, init) => {
    if (url.startsWith('/api/v1/share-groups/people')) return json({ people: [{ id: 'u5', name: 'Dee' }, { id: 'u6', name: 'Eli' }] });
    if (url === '/api/v1/share-groups' && init?.method === 'POST') return json({ id: 'sg_9', name: 'Reviewers', memberCount: 2, myRole: 'owner' }, 201);
    return new Response('', { status: 404 });
  };
  let saved: any = null;
  openShareGroupSheet({ onSaved: (g) => { saved = g; } });
  const sheet = document.querySelector<HTMLDialogElement>('dialog.share-group-sheet')!;
  assert.ok(sheet);
  const submit = sheet.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.click();
  await settle();
  assert.match(sheet.textContent!, /Give the group a name\./);
  sheet.querySelector<HTMLInputElement>('input:not([type="search"])')!.value = 'Reviewers';
  const find = sheet.querySelector<HTMLInputElement>('input[type="search"]')!;
  find.value = 'd';
  find.dispatchEvent(new dom.window.Event('input'));
  await new Promise((r) => setTimeout(r, 260));
  await settle();
  const add = [...sheet.querySelectorAll<HTMLButtonElement>('.share-group-add')].find((b) => b.textContent === 'Add Dee')!;
  add.click();
  assert.match(sheet.querySelector('.share-group-people')!.textContent!, /Dee/);
  assert.ok(!sheet.textContent!.includes('@'), 'no address anywhere');
  submit.click();
  await settle();
  const post = calls.find((c) => c.method === 'POST')!;
  assert.deepEqual(post.body, { name: 'Reviewers', add: ['u5'] });
  assert.equal(saved.id, 'sg_9');
});

test('someone found by a full address is sent by that address, not by id', async () => {
  reset();
  router = (url, init) => {
    if (url.startsWith('/api/v1/share-groups/people')) return json({ people: [{ id: 'u7', name: 'Cleo' }] });
    if (url === '/api/v1/share-groups' && init?.method === 'POST') return json({ id: 'sg_8', name: 'Agency', memberCount: 2, myRole: 'owner' }, 201);
    return new Response('', { status: 404 });
  };
  openShareGroupSheet({});
  const sheet = document.querySelector<HTMLDialogElement>('dialog.share-group-sheet')!;
  sheet.querySelector<HTMLInputElement>('input:not([type="search"])')!.value = 'Agency';
  const find = sheet.querySelector<HTMLInputElement>('input[type="search"]')!;
  find.value = 'cleo@agency.example';
  find.dispatchEvent(new dom.window.Event('input'));
  await new Promise((r) => setTimeout(r, 260));
  await settle();
  sheet.querySelector<HTMLButtonElement>('.share-group-add')!.click();
  sheet.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  await settle();
  assert.deepEqual(calls.find((c) => c.method === 'POST')!.body, { name: 'Agency', add: ['cleo@agency.example'] });
  assert.equal(document.querySelector('dialog.share-group-sheet'), null, 'closed after saving');
});

test('editing a group: the owner chooses managers and can delete it', async () => {
  reset();
  router = (url, init) => {
    if (url === '/api/v1/share-groups/sg_1' && (init?.method ?? 'GET') === 'GET') {
      return json({ id: 'sg_1', name: 'Agency', memberCount: 3, myRole: 'owner', members: [{ id: 'u1', name: 'Ana', role: 'owner' }, { id: 'u2', name: 'Bo', role: 'manager' }, { id: 'u3', name: 'Cy', role: 'member' }] });
    }
    if (url === '/api/v1/share-groups/sg_1' && init?.method === 'PATCH') return json({ id: 'sg_1', name: 'Agency', memberCount: 2, myRole: 'owner', members: [] });
    return new Response('', { status: 404 });
  };
  openShareGroupSheet({ groupId: 'sg_1' });
  await settle();
  const sheet = document.querySelector<HTMLDialogElement>('dialog.share-group-sheet')!;
  const boxes = sheet.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  assert.equal(boxes.length, 2, 'every member but the owner can be a manager');
  assert.deepEqual([...boxes].map((b) => b.checked), [true, false]);
  assert.equal(sheet.querySelector<HTMLButtonElement>('.share-group-delete')!.hidden, false);
  sheet.querySelector<HTMLButtonElement>('button[aria-label="Remove Cy"]')!.click();
  // The list is drawn again after a removal, so the checkbox is found afresh.
  sheet.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
  sheet.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  await settle();
  const patch = calls.find((c) => c.method === 'PATCH')!;
  assert.deepEqual(patch.body, { remove: ['u3'], managers: [] });
});
