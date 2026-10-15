// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-leave-dialog.ts: the Unsaved edits dialog, built in a DOM. Pins the
 * wording Andy chose on 15 October 2026, the order of the three actions with what
 * each one runs and that a team document's own question changes only the title.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-leave-dialog.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/t/qr-code' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
globalThis.Element = dom.window.Element as unknown as typeof globalThis.Element;

const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { showUnsavedDialog } = await import('./tool-leave-dialog.ts');
const scope = await import('../lib/document-scope.ts');

/** The open dialog, or null once it has closed. */
const openDialog = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>('dialog.unsaved-dialog');

/** What a person reads, top to bottom: the title, the sentence and each action with its label. */
function readDialog(dlg: HTMLDialogElement): { title: string; body: string; actions: string[][] } {
  return {
    title: dlg.querySelector('h2')?.textContent?.trim() ?? '',
    body: dlg.querySelector('p')?.textContent?.trim() ?? '',
    actions: [...dlg.querySelectorAll<HTMLElement>('[data-act]')].map(el => [el.dataset.act ?? '', el.textContent?.trim() ?? '']),
  };
}

const press = (dlg: HTMLDialogElement, act: string): void => {
  dlg.querySelector<HTMLElement>(`[data-act="${act}"]`)!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
};

test('the ordinary dialog reads Unsaved edits, then Save & leave, Leave anyway and Cancel in that order', () => {
  let saved = 0;
  let left = 0;
  showUnsavedDialog(async () => { saved++; }, () => { left++; });
  const dlg = openDialog();
  assert.ok(dlg?.open, 'the dialog is open');
  assert.deepEqual(readDialog(dlg), {
    title: 'Unsaved edits',
    body: 'Save now or abandon your changes.',
    actions: [['save', 'Save & leave'], ['leave', 'Leave anyway'], ['cancel', 'Cancel']],
  });
  assert.equal(dlg.querySelectorAll('button').length, 3, 'three native buttons without the jelly flag');
  press(dlg, 'cancel');
  assert.equal(openDialog(), null, 'Cancel closes the dialog');
  assert.deepEqual({ saved, left }, { saved: 0, left: 0 }, 'and neither saves nor leaves');
});

test('Leave anyway runs the leave callback and Save & leave runs the save', async () => {
  let saved = 0;
  let left = 0;
  showUnsavedDialog(async () => { saved++; }, () => { left++; });
  press(openDialog()!, 'leave');
  assert.equal(openDialog(), null);
  assert.deepEqual({ saved, left }, { saved: 0, left: 1 });

  showUnsavedDialog(async () => { saved++; }, () => { left++; });
  press(openDialog()!, 'save');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(openDialog(), null);
  assert.deepEqual({ saved, left }, { saved: 1, left: 1 });
});

test('a tool with nothing to save offers Leave anyway and Cancel only', () => {
  showUnsavedDialog(null, () => {});
  const dlg = openDialog()!;
  assert.deepEqual(readDialog(dlg).actions, [['leave', 'Leave anyway'], ['cancel', 'Cancel']]);
  press(dlg, 'cancel');
});

test('a team document asks its own question in the title, with the same sentence and buttons', () => {
  scope._resetDocumentScopeForTests();
  const off = scope.registerDocumentScope({
    chip: () => ({ label: 'Brand refresh · Can edit', role: 'edit' }),
    leavePrompt: () => 'Save changes to <b>Brand refresh</b>?',
  });
  const stop = scope.mountDocumentScope({
    toolId: 'qr-code', view: document.createElement('div'),
    document: () => ({ inputs: {} }), unsaved: () => true, saveOnDevice: async () => true,
  });
  try {
    showUnsavedDialog(async () => {}, () => {});
    const dlg = openDialog()!;
    assert.deepEqual(readDialog(dlg), {
      title: 'Save changes to <b>Brand refresh</b>?',
      body: 'Save now or abandon your changes.',
      actions: [['save', 'Save & leave'], ['leave', 'Leave anyway'], ['cancel', 'Cancel']],
    });
    assert.equal(dlg.querySelector('h2 b'), null, 'the question is text, never markup');
    press(dlg, 'cancel');
  } finally {
    stop();
    off();
    scope._resetDocumentScopeForTests();
  }
});
