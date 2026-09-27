// SPDX-License-Identifier: MPL-2.0
/**
 * historySettled() in lib/overlay-back.ts: a flow that closes a dialog and then
 * rewrites or leaves the entry underneath (Leave without saving, plan 277 P1) waits
 * until the dialog's own Back entry has been popped, so the view's entry is current.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/overlay-back-settled.test.ts
 *
 * Harness as in overlay-back.test.ts: jsdom with a real origin, showModal()/close()
 * stubbed, and history.back() spied, with the traversal's popstate fired by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/t/qr-code' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };
let backs = 0;
(dom.window.history as unknown as Record<string, unknown>).back = (): void => { backs += 1; };

const { mountModal } = await import('../components/modal.ts');
const { historySettled } = await import('./overlay-back.ts');
const popstate = (): void => { window.dispatchEvent(new dom.window.Event('popstate')); };
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

test('nothing owed: settled at once', async () => {
  let done = false;
  await historySettled().then(() => { done = true; });
  assert.equal(done, true);
});

test('a closed dialog: settled only once its entry is popped and the popstate has arrived', async () => {
  let left = false;
  const modal = mountModal<'leave'>('<p>Unsaved changes</p>', { className: 'unsaved-dialog', onClose: () => { left = true; } });
  modal.close('leave');
  assert.equal(left, true, 'the choice runs while the dialog entry is still current');
  let settled = false;
  const waiting = historySettled(5_000).then(() => { settled = true; });
  await tick();
  assert.equal(backs, 1, 'the dialog pops its own entry on the next task');
  assert.equal(settled, false, 'not before the traversal reports back');
  popstate();
  await waiting;
  assert.equal(settled, true);
});

test('a traversal the browser never reports releases the wait after the timeout', async () => {
  const modal = mountModal<'leave'>('<p>again</p>', { className: 'unsaved-dialog' });
  modal.close('leave');
  const started = Date.now();
  await historySettled(30);
  assert.ok(Date.now() - started >= 25);
  popstate(); // the late popstate still settles the module's own bookkeeping
  await historySettled(5_000);
});
