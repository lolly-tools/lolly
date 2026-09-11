// SPDX-License-Identifier: MPL-2.0
/**
 * lib/bulk-bar.ts - the shared selection bar's markup + sync contract. Projects,
 * the catalog and the gallery all render through bulkBarHtml/syncBulkBar now, so
 * this suite is what keeps the three bars' behaviour identical (the same role
 * tile-select.test.ts plays for the gestures).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { bulkBarHtml, syncBulkBar, setBulkBarBusy, wireEscapeClearsSelection } from './bulk-bar.ts';
import type { BulkBarConfig } from './bulk-bar.ts';

function dom(): { host: HTMLElement; doc: Document } {
  const d = new JSDOM('<!doctype html><html><body></body></html>');
  const w = d.window;
  (globalThis as Record<string, unknown>).window = w;
  (globalThis as Record<string, unknown>).document = w.document;
  (globalThis as Record<string, unknown>).HTMLElement = w.HTMLElement;
  const host = w.document.createElement('div');
  w.document.body.appendChild(host);
  return { host: host as unknown as HTMLElement, doc: w.document as unknown as Document };
}

function cfg(over: Partial<BulkBarConfig> & { n?: () => number } = {}): BulkBarConfig {
  return {
    prefix: 'test-bulkbar',
    rootSelector: '.the-root',
    count: over.n ?? (() => 0),
    actions: over.actions ?? [
      { id: 'go', label: 'Go' },
      { id: 'maybe', label: () => 'Maybe', hidden: () => false },
    ],
  };
}

test('bulkBarHtml: prefix-derived classes, data-bulk ids, count region, clear button', () => {
  const { host } = dom();
  host.innerHTML = `<div class="the-root"></div>${bulkBarHtml(cfg())}`;
  const bar = host.querySelector('.test-bulkbar')!;
  assert.ok(bar, 'outer class comes from the prefix');
  assert.equal(bar.getAttribute('role'), 'region');
  assert.ok(bar.hasAttribute('hidden'), 'starts hidden until sync reveals it');
  assert.ok(bar.querySelector('.test-bulkbar-count[aria-live="polite"]'));
  assert.ok(bar.querySelector('.test-bulkbar-actions [data-bulk="go"]'));
  assert.ok(bar.querySelector('.test-bulkbar-clear[data-bulk="clear"]'));
});

test('syncBulkBar: reveals on selection, counts, toggles .has-selection on the root', () => {
  const { host } = dom();
  let n = 0;
  const c = cfg({ n: () => n });
  host.innerHTML = `<div class="the-root"></div>${bulkBarHtml(c)}`;
  const bar = host.querySelector<HTMLElement>('.test-bulkbar')!;
  const root = host.querySelector<HTMLElement>('.the-root')!;

  syncBulkBar(host, c);
  assert.ok(bar.hidden && !root.classList.contains('has-selection'));

  n = 3;
  syncBulkBar(host, c);
  assert.ok(!bar.hidden);
  assert.ok(root.classList.contains('has-selection'));
  assert.equal(bar.querySelector('.test-bulkbar-count')!.textContent, '3 selected');
});

test('syncBulkBar: dynamic label / hidden / disabled re-read every sync', () => {
  const { host } = dom();
  let fav = false;
  let one = false;
  const c = cfg({
    n: () => 2,
    actions: [
      { id: 'fav', label: () => (fav ? 'Unfavourite' : 'Favourite') },
      { id: 'copylink', label: 'Copy link', hidden: () => !one },
      { id: 'pin', label: 'Pin', disabled: () => !one },
    ],
  });
  host.innerHTML = `<div class="the-root"></div>${bulkBarHtml(c)}`;
  syncBulkBar(host, c);
  const label = (id: string): string => host.querySelector(`[data-bulk="${id}"] span`)!.textContent!;
  assert.equal(label('fav'), 'Favourite');
  assert.ok(host.querySelector<HTMLButtonElement>('[data-bulk="copylink"]')!.hidden);
  assert.ok(host.querySelector<HTMLButtonElement>('[data-bulk="pin"]')!.disabled);

  fav = true; one = true;
  syncBulkBar(host, c);
  assert.equal(label('fav'), 'Unfavourite');
  assert.ok(!host.querySelector<HTMLButtonElement>('[data-bulk="copylink"]')!.hidden);
  assert.ok(!host.querySelector<HTMLButtonElement>('[data-bulk="pin"]')!.disabled);
});

test('setBulkBarBusy: progress label, all controls disabled, sync leaves the bar alone', () => {
  const { host } = dom();
  const c = cfg({ n: () => 2 });
  host.innerHTML = `<div class="the-root"></div>${bulkBarHtml(c)}`;
  syncBulkBar(host, c);

  setBulkBarBusy(host, c, 'Pinning 1 of 2…');
  const count = host.querySelector('.test-bulkbar-count')!;
  assert.equal(count.textContent, 'Pinning 1 of 2…');
  for (const b of host.querySelectorAll<HTMLButtonElement>('.test-bulkbar button')) assert.ok(b.disabled);
  syncBulkBar(host, c);   // a mid-run sync must not clobber the progress line
  assert.equal(count.textContent, 'Pinning 1 of 2…');

  setBulkBarBusy(host, c, null);
  syncBulkBar(host, c);
  assert.equal(count.textContent, '2 selected');
  assert.ok(!host.querySelector<HTMLButtonElement>('[data-bulk="go"]')!.disabled);
});

test('wireEscapeClearsSelection: clears when active; yields to dialogs, menus and fields', () => {
  const { doc } = dom();
  let active = true;
  let cleared = 0;
  const unwire = wireEscapeClearsSelection({ active: () => active, clear: () => { cleared++; } });
  const esc = (): void => { doc.dispatchEvent(new (doc.defaultView!.KeyboardEvent)('keydown', { key: 'Escape', bubbles: true })); };

  esc();
  assert.equal(cleared, 1);

  active = false;
  esc();
  assert.equal(cleared, 1, 'inactive selection ignores Escape');
  active = true;

  // An open popover menu owns Escape (present in the DOM only while open).
  const menu = doc.createElement('div');
  menu.className = 'folder-menu';
  doc.body.appendChild(menu);
  esc();
  assert.equal(cleared, 1);
  menu.remove();

  // A focused text field keeps its own Escape.
  const input = doc.createElement('input');
  doc.body.appendChild(input);
  input.focus();
  esc();
  assert.equal(cleared, 1);
  input.remove();

  esc();
  assert.equal(cleared, 2);

  unwire();
  esc();
  assert.equal(cleared, 2, 'unbound after cleanup');
});
