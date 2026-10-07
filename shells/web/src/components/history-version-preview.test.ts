// SPDX-License-Identifier: MPL-2.0
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { CollabHistoryCapability, CollabHistoryEntry, CollabHistoryRestoreResult } from '../lib/collab-history.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, location: dom.window.location, history: dom.window.history,
  requestAnimationFrame: (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0),
});
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const { contributorsText, versionReason, openVersionPreview, mountVersionSave, UNDO_RESTORE_MS } = await import('./history-version-preview.ts');
const { flushUndoToasts } = await import('../lib/undo-toast.ts');

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const entry = (more: Partial<CollabHistoryEntry> = {}): CollabHistoryEntry => ({
  id: 'ver_1', documentId: 's1', toolId: 'design', label: 'Spring poster', reason: 'checkpoint',
  actor: { id: 'collab' }, at: '2026-10-08T09:00:00.000Z', revision: 4, ...more,
});
interface Calls { restore: string[]; remove: string[]; saved: string[]; changed: (string | undefined)[]; status: string[] }
function capability(role: 'viewer' | 'editor' | 'manager', overrides: Partial<CollabHistoryCapability> = {}) {
  const calls: Calls = { restore: [], remove: [], saved: [], changed: [], status: [] };
  let result: CollabHistoryRestoreResult | Error = { undoId: 'ver_before', skipped: [], vetoed: [] };
  const collab: CollabHistoryCapability = {
    scope: 'shared', durability: 'durable', canSaveCopy: true, canRestore: role !== 'viewer',
    list: async () => ({ entries: [] }), read: async () => null,
    preview: async () => 'data:image/png;base64,AAAA',
    async restore(id) { calls.restore.push(id); if (result instanceof Error) throw result; return result; },
    async saveVersion(label) { calls.saved.push(label); },
    ...(role === 'manager' ? { async remove(id: string) { calls.remove.push(id); } } : {}),
    ...overrides,
  };
  const actions = { status: (message: string) => { calls.status.push(message); }, changed: (message?: string) => { calls.changed.push(message); } };
  return { collab, calls, actions, answer(next: CollabHistoryRestoreResult | Error) { result = next; } };
}
const dialogs = () => [...document.querySelectorAll<HTMLDialogElement>('dialog')];
const preview = () => document.querySelector<HTMLDialogElement>('dialog.history-version-preview');
const buttons = (root: ParentNode) => [...root.querySelectorAll<HTMLButtonElement>('button')].map(button => button.textContent);
const press = (root: ParentNode, text: string) => {
  const node = [...root.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === text);
  assert.ok(node, `button ${text}`); node.click();
};
/** Answer the topmost confirmation. */
const confirm = async (ok: boolean) => {
  await settle();
  const dialog = dialogs().at(-1)!;
  assert.ok(dialog.querySelector('[data-act="ok"]'), 'a confirmation is open');
  dialog.querySelector<HTMLElement>(`[data-act="${ok ? 'ok' : 'cancel'}"]`)!.click();
  await settle(); await settle();
};
afterEach(() => { flushUndoToasts(); for (const dialog of dialogs()) dialog.dispatchEvent(new dom.window.Event('cancel', { cancelable: true })); });

test('contributors read as a list of names, shortened with a count, never markup', () => {
  assert.equal(contributorsText(entry()), null);
  assert.equal(contributorsText(entry({ contributors: [{ id: 'u1', label: 'Ana' }] })), 'Edited by Ana');
  assert.equal(contributorsText(entry({ contributors: [{ id: 'u1', label: 'Ana' }, { id: 'guest' }, { id: 'gone' }] })),
    'Edited by Ana, Guest, and Unknown editor');
  assert.equal(contributorsText(entry({ contributors: ['Ana', 'Ben', 'Cy', 'Di', 'Ed'].map((label, i) => ({ id: `u${i}`, label })) })),
    'Edited by Ana, Ben and 3 more');
  assert.equal(contributorsText(entry({ contributors: [{ id: 'u1', label: '<img src=x>' }] })), 'Edited by <img src=x>', 'tRaw keeps the name as text');
});

