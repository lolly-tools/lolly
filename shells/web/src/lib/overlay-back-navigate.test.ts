// SPDX-License-Identifier: MPL-2.0
/**
 * A dialog choice that navigates must not be undone by the dialog's own Back.
 *
 * A closed dialog pops its history entry with `history.back()` on the next task
 * (lib/overlay-back.ts consume). Chromium applies that Back to whichever entry is
 * current when it runs, so an entry pushed after `back()` and before its popstate is
 * the entry it removes. The drop chooser's "Edit animation in Sequence" navigated in
 * that gap (it loads a module first), and the person was put back on the gallery.
 * navigateTo now waits for the pop to finish, then pushes.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/overlay-back-navigate.test.ts
 *
 * Harness as in overlay-back-settled.test.ts: jsdom with a real origin, showModal()
 * and close() stubbed, history.back() spied, and the traversal's popstate fired by
 * hand at the moment the browser would finish the traversal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
Reflect.set(globalThis, 'Event', dom.window.Event);
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };
let backs = 0;
(dom.window.history as unknown as Record<string, unknown>).back = (): void => { backs += 1; };

const { mountModal } = await import('../components/modal.ts');
const { navigateTo } = await import('../nav.ts');
const { historySettled } = await import('./overlay-back.ts');
const navigations: string[] = [];
window.addEventListener('lolly:navigate', () => { navigations.push(location.hash); });
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
/** The browser finishes the dialog's Back: the entry current now is the one popped. */
const landBack = (): void => { window.dispatchEvent(new dom.window.Event('popstate')); };

test('with no dialog closing, navigateTo pushes at once', () => {
  navigateTo('#/utilities');
  assert.equal(location.hash, '#/utilities');
  assert.deepEqual(navigations, ['#/utilities']);
  navigations.length = 0;
});

test('a navigation made while a closed dialog is popping its entry waits for the pop, then pushes', async () => {
  const modal = mountModal<'animation'>('<p>What should Lolly do with this file?</p>', { className: 'modal' });
  modal.close('animation');
  await tick();
  assert.equal(backs, 1, 'the dialog has issued its Back');
  // The chosen route navigates before that Back has finished.
  navigateTo('#/tool/design');
  assert.equal(location.hash, '#/utilities', 'no entry is pushed under a Back that is still on its way');
  assert.deepEqual(navigations, []);
  landBack();
  await historySettled(5_000);
  await tick();
  assert.equal(location.hash, '#/tool/design', 'the navigation the person chose is where they end up');
  assert.deepEqual(navigations, ['#/tool/design']);
});
