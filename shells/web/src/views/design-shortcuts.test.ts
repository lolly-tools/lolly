// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body><button id="opener">Help</button></body>', {
  url: 'https://lolly.test/',
});
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLDialogElement',
  'Event',
  'Node',
  'history',
  'location',
]) {
  (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[
    key
  ];
}
Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  },
});
Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new dom.window.Event('close'));
  },
});

const { designShortcutGroups, openDesignShortcuts } = await import('./design-shortcuts.ts');

test('the inventory documents every cross-surface Design chord, including style and panels', () => {
  const rows = designShortcutGroups('MacIntel').flatMap((group) => group.rows);
  const byLabel = new Map(rows.map((row) => [row.label, row.keys]));
  assert.equal(byLabel.get('Save to your library'), '⌘ S');
  assert.equal(byLabel.get('Export'), '⌘ E');
  assert.equal(byLabel.get('Present'), '⌘ Enter');
  assert.equal(byLabel.get('Copy / paste style'), '⌘ ⌥ C / V');
  assert.equal(byLabel.get('Toggle timeline'), '⌥ 1');
  assert.equal(byLabel.get('Keyboard shortcuts'), '?');
});

test('the sheet is an accessible dialog, uses text nodes, and restores focus on close', () => {
  const opener = document.getElementById('opener') as HTMLButtonElement;
  opener.focus();
  let closes = 0;
  const modal = openDesignShortcuts({
    opener,
    onClose: () => {
      closes++;
    },
  });
  assert.equal(modal.el.getAttribute('aria-label'), 'Design keyboard shortcuts');
  assert.equal(modal.el.querySelectorAll('.fc-shortcuts-group').length, 4);
  assert.ok(modal.el.querySelectorAll('kbd').length > 20);
  assert.equal(document.activeElement?.textContent, 'Done');

  (document.activeElement as HTMLButtonElement).click();
  assert.equal(modal.el.isConnected, false);
  assert.equal(closes, 1);
  assert.equal(document.activeElement, opener);
});
