// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-save.ts - the Share dialog's "Team" section (plan 74, W-SHARE-UI).
 *
 * Proves, against a stubbed fetch and a jsdom document:
 *
 *  1. DORMANCY. With no control plane, initOrg() registers no share section and no
 *     session source, and the builder itself renders nothing without a writable
 *     source - so the public shell's Share dialog is unchanged.
 *  2. A member gets the section through the registry, and only over a document the
 *     dialog can read (or one that already has a team origin).
 *  3. "Save to a team project": the POST carries the document's values, the
 *     document becomes a team document, and the team link appears.
 *  4. Device-local images are counted and named before any save.
 *  5. "Save changes" quotes the revision and moves to the new one; a 409 asks, and
 *     "Save mine as a copy" saves a new session in the same project.
 *  6. A viewer asks to edit (plans/75 G13), from the team document and from the
 *     empty project picker, only when the instance takes access requests.
 *
 * Run directly:  node --test shells/web/src/org/team-save.test.ts
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

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let router: Handler = () => new Response('', { status: 404 });
const writes: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = (init?.method || 'GET').toUpperCase();
  if (method !== 'GET' && typeof init?.body === 'string') writes.push({ url, method, body: JSON.parse(init.body) });
  return router(url, init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { buildTeamShareSection, liveCollabJoinable, teamSaveInputs, deviceLocalNote, teamLinkUrl, sameInputs, teamSaveMessage, _clearTeamProjectsForTests } = await import('./team-save.ts');
const { teamSessionQuery } = await import('./team-open.ts');
const { createInstanceSessionSource } = await import('./session-source.ts');
const { registerSessionSource, getSessionSource, _clearSessionSourceForTests } = await import('../lib/session-source.ts');
const { shareSectionBuilders, shareSectionPlacement, _clearShareSectionsForTests } = await import('../lib/share-sections.ts');
const { initOrg, _resetOrgForTests } = await import('./index.ts');
const { registerCollabOpener, _clearCollabOpenersForTests } = await import('../lib/collab-launch.ts');
const {
  activeTeamSessionOrigin, adoptTeamSessionOrigin, consumeTeamSessionOrigin, noteTeamSessionLive, _clearTeamSessionOriginForTests,
} = await import('./team-session-origin.ts');

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 6; i++) await tick(); }

function reset(): void {
  _resetOrgForTests();
  _clearShareSectionsForTests();
  _clearSessionSourceForTests();
  _clearTeamSessionOriginForTests();
  _clearTeamProjectsForTests();
  store.clear();
  writes.length = 0;
  router = () => new Response('', { status: 404 });
  document.querySelectorAll('dialog').forEach((d) => { d.remove(); });
  document.body.querySelectorAll('section').forEach((s) => { s.remove(); });
}

interface Doc { inputs: Record<string, unknown>; toolVersion?: string; label?: string; emoji?: { emoji: string; emojifx: string; emojistyle?: string } }
const DOC: Doc = { inputs: { title: 'Hi', rows: [{ name: 'A' }, { name: 'B' }] }, toolVersion: '1.4.0', label: 'Cover' };
const ctxFor = (document?: () => Doc) => ({
  toolId: 'qr-code', baseParts: [], currentFormat: 'png', copy: async () => {}, ...(document ? { document } : {}),
});
function writableSource(): void {
  registerSessionSource(createInstanceSessionSource('Acme', () => ({ sharing: { groups: ['design'] } })));
}
function mount(node: HTMLElement | null): HTMLElement {
  assert.ok(node, 'the section renders');
  document.body.append(node);
  return node;
}
const click = (root: ParentNode, sel: string): void => {
  const el = root.querySelector<HTMLElement>(sel);
  assert.ok(el, `${sel} exists`);
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
};

// ── 1. Dormancy ───────────────────────────────────────────────────────────────

