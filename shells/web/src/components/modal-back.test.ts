// SPDX-License-Identifier: MPL-2.0
/**
 * mountModal's navigation half (components/modal.ts): a dialog lives on
 * `document.body`, outside the router's `#view`, so a route change under it would
 * strand it in the top layer over the next view, and system Back would navigate
 * that view away instead of closing the dialog.
 *
 * Run directly:  node --test shells/web/src/components/modal-back.test.ts
 *
 * jsdom with a real origin (history/location need one), and showModal()/close()
 * stubbed on the prototype - jsdom has <dialog> but neither method.
 *
 * `history.back()` is spied, not run: jsdom's traversal fires its popstate on a
 * later task, which would race the synthetic events these tests dispatch. The
 * consequence is that the tests which DO consume an entry leave the primitive
 * expecting a popstate that never arrives, so they come last in this file - the
 * popstate cases above them must run first to be meaningful.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/p' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;

const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

let backs = 0;
(dom.window.history as unknown as Record<string, unknown>).back = (): void => { backs += 1; };

const { mountModal } = await import('./modal.ts');

const fire = (type: string): void => { window.dispatchEvent(new dom.window.Event(type)); };
const dialogs = (): number => document.querySelectorAll('dialog').length;
/** Let the deferred entry-consuming microtask run. */
const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

test('a route change under a dialog tears it down, and reads as teardown not dismissal', () => {
  const results: unknown[] = [];
  mountModal<string>('<p>a</p>', { className: 'modal', cancelValue: 'cancelled', onClose: r => results.push(r) });
  assert.equal(dialogs(), 1);
  fire('hashchange');
  assert.equal(dialogs(), 0);
  // undefined, NOT cancelValue: no user chose anything (welcome-dialog persists its
  // "seen" flag on a real dismissal only).
  assert.deepEqual(results, [undefined]);
});

test('lolly:navigate closes every open dialog', () => {
  mountModal('<p>a</p>', { className: 'modal' });
  mountModal('<p>b</p>', { className: 'modal' });
  fire('lolly:navigate');
  assert.equal(dialogs(), 0);
});

test('Back closes the topmost dialog only, as a dismissal', () => {
  const closed: string[] = [];
  mountModal<string>('<p>a</p>', { className: 'modal', cancelValue: 'esc-a', onClose: r => closed.push(`a:${r}`) });
  mountModal<string>('<p>b</p>', { className: 'modal', cancelValue: 'esc-b', onClose: r => closed.push(`b:${r}`) });
  fire('popstate');
  assert.deepEqual(closed, ['b:esc-b']);
  assert.equal(dialogs(), 1, 'the dialog underneath keeps its own entry for the next Back');
  fire('popstate');
  assert.deepEqual(closed, ['b:esc-b', 'a:esc-a']);
  assert.equal(dialogs(), 0);
});

test('onClose fires exactly once however many close paths run', () => {
  let calls = 0;
  const handle = mountModal<string>('<p>a</p>', { className: 'modal', cancelValue: 'esc', onClose: () => { calls += 1; } });
  fire('popstate');
  handle.close('ok');
  handle.close('ok');
  fire('popstate');
  assert.equal(calls, 1);
});

test('opening pushes one entry per dialog', () => {
  const before = window.history.length;
  const a = mountModal('<p>a</p>', { className: 'modal' });
  const b = mountModal('<p>b</p>', { className: 'modal' });
  assert.equal(window.history.length, before + 2);
  b.close();
  a.close();
});

test('closing by a path other than Back pops the entry it pushed', async () => {
  backs = 0;
  const handle = mountModal('<p>a</p>', { className: 'modal' });
  handle.close();
  await settle();
  assert.equal(backs, 1);
});

test('a dialog closed by a route change leaves its entry alone', async () => {
  backs = 0;
  mountModal('<p>a</p>', { className: 'modal' });
  fire('hashchange');
  await settle();
  assert.equal(backs, 0, 'popping here would undo the navigation the user just made');
});

test('a URL moved since the push (a replaceState under an open dialog) is left alone', async () => {
  backs = 0;
  const handle = mountModal('<p>a</p>', { className: 'modal' });
  history.replaceState(null, '', '#/p?q=moved');
  handle.close();
  await settle();
  assert.equal(backs, 0, 'the entry below no longer holds the URL we pushed');
});

test('an inner dialog still open blocks the outer one from popping its entry', async () => {
  backs = 0;
  const outer = mountModal('<p>a</p>', { className: 'modal' });
  const inner = mountModal('<p>b</p>', { className: 'modal' });
  outer.close();
  await settle();
  assert.equal(backs, 0, 'back() can only pop the newest entry, which is the inner dialog\'s');
  inner.close();
  await settle();
  assert.equal(backs, 1);
});
