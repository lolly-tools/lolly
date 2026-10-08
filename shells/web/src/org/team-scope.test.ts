// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-scope.ts: a team document's scope chip, Save, leave question and view-only
 * mode (plan 75 G1, G2 and J5/J6), driven through the real seams: the origin module
 * (org/team-session-origin.ts), the scope seam (lib/document-scope.ts), the input
 * policy's document layer and a session source whose writer records every call.
 *
 * Covers: Save routes to the session with the revision it was opened at (rev CAS) and
 * moves the origin to the new revision; a newer save by someone else is a choice, never
 * an overwrite ("Save mine as a copy" files a new session, "Open theirs" keeps these
 * edits on the device first); a viewer's inputs are read-only from the mount hook, a
 * banner says so, Save offers a copy and writes nothing; Make a copy into an editable
 * project gives the document its new scope in place; the workspace-role variant; and a
 * deleted session makes the document this device's again.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/org/team-scope.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/#/tool/poster', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.history = dom.window.history as unknown as History;
globalThis.sessionStorage = dom.window.sessionStorage;
for (const k of ['HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent'] as const) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as typeof requestAnimationFrame;
globalThis.addEventListener = dom.window.addEventListener.bind(dom.window);
globalThis.removeEventListener = dom.window.removeEventListener.bind(dom.window);
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const origin = await import('./team-session-origin.ts');
const scope = await import('../lib/document-scope.ts');
const policy = await import('../lib/input-policy.ts');
const teamScope = await import('./team-scope.ts');
const { registerSessionSource } = await import('../lib/session-source.ts');
type Src = import('../lib/session-source.ts').SessionSource;
type Save = import('../lib/session-source.ts').TeamSessionSave;
type Mount = import('../lib/document-scope.ts').DocumentScopeMount;
type TeamRole = import('../lib/session-source.ts').TeamRole;

const settle = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));
const ORIGIN = { sessionId: 'sess-1', toolId: 'poster', projectId: 'proj-9', rev: 3, label: 'Spring poster' };

interface Calls { update: Array<Record<string, unknown>>; create: Array<{ projectId: string; input: Record<string, unknown> }> }

function source(opts: { update?: Save; create?: Save; canEdit?: boolean } = {}): { calls: Calls; off: () => void } {
  const calls: Calls = { update: [], create: [] };
  const src: Src = {
    label: 'lolly.ing',
    listProjects: async () => [
      { id: 'proj-9', name: 'Brand refresh', myRole: 'viewer' },
      { id: 'proj-2', name: 'Drafts', myRole: 'editor' },
    ],
    listSessions: async () => [],
    fetchSession: async () => null,
    write: {
      projectOptions: () => ({ canCreate: true, groups: [], canSave: true, ...(opts.canEdit === false ? { canEdit: false } : {}) }),
      createProject: async () => ({ kind: 'error', status: 500 }),
      createSession: async (projectId, input) => { calls.create.push({ projectId, input: { ...input } }); return opts.create ?? { kind: 'saved', id: 'sess-new', rev: 1 }; },
      updateSession: async (input) => { calls.update.push({ ...input }); return opts.update ?? { kind: 'saved', id: input.id, rev: input.rev + 1 }; },
    },
  };
  return { calls, off: registerSessionSource(src) };
}

function view(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = '<aside><div id="tool-inputs"><input type="text" data-input-id="headline" value="Hi"></div></aside><div id="tool-stage"><div id="tool-canvas"></div></div><div id="tool-actions"><button data-action="save"><span data-save-label>Save</span></button></div>';
  document.body.append(el);
  return el;
}

interface Harness { el: HTMLElement; mount: Mount; stop: () => void; deviceSaves: number }