test('no control plane: nothing registers, and the builder renders nothing', async () => {
  reset();
  router = () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
  assert.equal(await initOrg(), null);
  assert.equal(shareSectionBuilders().length, 0, 'the Share dialog gets no extra section');
  assert.equal(getSessionSource(), undefined);
  assert.equal(buildTeamShareSection(ctxFor(() => DOC)), null);
});

test('a read-only source offers nothing to save with', () => {
  reset();
  registerSessionSource(createInstanceSessionSource('Acme'));
  assert.equal(buildTeamShareSection(ctxFor(() => DOC)), null);
});

// ── 2. Member registration ────────────────────────────────────────────────────

test('a member gets the Team section through the registry; no document and no origin means none', async () => {
  reset();
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', role: 'member' } });
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, inboxUnread: 0, can: { 'project.create': true }, sharing: { groups: ['design'] } });
    if (url.includes('/api/v1/projects')) return json({ projects: [] });
    return new Response('', { status: 404 });
  };
  await initOrg();
  assert.ok(getSessionSource()?.write, 'the registered source can write');
  const built = await Promise.all(shareSectionBuilders().map((b) => b(ctxFor(() => DOC))));
  assert.equal(built.filter((n) => n?.classList.contains('share-team')).length, 1, 'exactly one Team section');
  // The Team section asks to sit above the dialog's own link rows; no other section does.
  const teamAt = built.findIndex((n) => n?.classList.contains('share-team'));
  assert.deepEqual(shareSectionBuilders().map(shareSectionPlacement), shareSectionBuilders().map((_, i) => (i === teamAt ? 'lead' : 'after')));
  const none = await Promise.all(shareSectionBuilders().map((b) => b(ctxFor())));
  assert.equal(none.filter((n) => n?.classList.contains('share-team')).length, 0, 'nothing to save without a document');
});

test('above the dialog\'s own rows the Team section draws its divider below itself', () => {
  reset();
  writableSource();
  router = () => json({ projects: [] });
  consumeTeamSessionOrigin('qr-code');
  const after = mount(buildTeamShareSection(ctxFor(() => DOC)));
  assert.match(after.style.borderTop, /1px solid/);
  assert.equal(after.style.borderBottom, '');
  const lead = mount(buildTeamShareSection({ ...ctxFor(() => DOC), placement: 'lead' as const }));
  assert.match(lead.style.borderBottom, /1px solid/);
  assert.equal(lead.style.borderTop, '');
});

// ── 3. Save to a team project ─────────────────────────────────────────────────

test('save a fresh document: POSTs its values, becomes a team document, shows the team link', async () => {
  reset();
  writableSource();
  router = (url, init) => {
    if (url.endsWith('/api/v1/projects') && (init?.method ?? 'GET') === 'GET') return json({ projects: [{ id: 'p1', name: 'Summit' }] });
    if (url.endsWith('/api/v1/projects/p1/sessions')) return json({ id: 'sess-new', rev: 1 }, 201);
    return new Response('', { status: 404 });
  };
  consumeTeamSessionOrigin('qr-code'); // an ordinary local mount
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  await settle();
  const select = section.querySelector<HTMLSelectElement>('select')!;
  assert.equal(select.value, 'p1', 'the first project is picked');
  assert.ok([...select.options].some((o) => o.value === '__new__'), 'a new project can be created from here');
  assert.equal(section.querySelector<HTMLInputElement>('input.field-input')!.value, 'Cover', 'the name starts as the document name');
  click(section, '[data-act="team-save-new"]');
  await settle();
  assert.deepEqual(writes, [{
    url: '/api/v1/projects/p1/sessions',
    method: 'POST',
    body: { toolId: 'qr-code', toolVersion: '1.4.0', inputs: DOC.inputs, meta: { label: 'Cover' } },
  }]);
  assert.deepEqual(activeTeamSessionOrigin('qr-code'), { sessionId: 'sess-new', toolId: 'qr-code', projectId: 'p1', rev: 1, label: 'Cover' });
  assert.equal(section.querySelector<HTMLInputElement>('.share-link-field')!.value, 'https://instance.test/#/team/sess-new');
  assert.ok(section.querySelector('[data-act="team-save-changes"]'), 'the next save is a save back');
  assert.match(section.textContent ?? '', /Saved to Summit\./);
});

