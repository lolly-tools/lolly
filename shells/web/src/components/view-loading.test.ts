// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><button id="opener">Open</button></body>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;
for (const key of ['HTMLElement', 'Element', 'Node', 'Event', 'history', 'location'] as const) {
  (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[key];
}
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };

const { beginViewLoading, focusWhenViewReady } = await import('./view-loading.ts');
const { mountModal } = await import('./modal.ts');
const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const card = (): HTMLDialogElement | null => document.querySelector('dialog.view-loading');

test('a quick mount cancels the pending card', async () => {
  const loading = beginViewLoading(20);
  loading.close();
  await pause(30);
  assert.equal(card(), null);
});

test('a slow mount gets the Lolly status card without changing browser history', async () => {
  const before = history.length;
  const loading = beginViewLoading(0);
  await pause(5);
  try {
    assert.ok(card()?.open);
    assert.equal(card()!.querySelector('[role="status"]')?.textContent, 'Loading…');
    assert.equal(card()!.querySelectorAll('.lolly-mark__spin-1').length, 2);
    assert.equal(history.length, before);
    card()!.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
    card()!.dispatchEvent(new dom.window.MouseEvent('click', { clientX: -1, clientY: -1 }));
    assert.ok(card()?.open, 'Escape and stray backdrop clicks do not hide feedback');
  } finally { loading.close(); }
  assert.equal(card(), null);
  loading.close();
});

test('a newer navigation replaces feedback and an older completion cannot close the new card', async () => {
  const older = beginViewLoading(0);
  await pause(5);
  const oldCard = card()!;
  const newer = beginViewLoading(0);
  await pause(5);
  try {
    assert.equal(oldCard.isConnected, false);
    assert.notEqual(card(), oldCard);
    older.close();
    assert.ok(card()?.open);
    assert.equal(document.querySelectorAll('dialog.view-loading').length, 1);
  } finally { newer.close(); }
});

test('a document progress card or chooser takes over without a loading card underneath', async () => {
  const loading = beginViewLoading(0);
  await pause(5);
  const chooser = mountModal('<button>Choose</button>', { className: 'modal', backStack: false });
  await pause(5);
  assert.equal(card(), null);
  assert.ok(chooser.el.open);
  chooser.close();
  await pause(5);
  assert.equal(card(), null, 'closing the chooser does not revive loading feedback');
  loading.close();
});

test('a chooser opened during the delay prevents the loading card from appearing', async () => {
  const loading = beginViewLoading(20);
  const chooser = mountModal('<button>Choose</button>', { className: 'modal', backStack: false });
  await pause(5);
  chooser.close();
  await pause(30);
  assert.equal(card(), null);
  loading.close();
});

test('focus a view places under the card is applied as the card closes, and only the latest', async () => {
  const placed: string[] = [];
  focusWhenViewReady(() => placed.push('no card'));
  assert.deepEqual(placed, ['no card'], 'with nothing on screen focus is placed at once');
  const loading = beginViewLoading(0);
  await pause(5);
  focusWhenViewReady(() => placed.push('first'));
  focusWhenViewReady(() => placed.push('latest'));
  assert.deepEqual(placed, ['no card'], 'the page under the modal card is inert');
  loading.close();
  assert.deepEqual(placed, ['no card', 'latest']);
});

test('a request from the view being left does not follow into the next one', async () => {
  const placed: string[] = [];
  beginViewLoading(0);
  await pause(5);
  focusWhenViewReady(() => placed.push('old view'));
  const newer = beginViewLoading(0);
  await pause(5);
  newer.close();
  assert.deepEqual(placed, []);
});
