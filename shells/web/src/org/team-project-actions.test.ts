// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountTeamProjectActions } from './team-project-actions.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'CustomEvent', 'getComputedStyle', 'AbortController']) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

test('shared item menu shows three dots and provides permitted duplicate and delete actions', async () => {
  document.body.innerHTML = '<section><div id="grid"><article class="folder-tile" data-ref="session" data-kind="team-session"><span class="tile-title">First Day</span></article></div></section>';
  const grid = document.getElementById('grid')!, calls: string[] = [];
  const cleanup = mountTeamProjectActions({ grid, content: grid.parentElement!, projectId: 'project', projectName: 'Project', folderId: 'folder', folders: [], files: [],
    canWrite: true, canManage: true, canDeleteSession: true, current: () => true, reload() {}, notice() {},
    duplicate: async id => { calls.push(id); }, sessionAction: async () => undefined });
  try {
    const trigger = grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!;
    assert.equal(trigger.textContent, ''); assert.equal(trigger.querySelectorAll('circle').length, 3);
    assert.equal(trigger.getAttribute('aria-label'), 'Item actions for First Day');
    const select = grid.querySelector<HTMLButtonElement>('.tile-check')!;
    assert.equal(select.textContent, ''); assert.ok(select.querySelector('svg'));
    assert.equal(select.title, 'Select First Day');
    trigger.click();
    assert.ok(document.querySelector('[data-act="delete"]'));
    document.querySelector<HTMLButtonElement>('[data-act="duplicate"]')!.click();
    await settle(); assert.deepEqual(calls, ['session']);
  } finally { cleanup(); }
});

test('viewers have no duplicate or delete menu actions', () => {
  document.body.innerHTML = '<section><div id="grid"><article class="folder-tile" data-ref="session" data-kind="team-session"><span class="tile-title">First Day</span></article></div></section>';
  const grid = document.getElementById('grid')!;
  const cleanup = mountTeamProjectActions({ grid, content: grid.parentElement!, projectId: 'project', projectName: 'Project', folderId: 'folder', folders: [], files: [],
    canWrite: false, canManage: false, canDeleteSession: false, current: () => true, reload() {}, notice() {},
    duplicate: async () => { throw new Error('viewer cannot duplicate'); }, sessionAction: async () => undefined });
  try {
    grid.querySelector<HTMLButtonElement>('.tile-menu-btn')!.click();
    assert.equal(document.querySelector('[data-act="duplicate"]'), null);
    assert.equal(document.querySelector('[data-act="delete"]'), null);
  } finally { cleanup(); }
});