test('reasons name saved, restored and automatic versions', () => {
  assert.equal(versionReason('named', true), 'Saved version');
  assert.equal(versionReason('save', true), 'Saved version');
  assert.equal(versionReason('restore', true), 'Restored version');
  assert.equal(versionReason('recovery', true), 'Recovered work');
  assert.equal(versionReason('checkpoint', true), 'Automatic version');
  assert.equal(versionReason('checkpoint', false), 'Automatic checkpoint', 'session-only histories keep their wording');
});

test('a viewer previews a version larger, with its facts as text and no restore or delete', async () => {
  const { collab, actions } = capability('viewer');
  openVersionPreview({ collab, entry: entry({ contributors: [{ id: 'u1', label: '<b>Ana</b>' }] }), actions, openCopy: async () => {} });
  await settle();
  const dialog = preview()!;
  const time = new Date('2026-10-08T09:00:00.000Z').toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  assert.equal(dialog.getAttribute('aria-label'), `Version from ${time}`, 'an unnamed version is titled by when it was made');
  assert.equal(dialog.querySelector('img')?.getAttribute('src'), 'data:image/png;base64,AAAA');
  assert.equal(dialog.querySelector('.history-version-facts b'), null, 'names cannot inject markup');
  assert.match(dialog.querySelector('.history-version-facts')!.textContent!, /Automatic version.*Edited by <b>Ana<\/b>/);
  assert.deepEqual(buttons(dialog), ['Open as a copy', 'Close preview']);
  press(dialog, 'Close preview');
  assert.equal(preview(), null);
});

test('a named version is titled by its name; writers may restore and managers may delete', async () => {
  const editor = capability('editor');
  openVersionPreview({ collab: editor.collab, entry: entry({ reason: 'named', label: 'Final draft' }), actions: editor.actions, openCopy: async () => {} });
  assert.equal(preview()!.querySelector('h2')?.textContent, 'Final draft');
  assert.deepEqual(buttons(preview()!), ['Open as a copy', 'Restore this version', 'Close preview']);
  press(preview()!, 'Close preview');
  const manager = capability('manager');
  openVersionPreview({ collab: manager.collab, entry: entry(), actions: manager.actions, openCopy: async () => {} });
  assert.deepEqual(buttons(preview()!), ['Delete version', 'Open as a copy', 'Restore this version', 'Close preview']);
});

test('a preview that cannot be made says so instead of showing an image', async () => {
  for (const answer of [async () => null, async () => 'javascript:alert(1)', async () => { throw new Error('403'); }]) {
    const { collab, actions } = capability('viewer', { preview: answer });
    openVersionPreview({ collab, entry: entry(), actions, openCopy: async () => {} });
    await settle();
    assert.equal(preview()!.querySelector('img')?.hidden, true);
    assert.equal(preview()!.querySelector('.modal-msg')?.textContent, 'Preview unavailable for this version.');
    assert.equal(preview()!.querySelector('.modal-msg')?.hasAttribute('hidden'), false);
    press(preview()!, 'Close preview');
  }
});

test('restore asks first, then offers Undo restore for 30 seconds, which restores the replaced state', async () => {
  const { collab, calls, actions } = capability('editor');
  openVersionPreview({ collab, entry: entry(), actions, openCopy: async () => {} });
  press(preview()!, 'Restore this version');
  await settle();
  const ask = dialogs().at(-1)!;
  assert.equal(ask.querySelector('.modal-title')?.textContent, 'Restore this version?');
  assert.match(ask.querySelector('.modal-msg')!.textContent!, /^Everyone in this document will see the restored version\./);
  assert.equal(ask.querySelector('[data-act="ok"]')?.textContent, 'Restore');
  await confirm(true);
  assert.deepEqual(calls.restore, ['ver_1']);
  assert.equal(preview(), null, 'the preview closes after a restore');
  assert.deepEqual(calls.changed, [undefined], 'the panel refreshes; the toast says what happened');
  const toast = document.querySelector('.undo-toast')!;
  assert.equal(toast.querySelector('.undo-toast-msg')?.textContent, 'Version restored.');
  assert.equal((toast.querySelector('.undo-toast-bar') as HTMLElement).style.animationDuration, `${UNDO_RESTORE_MS}ms`);
  assert.equal(UNDO_RESTORE_MS, 30_000);
  press(toast, 'Undo restore');
  await settle();
  assert.deepEqual(calls.restore, ['ver_1', 'ver_before']);
  assert.deepEqual(calls.changed, [undefined, 'Restore undone.']);
});

