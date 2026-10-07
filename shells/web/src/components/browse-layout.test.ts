// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { layoutSection, readBrowseLayout, wireBrowseLayout } from './browse-layout.ts';
import { projectsViewFromUrl, readProjectsViewPrefs, writeProjectsViewPrefs } from '../views/projects-view-options.ts';

test('Card switches live tiles, keeps previews mounted, and remembers each view separately', () => {
  const dom = new JSDOM('<div id="panel"></div><div id="grid"><img id="preview"></div>', { url: 'https://example.test' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage });
  const panel = dom.window.document.querySelector<HTMLElement>('#panel')!, grid = dom.window.document.querySelector<HTMLElement>('#grid')!;
  panel.innerHTML = layoutSection('layout', 'preview', '<div class="view-options-size"></div>');
  const preview = grid.firstChild;
  wireBrowseLayout(panel, grid, 'tools', 'preview');
  panel.querySelector<HTMLButtonElement>('[data-vm="card"]')!.click();
  assert.equal(grid.dataset.browseLayout, 'card'); assert.equal(grid.firstChild, preview);
  assert.equal(readBrowseLayout('tools'), 'card'); assert.equal(readBrowseLayout('utilities'), 'preview');
  panel.querySelector<HTMLButtonElement>('[data-vm="list"]')!.click();
  assert.equal(panel.querySelector('.view-options-size')!.hasAttribute('hidden'), true);
  assert.equal(readBrowseLayout('tools', 'layout=card'), 'card');
  dom.window.close();
});
test('Projects stores Card per folder and accepts direct Card URLs', () => {
  const dom = new JSDOM('', { url: 'https://example.test' }); globalThis.localStorage = dom.window.localStorage;
  const fallback = { view: 'preview' as const, sort: 'modified' as const, reversed: false };
  writeProjectsViewPrefs('team:campaign', { ...fallback, view: 'card' });
  assert.equal(readProjectsViewPrefs('team:campaign', fallback, true).view, 'card');
  assert.equal(readProjectsViewPrefs('personal', fallback).view, 'preview');
  assert.equal(projectsViewFromUrl('view=card', fallback).view, 'card');
  dom.window.close();
});