test('a refused save says why and leaves the document a local one', async () => {
  reset();
  writableSource();
  router = (url, init) => {
    if (url.endsWith('/api/v1/projects') && (init?.method ?? 'GET') === 'GET') return json({ projects: [{ id: 'p1', name: 'Summit' }] });
    return json({ error: { code: 'FORBIDDEN' } }, 403);
  };
  consumeTeamSessionOrigin('qr-code');
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  await settle();
  click(section, '[data-act="team-save-new"]');
  await settle();
  assert.equal(activeTeamSessionOrigin('qr-code'), null);
  assert.match(section.querySelector('.share-team-status')!.textContent ?? '', /cannot save to that project/);
});

// ── 4. Device-local images ────────────────────────────────────────────────────

test('device-local images and in-memory files are counted; file bytes are left out', () => {
  const inputs = {
    title: 'Hi',
    photo: { id: 'user/image/1-a', source: 'user' },
    logo: { id: 'lolly/logo/primary', source: 'library' },
    slides: [{ img: { id: 'user/image/2-b', source: 'user' } }, { img: { id: 'user/image/1-a', source: 'user' } }],
    upload: { __file: true, name: 'a.pdf', type: 'application/pdf', size: 3, bytes: new Uint8Array([1, 2, 3]) },
  };
  const got = teamSaveInputs(inputs);
  assert.equal(got.deviceLocal, 3, 'two distinct user images plus one file held in memory');
  assert.equal('upload' in got.inputs, false);
  assert.deepEqual(got.inputs.slides, inputs.slides);
  assert.equal(deviceLocalNote(0), '');
  assert.match(deviceLocalNote(1), /^1 image or file .* stays on this device/);
  assert.match(deviceLocalNote(3), /^3 images or files .* stay on this device/);
});

test('the section says so before the save', async () => {
  reset();
  writableSource();
  router = () => json({ projects: [] });
  const doc = { ...DOC, inputs: { photo: { id: 'user/image/1-a', source: 'user' } } };
  const section = mount(buildTeamShareSection(ctxFor(() => doc)));
  assert.match(section.textContent ?? '', /1 image or file was added on this device/);
});

// ── 5. Save changes, and the conflict ─────────────────────────────────────────

test('save changes quotes the revision and moves to the new one', async () => {
  reset();
  writableSource();
  router = (url) => url.endsWith('/api/v1/sessions/s1') ? json({ id: 's1', rev: 4 }) : new Response('', { status: 404 });
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3, label: 'Cover' });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  assert.equal(section.querySelector<HTMLInputElement>('.share-link-field')!.value, 'https://instance.test/#/team/s1');
  click(section, '[data-act="team-save-changes"]');
  await settle();
  assert.deepEqual(writes, [{ url: '/api/v1/sessions/s1', method: 'PUT', body: { inputs: DOC.inputs, meta: { label: 'Cover' }, rev: 3 } }]);
  assert.equal(activeTeamSessionOrigin('qr-code')?.rev, 4);
});

