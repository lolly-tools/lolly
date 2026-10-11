// SPDX-License-Identifier: MPL-2.0
/*
 * The top-level view switcher's shell boundary. The animated Jelly form is a
 * progressive web enhancement; Tauri must retain the native icon+label links
 * because real WKWebView builds can mis-composite Jelly's overflow canvas and
 * hidden sizing clone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const { jellyNavSupportedInCurrentShell, viewToggle, VIEW_TOGGLE_HREFS } = await import('./view-toggle.ts');

test('Tools uses an explicit gallery route on every browse tab and in the animated switcher', () => {
  assert.equal(VIEW_TOGGLE_HREFS.tools, '#/tools');
  for (const active of ['tools', 'utilities', 'catalog', 'projects'] as const) {
    const wrapper = dom.window.document.createElement('div');
    wrapper.innerHTML = viewToggle(active);
    assert.equal(wrapper.querySelector('[data-vt="tools"]')?.getAttribute('href'), '#/tools');
  }
});

test('the animated Jelly view switcher remains available in an ordinary browser', () => {
  delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  assert.equal(jellyNavSupportedInCurrentShell(), true);
});

test('Tauri shells use the stable native icon-and-label switcher', () => {
  (window as typeof window & { __TAURI_INTERNALS__?: { invoke: () => Promise<void> } }).__TAURI_INTERNALS__ = {
    invoke: async () => undefined,
  };

  assert.equal(jellyNavSupportedInCurrentShell(), false);
  const html = viewToggle('tools');
  for (const label of ['Tools', 'Utilities', 'Assets', 'Projects']) {
    assert.match(html, new RegExp(`<span class="view-toggle-label">${label}</span>`));
  }
  assert.match(html, /aria-current="page"/);
});