/** Open `role`'s team document the way org/team-open.ts does, then mount the tool. */
async function open(role: string | undefined, inputs: Record<string, unknown> = { headline: 'Hello' }): Promise<Harness> {
  origin._clearTeamSessionOriginForTests();
  scope._resetDocumentScopeForTests();
  teamScope._resetTeamScopeForTests();
  policy._clearInputPoliciesForTests();
  document.body.replaceChildren();
  dom.window.history.replaceState(null, '', '#/tool/poster');
  await origin.prepareTeamScope();
  origin.rememberTeamSessionOrigin({ ...ORIGIN, ...(role ? { role: role as TeamRole } : {}) });
  origin.consumeTeamSessionOrigin('poster');
  // The tool view announces its mount to the input policy before its first sidebar draw.
  policy.notifyToolInputMount('poster');
  const el = view();
  const h: Harness = { el, mount: null as unknown as Mount, stop: () => {}, deviceSaves: 0 };
  h.mount = {
    toolId: 'poster', view: el,
    document: () => ({ inputs, toolVersion: '1.0.0' }),
    unsaved: () => false,
    saveOnDevice: async () => { h.deviceSaves++; return true; },
  };
  h.stop = scope.mountDocumentScope(h.mount);
  await settle();
  return h;
}

const chip = (el: HTMLElement): string => el.querySelector('.document-scope-label')?.textContent ?? '';
const chipState = (el: HTMLElement): string => {
  const state = el.querySelector<HTMLElement>('.document-scope-state');
  return state && !state.hidden ? state.textContent ?? '' : '';
};
const choose = async (selector: string): Promise<void> => {
  await settle(5);
  const dialog = document.querySelector('dialog');
  assert.ok(dialog, 'a dialog is up');
  dialog!.querySelector<HTMLElement>(selector)!.click();
};

test('an editor: the chip names the project, Save writes back with the revision it was opened at', async () => {
  const { calls, off } = source();
  const h = await open('editor');
  await settle();
  assert.equal(chip(h.el), 'Brand refresh · Can edit');
  assert.equal(scope.documentLeavePrompt(), 'Save changes to Brand refresh?');
  assert.equal(policy.getInputPolicy('poster', 'headline'), undefined, 'an editor\'s inputs are editable');
  assert.equal(await scope.saveInDocumentScope('poster'), true);
  assert.equal(calls.update.length, 1);
  assert.deepEqual(calls.update[0], { id: 'sess-1', projectId: 'proj-9', inputs: { headline: 'Hello' }, meta: { label: 'Spring poster' }, rev: 3 }, 'compare-and-set on rev 3');
  assert.equal(origin.activeTeamSessionOrigin('poster')?.rev, 4, 'the next save quotes the new revision');
  await settle();
  assert.equal(chipState(h.el), 'Saved just now');
  h.stop();
  off();
});

test('a newer save by someone else: "Save mine as a copy" files a new session, nothing is overwritten', async () => {
  const theirs = { toolId: 'poster', inputs: { headline: 'Theirs' }, rev: 5, projectId: 'proj-9', updatedByName: 'Priya', updatedAt: new Date().toISOString() };
  const { calls, off } = source({ update: { kind: 'conflict', current: theirs } });
  const h = await open('editor');
  const saved = scope.saveInDocumentScope('poster')!;
  await choose('[data-choice="copy"]');
  assert.equal(await saved, true);
  assert.equal(calls.update.length, 1, 'one attempt, refused');
  assert.equal(calls.create.length, 1);
  assert.equal(calls.create[0]!.projectId, 'proj-9', 'the copy goes into the same project');
  assert.equal((calls.create[0]!.input.meta as { label?: string }).label, 'Spring poster (copy)');
  assert.equal(origin.activeTeamSessionOrigin('poster')?.sessionId, 'sess-new', 'the document is now the copy');
  h.stop();
  off();
});

test('a newer save by someone else: "Open theirs" keeps these edits on the device first', async () => {
  const theirs = { toolId: 'poster', inputs: { headline: 'Theirs' }, rev: 5, projectId: 'proj-9' };
  const { off } = source({ update: { kind: 'conflict', current: theirs } });
  const h = await open('editor');
  const saved = scope.saveInDocumentScope('poster')!;
  await choose('[data-choice="theirs"]');
  assert.equal(await saved, false, 'nothing was saved to the session');
  assert.equal(h.deviceSaves, 1, 'the edits are a device copy');
  assert.equal(dom.window.location.hash, '#/team/sess-1', 'then their version opens');
  h.stop();
  off();
});

