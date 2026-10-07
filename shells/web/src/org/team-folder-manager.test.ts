// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { mountTeamFolderManager, type ManagedProjectItem } from './team-folder-manager.ts';

const items: ManagedProjectItem[] = [{ kind: 'session', ref: 's1', name: 'Poster' }, { kind: 'session', ref: 's2', name: 'Flyer' }];
function fixture(projectId: string, folderId: string | null, writable = true) {
  const dom = new JSDOM(`<nav></nav><div id="toolbar"></div><p id="notice"></p><div id="grid">${items.map(item => `<div class="folder-tile" data-ref="${item.ref}" data-kind="team-session"><a href="#">${item.name}</a></div>`).join('')}</div>`, { url: 'https://example.test', pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, location: w.location, Element: w.Element, HTMLElement: w.HTMLElement, Node: w.Node, localStorage: w.localStorage, AbortController: w.AbortController });
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
  const reloads: Array<string | undefined> = [], grid = w.document.querySelector<HTMLElement>('#grid')!, toolbar = w.document.querySelector<HTMLElement>('#toolbar')!;
  const destroy = mountTeamFolderManager({ projectId, projectName: 'Campaign', folderId, grid, toolbar, breadcrumbs: w.document.querySelector('nav')!, notice: w.document.querySelector('#notice')!, items,
    folders: [{ id: 'drafts', name: 'Drafts', projectId, parentId: null, items: [] }], canWrite: writable, current: () => grid.isConnected,
    reload: message => reloads.push(message), itemMenu: () => '', itemAction: async () => {}, duplicate: async item => `${item.ref}-copy`,
  });
  const click = (text: string) => [...toolbar.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === text)!.click();
  return { dom, w, grid, toolbar, reloads, click, close: () => { destroy(); w.close(); } };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
test('Cut/Paste survives folder navigation and moves the complete selection through acknowledged writes', async () => {
  const original = globalThis.fetch, calls: unknown[] = [];
  globalThis.fetch = async (url, init) => { calls.push([String(url), JSON.parse(String(init?.body))]); return Response.json({}); };
  try {
    const first = fixture('clipboard-test', null); first.click('Select all'); first.click('Cut'); first.close();
    const next = fixture('clipboard-test', 'drafts'); next.click('Paste'); await settle();
    assert.deepEqual(calls, items.map(item => [`/api/v1/projects/clipboard-test/folders/items/session/${item.ref}`, { folderId: 'drafts' }]));
    assert.deepEqual(next.reloads, ['Items moved']); next.close();
  } finally { globalThis.fetch = original; }
});
test('a refused move remains visible as a failure and retains the cut clipboard for retry', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 403 });
  try {
    const f = fixture('failure-test', null); f.click('Select all'); f.click('Cut'); f.click('Paste'); await settle();
    assert.match(f.reloads[0]!, /could not be moved/);
    assert.equal([...f.toolbar.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Paste')!.disabled, false); f.close();
  } finally { globalThis.fetch = original; }
});
test('viewers retain selection and read actions without drag, clipboard writes or move controls', () => {
  const f = fixture('viewer-test', null, false);
  assert.equal([...f.toolbar.querySelectorAll('button')].some(button => button.textContent === 'Move to…'), false);
  assert.equal(f.grid.querySelector('[draggable="true"]'), null);
  f.click('Select all'); assert.equal(f.grid.querySelectorAll('.is-selected').length, 2); f.close();
});
