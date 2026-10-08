// SPDX-License-Identifier: MPL-2.0
/**
 * components/viewer-banner.ts and components/make-copy-sheet.ts: the view-only banner
 * and the "Make a copy" sheet (plan 75 J5 and section 5.16).
 *
 * The banner sits above the inputs in a sidebar layout and on the stage in an editor
 * layout, is announced once when it mounts, and keeps its role and action. The sheet
 * offers "In a project you can edit" only when there is such a project, shows the
 * caller's sentence when a copy could not be made, and stays open until one is.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/viewer-banner.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/#/tool/poster', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as History;
globalThis.location = dom.window.location as unknown as Location;
for (const k of ['HTMLElement', 'Element', 'Node', 'Event'] as const) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as typeof requestAnimationFrame;
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { mountViewerBanner } = await import('./viewer-banner.ts');
const { openMakeCopySheet } = await import('./make-copy-sheet.ts');
const settle = (ms = 10): Promise<void> => new Promise((r) => setTimeout(r, ms));

test('above the inputs in a sidebar layout, announced, with its action', async () => {
  const view = document.createElement('div');
  view.innerHTML = '<aside><div class="sidebar-body"><div id="tool-inputs"></div></div></aside><div id="tool-stage"></div>';
  document.body.append(view);
  let ran = 0;
  const banner = mountViewerBanner(view, { message: 'View only. Changes can’t be saved to Brand refresh.', action: { label: 'Make a copy', run: () => { ran++; } } });
  assert.equal(banner.el.nextElementSibling?.id, 'tool-inputs');
  assert.equal(banner.el.getAttribute('role'), 'note');
  assert.ok(!banner.el.classList.contains('viewer-banner--stage'));
  banner.el.querySelector<HTMLButtonElement>('.viewer-banner-action')!.click();
  assert.equal(ran, 1);
  await settle();
  assert.match(document.body.textContent ?? '', /View only\. Changes can’t be saved to Brand refresh\./);
  banner.update('View only. Changes can’t be saved to Drafts.');
  assert.equal(banner.el.querySelector('.viewer-banner-text')?.textContent, 'View only. Changes can’t be saved to Drafts.');
  banner.destroy();
  assert.equal(view.querySelector('.viewer-banner'), null);
  view.remove();
});

test('on the stage in an editor layout, which has no sidebar inputs', () => {
  const view = document.createElement('div');
  view.innerHTML = '<div id="tool-stage"><div id="tool-content"></div></div>';
  const banner = mountViewerBanner(view, { message: 'View only.' });
  assert.equal(banner.el.parentElement?.id, 'tool-stage');
  assert.ok(banner.el.classList.contains('viewer-banner--stage'));
  assert.equal(banner.el.querySelector('button'), null, 'no action, no button');
  banner.destroy();
});

test('the sheet: the project choice only when there is one, the caller\'s sentence on failure', async () => {
  const calls: unknown[] = [];
  let fail = true;
  const done = openMakeCopySheet({
    note: 'The copy is separate. Changes to the copy don’t reach Brand refresh.',
    projects: Promise.resolve([{ id: 'proj-2', name: 'Drafts' }]),
    make: async (choice) => { calls.push(choice); return fail ? 'You cannot save to that project.' : null; },
  });
  await settle();
  const sheet = document.querySelector('dialog.make-copy-sheet')!;
  assert.equal(sheet.querySelector('.modal-title')?.textContent, 'Make a copy');
  assert.equal(sheet.querySelector('legend')?.textContent, 'Where should the copy go?');
  assert.equal(sheet.querySelector('.make-copy-note')?.textContent, 'The copy is separate. Changes to the copy don’t reach Brand refresh.');
  const projectOption = sheet.querySelector<HTMLElement>('[data-project-option]')!;
  assert.equal(projectOption.hidden, false);
  const select = sheet.querySelector<HTMLSelectElement>('[data-project-select]')!;
  assert.equal(select.hidden, true, 'the project list waits for its choice');
  projectOption.querySelector<HTMLInputElement>('input')!.checked = true;
  sheet.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(select.hidden, false);
  sheet.querySelector<HTMLElement>('[data-act="make"]')!.click();
  await settle();
  assert.deepEqual(calls, [{ where: 'project', projectId: 'proj-2' }]);
  const status = sheet.querySelector<HTMLElement>('.make-copy-status')!;
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, 'You cannot save to that project.');
  assert.ok(sheet.isConnected, 'the sheet stays open so the person can try again');
  fail = false;
  sheet.querySelector<HTMLElement>('[data-act="make"]')!.click();
  assert.equal(await done, true);
  assert.equal(document.querySelector('dialog.make-copy-sheet'), null);
});

test('the sheet without an editable project offers this device only; Cancel makes nothing', async () => {
  const done = openMakeCopySheet({ note: 'x', projects: [], make: async () => null });
  await settle();
  const sheet = document.querySelector('dialog.make-copy-sheet')!;
  assert.equal(sheet.querySelector<HTMLElement>('[data-project-option]')!.hidden, true, '"In a project you can edit" is hidden');
  sheet.querySelector<HTMLElement>('[data-act="cancel"]')!.click();
  assert.equal(await done, false);
});