test('a conflict asks, and "Save mine as a copy" saves a new session in the same project', async () => {
  reset();
  writableSource();
  router = (url) => {
    if (url.endsWith('/api/v1/sessions/s1')) {
      return json({ error: { code: 'CONFLICT' }, current: { id: 's1', projectId: 'p1', toolId: 'qr-code', inputs: { title: 'Theirs' }, rev: 5 } }, 409);
    }
    if (url.endsWith('/api/v1/projects/p1/sessions')) return json({ id: 's-copy', rev: 1 }, 201);
    return new Response('', { status: 404 });
  };
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3, label: 'Cover' });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  click(section, '[data-act="team-save-changes"]');
  await settle();
  const dialog = document.querySelector('dialog[open]');
  assert.ok(dialog, 'a dialog asks what to do');
  assert.match(dialog!.textContent ?? '', /Someone saved a newer version/);
  assert.ok(dialog!.querySelector('[data-choice="theirs"]'), 'Open theirs is offered');
  click(dialog!, '[data-choice="copy"]');
  await settle();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1], {
    url: '/api/v1/projects/p1/sessions',
    method: 'POST',
    body: { toolId: 'qr-code', toolVersion: '1.4.0', inputs: DOC.inputs, meta: { label: 'Cover (copy)' } },
  });
  assert.deepEqual(activeTeamSessionOrigin('qr-code'), { sessionId: 's-copy', toolId: 'qr-code', projectId: 'p1', rev: 1, label: 'Cover (copy)' });
});

test('cancelling the conflict dialog changes nothing', async () => {
  reset();
  writableSource();
  router = () => json({ error: { code: 'CONFLICT' }, current: { id: 's1', toolId: 'qr-code', inputs: { title: 'Theirs' }, rev: 5 } }, 409);
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3 });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  click(section, '[data-act="team-save-changes"]');
  await settle();
  click(document.querySelector('dialog[open]')!, '[data-act="cancel"]');
  await settle();
  assert.equal(writes.length, 1, 'only the refused PUT');
  assert.equal(activeTeamSessionOrigin('qr-code')?.rev, 3);
});

test('saving changes to a deleted session ends the team origin and offers a fresh save', async () => {
  reset();
  writableSource();
  router = (url) => url.endsWith('/api/v1/sessions/s1') ? json({ error: { code: 'GONE' } }, 410) : json({ projects: [] });
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3 });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  click(section, '[data-act="team-save-changes"]');
  await settle();
  assert.equal(activeTeamSessionOrigin('qr-code'), null);
  assert.ok(section.querySelector('[data-act="team-save-new"]'), 'the fresh save is offered');
  assert.match(section.querySelector('.share-team-status')!.textContent ?? '', /was deleted\. You can save this document as a new session/);
});

test('the team link is the instance origin plus #/team/<id>', () => {
  assert.equal(teamLinkUrl('a b', 'https://acme.example/'), 'https://acme.example/#/team/a%20b');
});

// ── Review fixes ──────────────────────────────────────────────────────────────

const fileRef = (name: string): Record<string, unknown> =>
  ({ __file: true, name, type: 'application/pdf', size: 3, bytes: new Uint8Array([1, 2, 3]) });

test('file inputs, single and multiple, are left out of the save and counted', () => {
  const got = teamSaveInputs({ title: 'Hi', pdf: fileRef('a.pdf'), pages: [fileRef('b.pdf'), fileRef('c.pdf')], none: null, empty: [] });
  assert.deepEqual(Object.keys(got.inputs).sort(), ['empty', 'none', 'title']);
  assert.equal(got.deviceLocal, 3);
  assert.equal(JSON.stringify(got.inputs).includes('"0":1'), false, 'no file bytes in the body');
});

test('no team projects yet: the New project form waits to be asked for, and Cancel closes it', async () => {
  reset();
  writableSource();
  router = () => json({ projects: [] });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  await settle();
  assert.equal(section.querySelector('form.team-new-project'), null, 'nothing opens, and nothing takes focus, by itself');
  const select = section.querySelector<HTMLSelectElement>('select')!;
  select.value = '__new__';
  select.dispatchEvent(new dom.window.Event('change'));
  await settle();
  const form = section.querySelector<HTMLFormElement>('form.team-new-project');
  assert.ok(form, 'picking New project opens the form');
  assert.equal(document.activeElement, form!.querySelector('input'), 'and focus goes to its name');
  click(form!, 'button[type="button"]'); // Cancel
  await settle();
  assert.equal(section.querySelector('form.team-new-project'), null, 'Cancel closes it for good');
  assert.notEqual(select.value, '__new__');
});

