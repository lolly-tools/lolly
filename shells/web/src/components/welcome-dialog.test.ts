// SPDX-License-Identifier: MPL-2.0
/**
 * The first-run welcome's own decisions (plans/137 A2/A3): what the dialog shows
 * before anyone touches it, what the language expander does, and which exits
 * count as a dismissal.
 *
 * Run directly (the module imports its stylesheet, so the CSS stub is required):
 *   node --import ./tests/css-stub.mjs --test shells/web/src/components/welcome-dialog.test.ts
 *
 * jsdom with a real origin (history + localStorage need one) and showModal/close
 * stubbed on the prototype, as in modal-back.test.ts - jsdom has <dialog> but
 * neither method.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
globalThis.localStorage = dom.window.localStorage;
// The dialog's delegated click handler narrows with `instanceof Element`, which
// resolves against the realm's global - not the jsdom window's.
globalThis.Element = dom.window.Element;

const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { showWelcomeDialog } = await import('./welcome-dialog.ts');

const dialog = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('.welcome-dialog');
  assert.ok(el, 'the welcome dialog should be mounted');
  return el;
};
const open = (): Promise<string> => {
  localStorage.clear();
  return showWelcomeDialog() as unknown as Promise<string>;
};

test('the language row opens collapsed: the detected language plus one expander', async () => {
  const settled = open();
  const el = dialog();
  assert.equal(el.querySelectorAll('[data-lang]').length, 1, 'one chip only - not the whole wall');
  assert.equal(el.querySelector('[data-lang]')?.getAttribute('data-lang'), 'en');
  assert.equal(el.querySelectorAll('[data-lang-more]').length, 1);
  // The visible twin of Escape, and page 1's short assurance line with its way
  // through to the full privacy page.
  assert.equal(el.querySelector('.welcome-skip')?.getAttribute('data-choice'), 'dismiss');
  assert.match(el.querySelector('.welcome-privacy')?.textContent ?? '', /stays on this device/);
  assert.equal(el.querySelector('.welcome-privacy-link')?.getAttribute('data-page'), '2');
  el.querySelector<HTMLButtonElement>('.welcome-skip')?.click();
  await settled;
});

test('page 2 is the privacy page, and only its "Got it" acknowledges the notice', async () => {
  const settled = open();
  const shell = dialog();
  assert.equal(localStorage.getItem('lolly-privacy-ack'), null, 'opening the dialog acknowledges nothing');

  // The page dots switch pages inside the SAME <dialog> - no second modal.
  shell.querySelector<HTMLButtonElement>('.welcome-dot[data-page="2"]')?.click();
  assert.equal(document.querySelectorAll('.welcome-dialog').length, 1);
  assert.equal(dialog(), shell, 'a page change re-paints the dialog, it never re-opens one');
  assert.equal(shell.querySelectorAll('.welcome-card').length, 0, 'the doors are page 1 only');
  assert.equal(shell.querySelector('.welcome-privacy-link')?.getAttribute('href'), '#/docs/trust/privacy'); // doored route (plans/177 P1)
  assert.ok(shell.querySelector('.welcome-skip'), 'the footer rides every page');
  assert.equal(shell.querySelectorAll('.welcome-dot').length, 2);
  assert.equal(localStorage.getItem('lolly-privacy-ack'), null, 'reading page 2 acknowledges nothing');

  // "Got it": acknowledges the standalone notice and COMPLETES the dialog
  // (audit 167 F-A4 - agreeing used to bounce back to page 1, which read as a
  // loop). It behaves as a dismissal, so the welcome flag settles too.
  shell.querySelector<HTMLButtonElement>('.welcome-gotit')?.click();
  assert.equal(localStorage.getItem('lolly-privacy-ack'), '1');
  const result = await settled;
  assert.equal(result, 'dismiss', 'Got it resolves as a dismissal');
  assert.equal(document.querySelectorAll('.welcome-dialog').length, 0, 'the dialog is gone - agreeing finished it');
  assert.equal(localStorage.getItem('lolly-welcome-dismissed'), '1', 'and the welcome does not re-ask next visit');
});

test('"More languages…" expands in place to the full row and retires itself', async () => {
  const settled = open();
  dialog().querySelector<HTMLButtonElement>('[data-lang-more]')?.click();
  const el = dialog();
  assert.ok(el.querySelectorAll('[data-lang]').length > 20, 'every language after expanding');
  assert.equal(el.querySelectorAll('[data-lang-more]').length, 0);
  assert.ok(el.querySelector('.welcome-skip'), 'the rest of the dialog survives the repaint');
  el.querySelector<HTMLButtonElement>('.welcome-skip')?.click();
  await settled;
});

test('"Skip for now" is a dismissal: it settles the welcome AND the privacy notice', async () => {
  const settled = open();
  dialog().querySelector<HTMLButtonElement>('.welcome-skip')?.click();
  assert.equal(await settled, 'dismiss');
  assert.equal(localStorage.getItem('lolly-welcome-dismissed'), '1');
  assert.equal(localStorage.getItem('lolly-privacy-ack'), '1');
});

test('a route change is teardown, not a dismissal - it persists neither flag', async () => {
  const settled = open();
  window.dispatchEvent(new dom.window.Event('hashchange'));
  await settled;
  assert.equal(document.querySelector('.welcome-dialog'), null);
  assert.equal(localStorage.getItem('lolly-welcome-dismissed'), null);
  assert.equal(localStorage.getItem('lolly-privacy-ack'), null);
});

test('taking a door persists the dismissal - the fork never re-asks after a detour (audit 167 F-A5)', async () => {
  // The brand door: choosing it IS an answer. Backing out of the brand room
  // must not re-raise the welcome; its own empty state is the re-invitation.
  const settled = open();
  const shell = dialog();
  shell.querySelector<HTMLButtonElement>('.welcome-card--brand')?.click();
  const result = await settled;
  assert.equal(result, 'brand');
  assert.equal(localStorage.getItem('lolly-welcome-dismissed'), '1', 'the brand door settles the welcome');
  // The door-taker never read page 2, so the privacy notice keeps its one-line
  // turn on a later visit - the door must NOT ack it.
  assert.equal(localStorage.getItem('lolly-privacy-ack'), null, 'privacy stays unacknowledged for the banner ladder');
});