test('restore names what stayed unchanged, and a refusal or a cancel changes nothing', async () => {
  const { collab, calls, actions, answer } = capability('editor');
  for (const [result, copy] of [
    [{ undoId: 'ver_b', vetoed: ['brand'], skipped: ['layout'] }, 'Restored. Locked settings stay as they are.'],
    [{ undoId: 'ver_b', vetoed: [], skipped: ['layout'] }, 'Restored. Some document settings stay as they are while others are editing.'],
  ] as const) {
    answer(result);
    openVersionPreview({ collab, entry: entry(), actions, openCopy: async () => {} });
    press(preview()!, 'Restore this version');
    await confirm(true);
    assert.equal(document.querySelector('.undo-toast-msg')?.textContent, copy);
    flushUndoToasts();
  }
  answer({ skipped: [], vetoed: [] });
  openVersionPreview({ collab, entry: entry(), actions, openCopy: async () => {} });
  press(preview()!, 'Restore this version');
  await confirm(true);
  assert.equal(calls.changed.at(-1), 'Version restored.', 'without an undo target the panel says so itself');
  assert.equal(document.querySelector('.undo-toast'), null);
  answer(new Error('The document changed while restoring. Try again.'));
  openVersionPreview({ collab, entry: entry(), actions, openCopy: async () => {} });
  press(preview()!, 'Restore this version');
  await confirm(true);
  assert.deepEqual(calls.status, ['The document changed while restoring. Try again.']);
  assert.ok(preview(), 'a refused restore keeps the preview open');
  const before = calls.restore.length;
  press(preview()!, 'Restore this version');
  await confirm(false);
  assert.equal(calls.restore.length, before, 'Cancel restores nothing');
});

test('a manager deletes a version after a confirmation', async () => {
  const { collab, calls, actions } = capability('manager');
  openVersionPreview({ collab, entry: entry(), actions, openCopy: async () => {} });
  press(preview()!, 'Delete version');
  await settle();
  const ask = dialogs().at(-1)!;
  assert.equal(ask.querySelector('.modal-title')?.textContent, 'Delete this version?');
  assert.equal(ask.querySelector('.modal-msg')?.textContent, 'This removes the version from History for everyone.');
  await confirm(true);
  assert.deepEqual(calls.remove, ['ver_1']);
  assert.deepEqual(calls.changed, ['Version deleted.']);
  assert.equal(preview(), null);
});

test('Open as a copy closes the preview and uses the panel copy path', async () => {
  const { collab, actions } = capability('viewer');
  let copied = 0;
  openVersionPreview({ collab, entry: entry(), actions, openCopy: async () => { copied++; } });
  press(preview()!, 'Open as a copy');
  await settle();
  assert.equal(copied, 1);
  assert.equal(preview(), null);
});

test('Save version is offered to writers, names an unnamed version by its time and reports refusals', async () => {
  const viewer = capability('viewer');
  const hidden = mountVersionSave(viewer.collab, viewer.actions);
  hidden.update();
  assert.equal(hidden.el.hidden, true);
  const { collab, calls, actions } = capability('editor');
  const form = mountVersionSave(collab, actions);
  assert.equal(form.el.hidden, true, 'hidden until the history has loaded');
  form.update();
  assert.equal(form.el.hidden, false);
  document.body.append(form.el);
  const input = form.el.querySelector('input')!;
  assert.equal(input.getAttribute('aria-label'), 'Version name (optional)');
  assert.equal(input.maxLength, 120);
  input.value = '  Launch  ';
  form.el.requestSubmit();
  await settle();
  assert.deepEqual(calls.saved, ['Launch']);
  assert.deepEqual(calls.changed, ['Version saved.']);
  assert.equal(input.value, '');
  form.el.requestSubmit();
  await settle();
  assert.match(calls.saved[1]!, /^Version from /);
  collab.saveVersion = async () => { throw new Error('History is full. Ask a manager to delete old versions.'); };
  form.el.requestSubmit();
  await settle();
  assert.deepEqual(calls.status, ['History is full. Ask a manager to delete old versions.']);
  form.el.remove();
});