test('a section rebuilt while a save runs shows it as busy, then the result', async () => {
  reset();
  writableSource();
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  router = async (url, init) => {
    if (url.endsWith('/api/v1/projects') && (init?.method ?? 'GET') === 'GET') return json({ projects: [{ id: 'p1', name: 'Summit' }] });
    if (url.endsWith('/api/v1/projects/p1/sessions')) { await gate; return json({ id: 'sess-new', rev: 1 }, 201); }
    return new Response('', { status: 404 });
  };
  consumeTeamSessionOrigin('qr-code');
  const first = mount(buildTeamShareSection(ctxFor(() => DOC)));
  await settle();
  click(first, '[data-act="team-save-new"]');
  await settle();
  first.remove(); // the docked panel rebuilds on an edit
  const second = mount(buildTeamShareSection(ctxFor(() => DOC)));
  await settle();
  assert.equal(second.querySelector('[data-act="team-save-new"]'), null, 'no second save while the first runs');
  release();
  await settle();
  assert.ok(second.querySelector('[data-act="team-save-changes"]'), 'the rebuilt section shows the team document');
  assert.match(second.textContent ?? '', /Saved to Summit\./);
  assert.equal(writes.length, 1);
});

test('a save that resolves after the person moved to another document does not claim it', async () => {
  reset();
  writableSource();
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  router = async (url, init) => {
    if (url.endsWith('/api/v1/projects') && (init?.method ?? 'GET') === 'GET') return json({ projects: [{ id: 'p1', name: 'Summit' }] });
    if (url.endsWith('/api/v1/projects/p1/sessions')) { await gate; return json({ id: 'sess-new', rev: 1 }, 201); }
    return new Response('', { status: 404 });
  };
  consumeTeamSessionOrigin('qr-code');
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  await settle();
  click(section, '[data-act="team-save-new"]');
  await settle();
  consumeTeamSessionOrigin('qr-code'); // a new document of the same tool mounted
  release();
  await settle();
  assert.equal(activeTeamSessionOrigin('qr-code'), null);
});

test('a person who may not save sessions is not offered a save', () => {
  reset();
  registerSessionSource(createInstanceSessionSource('Acme', () => ({ can: { 'session.create': false, 'session.edit': false } })));
  assert.equal(buildTeamShareSection(ctxFor(() => DOC)), null, 'no fresh save');
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3 });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  assert.equal(section.querySelector('[data-act="team-save-changes"]'), null, 'no Save changes');
  assert.ok(section.querySelector('.share-link-field'), 'the team link is still there');
});

test('a refused Save changes names the permission, not the project', async () => {
  reset();
  writableSource();
  router = () => json({ error: { code: 'FORBIDDEN' } }, 403);
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3 });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  click(section, '[data-act="team-save-changes"]');
  await settle();
  assert.match(section.querySelector('.share-team-status')!.textContent ?? '', /do not have permission/);
});

test('a session held by a live collab says so, and asks nothing', async () => {
  reset();
  writableSource();
  router = () => json({ error: { code: 'COLLAB_ACTIVE', message: 'live room' } }, 409);
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3 });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  click(section, '[data-act="team-save-changes"]');
  await settle();
  assert.equal(document.querySelector('dialog[open]'), null, 'no "someone saved a newer version" dialog');
  assert.equal(section.querySelector('.share-team-status')!.textContent,
    'This session is open for live editing. Try again when it closes.');
  assert.equal(activeTeamSessionOrigin('qr-code')?.rev, 3, 'still the same team document');
  assert.equal(teamSaveMessage(409, 'COLLAB_ACTIVE'), teamSaveMessage(0, 'COLLAB_ACTIVE'), 'the code decides, not the status');
  assert.equal(teamSaveMessage(409), 'Could not save. Try again.');
});

