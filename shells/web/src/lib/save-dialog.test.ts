// SPDX-License-Identifier: MPL-2.0
/**
 * The "Save as…" dialog's cards - "Create a tool" (SURFACE 3 part 2) and the template card
 * (plans/226 WP-1). save-dialog.ts is pure DOM + injected deps (its own header), so it is
 * headless-testable: no host bridge, no runtime, no store shapes. We stub the native
 * <dialog> methods jsdom does not implement (showModal/close), then drive the cards the
 * way a user would.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { openSaveDialog, type SaveDialogDeps } from './save-dialog.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
// jsdom ships no showModal/close on <dialog> - stub them to the minimum mountModal needs
// (an `open` attribute it toggles, then removes the node on close).
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLElement) { this.removeAttribute('open'); };

function baseDeps(over: Partial<SaveDialogDeps>): SaveDialogDeps {
  return {
    toolName: 'Design',
    listFolders: async () => [],
    createFolder: async (name) => ({ id: 'f', name }),
    saveToLibrary: async () => true,
    saveTemplate: async () => {},
    ...over,
  };
}

const q = <T extends HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);
const cleanup = (): void => { document.querySelectorAll('dialog.save-dialog').forEach(d => d.remove()); };

test('the Create a tool card appears only with canCreateTool AND createTool', () => {
  openSaveDialog(baseDeps({}));
  assert.equal(q('[data-card="tool"]'), null, 'absent by default');
  cleanup();

  openSaveDialog(baseDeps({ canCreateTool: true })); // flag but no impl → still hidden
  assert.equal(q('[data-card="tool"]'), null, 'the flag alone does not show it');
  cleanup();

  openSaveDialog(baseDeps({ canCreateTool: true, createTool: async () => {} }));
  assert.ok(q('[data-card="tool"]'), 'shown when both are present');
  cleanup();
});

test('Create a tool: renders a pre-checked box per base format and creates from the captured fields', async () => {
  const created: Array<{ title: string; description: string; icon: string; formats: string[] }> = [];
  openSaveDialog(baseDeps({
    canCreateTool: true,
    toolFormats: ['png', 'svg', 'pdf'],
    createTool: async (meta) => { created.push(meta); },
  }));
  const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('[data-tool-format]'));
  assert.equal(boxes.length, 3, 'one checkbox per base-tool format');
  assert.ok(boxes.every(b => b.checked), 'every format is pre-selected');

  boxes.find(b => b.value === 'pdf')!.checked = false;              // drop pdf
  q<HTMLInputElement>('[data-tool-title]')!.value = '  My Poster Maker  '; // trimmed
  q<HTMLInputElement>('[data-tool-desc]')!.value = 'Square posters';
  q<HTMLInputElement>('[data-tool-icon]')!.value = '🎨';
  q<HTMLButtonElement>('[data-act="create-tool"]')!.click();
  await new Promise(r => setTimeout(r, 0));

  assert.equal(created.length, 1, 'createTool called once');
  assert.deepEqual(created[0], {
    title: 'My Poster Maker', description: 'Square posters', icon: '🎨', formats: ['png', 'svg'],
  }, 'captured the trimmed title, description, icon, and the selected formats only');
  assert.equal(q('dialog.save-dialog'), null, 'the dialog closes once the tool is created');
  cleanup();
});

// ── The template card (plans/226 WP-1) ───────────────────────────────────────────────
// The card used to be gated on "this tool already ships templates", which is why ~50 of
// 66 tools could never make a FIRST one. The gate is now "this tool has something a
// template could carry" (canSaveTemplate(manifest.inputs)), computed by the caller.

test('the template card shows on a tool with NO templates of its own, and hides when the tool cannot carry one', () => {
  openSaveDialog(baseDeps({ canSaveTemplate: true, existingTemplates: [] }));
  assert.ok(q('[data-card="template"]'), 'a tool with zero existing templates still gets the card');
  assert.equal(q('[data-tpl-target]'), null, 'with nothing to update there is no Save as new / Update select');
  assert.ok(q('[data-tpl-name]'), 'a name field');
  assert.ok(q('[data-tpl-desc]'), 'an optional one-line description');
  assert.ok(q('[data-tpl-start]'), 'the Start-with checkbox');
  cleanup();

  openSaveDialog(baseDeps({ canSaveTemplate: false }));
  assert.equal(q('[data-card="template"]'), null, 'a file-only utility is offered nothing to save');
  cleanup();
});

test('the two saves are PEER cards - no disclosure around them, and no variation card anywhere', () => {
  openSaveDialog(baseDeps({ canSaveTemplate: true }));
  const cards = q<HTMLElement>('.save-cards');
  assert.ok(cards, 'the peer cards share one grid');
  assert.ok(cards!.querySelector('[data-card="project"]'), 'project card is a peer');
  assert.ok(cards!.querySelector('[data-card="template"]'), 'template card is a peer');
  assert.equal(
    q<HTMLElement>('[data-card="template"]')!.closest('details'), null,
    'the template card is not folded under the More disclosure any more',
  );
  const html = q<HTMLElement>('dialog.save-dialog')!.innerHTML;
  assert.doesNotMatch(html, /variation/i, 'the "Save as a variation" card is gone (plans/226 C3)');
  assert.match(html, /<h2>Save as<\/h2>/, 'the dialog is named for what it does (no ellipsis, 2026-09-10)');
  cleanup();
});

test('a new template reports its name, description and Start-with choice', async () => {
  const saved: Array<{ name: string; description: string; startWith: boolean }> = [];
  openSaveDialog(baseDeps({
    canSaveTemplate: true,
    templateName: 'Quarterly deck',
    saveTemplate: async (meta) => { saved.push(meta); },
  }));
  const name = q<HTMLInputElement>('[data-tpl-name]')!;
  assert.equal(name.value, 'Quarterly deck', 'the caller prefills the name');
  name.value = '  Poster  ';
  q<HTMLInputElement>('[data-tpl-desc]')!.value = 'A4, brand colours';
  const start = q<HTMLInputElement>('[data-tpl-start]')!;
  assert.equal(start.checked, false, 'Start-with is opt-in');
  start.checked = true;
  q<HTMLButtonElement>('[data-act="save-template"]')!.click();
  await new Promise(r => setTimeout(r, 0));

  assert.deepEqual(saved, [{ name: 'Poster', description: 'A4, brand colours', startWith: true }]);
  assert.equal(q('dialog.save-dialog'), null, 'the dialog closes once the template is saved');
  cleanup();
});

test('picking an existing template updates THAT id, keeps its name, and reflects the current Start-with', async () => {
  const updates: Array<[string, { description: string; startWith: boolean }]> = [];
  let saves = 0;
  openSaveDialog(baseDeps({
    canSaveTemplate: true,
    existingTemplates: [{ id: 'ut-1', name: 'Poster' }, { id: 'ut-2', name: 'Card' }],
    startWithId: 'ut-2',
    saveTemplate: async () => { saves++; },
    updateTemplate: async (id, meta) => { updates.push([id, meta]); },
  }));
  const sel = q<HTMLSelectElement>('[data-tpl-target]')!;
  assert.equal(sel.options.length, 3, 'Save as new + one option per existing template');
  assert.equal(sel.value, '', 'a new template is the default');
  assert.equal(q<HTMLInputElement>('[data-tpl-start]')!.checked, false, 'nothing to reflect for a new one');

  sel.value = 'ut-2';
  sel.dispatchEvent(new dom.window.Event('change'));
  assert.equal(q<HTMLElement>('[data-tpl-name-row]')!.hidden, true, 'an update keeps the template name it has');
  assert.equal(q<HTMLInputElement>('[data-tpl-start]')!.checked, true,
    'the tool already starts with ut-2, so the box shows that rather than proposing to unset it');

  sel.value = 'ut-1';
  sel.dispatchEvent(new dom.window.Event('change'));
  assert.equal(q<HTMLInputElement>('[data-tpl-start]')!.checked, false, 'a different template is not the start');
  q<HTMLInputElement>('[data-tpl-desc]')!.value = 'Now with bleed';
  q<HTMLButtonElement>('[data-act="save-template"]')!.click();
  await new Promise(r => setTimeout(r, 0));

  assert.equal(saves, 0, 'an update never creates a second record');
  assert.deepEqual(updates, [['ut-1', { description: 'Now with bleed', startWith: false }]]);
  cleanup();
});

test('a blank template name surfaces an inline error and never saves', async () => {
  let calls = 0;
  openSaveDialog(baseDeps({ canSaveTemplate: true, saveTemplate: async () => { calls++; } }));
  q<HTMLInputElement>('[data-tpl-name]')!.value = '   ';
  q<HTMLButtonElement>('[data-act="save-template"]')!.click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(calls, 0, 'no unnamed template');
  const err = q<HTMLElement>('[data-err="template"]');
  assert.ok(err && !err.hidden && (err.textContent ?? '').length > 0, 'an inline error beside the card');
  assert.ok(q('dialog.save-dialog'), 'the dialog stays open so the name can be typed');
  cleanup();
});

test('focus: "template" opens on the template card', () => {
  openSaveDialog(baseDeps({ canSaveTemplate: true, focus: 'template' }));
  assert.equal(document.activeElement, q('[data-tpl-name]'), 'the name field takes focus');
  cleanup();
  openSaveDialog(baseDeps({ canSaveTemplate: true }));
  assert.equal(document.activeElement, q('[data-act="save-project"]'), 'the everyday save is the default');
  cleanup();
});

test('Create a tool: a blank name surfaces an inline error and never calls createTool', async () => {
  let calls = 0;
  openSaveDialog(baseDeps({ canCreateTool: true, toolFormats: ['png'], createTool: async () => { calls++; } }));
  q<HTMLButtonElement>('[data-act="create-tool"]')!.click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(calls, 0, 'no create on an empty name');
  const err = q<HTMLElement>('[data-err="tool"]');
  assert.ok(err && !err.hidden && (err.textContent ?? '').length > 0, 'an inline error is shown beside the card');
  cleanup();
});