test('a viewer: read-only inputs, a banner, and Save offers a copy instead of writing', async () => {
  const { calls, off } = source();
  const h = await open('viewer');
  assert.equal(policy.getInputPolicy('poster', 'headline')?.readable, true, 'locked before the first sidebar draw');
  await settle();
  assert.equal(chip(h.el), 'Brand refresh · View only');
  const banner = h.el.querySelector('.viewer-banner');
  assert.ok(banner, 'the banner is up');
  assert.equal(banner!.querySelector('.viewer-banner-text')?.textContent, 'View only. Changes can’t be saved to Brand refresh.');
  assert.ok(banner!.previousElementSibling === null && banner!.nextElementSibling?.id === 'tool-inputs', 'above the inputs');
  assert.equal(scope.documentLeavePrompt(), null, 'no "Save changes to…" for a viewer');
  assert.equal(await scope.saveInDocumentScope('poster'), false);
  assert.equal(calls.update.length, 0, 'nothing reaches the project');
  await settle();
  const toast = document.querySelector('.undo-toast');
  assert.equal(toast?.querySelector('.undo-toast-msg')?.textContent, 'This is view only. Make a copy to keep your changes.');
  assert.equal(toast?.querySelector('.undo-toast-btn')?.textContent, 'Make a copy', 'with the way forward');
  h.stop();
  assert.equal(h.el.querySelector('.viewer-banner'), null, 'the mount took its banner');
  assert.equal(policy.getInputPolicy('poster', 'headline'), undefined, 'and released the read-only layer');
  off();
});

test('a viewer\'s copy into a project they can edit opens with its new scope, in place', async () => {
  const { calls, off } = source();
  const h = await open('viewer');
  h.el.querySelector<HTMLElement>('#tool-inputs')!.innerHTML =
    '<span class="input-locked input-locked--readable"><input type="text" readonly aria-readonly="true" data-readonly-added="readonly aria-readonly"></span>';
  const made = teamScope.makeCopy(h.mount);
  await settle(20);
  const sheet = document.querySelector('dialog.make-copy-sheet')!;
  assert.ok(sheet, 'the sheet is up');
  assert.equal(sheet.querySelector('.modal-title')?.textContent, 'Make a copy');
  const projectChoice = sheet.querySelector<HTMLElement>('[data-project-option]')!;
  assert.equal(projectChoice.hidden, false, 'a project they can edit is offered');
  const options = [...sheet.querySelectorAll('option')].map((o) => o.textContent);
  assert.deepEqual(options, ['Drafts'], 'only projects they can edit');
  projectChoice.querySelector<HTMLInputElement>('input')!.checked = true;
  sheet.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  sheet.querySelector<HTMLElement>('[data-act="make"]')!.click();
  assert.equal(await made, true);
  assert.equal(calls.create[0]!.projectId, 'proj-2');
  const now = origin.activeTeamSessionOrigin('poster');
  assert.equal(now?.sessionId, 'sess-new');
  assert.equal(now?.role, 'editor');
  await settle();
  assert.equal(chip(h.el), 'Drafts · Can edit');
  assert.equal(h.el.querySelector('.viewer-banner'), null, 'no longer view only');
  assert.equal(policy.getInputPolicy('poster', 'headline'), undefined);
  assert.equal(h.el.querySelector('[readonly]'), null, 'the inputs work again without waiting for a redraw');
  h.stop();
  off();
});

test('a viewer\'s copy on this device makes the document this device\'s', async () => {
  const { off } = source();
  const h = await open('viewer');
  const made = teamScope.makeCopy(h.mount);
  await settle(20);
  document.querySelector<HTMLElement>('dialog.make-copy-sheet [data-act="make"]')!.click();
  assert.equal(await made, true);
  assert.equal(h.deviceSaves, 1);
  assert.equal(origin.activeTeamSessionOrigin('poster'), null);
  await settle();
  assert.equal(chip(h.el), 'On this device');
  assert.equal(h.el.querySelector('.viewer-banner'), null);
  h.stop();
  off();
});

test('a workspace role that cannot edit: the workspace variant, for any project role', async () => {
  const { off } = source({ canEdit: false });
  const h = await open('editor');
  await settle();
  assert.equal(chip(h.el), 'Brand refresh · View only (workspace role)');
  assert.equal(h.el.querySelector('.viewer-banner-text')?.textContent,
    'Your role on lolly.ing lets you view only. Ask an admin of lolly.ing to change your role.');
  assert.equal(policy.getInputPolicy('poster', 'headline')?.readable, true);
  h.stop();
  off();
});