test('the live-editing refusal names Start a collab only when the dialog offers it', async () => {
  const join = 'This session is open for live editing. Use Start a collab to join in.';
  const wait = 'This session is open for live editing. Try again when it closes.';
  const both = { can: { 'collab.join': true, 'collab.edit': true } };
  _clearCollabOpenersForTests();
  assert.equal(liveCollabJoinable(both), false, 'no work opener, so no Work collab section to point at');
  registerCollabOpener('work', () => {});
  assert.equal(liveCollabJoinable(both), true);
  assert.equal(liveCollabJoinable({ can: { 'collab.join': true } }), false, 'in the room this person could not make changes either');
  assert.equal(liveCollabJoinable({ can: { 'collab.edit': true } }), false, 'without collab.join the section is not shown');
  assert.equal(liveCollabJoinable(null), false);
  assert.equal(teamSaveMessage(409, 'COLLAB_ACTIVE', true), join);
  assert.equal(teamSaveMessage(409, 'COLLAB_ACTIVE', false), wait);

  // Through the section, with the config org/index.ts passes to the section.
  reset();
  writableSource();
  router = () => json({ error: { code: 'COLLAB_ACTIVE', message: 'live room' } }, 409);
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3 });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC), () => both));
  click(section, '[data-act="team-save-changes"]');
  await settle();
  assert.equal(section.querySelector('.share-team-status')!.textContent, join);
  _clearCollabOpenersForTests();
});

test('inside the live collab on this session there is no Save changes to press', () => {
  reset();
  writableSource();
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3, label: 'Cover' });
  const leave = noteTeamSessionLive('s1');
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  assert.equal(section.querySelector('[data-act="team-save-changes"]'), null);
  assert.equal(section.querySelector('[data-act="team-save-new"]'), null, 'nor a save as a new session');
  assert.match(section.textContent ?? '', /Team session: Cover/);
  assert.match(section.textContent ?? '', /The live collab saves your changes to this session\./);
  assert.ok(section.querySelector('[data-act="team-copy-link"]'), 'the team link is still there');
  leave();
  section.remove();
  assert.ok(mount(buildTeamShareSection(ctxFor(() => DOC))).querySelector('[data-act="team-save-changes"]'), 'back once the room closes');
});

test('an origin with no revision never overwrites: it asks first', async () => {
  reset();
  writableSource();
  router = (url, init) => {
    if (url.endsWith('/api/v1/sessions/s1') && (init?.method ?? 'GET') === 'GET') return json({ id: 's1', projectId: 'p1', toolId: 'qr-code', inputs: { title: 'Theirs' }, rev: 9 });
    if (url.endsWith('/api/v1/sessions/s1')) return json({ id: 's1', rev: 10 });
    return new Response('', { status: 404 });
  };
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1' });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  click(section, '[data-act="team-save-changes"]');
  await settle();
  assert.equal(writes.filter((w) => w.method === 'PUT').length, 0, 'no unconditional overwrite');
  assert.ok(document.querySelector('dialog[open] [data-choice="copy"]'), 'a copy is offered');
});

test('"Open theirs" that cannot open keeps the old revision and says so in the section', async () => {
  reset();
  writableSource();
  router = () => json({ error: { code: 'CONFLICT' }, current: { id: 's1', projectId: 'p1', toolId: 'qr-code', inputs: { title: 'Theirs' }, rev: 5 } }, 409);
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3 });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  click(section, '[data-act="team-save-changes"]');
  await settle();
  click(document.querySelector('dialog[open]')!, '[data-choice="theirs"]');
  await settle();
  assert.equal(activeTeamSessionOrigin('qr-code')?.rev, 3, 'the next save still conflicts');
  assert.match(section.querySelector('.share-team-status')!.textContent ?? '', /could not be opened/);
});

