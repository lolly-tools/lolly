// SPDX-License-Identifier: MPL-2.0
/**
 * lib/overlay-back.ts through both of its consumers: mountModal's native `<dialog>`
 * and mountBodyPopover's anchored popover share ONE Back stack, so a press closes the
 * innermost overlay whichever kind it is.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/overlay-back.test.ts
 *
 * Harness as in components/modal-back.test.ts: jsdom with a real origin (history and
 * location need one), showModal()/close() stubbed on the prototype (jsdom has
 * `<dialog>` but neither method), and history.back() spied rather than run, because
 * jsdom's traversal fires its popstate on a later task and would race the synthetic
 * events dispatched here. matchMedia is stubbed too - jsdom has none, and a popover
 * pushes an entry only where the pointer is coarse.
 *
 * The consequence of spying back() is the same as in that file: a test that CONSUMES
 * an entry leaves the stack expecting a popstate that never arrives, so the two that
 * do come last, and the popstate cases above them must run first to be meaningful.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { BodyPopoverHandle, PopoverAnchor } from '../components/body-popover.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/p' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;

const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

/** The device the popover gate reads, flipped per test. */
let coarse = true;
(dom.window as unknown as Record<string, unknown>).matchMedia =
  (q: string): { matches: boolean } => ({ matches: coarse && q.includes('coarse') });

let backs = 0;
(dom.window.history as unknown as Record<string, unknown>).back = (): void => { backs += 1; };

const { mountModal } = await import('../components/modal.ts');
const { mountBodyPopover } = await import('../components/body-popover.ts');

const fire = (type: string): void => { window.dispatchEvent(new dom.window.Event(type)); };
const dialogs = (): number => document.querySelectorAll('dialog').length;
const menus = (): number => document.querySelectorAll('.test-menu').length;
/** Let the deferred entry-consuming microtask run. */
const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const anchor: PopoverAnchor = {
  getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  contains: () => false,
};

/** An open menu. `container` mounts it inside a dialog, the way a kebab menu opened
 *  from within one does (folder-overlay's does). */
function openMenu(container?: HTMLElement): BodyPopoverHandle {
  const pop = mountBodyPopover(anchor, (el) => { el.textContent = 'items'; return null; },
    { className: 'test-menu', container });
  pop.open();
  return pop;
}

test('Back closes a menu opened inside a dialog, and the next press closes the dialog', () => {
  const closed: string[] = [];
  const dlg = mountModal<string>('<p>a</p>', { className: 'modal', cancelValue: 'esc', onClose: r => closed.push(String(r)) });
  openMenu(dlg.el);
  assert.equal(menus(), 1);
  fire('popstate');
  assert.equal(menus(), 0, 'the menu opened last, so it is what the press closes');
  assert.deepEqual(closed, [], 'the dialog it sits in stays open');
  assert.equal(dialogs(), 1);
  fire('popstate');
  assert.deepEqual(closed, ['esc'], 'the dialog is innermost now, and this press dismisses it');
  assert.equal(dialogs(), 0);
});

test('a fine pointer pushes no entry for a menu, so Back still reaches the dialog under it', () => {
  coarse = false;
  const closed: string[] = [];
  mountModal<string>('<p>a</p>', { className: 'modal', cancelValue: 'esc', onClose: r => closed.push(String(r)) });
  const before = window.history.length;
  openMenu();
  assert.equal(window.history.length, before, 'no entry per open on a desktop pointer');
  fire('popstate');
  assert.equal(menus(), 0, 'the menu still goes on the nav-away it has always had');
  assert.deepEqual(closed, ['esc'], 'and the press is the dialog entry\'s, so the dialog dismisses too');
  coarse = true;
});

test('Back and an outside click cannot both consume the menu entry', async () => {
  backs = 0;
  const menu = openMenu();
  fire('popstate');
  assert.equal(menus(), 0);
  menu.close(); // the click the Back press raced
  await settle();
  assert.equal(backs, 0, 'Back already consumed the entry, so nothing may pop it a second time');
});

test('a closed menu unregisters, and a self-pop closes nothing', async () => {
  backs = 0;
  const closed: string[] = [];
  const dlg = mountModal<string>('<p>a</p>', { className: 'modal', cancelValue: 'esc', onClose: r => closed.push(String(r)) });
  const menu = openMenu(dlg.el);
  menu.close();
  await settle();
  assert.equal(backs, 1, 'closing by another path pops the entry the menu pushed');
  fire('popstate'); // that back()'s own popstate, arriving late: bookkeeping, not a press
  assert.deepEqual(closed, [], 'a self-pop is not a Back press');
  assert.equal(dialogs(), 1);
  fire('popstate');
  assert.deepEqual(closed, ['esc'], 'with the menu off the stack the dialog takes the press again');
});

test('a menu on a coarse pointer pushes exactly one entry per open', async () => {
  backs = 0;
  const before = window.history.length;
  const menu = openMenu();
  assert.equal(window.history.length, before + 1);
  menu.close();
  await settle();
  assert.equal(backs, 1, 'and gives it back, so the next Back leaves the view rather than doing nothing');
});