test('a deleted session: the document is this device\'s again, and Save goes back to the device', async () => {
  const { off } = source({ update: { kind: 'error', status: 410 } });
  const h = await open('editor');
  assert.equal(await scope.saveInDocumentScope('poster'), false);
  assert.equal(origin.activeTeamSessionOrigin('poster'), null);
  assert.equal(scope.saveInDocumentScope('poster'), null, 'nothing claims it now');
  h.stop();
  off();
});

test('pure helpers: file bytes stay out of a save, and inputs compare without key order', () => {
  const bytes = new Uint8Array([1, 2]);
  assert.deepEqual(teamScope.scopeSaveInputs({ a: 'x', b: bytes, c: [bytes, bytes], d: { __file: true, bytes }, e: [] }), { a: 'x', e: [] });
  assert.equal(teamScope.sameScopeInputs({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }), true);
  assert.equal(teamScope.sameScopeInputs({ a: 1 }, { a: 2 }), false);
  assert.equal(teamScope.teamScopeLink('sess 1', 'https://lolly.ing/'), 'https://lolly.ing/#/team/sess%201');
});

test('inside a live work collab the room saves: Save says so and sends nothing', async () => {
  const { calls, off } = source();
  const h = await open('editor');
  const leave = origin.noteTeamSessionLive('sess-1');
  scope.notifyDocumentScopeChange();
  await settle();
  assert.equal(chipState(h.el), '', 'no save state to say');
  assert.equal(scope.documentLeavePrompt(), null, 'and no "Save changes to…" on leaving');
  assert.equal(await scope.saveInDocumentScope('poster'), true);
  assert.equal(calls.update.length, 0, 'the instance would refuse a save from outside the room');
  leave();
  h.stop();
  off();
});

test('a commenter, and a role this shell does not know, open the document view-only', async () => {
  for (const [role, carried] of [['commenter', 'commenter'], ['reviewer', 'viewer']] as const) {
    const { calls, off } = source();
    const h = await open(role);
    assert.equal(origin.activeTeamSessionOrigin('poster')?.role, carried, `${role}: carried as ${carried}`);
    assert.equal(policy.getInputPolicy('poster', 'headline')?.readable, true, `${role}: read-only from the first draw`);
    await settle();
    assert.equal(chip(h.el), 'Brand refresh · View only');
    assert.equal(scope.documentLeavePrompt(), null, 'no "Save changes to…", so Leave without saving discards');
    assert.equal(await scope.saveInDocumentScope('poster'), false);
    assert.equal(calls.update.length, 0, 'no Save is offered, so none is refused with a 403');
    h.stop();
    off();
  }
  // Only an absent role is unknown: the instance's answer to a save decides then.
  const { off } = source();
  const h = await open(undefined);
  assert.equal(origin.activeTeamSessionOrigin('poster')?.role, undefined);
  assert.equal(policy.getInputPolicy('poster', 'headline'), undefined);
  h.stop();
  off();
});

test('a viewer\'s edit from any editor is refused, and said once per gesture with Make a copy', async () => {
  const { off } = source();
  const h = await open('viewer');
  const said = (): number => [...document.querySelectorAll('.undo-toast-msg')]
    .filter((m) => m.textContent === 'This is view only. Make a copy to keep your changes.').length;
  const before = said();
  // What the mounted runtime's guarded setInput asks on every write (views/tool/setup.ts).
  assert.equal(policy.refuseDocumentEdit('poster'), true);
  assert.equal(policy.refuseDocumentEdit('poster'), true, 'a drag writes on every move');
  await settle();
  assert.equal(said() - before, 1, 'said once, not once per move');
  const toast = [...document.querySelectorAll('.undo-toast')].at(-1);
  assert.equal(toast?.querySelector('.undo-toast-btn')?.textContent, 'Make a copy');
  h.stop();
  assert.equal(policy.refuseDocumentEdit('poster'), false, 'the mount ended: nothing is refused');
  off();
});