test('"Open theirs" when theirs differs only in key order catches up the revision', async () => {
  reset();
  writableSource();
  router = () => json({ error: { code: 'CONFLICT' }, current: { id: 's1', projectId: 'p1', toolId: 'qr-code', inputs: { rows: [{ name: 'A' }, { name: 'B' }], title: 'Hi' }, rev: 5 } }, 409);
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 3 });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC)));
  click(section, '[data-act="team-save-changes"]');
  await settle();
  click(document.querySelector('dialog[open]')!, '[data-choice="theirs"]');
  await settle();
  assert.equal(activeTeamSessionOrigin('qr-code')?.rev, 5);
  assert.match(section.querySelector('.share-team-status')!.textContent ?? '', /matches yours/);
  assert.equal(sameInputs({ a: 1, b: { c: [1, { d: 2, e: 3 }] } }, { b: { c: [1, { e: 3, d: 2 }] }, a: 1 }), true);
  assert.equal(sameInputs({ a: [1, 2] }, { a: [2, 1] }), false, 'array order still counts');
});

test('the emoji set travels with the save and comes back in the address', async () => {
  reset();
  writableSource();
  router = (url, init) => {
    if (url.endsWith('/api/v1/projects') && (init?.method ?? 'GET') === 'GET') return json({ projects: [{ id: 'p1', name: 'Summit' }] });
    if (url.endsWith('/api/v1/projects/p1/sessions')) return json({ id: 'sess-new', rev: 1 }, 201);
    return new Response('', { status: 404 });
  };
  const emoji = { emoji: 'twemoji@17.0.3', emojifx: 'original', emojistyle: '{"schemaVersion":1}' };
  consumeTeamSessionOrigin('qr-code');
  const section = mount(buildTeamShareSection(ctxFor(() => ({ ...DOC, emoji }))));
  await settle();
  click(section, '[data-act="team-save-new"]');
  await settle();
  assert.deepEqual(writes[0]!.body.meta, { label: 'Cover', emoji });
  const query = teamSessionQuery('title=Hi', { emoji });
  const params = new URLSearchParams(query);
  assert.equal(params.get('title'), 'Hi');
  assert.equal(params.get('emoji'), 'twemoji@17.0.3');
  assert.equal(params.get('emojistyle'), '{"schemaVersion":1}');
  assert.equal(teamSessionQuery('title=Hi', { emoji: { emoji: 5 } }), 'title=Hi', 'a malformed stamp adds nothing');
  assert.equal(teamSessionQuery('', undefined), '');
});

// ── 6. Ask to edit ────────────────────────────────────────────────────────────

/** The org-config the section reads: requests on or off. `can` keeps the literal
 *  in common with the section's config type. */
const requestsOn = { can: {}, requests: { project: true } };
const requestsOff = { can: {} };

function viewerOf(projects: Array<{ id: string; name: string; myRole: string }>, writer: Record<string, unknown> = {}): void {
  reset();
  registerSessionSource(createInstanceSessionSource('Acme', () => writer));
  router = (url, init) => {
    if (url === '/api/v1/projects' && (init?.method ?? 'GET') === 'GET') return json({ projects });
    if (url.startsWith('/api/v1/access-requests/mine')) return json({ requests: [] });
    if (url === '/api/v1/projects/p1/access-requests') return json({ ok: true }, 202);
    return new Response('', { status: 404 });
  };
  adoptTeamSessionOrigin({ sessionId: 's1', toolId: 'qr-code', projectId: 'p1', rev: 1, label: 'Cover' });
}

test('a viewer asks to edit from the team document, and the button says the request went', async () => {
  viewerOf([{ id: 'p1', name: 'Summit', myRole: 'viewer' }, { id: 'p2', name: 'Mine', myRole: 'editor' }]);
  const section = mount(buildTeamShareSection(ctxFor(() => DOC), () => requestsOn));
  await settle();
  assert.ok(section.querySelector('[data-act="team-save-copy"]'), 'a viewer still gets Save a copy');
  const ask = section.querySelector<HTMLButtonElement>('[data-act="team-ask-edit"]')!;
  assert.equal(ask.textContent, 'Ask to edit');
  assert.equal(ask.getAttribute('aria-expanded'), 'false');
  ask.click();
  await settle();
  assert.equal(ask.getAttribute('aria-expanded'), 'true');
  const form = section.querySelector<HTMLElement>('[data-team-ask]')!;
  assert.equal(form.querySelector('h4')!.textContent, 'Ask to edit Summit');
  assert.match(form.textContent ?? '', /The managers of Summit will see your request\./);
  assert.equal(form.querySelector('select'), null, 'the role is edit, so there is nothing to pick');
  form.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  assert.deepEqual(writes, [{ url: '/api/v1/projects/p1/access-requests', method: 'POST', body: { role: 'editor' } }]);
  assert.equal(ask.textContent, 'Edit request sent');
  assert.equal(ask.disabled, true);
  // The docked panel rebuilds the section on an edit: the button still says the request went.
  section.remove();
  const again = mount(buildTeamShareSection(ctxFor(() => DOC), () => requestsOn));
  await settle();
  const after = again.querySelector<HTMLButtonElement>('[data-act="team-ask-edit"]')!;
  assert.equal(after.textContent, 'Edit request sent');
  assert.equal(after.disabled, true);
});

test('no Ask to edit when the instance takes no requests, or for an editor', async () => {
  viewerOf([{ id: 'p1', name: 'Summit', myRole: 'viewer' }]);
  const off = mount(buildTeamShareSection(ctxFor(() => DOC), () => requestsOff));
  await settle();
  assert.ok(off.querySelector('[data-act="team-save-copy"]'));
  assert.equal(off.querySelector('[data-act="team-ask-edit"]'), null);
  const none = mount(buildTeamShareSection(ctxFor(() => DOC)));
  await settle();
  assert.equal(none.querySelector('[data-act="team-ask-edit"]'), null, 'no config reader, no requests');

  viewerOf([{ id: 'p1', name: 'Summit', myRole: 'editor' }]);
  const editor = mount(buildTeamShareSection(ctxFor(() => DOC), () => requestsOn));
  await settle();
  assert.ok(editor.querySelector('[data-act="team-save-changes"]'));
  assert.equal(editor.querySelector('[data-act="team-ask-edit"]'), null);
});

test('the empty picker offers Ask to edit beside "Ask a project owner for edit access."', async () => {
  viewerOf([{ id: 'p1', name: 'Summit', myRole: 'viewer' }], { can: { 'project.create': false } });
  const section = mount(buildTeamShareSection(ctxFor(() => DOC), () => requestsOn));
  await settle();
  click(section, '[data-act="team-save-copy"]');
  await settle();
  assert.match(section.textContent ?? '', /Ask a project owner for edit access\./);
  const ask = section.querySelector<HTMLButtonElement>('[data-act="team-ask-edit"]')!;
  assert.ok(ask && !ask.hidden, 'a visible way to ask');
  ask.click();
  await settle();
  assert.equal(section.querySelector('[data-team-ask] h4')!.textContent, 'Ask to edit Summit');
});

test('the empty picker offers no Ask to edit to someone who can make a project', async () => {
  viewerOf([{ id: 'p1', name: 'Summit', myRole: 'viewer' }]);
  const section = mount(buildTeamShareSection(ctxFor(() => DOC), () => requestsOn));
  await settle();
  click(section, '[data-act="team-save-copy"]');
  await settle();
  assert.match(section.textContent ?? '', /Create a project to save this document\./);
  const ask = section.querySelector<HTMLButtonElement>('[data-act="team-ask-edit"]');
  assert.ok(!ask || ask.hidden);
});
